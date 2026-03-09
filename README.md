<h1 align="center">liquid glass cursor</h1>

<p align="center">

<img src ="https://img.shields.io/badge/TypeScript-000000.svg?style=for-the-badge&logo=typescript&logoColor=white">
<img src ="https://img.shields.io/badge/Bun-000000.svg?style=for-the-badge&logo=bun&logoColor=white">
<img src ="https://img.shields.io/npm/v/liquid-glass-cursor?style=for-the-badge&color=000000">
<img src ="https://img.shields.io/npm/dm/liquid-glass-cursor?style=for-the-badge&color=000000">
<img src ="https://img.shields.io/badge/License-MIT-000000.svg?style=for-the-badge">

</p>

<p align="center">drop-in glass cursor that refracts your page through SVG displacement + backdrop-filter.<br>zero dependencies. chromatic aberration. physics-based motion.</p>

<p align="center">
  <img src="demo/showcase.png" alt="liquid glass cursor demo" width="600">
</p>

<p align="center">
  <a href="https://liquid-glass-cursor-demo.vercel.app">live demo</a> &middot;
  <a href="https://www.npmjs.com/package/liquid-glass-cursor">npm</a> &middot;
  <a href="https://github.com/jassuwu/liquid-glass-cursor">github</a>
</p>

## install

**script tag** (easiest)

```html
<script src="https://unpkg.com/liquid-glass-cursor/dist/liquid-glass-cursor.js"></script>
```

**npm / bun**

```bash
npm i liquid-glass-cursor
```

```ts
import { createLiquidGlassCursor } from 'liquid-glass-cursor'

createLiquidGlassCursor()
```

## options

```ts
createLiquidGlassCursor({
  size: 2,            // scale factor
  scale: -60,         // displacement intensity
  border: 0.2,        // edge refraction width 0–1
  lightness: 50,      // center neutral lightness 0–100
  alpha: 0.9,         // center fill opacity 0–1
  blur: 5,            // edge blur in px
  outputBlur: 0.5,    // output filter blur
  blend: 'difference',// gradient blend mode
  frost: 0.05,        // frost tint opacity 0–1
  saturation: 1.2,    // saturation boost
  chromatic: {        // RGB channel separation
    r: 0,
    g: 4,
    b: 8,
  },
  lerp: 0.15,         // smooth follow 0–1 (lower = more lag)
})
```

## how it works

1. **SVG displacement map** — colored gradients at the cursor edges act as a refraction source
2. **3-pass RGB split** — each color channel is displaced independently, then recombined with screen blending for chromatic aberration
3. **backdrop-filter** — the glass element uses `backdrop-filter: url(#filter)` to refract whatever is behind it
4. **physics motion** — velocity-based tilt with lerp smoothing for natural cursor feel

## cleanup

```ts
const destroy = createLiquidGlassCursor()

// later, remove the cursor
destroy()
```

## browser support

chromium only — `backdrop-filter` with `url()` SVG references isn't supported in firefox / safari yet.

## project structure

```
liquid-glass-cursor/
├── index.ts              # library source
├── dist/
│   ├── index.js          # ESM build
│   └── liquid-glass-cursor.js  # IIFE build (script tag)
├── demo/
│   ├── index.html        # demo page
│   ├── demo.ts           # demo init
│   ├── serve.ts          # bun dev server
│   └── style.css         # demo styles
└── package.json
```

## development

```bash
bun install
bun run dev
```

## license

MIT
