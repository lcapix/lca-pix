import type { Project, Case, Component } from "./store"

// Mock data generator for testing
export function generateMockProjects(count = 3): Project[] {
  const projects: Project[] = []

  for (let i = 1; i <= count; i++) {
    const projectId = `project-${i}`
    const baseDate = new Date()
    baseDate.setDate(baseDate.getDate() - i * 7) // Stagger dates

    const baseCaseId = `case-base-${i}`
    const compCaseId = `case-comp-${i}`

    const baseCase: Case = {
      id: baseCaseId,
      projectId,
      type: "base",
      name: `Base Case ${i}`,
      description: `Reference scenario for project ${i}`,
      createdAt: baseDate,
      updatedAt: baseDate,
      components: generateMockComponents(baseCaseId, 2),
    }

    const compCase: Case = {
      id: compCaseId,
      projectId,
      type: "comparative",
      name: `Alternative ${i}`,
      description: `Comparative scenario for project ${i}`,
      createdAt: baseDate,
      updatedAt: baseDate,
      components: generateMockComponents(compCaseId, 3),
    }

    const project: Project = {
      id: projectId,
      name: `LCA Project ${i}`,
      description: `Life cycle assessment for product line ${i}`,
      ownerId: "user-1",
      createdAt: baseDate,
      updatedAt: baseDate,
      cases: [baseCase, compCase],
    }

    projects.push(project)
  }

  return projects
}

function generateMockComponents(caseId: string, count: number): Component[] {
  const components: Component[] = []
  const processTypes: Component["processType"][] = ["Machine Line Process", "Subprocess", "Operation", "Elemental Task"]

  const driverCategories = ["Energy", "Material", "Labor", "Transport"]
  const drivers = {
    Energy: ["Electricity", "Natural Gas", "Steam"],
    Material: ["Metal", "Plastic", "Composite"],
    Labor: ["Assembly", "Quality Control", "Maintenance"],
    Transport: ["Trucking", "Rail", "Shipping"],
  }

  for (let i = 1; i <= count; i++) {
    const processType = processTypes[i % processTypes.length]
    const driverCategory = driverCategories[i % driverCategories.length]

    const component: Component = {
      id: `component-${caseId}-${i}`,
      caseId,
      processType,
      processName: `${processType} ${i}`,
      description: `Description for ${processType.toLowerCase()} ${i}`,
      driverCategory,
      drivers: drivers[driverCategory as keyof typeof drivers].slice(0, 2),
      operationalCostUSD: Math.floor(Math.random() * 50000) + 10000,
      capitalCostUSD: Math.floor(Math.random() * 200000) + 50000,
    }

    components.push(component)
  }

  return components
}

// Function to populate store with mock data for testing
export function populateWithMockData() {
  if (typeof window !== "undefined") {
    const mockProjects = generateMockProjects(3)
    localStorage.setItem(
      "lcapix-projects",
      JSON.stringify({
        state: { projects: mockProjects, currentProject: null },
        version: 0,
      }),
    )
    window.location.reload()
  }
}
