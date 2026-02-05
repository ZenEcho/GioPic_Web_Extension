import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type UserConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'
import presetUno from 'unocss/preset-uno'
import { isDev, port } from './manifest/utils'

export default defineConfig(({ mode }) => {
  const target = process.env.TARGET || 'main'
  
  const commonResolve = {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'util': fileURLToPath(new URL('./src/utils/nodeUtil.ts', import.meta.url))
    },
  }

  const commonBuild: UserConfig['build'] = {
    watch: isDev ? {} : undefined,
    emptyOutDir: false,
    outDir: 'dist',
    minify: false,
  }

  // Helper for generating IIFE output configuration
  const getIifeOutput = (name: string, entryName: string) => ({
    format: 'iife' as const,
    entryFileNames: `content/${entryName}.js`,
    name,
    assetFileNames: (assetInfo: any) => {
      if (assetInfo.name && assetInfo.name.endsWith('.css')) {
        return `content/${entryName}.css`
      }
      return 'assets/[name]-[hash][extname]'
    }
  })

  // Common plugins
  const commonPlugins = [vue()]

  // Target specific configurations
  const configs: Record<string, UserConfig> = {
    background: {
      plugins: [],
      build: {
        ...commonBuild,
        rollupOptions: {
          input: {
            background: fileURLToPath(new URL('./src/background/index.ts', import.meta.url)),
            'src/sandbox/sandbox': fileURLToPath(new URL('./src/sandbox/sandbox.ts', import.meta.url)),
            'src/offscreen/offscreen': fileURLToPath(new URL('./src/offscreen/offscreen.ts', import.meta.url))
          } as Record<string, string>,
          output: {
            format: 'es',
            entryFileNames: '[name].js',
          }
        }
      }
    },
    content: {
      plugins: [
        ...commonPlugins,
        UnoCSS({
          presets: [presetUno({ preflight: false })],
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
        ...commonBuild,
        cssCodeSplit: false,
        rollupOptions: {
          input: {
            content: fileURLToPath(new URL('./src/content/index.ts', import.meta.url))
          } as Record<string, string>,
          output: getIifeOutput('GioPicContent', 'content')
        }
      }
    },
    page: {
      plugins: [
        ...commonPlugins,
        UnoCSS(),
      ],
      build: {
        ...commonBuild,
        cssCodeSplit: false,
        rollupOptions: {
          input: {
            page: fileURLToPath(new URL('./src/content/page/index.ts', import.meta.url))
          } as Record<string, string>,
          output: getIifeOutput('GioPicPage', 'page')
        }
      }
    },
    main: {
      server: {
        port,
        hmr: {
          host: 'localhost',
        },
        origin: `http://localhost:${port}`,
      },
      plugins: [
        ...commonPlugins,
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
      build: {
        ...commonBuild,
        rollupOptions: {
          input: {
            main: fileURLToPath(new URL('./index.html', import.meta.url)),
            sandbox: fileURLToPath(new URL('./src/sandbox/index.html', import.meta.url)),
            offscreen: fileURLToPath(new URL('./src/offscreen/offscreen.html', import.meta.url)),
          } as Record<string, string>,
        }
      }
    }
  }

  const config = configs[target] || configs.main

  return {
    ...config,
    resolve: commonResolve
  }
})
