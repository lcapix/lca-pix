/**
 * Database Helper Functions
 * Utility functions for database operations
 */

import pool from './db';
import { ResultSetHeader, RowDataPacket, PoolConnection } from 'mysql2/promise';

/**
 * Execute a SELECT query and return rows
 */
export async function query<T extends RowDataPacket>(
  sql: string,
  params?: any[]
): Promise<T[]> {
  try {
    const [rows] = await pool.execute<T[]>(sql, params || []);
    return rows;
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
}

/**
 * Execute an INSERT query and return the inserted ID
 */
export async function insert(
  sql: string,
  params?: any[]
): Promise<number> {
  try {
    const [result] = await pool.execute<ResultSetHeader>(sql, params || []);
    return result.insertId;
  } catch (error) {
    console.error('Insert error:', error);
    throw error;
  }
}

/**
 * Execute an UPDATE or DELETE query and return affected rows count
 */
export async function execute(
  sql: string,
  params?: any[]
): Promise<number> {
  try {
    const [result] = await pool.execute<ResultSetHeader>(sql, params || []);
    return result.affectedRows;
  } catch (error) {
    console.error('Execute error:', error);
    throw error;
  }
}

/**
 * Execute multiple queries in a transaction
 * Automatically commits on success, rolls back on error
 */
export async function transaction<T>(
  callback: (connection: PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    console.error('Transaction error:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Get a single row from query
 */
export async function queryOne<T extends RowDataPacket>(
  sql: string,
  params?: any[]
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Check if a record exists
 */
export async function exists(
  sql: string,
  params?: any[]
): Promise<boolean> {
  const result = await queryOne<any>(sql, params);
  return result !== null;
}

/**
 * Get count of records
 */
export async function count(
  sql: string,
  params?: any[]
): Promise<number> {
  const result = await queryOne<any>(sql, params);
  return result ? (result.count || result.COUNT || 0) : 0;
}
