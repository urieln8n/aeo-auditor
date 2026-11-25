// Informe interno de trabajo (para Andrés y para Claude). Solo datos del JSON, sin prosa comercial.
import { PESOS } from './puntuacion.mjs';

const SEV = { critico: '🔴 Crítico', alto: '🟠 Alto', medio: '🟡 Medio', bajo: '⚪ Bajo' };

export function informeMd(a) {
  const r = [];
  r.push(`# Auditoría AEO · ${a.cliente}`, '', `- URL: ${a.url}${a.local ? ' (carpeta local)' : ''}`, `- Fecha: ${a.fecha}`, `- Páginas auditadas: ${a.rastreo.paginas.length}`, `- **Nota global: ${a.nota}/100 (${a.banda})**`, '');
  const rd = a.ejes.find((e) => e.id === 'render-sin-js')?.datos;
  if (rd?.perdidaGlobal != null) r.push(`- Pérdida sin JavaScript: **${rd.perdidaGlobal}%** del texto`, '');
  r.push('## Ejes', '', '| Eje | Peso | Nota |', '|---|---|---|');
  for (const e of a.ejes) r.push(`| ${PESOS[e.id].nombre} | ${PESOS[e.id].peso} | ${e.nota ?? 'sin datos'} |`);
  r.push('', `## Hallazgos (${a.hallazgos.length})`, '');
  for (const h of a.hallazgos) {
    r.push(`### ${SEV[h.severidad]} · ${h.titulo}`, '', h.detalle, '', `- Eje: ${PESOS[h.eje].nombre}`, `- Evidencia: ${h.evidencia?.url} → \`${h.evidencia?.fragmento}\``, `- Esfuerzo: ${h.esfuerzo}`, `- Arreglo: ${h.arreglo}`, '');
  }
  r.push('## Detalle por eje', '');
  for (const e of a.ejes) {
    r.push(`### ${PESOS[e.id].nombre} · ${e.nota ?? '—'}`, '');
    for (const c of e.checks) r.push(`- ${c.obtenidos >= c.puntos ? '✅' : c.obtenidos > 0 ? '🟨' : '❌'} ${c.nombre} (${c.obtenidos}/${c.puntos})`);
    r.push('');
  }
  if (a.agentReadiness) {
    r.push('## Anexo · isitagentready.com (no puntúa)', '');
    if (a.agentReadiness.error) r.push(`- ${a.agentReadiness.error}`);
    else r.push(`- Nivel ${a.agentReadiness.nivel}: ${a.agentReadiness.nivelNombre} · ${a.agentReadiness.pasan}/${a.agentReadiness.puntuables} comprobaciones`, a.agentReadiness.contrasteEje1?.discrepan ? '- ⚠️ Cloudflare y nuestro eje 1 discrepan sobre robots.txt: investigar antes de enseñar nada.' : '');
    r.push('');
  }
  r.push('---', 'Siguiente: Claude redacta `resumen.md` en esta carpeta (impacto de negocio, prioridades) y se regenera el HTML con `npm run informe`.');
  return r.join('\n');
}
