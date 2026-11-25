# Por qué existe cada comprobación

- **Crawlers de IA ≠ Googlebot.** Googlebot ejecuta JavaScript; los de OpenAI, Anthropic y Perplexity leen el HTML tal cual llega. Una web hecha con un framework sin SSR puede estar perfecta en Google y vacía para ChatGPT. → eje 2.
- **Entrenamiento ≠ búsqueda.** GPTBot entrena; OAI-SearchBot alimenta las búsquedas de ChatGPT. Bloquear el primero no te saca de las respuestas. Solo los de búsqueda y agente son críticos. → eje 1.
- **Los asistentes citan fragmentos.** Párrafos autosuficientes de 40–80 palabras bajo encabezados que son preguntas son lo más fácil de extraer. → eje 4.
- **Entidad.** `sameAs` y los datos del negocio en JSON-LD permiten unir la web con Google Maps, Instagram y las reseñas. → ejes 3 y 5.
- **Fechas.** Ante dos fuentes, la que se puede fechar gana. → eje 6.
- **llms.txt** es opcional: Google ha dicho que no lo usa. Severidad baja.
- **Nadie controla qué cita un modelo.** Se optimizan condiciones, no resultados.
