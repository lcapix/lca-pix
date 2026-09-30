import { describe, it, expect } from 'vitest';
import {
  convertQuantity,
  normalizeUnit,
  compatibleUnits,
  sameUnit,
  splitFactorUnit,
  toFactorBasis,
  unitProblem,
} from '@/lib/units';

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

describe('splitFactorUnit', () => {
  it('splits a per-unit factor label into numerator and denominator', () => {
    expect(splitFactorUnit('kg CO2 eq / MMBtu')).toEqual({ numerator: 'kg CO2 eq', denominator: 'MMBtu' });
    expect(splitFactorUnit('kg Sb eq/kWh')).toEqual({ numerator: 'kg Sb eq', denominator: 'kWh' });
  });
  it('has no denominator when the label is a bare reference unit', () => {
    expect(splitFactorUnit('kg CO2 eq')).toEqual({ numerator: 'kg CO2 eq', denominator: null });
    expect(splitFactorUnit('CTUeco')).toEqual({ numerator: 'CTUeco', denominator: null });
    expect(splitFactorUnit(null)).toEqual({ numerator: '', denominator: null });
    expect(splitFactorUnit('kg CO2 eq / ')).toEqual({ numerator: 'kg CO2 eq', denominator: null });
  });
});

describe('toFactorBasis (E3 + E11: never a raw multiply)', () => {
  it("identical units are used as-is even when the unit table does not know them ('p'/'p')", () => {
    const r = toFactorBasis(4, 'p', 'p', 'kg CO2 eq');
    expect(r).toEqual({ ok: true, quantity: 4, basisUnit: 'p' });
  });

  it('identical is case- and space-insensitive', () => {
    const r = toFactorBasis(4, ' Pallet', 'pallet ', 'kg CO2 eq');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.quantity).toBe(4);
  });

  it("but a flipped m/M is a flipped magnitude, never 'the same unit' ('Mt' vs 'mt', 'MMscfd' vs 'mmscfd')", () => {
    expect(toFactorBasis(4, 'Mt', 'mt', 'kg CO2 eq').ok).toBe(false);
    expect(toFactorBasis(4, 'MMscfd', 'mmscfd', 'kg CO2 eq').ok).toBe(false);
  });

  it("1000 kg against an 'item' substance is refused (the E3 reproduction: was 3000 with no warning)", () => {
    const r = toFactorBasis(1000, 'kg', 'item', 'kg CO2 eq');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/'kg'.*'item'/);
  });

  it('a recognized flow unit against an unrecognized, different substance unit is refused', () => {
    const r = toFactorBasis(1000, 'kg', 'bundle', 'kg CO2 eq');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("'bundle'");
  });

  it('an unrecognized flow unit is refused and named', () => {
    const r = toFactorBasis(999, 'bananas', 'kWh', 'kg CO2 eq / kWh');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("unrecognized unit 'bananas'");
  });

  it('a flow with no unit is refused, not assumed', () => {
    for (const u of [null, '', '  ']) {
      const r = toFactorBasis(5, u, 'kg', 'kg CO2 eq');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toMatch(/no unit/);
    }
  });

  it('converts within a family and records the conversion', () => {
    const r = toFactorBasis(850000, 'g', 'kg', 'kg CO2 eq');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.quantity).toBeCloseTo(850, 9);
      expect(r.basisUnit).toBe('kg');
      expect(r.note).toContain('kg');
    }
  });

  it('spelling variants of one unit need no conversion note', () => {
    const r = toFactorBasis(3, 'kilogram', 'kg', 'kg CO2 eq');
    expect(r).toEqual({ ok: true, quantity: 3, basisUnit: 'kg' });
  });

  it('E11: a factor denominator in the substance family is honoured (kWh flow → per-MMBtu factor)', () => {
    const r = toFactorBasis(293.071, 'kWh', 'MMBtu', 'kg CO2 eq / MMBtu');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.quantity).toBeCloseTo(1, 9);
      expect(r.basisUnit).toBe('MMBtu');
    }
  });

  it('E11: a factor stated per tonne on a kg substance converts to the tonne', () => {
    const r = toFactorBasis(500, 'kg', 'kg', 'kg CO2 eq / t');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.quantity).toBeCloseTo(0.5, 12);
      expect(r.basisUnit).toBe('t');
    }
  });

  it('E11: a factor stated per kg on an m3 substance is refused (Water/Wastewater rows)', () => {
    const r = toFactorBasis(10, 'm3', 'm3', 'kg CO2 eq / kg');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/per 'kg'.*'m3'/);
  });

  it('E11: a per-kg factor on an MMBtu fuel is refused whatever the flow unit (the Wood clobber)', () => {
    expect(toFactorBasis(1, 'MMBtu', 'MMBtu', 'kg CO2 eq / kg').ok).toBe(false);
    expect(toFactorBasis(1, 'kg', 'MMBtu', 'kg CO2 eq / kg').ok).toBe(false);
  });

  it('E11: an unknown denominator must equal the substance unit to be used', () => {
    expect(toFactorBasis(2, 'p', 'p', 'kg CO2 eq / p')).toEqual({ ok: true, quantity: 2, basisUnit: 'p' });
    expect(toFactorBasis(2, 'kg', 'kg', 'kg CO2 eq / p').ok).toBe(false);
  });

  it('with no substance unit the factor denominator is the basis; with neither, refused', () => {
    const r = toFactorBasis(2, 'kWh', null, 'kg CO2 eq / kWh');
    expect(r).toEqual({ ok: true, quantity: 2, basisUnit: 'kWh' });
    expect(toFactorBasis(2, 'kWh', null, 'kg CO2 eq').ok).toBe(false);
  });
});

