import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const rawPort = process.env.PORT;
if (!rawPort) throw new Error('PORT environment variable is required.');
const basePath = process.env.BASE_PATH;
if (!basePath) throw new Error('BASE_PATH environment variable is required.');

export default defineConfig({
  base: basePath,
  root: path.resolve(import.meta.dirname),
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  build: { outDir: path.resolve(import.meta.dirname, 'dist'), emptyOutDir: true },
  server: { port: Number(rawPort), host: '0.0.0.0', allowedHosts: true },
  preview: { port: Number(rawPort), host: '0.0.0.0', allowedHosts: true },
});