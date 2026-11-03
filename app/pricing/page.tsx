// The pricing page while LCAPIX is in beta: free, with no plans, prices or
// trials, because none exist. It says what the beta does and what it does not
// do yet, so nobody signs up for something that is not there.
import Link from 'next/link'
import { PublicLayout } from '@/components/lcapix/landing/public-layout'
import { Icon, type IconName } from '@/components/lcapix'
import { CONTACT_EMAIL } from '@/lib/contact'

export const metadata = { title: 'Free while in beta: LCAPIX' }

const CAN = [
  'Build a case step by step, or read it in from a routing, a bill of materials or an equipment list (spreadsheet or CSV)',
  'Run it with CML 2001, ReCiPe or TRACI 2.1, on the cited factor library',
  'Cost beside impact, each rate with its source',
  'Compare cases with the four fairness checks',
  'Write it up, and export to PDF, PowerPoint and CSV',
  'Classes: invite students, set an assignment, collect hand-ins',
]

const NOT_YET = [
  'Reading PDFs (safety data sheets, EPDs). Use the spreadsheet or CSV version.',
  'Live price and grid data. Dated reference values are used and tagged Reference.',
  'Editing on a phone. A phone opens cases read-only.',
]

function List({ items, icon, tone }: { items: string[]; icon: IconName; tone: string }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((f) => (
        <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: 'var(--ds-text-2)', lineHeight: 1.5 }}>
          <Icon name={icon} size={14} style={{ color: tone, flex: 'none', marginTop: 4 }} />
          <span>{f}</span>
        </li>
      ))}
    </ul>
  )
}

function PricingPageBody() {
  return (
    <div className="page-pricing" style={{ minHeight: '100%' }}>
      <section style={{ padding: 'clamp(56px, 9vw, 96px) clamp(20px, 4vw, 40px) 32px', textAlign: 'center' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div className="ds-section-label" style={{ marginBottom: 14 }}>Pricing</div>
          <h1
            style={{
              margin: 0,
              color: 'var(--ds-text)',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              letterSpacing: '-0.025em',
              lineHeight: 1.05,
              fontSize: 'clamp(2rem, 4.2vw, 3rem)',
            }}
          >
            Free while in beta
          </h1>
          <p style={{ fontSize: 16, color: 'var(--ds-text-2)', maxWidth: 540, margin: '20px auto 0', lineHeight: 1.55 }}>
            LCAPIX is free for students, teachers and anyone trying it out. There is no plan to pick and no card to add.
          </p>
          <Link href="/auth/signup" className="btn btn-primary btn-lg" style={{ marginTop: 28 }}>
            Sign up free <Icon name="arrow-right" size={14} />
          </Link>
        </div>
      </section>

      <section style={{ padding: '8px clamp(20px, 4vw, 40px) 72px' }}>
        <div
          style={{
            maxWidth: 960,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 20,
          }}
        >
          <div className="ds-card" style={{ padding: 28 }} aria-labelledby="beta-can">
            <h2 id="beta-can" style={{ fontSize: 16, fontWeight: 600, margin: '0 0 18px', color: 'var(--ds-text)' }}>
              What you can do
            </h2>
            <List items={CAN} icon="check" tone="var(--ds-green)" />
          </div>
          <div className="ds-card" style={{ padding: 28 }} aria-labelledby="beta-not-yet">
            <h2 id="beta-not-yet" style={{ fontSize: 16, fontWeight: 600, margin: '0 0 18px', color: 'var(--ds-text)' }}>
              Not in the beta yet
            </h2>
            <List items={NOT_YET} icon="clock" tone="var(--ds-text-3)" />
            <div style={{ height: 1, background: 'var(--ds-line)', margin: '22px 0' }} />
            <p style={{ fontSize: 13, color: 'var(--ds-text-2)', margin: 0, lineHeight: 1.55 }}>
              Beta means screens may change and numbers may be corrected as we go. A run you made keeps its own
              numbers. Found something broken, or missing? Email{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default function PricingPage() {
  return (
    <PublicLayout>
      <PricingPageBody />
    </PublicLayout>
  )
}
