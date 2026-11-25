// Parseo y emparejado de robots.txt según RFC 9309.

/** Convierte el texto de robots.txt en { grupos: [{agentes, reglas, crawlDelay}], sitemaps } */
export function analizarRobots(texto = '') {
  const grupos = [];
  const sitemaps = [];
  let actual = null;
  let ultimaFueAgente = false;

  for (const bruta of texto.split(/\r?\n/)) {
    const linea = bruta.replace(/#.*$/, '').trim();
    if (!linea) continue;
    const i = linea.indexOf(':');
    if (i < 0) continue;
    const campo = linea.slice(0, i).trim().toLowerCase();
    const valor = linea.slice(i + 1).trim();

    if (campo === 'user-agent') {
      if (!actual || !ultimaFueAgente) {
        actual = { agentes: [], reglas: [], crawlDelay: null };
        grupos.push(actual);
      }
      actual.agentes.push(valor.toLowerCase());
      ultimaFueAgente = true;
      continue;
    }
    if (campo === 'sitemap') { sitemaps.push(valor); continue; }
    ultimaFueAgente = false;
    if (!actual) continue;
    if (campo === 'allow' || campo === 'disallow') actual.reglas.push({ tipo: campo, ruta: valor });
    else if (campo === 'crawl-delay') actual.crawlDelay = Number(valor) || null;
  }
  return { grupos, sitemaps };
}

/**
 * Devuelve el grupo que aplica a un user agent.
 * Gana el nombre de grupo que coincide de forma MÁS ESPECÍFICA (más largo); `*` es el comodín final.
 * El prefijo va en UNA sola dirección: el nombre del grupo puede ser prefijo del crawler
 * (`Google` captura a `Googlebot`), nunca al revés (`Applebot-Extended` NO captura a `Applebot`).
 */
export function grupoPara(analisis, ua) {
  const objetivo = ua.toLowerCase();
  let mejor = null;
  let largo = -1;
  let comodin = null;
  for (const g of analisis.grupos) {
    for (const agente of g.agentes) {
      if (agente === '*') { comodin ??= g; continue; }
      if (objetivo === agente || objetivo.startsWith(agente)) {
        if (agente.length > largo) { mejor = g; largo = agente.length; }
      }
    }
  }
  return mejor ?? comodin;
}

function patronARegex(ruta) {
  const fin = ruta.endsWith('$');
  const cuerpo = (fin ? ruta.slice(0, -1) : ruta)
    .replace(/[.+?^{}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp('^' + cuerpo + (fin ? '$' : ''));
}

/** ¿Puede `ua` acceder a `ruta`? Regla más larga gana; en empate gana allow. */
export function permitido(analisis, ua, ruta = '/') {
  const g = grupoPara(analisis, ua);
  if (!g) return true;
  let mejor = null;
  for (const r of g.reglas) {
    if (r.ruta === '') continue; // "Disallow:" vacío = permitir todo
    if (!patronARegex(r.ruta).test(ruta)) continue;
    const l = r.ruta.length;
    if (!mejor || l > mejor.l || (l === mejor.l && r.tipo === 'allow')) mejor = { l, tipo: r.tipo, ruta: r.ruta };
  }
  return !mejor || mejor.tipo === 'allow';
}

/** Regla concreta que decide, para enseñarla como evidencia. */
export function reglaQueDecide(analisis, ua, ruta = '/') {
  const g = grupoPara(analisis, ua);
  if (!g) return null;
  let mejor = null;
  for (const r of g.reglas) {
    if (r.ruta === '' || !patronARegex(r.ruta).test(ruta)) continue;
    if (!mejor || r.ruta.length > mejor.ruta.length || (r.ruta.length === mejor.ruta.length && r.tipo === 'allow')) mejor = r;
  }
  return mejor ? { grupo: g.agentes.join(', '), regla: `${mejor.tipo === 'allow' ? 'Allow' : 'Disallow'}: ${mejor.ruta}` } : null;
}
