#!/usr/bin/env node
/**
 * Give an account a one-time password, for someone who cannot sign in and has
 * no Google account to sign in with (they emailed lcapix50@gmail.com from the
 * account's address). Prints the password once: send it to them, and ask them
 * to change it on Profile → Change password straight away. Setting it signs
 * every browser of that account out (tokens are bound to the password hash).
 *
 *   node scripts/admin/reset-password.mjs person@school.edu
 *
 * Connection as scripts/db/migrate.mjs: DATABASE_URL, or DATABASE_HOST/PORT/
 * USER/PASSWORD/NAME. A database that is not on this machine also needs
 * --confirm=<its database name>, typed by you, so a reset never lands on the
 * wrong database by accident.
 */
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcrypt'
import pg from 'pg'
import { connectionFromEnv, isLocalHost } from '../db/migrate.mjs'

const args = process.argv.slice(2)
const email = args.find((a) => !a.startsWith('--'))
const confirm = args.find((a) => a.startsWith('--confirm='))?.slice('--confirm='.length)

if (!email) {
  console.error('Usage: node scripts/admin/reset-password.mjs <email> [--confirm=<database name>]')
  process.exit(2)
}
const conn = connectionFromEnv()
if (!conn) {
  console.error('No database: set DATABASE_URL, or DATABASE_NAME with DATABASE_HOST/PORT/USER/PASSWORD.')
  process.exit(2)
}
if (!isLocalHost(conn.host) && confirm !== conn.database) {
  console.error(`This is ${conn.database} on ${conn.host}, not this machine. Run again with --confirm=${conn.database} if that is right.`)
  process.exit(2)
}

// 16 letters and digits a person can read out: no 0/O or 1/l.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
const password = [...randomBytes(16)].map((b) => ALPHABET[b % ALPHABET.length]).join('')

const client = new pg.Client(conn.config)
await client.connect()
try {
  const hash = await bcrypt.hash(password, 10)
  const res = await client.query(
    `UPDATE account SET password_hash = $1 WHERE lower(email COLLATE "C") = lower($2::text COLLATE "C") AND is_active = 1 RETURNING id`,
    [hash, email.trim()],
  )
  if (res.rowCount !== 1) {
    console.error(`No active account with the email ${email} on ${conn.database}. Nothing changed.`)
    process.exit(1)
  }
  console.log(`One-time password for ${email} (account ${res.rows[0].id}) on ${conn.database}:`)
  console.log(`  ${password}`)
  console.log('Send it to them and ask them to change it on Profile → Change password. Their other sessions are signed out.')
} finally {
  await client.end()
}
