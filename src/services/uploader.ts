/**
 * @file uploader.ts
 * @description 核心图片上传服务
 * 
 * 职责：
 * 1. 提供统一的图片上传接口 (uploadImage)，屏蔽底层图床差异
 * 2. 实现各个图床 (Web API 类、OSS 类、S3 类) 的具体上传逻辑
 * 3. 支持自定义图床配置 (CustomConfig)
 * 4. 支持插件化图床 (PluginDriveConfig)
 * 5. 处理上传进度回调
 * 
 * 依赖：
 * - axios: 处理 HTTP 请求
 * - ali-oss: 阿里云 OSS 上传
 * - @aws-sdk/client-s3: S3 协议上传 (AWS, Tencent COS, MinIO 等)
 * - ./pluginRunner: 插件运行器
 */

import type { DriveConfig, WebUploaderConfig, AliyunConfig, S3Config, TencentConfig, GithubConfig, CustomConfig, TestConfig, PluginDriveConfig } from '@/types'
import OSS from 'ali-oss'
import { S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import axios from 'axios'
import { getValueByPath, parseJsonConfig } from '@/utils/common'
import { replaceMagicVariables } from '@/utils/variables'
import { runPlugin } from '@/services/pluginRunner'


export interface UploadResult {
  url: string
  thumbUrl?: string
}

export type ProgressCallback = (percent: number) => void

interface LskyStorage {
  id: number | string
  name: string
}

interface LskyAlbum {
  id: number | string
  name: string
}

/**
 * 统一上传入口函数
 * 根据配置类型分发到具体的上传实现
 * 
 * @param file - 要上传的文件对象
 * @param config - 图床配置
 * @param onProgress - 进度回调函数
 * @returns 上传结果 (包含 URL)
 */
export async function uploadImage(
  file: File,
  config: DriveConfig,
  onProgress: ProgressCallback
): Promise<UploadResult> {
  switch (config.type) {
    case 'lsky':
      return uploadLsky(file, config as WebUploaderConfig, onProgress)
    case 'easyimages':
      return uploadEasyImages(file, config as WebUploaderConfig, onProgress)
    case 'chevereto':
      return uploadChevereto(file, config as WebUploaderConfig, onProgress)
    case 'imgurl':
      return uploadImgURL(file, config as WebUploaderConfig, onProgress)
    case 'zpic':
      return uploadZpic(file, config as WebUploaderConfig, onProgress)
    case 'smms':
      return uploadSMMS(file, config as WebUploaderConfig, onProgress)
    case 'hellohao':
      return uploadHellohao(file, config as WebUploaderConfig, onProgress)
    case 'imgur':
      return uploadImgur(file, config as WebUploaderConfig, onProgress)
    case 'imgdd':
      return uploadImgdd(file, config as WebUploaderConfig, onProgress)
    case 'oneimg':
      return uploadOneImg(file, config as WebUploaderConfig, onProgress)
    case 'aliyun':
      return uploadAliyun(file, config as AliyunConfig, onProgress)
    case 'aws':
      return uploadS3(file, config as S3Config, onProgress)
    case 'tencent':
      return uploadTencent(file, config as TencentConfig, onProgress)
    case 'github':
      return uploadGithub(file, config as GithubConfig, onProgress)
    case 'custom':
      return uploadCustom(file, config as CustomConfig, onProgress)
    case 'test':
      return uploadTest(file, config as TestConfig, onProgress)
    default:
        // 尝试作为插件运行
        try {
            const url = await runPlugin(config as PluginDriveConfig, file, onProgress);
            return { url };
        } catch (e: any) {
            if (e.message?.includes('not found')) {
                throw new Error('Unknown config type');
            }
            throw e;
        }
  }
}

/**
 * 获取兰空图床 (Lsky Pro) 的存储策略列表
 * @param apiUrl - API 地址
 * @param token - 用户 Token
 * @param version - Lsky 版本 (v1/v2)
 */
export async function fetchLskyStrategies(apiUrl: string, token: string, version: 'v1' | 'v2' = 'v1'): Promise<LskyStorage[]> {
  let url = apiUrl.replace(/\/$/, '')

  if (version === 'v2') {
    if (!url.endsWith('/api/v2/group')) {
      url += '/api/v2/group'
    }

    try {
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })

      const data = await res.json()

      if (!data.status) {
        throw new Error(data.message || 'Fetch strategies failed')
      }

      const storages = data.data?.storages || []
      return storages.map((s: any) => ({
        id: s.id,
        name: s.name
      }))
    } catch (e) {
      console.error('Fetch Lsky V2 strategies failed', e)
      return []
    }
  } else {
    if (!url.endsWith('/api/v1/strategies')) {
      url += '/api/v1/strategies'
    }

    try {
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
      const data = await res.json()

      if (!data.status) {
        throw new Error(data.message || 'Fetch strategies failed')
      }

      const strategies = Array.isArray(data.data) ? data.data : (data.data?.strategies || [])
      return strategies.map((s: any) => ({
        id: s.id,
        name: s.name
      }))
    } catch (e) {
      console.error('Fetch Lsky V1 strategies failed', e)
      return []
    }
  }
}

