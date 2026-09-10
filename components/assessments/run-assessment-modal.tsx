'use client';

import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { apiPost } from '@/lib/api-client';

// Regions the engine recognises (see normalizeRegion in lib/lca-engine). The
// factor table currently only carries 'Global'-scope rows, so non-Global picks
// gracefully fall back to Global — but these are the canonical values the rest
// of the app (Results-page selector) uses, kept consistent here.
const REGIONS = [
  { code: 'US Grid',    label: 'United States — grid average' },
  { code: 'EU Average', label: 'Europe — average' },
  { code: 'Global',     label: 'Global average' },
];

// LCIA methods the platform can actually calculate — i.e. the ones with
// characterisation factors loaded in `driver_impact_factors`. Offering methods
// with no factors (CML-IA 2016, EF 3.1, IPCC 2021, EPS 2020, …) silently
// produced all-zero runs, which read as a broken assessment. Keep this list in
// sync with the method_name values present in the factor table.
const LCIA_METHODS = [
  { value: 'CML 2001',            label: 'CML 2001 — midpoint, EU baseline' },
  { value: 'ReCiPe Midpoint (H)', label: 'ReCiPe Midpoint (H)' },
  { value: 'TRACI 2.1',           label: 'TRACI 2.1 — US EPA' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  caseId: number;
  onCompleted?: (result: any) => void;
  /** Pre-select the method/region (e.g. from the Results page selectors). */
  initialMethod?: string;
  initialRegion?: string;
}

export function RunAssessmentModal({ open, onClose, caseId, onCompleted, initialMethod, initialRegion }: Props) {
  // Only honour a pre-selected method we can actually calculate; otherwise fall
  // back to CML 2001 so a stale/unknown value never causes a silent zero run.
  const validInitial = LCIA_METHODS.some(m => m.value === initialMethod) ? (initialMethod as string) : 'CML 2001';
  const [method, setMethod] = useState(validInitial);
  const [region, setRegion] = useState(initialRegion || 'Global');
  const [running, setRunning] = useState(false);

  // The modal stays mounted (hidden) between opens, so re-sync the pre-selected
  // method/region from props each time it re-opens — otherwise it would keep
  // the value from first mount and ignore later Results-page selector changes.
  useEffect(() => {
    if (open) {
      // Remember-last-settings (tool-review polish #5): explicit props win,
      // then this case's last-used method/region, then defaults — so a
      // re-run doesn't re-ask questions the user already answered.
      let remembered: { method?: string; region?: string } = {};
      try {
        remembered = JSON.parse(
          localStorage.getItem(`lcapix-run-prefs:${caseId}`) || '{}',
        );
      } catch { /* corrupt prefs are ignorable */ }
      const wantedMethod = initialMethod ?? remembered.method;
      setMethod(LCIA_METHODS.some(m => m.value === wantedMethod) ? (wantedMethod as string) : 'CML 2001');
      setRegion(initialRegion ?? remembered.region ?? 'Global');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const [error, setError] = useState<string | null>(null);
  // We render the curated LCIA_METHODS list directly. (Previously we tried to
  // pull "imported methods" from /api/integrations/status, but that endpoint
  // falls back to driver names like "Electricity (kWh)" when the LCIA-methods
  // table isn't populated — which surfaced as garbage in this dropdown.)

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
      try {
        localStorage.setItem(
          `lcapix-run-prefs:${caseId}`,
          JSON.stringify({ method, region }),
        );
      } catch { /* storage may be unavailable; prefs are a convenience */ }
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
              {LCIA_METHODS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <p className="text-xs text-on-surface-variant mt-1">
              The method determines the characterisation-factor set used to
              translate inventory flows into impact categories.
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
