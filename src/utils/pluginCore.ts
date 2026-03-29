/**
 * @file pluginCore.ts
 * @description 插件核心逻辑处理工具
 *
 * 职责：
 * 1. 验证 uploader / site-detector / editor-adapter 三类插件的 schema 合法性
 * 2. 安装、卸载、启停插件并持久化到 IndexedDB
 * 3. 对旧版未声明 kind 的 uploader 做兼容归一化
 * 4. 广播插件更新消息给扩展和内容脚本
 */

import { db } from '@/utils/storage'
import type {
  EditorAdapterPlugin,
  DetectorActionFieldSchema,
  PluginFieldCondition,
  PluginFieldConditionGroup,
  PluginFieldConditionSchema,
  PluginKind,
  PluginMeta,
  PluginOption,
  PluginInputSchema,
  SiteDetectorMatchRule,
  SiteDetectorPlugin,
  SiteDetectorPresentation,
  UploaderPlugin,
} from '@/types'
import { isPluginKind, normalizePluginKind } from '@/types'
import browser from 'webextension-polyfill'

const ALLOWED_PLUGIN_FIELD_TYPES = new Set([
  'text',
  'password',
  'checkbox',
  'select',
  'textarea',
  'number',
  'switch',
  'kv-pairs',
])

const ALLOWED_DETECTOR_ACTION_FIELD_TYPES = new Set([
  'text',
  'password',
  'checkbox',
  'select',
  'textarea',
  'number',
  'switch',
])

const LEGACY_SITE_DETECTOR_TOP_LEVEL_KEYS = [
  'targetDriveType',
  'match',
  'presentation',
  'priority',
  'actionForm',
  'detectScript',
  'extractScript',
] as const

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null
}

function toSerializablePlugin<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function isOptionArray(value: unknown): value is PluginOption[] {
  return Array.isArray(value)
    && value.every(option => isRecord(option) && typeof option.label === 'string' && 'value' in option)
}

function hasLegacySiteDetectorTopLevelFields(plugin: Record<string, any>): boolean {
  return LEGACY_SITE_DETECTOR_TOP_LEVEL_KEYS.some(key => key in plugin)
}

function pickBasePluginFields(plugin: Record<string, any>, kind: PluginKind): Record<string, any> {
  const base: Record<string, any> = {
    id: plugin.id,
    kind,
    name: plugin.name,
    version: plugin.version,
  }

  for (const key of ['author', 'description', 'icon', 'homepage', 'authorUrl'] as const) {
    if (key in plugin) {
      base[key] = plugin[key]
    }
  }

  if ('enabled' in plugin) {
    base.enabled = plugin.enabled
  }

  return base
}

function validateStringArray(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined
  }

  if (!isStringArray(value)) {
    return `${fieldName} must be an array of strings`
  }

  return undefined
}

function isConditionGroup(condition: PluginFieldConditionSchema): condition is PluginFieldConditionGroup {
  return isRecord(condition) && ('all' in condition || 'any' in condition)
}

function validateCondition(condition: PluginFieldCondition, fieldName: string): string | undefined {
  if (!isNonEmptyString(condition.field)) {
    return `${fieldName}.field must be a non-empty string`
  }

  if (condition.in !== undefined && !Array.isArray(condition.in)) {
    return `${fieldName}.in must be an array`
  }

  if (condition.notIn !== undefined && !Array.isArray(condition.notIn)) {
    return `${fieldName}.notIn must be an array`
  }

  return undefined
}

function validateConditionSchema(condition: unknown, fieldName: string): string | undefined {
  if (condition === undefined) {
    return undefined
  }

  if (!isRecord(condition)) {
    return `${fieldName} must be an object`
  }

  if (isConditionGroup(condition as PluginFieldConditionSchema)) {
    const group = condition as PluginFieldConditionGroup
    if (group.all !== undefined && !Array.isArray(group.all)) {
      return `${fieldName}.all must be an array`
    }
    if (group.any !== undefined && !Array.isArray(group.any)) {
      return `${fieldName}.any must be an array`
    }

    for (const [groupName, items] of [['all', group.all], ['any', group.any]] as const) {
      if (!items) {
        continue
      }
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index]
        if (!item || !isRecord(item)) {
          return `${fieldName}.${groupName}[${index}] must be an object`
        }

        const error = validateCondition(item as PluginFieldCondition, `${fieldName}.${groupName}[${index}]`)
        if (error) {
          return error
        }
      }
    }

    return undefined
  }

  return validateCondition(condition as PluginFieldCondition, fieldName)
}

