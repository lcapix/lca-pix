const mysql = require('mysql2/promise');

const dbConfig = {
  host: '127.0.0.1',
  port: 3307,
  user: 'lcaadmin',
  password: 'EP76017fLefZ8?d!ezTHsN[kA()X',
  database: 'lca_v3'
};

async function fixOwnership() {
  const connection = await mysql.createConnection(dbConfig);

  try {
    // 1. Show all users
    console.log('\n📋 All users in database:');
    const [users] = await connection.execute('SELECT user_id, email, name FROM users');
    console.table(users);

    // 2. Show current project ownership
    console.log('\n📊 Current project ownership:');
    const [projects] = await connection.execute(`
      SELECT p.project_id, p.project_name, p.owner_id, u.email as owner_email
      FROM project p
      LEFT JOIN users u ON p.owner_id = u.user_id
      WHERE p.project_id IN (6, 7)
    `);
    console.table(projects);

    // 3. Find the correct owner (john_doe or default user)
    const [johnDoe] = await connection.execute(
      "SELECT user_id FROM users WHERE email = 'john@lcaproject.com' LIMIT 1"
    );

    const [defaultUser] = await connection.execute(
      "SELECT user_id FROM users WHERE email = 'lcapix50@gmail.com' LIMIT 1"
    );

    let targetUserId;
    if (johnDoe.length > 0) {
      targetUserId = johnDoe[0].user_id;
      console.log(`\n✅ Found john_doe account (ID: ${targetUserId})`);
    } else if (defaultUser.length > 0) {
      targetUserId = defaultUser[0].user_id;
      console.log(`\n✅ Found default user account (ID: ${targetUserId})`);
    } else {
      targetUserId = 1; // Fallback to admin
      console.log(`\n⚠️ Using admin account (ID: ${targetUserId})`);
    }

    // 4. Update project ownership
    console.log(`\n🔧 Updating projects 6 and 7 to be owned by user ID: ${targetUserId}`);
    const [result] = await connection.execute(
      'UPDATE project SET owner_id = ? WHERE project_id IN (6, 7)',
      [targetUserId]
    );

    console.log(`✅ Updated ${result.affectedRows} projects`);

    // 5. Verify the change
    console.log('\n✅ New project ownership:');
    const [updatedProjects] = await connection.execute(`
      SELECT p.project_id, p.project_name, p.owner_id, u.email as owner_email
      FROM project p
      LEFT JOIN users u ON p.owner_id = u.user_id
      WHERE p.project_id IN (6, 7)
    `);
    console.table(updatedProjects);

    console.log('\n✅ Ownership fix complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. Refresh your browser (Cmd+Shift+R)');
    console.log('   2. Make sure you\'re logged in as:', updatedProjects[0].owner_email);
    console.log('   3. Click on a project - it should work now!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

fixOwnership().catch(console.error);
