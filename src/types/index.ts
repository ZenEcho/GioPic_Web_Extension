export type DriveType = 'lsky' | 'easyimages' | 'chevereto' | 'imgurl' | 'zpic' | 'aliyun' | 'aws' | 'tencent' | 'imgurl' | 'smms' | 'hellohao' | 'imgur' | 'custom' | 'github' | 'test';

export interface BaseConfig {
  id: string;
  name: string;
  type: DriveType;
  enabled: boolean; // 是否启用
}

export interface WebUploaderConfig extends BaseConfig {
  type: 'lsky' | 'easyimages' | 'chevereto' | 'imgurl' | 'zpic' | 'smms' | 'hellohao' | 'imgur';
  apiUrl: string;
  token: string;
  strategyId?: string;
  version?: 'v1' | 'v2';
  // Extra fields for specific uploaders
  uid?: string; // For ImgURL
  albumId?: string; // For Chevereto
  expiration?: string; // For Chevereto
  nsfw?: boolean | string; // For Chevereto
  source?: string; // For Hellohao
  permission?: string; // For Lsky (1=Public/0=Private or similar)
  dedup?: boolean | string; // 默认为 true ，仅对 Zpic 有效
  watermark?: boolean | string; // 默认为 false ，仅对 Zpic 有效
  compress?: boolean | string; // 默认为 true ，仅对 Zpic 有效
}

export interface AliyunConfig extends BaseConfig {
  type: 'aliyun';
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  accessKeySecret: string;
  path?: string;
  customDomain?: string;
}

export interface S3Config extends BaseConfig {
  type: 'aws';
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  path?: string;
  customDomain?: string;
}

export interface TencentConfig extends BaseConfig {
  type: 'tencent';
  secretId: string;
  secretKey: string;
  bucket: string;
  region: string;
  path?: string;
  customDomain?: string;
}

export interface GithubConfig extends Omit<BaseConfig, 'type'> {
  type: 'github';
  repo: string; // username/repo
  branch: string;
  token: string;
  path?: string;
  customDomain?: string;
}

export interface CustomConfig extends Omit<BaseConfig, 'type'> {
  type: 'custom';
  apiUrl: string;
  method: 'POST' | 'PUT';
  uploadFormat: 'formData' | 'json' | 'binary';
  fileParamName: string;
  headers?: string; // JSON string
  bodyParams?: string; // JSON string
  queryParams?: string; // JSON string
  responseType?: 'json' | 'regex'; // 默认 json
  responseUrlPath: string; // JSON path or Regex
  urlPrefix?: string; // 自定义URL前缀，例如https://example.com/
  urlSuffix?: string; // 自定义URL后缀，例如.jpg
}

export interface TestConfig extends BaseConfig {
  type: 'test';
  apiUrl: string;
  token: string;
}

export type DriveConfig = WebUploaderConfig | AliyunConfig | S3Config | TencentConfig | GithubConfig | CustomConfig | TestConfig;

export interface UploadRecord {
  id: string;
  url: string;
  filename: string;
  configId: string;
  configName: string;
  createdAt: number;
  status: 'success' | 'failed';
  error?: string;
  thumbUrl?: string;
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
