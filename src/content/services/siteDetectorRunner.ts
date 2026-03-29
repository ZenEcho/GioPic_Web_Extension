import type {
  DetectorElementSnapshot,
  DetectorFetchResponse,
  DetectorPageInfo,
  DetectorScriptMatchResult,
  SiteDetectorPlugin,
  SiteDetectorPresentation,
} from '@/types'
import { isSiteDetectorPlugin, type PluginMeta } from '@/types'
import { normalizeStoredPlugins } from '@/utils/pluginCore'
import { db } from '@/utils/storage'
import browser from 'webextension-polyfill'
import { siteDetectorSandbox } from './siteDetectorSandbox'
import {
  isSiteDetectorDismissedForPage,
  isSiteDetectorHostIgnored,
} from './siteDetectorStorage'

const DETECTOR_ALLOWED_MESSAGE_TYPES = new Set(['GET_AUTH_STATE'])
const EXTERNAL_STORE_ACCESS = {
  pluginId: 'builtin.site-detector.16best',
  dbName: 'image-hosting',
  storeName: 'config',
} as const

export interface SiteDetectorMatchCandidate {
  plugin: SiteDetectorPlugin
  score: number
  state: Record<string, any>
  presentation: SiteDetectorPresentation
}

function getPageInfo(): DetectorPageInfo {
  return {
    url: window.location.href,
    origin: window.location.origin,
    hostname: window.location.hostname,
    pathname: window.location.pathname,
    title: document.title,
  }
}

function serializeElement(element: Element | null): DetectorElementSnapshot | null {
  if (!element) {
    return null
  }

  const htmlElement = element as HTMLElement
  const attributes: Record<string, string> = {}
  for (const attribute of Array.from(element.attributes)) {
    attributes[attribute.name] = attribute.value
  }

  const dataset: Record<string, string> = {}
  if (htmlElement.dataset) {
    Object.entries(htmlElement.dataset).forEach(([key, value]) => {
      dataset[key] = value ?? ''
    })
  }

  return {
    tagName: element.tagName,
    textContent: element.textContent,
    innerHTML: htmlElement.innerHTML || '',
    value: 'value' in htmlElement ? String((htmlElement as HTMLInputElement).value ?? '') : null,
    attributes,
    dataset,
  }
}

function querySelector(selector: string): Element | null {
  try {
    return document.querySelector(selector)
  } catch (error: any) {
    throw new Error(`Invalid selector: ${selector}. ${error?.message || ''}`.trim())
  }
}

function querySelectorAll(selector: string): Element[] {
  try {
    return Array.from(document.querySelectorAll(selector))
  } catch (error: any) {
    throw new Error(`Invalid selector: ${selector}. ${error?.message || ''}`.trim())
  }
}

function deserializeBody(body: any): BodyInit | undefined {
  if (body === undefined || body === null) {
    return undefined
  }

  if (typeof body === 'string') {
    return body
  }

  if (body.__type === 'FormData' && Array.isArray(body.entries)) {
    const formData = new FormData()
    for (const entry of body.entries) {
      if (Array.isArray(entry) && entry.length >= 2) {
        formData.append(String(entry[0]), entry[1] as any)
      }
    }
    return formData
  }

  if (body.__type === 'URLSearchParams' && typeof body.value === 'string') {
    return new URLSearchParams(body.value)
  }

  return body as BodyInit
}

function deserializeRequestInit(init: any): RequestInit {
  if (!init || typeof init !== 'object') {
    return {}
  }

  return {
    ...init,
    body: deserializeBody(init.body),
  }
}

async function safeFetch(input: string, init?: RequestInit): Promise<DetectorFetchResponse> {
  const response = await fetch(input, init)
  const headers: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    headers[key] = value
  })

  const contentType = response.headers.get('content-type') || ''
  const rawText = await response.text()
  let body: any = rawText

  if (contentType.includes('application/json')) {
    try {
      body = rawText ? JSON.parse(rawText) : null
    } catch {
      body = rawText
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    url: response.url,
    headers,
    body,
  }
}

