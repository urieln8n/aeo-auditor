# WordPress
- **robots.txt:** Yoast/Rank Math → Herramientas → Editor de archivos. Sin plugin, súbelo por FTP a la raíz.
- **JSON-LD:** en el `functions.php` del tema hijo con `wp_head`, o en el campo "Schema" de Rank Math. No toques el tema padre: se pierde al actualizar.
- **Render:** WordPress sirve HTML en el servidor. Si el eje 2 falla, la culpa suele ser de un constructor visual (Elementor con widgets por AJAX, sliders) o de un plugin de "lazy load" de contenido.
- **Rompe si se pega mal:** un `<script>` JSON-LD con una coma de más se ignora entero. Valida en validator.schema.org.
