
import {
    type Annotation,
    type ArrowAnnotation,
    type ArrowStyle,
    type BrushAnnotation,
    type GroupAnnotation,
    type MosaicAnnotation,
    type NumberAnnotation,
    type Point,
    type ShapeAnnotation,
    type StrokePattern,
    type TextAnnotation,
    buildArrowHead,
    normalizeRect,
} from './editorCore'
import { type FilterPreset, type FilterPresetItem } from '@/constants/editorConfig'
import { FILTER_PRESETS } from '@/constants/editorConfig'

let mosaicSourceCanvas: HTMLCanvasElement | null = null
let mosaicTinyCanvas: HTMLCanvasElement | null = null
let mosaicMaskCanvas: HTMLCanvasElement | null = null

function ensureCanvasSize(canvas: HTMLCanvasElement, w: number, h: number) {
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h
}

function getMosaicScratchCanvases() {
    if (!mosaicSourceCanvas) mosaicSourceCanvas = document.createElement('canvas')
    if (!mosaicTinyCanvas) mosaicTinyCanvas = document.createElement('canvas')
    if (!mosaicMaskCanvas) mosaicMaskCanvas = document.createElement('canvas')
    return {
        source: mosaicSourceCanvas,
        tiny: mosaicTinyCanvas,
        mask: mosaicMaskCanvas,
    }
}

