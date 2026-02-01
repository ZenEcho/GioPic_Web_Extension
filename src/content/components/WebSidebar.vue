<template>
    <div v-if="isVisible" ref="ballRef" class="giopic-floating-ball" :style="ballStyle"
        @click.stop="onClick"
        @mousedown.stop
        @pointerdown.stop
        @mouseenter="isHovering = true"
        @mouseleave="isHovering = false">

        <!-- Logo Icon -->
        <div class="giopic-ball-content">
            <img :src="logoUrl" class="giopic-logo" alt="GioPic" draggable="false" />
        </div>

        <!-- Close Button (visible on hover) -->
        <div v-show="isHovering" class="giopic-close-btn" @click.stop="showCloseDialog = true"
            :title="t('common.delete')">
            <div class="i-ph-x-bold text-red-500 text-xs"></div>
        </div>
        <!-- 上传列表 -->
        <div v-show="isHovering" class="giopic-uploadList-btn" @click.stop="toggleUploadList"
            :title="t('home.history.uploadQueue')">
            <div class="i-ph-list-bold text-blue-500 text-xs"></div>
        </div>
    </div>

    <!-- Iframe Overlay -->
    <div v-if="isVisible" class="giopic-web-overlay" :style="overlayStyle"
        @click.stop="hideIframe"
        @mousedown.stop
        @pointerdown.stop>
    </div>

    <iframe v-if="isVisible" ref="iframeRef" :src="iframeSrc" :style="iframeStyle" allow="clipboard-write"
        @click.stop @load="() => { }"></iframe>

    <!-- Close Confirmation Dialog -->
    <div v-if="showCloseDialog" class="giopic-dialog-overlay"
        @click.stop="showCloseDialog = false"
        @mousedown.stop
        @pointerdown.stop>
        <div class="giopic-dialog" ref="dialogRef" @click.stop :style="dialogStyle">
            <div class="giopic-dialog-header">
                <span class="font-bold text-gray-800 dark:text-gray-200">{{ t('home.sidebar.closeDialog.title')
                    }}</span>
                <button class="giopic-dialog-close" @click="showCloseDialog = false">
                    <div class="i-ph-x text-gray-400 hover:text-gray-600"></div>
                </button>
            </div>

            <div class="giopic-dialog-body">
                <div class="radio-group">
                    <!-- 本次关闭直到下次刷新 -->
                    <label class="radio-item" :class="{ active: closeOption === 'close' }">
                        <input type="radio" v-model="closeOption" value="close">
                        <span>{{ t('home.sidebar.closeDialog.close') }}</span>
                    </label>
                    <label class="radio-item" :class="{ active: closeOption === 'session' }">
                        <input type="radio" v-model="closeOption" value="session">
                        <span>{{ t('home.sidebar.closeDialog.session') }}</span>
                    </label>
                    <label class="radio-item" :class="{ active: closeOption === 'site' }">
                        <input type="radio" v-model="closeOption" value="site">
                        <span>
                            {{ t('home.sidebar.closeDialog.site') }}
                            <span class="text-xs text-gray-400 ml-1">{{ t('home.sidebar.closeDialog.settingsHint')
                                }}</span>
                        </span>
                    </label>
                    <label class="radio-item" :class="{ active: closeOption === 'permanent' }">
                        <input type="radio" v-model="closeOption" value="permanent">
                        <span>
                            {{ t('home.sidebar.closeDialog.permanent') }}
                            <span class="text-xs text-gray-400 ml-1">{{ t('home.sidebar.closeDialog.settingsHint')
                                }}</span>
                        </span>
                    </label>
                </div>
            </div>

            <div class="giopic-dialog-footer">
                <button class="btn-cancel" @click="showCloseDialog = false">{{ t('home.sidebar.closeDialog.cancel')
                }}</button>
                <button class="btn-confirm" @click="handleConfirmClose">{{ t('home.sidebar.closeDialog.confirm')
                    }}</button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick, type CSSProperties } from 'vue'
import browser from 'webextension-polyfill'
import { useDraggable } from '@/content/composables/useDraggable'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()

