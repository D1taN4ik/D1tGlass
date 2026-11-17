## refract.js v1.0.0 — first release 🎉

Refractive glass for any HTML element: one file, zero dependencies, no build step.

```html
<script src="refract.js"></script>
<header class="my-nav" data-refract>...</header>
```

### Highlights
- **Edge refraction:** the background bends along the element's rounded edges.
- **Chromatic aberration:** a subtle RGB fringe, adjustable or switchable off.
- **Tab bar with a sliding pill** (`data-rf-tabs`): it grows while pressed and fires an `rf:change` event.
- **Springy press** (`data-rf-press`) and **haptics** (`data-rf-haptic`).
- **Dynamic content:** elements added later are picked up automatically.
- **Customizable:** `data-rf-*` attributes, CSS custom properties and a small JS API.
- **TypeScript declarations** included.

### Browser support
Chromium browsers get the full effect. Safari, Firefox and all iOS browsers get a frosted-glass fallback.

### Assets
- `refract.js`: the library

See the [README](https://github.com/D1taN4ik/D1tGlass#readme) for full documentation.
