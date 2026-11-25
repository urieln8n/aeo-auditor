import { nuevoEje, paginasOk, portada } from './_eje.mjs';

const REDES = /(instagram|facebook|linkedin|tiktok|youtube|x\.com|twitter|google\.[a-z.]+\/maps|g\.page|maps\.app\.goo\.gl|tripadvisor|booksy|wikipedia|wikidata)/i;

export async function evaluar({ rastreo }) {
  const e = nuevoEje('entidad-marca');
  const pags = paginasOk(rastreo);
  const home = portada(rastreo);
  if (!home) return e.cerrar();

  const todosEnlaces = pags.flatMap((p) => p.A.enlaces);
  const externos = [...new Set(pags.flatMap((p) => p.A.enlacesExternos))];
  const sobre = todosEnlaces.find((u) => /(sobre|quienes|quiénes|nosotros|about|historia|equipo)/i.test(u));
  const legal = todosEnlaces.find((u) => /(aviso-?legal|legal|privacidad|privacy|terminos)/i.test(u));
  const redes = externos.filter((u) => REDES.test(u));
  const sameAs = [...new Set(pags.flatMap((p) => p.A.sameAs))];
  const contacto = pags.some((p) => p.A.tieneTel || p.A.tieneEmail || p.A.telefonos.length);

  e.datos = Object.assign(e.datos, { sobre, legal, redes, sameAs, telefonos: [...new Set(pags.flatMap((p) => p.A.telefonos))] });
  e.check('Página "quiénes somos" enlazada', 20, !!sobre);
  e.check('Aviso legal / privacidad', 15, !!legal);
  e.check('Contacto visible sin JavaScript', 20, contacto);
  e.check('Perfiles externos enlazados (redes, Google Maps…)', 20, Math.min(1, redes.length / 2));
  e.check('sameAs en datos estructurados', 25, Math.min(1, sameAs.length / 2));

  if (!sameAs.length) e.hallazgo({ severidad: 'medio', titulo: 'La IA no puede confirmar que tus perfiles son tuyos', detalle: 'Sin sameAs, ChatGPT no une tu web con tu Instagram, tu ficha de Google o tus reseñas: para él son entidades distintas.', evidencia: { url: home.url, fragmento: redes.length ? `enlazas ${redes.length} perfiles pero 0 en sameAs` : 'ningún perfil enlazado' }, esfuerzo: '20 minutos', arreglo: 'Añadir sameAs con los perfiles oficiales al JSON-LD del negocio.' });
  if (!contacto) e.hallazgo({ severidad: 'alto', titulo: 'Tu teléfono o email no aparecen en el HTML', detalle: 'Si la IA no ve cómo contactarte, no puede recomendarte como opción.', evidencia: { url: home.url, fragmento: 'sin tel:, mailto: ni teléfono legible' }, esfuerzo: '15 minutos', arreglo: 'Poner teléfono con enlace tel: y email visibles en el HTML.' });
  if (!sobre) e.hallazgo({ severidad: 'bajo', titulo: 'No hay página "quiénes somos"', detalle: 'Ayuda a la IA a saber quién está detrás y por qué fiarse.', evidencia: { url: home.url, fragmento: 'ningún enlace a sobre/nosotros/historia' }, esfuerzo: '1 hora', arreglo: 'Crear una página corta con historia, equipo y años de experiencia.' });
  if (!legal) e.hallazgo({ severidad: 'bajo', titulo: 'No hay aviso legal enlazado', detalle: 'Obligatorio en España (LSSI) y además da a la IA razón social y domicilio verificables.', evidencia: { url: home.url, fragmento: 'sin enlace a aviso legal ni privacidad' }, esfuerzo: '30 minutos', arreglo: 'Publicar aviso legal y privacidad.' });
  return e.cerrar();
}