/**
 * 获取兰空图床 (Lsky Pro) 的相册列表
 */
export async function fetchLskyAlbums(apiUrl: string, token: string, version: 'v1' | 'v2' = 'v1'): Promise<LskyAlbum[]> {
  let url = apiUrl.replace(/\/$/, '')

  if (version === 'v2') {
    if (!url.endsWith('/api/v2/user/albums')) {
      url += '/api/v2/user/albums'
    }

    try {
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
      const data = await res.json()

      if (data.status !== 'success' && data.status !== true) {
        throw new Error(data.message || 'Fetch albums failed')
      }

      const albums = data.data?.data || []
      return albums.map((a: any) => ({
        id: a.id,
        name: a.name
      }))

    } catch (e) {
      console.error('Fetch Lsky V2 albums failed', e)
      return []
    }
  } else {
    if (!url.endsWith('/api/v1/albums')) {
      url += '/api/v1/albums'
    }

    try {
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
      const data = await res.json()

      if (!data.status) {
        throw new Error(data.message || 'Fetch albums failed')
      }

      const albums = data.data?.data || []
      return albums.map((a: any) => ({
        id: a.id,
        name: a.name
      }))
    } catch (e) {
      console.error('Fetch Lsky V1 albums failed', e)
      return []
    }
  }
}

/**
 * 通用 HTTP 上传辅助函数
 * 封装了 axios 请求和进度处理
 */
