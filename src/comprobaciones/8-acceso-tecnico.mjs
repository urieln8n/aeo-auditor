import { nuevoEje, paginasOk, portada } from './_eje.mjs';

export async function evaluar({ rastreo }) {
  const e = nuevoEje('acceso-tecnico');
  const pags = paginasOk(rastreo);
  const home = portada(rastreo);
  if (!home) return e.cerrar();

  const ttfbs = pags.map((p) => p.ttfb).filter((x) => x != null).sort((a, b) => a - b);
  const mediana = ttfbs[Math.floor(ttfbs.length / 2)] ?? null;
  const pesoMax = Math.max(...pags.map((p) => p.bytes));
  const https = rastreo.origen.startsWith('https://');
  const local = /localhost|127\.0\.0\.1/.test(rastreo.origen);
  const comprimida = !!home.cabeceras['content-encoding'];
  const erroresHttp = rastreo.paginas.filter((p) => !p.A).length;

  e.datos = Object.assign(e.datos, { ttfbMediana: mediana, pesoMaxKb: Math.round(pesoMax / 1024), https, comprimida, erroresHttp });
  e.check('Respuesta rápida (TTFB < 800 ms)', 35, mediana == null ? 0 : mediana <= 800 ? 1 : mediana <= 2000 ? 0.5 : 0);
  e.check('HTML ligero (< 500 KB)', 20, pesoMax <= 512000);
  e.check('HTTPS', 20, https || local);
  e.check('Compresión (gzip/br)', 10, comprimida || local);
  e.check('Sin errores HTTP en páginas enlazadas', 15, erroresHttp === 0);

  if (mediana > 2000) e.hallazgo({ severidad: 'medio', titulo: `Tu servidor tarda ${(mediana / 1000).toFixed(1)} s en responder`, detalle: 'Los crawlers de IA trabajan con tiempos cortos y abandonan las páginas lentas.', evidencia: { url: home.url, fragmento: `TTFB mediano ${mediana} ms` }, esfuerzo: 'media jornada', arreglo: 'Caché de página o CDN (Cloudflare).' });
  if (!https && !local) e.hallazgo({ severidad: 'alto', titulo: 'La web no usa HTTPS', detalle: 'Muchos sistemas desconfían o ni la visitan.', evidencia: { url: rastreo.origen, fragmento: 'http://' }, esfuerzo: '1 hora', arreglo: 'Activar certificado SSL.' });
  if (pesoMax > 512000) e.hallazgo({ severidad: 'bajo', titulo: `Una página pesa ${Math.round(pesoMax / 1024)} KB de HTML`, detalle: 'HTML muy pesado: algunos crawlers cortan antes de llegar al contenido.', evidencia: { url: pags.find((p) => p.bytes === pesoMax).url, fragmento: `${Math.round(pesoMax / 1024)} KB` }, esfuerzo: '2 horas', arreglo: 'Sacar scripts y estilos en línea a archivos aparte.' });
  if (erroresHttp) { const p = rastreo.paginas.find((x) => !x.A); e.hallazgo({ severidad: 'medio', titulo: `${erroresHttp} enlace(s) internos dan error`, detalle: 'Páginas rotas que el crawler encuentra y no puede leer.', evidencia: { url: p.url, fragmento: p.error }, esfuerzo: '30 minutos', arreglo: 'Corregir o redirigir esos enlaces.' }); }
  return e.cerrar();
}
