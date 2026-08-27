import { redirect } from 'next/navigation'
import AdminDashboardClient from '@/components/admin/AdminDashboardClient'
import { AdminRequestError } from '@/lib/admin-security'
import { getAdminDashboardData } from '@/lib/admin-view-data'

export const dynamic = 'force-dynamic'

export default async function AdminHomePage() {
  let initialData
  try {
    initialData = await getAdminDashboardData()
  } catch (error) {
    if (error instanceof AdminRequestError) redirect('/')
    throw error
  }
  return <AdminDashboardClient initialData={initialData} />
}
