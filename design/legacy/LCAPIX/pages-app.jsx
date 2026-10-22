// pages-app.jsx — Home dashboard + Project detail + Case editor

function HomePage({ onNav }) {
  const [view, setView] = React.useState('grid');
  const [filter, setFilter] = React.useState('all');

  const projects = DEMO_PROJECTS.filter(p => {
    if (filter === 'base') return p.type === 'base';
    if (filter === 'comp') return p.type === 'comparative';
    if (filter === 'active') return p.status === 'active';
    return true;
  });

  return (
    <div className="app-shell">
      <AppTopBar current="home" onNav={onNav}/>
      <div style={{ display: 'flex', maxWidth: 1440, margin: '0 auto' }}>
        <div style={{ flex: 1, padding: '32px 24px 80px', minWidth: 0 }}>
          {/* Greeting */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
            <div>
              <h1 className="display" style={{ fontSize: 28, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>
                Welcome back, {DEMO_USER.name}
              </h1>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>
                <span className="mono">6</span> projects · last activity <span className="mono">4min ago</span>
              </div>
            </div>
            <div style={{ flex: 1 }}/>
            <button className="btn btn-secondary btn-sm"><Icon name="download" size={14}/> Import</button>
            <button className="btn btn-primary" style={{ marginLeft: 8 }}><Icon name="plus" size={14}/> New Project</button>
          </div>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
            {[
              { label: 'PROJECTS', value: '6', trend: '↑ 2 this week', trendGood: true, spark: [2, 3, 3, 4, 4, 5, 6] },
              { label: 'ASSESSMENTS', value: '247', trend: '↑ 34 this week', trendGood: true, spark: [180, 195, 210, 222, 230, 238, 247] },
              { label: 'FACTORS', value: '5,234', trend: '→ synced', trendGood: null, spark: [5100, 5140, 5180, 5200, 5210, 5224, 5234] },
              { label: 'COMPONENTS', value: '151', trend: '↑ 12 this week', trendGood: true, spark: [130, 135, 140, 144, 147, 149, 151] },
            ].map(k => (
              <div key={k.label} className="card" style={{ padding: 20 }}>
                <div className="eyebrow" style={{ marginBottom: 10 }}>{k.label}</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <div>
                    <div className="mono" style={{ fontSize: 32, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{k.value}</div>
                    <div style={{ fontSize: 12, color: k.trendGood === true ? 'var(--signal-success)' : 'var(--text-tertiary)', marginTop: 4 }}>{k.trend}</div>
                  </div>
                  <Sparkline data={k.spark} color="var(--brand-primary)" width={72} height={28}/>
                </div>
              </div>
            ))}
          </div>

          {/* Projects header */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Your Projects</h2>
            <div style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
              {[{ id: 'all', l: 'All' }, { id: 'base', l: 'Base' }, { id: 'comp', l: 'Comparative' }, { id: 'active', l: 'Active' }].map(f => (
                <button key={f.id} onClick={() => setFilter(f.id)} className={'chip' + (filter === f.id ? ' chip-active' : '')} style={{ cursor: 'pointer', border: 'none', fontFamily: 'var(--font-ui)' }}>{f.l}</button>
              ))}
            </div>
            <div style={{ flex: 1 }}/>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '0 10px', height: 32, width: 220 }}>
              <Icon name="search" size={14} style={{ color: 'var(--text-tertiary)' }}/>
              <input placeholder="Search projects" style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, flex: 1, fontFamily: 'var(--font-ui)' }}/>
            </div>
            <div style={{ display: 'flex', background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: 2 }}>
              <button onClick={() => setView('grid')} style={{ width: 28, height: 28, borderRadius: 4, background: view === 'grid' ? 'var(--surface-overlay)' : 'transparent', border: 'none', cursor: 'pointer', color: view === 'grid' ? 'var(--text-primary)' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="grid" size={14}/></button>
              <button onClick={() => setView('list')} style={{ width: 28, height: 28, borderRadius: 4, background: view === 'list' ? 'var(--surface-overlay)' : 'transparent', border: 'none', cursor: 'pointer', color: view === 'list' ? 'var(--text-primary)' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="list" size={14}/></button>
            </div>
          </div>

          {/* Projects grid */}
          {view === 'grid' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {projects.map(p => (
                <div key={p.id} className="card card-hover" onClick={() => p.id === 'ev-mfg' && onNav('project', { projectId: p.id })} style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{p.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.description}</div>
                    </div>
                    <div className={'chip ' + (p.status === 'active' ? 'chip-emerald' : '')} style={{ fontSize: 11 }}>
                      {p.status === 'active' && <span className="badge-dot" style={{ background: 'var(--signal-success)' }}/>}
                      {p.status}
                    </div>
                  </div>
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
                    <span><span className="mono" style={{ color: 'var(--text-secondary)' }}>{p.cases}</span> cases</span>
                    <span style={{ color: 'var(--text-disabled)' }}>·</span>
                    <span><span className="mono" style={{ color: 'var(--text-secondary)' }}>{p.components}</span> comps</span>
                    <span style={{ color: 'var(--text-disabled)' }}>·</span>
                    <span>{p.lastRun}</span>
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="mono" style={{ fontSize: 18, fontWeight: 500, color: 'var(--brand-primary)' }}>{fmtNum(p.totalImpact, p.totalImpact < 1 ? 3 : 1)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{p.unit}</div>
                    <div style={{ marginLeft: 'auto' }}>
                      <Sparkline data={p.impactTrend} color="var(--brand-primary)" width={60} height={22}/>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 100px 80px 100px 120px 100px 40px', fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '12px 16px', background: 'var(--surface-overlay)' }}>
                <div>Name</div><div>Type</div><div>Cases</div><div>Comps</div><div>Last run</div><div>Updated</div><div></div>
              </div>
              {projects.map(p => (
                <div key={p.id} onClick={() => p.id === 'ev-mfg' && onNav('project', { projectId: p.id })} style={{ display: 'grid', gridTemplateColumns: '2fr 100px 80px 100px 120px 100px 40px', padding: '14px 16px', borderTop: '1px solid var(--border-subtle)', cursor: 'pointer', fontSize: 13, alignItems: 'center' }}>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{p.name}</div>
                  <div style={{ color: 'var(--text-secondary)' }}>{p.type}</div>
                  <div className="mono" style={{ color: 'var(--text-secondary)' }}>{p.cases}</div>
                  <div className="mono" style={{ color: 'var(--text-secondary)' }}>{p.components}</div>
                  <div style={{ color: 'var(--text-tertiary)' }}>{p.lastRun}</div>
                  <div style={{ color: 'var(--text-tertiary)' }}>{p.updated}</div>
                  <div><Icon name="more" size={14} style={{ color: 'var(--text-tertiary)' }}/></div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar: recent activity */}
        <aside className="home-sidebar" style={{ flex: '0 0 280px', padding: '32px 24px 32px 0', borderLeft: '1px solid var(--border-subtle)', paddingLeft: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>RECENT ACTIVITY</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {DEMO_ACTIVITY.slice(0, 7).map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ marginTop: 5 }}><StatusDot status={a.status}/></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.45 }}>
                    <span style={{ fontWeight: 500 }}>{a.actor}</span> <span style={{ color: 'var(--text-secondary)' }}>{a.action}</span>
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{a.t}</div>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ——— Project detail ———
function ProjectPage({ projectId, onNav }) {
  const project = DEMO_PROJECTS.find(p => p.id === projectId) || DEMO_PROJECTS[0];
  const cases = DEMO_CASES.filter(c => c.projectId === (project.id || 'ev-mfg'));
  const [activeCase, setActiveCase] = React.useState(cases[0]?.id);
  const currentCase = cases.find(c => c.id === activeCase) || cases[0];

  return (
    <div className="app-shell">
      <AppTopBar current="home" onNav={onNav}/>
      <Breadcrumb items={[{ label: 'Projects', page: 'home' }, { label: project.name }]} onNav={onNav}/>

      <div style={{ padding: '24px 32px 80px', maxWidth: 1440, margin: '0 auto' }}>
        {/* Project header */}
        <div className="card" style={{ padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <h1 className="display" style={{ fontSize: 26, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>{project.name}</h1>
              <span className={'chip ' + (project.type === 'comparative' ? 'chip-active' : '')} style={{ fontSize: 11 }}>{project.type}</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{project.description}</p>
          </div>
          <button className="btn btn-secondary btn-sm"><Icon name="chart-bar" size={14}/> Analytics</button>
          <button className="btn btn-secondary btn-sm" onClick={() => onNav('compare', { projectId: project.id })}><Icon name="layers" size={14}/> Compare Cases</button>
          <button className="btn btn-primary btn-sm"><Icon name="plus" size={14}/> Add Case</button>
        </div>

        {/* Comparison banner */}
        {cases.length > 1 && (
          <div style={{
            marginTop: 16, padding: '14px 20px', border: '1px solid var(--border-subtle)', borderRadius: 8,
            background: 'linear-gradient(90deg, var(--brand-subtle), transparent 60%)',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <Icon name="sparkle" size={14} style={{ color: 'var(--brand-primary)' }}/>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Comparing <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Baseline</span> vs <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Renewable Scenario</span>:
            </span>
            <span className="mono" style={{ color: 'var(--signal-success)', fontWeight: 500 }}>−28.0% CO₂</span>
            <span style={{ color: 'var(--text-disabled)' }}>·</span>
            <span className="mono" style={{ color: 'var(--signal-warn)' }}>+$240</span>
            <div style={{ flex: 1 }}/>
            <button className="btn btn-ghost btn-sm" onClick={() => onNav('compare', { projectId: project.id })}>
              Open Full Comparison <Icon name="arrow-right" size={12}/>
            </button>
          </div>
        )}

        {/* Case tabs */}
        <div style={{ marginTop: 24, display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
          {cases.map(c => {
            const active = activeCase === c.id;
            return (
              <button key={c.id} onClick={() => setActiveCase(c.id)} style={{
                padding: '14px 20px', borderRadius: 10,
                border: 'none',
                background: active ? 'var(--surface-raised)' : 'transparent',
                boxShadow: active ? 'inset 0 0 0 1.5px var(--primary), 0 4px 16px -8px var(--brand-glow)' : 'none',
                cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-ui)',
                minWidth: 240, flex: '0 0 auto',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</span>
                  <span className="label-sm" style={{ fontSize: 9, color: active ? 'var(--primary)' : 'var(--text-tertiary)' }}>{c.type === 'base' ? 'BASE' : 'COMP'}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', gap: 8 }}>
                  <span><span className="mono">{c.componentCount}</span> comps</span>
                  <span>·</span>
                  <span><span className="mono">{c.driverCount}</span> drivers</span>
                  <span>·</span>
                  <span>{c.lastRun}</span>
                </div>
              </button>
            );
          })}
          <button style={{ padding: '12px 18px', border: '1px dashed var(--border-subtle)', borderRadius: 8, background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontFamily: 'var(--font-ui)' }}>
            <Icon name="plus" size={12}/> Add case
          </button>
        </div>

        {/* Two-pane */}
        <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Case Tree</span>
              <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>· {currentCase?.name}</span>
              <div style={{ flex: 1 }}/>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginRight: 12 }}>drag · scroll to zoom</span>
              <button className="btn btn-ghost btn-sm" onClick={() => onNav('case', { projectId: project.id, caseId: currentCase.id })}>
                <Icon name="external" size={14}/> Open editor
              </button>
            </div>
            <div style={{ position: 'relative', height: 440, background: 'var(--surface-sunken)' }}>
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(var(--border-subtle) 1px, transparent 1px)', backgroundSize: '20px 20px', opacity: 0.5, pointerEvents: 'none' }}/>
              <MiniCanvas tree={DEMO_TREE}/>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Impact Overview</span>
                <span className="chip chip-emerald" style={{ marginLeft: 'auto', fontSize: 11 }}><Icon name="check" size={10}/> Assessed</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>GLOBAL WARMING · CML 2001</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <div className="mono" style={{ fontSize: 36, fontWeight: 600, color: 'var(--brand-primary)', letterSpacing: '-0.02em' }}>{fmtNum(currentCase?.totalImpact, 2)}</div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{currentCase?.unit}</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
                <span className="mono">{currentCase?.componentCount}</span> components · <span className="mono">6</span> categories · <span className="mono">{currentCase?.driverCount}</span> drivers
              </div>
            </div>

            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Top contributors</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {DEMO_CONTRIBUTORS.slice(0, 5).map((c, i) => (
                  <div key={c.id}>
                    <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{c.name}</span>
                      <span className="mono" style={{ marginLeft: 'auto', color: 'var(--text-primary)' }}>{fmtNum(c.value, 1)}</span>
                      <span className="mono" style={{ marginLeft: 8, color: 'var(--text-tertiary)', width: 40, textAlign: 'right' }}>{fmtNum(c.pct, 1)}%</span>
                    </div>
                    <MiniBar value={c.pct} max={40} height={4} color={'oklch(from var(--brand-primary) l c h / ' + (1 - i * 0.12) + ')'}/>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Cost summary</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 8, fontSize: 13 }}>
                <div style={{ color: 'var(--text-secondary)' }}>Labor</div><div className="mono">$2,240</div>
                <div style={{ color: 'var(--text-secondary)' }}>Energy</div><div className="mono">$1,680</div>
                <div style={{ color: 'var(--text-secondary)' }}>Material</div><div className="mono">$3,920</div>
                <div style={{ color: 'var(--text-secondary)' }}>Overhead</div><div className="mono">$580</div>
                <div style={{ gridColumn: '1/3', height: 1, background: 'var(--border-subtle)', margin: '4px 0' }}/>
                <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Total</div><div className="mono" style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>${fmtInt(currentCase?.totalCost)}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => onNav('results', { projectId: project.id, caseId: currentCase.id })}>
                <Icon name="run" size={14}/> Run Assessment
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => onNav('results', { projectId: project.id, caseId: currentCase.id })}>Results</button>
              <button className="btn btn-ghost btn-sm"><Icon name="download" size={14}/></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ——— Interactive mini canvas for project detail (pan/zoom, 5-tier hierarchy) ———
function MiniCanvas({ tree }) {
  // Flatten with depth + parent pointer
  const flat = [];
  const walk = (node, depth = 0, parent = null) => {
    flat.push({ ...node, depth, parent });
    (node.children || []).forEach(c => walk(c, depth + 1, node.id));
  };
  walk(tree);

  const parentOf = Object.fromEntries(flat.map(n => [n.id, n.parent]));

  const COL_W = 200;
  const ROW_H = 44;
  const NODE_W = 168, NODE_H = 40;

  const yById = {};
  let cursor = 0;
  const layout = (id) => {
    const kids = flat.filter(n => parentOf[n.id] === id);
    if (kids.length === 0) { yById[id] = cursor * ROW_H; cursor++; return yById[id]; }
    const ys = kids.map(k => layout(k.id));
    yById[id] = (Math.min(...ys) + Math.max(...ys)) / 2;
    return yById[id];
  };
  layout(tree.id);

  const positioned = flat.map(n => ({ ...n, x: 20 + n.depth * COL_W, y: 16 + (yById[n.id] || 0) }));
  const posById = Object.fromEntries(positioned.map(p => [p.id, p]));
  const maxX = Math.max(...positioned.map(p => p.x)) + NODE_W + 40;
  const maxY = Math.max(...positioned.map(p => p.y)) + NODE_H + 32;

  const [xf, setXf] = React.useState({ x: 0, y: 0, k: 0.8 });
  const [hovered, setHovered] = React.useState(null);
  const dragRef = React.useRef(null);
  const hostRef = React.useRef(null);

  React.useEffect(() => {
    const fit = () => {
      if (!hostRef.current) return;
      const r = hostRef.current.getBoundingClientRect();
      if (r.width < 50) return;
      const k = Math.min(1, (r.width - 32) / maxX, (r.height - 32) / maxY);
      const kF = Math.max(0.35, k);
      setXf({ x: (r.width - maxX * kF) / 2, y: (r.height - maxY * kF) / 2, k: kF });
    };
    fit();
    const id = setTimeout(fit, 120);
    return () => clearTimeout(id);
  }, [maxX, maxY]);

  const onWheel = (e) => { e.preventDefault(); const d = -e.deltaY * 0.0015; setXf(t => ({ ...t, k: Math.max(0.3, Math.min(2, t.k + d)) })); };
  const onMD = (e) => { if (e.target.closest('[data-n]')) return; dragRef.current = { x: e.clientX, y: e.clientY, tx: xf.x, ty: xf.y }; };
  const onMM = (e) => { if (!dragRef.current) return; const { x, y, tx, ty } = dragRef.current; setXf(t => ({ ...t, x: tx + (e.clientX - x), y: ty + (e.clientY - y) })); };
  const onMU = () => { dragRef.current = null; };

  return (
    <div ref={hostRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', cursor: dragRef.current ? 'grabbing' : 'grab' }}
      onWheel={onWheel} onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}>
      <div style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 5, display: 'flex', gap: 2, background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: 3, boxShadow: 'var(--shadow-sm)' }}>
        <button onClick={() => setXf(t => ({ ...t, k: Math.max(0.3, t.k - 0.15) }))} style={{ width: 24, height: 24, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 4, color: 'var(--text-secondary)', fontSize: 14 }}>−</button>
        <div className="mono" style={{ width: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text-secondary)' }}>{Math.round(xf.k * 100)}%</div>
        <button onClick={() => setXf(t => ({ ...t, k: Math.min(2, t.k + 0.15) }))} style={{ width: 24, height: 24, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 4, color: 'var(--text-secondary)', fontSize: 14 }}>+</button>
      </div>

      <div style={{ position: 'absolute', top: 0, left: 0, transform: `translate(${xf.x}px, ${xf.y}px) scale(${xf.k})`, transformOrigin: '0 0', transition: dragRef.current ? 'none' : 'transform 120ms ease-out' }}>
        <svg width={maxX} height={maxY} style={{ display: 'block', overflow: 'visible', pointerEvents: 'none' }}>
          {Object.entries(parentOf).map(([child, parent], i) => {
            if (!parent) return null;
            const pa = posById[parent], pb = posById[child];
            if (!pa || !pb) return null;
            const x1 = pa.x + NODE_W, y1 = pa.y + NODE_H / 2;
            const x2 = pb.x, y2 = pb.y + NODE_H / 2;
            const mx = (x1 + x2) / 2;
            return <path key={i} d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} stroke="var(--border-strong)" strokeWidth="1" fill="none" opacity="0.6"/>;
          })}
        </svg>
        {positioned.map(p => {
          const t = HIERARCHY_TYPES.find(h => h.id === p.type);
          const isHov = hovered === p.id;
          return (
            <div key={p.id} data-n onMouseEnter={() => setHovered(p.id)} onMouseLeave={() => setHovered(null)} style={{
              position: 'absolute', left: p.x, top: p.y, width: NODE_W, height: NODE_H,
              background: 'var(--surface-raised)',
              border: isHov ? `1.5px solid ${t?.color}` : '1px solid var(--border-subtle)',
              borderRadius: 6,
              boxShadow: isHov ? `0 0 0 3px oklch(from ${t?.color} l c h / 0.18), var(--shadow-md)` : 'var(--shadow-sm)',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
              padding: '6px 10px 6px 14px', overflow: 'hidden', cursor: 'pointer',
              transition: 'box-shadow 140ms, border-color 140ms',
            }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: t?.color, borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }}/>
              <div className="mono" style={{ fontSize: 8, fontWeight: 600, color: t?.color, textTransform: 'uppercase', letterSpacing: '0.12em', lineHeight: 1.2 }}>{t?.label}</div>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>{p.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ——— Mini tree viz for project detail (unused fallback) ———
function MiniTree() {
  // Three columns: Product / Machine / Subprocess
  const col0 = [{ type: 'Product', label: 'NMC Battery Pack' }];
  const col1 = [
    { type: 'Machine', label: 'Cell Production' },
    { type: 'Machine', label: 'Module Assembly' },
    { type: 'Machine', label: 'Pack Integration' },
  ];
  const col2 = [
    { type: 'Subprocess', label: 'Cathode Coating', parent: 0 },
    { type: 'Subprocess', label: 'Anode Coating', parent: 0 },
    { type: 'Subprocess', label: 'Cell Stacking', parent: 1 },
    { type: 'Subprocess', label: 'Busbar Welding', parent: 1 },
    { type: 'Subprocess', label: 'Thermal Mgmt', parent: 2 },
    { type: 'Subprocess', label: 'BMS Integration', parent: 2 },
  ];
  const colorFor = (t) => HIERARCHY_TYPES.find(h => h.id === t)?.color || 'var(--text-tertiary)';
  const nw = 150, nh = 44, gapY = 10, gapX = 40;
  const col2H = col2.length * nh + (col2.length - 1) * gapY;
  const H = col2H + 24;
  const col1H = col1.length * nh + (col1.length - 1) * gapY;
  const col0Y = H / 2 - nh / 2;
  const col1Top = H / 2 - col1H / 2;
  const col2Top = 12;

  const p0 = col0.map(() => ({ x: 12, y: col0Y }));
  const p1 = col1.map((_, i) => ({ x: 12 + nw + gapX, y: col1Top + i * (nh + gapY) }));
  const p2 = col2.map((_, i) => ({ x: 12 + (nw + gapX) * 2, y: col2Top + i * (nh + gapY) }));
  const W = 12 + (nw + gapX) * 2 + nw + 12;

  const drawEdge = (ax, ay, bx, by) => {
    const mx = (ax + bx) / 2;
    return `M ${ax} ${ay} C ${mx} ${ay}, ${mx} ${by}, ${bx} ${by}`;
  };

  return (
    <div style={{ width: '100%', overflow: 'hidden', height: H }}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMinYMid meet">
        {col1.map((_, i) => (
          <path key={'e1' + i}
            d={drawEdge(p0[0].x + nw, p0[0].y + nh/2, p1[i].x, p1[i].y + nh/2)}
            stroke="var(--border-strong)" strokeWidth="1" fill="none" opacity="0.6"/>
        ))}
        {col2.map((n, i) => (
          <path key={'e2' + i}
            d={drawEdge(p1[n.parent].x + nw, p1[n.parent].y + nh/2, p2[i].x, p2[i].y + nh/2)}
            stroke="var(--border-strong)" strokeWidth="1" fill="none" opacity="0.6"/>
        ))}
        {[...col0.map((n, i) => ({ ...n, ...p0[i] })), ...col1.map((n, i) => ({ ...n, ...p1[i] })), ...col2.map((n, i) => ({ ...n, ...p2[i] }))].map((n, i) => (
          <g key={i} transform={`translate(${n.x}, ${n.y})`}>
            <rect width={nw} height={nh} rx="6" fill="var(--surface-raised)" stroke="var(--border-subtle)"/>
            <rect width="3" height={nh} rx="1.5" fill={colorFor(n.type)}/>
            <text x="12" y="16" fill={colorFor(n.type)} fontSize="8" fontFamily="var(--font-mono)" fontWeight="600" style={{ textTransform: 'uppercase', letterSpacing: '0.12em' }}>{n.type}</text>
            <text x="12" y="32" fill="var(--text-primary)" fontSize="11" fontFamily="var(--font-ui)" fontWeight="500">{n.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ——— Case Editor (IDE-style) ———
function CaseEditorPage({ projectId = 'ev-mfg', caseId = 'baseline-2025', onNav }) {
  const project = DEMO_PROJECTS.find(p => p.id === projectId) || DEMO_PROJECTS[0];
  const c = DEMO_CASES.find(x => x.id === caseId) || DEMO_CASES[0];
  const [selected, setSelected] = React.useState('s1');
  const [canvasView, setCanvasView] = React.useState('Tree');

  // Flatten tree into nav list
  const flatten = (node, depth = 0, out = []) => {
    out.push({ ...node, depth });
    (node.children || []).forEach(child => flatten(child, depth + 1, out));
    return out;
  };
  const flat = flatten(DEMO_TREE);
  const selectedNode = flat.find(n => n.id === selected) || flat[3];

  return (
    <div className="app-shell" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppTopBar current="home" onNav={onNav}/>
      <Breadcrumb items={[
        { label: 'Projects', page: 'home' },
        { label: project.name, onClick: () => onNav('project', { projectId: project.id }) },
        { label: c.name },
      ]} onNav={onNav}/>

      {/* Toolbar */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface-base)' }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: 2 }}>
          {['Tree', 'List', 'Graph'].map((v) => (
            <button key={v} onClick={() => setCanvasView(v)} style={{ padding: '6px 12px', borderRadius: 4, background: canvasView === v ? 'var(--surface-overlay)' : 'transparent', border: 'none', cursor: 'pointer', color: canvasView === v ? 'var(--text-primary)' : 'var(--text-tertiary)', fontSize: 12, fontFamily: 'var(--font-ui)' }}>{v}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>
          <button style={{ width: 28, height: 28, border: '1px solid var(--border-subtle)', background: 'var(--surface-raised)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-secondary)' }}>−</button>
          <span className="mono" style={{ minWidth: 48, textAlign: 'center' }}>100%</span>
          <button style={{ width: 28, height: 28, border: '1px solid var(--border-subtle)', background: 'var(--surface-raised)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-secondary)' }}>+</button>
          <button className="btn btn-ghost btn-sm">Fit</button>
        </div>
        <div style={{ flex: 1 }}/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '0 10px', height: 32, width: 280 }}>
          <Icon name="search" size={14} style={{ color: 'var(--text-tertiary)' }}/>
          <input placeholder="Find substance, component, or flow…" style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 12, flex: 1, fontFamily: 'var(--font-ui)' }}/>
        </div>
        <button className="btn btn-secondary btn-sm"><Icon name="refresh" size={14}/> Reset</button>
        <button className="btn btn-primary btn-sm" onClick={() => onNav('results', { projectId: project.id, caseId: c.id })}><Icon name="run" size={14}/> Run Assessment</button>
      </div>

      {/* 3-pane */}
      <div className="case-panes" style={{ flex: 1, display: 'grid', gridTemplateColumns: '220px minmax(400px, 1fr) 340px', minHeight: 640 }}>
        {/* Left: component list */}
        <aside className="case-sidebar" style={{ borderRight: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)', display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '0 10px', height: 30 }}>
              <Icon name="search" size={13} style={{ color: 'var(--text-tertiary)' }}/>
              <input placeholder="Components" style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 12, flex: 1, fontFamily: 'var(--font-ui)' }}/>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '8px 6px' }}>
            {flat.map(n => {
              const active = selected === n.id;
              const t = HIERARCHY_TYPES.find(h => h.id === n.type);
              return (
                <button key={n.id} onClick={() => setSelected(n.id)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 8px', paddingLeft: 8 + n.depth * 14,
                  border: 'none', borderLeft: '3px solid ' + (active ? 'var(--brand-primary)' : 'transparent'),
                  background: active ? 'var(--surface-overlay)' : 'transparent',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-ui)',
                  borderRadius: 4, marginBottom: 1,
                }}>
                  <span className="mono" style={{ fontSize: 9, color: t?.color, background: 'oklch(from ' + t?.color + ' l c h / 0.15)', width: 16, height: 16, borderRadius: 3, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>{t?.short}</span>
                  <span style={{ fontSize: 12, color: active ? 'var(--text-primary)' : 'var(--text-secondary)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.label}</span>
                </button>
              );
            })}
          </div>
          <div style={{ padding: 10, borderTop: '1px solid var(--border-subtle)' }}>
            <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }}><Icon name="plus" size={12}/> Add Component</button>
          </div>
        </aside>

        {/* Center: canvas */}
        <section style={{ background: 'var(--surface-sunken)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
            {/* grid bg */}
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'radial-gradient(var(--border-subtle) 1px, transparent 1px)',
              backgroundSize: '24px 24px', opacity: 0.5, pointerEvents: 'none',
            }}/>
            <TreeCanvas root={DEMO_TREE} selected={selected} onSelect={setSelected} view={canvasView} flat={flat}/>
          </div>

          {/* Node details strip */}
          <NodeDetailsStrip node={selectedNode} totalComponents={flat.length}/>
        </section>

        {/* Right: inspector */}
        <aside className="case-inspector" style={{ borderLeft: '1px solid var(--border-subtle)', background: 'var(--surface-base)', overflow: 'auto', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <InspectorPanel node={selectedNode}/>
        </aside>
      </div>
    </div>
  );
}

function TreeCanvas({ root, selected, onSelect, view = 'Tree', flat = [] }) {
  if (view === 'List') return <ListView flat={flat} selected={selected} onSelect={onSelect}/>;
  if (view === 'Graph') return <GraphView flat={flat} selected={selected} onSelect={onSelect}/>;
  // Tree view (default)
  // Layout: depth-first, track max depth and count leaves
  const items = [];
  const layout = (node, depth = 0, yOffset = { v: 0 }) => {
    const myY = yOffset.v;
    const hasChildren = node.children && node.children.length > 0;
    if (hasChildren) {
      const childYs = node.children.map(ch => layout(ch, depth + 1, yOffset));
      const midY = (childYs[0] + childYs[childYs.length - 1]) / 2;
      items.push({ node, depth, y: midY, children: childYs });
      return midY;
    } else {
      items.push({ node, depth, y: myY, children: [] });
      yOffset.v += 1;
      return myY;
    }
  };
  layout(root);

  const colWidth = 220, rowHeight = 80, nodeW = 200, nodeH = 60;
  const totalW = 5 * colWidth + 60;
  const totalH = Math.max(...items.map(i => i.y)) * rowHeight + 120;

  const colorFor = (t) => HIERARCHY_TYPES.find(h => h.id === t)?.color || 'var(--text-tertiary)';

  return (
    <div style={{ position: 'relative', minWidth: totalW, minHeight: totalH, padding: 30 }}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        {items.map(item => (
          (item.node.children || []).map((ch, ci) => {
            const childItem = items.find(x => x.node.id === ch.id);
            if (!childItem) return null;
            const ax = 30 + item.depth * colWidth + nodeW;
            const ay = 30 + item.y * rowHeight + nodeH / 2;
            const bx = 30 + childItem.depth * colWidth;
            const by = 30 + childItem.y * rowHeight + nodeH / 2;
            const midX = (ax + bx) / 2;
            return <path key={item.node.id + '-' + ci} d={`M ${ax} ${ay} L ${midX} ${ay} L ${midX} ${by} L ${bx} ${by}`} stroke="var(--border-strong)" strokeWidth="1" fill="none"/>;
          })
        ))}
      </svg>
      {items.map(item => {
        const x = 30 + item.depth * colWidth;
        const y = 30 + item.y * rowHeight;
        const active = selected === item.node.id;
        const col = colorFor(item.node.type);
        const t = HIERARCHY_TYPES.find(h => h.id === item.node.type);
        return (
          <div key={item.node.id} onClick={() => onSelect(item.node.id)} style={{
            position: 'absolute', left: x, top: y, width: nodeW, height: nodeH,
            background: active ? 'var(--surface-overlay)' : 'var(--surface-raised)',
            border: '1px solid ' + (active ? 'var(--brand-primary)' : 'var(--border-subtle)'),
            borderLeft: '3px solid ' + col,
            borderRadius: 6, padding: '8px 12px', cursor: 'pointer',
            boxShadow: active ? '0 0 0 3px var(--brand-glow)' : 'none',
            transition: 'all 140ms',
          }}>
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600, marginBottom: 2 }}>{t?.label}</div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>{item.node.label}</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              {item.node.flows} flows · ${item.node.cost}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListView({ flat, selected, onSelect }) {
  return (
    <div style={{ padding: 24, position: 'relative', zIndex: 1 }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden', maxWidth: 900 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '40px 2fr 120px 80px 100px 80px', padding: '10px 14px', background: 'var(--surface-overlay)', fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
          <div></div><div>Component</div><div>Type</div><div style={{ textAlign: 'right' }}>Flows</div><div style={{ textAlign: 'right' }}>Cost</div><div style={{ textAlign: 'right' }}>Depth</div>
        </div>
        {flat.map(n => {
          const t = HIERARCHY_TYPES.find(h => h.id === n.type);
          const active = selected === n.id;
          return (
            <div key={n.id} onClick={() => onSelect(n.id)} style={{ display: 'grid', gridTemplateColumns: '40px 2fr 120px 80px 100px 80px', padding: '10px 14px', borderTop: '1px solid var(--border-subtle)', cursor: 'pointer', fontSize: 13, alignItems: 'center', background: active ? 'var(--surface-overlay)' : 'transparent', borderLeft: '3px solid ' + (active ? 'var(--brand-primary)' : 'transparent') }}>
              <span className="mono" style={{ fontSize: 10, color: t?.color, background: 'oklch(from ' + t?.color + ' l c h / 0.15)', width: 22, height: 22, borderRadius: 3, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{t?.short}</span>
              <span style={{ color: 'var(--text-primary)', paddingLeft: n.depth * 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.label}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{t?.label}</span>
              <span className="mono" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{n.flows}</span>
              <span className="mono" style={{ textAlign: 'right', color: 'var(--brand-primary)' }}>${n.cost}</span>
              <span className="mono" style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}>L{n.depth}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GraphView({ flat, selected, onSelect }) {
  // Build parent map (depth-based)
  const parentOf = {};
  const stack = [];
  flat.forEach(n => {
    while (stack.length && stack[stack.length - 1].depth >= n.depth) stack.pop();
    if (stack.length) parentOf[n.id] = stack[stack.length - 1].id;
    stack.push(n);
  });

  // Layered left-to-right tree layout (depth = column, assign rows to avoid overlap)
  const COL_W = 240;   // horizontal spacing between depths
  const ROW_H = 56;    // vertical spacing between sibling leaves
  const NODE_W = 190, NODE_H = 54;

  // Assign y by walking tree — each leaf gets its own row, parents center over children
  const yById = {};
  let rowCursor = 0;
  const walk = (id) => {
    const kids = flat.filter(n => parentOf[n.id] === id);
    if (kids.length === 0) { yById[id] = rowCursor * ROW_H; rowCursor++; return yById[id]; }
    const childYs = kids.map(k => walk(k.id));
    yById[id] = (Math.min(...childYs) + Math.max(...childYs)) / 2;
    return yById[id];
  };
  const rootId = flat[0]?.id;
  if (rootId) walk(rootId);

  const positioned = flat.map(n => ({
    ...n,
    x: 40 + n.depth * COL_W,
    y: 40 + (yById[n.id] || 0),
  }));
  const posById = Object.fromEntries(positioned.map(p => [p.id, p]));

  const maxX = Math.max(...positioned.map(p => p.x)) + NODE_W + 80;
  const maxY = Math.max(...positioned.map(p => p.y)) + NODE_H + 80;

  // Interactive pan + zoom
  const [transform, setTransform] = React.useState({ x: 0, y: 0, k: 0.7 });
  const dragRef = React.useRef(null);
  const hostRef = React.useRef(null);

  // Center content on mount/view-change
  React.useEffect(() => {
    const fit = () => {
      if (!hostRef.current) return;
      const rect = hostRef.current.getBoundingClientRect();
      if (rect.width < 50) return;
      const k = Math.min(0.9, (rect.width - 40) / maxX, (rect.height - 40) / maxY);
      const kFinal = Math.max(0.35, k);
      setTransform({ x: (rect.width - maxX * kFinal) / 2, y: (rect.height - maxY * kFinal) / 2, k: kFinal });
    };
    fit();
    const id = setTimeout(fit, 100);
    return () => clearTimeout(id);
  }, [flat.length, maxX, maxY]);

  const onWheel = (e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    setTransform(t => ({ ...t, k: Math.max(0.3, Math.min(2, t.k + delta)) }));
  };
  const onMouseDown = (e) => {
    if (e.target.closest('[data-node]')) return;
    dragRef.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
  };
  const onMouseMove = (e) => {
    if (!dragRef.current) return;
    const { x, y, tx, ty } = dragRef.current;
    setTransform(t => ({ ...t, x: tx + (e.clientX - x), y: ty + (e.clientY - y) }));
  };
  const onMouseUp = () => { dragRef.current = null; };

  return (
    <div
      ref={hostRef}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', cursor: dragRef.current ? 'grabbing' : 'grab', zIndex: 1 }}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* zoom controls */}
      <div style={{ position: 'absolute', bottom: 16, right: 16, zIndex: 5, display: 'flex', gap: 4, background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: 4, boxShadow: 'var(--shadow-sm)' }}>
        <button onClick={() => setTransform(t => ({ ...t, k: Math.max(0.3, t.k - 0.15) }))} style={{ width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 4, color: 'var(--text-secondary)' }}>−</button>
        <div className="mono" style={{ width: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--text-secondary)' }}>{Math.round(transform.k * 100)}%</div>
        <button onClick={() => setTransform(t => ({ ...t, k: Math.min(2, t.k + 0.15) }))} style={{ width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 4, color: 'var(--text-secondary)' }}>+</button>
        <div style={{ width: 1, background: 'var(--border-subtle)', margin: '4px 2px' }}/>
        <button onClick={() => { if(!hostRef.current) return; const r=hostRef.current.getBoundingClientRect(); const k=Math.min(0.9, r.width/maxX, r.height/maxY); setTransform({x:(r.width-maxX*k)/2, y:(r.height-maxY*k)/2, k}); }} style={{ padding: '0 10px', height: 28, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 4, fontSize: 11, color: 'var(--text-secondary)' }}>Fit</button>
      </div>

      <div style={{ position: 'absolute', top: 0, left: 0, transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`, transformOrigin: '0 0', transition: dragRef.current ? 'none' : 'transform 120ms ease-out' }}>
        <svg width={maxX} height={maxY} style={{ display: 'block', overflow: 'visible', pointerEvents: 'none' }}>
          <defs>
            <marker id="gv-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--border-strong)"/>
            </marker>
          </defs>
          {Object.entries(parentOf).map(([child, parent], i) => {
            const pa = posById[parent], pb = posById[child];
            if (!pa || !pb) return null;
            const x1 = pa.x + NODE_W, y1 = pa.y + NODE_H / 2;
            const x2 = pb.x, y2 = pb.y + NODE_H / 2;
            const mx = (x1 + x2) / 2;
            return (
              <path key={i}
                d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                stroke="var(--border-strong)" strokeWidth="1.25" fill="none" opacity="0.7"/>
            );
          })}
        </svg>
        {positioned.map(p => {
          const t = HIERARCHY_TYPES.find(h => h.id === p.type);
          const active = selected === p.id;
          return (
            <div
              key={p.id}
              data-node
              onClick={() => onSelect(p.id)}
              style={{
                position: 'absolute', left: p.x, top: p.y,
                width: NODE_W, height: NODE_H,
                background: 'var(--surface-raised)',
                border: active ? `1.5px solid ${t?.color}` : '1px solid var(--border-subtle)',
                borderRadius: 8,
                boxShadow: active ? `0 0 0 4px oklch(from ${t?.color} l c h / 0.18), var(--shadow-md)` : 'var(--shadow-sm)',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                padding: '8px 12px 8px 16px',
                transition: 'box-shadow 160ms, border-color 160ms, transform 160ms',
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: t?.color, borderTopLeftRadius: 8, borderBottomLeftRadius: 8 }}/>
              <div className="mono" style={{ fontSize: 9, fontWeight: 600, color: t?.color, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 3 }}>{t?.label}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.label}</div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3 }}>{p.flows || 0} flows · ${p.cost || 0}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NodeDetailsStrip({ node, totalComponents }) {
  const t = node ? HIERARCHY_TYPES.find(h => h.id === node.type) : null;
  // Compute totals from the actual node (stable placeholder numbers derived from node id)
  const seed = node ? (String(node.id).length * 7 + node.label.length * 13) : 0;
  const drivers = node ? (seed % 5) + 1 : 0;
  const impactKg = node ? (12 + (seed % 40) + (seed % 11) / 10).toFixed(2) : '—';
  const costUsd = node?.cost ?? 0;
  const flowsCount = node?.flows ?? 0;
  const sampleFlows = (typeof DEMO_FLOWS !== 'undefined' ? DEMO_FLOWS : []).slice(0, 3);

  return (
    <div style={{
      height: 128, background: 'var(--surface-base)',
      borderTop: '1px solid var(--border-subtle)', flexShrink: 0,
      display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.6fr',
      fontFamily: 'var(--font-ui)', overflow: 'hidden',
    }}>
      {/* Col 1: identity */}
      <div style={{ padding: '14px 20px', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        {node ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="mono" style={{ fontSize: 9, color: t?.color, background: 'oklch(from ' + t?.color + ' l c h / 0.16)', padding: '2px 7px', borderRadius: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{t?.label}</span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>ID · {node.id}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.label}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {t?.label === 'Product' && 'Top-level functional unit. Inherits region and method from the case.'}
              {t?.label === 'Machine/Line' && 'Equipment line aggregating downstream subprocesses.'}
              {t?.label === 'Subprocess' && 'Named operation stage — groups related elemental tasks.'}
              {t?.label === 'Operation' && 'Discrete processing step. Drives labor + energy demand.'}
              {t?.label === 'Elemental Task' && 'Leaf node — attaches drivers and environmental flows.'}
            </div>
          </>
        ) : (
          <>
            <div className="mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600 }}>No selection</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>Click any node to inspect</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Showing <span className="mono" style={{ color: 'var(--text-secondary)' }}>{totalComponents}</span> of <span className="mono">143</span> components in this case. Drag to pan, scroll to zoom.</div>
          </>
        )}
      </div>

      {/* Col 2: metrics */}
      <div style={{ padding: '14px 20px', borderRight: '1px solid var(--border-subtle)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', alignContent: 'center', minWidth: 0 }}>
        <MetricMini label="Flows" value={node ? flowsCount : '—'}/>
        <MetricMini label="Drivers" value={node ? drivers : '—'}/>
        <MetricMini label="Cost" value={node ? '$' + costUsd : '—'}/>
        <MetricMini label="Impact" value={node ? impactKg : '—'} unit={node ? 'kg CO₂-eq' : ''}/>
      </div>

      {/* Col 3: flows preview */}
      <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600 }}>Top flows</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }}/>
          <span style={{ color: 'var(--signal-success)', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}><span className="badge-dot" style={{ background: 'var(--signal-success)' }}/> Auto-saving</span>
        </div>
        {node ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0 }}>
            {sampleFlows.map((f, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto auto', alignItems: 'center', gap: 8, padding: '4px 0', borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)', fontSize: 12 }}>
                <span style={{ fontSize: 8.5, padding: '2px 5px', borderRadius: 3, textAlign: 'center', background: f.dir === 'IN' ? 'oklch(from var(--signal-info) l c h / 0.18)' : 'oklch(from var(--signal-warn) l c h / 0.18)', color: f.dir === 'IN' ? 'var(--signal-info)' : 'var(--signal-warn)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{f.dir}</span>
                <span style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.substance}</span>
                <span className="mono" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{f.amount.toFixed(2)}</span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 10.5, minWidth: 32 }}>{f.unit}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Select a node to preview its environmental flows here.</div>
        )}
      </div>
    </div>
  );
}

function MetricMini({ label, value, unit }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span className="mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600 }}>{label}</span>
      <span className="mono" style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value}{unit ? <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: 4 }}>{unit}</span> : null}
      </span>
    </div>
  );
}

function InspectorPanel({ node }) {
  const t = HIERARCHY_TYPES.find(h => h.id === node.type);
  return (
    <div style={{ padding: 0 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span className="mono" style={{ fontSize: 10, color: t?.color, background: 'oklch(from ' + t?.color + ' l c h / 0.15)', padding: '2px 6px', borderRadius: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t?.label}</span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{node.label}</div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>ID: {node.id}</div>
      </div>

      <InspectorSection title="Properties" defaultOpen={true}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label className="label">Quantity</label>
            <input className="input" defaultValue="1" style={{ height: 32, fontSize: 13 }}/>
          </div>
          <div>
            <label className="label">Unit</label>
            <input className="input" defaultValue="unit" style={{ height: 32, fontSize: 13 }}/>
          </div>
          <div style={{ gridColumn: '1/3' }}>
            <label className="label">Description</label>
            <textarea className="input" defaultValue="Coating deposition stage for cathode active material." style={{ height: 60, padding: 8, fontSize: 12, resize: 'vertical' }}/>
          </div>
        </div>
      </InspectorSection>

      <InspectorSection title="Environmental Flows" count={node.flows || 0}>
        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 6, overflow: 'hidden' }}>
          {DEMO_FLOWS.slice(0, 4).map((f, i) => (
            <div key={f.id} style={{ padding: '10px 12px', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: f.dir === 'IN' ? 'oklch(from var(--signal-info) l c h / 0.18)' : 'oklch(from var(--signal-warn) l c h / 0.18)', color: f.dir === 'IN' ? 'var(--signal-info)' : 'var(--signal-warn)', fontWeight: 600 }}>{f.dir}</span>
              <span style={{ flex: 1, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.substance}</span>
              <span className="mono" style={{ color: 'var(--text-secondary)' }}>{fmtNum(f.amount, 2)}</span>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{f.unit}</span>
            </div>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}><Icon name="plus" size={12}/> Add flow</button>
      </InspectorSection>

      <InspectorSection title="Costs">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {['Labor', 'Energy', 'Material', 'Transport', 'Equipment', 'Overhead'].map((c, i) => (
            <div key={c}>
              <label className="label" style={{ fontSize: 11 }}>{c}</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: 8, color: 'var(--text-tertiary)', fontSize: 13 }}>$</span>
                <input className="input mono" defaultValue={[180, 120, 420, 0, 180, 80][i]} style={{ height: 30, fontSize: 12, paddingLeft: 22 }}/>
              </div>
            </div>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}><Icon name="zap" size={12}/> Auto-fill from BLS + EIA</button>
      </InspectorSection>

      <div style={{ padding: 16, borderTop: '1px solid var(--border-subtle)', marginTop: 'auto', display: 'flex', gap: 8, position: 'sticky', bottom: 0, background: 'var(--surface-base)' }}>
        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--signal-error)' }}>Delete</button>
        <div style={{ flex: 1 }}/>
        <button className="btn btn-primary btn-sm">Save</button>
      </div>
    </div>
  );
}

function InspectorSection({ title, count, children, defaultOpen = true }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <button onClick={() => setOpen(!open)} style={{ width: '100%', padding: '12px 20px', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
        <Icon name="chevron-down" size={12} style={{ color: 'var(--text-tertiary)', transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform 140ms' }}/>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1, textAlign: 'left' }}>{title}</span>
        {count !== undefined && <span className="mono chip" style={{ fontSize: 10, padding: '1px 6px' }}>{count}</span>}
      </button>
      {open && <div style={{ padding: '4px 20px 16px' }}>{children}</div>}
    </div>
  );
}

Object.assign(window, { HomePage, ProjectPage, CaseEditorPage });