async function fetchUpload(
  url: string,
  formData: FormData,
  headers: Record<string, string>,
  onProgress: ProgressCallback,
  extraConfig: Record<string, any> = {}
): Promise<any> {
  try {
    const res = await axios.post(url, formData, {
      headers: {
        ...headers
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percent = Math.floor((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(percent)
        }
      },
      ...extraConfig
    })

    return res.data
  } catch (error: any) {
    console.error('Fetch error:', error)
    if (error.response) {
      const data = error.response.data
      const errorMessage = data?.message || data?.error?.message || data?.msg || data?.error || `Upload failed: ${error.response.status} ${error.response.statusText}`
      throw new Error(errorMessage)
    } else if (error.request) {
      throw new Error('No response received from server')
    } else {
      throw new Error(error.message || 'Network error')
    }
  }
}

/**
 * 自定义图床上传实现
 * 支持复杂的变量替换、自定义 Headers/Body、Response 解析
 */
async function uploadCustom(file: File, config: CustomConfig, onProgress: ProgressCallback): Promise<UploadResult> {
  // 1. 解析配置并进行变量替换
  const rawHeaders = parseJsonConfig(config.headers)
  const rawQueryParams = parseJsonConfig(config.queryParams)
  const rawBodyParams = parseJsonConfig(config.bodyParams)

  const headers: Record<string, string> = {}
  const queryParams: Record<string, string> = {}
  const bodyParams: Record<string, string> = {}

  // 辅助函数：替换对象值中的变量
  const replaceInObj = (source: Record<string, any>, target: Record<string, string>) => {
    Object.keys(source).forEach(key => {
      target[replaceMagicVariables(key, file)] = replaceMagicVariables(String(source[key]), file)
    })
  }

  replaceInObj(rawHeaders, headers)
  replaceInObj(rawQueryParams, queryParams)
  replaceInObj(rawBodyParams, bodyParams)

  const apiUrl = replaceMagicVariables(config.apiUrl, file)
  const fileParamName = replaceMagicVariables(config.fileParamName || 'file', file)
  const urlPrefix = config.urlPrefix ? replaceMagicVariables(config.urlPrefix, file) : undefined
  const urlSuffix = config.urlSuffix ? replaceMagicVariables(config.urlSuffix, file) : undefined

  // 2. 准备请求数据
  let data: any

  if (config.uploadFormat === 'binary') {
    // Binary 模式: 直接发送文件内容
    data = file
    if (!headers['Content-Type'] && !headers['content-type']) {
      // 默认为文件类型，但也允许用户覆盖
      headers['Content-Type'] = file.type || 'application/octet-stream'
    }
  } else if (config.uploadFormat === 'json') {
    // JSON 模式: 文件转 Base64 后作为字段发送
    const reader = new FileReader()
    const contentBase64 = await new Promise<string>((resolve, reject) => {
      reader.onload = (e) => {
        const result = e.target?.result as string
        const base64 = result.split(',')[1]
        resolve(base64 || '')
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    data = {
      ...bodyParams,
      [fileParamName]: contentBase64
    }

    if (!headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json'
    }
  } else {
    // FormData 模式 (默认)
    data = new FormData()
    data.append(fileParamName, file)
    Object.keys(bodyParams).forEach(key => {
      data.append(key, bodyParams[key])
    })
  }

  // 3. 发送请求
  try {
    const response = await axios({
      method: config.method || 'POST',
      url: apiUrl,
      params: queryParams,
      headers,
      data,
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percent = Math.floor((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(percent)
        }
      },
      // 如果 responseType 是 regex，我们需要 text 响应
      responseType: config.responseType === 'regex' ? 'text' : 'json'
    })

    // 4. 解析响应
    let url: string | undefined

    let responseBody = response.data

    // 自动转换：如果 responseType 是 json，但返回的是字符串，尝试 parse JSON
    if (config.responseType === 'json' && typeof responseBody === 'string') {
      try {
        responseBody = JSON.parse(responseBody)
      } catch (e) {
        // 如果解析失败，可能是真的纯文本，保持原样，后续可能会报错或按路径取不到值
        console.warn('Failed to parse JSON string response:', e)
      }
    }

    if (config.responseType === 'regex') {
      // Regex 模式
      const contentStr = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody)

      // 提取 URL
      const urlRegex = new RegExp(config.responseUrlPath)
      const urlMatch = contentStr.match(urlRegex)
      url = urlMatch ? (urlMatch[1] || urlMatch[0]) : undefined // 优先取 Group 1，否则取全匹配
    } else {
      // JSON 模式 (默认)
      url = getValueByPath(responseBody, config.responseUrlPath)
    }

    if (!url) {
      throw new Error(`Cannot find URL at path/regex "${config.responseUrlPath}" in response`)
    }

    // 5. URL 后处理 (前缀/后缀/拼接)
    const processUrl = (rawUrl: string | undefined) => {
      if (!rawUrl) return undefined
      try {
        const baseUrl = urlPrefix || apiUrl
        let finalUrl = String(rawUrl)

        // 尝试解析相对 URL
        try {
          const urlObj = new URL(finalUrl, baseUrl.startsWith('http') ? baseUrl : undefined)
          finalUrl = urlObj.href
        } catch (e) {
          // 忽略 URL 解析错误，使用简单拼接
        }

        // 处理手动前缀拼接
        if (urlPrefix) {
          const prefix = urlPrefix.endsWith('/') ? urlPrefix : urlPrefix + '/'
          
          // 逻辑: 只有当 URL 不包含前缀时才拼接
          if (!finalUrl.startsWith(urlPrefix)) {
            const path = finalUrl.startsWith('/') ? finalUrl.slice(1) : finalUrl
            finalUrl = prefix + path
          }
        }

        if (urlSuffix) {
          finalUrl += urlSuffix
        }
        return finalUrl
      } catch (e) {
        return String(rawUrl)
      }
    }

    return {
      url: processUrl(url)!,
    }

  } catch (error: any) {
    console.error('Custom Upload Error:', error)
    if (error.response) {
      throw new Error(error.response.data?.message || `Upload failed: ${error.response.status}`)
    }
    throw error
  }
}

/**
 * 核心上传函数实现
 * 包含各个图床的具体 API 调用逻辑
 */

/**
 * 兰空图床上传实现
 * 
 * @param file - 文件对象
 * @param config - 配置对象
 * @param onProgress - 进度回调
 */
async function uploadLsky(file: File, config: WebUploaderConfig, onProgress: ProgressCallback): Promise<UploadResult> {
  const version = config.version || 'v1'
  const formData = new FormData()

  // Auto fix URL
  let url = config.apiUrl.replace(/\/$/, '')

  if (version === 'v2') {
    if (!url.endsWith('/api/v2/upload')) {
      url += '/api/v2/upload'
    }
    // Lsky V2 upload params
    formData.append('file', file)
    if (config.strategyId) {
      formData.append('storage_id', config.strategyId)
    }
    if (config.albumId) {
      formData.append('album_id', config.albumId)
    }
    if (config.permission) {
      // V2: is_public (true/false)
      const isPublic = config.permission === '1' ? '1' : '0'
      formData.append('is_public', isPublic)
    }
  } else {
    // V1 Logic
    if (!url.endsWith('/api/v1/upload')) {
      url += '/api/v1/upload'
    }
    formData.append('file', file)
    if (config.strategyId) formData.append('strategy_id', config.strategyId)
    if (config.albumId) formData.append('album_id', config.albumId)
    if (config.permission) {
      // V1: permission (1=Public, 0=Private)
      formData.append('permission', config.permission)
    }
  }

  const res = await fetchUpload(url, formData, {
    'Authorization': `Bearer ${config.token}`,
    'Accept': 'application/json'
  }, onProgress)

  if (version === 'v2') {
    if (res.status !== true && res.status !== 'success') {
      throw new Error(res.message || 'Lsky V2 upload failed')
    }

    const links = res.data.links || {}
    return {
      url: links.url || res.data.public_url,
      thumbUrl: links.thumbnail_url || links.url || res.data.public_url
    }
  } else {
    // V1 Logic
    if (!res.status) throw new Error(res.message || 'Lsky upload failed')
    return {
      url: res.data.links.url,
      thumbUrl: res.data.links.thumbnail_url
    }
  }
}

/**
 * EasyImages (简单图床) 上传实现
 */
async function uploadEasyImages(file: File, config: WebUploaderConfig, onProgress: ProgressCallback): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('image', file)
  formData.append('token', config.token)

  let url = config.apiUrl.replace(/\/$/, '')
  if (!url.endsWith('api/index.php')) {
    url += '/api/index.php'
  }

  const res = await fetchUpload(url, formData, {}, onProgress)

  if (res.result !== 'success') throw new Error(res.message || 'EasyImages upload failed')

  return {
    url: res.url,
    thumbUrl: res.thumb
  }
}

/**
 * Chevereto 上传实现
 */
async function uploadChevereto(file: File, config: WebUploaderConfig, onProgress: ProgressCallback): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('source', file)

  // Construct URL parameters
  const params: string[] = []
  // params.push(`key=${config.token}`)

  // Extra fields in URL
  if (config.albumId) params.push(`album_id=${config.albumId}`)

  // Handle Expiration: Only append if NOT 'NODEL' (and not 'NONE' to be safe)
  if (config.expiration && config.expiration !== 'NODEL' && config.expiration !== 'NONE') {
    params.push(`expiration=${config.expiration}`)
  }

  if (config.nsfw !== undefined) {
    const nsfwVal = String(config.nsfw)
    const val = (nsfwVal === '1' || nsfwVal === 'true') ? '1' : '0'
    params.push(`nsfw=${val}`)
  }

  let url = config.apiUrl.replace(/\/$/, '')
  if (!url.endsWith('/api/1/upload')) {
    url += '/api/1/upload'
  }

  // Append query string
  if (params.length > 0) {
    const joinChar = url.includes('?') ? '&' : '?'
    url += joinChar + params.join('&')
  }

  const headers = {
    'X-API-Key': config.token
  }

  const res = await fetchUpload(url, formData, headers, onProgress)

  if (res.status_code !== 200) throw new Error(res.error?.message || 'Chevereto upload failed')

  return {
    url: res.image.url,
    thumbUrl: res.image.thumb?.url || res.image.url
  }
}

/**
 * ImgURL 上传实现
 */
async function uploadImgURL(file: File, config: WebUploaderConfig, onProgress: ProgressCallback): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('token', config.token)
  if (config.uid) formData.append('uid', config.uid)

  let url = config.apiUrl.replace(/\/$/, '')
  if (!url.endsWith('/api/v2/upload')) {
    url += '/api/v2/upload'
  }

  const res = await fetchUpload(url, formData, {}, onProgress)

  if (res.code !== 200) throw new Error(res.msg || 'ImgURL upload failed')

  return {
    url: res.data.url,
    thumbUrl: res.data.thumbnail_url || res.data.url
  }
}

