/* =====================================================================
 * CASINO DORADO · ART & ENVIRONMENT KIT  (src/art.js)
 * ---------------------------------------------------------------------
 * Plain browser script for Three.js r128 (global THREE). No imports, no
 * external models or textures: everything is built from primitives and
 * canvas textures, in a clean stylized low-poly look.
 *
 * Conventions (every factory):
 *   - returns a THREE.Group whose origin sits on the floor (y = 0) at the
 *     object's footprint centre, with local +Z as the FRONT (the side the
 *     player / customer faces). makeChandelier is the exception: its
 *     origin is the ceiling hook and it hangs down (-Y).
 *   - animated objects expose `group.api` (also `group.userData.api`)
 *     with methods such as update(dt). Call api.update(dt) once per frame.
 *   - static parts are merged per material (few draw calls) and the merged
 *     geometry is cached, so ten slot machines share one geometry set.
 *   - materials/geometries are cached in CasinoArt.cache; never dispose
 *     them per instance.
 *
 * Performance: no shadow maps. Every grounded prop gets a soft "contact
 * shadow" blob (one transparent quad, shared texture). Pass {blob:false}
 * to skip it. Approximate triangle counts are listed per factory.
 *
 * Palette: night #07140f, felt #0f2b22, brass #d9a84a, ivory #f3e9d2,
 * chip red #d4423f.
 * ===================================================================== */