function validateDataSource(dataSource: unknown, fieldName: string): string | undefined {
  if (dataSource === undefined) {
    return undefined
  }

  if (!isRecord(dataSource)) {
    return `${fieldName}.dataSource must be an object`
  }

  if (!isString(dataSource.script)) {
    return `${fieldName}.dataSource.script must be a string`
  }

  const watchError = validateStringArray(dataSource.watch, `${fieldName}.dataSource.watch`)
  if (watchError) {
    return watchError
  }

  const requiredError = validateStringArray(dataSource.required, `${fieldName}.dataSource.required`)
  if (requiredError) {
    return requiredError
  }

  if (dataSource.manual !== undefined && typeof dataSource.manual !== 'boolean') {
    return `${fieldName}.dataSource.manual must be a boolean`
  }

  if (dataSource.actionLabel !== undefined && typeof dataSource.actionLabel !== 'string') {
    return `${fieldName}.dataSource.actionLabel must be a string`
  }

  return undefined
}

function validateCommonFieldShape(
  field: PluginInputSchema | DetectorActionFieldSchema,
  fieldName: string,
  allowedTypes: Set<string>,
): string | undefined {
  if (!isNonEmptyString(field.name)) {
    return `${fieldName}.name must be a non-empty string`
  }

  if (!isNonEmptyString(field.label)) {
    return `${fieldName}.label must be a non-empty string`
  }

  if (!isNonEmptyString(field.type) || !allowedTypes.has(field.type)) {
    return `${fieldName}.type is unsupported`
  }

  if (field.options !== undefined && !isOptionArray(field.options)) {
    return `${fieldName}.options must be an array of { label, value }`
  }

  for (const key of ['required', 'filterable', 'clearable', 'multiple'] as const) {
    if (field[key] !== undefined && typeof field[key] !== 'boolean') {
      return `${fieldName}.${key} must be a boolean`
    }
  }

  for (const key of ['placeholder', 'help'] as const) {
    if (field[key] !== undefined && typeof field[key] !== 'string') {
      return `${fieldName}.${key} must be a string`
    }
  }

  return undefined
}

function validateUploaderField(input: unknown, index: number): string | undefined {
  if (!isRecord(input)) {
    return `Plugin uploader.inputs[${index}] must be an object`
  }

  const fieldName = `Plugin uploader.inputs[${index}]`
  const baseError = validateCommonFieldShape(input as PluginInputSchema, fieldName, ALLOWED_PLUGIN_FIELD_TYPES)
  if (baseError) {
    return baseError
  }

  const visibleError = validateConditionSchema(input.visibleWhen, `${fieldName}.visibleWhen`)
  if (visibleError) {
    return visibleError
  }

  const disabledError = validateConditionSchema(input.disabledWhen, `${fieldName}.disabledWhen`)
  if (disabledError) {
    return disabledError
  }

  return validateDataSource(input.dataSource, fieldName)
}

function validateDetectorActionField(input: unknown, index: number): string | undefined {
  if (!isRecord(input)) {
    return `Site detector detector.actionForm[${index}] must be an object`
  }

  if ('dataSource' in input) {
    return `Site detector detector.actionForm[${index}].dataSource is not allowed`
  }

  if ('visibleWhen' in input) {
    return `Site detector detector.actionForm[${index}].visibleWhen is not allowed`
  }

  if ('disabledWhen' in input) {
    return `Site detector detector.actionForm[${index}].disabledWhen is not allowed`
  }

  if ('tag' in input) {
    return `Site detector detector.actionForm[${index}].tag is not allowed`
  }

  return validateCommonFieldShape(
    input as DetectorActionFieldSchema,
    `Site detector detector.actionForm[${index}]`,
    ALLOWED_DETECTOR_ACTION_FIELD_TYPES,
  )
}

