import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { readJson, internalError } from '@/lib/http'
import { isAuthError } from '@/lib/route-guard'
import { accountForDeletion, confirmsEmail, deleteAccount, ownedProjects } from '@/lib/account/delete-account'
import { CONTACT_EMAIL } from '@/lib/contact'
import { clearAuthCookies } from '../cookies'

/**
 * GET    /api/auth/account → what deleting the account would take: the projects
 *                            the caller owns, and how many other people are in each.
 * DELETE /api/auth/account { confirm_email } → delete those projects and scrub
 *                            the account (lib/account/delete-account.ts). The
 *                            caller types their own email to confirm.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth(request)
    return NextResponse.json({ success: true, projects: await ownedProjects(userId) })
  } catch (err) {
    if (isAuthError(err)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return internalError('account deletion preview', 'Could not read what deleting would take', err)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireAuth(request)
    const account = await accountForDeletion(userId)
    if (!account) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (account.admin) {
      return NextResponse.json(
        { error: `An administrator account is not deleted here. Email ${CONTACT_EMAIL}.` },
        { status: 403 },
      )
    }
    const json = await readJson(request)
    if (!json.ok) return json.response
    if (!confirmsEmail(json.body.confirm_email, account.email)) {
      return NextResponse.json({ error: 'Type your account email exactly to confirm.' }, { status: 400 })
    }
    const done = await deleteAccount(userId)
    const res = NextResponse.json({ success: true, projects_deleted: done.projects }, { headers: { 'Cache-Control': 'no-store' } })
    clearAuthCookies(res)
    return res
  } catch (err) {
    if (isAuthError(err)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return internalError('account deletion', 'Could not delete the account', err)
  }
}
