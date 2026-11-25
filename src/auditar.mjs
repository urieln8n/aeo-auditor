#!/usr/bin/env node
// Orquestador: npm run auditar -- https://cliente.com --cliente nombre
//                npm run auditar -- ./clientes/nombre/web --cliente nombre   (audita una carpeta local)
import { existsSync, mkdirSync, writeFileSync, copyFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { rastrear } from './rastreador.mjs';
import { servirCarpeta } from './servidor-local.mjs';
import { puntuar, PESOS } from './puntuacion.mjs';
import { paginasNoindex } from './comprobaciones/_eje.mjs';
import { agentReadiness } from './agent-readiness.mjs';
import { revisarCloudflare } from './cloudflare.mjs';
import { generarInformes } from './informe.mjs';

const EJES = ['1-acceso-crawlers', '2-render-sin-js', '3-datos-estructurados', '4-estructura-respondible', '5-entidad-marca', '6-frescura', '7-indexacion', '8-acceso-tecnico'];
const RAIZ = resolve(new URL('..', import.meta.url).pathname);

function args(argv) {
  const o = { max: 25, render: true, agente: true, simularBots: false, verbose: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--cliente') o.cliente = argv[++i];
    else if (a === '--max') o.max = Number(argv[++i]) || 25;
    else if (a === '--sin-render') o.render = false;
    else if (a === '--sin-agente') o.agente = false;
    else if (a === '--simular-bots') o.simularBots = true;
    else if (a === '--verbose') o.verbose = true;
    else if (!a.startsWith('--')) o.objetivo = a;
  }
  return o;
}

/** Nunca sobrescribe: si ya hay auditoría hoy, añade -2, -3… (la comparación antes/después es lo que se cobra). */
function rutaLibre(dir, base, ext) {
  let n = 1, p;
  do { p = join(dir, `${base}${n === 1 ? '' : '-' + n}.${ext}`); n++; } while (existsSync(p));
  return p;
}

const o = args(process.argv.slice(2));
if (!o.objetivo) {
  console.log('Uso: npm run auditar -- <url | carpeta> [--cliente nombre] [--max 25] [--sin-render] [--sin-agente] [--simular-bots] [--verbose]');
  process.exit(1);
}

let url = o.objetivo, local = false, servidor = null;
if (!/^https?:\/\//.test(o.objetivo)) {
  if (existsSync(o.objetivo) && statSync(o.objetivo).isDirectory()) {
    servidor = await servirCarpeta(o.objetivo);
    url = servidor.url; local = true;
  } else url = 'https://' + o.objetivo;
}
const cliente = (o.cliente || (local ? resolve(o.objetivo).split(/[\\/]/).filter(Boolean).slice(-2, -1)[0] || 'local' : new URL(url).hostname.replace(/^www\./, ''))).toLowerCase().replace(/[^a-z0-9.-]+/g, '-');

if (o.simularBots) console.log('⚠️  --simular-bots: úsalo SOLO con autorización escrita del cliente y anótalo en su ficha.');
console.log(`\nAuditando ${local ? o.objetivo + ' (local)' : url} · cliente: ${cliente}`);

try {
  const rastreo = await rastrear(url, { max: o.max, render: o.render, verbose: o.verbose });
  if (!rastreo.paginas.some((p) => p.A)) throw new Error(`No se pudo leer ninguna página (${rastreo.paginas[0]?.error || 'sin respuesta'})`);
  console.log(`  ${rastreo.paginas.length} páginas rastreadas`);

  const ejes = [];
  for (const nombre of EJES) {
    const mod = await import(`./comprobaciones/${nombre}.mjs`);
    ejes.push(await mod.evaluar({ rastreo, opciones: o }));
  }
  const p = puntuar(ejes);

  let ar = null, cf = null;
  if (o.agente) {
    console.log('  revisando capa de agentes (Cloudflare, Markdown, Content Signals)…');
    cf = await revisarCloudflare(rastreo.paginas.find((pg) => pg.A)?.url || url, rastreo.robots.texto);
    if (!local) { console.log('  consultando isitagentready.com…'); ar = await agentReadiness(url, rastreo.robots); }
  }

  const fecha = new Date().toISOString().slice(0, 10);
  const auditoria = {
    version: 1, fecha, generado: new Date().toISOString(), cliente, url: local ? o.objetivo : url, local,
    opciones: { max: o.max, render: o.render, simularBots: o.simularBots },
    nota: p.global, banda: p.banda, conteo: p.conteo,
    ejes: ejes.map((e) => ({ ...e, peso: PESOS[e.id].peso })),
    hallazgos: p.hallazgos,
    paginasExcluidasNoindex: paginasNoindex(rastreo),
    rastreo: { ...rastreo, paginas: rastreo.paginas.map((pg) => (pg.A ? { ...pg, A: { ...pg.A, jsonld: undefined }, B: pg.B ? { ...pg.B, jsonld: undefined, enlaces: pg.B.enlaces.length } : null } : pg)) },
    cloudflare: cf,
    agentReadiness: ar,
    citas: null, // fase 2
  };

  const dirC = join(RAIZ, 'clientes', cliente);
  for (const d of ['datos', 'informes', 'entregables', 'web']) mkdirSync(join(dirC, d), { recursive: true });
  if (!existsSync(join(dirC, 'ficha.md'))) copyFileSync(join(RAIZ, 'plantillas', 'ficha-cliente.md'), join(dirC, 'ficha.md'));
  const rutaJson = rutaLibre(join(dirC, 'datos'), `auditoria-${fecha}`, 'json');
  writeFileSync(rutaJson, JSON.stringify(auditoria, null, 2));
  const { md, html } = generarInformes(rutaJson);

  console.log(`\n  Nota global: ${p.global}/100 (${p.banda})`);
  for (const e of ejes) console.log(`   ${String(e.nota ?? '—').padStart(3)}  ${PESOS[e.id].nombre}`);
  if (cf) console.log(`  Capa de agentes: ${cf.detras ? 'en Cloudflare' : 'sin Cloudflare'} · Markdown ${cf.markdown.ok ? 'sí' : 'no'} · Content Signals ${cf.contentSignals.length ? 'sí' : 'no'}`);
  console.log(`  Hallazgos: ${p.conteo.critico} críticos · ${p.conteo.alto} altos · ${p.conteo.medio} medios · ${p.conteo.bajo} bajos`);
  console.log(`\n  JSON:    ${rutaJson}\n  Interno: ${md}\n  Cliente: ${html}\n`);
} finally {
  servidor?.cerrar();
}
