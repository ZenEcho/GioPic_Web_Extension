export * from './pluginSchema'
export * from './pluginMarketplace'

export type DriveType = 'lsky' | 'easyimages' | 'chevereto' | 'imgurl' | 'zpic' | 'aliyun' | 'aws' | 'tencent' | 'imgurl' | 'smms' | 'hellohao' | 'imgur' | 'custom' | 'github' | 'test' | 'imgdd' | 'oneimg' | 'see' | (string & {})

export interface PluginDriveConfig extends BaseConfig {
  [key: string]: any
}

export interface BaseConfig {
  id: string
  name: string
  type: DriveType
  enabled: boolean
}

export interface WebUploaderConfig extends BaseConfig {
  type: 'lsky' | 'easyimages' | 'chevereto' | 'imgurl' | 'zpic' | 'smms' | 'hellohao' | 'imgur' | 'imgdd' | 'oneimg' | 'see'
  apiUrl: string
  token: string
  strategyId?: string
  version?: 'v1' | 'v2'
  uid?: string
  albumId?: string
  expiration?: string
  nsfw?: boolean | string
  source?: string
  permission?: string
  dedup?: boolean | string
  watermark?: boolean | string
  compress?: boolean | string
}

export interface AliyunConfig extends BaseConfig {
  type: 'aliyun'
  endpoint: string
  bucket: string
  accessKeyId: string
  accessKeySecret: string
  path?: string
  customDomain?: string
}

export interface S3Config extends BaseConfig {
  type: 'aws'
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  path?: string
  customDomain?: string
}

export interface TencentConfig extends BaseConfig {
  type: 'tencent'
  secretId: string
  secretKey: string
  bucket: string
  region: string
  path?: string
  customDomain?: string
}

export interface GithubConfig extends Omit<BaseConfig, 'type'> {
  type: 'github'
  repo: string
  branch: string
  token: string
  path?: string
  customDomain?: string
}

export interface CustomConfig extends Omit<BaseConfig, 'type'> {
  type: 'custom'
  apiUrl: string
  method: 'POST' | 'PUT'
  uploadFormat: 'formData' | 'json' | 'binary'
  fileParamName: string
  headers?: string
  bodyParams?: string
  queryParams?: string
  responseType?: 'json' | 'regex'
  responseUrlPath: string
  urlPrefix?: string
  urlSuffix?: string
}

export interface TestConfig extends BaseConfig {
  type: 'test'
  apiUrl: string
  token: string
}

export type DriveConfig = WebUploaderConfig | AliyunConfig | S3Config | TencentConfig | GithubConfig | CustomConfig | TestConfig | PluginDriveConfig

export interface UploadRecord {
  id: string
  url: string
  filename: string
  configId: string
  configName: string
  createdAt: number
  status: 'success' | 'failed'
  error?: string
  thumbUrl?: string
}

export interface UploadTask {
  id: string
  configId: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  result?: string
  error?: string
}

export interface QueueItem {
  id: string
  file: File
  preview: string
  tasks: UploadTask[]
  status: 'pending' | 'processing' | 'success' | 'error' | 'paused'
}
