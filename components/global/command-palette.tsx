"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { useProjectStore } from "@/lib/store"
import {
  Home,
  FolderKanban,
  Shield,
  Info,
  BookOpen,
  FileText,
  Sun,
  Moon,
  Contrast,
} from "lucide-react"

/**
 * Global Cmd+K command palette. Mounted once in the root layout so it is
 * available on every authenticated route. Self-manages its own open state
 * and keyboard listener.
 */
export function GlobalCommandPalette() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const { setTheme } = useTheme()
  const { projects } = useProjectStore()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  if (!mounted) return null

  const run = (fn: () => void) => {
    setOpen(false)
    fn()
  }

  // Recent projects: sort by updatedAt desc, take 5
  const recent = [...projects]
    .sort((a, b) => {
      const ta = new Date(a.updatedAt ?? 0).getTime()
      const tb = new Date(b.updatedAt ?? 0).getTime()
      return tb - ta
    })
    .slice(0, 5)

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command Palette"
      description="Search commands, navigate, or switch theme."
    >
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => run(() => router.push("/home"))}>
            <Home className="mr-2 h-4 w-4" />
            <span>Home</span>
          </CommandItem>
          <CommandItem onSelect={() => run(() => router.push("/home"))}>
            <FolderKanban className="mr-2 h-4 w-4" />
            <span>Projects</span>
          </CommandItem>
          <CommandItem onSelect={() => run(() => router.push("/admin/integrations"))}>
            <Shield className="mr-2 h-4 w-4" />
            <span>Admin</span>
          </CommandItem>
          <CommandItem onSelect={() => run(() => router.push("/about"))}>
            <Info className="mr-2 h-4 w-4" />
            <span>About</span>
          </CommandItem>
          <CommandItem onSelect={() => run(() => router.push("/guide"))}>
            <BookOpen className="mr-2 h-4 w-4" />
            <span>Guide</span>
          </CommandItem>
        </CommandGroup>

        {recent.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent projects">
              {recent.map((p) => (
                <CommandItem
                  key={p.id}
                  onSelect={() => run(() => router.push(`/project/${p.id}`))}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span className="truncate">{p.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />

        <CommandGroup heading="Theme">
          <CommandItem onSelect={() => run(() => setTheme("light"))}>
            <Sun className="mr-2 h-4 w-4" />
            <span>Light</span>
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTheme("dark"))}>
            <Moon className="mr-2 h-4 w-4" />
            <span>Dark</span>
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTheme("high-contrast"))}>
            <Contrast className="mr-2 h-4 w-4" />
            <span>High contrast</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

export default GlobalCommandPalette
