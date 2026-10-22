-- Migration 033 — a flow may have no amount yet (2026-10-20, education screens E03/E04)
-- Idempotent. Plain SQL (no DELIMITER): the change is guarded by an
-- information_schema check and run through PREPARE, as 026/030/032 do, so the
-- file applies the same way through the mysql CLI and through mysql2, and a
-- second apply changes nothing.
--
-- A flow can now be recorded before its amount is known: a process template
-- lists the inputs a step needs, a student adds the flow and works out the
-- amount later, or a document names an input without a quantity. NULL means
-- "needs an amount". The engine leaves such a flow out of a run and counts it,
-- and the data-quality statement and the report name it (lib/lca-engine.ts).
-- A stored number is never changed: only the column's nullability moves.

SET @n := (SELECT IS_NULLABLE FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'flows'
             AND COLUMN_NAME = 'quantity');
SET @sql := IF(@n = 'NO',
  'ALTER TABLE flows MODIFY COLUMN quantity DOUBLE NULL DEFAULT NULL COMMENT ''Flow amount in `unit`; NULL = needs an amount (left out of a run, counted)''',
  'SELECT ''flows.quantity already nullable (or table missing)''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
