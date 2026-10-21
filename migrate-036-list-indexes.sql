-- Migration 036 — indexes for the list screens (2026-10-20, education E07, E07b, E10, E12, E19)
-- Idempotent. Plain SQL (no DELIMITER): each index is guarded by an
-- information_schema check and run through PREPARE, as 026 to 033 do.
--
-- The case lists read, for every case in one query, its latest completed run
-- (MAX(run_id) WHERE case_id = ? AND status = 'completed'). Run ids are global
-- and increase, so the newest run is the largest id. The project lists filter a
-- project's cases by who made them. Both were full scans of the case's runs or
-- the project's cases.
--
--   assessment_runs (case_id, status, run_id)   latest completed run per case
--   assessment_results (run_id, category_id)    a run's total in one category
--   case_table (project_id, created_by)         a member's own cases in a project

SET @c := (SELECT COUNT(*) FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessment_runs' AND INDEX_NAME = 'idx_runs_case_status_run');
SET @sql := IF(@c = 0,
  'CREATE INDEX idx_runs_case_status_run ON assessment_runs (case_id, status, run_id)',
  'SELECT ''idx_runs_case_status_run exists''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessment_results' AND INDEX_NAME = 'idx_results_run_category');
SET @sql := IF(@c = 0,
  'CREATE INDEX idx_results_run_category ON assessment_results (run_id, category_id)',
  'SELECT ''idx_results_run_category exists''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'case_table' AND INDEX_NAME = 'idx_case_project_creator');
SET @sql := IF(@c = 0,
  'CREATE INDEX idx_case_project_creator ON case_table (project_id, created_by)',
  'SELECT ''idx_case_project_creator exists''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
