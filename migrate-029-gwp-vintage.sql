-- migrate-029-gwp-vintage.sql  (idempotent; plain SQL, no DELIMITER)
--
-- Audit 2026-09-29, finding E5: GWP vintages are mixed inside one method.
-- This migration CHANGES NO FACTOR VALUE. It records, per method and factor
-- group, which IPCC GWP100 set the live rows use, read from the rows
-- themselves at apply time, so a report can state its GWP basis
-- (ISO 14044 4.2.3.6 / 4.4.2.2) and the open decision is written down next
-- to the data it concerns.
--
-- Reference GWP100 values used to classify (kg CO2 eq / kg):
--                 AR4 (2007)   AR5 (2013, no feedback)   AR6 (2021)
--   CH4              25              28                      27.0 non-fossil / 29.8 fossil
--   N2O             298             265                     273
--   SF6           22800           23500                   25200
--   HFC-134a       1430            1300                    1530
--   R-410A         2088 (= 0.5 x HFC-32 675 + 0.5 x HFC-125 3500)
--                                 1924 (= 0.5 x 677 + 0.5 x 3170)
-- ReCiPe 2016 (H) uses N2O 298 (AR5 with climate-carbon feedback) and CH4 34/36;
-- ReCiPe 2008 (H) uses the AR4 set (CH4 25, N2O 298).
--
-- What the local database held on 2026-09-29 (lcapix_factors):
--   TRACI 2.1   lciafmt rows: CH4 25, N2O 298, SF6 22800, HFC-134a 1430 = AR4.
--               EPA GHG Hub fuel rows (Coal, Wood, Fuel Oil, LPG): CO2e at AR5
--               (CH4 28, N2O 265; migrate-012 header). Mixed inside the method.
--   CML 2001    CH4 28 (migrate-009 2a), N2O 265: AR5. R-410A 2088: AR4.
--   ReCiPe (H)  CH4 28 (migrate-009 2a), N2O 298: mixed. R-410A 2088: AR4.
--
-- migrate-009 section 2a sets Methane = 28 under EVERY method (no method
-- filter). Re-running it after migrate-015 would turn the TRACI lciafmt 25
-- into 28 silently. scripts/db/migrate.mjs records each applied file and never
-- runs it twice; migrate-009 carries a header saying the same. Whether TRACI
-- should stay AR4 or move to AR5 is a human decision (decision_needed below),
-- not something a migration should settle.

