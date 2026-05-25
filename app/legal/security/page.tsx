import { LegalShell } from '../legal-layout'

export const metadata = { title: 'Security — LCAPIX' }

export default function SecurityPage() {
  return (
    <LegalShell
      eyebrow="SECURITY"
      title="Security"
      effective="January 1, 2026"
    >
      <p>
        We build LCAPIX with the same security posture we&apos;d expect from a
        vendor handling our own product data. Below is what that looks like in
        practice.
      </p>

      <h2>1. Infrastructure</h2>
      <ul>
        <li>
          Hosted on AWS (us-east-1 / eu-central-1). Database in a private VPC
          subnet, accessible only to application servers.
        </li>
        <li>Application delivered via Vercel with global CDN edge caching.</li>
        <li>
          All connections use TLS 1.2+ end-to-end. HSTS preloaded.
        </li>
      </ul>

      <h2>2. Authentication</h2>
      <ul>
        <li>Passwords hashed with bcrypt (cost factor 12).</li>
        <li>
          Optional Google SSO. Enterprise customers can require SSO and
          configure SAML / SCIM.
        </li>
        <li>JWT sessions with short access tokens and refresh rotation.</li>
      </ul>

      <h2>3. Data handling</h2>
      <ul>
        <li>Encryption at rest (AWS-managed KMS) and in transit.</li>
        <li>
          Daily snapshots, 30-day retention. Point-in-time recovery available
          on Enterprise.
        </li>
        <li>
          Role-based access controls on every project. Viewer / Editor / Owner
          roles enforced at the API layer.
        </li>
      </ul>

      <h2>4. Application security</h2>
      <ul>
        <li>Dependencies scanned on every deploy. CVE patches within 72h.</li>
        <li>
          Penetration test annually by an independent third party. Report
          available under NDA on request.
        </li>
        <li>Audit logs on Enterprise (project, case, component, run).</li>
      </ul>

      <h2>5. Disclosure</h2>
      <p>
        Found a vulnerability? Email security@lcapix.com. We acknowledge
        within 24h, fix or mitigate within 7 days for critical issues, and
        credit you in the changelog if you&apos;d like.
      </p>
    </LegalShell>
  )
}
