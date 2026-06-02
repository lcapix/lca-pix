"use client"

/**
 * New Project page — LCAPIX v3.
 *
 * Editorial form derived from the LCAPIX design system (botanical
 * atmosphere + white card + mono labels). The POST endpoint shape
 * (`{ project_name, description }`) is preserved unchanged; the
 * methodology + region fields are UI-only extras sent along for
 * forward compatibility — the backend ignores them today.
 */

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Icon, SectionHeader, NumberedRail } from "@/components/lcapix"
import { apiRequest } from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"
import { DEMO_METHODS } from "@/lib/lcapix-demo"

const METHODOLOGY_OPTIONS = [
  "CML 2001",
  "ReCiPe 2016",
  "TRACI 2.1",
  "IPCC 2013",
  "EPS 2015",
] as const

// Seed from DEMO_METHODS so the two sources stay in sync visually.
const METHODOLOGY_FROM_DEMO = Array.from(
  new Set<string>([
    ...DEMO_METHODS.map((m) => m.name),
    ...METHODOLOGY_OPTIONS,
  ])
)

const REGION_OPTIONS = [
  "Global",
  "North America",
  "Europe",
  "Asia Pacific",
  "Latin America",
] as const

export default function NewProjectPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [methodology, setMethodology] = useState<string>(METHODOLOGY_OPTIONS[0])
  const [region, setRegion] = useState<string>(REGION_OPTIONS[0])
  const [submitting, setSubmitting] = useState(false)
  const [nameError, setNameError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setNameError("Project name is required")
      return
    }
    setNameError("")
    setSubmitting(true)
    try {
      const res = await apiRequest("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          project_name: name.trim(),
          description: description.trim(),
          // Forward-compatible extras (backend ignores today):
          methodology,
          region,
        }),
      })
      const data = await res.json()
      // API returns { success, project: { project_id, ... } } — the previous
      // check expected a top-level project_id and so always failed silently
      // even though the row was inserted.
      const projectId =
        data?.project?.project_id ??
        data?.project?.id ??
        data?.project_id ??
        null
      if (res.ok && data?.success && projectId != null) {
        toast({
          title: "Project created",
          description: `"${name.trim()}" is ready.`,
        })
        router.push(`/project/${projectId}`)
      } else {
        toast({
          title: "Could not create project",
          description: data?.error || "Unknown error. Please try again.",
          variant: "destructive",
        })
      }
    } catch (err) {
      toast({
        title: "Network error",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        minHeight: "calc(100vh - 64px)",
        padding: "40px 28px 96px",
        background: "var(--surface-base)",
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        {/* Back link */}
        <div style={{ marginBottom: 28 }}>
          <Link
            href="/home"
            className="mono"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--text-tertiary)",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            <Icon name="chevron-left" size={14} />
            Back to Dashboard
          </Link>
        </div>

        {/* Header — enfos rhythm */}
        <SectionHeader
          as="h1"
          eyebrow="NEW PROJECT"
          title="Define an assessment."
          sub="A project sets the scope of one LCA study. Once created you'll build a process hierarchy and run the calculation."
          style={{ marginBottom: 32 }}
        />

        {/* ISO 14040 rail above the form so the user sees the path they're entering */}
        <NumberedRail
          eyebrow="THE FIVE PHASES YOU'LL WORK THROUGH"
          orientation="horizontal"
          steps={[
            {
              title: "Goal & scope",
              description: "You're here. Name the study and choose its boundaries.",
            },
            {
              title: "Inventory",
              description: "List inputs and outputs across every stage.",
            },
            {
              title: "Impact",
              description: "Convert flows into category scores.",
            },
            {
              title: "Interpretation",
              description: "Sensitivity, contribution, and uncertainty checks.",
            },
            {
              title: "Report",
              description: "Defensible record of method and result.",
            },
          ]}
          style={{ marginBottom: 36 }}
        />

        {/* Card */}
        <form onSubmit={handleSubmit}>
          <div
            className="card"
            style={{
              maxWidth: 720,
              margin: "0 auto",
              padding: "40px 44px",
              boxShadow: "var(--shadow-md)",
            }}
          >
            {/* Project name */}
            <div style={{ marginBottom: 32 }}>
              <label htmlFor="projectName" className="label">
                Project Name <span style={{ color: "var(--primary)" }}>*</span>
              </label>
              <input
                id="projectName"
                className="input"
                placeholder="e.g., Vertical Forest 2024 Inventory"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (nameError) setNameError("")
                }}
                autoFocus
              />
              {nameError && (
                <p
                  className="mono"
                  style={{
                    marginTop: 8,
                    fontSize: 11,
                    color: "var(--signal-error, #c0392b)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  {nameError}
                </p>
              )}
            </div>

            {/* Description */}
            <div style={{ marginBottom: 32 }}>
              <label htmlFor="projectDescription" className="label">
                Project Description
              </label>
              <textarea
                id="projectDescription"
                className="input"
                placeholder="Define the boundaries and functional units of this assessment…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                style={{
                  height: "auto",
                  minHeight: 112,
                  padding: "12px 14px",
                  resize: "vertical",
                  fontFamily: "var(--font-ui)",
                  lineHeight: 1.55,
                }}
              />
            </div>

            {/* Methodology + Region */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 24,
                marginBottom: 40,
              }}
            >
              <div>
                <label htmlFor="methodology" className="label">
                  Primary Methodology
                </label>
                <select
                  id="methodology"
                  className="input"
                  value={methodology}
                  onChange={(e) => setMethodology(e.target.value)}
                  style={{ appearance: "auto" }}
                >
                  {METHODOLOGY_FROM_DEMO.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="region" className="label">
                  Regional Context
                </label>
                <select
                  id="region"
                  className="input"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  style={{ appearance: "auto" }}
                >
                  {REGION_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Action row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: 8,
              }}
            >
              <Link
                href="/home"
                className="btn btn-ghost"
                style={{
                  textDecoration: "underline",
                  textUnderlineOffset: 4,
                  padding: "8px 4px",
                }}
              >
                Cancel
              </Link>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                style={{ minWidth: 188 }}
              >
                {submitting ? "Creating…" : "Create Project"}
                <Icon name="chevron-right" size={16} />
              </button>
            </div>
          </div>

          {/* Compliance chip */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: 32,
            }}
          >
            <span
              className="chip chip-emerald chip-mono"
              style={{
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                fontSize: 11,
                padding: "7px 14px",
              }}
            >
              <Icon name="check" size={13} />
              ISO 14040/44 Compliant Framework Architecture
            </span>
          </div>
        </form>

        {/* Footer */}
        <footer
          className="mono"
          style={{
            marginTop: 96,
            textAlign: "center",
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-tertiary)",
          }}
        >
          LCAPIX © 2024 · Privacy Policy · Terms of Service · Documentation ·
          API Status
        </footer>
      </div>
    </div>
  )
}
