import { describe, expect, it } from 'vitest'

import { uploadLimitBytes, uploadLimitMb, uploadTooLargeMessage } from '@/lib/upload-limits'

describe('the browser upload limit', () => {
  it('defaults to 4.5 MB, a little under so the form around the file fits', () => {
    expect(uploadLimitMb(undefined)).toBe(4.5)
    expect(uploadLimitBytes(undefined)).toBe(4_499_000)
  })

  it('takes a configured limit for a self-hosted install, never above the server cap', () => {
    expect(uploadLimitMb('10')).toBe(10)
    expect(uploadLimitBytes('10')).toBe(9_999_000)
    expect(uploadLimitBytes('50')).toBe(12 * 1024 * 1024)
    for (const bad of ['', 'abc', '-2', '0']) expect(uploadLimitMb(bad)).toBe(4.5)
  })

  it('lets a file under the limit through and explains one over it', () => {
    expect(uploadTooLargeMessage({ name: 'routing.csv', size: 220_000 }, undefined)).toBeNull()
    expect(uploadTooLargeMessage({ name: 'edge.xlsx', size: 4_499_000 }, undefined)).toBeNull()
    expect(uploadTooLargeMessage({ name: 'big.pdf', size: 6_200_000 }, undefined)).toBe(
      'big.pdf is 6.2 MB. Files up to 4.5 MB can be read here. Save a smaller copy, for example one sheet or only the pages you need, and try again.',
    )
  })
})
