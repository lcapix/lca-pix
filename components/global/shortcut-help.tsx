"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Shortcut {
  keys: string[]
  label: string
}

const SHORTCUTS: Shortcut[] = [
  { keys: ["⌘", "K"], label: "Open command palette" },
  { keys: ["Ctrl", "K"], label: "Open command palette (Windows/Linux)" },
  { keys: ["⌘", "B"], label: "Toggle sidebar (where available)" },
  { keys: ["?"], label: "Show this help" },
  { keys: ["Esc"], label: "Close modal" },
]

/**
 * Modal that lists keyboard shortcuts. Triggered by pressing `?` while
 * not focused in an input, textarea, contentEditable, or select element.
 * Mounted once in the root layout.
 */
export function ShortcutHelp() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const isEditable = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false
      const tag = el.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
      if (el.isContentEditable) return true
      return false
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "?") return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isEditable(e.target)) return
      e.preventDefault()
      setOpen((o) => !o)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  if (!mounted) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Speed through LCAPIX with these shortcuts.
          </DialogDescription>
        </DialogHeader>
        <ul className="mt-2 divide-y divide-border">
          {SHORTCUTS.map((s) => (
            <li
              key={s.label}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span className="text-foreground">{s.label}</span>
              <span className="flex items-center gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}

export default ShortcutHelp