// Data Types
interface SidebarSettings {
    enabled: boolean
    mode?: 'inject' | 'native'
    position: { x: number, y: number }
    opacity: number
}

interface LegacyUploadArea {
    status?: boolean
    location?: number
    opacity?: number
    position?: 'Left' | 'Right'
}

// Refs
const ballRef = ref<HTMLElement | null>(null)
const iframeRef = ref<HTMLIFrameElement | null>(null)
const dialogRef = ref<HTMLElement | null>(null)
const isHovering = ref(false)
const showCloseDialog = ref(false)
const closeOption = ref<'close' | 'session' | 'site' | 'permanent'>('close')
const iframeShow = ref(false)
const iframeSrc = ref('')
const dialogStyle = ref<any>({})

// Settings & State
const settings = ref<SidebarSettings>({
    enabled: true,
    mode: 'inject',
    position: { x: (document.documentElement.clientWidth || window.innerWidth) - 60, y: window.innerHeight * 0.4 },
    opacity: 80
})
const disabledSites = ref<string[]>([])
const isSessionClosed = ref(false)
const isPageClosed = ref(false)

// Draggable
const { isDragging, position } = useDraggable(ballRef, ballRef, settings.value.position)

// Computed
const isVisible = computed(() => {
    if (!settings.value.enabled) return false
    // Removed: if (settings.value.mode === 'native') return false
    if (isSessionClosed.value) return false
    if (isPageClosed.value) return false
    
    const currentUrl = window.location.href
    const currentHostname = window.location.hostname
    const isDisabled = disabledSites.value.some(site => {
        // Normalize for comparison: remove trailing slash, lowercase, trim
        const normalize = (s: string) => s.trim().replace(/\/+$/, '').toLowerCase()
        const siteNorm = normalize(site)
        const currentNorm = normalize(currentUrl)
        const hostnameNorm = currentHostname.toLowerCase()

        // 1. Hostname Exact Match
        if (siteNorm === hostnameNorm) return true

        // 2. URL/Path Match
        if (site.includes('/') || site.includes('://')) {
            // If site has protocol, direct comparison
            if (site.includes('://')) {
                return currentNorm.startsWith(siteNorm)
            }
            // If site has no protocol (e.g. example.com/foo), compare with protocol-stripped current url
            const currentNoProto = currentNorm.replace(/^https?:\/\//, '')
            return currentNoProto.startsWith(siteNorm)
        }
        
        return false
    })
    
    if (isDisabled) return false
    return true
})

const logoUrl = browser.runtime.getURL('assets/icons/logo64.png')

const ballStyle = computed<CSSProperties>(() => {
    const showBall = !iframeShow.value
    return {
        left: `${position.value.x}px`,
        top: `${position.value.y}px`,
        opacity: showBall ? (isHovering.value || isDragging.value ? 1 : settings.value.opacity / 100) : 0,
        transform: showBall ? (isHovering.value ? 'scale(1.1)' : 'scale(1)') : 'scale(0)',
        cursor: isDragging.value ? 'grabbing' : 'pointer',
        pointerEvents: showBall ? 'auto' : 'none'
    }
})

const overlayStyle = computed<CSSProperties>(() => ({
    position: 'fixed',
    inset: '0',
    background: 'rgba(0,0,0,0.32)',
    backdropFilter: 'blur(2px)',
    zIndex: 2147483646,
    opacity: iframeShow.value ? 1 : 0,
    pointerEvents: iframeShow.value ? 'auto' : 'none',
    transition: 'opacity 0.3s ease-in-out'
}))

const iframeStyle = computed<CSSProperties>(() => ({
    position: 'fixed',
    width: 'min(650px)',
    height: '100%',
    top: 0,
    right: iframeShow.value ? '0' : '-900px',
    border: 'none',
    boxShadow: '-4px 0 16px rgba(0,0,0,0.15)',
    zIndex: 2147483647,
    transition: 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    background: 'transparent',
    pointerEvents: iframeShow.value ? 'auto' : 'none'
}))

// Methods
const onClick = async () => {
    if (isDragging.value) return

    if (settings.value.mode === 'native') {
        try {
            const res = await browser.runtime.sendMessage({ type: 'TOGGLE_SIDE_PANEL' }) as any
            if (res && typeof res === 'object' && res.success === false) {
                if (res.error === 'API not supported') {
                    alert(t('home.sidebar.nativeNotSupported'))
                }
                if (!iframeSrc.value) iframeSrc.value = browser.runtime.getURL('index.html')
                iframeShow.value = true
            }
        } catch (err) {
            console.error('GioPic: Failed to open native sidebar message', err)
            if (!iframeSrc.value) iframeSrc.value = browser.runtime.getURL('index.html')
            iframeShow.value = true
        }
        return
    }

    if (!iframeSrc.value) iframeSrc.value = browser.runtime.getURL('index.html')
    iframeShow.value = true
}

const hideIframe = () => {
    iframeShow.value = false
}

const toggleUploadList = async () => {
    const res = await browser.storage.local.get('giopic-show-upload-list')
    const current = !!res['giopic-show-upload-list']
    await browser.storage.local.set({ 'giopic-show-upload-list': !current })
}

const handleConfirmClose = async () => {
    try {
        if (closeOption.value === 'close') {
            isPageClosed.value = true
            return
        } else if (closeOption.value === 'session') {
            try {
                sessionStorage.setItem('giopic-sidebar-session-closed', 'true')
            } catch (e) {
                console.warn('GioPic: SessionStorage access blocked', e)
            }
            isSessionClosed.value = true
        } else if (closeOption.value === 'site') {
            const hostname = window.location.hostname
            // Check if not already disabled
            const isDisabled = disabledSites.value.some(site => site === hostname)
            
            if (!isDisabled) {
                // create new array ref to ensure reactivity triggers
                const newSites = [...disabledSites.value, hostname]
                disabledSites.value = newSites
                // save plain array
                await browser.storage.local.set({ sidebar_disabled_sites: newSites })

                // Ensure siteEditorConfig has an entry to prevent auto-deletion when re-enabling
                const res = await browser.storage.local.get('siteEditorConfig')
                const config = (res.siteEditorConfig || {}) as Record<string, string>
                if (!config[hostname]) {
                    config[hostname] = ""
                    await browser.storage.local.set({ siteEditorConfig: config })
                }
            }
        } else if (closeOption.value === 'permanent') {
            settings.value.enabled = false
            // save plain object
            await browser.storage.local.set({ sidebarSettings: JSON.parse(JSON.stringify(settings.value)) })
        }
    } catch (error) {
        console.error('GioPic: Close sidebar error', error)
    } finally {
        showCloseDialog.value = false
    }
}

const updateDialogPosition = async () => {
    if (!ballRef.value) return

    // Reset style first to ensure correct dimension calculation if needed, 
    // though here we mainly need dimensions which are fixed by CSS mostly.

    await nextTick()
    const dialogEl = dialogRef.value
    if (!dialogEl) return

    const ballRect = ballRef.value.getBoundingClientRect()
    const dialogRect = dialogEl.getBoundingClientRect()
    const margin = 12

    const { innerWidth, innerHeight } = window

    // Potential positions
    const positions = [
        // Right
        { left: ballRect.right + margin, top: ballRect.top },
        // Left
        { left: ballRect.left - dialogRect.width - margin, top: ballRect.top },
        // Bottom
        { left: ballRect.left, top: ballRect.bottom + margin },
        // Top
        { left: ballRect.left, top: ballRect.top - dialogRect.height - margin }
    ]

    // Check which fits (simple check: fully inside viewport)
    let bestPos = null

    for (const pos of positions) {
        if (
            pos.left >= 0 &&
            pos.top >= 0 &&
            pos.left + dialogRect.width <= innerWidth &&
            pos.top + dialogRect.height <= innerHeight
        ) {
            bestPos = pos
            break
        }
    }

    // If no position fits perfectly, try to keep it on screen or center it
    if (bestPos) {
        dialogStyle.value = {
            left: `${bestPos.left}px`,
            top: `${bestPos.top}px`,
            transform: 'none',
            position: 'fixed'
        }
    } else {
        // Center on screen as fallback
        dialogStyle.value = {
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            position: 'fixed'
        }
    }
}

// Watchers
watch(showCloseDialog, (val) => {
    if (val) {
        updateDialogPosition()
    }
})

watch(isVisible, (val) => {
    if (!val) {
        showCloseDialog.value = false
    }
})

// Watchers
watch(isDragging, async (dragging) => {
    if (!dragging) {
        settings.value.position = position.value
        await browser.storage.local.set({ sidebarSettings: settings.value })
    }
})

// Lifecycle
onMounted(async () => {
    // 1. Migration
    const oldStorage = await browser.storage.local.get(['uploadArea', 'sidebarSettings', 'sidebar_disabled_sites']) as {
        uploadArea?: LegacyUploadArea
        sidebarSettings?: SidebarSettings
        sidebar_disabled_sites?: string[]
    }

    if (oldStorage.uploadArea && !oldStorage.sidebarSettings) {
        // Migrate
        const old = oldStorage.uploadArea
        settings.value = {
            enabled: old.status !== false, // Default true
            mode: 'inject',
            position: {
                x: old.position === 'Left' ? 20 : window.innerWidth - 60,
                y: ((old.location || 40) / 100) * window.innerHeight
            },
            opacity: old.opacity || 80
        }
        await browser.storage.local.set({ sidebarSettings: settings.value })
        await browser.storage.local.remove('uploadArea')
    } else if (oldStorage.sidebarSettings) {
        settings.value = {
            ...oldStorage.sidebarSettings,
            mode: oldStorage.sidebarSettings.mode || 'inject'
        }
        // Sync position ref immediately
        position.value = settings.value.position

        // Ensure position is valid after render
        nextTick(() => {
            // 如果加载的位置超出当前屏幕，手动触发一次边界校正
            // 由于 useDraggable 内部已做越界处理，仅需触发一次微小位移即可
            const { innerWidth, innerHeight } = window
            const { x, y } = position.value
            // 水平方向：若超出右边界，则贴右；若超出左边界，则贴左
            const clampedX = Math.max(0, Math.min(x, innerWidth - 44))
            // 垂直方向：若超出下边界，则贴底；若超出上边界，则贴顶
            const clampedY = Math.max(0, Math.min(y, innerHeight - 44))
            // 只有真正越界时才更新，避免无意义刷新
            if (clampedX !== x || clampedY !== y) {
              position.value = { x: clampedX, y: clampedY }
            }
        })
    }

    disabledSites.value = Array.isArray(oldStorage.sidebar_disabled_sites) ? oldStorage.sidebar_disabled_sites : []

    // Check session
    if (sessionStorage.getItem('giopic-sidebar-session-closed')) {
        isSessionClosed.value = true
    }

    // Sync locale
    const storedLocale = await browser.storage.local.get('giopic-locale')
    if (storedLocale['giopic-locale']) {
        locale.value = storedLocale['giopic-locale'] as 'zh-CN' | 'en-US'
    }

    // Listen for changes
    browser.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
            if (changes['giopic-locale']) {
                locale.value = changes['giopic-locale'].newValue as 'zh-CN' | 'en-US'
            }
            if (changes.sidebarSettings) {
                const next = changes.sidebarSettings.newValue as SidebarSettings | undefined
                if (next && typeof next === 'object') {
                    settings.value = next
                }
                // Only update position if difference is large (to avoid loop with drag)
                const newPos = settings.value.position
                if (Math.abs(newPos.x - position.value.x) > 5 || Math.abs(newPos.y - position.value.y) > 5) {
                    position.value = newPos
                }
            }
            if (changes.sidebar_disabled_sites) {
                const next = changes.sidebar_disabled_sites.newValue as unknown
                disabledSites.value = Array.isArray(next) ? (next as string[]) : []
            }
        }
    })
})

