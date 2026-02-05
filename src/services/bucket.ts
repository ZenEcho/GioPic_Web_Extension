/**
 * @file bucket.ts
 * @description 存储桶管理服务
 * 
 * 职责：
 * 1. 提供针对不同云存储厂商 (Aliyun OSS, Tencent COS, AWS S3) 的存储桶管理功能
 * 2. 统一管理 CORS (跨域资源共享) 规则的获取和设置
 * 3. 统一管理 ACL (访问控制列表) 的获取和设置
 * 
 * 依赖：
 * - ali-oss: 阿里云 OSS SDK
 * - cos-js-sdk-v5: 腾讯云 COS SDK
 * - @aws-sdk/client-s3: AWS S3 SDK (模块化)
 */

import OSS from 'ali-oss'
import COS from 'cos-js-sdk-v5'
import {
    S3Client,
    PutBucketCorsCommand,
    GetBucketCorsCommand,
    PutBucketAclCommand,
    GetBucketAclCommand,
    type BucketCannedACL
} from '@aws-sdk/client-s3'
import type { AliyunConfig, TencentConfig, S3Config } from '@/types'


export interface CorsRule {
    allowedOrigins: string[]
    allowedMethods: string[]
    allowedHeaders: string[]
    exposeHeaders: string[]
    maxAgeSeconds: number
}


export type AclType = 'default' | 'private' | 'public-read' | 'public-read-write' | 'authenticated-read'

// =================================================================================
// Helpers
// =================================================================================

const toArray = (v: any): string[] => Array.isArray(v) ? v : (v ? [v] : [])

const getProp = (obj: any, keys: string[]) => {
    for (const key of keys) {
        if (obj[key] !== undefined) return obj[key]
    }
    return undefined
}

/**
 * 解析不同 SDK 返回的 CORS 规则为统一格式
 */
export function parseCorsRule(rule: any): CorsRule {
    return {
        allowedOrigins: toArray(getProp(rule, ['allowedOrigins', 'AllowedOrigins', 'allowedOrigin'])),
        allowedMethods: toArray(getProp(rule, ['allowedMethods', 'AllowedMethods', 'allowedMethod'])),
        allowedHeaders: toArray(getProp(rule, ['allowedHeaders', 'AllowedHeaders', 'allowedHeader'])),
        exposeHeaders: toArray(getProp(rule, ['exposeHeaders', 'ExposeHeaders', 'exposeHeader'])),
        maxAgeSeconds: Number(getProp(rule, ['maxAgeSeconds', 'MaxAgeSeconds']) || 0)
    }
}

function createOssClient(config: AliyunConfig) {
    return new OSS({
        endpoint: config.endpoint,
        accessKeyId: config.accessKeyId,
        accessKeySecret: config.accessKeySecret,
        bucket: config.bucket,
        secure: true,
        cname: false
    })
}

function createCosClient(config: TencentConfig) {
    return new COS({
        SecretId: config.secretId,
        SecretKey: config.secretKey,
    })
}

function createS3Client(config: S3Config) {
    return new S3Client({
        region: config.region,
        endpoint: config.endpoint ? (config.endpoint.startsWith('http') ? config.endpoint : `https://${config.endpoint}`) : undefined,
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey
        }
    })
}

// S3 Group URI for AllUsers
// While AWS defines this, most S3 compatible services (MinIO, R2, etc) use this same URI for compatibility.
// However, we allow partial matching just in case.
const S3_GROUP_ALL_USERS = 'http://acs.amazonaws.com/groups/global/AllUsers'

const isPublicGroup = (uri?: string) => {
    if (!uri) return false
    return uri === S3_GROUP_ALL_USERS || uri.endsWith('/groups/global/AllUsers')
}

// =================================================================================
// Aliyun OSS Implementations
// =================================================================================

interface OssAclResult {
    acl?: string
    [key: string]: any
}

/**
 * 获取阿里云 OSS 存储桶 ACL
 * @param config 阿里云配置
 */
