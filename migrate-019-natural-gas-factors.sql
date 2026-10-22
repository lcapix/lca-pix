-- migrate-019-natural-gas-factors.sql  (idempotent)
-- Natural Gas factors that existed in the local database but in no migration, so a
-- database built from migrations (lcapix-prod) lacked them: the EPA GHG Emission
-- Factors Hub 2025 climate factor under TRACI 2.1 and ReCiPe Midpoint (H) (CML 2001
-- already carries it via migrate-011), and the CML 2001 acidification row. Values
-- and sources are copied exactly from the local rows.
-- 53.06 kg CO2/MMBtu / 28.263 m3/MMBtu = 1.877 kg CO2 eq/m3.

DELETE dif FROM driver_impact_factors dif
JOIN substances s ON s.substance_id = dif.substance_id
JOIN impact_categories ic ON ic.category_id = dif.category_id
WHERE s.substance_name = 'Natural Gas'
  AND dif.geographic_scope = 'Global'
  AND ((dif.method_name IN ('TRACI 2.1', 'ReCiPe Midpoint (H)') AND ic.category_name = 'Global Warming')
    OR (dif.method_name = 'CML 2001' AND ic.category_name = 'Acidification'));

INSERT INTO driver_impact_factors
  (substance_id, category_id, method_name, factor_value, unit,
   geographic_scope, source_reference, factor_basis)
SELECT s.substance_id, ic.category_id, m.method_name, 1.877, 'kg CO2 eq / m3', 'Global',
       'EPA GHG Emission Factors Hub 2025: Natural Gas 53.06 kg CO2/MMBtu = 1.877 kg/m3 (28.263 m3/MMBtu) [EPA-HUB-2025]',
       'embodied'
FROM substances s
JOIN impact_categories ic ON ic.category_name = 'Global Warming'
CROSS JOIN (SELECT 'TRACI 2.1' AS method_name UNION ALL SELECT 'ReCiPe Midpoint (H)') m
WHERE s.substance_name = 'Natural Gas';

INSERT INTO driver_impact_factors
  (substance_id, category_id, method_name, factor_value, unit,
   geographic_scope, source_reference, factor_basis)
SELECT s.substance_id, ic.category_id, 'CML 2001', 0.0003, 'kg SO2 eq', 'Global',
       'openLCA CML 2001', 'embodied'
FROM substances s
JOIN impact_categories ic ON ic.category_name = 'Acidification'
WHERE s.substance_name = 'Natural Gas';
