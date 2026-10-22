-- migrate-028-wood-fuel-lumber-split.sql  (idempotent; plain SQL, no DELIMITER)
--
-- Audit 2026-09-29, finding E1: the Wood FUEL factor was overwritten by the
-- LUMBER factor.
--
--   migrate-011  creates substance 'Wood' in MMBtu (ITAC stream E9, wood burned
--                as fuel; lib/ingest/itac.ts maps E9 -> 'Wood', MMBtu).
--   migrate-012  gives it the EPA combustion factor, 94.956 kg CO2 eq / MMBtu.
--   migrate-016  INSERT IGNOREs ('Wood','resource','kg') (a no-op: the MMBtu row
--                survives), then upserts the WARM dimensional-lumber factor
--                0.187 kg CO2 eq per KG onto the same (substance, Global
--                Warming, method, Global) key. ON DUPLICATE KEY UPDATE changed
--                factor_value and source_reference but not unit, so the rows
--                read "0.187 kg CO2 eq / MMBtu": every wood-fuel MMBtu was
--                charged about 1/500 of its combustion CO2, and a lumber flow
--                in kg could not reach the MMBtu substance at all.
--
-- Fix: two substances, each with the factor for what it measures.
--   'Wood'                      the fuel, MMBtu, EPA combustion factor restored
--   'Wood, dimensional lumber'  the material, kg, the WARM factor from 016
--
-- The Wood fuel value, recomputed from migrate-012's inputs:
--   EPA GHG Emission Factors Hub, Table 1, "Wood and Wood Residuals", per MMBtu:
--     CO2 93.8 kg, CH4 7.2 g, N2O 3.6 g
--   CO2e at IPCC AR5 GWP100 (CH4 28, N2O 265), the basis migrate-012 states:
--     93.8 + 0.0072 x 28 + 0.0036 x 265 = 93.8 + 0.2016 + 0.954 = 94.9556
--     -> 94.956 kg CO2 eq / MMBtu  (the value migrate-012 wrote)
--   Gross combustion: the 93.8 kg CO2 is biogenic. A study that reports
--   biogenic CO2 as net zero must say so; the source text says it.
--
-- The lumber value, as migrate-016 cited it:
--   US EPA WARM v16 (Dec 2023), Exhibit 12-5, dimensional lumber, raw material
--   acquisition + manufacturing, forest carbon storage excluded, US:
--   0.17 MTCO2E per short ton; 1 short ton = 907.18474 kg, so
--   0.17 x 1000 / 907.18474 = 0.18739 -> 0.187 kg CO2 eq / kg
--
-- Every factor row written here states its basis in the unit label
-- ('/ MMBtu', '/ kg'), which the engine now checks against the substance unit
-- (E11): a per-kg factor can no longer be applied to an MMBtu fuel silently.
--
-- The whole file runs in one transaction and ends with a guard that raises an
-- error when a fuel or lumber factor disagrees with its substance's unit. On
-- an error the mysql client exits, the transaction is never committed, and
-- nothing in this file takes effect.

START TRANSACTION;

-- 1. The lumber substance ----------------------------------------------------
INSERT INTO substances (substance_name, category, unit, description)
SELECT 'Wood, dimensional lumber', 'resource', 'kg',
       'Sawn softwood/hardwood lumber as a MATERIAL, by mass. For wood burned as fuel use ''Wood'' (MMBtu).'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM substances WHERE substance_name = 'Wood, dimensional lumber');

UPDATE substances
   SET description = 'Wood and wood residuals burned as FUEL, energy basis (MMBtu) for ITAC ingestion. Biogenic CO2. For lumber or timber as a material, use ''Wood, dimensional lumber'' (kg).'
 WHERE substance_name = 'Wood' AND unit = 'MMBtu';

-- 2. The lumber factor, on the kg substance ------------------------------------
INSERT INTO driver_impact_factors
  (substance_id, category_id, method_name, factor_value, unit, geographic_scope, factor_basis, source_reference)
SELECT s.substance_id, ic.category_id, m.method_name, 0.187, 'kg CO2 eq / kg', 'Global', 'embodied',
       'US EPA WARM v16 (Dec 2023), Exhibit 12-5 dimensional lumber, raw material acquisition + manufacturing, forest carbon storage excluded, US: 0.17 MTCO2E/short ton = 0.17 x 1000 / 907.18474 = 0.187 kg/kg. Moved off the Wood fuel substance by migrate-028 (2026-09-29).'
FROM substances s
JOIN impact_categories ic ON ic.category_name = 'Global Warming'
CROSS JOIN (SELECT 'CML 2001' AS method_name
            UNION ALL SELECT 'TRACI 2.1'
            UNION ALL SELECT 'ReCiPe Midpoint (H)') AS m
WHERE s.substance_name = 'Wood, dimensional lumber' AND s.unit = 'kg'
ON DUPLICATE KEY UPDATE
  factor_value = VALUES(factor_value),
  unit = VALUES(unit),
  factor_basis = VALUES(factor_basis),
  source_reference = VALUES(source_reference);

