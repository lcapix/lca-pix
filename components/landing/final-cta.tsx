import Link from 'next/link';

export function FinalCta() {
  return (
    <section className="relative bg-inverse-surface text-inverse-on-surface py-24 md:py-32 overflow-hidden">
      <div className="absolute inset-0 veridian-light opacity-30 pointer-events-none" />
      <div className="relative max-w-3xl mx-auto text-center px-6 md:px-12">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-inverse-on-surface">
          Ready to build the future of{' '}
          <span className="veridian-gradient bg-clip-text text-transparent">accountable nature?</span>
        </h2>
        <p className="text-base md:text-lg text-inverse-on-surface/70 mb-10 max-w-xl mx-auto">
          Start free. Upgrade when you need team collaboration, private data sources, or enterprise support.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/auth/signup"
            className="veridian-gradient text-white px-8 py-4 rounded-md font-bold text-base md:text-lg shadow-xl hover:opacity-95 transition-opacity"
          >
            Get Your API Key
          </Link>
          <Link
            href="/guide"
            className="px-8 py-4 font-mono text-xs uppercase tracking-widest text-inverse-on-surface/70 hover:text-primary transition-colors rounded-md"
          >
            Talk to an Engineer
          </Link>
        </div>
      </div>
    </section>
  );
}
