/**
 * Security headers (M3): what next.config.mjs's headers() returns for every
 * path, and that the framework is not advertised.
 */
import { describe, expect, it } from 'vitest';
import nextConfig from '../../../next.config.mjs';

type HeaderRule = { source: string; headers: Array<{ key: string; value: string }> };

async function rules(): Promise<HeaderRule[]> {
  return (await (nextConfig as any).headers()) as HeaderRule[];
}

describe('security headers (next.config.mjs)', () => {
  it('apply to every path', async () => {
    const r = await rules();
    expect(r.map((x) => x.source)).toEqual(['/:path*']);
  });

  it('set HSTS, nosniff, referrer and permissions policies, frame denial and a CSP', async () => {
    const [{ headers }] = await rules();
    const h = Object.fromEntries(headers.map((x) => [x.key, x.value]));
    expect(Object.keys(h).sort()).toEqual([
      'Content-Security-Policy-Report-Only',
      'Permissions-Policy',
      'Referrer-Policy',
      'Strict-Transport-Security',
      'X-Content-Type-Options',
      'X-Frame-Options',
    ]);
    const maxAge = Number(/max-age=(\d+)/.exec(h['Strict-Transport-Security'])?.[1]);
    expect(maxAge).toBeGreaterThanOrEqual(31536000);
    expect(h['Strict-Transport-Security']).toContain('includeSubDomains');
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(h['X-Frame-Options']).toBe('DENY');
    for (const feature of ['camera=()', 'microphone=()', 'geolocation=()']) expect(h['Permissions-Policy']).toContain(feature);
  });

  it('the CSP (report-only for now) locks down framing, objects, base-uri, connections and form targets', async () => {
    const [{ headers }] = await rules();
    const csp = headers.find((x) => x.key === 'Content-Security-Policy-Report-Only')!.value;
    const directives = Object.fromEntries(
      csp.split(';').map((d) => d.trim().split(/\s+/)).map(([name, ...values]) => [name, values]),
    );
    expect(directives['default-src']).toEqual(["'self'"]);
    expect(directives['frame-ancestors']).toEqual(["'none'"]);
    expect(directives['object-src']).toEqual(["'none'"]);
    expect(directives['base-uri']).toEqual(["'self'"]);
    expect(directives['connect-src']).toEqual(["'self'"]);
    expect(directives['form-action']).toEqual(["'self'", 'accounts.google.com']);
    // 'unsafe-eval' only in development.
    expect(directives['script-src']).not.toContain("'unsafe-eval'");
  });

  it('does not advertise the framework (X-Powered-By off)', () => {
    expect((nextConfig as any).poweredByHeader).toBe(false);
  });
});
