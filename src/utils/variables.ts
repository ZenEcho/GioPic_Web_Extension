import { v4 as uuidv4 } from 'uuid'

export function replaceMagicVariables(template: string, file: File): string {
    if (!template) return template
    
    const now = new Date()
    const filename = file.name
    const ext = filename.lastIndexOf('.') > -1 ? filename.slice(filename.lastIndexOf('.')) : ''
    const name = filename.lastIndexOf('.') > -1 ? filename.slice(0, filename.lastIndexOf('.')) : filename
    
    // YYYY, MM, DD
    const year = now.getFullYear().toString()
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const day = now.getDate().toString().padStart(2, '0')
    const timestamp = now.getTime().toString()
    
    // Random string (simple implementation)
    const random = Math.random().toString(36).substring(2, 10)
    const uuid = uuidv4()

    return template
        .replace(/{filename}/g, filename)
        .replace(/{name}/g, name)
        .replace(/{ext}/g, ext)
        .replace(/{year}/g, year)
        .replace(/{month}/g, month)
        .replace(/{day}/g, day)
        .replace(/{timestamp}/g, timestamp)
        .replace(/{random}/g, random)
        .replace(/{uuid}/g, uuid)
}

export function replaceVariablesInConfig(config: Record<string, string>, file: File): Record<string, string> {
    const newConfig: Record<string, string> = {}
    for (const [key, value] of Object.entries(config)) {
        newConfig[key] = replaceMagicVariables(value, file)
    }
    return newConfig
}
