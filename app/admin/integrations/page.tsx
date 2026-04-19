// app/admin/integrations/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { AppLayout } from '@/components/app-layout';
import { apiGet } from '@/lib/api-client';
import { ImportButtons } from '@/components/integrations/import-buttons';
import { LogViewer } from '@/components/integrations/log-viewer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Num } from '@/components/ui/num';
import {
  FlaskConical,
  Ruler,
  Wallet,
  CheckCircle2,
  MoreVertical,
  Database,
  KeyRound,
  Activity,
  ShieldCheck,
} from 'lucide-react';

interface Status {
  substances: { total: number; enriched: number };
  factorsByMethod: Array<{ method_name: string; factors: number }>;
  rateCache: Array<{ rate_type: string; cnt: number }>;
}

// Static visual data for the Operational Connections table.
const OPERATIONAL_CONNECTIONS = [
  {
    name: 'openLCA Professional',
    version: 'v2.1.0-api',
    health: 'healthy' as const,
    latency: '48ms',
    uptime: '99.98%',
  },
  {
    name: 'PubChem Substance Registry',
    version: 'REST API V2',
    health: 'degraded' as const,
    latency: '1,240ms',
    uptime: '94.20%',
  },
  {
    name: 'Ecoinvent Data v3.10',
    version: 'GraphQL Gateway',
    health: 'healthy' as const,
    latency: '12ms',
    uptime: '100%',
  },
  {
    name: 'GaBi Cloud Services',
    version: 'OAuth2 / WS',
    health: 'critical' as const,
    latency: 'TIMEOUT',
    uptime: '82.11%',
  },
];

const HEALTH_DOT: Record<string, string> = {
  healthy: 'bg-[#008558]',
  degraded: 'bg-amber-500',
  critical: 'bg-red-500',
};

const HEALTH_LABEL: Record<string, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  critical: 'Critical',
};

