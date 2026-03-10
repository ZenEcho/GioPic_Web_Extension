import type { FieldSchema } from '@/constants/driveSchemas'
import type {
  PluginDataSourceResult,
  PluginFieldCondition,
  PluginFieldConditionGroup,
  PluginFieldConditionSchema,
  PluginOption,
} from '@/types'

export function hasFieldValue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0
  }

  if (typeof value === 'string') {
    return value.trim().length > 0
  }

  return value !== undefined && value !== null
}

function isConditionGroup(condition: PluginFieldConditionSchema): condition is PluginFieldConditionGroup {
  return typeof condition === 'object' && condition !== null && ('all' in condition || 'any' in condition)
}

function getModelFieldValue(model: Record<string, any>, field: string): any {
  if (!field.includes('.')) {
    return model[field]
  }

  return field.split('.').reduce<any>((current, key) => {
    if (current === undefined || current === null || typeof current !== 'object') {
      return undefined
    }

    return (current as Record<string, any>)[key]
  }, model)
}

function matchesInCondition(candidates: any[], value: any): boolean {
  if (Array.isArray(value)) {
    return value.some(item => candidates.includes(item))
  }

  return candidates.includes(value)
}

function matchesCondition(condition: PluginFieldCondition, model: Record<string, any>): boolean {
  const value = getModelFieldValue(model, condition.field)

  if (condition.equals !== undefined && value !== condition.equals) {
    return false
  }

  if (condition.notEquals !== undefined && value === condition.notEquals) {
    return false
  }

  if (condition.in && !matchesInCondition(condition.in, value)) {
    return false
  }

  if (condition.notIn && matchesInCondition(condition.notIn, value)) {
    return false
  }

  if (condition.truthy !== undefined && (!!value) !== condition.truthy) {
    return false
  }

  if (condition.falsy !== undefined && (!value) !== condition.falsy) {
    return false
  }

  if (condition.exists !== undefined && hasFieldValue(value) !== condition.exists) {
    return false
  }

  if (condition.empty !== undefined && (!hasFieldValue(value)) !== condition.empty) {
    return false
  }

  return true
}

export function evaluateCondition(condition: PluginFieldConditionSchema | undefined, model: Record<string, any>): boolean {
  if (!condition) {
    return true
  }

  if (isConditionGroup(condition)) {
    const allConditions = condition.all || []
    const anyConditions = condition.any || []
    const allMatched = allConditions.every(item => matchesCondition(item, model))
    const anyMatched = anyConditions.length === 0 || anyConditions.some(item => matchesCondition(item, model))
    return allMatched && anyMatched
  }

  return matchesCondition(condition, model)
}

export function isFieldVisible(field: FieldSchema, model: Record<string, any>): boolean {
  return evaluateCondition(field.visibleWhen, model)
}

export function isFieldDisabled(field: FieldSchema, model: Record<string, any>): boolean {
  return field.disabledWhen ? evaluateCondition(field.disabledWhen, model) : false
}

function normalizeOptions(options: unknown): PluginOption[] {
  if (!Array.isArray(options)) {
    return []
  }

  return options.map((option) => {
    if (option && typeof option === 'object' && 'label' in option && 'value' in option) {
      return {
        label: String((option as Record<string, any>).label),
        value: (option as Record<string, any>).value,
      }
    }

    return {
      label: String(option),
      value: option,
    }
  })
}

export function normalizeDataSourceResult(result: unknown): PluginDataSourceResult {
  if (Array.isArray(result)) {
    return { options: normalizeOptions(result) }
  }

  if (!result || typeof result !== 'object') {
    return {}
  }

  const payload = result as Record<string, any>
  return {
    options: normalizeOptions(payload.options),
    value: payload.value,
    patch: payload.patch && typeof payload.patch === 'object' ? payload.patch : undefined,
    help: typeof payload.help === 'string' ? payload.help : undefined,
    placeholder: typeof payload.placeholder === 'string' ? payload.placeholder : undefined,
  }
}
