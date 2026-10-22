-- migrate-025-material-variants.sql  (idempotent; needs migrate-022 for the
-- variant columns, and migrate-016 for the parent material rows)
--
-- Material variants, so "switch to recycled" is a choice in the picker instead
-- of a hand edit, and so a student can see what the production route does to a
-- result.
--
-- Every value below is printed in a public document, quoted as printed, with
-- the conversion shown. Nothing here is interpolated, scaled or assumed.
--
-- STEEL — worldsteel, Sustainability Indicators 2024 report, table
-- "CO2 emissions and energy intensity, 2021-2023", CO2 emissions intensity by
-- production route, tonnes CO2 per tonne of crude steel cast, 2023 column:
--     Global average 1.92 · BF-BOF 2.32 · Scrap-EAF 0.70 · DRI-EAF 1.43
-- Tonnes CO2 per tonne is numerically kg CO2 per kg, so no conversion is
-- needed. These are worldsteel's CO2 data-collection indicators (scope 1, 2 and
-- some scope 3) per tonne of crude steel cast, which is the same series the
-- existing 'Steel' row (1.9) came from, so parent and variants are comparable.
-- They are NOT characterized LCIA results, and each row says so.
--
-- 'Aluminum, primary' already exists and 28 flows point at it, so it is given
-- the sourced value in place rather than being replaced by a new substance:
-- every case keeps working and the number gains a citation.
--
-- ALUMINIUM — US EPA WARM Version 16, Metals chapter (December 2023),
-- Exhibit 2-23 "Differences in Emissions between Recycled and Virgin Metals
-- Manufacture (MTCO2E/Short Ton)", Aluminum Ingot row:
--     100% virgin inputs:   7.48  (process 4.23 + transport 0.07 + non-energy 3.18)
--     100% recycled inputs: 0.27  (process 0.23 + transport 0.04 + non-energy 0)
-- Conversion: 1 short ton = 907.18474 kg, so kg CO2e/kg = MTCO2E/ton x 1.102311.
--     7.48 x 1.102311 = 8.245    0.27 x 1.102311 = 0.2976
-- WARM's aluminium smelting grid is about 67.5% hydropower (stated in that
-- chapter), which is why its primary figure sits below the International
-- Aluminium Institute's global average of 8.6 that includes recycled metal.
-- Each row carries that fact, because a student comparing the two will
-- otherwise think one of them is wrong.
--
-- Geographic scope is written as 'Global' with the real geography named in the
-- source text, exactly as migrate-016 did: a row scoped 'US' would return no
-- factor at all on a Global run, which is worse than a stated limitation.

-- 1. The variant substances ----------------------------------------------------
INSERT IGNORE INTO substances (substance_name, category, unit) VALUES
  ('Steel, scrap-EAF route', 'resource', 'kg'),
  ('Steel, BF-BOF route', 'resource', 'kg'),
  ('Steel, DRI-EAF route', 'resource', 'kg'),
  ('Aluminum, recycled ingot', 'resource', 'kg');

-- 2. Hang them off the material they are a version of --------------------------
UPDATE substances v
  JOIN substances p ON p.substance_name = 'Steel'
   SET v.variant_of = p.substance_id,
       v.variant_label = CASE v.substance_name
         WHEN 'Steel, scrap-EAF route' THEN 'Recycled route (scrap-EAF)'
         WHEN 'Steel, BF-BOF route'    THEN 'Primary route (BF-BOF)'
         WHEN 'Steel, DRI-EAF route'   THEN 'DRI-EAF route'
       END
 WHERE v.substance_name IN ('Steel, scrap-EAF route', 'Steel, BF-BOF route', 'Steel, DRI-EAF route');

UPDATE substances v
  JOIN substances p ON p.substance_name = 'Aluminum'
   SET v.variant_of = p.substance_id,
       v.variant_label = CASE v.substance_name
         WHEN 'Aluminum, recycled ingot' THEN 'Recycled ingot, US (WARM v16)'
         WHEN 'Aluminum, primary' THEN 'Primary ingot, North American grid'
       END
 WHERE v.substance_name IN ('Aluminum, recycled ingot', 'Aluminum, primary');

-- 3. The factors, under every method, Global Warming only -----------------------
--    (as migrate-016: a material needs a GWP factor whichever method is run)
INSERT INTO driver_impact_factors
  (substance_id, category_id, method_name, factor_value, unit, geographic_scope, factor_basis, source_reference)
SELECT s.substance_id, ic.category_id, m.method_name, v.value, 'kg CO2 eq', 'Global', 'embodied', v.source
FROM (
  SELECT 'Steel, scrap-EAF route' AS name, 0.70 AS value,
         'worldsteel, Sustainability Indicators 2024 report, "CO2 emissions and energy intensity, 2021-2023": scrap-EAF, 2023 = 0.70 tonnes CO2 per tonne of crude steel cast = 0.70 kg/kg. worldsteel CO2 data-collection indicator (scope 1, 2 and some scope 3), not a characterized LCIA result.' AS source
  UNION ALL SELECT 'Steel, BF-BOF route', 2.32,
         'worldsteel, Sustainability Indicators 2024 report, same table: BF-BOF, 2023 = 2.32 tonnes CO2 per tonne of crude steel cast = 2.32 kg/kg. Same indicator basis as the global average of 1.92.'
  UNION ALL SELECT 'Steel, DRI-EAF route', 1.43,
         'worldsteel, Sustainability Indicators 2024 report, same table: DRI-EAF, 2023 = 1.43 tonnes CO2 per tonne of crude steel cast = 1.43 kg/kg. worldsteel notes the DRI denominator is estimated from its own databases, not collected.'
  UNION ALL SELECT 'Aluminum, recycled ingot', 0.2976,
         'US EPA WARM v16, Metals (Dec 2023), Exhibit 2-23, Aluminum Ingot, 100% recycled inputs: 0.23 process + 0.04 transport + 0 non-energy = 0.27 MTCO2E/short ton; x 1.102311 = 0.2976 kg CO2e/kg. US secondary ingot production.'
  UNION ALL SELECT 'Aluminum, primary', 8.245,
         'US EPA WARM v16, Metals (Dec 2023), Exhibit 2-23, Aluminum Ingot, 100% virgin inputs: 4.23 process + 0.07 transport + 3.18 non-energy = 7.48 MTCO2E/short ton; x 1.102311 = 8.245 kg CO2e/kg. Below the IAI 2019 global average of 8.6 because WARM models North American smelting on a grid that is about 67.5% hydropower.'
) AS v
CROSS JOIN (SELECT 'CML 2001' AS method_name
            UNION ALL SELECT 'TRACI 2.1'
            UNION ALL SELECT 'ReCiPe Midpoint (H)') AS m
JOIN substances s ON s.substance_name = v.name
JOIN impact_categories ic ON ic.category_name = 'Global Warming'
-- The WHERE closes the join list: without it MySQL reads the ON of
-- ON DUPLICATE KEY UPDATE as another join condition and refuses the file.
WHERE 1 = 1
ON DUPLICATE KEY UPDATE
  factor_value = VALUES(factor_value),
  factor_basis = 'embodied',
  source_reference = VALUES(source_reference);
