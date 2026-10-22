-- migrate-020-custom-substances.sql  (idempotent)
-- Substances a person adds by hand. No library has everything, and a student
-- modelling a surfboard or a mattress stops dead when the material is missing.
-- A hand-added substance belongs to whoever added it (it is not pushed into
-- everyone else's picker), and its factor carries a "User-entered" source, so
-- the engine grades it unverified and the run's data-quality statement says so.
--
-- substances.is_custom    1 = added by a person through the app
-- substances.created_by   the account that added it (NULL for library rows)
--
-- MySQL 8 has no ADD COLUMN IF NOT EXISTS, so each column goes through a
-- guarded procedure (safe to re-run), as in migrate-014 and migrate-018.

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

CALL lcapix_add_col('substances', 'is_custom', 'is_custom TINYINT(1) NOT NULL DEFAULT 0');
CALL lcapix_add_col('substances', 'created_by', 'created_by INT NULL');

DROP PROCEDURE lcapix_add_col;

-- Finding a person's own substances is a per-request filter on the picker.
SET @idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'substances'
               AND INDEX_NAME = 'substances_created_by_idx');
SET @s := IF(@idx = 0,
  'CREATE INDEX substances_created_by_idx ON substances (created_by)',
  'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
