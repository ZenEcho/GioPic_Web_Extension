export function getDefaultSettings() {
    return {
        'giopic-auto-inject': true, // 是否自动注入脚本
        'giopic-dark-mode': true, // 是否开启暗黑模式
        'giopic-locale': 'zh-CN', // 语言
        'open-mode': 'tab', // 打开模式
        sidebarSettings: { // 侧边栏设置
            enabled: true, // 是否开启侧边栏
            mode: 'inject', // 侧边栏模式
            opacity: 80, // 侧边栏透明度
        },
        sidebar_disabled_sites: [] as string[] // 侧边栏禁用的站点
    }
}