function OverviewTab({
  status,
  onRefresh,
  logRefresh,
}: {
  status: Status;
  onRefresh: () => void;
  logRefresh: number;
}) {
  const substancesTotal = Number(status.substances.total ?? 0);
  const substancesEnriched = Number(status.substances.enriched ?? 0);
  const methodsCount = status.factorsByMethod.length;
  const rateCacheCount = status.rateCache.reduce((sum, r) => sum + Number(r.cnt ?? 0), 0);
  const latestMethod = status.factorsByMethod[0]?.method_name ?? '—';

  return (
    <div className="space-y-12">
      {/* KPI Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-[var(--surface-container-low)] border-0 rounded-xl">
          <CardContent className="p-8 flex flex-col justify-between min-h-[220px]">
            <div>
              <div className="flex items-center justify-between mb-8">
                <FlaskConical className="h-8 w-8 text-[var(--primary)]" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--outline)]">
                  Real-time
                </span>
              </div>
              <h3 className="text-sm font-semibold mb-1">Substances</h3>
              <div className="flex items-baseline gap-2">
                <Num value={substancesTotal} className="text-4xl font-bold" />
                <Badge className="font-mono text-xs bg-[var(--on-secondary-container)] text-[var(--secondary-container)]">
                  LIVE
                </Badge>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-[var(--outline-variant)]/30">
              <p className="font-mono text-[10px] text-[var(--on-surface-variant)]">
                ENRICHED: <Num value={substancesEnriched} /> / <Num value={substancesTotal} />
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[var(--surface-container-low)] border-0 rounded-xl">
          <CardContent className="p-8 flex flex-col justify-between min-h-[220px]">
            <div>
              <div className="flex items-center justify-between mb-8">
                <Ruler className="h-8 w-8 text-[var(--primary)]" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--outline)]">
                  Verified
                </span>
              </div>
              <h3 className="text-sm font-semibold mb-1">Methodologies</h3>
              <div className="flex items-baseline gap-2">
                <Num value={methodsCount} className="text-4xl font-bold" />
                <Badge className="font-mono text-xs bg-[var(--on-primary-fixed-variant)] text-[var(--primary-fixed)]">
                  IMPORTED
                </Badge>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-[var(--outline-variant)]/30">
              <p className="font-mono text-[10px] text-[var(--on-surface-variant)] truncate">
                LATEST: {latestMethod}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[var(--surface-container-low)] border-0 rounded-xl">
          <CardContent className="p-8 flex flex-col justify-between min-h-[220px]">
            <div>
              <div className="flex items-center justify-between mb-8">
                <Wallet className="h-8 w-8 text-[var(--primary)]" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--outline)]">
                  Dynamic
                </span>
              </div>
              <h3 className="text-sm font-semibold mb-1">Cost Rates</h3>
              <div className="flex items-baseline gap-2">
                <Num value={rateCacheCount} className="text-4xl font-bold" />
                <Badge className="font-mono text-xs bg-[var(--secondary-container)] text-[var(--on-secondary-container)]">
                  CACHED
                </Badge>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-[var(--outline-variant)]/30">
              <p className="font-mono text-[10px] text-[var(--on-surface-variant)]">
                ROWS ACROSS {status.rateCache.length} TYPES
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[var(--surface-container-low)] border-0 rounded-xl">
          <CardContent className="p-8 flex flex-col justify-between min-h-[220px]">
            <div>
              <div className="flex items-center justify-between mb-8">
                <ShieldCheck className="h-8 w-8 text-[var(--primary)]" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--outline)]">
                  Audited
                </span>
              </div>
              <h3 className="text-sm font-semibold mb-1">Connections</h3>
              <div className="flex items-baseline gap-2">
                <Num value={OPERATIONAL_CONNECTIONS.length} className="text-4xl font-bold" />
                <Badge className="font-mono text-xs bg-[var(--secondary-container)] text-[var(--on-secondary-container)]">
                  ACTIVE
                </Badge>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-[var(--outline-variant)]/30">
              <p className="font-mono text-[10px] text-[var(--on-surface-variant)]">
                GLOBAL AVERAGE: 0.94% DELTA
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Import Actions */}
      <div className="space-y-4">
        <h4 className="font-bold text-xl tracking-tight">Actions</h4>
        <ImportButtons onRefresh={onRefresh} />
      </div>

      {/* Operational Connections */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-xl tracking-tight">Operational Connections</h4>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="font-mono text-xs uppercase bg-[var(--surface-container-high)]"
            >
              Filter: Active
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="font-mono text-xs uppercase bg-[var(--surface-container-high)]"
            >
              Export CSV
            </Button>
          </div>
        </div>

        <div className="bg-[var(--surface-container-lowest)] rounded-2xl overflow-hidden shadow-[0_24px_48px_-12px_rgba(25,28,27,0.04)]">
          <Table>
            <TableHeader>
              <TableRow className="bg-[var(--surface-container-low)] hover:bg-[var(--surface-container-low)]">
                <TableHead className="px-8 py-4 font-mono text-[10px] font-semibold text-[var(--outline)] uppercase tracking-wider">
                  Service Node
                </TableHead>
                <TableHead className="px-8 py-4 font-mono text-[10px] font-semibold text-[var(--outline)] uppercase tracking-wider">
                  Health
                </TableHead>
                <TableHead className="px-8 py-4 font-mono text-[10px] font-semibold text-[var(--outline)] uppercase tracking-wider">
                  Latency
                </TableHead>
                <TableHead className="px-8 py-4 font-mono text-[10px] font-semibold text-[var(--outline)] uppercase tracking-wider">
                  Uptime
                </TableHead>
                <TableHead className="px-8 py-4 font-mono text-[10px] font-semibold text-[var(--outline)] uppercase tracking-wider text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {OPERATIONAL_CONNECTIONS.map((svc) => (
                <TableRow key={svc.name} className="group hover:bg-[var(--surface)]">
                  <TableCell className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-[var(--surface-container-highest)] flex items-center justify-center">
                        <Database className="h-5 w-5 text-[var(--on-surface-variant)]" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{svc.name}</div>
                        <div className="text-[10px] font-mono text-[var(--outline)]">
                          {svc.version}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-8 py-6">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${HEALTH_DOT[svc.health]}`} />
                      <span className="text-sm font-medium">{HEALTH_LABEL[svc.health]}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-8 py-6">
                    <span
                      className={`font-mono text-sm ${
                        svc.health === 'critical' ? 'text-[var(--error)]' : ''
                      }`}
                    >
                      {svc.latency}
                    </span>
                  </TableCell>
                  <TableCell className="px-8 py-6">
                    <span
                      className={`font-mono text-sm ${
                        svc.health === 'critical' ? 'text-[var(--error)]' : ''
                      }`}
                    >
                      {svc.uptime}
                    </span>
                  </TableCell>
                  <TableCell className="px-8 py-6 text-right">
                    <button className="text-[var(--outline)] hover:text-[var(--primary)]">
                      <MoreVertical className="h-4 w-4 inline" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Recent activity */}
      <div className="space-y-4">
        <h4 className="font-bold text-xl tracking-tight">Recent Activity</h4>
        <div className="rounded-2xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-lowest)] overflow-hidden">
          <LogViewer refreshKey={logRefresh} />
        </div>
      </div>

      {/* Systems Harmonized */}
      <div className="mt-8 flex items-center justify-center p-12 relative overflow-hidden rounded-3xl bg-[var(--surface-container-low)]">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary-fixed)]/20 to-transparent blur-3xl opacity-30" />
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-lg mb-4">
            <CheckCircle2 className="h-8 w-8 text-[var(--primary)]" />
          </div>
          <h5 className="text-xl font-bold mb-2">Systems Harmonized</h5>
          <p className="text-sm text-[var(--on-surface-variant)] max-w-sm">
            All global data sources are verified against LCAPIX Botanical Standards. Last audit
            completed successfully at 04:00 UTC.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function IntegrationsAdminPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logRefresh, setLogRefresh] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<any>('/api/integrations/status');
      setStatus(data);
      setLogRefresh((n) => n + 1);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AuthGuard>
      <AppLayout>
        <div className="p-8 lg:p-12 max-w-7xl mx-auto">
          {/* Editorial header */}
          <div className="mb-10">
            <h2 className="text-5xl lg:text-[3.5rem] font-extrabold tracking-tighter text-[var(--primary)] leading-tight mb-2">
              Integrations.
            </h2>
            <p className="text-[var(--on-surface-variant)] max-w-xl leading-relaxed">
              Orchestrate the flow of environmental metadata across your LCAPIX infrastructure.
              Managed endpoints for substances, methodologies, and technical cost rates.
            </p>
          </div>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="bg-transparent border-b border-[var(--outline-variant)]/30 rounded-none h-auto w-full justify-start gap-8 p-0 mb-10">
              <TabsTrigger
                value="overview"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[var(--primary)] data-[state=active]:text-[var(--primary)] rounded-none pb-4 font-semibold text-sm text-[var(--outline)]"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="data-sources"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[var(--primary)] data-[state=active]:text-[var(--primary)] rounded-none pb-4 font-medium text-sm text-[var(--outline)]"
              >
                <Database className="h-4 w-4 mr-1" /> Data Sources
              </TabsTrigger>
              <TabsTrigger
                value="api-keys"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[var(--primary)] data-[state=active]:text-[var(--primary)] rounded-none pb-4 font-medium text-sm text-[var(--outline)]"
              >
                <KeyRound className="h-4 w-4 mr-1" /> API Keys
              </TabsTrigger>
              <TabsTrigger
                value="activity"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[var(--primary)] data-[state=active]:text-[var(--primary)] rounded-none pb-4 font-medium text-sm text-[var(--outline)]"
              >
                <Activity className="h-4 w-4 mr-1" /> Activity Log
              </TabsTrigger>
            </TabsList>

            {loading && (
              <div className="text-[var(--on-surface-variant)] py-12 text-center">Loading…</div>
            )}
            {error && (
              <div className="text-[var(--error)] py-4 font-mono text-sm">Error: {error}</div>
            )}

            <TabsContent value="overview">
              {status && (
                <OverviewTab status={status} onRefresh={refresh} logRefresh={logRefresh} />
              )}
            </TabsContent>
            <TabsContent value="data-sources">
              <div className="text-[var(--on-surface-variant)] py-12 text-center">
                Coming in next commit.
              </div>
            </TabsContent>
            <TabsContent value="api-keys">
              <div className="text-[var(--on-surface-variant)] py-12 text-center">
                Coming in next commit.
              </div>
            </TabsContent>
            <TabsContent value="activity">
              <div className="text-[var(--on-surface-variant)] py-12 text-center">
                Coming in next commit.
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </AppLayout>
    </AuthGuard>
  );
}
