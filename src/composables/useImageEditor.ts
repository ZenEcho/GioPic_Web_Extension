import { computed, nextTick, onMounted, onUnmounted, ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMessage } from 'naive-ui'
import {
    buildHistory,
    clamp,
    clampPoint,
    clampRect,
    createId,
    distanceToSegment,
    historyPush,
    historyRedo,
    historyUndo,
    nextSequenceValue,
    normalizeRect,
    translateInBounds,
    type Annotation,
    type AnnotationTool,
    type ArrowAnnotation,
    type ArrowDirection,
    type ArrowStyle,
    type BrushAnnotation,
    type MosaicAnnotation,
    type NumberAnnotation,
    type Point,
    type Rect,
    type ShapeAnnotation,
    type ShapeType,
    type StrokePattern,
    type TextAnnotation,
    type TextStyle,
    type GroupAnnotation,
    buildArrowHead,
} from '@/utils/editorCore'
import {
    buildFilterString,
    drawAnnotation,
    drawBaseLayer,
    drawMosaicAreaDraftOutline,
    drawSelectionOutline,
    drawAnnotationIndicator,
    getAnnotationBBox,
    getAnnotationIndicatorPoint,
    resolveTextFont,
} from '@/utils/editorRenderer'
import {
    EDITOR_TOOLS,
    FILTER_PRESETS,
    TEXT_FONT_OPTIONS,
    TOOL_SHORTCUT_MAP,
    type FilterPreset,
} from '@/constants/editorConfig'

export interface ImageEditorProps {
    visible: boolean
    file: File
    preview: string
}

export type ImageEditorEmit = {
    (e: 'close'): void
    (e: 'save', payload: { file: File; preview: string }): void
}

