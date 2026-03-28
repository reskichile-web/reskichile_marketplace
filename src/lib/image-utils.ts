// Tiny SVG blur placeholder — brand-tinted gray gradient
// Used as blurDataURL for next/image on dynamic product images
export const BLUR_DATA_URL =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="50"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#edf4fb"/><stop offset="100%" stop-color="#d4e5f5"/></linearGradient></defs><rect width="40" height="50" fill="url(#g)"/></svg>'
  ).toString('base64')
