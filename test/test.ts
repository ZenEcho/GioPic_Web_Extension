import assert from 'node:assert/strict'
import { isDev } from '../manifest/utils'

type StorageChange = { oldValue?: any; newValue?: any }
type StorageListener = (changes: Record<string, StorageChange>, area: string) => void

class FakeStorage {
  private data = new Map<string, any>()
  private listeners = new Set<StorageListener>()
  public writes = 0
  constructor(private maxWrites?: number) {}

  onChanged = {
    addListener: (listener: StorageListener) => {
      this.listeners.add(listener)
    },
    removeListener: (listener: StorageListener) => {
      this.listeners.delete(listener)
    }
  }

  async get(key: string | string[]) {
    if (Array.isArray(key)) {
      const out: Record<string, any> = {}
      for (const k of key) out[k] = this.data.get(k)
      return out
    }
    return { [key]: this.data.get(key) }
  }

  async set(payload: Record<string, any>) {
    if (this.maxWrites !== undefined && this.writes >= this.maxWrites) return
    this.writes += 1
    const changes: Record<string, StorageChange> = {}
    for (const [k, v] of Object.entries(payload)) {
      const oldValue = this.data.get(k)
      this.data.set(k, v)
      changes[k] = { oldValue, newValue: v }
    }
    for (const listener of this.listeners) {
      listener(changes, 'local')
    }
  }
}

type SidebarSettings = {
  enabled: boolean
  mode?: 'inject' | 'native'
  position: { x: number; y: number }
  opacity: number
}

function createSettingsSync(storage: FakeStorage) {
  const serialize = (value: SidebarSettings) => JSON.stringify(value)
  let isApplyingStorage = false
  const settings: SidebarSettings = {
    enabled: true,
    mode: 'inject',
    position: { x: 100, y: 200 },
    opacity: 80
  }
  let lastSerialized = serialize(settings)

  const onSettingsChange = async () => {
    if (isApplyingStorage) return
    const serialized = serialize(settings)
    if (serialized === lastSerialized) return
    lastSerialized = serialized
    await storage.set({ sidebarSettings: JSON.parse(serialized) })
  }

  const onStorageChange = (changes: Record<string, StorageChange>, area: string) => {
    if (area !== 'local') return
    const change = changes.sidebarSettings
    const next = change?.newValue as SidebarSettings | undefined
    if (!next || typeof next !== 'object') return
    const normalized = { ...next, mode: next.mode || 'inject' }
    const serialized = serialize(normalized)
    if (serialized === lastSerialized) return
    isApplyingStorage = true
    settings.enabled = normalized.enabled
    settings.mode = normalized.mode
    settings.position = normalized.position
    settings.opacity = normalized.opacity
    lastSerialized = serialized
    Promise.resolve().then(() => {
      isApplyingStorage = false
    })
  }

  storage.onChanged.addListener(onStorageChange)

  return {
    settings,
    onSettingsChange,
    onStorageChange,
    dispose: () => storage.onChanged.removeListener(onStorageChange)
  }
}

async function wait(ms: number) {
  await new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function runBaselineLoop() {
  const storage = new FakeStorage(50)
  const settings: SidebarSettings = {
    enabled: true,
    mode: 'inject',
    position: { x: 100, y: 200 },
    opacity: 80
  }

  const onSettingsChange = async () => {
    await storage.set({ sidebarSettings: { ...settings } })
  }

  const onStorageChange = (changes: Record<string, StorageChange>, area: string) => {
    if (area !== 'local') return
    const change = changes.sidebarSettings
    if (!change?.newValue) return
    const next = change.newValue as SidebarSettings
    settings.enabled = next.enabled
    settings.mode = next.mode
    settings.position = next.position
    settings.opacity = next.opacity
    void onSettingsChange()
  }

  storage.onChanged.addListener(onStorageChange)
  const start = Date.now()
  await storage.set({ sidebarSettings: { ...settings, enabled: false } })
  await wait(100)
  const duration = Date.now() - start
  storage.onChanged.removeListener(onStorageChange)
  return { writes: storage.writes, duration }
}

async function runLoopTest() {
  const storage = new FakeStorage()
  const sync = createSettingsSync(storage)

  const nextSettings: SidebarSettings = {
    enabled: false,
    mode: 'inject',
    position: { x: 120, y: 240 },
    opacity: 70
  }

  const start = Date.now()
  await storage.set({ sidebarSettings: nextSettings })
  await sync.onSettingsChange()

  sync.settings.opacity = 60
  await sync.onSettingsChange()
  await wait(100)

  const duration = Date.now() - start
  assert.ok(duration <= 200, '循环耗时过长')
  assert.ok(storage.writes <= 2, '写入次数超过 2')

  sync.dispose()
  return { writes: storage.writes, duration }
}

async function main() {
  console.log('当前环境:' + isDev + ', 是否开发环境:' + (isDev ? '是' : '否'))
  const cpuStart = process.cpuUsage()
  const baseline = await runBaselineLoop()
  const result = await runLoopTest()
  const cpuEnd = process.cpuUsage(cpuStart)
  console.log('基线结果: 写入次数=' + baseline.writes + ', 耗时=' + baseline.duration + 'ms')
  console.log('修复结果: 写入次数=' + result.writes + ', 耗时=' + result.duration + 'ms')
  console.log('CPU 统计: user=' + cpuEnd.user + ', system=' + cpuEnd.system)
}

main().catch((err) => {
  console.error('测试失败: ' + (err instanceof Error ? err.message : String(err)))
  process.exit(1)
})
