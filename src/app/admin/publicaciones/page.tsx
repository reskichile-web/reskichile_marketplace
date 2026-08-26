import { redirect } from 'next/navigation'
import AdminProductsClient from '@/components/admin/AdminProductsClient'
import { getAuthUser } from '@/lib/auth'
import { getAdminProductsPage } from '@/lib/admin-view-data'

export const dynamic = 'force-dynamic'

export default async function PublicacionesPage() {
  const { user, isAdmin } = await getAuthUser()
  if (!user || !isAdmin) redirect('/')
  const initialData = await getAdminProductsPage()
  return <AdminProductsClient initialData={initialData} />
}