/**
 * 模拟上传 (测试用)
 */
async function uploadTest(file: File, config: TestConfig, onProgress: ProgressCallback): Promise<UploadResult> {
  // Mock upload for testing
  const steps = 10
  for (let i = 1; i <= steps; i++) {
    await new Promise(resolve => setTimeout(resolve, 200))
    onProgress(i * 10)
  }

  // 尝试从文件名中提取 seed 以保持图片一致性
  // 格式: mock_img_seed_{seed}.jpg
  const match = file.name.match(/mock_img_seed_(.+)\./)
  let url = 'https://picsum.photos/800/600'
  
  if (match && match[1]) {
    url = `https://picsum.photos/seed/${match[1]}/800/600`
  }

  return {
    url,
    thumbUrl: url
  }
}

/**
 * Zpic 上传实现
 */
async function uploadZpic(file: File, config: WebUploaderConfig, onProgress: ProgressCallback): Promise<UploadResult> {
  const formData = new FormData()
  const headers = {
    'Authorization': `Bearer ${config.token}`
  }
  const params = {
    dedup: config.dedup !== 'false', // 默认为 true
    album_id: config.albumId ? Number(config.albumId) : 0, // 默认为 0
    watermark: config.watermark === 'true', // 默认为 false
    compress: config.compress !== 'false' // 默认为 true
  }

  formData.append('file', file)
  formData.append('params', JSON.stringify(params))

  let url = config.apiUrl.replace(/\/$/, '')
  if (!url.endsWith('/api/v3/upload')) {
    url += '/api/v3/upload'
  }
  const res = await fetchUpload(url, formData, headers, onProgress)

  if (res.code !== 200) throw new Error(res.msg || 'Zpic upload failed')

  return {
    url: res.data.url,
    thumbUrl: res.data.thumbnail_url || res.data.url
  }
}

