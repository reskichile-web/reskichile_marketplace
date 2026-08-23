import { NextResponse } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-security'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface FeedbackProfile {
  id: string
  name: string | null
  email: string
  avatar_url: string | null
}

export async function GET() {
  try {
    await requireAdmin()
    const service = createServiceRoleClient()
    const { data, error } = await service
      .from('feedback_comments')
      .select('id, user_id, message, rating, page_path, rated_at, created_at')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) throw new Error('feedback query failed')

    const comments = data || []
    const userIds = [...new Set(
      comments.map(comment => comment.user_id).filter((value): value is string => Boolean(value)),
    )]
    let profiles: FeedbackProfile[] = []

    if (userIds.length > 0) {
      const { data: profileRows, error: profilesError } = await service
        .from('users')
        .select('id, name, email, avatar_url')
        .in('id', userIds)
      if (profilesError) throw new Error('feedback profiles query failed')
      profiles = (profileRows || []) as FeedbackProfile[]
    }

    const profileById = new Map(profiles.map(profile => [profile.id, profile]))

    return NextResponse.json(
      {
        comments: comments.map(comment => ({
          ...comment,
          user: comment.user_id ? profileById.get(comment.user_id) || null : null,
        })),
      },
      { headers: { 'Cache-Control': 'no-store, private' } },
    )
  } catch (error) {
    const known = adminErrorResponse(error)
    return NextResponse.json(
      { error: known.message, code: known.code },
      { status: known.status, headers: { 'Cache-Control': 'no-store, private' } },
    )
  }
}
