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
    console.log('\n========== QUERY 1: All Projects with Case Counts ==========\n');
    const [projects] = await connection.execute(
      `SELECT p.project_id, p.project_name, p.owner_id, COUNT(c.case_id) as case_count
       FROM project p
       LEFT JOIN case_table c ON p.project_id = c.project_id
       GROUP BY p.project_id, p.project_name, p.owner_id`
    );
    console.log(JSON.stringify(projects, null, 2));

    console.log('\n========== QUERY 2: Cases for Project ID 10 ==========\n');
    const [cases] = await connection.execute(
      `SELECT case_id, case_name, case_type, case_description
       FROM case_table
       WHERE project_id = 10`
    );
    console.log(JSON.stringify(cases, null, 2));

    console.log('\n========== QUERY 3: Daniel Lerner User ==========\n');
    const [users] = await connection.execute(
      `SELECT id, username, email FROM account 
       WHERE username = 'daniel.lerner' OR email LIKE '%daniel%'`
    );
    console.log(JSON.stringify(users, null, 2));

    // Bonus: Check table structure
    console.log('\n========== TABLE STRUCTURE INFO ==========\n');
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'lca_v3'`
    );
    console.log('Tables in lca_v3 database:');
    tables.forEach(t => console.log('  -', t.TABLE_NAME));

  } catch (error) {
    console.error('Error executing queries:', error);
  } finally {
    await connection.end();
  }
}

runQueries();
