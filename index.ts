/**
 * Liquid Glass Cursor
 *
 * Replaces the native cursor with a glass arrow that refracts
 * page content through SVG displacement + backdrop-filter.
 * Chromatic aberration splits RGB channels at the edges.
 */

export interface LiquidGlassCursorOptions {
  /** Scale factor (default: 2) */
  size?: number
  /** Displacement intensity (default: -60) */
  scale?: number
  /** Edge refraction width 0–1 (default: 0.2) */
  border?: number
  /** Center neutral lightness 0–100 (default: 50) */
  lightness?: number
  /** Center fill opacity 0–1 (default: 0.9) */
  alpha?: number
  /** Edge blur in px (default: 5) */
  blur?: number
  /** Output blur (default: 0.5) */
  outputBlur?: number
  /** Gradient blend mode (default: "difference") */
  blend?: string
  /** Frost tint opacity 0–1 (default: 0.05) */
  frost?: number
  /** Saturation boost (default: 1.2) */
  saturation?: number
  /** Chromatic aberration {r, g, b} offsets (default: {r:0, g:4, b:8}) */
  chromatic?: { r?: number; g?: number; b?: number }
  /** Smooth follow 0–1 — lower = more lag (default: 0.15) */
  lerp?: number
}

const DEFAULTS: Required<LiquidGlassCursorOptions> = {
  size: 2,
  scale: -60,
  border: 0.2,
  lightness: 50,
  alpha: 0.9,
  blur: 5,
  outputBlur: 0.5,
  blend: 'difference',
  frost: 0.05,
  saturation: 1.2,
  chromatic: { r: 0, g: 4, b: 8 },
  lerp: 0.15,
}

// macOS cursor arrow, tip at (0,0)
const CURSOR_W = 19.2
const CURSOR_H = 32
const PATH = 'M 0,0 L 0,28 L 6.4,22 L 11.2,32 L 16,30 L 11.2,20 L 19.2,20 Z'
const POINTS: [number, number][] = [
  [0, 0], [0, 28], [6.4, 22], [11.2, 32],
  [16, 30], [11.2, 20], [19.2, 20],
]

