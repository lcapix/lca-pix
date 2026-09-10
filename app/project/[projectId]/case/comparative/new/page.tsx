"use client"

/**
 * Create Comparative Case — LCAPIX v3.
 *
 * Editorial picker form following the botanical-atmosphere design
 * system (display-lg, card-section, mono labels, bottom-border inputs).
 *
 * Preserves existing Zustand `addCase` mutation (no backend contract
 * changes). Additionally fetches real base cases from
 * `/api/projects/:id/cases` so the user can link the new comparative
 * case to a real reference case.
 */

import { useEffect, useState } from "react"
import type React from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { useProjectStore } from "@/lib/store"
import { toast } from "sonner"
import { apiRequest } from "@/lib/api-client"
import { transformCaseFromDB } from "@/lib/data-transformers"
import { Breadcrumb, Icon } from "@/components/lcapix"

export default function CreateComparativeCasePage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.projectId as string
  const { addCase, projects } = useProjectStore()

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    baseCaseId: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [baseCases, setBaseCases] = useState<
    Array<{ id: string; name: string }>
  >([])
  const [isLoadingCases, setIsLoadingCases] = useState(true)

  const project = projects.find((p) => p.id === projectId)

  // Fetch existing base cases from the real API so the user can
  // pick a concrete reference for the comparison.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setIsLoadingCases(true)
        const res = await apiRequest(`/api/projects/${projectId}/cases`)
        const data = await res.json()
        if (cancelled) return
        if (data?.success && Array.isArray(data.cases)) {
          const transformed = data.cases
            .map(transformCaseFromDB)
            .filter((c: any) => c.type === "base")
            .map((c: any) => ({ id: c.id, name: c.name }))
          setBaseCases(transformed)
          if (transformed.length > 0) {
            setFormData((f) => ({ ...f, baseCaseId: transformed[0].id }))
          }
        }
      } catch (err) {
        // Silent failure: Zustand-only mode still lets users save.
        console.warn("Could not load base cases from API:", err)
      } finally {
        if (!cancelled) setIsLoadingCases(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId])

  const isFormValid = formData.name.trim().length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid) {
      toast.error("Please enter a case name")
      return
    }
    setIsSubmitting(true)
    try {
      // POST to the real API — source of truth is AWS RDS.
      const res = await apiRequest(`/api/projects/${projectId}/cases`, {
        method: "POST",
        body: JSON.stringify({
          case_name: formData.name.trim(),
          case_type: "comparative",
          description: formData.description.trim() || null,
          parent_case_id: formData.baseCaseId ? Number(formData.baseCaseId) : null,
        }),
      })
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText)
        throw new Error(msg || `POST failed (${res.status})`)
      }
      const data = await res.json().catch(() => ({}))
      const newId = data?.case?.case_id ?? data?.case_id
      // Mirror to Zustand for optimistic UI
      const caseData = {
        id: newId ? String(newId) : crypto.randomUUID(),
        projectId,
        name: formData.name.trim(),
        description: formData.description.trim(),
        type: "comparative" as const,
      }
      addCase(projectId, caseData)
      toast.success("Comparative case created")
      router.push(`/project/${projectId}/case/${caseData.id}`)
    } catch (error: any) {
      console.error("Error creating comparative case:", error)
      toast.error(error?.message || "Failed to create comparative case")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="botanical-atmosphere"
      style={{
        minHeight: "calc(100vh - 64px)",
        padding: "0 0 96px",
        background: "var(--surface-base)",
      }}
    >
      <Breadcrumb
        items={[
          { label: "Projects", page: "home" },
          {
            label: project?.name || "Project",
            page: `/project/${projectId}`,
          },
          { label: "Create Comparative Case" },
        ]}
      />

      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "28px 32px 0",
          position: "relative",
        }}
      >
        {/* Header — compact + left-aligned to match the project page chrome. */}
        <header style={{ marginBottom: 28 }}>
          <div
            className="eyebrow"
            style={{ color: "var(--brand-primary)", marginBottom: 10 }}
          >
            Alternative scenario
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 30,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "var(--text-primary)",
            }}
          >
            Create Comparative Case
          </h1>
          <p
            className="body"
            style={{
              margin: "12px 0 0",
              maxWidth: 620,
              color: "var(--text-secondary)",
            }}
          >
            Define an alternative scenario to compare against your baseline
            case. This precision modeling tool helps isolate variables for
            sustainable decision-making.
          </p>
        </header>

        <form onSubmit={handleSubmit}>
          {/* CASE IDENTITY */}
          <section
            className="card-section"
            style={{
              padding: "32px 36px",
              marginBottom: 20,
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 24,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--brand-subtle)",
                  color: "var(--primary)",
                }}
              >
                <Icon name="shield" size={15} />
              </span>
              <span className="eyebrow">Case Identity</span>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label htmlFor="caseName" className="label">
                Alternative Case Name
              </label>
              <input
                id="caseName"
                className="input"
                placeholder="e.g., Bio-Based Polymer Scenario 01"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                maxLength={80}
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="caseDescription" className="label">
                Scenario Description
              </label>
              <textarea
                id="caseDescription"
                className="input"
                placeholder="Provide context on the methodology or material shifts being tested…"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
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
          </section>

          {/* BASELINE SELECTION */}
          <section
            className="card-section"
            style={{
              padding: "32px 36px",
              marginBottom: 20,
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 24,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--brand-subtle)",
                  color: "var(--primary)",
                }}
              >
                <Icon name="link" size={15} />
              </span>
              <span className="eyebrow">Baseline Selection</span>
            </div>

            <label htmlFor="baseCaseId" className="label">
              Select Reference Case
            </label>
            <select
              id="baseCaseId"
              className="input"
              value={formData.baseCaseId}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  baseCaseId: e.target.value,
                }))
              }
              style={{ appearance: "auto" }}
              disabled={isLoadingCases}
            >
              {isLoadingCases && <option value="">Loading base cases…</option>}
              {!isLoadingCases && baseCases.length === 0 && (
                <option value="">No base cases found for this project</option>
              )}
              {!isLoadingCases &&
                baseCases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </section>

          {/* Action footer */}
          <div
            className="card-section"
            style={{
              padding: "20px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <Link
              href={`/project/${projectId}`}
              className="mono"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--text-tertiary)",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              <Icon name="x" size={13} /> Cancel Scenario
            </Link>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!isFormValid || isSubmitting}
              style={{ minWidth: 220 }}
            >
              {isSubmitting ? "Creating…" : "Create Comparative Case"}
              <Icon name="chevron-right" size={16} />
            </button>
          </div>
        </form>

        {/* Informational footer card */}
        <div
          className="card-section"
          style={{
            marginTop: 24,
            padding: "20px 24px",
            display: "flex",
            gap: 14,
            alignItems: "flex-start",
            background: "var(--brand-subtle)",
            boxShadow: "none",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              width: 28,
              height: 28,
              borderRadius: 6,
              alignItems: "center",
              justifyContent: "center",
              background: "var(--surface-raised)",
              color: "var(--primary)",
              flexShrink: 0,
            }}
          >
            <Icon name="leaf" size={15} />
          </span>
          <p
            className="body"
            style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}
          >
            Comparative cases allow you to model alternative scenarios,
            processes, or materials to identify which options have better
            environmental performance. By linking to a baseline, the system
            automatically calculates the delta in CO<sub>2</sub>e, water usage,
            and toxicity levels.
          </p>
        </div>
      </div>
    </div>
  )
}