export function useImageEditor(props: ImageEditorProps, emit: ImageEditorEmit) {
    const { t } = useI18n()
    const message = useMessage()

    const canvasRef = ref<HTMLCanvasElement | null>(null)
    const containerRef = ref<HTMLDivElement | null>(null)

    const originalImage = ref<HTMLImageElement | null>(null)
    const isLoading = ref(false)
    const isSaving = ref(false)

    const rotation = ref(0)
    const flipH = ref(false)
    const flipV = ref(false)
    const scale = ref(100)
    const brightness = ref(100)
    const contrast = ref(100)
    const saturate = ref(100)
    const activeFilter = ref<FilterPreset>('none')

    const activeTool = ref<AnnotationTool>('select')
    const selectedId = computed({
        get: () => Array.from(selectedIds.value)[0] || null,
        set: (id) => {
            if (id) selectedIds.value = new Set([id])
            else selectedIds.value.clear()
        }
    })
    const history = ref(buildHistory<Annotation[]>([]))
    const draftAnnotation = ref<Annotation | null>(null)

    const pointerDown = ref(false)
    const dragOrigin = ref<Point | null>(null)
    const pointerStart = ref<Point | null>(null)
    const dragSourceAnnotations = ref<Annotation[] | null>(null)
    const draggingSelection = ref(false)
    const activeHandle = ref<string | null>(null)

    const brushColor = ref('#ef4444')
    const brushSize = ref(8)
    const brushOpacity = ref(0.8)
    const brushPressure = ref(true)

    const shapeType = ref<ShapeType>('rect')
    const shapeStrokeColor = ref('#22c55e')
    const shapeStrokeWidth = ref(3)
    const shapeFillColor = ref('#22c55e')
    const shapeFillOpacity = ref(0.2)
    const shapeStrokePattern = ref<StrokePattern>('solid')

    const arrowColor = ref('#3b82f6')
    const arrowWidth = ref(6)
    const arrowDirection = ref<ArrowDirection>('single')
    const arrowPattern = ref<StrokePattern>('solid')
    const arrowHeadSize = ref(24)
    const arrowStyle = ref<ArrowStyle>('bold')

    const textInput = ref(t('imageEditor.tools.text'))
    const textColor = ref('#ffffff')
    const textFontSize = ref(24)
    const textFontFamily = ref('Arial')
    const textBold = ref(true)
    const textItalic = ref(false)
    const textAlign = ref<CanvasTextAlign>('left')
    const textStyle = ref<TextStyle>('fill')
    const textSecondaryColor = ref('#3b82f6')
    const textLetterSpacing = ref(0)

    const selectedIds = ref(new Set<string>())

    const mosaicMode = ref<'brush' | 'area'>('brush')
    const mosaicShape = ref<'rect' | 'circle'>('rect')
    const mosaicPixelSize = ref(12)

    const numberStart = ref(1)
    const numberValue = ref(1)
    const numberColor = ref('#f59e0b')
    const numberSize = ref(32)

    const uiPanel = ref<'base' | 'tool'>('tool')
    const isTextEditing = ref(false)
    const editingText = ref('')
    let isSyncing = false

    // Zoom & Pan State
    const viewZoom = ref(1)
    const viewOffset = ref({ x: 0, y: 0 })
    const isPanning = ref(false)

    const isSpacePressed = ref(false)
    const isCropping = ref(false)
    const cropRect = ref<Rect | null>(null)
    const imageMutated = ref(false)

    // Navigator / Preview Info
    const displayInfo = ref({
        canvasW: 0, // Content Width (unzoomed)
        canvasH: 0, // Content Height (unzoomed)
        exportW: 0,
        exportH: 0,
        fitScale: 1,
        viewportW: 0,
        viewportH: 0,
    })
    let renderQueued = false

    const toolList = EDITOR_TOOLS
    const filterPresets = FILTER_PRESETS

    const canUndo = computed(() => history.value.past.length > 0)
    const canRedo = computed(() => history.value.future.length > 0)
    const annotations = computed(() => history.value.present)

    const isEdited = computed(() => {
        return (
            rotation.value !== 0 ||
            flipH.value ||
            flipV.value ||
            scale.value !== 100 ||
            brightness.value !== 100 ||
            contrast.value !== 100 ||
            saturate.value !== 100 ||
            activeFilter.value !== 'none' ||
            annotations.value.length > 0 ||
            imageMutated.value
        )
    })

    const dimensionText = computed(() => {
        if (!displayInfo.value.exportW || !displayInfo.value.exportH) return ''
        return `${displayInfo.value.exportW} x ${displayInfo.value.exportH}`
    })

    const selectedAnnotation = computed(() => {
        if (!selectedId.value) return null
        return annotations.value.find(item => item.id === selectedId.value) || null
    })

    const editingTool = computed(() => {
        if (selectedAnnotation.value) {
            return selectedAnnotation.value.kind as AnnotationTool
        }
        return activeTool.value
    })

    function getRotatedDimensions(useOriginalSize = false) {
        const img = originalImage.value
        if (!img) return { w: 0, h: 0 }
        const s = useOriginalSize ? 1 : scale.value / 100
        const width = Math.round(img.naturalWidth * s)
        const height = Math.round(img.naturalHeight * s)
        if (rotation.value === 90 || rotation.value === 270) {
            return { w: height, h: width }
        }
        return { w: width, h: height }
    }

    function loadImage() {
        if (!props.file && !props.preview) return
        isLoading.value = true
        const img = new Image()
        img.onload = () => {
            originalImage.value = img
            imageMutated.value = false
            resetAll()
            isLoading.value = false
            nextTick(scheduleRender)
        }
        img.onerror = () => {
            isLoading.value = false
            message.error(t('imageEditor.loadFailed'))
        }

        if (props.preview) {
            img.src = props.preview
        } else {
            const reader = new FileReader()
            reader.onload = event => {
                img.src = String(event.target?.result || '')
            }
            reader.readAsDataURL(props.file)
        }
    }

    function renderCanvas() {
        const canvas = canvasRef.value
        const container = containerRef.value
        const img = originalImage.value
        if (!canvas || !container || !img) return

        const { w: exportW, h: exportH } = getRotatedDimensions(false)
        const { w: origW, h: origH } = getRotatedDimensions(true)
        if (!exportW || !exportH) return

        // 1. Set Canvas Setup (Viewport Size)
        const viewportW = container.clientWidth
        const viewportH = container.clientHeight

        if (canvas.width !== viewportW) canvas.width = viewportW
        if (canvas.height !== viewportH) canvas.height = viewportH

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Clear Viewport
        ctx.clearRect(0, 0, viewportW, viewportH)

        // 2. Calculate Base Dimensions (Fit Original to Screen, then Scale it)
        const baseFitScale = Math.min(viewportW / origW, viewportH / origH, 1)
        const resScale = scale.value / 100

        // baseContentW/H should represent the ACTIVE WORKSPACE area (unzoomed by viewZoom)
        const baseContentW = Math.max(1, Math.round(exportW * baseFitScale))
        const baseContentH = Math.max(1, Math.round(exportH * baseFitScale))

        // 3. Apply View Transform
        ctx.save()
        // Translate to Center of Viewport + Offset
        const centerX = viewportW / 2 + viewOffset.value.x
        const centerY = viewportH / 2 + viewOffset.value.y
        ctx.translate(centerX, centerY)
        // Apply Zoom
        ctx.scale(viewZoom.value, viewZoom.value)
        // Translate back to Top-Left of Content (so drawing at 0,0 works for annotations)
        ctx.translate(-baseContentW / 2, -baseContentH / 2)

        const filterString = buildFilterString(
            brightness.value,
            contrast.value,
            saturate.value,
            activeFilter.value,
            filterPresets
        )

        // 4. Draw Base Layer (Image)
        // We pass baseContentW/H to drawBaseLayer. 
        // It translates to (W/2, H/2) internally -> transforms to Center -> draws centered.
        // This aligns perfectly with our context translation (we are at Top-Left of content).
        // Wait, drawBaseLayer translates to center of the box we give it.
        // So it ends up at (baseContentW/2, baseContentH/2) which is the center of our content.
        // Perfect.
        drawBaseLayer(
            ctx,
            img,
            baseContentW,
            baseContentH,
            baseFitScale,
            scale.value, // Resolution scale
            rotation.value,
            flipH.value,
            flipV.value,
            filterString
        )

        // 5. Draw Annotations
        // Annotations are in Content Space (0..baseContentW).
        // We just draw normally.
        annotations.value.forEach(item => drawAnnotation(ctx, item))

        // Select Indicator
        if (activeTool.value === 'select') {
            annotations.value.forEach(item => {
                drawAnnotationIndicator(ctx, item, selectedIds.value.has(item.id))
            })
        }

        if (draftAnnotation.value) {
            if (draftAnnotation.value.kind === 'mosaic' && draftAnnotation.value.mode === 'area') {
                drawMosaicAreaDraftOutline(ctx, draftAnnotation.value)
            } else {
                drawAnnotation(ctx, draftAnnotation.value)
            }
        }

        annotations.value.filter(a => selectedIds.value.has(a.id)).forEach(item => {
            drawSelectionOutline(ctx, item)
        })

        if (isCropping.value && cropRect.value) {
            const rect = clampRect(cropRect.value, baseContentW, baseContentH)
            ctx.save()
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
            ctx.beginPath()
            ctx.rect(0, 0, baseContentW, baseContentH)
            ctx.rect(rect.x, rect.y, rect.w, rect.h)
            ctx.globalCompositeOperation = 'source-over'
            ctx.fill('evenodd')

            ctx.strokeStyle = '#22c55e'
            ctx.lineWidth = 2 / viewZoom.value // Scale line width
            ctx.setLineDash([8 / viewZoom.value, 4 / viewZoom.value])
            ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)
            ctx.restore()
        }

        ctx.restore()

        displayInfo.value = {
            canvasW: baseContentW,
            canvasH: baseContentH,
            exportW,
            exportH,
            fitScale: baseFitScale,
            viewportW,
            viewportH
        }
    }

    function scheduleRender() {
        if (renderQueued) return
        renderQueued = true
        requestAnimationFrame(() => {
            renderQueued = false
            renderCanvas()
        })
    }

    function getCanvasPoint(event: PointerEvent): Point | null {
        const canvas = canvasRef.value
        if (!canvas) return null
        const rect = canvas.getBoundingClientRect()

        // Handle CSS scaling of the canvas element
        const scaleX = canvas.width / rect.width
        const scaleY = canvas.height / rect.height

        // Raw view coords (inside viewport, scaled to canvas internal buffer)
        const vx = (event.clientX - rect.left) * scaleX
        const vy = (event.clientY - rect.top) * scaleY

        const { canvasW, canvasH, viewportW, viewportH } = displayInfo.value

        // Inverse Transform
        // 1. Subtract Center
        const cx = vx - (viewportW / 2 + viewOffset.value.x)
        const cy = vy - (viewportH / 2 + viewOffset.value.y)
        // 2. Unscale
        const ux = cx / viewZoom.value
        // 3. Subtract Origin Offset (-baseW/2) -> Add baseW/2
        const x = ux + canvasW / 2
        const y = cy / viewZoom.value + canvasH / 2

        // Note: We don't want to strictly clamp to 0..canvasW/H if we want to allow 
        // drawing slightly outside or if we trust the event target. 
        // But generally annotations should be inside or near.
        // For now, let's clamp for safety as before.
        return clampPoint({ x, y }, canvasW, canvasH)
    }

    // Space Key Handling
    function onSpaceDown() {
        if (!isSpacePressed.value) {
            isSpacePressed.value = true
        }
    }

    function onSpaceUp() {
        if (isSpacePressed.value) {
            isSpacePressed.value = false
            // Stop panning if key released
            if (isPanning.value) {
                isPanning.value = false
                // Note: dragOrigin and stuff might be set, 
                // but pointerUp handles cleaning up drag states usually.
                // We'll trust pointerUp/Move to stop updating pan.
            }
        }
    }

    function withUpdatedAnnotation(id: string, updater: (item: Annotation) => Annotation): Annotation[] {
        return annotations.value.map(item => (item.id === id ? updater(item) : item))
    }

    function pushAnnotations(next: Annotation[]) {
        history.value = historyPush(history.value, next)
    }

    function undo() {
        history.value = historyUndo(history.value)
        selectedId.value = null
        scheduleRender()
    }

    function redo() {
        history.value = historyRedo(history.value)
        selectedId.value = null
        scheduleRender()
    }

    function renameAnnotation(id: string, name: string) {
        pushAnnotations(withUpdatedAnnotation(id, item => {
            if (item.kind === 'group') return { ...item, name }
            // Optionally support renaming other types too
            return { ...item, name } as any
        }))
        scheduleRender()
    }

    function getAnnotationLabel(item: Annotation): string {
        if (item.kind === 'text') return item.text || t('imageEditor.tools.text')
        if (item.kind === 'number') return `#${item.value}`
        if (item.kind === 'group') {
            return item.name || t('imageEditor.groupWithCount', { count: item.children.length })
        }
        return t(`imageEditor.tools.${item.kind}`)
    }

    function removeSelected() {
        if (selectedIds.value.size === 0) return
        pushAnnotations(annotations.value.filter(item => !selectedIds.value.has(item.id)))
        selectedIds.value.clear()
        scheduleRender()
    }

    function changeLayer(action: 'top' | 'bottom' | 'up' | 'down') {
        if (!selectedId.value) return
        const list = [...annotations.value]
        const index = list.findIndex(item => item.id === selectedId.value)
        if (index === -1) return

        if (action === 'top') {
            if (index === list.length - 1) return
            const item = list.splice(index, 1)[0]
            if (item) list.push(item)
        } else if (action === 'bottom') {
            if (index === 0) return
            const item = list.splice(index, 1)[0]
            if (item) list.unshift(item)
        } else if (action === 'up') {
            if (index === list.length - 1) return
            const item = list[index]
            const next = list[index + 1]
            if (item && next) {
                list[index] = next
                list[index + 1] = item
            }
        } else if (action === 'down') {
            if (index === 0) return
            const item = list[index]
            const prev = list[index - 1]
            if (item && prev) {
                list[index] = prev
                list[index - 1] = item
            }
        }

        pushAnnotations(list)
        scheduleRender()
    }

    function resetAdjustments() {
        rotation.value = 0
        flipH.value = false
        flipV.value = false
        scale.value = 100
        brightness.value = 100
        contrast.value = 100
        saturate.value = 100
        activeFilter.value = 'none'
        viewZoom.value = 1
        viewOffset.value = { x: 0, y: 0 }
        isCropping.value = false
        cropRect.value = null
        message.success(t('imageEditor.resetAdjustmentsSuccess'))
    }

    function resetAll() {
        resetAdjustments()
        history.value = buildHistory<Annotation[]>([])
        selectedId.value = null
        draftAnnotation.value = null
    }

    function restoreOriginal() {
        loadImage()
        viewZoom.value = 1
        viewOffset.value = { x: 0, y: 0 }
        isCropping.value = false
        cropRect.value = null
        imageMutated.value = false
        message.success(t('imageEditor.resetSuccess'))
    }

    function startCrop() {
        const { canvasW, canvasH } = displayInfo.value
        if (!canvasW || !canvasH) return
        isCropping.value = true
        selectedId.value = null
        draftAnnotation.value = null
        activeTool.value = 'select'
        cropRect.value = cropRect.value
            ? clampRect(cropRect.value, canvasW, canvasH)
            : {
                x: Math.round(canvasW * 0.1),
                y: Math.round(canvasH * 0.1),
                w: Math.max(1, Math.round(canvasW * 0.8)),
                h: Math.max(1, Math.round(canvasH * 0.8)),
            }
        scheduleRender()
    }

    function cancelCrop() {
        isCropping.value = false
        cropRect.value = null
        pointerDown.value = false
        pointerStart.value = null
        scheduleRender()
    }

    async function applyCrop() {
        const img = originalImage.value
        const rect = cropRect.value
        const { exportW, exportH, canvasW, canvasH, viewportW, viewportH } = displayInfo.value
        if (!img || !rect || !canvasW || !canvasH || !exportW || !exportH || !viewportW || !viewportH) return

        const oldFactorX = exportW / canvasW
        const oldFactorY = exportH / canvasH

        const cropX = Math.max(0, Math.round(rect.x * oldFactorX))
        const cropY = Math.max(0, Math.round(rect.y * oldFactorY))
        const cropW = Math.max(1, Math.round(rect.w * oldFactorX))
        const cropH = Math.max(1, Math.round(rect.h * oldFactorY))

        const fullCanvas = document.createElement('canvas')
        fullCanvas.width = exportW
        fullCanvas.height = exportH
        const fullCtx = fullCanvas.getContext('2d')
        if (!fullCtx) return

        const filterString = buildFilterString(
            brightness.value,
            contrast.value,
            saturate.value,
            activeFilter.value,
            filterPresets,
        )
        drawBaseLayer(
            fullCtx,
            img,
            exportW,
            exportH,
            1,
            scale.value,
            rotation.value,
            flipH.value,
            flipV.value,
            filterString,
        )

        const croppedCanvas = document.createElement('canvas')
        croppedCanvas.width = cropW
        croppedCanvas.height = cropH
        const croppedCtx = croppedCanvas.getContext('2d')
        if (!croppedCtx) return
        croppedCtx.drawImage(fullCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)

        const croppedImage = await new Promise<HTMLImageElement>((resolve, reject) => {
            const nextImg = new Image()
            nextImg.onload = () => resolve(nextImg)
            nextImg.onerror = () => reject(new Error('Failed to load cropped image'))
            nextImg.src = croppedCanvas.toDataURL(props.file.type || 'image/png')
        })

        const nextFitScale = Math.min(viewportW / cropW, viewportH / cropH, 1)
        const nextCanvasW = Math.max(1, Math.round(cropW * nextFitScale))
        const nextCanvasH = Math.max(1, Math.round(cropH * nextFitScale))
        const nextFactorX = nextCanvasW / cropW
        const nextFactorY = nextCanvasH / cropH

        const mapPoint = (point: Point): Point => {
            const xExport = point.x * oldFactorX - cropX
            const yExport = point.y * oldFactorY - cropY
            return clampPoint(
                { x: xExport * nextFactorX, y: yExport * nextFactorY },
                nextCanvasW,
                nextCanvasH,
            )
        }

        const mappedAnnotations = annotations.value
            .map<Annotation | null>(item => {
                if (item.kind === 'text') {
                    return { ...item, ...mapPoint({ x: item.x, y: item.y }) }
                }
                if (item.kind === 'number') {
                    return { ...item, ...mapPoint({ x: item.x, y: item.y }) }
                }
                if (item.kind === 'shape') {
                    return { ...item, start: mapPoint(item.start), end: mapPoint(item.end) }
                }
                if (item.kind === 'arrow') {
                    return { ...item, start: mapPoint(item.start), end: mapPoint(item.end) }
                }
                if (item.kind === 'brush') {
                    const points = item.points
                        .map(p => ({ ...mapPoint(p), pressure: p.pressure }))
                        .filter(p => p.x >= 0 && p.x <= nextCanvasW && p.y >= 0 && p.y <= nextCanvasH)
                    return points.length ? { ...item, points } : null
                }
                if (item.kind === 'mosaic') {
                    if (item.mode === 'area' && item.area) {
                        const mappedArea = normalizeRect(
                            mapPoint({ x: item.area.x, y: item.area.y }),
                            mapPoint({ x: item.area.x + item.area.w, y: item.area.y + item.area.h }),
                        )
                        return {
                            ...item,
                            area: clampRect(mappedArea, nextCanvasW, nextCanvasH),
                            points: item.points.map(mapPoint),
                        }
                    }
                    const points = item.points
                        .map(mapPoint)
                        .filter(p => p.x >= 0 && p.x <= nextCanvasW && p.y >= 0 && p.y <= nextCanvasH)
                    return points.length ? { ...item, points } : null
                }
                return item
            })
            .filter((item): item is Annotation => !!item)

        originalImage.value = croppedImage
        history.value = buildHistory<Annotation[]>(mappedAnnotations)
        selectedId.value = null
        draftAnnotation.value = null
        imageMutated.value = true
        resetAdjustments()
        viewZoom.value = 1
        viewOffset.value = { x: 0, y: 0 }
        message.success(t('imageEditor.cropApplied'))
        scheduleRender()
    }

    function hitTest(point: Point): Annotation | null {
        const canvas = canvasRef.value
        if (!canvas) return null
        const ctx = canvas.getContext('2d')
        if (!ctx) return null

        for (let i = annotations.value.length - 1; i >= 0; i -= 1) {
            const item = annotations.value[i]
            if (!item) continue

            // 优先检测标识点（选择模式下的辅助点击点）
            if (activeTool.value === 'select') {
                const indicator = getAnnotationIndicatorPoint(item)
                const dx = point.x - indicator.x
                const dy = point.y - indicator.y
                const hitRadius = 12 // 给予较大的点击响应范围
                if (dx * dx + dy * dy <= hitRadius ** 2) return item
            }

            if (item.kind === 'number') {
                const dx = point.x - item.x
                const dy = point.y - item.y
                const radius = item.size / 2 + 10 // Add 10px hit padding
                if (dx * dx + dy * dy <= radius ** 2) return item
            }

            if (item.kind === 'text') {
                const bbox = getAnnotationBBox(item, ctx)
                const p = 12 // 12px hit padding
                if (point.x >= bbox.x - p && point.x <= bbox.x + bbox.w + p && point.y >= bbox.y - p && point.y <= bbox.y + bbox.h + p) {
                    return item
                }
            }

            if (item.kind === 'shape') {
                if (item.shape === 'line') {
                    // 直线使用线段检测
                    const dist = distanceToSegment(point, item.start, item.end)
                    if (dist <= Math.max(8, item.strokeWidth / 2 + 6)) return item
                } else {
                    // 矩形和椭圆继续使用包围盒检测
                    const rect = normalizeRect(item.start, item.end)
                    if (
                        point.x >= rect.x - 6 &&
                        point.x <= rect.x + rect.w + 6 &&
                        point.y >= rect.y - 6 &&
                        point.y <= rect.y + rect.h + 6
                    ) {
                        return item
                    }
                }
            }

            if (item.kind === 'arrow') {
                // 箭头使用线段检测
                const dist = distanceToSegment(point, item.start, item.end)
                // 容差给大一点，因为箭头比较小
                if (dist <= Math.max(12, item.width / 2 + 10)) return item
            }

            if (item.kind === 'mosaic') {
                if (item.mode === 'area' && item.area) {
                    const { x, y, w, h } = item.area
                    const p = 8 // padding
                    if (point.x >= x - p && point.x <= x + w + p && point.y >= y - p && point.y <= y + h + p) return item
                } else if (item.mode === 'brush') {
                    const threshold = item.pixelSize * 1.5 + 8
                    const bbox = getAnnotationBBox(item, ctx)
                    if (
                        point.x < bbox.x - threshold ||
                        point.x > bbox.x + bbox.w + threshold ||
                        point.y < bbox.y - threshold ||
                        point.y > bbox.y + bbox.h + threshold
                    ) {
                        continue
                    }
                    const stride = item.points.length > 1200 ? 3 : item.points.length > 500 ? 2 : 1
                    for (let j = 0; j < item.points.length - 1; j += stride) {
                        const dist = distanceToSegment(point, item.points[j]!, item.points[j + 1]!)
                        if (dist <= threshold) return item
                    }
                    if (item.points.length === 1) {
                        const p = item.points[0]!
                        const dx = point.x - p.x
                        const dy = point.y - p.y
                        if (dx * dx + dy * dy <= threshold ** 2) return item
                    }
                }
            }

            if (item.kind === 'brush') {
                // 优化画笔选区检测：检测点到每一条采样线段的距离
                const padding = 10
                const threshold = (item.size / 2) + padding
                const bbox = getAnnotationBBox(item, ctx)
                if (
                    point.x < bbox.x - threshold ||
                    point.x > bbox.x + bbox.w + threshold ||
                    point.y < bbox.y - threshold ||
                    point.y > bbox.y + bbox.h + threshold
                ) {
                    continue
                }
                const stride = item.points.length > 1200 ? 3 : item.points.length > 500 ? 2 : 1
                for (let j = 0; j < item.points.length - 1; j += stride) {
                    const p1 = item.points[j]
                    const p2 = item.points[j + 1]
                    if (p1 && p2) {
                        const dist = distanceToSegment(point, p1, p2)
                        if (dist <= threshold) return item
                    }
                }
                // 如果只有一个点的情况也要处理
                if (item.points.length === 1) {
                    const p = item.points[0]!
                    const dx = point.x - p.x
                    const dy = point.y - p.y
                    if (dx * dx + dy * dy <= (item.size / 2 + padding) ** 2) return item
                }
            }
        }

        return null
    }

    function startDraft(point: Point, event: PointerEvent) {
        if (activeTool.value === 'brush') {
            const pressure = brushPressure.value ? clamp(event.pressure || 0.5, 0.2, 1) : 1
            draftAnnotation.value = {
                id: createId('brush'),
                kind: 'brush',
                points: [{ ...point, pressure }],
                color: brushColor.value,
                size: brushSize.value,
                opacity: brushOpacity.value,
            }
        }

        if (activeTool.value === 'shape') {
            draftAnnotation.value = {
                id: createId('shape'),
                kind: 'shape',
                shape: shapeType.value,
                start: point,
                end: point,
                strokeColor: shapeStrokeColor.value,
                strokeWidth: shapeStrokeWidth.value,
                fillColor: shapeFillColor.value,
                fillOpacity: shapeFillOpacity.value,
                strokePattern: shapeStrokePattern.value,
            }
        }

        if (activeTool.value === 'arrow') {
            draftAnnotation.value = {
                id: createId('arrow'),
                kind: 'arrow',
                start: point,
                end: point,
                color: arrowColor.value,
                width: arrowWidth.value,
                direction: arrowDirection.value,
                pattern: arrowPattern.value,
                headSize: arrowHeadSize.value,
                style: arrowStyle.value,
            }
        }

        if (activeTool.value === 'mosaic') {
            draftAnnotation.value = {
                id: createId('mosaic'),
                kind: 'mosaic',
                mode: mosaicMode.value,
                shape: mosaicShape.value,
                pixelSize: mosaicPixelSize.value,
                points: [point],
                area: mosaicMode.value === 'area' ? { x: point.x, y: point.y, w: 1, h: 1 } : undefined,
            }
        }
    }

    function onCanvasPointerDown(event: PointerEvent) {
        const canvas = canvasRef.value
        if (!canvas || !props.visible || isTextEditing.value) return

        if (isCropping.value) {
            const point = getCanvasPoint(event)
            if (!point) return
            canvas.setPointerCapture(event.pointerId)
            pointerDown.value = true
            pointerStart.value = point
            cropRect.value = { x: point.x, y: point.y, w: 1, h: 1 }
            scheduleRender()
            return
        }

        if (isSpacePressed.value) {
            isPanning.value = true
            dragOrigin.value = { x: event.clientX, y: event.clientY } // Screen coords for panning
            return
        }

        const point = getCanvasPoint(event)
        if (!point) return

        canvas.setPointerCapture(event.pointerId)
        pointerDown.value = true
        pointerStart.value = point

        // Check for handles of selected item FIRST
        if (selectedAnnotation.value) {
            const ctx = canvasRef.value?.getContext('2d')
            const bbox = getAnnotationBBox(selectedAnnotation.value, ctx)
            const padding = 6
            const hs = 12 / viewZoom.value // Scale handle hit area by zoom?


            const x = bbox.x - padding
            const y = bbox.y - padding
            const w = bbox.w + padding * 2
            const h = bbox.h + padding * 2

            const handleCoords = [
                { x, y, id: 'tl' },
                { x: x + w, y, id: 'tr' },
                { x, y: y + h, id: 'bl' },
                { x: x + w, y: y + h, id: 'br' }
            ]

            let handleHit = null
            let minDist = Infinity

            const hitRadius = 12 / viewZoom.value

            handleCoords.forEach(c => {
                const isHit = point.x >= c.x - hitRadius && point.x <= c.x + hitRadius && point.y >= c.y - hitRadius && point.y <= c.y + hitRadius
                if (isHit) {
                    const dist = (point.x - c.x) ** 2 + (point.y - c.y) ** 2
                    if (dist < minDist) {
                        minDist = dist
                        handleHit = c
                    }
                }
            })

            if (handleHit) {
                activeHandle.value = (handleHit as any).id
                dragOrigin.value = point
                dragSourceAnnotations.value = annotations.value
                draggingSelection.value = false
                return
            }
        }

        // General Rule: If we click on ANY item, select it and initiate a move.
        // We only do this if "select" tool is active.
        // If a drawing tool is active, we prioritized handles above, and will prioritize drawing below.
        if (activeTool.value === 'select') {
            const hit = hitTest(point)
            if (hit) {
                if (event.shiftKey) {
                    selectedIds.value.add(hit.id)
                } else if (event.ctrlKey || event.metaKey) {
                    if (selectedIds.value.has(hit.id)) selectedIds.value.delete(hit.id)
                    else selectedIds.value.add(hit.id)
                } else {
                    if (!selectedIds.value.has(hit.id)) {
                        selectedIds.value = new Set([hit.id])
                    }
                }
                dragOrigin.value = point
                dragSourceAnnotations.value = annotations.value
                draggingSelection.value = false
                scheduleRender()
                return
            }
            // If click empty space with select tool, clear selection
            if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
                selectedIds.value.clear()
            }
            dragOrigin.value = point
            dragSourceAnnotations.value = null
            draggingSelection.value = false
            scheduleRender()
            return
        }

        if (activeTool.value === 'text') {
            // Use default text if an item is selected (avoid inheriting its text), otherwise use input value
            const textValue = (selectedId.value ? '' : textInput.value.trim()) || t('imageEditor.tools.text')
            const annotation: TextAnnotation = {
                id: createId('text'),
                kind: 'text',
                text: textValue,
                x: point.x,
                y: point.y,
                color: textColor.value,
                fontSize: textFontSize.value,
                fontFamily: textFontFamily.value,
                bold: textBold.value,
                italic: textItalic.value,
                align: 'center', // Center text at mouse position
                textStyle: textStyle.value,
                secondaryColor: textSecondaryColor.value,
                letterSpacing: textLetterSpacing.value,
            }
            pushAnnotations([...annotations.value, annotation])
            selectedId.value = annotation.id
            scheduleRender()
            return
        }

        if (activeTool.value === 'number') {
            const currentVal = numberStart.value
            const annotation: NumberAnnotation = {
                id: createId('number'),
                kind: 'number',
                value: currentVal,
                x: point.x,
                y: point.y,
                color: numberColor.value,
                size: numberSize.value,
            }
            pushAnnotations([...annotations.value, annotation])
            selectedId.value = annotation.id
            numberStart.value = currentVal + 1
            scheduleRender()
            return
        }

        startDraft(point, event)
        scheduleRender()
    }


    function reorderAnnotations(fromIndex: number, toIndex: number) {
        const list = [...annotations.value]
        const [removed] = list.splice(fromIndex, 1)
        if (removed) {
            list.splice(toIndex, 0, removed)
            pushAnnotations(list)
            scheduleRender()
        }
    }

    function onCanvasWheel(event: WheelEvent) {
        event.preventDefault()
        event.stopPropagation()
        const delta = event.deltaY > 0 ? -1 : 1

        // Priority 1: Scale selected item (Legacy/Existing Feature)
        if (selectedId.value && !event.altKey && !event.ctrlKey) {
            // Hold Shift for faster resize
            const step = event.shiftKey ? 5 : 1
            history.value = {
                ...history.value,
                present: withUpdatedAnnotation(selectedId.value, item => {
                    const next = { ...item }
                    if (next.kind === 'text') {
                        next.fontSize = Math.max(10, next.fontSize + delta * step)
                    } else if (next.kind === 'number') {
                        next.size = Math.max(10, next.size + delta * step)
                    } else if (next.kind === 'brush') {
                        next.size = Math.max(1, next.size + delta * step)
                    } else if (next.kind === 'shape') {
                        next.strokeWidth = Math.max(1, next.strokeWidth + delta * 0.5 * step) // Slower for stroke width
                    } else if (next.kind === 'arrow') {
                        next.width = Math.max(1, next.width + delta * 0.5 * step)
                        next.headSize = Math.max(6, next.headSize + delta * step)
                    } else if (next.kind === 'mosaic') {
                        next.pixelSize = Math.max(2, next.pixelSize + delta * step)
                    }
                    return next
                }),
            }
            scheduleRender()
            return
        }

        // Priority 2: Zoom View
        // Zoom factors:
        const zoomStep = 0.1
        const newZoom = viewZoom.value + (delta * zoomStep)
        // Limit Zoom
        viewZoom.value = clamp(newZoom, 0.1, 10.0)
        scheduleRender()
    }

    function onCanvasPointerMove(event: PointerEvent) {
        if (isTextEditing.value) return

        if (isCropping.value) {
            if (!pointerDown.value || !pointerStart.value) return
            const point = getCanvasPoint(event)
            if (!point) return
            cropRect.value = clampRect(
                normalizeRect(pointerStart.value, point),
                displayInfo.value.canvasW,
                displayInfo.value.canvasH,
            )
            scheduleRender()
            return
        }

        if (isPanning.value && dragOrigin.value) {
            const dx = event.clientX - dragOrigin.value.x
            const dy = event.clientY - dragOrigin.value.y
            viewOffset.value = {
                x: viewOffset.value.x + dx,
                y: viewOffset.value.y + dy
            }
            dragOrigin.value = { x: event.clientX, y: event.clientY }
            scheduleRender()
            return
        }

        if (!pointerDown.value) return

        const point = getCanvasPoint(event)
        if (!point) return

        // 1. Handle Resizing
        if (activeHandle.value && selectedId.value && dragOrigin.value) {
            const h = activeHandle.value
            const dx = point.x - dragOrigin.value.x
            const dy = point.y - dragOrigin.value.y

            history.value = {
                ...history.value,
                present: withUpdatedAnnotation(selectedId.value, item => {
                    const next = { ...item } as any
                    const ctx = canvasRef.value?.getContext('2d')
                    const bbox = getAnnotationBBox(item, ctx)

                    const isL = h.includes('l')
                    const isR = h.includes('r')
                    const isT = h.includes('t')
                    const isB = h.includes('b')

                    if (item.kind === 'shape' || item.kind === 'arrow') {
                        const width = displayInfo.value.canvasW
                        const height = displayInfo.value.canvasH

                        // Clone points to avoid direct state mutation
                        next.start = { ...item.start }
                        next.end = { ...item.end }

                        if (isL) {
                            if (next.start.x <= next.end.x) next.start.x = clamp(next.start.x + dx, 0, width)
                            else next.end.x = clamp(next.end.x + dx, 0, width)
                        }
                        if (isR) {
                            if (next.start.x > next.end.x) next.start.x = clamp(next.start.x + dx, 0, width)
                            else next.end.x = clamp(next.end.x + dx, 0, width)
                        }
                        if (isT) {
                            if (next.start.y <= next.end.y) next.start.y = clamp(next.start.y + dy, 0, height)
                            else next.end.y = clamp(next.end.y + dy, 0, height)
                        }
                        if (isB) {
                            if (next.start.y > next.end.y) next.start.y = clamp(next.start.y + dy, 0, height)
                            else next.end.y = clamp(next.end.y + dy, 0, height)
                        }
                    } else if (item.kind === 'text' || item.kind === 'number') {
                        const nextW = Math.max(4, bbox.w + (isR ? dx : -dx))
                        const nextH = Math.max(4, bbox.h + (isB ? dy : -dy))
                        const scaleW = nextW / bbox.w
                        const scaleH = nextH / bbox.h
                        const scale = (scaleW + scaleH) / 2
                        if (item.kind === 'text') next.fontSize = Math.max(8, item.fontSize * scale)
                        else next.size = Math.max(8, item.size * scale)

                        if (isL) next.x += dx
                        if (isT) next.y += dy
                    } else if (item.kind === 'brush' || item.kind === 'mosaic') {
                        const nextW = Math.max(2, bbox.w + (isR ? dx : -dx))
                        const nextH = Math.max(2, bbox.h + (isB ? dy : -dy))
                        const scaleX = nextW / bbox.w
                        const scaleY = nextH / bbox.h
                        const originX = isL ? bbox.x + bbox.w : bbox.x
                        const originY = isT ? bbox.y + bbox.h : bbox.y

                        if (item.kind === 'brush') {
                            next.points = item.points.map(p => ({
                                ...p,
                                x: originX + (p.x - originX) * scaleX,
                                y: originY + (p.y - originY) * scaleY
                            }))
                        } else if (item.kind === 'mosaic' && item.mode === 'brush') {
                            next.points = item.points.map(p => ({
                                x: originX + (p.x - originX) * scaleX,
                                y: originY + (p.y - originY) * scaleY
                            }))
                        } else if (item.kind === 'mosaic' && item.mode === 'area' && item.area) {
                            next.area = {
                                x: isL ? item.area.x + dx : item.area.x,
                                y: isT ? item.area.y + dy : item.area.y,
                                w: Math.max(1, item.area.w + (isR ? dx : -dx)),
                                h: Math.max(1, item.area.h + (isB ? dy : -dy))
                            }
                        }
                    }
                    return next
                })
            }
            dragOrigin.value = point
            draggingSelection.value = true
            scheduleRender()
            return
        }

        // 2. Dragging Items (Supports Group Move)
        if (dragSourceAnnotations.value && selectedIds.value.size > 0 && dragOrigin.value) {
            const dx = point.x - dragOrigin.value.x
            const dy = point.y - dragOrigin.value.y
            const width = displayInfo.value.canvasW
            const height = displayInfo.value.canvasH
            const ids = Array.from(selectedIds.value)

            history.value = {
                ...history.value,
                present: history.value.present.map(item => {
                    if (ids.includes(item.id)) {
                        return translateAnnotation(item, dx, dy, width, height)
                    }
                    return item
                }),
            }

            dragOrigin.value = point
            draggingSelection.value = true
            scheduleRender()
            return
        }

        if (!draftAnnotation.value || !pointerStart.value) return

        if (draftAnnotation.value.kind === 'brush') {
            const pressure = brushPressure.value ? clamp(event.pressure || 0.5, 0.2, 1) : 1
            draftAnnotation.value = {
                ...draftAnnotation.value,
                points: [...draftAnnotation.value.points, { ...point, pressure }],
            }
        }

        if (draftAnnotation.value.kind === 'shape') {
            draftAnnotation.value = {
                ...draftAnnotation.value,
                end: point,
            }
        }

        if (draftAnnotation.value.kind === 'arrow') {
            draftAnnotation.value = {
                ...draftAnnotation.value,
                end: point,
            }
        }

        if (draftAnnotation.value.kind === 'mosaic') {
            if (draftAnnotation.value.mode === 'area') {
                const rect = normalizeRect(pointerStart.value, point)
                draftAnnotation.value = {
                    ...draftAnnotation.value,
                    area: rect,
                }
            } else {
                const prev = draftAnnotation.value.points[draftAnnotation.value.points.length - 1]
                const minStep = Math.max(1, draftAnnotation.value.pixelSize * 0.55 / Math.max(viewZoom.value, 0.1))
                if (!prev || (point.x - prev.x) ** 2 + (point.y - prev.y) ** 2 >= minStep ** 2) {
                    draftAnnotation.value = {
                        ...draftAnnotation.value,
                        points: [...draftAnnotation.value.points, point],
                    }
                }
            }
        }

        scheduleRender()
    }

    function onCanvasPointerUp(event: PointerEvent) {
        const canvas = canvasRef.value
        if (canvas) canvas.releasePointerCapture(event.pointerId)

        if (isCropping.value) {
            pointerDown.value = false
            pointerStart.value = null
            dragOrigin.value = null
            if (cropRect.value && (cropRect.value.w < 2 || cropRect.value.h < 2)) {
                cropRect.value = null
            }
            scheduleRender()
            return
        }

        if (isPanning.value) {
            isPanning.value = false
            dragOrigin.value = null
            // Don't return, allow cleanup of other states? 
            // Panning should be exclusive.
            return
        }

        pointerDown.value = false
        dragOrigin.value = null
        activeHandle.value = null

        // If we were dragging, record history
        if (draggingSelection.value && dragSourceAnnotations.value) {
            history.value = historyPush(
                {
                    past: [...history.value.past],
                    present: dragSourceAnnotations.value,
                    future: [],
                },
                history.value.present,
            )
            dragSourceAnnotations.value = null
            draggingSelection.value = false
            scheduleRender()
            return
        }

        dragSourceAnnotations.value = null
        draggingSelection.value = false

        if (activeTool.value === 'select') {
            scheduleRender()
            return
        }

        if (!draftAnnotation.value) {
            scheduleRender()
            return
        }

        const annotation = draftAnnotation.value
        draftAnnotation.value = null
        pointerStart.value = null

        if (annotation.kind === 'brush' && annotation.points.length < 2) {
            scheduleRender()
            return
        }

        if (annotation.kind === 'mosaic' && annotation.mode === 'brush' && annotation.points.length < 2) {
            scheduleRender()
            return
        }

        pushAnnotations([...annotations.value, annotation])
        selectedId.value = annotation.id
        scheduleRender()
    }

    // 双击编辑已移除，文本可通过侧边栏直接编辑

    function groupSelected() {
        const ids = Array.from(selectedIds.value)
        if (ids.length < 2) return

        const children = annotations.value.filter(a => ids.includes(a.id))
        const remaining = annotations.value.filter(a => !ids.includes(a.id))

        const group: GroupAnnotation = {
            id: createId('group'),
            kind: 'group',
            children: children
        }

        pushAnnotations([...remaining, group])
        selectedId.value = group.id
        scheduleRender()
    }

    function ungroupSelected() {
        if (selectedIds.value.size !== 1) return
        const id = Array.from(selectedIds.value)[0]
        const groupIdx = annotations.value.findIndex(a => a.id === id)
        const group = annotations.value[groupIdx]

        if (group?.kind !== 'group') return

        const children = group.children
        const nextAnnotations = [...annotations.value]
        nextAnnotations.splice(groupIdx, 1, ...children)

        pushAnnotations(nextAnnotations)
        selectedIds.value = new Set(children.map(c => c.id))
        scheduleRender()
    }

    // Helper to translate any annotation by dx, dy
    function translateAnnotation(item: Annotation, dx: number, dy: number, width: number, height: number): Annotation {
        if (item.kind === 'text' || item.kind === 'number') {
            return { ...item, ...translateInBounds({ x: (item as any).x, y: (item as any).y }, dx, dy, width, height) }
        }
        if (item.kind === 'shape' || item.kind === 'arrow') {
            return {
                ...item,
                start: translateInBounds(item.start, dx, dy, width, height),
                end: translateInBounds(item.end, dx, dy, width, height),
            }
        }
        if (item.kind === 'mosaic' || item.kind === 'brush') {
            return {
                ...item,
                points: item.points.map(p => {
                    const np = translateInBounds(p, dx, dy, width, height)
                    return (item.kind === 'brush') ? { ...np, pressure: (p as any).pressure } : np
                }),
                area: (item.kind === 'mosaic' && item.area)
                    ? { ...item.area, x: clamp(item.area.x + dx, 0, width), y: clamp(item.area.y + dy, 0, height) }
                    : undefined
            } as any
        }
        if (item.kind === 'group') {
            return {
                ...item,
                children: item.children.map(child => translateAnnotation(child, dx, dy, width, height))
            }
        }
        return item
    }

    function confirmTextEdit() {
        if (!selectedId.value) return
        const nextText = editingText.value
        pushAnnotations(withUpdatedAnnotation(selectedId.value, item => (item.kind === 'text' ? { ...item, text: nextText } : item)))
        isTextEditing.value = false
        scheduleRender()
    }

    // ...











    function onGlobalKeydown(event: KeyboardEvent) {
        if (!props.visible) return

        // 如果焦点在输入框内，不拦截快捷键（除非是特定组合键如 Ctrl+Enter）
        const target = event.target as HTMLElement
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

        if (isTextEditing.value) {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault()
                confirmTextEdit()
            }
            if (event.key === 'Escape') {
                event.preventDefault()
                isTextEditing.value = false
            }
            return
        }

        if (isInput) return

        if (event.code === 'Space' && !event.repeat) {
            event.preventDefault()
            onSpaceDown()
        }

        const key = event.key.toLowerCase()
        const ctrl = event.ctrlKey || event.metaKey

        if (ctrl && key === 'z') {
            event.preventDefault()
            undo()
            return
        }

        if (ctrl && key === 'y') {
            event.preventDefault()
            redo()
            return
        }

        if (key === 'delete' || key === 'backspace') {
            removeSelected()
            return
        }

        if (key === 'escape') {
            if (isCropping.value) {
                cancelCrop()
                return
            }
            selectedId.value = null
            draftAnnotation.value = null
            scheduleRender()
            return
        }

        if (TOOL_SHORTCUT_MAP[key]) {
            const nextTool = TOOL_SHORTCUT_MAP[key]
            if (nextTool === 'crop') {
                startCrop()
            } else {
                activeTool.value = nextTool
                uiPanel.value = 'tool'
                selectedId.value = null
                draftAnnotation.value = null
                if (isCropping.value) {
                    cancelCrop()
                    activeTool.value = nextTool
                }
            }
            scheduleRender()
        }
    }

    function onGlobalKeyup(event: KeyboardEvent) {
        if (event.code === 'Space') {
            onSpaceUp()
        }
    }

    function rotateLeft() {
        rotation.value = (rotation.value - 90 + 360) % 360
        scheduleRender()
    }

    function rotateRight() {
        rotation.value = (rotation.value + 90) % 360
        scheduleRender()
    }

    function toggleFlipH() {
        flipH.value = !flipH.value
        scheduleRender()
    }

    function zoomIn() {
        viewZoom.value = clamp(viewZoom.value + 0.1, 0.1, 10.0)
        scheduleRender()
    }

    function zoomOut() {
        viewZoom.value = clamp(viewZoom.value - 0.1, 0.1, 10.0)
        scheduleRender()
    }

    function setZoom(nextZoom: number) {
        viewZoom.value = clamp(nextZoom, 0.1, 10.0)
        scheduleRender()
    }

    function toggleFlipV() {
        flipV.value = !flipV.value
        scheduleRender()
    }

    async function saveEdit() {
        const canvas = canvasRef.value
        const img = originalImage.value
        if (!canvas || !img) return

        isSaving.value = true
        try {
            const { exportW, exportH, canvasW } = displayInfo.value
            const exportCanvas = document.createElement('canvas')
            exportCanvas.width = exportW
            exportCanvas.height = exportH
            const ctx = exportCanvas.getContext('2d')
            if (!ctx) return

            const filterString = buildFilterString(
                brightness.value,
                contrast.value,
                saturate.value,
                activeFilter.value,
                filterPresets,
            )
            drawBaseLayer(
                ctx,
                img,
                exportW,
                exportH,
                1,
                scale.value,
                rotation.value,
                flipH.value,
                flipV.value,
                filterString,
            )
            const factor = exportW / canvasW
            annotations.value.forEach(item => drawAnnotation(ctx, item, factor))

            const mimeType = props.file.type || 'image/png'
            const quality = mimeType === 'image/jpeg' || mimeType === 'image/webp' ? 0.92 : undefined

            const blob = await new Promise<Blob>((resolve, reject) => {
                exportCanvas.toBlob(currentBlob => {
                    if (currentBlob) resolve(currentBlob)
                    else reject(new Error('Failed to export image'))
                }, mimeType, quality)
            })

            const outputFile = new File([blob], props.file.name, {
                type: blob.type || mimeType,
                lastModified: Date.now(),
            })
            const outputPreview = URL.createObjectURL(blob)
            emit('save', { file: outputFile, preview: outputPreview })
            message.success(t('imageEditor.saveSuccess'))
        } catch (error) {
            console.error('[ImageEditor] Save failed', error)
            message.error(t('imageEditor.saveFailed'))
        } finally {
            isSaving.value = false
        }
    }

    watch(() => props.visible, visible => {
        if (visible) {
            nextTick(() => {
                loadImage()
                window.addEventListener('keydown', onGlobalKeydown)
                window.addEventListener('keyup', onGlobalKeyup)
            })
        } else {
            window.removeEventListener('keydown', onGlobalKeydown)
            window.removeEventListener('keyup', onGlobalKeyup)
        }
    })

    watch(selectedAnnotation, (item, oldItem) => {
        if (isSyncing) return

        if (!item) {
            // Reset text input on deselect so new text starts fresh
            textInput.value = ''
            return
        }

        // Only switch tool/panel if it's a new selection (ID changed)
        const isNewSelection = !oldItem || item.id !== oldItem.id

        isSyncing = true

        if (isNewSelection) {
            // Only switch tool if current tool is NOT select
            if (activeTool.value !== 'select') {
                activeTool.value = item.kind as any
            }
            uiPanel.value = 'tool'
        }

        if (item.kind === 'brush') {
            brushColor.value = item.color
            brushSize.value = item.size
            brushOpacity.value = item.opacity
        } else if (item.kind === 'shape') {
            shapeType.value = item.shape
            shapeStrokeColor.value = item.strokeColor
            shapeStrokeWidth.value = item.strokeWidth
            shapeFillColor.value = item.fillColor
            shapeFillOpacity.value = item.fillOpacity
            shapeStrokePattern.value = item.strokePattern
        } else if (item.kind === 'arrow') {
            arrowColor.value = item.color
            arrowWidth.value = item.width
            arrowDirection.value = item.direction
            arrowPattern.value = item.pattern
            arrowHeadSize.value = item.headSize
            arrowStyle.value = item.style || 'modern'
        } else if (item.kind === 'text') {
            textInput.value = item.text
            textColor.value = item.color
            textFontSize.value = item.fontSize
            textFontFamily.value = item.fontFamily
            textBold.value = item.bold
            textItalic.value = item.italic
            textAlign.value = item.align
            textStyle.value = item.textStyle || 'fill'
            textSecondaryColor.value = item.secondaryColor || '#3b82f6'
            textLetterSpacing.value = item.letterSpacing || 0
        } else if (item.kind === 'mosaic') {
            mosaicMode.value = item.mode
            mosaicShape.value = item.shape
            mosaicPixelSize.value = item.pixelSize
        } else if (item.kind === 'number') {
            numberColor.value = item.color
            numberSize.value = item.size
            numberValue.value = item.value
        }

        nextTick(() => { isSyncing = false })
    }, { deep: true })

    // Sync back: Update selected annotation when refs change
    const syncToSelected = (updater: (item: any) => any) => {
        if (selectedIds.value.size === 0 || isSyncing) return
        const ids = Array.from(selectedIds.value)
        history.value = {
            ...history.value,
            present: annotations.value.map(item => ids.includes(item.id) ? updater(item) : item)
        }
        scheduleRender()
    }

    watch([brushColor, brushSize, brushOpacity], () => syncToSelected(i => i.kind === 'brush' ? { ...i, color: brushColor.value, size: brushSize.value, opacity: brushOpacity.value } : i))
    watch([shapeType, shapeStrokeColor, shapeStrokeWidth, shapeFillColor, shapeFillOpacity, shapeStrokePattern], () => syncToSelected(i => i.kind === 'shape' ? { ...i, shape: shapeType.value, strokeColor: shapeStrokeColor.value, strokeWidth: shapeStrokeWidth.value, fillColor: shapeFillColor.value, fillOpacity: shapeFillOpacity.value, strokePattern: shapeStrokePattern.value } : i))
    watch([arrowColor, arrowWidth, arrowDirection, arrowPattern, arrowHeadSize, arrowStyle], () => syncToSelected(i => i.kind === 'arrow' ? { ...i, color: arrowColor.value, width: arrowWidth.value, direction: arrowDirection.value, pattern: arrowPattern.value, headSize: arrowHeadSize.value, style: arrowStyle.value } : i))
    // Special case for Text: don't sync text content if multiple items selected to avoid overwriting different texts
    watch([textInput, textColor, textFontSize, textFontFamily, textBold, textItalic, textAlign, textStyle, textSecondaryColor, textLetterSpacing], () => syncToSelected(i => i.kind === 'text' ? {
        ...i,
        text: (selectedIds.value.size > 1 ? i.text : textInput.value),
        color: textColor.value,
        fontSize: textFontSize.value,
        fontFamily: textFontFamily.value,
        bold: textBold.value,
        italic: textItalic.value,
        align: textAlign.value,
        textStyle: textStyle.value,
        secondaryColor: textSecondaryColor.value,
        letterSpacing: textLetterSpacing.value
    } : i))
    watch([mosaicMode, mosaicShape, mosaicPixelSize], () => syncToSelected(i => i.kind === 'mosaic' ? { ...i, mode: mosaicMode.value, shape: mosaicShape.value, pixelSize: mosaicPixelSize.value } : i))
    watch([numberColor, numberSize], () => syncToSelected(i => i.kind === 'number' ? { ...i, color: numberColor.value, size: numberSize.value } : i))
    watch(numberValue, () => syncToSelected(i => i.kind === 'number' ? { ...i, value: numberValue.value } : i))

    // Re-add global render watcher
    watch(
        [rotation, flipH, flipV, scale, brightness, contrast, saturate, activeFilter, annotations, draftAnnotation, selectedId, viewOffset, viewZoom],
        () => {
            nextTick(scheduleRender)
        },
    )

    function onResize() {
        scheduleRender()
    }

    let animationFrameId: number | null = null
    let lastSelectionFrameAt = 0
    const animateSelection = () => {
        if (selectedId.value && props.visible) {
            const now = performance.now()
            if (now - lastSelectionFrameAt >= 120) {
                lastSelectionFrameAt = now
                scheduleRender()
            }
        }
        animationFrameId = requestAnimationFrame(animateSelection)
    }

    onMounted(() => {
        window.addEventListener('resize', onResize)
        window.addEventListener('keydown', onGlobalKeydown)
        window.addEventListener('keyup', onGlobalKeyup)
        animateSelection()
        if (props.visible) loadImage()
    })

    onUnmounted(() => {
        window.removeEventListener('resize', onResize)
        window.removeEventListener('keydown', onGlobalKeydown)
        window.removeEventListener('keyup', onGlobalKeyup)
        if (animationFrameId) cancelAnimationFrame(animationFrameId)
    })

    return {
        // Refs
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
        displayInfo,
        isCropping,
        cropRect,
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
        changeLayer,
        startCrop,
        cancelCrop,
        applyCrop,
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
        onCanvasWheel,
        onGlobalKeydown,
        groupSelected,
        ungroupSelected,
        renameAnnotation,
        getAnnotationLabel,
        reorderAnnotations,
        confirmTextEdit,
        onSpaceDown,
        onSpaceUp,
        zoomIn,
        zoomOut,
        setZoom,
        viewZoom,
        viewOffset,
        isPanning,
        isSpacePressed,
    }
}
