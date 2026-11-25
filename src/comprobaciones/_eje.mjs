// Utilidad común: cada eje suma comprobaciones con puntos y produce hallazgos con evidencia.
export function nuevoEje(id) {
  const checks = [];
  const hallazgos = [];
  const datos = {};
  return {
    datos,
    /** valor: true/false o una fracción 0..1 */
    check(nombre, puntos, valor, detalle = null) {
      const f = typeof valor === 'number' ? Math.max(0, Math.min(1, valor)) : valor ? 1 : 0;
      checks.push({ nombre, puntos, obtenidos: Math.round(puntos * f * 10) / 10, detalle });
    },
    hallazgo(h) { hallazgos.push({ eje: id, ...h }); },
    cerrar() {
      const posibles = checks.reduce((s, c) => s + c.puntos, 0);
      const obtenidos = checks.reduce((s, c) => s + c.obtenidos, 0);
      return { id, nota: posibles ? Math.round((obtenidos / posibles) * 100) : null, checks, hallazgos, datos };
    },
  };
}

const esNoindex = (p) => p.A.robotsMeta.includes('noindex') || (p.cabeceras?.['x-robots-tag'] || '').toLowerCase().includes('noindex');
/** Páginas legibles que el negocio QUIERE que se indexen (las noindex, como un panel interno, no cuentan). La portada va siempre. */
export const paginasOk = (r) => r.paginas.filter((p, i) => p.A && (i === 0 || !esNoindex(p)));
export const paginasNoindex = (r) => r.paginas.filter((p, i) => p.A && i > 0 && esNoindex(p)).map((p) => p.url);
export const portada = (r) => r.paginas.find((p) => p.A);
export const recorte = (s, n = 140) => (s && s.length > n ? s.slice(0, n) + '…' : s);
