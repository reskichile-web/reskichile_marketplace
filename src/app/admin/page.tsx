import { redirect } from 'next/navigation'
import AdminDashboardClient from '@/components/admin/AdminDashboardClient'
import { getAuthUser } from '@/lib/auth'
import { getAdminDashboardData } from '@/lib/admin-view-data'

export const dynamic = 'force-dynamic'

export default async function AdminHomePage() {
  const { user, isAdmin } = await getAuthUser()
  if (!user || !isAdmin) redirect('/')
  const initialData = await getAdminDashboardData()
  return <AdminDashboardClient initialData={initialData} />
}
