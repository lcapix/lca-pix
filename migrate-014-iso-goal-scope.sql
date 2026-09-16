-- migrate-014-iso-goal-scope.sql  (idempotent)
-- ISO 14044 phase 1 (goal & scope) and allocation, so an assessment records
-- what it is FOR and what it covers: the fields an academic reviewer checks
-- first. Compliance with ISO 14040/14044 is the stated goal (2026-09-15).
--
-- Where each field lives follows industry practice (SimaPro, openLCA, One Click
-- LCA, Sustainable Minds): the study states its goal, functional unit and
-- boundary once, every alternative compared in it shares them, and each
-- alternative (case) states its own reference flow.
--
-- project  (the study)
--   goal_statement       4.2.2   intended application, reasons, audience, comparative use
--   functional_unit      4.2.3.2 the quantified function every case is measured against
--   system_boundary      4.2.3.3 cradle-to-gate | gate-to-gate | cradle-to-grave
--   boundary_notes       4.2.3.3 exclusions and cut-off criteria
-- case_table  (one alternative)
--   reference_flow       amount of product needed to fulfil one functional unit
--   reference_flow_unit  unit of that amount (e.g. "bike")
--   modeled_output       amount of the same product the case's entered data produce
--                        (1 for a per-unit model, 52000 for a year of plant data)
--   result per functional unit = case total x reference_flow / modeled_output
-- component
--   allocation_method    4.3.4   none | physical | economic | system_expansion
--   allocation_factor    share (0..1] of the node's burden assigned to the product;
--                        applies to everything under the node
--   allocation_note      the basis (e.g. "by mass: 80 kg product / 100 kg total output")
--
-- MySQL 8 has no ADD COLUMN IF NOT EXISTS, so each column goes through a
-- guarded procedure (safe to re-run).

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

CALL lcapix_add_col('project', 'goal_statement', 'goal_statement TEXT NULL');
CALL lcapix_add_col('project', 'functional_unit', 'functional_unit VARCHAR(255) NULL');
CALL lcapix_add_col('project', 'system_boundary', "system_boundary ENUM('cradle-to-gate','gate-to-gate','cradle-to-grave') NOT NULL DEFAULT 'cradle-to-gate'");
CALL lcapix_add_col('project', 'boundary_notes', 'boundary_notes TEXT NULL');
CALL lcapix_add_col('case_table', 'reference_flow', 'reference_flow DECIMAL(15,6) NOT NULL DEFAULT 1.000000');
CALL lcapix_add_col('case_table', 'reference_flow_unit', 'reference_flow_unit VARCHAR(50) NULL');
CALL lcapix_add_col('case_table', 'modeled_output', 'modeled_output DECIMAL(15,6) NOT NULL DEFAULT 1.000000');
CALL lcapix_add_col('component', 'allocation_method', "allocation_method ENUM('none','physical','economic','system_expansion') NOT NULL DEFAULT 'none'");
CALL lcapix_add_col('component', 'allocation_factor', 'allocation_factor DECIMAL(8,6) NOT NULL DEFAULT 1.000000');
CALL lcapix_add_col('component', 'allocation_note', 'allocation_note VARCHAR(500) NULL');

DROP PROCEDURE lcapix_add_col;
