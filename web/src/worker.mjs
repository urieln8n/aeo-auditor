// Auditor AEO web (Cloudflare Worker).
// Hace la pasada A (lo que ve la IA, sin JavaScript) con el MISMO motor que el auditor del PC,
// enseña la nota y los 3 fallos principales, y capta el contacto para el informe completo (doble pasada).
import { rastrear } from '../../src/rastreador.mjs';
import { puntuar, PESOS } from '../../src/puntuacion.mjs';
import { revisarCloudflare } from '../../src/cloudflare.mjs';
import * as e1 from '../../src/comprobaciones/1-acceso-crawlers.mjs';
import * as e2 from '../../src/comprobaciones/2-render-sin-js.mjs';
import * as e3 from '../../src/comprobaciones/3-datos-estructurados.mjs';
import * as e4 from '../../src/comprobaciones/4-estructura-respondible.mjs';
import * as e5 from '../../src/comprobaciones/5-entidad-marca.mjs';
import * as e6 from '../../src/comprobaciones/6-frescura.mjs';
import * as e7 from '../../src/comprobaciones/7-indexacion.mjs';
import * as e8 from '../../src/comprobaciones/8-acceso-tecnico.mjs';

const EJES = [e1, e2, e3, e4, e5, e6, e7, e8];
const CABECERAS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
const json = (datos, status = 200) => new Response(JSON.stringify(datos), { status, headers: CABECERAS });
const error = (mensaje, status = 400) => json({ error: mensaje }, status);

async function sha256(texto) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Solo webs públicas: nada de IPs, localhost ni redes internas (salvo en desarrollo con ALLOW_LOCAL=1). */
function normalizarUrl(entrada, env) {
  let texto = String(entrada || '').trim();
  if (!texto) throw new Error('Escribe la dirección de tu web.');
  if (!/^https?:\/\//i.test(texto)) texto = 'https://' + texto;
  let u;
  try { u = new URL(texto); } catch { throw new Error('Esa dirección no parece una web. Prueba con algo como tunegocio.com'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Solo puedo revisar webs (http o https).');
  const host = u.hostname.toLowerCase();
  const local = host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')
    || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':') || !host.includes('.');
  if (local && env.ALLOW_LOCAL !== '1') throw new Error('Escribe el dominio público de tu web, por ejemplo tunegocio.com');
  if (u.username || u.password) throw new Error('La dirección no puede llevar usuario ni contraseña.');
  u.hash = '';
  return u;
}

async function auditar(request, env) {
  const cuerpo = await request.json().catch(() => ({}));
  let u;
  try { u = normalizarUrl(cuerpo.url, env); } catch (e) { return error(e.message); }
  const dominio = u.host.replace(/^www\./, '');
  const ip = request.headers.get('cf-connecting-ip') || 'desconocida';
  const ipHash = await sha256(`${env.SAL || 'cambia-esta-sal'}|${ip}`);
  const ahora = new Date();
  const horasCache = Number(env.HORAS_CACHE || 12);

  if (env.DB) {
    // Caché: el mismo dominio en las últimas horas → mismo resultado (ahorra peticiones a su web)
    const previa = await env.DB.prepare('SELECT id, resultado FROM auditorias WHERE dominio = ? AND creada > ? ORDER BY creada DESC LIMIT 1')
      .bind(dominio, new Date(ahora - horasCache * 36e5).toISOString()).first();
    if (previa?.resultado) return json({ ...JSON.parse(previa.resultado), id: previa.id, cache: true });
    // Límite por persona y día
    const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM auditorias WHERE ip_hash = ? AND creada > ?')
      .bind(ipHash, new Date(ahora - 864e5).toISOString()).first();
    if (n >= Number(env.LIMITE_DIA_IP || 10)) return error('Has llegado al límite de auditorías gratis de hoy. Escríbeme y te la hago yo.', 429);
  }

  let rastreo;
  try {
    rastreo = await rastrear(u.href, { max: Number(env.MAX_PAGINAS || 3), intervaloMs: 250 });
  } catch (e) { return error('No he podido leer esa web. ¿Está bien escrita la dirección?', 502); }
  const home = rastreo.paginas.find((p) => p.A);
  if (!home) return error(`No he podido abrir ${dominio} (${rastreo.paginas[0]?.error || 'sin respuesta'}). Comprueba la dirección.`, 502);

  const ejes = [];
  for (const m of EJES) ejes.push(await m.evaluar({ rastreo, opciones: {} }));
  const p = puntuar(ejes);
  let capa = null;
  try { capa = await revisarCloudflare(home.url, rastreo.robots.texto); } catch {}

  const crawlers = ejes[0].datos.crawlers || [];
  const resultado = {
    dominio, url: u.href, fecha: ahora.toISOString().slice(0, 10),
    nota: p.global, banda: p.banda, conteo: p.conteo,
    ejes: ejes.map((e) => ({ id: e.id, nombre: PESOS[e.id].nombre, pregunta: PESOS[e.id].pregunta, peso: PESOS[e.id].peso, nota: e.nota })),
    principales: p.hallazgos.slice(0, 3).map((h) => ({ severidad: h.severidad, titulo: h.titulo, detalle: h.detalle, esfuerzo: h.esfuerzo })),
    resto: p.hallazgos.slice(3).map((h) => ({ severidad: h.severidad, titulo: h.titulo })),
    // Lista completa para andresrendon.com/auditoria-aeo, que envía el informe entero por email
    hallazgos: p.hallazgos.map((h) => ({ eje: h.eje, severidad: h.severidad, titulo: h.titulo, detalle: h.detalle, esfuerzo: h.esfuerzo })),
    extra: { sitemap: rastreo.sitemap.encontrado, llmsTxt: rastreo.llms.presente, ttfb: home.ttfb ?? 0 },
    vistaIA: {
      palabras: home.A.palabras,
      enlaces: home.A.enlaces.length,
      datosEstructurados: home.A.tipos.slice(0, 6),
      crawlersBloqueados: crawlers.filter((c) => c.critico && !c.permitido).map((c) => c.ua),
      paginas: rastreo.paginas.filter((x) => x.A).length,
    },
    capaAgentes: capa && { cloudflare: capa.detras, markdown: capa.markdown.ok, contentSignals: capa.contentSignals.length > 0 || !!capa.cabeceraContentSignal },
  };

  const id = crypto.randomUUID();
  if (env.DB) {
    await env.DB.prepare('INSERT INTO auditorias (id, creada, dominio, url, ip_hash, nota, resultado) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, ahora.toISOString(), dominio, u.href, ipHash, p.global, JSON.stringify(resultado)).run();
  }
  return json({ ...resultado, id });
}

const RE_EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i;
const limpio = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

async function guardarLead(request, env) {
  const c = await request.json().catch(() => ({}));
  if (c.web) return json({ ok: true }); // campo trampa para bots
  const nombre = limpio(c.nombre, 80), email = limpio(c.email, 120).toLowerCase(), negocio = limpio(c.negocio, 120), telefono = limpio(c.telefono, 30);
  if (!nombre) return error('Dime tu nombre.');
  if (!RE_EMAIL.test(email)) return error('Ese email no parece correcto.');
  if (c.consentimiento !== true) return error('Necesito tu permiso para escribirte con el informe.');
  let url = null, nota = null, banda = null, problemas = [];
  if (env.DB && c.auditoriaId) {
    const a = await env.DB.prepare('SELECT url, nota, resultado FROM auditorias WHERE id = ?').bind(limpio(c.auditoriaId, 40)).first();
    if (a) {
      ({ url, nota } = a);
      try { const r = JSON.parse(a.resultado); banda = r.banda; problemas = r.principales.map((h) => h.titulo); } catch {}
    }
  }
  let enviado = 0;
  if (env.BREVO_API_KEY && env.BREVO_LISTA) {
    const r = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ email, listIds: [Number(env.BREVO_LISTA)], updateEnabled: true, attributes: Object.fromEntries(Object.entries({
        [env.BREVO_ATRIBUTO_NOMBRE || 'FIRSTNAME']: nombre,
        NEGOCIO: negocio, WEB: url, WA_NUMERO: telefono,
        NOTA_AEO: nota != null ? String(nota) : '', NIVEL_AEO: banda || '',
        PROBLEMA_1: problemas[0] || '', PROBLEMA_2: problemas[1] || '', PROBLEMA_3: problemas[2] || '',
        ORIGEN: 'auditoria.andresrendon.com',
      }).filter(([, v]) => v)) }),
    }).catch(() => null);
    enviado = r && (r.ok || r.status === 204) ? 1 : 0;
  }
  if (env.DB) {
    await env.DB.prepare('INSERT INTO leads (creado, auditoria_id, url, nota, nombre, email, negocio, telefono, consentimiento, enviado_brevo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)')
      .bind(new Date().toISOString(), c.auditoriaId || null, url, nota, nombre, email, negocio || null, telefono || null, enviado).run();
  }
  return json({ ok: true });
}

