export const STYLE_ID = 'ra2pt-style'

// Anchor is a zero-width inline box placed right after the name text, so the
// absolutely-positioned controls never shift the game's own layout.
const CSS = `
.ra2pt-anchor{position:relative;display:inline-block;width:0;height:1em;vertical-align:middle;overflow:visible}
.ra2pt-inner{position:absolute;left:4px;top:50%;transform:translateY(-50%);display:flex;gap:3px;align-items:center;white-space:nowrap;z-index:10;pointer-events:auto}
.ra2pt-anchor[data-mode="after-input"] .ra2pt-inner{left:auto;right:4px}
.ra2pt-btn{box-sizing:border-box;width:14px;height:14px;padding:0;margin:0;border:1px solid #d8b24a;border-radius:2px;background:rgba(0,0,0,.75);color:#ffd35a;font:bold 12px/12px monospace;text-align:center;cursor:pointer}
.ra2pt-btn:hover{background:#d8b24a;color:#000}
.ra2pt-tag{padding:0 4px;border-radius:2px;color:#fff;font-size:11px;line-height:14px;font-weight:bold}
.ra2pt-menu{position:fixed;z-index:2147483647;min-width:64px;padding:2px 0;background:rgba(10,10,10,.95);border:1px solid #d8b24a;color:#fff;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,.6)}
.ra2pt-menu-item{display:flex;gap:6px;align-items:center;padding:3px 10px;cursor:pointer;white-space:nowrap}
.ra2pt-menu-item:hover{background:rgba(216,178,74,.3)}
.ra2pt-swatch{display:inline-block;width:8px;height:8px;border-radius:1px}
`

export function ensureStyles(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID))
    return
  const style = doc.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  ;(doc.head || doc.documentElement).appendChild(style)
}
