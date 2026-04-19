import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function POST(request: Request) {
  let connection

  try {
    console.log('\n' + '='.repeat(80))
    console.log('🔧 FIX DATABASE OWNERSHIP - API Route')
    console.log('='.repeat(80) + '\n')

    connection = await pool.getConnection()
    console.log('✅ Database connected\n')

    // STEP 1: Show current users
    console.log('STEP 1: Current Users')
    const [users] = await connection.execute('SELECT id, email, username FROM account ORDER BY id')
    console.table(users)

    // STEP 2: Show current ownership (THE PROBLEM)
    console.log('\nSTEP 2: Current Ownership (CAUSING 403 ERRORS)')
    const [currentOwnership] = await connection.execute(`
      SELECT
        p.project_id,
        p.project_name,
        p.owner_id,
        u.email as owner_email
      FROM project p
      LEFT JOIN account u ON p.owner_id = u.id
      WHERE p.project_id IN (6, 7)
    `)
    console.table(currentOwnership)

    // STEP 3: Find best user
    console.log('\nSTEP 3: Finding Best User')
    const [johnDoe] = await connection.execute<any>(
      "SELECT id, email FROM account WHERE email = 'john@lcaproject.com' LIMIT 1"
    )
    const [lcapix] = await connection.execute<any>(
      "SELECT id, email FROM account WHERE email = 'lcapix50@gmail.com' LIMIT 1"
    )
    const [user2] = await connection.execute<any>(
      "SELECT id, email FROM account WHERE id = 2 LIMIT 1"
    )

    let targetUser
    if (johnDoe.length > 0) {
      targetUser = johnDoe[0]
      console.log(`✅ Found john_doe: ${targetUser.email} (ID: ${targetUser.id})`)
    } else if (lcapix.length > 0) {
      targetUser = lcapix[0]
      console.log(`✅ Found lcapix: ${targetUser.email} (ID: ${targetUser.id})`)
    } else if (user2.length > 0) {
      targetUser = user2[0]
      console.log(`✅ Found user 2: ${targetUser.email}`)
    } else {
      targetUser = { id: 1, email: 'admin' }
      console.log('⚠️  Using admin (ID: 1)')
    }

    // STEP 4: Update ownership
    console.log(`\nSTEP 4: Updating to id ${targetUser.id}...`)
    const [updateResult] = await connection.execute<any>(
      'UPDATE project SET owner_id = ?, updated_at = NOW() WHERE project_id IN (6, 7)',
      [targetUser.id]
    )
    console.log(`✅ Updated ${updateResult.affectedRows} projects`)

    // STEP 5: Verify
    console.log('\nSTEP 5: Verify New Ownership')
    const [updatedOwnership] = await connection.execute(`
      SELECT
        p.project_id,
        p.project_name,
        p.owner_id,
        u.email as owner_email,
        u.username as owner_name
      FROM project p
      LEFT JOIN account u ON p.owner_id = u.id
      WHERE p.project_id IN (6, 7)
    `)
    console.table(updatedOwnership)

    // STEP 6: Integrity check
    console.log('\nSTEP 6: Database Integrity')
    const [projectCount] = await connection.execute<any>('SELECT COUNT(*) as count FROM project')
    const [caseCount] = await connection.execute<any>('SELECT COUNT(*) as count FROM case_table')
    const [componentCount] = await connection.execute<any>('SELECT COUNT(*) as count FROM component')
    const [flowCount] = await connection.execute<any>('SELECT COUNT(*) as count FROM flows')

    console.log(`  Projects: ${projectCount[0].count}`)
    console.log(`  Cases: ${caseCount[0].count}`)
    console.log(`  Components: ${componentCount[0].count}`)
    console.log(`  Flows: ${flowCount[0].count}`)

    // Check orphans
    const [orphanCases] = await connection.execute<any>(
      'SELECT COUNT(*) as count FROM case_table WHERE project_id NOT IN (SELECT project_id FROM project)'
    )
    const [orphanComponents] = await connection.execute<any>(
      'SELECT COUNT(*) as count FROM component WHERE case_id NOT IN (SELECT case_id FROM case_table)'
    )
    const [orphanFlows] = await connection.execute<any>(
      'SELECT COUNT(*) as count FROM flows WHERE component_id NOT IN (SELECT component_id FROM component)'
    )

    console.log('\nOrphaned Records:')
    console.log(`  Cases: ${orphanCases[0].count}`)
    console.log(`  Components: ${orphanComponents[0].count}`)
    console.log(`  Flows: ${orphanFlows[0].count}`)

    // Project breakdown
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
      LEFT JOIN account u ON p.owner_id = u.id
      GROUP BY p.project_id, p.project_name, u.email
      ORDER BY p.project_id
    `)
    console.log('\nProject Breakdown:')
    console.table(breakdown)

    console.log('\n' + '='.repeat(80))
    console.log('✅ FIX COMPLETE!')
    console.log('='.repeat(80))
    console.log(`\nNext: Login as ${targetUser.email} and refresh browser\n`)

    return NextResponse.json({
      success: true,
      message: 'Database ownership fixed successfully',
      targetUser: {
        id: targetUser.id,
        email: targetUser.email
      },
      projects: updatedOwnership,
      integrity: {
        projects: projectCount[0].count,
        cases: caseCount[0].count,
        components: componentCount[0].count,
        flows: flowCount[0].count,
        orphans: {
          cases: orphanCases[0].count,
          components: orphanComponents[0].count,
          flows: orphanFlows[0].count
        }
      }
    })

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  } finally {
    if (connection) {
      connection.release()
    }
  }
}
