import { redirect } from 'next/navigation'
import InstagramStoriesAdmin from '@/components/admin/InstagramStoriesAdmin'
import { getAuthUser } from '@/lib/auth'
import { getAdminInstagramStories } from '@/lib/admin-view-data'

export const dynamic = 'force-dynamic'

export default async function InstagramStoriesPage() {
  const { user, isAdmin } = await getAuthUser()
  if (!user || !isAdmin) redirect('/')
  const initialData = await getAdminInstagramStories()
  return <InstagramStoriesAdmin initialData={initialData} />
}
