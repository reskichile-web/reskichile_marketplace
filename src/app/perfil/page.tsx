import type { Metadata } from 'next'
import ProfileForm from '@/components/perfil/ProfileForm'
import DesktopDashboard from '@/components/perfil/DesktopDashboard'

export const metadata: Metadata = {
  title: 'Mi cuenta - ReskiChile',
}

export default function PerfilPage() {
  return (
    <>
      <div className="md:hidden">
        <ProfileForm />
      </div>
      <div className="hidden md:block">
        <DesktopDashboard />
      </div>
    </>
  )
}
