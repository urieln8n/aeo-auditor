// Anexo: escáner público de Cloudflare (isitagentready.com). NO cuenta para la nota global.
// Va por REST (trae evidence[] por comprobación); el MCP queda de respaldo.
// Ojo: la respuesta real viene en camelCase aunque su documentación diga snake_case.

export const NIVELES = ['Not Ready', 'Basic Web Presence', 'Bot-Aware', 'Agent-Readable', 'Agent-Integrated', 'Agent-Native'];

async function porRest(url) {
  const r = await fetch('https://isitagentready.com/api/scan', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }), signal: AbortSignal.timeout(60000),
  });
  if (!r.ok) throw new Error(`REST HTTP ${r.status}`);
  return { via: 'rest', ...(await r.json()) };
}

async function porMcp(url) {
  const r = await fetch('https://isitagentready.com/mcp', {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'scan_site', arguments: { url } } }),
    signal: AbortSignal.timeout(60000),
  });
  if (!r.ok) throw new Error(`MCP HTTP ${r.status}`);
  const texto = await r.text();
  return { via: 'mcp', bruto: texto.slice(0, 5000) };
}

/** Solo cuenta pass/fail; los neutral son informativos y no entran en el denominador. */
function resumir(res) {
  const checks = res.checks || res.results || [];
  const lista = Array.isArray(checks) ? checks : Object.values(checks).flat();
  const puntuables = lista.filter((c) => c.status === 'pass' || c.status === 'fail');
  return {
    nivel: res.level ?? null,
    nivelNombre: res.levelName ?? (res.level != null ? NIVELES[res.level] : null),
    escaneado: res.scannedAt ?? null,
    pasan: puntuables.filter((c) => c.status === 'pass').length,
    puntuables: puntuables.length,
    checks: lista.map((c) => ({ id: c.id || c.name, categoria: c.category, estado: c.status, evidencia: c.evidence || null })),
  };
}

export async function agentReadiness(url, robotsPropio) {
  let res;
  try { res = await porRest(url); }
  catch (e1) {
    try { res = await porMcp(url); }
    catch (e2) { return { error: `No se pudo consultar isitagentready.com (${e1.message}; ${e2.message})` }; }
  }
  if (res.via === 'mcp') return { via: 'mcp', bruto: res.bruto, nota: 'Respaldo MCP: revisar a mano.' };
  const resumen = resumir(res);
  // Contraste con nuestro eje 1: si Cloudflare dice que robots.txt falla y nosotros lo vimos bien, investigar
  const cfRobots = resumen.checks.find((c) => /robots/i.test(c.id || ''));
  const contrasteEje1 = cfRobots ? {
    cloudflare: cfRobots.estado, nuestro: robotsPropio.status === 200 ? 'pass' : 'fail',
    discrepan: (cfRobots.estado === 'pass') !== (robotsPropio.status === 200),
    evidencia: cfRobots.evidencia,
  } : null;
  return { via: 'rest', ...resumen, contrasteEje1 };
}
