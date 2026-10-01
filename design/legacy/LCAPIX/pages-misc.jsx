// pages-results.jsx — Results, Component form, Analytics/Compare, Admin, About/Guide

// ——— Results page ———
function ResultsPage({ projectId = 'ev-mfg', caseId = 'baseline-2025', onNav }) {
  const project = DEMO_PROJECTS.find(p => p.id === projectId) || DEMO_PROJECTS[0];
  const c = DEMO_CASES.find(x => x.id === caseId) || DEMO_CASES[0];
  const [activeCat, setActiveCat] = React.useState('gwp');
  const cat = DEMO_CATEGORIES.find(x => x.id === activeCat);

  return (
    <div className="app-shell">
      <AppTopBar current="home" onNav={onNav}/>
      <Breadcrumb items={[
        { label: 'Projects', page: 'home' },
        { label: project.name, onClick: () => onNav('project', { projectId: project.id }) },
        { label: c.name, onClick: () => onNav('case', { projectId: project.id, caseId: c.id }) },
        { label: 'Results' },
      ]} onNav={onNav}/>

      <div style={{ padding: '24px 32px 80px', maxWidth: 1440, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24, gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h1 className="display" style={{ fontSize: 26, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>Assessment Results</h1>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>{c.name} · last run 3h ago</div>
          </div>
          <div className="chip"><Icon name="layers" size={12}/> Method: CML 2001</div>
          <div className="chip"><Icon name="globe" size={12}/> Region: US Grid</div>
          <button className="btn btn-secondary btn-sm"><Icon name="download" size={14}/> Export PDF</button>
          <button className="btn btn-primary btn-sm"><Icon name="run" size={14}/> Run new</button>
        </div>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
          {[
            { l: 'COMPONENTS ASSESSED', v: '5 / 5', s: 'success' },
            { l: 'DRIVER FLOWS', v: '13', s: 'info' },
            { l: 'IMPACT CATEGORIES', v: '6', s: 'info' },
            { l: 'LAST RUN', v: '3h ago', s: 'info' },
          ].map(k => (
            <div key={k.l} className="card" style={{ padding: 18 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>{k.l}</div>
              <div className="mono" style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)' }}>{k.v}</div>
            </div>
          ))}
        </div>

        {/* Row 1 — Impact overview */}
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 20, paddingBottom: 4 }}>
            {DEMO_CATEGORIES.map(ct => (
              <button key={ct.id} onClick={() => setActiveCat(ct.id)} className={'chip ' + (activeCat === ct.id ? 'chip-active' : '')} style={{ cursor: 'pointer', border: 'none', fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap' }}>{ct.name}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 32, alignItems: 'center' }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 10 }}>TOTAL · {cat.name.toUpperCase()}</div>
              <div className="mono" style={{ fontSize: 56, fontWeight: 600, color: 'var(--brand-primary)', lineHeight: 1, letterSpacing: '-0.02em' }}>
                {cat.value < 0.01 ? cat.value.toExponential(2) : fmtNum(cat.value, cat.value < 1 ? 4 : 2)}
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 6 }}>{cat.unit}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, color: 'var(--signal-success)', fontSize: 13 }}>
                <Icon name="arrow-down" size={14}/>
                <span className="mono">−2.1%</span>
                <span style={{ color: 'var(--text-tertiary)' }}>vs Apr 11 run</span>
              </div>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 10 }}>COMPONENT CONTRIBUTION</div>
              <div style={{ display: 'flex', height: 44, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                {DEMO_CONTRIBUTORS.map((c, i) => (
                  <div key={c.id} style={{ flex: c.pct, background: `var(--chart-${(i % 5) + 1})`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', borderRight: i < DEMO_CONTRIBUTORS.length - 1 ? '1px solid var(--surface-base)' : 'none' }} title={`${c.name}: ${c.pct}%`}>
                    <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: 'oklch(0.15 0.01 240)' }}>{fmtNum(c.pct, 0)}%</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {DEMO_CONTRIBUTORS.map((c, i) => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: `var(--chart-${(i % 5) + 1})` }}/>
                    <span style={{ color: 'var(--text-secondary)' }}>{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Row 2 — chart + contributors */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Impact by category</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }} className="mono">log scale</span>
            </div>
            <CategoryBarChart/>
          </div>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Top contributors</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {DEMO_CONTRIBUTORS.map((c, i) => (
                <div key={c.id}>
                  <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 12, marginBottom: 4 }}>
                    <span className="mono" style={{ color: 'var(--text-tertiary)', marginRight: 6, width: 16 }}>{i + 1}</span>
                    <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{c.name}</span>
                    <span className="mono" style={{ color: 'var(--text-primary)' }}>{fmtNum(c.value, 1)}</span>
                  </div>
                  <MiniBar value={c.pct} max={40} height={5}/>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 3 — Flow table */}
        <div className="card" style={{ padding: 0, marginBottom: 20, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Flow-level detail</span>
            <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-tertiary)' }}><span className="mono">{DEMO_FLOWS.length}</span> flows</span>
            <div style={{ flex: 1 }}/>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="chip" style={{ fontSize: 11 }}><Icon name="filter" size={10}/> Component</button>
              <button className="chip" style={{ fontSize: 11 }}>Direction</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 80px 100px 80px 100px 100px', padding: '10px 20px', background: 'var(--surface-overlay)', fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
            <div>Component</div>
            <div>Substance</div>
            <div>Dir</div>
            <div style={{ textAlign: 'right' }}>Amount</div>
            <div>Unit</div>
            <div style={{ textAlign: 'right' }}>Factor</div>
            <div style={{ textAlign: 'right' }}>Impact</div>
          </div>
          {DEMO_FLOWS.map(f => (
            <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 80px 100px 80px 100px 100px', padding: '10px 20px', borderTop: '1px solid var(--border-subtle)', fontSize: 12, alignItems: 'center' }}>
              <div style={{ color: 'var(--text-secondary)' }}>{f.component}</div>
              <div style={{ color: 'var(--text-primary)' }}>{f.substance}</div>
              <div><span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: f.dir === 'IN' ? 'oklch(from var(--signal-info) l c h / 0.18)' : 'oklch(from var(--signal-warn) l c h / 0.18)', color: f.dir === 'IN' ? 'var(--signal-info)' : 'var(--signal-warn)', fontWeight: 600 }}>{f.dir}</span></div>
              <div className="mono" style={{ textAlign: 'right' }}>{fmtNum(f.amount, 2)}</div>
              <div style={{ color: 'var(--text-tertiary)' }}>{f.unit}</div>
              <div className="mono" style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}>{fmtNum(f.factor, 3)}</div>
              <div className="mono" style={{ textAlign: 'right', color: 'var(--brand-primary)', fontWeight: 500 }}>{fmtNum(f.impact, 2)}</div>
            </div>
          ))}
        </div>

        {/* Historical runs */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Historical runs</span>
            <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>{DEMO_RUNS.length} runs over 5 weeks</span>
            <div style={{ flex: 1 }}/>
            <button className="chip chip-active" style={{ fontSize: 11, cursor: 'pointer', border: 'none' }}>Compare to last run</button>
          </div>
          <RunTimeline runs={DEMO_RUNS}/>
        </div>
      </div>
    </div>
  );
}

function CategoryBarChart() {
  const max = Math.max(...DEMO_CATEGORIES.map(c => Math.log10(c.value + 0.00001) + 10));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {DEMO_CATEGORIES.map((c, i) => {
        const v = Math.log10(c.value + 0.00001) + 10;
        const pct = Math.max(2, (v / max) * 100);
        return (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 150, fontSize: 12, color: 'var(--text-secondary)' }}>{c.name}</div>
            <div style={{ flex: 1, height: 24, background: 'var(--surface-overlay)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'var(--brand-primary)', opacity: 1 - i * 0.08, transition: 'width 400ms' }}/>
            </div>
            <div className="mono" style={{ width: 100, fontSize: 12, textAlign: 'right', color: 'var(--text-primary)' }}>
              {c.value < 0.01 ? c.value.toExponential(1) : fmtNum(c.value, c.value < 1 ? 3 : 2)}
            </div>
            <div style={{ width: 80, fontSize: 10, color: 'var(--text-tertiary)' }}>{c.unit}</div>
          </div>
        );
      })}
    </div>
  );
}

function RunTimeline({ runs }) {
  const max = Math.max(...runs.map(r => r.value));
  const min = Math.min(...runs.map(r => r.value));
  const W = 900, H = 140, padX = 40, padY = 20;
  const innerW = W - padX * 2, innerH = H - padY * 2;
  const pts = runs.map((r, i) => {
    const x = padX + (i / (runs.length - 1)) * innerW;
    const y = padY + ((max - r.value) / (max - min)) * innerH;
    return { ...r, x, y };
  });
  const line = pts.map((p, i) => (i === 0 ? 'M' : 'L') + ` ${p.x} ${p.y}`).join(' ');
  const area = line + ` L ${pts[pts.length - 1].x} ${H - padY} L ${padX} ${H - padY} Z`;

  return (
    <div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <path d={area} fill="var(--brand-primary)" opacity="0.12"/>
        <path d={line} fill="none" stroke="var(--brand-primary)" strokeWidth="1.5"/>
        {pts.map(p => (
          <g key={p.id}>
            <circle cx={p.x} cy={p.y} r="4" fill={p.status === 'success' ? 'var(--signal-success)' : p.status === 'partial' ? 'var(--signal-warn)' : 'var(--signal-error)'} stroke="var(--surface-base)" strokeWidth="2"/>
            <text x={p.x} y={H - 4} fill="var(--text-tertiary)" fontSize="10" textAnchor="middle" fontFamily="var(--font-ui)">{p.date}</text>
            <text x={p.x} y={p.y - 10} fill="var(--text-secondary)" fontSize="10" textAnchor="middle" fontFamily="var(--font-mono)" fontWeight="500">{fmtNum(p.value, 1)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ——— Component form ———
function ComponentFormPage({ onNav, projectId = 'ev-mfg', caseId = 'baseline-2025' }) {
  const [type, setType] = React.useState('Subprocess');
  const project = DEMO_PROJECTS.find(p => p.id === projectId);
  const c = DEMO_CASES.find(x => x.id === caseId);

  return (
    <div className="app-shell" style={{ paddingBottom: 100 }}>
      <AppTopBar current="home" onNav={onNav}/>
      <Breadcrumb items={[
        { label: 'Projects', page: 'home' },
        { label: project.name, onClick: () => onNav('project', { projectId: project.id }) },
        { label: c.name, onClick: () => onNav('case', { projectId: project.id, caseId: c.id }) },
        { label: 'New Component' },
      ]} onNav={onNav}/>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 120px' }}>
        <h1 className="display" style={{ fontSize: 26, fontWeight: 600, margin: 0, marginBottom: 8, letterSpacing: '-0.01em' }}>New Component</h1>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0, marginBottom: 24 }}>Add a new node to the process hierarchy for {c.name}.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Section 1: Type */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Type & Placement</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>Where does this component fit in the process tree?</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: 'var(--border-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
              {HIERARCHY_TYPES.map(h => {
                const active = type === h.id;
                return (
                  <button key={h.id} onClick={() => setType(h.id)} style={{
                    padding: '14px 8px', background: active ? 'var(--brand-subtle)' : 'var(--surface-raised)',
                    border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    color: active ? 'var(--brand-primary)' : 'var(--text-secondary)',
                  }}>
                    <span className="mono" style={{ fontSize: 10, width: 20, height: 20, borderRadius: 3, background: active ? 'var(--brand-primary)' : 'var(--surface-overlay)', color: active ? 'oklch(0.15 0.01 240)' : 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{h.short}</span>
                    <span style={{ fontSize: 11, fontWeight: 500 }}>{h.label}</span>
                  </button>
                );
              })}
            </div>
            <label className="label">Parent component</label>
            <div style={{ position: 'relative' }}>
              <select className="input" style={{ appearance: 'none', paddingRight: 32 }}>
                <option>Cell Production Line (Machine)</option>
                <option>Module Assembly (Machine)</option>
              </select>
              <Icon name="chevron-down" size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }}/>
            </div>
          </div>

          {/* Section 2: Identity */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Identity</div>
            <label className="label">Name <span style={{ color: 'var(--signal-error)' }}>*</span></label>
            <input className="input" defaultValue="Cathode Coating" style={{ marginBottom: 12 }}/>
            <label className="label">Description</label>
            <textarea className="input" defaultValue="Active material deposition stage." style={{ height: 72, padding: 10, marginBottom: 12, resize: 'vertical' }}/>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <div>
                <label className="label">Quantity</label>
                <input className="input mono" defaultValue="1"/>
              </div>
              <div>
                <label className="label">Unit</label>
                <select className="input"><option>unit</option><option>kg</option><option>kWh</option></select>
              </div>
            </div>
          </div>

          {/* Section 3: Costs (collapsed) */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <Icon name="chevron-right" size={14} style={{ color: 'var(--text-tertiary)' }}/>
              <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Costs</span>
              <span className="mono" style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>$0.00 estimated</span>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <Icon name="chevron-right" size={14} style={{ color: 'var(--text-tertiary)' }}/>
              <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Advanced</span>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>Drivers JSON · metadata</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky action bar */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 64, background: 'var(--surface-raised)', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', padding: '0 32px', zIndex: 40 }}>
        <div style={{ maxWidth: 720, width: '100%', margin: '0 auto', display: 'flex', alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => onNav('case', { projectId, caseId })}>Cancel</button>
          <button className="btn btn-secondary btn-sm" style={{ marginLeft: 8 }}>Save as draft</button>
          <div style={{ flex: 1 }}/>
          <button className="btn btn-primary btn-sm">Create component</button>
        </div>
      </div>
    </div>
  );
}

// ——— Analytics / Compare ———
function ComparePage({ projectId = 'ev-mfg', onNav }) {
  const project = DEMO_PROJECTS.find(p => p.id === projectId);
  const cases = DEMO_CASES.filter(c => c.projectId === project.id);

  return (
    <div className="app-shell">
      <AppTopBar current="home" onNav={onNav}/>
      <Breadcrumb items={[
        { label: 'Projects', page: 'home' },
        { label: project.name, onClick: () => onNav('project', { projectId: project.id }) },
        { label: 'Comparison' },
      ]} onNav={onNav}/>

      <div style={{ padding: '24px 32px 80px', maxWidth: 1440, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ flex: 1 }}>
            <h1 className="display" style={{ fontSize: 26, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>Case Comparison</h1>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>Comparing {cases.length} cases · CML 2001 · US Grid</div>
          </div>
          <button className="btn btn-secondary btn-sm"><Icon name="download" size={14}/> PDF</button>
          <button className="btn btn-secondary btn-sm" style={{ marginLeft: 8 }}><Icon name="share" size={14}/> Share</button>
        </div>

        {/* Head-to-head */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cases.length}, 1fr)`, gap: 16, marginBottom: 20 }}>
          {cases.map((c, i) => {
            const baseline = cases[0];
            const delta = ((c.totalImpact - baseline.totalImpact) / baseline.totalImpact) * 100;
            const costDelta = c.totalCost - baseline.totalCost;
            return (
              <div key={c.id} className="card" style={{ padding: 24, borderLeft: '3px solid var(--chart-' + (i + 1) + ')' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: `var(--chart-${i + 1})` }}/>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</span>
                  {i === 0 && <span className="chip" style={{ fontSize: 10, marginLeft: 'auto' }}>BASELINE</span>}
                </div>
                <div className="eyebrow" style={{ marginBottom: 6 }}>TOTAL IMPACT</div>
                <div className="mono" style={{ fontSize: 34, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{fmtNum(c.totalImpact, 2)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{c.unit}</div>
                {i > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 10, fontSize: 12 }}>
                    <span className="mono" style={{ color: delta < 0 ? 'var(--signal-success)' : 'var(--signal-error)', fontWeight: 500 }}>
                      {delta < 0 ? '↓' : '↑'} {fmtNum(Math.abs(delta), 1)}%
                    </span>
                    <span className="mono" style={{ color: costDelta > 0 ? 'var(--signal-warn)' : 'var(--signal-success)' }}>
                      {costDelta > 0 ? '+' : ''}${fmtInt(Math.abs(costDelta))}
                    </span>
                  </div>
                )}
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-subtle)', display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 6, fontSize: 12 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Method</span><span style={{ color: 'var(--text-primary)' }}>{c.method}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>Region</span><span style={{ color: 'var(--text-primary)' }}>{c.region}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>Total cost</span><span className="mono" style={{ color: 'var(--text-primary)' }}>${fmtInt(c.totalCost)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Verdict */}
        <div className="card" style={{ padding: 24, marginBottom: 20, background: 'linear-gradient(135deg, var(--brand-subtle), transparent 70%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--brand-primary)', color: 'oklch(0.15 0.01 240)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="target" size={20}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Verdict</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Recycled Cathode Materials</span> reduces Global Warming by <span className="mono" style={{ color: 'var(--signal-success)' }}>38.2%</span> at <span className="mono" style={{ color: 'var(--signal-warn)' }}>+$590</span> cost.
                ROI: <span className="mono" style={{ color: 'var(--brand-primary)' }}>$12.20 / kg CO₂-eq avoided</span>.
              </div>
            </div>
          </div>
        </div>

        {/* Grouped bar chart */}
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>Impact by category · across scenarios</div>
          <GroupedBarChart cases={cases}/>
        </div>

        {/* Component diff table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', fontSize: 14, fontWeight: 600 }}>Component-level difference</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr repeat(3, 1fr)', padding: '10px 20px', background: 'var(--surface-overlay)', fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
            <div>Component</div>
            {cases.map(c => <div key={c.id} style={{ textAlign: 'right' }}>{c.name.split(' ')[0]}</div>)}
          </div>
          {DEMO_CONTRIBUTORS.map((comp, i) => {
            const baseVal = comp.value;
            return (
              <div key={comp.id} style={{ display: 'grid', gridTemplateColumns: '2fr repeat(3, 1fr)', padding: '12px 20px', borderTop: '1px solid var(--border-subtle)', fontSize: 13 }}>
                <div style={{ color: 'var(--text-primary)' }}>{comp.name}</div>
                {cases.map((c, ci) => {
                  const factor = ci === 0 ? 1 : ci === 1 ? 0.72 : 0.62;
                  const val = baseVal * factor;
                  const delta = ((val - baseVal) / baseVal) * 100;
                  return (
                    <div key={c.id} className="mono" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {fmtNum(val, 1)}
                      {ci > 0 && <span style={{ marginLeft: 6, fontSize: 11, color: delta < 0 ? 'var(--signal-success)' : 'var(--signal-error)' }}>{delta < 0 ? '↓' : '↑'}{fmtNum(Math.abs(delta), 0)}%</span>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GroupedBarChart({ cases }) {
  const cats = DEMO_CATEGORIES.slice(0, 5);
  const W = 900, H = 260, padX = 40, padY = 30;
  const innerW = W - padX * 2, innerH = H - padY * 2;
  const groupW = innerW / cats.length;
  const barW = (groupW - 20) / cases.length;
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {cats.map((cat, ci) => {
        const xg = padX + ci * groupW;
        const normBase = cat.value;
        return (
          <g key={cat.id}>
            {cases.map((c, csi) => {
              const factor = csi === 0 ? 1 : csi === 1 ? 0.72 : 0.62;
              const val = normBase * factor;
              const pct = val / normBase;
              const h = pct * innerH * 0.85;
              const x = xg + 10 + csi * barW;
              const y = H - padY - h;
              return (
                <g key={c.id}>
                  <rect x={x} y={y} width={barW - 4} height={h} fill={`var(--chart-${csi + 1})`} rx="2"/>
                  {csi === 0 && <text x={xg + groupW / 2} y={H - 8} fill="var(--text-tertiary)" fontSize="10" textAnchor="middle" fontFamily="var(--font-ui)">{cat.name}</text>}
                </g>
              );
            })}
          </g>
        );
      })}
      {/* Legend */}
      {cases.map((c, i) => (
        <g key={c.id} transform={`translate(${padX + i * 180}, 8)`}>
          <rect width="10" height="10" rx="2" fill={`var(--chart-${i + 1})`}/>
          <text x="16" y="9" fill="var(--text-secondary)" fontSize="11" fontFamily="var(--font-ui)">{c.name}</text>
        </g>
      ))}
    </svg>
  );
}

// ——— Admin integrations ———
function AdminPage({ onNav }) {
  const [tab, setTab] = React.useState('overview');

  return (
    <div className="app-shell">
      <AppTopBar current="integrations" onNav={onNav}/>
      <Breadcrumb items={[{ label: 'Admin' }, { label: 'Integrations' }]} onNav={onNav}/>

      <div style={{ padding: '24px 32px 80px', maxWidth: 1440, margin: '0 auto' }}>
        <div style={{ marginBottom: 20 }}>
          <h1 className="display" style={{ fontSize: 26, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>Integrations</h1>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>Monitor data source health, manage keys, view activity.</div>
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border-subtle)' }}>
          {[
            { id: 'overview', l: 'Overview' },
            { id: 'sources', l: 'Data Sources' },
            { id: 'keys', l: 'API Keys' },
            { id: 'log', l: 'Activity Log' },
            { id: 'schema', l: 'Schema' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '10px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
              color: tab === t.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
              fontSize: 13, fontWeight: tab === t.id ? 500 : 400, fontFamily: 'var(--font-ui)',
              borderBottom: '2px solid ' + (tab === t.id ? 'var(--brand-primary)' : 'transparent'),
              marginBottom: '-1px',
            }}>{t.l}</button>
          ))}
        </div>

        {tab === 'overview' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { l: 'SUBSTANCES', v: '1,842', s: '1,720 enriched', pct: 93, status: 'success' },
                { l: 'VALUATION METHODS', v: '3', s: 'CML · ReCiPe · TRACI', status: 'success' },
                { l: 'COST RATES', v: '332', s: 'labor · energy · material', status: 'success' },
                { l: 'INTEGRATION HEALTH', v: '5 / 6', s: '1 endpoint failing', status: 'warn' },
              ].map(k => (
                <div key={k.l} className="card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                    <div className="eyebrow">{k.l}</div>
                    <div style={{ marginLeft: 'auto' }}><StatusDot status={k.status}/></div>
                  </div>
                  <div className="mono" style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, letterSpacing: '-0.01em' }}>{k.v}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{k.s}</div>
                  {k.pct !== undefined && <div style={{ marginTop: 10 }}><MiniBar value={k.pct} height={4}/></div>}
                </div>
              ))}
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Integration status</span>
                <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}><Icon name="refresh" size={13}/> Refresh all</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 120px', padding: '10px 20px', background: 'var(--surface-overlay)', fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
                <div>Source</div><div>Status</div><div>Last run</div><div>Records</div><div style={{ textAlign: 'right' }}>Action</div>
              </div>
              {DEMO_INTEGRATIONS.map(src => (
                <div key={src.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 120px', padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', fontSize: 13, alignItems: 'center' }}>
                  <div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{src.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{src.description}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <StatusDot status={src.status}/>
                    <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{src.status === 'warn' ? 'degraded' : src.status === 'success' ? 'healthy' : src.status}</span>
                  </div>
                  <div className="mono" style={{ color: 'var(--text-tertiary)' }}>{src.lastRun}</div>
                  <div className="mono" style={{ color: 'var(--text-secondary)' }}>{fmtInt(src.records)}</div>
                  <div style={{ textAlign: 'right' }}>
                    <button className="btn btn-ghost btn-sm" style={{ padding: '4px 10px' }}>
                      {src.status === 'error' ? 'Configure' : 'Run now'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'log' && (
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 8 }}>
              <button className="chip chip-active" style={{ cursor: 'pointer', border: 'none' }}>All sources</button>
              <button className="chip" style={{ cursor: 'pointer', border: 'none' }}>Success</button>
              <button className="chip" style={{ cursor: 'pointer', border: 'none' }}>Errors</button>
              <div style={{ flex: 1 }}/>
              <button className="btn btn-ghost btn-sm"><Icon name="download" size={13}/> CSV</button>
            </div>
            {DEMO_ACTIVITY.map((a, i) => (
              <div key={i} style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 12, alignItems: 'center', fontSize: 13 }}>
                <StatusDot status={a.status}/>
                <span className="mono" style={{ color: 'var(--text-tertiary)', fontSize: 11, width: 80 }}>{a.t}</span>
                <span style={{ color: 'var(--text-secondary)', width: 80 }}>{a.actor}</span>
                <span style={{ color: 'var(--text-primary)', flex: 1 }}>{a.action}</span>
                <span className="chip" style={{ fontSize: 10 }}>{a.source}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'sources' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {DEMO_INTEGRATIONS.map(src => (
              <div key={src.id} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <StatusDot status={src.status}/>
                  <div style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>{src.name}</div>
                  <button className="btn btn-ghost btn-sm"><Icon name="settings" size={13}/></button>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>{src.description}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                  <div><div style={{ color: 'var(--text-tertiary)' }}>Rate limit</div><div className="mono" style={{ color: 'var(--text-primary)' }}>842 / 1000</div></div>
                  <div><div style={{ color: 'var(--text-tertiary)' }}>Last sync</div><div className="mono" style={{ color: 'var(--text-primary)' }}>{src.lastRun}</div></div>
                  <div><div style={{ color: 'var(--text-tertiary)' }}>TTL</div><div className="mono" style={{ color: 'var(--text-primary)' }}>24h</div></div>
                  <div><div style={{ color: 'var(--text-tertiary)' }}>Records</div><div className="mono" style={{ color: 'var(--text-primary)' }}>{fmtInt(src.records)}</div></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'keys' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 120px', padding: '10px 20px', background: 'var(--surface-overlay)', fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
              <div>Service</div><div>Key</div><div>Last used</div><div style={{ textAlign: 'right' }}>Action</div>
            </div>
            {DEMO_INTEGRATIONS.filter(i => i.keyRequired).map(src => (
              <div key={src.id} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 120px', padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', alignItems: 'center', fontSize: 13 }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{src.name}</div>
                <div className="mono" style={{ color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>em_•••••••••••••••••••{src.id.slice(0, 4)}</span>
                  <Icon name="eye" size={12}/>
                </div>
                <div className="mono" style={{ color: 'var(--text-tertiary)' }}>{src.lastRun}</div>
                <div style={{ textAlign: 'right' }}>
                  <button className="btn btn-ghost btn-sm">Rotate</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'schema' && (
          <div className="card" style={{ padding: 32 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>Data population map</div>
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 200px', gap: 20, alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {DEMO_INTEGRATIONS.slice(0, 4).map((s, i) => (
                  <div key={s.id} style={{ padding: 12, background: 'var(--surface-overlay)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <StatusDot status={s.status}/> {s.name}
                  </div>
                ))}
              </div>
              <svg viewBox="0 0 200 300" style={{ height: 260, width: '100%' }}>
                {[0, 1, 2, 3].map(i => <path key={i} d={`M 10 ${30 + i * 66} Q 100 ${30 + i * 66} 190 ${20 + (i % 4) * 70}`} stroke="var(--brand-primary)" strokeWidth="1.5" fill="none" opacity="0.6" markerEnd="url(#ar)"/>)}
                <defs><marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--brand-primary)"/></marker></defs>
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['substances', 'valuation_methods', 'characterization_factors', 'cost_rates'].map((t, i) => (
                  <div key={t} className="mono" style={{ padding: 12, background: 'var(--surface-sunken)', borderRadius: 6, fontSize: 12, color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>{t}</div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ——— About + Guide ———
function AboutPage({ onNav }) {
  return (
    <div className="app-shell">
      <AppTopBar current="guide" onNav={onNav}/>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px' }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>ABOUT</div>
        <h1 className="display" style={{ fontSize: 40, fontWeight: 700, margin: 0, marginBottom: 24, letterSpacing: '-0.02em' }}>What is LCAPIX?</h1>
        <div style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 40 }}>
          <p>LCAPIX is a Life Cycle Assessment platform built for practicing sustainability engineers. We pair the rigor of ISO 14040/14044 with the ergonomics of a modern web tool.</p>
          <p>Where existing tools treat cost and environmental impact as separate analyses, we unify them — so an engineer can answer the question that actually lands a project: "for how much more, and how much less carbon?"</p>
        </div>

        <h2 className="display" style={{ fontSize: 24, fontWeight: 600, margin: 0, marginBottom: 16 }}>The methodology</h2>
        <div style={{ padding: 20, border: '1px solid var(--border-subtle)', borderRadius: 8, marginBottom: 40 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {HIERARCHY_TYPES.map((h, i) => (
              <React.Fragment key={h.id}>
                <div style={{ padding: '8px 12px', borderRadius: 4, background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)', borderLeft: '3px solid ' + h.color }}>
                  <div className="mono" style={{ fontSize: 10, color: h.color, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>{h.short}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{h.label}</div>
                </div>
                {i < HIERARCHY_TYPES.length - 1 && <span style={{ alignSelf: 'center', color: 'var(--text-tertiary)' }}>→</span>}
              </React.Fragment>
            ))}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Every process is modeled as a 5-tier hierarchy. Environmental flows attach at the Task level; costs roll up at every level.</div>
        </div>

        <h2 className="display" style={{ fontSize: 24, fontWeight: 600, margin: 0, marginBottom: 16 }}>Methods we support</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 40 }}>
          {DEMO_METHODS.map(m => (
            <div key={m.id} className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{m.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{m.note}</div>
            </div>
          ))}
        </div>

        <h2 className="display" style={{ fontSize: 24, fontWeight: 600, margin: 0, marginBottom: 16 }}>Built on</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {['openLCA', 'PubChem', 'BLS', 'EIA', 'Electricity Maps', 'Metals-API'].map(s => (
            <div key={s} className="card" style={{ padding: 14, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>{s}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GuidePage({ onNav }) {
  const [section, setSection] = React.useState('getting-started');
  const toc = [
    { id: 'getting-started', l: 'Getting started' },
    { id: 'data-model', l: 'Data model' },
    { id: 'first-assessment', l: 'First assessment' },
    { id: 'glossary', l: 'Glossary' },
    { id: 'faq', l: 'FAQ' },
    { id: 'api', l: 'API reference' },
  ];

  return (
    <div className="app-shell">
      <AppTopBar current="guide" onNav={onNav}/>
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', maxWidth: 1200, margin: '0 auto', minHeight: 800 }}>
        <aside style={{ padding: '32px 16px', borderRight: '1px solid var(--border-subtle)' }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>DOCS</div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {toc.map(t => (
              <button key={t.id} onClick={() => setSection(t.id)} style={{
                padding: '8px 12px', textAlign: 'left', background: section === t.id ? 'var(--surface-raised)' : 'transparent',
                border: 'none', cursor: 'pointer', borderRadius: 4,
                color: section === t.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: 13, fontFamily: 'var(--font-ui)', fontWeight: section === t.id ? 500 : 400,
                borderLeft: '2px solid ' + (section === t.id ? 'var(--brand-primary)' : 'transparent'),
              }}>{t.l}</button>
            ))}
          </nav>
        </aside>
        <main style={{ padding: '48px 56px', maxWidth: 720 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>GUIDE</div>
          <h1 className="display" style={{ fontSize: 32, fontWeight: 700, margin: 0, marginBottom: 16, letterSpacing: '-0.01em' }}>Getting started</h1>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            This guide walks you from zero to your first defensible LCA result in under 15 minutes. You'll build a small process tree, attach flows, pick a method, and export a PDF.
          </p>

          <h2 className="display" style={{ fontSize: 20, fontWeight: 600, marginTop: 40, marginBottom: 12 }}>1. Create a project</h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            From <span className="mono" style={{ padding: '1px 6px', background: 'var(--surface-overlay)', borderRadius: 3, fontSize: 12 }}>/home</span>, click <span className="chip chip-active" style={{ fontSize: 11 }}>+ New Project</span>. Pick a type — base case or comparative study.
          </p>

          <h2 className="display" style={{ fontSize: 20, fontWeight: 600, marginTop: 40, marginBottom: 12 }}>2. Build the process tree</h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Every case starts with a Product node. Add Machine/Line children, then Subprocess, Operation, and Elemental Task nodes. Drag to restructure.
          </p>

          <div style={{ padding: 16, background: 'var(--surface-raised)', borderRadius: 6, border: '1px solid var(--border-subtle)', borderLeft: '3px solid var(--brand-primary)', marginTop: 20, marginBottom: 32 }}>
            <div style={{ fontSize: 12, color: 'var(--brand-primary)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Tip</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Flows only attach to Elemental Tasks. If your impact is zero, check that at least one task has an <code className="mono" style={{ padding: '1px 4px', background: 'var(--surface-overlay)', borderRadius: 3 }}>is_driver</code> flow.</div>
          </div>

          <h2 className="display" style={{ fontSize: 20, fontWeight: 600, marginTop: 40, marginBottom: 12 }}>3. Run and export</h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Press <kbd className="mono" style={{ padding: '2px 6px', background: 'var(--surface-overlay)', borderRadius: 3, fontSize: 11, border: '1px solid var(--border-subtle)' }}>R</kbd> to run an assessment, then <kbd className="mono" style={{ padding: '2px 6px', background: 'var(--surface-overlay)', borderRadius: 3, fontSize: 11, border: '1px solid var(--border-subtle)' }}>E</kbd> to export the PDF.
          </p>
        </main>
      </div>
    </div>
  );
}

Object.assign(window, { ResultsPage, ComponentFormPage, ComparePage, AdminPage, AboutPage, GuidePage });
