-- A flow's own life-cycle stage (ISO 14040/14044: the burden of a material
-- belongs to raw material acquisition even when the step that uses it is
-- production). Null means "use the rule" (lib/life-cycle.ts flowStage): a
-- material going in is Materials; energy, transport and every output follow
-- their step's stage. A person sets it only to override the rule.
-- Runs twice without change.

ALTER TABLE flows ADD COLUMN IF NOT EXISTS life_cycle_stage character varying(32) COLLATE ci;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flows_life_cycle_stage_check') THEN
    ALTER TABLE flows ADD CONSTRAINT flows_life_cycle_stage_check
      CHECK (life_cycle_stage IS NULL OR life_cycle_stage IN ('materials', 'production', 'distribution', 'use', 'end_of_life'));
  END IF;
END $$;

COMMENT ON COLUMN flows.life_cycle_stage IS 'Set by a person to override the stage rule; null = materials for a material input, else the step''s stage';

-- The sample study put its cutting steps in Materials so the steel would count
-- there: a step-level stand-in for the flow rule above. With flow stages the
-- steel counts in Materials by its flow, and the cutting, shearing and
-- deburring are the plant's own work: Production. Only in sample projects
-- (the sample and the copies made inside it), only these three steps, and only
-- where they still say Materials, so a stage a student chose stays.
UPDATE component c
   SET life_cycle_stage = 'production'
  FROM case_table ct
  JOIN project p ON p.project_id = ct.project_id
 WHERE c.case_id = ct.case_id
   AND p.is_sample = 1
   AND c.component_name IN ('10. Cut blank', 'Shear blank', 'Deburr edges')
   AND c.life_cycle_stage = 'materials';
