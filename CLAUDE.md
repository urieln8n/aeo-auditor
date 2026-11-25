# Auditor AEO: instrucciones para Claude

Herramienta de Andrés AI Studio que mide si una web puede ser **leída y citada** por ChatGPT,
Perplexity, Claude y Gemini, y después la arregla. No es un auditor SEO: los crawlers de IA
**no ejecutan JavaScript** (Googlebot sí). Esa diferencia es el núcleo del producto.

## Reparto de responsabilidades

| El motor Node hace | Claude hace |
|---|---|
| Rastrear, medir, puntuar | Interpretar y priorizar |
| Producir JSON objetivo | Redactar el resumen con contexto de negocio |
| Detectar qué falla | Decidir qué se arregla primero y con qué esfuerzo |
| Generar snippets base | Adaptarlos a la web y la plataforma reales |

El código nunca redacta prosa comercial. El modelo nunca inventa una métrica.
**Si un número no está en el JSON, no entra en el informe.**

## Flujo con un cliente

1. `npm run auditar -- https://cliente.com --cliente nombre` → crea `clientes/nombre/` con
   `ficha.md`, `datos/auditoria-FECHA.json` e `informes/` (MD interno + HTML para el cliente).
2. Lee el `.md` interno y escribe `clientes/nombre/informes/resumen.md` (6–12 líneas):
   - abre por el **impacto de negocio**, no por la métrica ("tus precios no existen para ChatGPT", no "eje 2: 31/100"),
   - los 3 arreglos prioritarios con su esfuerzo en tiempo humano,
   - español de España, tuteando, "datos estructurados" (no "structured data"),
   - nunca prometas posiciones ni citas: se optimizan condiciones, no resultados.
3. `npm run informe -- clientes/nombre/datos/auditoria-FECHA.json` → regenera el HTML con el resumen.
4. Abre el HTML renderizado y comprueba que no desborda en móvil antes de entregarlo.

## Modo de corrección: pide siempre los archivos

| Plataforma | De dónde salen los archivos |
|---|---|
| WordPress | FTP/SFTP o gestor de archivos (tema activo e hijo) |
| Next.js, React, Astro | Repositorio git |
| HTML a mano | La carpeta entera |
| Shopify | Admin → Tienda online → Temas → Descargar archivo del tema |
| Webflow | Exportación de código (planes de pago) |
| Wix, Squarespace, Framer | No hay archivos → **modo B** |

- **Modo A** (hay código): cópialo en `clientes/nombre/web/`, arréglalo entero, vuelve a
  auditar en local (`npm run auditar -- clientes/nombre/web --cliente nombre`) y enseña el
  **salto de nota eje por eje**. Ese salto medido es el entregable.
- **Modo B** (no hay código): parches para pegar en `clientes/nombre/entregables/`, con la guía
  de `reglas/plataformas/` y diciendo en cada bloque dónde va y qué se rompe si se pega mal.

## Nunca inventes datos del negocio

Teléfono, dirección, horarios, NIF, perfiles: si no están verificados en la web o confirmados
por el cliente → `PENDIENTE_CONFIRMAR`, y se le entrega la lista. El aviso legal del cliente
suele traer razón social, NIF y domicilio. Valida los teléfonos detectados contra la
numeración española antes de usarlos.

## Cosas que no se hacen

- Prometer posiciones o citas.
- `--simular-bots` sin autorización escrita del cliente (anotada en su `ficha.md`).
- Vender `llms.txt` como crítico (Google no lo usa; adopción ~10 %). Se genera porque cuesta cero.
- Rastrear agresivamente: 1 petición/segundo, Crawl-delay respetado, user agent honesto.
- Subir datos de clientes reales al repo: `clientes/` está en `.gitignore` salvo los ejemplos.

## Anexo Cloudflare (isitagentready.com)

No puntúa. Si su veredicto de robots.txt discrepa del eje 1 (`contrasteEje1.discrepan`),
**investígalo antes de enseñar nada**: si ellos reciben un 404 y nosotros un 200, hay un
cortafuegos filtrando por origen. Nivel 3 exige negociación de contenido en Markdown: un
cliente en Wix/Squarespace/Framer no puede pasar del nivel 2.

## Anexo capa de agentes (src/cloudflare.mjs)

No puntúa. Mira si la web pasa por Cloudflare, si responde Markdown ante `Accept: text/markdown`
(muro del nivel 3) y qué Content Signals declara. No suplanta bots: Cloudflare verifica bots
por IP y un user agent falso daría bloqueos que el bot real no sufre. Los controles
Search/Agent/Training del panel no se ven desde fuera: se revisan con el cliente.

Venta: las webs de Andrés ya están en Cloudflare → activar Markdown for Agents, Search y Agent
en Allow y `Content-Signal: search=yes, ai-input=yes`, y volver a auditar para enseñar el salto.

## Fase 2 (preparada, no construida)

`src/citas/interfaz.mjs`: medir si los modelos citan al cliente. Perplexity primero. Ejecutar
cada prompt varias veces y reportar frecuencia. El JSON ya reserva `citas: null`.

## Al terminar una sesión

Actualiza este proyecto en el cuartel general (`~/proyectos/andres-hq`): `siguiente` en
`proyectos.json`, una línea en `BITACORA.md`, `node scripts/generar.mjs`, commit y push.
