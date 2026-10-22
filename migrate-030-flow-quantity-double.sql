-- Migration 030 — flow quantities to DOUBLE (2026-09-30, integration item 17)
-- Additive + idempotent. Plain SQL (no DELIMITER): each change is guarded by
-- an information_schema check and run through PREPARE, the pattern 026 uses,
-- so the file applies the same way through the mysql CLI and through mysql2.
--
-- flows.quantity was DECIMAL(15,6): anything below 5e-7 was stored as exactly
-- 0 and every amount kept only 6 decimals. A per-unit inventory holds amounts
-- at that scale (0.4 mg of pigment, 4.2e-7 kg of a solvent emission), so the
-- flow contributed nothing to the results even though the import review and
-- the editor showed the typed amount. DOUBLE keeps what was entered (about
-- 15-17 significant digits at any magnitude), as assessment_results.impact_value
-- does since 026.
--
-- flows.transport_mass_kg (DECIMAL(18,6)) is the leg mass the transport flow's
-- tonne-km quantity is derived from; it had the same 5e-7 kg floor and moves
-- to DOUBLE with it. transport_distance_km (DECIMAL(18,3), 1 m resolution) is
-- left as it is: no modelled distance is below a metre.
--
-- Checked and not changed (no small-value truncation that reaches a result):
-- component.quantity / labor_hours and the cost columns (not read by the
-- engine, or money), case_table.reference_flow / modeled_output (scaling
-- factors entered at human scale), process_template_flows.amount_per_driver
-- (DECIMAL(18,8); the library seeds it NULL, the user fills in the flow).
--
-- Widening DECIMAL -> DOUBLE keeps every stored quantity: DECIMAL(15,6) holds
-- at most 15 significant digits and DOUBLE round-trips 15. A transport mass
-- with more than 15 significant digits (above 1e9 kg with all six decimals)
-- would round in the 16th digit.

-- 1) flows.quantity -----------------------------------------------------------
SET @t := (SELECT LOWER(DATA_TYPE) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'flows'
             AND COLUMN_NAME = 'quantity');
SET @sql := IF(@t IS NOT NULL AND @t <> 'double',
  'ALTER TABLE flows MODIFY COLUMN quantity DOUBLE NOT NULL COMMENT ''Flow amount in `unit` (full precision, integration item 17)''',
  'SELECT ''flows.quantity already DOUBLE (or table missing)''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 2) flows.transport_mass_kg ----------------------------------------------------
SET @t := (SELECT LOWER(DATA_TYPE) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'flows'
             AND COLUMN_NAME = 'transport_mass_kg');
SET @sql := IF(@t IS NOT NULL AND @t <> 'double',
  'ALTER TABLE flows MODIFY COLUMN transport_mass_kg DOUBLE NULL DEFAULT NULL COMMENT ''Transport leg mass in kg; quantity = mass / 1000 x distance (tkm)''',
  'SELECT ''flows.transport_mass_kg already DOUBLE (or column missing)''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
