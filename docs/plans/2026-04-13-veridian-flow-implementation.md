# LCAPIX v3 — Veridian Flow Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port the user-generated Veridian Flow mockups (stitch HTML + PNG) into the live Next.js app. Every page gets the new "Botanical Precision" design — light editorial surfaces, emerald gradients, IBM Plex Mono data, glass panels — while preserving all existing functionality and tests.

**Architecture:** Phased port, one page at a time. Phase 0 lays the foundation (fonts, tokens, shared components, M3-to-shadcn token bridge). Phases 1–10 port one page per phase, translating stitch HTML to React + wiring real API data. Phases 11–12 sweep for responsive + accessibility. User verifies each phase visually via Claude Preview before the next phase begins (human-in-the-loop).

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript strict, Tailwind CSS 4 (@theme in globals.css), shadcn/ui primitives, Recharts, react-hook-form, zod, zustand, next/font, lucide-react, vitest + @testing-library/react (added in Phase 0).

**Design reference:**
- Mockups: `stitch_lcapix_design_system_prompts/` (10 folders, each with `code.html` + `screen.png`)
- Design system: `stitch_lcapix_design_system_prompts/veridian_flow/DESIGN.md`
- Page prompts: `docs/plans/2026-04-13-page-design-prompts.md`
- Superseded: `docs/plans/2026-04-13-brand-redesign-design.md` (Data Cool direction — no longer followed; Veridian Flow replaces it)

---

## Ground rules for every task

- **Human-in-the-loop:** After each phase closes, stop. User verifies in Claude Preview and says "proceed" before the next phase starts.
- **Stitch HTML is the spec**, not the verbatim code. We port structure + styling, but React components replace div-soup, shadcn replaces inline HTML, and real API data replaces mock text.
- **No pushing to remote.** All commits local on `main`.
- **Existing tests stay green.** Phase 0 adds the testing library; every other phase preserves the 84 existing test passes.
- **No API / schema changes.** This is a visual overhaul only.
- **Material Design 3 tokens from stitch map to shadcn/Tailwind tokens via Phase 0.** Don't paste MD3 token names into app code; use our tokens.
- **Icons:** Stitch uses Material Symbols Outlined. Port to `lucide-react` (already installed). If a Lucide equivalent doesn't exist, fall back to a Material Symbols Next.js loader (future task).
- **Preview verification:** every page port ends with a screenshot via `mcp__Claude_Preview__preview_screenshot` that visually matches the corresponding `screen.png` mockup.

---

## Phase 0 — Foundation

Lay the design-system groundwork so every subsequent phase just inherits tokens.

### Task 0.1: Install @testing-library/react + related deps

**Files:** `package.json`

**Step 1: Install**

```bash
cd "/Users/kavishpandit/Desktop/lca/lca project v3"
/opt/homebrew/bin/pnpm add -D @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

**Step 2: Update `vitest.config.ts`** to add jsdom environment for component tests. Edit to extend the existing config:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['node_modules', '.next'],
    testTimeout: 10000,
    environmentMatchGlobs: [
      ['tests/components/**', 'jsdom'],
      ['tests/app/**', 'jsdom'],
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

**Step 3: Extend `tests/setup.ts`** so component tests get `@testing-library/jest-dom` matchers:

```typescript
// tests/setup.ts
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-do-not-use-in-prod';

// Only load DOM matchers when running in jsdom (component tests)
if (typeof window !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
}
```

**Step 4: Verify**

Run: `pnpm test`
Expected: 84 tests still pass (no regressions).

**Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts tests/setup.ts
git commit -m "chore(test): add @testing-library/react + jsdom for component tests"
```

### Task 0.2: Install fonts via next/font

**Files:** `app/layout.tsx`, `components/font-loader.ts` (new)

**Step 1: Replace Inter with Inter Tight + Inter Display + IBM Plex Mono**

Rewrite `app/layout.tsx`:

```tsx
import type React from "react"
import type { Metadata } from "next"
import { Inter_Tight, IBM_Plex_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"

const interTight = Inter_Tight({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
})

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
  weight: ["400", "500", "600"],
})

export const metadata: Metadata = {
  title: "LCAPIX — Botanical Precision in Sustainability Data",
  description: "Life-cycle assessment with cost + environmental impact in one view. CML · ReCiPe · TRACI methods. ISO 14040/14044 compliant.",
  generator: "LCAPIX v3",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${interTight.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased bg-background text-on-surface" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} themes={["light", "dark", "high-contrast"]}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

**Step 2: Verify**

Run dev server if not already up. Visit `http://localhost:3002/auth/login`. Body should render in Inter Tight.

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/
```

Expected: 200.

**Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(fonts): load Inter Tight + IBM Plex Mono via next/font"
```

### Task 0.3: Rewrite `app/globals.css` with Veridian Flow tokens

**Files:** `app/globals.css` (full rewrite of `:root` and `.dark` + add `@theme`)

Read the current globals.css first, then replace the token section with Veridian Flow M3 palette. The stitch config uses these M3 tokens:

```
background      #f8faf8   (off-white page bg)
surface         #f8faf8   (synonym for background)
surface-container-lowest  #ffffff
surface-container-low     #f2f4f2
surface-container         #eceeec
surface-container-high    #e6e9e7
surface-container-highest #e1e3e1
surface-bright  #f8faf8
surface-dim     #d8dad9
on-surface      #191c1b
on-surface-variant #3d4a41
on-background   #191c1b

primary         #006a44   (deep emerald)
primary-container #008558 (lighter emerald for gradient)
on-primary      #ffffff
primary-fixed   #7bfabb   (light emerald fill)
primary-fixed-dim #5ddda1
on-primary-fixed  #002112
on-primary-fixed-variant #005234

secondary       #29695b
secondary-container #acedda
on-secondary    #ffffff
on-secondary-container #2e6d5f

tertiary        #9f393c   (rose for warning/contrast)
tertiary-container #bf5152
tertiary-fixed  #ffdad8

error           #ba1a1a
error-container #ffdad6
on-error        #ffffff
on-error-container #93000a

outline         #6d7a71
outline-variant #bccabf
inverse-surface #2e3130
inverse-primary #5ddda1
```

**Step 1: Replace token block in globals.css**

Edit `app/globals.css` to replace the entire `:root { ... }` and `.dark { ... }` blocks. Keep the `@import "tailwindcss"` lines and the `@custom-variant` lines at top. Replace with:

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));
@custom-variant high-contrast (&:is(.high-contrast *));