async function waitForSelector(selector: string, timeout = 2000): Promise<boolean> {
  if (querySelector(selector)) {
    return true
  }

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (querySelector(selector)) {
        clearTimeout(timer)
        observer.disconnect()
        resolve(true)
      }
    })

    const timer = setTimeout(() => {
      observer.disconnect()
      resolve(false)
    }, timeout)

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    })
  })
}

async function handleDetectorMessage(type: string, payload?: any): Promise<any> {
  if (!DETECTOR_ALLOWED_MESSAGE_TYPES.has(type)) {
    throw new Error(`Unsupported site detector message type: ${type}`)
  }

  const response = await browser.runtime.sendMessage({
    type: 'SITE_DETECTOR_MESSAGE',
    messageType: type,
    payload,
  }) as { success?: boolean; error?: string; data?: any }

  if (response?.success === false) {
    throw new Error(response.error || 'Detector message failed')
  }

  return response
}

async function readExternalStore(plugin: SiteDetectorPlugin, dbName: string, storeName: string): Promise<any[]> {
  if (
    plugin.id !== EXTERNAL_STORE_ACCESS.pluginId
    || dbName !== EXTERNAL_STORE_ACCESS.dbName
    || storeName !== EXTERNAL_STORE_ACCESS.storeName
  ) {
    throw new Error(`External store access is not allowed for ${plugin.id}`)
  }

  return db.getFromExternal(dbName, storeName)
}

async function fetchInstalledPluginsFromBackground(): Promise<PluginMeta[]> {
  const response = await browser.runtime.sendMessage({
    type: 'GET_INSTALLED_PLUGINS',
  }) as { success?: boolean; error?: string; plugins?: PluginMeta[] }

  if (response?.success === false) {
    throw new Error(response.error || 'Failed to load installed plugins')
  }

  return normalizeStoredPlugins(response?.plugins || [])
}

async function executeDetectorScript(
  plugin: SiteDetectorPlugin,
  script: string,
  input?: Record<string, any>,
  state?: Record<string, any>,
): Promise<any> {
  return siteDetectorSandbox.execute({
    page: getPageInfo(),
    script,
    input,
    state,
  }, {
    handleLog(level, args, page) {
      const method = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
      method('[SiteDetectorSandbox]', page.hostname, ...args)
    },
    async handleRpc(method, params) {
      switch (method) {
        case 'query':
          return serializeElement(querySelector(String(params.selector || '')))
        case 'queryAll':
          return querySelectorAll(String(params.selector || '')).slice(0, 50).map(element => serializeElement(element)).filter(Boolean)
        case 'text':
          return querySelector(String(params.selector || ''))?.textContent?.trim() || null
        case 'attr': {
          const element = querySelector(String(params.selector || ''))
          return element ? element.getAttribute(String(params.name || '')) : null
        }
        case 'exists':
          return querySelector(String(params.selector || '')) !== null
        case 'waitForSelector':
          return waitForSelector(String(params.selector || ''), Number(params.timeout) || 2000)
        case 'fetch':
          return safeFetch(String(params.input || ''), deserializeRequestInit(params.init))
        case 'sendMessage':
          return handleDetectorMessage(String(params.type || ''), params.payload)
        case 'readExternalStore':
          return readExternalStore(plugin, String(params.dbName || ''), String(params.storeName || ''))
        default:
          throw new Error(`Unsupported detector ctx method: ${method}`)
      }
    },
  })
}

