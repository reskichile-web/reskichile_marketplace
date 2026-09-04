'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageLoader from '@/components/PageLoader'
import { Skeleton } from '@/components/ui/skeleton'
import { type ImageItem } from '@/components/SortableImageGrid'
import BrandInput from '@/components/BrandInput'

// dnd-kit (~30 KB) only matters once the photos section renders — code-split it.
const SortableImageGrid = dynamic(() => import('@/components/SortableImageGrid'), {
  ssr: false,
  loading: () => <div className="h-32 rounded-lg bg-gray-50 animate-pulse" />,
})
import { buildImagePath } from '@/lib/storage-utils'
import {
  PRODUCT_TYPES,
  CONDITIONS,
  REGIONS,
  PRODUCT_ATTRIBUTES,
  type AttributeField,
} from '@/lib/constants'
import { AttributeButtonSelect, InfoTip } from '@/components/AttributeFieldsEditor'

const ACCEPTED_FORMATS = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const ACCEPTED_LABEL = 'JPG, PNG o WebP'
const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB

function InlineField({ label, value, onSave, type = 'text', options, hasError }: {
  label: string
  value: string
  onSave: (v: string) => void
  type?: 'text' | 'number' | 'select' | 'textarea'
  options?: string[]
  hasError?: boolean
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
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`w-full text-left group ${hasError ? 'rounded-md ring-1 ring-red-300 px-2 py-1 -mx-2 -my-1' : ''}`}
      >
        <span className={`flex items-center gap-1 text-xs ${hasError ? 'text-red-500' : 'text-gray-400'}`}>
          {label}
          <svg className="w-2.5 h-2.5 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </span>
        <p className={`text-sm font-medium group-hover:text-brand-500 transition-colors min-h-[20px] ${hasError ? 'text-red-500' : 'text-gray-900'}`}>
          {value || <span className={hasError ? 'text-red-400' : 'text-gray-500'}>–</span>}
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
  const [isAdmin, setIsAdmin] = useState(false)

  const [popup, setPopup] = useState<{ title: string; message: string } | null>(null)
  const [compressing, setCompressing] = useState<{ current: number; total: number } | null>(null)
  const [uploading, setUploading] = useState<{ current: number; total: number } | null>(null)

  const [form, setForm] = useState({
    product_type: '',
    brand: '',
    model: '',
    condition: '',
    price: '',
    region: '',
    comuna: '',
    description: '',
    status: '',
  })

  const [attributes, setAttributes] = useState<Record<string, string | boolean | string[]>>({})
  const [existingImages, setExistingImages] = useState<{ id: string; url: string; order: number }[]>([])
  const [newImages, setNewImages] = useState<{ id: string; file: File; preview: string }[]>([])
  const newImageCounter = useRef(0)
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([])
  const [imageOrder, setImageOrder] = useState<string[]>([])
  const [productSlug, setProductSlug] = useState<string>('')
  const [initialSnapshot, setInitialSnapshot] = useState<{
    form: typeof form
    attributes: Record<string, string | boolean | string[]>
    imageOrder: string[]
  } | null>(null)

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
      const admin = profile?.is_admin ?? false
      if (!isOwner && !admin) { router.push(`/producto/${params.id}`); return }
      setIsAdmin(admin)

      const loadedForm = {
        product_type: product.product_type || '',
        brand: product.brand || '',
        model: product.model || '',
        condition: product.condition || '',
        price: String(product.price || ''),
        region: product.region || '',
        comuna: product.comuna || '',
        description: product.description || '',
        status: product.status || '',
      }
      const loadedAttributes = (product.attributes as Record<string, string | boolean | string[]>) || {}
      setForm(loadedForm)
      setAttributes(loadedAttributes)
      setProductSlug(product.slug || '')
      const imgs = (product.product_images || []) as { id: string; url: string; order: number }[]
      const sorted = imgs.sort((a, b) => a.order - b.order)
      setExistingImages(sorted)
      const loadedOrder = sorted.map(img => img.id)
      setImageOrder(loadedOrder)
      setInitialSnapshot({ form: loadedForm, attributes: loadedAttributes, imageOrder: loadedOrder })
      setLoading(false)
    }
    load()
  }, [params.id, router])

  const isDirty = (() => {
    if (!initialSnapshot) return false
    if (newImages.length > 0) return true
    if (deletedImageIds.length > 0) return true
    if (JSON.stringify(form) !== JSON.stringify(initialSnapshot.form)) return true
    if (JSON.stringify(attributes) !== JSON.stringify(initialSnapshot.attributes)) return true
    if (JSON.stringify(imageOrder) !== JSON.stringify(initialSnapshot.imageOrder)) return true
    return false
  })()

  // Field-level validation. Required: product_type, brand, condition, region. Price > 0.
  const fieldErrors = {
    product_type: !form.product_type,
    brand: !form.brand.trim(),
    condition: !form.condition,
    region: !form.region,
    price:
      !form.price ||
      isNaN(parseInt(form.price)) ||
      parseInt(form.price) <= 0,
  }
  const hasErrors = Object.values(fieldErrors).some(Boolean)
  const canSave = isDirty && !hasErrors && !saving && compressing === null

  const currentAttributes: AttributeField[] = form.product_type
    ? PRODUCT_ATTRIBUTES[form.product_type] || []
    : []
  const visibleAttributes = currentAttributes.filter(attribute => (
    !attribute.key.startsWith('fijaciones_') || attributes.incluye_fijaciones === true
  ))

  function updateForm(field: string, value: string) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'product_type') setAttributes({})
      return next
    })
  }

  function updateAttribute(key: string, value: string | boolean | string[] | undefined) {
    setAttributes(prev => {
      if (value === undefined) {
        const next = { ...prev }
        delete next[key]
        return next
      }
      return { ...prev, [key]: value }
    })
  }

  // Unified image list — respects imageOrder for mixed existing+new
  const imageMap = new Map<string, ImageItem>()
  existingImages
    .filter(img => !deletedImageIds.includes(img.id))
    .forEach(img => imageMap.set(img.id, { id: img.id, url: img.url }))
  newImages.forEach(img => imageMap.set(img.id, { id: img.id, url: img.preview, isNew: true }))

  const allImages: ImageItem[] = imageOrder
    .filter(id => imageMap.has(id))
    .map(id => imageMap.get(id)!)

  // Add any images not yet in imageOrder (shouldn't happen, but safety)
  imageMap.forEach((img, id) => {
    if (!imageOrder.includes(id)) allImages.push(img)
  })

  function handleReorderImages(reordered: ImageItem[]) {
    setImageOrder(reordered.map(img => img.id))
  }

  function handleRemoveImage(id: string) {
    setImageOrder(prev => prev.filter(i => i !== id))
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
    // Classify: valid, heic-to-convert, invalid format, too large
    const invalidFormat: string[] = []
    const tooLarge: string[] = []
    const heicToConvert: File[] = []
    const valid: File[] = []

    for (const f of files) {
      if (f.size > MAX_FILE_SIZE) { tooLarge.push(f.name); continue }
      const isHeic = /\.(heic|heif)$/i.test(f.name) || f.type === 'image/heic' || f.type === 'image/heif'
      if (isHeic) { heicToConvert.push(f); continue }
      if (!ACCEPTED_FORMATS.includes(f.type)) { invalidFormat.push(f.name); continue }
      valid.push(f)
    }

    if (invalidFormat.length > 0 || tooLarge.length > 0) {
      const parts: string[] = []
      if (invalidFormat.length > 0) {
        parts.push(`Formato no soportado: ${invalidFormat.join(', ')}.\n\nAceptamos ${ACCEPTED_LABEL}.`)
      }
      if (tooLarge.length > 0) {
        parts.push(`Archivo muy pesado (máx 25MB): ${tooLarge.join(', ')}.`)
      }
      setPopup({ title: 'Foto rechazada', message: parts.join('\n\n') })
      if (valid.length === 0 && heicToConvert.length === 0) return
    }

    try {
      const totalSteps = heicToConvert.length + valid.length + heicToConvert.length // convert + compress all
      let stepCount = 0
      setCompressing({ current: 0, total: totalSteps })

      // Convert HEIC → JPEG client-side
      const convertedFromHeic: File[] = []
      if (heicToConvert.length > 0) {
        const heic2any = (await import('heic2any')).default
        for (const file of heicToConvert) {
          try {
            const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 })
            const finalBlob = Array.isArray(blob) ? blob[0] : blob
            const jpegName = file.name.replace(/\.(heic|heif)$/i, '.jpg')
            convertedFromHeic.push(new File([finalBlob], jpegName, { type: 'image/jpeg' }))
          } catch {
            setPopup({
              title: 'No se pudo convertir HEIC',
              message: `No pudimos convertir ${file.name} a JPG.\n\nProbá: en tu iPhone abre Ajustes → Cámara → Formatos → "Más compatible" y vuelve a tomar la foto.`,
            })
          }
          stepCount++
          setCompressing({ current: stepCount, total: totalSteps })
        }
      }

      // Compress all (originals + converted). Load the compressor on demand (~25 KB).
      const allToCompress = [...valid, ...convertedFromHeic]
      const { default: imageCompression } = await import('browser-image-compression')
      const compressed: File[] = []
      for (const file of allToCompress) {
        const result = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true })
        compressed.push(result)
        stepCount++
        setCompressing({ current: stepCount, total: totalSteps })
      }

      const items = compressed.map(file => {
        const id = `new-${newImageCounter.current++}`
        return { id, file, preview: URL.createObjectURL(file) }
      })
      setNewImages(prev => [...prev, ...items])
      setImageOrder(prev => [...prev, ...items.map(i => i.id)])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      setPopup({ title: 'Error procesando foto', message: `No pudimos procesar una de las fotos: ${msg}\n\nIntenta con otra foto en formato ${ACCEPTED_LABEL}.` })
    } finally {
      setCompressing(null)
    }
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

    const attributesJson: Record<string, string | boolean | string[]> = {}
    for (const attr of currentAttributes) {
      if (attr.key.startsWith('fijaciones_') && attributes.incluye_fijaciones !== true) continue
      const val = attributes[attr.key]
      if (val !== undefined && val !== '') attributesJson[attr.key] = val
    }
    if (form.product_type === 'esquis') {
      const tipo = Array.isArray(attributes.tipo) ? (attributes.tipo as string[]) : []
      if (tipo.length > 0) attributesJson.tipo = tipo
      const genero = Array.isArray(attributes.genero) ? (attributes.genero as string[]) : []
      if (genero.length > 0) attributesJson.genero = genero
    }

    const oldPrice = Number(initialSnapshot?.form.price || form.price)
    const pricePatch = price < oldPrice
      ? { previous_price: oldPrice }
      : price >= oldPrice ? { previous_price: null } : {}

    const { error: updateError } = await supabase.from('products').update({
      product_type: form.product_type,
      brand: form.brand,
      model: form.model || null,
      condition: form.condition,
      description: form.description || null,
      price,
      ...pricePatch,
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

    // Update order and upload new images — respects unified imageOrder
    const finalOrder = imageOrder.filter(id => !deletedImageIds.includes(id))
    const failedUploads: string[] = []
    const newImagesInOrder = finalOrder.filter(id => id.startsWith('new-'))
    let uploadedCount = 0
    setUploading({ current: 0, total: newImagesInOrder.length })
    let orderIndex = 0

    for (const id of finalOrder) {
      if (id.startsWith('new-')) {
        const newImg = newImages.find(img => img.id === id)
        if (!newImg) continue
        const ext = newImg.file.name.split('.').pop() || 'jpg'
        const path = buildImagePath(productSlug || params.id as string, orderIndex, ext)
        const { error: uploadError } = await supabase.storage.from('product-images').upload(path, newImg.file, { contentType: newImg.file.type })
        if (uploadError) {
          failedUploads.push(`${newImg.file.name}: ${uploadError.message}`)
        } else {
          const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path)
          await supabase.from('product_images').insert({ product_id: params.id as string, url: publicUrl, order: orderIndex })
        }
        uploadedCount++
        setUploading({ current: uploadedCount, total: newImagesInOrder.length })
      } else {
        await supabase.from('product_images').update({ order: orderIndex }).eq('id', id)
      }
      orderIndex++
    }
    setUploading(null)

    if (failedUploads.length > 0) {
      setSaving(false)
      setPopup({
        title: 'Algunas fotos no se subieron',
        message: `Se guardaron los datos del producto pero estas fotos fallaron:\n\n${failedUploads.join('\n')}\n\nIntenta subirlas de nuevo.`,
      })
      return
    }

    // Purge the public ISR cache so the edit is visible immediately instead of
    // after the revalidate window.
    await fetch(`/api/products/${params.id}/revalidate`, { method: 'POST' }).catch(() => {})

    router.push(isAdmin ? '/admin' : `/producto/${params.id}`)
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


  return (
    <PageLoader loading={false}>
    <div className="max-w-2xl mx-auto mt-8 px-4 pb-16">
      <h1 className="font-body text-3xl font-black mb-6">Editar producto</h1>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      {/* Error popup for image issues */}
      {popup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setPopup(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h3 className="font-body text-lg font-black text-gray-900">{popup.title}</h3>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{popup.message}</p>
            <button
              onClick={() => setPopup(null)}
              className="mt-5 w-full bg-gray-900 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-gray-800"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Header — brand + model */}
        <div className="mb-6">
          <div className="grid grid-cols-2 gap-3">
            <BrandInput
              value={form.brand}
              onChange={v => updateForm('brand', v)}
              productType={form.product_type}
              placeholder="Marca"
              label="Marca"
              error={fieldErrors.brand}
            />
            <div>
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
            hasError={fieldErrors.product_type}
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
            hasError={fieldErrors.condition}
          />
          <InlineField
            label="Precio (CLP)"
            value={form.price ? `$${Number(form.price).toLocaleString('es-CL')}` : ''}
            onSave={v => updateForm('price', v.replace(/\D/g, ''))}
            hasError={fieldErrors.price}
          />
          <InlineField
            label="Región"
            value={form.region}
            onSave={v => updateForm('region', v)}
            type="select"
            options={REGIONS}
            hasError={fieldErrors.region}
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
            {/* Multiselect attributes (chips) — full width above the grid */}
            {visibleAttributes.filter(a => a.type === 'multiselect').map(attr => {
              const current = Array.isArray(attributes[attr.key]) ? (attributes[attr.key] as string[]) : []
              return (
                <div key={attr.key} className="mb-4">
                  <span className="text-xs text-gray-400">{attr.label} (puedes elegir varios)</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(attr.choices || []).map(opt => {
                      const selected = current.includes(opt.value)
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            const next = selected
                              ? current.filter(v => v !== opt.value)
                              : attr.key === 'genero' && opt.value === 'unisex'
                                ? ['unisex', ...current.filter(v => !['hombre', 'mujer'].includes(v))]
                                : attr.key === 'genero' && ['hombre', 'mujer'].includes(opt.value)
                                  ? [...current.filter(v => v !== 'unisex'), opt.value]
                                  : [...current, opt.value]
                            updateAttribute(attr.key, next)
                          }}
                          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                            selected
                              ? 'bg-brand-500 text-white border-brand-500'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {visibleAttributes.filter(a => a.type !== 'multiselect').map(attr => {
                if (attr.type === 'button-select') {
                  return (
                    <AttributeButtonSelect
                      key={attr.key}
                      field={attr}
                      value={attributes[attr.key]}
                      onChange={value => updateAttribute(attr.key, value)}
                    />
                  )
                }
                if (attr.type === 'boolean') {
                  const val = attributes[attr.key]
                  return (
                    <div key={attr.key} className="sm:col-span-2">
                      <span className="flex items-center gap-1 text-xs text-gray-400 mb-2">
                        {attr.label}
                        {attr.info && <InfoTip text={attr.info} />}
                      </span>
                      <div className="flex gap-2">
                        {[{ value: true, label: 'Sí' }, { value: false, label: 'No' }].map(option => (
                          <button
                            key={option.label}
                            type="button"
                            onClick={() => updateAttribute(attr.key, option.value)}
                            className={`min-w-20 rounded-lg border-2 px-4 py-2 text-sm transition-colors ${
                              val === option.value
                                ? 'border-brand-500 bg-brand-50 font-bold text-brand-600'
                                : 'border-gray-200 text-gray-600 hover:border-brand-300'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                }
                // Brand fields get BrandInput with suggestions
                if (attr.key.includes('marca')) {
                  return (
                    <BrandInput
                      key={attr.key}
                      value={(attributes[attr.key] as string) || ''}
                      onChange={v => updateAttribute(attr.key, v)}
                      productType={attr.key === 'fijaciones_marca' ? 'fijaciones' : form.product_type}
                      placeholder={attr.label}
                      label={attr.label}
                    />
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
            compressing={compressing}
          />
        </div>

        {/* Save */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!canSave}
            className={`flex-1 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
              canSave
                ? 'bg-brand-500 text-white hover:bg-brand-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {(saving || uploading) && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
              </svg>
            )}
            {uploading
              ? `Subiendo foto ${uploading.current} de ${uploading.total}...`
              : saving
              ? 'Guardando...'
              : 'Guardar cambios'}
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
