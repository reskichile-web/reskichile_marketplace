import { NextResponse } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-security'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { adminPageMeta, parseAdminPageParams } from '@/lib/admin-pagination'

export const dynamic = 'force-dynamic'

interface FeedbackProfile {
  id: string
  name: string | null
  email: string
  avatar_url: string | null
}

export async function GET(request: Request) {
  try {
    await requireAdmin()
    const service = createServiceRoleClient()
    const { offset, limit } = parseAdminPageParams(new URL(request.url).searchParams)
    const { data, count, error } = await service
      .from('feedback_comments')
      .select('id, user_id, message, rating, page_path, rated_at, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

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

    const enrichedComments = comments.map(comment => ({
          ...comment,
          user: comment.user_id ? profileById.get(comment.user_id) || null : null,
        }))

    return NextResponse.json(
      {
        comments: enrichedComments,
        ...adminPageMeta(count || 0, offset, enrichedComments.length),
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
