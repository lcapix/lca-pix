-- Migration 040 — import lines held for review, kept (2026-10-20, education E12, F2.3, F2.4)
-- Idempotent: CREATE TABLE IF NOT EXISTS.
--
-- An import (POST /api/ingest/apply) holds a line it cannot place: no confirmed
-- substance, no step to put it on, or a unit the substance cannot take. Until
-- now the held lines came back once in the response (held_details) and were
-- lost. Each is now kept as written in the document, so Home can say "3 lines
-- held" and a person can resolve one (a flow or cost is created through the
-- same checks as any other) or dismiss it. Deleting the case deletes its held
-- lines. A resolved line keeps the flow or step it became (SET NULL if that is
-- deleted later).

CREATE TABLE IF NOT EXISTS import_held_lines (
  held_id                INT NOT NULL AUTO_INCREMENT,
  case_id                INT NOT NULL,
  line_kind              ENUM('flow','cost') NOT NULL,
  reason                 ENUM('no_substance','no_step','unit') NOT NULL,
  step_name              VARCHAR(255) NULL DEFAULT NULL COMMENT 'the step as the document names it',
  substance_text         VARCHAR(500) NULL DEFAULT NULL COMMENT 'the material as the document names it',
  substance_id           INT NULL DEFAULT NULL COMMENT 'a match the reviewer had, if any',
  direction              ENUM('input','output') NULL DEFAULT NULL,
  quantity               DOUBLE NULL DEFAULT NULL,
  unit                   VARCHAR(50) NULL DEFAULT NULL,
  cost_category          VARCHAR(20) NULL DEFAULT NULL,
  amount                 DECIMAL(15,2) NULL DEFAULT NULL,
  hours                  DECIMAL(10,4) NULL DEFAULT NULL,
  occupation             VARCHAR(10) NULL DEFAULT NULL,
  provenance             VARCHAR(1000) NULL DEFAULT NULL COMMENT 'where in the document the line was read',
  status                 ENUM('held','resolved','dismissed') NOT NULL DEFAULT 'held',
  resolved_flow_id       INT NULL DEFAULT NULL,
  resolved_component_id  INT NULL DEFAULT NULL,
  created_by             INT NULL DEFAULT NULL,
  resolved_by            INT NULL DEFAULT NULL,
  created_at             TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at            TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (held_id),
  KEY idx_held_case_status (case_id, status),
  KEY idx_held_substance (substance_id),
  KEY idx_held_flow (resolved_flow_id),
  KEY idx_held_component (resolved_component_id),
  KEY idx_held_created_by (created_by),
  KEY idx_held_resolved_by (resolved_by),
  CONSTRAINT fk_held_case FOREIGN KEY (case_id) REFERENCES case_table (case_id) ON DELETE CASCADE,
  CONSTRAINT fk_held_substance FOREIGN KEY (substance_id) REFERENCES substances (substance_id) ON DELETE SET NULL,
  CONSTRAINT fk_held_flow FOREIGN KEY (resolved_flow_id) REFERENCES flows (flow_id) ON DELETE SET NULL,
  CONSTRAINT fk_held_component FOREIGN KEY (resolved_component_id) REFERENCES component (component_id) ON DELETE SET NULL,
  CONSTRAINT fk_held_created_by FOREIGN KEY (created_by) REFERENCES account (id) ON DELETE SET NULL,
  CONSTRAINT fk_held_resolved_by FOREIGN KEY (resolved_by) REFERENCES account (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Import lines held for review (E12 "lines held"), kept until resolved or dismissed';
