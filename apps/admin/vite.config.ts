import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Listen on all interfaces so Traefik (in Docker) can reach it via host.docker.internal.
    host: true,
  },
})
