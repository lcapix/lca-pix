import { Activity, ChartLine, FileCheck } from 'lucide-react';

export function TelemetryFeature() {
  return (
    <section className="py-24 md:py-32 bg-surface">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        <div className="grid grid-cols-12 gap-6 auto-rows-auto md:auto-rows-fr md:h-[720px]">
          {/* Large feature — left */}
          <article className="col-span-12 md:col-span-7 md:row-span-2 bg-surface-container-lowest p-8 md:p-12 rounded-xl shadow-sm border border-outline-variant/10 hover:shadow-botanical-hover transition-all flex flex-col justify-between">
            <div>
              <Activity className="w-10 h-10 mb-8 text-primary" strokeWidth={1.5} />
              <h3 className="text-3xl md:text-4xl font-bold tracking-tight mb-6 text-on-surface">
                Real-time Factor Integration
              </h3>
              <p className="text-base md:text-lg text-on-surface-variant max-w-md mb-8 leading-relaxed">
                Pull live characterization factors from openLCA, substance data from PubChem, and regional grid carbon
                from Electricity Maps in a single integrations pane.
              </p>
            </div>

            <pre className="bg-surface-container-high rounded-lg p-5 md:p-6 font-mono text-xs md:text-sm overflow-x-auto">
              <div className="flex gap-4 items-center border-b border-outline-variant/20 pb-3 mb-3">
                <span className="text-primary font-bold">GET</span>
                <span className="text-on-surface/60">/api/integrations/status</span>
              </div>
              <code className="text-on-surface/80 block space-y-1">
                <div>{'{'}</div>
                <div className="pl-4">&quot;success&quot;: true,</div>
                <div className="pl-4">&quot;factors_imported&quot;: <span className="text-primary">162</span>,</div>
                <div className="pl-4">&quot;methods&quot;: [&quot;CML 2001&quot;, &quot;ReCiPe H&quot;, &quot;TRACI 2.1&quot;],</div>
                <div className="pl-4">&quot;last_sync&quot;: &quot;2026-04-19T04:07Z&quot;</div>
                <div>{'}'}</div>
              </code>
            </pre>
          </article>

          {/* Small feature — top right */}
          <article className="col-span-12 md:col-span-5 bg-surface-container-low p-8 md:p-10 rounded-xl hover:bg-surface-container-lowest transition-colors border border-outline-variant/10">
            <ChartLine className="w-8 h-8 mb-6 text-primary" strokeWidth={1.5} />
            <h4 className="text-xl font-bold mb-3 text-on-surface">Multi-Method Scoring</h4>
            <p className="text-on-surface-variant leading-relaxed">
              CML · ReCiPe · TRACI in a single assessment run. Export each or compare side-by-side in analytics.
            </p>
          </article>

          {/* Small feature — bottom right */}
          <article className="col-span-12 md:col-span-5 bg-surface-container-low p-8 md:p-10 rounded-xl hover:bg-surface-container-lowest transition-colors border border-outline-variant/10">
            <FileCheck className="w-8 h-8 mb-6 text-primary" strokeWidth={1.5} />
            <h4 className="text-xl font-bold mb-3 text-on-surface">Audit-Ready PDFs</h4>
            <p className="text-on-surface-variant leading-relaxed">
              ISO 14040/14044 aligned reports with full source attribution for every factor and cost rate.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
