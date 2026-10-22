"use client"

// About you (F1.3) and building the sample (F1.4): full name, an optional
// institution, what LCAPIX is for (three uses; a company workspace shows as In
// development), Guided mode for this device, then "Open the sample study",
// which saves the answers and builds the finished sample. "Skip for now"
// finishes onboarding with nothing saved. If the sample cannot be built, the
// answers are already saved: Try again, or start an empty project instead.

import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { AuthGuard } from "@/components/auth-guard"
import { useAuthStore } from "@/lib/store"
import { apiRequest } from "@/lib/api-client"
import { USE_CASES, USE_CASE_IN_DEVELOPMENT, isAcceptedUseCase } from "@/lib/onboarding"
import { useGuidedMode, useShellStore } from "@/lib/shell/use-shell"
import { Button, ComingSoon, Flag, Switch } from "@/components/lcapix/ds"
import { EduAuthShell, FieldError } from "@/components/lcapix/auth/edu-auth-shell"

type Phase = "form" | "saving" | "building" | "failed"

export default function OnboardingPage() {
  const router = useRouter()
  const storeUser = useAuthStore((s) => s.user)
  const login = useAuthStore((s) => s.login)
  const [guided, setGuided] = useGuidedMode()

  const [fullName, setFullName] = useState("")
  const [institution, setInstitution] = useState("")
  const [useCase, setUseCase] = useState<string>("teaching")
  // Kept as loaded: this screen does not ask for them, so it must not clear them.
  const [kept, setKept] = useState<{ role: string | null; country: string | null }>({ role: null, country: null })
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
          if (p.company) setInstitution(p.company)
          if (p.useCase && isAcceptedUseCase(p.useCase)) setUseCase(p.useCase)
          setKept({ role: p.role ?? null, country: p.country ?? null })
          if (!p.needsOnboarding) router.replace("/home")
        }
        setLoading(false)
      })
      .catch(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [router, storeUser])

  const buildSample = async () => {
    setPhase("building")
    setError(null)
    try {
      const res = await apiRequest("/api/example-project", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.project_id) throw new Error(data?.error ?? `error ${res.status}`)
      await useShellStore.getState().refresh()
      router.replace("/home")
    } catch (e: any) {
      setError(e?.message ?? "the sample was not built")
      setPhase("failed")
    }
  }

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
          company: institution.trim() || null,
          role: kept.role,
          useCase,
          country: kept.country,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? "Your answers were not saved.")
      if (storeUser) login({ ...storeUser, name: fullName.trim() })
    } catch (err: any) {
      setError(err?.message ?? "Your answers were not saved.")
      setPhase("form")
      return
    }
    await buildSample()
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

  const busy = phase === "saving" || phase === "building"

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
              <label htmlFor="institution">
                Institution <span style={{ fontWeight: 400, fontSize: 14, color: "var(--ds-text-2)" }}>optional</span>
              </label>
              <input
                id="institution"
                className="edu-input"
                autoComplete="organization"
                placeholder="e.g. your university"
                value={institution}
                disabled={loading || busy}
                onChange={(e) => setInstitution(e.target.value)}
              />
            </div>
          </div>

          <fieldset className="edu-uses" style={{ marginTop: 22 }} disabled={busy}>
            <legend className="edu-field-label" style={{ marginBottom: 10, gridColumn: "1 / -1" }}>
              What will you use LCAPIX for?
            </legend>
            {USE_CASES.map((u) => (
              <label key={u.id} className="edu-use">
                <input type="radio" name="useCase" value={u.id} checked={useCase === u.id} onChange={() => setUseCase(u.id)} />
                <span>
                  <strong style={{ display: "block", fontSize: 16 }}>{u.label}</strong>
                  <span style={{ fontSize: 14, color: "var(--ds-text-2)" }}>{u.hint}</span>
                </span>
              </label>
            ))}
            <label className="edu-use" aria-disabled="true">
              <input type="radio" name="useCase" value={USE_CASE_IN_DEVELOPMENT.id} disabled aria-describedby="company-dev" />
              <span>
                <strong style={{ display: "block", fontSize: 16 }}>{USE_CASE_IN_DEVELOPMENT.label}</strong>
                <span id="company-dev">
                  <Flag kind="dev" />
                </span>
              </span>
            </label>
          </fieldset>
          <p className="edu-hint" style={{ margin: "0 0 4px" }}>
            Saved with your profile. Every account gets the same tools for now.
          </p>

          <div className="edu-guided">
            <span aria-hidden style={{ width: 40, height: 40, borderRadius: 10, background: "#121615", display: "grid", placeItems: "center", flex: "none" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
                <rect x="6" y="8" width="4" height="4" rx="1" />
                <rect x="14" y="8" width="4" height="4" rx="1" />
                <rect x="8" y="15" width="8" height="2" rx="1" fill="#86D3A6" />
              </svg>
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600, fontSize: 16 }}>
                Guided mode <Flag kind="beta" />
              </span>
              <span style={{ display: "block", fontSize: 14, color: "var(--ds-text-2)", marginTop: 4 }}>
                A short walk through each part of a study as you go. Turn it off any time from the guide or the sidebar.
              </span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <span aria-hidden style={{ fontSize: 14 }}>{guided ? "On" : "Off"}</span>
              <Switch checked={guided} onChange={setGuided} label="Guided mode" hideLabel />
            </span>
          </div>
          <ComingSoon>Remembered on this device. Saving it to your account is coming soon.</ComingSoon>

          {error && phase !== "failed" && (
            <div style={{ marginTop: 16 }}>
              <FieldError id="setup-error">{error}</FieldError>
            </div>
          )}

          {phase === "failed" ? (
            <div className="edu-failed" role="alert" style={{ marginTop: 22 }}>
              <strong style={{ fontSize: 16 }}>We couldn&apos;t build the sample study. Nothing was lost.</strong>
              <span style={{ fontSize: 14 }}>Your answers are saved. Try again in a moment.</span>
              <span style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                <Button variant="dark" onClick={buildSample}>
                  Try again
                </Button>
                <button type="button" className="ds-link" style={{ fontWeight: 600 }} onClick={() => router.push("/project/new")}>
                  Start with an empty project instead
                </button>
              </span>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 24 }}>
                <button type="submit" className="edu-submit" disabled={loading || busy} aria-busy={busy || undefined} style={{ flex: 1 }}>
                  {busy && <span className="ds-spinner" aria-hidden />}
                  {phase === "building" ? "Building your sample study…" : phase === "saving" ? "Saving…" : "Open the sample study"}
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
              <p className="edu-hint" style={{ margin: "12px 0 0" }} role={phase === "building" ? "status" : undefined}>
                {phase === "building"
                  ? "A few seconds: the study, its two runs and a what-if."
                  : "We build a finished sample study for you to read first. It takes a few seconds."}
              </p>
            </>
          )}
        </form>
      </EduAuthShell>
    </AuthGuard>
  )
}
