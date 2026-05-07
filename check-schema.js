const mysql = require('mysql2/promise');

async function checkSchema() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'lcaadmin',
    password: 'EP76017fLefZ8?d!ezTHsN[kA()X',
    database: 'lca_v3'
  });

  try {
    console.log('📋 Checking driver_impact_factors table schema:\n');

    const [columns] = await connection.query(`
      SHOW COLUMNS FROM driver_impact_factors
    `);

    columns.forEach(col => {
      console.log(`  ${col.Field.padEnd(30)} ${col.Type.padEnd(20)} ${col.Key ? `(${col.Key})` : ''}`);
    });

    console.log('\n📊 Sample data:\n');
    const [rows] = await connection.query(`
      SELECT * FROM driver_impact_factors LIMIT 3
    `);

    console.log(JSON.stringify(rows, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkSchema().catch(console.error);
