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

describe('E8 unit aliases', () => {
  it('short ton is 907.18474 kg, under unambiguous spellings only', () => {
    for (const u of ['short ton', 'short tons', 'Short Ton', 'st']) {
      expect(normalizeUnit(u)).toBe('short ton');
      expect(convertQuantity(1, u, 'kg')!.quantity).toBeCloseTo(907.18474, 9);
    }
    // WARM's MTCO2E/short ton → kg/kg conversion used in migrate-016/025
    expect(convertQuantity(1, 'kg', 'short ton')!.quantity * 1000).toBeCloseTo(1.102311, 6);
  });

  it("leaves bare 'ton'/'tons' unmapped: the legacy flow editor stores 'ton' meaning a METRIC ton", () => {
    expect(normalizeUnit('ton')).toBeNull();
    expect(normalizeUnit('tons')).toBeNull();
    expect(convertQuantity(1, 'ton', 'kg')).toBeNull();
  });

  it.each(['tonne-km', 't-km', 't*km', 't·km', 'tkm', 'TKM', 'tonne*km'])(
    '%s is tonne-kilometres',
    (u) => {
      expect(normalizeUnit(u)).toBe('tkm');
      expect(convertQuantity(382.5, u, 'tkm')!.quantity).toBeCloseTo(382.5, 9);
    },
  );

  it('kg*km is 0.001 tkm', () => {
    expect(normalizeUnit('kg*km')).toBe('kg*km');
    expect(convertQuantity(850 * 450, 'kg*km', 'tkm')!.quantity).toBeCloseTo(382.5, 9);
  });

  it.each(['ea', 'each', 'item', 'items', 'unit', 'units', 'pcs', 'piece', 'pieces'])(
    '%s is a count',
    (u) => {
      expect(normalizeUnit(u)).toBe('units');
      expect(convertQuantity(3, u, 'units')!.quantity).toBe(3);
      expect(convertQuantity(3, u, 'kg')).toBeNull();
    },
  );

  it('natural-gas volumes in cubic feet convert to m3 (1 ft3 = 0.028316846592 m3)', () => {
    expect(convertQuantity(1, 'scf', 'm3')!.quantity).toBeCloseTo(0.028316846592, 12);
    expect(convertQuantity(1, 'ccf', 'm3')!.quantity).toBeCloseTo(2.8316846592, 10);
    expect(convertQuantity(1, 'Mscf', 'm3')!.quantity).toBeCloseTo(28.316846592, 9);
    expect(convertQuantity(1, 'MMscf', 'm3')!.quantity).toBeCloseTo(28316.846592, 6);
    expect(convertQuantity(1, 'Mcf', 'm3')!.quantity).toBeCloseTo(28.316846592, 9);
    expect(convertQuantity(1, 'ft3', 'm3')!.quantity).toBeCloseTo(0.028316846592, 12);
  });

  it('m^3 is m3', () => {
    expect(normalizeUnit('m^3')).toBe('m3');
    expect(convertQuantity(2, 'm^3', 'L')!.quantity).toBeCloseTo(2000, 9);
  });

  it('collapses inner whitespace before lookup', () => {
    expect(normalizeUnit('  short   ton ')).toBe('short ton');
  });
});
