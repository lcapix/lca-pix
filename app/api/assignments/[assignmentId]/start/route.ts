import { NextRequest } from 'next/server'
import { authFail, startAssignment } from '@/lib/assignments/handlers'
import { parseId } from '@/lib/ids'

export async function POST(request: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    return await startAssignment(request, parseId((await params).assignmentId))
  } catch (e) {
    return authFail(e)
  }
}
