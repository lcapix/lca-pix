import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface User {
  id: string
  name: string
  email: string
  createdAt: Date
}

export interface Project {
  id: string
  name: string
  description: string
  ownerId: string
  createdAt: Date
  updatedAt: Date
  cases: Case[]
}

export interface Case {
  id: string
  projectId: string
  type: "base" | "comparative"
  name: string
  description?: string
  createdAt: Date
  updatedAt: Date
  components: ComponentNode[]
}

export type NodeType = "product" | "machine" | "subprocess" | "operation" | "elemental"

export interface ComponentNode {
  id: string
  caseId: string
  parentId?: string | null
  type: NodeType
  name: string
  description?: string
  processType?: string
  driverCategory?: string
  selectedDriver?: string
  drivers?: string[]
  mass?: number
  massUnit?: string
  operationalCostUSD?: number
  capitalCostUSD?: number
}

export interface Flow {
  id: string
  nodeId: string
  direction: "input" | "output"
  substance: string
  amount: number
  unit: string
}

export interface Component {
  id: string
  caseId: string
  processType: "Machine Line Process" | "Subprocess" | "Operation" | "Elemental Task" | "Custom"
  processName: string
  description: string
  driverCategory: string
  drivers: string[]
  operationalCostUSD: number
  capitalCostUSD: number
  children?: Component[]
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  login: (user: User) => void
  logout: () => void
}

interface ProjectState {
  projects: Project[]
  currentProject: Project | null
  flows: Flow[]
  nodes: Node[]
  addProject: (project: Omit<Project, "id" | "createdAt" | "updatedAt" | "cases"> & { id?: string }) => void
  updateProject: (id: string, updates: Partial<Project>) => void
  deleteProject: (id: string) => void
  setCurrentProject: (project: Project | null) => void
  addCase: (projectId: string, case_: Omit<Case, "createdAt" | "updatedAt" | "components"> & { id?: string }) => void
  updateCase: (caseId: string, updates: Partial<Case>) => void
  deleteCase: (caseId: string) => void
  addComponentNode: (caseId: string, component: Omit<ComponentNode, "id">) => ComponentNode
  updateComponentNode: (componentId: string, updates: Partial<ComponentNode>) => void
  deleteComponentNode: (componentId: string) => void
  addFlow: (nodeId: string, flow: Omit<Flow, "id">) => void
  updateFlow: (flowId: string, updates: Partial<Flow>) => void
  deleteFlow: (flowId: string) => void
  getFlowsForNode: (nodeId: string) => Flow[]
  addNode: (caseId: string, node: Omit<Node, "id">) => Node
  updateNode: (nodeId: string, updates: Partial<Node>) => void
  deleteNode: (nodeId: string) => void
  moveNode: (nodeId: string, newParentId: string | null) => void
  duplicateNode: (nodeId: string) => Node | null
  getNodesForCase: (caseId: string) => Node[]
  initializeDemoNodes: (caseId: string) => void
  runMoveTest: (caseId: string) => void
  // Legacy component methods for backward compatibility
  addComponent: (caseId: string, component: Omit<Component, "id">) => void
  updateComponent: (componentId: string, updates: Partial<Component>) => void
  deleteComponent: (componentId: string) => void
  runGuidedTest: (caseId: string) => void
}

