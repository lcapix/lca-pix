// components/integrations/status-cards.tsx
'use client';

interface Props {
  substances: { total: number; enriched: number };
  factorsByMethod: Array<{ method_name: string; factors: number }>;
  rateCache: Array<{ rate_type: string; cnt: number }>;
}

export function StatusCards({ substances, factorsByMethod, rateCache }: Props) {
  const total = Number(substances.total ?? 0);
  const enriched = Number(substances.enriched ?? 0);
  const pct = total ? Math.round((enriched / total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="rounded-lg border bg-white p-4">
        <div className="text-sm text-gray-500">Substances enriched</div>
        <div className="text-2xl font-bold mt-1">
          {enriched}/{total}
          <span className="text-sm text-gray-400 ml-2">({pct}%)</span>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="text-sm text-gray-500">Valuation methods imported</div>
        <div className="mt-1 space-y-1">
          {factorsByMethod.length === 0 && (
            <div className="text-gray-400 text-sm">None yet</div>
          )}
          {factorsByMethod.map(m => (
            <div key={m.method_name} className="text-sm">
              <span className="font-medium">{m.method_name}</span>
              <span className="text-gray-500 ml-2">{Number(m.factors)} factors</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="text-sm text-gray-500">Cost rates cached</div>
        <div className="mt-1 space-y-1">
          {rateCache.length === 0 && (
            <div className="text-gray-400 text-sm">None yet</div>
          )}
          {rateCache.map(r => (
            <div key={r.rate_type} className="text-sm">
              <span className="font-medium">{r.rate_type}</span>
              <span className="text-gray-500 ml-2">{Number(r.cnt)} rows</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
