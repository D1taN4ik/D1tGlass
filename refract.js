/*!
 * refract.js v1.0.0
 * Refractive glass effect for any HTML element: edge refraction + chromatic aberration.
 * Usage: <script src="refract.js"></script>, then add the data-refract attribute to any element.
 * MIT License
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Refract = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const VERSION = "1.0.0";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const GLASS_SELECTOR = "[data-refract], .refract";
  const TABS_SELECTOR = "[data-rf-tabs]";
  const DEFAULTS = Object.freeze({
    scale: 50,        // refraction strength, px
    bezel: 20,        // width of the curved edge zone, px
    aberration: 0.08, // RGB channel split (0 = off)
    blur: 0.6,        // extra blur on top of refraction, px
    saturate: 170,    // saturation, %
    brightness: 1.06  // brightness
  });
  const OPTION_KEYS = Object.keys(DEFAULTS);
  const OPTION_ATTRS = OPTION_KEYS.map(k => "data-rf-" + k);

  const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
  const ua = isBrowser ? navigator.userAgent : "";
  // SVG filters inside backdrop-filter are only supported by Chromium. Every iOS browser is WebKit.
  const supported = isBrowser && /Chrome\/\d+/.test(ua) && !/iPhone|iPad|iPod|CriOS|FxiOS|EdgiOS/.test(ua);

  /* ------------------------------------------------------------------ */
  /* Styles (inserted at the top of <head>, so site styles always win)   */
  /* ------------------------------------------------------------------ */
  const CSS = `
:where(.rf-glass, [data-refract], .refract) {
  --rf-tint: rgba(255,255,255,.06);
  --rf-highlight: rgba(255,255,255,.16);
  --rf-border: rgba(255,255,255,.18);
  --rf-fallback-blur: 14px;
  isolation: isolate;
  background-color: var(--rf-tint);
  background-image: linear-gradient(180deg, var(--rf-highlight) 0%, transparent 45%);
  -webkit-backdrop-filter: blur(var(--rf-fallback-blur)) saturate(180%);
  backdrop-filter: blur(var(--rf-fallback-blur)) saturate(180%);
  box-shadow:
    inset 0 0 0 1px var(--rf-border),
    inset 1.5px 1.5px 0 -.5px rgba(255,255,255,.55),
    inset -1.5px -1.5px 0 -.5px rgba(255,255,255,.25),
    0 10px 30px rgba(0,0,0,.28),
    0 2px 6px rgba(0,0,0,.18);
}
:where([data-rf-tint="light"]) { --rf-tint: rgba(255,255,255,.22); --rf-highlight: rgba(255,255,255,.3); }
:where([data-rf-tint="dark"])  { --rf-tint: rgba(12,12,18,.30);  --rf-highlight: rgba(255,255,255,.08); }
:where([data-rf-tint="clear"]) { --rf-tint: transparent;          --rf-highlight: rgba(255,255,255,.08); }

:where([data-rf-press]) { transition: scale .35s cubic-bezier(.34,1.56,.64,1); }
:where([data-rf-press]:active) { scale: .95; }

:where([data-rf-tabs]) { position: relative; }
:where([data-rf-tabs]) > :where(:not(.rf-indicator)) { position: relative; z-index: 1; }
.rf-indicator {
  position: absolute; left: 0; z-index: 0; pointer-events: none;
  top: var(--rf-pill-inset, 5px); bottom: var(--rf-pill-inset, 5px);
  border-radius: var(--rf-pill-radius, 999px);
  background: var(--rf-pill, rgba(255,255,255,.16));
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.22), inset 0 1px 0 rgba(255,255,255,.4);
  transition:
    transform .55s cubic-bezier(.34,1.56,.64,1),
    width .55s cubic-bezier(.34,1.56,.64,1),
    scale .45s cubic-bezier(.34,1.56,.64,1),
    background .25s, box-shadow .25s;
}
.rf-no-anim > .rf-indicator { transition: none !important; }
.rf-pressing > .rf-indicator {
  scale: var(--rf-pill-grow, 1.18 1.32);
  background: var(--rf-pill-active, rgba(255,255,255,.26));
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.35), inset 0 1px 0 rgba(255,255,255,.6), 0 6px 18px rgba(0,0,0,.25);
}
.rf-haptic { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; overflow: hidden; pointer-events: none; }
@media (prefers-reduced-motion: reduce) {
  .rf-indicator, :where([data-rf-press]) { transition: none; }
}`;

  function injectCSS() {
    if (document.getElementById("refract-css")) return;
    const style = document.createElement("style");
    style.id = "refract-css";
    style.textContent = CSS;
    const head = document.head || document.documentElement;
    head.insertBefore(style, head.firstChild);
  }

  /* ------------------------------------------------------------------ */
  /* Displacement map                                                    */
  /* ------------------------------------------------------------------ */
  // R = X offset, G = Y offset, 128 = no offset. Bending only happens inside the bezel band.
  function buildDisplacementMap(w, h, r, bezel) {
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(w, h);
    const data = img.data;
    new Uint32Array(data.buffer).fill(0xFF808080); // neutral grey, alpha 255

    const hw = w / 2, hh = h / 2;
    const sdf = (x, y) => {
      const px = Math.abs(x - hw) - (hw - r);
      const py = Math.abs(y - hh) - (hh - r);
      return Math.hypot(Math.max(px, 0), Math.max(py, 0)) + Math.min(Math.max(px, py), 0) - r;
    };
    const pixel = (x, y) => {
      const cx = x + .5, cy = y + .5;
      const dist = -sdf(cx, cy);
      if (dist <= 0 || dist >= bezel) return;
      const gx = sdf(cx + 1, cy) - sdf(cx - 1, cy);
      const gy = sdf(cx, cy + 1) - sdf(cx, cy - 1);
      const len = Math.hypot(gx, gy) || 1;
      const t = 1 - dist / bezel;
      const m = t * t * (3 - 2 * t); // smoothstep
      const i = (y * w + x) * 4;
      data[i]     = 128 - (gx / len) * m * 127;
      data[i + 1] = 128 - (gy / len) * m * 127;
    };

    // Only the edge band is computed; the center is always neutral (matters for large elements)
    const band = Math.ceil(Math.max(bezel, r));
    const edge = Math.ceil(bezel);
    for (let y = 0; y < h; y++) {
      if (y < band || y >= h - band) {
        for (let x = 0; x < w; x++) pixel(x, y);
      } else {
        for (let x = 0; x < Math.min(edge, w); x++) pixel(x, y);
        for (let x = Math.max(w - edge, edge); x < w; x++) pixel(x, y);
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL();
  }

  /* ------------------------------------------------------------------ */
  /* SVG filters (shared between elements with identical size/options)   */
  /* ------------------------------------------------------------------ */
  let svgHost = null;
  let filterSeq = 0;
  const filters = new Map(); // key -> { id, node, refs }

  function getHost() {
    if (!svgHost) {
      svgHost = document.createElementNS(SVG_NS, "svg");
      svgHost.setAttribute("aria-hidden", "true");
      svgHost.setAttribute("width", "0");
      svgHost.setAttribute("height", "0");
      svgHost.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
      document.body.appendChild(svgHost);
    }
    return svgHost;
  }

  const svgEl = (tag, attrs) => {
    const n = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };

  function buildFilter(id, w, h, map, scale, ab) {
    const f = svgEl("filter", {
      id, x: 0, y: 0, width: w, height: h,
      filterUnits: "userSpaceOnUse", "color-interpolation-filters": "sRGB"
    });
    f.appendChild(svgEl("feImage", { href: map, x: 0, y: 0, width: w, height: h, result: "map", preserveAspectRatio: "none" }));
    const channels = [
      ["r", scale * (1 + ab), "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"],
      ["g", scale,            "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"],
      ["b", scale * (1 - ab), "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"]
    ];
    for (const [n, s, m] of channels) {
      f.appendChild(svgEl("feDisplacementMap", {
        in: "SourceGraphic", in2: "map", scale: s,
        xChannelSelector: "R", yChannelSelector: "G", result: "d" + n
      }));
      f.appendChild(svgEl("feColorMatrix", { in: "d" + n, type: "matrix", values: m, result: n }));
    }
    f.appendChild(svgEl("feBlend", { in: "r", in2: "g", mode: "screen", result: "rg" }));
    f.appendChild(svgEl("feBlend", { in: "rg", in2: "b", mode: "screen" }));
    return f;
  }

  function acquireFilter(key, make) {
    let f = filters.get(key);
    if (!f) {
      const id = "rf-filter-" + (++filterSeq);
      const node = make(id);
      getHost().appendChild(node);
      f = { id, node, refs: 0 };
      filters.set(key, f);
    }
    f.refs++;
    return f.id;
  }

  function releaseFilter(key) {
    const f = filters.get(key);
    if (f && --f.refs <= 0) { f.node.remove(); filters.delete(key); }
  }

  /* ------------------------------------------------------------------ */
  /* Glass instances                                                     */
  /* ------------------------------------------------------------------ */
  const instances = new WeakMap();
  const resizeObserver = isBrowser && "ResizeObserver" in window
    ? new ResizeObserver(entries => entries.forEach(e => { const i = instances.get(e.target); if (i) render(i); }))
    : null;

  function readOptions(el, jsOpts) {
    const o = Object.assign({}, DEFAULTS);
    for (const k of OPTION_KEYS) {
      const v = el.getAttribute("data-rf-" + k);
      if (v !== null && v.trim() !== "" && !isNaN(+v)) o[k] = +v;
    }
    return Object.assign(o, jsOpts); // priority: defaults < attributes < JS options
  }

  function radiusOf(el, w, h) {
    const v = getComputedStyle(el).borderTopLeftRadius;
    let r = v.trim().endsWith("%") ? parseFloat(v) / 100 * Math.min(w, h) : parseFloat(v);
    if (!isFinite(r)) r = 0;
    return Math.min(r, w / 2, h / 2);
  }

  function render(inst) {
    if (!supported) return;
    const el = inst.el;
    const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
    if (!w || !h) return;
    const o = readOptions(el, inst.opts);
    const r = Math.round(radiusOf(el, w, h));
    const bezel = Math.max(1, Math.min(o.bezel, w / 2, h / 2));
    const key = [w, h, r, bezel, o.scale, o.aberration].join("|");

    if (key !== inst.key) {
      inst.id = acquireFilter(key, id =>
        buildFilter(id, w, h, buildDisplacementMap(w, h, r, bezel), o.scale, o.aberration));
      if (inst.key) releaseFilter(inst.key);
      inst.key = key;
    }
    const value = `url(#${inst.id}) blur(${o.blur}px) saturate(${o.saturate}%) brightness(${o.brightness})`;
    el.style.backdropFilter = value;
    el.style.webkitBackdropFilter = value;
  }

  function toElements(target) {
    if (!target) return [];
    if (typeof target === "string") return [...document.querySelectorAll(target)];
    if (target instanceof Element) return [target];
    return [...target];
  }

  /**
   * Apply the glass effect to one or more elements.
   * @param {Element|NodeList|Array|string} target — element, list or CSS selector
   * @param {object} [opts] — { scale, bezel, aberration, blur, saturate, brightness }
   */
  function apply(target, opts, _auto) {
    if (!isBrowser) return;
    injectCSS();
    toElements(target).forEach(el => {
      let inst = instances.get(el);
      if (!inst) {
        inst = { el, opts: {}, key: null, id: null, auto: !!_auto };
        instances.set(el, inst);
        el.classList.add("rf-glass");
        if (resizeObserver) resizeObserver.observe(el);
      }
      if (opts) Object.assign(inst.opts, opts);
      render(inst);
    });
  }

  /** Remove the effect from element(s) and release their filters. */
  function remove(target) {
    toElements(target).forEach(el => {
      const inst = instances.get(el);
      if (!inst) return;
      if (inst.key) releaseFilter(inst.key);
      if (resizeObserver) resizeObserver.unobserve(el);
      el.style.backdropFilter = "";
      el.style.webkitBackdropFilter = "";
      el.classList.remove("rf-glass");
      instances.delete(el);
    });
  }

  /** Recalculate the effect (e.g. after changing border-radius from JS). */
  function refresh(target) {
    const els = target ? toElements(target) : document.querySelectorAll(".rf-glass");
    els.forEach(el => { const i = instances.get(el); if (i) { i.key && releaseFilter(i.key); i.key = null; render(i); } });
  }

  /* ------------------------------------------------------------------ */
  /* Haptics                                                             */
  /* ------------------------------------------------------------------ */
  let hapticLabel = null;
  /** Short vibration. Android: Vibration API; Safari on iOS 18+: native switch trick. */
  function haptic(ms) {
    try {
      if (navigator.vibrate) { navigator.vibrate(ms || 10); return; }
      if (!hapticLabel) {
        hapticLabel = document.createElement("label");
        hapticLabel.className = "rf-haptic";
        hapticLabel.setAttribute("aria-hidden", "true");
        const input = document.createElement("input");
        input.type = "checkbox";
        input.setAttribute("switch", "");
        input.tabIndex = -1;
        hapticLabel.appendChild(input);
        document.body.appendChild(hapticLabel);
      }
      hapticLabel.click();
    } catch (_) { /* ignore silently */ }
  }

  /* ------------------------------------------------------------------ */
  /* Tabs with a sliding pill                                            */
  /* ------------------------------------------------------------------ */
  const tabsInstances = new WeakMap();

  /**
   * Turn a container into a tab bar with a sliding pill.
   * Fires "rf:change" (detail: { index, tab, previous }) when the active tab changes.
   */
  function tabs(container) {
    if (tabsInstances.has(container)) { tabsInstances.get(container).layout(); return tabsInstances.get(container); }
    injectCSS();

    const indicator = document.createElement("div");
    indicator.className = "rf-indicator";
    container.prepend(indicator);

    const items = () => {
      const kids = [...container.children].filter(c => c !== indicator);
      const marked = kids.filter(c => c.hasAttribute("data-rf-tab"));
      return marked.length ? marked : kids;
    };
    const isActive = el => el.classList.contains("is-active") || el.classList.contains("active") ||
      el.getAttribute("aria-selected") === "true" || el.getAttribute("aria-current") === "page" ||
      el.hasAttribute("data-rf-active");

    let active = Math.max(0, items().findIndex(isActive));
    const hapticOn = container.getAttribute("data-rf-haptic") !== "off";

    if (!container.hasAttribute("role")) container.setAttribute("role", "tablist");
    items().forEach(t => { if (!t.hasAttribute("role")) t.setAttribute("role", "tab"); });

    function place(i) {
      const t = items()[i];
      if (!t) return;
      indicator.style.width = t.offsetWidth + "px";
      indicator.style.transform = `translateX(${t.offsetLeft}px)`;
    }

    function setActive(i, emit) {
      const list = items();
      if (!list[i]) return;
      const previous = active;
      active = i;
      list.forEach((t, j) => {
        t.classList.toggle("is-active", i === j);
        t.setAttribute("aria-selected", i === j ? "true" : "false");
      });
      place(i);
      if (emit && previous !== i) {
        container.dispatchEvent(new CustomEvent("rf:change", { bubbles: true, detail: { index: i, tab: list[i], previous } }));
      }
    }

    const indexFromEvent = e => items().findIndex(t => t.contains(e.target));

    container.addEventListener("pointerdown", e => {
      const i = indexFromEvent(e);
      if (i < 0) return;
      container.classList.add("rf-pressing");
      place(i);
      if (hapticOn) haptic(10);
    });
    container.addEventListener("click", e => {
      const i = indexFromEvent(e);
      if (i >= 0) setActive(i, true);
    });
    const release = () => container.classList.remove("rf-pressing");
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", () => { release(); place(active); });

    // Initial placement without animation
    container.classList.add("rf-no-anim");
    setActive(active, false);
    void indicator.offsetWidth;
    requestAnimationFrame(() => container.classList.remove("rf-no-anim"));

    if ("ResizeObserver" in window) new ResizeObserver(() => place(active)).observe(container);

    const api = {
      get index() { return active; },
      select: i => setActive(i, true),
      layout: () => place(active),
      element: container
    };
    tabsInstances.set(container, api);
    return api;
  }

  /* ------------------------------------------------------------------ */
  /* Auto-init + watching for new elements                               */
  /* ------------------------------------------------------------------ */
  function scan(rootEl) {
    if (!rootEl || rootEl.nodeType !== 1) return;
    if (rootEl.matches(GLASS_SELECTOR)) apply(rootEl, null, true);
    rootEl.querySelectorAll(GLASS_SELECTOR).forEach(el => apply(el, null, true));
    if (rootEl.matches(TABS_SELECTOR)) tabs(rootEl);
    rootEl.querySelectorAll(TABS_SELECTOR).forEach(tabs);
  }

  function cleanup(rootEl) {
    if (!rootEl || rootEl.nodeType !== 1) return;
    const check = el => { if (!el.isConnected && instances.has(el)) remove(el); };
    check(rootEl);
    rootEl.querySelectorAll(".rf-glass").forEach(check);
  }

  let observer = null;
  function observe() {
    if (observer || !("MutationObserver" in window)) return;
    observer = new MutationObserver(records => {
      for (const r of records) {
        if (r.type === "childList") {
          r.removedNodes.forEach(cleanup);
          r.addedNodes.forEach(scan);
        } else if (r.type === "attributes") {
          const el = r.target;
          const inst = instances.get(el);
          if (el.matches(GLASS_SELECTOR)) apply(el, null, true);
          else if (inst && inst.auto && (r.attributeName === "data-refract" || r.attributeName === "class")) remove(el);
          else if (inst) render(inst); // data-rf-* changed on an element attached via JS
          if (el.matches(TABS_SELECTOR)) tabs(el);
        }
      }
    });
    observer.observe(document.documentElement, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ["data-refract", "class", "data-rf-tabs", ...OPTION_ATTRS]
    });
  }

  // Haptics on any element with data-rf-haptic (tabs handle their own)
  function bindHaptics() {
    document.addEventListener("pointerdown", e => {
      const t = e.target.closest && e.target.closest("[data-rf-haptic]");
      if (!t || t.matches(TABS_SELECTOR) || t.getAttribute("data-rf-haptic") === "off") return;
      haptic(+t.getAttribute("data-rf-haptic") || 10);
    }, { passive: true });
  }

  let initialized = false;
  /** Manual start (when the script is loaded with the data-rf-manual attribute). */
  function init() {
    if (initialized || !isBrowser) return;
    initialized = true;
    injectCSS();
    scan(document.body);
    observe();
    bindHaptics();
  }

  if (isBrowser) {
    const script = document.currentScript;
    const manual = script && script.hasAttribute("data-rf-manual");
    if (!manual) {
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
      else init();
    }
  }

  return { version: VERSION, supported, defaults: DEFAULTS, init, apply, remove, refresh, tabs, haptic };
});
