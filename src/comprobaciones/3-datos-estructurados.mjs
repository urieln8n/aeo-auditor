import { nuevoEje, paginasOk, portada, recorte } from './_eje.mjs';

const NEGOCIO = /^(Organization|LocalBusiness|Corporation|Restaurant|Store|ProfessionalService|HealthAndBeautyBusiness|HairSalon|BeautySalon|AutoRepair|HomeAndConstructionBusiness|FoodEstablishment|Bakery|CafeOrCoffeeShop|LegalService|Dentist|MedicalBusiness|Hotel|SportsActivityLocation|.*Business)$/;

export async function evaluar({ rastreo }) {
  const e = nuevoEje('datos-estructurados');
  const pags = paginasOk(rastreo);
  const home = portada(rastreo);
  if (!home) return e.cerrar();

  const tiposCrudo = new Set(pags.flatMap((p) => p.A.tipos));
  const tiposRender = new Set(pags.flatMap((p) => p.B?.tipos || []));
  e.datos.tiposCrudo = [...tiposCrudo];
  e.datos.tiposSoloRender = [...tiposRender].filter((t) => !tiposCrudo.has(t));

  const conJsonld = pags.filter((p) => p.A.jsonld.length).length;
  e.check('Hay JSON-LD en el HTML crudo', 25, home.A.jsonld.length > 0);
  e.check('Identifica al negocio (Organization/LocalBusiness)', 30, [...tiposCrudo].some((t) => NEGOCIO.test(t)));
  e.check('Cobertura de páginas con JSON-LD', 15, pags.length ? conJsonld / pags.length : 0);

  const hayPrecios = pags.some((p) => (p.B || p.A).precios.length);
  const hayFaqTexto = pags.some((p) => (p.B || p.A).encabezados.some((h) => /preguntas|faq|dudas/i.test(h.texto)) || ((p.B || p.A).preguntasDesplegables || []).length >= 2);
  if (hayPrecios) e.check('Precios descritos como Offer/Product/Menu', 15, [...tiposCrudo].some((t) => /^(Offer|Product|Service|Menu|MenuItem|AggregateOffer|OfferCatalog)$/.test(t)));
  if (hayFaqTexto) e.check('Preguntas frecuentes marcadas como FAQPage', 10, tiposCrudo.has('FAQPage'));
  const errores = pags.flatMap((p) => p.A.jsonldErrores.map((x) => ({ url: p.url, x })));
  e.check('JSON-LD sin errores de sintaxis', 5, errores.length === 0);

  if (!home.A.jsonld.length) e.hallazgo({ severidad: 'alto', titulo: 'La IA no sabe qué es tu negocio: no hay datos estructurados', detalle: 'Sin JSON-LD, ChatGPT o Perplexity tienen que adivinar qué vendes, dónde estás y tu horario.', evidencia: { url: home.url, fragmento: '0 bloques application/ld+json en el HTML' }, esfuerzo: '1 hora', arreglo: 'Añadir LocalBusiness/Organization con plantillas/jsonld/ (datos sin verificar = PENDIENTE_CONFIRMAR).' });
  else if (![...tiposCrudo].some((t) => NEGOCIO.test(t))) e.hallazgo({ severidad: 'alto', titulo: 'Los datos estructurados no dicen quién eres', detalle: `Hay JSON-LD (${[...tiposCrudo].join(', ')}) pero ningún bloque Organization o LocalBusiness.`, evidencia: { url: home.url, fragmento: [...tiposCrudo].join(', ') }, esfuerzo: '1 hora', arreglo: 'Añadir LocalBusiness/Organization.' });
  if (e.datos.tiposSoloRender.length) e.hallazgo({ severidad: 'alto', titulo: 'Tus datos estructurados se inyectan con JavaScript', detalle: 'Los crawlers de IA no ejecutan JavaScript, así que no los ven.', evidencia: { url: home.url, fragmento: `solo tras render: ${e.datos.tiposSoloRender.join(', ')}` }, esfuerzo: '1 hora', arreglo: 'Mover el JSON-LD al HTML inicial.' });
  if (hayPrecios && ![...tiposCrudo].some((t) => /^(Offer|Product|Service|Menu|MenuItem|AggregateOffer|OfferCatalog)$/.test(t))) e.hallazgo({ severidad: 'medio', titulo: 'Tus precios no están descritos para la IA', detalle: 'Hay precios en la web pero no como Offer/Product/Menu: la IA los lee como texto suelto.', evidencia: { url: pags.find((p) => (p.B || p.A).precios.length).url, fragmento: (pags.find((p) => (p.B || p.A).precios.length).B || home.A).precios.slice(0, 4).join(', ') }, esfuerzo: '2 horas', arreglo: 'Marcar servicios/carta con Offer o Menu.' });
  if (hayFaqTexto && !tiposCrudo.has('FAQPage')) e.hallazgo({ severidad: 'medio', titulo: 'Tienes preguntas frecuentes pero no están marcadas', detalle: 'Un bloque FAQPage es de lo más fácil de citar para un asistente.', evidencia: { url: pags[0].url, fragmento: 'sección de preguntas sin FAQPage' }, esfuerzo: '30 minutos', arreglo: 'Añadir FAQPage con las mismas preguntas y respuestas visibles.' });
  for (const er of errores.slice(0, 2)) e.hallazgo({ severidad: 'medio', titulo: 'Un bloque JSON-LD tiene errores y se ignora', detalle: 'JSON mal formado: los buscadores lo descartan entero.', evidencia: { url: er.url, fragmento: recorte(er.x, 100) }, esfuerzo: '15 minutos', arreglo: 'Validar en validator.schema.org.' });
  return e.cerrar();
}
