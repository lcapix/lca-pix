import { Code2, Globe2, History } from 'lucide-react';

export function FeatureGrid() {
  const features = [
    { icon: Code2, title: 'SDK Ready', desc: 'Python SDK + REST API for programmatic access and CI integration.' },
    { icon: Globe2, title: 'Regional Grids', desc: '12 live regions at launch — US states, EU, select APAC via Electricity Maps.' },
    { icon: History, title: 'Full Audit Trail', desc: 'integration_log captures every import, query, and rate update with timestamps.' },
  ];

  return (
    <section className="py-16 md:py-20 bg-surface">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12 grid grid-cols-1 md:grid-cols-3 gap-8">
        {features.map(f => (
          <div key={f.title} className="flex items-start gap-4">
            <f.icon className="w-6 h-6 text-primary mt-1 shrink-0" strokeWidth={1.5} />
            <div>
              <h4 className="text-base font-bold mb-1 text-on-surface">{f.title}</h4>
              <p className="text-sm text-on-surface-variant leading-relaxed">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
