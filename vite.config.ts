import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { isDev, port } from './manifest/utils'

import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'

// https://vite.dev/config/
export default defineConfig({
  server: {
    port,
    hmr: {
      host: 'localhost',
    },
    origin: `http://localhost:${port}`,
  },
  plugins: [
    vue(),
    UnoCSS(),
    AutoImport({
      resolvers: [NaiveUiResolver()],
      dts: 'src/types/auto-imports.d.ts',
    }),
    Components({
      resolvers: [NaiveUiResolver()],
      dts: 'src/types/components.d.ts',
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'util': fileURLToPath(new URL('./src/utils/nodeUtil.ts', import.meta.url))
    },
  },

  build: {
    watch: isDev ? {} : undefined, // 开发环境下开启watch
    emptyOutDir: false,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        sandbox: fileURLToPath(new URL('./src/sandbox/index.html', import.meta.url)),
        offscreen: fileURLToPath(new URL('./src/offscreen/offscreen.html', import.meta.url)),
      },
    }
  }
})