/**
 * SM.MS 上传实现
 */
async function uploadSMMS(file: File, config: WebUploaderConfig, onProgress: ProgressCallback): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('smfile', file)

  let url = config.apiUrl.replace(/\/$/, '')
  if (!url.endsWith('/api/v2/upload')) {
    url += '/api/v2/upload'
  }

  const headers = {
    'Authorization': config.token
  }

  const res = await fetchUpload(url, formData, headers, onProgress)

  if (!res.success) {
    if (res.code === 'image_repeated' && res.images) {
      return {
        url: res.images,
        thumbUrl: res.images
      }
    }
    throw new Error(res.message || 'SM.MS upload failed')
  }

  return {
    url: res.data.url,
    thumbUrl: res.data.url
  }
}

/**
 * HelloHao 上传实现
 */
async function uploadHellohao(file: File, config: WebUploaderConfig, onProgress: ProgressCallback): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('token', config.token)
  if (config.source) formData.append('source', config.source)

  let url = config.apiUrl.replace(/\/$/, '')
  if (!url.includes('/api/')) {
    url += '/api/uploadbytoken/'
  } else if (!url.endsWith('/')) {
    url += '/'
  }

  const res = await fetchUpload(url, formData, {}, onProgress)

  // Check both string and number 200
  if (res.code != 200 && res.code != '200') throw new Error(res.msg || 'Hellohao upload failed')

  return {
    url: res.data.url,
    thumbUrl: res.data.url
  }
}

