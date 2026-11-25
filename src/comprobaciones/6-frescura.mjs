import { nuevoEje, paginasOk, portada } from './_eje.mjs';

export async function evaluar({ rastreo }) {
  const e = nuevoEje('frescura');
  const pags = paginasOk(rastreo);
  const home = portada(rastreo);
  if (!home) return e.cerrar();
  const anio = new Date().getFullYear();

  const fechasJ = pags.flatMap((p) => p.A.fechasJsonLd);
  const fechasM = pags.flatMap((p) => [...p.A.fechasMeta, ...p.A.tiempos]);
  const lastMod = pags.map((p) => p.cabeceras['last-modified']).filter(Boolean);
  const lastmods = rastreo.sitemap.lastmods;
  const fechas = [...fechasJ, ...fechasM, ...lastmods, ...lastMod].map((f) => new Date(f)).filter((d) => !isNaN(d));
  const masReciente = fechas.length ? new Date(Math.max(...fechas)) : null;
  const dias = masReciente ? Math.round((Date.now() - masReciente) / 864e5) : null;

  e.datos = Object.assign(e.datos, { masReciente: masReciente?.toISOString().slice(0, 10) || null, dias, anioCopyright: home.A.anioCopyright });
  e.check('Fechas en datos estructurados (dateModified/datePublished)', 30, fechasJ.length > 0);
  e.check('Fechas visibles o en meta (<time>, article:*)', 20, fechasM.length > 0);
  e.check('lastmod en el sitemap', 20, lastmods.length > 0);
  e.check('Actualizada en el último año', 20, dias !== null && dias <= 365);
  e.check('Año del pie al día', 10, !home.A.anioCopyright || Number(home.A.anioCopyright) >= anio - 1);

  if (!fechas.length) e.hallazgo({ severidad: 'medio', titulo: 'La IA no puede saber si tu información está al día', detalle: 'Ninguna fecha en la web, el sitemap ni las cabeceras. Ante dos fuentes, los asistentes prefieren la que pueden fechar.', evidencia: { url: home.url, fragmento: 'sin dateModified, <time>, lastmod ni Last-Modified' }, esfuerzo: '30 minutos', arreglo: 'Añadir dateModified al JSON-LD y lastmod al sitemap.' });
  else if (dias > 365) e.hallazgo({ severidad: 'medio', titulo: `La última fecha que ve la IA es de hace ${dias} días`, detalle: 'Parece una web abandonada.', evidencia: { url: home.url, fragmento: `fecha más reciente: ${e.datos.masReciente}` }, esfuerzo: '1 hora', arreglo: 'Actualizar contenidos clave y sus fechas.' });
  if (home.A.anioCopyright && Number(home.A.anioCopyright) < anio - 1) e.hallazgo({ severidad: 'bajo', titulo: `El pie de la web dice © ${home.A.anioCopyright}`, detalle: 'Señal de web abandonada para personas y para la IA.', evidencia: { url: home.url, fragmento: `© ${home.A.anioCopyright}` }, esfuerzo: '5 minutos', arreglo: 'Actualizar el año (o generarlo automáticamente).' });
  return e.cerrar();
}
