import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'local-vercel-proxy',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url && req.url.startsWith('/api/proxy-applywizz')) {
            try {
              const url = new URL(req.url, 'http://localhost');
              const email = url.searchParams.get('email');
              if (!email) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(null));
                return;
              }
              const fetchMethod = globalThis.fetch;
              const fetchResponse = await fetchMethod(`https://applywizz-5i8qccsfs-applywizz-tech-vercels-projects.vercel.app/api/user-details?email=${encodeURIComponent(email)}`);
              if (fetchResponse.status === 404 || !fetchResponse.ok) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(null));
                return;
              }
              const data = await fetchResponse.json();
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
            } catch (err) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(null));
            }
            return;
          }
          next();
        });
      }
    }
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/applywizz-api': {
        target: 'https://applywizz-5i8qccsfs-applywizz-tech-vercels-projects.vercel.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/applywizz-api/, ''),
      },
      '/proxy-s3': {
        target: 'https://applywizz-prod.s3.us-east-2.amazonaws.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy-s3/, ''),
      },
      '/proxy-vercel-blob': {
        target: 'https://public.blob.vercel-storage.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy-vercel-blob/, ''),
      },
    },
  },
  esbuild: {
    drop: ['console', 'debugger'],
  },
});