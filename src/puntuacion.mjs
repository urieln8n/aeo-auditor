import PESOS_JSON from '../reglas/pesos.json' with { type: 'json' };

export const PESOS = PESOS_JSON;
const ORDEN_SEV = { critico: 0, alto: 1, medio: 2, bajo: 3 };

export function banda(n) {
  if (n == null) return 'sin datos';
  if (n >= 85) return 'excelente';
  if (n >= 70) return 'bueno';
  if (n >= 50) return 'mejorable';
  return 'crítico';
}

/** Nota global ponderada. Un eje sin datos (null) no puntúa y su peso se reparte. */
export function puntuar(ejes) {
  let suma = 0, pesos = 0;
  for (const e of ejes) {
    if (e.nota == null) continue;
    const p = PESOS[e.id].peso;
    suma += e.nota * p; pesos += p;
  }
  const global = pesos ? Math.round(suma / pesos) : null;
  const hallazgos = ejes.flatMap((e) => e.hallazgos).sort((a, b) => ORDEN_SEV[a.severidad] - ORDEN_SEV[b.severidad] || PESOS[b.eje].peso - PESOS[a.eje].peso);
  return { global, banda: banda(global), hallazgos, conteo: Object.fromEntries(Object.keys(ORDEN_SEV).map((s) => [s, hallazgos.filter((h) => h.severidad === s).length])) };
}