function validateBasePlugin(plugin: Record<string, any>): string | undefined {
  if (plugin.kind !== undefined && !isPluginKind(plugin.kind)) {
    return `Unsupported plugin kind: ${String(plugin.kind)}`
  }

  if (!isNonEmptyString(plugin.id)) {
    return 'Missing plugin ID'
  }

  if (!isNonEmptyString(plugin.name)) {
    return 'Missing plugin name'
  }

  if (!isNonEmptyString(plugin.version)) {
    return 'Missing plugin version'
  }

  for (const key of ['author', 'description', 'icon', 'homepage', 'authorUrl'] as const) {
    if (plugin[key] !== undefined && typeof plugin[key] !== 'string') {
      return `Plugin ${key} must be a string`
    }
  }

  if (plugin.enabled !== undefined && typeof plugin.enabled !== 'boolean') {
    return 'Plugin enabled must be a boolean'
  }

  return undefined
}

function validateMatchRule(match: unknown): string | undefined {
  if (match === undefined) {
    return undefined
  }

  if (!isRecord(match)) {
    return 'Site detector detector.match must be an object'
  }

  for (const field of ['domains', 'domainSuffixes', 'pathnameEquals', 'pathnameIncludes', 'urlPatterns'] as const) {
    const error = validateStringArray(match[field], `Site detector detector.match.${field}`)
    if (error) {
      return error
    }
  }

  return undefined
}

function validatePresentation(presentation: unknown): string | undefined {
  if (presentation === undefined) {
    return undefined
  }

  if (!isRecord(presentation)) {
    return 'Site detector detector.presentation must be an object'
  }

  for (const key of ['title', 'description', 'actionText', 'ignoreText', 'successText', 'dismissText', 'failureText'] as const) {
    if (presentation[key] !== undefined && typeof presentation[key] !== 'string') {
      return `Site detector detector.presentation.${key} must be a string`
    }
  }

  return undefined
}

function normalizeUploaderPlugin(plugin: Record<string, any>): UploaderPlugin {
  const uploader = isRecord(plugin.uploader) ? plugin.uploader : {}

  return {
    ...pickBasePluginFields(plugin, 'uploader'),
    kind: 'uploader',
    uploader: {
      inputs: Array.isArray(uploader.inputs)
        ? uploader.inputs
        : Array.isArray(plugin.inputs)
          ? plugin.inputs
          : [],
      script: isString(uploader.script)
        ? uploader.script
        : isString(plugin.script)
          ? plugin.script
          : '',
    },
  } as UploaderPlugin
}

function normalizeSiteDetectorPlugin(plugin: Record<string, any>): SiteDetectorPlugin | null {
  if (!isRecord(plugin.detector) || hasLegacySiteDetectorTopLevelFields(plugin)) {
    return null
  }

  const detector = plugin.detector
  return {
    ...pickBasePluginFields(plugin, 'site-detector'),
    kind: 'site-detector',
    detector: {
      targetDriveType: detector.targetDriveType,
      match: detector.match,
      presentation: detector.presentation,
      priority: detector.priority,
      actionForm: Array.isArray(detector.actionForm) ? detector.actionForm : undefined,
      detectScript: detector.detectScript,
      extractScript: detector.extractScript,
    },
  } as SiteDetectorPlugin
}

function normalizeEditorAdapterPlugin(plugin: Record<string, any>): EditorAdapterPlugin | null {
  if (!isRecord(plugin.editorAdapter)) {
    return null
  }

  const editorAdapter = plugin.editorAdapter
  return {
    ...pickBasePluginFields(plugin, 'editor-adapter'),
    kind: 'editor-adapter',
    editorAdapter: {
      editorType: editorAdapter.editorType,
      displayName: editorAdapter.displayName,
      detectScript: editorAdapter.detectScript,
      injectScript: editorAdapter.injectScript,
    },
  } as EditorAdapterPlugin
}

