"use client"

import { TitleBlock } from '@/components/lcapix/ds'
import { USE_CASES as ONBOARDING_USE_CASES } from '@/lib/onboarding'
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"
import { AuthGuard } from "@/components/auth-guard"
import { Icon } from "@/components/lcapix"
import { useAuthStore } from "@/lib/store"
import { toast } from "sonner"
import { ApiError, apiGet, apiRequest } from "@/lib/api-client"
import { DeleteAccountCard } from "@/components/lcapix/profile/delete-account"
import { ChangePasswordCard } from "@/components/lcapix/profile/change-password"

/**
 * /profile: editable user profile.
 *
 * Layout intent: hero with avatar / account meta on top, then two parallel
 * column cards (Personal / Professional). A sticky save bar at the bottom
 * surfaces dirty state: Save only enables when fields have actually
 * diverged from the server snapshot, and there's a one-click Discard.
 */

// G66: the same choices as About you (lib/onboarding.ts). A value saved before
// those choices still reads by its old name, and is offered only to whoever has it.
const LEGACY_LABEL: Record<string, string> = {
  product: "Product LCA",
  facility: "Site / facility LCA",
  comparative: "Comparative study",
  research: "Research / academic",
  other: "Other",
}
const USE_CASES = ONBOARDING_USE_CASES.map((u) => ({ value: u.id as string, label: u.label as string }))
const useCaseChoices = (current: string) =>
  LEGACY_LABEL[current] ? [...USE_CASES, { value: current, label: LEGACY_LABEL[current] }] : USE_CASES

const COUNTRIES = [
  "United States",
  "United Kingdom",
  "Canada",
  "Germany",
  "France",
  "Netherlands",
  "Sweden",
  "Denmark",
  "Norway",
  "Finland",
  "Switzerland",
  "Spain",
  "Italy",
  "Australia",
  "Japan",
  "South Korea",
  "Singapore",
  "India",
  "Brazil",
  "Mexico",
]

interface ProfileSnapshot {
  email: string
  username: string
  fullName: string
  company: string
  role: string
  useCase: string
  country: string
  onboardedAt: string | null
}

function emptySnapshot(): ProfileSnapshot {
  return {
    email: "",
    username: "",
    fullName: "",
    company: "",
    role: "",
    useCase: "",
    country: "",
    onboardedAt: null,
  }
}

