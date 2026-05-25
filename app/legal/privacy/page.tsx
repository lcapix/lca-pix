import { LegalShell } from '../legal-layout'

export const metadata = { title: 'Privacy policy — LCAPIX' }

export default function PrivacyPage() {
  return (
    <LegalShell
      eyebrow="PRIVACY"
      title="Privacy policy"
      effective="January 1, 2026"
    >
      <p>
        LCAPIX is a life cycle assessment platform for engineering teams. This
        policy explains what data we collect, how we use it, and the rights you
        have over it. We wrote it to be readable, not legally clever.
      </p>

      <h2>1. Data we collect</h2>
      <p>
        We collect the minimum required to run the product: your name and email
        for authentication, the project / case / component data you enter, and
        anonymous usage telemetry (page views, feature interactions) to improve
        the tool. We do not sell personal data. We do not run third-party ad
        trackers.
      </p>

      <h2>2. How we use it</h2>
      <ul>
        <li>Authentication and account management</li>
        <li>Running the calculations you ask us to run</li>
        <li>Aggregated analytics to prioritize roadmap work</li>
        <li>Operational email about your account (security, billing)</li>
      </ul>

      <h2>3. Sub-processors</h2>
      <p>
        We use AWS for hosting (Frankfurt or N. Virginia regions, your choice on
        Enterprise), Vercel for application delivery, and Resend for
        transactional email. Each is bound by a data processing agreement that
        mirrors this policy.
      </p>

      <h2>4. Your rights</h2>
      <p>
        Export, correct, or delete your data at any time from Settings →
        Account. Enterprise customers can request a full Article 15 / 17 export
        by emailing privacy@lcapix.com — we acknowledge within 48 hours and
        complete within 30 days.
      </p>

      <h2>5. Contact</h2>
      <p>
        Questions about this policy? Email privacy@lcapix.com.
      </p>
    </LegalShell>
  )
}
