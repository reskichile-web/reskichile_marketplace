export function isSkiRackStorefrontEnabled(
  storefrontSetting = process.env.SKI_RACK_STOREFRONT_ENABLED,
): boolean {
  // The storefront and payment acceptance are separate controls. Ski Rack can
  // be public while PAYMENTS_ENABLED=false keeps checkout safely read-only.
  // Leave this unset (or set it to true) to publish the storefront. Any other
  // explicit value fails closed and acts as an emergency visibility switch.
  if (storefrontSetting === undefined || storefrontSetting.trim() === '') {
    return true
  }

  return storefrontSetting.trim().toLowerCase() === 'true'
}
