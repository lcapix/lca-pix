-- The write-up's third field, Limits (ISO 14044 4.5 and 5.2: what the study
-- cannot say), beside Interpretation and Assumptions. Saved with an explicit
-- Save and printed in the report. Nullable: a case with no limits written
-- reads "Not written yet". Runs twice without change.

ALTER TABLE case_table ADD COLUMN IF NOT EXISTS limitations text COLLATE ci;

COMMENT ON COLUMN case_table.limitations IS 'The author''s own limits of the study, printed in the report (write-up)';
