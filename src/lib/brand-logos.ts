// Brand logo mapping — ski/snow brands.
//
// Logos are CURATED and self-hosted under public/brand-logos/<slug>.png. We no
// longer hit a third-party favicon service at runtime: Google's favicon endpoint
// returns a generic globe (HTTP 200) for brands it doesn't know — e.g. Lippi —
// which an <img onError> can't detect, so the globe leaked into the UI in prod.
// Self-hosted files give real logos and, when missing, return null (nothing
// renders) instead of a globe.
//
// BRAND_DOMAINS below is the canonical brand→domain reference used by the
// fetch script (scripts/fetch-brand-logos.mjs) to (re)download logos. To add a
// brand: add it here + to brand-suggestions, run the script, then add its slug
// to CURATED_LOGOS (the script prints the up-to-date set).

export const BRAND_DOMAINS: Record<string, string> = {
  // Ski brands
  'salomon': 'salomon.com',
  'atomic': 'atomic.com',
  'rossignol': 'rossignol.com',
  'head': 'head.com',
  'volkl': 'volkl.com',
  'völkl': 'volkl.com',
  'blizzard': 'blizzard-tecnica.com',
  'nordica': 'nordica.com',
  'fischer': 'fischer-ski.com',
  'elan': 'elansports.com',
  'stockli': 'stoeckli.ch',
  'majesty': 'majestyskis.com',
  'kastle': 'us.kaestle.com',
  'k2': 'k2snow.com',
  'armada': 'armadaskis.com',
  'black crows': 'black-crows.com',
  'dynastar': 'dynastar.com',
  'line': 'lineskis.com',
  'scott': 'scott-sports.com',
  '4frnt': '4frnt.com',
  'dynafit': 'dynafit.com',
  'moment': 'momentskis.com',
  'faction': 'factionskis.com',
  'black diamond': 'blackdiamondequipment.com',
  'dps': 'dpsskis.com',

  // Snowboard brands
  'burton': 'burton.com',
  'capita': 'capitasnowboarding.com',
  'jones': 'jonessnowboards.com',
  'ride': 'ridesnowboards.com',
  'gnu': 'gnu.com',
  'lib tech': 'lib-tech.com',
  'nitro': 'nitrousa.com',
  'arbor': 'arborcollective.com',
  'rome': 'romesnowboards.com',
  'never summer': 'neversummer.com',
  'forum': 'forum-snowboards.com',

  // Boots
  'dalbello': 'dalbello.it',
  'tecnica': 'tecnicasports.com',
  'lange': 'lange-boots.com',
  'scarpa': 'scarpa.com',
  'roxa': 'roxaboots.com',
  'full tilt': 'fulltiltboots.com',
  'dc': 'dcshoes.com',
  'vans': 'vans.com',
  'thirtytwo': 'thirtytwo.com',

  // Bindings
  'marker': 'marker.net',
  'look': 'look-bindings.com',
  'tyrolia': 'tyrolia.com',
  'union': 'unionbindingcompany.com',
  'flux': 'flux-bindings.com',
  'fritschi': 'fritschi.swiss',

  // Helmets & Goggles
  'oakley': 'oakley.com',
  'smith': 'smithoptics.com',
  'giro': 'giro.com',
  'poc': 'pocsports.com',
  'anon': 'anon.com',
  'bolle': 'bolle.com',
  'bollé': 'bolle.com',
  'spy': 'spyoptic.com',
  'sweet protection': 'sweetprotection.com',

  // Clothing
  'the north face': 'thenorthface.com',
  'north face': 'thenorthface.com',
  'patagonia': 'patagonia.com',
  'arc\'teryx': 'arcteryx.com',
  'arcteryx': 'arcteryx.com',
  'columbia': 'columbia.com',
  'helly hansen': 'hellyhansen.com',
  'picture': 'picture-organic-clothing.com',
  'norrona': 'norrona.com',
  'norrøna': 'norrona.com',
  '686': '686.com',
  'volcom': 'volcom.com',
  'montec': 'montecwear.com',
  'dope snow': 'dopesnow.com',
  'dope': 'dopesnow.com',
  'lippi': 'lippioutdoor.com',
  'peak performance': 'peakperformance.com',
  'flylow': 'flylowgear.com',

  // Accessories
  'leki': 'leki.com',
  'gopro': 'gopro.com',
  'bca': 'backcountryaccess.com',
  'ortovox': 'ortovox.com',
  'mammut': 'mammut.com',
  'osprey': 'osprey.com',
  'deuter': 'deuter.com',
  'dakine': 'dakine.com',

  // Other
  'wedze': 'decathlon.com',
  'decathlon': 'decathlon.com',
  'ziener': 'ziener.com',
  'reusch': 'reusch.com',
}

// Slugs that have a curated file in public/brand-logos/. Keep in sync with that
// folder — scripts/fetch-brand-logos.mjs prints this exact set after a run.
const CURATED_LOGOS = new Set<string>([
  '4frnt', '686', 'anon', 'arbor', 'arcteryx', 'armada', 'atomic', 'bca',
  'black-crows', 'black-diamond', 'blizzard', 'bolle', 'burton', 'capita', 'columbia',
  'dakine', 'dalbello', 'dc', 'decathlon', 'deuter', 'dope', 'dope-snow', 'dps',
  'dynafit', 'dynastar', 'elan', 'faction', 'fischer', 'flylow', 'flux',
  'fritschi', 'full-tilt', 'giro', 'gnu', 'gopro', 'head', 'helly-hansen',
  'jones', 'k2', 'kastle', 'lange', 'leki', 'lib-tech', 'line', 'lippi',
  'look', 'majesty', 'mammut', 'marker', 'moment', 'montec',
  'never-summer', 'nitro', 'nordica', 'norr-na', 'norrona', 'north-face',
  'oakley', 'ortovox', 'osprey', 'patagonia', 'peak-performance', 'picture',
  'poc', 'reusch',
  'ride', 'rome', 'rossignol', 'salomon', 'scarpa', 'scott', 'smith', 'spy',
  'stockli', 'sweet-protection', 'tecnica', 'the-north-face', 'thirtytwo',
  'tyrolia', 'union', 'vans', 'volcom', 'volkl', 'wedze',
])

// Brand display name → filename slug. Must match the slugify() in the fetch
// script: lowercase, strip accents, drop apostrophes, non-alphanumerics → '-'.
export function brandSlug(brand: string): string {
  const slug = brand
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // völkl → volkl
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  // Common no-space spelling should resolve to the same curated asset.
  return slug === 'peakperformance' ? 'peak-performance' : slug
}

export function getBrandLogoUrl(brand: string): string | null {
  const slug = brandSlug(brand)
  if (!CURATED_LOGOS.has(slug)) return null
  return `/brand-logos/${slug}.png`
}

export function hasBrandLogo(brand: string): boolean {
  return CURATED_LOGOS.has(brandSlug(brand))
}
