import { LegalShell } from '../legal-layout'

export const metadata = { title: 'Terms of service — LCAPIX' }

export default function TermsPage() {
  return (
    <LegalShell
      eyebrow="TERMS"
      title="Terms of service"
      effective="January 1, 2026"
    >
      <p>
        These terms govern your use of the LCAPIX platform. By signing up, you
        agree to them. Plain English version — no surprises.
      </p>

      <h2>1. The service</h2>
      <p>
        LCAPIX provides life cycle assessment software, characterization factor
        data, and supporting integrations. We aim for 99.9% uptime, measured
        monthly. Scheduled maintenance is announced 7 days in advance.
      </p>

      <h2>2. Your account</h2>
      <p>
        You are responsible for keeping your credentials secure and for the
        data you upload. Don&apos;t upload anything you don&apos;t have rights
        to. Don&apos;t use the platform to harass, defraud, or break the law.
      </p>

      <h2>3. Billing</h2>
      <p>
        Free tier is free, indefinitely. Pro and Enterprise are billed monthly
        or annually in advance. Cancel at any time — you keep access through
        the end of the paid period. No refunds for partial periods, but no
        retroactive bills either.
      </p>

      <h2>4. Data ownership</h2>
      <p>
        Your data is your data. We hold a license to process it solely to
        provide the service. We do not train models on customer data. We do
        not sell it. Cancel and you can export everything; 90 days after
        cancellation we delete it.
      </p>

      <h2>5. Liability</h2>
      <p>
        The platform is provided as-is. LCA outputs are tools, not
        certifications — the practitioner is responsible for verifying results
        before publishing them. Our maximum liability is the amount you paid
        in the prior 12 months.
      </p>

      <h2>6. Changes</h2>
      <p>
        We may update these terms with 30 days notice via email. If you
        don&apos;t agree to the new terms, cancel before they take effect.
      </p>
    </LegalShell>
  )
}
