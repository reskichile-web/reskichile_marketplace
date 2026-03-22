import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const product_type = formData.get('product_type') as string
    const brand = formData.get('brand') as string
    const model = formData.get('model') as string | null
    const condition = formData.get('condition') as string
    const seasons_used = formData.get('seasons_used') as string | null
    const description = formData.get('description') as string | null
    const price = formData.get('price') as string
    const region = formData.get('region') as string
    const comuna = formData.get('comuna') as string | null
    const anon_contact = formData.get('anon_contact') as string

    if (!product_type || !brand || !condition || !price || !region || !anon_contact) {
      return NextResponse.json({ error: 'Campos obligatorios faltantes' }, { status: 400 })
    }

    // Insert product
    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        product_type,
        brand: brand.trim(),
        model: model?.trim() || null,
        condition,
        seasons_used: condition === 'nuevo_sellado' ? null : seasons_used || null,
        description: description?.trim() || null,
        price: parseInt(price),
        region,
        comuna: comuna?.trim() || '',
        anon_contact: anon_contact.trim(),
        status: 'pending',
        terms_accepted: true,
      })
      .select()
      .single()

    if (productError || !product) {
      console.error('Product insert error:', productError)
      return NextResponse.json({ error: 'Error al crear producto' }, { status: 500 })
    }

    // Upload images
    const imageFiles = formData.getAll('images') as File[]
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i]
      if (!file.size) continue

      const ext = file.name.split('.').pop()
      const path = `anon/${product.id}/${Date.now()}_${i}.${ext}`
      const buffer = Buffer.from(await file.arrayBuffer())

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(path, buffer, { contentType: file.type })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        continue
      }

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(path)

      await supabase.from('product_images').insert({
        product_id: product.id,
        url: publicUrl,
        order: i,
      })
    }

    return NextResponse.json({ id: product.id })
  } catch (err) {
    console.error('Anon publish error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
