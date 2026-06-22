import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'serve-docs-index',
      configureServer(server) {
        server.middlewares.use((req: { url?: string }, _res: unknown, next: () => void) => {
          if (req.url === '/kboScoring/docs' || req.url === '/kboScoring/docs/') {
            req.url = '/kboScoring/docs/index.html';
          }
          next();
        });
      },
    },
    {
      name: 'remove-crossorigin',
      transformIndexHtml(html) {
        return html.replace(/ crossorigin/g, '');
      },
    },
  ],
  base: '/kboScoring/',
});
