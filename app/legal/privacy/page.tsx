import { LegalShell } from '../legal-layout'
import { CONTACT_EMAIL } from '@/lib/contact'

export const metadata = { title: 'Privacy policy: LCAPIX' }

// Every line here is what the app does today (checked 2026-11-03 against the
// code on v1-finish): no analytics, no email sent, deletion on Profile.
export default function PrivacyPage() {
  return (
    <LegalShell eyebrow="PRIVACY" title="Privacy policy" effective="November 3, 2026">
      <p>
        LCAPIX is a life cycle assessment tool for teaching and trying out, free while in beta. This page says what we
        keep about you, why, and how to have it deleted.
      </p>
      <h2>1. What we keep</h2>
      <ul>
        <li>Your email, and your password stored only as a bcrypt hash. If you sign in with Google, Google tells us your email and name.</li>
        <li>What you choose to tell us on Profile: your name, institution, role, how you use LCAPIX and your country.</li>
        <li>The work you put in: projects, cases, steps, flows, costs, runs, write-ups, comparisons, and the files you upload to a case.</li>
        <li>A log of changes made to projects: who changed what, and when.</li>
      </ul>
      <h2>2. What we do not do</h2>
      <ul>
        <li>No analytics, tracking scripts or advertising. We do not sell or share your data.</li>
        <li>We send no email.</li>
        <li>We do not train models on your work.</li>
      </ul>
      <h2>3. Who else handles it</h2>
      <ul>
        <li>Vercel runs the application, and Neon holds the database (Postgres, in the United States, us-east-1).</li>
        <li>Google, only if you choose to sign in with Google.</li>
        <li>
          Hugging Face, only when AI wording of a run is turned on. It is off in this beta, so nothing is sent. When it
          is on, only a run&apos;s figures and the names of its steps and materials are sent, never your files.
        </li>
      </ul>
      <h2>4. Cookies and this browser</h2>
      <p>
        Signing in keeps a token in this browser&apos;s storage. The only cookies are short-lived ones used while you
        sign in with Google. Settings such as Guided mode are kept in this browser, not on our servers.
      </p>
      <h2>5. Who sees your work</h2>
      <p>
        Only you, and the people you add to a project, with the role you give them. In a class, the teacher who owns
        the project sees the cases made in it and the work handed in.
      </p>
      <h2>6. Deleting your data</h2>
      <p>
        Profile → Delete my account deletes your account and every project you own, with everything in them, at
        once. Your work in other people&apos;s projects, such as an assignment you handed in, stays with that project,
        shown as &quot;Deleted account&quot;. To take a copy first, export each case from its results (PDF, PowerPoint
        or CSV).
      </p>
      <h2>7. Children</h2>
      <p>LCAPIX is not meant for children under 13, and we do not knowingly keep data about them.</p>
      <h2>8. Changes and contact</h2>
      <p>
        When this policy changes, this page changes and its date moves. Questions, or a request about your data: email{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalShell>
  )
}
