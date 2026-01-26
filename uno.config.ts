import { defineConfig, presetUno, presetIcons, presetAttributify, presetTypography } from 'unocss'
import presetRemToPx from '@unocss/preset-rem-to-px'

export default defineConfig({
    // 显式配置扫描范围，确保 src 下的所有 ts/js 文件都被 UnoCSS 扫描
    // 这样 src/utils/icon.ts 中新增的图标字符串会被自动识别并生成 CSS，无需手动重启或配置 safelist
    content: {
        pipeline: {
            include: [
                /\.(vue|svelte|[jt]sx|mdx?|astro|elm|php|phtml|html)($|\?)/,
                'src/**/*.{js,ts}',
            ]
        }
    },
    presets: [
        presetUno(), // 恢复默认预设，提供 Tailwind/Windi 风格的实用工具类
        presetAttributify(),
        presetTypography(), 
        presetIcons({
            // 自动加载已安装的图标库 (@iconify-json/ph)
            scale: 1.2,
            warn: true,
        }),
        presetRemToPx({
            baseFontSize: 16
        })
    ],
    shortcuts: {
        'accent-text': 'text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500',
    }
})
