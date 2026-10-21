import { LegalShell } from '../legal-layout'

export const metadata = { title: 'Security: LCAPIX' }

// Every line here is something the code or the hosting does today; a claim
// goes on this page only once it is true (checked 2026-10-20 against the code
// on v1-hardening). Planned work is not listed as done.
export default function SecurityPage() {
  return (
    <LegalShell
      eyebrow="SECURITY"
      title="Security"
      effective="October 20, 2026"
    >
      <p>
        This page says what LCAPIX does today to protect your data. It lists only what is in place now.
      </p>

      <h2>1. Hosting</h2>
      <ul>
        <li>The application runs on Vercel. Its database runs on Amazon RDS (MySQL) in AWS us-east-1.</li>
        <li>
          Every connection to the application uses HTTPS, and browsers are told to use HTTPS only (HSTS, two
          years, subdomains included).
        </li>
      </ul>

      <h2>2. Signing in</h2>
      <ul>
        <li>Passwords are hashed with bcrypt and are never stored as written.</li>
        <li>Optional Google sign-in, with state and PKCE checks and a verified email address.</li>
        <li>
          A session is a signed token that lasts up to 7 days. It stops working when the password changes, and
          signing out clears it.
        </li>
        <li>Sign-in attempts are limited to 5 a minute, and new accounts to 3 an hour from one address.</li>
      </ul>

      <h2>3. Who can see your work</h2>
      <ul>
        <li>
          Each project has roles: owner, admin, Can change and Can read. The server checks the role on every
          request, not only the screen.
        </li>
        <li>People outside a project get &quot;not found&quot; for its pages, so they cannot learn it exists.</li>
        <li>A project owner can keep each member to the cases that member made.</li>
      </ul>

      <h2>4. How the application is built and checked</h2>
      <ul>
        <li>Every change is type-checked and tested, and checked for leaked secrets, before it is released.</li>
        <li>Uploads are limited to known file types, checked by their content as well as their name, and by size.</li>
        <li>Costly actions (runs, file reads, AI narration, rate look-ups) are limited per person.</li>
        <li>
          Pages are sent with security headers, including a content security policy, which currently reports
          rather than blocks.
        </li>
      </ul>

      <h2>5. AI narration</h2>
      <ul>
        <li>
          Magic Insights can describe a run in words using an open model through Hugging Face. Only the run&apos;s
          computed figures and the names of its steps and materials are sent, never your files.
        </li>
        <li>
          Every number in the model&apos;s reply is checked against the run before you see it. A reply with any
          other number is discarded, and LCAPIX shows its own computed reading instead.
        </li>
        <li>Without a model configured, the reading is computed by LCAPIX and nothing is sent anywhere.</li>
        <li>
          A project&apos;s owner can turn AI narration off for that project. Its readings are then computed by
          LCAPIX and nothing from it is sent.
        </li>
        <li>A checked reply is kept with its run, so asking the same question again sends nothing.</li>
      </ul>

      <h2>6. Reporting a problem</h2>
      <p>
        Found a vulnerability? Email security@lcapix.com. We acknowledge within 24h, fix or mitigate within 7
        days for critical issues, and credit you in the changelog if you&apos;d like.
      </p>
    </LegalShell>
  )
}
