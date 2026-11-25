import { nuevoEje, paginasOk, portada } from './_eje.mjs';

export async function evaluar({ rastreo }) {
  const e = nuevoEje('indexacion');
  const pags = paginasOk(rastreo);
  const home = portada(rastreo);
  if (!home) return e.cerrar();
  const frac = (f) => pags.filter(f).length / pags.length;

  const titulosBuenos = frac((p) => p.A.titulo.length >= 15 && p.A.titulo.length <= 65);
  const titulos = pags.map((p) => p.A.titulo);
  const duplicados = titulos.length - new Set(titulos).size;
  const desc = frac((p) => (p.A.descripcion || '').length >= 50);
  const canon = frac((p) => !!p.A.canonical);
  const sitemapEnRobots = rastreo.robots.analisis.sitemaps.length > 0;

  e.check('Títulos con longitud útil', 20, titulosBuenos);
  e.check('Títulos únicos', 10, duplicados === 0);
  e.check('Meta description', 20, desc);
  e.check('Canonical', 15, canon);
  e.check('Idioma declarado (lang)', 10, !!home.A.lang);
  e.check('Sitemap encontrado', 15, rastreo.sitemap.encontrado);
  e.check('Sitemap declarado en robots.txt', 10, sitemapEnRobots);

  if (!rastreo.sitemap.encontrado) e.hallazgo({ severidad: 'medio', titulo: 'No hay sitemap', detalle: 'Es el mapa que usan los crawlers para encontrar todas tus páginas.', evidencia: { url: rastreo.sitemap.fuentes[0], fragmento: 'no responde con un sitemap válido' }, esfuerzo: '20 minutos', arreglo: 'Publicar sitemap.xml y declararlo en robots.txt.' });
  if (desc < 1) { const p = pags.find((x) => (x.A.descripcion || '').length < 50); e.hallazgo({ severidad: 'bajo', titulo: `${Math.round((1 - desc) * pags.length)} página(s) sin meta description útil`, detalle: 'Es el resumen que muchos sistemas usan para describir la página.', evidencia: { url: p.url, fragmento: p.A.descripcion ? `"${p.A.descripcion}"` : 'sin meta description' }, esfuerzo: '10 minutos por página', arreglo: 'Escribir una descripción de 120–155 caracteres por página.' }); }
  if (duplicados) e.hallazgo({ severidad: 'bajo', titulo: `${duplicados} título(s) repetidos`, detalle: 'Páginas distintas con el mismo título confunden a buscadores e IA.', evidencia: { url: home.url, fragmento: `"${titulos.find((t, i) => titulos.indexOf(t) !== i)}"` }, esfuerzo: '10 minutos por página', arreglo: 'Un título único por página.' });
  if (!home.A.lang) e.hallazgo({ severidad: 'bajo', titulo: 'La web no declara su idioma', detalle: 'Ayuda a responder en el idioma correcto.', evidencia: { url: home.url, fragmento: '<html> sin lang' }, esfuerzo: '2 minutos', arreglo: '<html lang="es">' });
  return e.cerrar();
}
