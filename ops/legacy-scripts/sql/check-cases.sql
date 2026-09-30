-- Check all cases in project 1
USE lca_v3;

SELECT 
    case_id,
    case_name,
    case_type,
    description,
    created_at
FROM case_table
WHERE project_id = 1
ORDER BY case_type, case_id;
