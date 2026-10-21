-- Migration 039 — four library substances the sample study uses (2026-10-20, education E02, E04)
-- Idempotent: each insert runs only when no library row of that name exists.
--
-- The sample (painted steel bracket) records argon, powder coating, packaging
-- tape and a scrap steel output. The library had none of them. They are added
-- as library substances WITH NO impact factor: a flow of one is counted and
-- adds nothing ("Counted, no climate factor"), which is the truth for these
-- materials in this library, and the run's data-quality statement names them.
-- Nothing here invents a number.
--
-- substance_name is unique across library and private (custom) substances. If
-- a person already made a private substance with one of these names, the
-- library row is added as "<name> (library)", so the sample never uses anyone's
-- private substance (the builder looks for library rows only, is_custom = 0).

INSERT INTO substances (substance_name, category, unit, description, is_custom)
SELECT IF(EXISTS (SELECT 1 FROM substances s1 WHERE s1.substance_name = 'Argon'), 'Argon (library)', 'Argon'),
       'resource', 'kg',
       'Shielding gas for welding. No impact factor in the library: counted, adds nothing. Added for the sample study.',
       0
  FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM substances s2
                    WHERE s2.substance_name IN ('Argon', 'Argon (library)') AND s2.is_custom = 0);

INSERT INTO substances (substance_name, category, unit, description, is_custom)
SELECT IF(EXISTS (SELECT 1 FROM substances s1 WHERE s1.substance_name = 'Powder coating'), 'Powder coating (library)', 'Powder coating'),
       'resource', 'kg',
       'Polyester powder paint, applied and cured. No impact factor in the library: counted, adds nothing. Added for the sample study.',
       0
  FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM substances s2
                    WHERE s2.substance_name IN ('Powder coating', 'Powder coating (library)') AND s2.is_custom = 0);

INSERT INTO substances (substance_name, category, unit, description, is_custom)
SELECT IF(EXISTS (SELECT 1 FROM substances s1 WHERE s1.substance_name = 'Packaging tape'), 'Packaging tape (library)', 'Packaging tape'),
       'resource', 'kg',
       'Carton sealing tape. No impact factor in the library: counted, adds nothing. Added for the sample study.',
       0
  FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM substances s2
                    WHERE s2.substance_name IN ('Packaging tape', 'Packaging tape (library)') AND s2.is_custom = 0);

INSERT INTO substances (substance_name, category, unit, description, is_custom)
SELECT IF(EXISTS (SELECT 1 FROM substances s1 WHERE s1.substance_name = 'Scrap steel'), 'Scrap steel (library)', 'Scrap steel'),
       'waste', 'kg',
       'Offcuts and trimmings sent to recycling. No impact factor in the library: counted, adds nothing. Added for the sample study.',
       0
  FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM substances s2
                    WHERE s2.substance_name IN ('Scrap steel', 'Scrap steel (library)') AND s2.is_custom = 0);

-- The process library's welding template names argon for its shielding-gas
-- line (migrate-023), which resolved to nothing while the library had no
-- argon. Link it here by the same rule 023 uses (the first substance named
-- exactly 'Argon'), so the chain gives the same rows whether or not 023 runs
-- again after this migration. Changes nothing when already linked.
UPDATE process_template_flows ptf
  JOIN process_templates pt ON pt.template_id = ptf.template_id
   SET ptf.substance_id = (SELECT s.substance_id FROM substances s WHERE s.substance_name = 'Argon' LIMIT 1)
 WHERE pt.is_custom = 0
   AND pt.template_name = 'MIG / TIG welding'
   AND ptf.substance_hint = 'Shielding gas: argon or an argon mix, m3'
   AND ptf.substance_id IS NULL;
