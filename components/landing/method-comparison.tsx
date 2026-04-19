export function MethodComparison() {
  const methods = [
    {
      index: '01',
      name: 'CML 2001',
      value: '126.82',
      unit: 'kg CO₂-eq',
      description: 'Baseline characterization factors from the Centre of Environmental Science. The LCA industry standard since 2001.',
    },
    {
      index: '02',
      name: 'ReCiPe Midpoint (H)',
      value: '72.37',
      unit: 'kg CO₂-eq',
      description: 'Hierarchist perspective on midpoint impacts. 18 impact categories, consensus scientific weighting.',
    },
    {
      index: '03',
      name: 'TRACI 2.1',
      value: '70.36',
      unit: 'kg CO₂-eq',
      description: 'US EPA method tuned for North American conditions. Required for federal sustainability reporting.',
    },
  ];

  return (
    <section className="py-20 md:py-24 bg-surface-container-low">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        <div className="mb-12 md:mb-16">
          <h2 className="font-mono text-xs md:text-sm text-primary uppercase tracking-[0.2em] mb-4">
            The LCAPIX Advantage
          </h2>
          <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-on-surface">
            Same input, three methods. Three different answers.
          </h3>
          <p className="mt-4 text-on-surface-variant max-w-2xl">
            An EV battery pack assessed across the three most-cited LCA methodologies — 44% variance in the headline number.
            Real science shows its work.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12">
          {methods.map(m => (
            <div key={m.index} className="group">
              <div className="text-7xl md:text-8xl font-mono font-bold leading-none mb-4 opacity-20 group-hover:opacity-100 transition-opacity veridian-gradient bg-clip-text text-transparent">
                {m.index}
              </div>
              <div className="mb-4">
                <div className="text-xs font-mono uppercase tracking-wider text-on-surface-variant mb-1">
                  {m.name}
                </div>
                <div className="num text-3xl md:text-4xl font-bold text-on-surface">
                  {m.value}
                  <span className="ml-2 text-sm text-on-surface-variant">{m.unit}</span>
                </div>
              </div>
              <p className="text-on-surface-variant leading-relaxed">{m.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
