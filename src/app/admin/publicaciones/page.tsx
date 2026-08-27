import { redirect } from 'next/navigation'
import AdminProductsClient from '@/components/admin/AdminProductsClient'
import { AdminRequestError } from '@/lib/admin-security'
import { getAdminProductsPage } from '@/lib/admin-view-data'

export const dynamic = 'force-dynamic'

export default async function PublicacionesPage() {
  let initialData
  try {
    initialData = await getAdminProductsPage()
  } catch (error) {
    if (error instanceof AdminRequestError) redirect('/')
    throw error
  }
  return <AdminProductsClient initialData={initialData} />
}