export function normalizePlugin(plugin: unknown): PluginMeta | null {
  if (!isRecord(plugin)) {
    return null
  }

  if (plugin.kind !== undefined && !isPluginKind(plugin.kind)) {
    return null
  }

  const kind = normalizePluginKind(plugin.kind)
  if (kind === 'site-detector') {
    return normalizeSiteDetectorPlugin(plugin)
  }

  if (kind === 'editor-adapter') {
    return normalizeEditorAdapterPlugin(plugin)
  }

  return normalizeUploaderPlugin(plugin)
}

function validateUploaderPlugin(plugin: UploaderPlugin): string | undefined {
  if (!isRecord(plugin.uploader)) {
    return 'Plugin uploader is required and must be an object'
  }

  if (!Array.isArray(plugin.uploader.inputs)) {
    return 'Plugin uploader.inputs must be an array'
  }

  if (!isString(plugin.uploader.script)) {
    return 'Plugin uploader.script is required and must be a string'
  }

  for (let index = 0; index < plugin.uploader.inputs.length; index += 1) {
    const error = validateUploaderField(plugin.uploader.inputs[index], index)
    if (error) {
      return error
    }
  }

  return undefined
}

function validateSiteDetectorPlugin(plugin: SiteDetectorPlugin): string | undefined {
  if (!isRecord(plugin.detector)) {
    return 'Site detector detector is required and must be an object'
  }

  if (!isNonEmptyString(plugin.detector.targetDriveType)) {
    return 'Site detector detector.targetDriveType is required'
  }

  if (!isString(plugin.detector.detectScript)) {
    return 'Site detector detector.detectScript is required and must be a string'
  }

  if (!isString(plugin.detector.extractScript)) {
    return 'Site detector detector.extractScript is required and must be a string'
  }

  if (plugin.detector.priority !== undefined && (!Number.isFinite(plugin.detector.priority) || typeof plugin.detector.priority !== 'number')) {
    return 'Site detector detector.priority must be a finite number'
  }

  const matchError = validateMatchRule(plugin.detector.match as SiteDetectorMatchRule | undefined)
  if (matchError) {
    return matchError
  }

  const presentationError = validatePresentation(plugin.detector.presentation as SiteDetectorPresentation | undefined)
  if (presentationError) {
    return presentationError
  }

  if (plugin.detector.actionForm !== undefined) {
    if (!Array.isArray(plugin.detector.actionForm)) {
      return 'Site detector detector.actionForm must be an array'
    }

    for (let index = 0; index < plugin.detector.actionForm.length; index += 1) {
      const error = validateDetectorActionField(plugin.detector.actionForm[index], index)
      if (error) {
        return error
      }
    }
  }

  return undefined
}

function validateEditorAdapterPlugin(plugin: EditorAdapterPlugin): string | undefined {
  if (!isRecord(plugin.editorAdapter)) {
    return 'Editor adapter editorAdapter is required and must be an object'
  }

  if (!isNonEmptyString(plugin.editorAdapter.editorType)) {
    return 'Editor adapter editorAdapter.editorType is required'
  }

  if (!isNonEmptyString(plugin.editorAdapter.displayName)) {
    return 'Editor adapter editorAdapter.displayName is required'
  }

  if (!isString(plugin.editorAdapter.detectScript)) {
    return 'Editor adapter editorAdapter.detectScript is required and must be a string'
  }

  if (!isString(plugin.editorAdapter.injectScript)) {
    return 'Editor adapter editorAdapter.injectScript is required and must be a string'
  }

  return undefined
}

/**
 * 验证插件对象的必要字段
 */
export function validatePlugin(plugin: unknown): { valid: boolean; error?: string; normalized?: PluginMeta } {
  if (!isRecord(plugin)) {
    return { valid: false, error: 'Plugin is empty' }
  }

  if (plugin.kind !== undefined && !isPluginKind(plugin.kind)) {
    return { valid: false, error: `Unsupported plugin kind: ${String(plugin.kind)}` }
  }

  if (normalizePluginKind(plugin.kind) === 'site-detector' && hasLegacySiteDetectorTopLevelFields(plugin)) {
    return { valid: false, error: 'Site detector plugin must use detector.* nested fields and cannot use legacy top-level runtime fields' }
  }

  const normalized = normalizePlugin(plugin)
  if (!normalized) {
    return { valid: false, error: 'Invalid plugin schema' }
  }

  const baseError = validateBasePlugin(normalized)
  if (baseError) {
    return { valid: false, error: baseError }
  }

  const kind: PluginKind = normalized.kind
  const detailError = kind === 'site-detector'
    ? validateSiteDetectorPlugin(normalized as SiteDetectorPlugin)
    : kind === 'editor-adapter'
      ? validateEditorAdapterPlugin(normalized as EditorAdapterPlugin)
      : validateUploaderPlugin(normalized as UploaderPlugin)

  if (detailError) {
    return { valid: false, error: detailError }
  }

  return { valid: true, normalized }
}

