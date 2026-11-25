// Doble pasada: A = fetch puro sin JavaScript (lo que ve GPTBot) · B = Playwright con render (lo que ve una persona).
import { XMLParser } from 'fast-xml-parser';
import { pedir, fijarIntervalo, UA_AUDITOR } from './http.mjs';
import { analizarRobots, grupoPara, permitido } from './robots.mjs';
import { extraer } from './extraer.mjs';

const xml = new XMLParser({ ignoreAttributes: true });
const esHtml = (u) => !/\.(pdf|jpe?g|png|gif|webp|svg|zip|mp4|mp3|css|js|xml|ico|woff2?)(\?|$)/i.test(u);

async function leerSitemap(url, profundidad = 0, out = []) {
  if (profundidad > 2) return out;
  const r = await pedir(url, { headers: { accept: 'application/xml,text/xml,*/*' } });
  if (!r.ok || !/<(urlset|sitemapindex)/i.test(r.cuerpo)) return out;
  const doc = xml.parse(r.cuerpo);
  const lista = (x) => (x ? (Array.isArray(x) ? x : [x]) : []);
  if (doc.sitemapindex) for (const s of lista(doc.sitemapindex.sitemap)) await leerSitemap(s.loc, profundidad + 1, out);
  if (doc.urlset) for (const u of lista(doc.urlset.url)) out.push({ loc: String(u.loc).trim(), lastmod: u.lastmod || null });
  return out;
}

function comparar(a, b) {
  if (!b) return null;
  const textosA = new Set(a.encabezados.map((e) => e.texto.toLowerCase()));
  const preciosA = new Set(a.precios);
  const perdida = b.palabras > 0 ? Math.max(0, Math.round((1 - a.palabras / b.palabras) * 100)) : 0;
  return {
    palabrasCrudo: a.palabras,
    palabrasRender: b.palabras,
    perdidaPct: perdida,
    encabezadosSoloRender: b.encabezados.filter((e) => !textosA.has(e.texto.toLowerCase())).map((e) => `H${e.nivel}: ${e.texto}`).slice(0, 15),
    preciosFaltan: b.precios.filter((p) => !preciosA.has(p)),
    enlacesCrudo: a.enlaces.length,
    enlacesRender: b.enlaces.length,
    jsonldSoloRender: b.tipos.filter((t) => !a.tipos.includes(t)),
    cascaraVacia: a.palabras < 50 && b.palabras >= 150,
  };
}

/**
 * @param {object} o
 * @param {() => Promise<any>} [o.abrirNavegador]  devuelve un navegador Playwright para la pasada B; sin él, solo pasada A
 *                                                (así el motor funciona también en Cloudflare Workers)
 */
export async function rastrear(urlInicio, { max = 25, abrirNavegador = null, verbose = false, intervaloMs = null } = {}) {
  if (intervaloMs != null) fijarIntervalo(intervaloMs);
  const log = (...m) => verbose && console.log('  ·', ...m);
  const inicio = new URL(urlInicio);
  const origen = inicio.origin;

  // robots.txt
  const rRobots = await pedir(`${origen}/robots.txt`, { headers: { accept: 'text/plain,*/*' } });
  const robotsTexto = rRobots.ok && !/<html/i.test(rRobots.cuerpo) ? rRobots.cuerpo : '';
  const robots = analizarRobots(robotsTexto);
  const delay = grupoPara(robots, UA_AUDITOR)?.crawlDelay;
  if (delay) fijarIntervalo(Math.min(delay, 10) * 1000);
  log(`robots.txt: ${rRobots.status}${delay ? ` · Crawl-delay ${delay}s` : ''}`);

  // sitemap
  const urlsSitemap = (robots.sitemaps.length ? robots.sitemaps : [`${origen}/sitemap.xml`]).map((s) => { try { return new URL(s, origen).href; } catch { return s; } });
  const sitemap = [];
  for (const s of urlsSitemap) await leerSitemap(s, 0, sitemap);
  // En local el robots.txt apunta al dominio real: probamos la misma ruta en el servidor local y llevamos las URLs al origen local
  if (!sitemap.length && /127\.0\.0\.1|localhost/.test(origen)) {
    for (const s of urlsSitemap) { try { await leerSitemap(origen + new URL(s).pathname, 0, sitemap); } catch {} }
    for (const s of sitemap) { try { const u = new URL(s.loc); s.loc = origen + u.pathname; } catch {} }
  }
  log(`sitemap: ${sitemap.length} URLs`);

  // llms.txt
  const rLlms = await pedir(`${origen}/llms.txt`, { headers: { accept: 'text/plain,*/*' } });
  const llms = rLlms.ok && !/<html/i.test(rLlms.cuerpo) ? rLlms.cuerpo.slice(0, 2000) : null;

  // Cola de páginas: portada → sitemap → enlaces descubiertos
  const cola = [inicio.href];
  for (const s of sitemap) if (s.loc.startsWith(origen) && esHtml(s.loc)) cola.push(s.loc);
  const vistas = new Set();
  const paginas = [];
  const navegador = abrirNavegador ? await abrirNavegador() : null;

  try {
    while (cola.length && paginas.length < max) {
      const url = cola.shift().replace(/#.*$/, '');
      if (vistas.has(url)) continue;
      vistas.add(url);
      if (!permitido(robots, UA_AUDITOR, new URL(url).pathname)) { log(`omitida por robots: ${url}`); continue; }

      const rA = await pedir(url);
      if (!rA.ok || !/text\/html/i.test(rA.headers['content-type'] || 'text/html')) { log(`${rA.status} ${url}`); if (paginas.length === 0) paginas.push({ url, status: rA.status, error: rA.error || `HTTP ${rA.status}` }); continue; }
      const A = extraer(rA.cuerpo, rA.urlFinal || url);

      let B = null;
      if (navegador) {
        const pg = await navegador.newPage({ userAgent: UA_AUDITOR });
        try {
          await pg.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
          B = extraer(await pg.content(), url);
        } catch (e) { log(`render falló en ${url}: ${e.message}`); }
        finally { await pg.close(); }
      }

      const delta = comparar(A, B);
      paginas.push({
        url, urlFinal: rA.urlFinal, status: rA.status, ttfb: rA.ttfb, bytes: rA.bytes, redirigida: rA.redirigida,
        cabeceras: {
          'content-encoding': rA.headers['content-encoding'] || null,
          'x-robots-tag': rA.headers['x-robots-tag'] || null,
          'last-modified': rA.headers['last-modified'] || null,
          'content-type': rA.headers['content-type'] || null,
        },
        A, B, delta,
      });
      log(`${rA.status} ${url} · crudo ${A.palabras} / render ${B?.palabras ?? '—'} palabras`);

      // Descubrimos con los enlaces del render si los hay: queremos auditar la web que ve la gente
      for (const e of (B?.enlaces?.length ? B.enlaces : A.enlaces)) if (!vistas.has(e) && esHtml(e)) cola.push(e);
    }
  } finally { if (navegador) await navegador.close(); }

  return {
    origen,
    robots: { status: rRobots.status, texto: robotsTexto, analisis: robots },
    sitemap: { urls: sitemap.length, lastmods: sitemap.filter((s) => s.lastmod).map((s) => s.lastmod).slice(0, 50), encontrado: sitemap.length > 0, fuentes: urlsSitemap },
    llms: { status: rLlms.status, presente: !!llms, extracto: llms },
    paginas,
    sitemapsLocalizados: /127\.0\.0\.1|localhost/.test(origen),
  };
}
