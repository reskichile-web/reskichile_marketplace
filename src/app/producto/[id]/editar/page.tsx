'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  PRODUCT_TYPES,
  CONDITIONS,
  REGIONS,
  PRODUCT_ATTRIBUTES,
  type AttributeField,
} from '@/lib/constants'

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

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/login')
        return
      }

      // Check if admin or owner
      const { data: profile } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      const { data: product } = await supabase
        .from('products')
        .select('*')
        .eq('id', params.id)
        .single()

      if (!product) {
        router.push('/catalogo')
        return
      }

      const isOwner = product.seller_id === user.id
      const isAdmin = profile?.is_admin ?? false

      if (!isOwner && !isAdmin) {
        router.push(`/producto/${params.id}`)
        return
      }

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const price = parseInt(form.price)
    if (isNaN(price) || price <= 0) {
      setError('El precio debe ser un número positivo')
      return
    }

    if (!form.product_type || !form.brand || !form.condition || !form.region) {
      setError('Completa todos los campos obligatorios')
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

    setSaving(true)
    const supabase = createClient()

    const attributesJson: Record<string, string | boolean> = {}
    for (const attr of currentAttributes) {
      const val = attributes[attr.key]
      if (val !== undefined && val !== '') {
        attributesJson[attr.key] = val
      }
    }

    const { error: updateError } = await supabase
      .from('products')
      .update({
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
        status: form.status,
      })
      .eq('id', params.id)

    if (updateError) {
      setError('Error al guardar: ' + updateError.message)
      setSaving(false)
      return
    }

    router.push(`/producto/${params.id}`)
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
              <input type="radio" name={attr.key} checked={val === true} onChange={() => updateAttribute(attr.key, true)} />
              Sí
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" name={attr.key} checked={val === false} onChange={() => updateAttribute(attr.key, false)} />
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

  if (loading) return <div className="max-w-2xl mx-auto mt-16 px-4">Cargando...</div>

  return (
    <div className="max-w-2xl mx-auto mt-8 px-4 pb-16">
      <h1 className="font-body text-3xl font-black mb-6">Editar producto</h1>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Status — solo visible para admin */}
        <div>
          <label className="block text-sm font-medium mb-1">Estado de publicación</label>
          <select
            value={form.status}
            onChange={e => updateForm('status', e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="draft">Borrador</option>
            <option value="pending">Pendiente</option>
            <option value="approved">Aprobado</option>
            <option value="rejected">Rechazado</option>
            <option value="sold">Vendido</option>
            <option value="archived">Archivado</option>
          </select>
        </div>

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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Marca *</label>
            <input
              type="text"
              required
              value={form.brand}
              onChange={e => updateForm('brand', e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Modelo</label>
            <input
              type="text"
              value={form.model}
              onChange={e => updateForm('model', e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>

        {/* Condition & Seasons */}
        <div className="grid grid-cols-2 gap-4">
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
          />
        </div>

        {/* Region & Comuna */}
        <div className="grid grid-cols-2 gap-4">
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

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-brand-500 text-white py-3 rounded hover:bg-brand-600 disabled:opacity-50 font-medium"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="border px-6 py-3 rounded hover:bg-gray-50 text-sm"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
