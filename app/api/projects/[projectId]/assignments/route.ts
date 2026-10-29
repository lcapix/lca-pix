import { NextRequest } from 'next/server'
import { authFail, createAssignment, listAssignments } from '@/lib/assignments/handlers'
import { parseId } from '@/lib/ids'

export async function GET(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    return await listAssignments(request, parseId((await params).projectId))
  } catch (e) {
    return authFail(e)
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    return await createAssignment(request, parseId((await params).projectId))
  } catch (e) {
    return authFail(e)
  }
}
