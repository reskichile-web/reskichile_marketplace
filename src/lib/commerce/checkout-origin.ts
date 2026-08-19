import 'server-only'

const FUNCTIONAL_QUERY_PARAMETERS: ReadonlyArray<{
  path: RegExp
  names: readonly string[]
}> = [
  { path: /^\/checkout\/?$/, names: ['producto', 'racks'] },
  { path: /^\/checkout\/resultado\/?$/, names: ['orden'] },
  {
    path: /^\/catalogo\/?$/,
    names: [
      'product_type',
      'condition',
      'region',
      'brand',
      'min_price',
      'max_price',
      'sort',
      'tipo',
      'genero',
      'largo',
      'ancho',
      'fij',
      'conexion',
      'page',
    ],
  },
  { path: /^\/auth\/login\/?$/, names: ['redirect'] },
  { path: /^\/auth\/(?:registro|olvide-contrasena)\/?$/, names: ['email', 'sent'] },
  { path: /^\/mensajes\/nuevo\/?$/, names: ['product'] },
  { path: /^\/admin\/chats\/?$/, names: ['c'] },
  { path: /^\/p\/(?:vendi|disponible)\//, names: ['alt'] },
]

export interface CheckoutOriginRuntime {
  paymentEnvironment?: string
  vercelEnvironment?: string
  vercelUrl?: string
  vercelBranchUrl?: string
}

export interface CheckoutOriginDiagnostics {
  origin: string | null
  host: string | null
  forwardedHost: string | null
  appOrigin: string
  vercelBranchUrl: string | null
  vercelUrl: string | null
}

function normalizedHost(value: string | null | undefined): string | null {
  if (!value) return null
  const first = value.split(',', 1)[0]?.trim().toLowerCase()
  if (!first || first.length > 253) return null
  return /^(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?|\[[0-9a-f:]+\])(?::[0-9]{1,5})?$/i.test(first)
    ? first
    : null
}

function normalizedHttpOrigin(value: string | null): string | null {
  if (!value || value.length > 2048) return null
  try {
    const url = new URL(value)
    if (
      (url.protocol !== 'https:' && url.protocol !== 'http:') ||
      url.origin !== value ||
      url.username ||
      url.password
    ) {
      return null
    }
    return url.origin
  } catch {
    return null
  }
}

function systemUrlOrigin(value: string | undefined): string | null {
  const host = normalizedHost(value)
  return host ? `https://${host}` : null
}

export function canonicalCheckoutOrigin(appUrl: URL): string {
  return appUrl.origin
}

export function checkoutRequestOrigin(request: Request): string | null {
  return normalizedHttpOrigin(request.headers.get('origin'))
}

export function isTrustedCheckoutOrigin(appUrl: URL, request: Request): boolean {
  return checkoutRequestOrigin(request) === canonicalCheckoutOrigin(appUrl)
}

export function checkoutOriginDiagnostics(
  appUrl: URL,
  request: Request,
  runtime: CheckoutOriginRuntime = runtimeFromEnvironment()
): CheckoutOriginDiagnostics {
  return {
    origin: checkoutRequestOrigin(request),
    host: normalizedHost(request.headers.get('host')),
    forwardedHost: normalizedHost(request.headers.get('x-forwarded-host')),
    appOrigin: canonicalCheckoutOrigin(appUrl),
    vercelBranchUrl: normalizedHost(runtime.vercelBranchUrl),
    vercelUrl: normalizedHost(runtime.vercelUrl),
  }
}

export function runtimeFromEnvironment(): CheckoutOriginRuntime {
  return {
    paymentEnvironment: process.env.TRANSBANK_ENVIRONMENT,
    vercelEnvironment: process.env.VERCEL_ENV,
    vercelUrl: process.env.VERCEL_URL,
    vercelBranchUrl: process.env.VERCEL_BRANCH_URL,
  }
}

export function shouldObserveCheckoutOriginMismatch(
  runtime: CheckoutOriginRuntime
): boolean {
  return (
    runtime.paymentEnvironment === 'integration' &&
    runtime.vercelEnvironment === 'preview'
  )
}

function copyFunctionalQueryParameters(source: URL, destination: URL): void {
  const allowed = FUNCTIONAL_QUERY_PARAMETERS.find(({ path }) =>
    path.test(source.pathname)
  )?.names
  if (!allowed) return

  for (const name of allowed) {
    const values = source.searchParams.getAll(name)
    for (const value of values.slice(0, 10)) {
      if (value.length <= 500) destination.searchParams.append(name, value)
    }
  }
}

/**
 * Redirect only the concrete Vercel deployment URL to the configured branch
 * alias. Request Host is never promoted to a trusted origin or allowlist.
 */
export function canonicalPreviewNavigationRedirect(
  request: Pick<Request, 'method' | 'url'>,
  appUrl: URL,
  runtime: CheckoutOriginRuntime = runtimeFromEnvironment()
): URL | null {
  if (
    (request.method !== 'GET' && request.method !== 'HEAD') ||
    runtime.paymentEnvironment !== 'integration' ||
    runtime.vercelEnvironment !== 'preview' ||
    appUrl.protocol !== 'https:'
  ) {
    return null
  }

  const deploymentOrigin = systemUrlOrigin(runtime.vercelUrl)
  const branchOrigin = systemUrlOrigin(runtime.vercelBranchUrl)
  if (!deploymentOrigin || branchOrigin !== appUrl.origin) return null

  let source: URL
  try {
    source = new URL(request.url)
  } catch {
    return null
  }

  if (source.origin !== deploymentOrigin || source.origin === appUrl.origin) {
    return null
  }

  const destination = new URL(source.pathname, appUrl)
  copyFunctionalQueryParameters(source, destination)
  return destination
}
