-- Migration 042 — the AI switch per project, and checked AI replies kept per run
-- (2026-10-20, education E05 Magic Insights, default D7)
-- Idempotent: a guarded ALTER through PREPARE, as 026 to 041 do, and
-- CREATE TABLE IF NOT EXISTS.
--
-- project.ai_enabled  1 (the default, D7): Magic Insights may send a run's
--                     computed figures to the open model to phrase them.
--                     0: the project's runs get the computed insight only and
--                     nothing leaves the app. Only the owner changes it, and
--                     each change is written to audit_log.
-- insight_cache       a narration that passed the number check, kept for the
--                     run and the exact prompt it answered, so asking again
--                     costs nothing and reads the same. It goes with its run.

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project' AND COLUMN_NAME = 'ai_enabled');
SET @sql := IF(@c = 0,
  'ALTER TABLE project ADD COLUMN ai_enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT ''0 = Magic Insights uses the computed insight only, nothing is sent to the model (D7)''',
  'SELECT ''project.ai_enabled exists''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

CREATE TABLE IF NOT EXISTS insight_cache (
  run_id       INT NOT NULL,
  prompt_hash  CHAR(64) NOT NULL COMMENT 'sha256 of the model, system and user prompt',
  model        VARCHAR(100) NOT NULL,
  reply        TEXT NOT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (run_id, prompt_hash),
  CONSTRAINT fk_insight_cache_run FOREIGN KEY (run_id) REFERENCES assessment_runs (run_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Magic Insights replies that passed the number check, per run and prompt';
