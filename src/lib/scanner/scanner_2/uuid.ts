export function uuidv4(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `scan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