CREATE TABLE IF NOT EXISTS lcia_gwp_vintage (
  method_name     VARCHAR(100) NOT NULL,
  factor_group    VARCHAR(120) NOT NULL,
  gwp_vintage     VARCHAR(120) NOT NULL COMMENT 'IPCC AR4 | IPCC AR5 | mixed: ... | CO2 only | as published by the source',
  evidence        TEXT         NOT NULL COMMENT 'live values this classification was read from, at recorded_at',
  decision_needed TEXT         NULL     COMMENT 'open human decision, NULL when none',
  recorded_by     VARCHAR(40)  NOT NULL DEFAULT 'migrate-029',
  recorded_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (method_name, factor_group)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Which IPCC GWP100 set each method''s climate factors use (audit E5)';

-- Live values ------------------------------------------------------------------
-- (substance_name uses a case-insensitive collation: 'Nitrous oxide' is the
--  same row as 'Nitrous Oxide'.)
SET @gw := (SELECT category_id FROM impact_categories WHERE category_name = 'Global Warming' LIMIT 1);

SET @traci_ch4  := (SELECT MAX(d.factor_value) FROM driver_impact_factors d JOIN substances s ON s.substance_id = d.substance_id
                     WHERE s.substance_name = 'Methane' AND d.category_id = @gw AND d.method_name = 'TRACI 2.1' AND d.geographic_scope = 'Global');
SET @traci_n2o  := (SELECT MAX(d.factor_value) FROM driver_impact_factors d JOIN substances s ON s.substance_id = d.substance_id
                     WHERE s.substance_name = 'Nitrous Oxide' AND d.category_id = @gw AND d.method_name = 'TRACI 2.1' AND d.geographic_scope = 'Global');
SET @traci_sf6  := (SELECT MAX(d.factor_value) FROM driver_impact_factors d JOIN substances s ON s.substance_id = d.substance_id
                     WHERE s.substance_name = 'Sulfur hexafluoride' AND d.category_id = @gw AND d.method_name = 'TRACI 2.1' AND d.geographic_scope = 'Global');
SET @traci_134a := (SELECT MAX(d.factor_value) FROM driver_impact_factors d JOIN substances s ON s.substance_id = d.substance_id
                     WHERE s.substance_name = 'HFC-134a' AND d.category_id = @gw AND d.method_name = 'TRACI 2.1' AND d.geographic_scope = 'Global');
SET @cml_ch4    := (SELECT MAX(d.factor_value) FROM driver_impact_factors d JOIN substances s ON s.substance_id = d.substance_id
                     WHERE s.substance_name = 'Methane' AND d.category_id = @gw AND d.method_name = 'CML 2001' AND d.geographic_scope = 'Global');
SET @cml_n2o    := (SELECT MAX(d.factor_value) FROM driver_impact_factors d JOIN substances s ON s.substance_id = d.substance_id
                     WHERE s.substance_name = 'Nitrous Oxide' AND d.category_id = @gw AND d.method_name = 'CML 2001' AND d.geographic_scope = 'Global');
SET @rec_ch4    := (SELECT MAX(d.factor_value) FROM driver_impact_factors d JOIN substances s ON s.substance_id = d.substance_id
                     WHERE s.substance_name = 'Methane' AND d.category_id = @gw AND d.method_name = 'ReCiPe Midpoint (H)' AND d.geographic_scope = 'Global');
SET @rec_n2o    := (SELECT MAX(d.factor_value) FROM driver_impact_factors d JOIN substances s ON s.substance_id = d.substance_id
                     WHERE s.substance_name = 'Nitrous Oxide' AND d.category_id = @gw AND d.method_name = 'ReCiPe Midpoint (H)' AND d.geographic_scope = 'Global');

-- Values print without trailing zeros: TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM CAST(x AS CHAR))).

-- 1. The lciafmt TRACI 2.1 greenhouse-gas rows -----------------------------------
INSERT INTO lcia_gwp_vintage (method_name, factor_group, gwp_vintage, evidence, decision_needed)
VALUES (
  'TRACI 2.1',
  'lciafmt GHG characterization (CH4, N2O, SF6, HFCs; migrate-015)',
  CASE
    WHEN @traci_ch4 = 25 AND @traci_n2o = 298 THEN 'IPCC AR4'
    WHEN @traci_ch4 = 28 AND @traci_n2o = 298 THEN 'mixed: CH4 AR5 (28, set by migrate-009 2a) with N2O/SF6/HFCs AR4'
    WHEN @traci_ch4 IS NULL THEN 'no methane row'
    ELSE 'mixed or unknown: see evidence'
  END,
  CONCAT('CH4 ', IFNULL(TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM CAST(@traci_ch4 AS CHAR))), 'none'),
         ', N2O ', IFNULL(TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM CAST(@traci_n2o AS CHAR))), 'none'),
         ', SF6 ', IFNULL(TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM CAST(@traci_sf6 AS CHAR))), 'none'),
         ', HFC-134a ', IFNULL(TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM CAST(@traci_134a AS CHAR))), 'none'),
         ' (lciafmt TRACI 2.1, US EPA). AR4 reference: 25 / 298 / 22800 / 1430; AR5: 28 / 265 / 23500 / 1300.'),
  'TRACI 2.1 mixes GWP sets: these lciafmt rows are AR4 (CH4 25) while the EPA fuel rows filed under TRACI 2.1 embed AR5 (CH4 28, N2O 265). Decide: (a) keep AR4 for consistency with the published TRACI 2.1 method and recompute the 4 fuel rows at AR4 (Coal 94.032, Wood 95.053, Fuel Oil 74.214, LPG 61.964 kg CO2 eq/MMBtu), or (b) move the TRACI GHG rows to AR5 (CH4 28, N2O 265, SF6 23500, HFCs per AR5 Table 8.A.1) and say the method is TRACI 2.1 with AR5 GWPs. Methane direct emissions differ by 12% between the two (25 vs 28).'
)
ON DUPLICATE KEY UPDATE gwp_vintage = VALUES(gwp_vintage), evidence = VALUES(evidence),
  decision_needed = VALUES(decision_needed), recorded_by = VALUES(recorded_by);