</script>

<style scoped>
.giopic-floating-ball {
    position: fixed;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease, opacity 0.2s ease;
    user-select: none;
    border: 1px solid rgba(0, 0, 0, 0.05);
}

:global(.dark) .giopic-floating-ball {
    background: rgba(31, 41, 55, 0.9);
    border-color: rgba(255, 255, 255, 0.1);
}

.giopic-ball-content {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border-radius: 50%;
}

.giopic-logo {
    width: 24px;
    height: 24px;
    object-fit: contain;
    pointer-events: none;
}

.giopic-close-btn {
    position: absolute;
    top: -34px;
    left: 50%;
    transform: translateX(-50%);
    width: 28px;
    height: 28px;
    background: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    z-index: -1;
    opacity: 0;
    border: 1px solid rgba(0, 0, 0, 0.05);
}

:global(.dark) .giopic-close-btn {
    background: rgba(31, 41, 55, 0.9);
    border-color: rgba(255, 255, 255, 0.1);
}

/* Fill the gap to prevent mouseleave */
.giopic-close-btn::after {
    content: '';
    position: absolute;
    bottom: -10px;
    left: 0;
    width: 100%;
    height: 10px;
}

.giopic-floating-ball:hover .giopic-close-btn {
    top: -36px;
    opacity: 1;
    z-index: 10;
}