export async function getAliyunAcl(config: AliyunConfig): Promise<string> {
    const client = createOssClient(config)
    try {
        const result = await client.getBucketACL(config.bucket) as OssAclResult
        return result.acl || 'default'
    } catch (e) {
        throw e
    }
}

/**
 * 设置阿里云 OSS 存储桶 ACL
 * @param config 阿里云配置
 * @param acl ACL 类型
 */
export async function setAliyunAcl(config: AliyunConfig, acl: string) {
    if (acl === 'default') return
    const client = createOssClient(config)
    await client.putBucketACL(config.bucket, acl as OSS.ACLType)
}

/**
 * 获取阿里云 OSS 存储桶 CORS 规则
 * @param config 阿里云配置
 */
export async function getAliyunCors(config: AliyunConfig): Promise<CorsRule[]> {
    const client = createOssClient(config)
    try {
        const result = await client.getBucketCORS(config.bucket)
        const rules = (result as any).rules || []
        return rules.map(parseCorsRule)
    } catch (e: any) {
        if (e.code === 'NoSuchCORSConfiguration') return []
        throw e
    }
}

/**
 * 设置阿里云 OSS 存储桶 CORS 规则
 * @param config 阿里云配置
 * @param rules CORS 规则列表
 */
export async function setAliyunCors(config: AliyunConfig, rules: CorsRule[]) {
    const client = createOssClient(config)
    // 手动构造符合 OSS.CORSRule 类型的数组
    const ossRulesTyped: OSS.CORSRule[] = rules.map(r => ({
        allowedOrigin: r.allowedOrigins,
        allowedMethod: r.allowedMethods,
        allowedHeader: r.allowedHeaders,
        exposeHeader: r.exposeHeaders,
        maxAgeSeconds: String(r.maxAgeSeconds) // OSS 要求 maxAgeSeconds 为 string
    }))
    await client.putBucketCORS(config.bucket, ossRulesTyped)
}

// =================================================================================
// Tencent COS Implementations
// =================================================================================

/**
 * 获取腾讯云 COS 存储桶 ACL
 * @param config 腾讯云配置
 */
export async function getTencentAcl(config: TencentConfig): Promise<string> {
    const cos = createCosClient(config)
    return new Promise((resolve, reject) => {
        cos.getBucketAcl({
            Bucket: config.bucket,
            Region: config.region
        }, (err, data) => {
            if (err) return reject(err)
            resolve(data.ACL || 'default')
        })
    })
}

/**
 * 设置腾讯云 COS 存储桶 ACL
 * @param config 腾讯云配置
 * @param acl ACL 类型
 */
export async function setTencentAcl(config: TencentConfig, acl: string) {
    const cos = createCosClient(config)
    return new Promise<void>((resolve, reject) => {
        cos.putBucketAcl({
            Bucket: config.bucket,
            Region: config.region,
            ACL: acl as COS.BucketACL
        }, (err) => {
            if (err) reject(err)
            else resolve()
        })
    })
}

/**
 * 获取腾讯云 COS 存储桶 CORS 规则
 * @param config 腾讯云配置
 */
export async function getTencentCors(config: TencentConfig): Promise<CorsRule[]> {
    const cos = createCosClient(config)
    return new Promise((resolve, reject) => {
        cos.getBucketCors({
            Bucket: config.bucket,
            Region: config.region,
        }, (err, data) => {
            if (err) {
                if ((err.error && typeof err.error === 'object' && 'Code' in err.error && (err.error as any).Code === 'NoSuchCORSConfiguration') || err.statusCode === 404) {
                    resolve([])
                } else {
                    reject(err)
                }
            } else {
                resolve((data.CORSRules || []).map(parseCorsRule))
            }
        })
    })
}

/**
 * 设置腾讯云 COS 存储桶 CORS 规则
 * @param config 腾讯云配置
 * @param rules CORS 规则列表
 */
