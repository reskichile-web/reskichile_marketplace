// Brand suggestions per product type — from most common to niche
// Used for autocomplete in publish and edit forms

export const BRAND_SUGGESTIONS: Record<string, string[]> = {
  esquis: [
    // Top tier
    'Salomon', 'Atomic', 'Rossignol', 'Head', 'Volkl', 'Nordica', 'Fischer', 'Blizzard', 'K2',
    // Performance
    'Dynastar', 'Elan', 'Kastle', 'Stockli', 'Augment',
    // Freeride / Freestyle
    'Armada', 'Line', 'Faction', 'Black Crows', 'Moment', 'DPS', '4FRNT', 'ON3P', 'J Skis', 'Liberty',
    // Touring / Backcountry
    'Dynafit', 'Scott', 'Black Diamond', 'G3', 'Hagan', 'La Sportiva', 'Movement', 'ZAG', 'Voile',
    // Budget / Other
    'Wedze', 'Decathlon', 'Icelantic', 'Roxy', 'Whitedot', 'Coreupt', 'Praxis',
  ],
  snowboards: [
    // Top tier
    'Burton', 'Capita', 'Jones', 'Ride', 'GNU', 'Lib Tech', 'Nitro',
    // Mid tier
    'Arbor', 'Rome', 'Never Summer', 'K2', 'Salomon', 'DC',
    // Niche / Performance
    'Bataleon', 'Korua', 'Yes', 'Endeavor', 'Weston', 'Cardiff', 'Rossignol',
    // Budget / Other
    'Head', 'Nidecker', 'Roxy', 'Flow', 'Sims', 'Signal', 'Slash', 'Academy', 'Marhar',
  ],
  botas_esqui: [
    // Top tier
    'Salomon', 'Atomic', 'Nordica', 'Head', 'Lange', 'Rossignol', 'Tecnica', 'Dalbello',
    // Performance
    'Fischer', 'K2', 'Scarpa', 'Dynafit', 'La Sportiva',
    // Freestyle
    'Full Tilt', 'Roxa',
    // Budget / Other
    'Wedze', 'Decathlon', 'Alpina', 'Dahu', 'Scott',
  ],
  botas_snowboard: [
    // Top tier
    'Burton', 'DC', 'Vans', 'ThirtyTwo', 'Ride', 'Salomon', 'K2',
    // Mid tier
    'Nitro', 'Head', 'Nidecker', 'Deeluxe',
    // Budget / Other
    'Rome', 'Rossignol', 'Flow', 'Wedze',
  ],
  fijaciones: [
    // Ski bindings
    'Marker', 'Look', 'Tyrolia', 'Salomon', 'Atomic', 'Dynafit', 'Fritschi', 'G3', 'Plum', 'ATK',
    'Rossignol', 'Head', 'Fischer', 'Nordica', 'Cast',
    // Snowboard bindings
    'Burton', 'Union', 'Flux', 'Ride', 'K2', 'Nitro', 'Rome', 'Bent Metal', 'Now', 'Jones',
    'Salomon', 'Head', 'Nidecker', 'Flow', 'SP',
  ],
  cascos: [
    'Smith', 'Giro', 'POC', 'Oakley', 'Sweet Protection', 'Salomon', 'Atomic',
    'Anon', 'K2', 'Head', 'Bolle', 'Uvex', 'Rossignol', 'Scott', 'Marker',
    'Shred', 'Sandbox', 'Bern', 'Briko', 'Ruroc', 'Wedze',
  ],
  antiparras: [
    'Oakley', 'Smith', 'Giro', 'POC', 'Anon', 'Spy', 'Bolle', 'Dragon',
    'Sweet Protection', 'Scott', 'Salomon', 'Atomic', 'Uvex', 'Julbo',
    'Electric', 'Zeal', 'Shred', 'Bliz', 'Rossignol', 'Head', 'Wedze',
  ],
  parkas: [
    // Premium
    'Arc\'teryx', 'Patagonia', 'The North Face', 'Norrona', 'Peak Performance', 'Mammut',
    // Ski specific
    'Helly Hansen', 'Spyder', 'Descente', 'Kjus', 'Bogner', 'Phenix', 'Goldbergh',
    // Street / Freestyle
    '686', 'Volcom', 'Picture', 'Montec', 'Dope Snow', 'Quiksilver', 'Roxy', 'DC', 'Burton',
    // Budget
    'Columbia', 'Salomon', 'Wedze', 'Decathlon', 'Lippi', 'Marmot', 'Outdoor Research',
    // Other
    'Black Diamond', 'Rab', 'Mountain Hardwear', 'Dynafit', 'Scott', 'Haglofs',
  ],
  pantalones: [
    // Premium
    'Arc\'teryx', 'Patagonia', 'The North Face', 'Norrona', 'Peak Performance', 'Mammut',
    // Ski specific
    'Helly Hansen', 'Spyder', 'Descente', 'Kjus', 'Phenix',
    // Street / Freestyle
    '686', 'Volcom', 'Picture', 'Montec', 'Dope Snow', 'Quiksilver', 'Roxy', 'DC', 'Burton',
    // Budget
    'Columbia', 'Salomon', 'Wedze', 'Decathlon', 'Lippi',
  ],
  guantes: [
    'Hestra', 'Black Diamond', 'Outdoor Research', 'Dakine', 'POC', 'Reusch', 'Ziener',
    'Level', 'Leki', 'Salomon', 'The North Face', 'Arc\'teryx', 'Mammut', 'Scott',
    'Burton', 'Volcom', '686', 'Gordini', 'Kinco', 'Swany', 'Kombi', 'Wedze',
  ],
  bastones: [
    'Leki', 'Black Diamond', 'Scott', 'Komperdell', 'Salomon', 'Atomic',
    'Rossignol', 'K2', 'Faction', 'Line', 'Volkl', 'Dynafit', 'G3',
    'Goode', 'Swix', 'Masters', 'Gabel', 'Life Link', 'Wedze',
  ],
  mochilas: [
    'Osprey', 'Deuter', 'Mammut', 'Black Diamond', 'Ortovox', 'Arc\'teryx',
    'Patagonia', 'The North Face', 'Gregory', 'MSR', 'Dakine', 'BCA',
    'Salomon', 'Scott', 'Dynafit', 'Fjallraven', 'Lowe Alpine', 'Exped',
  ],
  bolsos: [
    'Dakine', 'Burton', 'Evoc', 'Thule', 'Atomic', 'Salomon', 'Rossignol',
    'Head', 'Volkl', 'K2', 'Nordica', 'Fischer', 'Sportube', 'DB',
    'Dynastar', 'Marker', 'Scott', 'Lange', 'Tecnica',
  ],
  equipo_avalanchas: [
    'BCA', 'Ortovox', 'Mammut', 'Pieps', 'Arva', 'Black Diamond',
    'G3', 'Voile', 'ABS', 'Scott', 'Salewa', 'Osprey',
  ],
  camaras_accion: [
    'GoPro', 'DJI', 'Insta360', 'Sony', 'Garmin',
    'Akaso', 'Ricoh', 'Drift', 'Paralenz', 'Feiyu',
  ],
  otros: [],
}

// Flatten all brands for general search
const ALL_BRANDS_SET = new Set<string>()
Object.values(BRAND_SUGGESTIONS).forEach(brands => {
  brands.forEach(b => ALL_BRANDS_SET.add(b))
})
export const ALL_BRANDS = Array.from(ALL_BRANDS_SET).sort((a, b) => a.localeCompare(b, 'es'))

// Get suggestions filtered by query, prioritizing the product type
export function getBrandSuggestions(query: string, productType?: string): string[] {
  const q = query.toLowerCase().trim()
  if (!q) return productType ? BRAND_SUGGESTIONS[productType] || [] : []

  // Primary: brands for this product type
  const primary = productType ? (BRAND_SUGGESTIONS[productType] || []) : []
  const primaryMatches = primary.filter(b => b.toLowerCase().includes(q))

  // Secondary: all other brands
  const secondaryMatches = ALL_BRANDS
    .filter(b => b.toLowerCase().includes(q) && !primaryMatches.includes(b))

  return [...primaryMatches, ...secondaryMatches].slice(0, 8)
}
