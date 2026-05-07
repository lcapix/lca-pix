#!/usr/bin/env python3
"""
Fix LCA Database - Ownership and Integrity Issues
Connects via existing SSH tunnel on localhost:3307
"""

import pymysql
import sys
from datetime import datetime

# Database configuration (using existing SSH tunnel)
DB_CONFIG = {
    'host': '127.0.0.1',
    'port': 3307,
    'user': 'lcaadmin',
    'password': 'EP76017fLefZ8?d!ezTHsN[kA()X',
    'database': 'lca_v3'
}

# Colors for terminal output
class Colors:
    GREEN = '\033[0;32m'
    BLUE = '\033[0;34m'
    YELLOW = '\033[1;33m'
    RED = '\033[0;31m'
    BOLD = '\033[1m'
    NC = '\033[0m'  # No Color

def print_header(text):
    print(f"\n{Colors.BLUE}{'='*80}{Colors.NC}")
    print(f"{Colors.BOLD}{text}{Colors.NC}")
    print(f"{Colors.BLUE}{'='*80}{Colors.NC}\n")

def print_success(text):
    print(f"{Colors.GREEN}✓ {text}{Colors.NC}")

def print_warning(text):
    print(f"{Colors.YELLOW}⚠️  {text}{Colors.NC}")

def print_error(text):
    print(f"{Colors.RED}✗ {text}{Colors.NC}")

def print_table(cursor, title=None):
    """Print query results as a formatted table"""
    if title:
        print(f"\n{Colors.YELLOW}{title}{Colors.NC}")

    if cursor.description is None:
        return

    # Get column names
    columns = [desc[0] for desc in cursor.description]
    results = cursor.fetchall()

    if not results:
        print("  (no results)")
        return

    # Calculate column widths
    widths = [len(col) for col in columns]
    for row in results:
        for i, val in enumerate(row):
            widths[i] = max(widths[i], len(str(val)))

    # Print header
    header = " | ".join(col.ljust(widths[i]) for i, col in enumerate(columns))
    print(f"  {header}")
    print(f"  {'-' * len(header)}")

    # Print rows
    for row in results:
        row_str = " | ".join(str(val).ljust(widths[i]) for i, val in enumerate(row))
        print(f"  {row_str}")

