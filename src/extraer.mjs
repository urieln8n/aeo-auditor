// Extrae de un HTML todo lo que necesitan los ejes. Se usa igual en la pasada A (crudo) y la B (render).
import * as cheerio from 'cheerio/slim';

const RE_PRECIO = /(?:\d{1,3}(?:[.\s]\d{3})*|\d+)(?:,\d{1,2})?\s?€|€\s?\d+(?:[.,]\d{1,2})?/g;
const RE_TEL_ES = /(?:\+34[\s.-]?)?(?:[6789]\d{2})[\s.-]?\d{3}[\s.-]?\d{3}\b/g;

const limpiar = (s) => (s || '').replace(/\s+/g, ' ').trim();
const contarPalabras = (s) => (limpiar(s).match(/[\p{L}\p{N}]+/gu) || []).length;

function tiposJsonLd(nodo, out = []) {
  if (Array.isArray(nodo)) { nodo.forEach((n) => tiposJsonLd(n, out)); return out; }
  if (nodo && typeof nodo === 'object') {
    const t = nodo['@type'];
    if (t) (Array.isArray(t) ? t : [t]).forEach((x) => out.push(String(x)));
    if (nodo['@graph']) tiposJsonLd(nodo['@graph'], out);
    for (const v of Object.values(nodo)) if (v && typeof v === 'object') tiposJsonLd(v, out);
  }
  return out;
}

function buscarClave(nodo, clave, out = []) {
  if (Array.isArray(nodo)) nodo.forEach((n) => buscarClave(n, clave, out));
  else if (nodo && typeof nodo === 'object') {
    if (clave in nodo) out.push(nodo[clave]);
    Object.values(nodo).forEach((v) => buscarClave(v, clave, out));
  }
  return out;
}

export function extraer(html, urlBase) {
  const $ = cheerio.load(html || '');
  const origen = new URL(urlBase).origin;

  // JSON-LD (antes de quitar scripts)
  const jsonld = [];
  const jsonldErrores = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text();
    try { jsonld.push(JSON.parse(raw)); } catch { jsonldErrores.push(limpiar(raw).slice(0, 120)); }
  });
  const tipos = [...new Set(tiposJsonLd(jsonld))];

  const meta = (n) => $(`meta[name="${n}"]`).attr('content') || $(`meta[property="${n}"]`).attr('content') || null;

  const titulo = limpiar($('title').first().text());
  const descripcion = meta('description');
  const canonical = $('link[rel="canonical"]').attr('href') || null;
  const lang = $('html').attr('lang') || null;
  const robotsMeta = (meta('robots') || '').toLowerCase();

  // Enlaces
  const enlaces = new Set();
  const enlacesExternos = new Set();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href.startsWith('#') || /^(mailto|tel|javascript|whatsapp):/i.test(href)) return;
    try {
      const u = new URL(href, urlBase);
      u.hash = '';
      if (u.origin === origen) enlaces.add(u.href); else enlacesExternos.add(u.href);
    } catch {}
  });
  const tieneTel = $('a[href^="tel:"]').length > 0;
  const tieneEmail = $('a[href^="mailto:"]').length > 0;

  const tiempos = [];
  $('time[datetime]').each((_, el) => tiempos.push($(el).attr('datetime')));

  // Texto visible
  $('script,style,noscript,template,svg,iframe').remove();
  const body = $('body');
  const texto = limpiar(body.text());

  const encabezados = [];
  $('h1,h2,h3').each((_, el) => {
    const t = limpiar($(el).text());
    if (t) encabezados.push({ nivel: Number(el.tagName[1]), texto: t });
  });

  // Preguntas en desplegables (<details><summary>) o listas de definición (<dt>): también son pares pregunta-respuesta citables
  const preguntasDesplegables = [];
  $('summary, dt').each((_, el) => { const t = limpiar($(el).text()); if (t) preguntasDesplegables.push(t); });

  const parrafos = [];
  $('p').each((_, el) => { const n = contarPalabras($(el).text()); if (n) parrafos.push(n); });

  const precios = [...new Set((texto.match(RE_PRECIO) || []).map(limpiar))].slice(0, 30);
  const telefonos = [...new Set((texto.match(RE_TEL_ES) || []).map((t) => t.replace(/[\s.-]/g, '')))]
    .filter((t) => /^(\+34)?[6789]\d{8}$/.test(t)).slice(0, 5);

  const anioCopyright = (texto.match(/(?:©|copyright)\s*(\d{4})/i) || [])[1] || null;

  return {
    titulo, descripcion, canonical, lang, robotsMeta,
    palabras: contarPalabras(texto),
    muestra: texto.slice(0, 280),
    encabezados,
    preguntasDesplegables,
    h1: encabezados.filter((e) => e.nivel === 1).length,
    parrafos,
    listas: $('ul li, ol li').length,
    tablas: $('table').length,
    enlaces: [...enlaces],
    enlacesExternos: [...enlacesExternos],
    jsonld, jsonldErrores, tipos,
    sameAs: buscarClave(jsonld, 'sameAs').flat().filter(Boolean),
    fechasJsonLd: [...buscarClave(jsonld, 'dateModified'), ...buscarClave(jsonld, 'datePublished')].filter(Boolean),
    fechasMeta: ['article:modified_time', 'article:published_time', 'og:updated_time'].map(meta).filter(Boolean),
    tiempos,
    anioCopyright,
    precios, telefonos, tieneTel, tieneEmail,
  };
}
