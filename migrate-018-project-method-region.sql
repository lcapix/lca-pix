-- migrate-018-project-method-region.sql  (idempotent)
-- The study's impact method and region. ISO 14044 4.2.3 makes the LCIA
-- methodology and the geographical coverage scope choices, and the
-- new-project form has always asked for both, but they were not stored: every
-- run used CML 2001 / Global unless the run dialog was changed. Runs now
-- default to the project's method and the case's region; a case starts in the
-- project's region and can be run for another one to compare.
--
-- project.lcia_method  a method with factors loaded: 'CML 2001',
--                      'ReCiPe Midpoint (H)' or 'TRACI 2.1'
-- project.region_code  engine region code: 'Global', 'US' or 'EU'
-- (case_table.region_code already exists.)
--
-- MySQL 8 has no ADD COLUMN IF NOT EXISTS, so each column goes through a
-- guarded procedure (safe to re-run), as in migrate-014.

DROP PROCEDURE IF EXISTS lcapix_add_col;
DELIMITER //
CREATE PROCEDURE lcapix_add_col(IN tbl VARCHAR(64), IN col VARCHAR(64), IN ddl TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col
  ) THEN
    SET @s = CONCAT('ALTER TABLE ', tbl, ' ADD COLUMN ', ddl);
    PREPARE st FROM @s;
    EXECUTE st;
    DEALLOCATE PREPARE st;
  END IF;
END //
DELIMITER ;

CALL lcapix_add_col('project', 'lcia_method', 'lcia_method VARCHAR(64) NULL');
CALL lcapix_add_col('project', 'region_code', 'region_code VARCHAR(32) NULL');

DROP PROCEDURE lcapix_add_col;
