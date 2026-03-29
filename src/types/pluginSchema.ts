export type PluginKind = 'uploader' | 'site-detector'

export type PluginFieldType =
  | 'text'
  | 'password'
  | 'checkbox'
  | 'select'
  | 'textarea'
  | 'number'
  | 'switch'
  | 'kv-pairs'

export type DetectorActionFieldType = Exclude<PluginFieldType, 'kv-pairs'>

export interface PluginOption {
  label: string
  value: any
}

export interface PluginFieldCondition {
  field: string
  equals?: any
  notEquals?: any
  in?: any[]
  notIn?: any[]
  truthy?: boolean
  falsy?: boolean
  exists?: boolean
  empty?: boolean
}

export interface PluginFieldConditionGroup {
  all?: PluginFieldCondition[]
  any?: PluginFieldCondition[]
}

export type PluginFieldConditionSchema = PluginFieldCondition | PluginFieldConditionGroup

export interface PluginDataSource {
  watch?: string[]
  required?: string[]
  script: string
  manual?: boolean
  actionLabel?: string
}

export interface PluginDataSourceResult {
  options?: PluginOption[]
  value?: any
  patch?: Record<string, any>
  help?: string
  placeholder?: string
}

export interface PluginInputSchema {
  name: string
  label: string
  type: PluginFieldType
  required?: boolean
  default?: any
  options?: PluginOption[]
  placeholder?: string
  help?: string
  filterable?: boolean
  clearable?: boolean
  tag?: boolean
  multiple?: boolean
  visibleWhen?: PluginFieldConditionSchema
  disabledWhen?: PluginFieldConditionSchema
  dataSource?: PluginDataSource
}

export interface DetectorActionFieldSchema {
  name: string
  label: string
  type: DetectorActionFieldType
  required?: boolean
  default?: any
  options?: PluginOption[]
  placeholder?: string
  help?: string
  filterable?: boolean
  clearable?: boolean
  multiple?: boolean
}

export interface BasePlugin {
  id: string
  kind: PluginKind
  name: string
  version: string
  author?: string
  description?: string
  icon?: string
  homepage?: string
  authorUrl?: string
  enabled?: boolean
}

export interface PluginPublicSummary {
  id: string
  kind: PluginKind
  name: string
  version: string
  author?: string
  description?: string
  icon?: string
  homepage?: string
  authorUrl?: string
  enabled: boolean
}

export interface UploaderRuntime {
  inputs: PluginInputSchema[]
  script: string
}

export interface UploaderPlugin extends BasePlugin {
  kind: 'uploader'
  uploader: UploaderRuntime
}

export interface SiteDetectorMatchRule {
  domains?: string[]
  domainSuffixes?: string[]
  pathnameEquals?: string[]
  pathnameIncludes?: string[]
  urlPatterns?: string[]
}

export interface SiteDetectorPresentation {
  title?: string
  description?: string
  actionText?: string
  ignoreText?: string
  successText?: string
  dismissText?: string
  failureText?: string
}

export interface DetectorElementSnapshot {
  tagName: string
  textContent: string | null
  innerHTML: string
  value: string | null
  attributes: Record<string, string>
  dataset: Record<string, string>
}

export interface DetectorPageInfo {
  url: string
  origin: string
  hostname: string
  pathname: string
  title: string
}

export interface DetectorFetchResponse {
  ok: boolean
  status: number
  statusText: string
  url: string
  headers: Record<string, string>
  body: any
}

export interface DetectorPluginContext {
  page: DetectorPageInfo
  query(selector: string): Promise<DetectorElementSnapshot | null>
  queryAll(selector: string): Promise<DetectorElementSnapshot[]>
  text(selector: string): Promise<string | null>
  attr(selector: string, name: string): Promise<string | null>
  exists(selector: string): Promise<boolean>
  waitForSelector(selector: string, timeout?: number): Promise<boolean>
  fetch(input: string | URL, init?: RequestInit): Promise<DetectorFetchResponse>
  fetchJson(input: string | URL, init?: RequestInit): Promise<any>
  sendMessage(type: string, payload?: any): Promise<any>
  readExternalStore(dbName: string, storeName: string): Promise<any[]>
}

export interface DetectorScriptMatchResult {
  matched?: boolean
  score?: number
  data?: Record<string, any>
  presentation?: SiteDetectorPresentation
}

export interface DetectorExtractResult {
  config?: Record<string, any>
  successText?: string
}

export interface DetectorRuntime {
  targetDriveType: string
  match?: SiteDetectorMatchRule
  presentation?: SiteDetectorPresentation
  priority?: number
  actionForm?: DetectorActionFieldSchema[]
  detectScript: string
  extractScript: string
}

export interface SiteDetectorPlugin extends BasePlugin {
  kind: 'site-detector'
  detector: DetectorRuntime
}

export type PluginMeta = UploaderPlugin | SiteDetectorPlugin

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null
}

export function normalizePluginKind(kind: unknown): PluginKind {
  return kind === 'site-detector' ? 'site-detector' : 'uploader'
}

export function isPluginKind(kind: unknown): kind is PluginKind {
  return kind === 'uploader' || kind === 'site-detector'
}

export function isUploaderPlugin(plugin: unknown): plugin is UploaderPlugin {
  if (!isRecord(plugin)) {
    return false
  }

  return normalizePluginKind(plugin.kind) === 'uploader'
    && isRecord(plugin.uploader)
    && typeof plugin.uploader.script === 'string'
    && Array.isArray(plugin.uploader.inputs)
}

export function isSiteDetectorPlugin(plugin: unknown): plugin is SiteDetectorPlugin {
  if (!isRecord(plugin)) {
    return false
  }

  return normalizePluginKind(plugin.kind) === 'site-detector'
    && isRecord(plugin.detector)
    && typeof plugin.detector.targetDriveType === 'string'
    && typeof plugin.detector.detectScript === 'string'
    && typeof plugin.detector.extractScript === 'string'
}


