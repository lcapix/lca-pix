import { AppTopBar } from "@/components/lcapix"
import { AuthGuard } from "@/components/auth-guard"
import { Leaf, Target, Users, Zap } from "lucide-react"

export default function AboutPage() {
  const features = [
    "Hierarchical Component Structure",
    "Base vs Comparative Analysis",
    "Cost Tracking",
    "Driver Category Management",
    "Real-time Collaboration",
  ]

  const audiences = [
    {
      name: "Sustainability Teams",
      copy: "Track and analyze environmental impact across product lifecycles.",
    },
    {
      name: "Product Managers",
      copy: "Make informed decisions about product design and materials.",
    },
    {
      name: "Consultants",
      copy: "Deliver comprehensive LCA reports to clients efficiently.",
    },
  ]

  const capabilities = [
    {
      title: "Project Organization",
      copy: "Organize your LCA work into projects with multiple comparison cases.",
    },
    {
      title: "Hierarchical Components",
      copy: "Build detailed process hierarchies from machine lines to elemental tasks.",
    },
    {
      title: "Cost Analysis",
      copy: "Track operational and capital costs across all components.",
    },
    {
      title: "Driver Management",
      copy: "Categorize and manage environmental drivers across energy, material, labor, and transport.",
    },
  ]

  return (
    <AuthGuard>
      <><AppTopBar current="home" />
        <div className="bg-surface min-h-screen">
          <div className="max-w-5xl mx-auto px-8 md:px-16 py-16">
            {/* Hero */}
            <section className="mb-24 relative">
              <div
                className="absolute -top-16 -left-16 w-64 h-64 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle at center, rgba(123, 250, 187, 0.15) 0%, transparent 70%)",
                }}
              />
              <div className="flex items-baseline gap-4 mb-6">
                <span className="font-mono text-xs font-bold tracking-widest text-primary uppercase">
                  About / LCAPIX
                </span>
                <div className="h-px bg-outline-variant/30 flex-1" />
              </div>
              <div className="flex items-start gap-5">
                <div className="w-12 h-12 rounded-xl veridian-gradient flex items-center justify-center shadow-botanical shrink-0">
                  <Leaf className="h-6 w-6 text-white" />
                </div>
                <div className="max-w-[720px]">
                  <h1
                    className="text-5xl md:text-[3.5rem] font-black leading-[1.05] mb-6 text-on-surface"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    Professional <span className="text-primary">Life Cycle</span> Assessment,
                    reimagined.
                  </h1>
                  <p className="text-lg text-on-surface-variant leading-relaxed">
                    Professional Life Cycle Assessment platform for sustainable decision making.
                  </p>
                </div>
              </div>
            </section>

            {/* Mission + Features */}
            <section className="grid grid-cols-12 gap-8 mb-24">
              <div className="col-span-12 md:col-span-7 bg-surface-container-lowest p-10 rounded-xl shadow-botanical">
                <div className="flex items-center gap-3 mb-6">
                  <Target className="h-7 w-7 text-primary" />
                  <h2 className="text-2xl font-bold tracking-tight">Our Mission</h2>
                </div>
                <p className="text-on-surface-variant leading-relaxed max-w-[60ch]">
                  To democratize Life Cycle Assessment by providing intuitive, powerful tools that
                  enable organizations to make data-driven sustainable decisions and reduce their
                  environmental impact.
                </p>
              </div>
              <div className="col-span-12 md:col-span-5 bg-surface-container-low p-10 rounded-xl">
                <div className="flex items-center gap-3 mb-6">
                  <Zap className="h-6 w-6 text-primary" />
                  <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary font-bold">
                    Key Features
                  </h3>
                </div>
                <ul className="space-y-3">
                  {features.map((f) => (
                    <li
                      key={f}
                      className="flex items-center gap-3 px-4 py-3 rounded-full bg-surface-container-lowest"
                    >
                      <span className="w-1.5 h-1.5 rounded-full veridian-gradient" />
                      <span className="text-sm font-medium">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* Who We Serve */}
            <section className="mb-24">
              <div className="flex items-center gap-4 mb-12">
                <Users className="h-7 w-7 text-primary" />
                <h2 className="text-3xl font-bold tracking-tighter">Who We Serve</h2>
                <div className="h-px bg-outline-variant/30 flex-1" />
                <span className="font-mono text-xs opacity-50 uppercase">Sec. 01</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {audiences.map((a) => (
                  <div
                    key={a.name}
                    className="p-8 rounded-xl bg-surface-container-lowest shadow-botanical transition-colors hover:veridian-gradient-soft"
                  >
                    <span className="font-mono text-[10px] text-primary font-bold tracking-[0.2em] uppercase block mb-3">
                      Audience
                    </span>
                    <h3 className="text-xl font-bold mb-3">{a.name}</h3>
                    <p className="text-sm text-on-surface-variant leading-relaxed">{a.copy}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Platform Capabilities */}
            <section className="mb-24">
              <div className="flex items-center gap-4 mb-12">
                <h2 className="text-3xl font-bold tracking-tighter">Platform Capabilities</h2>
                <div className="h-px bg-outline-variant/30 flex-1" />
                <span className="font-mono text-xs opacity-50 uppercase">Sec. 02</span>
              </div>
              <p className="text-on-surface-variant leading-relaxed max-w-[720px] mb-10">
                Comprehensive LCA management from project creation to assessment.
              </p>
              <div className="space-y-0">
                {capabilities.map((c, idx) => (
                  <div
                    key={c.title}
                    className={`py-8 flex flex-col md:flex-row gap-8 items-start px-4 -mx-4 rounded-xl group transition-colors hover:veridian-gradient-soft ${
                      idx === 0 ? "" : ""
                    }`}
                  >
                    <div className="md:w-1/3">
                      <span className="font-mono text-xs text-primary font-bold tracking-[0.2em] block mb-2">
                        CAP_0{idx + 1}
                      </span>
                      <h4 className="text-xl font-bold group-hover:text-primary transition-colors">
                        {c.title}
                      </h4>
                    </div>
                    <div className="md:w-2/3">
                      <p className="text-on-surface-variant leading-relaxed">{c.copy}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </>
    </AuthGuard>
  )
}
