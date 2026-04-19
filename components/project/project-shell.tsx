'use client';
import Link from 'next/link';
import { FileText, Gauge, Layers, ListChecks, Users } from 'lucide-react';

export interface ProjectShellProps {
  children: React.ReactNode;
  projectName: string;
  projectId: number | string;
  activeSection?: 'editor' | 'kpi' | 'analysis' | 'logs' | 'access';
}

const NAV = [
  { key: 'editor',   label: 'Case Editor',         icon: FileText,   href: (id: string) => `/project/${id}` },
  { key: 'kpi',      label: 'Sustainability KPI',  icon: Gauge,      href: (id: string) => `/project/${id}/analytics` },
  { key: 'analysis', label: 'Life Cycle Analysis', icon: Layers,     href: (id: string) => `/project/${id}/comparisons` },
  { key: 'logs',     label: 'System Logs',         icon: ListChecks, href: () => `/admin/integrations` },
  { key: 'access',   label: 'Team Access',         icon: Users,      href: (id: string) => `/project/${id}#team` },
] as const;

export function ProjectShell({ children, projectName, projectId, activeSection = 'editor' }: ProjectShellProps) {
  return (
    <div className="grid md:grid-cols-[260px_1fr] min-h-[calc(100vh-64px)]">
      {/* Mobile top rail: horizontal scroll of nav links (below md) */}
      <div className="md:hidden border-b border-outline-variant/15 bg-surface-container-low">
        <div className="px-4 pt-4">
          <div className="font-bold text-base text-primary leading-tight truncate">{projectName}</div>
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-on-surface-variant">
            Active Case · v4.2
          </div>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-4 py-3">
          {NAV.map((item) => {
            const active = item.key === activeSection;
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={item.href(String(projectId))}
                className={
                  active
                    ? 'flex items-center gap-2 px-3 py-1.5 rounded-md veridian-gradient text-on-primary font-medium shadow-sm whitespace-nowrap text-xs'
                    : 'flex items-center gap-2 px-3 py-1.5 rounded-md border border-outline-variant/30 text-on-surface/80 hover:bg-surface-container transition-colors whitespace-nowrap text-xs'
                }
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <aside className="hidden md:block border-r border-outline-variant/15 bg-surface-container-low">
        <div className="p-6">
          <div className="font-bold text-lg text-primary leading-tight">{projectName}</div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-on-surface-variant">
            Active Case · v4.2
          </div>
        </div>
        <nav className="px-3 pb-6 space-y-1">
          {NAV.map((item) => {
            const active = item.key === activeSection;
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={item.href(String(projectId))}
                className={
                  active
                    ? 'flex items-center gap-3 px-3 py-2.5 rounded-md veridian-gradient text-on-primary font-medium shadow-sm'
                    : 'flex items-center gap-3 px-3 py-2.5 rounded-md text-on-surface/80 hover:bg-surface-container transition-colors'
                }
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="bg-background min-w-0">{children}</div>
    </div>
  );
}
