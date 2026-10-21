-- Migration 034 — a person's own factor for one flow (2026-10-20, education screen E03)
-- Idempotent: CREATE TABLE IF NOT EXISTS, so a second apply changes nothing.
--
-- E03 offers "Use my own number" when the library has no factor for the
-- project's region (or none at all, as for Argon). The number belongs to that
-- one flow, not to the substance, so it never changes anyone else's results.
-- One row per flow and impact category:
--
--   factor_value   impact_unit per one per_unit of the flow (2.1 kg CO2 eq / kg).
--                  Negative is allowed (a credit), and the API keeps it finite.
--   impact_unit    the result unit the number is stated in. The engine uses the
--                  row only when it matches the unit the run's method reports
--                  that category in, and otherwise leaves it out and says so.
--   per_unit       the unit of the flow the number is per. The engine converts
--                  the flow's amount into it, as it does for library factors.
--   source         where the number comes from (required: a run prints it).
--   note           optional reasoning, printed with the source.
--
-- The run marks every contribution that used a row as "Entered by hand", with
-- its source (lib/lca-engine.ts, lib/run-snapshot.ts). Deleting the flow
-- deletes its rows, and deleting the account that entered one keeps the number.

CREATE TABLE IF NOT EXISTS flow_factor_overrides (
  override_id   INT NOT NULL AUTO_INCREMENT,
  flow_id       INT NOT NULL,
  category_id   INT NOT NULL,
  factor_value  DOUBLE NOT NULL COMMENT 'impact_unit per one per_unit of the flow',
  impact_unit   VARCHAR(50) NOT NULL COMMENT 'result unit the number is stated in, e.g. kg CO2 eq',
  per_unit      VARCHAR(50) NOT NULL COMMENT 'flow unit the number is per, e.g. kg',
  source        VARCHAR(255) NOT NULL COMMENT 'where the number comes from',
  note          VARCHAR(1000) NULL DEFAULT NULL,
  created_by    INT NULL DEFAULT NULL COMMENT 'account.id of who entered it',
  created_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (override_id),
  UNIQUE KEY uq_flow_factor_override (flow_id, category_id),
  KEY idx_ffo_category (category_id),
  KEY idx_ffo_created_by (created_by),
  CONSTRAINT fk_ffo_flow FOREIGN KEY (flow_id) REFERENCES flows (flow_id) ON DELETE CASCADE,
  CONSTRAINT fk_ffo_category FOREIGN KEY (category_id) REFERENCES impact_categories (category_id) ON DELETE RESTRICT,
  CONSTRAINT fk_ffo_created_by FOREIGN KEY (created_by) REFERENCES account (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='A person''s own factor for one flow and impact category (E03 "Use my own number")';
