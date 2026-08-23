'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Bot,
  RefreshCw,
  Sparkles,
  Star,
  Table2,
  UserRound,
} from 'lucide-react'

interface FeedbackUser {
  id: string
  name: string | null
  email: string
  avatar_url: string | null
}

interface FeedbackComment {
  id: string
  user_id: string | null
  message: string
  rating: number | null
  page_path: string | null
  rated_at: string | null
  created_at: string
  user: FeedbackUser | null
}

type ViewMode = 'table' | 'free'

const FREE_TONES = [
  'border-brand-100 bg-brand-50/90',
  'border-sky-100 bg-sky-50/90',
  'border-gray-200 bg-white',
  'border-cyan-100 bg-cyan-50/90',
  'border-brand-100 bg-white',
]

const FREE_ROTATIONS = [-1.2, 0.8, -0.4, 1.1, -0.8, 0.4]

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).replace('.', '')
}

function userName(comment: FeedbackComment) {
  return comment.user?.name || (comment.user ? comment.user.email.split('@')[0] : 'Anónimo')
}

function Avatar({ comment, size = 'md' }: { comment: FeedbackComment; size?: 'sm' | 'md' }) {
  const dimension = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'

  if (comment.user?.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={comment.user.avatar_url} alt="" className={`${dimension} shrink-0 rounded-full object-cover`} />
  }

  return (
    <span className={`${dimension} flex shrink-0 items-center justify-center rounded-full ${comment.user ? 'bg-brand-100 text-brand-600' : 'bg-white text-brand-400 shadow-sm'}`}>
      {comment.user
        ? <UserRound className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} aria-hidden="true" />
        : <Bot className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} aria-hidden="true" />}
    </span>
  )
}

function Rating({ value, compact = false }: { value: number | null; compact?: boolean }) {
  if (!value) return <span className="text-xs text-gray-300">—</span>

  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map(star => (
        <Star
          key={star}
          className={compact ? 'h-3 w-3' : 'h-4 w-4'}
          fill={star <= value ? '#fbbf24' : '#ffffff'}
          stroke="#111827"
          strokeWidth={2.1}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}

function TableView({ comments }: { comments: FeedbackComment[] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:block">
        <table className="w-full table-fixed border-collapse text-left">
          <colgroup>
            <col style={{ width: '22%' }} />
            <col style={{ width: '41%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '12%' }} />
          </colgroup>
          <thead className="bg-gray-50 text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500">
            <tr>
              <th className="px-5 py-3">Usuario</th>
              <th className="px-4 py-3">Comentario</th>
              <th className="px-4 py-3">Calificación</th>
              <th className="px-4 py-3">Página</th>
              <th className="px-4 py-3">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {comments.map(comment => (
              <tr key={comment.id} className="align-top transition-colors hover:bg-gray-50/70">
                <td className="px-5 py-4">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar comment={comment} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-gray-900">{userName(comment)}</p>
                      <p className="truncate text-[11px] text-gray-400">{comment.user?.email || 'Sin cuenta'}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm leading-6 text-gray-700">
                  <p className="whitespace-pre-wrap break-words">{comment.message}</p>
                </td>
                <td className="px-4 py-4"><Rating value={comment.rating} compact /></td>
                <td className="px-4 py-4">
                  {comment.page_path ? (
                    <a href={comment.page_path} target="_blank" rel="noopener noreferrer" className="block truncate text-xs font-medium text-brand-500 hover:underline">
                      {comment.page_path}
                    </a>
                  ) : <span className="text-xs text-gray-300">—</span>}
                </td>
                <td className="px-4 py-4 text-[11px] leading-5 text-gray-400">{formatDate(comment.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {comments.map(comment => (
          <article key={comment.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Avatar comment={comment} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-gray-900">{userName(comment)}</p>
                <p className="text-[11px] text-gray-400">{formatDate(comment.created_at)}</p>
              </div>
              <Rating value={comment.rating} compact />
            </div>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-gray-700">{comment.message}</p>
          </article>
        ))}
      </div>
    </>
  )
}

function FreeView({ comments }: { comments: FeedbackComment[] }) {
  return (
    <div className="min-h-[calc(100vh-190px)] overflow-hidden rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50/70 via-white to-sky-50/70 px-5 py-8 sm:px-8">
      <div className="columns-1 gap-6 sm:columns-2 xl:columns-3">
        {comments.map((comment, index) => (
          <article
            key={comment.id}
            className={`mb-7 inline-block w-full break-inside-avoid rounded-[26px] rounded-bl-md border p-4 shadow-[0_10px_28px_rgba(15,23,42,0.08)] ${FREE_TONES[index % FREE_TONES.length]}`}
            style={{
              transform: `rotate(${FREE_ROTATIONS[index % FREE_ROTATIONS.length]}deg)`,
              marginTop: `${(index % 3) * 9}px`,
            }}
          >
            <div className="flex items-center gap-3">
              <Avatar comment={comment} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-gray-900">{userName(comment)}</p>
                <p className="text-[10px] text-gray-400">{formatDate(comment.created_at)}</p>
              </div>
              <Rating value={comment.rating} compact />
            </div>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-gray-700">{comment.message}</p>
          </article>
        ))}
      </div>
    </div>
  )
}

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<FeedbackComment[]>([])
  const [view, setView] = useState<ViewMode>('free')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const response = await fetch('/api/admin/feedback', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No pudimos cargar los comentarios')
      setComments(data.comments || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No pudimos cargar los comentarios')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <main className="mx-auto max-w-7xl px-4 pb-16 pt-4 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-body text-2xl font-black text-gray-900">Comentarios</h1>
          <p className="mt-1 text-sm text-gray-500">Lo que nos cuentan quienes usan ReskiChile.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm" aria-label="Vista de comentarios">
            <button
              type="button"
              onClick={() => setView('table')}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors ${view === 'table' ? 'bg-brand-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <Table2 className="h-4 w-4" aria-hidden="true" /> Tabla
            </button>
            <button
              type="button"
              onClick={() => setView('free')}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors ${view === 'free' ? 'bg-brand-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" /> Libre
            </button>
          </div>
          <button
            type="button"
            onClick={() => { setLoading(true); void load() }}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 shadow-sm hover:text-brand-500"
            aria-label="Actualizar comentarios"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="mt-6">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-36 animate-pulse rounded-2xl bg-gray-100" />
            ))}
          </div>
        ) : comments.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white py-20 text-center">
            <Bot className="mx-auto h-9 w-9 text-brand-300" aria-hidden="true" />
            <p className="mt-3 text-sm text-gray-400">Aún no hay comentarios.</p>
          </div>
        ) : view === 'table' ? (
          <TableView comments={comments} />
        ) : (
          <FreeView comments={comments} />
        )}
      </div>
    </main>
  )
}
