import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {defineConfig, loadEnv} from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, rootDir, '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'api-server',
        configureServer(server) {
          let apiApp: any = null
          // Load once and reuse
          import('./src/api-server/index.ts').then((mod) => {
            apiApp = mod.createApiServer()
          }).catch((err) => {
            console.error('Failed to load API server:', err)
          })

          server.middlewares.use((req: any, res: any, next: any) => {
            if (req.url?.startsWith('/api/')) {
              if (!apiApp) {
                res.statusCode = 503
                res.end(JSON.stringify({ error: { code: 'NOT_READY', message: 'API server is starting' } }))
                return
              }
              // Express 4 compatible: wrap in Promise to catch async errors
              Promise.resolve(apiApp(req, res, next)).catch((err) => {
                console.error('API server error:', err)
                if (!res.headersSent) {
                  res.statusCode = 500
                  res.end(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'API request failed' } }))
                }
              })
            } else {
              next()
            }
          })
        },
      },
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(rootDir, 'src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
