// Admin → Integrations: the data shapes served by /api/integrations/status
// and the pure derivations the dashboard renders from them (source rows,
// status labels, KPI cards, tab list, log filter chips).
//
// Pure module: no React, no DOM, no fetch.

/** One integration as reported by /api/integrations/status. */
export interface ApiSource {
  id: string;
  name: string;
  description: string;
  keyRequired: boolean;
  configured: boolean;
  staticBacked?: boolean;
  status: 'success' | 'warn' | 'error' | 'idle' | 'static';
  events: number;
  fails: number;
  records: number;
  lastSync: string | null;
  lastStatus: string | null;
  rateLimit: { used: number; limit: number } | null;
}

/** The /api/integrations/status payload. */
export interface Status {
  substances: { total: number; enriched: number };
  factorsByMethod: Array<{ method_name: string; factors: number }>;
  rateCache: Array<{ rate_type: string; cnt: number }>;
  sources?: ApiSource[];
}

/** The three dot colours the dashboard uses. */
export type SourceDot = 'success' | 'warn' | 'error';

// Human-readable "time ago" from an ISO timestamp (real data only).
/**
 * "Never" for a missing timestamp, "just now" under a minute (or in the
 * future), then whole minutes, hours, days and 30-day months, rounded down.
 */
export function relAgo(iso: string | null, now: number = Date.now()): string {
  if (!iso) return 'Never';
  const diffMs = now - new Date(iso).getTime();
  if (diffMs < 0) return 'just now';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// Shape the real /api/integrations/status sources for the table/card UI.
// 'idle' (configured but never synced) collapses to the 'warn' dot.
/** A source row as the overview table, cards and keys table show it. */
export interface UISource {
  id: string;
  name: string;
  description: string;
  status: SourceDot;
  statusLabel: string;
  lastRun: string;
  records: number;
  keyRequired: boolean;
  configured: boolean;
  staticBacked: boolean;
  rateLimit: { used: number; limit: number } | null;
}

/**
 * Map the API sources to UI rows: a status label, a dot colour and a
 * "last run" string. `now` only feeds relAgo (defaults to Date.now()).
 */
export function uiSources(status: Status | null, now?: number): UISource[] {
  return (status?.sources ?? []).map((s) => {
    const label =
      s.status === 'static' ? 'reference data'
      : !s.configured ? 'not configured'
      : s.status === 'idle' ? 'never run'
      : s.status === 'success' ? 'healthy'
      : s.status === 'warn' ? 'degraded'
      : 'failing';
    // 'static' (running on bundled reference data) reads as a healthy dot —
    // the feature works; it just isn't using a live API yet.
    const dot: SourceDot =
      s.status === 'static' || s.status === 'success' ? 'success'
      : s.status === 'error' ? 'error'
      : 'warn';
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      status: dot,
      statusLabel: label,
      lastRun:
        s.status === 'static' ? 'Static reference'
        : !s.configured ? 'Not configured'
        : relAgo(s.lastSync, now),
      records: s.records,
      keyRequired: s.keyRequired,
      configured: s.configured,
      staticBacked: Boolean(s.staticBacked),
      rateLimit: s.rateLimit,
    };
  });
}

/** The overview table's per-row action button label. */
export function sourceActionLabel(src: Pick<UISource, 'configured'>): string {
  return !src.configured ? 'Configure' : 'Run now';
}

/** The "API key" cell on a source card. */
export function apiKeyLabel(src: Pick<UISource, 'keyRequired' | 'configured'>): string {
  return src.keyRequired ? (src.configured ? 'Configured' : 'Missing') : 'Not required';
}

/** Sources that need an API key (the API Keys tab rows). */
export function keyedSources(status: Status | null, now?: number): UISource[] {
  return uiSources(status, now).filter((s) => s.keyRequired);
}

/** The API Keys tab's dot colour for a source's key. */
export function keyStatusDot(src: Pick<UISource, 'configured'>): 'success' | 'error' {
  return src.configured ? 'success' : 'error';
}

/** The API Keys tab's key-status text. */
export function keyStatusLabel(src: Pick<UISource, 'configured'>): string {
  return src.configured ? 'Configured' : 'Not configured';
}

/** The dashboard's tabs. */
export type TabId = 'overview' | 'sources' | 'keys' | 'log' | 'schema';

/** Tab ids with their labels, in strip order. */
export const TABS: ReadonlyArray<{ id: TabId; l: string }> = [
  { id: 'overview', l: 'Overview' },
  { id: 'sources', l: 'Data Sources' },
  { id: 'keys', l: 'API Keys' },
  { id: 'log', l: 'Activity Log' },
  { id: 'schema', l: 'Schema' },
];

/** One overview KPI card: label, value, sub-line, optional bar, dot. */
export interface Kpi {
  l: string;
  v: string;
  s: string;
  pct?: number;
  status: SourceDot;
}

/**
 * The four overview KPI cards (substances, methodologies, cost rates,
 * connections). `fmt` formats integer counts (the page passes fmtInt).
 */
export function buildKpis(status: Status, fmt: (n: number) => string): Kpi[] {
  const substancesTotal = Number(status.substances.total ?? 0);
  const substancesEnriched = Number(status.substances.enriched ?? 0);
  const methodsCount = status.factorsByMethod.length;
  const rateCacheCount = status.rateCache.reduce(
    (sum, r) => sum + Number(r.cnt ?? 0),
    0
  );
  const enrichedPct = substancesTotal
    ? Math.round((substancesEnriched / substancesTotal) * 100)
    : 0;
  const srcList = uiSources(status);
  const failingCount = srcList.filter((i) => i.status === 'error').length;
  const activeCount = srcList.filter((i) => i.status === 'success').length;
  // "live" = backed by a real API call; "reference" = running on bundled static
  // data because no live key is configured. Both are functional.
  const liveCount = (status.sources ?? []).filter((s) => s.status === 'success').length;
  const referenceCount = (status.sources ?? []).filter((s) => s.status === 'static').length;
  const latestMethod = status.factorsByMethod[0]?.method_name ?? '—';

  const kpis: Kpi[] = [
    {
      l: 'SUBSTANCES',
      v: fmt(substancesTotal),
      s: substancesTotal
        ? `${fmt(substancesEnriched)} enriched`
        : 'none loaded',
      pct: enrichedPct,
      status: substancesTotal ? 'success' : 'warn',
    },
    {
      l: 'METHODOLOGIES',
      v: fmt(methodsCount),
      s: methodsCount ? latestMethod : 'no methods imported',
      status: methodsCount ? 'success' : 'warn',
    },
    {
      l: 'COST RATES',
      v: fmt(rateCacheCount),
      s: rateCacheCount
        ? `${status.rateCache.length} types`
        : 'no rates cached',
      status: rateCacheCount ? 'success' : 'warn',
    },
    {
      l: 'CONNECTIONS',
      v: `${activeCount} / ${srcList.length}`,
      s: failingCount
        ? `${failingCount} endpoint${failingCount === 1 ? '' : 's'} failing`
        : referenceCount
        ? `${liveCount} live · ${referenceCount} reference data`
        : srcList.length && activeCount === srcList.length
        ? 'all healthy'
        : 'some idle / unconfigured',
      status: failingCount ? 'warn' : 'success',
    },
  ];
  return kpis;
}

/** The Activity Log tab's filter chips. */
export type LogFilter = 'all' | 'success' | 'errors';

/** className for a log filter chip: "chip chip-active" when selected, "chip " otherwise. */
export function logFilterChipClass(current: LogFilter, chip: LogFilter): string {
  return `chip ${current === chip ? 'chip-active' : ''}`;
}