.giopic-close-btn:hover {
    transform: translateX(-50%) scale(1.15);
    background: #fee2e2;
}

:global(.dark) .giopic-close-btn:hover {
    background: rgba(239, 68, 68, 0.2);
}

.giopic-uploadList-btn {
    position: absolute;
    bottom: -34px;
    left: 50%;
    transform: translateX(-50%);
    width: 28px;
    height: 28px;
    background: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    z-index: -1;
    opacity: 0;
    border: 1px solid rgba(0, 0, 0, 0.05);
}

:global(.dark) .giopic-uploadList-btn {
    background: rgba(31, 41, 55, 0.9);
    border-color: rgba(255, 255, 255, 0.1);
}

/* Fill the gap to prevent mouseleave */
.giopic-uploadList-btn::after {
    content: '';
    position: absolute;
    top: -10px;
    left: 0;
    width: 100%;
    height: 10px;
}

.giopic-floating-ball:hover .giopic-uploadList-btn {
    bottom: -36px;
    opacity: 1;
    z-index: 10;
}

.giopic-uploadList-btn:hover {
    transform: translateX(-50%) scale(1.15);
    background: #dbeafe;
}

:global(.dark) .giopic-uploadList-btn:hover {
    background: rgba(59, 130, 246, 0.2);
}

