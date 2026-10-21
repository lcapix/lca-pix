/**
 * The largest file a browser may send. Vercel refuses request bodies over
 * 4.5 MB before a route runs, so a bigger file used to fail with a bare
 * "Preview failed". The browser now checks first and says why.
 *
 * A self-hosted install has no such platform limit: set
 * NEXT_PUBLIC_MAX_UPLOAD_MB (the server's own cap, MAX_UPLOAD_BYTES in
 * lib/ingest/extract-text.ts, still applies, 12 MB).
 */
export const DEFAULT_UPLOAD_LIMIT_MB = 4.5
/** The server's own cap (lib/ingest/extract-text.ts), so the browser never promises more. */
const SERVER_CAP_BYTES = 12 * 1024 * 1024

/** The configured limit in MB (falls back to 4.5 for a missing or bad value). */
export function uploadLimitMb(configured: string | undefined = process.env.NEXT_PUBLIC_MAX_UPLOAD_MB): number {
  const mb = Number(configured)
  return Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_UPLOAD_LIMIT_MB
}

/** Bytes a file may have: a little under the limit, because the form around it takes a few hundred bytes. */
export function uploadLimitBytes(configured?: string): number {
  return Math.min(Math.floor(uploadLimitMb(configured) * 1_000_000) - 1_000, SERVER_CAP_BYTES)
}

export function formatMegabytes(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`
}

/** Why `file` cannot be sent, or null when it fits. */
export function uploadTooLargeMessage(file: { name: string; size: number }, configured?: string): string | null {
  if (file.size <= uploadLimitBytes(configured)) return null
  return `${file.name} is ${formatMegabytes(file.size)}. Files up to ${uploadLimitMb(configured)} MB can be read here. Save a smaller copy, for example one sheet or only the pages you need, and try again.`
}