export default function ProfilePage() {
  const router = useRouter()
  const storeUser = useAuthStore((s) => s.user)
  const login = useAuthStore((s) => s.login)

  const [server, setServer] = useState<ProfileSnapshot>(emptySnapshot)
  const [draft, setDraft] = useState<ProfileSnapshot>(emptySnapshot)
  const [loading, setLoading] = useState(true)
  // A failed load shows an error instead of an empty form, so Save cannot
  // write blanks over the real profile (PROF-1).
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<{ fullName?: string; company?: string }>(
    {},
  )

  const userInitials = useMemo(() => {
    const source = draft.fullName || storeUser?.name || storeUser?.email || "U"
    return source
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase()
  }, [draft.fullName, storeUser])

  // Load (and reload on Retry). apiGet throws ApiError on a non-2xx answer.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    apiGet<{ profile?: any }>("/api/auth/profile")
      .then((res) => {
        if (cancelled) return
        const p = res?.profile
        if (!p) throw new Error("The server did not send a profile.")
        const snap: ProfileSnapshot = {
          email: p.email ?? "",
          username: p.username ?? "",
          fullName: p.fullName ?? "",
          company: p.company ?? "",
          role: p.role ?? "",
          useCase: p.useCase ?? "",
          country: p.country ?? "",
          onboardedAt: p.onboardedAt ?? null,
        }
        setServer(snap)
        setDraft(snap)
      })
      .catch((err) => {
        if (cancelled) return
        // A 401 is already on its way to the login page.
        if (err instanceof ApiError && err.status === 401) return
        const message = err instanceof Error ? err.message : "Unknown error"
        setLoadError(message)
        toast.error("Couldn't load your profile", { description: message })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const dirty = useMemo(() => {
    return (
      draft.fullName !== server.fullName ||
      draft.company !== server.company ||
      draft.role !== server.role ||
      draft.useCase !== server.useCase ||
      draft.country !== server.country
    )
  }, [draft, server])

  const update = <K extends keyof ProfileSnapshot>(
    key: K,
    value: ProfileSnapshot[K],
  ) => {
    setDraft((d) => ({ ...d, [key]: value }))
    if (key === "fullName" || key === "company") {
      setErrors((e) => ({ ...e, [key]: undefined }))
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const nextErrors: typeof errors = {}
    if (!draft.fullName.trim()) nextErrors.fullName = "Required."
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSaving(true)
    try {
      const res = await apiRequest("/api/auth/profile", {
        method: "PUT",
        body: JSON.stringify({
          fullName: draft.fullName.trim(),
          company: draft.company.trim(),
          role: draft.role.trim() || null,
          useCase: draft.useCase || null,
          country: draft.country.trim() || null,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body?.error ?? "Couldn't save your profile.")
      }
      const saved: ProfileSnapshot = {
        ...draft,
        onboardedAt: server.onboardedAt ?? new Date().toISOString(),
      }
      setServer(saved)
      setDraft(saved)
      if (storeUser) {
        login({ ...storeUser, name: draft.fullName.trim() })
      }
      toast.success("Profile saved", { description: "Changes are live." })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Couldn't save your profile."
      toast.error("Save failed", { description: message })
    } finally {
      setSaving(false)
    }
  }

  const useCaseLabel =
    useCaseChoices(draft.useCase).find((u) => u.value === draft.useCase)?.label ?? "Not set"

  return (
    <AuthGuard>
      <div className="np">

        <div style={{ paddingBottom: dirty ? 96 : 48 }}>
          <div
            style={{
              maxWidth: 980,
              margin: "0 auto",
              padding: "28px 24px 0",
            }}
          >
            {/* Back link */}
            <button
              onClick={() => router.push("/home")}
              className="ds-focusable"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--ds-text-3)",
                fontSize: 12,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: 0,
                marginBottom: 24,
              }}
            >
              <Icon
                name="arrow-up-right"
                size={11}
                style={{ transform: "rotate(180deg)" }}
              />
              Back to home
            </button>

            {/* Header: enfos posture: eyebrow + display title + sub, no gradient blob */}
            <TitleBlock
              as="h1"
              eyebrow="ACCOUNT"
              title={
                loading
                  ? "Loading…"
                  : draft.fullName ||
                    server.username ||
                    "Your profile"
              }
              sub={
                server.email
                  ? `${server.email}${draft.company ? ` · ${draft.company}` : ""}`
                  : "Update the details we show across LCAPIX."
              }
              style={{ marginBottom: 8 }}
            />
            {/* Quiet meta row: initials avatar + read-only chips */}
            <CalmMetaRow
              initials={userInitials}
              role={draft.role}
              useCaseLabel={useCaseLabel}
              country={draft.country}
              onboardedAt={server.onboardedAt}
              loading={loading}
            />

            {/* Form */}
            {loading ? (
              <Skeleton />
            ) : loadError ? (
              <div
                role="alert"
                style={{
                  marginTop: 28,
                  padding: 24,
                  border: "1px solid var(--ds-line)",
                  borderRadius: 12,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ds-text)" }}>
                  Couldn&apos;t load your profile
                </div>
                <div style={{ fontSize: 13, color: "var(--ds-text-2)" }}>{loadError}</div>
                <button
                  type="button"
                  className="ds-btn"
                  onClick={() => setReloadKey((n) => n + 1)}
                >
                  Retry
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
                  gap: 20,
                  marginTop: 28,
                }}
              >
                <SectionCard
                  eyebrow="PERSONAL"
                  title="About you"
                  description="How we address you across the app."
                  icon="shield"
                >
                  <Field
                    label="Full name"
                    required
                    error={errors.fullName}
                    hint="Used in greetings and project metadata."
                  >
                    <input
                      value={draft.fullName}
                      onChange={(e) => update("fullName", e.target.value)}
                      placeholder="Jane Doe"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Country" hint="Helps us suggest regional factor packs.">
                    <select
                      aria-label="Country"
                      value={draft.country}
                      onChange={(e) => update("country", e.target.value)}
                      style={{ ...inputStyle, appearance: "auto" }}
                    >
                      <option value="">Choose a country…</option>
                      {COUNTRIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      {draft.country &&
                        !COUNTRIES.includes(draft.country) && (
                          <option value={draft.country}>{draft.country}</option>
                        )}
                    </select>
                  </Field>
                </SectionCard>

                <SectionCard
                  eyebrow="PROFESSIONAL"
                  title="Work context"
                  description="Drives defaults and onboarding tips."
                  icon="factory"
                >
                  {/* G64: optional, as in About you. */}
                  <Field
                    label="Institution or company (optional)"
                    error={errors.company}
                  >
                    <input
                      value={draft.company}
                      onChange={(e) => update("company", e.target.value)}
                      placeholder="Acme Sustainability"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Role">
                    <input
                      value={draft.role}
                      onChange={(e) => update("role", e.target.value)}
                      placeholder="e.g. Sustainability analyst"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Primary use case">
                    <select
                      aria-label="Primary use case"
                      value={draft.useCase}
                      onChange={(e) => update("useCase", e.target.value)}
                      style={{ ...inputStyle, appearance: "auto" }}
                    >
                      <option value="">Choose one…</option>
                      {useCaseChoices(draft.useCase).map((u) => (
                        <option key={u.value} value={u.value}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </SectionCard>

                {/* Account meta (read-only) */}
                <SectionCard
                  eyebrow="ACCOUNT"
                  title="Sign-in details"
                  description="Managed by your authentication provider."
                  icon="database"
                  fullWidth
                >
                  <ReadOnlyGrid
                    rows={[
                      { label: "Email", value: server.email || "–" },
                      {
                        label: "Username",
                        value: server.username ? `@${server.username}` : "–",
                      },
                      {
                        label: "Member since",
                        value: server.onboardedAt
                          ? formatDate(server.onboardedAt)
                          : "–",
                      },
                    ]}
                  />
                </SectionCard>
              </form>
            )}
            {!loading && !loadError && server.email && (
              <div style={{ marginTop: 20, display: 'grid', gap: 20 }}>
                <ChangePasswordCard />
                <DeleteAccountCard email={server.email} />
              </div>
            )}
          </div>
        </div>

        {/* Sticky save bar: only when dirty */}
        {dirty && !loading && (
          <div
            style={{
              position: "fixed",
              bottom: 16,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
              padding: "0 16px",
              zIndex: 50,
              pointerEvents: "none",
            }}
          >
            <div
              
              style={{
                pointerEvents: "auto",
                background: "var(--surface-card, #fff)",
                border: "1px solid var(--ds-line)",
                borderRadius: 14,
                padding: "10px 12px 10px 18px",
                display: "flex",
                alignItems: "center",
                gap: 14,
                boxShadow: "0 18px 50px -22px rgba(0,0,0,0.28)",
                minWidth: 360,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--ds-green)",
                }}
              />
              <div
                style={{
                  fontSize: 13,
                  color: "var(--ds-text)",
                  flex: 1,
                }}
              >
                You have unsaved changes.
              </div>
              <button
                type="button"
                className="ds-btn"
                onClick={() => {
                  setDraft(server)
                  setErrors({})
                }}
                style={{ height: 34, fontSize: 12.5 }}
              >
                Discard
              </button>
              <button
                type="button"
                className="ds-btn ds-btn--primary"
                onClick={(e) => handleSubmit(e as unknown as FormEvent)}
                disabled={saving}
                style={{ height: 34, fontSize: 12.5 }}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  )
}

/* ---------- Quiet meta row ----------
 * Replaces the previous gradient-blob HeroHeader. Initials live in a flat
 * brand-tinted square (no shadow, no radial), and meta info is a single line
 * of label/value pairs separated by hairline rules. enfos posture: data over
 * decoration.
 */

function CalmMetaRow({
  initials,
  role,
  useCaseLabel,
  country,
  onboardedAt,
  loading,
}: {
  initials: string
  role: string
  useCaseLabel: string
  country: string
  onboardedAt: string | null
  loading: boolean
}) {
  if (loading) return null
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "20px 0 0",
        marginTop: 18,
        marginBottom: 32,
        borderTop: "1px solid var(--ds-line)",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 12,
          background: "var(--ds-green-wash)",
          color: "var(--ds-green)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 600,
          fontSize: 19,
          letterSpacing: "-0.01em",
          fontFamily: "var(--ds-font)",
          flexShrink: 0,
        }}
      >
        {initials}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 0,
          flex: 1,
        }}
      >
        <MetaCell label="Role" value={role || "Not set"} />
        <MetaCell label="Focus" value={useCaseLabel} />
        <MetaCell label="Country" value={country || "Not set"} />
        <MetaCell
          label="Joined"
          value={onboardedAt ? formatDate(onboardedAt) : "–"}
          last
        />
      </div>
    </div>
  )
}

function MetaCell({
  label,
  value,
  last,
}: {
  label: string
  value: string
  last?: boolean
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "0 18px",
        borderRight: last ? "none" : "1px solid var(--ds-line)",
      }}
    >
      <span
        style={{
          color: "var(--ds-text-3)",
          fontSize: 10.5,
          letterSpacing: "0.12em",
          fontWeight: 600,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span style={{ color: "var(--ds-text)", fontWeight: 500, fontSize: 13 }}>
        {value}
      </span>
    </div>
  )
}

/* ---------- Section card ---------- */

function SectionCard({
  eyebrow,
  title,
  description,
  icon,
  fullWidth,
  children,
}: {
  eyebrow: string
  title: string
  description?: string
  icon: string
  fullWidth?: boolean
  children: ReactNode
}) {
  return (
    <div
      style={{
        background: "var(--surface-raised, #fff)",
        border: "1px solid var(--ds-line)",
        borderRadius: 14,
        padding: "24px 24px 22px",
        gridColumn: fullWidth ? "1 / -1" : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: "var(--ds-green-wash)",
            color: "var(--ds-green)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon name={icon as any} size={14} />
        </span>
        <div
          style={{
            fontSize: 10.5,
            letterSpacing: "0.16em",
            color: "var(--ds-text-3)",
            fontWeight: 700,
          }}
        >
          {eyebrow}
        </div>
      </div>
      <h2
        style={{
          fontSize: 17,
          fontWeight: 600,
          margin: 0,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h2>
      {description && (
        <p
          style={{
            fontSize: 12.5,
            color: "var(--ds-text-3)",
            margin: "4px 0 18px",
          }}
        >
          {description}
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {children}
      </div>
    </div>
  )
}

/* ---------- Field ---------- */

function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 11,
          letterSpacing: "0.12em",
          fontWeight: 600,
          color: "var(--ds-text-3)",
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
            marginTop: 5,
          }}
        >
          {error}
        </div>
      )}
      {!error && hint && (
        <div
          style={{
            color: "var(--ds-text-3)",
            fontSize: 11.5,
            marginTop: 5,
          }}
        >
          {hint}
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 10,
  border: "1px solid var(--ds-line)",
  background: "var(--ds-card)",
  fontSize: 14,
  fontFamily: "var(--ds-font)",
  color: "var(--ds-text)",
  outline: "none",
  transition: "border-color 120ms ease, box-shadow 120ms ease",
}

/* ---------- Read-only meta ---------- */

function ReadOnlyGrid({
  rows,
}: {
  rows: { label: string; value: string }[]
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 14,
      }}
    >
      {rows.map((r) => (
        <div
          key={r.label}
          style={{
            background: "var(--ds-card)",
            border: "1px solid var(--ds-line)",
            borderRadius: 10,
            padding: "12px 14px",
          }}
        >
          <div
            style={{
              fontSize: 10.5,
              letterSpacing: "0.12em",
              fontWeight: 600,
              color: "var(--ds-text-3)",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            {r.label}
          </div>
          <div
            style={{
              fontSize: 13.5,
              color: "var(--ds-text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {r.value}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ---------- Skeleton ---------- */

function Skeleton() {
  return (
    <div
      style={{
        marginTop: 28,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 20,
      }}
    >
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            background: "var(--surface-card, #fff)",
            border: "1px solid var(--ds-line)",
            borderRadius: 16,
            padding: 22,
            height: 280,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(90deg, transparent, color-mix(in oklab, var(--ds-text-3) 8%, transparent), transparent)",
              animation: "shimmer 1.4s linear infinite",
            }}
          />
        </div>
      ))}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  )
}

/* ---------- Helpers ---------- */

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return "–"
  }
}
