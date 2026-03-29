import {
    DEFAULT_PLUGIN_MARKET_ALLOW_ALL_SITES,
    DEFAULT_PLUGIN_MARKET_AUTHORIZED_SITES,
    PLUGIN_MARKET_ALLOW_ALL_SITES_KEY,
    PLUGIN_MARKET_AUTHORIZED_SITES_KEY,
} from './pluginMarketAccess'

export function getDefaultSettings() {
    return {
        'giopic-auto-inject': true, // 是否自动注入脚本
        'giopic-context-menu': true, // 是否开启右键菜单
        'giopic-dark-mode': true, // 是否开启暗黑模式
        'giopic-theme-color': 'blue', // 主题色
        'giopic-hover-preview': true, // 是否开启悬停预览
        'giopic-locale': 'zh-CN', // 语言
        'giopic-onboarding-completed': false, // 是否完成欢迎引导
        'giopic-ui-mode': 'classic', // UI 模式
        'open-mode': 'tab', // 打开模式
        [PLUGIN_MARKET_ALLOW_ALL_SITES_KEY]: DEFAULT_PLUGIN_MARKET_ALLOW_ALL_SITES, // 是否允许所有网站访问插件市场完整权限
        [PLUGIN_MARKET_AUTHORIZED_SITES_KEY]: [...DEFAULT_PLUGIN_MARKET_AUTHORIZED_SITES], // 插件市场授权站点
        sidebarSettings: { // 侧边栏设置
            enabled: true, // 是否开启侧边栏
            mode: 'inject', // 侧边栏模式
            opacity: 80, // 侧边栏透明度
            autoHide: {
                enabled: true, // 是否开启贴边自动缩进
                delay: 1, // 触发时间 (秒)
                opacity: 70, // 缩进后透明度
                scale: 90, // 缩进后缩放比例
                translateX: 40 // 缩进距离 (%)
            }
        },
        sidebar_disabled_sites: [] as string[] // 侧边栏禁用的站点
    }
}
