// shared.jsx — logo, icons, demo data, small primitives

// ——— Logo ———
function LogoMark({ size = 20 }) {
  // 3 stacked squares, geometric, emerald on dark
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 20 20" style={{ display: 'block' }}>
      <rect x="0" y="0" width="8" height="8" rx="1" fill="currentColor" opacity="0.95"/>
      <rect x="10" y="2" width="8" height="8" rx="1" fill="currentColor" opacity="0.65"/>
      <rect x="4" y="10" width="8" height="8" rx="1" fill="currentColor" opacity="0.40"/>
    </svg>
  );
}

function Logo({ size = 20, showWordmark = true }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--brand-primary)' }}>
      <LogoMark size={size}/>
      {showWordmark && <span className="logo-wordmark" style={{ fontSize: size * 0.82 }}>LCAPIX</span>}
    </div>
  );
}

// ——— Icons (inline, minimal Lucide-ish stroke icons) ———
function Icon({ name, size = 16, style }) {
  const s = size;
  const common = { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', style: { display: 'block', ...style } };
  switch (name) {
    case 'search': return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/></svg>;
    case 'tree': return <svg {...common}><rect x="3" y="3" width="7" height="4" rx="1"/><rect x="14" y="10" width="7" height="4" rx="1"/><rect x="14" y="17" width="7" height="4" rx="1"/><path d="M6.5 7v7M6.5 12h7.5M6.5 19h7.5"/></svg>;
    case 'layers': return <svg {...common}><path d="m12 2 10 5-10 5L2 7l10-5Z"/><path d="m2 12 10 5 10-5"/><path d="m2 17 10 5 10-5"/></svg>;
    case 'globe': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>;
    case 'dollar': return <svg {...common}><path d="M12 2v20M17 6H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H6"/></svg>;
    case 'file': return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>;
    case 'database': return <svg {...common}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/></svg>;
    case 'plus': return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
    case 'arrow-right': return <svg {...common}><path d="M5 12h14M13 5l7 7-7 7"/></svg>;
    case 'arrow-up': return <svg {...common}><path d="M12 19V5M5 12l7-7 7 7"/></svg>;
    case 'arrow-down': return <svg {...common}><path d="M12 5v14M5 12l7 7 7-7"/></svg>;
    case 'arrow-up-right': return <svg {...common}><path d="M7 17 17 7M7 7h10v10"/></svg>;
    case 'check': return <svg {...common}><path d="M20 6 9 17l-5-5"/></svg>;
    case 'x': return <svg {...common}><path d="M18 6 6 18M6 6l12 12"/></svg>;
    case 'chevron-right': return <svg {...common}><path d="m9 6 6 6-6 6"/></svg>;
    case 'chevron-down': return <svg {...common}><path d="m6 9 6 6 6-6"/></svg>;
    case 'chevron-left': return <svg {...common}><path d="m15 6-6 6 6 6"/></svg>;
    case 'menu': return <svg {...common}><path d="M3 6h18M3 12h18M3 18h18"/></svg>;
    case 'more': return <svg {...common}><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>;
    case 'eye': return <svg {...common}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'google': return <svg viewBox="0 0 24 24" width={s} height={s} style={{ display: 'block' }}><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.07 5.07 0 0 1-2.2 3.32v2.76h3.55c2.08-1.92 3.29-4.74 3.29-8.09Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.55-2.76c-.98.66-2.23 1.06-3.73 1.06-2.87 0-5.3-1.94-6.16-4.54H2.17v2.85A10.997 10.997 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.05H2.17A11 11 0 0 0 1 12c0 1.77.42 3.45 1.17 4.95l3.67-2.85Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.17 7.05l3.67 2.85C6.7 7.32 9.13 5.38 12 5.38Z"/></svg>;
    case 'play': return <svg {...common}><polygon points="6 3 20 12 6 21 6 3"/></svg>;
    case 'run': return <svg {...common}><polygon points="6 4 20 12 6 20 6 4"/></svg>;
    case 'grid': return <svg {...common}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>;
    case 'list': return <svg {...common}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>;
    case 'filter': return <svg {...common}><path d="M22 3H2l8 10v6l4 2v-8z"/></svg>;
    case 'settings': return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.36.14.67.37.91.65.24.29.39.64.43 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>;
    case 'bell': return <svg {...common}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
    case 'zap': return <svg {...common}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
    case 'shield': return <svg {...common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>;
    case 'download': return <svg {...common}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>;
    case 'share': return <svg {...common}><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/></svg>;
    case 'clock': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case 'chart-bar': return <svg {...common}><path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="7"/><rect x="12" y="7" width="3" height="11"/><rect x="17" y="14" width="3" height="4"/></svg>;
    case 'circle': return <svg {...common}><circle cx="12" cy="12" r="9"/></svg>;
    case 'dot': return <svg {...common}><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>;
    case 'command': return <svg {...common}><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3Z"/></svg>;
    case 'sparkle': return <svg {...common}><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z"/></svg>;
    case 'box': return <svg {...common}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg>;
    case 'link': return <svg {...common}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;
    case 'refresh': return <svg {...common}><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/></svg>;
    case 'external': return <svg {...common}><path d="M15 3h6v6M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>;
    case 'activity': return <svg {...common}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>;
    case 'alert': return <svg {...common}><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0ZM12 9v4M12 17h.01"/></svg>;
    case 'leaf': return <svg {...common}><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/></svg>;
    case 'factory': return <svg {...common}><path d="M2 20h20V9l-6 4V9l-6 4V3H6v6l-4-1v12Z"/></svg>;
    case 'battery': return <svg {...common}><rect x="2" y="7" width="16" height="10" rx="2"/><path d="M22 11v2M6 11v2"/></svg>;
    case 'target': return <svg {...common}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>;
    default: return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="2"/></svg>;
  }
}

// ——— Status dot ———
function StatusDot({ status = 'success', size = 8 }) {
  const colorMap = {
    success: 'var(--signal-success)',
    warn: 'var(--signal-warn)',
    error: 'var(--signal-error)',
    info: 'var(--signal-info)',
    inactive: 'var(--text-disabled)',
  };
  return <span style={{ width: size, height: size, borderRadius: '50%', background: colorMap[status], display: 'inline-block', boxShadow: `0 0 0 3px ${colorMap[status].replace('var(--', 'oklch(from var(--').replace(')', ') l c h / 0.2)')}` }}/>;
}

// ——— Number formatting ———
function fmtNum(n, digits = 2) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function fmtInt(n) { return Number(n).toLocaleString('en-US'); }

// ——— Sparkline ———
function Sparkline({ data, color = 'var(--brand-primary)', width = 80, height = 24 }) {
  if (!data || !data.length) return null;
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ——— Mini horizontal bar ———
function MiniBar({ value, max = 100, color = 'var(--brand-primary)', height = 6 }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ width: '100%', height, background: 'var(--surface-overlay)', borderRadius: 999 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 260ms' }}/>
    </div>
  );
}

// ——— Page chrome wrapper for app (top bar + content) ———
function AppTopBar({ current, onNav }) {
  const links = [
    { id: 'home', label: 'Projects' },
    { id: 'library', label: 'Library' },
    { id: 'integrations', label: 'Integrations' },
    { id: 'guide', label: 'Docs' },
  ];
  return (
    <div style={{
      height: 56, background: 'var(--surface-base)', borderBottom: '1px solid var(--border-subtle)',
      display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, position: 'sticky', top: 0, zIndex: 50,
      flexWrap: 'nowrap', minWidth: 0,
    }}>
      <div style={{ cursor: 'pointer', flexShrink: 0 }} onClick={() => onNav?.('home')}><Logo size={18}/></div>
      <nav style={{ display: 'flex', gap: 2, marginLeft: 4, flexShrink: 0 }}>
        {links.map(l => (
          <button key={l.id} onClick={() => onNav?.(l.id)} style={{
            border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            padding: '6px 10px', borderRadius: 6, fontSize: 13, fontFamily: 'var(--font-ui)',
            color: current === l.id ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: current === l.id ? 500 : 400,
            background: current === l.id ? 'var(--surface-raised)' : 'transparent',
          }}>{l.label}</button>
        ))}
      </nav>
      <div style={{ flex: 1, minWidth: 8 }}/>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)',
        borderRadius: 6, padding: '0 8px', height: 30, fontSize: 12, color: 'var(--text-tertiary)',
        cursor: 'pointer', width: 160, flexShrink: 1, minWidth: 0, overflow: 'hidden',
      }}>
        <Icon name="search" size={13}/>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>Search…</span>
        <span className="mono" style={{ padding: '1px 5px', background: 'var(--surface-overlay)', borderRadius: 3, fontSize: 10, color: 'var(--text-secondary)', flexShrink: 0 }}>⌘K</span>
      </div>
      <button className="btn btn-ghost btn-sm" aria-label="notifications" style={{ flexShrink: 0, padding: 6 }}><Icon name="bell" size={15}/></button>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', background: 'var(--brand-subtle)',
        color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 600, fontSize: 13, cursor: 'pointer', flexShrink: 0,
      }}>KP</div>
    </div>
  );
}

// ——— Breadcrumb ———
function Breadcrumb({ items, onNav }) {
  return (
    <div style={{ height: 40, display: 'flex', alignItems: 'center', padding: '0 24px', fontSize: 13, color: 'var(--text-tertiary)', gap: 6, borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-base)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Icon name="chevron-right" size={12} style={{ opacity: 0.5 }}/>}
          {it.onClick || it.page ? (
            <button onClick={() => (it.onClick ? it.onClick() : onNav?.(it.page))} style={{ background: 'none', border: 'none', color: i === items.length - 1 ? 'var(--text-primary)' : 'var(--text-tertiary)', cursor: 'pointer', fontSize: 13, padding: 0, fontFamily: 'var(--font-ui)' }}>{it.label}</button>
          ) : (
            <span style={{ color: i === items.length - 1 ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{it.label}</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

Object.assign(window, {
  LogoMark, Logo, Icon, StatusDot, Sparkline, MiniBar, fmtNum, fmtInt, AppTopBar, Breadcrumb,
});
