// Anexo "Capa de agentes": Cloudflare, Markdown para agentes y Content Signals.
// NO cuenta para la nota global (como el anexo de isitagentready): es la palanca para subir del nivel 2 al 3.
// No suplantamos bots: Cloudflare verifica a los bots por IP, así que un user agent falso
// daría bloqueos que no existen para el bot real. Solo se mira lo que ve un cliente honesto.
import { pedir } from './http.mjs';

/** Extrae las líneas Content-Signal de robots.txt → [{ grupo, señales: {search:'yes',…} }] */
export function contentSignals(robotsTexto = '') {
  const out = [];
  let grupo = '*';
  for (const bruta of robotsTexto.split(/\r?\n/)) {
    const linea = bruta.replace(/#.*$/, '').trim();
    const ua = linea.match(/^user-agent\s*:\s*(.+)$/i);
    if (ua) { grupo = ua[1].trim(); continue; }
    const cs = linea.match(/^content-signal\s*:\s*(.+)$/i);
    if (!cs) continue;
    const señales = {};
    for (const par of cs[1].split(',')) {
      const [k, v] = par.split('=').map((s) => s?.trim().toLowerCase());
      if (k && v) señales[k] = v;
    }
    out.push({ grupo, linea: linea, señales });
  }
  return out;
}

export async function revisarCloudflare(url, robotsTexto) {
  const normal = await pedir(url);
  const h = normal.headers;
  const detras = !!h['cf-ray'] || /cloudflare/i.test(h.server || '');
  const desafio = h['cf-mitigated'] === 'challenge' || ([403, 503].includes(normal.status) && /cf-chl|just a moment|challenge-platform/i.test(normal.cuerpo));

  const md = await pedir(url, { headers: { accept: 'text/markdown, text/html;q=0.9' } });
  const ctMd = md.headers['content-type'] || '';
  const markdown = {
    ok: md.ok && /text\/markdown/i.test(ctMd),
    contentType: ctMd || null,
    tokens: md.headers['x-markdown-tokens'] ? Number(md.headers['x-markdown-tokens']) : null,
    vary: md.headers.vary || null,
    extracto: /text\/markdown/i.test(ctMd) ? md.cuerpo.slice(0, 300) : null,
  };
  const tokensHtml = normal.cuerpo ? Math.round(normal.cuerpo.length / 4) : null; // estimación: ~4 caracteres por token
  const signals = contentSignals(robotsTexto);
  const cabeceraSignal = md.headers['content-signal'] || h['content-signal'] || null;

  // Acciones recomendadas (estado: ok · falta · aviso)
  const acciones = [];
  if (desafio) acciones.push({ estado: 'aviso', titulo: 'Cloudflare pone un desafío a los visitantes automáticos', detalle: `La portada devuelve un desafío (HTTP ${normal.status}) a un cliente honesto. Si el modo de bots está en "Block" o "Under Attack", los asistentes de IA pueden quedarse fuera.`, como: 'En Cloudflare → Seguridad → Bots: deja los crawlers de Search y Agent en Allow y revisa el Bot Fight Mode.' });

  if (markdown.ok) acciones.push({ estado: 'ok', titulo: 'Sirve Markdown a los agentes', detalle: `Responde ${markdown.contentType}${markdown.tokens ? ` (~${markdown.tokens} tokens frente a ~${tokensHtml} del HTML)` : ''}. Es lo que exige el nivel 3 (Agent-Readable).`, como: '—' });
  else if (detras) acciones.push({ estado: 'falta', titulo: 'Activar Markdown for Agents en Cloudflare', detalle: 'La web ya está en Cloudflare pero responde HTML cuando un agente pide Markdown. Es el muro del nivel 3 y aquí se salta con un ajuste.', como: 'Panel de Cloudflare del dominio → activar Markdown for Agents (comprueba que tu plan lo incluye). Luego vuelve a auditar.' });
  else acciones.push({ estado: 'falta', titulo: 'La web no está en Cloudflare ni sirve Markdown', detalle: 'Sin negociación de contenido en Markdown no se pasa del nivel 2 del escáner de agentes.', como: 'Opción rápida: poner el dominio en Cloudflare (plan gratis) y activar Markdown for Agents. Opción manual: que el servidor devuelva Markdown ante Accept: text/markdown.' });

  if (!signals.length && !cabeceraSignal) acciones.push({ estado: 'falta', titulo: 'No declara Content Signals', detalle: 'Las Content Signals dicen en robots.txt para qué se puede usar el contenido: buscar, responder (ai-input) o entrenar.', como: 'Añadir en robots.txt, dentro de User-agent: *  →  Content-Signal: search=yes, ai-input=yes (ai-train lo decide el cliente).' });
  else {
    const todas = Object.assign({}, ...signals.map((s) => s.señales));
    const malas = ['search', 'ai-input'].filter((k) => todas[k] === 'no');
    if (malas.length) acciones.push({ estado: 'aviso', titulo: `Content Signals prohíben ${malas.join(' y ')}`, detalle: 'Pides a los sistemas de IA que no usen tu contenido para buscar o responder: contradice el objetivo de que te citen.', como: `Cambiar a ${malas.map((k) => `${k}=yes`).join(', ')}.`, evidencia: signals.map((s) => s.linea).join(' | ') });
    else acciones.push({ estado: 'ok', titulo: 'Declara Content Signals', detalle: signals.map((s) => s.linea).join(' · ') || `cabecera: ${cabeceraSignal}`, como: '—' });
  }

  if (detras) acciones.push({ estado: 'aviso', titulo: 'Revisar los controles de crawlers de IA en Cloudflare', detalle: 'Desde fuera no se puede ver cómo están los controles Search, Agent y Training del panel. En dominios nuevos, Training y Agent vienen bloqueados por defecto en páginas con anuncios.', como: 'Cloudflare → AI Crawl Control: Search = Allow, Agent = Allow, Training = lo que decida el cliente (bloquearlo no quita citas).' });

  return { detras, cfRay: h['cf-ray'] || null, server: h.server || null, statusPortada: normal.status, desafio, markdown, tokensHtmlEstimados: tokensHtml, contentSignals: signals, cabeceraContentSignal: cabeceraSignal, acciones };
}
