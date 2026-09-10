"use client"

/**
 * Create Base Case — LCAPIX v3.
 *
 * Rewritten to match the LCAPIX design system used elsewhere
 * (display-lg, card-section, eyebrow, btn btn-primary, brand-subtle
 * info cards). Replaces the leftover shadcn Card/Input/Button leftovers
 * + blue info box that broke aesthetic consistency with the auth pages
 * and the comparative-case form.
 *
 * Preserves all existing behavior:
 *   - POST to /api/projects/{id}/cases
 *   - Zustand mirror for optimistic UI
 *   - Toast on success/failure
 *   - Router push to the case editor on success
 */

import { useState } from "react"
import type React from "react"

import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { useProjectStore } from "@/lib/store"
import { toast } from "sonner"
import { apiRequest } from "@/lib/api-client"
import { Breadcrumb, Icon } from "@/components/lcapix"

export default function CreateBaseCasePage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.projectId as string
  const { addCase, projects } = useProjectStore()

  const [formData, setFormData] = useState({
    name: "",
    description: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const project = projects.find((p) => p.id === projectId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error("Please enter a case name")
      return
    }

    setIsSubmitting(true)

    try {
      // POST to real API — source of truth is AWS RDS.
      const res = await apiRequest(`/api/projects/${projectId}/cases`, {
        method: "POST",
        body: JSON.stringify({
          case_name: formData.name.trim(),
          case_type: "base",
          description: formData.description.trim() || null,
        }),
      })
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText)
        throw new Error(msg || `POST failed (${res.status})`)
      }
      const data = await res.json().catch(() => ({}))
      const newId = data?.case?.case_id ?? data?.case_id
      const caseId = newId ? String(newId) : crypto.randomUUID()

      // Mirror to Zustand for optimistic UI
      addCase(projectId, {
        id: caseId,
        projectId,
        name: formData.name.trim(),
        description: formData.description.trim(),
        type: "base" as const,
      })

      toast.success("Base case created")
      router.push(`/project/${projectId}/case/${caseId}`)
    } catch (error: any) {
      console.error("Error creating base case:", error)
      toast.error(error?.message || "Failed to create base case")
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFormValid = formData.name.trim().length > 0

  return (
    <div
      className="botanical-atmosphere"
      style={{
        minHeight: "calc(100vh - 64px)",
        padding: "0 0 96px",
        background: "var(--surface-base)",
        position: "relative",
        overflow: "hidden",
        isolation: "isolate",
      }}
    >
      {/* Subtle aurora wash to echo the auth-page aesthetic — keeps the form
          readable while the page no longer feels like a flat white sheet. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: -1,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-15%",
            right: "-10%",
            width: 720,
            height: 720,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(56, 142, 102, 0.18), transparent 65%)",
            filter: "blur(80px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-20%",
            left: "-10%",
            width: 640,
            height: 640,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(91, 191, 139, 0.14), transparent 65%)",
            filter: "blur(90px)",
          }}
        />
        {/* Dot grid with radial mask, matches auth hero */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle at 1px 1px, color-mix(in oklab, var(--text-primary) 30%, transparent) 1px, transparent 0)",
            backgroundSize: "24px 24px",
            opacity: 0.18,
            maskImage:
              "radial-gradient(70% 55% at 50% 30%, black 30%, transparent 85%)",
            WebkitMaskImage:
              "radial-gradient(70% 55% at 50% 30%, black 30%, transparent 85%)",
          }}
        />
      </div>

      <Breadcrumb
        items={[
          { label: "Projects", page: "home" },
          {
            label: project?.name || "Project",
            page: `/project/${projectId}`,
          },
          { label: "Create Base Case" },
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
            Reference scenario
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
            Create your Base Case
          </h1>
          <p
            className="body"
            style={{
              margin: "12px 0 0",
              maxWidth: 620,
              color: "var(--text-secondary)",
            }}
          >
            Define the current-state scenario your comparative cases will be
            measured against. The base case is your zero-line — the version of
            the process you want to improve on.
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
                Base case name
              </label>
              <input
                id="caseName"
                className="input"
                placeholder="e.g., Current production process"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                maxLength={60}
                autoFocus
              />
              <p
                className="mono"
                style={{
                  fontSize: 11,
                  marginTop: 8,
                  color: "var(--text-tertiary)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {formData.name.length}/60 characters
              </p>
            </div>

            <div>
              <label htmlFor="caseDescription" className="label">
                Scenario description
              </label>
              <textarea
                id="caseDescription"
                className="input"
                placeholder="Key processes, materials, assumptions — anything a teammate would need to reproduce the model."
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
              <p
                style={{
                  fontSize: 12,
                  marginTop: 8,
                  color: "var(--text-tertiary)",
                }}
              >
                Optional, but recommended.
              </p>
            </div>
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
              <Icon name="x" size={13} /> Cancel
            </Link>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!isFormValid || isSubmitting}
              style={{ minWidth: 220 }}
            >
              {isSubmitting ? "Creating…" : "Create Base Case"}
              <Icon name="chevron-right" size={16} />
            </button>
          </div>
        </form>

        {/* Informational footer card — brand-subtle, replaces the old blue
            tailwind callout that broke the LCAPIX aesthetic. */}
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
          <div>
            <p
              className="body"
              style={{
                margin: 0,
                fontSize: 13,
                lineHeight: 1.6,
                color: "var(--text-primary)",
                fontWeight: 600,
              }}
            >
              What is a base case?
            </p>
            <p
              className="body"
              style={{
                margin: "6px 0 0",
                fontSize: 13,
                lineHeight: 1.6,
                color: "var(--text-secondary)",
              }}
            >
              Your base case is the reference scenario every comparative case
              is measured against — typically your current process or standard
              practice. Each base case models one product end-to-end so the
              CO<sub>2</sub>e, cost, and resource deltas stay focused.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
