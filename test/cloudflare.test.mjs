import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { contentSignals, revisarCloudflare } from '../src/cloudflare.mjs';
import { fijarIntervalo } from '../src/http.mjs';

fijarIntervalo(0);

test('lee Content-Signal por grupo', () => {
  const s = contentSignals('User-agent: *\nContent-Signal: search=yes, ai-train=no\nAllow: /');
  assert.deepEqual(s[0].señales, { search: 'yes', 'ai-train': 'no' });
  assert.equal(s[0].grupo, '*');
});

function servidor(conMarkdown) {
  const srv = createServer((req, res) => {
    const quiereMd = /text\/markdown/.test(req.headers.accept || '');
    if (conMarkdown && quiereMd) { res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8', 'x-markdown-tokens': '120', 'cf-ray': 'abc-MAD', vary: 'accept' }); res.end('# Hola'); return; }
    res.writeHead(200, { 'content-type': 'text/html', 'cf-ray': 'abc-MAD', server: 'cloudflare' }); res.end('<html><body><h1>Hola</h1></body></html>');
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${srv.address().port}/`, srv })));
}

test('detecta Cloudflare con Markdown for Agents activo', async () => {
  const { url, srv } = await servidor(true);
  const r = await revisarCloudflare(url, 'User-agent: *\nContent-Signal: search=yes, ai-input=yes');
  srv.close();
  assert.equal(r.detras, true);
  assert.equal(r.markdown.ok, true);
  assert.equal(r.markdown.tokens, 120);
  assert.ok(r.acciones.some((a) => a.estado === 'ok' && /Markdown/.test(a.titulo)));
});

test('en Cloudflare sin Markdown → acción de activarlo; signals que prohíben search → aviso', async () => {
  const { url, srv } = await servidor(false);
  const r = await revisarCloudflare(url, 'User-agent: *\nContent-Signal: search=no, ai-train=no');
  srv.close();
  assert.equal(r.markdown.ok, false);
  assert.ok(r.acciones.some((a) => a.estado === 'falta' && /Activar Markdown/.test(a.titulo)));
  assert.ok(r.acciones.some((a) => a.estado === 'aviso' && /search/.test(a.titulo)));
});
