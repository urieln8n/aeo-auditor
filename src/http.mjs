// Peticiones educadas: user agent honesto, 1 petición por segundo (o el Crawl-delay), timeout.
export const UA_AUDITOR = 'AndresAIStudio-AEO-Auditor/1.0 (+https://andresrendon.com)';

let ultima = 0;
let intervaloMs = 1000;
export const fijarIntervalo = (ms) => { intervaloMs = Math.max(ms, 0); };

async function turno() {
  const espera = ultima + intervaloMs - Date.now();
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultima = Date.now();
}

export async function pedir(url, { ua = UA_AUDITOR, headers = {}, metodo = 'GET', timeout = 20000 } = {}) {
  await turno();
  const t0 = performance.now();
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(url, { method: metodo, headers: { 'user-agent': ua, accept: 'text/html,application/xhtml+xml,*/*;q=0.8', ...headers }, redirect: 'follow', signal: ctl.signal });
    const ttfb = Math.round(performance.now() - t0);
    const cuerpo = await res.text();
    return {
      url, urlFinal: res.url, status: res.status, ok: res.ok, redirigida: res.redirected,
      headers: Object.fromEntries(res.headers.entries()),
      cuerpo, bytes: new TextEncoder().encode(cuerpo).length, ttfb, totalMs: Math.round(performance.now() - t0),
    };
  } catch (e) {
    return { url, status: 0, ok: false, error: e.name === 'AbortError' ? 'timeout' : e.message, headers: {}, cuerpo: '', bytes: 0, ttfb: null };
  } finally { clearTimeout(tm); }
}
