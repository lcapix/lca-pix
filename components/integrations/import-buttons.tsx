// components/integrations/import-buttons.tsx
'use client';

import { useState } from 'react';
import { apiPost } from '@/lib/api-client';

export function ImportButtons({ onRefresh }: { onRefresh: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label); setResult(null);
    try {
      const data = await fn();
      setResult(`${label}: ${JSON.stringify(data).slice(0, 400)}`);
      onRefresh();
    } catch (e: any) {
      setResult(`${label} FAILED: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <button
          disabled={!!busy}
          onClick={() => run('Import CML 2001',
            () => apiPost('/api/integrations/openlca/import', { method: 'CML 2001' }))}
          className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-50 hover:bg-emerald-700"
        >
          {busy === 'Import CML 2001' ? 'Importing…' : 'Import openLCA CML 2001'}
        </button>

        <button
          disabled={!!busy}
          onClick={() => run('Enrich substances',
            () => apiPost('/api/integrations/pubchem/enrich', { only_missing: true }))}
          className="px-4 py-2 rounded bg-sky-600 text-white disabled:opacity-50 hover:bg-sky-700"
        >
          {busy === 'Enrich substances' ? 'Enriching…' : 'Enrich substances from PubChem'}
        </button>
      </div>

      {result && (
        <pre className="text-xs bg-gray-50 border rounded p-3 whitespace-pre-wrap max-h-60 overflow-auto">
          {result}
        </pre>
      )}
    </div>
  );
}
