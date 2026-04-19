import { AppTopBar } from "@/components/lcapix"
import { AuthGuard } from "@/components/auth-guard"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  ArrowRight,
  BookOpen,
  Component,
  FolderPlus,
  Rocket,
  Keyboard,
  Terminal as TerminalIcon,
  TreeDeciduous,
} from "lucide-react"

export default function GuidePage() {
  const toc = [
    { href: "#getting-started", label: "Getting Started" },
    { href: "#cases", label: "Understanding Cases" },
    { href: "#components", label: "Building Components" },
    { href: "#data-model", label: "Data Model" },
    { href: "#glossary", label: "Glossary" },
    { href: "#shortcuts", label: "Keyboard Shortcuts" },
  ]

  const glossary = [
    {
      term: "Machine Line Process",
      tag: "TERM_01",
      copy:
        "The top level of the LCAPIX component hierarchy. Represents a full production line or assembly system and anchors all nested processes below it.",
    },
    {
      term: "Subprocess",
      tag: "TERM_02",
      copy:
        "The mid-level node in a process tree. A subprocess groups related operations performed within a single machine line.",
    },
    {
      term: "Operation",
      tag: "TERM_03",
      copy:
        "A detailed step inside a subprocess. Operations capture discrete actions with measurable inputs and outputs.",
    },
    {
      term: "Elemental Task",
      tag: "TERM_04",
      copy:
        "The most granular node in the hierarchy. Elemental tasks are where raw driver quantities, costs, and flows are recorded.",
    },
    {
      term: "Base Case",
      tag: "TERM_05",
      copy:
        "The reference scenario for an LCA project. Comparative cases are always evaluated against the base case.",
    },
    {
      term: "Comparative Case",
      tag: "TERM_06",
      copy:
        "An alternative scenario used for A/B comparison and sensitivity analysis against the base case.",
    },
  ]

  const shortcuts: Array<[string, string]> = [
    ["Open Command Palette", "⌘K"],
    ["New Project", "N P"],
    ["New Case", "N C"],
    ["New Component", "N M"],
    ["Delete Selected", "Del"],
  ]

  return (
    <AuthGuard>
      <><AppTopBar current="home" />
        <div className="bg-surface min-h-screen">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-12 px-6 md:px-12 py-16">
            {/* Sticky left TOC */}
            <aside className="lg:w-64 shrink-0">
              <div className="lg:sticky lg:top-24">
                <div className="mb-8">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg veridian-gradient flex items-center justify-center shadow-botanical">
                      <BookOpen className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-primary text-sm">LCAPIX Guide</h3>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant opacity-60">
                        Platform Docs v1.0
                      </p>
                    </div>
                  </div>
                </div>
                <nav className="space-y-1">
                  <p className="font-mono text-[10px] uppercase tracking-widest opacity-40 mb-3 px-3">
                    Contents
                  </p>
                  {toc.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      className="block px-3 py-2 rounded-lg font-mono text-xs uppercase tracking-widest text-on-surface opacity-60 hover:opacity-100 hover:bg-surface-container-low transition-all"
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>
                <div className="mt-10 p-5 rounded-xl bg-surface-container-low">
                  <p className="font-mono text-[10px] uppercase tracking-widest opacity-60 mb-3">
                    Start Here
                  </p>
                  <Link href="/project/new">
                    <Button className="w-full veridian-gradient text-white font-semibold shadow-botanical">
                      New Project
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </aside>

            {/* Main */}
            <main className="flex-1 min-w-0">
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
                  <span className="font-mono text-primary text-sm font-bold tracking-widest">
                    v1.0
                  </span>
                  <div className="h-px bg-outline-variant/30 flex-1" />
                </div>
                <h1
                  className="text-5xl md:text-[3.5rem] font-black leading-[1.05] mb-6 text-on-surface"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  Technical <span className="text-primary">Ecosystem</span> Guide
                </h1>
                <p className="text-lg text-on-surface-variant max-w-[720px] leading-relaxed">
                  Learn how to create and manage Life Cycle Assessment projects in LCAPIX — from
                  initializing your first process tree to running comparative assessments across
                  the hierarchy.
                </p>
              </section>

              {/* Getting Started + Quick Links bento */}
              <div className="grid grid-cols-12 gap-8 mb-24" id="getting-started">
                <div className="col-span-12 md:col-span-8 bg-surface-container-lowest p-10 rounded-xl shadow-botanical">
                  <div className="flex items-center gap-3 mb-8">
                    <Rocket className="h-7 w-7 text-primary" />
                    <h2 className="text-2xl font-bold tracking-tight">Getting Started</h2>
                  </div>
                  <div className="space-y-6 text-on-surface-variant leading-relaxed max-w-[60ch]">
                    <p>
                      Start by creating a new project to organize your Life Cycle Assessment work.
                      Each project can contain multiple cases for comparison — a base scenario and
                      any number of alternatives.
                    </p>
                    {/* Dark code card */}
                    <div
                      className="rounded-lg p-6 font-mono text-sm leading-[1.7]"
                      style={{ background: "#191c1b", color: "#7bfabb" }}
                    >
                      <div>
                        <span className="opacity-40 select-none">1 </span>
                        <span className="text-white">$ lcapix</span> init
                        <span style={{ color: "#94d3c1" }}> "My LCA Project"</span>
                      </div>
                      <div>
                        <span className="opacity-40 select-none">2 </span>
                        <span className="text-white">$ lcapix</span> case:add
                        <span style={{ color: "#94d3c1" }}> --type base</span>
                      </div>
                      <div>
                        <span className="opacity-40 select-none">3 </span>
                        <span className="text-white">$ lcapix</span> component:add
                        <span style={{ color: "#94d3c1" }}> --type machine-line</span>
                      </div>
                      <div>
                        <span className="opacity-40 select-none">4 </span>
                        <span className="opacity-60"># ready to assess</span>
                      </div>
                    </div>
                    <p>
                      Once your project is initialized, add components hierarchically and attach
                      drivers to elemental tasks. Cases share a component skeleton, so edits
                      propagate cleanly across comparisons.
                    </p>
                    <div className="pt-2">
                      <Link href="/project/new">
                        <Button className="veridian-gradient text-white font-semibold shadow-botanical">
                          Create Your First Project
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="col-span-12 md:col-span-4 space-y-8">
                  <div className="bg-surface-container-low p-8 rounded-xl" id="cases">
                    <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] mb-4 text-primary font-bold">
                      Understanding Cases
                    </h3>
                    <div className="flex items-center gap-3 mb-4">
                      <FolderPlus className="h-5 w-5 text-primary" />
                      <h4 className="text-lg font-bold">Base vs Comparative</h4>
                    </div>
                    <p className="text-sm text-on-surface-variant leading-relaxed mb-5">
                      Base cases represent your reference scenario, while comparative cases
                      represent alternatives for A/B comparison and analysis.
                    </p>
                    <Button
                      variant="outline"
                      className="w-full bg-transparent"
                      disabled
                    >
                      Select a Project First
                    </Button>
                  </div>
                  <div className="p-8 rounded-xl relative overflow-hidden veridian-gradient text-white shadow-botanical">
                    <div className="relative z-10">
                      <h3 className="text-xl font-bold mb-2">New to LCA?</h3>
                      <p className="text-xs opacity-80 mb-6 font-mono">
                        Our guide walks through each node type step-by-step.
                      </p>
                      <Link href="/project/new">
                        <Button
                          variant="secondary"
                          className="bg-white text-primary hover:bg-white/90 font-bold text-xs uppercase tracking-widest"
                        >
                          Start a Project
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* Building Components editorial section */}
              <section className="mb-24" id="components">
                <div className="flex items-center gap-4 mb-12">
                  <h2 className="text-3xl font-bold tracking-tighter">Building Components</h2>
                  <div className="h-px bg-outline-variant/30 flex-1" />
                  <span className="font-mono text-xs opacity-50 uppercase">Sec. 02</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
                  <div className="space-y-4">
                    <span className="font-mono text-xs text-primary font-bold tracking-[0.2em] uppercase">
                      Hierarchy Types
                    </span>
                    <h3 className="text-xl font-bold">Process Types</h3>
                    <p className="text-on-surface-variant leading-relaxed max-w-[60ch]">
                      Components represent different process types in your LCA hierarchy. Each
                      level constrains the children it can hold — keeping trees consistent and
                      comparable across cases.
                    </p>
                    <div className="space-y-2 mt-6">
                      <div className="flex items-center gap-3 px-4 py-3 rounded-full bg-surface-container-lowest">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        <span className="font-medium text-sm">Machine Line Process</span>
                        <span className="font-mono text-[10px] uppercase tracking-widest opacity-50 ml-auto">
                          Top level
                        </span>
                      </div>
                      <div className="flex items-center gap-3 px-4 py-3 ml-4 rounded-full bg-surface-container-lowest">
                        <span className="w-2 h-2 rounded-full bg-primary/70" />
                        <span className="font-medium text-sm">Subprocess</span>
                        <span className="font-mono text-[10px] uppercase tracking-widest opacity-50 ml-auto">
                          Mid level
                        </span>
                      </div>
                      <div className="flex items-center gap-3 px-4 py-3 ml-8 rounded-full bg-surface-container-lowest">
                        <span className="w-2 h-2 rounded-full bg-primary/50" />
                        <span className="font-medium text-sm">Operation</span>
                        <span className="font-mono text-[10px] uppercase tracking-widest opacity-50 ml-auto">
                          Detailed
                        </span>
                      </div>
                      <div className="flex items-center gap-3 px-4 py-3 ml-12 rounded-full bg-surface-container-lowest">
                        <span className="w-2 h-2 rounded-full bg-primary/30" />
                        <span className="font-medium text-sm">Elemental Task</span>
                        <span className="font-mono text-[10px] uppercase tracking-widest opacity-50 ml-auto">
                          Granular
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-surface-container-lowest p-8 rounded-xl shadow-botanical">
                    <div className="flex items-center gap-3 mb-5">
                      <Component className="h-6 w-6 text-primary" />
                      <h4 className="text-lg font-bold">Hierarchical Components</h4>
                    </div>
                    <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
                      Create hierarchical component structures. Components represent different
                      process types in your LCA hierarchy: Machine Line Process, Subprocess,
                      Operation, and Elemental Task.
                    </p>
                    <Button
                      variant="outline"
                      className="w-full bg-transparent"
                      disabled
                    >
                      Select a Case First
                    </Button>
                  </div>
                </div>
              </section>

              {/* Data Model: The Process Root */}
              <section className="mb-24" id="data-model">
                <div className="flex items-center gap-4 mb-12">
                  <h2 className="text-3xl font-bold tracking-tighter">Data Model</h2>
                  <div className="h-px bg-outline-variant/30 flex-1" />
                  <span className="font-mono text-xs opacity-50 uppercase">Sec. 03</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                  <div className="order-2 md:order-1">
                    <div
                      className="aspect-square rounded-2xl shadow-botanical flex items-center justify-center relative overflow-hidden"
                      style={{
                        background:
                          "radial-gradient(circle at 30% 30%, rgba(123,250,187,0.25), transparent 60%), linear-gradient(135deg, #0b0e0d 0%, #191c1b 100%)",
                      }}
                    >
                      <TreeDeciduous className="h-40 w-40 text-primary-fixed opacity-80" />
                      <div className="absolute bottom-6 left-6 right-6">
                        <p className="font-mono text-[10px] uppercase tracking-widest text-primary-fixed opacity-70">
                          root_node / system
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="order-1 md:order-2 space-y-6">
                    <span className="font-mono text-xs text-primary font-bold tracking-[0.2em] uppercase">
                      Core Concept
                    </span>
                    <h3 className="text-2xl font-bold text-primary">The Process Root</h3>
                    <p className="text-on-surface-variant leading-relaxed max-w-[60ch]">
                      At the core of every LCAPIX project is the root process node. Unlike flat
                      hierarchies, LCAPIX uses a recursive branching model where each node
                      inherits properties from its parent while maintaining its own distinct
                      metadata signature.
                    </p>
                    <div className="p-6 rounded-lg bg-surface-container-high/60">
                      <p className="font-mono text-xs text-on-surface-variant italic leading-relaxed">
                        “Each assessment branch influences the global state of your process tree —
                        edits to a base case skeleton propagate through every comparative scenario
                        automatically.”
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Glossary */}
              <section id="glossary" className="mb-24">
                <div className="flex items-center gap-4 mb-12">
                  <h2 className="text-3xl font-bold tracking-tighter">Glossary</h2>
                  <div className="h-px bg-outline-variant/30 flex-1" />
                  <span className="font-mono text-xs opacity-50 uppercase">Sec. 04</span>
                </div>
                <div className="space-y-0">
                  {glossary.map((g) => (
                    <div
                      key={g.tag}
                      className="py-10 flex flex-col md:flex-row gap-8 items-start px-4 -mx-4 rounded-xl group transition-colors hover:veridian-gradient-soft"
                    >
                      <div className="md:w-1/3">
                        <span className="font-mono text-xs text-primary font-bold tracking-[0.2em] block mb-2">
                          {g.tag}
                        </span>
                        <h4 className="text-xl font-bold group-hover:text-primary transition-colors">
                          {g.term}
                        </h4>
                      </div>
                      <div className="md:w-2/3">
                        <p className="text-on-surface-variant leading-relaxed">{g.copy}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Keyboard Shortcuts */}
              <section id="shortcuts" className="mb-24">
                <div className="flex items-center gap-4 mb-12">
                  <Keyboard className="h-7 w-7 text-primary" />
                  <h2 className="text-3xl font-bold tracking-tighter">Keyboard Shortcuts</h2>
                  <div className="h-px bg-outline-variant/30 flex-1" />
                  <span className="font-mono text-xs opacity-50 uppercase">Sec. 05</span>
                </div>
                <p className="text-on-surface-variant leading-relaxed max-w-[720px] mb-10">
                  Speed up your workflow with these shortcuts.
                </p>
                <div className="bg-surface-container-lowest rounded-xl shadow-botanical p-6">
                  <div className="grid gap-0 md:grid-cols-2">
                    {shortcuts.map(([label, keys], idx) => (
                      <div
                        key={label}
                        className={`flex justify-between items-center py-4 px-4 rounded-lg ${
                          idx % 2 === 0 ? "bg-surface" : "bg-surface-container-low"
                        }`}
                      >
                        <span className="text-sm">{label}</span>
                        <kbd className="font-mono px-3 py-1.5 text-xs bg-surface-container-high rounded-md">
                          {keys}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Footer */}
              <footer className="mt-16 pt-10 flex flex-col md:flex-row justify-between items-center gap-6 opacity-60">
                <div className="flex items-center gap-4">
                  <TerminalIcon className="h-4 w-4 text-primary" />
                  <p className="font-mono text-[10px] uppercase tracking-widest">
                    LCAPIX Platform Guide · v1.0
                  </p>
                </div>
                <div className="flex gap-8">
                  <Link
                    href="/about"
                    className="font-mono text-[10px] uppercase tracking-widest hover:text-primary transition-colors"
                  >
                    About
                  </Link>
                  <a
                    href="#getting-started"
                    className="font-mono text-[10px] uppercase tracking-widest hover:text-primary transition-colors"
                  >
                    Back to top
                  </a>
                </div>
              </footer>
            </main>
          </div>
        </div>
      </>
    </AuthGuard>
  )
}
