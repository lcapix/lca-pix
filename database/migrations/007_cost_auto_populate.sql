-- 007_cost_auto_populate.sql
-- Add columns needed for auto-populating costs from BLS + EIA

-- Component: labor occupation + hours
ALTER TABLE component
  ADD COLUMN labor_occupation VARCHAR(10) NULL COMMENT 'BLS OEWS code e.g. 51-4121' AFTER driver_type,
  ADD COLUMN labor_hours DECIMAL(10,4) NULL AFTER labor_occupation;

-- Case: region code (so auto-populate knows which US state to query BLS/EIA with)
ALTER TABLE case_table
  ADD COLUMN region_code VARCHAR(20) NULL AFTER description;
