# Auditor AEO · Andrés AI Studio

¿Pueden ChatGPT, Perplexity, Claude y Gemini **leer y citar** una web? Esta herramienta lo mide
y entrega un informe HTML con tu marca, listo para enseñar al cliente.

**Estado:** base (herramienta de venta) · **Siguiente paso:** auditar Stylebuddhas y Avancés Campus como primeros casos.

## La doble pasada

Cada página se descarga dos veces:

- **A:** `fetch` sin JavaScript. Es exactamente lo que ve GPTBot.
- **B:** navegador completo (Playwright). Es lo que ve una persona.

La diferencia entre las dos es el dato más vendible: *"el 100 % de tu web no existe para la IA"*.

## Instalar (una vez)

Necesitas Node 22 o superior.

```bash
git clone https://github.com/urieln8n/aeo-auditor ~/proyectos/aeo-auditor
cd ~/proyectos/aeo-auditor
npm install
npx playwright install chromium   # si falla, usa tu Chrome: export CHROME_PATH=/ruta/a/chrome
npm test                          # 8 tests de robots.txt
```

## Usar

```bash
npm run auditar -- https://cliente.com --cliente nombre
npm run auditar -- ./clientes/nombre/web --cliente nombre      # audita una carpeta local
npm run informe -- clientes/nombre/datos/auditoria-FECHA.json  # regenera el HTML
```

Opciones: `--max N` (por defecto 25 páginas) · `--sin-render` · `--sin-agente` · `--simular-bots`
(solo con autorización escrita) · `--verbose`.

El resultado queda en `clientes/nombre/`:

```
ficha.md                         datos verificados del cliente
datos/auditoria-FECHA.json       todas las métricas (nunca se sobrescribe: -2, -3…)
informes/auditoria-FECHA.md      informe interno
informes/auditoria-FECHA.html    entregable con tu marca (un solo archivo, se envía por email)
informes/resumen.md              lo redacta Claude y se incluye en el HTML
```

Prueba con las webs de control:

```bash
npm run auditar -- ejemplo/bien-hecha --cliente prueba-bien     # ~95/100
npm run auditar -- ejemplo/sin-ssr --cliente prueba-sin-ssr     # ~28/100, 100 % de pérdida
```

## Los 8 ejes

| # | Eje | Peso | Pregunta |
|---|---|---|---|
| 1 | Acceso de los crawlers de IA | 20 | ¿Puede la IA llegar a la web? |
| 2 | Lectura sin JavaScript | 20 | ¿Puede leer lo que hay dentro? |
| 3 | Datos estructurados | 18 | ¿Entiende qué es y qué vende? |
| 4 | Estructura respondible | 15 | ¿Puede extraer y citar párrafos? |
| 5 | Entidad y marca | 10 | ¿Sabe quién es y se fía? |
| 6 | Frescura | 7 | ¿Puede fechar y atribuir? |
| 7 | Indexación básica | 5 | ¿Está la base del SEO en orden? |
| 8 | Acceso técnico | 5 | ¿Responde rápido para un crawler? |

Bandas: 85 excelente · 70 bueno · 50 mejorable · por debajo, crítico.

## Anexo: capa de agentes (Cloudflare)

Cada auditoría mira también, sin que cuente para la nota:
- si la web pasa por **Cloudflare**,
- si responde en **Markdown** cuando un agente lo pide (`Accept: text/markdown`), que es el muro del nivel 3 del sello de Cloudflare,
- qué **Content Signals** declara en robots.txt (`search`, `ai-input`, `ai-train`),
- si Cloudflare pone un desafío a los visitantes automáticos.

Y propone las acciones concretas en el informe. Se desactiva con `--sin-agente`.

## Versión web (auditoria.andresrendon.com)

Carpeta `web/`: un Cloudflare Worker con el MISMO motor, solo pasada A (lo que ve la IA), máx. 3 páginas.
El negocio mete su URL → ve su nota y sus 3 fallos → deja nombre y email para el informe completo,
que haces tú con el auditor del PC (doble pasada) y le llamas.

Publicarla (una vez, desde el PC):

```bash
npx wrangler login
npx wrangler d1 create aeo-auditor                      # copia el database_id en web/wrangler.jsonc
npx wrangler d1 execute aeo-auditor --remote --file web/schema.sql -c web/wrangler.jsonc
npx wrangler secret put SAL -c web/wrangler.jsonc         # un texto aleatorio largo
npx wrangler secret put CLAVE_ADMIN -c web/wrangler.jsonc # tu clave para descargar contactos
npm run web:deploy
```

Después, en Cloudflare → Workers → aeo-auditor → Settings → Domains → `auditoria.andresrendon.com`.

- Contactos: `https://auditoria.andresrendon.com/api/leads?clave=TU_CLAVE` (CSV para Excel).
- Brevo: lista #6 "Auditoría AEO - leads". Rellena NOMBRE, NEGOCIO, WEB, WA_NUMERO, NOTA_AEO, NIVEL_AEO,
  PROBLEMA_1..3 y ORIGEN. Solo falta el secreto `BREVO_API_KEY`.
- Límites: 10 auditorías por persona y día; el mismo dominio se cachea 12 h (en `vars`).
- Enlace directo para mensajes: `https://auditoria.andresrendon.com/?url=su-web.com`.
- En local: `npm run web:dev` (añade `--var ALLOW_LOCAL:1` para auditar webs de 127.0.0.1).

## Cambiar la marca

Todo lo visible está en `marca.json` (nombre, empresa, web, colores, tipografías). Si lo borras,
el informe sale en grises neutros.

## Estructura

```
marca.json · reglas/ (pesos, 22 crawlers, plataformas) · plantillas/ (robots, llms, JSON-LD, ficha)
src/auditar.mjs        orquestador          src/rastreador.mjs   doble pasada A/B
src/robots.mjs         RFC 9309 + test      src/comprobaciones/  un módulo por eje
src/puntuacion.mjs     pesos → nota         src/informe-*.mjs    MD interno + HTML cliente
src/agent-readiness.mjs anexo Cloudflare    src/citas/           fase 2 (interfaz vacía)
```

Las instrucciones de trabajo para Claude están en [`CLAUDE.md`](CLAUDE.md).

> Registrado en el cuartel general: https://github.com/urieln8n/andres-hq
