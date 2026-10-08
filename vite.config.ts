import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  publicDir: false,
  server: { host: '127.0.0.1', port: 8731 },
  preview: { host: '127.0.0.1', port: 8731 },
});
