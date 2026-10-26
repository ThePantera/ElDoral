// people.js · Cuerpos de las personas con el personaje de Kenney (CC0)
// El modelo (una sola malla con 11 huesos, ya en pose de descanso) viene embebido en people-assets.js y se parsea con
// THREE.GLTFLoader.parse, así el juego sigue abriendo con doble clic (file://, sin fetch). Todas las personas comparten la
// misma geometría; lo que cambia es la textura de 512 px por "look", que se arma sobre las TEXTURAS ORIGINALES de Kenney
// (people-assets.js → skins): la cabeza (pelo, cara, cejas, bigote) es la original de una de las 6 skins, con la piel y el
// pelo teñidos sin perder el dibujo; la ropa se pinta por look (uniformes, remeras, trajes) y se multiplica por el
// sombreado de la ropa de Kenney. Las texturas se cachean por look y se liberan las que nadie usa hace rato.
// Gestos: neutral es la cara original; los demás (parpadeo, feliz, triste, enojada, sorprendida, mareada) los pone el
// shader desde un atlas compartido: borra ojos/boca con la piel del look y dibuja los del gesto, al estilo Kenney. Cambiar
// de gesto es cambiar de material (uno por look y gesto, todos con el mismo programa): 1 SkinnedMesh por persona.
// art.js (makePerson) arma el "look" (resolveLook), pide el cuerpo acá y sigue animando sus propios huesos (J.hips, J.armR...).
// También da el brazo de Kenney para las manos en primera persona (armGeometry / fpMaterial / setFPLook).
(function () {
  'use strict';
  var T = window.THREE, AS = window.CasinoPeopleAssets;
  if (!T || !AS) { console.error('[CasinoPeople] falta THREE o people-assets.js'); return; }
  var PI = Math.PI, TAU = PI * 2;
  var TS = 512;   // lado de la textura de cada look (las coordenadas de pintura son las de la textura original de Kenney, 1024)

  // ------------------------------------------------------------------
  // esqueleto: 11 huesos del juego, en el mismo orden que el .glb y que BN de art.js
  // ------------------------------------------------------------------
  var NAMES = ['hips', 'torso', 'head', 'legL', 'kneeL', 'legR', 'kneeR', 'armL', 'elbowL', 'armR', 'elbowR'];
  var PARENT = [-1, 0, 1, 0, 3, 0, 5, 1, 7, 1, 9];
  // reposo en metros (posición y escala en el espacio de la persona). La escala de cada hueso hace que las coordenadas
  // "viejas" de los accesorios que otros módulos cuelgan de J.head / J.torso / J.elbowR caigan en el lugar justo del modelo nuevo.
  var REST_P = [[0, 0.636, 0.016], [0, 0.801, 0.016], [0, 1.382, 0.004], [-0.103, 0.666, 0.016], [-0.104, 0.397, 0.016], [0.103, 0.666, 0.016], [0.104, 0.397, 0.016],
    [-0.172, 1.208, 0.009], [-0.2, 0.968, 0.009], [0.172, 1.208, 0.009], [0.201, 0.968, 0.009]];
  var REST_S = [1, 0.85, 2.05, 1, 1, 1, 1, 0.83, 1, 0.83, 1];
  var HIP_Y = REST_P[0][1];
  var SIT_OFF = 0.057;  // de la articulación de la cadera a la cola (muslo de ~9 cm de radio): cadera = asiento + esto

  var BASE = null, IBM = null, pending = [];
  var _geos = new Map(), _texs = new Map(), _mats = new Map();
  function cache(map, key, make) { var v = map.get(key); if (v === undefined) { v = make(); map.set(key, v); } return v; }

  function makeBones() {
    var bones = NAMES.map(function (n, i) {
      var b = new T.Bone(); b.name = n;
      var p = REST_P[i], s = REST_S[i], pi = PARENT[i];
      if (pi < 0) { b.position.set(p[0], p[1], p[2]); b.scale.setScalar(s); }
      else {
        var q = REST_P[pi], sp = REST_S[pi];
        b.position.set((p[0] - q[0]) / sp, (p[1] - q[1]) / sp, (p[2] - q[2]) / sp); b.scale.setScalar(s / sp);
      }
      return b;
    });
    for (var i = 1; i < bones.length; i++) bones[PARENT[i]].add(bones[i]);
    return bones;
  }

  // ------------------------------------------------------------------
  // modelo: parse del .glb embebido (sin imágenes: se resuelve en microtareas, antes de que cargue game.js)
  // ------------------------------------------------------------------
  function b64ToBuffer(s) {
    var bin = atob(s), n = bin.length, u = new Uint8Array(n);
    for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  }
  function onModel(gltf) {
    var sk = null;
    gltf.scene.traverse(function (o) { if (o.isSkinnedMesh && !sk) sk = o; });
    if (!sk) { console.error('[CasinoPeople] el modelo no trae malla con huesos'); return; }
    var geo = sk.geometry;
    geo.deleteAttribute('color');
    geo.boundingSphere = new T.Sphere(new T.Vector3(0, 0.9, 0), 1.95); // alcanza también sentado o tirado en el piso
    BASE = geo;
    // reposo exacto del .glb (las constantes de arriba son las mismas, redondeadas)
    var bones = sk.skeleton.bones;
    IBM = NAMES.map(function (n) {
      for (var i = 0; i < bones.length; i++) if (bones[i].name === n) return sk.skeleton.boneInverses[i].clone();
      return new T.Matrix4();
    });
    var list = pending; pending = [];
    list.forEach(function (f) { f(); });
  }
  try {
    new T.GLTFLoader().parse(b64ToBuffer(AS.glb), '', onModel, function (e) { console.error('[CasinoPeople] no se pudo leer el modelo', e); });
  } catch (e) { console.error('[CasinoPeople] no se pudo leer el modelo', e); }

  // ------------------------------------------------------------------
  // accesorios que van dentro de la malla (gorra, visera, carpeta): geometría extra pegada a un hueso, con UV a un
  // parche de color de la textura del look. Una variante de geometría por combinación (pocas, compartidas).
  // ------------------------------------------------------------------
  // parches (coordenadas 1024) en una zona libre del mapa UV de Kenney
  var PATCH = { hat: [40, 880], brim: [100, 880], gold: [40, 960], folder: [100, 960] };
  function partsFor(o) {
    var L = [];
    function P(bone, geo, patch, x, y, z, rx, ry, rz, sx, sy, sz) {
      var m = new T.Matrix4().compose(new T.Vector3(x || 0, y || 0, z || 0), new T.Quaternion().setFromEuler(new T.Euler(rx || 0, ry || 0, rz || 0)), new T.Vector3(sx || 1, sy || 1, sz || 1));
      L.push({ bone: bone, geo: geo, patch: patch, m: m });
    }
    // coordenadas locales de la cabeza (las de siempre: frente en z ~0.125, coronilla en y ~0.27)
    if (o.hat === 'cap' || o.hat === 'guard') {
      P(2, new T.SphereGeometry(0.139, 14, 5, 0, TAU, 0, PI * 0.42), 'hat', 0, 0.165, 0, -0.08, 0, 0, 1.12, 1.0, 1.12);
      P(2, new T.CylinderGeometry(0.105, 0.105, 0.015, 12, 1, false, -PI / 2, PI), 'brim', 0, 0.2, 0.1, 0.15, 0, 0, 1.05, 1, 1.0);
      P(2, new T.SphereGeometry(0.012, 5, 4), 'brim', 0, 0.305, 0);
      if (o.hat === 'guard') P(2, new T.BoxGeometry(0.045, 0.035, 0.012), 'gold', 0, 0.245, 0.15, -0.35);
    } else if (o.hat === 'visor') {
      P(2, new T.CylinderGeometry(0.15, 0.15, 0.035, 14, 1, true), 'hat', 0, 0.21, 0, 0, 0, 0, 1, 1, 1.0);
      P(2, new T.CylinderGeometry(0.11, 0.11, 0.012, 12, 1, false, -PI / 2, PI), 'hat', 0, 0.2, 0.12, 0.25, 0, 0, 1, 1, 0.9);
    }
    if (o.folder) P(10, new T.BoxGeometry(0.26, 0.34, 0.03), 'folder', 0, -0.3, 0.08, 0.3); // carpeta del inspector (mano derecha)
    return L;
  }
  function restMatrix(i) { var p = REST_P[i], s = REST_S[i]; return new T.Matrix4().compose(new T.Vector3(p[0], p[1], p[2]), new T.Quaternion(), new T.Vector3(s, s, s)); }
  function geometryFor(o) {
    var key = (o.hat || '') + '|' + (o.folder ? 1 : 0);
    if (key === '|0') return BASE;
    return cache(_geos, key, function () {
      var parts = partsFor(o), extra = [];
      parts.forEach(function (it) {
        var g = it.geo.index ? it.geo.toNonIndexed() : it.geo;
        g.applyMatrix4(it.m); g.applyMatrix4(restMatrix(it.bone));
        extra.push({ g: g, bone: it.bone, uv: PATCH[it.patch] });
      });
      var nb = BASE.attributes.position.count, ne = 0;
      extra.forEach(function (e) { ne += e.g.attributes.position.count; });
      var n = nb + ne, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      var bp = BASE.attributes.position, bn = BASE.attributes.normal, bu = BASE.attributes.uv, bi = BASE.attributes.skinIndex, bw = BASE.attributes.skinWeight;
      for (var i = 0; i < nb; i++) {
        pos[i * 3] = bp.getX(i); pos[i * 3 + 1] = bp.getY(i); pos[i * 3 + 2] = bp.getZ(i);
        nor[i * 3] = bn.getX(i); nor[i * 3 + 1] = bn.getY(i); nor[i * 3 + 2] = bn.getZ(i);
        uv[i * 2] = bu.getX(i); uv[i * 2 + 1] = bu.getY(i);
        si[i * 4] = bi.getX(i); si[i * 4 + 1] = bi.getY(i); si[i * 4 + 2] = bi.getZ(i); si[i * 4 + 3] = bi.getW(i);
        sw[i * 4] = bw.getX(i); sw[i * 4 + 1] = bw.getY(i); sw[i * 4 + 2] = bw.getZ(i); sw[i * 4 + 3] = bw.getW(i);
      }
      var o2 = nb, idx = Array.prototype.slice.call(BASE.index.array);
      extra.forEach(function (e) {
        var gp = e.g.attributes.position, gn = e.g.attributes.normal, c = gp.count;
        for (var k = 0; k < c; k++) {
          var j = o2 + k;
          pos[j * 3] = gp.getX(k); pos[j * 3 + 1] = gp.getY(k); pos[j * 3 + 2] = gp.getZ(k);
          nor[j * 3] = gn.getX(k); nor[j * 3 + 1] = gn.getY(k); nor[j * 3 + 2] = gn.getZ(k);
          uv[j * 2] = e.uv[0] / 1024; uv[j * 2 + 1] = e.uv[1] / 1024;
          si[j * 4] = e.bone; sw[j * 4] = 1;
          idx.push(j);
        }
        o2 += c; e.g.dispose();
      });
      var out = new T.BufferGeometry();
      out.setAttribute('position', new T.BufferAttribute(pos, 3));
      out.setAttribute('normal', new T.BufferAttribute(nor, 3));
      out.setAttribute('uv', new T.BufferAttribute(uv, 2));
      out.setAttribute('skinIndex', new T.BufferAttribute(si, 4));
      out.setAttribute('skinWeight', new T.BufferAttribute(sw, 4));
      out.setIndex(idx);
      out.boundingSphere = BASE.boundingSphere.clone();
      return out;
    });
  }

  // ------------------------------------------------------------------
  // skins originales de Kenney (people-assets.js → skins): se decodifican una vez (imágenes data:, sin fetch)
  // ------------------------------------------------------------------
  var SK = AS.skins, SKD = null, skinWait = [];
  var KS = [245, 147, 115];   // piel salmón de Kenney (todas las cabezas vienen normalizadas a este color)
  var HW = 320, HH = 244;     // cuadrante de la cabeza a 512 px (filas 0..243; desde la 244 es el torso)
  function imgPixels(im) {
    var c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    var g = c.getContext('2d'); g.drawImage(im, 0, 0);
    return g.getImageData(0, 0, im.width, im.height).data;
  }
  (function loadSkins() {
    var list = [['body', SK.body], ['erase', SK.erase]], ims = {}, left;
    SK.order.forEach(function (n) { list.push(['h:' + n, SK.heads[n].img]); list.push(['m:' + n, SK.heads[n].mask]); });
    left = list.length;
    list.forEach(function (it) {
      var im = new Image();
      im.onload = function () {
        ims[it[0]] = im;
        if (--left) return;
        SKD = { body: imgPixels(ims.body), erase: ims.erase, head: {}, mask: {} };
        SK.order.forEach(function (n) { SKD.head[n] = imgPixels(ims['h:' + n]); SKD.mask[n] = imgPixels(ims['m:' + n]); });
        var w = skinWait; skinWait = [];
        w.forEach(function (f) { f(); });
      };
      im.onerror = function () { console.error('[CasinoPeople] no se pudo leer la skin', it[0]); };
      im.src = it[1];
    });
  })();
  function whenSkins(f) { if (SKD) f(); else skinWait.push(f); }

  // ------------------------------------------------------------------
  // pintura de la ropa (coordenadas de la textura original de Kenney, 1024 x 1024; ver docs/CREDITOS_PERSONAJES.md)
  //   cabeza 0..640 x 0..490 (frente al centro, x = 322; la nuca en los bordes) · torso en cruz 0..640 x 490..1024
  //   (espalda arriba, cuello en (322, 728..795), panza abajo; brazos en la franja y 660..815, antebrazos en los
  //   extremos) · manos 640..1024 x 130..770 · zapatos 640..830 x 0..520 · pantalón 620..1024 x 770..1024
  // La ropa se pinta plana y después se multiplica por el sombreado de Kenney (body.R); la cabeza es la original.
  // ------------------------------------------------------------------
  function css(n) { return '#' + ('000000' + (n >>> 0).toString(16)).slice(-6); }
  function mul(c, f) { return new T.Color(c).multiplyScalar(f).getHex(); }
  function mix(a, b, f) { return new T.Color(a).lerp(new T.Color(b), f).getHex(); }
  function rgb(n) { return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  var NECK_Y = 734, CX = 322;
  function ell(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); }
  function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function poly(g, pts, col) { g.fillStyle = css(col); g.beginPath(); g.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); }
  function box(g, x, y, w, h, col) { g.fillStyle = css(col); g.fillRect(x, y, w, h); }
  // escote redondo de Kenney (el aro del cuello ya viene en el sombreado)
  function neckHole(g, col) { g.fillStyle = css(col); g.beginPath(); g.moveTo(289, 727); g.lineTo(355, 727); g.quadraticCurveTo(362, 797, CX, 797); g.quadraticCurveTo(282, 797, 289, 727); g.fill(); }

  // piel: el tono del juego llevado un poco hacia el salmón de Kenney (más cálido y saturado)
  function kenneySkin(c) {
    var col = new T.Color(c), h = col.getHSL({});
    col.setHSL(h.h + (0.05 - h.h) * 0.3, Math.min(0.85, h.s + 0.04), h.l);
    return col.getHex();
  }
  // qué skin original usa cada look (cara, pelo, cejas): por género, peinado y bigote
  function sourceOf(o) {
    var s = o.hairStyle;
    if (o.female) return s === 'bob' ? 'skater-female' : (s === 'ponytail' || s === 'bun') ? 'survivor-female' : 'cyborg-female';
    if (o.beard === 'mustache') return 'male';
    return (s === 'quiff' || s === 'curly' || s === 'side') ? 'skater-male' : 'survivor-male';
  }

  function paintBody(g, o) {
    var top = o.topColor != null ? o.topColor : o.shirt, sleeve = o.sleeveColor != null ? o.sleeveColor : top, skin = o.skinK;
    var kind = o.top || 'tee', longS = o.sleeves !== 'short';
    // torso entero y brazos
    box(g, 0, 488, 640, 536, top);
    if (kind === 'vest') { box(g, 0, 488, 640, 536, o.vest); box(g, 0, 640, 215, 200, sleeve); box(g, 430, 640, 210, 200, sleeve); }
    else if (sleeve !== top) { box(g, 0, 640, 215, 200, sleeve); box(g, 430, 640, 210, 200, sleeve); }
    if (!longS) { box(g, 0, 640, 150, 200, skin); box(g, 494, 640, 146, 200, skin); box(g, 148, 640, 8, 200, mul(sleeve, 0.85)); box(g, 488, 640, 8, 200, mul(sleeve, 0.85)); }
    else { var cf = o.cuff != null ? o.cuff : mul(sleeve, 0.85); box(g, 0, 640, 46, 200, cf); box(g, 594, 640, 46, 200, cf); }
    if (o.watch != null) box(g, longS ? 48 : 40, 640, 12, 200, o.watch);
    if (o.armband != null) { box(g, 160, 640, 14, 200, o.armband); box(g, 466, 640, 14, 200, o.armband); }
    var d = mul(top, 0.8), dd = mul(top, 0.62);
    switch (kind) {
      case 'tee':
        neckHole(g, skin);
        if (o.stripe != null) { box(g, 215, 900, 215, 30, o.stripe); box(g, 215, 560, 215, 30, o.stripe); }
        break;
      case 'polo':
        neckHole(g, d);
        poly(g, [CX - 24, NECK_Y - 6, CX + 24, NECK_Y - 6, CX, NECK_Y + 56], skin);
        poly(g, [CX - 62, NECK_Y - 8, CX - 4, NECK_Y - 6, CX - 30, NECK_Y + 40], d); poly(g, [CX + 62, NECK_Y - 8, CX + 4, NECK_Y - 6, CX + 30, NECK_Y + 40], d);
        box(g, CX - 5, NECK_Y + 54, 10, 60, mul(top, 0.88));
        g.fillStyle = '#f3e9d2'; ell(g, CX, NECK_Y + 74, 5, 5); ell(g, CX, NECK_Y + 100, 5, 5);
        break;
      case 'hoodie':
        g.strokeStyle = css(d); g.lineWidth = 22; g.beginPath(); g.ellipse(CX, NECK_Y + 28, 50, 46, 0, 0, TAU); g.stroke();
        neckHole(g, mul(top, 0.5));
        g.strokeStyle = '#f3e9d2'; g.lineWidth = 6; g.beginPath(); g.moveTo(CX - 18, NECK_Y + 70); g.lineTo(CX - 20, NECK_Y + 140); g.moveTo(CX + 18, NECK_Y + 70); g.lineTo(CX + 20, NECK_Y + 140); g.stroke();
        g.fillStyle = css(mul(top, 0.86)); rrect(g, 240, 900, 164, 78, 20); g.fill();
        break;
      case 'suit': {
        neckHole(g, skin);
        poly(g, [CX - 62, NECK_Y - 8, CX + 62, NECK_Y - 8, CX, NECK_Y + 170], o.shirt);
        g.strokeStyle = css(d); g.lineWidth = 20; g.beginPath(); g.moveTo(CX - 72, NECK_Y - 6); g.lineTo(CX - 6, NECK_Y + 182); g.moveTo(CX + 72, NECK_Y - 6); g.lineTo(CX + 6, NECK_Y + 182); g.stroke();
        if (o.tie != null) {
          poly(g, [CX - 11, NECK_Y + 50, CX + 11, NECK_Y + 50, CX + 7, NECK_Y + 70, CX - 7, NECK_Y + 70], mul(o.tie, 0.85));
          poly(g, [CX - 7, NECK_Y + 70, CX + 7, NECK_Y + 70, CX + 13, NECK_Y + 170, CX, NECK_Y + 184, CX - 13, NECK_Y + 170], o.tie);
        }
        if (o.trim != null) poly(g, [244, 900, 274, 900, 268, 912, 248, 912], o.trim);  // pañuelo
        g.fillStyle = css(dd); ell(g, CX, 930, 6, 6); ell(g, CX, 966, 6, 6);
        box(g, 236, 950, 44, 6, d); box(g, 364, 950, 44, 6, d);  // bolsillos
        break;
      }
      case 'vest': {
        neckHole(g, skin);
        poly(g, [CX - 46, NECK_Y - 8, CX + 46, NECK_Y - 8, CX, NECK_Y + 150], o.shirt);
        if (o.bow != null) { var by = NECK_Y + 62; poly(g, [CX, by, CX - 28, by - 13, CX - 28, by + 13], o.bow); poly(g, [CX, by, CX + 28, by - 13, CX + 28, by + 13], o.bow); g.fillStyle = css(mul(o.bow, 0.8)); ell(g, CX, by, 6, 7); }
        g.fillStyle = '#d9a84a'; ell(g, CX, 905, 6, 6); ell(g, CX, 938, 6, 6); ell(g, CX, 971, 6, 6);
        box(g, 248, 880, 40, 14, 0xf3e9d2);   // gafete
        break;
      }
      case 'guard':
        neckHole(g, skin);
        poly(g, [CX - 30, NECK_Y + 56, CX + 30, NECK_Y + 56, CX, NECK_Y + 96], mul(top, 0.7));
        box(g, 244, 870, 52, 12, d); box(g, 348, 870, 52, 12, d);   // bolsillos
        poly(g, [262, 892, 286, 892, 286, 910, 274, 920, 262, 910], o.badge != null ? o.badge : 0xd9a84a);
        box(g, 356, 888, 16, 30, 0x0b0c0e); box(g, 368, 878, 3, 12, 0x0b0c0e);  // radio
        box(g, 215, 560, 215, 16, o.badge != null ? mix(o.badge, top, 0.3) : 0xd9a84a);   // tira de la espalda
        break;
      case 'coverall':
        neckHole(g, skin);
        box(g, 215, 925, 215, 22, 0xe8e8d8); box(g, 215, 568, 215, 22, 0xe8e8d8); box(g, 60, 640, 16, 200, 0xe8e8d8); box(g, 564, 640, 16, 200, 0xe8e8d8);
        box(g, 248, 846, 42, 40, d); box(g, 248, 846, 42, 8, dd);
        poly(g, [CX - 30, NECK_Y + 56, CX + 30, NECK_Y + 56, CX, NECK_Y + 92], mul(top, 0.7));
        break;
      case 'apron':
        neckHole(g, skin);
        box(g, 236, 800, 172, 210, o.apron); box(g, 252, 770, 12, 34, o.apron); box(g, 380, 770, 12, 34, o.apron);
        box(g, 280, 900, 84, 44, mul(o.apron, 1.3));
        break;
      case 'dress':
        poly(g, [CX - 60, NECK_Y - 8, CX + 60, NECK_Y - 8, CX, NECK_Y + 90], skin); neckHole(g, skin);
        g.fillStyle = '#d9a84a'; for (var i = 0; i <= 8; i++) { var a = i / 8, x = CX - 44 + a * 88, y = NECK_Y + 70 + Math.sin(a * PI) * 22; ell(g, x, y, 4, 4); }
        break;
    }
    if (o.necklace != null && kind !== 'dress') { g.strokeStyle = css(o.necklace); g.lineWidth = 4; g.beginPath(); g.arc(CX, NECK_Y + 30, 40, 0.2 * PI, 0.8 * PI); g.stroke(); }
    // cintura del torso (abajo adelante, arriba atrás)
    var waist = o.belt != null ? o.belt : (kind === 'coverall' || kind === 'dress' ? top : o.pants);
    box(g, 150, 992, 340, 32, waist); box(g, 150, 486, 340, 18, waist);
    if (o.belt != null) box(g, CX - 12, 994, 24, 18, 0xc9a24a);
    // manos (piel) y zapatos (la capellada clara la pone el sombreado: body.G)
    var shoe = o.shoes != null ? o.shoes : 0x141414, sole = o.sole != null ? o.sole : 0x2a2420;
    box(g, 640, 130, 384, 640, skin);
    box(g, 640, 0, 192, 520, shoe); box(g, 640, 20, 192, 112, sole);
    // pantalón (o falda / pierna de mameluco)
    var legC = kind === 'coverall' ? top : (kind === 'dress' ? top : o.pants);
    box(g, 620, 770, 404, 254, legC);
    if (kind === 'dress') box(g, 620, 905, 404, 119, skin);
    else box(g, 620, 776, 404, 22, o.belt != null ? o.belt : mul(legC, 0.85));
    if (kind === 'coverall') box(g, 620, 935, 404, 16, 0xe8e8d8);
    if (o.tools) { box(g, 640, 820, 40, 46, 0x5a3a1a); box(g, 980, 820, 40, 46, 0x5a3a1a); }
    // parches para los accesorios de la malla
    box(g, 20, 860, 40, 40, o.hatColor != null ? o.hatColor : top); box(g, 80, 860, 40, 40, o.hatColor != null ? mul(o.hatColor, o.hat === 'guard' ? 1 : 0.8) : top);
    box(g, 20, 940, 40, 40, 0xd9a84a); box(g, 80, 940, 40, 40, 0x3a2a14);
    box(g, SKIN_PATCH[0] - 16, SKIN_PATCH[1] - 16, 32, 32, skin);   // muestra de piel para borrar ojos y boca en los gestos
  }
  var SKIN_PATCH = [40, 1004];

  // cabeza original + teñido de piel/pelo/cejas, sombreado de Kenney en la ropa y capellada de los zapatos
  function bakePixels(g, o) {
    var img = g.getImageData(0, 0, TS, TS), d = img.data, B = SKD.body, src = o.src;
    var HD = SKD.head[src], MK = SKD.mask[src], inf = SK.info[src];
    var sk = rgb(o.skinK), rr = sk[0] / KS[0], rg = sk[1] / KS[1], rb = sk[2] / KS[2];
    var hc = rgb(o.hair), hs = inf.hair, bs = inf.brow;
    var dh = [hc[0] - hs[0], hc[1] - hs[1], hc[2] - hs[2]];
    var lumH = hc[0] * 0.3 + hc[1] * 0.59 + hc[2] * 0.11;
    var bt = lumH > 70 ? [hc[0] * 0.62, hc[1] * 0.62, hc[2] * 0.62] : bs;   // cejas: el pelo más oscuro (si es oscuro, las del original)
    var db = [bt[0] - bs[0], bt[1] - bs[1], bt[2] - bs[2]];
    var bald = o.hairStyle === 'bald', buzz = o.hairStyle === 'buzz';
    var dbald = [sk[0] * 0.96 - hs[0], sk[1] * 0.96 - hs[1], sk[2] * 0.96 - hs[2]];
    for (var y = 0; y < HH; y++) {
      // pelado: arriba de la línea de las orejas el "pelo" es piel; buzz: pelo al ras (mezcla con la piel)
      var kb = bald ? Math.min(1, Math.max(0, (96 - y) / 8)) : buzz ? 0.35 : 0;
      var ex = dh[0] + (dbald[0] - dh[0]) * kb, ey = dh[1] + (dbald[1] - dh[1]) * kb, ez = dh[2] + (dbald[2] - dh[2]) * kb;
      for (var x = 0; x < HW; x++) {
        var hi = (y * HW + x) * 4, di = (y * TS + x) * 4;
        var ws = MK[hi] / 255, wh = MK[hi + 1] / 255, wb = MK[hi + 2] / 255;
        d[di] = HD[hi] * (1 + ws * (rr - 1)) + wh * ex + wb * db[0];
        d[di + 1] = HD[hi + 1] * (1 + ws * (rg - 1)) + wh * ey + wb * db[1];
        d[di + 2] = HD[hi + 2] * (1 + ws * (rb - 1)) + wh * ez + wb * db[2];
      }
    }
    var shoeC = o.shoes != null ? o.shoes : 0x141414, sl = new T.Color(shoeC).getHSL({}).l;
    // capellada: zapatillas de color con la parte clara de Kenney; zapatos oscuros apenas un brillo
    var lt = rgb(sl < 0.15 ? mix(shoeC, 0x5a5a5a, 0.35) : mix(shoeC, 0xf4f1ea, 0.85));
    for (var py = 0; py < TS; py++) {
      for (var px = py < HH ? HW : 0, j = (py * TS + px) * 4, je = (py + 1) * TS * 4; j < je; j += 4) {
        var f = B[j] / 200, a = B[j + 1] / 255;
        if (a > 0) { d[j] += (lt[0] - d[j]) * a; d[j + 1] += (lt[1] - d[j + 1]) * a; d[j + 2] += (lt[2] - d[j + 2]) * a; }
        if (f !== 1) { d[j] *= f; d[j + 1] *= f; d[j + 2] *= f; }
      }
    }
    g.putImageData(img, 0, 0);
  }
  // detalles que van arriba de la cara original: barba, anteojos, aros
  function paintFaceExtras(g, o) {
    var inf = SK.info[o.src], hc = css(mul(o.hair, 0.95)), m = inf.mouth;
    if (o.beard === 'full') {
      g.fillStyle = hc; g.beginPath(); g.moveTo(250, 228); g.quadraticCurveTo(254, 300, CX, 306); g.quadraticCurveTo(390, 300, 394, 228);
      g.lineTo(378, 228); g.quadraticCurveTo(370, 284, CX, 290); g.quadraticCurveTo(274, 284, 266, 228); g.closePath(); g.fill();
    }
    if (o.beard === 'full' || (o.beard === 'mustache' && o.src !== 'male')) {
      var my = Math.min(m[1] - 9, 256);
      g.fillStyle = hc; g.beginPath(); g.moveTo(CX - 30, my + 9); g.quadraticCurveTo(CX - 20, my - 4, CX, my + 1); g.quadraticCurveTo(CX + 20, my - 4, CX + 30, my + 9);
      g.quadraticCurveTo(CX + 14, my + 4, CX, my + 8); g.quadraticCurveTo(CX - 14, my + 4, CX - 30, my + 9); g.fill();
    }
    if (o.earrings != null) { g.fillStyle = css(o.earrings); ell(g, 186, 266, 5, 5); ell(g, 458, 266, 5, 5); }
    if (o.glasses != null) {
      var e = inf.eyes, L = e[0], R = e[1] || [2 * CX - e[0][0], e[0][1]];
      g.strokeStyle = css(o.glasses); g.lineWidth = 4.5;
      [L, R].forEach(function (p) { g.beginPath(); g.ellipse(p[0], p[1], 17, 15, 0, 0, TAU); g.stroke(); });
      g.beginPath(); g.moveTo(L[0] + 17, L[1] - 2); g.lineTo(R[0] - 17, R[1] - 2); g.stroke();
      g.beginPath(); g.moveTo(L[0] - 17, L[1] - 3); g.lineTo(200, L[1] - 8); g.moveTo(R[0] + 17, R[1] - 3); g.lineTo(444, R[1] - 8); g.stroke();
    }
  }

  // caché de looks: textura (512) + materiales por gesto. Los looks que nadie usa hace rato se liberan (tope MAX_IDLE).
  var CR = (window.CASINO_DATA && window.CASINO_DATA.CROWD) || {};
  var MAX_IDLE = CR.lookCache || 24, IDLE_MS = (CR.lookIdleSec || 4) * 1000, _looks = new Map();
  function now() { return Date.now(); }
  function lookEntry(o) {
    var e = _looks.get(o.key);
    if (e) { e.used = now(); return e; }
    e = { key: o.key, tex: makeLookTex(o), mats: {}, used: now() };
    _looks.set(o.key, e); _texs.set(o.key, e.tex);
    trimLooks();
    return e;
  }
  function trimLooks() {
    if (_looks.size <= MAX_IDLE) return;
    var t = now(), idle = [];
    _looks.forEach(function (e) { if (!e.pinned && t - e.used > IDLE_MS) idle.push(e); });
    idle.sort(function (a, b) { return a.used - b.used; });
    for (var i = 0; i < idle.length - MAX_IDLE; i++) dropLook(idle[i]);
  }
  function dropLook(e) {
    _looks.delete(e.key); _texs.delete(e.key);
    for (var k in e.mats) { e.mats[k].dispose(); _mats.delete(e.key + '|' + k); }
    e.tex.dispose(); e.dropped = true;
  }
  function makeLookTex(o) {
    o.src = sourceOf(o); o.skinK = kenneySkin(o.skin);
    // remera casi del color de la piel: de lejos parece que va sin remera; se oscurece un poco
    if ((o.top === 'tee' || o.top === 'polo' || o.top === 'hoodie') && o.topColor != null) {
      var a = rgb(o.topColor), k = rgb(o.skinK);
      if (Math.abs(a[0] - k[0]) + Math.abs(a[1] - k[1]) + Math.abs(a[2] - k[2]) < 110) { o.topColor = mul(o.topColor, 0.55); o.sleeveColor = o.topColor; }
    }
    var t = window.CasinoArt.canvasTex(TS, TS, function (g) { g.fillStyle = css(o.skinK); g.fillRect(0, 0, TS, TS); });
    t.flipY = false;   // UV de glTF: (0,0) arriba a la izquierda, igual que el canvas
    whenSkins(function () { queuePaint(function () {
      var g = t.userData.ctx;
      g.save(); g.setTransform(TS / 1024, 0, 0, TS / 1024, 0, 0);
      g.fillStyle = css(o.skinK); g.fillRect(0, 0, 1024, 1024);
      paintBody(g, o);
      g.restore();
      bakePixels(g, o);
      g.save(); g.setTransform(TS / 1024, 0, 0, TS / 1024, 0, 0); paintFaceExtras(g, o); g.restore();
      t.needsUpdate = true;
    }); });
    return t;
  }
  // pintar un look cuesta 10-40 ms: cuando entra mucha gente junta se pintan de a poco (CROWD.paintPerFrame por cuadro)
  // en vez de todos en el mismo cuadro. Mientras espera, la persona se ve con la ropa lisa del color de la piel un instante.
  var paintQ = [], paintOn = false;
  function queuePaint(f) {
    paintQ.push(f);
    if (!paintOn) { paintOn = true; requestAnimationFrame(drainPaint); }
  }
  function drainPaint() {
    var n = Math.max(1, CR.paintPerFrame || 1);
    while (n-- > 0 && paintQ.length) { try { paintQ.shift()(); } catch (e) { console.error('[CasinoPeople] look', e); } }
    if (paintQ.length) requestAnimationFrame(drainPaint); else paintOn = false;
  }
  function lookTex(o) { return lookEntry(o).tex; }

  // ------------------------------------------------------------------
  // gestos: atlas compartido con celdas de 128 px (una por skin y gesto, más una máscara de borrado por skin).
  // El shader borra los ojos (y la boca) originales con el color de piel del look (muestra en SKIN_PATCH) y dibuja
  // encima los ojos/boca del gesto, al estilo Kenney. Neutral = la cara original, sin tocar. Cejas, bigote y pelo quedan.
  // ------------------------------------------------------------------
  var EXPR = ['neutral', 'blink', 'happy', 'sad', 'angry', 'surprised', 'dizzy'];
  var FACE = { x: 246, y: 160, w: 152, h: 140 };   // rectángulo de la cara en la textura (coordenadas 1024)
  var FACE_RECT = new T.Vector4(FACE.x / 1024, FACE.y / 1024, FACE.w / 1024, FACE.h / 1024);
  var CELL = 128, PAD = 3, EMPTY = 63;
  var faceTex = null;
  function cellVec(c) { var x = (c % 8) * CELL + PAD, y = Math.floor(c / 8) * CELL + PAD; return new T.Vector4(x / 1024, y / 1024, (CELL - 2 * PAD) / 1024, (CELL - 2 * PAD) / 1024); }
  function inkCell(si, e) { return si * 6 + (e - 1); }           // 0..35
  function eraseCell(si, mouth) { return 36 + si * 2 + (mouth ? 1 : 0); }  // 36..47
  var INK = '#2e1714', MOUTH_C = '#4a1a14';
  function drawExpr(g, src, expr) {
    var inf = SK.info[src], female = /female/.test(src);
    var m = inf.mouth.slice(); if (src === 'skater-male') m[1] = 278; if (src === 'male') m[1] = 281;
    var ms = src === 'male' ? 0.8 : 1;
    g.lineCap = 'round'; g.lineJoin = 'round';
    function stroke(w, col) { g.lineWidth = w; g.strokeStyle = col || INK; g.stroke(); }
    inf.eyes.forEach(function (p) {
      var x = p[0], y = p[1], w = p[2], h = p[3], s = x < CX ? 1 : -1;   // s: hacia el centro de la cara
      g.fillStyle = INK;
      if (expr === 'blink') { g.beginPath(); g.moveTo(x - w * 0.62, y + 1); g.quadraticCurveTo(x, y + h * 0.42, x + w * 0.62, y + 1); stroke(4.5); }
      else if (expr === 'happy') { g.beginPath(); g.moveTo(x - w * 0.6, y + h * 0.22); g.quadraticCurveTo(x, y - h * 0.62, x + w * 0.6, y + h * 0.22); stroke(5); }
      else if (expr === 'dizzy') { g.beginPath(); g.moveTo(x - 7, y - 7); g.lineTo(x + 7, y + 7); g.moveTo(x - 7, y + 7); g.lineTo(x + 7, y - 7); stroke(4.5); }
      else if (expr === 'surprised') { ell(g, x, y - 1, w * 0.62, h * 0.62); }
      else {
        // enojado / triste: el ojo de Kenney con el párpado cortado en diagonal
        g.save(); g.beginPath();
        var ti = expr === 'angry' ? y - h * 0.05 : y - h * 0.62, to = expr === 'angry' ? y - h * 0.62 : y - h * 0.12;
        g.moveTo(x + s * w, ti - (expr === 'angry' ? 0 : 0)); g.lineTo(x - s * w, to); g.lineTo(x - s * w, y + h); g.lineTo(x + s * w, y + h); g.closePath(); g.clip();
        ell(g, x, y, w / 2, h / 2); g.restore();
      }
      if (female && expr !== 'dizzy' && expr !== 'happy') { g.beginPath(); g.moveTo(x - s * w * 0.35, y - h * 0.38); g.lineTo(x - s * w * 0.8, y - h * 0.62); stroke(3.2); }
    });
    var mx = m[0], my = m[1];
    g.save(); g.translate(mx, my); g.scale(ms, ms);
    if (expr === 'happy') {
      g.fillStyle = MOUTH_C; g.beginPath(); g.moveTo(-15, -4); g.quadraticCurveTo(0, -1, 15, -4); g.quadraticCurveTo(13, 16, 0, 17); g.quadraticCurveTo(-13, 16, -15, -4); g.fill();
      g.fillStyle = '#e0675f'; ell(g, 0, 10, 7, 4);
    } else if (expr === 'sad') { g.beginPath(); g.moveTo(-11, 5); g.quadraticCurveTo(0, -5, 11, 5); stroke(4.2, MOUTH_C); }
    else if (expr === 'angry') { g.fillStyle = MOUTH_C; rrect(g, -13, -3, 26, 9, 4); g.fill(); g.fillStyle = '#f4efe6'; g.fillRect(-9, -2, 18, 3); }
    else if (expr === 'surprised') { g.fillStyle = MOUTH_C; ell(g, 0, 2, 7, 9); }
    else if (expr === 'dizzy') { g.beginPath(); g.moveTo(-13, 0); g.quadraticCurveTo(-9.5, -5, -6.5, 0); g.quadraticCurveTo(-3.2, 5, 0, 0); g.quadraticCurveTo(3.2, -5, 6.5, 0); g.quadraticCurveTo(9.5, 5, 13, 0); stroke(3.6, MOUTH_C); }
    g.restore();
  }
  function faceAtlas() {
    if (faceTex) return faceTex;
    faceTex = window.CasinoArt.canvasTex(1024, 1024, function (g) { g.clearRect(0, 0, 1024, 1024); });
    faceTex.flipY = false; faceTex.generateMipmaps = false; faceTex.minFilter = T.LinearFilter;
    whenSkins(function () {
      var g = faceTex.userData.ctx, sc = (CELL - 2 * PAD);
      // máscaras de borrado: blanco con alfa = máscara
      var er = SKD.erase, tmp = document.createElement('canvas'); tmp.width = er.width; tmp.height = er.height;
      var tg = tmp.getContext('2d'); tg.drawImage(er, 0, 0);
      var id = tg.getImageData(0, 0, er.width, er.height), dd = id.data;
      for (var i = 0; i < dd.length; i += 4) { dd[i + 3] = dd[i]; dd[i] = dd[i + 1] = dd[i + 2] = 255; }
      tg.putImageData(id, 0, 0);
      SK.order.forEach(function (n, si) {
        for (var mth = 0; mth < 2; mth++) {
          var c = eraseCell(si, mth), cx = (c % 8) * CELL + PAD, cy = Math.floor(c / 8) * CELL + PAD;
          g.drawImage(tmp, si * FACE.w, mth * FACE.h, FACE.w, FACE.h, cx, cy, sc, sc);
        }
        for (var e = 1; e < EXPR.length; e++) {
          var k = inkCell(si, e), kx = (k % 8) * CELL + PAD, ky = Math.floor(k / 8) * CELL + PAD;
          g.save(); g.beginPath(); g.rect(kx, ky, sc, sc); g.clip();
          g.setTransform(sc / FACE.w, 0, 0, sc / FACE.h, kx - FACE.x * sc / FACE.w, ky - FACE.y * sc / FACE.h);
          drawExpr(g, n, EXPR[e]);
          g.restore();
        }
      });
      faceTex.needsUpdate = true;
    });
    return faceTex;
  }
  function cellsOf(src, expr) {
    var e = EXPR.indexOf(expr), si = SK.order.indexOf(src);
    if (e <= 0 || si < 0) return [cellVec(EMPTY), cellVec(EMPTY)];
    return [cellVec(inkCell(si, e)), cellVec(eraseCell(si, expr !== 'blink'))];
  }
  var SKIN_UV = new T.Vector2(SKIN_PATCH[0] / 1024, SKIN_PATCH[1] / 1024);
  // mismo texto de shader para todos: un solo programa compartido
  function patchShader(sh) {
    sh.uniforms.faceMap = { value: faceAtlas() };
    sh.uniforms.faceRect = { value: FACE_RECT };
    sh.uniforms.faceCell = { value: this.userData.faceCell };
    sh.uniforms.eraseCell = { value: this.userData.eraseCell };
    sh.uniforms.skinUv = { value: SKIN_UV };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\nuniform sampler2D faceMap;\nuniform vec4 faceRect;\nuniform vec4 faceCell;\nuniform vec4 eraseCell;\nuniform vec2 skinUv;')
      .replace('#include <map_fragment>', [
        '#ifdef USE_MAP',
        '  vec4 texelColor = texture2D( map, vUv );',
        '  vec2 fq = ( vUv - faceRect.xy ) / faceRect.zw;',
        '  float inFace = step( 0.0, fq.x ) * step( fq.x, 1.0 ) * step( 0.0, fq.y ) * step( fq.y, 1.0 );',
        '  vec2 cq = clamp( fq, 0.0, 1.0 );',
        '  vec4 fc = texture2D( faceMap, faceCell.xy + cq * faceCell.zw );',
        '  float er = texture2D( faceMap, eraseCell.xy + cq * eraseCell.zw ).a * inFace;',
        '  texelColor.rgb = mix( texelColor.rgb, texture2D( map, skinUv ).rgb, er );',
        '  texelColor.rgb = mix( texelColor.rgb, fc.rgb, fc.a * inFace );',
        '  texelColor = mapTexelToLinear( texelColor );',
        '  diffuseColor *= texelColor;',
        '#endif',
      ].join('\n'));
  }
  function programKey() { return 'casino-persona-kenney-2'; }
  function matFor(o, expr, e) {
    e = e || lookEntry(o);
    var m = e.mats[expr];
    if (m) return m;
    // MeshStandardMaterial después de perf.js: fuera de Gráficos "Alta" sale Lambert, como el resto del juego
    m = new T.MeshStandardMaterial({ map: e.tex, skinning: true, roughness: 0.8, metalness: 0 });
    var c = cellsOf(o.src, expr);
    m.userData.faceCell = c[0]; m.userData.eraseCell = c[1];
    m.onBeforeCompile = patchShader;
    m.customProgramCacheKey = programKey;
    e.mats[expr] = m; _mats.set(o.key + '|' + expr, m);
    return m;
  }

  // ------------------------------------------------------------------
  // brazo en primera persona: el brazo de Kenney (huesos armX + elbowX) recortado de la misma malla, como malla fija.
  // Origen en la muñeca, la mano apunta a -Z y el codo queda en +Z (a ~0,24 m). Lo usan owner.js y combat.js.
  // ------------------------------------------------------------------
  var _armGeo = {};
  // part: nada = brazo entero (con la manga), 'fore' = antebrazo y mano, 'hand' (o true) = solo la mano
  function armGeometry(side, part) {
    var handOnly = part === true || part === 'hand', fist = part === 'fist', fore = part === 'fore' || fist;
    var key = (side < 0 ? 'L' : 'R') + (handOnly ? 'h' : fist ? 'p' : fore ? 'f' : '');
    if (_armGeo[key]) return _armGeo[key];
    if (!BASE) return null;
    var ba = side < 0 ? 7 : 9, be = side < 0 ? 8 : 10;
    var P = BASE.attributes.position, N = BASE.attributes.normal, U = BASE.attributes.uv, SI = BASE.attributes.skinIndex, SW = BASE.attributes.skinWeight, idx = BASE.index.array;
    function dom(i) { var b = SI.getX(i), w = SW.getX(i); if (SW.getY(i) > w) { b = SI.getY(i); w = SW.getY(i); } if (SW.getZ(i) > w) { b = SI.getZ(i); w = SW.getZ(i); } if (SW.getW(i) > w) b = SI.getW(i); return b; }
    function ok(i) { var b = dom(i); return handOnly ? (b === be && U.getX(i) > 0.6) : fore ? b === be : (b === be || b === ba); }
    // la muñeca: el borde de arriba de la mano (UV en la zona de manos)
    var wy = -1e9, wx = 0, wz = 0, nH = 0;
    for (var i = 0; i < P.count; i++) if (dom(i) === be && U.getX(i) > 0.6) { if (P.getY(i) > wy) wy = P.getY(i); wx += P.getX(i); wz += P.getZ(i); nH++; }
    wx /= nH; wz /= nH;
    var pos = [], nor = [], uv = [];
    for (var t = 0; t < idx.length; t += 3) {
      var a = idx[t], b = idx[t + 1], c = idx[t + 2];
      if (!ok(a) || !ok(b) || !ok(c)) continue;
      [a, b, c].forEach(function (v) {
        // brazo colgando (-Y) → hacia adelante (-Z): rotación de +90° en X alrededor de la muñeca
        var x = P.getX(v) - wx, y = P.getY(v) - wy, z = P.getZ(v) - wz;
        var nz = N.getY(v);
        // puño: la mano aplastada hacia la muñeca (dedos cerrados) y un poco más gruesa
        if (fist && y < 0) { y *= 0.5; x *= 1.15; z *= 0.7; nz *= 2; }
        pos.push(x, z, y); nor.push(N.getX(v), N.getZ(v), nz); uv.push(U.getX(v), U.getY(v));
      });
    }
    // (x, y, z) → (x, z, y) espeja; se invierte el orden de los triángulos para que las caras sigan mirando afuera
    for (var q = 0; q < pos.length; q += 9) { for (var k = 0; k < 3; k++) { var tmp = pos[q + 3 + k]; pos[q + 3 + k] = pos[q + 6 + k]; pos[q + 6 + k] = tmp; tmp = nor[q + 3 + k]; nor[q + 3 + k] = nor[q + 6 + k]; nor[q + 6 + k] = tmp; } }
    for (var q2 = 0; q2 < uv.length; q2 += 6) { for (var k2 = 0; k2 < 2; k2++) { var t2 = uv[q2 + 2 + k2]; uv[q2 + 2 + k2] = uv[q2 + 4 + k2]; uv[q2 + 4 + k2] = t2; } }
    var gm = new T.BufferGeometry();
    gm.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    gm.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    gm.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    if (fist) gm.computeVertexNormals();   // (no indexada: normales planas por cara, quedan facetadas como Kenney)
    gm.computeBoundingSphere();
    _armGeo[key] = gm;
    return gm;
  }
  // material de las manos en primera persona: la textura del look del dueño (owner.js la cambia con setFPLook)
  var fpMat = null, fpKey = null;
  function fpMaterial() {
    if (!fpMat) fpMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0 });
    return fpMat;
  }
  function setFPLook(o) {
    var m = fpMaterial();
    if (!o || o.key === fpKey) return;
    fpKey = o.key;
    _looks.forEach(function (e) { e.pinned = false; });
    var e = lookEntry(o); e.pinned = true;
    var had = !!m.map; m.map = e.tex; if (!had) m.needsUpdate = true;
  }
  // ------------------------------------------------------------------
  // build(o, root): huesos + malla de una persona. Devuelve { J, mesh, setFace(expr) }.
  // ------------------------------------------------------------------
  var IDENT = new T.Matrix4();
  function touch(e) {
    e.used = now();
    if (e.dropped) {   // se había liberado pero la persona sigue viva: vuelve a la caché (la placa la sube de nuevo sola)
      e.dropped = false; _looks.set(e.key, e); _texs.set(e.key, e.tex);
      for (var k in e.mats) _mats.set(e.key + '|' + k, e.mats[k]);
      trimLooks();
    }
  }
  function build(o, root) {
    var bones = makeBones(), J = {};
    NAMES.forEach(function (n, i) { J[n] = bones[i]; });
    var body = { J: J, mesh: null, expr: 'neutral', bones: bones, entry: null };
    root.userData.personLook = o;   // owner.js lo usa para las manos en primera persona
    function attach() {
      body.entry = lookEntry(o);
      var mesh = new T.SkinnedMesh(geometryFor(o), matFor(o, body.expr, body.entry));
      mesh.name = 'PersonBody';
      mesh.add(bones[0]); root.add(mesh);
      mesh.bind(new T.Skeleton(bones, IBM), IDENT);
      body.mesh = mesh;
      if (body.onMesh) body.onMesh(mesh);
    }
    body.setFace = function (expr) {
      var e = body.entry;
      if (e) touch(e);   // marca el look como en uso (lo llama la animación en cada cuadro)
      if (body.expr === expr) return; body.expr = expr;
      if (body.mesh) body.mesh.material = matFor(o, expr, body.entry);
    };
    if (BASE) attach();
    else { root.add(bones[0]); pending.push(attach); }   // el modelo todavía se está leyendo: la malla llega enseguida
    return body;
  }

  window.CasinoPeople = {
    build: build,
    get ready() { return !!BASE; },
    get skinsReady() { return !!SKD; },
    HIP_Y: HIP_Y, SIT_OFF: SIT_OFF,
    EXPRESSIONS: EXPR,
    SOURCES: SK.order,
    sourceOf: sourceOf,
    lookTex: lookTex, faceAtlas: faceAtlas,
    // manos en primera persona (owner.js, combat.js)
    armGeometry: armGeometry, fpMaterial: fpMaterial, setFPLook: setFPLook,
    cache: { geometries: _geos, textures: _texs, materials: _mats, looks: _looks },
  };
})();
