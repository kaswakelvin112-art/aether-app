import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    build: {
      outDir: resolve('out/main'),
      rollupOptions: { input: { main: resolve('main/main.ts') } }
    }
  },
  preload: {
    build: {
      outDir: resolve('out/preload'),
      rollupOptions: { input: { preload: resolve('preloader/preload.ts') } }
    }
  },
  renderer: {
    root: resolve('renderer'),
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': resolve('app/renderer/src') } },
    build: {
      outDir: resolve('out/renderer'),
      rollupOptions: { input: { index: resolve('renderer/index.html') } }
    }
  }
})