import { redirect } from 'next/navigation'
import InstagramStoriesAdmin from '@/components/admin/InstagramStoriesAdmin'
import { AdminRequestError } from '@/lib/admin-security'
import { getAdminInstagramStories } from '@/lib/admin-view-data'

export const dynamic = 'force-dynamic'

export default async function InstagramStoriesPage() {
  let initialData
  try {
    initialData = await getAdminInstagramStories()
  } catch (error) {
    if (error instanceof AdminRequestError) redirect('/')
    throw error
  }
  return <InstagramStoriesAdmin initialData={initialData} />
}
