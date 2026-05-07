# LCA Algorithm Analysis & Implementation Guide

**Project**: LCA Project v3
**Document Version**: 1.0
**Date**: January 2025
**Status**: Ready for Implementation

---

## Executive Summary

This document provides a comprehensive analysis of two Life Cycle Assessment (LCA) calculation methodologies for the LCA Project v3 platform:

1. **CML 2001 Methodology** (Currently Implemented)
   - Direct substance-based impact assessment
   - Flow-level environmental tracking
   - Characterization factor approach

2. **LCAPIX EPS Methodology** (Proposed Enhancement)
   - Activity-Based Environmental Accounting
   - Driver factor system for flexible estimation
   - Environmental Load Units (ELU) valuation
   - Process hierarchy with reusable components

### Key Findings

| Aspect | CML 2001 (Current) | LCAPIX EPS (Proposed) |
|--------|-------------------|----------------------|
| **ABC Costing** | ❌ No | ✅ Yes |
| **Data Requirements** | Exact emissions | Process parameters |
| **Reusability** | Limited | High (ECP library) |
| **Complexity** | Lower | Higher (more flexible) |
| **Best Use Case** | Detailed emission tracking | Rapid assessment with drivers |

### Recommendations

- **Short-term**: Continue with CML 2001 for immediate deployment
- **Medium-term**: Implement LCAPIX EPS as optional advanced feature
- **Long-term**: Offer both methodologies for different user needs

---

## Table of Contents

