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
    console.log('\n========== Project 12 (MSWT) Details ==========\n');
    const [project] = await connection.execute(
      'SELECT * FROM project WHERE project_id = 12'
    );
    console.table(project);

    console.log('\n========== Components for Project 12 ==========\n');
    const [components] = await connection.execute(
      'SELECT * FROM component WHERE project_id = 12 ORDER BY component_id'
    );
    console.log('Total components:', components.length);
    if (components.length > 0) {
      console.table(components.slice(0, 10));
      if (components.length > 10) {
        console.log('... and', components.length - 10, 'more components');
      }
    }

    console.log('\n========== Project Membership for Project 12 ==========\n');
    const [members] = await connection.execute(
      'SELECT pm.*, a.username, a.email FROM project_members pm JOIN account a ON pm.user_id = a.id WHERE pm.project_id = 12'
    );
    console.table(members);

    console.log('\n========== Project 8 Components Sample ==========\n');
    const [comp8] = await connection.execute(
      'SELECT component_id, component_name, component_type, quantity, unit FROM component WHERE project_id = 8 LIMIT 5'
    );
    console.table(comp8);

    console.log('\n========== Component Table Schema ==========\n');
    const [schema] = await connection.execute('DESCRIBE component');
    schema.forEach(col => {
      console.log('  ' + col.Field + ': ' + col.Type + ' ' + (col.Null === 'NO' ? 'NOT NULL' : 'NULL'));
    });

  } catch (error) {
    console.error('Error executing queries:', error.message);
  } finally {
    await connection.end();
  }
}

runQueries();
