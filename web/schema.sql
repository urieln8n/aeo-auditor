-- Base de datos D1 del auditor web. Crear con:
--   npx wrangler d1 create aeo-auditor
--   npx wrangler d1 execute aeo-auditor --remote --file web/schema.sql -c web/wrangler.jsonc
CREATE TABLE IF NOT EXISTS auditorias (
  id TEXT PRIMARY KEY,
  creada TEXT NOT NULL,
  dominio TEXT NOT NULL,
  url TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  nota INTEGER,
  resultado TEXT
);
CREATE INDEX IF NOT EXISTS idx_aud_dominio ON auditorias (dominio, creada);
CREATE INDEX IF NOT EXISTS idx_aud_ip ON auditorias (ip_hash, creada);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creado TEXT NOT NULL,
  auditoria_id TEXT,
  url TEXT,
  nota INTEGER,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  negocio TEXT,
  telefono TEXT,
  consentimiento INTEGER NOT NULL,
  enviado_brevo INTEGER DEFAULT 0
);