async function listarLeads(request, env) {
  const clave = new URL(request.url).searchParams.get('clave');
  if (!env.CLAVE_ADMIN || clave !== env.CLAVE_ADMIN) return error('No autorizado', 401);
  const { results } = await env.DB.prepare('SELECT creado, nombre, email, telefono, negocio, url, nota, enviado_brevo FROM leads ORDER BY creado DESC LIMIT 1000').all();
  const cols = ['creado', 'nombre', 'email', 'telefono', 'negocio', 'url', 'nota', 'enviado_brevo'];
  const csv = [cols.join(';'), ...results.map((r) => cols.map((k) => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(';'))].join('\n');
  return new Response('﻿' + csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="contactos-aeo.csv"', 'cache-control': 'no-store' } });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    try {
      if (pathname === '/api/auditar' && request.method === 'POST') return await auditar(request, env);
      if (pathname === '/api/lead' && request.method === 'POST') return await guardarLead(request, env);
      if (pathname === '/api/leads' && request.method === 'GET') return await listarLeads(request, env);
      if (pathname.startsWith('/api/')) return error('No encontrado', 404);
      // La cara pública del auditor es andresrendon.com/auditoria-aeo: este Worker es el motor
      if (env.REDIRIGIR_A) return Response.redirect(env.REDIRIGIR_A + new URL(request.url).search, 302);
      return env.ASSETS ? env.ASSETS.fetch(request) : new Response('No encontrado', { status: 404 });
    } catch (e) {
      console.error(e);
      return error('Algo ha fallado por mi parte. Prueba otra vez en un minuto.', 500);
    }
  },
};
