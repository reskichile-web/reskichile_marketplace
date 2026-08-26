'use client'

import { useState } from 'react'
import PhoneInput from '@/components/PhoneInput'
import { createClient } from '@/lib/supabase/client'
import { parseAndValidatePhone } from '@/lib/phone'

export default function CompletePhoneModal({ userId }: { userId: string }) {
  const [fullPhone, setFullPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  if (saved) return null

  async function savePhone(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const normalizedPhone = parseAndValidatePhone(fullPhone)
    if (!normalizedPhone) {
      setError('Ingresa un número de teléfono válido.')
      return
    }

    setSaving(true)
    const supabase = createClient()
    const { data, error: updateError } = await supabase
      .from('users')
      .update({ phone: normalizedPhone })
      .eq('id', userId)
      .select('phone')
      .single()

    if (updateError || data?.phone !== normalizedPhone) {
      setError('No pudimos guardar el teléfono. Intenta nuevamente.')
      setSaving(false)
      return
    }

    setSaved(true)
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="complete-phone-title"
        className="w-full max-w-md rounded-xl bg-white p-7 shadow-2xl"
      >
        <h2 id="complete-phone-title" className="font-body text-2xl font-black text-gray-900">
          Completa tu teléfono
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          Tu cuenta quedó sin número de contacto. Agrégalo para continuar usando ReskiChile.
        </p>

        <form onSubmit={savePhone} className="mt-6 space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium">Teléfono (WhatsApp) *</label>
            <PhoneInput
              required
              error={error}
              onChange={(phone) => {
                setFullPhone(phone)
                setError(null)
              }}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-sm bg-brand-500 py-2.5 font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar teléfono'}
          </button>
        </form>
      </div>
    </div>
  )
}
