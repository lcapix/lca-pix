import { describe, it, expect } from 'vitest';
import { convertQuantity, normalizeUnit, compatibleUnits } from '@/lib/units';

describe('normalizeUnit', () => {
  it('canonicalizes spellings and case', () => {
    expect(normalizeUnit('KG')).toBe('kg');
    expect(normalizeUnit('lbs')).toBe('lb');
    expect(normalizeUnit('KWH')).toBe('kWh');
    expect(normalizeUnit('m³')).toBe('m3');
    expect(normalizeUnit(' Tgal ')).toBe('Tgal');
  });

  it('returns null for unknown units — never a guess', () => {
    expect(normalizeUnit('bananas')).toBeNull();
    expect(normalizeUnit('')).toBeNull();
    expect(normalizeUnit(null)).toBeNull();
  });
});

describe('convertQuantity', () => {
  it('THE regression: grams vs kilograms is a 1000× error if unconverted', () => {
    const conv = convertQuantity(850000, 'g', 'kg');
    expect(conv).not.toBeNull();
    expect(conv!.quantity).toBeCloseTo(850, 9);
  });

  it('converts energy family: MMBtu → kWh (EIA heat content)', () => {
    const conv = convertQuantity(3845, 'MMBtu', 'kWh');
    expect(conv!.quantity).toBeCloseTo(3845 * 293.071, 3);
  });

  it('converts MJ → kWh', () => {
    expect(convertQuantity(3.6, 'MJ', 'kWh')!.quantity).toBeCloseTo(1, 9);
  });

  it('converts lb → kg (the SM cross-check factor)', () => {
    expect(convertQuantity(1, 'lb', 'kg')!.quantity).toBeCloseTo(0.45359237, 9);
  });

  it('converts volume: Tgal → m3 and gal → m3', () => {
    expect(convertQuantity(1, 'Tgal', 'm3')!.quantity).toBeCloseTo(3.785411784, 9);
    expect(convertQuantity(1000, 'gal', 'm3')!.quantity).toBeCloseTo(3.785411784, 9);
  });

  it('identity conversion has factor 1', () => {
    const conv = convertQuantity(42, 'kg', 'kg');
    expect(conv!.quantity).toBe(42);
    expect(conv!.factor).toBe(1);
  });

  it('REFUSES cross-family conversion (kg → kWh) — returns null, not identity', () => {
    expect(convertQuantity(10, 'kg', 'kWh')).toBeNull();
  });

  it('REFUSES unknown units', () => {
    expect(convertQuantity(10, 'bananas', 'kg')).toBeNull();
    expect(convertQuantity(10, 'kg', 'bananas')).toBeNull();
  });

  it('records a human-readable note for auditability', () => {
    expect(convertQuantity(1, 'MMBtu', 'kWh')!.note).toContain('MMBtu');
  });
});

describe('compatibleUnits', () => {
  it('offers only same-family units', () => {
    const mass = compatibleUnits('kg');
    expect(mass).toContain('g');
    expect(mass).toContain('lb');
    expect(mass).not.toContain('kWh');
  });

  it('empty for unknown defaults', () => {
    expect(compatibleUnits('bananas')).toEqual([]);
  });
});
