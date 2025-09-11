"use client"

import { Button } from "@/components/ui/button"
import type { LucideIcon } from "lucide-react"

interface EmptyStateAction {
  label: string
  onClick: () => void
  icon?: LucideIcon
}

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  primaryAction?: EmptyStateAction
  secondaryActions?: EmptyStateAction[]
}

export function EmptyState({ icon: Icon, title, description, primaryAction, secondaryActions }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
        <Icon className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground mb-8 max-w-md mx-auto">{description}</p>

      <div className="space-y-4">
        {primaryAction && (
          <Button onClick={primaryAction.onClick} className="btn-primary">
            {primaryAction.icon && <primaryAction.icon className="mr-2 h-4 w-4" />}
            {primaryAction.label}
          </Button>
        )}

        {secondaryActions && secondaryActions.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {secondaryActions.map((action, index) => (
              <Button key={index} variant="outline" onClick={action.onClick} className="bg-transparent">
                {action.icon && <action.icon className="mr-2 h-4 w-4" />}
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
