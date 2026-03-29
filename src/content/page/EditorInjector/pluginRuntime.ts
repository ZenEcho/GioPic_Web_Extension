import type { EditorAdapterPlugin } from '../../../types'
import { isEditorAdapterPlugin } from '../../../types'
import {
    adapters,
    detectByDomain,
    detectById,
    detectBySelector,
    handleCodeMirror5Impl,
} from './adapters'
import { EDITOR_META } from './meta'
import type { EditorAdapter } from './types'

const BUILTIN_EDITOR_ADAPTER_VERSION = '1.0.0'
const BUILTIN_PLUGIN_ID_PREFIX = 'builtin.editor-adapter.'
const BUILTIN_EDITOR_NAME_MAP = new Map(EDITOR_META.map(meta => [meta.id, meta.name]))

const RUNTIME_HELPERS = {
    detectBySelector,
    detectById,
    detectByDomain,
    handleCodeMirror5Impl,
}

function toScriptSource(handler: EditorAdapter['detect'] | EditorAdapter['inject']) {
    return handler.toString()
}

function createBuiltInEditorAdapterPlugins(): EditorAdapterPlugin[] {
    return adapters.map((adapter) => {
        const displayName = BUILTIN_EDITOR_NAME_MAP.get(adapter.id) || adapter.id

        return {
            id: `${BUILTIN_PLUGIN_ID_PREFIX}${adapter.id}`,
            kind: 'editor-adapter',
            name: displayName,
            version: BUILTIN_EDITOR_ADAPTER_VERSION,
            author: 'GioPic',
            description: `Built-in editor adapter for ${displayName}.`,
            enabled: true,
            editorAdapter: {
                editorType: adapter.id,
                displayName,
                detectScript: toScriptSource(adapter.detect),
                injectScript: toScriptSource(adapter.inject),
            },
        }
    })
}

export const BUILTIN_EDITOR_ADAPTER_PLUGINS = createBuiltInEditorAdapterPlugins()

function isEnabledEditorAdapterPlugin(plugin: unknown): plugin is EditorAdapterPlugin {
    return isEditorAdapterPlugin(plugin) && plugin.enabled !== false
}

function compileRuntimeFunction<T extends EditorAdapter['detect'] | EditorAdapter['inject']>(
    script: string,
    plugin: EditorAdapterPlugin,
    fieldName: 'detectScript' | 'injectScript',
): T {
    const factory = new Function('helpers', `
        'use strict';
        const { detectBySelector, detectById, detectByDomain, handleCodeMirror5Impl } = helpers;
        return (${script});
    `) as (helpers: typeof RUNTIME_HELPERS) => unknown

    const runtime = factory(RUNTIME_HELPERS)
    if (typeof runtime !== 'function') {
        throw new Error(`Plugin ${plugin.id} ${fieldName} must evaluate to a function`)
    }

    return runtime as T
}

function compileEditorAdapterPlugin(plugin: EditorAdapterPlugin): EditorAdapter {
    return {
        id: plugin.editorAdapter.editorType,
        detect: compileRuntimeFunction<EditorAdapter['detect']>(plugin.editorAdapter.detectScript, plugin, 'detectScript'),
        inject: compileRuntimeFunction<EditorAdapter['inject']>(plugin.editorAdapter.injectScript, plugin, 'injectScript'),
    }
}

export function filterEnabledEditorAdapterPlugins(plugins: unknown[]): EditorAdapterPlugin[] {
    return plugins.filter(isEnabledEditorAdapterPlugin)
}

class EditorAdapterRegistry {
    private syncedPlugins: EditorAdapterPlugin[] | null = null

    private compiledAdapters: EditorAdapter[] | null = null

    syncPlugins(plugins: unknown[]): void {
        this.syncedPlugins = filterEnabledEditorAdapterPlugins(plugins)
        this.compiledAdapters = null
    }

    getActivePlugins(): EditorAdapterPlugin[] {
        return this.syncedPlugins ?? BUILTIN_EDITOR_ADAPTER_PLUGINS
    }

    getAdapters(): EditorAdapter[] {
        if (this.compiledAdapters) {
            return this.compiledAdapters
        }

        const compiled: EditorAdapter[] = []
        for (const plugin of this.getActivePlugins()) {
            try {
                compiled.push(compileEditorAdapterPlugin(plugin))
            } catch (error) {
                console.warn(`[GioPic] Failed to compile editor adapter plugin ${plugin.id}:`, error)
            }
        }

        this.compiledAdapters = compiled
        return compiled
    }
}

export const editorAdapterRegistry = new EditorAdapterRegistry()
