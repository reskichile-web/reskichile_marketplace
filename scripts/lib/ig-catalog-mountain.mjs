import sharp from 'sharp'

// Skyline landmarks in public/images/_ (1).jpeg (736 × 490). The narrow
// search band follows the photographed ridge, never a generated silhouette.
const RIDGE = [
  [0, 170], [15, 169], [30, 165], [43, 172], [63, 183], [82, 171],
  [99, 165], [117, 161], [134, 166], [151, 174], [165, 172], [184, 180],
  [208, 188], [227, 172], [244, 192], [273, 197], [288, 183], [304, 174],
  [321, 172], [342, 183], [356, 192], [371, 176], [384, 186], [399, 169],
  [411, 161], [419, 178], [430, 184], [442, 175], [464, 188], [480, 182],
  [500, 198], [521, 185], [538, 165], [549, 171], [560, 161], [579, 163],
  [592, 169], [605, 181], [621, 163], [635, 158], [651, 151], [665, 153],
  [679, 167], [698, 172], [721, 184], [735, 188],
]

export async function prepareMountain(buffer, { softenSnow = false } = {}) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  if (info.width !== 736 || info.height !== 490) throw new Error('El recorte de montaña requiere la foto maestra de 736 × 490.')
  const { width, height } = info
  // Follow the strongest local photo edge near each landmark. Dynamic
  // programming makes adjacent columns continuous, retaining small peaks.
  const minY = 140, maxY = 210, rows = maxY - minY + 1
  const parent = new Int16Array(width * rows)
  let previous = new Float64Array(rows).fill(Infinity)
  let segment = 0
  for (let x = 0; x < width; x++) {
    while (segment < RIDGE.length - 2 && x > RIDGE[segment + 1][0]) segment++
    const [x0, y0] = RIDGE[segment], [x1, y1] = RIDGE[segment + 1]
    const guide = y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    const current = new Float64Array(rows).fill(Infinity)
    for (let y = minY; y <= maxY; y++) {
      if (Math.abs(y - guide) > 9) continue
      let edge = 0
      for (let c = 0; c < 3; c++) {
        const above = data[((y - 2) * width + x) * 4 + c]
        const below = data[((y + 2) * width + x) * 4 + c]
        edge += Math.abs(above - below)
      }
      const cost = -edge + Math.abs(y - guide) * 2
      const index = y - minY
      if (x === 0) { current[index] = cost; continue }
      for (let p = Math.max(0, index - 5); p <= Math.min(rows - 1, index + 5); p++) {
        const candidate = previous[p] + cost + Math.abs(index - p) * 4
        if (candidate < current[index]) {
          current[index] = candidate
          parent[x * rows + index] = p
        }
      }
    }
    previous = current
  }
  let end = previous.indexOf(Math.min(...previous))
  const ridge = new Int16Array(width)
  for (let x = width - 1; x >= 0; x--) {
    ridge[x] = end + minY
    end = parent[x * rows + end]
  }
  for (let x = 0; x < width; x++) {
    // One-pixel antialiasing only; no gradient feather at the skyline.
    for (let y = 0; y < ridge[x]; y++) data[(y * width + x) * 4 + 3] = 0
    data[(ridge[x] * width + x) * 4 + 3] = 150
  }
  if (softenSnow) {
    // Local photographic dodge: follow the central snow slope rather than
    // placing a panel or halo behind the text. Keep the ridge untouched.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (y < ridge[x] + 22) continue
        const slopeY = 258 + (x - 368) * .055
        const field = Math.exp(-(((x - 368) / 172) ** 4 + ((y - slopeY) / 37) ** 4))
        const i = (y * width + x) * 4
        const luminance = (data[i] + data[i + 1] + data[i + 2]) / 3
        const snow = Math.max(0, Math.min(1, (luminance - 105) / 100))
        const amount = .66 * field * snow
        for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] + (250 - data[i + c]) * amount)
      }
    }
  }
  return sharp(data, { raw: { width, height, channels: 4 } })
    .extract({ left: 0, top: 140, width, height: 190 })
    .resize({ width: 1080 }).png().toBuffer()
}
