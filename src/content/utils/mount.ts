/**
 * @file mount.ts
 * @description Vue 组件挂载工具
 * 
 * 职责：
 * 1. 提供将 Vue 组件挂载到页面的通用方法
 * 2. 支持 Shadow DOM 隔离，防止页面样式干扰
 * 3. 自动同步 Naive UI 和 UnoCSS 的样式到 Shadow Root
 * 4. 支持集成 Naive UI 的 Provider (Notification, Message, Dialog)
 * 
 * 依赖：
 * - vue: Vue 核心
 * - naive-ui: UI 组件库
 * - webextension-polyfill: 获取扩展资源 URL
 */

import { createApp, h, type Component } from 'vue'
import { NNotificationProvider, NMessageProvider, NDialogProvider } from 'naive-ui'
import browser from 'webextension-polyfill'
import i18n from '@/i18n'

/**
 * 挂载 Vue 组件到页面
 * 
 * @param component - Vue 组件对象
 * @param wrapperId - 容器元素 ID (用于防止重复挂载)
 * @param useShadowDOM - 是否使用 Shadow DOM (默认 true)
 * @param props - 传递给组件的 Props
 * @param useProvider - 是否包裹 Naive UI Provider (默认 false)
 * @returns Vue 应用实例
 */
export function mountComponent(
    component: Component, 
    wrapperId: string, 
    useShadowDOM: boolean = true,
    props: Record<string, any> = {},
    useProvider: boolean = false
) {
    // Check if already mounted
    if (document.getElementById(wrapperId)) return

    const container = document.createElement('div')
    container.id = wrapperId
    container.className = wrapperId
    
    const root = document.createElement('div')
    let mountTarget: HTMLElement | ShadowRoot = container

    if (useShadowDOM) {
        mountTarget = container.attachShadow({ mode: "closed" })
        
        // Inject Base CSS
        const styleEl = document.createElement('link')
        styleEl.setAttribute('rel', 'stylesheet')
        styleEl.setAttribute('href', browser.runtime.getURL('content/content.css'))
        mountTarget.appendChild(styleEl)
        
        // Add Tailwind/UnoCSS Reset manually for Shadow DOM
        const resetStyle = document.createElement('style')
        resetStyle.textContent = `
          :host { line-height: 1.5; -webkit-text-size-adjust: 100%; tab-size: 4; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"; font-feature-settings: normal; font-variation-settings: normal; }
          *, ::before, ::after { box-sizing: border-box; border-width: 0; border-style: solid; border-color: #e5e7eb; }
        `
        mountTarget.appendChild(resetStyle)

        // Sync Naive UI / UnoCSS styles
        syncStyles(mountTarget)
        setupStyleObserver(mountTarget)
    }

    mountTarget.appendChild(root)
    document.documentElement.appendChild(container)

    let app
    if (useProvider) {
        const Wrapper = {
            render: () => h(NNotificationProvider, {
                containerStyle: {
                    zIndex: 2147483647,
                    top: '20px',
                    right: '20px'
                }
            }, {
                default: () => h(NMessageProvider, {}, {
                    default: () => h(NDialogProvider, {}, {
                        default: () => h(component, props)
                    })
                })
            })
        }
        app = createApp(Wrapper)
    } else {
        app = createApp(component, props)
    }

    app.use(i18n)
    app.mount(root)
    return app
}

/**
 * 同步页面样式到 Shadow Root
 * 主要是 Naive UI 的动态样式 (cssr-id)
 * 
 * @param shadowRoot - 目标 Shadow Root
 */
function syncStyles(shadowRoot: ShadowRoot) {
    document.querySelectorAll('style[cssr-id], style[data-vite-dev-id]').forEach(style => {
        // Naive UI uses cssr-id
        const cssrId = style.getAttribute('cssr-id')
        if (cssrId && !shadowRoot.querySelector(`style[cssr-id="${cssrId}"]`)) {
            shadowRoot.appendChild(style.cloneNode(true))
        }
    })
}

/**
 * 监听 Head 变化并自动同步样式
 * 
 * @param shadowRoot - 目标 Shadow Root
 */
function setupStyleObserver(shadowRoot: ShadowRoot) {
    const observer = new MutationObserver((mutations) => {
        let shouldSync = false
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node instanceof HTMLStyleElement) {
                    shouldSync = true
                }
            })
        })
        if (shouldSync) syncStyles(shadowRoot)
    })
    observer.observe(document.head, { childList: true })
}
