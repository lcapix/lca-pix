import type React from 'react'
import { SignedIn } from '@/components/lcapix/shell/signed-in'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <SignedIn>{children}</SignedIn>
}
