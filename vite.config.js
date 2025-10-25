import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // 👈 Enables access via local IP
    watch: {
      ignored: [
        '**/server/**',
        '**/backend/**',
        '**/logs/**',
        '**/dist/**'
      ]
    }
  }
});
