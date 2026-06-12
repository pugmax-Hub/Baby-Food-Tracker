import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Standard Vite config for browser/static web build
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base: './', // Use relative paths for static hosting (e.g. GitHub Pages)
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  },
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, 'dist-web'),
    emptyOutDir: true
  }
})
