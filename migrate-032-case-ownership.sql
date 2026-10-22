-- Migration 032 — case ownership and "members see only their own cases" (2026-09-30, B-A1)
-- Idempotent. Plain SQL (no DELIMITER): each change is guarded by an
-- information_schema check and run through PREPARE, as 026/030/031 do, so the
-- file applies the same way through the mysql CLI and through mysql2, and a
-- second apply by hand changes nothing.
--
-- In a class project every student is a member (editor) of the instructor's
-- project, and every member could read and edit every other student's case.
-- Two columns let a project keep each member's cases to themselves:
--
--   case_table.created_by           who made the case (account.id). NULL when
--                                   that account is deleted (ON DELETE SET NULL):
--                                   the case stays, and the owner and admins
--                                   still reach it.
--   project.members_see_own_cases   1 = editors and viewers reach only the cases
--                                   they created; the owner and admin members
--                                   reach all of them. Default 0, so nothing
--                                   changes for an existing project until its
--                                   owner or an admin turns it on.
--
-- Existing cases are backfilled to their project's owner: nobody knows who
-- made them, and the owner reaches every case anyway. The backfill only fills
-- NULLs, so a re-apply never overwrites an owner the app recorded. (A NULL left
-- by a deleted account would be filled with the owner again, which grants
-- nobody anything new: the owner and admins already reach that case.)

-- 1) case_table.created_by ------------------------------------------------------
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'case_table' AND COLUMN_NAME = 'created_by');
SET @sql := IF(@c = 0,
  'ALTER TABLE case_table ADD COLUMN created_by INT NULL DEFAULT NULL COMMENT ''account.id of the member who made the case (B-A1)'' AFTER project_id',
  'SELECT ''case_table.created_by exists''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 2) its foreign key (the key also gives the column its index) -------------------
SET @c := (SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS
           WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'case_table'
             AND CONSTRAINT_NAME = 'fk_case_table_created_by');
SET @sql := IF(@c = 0,
  'ALTER TABLE case_table ADD CONSTRAINT fk_case_table_created_by FOREIGN KEY (created_by) REFERENCES account (id) ON DELETE SET NULL',
  'SELECT ''fk_case_table_created_by exists''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 3) backfill: every case nobody owns belongs to its project's owner -------------
-- updated_at is assigned to itself so the backfill does not bump every case's
-- "last activity" (the column is ON UPDATE CURRENT_TIMESTAMP).
UPDATE case_table c
  JOIN project p ON p.project_id = c.project_id
   SET c.created_by = p.owner_id, c.updated_at = c.updated_at
 WHERE c.created_by IS NULL;

-- 4) project.members_see_own_cases ----------------------------------------------
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project' AND COLUMN_NAME = 'members_see_own_cases');
SET @sql := IF(@c = 0,
  'ALTER TABLE project ADD COLUMN members_see_own_cases TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''1 = editors and viewers reach only the cases they created (B-A1)''',
  'SELECT ''project.members_see_own_cases exists''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
