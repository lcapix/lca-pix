'use client';

import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { apiGet, apiPost } from '@/lib/api-client';

const REGIONS = [
  { code: 'Global', label: 'Global average' },
  { code: 'US-NY', label: 'United States — New York' },
  { code: 'US-CA', label: 'United States — California' },
  { code: 'US-TX', label: 'United States — Texas' },
  { code: 'FR',    label: 'France' },
  { code: 'DE',    label: 'Germany' },
  { code: 'GB',    label: 'United Kingdom' },
  { code: 'CN',    label: 'China' },
  { code: 'IN',    label: 'India' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  caseId: number;
  onCompleted?: (result: any) => void;
}

export function RunAssessmentModal({ open, onClose, caseId, onCompleted }: Props) {
  const [method, setMethod] = useState('CML 2001');
  const [region, setRegion] = useState('Global');
  const [methods, setMethods] = useState<string[]>(['CML 2001']);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const data = await apiGet<any>('/api/integrations/status');
        const imported: string[] = (data?.factorsByMethod ?? [])
          .map((m: any) => m.method_name)
          .filter(Boolean);
        if (imported.length) setMethods(imported);
      } catch {
        // fall through — keep default 'CML 2001'
      }
    })();
  }, [open]);

  const run = async () => {
    setRunning(true); setError(null);
    try {
      const result = await apiPost<any>(
        `/api/cases/${caseId}/assessments`,
        {
          run_name: `Assessment ${new Date().toLocaleString()}`,
          calculation_method: method,
          region_code: region,
        },
      );
      onCompleted?.(result);
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Failed to run assessment');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Run Assessment</DialogTitle>
          <DialogDescription>
            Choose the valuation method and region for this calculation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-[0.12em] text-on-surface-variant mb-1.5">
              Valuation method
            </label>
            <select
              value={method}
              onChange={e => setMethod(e.target.value)}
              className="w-full rounded-lg bg-surface-container-low px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {methods.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <p className="text-xs text-on-surface-variant mt-1">
              Only methods imported into your database are shown.
            </p>
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-[0.12em] text-on-surface-variant mb-1.5">
              Region
            </label>
            <select
              value={region}
              onChange={e => setRegion(e.target.value)}
              className="w-full rounded-lg bg-surface-container-low px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {REGIONS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
            </select>
            <p className="text-xs text-on-surface-variant mt-1">
              Location-specific factors are used when available (e.g. electricity grid carbon).
              Global fallback is used otherwise.
            </p>
          </div>

          {error && <div className="text-sm text-error">{error}</div>}
        </div>

        <DialogFooter>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-surface-container text-on-surface text-sm hover:bg-surface-container-high transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={run}
            disabled={running}
            className="px-4 py-2 rounded-lg veridian-gradient text-on-primary text-sm font-semibold shadow-[0_8px_20px_-6px_rgba(0,106,68,0.4)] hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:hover:scale-100"
          >
            {running ? 'Running…' : 'Run assessment'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