-- 3. The Wood fuel factor, restored ----------------------------------------------
INSERT INTO driver_impact_factors
  (substance_id, category_id, method_name, factor_value, unit, geographic_scope, factor_basis, source_reference)
SELECT s.substance_id, ic.category_id, m.method_name, 94.956, 'kg CO2 eq / MMBtu', 'Global', 'embodied',
       'EPA GHG Emission Factors Hub, Table 1: Wood and Wood Residuals (CO2 93.8 kg + CH4 7.2 g + N2O 3.6 g per MMBtu; CO2e at IPCC AR5 GWP100 CH4 28, N2O 265: 93.8 + 0.2016 + 0.954 = 94.956). BIOGENIC CO2: gross combustion; report as net zero only if your framework treats biogenic carbon that way. Restored by migrate-028 (2026-09-29) after migrate-016 overwrote it with the 0.187 kg/kg lumber factor.'
FROM substances s
JOIN impact_categories ic ON ic.category_name = 'Global Warming'
CROSS JOIN (SELECT 'CML 2001' AS method_name
            UNION ALL SELECT 'TRACI 2.1'
            UNION ALL SELECT 'ReCiPe Midpoint (H)') AS m
WHERE s.substance_name = 'Wood' AND s.unit = 'MMBtu'
ON DUPLICATE KEY UPDATE
  factor_value = VALUES(factor_value),
  unit = VALUES(unit),
  factor_basis = VALUES(factor_basis),
  source_reference = VALUES(source_reference);

-- 4. For the apply log: flows on the Wood FUEL entered in a non-energy unit.
--    They may be lumber typed onto the fuel. Not moved automatically (wood fuel
--    can be metered by mass too); the engine excludes them with a warning.
SELECT f.flow_id, f.component_id, f.quantity, f.unit AS flow_unit,
       'on Wood (fuel, MMBtu): lumber? use Wood, dimensional lumber' AS note
  FROM flows f
  JOIN substances s ON s.substance_id = f.substance_id
 WHERE s.substance_name = 'Wood'
   AND LOWER(TRIM(f.unit)) NOT IN ('mmbtu', 'btu', 'therm', 'kwh', 'wh', 'mwh', 'mj', 'gj', 'kj');

-- GUARD BEGIN (tests/e2e-local/migrate-028.local.test.ts runs this section alone)
-- 5. Guard: fail loudly when a fuel or lumber factor disagrees with its
--    substance unit.
--    a) Wood must be the MMBtu fuel and the lumber substance must be kg.
--    b) Every live factor row on these substances that states a denominator
--       ('... / MMBtu') must state one in the substance's unit family.
--    c) The two Wood substances must state their basis explicitly (a bare
--       'kg CO2 eq' is how the 016 clobber hid).
--    d) Global Warming on an MMBtu fuel must be a combustion-sized number,
--       50-130 kg CO2 eq/MMBtu (EPA Hub Table 1 spans about 53 for natural gas
--       to 103 for anthracite). 0.187 fails this.
--    Unit families cover the units these substances and their factors use.
SELECT s.substance_name, s.unit AS substance_unit, ic.category_name, d.method_name,
       d.factor_value, d.unit AS factor_unit,
       'VIOLATION: factor unit vs substance unit' AS guard
  FROM driver_impact_factors d
  JOIN substances s ON s.substance_id = d.substance_id
  JOIN impact_categories ic ON ic.category_id = d.category_id
  LEFT JOIN (
    SELECT 'kg' AS u, 'mass' AS fam UNION ALL SELECT 'g', 'mass' UNION ALL SELECT 't', 'mass'
    UNION ALL SELECT 'lb', 'mass' UNION ALL SELECT 'short ton', 'mass'
    UNION ALL SELECT 'mmbtu', 'energy' UNION ALL SELECT 'btu', 'energy' UNION ALL SELECT 'kwh', 'energy'
    UNION ALL SELECT 'mwh', 'energy' UNION ALL SELECT 'mj', 'energy' UNION ALL SELECT 'gj', 'energy'
    UNION ALL SELECT 'therm', 'energy'
    UNION ALL SELECT 'm3', 'volume' UNION ALL SELECT 'l', 'volume' UNION ALL SELECT 'gal', 'volume'
    UNION ALL SELECT 'scf', 'volume'
  ) fs ON fs.u = LOWER(TRIM(s.unit))
  LEFT JOIN (
    SELECT 'kg' AS u, 'mass' AS fam UNION ALL SELECT 'g', 'mass' UNION ALL SELECT 't', 'mass'
    UNION ALL SELECT 'lb', 'mass' UNION ALL SELECT 'short ton', 'mass'
    UNION ALL SELECT 'mmbtu', 'energy' UNION ALL SELECT 'btu', 'energy' UNION ALL SELECT 'kwh', 'energy'
    UNION ALL SELECT 'mwh', 'energy' UNION ALL SELECT 'mj', 'energy' UNION ALL SELECT 'gj', 'energy'
    UNION ALL SELECT 'therm', 'energy'
    UNION ALL SELECT 'm3', 'volume' UNION ALL SELECT 'l', 'volume' UNION ALL SELECT 'gal', 'volume'
    UNION ALL SELECT 'scf', 'volume'
  ) fd ON fd.u = LOWER(TRIM(SUBSTRING_INDEX(d.unit, '/', -1)))
 WHERE d.method_name NOT LIKE 'QUARANTINE%'
   AND s.substance_name IN ('Wood', 'Wood, dimensional lumber', 'Coal', 'LPG', 'Fuel Oil', 'Natural Gas')
   AND (
        (d.unit LIKE '%/%' AND (fs.fam IS NULL OR fd.fam IS NULL OR fs.fam <> fd.fam))
     OR (s.substance_name IN ('Wood', 'Wood, dimensional lumber') AND d.unit NOT LIKE '%/%')
     OR (ic.category_name = 'Global Warming' AND LOWER(TRIM(s.unit)) = 'mmbtu'
         AND (d.factor_value < 50 OR d.factor_value > 130))
   );

