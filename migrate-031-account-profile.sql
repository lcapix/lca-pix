-- Migration 031 — account profile columns (2026-09-30, audit AUTH-7)
-- Idempotent. Plain SQL (no DELIMITER): each column is guarded by an
-- information_schema check and added through PREPARE, as 009/010/026/027 do,
-- so the file applies the same way through the mysql CLI and through mysql2.
--
-- app/api/auth/profile/route.ts (GET/PUT) and app/api/auth/google/route.ts read
-- and write six account columns that no migration created: the dev and
-- production databases got them by hand, and a database built from the
-- migrations alone failed every profile request with "Unknown column". The
-- definitions below are the ones the dev database has (July 2026 dump), in the
-- same position (after username), so an existing database is left exactly as
-- it is and a fresh one ends up identical to it.
--
--   full_name     VARCHAR(120)  shown in the app bar; seeded from Google on OAuth signup
--   company       VARCHAR(160)  required by onboarding
--   role          VARCHAR(120)  job title, free text
--   use_case      VARCHAR(60)   onboarding choice
--   country       VARCHAR(80)
--   onboarded_at  TIMESTAMP     set on the first profile save; NULL = onboarding pending
--
-- Numbered 031 because 030 is reserved for a change being written in
-- parallel. The runner only orders by number; a gap is harmless.

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'account' AND COLUMN_NAME = 'full_name');
SET @sql := IF(@c = 0,
  'ALTER TABLE account ADD COLUMN full_name VARCHAR(120) NULL AFTER username',
  'SELECT ''account.full_name exists''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'account' AND COLUMN_NAME = 'company');
SET @sql := IF(@c = 0,
  'ALTER TABLE account ADD COLUMN company VARCHAR(160) NULL AFTER full_name',
  'SELECT ''account.company exists''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'account' AND COLUMN_NAME = 'role');
SET @sql := IF(@c = 0,
  'ALTER TABLE account ADD COLUMN role VARCHAR(120) NULL AFTER company',
  'SELECT ''account.role exists''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'account' AND COLUMN_NAME = 'use_case');
SET @sql := IF(@c = 0,
  'ALTER TABLE account ADD COLUMN use_case VARCHAR(60) NULL AFTER role',
  'SELECT ''account.use_case exists''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'account' AND COLUMN_NAME = 'country');
SET @sql := IF(@c = 0,
  'ALTER TABLE account ADD COLUMN country VARCHAR(80) NULL AFTER use_case',
  'SELECT ''account.country exists''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'account' AND COLUMN_NAME = 'onboarded_at');
SET @sql := IF(@c = 0,
  'ALTER TABLE account ADD COLUMN onboarded_at TIMESTAMP NULL DEFAULT NULL AFTER country',
  'SELECT ''account.onboarded_at exists''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
