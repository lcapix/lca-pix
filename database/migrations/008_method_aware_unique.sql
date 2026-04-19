-- 008_method_aware_unique.sql
-- The existing unique key on driver_impact_factors is (substance_id, category_id),
-- which prevents storing factors for the same substance/category across different
-- valuation methods (CML 2001, ReCiPe, TRACI). Drop it and replace with a
-- method-aware unique key that also includes geographic_scope (so region-specific
-- factors can coexist with Global).

-- Drop existing unique key
ALTER TABLE driver_impact_factors DROP INDEX unique_substance_category;

-- Add new unique key that includes method and region
ALTER TABLE driver_impact_factors
  ADD UNIQUE KEY unique_substance_category_method_region
    (substance_id, category_id, method_name, geographic_scope);