/* Veridian Flow — Botanical Precision tokens (M3-based) */
:root {
  /* Backgrounds & surfaces */
  --background: #f8faf8;
  --surface: #f8faf8;
  --surface-container-lowest: #ffffff;
  --surface-container-low: #f2f4f2;
  --surface-container: #eceeec;
  --surface-container-high: #e6e9e7;
  --surface-container-highest: #e1e3e1;
  --surface-bright: #f8faf8;
  --surface-dim: #d8dad9;

  /* Foregrounds */
  --on-background: #191c1b;
  --on-surface: #191c1b;
  --on-surface-variant: #3d4a41;

  /* Primary (emerald) */
  --primary: #006a44;
  --primary-container: #008558;
  --on-primary: #ffffff;
  --on-primary-container: #f6fff6;
  --primary-fixed: #7bfabb;
  --primary-fixed-dim: #5ddda1;
  --on-primary-fixed: #002112;
  --on-primary-fixed-variant: #005234;

  /* Secondary */
  --secondary: #29695b;
  --secondary-container: #acedda;
  --secondary-fixed: #afefdd;
  --secondary-fixed-dim: #94d3c1;
  --on-secondary: #ffffff;
  --on-secondary-container: #2e6d5f;
  --on-secondary-fixed: #00201a;
  --on-secondary-fixed-variant: #065043;

  /* Tertiary (rose accent) */
  --tertiary: #9f393c;
  --tertiary-container: #bf5152;
  --tertiary-fixed: #ffdad8;
  --tertiary-fixed-dim: #ffb3b1;
  --on-tertiary: #ffffff;
  --on-tertiary-container: #fffbff;
  --on-tertiary-fixed: #410007;
  --on-tertiary-fixed-variant: #832429;

  /* Error */
  --error: #ba1a1a;
  --error-container: #ffdad6;
  --on-error: #ffffff;
  --on-error-container: #93000a;

  /* Outlines */
  --outline: #6d7a71;
  --outline-variant: #bccabf;

  /* Inverses (for floating surfaces / inverted dark patches) */
  --inverse-surface: #2e3130;
  --inverse-on-surface: #eff1ef;
  --inverse-primary: #5ddda1;
  --surface-tint: #006c46;

  /* Shadcn bridge — so existing components that use --background/--foreground/--primary still work */
  --foreground: var(--on-surface);
  --card: var(--surface-container-lowest);
  --card-foreground: var(--on-surface);
  --popover: var(--surface-container-lowest);
  --popover-foreground: var(--on-surface);
  --primary-foreground: var(--on-primary);
  --secondary-foreground: var(--on-secondary);
  --muted: var(--surface-container-low);
  --muted-foreground: var(--on-surface-variant);
  --accent: var(--surface-container);
  --accent-foreground: var(--on-surface);
  --destructive: var(--error);
  --destructive-foreground: var(--on-error);
  --border: oklch(from var(--outline-variant) l c h / 0.15);
  --input: var(--surface-container-low);
  --ring: var(--primary);

  /* Chart palette — 5-slot categorical, luminance matched to primary */
  --chart-1: #006a44;
  --chart-2: #008558;
  --chart-3: #29695b;
  --chart-4: #bf5152;
  --chart-5: #5ddda1;

  --radius: 0.375rem; /* md corner radius — matches stitch */

  /* Sidebar tokens */
  --sidebar: var(--surface-container-lowest);
  --sidebar-foreground: var(--on-surface);
  --sidebar-primary: var(--primary);
  --sidebar-primary-foreground: var(--on-primary);
  --sidebar-accent: var(--surface-container-low);
  --sidebar-accent-foreground: var(--on-surface);
  --sidebar-border: var(--outline-variant);
  --sidebar-ring: var(--primary);
}

/* Dark mode — same brand, inverted neutrals */
.dark {
  --background: #101413;
  --surface: #101413;
  --surface-container-lowest: #0b0e0d;
  --surface-container-low: #171b1a;
  --surface-container: #1c2120;
  --surface-container-high: #222725;
  --surface-container-highest: #2b312f;
  --surface-bright: #363c3a;
  --surface-dim: #0b0e0d;

  --on-background: #eff1ef;
  --on-surface: #eff1ef;
  --on-surface-variant: #bccabf;

  --primary: #5ddda1;
  --primary-container: #008558;
  --on-primary: #002112;
  --on-primary-container: #7bfabb;

  --secondary: #94d3c1;
  --secondary-container: #065043;
  --on-secondary: #00201a;
  --on-secondary-container: #afefdd;

  --tertiary: #ffb3b1;
  --tertiary-container: #832429;
  --on-tertiary: #410007;
  --on-tertiary-container: #ffdad8;

  --error: #ffb4ab;
  --error-container: #93000a;
  --on-error: #690005;
  --on-error-container: #ffdad6;

  --outline: #87938a;
  --outline-variant: #3d4a41;

  --inverse-surface: #eff1ef;
  --inverse-on-surface: #2e3130;
  --inverse-primary: #006a44;
}

/* Map tokens into Tailwind v4 @theme so utilities like `bg-background` resolve */
@theme inline {
  --color-background: var(--background);
  --color-surface: var(--surface);
  --color-surface-container-lowest: var(--surface-container-lowest);
  --color-surface-container-low: var(--surface-container-low);
  --color-surface-container: var(--surface-container);
  --color-surface-container-high: var(--surface-container-high);
  --color-surface-container-highest: var(--surface-container-highest);
  --color-on-background: var(--on-background);
  --color-on-surface: var(--on-surface);
  --color-on-surface-variant: var(--on-surface-variant);
  --color-primary: var(--primary);
  --color-primary-container: var(--primary-container);
  --color-on-primary: var(--on-primary);
  --color-on-primary-container: var(--on-primary-container);
  --color-primary-fixed: var(--primary-fixed);
  --color-primary-fixed-dim: var(--primary-fixed-dim);
  --color-on-primary-fixed: var(--on-primary-fixed);
  --color-secondary: var(--secondary);
  --color-secondary-container: var(--secondary-container);
  --color-on-secondary: var(--on-secondary);
  --color-on-secondary-container: var(--on-secondary-container);
  --color-tertiary: var(--tertiary);
  --color-tertiary-container: var(--tertiary-container);
  --color-on-tertiary: var(--on-tertiary);
  --color-tertiary-container-fg: var(--on-tertiary-container);
  --color-error: var(--error);
  --color-error-container: var(--error-container);
  --color-on-error: var(--on-error);
  --color-outline: var(--outline);
  --color-outline-variant: var(--outline-variant);
  --color-inverse-surface: var(--inverse-surface);
  --color-inverse-on-surface: var(--inverse-on-surface);
  --color-inverse-primary: var(--inverse-primary);
  --color-surface-tint: var(--surface-tint);

  --font-sans: var(--font-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-mono), ui-monospace, 'SF Mono', monospace;

  --radius-sm: 0.125rem;  /* 2px — fine for chip/badges */
  --radius-md: 0.375rem;  /* 6px — buttons, inputs */
  --radius-lg: 0.5rem;    /* 8px — cards */
  --radius-xl: 0.75rem;   /* 12px — modals */
  --radius-full: 9999px;  /* pills */
}

