-- Migration: Add ABC Cost Breakdown Fields to Component Table
-- Date: 2025-01-12
-- Description: Adds 6 detailed cost category columns for Activity-Based Costing analysis

-- Add detailed cost breakdown columns
ALTER TABLE component
ADD COLUMN labor_cost_usd DECIMAL(15,2) NULL COMMENT 'Labor and personnel costs',
ADD COLUMN energy_cost_usd DECIMAL(15,2) NULL COMMENT 'Energy and utilities costs',
ADD COLUMN transportation_cost_usd DECIMAL(15,2) NULL COMMENT 'Transportation and logistics costs',
ADD COLUMN material_cost_usd DECIMAL(15,2) NULL COMMENT 'Raw materials and supplies costs',
ADD COLUMN equipment_cost_usd DECIMAL(15,2) NULL COMMENT 'Equipment and machinery costs',
ADD COLUMN overhead_cost_usd DECIMAL(15,2) NULL COMMENT 'Administrative and overhead costs';

-- Add cost allocation tracking
ALTER TABLE component
ADD COLUMN cost_allocation_type ENUM('manual', 'calculated', 'allocated')
DEFAULT 'manual'
COMMENT 'Indicates how costs were determined: manual (user-entered), calculated (auto-computed), or allocated (from cost pool)';

-- Add index for cost queries
CREATE INDEX idx_component_costs ON component(opex, capex);

-- Add comments for existing cost columns for clarity
ALTER TABLE component
MODIFY COLUMN opex DECIMAL(15,2) NULL COMMENT 'Total operational expenditure in USD (sum of cost categories or direct entry)',
MODIFY COLUMN capex DECIMAL(15,2) NULL COMMENT 'Total capital expenditure in USD';
