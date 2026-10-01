import { describe, it, expect } from 'vitest';
import {
  TABS,
  apiKeyLabel,
  buildKpis,
  keyStatusDot,
  keyStatusLabel,
  keyedSources,
  logFilterChipClass,
  relAgo,
  sourceActionLabel,
  uiSources,
  type ApiSource,
  type Status,
} from '@/lib/admin/integrations';

const NOW = Date.parse('2026-09-30T12:00:00Z');
const MIN = 60_000;
const H = 60 * MIN;
const D = 24 * H;
const ago = (ms: number) => new Date(NOW - ms).toISOString();

function src(over: Partial<ApiSource> = {}): ApiSource {
  return {
    id: 'x',
    name: 'X',
    description: 'desc',
    keyRequired: false,
    configured: true,
    status: 'success',
    events: 0,
    fails: 0,
    records: 0,
    lastSync: null,
    lastStatus: null,
    rateLimit: null,
    ...over,
  };
}

function status(over: Partial<Status> = {}): Status {
  return {
    substances: { total: 0, enriched: 0 },
    factorsByMethod: [],
    rateCache: [],
    sources: [],
    ...over,
  };
}

const fmt = (n: number) => `#${n}`;

describe('relAgo', () => {
  it('says Never for a missing timestamp', () => {
    expect(relAgo(null, NOW)).toBe('Never');
    expect(relAgo('', NOW)).toBe('Never');
  });

  it('says just now for the future and anything under a minute', () => {
    expect(relAgo(new Date(NOW + 5 * MIN).toISOString(), NOW)).toBe('just now');
    expect(relAgo(ago(0), NOW)).toBe('just now');
    expect(relAgo(ago(59_999), NOW)).toBe('just now');
  });

  it('rounds down to minutes, hours, days and 30-day months', () => {
    expect(relAgo(ago(MIN), NOW)).toBe('1m ago');
    expect(relAgo(ago(59 * MIN + 59_000), NOW)).toBe('59m ago');
    expect(relAgo(ago(H), NOW)).toBe('1h ago');
    expect(relAgo(ago(24 * H - 1), NOW)).toBe('23h ago');
    expect(relAgo(ago(D), NOW)).toBe('1d ago');
    expect(relAgo(ago(29 * D + 23 * H), NOW)).toBe('29d ago');
    expect(relAgo(ago(30 * D), NOW)).toBe('1mo ago');
    expect(relAgo(ago(365 * D), NOW)).toBe('12mo ago');
  });

  it('falls through every bucket for an unparseable timestamp', () => {
    expect(relAgo('not a date', NOW)).toBe('NaNmo ago');
  });

  it('defaults to the current time', () => {
    expect(relAgo(new Date().toISOString())).toBe('just now');
  });
});

describe('uiSources', () => {
  it('is empty without a status or without sources', () => {
    expect(uiSources(null)).toEqual([]);
    expect(uiSources(status({ sources: undefined }))).toEqual([]);
  });

  it('maps each API status to a label, a dot and a last-run string', () => {
    const rows = uiSources(
      status({
        sources: [
          src({ id: 'st', status: 'static', configured: false, staticBacked: true }),
          src({ id: 'nc', status: 'success', configured: false }),
          src({ id: 'idle', status: 'idle' }),
          src({ id: 'ok', status: 'success', lastSync: ago(2 * H) }),
          src({ id: 'warn', status: 'warn', lastSync: ago(3 * D) }),
          src({ id: 'err', status: 'error', lastSync: ago(45 * D) }),
          src({ id: 'ncerr', status: 'error', configured: false }),
        ],
      }),
      NOW,
    );
    expect(rows.map((r) => [r.id, r.statusLabel, r.status, r.lastRun])).toEqual([
      ['st', 'reference data', 'success', 'Static reference'],
      ['nc', 'not configured', 'success', 'Not configured'],
      ['idle', 'never run', 'warn', 'Never'],
      ['ok', 'healthy', 'success', '2h ago'],
      ['warn', 'degraded', 'warn', '3d ago'],
      ['err', 'failing', 'error', '1mo ago'],
      ['ncerr', 'not configured', 'error', 'Not configured'],
    ]);
  });

  it('treats an unknown status as failing with a warn dot', () => {
    const [row] = uiSources(
      status({ sources: [src({ status: 'mystery' as ApiSource['status'] })] }),
      NOW,
    );
    expect(row.statusLabel).toBe('failing');
    expect(row.status).toBe('warn');
  });

  it('copies the identity fields and coerces staticBacked to a boolean', () => {
    const rate = { used: 3, limit: 10 };
    const [a, b] = uiSources(
      status({
        sources: [
          src({ id: 'a', name: 'A', description: 'Da', records: 42, keyRequired: true, rateLimit: rate }),
          src({ id: 'b', staticBacked: true }),
        ],
      }),
      NOW,
    );
    expect(a).toEqual({
      id: 'a',
      name: 'A',
      description: 'Da',
      status: 'success',
      statusLabel: 'healthy',
      lastRun: 'Never',
      records: 42,
      keyRequired: true,
      configured: true,
      staticBacked: false,
      rateLimit: rate,
    });
    expect(b.staticBacked).toBe(true);
  });
});

