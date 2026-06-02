"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { AuthGuard } from "@/components/auth-guard"
import { useAuthStore } from "@/lib/store"
import { useToast } from "@/hooks/use-toast"
import { apiRequest } from "@/lib/api-client"

/**
 * /auth/onboarding
 *
 * One-screen profile capture shown right after first sign-in (Google or
 * email). Required: full name + company. Optional: role, use case, country.
 *
 * The form pre-fills from /api/auth/profile so a Google user already sees
 * their name. On submit, PUT /api/auth/profile saves and stamps
 * onboarded_at, then we forward to /home. The same fields are editable later
 * from /profile.
 */

const USE_CASES = [
  { value: "product", label: "Product LCA" },
  { value: "facility", label: "Site / facility LCA" },
  { value: "comparative", label: "Comparative study" },
  { value: "research", label: "Research / academic" },
  { value: "other", label: "Other" },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { toast } = useToast()
  const storeUser = useAuthStore((s) => s.user)
  const login = useAuthStore((s) => s.login)

  const [fullName, setFullName] = useState("")
  const [company, setCompany] = useState("")
  const [role, setRole] = useState("")
  const [useCase, setUseCase] = useState("")
  const [country, setCountry] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<{ fullName?: string; company?: string }>(
    {},
  )

  // Pre-fill from server profile (covers Google's name being seeded on signup
  // and lets returning users edit existing data).
  useEffect(() => {
    let cancelled = false
    apiRequest("/api/auth/profile")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data?.success && data.profile) {
          const p = data.profile
          if (p.fullName) setFullName(p.fullName)
          else if (storeUser?.name) setFullName(storeUser.name)
          if (p.company) setCompany(p.company)
          if (p.role) setRole(p.role)
          if (p.useCase) setUseCase(p.useCase)
          if (p.country) setCountry(p.country)
          // If they don't actually need onboarding, skip the form.
          if (!p.needsOnboarding) router.replace("/home")
        }
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [router, storeUser])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const nextErrors: typeof errors = {}
    if (!fullName.trim()) nextErrors.fullName = "Required."
    if (!company.trim()) nextErrors.company = "Required."
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    try {
      const res = await apiRequest("/api/auth/profile", {
        method: "PUT",
        body: JSON.stringify({
          fullName: fullName.trim(),
          company: company.trim(),
          role: role.trim() || null,
          useCase: useCase || null,
          country: country.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error ?? "Couldn't save your profile.")
      }

      // Reflect the new display name immediately in the Zustand store so the
      // /home greeting doesn't still say the old username.
      if (storeUser) {
        login({
          ...storeUser,
          name: fullName.trim(),
        })
      }

      toast({
        title: "You're all set",
        description: "Welcome to LCAPIX.",
      })
      router.replace("/home")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Couldn't save your profile."
      toast({
        title: "Save failed",
        description: message,
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthGuard>
      <div
        style={{
          minHeight: "100vh",
          background: "var(--surface-base)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 24px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 560,
            background: "var(--surface-raised, #fff)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 14,
            padding: "40px 44px 36px",
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.14em",
              color: "var(--text-tertiary)",
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            STEP 1 OF 1 · QUICK SETUP
          </div>
          <h1
            className="display"
            style={{
              fontSize: 28,
              fontWeight: 600,
              margin: 0,
              letterSpacing: "-0.01em",
              marginBottom: 8,
            }}
          >
            Tell us a little about you.
          </h1>
          <p
            style={{
              fontSize: 13.5,
              color: "var(--text-secondary)",
              margin: 0,
              marginBottom: 28,
              lineHeight: 1.55,
            }}
          >
            We use this to personalize your dashboard. You can edit any of it
            later from your profile.
          </p>

          {loading ? (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                color: "var(--text-tertiary)",
              }}
            >
              Loading…
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              style={{ display: "flex", flexDirection: "column", gap: 18 }}
            >
              <Field
                label="Full name"
                required
                error={errors.fullName}
              >
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  autoFocus
                  style={inputStyle}
                />
              </Field>

              <Field
                label="Company / organization"
                required
                error={errors.company}
              >
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Acme Sustainability"
                  style={inputStyle}
                />
              </Field>

              <Field label="Role (optional)">
                <input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="Sustainability analyst"
                  style={inputStyle}
                />
              </Field>

              <Field label="Primary use case (optional)">
                <select
                  value={useCase}
                  onChange={(e) => setUseCase(e.target.value)}
                  style={{ ...inputStyle, appearance: "auto" }}
                >
                  <option value="">Choose one…</option>
                  {USE_CASES.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Country (optional)">
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="United States"
                  style={inputStyle}
                />
              </Field>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                style={{ marginTop: 8, height: 44, fontSize: 14 }}
              >
                {submitting ? "Saving…" : "Continue to dashboard"}
              </button>
            </form>
          )}
        </div>
      </div>
    </AuthGuard>
  )
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--border-subtle)",
  background: "var(--surface-raised)",
  fontSize: 14,
  fontFamily: "var(--font-ui)",
  color: "var(--text-primary)",
  outline: "none",
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        className="label"
        style={{
          display: "block",
          fontSize: 11,
          letterSpacing: "0.1em",
          fontWeight: 600,
          color: "var(--text-tertiary)",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
        {required && (
          <span style={{ color: "var(--signal-danger, #dc2626)", marginLeft: 4 }}>
            *
          </span>
        )}
      </label>
      {children}
      {error && (
        <div
          style={{
            color: "var(--signal-danger, #dc2626)",
            fontSize: 12,
            marginTop: 4,
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}