-- 2. EPA GHG Emission Factors Hub fuel rows, every method ---------------------------
INSERT INTO lcia_gwp_vintage (method_name, factor_group, gwp_vintage, evidence, decision_needed)
SELECT m.method_name,
       'EPA GHG Hub fuel combustion CO2e (Coal, Wood, Fuel Oil, LPG; migrate-012/028)',
       'IPCC AR5',
       CONCAT('CO2 + CH4 x 28 + N2O x 265 per MMBtu (migrate-012 header; scripts/sync-epa-factors.mjs GWP100). Live: ',
              IFNULL((SELECT GROUP_CONCAT(CONCAT(s.substance_name, ' ',
                        TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM CAST(d.factor_value AS CHAR))))
                        ORDER BY s.substance_name SEPARATOR ', ')
                        FROM driver_impact_factors d JOIN substances s ON s.substance_id = d.substance_id
                       WHERE d.method_name = m.method_name AND d.category_id = @gw AND d.geographic_scope = 'Global'
                         AND s.substance_name IN ('Coal', 'Wood', 'Fuel Oil', 'LPG')), 'none'),
              ' kg CO2 eq/MMBtu. Wood check: 93.8 + 0.0072 x 28 + 0.0036 x 265 = 94.956.'),
       CASE WHEN m.method_name = 'TRACI 2.1'
            THEN 'See the TRACI 2.1 lciafmt row: these are AR5 inside an otherwise AR4 method.'
            ELSE NULL END
FROM (SELECT 'CML 2001' AS method_name UNION ALL SELECT 'TRACI 2.1' UNION ALL SELECT 'ReCiPe Midpoint (H)') m
ON DUPLICATE KEY UPDATE gwp_vintage = VALUES(gwp_vintage), evidence = VALUES(evidence),
  decision_needed = VALUES(decision_needed), recorded_by = VALUES(recorded_by);

-- 3. CML 2001 and ReCiPe greenhouse-gas rows ------------------------------------------
INSERT INTO lcia_gwp_vintage (method_name, factor_group, gwp_vintage, evidence, decision_needed)
VALUES (
  'CML 2001',
  'GHG characterization (CH4, N2O)',
  CASE
    WHEN @cml_ch4 = 28 AND @cml_n2o = 265 THEN 'IPCC AR5'
    WHEN @cml_ch4 = 25 AND @cml_n2o = 298 THEN 'IPCC AR4'
    ELSE 'mixed or unknown: see evidence'
  END,
  CONCAT('CH4 ', IFNULL(TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM CAST(@cml_ch4 AS CHAR))), 'none'),
         ' (migrate-009 2a, IPCC AR5), N2O ', IFNULL(TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM CAST(@cml_n2o AS CHAR))), 'none'),
         ' (openLCA CML 2001 seed).'),
  NULL
), (
  'ReCiPe Midpoint (H)',
  'GHG characterization (CH4, N2O)',
  CASE
    WHEN @rec_ch4 = 28 AND @rec_n2o = 265 THEN 'IPCC AR5'
    WHEN @rec_ch4 = 28 AND @rec_n2o = 298 THEN 'mixed: CH4 AR5 (28, migrate-009 2a) with N2O 298 (AR4 / ReCiPe 2016 H)'
    WHEN @rec_ch4 = 25 AND @rec_n2o = 298 THEN 'IPCC AR4 (ReCiPe 2008 H)'
    ELSE 'mixed or unknown: see evidence'
  END,
  CONCAT('CH4 ', IFNULL(TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM CAST(@rec_ch4 AS CHAR))), 'none'),
         ' (migrate-009 2a), N2O ', IFNULL(TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM CAST(@rec_n2o AS CHAR))), 'none'),
         ' (openLCA ReCiPe Midpoint (H) seed). ReCiPe 2008 H = AR4 (25/298); ReCiPe 2016 H = CH4 34 non-fossil / 36 fossil, N2O 298.'),
  'CH4 28 (AR5) sits beside N2O 298 (not AR5 265). Decide which ReCiPe version and GWP set this method row represents and align CH4/N2O to it.'
)
ON DUPLICATE KEY UPDATE gwp_vintage = VALUES(gwp_vintage), evidence = VALUES(evidence),
  decision_needed = VALUES(decision_needed), recorded_by = VALUES(recorded_by);

