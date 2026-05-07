-- Migration: Fix Chemical Formula Subscripts in Database
-- Description: Update impact_categories table to use proper Unicode subscripts
-- Date: 2025-11-12
-- Author: LCA-PIX v3 Development Team

-- Update impact categories with proper chemical subscripts
UPDATE impact_categories
SET unit = 'kg CO₂-eq'
WHERE category_name = 'Global warming' OR category_name = 'Global Warming';

UPDATE impact_categories
SET unit = 'kg SO₂-eq'
WHERE category_name = 'Acidification';

UPDATE impact_categories
SET unit = 'kg NOₓ-eq'
WHERE category_name = 'Smog formation' OR category_name = 'Photochemical Oxidation';

UPDATE impact_categories
SET unit = 'kg PO₄-eq'
WHERE category_name = 'Eutrophication';

UPDATE impact_categories
SET unit = 'kg N₂O-eq'
WHERE unit = 'kg N2O-eq';

UPDATE impact_categories
SET unit = 'kg CH₄-eq'
WHERE unit = 'kg CH4-eq';

-- Update any existing assessment_impacts records (if they store units separately)
-- This ensures historical data also displays correctly
UPDATE assessment_impacts ai
JOIN impact_categories ic ON ai.category_id = ic.category_id
SET ai.unit = ic.unit
WHERE ai.unit LIKE '%CO2%'
   OR ai.unit LIKE '%SO2%'
   OR ai.unit LIKE '%NOx%'
   OR ai.unit LIKE '%PO4%'
   OR ai.unit LIKE '%N2O%'
   OR ai.unit LIKE '%CH4%';

-- Verify the changes
SELECT
  category_id,
  category_name,
  unit,
  'Updated' as status
FROM impact_categories
WHERE unit LIKE '%₂%' OR unit LIKE '%₄%' OR unit LIKE '%ₓ%'
ORDER BY category_name;

-- Show any categories that might still need manual review
SELECT
  category_id,
  category_name,
  unit,
  'Needs Review' as status
FROM impact_categories
WHERE unit LIKE '%2%'
  AND unit NOT LIKE '%₂%'
  AND unit NOT LIKE '%12%'  -- Exclude valid uses like CFC-12
ORDER BY category_name;
