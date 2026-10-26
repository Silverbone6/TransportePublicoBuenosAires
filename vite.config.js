import { defineConfig } from 'vite';
import { repositoryPersistence } from './server/vite-persistence.js';
export default defineConfig({
  plugins: [repositoryPersistence()],
  // Prevent autosaves from being interpreted as source changes by Vite.
  server: { port: 5173, strictPort: true, watch: { ignored: ['**/data/**'] } },
  preview: { port: 4173, strictPort: true },
  build: { target: 'es2022' },
});