describe('one normalisation for every spelling (parser-differential review)', () => {
  it('Unicode and operator variants normalise to one key', () => {
    for (const u of ['m³', 'm^3', 'M3', 'ｍ３', ' m 3 '.replace(/ /g, '')]) expect(normalizeUnit(u)).toBe('m3');
    for (const u of ['t·km', 't⋅km', 't∙km', 't×km', 't * km', 'tonne - km', 'ｔｋｍ']) expect(normalizeUnit(u)).toBe('tkm');
    for (const u of ['kg·km', 'kg⋅km', 'kg × km']) expect(normalizeUnit(u)).toBe('kg*km');
    expect(normalizeUnit('ft²')).toBe('ft2');
    expect(normalizeUnit('ft³')).toBe('ft3');
    expect(normalizeUnit('ｋｇ')).toBe('kg');
    expect(normalizeUnit('kg\u00a0')).toBe('kg');
    expect(normalizeUnit('short\u00a0ton')).toBe('short ton');
  });

  it('the case of an SI m/M prefix is significant: mg/Mg, mL/ML, MWh/mWh, MJ/mJ', () => {
    expect(normalizeUnit('mg')).toBe('mg');
    expect(normalizeUnit('Mg')).toBeNull(); // megagram (= t) or milligram: 10^9 apart
    expect(normalizeUnit('MG')).toBeNull();
    expect(normalizeUnit('mL')).toBe('mL');
    expect(normalizeUnit('ml')).toBe('mL');
    expect(normalizeUnit('ML')).toBeNull(); // megalitre or millilitre
    expect(normalizeUnit('MWh')).toBe('MWh');
    expect(normalizeUnit('MWH')).toBe('MWh');
    expect(normalizeUnit('mwh')).toBeNull(); // literally milliwatt-hour
    expect(normalizeUnit('MJ')).toBe('MJ');
    expect(normalizeUnit('mj')).toBeNull();
    expect(convertQuantity(1, 'ML', 'L')).toBeNull();
    expect(convertQuantity(1, 'Mg', 'kg')).toBeNull();
  });

  it('ambiguous spellings say why', () => {
    expect(unitProblem('ton')).toMatch(/short ton or a metric ton/);
    expect(unitProblem('Mg')).toMatch(/megagram|milli/);
    expect(unitProblem('ML')).toMatch(/megalit|milli/);
    expect(unitProblem('kg')).toBeNull();
    expect(unitProblem('bananas')).toMatch(/unrecognized/);
  });

  it('sameUnit: identical strings are always the same unit, whatever they mean', () => {
    expect(sameUnit('Mg', 'Mg')).toBe(true);
    expect(sameUnit('p', 'P')).toBe(true);
    expect(sameUnit('ML', 'ml')).toBe(false);
    expect(sameUnit('Mt', 'mt')).toBe(false);
    expect(sameUnit('', '')).toBe(false);
  });

  it('convertQuantity is the identity for identical unknown units, so the API validator accepts what the engine accepts', () => {
    expect(convertQuantity(4, 'p', 'p')).toMatchObject({ quantity: 4, factor: 1 });
    expect(convertQuantity(4, 'Mg', 'Mg')).toMatchObject({ quantity: 4, factor: 1 });
    expect(convertQuantity(4, 'p', 'kg')).toBeNull();
  });

  it('every canonical spelling the unit table produces is itself accepted and maps to itself', () => {
    const canon = new Set<string>();
    for (const fam of ['kg', 'kWh', 'm3', 'tkm', 'h', 'm2', 'units']) for (const c of compatibleUnits(fam)) canon.add(c);
    expect(canon.size).toBeGreaterThan(30);
    for (const c of canon) expect(normalizeUnit(c)).toBe(c);
  });
});
