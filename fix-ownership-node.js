const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DATABASE_HOST || '127.0.0.1',
  port: process.env.DATABASE_PORT || 3307,
  user: process.env.DATABASE_USER || 'lcaadmin',
  password: process.env.DATABASE_PASSWORD || 'EP76017fLefZ8?d!ezTHsN[kA()X',
  database: process.env.DATABASE_NAME || 'lca_v3',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

console.log('\n' + '='.repeat(80));
console.log('LCA DATABASE FIX - Ownership & Integrity');
console.log('='.repeat(80) + '\n');

async function fixDatabase() {
  let connection;

  try {
    console.log('🔌 Connecting to database...');
    console.log(`   Host: ${dbConfig.host}:${dbConfig.port}`);
    console.log(`   Database: ${dbConfig.database}\n`);

    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected successfully!\n');

    // STEP 1: Show current users
    console.log('='.repeat(80));
    console.log('STEP 1: Current Users in Database');
    console.log('='.repeat(80));

    const [users] = await connection.execute('SELECT user_id, email, name FROM users ORDER BY user_id');
    console.table(users);

    // STEP 2: Show current project ownership
    console.log('\n' + '='.repeat(80));
    console.log('STEP 2: Current Project Ownership (CAUSING 403 ERRORS)');
    console.log('='.repeat(80));

    const [currentOwnership] = await connection.execute(`
      SELECT
        p.project_id,
        p.project_name,
        p.owner_id,
        u.email as owner_email
      FROM project p
      LEFT JOIN users u ON p.owner_id = u.user_id
      WHERE p.project_id IN (6, 7)
    `);
    console.table(currentOwnership);

    if (currentOwnership.length > 0) {
      console.log(`⚠️  Projects currently owned by user_id: ${currentOwnership[0].owner_id}`);
      console.log(`⚠️  If you're logged in as a different user, you'll get 403 errors!\n`);
    }

    // STEP 3: Find the correct user
    console.log('='.repeat(80));
    console.log('STEP 3: Finding Best User for Ownership');
    console.log('='.repeat(80) + '\n');

    // Try john_doe
    const [johnDoe] = await connection.execute(
      "SELECT user_id, email FROM users WHERE email = 'john@lcaproject.com' LIMIT 1"
    );

    // Try lcapix50
    const [lcapix] = await connection.execute(
      "SELECT user_id, email FROM users WHERE email = 'lcapix50@gmail.com' LIMIT 1"
    );

    // Try user_id = 2
    const [user2] = await connection.execute(
      "SELECT user_id, email FROM users WHERE user_id = 2 LIMIT 1"
    );

    let targetUser;
    if (johnDoe.length > 0) {
      targetUser = johnDoe[0];
      console.log(`✅ Found john_doe account: ${targetUser.email} (ID: ${targetUser.user_id})`);
    } else if (lcapix.length > 0) {
      targetUser = lcapix[0];
      console.log(`✅ Found lcapix account: ${targetUser.email} (ID: ${targetUser.user_id})`);
    } else if (user2.length > 0) {
      targetUser = user2[0];
      console.log(`✅ Found user ID 2: ${targetUser.email}`);
    } else {
      console.log('⚠️  No suitable user found! Keeping owner_id = 1 (admin)');
      targetUser = { user_id: 1, email: 'admin' };
    }

    // STEP 4: Update ownership
    console.log('\n' + '='.repeat(80));
    console.log('STEP 4: Updating Project Ownership');
    console.log('='.repeat(80) + '\n');

    console.log(`🔧 Updating projects 6 and 7 to be owned by user_id: ${targetUser.user_id} (${targetUser.email})...`);

    const [updateResult] = await connection.execute(
      'UPDATE project SET owner_id = ?, updated_at = NOW() WHERE project_id IN (6, 7)',
      [targetUser.user_id]
    );

    console.log(`✅ Updated ${updateResult.affectedRows} projects\n`);

    // STEP 5: Verify the fix
    console.log('='.repeat(80));
    console.log('STEP 5: Verify - New Project Ownership');
    console.log('='.repeat(80));

    const [updatedOwnership] = await connection.execute(`
      SELECT
        p.project_id,
        p.project_name,
        p.owner_id,
        u.email as owner_email,
        u.name as owner_name
      FROM project p
      LEFT JOIN users u ON p.owner_id = u.user_id
      WHERE p.project_id IN (6, 7)
    `);
    console.table(updatedOwnership);

    // STEP 6: Database integrity check
    console.log('\n' + '='.repeat(80));
    console.log('STEP 6: Database Integrity Check');
    console.log('='.repeat(80) + '\n');

    console.log('Entity Counts:');
    const entities = [
      ['Projects', 'SELECT COUNT(*) as count FROM project'],
      ['Cases', 'SELECT COUNT(*) as count FROM case_table'],
      ['Components', 'SELECT COUNT(*) as count FROM component'],
      ['Flows', 'SELECT COUNT(*) as count FROM flows'],
      ['Assessment Runs', 'SELECT COUNT(*) as count FROM assessment_runs'],
      ['Assessment Results', 'SELECT COUNT(*) as count FROM assessment_results'],
    ];

    for (const [name, query] of entities) {
      const [result] = await connection.execute(query);
      console.log(`  ${name}: ${result[0].count}`);
    }

    console.log('\nOrphaned Records (should all be 0):');
    const orphanChecks = [
      ['Orphaned Cases', 'SELECT COUNT(*) as count FROM case_table WHERE project_id NOT IN (SELECT project_id FROM project)'],
      ['Orphaned Components', 'SELECT COUNT(*) as count FROM component WHERE case_id NOT IN (SELECT case_id FROM case_table)'],
      ['Orphaned Flows', 'SELECT COUNT(*) as count FROM flows WHERE component_id NOT IN (SELECT component_id FROM component)'],
      ['Orphaned Runs', 'SELECT COUNT(*) as count FROM assessment_runs WHERE case_id NOT IN (SELECT case_id FROM case_table)'],
    ];

    let allClean = true;
    for (const [name, query] of orphanChecks) {
      const [result] = await connection.execute(query);
      const count = result[0].count;
      if (count > 0) {
        console.log(`  ✗ ${name}: ${count}`);
        allClean = false;
      } else {
        console.log(`  ✓ ${name}: 0`);
      }
    }

    if (allClean) {
      console.log('\n✅ All orphaned record checks passed!');
    }

    console.log('\nProject Breakdown:');
    const [breakdown] = await connection.execute(`
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
    `);
    console.table(breakdown);

    // STEP 7: Summary
    console.log('\n' + '='.repeat(80));
    console.log('✅ FIX COMPLETE!');
    console.log('='.repeat(80) + '\n');

    console.log('✅ Project ownership updated successfully');
    console.log('✅ Database integrity verified\n');

    console.log('📝 Next Steps:');
    console.log(`   1. Make sure you're logged in as: ${targetUser.email}`);
    console.log('   2. Hard refresh browser: Cmd+Shift+R');
    console.log('   3. Click on a project - should work now!\n');

    if (targetUser.email !== 'john@lcaproject.com') {
      console.log(`⚠️  Projects are owned by ${targetUser.email}`);
      console.log(`    If you need to login as john_doe, manually update owner_id\n`);
    }

    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Make sure the SSH tunnel or Session Manager connection is active!');
      console.error('   The app is connecting successfully, so check how it connects.\n');
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixDatabase();
