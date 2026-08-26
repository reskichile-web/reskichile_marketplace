import { redirect } from 'next/navigation'
import AdminUsersClient from '@/components/admin/AdminUsersClient'
import { getAuthUser } from '@/lib/auth'
import { getAdminUsersPage } from '@/lib/admin-view-data'

export const dynamic = 'force-dynamic'

export default async function UsuariosPage() {
  const { user, isAdmin } = await getAuthUser()
  if (!user || !isAdmin) redirect('/')
  const initialData = await getAdminUsersPage()
  return <AdminUsersClient initialData={initialData} />
}
