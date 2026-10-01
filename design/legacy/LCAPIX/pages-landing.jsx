// pages-landing.jsx — Landing page + Auth

function LandingPage({ onNav }) {
  const [faqOpen, setFaqOpen] = React.useState(0);
  const faqs = [
    { q: 'How is LCAPIX different from openLCA / SimaPro?', a: 'We run multiple valuation methods simultaneously (CML, ReCiPe, TRACI) and show cost and environmental impact in the same view. No desktop install, no license dongles — just a browser.' },
    { q: 'Is it ISO 14040/14044 compliant?', a: 'Yes. Every PDF export includes goal & scope, system boundaries, data quality assessment, and source attribution for every factor used.' },
    { q: 'What valuation methods are supported?', a: 'CML 2001, ReCiPe Midpoint (H), TRACI 2.1 out of the box. CED and IPCC GWP available as separate modules.' },
    { q: 'Can I import my existing LCA data?', a: 'Import openLCA JSON, Excel, and CSV. We map substances via CAS + PubChem so your factors keep their provenance.' },
    { q: 'Do I need API keys?', a: 'Free tier runs on our bundled factor pack. For live grid intensity (Electricity Maps) or regional cost (BLS/EIA) you bring your own keys.' },
    { q: "What's the free tier limit?", a: '3 projects, 100 components per project, unlimited assessments. Team features and audit logs on Pro.' },
  ];

  const features = [
    { icon: 'tree', title: 'Process hierarchies', desc: '5-tier tree from Product down to Elemental Task. Drag to restructure, debounced auto-save.' },
    { icon: 'layers', title: 'Multiple methods', desc: 'CML 2001, ReCiPe, TRACI side by side. Same inputs, different answers — that\'s science.' },
    { icon: 'globe', title: 'Region-aware', desc: 'Grid carbon via Electricity Maps, labor rates via BLS occupation codes. US, EU, APAC.' },
    { icon: 'dollar', title: 'Cost × impact tradeoffs', desc: '"For +$240 you cut 28% CO₂." The commercial edge your engineers actually need.' },
    { icon: 'file', title: 'ISO PDF reports', desc: 'Source-attributed per factor. ISO 14040/14044 compliant. Goal & scope to interpretation.' },
    { icon: 'database', title: 'Open data', desc: '5,234 factors from openLCA + 1,842 PubChem substances. CAS-mapped provenance.' },
  ];

  return (
    <div className="app-shell" style={{ background: 'var(--surface-base)', minHeight: '100%' }}>
      {/* Sticky nav — glass */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50, height: 72,
        background: 'rgba(248, 250, 248, 0.78)',
        backdropFilter: 'blur(24px) saturate(1.4)', WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
        display: 'flex', alignItems: 'center', padding: '0 64px',
      }}>
        <Logo size={22}/>
        <nav style={{ display: 'flex', gap: 4, marginLeft: 64 }}>
          {['Product', 'Pricing', 'Docs', 'Changelog'].map(l => (
            <button key={l} style={{ background: 'transparent', border: 'none', padding: '8px 14px', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 500, letterSpacing: '-0.005em' }}>{l}</button>
          ))}
        </nav>
        <div style={{ flex: 1 }}/>
        <button className="btn btn-tertiary btn-sm" onClick={() => onNav('login')}>Log in</button>
        <button className="btn btn-primary btn-sm" onClick={() => onNav('signup')} style={{ marginLeft: 12 }}>
          Sign up <Icon name="arrow-right" size={14}/>
        </button>
      </div>

      {/* Hero — Botanical atmosphere */}
      <section className="botanical-atmosphere" style={{
        position: 'relative',
        padding: '80px 64px 96px',
        overflow: 'hidden',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: 64, alignItems: 'end' }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 28 }}>Built for practitioners · ISO 14040/14044</div>
              <h1 className="display display-lg" style={{
                margin: 0, color: 'var(--text-primary)',
              }}>
                Built for sustainability engineers.<br/>
                Not <span style={{
                  color: 'var(--primary)',
                  fontStyle: 'italic',
                  fontWeight: 600,
                }}>greenwash</span>.
              </h1>
            </div>
            {/* Offset display number — editorial */}
            <div style={{ textAlign: 'right', paddingBottom: 12 }}>
              <div className="label-sm" style={{ color: 'var(--text-tertiary)', marginBottom: 8 }}>Factors indexed</div>
              <div className="mono" style={{ fontSize: 72, fontWeight: 500, color: 'var(--primary)', letterSpacing: '-0.04em', lineHeight: 1 }}>5,234</div>
              <div className="label-sm" style={{ marginTop: 6, color: 'var(--text-tertiary)' }}>openLCA · PubChem · EIA</div>
            </div>
          </div>
          <p style={{ fontSize: 18, color: 'var(--text-secondary)', maxWidth: 620, marginTop: 24, lineHeight: 1.55 }}>
            Run life-cycle assessments with cost and environmental impact in the same view. Import factors from openLCA, PubChem, and Electricity Maps. Export ISO-compliant PDF reports.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 32, flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-lg" onClick={() => onNav('signup')}>
              Get started free <Icon name="arrow-right" size={16}/>
            </button>
            <button className="btn btn-secondary btn-lg">Book a demo</button>
          </div>
          <div style={{ marginTop: 40, display: 'flex', alignItems: 'center', gap: 16, color: 'var(--text-tertiary)', fontSize: 13 }}>
            <div style={{ width: 32, height: 1, background: 'var(--border-subtle)' }}/>
            <span>Used on <span style={{ color: 'var(--text-secondary)' }}>EV batteries</span> · <span style={{ color: 'var(--text-secondary)' }}>Consumer products</span> · <span style={{ color: 'var(--text-secondary)' }}>Industrial processes</span></span>
          </div>

          {/* product screenshot mockup */}
          <div style={{ marginTop: 72, position: 'relative' }}>
            <div style={{
              position: 'absolute', inset: '-40px', borderRadius: 24,
              background: 'radial-gradient(ellipse at center, var(--brand-glow), transparent 60%)',
              pointerEvents: 'none',
            }}/>
            <HeroMockup/>
          </div>
        </div>
      </section>

      {/* Same input, three methods */}
      <section style={{ padding: '96px 64px', background: 'var(--surface-overlay)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>Same input, three methods</div>
          <h2 className="display display-md" style={{ margin: 0, marginBottom: 16 }}>
            Different methods. Different answers.<br/>
            <span style={{ color: 'var(--text-tertiary)' }}>We show you all three.</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 56, maxWidth: 560 }}>Same 60 kWh EV battery pack. Same bill of materials. Three ISO-recognized valuation methods.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {DEMO_METHODS.map((m, i) => (
              <div key={m.id} className="card" style={{ padding: '36px 32px', boxShadow: 'var(--shadow-sm)' }}>
                <div className="label-sm" style={{ marginBottom: 24, color: 'var(--primary)' }}>{m.name}</div>
                <div className="mono" style={{ fontSize: 44, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.025em', lineHeight: 1 }}>
                  {fmtNum(m.value, 2)}
                </div>
                <div className="label-sm" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}>kg CO₂-eq</div>
                <div className="divider-tonal" style={{ margin: '24px 0 16px' }}/>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{m.note}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features — asymmetric editorial grid, tonal only */}
      <section style={{ padding: '128px 64px 96px 128px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 64, marginBottom: 80, alignItems: 'end' }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 16 }}>What's inside</div>
              <h2 className="display display-md" style={{ margin: 0 }}>
                Everything an LCA<br/>practitioner needs.
              </h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 17, lineHeight: 1.55, margin: 0, paddingBottom: 8 }}>
              Six capabilities, all in one browser tab — no desktop install, no license dongles, no rainbow dashboards.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
            {features.map((f, i) => (
              <div key={f.title} className="card card-hover" style={{ padding: 32 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 10,
                  background: 'var(--brand-subtle)',
                  color: 'var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28,
                }}>
                  <Icon name={f.icon} size={22}/>
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 600, margin: 0, marginBottom: 10, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works — tonal sectioning, no connector line */}
      <section style={{ padding: '96px 64px', background: 'var(--surface-overlay)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ marginBottom: 64 }}>
            <div className="eyebrow" style={{ marginBottom: 16 }}>How it works</div>
            <h2 className="display display-md" style={{ margin: 0 }}>Three steps to a defensible number.</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 48 }}>
            {[
              { n: '01', t: 'Build tree', d: 'Model your process as Product → Machine → Subprocess → Operation → Task. Drag to restructure; auto-save debounced.' },
              { n: '02', t: 'Pick method + region', d: 'Choose CML / ReCiPe / TRACI and a grid region. Factors auto-populate from openLCA & PubChem.' },
              { n: '03', t: 'Run, compare, export', d: 'Calculate, compare scenarios, export a PDF with ISO-compliant source attribution for every factor used.' },
            ].map(s => (
              <div key={s.n}>
                <div className="mono" style={{ fontSize: 64, fontWeight: 500, color: 'var(--primary)', marginBottom: 24, letterSpacing: '-0.03em', lineHeight: 1 }}>{s.n}</div>
                <h3 className="title" style={{ margin: 0, marginBottom: 12, color: 'var(--text-primary)' }}>{s.t}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section style={{ padding: '128px 64px 96px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>Vs the alternatives</div>
          <h2 className="display display-md" style={{ margin: 0, marginBottom: 48 }}>Pick your trade-offs.</h2>
          <ComparisonTable/>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '96px 64px', background: 'var(--surface-overlay)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>FAQ</div>
          <h2 className="display display-md" style={{ margin: 0, marginBottom: 48 }}>Questions?</h2>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {faqs.map((f, i) => (
              <div key={i} style={{ padding: '0 28px' }}>
                <button onClick={() => setFaqOpen(faqOpen === i ? -1 : i)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', padding: '24px 0',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--text-primary)', fontSize: 15, fontWeight: 500, fontFamily: 'var(--font-ui)',
                  textAlign: 'left', letterSpacing: '-0.005em',
                }}>
                  <span style={{ flex: 1 }}>{f.q}</span>
                  <span style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: faqOpen === i ? 'var(--brand-gradient)' : 'var(--surface-overlay)',
                    color: faqOpen === i ? 'var(--on-primary)' : 'var(--primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 500, transition: 'all 200ms',
                    transform: faqOpen === i ? 'rotate(45deg)' : 'none',
                  }}>+</span>
                </button>
                {faqOpen === i && (
                  <div className="fade-in" style={{ padding: '0 0 28px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: '92%' }}>
                    {f.a}
                  </div>
                )}
                {i < faqs.length - 1 && <div style={{ height: 1, background: 'var(--outline-variant)', opacity: 0.35 }}/>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA — Veridian Light */}
      <section className="veridian-glow" style={{ padding: '120px 64px', textAlign: 'center' }}>
        <div className="eyebrow" style={{ marginBottom: 16 }}>Ready when you are</div>
        <h2 className="display display-md" style={{ margin: 0, marginBottom: 32, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
          Run your first assessment<br/>in the next sixty seconds.
        </h2>
        <button className="btn btn-primary btn-lg" onClick={() => onNav('signup')}>
          Get started free <Icon name="arrow-right" size={16}/>
        </button>
      </section>

      {/* Footer */}
      <footer style={{ padding: '56px 40px 32px', background: 'var(--surface-base)', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr repeat(3, 1fr)', gap: 40, marginBottom: 40 }}>
            <div>
              <Logo size={20}/>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 16, maxWidth: 280, lineHeight: 1.55 }}>
                Life cycle assessment for engineers who ship.
              </p>
            </div>
            {[
              { t: 'Product', links: ['Features', 'Pricing', 'Changelog', 'Roadmap'] },
              { t: 'Resources', links: ['Docs', 'API reference', 'Methodology', 'Blog'] },
              { t: 'Legal', links: ['Privacy', 'Terms', 'Security', 'DPA'] },
            ].map(col => (
              <div key={col.t}>
                <div className="eyebrow" style={{ marginBottom: 14 }}>{col.t}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {col.links.map(l => <a key={l} href="#" style={{ color: 'var(--text-secondary)', fontSize: 13, textDecoration: 'none' }}>{l}</a>)}
                </div>
              </div>
            ))}
          </div>
          <div style={{ paddingTop: 24, borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-tertiary)' }}>
            <div>© 2026 LCAPIX · Privacy · Terms · Security</div>
            <div style={{ display: 'flex', gap: 16 }}>
              <span>GitHub</span><span>LinkedIn</span><span>X</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function HeroMockup() {
  // Stylized product screenshot — shows results dashboard
  return (
    <div style={{
      border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden',
      background: 'var(--surface-sunken)', boxShadow: 'var(--shadow-overlay)',
      position: 'relative',
    }}>
      {/* Mock window bar */}
      <div style={{ height: 36, background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px' }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'oklch(0.40 0.02 240)' }}/>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'oklch(0.40 0.02 240)' }}/>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'oklch(0.40 0.02 240)' }}/>
        <div className="mono" style={{ marginLeft: 20, fontSize: 11, color: 'var(--text-tertiary)' }}>lcapix.io / project / ev-mfg / baseline-2025 / results</div>
      </div>
      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24, minHeight: 480 }}>
        {/* Left: chart */}
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>TOTAL IMPACT · GLOBAL WARMING</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 24 }}>
            <div className="mono" style={{ fontSize: 48, fontWeight: 600, color: 'var(--brand-primary)', letterSpacing: '-0.02em' }}>126.82</div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>kg CO₂-eq</div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--signal-success)', fontSize: 13 }}>
              <Icon name="arrow-down" size={14}/>
              <span className="mono">−2.1%</span>
              <span style={{ color: 'var(--text-tertiary)' }}>vs last run</span>
            </div>
          </div>
          {/* Bar chart */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {DEMO_CONTRIBUTORS.map((c, i) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 140, fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                <div style={{ flex: 1, height: 20, background: 'var(--surface-overlay)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ width: `${c.pct * 2.1}%`, height: '100%', background: 'var(--brand-primary)', opacity: 1 - i * 0.12 }}/>
                </div>
                <div className="mono" style={{ width: 56, fontSize: 12, color: 'var(--text-primary)', textAlign: 'right' }}>{fmtNum(c.value, 1)}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Right: category tiles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="eyebrow">IMPACT CATEGORIES</div>
          {DEMO_CATEGORIES.slice(0, 5).map(cat => (
            <div key={cat.id} style={{ padding: 12, border: '1px solid var(--border-subtle)', borderRadius: 6, background: 'var(--surface-raised)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>{cat.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span className="mono" style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>{cat.value < 0.01 ? cat.value.toExponential(2) : fmtNum(cat.value, cat.value < 1 ? 4 : 2)}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{cat.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ComparisonTable() {
  const cols = ['LCAPIX', 'SimaPro', 'openLCA', 'GaBi'];
  const rows = [
    ['Multi-method side-by-side', true, false, false, false],
    ['Cost + impact combined',    true, false, false, true],
    ['Region-aware grid factors', true, false, true, true],
    ['Free tier',                 true, false, true, false],
    ['Modern web UI',             true, false, false, false],
    ['Source attribution per factor', true, true, true, true],
  ];
  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface-raised)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr repeat(4, 1fr)', background: 'var(--surface-overlay)' }}>
        <div style={{ padding: '16px 20px', fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500 }}>Capability</div>
        {cols.map((c, i) => (
          <div key={c} style={{ padding: '16px 20px', fontSize: 13, fontWeight: 600, color: i === 0 ? 'var(--brand-primary)' : 'var(--text-secondary)', textAlign: 'center', background: i === 0 ? 'var(--brand-subtle)' : 'transparent' }}>{c}</div>
        ))}
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr repeat(4, 1fr)', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ padding: '14px 20px', fontSize: 14, color: 'var(--text-primary)' }}>{r[0]}</div>
          {r.slice(1).map((v, j) => (
            <div key={j} style={{
              padding: '14px 20px', textAlign: 'center',
              background: j === 0 ? 'oklch(from var(--brand-primary) l c h / 0.08)' : 'transparent',
              color: v ? (j === 0 ? 'var(--brand-primary)' : 'var(--text-primary)') : 'var(--text-disabled)',
            }}>
              {v ? <Icon name="check" size={16} style={{ margin: '0 auto' }}/> : <span style={{ opacity: 0.4 }}>—</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ——— Auth pages ———
function AuthPage({ mode = 'login', onNav }) {
  const isSignup = mode === 'signup';
  return (
    <div style={{ display: 'flex', minHeight: '100%', background: 'var(--surface-base)' }}>
      {/* left pane */}
      <div style={{ flex: '0 0 44%', display: 'flex', flexDirection: 'column', padding: '48px 56px', minHeight: '100%' }}>
        <div onClick={() => onNav('landing')} style={{ cursor: 'pointer' }}><Logo size={20}/></div>
        <div style={{ margin: 'auto 0', maxWidth: 400 }}>
          <h1 className="display" style={{ fontSize: 32, fontWeight: 600, margin: 0, marginBottom: 8, letterSpacing: '-0.01em' }}>
            {isSignup ? 'Create your account.' : 'Welcome back.'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0, marginBottom: 32 }}>
            {isSignup ? 'Start running LCAs in under a minute.' : 'Sign in to continue your assessments.'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {isSignup && (
              <div>
                <label className="label">Name</label>
                <input className="input" placeholder="Your full name" defaultValue=""/>
              </div>
            )}
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" placeholder="you@company.com" defaultValue="kavish@example.com"/>
            </div>
            <div>
              <label className="label">Password</label>
              <div style={{ position: 'relative' }}>
                <input className="input" type="password" placeholder={isSignup ? 'At least 10 characters' : '••••••••'} defaultValue="••••••••••••"/>
                <button style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 8 }}>
                  <Icon name="eye" size={16}/>
                </button>
              </div>
              {isSignup && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>We'll use your work email domain for team features.</div>}
            </div>

            <button className="btn btn-primary" style={{ height: 44, justifyContent: 'center', marginTop: 8 }} onClick={() => onNav('home')}>
              {isSignup ? 'Create account' : 'Log in'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0', color: 'var(--text-tertiary)', fontSize: 12 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }}/>
              <span>or</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }}/>
            </div>

            <button className="btn btn-secondary" style={{ height: 44, justifyContent: 'center' }}>
              <Icon name="google" size={16}/> Continue with Google
            </button>

            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 16 }}>
              {isSignup ? (
                <>Have an account? <button onClick={() => onNav('login')} style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 13, padding: 0 }}>Log in →</button></>
              ) : (
                <>New to LCAPIX? <button onClick={() => onNav('signup')} style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 13, padding: 0 }}>Create account →</button></>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* right pane */}
      <div style={{
        flex: 1, background: 'var(--surface-sunken)', borderLeft: '1px solid var(--border-subtle)',
        display: 'flex', flexDirection: 'column', padding: '80px 72px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ margin: 'auto 0', maxWidth: 520 }}>
          <div className="eyebrow" style={{ marginBottom: 28, color: 'var(--brand-primary)' }}>·  ·  ·</div>
          <blockquote style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 400, fontSize: 22, lineHeight: 1.45, color: 'var(--text-secondary)', margin: 0, marginBottom: 40 }}>
            "Three methods, same battery, three different answers. That's science."
          </blockquote>

          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
            {DEMO_METHODS.map((m, i) => (
              <div key={m.id} style={{
                padding: '16px 20px',
                borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',
                display: 'flex', alignItems: 'baseline', gap: 16,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{m.note}</div>
                </div>
                <div className="mono" style={{ fontSize: 22, fontWeight: 500, color: 'var(--brand-primary)' }}>
                  {fmtNum(m.value, 2)} <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>kg CO₂-eq</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, background: 'var(--brand-primary)', opacity: 0.6 }}/>
      </div>
    </div>
  );
}

Object.assign(window, { LandingPage, AuthPage });