/**
 * Imgur 上传实现
 */
async function uploadImgur(file: File, config: WebUploaderConfig, onProgress: ProgressCallback): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('image', file)

  let url = config.apiUrl
  if (!url || url.trim() === '') {
    url = 'https://api.imgur.com/3/image'
  }

  const headers = {
    'Authorization': `Client-ID ${config.token}`
  }

  const res = await fetchUpload(url, formData, headers, onProgress)

  if (!res.success) throw new Error(res.data?.error || 'Imgur upload failed')

  return {
    url: res.data.link,
    thumbUrl: res.data.link
  }
}

/**
 * ImgDD 上传实现
 */
async function uploadImgdd(file: File, config: WebUploaderConfig, onProgress: ProgressCallback): Promise<UploadResult> {
  const formData = new FormData()
  // 上传来源
  formData.append('upload-source', 'giopic/盘络上传2.0')
  formData.append('image', file)

  let url = config.apiUrl.replace(/\/$/, '')
  if (!url.endsWith('/upload')) {
    url += '/upload'
  }

  const res = await fetchUpload(url, formData, {}, onProgress)
  if (!res.url) throw new Error(res.msg || 'ImgDD upload failed')
  return {
    url: res.url,
    thumbUrl: res.url
  }
}

/**
 * OneImg 上传实现
 */
async function uploadOneImg(file: File, config: WebUploaderConfig, onProgress: ProgressCallback): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('images[]', file)
  if (config.strategyId) {
    formData.append('bucket_id', config.strategyId)
  }

  let url = config.apiUrl.replace(/\/$/, '')
  if (!url.endsWith('/api/upload/images')) {
    url += '/api/upload/images'
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json'
  }

  if (config.token && config.token !== 'null') {
    headers['Authorization'] = `Bearer ${config.token}`
  }

  const res = await fetchUpload(url, formData, headers, onProgress, { withCredentials: true })
  
  if (res.code !== 200) throw new Error(res.msg || res.message || 'OneImg upload failed')
  
  let fileUrl = res.data.files[0].url
  if (!fileUrl.startsWith('http')) {
    try {
      const u = new URL(config.apiUrl)
      fileUrl = `${u.origin}${fileUrl}`
    } catch (e) {
      console.warn('Failed to construct absolute URL', e)
    }
  }

  return {
    url: fileUrl,
    thumbUrl: fileUrl
  }
}

