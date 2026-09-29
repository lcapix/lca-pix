-- migrate-024-legacy-factor-quarantine.sql  (idempotent)
--
-- Two data-honesty fixes found in the readiness assessment (2026-09-16).
--
-- 1. THREE LEGACY CLIMATE FACTORS THAT ARE NOT CLIMATE FACTORS.
--    CML 2001 rows give Global Warming factors to Sulfur Dioxide (0.3),
--    Nitrogen Oxides (1.2) and PM2.5 (2.75) kg CO2 eq/kg, sourced only as
--    "legacy pack value; not yet verified". CML's climate-change
--    characterization does not score these three as greenhouse gases: they are
--    acidification, eutrophication and particulate-matter substances. A case
--    with welding fume or combustion emissions therefore reported a climate
--    number that no method supports.
--
--    They are moved out of their method ('QUARANTINE: <method>'), never
--    deleted, exactly as migrate-017 did: reversible and auditable. The engine
--    already ignores any method_name LIKE 'QUARANTINE%'.
--
-- The aluminium row is NOT quarantined. It looked contradictory (8.5 primary
-- against an 8.6 global average that includes recycled metal), but US EPA WARM
-- v16 puts virgin aluminium ingot at 8.245 kg CO2 eq/kg, below the global
-- average, because North American smelting runs on a grid that is about 67.5%
-- hydropower. Geography, not error. Quarantining it would have zeroed the
-- aluminium in every case that uses it; migrate-025 gives it a sourced value
-- instead.

-- 1. The three legacy climate factors -----------------------------------------
UPDATE driver_impact_factors dif
  JOIN substances s ON s.substance_id = dif.substance_id
  JOIN impact_categories ic ON ic.category_id = dif.category_id
   SET dif.method_name = CONCAT('QUARANTINE: ', dif.method_name),
       dif.source_reference = CONCAT(
         'QUARANTINED 2026-09-28 (migrate-024): not a greenhouse gas under this method. ',
         IFNULL(dif.source_reference, '')
       )
 WHERE dif.method_name NOT LIKE 'QUARANTINE%'
   AND ic.category_name = 'Global Warming'
   AND s.substance_name IN ('Sulfur Dioxide', 'Nitrogen Oxides',
                            'Sulfur dioxide (SO2)', 'Nitrogen oxides (NOx)',
                            'Particulate Matter (PM2.5)', 'PM2.5',
                            'Particulate matter, < 2.5 um')
   AND (dif.source_reference IS NULL
        OR dif.source_reference LIKE '%legacy pack%'
        OR dif.source_reference LIKE '%not yet verified%'
        OR dif.source_reference LIKE '%synonym of%');

-- What moved, for the apply script's log.
SELECT s.substance_name, ic.category_name, dif.method_name, dif.factor_value
  FROM driver_impact_factors dif
  JOIN substances s ON s.substance_id = dif.substance_id
  JOIN impact_categories ic ON ic.category_id = dif.category_id
 WHERE dif.source_reference LIKE '%migrate-024%';
