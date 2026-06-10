import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const frontendUrl = env.VITE_FRONTEND_URL || 'http://localhost:5173'
  const frontendHost = frontendUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '')

  const allowedHosts = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    frontendHost,
  ]

  if ((env.VITE_FRONTEND_URL || '').includes('ngrok-free.app')) {
    allowedHosts.push('.ngrok-free.app')
  }

  return {
    plugins: [react()],
    server: {
      allowedHosts,
      host: '0.0.0.0',
      strictPort: false,
      port: 5173,
      hmr: {
        protocol: 'wss',
        host: frontendHost,
        clientPort: 5173,
      },
    },
  }
})
