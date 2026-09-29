"use client"

/**
 * New Project page — LCAPIX v3.
 *
 * Editorial form derived from the LCAPIX design system (botanical
 * atmosphere + white card + mono labels). The POST endpoint shape
 * (`{ project_name, description }`) is preserved unchanged; the study's
 * scope (functional unit, boundary, impact method, region) is saved onto the
 * new project with a PUT, and runs use the method and region by default.
 */

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Icon, SectionHeader, NumberedRail } from "@/components/lcapix"
import { HelpTip } from "@/components/lcapix/help-tip"
import { ISO_HELP } from "@/components/lcapix/iso-help"
import { apiRequest } from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"
// Only the LCIA methods that actually have characterization factors loaded in
// the database (driver_impact_factors). Offering others (ReCiPe 2016, IPCC 2013,
// EPS 2015, …) would let a user pick a method that silently produces all-zero
// assessments. Keep in sync with the Run Assessment modal's method list.
const METHODOLOGY_OPTIONS = [
  "CML 2001",
  "ReCiPe Midpoint (H)",
  "TRACI 2.1",
] as const

const METHODOLOGY_FROM_DEMO = [...METHODOLOGY_OPTIONS]

// Regions with their own factors (electricity: EPA eGRID US, Ember EU-27,
// Ember global). A region with no factors of its own would silently fall back
// to Global, so it is not offered. Value = the engine's region code.
const REGION_OPTIONS = [
  { value: "Global", label: "Global" },
  { value: "US", label: "United States" },
  { value: "EU", label: "Europe (EU-27)" },
] as const

export default function NewProjectPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [methodology, setMethodology] = useState<string>(METHODOLOGY_OPTIONS[0])
  const [region, setRegion] = useState<string>(REGION_OPTIONS[0].value)
  // ISO 14044 goal & scope, saved onto the project (study-level) after create.
  const [functionalUnit, setFunctionalUnit] = useState("")
  const [boundary, setBoundary] = useState<string>("cradle-to-gate")
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
        // Goal & scope is study-level (ISO 14044 4.2): save what was entered
        // here onto the new project. Best-effort; it can be set on the case too.
        await apiRequest(`/api/projects/${projectId}`, {
          method: "PUT",
          body: JSON.stringify({
            ...(functionalUnit.trim()
              ? { functional_unit: functionalUnit.trim(), system_boundary: boundary }
              : {}),
            // The goal typed here is the study's ISO 14044 4.2.2 goal statement
            // (it also stays the project's description on cards).
            ...(description.trim() ? { goal_statement: description.trim() } : {}),
            lcia_method: methodology,
            region_code: region,
          }),
        }).catch(() => undefined)
        toast({
          title: "Project created",
          description: `"${name.trim()}" is ready. Choose how you want to build the first case.`,
        })
        // Two ways in, offered as equals: build the model by hand, or read it
        // from a document. Landing straight on Import taught that an LCA starts
        // with a file, which is not what a student needs to learn first.
        router.push(`/project/${projectId}/start`)
      } else {
        // A name clash (409) belongs next to the name field, not only in a toast.
        if (res.status === 409 && data?.error) setNameError(data.error)
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
                  role="alert"
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    lineHeight: 1.45,
                    color: "var(--signal-error, #c0392b)",
                  }}
                >
                  {nameError}
                </p>
              )}
            </div>

            {/* Description */}
            <div style={{ marginBottom: 32 }}>
              <label htmlFor="projectDescription" className="label">
                Goal of the study
                <HelpTip label="What goes in the goal?">{ISO_HELP.goal}</HelpTip>
              </label>
              <textarea
                id="projectDescription"
                className="input"
                placeholder="e.g., Which frame material gives the lower-carbon touring bike, and for whom the answer is written."
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

            {/* Functional unit + boundary: ISO 14044 goal & scope, shared by every case */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 24,
                marginBottom: 32,
              }}
            >
              <div>
                <label htmlFor="functionalUnit" className="label">
                  Functional Unit
                  <HelpTip label="What is a functional unit?">{ISO_HELP.functionalUnit}</HelpTip>
                </label>
                <input
                  id="functionalUnit"
                  className="input"
                  placeholder="e.g., 1 touring bicycle, at the factory gate"
                  value={functionalUnit}
                  onChange={(e) => setFunctionalUnit(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="boundary" className="label">
                  System Boundary
                  <HelpTip label="What is a system boundary?">{ISO_HELP.systemBoundary}</HelpTip>
                </label>
                <select
                  id="boundary"
                  className="input"
                  value={boundary}
                  onChange={(e) => setBoundary(e.target.value)}
                  style={{ appearance: "auto" }}
                >
                  <option value="cradle-to-gate">Cradle-to-gate</option>
                  <option value="gate-to-gate">Gate-to-gate</option>
                  <option value="cradle-to-grave">Cradle-to-grave</option>
                </select>
              </div>
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
                  <HelpTip label="What is a methodology?">
                    The impact-assessment method: the set of characterization factors that
                    turns inputs and outputs into impact scores. CML 2001 (Leiden University)
                    is common in Europe, TRACI 2.1 is the US EPA method, and ReCiPe Midpoint
                    (H) uses the default &quot;hierarchist&quot; perspective. You can still
                    choose the method each time you run an assessment; keep one method for
                    every case you compare.
                  </HelpTip>
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
                  <HelpTip label="What does the regional context do?">
                    Where the product is made, part of the study&apos;s scope. Runs use it by
                    default, and each case can be run for another region to compare. Today
                    only electricity has region-specific factors (US: EPA eGRID, EU: Ember,
                    Global: Ember); everything else uses the Global factor, marked &quot;Global
                    (fallback)&quot; in the results.
                  </HelpTip>
                </label>
                <select
                  id="region"
                  className="input"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  style={{ appearance: "auto" }}
                >
                  {REGION_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
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
                disabled={submitting || !name.trim()}
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
          LCAPIX · Privacy Policy · Terms of Service · Documentation · API Status
        </footer>
      </div>
    </div>
  )
}
