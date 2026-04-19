'use client';
import { Num } from '@/components/ui/num';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ProjectCardSkeleton } from '@/components/skeletons/project-card-skeleton';
import {
  ArrowRight,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export interface ActivePortfolioProject {
  id: string;
  name: string;
  description?: string;
  caseCount?: number;
  cases?: unknown[];
  updatedAt: string | number | Date;
}

export interface ActivePortfolioProps {
  projects: ActivePortfolioProject[];
  isLoading?: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  searchValue: string;
  onSearchChange: (v: string) => void;
}

export function ActivePortfolio({
  projects,
  isLoading,
  onOpen,
  onDelete,
  onNew,
  searchValue,
  onSearchChange,
}: ActivePortfolioProps) {
  return (
    <section className="min-w-0">
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-on-surface">Active Portfolio</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Your Life Cycle Assessment projects in motion.
          </p>
        </div>
        <Button onClick={onNew} className="bg-primary text-on-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant" />
        <Input
          placeholder="Search projects..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 bg-surface-container-lowest border-outline-variant/20"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-outline-variant/30 bg-surface-container-lowest p-10 text-center">
          <FileText className="h-10 w-10 mx-auto mb-3 text-on-surface-variant/50" />
          <h3 className="text-base font-semibold text-on-surface">No projects yet</h3>
          <p className="text-sm text-on-surface-variant mt-1 mb-4">
            Create your first LCA project to start analyzing environmental impacts.
          </p>
          <Button onClick={onNew} className="bg-primary text-on-primary hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" />
            Create project
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map((p) => {
            const caseCount = p.caseCount ?? p.cases?.length ?? 0;
            return (
              <div
                key={p.id}
                onClick={() => onOpen(p.id)}
                className="group cursor-pointer bg-surface-container-lowest border border-outline-variant/15 rounded-xl p-6 shadow-sm hover:shadow-botanical transition-all"
              >
                <div className="flex items-start gap-5">
                  <div className="h-14 w-14 rounded-lg veridian-gradient flex items-center justify-center flex-shrink-0">
                    <FileText className="h-6 w-6 text-on-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-lg text-on-surface truncate">{p.name}</h3>
                        {p.description ? (
                          <p className="text-sm text-on-surface-variant line-clamp-2 mt-1">
                            {p.description}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <ArrowRight className="h-5 w-5 text-on-surface-variant group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpen(p.id);
                              }}
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Open
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(p.id);
                              }}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-6 text-xs">
                      <div>
                        <div className="font-mono uppercase tracking-[0.14em] text-on-surface-variant">
                          Cases
                        </div>
                        <div className="text-base font-semibold text-on-surface mt-0.5">
                          <Num value={caseCount} />
                        </div>
                      </div>
                      <div>
                        <div className="font-mono uppercase tracking-[0.14em] text-on-surface-variant">
                          Updated
                        </div>
                        <div className="text-sm text-on-surface mt-0.5">
                          {formatDistanceToNow(new Date(p.updatedAt), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
