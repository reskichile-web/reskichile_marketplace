import 'server-only'

/** Production activation is version-controlled. Existing Meta publishing and
 * CRON_SECRET checks still apply. An explicit false is an emergency off switch.
 * Local runs require explicit opt-in; preview deployments are always disabled. */
export function isInstagramCatalogEnabled(): boolean {
  const environment = process.env.VERCEL_ENV
  if (environment && environment !== 'production') return false
  const configured = process.env.INSTAGRAM_CATALOG_ENABLED
  if (configured === 'false') return false
  return environment === 'production' || configured === 'true'
}
