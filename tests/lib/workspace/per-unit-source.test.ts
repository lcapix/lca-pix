import { describe, expect, it } from 'vitest';
import { perUnit } from '@/lib/workspace/per-unit';
import { splitSource } from '@/lib/workspace/step-text';

describe('what an answer is per', () => {
  it("the case's own unit first, then the functional unit, then unit", () => {
    expect(perUnit({ reference_flow_unit: 'bracket', project_functional_unit: '1 painted steel bracket' })).toBe('bracket');
    expect(perUnit({ reference_flow_unit: null, project_functional_unit: '1 enclosure' })).toBe('enclosure');
    expect(perUnit({ reference_flow_unit: '', project_functional_unit: '2 mugs' })).toBe('2 mugs');
    expect(perUnit({ reference_flow_unit: null, project_functional_unit: null })).toBe('unit');
    expect(perUnit({ reference_flow_unit: null, project_functional_unit: '1 enclosure' }, '1 bike frame')).toBe('bike frame');
  });
});

describe("an imported step's description", () => {
  it('reads without the source an import appends, and keeps the source apart', () => {
    expect(splitSource('The product, as the routing r.csv gives it. [source: r.csv · Routing r.csv]')).toEqual({
      text: 'The product, as the routing r.csv gives it.',
      source: 'r.csv · Routing r.csv',
    });
    expect(splitSource(' [source: bom.csv · row 4]')).toEqual({ text: null, source: 'bom.csv · row 4' });
    expect(splitSource('Shears, welder')).toEqual({ text: 'Shears, welder', source: null });
    expect(splitSource(null)).toEqual({ text: null, source: null });
  });
});