interface ThemeState {
  theme: "light" | "dark" | "high-contrast"
  reducedMotion: boolean
  setTheme: (theme: "light" | "dark" | "high-contrast") => void
  setReducedMotion: (reduced: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: (user) => set({ user, isAuthenticated: true }),
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: "lcapix-auth",
    },
  ),
)

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      currentProject: null,
      flows: [],
      nodes: [] as Node[],
      addProject: (projectData) => {
        const project: Project = {
          ...projectData,
          id: projectData.id || crypto.randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
          cases: [],
        }
        set((state) => ({ projects: [...state.projects, project] }))
      },
      updateProject: (id, updates) => {
        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p)),
        }))
      },
      deleteProject: (id) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          currentProject: state.currentProject?.id === id ? null : state.currentProject,
          nodes: state.nodes.filter((n) => n.caseId !== id),
        }))
      },
      setCurrentProject: (project) => set({ currentProject: project }),
      addCase: (projectId, caseData) => {
        const case_: Case = {
          ...caseData,
          id: caseData.id || crypto.randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
          components: [],
        }
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, cases: [...p.cases, case_], updatedAt: new Date() } : p,
          ),
        }))
      },
      updateCase: (caseId, updates) => {
        set((state) => ({
          projects: state.projects.map((p) => ({
            ...p,
            cases: p.cases.map((c) => (c.id === caseId ? { ...c, ...updates, updatedAt: new Date() } : c)),
          })),
        }))
      },
      deleteCase: (caseId) => {
        set((state) => ({
          projects: state.projects.map((p) => ({
            ...p,
            cases: p.cases.filter((c) => c.id !== caseId),
          })),
          nodes: state.nodes.filter((n) => n.caseId !== caseId),
        }))
      },
      addComponentNode: (caseId, componentData) => {
        const component: ComponentNode = {
          ...componentData,
          id: crypto.randomUUID(),
        }

        // Auto-correction: if first node is not product, create product root
        const state = get()
        const project = state.projects.find((p) => p.cases.some((c) => c.id === caseId))
        const case_ = project?.cases.find((c) => c.id === caseId)

        if (case_ && case_.components.length === 0 && component.type !== "product") {
          const productRoot: ComponentNode = {
            id: crypto.randomUUID(),
            caseId,
            type: "product",
            name: "Product",
            parentId: null,
          }

          component.parentId = productRoot.id

          set((state) => ({
            projects: state.projects.map((p) => ({
              ...p,
              cases: p.cases.map((c) =>
                c.id === caseId
                  ? {
                      ...c,
                      components: [...c.components, productRoot, component],
                      updatedAt: new Date(),
                    }
                  : c,
              ),
            })),
          }))

          return component
        }

        set((state) => ({
          projects: state.projects.map((p) => ({
            ...p,
            cases: p.cases.map((c) =>
              c.id === caseId ? { ...c, components: [...c.components, component], updatedAt: new Date() } : c,
            ),
          })),
        }))

        return component
      },
      updateComponentNode: (componentId, updates) => {
        set((state) => ({
          projects: state.projects.map((p) => ({
            ...p,
            cases: p.cases.map((c) => ({
              ...c,
              components: c.components.map((comp) => (comp.id === componentId ? { ...comp, ...updates } : comp)),
            })),
          })),
        }))
      },
      deleteComponentNode: (componentId) => {
        set((state) => ({
          projects: state.projects.map((p) => ({
            ...p,
            cases: p.cases.map((c) => ({
              ...c,
              components: c.components.filter((comp) => comp.id !== componentId),
            })),
          })),
          flows: state.flows.filter((f) => f.nodeId !== componentId),
        }))
      },
      addFlow: (nodeId, flowData) => {
        const flow: Flow = {
          ...flowData,
          id: crypto.randomUUID(),
        }
        set((state) => ({
          flows: [...state.flows, flow],
        }))
      },
      updateFlow: (flowId, updates) => {
        set((state) => ({
          flows: state.flows.map((f) => (f.id === flowId ? { ...f, ...updates } : f)),
        }))
      },
      deleteFlow: (flowId) => {
        set((state) => ({
          flows: state.flows.filter((f) => f.id !== flowId),
        }))
      },
      getFlowsForNode: (nodeId) => {
        return get().flows.filter((f) => f.nodeId === nodeId)
      },
      addNode: (caseId, nodeData) => {
        const node: Node = {
          ...nodeData,
          id: crypto.randomUUID(),
        }

        set((state) => ({
          ...state,
          nodes: [...(state.nodes || []), node],
        }))

        return node
      },

      updateNode: (nodeId, updates) => {
        set((state) => ({
          ...state,
          nodes: (state.nodes || []).map((node) => (node.id === nodeId ? { ...node, ...updates } : node)),
        }))
      },

      deleteNode: (nodeId) => {
        const state = get()
        const nodesToDelete = new Set<string>()

        // Find all descendants recursively
        const findDescendants = (id: string) => {
          nodesToDelete.add(id)
          const children = (state.nodes || []).filter((n) => n.parentId === id)
          children.forEach((child) => findDescendants(child.id))
        }

        findDescendants(nodeId)

        set((state) => ({
          ...state,
          nodes: (state.nodes || []).filter((node) => !nodesToDelete.has(node.id)),
        }))
      },

      moveNode: (nodeId, newParentId) => {
        const state = get()
        const nodes = state.nodes || []

        // Prevent moving a node under its own descendant
        const isDescendant = (potentialParentId: string | null, ancestorId: string): boolean => {
          if (!potentialParentId) return false
          if (potentialParentId === ancestorId) return true
          const parent = nodes.find((n) => n.id === potentialParentId)
          return parent ? isDescendant(parent.parentId, ancestorId) : false
        }

        if (newParentId && isDescendant(newParentId, nodeId)) {
          return // Invalid move
        }

        set((state) => ({
          ...state,
          nodes: (state.nodes || []).map((node) => (node.id === nodeId ? { ...node, parentId: newParentId } : node)),
        }))
      },

      duplicateNode: (nodeId) => {
        const state = get()
        const originalNode = (state.nodes || []).find((n) => n.id === nodeId)
        if (!originalNode) return null

        const duplicatedNode: Node = {
          ...originalNode,
          id: crypto.randomUUID(),
          name: `${originalNode.name} (Copy)`,
        }

        set((state) => ({
          ...state,
          nodes: [...(state.nodes || []), duplicatedNode],
        }))

        return duplicatedNode
      },

      getNodesForCase: (caseId) => {
        const state = get()
        return (state.nodes || []).filter((node) => node.caseId === caseId)
      },

      initializeDemoNodes: (caseId) => {
        const demoNodes: Node[] = [
          {
            id: crypto.randomUUID(),
            caseId,
            name: "Product Root",
            parentId: null,
          },
          {
            id: crypto.randomUUID(),
            caseId,
            name: "Subprocess A",
            parentId: null, // Will be updated after root is created
          },
          {
            id: crypto.randomUUID(),
            caseId,
            name: "Subprocess B",
            parentId: null, // Will be updated after root is created
          },
        ]

        // Set proper parent relationships
        demoNodes[1].parentId = demoNodes[0].id // Subprocess A -> Product Root
        demoNodes[2].parentId = demoNodes[0].id // Subprocess B -> Product Root

        // Add child to Subprocess A
        const printSticker: Node = {
          id: crypto.randomUUID(),
          caseId,
          name: "Elementary Task A",
          parentId: demoNodes[1].id, // Subprocess A
        }

        demoNodes.push(printSticker)

        set((state) => ({
          ...state,
          nodes: [...(state.nodes || []).filter((n) => n.caseId !== caseId), ...demoNodes],
        }))
      },

      runMoveTest: (caseId) => {
        const state = get()
        const nodes = (state.nodes || []).filter((n) => n.caseId === caseId)

        // Find "Elementary Task A" and "Subprocess B" nodes
        const printStickerNode = nodes.find((n) => n.name === "Elementary Task A")
        const attachStickerNode = nodes.find((n) => n.name === "Subprocess B")

        if (printStickerNode && attachStickerNode) {
          // Move "Elementary Task A" from "Subprocess A" to "Subprocess B"
          set((state) => ({
            ...state,
            nodes: (state.nodes || []).map((node) =>
              node.id === printStickerNode.id ? { ...node, parentId: attachStickerNode.id } : node,
            ),
          }))
        }
      },
      // Legacy component methods for backward compatibility
      addComponent: (caseId, componentData) => {
        const component: Component = {
          ...componentData,
          id: crypto.randomUUID(),
        }
        set((state) => ({
          projects: state.projects.map((p) => ({
            ...p,
            cases: p.cases.map((c) =>
              c.id === caseId ? { ...c, components: [...c.components, component], updatedAt: new Date() } : c,
            ),
          })),
        }))
      },
      updateComponent: (componentId, updates) => {
        set((state) => ({
          projects: state.projects.map((p) => ({
            ...p,
            cases: p.cases.map((c) => ({
              ...c,
              components: c.components.map((comp) => (comp.id === componentId ? { ...comp, ...updates } : comp)),
            })),
          })),
        }))
      },
      deleteComponent: (componentId) => {
        set((state) => ({
          projects: state.projects.map((p) => ({
            ...p,
            cases: p.cases.map((c) => ({
              ...c,
              components: c.components.filter((comp) => comp.id !== componentId),
            })),
          })),
        }))
      },
      runGuidedTest: (caseId) => {
        const nodes: ComponentNode[] = [
          { id: crypto.randomUUID(), caseId, type: "product", name: "Sample Product", parentId: null },
        ]

        const machineId = crypto.randomUUID()
        nodes.push({
          id: machineId,
          caseId,
          type: "machine",
          name: "Manufacturing Line",
          parentId: nodes[0].id,
          description: "Primary manufacturing process for product manufacturing",
        })

        const subprocess1Id = crypto.randomUUID()
        nodes.push({
          id: subprocess1Id,
          caseId,
          type: "subprocess",
          name: "Material Preparation",
          parentId: machineId,
          description: "Material preparation operations",
        })

        const subprocess2Id = crypto.randomUUID()
        nodes.push({
          id: subprocess2Id,
          caseId,
          type: "subprocess",
          name: "Assembly Process",
          parentId: machineId,
          description: "Welding and finishing operations",
        })

        const operation1Id = crypto.randomUUID()
        nodes.push({
          id: operation1Id,
          caseId,
          type: "operation",
          name: "Material Cutting",
          parentId: subprocess1Id,
          description: "Material cutting process",
        })

        const operation2Id = crypto.randomUUID()
        nodes.push({
          id: operation2Id,
          caseId,
          type: "operation",
          name: "Welding Operation",
          parentId: subprocess2Id,
          description: "Assembly welding process",
        })

        const elemental1Id = crypto.randomUUID()
        nodes.push({
          id: elemental1Id,
          caseId,
          type: "elemental",
          name: "Electricity Consumption",
          parentId: operation1Id,
          description: "Power consumption for laser cutting",
          processType: "Energy",
          driverCategory: "Energy Consumption",
          drivers: ["Electricity (kWh)"],
          operationalCostUSD: 125.5,
          capitalCostUSD: 0,
        })

        // Create test flows for elemental nodes
        const testFlows: Flow[] = [
          {
            id: crypto.randomUUID(),
            nodeId: elemental1Id,
            direction: "input",
            substance: "Electricity",
            amount: 15.5,
            unit: "kWh",
          },
          {
            id: crypto.randomUUID(),
            nodeId: elemental1Id,
            direction: "output",
            substance: "CO2",
            amount: 7.2,
            unit: "kg",
          },
        ]

        set((state) => ({
          projects: state.projects.map((p) => ({
            ...p,
            cases: p.cases.map((c) => (c.id === caseId ? { ...c, components: nodes, updatedAt: new Date() } : c)),
          })),
          flows: [...state.flows.filter((f) => !nodes.some((n) => n.id === f.nodeId)), ...testFlows],
        }))
      },
    }),
    {
      name: "lcapix-projects",
    },
  ),
)

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "light",
      reducedMotion: false,
      setTheme: (theme) => set({ theme }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
    }),
    {
      name: "lcapix-theme",
    },
  ),
)

export interface Node {
  id: string
  caseId: string
  name: string
  type?: "product" | "machine" | "subprocess" | "operation" | "elemental"
  parentId: string | null
  children?: string[]
  description?: string
}
