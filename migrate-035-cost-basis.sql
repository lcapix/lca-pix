-- Migration 035 — what each step cost is made of, and where its rate came from
-- (2026-10-20, education screen E14). Idempotent: CREATE TABLE IF NOT EXISTS.
--
-- A step keeps its cost amounts where they always were (component.labor_cost,
-- energy_cost, material_cost, transportation_cost, equipment_cost,
-- overhead_cost), so every reader of those columns is unchanged. This table
-- says how one amount was built: a driver times a rate (0.015 h x $25.83/h),
-- the rate's name and code (Welders/cutters, 51-4121), its region, and its
-- source, one of three kinds:
--
--   reference  the dated reference table in the app (Reference 2026-06)
--   live       a public API answered (BLS OEWS 2025 . live)
--   entered    a person typed the rate or the amount
--
-- Only the server writes "reference" and "live": it looks the rate up itself,
-- so a cost can never claim a source it did not come from. A direct edit of a
-- cost amount drops its row, so a row always explains the amount beside it.
-- `cost_lines` holds the parts of an amount built from several drivers (two energy
-- carriers on one step). A run copies these rows into its snapshot.

CREATE TABLE IF NOT EXISTS component_cost_basis (
  component_id     INT NOT NULL,
  cost_kind        ENUM('labor','energy','material','transportation','equipment','overhead') NOT NULL,
  driver_quantity  DOUBLE NULL DEFAULT NULL COMMENT 'e.g. 0.015 (hours) or 0.12 (kWh)',
  driver_unit      VARCHAR(20) NULL DEFAULT NULL,
  rate             DOUBLE NULL DEFAULT NULL COMMENT 'USD per driver_unit',
  rate_unit        VARCHAR(30) NULL DEFAULT NULL COMMENT 'e.g. $/h, $/kWh',
  rate_label       VARCHAR(120) NULL DEFAULT NULL COMMENT 'e.g. Welders/cutters',
  rate_code        VARCHAR(40) NULL DEFAULT NULL COMMENT 'e.g. SOC 51-4121',
  region           VARCHAR(20) NULL DEFAULT NULL COMMENT 'US, a state code, or a grid region',
  source_kind      ENUM('reference','live','entered') NOT NULL,
  source_name      VARCHAR(120) NULL DEFAULT NULL COMMENT 'e.g. BLS OEWS 2025, Reference',
  vintage          VARCHAR(20) NULL DEFAULT NULL COMMENT 'e.g. 2026-06 or 2025',
  cost_lines       JSON NULL DEFAULT NULL COMMENT 'parts of an amount built from several drivers',
  updated_by       INT NULL DEFAULT NULL COMMENT 'account.id of who set it',
  created_at       TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (component_id, cost_kind),
  KEY idx_ccb_updated_by (updated_by),
  CONSTRAINT fk_ccb_component FOREIGN KEY (component_id) REFERENCES component (component_id) ON DELETE CASCADE,
  CONSTRAINT fk_ccb_updated_by FOREIGN KEY (updated_by) REFERENCES account (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='How each step cost was built and where its rate came from (E14)';
