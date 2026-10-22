import { describe, expect, it } from 'vitest'
import { acceptsFile, fileSizeText, minutesText, readFailureKind } from '@/lib/import/file-rules'

describe('Add a file rules (F2.2, F2.2b)', () => {
  it('sizes in the screen\'s words', () => {
    expect(fileSizeText(220 * 1024)).toBe('220 KB')
    expect(fileSizeText(900)).toBe('900 bytes')
    expect(fileSizeText(4.6 * 1024 * 1024)).toBe('4.6 MB')
  })
  it('a file type the kind of document accepts, by extension, any case', () => {
    expect(acceptsFile('enclosure-routing.PDF', '.pdf,.txt,.html')).toBe(true)
    expect(acceptsFile('notes.docx', '.pdf,.txt,.html')).toBe(false)
    expect(acceptsFile('bom.xlsx', undefined)).toBe(true)
  })
  it('a failed read: scanned, the hourly limit, a type, a size, or something else', () => {
    expect(readFailureKind(422, 'Could not extract readable text (a scanned PDF may need OCR).')).toBe('scanned')
    expect(readFailureKind(429, 'Too many requests')).toBe('limit')
    expect(readFailureKind(415, "Unsupported file type '.docx'")).toBe('type')
    expect(readFailureKind(413, null)).toBe('size')
    expect(readFailureKind(422, 'Could not read text from scan.pdf (Invalid PDF structure.).')).toBe('unreadable')
    expect(readFailureKind(500, 'boom')).toBe('other')
    expect(minutesText(1080)).toBe('18 minutes')
    expect(minutesText(30)).toBe('1 minute')
  })
})