function computeMatchScore(plugin: SiteDetectorPlugin, page: DetectorPageInfo): number | null {
  const match = plugin.detector.match
  if (!match) {
    return 0
  }

  let score = 0

  if (match.domains?.length) {
    const matched = match.domains.some(domain => domain.toLowerCase() === page.hostname.toLowerCase())
    if (!matched) {
      return null
    }
    score += 120
  }

  if (match.domainSuffixes?.length) {
    const matched = match.domainSuffixes.some(suffix => page.hostname.toLowerCase().endsWith(suffix.toLowerCase()))
    if (!matched) {
      return null
    }
    score += 80
  }

  if (match.pathnameEquals?.length) {
    const matched = match.pathnameEquals.includes(page.pathname)
    if (!matched) {
      return null
    }
    score += 40
  }

  if (match.pathnameIncludes?.length) {
    const matched = match.pathnameIncludes.some(pattern => page.pathname.includes(pattern))
    if (!matched) {
      return null
    }
    score += 20
  }

  if (match.urlPatterns?.length) {
    const matched = match.urlPatterns.some(pattern => {
      try {
        return new RegExp(pattern).test(page.url)
      } catch {
        return page.url.includes(pattern)
      }
    })
    if (!matched) {
      return null
    }
    score += 25
  }

  return score
}

function normalizeDetectResult(result: any): Required<Pick<DetectorScriptMatchResult, 'score' | 'data'>> & { matched: boolean; presentation?: SiteDetectorPresentation } {
  if (result === true) {
    return { matched: true, score: 0, data: {} }
  }

  if (!result) {
    return { matched: false, score: 0, data: {} }
  }

  if (typeof result !== 'object') {
    return { matched: Boolean(result), score: 0, data: {} }
  }

  const matched = 'matched' in result ? result.matched !== false : true
  const score = typeof result.score === 'number' && Number.isFinite(result.score) ? result.score : 0
  const presentation = typeof result.presentation === 'object' && result.presentation !== null ? result.presentation : undefined
  const data = typeof result.data === 'object' && result.data !== null
    ? result.data
    : Object.fromEntries(Object.entries(result).filter(([key]) => !['matched', 'score', 'presentation'].includes(key)))

  return {
    matched,
    score,
    data,
    presentation,
  }
}

export async function loadInstalledSiteDetectorPlugins(): Promise<SiteDetectorPlugin[]> {
  const plugins = await fetchInstalledPluginsFromBackground()
  return plugins.filter((plugin): plugin is SiteDetectorPlugin => plugin.enabled !== false && isSiteDetectorPlugin(plugin))
}

export async function findBestSiteDetector(): Promise<SiteDetectorMatchCandidate | null> {
  const page = getPageInfo()
  const plugins = await loadInstalledSiteDetectorPlugins()
  if (plugins.length === 0) {
    console.warn('[SiteDetector] No installed site-detector plugins available for', page.hostname)
  }

  let winner: SiteDetectorMatchCandidate | null = null

  for (const plugin of plugins) {
    if (await isSiteDetectorHostIgnored(plugin.id, page.hostname)) {
      continue
    }

    if (isSiteDetectorDismissedForPage(plugin.id, page.url)) {
      continue
    }

    const staticScore = computeMatchScore(plugin, page)
    if (staticScore === null) {
      continue
    }

    try {
      const result = normalizeDetectResult(await executeDetectorScript(plugin, plugin.detector.detectScript))
      if (!result.matched) {
        continue
      }

      const candidate: SiteDetectorMatchCandidate = {
        plugin,
        score: (plugin.detector.priority || 0) + staticScore + result.score,
        state: result.data || {},
        presentation: {
          ...(plugin.detector.presentation || {}),
          ...(result.presentation || {}),
        },
      }

      if (!winner || candidate.score > winner.score) {
        winner = candidate
      }
    } catch (error) {
      console.warn(`[SiteDetector] Failed to evaluate ${plugin.id}:`, error)
    }
  }

  return winner
}

export async function executeSiteDetectorExtract(
  plugin: SiteDetectorPlugin,
  input: Record<string, any>,
  state: Record<string, any>,
): Promise<any> {
  return executeDetectorScript(plugin, plugin.detector.extractScript, input, state)
}

