import AdminNav from '@/components/AdminNav'
import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'

const ROLE_BY_EMAIL: Record<string, string> = {
  'ignaciomundaca01@gmail.com': 'Founder & CFO',
  'sebastian.derpsch@gmail.com': 'COO & CTO',
  'reskichile@gmail.com': 'CEO',
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, userName, avatarUrl } = await getAuthUser()
  if (!user || !isAdmin) redirect('/')
  const email = user?.email?.toLowerCase() ?? ''
  const role = ROLE_BY_EMAIL[email] ?? 'Admin'
  return (
    <>
      <AdminNav userName={userName ?? 'Admin'} role={role} avatarUrl={avatarUrl} />
      <div className="h-16 md:h-20" />
      <div className="min-h-[calc(100vh-4rem)] md:ml-60 md:min-h-[calc(100vh-5rem)]">
        {children}
      </div>
    </>
  )
}
