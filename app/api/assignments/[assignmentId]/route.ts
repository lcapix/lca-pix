import { NextRequest } from 'next/server'
import { authFail, deleteAssignment, updateAssignment } from '@/lib/assignments/handlers'
import { parseId } from '@/lib/ids'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    return await updateAssignment(request, parseId((await params).assignmentId))
  } catch (e) {
    return authFail(e)
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    return await deleteAssignment(request, parseId((await params).assignmentId))
  } catch (e) {
    return authFail(e)
  }
}
