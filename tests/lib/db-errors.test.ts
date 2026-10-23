import { describe, expect, it } from 'vitest';
import { isSchemaGap } from '@/lib/db-errors';

describe('isSchemaGap', () => {
  it('is true only for a missing column or table', () => {
    expect(isSchemaGap(Object.assign(new Error('no column'), { code: 'ER_BAD_FIELD_ERROR' }))).toBe(true);
    expect(isSchemaGap(Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' }))).toBe(true);
  });
  it('is false for every other failure', () => {
    for (const code of ['ECONNRESET', '57P01', 'ETIMEDOUT', '23505', undefined]) {
      expect(isSchemaGap(Object.assign(new Error('x'), { code })), String(code)).toBe(false);
    }
    expect(isSchemaGap(null)).toBe(false);
    expect(isSchemaGap('boom')).toBe(false);
  });
});