(function () {
  'use strict';
  var T = window.THREE;
  if (!T) { console.error('[CasinoArt] THREE not loaded'); return; }
  var PI = Math.PI, TAU = PI * 2;

  var PAL = {
    night: 0x07140f, felt: 0x0f2b22, felt2: 0x16402f, brass: 0xd9a84a, ivory: 0xf3e9d2,
    red: 0xd4423f, burgundy: 0x5a1220, wood: 0x4a2a17, woodDark: 0x2a170d, black: 0x15171a,
    marble: 0xe8e1d3, chrome: 0xc9ced4,
  };

  // ------------------------------------------------------------------
  // caches
  // ------------------------------------------------------------------
  var _mats = new Map(), _geos = new Map(), _texs = new Map();
  function cache(map, key, make) { var v = map.get(key); if (v === undefined) { v = make(); map.set(key, v); } return v; }

  /** Cached MeshStandardMaterial by colour + options. */
  function std(color, rough, metal, emissive, extraKey) {
    rough = rough == null ? 0.6 : rough; metal = metal || 0; emissive = emissive || 0;
    return cache(_mats, 'std|' + color + '|' + rough + '|' + metal + '|' + emissive + '|' + (extraKey || ''), function () {
      return new T.MeshStandardMaterial({ color: color, roughness: rough, metalness: metal, emissive: emissive });
    });
  }
  /** Cached unlit material (lamps, screens, neon). */
  function basic(color) { return cache(_mats, 'basic|' + color, function () { return new T.MeshBasicMaterial({ color: color }); }); }

  /** Madera con veta suave (textura gris que multiplica el color). */
  function woodMat(color, rough) {
    return cache(_mats, 'wood|' + color + '|' + rough, function () {
      var tx = cachedTex('grain', 256, 256, function (g, w, h) {
        g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, w, h);
        for (var i = 0; i < 70; i++) {
          var y = Math.random() * h, a = 0.04 + Math.random() * 0.1;
          g.strokeStyle = 'rgba(0,0,0,' + a + ')'; g.lineWidth = 1 + Math.random() * 2.5; g.beginPath(); g.moveTo(0, y);
          for (var x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.03 + i) * 3 + Math.sin(x * 0.011 + i * 2) * 5);
          g.stroke();
        }
        noise(g, w, h, 0, 1200, 'rgba(255,255,255,0.05)');
      }, { repeat: [1, 1] });
      return new T.MeshStandardMaterial({ color: color, map: tx, roughness: rough, metalness: 0 });
    });
  }
  var MAT = {
    get brass() { return std(PAL.brass, 0.32, 0.45, 0x3a2408); },
    get brassDark() { return std(0x9a7430, 0.4, 0.4, 0x1a1004); },
    get chrome() { return std(PAL.chrome, 0.25, 0.5, 0x15181c); },
    get dark() { return std(PAL.black, 0.45, 0.1); },
    get black() { return std(0x0b0c0e, 0.35, 0.1); },
    get wood() { return woodMat(PAL.wood, 0.55); },
    get woodDark() { return woodMat(PAL.woodDark, 0.42); },
    get ivory() { return std(PAL.ivory, 0.55, 0); },
    get marble() { return std(PAL.marble, 0.3, 0); },
    get leatherRed() { return std(0x8e1f26, 0.5, 0); },
    get velvet() { return std(0x8a1022, 0.85, 0, 0x1a0206); },
    get feltGreen() { return std(PAL.felt2, 0.95, 0); },
    get padding() { return std(0x2a1410, 0.5, 0); },
    get bulbOn() { return basic(0xfff1c4); },
    get bulbWarm() { return basic(0xffd27a); },
    get bulbDim() { return basic(0x6a4a24); },
  };

  // ------------------------------------------------------------------
  // geometry helpers
  // ------------------------------------------------------------------
  /** Rounded (bevelled) box centred at origin. Cached by size. ~40-80 tris. */
  function rbox(w, h, d, r, seg) {
    r = r == null ? 0.03 : r; seg = seg || 1;
    return cache(_geos, 'rb|' + w + '|' + h + '|' + d + '|' + r + '|' + seg, function () {
      r = Math.max(0.001, Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002));
      var iw = w / 2 - r, ih = h / 2 - r, e = 0.0005;
      var s = new T.Shape();
      s.moveTo(-iw, -ih); s.lineTo(iw, -ih); s.lineTo(iw, ih); s.lineTo(-iw, ih); s.lineTo(-iw, -ih);
      var g = new T.ExtrudeGeometry(s, { depth: Math.max(e, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: seg, curveSegments: 1 });
      g.translate(0, 0, -Math.max(e, d - 2 * r) / 2);
      return g;
    });
  }
  function boxG(w, h, d) { return cache(_geos, 'box|' + w + '|' + h + '|' + d, function () { return new T.BoxGeometry(w, h, d); }); }
  function cylG(rt, rb, h, seg, open, ts, tl) {
    seg = seg || 12;
    return cache(_geos, 'cyl|' + [rt, rb, h, seg, !!open, ts || 0, tl || TAU].join('|'), function () {
      return new T.CylinderGeometry(rt, rb, h, seg, 1, !!open, ts || 0, tl || TAU);
    });
  }
  function sphG(r, ws, hs) { ws = ws || 8; hs = hs || 6; return cache(_geos, 'sph|' + r + '|' + ws + '|' + hs, function () { return new T.SphereGeometry(r, ws, hs); }); }
  function torG(R, r, rs, ts, arc) { return cache(_geos, 'tor|' + [R, r, rs, ts, arc || TAU].join('|'), function () { return new T.TorusGeometry(R, r, rs, ts, arc || TAU); }); }
  function icoG(r) { return cache(_geos, 'ico|' + r, function () { return new T.IcosahedronGeometry(r, 0); }); }
  /** Ficha de casino: los costados leen la franja de arriba de la textura (rayas), las tapas el dibujo redondo. */
  function chipG(r, h) {
    return cache(_geos, 'chip|' + r + '|' + h, function () {
      var g = new T.CylinderGeometry(r, r, h, 12, 1), n = g.attributes.normal, uv = g.attributes.uv;
      for (var i = 0; i < n.count; i++) if (Math.abs(n.getY(i)) < 0.5) uv.setY(i, 0.985);
      return g;
    });
  }
  function chipMat(color) {
    return cache(_mats, 'chipm|' + color, function () {
      var light = new T.Color(color).getHSL({}).l > 0.6, ink = light ? '#2a6fd6' : '#f6f0e0';
      var tx = cachedTex('chip|' + color, 128, 128, function (g, w, h) {
        g.fillStyle = hex(color); g.fillRect(0, 0, w, h);
        for (var i = 0; i < 8; i++) { g.fillStyle = ink; g.fillRect(i * 16 + 4, 0, 8, 4); }                     // rayas del canto
        g.save(); g.translate(64, 64);
        for (var k = 0; k < 8; k++) { g.rotate(PI / 4); g.fillStyle = ink; g.fillRect(-6, -63, 12, 14); }     // insertos del borde
        g.strokeStyle = ink; g.lineWidth = 3; g.setLineDash([6, 5]); g.beginPath(); g.arc(0, 0, 40, 0, TAU); g.stroke(); g.setLineDash([]);
        g.fillStyle = shade(color, light ? -0.1 : 0.18); g.beginPath(); g.arc(0, 0, 30, 0, TAU); g.fill();
        g.fillStyle = ink; g.font = 'bold 26px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', 0, 2);
        g.restore();
      });
      return new T.MeshStandardMaterial({ map: tx, roughness: 0.45, metalness: 0 });
    });
  }
  function planeG(w, h) { return cache(_geos, 'pl|' + w + '|' + h, function () { return new T.PlaneGeometry(w, h); }); }

  var _v = new T.Vector3(), _q = new T.Quaternion(), _e = new T.Euler(), _s = new T.Vector3();
  function mtx(x, y, z, rx, ry, rz, sx, sy, sz) {
    _e.set(rx || 0, ry || 0, rz || 0);
    _q.setFromEuler(_e);
    _v.set(x || 0, y || 0, z || 0);
    _s.set(sx == null ? 1 : sx, sy == null ? (sx == null ? 1 : sx) : sy, sz == null ? (sx == null ? 1 : sx) : sz);
    return new T.Matrix4().compose(_v, _q, _s);
  }

  /** Merge geometries (each with a Matrix4 and optional colour) into one non-indexed BufferGeometry. */
  function mergeGeos(list, withColor) {
    var total = 0, parts = [];
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      var g = it.geo.index ? it.geo.toNonIndexed() : it.geo.clone();
      g.applyMatrix4(it.m);
      parts.push({ g: g, c: it.color, uv: it.uv });
      total += g.attributes.position.count;
    }
    var pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
    var col = withColor ? new Float32Array(total * 3) : null, o = 0, tmpC = new T.Color();
    for (var j = 0; j < parts.length; j++) {
      var p = parts[j].g, n = p.attributes.position.count;
      pos.set(p.attributes.position.array, o * 3);
      if (p.attributes.normal) nor.set(p.attributes.normal.array, o * 3);
      if (parts[j].uv) { for (var q = 0; q < n; q++) { uv[(o + q) * 2] = parts[j].uv[0]; uv[(o + q) * 2 + 1] = parts[j].uv[1]; } }
      else if (p.attributes.uv) uv.set(p.attributes.uv.array, o * 2);
      if (col) {
        tmpC.set(parts[j].c == null ? 0xffffff : parts[j].c);
        for (var k = 0; k < n; k++) { col[(o + k) * 3] = tmpC.r; col[(o + k) * 3 + 1] = tmpC.g; col[(o + k) * 3 + 2] = tmpC.b; }
      }
      o += n; p.dispose();
    }
    var out = new T.BufferGeometry();
    out.setAttribute('position', new T.BufferAttribute(pos, 3));
    out.setAttribute('normal', new T.BufferAttribute(nor, 3));
    out.setAttribute('uv', new T.BufferAttribute(uv, 2));
    if (col) out.setAttribute('color', new T.BufferAttribute(col, 3));
    out.computeBoundingSphere(); out.computeBoundingBox();
    return out;
  }

  /** Kit: collect parts per material (or per string slot like 'BODY'), then merge. */
  function Kit() { this.by = new Map(); }
  Kit.prototype.add = function (geo, mat, x, y, z, rx, ry, rz, sx, sy, sz) {
    return this.addM(geo, mat, mtx(x, y, z, rx, ry, rz, sx, sy, sz));
  };
  Kit.prototype.addM = function (geo, mat, m) {
    var a = this.by.get(mat); if (!a) { a = []; this.by.set(mat, a); }
    a.push({ geo: geo, m: m }); return this;
  };
  Kit.prototype.parts = function () {
    var out = [];
    this.by.forEach(function (list, mat) { out.push({ mat: mat, geo: mergeGeos(list) }); });
    return out;
  };
  /** Build once per key, reuse merged geometry forever. */
  function cachedParts(key, build) { return cache(_geos, 'parts|' + key, function () { var k = new Kit(); build(k); return k.parts(); }); }
  /** Instantiate cached parts into a group. `slots` maps string material keys to materials. Returns {key: mesh}. */
  function inst(parts, group, slots) {
    var meshes = {};
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i], mat = typeof p.mat === 'string' ? slots[p.mat] : p.mat;
      var mesh = new T.Mesh(p.geo, mat);
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      group.add(mesh);
      if (typeof p.mat === 'string') meshes[p.mat] = mesh;
    }
    return meshes;
  }

  // ------------------------------------------------------------------
  // canvas textures
  // ------------------------------------------------------------------
  function canvasTex(w, h, draw, opts) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d'); draw(g, w, h);
    var t = new T.CanvasTexture(c); t.anisotropy = 4;
    if (opts && opts.repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(opts.repeat[0], opts.repeat[1]); }
    t.userData = { canvas: c, ctx: g };
    return t;
  }
  function cachedTex(key, w, h, draw, opts) { return cache(_texs, key, function () { return canvasTex(w, h, draw, opts); }); }
  function hex(n) { return '#' + ('000000' + (n >>> 0).toString(16)).slice(-6); }
  function shade(n, f) { var c = new T.Color(n); if (f > 0) c.lerp(new T.Color(0xffffff), f); else c.multiplyScalar(1 + f); return '#' + c.getHexString(); }
  function noise(g, w, h, a, n, col) { g.fillStyle = col || 'rgba(0,0,0,' + a + ')'; for (var i = 0; i < n; i++) g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); }

  // contact shadow blob ------------------------------------------------
  function blobMat() {
    return cache(_mats, 'blob', function () {
      var t = canvasTex(64, 64, function (g, w, h) {
        var gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
        gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
      });
      return new T.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -2 });
    });
  }
  /** Adds a soft contact shadow quad of size w x d under a group. 2 tris. */
  function addBlob(group, w, d, opts) {
    if (opts && opts.blob === false) return null;
    var m = new T.Mesh(planeG(1, 1), blobMat());
    m.rotation.x = -PI / 2; m.position.y = 0.012; m.scale.set(w, d, 1); m.renderOrder = -1;
    group.add(m); return m;
  }

  function finish(group, api, name) {
    group.name = name; if (api) { api.group = group; group.api = api; group.userData.api = api; }
    return group;
  }

  // ==================================================================
  // CARPET + WALL MATERIALS
  // ==================================================================
  /**
   * makeCarpetTexture(opts) -> THREE.CanvasTexture (RepeatWrapping)
   * opts: { repeat:[x,y] = [22,10], base, line, accent }   1 tile = 2x2 m at default.
   */
  function makeCarpetTexture(opts) {
    opts = opts || {};
    var base = opts.base || '#4a0f1a', line = opts.line || '#b8873a', accent = opts.accent || '#1d5a4f';
    var t = canvasTex(512, 512, function (g, w, h) {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      // subtle pile noise
      noise(g, w, h, 0, 2600, 'rgba(0,0,0,0.12)'); noise(g, w, h, 0, 1400, 'rgba(255,200,170,0.05)');
      // diamond lattice
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 10;
      function lattice() { for (var i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 256, 0); g.lineTo(i * 256 + 512, 512); g.stroke(); g.beginPath(); g.moveTo(i * 256 + 512, 0); g.lineTo(i * 256, 512); g.stroke(); } }
      lattice(); g.strokeStyle = line; g.globalAlpha = 0.7; g.lineWidth = 3; lattice(); g.globalAlpha = 1;
      // medallions at lattice centres
      function medallion(x, y, s) {
        g.save(); g.translate(x, y);
        g.fillStyle = accent; g.beginPath(); g.arc(0, 0, 46 * s, 0, TAU); g.fill();
        g.strokeStyle = line; g.lineWidth = 3; g.stroke();
        g.fillStyle = line;
        for (var k = 0; k < 8; k++) { g.rotate(PI / 4); g.beginPath(); g.ellipse(0, -26 * s, 7 * s, 15 * s, 0, 0, TAU); g.fill(); }
        g.fillStyle = base; g.beginPath(); g.arc(0, 0, 12 * s, 0, TAU); g.fill();
        g.fillStyle = line; g.beginPath(); g.arc(0, 0, 5 * s, 0, TAU); g.fill();
        g.restore();
      }
      [[0, 0], [512, 0], [0, 512], [512, 512], [256, 256]].forEach(function (p) { medallion(p[0], p[1], 0.72); });
      // small stars between
      g.fillStyle = '#e7c27a';
      [[256, 0], [0, 256], [512, 256], [256, 512], [128, 128], [384, 128], [128, 384], [384, 384]].forEach(function (p) {
        g.save(); g.translate(p[0], p[1]); g.rotate(PI / 4);
        g.beginPath(); for (var i = 0; i < 8; i++) { var r = i % 2 ? 4 : 13, a = i * PI / 4; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill();
        g.restore();
      });
    }, { repeat: opts.repeat || [22, 10] });
    return t;
  }

  /**
   * makeWallMaterials(opts) -> { wall, wainscot, trim, ceiling, marble, exterior, floorWood }
   * MeshStandardMaterials with canvas maps (RepeatWrapping). Set repeat per use:
   *   mats.wall.map.repeat.set(lengthMeters / 2, 1)
   * opts: { wallColor:'#3b1f1a' }
   */
  function makeWallMaterials(opts) {
    opts = opts || {};
    var wc = opts.wallColor || '#3b1f1a';
    var wallTex = canvasTex(256, 512, function (g, w, h) {
      // damask wallpaper, one tile = 2 m wide x 3.5 m high (repeat x = len/2)
      var gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, shade(0x3b1f1a, -0.25)); gr.addColorStop(0.5, wc); gr.addColorStop(1, shade(0x3b1f1a, 0.05));
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(217,168,74,0.13)';
      for (var row = 0; row < 4; row++) for (var col = 0; col < 2; col++) {
        var x = col * 128 + (row % 2 ? 64 : 0), y = 70 + row * 110;
        g.save(); g.translate(x, y);
        g.beginPath(); g.ellipse(0, 0, 22, 36, 0, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(0, -52); g.quadraticCurveTo(26, -20, 0, 52); g.quadraticCurveTo(-26, -20, 0, -52); g.fill();
        for (var s = -1; s <= 1; s += 2) { g.beginPath(); g.ellipse(s * 30, 8, 8, 18, s * 0.6, 0, TAU); g.fill(); }
        g.restore();
      }
      g.fillStyle = 'rgba(0,0,0,0.25)'; for (var i = 0; i < w; i += 64) g.fillRect(i, 0, 1, h);
    }, { repeat: [1, 1] });
    var wainTex = canvasTex(256, 128, function (g, w, h) {
      g.fillStyle = '#24150e'; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 2; i++) {
        var x = i * 128;
        g.fillStyle = '#1a0e08'; g.fillRect(x + 12, 14, 104, 100);
        g.strokeStyle = '#3a2416'; g.lineWidth = 3; g.strokeRect(x + 16, 18, 96, 92);
        g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2; g.strokeRect(x + 12, 14, 104, 100);
      }
      g.fillStyle = '#b88a3c'; g.fillRect(0, 0, w, 5);
      noise(g, w, h, 0, 500, 'rgba(255,220,180,0.04)');
    }, { repeat: [1, 1] });
    var ceilTex = canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = '#16100c'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#0e0a08'; g.fillRect(16, 16, w - 32, h - 32);
      g.strokeStyle = '#4a3418'; g.lineWidth = 4; g.strokeRect(22, 22, w - 44, h - 44);
      g.strokeStyle = 'rgba(217,168,74,0.35)'; g.lineWidth = 2; g.strokeRect(34, 34, w - 68, h - 68);
    }, { repeat: [11, 5] });
    var marbleTex = canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = '#ebe4d6'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(120,100,80,0.25)'; g.lineWidth = 1.5;
      for (var i = 0; i < 9; i++) { g.beginPath(); var x = Math.random() * w, y = 0; g.moveTo(x, y); while (y < h) { x += (Math.random() - 0.5) * 40; y += 20 + Math.random() * 20; g.lineTo(x, y); } g.stroke(); }
      g.strokeStyle = 'rgba(0,0,0,0.12)'; g.strokeRect(0, 0, w, h);
    }, { repeat: [1, 1] });
    var extTex = canvasTex(256, 256, function (g, w, h) {
      // cream stucco with stone block lines
      g.fillStyle = '#d8c7a4'; g.fillRect(0, 0, w, h);
      noise(g, w, h, 0, 3000, 'rgba(90,70,40,0.10)');
      g.strokeStyle = 'rgba(80,60,30,0.35)'; g.lineWidth = 2;
      for (var y = 0; y <= h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      for (var r = 0; r < 4; r++) for (var x = (r % 2) * 64; x < w; x += 128) { g.beginPath(); g.moveTo(x, r * 64); g.lineTo(x, r * 64 + 64); g.stroke(); }
    }, { repeat: [1, 1] });
    var woodTex = canvasTex(256, 256, function (g, w, h) {
      for (var i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#5a3520' : '#4f2e1b'; g.fillRect(0, i * 32, w, 32); g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(0, i * 32, w, 1); g.fillRect(((i * 97) % 200) + 20, i * 32, 1, 32); }
      noise(g, w, h, 0, 1500, 'rgba(0,0,0,0.12)');
    }, { repeat: [1, 1] });
    return {
      wall: new T.MeshStandardMaterial({ map: wallTex, roughness: 0.85 }),
      wainscot: new T.MeshStandardMaterial({ map: wainTex, roughness: 0.55 }),
      trim: MAT.brass,
      ceiling: new T.MeshStandardMaterial({ map: ceilTex, roughness: 1 }),
      marble: new T.MeshStandardMaterial({ map: marbleTex, roughness: 0.25 }),
      exterior: new T.MeshStandardMaterial({ map: extTex, roughness: 0.95 }),
      floorWood: new T.MeshStandardMaterial({ map: woodTex, roughness: 0.6 }),
    };
  }

  // ==================================================================
  // SLOT MACHINE
  // ==================================================================
  var SYM_STYLE = {
    '7': { c: '#e0242f', o: '#5a0a10', f: 'bold 66px Georgia, serif' },
    '★': { c: '#f6bd2c', o: '#7a4a08' },
    '♦': { c: '#2f7ae6', o: '#0a2a5a' },
    '♣': { c: '#1f9a55', o: '#0a3a1c', f: 'bold 62px Arial, sans-serif' },
    'BAR': { c: '#111111', o: '#000', f: 'bold 22px Arial, sans-serif' },
  };
  var REEL_ORDER = ['7', '★', '♦', '♣', 'BAR'];
  function drawSymbol(g, s, x, y, a) {
    var st = SYM_STYLE[s] || SYM_STYLE['★'];
    g.globalAlpha = a == null ? 1 : a;
    if (s === 'BAR') {
      g.fillStyle = '#15110a'; g.fillRect(x - 28, y - 14, 56, 28);
      g.strokeStyle = '#d9a84a'; g.lineWidth = 2; g.strokeRect(x - 26, y - 12, 52, 24);
      g.fillStyle = '#f6e7c0'; g.font = st.f; g.fillText('BAR', x, y + 1);
    } else if (s === '★') {
      g.beginPath(); for (var i = 0; i < 10; i++) { var r = i % 2 ? 11 : 27, an = -PI / 2 + i * PI / 5; g.lineTo(x + Math.cos(an) * r, y + 2 + Math.sin(an) * r); } g.closePath();
      g.fillStyle = st.c; g.fill(); g.lineWidth = 3; g.strokeStyle = st.o; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.arc(x - 6, y - 6, 4, 0, TAU); g.fill();
    } else if (s === '♦') {
      g.beginPath(); g.moveTo(x, y - 28); g.lineTo(x + 21, y); g.lineTo(x, y + 28); g.lineTo(x - 21, y); g.closePath();
      var gr = g.createLinearGradient(x - 20, y - 28, x + 20, y + 28); gr.addColorStop(0, '#8fd0ff'); gr.addColorStop(0.45, st.c); gr.addColorStop(1, '#0d3c8a');
      g.fillStyle = gr; g.fill(); g.lineWidth = 3; g.strokeStyle = st.o; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.moveTo(x - 4, y - 18); g.lineTo(x + 3, y - 10); g.lineTo(x - 9, y - 4); g.closePath(); g.fill();
    } else {
      g.font = st.f; g.lineWidth = 6; g.strokeStyle = st.o; g.strokeText(s, x, y + 2);
      g.fillStyle = st.c; g.fillText(s, x, y + 2);
      if (s === '7') { g.lineWidth = 1.5; g.strokeStyle = '#ffd45a'; g.strokeText(s, x, y + 2); }
    }
    g.globalAlpha = 1;
  }
  /**
   * Dibuja la pantalla en coordenadas lógicas w x h (256 x 160). spin (opcional): [o0,o1,o2] posición de
   * cada rodillo girando (en símbolos) o null si está quieto.
   */
  function drawSlotScreen(g, w, h, syms, win, broken, accent, spin) {
    var bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#22170a'); bg.addColorStop(1, '#060504');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (broken) {
      for (var i = 0; i < 700; i++) { var v = (Math.random() * 90) | 0; g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; g.fillRect(Math.random() * w, Math.random() * h, 3, 2); }
      g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillRect(0, 38, w, 84);
      g.fillStyle = '#ff4d47'; g.font = 'bold 30px Arial, sans-serif';
      g.fillText('FUERA DE', w / 2, 62); g.fillText('SERVICIO', w / 2, 98);
      return;
    }
    for (var r = 0; r < 3; r++) {
      var x = 14 + r * 78, y = 12, rw = 72, rh = 100, cx = x + rw / 2;
      var gr = g.createLinearGradient(0, y, 0, y + rh);
      gr.addColorStop(0, '#4d4840'); gr.addColorStop(0.2, '#efe7d4'); gr.addColorStop(0.5, '#fffdf6'); gr.addColorStop(0.8, '#efe7d4'); gr.addColorStop(1, '#4d4840');
      g.fillStyle = gr; g.fillRect(x, y, rw, rh);
      g.save(); g.beginPath(); g.rect(x, y, rw, rh); g.clip();
      var o = spin && spin[r] != null ? spin[r] : null;
      if (o != null) { // rodillo girando: símbolos estirados y transparentes que bajan
        var base = Math.floor(o), fr = o - base;
        for (var k = -2; k <= 2; k++) {
          var sym = REEL_ORDER[(((base + k) % 5) + 5) % 5];
          g.save(); g.translate(cx, y + 50 + (k + fr) * 44); g.scale(1, 1.35); drawSymbol(g, sym, 0, 0, 0.55); g.restore();
        }
        g.fillStyle = 'rgba(255,253,246,0.35)'; for (var q = 0; q < 6; q++) g.fillRect(x, y + ((q * 17 + fr * 60) % rh), rw, 2);
      } else {
        drawSymbol(g, syms[r] || '7', cx, y + 52, 1);
        var idx = REEL_ORDER.indexOf(syms[r]); if (idx < 0) idx = 0;
        g.save(); g.translate(cx, y + 3); g.scale(0.6, 0.6); drawSymbol(g, REEL_ORDER[(idx + 4) % 5], 0, 0, 0.3); g.restore();
        g.save(); g.translate(cx, y + rh - 3); g.scale(0.6, 0.6); drawSymbol(g, REEL_ORDER[(idx + 1) % 5], 0, 0, 0.3); g.restore();
      }
      var sh = g.createLinearGradient(0, y, 0, y + rh); sh.addColorStop(0, 'rgba(0,0,0,0.55)'); sh.addColorStop(0.22, 'rgba(0,0,0,0)'); sh.addColorStop(0.78, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.55)');
      g.fillStyle = sh; g.fillRect(x, y, rw, rh);
      g.restore();
      g.strokeStyle = '#1a1208'; g.lineWidth = 3; g.strokeRect(x, y, rw, rh);
      g.strokeStyle = 'rgba(217,168,74,0.7)'; g.lineWidth = 1; g.strokeRect(x - 2, y - 2, rw + 4, rh + 4);
    }
    // línea de pago
    g.strokeStyle = win ? '#ffd45a' : 'rgba(230,70,63,0.9)'; g.lineWidth = win ? 4 : 2;
    g.beginPath(); g.moveTo(6, 62); g.lineTo(w - 6, 62); g.stroke();
    g.fillStyle = g.strokeStyle; g.beginPath(); g.moveTo(2, 55); g.lineTo(11, 62); g.lineTo(2, 69); g.fill(); g.beginPath(); g.moveTo(w - 2, 55); g.lineTo(w - 11, 62); g.lineTo(w - 2, 69); g.fill();
    // barra de información
    g.fillStyle = '#0b0906'; g.fillRect(0, 122, w, 38);
    g.strokeStyle = accent; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 122); g.lineTo(w, 122); g.stroke();
    if (win && !spin) {
      g.fillStyle = '#ffd45a'; g.font = 'bold 26px Georgia, serif'; g.shadowColor = '#ffb020'; g.shadowBlur = 12;
      g.fillText('¡GANADOR!', w / 2, 142); g.shadowBlur = 0;
      g.strokeStyle = '#ffd45a'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    } else {
      g.font = 'bold 12px Arial, sans-serif'; g.fillStyle = '#c9a25a'; g.textAlign = 'left'; g.fillText('CRÉDITOS', 10, 135);
      g.textAlign = 'right'; g.fillText('APUESTA', w - 10, 135);
      g.font = 'bold 13px monospace'; g.fillStyle = '#ff9a3a'; g.textAlign = 'left'; g.fillText('0' + (1000 + ((syms.join('').length * 37) % 900)), 10, 150);
      g.textAlign = 'right'; g.fillText(spin ? '· · ·' : '25', w - 10, 150); g.textAlign = 'center';
      g.fillStyle = spin ? '#ffd45a' : '#e8dcc0'; g.font = 'bold 14px Arial, sans-serif'; g.fillText(spin ? 'GIRANDO' : '● ● ●', w / 2, 142);
    }
    // brillo del vidrio
    var gl = g.createLinearGradient(0, 0, w, h); gl.addColorStop(0, 'rgba(255,255,255,0.10)'); gl.addColorStop(0.35, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gl; g.fillRect(0, 0, w, 120);
  }

  // modelos: cada uno tiene su silueta, su cartel y su patrón de luces
  var SLOT_MODELS = {
    clasica: { label: 'CLÁSICA', sub: '★ 7 7 7 ★', bulb: 0xfff1c4 },
    dorada: { label: 'DORADA', sub: 'ART DÉCO', bulb: 0xffe2a0 },
    diamante: { label: 'DIAMANTE', sub: '♦ ♦ ♦', bulb: 0xbff4ff },
    jackpot: { label: 'JACKPOT', sub: 'MEGA', bulb: 0xffe6ff },
  };
  function slotModelOf(def) {
    if (def.model && SLOT_MODELS[def.model]) return def.model;
    var n = (def.name || '').toLowerCase();
    if (/jackpot/.test(n)) return 'jackpot';
    if (/diamante/.test(n)) return 'diamante';
    if (/dorad|oro/.test(n)) return 'dorada';
    return 'clasica';
  }
  function marqueeTex(name, color, model) {
    return cachedTex('marq|' + name + '|' + color + '|' + model, model === 'jackpot' ? 256 : 384, model === 'jackpot' ? 256 : 112, function (g, w, h) {
      var label = (name || 'SLOTS').replace(/^Tragamonedas\s+/i, '').replace(/^Mega\s+/i, '').toUpperCase();
      g.textAlign = 'center'; g.textBaseline = 'middle';
      if (model === 'jackpot') {
        var rg = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
        rg.addColorStop(0, '#d9a0ff'); rg.addColorStop(0.55, '#6a1fb0'); rg.addColorStop(1, '#1e0638'); g.fillStyle = rg; g.fillRect(0, 0, w, h);
        g.save(); g.translate(w / 2, h / 2); g.fillStyle = 'rgba(255,255,255,0.09)';
        for (var i = 0; i < 16; i++) { g.rotate(PI / 8); g.beginPath(); g.moveTo(0, 0); g.lineTo(-14, -140); g.lineTo(14, -140); g.fill(); }
        g.restore();
        g.strokeStyle = '#ffd45a'; g.lineWidth = 8; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 8, 0, TAU); g.stroke();
        g.strokeStyle = '#fff2c8'; g.lineWidth = 2; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 16, 0, TAU); g.stroke();
        g.font = 'bold 30px Georgia, serif'; g.fillStyle = '#fff2c8'; g.fillText('MEGA', w / 2, h / 2 - 50);
        g.font = 'bold 50px Georgia, serif'; g.lineWidth = 8; g.strokeStyle = '#3a0a5a'; g.strokeText('JACKPOT', w / 2, h / 2 + 4);
        g.shadowColor = '#ffcf4a'; g.shadowBlur = 16; g.fillStyle = '#ffd45a'; g.fillText('JACKPOT', w / 2, h / 2 + 4); g.shadowBlur = 0;
        g.font = 'bold 26px monospace'; g.fillStyle = '#ff5a8a'; g.fillText('$ 7 7 7 7', w / 2, h / 2 + 56);
        return;
      }
      var gr = g.createLinearGradient(0, 0, 0, h);
      if (model === 'dorada') { gr.addColorStop(0, '#2a1c08'); gr.addColorStop(0.5, '#0e0904'); gr.addColorStop(1, '#2a1c08'); }
      else if (model === 'diamante') { gr.addColorStop(0, '#0a3a5a'); gr.addColorStop(0.5, '#041824'); gr.addColorStop(1, '#0a2a44'); }
      else { gr.addColorStop(0, shade(color, 0.3)); gr.addColorStop(0.5, hex(color)); gr.addColorStop(1, shade(color, -0.5)); }
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      if (model === 'dorada') { // abanicos art déco
        g.strokeStyle = 'rgba(217,168,74,0.55)'; g.lineWidth = 2;
        for (var f = 0; f < 9; f++) { g.beginPath(); g.moveTo(w / 2, h + 20); g.lineTo(w / 2 + (f - 4) * 60, -10); g.stroke(); }
        g.strokeStyle = '#d9a84a'; g.lineWidth = 3; g.strokeRect(10, 10, w - 20, h - 20); g.strokeRect(18, 18, w - 36, h - 36);
      } else if (model === 'diamante') {
        g.strokeStyle = 'rgba(120,230,255,0.35)'; g.lineWidth = 1.5;
        for (var d = -6; d < 12; d++) { g.beginPath(); g.moveTo(d * 36, 0); g.lineTo(d * 36 + h, h); g.stroke(); g.beginPath(); g.moveTo(d * 36 + h, 0); g.lineTo(d * 36, h); g.stroke(); }
      } else {
        g.save(); g.translate(w / 2, h + 10); g.fillStyle = 'rgba(255,255,255,0.12)';
        for (var j = 0; j < 16; j++) { g.rotate(PI / 16); g.beginPath(); g.moveTo(0, 0); g.lineTo(-14, -200); g.lineTo(14, -200); g.fill(); }
        g.restore();
      }
      var fs = Math.min(58, Math.floor(380 / Math.max(4, label.length) * 1.45));
      g.font = 'bold ' + fs + 'px Georgia, serif';
      var tc = model === 'diamante' ? '#d8fbff' : model === 'dorada' ? '#ffe08a' : '#fff4d6', glow = model === 'diamante' ? '#4fe0ff' : '#ffd27a';
      g.lineWidth = 7; g.strokeStyle = model === 'diamante' ? '#022030' : '#2a1404'; g.strokeText(label, w / 2, h / 2 - 4);
      g.fillStyle = tc; g.shadowColor = glow; g.shadowBlur = 14; g.fillText(label, w / 2, h / 2 - 4); g.shadowBlur = 0;
      g.font = 'bold 16px Arial, sans-serif'; g.fillStyle = model === 'diamante' ? '#7fe8ff' : '#ffd45a'; g.fillText(SLOT_MODELS[model] ? SLOT_MODELS[model].sub : '', w / 2, h - 16);
      if (model !== 'dorada') { g.strokeStyle = model === 'diamante' ? '#7fe8ff' : '#d9a84a'; g.lineWidth = 4; g.strokeRect(4, 4, w - 8, h - 8); }
    });
  }
  // textura de luces: fila de arriba = patrón que corre (se mueve con offset), fila de abajo = siempre prendida
  var CHASE_N = 16;
  function chaseTex() {
    var base = cachedTex('chase', CHASE_N, 2, function (g, w) {
      for (var j = 0; j < w; j++) { g.fillStyle = j % 4 < 2 ? '#ffffff' : '#2a2016'; g.fillRect(j, 0, 1, 1); }
      g.fillStyle = '#ffffff'; g.fillRect(0, 1, w, 1);
    });
    var t = base.clone(); t.userData = base.userData; t.needsUpdate = true;
    t.magFilter = t.minFilter = T.NearestFilter; t.generateMipmaps = false; t.wrapS = T.RepeatWrapping; t.anisotropy = 1;
    return t;
  }
  function chaseUV(i) { return [((i % CHASE_N) + 0.5) / CHASE_N, 0.75]; }
  var STEADY_UV = [0.5, 0.25];
  /** Kit con color por pieza: slots 'PAINT', 'METAL', 'LIGHT' (cada uno se funde en una malla con colores por vértice). */
  function CKit() { this.by = {}; }
  CKit.prototype.add = function (slot, geo, color, x, y, z, rx, ry, rz, sx, sy, sz, uv) {
    (this.by[slot] || (this.by[slot] = [])).push({ geo: geo, color: color, uv: uv, m: mtx(x, y, z, rx, ry, rz, sx, sy, sz) }); return this;
  };
  CKit.prototype.addM = function (slot, geo, color, m, uv) { (this.by[slot] || (this.by[slot] = [])).push({ geo: geo, color: color, uv: uv, m: m }); return this; };
  CKit.prototype.merged = function () { var out = {}; for (var k in this.by) out[k] = mergeGeos(this.by[k], true); return out; };
  var VC = {
    get paint() { return cache(_mats, 'vcpaint', function () { return new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.18 }); }); },
    get paintBroken() { return cache(_mats, 'vcpaintb', function () { return new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.05, color: 0x6a6460 }); }); },
    get metal() { return cache(_mats, 'vcmetal', function () { return new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.26, metalness: 0.55, emissive: 0x2a1e10 }); }); },
  };

  function addStoolTo(k, z, h) {
    k.add('METAL', cylG(0.2, 0.22, 0.03, 14), PAL.brass, 0, 0.015, z);
    k.add('METAL', cylG(0.03, 0.03, h - 0.08, 8), PAL.brass, 0, h / 2, z);
    k.add('METAL', torG(0.15, 0.012, 4, 14), PAL.brass, 0, h * 0.4, z, PI / 2);
    k.add('PAINT', cylG(0.2, 0.18, 0.09, 14), 0x8e1f26, 0, h - 0.03, z);
    k.add('PAINT', torG(0.19, 0.03, 5, 16), 0x7a1820, 0, h + 0.01, z, PI / 2);
    k.add('PAINT', cylG(0.17, 0.17, 0.02, 14), 0x9e2a30, 0, h + 0.035, z);
  }
  function slotParts(model, color, stool) {
    return cache(_geos, 'slot2|' + model + '|' + color + '|' + (stool ? 1 : 0), function () {
      var k = new CKit(), C = color, dark = PAL.black, blk = 0x0b0c0e, brass = PAL.brass, chrome = PAL.chrome;
      var lite = new T.Color(color).lerp(new T.Color(0xffffff), 0.45).getHex(), bulb = SLOT_MODELS[model].bulb, bi = 0;
      var trim = model === 'dorada' ? brass : model === 'diamante' ? chrome : model === 'jackpot' ? brass : chrome;
      function B(x, y, z, r) { k.add('LIGHT', icoG(r || 0.024), bulb, x, y, z, 0, 0, 0, 1, 1, 1, chaseUV(bi++)); }
      function S(geo, col, x, y, z, rx, ry, rz, sx, sy, sz) { k.add('LIGHT', geo, col, x, y, z, rx, ry, rz, sx, sy, sz, STEADY_UV); }
      // --- base común ---
      k.add('PAINT', rbox(0.9, 0.1, 0.7, 0.02), dark, 0, 0.05, 0);
      k.add('METAL', rbox(0.92, 0.02, 0.72, 0.008), trim, 0, 0.105, 0);
      k.add('PAINT', rbox(0.84, 0.86, 0.62, 0.045, 2), C, 0, 0.53, 0);
      k.add('PAINT', rbox(0.62, 0.58, 0.02, 0.01), blk, 0, 0.5, 0.305);                                   // hueco de la puerta
      k.add('PAINT', boxG(0.3, 0.12, 0.02), 0x3f8a4a, 0, 0.42, 0.31);                                   // billetes (se ven con la puerta abierta)
      k.add('METAL', rbox(0.9, 0.05, 0.68, 0.015), trim, 0, 0.975, 0.01);
      k.add('PAINT', rbox(0.86, 0.06, 0.3, 0.02), blk, 0, 1.03, 0.2, -0.22, 0, 0);                         // repisa
      k.add('METAL', rbox(0.86, 0.015, 0.02, 0.006), trim, 0, 1.06, 0.345, -0.22, 0, 0);
      k.add('PAINT', rbox(0.84, 0.82, 0.5, 0.045, 2), C, 0, 1.43, -0.06);
      k.add('PAINT', rbox(0.74, 0.54, 0.05, 0.02), blk, 0, 1.45, 0.19);                                   // marco de pantalla
      k.add('METAL', rbox(0.72, 0.03, 0.03, 0.01), trim, 0, 1.73, 0.215); k.add('METAL', rbox(0.72, 0.03, 0.03, 0.01), trim, 0, 1.17, 0.215);
      k.add('METAL', rbox(0.03, 0.56, 0.03, 0.01), trim, -0.36, 1.45, 0.215); k.add('METAL', rbox(0.03, 0.56, 0.03, 0.01), trim, 0.36, 1.45, 0.215);
      k.add('METAL', rbox(0.36, 0.08, 0.1, 0.02), chrome, 0, 0.2, 0.33);                                 // bandeja de monedas
      k.add('PAINT', rbox(0.3, 0.03, 0.06, 0.01), blk, 0, 0.23, 0.35);
      k.add('PAINT', rbox(0.12, 0.16, 0.04, 0.01), blk, 0.28, 1.13, 0.2, -0.22, 0, 0);                    // billetero
      S(boxG(0.07, 0.008, 0.01), 0x5affa0, 0.28, 1.17, 0.225, -0.22, 0, 0);
      // botonera: tres de apuesta + uno grande de girar
      [[-0.3, 0xfff1c4], [-0.19, 0xffc84a], [-0.08, 0x6affb0]].forEach(function (b) { S(cylG(0.03, 0.032, 0.025, 10), b[1], b[0], 1.072, 0.24, -0.22, 0, 0); k.add('METAL', torG(0.033, 0.006, 4, 12), chrome, b[0], 1.064, 0.238, PI / 2 - 0.22, 0, 0); });
      S(cylG(0.045, 0.048, 0.03, 12), 0xff4a3a, 0.08, 1.074, 0.24, -0.22, 0, 0);
      k.add('METAL', torG(0.048, 0.008, 4, 14), chrome, 0.08, 1.064, 0.238, PI / 2 - 0.22, 0, 0);
      // tiras de luz laterales
      [-0.405, 0.405].forEach(function (x) { S(boxG(0.025, 0.72, 0.025), lite, x, 1.43, 0.19); S(boxG(0.025, 0.76, 0.025), lite, x, 0.53, 0.31); });
      S(boxG(0.6, 0.02, 0.02), lite, 0, 0.88, 0.312);                                                   // filete sobre la puerta
      // palanca: base cromada
      k.add('METAL', cylG(0.075, 0.075, 0.06, 14), chrome, 0.445, 1.2, 0.0, 0, 0, PI / 2);
      k.add('METAL', rbox(0.04, 0.22, 0.12, 0.015), chrome, 0.435, 1.2, 0.0);
      // --- copete según el modelo ---
      if (model === 'clasica') {
        k.add('METAL', rbox(0.9, 0.04, 0.58, 0.015), trim, 0, 1.845, -0.05);
        k.add('PAINT', rbox(0.88, 0.34, 0.54, 0.05, 2), C, 0, 2.02, -0.05);
        k.add('PAINT', cylG(0.27, 0.27, 0.86, 16, false, 0, PI), C, 0, 2.19, -0.05, 0, 0, PI / 2, 0.42, 1, 1);
        k.add('METAL', torG(0.27, 0.012, 4, 16, PI), trim, 0, 2.19, 0.225, 0, 0, 0, 1, 0.42, 1);
        k.add('METAL', sphG(0.05, 10, 8), brass, 0, 2.31, -0.05);
        for (var row = 0; row < 2; row++) for (var i = 0; i < 9; i++) B(-0.38 + i * 0.095, row ? 2.165 : 1.875, 0.235);
        for (var a = 0; a <= 8; a++) { var an = a / 8 * PI; B(Math.cos(an) * 0.4, 2.19 + Math.sin(an) * 0.106, 0.215, 0.02); }
      } else if (model === 'dorada') {
        k.add('METAL', rbox(0.9, 0.04, 0.58, 0.015), brass, 0, 1.845, -0.05);
        k.add('PAINT', rbox(0.88, 0.34, 0.54, 0.05, 2), 0x1a1206, 0, 2.02, -0.05);
        [[0.78, 2.235], [0.6, 2.315], [0.42, 2.395]].forEach(function (s, j) { k.add('PAINT', rbox(s[0], 0.08, 0.46 - j * 0.06, 0.02), C, 0, s[1], -0.07); k.add('METAL', rbox(s[0] + 0.02, 0.015, 0.47 - j * 0.06, 0.006), brass, 0, s[1] + 0.045, -0.07); });
        k.add('METAL', cylG(0.3, 0.3, 0.03, 14, false, -PI / 2, PI), brass, 0, 2.44, -0.12, -PI / 2, 0, 0, 1, 1, 1);  // abanico
        for (var fan = 0; fan < 7; fan++) { var fa = -PI / 2 + (fan + 0.5) / 7 * PI; S(boxG(0.012, 0.22, 0.01), 0xfff1c4, Math.sin(fa) * 0.14, 2.44 + Math.cos(fa) * 0.14, -0.1, 0, 0, -fa); }
        [-0.445, 0.445].forEach(function (x) { k.add('METAL', rbox(0.05, 1.9, 0.06, 0.015), brass, x, 1.08, 0.24); k.add('METAL', sphG(0.04, 8, 6), brass, x, 2.06, 0.24); });
        for (var p = 0; p < 30; p++) { var u = p / 30, px, py; if (u < 0.35) { px = -0.4 + u / 0.35 * 0.8; py = 2.175; } else if (u < 0.5) { px = 0.4; py = 2.175 - (u - 0.35) / 0.15 * 0.3; } else if (u < 0.85) { px = 0.4 - (u - 0.5) / 0.35 * 0.8; py = 1.875; } else { px = -0.4; py = 1.875 + (u - 0.85) / 0.15 * 0.3; } B(px, py, 0.235, 0.022); }
      } else if (model === 'diamante') {
        k.add('METAL', rbox(0.9, 0.04, 0.58, 0.015), chrome, 0, 1.845, -0.05);
        k.add('PAINT', rbox(0.86, 0.36, 0.5, 0.06, 2), 0x0a1a24, 0, 2.04, -0.07, -0.18, 0, 0);
        k.add('METAL', cylG(0.03, 0.06, 0.12, 10), chrome, 0, 2.27, -0.08);
        S(new T.OctahedronGeometry(0.2, 0), 0xcff8ff, 0, 2.52, -0.08, 0, PI / 4, 0, 1.0, 1.25, 0.55);
        k.add('PAINT', new T.OctahedronGeometry(0.205, 0), 0x2a8ab0, 0, 2.52, -0.085, 0, PI / 4, 0, 1.06, 1.3, 0.5);
        // LEDs corriendo por los bordes del gabinete
        for (var l = 0; l < 24; l++) { var ly = 0.16 + l * 0.075; B(-0.43, ly, 0.19 + (ly < 0.98 ? 0.12 : 0), 0.016); }
        for (var l2 = 0; l2 < 24; l2++) { var ly2 = 0.16 + (23 - l2) * 0.075; B(0.43, ly2, 0.19 + (ly2 < 0.98 ? 0.12 : 0), 0.016); }
        for (var l3 = 0; l3 < 16; l3++) B(-0.4 + l3 * 0.0533, 1.875, 0.235, 0.016);
      } else { // jackpot
        k.add('METAL', rbox(0.9, 0.04, 0.58, 0.015), brass, 0, 1.845, -0.05);
        k.add('PAINT', rbox(0.88, 0.3, 0.54, 0.05, 2), C, 0, 2.0, -0.05);
        k.add('PAINT', cylG(0.44, 0.44, 0.14, 24), 0x1e0638, 0, 2.58, -0.06, PI / 2, 0, 0);
        k.add('METAL', torG(0.44, 0.03, 5, 28), brass, 0, 2.58, 0.015, 0, 0, 0);
        k.add('METAL', rbox(0.3, 0.14, 0.2, 0.03), brass, 0, 2.17, -0.06);
        [-1, 1].forEach(function (s) { k.add('METAL', rbox(0.05, 0.5, 0.18, 0.02), chrome, s * 0.47, 2.4, -0.06, 0, 0, -s * 0.35); });
        for (var jb = 0; jb < 24; jb++) { var ja = jb / 24 * TAU; B(Math.cos(ja) * 0.4, 2.58 + Math.sin(ja) * 0.4, 0.05, 0.022); }
        for (var r2 = 0; r2 < 9; r2++) B(-0.38 + r2 * 0.095, 1.875, 0.235);
        S(rbox(0.6, 0.08, 0.02, 0.01), 0xff5a8a, 0, 2.04, 0.225);                                         // display del pozo
      }
      if (stool) addStoolTo(k, 0.85, 0.72);
      var out = k.merged();
      // puerta de la caja (bisagra a la izquierda) y palanca: piezas que se mueven
      var dk = new CKit();
      dk.add('PAINT', rbox(0.6, 0.54, 0.03, 0.012), C, 0.3, 0, 0);
      dk.add('PAINT', rbox(0.5, 0.42, 0.01, 0.006), new T.Color(C).multiplyScalar(0.8).getHex(), 0.3, 0, 0.016);
      dk.add('PAINT', cylG(0.025, 0.025, 0.02, 10), brass, 0.52, 0, 0.03, PI / 2);
      dk.add('PAINT', boxG(0.12, 0.02, 0.012), brass, 0.3, 0.17, 0.03);
      [[0.3, 0.22, 0.5, 0.012], [0.3, -0.22, 0.5, 0.012]].forEach(function (q) { dk.add('PAINT', boxG(q[2], q[3], 0.008), trim, q[0], q[1], 0.02); });
      out.DOOR = dk.merged().PAINT;
      var lk = new CKit();
      lk.add('METAL', cylG(0.016, 0.016, 0.42, 8), chrome, 0, 0.21, 0);
      lk.add('METAL', sphG(0.058, 12, 9), model === 'diamante' ? 0x2a9ad6 : model === 'jackpot' ? 0x9b3ad6 : 0xd4232f, 0, 0.44, 0);
      out.LEVER = lk.merged().METAL;
      // sombra: gabinete + banqueta en un solo quad doble
      out.BLOB = mergeGeos([{ geo: planeG(1.3, 1.05), m: mtx(0, 0.012, 0, -PI / 2) }].concat(stool ? [{ geo: planeG(0.55, 0.55), m: mtx(0, 0.013, 0.85, -PI / 2) }] : []));
      // halo de luz (atrás del copete) + reflejo en el piso: un plano aditivo
      var top = model === 'jackpot' ? 2.58 : model === 'diamante' ? 2.3 : 2.1;
      out.HALO = mergeGeos([{ geo: planeG(model === 'jackpot' ? 1.9 : 1.7, model === 'jackpot' ? 1.7 : 1.3), m: mtx(0, top, -0.36) }, { geo: planeG(1.3, 0.9), m: mtx(0, 0.02, 0.62, -PI / 2) }]);
      return out;
    });
  }
  function haloTex() {
    return cachedTex('halo', 128, 128, function (g, w, h) {
      var gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
  }
  /** Material aditivo para brillos falsos (halos, neones). Se comparte por color. */
  function glowMat(color, opacity) {
    return cache(_mats, 'glow|' + color + '|' + (opacity || 1), function () {
      return new T.MeshBasicMaterial({ color: color, map: haloTex(), transparent: true, opacity: opacity == null ? 1 : opacity, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
    });
  }
  // efectos caros (halos): se apagan todos juntos en calidad "baja"
  var FX = { low: false, list: [] };
  function regFx(m) { FX.list.push(m); m.userData.fx = true; if (FX.low) m.visible = false; return m; }
  function setLowFx(low) {
    FX.low = !!low;
    FX.list = FX.list.filter(function (m) { return !!m.parent; });
    FX.list.forEach(function (m) { m.visible = !FX.low && !m.userData.fxHide; });
  }

  /**
   * makeSlotMachine(def) -> Group  (~3,500 tris, 9 draw calls con banqueta)
   * def: { color:0xc8323a, name:'Tragamonedas Clásica', model:'clasica'|'dorada'|'diamante'|'jackpot', stool:false, blob:true }
   * Footprint 0.9 x 0.7 m, height 2.36 m (jackpot 3.0 m). Front (+Z) = screen side.
   * api: setReels(symbols[3], win) (si estaba girando, para los rodillos de a uno), setBroken(bool), setDark(bool) (sin luz),
   *      pull() (palanca + rodillos girando), cancelSpin(), setDoorOpen(bool), update(dt), broken, dark, screen (Mesh)
   */
  function makeSlotMachine(def) {
    def = def || {};
    var color = def.color == null ? 0xc8323a : def.color, model = slotModelOf(def);
    var group = new T.Group();
    var P = slotParts(model, color, !!def.stool);
    var paint = new T.Mesh(P.PAINT, VC.paint), metal = new T.Mesh(P.METAL, VC.metal);
    var lightMat = new T.MeshBasicMaterial({ vertexColors: true, map: chaseTex(), toneMapped: false });
    var lights = new T.Mesh(P.LIGHT, lightMat);
    [paint, metal, lights].forEach(function (m) { m.matrixAutoUpdate = false; group.add(m); });
    var meshes = { BODY: paint };

    // pantalla (canvas 1.5x para que se lea nítida; se dibuja en coords lógicas 256 x 160)
    var SC = 1.5, screenTex = canvasTex(256 * SC, 160 * SC, function (g) { g.scale(SC, SC); });
    var screenMat = new T.MeshBasicMaterial({ map: screenTex, toneMapped: false });
    var screen = new T.Mesh(planeG(0.64, 0.4), screenMat); screen.position.set(0, 1.45, 0.218); group.add(screen);
    // cartel
    var marqMat = new T.MeshBasicMaterial({ map: marqueeTex(def.name, color, model), toneMapped: false });
    var marq;
    if (model === 'jackpot') { marq = new T.Mesh(cache(_geos, 'jpdisc', function () { return new T.CircleGeometry(0.39, 28); }), marqMat); marq.position.set(0, 2.58, 0.015); }
    else if (model === 'diamante') { marq = new T.Mesh(planeG(0.78, 0.25), marqMat); marq.position.set(0, 2.05, 0.185); marq.rotation.x = -0.18; }
    else { marq = new T.Mesh(planeG(0.78, 0.23), marqMat); marq.position.set(0, 2.02, 0.222); }
    group.add(marq);
    // halo aditivo (efecto caro: se apaga en calidad baja)
    var halo = regFx(new T.Mesh(P.HALO, glowMat(new T.Color(color).lerp(new T.Color(0xffffff), 0.15).getHex(), 0.55)));
    halo.renderOrder = 2; group.add(halo);

    // puerta de la caja (bisagra a la izquierda)
    var door = new T.Group(); door.position.set(-0.3, 0.5, 0.33); group.add(door);
    door.add(new T.Mesh(P.DOOR, VC.paint));
    var doorOpen = false, doorT = 0;
    // palanca
    var lever = new T.Group(); lever.position.set(0.48, 1.2, 0.0); group.add(lever);
    lever.add(new T.Mesh(P.LEVER, VC.metal));
    var leverT = -1;

    var blob = null;
    if (def.blob !== false) { blob = new T.Mesh(P.BLOB, blobMat()); blob.renderOrder = -1; group.add(blob); }

    var t = Math.random() * 10, flash = 0, lastSyms = ['7', '7', '7'], lastWin = false, frameT = 0;
    var spin = null, spinOff = [0, 0, 0], stopAt = null, spinT = 0;
    var dirty = false;
    function draw() {
      var sp = spin ? spin.map(function (on, i) { return on ? spinOff[i] : null; }) : null;
      if (sp && sp.every(function (x) { return x == null; })) sp = null;
      drawSlotScreen(screenTex.userData.ctx, 256, 160, lastSyms, lastWin && !sp, api.broken, hex(color), sp);
      screenTex.needsUpdate = true;
    }
    function lit() { return !api.dark && !api.broken; }
    var api = {
      broken: false, dark: false, screen: screen, lever: lever, door: door, model: model,
      setReels: function (symbols, win) {
        lastSyms = symbols.slice(0, 3); lastWin = !!win;
        if (spin && !api.broken) { stopAt = [spinT + 0.05, spinT + 0.25, spinT + 0.45]; return; } // los rodillos frenan de a uno
        spin = null; draw(); if (win) flash = 2.0;
      },
      cancelSpin: function () { spin = null; stopAt = null; flash = 0; },
      setBroken: function (b) {
        api.broken = !!b; spin = null; stopAt = null;
        meshes.BODY.material = door.children[0].material = api.broken ? VC.paintBroken : VC.paint;
        marqMat.color.setHex(api.dark ? 0x181818 : api.broken ? 0x553838 : 0xffffff);
        halo.userData.fxHide = !lit(); halo.visible = !FX.low && lit();
        flash = 0; draw();
      },
      setDark: function (d) { // apagón: pantalla, marquesina, focos y tiras apagados
        api.dark = !!d; spin = null; stopAt = null;
        marqMat.color.setHex(api.dark ? 0x181818 : api.broken ? 0x553838 : 0xffffff);
        halo.userData.fxHide = !lit(); halo.visible = !FX.low && lit();
        if (!api.dark) draw();
      },
      pull: function () { leverT = 0; if (lit()) { spin = [true, true, true]; stopAt = null; spinT = 0; flash = 0; lastWin = false; } },
      setDoorOpen: function (open) { doorOpen = !!open; },
      update: function (dt) {
        t += dt;
        doorT += ((doorOpen ? 1 : 0) - doorT) * Math.min(1, dt * 6); door.rotation.y = -doorT * 1.75;
        if (api.dark) { screenMat.color.setScalar(0.05); lightMat.color.setScalar(0.06); return; }
        if (leverT >= 0) { leverT += dt / 0.55; var u = Math.min(1, leverT); lever.rotation.x = (u < 0.3 ? u / 0.3 : Math.pow(1 - (u - 0.3) / 0.7, 2)) * 1.05; if (leverT >= 1) { leverT = -1; lever.rotation.x = 0; } }
        if (api.broken) {
          var fl = Math.random() < 0.08 ? 0.25 : 1; screenMat.color.setScalar(fl * 0.7);
          lightMat.color.setRGB(Math.sin(t * 3) > 0.95 ? 0.9 : 0.12, 0.08, 0.06);
          return;
        }
        screenMat.color.setScalar(1);
        if (spin) {
          spinT += dt; frameT -= dt;
          for (var i = 0; i < 3; i++) if (spin[i]) {
            spinOff[i] += dt * (11 + i * 1.5);
            if (stopAt && spinT >= stopAt[i]) { spin[i] = false; dirty = true; }
          }
          if (stopAt && spinT > stopAt[2] + 3) stopAt = null;
          if ((frameT <= 0 || dirty) && !api.far) { frameT = 1 / 12; dirty = false; draw(); } // api.far: fuera de cámara o lejos (game.js)
          if (!spin[0] && !spin[1] && !spin[2]) { spin = null; stopAt = null; draw(); if (lastWin) flash = 2.0; }
          else if (!stopAt && spinT > 4) { spin = null; draw(); }  // nunca quedarse girando para siempre
        }
        var step;
        if (flash > 0) {
          flash -= dt; var on = Math.floor(t * 12) % 2;
          lightMat.color.setScalar(on ? 1 : 0.45); step = Math.floor(t * 24);
          if (flash <= 0) { lastWin = false; draw(); }
        } else {
          lightMat.color.setScalar(0.92 + 0.08 * Math.sin(t * 2.4)); step = Math.floor(t * (spin ? 14 : 5));
        }
        lightMat.map.offset.x = -(step % CHASE_N) / CHASE_N;
      },
    };
    draw();
    return finish(group, api, 'SlotMachine');
  }

  // ==================================================================
  // STOOL
  // ==================================================================
  /**
   * makeStool(opts) -> Group   (~300 tris, 2 draw calls)
   * opts: { height:0.72, blob }  api.seatHeight
   */
  function makeStool(opts) {
    opts = opts || {}; var h = opts.height || 0.72;
    var g = new T.Group();
    inst(cachedParts('stool|' + h, function (k) {
      k.add(cylG(0.2, 0.22, 0.03, 14), MAT.brass, 0, 0.015, 0);
      k.add(cylG(0.03, 0.03, h - 0.08, 8), MAT.brass, 0, h / 2, 0);
      k.add(torG(0.15, 0.012, 4, 14), MAT.brass, 0, h * 0.4, 0, PI / 2);
      k.add(cylG(0.2, 0.18, 0.09, 14), MAT.leatherRed, 0, h - 0.03, 0);
      k.add(torG(0.19, 0.03, 4, 14), MAT.leatherRed, 0, h + 0.01, 0, PI / 2);
    }), g);
    addBlob(g, 0.55, 0.55, opts);
    return finish(g, { seatHeight: h + 0.04 }, 'Stool');
  }
  /** Varias banquetas fundidas en las mallas del mueble (2 draw calls para todas) + sus sombras en un solo quad múltiple. */
  function addStools(g, key, pts, h, opts) {
    inst(cachedParts('stools|' + key + '|' + h, function (k) {
      pts.forEach(function (p) {
        k.add(cylG(0.2, 0.22, 0.03, 14), MAT.brass, p[0], 0.015, p[1]);
        k.add(cylG(0.03, 0.03, h - 0.08, 8), MAT.brass, p[0], h / 2, p[1]);
        k.add(torG(0.15, 0.012, 4, 14), MAT.brass, p[0], h * 0.4, p[1], PI / 2);
        k.add(cylG(0.2, 0.18, 0.09, 14), MAT.leatherRed, p[0], h - 0.03, p[1]);
        k.add(torG(0.19, 0.03, 4, 14), MAT.leatherRed, p[0], h + 0.01, p[1], PI / 2);
      });
    }), g);
    if (opts && opts.blob === false) return;
    var b = new T.Mesh(cache(_geos, 'stoolblobs|' + key, function () { return mergeGeos(pts.map(function (p) { return { geo: planeG(0.55, 0.55), m: mtx(p[0], 0.013, p[1], -PI / 2) }; })); }), blobMat());
    b.renderOrder = -1; g.add(b);
  }

  // ==================================================================
  // BLACKJACK
  // ==================================================================
  function feltBJTex() {
    return cachedTex('feltbj', 1024, 1024, function (g) { g.scale(2, 2); var w = 512, h = 512;
      var gr = g.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w / 2);
      gr.addColorStop(0, '#1d5a42'); gr.addColorStop(1, '#0f2b22'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      noise(g, w, h, 0, 2500, 'rgba(0,0,0,0.12)');
      var cx = w / 2, cy = h / 2;   // dealer edge is the horizontal centre line, players are below
      g.strokeStyle = '#d9a84a'; g.lineWidth = 3;
      g.beginPath(); g.arc(cx, cy, 200, 0.1 * PI, 0.9 * PI); g.stroke();
      g.beginPath(); g.arc(cx, cy, 150, 0.15 * PI, 0.85 * PI); g.stroke();
      // text along arc
      function arcText(txt, r, size, col) {
        g.save(); g.font = 'bold ' + size + 'px Georgia, serif'; g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle';
        var span = 0.5 * PI, n = txt.length;
        for (var i = 0; i < n; i++) { var a = PI / 2 + span / 2 - (i + 0.5) * span / n; g.save(); g.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.rotate(a - PI / 2); g.fillText(txt[i], 0, 0); g.restore(); }
        g.restore();
      }
      arcText('BLACKJACK PAGA 3 A 2', 175, 17, '#f3e9d2');
      arcText('EL CRUPIER PLANTA EN 17', 128, 12, '#d9a84a');
      // 5 betting circles
      for (var i = 0; i < 5; i++) {
        var a = PI * (0.2 + i * 0.15), x = cx + Math.cos(a) * 225, y = cy + Math.sin(a) * 225;
        g.strokeStyle = '#f3e9d2'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 18, 0, TAU); g.stroke();
      }
      // dealer card zone
      g.strokeStyle = 'rgba(243,233,210,0.6)'; g.lineWidth = 2; g.strokeRect(cx - 40, cy + 30, 80, 46);
    });
  }
  /**
   * makeBlackjackTable(opts) -> Group  (~2,600 tris with stools, ~10 draw calls)
   * Half-moon table, radius 1.15 m, felt at 0.86 m. Players on the curved +Z side,
   * dealer stands at local (0, 0, -0.45) facing +Z.
   * opts: { stools:true, blob }   api.seats: [{x,z,rotY}] world-local positions of stools
   */
  function makeBlackjackTable(opts) {
    opts = opts || {};
    var g = new T.Group(), R = 1.15, H = 0.86;
    inst(cachedParts('bj', function (k) {
      k.add(cylG(R - 0.05, R - 0.12, 0.72, 20, false, -PI / 2, PI), MAT.woodDark, 0, 0.44, 0);   // skirt
      k.add(rbox(2.2, 0.72, 0.08, 0.02), MAT.woodDark, 0, 0.44, -0.04);                       // dealer side
      k.add(cylG(0.34, 0.4, 0.08, 16), MAT.black, 0, 0.04, 0.35);                              // foot
      k.add(torG(R - 0.02, 0.075, 6, 24, PI), MAT.padding, 0, H, 0, PI / 2);                    // padded rail
      k.add(rbox(2.36, 0.07, 0.16, 0.03), MAT.padding, 0, H, -0.07);                           // dealer edge
      k.add(torG(R - 0.14, 0.012, 4, 24, PI), MAT.brass, 0, H + 0.005, 0, PI / 2);              // brass inlay
      // chip tray and shoe
      k.add(rbox(0.56, 0.04, 0.14, 0.01), MAT.black, 0, H + 0.02, 0.06);
      var chipCols = [0xd4423f, 0x2a6fd6, 0x1d8a4e, 0x15171a, 0xf3e9d2, 0xd9a84a];
      for (var i = 0; i < 6; i++) k.add(chipG(0.03, 0.05), chipMat(chipCols[i]), -0.21 + i * 0.084, H + 0.06, 0.06, PI / 2, 0, 0);
      k.add(rbox(0.16, 0.1, 0.24, 0.02), MAT.black, 0.62, H + 0.05, 0.12, 0, -0.3, 0);
      k.add(boxG(0.1, 0.06, 0.02), std(0xb02020, 0.6), 0.6, H + 0.07, 0.24, 0, -0.3, 0);
      // a few cards and chips on the felt
      k.add(boxG(0.06, 0.003, 0.09), pkCardMat({ r: 1, s: 0 }), -0.04, H + 0.005, 0.38, 0, 0.1 + PI, 0);
      k.add(boxG(0.06, 0.003, 0.09), pkCardMat({ r: 13, s: 1 }), 0.03, H + 0.006, 0.39, 0, -0.15 + PI, 0);
      k.add(boxG(0.06, 0.003, 0.09), pkCardMat({ r: 10, s: 2 }), -0.5, H + 0.005, 0.7, 0, 0.6, 0);
      k.add(boxG(0.06, 0.003, 0.09), pkCardMat({ r: 7, s: 3 }), -0.45, H + 0.006, 0.72, 0, 0.4, 0);
      for (var s = 0; s < 4; s++) k.add(chipG(0.026, 0.01), chipMat(chipCols[s % 3]), 0.3, H + 0.005 + s * 0.011, 0.88);
      for (var s2 = 0; s2 < 3; s2++) k.add(chipG(0.026, 0.01), chipMat(chipCols[3 + s2 % 2]), -0.3, H + 0.005 + s2 * 0.011, 0.88);
    }), g);
    // felt top (uses circle UVs for the printed layout)
    var felt = new T.Mesh(cache(_geos, 'bjfelt', function () { return new T.CircleGeometry(R - 0.03, 24, PI, PI); }),
      cache(_mats, 'bjfeltmat', function () { return new T.MeshStandardMaterial({ map: feltBJTex(), roughness: 0.95 }); }));
    felt.rotation.x = -PI / 2; felt.position.y = H - 0.005; g.add(felt);
    var feltBack = new T.Mesh(planeG(2.2, 0.12), MAT.feltGreen); feltBack.rotation.x = -PI / 2; feltBack.position.set(0, H - 0.006, -0.02); g.add(feltBack);
    var seats = [];
    if (opts.stools !== false) {
      for (var i = 0; i < 5; i++) {
        var a = PI * (0.18 + i * 0.16), x = Math.cos(a) * (R + 0.45), z = Math.sin(a) * (R + 0.45);
        seats.push({ x: x, z: z, rotY: Math.atan2(-x, -z) });
      }
      addStools(g, 'bj', seats.map(function (s) { return [s.x, s.z]; }), 0.72, opts);
    }
    addBlob(g, 2.8, 2.0, opts);
    return finish(g, { seats: seats, feltHeight: H }, 'BlackjackTable');
  }

  // ==================================================================
  // POKER (Texas Hold'em)
  // ==================================================================
  var PK_SUITS = ['♠', '♥', '♦', '♣'], PK_RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  // felt drawn on a square canvas that is squashed onto an ellipse rx x rz, so text is pre-compressed in x
  function feltPokerTex(rx, rz) {
    return cachedTex('feltpk|' + rx + '|' + rz, 1024, 1024, function (g) { g.scale(2, 2); var w = 512, h = 512;
      var gr = g.createRadialGradient(w / 2, h / 2, 30, w / 2, h / 2, w / 2);
      gr.addColorStop(0, '#1f6e4c'); gr.addColorStop(0.75, '#15533a'); gr.addColorStop(1, '#0c3324'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      noise(g, w, h, 0, 3000, 'rgba(0,0,0,0.12)');
      var c = w / 2;
      g.strokeStyle = '#d9a84a'; g.lineWidth = 3; g.beginPath(); g.arc(c, c, 228, 0, TAU); g.stroke();
      g.lineWidth = 1.5; g.beginPath(); g.arc(c, c, 218, 0, TAU); g.stroke();
      // readable from the croupier side (-Z): the canvas is turned 180°
      g.save(); g.translate(c, c); g.rotate(PI); g.scale(rz / rx, 1);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#d9a84a'; g.font = 'bold 34px Georgia, serif'; g.fillText('CASINO DORADO', 0, -112);
      g.fillStyle = 'rgba(243,233,210,0.75)'; g.font = 'italic 22px Georgia, serif'; g.fillText("Texas Hold'em", 0, 128);
      // community card boxes
      g.strokeStyle = 'rgba(243,233,210,0.55)'; g.lineWidth = 2;
      for (var i = 0; i < 5; i++) g.strokeRect((i - 2) * 40.6 - 16, 7, 32, 42); // matches the 3D board cards (0.115 m apart, z = -0.08)
      g.restore();
    });
  }
  function pkCardMat(card) {
    if (!card || card === true) return cache(_mats, 'pkback', function () {
      return new T.MeshStandardMaterial({ roughness: 0.6, map: cachedTex('pkback', 64, 96, function (g, w, h) {
        g.fillStyle = '#f3e9d2'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#7a1f2b'; g.fillRect(4, 4, w - 8, h - 8);
        g.strokeStyle = '#d9a84a'; g.lineWidth = 2; g.strokeRect(8, 8, w - 16, h - 16);
        g.strokeStyle = 'rgba(217,168,74,0.45)'; g.lineWidth = 1;
        for (var k = -h; k < w + h; k += 8) { g.beginPath(); g.moveTo(k, 8); g.lineTo(k + 40, 88); g.stroke(); }
      }) });
    });
    return cache(_mats, 'pkcard|' + card.r + '|' + card.s, function () {
      var red = card.s === 1 || card.s === 2;
      return new T.MeshStandardMaterial({ roughness: 0.6, map: cachedTex('pkcard|' + card.r + '|' + card.s, 64, 96, function (g, w, h) {
        g.fillStyle = '#f6f0e0'; g.fillRect(0, 0, w, h);
        g.strokeStyle = '#8a7a5a'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);
        g.fillStyle = red ? '#c4262e' : '#15171a'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = 'bold 30px Arial'; g.fillText(PK_RANKS[card.r], w / 2, 30);
        g.font = '36px Arial'; g.fillText(PK_SUITS[card.s], w / 2, 68);
      }) });
    });
  }
  /**
   * makePokerTable(opts) -> Group  (~3,400 tris with stools, ~16 draw calls)
   * Oval table 2.64 x 1.56 m, felt at 0.86 m. Six stools on the +Z half; the croupier stands
   * at local (0, 0, -1.0) facing +Z (a cut-out in the rail holds the chip tray).
   * opts: { color (felt tint, unused by the printed felt), stools:true, blob }
   * api: seats [{x,z,rotY}], feltHeight,
   *      setBoard(cards)   community cards (0-5) face up; cards are {r:1..13, s:0..3}
   *      setHole(i, v)     seat i: false = no cards, true/n = 1-2 face-down cards, [c1,c2] = face up
   *      setPot(amount)    chip pile in the middle (0 hides it)
   *      setButton(i)      dealer button in front of seat i (-1 hides it)
   *      clear()
   */
  function makePokerTable(opts) {
    opts = opts || {};
    var g = new T.Group(), RX = 1.32, RZ = 0.78, H = 0.86;
    var ang = function (i) { return PI * (0.06 + i * 0.176); };
    var chipCols = [0xd4423f, 0x2a6fd6, 0x1d8a4e, 0x15171a, 0xf3e9d2, 0xd9a84a];
    inst(cachedParts('poker', function (k) {
      k.add(cylG(1, 1, 0.1, 32), MAT.woodDark, 0, H - 0.06, 0, 0, 0, 0, RX, 1, RZ);              // table top
      k.add(cylG(0.96, 0.9, 0.16, 32), MAT.woodDark, 0, H - 0.18, 0, 0, 0, 0, RX, 1, RZ);         // apron
      k.add(cylG(0.18, 0.26, 0.6, 12), MAT.woodDark, -0.55, 0.36, 0);                             // two pedestals
      k.add(cylG(0.18, 0.26, 0.6, 12), MAT.woodDark, 0.55, 0.36, 0);
      k.add(rbox(1.5, 0.06, 0.5, 0.02), MAT.black, 0, 0.03, 0);                                    // foot
      k.add(torG(1, 0.075, 6, 40), MAT.padding, 0, H + 0.01, 0, PI / 2, 0, 0, RX, RZ, 1.2);        // padded rail
      k.add(torG(0.9, 0.01, 4, 40), MAT.brass, 0, H + 0.003, 0, PI / 2, 0, 0, RX, RZ, 1);         // brass inlay
      // croupier chip tray (sits in the rail on the -Z side) and the deck
      k.add(rbox(0.5, 0.05, 0.14, 0.01), MAT.black, 0, H + 0.02, -0.62);
      for (var c = 0; c < 6; c++) k.add(chipG(0.026, 0.1), chipMat(chipCols[c]), -0.19 + c * 0.076, H + 0.05, -0.62, PI / 2, 0, 0);
      k.add(boxG(0.07, 0.04, 0.1), pkCardMat(true), 0.38, H + 0.02, -0.5, 0, 0.2, 0);
      // a chip stack in front of every seat
      for (var i = 0; i < 6; i++) {
        var a = ang(i), x = Math.cos(a) * RX * 0.8, z = Math.sin(a) * RZ * 0.8, tx = -Math.sin(a) * 0.07, tz = Math.cos(a) * 0.07;
        var n1 = 3 + (i * 7) % 4, n2 = 2 + (i * 5) % 3;
        for (var s1 = 0; s1 < n1; s1++) k.add(chipG(0.026, 0.011), chipMat(chipCols[(i + s1 % 2) % 6]), x + tx, H + 0.006 + s1 * 0.012, z + tz);
        for (var s2 = 0; s2 < n2; s2++) k.add(chipG(0.026, 0.011), chipMat(chipCols[(i + 2) % 6]), x - tx, H + 0.006 + s2 * 0.012, z - tz);
      }
    }), g);
    var felt = new T.Mesh(cache(_geos, 'pkfelt', function () { return new T.CircleGeometry(1, 40); }),
      cache(_mats, 'pkfeltmat', function () { return new T.MeshStandardMaterial({ map: feltPokerTex(RX, RZ), roughness: 0.95 }); }));
    felt.rotation.x = -PI / 2; felt.scale.set(RX * 0.93, RZ * 0.93, 1); felt.position.y = H - 0.005; g.add(felt);
    // dynamic pieces: cards, pot chips, dealer button
    var cardGeo = cache(_geos, 'pkcardg', function () { return new T.PlaneGeometry(0.075, 0.105); });
    var mkCard = function (x, z, ry) { var m = new T.Mesh(cardGeo, pkCardMat(true)); m.rotation.set(-PI / 2, 0, ry || 0); m.position.set(x, H + 0.004, z); m.visible = false; g.add(m); return m; };
    var board = [];
    for (var b = 0; b < 5; b++) board.push(mkCard((2 - b) * 0.115, -0.08, PI)); // readable from the croupier: first card on his left
    var holes = [];
    for (var j = 0; j < 6; j++) {
      var aj = ang(j), hx = Math.cos(aj) * RX * 0.6, hz = Math.sin(aj) * RZ * 0.6, ry = Math.atan2(hx, hz), ox = Math.cos(ry) * 0.045, oz = -Math.sin(ry) * 0.045;
      holes.push([mkCard(hx - ox, hz - oz, ry + 0.12), mkCard(hx + ox, hz + oz, ry - 0.12)]);
      holes[j][1].position.y += 0.001;
    }
    var pot = [], potGeo = chipG(0.028, 0.011);
    for (var p = 0; p < 18; p++) {
      var st = p % 3, m = new T.Mesh(potGeo, chipMat(chipCols[(p * 5) % 6]));
      m.position.set(-0.06 + st * 0.06 + (st === 1 ? 0 : 0.0), H + 0.006 + Math.floor(p / 3) * 0.012, 0.16 + (st === 1 ? 0.05 : 0));
      m.visible = false; g.add(m); pot.push(m);
    }
    var dbtn = new T.Mesh(cylG(0.035, 0.035, 0.012, 14), MAT.ivory); dbtn.visible = false; g.add(dbtn);
    var seats = [];
    if (opts.stools !== false) {
      for (var i2 = 0; i2 < 6; i2++) {
        var a2 = ang(i2), sx = Math.cos(a2) * 1.78, sz = Math.sin(a2) * 1.22;
        seats.push({ x: sx, z: sz, rotY: Math.atan2(-sx, -sz) });
      }
      addStools(g, 'poker', seats.map(function (s) { return [s.x, s.z]; }), 0.72, opts);
    }
    addBlob(g, 3.2, 2.2, opts);
    var api = {
      seats: seats, feltHeight: H,
      setBoard: function (cards) { for (var i = 0; i < 5; i++) { var c = cards && cards[i]; board[i].visible = !!c; if (c) board[i].material = pkCardMat(c); } },
      setHole: function (i, v) {
        var h = holes[i]; if (!h) return;
        for (var k = 0; k < 2; k++) {
          var show = Array.isArray(v) ? !!v[k] : v === true ? true : typeof v === 'number' ? k < v : false;
          h[k].visible = show; if (show) h[k].material = pkCardMat(Array.isArray(v) ? v[k] : true);
        }
      },
      setPot: function (amount) { var n = amount > 0 ? Math.min(18, 2 + Math.round(Math.log(amount / 25 + 1) * 2.2)) : 0; for (var i = 0; i < 18; i++) pot[i].visible = i < n; },
      setButton: function (i) {
        if (i == null || i < 0 || i > 5) { dbtn.visible = false; return; }
        var a = ang(i) + 0.17; dbtn.position.set(Math.cos(a) * RX * 0.7, H + 0.007, Math.sin(a) * RZ * 0.7); dbtn.visible = true;
      },
      clear: function () { api.setBoard([]); for (var i = 0; i < 6; i++) api.setHole(i, false); api.setPot(0); },
    };
    return finish(g, api, 'PokerTable');
  }

  // ==================================================================
  // ROULETTE
  // ==================================================================
  var WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  var REDS = { 1: 1, 3: 1, 5: 1, 7: 1, 9: 1, 12: 1, 14: 1, 16: 1, 18: 1, 19: 1, 21: 1, 23: 1, 25: 1, 27: 1, 30: 1, 32: 1, 34: 1, 36: 1 };
  function rotorTex() {
    return cachedTex('rotor', 512, 512, function (g, w, h) {
      var c = w / 2, n = 37, da = TAU / n;
      g.fillStyle = '#3a2412'; g.fillRect(0, 0, w, h);
      for (var i = 0; i < n; i++) {
        var num = WHEEL[i];
        g.fillStyle = num === 0 ? '#1b8a4a' : REDS[num] ? '#c0262c' : '#141414';
        g.beginPath(); g.moveTo(c, c); g.arc(c, c, 254, i * da, (i + 1) * da); g.closePath(); g.fill();
        g.save(); g.translate(c, c); g.rotate((i + 0.5) * da + PI / 2);
        g.fillStyle = '#f3e9d2'; g.font = 'bold 22px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(num), 0, -228); g.restore();
      }
      g.strokeStyle = '#d9a84a'; g.lineWidth = 3;
      for (var j = 0; j < n; j++) { g.beginPath(); g.moveTo(c + Math.cos(j * da) * 150, c + Math.sin(j * da) * 150); g.lineTo(c + Math.cos(j * da) * 254, c + Math.sin(j * da) * 254); g.stroke(); }
      g.beginPath(); g.arc(c, c, 205, 0, TAU); g.stroke();
      var gr = g.createRadialGradient(c, c, 10, c, c, 150); gr.addColorStop(0, '#7a5428'); gr.addColorStop(1, '#3a2412');
      g.fillStyle = gr; g.beginPath(); g.arc(c, c, 150, 0, TAU); g.fill();
      g.strokeStyle = '#d9a84a'; g.lineWidth = 6; g.beginPath(); g.arc(c, c, 150, 0, TAU); g.stroke();
    });
  }
  function rouletteLayoutTex() {
    return cachedTex('roulayout', 1024, 512, function (g, w, h) {
      g.fillStyle = '#145238'; g.fillRect(0, 0, w, h); noise(g, w, h, 0, 4000, 'rgba(0,0,0,0.12)');
      var x0 = 120, y0 = 60, cw = 62, ch = 80;
      g.strokeStyle = '#f3e9d2'; g.lineWidth = 3; g.textAlign = 'center'; g.textBaseline = 'middle';
      // zero
      g.fillStyle = '#1b8a4a'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 - 60, y0 + ch * 1.5); g.lineTo(x0, y0 + ch * 3); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#f3e9d2'; g.font = 'bold 30px Georgia'; g.fillText('0', x0 - 24, y0 + ch * 1.5);
      for (var n = 1; n <= 36; n++) {
        var col = Math.floor((n - 1) / 3), row = 2 - ((n - 1) % 3), x = x0 + col * cw, y = y0 + row * ch;
        g.strokeRect(x, y, cw, ch);
        g.fillStyle = REDS[n] ? '#c0262c' : '#141414';
        g.beginPath(); g.ellipse(x + cw / 2, y + ch / 2, 22, 26, 0, 0, TAU); g.fill();
        g.fillStyle = '#f3e9d2'; g.font = 'bold 24px Georgia'; g.fillText(String(n), x + cw / 2, y + ch / 2 + 1);
      }
      for (var r = 0; r < 3; r++) { g.strokeRect(x0 + 12 * cw, y0 + r * ch, 70, ch); g.font = 'bold 18px Arial'; g.fillText('2:1', x0 + 12 * cw + 35, y0 + r * ch + ch / 2); }
      var yb = y0 + 3 * ch, labels = ['1ª 12', '2ª 12', '3ª 12'];
      for (var d = 0; d < 3; d++) { g.strokeRect(x0 + d * 4 * cw, yb, 4 * cw, 60); g.font = 'bold 26px Georgia'; g.fillText(labels[d], x0 + d * 4 * cw + 2 * cw, yb + 30); }
      var outs = ['1-18', 'PAR', '', '', 'IMPAR', '19-36'];
      for (var o = 0; o < 6; o++) {
        var ox = x0 + o * 2 * cw; g.strokeRect(ox, yb + 60, 2 * cw, 60);
        if (o === 2 || o === 3) { g.fillStyle = o === 2 ? '#c0262c' : '#141414'; g.beginPath(); g.moveTo(ox + cw, yb + 70); g.lineTo(ox + cw + 36, yb + 90); g.lineTo(ox + cw, yb + 110); g.lineTo(ox + cw - 36, yb + 90); g.closePath(); g.fill(); g.fillStyle = '#f3e9d2'; }
        else { g.font = 'bold 22px Georgia'; g.fillText(outs[o], ox + cw, yb + 90); }
      }
      g.strokeStyle = '#d9a84a'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
    });
  }
  /**
   * makeRouletteTable(opts) -> Group  (~3,000 tris, ~14 draw calls)
   * 2.9 x 1.4 m table, felt at 0.84 m. Wheel at local x=-0.95; players on +Z.
   * Croupier stands at local (-0.95, 0, -1.0) facing +Z.
   * api: spin(onResult?, power?) — starts a spin (power 0..1 sets ball strength, optional); onResult(number, color) when the ball settles.
   *      update(dt), spinning (bool), result (number|null)
   */
  function makeRouletteTable(opts) {
    opts = opts || {};
    var g = new T.Group(), H = 0.84, WX = -0.95;
    inst(cachedParts('roulette', function (k) {
      k.add(rbox(2.8, 0.7, 1.3, 0.06, 2), MAT.woodDark, 0, 0.45, 0);
      k.add(rbox(2.6, 0.1, 1.1, 0.02), MAT.black, 0, 0.05, 0);
      // padded rail
      k.add(rbox(2.94, 0.08, 0.12, 0.04, 2), MAT.padding, 0, H, 0.66);
      k.add(rbox(2.94, 0.08, 0.12, 0.04, 2), MAT.padding, 0, H, -0.66);
      k.add(rbox(0.12, 0.08, 1.44, 0.04, 2), MAT.padding, 1.41, H, 0);
      k.add(rbox(0.12, 0.08, 1.44, 0.04, 2), MAT.padding, -1.41, H, 0);
      k.add(rbox(2.8, 0.015, 0.02, 0.005), MAT.brass, 0, H - 0.03, 0.73);
      // wheel housing
      k.add(cylG(0.5, 0.52, 0.14, 28), MAT.wood, WX, H + 0.05, 0);
      k.add(torG(0.49, 0.025, 4, 28), MAT.brass, WX, H + 0.12, 0, PI / 2);
      var pts = [new T.Vector2(0.46, 0.13), new T.Vector2(0.42, 0.12), new T.Vector2(0.37, 0.085), new T.Vector2(0.33, 0.06)];
      k.add(new T.LatheGeometry(pts, 28), MAT.woodDark, WX, H, 0);
      // chips near layout
      var cc = [0xd4423f, 0x2a6fd6, 0x1d8a4e, 0xd9a84a];
      for (var i = 0; i < 4; i++) for (var s = 0; s < 3 + i; s++) k.add(chipG(0.026, 0.01), chipMat(cc[i]), 1.0 + (i % 2) * 0.07, H + 0.005 + s * 0.011, -0.45 + Math.floor(i / 2) * 0.07);
      // marker dolly
      k.add(cylG(0.02, 0.025, 0.08, 8), MAT.chrome, 0.2, H + 0.04, 0.05);
    }), g);
    // felt
    var feltTop = new T.Mesh(planeG(1.7, 0.85), cache(_mats, 'roufelt', function () { return new T.MeshStandardMaterial({ map: rouletteLayoutTex(), roughness: 0.95 }); }));
    feltTop.rotation.x = -PI / 2; feltTop.position.set(0.38, H - 0.004, 0.05); g.add(feltTop);
    var feltFill = new T.Mesh(planeG(2.72, 1.22), MAT.feltGreen); feltFill.rotation.x = -PI / 2; feltFill.position.set(0, H - 0.008, 0); g.add(feltFill);
    // rotor
    var rotor = new T.Group(); rotor.position.set(WX, H + 0.06, 0); g.add(rotor);
    var disk = new T.Mesh(cache(_geos, 'rotordisk', function () { return new T.CircleGeometry(0.33, 37); }),
      cache(_mats, 'rotormat', function () { return new T.MeshStandardMaterial({ map: rotorTex(), roughness: 0.4 }); }));
    disk.rotation.x = -PI / 2; disk.position.y = 0.001; rotor.add(disk);
    rotor.add(new T.Mesh(cache(_geos, 'turret', function () {
      return mergeGeos([{ geo: cylG(0.02, 0.07, 0.07, 12), m: mtx(0, 0.035, 0) }, { geo: cylG(0.012, 0.012, 0.12, 8), m: mtx(0, 0.1, 0) },
        { geo: cylG(0.008, 0.008, 0.22, 6), m: mtx(0, 0.14, 0, 0, 0, PI / 2) }, { geo: cylG(0.008, 0.008, 0.22, 6), m: mtx(0, 0.14, 0, PI / 2) },
        { geo: sphG(0.016, 8, 6), m: mtx(0.11, 0.14, 0) }, { geo: sphG(0.016, 8, 6), m: mtx(-0.11, 0.14, 0) },
        { geo: sphG(0.016, 8, 6), m: mtx(0, 0.14, 0.11) }, { geo: sphG(0.016, 8, 6), m: mtx(0, 0.14, -0.11) }, { geo: sphG(0.022, 8, 6), m: mtx(0, 0.18, 0) }]);
    }), MAT.brass));
    var ball = new T.Mesh(sphG(0.014, 10, 8), std(0xffffff, 0.2, 0, 0x444444)); g.add(ball);
    var rotA = 0, rotV = 0.6, ballA = 0, ballV = 0, ballR = 0.4, phase = 'idle', relA = 0, cb = null;
    function placeBall() {
      var y = phase === 'orbit' ? H + 0.105 : H + 0.075 - (0.4 - ballR) * 0.15;
      ball.position.set(WX + Math.cos(ballA) * ballR, y, Math.sin(ballA) * ballR);
    }
    var api = {
      spinning: false, result: null, rotor: rotor,
      spin: function (onResult, power) { cb = onResult || null; rotV = 5 + Math.random() * 2; ballV = -(power != null ? 9 + power * 6 + Math.random() : 11 + Math.random() * 3); ballR = 0.41; phase = 'orbit'; api.spinning = true; api.result = null; },
      update: function (dt) {
        rotA += rotV * dt; rotor.rotation.y = rotA;
        if (phase === 'orbit') {
          ballA += ballV * dt; ballV *= Math.exp(-0.45 * dt); rotV = Math.max(0.6, rotV * Math.exp(-0.18 * dt));
          if (Math.abs(ballV) < 2.6) { phase = 'drop'; relA = ballA + rotA; }
        } else if (phase === 'drop' || phase === 'idle') {
          if (phase === 'drop') { ballR += (0.255 - ballR) * Math.min(1, dt * 3); rotV = Math.max(0.6, rotV * Math.exp(-0.5 * dt)); }
          // ball rides with the rotor: world angle phi = canvasAngle - rotA
          var da = TAU / 37, idx = Math.floor((((relA % TAU) + TAU) % TAU) / da);
          var target = (idx + 0.5) * da; relA += (target - (((relA % TAU) + TAU) % TAU)) * Math.min(1, dt * 4);
          ballA = relA - rotA;
          if (phase === 'drop' && Math.abs(ballR - 0.255) < 0.004) {
            phase = 'idle'; api.spinning = false; api.result = WHEEL[idx];
            if (cb) cb(api.result, api.result === 0 ? 'green' : REDS[api.result] ? 'red' : 'black');
          }
        }
        placeBall();
      },
    };
    phase = 'idle'; ballR = 0.255; relA = 0.3; placeBall();
    addBlob(g, 3.4, 2.0, opts);
    return finish(g, api, 'RouletteTable');
  }

  // ==================================================================
  // BAR
  // ==================================================================
  function barSignTex() {
    return cachedTex('barsign', 256, 96, function (g, w, h) {
      g.fillStyle = '#07140f'; g.fillRect(0, 0, w, h);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'italic bold 58px Georgia, serif';
      g.shadowColor = '#ff6a8a'; g.shadowBlur = 18; g.fillStyle = '#ffd0dc'; g.fillText('Bar', w / 2, h / 2 + 2);
      g.shadowBlur = 0; g.strokeStyle = '#d9a84a'; g.lineWidth = 3; g.strokeRect(5, 5, w - 10, h - 10);
    });
  }
  /**
   * makeBar(opts) -> Group  (~4,500 tris incl. 4 stools, ~16 draw calls)
   * Counter 4 m wide (x[-2,2]) centred at z=0, depth 0.7, height 1.08.
   * Back bar with bottles and mirror at z=-1.25. Customers on +Z side.
   * opts: { width:4, stools:4, blob }  api.seats [{x,z}], api.bartenderSpot {x,z}
   */
  function makeBar(opts) {
    opts = opts || {}; var W = opts.width || 4, nSt = opts.stools == null ? 4 : opts.stools;
    var g = new T.Group();
    inst(cachedParts('bar|' + W, function (k) {
      k.add(rbox(W, 1.0, 0.6, 0.04, 2), MAT.woodDark, 0, 0.5, 0);
      for (var i = 0; i < Math.round(W / 0.5); i++) k.add(rbox(0.4, 0.62, 0.02, 0.01), MAT.wood, -W / 2 + 0.25 + i * 0.5, 0.52, 0.305);
      k.add(rbox(W + 0.12, 0.06, 0.78, 0.025, 2), MAT.marble, 0, 1.05, 0.03);            // top
      k.add(rbox(W + 0.14, 0.03, 0.04, 0.012), MAT.brass, 0, 1.0, 0.43);
      k.add(cylG(0.025, 0.025, W, 8), MAT.brass, 0, 0.2, 0.42, 0, 0, PI / 2);          // foot rail
      for (var j = 0; j < 5; j++) k.add(cylG(0.012, 0.012, 0.1, 6), MAT.brass, -W / 2 + 0.2 + j * (W - 0.4) / 4, 0.2, 0.36, PI / 2);
      k.add(rbox(W, 0.08, 0.5, 0.01), MAT.black, 0, 0.04, 0.0);
      // back bar
      k.add(rbox(W, 0.9, 0.5, 0.03), MAT.woodDark, 0, 0.45, -1.3);
      k.add(rbox(W + 0.1, 0.04, 0.56, 0.015), MAT.marble, 0, 0.92, -1.3);
      k.add(rbox(W, 1.6, 0.06, 0.02), MAT.woodDark, 0, 1.75, -1.55);
      k.add(planeG(W - 0.3, 1.2), std(0x24324a, 0.08, 0.6, 0x0a1220), 0, 1.65, -1.515);  // mirror
      for (var s = 0; s < 2; s++) { k.add(rbox(W - 0.1, 0.03, 0.22, 0.01), MAT.wood, 0, 1.3 + s * 0.45, -1.43); k.add(rbox(W - 0.1, 0.01, 0.01, 0.003), MAT.brass, 0, 1.31 + s * 0.45, -1.32); }
      k.add(rbox(W + 0.1, 0.12, 0.3, 0.02), MAT.woodDark, 0, 2.6, -1.42);
      // bottles
      var glass = [std(0x6b3a10, 0.15, 0.1, 0x200e02), std(0x1e5a2a, 0.15, 0.1, 0x061a0a), std(0xc8d4d0, 0.1, 0.1, 0x202424), std(0x7a1020, 0.15, 0.1, 0x200408), std(0x2a4a8a, 0.15, 0.1, 0x081830)];
      var nb = Math.round((W - 0.3) / 0.13);
      for (var sh = 0; sh < 3; sh++) for (var b = 0; b < nb; b++) {
        var x = -W / 2 + 0.2 + b * 0.13 + (sh % 2) * 0.05, y = sh === 0 ? 0.94 : 1.315 + (sh - 1) * 0.45, mat = glass[(b * 7 + sh * 3) % 5];
        var tall = 0.18 + ((b * 13 + sh) % 3) * 0.04;
        k.add(cylG(0.035, 0.035, tall, 6), mat, x, y + tall / 2, -1.4);
        k.add(cylG(0.012, 0.03, 0.08, 6), mat, x, y + tall + 0.04, -1.4);
        if (sh === 0) k.add(boxG(0.05, 0.05, 0.002), MAT.ivory, x, y + tall * 0.45, -1.364);
      }
      // glasses, taps and register on counter
      k.add(rbox(0.3, 0.3, 0.1, 0.02), MAT.chrome, 0.6, 1.23, -0.12);
      for (var tp = 0; tp < 3; tp++) k.add(cylG(0.015, 0.015, 0.18, 6), MAT.brass, 0.5 + tp * 0.1, 1.3, -0.02);
      for (var gl = 0; gl < 4; gl++) k.add(cylG(0.035, 0.028, 0.1, 8), std(0xbfd8e0, 0.05, 0.2, 0x1a2628), -1.4 + gl * 0.12, 1.13, 0.15);
      k.add(rbox(0.36, 0.2, 0.3, 0.03), MAT.black, -0.6, 1.18, -0.15);
      k.add(planeG(0.26, 0.1), basic(0x5affa0), -0.6, 1.24, 0.001 + 0.0);
    }), g);
    var sign = makeNeonSign({ text: 'Bar', color: 0xff4f8a, color2: 0xffc24a, w: 1.9, h: 0.62, icons: ['cocktail'], flicker: false }); sign.position.set(0, 2.62, -1.27); g.add(sign);
    var wash = regFx(new T.Mesh(planeG(W - 0.2, 1.5), glowMat(0xffa860, 0.4))); wash.position.set(0, 1.6, -1.48); wash.renderOrder = 3; g.add(wash);  // luz detrás de las botellas
    var seats = [];
    for (var i = 0; i < nSt; i++) {
      var x = -W / 2 + W / (nSt + 1) * (i + 1);
      seats.push({ x: x, z: 0.75 });
    }
    if (nSt) addStools(g, 'bar|' + W + '|' + nSt, seats.map(function (s) { return [s.x, s.z]; }), 0.76, opts);
    addBlob(g, W + 0.6, 1.2, opts);
    return finish(g, { seats: seats, bartenderSpot: { x: 0, z: -0.65 } }, 'Bar');
  }

  // ==================================================================
  // CASHIER CAGE
  // ==================================================================
  function cajaTex() {
    return cachedTex('caja', 512, 96, function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0f2b22'); gr.addColorStop(1, '#07140f');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 52px Georgia, serif';
      g.fillStyle = '#f6c766'; g.shadowColor = '#ffb84a'; g.shadowBlur = 14; g.fillText('CAJA · FICHAS', w / 2, h / 2 + 3);
      g.shadowBlur = 0; g.strokeStyle = '#d9a84a'; g.lineWidth = 5; g.strokeRect(6, 6, w - 12, h - 12);
    });
  }
  /**
   * makeCashierCage(opts) -> Group  (~3,000 tris, ~9 draw calls)
   * 3.2 m wide, counter at 1.1 m, brass bars to 2.45 m, a service window centred at x=0.
   * Customers on +Z, cashier stands at (0, 0, -0.7).
   * opts: { width:3.2, blob }  api.cashierSpot, api.windowSpot
   */
  function makeCashierCage(opts) {
    opts = opts || {}; var W = opts.width || 3.2;
    var g = new T.Group();
    inst(cachedParts('cage|' + W, function (k) {
      k.add(rbox(W, 1.06, 0.55, 0.03, 2), MAT.woodDark, 0, 0.53, 0);
      for (var i = 0; i < Math.round(W / 0.8); i++) k.add(rbox(0.66, 0.7, 0.02, 0.01), MAT.wood, -W / 2 + 0.4 + i * 0.8, 0.55, 0.28);
      k.add(rbox(W + 0.1, 0.06, 0.66, 0.02), MAT.marble, 0, 1.09, 0.03);
      k.add(rbox(W + 0.1, 0.24, 0.12, 0.02), MAT.woodDark, 0, 2.55, 0.0);
      k.add(rbox(W + 0.14, 0.03, 0.14, 0.01), MAT.brass, 0, 2.42, 0.0);
      k.add(rbox(W + 0.14, 0.03, 0.14, 0.01), MAT.brass, 0, 1.135, 0.0);
      // bars except a window opening |x|<0.4 below 1.75
      for (var x = -W / 2 + 0.06; x <= W / 2 - 0.05; x += 0.1) {
        if (Math.abs(x) < 0.42) { k.add(cylG(0.009, 0.009, 0.65, 6), MAT.brass, x, 2.08, 0.0); continue; }
        k.add(cylG(0.009, 0.009, 1.27, 6), MAT.brass, x, 1.78, 0.0);
      }
      k.add(rbox(0.9, 0.04, 0.06, 0.01), MAT.brass, 0, 1.75, 0.0);
      k.add(rbox(0.04, 0.62, 0.06, 0.01), MAT.brass, -0.44, 1.44, 0.0);
      k.add(rbox(0.04, 0.62, 0.06, 0.01), MAT.brass, 0.44, 1.44, 0.0);
      k.add(rbox(0.8, 0.03, 0.3, 0.01), MAT.marble, 0, 1.13, 0.22);
      // side walls + back wall
      k.add(rbox(0.08, 2.65, 1.6, 0.02), MAT.woodDark, -W / 2 - 0.04, 1.32, -0.75);
      k.add(rbox(0.08, 2.65, 1.6, 0.02), MAT.woodDark, W / 2 + 0.04, 1.32, -0.75);
      k.add(rbox(W + 0.16, 2.65, 0.08, 0.02), std(0x2a1a12, 0.8), 0, 1.32, -1.55);
      // safe and cash
      k.add(rbox(0.7, 0.9, 0.5, 0.03, 2), std(0x2c3238, 0.35, 0.4), W / 2 - 0.6, 0.45, -1.2);
      k.add(cylG(0.08, 0.08, 0.03, 12), MAT.chrome, W / 2 - 0.6, 0.55, -0.94, PI / 2);
      k.add(rbox(1.2, 0.04, 0.4, 0.01), MAT.wood, -0.6, 1.2, -1.3);
      var bill = std(0x3f8a4a, 0.8);
      for (var s = 0; s < 6; s++) k.add(boxG(0.16, 0.04 + (s % 3) * 0.02, 0.08), bill, -1.05 + s * 0.18, 1.24 + (s % 3) * 0.01, -1.3);
      var cc = [0xd4423f, 0x2a6fd6, 0x15171a, 0xd9a84a];
      for (var t = 0; t < 4; t++) for (var h = 0; h < 6; h++) k.add(chipG(0.026, 0.01), chipMat(cc[t]), -0.25 + t * 0.07, 1.125 + h * 0.011, -0.12);
    }), g);
    var sign = new T.Mesh(planeG(1.8, 0.34), new T.MeshBasicMaterial({ map: cajaTex() })); sign.position.set(0, 2.55, 0.065); g.add(sign);
    addBlob(g, W + 0.6, 2.0, opts);
    return finish(g, { cashierSpot: { x: 0, z: -0.7 }, windowSpot: { x: 0, z: 0.75 } }, 'CashierCage');
  }

  // ==================================================================
  // PLANT
  // ==================================================================
  /**
   * makePlant(opts) -> Group  (palm ~700 tris / bush ~500 tris, 3-4 draw calls)
   * opts: { kind:'palm'|'bush', scale:1, blob }
   */
  function makePlant(opts) {
    opts = opts || {}; var kind = opts.kind || 'palm';
    var g = new T.Group();
    var leaf = std(0x2f7a3a, 0.75, 0, 0x061206), leaf2 = std(0x3f9a48, 0.75, 0, 0x081a08);
    inst(cachedParts('plant|' + kind, function (k) {
      var pts = [new T.Vector2(0.001, 0), new T.Vector2(0.17, 0), new T.Vector2(0.2, 0.05), new T.Vector2(0.24, 0.42), new T.Vector2(0.27, 0.46), new T.Vector2(0.25, 0.48)];
      k.add(new T.LatheGeometry(pts, 10), MAT.brass, 0, 0, 0);
      k.add(cylG(0.235, 0.235, 0.02, 10), std(0x2a1a10, 1), 0, 0.44, 0);
      if (kind === 'palm') {
        k.add(cylG(0.035, 0.05, 0.9, 6), std(0x6a4a2a, 0.9), 0, 0.88, 0, 0.05, 0, 0.04);
        k.add(cylG(0.03, 0.035, 0.5, 6), std(0x6a4a2a, 0.9), 0.04, 0.75, 0.02, -0.3, 0, -0.25);
        var n = 9;
        for (var i = 0; i < n; i++) {
          var a = i / n * TAU, droop = 0.9 + (i % 3) * 0.25, len = 0.75 + (i % 2) * 0.15;
          var m = new T.Matrix4().makeRotationY(a).multiply(new T.Matrix4().makeRotationX(droop)).multiply(mtx(0, len / 2, 0, 0, 0, 0, 1, 1, 0.18));
          m.premultiply(new T.Matrix4().makeTranslation(0, 1.32, 0));
          k.addM(new T.ConeGeometry(0.12, len, 4), i % 2 ? leaf : leaf2, m);
        }
        for (var j = 0; j < 4; j++) {
          var a2 = j / 4 * TAU + 0.4, m2 = new T.Matrix4().makeRotationY(a2).multiply(new T.Matrix4().makeRotationX(1.0)).multiply(mtx(0, 0.25, 0, 0, 0, 0, 1, 1, 0.18));
          m2.premultiply(new T.Matrix4().makeTranslation(0.04, 0.95, 0.02));
          k.addM(new T.ConeGeometry(0.09, 0.5, 4), leaf2, m2);
        }
      } else {
        var blobs = [[0, 0.75, 0, 0.32], [0.18, 0.62, 0.08, 0.22], [-0.16, 0.66, -0.06, 0.24], [0.05, 0.98, -0.05, 0.22], [-0.05, 0.62, 0.18, 0.2]];
        blobs.forEach(function (b, i) { k.add(new T.IcosahedronGeometry(b[3], 1), i % 2 ? leaf : leaf2, b[0], b[1], b[2], i, i * 0.7, 0); });
      }
    }), g);
    var s = opts.scale || 1; g.scale.setScalar(s);
    addBlob(g, 0.8, 0.8, opts);
    return finish(g, null, 'Plant');
  }

  // ==================================================================
  // CHANDELIER
  // ==================================================================
  /**
   * makeChandelier(opts) -> Group  (~1,800 tris, 3 draw calls + optional light)
   * Origin = ceiling hook; hangs ~1.1 m down. Diameter 1.2 m.
   * opts: { light:false, intensity:0.9, distance:12, color:0xffd9a0 }
   * api: update(dt) (gentle twinkle), light (PointLight|null)
   */
  function makeChandelier(opts) {
    opts = opts || {};
    var g = new T.Group();
    var crystal = cache(_mats, 'crystal', function () { return new T.MeshStandardMaterial({ color: 0xfff6e8, roughness: 0.1, metalness: 0.2, emissive: 0x6a5a40, flatShading: true }); });
    var flameMat = new T.MeshBasicMaterial({ color: 0xffe2a0 });
    var meshes = inst(cachedParts('chandelier', function (k) {
      k.add(cylG(0.12, 0.08, 0.05, 12), MAT.brass, 0, -0.025, 0);
      k.add(cylG(0.012, 0.012, 0.4, 6), MAT.brass, 0, -0.25, 0);
      k.add(sphG(0.07, 10, 8), MAT.brass, 0, -0.48, 0);
      k.add(cylG(0.03, 0.09, 0.25, 10), MAT.brass, 0, -0.65, 0);
      k.add(torG(0.55, 0.02, 5, 32), MAT.brass, 0, -0.78, 0, PI / 2);
      k.add(torG(0.32, 0.018, 5, 24), MAT.brass, 0, -0.62, 0, PI / 2);
      k.add(sphG(0.06, 10, 8), MAT.brass, 0, -0.85, 0);
      var n = 8;
      for (var i = 0; i < n; i++) {
        var a = i / n * TAU, c = Math.cos(a), s = Math.sin(a);
        k.add(cylG(0.01, 0.01, 0.55, 5), MAT.brass, c * 0.27, -0.75, s * 0.27, 0, -a, PI / 2 - 0.25);
        k.add(cylG(0.04, 0.02, 0.04, 8), MAT.brass, c * 0.55, -0.76, s * 0.55);
        k.add(cylG(0.014, 0.014, 0.1, 6), MAT.ivory, c * 0.55, -0.69, s * 0.55);
        k.add(sphG(0.032, 6, 5), 'FLAME', c * 0.55, -0.62, s * 0.55, 0, 0, 0, 1, 1.4, 1);
        for (var d = 0; d < 3; d++) {
          var a2 = a + (d - 1) * 0.13, r2 = 0.55 + (d === 1 ? 0 : -0.02);
          k.add(new T.OctahedronGeometry(0.03, 0), crystal, Math.cos(a2 + 0.39) * r2, -0.86 - (d === 1 ? 0.05 : 0), Math.sin(a2 + 0.39) * r2, 0, 0, 0, 1, 1.8, 1);
        }
        k.add(new T.OctahedronGeometry(0.025, 0), crystal, c * 0.32, -0.7, s * 0.32, 0, 0, 0, 1, 1.8, 1);
      }
      k.add(new T.OctahedronGeometry(0.06, 0), crystal, 0, -1.0, 0, 0, 0, 0, 1, 1.8, 1);
    }), g, { FLAME: flameMat });
    var glow = regFx(new T.Sprite(cache(_mats, 'chglow', function () { return new T.SpriteMaterial({ map: haloTex(), color: 0xffb860, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }); })));
    glow.scale.set(2.3, 1.7, 1); glow.position.y = -0.72; glow.renderOrder = 3; g.add(glow);
    var light = null;
    if (opts.light) { light = new T.PointLight(opts.color || 0xffd9a0, opts.intensity == null ? 0.9 : opts.intensity, opts.distance || 12, 1.6); light.position.y = -0.7; g.add(light); }
    var t = Math.random() * 10, base = light ? light.intensity : 0;
    var api = {
      light: light,
      update: function (dt) {
        t += dt; var f = 0.92 + 0.08 * Math.sin(t * 7.3) * Math.sin(t * 3.1);
        flameMat.color.setRGB(1, 0.89 * f, 0.63 * f);
        if (light) light.intensity = base * (0.96 + 0.04 * f);
      },
    };
    return finish(g, api, 'Chandelier');
  }

  // ==================================================================
  // NEONES Y LUZ FALSA (sin luces nuevas: planos aditivos que "brillan")
  // ==================================================================
  /** Degradé vertical: arriba una línea blanca (el tubo) y abajo el resplandor que se apaga. */
  function coveTex() {
    return cachedTex('cove', 4, 128, function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.035, '#ffffff'); gr.addColorStop(0.05, 'rgb(150,150,150)'); gr.addColorStop(0.25, 'rgb(60,60,60)'); gr.addColorStop(0.6, 'rgb(14,14,14)'); gr.addColorStop(1, '#000000');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
  }
  function rectGlowTex() {
    return cachedTex('rectglow', 256, 128, function (g, w, h) {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      g.shadowColor = '#fff'; g.shadowBlur = 16; g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 8;
      g.strokeRect(44, 40, w - 88, h - 80); g.strokeRect(44, 40, w - 88, h - 80);
    });
  }
  function additive(map, color, opacity, vc) {
    return new T.MeshBasicMaterial({ map: map, color: color == null ? 0xffffff : color, transparent: true, opacity: opacity == null ? 1 : opacity, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, vertexColors: !!vc });
  }
  /**
   * makeCoveLights(segs) -> Mesh (1 draw call para todos los tramos)
   * Tubo de neón corrido bajo el cielorraso con resplandor en la pared y en el techo.
   * segs: [{ x0, z0, x1, z1, nx, nz, color, top:3.5 }] — (nx,nz) = normal de la pared hacia adentro del salón.
   */
  function makeCoveLights(segs) {
    var list = [];
    segs.forEach(function (s) {
      var len = Math.hypot(s.x1 - s.x0, s.z1 - s.z0), cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2, top = s.top || 3.5, ry = Math.atan2(s.nx, s.nz);
      list.push({ geo: planeG(1, 1), color: s.color, m: mtx(cx + s.nx * 0.015, top - 0.55, cz + s.nz * 0.015, 0, ry, 0, len, 1.1, 1) });
      // en el techo: el mismo degradé, brillante junto a la pared
      var m = new T.Matrix4().makeTranslation(cx + s.nx * 0.55, top - 0.012, cz + s.nz * 0.55)
        .multiply(new T.Matrix4().makeRotationY(ry)).multiply(new T.Matrix4().makeRotationX(-PI / 2)).multiply(new T.Matrix4().makeScale(len, 1.1, 1));
      list.push({ geo: planeG(1, 1), color: new T.Color(s.color).multiplyScalar(0.9).getHex(), m: m });
    });
    var mat = additive(coveTex(), 0xffffff, 1, true); mat.side = T.DoubleSide;
    var mesh = new T.Mesh(mergeGeos(list, true), mat);
    mesh.renderOrder = 3; mesh.name = 'CoveLights';
    return mesh;
  }
  /** Dibuja trazos con aspecto de tubo de neón: resplandor del color + núcleo casi blanco. */
  function neonStroke(g, color, width, draw) {
    var core = '#' + new T.Color(color).lerp(new T.Color(0xffffff), 0.75).getHexString();
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.shadowColor = color; g.strokeStyle = color; g.fillStyle = color;
    g.shadowBlur = width * 4; g.lineWidth = width * 1.6; draw(); draw();
    g.shadowBlur = width * 1.5; g.lineWidth = width; draw();
    g.shadowBlur = 0; g.strokeStyle = core; g.lineWidth = width * 0.4; draw();
  }
  var NEON_ICONS = {
    star: function (g, x, y, r) { g.beginPath(); for (var i = 0; i < 10; i++) { var rr = i % 2 ? r * 0.42 : r, a = -PI / 2 + i * PI / 5; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.stroke(); },
    cocktail: function (g, x, y, r) { g.beginPath(); g.moveTo(x - r, y - r * 0.8); g.lineTo(x + r, y - r * 0.8); g.lineTo(x, y + r * 0.2); g.closePath(); g.moveTo(x, y + r * 0.2); g.lineTo(x, y + r); g.moveTo(x - r * 0.55, y + r); g.lineTo(x + r * 0.55, y + r); g.stroke(); g.beginPath(); g.arc(x + r * 0.55, y - r * 0.95, r * 0.22, 0, TAU); g.stroke(); },
    diamond: function (g, x, y, r) { g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * 0.75, y); g.lineTo(x, y + r); g.lineTo(x - r * 0.75, y); g.closePath(); g.stroke(); },
    heart: function (g, x, y, r) { g.beginPath(); g.moveTo(x, y + r * 0.9); g.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.6, y - r * 1.2, x, y - r * 0.4); g.bezierCurveTo(x + r * 0.6, y - r * 1.2, x + r * 1.4, y - r * 0.1, x, y + r * 0.9); g.stroke(); },
    cherry: function (g, x, y, r) { g.beginPath(); g.arc(x - r * 0.45, y + r * 0.45, r * 0.4, 0, TAU); g.stroke(); g.beginPath(); g.arc(x + r * 0.45, y + r * 0.55, r * 0.4, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(x - r * 0.45, y + r * 0.05); g.quadraticCurveTo(x - r * 0.1, y - r * 0.8, x + r * 0.3, y - r); g.moveTo(x + r * 0.45, y + r * 0.15); g.quadraticCurveTo(x + r * 0.4, y - r * 0.5, x + r * 0.3, y - r); g.stroke(); },
    arrow: function (g, x, y, r) { g.beginPath(); g.moveTo(x - r, y); g.lineTo(x + r, y); g.moveTo(x + r * 0.45, y - r * 0.5); g.lineTo(x + r, y); g.lineTo(x + r * 0.45, y + r * 0.5); g.stroke(); },
  };
  /**
   * makeNeonSign(opts) -> Group (2 draw calls: tubos + resplandor en la pared)
   * Cartel de neón plano para colgar en una pared (frente = +Z). Origen en el centro del cartel.
   * opts: { text:'JACKPOT', color:0xff3fa4, w:2.6, h:0.8, font:'italic bold', icons:['star', ...] (a los lados),
   *         color2 (íconos), flicker:true }
   * api: update(dt) — zumbido y algún parpadeo; setOn(bool)
   */
  function makeNeonSign(opts) {
    opts = opts || {};
    var W = opts.w || 2.6, H = opts.h || 0.8, color = opts.color == null ? 0xff3fa4 : opts.color, c2 = opts.color2 == null ? color : opts.color2;
    var cw = 512, ch = Math.max(64, Math.round(cw * H / W / 16) * 16), text = opts.text || '', icons = opts.icons || [];
    var tex = cachedTex('neon|' + text + '|' + color + '|' + c2 + '|' + W + '|' + H + '|' + icons.join(','), cw, ch, function (g, w, h) {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      var pad = icons.length ? h * 0.9 : h * 0.15, fs = Math.min(h * 0.62, (w - pad * 2) / Math.max(2, text.length) * 1.7);
      g.font = (opts.font || 'italic bold') + ' ' + Math.round(fs) + 'px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      neonStroke(g, hex(color), Math.max(3, fs * 0.075), function () { g.strokeText(text, w / 2, h / 2 + fs * 0.04); });
      if (opts.frame !== false) neonStroke(g, hex(c2), 3.5, function () { var r = h * 0.18; g.beginPath(); g.moveTo(10 + r, 10); g.arcTo(w - 10, 10, w - 10, h - 10, r); g.arcTo(w - 10, h - 10, 10, h - 10, r); g.arcTo(10, h - 10, 10, 10, r); g.arcTo(10, 10, w - 10, 10, r); g.closePath(); g.stroke(); });
      if (icons[0]) neonStroke(g, hex(c2), 5, function () { NEON_ICONS[icons[0]](g, pad * 0.55, h / 2, h * 0.26); });
      if (icons[1] || icons[0]) neonStroke(g, hex(c2), 5, function () { NEON_ICONS[icons[1] || icons[0]](g, w - pad * 0.55, h / 2, h * 0.26); });
    });
    var g = new T.Group();
    var mat = additive(tex, 0xffffff, 1);
    var tubes = new T.Mesh(planeG(W, H), mat); tubes.position.z = 0.03; tubes.renderOrder = 4; g.add(tubes);
    var wash = regFx(new T.Mesh(planeG(W * 1.7, H * 2.4), glowMat(color, 0.32))); wash.position.z = 0.012; wash.renderOrder = 3; g.add(wash);
    var t = Math.random() * 10, on = true, dip = 0, seed = Math.random() * 7;
    var api = {
      setOn: function (v) { on = !!v; mat.color.setScalar(on ? 1 : 0.05); wash.userData.fxHide = !on; wash.visible = on && !FX.low; },
      update: function (dt) {
        if (!on) return; t += dt;
        if (opts.flicker !== false && dip <= 0 && Math.random() < dt * 0.06) dip = 0.18 + Math.random() * 0.25;
        var f = 0.93 + 0.07 * Math.sin(t * 2.1 + seed);
        if (dip > 0) { dip -= dt; f *= Math.sin(t * 60) > 0 ? 0.35 : 1; }
        mat.color.setScalar(f);
      },
    };
    return finish(g, api, 'NeonSign');
  }
  /** Conos de luz falsos (aditivos) bajo un foco: pts [[x,y,z],...], altura h, radio de abajo r. 1 draw call. */
  function makeLightCones(pts, h, r, color) {
    var geo = cache(_geos, 'cone|' + h + '|' + r, function () { var c = new T.CylinderGeometry(0.06, r, h, 14, 1, true); c.translate(0, -h / 2, 0); return c; });
    var m = new T.Mesh(mergeGeos(pts.map(function (p) { return { geo: geo, m: mtx(p[0], p[1], p[2]) }; })), cache(_mats, 'conemat|' + color, function () { var mm = additive(coveTex(), color, 0.22); mm.side = T.DoubleSide; return mm; }));
    m.renderOrder = 3; return regFx(m);
  }

  // ==================================================================
  // VELVET ROPE
  // ==================================================================
  /**
   * makeVelvetRope(opts) -> Group  (~900 tris for 2 posts, 2 draw calls)
   * Posts along local X, centred. opts: { length:2, posts:2, blob }
   */
  function makeVelvetRope(opts) {
    opts = opts || {}; var L = opts.length || 2, P = Math.max(2, opts.posts || 2);
    var g = new T.Group();
    inst(cachedParts('rope|' + L + '|' + P, function (k) {
      var step = L / (P - 1);
      for (var i = 0; i < P; i++) {
        var x = -L / 2 + i * step;
        k.add(cylG(0.16, 0.18, 0.04, 14), MAT.brass, x, 0.02, 0);
        k.add(cylG(0.13, 0.16, 0.03, 14), MAT.brass, x, 0.055, 0);
        k.add(cylG(0.025, 0.03, 0.9, 10), MAT.brass, x, 0.5, 0);
        k.add(sphG(0.05, 10, 8), MAT.brass, x, 0.98, 0);
        k.add(torG(0.03, 0.008, 4, 10), MAT.brass, x, 0.9, 0);
        if (i < P - 1) {
          var curve = new T.QuadraticBezierCurve3(new T.Vector3(x + 0.03, 0.9, 0), new T.Vector3(x + step / 2, 0.55, 0), new T.Vector3(x + step - 0.03, 0.9, 0));
          k.add(new T.TubeGeometry(curve, 14, 0.022, 6, false), MAT.velvet, 0, 0, 0);
        }
      }
    }), g);
    if (opts.blob !== false) for (var i = 0; i < P; i++) { var b = addBlob(g, 0.45, 0.45, opts); b.position.x = -L / 2 + i * L / (P - 1); }
    return finish(g, null, 'VelvetRope');
  }

  // ==================================================================
  // FACADE
  // ==================================================================
  function facadeSignTex() {
    return cachedTex('facadesign', 1024, 256, function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0d2a20'); gr.addColorStop(1, '#04100b');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#d9a84a'; g.lineWidth = 6; g.strokeRect(40, 34, w - 80, h - 68);
      g.strokeStyle = 'rgba(217,168,74,0.5)'; g.lineWidth = 2; g.strokeRect(52, 46, w - 104, h - 92);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = 'bold 100px Georgia, serif';
      g.lineWidth = 10; g.strokeStyle = '#4a2a06'; g.strokeText('CASINO DORADO', w / 2, h / 2 + 6);
      g.shadowColor = '#ffb84a'; g.shadowBlur = 34; g.fillStyle = '#ffd774'; g.fillText('CASINO DORADO', w / 2, h / 2 + 6);
      g.shadowBlur = 0; g.fillStyle = '#fff2c8'; g.fillText('CASINO DORADO', w / 2, h / 2 + 4);
      g.fillStyle = '#d9a84a';
      [[86, h / 2], [w - 86, h / 2]].forEach(function (p) {
        g.save(); g.translate(p[0], p[1]); g.beginPath();
        for (var i = 0; i < 10; i++) { var r = i % 2 ? 9 : 22, a = i * PI / 5 - PI / 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        g.closePath(); g.fill(); g.restore();
      });
    });
  }
  function runnerTex() {
    return cachedTex('runner', 128, 256, function (g, w, h) {
      g.fillStyle = '#8a1022'; g.fillRect(0, 0, w, h); noise(g, w, h, 0, 900, 'rgba(0,0,0,0.15)');
      g.fillStyle = '#d9a84a'; g.fillRect(8, 0, 6, h); g.fillRect(w - 14, 0, 6, h);
    }, { repeat: [1, 2] });
  }
  /**
   * makeFacade(opts) -> Group  (~9,000 tris incl. plants/ropes, ~25 draw calls)
   * Exterior entrance. Local +Z = street side (outside). The doorway is the gap
   * x in [-3, 3]; side cladding runs to |x| = width/2. Back face sits at z=0, so to
   * place it on the game's front wall (z=-10, outside towards -Z):
   *   f.rotation.y = Math.PI; f.position.set(0, 0, -10.16);
   * Sign "CASINO DORADO" spans y 3.7..5.9 with chasing bulbs; canopy at y≈3.2.
   * opts: { width:14, light:true, plants:true, ropes:true }
   * api: update(dt) — bulb chase and sign pulse; lights [PointLight]
   */
  function makeFacade(opts) {
    opts = opts || {}; var W = opts.width || 14, half = W / 2;
    var g = new T.Group(), walls = makeWallMaterials._ext || (makeWallMaterials._ext = makeWallMaterials());
    var extMat = walls.exterior; extMat.map.repeat.set(1, 1);
    inst(cachedParts('facade|' + W, function (k) {
      var side = half - 3.4;
      // cladding panels left/right of the door
      k.add(boxG(side, 3.6, 0.2), 'EXT', -(3.4 + side / 2), 1.8, 0.1);
      k.add(boxG(side, 3.6, 0.2), 'EXT', (3.4 + side / 2), 1.8, 0.1);
      k.add(boxG(W, 0.5, 0.25), MAT.woodDark, 0, 0.25, 0.12);
      // header over the door
      k.add(boxG(6.8, 0.5, 0.24), 'EXT', 0, 3.35, 0.12);
      // pillars with brass caps
      [-3.2, 3.2].forEach(function (x) {
        k.add(rbox(0.5, 3.4, 0.5, 0.04, 2), MAT.marble, x, 1.7, 0.3);
        k.add(rbox(0.62, 0.14, 0.62, 0.03), MAT.brass, x, 0.07, 0.3);
        k.add(rbox(0.62, 0.14, 0.62, 0.03), MAT.brass, x, 3.33, 0.3);
        for (var f = -1; f <= 1; f++) k.add(boxG(0.04, 3.0, 0.02), std(0xcfc6b4, 0.4), x + f * 0.12, 1.7, 0.56);
      });
      // canopy
      k.add(rbox(8.6, 0.28, 2.6, 0.06, 2), MAT.black, 0, 3.55, 1.3);
      k.add(rbox(8.7, 0.08, 2.7, 0.02), MAT.brass, 0, 3.4, 1.3);
      k.add(planeG(8.4, 2.4), basic(0x3a2a14), 0, 3.395, 1.3, PI / 2);
      [-4.0, 4.0].forEach(function (x) { k.add(cylG(0.05, 0.06, 3.4, 10), MAT.brass, x, 1.7, 2.4); k.add(cylG(0.14, 0.16, 0.06, 12), MAT.brass, x, 0.03, 2.4); });
      // sign board + frame
      k.add(rbox(9.6, 2.4, 0.3, 0.06, 2), MAT.black, 0, 4.8, 0.3);
      k.add(rbox(9.8, 0.1, 0.36, 0.03), MAT.brass, 0, 6.02, 0.3);
      k.add(rbox(9.8, 0.1, 0.36, 0.03), MAT.brass, 0, 3.58, 0.3);
      // door frame (brass) and glass doors left open
      k.add(boxG(6.1, 0.08, 0.1), MAT.brass, 0, 3.08, 0.12);
      k.add(boxG(0.08, 3.1, 0.1), MAT.brass, -3.0, 1.55, 0.12);
      k.add(boxG(0.08, 3.1, 0.1), MAT.brass, 3.0, 1.55, 0.12);
      // windows on side cladding
      [-1, 1].forEach(function (sd) {
        var cx = sd * (3.4 + side / 2);
        k.add(rbox(Math.min(2.2, side - 0.6), 1.6, 0.06, 0.02), std(0x1a2a30, 0.1, 0.5, 0x2a1c08), cx, 1.85, 0.22);
        k.add(rbox(Math.min(2.2, side - 0.6) + 0.12, 0.08, 0.1, 0.02), MAT.brass, cx, 2.68, 0.23);
        k.add(rbox(Math.min(2.2, side - 0.6) + 0.12, 0.08, 0.14, 0.02), MAT.brass, cx, 1.02, 0.25);
      });
      // under-canopy downlights
      for (var i = 0; i < 8; i++) k.add(cylG(0.08, 0.08, 0.02, 10), basic(0xfff1c4), -3.5 + i, 3.39, 2.2);
    }), g, { EXT: extMat });
    // sign face
    var signMat = new T.MeshBasicMaterial({ map: facadeSignTex() });
    var sign = new T.Mesh(planeG(9.0, 2.0), signMat); sign.position.set(0, 4.8, 0.455); g.add(sign);
    var signGlow = regFx(new T.Mesh(planeG(14.4, 5.0), additive(rectGlowTex(), 0xffb84a, 0.75))); signGlow.position.set(0, 4.8, 0.47); signGlow.renderOrder = 3; g.add(signGlow);
    var cones = []; for (var ci = 0; ci < 8; ci++) cones.push([-3.5 + ci, 3.38, 2.2]);
    g.add(makeLightCones(cones, 3.36, 0.75, 0xffd08a));
    // chasing bulbs around the sign: 3 phase groups
    var bulbMats = [new T.MeshBasicMaterial({ color: 0xffe6a0 }), new T.MeshBasicMaterial({ color: 0xffe6a0 }), new T.MeshBasicMaterial({ color: 0xffe6a0 })];
    var lists = [[], [], []], idx = 0, bw = 9.3, bh = 2.1, sp = 0.24, path = [];
    var nx = Math.round(bw / sp), ny = Math.round(bh / sp);
    for (var i = 0; i < nx; i++) path.push([-bw / 2 + i * bw / nx, bh / 2]);
    for (var j = 0; j < ny; j++) path.push([bw / 2, bh / 2 - j * bh / ny]);
    for (var i2 = 0; i2 < nx; i2++) path.push([bw / 2 - i2 * bw / nx, -bh / 2]);
    for (var j2 = 0; j2 < ny; j2++) path.push([-bw / 2, -bh / 2 + j2 * bh / ny]);
    path.forEach(function (p) { lists[idx++ % 3].push({ geo: icoG(0.05), m: mtx(p[0], 4.8 + p[1], 0.47) }); });
    // second ring along canopy front edge
    for (var c = 0; c < 34; c++) lists[c % 3].push({ geo: icoG(0.045), m: mtx(-4.2 + c * 8.4 / 33, 3.55, 2.62) });
    var bulbGeos = cache(_geos, 'facadebulbs|' + W, function () { return lists.map(function (l) { return mergeGeos(l); }); });
    bulbGeos.forEach(function (bg, k) { g.add(new T.Mesh(bg, bulbMats[k])); });
    // red carpet runner
    var runner = new T.Mesh(planeG(2.2, 5.5), new T.MeshStandardMaterial({ map: runnerTex(), roughness: 0.9 }));
    runner.rotation.x = -PI / 2; runner.position.set(0, 0.015, 2.75); g.add(runner);
    if (opts.ropes !== false) {
      [-1.5, 1.5].forEach(function (x) { var r = makeVelvetRope({ length: 3.2, posts: 3 }); r.rotation.y = PI / 2; r.position.set(x, 0, 2.8); g.add(r); });
    }
    if (opts.plants !== false) {
      [-4.6, 4.6].forEach(function (x) { var p = makePlant({ kind: 'palm', scale: 1.1 }); p.position.set(x, 0, 0.8); g.add(p); });
    }
    var lights = [];
    if (opts.light !== false) {
      var l1 = new T.PointLight(0xffc870, 1.1, 10, 1.8); l1.position.set(0, 3.0, 1.8); g.add(l1); lights.push(l1);
      var l2 = new T.PointLight(0xffd27a, 0.8, 9, 1.8); l2.position.set(0, 4.8, 2.0); g.add(l2); lights.push(l2);
    }
    var t = 0;
    var api = {
      lights: lights,
      update: function (dt) {
        t += dt; var step = Math.floor(t * 7) % 3;
        for (var k = 0; k < 3; k++) bulbMats[k].color.setHex(k === step ? 0xfff6d0 : 0x5a3a14);
        var p = 0.9 + 0.1 * Math.sin(t * 2.0); signMat.color.setRGB(p, p, p);
      },
    };
    return finish(g, api, 'Facade');
  }

  // ==================================================================
  // PEOPLE — personajes de Kenney (CC0) con los huesos del juego: una sola
  // malla por persona (1 draw call + la sombra). El cuerpo, la ropa pintada
  // y las caras con gestos los arma people.js; acá queda el look y la animación.
  // ==================================================================
  var UNIFORMS = {
    tech: { top: 'coverall', shirt: 0xe07a2a, pants: 0xe07a2a, hat: 'cap', hatColor: 0x1f2c48, belt: 0x3a2a1a, tools: true, sleeves: 'long' },
    security: { top: 'guard', shirt: 0x1b1f27, pants: 0x14161c, hat: 'guard', hatColor: 0x101216, badge: 0xd9a84a, belt: 0x0b0c0e, sleeves: 'long' },
    host: { top: 'vest', shirt: 0xf3e9d2, pants: 0x15171a, vest: 0x6e1423, bow: 0xd9a84a, sleeves: 'long' },
    croupier: { top: 'vest', shirt: 0xf6f1e6, pants: 0x15171a, vest: 0x15171a, bow: 0xd4423f, armband: 0xd9a84a, sleeves: 'long' },
    cashier: { top: 'vest', shirt: 0xf3e9d2, pants: 0x1e2430, vest: 0x0f2b22, bow: 0xd9a84a, hat: 'visor', hatColor: 0x1d8a4e, sleeves: 'long' },
    police: { top: 'guard', shirt: 0x2f4f8f, pants: 0x18213a, hat: 'guard', hatColor: 0x0f1830, badge: 0xd8dde4, belt: 0x0b0c0e, sleeves: 'long' }, // patrulla (combat.js)
    stock: { top: 'apron', shirt: 0x3a7a3a, pants: 0x2a2a30, apron: 0x1f4a24, hat: 'cap', hatColor: 0x2c5e2c, belt: 0x2a2a2a, sleeves: 'short' }, // repositor (shop.js)
  };
  var SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
  var HAIRS = [0x2a1a10, 0x1a1a1a, 0x5a3a1a, 0x8a6a3a, 0xc9b28a, 0x6a2a14];
  var HAIR_M = ['short', 'quiff', 'buzz', 'short', 'curly', 'bald', 'quiff'], HAIR_F = ['long', 'bob', 'ponytail', 'bun', 'long', 'curly'];
  // las expresiones de la cara (las dibuja people.js en un atlas compartido)
  var EXPRESSIONS = ['neutral', 'blink', 'happy', 'sad', 'angry', 'surprised', 'dizzy'];
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function mul(c, f) { return new T.Color(c).multiplyScalar(f).getHex(); }
  function mix(a, b, f) { return new T.Color(a).lerp(new T.Color(b), f).getHex(); }

  /** Resuelve las opciones a un "look" completo y determinista (misma key => misma malla). */
  function resolveLook(opts) {
    var u = opts.uniform ? UNIFORMS[opts.uniform] || {} : {};
    var rnd = function (a) { return a[(Math.random() * a.length) | 0]; };
    var skin = opts.skin != null ? opts.skin : rnd(SKINS), hair = opts.hair != null ? opts.hair : rnd(HAIRS);
    var shirt = opts.shirt != null ? opts.shirt : (u.shirt != null ? u.shirt : new T.Color().setHSL(Math.random(), 0.45, 0.45).getHex());
    var pants = opts.pants != null ? opts.pants : (u.pants != null ? u.pants : rnd([0x1e2430, 0x2a2a30, 0x3a3226, 0x23324a]));
    var vip = !!opts.vip, female = !!opts.female;
    var seed = hash([skin, hair, shirt, pants, opts.uniform || '', vip ? 1 : 0, female ? 1 : 0, opts.jacket || 0, opts.cap || 0].join(','));
    var r = function (n) { seed = Math.imul(seed ^ (seed >>> 15), 2246822519) >>> 0; return (seed >>> 8) % n; };
    var o = { female: female, skin: skin, hair: hair, shirt: shirt, pants: pants, shoes: opts.shoes != null ? opts.shoes : 0x141414, sole: 0x2a2420, folder: !!opts.folder };
    o.hairStyle = opts.hairStyle || (female ? HAIR_F : HAIR_M)[r(female ? HAIR_F.length : HAIR_M.length)];
    if (opts.uniform) {
      for (var k in u) o[k] = u[k];
      o.shirt = shirt; o.pants = pants; o.topColor = u.top === 'vest' ? u.shirt : shirt; o.sleeveColor = u.top === 'vest' ? u.shirt : shirt;
      o.cuff = u.top === 'vest' ? 0xf6f1e6 : null; o.shoes = 0x0e0e10;
      if (!female && r(4) === 0) o.beard = 'mustache';
    } else if (vip) {
      var jacket = opts.jacket || 0x1a1a24, white = new T.Color(jacket).getHSL({}).l > 0.6;
      o.top = opts.top || (female && white ? 'dress' : 'suit'); o.topColor = jacket; o.sleeveColor = jacket;
      o.pants = opts.pants != null ? opts.pants : jacket; o.shirt = white ? 0x1a1a24 : 0xf6f1e6; o.cuff = 0xf6f1e6;
      o.tie = white ? 0xd9a84a : [0xd9a84a, 0x8e1f26, 0x2a4a8a][r(3)]; o.trim = 0xd9a84a; o.watch = 0xd9a84a; o.sleeves = 'long';
      o.shoes = white ? 0xe8e0d0 : 0x0e0e10; o.sole = white ? 0xb0a890 : 0x1a1410;
      if (female) { o.necklace = 0xd9a84a; o.earrings = 0xd9a84a; o.tie = null; if (o.top === 'dress') { o.shoes = 0xd9a84a; o.sleeves = 'short'; o.sleeveColor = jacket; } }
      else if (r(3) === 0) o.beard = r(2) ? 'full' : 'mustache';
      if (opts.folder) { o.tie = 0x2a2a30; o.glasses = 0x2a2a2a; o.hairStyle = 'bald'; }
    } else {
      var tops = opts.cap ? ['hoodie', 'polo', 'tee'] : ['tee', 'polo', 'tee', 'hoodie'];
      o.top = opts.top || tops[r(tops.length)]; o.topColor = shirt; o.sleeveColor = shirt;
      o.sleeves = o.top === 'hoodie' ? 'long' : 'short';
      if (o.top === 'tee' && r(3) === 0) o.stripe = mix(shirt, 0xffffff, 0.6);
      o.belt = o.top === 'hoodie' ? null : 0x2a2018;
      var sneaker = r(2) === 0; o.shoes = sneaker ? [0xf0ece2, 0xd4423f, 0x2a6fd6, 0x15171a][r(4)] : 0x2a1a10; o.sole = sneaker ? 0xf6f3ea : 0x1a1410;
      if (opts.cap) { o.hat = 'cap'; o.hatColor = opts.cap; }
      if (r(5) === 0) o.glasses = [0x15171a, 0x6a3a1a, 0xc9a24a][r(3)];
      if (!female && r(4) === 0) o.beard = r(2) ? 'full' : 'mustache';
      if (female && r(2) === 0) o.earrings = 0xd9a84a;
    }
    if (opts.glasses != null) o.glasses = opts.glasses; if (opts.noBeard) o.beard = null; // staff.js: anteojos de nerd y cara afeitada
    if (o.belt === undefined) o.belt = o.top === 'dress' ? null : 0x15171a;
    o.key = [skin, hair, shirt, o.pants, opts.uniform || '', vip ? 1 : 0, female ? 1 : 0, opts.jacket || 0, opts.cap || 0, opts.folder ? 1 : 0, o.top, o.hairStyle, opts.shoes || 0, o.glasses || 0, o.beard || 0].join(',');
    return o;
  }

  /**
   * makePerson(opts) -> Group  (~1,600 tris, 1 SkinnedMesh + sombra = 2 draw calls; geometría compartida, textura por look)
   * Origin at feet, faces +Z, ~1.9 m tall (scale with opts.height). Cuerpo: CasinoPeople.build (people.js).
   * opts: { skin, shirt, pants, hair, shoes, uniform:null|'tech'|'security'|'host'|'croupier'|'cashier'|'stock',
   *         vip:false, jacket, cap (color), folder, top, hairStyle, height:1, female:false, blob:true }
   * api: walk(dt, speed=1.4)  - paso con braceo, rebote y balanceo (no mueve el grupo)
   *      idle(dt)             - respira, cambia el peso de pierna, mira alrededor, parpadea (si está sentado, mantiene la pose)
   *      play(dt)             - manos adelante (máquina / mesa) con toques
   *      sit(seatHeight=0.76) / stand()
   *      cheer(seconds=1.2)   - festejo con brazos arriba y cara feliz
   *      gesture('press'|'lever'|'swing') - gesto corto con el brazo
   *      face(expr, seconds)  - 'neutral','happy','sad','angry','surprised','dizzy','blink'
   *      knocked(dt)          - pose de desmayado en el piso (el que llama acuesta el grupo)
   *      joints {hips, torso, head, legL, legR, kneeL, kneeR, armL, armR, elbowL, elbowR}  (huesos)
   *      hipY                 - altura de la cadera parado (para poses hechas a mano, ej. vip.js)
   */
  function makePerson(opts) {
    opts = opts || {};
    var o = resolveLook(opts);
    var root = new T.Group();
    // cuerpo (malla de Kenney + huesos del juego + ropa pintada por look): people.js
    var body = window.CasinoPeople.build(o, root);
    var J = body.J, HIP = window.CasinoPeople.HIP_Y, SIT = window.CasinoPeople.SIT_OFF, TSY = J.torso.scale.y, Z0 = J.hips.position.z;
    var s = opts.height || 1; root.scale.setScalar(s);
    addBlob(root, 0.7, 0.7, opts);

    var seed = Math.random() * 100, phase = Math.random() * TAU, t = Math.random() * 10, sitting = false, seatH = 0.76, cheerT = 0;
    var gest = null, gestT = 0, gestDur = 1, lookY = 0, lookX = 0, lookT = 0, faceName = 'neutral', faceT = 0, blinkT = 1 + Math.random() * 4, fidgetT = 8 + Math.random() * 15, fidget = 0;
    function setMat(name) { body.setFace(name); }
    function lerp(ob, prop, v, k) { ob.rotation[prop] += (v - ob.rotation[prop]) * k; }
    // reloj común: cara (gestos temporales + parpadeo), festejo y gesto del brazo
    function clock(dt) {
      t += dt; cheerT = Math.max(0, cheerT - dt);
      if (gest) { gestT += dt / gestDur; if (gestT >= 1) gest = null; }
      if (faceT > 0) { faceT -= dt; if (faceT <= 0) faceName = 'neutral'; }
      var f = cheerT > 0 ? 'happy' : faceName;
      blinkT -= dt;
      if (blinkT < 0.13 && (f === 'neutral' || f === 'sad' || f === 'angry')) f = 'blink';
      if (blinkT <= 0) blinkT = 1.8 + Math.random() * 4.2;
      setMat(f);
    }
    function gestureArm(k) {
      if (!gest) return false;
      var u = Math.min(1, gestT), b = Math.sin(u * PI);
      if (gest === 'press') { lerp(J.armR, 'x', -0.95 - 0.35 * b, k * 2.5); lerp(J.elbowR, 'x', -0.75 + 0.45 * b, k * 2.5); lerp(J.armR, 'z', 0.08, k); }
      else if (gest === 'lever') {
        var up = u < 0.35 ? u / 0.35 : u < 0.7 ? 1 - (u - 0.35) / 0.35 * 1.3 : -0.3 * (1 - (u - 0.7) / 0.3);
        lerp(J.armL, 'x', -0.7 - 1.0 * up, k * 3); lerp(J.armL, 'z', -0.25 - 0.3 * b, k * 3); lerp(J.elbowL, 'x', -0.35, k * 3); lerp(J.torso, 'z', 0.06 * b, k);
      } else if (gest === 'swing') { // batazo: levanta atrás y descarga hacia adelante
        var ph = u < 0.45 ? u / 0.45 : u < 0.6 ? 1 - (u - 0.45) / 0.15 * 2 : -1 + (u - 0.6) / 0.4 * 0.6;
        lerp(J.armR, 'x', ph > 0 ? -2.3 * ph - 0.4 : -0.4 + ph * 1.2, k * 5); lerp(J.armR, 'z', 0.25, k * 4); lerp(J.elbowR, 'x', ph > 0 ? -1.2 * ph : -0.15, k * 5);
        lerp(J.armL, 'x', ph > 0 ? -1.6 * ph - 0.3 : -0.3 + ph * 0.8, k * 5); lerp(J.armL, 'z', -0.1, k * 4); lerp(J.elbowL, 'x', -0.6, k * 4);
        lerp(J.torso, 'x', ph > 0 ? -0.12 * ph : -0.25 * ph, k * 5);
      } else return false;
      return true;
    }
    function upper(k, playing) {
      var ch = cheerT > 0 ? Math.min(1, cheerT * 3) : 0;
      if (ch > 0) {
        var pump = Math.sin(t * 13);
        lerp(J.armL, 'x', -2.7 + pump * 0.15, k * 2); lerp(J.armR, 'x', -2.7 - pump * 0.15, k * 2); lerp(J.armL, 'z', -0.4, k * 2); lerp(J.armR, 'z', 0.4, k * 2);
        lerp(J.elbowL, 'x', -0.35 + pump * 0.35, k * 2); lerp(J.elbowR, 'x', -0.35 - pump * 0.35, k * 2);
        lerp(J.head, 'x', -0.2, k); lerp(J.head, 'y', Math.sin(t * 6) * 0.15, k);
        lerp(J.torso, 'z', Math.sin(t * 6.5) * 0.06, k); J.torso.scale.y = TSY;
        return;
      }
      var br = Math.sin(t * 1.9 + seed);
      J.torso.scale.y = TSY * (1 + br * 0.008);
      lerp(J.torso, 'y', 0, k); lerp(J.torso, 'z', 0, k);
      if (!gestureArm(k)) {
        if (playing) {
          lerp(J.armL, 'x', -0.62 + Math.sin(t * 2.3 + seed) * 0.05, k); lerp(J.armR, 'x', -0.72 + Math.sin(t * 2.9) * 0.07, k); lerp(J.armL, 'z', -0.12, k); lerp(J.armR, 'z', 0.12, k);
          lerp(J.elbowL, 'x', -0.85, k); lerp(J.elbowR, 'x', -0.8 + Math.sin(t * 2.9) * 0.08, k);
        } else if (fidget > 0) { // mira el reloj
          lerp(J.armL, 'x', -0.55, k); lerp(J.armL, 'z', 0.25, k); lerp(J.elbowL, 'x', -1.65, k); lerp(J.armR, 'x', 0.02, k); lerp(J.armR, 'z', 0.08, k); lerp(J.elbowR, 'x', -0.12, k);
        } else {
          var sw = Math.sin(t * 0.8 + seed) * 0.03;
          lerp(J.armL, 'x', sw, k); lerp(J.armR, 'x', -sw, k); lerp(J.armL, 'z', -0.08 - br * 0.012, k); lerp(J.armR, 'z', 0.08 + br * 0.012, k);
          lerp(J.elbowL, 'x', -0.14, k); lerp(J.elbowR, 'x', -0.14, k);
        }
      }
      // cabeza: mira alrededor con objetivos suaves
      lookT -= k / 6;
      if (lookT <= 0) { lookT = 2 + Math.random() * 4; lookY = (Math.random() - 0.5) * (playing ? 0.35 : 1.1); lookX = playing ? 0.12 + Math.random() * 0.12 : (Math.random() - 0.5) * 0.15; }
      if (fidget > 0) { lerp(J.head, 'x', 0.45, k); lerp(J.head, 'y', 0.25, k); }
      else { lerp(J.head, 'y', lookY, k * 0.35); lerp(J.head, 'x', lookX, k * 0.35); }
      lerp(J.head, 'z', 0, k);
    }
    function legsStand(k) {
      var sh = Math.sin(t * 0.31 + seed) * 0.6 + Math.sin(t * 0.17 + seed * 2) * 0.4;   // cambio de peso
      J.hips.position.y += (HIP - 0.006 * Math.abs(sh) - J.hips.position.y) * k;
      J.hips.position.x += (sh * 0.014 - J.hips.position.x) * k; J.hips.position.z += (Z0 - J.hips.position.z) * k;
      lerp(J.hips, 'z', sh * 0.035, k); lerp(J.hips, 'y', 0, k); lerp(J.hips, 'x', 0, k);
      lerp(J.legL, 'x', 0, k); lerp(J.legR, 'x', 0, k); lerp(J.legL, 'z', -sh * 0.035, k); lerp(J.legR, 'z', -sh * 0.035, k);
      lerp(J.kneeL, 'x', 0.02 + Math.max(0, sh) * 0.1, k); lerp(J.kneeR, 'x', 0.02 + Math.max(0, -sh) * 0.1, k);
      lerp(J.torso, 'x', 0.01, k); lerp(J.torso, 'z', -sh * 0.03, k);
    }
    function legsSit(k) {
      J.hips.position.y = seatH + SIT; J.hips.position.x = 0; J.hips.position.z = Z0;
      lerp(J.hips, 'z', 0, k); lerp(J.hips, 'y', 0, k); lerp(J.hips, 'x', 0, k);
      var tap = Math.max(0, Math.sin(t * 5 + seed)) * (Math.sin(t * 0.4 + seed) > 0.6 ? 0.12 : 0);   // golpecito con el pie
      lerp(J.legL, 'x', -1.5, k); lerp(J.legR, 'x', -1.45, k); lerp(J.legL, 'z', -0.06, k); lerp(J.legR, 'z', 0.06, k);
      lerp(J.kneeL, 'x', 1.45 - tap, k); lerp(J.kneeR, 'x', 1.4, k);
      lerp(J.torso, 'x', 0.12, k);
    }
    var api = {
      joints: J, hipY: HIP, get mesh() { return body.mesh; }, get sitting() { return sitting; },
      walk: function (dt, speed) {
        speed = speed == null ? 1.4 : speed; sitting = false; clock(dt); fidget = 0;
        var amp = Math.min(1.25, speed / 1.4), run = Math.max(0, Math.min(1, (speed - 2.4) / 1.6));
        phase += dt * (3.6 + speed * 2.5);
        var sw = Math.sin(phase), cw = Math.cos(phase), k = Math.min(1, dt * 16);
        lerp(J.legL, 'x', -sw * 0.52 * amp, k); lerp(J.legR, 'x', sw * 0.52 * amp, k); lerp(J.legL, 'z', 0, k); lerp(J.legR, 'z', 0, k);
        lerp(J.kneeL, 'x', (0.1 + 0.8 * Math.max(0, cw)) * amp, k); lerp(J.kneeR, 'x', (0.1 + 0.8 * Math.max(0, -cw)) * amp, k);
        J.hips.position.y += (HIP - 0.018 * amp + Math.abs(cw) * 0.026 * amp - J.hips.position.y) * k;
        J.hips.position.x += (0 - J.hips.position.x) * k; J.hips.position.z += (Z0 - J.hips.position.z) * k;
        lerp(J.hips, 'y', sw * 0.09 * amp, k); lerp(J.hips, 'z', cw * 0.025 * amp, k); lerp(J.hips, 'x', 0, k);
        lerp(J.torso, 'y', -sw * 0.16 * amp, k); lerp(J.torso, 'x', 0.05 * amp + run * 0.16, k); lerp(J.torso, 'z', -cw * 0.02 * amp, k);
        J.torso.scale.y = TSY;
        if (cheerT > 0) upper(k, false);
        else if (!gestureArm(k)) {
          lerp(J.armL, 'x', sw * 0.62 * amp, k); lerp(J.armR, 'x', -sw * 0.62 * amp, k);
          lerp(J.armL, 'z', -0.09, k); lerp(J.armR, 'z', 0.09, k);
          lerp(J.elbowL, 'x', -0.3 - run * 0.9 - Math.max(0, -sw) * 0.45 * amp, k); lerp(J.elbowR, 'x', -0.3 - run * 0.9 - Math.max(0, sw) * 0.45 * amp, k);
          lerp(J.head, 'y', 0, k * 0.5); lerp(J.head, 'x', -0.05 * amp + Math.sin(phase * 2) * 0.02, k); lerp(J.head, 'z', 0, k);
        }
      },
      idle: function (dt) {
        clock(dt); var k = Math.min(1, dt * 6);
        if (sitting) { legsSit(k); upper(k, true); return; }
        fidgetT -= dt; if (fidgetT <= 0) { fidget = 1.6; fidgetT = 12 + Math.random() * 18; }
        if (fidget > 0) fidget -= dt;
        legsStand(k); upper(k, false);
      },
      /** Plays the "at the machine" upper-body loop while standing (or seated). */
      play: function (dt) { clock(dt); fidget = 0; var k = Math.min(1, dt * 6); if (sitting) legsSit(k); else legsStand(k); upper(k, true); },
      sit: function (h) {
        sitting = true; seatH = h == null ? 0.76 : h;
        J.hips.position.set(0, seatH + SIT, Z0); J.hips.rotation.set(0, 0, 0);
        J.legL.rotation.set(-1.5, 0, -0.06); J.legR.rotation.set(-1.45, 0, 0.06); J.kneeL.rotation.x = 1.45; J.kneeR.rotation.x = 1.4;
        J.armL.rotation.x = -0.6; J.armR.rotation.x = -0.7; J.elbowL.rotation.x = -0.85; J.elbowR.rotation.x = -0.8; J.torso.rotation.x = 0.12;
      },
      stand: function () {
        sitting = false; gest = null; fidget = 0; J.hips.position.set(0, HIP, Z0);
        [J.hips, J.legL, J.legR, J.kneeL, J.kneeR, J.armL, J.armR, J.elbowL, J.elbowR, J.torso, J.head].forEach(function (b) { b.rotation.set(0, 0, 0); });
        J.torso.scale.y = TSY;
      },
      cheer: function (sec) { cheerT = sec || 1.2; gest = null; },
      gesture: function (name, dur) { gest = name; gestT = 0; gestDur = dur || (name === 'lever' ? 0.9 : name === 'swing' ? 1.0 : 0.45); },
      face: function (name, sec) { faceName = name || 'neutral'; faceT = sec || 2; setMat(faceName); },
      knocked: function (dt) { // tirado en el piso, mareado
        clock(dt); var k = Math.min(1, dt * 8);
        J.hips.position.y += (HIP - J.hips.position.y) * k; J.hips.position.x = 0; J.hips.position.z += (Z0 + 0.09 - J.hips.position.z) * k; // la nuca de Kenney es más honda: que no se hunda en el piso
        lerp(J.legL, 'x', -0.08, k); lerp(J.legR, 'x', 0.05, k); lerp(J.legL, 'z', -0.22, k); lerp(J.legR, 'z', 0.25, k); lerp(J.kneeL, 'x', 0.25, k); lerp(J.kneeR, 'x', 0.05, k);
        lerp(J.armL, 'x', -0.3, k); lerp(J.armR, 'x', -0.2, k); lerp(J.armL, 'z', -1.35, k); lerp(J.armR, 'z', 1.25, k); lerp(J.elbowL, 'x', -0.5, k); lerp(J.elbowR, 'x', -0.2, k);
        lerp(J.torso, 'x', 0, k); lerp(J.torso, 'z', 0, k); lerp(J.torso, 'y', 0, k);
        lerp(J.head, 'y', Math.sin(t * 2.2) * 0.5, k); lerp(J.head, 'z', Math.sin(t * 3.1) * 0.15, k); lerp(J.head, 'x', -0.1, k);
      },
    };
    api.stand();
    return finish(root, api, 'Person');
  }
  // ==================================================================
  // utilities
  // ==================================================================
  /** Counts triangles and meshes in an object (for budgets). */
  function stats(obj) {
    var tris = 0, meshes = 0;
    obj.traverse(function (o) {
      if (!o.isMesh || !o.geometry) return; meshes++;
      var g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    });
    return { triangles: Math.round(tris), meshes: meshes };
  }

  window.CasinoArt = {
    version: '1.0.0',
    palette: PAL,
    // factories
    makeSlotMachine: makeSlotMachine,
    makeStool: makeStool,
    makeBlackjackTable: makeBlackjackTable,
    makeRouletteTable: makeRouletteTable,
    makePokerTable: makePokerTable,
    makeBar: makeBar,
    makeCashierCage: makeCashierCage,
    makePlant: makePlant,
    makeChandelier: makeChandelier,
    makeVelvetRope: makeVelvetRope,
    makeCarpetTexture: makeCarpetTexture,
    makeFacade: makeFacade,
    makeWallMaterials: makeWallMaterials,
    makePerson: makePerson,
    makeNeonSign: makeNeonSign,
    makeCoveLights: makeCoveLights,
    makeLightCones: makeLightCones,
    // helpers for the game
    materials: MAT,               // shared brass/chrome/wood/... (getters return cached materials)
    std: std, basic: basic,       // cached material makers
    roundedBox: rbox,             // cached bevelled box geometry
    canvasTex: canvasTex,
    addBlob: addBlob,             // contact-shadow quad
    mergeGeometries: mergeGeos,
    stats: stats,
    drawSlotScreen: drawSlotScreen,
    glowMat: glowMat,             // material aditivo compartido para brillos falsos
    regFx: regFx, setLowFx: setLowFx, // efectos que se apagan en calidad baja
    slotModels: Object.keys(SLOT_MODELS),
    expressions: EXPRESSIONS,
    UNIFORMS: Object.keys(UNIFORMS),
    SKINS: SKINS,
    cache: { materials: _mats, geometries: _geos, textures: _texs },
  };
})();
