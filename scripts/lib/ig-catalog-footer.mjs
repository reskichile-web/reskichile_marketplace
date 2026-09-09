export const FOOTER_STYLES = {
  original: { label: 'Original', css: '', html: null },
  cursiva: {
    label: 'A · Cursiva suave',
    css: `footer{top:1748px}.tagline{font-style:italic;font-size:27px;font-weight:400;letter-spacing:-.65px;line-height:38px;margin-bottom:13px}.website{font-size:11px;font-weight:450;letter-spacing:3.4px;color:#424c53}`,
    html: '<div class="tagline">El snowmarket de Chile.</div><div class="website">reskichile.cl</div>',
  },
  editorial: {
    label: 'B · Serif editorial',
    css: `footer{top:1745px}.tagline{font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:400;letter-spacing:.2px;line-height:40px;margin-bottom:12px}.website{font-size:11px;font-weight:450;letter-spacing:3.4px;color:#424c53}`,
    html: '<div class="tagline">El snowmarket de Chile.</div><div class="website">reskichile.cl</div>',
  },
  firma: {
    label: 'C · Firma en dos líneas',
    css: `footer{top:1724px}.tagline{font-size:14px;font-weight:400;letter-spacing:2px;line-height:26px;margin-bottom:11px}.tagline em{display:block;font-family:Georgia,'Times New Roman',serif;font-size:34px;font-weight:400;letter-spacing:-.8px;line-height:40px}.website{font-size:10px;font-weight:450;letter-spacing:3.2px;color:#424c53}`,
    html: '<div class="tagline">El snowmarket<em>de Chile.</em></div><div class="website">reskichile.cl</div>',
  },
  espaciada: {
    label: 'D · Mayúsculas espaciadas',
    css: `footer{top:1832px}.tagline{text-transform:uppercase;font-size:20px;font-weight:450;letter-spacing:3px;line-height:34px;margin-bottom:15px}.website{font-size:13px;font-weight:500;letter-spacing:3.2px;color:#2674bf}`,
    html: '<div class="tagline">El snowmarket de Chile.</div><div class="website">reskichile.cl</div>',
  },
}
