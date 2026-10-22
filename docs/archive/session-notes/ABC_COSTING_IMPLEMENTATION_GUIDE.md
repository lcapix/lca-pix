# Activity-Based Costing (ABC) Implementation Guide for LCA Project v3

**Document Version**: 1.0
**Date**: January 2025
**Purpose**: Detailed implementation guide for ABC environmental costing features

---

## Table of Contents

1. [ABC Costing Fundamentals](#1-abc-costing-fundamentals)
2. [ABC in Environmental Context](#2-abc-in-environmental-context)
3. [Current vs. ABC Implementation](#3-current-vs-abc-implementation)
4. [Database Schema for ABC](#4-database-schema-for-abc)
5. [ABC Calculation Engine](#5-abc-calculation-engine)
6. [UI/UX for ABC Features](#6-uiux-for-abc-features)
7. [ABC Reporting & Analytics](#7-abc-reporting--analytics)
8. [Integration Roadmap](#8-integration-roadmap)

---

## 1. ABC Costing Fundamentals

### 1.1 What is ABC Costing?

**Activity-Based Costing (ABC)** assigns costs to products/services based on the activities and resources consumed, rather than using simple averages or volume-based allocation.

### 1.2 ABC Components

```
┌─────────────────────────────────────────┐
│          ABC COSTING MODEL              │
├─────────────────────────────────────────┤
│                                         │
│  Resources (Labor, Materials, Energy)  │
│            ↓                            │
│  Resource Drivers (How much consumed)  │
│            ↓                            │
│  Activities (Welding, Assembling, etc.)│
│            ↓                            │
│  Activity Drivers (Time, Area, Volume) │
│            ↓                            │
│  Cost Objects (Products, Services)     │
│                                         │
└─────────────────────────────────────────┘
```

### 1.3 Traditional vs. ABC Costing

**Traditional Costing Example**:
```
Product A Total Cost = Direct Materials + Direct Labor + (Overhead × Allocation Rate)

Example:
Materials: $100
Labor: $50
Overhead (50% of labor): $25
Total: $175
```

**ABC Costing Example**:
```
Product A Total Cost = Sum of Activity Costs

Activities:
- Material Procurement: $30
- Machining (2 hours × $40/hour): $80
- Assembly (1 hour × $35/hour): $35
- Quality Inspection: $15
- Packaging: $10
- Shipping: $5
Total: $175

BUT now you know:
- Machining is 46% of total cost
- Can optimize by reducing machining time
- Can compare products by activity efficiency
```

---

## 2. ABC in Environmental Context

### 2.1 Environmental ABC Concept

Instead of tracking **financial costs**, we track **environmental costs** (impacts) by activity.

**Financial ABC**:
```
Activity Cost = Labor Hours × Hourly Rate + Materials + Equipment
```

**Environmental ABC**:
```
Environmental Impact = Activity Parameters × Driver Factors × ELU Values

Where:
- Activity Parameters = Time, length, area, volume (the "drivers")
- Driver Factors = Environmental load per unit of driver
- ELU Values = Monetary value of environmental damage
```

### 2.2 Why Environmental ABC?

**Benefits**:
1. **Activity-Level Insights**: Know which activities cause most environmental damage
2. **Process Optimization**: Target high-impact activities for improvement
3. **Cost Allocation**: Accurately assign environmental costs to products
4. **Scenario Analysis**: "What if we reduce welding time by 20%?"
5. **Benchmarking**: Compare activity efficiency across products/processes

**Example Comparison**:

**Without ABC** (Component-Level Only):
```
Product A: 1,000 kg CO₂-eq
Product B: 800 kg CO₂-eq

Conclusion: Product B is better
Problem: Don't know WHY or HOW to improve Product A
```

**With ABC** (Activity-Level):
```
Product A (1,000 kg CO₂-eq):
- Welding Activity: 600 kg (60%)
- Assembly Activity: 200 kg (20%)
- Painting Activity: 150 kg (15%)
- Packaging Activity: 50 kg (5%)

Product B (800 kg CO₂-eq):
- Welding Activity: 300 kg (37.5%) ← BETTER welding efficiency
- Assembly Activity: 250 kg (31.25%)
- Painting Activity: 200 kg (25%)
- Packaging Activity: 50 kg (6.25%)

Insights:
1. Product A has inefficient welding (600 vs 300 kg)
2. If we improve welding efficiency to match Product B, we save 300 kg CO₂-eq
3. Assembly in Product B is worse - investigate why
```

### 2.3 ABC Cost Pools in Environmental LCA

**Cost Pool**: A grouping of activities with similar cost drivers.

**Environmental Cost Pools**:

| Cost Pool | Activities | Driver | Environmental Load |
|-----------|-----------|--------|-------------------|
| **Manufacturing** | Welding, Cutting, Drilling, Milling | Machine hours, Length, Area | Energy, Emissions, Waste |
| **Material Handling** | Transport, Storage, Loading | Distance, Weight, Volume | Fuel, Energy |
| **Surface Treatment** | Painting, Coating, Plating | Surface area, Volume | Chemicals, Emissions |
| **Assembly** | Joining, Fastening, Testing | Assembly time, Unit count | Energy, Materials |
| **Quality Control** | Inspection, Testing | Test time, Unit count | Energy |
| **Packaging** | Boxing, Wrapping, Labeling | Package count, Area | Materials, Energy |
| **Logistics** | Shipping, Delivery | Distance, Weight | Fuel, Emissions |

---

## 3. Current vs. ABC Implementation

### 3.1 Current CML 2001 Implementation

**Current Approach**: Flow-based, Component-level

```typescript
// Current structure
Component {
  component_id
  component_name
  flows: [
    { substance: "CO2", quantity: 125.25, unit: "kg" }
  ]
}

// Calculation
Impact = Σ(Flow Quantity × Characterization Factor)
Impact = 125.25 × 1.0 = 125.25 kg CO₂-eq

// Problem: No activity breakdown!
```

**Limitations**:
- ❌ Can't see which activities contribute to impact
- ❌ Can't compare activity efficiency across products
- ❌ Can't do "what-if" analysis on specific activities
- ❌ No cost pool tracking
- ❌ No resource driver analysis

### 3.2 ABC-Enhanced Implementation

**New Approach**: Activity-based, Process-level with cost pools

```typescript
// ABC structure
Product {
  product_id
  processes: [
    {
      process_id: 20
      process_name: "Welding Operation"
      process_type: "Operation" // This is an ACTIVITY
      cost_pool: "Manufacturing"

      drivers: [
        { name: "weld_length", value: 50, unit: "inches" },
        { name: "operation_time", value: 2.5, unit: "hours" }
      ]

      activities: [
        {
          activity_name: "Material Consumption",
          resource: "Lead",
          driver_factor: 0.03,
          driver: "weld_length",
          amount: 1.5 kg,
          impact: 7.8 ELU
        },
        {
          activity_name: "Energy Consumption",
          resource: "Electricity",
          driver_factor: 12.5,
          driver: "operation_time",
          amount: 31.25 kWh,
          impact: 14.06 ELU
        }
      ],

      total_impact: 21.86 ELU
    }
  ]
}

// Analysis possible:
// 1. Which activity in welding costs more? (Energy vs Material)
// 2. Compare welding efficiency across products
// 3. Calculate cost per inch of welding
// 4. Calculate cost per hour of operation
```

**Advantages**:
- ✅ Activity-level visibility
- ✅ Cost pool tracking
- ✅ Resource driver analysis
- ✅ Cross-product benchmarking
- ✅ Scenario analysis capabilities

---

## 4. Database Schema for ABC

### 4.1 Additional Tables for ABC Features

```sql
-- ============================================================================
-- COST POOLS TABLE
-- ============================================================================
CREATE TABLE cost_pools (
  cost_pool_id INT AUTO_INCREMENT PRIMARY KEY,
  cost_pool_name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  pool_category ENUM('Manufacturing', 'Material Handling', 'Surface Treatment',
                     'Assembly', 'Quality Control', 'Packaging', 'Logistics') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_category (pool_category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- ACTIVITIES TABLE (Enhanced process tracking)
-- ============================================================================
CREATE TABLE activities (
  activity_id INT AUTO_INCREMENT PRIMARY KEY,
  activity_name VARCHAR(200) NOT NULL,
  activity_code VARCHAR(50) UNIQUE,
  cost_pool_id INT NOT NULL,
  activity_type ENUM('Direct', 'Indirect', 'Support') DEFAULT 'Direct',
  description TEXT,
  is_standard BOOLEAN DEFAULT FALSE, -- Standard activities from library
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (cost_pool_id) REFERENCES cost_pools(cost_pool_id),

  INDEX idx_pool (cost_pool_id),
  INDEX idx_type (activity_type),
  INDEX idx_code (activity_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- PROCESS ACTIVITIES TABLE (Link processes to activities)
-- ============================================================================
CREATE TABLE process_activities (
  process_activity_id INT AUTO_INCREMENT PRIMARY KEY,
  process_id INT NOT NULL,
  activity_id INT NOT NULL,
  sequence_order INT DEFAULT 1,
  activity_duration DECIMAL(10, 2), -- Optional: time spent on this activity
  activity_duration_unit VARCHAR(20),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (process_id) REFERENCES process(process_id) ON DELETE CASCADE,
  FOREIGN KEY (activity_id) REFERENCES activities(activity_id),

  UNIQUE KEY unique_process_activity (process_id, activity_id),
  INDEX idx_process (process_id),
  INDEX idx_activity (activity_id),
  INDEX idx_sequence (sequence_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- RESOURCE DRIVERS TABLE
-- ============================================================================
CREATE TABLE resource_drivers (
  resource_driver_id INT AUTO_INCREMENT PRIMARY KEY,
  driver_name VARCHAR(100) NOT NULL,
  driver_category ENUM('Time-based', 'Volume-based', 'Area-based',
                      'Length-based', 'Count-based', 'Weight-based') NOT NULL,
  unit VARCHAR(50) NOT NULL,
  description TEXT,
  is_standard BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY unique_driver_name (driver_name),
  INDEX idx_category (driver_category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- ACTIVITY COSTS TABLE (Environmental costs per activity)
-- ============================================================================
CREATE TABLE activity_costs (
  activity_cost_id INT AUTO_INCREMENT PRIMARY KEY,
  process_activity_id INT NOT NULL,
  lcs_id INT NOT NULL, -- Load category substance
  cost_type ENUM('Direct', 'Allocated', 'Overhead') DEFAULT 'Direct',

  -- Driver information
  resource_driver_id INT NOT NULL,
  driver_value DECIMAL(15, 6) NOT NULL,
  driver_factor DECIMAL(15, 6) NOT NULL,

  -- Calculated costs
  resource_consumption DECIMAL(15, 6) NOT NULL, -- Amount of substance
  consumption_unit VARCHAR(50),
  environmental_cost DECIMAL(15, 6) NOT NULL, -- ELU value

  -- Traceability
  calculation_formula TEXT,
  confidence_level ENUM('High', 'Medium', 'Low') DEFAULT 'Medium',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (process_activity_id) REFERENCES process_activities(process_activity_id) ON DELETE CASCADE,
  FOREIGN KEY (lcs_id) REFERENCES load_category_substances(lcs_id),
  FOREIGN KEY (resource_driver_id) REFERENCES resource_drivers(resource_driver_id),

  INDEX idx_process_activity (process_activity_id),
  INDEX idx_lcs (lcs_id),
  INDEX idx_driver (resource_driver_id),
  INDEX idx_cost_type (cost_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- ACTIVITY BENCHMARKS TABLE (For comparison across products)
-- ============================================================================
CREATE TABLE activity_benchmarks (
  benchmark_id INT AUTO_INCREMENT PRIMARY KEY,
  activity_id INT NOT NULL,
  benchmark_type ENUM('Industry Average', 'Best Practice', 'Company Standard') NOT NULL,

  -- Performance metrics
  cost_per_driver_unit DECIMAL(15, 6), -- e.g., ELU per hour, ELU per kg
  driver_unit VARCHAR(50),
  efficiency_rating DECIMAL(5, 2), -- 0-100 scale

  -- Context
  industry_sector VARCHAR(100),
  geographic_region VARCHAR(100),
  sample_size INT,
  data_source VARCHAR(255),
  reference_year INT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (activity_id) REFERENCES activities(activity_id),

  INDEX idx_activity (activity_id),
  INDEX idx_type (benchmark_type),
  INDEX idx_sector (industry_sector)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- ABC ANALYSIS RESULTS TABLE (Store calculated ABC data)
-- ============================================================================
CREATE TABLE abc_analysis_results (
  analysis_id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  case_id INT,
  analysis_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Aggregate metrics
  total_environmental_cost DECIMAL(15, 6),
  total_activities INT,
  total_cost_pools INT,

  -- ABC classification
  high_impact_activities JSON, -- Top 20% activities (Pareto)
  medium_impact_activities JSON,
  low_impact_activities JSON,

  -- Cost pool breakdown
  cost_pool_distribution JSON, -- { "Manufacturing": 60%, "Logistics": 20%, ... }

  -- Recommendations
  optimization_opportunities JSON,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_product (product_id),
  INDEX idx_case (case_id),
  INDEX idx_date (analysis_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 4.2 Sample Data Population

```sql
-- ============================================================================
-- INSERT COST POOLS
-- ============================================================================
INSERT INTO cost_pools (cost_pool_name, pool_category, description) VALUES
('Primary Manufacturing', 'Manufacturing', 'Core manufacturing activities like welding, cutting, machining'),
('Material Processing', 'Material Handling', 'Material transport, storage, and preparation'),
('Surface Finishing', 'Surface Treatment', 'Painting, coating, plating, polishing'),
('Product Assembly', 'Assembly', 'Component assembly and integration'),
('Quality Assurance', 'Quality Control', 'Inspection, testing, validation'),
('Packaging Operations', 'Packaging', 'Product packaging and labeling'),
('Distribution', 'Logistics', 'Shipping and delivery');

-- ============================================================================
-- INSERT STANDARD ACTIVITIES
-- ============================================================================
INSERT INTO activities (activity_name, activity_code, cost_pool_id, activity_type, is_standard) VALUES
-- Manufacturing activities
('Welding', 'MFG-WELD', 1, 'Direct', TRUE),
('Cutting', 'MFG-CUT', 1, 'Direct', TRUE),
('Drilling', 'MFG-DRILL', 1, 'Direct', TRUE),
('Milling', 'MFG-MILL', 1, 'Direct', TRUE),

-- Material handling
('Material Transport', 'MAT-TRANS', 2, 'Support', TRUE),
('Material Storage', 'MAT-STOR', 2, 'Indirect', TRUE),

-- Surface treatment
('Painting', 'SRF-PAINT', 3, 'Direct', TRUE),
('Coating', 'SRF-COAT', 3, 'Direct', TRUE),

-- Assembly
('Component Assembly', 'ASM-COMP', 4, 'Direct', TRUE),
('Fastening', 'ASM-FAST', 4, 'Direct', TRUE),

-- QC
('Visual Inspection', 'QC-VIS', 5, 'Support', TRUE),
('Performance Testing', 'QC-TEST', 5, 'Support', TRUE),

-- Packaging
('Primary Packaging', 'PKG-PRI', 6, 'Direct', TRUE),
('Secondary Packaging', 'PKG-SEC', 6, 'Direct', TRUE),

-- Logistics
('Domestic Shipping', 'LOG-DOM', 7, 'Support', TRUE),
('International Shipping', 'LOG-INT', 7, 'Support', TRUE);

-- ============================================================================
-- INSERT RESOURCE DRIVERS
-- ============================================================================
INSERT INTO resource_drivers (driver_name, driver_category, unit, is_standard) VALUES
-- Time-based
('Machine Hours', 'Time-based', 'hours', TRUE),
('Labor Hours', 'Time-based', 'hours', TRUE),
('Operation Time', 'Time-based', 'hours', TRUE),

-- Volume-based
('Production Volume', 'Volume-based', 'units', TRUE),
('Batch Size', 'Volume-based', 'units', TRUE),
('Material Volume', 'Volume-based', 'liters', TRUE),

-- Area-based
('Surface Area', 'Area-based', 'cm²', TRUE),
('Floor Space', 'Area-based', 'm²', TRUE),

-- Length-based
('Weld Length', 'Length-based', 'inches', TRUE),
('Cut Length', 'Length-based', 'meters', TRUE),
('Pipe Length', 'Length-based', 'meters', TRUE),

-- Count-based
('Number of Operations', 'Count-based', 'count', TRUE),
('Number of Components', 'Count-based', 'count', TRUE),
('Number of Tests', 'Count-based', 'count', TRUE),

-- Weight-based
('Material Weight', 'Weight-based', 'kg', TRUE),
('Product Weight', 'Weight-based', 'kg', TRUE),
('Shipping Weight', 'Weight-based', 'kg', TRUE);

-- ============================================================================
-- LINK PROCESS TO ACTIVITIES (Example: Electric Scooter Welding)
-- ============================================================================
-- Assuming process_id = 20 (Welding Operation from earlier example)
INSERT INTO process_activities (process_id, activity_id, sequence_order, activity_duration, activity_duration_unit)
SELECT
  20,
  a.activity_id,
  1,
  2.5,
  'hours'
FROM activities a
WHERE a.activity_code = 'MFG-WELD';

-- ============================================================================
-- INSERT ACTIVITY COSTS (Example: Welding - Lead emissions)
-- ============================================================================
INSERT INTO activity_costs (
  process_activity_id,
  lcs_id,
  cost_type,
  resource_driver_id,
  driver_value,
  driver_factor,
  resource_consumption,
  consumption_unit,
  environmental_cost,
  calculation_formula,
  confidence_level
)
SELECT
  pa.process_activity_id,
  lcs.lcs_id,
  'Direct',
  rd.resource_driver_id,
  50.0, -- weld_length value
  0.03, -- driver factor
  1.5, -- calculated amount (0.03 × 50)
  'kg',
  7.8, -- ELU (1.5 × 5.2)
  '0.03 (driver_factor) × 50 (weld_length) × 5.2 (ELU/kg) = 7.8 ELU',
  'High'
FROM process_activities pa
INNER JOIN activities a ON pa.activity_id = a.activity_id
INNER JOIN load_category_substances lcs ON lcs.lcs_id = (
  SELECT lcs2.lcs_id
  FROM load_category_substances lcs2
  INNER JOIN substances s ON lcs2.substance_id = s.substance_id
  WHERE s.substance_name = 'Lead'
  LIMIT 1
)
INNER JOIN resource_drivers rd ON rd.driver_name = 'Weld Length'
WHERE a.activity_code = 'MFG-WELD'
  AND pa.process_id = 20;

-- Similar inserts for electricity consumption...

-- ============================================================================
-- INSERT ACTIVITY BENCHMARKS
-- ============================================================================
INSERT INTO activity_benchmarks (
  activity_id,
  benchmark_type,
  cost_per_driver_unit,
  driver_unit,
  efficiency_rating,
  industry_sector,
  geographic_region,
  sample_size,
  data_source,
  reference_year
)
SELECT
  a.activity_id,
  'Industry Average',
  0.156, -- 7.8 ELU / 50 inches = 0.156 ELU per inch
  'inches',
  75.0,
  'Electronics Manufacturing',
  'Global',
  100,
  'LCAPIX Manual Table 4',
  2020
FROM activities a
WHERE a.activity_code = 'MFG-WELD';
```

---

## 5. ABC Calculation Engine

### 5.1 ABC-Enhanced Type Definitions

```typescript
/**
 * ABC COSTING TYPE DEFINITIONS
 * File: lib/types/abc-costing.ts
 */

export interface CostPool {
  cost_pool_id: number;
  cost_pool_name: string;
  pool_category: 'Manufacturing' | 'Material Handling' | 'Surface Treatment' |
                 'Assembly' | 'Quality Control' | 'Packaging' | 'Logistics';
  description: string;
}

export interface Activity {
  activity_id: number;
  activity_name: string;
  activity_code: string;
  cost_pool_id: number;
  cost_pool_name?: string;
  activity_type: 'Direct' | 'Indirect' | 'Support';
  is_standard: boolean;
}

export interface ResourceDriver {
  resource_driver_id: number;
  driver_name: string;
  driver_category: 'Time-based' | 'Volume-based' | 'Area-based' |
                   'Length-based' | 'Count-based' | 'Weight-based';
  unit: string;
}

export interface ActivityCost {
  activity_cost_id: number;
  activity_name: string;
  activity_code: string;
  cost_pool_name: string;
  cost_type: 'Direct' | 'Allocated' | 'Overhead';

  // Driver details
  driver_name: string;
  driver_value: number;
  driver_unit: string;
  driver_factor: number;

  // Substance details
  substance_name: string;
  load_category_name: string;

  // Costs
  resource_consumption: number;
  consumption_unit: string;
  environmental_cost: number; // ELU

  // Metadata
  calculation_formula: string;
  confidence_level: 'High' | 'Medium' | 'Low';
}

export interface ProcessABCResult {
  process_id: number;
  process_name: string;
  total_environmental_cost: number; // Total ELU

  // Activity-level breakdown
  activities: ActivityCost[];

  // Cost pool aggregation
  cost_pool_totals: Map<string, number>;
  cost_pool_percentages: Map<string, number>;

  // Driver analysis
  driver_analysis: {
    driver_name: string;
    total_value: number;
    unit: string;
    cost_per_unit: number; // ELU per driver unit
    activities_using_driver: number;
  }[];

  // ABC Classification (Pareto)
  high_impact_activities: ActivityCost[]; // Top 20% by cost
  medium_impact_activities: ActivityCost[]; // Next 30%
  low_impact_activities: ActivityCost[]; // Remaining 50%
}

export interface ProductABCResult {
  product_id: number;
  product_name: string;
  total_environmental_cost: number;

  // Process breakdown
  processes: ProcessABCResult[];

  // Product-level aggregations
  total_cost_pools: Map<string, number>;
  cost_pool_percentages: Map<string, number>;

  // Activity ranking (across all processes)
  top_activities: {
    activity_name: string;
    activity_code: string;
    total_cost: number;
    percentage_of_total: number;
    process_count: number; // How many processes use this activity
  }[];

  // Optimization opportunities
  optimization_opportunities: {
    activity_name: string;
    current_cost: number;
    benchmark_cost: number;
    savings_potential: number;
    savings_percentage: number;
    recommendation: string;
  }[];

  // Benchmarking
  efficiency_score: number; // 0-100 scale

  metadata: {
    calculation_timestamp: Date;
    total_activities: number;
    total_cost_pools: number;
  };
}
```

### 5.2 ABC Calculation Functions

```typescript
/**
 * ABC COSTING CALCULATION ENGINE
 * File: lib/abc-costing-engine.ts
 */

import { Connection, RowDataPacket } from 'mysql2/promise';
import {
  ActivityCost,
  ProcessABCResult,
  ProductABCResult
} from './types/abc-costing';

// ============================================================================
// ACTIVITY COST CALCULATION
// ============================================================================

/**
 * Calculate ABC costs for a single process
 *
 * This provides activity-level breakdown of environmental costs
 */
export async function calculateProcessABCCosts(
  processId: number,
  connection: Connection
): Promise<ProcessABCResult> {

  // Step 1: Get process details
  const [processes] = await connection.query<RowDataPacket[]>(
    `SELECT process_id, process_name FROM process WHERE process_id = ?`,
    [processId]
  );

  if (processes.length === 0) {
    throw new Error(`Process ${processId} not found`);
  }

  const process = processes[0];

  // Step 2: Get all activity costs for this process
  const [activityCostsData] = await connection.query<RowDataPacket[]>(
    `SELECT
       ac.activity_cost_id,
       a.activity_name,
       a.activity_code,
       cp.cost_pool_name,
       ac.cost_type,
       rd.driver_name,
       ac.driver_value,
       rd.unit as driver_unit,
       ac.driver_factor,
       s.substance_name,
       lc.load_category_name,
       ac.resource_consumption,
       ac.consumption_unit,
       ac.environmental_cost,
       ac.calculation_formula,
       ac.confidence_level
     FROM activity_costs ac
     INNER JOIN process_activities pa ON ac.process_activity_id = pa.process_activity_id
     INNER JOIN activities a ON pa.activity_id = a.activity_id
     INNER JOIN cost_pools cp ON a.cost_pool_id = cp.cost_pool_id
     INNER JOIN resource_drivers rd ON ac.resource_driver_id = rd.resource_driver_id
     INNER JOIN load_category_substances lcs ON ac.lcs_id = lcs.lcs_id
     INNER JOIN substances s ON lcs.substance_id = s.substance_id
     INNER JOIN load_categories lc ON lcs.load_category_id = lc.load_category_id
     WHERE pa.process_id = ?
     ORDER BY ac.environmental_cost DESC`,
    [processId]
  );

  // Step 3: Transform to ActivityCost objects
  const activities: ActivityCost[] = activityCostsData.map(row => ({
    activity_cost_id: row.activity_cost_id,
    activity_name: row.activity_name,
    activity_code: row.activity_code,
    cost_pool_name: row.cost_pool_name,
    cost_type: row.cost_type,
    driver_name: row.driver_name,
    driver_value: parseFloat(row.driver_value),
    driver_unit: row.driver_unit,
    driver_factor: parseFloat(row.driver_factor),
    substance_name: row.substance_name,
    load_category_name: row.load_category_name,
    resource_consumption: parseFloat(row.resource_consumption),
    consumption_unit: row.consumption_unit,
    environmental_cost: parseFloat(row.environmental_cost),
    calculation_formula: row.calculation_formula,
    confidence_level: row.confidence_level
  }));

  // Step 4: Calculate total cost
  const totalCost = activities.reduce((sum, act) => sum + act.environmental_cost, 0);

  // Step 5: Aggregate by cost pool
  const costPoolTotals = new Map<string, number>();
  const costPoolPercentages = new Map<string, number>();

  for (const activity of activities) {
    const current = costPoolTotals.get(activity.cost_pool_name) || 0;
    costPoolTotals.set(activity.cost_pool_name, current + activity.environmental_cost);
  }

  for (const [pool, cost] of costPoolTotals) {
    costPoolPercentages.set(pool, (cost / totalCost) * 100);
  }

  // Step 6: Driver analysis
  const driverMap = new Map<string, {
    total_value: number;
    unit: string;
    total_cost: number;
    activities_count: Set<string>;
  }>();

  for (const activity of activities) {
    if (!driverMap.has(activity.driver_name)) {
      driverMap.set(activity.driver_name, {
        total_value: 0,
        unit: activity.driver_unit,
        total_cost: 0,
        activities_count: new Set()
      });
    }

    const driver = driverMap.get(activity.driver_name)!;
    driver.total_value += activity.driver_value;
    driver.total_cost += activity.environmental_cost;
    driver.activities_count.add(activity.activity_name);
  }

  const driverAnalysis = Array.from(driverMap.entries()).map(([name, data]) => ({
    driver_name: name,
    total_value: data.total_value,
    unit: data.unit,
    cost_per_unit: data.total_cost / data.total_value,
    activities_using_driver: data.activities_count.size
  }));

  // Step 7: ABC Classification (Pareto 80-20 rule)
  const sortedActivities = [...activities].sort((a, b) =>
    b.environmental_cost - a.environmental_cost
  );

  let cumulativeCost = 0;
  const highImpact: ActivityCost[] = [];
  const mediumImpact: ActivityCost[] = [];
  const lowImpact: ActivityCost[] = [];

  for (const activity of sortedActivities) {
    cumulativeCost += activity.environmental_cost;
    const percentage = (cumulativeCost / totalCost) * 100;

    if (percentage <= 80) {
      highImpact.push(activity); // Top activities contributing to 80% of cost
    } else if (percentage <= 95) {
      mediumImpact.push(activity);
    } else {
      lowImpact.push(activity);
    }
  }

  return {
    process_id: process.process_id,
    process_name: process.process_name,
    total_environmental_cost: totalCost,
    activities,
    cost_pool_totals: costPoolTotals,
    cost_pool_percentages: costPoolPercentages,
    driver_analysis: driverAnalysis,
    high_impact_activities: highImpact,
    medium_impact_activities: mediumImpact,
    low_impact_activities: lowImpact
  };
}

// ============================================================================
// PRODUCT-LEVEL ABC ANALYSIS
// ============================================================================

/**
 * Calculate ABC costs for entire product
 */
export async function calculateProductABCCosts(
  productId: number,
  connection: Connection
): Promise<ProductABCResult> {

  // Get product info
  const [products] = await connection.query<RowDataPacket[]>(
    `SELECT product_id, product_name FROM product WHERE product_id = ?`,
    [productId]
  );

  if (products.length === 0) {
    throw new Error(`Product ${productId} not found`);
  }

  const product = products[0];

  // Get all processes
  const [processes] = await connection.query<RowDataPacket[]>(
    `SELECT process_id FROM process WHERE product_id = ?`,
    [productId]
  );

  // Calculate ABC for each process
  const processResults: ProcessABCResult[] = [];
  let totalProductCost = 0;
  const productCostPools = new Map<string, number>();

  for (const proc of processes) {
    const result = await calculateProcessABCCosts(proc.process_id, connection);
    processResults.push(result);

    totalProductCost += result.total_environmental_cost;

    // Aggregate cost pools
    for (const [pool, cost] of result.cost_pool_totals) {
      const current = productCostPools.get(pool) || 0;
      productCostPools.set(pool, current + cost);
    }
  }

  // Calculate cost pool percentages
  const costPoolPercentages = new Map<string, number>();
  for (const [pool, cost] of productCostPools) {
    costPoolPercentages.set(pool, (cost / totalProductCost) * 100);
  }

  // Aggregate activities across all processes
  const activityMap = new Map<string, {
    activity_code: string;
    total_cost: number;
    process_count: number;
  }>();

  for (const procResult of processResults) {
    for (const activity of procResult.activities) {
      if (!activityMap.has(activity.activity_name)) {
        activityMap.set(activity.activity_name, {
          activity_code: activity.activity_code,
          total_cost: 0,
          process_count: 0
        });
      }

      const agg = activityMap.get(activity.activity_name)!;
      agg.total_cost += activity.environmental_cost;
      agg.process_count++;
    }
  }

  // Create top activities list
  const topActivities = Array.from(activityMap.entries())
    .map(([name, data]) => ({
      activity_name: name,
      activity_code: data.activity_code,
      total_cost: data.total_cost,
      percentage_of_total: (data.total_cost / totalProductCost) * 100,
      process_count: data.process_count
    }))
    .sort((a, b) => b.total_cost - a.total_cost)
    .slice(0, 10); // Top 10 activities

  // Generate optimization opportunities
  const optimizationOpportunities = await generateOptimizationOpportunities(
    processResults,
    connection
  );

  // Calculate efficiency score
  const efficiencyScore = await calculateEfficiencyScore(processResults, connection);

  return {
    product_id: product.product_id,
    product_name: product.product_name,
    total_environmental_cost: totalProductCost,
    processes: processResults,
    total_cost_pools: productCostPools,
    cost_pool_percentages: costPoolPercentages,
    top_activities: topActivities,
    optimization_opportunities: optimizationOpportunities,
    efficiency_score: efficiencyScore,
    metadata: {
      calculation_timestamp: new Date(),
      total_activities: activityMap.size,
      total_cost_pools: productCostPools.size
    }
  };
}

// ============================================================================
// OPTIMIZATION & BENCHMARKING
// ============================================================================

/**
 * Generate optimization recommendations by comparing to benchmarks
 */
async function generateOptimizationOpportunities(
  processResults: ProcessABCResult[],
  connection: Connection
): Promise<any[]> {

  const opportunities: any[] = [];

  for (const procResult of processResults) {
    for (const activity of procResult.high_impact_activities) {

      // Get benchmark for this activity
      const [benchmarks] = await connection.query<RowDataPacket[]>(
        `SELECT
           ab.cost_per_driver_unit as benchmark_cost,
           ab.benchmark_type,
           ab.efficiency_rating
         FROM activity_benchmarks ab
         INNER JOIN activities a ON ab.activity_id = a.activity_id
         WHERE a.activity_code = ?
           AND ab.benchmark_type = 'Best Practice'
         LIMIT 1`,
        [activity.activity_code]
      );

      if (benchmarks.length > 0) {
        const benchmark = benchmarks[0];
        const currentCostPerUnit = activity.environmental_cost / activity.driver_value;
        const benchmarkCost = parseFloat(benchmark.benchmark_cost);

        if (currentCostPerUnit > benchmarkCost) {
          const savingsPotential = (currentCostPerUnit - benchmarkCost) * activity.driver_value;
          const savingsPercentage = ((currentCostPerUnit - benchmarkCost) / currentCostPerUnit) * 100;

          opportunities.push({
            activity_name: activity.activity_name,
            current_cost: activity.environmental_cost,
            benchmark_cost: benchmarkCost * activity.driver_value,
            savings_potential: savingsPotential,
            savings_percentage: savingsPercentage,
            recommendation: `Improve ${activity.activity_name} efficiency. Current: ${currentCostPerUnit.toFixed(2)} ELU per ${activity.driver_unit}, Best Practice: ${benchmarkCost.toFixed(2)} ELU per ${activity.driver_unit}`
          });
        }
      }
    }
  }

  return opportunities.sort((a, b) => b.savings_potential - a.savings_potential).slice(0, 5);
}

/**
 * Calculate overall efficiency score (0-100)
 */
async function calculateEfficiencyScore(
  processResults: ProcessABCResult[],
  connection: Connection
): Promise<number> {

  let totalScore = 0;
  let scoredActivities = 0;

  for (const procResult of processResults) {
    for (const activity of procResult.activities) {

      const [benchmarks] = await connection.query<RowDataPacket[]>(
        `SELECT ab.efficiency_rating
         FROM activity_benchmarks ab
         INNER JOIN activities a ON ab.activity_id = a.activity_id
         WHERE a.activity_code = ?
         LIMIT 1`,
        [activity.activity_code]
      );

      if (benchmarks.length > 0) {
        totalScore += parseFloat(benchmarks[0].efficiency_rating);
        scoredActivities++;
      }
    }
  }

  return scoredActivities > 0 ? totalScore / scoredActivities : 75; // Default 75
}

// ============================================================================
// COMPARISON FUNCTIONS
// ============================================================================

/**
 * Compare ABC costs between two products
 */
export async function compareProductsABCCosts(
  productId1: number,
  productId2: number,
  connection: Connection
): Promise<{
  product1: ProductABCResult;
  product2: ProductABCResult;
  comparison: {
    cost_difference: number;
    cost_difference_percentage: number;
    efficiency_difference: number;
    cost_pool_comparison: Map<string, { product1: number; product2: number; difference: number }>;
    activity_comparison: any[];
  };
}> {

  const product1 = await calculateProductABCCosts(productId1, connection);
  const product2 = await calculateProductABCCosts(productId2, connection);

  const costDifference = product1.total_environmental_cost - product2.total_environmental_cost;
  const costDifferencePercentage = (costDifference / product2.total_environmental_cost) * 100;
  const efficiencyDifference = product1.efficiency_score - product2.efficiency_score;

  // Compare cost pools
  const costPoolComparison = new Map<string, { product1: number; product2: number; difference: number }>();
  const allPools = new Set([
    ...product1.total_cost_pools.keys(),
    ...product2.total_cost_pools.keys()
  ]);

  for (const pool of allPools) {
    const p1Cost = product1.total_cost_pools.get(pool) || 0;
    const p2Cost = product2.total_cost_pools.get(pool) || 0;
    costPoolComparison.set(pool, {
      product1: p1Cost,
      product2: p2Cost,
      difference: p1Cost - p2Cost
    });
  }

  // Compare top activities
  const activityComparison = compareActivities(product1.top_activities, product2.top_activities);

  return {
    product1,
    product2,
    comparison: {
      cost_difference: costDifference,
      cost_difference_percentage: costDifferencePercentage,
      efficiency_difference: efficiencyDifference,
      cost_pool_comparison: costPoolComparison,
      activity_comparison: activityComparison
    }
  };
}

function compareActivities(activities1: any[], activities2: any[]): any[] {
  const comparison: any[] = [];

  const activityMap1 = new Map(activities1.map(a => [a.activity_code, a]));
  const activityMap2 = new Map(activities2.map(a => [a.activity_code, a]));

  const allCodes = new Set([...activityMap1.keys(), ...activityMap2.keys()]);

  for (const code of allCodes) {
    const act1 = activityMap1.get(code);
    const act2 = activityMap2.get(code);

    if (act1 && act2) {
      comparison.push({
        activity_name: act1.activity_name,
        activity_code: code,
        product1_cost: act1.total_cost,
        product2_cost: act2.total_cost,
        difference: act1.total_cost - act2.total_cost,
        difference_percentage: ((act1.total_cost - act2.total_cost) / act2.total_cost) * 100
      });
    }
  }

  return comparison.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
}
```

---

## 6. UI/UX for ABC Features

### 6.1 ABC Dashboard Wireframe

```
┌────────────────────────────────────────────────────────────────┐
│  ABC Analysis Dashboard - Electric Scooter Model X             │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📊 Summary Metrics                                            │
│  ┌──────────────┬──────────────┬──────────────┬─────────────┐│
│  │ Total Cost   │ Activities   │ Cost Pools   │ Efficiency  ││
│  │ 310.3 ELU    │ 12           │ 4            │ 78/100      ││
│  └──────────────┴──────────────┴──────────────┴─────────────┘│
│                                                                 │
│  🎯 Cost Pool Distribution (Pie Chart)                         │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │     Manufacturing: 95.5% (296.24 ELU)                   │  │
│  │     Energy: 4.5% (14.06 ELU)                            │  │
│  │                                                          │  │
│  │         [Visual Pie Chart Here]                         │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  📈 Top Activities by Cost (Bar Chart)                         │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Component Soldering  ████████████████████████ 288.44   │  │
│  │  Welding - Energy     ██ 14.06                          │  │
│  │  Welding - Material   █ 7.8                             │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ⚡ Optimization Opportunities                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  1. Improve Component Soldering efficiency              │  │
│  │     Current: 1.92 ELU/cm² | Best: 1.50 ELU/cm²         │  │
│  │     Potential Savings: 63 ELU (22%)          [Details]  │  │
│  │                                                          │  │
│  │  2. Optimize Welding energy consumption                 │  │
│  │     Current: 5.62 ELU/hour | Best: 4.50 ELU/hour       │  │
│  │     Potential Savings: 2.8 ELU (20%)         [Details]  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  📋 Activity Breakdown Table                                   │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Activity         │ Cost Pool  │ Driver    │ Cost │ %    │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │ Comp. Soldering │ Mfg        │ 150 cm²   │ 288.44│92.9%│  │
│  │ Welding Energy  │ Mfg        │ 2.5 hrs   │ 14.06│ 4.5%│  │
│  │ Welding Material│ Mfg        │ 50 inches │ 7.8  │ 2.5%│  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [Export Report] [Compare Products] [What-If Analysis]         │
└────────────────────────────────────────────────────────────────┘
```

### 6.2 React Component Structure

```typescript
/**
 * ABC DASHBOARD COMPONENTS
 * File: components/abc-dashboard.tsx
 */

import React from 'react';
import { ProductABCResult } from '@/lib/types/abc-costing';
import { PieChart, BarChart, DataTable } from '@/components/charts';

interface ABCDashboardProps {
  productId: number;
}

export function ABCDashboard({ productId }: ABCDashboardProps) {
  const [abcData, setABCData] = React.useState<ProductABCResult | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchABCData();
  }, [productId]);

  const fetchABCData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/abc/product/${productId}`);
      const data = await response.json();
      setABCData(data);
    } catch (error) {
      console.error('Failed to fetch ABC data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!abcData) return <ErrorMessage />;

  return (
    <div className="abc-dashboard">
      {/* Summary Metrics */}
      <SummaryMetrics data={abcData} />

      {/* Cost Pool Distribution */}
      <CostPoolDistribution
        costPools={abcData.total_cost_pools}
        percentages={abcData.cost_pool_percentages}
      />

      {/* Top Activities */}
      <TopActivitiesChart activities={abcData.top_activities} />

      {/* Optimization Opportunities */}
      <OptimizationOpportunities
        opportunities={abcData.optimization_opportunities}
      />

      {/* Activity Breakdown Table */}
      <ActivityBreakdownTable processes={abcData.processes} />

      {/* Actions */}
      <ActionButtons productId={productId} />
    </div>
  );
}

function SummaryMetrics({ data }: { data: ProductABCResult }) {
  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <MetricCard
        title="Total Cost"
        value={`${data.total_environmental_cost.toFixed(2)} ELU`}
        icon="💰"
      />
      <MetricCard
        title="Activities"
        value={data.metadata.total_activities}
        icon="📊"
      />
      <MetricCard
        title="Cost Pools"
        value={data.metadata.total_cost_pools}
        icon="🎯"
      />
      <MetricCard
        title="Efficiency"
        value={`${data.efficiency_score.toFixed(0)}/100`}
        icon="⚡"
        color={data.efficiency_score >= 80 ? 'green' : data.efficiency_score >= 60 ? 'yellow' : 'red'}
      />
    </div>
  );
}

function CostPoolDistribution({ costPools, percentages }: any) {
  const chartData = Array.from(costPools.entries()).map(([pool, cost]) => ({
    name: pool,
    value: cost,
    percentage: percentages.get(pool)
  }));

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-4">Cost Pool Distribution</h3>
      <PieChart
        data={chartData}
        dataKey="value"
        nameKey="name"
        showPercentage={true}
      />
    </div>
  );
}

function TopActivitiesChart({ activities }: any) {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-4">Top Activities by Cost</h3>
      <BarChart
        data={activities}
        xKey="activity_name"
        yKey="total_cost"
        yLabel="Environmental Cost (ELU)"
      />
    </div>
  );
}

function OptimizationOpportunities({ opportunities }: any) {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-4">⚡ Optimization Opportunities</h3>
      <div className="space-y-3">
        {opportunities.map((opp: any, index: number) => (
          <OpportunityCard key={index} opportunity={opp} rank={index + 1} />
        ))}
      </div>
    </div>
  );
}

function OpportunityCard({ opportunity, rank }: any) {
  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h4 className="font-medium">
            {rank}. {opportunity.activity_name}
          </h4>
          <p className="text-sm text-gray-600 mt-1">
            {opportunity.recommendation}
          </p>
          <div className="mt-2 text-sm">
            <span className="font-medium">Potential Savings:</span>
            <span className="ml-2 text-green-600">
              {opportunity.savings_potential.toFixed(2)} ELU
              ({opportunity.savings_percentage.toFixed(1)}%)
            </span>
          </div>
        </div>
        <button className="ml-4 px-3 py-1 text-sm border rounded hover:bg-gray-50">
          Details
        </button>
      </div>
    </div>
  );
}

function ActivityBreakdownTable({ processes }: any) {
  const allActivities = processes.flatMap((proc: any) =>
    proc.activities.map((act: any) => ({
      ...act,
      process_name: proc.process_name
    }))
  );

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-4">Activity Breakdown</h3>
      <DataTable
        columns={[
          { key: 'activity_name', label: 'Activity' },
          { key: 'cost_pool_name', label: 'Cost Pool' },
          { key: 'driver_info', label: 'Driver',
            render: (act: any) => `${act.driver_value} ${act.driver_unit}` },
          { key: 'environmental_cost', label: 'Cost (ELU)',
            render: (act: any) => act.environmental_cost.toFixed(2) },
          { key: 'percentage', label: '%',
            render: (act: any) => {
              const total = allActivities.reduce((sum, a) => sum + a.environmental_cost, 0);
              return `${((act.environmental_cost / total) * 100).toFixed(1)}%`;
            }
          }
        ]}
        data={allActivities}
        sortable={true}
        filterable={true}
      />
    </div>
  );
}

function ActionButtons({ productId }: { productId: number }) {
  return (
    <div className="flex gap-3">
      <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
        Export Report
      </button>
      <button className="px-4 py-2 border rounded hover:bg-gray-50">
        Compare Products
      </button>
      <button className="px-4 py-2 border rounded hover:bg-gray-50">
        What-If Analysis
      </button>
    </div>
  );
}
```

### 6.3 API Endpoints for ABC

```typescript
/**
 * ABC API ENDPOINTS
 * File: app/api/abc/product/[productId]/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { calculateProductABCCosts } from '@/lib/abc-costing-engine';

export async function GET(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const productId = parseInt(params.productId);

    if (isNaN(productId)) {
      return NextResponse.json(
        { error: 'Invalid product ID' },
        { status: 400 }
      );
    }

    const connection = await getConnection();

    try {
      const result = await calculateProductABCCosts(productId, connection);

      return NextResponse.json({
        success: true,
        data: {
          ...result,
          // Convert Maps to Objects for JSON serialization
          total_cost_pools: Object.fromEntries(result.total_cost_pools),
          cost_pool_percentages: Object.fromEntries(result.cost_pool_percentages)
        }
      });

    } finally {
      await connection.end();
    }

  } catch (error) {
    console.error('ABC calculation error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate ABC costs', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Compare two products ABC costs
 * File: app/api/abc/compare/route.ts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { product1_id, product2_id } = body;

    if (!product1_id || !product2_id) {
      return NextResponse.json(
        { error: 'Both product IDs are required' },
        { status: 400 }
      );
    }

    const connection = await getConnection();

    try {
      const result = await compareProductsABCCosts(
        product1_id,
        product2_id,
        connection
      );

      return NextResponse.json({
        success: true,
        data: result
      });

    } finally {
      await connection.end();
    }

  } catch (error) {
    console.error('ABC comparison error:', error);
    return NextResponse.json(
      { error: 'Failed to compare ABC costs', details: error.message },
      { status: 500 }
    );
  }
}
```

---

## 7. ABC Reporting & Analytics

### 7.1 ABC Report Template

```markdown
# Activity-Based Costing (ABC) Report

**Product**: Electric Scooter Model X
**Date**: January 17, 2025
**Total Environmental Cost**: 310.3 ELU
**Efficiency Score**: 78/100

---

## Executive Summary

This report provides an activity-based breakdown of environmental costs for the Electric Scooter Model X. The analysis identifies key cost drivers and optimization opportunities to reduce environmental impact.

### Key Findings

1. **Component Soldering** accounts for 92.9% of total environmental cost (288.44 ELU)
2. **Manufacturing activities** represent 95.5% of cost pool distribution
3. **3 high-impact optimization opportunities** identified with potential savings of 65.8 ELU (21.2%)

---

## Cost Pool Distribution

| Cost Pool | Cost (ELU) | Percentage | Activities |
|-----------|-----------|------------|------------|
| Manufacturing | 296.24 | 95.5% | 3 |
| Energy | 14.06 | 4.5% | 1 |
| **Total** | **310.3** | **100%** | **4** |

---

## Activity-Level Breakdown

### High-Impact Activities (80% of costs)

| Activity | Cost Pool | Driver | Cost (ELU) | % of Total |
|----------|-----------|--------|-----------|------------|
| Component Soldering | Manufacturing | 150 cm² | 288.44 | 92.9% |
| Welding - Energy | Manufacturing | 2.5 hours | 14.06 | 4.5% |

### Medium-Impact Activities

| Activity | Cost Pool | Driver | Cost (ELU) | % of Total |
|----------|-----------|--------|-----------|------------|
| Welding - Material | Manufacturing | 50 inches | 7.8 | 2.5% |

---

## Driver Analysis

### Cost per Driver Unit

| Driver | Total Value | Unit | Total Cost (ELU) | Cost/Unit |
|--------|------------|------|------------------|-----------|
| Board Area | 150 | cm² | 288.44 | 1.92 |
| Operation Time | 2.5 | hours | 14.06 | 5.62 |
| Weld Length | 50 | inches | 7.8 | 0.156 |

---

## Optimization Opportunities

### 1. Improve Component Soldering Efficiency

**Current Performance**:
- Cost per cm²: 1.92 ELU/cm²
- Total Cost: 288.44 ELU

**Best Practice Benchmark**:
- Cost per cm²: 1.50 ELU/cm²
- Expected Cost: 225.00 ELU

**Savings Potential**: 63.44 ELU (22.0%)

**Recommendations**:
- Reduce copper consumption per unit area
- Optimize soldering temperature and time
- Implement lead-free solder with lower environmental impact

### 2. Optimize Welding Energy Consumption

**Current Performance**:
- Cost per hour: 5.62 ELU/hour
- Total Cost: 14.06 ELU

**Best Practice Benchmark**:
- Cost per hour: 4.50 ELU/hour
- Expected Cost: 11.25 ELU

**Savings Potential**: 2.81 ELU (20.0%)

**Recommendations**:
- Use more energy-efficient welding equipment
- Reduce welding time through process optimization
- Consider renewable energy sources

---

## Comparison to Benchmarks

| Metric | Current | Industry Avg | Best Practice | Gap |
|--------|---------|-------------|---------------|-----|
| Total Cost | 310.3 ELU | 280.0 ELU | 245.5 ELU | +26.4% |
| Efficiency Score | 78/100 | 75/100 | 90/100 | -12 points |
| Cost per Unit | 310.3 ELU | 280.0 ELU | 245.5 ELU | +26.4% |

---

## Conclusions

The ABC analysis reveals that:

1. **Component Soldering** is the primary cost driver and should be the focus of optimization efforts
2. The product performs slightly below industry average, with significant room for improvement
3. Implementing recommended optimizations could reduce environmental cost by 21.2%

---

## Next Steps

1. **Immediate**: Investigate component soldering process for efficiency improvements
2. **Short-term**: Implement energy-efficient welding equipment
3. **Medium-term**: Benchmark against best-in-class products
4. **Long-term**: Establish continuous improvement program based on ABC insights

---

*Generated by LCA Project v3 ABC Analysis Module*
```

---

## 8. Integration Roadmap

### 8.1 Phase 1: ABC Database Schema (Week 1-2)

**Tasks**:
1. Create ABC tables (cost_pools, activities, resource_drivers, etc.)
2. Populate with standard activities and drivers
3. Migrate existing process data to ABC structure
4. Set up activity benchmarks from industry data

**Deliverables**:
- [ ] ABC schema migration script
- [ ] Standard activities seed data (50+ activities)
- [ ] Standard drivers seed data (20+ drivers)
- [ ] Initial benchmarks (industry averages)

### 8.2 Phase 2: ABC Calculation Engine (Week 3-4)

**Tasks**:
1. Implement ABC calculation functions
2. Add activity cost tracking
3. Build cost pool aggregation
4. Create driver analysis functions
5. Implement Pareto (80-20) classification
6. Add benchmarking comparison

**Deliverables**:
- [ ] ABC calculation engine (`lib/abc-costing-engine.ts`)
- [ ] Type definitions (`lib/types/abc-costing.ts`)
- [ ] Unit tests (>85% coverage)
- [ ] API endpoints

### 8.3 Phase 3: ABC UI Components (Week 5-6)

**Tasks**:
1. Build ABC dashboard
2. Create cost pool visualizations
3. Add activity breakdown tables
4. Implement optimization opportunities display
5. Create comparison views
6. Add what-if analysis tool

**Deliverables**:
- [ ] ABC dashboard component
- [ ] Chart components (pie, bar, Pareto)
- [ ] Data tables with sorting/filtering
- [ ] Product comparison UI
- [ ] Export report functionality

### 8.4 Phase 4: ABC Reporting (Week 7)

**Tasks**:
1. Design ABC report templates
2. Implement PDF export
3. Add Excel export with activity breakdown
4. Create email report scheduling
5. Build custom report builder

**Deliverables**:
- [ ] PDF report generator
- [ ] Excel export with multiple sheets
- [ ] Report scheduling system
- [ ] Custom report templates

### 8.5 Phase 5: Integration & Testing (Week 8-10)

**Tasks**:
1. Integrate ABC with existing CML/EPS engines
2. Add ABC toggle in UI
3. Cross-validation between methodologies
4. Performance optimization
5. User acceptance testing
6. Documentation

**Deliverables**:
- [ ] Full integration complete
- [ ] Performance benchmarks met
- [ ] User documentation
- [ ] Training materials
- [ ] Admin guide

### 8.6 Estimated Timeline

```
Week 1-2:  ABC Database Schema
Week 3-4:  ABC Calculation Engine
Week 5-6:  ABC UI Components
Week 7:    ABC Reporting
Week 8-10: Integration & Testing

Total: 10 weeks (2.5 months)
```

### 8.7 Success Criteria

**Functional Requirements**:
- ✅ Calculate activity-level environmental costs
- ✅ Aggregate costs by activity, process, cost pool, product
- ✅ Identify top activities (Pareto analysis)
- ✅ Compare against benchmarks
- ✅ Generate optimization recommendations
- ✅ Compare products using ABC
- ✅ Export ABC reports (PDF, Excel)

**Performance Requirements**:
- ✅ ABC calculation < 3 seconds for 100 activities
- ✅ Dashboard load < 2 seconds
- ✅ Report generation < 5 seconds

**User Experience**:
- ✅ Intuitive ABC dashboard
- ✅ Clear activity-level insights
- ✅ Actionable optimization recommendations
- ✅ Easy product comparison

---

## Appendix: ABC vs Traditional Costing Example

### Traditional Flow-Based Costing (Current CML)

```
Product A Manufacturing Cost:
├─ Component 1: 100 kg CO₂-eq
├─ Component 2: 150 kg CO₂-eq
├─ Component 3: 200 kg CO₂-eq
└─ Total: 450 kg CO₂-eq

Problem: Can't answer questions like:
- Which activities contribute most?
- How efficient is our welding vs competitors?
- What if we reduce welding time by 20%?
```

### ABC Environmental Costing (New Approach)

```
Product A Manufacturing Cost:
├─ Manufacturing Pool (300 kg CO₂-eq, 66.7%)
│  ├─ Welding Activity: 180 kg (60% of pool)
│  │  ├─ Energy consumption: 120 kg (2.5 hrs × 48 kg/hr)
│  │  └─ Material consumption: 60 kg (50 inches × 1.2 kg/inch)
│  ├─ Cutting Activity: 80 kg (26.7% of pool)
│  │  └─ Energy consumption: 80 kg (1.5 hrs × 53.3 kg/hr)
│  └─ Drilling Activity: 40 kg (13.3% of pool)
│     └─ Energy consumption: 40 kg (0.8 hrs × 50 kg/hr)
│
├─ Assembly Pool (100 kg CO₂-eq, 22.2%)
│  └─ Component Assembly: 100 kg
│     ├─ Energy consumption: 60 kg
│     └─ Adhesive materials: 40 kg
│
└─ Packaging Pool (50 kg CO₂-eq, 11.1%)
   └─ Primary Packaging: 50 kg
      └─ Material consumption: 50 kg

Total: 450 kg CO₂-eq

Now we can answer:
✅ Welding is 40% of total cost - highest priority
✅ Our welding uses 48 kg/hr vs industry avg of 40 kg/hr - 20% worse
✅ If we reduce welding time 20%, we save 24 kg CO₂-eq (5.3% total)
✅ Comparing to Product B shows their drilling is more efficient
```

**Key Insight**: ABC provides actionable intelligence, not just totals.

---

**End of Document**
