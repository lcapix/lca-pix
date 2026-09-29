-- migrate-022-stages-processes-variants.sql  (idempotent)
--
-- Everything the classroom rounds need from the schema, in one apply:
--
-- 1. component.life_cycle_stage   which stage of the product's life a step
--    belongs to. Until now every case was manufacturing only, so the first
--    question a design course asks ("what about the use phase?") had no answer
--    in the model at all. A stage is a label on a step, not a new tree: the
--    engine groups results by it, the report prints the split, and the boundary
--    declared in goal & scope says which stages are expected.
--
-- 2. flows.transport_*            a transport leg is entered as mass x distance
--    and stored as tonne-km, which cannot be read back (finding #70). Keeping
--    the two numbers beside the result makes the flow checkable.
--
-- 3. process_templates            a process in DRIVER UNITS (laser cutting per
--    minute, powder coating per square metre): the patent's ECP concept and the
--    one thing Sustainable Minds has that we have nothing of. A template is a
--    named process whose flows are stated per unit of its driver; adding it to
--    a step multiplies by the driver quantity.
--
-- 4. substances.variant_of        material variants (EAF steel, recycled
--    aluminum) grouped under the material they are a version of, so "switch to
--    recycled" is a picker choice rather than a hand edit.
--
-- 5. case_table.is_final          the student says which case is the hand-in.
--
-- MySQL 8 has no ADD COLUMN IF NOT EXISTS, so each column goes through a
-- guarded procedure, as in migrate-014, 018, 020 and 021.

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

-- 1. Life-cycle stage. NULL means the step was entered before stages existed
--    and is read as production, which is what every existing case is.
CALL lcapix_add_col(
  'component',
  'life_cycle_stage',
  "life_cycle_stage VARCHAR(32) NULL COMMENT 'materials | production | distribution | use | end_of_life'"
);

-- 2. What a transport leg was computed from (finding #70).
CALL lcapix_add_col('flows', 'transport_mass_kg', 'transport_mass_kg DECIMAL(18,6) NULL');
CALL lcapix_add_col('flows', 'transport_distance_km', 'transport_distance_km DECIMAL(18,3) NULL');
CALL lcapix_add_col('flows', 'transport_mode', 'transport_mode VARCHAR(40) NULL');

-- 4. Material variants: which material this is a version of, and its label.
CALL lcapix_add_col('substances', 'variant_of', 'variant_of INT NULL');
CALL lcapix_add_col(
  'substances',
  'variant_label',
  "variant_label VARCHAR(80) NULL COMMENT 'e.g. Recycled content 75%, EAF route'"
);

-- 5. The hand-in.
CALL lcapix_add_col('case_table', 'is_final', 'is_final TINYINT(1) NOT NULL DEFAULT 0');
CALL lcapix_add_col('case_table', 'finalized_at', 'finalized_at TIMESTAMP NULL');

DROP PROCEDURE lcapix_add_col;

-- 3. A process stated in its own driver unit, with the flows it draws per unit
--    of that driver. Seeded rows carry a source_reference like every factor in
--    this database; a row a user adds carries their id and is theirs alone.
CREATE TABLE IF NOT EXISTS process_templates (
  template_id      INT AUTO_INCREMENT PRIMARY KEY,
  template_name    VARCHAR(160) NOT NULL,
  process_family   VARCHAR(64) NULL COMMENT 'cutting | forming | joining | finishing | heat | handling',
  driver_unit      VARCHAR(32) NOT NULL COMMENT 'the unit the flows are stated per: min, h, m2, kg, unit',
  driver_label     VARCHAR(120) NULL COMMENT 'what to measure, e.g. cutting time at the machine',
  description      TEXT NULL,
  source_reference TEXT NULL,
  is_custom        TINYINT(1) NOT NULL DEFAULT 0,
  created_by       INT NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY process_templates_name_uq (template_name),
  KEY process_templates_created_by_idx (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Processes in driver units: flows per minute, per m2, per kg';

-- A line of a template. Two things are deliberately nullable:
--
--   substance_id      a template may name something the catalog does not hold
--                     yet (powder coating material, compressed air). The line
--                     still teaches that the process consumes it, and the
--                     student adds the substance by hand when they get to it.
--   amount_per_driver  a template is a checklist first: it says WHAT a process
--                     of this kind consumes and in which unit. An amount is
--                     filled in only where it can be stated with its source or
--                     computed from the machine in front of the student. A NULL
--                     amount is asked for at the moment the template is used,
--                     which is honest: we do not know their machine.
CREATE TABLE IF NOT EXISTS process_template_flows (
  template_flow_id INT AUTO_INCREMENT PRIMARY KEY,
  template_id      INT NOT NULL,
  substance_id     INT NULL,
  substance_hint   VARCHAR(160) NULL COMMENT 'what to look for when no catalog row exists yet',
  flow_type        VARCHAR(16) NOT NULL DEFAULT 'input' COMMENT 'input | output',
  amount_per_driver DECIMAL(18,8) NULL,
  unit             VARCHAR(32) NOT NULL,
  note             VARCHAR(255) NULL COMMENT 'where to read the number off, or the assumption behind it',
  sort_order       INT NOT NULL DEFAULT 0,
  KEY process_template_flows_template_idx (template_id),
  CONSTRAINT process_template_flows_template_fk FOREIGN KEY (template_id)
    REFERENCES process_templates (template_id) ON DELETE CASCADE,
  CONSTRAINT process_template_flows_substance_fk FOREIGN KEY (substance_id)
    REFERENCES substances (substance_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='What one unit of a process driver consumes or emits';
