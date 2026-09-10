/**
 * Data Transformers - Convert between database and frontend formats
 *
 * Database uses: INTEGER IDs, snake_case, separate tables
 * Frontend uses: STRING IDs, camelCase, nested objects
 */

import type { Project, Case, ComponentNode } from './store';

/**
 * Transform database project to frontend format
 */
export function transformProjectFromDB(dbProject: any): Project {
  return {
    id: String(dbProject.project_id),
    name: dbProject.project_name,
    description: dbProject.description || '',
    ownerId: String(dbProject.owner_id),
    createdAt: new Date(dbProject.created_at),
    updatedAt: new Date(dbProject.updated_at),
    cases: [], // Cases loaded separately when needed
    caseCount: dbProject.case_count ? Number(dbProject.case_count) : undefined, // Store count separately
  };
}

/**
 * Transform database case to frontend format
 */
export function transformCaseFromDB(dbCase: any): Case {
  return {
    id: String(dbCase.case_id),
    projectId: String(dbCase.project_id),
    type: dbCase.case_type as 'base' | 'comparative',
    name: dbCase.case_name,
    // Prefer `description` (the column PUT /api/cases writes to); fall back
    // to the legacy `case_description` column only if `description` is blank.
    description: dbCase.description || dbCase.case_description || '',
    createdAt: new Date(dbCase.created_at),
    updatedAt: new Date(dbCase.updated_at),
    components: [], // Components loaded separately
    componentCount: dbCase.component_count != null ? Number(dbCase.component_count) : undefined,
    driverCount: dbCase.driver_count != null ? Number(dbCase.driver_count) : undefined,
  } as Case;
}

/**
 * Transform database component to frontend format
 */
export function transformComponentFromDB(dbComponent: any): ComponentNode {
  return {
    id: String(dbComponent.component_id),
    caseId: String(dbComponent.case_id),
    parentId: dbComponent.parent_component_id ? String(dbComponent.parent_component_id) : null,
    type: dbComponent.component_type as ComponentNode['type'],
    name: dbComponent.component_name,
    description: dbComponent.description || undefined,  // Actual column name is 'description'
    processType: dbComponent.process_type || dbComponent.component_type || undefined,
    driverCategory: dbComponent.driver_category || undefined,
    selectedDriver: dbComponent.driver_type || undefined,
    drivers: dbComponent.drivers ? (typeof dbComponent.drivers === 'string' ? JSON.parse(dbComponent.drivers) : dbComponent.drivers) : undefined,
    mass: dbComponent.quantity ? parseFloat(dbComponent.quantity) : undefined,
    massUnit: dbComponent.unit || undefined,
    // Real attached-flow count from the API (for canvas card "N flows").
    flowCount:
      typeof dbComponent.flow_count === 'number'
        ? dbComponent.flow_count
        : dbComponent.flow_count != null
          ? Number(dbComponent.flow_count)
          : undefined,
    operationalCostUSD: dbComponent.opex ? parseFloat(dbComponent.opex) : undefined,
    capitalCostUSD: dbComponent.capex ? parseFloat(dbComponent.capex) : undefined,

    // ABC Costing - Detailed cost breakdown
    laborCost: dbComponent.labor_cost ? parseFloat(dbComponent.labor_cost) : undefined,
    energyCost: dbComponent.energy_cost ? parseFloat(dbComponent.energy_cost) : undefined,
    transportationCost: dbComponent.transportation_cost ? parseFloat(dbComponent.transportation_cost) : undefined,
    materialCost: dbComponent.material_cost ? parseFloat(dbComponent.material_cost) : undefined,
    equipmentCost: dbComponent.equipment_cost ? parseFloat(dbComponent.equipment_cost) : undefined,
    overheadCost: dbComponent.overhead_cost ? parseFloat(dbComponent.overhead_cost) : undefined,
    currency: dbComponent.currency || 'USD',
    costAllocationType: dbComponent.cost_allocation_type || undefined,
  };
}

/**
 * Transform frontend project data for database insert/update
 */
export function transformProjectToDB(project: Partial<Project>) {
  return {
    project_name: project.name,
    description: project.description || null,
    owner_id: project.ownerId ? parseInt(project.ownerId) : undefined,
  };
}

/**
 * Transform frontend case data for database insert/update
 */
export function transformCaseToDB(caseData: Partial<Case>) {
  return {
    project_id: caseData.projectId ? parseInt(caseData.projectId) : undefined,
    case_name: caseData.name,
    case_description: caseData.description || null,
    case_type: caseData.type,
    parent_case_id: null, // Add support if needed
  };
}

/**
 * Transform frontend component data for database insert/update
 */
export function transformComponentToDB(component: Partial<ComponentNode>) {
  return {
    case_id: component.caseId ? parseInt(component.caseId) : undefined,
    parent_component_id: component.parentId ? parseInt(component.parentId) : null,
    component_name: component.name,
    component_type: component.type,
    description: component.description || null,
    quantity: component.mass || 1.0,
    unit: component.massUnit || 'unit',
    process_type: component.processType || null,
    driver_category: component.driverCategory || null,
    driver_type: component.selectedDriver || null,
    drivers: component.drivers ? JSON.stringify(component.drivers) : null,
    opex: component.operationalCostUSD || null,
    capex: component.capitalCostUSD || null,

    // ABC Costing - Detailed cost breakdown
    labor_cost: component.laborCost || null,
    energy_cost: component.energyCost || null,
    transportation_cost: component.transportationCost || null,
    material_cost: component.materialCost || null,
    equipment_cost: component.equipmentCost || null,
    overhead_cost: component.overheadCost || null,
    currency: component.currency || 'USD',
    cost_allocation_type: component.costAllocationType || 'manual',
  };
}
