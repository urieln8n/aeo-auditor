// FASE 2 — preparada, no construida.
// Medir si los modelos citan al cliente ante prompts reales. Un adaptador por proveedor con la misma firma.
// Empezar por Perplexity (cita marcas mucho más que ChatGPT).
// Estas métricas son ruidosas: ejecutar cada prompt varias veces y reportar FRECUENCIA, no sí/no.

/**
 * @typedef {Object} ResultadoCita
 * @property {string} proveedor     'perplexity' | 'openai' | 'anthropic' | 'google'
 * @property {string} prompt
 * @property {number} ejecuciones
 * @property {number} vecesCitado   ejecuciones en las que aparece el dominio del cliente
 * @property {string[]} fuentes     URLs citadas en todas las ejecuciones
 */

/**
 * @param {{ dominio: string, prompts: string[], ejecuciones?: number }} _opciones
 * @returns {Promise<ResultadoCita[]>}
 */
export async function medirCitas(_opciones) {
  throw new Error('Fase 2: medición de citas aún no implementada. El JSON de auditoría guarda citas: null.');
}
