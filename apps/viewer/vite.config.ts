import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/v/',
  plugins: [react()],
  server: { host: true, port: 5174 },
});
