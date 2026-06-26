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
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: '@cfdm/ui/components', replacement: path.resolve(__dirname, '../../packages/ui/src/components') },
      { find: '@cfdm/ui/hooks', replacement: path.resolve(__dirname, '../../packages/ui/src/hooks') },
      { find: '@cfdm/ui/lib/utils', replacement: path.resolve(__dirname, '../../packages/ui/src/lib/utils.ts') },
      { find: /^@cfdm\/shared\/(.*)$/, replacement: path.resolve(__dirname, '../../packages/shared/src/$1') },
      { find: '@cfdm/shared', replacement: path.resolve(__dirname, '../../packages/shared/src/index.ts') },
      { find: '@cfdm/db', replacement: path.resolve(__dirname, '../../packages/db/src/index.ts') },
    ],
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
