import { escapeHtml } from './ig-catalog.mjs'

export const CATALOG_INTRO_COPY = ['Lo destacado', 'de la semana', 'está aquí.']

// One central composition, not a header + footer. No dates, prices, claims of
// new arrivals or counts that would become stale when the catalog rotates.
export function renderCatalogIntroHtml({ logo, font }) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=1080"><title>ReskiChile · Intro del catálogo</title>
<style>
@font-face{font-family:Montserrat;src:url('${escapeHtml(font)}') format('woff2');font-weight:100 900;font-display:block}
*{box-sizing:border-box}
html,body{margin:0;width:1080px;height:1920px;background:#fafbfc}
body{font-family:Montserrat,Arial,sans-serif;font-synthesis:none;-webkit-font-smoothing:antialiased;color:#20272d}
.sheet{position:relative;width:1080px;height:1920px;display:grid;place-items:center;overflow:hidden}
.composition{width:920px;text-align:center;transform:translateY(-24px)}
.logo{display:block;width:226px;height:91px;object-fit:contain;margin:0 auto 66px}
h1{margin:0;font-size:112px;font-weight:400;letter-spacing:-3px;line-height:1.16}
.line{display:block;white-space:nowrap}
.line:first-child{font-size:100px;font-weight:400;letter-spacing:-2.5px;margin-bottom:8px}
.reveal{display:block;margin-top:16px;color:#2674bf}
.word{font-size:150px;font-weight:700;letter-spacing:-4.5px;line-height:1.04}
.next-arrow{position:absolute;left:50%;transform:translateX(-50%);top:1570px;width:52px;height:28px;color:#30465e;opacity:.75}
</style></head><body><main class="sheet"><div class="composition">
<img class="logo" src="${escapeHtml(logo)}" alt="ReskiChile">
<h1><span class="line">${CATALOG_INTRO_COPY[0]}</span><span class="line">${CATALOG_INTRO_COPY[1]}</span>
<span class="reveal"><span class="word">${CATALOG_INTRO_COPY[2]}</span></span></h1>
</div><svg class="next-arrow" viewBox="0 0 52 28" fill="none" aria-hidden="true"><path d="M3 14h44M36 4l11 10-11 10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></main></body></html>`
}
