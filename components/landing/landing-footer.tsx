import Link from 'next/link';
import { LcapixWordmark } from '@/components/brand/lcapix-wordmark';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Documentation', href: '/guide' },
      { label: 'API Reference', href: '/guide#api' },
      { label: 'Integrations', href: '/admin/integrations' },
      { label: 'Changelog', href: '#changelog' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Methodology', href: '/guide#methodology' },
      { label: 'Careers', href: '#careers' },
      { label: 'Contact', href: '#contact' },
    ],
  },
  {
    title: 'Connect',
    links: [
      { label: 'GitHub', href: 'https://github.com' },
      { label: 'LinkedIn', href: 'https://linkedin.com' },
      { label: 'Status', href: '#status' },
      { label: 'Security', href: '#security' },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="bg-background border-t border-outline-variant/20 py-16 md:py-20">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-16 mb-12">
          <div>
            <LcapixWordmark size="md" subtitle="Sustainability Suite" />
            <p className="mt-4 text-sm text-on-surface-variant max-w-xs leading-relaxed">
              Precision botanical data. Built for engineers, not marketing teams.
            </p>
          </div>
          {COLUMNS.map(col => (
            <div key={col.title}>
              <h5 className="font-mono text-xs uppercase tracking-wider text-on-surface-variant mb-5">
                {col.title}
              </h5>
              <ul className="space-y-3">
                {col.links.map(l => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-on-surface hover:text-primary transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-outline-variant/20 pt-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs text-on-surface-variant">
          <span className="font-mono">© 2026 LCAPIX · Botanical Precision Systems</span>
          <div className="flex gap-6">
            <Link href="#privacy" className="hover:text-primary transition-colors">Privacy</Link>
            <Link href="#terms" className="hover:text-primary transition-colors">Terms</Link>
            <Link href="#security" className="hover:text-primary transition-colors">Security</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
