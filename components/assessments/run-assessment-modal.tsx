'use client';

import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { apiRequest } from '@/lib/api-client';
import { HelpTip } from '@/components/lcapix/help-tip';

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
      // Nothing chosen for this case yet: start from the study's scope (the
      // project's method, the case's region).
      const wantedRegion = initialRegion ?? remembered.region;
      if (!wantedMethod || !wantedRegion) {
        apiRequest(`/api/cases/${caseId}`)
          .then((r) => r.json())
          .then((d) => {
            const c = d?.case ?? {};
            if (!wantedMethod && LCIA_METHODS.some(m => m.value === c.project_lcia_method)) {
              setMethod(c.project_lcia_method);
            }
            const scopeRegion = c.region_code || c.project_region_code;
            if (!wantedRegion && scopeRegion) {
              setRegion(scopeRegion === 'US' ? 'US Grid' : scopeRegion === 'EU' ? 'EU Average' : scopeRegion);
            }
          })
          .catch(() => { /* keep the defaults */ });
      }
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
      // RUN-4: check the status here. The shared JSON helpers hand a 403/500
      // body back as if it were a result, which closed the modal, saved the
      // prefs and crashed the results page on a missing run_id.
      const res = await apiRequest(`/api/cases/${caseId}/assessments`, {
        method: 'POST',
        body: JSON.stringify({
          run_name: `Assessment ${new Date().toLocaleString()}`,
          calculation_method: method,
          region_code: region,
        }),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        // A 500 carries a request id (the cause is in the server log), not
        // the error text; show it so the user can report it.
        const reason = [result?.error, result?.request_id ? `reference ${result.request_id}` : null]
          .filter(Boolean)
          .join(', ');
        throw new Error(reason || `Assessment failed (${res.status})`);
      }
      try {
        localStorage.setItem(
          `lcapix-run-prefs:${caseId}`,
          JSON.stringify({ method, region }),
        );
      } catch { /* storage may be unavailable; prefs are a convenience */ }
      onCompleted?.(result);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to run assessment');
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
            Choose the impact-assessment method and region for this calculation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-[0.12em] text-on-surface-variant mb-1.5">
              Impact-assessment method
              <HelpTip label="What is an impact-assessment method?">
                The method is the set of characterization factors that turns each input and
                output into impact scores (for example, how many kg CO₂-eq one kg of methane
                is worth). CML 2001 comes from Leiden University and is common in Europe;
                TRACI 2.1 is the US EPA method (it reports eutrophication in kg N eq and smog
                in kg O₃ eq); ReCiPe Midpoint (H) uses the default &quot;hierarchist&quot;
                perspective. Results from different methods cannot be added or compared, so
                keep one method for every case you compare.
              </HelpTip>
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
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-[0.12em] text-on-surface-variant mb-1.5">
              Region
              <HelpTip label="What does the region change?">
                The region picks location-specific factors where they exist: today that is the
                electricity grid (US, EU and Global intensities differ a lot). Every other
                material and emission uses its Global factor, and the results table marks
                those rows as &quot;Global (fallback)&quot; so you can see where the region did
                not apply.
              </HelpTip>
            </label>
            <select
              value={region}
              onChange={e => setRegion(e.target.value)}
              className="w-full rounded-lg bg-surface-container-low px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {REGIONS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
            </select>
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
