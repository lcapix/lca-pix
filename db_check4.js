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
    console.log('\n========== Component Table Schema ==========\n');
    const [schema] = await connection.execute('DESCRIBE component');
    console.table(schema);

    console.log('\n========== Sample Components ==========\n');
    const [components] = await connection.execute(
      'SELECT * FROM component LIMIT 10'
    );
    console.log('Total sample:', components.length);
    console.table(components);

    console.log('\n========== Project Membership for Project 12 ==========\n');
    const [members] = await connection.execute(
      'SELECT pm.*, a.username, a.email FROM project_members pm JOIN account a ON pm.user_id = a.id WHERE pm.project_id = 12'
    );
    console.log('Members in project 12:');
    console.table(members);

    console.log('\n========== Assessment Runs for Project 12 ==========\n');
    const [assessments] = await connection.execute(
      'SELECT ar.* FROM assessment_runs ar JOIN case_table c ON ar.case_id = c.case_id WHERE c.project_id = 12'
    );
    console.log('Assessment runs for MSWT project:', assessments.length);
    console.table(assessments);

  } catch (error) {
    console.error('Error executing queries:', error.message);
  } finally {
    await connection.end();
  }
}

runQueries();
