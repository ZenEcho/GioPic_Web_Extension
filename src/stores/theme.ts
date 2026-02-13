/**
 * @file theme.ts
 * @description 主题与 UI 外观状态管理 Store
 * 
 * 职责：
 * 1. 管理应用的主题色（Theme Color）和暗黑模式（Dark Mode）
 * 2. 管理 UI 布局模式（UiMode）
 * 3. 生成 Naive UI 的主题覆盖配置（ThemeOverrides）
 * 4. 同步主题设置到 DOM CSS 变量和 extension storage
 * 
 * 依赖：
 * - pinia: 状态管理
 * - naive-ui: UI 组件库主题类型
 * - @/utils/storage: 本地存储
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { type GlobalThemeOverrides, darkTheme } from 'naive-ui'
import { db } from '@/utils/storage'
import browser from 'webextension-polyfill'

export type ThemeColor = 'blue' | 'green' | 'purple' | 'orange' | 'red' 
export type UiMode = 'classic' | 'console' | 'center' | 'simple'

/**
 * 预定义的主题色配置
 * 包含主要颜色及其 hover、pressed 和 suppl 变体
 */
export const themeColors: Record<ThemeColor, { primary: string, hover: string, pressed: string, suppl: string }> = {
  blue: {
    primary: '#3B82F6',
    hover: '#60A5FA',
    pressed: '#2563EB',
    suppl: '#DBEAFE',
  },
  green: {
    primary: '#10B981',
    hover: '#34D399',
    pressed: '#059669',
    suppl: '#D1FAE5',
  },
  purple: {
    primary: '#8B5CF6',
    hover: '#A78BFA',
    pressed: '#7C3AED',
    suppl: '#EDE9FE',
  },
  orange: {
    primary: '#F97316',
    hover: '#FB923C',
    pressed: '#EA580C',
    suppl: '#FFEDD5',
  },
  red: {
    primary: '#EF4444',
    hover: '#F87171',
    pressed: '#DC2626',
    suppl: '#FEE2E2',
  },
}

/**
 * Theme Store
 * 管理全局外观设置
 */
export type ThemeMode = 'light' | 'dark' | 'auto'

/**
 * Theme Store
 * 管理全局外观设置
 */
export const useThemeStore = defineStore('theme', () => {
  const currentColor = ref<ThemeColor>('blue')
  const themeMode = ref<ThemeMode>('auto')
  const systemIsDark = ref(window.matchMedia('(prefers-color-scheme: dark)').matches)
  const uiMode = ref<UiMode>('classic')
  
  // 监听系统主题变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    systemIsDark.value = e.matches
  })

  // 计算当前实际是否为暗黑模式
  const isDark = computed(() => {
    if (themeMode.value === 'auto') return systemIsDark.value
    return themeMode.value === 'dark'
  })

  // 从 storage.local 加载主题色
  browser.storage.local.get('giopic-theme-color').then(res => {
      const color = res['giopic-theme-color'] as ThemeColor
      if (color && themeColors[color]) {
          currentColor.value = color
      }
  })
  

  // 从 extension storage 加载暗黑模式设置（以便 Content Scripts 也能读取）
  browser.storage.local.get('giopic-theme-mode').then(res => {
      const mode = res['giopic-theme-mode'] as ThemeMode
      if (mode === 'light' || mode === 'dark' || mode === 'auto') {
          themeMode.value = mode
      } else {
          // 兼容旧版 giopic-dark-mode 设置
          browser.storage.local.get('giopic-dark-mode').then(oldRes => {
             if (oldRes['giopic-dark-mode'] === 'true') themeMode.value = 'dark'
             else if (oldRes['giopic-dark-mode'] === 'false') themeMode.value = 'light'
          })
      }
  })

  // 加载 UI 模式设置
  browser.storage.local.get('giopic-ui-mode').then(res => {
      const mode = res['giopic-ui-mode']
      if (mode === 'classic' || mode === 'console' || mode === 'center' || mode === 'simple') {
        uiMode.value = mode
      }
  })

  // 监听暗黑模式变化，同步到 storage 和 DOM class
  watch([themeMode, isDark], ([mode, dark]) => {
    browser.storage.local.set({ 'giopic-theme-mode': mode })
    // 为了兼容旧代码，也设置 giopic-dark-mode
    browser.storage.local.set({ 'giopic-dark-mode': String(dark) })
    
    if (dark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, { immediate: true })

  // Naive UI 暗黑主题对象
  const naiveTheme = computed(() => isDark.value ? darkTheme : null)

  // 计算 Naive UI 的全局主题覆盖配置
  const themeOverrides = computed<GlobalThemeOverrides>(() => {
    const colors = themeColors[currentColor.value]
    return {
      common: {
        primaryColor: colors.primary,
        primaryColorHover: colors.hover,
        primaryColorPressed: colors.pressed,
        primaryColorSuppl: isDark.value ? colors.pressed : colors.suppl, // Dark mode uses darker suppl
        borderRadius: '12px',
      },
      Card: {
        borderRadius: '16px',
      },
      Button: {
        borderRadiusMedium: '8px',
      },
      // Ensure dialogs and other components follow dark mode correctly if needed
      Dialog: {
        borderRadius: '16px',
      }
    }
  })

  /**
   * 应用主题 CSS 变量到文档根元素
   * 用于 UnoCSS 或其他 CSS 使用
   */
  function applyThemeCssVars() {
    if (typeof document === 'undefined') return
    const colors = themeColors[currentColor.value]
    const root = document.documentElement
    root.style.setProperty('--giopic-primary', colors.primary)
    root.style.setProperty('--giopic-primary-hover', colors.hover)
    root.style.setProperty('--giopic-primary-pressed', colors.pressed)
    root.style.setProperty('--giopic-primary-suppl', isDark.value ? colors.pressed : colors.suppl)
  }

  // 当主题色或暗黑模式变化时，重新应用 CSS 变量
  watch([currentColor, isDark], applyThemeCssVars, { immediate: true })

  /**
   * 设置主题色
   * @param color - 目标颜色名
   */
  function setThemeColor(color: ThemeColor) {
    currentColor.value = color
    browser.storage.local.set({ 'giopic-theme-color': color })
  }

  /**
   * 设置主题模式
   */
  function setThemeMode(mode: ThemeMode) {
    themeMode.value = mode
  }

  /**
   * 切换暗黑模式 (legacy)
   */
  function toggleDark() {
    if (isDark.value) setThemeMode('light')
    else setThemeMode('dark')
  }

  /**
   * 设置 UI 布局模式
   * @param mode - 布局模式名
   */
  function setUiMode(mode: UiMode) {
    uiMode.value = mode
    browser.storage.local.set({ 'giopic-ui-mode': mode })
  }

  return {
    currentColor,
    themeMode,
    isDark,
    uiMode,
    naiveTheme,
    themeOverrides,
    setThemeColor,
    setThemeMode,
    toggleDark,
    setUiMode,
  }
})
