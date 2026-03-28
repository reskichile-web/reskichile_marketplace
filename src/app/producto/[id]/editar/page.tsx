'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import imageCompression from 'browser-image-compression'
import PageLoader from '@/components/PageLoader'
import { Skeleton } from '@/components/ui/skeleton'
import SortableImageGrid, { type ImageItem } from '@/components/SortableImageGrid'
import { getBrandLogoUrl } from '@/lib/brand-logos'
import {
  PRODUCT_TYPES,
  CONDITIONS,
  REGIONS,
  PRODUCT_ATTRIBUTES,
  type AttributeField,
} from '@/lib/constants'

function InlineField({ label, value, onSave, type = 'text', options }: {
  label: string
  value: string
  onSave: (v: string) => void
  type?: 'text' | 'number' | 'select' | 'textarea'
  options?: string[]
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  useEffect(() => { setDraft(value) }, [value])

  function save() {
    onSave(draft)
    setEditing(false)
  }

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="w-full text-left group">
        <span className="flex items-center gap-1 text-xs text-gray-400">
          {label}
          <svg className="w-2.5 h-2.5 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </span>
        <p className="text-sm font-medium text-gray-900 group-hover:text-brand-500 transition-colors min-h-[20px]">
          {value || <span className="text-gray-500">–</span>}
        </p>
      </button>
    )
  }

  if (type === 'select' && options) {
    return (
      <div>
        <span className="text-xs text-gray-400">{label}</span>
        <select
          value={draft}
          onChange={e => { setDraft(e.target.value); onSave(e.target.value); setEditing(false) }}
          onBlur={() => setEditing(false)}
          autoFocus
          className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
        >
          <option value="">Seleccionar</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    )
  }

  if (type === 'textarea') {
    return (
      <div>
        <span className="text-xs text-gray-400">{label}</span>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={e => e.key === 'Escape' && setEditing(false)}
          autoFocus
          className="w-full border rounded-lg px-3 py-2 text-sm mt-1 h-20 resize-none"
        />
      </div>
    )
  }

  return (
    <div>
      <span className="text-xs text-gray-400">{label}</span>
      <input
        type={type}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        autoFocus
        className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
      />
    </div>
  )
}

