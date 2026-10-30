'use client'

// The wrapper for every signed-in route segment: the auth gate, then the shell.

import type { ReactNode } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { AppShell } from './app-shell'

export function SignedIn({ children }: { children: ReactNode }) {
  return (
    <AuthGuard requireAuth={true}>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  )
}
