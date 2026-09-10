-- Migration 009 — factor basis + audited factor corrections (2026-09-09)
-- Additive only. Two jobs:
--   1) factor_basis column: 'embodied' factors charge INPUT flows (producing /
--      supplying the substance); 'elementary' factors charge OUTPUT flows
--      (emitting the substance, or treating it as waste). Ends the
--      both-directions double counting.
--   2) Audited corrections. Every changed value carries its source in
--      source_reference. Rows that were demonstrably wrong (wrong unit for the
--      category, or physically absurd) and have no authoritative replacement
--      are ZEROED with an audit note — visible in the flow table, never
--      silently kept.
-- Ground-truth sources:
--   [EPA-HUB-2025]  EPA GHG Emission Factors Hub 2025: natural gas stationary
--                   combustion 53.06 kg CO2/MMBtu (= 1.877 kg/m3 at 28.263 m3/MMBtu).
--   [EGRID-2023]    EPA eGRID 2023 US national average: 0.350 kg CO2e/kWh.
--   [EMBER-2024]    Ember Global Electricity Review: 2024 global average
--                   intensity 473 gCO2/kWh.
--   [IPCC-AR5]      IPCC AR5 GWP100: CH4 = 28, N2O = 265, R-410A = 1924.

-- 1) Basis column ------------------------------------------------------------
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'driver_impact_factors'
             AND COLUMN_NAME = 'factor_basis');
SET @sql := IF(@c = 0,
  'ALTER TABLE driver_impact_factors ADD COLUMN factor_basis ENUM(''embodied'',''elementary'') NULL COMMENT ''embodied: charge input flows (production). elementary: charge output flows (emission/waste treatment).''',
  'SELECT ''factor_basis exists''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Emissions + waste-handling substances → elementary (charged on outputs)
UPDATE driver_impact_factors dif
  JOIN substances s ON s.substance_id = dif.substance_id
  SET dif.factor_basis = 'elementary'
  WHERE s.substance_name IN (
    'Carbon Dioxide','Methane','Nitrous Oxide','Nitrogen Oxides',
    'Sulfur Dioxide','Particulate Matter (PM2.5)','Wastewater','Solid Waste'
  );

-- Materials, energy carriers, transport services, water supply → embodied
UPDATE driver_impact_factors dif
  JOIN substances s ON s.substance_id = dif.substance_id
  SET dif.factor_basis = 'embodied'
  WHERE dif.factor_basis IS NULL;

-- 2) Corrections -------------------------------------------------------------

-- 2a. Methane GWP100 was ~0.056 (500x too LOW). IPCC AR5 GWP100 = 28.
UPDATE driver_impact_factors dif
  JOIN substances s ON s.substance_id = dif.substance_id
  JOIN impact_categories ic ON ic.category_id = dif.category_id
  SET dif.factor_value = 28, dif.unit = 'kg CO2 eq / kg',
      dif.source_reference = 'IPCC AR5 GWP100 (CH4=28); audit 2026-09-09, was 0.056-0.062'
  WHERE s.substance_name = 'Methane' AND ic.category_name = 'Global Warming';

-- 2b. Electricity, Global scope: harmonize GW to Ember 2024 world average.
UPDATE driver_impact_factors dif
  JOIN substances s ON s.substance_id = dif.substance_id
  JOIN impact_categories ic ON ic.category_id = dif.category_id
  SET dif.factor_value = 0.473, dif.unit = 'kg CO2 eq / kWh',
      dif.source_reference = 'Ember Global Electricity Review (2024 avg 473 gCO2/kWh) [EMBER-2024]; audit 2026-09-09'
  WHERE s.substance_name = 'Electricity' AND ic.category_name = 'Global Warming'
    AND dif.geographic_scope = 'Global';

-- 2c. Electricity, US scope (NEW rows, one per method): eGRID 2023 US average.
INSERT INTO driver_impact_factors
  (substance_id, category_id, method_name, geographic_scope, factor_value, unit, factor_basis, source_reference)
SELECT s.substance_id, ic.category_id, m.method_name, 'US', 0.350, 'kg CO2 eq / kWh', 'embodied',
       'EPA eGRID 2023 US national average (0.350 kg CO2e/kWh) [EGRID-2023]; added by audit 2026-09-09'
FROM substances s
JOIN impact_categories ic ON ic.category_name = 'Global Warming'
JOIN (SELECT 'CML 2001' AS method_name UNION SELECT 'ReCiPe Midpoint (H)' UNION SELECT 'TRACI 2.1') m
WHERE s.substance_name = 'Electricity'
  AND NOT EXISTS (
    SELECT 1 FROM driver_impact_factors x
     WHERE x.substance_id = s.substance_id AND x.category_id = ic.category_id
       AND x.method_name = m.method_name AND x.geographic_scope = 'US');

