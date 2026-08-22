import { NextResponse } from 'next/server'
import {
  adminErrorResponse,
  assertSameOrigin,
  requireAdmin,
} from '@/lib/admin-security'
import { storyStoragePath } from '@/lib/instagram/contracts'
import { revalidateProduct } from '@/lib/revalidate'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const STORAGE_BUCKET = 'product-images'
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function productImageStoragePath(url: string): string | null {
  try {
    const pathname = new URL(url).pathname
    const marker = `/${STORAGE_BUCKET}/`
    const index = pathname.indexOf(marker)
    if (index < 0) return null
    const path = decodeURIComponent(pathname.slice(index + marker.length))
    if (!path || path.startsWith('/') || path.split('/').includes('..')) return null
    return path
  } catch {
    return null
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request)
    await requireAdmin()
    const { id } = await params
    if (!UUID_RE.test(id)) {
      return NextResponse.json(
        { error: 'Producto inválido', code: 'INVALID_PRODUCT_ID' },
        { status: 422, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const service = createServiceRoleClient()
    const [{ data: product }, { data: images }, { data: capture }] = await Promise.all([
      service.from('products').select('id, slug').eq('id', id).maybeSingle(),
      service.from('product_images').select('url').eq('product_id', id),
      service
        .from('instagram_story_captures')
        .select('jpeg_storage_path')
        .eq('product_id', id)
        .maybeSingle(),
    ])
    if (!product) {
      return NextResponse.json(
        { error: 'Producto no encontrado', code: 'PRODUCT_NOT_FOUND' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const storagePaths = new Set<string>([
      storyStoragePath(id),
      ...(capture?.jpeg_storage_path ? [capture.jpeg_storage_path] : []),
      ...((images ?? [])
        .map((image) => productImageStoragePath(image.url))
        .filter((path): path is string => Boolean(path))),
    ])
    const { error: storageError } = await service.storage
      .from(STORAGE_BUCKET)
      .remove([...storagePaths])
    if (storageError) {
      return NextResponse.json(
        { error: 'No pudimos eliminar los archivos del producto', code: 'STORAGE_DELETE_FAILED' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const { error: captureDeleteError } = await service
      .from('instagram_story_captures')
      .delete()
      .eq('product_id', id)
    if (captureDeleteError) {
      return NextResponse.json(
        { error: 'No pudimos eliminar la captura', code: 'CAPTURE_DELETE_FAILED' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const { error: imageDeleteError } = await service
      .from('product_images')
      .delete()
      .eq('product_id', id)
    if (imageDeleteError) {
      return NextResponse.json(
        { error: 'No pudimos eliminar las imágenes', code: 'IMAGE_DELETE_FAILED' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const { error: productDeleteError } = await service.from('products').delete().eq('id', id)
    if (productDeleteError) {
      return NextResponse.json(
        { error: 'No pudimos eliminar el producto', code: 'PRODUCT_DELETE_FAILED' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    revalidateProduct({ id, slug: product.slug })
    return NextResponse.json(
      { ok: true },
      { headers: { 'Cache-Control': 'no-store, private' } },
    )
  } catch (error) {
    const known = adminErrorResponse(error)
    return NextResponse.json(
      { error: known.message, code: known.code },
      { status: known.status, headers: { 'Cache-Control': 'no-store, private' } },
    )
  }
}
