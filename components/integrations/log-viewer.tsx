// components/integrations/log-viewer.tsx
'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api-client';

interface LogRow {
  log_id: number;
  source: string;
  action: string;
  records_affected: number;
  status: 'success' | 'partial' | 'failed';
  executed_at: string;
  details: any;
}

const STATUS_COLORS: Record<string, string> = {
  success: 'bg-green-100 text-green-800',
  partial: 'bg-yellow-100 text-yellow-800',
  failed: 'bg-red-100 text-red-800',
};

export function LogViewer({ refreshKey = 0 }: { refreshKey?: number }) {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await apiGet<any>('/api/integrations/log?limit=30');
        setLogs(data.logs ?? []);
      } finally { setLoading(false); }
    })();
  }, [refreshKey]);

  if (loading) return <div className="p-3 text-gray-500 text-sm">Loading logs…</div>;
  if (!logs.length) return <div className="p-3 text-gray-500 text-sm">No integration runs yet.</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-gray-500 text-xs uppercase bg-gray-50 border-b">
          <tr>
            <th className="text-left p-2">When</th>
            <th className="text-left p-2">Source</th>
            <th className="text-left p-2">Action</th>
            <th className="text-right p-2">Records</th>
            <th className="text-left p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(l => (
            <tr key={l.log_id} className="border-b last:border-0">
              <td className="p-2 text-gray-500 whitespace-nowrap">
                {new Date(l.executed_at).toLocaleString()}
              </td>
              <td className="p-2 font-medium">{l.source}</td>
              <td className="p-2">{l.action}</td>
              <td className="p-2 text-right">{l.records_affected}</td>
              <td className="p-2">
                <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[l.status] ?? 'bg-gray-100'}`}>
                  {l.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
