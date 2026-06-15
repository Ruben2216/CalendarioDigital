import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const frontendUrl = env.VITE_FRONTEND_URL || 'http://localhost:5173'
  const isNgrok = frontendUrl.includes('ngrok-free.app')

  // Solo el hostname, sin puerto ni path
  const frontendHostname = frontendUrl.replace(/^https?:\/\//, '').replace(/[:/].*$/, '')
  // Host completo (con puerto si lo tiene) para allowedHosts
  const frontendHostFull = frontendUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '')

  const allowedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1', frontendHostFull, '.ngrok-free.app']

  const hmr = isNgrok
    ? { protocol: 'wss', host: frontendHostname, clientPort: 443 }
    : { protocol: 'ws', host: 'localhost', clientPort: 5173 }

  return {
    plugins: [react()],
    server: {
      allowedHosts,
      host: '0.0.0.0',
      strictPort: false,
      port: 5173,
      hmr,
    },
  }
})
