// Brand logo mapping — ski/snow brands with public logo URLs
// Using Clearbit Logo API (free, no key needed) + manual overrides

const BRAND_DOMAINS: Record<string, string> = {
  // Ski brands
  'salomon': 'salomon.com',
  'atomic': 'atomic.com',
  'rossignol': 'rossignol.com',
  'head': 'head.com',
  'volkl': 'volkl.com',
  'völkl': 'volkl.com',
  'blizzard': 'blizzard-ski.com',
  'nordica': 'nordica.com',
  'fischer': 'fischer-ski.com',
  'elan': 'elanskis.com',
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
  'lippi': 'lippi.cl',

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

export function getBrandLogoUrl(brand: string): string | null {
  const key = brand.toLowerCase().trim()
  const domain = BRAND_DOMAINS[key]
  if (!domain) return null
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
}

export function hasBrandLogo(brand: string): boolean {
  return brand.toLowerCase().trim() in BRAND_DOMAINS
}