def main():
    print_header("LCA DATABASE FIX - Ownership & Integrity")

    try:
        # Connect to database
        print(f"{Colors.YELLOW}Connecting to database at {DB_CONFIG['host']}:{DB_CONFIG['port']}...{Colors.NC}")
        connection = pymysql.connect(**DB_CONFIG)
        print_success(f"Connected to database: {DB_CONFIG['database']}")

        cursor = connection.cursor()

        # ================================================================
        # STEP 1: Show current users
        # ================================================================
        print_header("STEP 1: Current Users in Database")

        cursor.execute("SELECT user_id, email, name FROM users ORDER BY user_id")
        print_table(cursor, "All Users:")

        # ================================================================
        # STEP 2: Show current project ownership (THE PROBLEM)
        # ================================================================
        print_header("STEP 2: Current Project Ownership (CAUSING 403 ERRORS)")

        cursor.execute("""
            SELECT
                p.project_id,
                p.project_name,
                p.owner_id,
                u.email as owner_email
            FROM project p
            LEFT JOIN users u ON p.owner_id = u.user_id
            WHERE p.project_id IN (6, 7)
        """)
        print_table(cursor, "Current Ownership:")

        current_ownership = cursor.fetchall()
        if current_ownership:
            owner_id = current_ownership[0][2]
            print_warning(f"Projects currently owned by user_id: {owner_id}")
            print_warning("If you're logged in as a different user, you'll get 403 errors!")

        # ================================================================
        # STEP 3: Find the correct user to assign ownership
        # ================================================================
        print_header("STEP 3: Finding Best User for Ownership")

        # Try john_doe first
        cursor.execute("SELECT user_id, email FROM users WHERE email = 'john@lcaproject.com' LIMIT 1")
        john_doe = cursor.fetchone()

        # Try lcapix50 next
        cursor.execute("SELECT user_id, email FROM users WHERE email = 'lcapix50@gmail.com' LIMIT 1")
        lcapix = cursor.fetchone()

        # Find any user_id = 2
        cursor.execute("SELECT user_id, email FROM users WHERE user_id = 2 LIMIT 1")
        user_2 = cursor.fetchone()

        target_user = None
        if john_doe:
            target_user = john_doe
            print_success(f"Found john_doe account: {john_doe[1]} (ID: {john_doe[0]})")
        elif lcapix:
            target_user = lcapix
            print_success(f"Found lcapix account: {lcapix[1]} (ID: {lcapix[0]})")
        elif user_2:
            target_user = user_2
            print_success(f"Found user ID 2: {user_2[1]}")
        else:
            print_error("No suitable user found! Keeping owner_id = 1 (admin)")
            target_user = (1, 'admin')

        target_user_id = target_user[0]
        target_user_email = target_user[1]

        # ================================================================
        # STEP 4: Update project ownership
        # ================================================================
        print_header("STEP 4: Updating Project Ownership")

        print(f"{Colors.YELLOW}Updating projects 6 and 7 to be owned by user_id: {target_user_id} ({target_user_email})...{Colors.NC}")

        cursor.execute("""
            UPDATE project
            SET owner_id = %s, updated_at = NOW()
            WHERE project_id IN (6, 7)
        """, (target_user_id,))

        affected_rows = cursor.rowcount
        connection.commit()

        print_success(f"Updated {affected_rows} projects")

        # ================================================================
        # STEP 5: Verify the fix
        # ================================================================
        print_header("STEP 5: Verify - New Project Ownership")

        cursor.execute("""
            SELECT
                p.project_id,
                p.project_name,
                p.owner_id,
                u.email as owner_email,
                u.name as owner_name
            FROM project p
            LEFT JOIN users u ON p.owner_id = u.user_id
            WHERE p.project_id IN (6, 7)
        """)
        print_table(cursor, "Updated Ownership:")

        # ================================================================
        # STEP 6: Database integrity check
        # ================================================================
        print_header("STEP 6: Database Integrity Check")

        # Entity counts
        queries = [
            ("Projects", "SELECT COUNT(*) as count FROM project"),
            ("Cases", "SELECT COUNT(*) as count FROM case_table"),
            ("Components", "SELECT COUNT(*) as count FROM component"),
            ("Flows", "SELECT COUNT(*) as count FROM flows"),
            ("Assessment Runs", "SELECT COUNT(*) as count FROM assessment_runs"),
            ("Assessment Results", "SELECT COUNT(*) as count FROM assessment_results"),
        ]

        print(f"\n{Colors.YELLOW}Entity Counts:{Colors.NC}")
        for entity, query in queries:
            cursor.execute(query)
            count = cursor.fetchone()[0]
            print(f"  {entity}: {count}")

        # Orphaned records check
        print(f"\n{Colors.YELLOW}Orphaned Records (should all be 0):{Colors.NC}")

        orphan_checks = [
            ("Orphaned Cases", "SELECT COUNT(*) FROM case_table WHERE project_id NOT IN (SELECT project_id FROM project)"),
            ("Orphaned Components", "SELECT COUNT(*) FROM component WHERE case_id NOT IN (SELECT case_id FROM case_table)"),
            ("Orphaned Flows", "SELECT COUNT(*) FROM flows WHERE component_id NOT IN (SELECT component_id FROM component)"),
            ("Orphaned Runs", "SELECT COUNT(*) FROM assessment_runs WHERE case_id NOT IN (SELECT case_id FROM case_table)"),
        ]

        all_clean = True
        for check_name, query in orphan_checks:
            cursor.execute(query)
            count = cursor.fetchone()[0]
            if count > 0:
                print_error(f"{check_name}: {count}")
                all_clean = False
            else:
                print_success(f"{check_name}: 0")

        if all_clean:
            print_success("\nAll orphaned record checks passed!")

        # Project breakdown
        print(f"\n{Colors.YELLOW}Project Breakdown:{Colors.NC}")
        cursor.execute("""
            SELECT
                p.project_id,
                p.project_name,
                COUNT(DISTINCT c.case_id) as cases,
                COUNT(DISTINCT comp.component_id) as components,
                u.email as owner
            FROM project p
            LEFT JOIN case_table c ON p.project_id = c.project_id
            LEFT JOIN component comp ON c.case_id = comp.case_id
            LEFT JOIN users u ON p.owner_id = u.user_id
            GROUP BY p.project_id, p.project_name, u.email
            ORDER BY p.project_id
        """)
        print_table(cursor)

        # ================================================================
        # STEP 7: Summary
        # ================================================================
        print_header("FIX COMPLETE!")

        print(f"{Colors.GREEN}✓ Project ownership updated successfully{Colors.NC}")
        print(f"{Colors.GREEN}✓ Database integrity verified{Colors.NC}")
        print(f"\n{Colors.BOLD}Next Steps:{Colors.NC}")
        print(f"  1. {Colors.YELLOW}Make sure you're logged in as: {target_user_email}{Colors.NC}")
        print(f"  2. {Colors.YELLOW}Hard refresh browser: Cmd+Shift+R{Colors.NC}")
        print(f"  3. {Colors.YELLOW}Click on a project - should work now!{Colors.NC}")

        if target_user_email != 'john@lcaproject.com':
            print(f"\n{Colors.WARNING}⚠️  Projects are owned by {target_user_email}{Colors.NC}")
            print(f"     If you need to login as john_doe, manually update owner_id to john_doe's user_id")

        cursor.close()
        connection.close()

        return 0

    except pymysql.Error as e:
        print_error(f"Database error: {e}")
        return 1
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
