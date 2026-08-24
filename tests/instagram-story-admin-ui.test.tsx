import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import InstagramStoryEditorModal from '@/components/admin/InstagramStoryEditorModal'
import InstagramStoryCalendarTable from '@/components/admin/InstagramStoryCalendarTable'
import type {
  InstagramAdminProduct,
  InstagramAdminPublication,
} from '@/lib/instagram/admin-contracts'

const baseProduct: InstagramAdminProduct = {
  id: '92000000-0000-4000-8000-000000000001',
  title: 'Dynafit Radical',
  slug: 'dynafit-radical',
  productType: 'esquis',
  price: 700000,
  imageUrl: 'https://storage.example/product.jpg',
  capture: null,
}

const preparedProduct: InstagramAdminProduct = {
  ...baseProduct,
  capture: {
    id: '93000000-0000-4000-8000-000000000001',
    productId: baseProduct.id,
    status: 'ready',
    jpegPublicUrl: 'https://storage.example/story.jpg',
    approvedAt: '2026-08-22T12:00:00.000Z',
    generatedAt: '2026-08-22T12:01:00.000Z',
    updatedAt: '2026-08-22T12:01:00.000Z',
    scheduledLocalDate: null,
    scheduledSlot: null,
    scheduledFor: null,
    scheduleSource: null,
    containerId: null,
    mediaId: null,
    publishedAt: null,
    publicationCount: 0,
    lastPublishedAt: null,
    attempts: 0,
    lastError: null,
  },
}

const slots = [{
  key: '2026-08-24|1',
  localDate: '2026-08-24',
  slot: 1 as const,
  time: '19:30',
  label: 'Lunes, 24 ago · 19:30',
}]

const publishedStory: InstagramAdminPublication = {
  id: '94000000-0000-4000-8000-000000000001',
  captureId: preparedProduct.capture!.id,
  productId: preparedProduct.id,
  title: preparedProduct.title,
  slug: preparedProduct.slug,
  productType: preparedProduct.productType,
  imageUrl: preparedProduct.imageUrl,
  containerId: 'container-1',
  mediaId: 'media-1',
  publishedAt: '2026-08-24T23:31:00.000Z',
  recovered: false,
  scheduledLocalDate: '2026-08-24',
  scheduledSlot: 1,
  scheduledFor: '2026-08-24T23:30:00.000Z',
  scheduleSource: 'automatic',
}

describe('Instagram Story admin UI', () => {
  it('offers only generation before a product has a prepared Story', () => {
    const html = renderToStaticMarkup(
      <InstagramStoryEditorModal
        product={baseProduct}
        publishingEnabled={false}
        slots={slots}
        onClose={vi.fn()}
        onChanged={vi.fn(async () => undefined)}
      />,
    )

    expect(html).toContain('Generar historia')
    expect(html).not.toContain('Subir ahora')
    expect(html).not.toContain('Agregar al cron')
  })

  it('shows the real preview and all decisions after generation', () => {
    const html = renderToStaticMarkup(
      <InstagramStoryEditorModal
        product={preparedProduct}
        publishingEnabled
        slots={slots}
        onClose={vi.fn()}
        onChanged={vi.fn(async () => undefined)}
      />,
    )

    expect(html).toContain('story.jpg?v=')
    expect(html).toContain('Subir ahora')
    expect(html).toContain('Agregar al cron')
    expect(html).toContain('Agregar al cron en fecha específica')
    expect(html).toContain('Regenerar historia')
  })

  it('keeps every action available after previous publications', () => {
    const html = renderToStaticMarkup(
      <InstagramStoryEditorModal
        product={{
          ...preparedProduct,
          capture: {
            ...preparedProduct.capture!,
            publicationCount: 2,
            lastPublishedAt: '2026-08-23T01:00:00.000Z',
          },
        }}
        publishingEnabled
        slots={slots}
        onClose={vi.fn()}
        onChanged={vi.fn(async () => undefined)}
      />,
    )

    expect(html).toContain('Publicada 2 veces')
    expect(html).toContain('Subir ahora')
    expect(html).toContain('Agregar al cron')
    expect(html).toContain('Regenerar historia')
  })

  it('renders the editorial calendar as a table with blue day grouping', () => {
    const html = renderToStaticMarkup(
      <InstagramStoryCalendarTable
        products={[preparedProduct]}
        publications={[]}
        dates={['2026-08-24']}
        today="2026-08-22"
        currentTime="12:00"
        historyDays={0}
        loading={false}
        availableSlots={slots}
        onOpen={vi.fn()}
        onChanged={vi.fn(async () => undefined)}
        onLoadEarlier={vi.fn()}
        onReturnToToday={vi.fn()}
      />,
    )

    expect(html).toContain('<table')
    expect(html).toContain('Calendario editorial')
    expect(html).toContain('bg-blue-50')
    expect(html).toContain('Lunes, 24 ago')
    expect(html).toContain('Ver días anteriores')
  })

  it('keeps completed cron publications in their original historical slot', () => {
    const html = renderToStaticMarkup(
      <InstagramStoryCalendarTable
        products={[]}
        publications={[publishedStory]}
        dates={['2026-08-24']}
        today="2026-08-25"
        currentTime="12:00"
        historyDays={14}
        loading={false}
        availableSlots={[]}
        onOpen={vi.fn()}
        onChanged={vi.fn(async () => undefined)}
        onLoadEarlier={vi.fn()}
        onReturnToToday={vi.fn()}
      />,
    )

    expect(html).toContain('Dynafit Radical')
    expect(html).toContain('Cron automático')
    expect(html).toContain('Publicada con éxito')
    expect(html).toContain('Meta confirmó a las')
  })
})
