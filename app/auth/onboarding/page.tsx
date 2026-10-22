"use client"

// About you (F1.3): full name and an optional company, then Home. "Skip for
// now" finishes onboarding with nothing saved. A failed save says so on the
// form and keeps what was typed.

import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { AuthGuard } from "@/components/auth-guard"
import { useAuthStore } from "@/lib/store"
import { apiRequest } from "@/lib/api-client"
import { useShellStore } from "@/lib/shell/use-shell"
import { EduAuthShell, FieldError } from "@/components/lcapix/auth/edu-auth-shell"

type Phase = "form" | "saving"

export default function OnboardingPage() {
  const router = useRouter()
  const storeUser = useAuthStore((s) => s.user)
  const login = useAuthStore((s) => s.login)

  const [fullName, setFullName] = useState("")
  const [company, setCompany] = useState("")
  // Kept as loaded: this screen does not ask for them, so it must not clear them.
  const [kept, setKept] = useState<{ role: string | null; country: string | null; useCase: string | null }>({
    role: null,
    country: null,
    useCase: null,
  })
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState<Phase>("form")
  const [error, setError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)

  // Pre-fill from the profile (Google seeds the name), and leave if done already.
  useEffect(() => {
    let cancelled = false
    apiRequest("/api/auth/profile")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const p = data?.success ? data.profile : null
        if (p) {
          setFullName(p.fullName || storeUser?.name || "")
          if (p.company) setCompany(p.company)
          setKept({ role: p.role ?? null, country: p.country ?? null, useCase: p.useCase ?? null })
          if (!p.needsOnboarding) router.replace("/home")
        }
        setLoading(false)
      })
      .catch(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [router, storeUser])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) {
      setNameError("Enter your name. It is how people in your projects see you.")
      return
    }
    setNameError(null)
    setPhase("saving")
    setError(null)
    try {
      const res = await apiRequest("/api/auth/profile", {
        method: "PUT",
        body: JSON.stringify({
          fullName: fullName.trim(),
          company: company.trim() || null,
          role: kept.role,
          useCase: kept.useCase,
          country: kept.country,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? "Your answers were not saved.")
      if (storeUser) login({ ...storeUser, name: fullName.trim() })
      await useShellStore.getState().refresh()
      router.replace("/home")
    } catch (err: any) {
      setError(err?.message ?? "Your answers were not saved.")
      setPhase("form")
    }
  }

  const skip = async () => {
    setPhase("saving")
    try {
      const res = await apiRequest("/api/auth/profile", { method: "PUT", body: JSON.stringify({ skip: true }) })
      if (!res.ok) throw new Error(`error ${res.status}`)
      router.replace("/home")
    } catch (err: any) {
      setError(`Skipping did not save: ${err?.message ?? "the request failed"}.`)
      setPhase("form")
    }
  }

  const busy = phase === "saving"

  return (
    <AuthGuard>
      <EduAuthShell pane="setup">
        <form className="edu-setup-card" onSubmit={submit} aria-busy={loading || busy || undefined}>
          <p className="edu-eyebrow">Step 1 of 1 · Quick setup</p>
          <h1 className="edu-h1">Tell us a little about you.</h1>
          <p className="edu-sub" style={{ marginBottom: 22 }}>
            You can edit any of it later from your profile.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <div className="edu-field" style={{ marginBottom: 0 }}>
              <label htmlFor="fullName">Full name</label>
              <input
                id="fullName"
                className="edu-input"
                autoComplete="name"
                value={fullName}
                disabled={loading || busy}
                aria-invalid={!!nameError || undefined}
                aria-describedby={nameError ? "name-error" : undefined}
                onChange={(e) => setFullName(e.target.value)}
              />
              {nameError && <FieldError id="name-error">{nameError}</FieldError>}
            </div>
            <div className="edu-field" style={{ marginBottom: 0 }}>
              <label htmlFor="company">
                Company <span style={{ fontWeight: 400, fontSize: 14, color: "var(--ds-text-2)" }}>optional</span>
              </label>
              <input
                id="company"
                className="edu-input"
                autoComplete="organization"
                placeholder="e.g. your plant or firm"
                value={company}
                disabled={loading || busy}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 16 }}>
              <FieldError id="setup-error">{error}</FieldError>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 24 }}>
            <button type="submit" className="edu-submit" disabled={loading || busy} aria-busy={busy || undefined} style={{ flex: 1 }}>
              {busy && <span className="ds-spinner" aria-hidden />}
              {busy ? "Saving…" : "Continue"}
              {!busy && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M5 12h14m-6-6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <button type="button" className="ds-link" style={{ fontWeight: 600, fontSize: 16 }} onClick={skip} disabled={loading || busy}>
              Skip for now
            </button>
          </div>
        </form>
      </EduAuthShell>
    </AuthGuard>
  )
}
