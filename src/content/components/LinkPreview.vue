<!--
 * @file LinkPreview.vue
 * @description 链接悬浮预览组件
 * 
 * 职责：
 * 1. 监听鼠标悬停事件，检测图片链接
 * 2. 悬浮显示图片预览
 * 3. 提供快捷键 (Shift+X) 打开设置弹窗
 * 4. 管理站点级/会话级/临时的禁用状态
-->

<template>
  <div class="giopic-link-preview-container">
    <!-- 预览框 -->
    <div 
      v-if="currentUrl && isVisible" 
      ref="previewRef"
      class="giopic-link-preview"
      :style="previewStyle"
    >
      <img 
        v-if="realUrl"
        :src="realUrl" 
        :style="imgStyle"
        @load="onImgLoad" 
        @error="onImgError"
      />
      <div class="giopic-preview-hint">{{ t('preview.hint') }}</div>
    </div>

    <!-- 关闭确认弹窗 -->
    <div v-if="showDialog" class="giopic-preview-dialog-overlay" @click.self="closeDialog">
      <div class="giopic-preview-dialog-card">
        <h3 class="giopic-dialog-title">{{ t('preview.title') }}</h3>
        
        <form class="giopic-dialog-form">
          <label v-for="opt in options" :key="opt.id" class="giopic-radio-label">
            <input 
              type="radio" 
              name="closeOption" 
              :value="opt.id" 
              v-model="selectedOption"
            >
            <span>{{ opt.label }}</span>
          </label>
        </form>

        <div class="giopic-dialog-actions">
          <button class="giopic-btn-cancel" @click="closeDialog">{{ t('preview.cancel') }}</button>
          <button class="giopic-btn-confirm" @click="confirmClose">{{ t('preview.confirm') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import browser from 'webextension-polyfill'

// --- 常量与配置 ---
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico']
const MAX_CACHE_SIZE = 1000
const DETECT_THROTTLE_MS = 100
const PREVIEW_OFFSET = 15

// --- 状态定义 ---
const currentUrl = ref<string | null>(null)
const realUrl = ref<string>('')
const isVisible = ref(false)
const showDialog = ref(false)
const selectedOption = ref('close')
const previewPosition = ref({ x: 0, y: 0 })
const imgLoaded = ref(false)

// 禁用状态
const enabled = ref(true)
const isTempDisabled = ref(false)
const isSessionDisabled = ref(false)
const globalEnabled = ref(true)
const disabledSites = ref<string[]>([])

// 缓存
const urlCache = new Map<string, string>()
const viewport = ref({ width: window.innerWidth, height: window.innerHeight })

// --- 计算属性 ---
const previewStyle = computed(() => ({
  left: `${previewPosition.value.x}px`,
  top: `${previewPosition.value.y}px`,
  opacity: isVisible.value && imgLoaded.value ? 1 : 0,
  display: isVisible.value ? 'block' : 'none'
}))

const imgStyle = computed(() => ({
  width: 'auto',
  height: 'auto',
  maxWidth: '60vw',
  maxHeight: '60vh',
  display: 'block',
  borderRadius: '4px'
}))

const { t } = useI18n()


const options = computed(() => [
  { id: 'close', label: t('preview.close') },
  { id: 'session', label: t('preview.session') },
  { id: 'site', label: t('preview.site') },
  { id: 'permanent', label: t('preview.permanent') },
])

// --- 核心逻辑 ---

/**
 * 获取真实图片链接
 * 处理 URL 编码、参数干扰，提取最可能的图片地址
 * 
 * @param url - 原始 URL
 * @returns 解析后的图片 URL
 */
function getRealUrl(url: string): string {
  if (urlCache.has(url)) return urlCache.get(url)!

  let decodedUrl = url
  try {
    let retries = 3
    while (decodedUrl.includes('%') && retries > 0) {
      try {
        const temp = decodeURIComponent(decodedUrl)
        if (temp === decodedUrl) break
        decodedUrl = temp
      } catch { break }
      retries--
    }

    const lowerUrl = decodedUrl.toLowerCase()
    let maxHttpIndex = -1
    let bestCandidate = ''

    IMAGE_EXTENSIONS.forEach(ext => {
      let pos = lowerUrl.indexOf(ext)
      while (pos !== -1) {
        const endIndex = pos + ext.length
        const before = decodedUrl.substring(0, pos)
        const httpIdx = Math.max(before.lastIndexOf('http://'), before.lastIndexOf('https://'))
        
        if (httpIdx !== -1 && httpIdx > maxHttpIndex) {
          maxHttpIndex = httpIdx
          bestCandidate = decodedUrl.substring(httpIdx, endIndex)
        }
        pos = lowerUrl.indexOf(ext, pos + 1)
      }
    })
    
    const result = bestCandidate || url
    if (urlCache.size >= MAX_CACHE_SIZE) urlCache.clear()
    urlCache.set(url, result)
    return result
  } catch (e) {
    console.error('URL解析出错:', e)
    return url
  }
}

/**
 * 检查是否为图片 URL
 * 
 * @param url - 待检查 URL
 * @returns 是否为支持的图片格式
 */
function isImageUrl(url: string): boolean {
  if (!url) return false
  try {
    const rUrl = getRealUrl(url)
    const urlObj = new URL(rUrl, window.location.href)
    const pathname = urlObj.pathname.toLowerCase()
    return IMAGE_EXTENSIONS.some(ext => pathname.endsWith(ext))
  } catch {
    return false
  }
}

/**
 * 获取指定坐标处的文本 URL
 * 用于识别非链接标签中的文本 URL
 * 
 * @param x - X 坐标
 * @param y - Y 坐标
 * @returns 提取到的 URL 或 null
 */
function getTextUrlAtPosition(x: number, y: number): string | null {
  const MAX_SCAN_LENGTH = 500
  let range: Range | null = null
  let textNode: Node | null = null
  let offset = 0

  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(x, y)
    if (range) {
      textNode = range.startContainer
      offset = range.startOffset
    }
  } else if ((document as any).caretPositionFromPoint) {
    const pos = (document as any).caretPositionFromPoint(x, y)
    if (pos) {
      textNode = pos.offsetNode
      offset = pos.offset
    }
  }

  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return null

  const text = textNode.textContent || ''
  let start = offset
  let scanned = 0
  while (start > 0 && !/\s/.test(text[start - 1] || '') && scanned < MAX_SCAN_LENGTH) {
    start--
    scanned++
  }
  
  let end = offset
  scanned = 0
  while (end < text.length && !/\s/.test(text[end] || '') && scanned < MAX_SCAN_LENGTH) {
    end++
    scanned++
  }

  const candidate = text.substring(start, end)
  if (candidate.length < 10 || !candidate.toLowerCase().startsWith('http')) return null
  return candidate
}

/**
 * 检查功能是否启用
 * 综合考虑全局开关、临时禁用、会话禁用和站点禁用配置
 */
function checkEnabled() {
  const shouldEnable = globalEnabled.value
  if (isTempDisabled.value || isSessionDisabled.value) {
    enabled.value = false
    showDialog.value = false
    hidePreview()
    return
  }

  try {
    if (sessionStorage.getItem('giopic-preview-session-disabled')) {
      isSessionDisabled.value = true
      enabled.value = false
      showDialog.value = false
      hidePreview()
      return
    }
  } catch (e) {}

  // 检查站点禁用
  const currentHostname = window.location.hostname.toLowerCase()
  const currentHref = window.location.href.toLowerCase()
  
  const isSiteDisabled = disabledSites.value.some(site => {
      const normalize = (s: string) => s.trim().replace(/\/+$/, '').toLowerCase();
      const siteNorm = normalize(site);
      const currentNorm = normalize(currentHref); // using href for full url match support if needed, but mostly hostname logic
      const hostnameNorm = currentHostname;

      if (siteNorm === hostnameNorm) return true;

      if (site.includes('://') || site.includes('/')) {
          if (site.includes('://')) {
              return currentNorm.startsWith(siteNorm);
          }
          const currentNoProto = currentNorm.replace(/^https?:\/\//, '');
          return currentNoProto.startsWith(siteNorm);
      }
      return false;
  });

  enabled.value = shouldEnable && !isSiteDisabled
  if (!enabled.value) {
    showDialog.value = false
    hidePreview()
  }
}

// 显示/隐藏逻辑
let hideTimeout: any = null
let loadTimeout: any = null

/**
 * 显示预览窗口
 * 
 * @param url - 图片 URL
 * @param x - 鼠标 X 坐标
 * @param y - 鼠标 Y 坐标
 */
function showPreview(url: string, x: number, y: number) {
  if (hideTimeout) clearTimeout(hideTimeout)
  
  const rUrl = getRealUrl(url)
  realUrl.value = rUrl
  currentUrl.value = url
  isVisible.value = true
  imgLoaded.value = false
  
  // 立即更新位置
  updatePosition(x, y)

  // 超时检测
  if (loadTimeout) clearTimeout(loadTimeout)
  loadTimeout = setTimeout(() => {
    if (!imgLoaded.value) {
      // 超时未加载完成，隐藏
      isVisible.value = false
      currentUrl.value = null
    }
  }, 10000)
}

function hidePreview() {
  if (hideTimeout) clearTimeout(hideTimeout)
  hideTimeout = setTimeout(() => {
    isVisible.value = false
    currentUrl.value = null
    realUrl.value = ''
    imgLoaded.value = false
  }, 100)
}

const previewRef = ref<HTMLElement | null>(null)

/**
 * 更新预览窗口位置
 * 确保窗口不超出视口边界
 * 
 * @param x - 目标 X 坐标
 * @param y - 目标 Y 坐标
 */
function updatePosition(x: number, y: number) {
  const el = previewRef.value
  // 如果没有 ref，使用默认尺寸估计
  const width = el ? el.offsetWidth : 200 
  const height = el ? el.offsetHeight : 200
  
  let left = x + PREVIEW_OFFSET
  let top = y + PREVIEW_OFFSET

  if (left + width > viewport.value.width) {
    left = x - width - PREVIEW_OFFSET
  }
  
  if (top + height > viewport.value.height) {
    top = y - height - PREVIEW_OFFSET
  }
  
  if (left < 0) left = 0
  if (top < 0) top = 0

  previewPosition.value = { x: left, y: top }
}

function onImgLoad() {
  if (loadTimeout) clearTimeout(loadTimeout)
  imgLoaded.value = true
  // 图片加载后尺寸变化，需要更新位置
  // 这里我们无法获取触发时的鼠标位置，只能依赖后续的 RAF 更新
}

function onImgError() {
  isVisible.value = false
}

// 事件监听
let rafId: number | null = null
let lastDetectTime = 0

/**
 * 鼠标移动事件处理
 * 负责检测鼠标下方的 URL 并触发预览
 */
function onMouseMove(e: MouseEvent) {
  if (!enabled.value) return

  const clientX = e.clientX
  const clientY = e.clientY

  // 1. 位置更新 (RAF)
  if (isVisible.value && currentUrl.value) {
    if (!rafId) {
      rafId = requestAnimationFrame(() => {
        updatePosition(clientX, clientY)
        rafId = null
      })
    }
  }

  // 2. 目标检测 (节流)
  const now = Date.now()
  if (now - lastDetectTime < DETECT_THROTTLE_MS) return
  lastDetectTime = now

  // Ctrl 禁用
  if (e.ctrlKey || e.metaKey) {
    if (currentUrl.value) hidePreview()
    return
  }

  const target = e.target as HTMLElement
  let newUrl: string | null = null

  // 检查 <a>
  const anchor = target.closest('a')
  if (anchor instanceof HTMLAnchorElement) {
    // 排除包含图片的链接（避免在缩略图上重复显示预览）
    if (!anchor.querySelector('img') && isImageUrl(anchor.href)) {
      newUrl = anchor.href
    }
  }

  // 检查文本
  if (!newUrl) {
    const textUrl = getTextUrlAtPosition(clientX, clientY)
    if (textUrl && isImageUrl(textUrl)) {
      newUrl = textUrl
    }
  }

  if (newUrl) {
    if (newUrl !== currentUrl.value) {
      showPreview(newUrl, clientX, clientY)
    }
  } else {
    if (currentUrl.value) {
      hidePreview()
    }
  }
}

/**
 * 键盘事件处理
 * 监听 Shift+X 呼出设置弹窗
 */
function onKeyDown(e: KeyboardEvent) {
  if (e.shiftKey && e.code === 'KeyX') {
    if (currentUrl.value && isVisible.value) {
      showDialog.value = true
      e.preventDefault()
    }
  }
}

function onResize() {
  viewport.value = { width: window.innerWidth, height: window.innerHeight }
}

// 弹窗逻辑
function closeDialog() {
  showDialog.value = false
}

/**
 * 确认关闭/禁用选项
 * 根据用户选择执行临时禁用、会话禁用或站点禁用
 */
async function confirmClose() {
  const option = selectedOption.value
  if (option === 'close') {
    isTempDisabled.value = true
  } else if (option === 'session') {
    try {
      sessionStorage.setItem('giopic-preview-session-disabled', 'true')
    } catch (e) {}
    isSessionDisabled.value = true
  } else if (option === 'site') {
    // 更新 storage
    const hostname = window.location.hostname
    const newDisabledSites = [...disabledSites.value]
    if (!newDisabledSites.includes(hostname)) {
      newDisabledSites.push(hostname)
      
      // 确保 siteEditorConfig 有一个空字符串项，防止数据丢失
      const configRes = await browser.storage.local.get('siteEditorConfig')
      const config = (configRes.siteEditorConfig || {}) as Record<string, string>
      let shouldUpdateConfig = false
      if (!config[hostname]) {
        config[hostname] = ""
        shouldUpdateConfig = true
      }
      
      const updates: any = { preview_disabled_sites: newDisabledSites }
      if (shouldUpdateConfig) {
        updates.siteEditorConfig = config
      }
      
      await browser.storage.local.set(updates)
    }
  } else if (option === 'permanent') {
    // 永久禁用
    await browser.storage.local.set({ 'giopic-hover-preview': false })
    globalEnabled.value = false
  }
  
  checkEnabled()
  hidePreview()
  closeDialog()
}

// 生命周期
onMounted(async () => {
  // 初始化配置
  const res = await browser.storage.local.get(['giopic-hover-preview', 'preview_disabled_sites'])
  globalEnabled.value = res['giopic-hover-preview'] !== false
  const rawDisabled = res['preview_disabled_sites']
  disabledSites.value = (Array.isArray(rawDisabled) ? rawDisabled : []) as string[]
  checkEnabled()

  // 监听 storage
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes['giopic-hover-preview']) {
        globalEnabled.value = changes['giopic-hover-preview'].newValue !== false
        checkEnabled()
      }
      if (changes['preview_disabled_sites']) {
        const next = changes['preview_disabled_sites'].newValue
        disabledSites.value = (Array.isArray(next) ? next : []) as string[]
        checkEnabled()
      }
    }
  })

  document.addEventListener('mousemove', onMouseMove, { passive: true })
  document.addEventListener('keydown', onKeyDown)
  window.addEventListener('resize', onResize, { passive: true })
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('resize', onResize)
})
</script>

