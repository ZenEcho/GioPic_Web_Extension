<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { toRefs, ref, computed } from 'vue'
import { useImageEditor } from '@/composables/useImageEditor'
import { useThemeStore } from '@/stores/theme'

const { t } = useI18n()
const themeStore = useThemeStore()

const props = defineProps<{
  visible: boolean
  file: File
  preview: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', payload: { file: File; preview: string }): void
}>()

// Use the composable
const {
  canvasRef,
  containerRef,
  isLoading,
  isSaving,
  rotation,
  flipH,
  flipV,
  scale,
  brightness,
  contrast,
  saturate,
  activeFilter,
  activeTool,
  selectedId,
  brushColor,
  brushSize,
  brushOpacity,
  brushPressure,
  shapeType,
  shapeStrokeColor,
  shapeStrokeWidth,
  shapeFillColor,
  shapeFillOpacity,
  shapeStrokePattern,
  arrowColor,
  arrowWidth,
  arrowDirection,
  arrowPattern,
  arrowHeadSize,
  arrowStyle,
  textInput,
  textColor,
  textFontSize,
  textFontFamily,
  textBold,
  textItalic,
  textAlign,
  textStyle,
  textSecondaryColor,
  textLetterSpacing,
  selectedIds,
  mosaicMode,
  mosaicShape,
  mosaicPixelSize,
  numberStart,
  numberValue,
  numberColor,
  numberSize,
  uiPanel,
  isCropping,
  cropRect,
  // New State
  viewZoom,
  viewOffset,
  isPanning,
  isSpacePressed,
  displayInfo,
  isTextEditing,
  editingText,
  editingTool,
  // Computed
  canUndo,
  canRedo,
  isEdited,
  dimensionText,
  annotations,
  // Constants
  toolList,
  filterPresets,
  TEXT_FONT_OPTIONS,
  // Methods
  undo,
  redo,
  removeSelected,
  resetAdjustments,
  resetAll,
  restoreOriginal,
  saveEdit,
  rotateLeft,
  rotateRight,
  toggleFlipH,
  toggleFlipV,
  onCanvasPointerDown,
  onCanvasPointerMove,
  onCanvasPointerUp,

  changeLayer,
  startCrop,
  cancelCrop,
  applyCrop,
  reorderAnnotations,
  onCanvasWheel,
  confirmTextEdit,
  zoomIn,
  zoomOut,
  setZoom,
  groupSelected,
  ungroupSelected,
  renameAnnotation,
  getAnnotationLabel,
} = useImageEditor(props, emit)

const renamingId = ref<string | null>(null)
const renamingValue = ref('')

function startRename(item: any) {
  renamingId.value = item.id
  renamingValue.value = getAnnotationLabel(item)
}

function finishRename() {
  if (renamingId.value && renamingValue.value.trim()) {
    renameAnnotation(renamingId.value, renamingValue.value.trim())
  }
  renamingId.value = null
}

const isGroupSelected = computed(() => {
  if (selectedIds.value.size !== 1) return false
  const id = Array.from(selectedIds.value)[0]
  return annotations.value.find(a => a.id === id)?.kind === 'group'
})

function onLayerItemClick(event: MouseEvent, id: string) {
  if (event.shiftKey) {
    const allIds = annotations.value.map(a => a.id).reverse() // Match display order
    const lastId = Array.from(selectedIds.value).pop()
    if (lastId) {
      const startIdx = allIds.indexOf(lastId)
      const endIdx = allIds.indexOf(id)
      const range = allIds.slice(Math.min(startIdx, endIdx), Math.max(startIdx, endIdx) + 1)
      range.forEach(rid => selectedIds.value.add(rid))
    } else {
      selectedIds.value.add(id)
    }
  } else if (event.ctrlKey || event.metaKey) {
    if (selectedIds.value.has(id)) selectedIds.value.delete(id)
    else selectedIds.value.add(id)
  } else {
    selectedIds.value.clear()
    selectedIds.value.add(id)
  }
}

// Drop target for drag and drop
const dragOverIndex = ref(-1)

function onDragStart(event: DragEvent, index: number) {
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', index.toString())
  }
}

function onDragOver(event: DragEvent, index: number) {
  event.preventDefault() // Necessary to allow dropping
  dragOverIndex.value = index
}

function onDrop(event: DragEvent, dropIndex: number) {
  dragOverIndex.value = -1
  const fromIndex = parseInt(event.dataTransfer?.getData('text/plain') || '-1')
  if (fromIndex >= 0 && fromIndex !== dropIndex) {
    reorderAnnotations(fromIndex, dropIndex)
  }
}

// Popup target for detached elements ensuring they share theme context
const rootRef = ref<string>('#image-editor-root')

function handleToolClick(toolId: string) {
  if (toolId === 'crop') {
    if (isCropping.value) {
      cancelCrop()
    } else {
      startCrop()
    }
    return
  }

  if (isCropping.value) {
    cancelCrop()
  }

  // @ts-ignore
  activeTool.value = toolId
  uiPanel.value = 'tool'
  selectedId.value = null
  isConfigPanelOpen.value = true
}

// Options
const shapeOptions = computed(() => [
  { label: t('imageEditor.options.rect'), value: 'rect' },
  { label: t('imageEditor.options.ellipse'), value: 'ellipse' },
  { label: t('imageEditor.options.line'), value: 'line' }
])

const strokePatternOptions = computed(() => [
  { label: t('imageEditor.options.solid'), value: 'solid' },
  { label: t('imageEditor.options.dashed'), value: 'dashed' }
])

const arrowDirectionOptions = computed(() => [
  { label: t('imageEditor.options.single'), value: 'single' },
  { label: t('imageEditor.options.double'), value: 'double' }
])

