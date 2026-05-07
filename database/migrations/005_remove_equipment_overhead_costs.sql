-- Remove Equipment and Overhead Cost Fields
-- Date: 2025-12-02
-- Description: Removes equipment_cost and overhead_cost columns from component table
--              as cost tracking is now consolidated into labor, energy, transportation,
--              material, opex, and capex fields

-- Drop equipment_cost column
ALTER TABLE component
DROP COLUMN equipment_cost;

-- Drop overhead_cost column
ALTER TABLE component
DROP COLUMN overhead_cost;

-- Update capex comment to reflect that it may include equipment costs
ALTER TABLE component
MODIFY COLUMN capex DECIMAL(15,2) NULL COMMENT 'Capital Expenditure (may include equipment and infrastructure costs)';

-- Update opex comment to reflect that it may include overhead costs
ALTER TABLE component
MODIFY COLUMN opex DECIMAL(15,2) NULL COMMENT 'Operational Expenditure (may include overhead and recurring costs)';
