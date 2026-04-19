import type React from "react"
import type { Metadata } from "next"
import { Inter_Tight, IBM_Plex_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"

const interTight = Inter_Tight({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
})

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
  weight: ["400", "500", "600"],
})

export const metadata: Metadata = {
  title: "LCAPIX — Botanical Precision in Sustainability Data",
  description: "Life-cycle assessment with cost + environmental impact in one view. CML · ReCiPe · TRACI methods. ISO 14040/14044 compliant.",
  generator: "LCAPIX v3",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${interTight.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased bg-background text-on-surface" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} themes={["light", "dark", "high-contrast"]}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