-- 2d. Natural Gas GW: was 2.8 labeled "/ kg" while the substance is metered in
-- m3. Set to EPA stationary-combustion value per m3. NOTE: combustion only —
-- upstream (production/transmission) is a documented future addition.
UPDATE driver_impact_factors dif
  JOIN substances s ON s.substance_id = dif.substance_id
  JOIN impact_categories ic ON ic.category_id = dif.category_id
  SET dif.factor_value = 1.877, dif.unit = 'kg CO2 eq / m3',
      dif.source_reference = 'EPA GHG Emission Factors Hub 2025: 53.06 kg CO2/MMBtu / 28.263 m3/MMBtu [EPA-HUB-2025]; combustion only, upstream excluded; audit 2026-09-09, was 2.8 per kg-labeled row'
  WHERE s.substance_name = 'Natural Gas' AND ic.category_name = 'Global Warming';

-- 2e. Wrong-unit / absurd rows with no authoritative replacement → zero + note.
-- Natural Gas "Photochemical Oxidation" carried kg Sb eq (a Resource Depletion unit).
UPDATE driver_impact_factors dif
  JOIN substances s ON s.substance_id = dif.substance_id
  JOIN impact_categories ic ON ic.category_id = dif.category_id
  SET dif.factor_value = 0,
      dif.source_reference = 'ZEROED by audit 2026-09-09: value 0.035 carried unit kg Sb eq (wrong category unit); no sourced replacement yet'
  WHERE s.substance_name = 'Natural Gas' AND ic.category_name = 'Photochemical Oxidation';

-- Solid Waste "Ozone Depletion" 1.0 kg SO2 eq: wrong unit AND ~6 orders of
-- magnitude absurd (this row alone produced 65 kg CFC-11 eq in a live test).
UPDATE driver_impact_factors dif
  JOIN substances s ON s.substance_id = dif.substance_id
  JOIN impact_categories ic ON ic.category_id = dif.category_id
  SET dif.factor_value = 0,
      dif.source_reference = 'ZEROED by audit 2026-09-09: value 1.0 carried unit kg SO2 eq under Ozone Depletion; physically baseless'
  WHERE s.substance_name = 'Solid Waste' AND ic.category_name = 'Ozone Depletion';

-- Water GW 3.4 "per kg": ~4 orders of magnitude above municipal water supply
-- footprints; substance is metered in m3. Zero until a sourced supply factor
-- is imported.
UPDATE driver_impact_factors dif
  JOIN substances s ON s.substance_id = dif.substance_id
  JOIN impact_categories ic ON ic.category_id = dif.category_id
  SET dif.factor_value = 0,
      dif.source_reference = 'ZEROED by audit 2026-09-09: 3.4 kg CO2e per kg of water is physically absurd; sourced municipal-supply factor pending'
  WHERE s.substance_name = 'Water' AND ic.category_name = 'Global Warming';

UPDATE driver_impact_factors dif
  JOIN substances s ON s.substance_id = dif.substance_id
  JOIN impact_categories ic ON ic.category_id = dif.category_id
  SET dif.factor_value = 0,
      dif.source_reference = 'ZEROED by audit 2026-09-09: kg Sb eq unit under Photochemical Oxidation (wrong category unit)'
  WHERE s.substance_name = 'Water' AND ic.category_name = 'Photochemical Oxidation';

-- Wastewater: Acidification row carried kg PO4 eq (eutrophication unit);
-- Ozone Depletion 0.7 kg SO2 eq is wrong-unit + baseless.
UPDATE driver_impact_factors dif
  JOIN substances s ON s.substance_id = dif.substance_id
  JOIN impact_categories ic ON ic.category_id = dif.category_id
  SET dif.factor_value = 0,
      dif.source_reference = 'ZEROED by audit 2026-09-09: wrong category unit (kg PO4 eq under Acidification); no sourced replacement yet'
  WHERE s.substance_name = 'Wastewater' AND ic.category_name = 'Acidification';

UPDATE driver_impact_factors dif
  JOIN substances s ON s.substance_id = dif.substance_id
  JOIN impact_categories ic ON ic.category_id = dif.category_id
  SET dif.factor_value = 0,
      dif.source_reference = 'ZEROED by audit 2026-09-09: 0.7 kg SO2 eq under Ozone Depletion; wrong unit, physically baseless'
  WHERE s.substance_name = 'Wastewater' AND ic.category_name = 'Ozone Depletion';

-- 2f. R-410A refrigerant GWP sanity: if present and far from AR5, set 1924.
UPDATE driver_impact_factors dif
  JOIN substances s ON s.substance_id = dif.substance_id
  JOIN impact_categories ic ON ic.category_id = dif.category_id
  SET dif.factor_value = 1924, dif.unit = 'kg CO2 eq / kg',
      dif.source_reference = 'IPCC AR5 GWP100 R-410A = 1924 [IPCC-AR5]; audit 2026-09-09'
  WHERE s.substance_name = 'Refrigerant R-410A' AND ic.category_name = 'Global Warming'
    AND (dif.factor_value < 1000 OR dif.factor_value > 2500);

-- Legacy rows not touched above keep their values; they are marked as
-- unverified so the UI can show honest provenance.
UPDATE driver_impact_factors
  SET source_reference = CONCAT(IFNULL(source_reference,''),
      CASE WHEN source_reference IS NULL OR source_reference = ''
           THEN 'legacy pack value; not yet verified against an authoritative source (audit 2026-09-09)'
           ELSE '' END)
  WHERE source_reference IS NULL OR source_reference = '';
