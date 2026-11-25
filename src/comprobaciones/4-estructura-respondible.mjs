import { nuevoEje, paginasOk } from './_eje.mjs';

// Se mide sobre el HTML crudo: es lo que el crawler puede trocear y citar.
export async function evaluar({ rastreo }) {
  const e = nuevoEje('estructura-respondible');
  const pags = paginasOk(rastreo);
  if (!pags.length) return e.cerrar();

  const unH1 = pags.filter((p) => p.A.h1 === 1).length / pags.length;
  const conH2 = pags.filter((p) => p.A.encabezados.some((h) => h.nivel === 2)).length / pags.length;
  const todos = pags.flatMap((p) => p.A.encabezados);
  const esPregunta = (t) => /\?$|^¿|^(qué|cómo|cuánto|cuándo|dónde|por qué|quién)/i.test(t);
  const preguntas = todos.filter((h) => esPregunta(h.texto)).length + pags.flatMap((p) => p.A.preguntasDesplegables || []).filter(esPregunta).length;
  const parrafos = pags.flatMap((p) => p.A.parrafos);
  const citables = parrafos.filter((n) => n >= 25 && n <= 120).length;
  const conListas = pags.filter((p) => p.A.listas >= 3 || p.A.tablas > 0).length / pags.length;

  e.datos = Object.assign(e.datos, { unH1, conH2, preguntas, parrafos: parrafos.length, citables });
  e.check('Un solo H1 por página', 20, unH1);
  e.check('Secciones con H2', 20, conH2);
  e.check('Encabezados en forma de pregunta', 20, Math.min(1, preguntas / 3));
  e.check('Párrafos citables (25–120 palabras)', 25, parrafos.length ? Math.min(1, citables / Math.max(3, parrafos.length * 0.4)) : 0);
  e.check('Listas o tablas', 15, conListas);

  const sinH1 = pags.filter((p) => p.A.h1 !== 1);
  if (sinH1.length) e.hallazgo({ severidad: 'medio', titulo: `${sinH1.length} página(s) sin un H1 claro`, detalle: 'El H1 le dice a la IA de qué va la página.', evidencia: { url: sinH1[0].url, fragmento: `${sinH1[0].A.h1} H1 en el HTML crudo` }, esfuerzo: '15 minutos por página', arreglo: 'Un H1 único y descriptivo por página.' });
  if (preguntas === 0) e.hallazgo({ severidad: 'medio', titulo: 'Ningún encabezado responde a una pregunta', detalle: 'La gente pregunta a la IA "¿cuánto cuesta…?", "¿dónde…?". Si tus encabezados son esas preguntas, la IA encuentra la respuesta justo debajo.', evidencia: { url: pags[0].url, fragmento: todos.slice(0, 4).map((h) => h.texto).join(' · ') || 'sin encabezados' }, esfuerzo: '1 hora', arreglo: 'Añadir una sección de preguntas frecuentes con respuestas de 40–80 palabras.' });
  if (parrafos.length && citables === 0) e.hallazgo({ severidad: 'medio', titulo: 'No hay párrafos que la IA pueda citar', detalle: 'Todo son frases sueltas o bloques enormes. Los asistentes citan párrafos de 40–80 palabras que responden algo completo.', evidencia: { url: pags[0].url, fragmento: `${parrafos.length} párrafos, 0 entre 25 y 120 palabras` }, esfuerzo: '2 horas', arreglo: 'Reescribir los textos clave en párrafos autosuficientes.' });
  return e.cerrar();
}
