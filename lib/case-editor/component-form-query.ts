// The URL-query prefill contract of /component/new (and its intercepted
// modal route): ?parent=&type= place a new component; ?edit=<id> with
// name, description, driverCategory, drivers (JSON), operationalCostUSD and
// capitalCostUSD opens it for editing.

import type { ComponentFormInitialValues } from './component-form-model'

export function componentFormFromQuery(searchParams: { get: (key: string) => string | null }): {
  mode: 'create' | 'edit'
  initial: ComponentFormInitialValues | undefined
  suggestedParentId: string | null
  suggestedType: string | null
} {
  const suggestedParentId = searchParams.get('parent')
  const suggestedType = searchParams.get('type')
  const editingId = searchParams.get('edit')

  const initial: ComponentFormInitialValues | undefined = editingId
    ? {
        id: editingId,
        name: searchParams.get('name') || undefined,
        description: searchParams.get('description') || undefined,
        driverCategory: searchParams.get('driverCategory') || undefined,
        drivers: (() => {
          const raw = searchParams.get('drivers')
          if (!raw) return undefined
          try {
            return JSON.parse(raw) as string[]
          } catch {
            return undefined
          }
        })(),
        operationalCostUSD: searchParams.get('operationalCostUSD')
          ? parseFloat(searchParams.get('operationalCostUSD')!)
          : undefined,
        capitalCostUSD: searchParams.get('capitalCostUSD')
          ? parseFloat(searchParams.get('capitalCostUSD')!)
          : undefined,
      }
    : undefined

  return { mode: editingId ? 'edit' : 'create', initial, suggestedParentId, suggestedType }
}