/* Utility: Veridian emerald gradient (for primary buttons, hero accents) */
.veridian-gradient {
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-container) 100%);
}

.veridian-gradient-soft {
  background: linear-gradient(135deg, rgba(0, 106, 68, 0.08) 0%, rgba(0, 133, 88, 0.04) 100%);
}

/* Utility: Glass panel (backdrop blur) */
.glass-panel {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
}

.dark .glass-panel {
  background: rgba(16, 20, 19, 0.6);
}

/* Utility: Veridian Light — radial glow for success moments */
.veridian-light {
  background: radial-gradient(circle at center, rgba(123, 250, 187, 0.20) 0%, transparent 70%);
}

/* Utility: Botanical shadow (soft glow, not drop shadow) */
.shadow-botanical {
  box-shadow: 0 24px 48px -12px rgba(25, 28, 27, 0.06);
}

.shadow-botanical-hover {
  box-shadow: 0 32px 64px -16px rgba(25, 28, 27, 0.08);
}

/* Utility: hero glow for screenshot card on landing */
.hero-glow {
  box-shadow: 0 0 80px -10px rgba(93, 221, 161, 0.2);
}

/* Tabular numerics for all .num elements */
.num,
.num * {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1;
}

/* Body base styles */
html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  background-color: var(--background);
  color: var(--on-surface);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
}
```

**Step 2: Verify dev server still compiles**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/
```
Expected: 200.

Visit `/auth/login` in browser — body should now be light off-white (#f8faf8), text dark slate (#191c1b). Buttons should still render (shadcn bridge in place) but with the new green.

**Step 3: Visual-verify via Preview screenshot**

```
mcp__Claude_Preview__preview_screenshot serverId=<current>
```
Expected: existing pages render in light mode with off-white background (not mint).

**Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat(theme): replace Data Cool tokens with Veridian Flow M3 palette"
```

### Task 0.4: Create `<Num>` utility component

**Files:** `components/ui/num.tsx`, `tests/components/num.test.tsx`

**Step 1: Write failing test**

```tsx
// tests/components/num.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Num } from '@/components/ui/num';

describe('<Num>', () => {
  it('renders a numeric value in mono font', () => {
    render(<Num value={126.82} />);
    const el = screen.getByText(/126\.82/);
    expect(el).toBeInTheDocument();
    expect(el.className).toContain('num');
  });

  it('formats with locale separators by default', () => {
    render(<Num value={1420500} />);
    expect(screen.getByText(/1,420,500/)).toBeInTheDocument();
  });

  it('accepts precision option', () => {
    render(<Num value={0.123456} precision={2} />);
    expect(screen.getByText('0.12')).toBeInTheDocument();
  });

  it('appends a unit when provided', () => {
    render(<Num value={42} unit="kg CO₂-eq" />);
    expect(screen.getByText(/42\s*kg CO₂-eq/)).toBeInTheDocument();
  });

  it('renders plain string when value is non-numeric', () => {
    render(<Num value="N/A" />);
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });
});
```

**Step 2: Run — FAIL** (module missing)

```bash
pnpm test tests/components/num.test.tsx
```

**Step 3: Implement `components/ui/num.tsx`**

```tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface NumProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number | string | null | undefined;
  precision?: number;
  unit?: string;
  locale?: string;
}

export function Num({ value, precision, unit, locale, className, ...rest }: NumProps) {
  const display = React.useMemo(() => {
    if (value === null || value === undefined) return '—';
    const n = typeof value === 'string' ? Number(value) : value;
    if (Number.isNaN(n)) return String(value);
    const opts: Intl.NumberFormatOptions = precision !== undefined
      ? { minimumFractionDigits: precision, maximumFractionDigits: precision }
      : {};
    return new Intl.NumberFormat(locale ?? 'en-US', opts).format(n);
  }, [value, precision, locale]);

  return (
    <span className={cn('num', className)} {...rest}>
      {display}
      {unit ? <span className="ml-1 text-on-surface-variant">{unit}</span> : null}
    </span>
  );
}
```

**Step 4: Run — PASS (5/5)**

**Step 5: Commit**

```bash
git add components/ui/num.tsx tests/components/num.test.tsx
git commit -m "feat(ui): <Num> component for tabular monospace numbers"
```

### Task 0.5: Create the new LCAPIX wordmark component

**Files:** `components/brand/lcapix-wordmark.tsx`, `tests/components/lcapix-wordmark.test.tsx`

The stitch mockups use text-only wordmark "LCAPIX" in Inter bold with tight tracking. Some variants have a small leaf/lock icon. Start with a tight wordmark; later we can layer the geometric mark from the design doc.

**Step 1: Write failing test**

```tsx
// tests/components/lcapix-wordmark.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LcapixWordmark } from '@/components/brand/lcapix-wordmark';

describe('<LcapixWordmark>', () => {
  it('renders LCAPIX text', () => {
    render(<LcapixWordmark />);
    expect(screen.getByText('LCAPIX')).toBeInTheDocument();
  });

  it('applies size variants', () => {
    const { rerender, container } = render(<LcapixWordmark size="sm" />);
    expect(container.firstChild).toHaveClass('text-base');
    rerender(<LcapixWordmark size="lg" />);
    expect(container.firstChild).toHaveClass('text-2xl');
  });

  it('applies subtitle when provided', () => {
    render(<LcapixWordmark subtitle="SUSTAINABILITY SUITE" />);
    expect(screen.getByText('SUSTAINABILITY SUITE')).toBeInTheDocument();
  });

  it('links to href when provided', () => {
    render(<LcapixWordmark href="/home" />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/home');
  });
});
```

**Step 2: Run — FAIL**

**Step 3: Implement**

```tsx
// components/brand/lcapix-wordmark.tsx
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface LcapixWordmarkProps {
  size?: 'sm' | 'md' | 'lg';
  subtitle?: string;
  href?: string;
  className?: string;
  variant?: 'default' | 'inverted';
}

const SIZE_CLASS: Record<NonNullable<LcapixWordmarkProps['size']>, string> = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-2xl',
};

