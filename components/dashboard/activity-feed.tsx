'use client';
import { Button } from '@/components/ui/button';
import { Activity, AlertTriangle, CheckCircle2, FlaskConical, FileDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export interface ActivityFeedItem {
  source?: string;
  action?: string;
  records_affected?: number | string;
  executed_at?: string | number | Date;
  status?: string;
}

export interface ActivityFeedProps {
  items: ActivityFeedItem[];
  onGenerateReport?: () => void;
}

function iconFor(status?: string, source?: string) {
  if (status === 'error' || status === 'failed') return AlertTriangle;
  if (status === 'success' || status === 'completed') return CheckCircle2;
  if ((source ?? '').toLowerCase().includes('lab')) return FlaskConical;
  return Activity;
}

export function ActivityFeed({ items, onGenerateReport }: ActivityFeedProps) {
  return (
    <aside className="lg:sticky lg:top-20 lg:self-start bg-surface-container-lowest border border-outline-variant/15 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-on-surface">Activity Feed</h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-on-surface-variant">
          Live
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-on-surface-variant py-6 text-center">
          No recent activity yet.
        </p>
      ) : (
        <ul className="space-y-4">
          {items.slice(0, 6).map((it, idx) => {
            const Icon = iconFor(it.status, it.source);
            const title =
              it.action ??
              (it.source ? `${it.source} event` : 'Activity');
            const when = it.executed_at
              ? formatDistanceToNow(new Date(it.executed_at), { addSuffix: true })
              : '';
            const color =
              it.status === 'error' || it.status === 'failed'
                ? 'text-error bg-error/10'
                : 'text-primary bg-primary/10';
            return (
              <li key={idx} className="flex items-start gap-3">
                <div
                  className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${color}`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-on-surface truncate">{title}</div>
                  {it.source ? (
                    <div className="text-xs text-on-surface-variant truncate">{it.source}</div>
                  ) : null}
                  {when ? (
                    <div className="text-[11px] text-on-surface-variant/70 mt-0.5">{when}</div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-6 pt-5 border-t border-outline-variant/20">
        <Button
          onClick={onGenerateReport}
          className="w-full bg-primary text-on-primary hover:bg-primary/90"
        >
          <FileDown className="mr-2 h-4 w-4" />
          Generate EIA Report
        </Button>
      </div>
    </aside>
  );
}