/**
 * 阿里云 OSS 上传实现
 */
async function uploadAliyun(file: File, config: AliyunConfig, onProgress: ProgressCallback): Promise<UploadResult> {

  const client = new OSS({
    // region: config.endpoint.split('.')[0], 
    endpoint: config.endpoint,
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    bucket: config.bucket,
    secure: true,
    cname: false // Assuming standard endpoint. If custom domain is used as endpoint, this might need to be true.
  })

  const path = config.path ? (config.path.endsWith('/') ? config.path : config.path + '/') : ''
  const filename = `${path}${Date.now()}_${file.name}`

  const result = await client.multipartUpload(filename, file, {
    // @ts-ignore
    progress: (p: number, checkpoint?: any) => {
      onProgress(Math.floor(p * 100))
    }
  })

  // @ts-ignore
  let url = result.res?.requestUrls?.[0] || result.url
  if (!url) {
    // Fallback URL construction if not present in result
    url = `https://${config.bucket}.${config.endpoint}/${filename}`
  }

  // Clean up URL query params if any (sometimes requestUrls contain uploadId)
  url = url.split('?')[0]

  if (config.customDomain) {
    const domain = config.customDomain.replace(/\/$/, '')
    // 如果 customDomain 不包含协议，默认添加 https
    const prefix = domain.startsWith('http') ? '' : 'https://'
    url = `${prefix}${domain}/${filename}`
  }

  return { url }
}

/**
 * GitHub 上传实现
 */
