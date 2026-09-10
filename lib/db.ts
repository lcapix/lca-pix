/**
 * Database Connection Pool
 * Manages MySQL connections to RDS database
 */

import mysql from 'mysql2/promise';

// Connection pool configuration. Per Shreya (2026-09-09): keep the original
// RDS host/user as fallbacks for now so the app reaches the original DB with
// zero env setup. The password always comes from the environment.
const pool = mysql.createPool({
  host: process.env.DATABASE_HOST || 'lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com',
  port: parseInt(process.env.DATABASE_PORT || '3306'),
  user: process.env.DATABASE_USER || 'lcaadmin',
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME || 'lca_v3',
  waitForConnections: true,
  connectionLimit: 20, // Increased from 10 to handle dev server hot reloading
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

// Test connection on startup
if (process.env.NODE_ENV !== 'test') {
  pool.getConnection()
    .then((conn) => {
      console.log('✅ Database connected successfully');
      console.log(`   Host: ${process.env.DATABASE_HOST}`);
      console.log(`   Database: ${process.env.DATABASE_NAME}`);
      conn.release();
    })
    .catch((err) => {
      console.error('❌ Database connection failed:', err.message);
      console.error('   Check your .env.local file and RDS accessibility');
    });
}

export default pool;
