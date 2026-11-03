import { LegalShell } from '../legal-layout'
import { CONTACT_EMAIL } from '@/lib/contact'

export const metadata = { title: 'Terms of service: LCAPIX' }

export default function TermsPage() {
  return (
    <LegalShell eyebrow="TERMS" title="Terms of service" effective="November 3, 2026">
      <p>These terms cover your use of LCAPIX. By signing up, you agree to them.</p>
      <h2>1. A free beta</h2>
      <p>
        LCAPIX is free while in beta, and is offered for learning and for trying out life cycle assessment. Screens may
        change, features may come and go, and the service may be down at times. We do not promise any level of uptime.
      </p>
      <h2>2. Your results</h2>
      <p>
        LCAPIX helps you work out an assessment; it does not certify one. Its factors and rates come with their
        sources, and some are reference or global averages. Check results before you rely on them or publish them.
      </p>
      <h2>3. Your account</h2>
      <p>
        Keep your sign-in to yourself. Upload only what you have the right to share. Do not use LCAPIX to break the law,
        to harm others, or to strain or attack the service. We may close an account that does.
      </p>
      <h2>4. Your work</h2>
      <p>
        What you put in stays yours. We hold it only to run the service for you and the people you share it with, as
        the privacy policy says. You can delete your account, and the projects you own, at any time from Profile.
      </p>
      <h2>5. No warranty</h2>
      <p>
        LCAPIX is provided as it is, without warranty of any kind. To the extent the law allows, we are not liable for
        any loss that comes from using it.
      </p>
      <h2>6. Changes and contact</h2>
      <p>
        When these terms change, this page changes and its date moves. Questions: email{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalShell>
  )
}
