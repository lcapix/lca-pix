-- Migration 010 — run snapshots + Equipment/Overhead cost columns (2026-09-10)
-- Additive + idempotent (safe to run on prod RDS and on dev copies where some
-- columns already exist; MySQL 8 lacks ADD COLUMN IF NOT EXISTS, hence the
-- information_schema guards).
--
-- 1) assessment_runs.run_snapshot: the exact per-flow contributions (entered
--    amount, unit conversion applied, factor value, factor scope, resulting
--    impact) plus engine warnings, frozen at run time. Results pages read the
--    snapshot, so a historical run keeps telling the truth even after flows or
--    factors change. Runs already append (each POST inserts a new run row).
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessment_runs'
             AND COLUMN_NAME = 'run_snapshot');
SET @sql := IF(@c = 0,
  'ALTER TABLE assessment_runs ADD COLUMN run_snapshot JSON NULL COMMENT ''Frozen per-flow contributions + warnings captured when the run executed''',
  'SELECT ''run_snapshot exists''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 2) Equipment & Overhead: the form has always shown these two fields, but a
--    prior migration dropped the columns on prod and the API discarded the
--    values while the on-screen "estimated total" still included them. Per the
--    additions-only rule the columns come back instead of the fields going away.
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'component'
             AND COLUMN_NAME = 'equipment_cost');
SET @sql := IF(@c = 0,
  'ALTER TABLE component ADD COLUMN equipment_cost DECIMAL(15,2) NULL',
  'SELECT ''equipment_cost exists''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'component'
             AND COLUMN_NAME = 'overhead_cost');
SET @sql := IF(@c = 0,
  'ALTER TABLE component ADD COLUMN overhead_cost DECIMAL(15,2) NULL',
  'SELECT ''overhead_cost exists''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
