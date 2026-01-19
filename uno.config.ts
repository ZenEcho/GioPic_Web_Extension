import { defineConfig, presetUno, presetIcons, presetAttributify, presetTypography } from 'unocss'
import presetRemToPx from '@unocss/preset-rem-to-px'

export default defineConfig({
    presets: [
        presetUno(), // 中文：UnoCSS 默认预设
        presetAttributify(),
        presetTypography(), // 中文：排版预设
        presetIcons({
            // 自动加载已安装的图标库 (@iconify-json/ph)
        }),
        presetRemToPx({
            baseFontSize: 16,
        })
    ],
    shortcuts: {
        'accent-text': 'text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500',
    },
    safelist: [
        'i-ph-image',
        'i-ph-cloud',
        'i-ph-amazon-logo',
        'i-ph-github-logo',
        'i-ph-hard-drive',
        'i-ph-palette',
        'i-ph-translate',
        'i-ph-arrow-square-out',
        'i-ph-layout',
        'i-ph-sidebar',
        'i-ph-swatches',
        'i-ph-magic-wand',
        'i-ph-desktop',
        'i-ph-info',
        'i-ph-browser',
        'i-ph-app-window',
        'i-ph-monitor',
        'i-ph-terminal-window',
        'i-ph-columns',
        'i-ph-square',
        'i-ph-list',
        'i-ph-list-bold',
        'i-ph-x',
        'i-ph-x-bold',
        'i-ph-caret-left',
        'i-ph-caret-right',
        'i-ph-gear',
        'i-ph-cloud-slash',
        'i-ph-cloud-arrow-up-bold',
        'i-ph-sun-bold',
        'i-ph-moon-bold',
        'i-ph-trash-bold',
    ]
})
