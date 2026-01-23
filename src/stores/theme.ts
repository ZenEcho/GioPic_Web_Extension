import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { type GlobalThemeOverrides, darkTheme } from 'naive-ui'
import { db } from '@/utils/storage'
import browser from 'webextension-polyfill'

export type ThemeColor = 'blue' | 'green' | 'purple' | 'orange' | 'red' 
export type UiMode = 'classic' | 'console' | 'center' | 'simple'

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

export const useThemeStore = defineStore('theme', () => {
  const currentColor = ref<ThemeColor>('blue')
  const isDark = ref(false)
  const uiMode = ref<UiMode>('classic')

  // Load initial state
  db.get<ThemeColor>('giopic-theme-color').then(color => {
      if (color) currentColor.value = color
  })
  
  // Use storage.local for dark mode to share with content scripts
  browser.storage.local.get('giopic-dark-mode').then(res => {
      const mode = res['giopic-dark-mode']
      if (mode === 'true') isDark.value = true
  })

  browser.storage.local.get('giopic-ui-mode').then(res => {
      const mode = res['giopic-ui-mode']
      if (mode === 'classic' || mode === 'console' || mode === 'center' || mode === 'simple') {
        uiMode.value = mode
      }
  })

  watch(isDark, (val) => {
    browser.storage.local.set({ 'giopic-dark-mode': String(val) })
    if (val) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, { immediate: true })

  const naiveTheme = computed(() => isDark.value ? darkTheme : null)

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

  function applyThemeCssVars() {
    if (typeof document === 'undefined') return
    const colors = themeColors[currentColor.value]
    const root = document.documentElement
    root.style.setProperty('--giopic-primary', colors.primary)
    root.style.setProperty('--giopic-primary-hover', colors.hover)
    root.style.setProperty('--giopic-primary-pressed', colors.pressed)
    root.style.setProperty('--giopic-primary-suppl', isDark.value ? colors.pressed : colors.suppl)
  }

  watch([currentColor, isDark], applyThemeCssVars, { immediate: true })


  function setThemeColor(color: ThemeColor) {
    currentColor.value = color
    db.set('giopic-theme-color', color)
  }

  function toggleDark() {
    isDark.value = !isDark.value
  }

  function setUiMode(mode: UiMode) {
    uiMode.value = mode
    browser.storage.local.set({ 'giopic-ui-mode': mode })
  }

  return {
    currentColor,
    isDark,
    uiMode,
    naiveTheme,
    themeOverrides,
    setThemeColor,
    toggleDark,
    setUiMode,
  }
})
