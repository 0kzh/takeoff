import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [react()],
  server: { port: 8731 },
  preview: { port: 8731 },
});
