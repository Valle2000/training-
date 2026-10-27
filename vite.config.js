import { defineConfig, loadEnv } from 'vite';
import { readFileSync } from 'node:fs';
import { devMiddleware } from './server/http.mjs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig(({ mode }) => {
  // Server-Schlüssel aus .env nur serverseitig laden (kein VITE_-Präfix → nie im Browser-Bundle).
  const env = loadEnv(mode, process.cwd(), '');
  for (const [k, v] of Object.entries(env)) if (/^(ANTHROPIC_API_KEY|APP_ACCESS_CODE|APP_URL|(POLAR|CONCEPT2|WAHOO)_CLIENT_(ID|SECRET))$/.test(k) && !process.env[k]) process.env[k] = v;
  const api = {
    name: 'trainings-api',
    configureServer(server) { server.middlewares.use(devMiddleware()); },
    configurePreviewServer(server) { server.middlewares.use(devMiddleware()); },
  };
  return {
    plugins: [api],
    define: { __APP_VERSION__: JSON.stringify(pkg.version), __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'), __APP_URL__: JSON.stringify((env.APP_URL || process.env.APP_URL || '').replace(/\/$/, '')) },
  };
});