/* Dialog Styles */
.giopic-dialog-overlay {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    background: transparent;
}

.giopic-dialog {
    position: fixed;
    background: white;
    border-radius: 16px;
    padding: 20px;
    width: 320px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    font-family: system-ui, -apple-system, sans-serif;
    border: 1px solid rgba(0, 0, 0, 0.05);
}

:global(.dark) .giopic-dialog {
    background: #1f2937;
    color: #f3f4f6;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.giopic-dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    font-size: 16px;
}

.giopic-dialog-close {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
}

.giopic-dialog-close:hover {
    background: rgba(0, 0, 0, 0.05);
}

.radio-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.radio-item {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    padding: 8px 12px;
    border-radius: 8px;
    transition: background 0.1s;
    font-size: 14px;
}

.radio-item:hover {
    background: #f3f4f6;
}

:global(.dark) .radio-item:hover {
    background: #374151;
}

.radio-item input {
    accent-color: #ec4899;
    /* Pink accent */
}

.giopic-dialog-footer {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

.btn-cancel,
.btn-confirm {
    padding: 6px 16px;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.2s;
}

.btn-cancel {
    background: transparent;
    border-color: #e5e7eb;
    color: #6b7280;
}

.btn-cancel:hover {
    border-color: #d1d5db;
    color: #374151;
}

:global(.dark) .btn-cancel {
    border-color: #4b5563;
    color: #9ca3af;
}

:global(.dark) .btn-cancel:hover {
    border-color: #6b7280;
    color: #e5e7eb;
}

.btn-confirm {
    background: #ec4899;
    color: white;
}

.btn-confirm:hover {
    background: #db2777;
}

.giopic-web-overlay {
    pointer-events: auto;
}
</style>
