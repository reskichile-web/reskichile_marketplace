import AdminNav from '@/components/AdminNav'
import { AdminRequestError } from '@/lib/admin-security'
import { getAdminViewer } from '@/lib/admin-view-data'
import { redirect } from 'next/navigation'

const ROLE_BY_EMAIL: Record<string, string> = {
  'ignaciomundaca01@gmail.com': 'Founder & CFO',
  'sebastian.derpsch@gmail.com': 'COO & CTO',
  'reskichile@gmail.com': 'CEO',
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let viewer
  try {
    viewer = await getAdminViewer()
  } catch (error) {
    if (error instanceof AdminRequestError) redirect('/')
    throw error
  }
  const email = viewer.email.toLowerCase()
  const role = ROLE_BY_EMAIL[email] ?? 'Admin'
  return (
    <>
      <AdminNav userName={viewer.userName ?? 'Admin'} role={role} avatarUrl={viewer.avatarUrl} />
      <div className="h-16 md:h-20" />
      <div className="min-h-[calc(100vh-4rem)] md:ml-60 md:min-h-[calc(100vh-5rem)]">
        {children}
      </div>
    </>
  )
}
