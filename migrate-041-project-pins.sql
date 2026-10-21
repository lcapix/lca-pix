-- Migration 041 — pinned projects (2026-10-20, education E19 project switcher)
-- Idempotent: CREATE TABLE IF NOT EXISTS.
--
-- A person pins the projects they open most; the switcher lists them first.
-- A pin belongs to one person and one project they are a member of, so it
-- goes when either is deleted. A pin left behind by a removed member is
-- harmless (the project list only shows projects the person still reaches)
-- and is removed by PUT/DELETE on that project, or with the membership.

CREATE TABLE IF NOT EXISTS project_pins (
  user_id    INT NOT NULL,
  project_id INT NOT NULL,
  pinned_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, project_id),
  KEY idx_pins_project (project_id),
  CONSTRAINT fk_pins_user FOREIGN KEY (user_id) REFERENCES account (id) ON DELETE CASCADE,
  CONSTRAINT fk_pins_project FOREIGN KEY (project_id) REFERENCES project (project_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Projects a person pinned (E19)';
