import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../static/app',   // КЛАДЁМ В КОРЕНЬ ПРОЕКТА: <project>/static/app
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  base: '/static/app/',        // чтобы пути к ассетам были корректные
})