describe('row labels', () => {
  it('offers Configure until a source is configured', () => {
    expect(sourceActionLabel({ configured: false })).toBe('Configure');
    expect(sourceActionLabel({ configured: true })).toBe('Run now');
  });

  it('describes the API key on a source card', () => {
    expect(apiKeyLabel({ keyRequired: true, configured: true })).toBe('Configured');
    expect(apiKeyLabel({ keyRequired: true, configured: false })).toBe('Missing');
    expect(apiKeyLabel({ keyRequired: false, configured: false })).toBe('Not required');
  });

  it('describes key status on the API Keys tab', () => {
    expect(keyStatusDot({ configured: true })).toBe('success');
    expect(keyStatusDot({ configured: false })).toBe('error');
    expect(keyStatusLabel({ configured: true })).toBe('Configured');
    expect(keyStatusLabel({ configured: false })).toBe('Not configured');
  });
});

describe('keyedSources', () => {
  it('keeps only the sources that need a key, in order', () => {
    const s = status({
      sources: [
        src({ id: 'a', keyRequired: true }),
        src({ id: 'b' }),
        src({ id: 'c', keyRequired: true, configured: false }),
      ],
    });
    expect(keyedSources(s, NOW).map((r) => r.id)).toEqual(['a', 'c']);
    expect(keyedSources(null)).toEqual([]);
  });
});

describe('TABS', () => {
  it('lists the five tabs in strip order', () => {
    expect(TABS.map((t) => [t.id, t.l])).toEqual([
      ['overview', 'Overview'],
      ['sources', 'Data Sources'],
      ['keys', 'API Keys'],
      ['log', 'Activity Log'],
      ['schema', 'Schema'],
    ]);
  });
});

describe('buildKpis', () => {
  it('builds the four cards from a populated status', () => {
    const kpis = buildKpis(
      status({
        substances: { total: 15, enriched: 4 },
        factorsByMethod: [
          { method_name: 'CML 2001', factors: 101 },
          { method_name: 'ReCiPe', factors: 50 },
        ],
        rateCache: [
          { rate_type: 'labor', cnt: 7 },
          { rate_type: 'energy', cnt: '3' as unknown as number },
        ],
        sources: [src({ status: 'success' }), src({ status: 'error' })],
      }),
      fmt,
    );
    expect(kpis).toEqual([
      { l: 'SUBSTANCES', v: '#15', s: '#4 enriched', pct: 27, status: 'success' },
      { l: 'METHODOLOGIES', v: '#2', s: 'CML 2001', status: 'success' },
      { l: 'COST RATES', v: '#10', s: '2 types', status: 'success' },
      { l: 'CONNECTIONS', v: '1 / 2', s: '1 endpoint failing', status: 'warn' },
    ]);
    // Only the substances card carries a bar.
    expect(kpis.map((k) => 'pct' in k)).toEqual([true, false, false, false]);
  });

  it('falls back to empty-state copy and warn dots when nothing is loaded', () => {
    const kpis = buildKpis(status(), fmt);
    expect(kpis).toEqual([
      { l: 'SUBSTANCES', v: '#0', s: 'none loaded', pct: 0, status: 'warn' },
      { l: 'METHODOLOGIES', v: '#0', s: 'no methods imported', status: 'warn' },
      { l: 'COST RATES', v: '#0', s: 'no rates cached', status: 'warn' },
      { l: 'CONNECTIONS', v: '0 / 0', s: 'some idle / unconfigured', status: 'success' },
    ]);
  });

  it('coerces missing counts to 0 and rounds the enriched share', () => {
    const kpis = buildKpis(
      status({
        substances: { total: 3, enriched: null as unknown as number },
        rateCache: [{ rate_type: 'labor', cnt: null as unknown as number }],
      }),
      fmt,
    );
    expect(kpis[0]).toMatchObject({ v: '#3', s: '#0 enriched', pct: 0 });
    // A cached type with no rows still counts as no rates.
    expect(kpis[2]).toMatchObject({ v: '#0', s: 'no rates cached', status: 'warn' });
    expect(buildKpis(status({ substances: { total: 3, enriched: 2 } }), fmt)[0].pct).toBe(67);
  });

  it('pluralises failing endpoints', () => {
    const kpis = buildKpis(
      status({ sources: [src({ status: 'error' }), src({ status: 'error' })] }),
      fmt,
    );
    expect(kpis[3]).toEqual({
      l: 'CONNECTIONS',
      v: '0 / 2',
      s: '2 endpoints failing',
      status: 'warn',
    });
  });

  it('splits live and reference sources when some run on static data', () => {
    const kpis = buildKpis(
      status({
        sources: [
          src({ status: 'success' }),
          // Unconfigured but reporting success still counts as live.
          src({ status: 'success', configured: false }),
          src({ status: 'static' }),
          src({ status: 'idle' }),
        ],
      }),
      fmt,
    );
    expect(kpis[3]).toEqual({
      l: 'CONNECTIONS',
      v: '3 / 4',
      s: '2 live · 1 reference data',
      status: 'success',
    });
  });

  it('says all healthy only when every source is active', () => {
    expect(buildKpis(status({ sources: [src(), src()] }), fmt)[3].s).toBe('all healthy');
    expect(
      buildKpis(status({ sources: [src(), src({ status: 'warn' })] }), fmt)[3].s,
    ).toBe('some idle / unconfigured');
  });

  it('formats counts with the formatter it is given', () => {
    const seen: number[] = [];
    buildKpis(
      status({ substances: { total: 1234, enriched: 5 } }),
      (n) => {
        seen.push(n);
        return String(n);
      },
    );
    expect(seen).toEqual([1234, 5, 0, 0]);
  });
});

describe('logFilterChipClass', () => {
  it('marks the selected chip active and leaves a trailing space otherwise', () => {
    expect(logFilterChipClass('all', 'all')).toBe('chip chip-active');
    expect(logFilterChipClass('all', 'errors')).toBe('chip ');
    expect(logFilterChipClass('errors', 'errors')).toBe('chip chip-active');
  });
});
