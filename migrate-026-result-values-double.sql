-- Migration 026 — result value columns to DOUBLE (2026-09-29, audit RUN-2)
-- Additive + idempotent. Plain SQL (no DELIMITER): each change is guarded by
-- an information_schema check and run through PREPARE, the pattern 009/010 use,
-- so the file applies the same way through the mysql CLI and through mysql2.
--
-- assessment_results.impact_value was DECIMAL(20,6) in lca_v3_drawsql_schema.sql
-- (DECIMAL(20,10) on some copies). Fixed-point storage rounds small results:
-- below 5e-7 (or 5e-11) a value is stored as exactly 0, and every value keeps
-- only 6 (or 10) decimals. Ozone depletion (kg CFC-11 eq) and several toxicity
-- results live at that scale, so a run showed the engine's number and then, on
-- the immediate refetch, 0. DOUBLE keeps what the engine computed (about 15-17
-- significant digits at any magnitude).
--
-- contribution_percentage (DECIMAL(5,2)) has the same problem at the other end:
-- a share below 0.005% reads as 0 and a credit-driven share above 999.99%
-- overflows. It moves to DOUBLE as well.
--
-- Widening DECIMAL -> DOUBLE never loses a stored digit that DECIMAL(20,10)
-- could hold to 15 significant digits, so existing rows are kept as they are.

-- 1) impact_value ---------------------------------------------------------------
SET @t := (SELECT LOWER(DATA_TYPE) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessment_results'
             AND COLUMN_NAME = 'impact_value');
SET @sql := IF(@t IS NOT NULL AND @t <> 'double',
  'ALTER TABLE assessment_results MODIFY COLUMN impact_value DOUBLE NOT NULL COMMENT ''Calculated impact value (full precision, audit RUN-2)''',
  'SELECT ''assessment_results.impact_value already DOUBLE (or table missing)''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 2) contribution_percentage ---------------------------------------------------
SET @t := (SELECT LOWER(DATA_TYPE) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessment_results'
             AND COLUMN_NAME = 'contribution_percentage');
SET @sql := IF(@t IS NOT NULL AND @t <> 'double',
  'ALTER TABLE assessment_results MODIFY COLUMN contribution_percentage DOUBLE NULL',
  'SELECT ''assessment_results.contribution_percentage already DOUBLE (or column missing)''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