-- 4. R-410A, every method --------------------------------------------------------------
INSERT INTO lcia_gwp_vintage (method_name, factor_group, gwp_vintage, evidence, decision_needed)
SELECT m.method_name,
       'Refrigerant R-410A (50/50 HFC-32/HFC-125 blend)',
       CASE
         WHEN r.v IS NULL THEN 'no R-410A row'
         WHEN ROUND(r.v) = 2088 THEN 'IPCC AR4'
         WHEN ROUND(r.v) = 1924 THEN 'IPCC AR5'
         ELSE 'unknown: see evidence'
       END,
       CONCAT('R-410A ', IFNULL(TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM CAST(r.v AS CHAR))), 'none'),
              ' kg CO2 eq/kg. AR4 0.5 x 675 + 0.5 x 3500 = 2087.5; AR5 0.5 x 677 + 0.5 x 3170 = 1923.5. migrate-009 2f only replaces values outside 1000-2500, so 2088 was kept.'),
       CASE WHEN ROUND(r.v) = 2088 AND m.method_name <> 'TRACI 2.1'
            THEN 'AR4 refrigerant value inside a method whose CH4/N2O are AR5 (or mixed). Decide whether to set 1924 (AR5).'
            ELSE NULL END
FROM (SELECT 'CML 2001' AS method_name UNION ALL SELECT 'TRACI 2.1' UNION ALL SELECT 'ReCiPe Midpoint (H)') m
LEFT JOIN (
  SELECT d.method_name, MAX(d.factor_value) AS v
    FROM driver_impact_factors d JOIN substances s ON s.substance_id = d.substance_id
   WHERE s.substance_name = 'Refrigerant R-410A' AND d.category_id = @gw AND d.geographic_scope = 'Global'
   GROUP BY d.method_name
) r ON r.method_name = m.method_name
ON DUPLICATE KEY UPDATE gwp_vintage = VALUES(gwp_vintage), evidence = VALUES(evidence),
  decision_needed = VALUES(decision_needed), recorded_by = VALUES(recorded_by);

-- 5. Rows that are not GWP-weighted characterization --------------------------------------
INSERT INTO lcia_gwp_vintage (method_name, factor_group, gwp_vintage, evidence, decision_needed)
SELECT m.method_name,
       'Natural Gas combustion, per m3 (migrate-009 2d / 019)',
       'CO2 only',
       'EPA GHG Emission Factors Hub: 53.06 kg CO2/MMBtu / 28.263 m3/MMBtu = 1.877 kg CO2/m3. CH4 and N2O are not included (with them at AR5: 53.11 kg CO2e/MMBtu). The 28.263 m3/MMBtu basis is about 1,002 Btu/scf; see CALCULATIONS.md data-quality note E7.',
       NULL
FROM (SELECT 'CML 2001' AS method_name UNION ALL SELECT 'TRACI 2.1' UNION ALL SELECT 'ReCiPe Midpoint (H)') m
ON DUPLICATE KEY UPDATE gwp_vintage = VALUES(gwp_vintage), evidence = VALUES(evidence),
  decision_needed = VALUES(decision_needed), recorded_by = VALUES(recorded_by);

INSERT INTO lcia_gwp_vintage (method_name, factor_group, gwp_vintage, evidence, decision_needed)
SELECT m.method_name,
       'Electricity grid intensity (eGRID US, Ember Global/EU)',
       'as published by the source',
       'CO2e intensities taken as published (eGRID 2023 US 0.350, Ember 2024 Global 0.473, Ember EU-27 2023 0.242 kg/kWh); not recomputed from CH4/N2O here, so they carry the source''s own GWP set.',
       NULL
FROM (SELECT 'CML 2001' AS method_name UNION ALL SELECT 'TRACI 2.1' UNION ALL SELECT 'ReCiPe Midpoint (H)') m
ON DUPLICATE KEY UPDATE gwp_vintage = VALUES(gwp_vintage), evidence = VALUES(evidence),
  decision_needed = VALUES(decision_needed), recorded_by = VALUES(recorded_by);

-- For the apply log.
SELECT method_name, factor_group, gwp_vintage FROM lcia_gwp_vintage ORDER BY method_name, factor_group;
