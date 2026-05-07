-- Currency Support Migration
-- Removes _usd suffix from cost columns and adds currency field

-- Rename cost columns to remove _usd suffix
ALTER TABLE component
CHANGE COLUMN labor_cost_usd labor_cost DECIMAL(15,2) NULL COMMENT 'Labor and personnel costs',
CHANGE COLUMN energy_cost_usd energy_cost DECIMAL(15,2) NULL COMMENT 'Energy and utilities costs',
CHANGE COLUMN transportation_cost_usd transportation_cost DECIMAL(15,2) NULL COMMENT 'Transportation and logistics costs',
CHANGE COLUMN material_cost_usd material_cost DECIMAL(15,2) NULL COMMENT 'Raw materials and supplies costs',
CHANGE COLUMN equipment_cost_usd equipment_cost DECIMAL(15,2) NULL COMMENT 'Equipment and machinery costs',
CHANGE COLUMN overhead_cost_usd overhead_cost DECIMAL(15,2) NULL COMMENT 'Administrative and overhead costs';

-- Add currency column with USD as default
ALTER TABLE component
ADD COLUMN currency VARCHAR(3) DEFAULT 'USD' COMMENT 'Currency code (ISO 4217)' AFTER overhead_cost;

-- Add index for currency queries
CREATE INDEX idx_component_currency ON component(currency);

-- Update existing records to have USD currency
UPDATE component SET currency = 'USD' WHERE currency IS NULL;