export async function setTencentCors(config: TencentConfig, rules: CorsRule[]) {
    const cos = createCosClient(config)
    const cosRules = rules.map(r => ({
        AllowedOrigins: r.allowedOrigins,
        AllowedMethods: r.allowedMethods,
        AllowedHeaders: r.allowedHeaders,
        ExposeHeaders: r.exposeHeaders,
        MaxAgeSeconds: r.maxAgeSeconds
    }))

    return new Promise<void>((resolve, reject) => {
        cos.putBucketCors({
            Bucket: config.bucket,
            Region: config.region,
            CORSRules: cosRules.map(r => ({
                AllowedOrigin: r.AllowedOrigins,
                AllowedMethod: r.AllowedMethods,
                AllowedHeader: r.AllowedHeaders,
                ExposeHeader: r.ExposeHeaders,
                MaxAgeSeconds: r.MaxAgeSeconds
            }))
        }, (err) => {
            if (err) reject(err)
            else resolve()
        })
    })
}

// =================================================================================
// AWS S3 Implementations
// =================================================================================

/**
 * 获取 AWS S3 存储桶 ACL
 * @param config S3 配置
 */
export async function getS3Acl(config: S3Config): Promise<string> {
    const client = createS3Client(config)
    try {
        const command = new GetBucketAclCommand({ Bucket: config.bucket })
        const response = await client.send(command)

        const grants = response.Grants || []
        const publicRead = grants.some(g => 
            isPublicGroup(g.Grantee?.URI) && 
            (g.Permission === 'READ' || g.Permission === 'FULL_CONTROL')
        )
        const publicWrite = grants.some(g => 
            isPublicGroup(g.Grantee?.URI) && 
            (g.Permission === 'WRITE' || g.Permission === 'FULL_CONTROL')
        )
        
        if (publicRead && publicWrite) return 'public-read-write'
        if (publicRead) return 'public-read'
        return 'private'
    } catch (e) {
        throw e
    }
}

/**
 * 设置 AWS S3 存储桶 ACL
 * @param config S3 配置
 * @param acl ACL 类型
 */
export async function setS3Acl(config: S3Config, acl: string) {
    if (acl === 'default') return

    const aclMap: Record<string, BucketCannedACL> = {
        'private': 'private',
        'public-read': 'public-read',
        'public-read-write': 'public-read-write',
        'authenticated-read': 'authenticated-read'
    }

    const cannedAcl = aclMap[acl]
    if (!cannedAcl) {
        throw new Error('Unsupported ACL type for S3')
    }

    const client = createS3Client(config)
    await client.send(new PutBucketAclCommand({
        Bucket: config.bucket,
        ACL: cannedAcl
    }))
}

/**
 * 获取 AWS S3 存储桶 CORS 规则
 * @param config S3 配置
 */
export async function getS3Cors(config: S3Config): Promise<CorsRule[]> {
    const client = createS3Client(config)
    try {
        const command = new GetBucketCorsCommand({ Bucket: config.bucket })
        const response = await client.send(command)
        return (response.CORSRules || []).map(parseCorsRule)
    } catch (e: any) {
        if (e.name === 'NoSuchCORSConfiguration') return []
        throw e
    }
}

/**
 * 设置 AWS S3 存储桶 CORS 规则
 * @param config S3 配置
 * @param rules CORS 规则列表
 */
export async function setS3Cors(config: S3Config, rules: CorsRule[]) {
    const client = createS3Client(config)
    const corsRules = rules.map(r => ({
        AllowedOrigins: r.allowedOrigins,
        AllowedMethods: r.allowedMethods,
        AllowedHeaders: r.allowedHeaders,
        ExposeHeaders: r.exposeHeaders,
        MaxAgeSeconds: r.maxAgeSeconds
    }))

    await client.send(new PutBucketCorsCommand({
        Bucket: config.bucket,
        CORSConfiguration: {
            CORSRules: corsRules
        }
    }))
}
