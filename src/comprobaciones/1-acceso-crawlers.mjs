import { readFileSync } from 'node:fs';
import { permitido, reglaQueDecide } from '../robots.mjs';
import { pedir } from '../http.mjs';
import { nuevoEje, portada } from './_eje.mjs';

const CRAWLERS = JSON.parse(readFileSync(new URL('../../reglas/crawlers-ia.json', import.meta.url)));

export async function evaluar({ rastreo, opciones }) {
  const e = nuevoEje('acceso-crawlers');
  const { robots, origen } = rastreo;
  const home = portada(rastreo);

  // robots.txt
  const existe = robots.status === 200 && robots.texto.length > 0;
  e.check('robots.txt publicado', 10, existe);
  if (!existe) e.hallazgo({ severidad: 'bajo', titulo: 'No hay robots.txt', detalle: 'Sin robots.txt todo está permitido, pero no puedes declarar tu sitemap ni dar instrucciones a los crawlers de IA.', evidencia: { url: `${origen}/robots.txt`, fragmento: `HTTP ${robots.status}` }, esfuerzo: '10 minutos', arreglo: 'Publicar robots.txt con la plantilla de plantillas/robots.txt.ejemplo.' });

  // Crawler por crawler
  const tabla = CRAWLERS.map((c) => ({ ...c, permitido: permitido(robots.analisis, c.ua, '/'), regla: reglaQueDecide(robots.analisis, c.ua, '/') }));
  e.datos.crawlers = tabla;
  const criticos = tabla.filter((c) => c.critico);
  const criticosOk = criticos.filter((c) => c.permitido);
  e.check('Crawlers de búsqueda y agente permitidos', 60, criticosOk.length / criticos.length);
  for (const c of criticos.filter((x) => !x.permitido)) {
    e.hallazgo({ severidad: 'critico', titulo: `${c.ua} (${c.empresa}) está bloqueado`, detalle: c.porque, evidencia: { url: `${origen}/robots.txt`, fragmento: c.regla ? `User-agent: ${c.regla.grupo} → ${c.regla.regla}` : 'bloqueado' }, esfuerzo: '10 minutos', arreglo: `Permitir ${c.ua} en robots.txt.` });
  }
  const entrenoBloq = tabla.filter((c) => !c.critico && c.categoria === 'training' && !c.permitido);
  if (entrenoBloq.length) e.datos.notaEntrenamiento = `Bloqueas ${entrenoBloq.map((c) => c.ua).join(', ')}: son de entrenamiento y no afectan a que te citen.`;

  // noindex
  const xrt = (home?.cabeceras['x-robots-tag'] || '').toLowerCase();
  const metaNo = home?.A.robotsMeta.includes('noindex');
  const noindex = xrt.includes('noindex') || metaNo;
  e.check('La portada no lleva noindex', 30, !noindex);
  if (noindex) e.hallazgo({ severidad: 'critico', titulo: 'La portada pide no ser indexada (noindex)', detalle: 'Ningún buscador ni asistente de IA la va a mostrar.', evidencia: { url: home.url, fragmento: xrt ? `X-Robots-Tag: ${xrt}` : `<meta name="robots" content="${home.A.robotsMeta}">` }, esfuerzo: '10 minutos', arreglo: 'Quitar noindex (salvo que sea una demo).' });

  // llms.txt: se genera porque cuesta cero, pero NO es crítico
  e.datos.llmsTxt = rastreo.llms.presente;
  if (!rastreo.llms.presente) e.hallazgo({ severidad: 'bajo', titulo: 'No hay llms.txt', detalle: 'Es opcional: Google no lo usa y la adopción es baja. Se añade porque cuesta cero.', evidencia: { url: `${origen}/llms.txt`, fragmento: `HTTP ${rastreo.llms.status}` }, esfuerzo: '15 minutos', arreglo: 'Generar llms.txt con plantillas/llms.txt.ejemplo.' });

  // Simulación de bots (solo con autorización escrita del cliente)
  if (opciones.simularBots && home) {
    const pruebas = [];
    for (const ua of ['OAI-SearchBot', 'PerplexityBot', 'ClaudeBot']) {
      const r = await pedir(home.url, { ua: `Mozilla/5.0 (compatible; ${ua}/1.0)` });
      pruebas.push({ ua, status: r.status });
      if (r.status !== home.status) e.hallazgo({ severidad: 'critico', titulo: `El servidor responde distinto a ${ua}`, detalle: 'Un cortafuegos o CDN filtra a los bots de IA aunque robots.txt los permita.', evidencia: { url: home.url, fragmento: `navegador ${home.status} · ${ua} ${r.status}` }, esfuerzo: 'media jornada', arreglo: 'Revisar reglas de bots en Cloudflare/hosting.' });
    }
    e.datos.simulacion = pruebas;
  }
  return e.cerrar();
}
