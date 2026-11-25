# Shopify
- **robots.txt:** Tienda online → Temas → Editar código → plantilla `robots.txt.liquid` (crearla si no existe).
- **JSON-LD:** `layout/theme.liquid` antes de `</head>`, o en `sections/main-product.liquid` para productos. Muchos temas ya traen Product: comprueba que no lo dupliques.
- **Render:** el HTML viene del servidor. Ojo con apps que pintan reseñas, precios o FAQs por JavaScript: eso no lo ve la IA.
- **Rompe si se pega mal:** Liquid con comillas sin escapar (`| json`) rompe el JSON-LD.
