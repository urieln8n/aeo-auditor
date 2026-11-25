#!/usr/bin/env node
// Regenera los informes desde un JSON: npm run informe -- clientes/nombre/datos/auditoria-FECHA.json
// Si existe clientes/nombre/informes/resumen.md (lo redacta Claude), se incluye en el HTML.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { informeMd } from './informe-md.mjs';
import { informeHtml } from './informe-html.mjs';

export function generarInformes(rutaJson) {
  const a = JSON.parse(readFileSync(rutaJson, 'utf8'));
  const dirInf = join(dirname(rutaJson), '..', 'informes');
  const base = basename(rutaJson, '.json');
  const rutaResumen = [join(dirInf, `${base}-resumen.md`), join(dirInf, 'resumen.md')].find(existsSync);
  const resumen = rutaResumen ? readFileSync(rutaResumen, 'utf8') : null;
  const md = join(dirInf, `${base}.md`);
  const html = join(dirInf, `${base}.html`);
  writeFileSync(md, informeMd(a));
  writeFileSync(html, informeHtml(a, { resumen }));
  return { md, html };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ruta = process.argv[2];
  if (!ruta) { console.log('Uso: npm run informe -- clientes/<nombre>/datos/auditoria-FECHA.json'); process.exit(1); }
  const r = generarInformes(ruta);
  console.log(`Informes regenerados:\n  ${r.md}\n  ${r.html}`);
}
