// app/admin/integrations/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { AppLayout } from '@/components/app-layout';
import { apiGet } from '@/lib/api-client';
import { StatusCards } from '@/components/integrations/status-cards';
import { ImportButtons } from '@/components/integrations/import-buttons';
import { LogViewer } from '@/components/integrations/log-viewer';

interface Status {
  substances: { total: number; enriched: number };
  factorsByMethod: Array<{ method_name: string; factors: number }>;
  rateCache: Array<{ rate_type: string; cnt: number }>;
}

export default function IntegrationsAdminPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logRefresh, setLogRefresh] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await apiGet<any>('/api/integrations/status');
      setStatus(data);
      setLogRefresh(n => n + 1);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <AuthGuard>
      <AppLayout>
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
            <p className="text-sm text-gray-600 mt-1">
              Import characterization factors, enrich substances, and refresh cost
              rates from public APIs.
            </p>
          </div>

          {loading && <div className="text-gray-500">Loading…</div>}
          {error && <div className="text-red-600">Error: {error}</div>}
          {status && (
            <>
              <StatusCards {...status} />
              <div>
                <h2 className="text-lg font-semibold mb-3">Actions</h2>
                <ImportButtons onRefresh={refresh} />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-3">Recent activity</h2>
                <div className="rounded-lg border bg-white">
                  <LogViewer refreshKey={logRefresh} />
                </div>
              </div>
            </>
          )}
        </div>
      </AppLayout>
    </AuthGuard>
  );
}
