import AdminNav from '@/components/AdminNav'
import { getAuthUser } from '@/lib/auth'

const ROLE_BY_EMAIL: Record<string, string> = {
  'ignaciomundaca01@gmail.com': 'Founder & CFO',
  'sebastian.derpsch@gmail.com': 'COO & CTO',
  'reskichile@gmail.com': 'CEO',
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, userName, avatarUrl } = await getAuthUser()
  const email = user?.email?.toLowerCase() ?? ''
  const role = ROLE_BY_EMAIL[email] ?? 'Admin'
  return (
    <>
      <AdminNav userName={userName ?? 'Admin'} role={role} avatarUrl={avatarUrl} />
      {/* Spacer for the fixed nav (h-20) so content never slides under it */}
      <div className="h-20" />
      {children}
    </>
  )
}
