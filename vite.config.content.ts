import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'
import UnoCSS from 'unocss/vite'
import presetUno from 'unocss/preset-uno'
import { isDev } from './manifest/utils'

console.log('vite.config.content.ts', isDev);

export default defineConfig({
  plugins: [
    vue(),
    UnoCSS({
      presets: [
        presetUno({
          preflight: false,
        }),
      ],
    }),
    AutoImport({
      imports: [
        'vue',
        {
          'naive-ui': [
            'useDialog',
            'useMessage',
            'useNotification',
            'useLoadingBar'
          ]
        }
      ],
      resolvers: [NaiveUiResolver()],
      dts: false,
    }),
    Components({
      resolvers: [NaiveUiResolver()],
      dts: false,
    }),
  ],
  build: {
    watch: isDev ? {} : undefined,
    emptyOutDir: false,
    outDir: 'dist',
    minify: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        content: fileURLToPath(new URL('./src/content/index.ts', import.meta.url))
      },
      output: {
        format: 'iife',
        entryFileNames: 'content/content.js',
        name: 'GioPicContent',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'content/content.css'
          }
          return 'assets/[name]-[hash][extname]'
        }
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
