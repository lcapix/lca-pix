"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { CommandPalette } from "@/components/command-palette"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { useTheme } from "next-themes"
import { useAuthStore } from "@/lib/store"
import { useToast } from "@/hooks/use-toast"
import { Search, User, Settings, Keyboard, LogOut, Sun, Moon, Monitor, Contrast, Sparkles } from "lucide-react"

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const [commandOpen, setCommandOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const { toast } = useToast()

  const handleLogout = () => {
    logout()
    toast({
      title: "Logged out",
      description: "You have been successfully logged out.",
    })
    router.push("/auth/login")
  }

  const navItems = [
    { name: "Home", href: "/home", active: pathname === "/home" },
    { name: "Guide", href: "/guide", active: pathname === "/guide" },
    { name: "Build", href: "/project/new", active: pathname.startsWith("/project") },
    { name: "About", href: "/about", active: pathname === "/about" },
  ]

  // Don't show navbar on auth pages
  if (pathname.startsWith("/auth")) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky top navbar */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          {/* Left: LCAPIX logo */}
          <div className="flex items-center space-x-2">
            <Link href="/home" className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">LC</span>
              </div>
              <span className="font-bold text-xl">LCAPIX</span>
            </Link>
          </div>

          {/* Center: Navigation tabs */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link key={item.name} href={item.href}>
                <Button
                  variant={item.active ? "secondary" : "ghost"}
                  className={`px-4 py-2 ${item.active ? "bg-secondary text-secondary-foreground" : ""}`}
                >
                  {item.name}
                </Button>
              </Link>
            ))}
          </nav>

          {/* Right: Search and user menu */}
          <div className="flex items-center space-x-2">
            {/* Global "Take the tour" button — works from any page.
                Sets a sessionStorage flag and routes to /home, where the
                home page auto-opens the guided tour. */}
            <Button
              variant="ghost"
              size="sm"
              className="hidden md:flex items-center gap-1.5 text-primary hover:text-primary hover:bg-primary/10"
              onClick={() => {
                try { sessionStorage.setItem("lcapix:start-tour", "1") } catch {}
                if (pathname === "/home") {
                  // already on home — dispatch a custom event the page listens for
                  window.dispatchEvent(new CustomEvent("lcapix:start-tour"))
                } else {
                  router.push("/home")
                }
              }}
              title="Walk me through LCAPIX"
            >
              <Sparkles className="h-4 w-4" />
              <span className="text-sm">Tour</span>
            </Button>

            {/* Search button */}
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:flex items-center space-x-2 text-muted-foreground bg-transparent"
              onClick={() => setCommandOpen(true)}
            >
              <Search className="h-4 w-4" />
              <span className="text-sm">Search...</span>
              <Badge variant="secondary" className="text-xs">
                ⌘K
              </Badge>
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="sm:hidden bg-transparent"
              onClick={() => setCommandOpen(true)}
            >
              <Search className="h-4 w-4" />
            </Button>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="/placeholder.svg" alt={user?.name || ""} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <ThemeMenuItem />
                <DropdownMenuItem onClick={() => setCommandOpen(true)}>
                  <Keyboard className="mr-2 h-4 w-4" />
                  <span>Keyboard shortcuts</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Breadcrumbs */}
      <Breadcrumbs />

      {/* Main content */}
      <main className="flex-1">{children}</main>

      {/* Command Palette */}
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  )
}

function ThemeMenuItem() {
  const { setTheme, theme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)

  const themes = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "high-contrast", label: "High Contrast", icon: Contrast },
  ]

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <Settings className="mr-2 h-4 w-4" />
          <span>Theme</span>
        </DropdownMenuItem>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" className="w-32">
        {themes.map((themeOption) => {
          const Icon = themeOption.icon
          return (
            <DropdownMenuItem 
              key={themeOption.value} 
              onClick={() => {
                setTheme(themeOption.value)
                setIsOpen(false)
              }}
            >
              <Icon className="mr-2 h-4 w-4" />
              <span>{themeOption.label}</span>
              {theme === themeOption.value && <span className="ml-auto">✓</span>}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
