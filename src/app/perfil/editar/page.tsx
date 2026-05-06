import type { Metadata } from 'next'
import ProfileForm from '@/components/perfil/ProfileForm'

export const metadata: Metadata = {
  title: 'Editar perfil - ReskiChile',
}

export default function EditarPerfilPage() {
  return (
    <>
      {/* Mobile: keep the original look (image header) */}
      <div className="md:hidden">
        <ProfileForm />
      </div>
      {/* Desktop: clean header, no image */}
      <div className="hidden md:block max-w-3xl mx-auto px-4 md:px-8 pt-10 md:pt-14 pb-20">
        <ProfileForm hideHeaderImage />
      </div>
    </>
  )
}
