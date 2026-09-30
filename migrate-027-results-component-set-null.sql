-- Migration 027 — keep run results when a step is deleted (2026-09-29, audit RUN-1)
-- Idempotent. Plain SQL (no DELIMITER): guarded PREPARE statements, as 009/010.
--
-- assessment_results.component_id referenced component(component_id) with
-- ON DELETE CASCADE, so deleting a step from a case erased that step's rows
-- from every historical run: the run's totals shrank while its frozen flow
-- table still listed the step. Runs are frozen now (snapshot v3 carries the
-- totals and the per-step rows), and the stored rows must survive too: the
-- foreign key becomes ON DELETE SET NULL, which needs a nullable column.
--
-- Order: drop the cascading key (its name differs between databases, so it is
-- looked up in information_schema), make the column nullable, detach any
-- orphan rows, then add the SET NULL key under a fixed name. A second run finds
-- the SET NULL key and a nullable column and changes nothing.

-- 1) Drop a foreign key on component_id whose delete rule is not SET NULL ----
SET @fk := (SELECT rc.CONSTRAINT_NAME
              FROM information_schema.REFERENTIAL_CONSTRAINTS rc
              JOIN information_schema.KEY_COLUMN_USAGE k
                ON k.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
               AND k.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
               AND k.TABLE_NAME = rc.TABLE_NAME
             WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
               AND rc.TABLE_NAME = 'assessment_results'
               AND rc.REFERENCED_TABLE_NAME = 'component'
               AND k.COLUMN_NAME = 'component_id'
               AND rc.DELETE_RULE <> 'SET NULL'
             LIMIT 1);
SET @sql := IF(@fk IS NOT NULL,
  CONCAT('ALTER TABLE assessment_results DROP FOREIGN KEY `', @fk, '`'),
  'SELECT ''no cascading assessment_results.component_id key to drop''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 2) Nullable component_id ---------------------------------------------------
SET @n := (SELECT IS_NULLABLE FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessment_results'
              AND COLUMN_NAME = 'component_id');
SET @sql := IF(@n = 'NO',
  'ALTER TABLE assessment_results MODIFY COLUMN component_id INT NULL COMMENT ''Step the row was computed for; NULL once the step is deleted (the run snapshot keeps its name and stage)''',
  'SELECT ''assessment_results.component_id already nullable (or table missing)''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 3) Rows pointing at steps that no longer exist (possible where no key was
--    enforced) are detached, so the key in step 4 can be created.
SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessment_results'
                AND COLUMN_NAME = 'component_id' AND IS_NULLABLE = 'YES');
SET @sql := IF(@has = 1,
  'UPDATE assessment_results ar LEFT JOIN component c ON c.component_id = ar.component_id SET ar.component_id = NULL WHERE ar.component_id IS NOT NULL AND c.component_id IS NULL',
  'SELECT ''component_id not nullable; orphan cleanup skipped''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 4) Add the SET NULL key when no key on component_id exists -----------------
SET @k := (SELECT COUNT(*)
             FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessment_results'
              AND COLUMN_NAME = 'component_id' AND REFERENCED_TABLE_NAME = 'component');
SET @sql := IF(@k = 0 AND @has = 1,
  'ALTER TABLE assessment_results ADD CONSTRAINT fk_assessment_results_component FOREIGN KEY (component_id) REFERENCES component (component_id) ON DELETE SET NULL',
  'SELECT ''assessment_results.component_id key already present (or column not nullable)''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Check (informational): the delete rule now in force.
SELECT rc.CONSTRAINT_NAME, rc.DELETE_RULE
  FROM information_schema.REFERENTIAL_CONSTRAINTS rc
 WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
   AND rc.TABLE_NAME = 'assessment_results'
   AND rc.REFERENCED_TABLE_NAME = 'component';
