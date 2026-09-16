-- migrate-017-factor-unit-quarantine.sql  (idempotent; run AFTER migrate-015 and migrate-016)
-- Data-integrity pass after the lciafmt TRACI 2.1 import.
--
-- 1. Synonym substances (alias rows that had no factors) inherit their
--    canonical substance's factors, so a flow mapped to "Carbon dioxide (CO2)"
--    is not silently zero.
-- 2. Quarantine factor rows whose unit does not belong to their category.
--    A legacy CML seed filed embodied rows one category off (acidification
--    under Ozone Depletion, eutrophication under Acidification, abiotic
--    depletion under Photochemical Oxidation), and legacy "TRACI 2.1" seed
--    rows carried CML-style units that TRACI 2.1 does not use. Mixing either
--    with real factors would add incompatible quantities in one category.
--    Rows are moved out of their method ('QUARANTINE: <method>'), never
--    deleted, so the pass is reversible and auditable. Categories are matched
--    by NAME so the file is portable between databases.

-- 1. Synonyms -----------------------------------------------------------------
INSERT INTO driver_impact_factors
  (substance_id, category_id, method_name, factor_value, unit, geographic_scope, factor_basis, source_reference)
SELECT a.alias_id, d.category_id, d.method_name, d.factor_value, d.unit, d.geographic_scope, d.factor_basis,
       CONCAT('synonym of ', c.substance_name, ' — ', IFNULL(d.source_reference, ''))
FROM (
  SELECT s1.substance_id AS alias_id, s2.substance_id AS canon_id
  FROM substances s1
  JOIN substances s2 ON (
       (s1.substance_name = 'Carbon dioxide (CO2)'       AND s2.substance_name = 'Carbon Dioxide')
    OR (s1.substance_name = 'Nitrogen oxides (NOx)'      AND s2.substance_name = 'Nitrogen Oxides')
    OR (s1.substance_name = 'Sulfur dioxide (SO2)'       AND s2.substance_name = 'Sulfur Dioxide')
    OR (s1.substance_name = 'Electricity, grid mix'      AND s2.substance_name = 'Electricity')
    OR (s1.substance_name = 'Aluminum alloy, economical' AND s2.substance_name = 'Aluminum')
    OR (s1.substance_name LIKE 'Electronics, %'          AND s2.substance_name = 'Electronics')
  )
) a
JOIN substances c ON c.substance_id = a.canon_id
JOIN driver_impact_factors d ON d.substance_id = a.canon_id
WHERE d.method_name NOT LIKE 'QUARANTINE%'
ON DUPLICATE KEY UPDATE factor_value = VALUES(factor_value), unit = VALUES(unit),
  source_reference = VALUES(source_reference);

-- 2a. CML 2001: unit numerator must equal the category's reference unit -------
UPDATE driver_impact_factors d
JOIN impact_categories ic ON ic.category_id = d.category_id
SET d.source_reference = CONCAT('QUARANTINED 2026-09-15 (was ', d.method_name, '): unit ', d.unit,
                                ' does not belong to ', ic.category_name, ' | ', IFNULL(d.source_reference, '')),
    d.method_name = CONCAT('QUARANTINE: ', d.method_name)
WHERE d.method_name = 'CML 2001'
  AND TRIM(SUBSTRING_INDEX(d.unit, '/', 1)) <> ic.unit;

-- 2b. TRACI 2.1: only TRACI reference units are valid -------------------------
UPDATE driver_impact_factors d
JOIN impact_categories ic ON ic.category_id = d.category_id
SET d.source_reference = CONCAT('QUARANTINED 2026-09-15 (was TRACI 2.1): unit ', d.unit,
                                ' is not the TRACI 2.1 reference unit for ', ic.category_name,
                                ' | ', IFNULL(d.source_reference, '')),
    d.method_name = 'QUARANTINE: TRACI 2.1'
WHERE d.method_name = 'TRACI 2.1' AND (
     (ic.category_name = 'Eutrophication'          AND TRIM(SUBSTRING_INDEX(d.unit, '/', 1)) <> 'kg N eq')
  OR (ic.category_name = 'Photochemical Oxidation' AND TRIM(SUBSTRING_INDEX(d.unit, '/', 1)) <> 'kg O3 eq')
  OR (ic.category_name = 'Human Toxicity'          AND TRIM(SUBSTRING_INDEX(d.unit, '/', 1)) <> 'CTUnoncancer')
  OR (ic.category_name = 'Ecotoxicity'             AND TRIM(SUBSTRING_INDEX(d.unit, '/', 1)) <> 'CTUeco')
  OR (ic.category_name = 'Resource Depletion'      AND TRIM(SUBSTRING_INDEX(d.unit, '/', 1)) <> 'MJ surplus'));
