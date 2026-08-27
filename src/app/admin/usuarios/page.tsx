import { redirect } from 'next/navigation'
import AdminUsersClient from '@/components/admin/AdminUsersClient'
import { AdminRequestError } from '@/lib/admin-security'
import { getAdminUsersPage } from '@/lib/admin-view-data'

export const dynamic = 'force-dynamic'

export default async function UsuariosPage() {
  let initialData
  try {
    initialData = await getAdminUsersPage()
  } catch (error) {
    if (error instanceof AdminRequestError) redirect('/')
    throw error
  }
  return <AdminUsersClient initialData={initialData} />
}
