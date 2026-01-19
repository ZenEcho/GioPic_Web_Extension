import { createApp, h, type Component } from 'vue'
import { NNotificationProvider, NMessageProvider, NDialogProvider } from 'naive-ui'
import browser from 'webextension-polyfill'
import i18n from '@/i18n'

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

function syncStyles(shadowRoot: ShadowRoot) {
    document.querySelectorAll('style[cssr-id], style[data-vite-dev-id]').forEach(style => {
        // Naive UI uses cssr-id
        const cssrId = style.getAttribute('cssr-id')
        if (cssrId && !shadowRoot.querySelector(`style[cssr-id="${cssrId}"]`)) {
            shadowRoot.appendChild(style.cloneNode(true))
        }
        
        // For UnoCSS/Tailwind in dev/prod
        if (!cssrId && style.textContent?.includes('--un-')) {
             shadowRoot.appendChild(style.cloneNode(true))
        }
    })
}

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
