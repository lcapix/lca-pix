-- Which column is which, kept per project and header layout (lib/ingest/column-fields.ts).
-- When a spreadsheet's headers are not ones the reader knows, the person says
-- what each column holds; the next file in the same project laid out the same
-- way (same headers, any order or case) reads in with that choice, no asking.
-- `columns` is the person's choice, column -> field ('ignore' leaves one out).
-- Goes with its project. Runs twice without change.

CREATE TABLE IF NOT EXISTS import_column_map (
  project_id integer NOT NULL REFERENCES project (project_id) ON DELETE CASCADE,
  connector character varying(32) NOT NULL,
  header_signature character varying(64) NOT NULL,
  columns jsonb NOT NULL,
  saved_by integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, connector, header_signature)
);

COMMENT ON TABLE import_column_map IS 'A person''s column choice for a spreadsheet layout, reused for the next file with the same headers in the project';
