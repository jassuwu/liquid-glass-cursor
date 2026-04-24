/**
 * Liquid Glass Cursor
 *
 * Replaces the native cursor with a glass arrow that refracts the page
 * beneath it. The displacement map is *shape-aware*: for each pixel inside
 * the cursor, we encode a vector pointing along the OUTWARD normal of the
 * nearest edge, scaled by a bevel profile that peaks at the rim and fades
 * to zero in the flat interior. Fed into feDisplacementMap, this produces
 * physically-motivated refraction — magnification at the rim, undistorted
 * view through the center — rather than a global X/Y shear. Three parallel
 * displacement passes with slightly offset scales split the RGB channels
 * for chromatic aberration.
 */

export interface LiquidGlassCursorOptions {
  /** Cursor scale factor (default: 2) */
  size?: number
  /** Max displacement in px. Positive → magnify at rim. Negative → pinch. (default: 30) */
  scale?: number
  /** Bevel width as fraction of shortest cursor dim, 0–1 (default: 0.3) */
  border?: number
  /** Output Gaussian blur in px (default: 0.4) */
  outputBlur?: number
  /** Frost tint opacity 0–1 (default: 0.06) */
  frost?: number
  /** Saturation boost (default: 1.2) */
  saturation?: number
  /** Per-channel scale offset for chromatic aberration (default: {r:0, g:2, b:4}) */
  chromatic?: { r?: number; g?: number; b?: number }
  /** Smooth follow 0–1 — lower = more lag (default: 0.15) */
  lerp?: number
}

const DEFAULTS: Required<LiquidGlassCursorOptions> = {
  size: 2,
  scale: 30,
  border: 0.3,
  outputBlur: 0.4,
  frost: 0.06,
  saturation: 1.2,
  chromatic: { r: 0, g: 2, b: 4 },
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

  // ------------------------------------------------------------
  // Displacement map — shape-aware, built from the cursor's SDF.
  //
  // For each pixel inside the cursor path:
  //   • Compute distance `d` to the nearest edge segment.
  //   • Compute outward unit normal (from pixel → closest edge point).
  //   • If d < bevel: displacement = outward_normal · profile(d/bevel)
  //     else: zero (flat interior).
  //
  // Encoded as R = 128 + 127·dx, B = 128 + 127·dy, G = 128 (unused).
  // feDisplacementMap with positive `scale` samples outward → magnify.
  // ------------------------------------------------------------
  function buildMap(): string {
    const RES = 4                                          // oversample per cursor unit
    const w = Math.ceil(CURSOR_W * RES)
    const h = Math.ceil(CURSOR_H * RES)
    const bevel = opts.border * Math.min(CURSOR_W, CURSOR_H)  // in cursor units

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    const img = ctx.createImageData(w, h)
    const data = img.data

    // Precompute each edge segment: [ax, ay, dx, dy, |(dx,dy)|²]
    const segs: [number, number, number, number, number][] = []
    for (let i = 0; i < POINTS.length; i++) {
      const a = POINTS[i]
      const b = POINTS[(i + 1) % POINTS.length]
      const dx = b[0] - a[0]
      const dy = b[1] - a[1]
      segs.push([a[0], a[1], dx, dy, dx * dx + dy * dy])
    }

    for (let y = 0; y < h; y++) {
      const py = (y + 0.5) / RES                           // cursor-unit y
      for (let x = 0; x < w; x++) {
        const px = (x + 0.5) / RES                         // cursor-unit x
        const i = (y * w + x) * 4

        // Ray-casting point-in-polygon (even-odd rule — fine for simple polys)
        let inside = false
        for (let j = 0, k = POINTS.length - 1; j < POINTS.length; k = j++) {
          const xj = POINTS[j][0], yj = POINTS[j][1]
          const xk = POINTS[k][0], yk = POINTS[k][1]
          if ((yj > py) !== (yk > py) &&
              px < ((xk - xj) * (py - yj)) / (yk - yj) + xj) {
            inside = !inside
          }
        }

        let R = 128, B = 128

        if (inside) {
          // Closest-point on cursor boundary (analytical, per-segment)
          let minDistSq = Infinity
          let ncx = 0, ncy = 0
          for (let idx = 0; idx < segs.length; idx++) {
            const ax = segs[idx][0], ay = segs[idx][1]
            const sdx = segs[idx][2], sdy = segs[idx][3], l2 = segs[idx][4]
            let t = ((px - ax) * sdx + (py - ay) * sdy) / l2
            if (t < 0) t = 0
            else if (t > 1) t = 1
            const cx = ax + t * sdx
            const cy = ay + t * sdy
            const qx = px - cx
            const qy = py - cy
            const dsq = qx * qx + qy * qy
            if (dsq < minDistSq) {
              minDistSq = dsq
              ncx = cx
              ncy = cy
            }
          }
          const d = Math.sqrt(minDistSq)

          if (d < bevel && d > 1e-6) {
            // Outward unit vector: from the pixel TO the nearest edge point.
            // (Pixel is inside; edge is outward from it — this direction is
            // perpendicular to the edge, pointing OUT of the shape.)
            const ox = (ncx - px) / d
            const oy = (ncy - py) / d

            // Bevel profile: inverted smoothstep.
            //   profile(0) = 1  (max displacement at the rim)
            //   profile(1) = 0  (no displacement at inner bevel boundary)
            //   profile'(0) = profile'(1) = 0  (C¹ continuous at both ends
            //                                   → no visible seam with interior)
            const t = d / bevel
            const profile = 1 - (3 * t * t - 2 * t * t * t)

            const dxEnc = ox * profile
            const dyEnc = oy * profile

            R = Math.max(0, Math.min(255, Math.round(128 + 127 * dxEnc)))
            B = Math.max(0, Math.min(255, Math.round(128 + 127 * dyEnc)))
          }
        }

        data[i] = R
        data[i + 1] = 128          // G unused by displacement; kept neutral
        data[i + 2] = B
        data[i + 3] = 255
      }
    }

    ctx.putImageData(img, 0, 0)
    return canvas.toDataURL('image/png')
  }

  // ------------------------------------------------------------
  // SVG filter — 3 displacement passes for RGB chromatic aberration.
  //
  // The filter region is padded to 200% of the element so displacement
  // samples from outside the cursor still land on real backdrop pixels.
  // Inside that padded region, feFlood paints neutral gray (128,128,128)
  // everywhere, and feImage overlays the cursor-sized displacement map on
  // top — so anywhere outside the element maps to "no displacement".
  // ------------------------------------------------------------
  const mapUrl = buildMap()
  const filterSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  filterSvg.setAttribute('width', '0')
  filterSvg.setAttribute('height', '0')
  filterSvg.style.cssText = 'position:absolute;pointer-events:none;'
  filterSvg.innerHTML = `<defs><filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
    <feFlood flood-color="rgb(128,128,128)" result="neutral"/>
    <feImage x="0" y="0" width="${elW}" height="${elH}" preserveAspectRatio="none" href="${mapUrl}" result="mapImg"/>
    <feComposite in="mapImg" in2="neutral" operator="over" result="map"/>
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
