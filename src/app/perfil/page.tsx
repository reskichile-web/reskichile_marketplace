import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import ProfileForm from '@/components/perfil/ProfileForm'
import DesktopDashboardView, {
  type ProductPreview,
  type ConversationPreview,
} from '@/components/perfil/DesktopDashboardView'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Mi cuenta - ReskiChile',
}

export const dynamic = 'force-dynamic'

export default async function PerfilPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [profileRes, productsRes, convRes] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase
      .from('products')
      .select('id, brand, model, price, status, product_type, slug, product_images(url, order)')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false }),
    // RPC aggregates last-message + unread_count server-side, avoiding the
    // O(N×M) message scan we used to do in JS.
    supabase.rpc('conversations_overview'),
  ])

  const profile = profileRes.data
    ? {
        email: user.email ?? '',
        name: profileRes.data.name as string | null,
        phone: profileRes.data.phone as string | null,
        instagram: profileRes.data.instagram as string | null,
        avatar_url: profileRes.data.avatar_url as string | null,
      }
    : null

  const allProducts: ProductPreview[] = (productsRes.data || []).map((p) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sorted = ((p as any).product_images || []).sort(
      (a: { order: number }, b: { order: number }) => a.order - b.order
    )
    return {
      id: p.id,
      brand: p.brand,
      model: p.model,
      price: p.price,
      status: p.status,
      product_type: p.product_type,
      slug: p.slug,
      image_url: sorted[0]?.url || null,
    }
  })

  interface OverviewRow {
    id: string
    product_id: string | null
    buyer_id: string
    seller_id: string
    last_message_at: string
    last_body: string | null
    last_sender_id: string | null
    last_message_created_at: string | null
    unread_count: number
  }
  const allConvs = (convRes.data || []) as OverviewRow[]
  let conversations: ConversationPreview[] = []
  if (allConvs.length > 0) {
    const productIds = Array.from(
      new Set(allConvs.map((c) => c.product_id).filter(Boolean))
    ) as string[]
    const otherIds = Array.from(
      new Set(allConvs.map((c) => (c.buyer_id === user.id ? c.seller_id : c.buyer_id)))
    )
    const [pRes, uRes] = await Promise.all([
      productIds.length
        ? supabase
            .from('products')
            .select('id, brand, model, product_images(url, order)')
            .in('id', productIds)
        : Promise.resolve({ data: [] as { id: string; brand: string | null; model: string | null; product_images: { url: string; order: number }[] }[] }),
      supabase.from('users').select('id, name').in('id', otherIds),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const productMap = new Map<string, any>()
    ;(pRes.data || []).forEach((p) => productMap.set(p.id, p))
    const userMap = new Map<string, { id: string; name: string | null }>()
    ;(uRes.data || []).forEach((u) => userMap.set(u.id, u))

    conversations = allConvs.slice(0, 4).map((c) => {
      const otherId = c.buyer_id === user.id ? c.seller_id : c.buyer_id
      const other = userMap.get(otherId)
      const product = c.product_id ? productMap.get(c.product_id) : null
      const sorted =
        product?.product_images?.sort(
          (a: { order: number }, b: { order: number }) => a.order - b.order
        ) || []
      return {
        id: c.id,
        other_name: other?.name || 'Usuario',
        product_label: product
          ? [product.brand, product.model].filter(Boolean).join(' ')
          : null,
        last_body: c.last_body,
        last_at: c.last_message_created_at || c.last_message_at,
        unread: c.unread_count,
        is_other_last: !!c.last_sender_id && c.last_sender_id !== user.id,
        image_url: sorted[0]?.url || null,
      }
    })
  }

  return (
    <>
      <div className="md:hidden">
        <ProfileForm />
      </div>
      <div className="hidden md:block">
        <DesktopDashboardView
          profile={profile}
          products={allProducts.slice(0, 4)}
          productsTotal={allProducts.length}
          conversations={conversations}
          conversationsTotal={allConvs.length}
        />
      </div>
    </>
  )
}
