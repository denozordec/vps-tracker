import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite as TanStackRouterPlugin } from '@tanstack/router-plugin/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [
    TanStackRouterPlugin({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@cfdm/ui/components': path.resolve(__dirname, '../../packages/ui/src/components'),
      '@cfdm/ui/hooks': path.resolve(__dirname, '../../packages/ui/src/hooks'),
      '@cfdm/ui/lib/utils': path.resolve(__dirname, '../../packages/ui/src/lib/utils.ts'),
      '@cfdm/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@cfdm/db': path.resolve(__dirname, '../../packages/db/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
  },
})