const arrowStyleOptions = computed(() => [
  { label: t('imageEditor.options.classic'), value: 'classic' },
  { label: t('imageEditor.options.modern'), value: 'modern' },
  { label: t('imageEditor.options.bold'), value: 'bold' },
  { label: t('imageEditor.options.tapered'), value: 'tapered' }
])

const textAlignOptions = computed(() => [
  { label: t('imageEditor.options.left'), value: 'left', icon: 'i-ph-text-align-left' },
  { label: t('imageEditor.options.center'), value: 'center', icon: 'i-ph-text-align-center' },
  { label: t('imageEditor.options.right'), value: 'right', icon: 'i-ph-text-align-right' }
])

const textStyleOptions = computed(() => [
  { label: t('imageEditor.styles.fill'), value: 'fill' },
  { label: t('imageEditor.styles.stroke'), value: 'stroke' },
  { label: t('imageEditor.styles.shadow'), value: 'shadow' },
  { label: t('imageEditor.styles.background'), value: 'background' }
])

const mosaicModeOptions = computed(() => [
  { label: t('imageEditor.options.brush'), value: 'brush' },
  { label: t('imageEditor.options.area'), value: 'area' }
])

const mosaicShapeOptions = computed(() => [
  { label: t('imageEditor.options.rect'), value: 'rect' },
  { label: t('imageEditor.options.circle'), value: 'circle' }
])

const fontOptions = computed(() => TEXT_FONT_OPTIONS.map(f => ({ label: f, value: f })))

// Navigator Logic
const navigatorBody = ref<HTMLDivElement | null>(null)
const isNavigatorDragging = ref(false)
const isConfigPanelOpen = ref(false)
const isDesktop = computed(() => window.innerWidth >= 768) // Simple check, or use useBreakpoints

const navigatorAspectRatio = computed(() => {
  if (!displayInfo.value.canvasW || !displayInfo.value.canvasH) return 16 / 9
  return displayInfo.value.canvasW / displayInfo.value.canvasH
})

const navigatorRectStyle = computed(() => {
  const { canvasW, canvasH, viewportW, viewportH } = displayInfo.value
  const zoom = viewZoom.value
  const offset = viewOffset.value

  // Calculate center of viewport in content space (relative 0..1)
  // Screen Center (viewportW/2) corresponds to Content Center (canvasW/2) minus offset/zoom
  // Viewport Left in Content Space = Center - (ViewportW/2)/Zoom
  // x_left = (canvasW/2 - offset.x/zoom) - (viewportW/2/zoom)
  //        = canvasW/2 - (offset.x + viewportW/2)/zoom

  const x = canvasW / 2 - (viewportW / 2 + offset.x) / zoom
  const y = canvasH / 2 - (viewportH / 2 + offset.y) / zoom

  // Convert to percentage
  const leftPct = (x / canvasW) * 100
  const topPct = (y / canvasH) * 100
  const widthPct = (viewportW / zoom / canvasW) * 100
  const heightPct = (viewportH / zoom / canvasH) * 100

  return {
    left: `${Math.max(0, Math.min(100, leftPct))}%`,
    top: `${Math.max(0, Math.min(100, topPct))}%`,
    width: `${Math.min(100, widthPct)}%`,
    height: `${Math.min(100, heightPct)}%`
  }
})

function handleNavigatorInteract(event: PointerEvent) {
  const el = navigatorBody.value
  if (!el) return

  const rect = el.getBoundingClientRect()
  const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left))
  const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top))

  const pctX = x / rect.width
  const pctY = y / rect.height

  // We want the new Center of Viewport to be at pctX * canvasW
  // offset.x = canvasW * (0.5 - pctX) * zoom

  const { canvasW, canvasH } = displayInfo.value
  const zoom = viewZoom.value

  viewOffset.value = {
    x: canvasW * (0.5 - pctX) * zoom,
    y: canvasH * (0.5 - pctY) * zoom
  }
}

function onNavigatorPointerDown(event: PointerEvent) {
  isNavigatorDragging.value = true
  // @ts-ignore
  event.target?.setPointerCapture?.(event.pointerId)
  handleNavigatorInteract(event)
}

function onNavigatorPointerMove(event: PointerEvent) {
  if (!isNavigatorDragging.value) return
  handleNavigatorInteract(event)
}

function onNavigatorPointerUp(event: PointerEvent) {
  isNavigatorDragging.value = false
  // @ts-ignore
  event.target?.releasePointerCapture?.(event.pointerId)
}

</script>

