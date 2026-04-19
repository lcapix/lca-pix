import Link from 'next/link';
import { LcapixWordmark } from '@/components/brand/lcapix-wordmark';

const NAV_LINKS = [
  { label: 'Platform', href: '#platform', active: true },
  { label: 'Solutions', href: '#solutions' },
  { label: 'Developers', href: '#developers' },
  { label: 'Pricing', href: '#pricing' },
];

export function LandingNav() {
  return (
    <header className="sticky top-0 w-full z-50 glass-panel shadow-botanical">
      <nav className="flex items-center justify-between px-6 md:px-12 py-5 max-w-[1440px] mx-auto">
        <Link href="/" aria-label="LCAPIX home" className="flex items-center">
          <LcapixWordmark size="md" />
        </Link>

        <div className="hidden md:flex items-center gap-10 tracking-tight font-medium text-sm">
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={
                link.active
                  ? 'text-primary font-semibold border-b-2 border-primary pb-0.5 transition-colors'
                  : 'text-on-surface/70 hover:text-primary transition-colors'
              }
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3 md:gap-5">
          <Link
            href="/auth/login"
            className="hidden sm:inline-flex font-medium text-sm text-on-surface/70 hover:text-primary transition-colors"
          >
            Log In
          </Link>
          <Link
            href="/auth/signup"
            className="veridian-gradient text-white px-5 md:px-6 py-2.5 rounded-md font-medium text-sm shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] hover:opacity-95 transition-opacity"
          >
            Get Started
          </Link>
        </div>
      </nav>
    </header>
  );
}
