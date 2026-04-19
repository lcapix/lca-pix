import Link from 'next/link';
import Image from 'next/image';

export function LandingHero() {
  return (
    <section className="relative pt-16 md:pt-24 pb-24 md:pb-32 overflow-hidden bg-gradient-to-b from-background via-[#f2f8f5] to-background">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Left: headline + CTAs */}
        <div className="z-10">
          <span className="font-mono text-xs uppercase tracking-[0.15em] text-primary mb-6 block">
            Precision Botanical Data
          </span>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-black leading-[1.05] tracking-[-0.04em] text-on-surface mb-8">
            Built for sustainability engineers. <br />
            <span className="text-primary">Not greenwash.</span>
          </h1>
          <p className="text-base md:text-lg text-on-surface-variant max-w-lg mb-10 leading-relaxed">
            The world&apos;s first high-fidelity API for botanical carbon sequestration modeling.
            Real-time data points, zero estimations, absolute precision.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/auth/signup"
              className="veridian-gradient text-white px-6 md:px-8 py-3.5 md:py-4 rounded-md font-bold text-base md:text-lg shadow-xl hover:opacity-95 transition-opacity"
            >
              Start Building Now
            </Link>
            <Link
              href="/guide"
              className="px-6 md:px-8 py-3.5 md:py-4 font-mono text-xs uppercase tracking-widest text-primary hover:bg-primary-fixed/10 transition-colors rounded-md"
            >
              Read Documentation
            </Link>
          </div>
        </div>

        {/* Right: product screenshot with glow + ring */}
        <div className="relative">
          <div
            aria-hidden
            className="absolute inset-0 bg-primary-fixed opacity-10 blur-[120px] rounded-full translate-x-12 translate-y-12"
          />
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/20 hero-glow bg-inverse-surface">
            <Image
              src="/screenshots/landing-hero-results.png"
              alt="LCAPIX assessment results dashboard showing impact categories and flow breakdown"
              width={960}
              height={720}
              className="w-full h-auto object-cover aspect-[4/3]"
              priority
            />
            <div className="absolute inset-0 ring-1 ring-inset ring-primary/20 rounded-2xl pointer-events-none" />
          </div>
        </div>
      </div>
    </section>
  );
}