export function buildFilterString(
    brightness: number,
    contrast: number,
    saturate: number,
    activeFilter: string,
    filterPresets: Record<string, FilterPresetItem>
) {
    let filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`
    if (activeFilter !== 'none' && filterPresets[activeFilter]) {
        filter += ` ${filterPresets[activeFilter].css}`
    }
    return filter
}

export function configureStrokePattern(ctx: CanvasRenderingContext2D, pattern: StrokePattern) {
    if (pattern === 'dashed') {
        const dashSize = Math.max(5, ctx.lineWidth * 2)
        const gapSize = Math.max(3, ctx.lineWidth)
        ctx.setLineDash([dashSize, gapSize])
    } else {
        ctx.setLineDash([])
    }
}

export function drawBaseLayer(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    canvasW: number,
    canvasH: number,
    fitScale: number,
    scale: number,
    rotation: number,
    flipH: boolean,
    flipV: boolean,
    filterString: string
) {
    const scaledW = image.naturalWidth * (scale / 100) * fitScale
    const scaledH = image.naturalHeight * (scale / 100) * fitScale

    ctx.save()
    // ctx.clearRect(0, 0, canvasW, canvasH) // Managed by render loop
    ctx.filter = filterString
    ctx.translate(canvasW / 2, canvasH / 2)
    ctx.rotate((rotation * Math.PI) / 180)
    if (flipH) ctx.scale(-1, 1)
    if (flipV) ctx.scale(1, -1)
    ctx.drawImage(image, -scaledW / 2, -scaledH / 2, scaledW, scaledH)
    ctx.restore()
}

export function drawBrush(ctx: CanvasRenderingContext2D, item: BrushAnnotation, scaleFactor = 1) {
    if (item.points.length < 2) return
    ctx.save()
    ctx.strokeStyle = item.color
    ctx.globalAlpha = item.opacity
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    for (let i = 1; i < item.points.length; i += 1) {
        const prev = item.points[i - 1]!
        const curr = item.points[i]!
        ctx.beginPath()
        ctx.lineWidth = item.size * ((prev.pressure + curr.pressure) / 2) * scaleFactor
        ctx.moveTo(prev.x * scaleFactor, prev.y * scaleFactor)
        ctx.lineTo(curr.x * scaleFactor, curr.y * scaleFactor)
        ctx.stroke()
    }
    ctx.restore()
}

export function drawShape(ctx: CanvasRenderingContext2D, item: ShapeAnnotation, scaleFactor = 1) {
    const start = { x: item.start.x * scaleFactor, y: item.start.y * scaleFactor }
    const end = { x: item.end.x * scaleFactor, y: item.end.y * scaleFactor }
    const rect = normalizeRect(start, end)

    ctx.save()
    ctx.lineWidth = item.strokeWidth * scaleFactor
    ctx.strokeStyle = item.strokeColor
    configureStrokePattern(ctx, item.strokePattern)
    ctx.fillStyle = item.fillColor
    ctx.globalAlpha = item.fillOpacity

    if (item.shape === 'rect') {
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
        ctx.globalAlpha = 1
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)
    } else if (item.shape === 'ellipse') {
        ctx.beginPath()
        ctx.ellipse(rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w / 2, rect.h / 2, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
        ctx.stroke()
    } else {
        ctx.globalAlpha = 1
        ctx.beginPath()
        ctx.moveTo(start.x, start.y)
        ctx.lineTo(end.x, end.y)
        ctx.stroke()
    }
    ctx.restore()
}

export function drawArrowHead(ctx: CanvasRenderingContext2D, from: Point, to: Point, size: number, style: ArrowStyle = 'modern') {
    const [left, right, base] = buildArrowHead(from, to, size)
    ctx.save()
    if (style === 'classic') {
        // Classic is just two lines, no fill
        ctx.beginPath()
        ctx.moveTo(left.x, left.y)
        ctx.lineTo(to.x, to.y)
        ctx.lineTo(right.x, right.y)
        ctx.stroke()
    } else {
        ctx.fillStyle = ctx.strokeStyle
        ctx.beginPath()
        ctx.moveTo(to.x, to.y)
        ctx.lineTo(left.x, left.y)
        if (style === 'modern') {
            ctx.lineTo(base.x, base.y) // Barbed indent
        } else {
            // Flat base for bold/tapered
            const angle = Math.atan2(to.y - from.y, to.x - from.x)
            const baseLen = size * Math.cos(Math.PI / 6)
            ctx.lineTo(to.x - baseLen * Math.cos(angle), to.y - baseLen * Math.sin(angle))
        }
        ctx.lineTo(right.x, right.y)
        ctx.closePath()
        ctx.fill()
    }
    ctx.restore()
}

export function drawArrow(ctx: CanvasRenderingContext2D, item: ArrowAnnotation, scaleFactor = 1) {
    const start = { x: item.start.x * scaleFactor, y: item.start.y * scaleFactor }
    const end = { x: item.end.x * scaleFactor, y: item.end.y * scaleFactor }
    const headSize = item.headSize * scaleFactor
    const width = item.width * scaleFactor
    const style = item.style || 'modern'
    const isDouble = item.direction === 'double'

    ctx.save()
    ctx.fillStyle = item.color
    ctx.strokeStyle = item.color
    ctx.lineWidth = width
    ctx.lineJoin = 'round'
    ctx.lineCap = 'butt' // Unify dash style to straight blocks for all arrows

    const dx = end.x - start.x
    const dy = end.y - start.y
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len < 1) { ctx.restore(); return }

    const ux = dx / len
    const uy = dy / len
    const px = -uy
    const py = ux

    const headBaseLen = headSize * Math.cos(Math.PI / 6)

    // For bold/tapered, we only use the integrated path if it's solid.
    // If it has a pattern (dashed), we fall back to line + separate heads to make the pattern visible.
    const isSolid = !item.pattern || item.pattern === 'solid'

    if ((style === 'bold' || style === 'tapered') && isSolid) {
        const halfWidth = width / 2
        const sWidth = style === 'tapered' ? 2 * scaleFactor : halfWidth

        ctx.beginPath()

        // Start side
        let shaftStart = start
        if (isDouble) {
            const [hL, hR] = buildArrowHead(end, start, headSize)
            shaftStart = { x: start.x + ux * headBaseLen, y: start.y + uy * headBaseLen }
            ctx.moveTo(start.x, start.y)
            ctx.lineTo(hL.x, hL.y)
            ctx.lineTo(shaftStart.x - px * halfWidth, shaftStart.y - py * halfWidth)
        } else {
            ctx.moveTo(start.x + px * sWidth, start.y + py * sWidth)
            ctx.lineTo(start.x - px * sWidth, start.y - py * sWidth)
        }

        // End side
        const shaftEnd = { x: end.x - ux * headBaseLen, y: end.y - uy * headBaseLen }
        const [hL, hR] = buildArrowHead(start, end, headSize)

        ctx.lineTo(shaftEnd.x - px * halfWidth, shaftEnd.y - py * halfWidth)
        ctx.lineTo(hR.x, hR.y)
        ctx.lineTo(end.x, end.y)
        ctx.lineTo(hL.x, hL.y)
        ctx.lineTo(shaftEnd.x + px * halfWidth, shaftEnd.y + py * halfWidth)

        // Back to start side
        if (isDouble) {
            const [hL2, hR2] = buildArrowHead(end, start, headSize)
            ctx.lineTo(shaftStart.x + px * halfWidth, shaftStart.y + py * halfWidth)
            ctx.lineTo(hR2.x, hR2.y)
        } else {
            ctx.lineTo(start.x + px * sWidth, start.y + py * sWidth)
        }

        ctx.closePath()
        ctx.fill()
    } else {
        // Line based drawing (Classic, Modern, or Dashed Bold)
        configureStrokePattern(ctx, item.pattern)

        // Determine where the shaft starts and ends
        // Modern and Bold should stop at the head base
        const needsIndent = style !== 'classic'

        let lineStart = start
        let lineEnd = end

        if (needsIndent) {
            lineEnd = { x: end.x - ux * headBaseLen, y: end.y - uy * headBaseLen }
            if (isDouble) {
                lineStart = { x: start.x + ux * headBaseLen, y: start.y + uy * headBaseLen }
            }
        }

        if (style === 'tapered') {
            // Tapered dashed line needs manual segmentation
            const shaftDx = lineEnd.x - lineStart.x
            const shaftDy = lineEnd.y - lineStart.y
            const shaftLen = Math.sqrt(shaftDx * shaftDx + shaftDy * shaftDy)

            if (shaftLen > 0) {
                const startW = isDouble ? width : (2 * scaleFactor)
                const endW = width

                // Dash config
                const dashLen = Math.max(5, width * 2)
                const gapLen = Math.max(3, width)
                const cycle = dashLen + gapLen

                const sux = shaftDx / shaftLen
                const suy = shaftDy / shaftLen
                const spx = -suy
                const spy = sux

                let curr = 0
                while (curr < shaftLen) {
                    const segStart = curr
                    const segEnd = Math.min(curr + dashLen, shaftLen)

                    // Calc widths
                    const wStart = startW + (endW - startW) * (segStart / shaftLen)
                    const wEnd = startW + (endW - startW) * (segEnd / shaftLen)

                    // Points
                    const p1 = { x: lineStart.x + sux * segStart, y: lineStart.y + suy * segStart }
                    const p2 = { x: lineStart.x + sux * segEnd, y: lineStart.y + suy * segEnd }

                    ctx.beginPath()
                    ctx.moveTo(p1.x + spx * (wStart / 2), p1.y + spy * (wStart / 2))
                    ctx.lineTo(p2.x + spx * (wEnd / 2), p2.y + spy * (wEnd / 2))
                    ctx.lineTo(p2.x - spx * (wEnd / 2), p2.y - spy * (wEnd / 2))
                    ctx.lineTo(p1.x - spx * (wStart / 2), p1.y - spy * (wStart / 2))
                    ctx.closePath()
                    ctx.fill()

                    curr += cycle
                }
            }
        } else {
            // Regular line
            ctx.beginPath()
            ctx.moveTo(lineStart.x, lineStart.y)
            ctx.lineTo(lineEnd.x, lineEnd.y)
            ctx.stroke()
        }

        // Draw heads (reset dash pattern for heads)
        ctx.setLineDash([])
        drawArrowHead(ctx, start, end, headSize, style)
        if (isDouble) {
            drawArrowHead(ctx, end, start, headSize, style)
        }
    }
    ctx.restore()
}

export function resolveTextFont(item: { fontSize: number, bold: boolean, italic: boolean, fontFamily: string }, scaleFactor = 1) {
    const weight = item.bold ? 'bold' : 'normal'
    const style = item.italic ? 'italic' : 'normal'
    const fontFamily = item.fontFamily || 'Arial'
    // Adding quotes around font names with spaces and providing a generic fallback
    const family = fontFamily.includes(' ') ? `"${fontFamily}"` : fontFamily
    const fallback = fontFamily === 'Courier New' || fontFamily === 'Monaco' ? 'monospace' :
        fontFamily === 'Georgia' || fontFamily === 'Times New Roman' ? 'serif' : 'sans-serif'

    return `${style} ${weight} ${Math.max(10, item.fontSize * scaleFactor)}px ${family}, ${fallback}`
}

export function drawText(ctx: CanvasRenderingContext2D, item: TextAnnotation, scaleFactor = 1) {
    ctx.save()
    ctx.textAlign = 'left' // Explicitly use left for char-by-char positioning
    ctx.textBaseline = 'middle'
    ctx.font = resolveTextFont(item, scaleFactor)
    const style = item.textStyle || 'fill'
    const letterSpacing = (item.letterSpacing || 0) * scaleFactor
    const secondaryColor = item.secondaryColor || '#3b82f6'

    const lines = item.text.split('\n')
    const lineHeight = item.fontSize * 1.2 * scaleFactor

    // Calculate layout with letter spacing
    const lineLayouts = lines.map(line => {
        let width = 0
        const charWidths = []
        for (let i = 0; i < line.length; i++) {
            const cw = ctx.measureText(line[i]!).width
            charWidths.push(cw)
            width += cw + (i < line.length - 1 ? letterSpacing : 0)
        }
        return { line, width, charWidths }
    })

    const maxWidth = Math.max(0, ...lineLayouts.map(l => l.width))
    const totalHeight = lines.length * lineHeight
    const startX = item.x * scaleFactor
    const visualStartY = item.y * scaleFactor

    if (style === 'background') {
        const paddingH = item.fontSize * 0.4 * scaleFactor
        const paddingV = item.fontSize * 0.2 * scaleFactor
        ctx.fillStyle = secondaryColor

        ctx.beginPath()
        const r = 4 * scaleFactor
        const visualStartX = item.align === 'center' ? startX - maxWidth / 2 : item.align === 'right' ? startX - maxWidth : startX
        const bx = visualStartX - paddingH
        const by = visualStartY - totalHeight / 2 - paddingV
        const bw = maxWidth + paddingH * 2
        const bh = totalHeight + paddingV * 2

        ctx.roundRect(bx, by, bw, bh, r)
        ctx.fill()

        ctx.fillStyle = item.color
    } else if (style === 'shadow') {
        ctx.shadowColor = secondaryColor
        ctx.shadowBlur = 6 * scaleFactor
        ctx.shadowOffsetX = 2 * scaleFactor
        ctx.shadowOffsetY = 2 * scaleFactor
        ctx.fillStyle = item.color
    } else if (style === 'stroke') {
        ctx.strokeStyle = secondaryColor
        ctx.lineWidth = Math.max(2, (item.fontSize / 6) * scaleFactor)
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.fillStyle = item.color
    } else {
        ctx.fillStyle = item.color
    }

    lineLayouts.forEach((layout, i) => {
        const ly = visualStartY - totalHeight / 2 + (i + 0.5) * lineHeight
        let lx = startX
        if (item.align === 'center') lx -= layout.width / 2
        else if (item.align === 'right') lx -= layout.width

        for (let j = 0; j < layout.line.length; j++) {
            const char = layout.line[j]!
            const cw = layout.charWidths[j]! || 0

            if (style === 'stroke') {
                ctx.strokeText(char, lx, ly)
                ctx.fillText(char, lx, ly)
            } else {
                ctx.fillText(char, lx, ly)
            }
            lx += cw + letterSpacing
        }
    })
    ctx.restore()
}

export function pixelateRegionFast(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    pixelSize: number,
    paintMask?: (ctx: CanvasRenderingContext2D) => void,
) {
    const sx = Math.max(0, Math.floor(x))
    const sy = Math.max(0, Math.floor(y))
    const ex = Math.min(ctx.canvas.width, Math.ceil(x + w))
    const ey = Math.min(ctx.canvas.height, Math.ceil(y + h))
    const sw = ex - sx
    const sh = ey - sy
    if (sw <= 0 || sh <= 0) return

    const block = Math.max(2, Math.floor(pixelSize))
    const tinyW = Math.max(1, Math.ceil(sw / block))
    const tinyH = Math.max(1, Math.ceil(sh / block))

    const { source, tiny, mask } = getMosaicScratchCanvases()
    ensureCanvasSize(source, sw, sh)
    ensureCanvasSize(tiny, tinyW, tinyH)

    const sourceCtx = source.getContext('2d')
    const tinyCtx = tiny.getContext('2d')
    if (!sourceCtx || !tinyCtx) return

    sourceCtx.clearRect(0, 0, sw, sh)
    sourceCtx.drawImage(ctx.canvas, sx, sy, sw, sh, 0, 0, sw, sh)

    tinyCtx.clearRect(0, 0, tinyW, tinyH)
    tinyCtx.imageSmoothingEnabled = true
    tinyCtx.drawImage(source, 0, 0, sw, sh, 0, 0, tinyW, tinyH)

    sourceCtx.clearRect(0, 0, sw, sh)
    sourceCtx.imageSmoothingEnabled = false
    sourceCtx.drawImage(tiny, 0, 0, tinyW, tinyH, 0, 0, sw, sh)

    if (paintMask) {
        ensureCanvasSize(mask, sw, sh)
        const maskCtx = mask.getContext('2d')
        if (!maskCtx) return
        maskCtx.clearRect(0, 0, sw, sh)
        paintMask(maskCtx)
        sourceCtx.save()
        sourceCtx.globalCompositeOperation = 'destination-in'
        sourceCtx.drawImage(mask, 0, 0)
        sourceCtx.restore()
    }

    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(source, sx, sy)
    ctx.restore()
}

export function drawMosaic(ctx: CanvasRenderingContext2D, item: MosaicAnnotation, scaleFactor = 1) {
    const transform = ctx.getTransform()
    const transformScaleX = Math.hypot(transform.a, transform.b) || 1
    const transformScaleY = Math.hypot(transform.c, transform.d) || 1
    const transformScale = (transformScaleX + transformScaleY) / 2

    const toScreen = (x: number, y: number): Point => ({
        x: transform.a * x + transform.c * y + transform.e,
        y: transform.b * x + transform.d * y + transform.f,
    })

    const block = Math.max(2, Math.round(item.pixelSize * scaleFactor * transformScale))

    if (item.mode === 'area' && item.area) {
        const start = toScreen(item.area.x * scaleFactor, item.area.y * scaleFactor)
        const end = toScreen((item.area.x + item.area.w) * scaleFactor, (item.area.y + item.area.h) * scaleFactor)
        const rect = normalizeRect(start, end)
        pixelateRegionFast(ctx, rect.x, rect.y, rect.w, rect.h, block)
        return
    }

    if (item.points.length === 0) return

    const radius = Math.max(2, block * 1.35)
    const minDistSq = Math.max(4, (block * 0.55) ** 2)
    const sampled: Point[] = []
    for (const p of item.points) {
        const curr = toScreen(p.x * scaleFactor, p.y * scaleFactor)
        const last = sampled[sampled.length - 1]
        if (!last || (curr.x - last.x) ** 2 + (curr.y - last.y) ** 2 >= minDistSq) {
            sampled.push(curr)
        }
    }
    if (sampled.length === 0) return

    const chunkSize = 48
    for (let i = 0; i < sampled.length; i += chunkSize) {
        const from = i > 0 ? i - 1 : i
        const chunk = sampled.slice(from, i + chunkSize)
        if (!chunk.length) continue

        let minX = Number.POSITIVE_INFINITY
        let minY = Number.POSITIVE_INFINITY
        let maxX = Number.NEGATIVE_INFINITY
        let maxY = Number.NEGATIVE_INFINITY
        for (const p of chunk) {
            if (p.x < minX) minX = p.x
            if (p.y < minY) minY = p.y
            if (p.x > maxX) maxX = p.x
            if (p.y > maxY) maxY = p.y
        }

        const x = minX - radius
        const y = minY - radius
        const w = maxX - minX + radius * 2
        const h = maxY - minY + radius * 2

        pixelateRegionFast(ctx, x, y, w, h, block, maskCtx => {
            maskCtx.fillStyle = '#fff'
            for (const p of chunk) {
                const lx = p.x - x
                const ly = p.y - y
                if (item.shape === 'circle') {
                    maskCtx.beginPath()
                    maskCtx.arc(lx, ly, radius, 0, Math.PI * 2)
                    maskCtx.fill()
                } else {
                    maskCtx.fillRect(lx - radius, ly - radius, radius * 2, radius * 2)
                }
            }
        })
    }
}

export function drawMosaicAreaDraftOutline(ctx: CanvasRenderingContext2D, item: MosaicAnnotation) {
    if (item.mode !== 'area' || !item.area) return
    const rect = normalizeRect(
        { x: item.area.x, y: item.area.y },
        { x: item.area.x + item.area.w, y: item.area.y + item.area.h },
    )
    ctx.save()
    ctx.fillStyle = 'rgba(59, 130, 246, 0.10)'
    ctx.strokeStyle = '#3b82f6'
    ctx.setLineDash([6, 4])
    ctx.lineWidth = 2
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)
    ctx.restore()
}

export function getAnnotationBBox(item: Annotation, ctx?: CanvasRenderingContext2D | null) {
    if (item.kind === 'brush') {
        const pts = item.points
        if (pts.length === 0) return { x: 0, y: 0, w: 0, h: 0 }
        let minX = pts[0]!.x, maxX = pts[0]!.x
        let minY = pts[0]!.y, maxY = pts[0]!.y
        for (const p of pts) {
            if (p.x < minX) minX = p.x
            if (p.x > maxX) maxX = p.x
            if (p.y < minY) minY = p.y
            if (p.y > maxY) maxY = p.y
        }
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
    }
    if (item.kind === 'number') {
        return { x: item.x - item.size / 2, y: item.y - item.size / 2, w: item.size, h: item.size }
    }
    if (item.kind === 'text') {
        if (!ctx) return { x: item.x, y: item.y, w: 0, h: 0 }
        ctx.save()
        ctx.font = resolveTextFont(item)
        const lines = item.text.split('\n')
        const lineHeight = item.fontSize * 1.2
        const letterSpacing = item.letterSpacing || 0

        let maxWidth = 0
        lines.forEach(line => {
            let lw = 0
            for (let i = 0; i < line.length; i++) {
                lw += ctx.measureText(line[i]!).width + (i < line.length - 1 ? letterSpacing : 0)
            }
            maxWidth = Math.max(maxWidth, lw)
        })
        ctx.restore()
        const totalHeight = lines.length * lineHeight
        const startX = item.align === 'center' ? item.x - maxWidth / 2 : item.align === 'right' ? item.x - maxWidth : item.x

        let x = startX
        let y = item.y - totalHeight / 2
        let w = maxWidth
        let h = totalHeight

        if (item.textStyle === 'background') {
            const paddingH = item.fontSize * 0.4
            const paddingV = item.fontSize * 0.2
            x -= paddingH
            y -= paddingV
            w += paddingH * 2
            h += paddingV * 2
        } else if (item.textStyle === 'shadow') {
            w += 6
            h += 6
        } else if (item.textStyle === 'stroke') {
            const sw = Math.max(2, item.fontSize / 6)
            x -= sw / 2
            y -= sw / 2
            w += sw
            h += sw
        }

        return { x, y, w, h }
    }
    if (item.kind === 'group') {
        const group = item as GroupAnnotation
        if (group.children.length === 0) return { x: 0, y: 0, w: 0, h: 0 }
        let minX = Number.MAX_VALUE, minY = Number.MAX_VALUE
        let maxX = -Number.MAX_VALUE, maxY = -Number.MAX_VALUE
        group.children.forEach(child => {
            const bbox = getAnnotationBBox(child, ctx)
            minX = Math.min(minX, bbox.x)
            minY = Math.min(minY, bbox.y)
            maxX = Math.max(maxX, bbox.x + bbox.w)
            maxY = Math.max(maxY, bbox.y + bbox.h)
        })
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
    }
    if (item.kind === 'shape' || item.kind === 'arrow') {
        const rect = normalizeRect(item.start, item.end)
        const padding = item.kind === 'arrow' ? Math.max(item.headSize, item.width * 2) * 0.8 : 0
        return {
            x: rect.x - padding,
            y: rect.y - padding,
            w: Math.max(rect.w + padding * 2, 1),
            h: Math.max(rect.h + padding * 2, 1)
        }
    }
    if (item.kind === 'mosaic') {
        if (item.mode === 'area' && item.area) {
            return { ...item.area }
        }
        const pts = item.points
        if (pts.length === 0) return { x: 0, y: 0, w: 0, h: 0 }
        let minX = pts[0]!.x, maxX = pts[0]!.x
        let minY = pts[0]!.y, maxY = pts[0]!.y
        for (const p of pts) {
            if (p.x < minX) minX = p.x
            if (p.x > maxX) maxX = p.x
            if (p.y < minY) minY = p.y
            if (p.y > maxY) maxY = p.y
        }
        const pad = item.pixelSize * 1.5
        return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 }
    }
    return { x: 0, y: 0, w: 0, h: 0 }
}

export function drawNumber(ctx: CanvasRenderingContext2D, item: NumberAnnotation, scaleFactor = 1) {
    const x = item.x * scaleFactor
    const y = item.y * scaleFactor
    const radius = (item.size / 2) * scaleFactor

    ctx.save()
    ctx.fillStyle = item.color
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `bold ${Math.max(10, radius)}px Arial`
    ctx.fillText(String(item.value), x, y)
    ctx.restore()
}

export function drawSelectionOutline(ctx: CanvasRenderingContext2D, item: Annotation) {
    const bbox = getAnnotationBBox(item, ctx)
    // If it's a number, use a circular selection
    if (item.kind === 'number') {
        ctx.save()
        const time = Date.now() / 500
        ctx.strokeStyle = `hsl(${(time * 60) % 360}, 100%, 50%)`
        ctx.setLineDash([6, 4])
        ctx.lineDashOffset = -time * 20
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(item.x, item.y, item.size / 2 + 6, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
        return
    }

    if (bbox.w === 0 && bbox.h === 0) return

    ctx.save()
    const time = Date.now() / 500
    // const hue = (time * 60) % 360 // unused inside logic

    const padding = 6
    const x = bbox.x - padding
    const y = bbox.y - padding
    const w = bbox.w + padding * 2
    const h = bbox.h + padding * 2

    // Outer white glow for contrast
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 3
    ctx.strokeRect(x, y, w, h)

    // Animated dash
    ctx.strokeStyle = `hsl(${(time * 60) % 360}, 100%, 50%)`
    ctx.setLineDash([6, 4])
    ctx.lineDashOffset = -time * 20
    ctx.lineWidth = 1.5
    ctx.strokeRect(x, y, w, h)

    // Draw handles
    const hs = 6 // half size
    const handles = [
        { x, y, id: 'tl' },
        { x: x + w, y, id: 'tr' },
        { x, y: y + h, id: 'bl' },
        { x: x + w, y: y + h, id: 'br' },
    ]

    ctx.fillStyle = 'white'
    ctx.strokeStyle = '#2d8cf0'
    ctx.setLineDash([])
    ctx.lineWidth = 1

    handles.forEach(h => {
        ctx.fillRect(h.x - hs, h.y - hs, hs * 2, hs * 2)
        ctx.strokeRect(h.x - hs, h.y - hs, hs * 2, hs * 2)
    })

    ctx.restore() // restore time context
}

export function drawAnnotation(ctx: CanvasRenderingContext2D, item: Annotation, scaleFactor = 1) {
    if (item.kind === 'brush') drawBrush(ctx, item, scaleFactor)
    else if (item.kind === 'shape') drawShape(ctx, item, scaleFactor)
    else if (item.kind === 'arrow') drawArrow(ctx, item, scaleFactor)
    else if (item.kind === 'text') drawText(ctx, item, scaleFactor)
    else if (item.kind === 'mosaic') drawMosaic(ctx, item, scaleFactor)
    else if (item.kind === 'number') drawNumber(ctx, item, scaleFactor)
    else if (item.kind === 'group') {
        item.children.forEach(child => drawAnnotation(ctx, child, scaleFactor))
    }
}

/**
 * 获取元素的标识点位置（用于选择模式下的辅助点击）
 */
export function getAnnotationIndicatorPoint(item: Annotation): Point {
    if (item.kind === 'brush' || item.kind === 'mosaic') {
        return item.points[0] || { x: 0, y: 0 }
    }
    if (item.kind === 'shape' || item.kind === 'arrow') {
        return {
            x: (item.start.x + item.end.x) / 2,
            y: (item.start.y + item.end.y) / 2
        }
    }
    if (item.kind === 'group') {
        if (item.children.length > 0) return getAnnotationIndicatorPoint(item.children[0]!)
        return { x: 0, y: 0 }
    }
    return { x: item.x, y: item.y }
}

/**
 * 绘制选择模式下的元素标识
 */
export function drawAnnotationIndicator(ctx: CanvasRenderingContext2D, item: Annotation, isSelected: boolean, scaleFactor = 1) {
    const point = getAnnotationIndicatorPoint(item)
    const x = point.x * scaleFactor
    const y = point.y * scaleFactor
    const radius = 6 * scaleFactor

    ctx.save()
    // 基础阴影提升对比度
    ctx.shadowColor = 'rgba(0,0,0,0.3)'
    ctx.shadowBlur = 4 * scaleFactor

    // 绘制外圈（白色，保证在深色背景可见）
    ctx.beginPath()
    ctx.arc(x, y, radius + 2 * scaleFactor, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()

    // 绘制内圈
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    // 如果已选中，显示主色调，否则显示淡色
    ctx.fillStyle = isSelected ? '#3b82f6' : '#94a3b8'
    ctx.fill()

    // 绘制中心点
    ctx.beginPath()
    ctx.arc(x, y, radius * 0.4, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()

    ctx.restore()
}

