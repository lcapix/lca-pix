'use client';
import Link from 'next/link';
import { useState } from 'react';
import { LcapixWordmark } from '@/components/brand/lcapix-wordmark';
import { Bell, Menu, Search, User, X } from 'lucide-react';

const NAV = [
  { label: 'Dashboard', href: '/home' },
  { label: 'Projects', href: '/home' },
  { label: 'Integrations', href: '/admin/integrations' },
  { label: 'Docs', href: '/guide' },
];

export interface AppShellProps {
  children: React.ReactNode;
  activeHref?: string;
}

export function AppShell({ children, activeHref }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 w-full z-40 glass-panel border-b border-outline-variant/20">
        <nav className="max-w-[1440px] mx-auto flex items-center justify-between px-4 sm:px-6 md:px-10 h-16">
          <div className="flex items-center gap-6 md:gap-10">
            <button
              type="button"
              aria-label="Toggle navigation"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((o) => !o)}
              className="md:hidden w-9 h-9 rounded-md hover:bg-surface-container-low flex items-center justify-center text-on-surface-variant"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <LcapixWordmark size="sm" href="/home" />
            <div className="hidden md:flex items-center gap-7 text-sm font-medium">
              {NAV.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  className={
                    activeHref === l.href
                      ? 'text-primary font-semibold'
                      : 'text-on-surface/70 hover:text-primary transition-colors'
                  }
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-surface-container-low border border-outline-variant/20 rounded-md px-3 py-2 text-sm text-on-surface-variant w-48 lg:w-64">
              <Search className="w-4 h-4" />
              <span className="truncate">Search systems...</span>
              <span className="ml-auto font-mono text-[10px] uppercase tracking-wider bg-surface-container border border-outline-variant/30 px-1.5 py-0.5 rounded">
                ⌘K
              </span>
            </div>
            <button
              type="button"
              aria-label="Notifications"
              className="w-9 h-9 rounded-md hover:bg-surface-container-low flex items-center justify-center text-on-surface-variant"
            >
              <Bell className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Account"
              className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface"
            >
              <User className="w-4 h-4" />
            </button>
          </div>
        </nav>
        {mobileOpen && (
          <div className="md:hidden border-t border-outline-variant/20 bg-background">
            <nav className="px-4 py-3 flex flex-col gap-1 text-sm font-medium">
              {NAV.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className={
                    activeHref === l.href
                      ? 'px-3 py-2 rounded-md bg-surface-container-low text-primary font-semibold'
                      : 'px-3 py-2 rounded-md text-on-surface/80 hover:bg-surface-container-low transition-colors'
                  }
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>
      <main>{children}</main>
    </div>
  );
}
