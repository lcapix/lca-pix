const mysql = require('mysql2/promise');

const config = {
  host: '127.0.0.1',
  port: 3307,
  user: 'lcaadmin',
  password: 'EP76017fLefZ8?d!ezTHsN[kA()X',
  database: 'lca_v3',
  waitForConnections: true,
  connectionLimit: 1,
  queueLimit: 0
};

async function runQueries() {
  const connection = await mysql.createConnection(config);

  try {
    console.log('\n========== All Projects with Case Counts ==========\n');
    const [projects] = await connection.execute(
      `SELECT p.project_id, p.project_name, p.owner_id, COUNT(c.case_id) as case_count
       FROM project p
       LEFT JOIN case_table c ON p.project_id = c.project_id
       GROUP BY p.project_id, p.project_name, p.owner_id`
    );
    console.table(projects);

    console.log('\n========== Case Table Schema ==========\n');
    const [schema] = await connection.execute(
      `DESCRIBE case_table`
    );
    console.table(schema);

    console.log('\n========== All Cases for Project ID 10 ==========\n');
    const [cases] = await connection.execute(
      `SELECT * FROM case_table WHERE project_id = 10`
    );
    console.table(cases);

    console.log('\n========== Daniel Lerner User ==========\n');
    const [users] = await connection.execute(
      `SELECT id, username, email FROM account 
       WHERE username = 'daniel.lerner' OR email LIKE '%daniel%'`
    );
    console.table(users);

    // Check all accounts
    console.log('\n========== All Accounts in Database ==========\n');
    const [allUsers] = await connection.execute(
      `SELECT id, username, email FROM account ORDER BY id`
    );
    console.table(allUsers);

    // Check tables
    console.log('\n========== All Tables in lca_v3 ==========\n');
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'lca_v3' ORDER BY TABLE_NAME`
    );
    tables.forEach(t => console.log('  -', t.TABLE_NAME));

  } catch (error) {
    console.error('Error executing queries:', error.message);
  } finally {
    await connection.end();
  }
}

runQueries();
