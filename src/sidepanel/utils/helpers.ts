export function getValueType(value: unknown): 'string' | 'number' | 'boolean' | 'null' | 'array' | 'object' {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value as 'string' | 'number' | 'boolean' | 'object'
}

export function formatJson(data: unknown): string {
  try {
    if (typeof data === 'string') {
      return JSON.stringify(JSON.parse(data), null, 2)
    }
    return JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text)
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function getPayloadSize(data: unknown): number {
  if (!data) return 0
  try {
    const str = typeof data === 'string' ? data : JSON.stringify(data)
    return new Blob([str]).size
  } catch {
    return 0
  }
}
