// Pasada B: navegador real con Playwright. Solo en el PC (no en Cloudflare Workers).
import { existsSync } from 'node:fs';

export async function abrirNavegador() {
  const { chromium } = await import('playwright');
  try { return await chromium.launch(); } catch {}
  const rutas = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    'C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
  for (const p of rutas) if (existsSync(p)) return chromium.launch({ executablePath: p });
  return chromium.launch({ channel: 'chrome' });
}