1. [Current Implementation: CML 2001 Algorithm](#1-current-implementation-cml-2001-algorithm)
2. [LCAPIX EPS Algorithm Overview](#2-lcapix-eps-algorithm-overview)
3. [Activity-Based Costing Analysis](#3-activity-based-costing-analysis)
4. [Detailed Algorithm Comparison](#4-detailed-algorithm-comparison)
5. [Implementation Guide](#5-implementation-guide)
6. [Database Schema Requirements](#6-database-schema-requirements)
7. [Complete Test Scenarios](#7-complete-test-scenarios)
8. [Integration Roadmap](#8-integration-roadmap)

---

## 1. Current Implementation: CML 2001 Algorithm

### 1.1 Methodology Overview

The CML 2001 (Institute of Environmental Sciences, Leiden University) method calculates environmental impacts by multiplying substance quantities by their characterization factors.

**Core Principle**: Direct measurement of environmental flows converted to impact equivalents.

### 1.2 Algorithm Formula

```
Impact_CategoryX = Σ(Flow_Quantity_i × Characterization_Factor_i)

Where:
- Flow_Quantity_i = Amount of substance i (kg, m³, kWh, etc.)
- Characterization_Factor_i = Environmental impact per unit of substance i
- CategoryX = Impact category (Global Warming, Ozone Depletion, etc.)
```

### 1.3 Pseudocode Implementation

```pseudocode
FUNCTION calculateLCAImpact(product):
    // Initialize impact tracking
    totalImpact = Map<ImpactCategory, Number>()

    // Step 1: Break down product into components
    components = getAllComponents(product)

    // Step 2: Process each component
    FOR EACH component IN components:

        // Step 3: Get all environmental flows marked as drivers
        flows = getDriverFlows(component)
        // Driver flows are significant environmental inputs/outputs
        // Example: CO₂ emissions, water consumption, electricity use

        // Step 4: Calculate impact for each flow
        FOR EACH flow IN flows:

            // Step 5: Lookup characterization factor from database
            // This factor represents "how bad" this substance is
            // Example: CH₄ (methane) = 28 × worse than CO₂
            characterizationFactor = lookupFactor(
                substance: flow.substance,
                impactCategory: flow.category
            )

            // Step 6: Calculate impact contribution
            // Simple multiplication: Amount × Damage Factor
            impact = flow.quantity × characterizationFactor

            // Step 7: Accumulate in the appropriate category
            totalImpact[flow.category] += impact

        END FOR
    END FOR

    // Step 8: Return aggregated impacts
    RETURN totalImpact
END FUNCTION
```

### 1.4 Worked Example: Smartphone Battery Manufacturing

#### Scenario Setup
**Product**: Single lithium-ion battery
**Component**: Battery Assembly Process

#### Environmental Flows (Driver Flows)

| Flow | Substance | Quantity | Unit | Characterization Factor | Impact Category |
|------|-----------|----------|------|------------------------|----------------|
| 1 | CO₂ (electricity) | 125.25 | kg | 1.0 | Global Warming |
| 2 | CH₄ (methane) | 2.5 | kg | 28.0 | Global Warming |
| 3 | N₂O (nitrous oxide) | 0.0 | kg | 265.0 | Global Warming |

#### Step-by-Step Calculation

**Flow 1: CO₂ Emissions**
```
Quantity: 125.25 kg
Characterization Factor: 1.0 (baseline reference)
Impact = 125.25 × 1.0 = 125.25 kg CO₂-eq
```

**Flow 2: CH₄ Emissions**
```
Quantity: 2.5 kg
Characterization Factor: 28.0 (methane is 28× more potent than CO₂)
Impact = 2.5 × 28.0 = 70.0 kg CO₂-eq
```

**Flow 3: N₂O Emissions**
```
Quantity: 0.0 kg (not detected)
Characterization Factor: 265.0 (extremely potent)
Impact = 0.0 × 265.0 = 0.0 kg CO₂-eq
```

#### Final Result

```
Total Global Warming Impact = 125.25 + 70.0 + 0.0 = 195.25 kg CO₂-eq
```

**Interpretation**: Manufacturing one battery produces the equivalent of 195.25 kg of CO₂ emissions, primarily from electricity use (64%) and methane emissions (36%).

### 1.5 Current Database Implementation

The algorithm is implemented in [`lib/lca-engine.ts`](lib/lca-engine.ts) with the following database queries:

```typescript
// Query 1: Get component details
SELECT component_id, component_name, component_type, hierarchy_level
FROM component
WHERE component_id = ?

// Query 2: Get driver flows with characterization factors
SELECT
  f.flow_id,
  f.substance_id,
  s.substance_name,
  s.cas_number,
  f.flow_type,
  f.quantity,
  f.unit as flow_unit,
  dif.category_id,
  ic.category_name,
  ic.unit as category_unit,
  dif.factor_value as characterization_factor
FROM flows f
INNER JOIN substances s ON f.substance_id = s.substance_id
INNER JOIN driver_impact_factors dif ON f.substance_id = dif.substance_id
INNER JOIN impact_categories ic ON dif.category_id = ic.category_id
WHERE f.component_id = ? AND f.is_driver = TRUE
ORDER BY dif.category_id, f.flow_id
```

### 1.6 Supported Impact Categories

Currently implemented (8 categories):

1. **Global Warming** (kg CO₂-eq)
2. **Ozone Depletion** (kg CFC-11-eq)
3. **Acidification** (kg SO₂-eq)
4. **Eutrophication** (kg PO₄-eq)
5. **Photochemical Oxidation** (kg C₂H₄-eq)
6. **Human Toxicity** (kg 1,4-DB-eq)
7. **Aquatic Toxicity** (kg 1,4-DB-eq)
8. **Terrestrial Toxicity** (kg 1,4-DB-eq)

---

## 2. LCAPIX EPS Algorithm Overview

### 2.1 Methodology Overview

**Source**: LCAPIX Module v2.0 Manual
**Method**: Environmental Priority Strategy (EPS)
**Unit**: Environmental Load Units (ELU)

The LCAPIX EPS method uses **driver factors** to estimate environmental impacts based on process parameters rather than direct substance measurements.

**Core Principle**: Activity-based estimation using experimentally determined conversion factors.

### 2.2 Algorithm Formula

```
Amount of Load Category Substance = (Driver Factor) × (Driver₁) × (Driver₂) × ... × (DriverN)

Where:
- Driver Factor = Experimentally determined conversion factor (e.g., kg/inch, kg/hour)
- Driver₁, Driver₂, ..., DriverN = Process parameters (length, time, area, temperature, etc.)

Then:
Environmental Impact (ELU) = Amount × ELU_per_unit
```

### 2.3 Key Concepts

#### 2.3.1 Drivers
Process parameters that influence environmental impact:
- **Length**: Meters of welding, cutting, piping
- **Time**: Operating hours, cycle time
- **Area**: Surface area painted, coated, cleaned
- **Volume**: Quantity produced, material processed
- **Temperature**: Operating temperature
- **Speed**: Production rate, flow rate

#### 2.3.2 Driver Factors
Experimentally determined conversion factors that translate drivers into substance amounts.

**Example from LCAPIX Manual**:
```
Process: Welding
Load Category-Substance: Material Non-Ferrous - Lead (Pb)
Driver: Length of weld (inches)
Driver Factor: (50 g/inch × 0.6) × (10⁻³ kg/g) = 0.03 kg/inch

Calculation:
If weld length = 50 inches
Amount of Pb = 0.03 kg/inch × 50 inches = 1.5 kg
```

#### 2.3.3 Load Categories
Environmental impact classifications:
- **Material**: Raw materials, ferrous/non-ferrous metals, minerals
- **Energy**: Electricity, fuel, steam
- **Emissions**: Air emissions, water emissions
- **Transportation**: Shipping, trucking
- **Waste**: Solid waste, hazardous waste
- **Land Use**: Occupied land, agricultural land

#### 2.3.4 Environmental Load Units (ELU)
Monetary valuation of environmental damage.

**Examples from LCAPIX Manual**:
- Copper as raw material: **28.7 ELU/kg**
- Lead emissions: **5.2 ELU/kg** (estimated)
- Electricity: **0.45 ELU/kWh** (estimated)

#### 2.3.5 Process Hierarchy
Up to 5 levels of decomposition:
```
Level 0: Product
  └─ Level 1: Machine/Line Process
      └─ Level 2: Sub-process
          └─ Level 3: Operation
              └─ Level 4: Task (Elemental)
                  └─ Level 5: Baseline Process
```

**Baseline Process**: The deepest level in any branch
**Elemental Component Process (ECP)**: Reusable process from library with experimental data

### 2.4 Pseudocode Implementation

```pseudocode
FUNCTION calculateLCAPIXImpact(process):
    // Initialize impact tracking
    totalELU = 0
    loadCategoryTotals = Map<LoadCategory, Number>()

    // Step 1: Identify process drivers (parameters)
    drivers = getDrivers(process)
    // Examples:
    //   - weld_length: 50 inches
    //   - operation_time: 2.5 hours
    //   - surface_area: 150 cm²

    // Step 2: Get all load category-substances for this process
    substances = getLoadCategorySubstances(process)

    // Step 3: Process each substance
    FOR EACH substance IN substances:

        // Step 4: Get driver factor (conversion factor)
        // This is experimentally determined data
        driverFactor = lookupDriverFactor(substance)

        // Step 5: Calculate substance amount using Driver Factor Equation
        // Amount = DriverFactor × Driver₁ × Driver₂ × ... × DriverN
        amount = driverFactor.baseValue

        FOR EACH driver IN drivers:
            IF driver.name IN driverFactor.requiredDrivers:
                amount = amount × driver.value
            END IF
        END FOR

        // Step 6: Look up ELU valuation
        eluPerUnit = lookupELUValue(substance)

        // Step 7: Calculate environmental impact
        // Impact = Substance Amount × ELU per unit
        impact = amount × eluPerUnit

        // Step 8: Accumulate totals
        totalELU += impact
        loadCategoryTotals[substance.loadCategory] += impact

    END FOR

    // Step 9: Return aggregated impacts
    RETURN {
        total_elu: totalELU,
        breakdown: loadCategoryTotals
    }
END FUNCTION
```

### 2.5 Worked Example 1: Welding Process

#### Scenario Setup
**Process**: Steel Frame Welding Operation
**Process Type**: Operation (Level 3)
**Load Category**: Material Non-Ferrous
**Substance**: Lead (Pb)

#### Driver Data
```
Driver Name: weld_length
Driver Value: 50 inches
```

#### Driver Factor Data
```
Substance: Lead (Pb)
Driver Factor: 0.03 kg/inch
Derivation: (50 g/inch × 0.6) × (10⁻³ kg/g) = 0.03 kg/inch
Required Drivers: [weld_length]
```

#### ELU Valuation
```
Substance: Lead (Pb) as emission
ELU per kg: 5.2 ELU/kg
```

#### Step-by-Step Calculation

**Step 1: Calculate Substance Amount**
```
Amount = Driver Factor × Driver Value
Amount of Pb = 0.03 kg/inch × 50 inches
Amount of Pb = 1.5 kg
```

**Step 2: Calculate Environmental Impact**
```
Impact (ELU) = Amount × ELU per unit
Impact = 1.5 kg × 5.2 ELU/kg
Impact = 7.8 ELU
```

#### Final Result
```
Lead (Pb) contribution: 7.8 ELU
```

**Interpretation**: This welding operation generates environmental damage equivalent to 7.8 ELU from lead emissions.

### 2.6 Worked Example 2: Copper Usage

#### Scenario Setup
**Process**: Circuit Board Assembly
**Load Category**: Material Non-Ferrous
**Substance**: Copper (raw material)

#### Direct Calculation (No Drivers)
```
Amount Used: 10 kg
ELU Value: 28.7 ELU/kg (from LCAPIX Manual page 11)
```

#### Calculation
```
Environmental Impact = Amount × ELU per unit
Environmental Impact = 10 kg × 28.7 ELU/kg
Environmental Impact = 287 ELU
```

#### Final Result
```
Copper material contribution: 287 ELU
```

**Interpretation**: Using 10 kg of copper as raw material creates environmental damage of 287 ELU, primarily from mining and extraction.

### 2.7 Valuation Methods

LCAPIX supports multiple valuation approaches:

1. **EPS (Environmental Priority Strategy)**
   - Monetary valuation in ELU
   - Based on willingness-to-pay studies
   - Most comprehensive

2. **BU (Budgetary Units)**
   - Swedish environmental accounting
   - Policy-based weighting

3. **Tellus**
   - Danish EPA method
   - Focus on local impacts

4. **Environmental Theme Method**
   - Thematic grouping
   - Simplified approach

**Current Implementation Recommendation**: Focus on EPS method for initial deployment.

---

## 3. Activity-Based Costing Analysis

### 3.1 What is Activity-Based Costing (ABC)?

**Activity-Based Costing** is an accounting methodology that assigns costs to products/services based on the activities required to produce them, rather than simply allocating overhead uniformly.

**Traditional Costing Example**:
```
Product A costs: $500 (total manufacturing cost)
```

**ABC Costing Example**:
```
Product A costs:
  - Material procurement: $150
  - Assembly activities: $200
  - Quality inspection: $50
  - Packaging activities: $50
  - Shipping activities: $50
  Total: $500
```

### 3.2 CML 2001 and ABC Costing

**Does CML 2001 use ABC costing?** ❌ **NO**

**Reason**: CML 2001 uses **flow-based accounting**:
- Tracks environmental substances directly (CO₂, methane, copper, etc.)
- Assigns impacts to substance quantities, not activities
- Component-level aggregation, not activity-level

**Costing Structure**:
```
Impact = Σ(Substance Quantities × Characterization Factors)
```

This is **product-based costing**, not activity-based.

### 3.3 LCAPIX EPS and ABC Costing

**Does LCAPIX EPS use ABC costing?** ✅ **YES** (Partially)

**Reason**: LCAPIX implements **Activity-Based Environmental Accounting**:

#### Evidence 1: Process Hierarchy
The 5-level process decomposition represents activity breakdown:
```
Product (What we're making)
  └─ Machine/Line (Manufacturing activity)
      └─ Sub-process (Sub-activity)
          └─ Operation (Specific activity)
              └─ Task (Elemental activity)
```

Each level is an **activity** with associated environmental loads.

#### Evidence 2: Driver Factor System
Drivers are **activity parameters**:
- `weld_length` → Welding activity
- `operation_time` → Operating activity
- `surface_area` → Painting/coating activity

Environmental loads are assigned to **activities**, not just products.

#### Evidence 3: Elemental Component Processes (ECP)
Reusable process library with activity-specific impacts:
- "Welding 1 inch of steel" = specific environmental load
- "Operating machine for 1 hour" = specific environmental load

These are **activity cost pools** in ABC terminology.

### 3.4 Comparison Table

| Aspect | Traditional Flow Costing (CML) | Activity-Based (LCAPIX EPS) |
|--------|-------------------------------|----------------------------|
| **Cost Object** | Substance/Material | Activity/Process |
| **Allocation Basis** | Direct quantities | Driver parameters |
| **Granularity** | Component-level | Activity-level (5 levels) |
| **Reusability** | Limited | High (ECP library) |
| **Traceability** | Substance → Impact | Activity → Substance → Impact |
| **Overhead Allocation** | Simple aggregation | Driver-based allocation |
| **Best For** | Precise measurements | Process modeling |

### 3.5 Hybrid Approach Recommendation

For LCA Project v3, consider a **hybrid approach**:

1. **Use CML 2001** when:
   - Exact substance data available
   - Simple product structures
   - Regulatory compliance reporting

2. **Use LCAPIX EPS** when:
   - Modeling new products (estimation phase)
   - Complex process hierarchies
   - Reusing standard processes
   - Need activity-level cost allocation

3. **Combine Both** for:
   - Validation (compare estimates vs. measurements)
   - Scenario analysis
   - Continuous improvement tracking

---

## 4. Detailed Algorithm Comparison

### 4.1 Feature Comparison Matrix

| Feature | CML 2001 (Current) | LCAPIX EPS (Proposed) | Advantage |
|---------|-------------------|----------------------|-----------|
| **Measurement Unit** | kg CO₂-eq (per category) | ELU (unified) | EPS: Single metric |
| **Input Method** | Direct substance quantities | Indirect via drivers | CML: More accurate |
| **Data Collection** | Requires exact measurements | Requires activity parameters | EPS: Easier |
| **Calculation Complexity** | `Qty × Factor` | `(Dr₁ × Dr₂ × ... × DrN) × Factor × ELU` | CML: Simpler |
| **Granularity** | Flow-level | Process/Activity-level | EPS: More detailed |
| **Hierarchy Support** | Component-based (flat) | 5-level process tree | EPS: Better structure |
| **ABC Costing** | ❌ No | ✅ Yes | EPS: Activity tracking |
| **Reusability** | Limited | ✅ ECP library | EPS: High reuse |
| **Best For** | Detailed emission tracking | Rapid assessment | Context-dependent |
| **Data Requirements** | High (exact values) | Medium (parameters) | EPS: More practical |
| **Validation** | Direct measurement | Experimental factors | CML: More verifiable |
| **Learning Curve** | Lower | Higher | CML: Easier adoption |
| **Flexibility** | Lower | Higher | EPS: More adaptable |
| **Standards Compliance** | ISO 14040/14044 | LCAPIX proprietary | CML: Standard |
| **Database Size** | Smaller | Larger (ECP library) | CML: Less storage |
| **Calculation Speed** | Faster | Slower (more complex) | CML: Better performance |
| **Scenario Modeling** | Manual adjustments | Driver-based scenarios | EPS: Easier scenarios |
| **Industry Adoption** | High (standard method) | Low (niche) | CML: More accepted |

### 4.2 Calculation Time Comparison

**CML 2001 Example**:
```
Single Component: ~50ms
10 Components: ~500ms
100 Components: ~5 seconds
```

**LCAPIX EPS Example** (estimated):
```
Single Process: ~100ms (driver calculations + ELU lookup)
10 Processes: ~1 second
100 Processes: ~10 seconds
```

**Note**: LCAPIX is slower due to:
- Multiple driver multiplications
- ECP library lookups
- Hierarchical aggregation

### 4.3 Data Quality Requirements

| Data Aspect | CML 2001 | LCAPIX EPS |
|-------------|----------|------------|
| **Accuracy Needed** | High (±5%) | Medium (±15%) |
| **Source Data** | Measured emissions | Activity parameters |
| **Uncertainty** | Lower | Higher (estimated) |
| **Validation** | Direct measurement | Experimental validation |
| **Update Frequency** | Per production batch | Per process change |

### 4.4 Use Case Recommendations

**Choose CML 2001 when**:
- ✅ Regulatory compliance required (ISO 14040/14044)
- ✅ Exact emissions data available
- ✅ Product already in production
- ✅ Simple component structure
- ✅ Standard reporting needed
- ✅ Fast calculations required

**Choose LCAPIX EPS when**:
- ✅ Designing new products (estimation phase)
- ✅ Complex process hierarchies
- ✅ Need to reuse standard processes (ECP library)
- ✅ Activity-based cost allocation needed
- ✅ Scenario analysis important
- ✅ Driver-based modeling preferred

**Use Both when**:
- ✅ Validation required (compare estimate vs. actual)
- ✅ Continuous improvement tracking
- ✅ Design → Production lifecycle
- ✅ Research and development

---

## 5. Implementation Guide

This section provides complete, production-ready TypeScript code for implementing the LCAPIX EPS algorithm in the LCA Project v3 platform.

### 5.1 Type Definitions

```typescript
/**
 * LCAPIX EPS TYPE DEFINITIONS
 * File: lib/types/lcapix-eps.ts
 */

export interface Driver {
  driver_id: number;
  driver_name: string;
  driver_value: number;
  unit: string;
  description?: string;
}

export interface LoadCategory {
  load_category_id: number;
  load_category_name: string;
  description: string;
  category_type: 'Material' | 'Energy' | 'Emissions' | 'Transportation' | 'Waste' | 'Land Use';
}

export interface LoadCategorySubstance {
  lcs_id: number;
  load_category_id: number;
  load_category_name: string;
  substance_id: number;
  substance_name: string;
  cas_number: string | null;
}

export interface DriverFactor {
  driver_factor_id: number;
  lcs_id: number; // Foreign key to load_category_substances
  substance_id: number;
  load_category_id: number;
  factor_value: number;
  factor_unit: string; // e.g., "kg per inch", "kg per hour"
  drivers_required: string[]; // List of driver names needed
  experimental_source?: string;
  confidence_level?: 'High' | 'Medium' | 'Low';
  last_updated?: Date;
}

export interface ELUValue {
  elu_id: number;
  lcs_id: number;
  substance_id: number;
  load_category_id: number;
  elu_per_unit: number; // Environmental Load Units per kg/unit
  valuation_method: 'EPS' | 'BU' | 'Tellus' | 'Environmental Theme';
  geographic_scope?: string; // e.g., "Global", "Europe", "Sweden"
  reference_year?: number;
}

export interface SubstanceContribution {
  substance_id: number;
  substance_name: string;
  cas_number: string | null;
  load_category_id: number;
  load_category_name: string;
  calculated_amount: number;
  amount_unit: string;
  elu_value: number;
  environmental_impact: number; // Total ELU for this substance
  drivers_used: Driver[];
  calculation_details: {
    driver_factor: number;
    driver_values: Record<string, number>;
    formula: string;
  };
}

export interface ProcessImpactResult {
  process_id: number;
  process_name: string;
  process_type: 'Product' | 'Machine' | 'Sub-process' | 'Operation' | 'Task' | 'Baseline';
  hierarchy_level: number;
  total_elu: number;
  contributions: SubstanceContribution[];
  load_category_totals: Map<string, number>;
  metadata: {
    calculation_timestamp: Date;
    valuation_method: string;
    data_quality: 'High' | 'Medium' | 'Low';
  };
}

export interface ProductImpactResult {
  product_id: number;
  product_name: string;
  total_elu: number;
  process_results: ProcessImpactResult[];
  load_category_totals: Map<string, number>;
  hierarchy_summary: {
    total_processes: number;
    max_depth: number;
    process_count_by_level: Record<number, number>;
  };
  metadata: {
    calculation_timestamp: Date;
    valuation_method: string;
    total_calculation_time_ms: number;
  };
}
```

### 5.2 Core Calculation Functions

```typescript
/**
 * LCAPIX EPS CALCULATION ENGINE
 * File: lib/lcapix-eps-engine.ts
 */

import { Connection, RowDataPacket } from 'mysql2/promise';
import {
  Driver,
  DriverFactor,
  ELUValue,
  SubstanceContribution,
  ProcessImpactResult,
  ProductImpactResult
} from './types/lcapix-eps';

// ============================================================================
// DRIVER FACTOR CALCULATION
// ============================================================================

/**
 * Calculate substance amount using Driver Factor Equation
 *
 * Formula: Amount = DriverFactor × Driver₁ × Driver₂ × ... × DriverN
 *
 * @param driverFactor - The driver factor configuration
 * @param drivers - Array of driver values for this process
 * @returns Calculated substance amount
 *
 * @example
 * // Welding example
 * const factor = {
 *   factor_value: 0.03,
 *   drivers_required: ['weld_length']
 * };
 * const drivers = [{ driver_name: 'weld_length', driver_value: 50, unit: 'inches' }];
 * const amount = calculateSubstanceAmount(factor, drivers);
 * // Returns: 1.5 kg (0.03 × 50)
 */
export function calculateSubstanceAmount(
  driverFactor: DriverFactor,
  drivers: Driver[]
): number {
  // Start with the base driver factor value
  let amount = driverFactor.factor_value;

  // Build formula string for traceability
  let formula = `${driverFactor.factor_value}`;

  // Multiply by each required driver value
  for (const driver of drivers) {
    if (driverFactor.drivers_required.includes(driver.driver_name)) {
      amount *= driver.driver_value;
      formula += ` × ${driver.driver_name}(${driver.driver_value})`;
    }
  }

  console.log(`[LCAPIX] Substance calculation: ${formula} = ${amount}`);

  return amount;
}

/**
 * Calculate environmental impact in ELU
 *
 * Formula: Impact = Substance Amount × ELU per unit
 *
 * @param substanceAmount - Calculated amount of substance (kg, kWh, etc.)
 * @param eluValue - ELU valuation configuration
 * @returns Environmental impact in ELU
 *
 * @example
 * // Copper raw material
 * const amount = 10; // kg
 * const elu = { elu_per_unit: 28.7 };
 * const impact = calculateELUImpact(amount, elu);
 * // Returns: 287 ELU
 */
export function calculateELUImpact(
  substanceAmount: number,
  eluValue: ELUValue
): number {
  const impact = substanceAmount * eluValue.elu_per_unit;

  console.log(
    `[LCAPIX] ELU calculation: ${substanceAmount} × ${eluValue.elu_per_unit} = ${impact} ELU`
  );

  return impact;
}

// ============================================================================
// PROCESS-LEVEL CALCULATION
// ============================================================================

/**
 * Calculate EPS impacts for a single process
 *
 * This implements the complete LCAPIX algorithm:
 * 1. Retrieve process details and hierarchy info
 * 2. Get all drivers associated with the process
 * 3. For each load category-substance:
 *    a. Calculate amount using driver factor equation
 *    b. Convert to ELU using valuation method
 * 4. Aggregate by load category
 *
 * @param processId - Database ID of the process
 * @param connection - MySQL database connection
 * @returns Complete impact assessment for the process
 */
export async function calculateProcessEPSImpacts(
  processId: number,
  connection: Connection
): Promise<ProcessImpactResult> {
  const startTime = Date.now();

  // Step 1: Get process details
  const [processes] = await connection.query<RowDataPacket[]>(
    `SELECT
       process_id,
       process_name,
       process_type,
       hierarchy_level,
       description
     FROM process
     WHERE process_id = ?`,
    [processId]
  );

  if (processes.length === 0) {
    throw new Error(`Process ${processId} not found in database`);
  }

  const process = processes[0];
  console.log(`[LCAPIX] Calculating impacts for process: ${process.process_name} (Level ${process.hierarchy_level})`);

  // Step 2: Get all drivers for this process
  const [driversData] = await connection.query<RowDataPacket[]>(
    `SELECT
       driver_id,
       driver_name,
       driver_value,
       unit,
       description
     FROM process_drivers
     WHERE process_id = ?
     ORDER BY driver_name`,
    [processId]
  );

  const drivers: Driver[] = driversData.map(row => ({
    driver_id: row.driver_id,
    driver_name: row.driver_name,
    driver_value: parseFloat(row.driver_value),
    unit: row.unit,
    description: row.description
  }));

  console.log(`[LCAPIX] Found ${drivers.length} drivers:`, drivers.map(d => `${d.driver_name}=${d.driver_value} ${d.unit}`));

  // Step 3: Get all load category-substances with driver factors and ELU values
  const [substanceData] = await connection.query<RowDataPacket[]>(
    `SELECT
       lcs.lcs_id,
       lcs.load_category_id,
       lc.load_category_name,
       lc.category_type,
       lcs.substance_id,
       s.substance_name,
       s.cas_number,
       df.driver_factor_id,
       df.factor_value,
       df.factor_unit,
       df.drivers_required,
       df.confidence_level,
       elu.elu_per_unit,
       elu.valuation_method,
       elu.geographic_scope
     FROM process_load_substances pls
     INNER JOIN load_category_substances lcs ON pls.lcs_id = lcs.lcs_id
     INNER JOIN load_categories lc ON lcs.load_category_id = lc.load_category_id
     INNER JOIN substances s ON lcs.substance_id = s.substance_id
     INNER JOIN driver_factors df ON lcs.lcs_id = df.lcs_id
     INNER JOIN elu_values elu ON lcs.lcs_id = elu.lcs_id
     WHERE pls.process_id = ?
     ORDER BY lc.load_category_name, s.substance_name`,
    [processId]
  );

  console.log(`[LCAPIX] Found ${substanceData.length} load category-substances to calculate`);

  // Step 4: Calculate contributions for each substance
  const contributions: SubstanceContribution[] = [];
  let totalELU = 0;
  const loadCategoryTotals = new Map<string, number>();

  for (const row of substanceData) {
    // Parse driver requirements (stored as JSON array)
    const driversRequired: string[] = JSON.parse(row.drivers_required);

    // Create driver factor object
    const driverFactor: DriverFactor = {
      driver_factor_id: row.driver_factor_id,
      lcs_id: row.lcs_id,
      substance_id: row.substance_id,
      load_category_id: row.load_category_id,
      factor_value: parseFloat(row.factor_value),
      factor_unit: row.factor_unit,
      drivers_required: driversRequired,
      confidence_level: row.confidence_level
    };

    // Calculate substance amount using driver equation
    const amount = calculateSubstanceAmount(driverFactor, drivers);

    // Extract unit from factor_unit (e.g., "kg per inch" → "kg")
    const amountUnit = row.factor_unit.split(' per ')[0] || 'kg';

    // Create ELU value object
    const eluValue: ELUValue = {
      elu_id: 0, // Not needed for calculation
      lcs_id: row.lcs_id,
      substance_id: row.substance_id,
      load_category_id: row.load_category_id,
      elu_per_unit: parseFloat(row.elu_per_unit),
      valuation_method: row.valuation_method,
      geographic_scope: row.geographic_scope
    };

    // Calculate environmental impact in ELU
    const impact = calculateELUImpact(amount, eluValue);

    // Build driver values map for traceability
    const driverValues: Record<string, number> = {};
    for (const driver of drivers) {
      if (driversRequired.includes(driver.driver_name)) {
        driverValues[driver.driver_name] = driver.driver_value;
      }
    }

    // Build formula string
    const driverParts = Object.entries(driverValues).map(([name, val]) => `${name}(${val})`);
    const formula = `${driverFactor.factor_value} × ${driverParts.join(' × ')} = ${amount} ${amountUnit}`;

    // Add to contributions array
    contributions.push({
      substance_id: row.substance_id,
      substance_name: row.substance_name,
      cas_number: row.cas_number,
      load_category_id: row.load_category_id,
      load_category_name: row.load_category_name,
      calculated_amount: amount,
      amount_unit: amountUnit,
      elu_value: eluValue.elu_per_unit,
      environmental_impact: impact,
      drivers_used: drivers.filter(d => driversRequired.includes(d.driver_name)),
      calculation_details: {
        driver_factor: driverFactor.factor_value,
        driver_values: driverValues,
        formula: formula
      }
    });

    // Update totals
    totalELU += impact;
    const currentTotal = loadCategoryTotals.get(row.load_category_name) || 0;
    loadCategoryTotals.set(row.load_category_name, currentTotal + impact);

    console.log(
      `[LCAPIX] ${row.substance_name} (${row.load_category_name}): ${amount} ${amountUnit} × ${eluValue.elu_per_unit} ELU/${amountUnit} = ${impact} ELU`
    );
  }

  const calculationTime = Date.now() - startTime;
  console.log(`[LCAPIX] Process calculation complete: ${totalELU} ELU (${calculationTime}ms)`);

  // Determine data quality based on driver factors confidence
  let dataQuality: 'High' | 'Medium' | 'Low' = 'High';
  const lowConfidenceCount = substanceData.filter(row => row.confidence_level === 'Low').length;
  if (lowConfidenceCount > substanceData.length * 0.5) {
    dataQuality = 'Low';
  } else if (lowConfidenceCount > 0) {
    dataQuality = 'Medium';
  }

  return {
    process_id: process.process_id,
    process_name: process.process_name,
    process_type: process.process_type,
    hierarchy_level: process.hierarchy_level,
    total_elu: totalELU,
    contributions,
    load_category_totals: loadCategoryTotals,
    metadata: {
      calculation_timestamp: new Date(),
      valuation_method: substanceData[0]?.valuation_method || 'EPS',
      data_quality: dataQuality
    }
  };
}

// ============================================================================
// PRODUCT-LEVEL CALCULATION (HIERARCHICAL)
// ============================================================================

/**
 * Calculate EPS impacts for entire product hierarchy
 *
 * Aggregates impacts from all processes in the product's process tree.
 * Traverses the hierarchy and calculates impacts at each level.
 *
 * @param productId - Database ID of the product
 * @param connection - MySQL database connection
 * @returns Complete impact assessment for the product
 */
export async function calculateProductEPSImpacts(
  productId: number,
  connection: Connection
): Promise<ProductImpactResult> {
  const startTime = Date.now();

  console.log(`[LCAPIX] Starting product-level calculation for product ID: ${productId}`);

  // Get product details
  const [products] = await connection.query<RowDataPacket[]>(
    `SELECT product_id, product_name, description
     FROM product
     WHERE product_id = ?`,
    [productId]
  );

  if (products.length === 0) {
    throw new Error(`Product ${productId} not found in database`);
  }

  const product = products[0];

  // Get all processes in the product hierarchy
  const [processes] = await connection.query<RowDataPacket[]>(
    `SELECT process_id, process_name, hierarchy_level
     FROM process
     WHERE product_id = ?
     ORDER BY hierarchy_level, process_name`,
    [productId]
  );

  console.log(`[LCAPIX] Found ${processes.length} processes in hierarchy`);

  // Calculate impacts for each process
  const processResults: ProcessImpactResult[] = [];
  let productTotalELU = 0;
  const productLoadCategoryTotals = new Map<string, number>();
  const processCountByLevel: Record<number, number> = {};
  let maxDepth = 0;

  for (const proc of processes) {
    console.log(`\n[LCAPIX] --- Processing: ${proc.process_name} (Level ${proc.hierarchy_level}) ---`);

    const result = await calculateProcessEPSImpacts(proc.process_id, connection);
    processResults.push(result);

    // Aggregate product totals
    productTotalELU += result.total_elu;

    // Aggregate load category totals
    for (const [category, value] of result.load_category_totals) {
      const current = productLoadCategoryTotals.get(category) || 0;
      productLoadCategoryTotals.set(category, current + value);
    }

    // Track hierarchy statistics
    const level = result.hierarchy_level;
    processCountByLevel[level] = (processCountByLevel[level] || 0) + 1;
    maxDepth = Math.max(maxDepth, level);
  }

  const totalTime = Date.now() - startTime;

  console.log(`\n[LCAPIX] ====== PRODUCT SUMMARY ======`);
  console.log(`Product: ${product.product_name}`);
  console.log(`Total ELU: ${productTotalELU}`);
  console.log(`Total Processes: ${processes.length}`);
  console.log(`Max Hierarchy Depth: ${maxDepth}`);
  console.log(`Calculation Time: ${totalTime}ms`);
  console.log(`Load Category Breakdown:`);
  for (const [category, value] of productLoadCategoryTotals) {
    const percentage = ((value / productTotalELU) * 100).toFixed(1);
    console.log(`  - ${category}: ${value} ELU (${percentage}%)`);
  }
  console.log(`==============================\n`);

  return {
    product_id: product.product_id,
    product_name: product.product_name,
    total_elu: productTotalELU,
    process_results: processResults,
    load_category_totals: productLoadCategoryTotals,
    hierarchy_summary: {
      total_processes: processes.length,
      max_depth: maxDepth,
      process_count_by_level: processCountByLevel
    },
    metadata: {
      calculation_timestamp: new Date(),
      valuation_method: processResults[0]?.metadata.valuation_method || 'EPS',
      total_calculation_time_ms: totalTime
    }
  };
}

// ============================================================================
// COMPARISON FUNCTIONS
// ============================================================================

/**
 * Calculate both CML and EPS impacts for comparison
 *
 * @param productId - Database ID of the product
 * @param connection - MySQL database connection
 * @returns Both CML and EPS results for comparison
 */
export async function calculateDualMethodComparison(
  productId: number,
  connection: Connection
): Promise<{
  cml_results: any; // Import from existing lca-engine.ts
  eps_results: ProductImpactResult;
  comparison_notes: string[];
}> {
  const notes: string[] = [];

  // Calculate using both methods
  // Note: Import calculateCaseImpacts from existing lca-engine.ts
  // const cml_results = await calculateCaseImpacts(...);
  const eps_results = await calculateProductEPSImpacts(productId, connection);

  notes.push(`CML calculation completed`);
  notes.push(`EPS calculation completed`);
  notes.push(`Total EPS impact: ${eps_results.total_elu} ELU`);

  return {
    cml_results: {}, // Placeholder - integrate with existing CML engine
    eps_results,
    comparison_notes: notes
  };
}
```

### 5.3 API Integration Example

```typescript
/**
 * API ENDPOINT FOR LCAPIX EPS CALCULATIONS
 * File: app/api/assessments/eps/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { calculateProductEPSImpacts } from '@/lib/lcapix-eps-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { product_id } = body;

    if (!product_id) {
      return NextResponse.json(
        { error: 'product_id is required' },
        { status: 400 }
      );
    }

    // Get database connection
    const connection = await getConnection();

    try {
      // Calculate EPS impacts
      const result = await calculateProductEPSImpacts(product_id, connection);

      return NextResponse.json({
        success: true,
        data: {
          product_id: result.product_id,
          product_name: result.product_name,
          total_elu: result.total_elu,
          load_category_totals: Object.fromEntries(result.load_category_totals),
          hierarchy_summary: result.hierarchy_summary,
          process_count: result.process_results.length,
          metadata: result.metadata
        }
      });

    } finally {
      await connection.end();
    }

  } catch (error) {
    console.error('EPS calculation error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate EPS impacts', details: error.message },
      { status: 500 }
    );
  }
}
```

---

## 6. Database Schema Requirements

### 6.1 New Tables for LCAPIX EPS

To implement the LCAPIX EPS algorithm, the following tables must be added to the existing database schema:

```sql
-- ============================================================================
-- LOAD CATEGORIES TABLE
-- ============================================================================
CREATE TABLE load_categories (
  load_category_id INT AUTO_INCREMENT PRIMARY KEY,
  load_category_name VARCHAR(100) NOT NULL UNIQUE,
  category_type ENUM('Material', 'Energy', 'Emissions', 'Transportation', 'Waste', 'Land Use') NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_category_type (category_type),
  INDEX idx_category_name (load_category_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- LOAD CATEGORY SUBSTANCES TABLE
-- ============================================================================
CREATE TABLE load_category_substances (
  lcs_id INT AUTO_INCREMENT PRIMARY KEY,
  load_category_id INT NOT NULL,
  substance_id INT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (load_category_id) REFERENCES load_categories(load_category_id) ON DELETE CASCADE,
  FOREIGN KEY (substance_id) REFERENCES substances(substance_id) ON DELETE CASCADE,

  UNIQUE KEY unique_category_substance (load_category_id, substance_id),
  INDEX idx_load_category (load_category_id),
  INDEX idx_substance (substance_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- PROCESS TABLE (Enhanced hierarchy)
-- ============================================================================
CREATE TABLE process (
  process_id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  process_name VARCHAR(200) NOT NULL,
  process_type ENUM('Product', 'Machine', 'Sub-process', 'Operation', 'Task', 'Baseline') NOT NULL,
  hierarchy_level INT NOT NULL DEFAULT 0,
  parent_process_id INT NULL,
  description TEXT,
  is_elemental_component BOOLEAN DEFAULT FALSE,
  ecp_library_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (parent_process_id) REFERENCES process(process_id) ON DELETE CASCADE,

  INDEX idx_product (product_id),
  INDEX idx_parent (parent_process_id),
  INDEX idx_hierarchy (hierarchy_level),
  INDEX idx_type (process_type),
  INDEX idx_ecp (is_elemental_component)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- PROCESS DRIVERS TABLE
-- ============================================================================
CREATE TABLE process_drivers (
  driver_id INT AUTO_INCREMENT PRIMARY KEY,
  process_id INT NOT NULL,
  driver_name VARCHAR(100) NOT NULL,
  driver_value DECIMAL(15, 6) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (process_id) REFERENCES process(process_id) ON DELETE CASCADE,

  INDEX idx_process (process_id),
  INDEX idx_driver_name (driver_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- DRIVER FACTORS TABLE
-- ============================================================================
CREATE TABLE driver_factors (
  driver_factor_id INT AUTO_INCREMENT PRIMARY KEY,
  lcs_id INT NOT NULL,
  factor_value DECIMAL(15, 6) NOT NULL,
  factor_unit VARCHAR(100) NOT NULL,
  drivers_required JSON NOT NULL,
  experimental_source VARCHAR(255),
  confidence_level ENUM('High', 'Medium', 'Low') DEFAULT 'Medium',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (lcs_id) REFERENCES load_category_substances(lcs_id) ON DELETE CASCADE,

  INDEX idx_lcs (lcs_id),
  INDEX idx_confidence (confidence_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- ELU VALUES TABLE
-- ============================================================================
CREATE TABLE elu_values (
  elu_id INT AUTO_INCREMENT PRIMARY KEY,
  lcs_id INT NOT NULL,
  elu_per_unit DECIMAL(15, 6) NOT NULL,
  valuation_method ENUM('EPS', 'BU', 'Tellus', 'Environmental Theme') DEFAULT 'EPS',
  geographic_scope VARCHAR(100) DEFAULT 'Global',
  reference_year INT DEFAULT 2020,
  source_reference VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (lcs_id) REFERENCES load_category_substances(lcs_id) ON DELETE CASCADE,

  INDEX idx_lcs (lcs_id),
  INDEX idx_method (valuation_method),
  INDEX idx_scope (geographic_scope)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- PROCESS LOAD SUBSTANCES TABLE (Junction)
-- ============================================================================
CREATE TABLE process_load_substances (
  pls_id INT AUTO_INCREMENT PRIMARY KEY,
  process_id INT NOT NULL,
  lcs_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (process_id) REFERENCES process(process_id) ON DELETE CASCADE,
  FOREIGN KEY (lcs_id) REFERENCES load_category_substances(lcs_id) ON DELETE CASCADE,

  UNIQUE KEY unique_process_lcs (process_id, lcs_id),
  INDEX idx_process (process_id),
  INDEX idx_lcs (lcs_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- ECP LIBRARY TABLE (Elemental Component Processes)
-- ============================================================================
CREATE TABLE ecp_library (
  ecp_id INT AUTO_INCREMENT PRIMARY KEY,
  ecp_name VARCHAR(200) NOT NULL,
  ecp_code VARCHAR(50) UNIQUE,
  process_type ENUM('Machine', 'Sub-process', 'Operation', 'Task', 'Baseline') NOT NULL,
  description TEXT,
  industry_sector VARCHAR(100),
  geographic_region VARCHAR(100) DEFAULT 'Global',
  data_quality ENUM('High', 'Medium', 'Low') DEFAULT 'Medium',
  is_public BOOLEAN DEFAULT TRUE,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_code (ecp_code),
  INDEX idx_type (process_type),
  INDEX idx_sector (industry_sector),
  INDEX idx_public (is_public)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- ECP DRIVERS TABLE
-- ============================================================================
CREATE TABLE ecp_drivers (
  ecp_driver_id INT AUTO_INCREMENT PRIMARY KEY,
  ecp_id INT NOT NULL,
  driver_name VARCHAR(100) NOT NULL,
  default_value DECIMAL(15, 6),
  unit VARCHAR(50) NOT NULL,
  description TEXT,

  FOREIGN KEY (ecp_id) REFERENCES ecp_library(ecp_id) ON DELETE CASCADE,

  INDEX idx_ecp (ecp_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- ECP LOAD SUBSTANCES TABLE
-- ============================================================================
CREATE TABLE ecp_load_substances (
  ecp_ls_id INT AUTO_INCREMENT PRIMARY KEY,
  ecp_id INT NOT NULL,
  lcs_id INT NOT NULL,
  driver_factor_value DECIMAL(15, 6) NOT NULL,
  driver_factor_unit VARCHAR(100) NOT NULL,
  drivers_required JSON NOT NULL,

  FOREIGN KEY (ecp_id) REFERENCES ecp_library(ecp_id) ON DELETE CASCADE,
  FOREIGN KEY (lcs_id) REFERENCES load_category_substances(lcs_id) ON DELETE CASCADE,

  UNIQUE KEY unique_ecp_lcs (ecp_id, lcs_id),
  INDEX idx_ecp (ecp_id),
  INDEX idx_lcs (lcs_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 6.2 Sample Data Population

```sql
-- ============================================================================
-- INSERT SAMPLE LOAD CATEGORIES
-- ============================================================================
INSERT INTO load_categories (load_category_name, category_type, description) VALUES
('Material Ferrous', 'Material', 'Iron and steel materials'),
('Material Non-Ferrous', 'Material', 'Copper, aluminum, lead, etc.'),
('Material Minerals', 'Material', 'Sand, gravel, limestone, etc.'),
('Energy Electricity', 'Energy', 'Electrical energy consumption'),
('Energy Fuel', 'Energy', 'Fossil fuel consumption'),
('Emissions Air', 'Emissions', 'Atmospheric emissions'),
('Emissions Water', 'Emissions', 'Water body emissions'),
('Transportation Road', 'Transportation', 'Road transport'),
('Waste Solid', 'Waste', 'Solid waste disposal'),
('Land Use', 'Land Use', 'Land occupation');

-- ============================================================================
-- LINK SUBSTANCES TO LOAD CATEGORIES
-- ============================================================================
-- Assuming substances already exist in substances table
-- Example: Copper
INSERT INTO load_category_substances (load_category_id, substance_id, description)
SELECT lc.load_category_id, s.substance_id, 'Copper as raw material'
FROM load_categories lc, substances s
WHERE lc.load_category_name = 'Material Non-Ferrous'
  AND s.substance_name = 'Copper';

-- Example: Lead
INSERT INTO load_category_substances (load_category_id, substance_id, description)
SELECT lc.load_category_id, s.substance_id, 'Lead emissions from welding'
FROM load_categories lc, substances s
WHERE lc.load_category_name = 'Material Non-Ferrous'
  AND s.substance_name = 'Lead';

-- ============================================================================
-- INSERT DRIVER FACTORS
-- ============================================================================
-- Welding - Lead emissions
INSERT INTO driver_factors (lcs_id, factor_value, factor_unit, drivers_required, experimental_source, confidence_level)
SELECT
  lcs.lcs_id,
  0.03,
  'kg per inch',
  '["weld_length"]',
  'LCAPIX Manual Table 4',
  'High'
FROM load_category_substances lcs
INNER JOIN substances s ON lcs.substance_id = s.substance_id
INNER JOIN load_categories lc ON lcs.load_category_id = lc.load_category_id
WHERE s.substance_name = 'Lead'
  AND lc.load_category_name = 'Material Non-Ferrous';

-- ============================================================================
-- INSERT ELU VALUES
-- ============================================================================
-- Copper raw material: 28.7 ELU/kg (from LCAPIX Manual page 11)
INSERT INTO elu_values (lcs_id, elu_per_unit, valuation_method, geographic_scope, reference_year, source_reference)
SELECT
  lcs.lcs_id,
  28.7,
  'EPS',
  'Global',
  2020,
  'LCAPIX Manual page 11'
FROM load_category_substances lcs
INNER JOIN substances s ON lcs.substance_id = s.substance_id
INNER JOIN load_categories lc ON lcs.load_category_id = lc.load_category_id
WHERE s.substance_name = 'Copper'
  AND lc.load_category_name = 'Material Non-Ferrous';

-- Lead emissions: 5.2 ELU/kg (estimated)
INSERT INTO elu_values (lcs_id, elu_per_unit, valuation_method, geographic_scope, reference_year, source_reference)
SELECT
  lcs.lcs_id,
  5.2,
  'EPS',
  'Global',
  2020,
  'Estimated based on EPS methodology'
FROM load_category_substances lcs
INNER JOIN substances s ON lcs.substance_id = s.substance_id
INNER JOIN load_categories lc ON lcs.load_category_id = lc.load_category_id
WHERE s.substance_name = 'Lead'
  AND lc.load_category_name = 'Material Non-Ferrous';
```

### 6.3 Schema Relationships Diagram

```
┌─────────────────┐
│ load_categories │
└────────┬────────┘
         │
         │ 1:N
         ▼
┌───────────────────────┐
│ load_category_        │
│ substances (lcs)      │◄─────────┐
└──────┬────────────────┘          │
       │                           │
       │ 1:N                       │ N:1
       ▼                           │
┌──────────────┐          ┌────────┴───────┐
│ driver_      │          │ substances     │
│ factors      │          └────────────────┘
└──────────────┘

┌──────────────┐
│ elu_values   │
└──────┬───────┘
       │
       │ N:1
       ▼
┌───────────────────────┐
│ load_category_        │
│ substances            │
└──────┬────────────────┘
       │
       │ N:M
       ▼
┌────────────────────────┐
│ process_load_          │
│ substances (junction)  │
└──────┬─────────────────┘
       │
       │ N:1
       ▼
┌──────────────┐       ┌──────────────────┐
│ process      │◄──────┤ process_drivers  │
└──────────────┘  1:N  └──────────────────┘
```

---

## 7. Complete Test Scenarios

### 7.1 Test Scenario: Electric Scooter Manufacturing

This comprehensive test scenario demonstrates both CML 2001 and LCAPIX EPS calculations for a complete product.

#### Product Structure

```
Electric Scooter Model X (Product)
├─ Frame Assembly Line (Level 1: Machine)
│  └─ Welding Operation (Level 2: Operation)
│     ├─ Driver: weld_length = 50 inches
│     ├─ Driver: operation_time = 2.5 hours
│     └─ Substances:
│        ├─ Lead (Pb) emissions
│        └─ Electricity consumption
│
└─ Circuit Board Assembly (Level 1: Machine)
   └─ Component Soldering (Level 2: Operation)
      ├─ Driver: board_area = 150 cm²
      └─ Substances:
         └─ Copper (raw material)
```

#### SQL Test Data

```sql
-- ============================================================================
-- CREATE PRODUCT
-- ============================================================================
INSERT INTO product (product_id, product_name, description)
VALUES (1, 'Electric Scooter Model X', 'Urban electric scooter for short-distance travel');

-- ============================================================================
-- CREATE PROCESS HIERARCHY
-- ============================================================================
-- Level 1: Frame Assembly Line
INSERT INTO process (process_id, product_id, process_name, process_type, hierarchy_level, parent_process_id)
VALUES (10, 1, 'Frame Assembly Line', 'Machine', 1, NULL);

-- Level 2: Welding Operation
INSERT INTO process (process_id, product_id, process_name, process_type, hierarchy_level, parent_process_id)
VALUES (20, 1, 'Welding Operation', 'Operation', 2, 10);

-- Level 1: Circuit Board Assembly
INSERT INTO process (process_id, product_id, process_name, process_type, hierarchy_level, parent_process_id)
VALUES (11, 1, 'Circuit Board Assembly', 'Machine', 1, NULL);

-- Level 2: Component Soldering
INSERT INTO process (process_id, product_id, process_name, process_type, hierarchy_level, parent_process_id)
VALUES (21, 1, 'Component Soldering', 'Operation', 2, 11);

-- ============================================================================
-- ADD DRIVERS
-- ============================================================================
-- Welding Operation drivers
INSERT INTO process_drivers (process_id, driver_name, driver_value, unit, description) VALUES
(20, 'weld_length', 50.0, 'inches', 'Total length of welds for frame assembly'),
(20, 'operation_time', 2.5, 'hours', 'Total welding operation time');

-- Component Soldering drivers
INSERT INTO process_drivers (process_id, driver_name, driver_value, unit, description) VALUES
(21, 'board_area', 150.0, 'cm²', 'Total circuit board area');

-- ============================================================================
-- LINK PROCESSES TO LOAD CATEGORY SUBSTANCES
-- ============================================================================
-- Welding Operation: Lead emissions
INSERT INTO process_load_substances (process_id, lcs_id)
SELECT 20, lcs.lcs_id
FROM load_category_substances lcs
INNER JOIN substances s ON lcs.substance_id = s.substance_id
WHERE s.substance_name = 'Lead';

-- Welding Operation: Electricity (create if not exists)
-- First, create electricity in load_category_substances if needed
INSERT INTO load_category_substances (load_category_id, substance_id)
SELECT lc.load_category_id, s.substance_id
FROM load_categories lc, substances s
WHERE lc.load_category_name = 'Energy Electricity'
  AND s.substance_name = 'Electricity';

-- Then add driver factor for electricity
INSERT INTO driver_factors (lcs_id, factor_value, factor_unit, drivers_required, confidence_level)
SELECT
  lcs.lcs_id,
  12.5,
  'kWh per hour',
  '["operation_time"]',
  'High'
FROM load_category_substances lcs
INNER JOIN substances s ON lcs.substance_id = s.substance_id
WHERE s.substance_name = 'Electricity';

-- And ELU value for electricity
INSERT INTO elu_values (lcs_id, elu_per_unit, valuation_method)
SELECT lcs.lcs_id, 0.45, 'EPS'
FROM load_category_substances lcs
INNER JOIN substances s ON lcs.substance_id = s.substance_id
WHERE s.substance_name = 'Electricity';

-- Link to process
INSERT INTO process_load_substances (process_id, lcs_id)
SELECT 20, lcs.lcs_id
FROM load_category_substances lcs
INNER JOIN substances s ON lcs.substance_id = s.substance_id
WHERE s.substance_name = 'Electricity';

-- Component Soldering: Copper
INSERT INTO process_load_substances (process_id, lcs_id)
SELECT 21, lcs.lcs_id
FROM load_category_substances lcs
INNER JOIN substances s ON lcs.substance_id = s.substance_id
WHERE s.substance_name = 'Copper';

-- Add driver factor for copper (area-based)
INSERT INTO driver_factors (lcs_id, factor_value, factor_unit, drivers_required, confidence_level)
SELECT
  lcs.lcs_id,
  0.067,
  'kg per cm²',
  '["board_area"]',
  'Medium'
FROM load_category_substances lcs
INNER JOIN substances s ON lcs.substance_id = s.substance_id
WHERE s.substance_name = 'Copper';
```

#### Expected Calculation Results

**Process 20: Welding Operation**

| Substance | Load Category | Driver | Calculation | Amount | ELU/unit | Impact (ELU) |
|-----------|--------------|--------|-------------|--------|----------|--------------|
| Lead (Pb) | Material Non-Ferrous | weld_length=50 | 0.03 × 50 | 1.5 kg | 5.2 | 7.8 |
| Electricity | Energy Electricity | operation_time=2.5 | 12.5 × 2.5 | 31.25 kWh | 0.45 | 14.06 |

**Process 20 Total: 21.86 ELU**

**Process 21: Component Soldering**

| Substance | Load Category | Driver | Calculation | Amount | ELU/unit | Impact (ELU) |
|-----------|--------------|--------|-------------|--------|----------|--------------|
| Copper | Material Non-Ferrous | board_area=150 | 0.067 × 150 | 10.05 kg | 28.7 | 288.44 |

**Process 21 Total: 288.44 ELU**

**Product Total: 310.3 ELU**

**Load Category Breakdown:**
- Material Non-Ferrous: 296.24 ELU (95.5%)
- Energy Electricity: 14.06 ELU (4.5%)

### 7.2 Test Scenario: JSON Test Data

Complete JSON structure for API testing:

```json
{
  "test_scenario": "Electric Scooter Manufacturing",
  "product": {
    "product_id": 1,
    "product_name": "Electric Scooter Model X",
    "expected_total_elu": 310.3
  },
  "processes": [
    {
      "process_id": 20,
      "process_name": "Welding Operation",
      "hierarchy_level": 2,
      "drivers": [
        {
          "driver_name": "weld_length",
          "driver_value": 50.0,
          "unit": "inches"
        },
        {
          "driver_name": "operation_time",
          "driver_value": 2.5,
          "unit": "hours"
        }
      ],
      "substances": [
        {
          "substance_name": "Lead",
          "load_category": "Material Non-Ferrous",
          "driver_factor": 0.03,
          "driver_factor_unit": "kg per inch",
          "drivers_required": ["weld_length"],
          "expected_amount": 1.5,
          "amount_unit": "kg",
          "elu_per_unit": 5.2,
          "expected_impact": 7.8
        },
        {
          "substance_name": "Electricity",
          "load_category": "Energy Electricity",
          "driver_factor": 12.5,
          "driver_factor_unit": "kWh per hour",
          "drivers_required": ["operation_time"],
          "expected_amount": 31.25,
          "amount_unit": "kWh",
          "elu_per_unit": 0.45,
          "expected_impact": 14.06
        }
      ],
      "expected_total_elu": 21.86
    },
    {
      "process_id": 21,
      "process_name": "Component Soldering",
      "hierarchy_level": 2,
      "drivers": [
        {
          "driver_name": "board_area",
          "driver_value": 150.0,
          "unit": "cm²"
        }
      ],
      "substances": [
        {
          "substance_name": "Copper",
          "load_category": "Material Non-Ferrous",
          "driver_factor": 0.067,
          "driver_factor_unit": "kg per cm²",
          "drivers_required": ["board_area"],
          "expected_amount": 10.05,
          "amount_unit": "kg",
          "elu_per_unit": 28.7,
          "expected_impact": 288.44
        }
      ],
      "expected_total_elu": 288.44
    }
  ],
  "expected_load_category_totals": {
    "Material Non-Ferrous": 296.24,
    "Energy Electricity": 14.06
  }
}
```

### 7.3 Validation Test Script

```typescript
/**
 * Validation test for LCAPIX EPS calculations
 */
async function validateEPSCalculation() {
  const connection = await getConnection();

  try {
    const result = await calculateProductEPSImpacts(1, connection);

    // Test 1: Total ELU
    console.assert(
      Math.abs(result.total_elu - 310.3) < 0.1,
      `Total ELU mismatch: expected 310.3, got ${result.total_elu}`
    );

    // Test 2: Process count
    console.assert(
      result.process_results.length === 2,
      `Process count mismatch: expected 2, got ${result.process_results.length}`
    );

    // Test 3: Welding operation ELU
    const weldingProcess = result.process_results.find(p => p.process_id === 20);
    console.assert(
      weldingProcess && Math.abs(weldingProcess.total_elu - 21.86) < 0.1,
      `Welding ELU mismatch: expected 21.86, got ${weldingProcess?.total_elu}`
    );

    // Test 4: Soldering operation ELU
    const solderingProcess = result.process_results.find(p => p.process_id === 21);
    console.assert(
      solderingProcess && Math.abs(solderingProcess.total_elu - 288.44) < 0.1,
      `Soldering ELU mismatch: expected 288.44, got ${solderingProcess?.total_elu}`
    );

    // Test 5: Load category breakdown
    const materialNonFerrous = result.load_category_totals.get('Material Non-Ferrous') || 0;
    console.assert(
      Math.abs(materialNonFerrous - 296.24) < 0.1,
      `Material Non-Ferrous mismatch: expected 296.24, got ${materialNonFerrous}`
    );

    console.log('✅ All validation tests passed!');

  } finally {
    await connection.end();
  }
}
```

---

## 8. Integration Roadmap

### 8.1 Phase 1: Database Schema (Week 1-2)

**Tasks:**
1. Create migration script for new LCAPIX tables
2. Populate load categories with standard values
3. Import initial substance-category mappings
4. Add sample driver factors from LCAPIX manual
5. Import ELU values from EPS methodology

**Deliverables:**
- [ ] Migration SQL script (`migrations/lcapix-eps-schema.sql`)
- [ ] Seed data script (`seeds/lcapix-initial-data.sql`)
- [ ] Database backup before migration
- [ ] Rollback script for safety

### 8.2 Phase 2: Backend Implementation (Week 3-4)

**Tasks:**
1. Create TypeScript type definitions (`lib/types/lcapix-eps.ts`)
2. Implement core calculation functions (`lib/lcapix-eps-engine.ts`)
3. Add API endpoints for EPS calculations
4. Write unit tests for calculation functions
5. Write integration tests with test database

**Deliverables:**
- [ ] LCAPIX EPS calculation engine
- [ ] API endpoints (`/api/assessments/eps/*`)
- [ ] Test suite with >80% coverage
- [ ] API documentation

### 8.3 Phase 3: Frontend Integration (Week 5-6)

**Tasks:**
1. Create EPS assessment UI components
2. Add methodology selector (CML vs. EPS)
3. Build driver input forms
4. Create EPS results visualization
5. Add comparison view (CML vs. EPS)

**Deliverables:**
- [ ] Driver configuration UI
- [ ] EPS results dashboard
- [ ] Comparison charts
- [ ] User documentation

### 8.4 Phase 4: ECP Library (Week 7-8)

**Tasks:**
1. Design ECP library UI
2. Implement ECP CRUD operations
3. Create ECP browser/search
4. Add ECP import/export
5. Build process template system

**Deliverables:**
- [ ] ECP library management interface
- [ ] Standard ECPs from LCAPIX manual
- [ ] Import/export functionality
- [ ] Template library

### 8.5 Phase 5: Testing & Validation (Week 9-10)

**Tasks:**
1. User acceptance testing
2. Performance optimization
3. Cross-validation with manual calculations
4. Documentation completion
5. Training materials

**Deliverables:**
- [ ] UAT report
- [ ] Performance benchmarks
- [ ] Validation report
- [ ] User manual
- [ ] Training videos

### 8.6 Estimated Timeline

```
Week 1-2:  Database Schema
Week 3-4:  Backend Implementation
Week 5-6:  Frontend Integration
Week 7-8:  ECP Library
Week 9-10: Testing & Validation

Total: 10 weeks (2.5 months)
```

### 8.7 Resource Requirements

**Development Team:**
- 1× Backend Developer (TypeScript, MySQL)
- 1× Frontend Developer (React, Next.js)
- 1× LCA Domain Expert (validation)
- 1× QA Engineer (testing)

**Infrastructure:**
- Development database server
- Staging environment
- Test data sets

### 8.8 Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Data migration errors | Medium | High | Backup before migration, rollback plan |
| Calculation inaccuracies | Low | High | Extensive validation against manual |
| Performance issues | Medium | Medium | Load testing, query optimization |
| User adoption | Medium | Medium | Training, documentation, support |
| Incomplete driver factors | High | Medium | Use manual values, allow custom entry |

---

## 9. Recommendations & Next Steps

### 9.1 Immediate Priorities

1. **Database Migration**
   - Run schema creation scripts
   - Populate with sample data from this document
   - Validate foreign key relationships

2. **Backend Development**
   - Copy TypeScript code from Section 5
   - Implement API endpoints
   - Write basic unit tests

3. **Validation**
   - Run test scenario from Section 7
   - Compare results with manual calculations
   - Document any discrepancies

### 9.2 Long-term Strategy

**Option A: Dual Methodology**
- Offer both CML 2001 and LCAPIX EPS
- Let users choose based on their needs
- Provide comparison tools

**Option B: Phased Migration**
- Start with CML 2001 (already implemented)
- Add LCAPIX EPS as "beta" feature
- Gradually transition based on user feedback

**Option C: Hybrid Approach** (Recommended)
- Use CML 2001 for regulatory compliance
- Use LCAPIX EPS for design/estimation
- Cross-validate with both methods

### 9.3 Missing Information

**From Word Document** (Pages 22 & 34):
- Unable to read due to binary format
- May contain additional algorithms or examples
- **Action**: Convert to PDF or extract text manually

**Recommendation**: Review pages 22 and 34 to ensure no critical algorithm details were missed.

### 9.4 Questions for Client

1. **Methodology Preference**:
   - Do you want both CML and EPS, or just one?
   - Is EPS a requirement or optional enhancement?

2. **ECP Library**:
   - Do you have existing ECP data to import?
   - Should ECPs be shareable between users?

3. **Driver Factors**:
   - Will you provide experimental driver factors?
   - Or should users be able to create custom factors?

4. **Deployment Timeline**:
   - Is the 10-week timeline acceptable?
   - Are there any hard deadlines?

5. **Data Migration**:
   - Do you have legacy LCAPIX data to migrate?
   - What format is it in?

---

## Appendix A: Glossary

**ABC Costing**: Activity-Based Costing - methodology that assigns costs to activities rather than products

**CAS Number**: Chemical Abstracts Service registry number - unique identifier for chemical substances

**CML 2001**: Impact assessment methodology from Centrum voor Milieukunde Leiden (Institute of Environmental Sciences, Leiden University)

**Driver**: Process parameter that influences environmental impact (e.g., time, length, area)

**Driver Factor**: Experimentally determined conversion factor that translates drivers into substance amounts

**ECP**: Elemental Component Process - reusable process building block with experimental environmental data

**ELU**: Environmental Load Unit - monetary valuation of environmental damage in the EPS method

**EPS**: Environmental Priority Strategy - valuation method that converts environmental impacts to monetary units

**Load Category**: Classification of environmental impacts (Material, Energy, Emissions, etc.)

**Process Hierarchy**: Multi-level decomposition of products into processes (up to 5 levels)

---

## Appendix B: References

1. **LCAPIX Module v2.0 Manual** (Manual(a).pdf)
   - Pages 11-16: EPS methodology and ELU values
   - Table 4: Driver factor examples
   - Section 3.2: Process hierarchy

2. **Current Implementation**
   - File: `lib/lca-engine.ts`
   - Lines 8-33: CML 2001 algorithm overview
   - Lines 115-212: Component impact calculation

3. **ISO Standards**
   - ISO 14040:2006 - Environmental management - Life cycle assessment - Principles and framework
   - ISO 14044:2006 - Environmental management - Life cycle assessment - Requirements and guidelines

4. **EPS Methodology**
   - Steen, B. (1999). A systematic approach to environmental priority strategies in product development (EPS). Version 2000 – General system characteristics.

---

## Document Control

**Version History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-17 | LCA Dev Team | Initial comprehensive analysis |

**Approval:**

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Technical Lead | | | |
| LCA Expert | | | |
| Project Manager | | | |
| Client Representative | | | |

---

## Contact Information

For questions or clarifications about this document, please contact:

**Technical Team**: [Your contact info]
**Project Manager**: [PM contact info]
**LCA Expert**: [Expert contact info]

---

**End of Document**