SET @m028_bad := (
  SELECT COUNT(*)
    FROM driver_impact_factors d
    JOIN substances s ON s.substance_id = d.substance_id
    JOIN impact_categories ic ON ic.category_id = d.category_id
    LEFT JOIN (
      SELECT 'kg' AS u, 'mass' AS fam UNION ALL SELECT 'g', 'mass' UNION ALL SELECT 't', 'mass'
      UNION ALL SELECT 'lb', 'mass' UNION ALL SELECT 'short ton', 'mass'
      UNION ALL SELECT 'mmbtu', 'energy' UNION ALL SELECT 'btu', 'energy' UNION ALL SELECT 'kwh', 'energy'
      UNION ALL SELECT 'mwh', 'energy' UNION ALL SELECT 'mj', 'energy' UNION ALL SELECT 'gj', 'energy'
      UNION ALL SELECT 'therm', 'energy'
      UNION ALL SELECT 'm3', 'volume' UNION ALL SELECT 'l', 'volume' UNION ALL SELECT 'gal', 'volume'
      UNION ALL SELECT 'scf', 'volume'
    ) fs ON fs.u = LOWER(TRIM(s.unit))
    LEFT JOIN (
      SELECT 'kg' AS u, 'mass' AS fam UNION ALL SELECT 'g', 'mass' UNION ALL SELECT 't', 'mass'
      UNION ALL SELECT 'lb', 'mass' UNION ALL SELECT 'short ton', 'mass'
      UNION ALL SELECT 'mmbtu', 'energy' UNION ALL SELECT 'btu', 'energy' UNION ALL SELECT 'kwh', 'energy'
      UNION ALL SELECT 'mwh', 'energy' UNION ALL SELECT 'mj', 'energy' UNION ALL SELECT 'gj', 'energy'
      UNION ALL SELECT 'therm', 'energy'
      UNION ALL SELECT 'm3', 'volume' UNION ALL SELECT 'l', 'volume' UNION ALL SELECT 'gal', 'volume'
      UNION ALL SELECT 'scf', 'volume'
    ) fd ON fd.u = LOWER(TRIM(SUBSTRING_INDEX(d.unit, '/', -1)))
   WHERE d.method_name NOT LIKE 'QUARANTINE%'
     AND s.substance_name IN ('Wood', 'Wood, dimensional lumber', 'Coal', 'LPG', 'Fuel Oil', 'Natural Gas')
     AND (
          (d.unit LIKE '%/%' AND (fs.fam IS NULL OR fd.fam IS NULL OR fs.fam <> fd.fam))
       OR (s.substance_name IN ('Wood', 'Wood, dimensional lumber') AND d.unit NOT LIKE '%/%')
       OR (ic.category_name = 'Global Warming' AND LOWER(TRIM(s.unit)) = 'mmbtu'
           AND (d.factor_value < 50 OR d.factor_value > 130))
     )
) + (
  SELECT COUNT(*) FROM substances
   WHERE (substance_name = 'Wood' AND unit <> 'MMBtu')
      OR (substance_name = 'Wood, dimensional lumber' AND unit <> 'kg')
) + (
  -- both substances must exist and carry their Global Warming rows
  SELECT 6 - COUNT(*)
    FROM driver_impact_factors d
    JOIN substances s ON s.substance_id = d.substance_id
    JOIN impact_categories ic ON ic.category_id = d.category_id
   WHERE ic.category_name = 'Global Warming' AND d.geographic_scope = 'Global'
     AND d.method_name IN ('CML 2001', 'TRACI 2.1', 'ReCiPe Midpoint (H)')
     AND s.substance_name IN ('Wood', 'Wood, dimensional lumber')
);

-- An unknown table makes PREPARE fail with the table name in the message; the
-- mysql client stops there and the transaction above is never committed.
SET @m028_guard := IF(@m028_bad = 0,
  'SELECT ''migrate-028 guard passed: fuel and lumber factors agree with their substance units'' AS guard',
  'SELECT * FROM `GUARD FAILED migrate-028 factor unit vs substance unit`');
PREPARE m028_guard FROM @m028_guard;
EXECUTE m028_guard;
DEALLOCATE PREPARE m028_guard;
-- GUARD END

COMMIT;