<style scoped>
.giopic-link-preview-container {
  pointer-events: none; /* 容器本身不阻挡 */
}

.giopic-link-preview {
  position: fixed;
  z-index: 2147483647;
  pointer-events: none;
  background-color: rgba(0, 0, 0, 0);
  padding: 4px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: opacity 0.2s ease;
  backdrop-filter: blur(4px);
  /* Reset */
  box-sizing: content-box;
  line-height: 0;
  margin: 0;
  border: none;
  outline: none;
}

.giopic-preview-hint {
  position: absolute;
  bottom: -24px;
  left: 0;
  width: 100%;
  text-align: center;
  color: rgba(255, 255, 255, 0.9);
  font-size: 12px;
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
  pointer-events: none;
  white-space: nowrap;
  font-family: system-ui, sans-serif;
  line-height: normal;
}

/* Dialog Styles */
.giopic-preview-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(2px);
  font-family: system-ui, sans-serif;
  pointer-events: auto; /* 弹窗需要交互 */
}

.giopic-preview-dialog-card {
  background-color: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.1);
  width: 300px;
  max-width: 90vw;
  color: #1f2937;
}

@media (prefers-color-scheme: dark) {
  .giopic-preview-dialog-card {
    background-color: #1f2937;
    color: #f3f4f6;
  }
}

.giopic-dialog-title {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
}

.giopic-radio-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  cursor: pointer;
  font-size: 14px;
}

.giopic-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.giopic-btn-cancel {
  padding: 6px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  color: inherit;
}

.giopic-btn-confirm {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  background: #3b82f6;
  color: white;
  cursor: pointer;
}
</style>
