'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  PRODUCT_TYPES,
  CONDITIONS,
  REGIONS,
  PRODUCT_ATTRIBUTES,
  type AttributeField,
} from '@/lib/constants'

const MAX_IMAGES = 8
const MIN_IMAGES = 3

export default function SellPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [termsAccepted, setTermsAccepted] = useState(false)

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
  })

  const [attributes, setAttributes] = useState<Record<string, string | boolean>>({})

  const currentAttributes: AttributeField[] = form.product_type
    ? PRODUCT_ATTRIBUTES[form.product_type] || []
    : []

  function updateForm(field: string, value: string) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'product_type') {
        setAttributes({})
      }
      return next
    })
  }

  function updateAttribute(key: string, value: string | boolean) {
    setAttributes(prev => ({ ...prev, [key]: value }))
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    const total = images.length + files.length
    if (total > MAX_IMAGES) {
      setError(`Máximo ${MAX_IMAGES} fotos`)
      return
    }
    setError('')
    const newImages = [...images, ...files]
    setImages(newImages)
    setPreviews(newImages.map(f => URL.createObjectURL(f)))
  }

  function removeImage(index: number) {
    const newImages = images.filter((_, i) => i !== index)
    setImages(newImages)
    setPreviews(newImages.map(f => URL.createObjectURL(f)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (images.length < MIN_IMAGES) {
      setError(`Debes subir al menos ${MIN_IMAGES} fotos`)
      return
    }

    if (!form.product_type || !form.brand || !form.condition || !form.price || !form.region) {
      setError('Completa todos los campos obligatorios')
      return
    }

    if (!termsAccepted) {
      setError('Debes aceptar los términos y condiciones')
      return
    }

    // Validate required attributes
    for (const attr of currentAttributes) {
      if (attr.required) {
        const val = attributes[attr.key]
        if (val === undefined || val === '') {
          setError(`El campo "${attr.label}" es obligatorio`)
          return
        }
      }
    }

    const price = parseInt(form.price)
    if (isNaN(price) || price <= 0) {
      setError('El precio debe ser un número positivo')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Debes iniciar sesión')
      setLoading(false)
      return
    }

    // Check user has phone number
    const { data: profile } = await supabase
      .from('users')
      .select('phone')
      .eq('id', user.id)
      .single()

    if (!profile?.phone) {
      setError('Debes agregar tu número de teléfono en tu perfil antes de publicar')
      setLoading(false)
      return
    }

    // Build attributes JSONB - only include fields that have values
    const attributesJson: Record<string, string | boolean> = {}
    for (const attr of currentAttributes) {
      const val = attributes[attr.key]
      if (val !== undefined && val !== '') {
        attributesJson[attr.key] = val
      }
    }

    // Create product
    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        seller_id: user.id,
        product_type: form.product_type,
        brand: form.brand,
        model: form.model || null,
        condition: form.condition,
        seasons_used: form.seasons_used || null,
        description: form.description || null,
        price,
        region: form.region,
        comuna: form.comuna || null,
        attributes: Object.keys(attributesJson).length > 0 ? attributesJson : null,
        terms_accepted: termsAccepted,
        status: 'pending',
      })
      .select()
      .single()

    if (productError || !product) {
      setError('Error al crear producto: ' + (productError?.message ?? ''))
      setLoading(false)
      return
    }

    // Upload images
    const imageUrls: { url: string; order: number }[] = []
    for (let i = 0; i < images.length; i++) {
      const file = images[i]
      const ext = file.name.split('.').pop()
      const path = `${user.id}/${product.id}/${i}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(path, file)

      if (uploadError) {
        console.error('Upload error:', uploadError)
        continue
      }

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(path)

      imageUrls.push({ url: publicUrl, order: i })
    }

    if (imageUrls.length > 0) {
      await supabase.from('product_images').insert(
        imageUrls.map(img => ({
          product_id: product.id,
          url: img.url,
          order: img.order,
        }))
      )
    }

    // Redirect to my products page
    window.location.href = '/mis-productos'
  }

  function renderAttributeField(attr: AttributeField) {
    if (attr.type === 'boolean') {
      const val = attributes[attr.key]
      return (
        <div key={attr.key}>
          <label className="block text-sm font-medium mb-1">
            {attr.label} {attr.required && '*'}
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name={attr.key}
                checked={val === true}
                onChange={() => updateAttribute(attr.key, true)}
              />
              Sí
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name={attr.key}
                checked={val === false}
                onChange={() => updateAttribute(attr.key, false)}
              />
              No
            </label>
          </div>
        </div>
      )
    }

    if (attr.type === 'select' && attr.options) {
      return (
        <div key={attr.key}>
          <label className="block text-sm font-medium mb-1">
            {attr.label} {attr.required && '*'}
          </label>
          <select
            value={(attributes[attr.key] as string) || ''}
            onChange={e => updateAttribute(attr.key, e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Seleccionar</option>
            {attr.options.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      )
    }

    // text or number
    return (
      <div key={attr.key}>
        <label className="block text-sm font-medium mb-1">
          {attr.label} {attr.required && '*'}
        </label>
        <input
          type={attr.type === 'number' ? 'number' : 'text'}
          value={(attributes[attr.key] as string) || ''}
          onChange={e => updateAttribute(attr.key, e.target.value)}
          className="w-full border rounded px-3 py-2"
          placeholder={attr.placeholder || ''}
        />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto mt-8 px-4 pb-16">
      <h1 className="font-body text-3xl font-black mb-6">Publicar producto</h1>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Product Type */}
        <div>
          <label className="block text-sm font-medium mb-1">Tipo de producto *</label>
          <select
            required
            value={form.product_type}
            onChange={e => updateForm('product_type', e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Seleccionar</option>
            {Object.entries(PRODUCT_TYPES).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* Brand & Model */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Marca *</label>
            <input
              type="text"
              required
              value={form.brand}
              onChange={e => updateForm('brand', e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="Ej: Salomon"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Modelo</label>
            <input
              type="text"
              value={form.model}
              onChange={e => updateForm('model', e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="Ej: X Pro 100"
            />
          </div>
        </div>

        {/* Condition & Seasons Used */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Condición *</label>
            <select
              required
              value={form.condition}
              onChange={e => updateForm('condition', e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Seleccionar</option>
              {Object.entries(CONDITIONS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Temporadas de uso</label>
            <input
              type="text"
              value={form.seasons_used}
              onChange={e => updateForm('seasons_used', e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="Ej: 2 temporadas"
            />
          </div>
        </div>

        {/* Price */}
        <div>
          <label className="block text-sm font-medium mb-1">Precio (CLP) *</label>
          <input
            type="number"
            required
            min="1"
            value={form.price}
            onChange={e => updateForm('price', e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="Ej: 150000"
          />
        </div>

        {/* Region & Comuna */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Región *</label>
            <select
              required
              value={form.region}
              onChange={e => updateForm('region', e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Seleccionar</option>
              {REGIONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Comuna</label>
            <input
              type="text"
              value={form.comuna}
              onChange={e => updateForm('comuna', e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="Ej: Providencia"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-1">Descripción</label>
          <textarea
            value={form.description}
            onChange={e => updateForm('description', e.target.value)}
            className="w-full border rounded px-3 py-2 h-28"
            placeholder="Describe el estado, detalles, y cualquier información relevante"
          />
        </div>

        {/* Dynamic Attributes */}
        {currentAttributes.length > 0 && (
          <div className="border-t pt-4">
            <h2 className="font-body text-lg font-medium tracking-sub mb-3">
              Atributos de {PRODUCT_TYPES[form.product_type]}
            </h2>
            <div className="space-y-4">
              {currentAttributes.map(attr => renderAttributeField(attr))}
            </div>
          </div>
        )}

        {/* Images */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Fotos ({images.length}/{MAX_IMAGES}) - Mínimo {MIN_IMAGES} *
          </label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageChange}
            className="w-full border rounded px-3 py-2"
          />
          {previews.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mt-2">
              {previews.map((src, i) => (
                <div key={i} className="relative">
                  <img src={src} alt="" className="w-full h-24 object-cover rounded" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Terms */}
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            id="terms"
            checked={termsAccepted}
            onChange={e => setTermsAccepted(e.target.checked)}
            className="mt-1"
          />
          <label htmlFor="terms" className="text-sm">
            Acepto los términos y condiciones de publicación *
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-500 text-white py-3 rounded hover:bg-brand-600 disabled:opacity-50 font-medium"
        >
          {loading ? 'Publicando...' : 'Publicar producto'}
        </button>
      </form>
    </div>
  )
}