export default function EditProductPage() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    product_type: '',
    brand: '',
    model: '',
    condition: '',
    seasons_used: '',
    price: '',
    region: '',
    comuna: '',
    description: '',
    status: '',
  })

  const [attributes, setAttributes] = useState<Record<string, string | boolean>>({})
  const [existingImages, setExistingImages] = useState<{ id: string; url: string; order: number }[]>([])
  const [newImages, setNewImages] = useState<{ id: string; file: File; preview: string }[]>([])
  const newImageCounter = useRef(0)
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([])
  const [sellerId, setSellerId] = useState<string>('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: profile } = await supabase
        .from('users').select('is_admin').eq('id', user.id).single()

      const { data: product } = await supabase
        .from('products').select('*, product_images(id, url, order)')
        .eq('id', params.id).single()

      if (!product) { router.push('/catalogo'); return }

      const isOwner = product.seller_id === user.id
      const isAdmin = profile?.is_admin ?? false
      if (!isOwner && !isAdmin) { router.push(`/producto/${params.id}`); return }

      setForm({
        product_type: product.product_type || '',
        brand: product.brand || '',
        model: product.model || '',
        condition: product.condition || '',
        seasons_used: product.seasons_used || '',
        price: String(product.price || ''),
        region: product.region || '',
        comuna: product.comuna || '',
        description: product.description || '',
        status: product.status || '',
      })
      setAttributes((product.attributes as Record<string, string | boolean>) || {})
      setSellerId(product.seller_id || '')
      const imgs = (product.product_images || []) as { id: string; url: string; order: number }[]
      setExistingImages(imgs.sort((a, b) => a.order - b.order))
      setLoading(false)
    }
    load()
  }, [params.id, router])

  const currentAttributes: AttributeField[] = form.product_type
    ? PRODUCT_ATTRIBUTES[form.product_type] || []
    : []

  function updateForm(field: string, value: string) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'product_type') setAttributes({})
      return next
    })
  }

  function updateAttribute(key: string, value: string | boolean) {
    setAttributes(prev => ({ ...prev, [key]: value }))
  }

  // Unified image list
  const allImages: ImageItem[] = [
    ...existingImages
      .filter(img => !deletedImageIds.includes(img.id))
      .map(img => ({ id: img.id, url: img.url })),
    ...newImages.map(img => ({ id: img.id, url: img.preview, isNew: true })),
  ]

  function handleReorderImages(reordered: ImageItem[]) {
    const reorderedExisting: typeof existingImages = []
    const reorderedNew: typeof newImages = []
    reordered.forEach(item => {
      if (item.id.startsWith('new-')) {
        const found = newImages.find(img => img.id === item.id)
        if (found) reorderedNew.push(found)
      } else {
        const found = existingImages.find(img => img.id === item.id)
        if (found) reorderedExisting.push(found)
      }
    })
    setExistingImages(reorderedExisting)
    setNewImages(reorderedNew)
  }

  function handleRemoveImage(id: string) {
    if (id.startsWith('new-')) {
      setNewImages(prev => {
        const removed = prev.find(img => img.id === id)
        if (removed) URL.revokeObjectURL(removed.preview)
        return prev.filter(img => img.id !== id)
      })
    } else {
      setDeletedImageIds(prev => [...prev, id])
    }
  }

  async function handleAddImages(files: File[]) {
    const compressed = await Promise.all(
      files.map(f => imageCompression(f, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true }))
    )
    const items = compressed.map(file => {
      const id = `new-${newImageCounter.current++}`
      return { id, file, preview: URL.createObjectURL(file) }
    })
    setNewImages(prev => [...prev, ...items])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const price = parseInt(form.price)
    if (isNaN(price) || price <= 0) { setError('El precio debe ser un número positivo'); return }
    if (!form.product_type || !form.brand || !form.condition || !form.region) {
      setError('Completa todos los campos obligatorios'); return
    }

    setSaving(true)
    const supabase = createClient()

    const attributesJson: Record<string, string | boolean> = {}
    for (const attr of currentAttributes) {
      const val = attributes[attr.key]
      if (val !== undefined && val !== '') attributesJson[attr.key] = val
    }

    const { error: updateError } = await supabase.from('products').update({
      product_type: form.product_type,
      brand: form.brand,
      model: form.model || null,
      condition: form.condition,
      seasons_used: form.seasons_used || null,
      description: form.description || null,
      price,
      region: form.region,
      comuna: form.comuna || '',
      attributes: Object.keys(attributesJson).length > 0 ? attributesJson : null,
    }).eq('id', params.id)

    if (updateError) { setError('Error al guardar: ' + updateError.message); setSaving(false); return }

    // Delete removed images
    if (deletedImageIds.length > 0) {
      const toDelete = existingImages.filter(img => deletedImageIds.includes(img.id))
      for (const img of toDelete) {
        const urlParts = img.url.split('/product-images/')
        if (urlParts[1]) await supabase.storage.from('product-images').remove([urlParts[1]])
      }
      await supabase.from('product_images').delete().in('id', deletedImageIds)
    }

    // Update order
    const remainingExisting = existingImages.filter(img => !deletedImageIds.includes(img.id))
    for (let i = 0; i < remainingExisting.length; i++) {
      await supabase.from('product_images').update({ order: i }).eq('id', remainingExisting[i].id)
    }

    // Upload new images
    if (newImages.length > 0) {
      const nextOrder = remainingExisting.length
      for (let i = 0; i < newImages.length; i++) {
        const file = newImages[i].file
        const ext = file.name.split('.').pop()
        const path = `${sellerId}/${params.id}/${Date.now()}_${i}.${ext}`
        const { error: uploadError } = await supabase.storage.from('product-images').upload(path, file)
        if (uploadError) continue
        const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path)
        await supabase.from('product_images').insert({ product_id: params.id as string, url: publicUrl, order: nextOrder + i })
      }
    }

    router.push(`/producto/${params.id}`)
  }

  if (loading) return (
    <div className="max-w-2xl mx-auto mt-8 px-4 pb-16">
      <Skeleton className="h-9 w-48 mb-6" />
      <div className="flex items-center gap-3 mb-6">
        <Skeleton className="w-8 h-8 rounded" />
        <div className="flex-1 flex gap-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-16 w-full rounded-lg mb-6" />
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[4/5] rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-12 w-full rounded-lg" />
    </div>
  )

  const logoUrl = getBrandLogoUrl(form.brand)

  return (
    <PageLoader loading={false}>
    <div className="max-w-2xl mx-auto mt-8 px-4 pb-16">
      <h1 className="font-body text-3xl font-black mb-6">Editar producto</h1>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Header — brand + model */}
        <div className="flex items-center gap-3 mb-6">
          {logoUrl && (
            <img src={logoUrl} alt="" className="w-8 h-8 object-contain rounded" onError={e => (e.currentTarget.style.display = 'none')} />
          )}
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <InlineField label="Marca" value={form.brand} onSave={v => updateForm('brand', v)} />
              <InlineField label="Modelo" value={form.model} onSave={v => updateForm('model', v)} />
            </div>
          </div>
        </div>

        {/* Properties grid — click to edit */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <InlineField
            label="Tipo"
            value={PRODUCT_TYPES[form.product_type] || form.product_type}
            onSave={v => {
              const key = Object.entries(PRODUCT_TYPES).find(([, label]) => label === v)?.[0] || v
              updateForm('product_type', key)
            }}
            type="select"
            options={Object.values(PRODUCT_TYPES)}
          />
          <InlineField
            label="Condición"
            value={CONDITIONS[form.condition] || form.condition}
            onSave={v => {
              const key = Object.entries(CONDITIONS).find(([, label]) => label === v)?.[0] || v
              updateForm('condition', key)
            }}
            type="select"
            options={Object.values(CONDITIONS)}
          />
          <InlineField label="Temporadas" value={form.seasons_used} onSave={v => updateForm('seasons_used', v)} />
          <InlineField label="Precio (CLP)" value={form.price ? `$${Number(form.price).toLocaleString('es-CL')}` : ''} onSave={v => updateForm('price', v.replace(/\D/g, ''))} />
          <InlineField
            label="Región"
            value={form.region}
            onSave={v => updateForm('region', v)}
            type="select"
            options={REGIONS}
          />
          <InlineField label="Comuna" value={form.comuna} onSave={v => updateForm('comuna', v)} />
        </div>

        {/* Description */}
        <div className="mb-6">
          <InlineField label="Descripción" value={form.description} onSave={v => updateForm('description', v)} type="textarea" />
        </div>

        {/* Dynamic Attributes */}
        {currentAttributes.length > 0 && (
          <div className="mb-6">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-3">
              Atributos de {PRODUCT_TYPES[form.product_type]}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {currentAttributes.map(attr => {
                if (attr.type === 'boolean') {
                  const val = attributes[attr.key]
                  return (
                    <button
                      key={attr.key}
                      type="button"
                      onClick={() => updateAttribute(attr.key, val === true ? false : true)}
                      className="text-left group"
                    >
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        {attr.label}
                        <svg className="w-2.5 h-2.5 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </span>
                      <p className="text-sm font-medium group-hover:text-brand-500 transition-colors">{val === true ? 'Sí' : val === false ? 'No' : <span className="text-gray-500">–</span>}</p>
                    </button>
                  )
                }
                return (
                  <InlineField
                    key={attr.key}
                    label={attr.label}
                    value={(attributes[attr.key] as string) || ''}
                    onSave={v => updateAttribute(attr.key, v)}
                    type={attr.type === 'select' ? 'select' : attr.type === 'number' ? 'number' : 'text'}
                    options={attr.options}
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* Photos */}
        <div className="mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-3">Fotos</p>
          <SortableImageGrid
            images={allImages}
            onReorder={handleReorderImages}
            onRemove={handleRemoveImage}
            onAdd={handleAddImages}
          />
        </div>

        {/* Save */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-brand-500 text-white py-3 rounded-lg hover:bg-brand-600 disabled:opacity-50 font-medium transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="border px-6 py-3 rounded-lg hover:bg-gray-50 text-sm"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
    </PageLoader>
  )
}
