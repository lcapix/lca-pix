-- Migration 037 — per-case privacy in a class project (2026-10-20, education E08/E08b, default D2)
-- Idempotent. Plain SQL (no DELIMITER): guarded by an information_schema check
-- and run through PREPARE, as 026 to 036 do.
--
-- With "members see only their own cases" on (migrate-032), a member also reads
-- the cases the owner made, and an editor the cases admins made (D2), so a
-- class sees the instructor's base case and the sample. Two things must still
-- stay with the staff:
--   - a staff copy of a student's case (the instructor duplicates B's work to
--     look at it): it must not reach the rest of the class, and
--   - a case the instructor keeps back (an answer key).
-- case_table.hidden_from_members = 1 keeps a case to its creator and the
-- owner and admins, whoever made it. Default 0: nothing changes for an existing
-- case. The app sets it on a staff copy of a case the class cannot read, and
-- the owner or an admin can set it on any case (written to audit_log).

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'case_table' AND COLUMN_NAME = 'hidden_from_members');
SET @sql := IF(@c = 0,
  'ALTER TABLE case_table ADD COLUMN hidden_from_members TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''1 = only its creator, the owner and admins reach it when members see only their own cases (D2)'' AFTER created_by',
  'SELECT ''case_table.hidden_from_members exists''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