export function LcapixWordmark({
  size = 'md',
  subtitle,
  href,
  className,
  variant = 'default',
}: LcapixWordmarkProps) {
  const textColor = variant === 'inverted' ? 'text-on-primary' : 'text-primary';
  const body = (
    <div className={cn('flex flex-col leading-none', className)}>
      <span className={cn('font-extrabold tracking-tighter', SIZE_CLASS[size], textColor)}>
        LCAPIX
      </span>
      {subtitle ? (
        <span className="mt-1 font-mono text-[10px] tracking-[0.12em] text-on-surface-variant uppercase">
          {subtitle}
        </span>
      ) : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
```

**Step 4: Run — PASS**

**Step 5: Commit**

```bash
git add components/brand/lcapix-wordmark.tsx tests/components/lcapix-wordmark.test.tsx
git commit -m "feat(brand): LcapixWordmark component"
```

### Task 0.6: Set default theme to light, clean up old mint bg

**Files:** `app/layout.tsx:36-42`

In Task 0.2 we already set `defaultTheme="light"` and removed `bg-green-50/30`. Just verify:

```bash
grep -n "defaultTheme\|bg-green-50" app/layout.tsx
```

Expected: `defaultTheme="light"`, no `bg-green-50`.

If any leftover, fix. Commit only if changes:

```bash
git add app/layout.tsx
git commit -m "chore(theme): confirm light default, remove mint body bg" --allow-empty
```

### Task 0.7: Supersede the Data Cool design doc

**Files:** `docs/plans/2026-04-13-brand-redesign-design.md`

**Step 1: Add a "superseded" banner at the top**

Edit line 1 of `docs/plans/2026-04-13-brand-redesign-design.md`:

```markdown
> **SUPERSEDED** — The user chose the Veridian Flow / Botanical Precision direction (stitch-generated mockups in `stitch_lcapix_design_system_prompts/`) instead of Data Cool. See `2026-04-13-veridian-flow-implementation.md` for the active plan and `stitch_lcapix_design_system_prompts/veridian_flow/DESIGN.md` for the active design system reference.

# LCAPIX v3 — Brand & UI Redesign Design
```

**Step 2: Commit**

```bash
git add docs/plans/2026-04-13-brand-redesign-design.md
git commit -m "docs: mark Data Cool design doc as superseded by Veridian Flow"
```

---

**Phase 0 verification checkpoint:** Stop. User opens `/auth/login` in Preview, confirms:
- Body is off-white (not mint, not slate)
- Inter Tight loaded
- `pnpm test` still 84+ tests passing (plus 9 new for Num + Wordmark)
- No visual regressions on existing pages

User says "proceed" → Phase 1.

---

## Phase 1 — Landing Page (`/`)

Port `stitch_lcapix_design_system_prompts/lcapix_landing_page_desktop_gradient_emerald/code.html` to `app/page.tsx`. Replace the current redirect-to-login behavior.

Read the stitch HTML first:
```bash
cat "stitch_lcapix_design_system_prompts/lcapix_landing_page_desktop_gradient_emerald/code.html"
```

Stitch structure (derived from mockup):
1. Sticky top app bar (glass, LCAPIX logo left, nav center, "Log in" + "Get Started" right)
2. Hero split: left headline "Built for sustainability engineers. Not greenwash." + subhead + CTA pair + documentation link; right product screenshot
3. "Same input, three methods" strip with 3 steps (01/02/03 big gray numerals)
4. Real-time telemetry card with JSON code sample + 3 feature callouts
5. "Ready to build the future of accountable nature?" final CTA band
6. Footer (Product / Company / Connect columns)

### Task 1.1: Scaffold `app/page.tsx`

**Files:** `app/page.tsx` (overwrite current redirect)

**Step 1:** Read current `app/page.tsx` to understand the redirect. Then replace with:

```tsx
// app/page.tsx
import { LandingNav } from '@/components/landing/landing-nav';
import { LandingHero } from '@/components/landing/landing-hero';
import { MethodComparison } from '@/components/landing/method-comparison';
import { TelemetryFeature } from '@/components/landing/telemetry-feature';
import { FeatureGrid } from '@/components/landing/feature-grid';
import { FinalCta } from '@/components/landing/final-cta';
import { LandingFooter } from '@/components/landing/landing-footer';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-on-surface">
      <LandingNav />
      <LandingHero />
      <MethodComparison />
      <TelemetryFeature />
      <FeatureGrid />
      <FinalCta />
      <LandingFooter />
    </main>
  );
}
```

**Step 2: Create placeholder components** so the page compiles even before each section is implemented. For each of the 6 sections, create a file under `components/landing/*.tsx` with a stub returning `<section className="py-24 text-center">{name}</section>`.

Run:
```bash
for f in landing-nav landing-hero method-comparison telemetry-feature feature-grid final-cta landing-footer; do
  mkdir -p components/landing
  echo "export function $(echo $f | awk -F- '{for(i=1;i<=NF;i++) printf toupper(substr(\$i,1,1)) substr(\$i,2)}')() { return <section className=\"py-24 text-center text-on-surface-variant\">$f</section>; }" > "components/landing/$f.tsx"
done
```

(Adjust exported names to PascalCase.)

**Step 3: Run dev, visit `/`, expect 200.**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/
```

**Step 4: Commit**

```bash
git add app/page.tsx components/landing/
git commit -m "feat(landing): scaffold landing page sections"
```

### Task 1.2: Implement `<LandingNav>`

**Files:** `components/landing/landing-nav.tsx`

Port the stitch `<header>` nav. Structure:

```tsx
'use client';
import Link from 'next/link';
import { LcapixWordmark } from '@/components/brand/lcapix-wordmark';

const NAV_LINKS = [
  { label: 'Platform', href: '#platform' },
  { label: 'Solutions', href: '#solutions' },
  { label: 'Developers', href: '#developers' },
  { label: 'Pricing', href: '#pricing' },
];

export function LandingNav() {
  return (
    <header className="sticky top-0 w-full z-50 glass-panel border-b border-outline-variant/20">
      <nav className="flex items-center justify-between px-6 md:px-12 py-4 max-w-[1440px] mx-auto">
        <Link href="/" aria-label="LCAPIX home">
          <LcapixWordmark size="md" />
        </Link>
        <div className="hidden md:flex items-center gap-8 font-medium text-sm text-on-surface-variant">
          {NAV_LINKS.map(l => (
            <Link key={l.href} href={l.href} className="hover:text-primary transition-colors">
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <Link href="/auth/login" className="hidden sm:inline-flex text-sm font-medium text-on-surface hover:text-primary">
            Log in
          </Link>
          <Link
            href="/auth/signup"
            className="veridian-gradient text-on-primary text-sm font-semibold px-5 py-2.5 rounded-md hover:opacity-95 transition-opacity"
          >
            Get Started
          </Link>
        </div>
      </nav>
    </header>
  );
}
```

Visual verify (Preview screenshot of `/` top region). Compare to mockup's nav.

Commit:
```bash
git add components/landing/landing-nav.tsx
git commit -m "feat(landing): nav bar with glass panel + veridian gradient CTA"
```

### Task 1.3: Implement `<LandingHero>`

**Files:** `components/landing/landing-hero.tsx`, `public/screenshots/landing-hero-results.png` (placeholder PNG for now)

Port the hero split layout. Left: eyebrow text, big headline, subhead, 2 CTAs + doc link. Right: 3D-looking card showing a product shot.

Use a placeholder screenshot for now (the `<img>` path is `/screenshots/landing-hero-results.png`). Later we'll swap in a real app screenshot (separate task after phases complete).

```tsx
'use client';
import Link from 'next/link';
import Image from 'next/image';

export function LandingHero() {
  return (
    <section className="relative max-w-[1440px] mx-auto px-6 md:px-12 py-20 md:py-28 grid lg:grid-cols-2 gap-12 items-center">
      <div>
        <p className="font-mono text-xs tracking-[0.15em] text-on-surface-variant uppercase mb-6">
          Precision Botanical Data
        </p>
        <h1 className="font-extrabold leading-[1.05] tracking-tighter text-5xl md:text-6xl lg:text-7xl">
          Built for<br />sustainability<br />engineers.<br />
          <span className="text-primary">Not greenwash.</span>
        </h1>
        <p className="mt-8 text-base md:text-lg text-on-surface-variant max-w-lg">
          The world's first high-fidelity API for botanical carbon sequestration modeling.
          Real-time data points, zero abstraction, absolute precision.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link href="/auth/signup" className="veridian-gradient text-on-primary font-semibold px-6 py-3.5 rounded-md text-sm">
            Start Building Now
          </Link>
          <Link href="/guide" className="font-mono text-xs tracking-wider text-on-surface-variant uppercase hover:text-primary">
            → Read Documentation
          </Link>
        </div>
      </div>
      <div className="relative">
        <div className="hero-glow rounded-lg overflow-hidden bg-inverse-surface">
          <Image
            src="/screenshots/landing-hero-results.png"
            alt="LCAPIX assessment results dashboard"
            width={720}
            height={480}
            priority
          />
        </div>
      </div>
    </section>
  );
}
```

Create a placeholder image:
```bash
mkdir -p public/screenshots
# temporarily use the existing placeholder
cp public/placeholder.jpg public/screenshots/landing-hero-results.png || true
```

Visual verify. Compare side-by-side with `stitch_lcapix_design_system_prompts/lcapix_landing_page_desktop_gradient_emerald/screen.png`.

Commit:
```bash
git add components/landing/landing-hero.tsx public/screenshots/
git commit -m "feat(landing): hero section with headline + dual CTA"
```

### Task 1.4–1.7: Remaining landing sections

Each follows the same pattern:
- Read mockup HTML for the section
- Port into a client-less React component
- Use `.veridian-gradient`, `.glass-panel`, `.num` utilities where appropriate
- Lucide icons in place of Material Symbols
- Visual verify
- Commit

**Task 1.4** `<MethodComparison>` — 3 big grey numerals "01/02/03" with column titles.

**Task 1.5** `<TelemetryFeature>` — left text card ("Real-time Botanical Telemetry" + 3 callouts); right `<pre>` with sample JSON payload.

**Task 1.6** `<FeatureGrid>` — 3 small feature cells (SDK Support / Multi-Region Sync / Genomic Metadata), each with a 20px emerald icon.

**Task 1.7** `<FinalCta>` — dark `bg-inverse-surface` full-width band with "Ready to build the future of accountable nature?" + "Get Your API Key" button.

**Task 1.8** `<LandingFooter>` — 3-column footer (Product / Company / Connect) + copyright line.

Commit after each:
```bash
git add components/landing/<file>.tsx
git commit -m "feat(landing): <section name>"
```

### Task 1.9: Landing responsive + accessibility pass

**Files:** all `components/landing/*.tsx`

**Step 1:** Open Preview at widths 375, 768, 1024, 1440. Check:
- Nav collapses to logo + Get Started button on <sm
- Hero stacks (text above screenshot) on <lg
- Method 01/02/03 columns stack on <md
- Telemetry callouts stack on <md
- Final CTA text wraps cleanly on narrow

**Step 2:** Run axe-core lighthouse locally:
```bash
# From browser devtools → Lighthouse → Accessibility
```
Expected: score ≥95.

**Step 3:** Commit any fixes

```bash
git commit -am "fix(landing): responsive adjustments + a11y"
```

---

**Phase 1 verification checkpoint:**
- Preview screenshot of `/` at desktop matches mockup
- Nav + Hero + Method + Telemetry + Features + FinalCTA + Footer all present
- No layout breakage at 375/768/1024/1440
- Lighthouse a11y ≥95
- "Get Started" button navigates to `/auth/signup`; "Log in" → `/auth/login`

User says "proceed" → Phase 2.

---

## Phase 2 — Auth Pages

Port `login_veridian_flow/` and `signup_veridian_flow/`. Both use a split layout: form on the left, editorial art + quote on the right.

### Task 2.1: Build shared `<AuthLayout>`

**Files:** `components/auth/auth-layout.tsx`

```tsx
import { LcapixWordmark } from '@/components/brand/lcapix-wordmark';

export interface AuthLayoutProps {
  children: React.ReactNode;
  /** Right pane content (visual + quote). Pass null/undefined to hide. */
  rightPane?: React.ReactNode;
}

