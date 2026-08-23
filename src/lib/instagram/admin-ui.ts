import type { InstagramAdminProduct } from './admin-contracts'

export function chileToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function chileCurrentTime(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Santiago',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date())
}

export function addLocalDays(localDate: string, days: number): string {
  const date = new Date(`${localDate}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function displayLocalDate(localDate: string, long = false): string {
  const value = new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: long ? 'long' : 'short',
    timeZone: 'UTC',
  }).format(new Date(`${localDate}T12:00:00Z`))
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function formatClp(value: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value)
}

export function storyStatus(product: InstagramAdminProduct): {
  label: string
  className: string
} {
  const status = product.capture?.status
  if (!status) return { label: 'Sin preparar', className: 'bg-gray-100 text-gray-600' }
  if (status === 'generating') return { label: 'Generando', className: 'bg-amber-50 text-amber-700' }
  if (status === 'ready') {
    return product.capture?.scheduledFor
      ? { label: 'En cron', className: 'bg-blue-50 text-blue-700' }
      : { label: 'Preparada', className: 'bg-emerald-50 text-emerald-700' }
  }
  if (status === 'retry') return { label: 'Reintento', className: 'bg-amber-50 text-amber-700' }
  if (status === 'publishing') return { label: 'Publicando', className: 'bg-blue-50 text-blue-700' }
  // Legacy rows may briefly retain the former terminal state during a rolling
  // deployment. A published asset is reusable, so present it as prepared.
  if (status === 'published') return { label: 'Preparada', className: 'bg-emerald-50 text-emerald-700' }
  return product.capture?.jpegPublicUrl
    ? { label: 'Falló publicación', className: 'bg-red-50 text-red-700' }
    : { label: 'Falló captura', className: 'bg-red-50 text-red-700' }
}
