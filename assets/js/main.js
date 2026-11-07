/* Fernando Quijada portfolio: the drink menu, the brewing animation, the glass you drink as you scroll.
   No dependencies. Works on GitHub Pages and from a plain file. */
(function () {
  "use strict";
  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var NS = "http://www.w3.org/2000/svg";

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function phase(t, a, b) { return clamp01((t - a) / (b - a)); }
  function easeInOut(v) { return v < .5 ? 2 * v * v : 1 - Math.pow(-2 * v + 2, 2) / 2; }
  function easeOut(v) { return 1 - Math.pow(1 - v, 3); }
  function easeIn(v) { return v * v * v; }

  /* ---------- Latte / Espresso theme ---------- */
  function store(key, val) {
    try { if (val === undefined) return localStorage.getItem(key); localStorage.setItem(key, val); } catch (e) { return null; }
  }
  function currentTheme() {
    var set = root.getAttribute("data-theme");
    if (set) return set;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function syncThemeButtons() {
    var t = currentTheme();
    document.querySelectorAll("[data-set-theme]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-set-theme") === t));
    });
  }
  var saved = store("fq-theme");
  if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);
  document.querySelectorAll("[data-set-theme]").forEach(function (b) {
    b.addEventListener("click", function () {
      var t = b.getAttribute("data-set-theme");
      root.setAttribute("data-theme", t);
      store("fq-theme", t);
      syncThemeButtons();
    });
  });
  syncThemeButtons();

  /* ---------- The menu ----------
     Each section is a drink. `glass` is the side-view recipe, bottom to top, as fractions of the glass:
     [espresso, steamed milk, foam]. A cortado is equal parts espresso and milk; a cappuccino is thirds. */
  var DRINKS = {
    about:      { drink: "latte",      section: "About me",      cupR: 150, type: "mug",       milk: "#c48a55", art: "heart", heart: 2.3, glass: [.18, .62, .16] },
    projects:   { drink: "cortado",    section: "Projects",      cupR: 112, type: "glass",     milk: "#b9804f", art: "heart", heart: 1.55, glass: [.46, .46, .06] },
    experience: { drink: "cappuccino", section: "Experience",    cupR: 140, type: "mug",       milk: "#d8b893", art: "heart", heart: 2.0, foamRing: true, glass: [.32, .32, .34] },
    interests:  { drink: "macchiato",  section: "Interests",     cupR: 96,  type: "demitasse", milk: null,      art: "dot",   glass: [.74, 0, .14] },
    connect:    { drink: "americano",  section: "Let's connect", cupR: 150, type: "mug",       milk: null,      art: "none",  water: true, glass: [.92, 0, 0] }
  };
  /* "top" brews the drink from above; "side" shows the pitcher or kettle pouring, then tilts up to the top view.
     Set with <meta name="brew-style" content="side"> in index.html. */
  var brewMeta = document.querySelector('meta[name="brew-style"]');
  var BREW_STYLE = brewMeta && brewMeta.getAttribute("content") === "side" ? "side" : "top";
  var ORDER = ["about", "projects", "experience", "interests", "connect"];
  /* Latte art outline. The poured blob (a circle) eases into a heart as the pitcher cuts through it.
     Every point of the outline travels from the circle to the matching point of the heart at the same time,
     with only a slight head start for the top, so the shape changes smoothly with no kinks.
     m = 0 is the round blob, m = 1 the finished heart; S is pixels per unit (the heart is 32 units wide). */
  function artPath(cx, cy, S, m) {
    var N = 144, pts = [];
    for (var i = 0; i < N; i++) {
      var t = 2 * Math.PI * i / N, st = Math.sin(t), ct = Math.cos(t);
      var hx = 16 * st * st * st;
      var hy = -(13 * ct - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) - 2.5;
      var bx = 14.5 * st, by = -14.5 * ct;
      var u = (1 - ct) / 2;
      var w = easeInOut(clamp01((m - .15 * u) / .85));
      pts.push([cx + (bx + (hx - bx) * w) * S, cy + (by + (hy - by) * w) * S]);
    }
    function mid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
    var m0 = mid(pts[N - 1], pts[0]);
    var d = "M" + m0[0].toFixed(2) + " " + m0[1].toFixed(2);
    for (var j = 0; j < N; j++) {
      var p = pts[j], q = mid(p, pts[(j + 1) % N]);
      d += "Q" + p[0].toFixed(2) + " " + p[1].toFixed(2) + " " + q[0].toFixed(2) + " " + q[1].toFixed(2);
    }
    return d + "Z";
  }
  /* timing shared by the top view and the side view (in brewing progress t) */
  var ART = { grow: [.38, .76], drag: [.6, .86], shape: [.58, .94] };
  var uid = 0;

  /* A drink seen from above. update(t) draws it at brewing progress t (0 = empty cup, 1 = finished).
     With `host`, only the liquid surface is drawn, into host.group (the side-view cup uses this). */
  function buildTopDrink(spec, host) {
    var id = "td" + (++uid);
    var C = 200, R = spec.cupR, LR = spec.type === "glass" ? R - 9 : R - 16;
    var svg = host ? host.svg : el("svg", { viewBox: "0 0 400 400", "aria-hidden": "true", focusable: "false" });
    var defs = host ? host.defs : el("defs", {}, svg);
    var g1 = el("radialGradient", { id: id + "c", cx: ".5", cy: ".5", r: ".55" }, defs);
    el("stop", { offset: "0", "stop-color": "#c98a48" }, g1);
    el("stop", { offset: ".7", "stop-color": "#9a5c2a" }, g1);
    el("stop", { offset: "1", "stop-color": "#4d2a15" }, g1);
    var g2 = el("radialGradient", { id: id + "m", cx: ".5", cy: ".5", r: ".5" }, defs);
    el("stop", { offset: "0", "stop-color": spec.milk || "#c48a55" }, g2);
    el("stop", { offset: ".82", "stop-color": spec.milk || "#c48a55" }, g2);
    el("stop", { offset: "1", "stop-color": "#7a4724" }, g2);
    el("circle", { cx: C, cy: C, r: LR }, el("clipPath", { id: id + "k" }, defs));

    if (!host) {
    var saucerR = spec.type === "glass" ? R + 26 : R + 38;
    el("circle", { cx: C, cy: C, r: saucerR, fill: "#efe8dc", stroke: "#cfc3b0", "stroke-width": 2 }, svg);
    if (spec.type !== "glass") {
      var hw = spec.type === "demitasse" ? 40 : 58, hh = spec.type === "demitasse" ? 26 : 34;
      el("rect", { x: C + R - 12, y: C - hh / 2, width: hw + 12, height: hh, rx: hh / 2, fill: "#fbf8f2", stroke: "#cfc3b0", "stroke-width": 2 }, svg);
      el("circle", { cx: C, cy: C, r: R, fill: "#fbf8f2", stroke: "#cfc3b0", "stroke-width": 2 }, svg);
    } else {
      el("circle", { cx: C, cy: C, r: R, fill: "#e9e4dc", stroke: "#b8b0a3", "stroke-width": 2.5 }, svg);
      el("circle", { cx: C, cy: C, r: R - 5, fill: "none", stroke: "#ffffff", "stroke-opacity": ".7", "stroke-width": 2 }, svg);
    }
    el("circle", { cx: C, cy: C, r: LR, fill: "#e8dfd2" }, svg);
    }

    var liquid = el("g", { "clip-path": "url(#" + id + "k)" }, host ? host.group : svg);
    var esp = el("circle", { cx: C, cy: C, r: 0, fill: "url(#" + id + "c)" }, liquid);
    var milk = spec.milk ? el("circle", { cx: C, cy: C, r: LR, fill: "url(#" + id + "m)", opacity: 0 }, liquid) : null;
    var ring = spec.foamRing ? el("circle", { cx: C, cy: C, r: LR - 6, fill: "none", stroke: "#f6ead8", "stroke-width": 12, opacity: 0 }, liquid) : null;
    var dark = spec.water ? el("circle", { cx: C, cy: C, r: LR, fill: "#2c170c", opacity: 0 }, liquid) : null;
    var ripples = [];
    if (spec.water) for (var i = 0; i < 3; i++) ripples.push(el("circle", { cx: C, cy: C, r: 0, fill: "none", stroke: "#d9a86e", "stroke-width": 3, opacity: 0 }, liquid));
    var art = null, dot = null;
    var blur = null;
    if (spec.art === "heart") {
      var flt = el("filter", { id: id + "b", x: "-30%", y: "-30%", width: "160%", height: "160%" }, defs);
      blur = el("feGaussianBlur", { stdDeviation: 0 }, flt);
      art = el("path", { d: "M0 0", fill: "#fff8ec", opacity: 0, filter: "url(#" + id + "b)" }, liquid);
    }
    if (spec.art === "dot") {
      dot = el("circle", { cx: C, cy: C, r: 0, fill: "#fff8ec", stroke: "#efdcc1", "stroke-width": 3 }, liquid);
    }
    var stream = el("circle", { cx: C, cy: C, r: 0, fill: "#3b2010", opacity: 0 }, host ? host.group : svg);

    function update(t) {
      /* espresso spreads out from the center of the cup */
      var e = easeOut(phase(t, 0, .34));
      esp.setAttribute("r", (LR * e).toFixed(2));
      /* milk (or hot water) pours in */
      var m = phase(t, .3, .78);
      if (milk) milk.setAttribute("opacity", (easeInOut(m) * (spec.drink === "cortado" ? .8 : .95)).toFixed(3));
      if (ring) ring.setAttribute("opacity", (easeInOut(phase(t, .5, .9)) * .85).toFixed(3));
      if (dark) dark.setAttribute("opacity", (easeInOut(m) * .42).toFixed(3));
      ripples.forEach(function (rp, j) {
        var p = phase(t, .32 + j * .12, .32 + j * .12 + .4);
        rp.setAttribute("r", (LR * easeOut(p)).toFixed(2));
        rp.setAttribute("opacity", (p > 0 && p < 1 ? (1 - p) * .7 : 0).toFixed(3));
      });
      /* the pour itself, seen from above */
      var pourEsp = t > .02 && t < .3, pourMilk = t > .32 && t < (spec.art === "heart" ? .86 : .76);
      var wob = Math.sin(t * 60) * 1.4;
      if (pourEsp) {
        stream.setAttribute("fill", "#3b2010"); stream.setAttribute("r", 6); stream.setAttribute("opacity", 1);
      } else if (pourMilk && (milk || dot || dark)) {
        stream.setAttribute("fill", dark ? "#c9a274" : "#fffaf1");
        stream.setAttribute("r", (dark ? 7 : 7.5).toFixed(1));
        stream.setAttribute("opacity", dark ? .7 : 1);
      } else {
        stream.setAttribute("opacity", 0);
      }
      stream.setAttribute("cx", (C + wob).toFixed(2));
      stream.setAttribute("cy", C);
      /* latte art: the milk surfaces as a soft white spot under the stream, grows into a round blob,
         then the stream is dragged through it from top to bottom, cutting the blob into a heart */
      if (art) {
        var S = 2.25 * spec.heart;
        var gp = phase(t, ART.grow[0], ART.grow[1]);
        var g = easeInOut(gp);
        var dragP = easeInOut(phase(t, ART.drag[0], ART.drag[1]));
        var shape = phase(t, ART.shape[0], ART.shape[1]);
        var scale = S * (.06 + .94 * g);
        art.setAttribute("d", artPath(C, C, scale, shape));
        art.setAttribute("opacity", easeOut(clamp01(gp * 3)).toFixed(3));
        var bl = (1 - easeOut(clamp01(gp * 1.6))) * 5;
        if (bl > .05) { blur.setAttribute("stdDeviation", bl.toFixed(2)); art.setAttribute("filter", "url(#" + id + "b)"); }
        else art.removeAttribute("filter");
        /* the stream starts in the middle of the blob and is pulled forward through it to make the point */
        stream.setAttribute("cy", (C + 15 * S * dragP).toFixed(2));
        if (dragP > 0) stream.setAttribute("r", (7.5 * (1 - .4 * dragP)).toFixed(2));
      }
      if (dot) {
        var dg = easeOut(phase(t, .45, .78));
        dot.setAttribute("r", (24 * dg).toFixed(2));
        dot.setAttribute("opacity", Math.min(1, dg * 3).toFixed(3));
      }
      if (t > .86 || host) stream.setAttribute("opacity", 0);
    }
    update(0);
    return { svg: svg, update: update };
  }


  /* ---------- Side view that tilts up to the top view ----------
     The cup is drawn from a camera at elevation angle `elev`: circles become ellipses squashed by sin(elev),
     and heights shrink by cos(elev). Animating elev from about 20° to 90° turns the side view into the top view
     without a cut. The liquid surface is the same top-down drawing, squashed onto the cup. */
  /* stainless milk pitcher: tapered body, pointed spout, center seam, square handle (drawn with the spout at 0,0) */
  var PITCHER =
    '<path d="M-114 20 L-150 20 Q-160 20 -160 30 L-160 74 Q-160 82 -153 86 L-121 104" fill="none" stroke="#5c646a" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M-114 20 L-150 20 Q-160 20 -160 30 L-160 74 Q-160 82 -153 86 L-121 104" fill="none" stroke="url(#STEELH)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M-112 6 L-18 3 L1 -5 Q-5 9 -11 22 L-3 98 Q-1 114 -14 121 L-110 121 Q-123 114 -121 98 Z" fill="url(#STEEL)" stroke="#4f565c" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<path d="M-11 22 Q-5 9 1 -5 L-18 3 Q-16 14 -11 22 Z" fill="#8f989e" opacity=".55"/>' +
    '<path d="M-64 9 L-57 9 L-55 120 L-66 120 Z" fill="#7d868d" opacity=".55"/>' +
    '<path d="M-104 16 L-82 15 L-86 106 Q-98 104 -110 96 Z" fill="#ffffff" opacity=".55"/>' +
    '<path d="M-44 13 L-30 12 L-24 102 Q-30 106 -38 107 Z" fill="#ffffff" opacity=".35"/>' +
    '<path d="M-121 98 Q-123 114 -110 121 L-14 121 Q-1 114 -3 98 Q-60 112 -121 98 Z" fill="#6f787f" opacity=".35"/>' +
    '<path d="M-112 6 Q-60 -4 1 -5 Q-58 9 -112 6 Z" fill="#e3e7ea" stroke="#4f565c" stroke-width="1.2" stroke-linejoin="round"/>';
  var KETTLE = '<path d="M-150 54 C-192 52 -192 120 -148 118" fill="none" stroke="#2f2a27" stroke-width="9" stroke-linecap="round"/>' +
    '<path d="M-58 104 C-32 100 -26 42 -14 18 C-10 10 -5 4 0 0" fill="none" stroke="#6b737a" stroke-width="8" stroke-linecap="round"/>' +
    '<path d="M-58 104 C-32 100 -26 42 -14 18 C-10 10 -5 4 0 0" fill="none" stroke="url(#STEEL)" stroke-width="5" stroke-linecap="round"/>' +
    '<path d="M-148 42 Q-154 122 -138 130 L-64 130 Q-48 122 -54 42 Q-101 30 -148 42 Z" fill="url(#STEEL)" stroke="#6b737a" stroke-width="1.2"/>' +
    '<ellipse cx="-101" cy="40" rx="48" ry="8" fill="#c9cfd4" stroke="#6b737a" stroke-width="1.2"/>' +
    '<circle cx="-101" cy="28" r="7" fill="#2f2a27"/>' +
    '<path d="M-132 54 L-136 118" stroke="#ffffff" stroke-opacity=".55" stroke-width="4" stroke-linecap="round"/>';

  function buildAngledDrink(spec) {
    var id = "ad" + (++uid);
    var svg = el("svg", { viewBox: "0 0 400 400", "aria-hidden": "true", focusable: "false" });
    var defs = el("defs", {}, svg);
    var steel = el("linearGradient", { id: id + "s", x1: "0", x2: "1", y1: "0", y2: "0" }, defs);
    [["0", "#7f888f"], [".18", "#c9cfd3"], [".34", "#f4f6f7"], [".55", "#dfe3e6"], [".8", "#aab2b8"], ["1", "#7a838a"]].forEach(function (st) {
      el("stop", { offset: st[0], "stop-color": st[1] }, steel);
    });
    var steelH = el("linearGradient", { id: id + "sH", x1: "0", x2: "0", y1: "0", y2: "1" }, defs);
    [["0", "#c3c9ce"], [".5", "#9aa2a8"], ["1", "#c3c9ce"]].forEach(function (st) {
      el("stop", { offset: st[0], "stop-color": st[1] }, steelH);
    });
    var glass = spec.type === "glass";
    var R = spec.cupR;
    var Rb = R * (glass ? .82 : spec.type === "demitasse" ? .62 : .64);
    var Hc = R * (glass ? 1.05 : spec.type === "demitasse" ? .74 : .8);
    var Rs = glass ? R + 26 : R + 38;
    var dep = Hc * .12;
    var ceramic = glass ? "#ece7df" : "#fbf8f2", edge = glass ? "#b8b0a3" : "#cfc3b0";

    var world = el("g", {}, svg);
    var saucer = el("ellipse", { cx: 0, fill: "#efe8dc", stroke: "#cfc3b0", "stroke-width": 2 }, world);
    var handleBack = null, handle = null;
    if (!glass) {
      handleBack = el("path", { fill: "none", stroke: edge, "stroke-width": R * .17, "stroke-linecap": "round" }, world);
      handle = el("path", { fill: "none", stroke: ceramic, "stroke-width": R * .17 - 5, "stroke-linecap": "round" }, world);
    }
    var body = el("path", { fill: glass ? "#7a4a2a" : ceramic, "fill-opacity": glass ? .9 : 1, stroke: edge, "stroke-width": 2 }, world);
    var bodyShine = el("path", { fill: "none", stroke: "#ffffff", "stroke-opacity": glass ? .45 : .7, "stroke-width": 4, "stroke-linecap": "round" }, world);
    var rim = el("ellipse", { cx: 0, cy: 0, rx: R, fill: ceramic, stroke: edge, "stroke-width": 2 }, world);
    var inner = el("ellipse", { cx: 0, cy: 0, rx: R - (glass ? 6 : 10), fill: "#e8dfd2" }, world);
    var clipEl = el("ellipse", { cx: 0, cy: 0, rx: R - (glass ? 6 : 10) }, el("clipPath", { id: id + "k" }, defs));
    var surfaceClip = el("g", { "clip-path": "url(#" + id + "k)" }, world);
    var surface = el("g", {}, surfaceClip);
    var top = buildTopDrink(spec, { svg: svg, defs: defs, group: surface });

    var stream = el("path", { fill: "none", "stroke-linecap": "round", opacity: 0 }, svg);
    var pourer = el("g", { opacity: 0 }, svg);
    var tool = spec.water ? KETTLE : PITCHER;
    pourer.innerHTML = tool.replace(/STEELH/g, id + "sH").replace(/STEEL/g, id + "s");
    var toolRot = spec.water ? 30 : 44;

    var cam = { cy: 250, sc: .72, c: 1 };
    function camera(tilt) {
      var e = easeInOut(clamp01(tilt));
      var elev = (20 + 70 * e) * Math.PI / 180;
      var k = Math.sin(elev), c = Math.max(0, Math.cos(elev));
      if (e >= 1) { k = 1; c = 0; }
      var sc = .72 + .28 * e, cy = 248 - 48 * e;
      cam = { cy: cy, sc: sc, c: c, k: k };
      world.setAttribute("transform", "translate(200 " + cy.toFixed(2) + ") scale(" + sc.toFixed(4) + ")");
      var by = Hc * c;
      saucer.setAttribute("cy", (by + 2 * c).toFixed(2));
      saucer.setAttribute("rx", Rs); saucer.setAttribute("ry", (Rs * k).toFixed(2));
      rim.setAttribute("ry", (R * k).toFixed(2));
      inner.setAttribute("ry", ((R - (glass ? 6 : 10)) * k).toFixed(2));
      clipEl.setAttribute("ry", ((R - (glass ? 6 : 10)) * k).toFixed(2));
      body.setAttribute("d", "M" + (-R) + " 0 Q" + (-R * .99).toFixed(1) + " " + (by * .95).toFixed(2) + " " + (-Rb).toFixed(1) + " " + by.toFixed(2) +
        " A" + Rb.toFixed(1) + " " + Math.max(.01, Rb * k).toFixed(2) + " 0 0 0 " + Rb.toFixed(1) + " " + by.toFixed(2) +
        " Q" + (R * .99).toFixed(1) + " " + (by * .95).toFixed(2) + " " + R + " 0 Z");
      bodyShine.setAttribute("d", "M" + (-R * .82).toFixed(1) + " " + (by * .25 + R * k * .5).toFixed(2) + " Q" + (-R * .8).toFixed(1) + " " + (by * .6 + R * k * .4).toFixed(2) + " " + (-R * .62).toFixed(1) + " " + (by * .82 + R * k * .3).toFixed(2));
      bodyShine.setAttribute("opacity", c.toFixed(3));
      if (handle) {
        var hx0 = R * .97, hx1 = R * 1.42, hx2 = Rb + R * .1;
        var d = "M" + hx0.toFixed(1) + " " + (Hc * .16 * c).toFixed(2) + " C" + hx1.toFixed(1) + " " + (Hc * .1 * c).toFixed(2) + " " + hx1.toFixed(1) + " " + (Hc * .66 * c).toFixed(2) + " " + hx2.toFixed(1) + " " + (Hc * .74 * c).toFixed(2);
        if (c < .02) d = "M" + hx0.toFixed(1) + " 0 L" + (R * 1.36).toFixed(1) + " 0";
        handleBack.setAttribute("d", d); handle.setAttribute("d", d);
      }
      surface.setAttribute("transform", "translate(0 " + (dep * c).toFixed(2) + ") scale(1 " + k.toFixed(4) + ") translate(-200 -200)");
    }
    /* where the middle of the coffee sits on screen */
    function surfacePoint() { return { x: 200, y: cam.cy + dep * cam.c * cam.sc }; }

    function update(T) {
      /* timeline: pourer comes in (.04-.2), pours (.2-.53), leaves (.53-.64), camera tilts up (.6-.84) */
      /* the shot pulls while the pourer comes in, then the milk (or water) pours */
      top.update(.34 * phase(T, .03, .19) + .66 * phase(T, .2, .62));
      camera(phase(T, .56, .92));
      var sp = surfacePoint();
      /* T at which brewing progress reaches t: t = .34 + .66 * (T - .2) / .42 */
      var tT = function (t) { return .2 + .42 * (t - .34) / .66; };
      var dragP = spec.art === "heart" ? easeInOut(phase(T, tT(ART.drag[0]), tT(ART.drag[1]))) : 0;
      var dragY = spec.art === "heart" ? 15 * dragP * 2.25 * spec.heart * cam.k * cam.sc : 0;
      var inA = easeOut(phase(T, .04, .2)), outA = easeIn(phase(T, .53, .64));
      var px = -40 + (sp.x - 12 - -40) * inA - 120 * outA;
      var py = 30 + (sp.y - (spec.water ? 100 : 94) - 30) * inA - 110 * outA + dragY * .8;
      var rot = toolRot * inA * (1 - outA);
      pourer.setAttribute("transform", "translate(" + px.toFixed(1) + " " + py.toFixed(1) + ") rotate(" + rot.toFixed(1) + ")");
      pourer.setAttribute("opacity", (Math.min(1, inA * 1.4) * (1 - outA)).toFixed(3));
      var flow = phase(T, .19, .23) * (1 - phase(T, .5, .54));
      if (flow > 0) {
        var ex = sp.x, ey = sp.y + dragY;
        stream.setAttribute("d", "M" + (px + 1).toFixed(1) + " " + (py - 2).toFixed(1) + " Q" + (px + 12).toFixed(1) + " " + ((py + ey) / 2).toFixed(1) + " " + ex.toFixed(1) + " " + ey.toFixed(1));
        stream.setAttribute("stroke", spec.water ? "#dfe7ea" : "#fbf6ec");
        stream.setAttribute("stroke-width", ((spec.water ? 2.5 : 6) * (.4 + .6 * flow) * (1 - .45 * dragP)).toFixed(2));
        stream.setAttribute("opacity", spec.water ? .85 : 1);
      } else {
        stream.setAttribute("opacity", 0);
      }
    }
    update(0);
    return { svg: svg, update: update, point: surfacePoint };
  }

  /* menu icons: the finished drink, from above */
  document.querySelectorAll("[data-icon]").forEach(function (slot) {
    var d = buildTopDrink(DRINKS[slot.getAttribute("data-icon")]);
    d.update(1);
    slot.appendChild(d.svg);
  });

  /* ---------- The glass you drink as you scroll (side view) ---------- */
  var GLASS = "M18 34 L82 34 L77 94 Q76 100 70 100 L30 100 Q24 100 23 94 Z";
  var TOP = 36, BOTTOM = 99, H = BOTTOM - TOP;

  function buildGlass() {
    var id = "glass-clip-" + (++uid);
    var svg = el("svg", { viewBox: "0 0 100 112", "aria-hidden": "true", focusable: "false" });
    var defs = el("defs", {}, svg);
    el("path", { d: GLASS }, el("clipPath", { id: id }, defs));
    var steam = el("g", { class: "steam" }, svg);
    el("path", { d: "M38 26 q-4 -6 0 -11 q4 -5 0 -11" }, steam);
    el("path", { d: "M50 24 q-4 -6 0 -11 q4 -5 0 -11" }, steam);
    el("path", { d: "M62 26 q-4 -6 0 -11 q4 -5 0 -11" }, steam);
    el("ellipse", { class: "saucer", cx: 50, cy: 103, rx: 44, ry: 6 }, svg);
    var g = el("g", { "clip-path": "url(#" + id + ")" }, svg);
    var esp = el("rect", { class: "layer-espresso", x: 0, width: 100, y: BOTTOM, height: 0 }, g);
    var milk = el("rect", { class: "layer-milk", x: 0, width: 100, y: BOTTOM, height: 0 }, g);
    var foam = el("rect", { class: "layer-foam", x: 0, width: 100, y: BOTTOM, height: 0 }, g);
    el("rect", { class: "drip", x: 48.5, y: -6, width: 3, height: 100, rx: 1.5 }, g);
    el("path", { class: "glass-outline", d: GLASS }, svg);
    el("line", { class: "glass-outline", x1: 26, y1: 42, x2: 28, y2: 84, "stroke-width": 1.4, opacity: .5 }, svg);
    return { svg: svg, esp: esp, milk: milk, foam: foam };
  }

  var glasses = [];
  document.querySelectorAll("[data-cup]").forEach(function (btn) {
    var parts = buildGlass();
    btn.insertBefore(parts.svg, btn.firstChild);
    parts.btn = btn;
    glasses.push(parts);
  });
  var statusEls = document.querySelectorAll("[data-cup-status]");
  var pctEls = document.querySelectorAll("[data-cup-pct]");
  var recipe = DRINKS.about.glass;

  function setRecipe(key) {
    recipe = (DRINKS[key] || DRINKS.connect).glass;
    var d = DRINKS[key] ? DRINKS[key].drink : "coffee";
    glasses.forEach(function (gl) {
      gl.btn.setAttribute("aria-label", "Your " + d + ". Tap for a coffee fact or a fact about Fernando.");
    });
  }

  /* drink from the top down: foam goes first, then milk, then espresso */
  function setRemaining(r) {
    var total = recipe[0] + recipe[1] + recipe[2];
    var left = r * total;
    var e = Math.min(left, recipe[0]);
    var m = Math.min(Math.max(left - recipe[0], 0), recipe[1]);
    var f = Math.min(Math.max(left - recipe[0] - recipe[1], 0), recipe[2]);
    e *= H; m *= H; f *= H;
    glasses.forEach(function (gl) {
      gl.esp.setAttribute("y", BOTTOM - e); gl.esp.setAttribute("height", e > 0 ? e + 1 : 0);
      gl.milk.setAttribute("y", BOTTOM - e - m); gl.milk.setAttribute("height", m > 0 ? m + .5 : 0);
      gl.foam.setAttribute("y", BOTTOM - e - m - f); gl.foam.setAttribute("height", f > 0 ? f + .5 : 0);
      gl.btn.classList.toggle("full", r > .97);
    });
    var pct = Math.round(r * 100);
    var msg = r > .97 ? "Fresh and hot. Scroll to sip."
      : r > .6 ? "Still nice and warm"
      : r > .3 ? "Halfway through"
      : r > .01 ? "Last few sips"
      : document.querySelector("[data-another]") ? "All gone! Order another below." : "All gone! Change order for another.";
    statusEls.forEach(function (s) { s.textContent = msg; });
    pctEls.forEach(function (s) { s.textContent = pct + "% left"; });
  }
  function progress() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    return max <= 4 ? 1 : clamp01(window.scrollY / max);
  }
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { setRemaining(1 - progress()); ticking = false; });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  if (document.body.getAttribute("data-drink")) setRecipe(document.body.getAttribute("data-drink"));
  setRemaining(1 - progress());

  /* tap the glass for a fact */
  var FACTS = [
    ["Coffee fact", "Espresso is brewed by pushing hot water through finely ground coffee at about 9 bars of pressure."],
    ["About Fernando", "Fernando has been a barista at BSEISU Coffee since September 2025."],
    ["Coffee fact", "A cortado is roughly equal parts espresso and steamed milk. The name comes from the Spanish cortar, to cut."],
    ["About Fernando", "Fernando's first-year water tank alarm was heard outside the room by 10 of 10 bystanders."],
    ["Coffee fact", "Coffee beans are the seeds of a cherry-like fruit."],
    ["About Fernando", "Fernando founded mentorSHPE, which grew from 4 mentor pairs to 17 across Duke's SHPE chapter."],
    ["Coffee fact", "Macchiato means “marked” or “stained” in Italian: a shot of espresso marked with a little foam."],
    ["About Fernando", "As a camp TA, Fernando kept 14 Ultimaker 3D printers running for 28 students."]
  ];
  var factIndex = Math.floor(Math.random() * FACTS.length);
  var popTimer;
  function closePops() { document.querySelectorAll(".ticket-pop").forEach(function (n) { n.remove(); }); }
  glasses.forEach(function (gl) {
    gl.btn.addEventListener("click", function () {
      var btn = gl.btn;
      btn.classList.remove("pulling");
      void btn.getBoundingClientRect();
      btn.classList.add("pulling");
      setTimeout(function () { btn.classList.remove("pulling"); }, 2600);

      var fact = FACTS[factIndex % FACTS.length];
      factIndex++;
      closePops();
      var pop = document.createElement("div");
      pop.className = "ticket-pop";
      pop.setAttribute("role", "status");
      var x = document.createElement("button");
      x.type = "button";
      x.className = "pop-close";
      x.setAttribute("aria-label", "Close");
      x.textContent = "×";
      x.addEventListener("click", function () { pop.remove(); });
      var lab = document.createElement("span");
      lab.className = "label";
      lab.textContent = "Order up · " + fact[0];
      pop.appendChild(x);
      pop.appendChild(lab);
      pop.appendChild(document.createTextNode(fact[1]));
      document.body.appendChild(pop);
      clearTimeout(popTimer);
      popTimer = setTimeout(function () { pop.remove(); }, 4500);
    });
  });

  /* ---------- Views: the menu and each order ---------- */
  var menuView = document.getElementById("view-menu");
  var orderView = document.getElementById("view-order");
  var brew = document.getElementById("brew");
  var brewing = false;

  function anotherItem(key) {
    var d = DRINKS[key];
    var li = document.createElement("li");
    var a = document.createElement("a");
    a.href = "#" + key;
    a.setAttribute("data-order", key);
    var icon = document.createElement("span");
    icon.className = "drink-icon";
    var td = buildTopDrink(d); td.update(1); icon.appendChild(td.svg);
    var txt = document.createElement("span");
    var b = document.createElement("b"); b.textContent = d.drink.charAt(0).toUpperCase() + d.drink.slice(1);
    var sm = document.createElement("small"); sm.textContent = d.section;
    txt.appendChild(b); txt.appendChild(sm);
    a.appendChild(icon); a.appendChild(txt);
    li.appendChild(a);
    return li;
  }

  function showMenu() {
    if (!menuView) return;
    orderView.hidden = true;
    menuView.hidden = false;
    document.title = "Fernando Quijada";
    closePops();
    window.scrollTo(0, 0);
  }

  function showOrder(key) {
    var all = key === "all";
    var d = DRINKS[key];
    menuView.hidden = true;
    orderView.hidden = false;
    orderView.classList.toggle("single", !all);
    orderView.querySelectorAll("[data-pane]").forEach(function (p) {
      p.hidden = !all && p.getAttribute("data-pane") !== key;
    });
    var title = orderView.querySelector("[data-ready-title]");
    var label = orderView.querySelector("[data-ready-label]");
    var sub = orderView.querySelector("[data-ready-sub]");
    title.textContent = "";
    if (all) {
      label.textContent = "Just browsing";
      title.appendChild(document.createTextNode("Here's the "));
      var em0 = document.createElement("em"); em0.textContent = "whole menu."; title.appendChild(em0);
      sub.textContent = "About · Projects · Experience · Interests · Let's connect";
    } else {
      label.textContent = "Order up";
      title.appendChild(document.createTextNode("Your "));
      var em = document.createElement("em"); em.textContent = d.drink; title.appendChild(em);
      title.appendChild(document.createTextNode(" is ready!"));
      sub.textContent = d.section;
    }
    document.title = (all ? "Everything" : d.section) + " · Fernando Quijada";
    var list = orderView.querySelector("[data-another]");
    var anotherTitle = orderView.querySelector("[data-another-title]");
    list.textContent = "";
    var others = ORDER.filter(function (k) { return k !== key; });
    others.forEach(function (k) { list.appendChild(anotherItem(k)); });
    anotherTitle.textContent = all ? "Want just one section?" : "Finished your " + d.drink + "?";
    setRecipe(all ? "connect" : key);
    closePops();
    window.scrollTo(0, 0);
    setRemaining(1 - progress());
    var main = document.getElementById("order-main");
    if (main) main.focus({ preventScroll: true });
  }

  function route() {
    var key = location.hash.replace("#", "");
    if (DRINKS[key] || key === "all") showOrder(key);
    else showMenu();
  }

  /* ---------- Brewing ---------- */
  function finishBrew(key, alreadyShown) {
    if (!alreadyShown) { if (location.hash !== "#" + key) location.hash = key; else route(); }
    brew.hidden = true;
    brew.style.opacity = "";
    root.classList.remove("brewing");
    brewing = false;
  }

  function order(key) {
    if (brewing || !brew) { location.hash = key; return; }
    brewing = true;
    var d = DRINKS[key];
    var toast = document.getElementById("brew-toast");
    var stage = document.getElementById("brew-stage");
    toast.textContent = "";
    toast.appendChild(document.createTextNode("One "));
    var b = document.createElement("b"); b.textContent = d.drink; toast.appendChild(b);
    toast.appendChild(document.createTextNode(", coming right up!"));
    toast.style.opacity = "";
    var track = document.getElementById("brew-track");
    var milkLbl = track && track.querySelector("[data-milk-step]");
    if (milkLbl) milkLbl.textContent = d.water ? "Pouring hot water" : "Steaming milk";
    function setTrack(T, MS) {
      if (!track) return;
      /* MS = the T at which each step starts; the bar fills evenly from one dot to the next */
      var i = 0; while (i < 3 && T >= MS[i + 1]) i++;
      var fill = i >= 3 ? 1 : (i + phase(T, MS[i], MS[i + 1])) / 3;
      track.style.setProperty("--fill", fill.toFixed(4));
      track.querySelectorAll("li").forEach(function (li, j) {
        li.classList.toggle("done", j < i || i === 3);
        li.classList.toggle("now", j === i);
        if (j === i) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
      });
    }
    if (track) track.style.opacity = "";
    stage.textContent = "";
    stage.style.transform = "";
    var side = BREW_STYLE === "side";
    var drink = side ? buildAngledDrink(d) : buildTopDrink(d);
    stage.appendChild(drink.svg);
    stage.style.transformOrigin = side ? "0 0" : "";
    brew.hidden = false;
    root.classList.add("brewing");
    closePops();

    var skipped = false, revealed = false;
    var skip = document.getElementById("brew-skip");
    skip.style.opacity = "";
    skip.onclick = function () { skipped = true; finishBrew(key, revealed); };

    if (reduceMotion) {
      drink.update(1);
      setTrack(1, [0, 0, 0, 0]);
      setTimeout(function () { if (!skipped) finishBrew(key); }, 900);
      return;
    }

    /* top view: brewing runs over the first 76% of the timeline, then the zoom into the art.
       side view: the zoom starts while the camera is still tilting up (tilt .56-.92, zoom .62-1),
       so the two read as one move. The zoom keeps the coffee's center sliding to the middle of the screen. */
    var DUR = side ? 5400 : 3300, t0 = null;
    var Z0 = side ? .62 : .8, FADE = side ? [.68, .78] : [.74, .82], SHOW = side ? .9 : .86, OUT = side ? .9 : .88;
    /* order tracker: when each step starts, matched to what's on screen.
       side: shot pulls .03-.19, milk pours .19-.54, art settles by ~.58. top: shot 0-.26, milk .23-.6, art done ~.68 */
    var MS = side ? [0, .03, .19, .58] : [0, .02, .23, .68];
    setTrack(0, MS);
    /* side view: after the pour, the clock speeds up smoothly (1x to 1.8x between T .6 and .72),
       so the tilt and zoom into the art take less time without a visible change of pace */
    var T = 0, last = null;
    function rate(x) { return side ? 1 + .8 * easeInOut(phase(x, .6, .72)) : 1; }
    function frame(now) {
      if (skipped) return;
      if (t0 === null) { t0 = now; last = now; }
      T = clamp01(T + Math.min(now - last, 100) / DUR * rate(T));
      last = now;
      var z = easeIn(phase(T, Z0, 1));
      var sc = 1 + z * 15;
      if (side) {
        drink.update(T);
        var f = stage.clientWidth / 400, sp = drink.point();
        var a = easeInOut(phase(T, Z0, .95));
        var tx = (sp.x + (200 - sp.x) * a) * f - sp.x * f * sc;
        var ty = (sp.y + (200 - sp.y) * a) * f - sp.y * f * sc;
        stage.style.transform = "translate(" + tx.toFixed(2) + "px, " + ty.toFixed(2) + "px) scale(" + sc.toFixed(4) + ")";
      } else {
        drink.update(clamp01(T / .76));
        stage.style.transform = "scale(" + sc.toFixed(3) + ")";
      }
      setTrack(T, MS);
      toast.style.opacity = (1 - phase(T, FADE[0], FADE[1])).toFixed(3);
      skip.style.opacity = toast.style.opacity;
      if (track) track.style.opacity = toast.style.opacity;
      if (T > SHOW && !revealed) {
        revealed = true;
        if (location.hash !== "#" + key) location.hash = key; else route();
      }
      brew.style.opacity = (1 - easeInOut(phase(T, OUT, 1))).toFixed(3);
      if (T < 1) requestAnimationFrame(frame);
      else { skip.style.opacity = ""; finishBrew(key, revealed); }
    }
    requestAnimationFrame(frame);
  }

  if (menuView && orderView) {
    document.addEventListener("click", function (e) {
      var a = e.target.closest("[data-order]");
      if (!a) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
      e.preventDefault();
      order(a.getAttribute("data-order"));
    });
    window.addEventListener("hashchange", route);
    route();
  }

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    closePops();
    if (brewing) { var s = document.getElementById("brew-skip"); if (s) s.click(); }
  });

  /* ---------- Copy email ---------- */
  document.querySelectorAll("[data-copy]").forEach(function (b) {
    b.addEventListener("click", function () {
      var text = b.getAttribute("data-copy");
      var msg = document.querySelector(b.getAttribute("data-copy-msg"));
      function done(ok) { if (msg) msg.textContent = ok ? "Copied to your clipboard." : "Select the address above to copy it."; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      } else { done(false); }
    });
  });

  /* ---------- Image lightbox (case studies) ---------- */
  var lb = document.querySelector("dialog.lb");
  if (lb && typeof lb.showModal === "function") {
    var lbImg = lb.querySelector("img"), lbCap = lb.querySelector("p");
    document.querySelectorAll(".shot img").forEach(function (img) {
      img.tabIndex = 0;
      function open() {
        lbImg.src = img.currentSrc || img.src;
        lbImg.alt = img.alt;
        var cap = img.closest("figure") && img.closest("figure").querySelector("figcaption");
        lbCap.textContent = cap ? cap.textContent : img.alt;
        lb.showModal();
      }
      img.addEventListener("click", open);
      img.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });
    lb.addEventListener("click", function (e) { if (e.target === lb || e.target.tagName === "BUTTON") lb.close(); });
  }
})();