export function createLiquidGlassCursor(
  userOpts: LiquidGlassCursorOptions = {}
) {
  const opts = { ...DEFAULTS, ...userOpts }
  const chroma = { ...DEFAULTS.chromatic, ...userOpts.chromatic }
  const s = opts.size

  const elW = Math.ceil(CURSOR_W * s)
  const elH = Math.ceil(CURSOR_H * s)

  const uid = `lgc-${Math.random().toString(36).slice(2, 8)}`
  const filterId = `${uid}-f`

  const clipPoly = POINTS
    .map(([x, y]) => `${((x / CURSOR_W) * 100).toFixed(2)}% ${((y / CURSOR_H) * 100).toFixed(2)}%`)
    .join(', ')

  // Displacement map — colored gradients at edges, neutral center
  function buildMap(): string {
    const bx = CURSOR_W * opts.border * 0.5
    const by = CURSOR_H * opts.border * 0.5
    const sc = 1 - opts.border

    return `data:image/svg+xml,${encodeURIComponent(
      `<svg viewBox="0 0 ${CURSOR_W} ${CURSOR_H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="r" x1="100%" y1="0%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#000"/>
      <stop offset="100%" stop-color="red"/>
    </linearGradient>
    <linearGradient id="b" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#000"/>
      <stop offset="100%" stop-color="blue"/>
    </linearGradient>
    <clipPath id="c"><path d="${PATH}"/></clipPath>
  </defs>
  <rect width="${CURSOR_W}" height="${CURSOR_H}" fill="hsl(0 0% 50%)"/>
  <g clip-path="url(#c)">
    <rect width="${CURSOR_W}" height="${CURSOR_H}" fill="url(#r)"/>
    <rect width="${CURSOR_W}" height="${CURSOR_H}" fill="url(#b)" style="mix-blend-mode:${opts.blend}"/>
    <path d="${PATH}" transform="translate(${bx},${by}) scale(${sc})"
      fill="hsl(0 0% ${opts.lightness}% / ${opts.alpha})" style="filter:blur(${opts.blur}px)"/>
  </g>
</svg>`)}`
  }

  // SVG filter — 3 displacement passes for RGB channel separation
  const filterSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  filterSvg.setAttribute('width', '0')
  filterSvg.setAttribute('height', '0')
  filterSvg.style.cssText = 'position:absolute;pointer-events:none;'
  filterSvg.innerHTML = `<defs><filter id="${filterId}" color-interpolation-filters="sRGB">
    <feImage x="0" y="0" width="100%" height="100%" href="${buildMap()}" result="map"/>
    <feDisplacementMap in="SourceGraphic" in2="map" xChannelSelector="R" yChannelSelector="B" scale="${opts.scale + chroma.r!}" result="dR"/>
    <feColorMatrix in="dR" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="r"/>
    <feDisplacementMap in="SourceGraphic" in2="map" xChannelSelector="R" yChannelSelector="B" scale="${opts.scale + chroma.g!}" result="dG"/>
    <feColorMatrix in="dG" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="g"/>
    <feDisplacementMap in="SourceGraphic" in2="map" xChannelSelector="R" yChannelSelector="B" scale="${opts.scale + chroma.b!}" result="dB"/>
    <feColorMatrix in="dB" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="b"/>
    <feBlend in="r" in2="g" mode="screen" result="rg"/>
    <feBlend in="rg" in2="b" mode="screen" result="out"/>
    <feGaussianBlur in="out" stdDeviation="${opts.outputBlur}"/>
  </filter></defs>`

  // Wrapper — positions everything, no filter (to not break backdrop-filter)
  const wrap = document.createElement('div')
  Object.assign(wrap.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: `${elW}px`,
    height: `${elH}px`,
    pointerEvents: 'none',
    zIndex: '2147483647',
    willChange: 'transform',
    transform: 'translate(-9999px, -9999px)',
  })

  // Shadow — SVG with blurred cursor path
  const shadowSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  shadowSvg.setAttribute('viewBox', `-2 -2 ${CURSOR_W + 4} ${CURSOR_H + 4}`)
  shadowSvg.setAttribute('width', `${elW + Math.ceil(4 * s)}`)
  shadowSvg.setAttribute('height', `${elH + Math.ceil(4 * s)}`)
  shadowSvg.style.cssText = `position:absolute;top:${Math.round(2 * s)}px;left:${Math.round(1 * s)}px;pointer-events:none;overflow:visible;`
  shadowSvg.innerHTML = `
    <defs><filter id="${uid}-sh"><feGaussianBlur stdDeviation="1.8"/></filter></defs>
    <path d="${PATH}" fill="rgba(0,0,0,0.35)" filter="url(#${uid}-sh)"/>`

  // Glass — the refraction element
  const glass = document.createElement('div')
  Object.assign(glass.style, {
    position: 'relative',
    width: `${elW}px`,
    height: `${elH}px`,
    clipPath: `polygon(${clipPoly})`,
    backdropFilter: `url(#${filterId}) brightness(1.05) saturate(${opts.saturation})`,
    WebkitBackdropFilter: `url(#${filterId}) brightness(1.05) saturate(${opts.saturation})`,
    background: opts.frost > 0 ? `hsl(0 0% 80% / ${opts.frost})` : 'transparent',
  })

  // Specular edge — gradient stroke along cursor outline
  const edgeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  edgeSvg.setAttribute('viewBox', `0 0 ${CURSOR_W} ${CURSOR_H}`)
  edgeSvg.setAttribute('width', `${elW}`)
  edgeSvg.setAttribute('height', `${elH}`)
  edgeSvg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;overflow:visible;'
  edgeSvg.innerHTML = `
    <defs>
      <linearGradient id="${uid}-eg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="rgba(255,255,255,0.65)"/>
        <stop offset="45%" stop-color="rgba(255,255,255,0.12)"/>
        <stop offset="100%" stop-color="rgba(255,255,255,0.35)"/>
      </linearGradient>
    </defs>
    <path d="${PATH}" fill="none" stroke="url(#${uid}-eg)" stroke-width="0.5" stroke-linejoin="round"/>`

  wrap.appendChild(shadowSvg)
  wrap.appendChild(glass)
  wrap.appendChild(edgeSvg)

  // Hide native cursor
  const style = document.createElement('style')
  style.textContent = '* { cursor: none !important; }'

  document.body.appendChild(filterSvg)
  document.body.appendChild(wrap)
  document.head.appendChild(style)

  // Tracking state
  let mx = -9999, my = -9999
  let cx = -9999, cy = -9999
  let prevCx = cx
  let tilt = 0
  let running = false

  function onMove(e: MouseEvent) {
    mx = e.clientX
    my = e.clientY
    if (!running) { running = true; requestAnimationFrame(tick) }
  }

  function onLeave() {
    mx = my = -9999
    wrap.style.transform = 'translate(-9999px, -9999px)'
    running = false
  }

  function tick() {
    prevCx = cx
    cx += (mx - cx) * opts.lerp
    cy += (my - cy) * opts.lerp

    // Velocity tilt — clamped, skipped on large jumps (e.g. re-entry)
    const vx = cx - prevCx
    if (Math.abs(vx) < 50) {
      const target = Math.max(-4, Math.min(4, vx * 0.4))
      tilt += (target - tilt) * 0.08
    } else {
      tilt = 0
    }

    wrap.style.transform = `translate(${cx}px, ${cy}px) rotate(${tilt.toFixed(1)}deg)`

    if (Math.abs(mx - cx) > 0.1 || Math.abs(my - cy) > 0.1 || Math.abs(tilt) > 0.05) {
      requestAnimationFrame(tick)
    } else {
      tilt = 0
      wrap.style.transform = `translate(${cx}px, ${cy}px)`
      running = false
    }
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseleave', onLeave)

  return function destroy() {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseleave', onLeave)
    wrap.remove()
    filterSvg.remove()
    style.remove()
  }
}

// Auto-init when loaded as a plain script
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => createLiquidGlassCursor())
  } else {
    createLiquidGlassCursor()
  }
}
