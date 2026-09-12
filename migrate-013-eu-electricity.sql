-- migrate-013-eu-electricity.sql  (idempotent)
-- Finding 1c: EU had no electricity factor, so "EU Average" silently used the
-- Global 0.473. Add the real EU grid intensity. Region canonicalization maps
-- 'EU Average' → 'EU', so scope 'EU' is what the engine looks up.
-- Value: Ember European Electricity Review 2024 — EU-27 2023 average 242 gCO2/kWh.
DELETE dif FROM driver_impact_factors dif
JOIN substances s ON s.substance_id = dif.substance_id
JOIN impact_categories ic ON ic.category_id = dif.category_id
WHERE s.substance_name = 'Electricity' AND ic.category_name = 'Global Warming'
  AND dif.geographic_scope = 'EU';

INSERT INTO driver_impact_factors
  (substance_id, category_id, method_name, factor_value, unit,
   geographic_scope, source_reference, factor_basis)
SELECT s.substance_id, 1, m.method_name, 0.242, 'kg CO2 eq / kWh', 'EU',
       'Ember European Electricity Review 2024 (EU-27 2023 avg 242 gCO2/kWh) [EMBER-EU-2024]', 'embodied'
FROM substances s
CROSS JOIN (SELECT 'CML 2001' AS method_name UNION ALL SELECT 'ReCiPe Midpoint (H)' UNION ALL SELECT 'TRACI 2.1') m
WHERE s.substance_name = 'Electricity';
