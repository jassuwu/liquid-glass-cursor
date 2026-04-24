<h1 align="center">liquid glass cursor</h1>

<p align="center">

<img src ="https://img.shields.io/badge/TypeScript-000000.svg?style=for-the-badge&logo=typescript&logoColor=white">
<img src ="https://img.shields.io/badge/Bun-000000.svg?style=for-the-badge&logo=bun&logoColor=white">
<img src ="https://img.shields.io/npm/v/liquid-glass-cursor?style=for-the-badge&color=000000">
<img src ="https://img.shields.io/npm/dm/liquid-glass-cursor?style=for-the-badge&color=000000">
<img src ="https://img.shields.io/badge/License-MIT-000000.svg?style=for-the-badge">

</p>

<p align="center">a drop-in cursor that refracts your page like a pane of glass.<br>zero dependencies. physics-based refraction. chromatic aberration.</p>

<p align="center">
  <img src="demo/lgc-readme-cover.gif" alt="liquid glass cursor demo" width="760">
</p>

<p align="center">
  <a href="https://liquid-glass-cursor-demo.vercel.app">live demo</a> &middot;
  <a href="https://www.npmjs.com/package/liquid-glass-cursor">npm</a> &middot;
  <a href="https://github.com/jassuwu/liquid-glass-cursor">github</a>
</p>

## install

**script tag** — fastest path; auto-initialises on load.

```html
<script src="https://unpkg.com/liquid-glass-cursor/dist/liquid-glass-cursor.js"></script>
```

**npm / bun**

```bash
npm i liquid-glass-cursor
# or
bun add liquid-glass-cursor
```

```ts
import { createLiquidGlassCursor } from 'liquid-glass-cursor'

const destroy = createLiquidGlassCursor()
// later, if you ever need to tear it down: destroy()
```

## how it works

The cursor is a small `<div>` clipped to the macOS arrow path. It draws nothing itself — it just punches a hole of refraction through whatever is behind it, via `backdrop-filter: url(#svg-filter)`.

The filter's only job is to tell the browser, per pixel: *"for the output here, sample the backdrop from there instead."* That mapping comes from a **displacement map** — an image whose red channel encodes the X-offset and blue channel encodes the Y-offset. The interesting part of this project is how that map is generated.

### the physics

A piece of glass with a rounded rim refracts by an amount proportional to the local slope of its top surface (thin-lens approximation: image displacement ∝ −∇h). So:

- **flat interior** → slope is zero → no distortion; the backdrop comes through untouched
- **beveled rim** → slope is steep → big displacement, pointing along the local surface normal

That last bit — *along the local normal* — is what makes glass look like glass. A global X/Y shear of the cursor area, or a simple radial pinch, is not physically equivalent: both warp at sharp corners and neither decays smoothly into the flat interior.

### how the map is built

For every pixel inside the cursor shape, at init:

1. Compute the distance `d` to the nearest edge segment. The macOS arrow path is seven line segments, so this is closed-form: project onto each segment, clamp the parameter, take the minimum distance.
2. Compute the outward unit normal as `(closest_edge_point − pixel) / d`. This naturally points perpendicular to whichever segment wins — including along the bisector at concave corners (the tail notch).
3. If `d < bevel_width`, the pixel is in the rim zone. Set `displacement = outward_normal × profile(d / bevel_width)`, where `profile(t) = 1 − (3t² − 2t³)` is an inverted smoothstep: max at the rim, zero at the inner boundary, zero derivative at both ends so the transition into the flat interior is C¹-smooth and seamless.
4. Encode as `R = 128 + 127·dx`, `B = 128 + 127·dy`. Neutral `(128, 128)` means "no displacement" — what the flat interior and everything outside the shape gets.

The canvas is rasterised at 4× oversampling, saved as a PNG data URL, and loaded into the filter via `feImage`. With a positive `scale`, rim pixels sample from further out of the cursor rectangle — magnification, the classic glass-dome look. Negative `scale` flips it to pinch.

### chromatic aberration

Three `feDisplacementMap` passes run in parallel with slightly different scale values, one per channel, and a screen blend recombines them. At the flat interior the offsets cancel — no colour split. At the rim they become a visible fringe because each channel refracts by a different amount, matching how real glass disperses light with wavelength.

### filter region

The filter region is padded to 200% of the element so displacement can sample real backdrop pixels from beyond the cursor's bounds. Inside that padded region, `feFlood` paints neutral grey everywhere and `feComposite over` overlays the map — so anywhere outside the cursor rectangle decays cleanly to "no displacement" without sampling transparent pixels.

## options

All options are optional; the defaults are tuned to look like liquid glass.

| option       | default        | what it does                                                            |
| ------------ | -------------- | ----------------------------------------------------------------------- |
| `size`       | `2`            | scale factor for the cursor geometry                                    |
| `scale`      | `30`           | max rim displacement in px (`+` magnifies, `−` pinches)                 |
| `border`     | `0.3`          | bevel width as fraction of shortest cursor dim                          |
| `outputBlur` | `0.4`          | final Gaussian blur in px, for anti-aliasing                            |
| `frost`      | `0.06`         | subtle white tint on the glass body (0 disables)                        |
| `saturation` | `1.2`          | saturation boost applied via `backdrop-filter`                          |
| `chromatic`  | `{0, 2, 4}`    | per-channel scale offsets for R/G/B — how wide the chromatic fringe is  |
| `lerp`       | `0.15`         | follow smoothing — lower = more lag                                     |

A heavier, more dispersive piece of glass:

```ts
createLiquidGlassCursor({
  scale: 45,
  border: 0.35,
  chromatic: { r: 0, g: 4, b: 8 },
  frost: 0.08,
})
```

## cleanup

```ts
const destroy = createLiquidGlassCursor()

// later — remove the cursor, restore the native one
destroy()
```

## browser support

Chromium-only, by necessity. The whole effect pivots on `backdrop-filter: url(#svg-filter)`, which Firefox and Safari don't support yet. If you ship this to a mixed-browser audience, feature-detect with `CSS.supports('backdrop-filter', 'url(#x)')` and bail gracefully.

## development

```bash
bun install
bun run dev         # live demo at http://localhost:3000
bun run build       # ESM + IIFE bundles → dist/
```

## license

MIT
