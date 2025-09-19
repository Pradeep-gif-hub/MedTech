import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    host: true,
    // allow the ngrok / external hostnames so the dev server accepts proxied requests
    allowedHosts: [
      'localhost',    
      'power-worlds-disclosure-dpi.trycloudflare.com' // <- added
    ],
    proxy: {
      // proxy API and websocket calls to backend
      '/api': {
        target: 'http://localhost:8000',
        rewrite: (path) => path.replace(/^\/api/, ''),
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: 'https://medtech-hcmo.onrender.com',
        // target: 'http://localhost:8000',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
