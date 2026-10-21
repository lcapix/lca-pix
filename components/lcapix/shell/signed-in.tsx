'use client'

// The wrapper for every signed-in route segment: the auth gate, then the
// education shell (or, with NEXT_PUBLIC_LCAPIX_SHELL=classic, the old pages
// as they were, each with its own top bar).

import type { ReactNode } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { EDU_SHELL } from '@/lib/ui-flags'
import { AppShell } from './app-shell'

export function SignedIn({ children }: { children: ReactNode }) {
  return <AuthGuard requireAuth={true}>{EDU_SHELL ? <AppShell>{children}</AppShell> : children}</AuthGuard>
}
