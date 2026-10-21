-- Migration 038 — the sample study (2026-10-20, education E02, E03, F1.4)
-- Idempotent. Plain SQL (no DELIMITER): each column guarded by an
-- information_schema check and run through PREPARE, as 026 to 037 do.
--
-- Every new account gets a finished sample study to read (the painted steel
-- bracket). Two flags, set only by the server's sample builder:
--   project.is_sample      the project is the sample (the SAMPLE badge, and
--                          removing it is written to audit_log)
--   case_table.read_only   the case cannot be changed by anyone, its owner
--                          included: edits, steps, flows, costs, runs and the
--                          write-up are refused (403). "Make my own copy" makes
--                          an editable case. Copies never inherit the flag.
-- Both default 0, so nothing changes for an existing project or case.

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project' AND COLUMN_NAME = 'is_sample');
SET @sql := IF(@c = 0,
  'ALTER TABLE project ADD COLUMN is_sample TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''1 = the sample study the server built for this account (E02)''',
  'SELECT ''project.is_sample exists''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'case_table' AND COLUMN_NAME = 'read_only');
SET @sql := IF(@c = 0,
  'ALTER TABLE case_table ADD COLUMN read_only TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''1 = nobody may change this case (the sample base case); copy it to change it''',
  'SELECT ''case_table.read_only exists''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
