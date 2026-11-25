import { nuevoEje, paginasOk, portada } from './_eje.mjs';

export async function evaluar({ rastreo }) {
  const e = nuevoEje('render-sin-js');
  const pags = paginasOk(rastreo).filter((p) => p.delta);
  const home = portada(rastreo);
  if (!pags.length) {
    e.datos.sinRender = true;
    e.check('Contenido legible en crudo (sin render no se puede comparar)', 100, home ? Math.min(1, home.A.palabras / 300) : 0);
    return e.cerrar();
  }

  const media = Math.round(pags.reduce((s, p) => s + p.delta.perdidaPct, 0) / pags.length);
  const totalCrudo = pags.reduce((s, p) => s + p.delta.palabrasCrudo, 0);
  const totalRender = pags.reduce((s, p) => s + p.delta.palabrasRender, 0);
  e.datos.perdidaMedia = media;
  e.datos.perdidaGlobal = totalRender ? Math.max(0, Math.round((1 - totalCrudo / totalRender) * 100)) : 0;
  e.datos.paginas = pags.map((p) => ({ url: p.url, ...p.delta }));

  e.check('Texto visible sin JavaScript', 60, 1 - media / 100);
  e.check('Enlaces descubribles sin JavaScript', 25, home?.delta ? (home.delta.enlacesRender ? Math.min(1, home.delta.enlacesCrudo / home.delta.enlacesRender) : 1) : 1);
  e.check('Ninguna página es una cáscara vacía', 15, 1 - pags.filter((p) => p.delta.cascaraVacia).length / pags.length);

  if (home?.delta && home.delta.enlacesCrudo === 0 && home.delta.enlacesRender > 0) {
    e.hallazgo({ severidad: 'critico', titulo: 'Sin JavaScript, la portada no tiene ni un enlace', detalle: `Una persona ve ${home.delta.enlacesRender} enlaces; un crawler de IA ve 0. No puede descubrir ninguna otra página de tu web.`, evidencia: { url: home.url, fragmento: `enlaces en crudo: 0 · renderizados: ${home.delta.enlacesRender}` }, esfuerzo: '1–3 días (SSR o HTML estático)', arreglo: 'Servir la navegación en el HTML inicial (SSR, prerender o HTML estático).' });
  }
  for (const p of pags.filter((x) => x.delta.perdidaPct >= 30).sort((a, b) => b.delta.perdidaPct - a.delta.perdidaPct).slice(0, 5)) {
    const d = p.delta;
    const falta = [...d.encabezadosSoloRender.slice(0, 4), ...(d.preciosFaltan.length ? [`precios: ${d.preciosFaltan.slice(0, 4).join(', ')}`] : [])];
    e.hallazgo({ severidad: d.perdidaPct >= 60 ? 'critico' : 'alto', titulo: `${d.perdidaPct}% del texto solo existe con JavaScript`, detalle: `La IA lee ${d.palabrasCrudo} palabras; una persona, ${d.palabrasRender}.${falta.length ? ' Lo que la IA no ve: ' + falta.join(' · ') : ''}`, evidencia: { url: p.url, fragmento: `crudo ${d.palabrasCrudo} / render ${d.palabrasRender} palabras` }, esfuerzo: d.perdidaPct >= 60 ? '1–3 días' : 'media jornada', arreglo: 'Pasar ese contenido al HTML inicial (SSR/prerender) en vez de cargarlo con JavaScript.' });
  }
  const preciosOcultos = pags.flatMap((p) => p.delta.preciosFaltan.map((x) => ({ url: p.url, x })));
  if (preciosOcultos.length && !e.cerrar().hallazgos.some((h) => h.titulo.includes('%'))) {
    e.hallazgo({ severidad: 'alto', titulo: 'Tus precios solo aparecen con JavaScript', detalle: 'Si alguien pregunta a la IA cuánto cuesta, no tiene el dato.', evidencia: { url: preciosOcultos[0].url, fragmento: preciosOcultos.slice(0, 5).map((p) => p.x).join(', ') }, esfuerzo: 'media jornada', arreglo: 'Poner los precios en el HTML inicial.' });
  }
  return e.cerrar();
}
