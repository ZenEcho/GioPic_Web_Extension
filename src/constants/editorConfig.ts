import type { AnnotationTool } from '@/utils/editorCore'

export type FilterPreset = 'none' | 'grayscale' | 'sepia' | 'invert' | 'warm' | 'cool' | 'vintage'

export interface FilterPresetItem {
    labelKey: string
    css: string
}

export interface ToolItem {
    id: AnnotationTool | 'crop'
    labelKey: string
    icon: string
    shortcut: string
}

export const FILTER_PRESETS: Record<FilterPreset, FilterPresetItem> = {
    none: { labelKey: 'imageEditor.filters.none', css: '' },
    grayscale: { labelKey: 'imageEditor.filters.grayscale', css: 'grayscale(100%)' },
    sepia: { labelKey: 'imageEditor.filters.sepia', css: 'sepia(80%)' },
    invert: { labelKey: 'imageEditor.filters.invert', css: 'invert(100%)' },
    warm: { labelKey: 'imageEditor.filters.warm', css: 'sepia(30%) saturate(140%) hue-rotate(-10deg)' },
    cool: { labelKey: 'imageEditor.filters.cool', css: 'saturate(80%) hue-rotate(180deg) brightness(105%)' },
    vintage: { labelKey: 'imageEditor.filters.vintage', css: 'sepia(40%) contrast(90%) brightness(110%) saturate(80%)' },
}

export const EDITOR_TOOLS: ToolItem[] = [
    { id: 'select', labelKey: 'imageEditor.tools.select', icon: 'i-ph-cursor-click', shortcut: 'V' },
    { id: 'crop', labelKey: 'imageEditor.crop', icon: 'i-ph-crop', shortcut: 'C' },
    { id: 'brush', labelKey: 'imageEditor.tools.brush', icon: 'i-ph-paint-brush', shortcut: 'B' },
    { id: 'shape', labelKey: 'imageEditor.tools.shape', icon: 'i-ph-shapes', shortcut: 'S' },
    { id: 'arrow', labelKey: 'imageEditor.tools.arrow', icon: 'i-ph-arrow-right', shortcut: 'A' },
    { id: 'text', labelKey: 'imageEditor.tools.text', icon: 'i-ph-text-t', shortcut: 'T' },
    { id: 'mosaic', labelKey: 'imageEditor.tools.mosaic', icon: 'i-ph-grid-nine', shortcut: 'M' },
    { id: 'number', labelKey: 'imageEditor.tools.number', icon: 'i-ph-number-circle-one', shortcut: 'N' },
]

export const TOOL_SHORTCUT_MAP: Record<string, AnnotationTool | 'crop'> = {
    v: 'select',
    c: 'crop',
    b: 'brush',
    s: 'shape',
    a: 'arrow',
    t: 'text',
    m: 'mosaic',
    n: 'number',
}

export const TEXT_FONT_OPTIONS = [
    'Arial',
    'Microsoft YaHei',
    'SimSun',
    'SimHei',
    'Georgia',
    'Verdana',
    'Courier New',
    'Times New Roman',
    'Impact',
    'Comic Sans MS',
    'Tahoma',
    'system-ui'
] as const

export const TEXT_STYLE_OPTIONS = [
    { labelKey: 'imageEditor.styles.fill', value: 'fill' },
    { labelKey: 'imageEditor.styles.stroke', value: 'stroke' },
    { labelKey: 'imageEditor.styles.shadow', value: 'shadow' },
    { labelKey: 'imageEditor.styles.background', value: 'background' },
] as const
