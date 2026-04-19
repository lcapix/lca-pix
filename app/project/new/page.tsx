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
import { Icon } from "@/components/lcapix"
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
      if (data?.success && data?.project_id) {
        toast({
          title: "Project created",
          description: `"${name.trim()}" is ready.`,
        })
        router.push(`/project/${data.project_id}`)
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
      className="botanical-atmosphere"
      style={{
        minHeight: "calc(100vh - 64px)",
        position: "relative",
        padding: "48px 32px 96px",
        background: "var(--surface-base)",
      }}
    >
      {/* Subtle centered glow behind the card */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 180,
          left: "50%",
          transform: "translateX(-50%)",
          width: 820,
          height: 520,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, var(--brand-glow), transparent 62%)",
          pointerEvents: "none",
          zIndex: 0,
          opacity: 0.9,
        }}
      />

      <div style={{ maxWidth: 840, margin: "0 auto", position: "relative", zIndex: 1 }}>
        {/* Back link */}
        <div style={{ marginBottom: 40 }}>
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

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h1
            className="display-lg"
            style={{
              margin: 0,
              color: "var(--text-primary)",
              letterSpacing: "-0.03em",
            }}
          >
            Create New LCA Project
          </h1>
          <p
            className="body"
            style={{
              margin: "20px auto 0",
              maxWidth: 560,
              color: "var(--text-secondary)",
            }}
          >
            Define your project scope to begin building your process hierarchy
            with precision-engineered environmental modeling.
          </p>
        </div>

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