export function normalizeStoredPlugins(stored: unknown): PluginMeta[] {
  if (!Array.isArray(stored)) {
    return []
  }

  const normalized: PluginMeta[] = []
  for (const plugin of stored) {
    const result = validatePlugin(plugin)
    if (result.valid && result.normalized) {
      normalized.push(result.normalized)
    }
  }

  return normalized
}

/**
 * 广播插件更新消息
 */
export async function broadcastPluginUpdate() {
  try {
    await browser.runtime.sendMessage({ type: 'REFRESH_PLUGINS' })
  } catch {}

  try {
    if (browser.tabs?.query) {
      const tabs = await browser.tabs.query({})
      for (const tab of tabs) {
        if (tab.id) {
          browser.tabs.sendMessage(tab.id, { type: 'REFRESH_PLUGINS' }).catch(() => {})
        }
      }
    }
  } catch {}
}

/**
 * 安装插件到存储
 */
export async function installPluginToStorage(plugin: unknown): Promise<void> {
  const validation = validatePlugin(plugin)
  const normalized = validation.normalized
  if (!validation.valid || !normalized) {
    throw new Error(validation.error || 'Invalid plugin')
  }

  const stored = normalizeStoredPlugins(await db.get<PluginMeta[]>('plugins'))
  const plugins = [...stored]
  const index = plugins.findIndex(item => item.id === normalized.id)
  const newPlugin = toSerializablePlugin({ ...normalized, enabled: true })

  if (index > -1) {
    plugins[index] = newPlugin
  } else {
    plugins.push(newPlugin)
  }

  await db.set('plugins', plugins)
  await broadcastPluginUpdate()
}

/**
 * 从存储中卸载插件
 */
export async function uninstallPluginFromStorage(pluginId: string): Promise<boolean> {
  const stored = normalizeStoredPlugins(await db.get<PluginMeta[]>('plugins'))
  const plugins = stored.filter(plugin => plugin.id !== pluginId)

  if (plugins.length === stored.length) {
    return false
  }

  await db.set('plugins', plugins)
  await broadcastPluginUpdate()
  return true
}

/**
 * 切换插件启用/禁用状态
 */
export async function togglePluginInStorage(pluginId: string, enabled: boolean): Promise<boolean> {
  const plugins = normalizeStoredPlugins(await db.get<PluginMeta[]>('plugins'))
  const plugin = plugins.find(item => item.id === pluginId)
  if (!plugin) {
    return false
  }

  plugin.enabled = enabled
  await db.set('plugins', plugins)
  await broadcastPluginUpdate()
  return true
}

/**
 * 一次性迁移：预装 bundled 插件，但不覆盖用户已安装版本。
 */
export async function seedBundledPluginsOnce(bundledPlugins: PluginMeta[], migrationKey: string): Promise<void> {
  const seeded = await db.get<boolean>(migrationKey)
  if (seeded) {
    return
  }

  const plugins = normalizeStoredPlugins(await db.get<PluginMeta[]>('plugins'))
  const existingIds = new Set(plugins.map(plugin => plugin.id))
  let changed = false

  for (const plugin of bundledPlugins) {
    const validation = validatePlugin(plugin)
    if (!validation.valid || !validation.normalized) {
      continue
    }

    if (!existingIds.has(validation.normalized.id)) {
      plugins.push({ ...validation.normalized, enabled: true })
      existingIds.add(validation.normalized.id)
      changed = true
    }
  }

  if (changed) {
    await db.set('plugins', plugins)
    await broadcastPluginUpdate()
  }

  await db.set(migrationKey, true)
}
