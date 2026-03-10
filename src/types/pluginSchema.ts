export type PluginFieldType =
  | 'text'
  | 'password'
  | 'checkbox'
  | 'select'
  | 'textarea'
  | 'number'
  | 'switch'
  | 'kv-pairs'

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
