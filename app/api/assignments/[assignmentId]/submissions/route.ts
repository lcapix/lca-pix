import { NextRequest } from 'next/server'
import { authFail, listSubmissions } from '@/lib/assignments/handlers'
import { parseId } from '@/lib/ids'

export async function GET(request: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    return await listSubmissions(request, parseId((await params).assignmentId))
  } catch (e) {
    return authFail(e)
  }
}
