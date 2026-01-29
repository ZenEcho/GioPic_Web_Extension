import type { DriveConfig, WebUploaderConfig, AliyunConfig, S3Config, TencentConfig, GithubConfig, CustomConfig, TestConfig } from '@/types'
import OSS from 'ali-oss'
import { S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import axios from 'axios'
import { getValueByPath, parseJsonConfig } from '@/utils/common'
import { replaceMagicVariables } from '@/utils/variables'


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
      throw new Error('Unknown config type')
  }
}

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

// Common Fetch Upload
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

async function uploadCustom(file: File, config: CustomConfig, onProgress: ProgressCallback): Promise<UploadResult> {
  // 1. Parse and Replace Variables in Config
  const rawHeaders = parseJsonConfig(config.headers)
  const rawQueryParams = parseJsonConfig(config.queryParams)
  const rawBodyParams = parseJsonConfig(config.bodyParams)

  const headers: Record<string, string> = {}
  const queryParams: Record<string, string> = {}
  const bodyParams: Record<string, string> = {}

  // Helper to replace variables in an object
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

  // 2. Prepare Data
  let data: any

  if (config.uploadFormat === 'binary') {
    // Binary Mode: Direct File Body
    data = file
    if (!headers['Content-Type'] && !headers['content-type']) {
      // Default to file type, but let user override
      headers['Content-Type'] = file.type || 'application/octet-stream'
    }
  } else if (config.uploadFormat === 'json') {
    // JSON Mode (Base64)
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
    // FormData Mode (Default)
    data = new FormData()
    data.append(fileParamName, file)
    Object.keys(bodyParams).forEach(key => {
      data.append(key, bodyParams[key])
    })
  }

  // 3. Send Request
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
      // If responseType is regex, we might need text response
      responseType: config.responseType === 'regex' ? 'text' : 'json'
    })

    // 4. Parse Response
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
      // Regex Mode
      const contentStr = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody)

      // Extract URL
      const urlRegex = new RegExp(config.responseUrlPath)
      const urlMatch = contentStr.match(urlRegex)
      url = urlMatch ? (urlMatch[1] || urlMatch[0]) : undefined // Group 1 or Full Match

    } else {
      // JSON Mode (Default)
      url = getValueByPath(responseBody, config.responseUrlPath)
    }

    if (!url) {
      throw new Error(`Cannot find URL at path/regex "${config.responseUrlPath}" in response`)
    }

    // 5. Post-process URL (Prefix/Suffix)
    const processUrl = (rawUrl: string | undefined) => {
      if (!rawUrl) return undefined
      try {
        const baseUrl = urlPrefix || apiUrl
        let finalUrl = String(rawUrl)

        // Try to resolve relative URL
        // If baseUrl is not a valid URL (e.g. just a path prefix), this might fail, so we fallback
        try {
          const urlObj = new URL(finalUrl, baseUrl.startsWith('http') ? baseUrl : undefined)
          finalUrl = urlObj.href
        } catch (e) {
          // Ignore URL parse error, use simple concatenation
        }

        // If manual prefix logic needed (when baseUrl is just a string prefix, not full URL)
        if (urlPrefix) {
          const prefix = urlPrefix.endsWith('/') ? urlPrefix : urlPrefix + '/'
          // If original URL is absolute (http...), we usually don't touch it unless forced?
          // But user configured a prefix, they likely want to use it.
          // Scenario A: Response is relative path "/img.png" -> Prepend prefix -> "https://cdn.com/img.png"
          // Scenario B: Response is absolute URL "http://api.com/img.png" -> Prepend prefix? -> "https://cdn.com/http://api.com/img.png" (WRONG)
          //                                                               -> Replace domain? -> "https://cdn.com/img.png" (Maybe)

          // Current logic: Only prepend if it doesn't look like an absolute URL OR if it doesn't already start with the prefix.
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

async function uploadTest(file: File, config: TestConfig, onProgress: ProgressCallback): Promise<UploadResult> {
  // Mock upload for testing
  const steps = 10
  for (let i = 1; i <= steps; i++) {
    await new Promise(resolve => setTimeout(resolve, 200))
    onProgress(i * 10)
  }

  return {
    url: 'https://example.com/test/' + file.name,
    thumbUrl: 'https://example.com/test/thumb/' + file.name
  }
}
// uploadZpic
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
// uploadImgdd
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
  console.log(res);
  if (!res.url) throw new Error(res.msg || 'ImgDD upload failed')
  return {
    url: res.url,
    thumbUrl: res.url
  }
}
// oneimg
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
