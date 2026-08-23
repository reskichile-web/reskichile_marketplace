export function isSkiRackStorefrontEnabled(
  vercelEnvironment = process.env.VERCEL_ENV,
  nodeEnvironment = process.env.NODE_ENV,
): boolean {
  if (vercelEnvironment) return vercelEnvironment !== 'production'
  return nodeEnvironment !== 'production'
}
