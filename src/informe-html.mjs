// Entregable para el cliente: un solo archivo HTML autocontenido, sin peticiones externas, con la marca de marca.json.
import { readFileSync, existsSync } from 'node:fs';
import { PESOS } from './puntuacion.mjs';

const MARCA_NEUTRA = { nombre: 'Auditoría AEO', empresa: '', web: '', colores: { fondo: '#141414', acento: '#9a9a9a', texto: '#eeeeee' }, tipografias: { titulares: 'system-ui', cuerpo: 'system-ui' }, idioma: 'es-ES' };
export function cargarMarca() {
  const p = new URL('../marca.json', import.meta.url);
  try { return existsSync(p) ? { ...MARCA_NEUTRA, ...JSON.parse(readFileSync(p, 'utf8')) } : MARCA_NEUTRA; } catch { return MARCA_NEUTRA; }
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SEV = { critico: ['Crítico', '#ff4d4f'], alto: ['Alto', '#ff9f43'], medio: ['Medio', '#f5c542'], bajo: ['Bajo', '#8a94a0'] };
const colorNota = (n) => (n == null ? '#666' : n >= 85 ? '#2ecc71' : n >= 70 ? '#9ad14b' : n >= 50 ? '#f5c542' : '#ff4d4f');

// Markdown mínimo para el resumen que redacta Claude (párrafos, listas, negrita, títulos ##)
function md(texto) {
  const bloques = texto.trim().split(/\n{2,}/);
  return bloques.map((b) => {
    const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    if (/^##\s/.test(b)) return `<h3>${inline(b.replace(/^##+\s*/, ''))}</h3>`;
    if (/^[-*]\s/m.test(b)) return `<ul>${b.split('\n').filter((l) => /^[-*]\s/.test(l)).map((l) => `<li>${inline(l.replace(/^[-*]\s/, ''))}</li>`).join('')}</ul>`;
    return `<p>${inline(b).replace(/\n/g, '<br>')}</p>`;
  }).join('\n');
}

function anillo(n, color) {
  const r = 52, c = 2 * Math.PI * r, v = n == null ? 0 : n / 100;
  return `<svg viewBox="0 0 120 120" width="150" height="150" aria-label="Nota ${n}"><circle cx="60" cy="60" r="${r}" fill="none" stroke="rgba(127,127,127,.2)" stroke-width="10"/><circle cx="60" cy="60" r="${r}" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${c * v} ${c}" transform="rotate(-90 60 60)"/><text x="60" y="66" text-anchor="middle" font-size="30" font-weight="800" fill="currentColor">${n ?? '—'}</text></svg>`;
}

export function informeHtml(a, { resumen = null } = {}) {
  const m = cargarMarca();
  const { fondo, acento, texto } = m.colores;
  const render = a.ejes.find((e) => e.id === 'render-sin-js')?.datos || {};
  const crawl = a.ejes.find((e) => e.id === 'acceso-crawlers')?.datos || {};
  const dominio = a.local ? a.cliente : new URL(a.url).hostname;
  const crudo = render.paginas?.reduce((s, p) => s + p.palabrasCrudo, 0);
  const rend = render.paginas?.reduce((s, p) => s + p.palabrasRender, 0);

  const hallazgosHtml = a.hallazgos.map((h) => `
    <article class="hz" style="--s:${SEV[h.severidad][1]}">
      <div class="hz-top"><span class="sev">${SEV[h.severidad][0]}</span><span class="eje">${esc(PESOS[h.eje].nombre)}</span><span class="esf">⏱ ${esc(h.esfuerzo)}</span></div>
      <h3>${esc(h.titulo)}</h3>
      <p>${esc(h.detalle)}</p>
      <div class="ev"><span>Prueba</span><code>${esc(h.evidencia?.fragmento)}</code><a href="${esc(h.evidencia?.url)}">${esc(h.evidencia?.url)}</a></div>
      <p class="fix"><strong>Cómo se arregla:</strong> ${esc(h.arreglo)}</p>
    </article>`).join('');

  const ejesHtml = a.ejes.map((e) => `
    <div class="eje-row"><div class="eje-n"><strong>${esc(PESOS[e.id].nombre)}</strong><small>${esc(PESOS[e.id].pregunta)} · peso ${PESOS[e.id].peso}</small></div>
    <div class="bar"><i style="width:${e.nota ?? 0}%;background:${colorNota(e.nota)}"></i></div><b>${e.nota ?? '—'}</b></div>`).join('');

  const crawlersHtml = (crawl.crawlers || []).filter((c) => c.critico || !c.permitido).map((c) => `
    <tr><td><strong>${esc(c.ua)}</strong><br><small>${esc(c.empresa)}</small></td><td>${c.categoria === 'search' ? 'Búsqueda' : c.categoria === 'agent' ? 'Agente' : 'Entrenamiento'}</td><td class="${c.permitido ? 'ok' : c.critico ? 'ko' : 'meh'}">${c.permitido ? '✔ Puede entrar' : '✖ Bloqueado'}</td><td><small>${esc(c.porque)}</small></td></tr>`).join('');

  const paginasHtml = (render.paginas || []).map((p) => `
    <tr><td><a href="${esc(p.url)}">${esc(p.url.replace(/^https?:\/\/[^/]+/, '') || '/')}</a></td><td>${p.palabrasCrudo}</td><td>${p.palabrasRender}</td><td style="color:${p.perdidaPct >= 30 ? '#ff4d4f' : 'inherit'}">${p.perdidaPct}%</td><td>${p.enlacesCrudo} / ${p.enlacesRender}</td></tr>`).join('');

  const ar = a.agentReadiness;
  const anexo = !ar ? '' : `
    <section><h2>Anexo · Sello de Cloudflare</h2>
    <p class="muted">Escáner público y gratuito de isitagentready.com. Mide si la web habla los protocolos de agentes. No cuenta para tu nota: puedes comprobarlo tú mismo.</p>
    ${ar.error ? `<p class="muted">${esc(ar.error)}</p>` : `<p><strong>Nivel ${esc(ar.nivel)}: ${esc(ar.nivelNombre)}</strong> · ${ar.pasan}/${ar.puntuables} comprobaciones superadas</p>`}
    </section>`;

  const titular = render.perdidaGlobal >= 30
    ? `${render.perdidaGlobal}% de tu web no existe para la IA`
    : a.hallazgos.some((h) => h.severidad === 'critico') ? `${a.conteo.critico} bloqueo(s) crítico(s) impiden que la IA te lea`
    : `Tu web, vista por ChatGPT, Perplexity, Claude y Gemini`;

  return `<!DOCTYPE html>
<html lang="${esc((m.idioma || 'es-ES').slice(0, 2))}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(m.nombre)} · ${esc(dominio)}</title>
<style>
:root{--f:${fondo};--a:${acento};--t:${texto}}
*{box-sizing:border-box}body{margin:0;background:var(--f);color:var(--t);font-family:"${esc(m.tipografias.cuerpo)}",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.55;overflow-wrap:anywhere}
h1,h2,h3{font-family:"${esc(m.tipografias.titulares)}",system-ui,sans-serif;line-height:1.2}
.wrap{max-width:920px;margin:auto;padding:24px 18px 60px}
header.top{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:13px;opacity:.75;border-bottom:1px solid rgba(127,127,127,.25);padding-bottom:12px}
.hero{display:flex;gap:26px;align-items:center;flex-wrap:wrap;margin:28px 0 10px}.hero h1{font-size:clamp(26px,5vw,40px);margin:0 0 8px}
.hero .meta{opacity:.75}.badge{display:inline-block;padding:3px 10px;border-radius:99px;background:var(--a);color:#000;font-weight:700;font-size:13px;text-transform:uppercase}
section{margin-top:38px}h2{font-size:22px;border-left:4px solid var(--a);padding-left:10px}
.muted{opacity:.7;font-size:14px}
.ab{display:grid;grid-template-columns:1fr 1fr;gap:12px}.ab div{background:rgba(127,127,127,.1);border-radius:12px;padding:16px}.ab b{display:block;font-size:34px}
.eje-row{display:grid;grid-template-columns:minmax(150px,260px) 1fr 36px;gap:12px;align-items:center;margin:10px 0}.eje-n small{display:block;opacity:.65;font-size:12px}
.bar{height:10px;background:rgba(127,127,127,.2);border-radius:99px;overflow:hidden}.bar i{display:block;height:100%}
.hz{border:1px solid rgba(127,127,127,.25);border-left:5px solid var(--s);border-radius:12px;padding:14px 16px;margin:12px 0;background:rgba(127,127,127,.06)}
.hz h3{margin:6px 0;font-size:18px}.hz p{margin:6px 0}.hz-top{display:flex;gap:8px;flex-wrap:wrap;font-size:12px}
.sev{background:var(--s);color:#000;border-radius:6px;padding:1px 8px;font-weight:700}.eje,.esf{opacity:.7}
.ev{font-size:13px;background:rgba(0,0,0,.25);border-radius:8px;padding:8px 10px;margin:8px 0;display:grid;gap:3px}.ev span{opacity:.6;font-size:11px;text-transform:uppercase}.ev a{color:var(--a);font-size:12px}
code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px}
.fix{font-size:14px}.resumen{background:rgba(127,127,127,.1);border-radius:12px;padding:6px 18px}
.tabla{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:8px;border-bottom:1px solid rgba(127,127,127,.2);vertical-align:top}th{opacity:.7;font-weight:600}
td a{color:var(--a)}.ok{color:#2ecc71}.ko{color:#ff4d4f;font-weight:700}.meh{opacity:.7}
footer{margin-top:50px;font-size:13px;opacity:.7;border-top:1px solid rgba(127,127,127,.25);padding-top:14px}footer a{color:var(--a)}
@media(max-width:600px){.ab{grid-template-columns:1fr}.eje-row{grid-template-columns:1fr 36px}.eje-row .bar{grid-column:1/-1;grid-row:2}}
</style></head><body><div class="wrap">
<header class="top"><strong>${esc(m.empresa || m.nombre)}</strong><span>${esc(m.nombre)} · ${esc(a.fecha)}</span></header>

<div class="hero">${anillo(a.nota, colorNota(a.nota))}
<div><span class="badge">${esc(a.banda)}</span><h1>${esc(titular)}</h1><div class="meta">${esc(dominio)} · ${a.rastreo.paginas.length} páginas analizadas · ${a.conteo.critico} críticos, ${a.conteo.alto} altos, ${a.conteo.medio} medios</div></div></div>

${resumen ? `<section><h2>Resumen</h2><div class="resumen">${md(resumen)}</div></section>` : ''}

${crudo != null ? `<section><h2>Lo que ve la IA frente a lo que ve una persona</h2>
<p class="muted">Cada página se ha descargado dos veces: sin ejecutar JavaScript (así la leen los crawlers de ChatGPT, Perplexity o Claude) y con el navegador completo (así la ve una persona).</p>
<div class="ab"><div><small>La IA lee</small><b>${crudo.toLocaleString('es-ES')}</b><small>palabras</small></div><div><small>Una persona ve</small><b>${rend.toLocaleString('es-ES')}</b><small>palabras</small></div></div></section>` : ''}

<section><h2>Tu nota, eje por eje</h2>${ejesHtml}</section>

<section><h2>Qué falla, por orden de gravedad</h2>${hallazgosHtml || '<p>No hay hallazgos.</p>'}</section>

${crawlersHtml ? `<section><h2>¿Quién puede entrar en tu web?</h2>
<p class="muted">Bloquear un crawler de entrenamiento no te saca de las respuestas de IA. Los que importan son los de búsqueda y agente.</p>
<div class="tabla"><table><thead><tr><th>Crawler</th><th>Tipo</th><th>Estado</th><th>Por qué importa</th></tr></thead><tbody>${crawlersHtml}</tbody></table></div></section>` : ''}

${paginasHtml ? `<section><h2>Página por página</h2><div class="tabla"><table><thead><tr><th>Página</th><th>Palabras IA</th><th>Palabras persona</th><th>Pérdida</th><th>Enlaces IA / persona</th></tr></thead><tbody>${paginasHtml}</tbody></table></div></section>` : ''}

${anexo}

<footer>Nadie controla qué cita un modelo de IA: esta auditoría mide y mejora las <strong>condiciones</strong> para que tu web pueda ser leída y citada, no promete posiciones ni menciones.<br>
${esc(m.empresa)}${m.web ? ` · <a href="${esc(m.web)}">${esc(m.web.replace(/^https?:\/\//, ''))}</a>` : ''}${m.instagram ? ` · ${esc(m.instagram)}` : ''}</footer>
</div></body></html>`;
}
