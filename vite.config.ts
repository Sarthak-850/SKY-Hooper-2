import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { app } from './server/src/app.ts';
import { runMigrations } from './server/src/database/migrate.ts';

function leaderboardApiPlugin(): Plugin {
  return {
    name: 'sky-hooper-leaderboard-api',
    configureServer(server) {
      // Ensure migrations are run on dev server startup
      runMigrations().catch((err) => console.warn('Dev migration warning:', err));

      server.middlewares.use((req, res, next) => {
        if (req.url && (req.url.startsWith('/api') || req.url === '/api')) {
          return (app as any)(req, res, next);
        }
        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), leaderboardApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

