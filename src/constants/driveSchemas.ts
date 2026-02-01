export interface FieldSchema {
  key: string
  label: string // i18n key or raw string
  type: 'text' | 'password' | 'number' | 'switch' | 'select' | 'textarea' | 'kv-pairs' | 'checkbox' 
  placeholder?: string
  required?: boolean
  defaultValue?: any
  options?: { label: string; value: string }[]
}

export const COMMON_FIELDS: FieldSchema[] = [
  { key: 'path', label: 'config.form.path', type: 'text', placeholder: 'config.form.placeholder.path' },
  { key: 'customDomain', label: 'config.form.customDomain', type: 'text', placeholder: 'config.form.placeholder.customUrlPrefix' },
]

export type DriveCategory = 'self-hosted' | 'cloud' | 'public' | 'custom' | 'plugin'

export interface DriveRegistryItem {
  key: string
  label: string
  icon: string
  color: string
  darkColor?: string
  category: DriveCategory
  fields: FieldSchema[]
}

export const DRIVE_REGISTRY: Record<string, DriveRegistryItem> = {
  lsky: {
    key: 'lsky',
    label: 'Lsky Pro',
    icon: 'i-ph-cloud-arrow-up-duotone',
    color: 'text-blue-600 bg-blue-100',
    darkColor: 'dark:text-blue-300 dark:bg-blue-900/30',
    category: 'self-hosted',
    fields: [
      { key: 'version', label: 'config.form.version', type: 'select', options: [{ label: 'V1', value: 'v1' }, { label: 'V2', value: 'v2' }], defaultValue: 'v1' },
      { key: 'apiUrl', label: 'config.form.apiUrl', type: 'text', required: true, placeholder: 'https://example.com/api/v1/upload' },
      { key: 'token', label: 'config.form.token', type: 'password', required: true },
      { key: 'strategyId', label: 'config.form.strategyId', type: 'select', placeholder: 'config.form.placeholder.strategyId' },
      { key: 'albumId', label: 'config.form.albumId', type: 'select', placeholder: 'config.form.placeholder.albumId' },
      {
        key: 'permission',
        label: 'config.form.isPublic',
        type: 'select',
        defaultValue: '0',
        options: [
          { label: 'config.form.public', value: '1' },
          { label: 'config.form.private', value: '0' }
        ]
      },
    ]
  },
  easyimages: {
    key: 'easyimages',
    label: 'EasyImages',
    icon: 'i-ph-image-duotone',
    color: 'text-green-600 bg-green-100',
    darkColor: 'dark:text-green-300 dark:bg-green-900/30',
    category: 'self-hosted',
    fields: [
      { key: 'apiUrl', label: 'config.form.apiUrl', type: 'text', required: true, placeholder: 'https://example.com/api/index.php' },
      { key: 'token', label: 'config.form.token', type: 'password', required: true },
    ]
  },
  chevereto: {
    key: 'chevereto',
    label: 'Chevereto',
    icon: 'i-ph-images-square-duotone',
    color: 'text-orange-600 bg-orange-100',
    darkColor: 'dark:text-orange-300 dark:bg-orange-900/30',
    category: 'self-hosted',
    fields: [
      { key: 'apiUrl', label: 'config.form.apiUrl', type: 'text', required: true, placeholder: 'https://example.com/api/1/upload' },
      { key: 'token', label: 'config.form.token', type: 'password', required: true },
      { key: 'albumId', label: 'config.form.albumId', type: 'text', placeholder: 'config.form.placeholder.albumId' },
      {
        key: 'expiration',
        label: 'config.form.expiration',
        type: 'select',
        defaultValue: 'NONE',
        options: [
          { value: "NONE", label: "config.form.time.none" },
          { value: "PT5M", label: "config.form.time.min5" },
          { value: "PT15M", label: "config.form.time.min15" },
          { value: "PT30M", label: "config.form.time.min30" },
          { value: "PT1H", label: "config.form.time.hour1" },
          { value: "PT3H", label: "config.form.time.hour3" },
          { value: "PT6H", label: "config.form.time.hour6" },
          { value: "PT12H", label: "config.form.time.hour12" },
          { value: "P1D", label: "config.form.time.day1" },
          { value: "P2D", label: "config.form.time.day2" },
          { value: "P3D", label: "config.form.time.day3" },
          { value: "P4D", label: "config.form.time.day4" },
          { value: "P5D", label: "config.form.time.day5" },
          { value: "P6D", label: "config.form.time.day6" },
          { value: "P1W", label: "config.form.time.week1" },
          { value: "P2W", label: "config.form.time.week2" },
          { value: "P3W", label: "config.form.time.week3" },
          { value: "P1M", label: "config.form.time.month1" },
          { value: "P2M", label: "config.form.time.month2" },
          { value: "P3M", label: "config.form.time.month3" },
          { value: "P4M", label: "config.form.time.month4" },
          { value: "P5M", label: "config.form.time.month5" },
          { value: "P6M", label: "config.form.time.month6" },
          { value: "P1Y", label: "config.form.time.year1" }
        ]
      },
      {
        key: 'nsfw',
        label: 'config.form.nsfw',
        type: 'select',
        defaultValue: '0',
        options: [
          { label: 'config.form.no', value: '0' },
          { label: 'config.form.yes', value: '1' }
        ]
      },
    ]
  },
  imgurl: {
    key: 'imgurl',
    label: 'ImgURL',
    icon: 'i-ph-link-duotone',
    color: 'text-purple-600 bg-purple-100',
    darkColor: 'dark:text-purple-300 dark:bg-purple-900/30',
    category: 'self-hosted',
    fields: [
      { key: 'apiUrl', label: 'config.form.apiUrl', type: 'text', required: true, placeholder: 'https://imgurl.org' },
      { key: 'uid', label: 'config.form.uid', type: 'text', required: true },
      { key: 'token', label: 'config.form.token', type: 'password', required: true },
    ]
  },
  zpic: {
    key: 'zpic',
    label: 'Zpic',
    icon: 'i-ph-lightning-duotone',
    color: 'text-pink-600 bg-pink-100',
    darkColor: 'dark:text-pink-300 dark:bg-pink-900/30',
    category: 'self-hosted',
    fields: [
      { key: 'apiUrl', label: 'config.form.apiUrl', type: 'text', required: true, placeholder: 'https://example.com' },
      { key: 'token', label: 'config.form.token', type: 'password', required: true },
      { key: 'dedup', label: 'config.form.dedup', type: 'select', defaultValue: 'true', options: [{ value: 'true', label: 'config.form.yes' }, { value: 'false', label: 'config.form.no' }] },
      { key: 'albumId', label: 'config.form.albumId', type: 'text', placeholder: 'config.form.placeholder.albumId' },
      { key: 'watermark', label: 'config.form.watermark', type: 'select', defaultValue: 'false', options: [{ value: 'true', label: 'config.form.yes' }, { value: 'false', label: 'config.form.no' }] },
      { key: 'compress', label: 'config.form.compress', type: 'select', defaultValue: 'true', options: [{ value: 'true', label: 'config.form.yes' }, { value: 'false', label: 'config.form.no' }] },
    ]
  },
  hellohao: {
    key: 'hellohao',
    label: 'Hellohao',
    icon: 'i-ph-chat-circle-dots-duotone',
    color: 'text-indigo-600 bg-indigo-100',
    darkColor: 'dark:text-indigo-300 dark:bg-indigo-900/30',
    category: 'self-hosted',
    fields: [
      { key: 'apiUrl', label: 'config.form.apiUrl', type: 'text', required: true, placeholder: 'https://example.com' },
      { key: 'token', label: 'config.form.token', type: 'password', required: true },
      { key: 'source', label: 'config.form.source', type: 'text', required: true, placeholder: 'config.form.placeholder.sourceId' },
    ]
  },
  smms: {
    key: 'smms',
    label: 'SM.MS',
    icon: 'i-ph-image-duotone',
    color: 'text-blue-500 bg-blue-50',
    darkColor: 'dark:text-blue-300 dark:bg-blue-900/30',
    category: 'public',
    fields: [
      { key: 'apiUrl', label: 'config.form.apiUrl', type: 'text', placeholder: 'https://sm.ms (默认为官方)', defaultValue: 'https://sm.ms/' },
      { key: 'token', label: 'config.form.token', type: 'password', required: true },
    ]
  },
  imgur: {
    key: 'imgur',
    label: 'Imgur',
    icon: 'i-ph-arrow-fat-up-duotone',
    color: 'text-green-500 bg-green-50',
    darkColor: 'dark:text-green-300 dark:bg-green-900/30',
    category: 'public',
    fields: [
      { key: 'apiUrl', label: 'config.form.apiUrl', type: 'text', placeholder: 'https://api.imgur.com/3/upload (默认为官方)', defaultValue: 'https://api.imgur.com/3/upload/' },
      { key: 'token', label: 'Client ID', type: 'password', required: true },
    ]
  },
  imgdd: {
    key: 'imgdd',
    label: 'ImgDD',
    icon: 'i-ph-image-duotone',
    color: 'text-red-500 bg-red-50',
    darkColor: 'dark:text-red-300 dark:bg-red-900/30',
    category: 'public',
    fields: [
      { key: 'apiUrl', label: 'config.form.apiUrl', type: 'text', placeholder: 'https://imgdd.com/api/v1/upload', defaultValue: 'https://imgdd.com/upload', required: true },
    ]
  },
  oneimg: {
    key: 'oneimg',
    label: 'OneImg',
    icon: 'i-ph-image-duotone',
    color: 'text-red-500 bg-red-50',
    darkColor: 'dark:text-red-300 dark:bg-red-900/30',
    category: 'self-hosted',
    fields: [
      { key: 'apiUrl', label: 'config.form.apiUrl', type: 'text', required: true, placeholder: 'https://example.com/api/v1/upload' },
      { key: 'token', label: 'config.form.token', type: 'password' },
      { key: 'strategyId', label: 'config.form.strategyId', type: 'text', required: true },
    ]
  },
  aliyun: {
    key: 'aliyun',
    label: 'Aliyun OSS',
    icon: 'i-ph-cube-duotone',
    color: 'text-orange-600 bg-orange-100',
    darkColor: 'dark:text-orange-300 dark:bg-orange-900/30',
    category: 'cloud',
    fields: [
      { key: 'endpoint', label: 'config.form.endpoint', type: 'text', required: true, placeholder: 'oss-cn-hangzhou.aliyuncs.com' },
      { key: 'bucket', label: 'config.form.bucket', type: 'text', required: true },
      { key: 'accessKeyId', label: 'config.form.accessKey', type: 'text', required: true },
      { key: 'accessKeySecret', label: 'config.form.secretKey', type: 'password', required: true },
      ...COMMON_FIELDS
    ]
  },
  aws: {
    key: 'aws',
    label: 'AWS S3',
    icon: 'i-ph-database-duotone',
    color: 'text-yellow-600 bg-yellow-100',
    darkColor: 'dark:text-yellow-300 dark:bg-yellow-900/30',
    category: 'cloud',
    fields: [
      { key: 'endpoint', label: 'config.form.endpoint', type: 'text', placeholder: 's3.us-west-1.amazonaws.com' },
      { key: 'region', label: 'config.form.region', type: 'text', required: true, placeholder: 'us-west-1' },
      { key: 'bucket', label: 'config.form.bucket', type: 'text', required: true },
      { key: 'accessKeyId', label: 'config.form.accessKey', type: 'text', required: true },
      { key: 'secretAccessKey', label: 'config.form.secretKey', type: 'password', required: true },
      ...COMMON_FIELDS
    ]
  },
  tencent: {
    key: 'tencent',
    label: 'Tencent COS',
    icon: 'i-ph-cloud-duotone',
    color: 'text-blue-600 bg-blue-100',
    darkColor: 'dark:text-blue-300 dark:bg-blue-900/30',
    category: 'cloud',
    fields: [
      { key: 'endpoint', label: 'config.form.endpoint', type: 'text', placeholder: 'config.form.placeholder.endpoint' },
      { key: 'region', label: 'config.form.region', type: 'text', required: true, placeholder: 'ap-guangzhou' },
      { key: 'bucket', label: 'config.form.bucket', type: 'text', required: true },
      { key: 'secretId', label: 'config.form.secretId', type: 'text', required: true },
      { key: 'secretKey', label: 'config.form.secretKey', type: 'password', required: true },
      ...COMMON_FIELDS
    ]
  },
  github: {
    key: 'github',
    label: 'GitHub',
    icon: 'i-ph-github-logo-duotone',
    color: 'text-gray-700 bg-gray-200',
    darkColor: 'dark:text-gray-300 dark:bg-gray-700',
    category: 'public',
    fields: [
      { key: 'repo', label: 'config.form.repo', type: 'text', required: true, placeholder: 'username/repo' },
      { key: 'branch', label: 'config.form.branch', type: 'text', required: true, defaultValue: 'main', placeholder: 'main' },
      { key: 'token', label: 'config.form.token', type: 'password', required: true },
      ...COMMON_FIELDS
    ]
  },
  custom: {
    key: 'custom',
    label: 'Custom',
    icon: 'i-ph-code-duotone',
    color: 'text-gray-600 bg-gray-100',
    darkColor: 'dark:text-gray-300 dark:bg-gray-800',
    category: 'custom',
    fields: [
      { key: 'apiUrl', label: 'config.form.apiUrl', type: 'text', required: true, placeholder: 'https://api.example.com/upload' },
      {
        key: 'method',
        label: 'config.form.method',
        type: 'select',
        defaultValue: 'POST',
        options: [{ label: 'POST', value: 'POST' }, { label: 'PUT', value: 'PUT' }]
      },
      {
        key: 'uploadFormat',
        label: 'config.form.uploadFormat',
        type: 'select',
        defaultValue: 'formData',
        options: [
          { label: 'FormData', value: 'formData' },
          { label: 'JSON (Base64)', value: 'json' },
          { label: 'Binary (Raw Body)', value: 'binary' }
        ]
      },
      { key: 'fileParamName', label: 'config.form.fileParamName', type: 'text', defaultValue: 'file', required: true },
      { key: 'headers', label: 'config.form.headers', type: 'kv-pairs', placeholder: 'config.form.placeholder.header' },
      { key: 'bodyParams', label: 'config.form.bodyParams', type: 'kv-pairs', placeholder: 'config.form.placeholder.body' },
      { key: 'queryParams', label: 'config.form.queryParams', type: 'kv-pairs', placeholder: 'config.form.placeholder.query' },
      {
        key: 'responseType',
        label: 'config.form.responseType',
        type: 'select',
        defaultValue: 'json',
        options: [{ label: 'JSON', value: 'json' }, { label: 'Regex (Text/XML)', value: 'regex' }]
      },
      { key: 'responseUrlPath', label: 'config.form.responseUrlPath', type: 'text', required: true, placeholder: 'config.form.placeholder.responseUrlPath' },
      { key: 'urlPrefix', label: 'config.form.urlPrefix', type: 'text', placeholder: 'config.form.placeholder.urlPrefix' },
      { key: 'urlSuffix', label: 'config.form.urlSuffix', type: 'text', placeholder: 'config.form.placeholder.urlSuffix' },
    ]
  },
  // test: {
  //   key: 'test',
  //   label: 'Test Drive',
  //   icon: 'i-ph-flask-duotone',
  //   color: 'text-yellow-600 bg-yellow-100',
  //   darkColor: 'dark:text-yellow-300 dark:bg-yellow-900/30',
  //   category: 'custom',
  //   fields: [
  //     { key: 'apiUrl', label: 'config.form.apiUrl', type: 'text', required: true, placeholder: 'https://api.example.com/upload' },
  //     { key: 'token', label: 'config.form.token', type: 'password', required: true },
  //   ]
  // }
}

// Helper for backward compatibility
export const DRIVE_SCHEMAS: Record<string, FieldSchema[]> = Object.fromEntries(
  Object.values(DRIVE_REGISTRY).map(item => [item.key, item.fields])
)

export const DRIVE_TYPE_OPTIONS = Object.values(DRIVE_REGISTRY).map(item => ({
  label: item.label,
  value: item.key
}))
