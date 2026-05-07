#!/bin/bash

# Verify test data in AWS RDS MySQL database
# Connects via EC2 Session Manager

echo "=========================================="
echo "Database Data Verification"
echo "=========================================="
echo ""

DB_HOST="lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com"
DB_USER="lcaadmin"
DB_PASS='EP76017fLefZ8?d!ezTHsN[kA()X'
DB_NAME="lca_v3"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}NOTE: This should be run from EC2 Session Manager terminal${NC}"
echo -e "${YELLOW}If running locally and connection fails, use Session Manager instead${NC}"
echo ""

# Try local connection first
if command -v mysql &> /dev/null; then
    echo "MySQL client found, attempting connection..."
    
    mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" <<'EOSQL'
SELECT '=========================================' AS '';
SELECT 'DATA SUMMARY' AS '';
SELECT '=========================================' AS '';

SELECT 'Users' AS Table_Name, COUNT(*) AS Count FROM account
UNION ALL
SELECT 'Projects', COUNT(*) FROM project
UNION ALL
SELECT 'Cases', COUNT(*) FROM case_table
UNION ALL
SELECT 'Components', COUNT(*) FROM component
UNION ALL
SELECT 'Flows', COUNT(*) FROM flows
UNION ALL
SELECT 'Assessment Runs', COUNT(*) FROM assessment_runs
UNION ALL
SELECT 'Assessment Results', COUNT(*) FROM assessment_results;

SELECT '' AS '';
SELECT '=========================================' AS '';
SELECT 'USERS' AS '';
SELECT '=========================================' AS '';
SELECT id, username, email, account_type, created_at FROM account;

SELECT '' AS '';
SELECT '=========================================' AS '';
SELECT 'PROJECTS' AS '';
SELECT '=========================================' AS '';
SELECT p.project_id, p.project_name, p.description, 
       a.username as owner, p.created_at
FROM project p
LEFT JOIN account a ON p.owner_id = a.id;

SELECT '' AS '';
SELECT '=========================================' AS '';
SELECT 'CASES' AS '';
SELECT '=========================================' AS '';
SELECT c.case_id, c.case_name, c.case_type, c.description,
       p.project_name, c.created_at
FROM case_table c
LEFT JOIN project p ON c.project_id = p.project_id;

SELECT '' AS '';
SELECT '=========================================' AS '';
SELECT 'COMPONENT HIERARCHY' AS '';
SELECT '=========================================' AS '';
SELECT 
    component_id,
    component_name,
    component_type,
    hierarchy_level,
    quantity,
    unit,
    parent_component_id
FROM component
ORDER BY hierarchy_level, component_id;

SELECT '' AS '';
SELECT '=========================================' AS '';
SELECT 'FLOWS (INPUTS/OUTPUTS)' AS '';
SELECT '=========================================' AS '';
SELECT 
    f.flow_id,
    c.component_name,
    s.substance_name,
    f.flow_type,
    f.quantity,
    f.unit,
    f.is_driver
FROM flows f
LEFT JOIN component c ON f.component_id = c.component_id
LEFT JOIN substances s ON f.substance_id = s.substance_id
ORDER BY c.component_name, f.flow_type;

SELECT '' AS '';
SELECT '=========================================' AS '';
SELECT 'ASSESSMENT RUNS' AS '';
SELECT '=========================================' AS '';
SELECT 
    ar.run_id,
    ar.run_name,
    c.case_name,
    ar.calculation_method,
    ar.status,
    ar.run_date,
    a.username as executed_by
FROM assessment_runs ar
LEFT JOIN case_table c ON ar.case_id = c.case_id
LEFT JOIN account a ON ar.executed_by = a.id;

SELECT '' AS '';
SELECT '=========================================' AS '';
SELECT 'ASSESSMENT RESULTS (IMPACTS)' AS '';
SELECT '=========================================' AS '';
SELECT 
    comp.component_name,
    ic.category_name,
    ic.abbreviation,
    ROUND(ares.impact_value, 2) as impact,
    ares.unit
FROM assessment_results ares
LEFT JOIN component comp ON ares.component_id = comp.component_id
LEFT JOIN impact_categories ic ON ares.category_id = ic.category_id
ORDER BY comp.hierarchy_level, ic.category_id;

SELECT '' AS '';
SELECT '=========================================' AS '';
SELECT 'VERIFICATION COMPLETE!' AS '';
SELECT '=========================================' AS '';
EOSQL

else
    echo -e "${YELLOW}MySQL client not found locally.${NC}"
    echo ""
    echo "To verify data, paste this in EC2 Session Manager terminal:"
    echo ""
    cat <<'EOCMD'
mysql -h lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com -u lcaadmin -p'EP76017fLefZ8?d!ezTHsN[kA()X' lca_v3 -e "
SELECT 'USERS:' AS ''; SELECT * FROM account;
SELECT 'PROJECTS:' AS ''; SELECT * FROM project;
SELECT 'CASES:' AS ''; SELECT * FROM case_table;
SELECT 'COMPONENTS:' AS ''; SELECT component_id, component_name, component_type, hierarchy_level FROM component ORDER BY hierarchy_level;
SELECT 'FLOWS:' AS ''; SELECT f.*, s.substance_name FROM flows f LEFT JOIN substances s ON f.substance_id = s.substance_id;
SELECT 'ASSESSMENTS:' AS ''; SELECT * FROM assessment_runs;
SELECT 'RESULTS:' AS ''; SELECT ar.*, c.component_name, ic.category_name FROM assessment_results ar LEFT JOIN component c ON ar.component_id = c.component_id LEFT JOIN impact_categories ic ON ar.category_id = ic.category_id;
"
EOCMD
fi
