import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { isDev } from './manifest/utils'

export default defineConfig({
  build: {
    watch: isDev ? {} : undefined, // 开发环境下开启watch
    emptyOutDir: false,
    outDir: 'dist',
    minify: false,
    rollupOptions: {
      input: {
        background: fileURLToPath(new URL('./src/background/index.ts', import.meta.url)),
        'src/sandbox/sandbox': fileURLToPath(new URL('./src/sandbox/sandbox.ts', import.meta.url)),
        'src/offscreen/offscreen': fileURLToPath(new URL('./src/offscreen/offscreen.ts', import.meta.url))
      },
      output: {
        format: 'es',
        entryFileNames: '[name].js',
      }
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'util': fileURLToPath(new URL('./src/utils/nodeUtil.ts', import.meta.url))
    }
  }
})
