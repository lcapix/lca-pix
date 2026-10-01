import { describe, expect, it } from 'vitest';
import { COLUMN_LIMITS, decimalMax, fitToColumn, lengthError, firstLengthError } from '@/lib/field-limits';

describe('lengthError', () => {
  const name = COLUMN_LIMITS.project.project_name; // VARCHAR(100)
  const text = COLUMN_LIMITS.project.description; // TEXT

  it('accepts a value at the limit and refuses one past it, naming the field', () => {
    expect(lengthError('Project name', 'x'.repeat(100), name)).toBeNull();
    expect(lengthError('Project name', 'x'.repeat(101), name)).toBe('Project name must be at most 100 characters');
  });

  it('counts characters as MySQL does (code points), so an emoji is one', () => {
    expect(lengthError('Project name', '😀'.repeat(100), name)).toBeNull();
    expect(lengthError('Project name', '😀'.repeat(101), name)).not.toBeNull();
  });

  it('measures TEXT columns in UTF-8 bytes', () => {
    expect(lengthError('Description', 'x'.repeat(65_535), text)).toBeNull();
    expect(lengthError('Description', 'x'.repeat(65_536), text)).toBe('Description is too long (at most 65535 bytes)');
    // 20,000 three-byte characters are 60,000 bytes: fits. 22,000 do not.
    expect(lengthError('Description', 'é€'.repeat(10_000), text)).toBeNull();
    expect(lengthError('Description', '€'.repeat(22_000), text)).not.toBeNull();
  });

  it('ignores values that are not written as text (absent, null, objects)', () => {
    expect(lengthError('Project name', undefined, name)).toBeNull();
    expect(lengthError('Project name', null, name)).toBeNull();
    expect(lengthError('Project name', 12345, name)).toBeNull();
  });

  it('firstLengthError returns the first failing field only', () => {
    expect(
      firstLengthError([
        ['Project name', 'ok', name],
        ['Description', 'x'.repeat(70_000), text],
        ['Project name', 'x'.repeat(500), name],
      ]),
    ).toBe('Description is too long (at most 65535 bytes)');
    expect(firstLengthError([['Project name', 'ok', name]])).toBeNull();
  });
});

describe('decimalMax', () => {
  it('is the largest value DECIMAL(p, s) holds', () => {
    expect(decimalMax(COLUMN_LIMITS.component.labor_cost)).toBe(9_999_999_999_999.99);
    expect(decimalMax(COLUMN_LIMITS.component.quantity)).toBe(999_999_999.999999);
    expect(decimalMax(COLUMN_LIMITS.component.labor_hours)).toBe(999_999.9999);
  });
});

describe('fitToColumn (text the server composes)', () => {
  it('leaves a value that fits alone and cuts one that does not, by characters', () => {
    expect(fitToColumn('short', { kind: 'chars', max: 10 })).toBe('short');
    expect(fitToColumn('😀'.repeat(12), { kind: 'chars', max: 10 })).toBe('😀'.repeat(10));
  });

  it('cuts TEXT by bytes without splitting a character', () => {
    const cut = fitToColumn('€'.repeat(30_000), COLUMN_LIMITS.case_table.description);
    expect(new TextEncoder().encode(cut).length).toBeLessThanOrEqual(65_535);
    expect(cut).toBe('€'.repeat(21_845));
  });
});

describe('nonNegative (lib/component-fields.ts)', () => {
  it('accepts 0 up to the column maximum and refuses more, naming the column', async () => {
    const { nonNegative, BadRequest } = await import('@/lib/component-fields');
    expect(nonNegative('labor_cost', 9_999_999_999_999.99)).toBe(9_999_999_999_999.99);
    expect(nonNegative('quantity', '0')).toBe(0);
    expect(nonNegative('quantity', '')).toBeNull();
    expect(() => nonNegative('labor_cost', 1e20)).toThrow(BadRequest);
    expect(() => nonNegative('labor_cost', 1e20)).toThrow('labor_cost must be at most 9999999999999.99');
    expect(() => nonNegative('quantity', 1e9)).toThrow('quantity must be at most 999999999.999999');
    expect(() => nonNegative('labor_hours', 1_000_000)).toThrow('labor_hours must be at most 999999.9999');
    expect(() => nonNegative('opex', Infinity)).toThrow('opex must be a number of 0 or more');
  });
});

describe('isOutOfRangeError', () => {
  it('recognises MySQL out-of-range errors only', async () => {
    const { isOutOfRangeError } = await import('@/lib/field-limits');
    expect(isOutOfRangeError({ code: 'ER_WARN_DATA_OUT_OF_RANGE', errno: 1264 })).toBe(true);
    expect(isOutOfRangeError({ code: 'ER_DATA_OUT_OF_RANGE', errno: 1690 })).toBe(true);
    expect(isOutOfRangeError({ code: 'ER_LOCK_DEADLOCK', errno: 1213 })).toBe(false);
    expect(isOutOfRangeError(null)).toBe(false);
  });
});
