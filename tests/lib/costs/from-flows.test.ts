import { describe, expect, it } from 'vitest';
import { costsFromFlows, differsFromStored, type FlowForCost } from '@/lib/costs/from-flows';

const f = (substance: string, quantity: number | null, unit: string, direction: 'input' | 'output' = 'input'): FlowForCost => ({ substance, quantity, unit, direction });

describe("a step's cost from its flows", () => {
  it('prices materials in kg by name, energy in its own unit, and leaves out outputs', () => {
    const { material, energy } = costsFromFlows([
      f('Steel', 0.8, 'kg'),
      f('Aluminum', 500, 'g'),
      f('Electricity', 0.05, 'kWh'),
      f('Scrap steel', 0.12, 'kg', 'output'),
    ]);
    expect(material.lines.map((l) => [l.label, l.quantity, l.rate])).toEqual([['Steel', 0.8, 0.95], ['Aluminum', 0.5, 2.1]]);
    expect(material.amount).toBeCloseTo(0.8 * 0.95 + 0.5 * 2.1, 6);
    expect(material.lines[0]).toMatchObject({ unit: 'kg', rate_unit: '$/kg', source_kind: 'reference', source_name: 'Steel, hot-rolled' });
    expect(energy.lines).toHaveLength(1);
    // The same industrial reference the Cost view's lookup and the sample use, not the all-sector table.
    expect(energy.lines[0]).toMatchObject({
      label: 'Electricity', quantity: 0.05, unit: 'kWh', rate: 0.0862, rate_unit: '$/kWh',
      source_name: 'Electricity, industrial US avg 2025 (EIA)',
    });
    expect(energy.amount).toBeCloseTo(0.05 * 0.0862, 6);
    expect(material.noPrice).toEqual([]);
  });

  it('electricity in any unit kWh converts from gets the one reference price', () => {
    const { energy } = costsFromFlows([f('Electricity', 0.002, 'MWh')]);
    expect(energy.lines[0].rate).toBeCloseTo(86.2, 6);
    expect(energy.amount).toBeCloseTo(0.1724, 6);
  });

  it('never guesses a price: an unpriced material or a count is named, not costed', () => {
    const { material } = costsFromFlows([f('Argon', 0.02, 'kg'), f('Argon', 0.01, 'kg'), f('Steel', 3, 'ea'), f('Powder coating', 0.03, 'kg')]);
    expect(material.amount).toBeNull();
    expect(material.lines).toEqual([]);
    expect(material.noPrice).toEqual(['Argon', 'Steel (in ea)', 'Powder coating']);
  });

  it('skips a flow with no amount yet (the step already says it needs one)', () => {
    expect(costsFromFlows([f('Steel', null, 'kg')]).material).toEqual({ kind: 'material', amount: null, lines: [], noPrice: [] });
  });

  it('offers the number only when it differs from what is stored by a cent or more', () => {
    expect(differsFromStored(0.76, 0.76)).toBe(false);
    expect(differsFromStored(0.76, 0.7612)).toBe(false);
    expect(differsFromStored(0.76, 1.14)).toBe(true);
    expect(differsFromStored(null, 0.5)).toBe(true);
    // 0.05 kWh of electricity is under half a cent: nothing worth storing.
    expect(differsFromStored(null, 0.00431)).toBe(false);
    expect(differsFromStored(0.5, null)).toBe(false);
  });
});
