-- migrate-011-itac-fuel-factors.sql  (idempotent)
--
-- Makes ITAC energy streams reach the assessment. ITAC reports fuels in MMBtu
-- (energy). Previously LPG/fuel-oil/wood had no substance (unmatched, held) and
-- coal's factor was per-kg (unit-family mismatch with MMBtu → held). Both classes
-- silently undercounted the assessment (see v1-findings-todo #1).
--
-- Fix: put all ITAC fuels on an energy (MMBtu) basis with per-MMBtu Global Warming
-- factors from the EPA GHG Emission Factors Hub 2025 (CO2 component per MMBtu —
-- consistent with the audited natural-gas factor 53.06 kg/MMBtu = 1.877 kg/m3).
-- CH4/N2O excluded (minor, ~1-3%); full CO2e + biogenic accounting deferred to the
-- "better dataset" todo. Wood is biogenic — flagged in its source_reference.

-- 1) Fuel substances on an MMBtu basis (LPG, Fuel Oil, Wood). Guarded.
INSERT INTO substances (substance_name, unit, category, description)
SELECT 'LPG', 'MMBtu', 'resource', 'Liquefied petroleum gas (propane); energy basis for ITAC ingestion.'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM substances WHERE substance_name = 'LPG');

INSERT INTO substances (substance_name, unit, category, description)
SELECT 'Fuel Oil', 'MMBtu', 'resource', 'Distillate/residual fuel oil; energy basis for ITAC ingestion.'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM substances WHERE substance_name = 'Fuel Oil');

INSERT INTO substances (substance_name, unit, category, description)
SELECT 'Wood', 'MMBtu', 'resource', 'Wood/biomass fuel; energy basis for ITAC ingestion. Biogenic CO2.'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM substances WHERE substance_name = 'Wood');

-- 2) Coal → energy basis (verified 0 flows use it in kg, so this is safe).
UPDATE substances SET unit = 'MMBtu' WHERE substance_name = 'Coal';

-- 3) Per-MMBtu Global Warming factors for all ITAC fuels, every method.
--    Delete-then-insert = idempotent. factor_basis 'embodied' (a fuel is an
--    INPUT flow whose factor charges its combustion).
DELETE dif FROM driver_impact_factors dif
JOIN substances s ON s.substance_id = dif.substance_id
WHERE s.substance_name IN ('Coal', 'LPG', 'Fuel Oil', 'Wood')
  AND dif.category_id = 1;   -- Global Warming

INSERT INTO driver_impact_factors
  (substance_id, category_id, method_name, factor_value, unit,
   geographic_scope, source_reference, factor_basis)
SELECT s.substance_id, 1, m.method_name, v.val, 'kg CO2 eq / MMBtu', 'Global',
       'EPA GHG Emission Factors Hub 2025 (CO2 component, per MMBtu); CH4/N2O excluded [EPA-HUB-2025]',
       'embodied'
FROM (
  SELECT 'Coal'     AS name, 93.28 AS val
  UNION ALL SELECT 'LPG',      61.71
  UNION ALL SELECT 'Fuel Oil', 73.96
  UNION ALL SELECT 'Wood',     93.80
) v
JOIN substances s ON s.substance_name = v.name
CROSS JOIN (
  SELECT 'CML 2001' AS method_name
  UNION ALL SELECT 'ReCiPe Midpoint (H)'
  UNION ALL SELECT 'TRACI 2.1'
) m;

-- Wood: biogenic caveat in provenance.
UPDATE driver_impact_factors dif
JOIN substances s ON s.substance_id = dif.substance_id
SET dif.source_reference = CONCAT(
      dif.source_reference,
      ' — BIOGENIC CO2 (gross combustion; treat as net-zero under biogenic accounting per your framework)')
WHERE s.substance_name = 'Wood' AND dif.category_id = 1;
