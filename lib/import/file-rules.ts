/**
 * Small rules for the Add a file step (F2.2, F2.2b): the file's size in the
 * words the screen uses, whether a chosen file's type is one this kind of
 * document accepts, and which way a failed read went, so the screen can offer
 * the right ways forward. Pure, so each is tested.
 */

/** "220 KB", "1.4 MB", "900 bytes". */
export function fileSizeText(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1024) return `${bytes} bytes`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Whether `name` ends in one of the extensions of an `accept` string (".xlsx,.csv"). */
export function acceptsFile(name: string, accept: string | undefined): boolean {
  if (!accept) return true
  const ext = `.${name.split('.').pop()?.toLowerCase() ?? ''}`
  return accept
    .split(',')
    .map((a) => a.trim().toLowerCase())
    .filter((a) => a.startsWith('.'))
    .includes(ext)
}

export type ReadFailure = 'scanned' | 'unreadable' | 'limit' | 'type' | 'size' | 'other'

/** Which way a failed read went, from the preview route's status and words. */
export function readFailureKind(status: number, message: string | null | undefined): ReadFailure {
  if (status === 429) return 'limit'
  if (status === 413) return 'size'
  if (status === 415 || /unsupported file type/i.test(message ?? '')) return 'type'
  if (/scanned|readable text|no text/i.test(message ?? '')) return 'scanned'
  // A damaged or odd file: there was text to look for, but it could not be read.
  if (/could not read text|invalid pdf|corrupt|damaged/i.test(message ?? '')) return 'unreadable'
  return 'other'
}

/** "18 minutes", "1 minute": the wait a read limit gives, rounded up. */
export function minutesText(seconds: number | null | undefined): string {
  const m = Math.max(1, Math.ceil(Number(seconds ?? 60) / 60))
  return `${m} ${m === 1 ? 'minute' : 'minutes'}`
}
