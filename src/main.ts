import 'virtual:uno.css'
import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import i18n from './i18n'
import browser from 'webextension-polyfill'

import App from './App.vue'
import router from './router'

console.log('App mounting...')
// Force update
const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n)

// Electron Initialization: Set default storage if empty
browser.storage.local.get(null).then((data) => {
if (Object.keys(data).length === 0) {
    console.log('Initializing default settings for Electron...')
    browser.storage.local.set({
    'giopic-auto-inject': true,
    'giopic-dark-mode': true,
    'giopic-locale': 'zh-CN',
    'open-mode': 'tab',
    sidebarSettings: {
        enabled: true,
        mode: 'inject',
        opacity: 80,
    },
    sidebar_disabled_sites: []
    }).then(() => {
        window.location.reload() // Reload to apply settings
    })
}
})

app.mount('#app')
console.log('App mounted!')
