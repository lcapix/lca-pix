"use client"

/**
 * Compare Cases — LCAPIX v3.
 *
 * Picker-based layout per the updated mockup: left sub-rail navigation,
 * two real-case selectors, side-by-side impact cards, top-categories
 * breakdown, financial delta table, and a dynamic verdict callout.
 *
 * Data: real — `/api/projects/:id/cases` for the picker list,
 * `/api/cases/:id/assessments` + `/api/cases/:id/components` for
 * per-case impact + cost totals. The existing "run comparison" route
 * (`/project/:id/comparison?cases=...`) is still linked from the
 * "View full comparison" CTA so we don't break that flow.
 */

import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { apiRequest } from "@/lib/api-client"
import { transformCaseFromDB } from "@/lib/data-transformers"
import { toast } from "sonner"
import { Icon, MiniBar, fmtNum } from "@/components/lcapix"

interface PickableCase {
  id: string
  name: string
  type: "base" | "comparative"
}

interface CaseImpact {
  caseId: string
  name: string
  type: "base" | "comparative"
  total: number // kg CO2-eq (or sum of categories)
  unit: string
  categories: Array<{ name: string; value: number; unit: string }>
  costs: {
    labor: number
    energy: number
    material: number
    total: number
  }
}

export default function ComparisonsPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  const [cases, setCases] = useState<PickableCase[]>([])
  const [isLoadingCases, setIsLoadingCases] = useState(true)

  const [baseId, setBaseId] = useState<string>("")
  const [compId, setCompId] = useState<string>("")

  const [baseImpact, setBaseImpact] = useState<CaseImpact | null>(null)
  const [compImpact, setCompImpact] = useState<CaseImpact | null>(null)
  const [isLoadingImpacts, setIsLoadingImpacts] = useState(false)

  // ——— Fetch cases list ——————————————————————————————
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setIsLoadingCases(true)
        const res = await apiRequest(`/api/projects/${projectId}/cases`)
        const data = await res.json()
        if (cancelled) return
        if (data?.success && Array.isArray(data.cases)) {
          const list: PickableCase[] = data.cases
            .map(transformCaseFromDB)
            .map((c: any) => ({ id: c.id, name: c.name, type: c.type }))
          setCases(list)
          const firstBase = list.find((c) => c.type === "base")
          const firstComp = list.find((c) => c.type === "comparative")
          if (firstBase) setBaseId(firstBase.id)
          if (firstComp) setCompId(firstComp.id)
        }
      } catch (err) {
        console.error("Failed to fetch cases:", err)
        toast.error("Failed to load cases")
      } finally {
        if (!cancelled) setIsLoadingCases(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId])

  // ——— Fetch impact + cost data for the two selected cases ————
  useEffect(() => {
    if (!baseId || !compId) return
    let cancelled = false
    ;(async () => {
      setIsLoadingImpacts(true)
      try {
        const [base, comp] = await Promise.all([
          fetchImpactForCase(baseId, cases),
          fetchImpactForCase(compId, cases),
        ])
        if (cancelled) return
        setBaseImpact(base)
        setCompImpact(comp)
      } catch (err) {
        console.error("Failed to load impact data:", err)
      } finally {
        if (!cancelled) setIsLoadingImpacts(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [baseId, compId, cases])

  const swap = () => {
    setBaseId(compId)
    setCompId(baseId)
  }

  // ——— Derived deltas for verdict copy ——————————————————
  const verdict = useMemo(() => {
    if (!baseImpact || !compImpact) return null
    const gwpBase =
      baseImpact.categories.find((c) =>
        /warming|gwp|climate/i.test(c.name)
      )?.value ?? baseImpact.total
    const gwpComp =
      compImpact.categories.find((c) =>
        /warming|gwp|climate/i.test(c.name)
      )?.value ?? compImpact.total
    const gwpDelta =
      gwpBase > 0 ? ((gwpComp - gwpBase) / gwpBase) * 100 : 0
    const matBase = baseImpact.costs.material
    const matComp = compImpact.costs.material
    const matDelta = matBase > 0 ? ((matComp - matBase) / matBase) * 100 : 0
    return { gwpDelta, matDelta }
  }, [baseImpact, compImpact])

  return (
    <div
      className="botanical-atmosphere"
      style={{
        minHeight: "calc(100vh - 64px)",
        display: "grid",
        gridTemplateColumns: "220px 1fr",
        gap: 0,
        background: "var(--surface-base)",
      }}
    >
      {/* ——— Sub-rail ——— */}
      <aside
        style={{
          borderRight: "1px solid var(--border-subtle)",
          padding: "32px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          background: "var(--surface-base)",
          minHeight: "calc(100vh - 64px)",
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--text-tertiary)",
            marginBottom: 4,
          }}
        >
          LCA Platform
        </div>
        <div
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--primary)",
            marginBottom: 24,
            fontWeight: 600,
          }}
        >
          Precision Data
        </div>

        <SubRailItem
          icon="grid"
          label="Overview"
          onClick={() => router.push(`/project/${projectId}`)}
        />
        <SubRailItem
          icon="layers"
          label="Case Studies"
          onClick={() => router.push(`/project/${projectId}`)}
        />
        <SubRailItem
          icon="chart-bar"
          label="Impact Models"
          onClick={() => router.push(`/project/${projectId}/analytics`)}
        />
        <SubRailItem icon="activity" label="Comparison" active />

        <div style={{ flex: 1 }} />

        <button
          className="btn btn-primary"
          onClick={() =>
            router.push(`/project/${projectId}/case/comparative/new`)
          }
          style={{ width: "100%", justifyContent: "center" }}
        >
          <Icon name="plus" size={15} /> New Assessment
        </button>
      </aside>

      {/* ——— Main ——— */}
      <main style={{ padding: "40px 48px 96px", overflowX: "hidden" }}>
        <header style={{ marginBottom: 32 }}>
          <h1 className="display-lg" style={{ margin: 0 }}>
            Compare Cases
          </h1>
          <p
            className="body"
            style={{ margin: "16px 0 0", maxWidth: 640 }}
          >
            Select a baseline and an optimized scenario to visualize their
            environmental impact, top category contributors, and financial
            delta side-by-side.
          </p>
        </header>

        {/* Picker */}
        <div
          className="card-section"
          style={{
            padding: "24px 28px",
            marginBottom: 28,
            display: "grid",
            gridTemplateColumns: "1fr 48px 1fr",
            gap: 20,
            alignItems: "end",
          }}
        >
          <div>
            <label htmlFor="baseSelect" className="label">
              Base Case
            </label>
            <select
              id="baseSelect"
              className="input"
              value={baseId}
              onChange={(e) => setBaseId(e.target.value)}
              style={{ appearance: "auto" }}
              disabled={isLoadingCases}
            >
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={swap}
            aria-label="Swap cases"
            title="Swap cases"
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--brand-subtle)",
              color: "var(--primary)",
              border: "none",
              cursor: "pointer",
              margin: "0 auto",
              marginBottom: 2,
            }}
          >
            <Icon name="refresh" size={18} />
          </button>
          <div>
            <label htmlFor="compSelect" className="label">
              Comparative Case
            </label>
            <select
              id="compSelect"
              className="input"
              value={compId}
              onChange={(e) => setCompId(e.target.value)}
              style={{ appearance: "auto" }}
              disabled={isLoadingCases}
            >
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Impact cards */}
        {baseImpact && compImpact && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 24,
              marginBottom: 28,
            }}
          >
            <ImpactCard
              chipLabel="Assessed"
              chipVariant="neutral"
              impact={baseImpact}
            />
            <ImpactCard
              chipLabel="Optimized"
              chipVariant="emerald"
              impact={compImpact}
            />
          </div>
        )}

        {/* Financial delta */}
        {baseImpact && compImpact && (
          <section
            className="card-section"
            style={{ padding: "28px 32px", marginBottom: 28 }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 20,
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
                <Icon name="dollar" size={15} />
              </span>
              <span className="eyebrow">Financial Delta Analysis</span>
            </div>

            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
              }}
            >
              <thead>
                <tr>
                  <th style={thStyle}>Cost Driver</th>
                  <th style={thStyle}>Baseline ($/Unit)</th>
                  <th style={thStyle}>Optimized ($/Unit)</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>
                    Numeric Delta
                  </th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["Labor", baseImpact.costs.labor, compImpact.costs.labor],
                    [
                      "Energy",
                      baseImpact.costs.energy,
                      compImpact.costs.energy,
                    ],
                    [
                      "Material",
                      baseImpact.costs.material,
                      compImpact.costs.material,
                    ],
                  ] as Array<[string, number, number]>
                ).map(([driver, b, c]) => {
                  const delta = c - b
                  const positive = delta > 0
                  return (
                    <tr
                      key={driver}
                      style={{
                        borderTop: "1px solid var(--border-subtle)",
                      }}
                    >
                      <td style={tdStyle}>{driver}</td>
                      <td style={{ ...tdStyle, fontFamily: "var(--font-mono)" }}>
                        ${fmtNum(b, 2)}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: "var(--font-mono)" }}>
                        ${fmtNum(c, 2)}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "right",
                          fontFamily: "var(--font-mono)",
                          color: positive
                            ? "var(--signal-error)"
                            : "var(--signal-success)",
                          fontWeight: 600,
                        }}
                      >
                        {positive ? "+" : ""}
                        ${fmtNum(delta, 2)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        )}

        {/* Verdict */}
        {baseImpact && compImpact && verdict && (
          <section
            style={{
              background: "var(--surface-raised)",
              borderLeft: "4px solid var(--primary)",
              borderRadius: "var(--r-lg)",
              padding: "20px 24px",
              display: "flex",
              gap: 16,
              alignItems: "flex-start",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                width: 32,
                height: 32,
                borderRadius: 8,
                alignItems: "center",
                justifyContent: "center",
                background: "var(--brand-subtle)",
                color: "var(--primary)",
                flexShrink: 0,
              }}
            >
              <Icon name="target" size={17} />
            </span>
            <p className="body" style={{ margin: 0, lineHeight: 1.6 }}>
              <strong>{compImpact.name}</strong>{" "}
              {verdict.gwpDelta < 0 ? "reduces" : "increases"} Global Warming
              Potential by{" "}
              <strong>
                {fmtNum(Math.abs(verdict.gwpDelta), 1)}%
              </strong>{" "}
              with a{" "}
              <strong>
                {verdict.matDelta >= 0 ? "" : "-"}
                {fmtNum(Math.abs(verdict.matDelta), 1)}%{" "}
                {verdict.matDelta >= 0 ? "increase" : "decrease"}
              </strong>{" "}
              in Material costs. The environmental trade-off{" "}
              {verdict.gwpDelta < 0
                ? "significantly outweighs"
                : "must be weighed against"}{" "}
              the operational premium in current sustainability portfolios.
            </p>
          </section>
        )}

        {isLoadingImpacts && !baseImpact && (
          <div
            className="card-section"
            style={{ padding: 48, textAlign: "center" }}
          >
            <p className="body" style={{ margin: 0 }}>
              Loading impact data…
            </p>
          </div>
        )}

        {cases.length > 0 && (
          <div style={{ marginTop: 32, textAlign: "right" }}>
            <Link
              href={`/project/${projectId}/comparison?cases=${baseId},${compId}`}
              className="btn btn-secondary"
            >
              View full comparison
              <Icon name="arrow-up-right" size={14} />
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}

// ——— Helpers ——————————————————————————————————————————

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "8px 0",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--text-tertiary)",
  fontWeight: 500,
}
const tdStyle: CSSProperties = {
  padding: "12px 0",
  color: "var(--text-primary)",
}

function SubRailItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: any
  label: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        border: "none",
        background: active ? "var(--brand-subtle)" : "transparent",
        color: active ? "var(--primary)" : "var(--text-secondary)",
        fontFamily: "var(--font-ui)",
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        borderRadius: 6,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <Icon name={icon} size={15} />
      {label}
    </button>
  )
}

function ImpactCard({
  chipLabel,
  chipVariant,
  impact,
}: {
  chipLabel: string
  chipVariant: "neutral" | "emerald"
  impact: CaseImpact
}) {
  const top = [...impact.categories]
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
  const max = top[0]?.value || 1
  return (
    <div
      className="card-section"
      style={{ padding: "28px 30px", position: "relative" }}
    >
      <span
        className={`chip ${
          chipVariant === "emerald" ? "chip-emerald" : ""
        } chip-mono`}
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontSize: 10,
        }}
      >
        {chipLabel}
      </span>

      <div
        className="mono"
        style={{
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
          marginBottom: 6,
        }}
      >
        Case ID · {impact.caseId}
      </div>
      <h2
        style={{
          margin: 0,
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "var(--text-primary)",
          letterSpacing: "-0.01em",
        }}
      >
        {impact.name}
      </h2>

      <div style={{ marginTop: 24 }}>
        <div
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-tertiary)",
            marginBottom: 8,
          }}
        >
          Total Environmental Impact
        </div>
        <div
          className="mono"
          style={{
            fontSize: "2rem",
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          {fmtNum(impact.total, 2)}{" "}
          <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
            {impact.unit}
          </span>
        </div>
      </div>

      <hr className="divider-tonal" style={{ margin: "24px 0 20px" }} />

      <div
        className="mono"
        style={{
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
          marginBottom: 12,
        }}
      >
        Top Impact Categories
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {top.length === 0 && (
          <p className="body" style={{ margin: 0, fontSize: 13 }}>
            No impact categories recorded.
          </p>
        )}
        {top.map((cat) => {
          const pct = max > 0 ? (cat.value / max) * 100 : 0
          return (
            <div key={cat.name}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 13 }}>{cat.name}</span>
                <span
                  className="mono"
                  style={{ fontSize: 12, color: "var(--text-secondary)" }}
                >
                  {fmtNum(pct, 1)}%
                </span>
              </div>
              <MiniBar value={pct} max={100} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ——— API aggregator ———————————————————————————————————

async function fetchImpactForCase(
  caseId: string,
  caseList: PickableCase[]
): Promise<CaseImpact> {
  const meta = caseList.find((c) => c.id === caseId)

  // Impact — latest assessment run
  let categories: CaseImpact["categories"] = []
  let total = 0
  let unit = "kg CO₂-eq"
  try {
    const res = await apiRequest(`/api/cases/${caseId}/assessments`)
    const data = await res.json()
    if (data?.success && Array.isArray(data.assessments) && data.assessments.length > 0) {
      const latest = data.assessments[0]
      // Two possible response shapes — fall back gracefully.
      const impacts: Record<string, { value: number; unit: string }> =
        latest.impacts ?? {}
      Object.entries(impacts).forEach(([name, payload]: any) => {
        const v = Number(payload?.value ?? 0)
        categories.push({
          name,
          value: isFinite(v) ? v : 0,
          unit: payload?.unit ?? unit,
        })
      })
      if (categories.length === 0 && latest.run_id) {
        // Try the per-run results endpoint as a secondary source.
        try {
          const r2 = await apiRequest(`/api/assessments/${latest.run_id}`)
          const d2 = await r2.json()
          if (d2?.success && Array.isArray(d2.total_impacts)) {
            d2.total_impacts.forEach((i: any) => {
              const v = parseFloat(i.impact_value) || 0
              categories.push({
                name: i.category_name,
                value: v,
                unit: i.unit || unit,
              })
            })
          }
        } catch {
          /* ignore secondary failure */
        }
      }
      total = categories.reduce((s, c) => s + c.value, 0)
      unit = categories[0]?.unit ?? unit
    }
  } catch (err) {
    console.warn("assessments fetch failed", err)
  }

  // Costs — aggregate from components
  const costs = { labor: 0, energy: 0, material: 0, total: 0 }
  try {
    const res = await apiRequest(`/api/cases/${caseId}/components`)
    const data = await res.json()
    if (data?.success && Array.isArray(data.components)) {
      data.components.forEach((c: any) => {
        costs.labor += parseFloat(c.labor_cost) || 0
        costs.energy += parseFloat(c.energy_cost) || 0
        costs.material += parseFloat(c.material_cost) || 0
        const capex = parseFloat(c.capex) || 0
        const opex = parseFloat(c.opex) || 0
        costs.total += capex + opex
      })
    }
  } catch (err) {
    console.warn("components fetch failed", err)
  }

  return {
    caseId,
    name: meta?.name ?? `Case ${caseId}`,
    type: meta?.type ?? "base",
    total,
    unit,
    categories,
    costs,
  }
}
