"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/store"
import { LandingNav } from "@/components/landing/landing-nav"
import { LandingHero } from "@/components/landing/landing-hero"
import { MethodComparison } from "@/components/landing/method-comparison"
import { TelemetryFeature } from "@/components/landing/telemetry-feature"
import { FeatureGrid } from "@/components/landing/feature-grid"
import { FinalCta } from "@/components/landing/final-cta"
import { LandingFooter } from "@/components/landing/landing-footer"

export default function RootPage() {
  const { isAuthenticated } = useAuthStore()
  const router = useRouter()
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  // Once hydrated, if the user is authenticated, send them to /home.
  // Unauthenticated visitors stay on the landing page.
  useEffect(() => {
    if (hydrated && isAuthenticated) {
      router.replace("/home")
    }
  }, [hydrated, isAuthenticated, router])

  // Brief spinner only during the authenticated redirect to avoid flashing
  // the landing marketing page to logged-in users.
  if (hydrated && isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background text-on-surface">
      <LandingNav />
      <LandingHero />
      <MethodComparison />
      <TelemetryFeature />
      <FeatureGrid />
      <FinalCta />
      <LandingFooter />
    </main>
  )
}
