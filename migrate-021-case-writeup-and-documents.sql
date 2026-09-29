-- migrate-021-case-writeup-and-documents.sql  (idempotent)
--
-- Three things the classroom needs, all hanging off the case:
--
-- 1. case_table.interpretation  the student's own reading of the result, and
--    case_table.assumptions     what they assumed and what they left out.
--    ISO 14044's reporting clause expects both, and a report made only of
--    computed output is not a hand-in: the judgement is the assignment.
--
-- 2. case_table.learning_state  JSON progress for the guided lessons (which
--    lesson is done, the answers given, the prediction made before the first
--    run). Kept on the case so an instructor sees the work next to the model.
--
-- 3. case_documents            the documents a case was built from. Today the
--    importer reads a file in memory and drops it, so a student cannot look
--    back at the routing or BOM they are typing from, and a flow cannot link
--    to the line it came from. Text only (no binaries), capped by the column
--    type, which is enough to read from and to search.

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

CALL lcapix_add_col('case_table', 'interpretation', 'interpretation TEXT NULL');
CALL lcapix_add_col('case_table', 'assumptions', 'assumptions TEXT NULL');
CALL lcapix_add_col('case_table', 'learning_state', 'learning_state JSON NULL');

DROP PROCEDURE lcapix_add_col;

CREATE TABLE IF NOT EXISTS case_documents (
  document_id   INT AUTO_INCREMENT PRIMARY KEY,
  case_id       INT NOT NULL,
  filename      VARCHAR(255) NOT NULL,
  doc_type      VARCHAR(64) NULL COMMENT 'doc-types registry id: routing, bom, equipment, itac, epd, sds',
  content       MEDIUMTEXT NULL COMMENT 'the document as text, for the reference pane and provenance',
  uploaded_by   INT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY case_documents_case_idx (case_id),
  CONSTRAINT case_documents_case_fk FOREIGN KEY (case_id)
    REFERENCES case_table (case_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Documents a case was built from, kept so students can read from them';