export function AuthLayout({ children, rightPane }: AuthLayoutProps) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[45%_55%]">
      <div className="flex flex-col justify-center px-8 md:px-16 py-12 bg-background">
        <div className="max-w-sm w-full mx-auto">
          <div className="mb-12">
            <LcapixWordmark size="lg" />
          </div>
          {children}
        </div>
      </div>
      <div className="hidden lg:block relative overflow-hidden bg-surface-container-low">
        {rightPane}
      </div>
    </div>
  );
}
```

Commit: `feat(auth): shared AuthLayout split-screen`

### Task 2.2: Port login page

**Files:** `app/auth/login/page.tsx` (replace)

Read current `app/auth/login/page.tsx` to preserve the form handler logic. Then restructure the markup to match the mockup using `<AuthLayout>`. Keep the Zod schema, the auth store update, and the Google SSO button wiring.

Right-pane content for login: big quote "Three methods, same battery, three different answers. That's science." + below it a compact `<MethodComparison>` readout (pull from `/api/demo/results` or hard-coded for now).

Form fields (from mockup):
- Email (label "Company Email")
- Password (label "Security Key" + "Forgot Access" link)
- Submit button (emerald) "Sign in to Console"
- Divider "or continue with"
- Google SSO button "Enterprise Google SSO"
- Footer link "New to LCAPIX? Request Access" → `/auth/signup`

Implement; run existing auth flow; verify login still works end-to-end by logging in as `john@lcaproject.com`.

Commit: `feat(auth): port login page to Veridian Flow layout`

### Task 2.3: Port signup page

**Files:** `app/auth/signup/page.tsx` (replace)

Mirror of login but:
- Fields: Full Name / Work Email / Password
- Button "Create Account"
- Right pane: dark green botanical leaf background + quote "Sustainable engineering isn't a design choice; it's a mathematical imperative." + small "Avg Core Impact -14.2% CO₂/kWh" metric card

Commit: `feat(auth): port signup page to Veridian Flow layout`

### Task 2.4: Fix post-login redirect + auth store

Verify that after a successful login:
- Token stored in localStorage as `auth_token`
- Zustand `lcapix-auth` hydrated
- Redirect to `/home`

Same for signup → `/home` (via auto-login after create).

Run:
```bash
# Use Preview to log in with john@lcaproject.com
```

Commit only if bugs found: `fix(auth): <bug>`

---

**Phase 2 verification checkpoint:**
- Login/signup pages visually match mockups
- Both forms still submit and redirect to `/home`
- Existing tests green
- `/auth/login` and `/auth/signup` are accessible via the landing page nav + CTAs

User "proceed" → Phase 3.

---

## Phase 3 — Home Dashboard

Port `home_dashboard_veridian_flow/` to `app/home/page.tsx`.

Mockup structure:
- Top bar with logo + `Dashboard · Inventory · Emissions · Reports · Supply Chain` nav + search + bell + avatar
- Left-side page title: "Systems Overview" (display-lg) + subtitle "Botanical precision in environmental asset management."
- 4 KPI cards (Active Projects 24 / Assessments 158 / Factors Logged 1,042 / Components 42)
- "Active Portfolio" section: two big horizontal project cards with thumbnail + stats + "View" chevron
- Right sidebar "Activity Feed": last 4 events (Factor recalibrated / Assessment finalized / System alert / Sustainability lab) + "Generate EIA Report" green CTA

### Task 3.1: Build `<AppShell>` (top nav)

**Files:** `components/layout/app-shell.tsx`, `components/layout/app-nav.tsx`

Shared top bar for all authenticated pages. Replaces current `<AppLayout>`. Port the styling + nav links from the mockup. Include search input (+ Cmd-K trigger for future command palette), notification bell, question mark, and avatar dropdown.

Preserve the existing logout handler from `components/app-layout.tsx`.

Commit: `feat(shell): AppShell top-nav for authenticated pages`

### Task 3.2: Wire home page to new shell

**Files:** `app/home/page.tsx`

Replace the current container with `<AppShell>` and the new layout. Keep the `useEffect` fetch of `/api/projects` and the delete/sort handlers.

### Task 3.3: Build `<KpiCardRow>`

**Files:** `components/dashboard/kpi-card-row.tsx`

4 cards, evenly spaced, each with:
- Tiny mono label ("ACTIVE PROJECTS")
- Big number (48px, extrabold) using `<Num>`
- Small green delta pill ("↑ 12% this week" or similar)

Props: array of `{ label, value, delta }`. Fetch data from `/api/projects` + `/api/integrations/status` (combine in a server component or via a lightweight `/api/dashboard/kpis` endpoint — for now compute client-side).

Commit: `feat(dashboard): KPI card row`

### Task 3.4: Build `<ActivePortfolio>` project cards

**Files:** `components/dashboard/active-portfolio.tsx`

Horizontal card for each project. Use the existing `projects` from Zustand store. Each card: small thumbnail (placeholder), title, subtitle, 2 mini-stats, "View" chevron.

Click on card → navigate to `/project/<id>`.

Commit: `feat(dashboard): active portfolio cards`

### Task 3.5: Build `<ActivityFeed>` sidebar

**Files:** `components/dashboard/activity-feed.tsx`

Right sidebar. Pull from `/api/integrations/log?limit=6`. Render each event with small icon + title + timestamp. Bottom CTA "Generate EIA Report" emerald button.

Commit: `feat(dashboard): activity feed sidebar`

### Task 3.6: Responsive pass

- <md: sidebar becomes below-the-fold section
- <sm: KPI row horizontal scroll; active portfolio cards stack

Commit: `fix(dashboard): responsive`

---

**Phase 3 verification checkpoint:** Home page matches mockup. Clicking a project card navigates. Existing delete/sort flow still works.

User "proceed" → Phase 4.

---

## Phase 4 — Project Detail

User has THREE mockup variants for project detail (`project_detail_tabbed_layout`, `project_detail_interactive_hierarchy`, `project_detail_analytics_view`). Pick one primary and fold the others into sub-views.

**Recommended:** Use `project_detail_tabbed_layout` as the default page, with tabs for "Hierarchy" (mapping to `interactive_hierarchy` layout) and "Analytics" (mapping to `analytics_view`).

### Task 4.1: Build `<ProjectShell>` with left rail

**Files:** `components/project/project-shell.tsx`

Left sidebar rail with project context: project name, case selector, secondary links (Case Editor / Sustainability KPI / Metrics / Sample Cases / Archive). Sticky. Collapsible to icon-only.

### Task 4.2: Port tabbed main layout

**Files:** `app/project/[projectId]/page.tsx` (rewrite while preserving data-fetching logic)

Replace the current page body. Keep the data fetch; swap the UI. Tabs: `Hierarchy`, `Analytics`. Under Hierarchy, show the hierarchy card with Product/Major Assembly/Sub-process/Elemental Task pills as step indicator (from `project_detail_tabbed_layout`) + big card for the product + rows for each component.

### Task 4.3: Port interactive hierarchy (canvas) view

**Files:** `components/project/hierarchy-canvas.tsx`

Port the canvas from `project_detail_interactive_hierarchy/code.html`. Nodes on a light grid, node inspector popover.

Visual verify against `screen.png`.

### Task 4.4: Port analytics tab

**Files:** `components/project/analytics-tab.tsx`

Progress bars list + operational energy / water scarcity / end of life cards.

### Task 4.5: Wire KPI strip + actions

Bottom KPI strip: "142 Total KPIs · 48.2m Impact · 0.14 Supply Chain Fragility · A+ ISO Recognition".

### Task 4.6: Responsive pass

- <lg: tabs wrap; KPI strip horizontal scroll
- <md: left rail collapses to drawer

Commit after each.

---

**Phase 4 verification:** Project detail matches tabbed mockup. Can switch between Hierarchy / Analytics. Click a component row → opens inspector.

User "proceed" → Phase 5.

---

## Phase 5 — Case Editor (the big one)

Refactor `app/project/[projectId]/case/[caseId]/page.tsx` (3,360 lines) into pieces.

Mockup: `case_editor_veridian_flow/`. Shows: left sidebar (Project Veridian / hierarchy tree) + big grid canvas with component cards (Industrial Pump V4 / Alloy Housing / Electrical Drive) + right inspector pane (Properties / Flows / Costs tabs + component name + material type + environmental footprint + data provenance).

### Task 5.1: Extract `<CaseShell>` from current page

**Files:** `components/case/case-shell.tsx`

Copy the top-level JSX structure (AppShell + side rails + main area). Leaves `children` slot for canvas + inspector.

Test: existing case editor still loads (regression check).

Commit: `refactor(case): extract CaseShell`

### Task 5.2: Extract `<ComponentList>` (left sidebar)

**Files:** `components/case/component-list.tsx`

Pull the hierarchy tree nav from the current page into its own client component. Exports `<ComponentList components selectedId onSelect />`.

Unit tests: `tests/components/case/component-list.test.tsx` — test hierarchy rendering, selection, expand/collapse.

Commit: `refactor(case): extract ComponentList`

### Task 5.3: Extract `<CaseCanvas>` (center)

**Files:** `components/case/case-canvas.tsx`

Pull the canvas/tree visualization. For now keep the existing SVG/HTML tree rendering logic; just restyle node cards to match the Veridian mockup (light card, emerald left-border for active, subtle drop shadow).

Commit: `refactor(case): extract CaseCanvas`

### Task 5.4: Extract `<ComponentInspector>` (right pane)

**Files:** `components/case/component-inspector.tsx`

Pull the right inspector. Three tabs: Properties (name, material type, footprint), Flows (existing flows UI), Costs (existing cost fields). Reuse existing form logic — just restyle.

Commit: `refactor(case): extract ComponentInspector`

### Task 5.5: Rebuild the fullscreen `<ProcessHierarchyModal>`

**Files:** `components/case/process-hierarchy-modal.tsx`

Fix the modal bugs from earlier review: proper backdrop, close X top-right, ESC closes, z-index above everything, no bleed-through.

Commit: `refactor(case): ProcessHierarchyModal with fixed z-index + close X`

### Task 5.6: Slim the page down to orchestrator (<500 lines)

**Files:** `app/project/[projectId]/case/[caseId]/page.tsx`

With the 4 components extracted, the page becomes a thin orchestrator: fetch case data, pass into `<CaseShell>` with the 4 children. Target: under 500 lines.

Run existing tests to verify no regression (assessment runs, flow CRUD still work).

Commit: `refactor(case): slim page.tsx to orchestrator`

### Task 5.7: Apply Veridian Flow styling to all 4 components

Sweep over each of the 4 components. Replace old color classes (`bg-green-50`, `bg-gray-100`, etc.) with new tokens (`bg-background`, `bg-surface-container-low`, `veridian-gradient`, etc.). Use `<Num>` for every number.

Commit after each: `style(case): <component-name> to Veridian tokens`

### Task 5.8: List-view fallback for <md

Below `md` breakpoint, the canvas is unusable — fall back to a `<CaseListView>` showing components as a vertical list with expand/collapse.

**Files:** `components/case/case-list-view.tsx`

Show toast "Tree view is optimized for larger screens; list view is active." on initial <md render.

Commit: `feat(case): list-view fallback for small viewports`

---

**Phase 5 verification:** Case editor loads, looks like the Veridian mockup, all original features still work (drag/drop, inspector, assessment), page.tsx is under 500 lines.

User "proceed" → Phase 6.

---

## Phase 6 — Assessment Results

Port `assessment_results_veridian_flow/` to `app/project/[projectId]/case/[caseId]/results/page.tsx`.

Mockup: huge "LCAPIX Results" headline + big "2.4 METRIC TONS" display + 3 KPI cards + "Contribution by Lifecycle Stage" chart + "Flow-level detail" table + "Historical Comparison" sparkline strip.

### Task 6.1: Refactor results page shell

**Files:** `app/project/[projectId]/case/[caseId]/results/page.tsx`

Wrap in `<CaseShell>` (from Phase 5). Title header + Run Assessment button intact. Keep existing assessment fetch.

Commit: `refactor(results): wrap in CaseShell`

### Task 6.2: Build `<TotalImpactDisplay>`

**Files:** `components/results/total-impact-display.tsx`

Huge emerald number (e.g. "2.4" in 96px extrabold) + "METRIC TONS" label + "+12.4%" delta + "Equivalent to…" explanation + "Target Met ✓" chip.

Commit: `feat(results): TotalImpactDisplay`

### Task 6.3: Build `<ContributionChart>`

**Files:** `components/results/contribution-chart.tsx`

Bar chart (Recharts) showing lifecycle stage contributions. Emerald/secondary/tertiary colors.

Commit: `feat(results): ContributionChart`

### Task 6.4: Build `<FlowLevelDetail>` table

**Files:** `components/results/flow-level-detail.tsx`

Table of flows with columns Material / Source / Units / Impact / Total Factor. Use existing results data. Monospace numeric columns via `<Num>`. Right-aligned numeric columns.

Commit: `feat(results): FlowLevelDetail table`

### Task 6.5: Build `<HistoricalComparison>` strip

**Files:** `components/results/historical-comparison.tsx`

Horizontal strip of past runs with a sparkline ending in "Current run". Click to switch to that run.

Commit: `feat(results): HistoricalComparison`

### Task 6.6: Run Assessment modal (preserve existing)

Modal already ships from Phase 1 of earlier work. Restyle to Veridian tokens only.

Commit: `style(results): RunAssessment modal to Veridian tokens`

---

**Phase 6 verification:** Results page shows live numbers. Methods dropdown + Region dropdown still function. "Export PDF" button still downloads the PDF. Preview-screenshot matches mockup.

User "proceed" → Phase 7.

---

## Phase 7 — Component Editor Form

No specific stitch mockup. Design consistent with the overall system.

### Task 7.1: Port existing form to Veridian tokens

**Files:** `app/project/[projectId]/case/[caseId]/component/new/page.tsx`

Replace old styling. Use shadcn `<Form>`, `<Input>`, `<Select>` with new tokens. Keep react-hook-form + zod validation.

Sections (cards on `surface-container-lowest`):
1. Type & Placement (segmented control for 5 types, parent dropdown)
2. Identity (name, description, quantity + unit)
3. Drivers (only shown when type=elemental_task)
4. Costs (collapsible, all 6 fields)
5. Advanced (collapsible)

Sticky bottom action bar (Cancel + Save).

Commit: `feat(component-form): Veridian redesign`

### Task 7.2: Build `<TypeSegmentedControl>`

Five-way toggle for component type with icons.

**Files:** `components/component-form/type-segmented-control.tsx` + test

Commit: `feat(component-form): TypeSegmentedControl`

### Task 7.3: Extend edit page

**Files:** `app/project/[projectId]/case/[caseId]/component/[componentId]/edit/page.tsx` (if missing, create)

Share `<ComponentForm>` with the new page. On mount, fetch `/api/components/<id>` and prefill.

Commit: `feat(component-form): edit mode prefill`

---

## Phase 8 — Analytics + Comparisons

Reuse `project_detail_analytics_view/` as a base for `app/project/[projectId]/analytics/page.tsx` and `.../comparisons/[comparisonId]/page.tsx`.

### Task 8.1: Shared `<DashboardGrid>`

**Files:** `components/analytics/dashboard-grid.tsx`

12-column grid wrapper for tiled charts.

Commit: `feat(analytics): DashboardGrid`

### Task 8.2: Port analytics page

**Files:** `app/project/[projectId]/analytics/page.tsx`

Per-case multi-line chart, pie, heatmap, Sankey placeholder.

Commit: `feat(analytics): port analytics page`

### Task 8.3: Port comparisons

**Files:** `app/project/[projectId]/comparisons/[comparisonId]/page.tsx`

Head-to-head KPI row, grouped bar chart, radar chart, diff table, verdict card.

Commit: `feat(comparisons): port comparisons page`

---

## Phase 9 — Admin Integrations

Port `admin_integrations_veridian_flow/` to `app/admin/integrations/page.tsx`.

### Task 9.1: Port subnav tabs

Tabs: Overview / Data Sources / API Keys / Activity Log.

### Task 9.2: Port Overview tab

4 KPI cards (Substances 14,802 / Methodologies 42 / Cost Rates $1.2M / + 1 more) + "Operational Connections" table (Service / Health / Latency / Uptime / Actions) + "Systems Harmonized" success banner.

### Task 9.3: Port Data Sources / API Keys / Activity Log tabs

Each as its own file under `app/admin/integrations/(tabs)/*`.

Commit after each: `feat(admin): <tab>`

---

## Phase 10 — About + Guide

Lower priority. Apply tokens + typography consistency. No major restructuring unless user requests.

### Task 10.1: Token pass on `/about` and `/guide`

**Files:** `app/about/page.tsx`, `app/guide/page.tsx`

Swap old classes for Veridian tokens. Ensure `font-sans` and `font-mono` are used appropriately. Max-width 720 for prose.

Commit: `style(content): Veridian tokens on about + guide`

---

## Phase 11 — Responsive sweep

Audit every page at widths 375 / 768 / 1024 / 1440. Fix any breakage.

### Task 11.1: Landing

Preview screenshot at each width; fix layout issues.

### Task 11.2–11.N: Repeat for each page

Commit per page: `fix(responsive): <page>`

---

## Phase 12 — Accessibility sweep

### Task 12.1: axe-core scan

Run axe in Chrome DevTools on every page. Fix contrast failures, missing labels, focus order.

### Task 12.2: Command palette (`Cmd+K`)

**Files:** `components/global/command-palette.tsx`

Use shadcn's `<Command>` primitive. Index: projects, cases, admin, theme toggle.

### Task 12.3: Keyboard-shortcut help (`?`)

Show a modal listing all shortcuts.

Commit after each: `feat(a11y): <feature>`

---

## Final housekeeping

- [ ] `pnpm test` — all green (84 + new component tests)
- [ ] `pnpm build` — no TS errors
- [ ] `pnpm lint` — no new warnings
- [ ] Every new component has a test or a manual-verify note
- [ ] All commits local, zero pushed
- [ ] Close with summary screenshot comparison: new page vs stitch mockup, side by side, for every page

Final commit:
```bash
git commit --allow-empty -m "feat: Veridian Flow redesign complete — all pages ported"
```

---

## Execution notes

- **Every task is one action, 2–5 minutes.** If a task takes more than 15 minutes, split it.
- **TDD for pure-logic components** (Num, Wordmark, TypeSegmentedControl, etc.). For visual ports, use Preview screenshot + manual comparison with the mockup instead.
- **Never batch multiple tasks before committing.**
- **Use `@superpowers:verification-before-completion` before claiming anything done.**
- **Use `@superpowers:systematic-debugging` if something breaks unexpectedly.**
- **Pause after each phase.** Do not silently move to the next phase; surface a "Phase N done — screenshot / stats" summary and wait for "proceed".
