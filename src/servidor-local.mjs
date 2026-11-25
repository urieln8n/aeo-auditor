// Sirve una carpeta por HTTP para auditarla en local (antes y después de arreglar una web).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';

const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

export function servirCarpeta(carpeta, puerto = 0) {
  const raiz = resolve(carpeta);
  const srv = createServer(async (req, res) => {
    try {
      let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let archivo = resolve(join(raiz, ruta));
      if (!archivo.startsWith(raiz)) { res.writeHead(403).end(); return; }
      const s = await stat(archivo).catch(() => null);
      if (s?.isDirectory()) archivo = join(archivo, 'index.html');
      else if (!s && !extname(archivo)) archivo += '.html';
      const datos = await readFile(archivo);
      res.writeHead(200, { 'content-type': TIPOS[extname(archivo).toLowerCase()] || 'application/octet-stream' }).end(datos);
    } catch { res.writeHead(404, { 'content-type': 'text/html' }).end('<h1>404</h1>'); }
  });
  return new Promise((ok) => srv.listen(puerto, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${srv.address().port}/`, cerrar: () => srv.close() })));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { url } = await servirCarpeta(process.argv[2] || '.', Number(process.argv[3]) || 8080);
  console.log(`Sirviendo ${process.argv[2] || '.'} en ${url}`);
}