<template>
  <Teleport to="body">
    <n-config-provider :theme="themeStore.naiveTheme" :theme-overrides="themeStore.themeOverrides" abstract>
      <Transition name="editor-fade">
        <div v-if="visible" id="image-editor-root"
          class="editor-root flex flex-col font-sans text-gray-700 dark:text-gray-200">

          <!-- Header -->
          <header
            class="flex items-center justify-between px-2 md:px-4 py-2 md:py-3 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur shrink-0 transition-colors z-20 overflow-x-auto no-scrollbar">
            <div class="flex items-center gap-2 md:gap-4 shrink-0">
              <n-button quaternary circle size="small" @click="emit('close')">
                <template #icon>
                  <div class="i-ph-x-bold" />
                </template>
              </n-button>
              <div class="h-4 w-px bg-gray-300 dark:bg-gray-700 mx-1" />
              <span class="font-bold text-sm whitespace-nowrap">{{ t('imageEditor.title') }}</span>
              <n-tag v-if="dimensionText" size="small" :bordered="false"
                class="font-mono opacity-75 hidden xs:inline-flex">
                {{ dimensionText }}
              </n-tag>
            </div>

            <div class="flex items-center gap-1 md:gap-2 shrink-0">
              <n-tooltip placement="bottom" :to="rootRef">
                <template #trigger>
                  <n-button quaternary circle size="small" :disabled="!canUndo" @click="undo">
                    <template #icon>
                      <div class="i-ph-arrow-u-up-left" />
                    </template>
                  </n-button>
                </template>
                {{ t('imageEditor.undo') }} (Ctrl+Z)
              </n-tooltip>

              <n-tooltip placement="bottom" :to="rootRef">
                <template #trigger>
                  <n-button quaternary circle size="small" :disabled="!canRedo" @click="redo">
                    <template #icon>
                      <div class="i-ph-arrow-u-up-right" />
                    </template>
                  </n-button>
                </template>
                {{ t('imageEditor.redo') }} (Ctrl+Y)
              </n-tooltip>

              <n-divider vertical class="!mx-1 md:!mx-2" />

              <n-button v-if="isEdited" size="small" type="warning" @click="restoreOriginal" quaternary>
                <template #icon>
                  <div class="i-ph-clock-counter-clockwise-bold" />
                </template>
                <span class="hidden md:inline">{{ t('imageEditor.restore') }}</span>
              </n-button>

              <n-button v-if="isEdited" size="small" @click="resetAdjustments" quaternary>
                <template #icon>
                  <div class="i-ph-arrow-counter-clockwise-bold" />
                </template>
                <span class="hidden md:inline">{{ t('imageEditor.reset') }}</span>
              </n-button>

              <n-button type="primary" size="small" :loading="isSaving" @click="saveEdit"
                class="ml-2 font-bold px-4 md:px-6">
                <template #icon v-if="!isSaving">
                  <div class="i-ph-check-bold" />
                </template>
                <span class="hidden md:inline">{{ isSaving ? t('imageEditor.saving') : t('imageEditor.save') }}</span>
                <span class="md:hidden">{{ isSaving ? '...' : '' }}</span>
                <!-- Saving indicator for mobile if needed, or just rely on icon and disabled state/check -->
                <!-- Actually, let's just keep icon for Save on tiny screens or simplified text? 
                     'Save' is short. 'Saving...' is long.
                -->
                <span class="md:hidden text-xs" v-if="!isSaving">{{ t('imageEditor.save') }}</span>
              </n-button>
            </div>
          </header>

          <div class="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden relative">
            <!-- Sidebar (Tools) -->
            <aside
              class="w-full md:w-20 h-12 md:h-auto border-t md:border-t-0 md:border-r border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex flex-row md:flex-col items-center justify-center md:justify-start px-2 md:px-0 py-1 md:py-4 gap-2 shrink-0 z-10 overflow-x-auto md:overflow-y-auto custom-scrollbar order-2 md:order-1">
              <n-tooltip v-for="tool in toolList" :key="tool.id" placement="right" :to="rootRef">
                <template #trigger>
                  <button
                    class="w-9 h-9 md:w-14 md:h-12 rounded-lg md:rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-200 hover:bg-white dark:hover:bg-gray-800 hover:shadow-sm shrink-0"
                    :class="((activeTool === tool.id && !isCropping) || (tool.id === 'crop' && isCropping)) ? 'bg-primary/10 text-primary ring-1 ring-primary/20' : 'text-gray-500 dark:text-gray-400'"
                    @click="handleToolClick(tool.id)">
                    <div :class="tool.icon" class="text-lg md:text-xl" />
                    <span class="text-[10px] font-medium leading-none hidden md:block">{{ t(tool.labelKey) }}</span>
                  </button>
                </template>
                {{ t(tool.labelKey) }} <span class="opacity-60 text-xs">({{ tool.shortcut }})</span>
              </n-tooltip>

              <div class="w-px h-5 md:h-px md:w-10 bg-gray-200 dark:bg-gray-800 md:my-2 shrink-0" />

              <n-tooltip placement="right" :to="rootRef">
                <template #trigger>
                  <button
                    class="w-9 h-9 md:w-14 md:h-12 rounded-lg md:rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-200 hover:bg-white dark:hover:bg-gray-800 hover:shadow-sm shrink-0"
                    :class="uiPanel === 'base' ? 'bg-primary/10 text-primary ring-1 ring-primary/20' : 'text-gray-500 dark:text-gray-400'"
                    @click="uiPanel = 'base'; isConfigPanelOpen = true">
                    <div class="i-ph-sliders-horizontal text-lg md:text-xl" />
                    <span class="text-[10px] font-medium leading-none hidden md:block">{{ t('imageEditor.adjust')
                    }}</span>
                  </button>
                </template>
                {{ t('imageEditor.adjust') }}
              </n-tooltip>

              <n-tooltip placement="right" :to="rootRef">
                <template #trigger>
                  <button
                    class="w-9 h-9 md:w-14 md:h-12 rounded-lg md:rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-200 hover:bg-white dark:hover:bg-gray-800 hover:shadow-sm shrink-0"
                    :class="uiPanel === 'tool' ? 'bg-primary/10 text-primary ring-1 ring-primary/20' : 'text-gray-500 dark:text-gray-400'"
                    @click="uiPanel = 'tool'; isConfigPanelOpen = true">
                    <div class="i-ph-toolbox text-lg md:text-xl" />
                    <span class="text-[10px] font-medium leading-none hidden md:block">{{ t('imageEditor.toolConfig')
                    }}</span>
                  </button>
                </template>
                {{ t('imageEditor.toolConfig') }}
              </n-tooltip>
            </aside>

            <!-- Main Canvas Area -->
            <div
              class="flex-1 min-w-0 relative bg-gray-100 dark:bg-[#0c0c0e] flex items-center justify-center overflow-hidden order-1 md:order-2">
              <div ref="containerRef" class="w-full h-full flex items-center justify-center  relative">
                <!-- Checkerboard Background -->
                <div class="absolute inset-4 rounded-xl opacity-10 pointer-events-none checkerboard-bg" />

                <canvas ref="canvasRef"
                  class="relative z-10 max-w-full max-h-full rounded-lg touch-none outline-none origin-center" :class="{
                    'cursor-grabbing': isPanning,
                    'cursor-grab': !isPanning && isSpacePressed,
                    'cursor-crosshair': !isPanning && !isSpacePressed && (activeTool !== 'select' || isCropping),
                    'cursor-default': !isPanning && !isSpacePressed && activeTool === 'select' && !isCropping
                  }" @pointerdown="onCanvasPointerDown($event); isConfigPanelOpen = false"
                  @pointermove="onCanvasPointerMove" @pointerup="onCanvasPointerUp" @pointercancel="onCanvasPointerUp"
                  @wheel="onCanvasWheel" />
                <!-- Navigator (Minimap) -->
                <div v-show="viewZoom > 1"
                  class="absolute p-1 bottom-4 right-4 w-32 md:w-48 bg-white/90 dark:bg-gray-800/90 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-20 select-none transition-opacity duration-200 user-select-none"
                  @pointerdown="onNavigatorPointerDown" @pointermove="onNavigatorPointerMove"
                  @pointerup="onNavigatorPointerUp" @pointerleave="onNavigatorPointerUp">
                  <div ref="navigatorBody"
                    class="relative w-full bg-gray-100 dark:bg-black/50 flex items-center justify-center cursor-crosshair"
                    :style="{ aspectRatio: navigatorAspectRatio }">
                    <img v-if="preview" :src="preview"
                      class="max-w-full max-h-full object-contain opacity-80 pointer-events-none" />
                    <!-- Viewport Rect -->
                    <div
                      class="absolute border-2 border-primary box-content shadow-[0_0_0_1000px_rgba(0,0,0,0.5)] cursor-move pointer-events-none"
                      :style="navigatorRectStyle" />
                  </div>
                </div>

                <!-- Zoom Controls -->
                <div
                  class="absolute bottom-4 left-4 flex items-center gap-1 bg-white/90 dark:bg-gray-800/90 p-1 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 transition-opacity duration-200">
                  <n-button quaternary size="tiny" @click="zoomOut" :disabled="viewZoom <= 0.1">
                    <template #icon>
                      <div class="i-ph-minus" />
                    </template>
                  </n-button>
                  <n-popselect :value="viewZoom" :options="[
                    { label: '400%', value: 4 },
                    { label: '200%', value: 2 },
                    { label: '100%', value: 1 },
                    { label: '50%', value: 0.5 },
                    { label: 'Fit', value: 1 }
                  ]" trigger="click" @update:value="(v: number) => setZoom(v)">
                    <button
                      class="px-2 min-w-[3rem] text-xs font-mono font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      title="Set Zoom">
                      {{ Math.round(viewZoom * 100) }}%
                    </button>
                  </n-popselect>
                  <n-button quaternary size="tiny" @click="zoomIn" :disabled="viewZoom >= 10">
                    <template #icon>
                      <div class="i-ph-plus" />
                    </template>
                  </n-button>
                  <div class="w-px h-3 bg-gray-300 dark:bg-gray-600 mx-1"></div>
                  <n-tooltip trigger="hover">
                    <template #trigger>
                      <n-button quaternary size="tiny" @click="setZoom(1); viewOffset = { x: 0, y: 0 }">
                        <template #icon>
                          <div class="i-ph-arrows-out-simple" />
                        </template>
                      </n-button>
                    </template>
                    {{ t('imageEditor.resetView') }}
                  </n-tooltip>
                </div>
                <div v-if="isLoading"
                  class="absolute inset-0 bg-white/50 dark:bg-black/50 z-50 flex flex-col items-center justify-center backdrop-blur-sm">
                  <n-spin size="large" />
                  <span class="mt-4 text-xs font-medium opacity-70">{{ t('imageEditor.loading') }}</span>
                </div>

                <!-- Crop Actions Overlay -->
                <transition name="fade">
                  <div v-if="isCropping && cropRect"
                    class="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex gap-2 shadow-lg rounded-full bg-white dark:bg-gray-800 p-1 border border-gray-200 dark:border-gray-700">
                    <n-button size="small" type="primary" round @click="applyCrop">
                      <template #icon>
                        <div class="i-ph-check-bold" />
                      </template>
                      {{ t('imageEditor.applyCrop') }}
                    </n-button>
                    <div class="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1 self-center" />
                    <n-button size="small" round @click="cancelCrop">
                      {{ t('common.cancel') }}
                    </n-button>
                  </div>
                </transition>
              </div>


            </div>

            <!-- Configuration Sidebar -->
            <aside
              class="fixed bottom-0 inset-x-0 h-[60vh] md:h-auto md:static w-full md:w-[300px] border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 md:bg-white/80 md:dark:bg-gray-900/80 backdrop-blur shrink-0 flex flex-col overflow-hidden z-30 rounded-t-2xl md:rounded-none shadow-2xl md:shadow-none transition-transform duration-300 transform translate-y-full md:translate-y-0 order-3"
              :class="{ '!translate-y-0': isConfigPanelOpen }">

              <!-- Mobile Drag Handle -->
              <div class="w-full h-6 flex items-center justify-center md:hidden shrink-0 cursor-pointer"
                @click="isConfigPanelOpen = false">
                <div class="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
              </div>
              <template v-if="uiPanel === 'base'">
                <div class="p-4 border-b border-gray-100 dark:border-gray-800">
                  <h3 class="font-bold text-sm">{{ t('imageEditor.baseAdjust') }}</h3>
                </div>
                <div class="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                  <div class="space-y-4">
                    <div class="grid grid-cols-2 gap-2">
                      <n-button size="small" @click="rotateLeft">
                        <template #icon>
                          <div class="i-ph-arrow-counter-clockwise" />
                        </template>
                        {{ t('imageEditor.rotateLeft') }}
                      </n-button>
                      <n-button size="small" @click="rotateRight">
                        <template #icon>
                          <div class="i-ph-arrow-clockwise" />
                        </template>
                        {{ t('imageEditor.rotateRight') }}
                      </n-button>
                      <n-button size="small" :type="flipH ? 'primary' : 'default'" @click="toggleFlipH">
                        <template #icon>
                          <div class="i-ph-arrows-left-right" />
                        </template>
                        {{ t('imageEditor.flipH') }}
                      </n-button>
                      <n-button size="small" :type="flipV ? 'primary' : 'default'" @click="toggleFlipV">
                        <template #icon>
                          <div class="i-ph-arrows-down-up" />
                        </template>
                        {{ t('imageEditor.flipV') }}
                      </n-button>
                    </div>

                    <div class="grid grid-cols-3 gap-2">
                      <n-button size="small" :type="isCropping ? 'primary' : 'default'" @click="startCrop">
                        <template #icon>
                          <div class="i-ph-crop" />
                        </template>
                        {{ t('imageEditor.crop') }}
                      </n-button>
                      <n-button size="small" type="success" :disabled="!isCropping || !cropRect" @click="applyCrop">
                        {{ t('imageEditor.applyCrop') }}
                      </n-button>
                      <n-button size="small" :disabled="!isCropping" @click="cancelCrop">
                        {{ t('common.cancel') }}
                      </n-button>
                    </div>

                    <n-divider />

                    <div class="space-y-1">
                      <div class="flex justify-between text-xs mb-1">
                        <span>{{ t('imageEditor.scale') }}</span>
                        <div class="flex flex-col items-end">
                          <span class="font-mono text-primary font-bold">{{ scale }}%</span>
                          <span v-if="dimensionText" class="font-mono text-[10px] opacity-70 text-gray-400">{{
                            dimensionText }}</span>
                        </div>
                      </div>
                      <n-slider v-model:value="scale" :min="20" :max="300" :step="5" />
                    </div>
                    <div class="space-y-1">
                      <div class="flex justify-between text-xs mb-1">
                        <span>{{ t('imageEditor.brightness') }}</span>
                        <span class="font-mono text-primary">{{ brightness }}%</span>
                      </div>
                      <n-slider v-model:value="brightness" :min="0" :max="200" />
                    </div>
                    <div class="space-y-1">
                      <div class="flex justify-between text-xs mb-1">
                        <span>{{ t('imageEditor.contrast') }}</span>
                        <span class="font-mono text-primary">{{ contrast }}%</span>
                      </div>
                      <n-slider v-model:value="contrast" :min="0" :max="200" />
                    </div>
                    <div class="space-y-1">
                      <div class="flex justify-between text-xs mb-1">
                        <span>{{ t('imageEditor.saturate') }}</span>
                        <span class="font-mono text-primary">{{ saturate }}%</span>
                      </div>
                      <n-slider v-model:value="saturate" :min="0" :max="200" />
                    </div>
                  </div>

                  <div class="pt-4">
                    <h4 class="text-xs font-bold mb-3 opacity-70">{{ t('imageEditor.filter') }}</h4>
                    <div class="grid grid-cols-3 gap-2">
                      <button v-for="(preset, key) in filterPresets" :key="key"
                        class="aspect-square rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-medium hover:border-primary hover:text-primary transition-all flex flex-col items-center justify-center gap-1"
                        :class="{ 'border-primary bg-primary/5 text-primary ring-1 ring-primary/20': activeFilter === key }"
                        @click="activeFilter = key">
                        <span>{{ t(preset.labelKey) }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </template>

              <template v-else>
                <div class="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <h3 class="font-bold text-sm">
                    {{ selectedId ? t('imageEditor.editProperties') : t('imageEditor.newToolConfig') }}
                  </h3>
                  <n-button v-if="selectedId" size="tiny" secondary type="primary" @click="selectedId = null">
                    <template #icon>
                      <div class="i-ph-arrow-left" />
                    </template>
                    {{ t('common.back') }}
                  </n-button>
                </div>

                <div class="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
                  <!-- Config Forms -->
                  <template v-if="editingTool === 'brush'">
                    <div class="form-item">
                      <label>{{ t('imageEditor.color') }}</label>
                      <n-color-picker v-model:value="brushColor" :show-alpha="false" :to="rootRef" />
                    </div>
                    <div class="form-item">
                      <label>{{ t('imageEditor.size') }}</label>
                      <n-slider v-model:value="brushSize" :min="1" :max="80" />
                    </div>
                    <div class="form-item">
                      <label>{{ t('imageEditor.opacity') }}</label>
                      <n-slider v-model:value="brushOpacity" :min="0.1" :max="1" :step="0.05" />
                    </div>
                    <div class="form-item flex-row items-center justify-between">
                      <label class="!mb-0">{{ t('imageEditor.pressure') }}</label>
                      <n-switch v-model:value="brushPressure" size="small" />
                    </div>
                  </template>

                  <template v-else-if="editingTool === 'shape'">
                    <div class="form-item">
                      <label>{{ t('imageEditor.type') }}</label>
                      <div class="grid grid-cols-3 gap-2">
                        <button v-for="opt in shapeOptions" :key="opt.value"
                          class="p-2 border rounded-lg flex flex-col items-center justify-center gap-1 transition-all h-14"
                          :class="shapeType === opt.value ? 'bg-primary/10 border-primary text-primary' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'"
                          @click="shapeType = opt.value as any">
                          <svg viewBox="0 0 24 24" class="w-6 h-6 text-current fill-none stroke-current"
                            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect v-if="opt.value === 'rect'" x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle v-if="opt.value === 'ellipse'" cx="12" cy="12" r="9" />
                            <line v-if="opt.value === 'line'" x1="4" y1="20" x2="20" y2="4" />
                          </svg>
                          <span class="text-[10px]">{{ opt.label }}</span>
                        </button>
                      </div>
                    </div>
                    <div class="form-item">
                      <label>{{ t('imageEditor.stroke') }}</label>
                      <n-color-picker v-model:value="shapeStrokeColor" :show-alpha="false" :to="rootRef" />
                    </div>
                    <div class="form-item">
                      <label>{{ t('imageEditor.fill') }}</label>
                      <n-color-picker v-model:value="shapeFillColor" :show-alpha="false" :to="rootRef" />
                    </div>
                    <div class="form-item">
                      <label>{{ t('imageEditor.strokeWidth') }}</label>
                      <n-slider v-model:value="shapeStrokeWidth" :min="1" :max="30" />
                    </div>
                    <div class="form-item">
                      <label>{{ t('imageEditor.fillOpacity') }}</label>
                      <n-slider v-model:value="shapeFillOpacity" :min="0" :max="1" :step="0.05" />
                    </div>
                    <div class="form-item">
                      <label>{{ t('imageEditor.strokePattern') }}</label>
                      <div class="flex gap-2">
                        <button v-for="opt in strokePatternOptions" :key="opt.value"
                          class="flex-1 p-2 border rounded-lg flex flex-col items-center justify-center gap-1 transition-all h-14"
                          :class="shapeStrokePattern === opt.value ? 'bg-primary/10 border-primary text-primary' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'"
                          @click="shapeStrokePattern = opt.value as any">
                          <svg viewBox="0 0 40 10" class="w-full h-4 text-current stroke-current" stroke-width="3"
                            stroke-linecap="round">
                            <line x1="2" y1="5" x2="38" y2="5"
                              :stroke-dasharray="opt.value === 'dashed' ? '6,5' : '0'" />
                          </svg>
                          <span class="text-xs">{{ opt.label }}</span>
                        </button>
                      </div>
                    </div>
                  </template>

                  <template v-else-if="editingTool === 'arrow'">
                    <div class="form-item">
                      <label>{{ t('imageEditor.style') }}</label>
                      <div class="grid grid-cols-2 gap-2">
                        <button v-for="opt in arrowStyleOptions" :key="opt.value"
                          class="p-2 border rounded-lg flex flex-col items-center justify-center gap-1 transition-all h-14"
                          :class="arrowStyle === opt.value ? 'bg-primary/10 border-primary text-primary' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'"
                          @click="arrowStyle = opt.value as any">
                          <!-- Visual representation using SVG for accuracy -->
                          <svg viewBox="0 0 40 20" class="w-full h-full text-current fill-current">
                            <!-- Classic: Line + V-shape head (stroked) -->
                            <g v-if="opt.value === 'classic'" stroke="currentColor" stroke-width="2" fill="none">
                              <line x1="0" y1="10" x2="35" y2="10" />
                              <polyline points="28,3 38,10 28,17" />
                            </g>

                            <!-- Modern: Line + Barbed head (filled) -->
                            <g v-if="opt.value === 'modern'">
                              <line x1="0" y1="10" x2="28" y2="10" stroke="currentColor" stroke-width="2" />
                              <path d="M25,3 L38,10 L25,17 L28,10 Z" stroke="none" />
                            </g>

                            <!-- Bold: Thick shaft + Flat base head (filled) -->
                            <g v-if="opt.value === 'bold'">
                              <!-- Shaft -->
                              <rect x="0" y="8" width="28" height="4" fill="currentColor" />
                              <!-- Head: Flat base triangle -->
                              <path d="M26,3 L38,10 L26,17 Z" stroke="none" />
                            </g>

                            <!-- Tapered: Tapered shaft + Flat base head (filled) -->
                            <g v-if="opt.value === 'tapered'">
                              <!-- Tapered Shaft -->
                              <path d="M0,9 L27,8 L27,12 L0,11 Z" fill="currentColor" />
                              <!-- Head -->
                              <path d="M26,3 L38,10 L26,17 Z" stroke="none" />
                            </g>
                          </svg>
                          <span class="text-[10px]">{{ opt.label }}</span>
                        </button>
                      </div>
                    </div>
                    <div class="form-item">
                      <label>{{ t('imageEditor.color') }}</label>
                      <n-color-picker v-model:value="arrowColor" :show-alpha="false" :to="rootRef" />
                    </div>
                    <div class="form-item">
                      <label>{{ t('imageEditor.width') }}</label>
                      <n-slider v-model:value="arrowWidth" :min="2" :max="40" />
                    </div>
                    <div class="form-item">
                      <label>{{ t('imageEditor.headSize') }}</label>
                      <n-slider v-model:value="arrowHeadSize" :min="10" :max="100" />
                    </div>
                    <div class="form-item">
                      <label>{{ t('imageEditor.direction') }}</label>
                      <div class="flex gap-2">
                        <button v-for="opt in arrowDirectionOptions" :key="opt.value"
                          class="flex-1 p-2 border rounded-lg flex flex-col items-center justify-center gap-1 transition-all h-14"
                          :class="arrowDirection === opt.value ? 'bg-primary/10 border-primary text-primary' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'"
                          @click="arrowDirection = opt.value as any">
                          <svg viewBox="0 0 24 24" class="w-6 h-6 text-current fill-current">
                            <path v-if="opt.value === 'single'"
                              d="M5 11h11.17l-3.59-3.59L14 6l6 6-6 6-1.41-1.41L16.17 13H5v-2z" />
                            <path v-else
                              d="M6.99 11L10.58 7.41L9.17 6L3.17 12L9.17 18L10.58 16.59L6.99 13H17.01L13.42 16.59L14.83 18L20.83 12L14.83 6L13.42 7.41L17.01 11H6.99z" />
                          </svg>
                          <span class="text-xs">{{ opt.label }}</span>
                        </button>
                      </div>
                    </div>
                    <div class="form-item">
                      <label>{{ t('imageEditor.lineStyle') }}</label>
                      <div class="flex gap-2">
                        <button v-for="opt in strokePatternOptions" :key="opt.value"
                          class="flex-1 p-2 border rounded-lg flex flex-col items-center justify-center gap-1 transition-all h-14"
                          :class="arrowPattern === opt.value ? 'bg-primary/10 border-primary text-primary' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'"
                          @click="arrowPattern = opt.value as any">
                          <svg viewBox="0 0 40 10" class="w-full h-4 text-current stroke-current" stroke-width="3"
                            stroke-linecap="round">
                            <line x1="2" y1="5" x2="38" y2="5"
                              :stroke-dasharray="opt.value === 'dashed' ? '6,5' : '0'" />
                          </svg>
                          <span class="text-xs">{{ opt.label }}</span>
                        </button>
                      </div>
                    </div>
                  </template>

                  <template v-else-if="editingTool === 'text'">
                    <div class="form-item">
                      <label>{{ t('imageEditor.content') }}</label>
                      <n-input type="textarea" v-model:value="textInput" round :rows="3" />
                    </div>
                    <div class="form-item">
                      <label>{{ t('imageEditor.fontColor') }}</label>
                      <n-color-picker v-model:value="textColor" :show-alpha="false" :to="rootRef" />
                    </div>
                    <div class="form-item" v-if="textStyle !== 'fill'">
                      <label>{{
                        textStyle === 'background' ? t('imageEditor.bgColor') :
                          textStyle === 'stroke' ? t('imageEditor.strokeColor') :
                            t('imageEditor.shadowColor')
                      }}</label>
                      <n-color-picker v-model:value="textSecondaryColor" :show-alpha="true" :to="rootRef" />
                    </div>
                    <div class="form-item">
                      <label>{{ t('imageEditor.font') }}</label>
                      <n-select v-model:value="textFontFamily" :options="fontOptions" :to="rootRef" />
                    </div>
                    <div class="form-item">
                      <label>{{ t('imageEditor.style') }}</label>
                      <div class="grid grid-cols-2 gap-2">
                        <button v-for="opt in textStyleOptions" :key="opt.value"
                          class="p-2 border rounded-lg flex flex-col items-center justify-center gap-1 transition-all h-12"
                          :class="textStyle === opt.value ? 'bg-primary/10 border-primary text-primary' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'"
                          @click="textStyle = opt.value as any">
                          <span :class="{
                            'font-bold': opt.value === 'fill',
                            'line-through opacity-50': opt.value === 'stroke',
                            'drop-shadow-md': opt.value === 'shadow',
                            'bg-primary text-white px-1 rounded': opt.value === 'background'
                          }" class="text-xs">Abc</span>
                          <span class="text-[10px]">{{ opt.label }}</span>
                        </button>
                      </div>
                    </div>
                    <div class="form-item">
                      <label>{{ t('imageEditor.size') }}</label>
                      <n-slider v-model:value="textFontSize" :min="10" :max="120" />
                    </div>
                    <div class="form-item">
                      <label>{{ t('imageEditor.letterSpacing') }}</label>
                      <n-slider v-model:value="textLetterSpacing" :min="-5" :max="20" />
                    </div>
                    <div class="flex items-center gap-2">
                      <n-button size="small" :type="textBold ? 'primary' : 'default'" @click="textBold = !textBold"
                        class="flex-1">
                        <template #icon>
                          <div class="i-ph-text-b-bold" />
                        </template>
                        {{ t('imageEditor.bold') }}
                      </n-button>
                      <n-button size="small" :type="textItalic ? 'primary' : 'default'"
                        @click="textItalic = !textItalic" class="flex-1">
                        <template #icon>
                          <div class="i-ph-text-italic-bold" />
                        </template>
                        {{ t('imageEditor.italic') }}
                      </n-button>
                    </div>
                    <div class="form-item">
                      <label>{{ t('imageEditor.align') }}</label>
                      <div class="flex gap-2">
                        <button v-for="opt in textAlignOptions" :key="opt.value"
                          class="flex-1 p-2 border rounded-lg flex items-center justify-center gap-2 transition-all"
                          :class="textAlign === opt.value ? 'bg-primary/10 border-primary text-primary' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'"
                          @click="textAlign = opt.value as any">
                          <div :class="opt.icon" class="text-lg" />
                        </button>
                      </div>
                    </div>

                  </template>

                  <template v-else-if="editingTool === 'mosaic'">
                    <div class="form-item">
                      <label>{{ t('imageEditor.mode') }}</label>
                      <n-select v-model:value="mosaicMode" :options="mosaicModeOptions" :to="rootRef" />
                    </div>
                    <div class="form-item">
                      <label>{{ t('imageEditor.shape') }}</label>
                      <n-select v-model:value="mosaicShape" :options="mosaicShapeOptions" :to="rootRef" />
                    </div>
                    <div class="form-item">
                      <label>{{ t('imageEditor.pixel') }}</label>
                      <n-slider v-model:value="mosaicPixelSize" :min="4" :max="48" />
                    </div>
                  </template>

                  <template v-else-if="editingTool === 'number'">
                    <div class="form-item">
                      <label>{{ selectedId ? t('imageEditor.currentValue') : t('imageEditor.start') }}</label>
                      <n-input-number v-if="!selectedId" v-model:value="numberStart" :min="1" />
                      <n-input-number v-else v-model:value="numberValue" :min="1" />
                    </div>
                    <div class="form-item">
                      <label>{{ t('imageEditor.color') }}</label>
                      <n-color-picker v-model:value="numberColor" :show-alpha="false" :to="rootRef" />
                    </div>
                    <div class="form-item">
                      <label>{{ t('imageEditor.size') }}</label>
                      <n-slider v-model:value="numberSize" :min="14" :max="80" />
                    </div>
                  </template>

                  <div v-else class="py-10 text-center opacity-30 select-none">
                    <div class="i-ph-cursor-click text-5xl mb-2 mx-auto" />
                    <p>{{ t('imageEditor.tools.select') }}</p>
                  </div>
                </div>

                <!-- Layers Info -->
                <div
                  class="mt-auto border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-black/20 shrink-0 h-[200px] flex flex-col">
                  <div
                    class="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider flex justify-between items-center">
                    <span>{{ t('imageEditor.layerManagement') }}</span>
                    <span
                      class="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded text-[10px]">{{
                        annotations.length }}</span>
                  </div>

                  <div
                    class="px-4 py-1 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 mb-1">
                    <span class="text-[10px] font-bold opacity-50">{{ t('imageEditor.layer') }}</span>
                    <div class="flex gap-1">
                      <n-button quaternary circle size="tiny" :disabled="selectedIds.size < 2" @click="groupSelected"
                        :title="t('imageEditor.group')">
                        <template #icon>
                          <div class="i-ph-shapes-bold text-xs" />
                        </template>
                      </n-button>
                      <n-button quaternary circle size="tiny" :disabled="!isGroupSelected" @click="ungroupSelected"
                        :title="t('imageEditor.ungroup')">
                        <template #icon>
                          <div class="i-ph-polygon-bold text-xs" />
                        </template>
                      </n-button>
                      <n-button quaternary circle size="tiny" :disabled="selectedIds.size === 0" @click="removeSelected"
                        :title="t('imageEditor.removeSelected')">
                        <template #icon>
                          <div class="i-ph-trash-bold text-xs text-red-500" />
                        </template>
                      </n-button>
                    </div>
                  </div>

                  <div class="flex-1 overflow-y-auto px-2 pb-2 space-y-1 custom-scrollbar">
                    <div v-if="annotations.length === 0" class="text-center py-10 opacity-30 select-none">
                      <div class="i-ph-stack text-4xl mb-2 mx-auto" />
                      <p class="text-xs">{{ t('imageEditor.noLayers') }}</p>
                    </div>
                    <div v-for="(item, index) in [...annotations].reverse()" :key="item.id"
                      class="flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-all border border-transparent"
                      :class="selectedIds.has(item.id) ? 'bg-primary/10 border-primary/20 text-primary' : 'hover:bg-gray-100 dark:hover:bg-gray-800'"
                      draggable="true" @dragstart="onDragStart($event, annotations.length - 1 - index)"
                      @dragover="onDragOver($event, annotations.length - 1 - index)"
                      @drop="onDrop($event, annotations.length - 1 - index)" @click="onLayerItemClick($event, item.id)">
                      <div class="w-6 h-6 flex items-center justify-center rounded bg-gray-200/50 dark:bg-gray-700/50">
                        <div v-if="item.kind === 'brush'" class="i-ph-paint-brush text-xs" />
                        <div v-else-if="item.kind === 'shape'" class="i-ph-shapes text-xs" />
                        <div v-else-if="item.kind === 'arrow'" class="i-ph-arrow-up-right text-xs" />
                        <div v-else-if="item.kind === 'text'" class="i-ph-text-t text-xs" />
                        <div v-else-if="item.kind === 'mosaic'" class="i-ph-squares-four text-xs" />
                        <div v-else-if="item.kind === 'number'" class="i-ph-number-circle-one text-xs" />
                        <div v-else-if="item.kind === 'group'" class="i-ph-folders text-xs" />
                      </div>
                      <div class="flex-1 min-w-0 flex items-center gap-1 group/item">
                        <span v-if="renamingId !== item.id" class="text-[10px] truncate font-medium"
                          @dblclick="startRename(item)">
                          {{ getAnnotationLabel(item) }}
                        </span>
                        <div v-if="renamingId !== item.id"
                          class="i-ph-pencil-simple text-[10px] opacity-0 group-hover/item:opacity-40 cursor-pointer"
                          @click.stop="startRename(item)" />
                        <n-input v-else v-model:value="renamingValue" size="tiny" class="flex-1 !text-[10px]"
                          @blur="finishRename" @keydown.enter="finishRename" @click.stop autofocus />
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </aside>
          </div>

          <!-- Text Edit Overlay -->
          <Transition name="editor-fade">
            <div v-if="isTextEditing"
              class="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
              @click.stop>
              <div
                class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 border border-gray-100 dark:border-gray-800">
                <div class="flex justify-between items-center">
                  <h3 class="font-bold text-lg">{{ t('imageEditor.textEditPrompt') }}</h3>
                  <n-button quaternary circle size="small" @click="isTextEditing = false">
                    <template #icon>
                      <div class="i-ph-x-bold" />
                    </template>
                  </n-button>
                </div>
                <n-input type="textarea" v-model:value="editingText" :rows="5" placeholder="Enter text..."
                  class="text-lg" autofocus @keydown.enter.ctrl.stop="confirmTextEdit"
                  @keydown.esc.stop="isTextEditing = false" />
                <div class="flex justify-end gap-3 pt-2">
                  <n-button @click="isTextEditing = false">{{ t('common.cancel') }}</n-button>
                  <n-button type="primary" @click="confirmTextEdit">{{ t('common.confirm') }} <span
                      class="text-xs opacity-70 ml-1">(Ctrl+Enter)</span></n-button>
                </div>
              </div>
            </div>
          </Transition>

        </div>
      </Transition>
    </n-config-provider>
  </Teleport>
</template>

<style scoped>
.editor-root {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(255, 255, 255, 0.98);
}

.dark .editor-root {
  background: rgba(16, 16, 20, 0.98);
}

.editor-fade-enter-active,
.editor-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.editor-fade-enter-from,
.editor-fade-leave-to {
  opacity: 0;
  transform: scale(0.98);
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #dbdbdb;
  border-radius: 4px;
}

.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: #333;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #bababa;
}

.dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #444;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-item label {
  font-size: 11px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 2px;
}

.dark .form-item label {
  color: #888;
}

.checkerboard-bg {
  background-image:
    linear-gradient(45deg, #888 25%, transparent 25%),
    linear-gradient(-45deg, #888 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #888 75%),
    linear-gradient(-45deg, transparent 75%, #888 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0;
}
</style>
