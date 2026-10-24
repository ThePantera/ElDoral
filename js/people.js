// people.js · Cuerpos de las personas con el personaje de Kenney (CC0)
// El modelo (una sola malla con 11 huesos, ya en pose de descanso) viene embebido en people-assets.js y se parsea con
// THREE.GLTFLoader.parse, así el juego sigue abriendo con doble clic (file://, sin fetch). Todas las personas comparten la
// misma geometría; lo que cambia es la textura de ropa, que se pinta en un canvas por "look" sobre el mapa UV de Kenney
// (pelo, piel, remera, mangas, pantalón, zapatos...) y se cachea por clave de look.
// Caras: los rasgos (cejas, ojos, boca) no van en la textura del look sino en un atlas compartido con todas las expresiones
// (neutral, blink, happy, sad, angry, surprised, dizzy; versión mujer con pestañas y labios). El shader mezcla la celda de la
// expresión dentro del rectángulo de la cara, así cambiar de gesto es cambiar de material (uno por look y expresión, todos
// con el mismo programa y la misma textura): 1 SkinnedMesh por persona, sin piezas sueltas.
// art.js (makePerson) arma el "look" (resolveLook), pide el cuerpo acá y sigue animando sus propios huesos (J.hips, J.armR...).
(function () {
  'use strict';
  var T = window.THREE, AS = window.CasinoPeopleAssets;
  if (!T || !AS) { console.error('[CasinoPeople] falta THREE o people-assets.js'); return; }
  var PI = Math.PI, TAU = PI * 2;
  var TS = 256;   // lado de la textura de ropa (las coordenadas de pintura son las de la textura original de Kenney, 1024)

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
  // pintura de la ropa (coordenadas de la textura original de Kenney, 1024 x 1024; ver docs/CREDITOS_PERSONAJES.md)
  //   cabeza 0..640 x 0..490 (frente al centro, x = 322; la nuca en los bordes) · torso en cruz 0..640 x 490..1024
  //   (espalda arriba, pecho al centro con el escote en y ~723, panza abajo; brazos en la franja y 650..830, antebrazos
  //   en los extremos) · manos 640..1024 x 130..720 · zapatos 640..830 x 0..520 · pantalón 620..1024 x 770..1024
  // ------------------------------------------------------------------
  function css(n) { return '#' + ('000000' + (n >>> 0).toString(16)).slice(-6); }
  function mul(c, f) { return new T.Color(c).multiplyScalar(f).getHex(); }
  function mix(a, b, f) { return new T.Color(a).lerp(new T.Color(b), f).getHex(); }
  var NECK_Y = 723, CX = 322;

  function hairShape(g, style, color, alpha) {
    var masks = AS.hair, m = masks[style] || masks.short;
    g.save(); g.globalAlpha = alpha == null ? 1 : alpha; g.fillStyle = css(color);
    var dy = -10;  // la línea del pelo un poco más arriba: los ojos van más altos que en el original
    for (var r = 0; r < m.length; r++) {
      var row = m[r];
      for (var k = 0; k < row.length; k += 2) g.fillRect(row[k] * 2, r * 2 + dy, (row[k + 1] - row[k]) * 2, 2.6);
    }
    g.restore();
  }
  function paintHead(g, o) {
    var skin = o.skin, sh = o.hairStyle;
    // sombra del cuello bajo el mentón y orejas
    g.fillStyle = css(mul(skin, 0.955)); rrect(g, 236, 300, 172, 190, 46); g.fill();
    [186, 458].forEach(function (x) {
      g.fillStyle = css(mul(skin, 0.9)); ell(g, x, 238, 15, 23);
      g.strokeStyle = css(mul(skin, 0.78)); g.lineWidth = 4; g.beginPath(); g.arc(x + (x < CX ? 3 : -3), 240, 9, x < CX ? 0.6 * PI : -0.4 * PI, x < CX ? 1.4 * PI : 0.4 * PI); g.stroke();
    });
    // nariz
    g.fillStyle = css(mul(skin, 0.86)); ell(g, CX, 229, 9, 6);
    // pelo
    var style = { short: 'short', quiff: 'quiff', buzz: 'short', curly: 'side', bald: 'bald', long: 'long', bob: 'long', ponytail: 'long', bun: 'long', side: 'side' }[sh] || 'short';
    if (style === 'bald') {
      g.save(); g.beginPath(); g.rect(0, 205, 640, 300); g.clip(); hairShape(g, 'short', o.hair, 0.9); g.restore();
    } else hairShape(g, style, o.hair, sh === 'buzz' ? 0.6 : 1);
    if (o.female && (sh === 'long' || sh === 'bob' || sh === 'ponytail' || sh === 'curly')) {
      // melena: cae por la nuca y detrás de las orejas
      var low = sh === 'bob' ? 385 : 470;
      g.fillStyle = css(o.hair);
      if (sh === 'ponytail') { g.fillRect(0, 150, 46, 330); g.fillRect(594, 150, 46, 330); }
      else {
        g.beginPath(); g.moveTo(0, 200); g.lineTo(150, 200); g.quadraticCurveTo(170, 330, 128, low); g.lineTo(0, low); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(640, 200); g.lineTo(494, 200); g.quadraticCurveTo(474, 330, 512, low); g.lineTo(640, low); g.closePath(); g.fill();
      }
    }
    // barba y bigote
    var hc = css(mul(o.hair, 0.95));
    if (o.beard === 'full') {
      g.fillStyle = hc; g.beginPath(); g.moveTo(252, 222); g.quadraticCurveTo(256, 292, CX, 300); g.quadraticCurveTo(388, 292, 392, 222);
      g.lineTo(374, 222); g.quadraticCurveTo(366, 270, CX, 272); g.quadraticCurveTo(278, 270, 270, 222); g.closePath(); g.fill();
    }
    if (o.beard === 'full' || o.beard === 'mustache') { g.fillStyle = hc; rrect(g, CX - 24, 235, 48, 10, 5); g.fill(); g.beginPath(); g.moveTo(CX - 24, 240); g.quadraticCurveTo(CX - 30, 250, CX - 22, 252); g.lineTo(CX - 16, 243); g.fill(); g.beginPath(); g.moveTo(CX + 24, 240); g.quadraticCurveTo(CX + 30, 250, CX + 22, 252); g.lineTo(CX + 16, 243); g.fill(); }
    // aros y anteojos
    if (o.earrings != null) { g.fillStyle = css(o.earrings); ell(g, 186, 262, 5, 5); ell(g, 458, 262, 5, 5); }
    if (o.glasses != null) {
      g.strokeStyle = css(o.glasses); g.lineWidth = 4.5;
      [EYE_X[0], EYE_X[1]].forEach(function (x) { g.beginPath(); g.ellipse(x, EYE_Y, 17, 14, 0, 0, TAU); g.stroke(); });
      g.beginPath(); g.moveTo(EYE_X[0] + 17, EYE_Y - 2); g.lineTo(EYE_X[1] - 17, EYE_Y - 2); g.stroke();
      g.beginPath(); g.moveTo(EYE_X[0] - 17, EYE_Y - 3); g.lineTo(200, EYE_Y - 8); g.moveTo(EYE_X[1] + 17, EYE_Y - 3); g.lineTo(444, EYE_Y - 8); g.stroke();
    }
  }
  function ell(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); }
  function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function poly(g, pts, col) { g.fillStyle = css(col); g.beginPath(); g.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); }
  function box(g, x, y, w, h, col) { g.fillStyle = css(col); g.fillRect(x, y, w, h); }

  function paintBody(g, o) {
    var top = o.topColor != null ? o.topColor : o.shirt, sleeve = o.sleeveColor != null ? o.sleeveColor : top, skin = o.skin;
    var kind = o.top || 'tee', longS = o.sleeves !== 'short';
    // torso entero y brazos
    box(g, 0, 488, 640, 536, top);
    if (kind === 'vest') { box(g, 0, 488, 640, 536, o.vest); box(g, 0, 640, 200, 200, sleeve); box(g, 440, 640, 200, 200, sleeve); }
    else if (sleeve !== top) { box(g, 0, 640, 205, 200, sleeve); box(g, 435, 640, 205, 200, sleeve); }
    if (!longS) { box(g, 0, 640, 140, 200, skin); box(g, 500, 640, 140, 200, skin); box(g, 136, 640, 8, 200, mul(sleeve, 0.82)); box(g, 496, 640, 8, 200, mul(sleeve, 0.82)); }
    else { var cf = o.cuff != null ? o.cuff : mul(sleeve, 0.82); box(g, 0, 640, 44, 200, cf); box(g, 596, 640, 44, 200, cf); }
    if (o.watch != null) box(g, longS ? 46 : 40, 640, 12, 200, o.watch);
    if (o.armband != null) { box(g, 150, 640, 14, 200, o.armband); box(g, 476, 640, 14, 200, o.armband); }
    var d = mul(top, 0.78), dd = mul(top, 0.62);
    switch (kind) {
      case 'tee':
        g.fillStyle = css(mul(top, 0.8)); ell(g, CX, NECK_Y, 60, 34);
        g.fillStyle = css(skin); ell(g, CX, NECK_Y, 52, 27);
        if (o.stripe != null) { box(g, 150, 900, 340, 30, o.stripe); box(g, 150, 560, 340, 30, o.stripe); }
        break;
      case 'polo':
        poly(g, [CX - 26, NECK_Y - 4, CX + 26, NECK_Y - 4, CX, NECK_Y + 52], skin);
        poly(g, [CX - 60, NECK_Y - 8, CX - 4, NECK_Y - 6, CX - 30, NECK_Y + 38], d); poly(g, [CX + 60, NECK_Y - 8, CX + 4, NECK_Y - 6, CX + 30, NECK_Y + 38], d);
        box(g, CX - 5, NECK_Y + 50, 10, 60, mul(top, 0.86));
        g.fillStyle = '#f3e9d2'; ell(g, CX, NECK_Y + 70, 5, 5); ell(g, CX, NECK_Y + 96, 5, 5);
        break;
      case 'hoodie':
        g.strokeStyle = css(d); g.lineWidth = 22; g.beginPath(); g.ellipse(CX, NECK_Y, 62, 36, 0, 0, TAU); g.stroke();
        g.fillStyle = css(mul(top, 0.5)); ell(g, CX, NECK_Y, 48, 24);
        g.strokeStyle = '#f3e9d2'; g.lineWidth = 6; g.beginPath(); g.moveTo(CX - 18, NECK_Y + 30); g.lineTo(CX - 20, NECK_Y + 100); g.moveTo(CX + 18, NECK_Y + 30); g.lineTo(CX + 20, NECK_Y + 100); g.stroke();
        g.fillStyle = css(mul(top, 0.86)); rrect(g, 228, 900, 188, 78, 20); g.fill();
        break;
      case 'suit': {
        poly(g, [CX - 64, NECK_Y - 4, CX + 64, NECK_Y - 4, CX, NECK_Y + 160], o.shirt);
        g.strokeStyle = css(d); g.lineWidth = 20; g.beginPath(); g.moveTo(CX - 74, NECK_Y - 2); g.lineTo(CX - 6, NECK_Y + 172); g.moveTo(CX + 74, NECK_Y - 2); g.lineTo(CX + 6, NECK_Y + 172); g.stroke();
        if (o.tie != null) { poly(g, [CX - 11, NECK_Y + 2, CX + 11, NECK_Y + 2, CX + 7, NECK_Y + 22, CX - 7, NECK_Y + 22], mul(o.tie, 0.85)); poly(g, [CX - 7, NECK_Y + 22, CX + 7, NECK_Y + 22, CX + 13, NECK_Y + 150, CX, NECK_Y + 166, CX - 13, NECK_Y + 150], o.tie); }
        else { g.fillStyle = css(skin); poly(g, [CX - 26, NECK_Y, CX + 26, NECK_Y, CX, NECK_Y + 46], skin); }
        if (o.trim != null) poly(g, [236, NECK_Y + 72, 268, NECK_Y + 72, 262, NECK_Y + 84, 240, NECK_Y + 84], o.trim);  // pañuelo
        g.fillStyle = css(dd); ell(g, CX, 912, 6, 6); ell(g, CX, 950, 6, 6);
        box(g, 210, 930, 50, 6, d); box(g, 384, 930, 50, 6, d);  // bolsillos
        break;
      }
      case 'vest': {
        poly(g, [CX - 46, NECK_Y - 4, CX + 46, NECK_Y - 4, CX, NECK_Y + 130], o.shirt);
        if (o.bow != null) { poly(g, [CX, NECK_Y + 10, CX - 26, NECK_Y - 2, CX - 26, NECK_Y + 22], o.bow); poly(g, [CX, NECK_Y + 10, CX + 26, NECK_Y - 2, CX + 26, NECK_Y + 22], o.bow); g.fillStyle = css(mul(o.bow, 0.8)); ell(g, CX, NECK_Y + 10, 6, 7); }
        g.fillStyle = '#d9a84a'; ell(g, CX, 872, 6, 6); ell(g, CX, 905, 6, 6); ell(g, CX, 938, 6, 6);
        box(g, 236, 780, 40, 14, 0xf3e9d2);   // gafete
        break;
      }
      case 'guard':
        poly(g, [CX - 22, NECK_Y - 4, CX + 22, NECK_Y - 4, CX, NECK_Y + 30], mul(top, 0.7));
        box(g, 244, 762, 52, 12, d); box(g, 348, 762, 52, 12, d);   // bolsillos
        poly(g, [262, 782, 286, 782, 286, 800, 274, 810, 262, 800], o.badge != null ? o.badge : 0xd9a84a);
        box(g, 356, 778, 16, 30, 0x0b0c0e); box(g, 368, 768, 3, 12, 0x0b0c0e);  // radio
        box(g, 170, 560, 300, 16, o.badge != null ? mix(o.badge, top, 0.3) : 0xd9a84a);   // tira de la espalda
        break;
      case 'coverall':
        box(g, 150, 905, 340, 22, 0xe8e8d8); box(g, 150, 568, 340, 22, 0xe8e8d8); box(g, 60, 640, 16, 200, 0xe8e8d8); box(g, 564, 640, 16, 200, 0xe8e8d8);
        box(g, 248, 764, 42, 40, d); box(g, 248, 764, 42, 8, dd);
        poly(g, [CX - 22, NECK_Y - 4, CX + 22, NECK_Y - 4, CX, NECK_Y + 26], mul(top, 0.7));
        break;
      case 'apron':
        g.fillStyle = css(skin); ell(g, CX, NECK_Y, 46, 22);
        box(g, 212, 752, 220, 252, o.apron); box(g, 236, 728, 12, 30, o.apron); box(g, 396, 728, 12, 30, o.apron);
        box(g, 270, 880, 104, 44, mul(o.apron, 1.3));
        break;
      case 'dress':
        poly(g, [CX - 60, NECK_Y - 4, CX + 60, NECK_Y - 4, CX, NECK_Y + 80], skin);
        g.fillStyle = '#d9a84a'; for (var i = 0; i <= 8; i++) { var a = i / 8, x = CX - 44 + a * 88, y = NECK_Y + 6 + Math.sin(a * PI) * 22; ell(g, x, y, 4, 4); }
        break;
    }
    if (o.necklace != null && kind !== 'dress') { g.strokeStyle = css(o.necklace); g.lineWidth = 4; g.beginPath(); g.arc(CX, NECK_Y - 14, 38, 0.2 * PI, 0.8 * PI); g.stroke(); }
    // cintura del torso (abajo adelante, arriba atrás)
    var waist = o.belt != null ? o.belt : (kind === 'coverall' || kind === 'dress' ? top : o.pants);
    box(g, 150, 990, 340, 34, waist); box(g, 150, 486, 340, 18, waist);
    if (o.belt != null) box(g, CX - 12, 992, 24, 18, 0xc9a24a);
    // manos (piel) — ya está el fondo de piel en 640..1024; zapatos
    var shoe = o.shoes != null ? o.shoes : 0x141414, sole = o.sole != null ? o.sole : 0x2a2420;
    box(g, 640, 0, 192, 520, shoe); box(g, 640, 20, 384, 112, sole);
    box(g, 650, 150, 160, 22, mix(shoe, 0xffffff, 0.15)); box(g, 650, 330, 160, 22, mix(shoe, 0xffffff, 0.15));
    // pantalón (o falda / pierna de mameluco)
    var legC = kind === 'coverall' ? top : (kind === 'dress' ? top : o.pants);
    box(g, 620, 770, 404, 254, legC);
    if (kind === 'dress') box(g, 620, 905, 404, 119, skin);
    else { box(g, 620, 990, 404, 34, mul(legC, 0.8)); box(g, 620, 776, 404, 22, o.belt != null ? o.belt : mul(legC, 0.85)); }
    if (kind === 'coverall') box(g, 620, 935, 404, 16, 0xe8e8d8);
    if (o.tools) { box(g, 640, 820, 40, 46, 0x5a3a1a); box(g, 980, 820, 40, 46, 0x5a3a1a); }
    // parches para los accesorios de la malla
    box(g, 20, 860, 40, 40, o.hatColor != null ? o.hatColor : top); box(g, 80, 860, 40, 40, o.hatColor != null ? mul(o.hatColor, o.hat === 'guard' ? 1 : 0.8) : top);
    box(g, 20, 940, 40, 40, 0xd9a84a); box(g, 80, 940, 40, 40, 0x3a2a14);
  }
  function lookTex(o) {
    return cache(_texs, o.key, function () {
      var t = window.CasinoArt.canvasTex(TS, TS, function (g) {
        g.save(); g.scale(TS / 1024, TS / 1024);
        g.fillStyle = css(o.skin); g.fillRect(0, 0, 1024, 1024);
        paintBody(g, o); paintHead(g, o);
        g.restore();
      });
      t.flipY = false;   // UV de glTF: (0,0) arriba a la izquierda, igual que el canvas
      return t;
    });
  }

  // ------------------------------------------------------------------
  // caras: atlas compartido 4x4 (fila 0-1 hombre, 2-3 mujer), una celda por expresión
  // ------------------------------------------------------------------
  var EXPR = ['neutral', 'blink', 'happy', 'sad', 'angry', 'surprised', 'dizzy'];
  var FACE = { x: 246, y: 160, w: 152, h: 130 };   // rectángulo de la cara en la textura (coordenadas 1024)
  var EYE_X = [291, 353], EYE_Y = 203, BROW_Y = 183, MOUTH_Y = 251;
  var FACE_RECT = new T.Vector4(FACE.x / 1024, FACE.y / 1024, FACE.w / 1024, FACE.h / 1024);
  var faceTex = null;
  function drawFace(g, expr, female) {
    var ink = '#1f1411', brow = 'rgba(52,33,25,0.92)';
    function line(pts, w, col) { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.stroke(); }
    function arc(x, y, r, a0, a1, w, col) { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.arc(x, y, r, a0, a1); g.stroke(); }
    // cachetes
    g.fillStyle = 'rgba(232,110,100,0.22)'; ell(g, 270, 230, 13, 8); ell(g, 374, 230, 13, 8);
    for (var s = -1; s <= 1; s += 2) {
      var x = s < 0 ? EYE_X[0] : EYE_X[1], y = EYE_Y;
      if (expr === 'blink') line([x - 10, y + 1, x, y + 4, x + 10, y + 1], 4.5, ink);
      else if (expr === 'happy') arc(x, y + 6, 10, 1.15 * PI, 1.85 * PI, 5, ink);
      else if (expr === 'dizzy') { line([x - 8, y - 8, x + 8, y + 8], 4.5, ink); line([x - 8, y + 8, x + 8, y - 8], 4.5, ink); }
      else { var big = expr === 'surprised' ? 1.25 : 1; g.fillStyle = ink; ell(g, x, y, 8 * big, 10.5 * big); g.fillStyle = 'rgba(255,255,255,0.85)'; ell(g, x + 2.5, y - 3.5, 2.4 * big, 2.4 * big); }
      if (female && expr !== 'dizzy') line([x + s * 8, y - 6, x + s * 14, y - 12], 3, ink);   // pestañas
      // cejas: inclinación según la expresión (inner = punta de adentro)
      var inner = expr === 'sad' ? -7 : expr === 'angry' ? 6 : expr === 'surprised' ? -6 : 0, by = BROW_Y + (expr === 'surprised' ? -5 : 0);
      var xi = x - s * 12, xo = x + s * 13;
      line([xo, by + (expr === 'sad' ? 3 : 0), (xi + xo) / 2, by - 2 + inner * 0.4, xi, by + inner], female ? 4 : 6.5, brow);
    }
    var my = MOUTH_Y, lip = female ? '#b8404e' : '#5a2219';
    if (expr === 'happy') {
      g.fillStyle = '#4a1612'; g.beginPath(); g.moveTo(CX - 17, my - 4); g.quadraticCurveTo(CX, my + 22, CX + 17, my - 4); g.closePath(); g.fill();
      g.fillStyle = '#ffffff'; g.fillRect(CX - 12, my - 4, 24, 4); g.fillStyle = '#d8606a'; ell(g, CX, my + 8, 7, 3.5);
    } else if (expr === 'sad') line([CX - 11, my + 4, CX, my - 2, CX + 11, my + 4], 4, lip);
    else if (expr === 'angry') { g.fillStyle = '#4a1612'; rrect(g, CX - 12, my - 3, 24, 7, 3); g.fill(); g.fillStyle = '#fff'; g.fillRect(CX - 9, my - 2, 18, 2.5); }
    else if (expr === 'surprised') { g.fillStyle = '#4a1612'; ell(g, CX, my + 2, 7, 9); }
    else if (expr === 'dizzy') line([CX - 13, my, CX - 6, my - 4, CX, my, CX + 6, my - 4, CX + 13, my], 3.5, lip);
    else line([CX - 9, my - 1, CX, my + 3, CX + 9, my - 1], 4, lip);
    if (female && (expr === 'neutral' || expr === 'blink')) { g.fillStyle = 'rgba(190,60,80,0.75)'; ell(g, CX, my + 1, 8, 3.2); }
  }
  function faceAtlas() {
    if (faceTex) return faceTex;
    faceTex = window.CasinoArt.canvasTex(1024, 1024, function (g) {
      g.clearRect(0, 0, 1024, 1024);
      for (var f = 0; f < 2; f++) for (var e = 0; e < EXPR.length; e++) {
        var cell = f * 8 + e, cx = (cell % 4) * 256, cy = Math.floor(cell / 4) * 256;
        g.save(); g.beginPath(); g.rect(cx + 2, cy + 2, 252, 252); g.clip();
        g.setTransform(256 / FACE.w, 0, 0, 256 / FACE.h, cx - FACE.x * 256 / FACE.w, cy - FACE.y * 256 / FACE.h);
        drawFace(g, EXPR[e], f === 1);
        g.restore();
      }
    });
    faceTex.flipY = false;
    return faceTex;
  }
  function cellOf(female, expr) {
    var e = EXPR.indexOf(expr); if (e < 0) e = 0;
    var cell = (female ? 8 : 0) + e;
    return new T.Vector4((cell % 4) / 4, Math.floor(cell / 4) / 4, 0.25, 0.25);
  }
  // mismo texto de shader para todos: un solo programa compartido
  function patchShader(sh) {
    sh.uniforms.faceMap = { value: faceAtlas() };
    sh.uniforms.faceRect = { value: FACE_RECT };
    sh.uniforms.faceCell = { value: this.userData.faceCell };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\nuniform sampler2D faceMap;\nuniform vec4 faceRect;\nuniform vec4 faceCell;')
      .replace('#include <map_fragment>', [
        '#ifdef USE_MAP',
        '  vec4 texelColor = texture2D( map, vUv );',
        '  vec2 fq = ( vUv - faceRect.xy ) / faceRect.zw;',
        '  float inFace = step( 0.0, fq.x ) * step( fq.x, 1.0 ) * step( 0.0, fq.y ) * step( fq.y, 1.0 );',
        '  vec4 fc = texture2D( faceMap, faceCell.xy + clamp( fq, 0.0, 1.0 ) * faceCell.zw );',
        '  texelColor.rgb = mix( texelColor.rgb, fc.rgb, fc.a * inFace );',
        '  texelColor = mapTexelToLinear( texelColor );',
        '  diffuseColor *= texelColor;',
        '#endif',
      ].join('\n'));
  }
  function programKey() { return 'casino-persona-kenney'; }
  function matFor(o, expr) {
    return cache(_mats, o.key + '|' + expr, function () {
      // MeshStandardMaterial después de perf.js: fuera de Gráficos "Alta" sale Lambert, como el resto del juego
      var m = new T.MeshStandardMaterial({ map: lookTex(o), skinning: true, roughness: 0.8, metalness: 0 });
      m.userData.faceCell = cellOf(o.female, expr);
      m.onBeforeCompile = patchShader;
      m.customProgramCacheKey = programKey;
      return m;
    });
  }

  // ------------------------------------------------------------------
  // build(o, root): huesos + malla de una persona. Devuelve { J, mesh, setFace(expr) }.
  // ------------------------------------------------------------------
  var IDENT = new T.Matrix4();
  function build(o, root) {
    var bones = makeBones(), J = {};
    NAMES.forEach(function (n, i) { J[n] = bones[i]; });
    var body = { J: J, mesh: null, expr: 'neutral', bones: bones };
    function attach() {
      var mesh = new T.SkinnedMesh(geometryFor(o), matFor(o, body.expr));
      mesh.name = 'PersonBody';
      mesh.add(bones[0]); root.add(mesh);
      mesh.bind(new T.Skeleton(bones, IBM), IDENT);
      body.mesh = mesh;
      if (body.onMesh) body.onMesh(mesh);
    }
    body.setFace = function (expr) {
      if (body.expr === expr) return; body.expr = expr;
      if (body.mesh) body.mesh.material = matFor(o, expr);
    };
    if (BASE) attach();
    else { root.add(bones[0]); pending.push(attach); }   // el modelo todavía se está leyendo: la malla llega enseguida
    return body;
  }

  window.CasinoPeople = {
    build: build,
    get ready() { return !!BASE; },
    HIP_Y: HIP_Y, SIT_OFF: SIT_OFF,
    EXPRESSIONS: EXPR,
    lookTex: lookTex, faceAtlas: faceAtlas,
    cache: { geometries: _geos, textures: _texs, materials: _mats },
  };
})();
