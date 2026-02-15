export type Point = { x: number; y: number }

export type Rect = {
    x: number
    y: number
    w: number
    h: number
}

export type StrokePattern = 'solid' | 'dashed'

export type ArrowDirection = 'single' | 'double'

export type AnnotationTool =
    | 'select'
    | 'brush'
    | 'shape'
    | 'arrow'
    | 'text'
    | 'mosaic'
    | 'number'

export type AnnotationKind = 'brush' | 'shape' | 'arrow' | 'text' | 'mosaic' | 'number' | 'group'

export type ShapeType = 'rect' | 'ellipse' | 'line'

export interface BrushAnnotation {
    id: string
    kind: 'brush'
    points: Array<Point & { pressure: number }>
    color: string
    size: number
    opacity: number
    groupId?: string
}

export interface ShapeAnnotation {
    id: string
    kind: 'shape'
    shape: ShapeType
    start: Point
    end: Point
    strokeColor: string
    strokeWidth: number
    fillColor: string
    fillOpacity: number
    strokePattern: StrokePattern
    groupId?: string
}

export type ArrowStyle = 'classic' | 'modern' | 'bold' | 'tapered'

export interface ArrowAnnotation {
    id: string
    kind: 'arrow'
    start: Point
    end: Point
    color: string
    width: number
    direction: ArrowDirection
    pattern: StrokePattern
    headSize: number
    style: ArrowStyle
    groupId?: string
}

export type TextStyle = 'fill' | 'stroke' | 'shadow' | 'background'

export interface TextAnnotation {
    id: string
    kind: 'text'
    text: string
    x: number
    y: number
    color: string
    fontSize: number
    fontFamily: string
    bold: boolean
    italic: boolean
    align: CanvasTextAlign
    textStyle?: TextStyle
    secondaryColor?: string
    letterSpacing?: number
    groupId?: string
}

export interface GroupAnnotation {
    id: string
    kind: 'group'
    children: Annotation[]
    name?: string
    groupId?: string
}

export interface MosaicAnnotation {
    id: string
    kind: 'mosaic'
    mode: 'brush' | 'area'
    shape: 'rect' | 'circle'
    pixelSize: number
    points: Point[]
    area?: Rect
    groupId?: string
}

export interface NumberAnnotation {
    id: string
    kind: 'number'
    value: number
    x: number
    y: number
    color: string
    size: number
    groupId?: string
}

export type Annotation =
    | BrushAnnotation
    | ShapeAnnotation
    | ArrowAnnotation
    | TextAnnotation
    | MosaicAnnotation
    | NumberAnnotation
    | GroupAnnotation

export interface HistoryState<T> {
    past: T[]
    present: T
    future: T[]
}

export const MIN_SIZE = 1
export const DEFAULT_HISTORY_LIMIT = 20

export function clamp(value: number, min: number, max: number): number {
    if (Number.isNaN(value)) return min
    return Math.min(max, Math.max(min, value))
}

export function clampPoint(point: Point, width: number, height: number): Point {
    return {
        x: clamp(point.x, 0, width),
        y: clamp(point.y, 0, height),
    }
}

export function normalizeRect(start: Point, end: Point): Rect {
    const x = Math.min(start.x, end.x)
    const y = Math.min(start.y, end.y)
    return {
        x,
        y,
        w: Math.max(MIN_SIZE, Math.abs(end.x - start.x)),
        h: Math.max(MIN_SIZE, Math.abs(end.y - start.y)),
    }
}

export function clampRect(rect: Rect, width: number, height: number): Rect {
    const x = clamp(rect.x, 0, width)
    const y = clamp(rect.y, 0, height)
    const right = clamp(rect.x + rect.w, x + MIN_SIZE, width)
    const bottom = clamp(rect.y + rect.h, y + MIN_SIZE, height)
    return {
        x,
        y,
        w: right - x,
        h: bottom - y,
    }
}

export function translateInBounds(point: Point, dx: number, dy: number, width: number, height: number): Point {
    return {
        x: clamp(point.x + dx, 0, width),
        y: clamp(point.y + dy, 0, height),
    }
}

export function buildHistory<T>(initial: T): HistoryState<T> {
    return {
        past: [],
        present: initial,
        future: [],
    }
}

export function historyPush<T>(history: HistoryState<T>, next: T, limit = DEFAULT_HISTORY_LIMIT): HistoryState<T> {
    const past = [...history.past, history.present]
    const trimmed = past.length > limit ? past.slice(past.length - limit) : past
    return {
        past: trimmed,
        present: next,
        future: [],
    }
}

export function historyUndo<T>(history: HistoryState<T>): HistoryState<T> {
    if (!history.past.length) return history
    const previous = history.past[history.past.length - 1]!
    return {
        past: history.past.slice(0, -1),
        present: previous,
        future: [history.present, ...history.future],
    }
}

export function historyRedo<T>(history: HistoryState<T>): HistoryState<T> {
    if (!history.future.length) return history
    const [next, ...rest] = history.future
    return {
        past: [...history.past, history.present],
        present: next!,
        future: rest,
    }
}

export function nextSequenceValue(annotations: Annotation[], start = 1): number {
    const maxValue = annotations
        .filter((item): item is NumberAnnotation => item.kind === 'number')
        .reduce((acc, item) => Math.max(acc, item.value), start - 1)
    return maxValue + 1
}

export function buildArrowHead(from: Point, to: Point, size: number): [Point, Point, Point] {
    const angle = Math.atan2(to.y - from.y, to.x - from.x)
    const spread = Math.PI / 6 // 30 degrees
    const left = {
        x: to.x - size * Math.cos(angle - spread),
        y: to.y - size * Math.sin(angle - spread),
    }
    const right = {
        x: to.x - size * Math.cos(angle + spread),
        y: to.y - size * Math.sin(angle + spread),
    }
    const base = {
        x: to.x - (size * 0.75) * Math.cos(angle),
        y: to.y - (size * 0.75) * Math.sin(angle),
    }
    return [left, right, base]
}

export function createId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

/**
 * 计算点 P 到线段 AB 的最短距离
 */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
    const l2 = (a.x - b.x) ** 2 + (a.y - b.y) ** 2
    if (l2 === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2)
    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2
    t = Math.max(0, Math.min(1, t))
    return Math.sqrt(
        (p.x - (a.x + t * (b.x - a.x))) ** 2 + (p.y - (a.y + t * (b.y - a.y))) ** 2
    )
}