async function uploadGithub(file: File, config: any, onProgress: ProgressCallback): Promise<UploadResult> {
  const reader = new FileReader()
  const contentBase64 = await new Promise<string>((resolve, reject) => {
    reader.onload = (e) => {
      const result = e.target?.result as string
      // remove data:image/png;base64, prefix
      const base64 = result.split(',')[1]
      resolve(base64 || '')
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  // Handle path: ensure it ends with / if not empty, and doesn't start with /
  let dir = config.path || ''
  dir = dir.replace(/^\/+/, '') // Remove leading slashes
  if (dir && !dir.endsWith('/')) dir += '/'

  // Clean repo string (remove whitespace)
  const repo = config.repo.trim()

  const encodedDir = dir.split('/').map((segment: string) => segment ? encodeURIComponent(segment) : '').join('/')
  const encodedFilename = `${encodedDir}${encodeURIComponent(file.name)}`

  // Use original filename for check and upload
  const branch = config.branch ? config.branch.trim() : 'main'
  const url = `https://api.github.com/repos/${repo}/${branch}/contents/${encodedFilename}`

  // Check if file exists to get SHA for update/overwrite
  let sha: string | undefined
  try {
    const checkRes = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      params: {
        ref: branch
      }
    })
    if (checkRes.data && checkRes.data.sha) {
      sha = checkRes.data.sha
    }
  } catch (error: any) {
    // If 404, file doesn't exist, which is fine. Other errors should be thrown.
    if (!error.response || error.response.status !== 404) {
      console.warn('Check file existence failed:', error)

    }
  }

  const data: any = {
    message: `Upload ${file.name} via GIOPIC ${new Date().toLocaleString()}`,
    content: contentBase64,
  }

  if (sha) {
    data.sha = sha
  }

  // Use axios for upload to support progress
  try {
    const res = await axios.put(url, data, {
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percent = Math.floor((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(percent)
        }
      }
    })

    if (res.status !== 201 && res.status !== 200) {
      throw new Error(`GitHub upload failed: ${res.statusText}`)
    }

    let downloadUrl = res.data.content.download_url

    if (config.customDomain) {
      const domain = config.customDomain.replace(/\/$/, '')
      const prefix = domain.startsWith('http') ? '' : 'https://'
      downloadUrl = `${prefix}${domain}/${encodedFilename}`
    }

    return {
      url: downloadUrl,
    }

  } catch (error: any) {
    console.error('GitHub Upload Error:', error)
    if (error.response) {
      const status = error.response.status
      let msg = error.response.data?.message || `GitHub upload failed: ${status}`

      if (status === 404) {
        msg += ' (Repository not found, or Token invalid, or Branch does not exist)'
      } else if (status === 401) {
        msg += ' (Unauthorized: Check your Token)'
      } else if (status === 422) {
        msg += ' (Validation Failed: Check branch name or file path)'
      }

      throw new Error(msg)
    }
    throw error
  }
}

/**
 * 腾讯云 COS 上传实现
 */
async function uploadTencent(file: File, config: TencentConfig, onProgress: ProgressCallback): Promise<UploadResult> {
  // Use AWS S3 SDK for Tencent COS (S3 Compatible) to support Service Worker (Manifest V3)
  const endpoint = `https://cos.${config.region}.myqcloud.com`

  const client = new S3Client({
    region: config.region,
    endpoint,
    credentials: {
      accessKeyId: config.secretId,
      secretAccessKey: config.secretKey
    },
    forcePathStyle: false // COS supports virtual hosted style
  })

  const path = config.path ? (config.path.endsWith('/') ? config.path : config.path + '/') : ''
  const key = `${path}${Date.now()}_${file.name}`

  const parallelUploads3 = new Upload({
    client: client,
    params: {
      Bucket: config.bucket,
      Key: key,
      Body: file,
      ContentType: file.type,
      // ACL: 'public-read' // Optional, depending on bucket policy
    },
  })

  parallelUploads3.on('httpUploadProgress', (progress) => {
    if (progress.total) {
      const percent = Math.floor((progress.loaded || 0) * 100 / progress.total)
      onProgress(percent)
    }
  })

  await parallelUploads3.done()

  let url = `https://${config.bucket}.cos.${config.region}.myqcloud.com/${key}`
  if (config.customDomain) {
    const domain = config.customDomain.replace(/\/$/, '')
    const prefix = domain.startsWith('http') ? '' : 'https://'
    url = `${prefix}${domain}/${key}`
  }

  return { url }
}

/**
 * AWS S3 (及兼容协议) 上传实现
 */
async function uploadS3(file: File, config: S3Config, onProgress: ProgressCallback): Promise<UploadResult> {
  // Determine if using AWS S3 or compatible service
  const isAws = !config.endpoint || config.endpoint.includes('amazonaws.com')
  const endpoint = config.endpoint ? (config.endpoint.startsWith('http') ? config.endpoint : `https://${config.endpoint}`) : undefined

  const client = new S3Client({
    region: config.region,
    endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    },
    forcePathStyle: !isAws // Force path style for non-AWS services (MinIO, etc.)
  })

  const path = config.path ? (config.path.endsWith('/') ? config.path : config.path + '/') : ''
  const key = `${path}${Date.now()}_${file.name}`

  const parallelUploads3 = new Upload({
    client: client,
    params: {
      Bucket: config.bucket,
      Key: key,
      Body: file,
      ContentType: file.type,
      ACL: 'public-read'
    },
  })

  parallelUploads3.on('httpUploadProgress', (progress) => {
    if (progress.total) {
      const percent = Math.floor((progress.loaded || 0) * 100 / progress.total)
      onProgress(percent)
    }
  })

  await parallelUploads3.done()

  let url = ''
  if (config.customDomain) {
    const domain = config.customDomain.replace(/\/$/, '')
    const prefix = domain.startsWith('http') ? '' : 'https://'
    url = `${prefix}${domain}/${key}`
  } else {
    if (!isAws && endpoint) {
      const cleanEndpoint = endpoint.replace(/\/$/, '')
      url = `${cleanEndpoint}/${config.bucket}/${key}`
    } else {
      url = `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`
    }
  }

  return { url }
}
