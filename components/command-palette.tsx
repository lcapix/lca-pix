"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
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
import { useToast } from "@/hooks/use-toast"
import { Home, BookOpen, Hammer, Info, Plus, FolderPlus, FileText, Component, Search } from "lucide-react"

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [search, setSearch] = useState("")
  const router = useRouter()
  const { projects } = useProjectStore()
  const { toast } = useToast()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [open, onOpenChange])

  const runCommand = (command: () => void) => {
    onOpenChange(false)
    command()
  }

  const filteredProjects = projects.filter((project) => project.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." value={search} onValueChange={setSearch} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Navigation */}
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => router.push("/home"))}>
            <Home className="mr-2 h-4 w-4" />
            <span>Home</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/guide"))}>
            <BookOpen className="mr-2 h-4 w-4" />
            <span>Guide</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/project/new"))}>
            <Hammer className="mr-2 h-4 w-4" />
            <span>Build</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/about"))}>
            <Info className="mr-2 h-4 w-4" />
            <span>About</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Quick Actions */}
        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => runCommand(() => router.push("/project/new"))}>
            <Plus className="mr-2 h-4 w-4" />
            <span>Create Project</span>
            <span className="ml-auto text-xs text-muted-foreground">N P</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                toast({
                  title: "Create Base Case",
                  description: "Please select a project first",
                  variant: "destructive",
                })
              })
            }
          >
            <FolderPlus className="mr-2 h-4 w-4" />
            <span>Create Base Case</span>
            <span className="ml-auto text-xs text-muted-foreground">N C</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                toast({
                  title: "Create Component",
                  description: "Please select a case first",
                  variant: "destructive",
                })
              })
            }
          >
            <Component className="mr-2 h-4 w-4" />
            <span>Create Component</span>
            <span className="ml-auto text-xs text-muted-foreground">N M</span>
          </CommandItem>
        </CommandGroup>

        {/* Projects */}
        {filteredProjects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Projects">
              {filteredProjects.slice(0, 5).map((project) => (
                <CommandItem key={project.id} onSelect={() => runCommand(() => router.push(`/project/${project.id}`))}>
                  <FileText className="mr-2 h-4 w-4" />
                  <span>{project.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{project.cases.length} cases</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Cases */}
        {search && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Cases">
              {projects
                .flatMap((project) =>
                  project.cases
                    .filter((case_) => case_.name.toLowerCase().includes(search.toLowerCase()))
                    .map((case_) => ({ ...case_, projectName: project.name })),
                )
                .slice(0, 3)
                .map((case_) => (
                  <CommandItem
                    key={case_.id}
                    onSelect={() => runCommand(() => router.push(`/project/${case_.projectId}/case/${case_.id}`))}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    <span>{case_.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{case_.projectName}</span>
                  </CommandItem>
                ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
