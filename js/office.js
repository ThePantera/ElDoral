/* Casino Dorado · office.js — OFICINA DE SEGURIDAD (v2)
 *  Detrás de la pared del fondo del salón principal, a la derecha de la estantería. Se construye una vez (rango 3).
 *  - Puerta blindada: la abrís y cerrás cuando quieras. Cerrada no entra nadie (ni el personal ni los clientes).
 *  - Panel de cámaras: 6 monitores en la pared que muestran las cámaras EN VIVO, modo monitor a pantalla completa
 *    y un editor (plano del casino) para mover, apuntar, subir/bajar, comprar y quitar cámaras. Las cámaras solo
 *    pueden estar en el salón, las alas, la entrada y la vereda. NUNCA en la sala ultra VIP ni apuntando hacia su entrada.
 *  - Mesa con armas de adorno y plata, y arriba la contadora de billetes (cuenta el bolsillo y lo deposita en el banco).
 *    Podés comprar, mover y vender objetos de la oficina (mirás un lugar y E).
 *  - Bodega de lingotes de oro: se compran y venden al precio del día, que sube de a poco con vaivenes (apreciación).
 *  - Walkie-talkie (V): apuntás a alguien (o lo elegís de la lista) y un guardia lo saca del casino o lo trae a la oficina.
 * Toda la plata pasa por Economy; los números están en data.js (OFFICE). Estado guardado en S.office (se valida acá).
 * No agrega luces: usa las que ya hay y materiales con brillo propio. Se carga después de vip.js.
 */
(() => {
"use strict";
const G = window.CasinoOfficeBridge, D = window.CASINO_DATA, C = D && D.OFFICE, A = window.CasinoArt, T = window.THREE;
if (!G || !C || !A || !T) return;
const S = () => G.S;
const fmt = n => G.fmt(n);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const isNum = v => typeof v === "number" && Number.isFinite(v);
const int = (v, d, lo, hi) => { v = Math.round(Number(v)); return Number.isFinite(v) ? clamp(v, lo, hi) : d; };
const num = (v, d, lo, hi) => { v = Number(v); return Number.isFinite(v) ? clamp(v, lo, hi) : d; };
const rnd = (a, b) => a + Math.random() * (b - a);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const $ = id => document.getElementById(id);
const K = C.cams, GD = C.gold, WK = C.walkie;
const WALL_H = G.WALL_H || 3.5;
const DEG = Math.PI / 180;

// ---------------------------------------------------------------- lugares (diseño de nivel)
const X0 = 0.9, X1 = 10, Z0 = 10.15, Z1 = 16.6;            // interior de la oficina
const DOORX = 3.0, DOORW = 1.4, HINGE = DOORX - DOORW / 2;  // hueco de la puerta blindada en la pared del fondo
const STEP = { x: DOORX, z: 9.0 };                          // parado frente a la puerta, del lado del salón
const SPOTS = [{ x: 5.2, z: 12.2, yaw: -Math.PI / 2 }, { x: 5.2, z: 13.6, yaw: -Math.PI / 2 }]; // dónde esperan los que traen
const SCR = { xs: [5.3, 3.75, 2.2], ys: [2.5, 1.5], w: 1.45, h: 0.85 };   // de izquierda a derecha mirando la pared (la cámara 1 arriba a la izquierda)
const CONS = { x: 3.75, z: 15.85, w: 5.0, d: 0.75, top: 0.78 };
const TAB = { x: 7.3, z: 12.9, w: 2.4, d: 1.1, top: 0.8 };
const CAGE = { x0: 9.3, x1: X1, z0: 13.9, z1: Z1 };
const KEEP = [{ x0: 1.9, x1: 4.2, z0: Z0, z1: 12.3 }];     // el pasillo de la puerta no se llena de objetos

// ---------------------------------------------------------------- estado guardado (S.office)
function fresh() {
  return { v: 1, built: false, open: false, cams: [], nextCam: 1, sel: 0, counted: 0, props: [],
    gold: { bars: 0, cost: 0, price: GD.startPrice, hist: [GD.startPrice], day: 0 } };
}
function cleanCam(c, i) {
  if (!c || typeof c !== "object") return null;
  const cam = { id: int(c.id, i + 1, 1, 1e6), name: typeof c.name === "string" && c.name.trim() ? c.name.trim().slice(0, 14) : "Cámara " + (i + 1),
    x: num(c.x, 0, -22, 22), z: num(c.z, 0, -17, 9), y: num(c.y, 3.1, K.hMin, K.hMax), yaw: num(c.yaw, 0, -20, 20), pitch: num(c.pitch, -0.3, -1.05, 0.3),
    fov: num(c.fov, 70, K.fovMin, K.fovMax), on: c.on !== false };
  if (!areaOk(cam.x, cam.z)) return null;
  let n = 0; while (aimsAtVip(cam) && n++ < 24) cam.yaw += 15 * DEG; // si apuntaba mal, la giramos hasta que no mire hacia la estantería
  return aimsAtVip(cam) ? null : cam;
}
function validate(raw) {
  const o = fresh(); if (!raw || typeof raw !== "object") return o;
  o.built = !!raw.built; o.open = !!raw.open && o.built; o.counted = int(raw.counted, 0, 0, 1e12);
  if (o.built) {
    const seen = new Set();
    for (const c of (Array.isArray(raw.cams) ? raw.cams : []).slice(0, K.max)) {
      const cam = cleanCam(c, o.cams.length); if (!cam) continue;
      while (seen.has(cam.id)) cam.id++;
      seen.add(cam.id); o.cams.push(cam);
    }
    o.nextCam = Math.max(int(raw.nextCam, 1, 1, 1e6), ...o.cams.map(c => c.id + 1));
    o.sel = int(raw.sel, 0, 0, Math.max(0, o.cams.length - 1));
    const g = raw.gold && typeof raw.gold === "object" ? raw.gold : {};
    o.gold.bars = int(g.bars, 0, 0, GD.maxBars); o.gold.cost = int(g.cost, 0, 0, 1e12);
    o.gold.price = int(g.price, GD.startPrice, GD.minPrice, GD.maxPrice);
    o.gold.hist = (Array.isArray(g.hist) ? g.hist : []).map(v => int(v, 0, GD.minPrice, GD.maxPrice)).filter(Boolean).slice(-GD.historyDays);
    if (!o.gold.hist.length) o.gold.hist = [o.gold.price];
    o.gold.day = int(g.day, 0, 0, 1e6);
    if (!o.gold.bars) o.gold.cost = 0;
    for (const p of (Array.isArray(raw.props) ? raw.props : []).slice(0, 24)) {
      if (!p || !PROP(p.k)) continue;
      o.props.push({ k: p.k, x: num(p.x, 5, X0 + 0.2, X1 - 0.2), y: num(p.y, 0, 0, 1.2), z: num(p.z, 13, Z0 + 0.2, Z1 - 0.2), ry: num(p.ry, 0, -20, 20) });
    }
  }
  return o;
}
const PROP = id => C.props.find(p => p.id === id) || null;
let lastS = null;
function ensure() {
  const s = S(); if (!s) return false;
  if (s === lastS) return true;
  lastS = s; s.office = validate(s.office);
  if (setup) refreshAll();
  return true;
}
const O = () => S().office;
const built = () => !!S() && !!S().office && S().office.built;
const doorOpen = () => !!S() && !!S().office && S().office.open;

// ---------------------------------------------------------------- reglas de las cámaras (nunca la sala ultra VIP)
function areaOk(x, z) {
  const zones = (S() && S().zones) || {};
  if (x > -9.6 && x < 9.6 && z > -9.4 && z < 9.0) return true;                  // salón principal (nunca pegada a la pared del fondo)
  if (x >= 10.4 && x < 21.6 && z > -9.4 && z < 9.0) return !!zones.este;      // ala este
  if (x <= -10.4 && x > -21.6 && z > -9.4 && z < 9.0) return !!zones.oeste;   // salón del oeste
  return x > -14 && x < 14 && z > -17 && z < -10.6;                           // la vereda y la entrada
}
const VIP_DOOR = [-3.75, -3, -2.25].map(x => ({ x, z: 9.7 })); // la estantería del fondo (entrada de la sala VIP)
function aimsAtVip(c) {
  const hf = 2 * Math.atan(Math.tan(c.fov * DEG / 2) * 16 / 9), fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw);
  for (const p of VIP_DOOR) {
    const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz);
    if (d < 0.01) return true;
    const ang = Math.acos(clamp((dx * fx + dz * fz) / d, -1, 1));
    if (ang < 0.21) return true;                                             // apuntando derecho a la estantería, a cualquier distancia
    if (d <= K.maxAimDist && ang < hf / 2 + K.aimMargin) return true;       // cerca y con la estantería dentro del encuadre
  }
  return false;
}
const WHY_AIM = "No se puede apuntar hacia la entrada de la sala VIP: esa zona no se vigila.";
const WHY_AREA = "Ahí no va una cámara. Solo el salón, las alas que compraste, la entrada y la vereda (la sala VIP y la oficina no se vigilan).";

// ---------------------------------------------------------------- utilidades de modelado (geometría fusionada con colores)
const VC = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15 });
const VCG = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.6 });
const BOX1 = new T.BoxGeometry(1, 1, 1), CYL1 = new T.CylinderGeometry(0.5, 0.5, 1, 12), SPH1 = new T.SphereGeometry(0.5, 10, 8);
const _q = new T.Quaternion(), _e = new T.Euler(), _v = new T.Vector3(), _s = new T.Vector3();
function M4(x, y, z, ry, sx, sy, sz, rx, rz) { _e.set(rx || 0, ry || 0, rz || 0); _q.setFromEuler(_e); return new T.Matrix4().compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz)); }
function part(L, geo, color, x, y, z, w, h, d, ry, rx, rz) { L.push({ geo, m: M4(x, y, z, ry || 0, w, h, d, rx, rz), color }); }
function merged(L, mat) { return new T.Mesh(A.mergeGeometries(L, true), mat || VC); }
const std = (c, r, m, e) => A.std(c, r == null ? 0.7 : r, m || 0, e || 0);
function bx(parent, w, h, d, mat, x, y, z) { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; }
function plane(parent, w, h, mat, x, y, z, ry, rx) { const m = new T.Mesh(new T.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0, "YXZ"); parent.add(m); return m; }
const anim = [];
let setup = false;

// ---------------------------------------------------------------- el edificio: cáscara, hueco de la puerta y cartel de obra
const room = new T.Group(), root = new T.Group();      // room: adentro (solo se ve si estás adentro) · root: puerta y cámaras
room.visible = false; G.scene.add(room); G.scene.add(root);
const inside = () => { const p = G.player; return p.z > 10 && p.x > X0 - 0.5 && p.x < X1 + 0.5; };
const floorMesh = plane(room, X1 - X0, Z1 - Z0, std(0x2e323b, 0.85, 0, 0x14161c), (X0 + X1) / 2, 0.006, (Z0 + Z1) / 2, 0, -Math.PI / 2);
{
  const wallM = std(0x3a4658, 0.8, 0, 0x1a2230), trim = A.materials.brass, cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2, W = X1 - X0, Dp = Z1 - Z0;
  plane(room, W, Dp, std(0x15171c, 0.9), cx, WALL_H - 0.01, cz, 0, Math.PI / 2);
  plane(room, W, WALL_H, wallM, cx, WALL_H / 2, Z1 - 0.01, Math.PI);
  plane(room, Dp, WALL_H, wallM, X0 + 0.01, WALL_H / 2, cz, Math.PI / 2);
  plane(room, Dp, WALL_H, wallM, X1 - 0.01, WALL_H / 2, cz, -Math.PI / 2);
  // pared sur (la del salón) vista desde adentro, con el hueco de la puerta
  const left = HINGE - X0, right = X1 - (DOORX + DOORW / 2);
  plane(room, left, WALL_H, wallM, X0 + left / 2, WALL_H / 2, Z0 + 0.01, 0); plane(room, right, WALL_H, wallM, X1 - right / 2, WALL_H / 2, Z0 + 0.01, 0);
  plane(room, DOORW, WALL_H - 2.4, wallM, DOORX, 2.4 + (WALL_H - 2.4) / 2, Z0 + 0.01, 0);
  for (const y of [0.95, 2.6]) { // molduras
    bx(room, W, 0.04, 0.03, trim, cx, y, Z1 - 0.03); bx(room, 0.03, 0.04, Dp, trim, X0 + 0.03, y, cz); bx(room, 0.03, 0.04, Dp, trim, X1 - 0.03, y, cz);
  }
  if (A.makeCoveLights) room.add(A.makeCoveLights([
    { x0: X0, z0: Z1, x1: X1, z1: Z1, nx: 0, nz: -1, color: 0x2fb6d8, top: WALL_H }, { x0: X0, z0: Z0, x1: X0, z1: Z1, nx: 1, nz: 0, color: 0xd98a3a, top: WALL_H },
    { x0: X1, z0: Z0, x1: X1, z1: Z1, nx: -1, nz: 0, color: 0xd98a3a, top: WALL_H },
  ]));
  if (A.makeFloorGlows) room.add(A.makeFloorGlows([{ x: CONS.x, z: 14.6, rx: 3, rz: 1.3, color: 0x2fb6d8, k: 0.16 }, { x: TAB.x, z: TAB.z, rx: 1.8, rz: 1.2, color: 0xffc27a, k: 0.18 }, { x: 9.0, z: 15.2, rx: 1.0, rz: 1.5, color: 0xffd45a, k: 0.14 }], { y: 0.012 }));
  const sign = A.makeNeonSign({ text: "SEGURIDAD", color: 0x4fe0ff, color2: 0xffd45a, icons: ["star"], w: 2.6, h: 0.7, x: 8.0, y: 2.9, z: Z1 - 0.03, ry: Math.PI });
  room.add(sign); sign.position.set(8.0, 2.9, Z1 - 0.03); sign.rotation.y = Math.PI; if (sign.api) anim.push(sign.api);
  // cáscara: paredes que se ven y chocan (el jugador no sale de la oficina por otro lado que la puerta)
  const ext = std(0x3a3632, 0.95), len = Z1 - Z0 + 0.3;
  bx(room, 0.3, WALL_H, len, ext, X0 - 0.15, WALL_H / 2, cz); bx(room, 0.3, WALL_H, len, ext, X1 + 0.15, WALL_H / 2, cz); bx(room, W + 0.6, WALL_H, 0.3, ext, cx, WALL_H / 2, Z1 + 0.15);
  G.boxAt(X0 - 0.15, cz, 0.3, len, "office", built); G.boxAt(X1 + 0.15, cz, 0.3, len, "office", built); G.boxAt(cx, Z1 + 0.15, W + 0.6, 0.3, "office", built);
}
// pared del hueco: dintel, marcos de acero y luz de estado (se ven desde el salón)
const doorLampOpen = A.basic(0x3cff8a), doorLampShut = A.basic(0xff2a4a);
let doorLamp = null, doorLampOut = null, doorLabelMat = null;
{
  const steel = std(0x4a5058, 0.4, 0.7);
  const hdr = bx(root, DOORW + 0.4, WALL_H - 2.4, 0.3, std(0x3a3f46, 0.6, 0.3), DOORX, 2.4 + (WALL_H - 2.4) / 2, 10.0); hdr.visible = false;
  root.userData.hdr = hdr;
  for (const sx of [-1, 1]) { const j = bx(root, 0.1, 2.4, 0.36, steel, DOORX + sx * (DOORW / 2 + 0.05), 1.2, 10.0); j.visible = false; (root.userData.jambs = root.userData.jambs || []).push(j); }
  doorLampOut = new T.Mesh(new T.SphereGeometry(0.07, 10, 8), doorLampShut); doorLampOut.position.set(DOORX, 2.58, 9.8); doorLampOut.visible = false; root.add(doorLampOut);
  doorLamp = new T.Mesh(new T.SphereGeometry(0.07, 10, 8), doorLampShut); doorLamp.position.set(DOORX, 2.58, 10.2); doorLamp.visible = false; root.add(doorLamp);
}
// tapón de obra: mientras no esté construida, el hueco es una pared más con un cartel
const plug = new T.Group(); root.add(plug);
{
  const m = bx(plug, DOORW + 0.4, WALL_H, 0.3, std(0x3a3228, 0.9), DOORX, WALL_H / 2, 10.0);
  const tex = A.canvasTex(256, 160, (g, w, h) => {
    g.fillStyle = "#14100a"; g.fillRect(0, 0, w, h); g.strokeStyle = "#d9a84a"; g.lineWidth = 5; g.strokeRect(6, 6, w - 12, h - 12);
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#e6c27a"; g.font = "bold 26px Georgia, serif"; g.fillText("OFICINA DE", w / 2, 40); g.fillText("SEGURIDAD", w / 2, 74);
    g.fillStyle = "#f3e9d2"; g.font = "bold 18px Arial, sans-serif"; g.fillText("EN OBRA · Rango " + C.rank, w / 2, 112); g.fillStyle = "#9a7a44"; g.font = "16px monospace"; g.fillText(fmt(C.buildCost), w / 2, 138);
  });
  const sg = plane(plug, 1.2, 0.75, new T.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.4 }), DOORX, 1.75, 9.83, Math.PI);
  G.proxy(plug, DOORW + 0.4, 2.6, 0.5, {
    prompt: () => ({ text: "Oficina de seguridad (en obra)", sub: S().rank < C.rank ? `Necesitás rango ${C.rank}` : `Cámaras en vivo, mesa, bodega de oro y walkie-talkie · ${fmt(C.buildCost)}` }),
    hold: () => 0, use: () => openBuild(),
  }, 1.3, DOORX, 9.9);
  G.boxAt(DOORX, 10.0, DOORW + 0.4, 0.4, "office", () => !built());
  void m;
}

// ---------------------------------------------------------------- la puerta blindada (gira hacia adentro)
const doorPivot = new T.Group(); doorPivot.position.set(HINGE, 0, 10.0); doorPivot.visible = false; root.add(doorPivot);
let doorAng = 0, doorWheel = null, doorHit = null;
{
  const L = [], dark = 0x3b4148, mid = 0x59616a, hi = 0x8a929c, yel = 0xe0b020;
  part(L, BOX1, dark, DOORW / 2, 1.2, 0, DOORW - 0.04, 2.4, 0.16);
  part(L, BOX1, mid, DOORW / 2, 1.2, 0.085, DOORW - 0.2, 2.2, 0.03); part(L, BOX1, mid, DOORW / 2, 1.2, -0.085, DOORW - 0.2, 2.2, 0.03);
  for (let i = 0; i < 6; i++) for (const sy of [0.12, 2.28]) part(L, SPH1, hi, 0.14 + i * (DOORW - 0.28) / 5, sy, 0.1, 0.045, 0.045, 0.03);
  for (let i = 0; i < 6; i++) for (const sy of [0.12, 2.28]) part(L, SPH1, hi, 0.14 + i * (DOORW - 0.28) / 5, sy, -0.1, 0.045, 0.045, 0.03);
  part(L, BOX1, yel, DOORW / 2, 0.55, 0.103, DOORW - 0.3, 0.07, 0.01); part(L, BOX1, yel, DOORW / 2, 1.85, 0.103, DOORW - 0.3, 0.07, 0.01); // franjas de peligro
  part(L, BOX1, yel, DOORW / 2, 0.55, -0.103, DOORW - 0.3, 0.07, 0.01); part(L, BOX1, yel, DOORW / 2, 1.85, -0.103, DOORW - 0.3, 0.07, 0.01);
  part(L, BOX1, hi, DOORW - 0.1, 1.15, 0.14, 0.06, 0.34, 0.06); part(L, BOX1, hi, DOORW - 0.1, 1.15, -0.14, 0.06, 0.34, 0.06); // manijas
  doorPivot.add(merged(L, VCG));
  const w = new T.Mesh(new T.TorusGeometry(0.17, 0.02, 6, 16), A.materials.chrome || std(0xcfd6dc, 0.3, 0.8)); w.position.set(DOORW / 2, 1.2, 0.11); doorPivot.add(w); doorWheel = w;
  const w2 = w.clone(); w2.position.z = -0.11; doorPivot.add(w2);
}
{
  doorHit = G.proxy(root, DOORW + 0.4, 2.4, 1.0, {
    prompt: () => !built() ? { text: "" } : { text: doorOpen() ? "Cerrar la puerta blindada" : "Abrir la puerta blindada", sub: doorOpen() ? "Cerrada no entra nadie a la oficina" : "Está cerrada con la rueda de acero" },
    hold: () => 0, usable: () => built(), use: () => toggleDoor(),
  }, 1.2, DOORX, 10.0);
  G.boxAt(DOORX, 10.0, DOORW + 0.2, 0.4, "office", () => built() && !doorOpen());
  G.boxAt(HINGE + 0.12, 10.7, 0.16, 1.4, "office", () => built() && doorOpen());  // la hoja abierta contra la pared de adentro
}
function toggleDoor() {
  if (!ensure() || !built()) return;
  const o = O(); o.open = !o.open; G.sfx("door") || G.SFX.tick();
  G.toast(o.open ? "Abriste la puerta blindada." : "Cerraste la puerta blindada: nadie entra a la oficina.", o.open ? "" : "good");
  G.save(true);
}
function setDoorOpen(v) { if (!ensure() || !built() || O().open === !!v) return; toggleDoor(); }

// ---------------------------------------------------------------- monitores en vivo (una textura por cámara, se redibujan por turnos)
const FW = K.feedW, FH = K.feedH;
const rts = [];                                  // un render target por cámara (se crea al usarse)
const fcam = new T.PerspectiveCamera(70, 16 / 9, 0.1, 120); fcam.rotation.order = "YXZ";
function rtOf(i) {
  if (!rts[i]) { const rt = new T.WebGLRenderTarget(FW, FH, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat }); rt.texture.encoding = T.sRGBEncoding; rts[i] = { rt, t: 0 }; }
  return rts[i];
}
function renderFeed(i) {
  const c = O().cams[i]; if (!c || !c.on) return false;
  const r = rtOf(i), cam = G.camera, rd = G.renderer;
  fcam.fov = c.fov; fcam.updateProjectionMatrix();
  fcam.position.set(c.x - Math.sin(c.yaw) * 0.3, c.y - 0.1, c.z - Math.cos(c.yaw) * 0.3); fcam.rotation.set(c.pitch, c.yaw, 0);
  const vis = cam.visible; cam.visible = false;       // sin tus manos ni el trago
  const prev = rd.getRenderTarget();
  try { rd.setRenderTarget(r.rt); rd.render(G.scene, fcam); } finally { rd.setRenderTarget(prev); cam.visible = vis; }
  r.t = performance.now();
  return true;
}
const noSignal = A.canvasTex(128, 72, (g, w, h) => {
  g.fillStyle = "#0b0f12"; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 4) { g.fillStyle = "rgba(120,160,170," + (0.05 + Math.random() * 0.1) + ")"; g.fillRect(0, y, w, 2); }
  g.fillStyle = "#6f8a90"; g.font = "bold 13px monospace"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("SIN SEÑAL", w / 2, h / 2);
});
const screens = [];
{
  bx(room, 4.9, 2.2, 0.08, std(0x0d0f12, 0.5, 0.3), 3.75, 2.0, Z1 - 0.06);
  let n = 0;
  for (const y of SCR.ys) for (const x of SCR.xs) {
    const mat = new T.MeshBasicMaterial({ map: noSignal, toneMapped: false });
    const m = plane(room, SCR.w, SCR.h, mat, x, y, Z1 - 0.1, Math.PI);
    const lab = A.canvasTex(128, 24, () => {}); const lm = new T.MeshBasicMaterial({ map: lab, transparent: true, toneMapped: false, depthWrite: false });
    const l = plane(room, 0.55, 0.1, lm, x + SCR.w / 2 - 0.3, y - SCR.h / 2 + 0.1, Z1 - 0.105, Math.PI);
    screens.push({ i: n++, m, mat, lm, lab, lastName: null, cx: x, cy: y });
  }
}
function paintLabel(s, text) {
  const g = s.lab.image.getContext("2d"); g.clearRect(0, 0, 128, 24); g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(0, 0, 128, 24);
  g.fillStyle = "#7dffb0"; g.font = "bold 15px monospace"; g.textBaseline = "middle"; g.fillText(text, 4, 13); s.lab.needsUpdate = true; s.lastName = text;
}
function syncScreens() {
  const cams = O().cams;
  for (const s of screens) {
    const c = cams[s.i];
    if (!c) { s.mat.map = noSignal; s.mat.needsUpdate = true; paintLabel(s, "—"); continue; }
    const live = c.on; s.mat.map = live ? rtOf(s.i).rt.texture : noSignal; s.mat.needsUpdate = true;
    paintLabel(s, (live ? "● " : "○ ") + (s.i + 1) + " " + c.name);
  }
}
let feedAcc = 0, feedNext = 0;
function frameFeeds(real) {
  if (!room.visible || mon || !built()) return;
  const cams = O().cams, n = Math.min(cams.length, screens.length); if (!n) return;
  feedAcc += real;
  const every = clamp(0.25 / n, 0.04, 0.2);               // cada cámara ronda los 4 cuadros por segundo; cae sola si el equipo va lento
  if (feedAcc < (real > 0.05 ? 0.5 : every)) return;   // con el equipo lento, menos cuadros pero nunca se frena el juego
  feedAcc = 0;
  for (let k = 0; k < n; k++) { const i = (feedNext + k) % n; if (cams[i].on && renderFeed(i)) { feedNext = (i + 1) % n; break; } }
}

// ---------------------------------------------------------------- consola de monitores, mesa con contadora y bodega
const consoleG = new T.Group(); room.add(consoleG);
{
  const L = [];
  part(L, BOX1, 0x23272e, CONS.x, 0.37, CONS.z, CONS.w, 0.74, CONS.d); part(L, BOX1, 0x14171b, CONS.x, 0.755, CONS.z, CONS.w + 0.04, 0.04, CONS.d + 0.04);
  part(L, BOX1, 0x2fb6d8, CONS.x, 0.1, CONS.z - CONS.d / 2 - 0.005, CONS.w - 0.2, 0.025, 0.01);
  for (let i = 0; i < 3; i++) part(L, BOX1, 0x0b0d10, 2.1 + i * 1.6, 0.8, CONS.z - 0.1, 0.5, 0.02, 0.16);   // teclados
  for (let i = 0; i < 10; i++) part(L, CYL1, i % 3 === 0 ? 0xd43a3a : i % 3 === 1 ? 0x3cd47a : 0xe0b020, 1.9 + i * 0.36, 0.78, CONS.z + 0.08, 0.05, 0.03, 0.05);
  consoleG.add(merged(L));
  G.boxAt(CONS.x, CONS.z, CONS.w, CONS.d, "office", built);
  G.proxy(room, 4.9, 2.4, 0.5, {
    prompt: () => ({ text: "Panel de cámaras en vivo", sub: O().cams.length ? "Mirá cada cámara a pantalla completa" : "Todavía no hay cámaras" }),
    hold: () => 0, use: () => enterMonitor(O().sel || 0), options: () => openCams(), optLabel: "Editar cámaras",
  }, 1.55, 3.75, Z1 - 0.3);
}
// mesa y contadora de billetes
const counterScr = A.canvasTex(128, 32, () => {});
const bill = { mat: new T.MeshBasicMaterial({ color: 0x7fd68a, side: T.DoubleSide }), list: [] };
let counting = null, tabTop = null;
{
  const L = [];
  part(L, BOX1, 0x4a2c16, TAB.x, TAB.top - 0.03, TAB.z, TAB.w, 0.06, TAB.d); part(L, BOX1, 0xc9962e, TAB.x, TAB.top - 0.065, TAB.z, TAB.w + 0.03, 0.02, TAB.d + 0.03);
  part(L, BOX1, 0x38200f, TAB.x, 0.36, TAB.z, TAB.w - 0.2, 0.7, TAB.d - 0.2); part(L, BOX1, 0x38200f, TAB.x - TAB.w / 2 + 0.1, 0.37, TAB.z, 0.1, 0.72, TAB.d);
  part(L, BOX1, 0x38200f, TAB.x + TAB.w / 2 - 0.1, 0.37, TAB.z, 0.1, 0.72, TAB.d);
  const cx = TAB.x + 0.55, cz = TAB.z, y = TAB.top;                                     // la contadora, arriba de la mesa
  part(L, BOX1, 0x2b2f36, cx, y + 0.11, cz, 0.52, 0.22, 0.36); part(L, BOX1, 0x555d68, cx, y + 0.225, cz, 0.54, 0.03, 0.38);
  part(L, BOX1, 0x0b0d10, cx - 0.12, y + 0.24, cz, 0.2, 0.02, 0.05);                  // boca por donde entran los billetes
  part(L, BOX1, 0x3a4048, cx + 0.19, y + 0.26, cz, 0.12, 0.12, 0.3);
  consoleG.add(merged(L));
  tabTop = new T.Mesh(new T.BoxGeometry(TAB.w, 0.02, TAB.d), new T.MeshBasicMaterial({ visible: false })); tabTop.position.set(TAB.x, TAB.top, TAB.z); room.add(tabTop);
  const consTop = new T.Mesh(new T.BoxGeometry(CONS.w, 0.02, CONS.d), new T.MeshBasicMaterial({ visible: false })); consTop.position.set(CONS.x, CONS.top, CONS.z); room.add(consTop);
  room.userData.surfaces = [floorMesh, tabTop, consTop];
  plane(room, 0.34, 0.085, new T.MeshBasicMaterial({ map: counterScr, toneMapped: false }), cx + 0.05, y + 0.215, cz - 0.19 - 0.001, Math.PI, 0).rotation.x = -0.9;
  for (let i = 0; i < 6; i++) { const b = new T.Mesh(new T.PlaneGeometry(0.12, 0.06), bill.mat); b.visible = false; b.rotation.x = -Math.PI / 2; room.add(b); bill.list.push({ m: b, p: i / 6 }); }
  G.boxAt(TAB.x, TAB.z, TAB.w + 0.1, TAB.d + 0.1, "office", built);
  G.proxy(room, 0.7, 0.4, 0.5, {
    prompt: () => counting ? { text: "Contando billetes…", sub: fmt(Math.round(counting.shown)) } : S().pocket > 0 ? { text: `Contar ${fmt(S().pocket)} y mandarlos al banco`, sub: `Total contado en la historia: ${fmt(O().counted)}` } : { text: "Contadora de billetes", sub: "Tenés el bolsillo vacío · vaciá cajas y volvé" },
    hold: () => 0, usable: () => !counting && S().pocket > 0, use: () => startCount(),
  }, TAB.top + 0.2, cx, cz);
  G.proxy(room, 1.5, 0.4, 1.0, {
    prompt: () => ({ text: "Mesa de la oficina", sub: "E: objetos (comprar, mover, vender)" }), hold: () => 0, use: () => openProps(),
  }, TAB.top + 0.15, TAB.x - 0.35, TAB.z);
}
function paintCounter(txt, on) {
  const g = counterScr.image.getContext("2d"); g.fillStyle = on ? "#06210d" : "#0a0f12"; g.fillRect(0, 0, 128, 32);
  g.fillStyle = on ? "#6dff9a" : "#2a5a40"; g.font = "bold 22px monospace"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(txt, 64, 17); counterScr.needsUpdate = true;
}
paintCounter("$0", false);
function startCount() {
  if (!ensure() || counting || !(S().pocket > 0)) return;
  const n = Math.round(S().pocket), sec = clamp(n / 1000 * C.counter.secPer1000, C.counter.minSec, C.counter.maxSec);
  counting = { n, t: 0, sec, shown: 0 }; G.sfx("coins") || G.SFX.coin(); for (const b of bill.list) b.m.visible = true;
}
function updateCount(dt) {
  if (!counting) return;
  const k = counting; k.t += dt; k.shown = Math.min(k.n, k.n * k.t / k.sec);
  if (Math.random() < dt * 8) G.SFX.tick();
  if (k.t >= k.sec) {
    counting = null; for (const b of bill.list) b.m.visible = false;
    const got = G.Pocket.deposit(); const o = O(); o.counted += got; paintCounter("OK " + (got >= 1000 ? Math.round(got / 100) / 10 + "k" : got), true);
    if (got > 0) { G.floatText(TAB.x + 0.55, 1.5, TAB.z, "+" + fmt(got), "#6fd39b"); G.toast(`La contadora contó ${fmt(got)} y los mandó al banco. Banco: ${fmt(S().bank)}.`, "good"); G.SFX.cash(); G.updateHud(true); G.save(true); }
  }
}
function frameCount(real) {
  if (!room.visible) return;
  if (counting) {
    const k = counting; paintCounter(fmt(Math.round(k.shown)), true);
    for (const b of bill.list) { b.p = (b.p + real * 2.4) % 1; const p = b.p; b.m.position.set(TAB.x + 0.43 + p * 0.25, TAB.top + 0.27 - p * 0.04 + Math.sin(p * 6.28) * 0.03, TAB.z); b.m.rotation.z = p * 3; }
  }
}

// bodega de lingotes de oro (jaula contra la pared del fondo-este)
const barMesh = new T.InstancedMesh(BOX1, new T.MeshStandardMaterial({ color: 0xe6b422, metalness: 0.9, roughness: 0.28, emissive: 0x3a2800 }), GD.maxBars);
let shownBars = -1;
{
  const L = [], steel = 0x59616a, cz = (CAGE.z0 + CAGE.z1) / 2, len = CAGE.z1 - CAGE.z0, dep = CAGE.x1 - CAGE.x0;
  for (const y of [0.04, 0.62, 1.1, 1.58, 2.06]) part(L, BOX1, 0x3a2a16, CAGE.x0 + dep / 2, y, cz, dep, 0.04, len);                 // estantes
  for (const z of [CAGE.z0, CAGE.z1 - 0.04]) part(L, BOX1, steel, CAGE.x0, 1.2, z + 0.02, 0.06, 2.4, 0.06);
  part(L, BOX1, steel, CAGE.x0, 2.4, cz, 0.08, 0.06, len); part(L, BOX1, steel, CAGE.x0, 0.05, cz, 0.08, 0.06, len); part(L, BOX1, steel, CAGE.x0, 1.0, cz, 0.05, 0.04, len);
  for (let z = CAGE.z0 + 0.15; z < CAGE.z1 - 0.1; z += 0.16) part(L, BOX1, steel, CAGE.x0, 1.2, z, 0.025, 2.35, 0.025);              // barrotes
  part(L, BOX1, steel, CAGE.x0 + dep / 2, 2.4, CAGE.z0 + 0.03, dep, 0.06, 0.06);
  part(L, BOX1, 0x14171b, CAGE.x0 - 0.02, 1.2, CAGE.z0 + 0.05, 0.06, 0.4, 0.04);                                                    // cerradura
  consoleG.add(merged(L, VCG));
  const slot = k => { const lvl = Math.floor(k / 16), r = k % 16, row = r % 2, col = Math.floor(r / 2); return { x: CAGE.x0 + 0.22 + row * 0.24, y: [0.08, 0.66, 1.14, 1.62][lvl] + 0.035, z: CAGE.z0 + 0.2 + col * 0.31 }; };
  const m = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(0.14, 0.07, 0.27);
  for (let k = 0; k < GD.maxBars; k++) { const s = slot(k); m.compose(new T.Vector3(s.x, s.y, s.z), q, sc); barMesh.setMatrixAt(k, m); }
  barMesh.count = 0; barMesh.frustumCulled = false; room.add(barMesh);
  G.boxAt((CAGE.x0 + CAGE.x1) / 2, cz, dep, len, "office", built);
  G.proxy(room, 0.9, 2.4, len, {
    prompt: () => ({ text: "Bodega de lingotes de oro", sub: `${O().gold.bars} lingotes · hoy ${fmt(O().gold.price)} c/u` }), hold: () => 0, use: () => openGold(),
  }, 1.2, CAGE.x0 - 0.35, cz);
  plane(room, 1.4, 0.3, new T.MeshBasicMaterial({ map: A.canvasTex(256, 56, (g, w, h) => { g.fillStyle = "#14100a"; g.fillRect(0, 0, w, h); g.strokeStyle = "#d9a84a"; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6); g.fillStyle = "#f6c766"; g.font = "bold 30px Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("BODEGA · ORO", w / 2, h / 2 + 2); }), toneMapped: false }), CAGE.x0 + 0.1, 2.7, cz, -Math.PI / 2);
}
function syncBars() { const n = O().gold.bars; if (n === shownBars) return; shownBars = n; barMesh.count = n; barMesh.instanceMatrix.needsUpdate = true; }

// ---------------------------------------------------------------- objetos de la oficina (se compran, se mueven y se venden)
function propModel(k) {
  const L = [];
  switch (k) {
    case "pistol": part(L, BOX1, 0x23262b, 0, 0.03, 0, 0.2, 0.04, 0.035); part(L, BOX1, 0x23262b, -0.07, 0.0, 0, 0.05, 0.09, 0.03, 0, 0, 0.25); part(L, BOX1, 0x8a929c, 0.03, 0.054, 0, 0.12, 0.012, 0.02); break;
    case "knife": part(L, BOX1, 0xcfd6dc, 0.05, 0.01, 0, 0.17, 0.008, 0.03); part(L, BOX1, 0x1b1410, -0.08, 0.012, 0, 0.1, 0.022, 0.03); part(L, BOX1, 0xc9962e, -0.025, 0.012, 0, 0.012, 0.03, 0.035); break;
    case "cash": for (let i = 0; i < 3; i++) part(L, BOX1, 0x4f9a5a, 0, 0.025 + i * 0.05, 0, 0.19, 0.045, 0.09, i * 0.08); part(L, BOX1, 0xe8d8a0, 0, 0.075, 0, 0.03, 0.16, 0.095); break;
    case "case": part(L, BOX1, 0x3b2a1e, 0, 0.09, 0, 0.5, 0.18, 0.34); part(L, BOX1, 0x4f9a5a, 0, 0.185, 0, 0.44, 0.02, 0.28); part(L, BOX1, 0x3b2a1e, 0, 0.33, -0.17, 0.5, 0.3, 0.025, 0, -0.1); part(L, BOX1, 0xc9962e, 0, 0.06, 0.171, 0.06, 0.04, 0.01); break;
    case "bar": part(L, BOX1, 0xe6b422, 0, 0.03, 0, 0.2, 0.06, 0.1); part(L, BOX1, 0xf4cd4a, 0, 0.065, 0, 0.16, 0.02, 0.07); break;
    case "rifle": part(L, BOX1, 0x23262b, 0.05, 0.28, 0, 0.7, 0.03, 0.03); part(L, BOX1, 0x6b4426, -0.32, 0.27, 0, 0.26, 0.07, 0.04, 0, 0, -0.1); part(L, BOX1, 0x3b2a1e, -0.2, 0.14, 0, 0.04, 0.28, 0.1); part(L, BOX1, 0x3b2a1e, 0.25, 0.14, 0, 0.04, 0.28, 0.1); part(L, BOX1, 0x3b2a1e, 0, 0.01, 0, 0.6, 0.02, 0.14); break;
    case "plant": part(L, CYL1, 0x8a4a2a, 0, 0.07, 0, 0.16, 0.14, 0.16); part(L, SPH1, 0x2e8a3a, 0, 0.22, 0, 0.26, 0.2, 0.26); part(L, SPH1, 0x3aa84a, 0.05, 0.3, 0.03, 0.16, 0.16, 0.16); break;
    case "lamp": part(L, CYL1, 0x1b1d22, 0, 0.015, 0, 0.18, 0.03, 0.18); part(L, CYL1, 0xc9962e, 0, 0.17, 0, 0.025, 0.28, 0.025); part(L, CYL1, 0xffe2a8, 0, 0.34, 0, 0.2, 0.12, 0.2); break;
    case "safe": part(L, BOX1, 0x3b4148, 0, 0.3, 0, 0.6, 0.6, 0.6); part(L, BOX1, 0x59616a, 0, 0.3, 0.305, 0.5, 0.5, 0.02); part(L, CYL1, 0xc9962e, 0, 0.3, 0.32, 0.12, 0.02, 0.12, 0, Math.PI / 2); break;
    default: part(L, BOX1, 0xaaaaaa, 0, 0.05, 0, 0.1, 0.1, 0.1);
  }
  return merged(L, k === "lamp" || k === "bar" ? VCG : VC);
}
const propMeshes = [];
function syncProps() {
  for (const p of propMeshes) { G.dropProxy(p.hit); room.remove(p.m); p.m.geometry.dispose(); }
  propMeshes.length = 0;
  O().props.forEach((p, i) => {
    const def = PROP(p.k), m = propModel(p.k); m.position.set(p.x, p.y, p.z); m.rotation.y = p.ry; room.add(m);
    const hit = G.proxy(room, Math.max(def.w, 0.2), 0.3, Math.max(def.d, 0.2), {
      soft: true, prompt: () => ({ text: def.name, sub: "E: mover · R: vender" }), hold: () => 0, use: () => startPlace(p.k, i),
      options: () => sellProp(i), optLabel: "Vender",
    }, p.y + 0.12, p.x, p.z);
    propMeshes.push({ m, hit });
  });
}
function giveStarterProps() {
  const o = O(), t = TAB.top;
  o.props.push({ k: "pistol", x: TAB.x - 0.55, y: t, z: TAB.z + 0.25, ry: 0.5 }, { k: "knife", x: TAB.x - 0.2, y: t, z: TAB.z - 0.3, ry: -0.3 },
    { k: "cash", x: TAB.x - 0.85, y: t, z: TAB.z - 0.2, ry: 0.2 }, { k: "cash", x: TAB.x - 0.2, y: t, z: TAB.z + 0.3, ry: 1.2 }, { k: "case", x: TAB.x + 0.5, y: t, z: TAB.z + 0.3, ry: 0 });
}
// colocar: mirás un lugar del piso o de la mesa; E coloca, R gira, Q cancela
let placing = null;
const ghostOk = new T.MeshBasicMaterial({ color: 0x4cff9a, transparent: true, opacity: 0.55, depthWrite: false }), ghostBad = new T.MeshBasicMaterial({ color: 0xff4a4a, transparent: true, opacity: 0.55, depthWrite: false });
const ray = new T.Raycaster(); ray.far = 8;
function startPlace(k, fromIdx) {
  if (!ensure() || !built() || placing) return;
  const o = O(), def = PROP(k); if (!def) return;
  if (fromIdx == null && o.props.length >= 24) { G.toast("La oficina está llena de objetos (máximo 24).", "bad"); return; }
  let ry = 0, orig = null;
  if (fromIdx != null) { orig = o.props[fromIdx]; ry = orig.ry; o.props.splice(fromIdx, 1); syncProps(); }   // moverlo no cuesta
  const g = propModel(k); g.material = ghostOk; room.add(g);
  placing = { k, def, ry, g, from: fromIdx != null, ok: false, x: 0, y: 0, z: 0, lastX: orig && orig.x, lastY: orig && orig.y, lastZ: orig && orig.z };
  if (G.ui.panel) G.closePanel(true, true);
  G.toast(`Mirá dónde ponerlo: ${G.KEY} coloca · R gira · Q cancela.`, "");
}
function placeCheck(x, y, z) {
  if (x < X0 + 0.25 || x > X1 - 0.25 || z < Z0 + 0.25 || z > Z1 - 0.25) return false;
  if (y > 0.3) return true;                                                            // arriba de la mesa o de la consola
  for (const r of KEEP) if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) return false;
  if (x > TAB.x - TAB.w / 2 - 0.2 && x < TAB.x + TAB.w / 2 + 0.2 && z > TAB.z - TAB.d / 2 - 0.2 && z < TAB.z + TAB.d / 2 + 0.2) return false;
  if (z > CONS.z - CONS.d / 2 - 0.2) return false;
  if (x > CAGE.x0 - 0.3 && z > CAGE.z0 - 0.2) return false;
  return true;
}
function updatePlacing() {
  if (!placing) return;
  if (!room.visible || G.ui.panel || !G.started) { cancelPlace(); return; }
  ray.setFromCamera({ x: 0, y: 0 }, G.camera);
  const hit = ray.intersectObjects(room.userData.surfaces, false)[0];
  const p = placing;
  if (!hit) { p.g.visible = false; p.ok = false; return; }
  p.g.visible = true;
  p.x = Math.round(hit.point.x / 0.05) * 0.05; p.z = Math.round(hit.point.z / 0.05) * 0.05; p.y = hit.object === room.userData.surfaces[0] ? 0.0 : hit.point.y;
  p.g.position.set(p.x, p.y, p.z); p.g.rotation.y = p.ry;
  p.ok = placeCheck(p.x, p.y, p.z); p.g.material = p.ok ? ghostOk : ghostBad;
}
function cancelPlace(msg) {
  if (!placing) return;
  const p = placing; placing = null; room.remove(p.g); p.g.geometry.dispose();
  if (p.from) { O().props.push({ k: p.k, x: p.lastX != null ? p.lastX : TAB.x, y: p.lastY || TAB.top, z: p.lastZ != null ? p.lastZ : TAB.z, ry: p.ry }); syncProps(); }  // lo que estabas moviendo vuelve a su lugar
  if (msg) G.toast(msg, "");
}
function confirmPlace() {
  const p = placing; if (!p) return;
  if (!p.ok) { G.toast("Ahí no se puede poner (el pasillo de la puerta, la mesa y la bodega quedan libres).", "bad"); G.SFX.bad(); return; }
  if (!p.from && p.def.price > 0 && !G.Economy.trySpend("officeProp", p.def.price)) return;
  placing = null; room.remove(p.g); p.g.geometry.dispose();
  O().props.push({ k: p.k, x: p.x, y: p.y, z: p.z, ry: p.ry }); syncProps();
  G.sfx("register") || G.SFX.coin(); G.toast(p.from ? `${p.def.name}: movido.` : `${p.def.name}: ${p.def.price ? "comprado por " + fmt(p.def.price) : "listo"}.`, "good");
  G.updateHud(true); G.save(true);
}
function sellProp(i) {
  const o = O(), p = o.props[i]; if (!p) return; const def = PROP(p.k), back = Math.round(def.price * 0.5);
  o.props.splice(i, 1); syncProps(); if (back > 0) G.Economy.add("officeProp", back);
  G.toast(`Vendiste: ${def.name}${back ? ` (+${fmt(back)})` : ""}.`, ""); G.updateHud(true); G.save(true);
}
function openProps() {
  if (!ensure() || !built()) return;
  const s = S(), o = O();
  const rows = C.props.map(d => `<div class="item"><span class="sw" style="background:#c9962e"></span><div class="t"><b>${esc(d.name)} · <span class="num">${d.price ? fmt(d.price) : "gratis"}</span></b><span>${esc(d.desc)}</span></div>
    <div class="btns"><button data-foff="place" data-id="${d.id}" ${s.bank < d.price || o.props.length >= 24 ? "disabled" : ""}>Colocar</button></div></div>`).join("");
  const mine = o.props.length ? `<p class="dim">En la oficina: ${o.props.length}/24 objetos. Mirá uno y apretá ${G.KEY} para moverlo o R para venderlo (se devuelve el 50 %).</p>` : "";
  G.openPanel("officeProps", `<h2>Objetos de la oficina</h2><p>Banco <b class="num">${fmt(s.bank)}</b></p>${mine}<div class="list">${rows}</div><div class="actions"><button class="ghost" data-act="close">Cerrar</button></div>`);
}

// ---------------------------------------------------------------- las cámaras en el casino (se ven colgadas del techo)
const camGeoBody = new T.BoxGeometry(0.16, 0.13, 0.3), camGeoLens = new T.CylinderGeometry(0.045, 0.055, 0.06, 10), camGeoLed = new T.SphereGeometry(0.018, 6, 5), camGeoPole = new T.CylinderGeometry(0.018, 0.018, 1, 6);
const camMatBody = std(0xd8dde2, 0.4, 0.3), camMatDark = std(0x15181c, 0.3, 0.5), camLedOn = A.basic(0xff2a2a), camLedOff = A.basic(0x555555);
const camObjs = new Map();   // id → { g, led, hit }
function buildCam(c) {
  const g = new T.Group();
  const pole = new T.Mesh(camGeoPole, camMatDark); const ph = Math.max(0.05, WALL_H - c.y); pole.scale.set(1, ph, 1); pole.position.set(0, ph / 2 + 0.05, 0.05); g.add(pole);
  const body = new T.Mesh(camGeoBody, camMatBody); g.add(body);
  const lens = new T.Mesh(camGeoLens, camMatDark); lens.rotation.x = Math.PI / 2; lens.position.set(0, 0, -0.17); g.add(lens);
  const led = new T.Mesh(camGeoLed, camLedOn); led.position.set(0.06, 0.07, -0.08); g.add(led);
  root.add(g);
  const hit = G.proxy(g, 0.4, 0.35, 0.5, { soft: true, prompt: () => ({ text: c.name, sub: c.on ? "Cámara de seguridad · R: editar" : "Cámara apagada · R: editar" }), hold: () => 0, usable: () => false, use: () => {}, options: () => openCams(c.id), optLabel: "Editar cámaras" }, 0, 0, 0);
  return { g, led, hit };
}
function placeCamMesh(c) {
  let o = camObjs.get(c.id); if (!o) { o = buildCam(c); camObjs.set(c.id, o); }
  o.g.position.set(c.x, c.y, c.z); o.g.rotation.set(c.pitch, c.yaw, 0, "YXZ"); o.g.visible = built();
  o.led.material = c.on ? camLedOn : camLedOff;
}
function syncCams() {
  const ids = new Set(O().cams.map(c => c.id));
  for (const [id, o] of camObjs) if (!ids.has(id)) { G.dropProxy(o.hit); root.remove(o.g); o.g.traverse(m => { if (m.isMesh && m.geometry && !m.geometry.userData.shared) { /* geometrías compartidas */ } }); camObjs.delete(id); }
  for (const c of O().cams) placeCamMesh(c);
  if (setup) syncScreens();
}
function freshCam(name, x, z, yaw, pitch) { const o = O(); return { id: o.nextCam++, name, x, z, y: 3.1, yaw, pitch, fov: 70, on: true }; }

// ---------------------------------------------------------------- modo monitor: ves una cámara a pantalla completa, el juego sigue
let mon = null;
const css = document.createElement("style");
css.textContent = `
#offMon{position:fixed;inset:0;z-index:30;pointer-events:none;font:600 15px 'IBM Plex Mono',monospace;color:#9dffc2;text-shadow:0 1px 3px #000;
 background:repeating-linear-gradient(0deg,rgba(0,0,0,.14) 0 1px,transparent 1px 3px);box-shadow:inset 0 0 160px rgba(0,20,10,.75)}
#offMon .tl{position:absolute;left:0;right:0;top:64px;text-align:center;font-size:17px}#offMon .tr{position:absolute;left:0;right:0;top:90px;text-align:center}
#offMon .rec{color:#ff4a4a;animation:offblink 1s steps(2) infinite}@keyframes offblink{50%{opacity:.2}}
#offMon .bar{position:absolute;left:0;right:0;bottom:16px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;pointer-events:auto}
#offMon .bar button{background:rgba(7,20,15,.82);color:#e6f7ea;border:1px solid #2c6a4d;border-radius:6px;padding:.4em 1em;font:inherit;cursor:pointer}
#offMon .hint{position:absolute;left:0;right:0;bottom:62px;text-align:center;font-size:12px;opacity:.75}
.offp{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(220px,1fr);gap:12px;align-items:start}@media(max-width:860px){.offp{grid-template-columns:1fr}}
.offp canvas{width:100%;display:block;background:#0b1612;border:1px solid #23493b;border-radius:6px}
.offp .ctl{display:grid;grid-template-columns:70px 1fr 46px;gap:6px;align-items:center;font-size:.85rem;margin:3px 0}.offp .ctl input[type=range]{width:100%}
.offp input[type=text]{width:100%;background:#07140f;color:#f3e9d2;border:1px solid #2c4a3d;border-radius:5px;padding:.3em .5em;font:inherit}
.offp .chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.offp .chips button.on{background:var(--brass);color:var(--night);border-color:var(--brass)}
.offp .modes{display:flex;gap:6px;margin:6px 0}.offp .modes button.on{background:var(--brass);color:var(--night)}
.offw .who{border:1px solid #23493b;border-radius:6px;padding:8px 10px;margin:6px 0;background:rgba(7,20,15,.45)}
`;
document.head.appendChild(css);
const monEl = document.createElement("div"); monEl.id = "offMon"; monEl.hidden = true;
monEl.innerHTML = `<div class="tl"></div><div class="tr"></div><div class="hint">A / D o ◀ ▶ cambian de cámara · Tab edita · Esc sale</div><div class="bar"><button data-foff="mprev">◀ Anterior</button><button data-foff="mnext">Siguiente ▶</button><button data-foff="medit">Editar</button><button data-foff="mexit">Salir</button></div>`;
document.body.appendChild(monEl);
function enterMonitor(i) {
  if (!ensure() || !built() || mon || G.ui.blocking()) return;
  const cams = O().cams; if (!cams.length) { G.toast("Todavía no hay cámaras. Comprá una desde el editor (R en los monitores).", ""); return; }
  const p = G.player;
  mon = { i: clamp(i, 0, cams.length - 1), yaw: p.yaw, pitch: p.pitch, order: G.camera.rotation.order, fov: G.camera.fov };
  G.ui.mg = "oficina"; G.releasePointer(); G.useUp && G.useUp(); monEl.hidden = false; G.camera.visible = false; document.body.classList.add("mg-on");
  const cr = $("cross"); if (cr) cr.hidden = true; $("prompt").hidden = true; G.sfx("tick") || G.SFX.tick();
}
function exitMonitor(relock) {
  if (!mon) return;
  const m = mon; mon = null; G.ui.mg = null; monEl.hidden = true; G.camera.visible = true; document.body.classList.remove("mg-on");
  const p = G.player; p.yaw = m.yaw; p.pitch = m.pitch; G.camera.rotation.order = m.order; G.camera.fov = m.fov; G.camera.updateProjectionMatrix();
  const cr = $("cross"); if (cr) cr.hidden = false;
  if (relock !== false) G.requestPointer();
}
function monStep(d) { const n = O().cams.length; if (!n) return; mon.i = (mon.i + d + n) % n; G.SFX.tick(); }
function frameMonitor() {
  if (!mon) return;
  if (G.ui.panel || !built() || !O().cams.length) { exitMonitor(false); return; }
  if (mon.i >= O().cams.length) mon.i = 0;
  const c = O().cams[mon.i], cam = G.camera;
  cam.rotation.order = "YXZ"; cam.position.set(c.x - Math.sin(c.yaw) * 0.3, c.y - 0.1, c.z - Math.cos(c.yaw) * 0.3); cam.rotation.set(c.pitch, c.yaw, 0);
  if (cam.fov !== c.fov) { cam.fov = c.fov; cam.updateProjectionMatrix(); }
  const clock = $("hClock");
  monEl.querySelector(".tl").textContent = `CAM ${mon.i + 1}/${O().cams.length} · ${c.name}${c.on ? "" : " (apagada)"}`;
  monEl.querySelector(".tr").innerHTML = `<span class="rec">●</span> REC ${clock ? esc(clock.textContent) : ""}`;
}
window.addEventListener("keydown", e => {
  if (!G.started) return;
  if (mon) {
    const k = e.code; let used = true;
    if (k === "Escape" || k === "KeyQ") exitMonitor();
    else if (k === "ArrowLeft" || k === "KeyA") monStep(-1);
    else if (k === "ArrowRight" || k === "KeyD") monStep(1);
    else if (k === "Tab" || k === "KeyR") { const id = O().cams[mon.i].id; exitMonitor(false); openCams(id); }
    else used = false;
    if (used) { e.preventDefault(); e.stopImmediatePropagation(); }
    else if (k !== "F5" && k !== "F12") e.stopImmediatePropagation();      // en el monitor no se camina ni se usa nada
    return;
  }
  if (placing) {
    const k = e.code; let used = true;
    if (k === "KeyE") confirmPlace(); else if (k === "KeyR") placing.ry += Math.PI / 4; else if (k === "KeyQ" || k === "Escape") cancelPlace(); else used = false;
    if (used) { e.preventDefault(); e.stopImmediatePropagation(); }
  }
}, true);
monEl.addEventListener("click", e => {
  const b = e.target.closest("button[data-foff]"); if (!b || !mon) return;
  const a = b.dataset.foff;
  if (a === "mprev") monStep(-1); else if (a === "mnext") monStep(1); else if (a === "mexit") exitMonitor(); else if (a === "medit") { const id = O().cams[mon.i].id; exitMonitor(false); openCams(id); }
});

// ---------------------------------------------------------------- editor de cámaras (plano del casino + vista previa)
const PL = { x0: -23, x1: 23, z0: -17.5, z1: 10.5, s: 10 };
const px = x => (x - PL.x0) * PL.s, py = z => (PL.z1 - z) * PL.s;
let edMode = "move";                                  // "move": el próximo clic en el plano la mueve · "aim": el próximo clic la apunta
function selCam() { const o = O(); return o.cams[clamp(o.sel, 0, o.cams.length - 1)] || null; }
function openCams(selId) {
  if (!ensure() || !built()) return;
  const o = O(), s = S();
  if (selId != null) { const k = o.cams.findIndex(c => c.id === selId); if (k >= 0) o.sel = k; }
  const c = selCam(), canBuy = o.cams.length < K.max, price = K.price;
  const chips = o.cams.map((x, i) => `<button class="ghost sm ${i === o.sel ? "on" : ""}" data-foff="sel" data-id="${i}">${i + 1} · ${esc(x.name)}${x.on ? "" : " ○"}</button>`).join("");
  const ctl = c ? `
    <div class="ctl"><span>Nombre</span><input type="text" id="offName" maxlength="14" value="${esc(c.name)}"><span></span></div>
    <div class="ctl"><span>Giro</span><input type="range" id="offYaw" min="0" max="359" value="${Math.round(((c.yaw / DEG) % 360 + 360) % 360)}"><b id="offYawV"></b></div>
    <div class="ctl"><span>Inclinación</span><input type="range" id="offPitch" min="-60" max="15" value="${Math.round(c.pitch / DEG)}"><b id="offPitchV"></b></div>
    <div class="ctl"><span>Zoom</span><input type="range" id="offFov" min="${K.fovMin}" max="${K.fovMax}" value="${Math.round(c.fov)}"><b id="offFovV"></b></div>
    <div class="ctl"><span>Altura</span><input type="range" id="offH" min="${Math.round(K.hMin * 10)}" max="${Math.round(K.hMax * 10)}" value="${Math.round(c.y * 10)}"><b id="offHV"></b></div>
    <div class="modes"><button class="ghost sm ${edMode === "move" ? "on" : ""}" data-foff="mode" data-id="move">Mover (clic en el plano)</button><button class="ghost sm ${edMode === "aim" ? "on" : ""}" data-foff="mode" data-id="aim">Apuntar (clic en el plano)</button></div>
    <div class="actions" style="justify-content:flex-start"><button class="ghost sm" data-foff="toggle">${c.on ? "Apagar" : "Encender"}</button><button class="ghost sm" data-foff="view">Ver en vivo</button><button class="ghost sm" data-foff="del">Quitar (+${fmt(Math.round(price * K.refund))})</button></div>` : `<p class="dim">No hay cámaras. Comprá una.</p>`;
  G.openPanel("officeCams", `<h2>Cámaras de seguridad</h2>
    <p>Banco <b class="num">${fmt(s.bank)}</b> · ${o.cams.length}/${K.max} cámaras. Van en el salón, las alas, la entrada y la vereda. <span class="dim">La sala VIP no se vigila: ahí no se puede colocar ni apuntar.</span></p>
    <div class="chips">${chips}<button class="sm" data-foff="buy" ${canBuy && s.bank >= price ? "" : "disabled"}>+ Comprar cámara (${fmt(price)})</button></div>
    <div class="offp"><div><canvas id="offPlan" width="${(PL.x1 - PL.x0) * PL.s}" height="${(PL.z1 - PL.z0) * PL.s}"></canvas><p class="dim" style="margin:4px 0 0">Plano del casino (arriba: el fondo del salón; abajo: la entrada y la vereda).</p></div>
    <div>${c ? `<canvas id="offPrev" width="${FW}" height="${FH}"></canvas>` : ""}${ctl}</div></div>
    <div class="actions"><button class="ghost" data-act="close">Cerrar</button></div>`);
  afterCams();
}
function afterCams() {
  const c = selCam(); drawPlan();
  if (!c) return;
  const set = (id, t) => { const el = $(id); if (el) el.textContent = t; };
  set("offYawV", Math.round(((c.yaw / DEG) % 360 + 360) % 360) + "°"); set("offPitchV", Math.round(c.pitch / DEG) + "°"); set("offFovV", Math.round(c.fov) + "°"); set("offHV", c.y.toFixed(1) + " m");
  drawPreview();
}
function drawPlan() {
  const cv = $("offPlan"); if (!cv) return; const g = cv.getContext("2d"), s = S(), o = O();
  g.fillStyle = "#0b1612"; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = "#1b1e22"; g.fillRect(px(-23), py(-10), px(23) - px(-23), py(-17.5) - py(-10));
  g.fillStyle = "#3a3d42"; g.fillRect(px(-14), py(-11.2), px(14) - px(-14), py(-10.6) - py(-11.2));
  g.fillStyle = "#16251f"; g.fillRect(px(-22), py(10), px(22) - px(-22), py(-10) - py(10));
  g.strokeStyle = "#b88d42"; g.lineWidth = 2; g.strokeRect(px(-22), py(10), px(22) - px(-22), py(-10) - py(10));
  for (const [zid, x0, x1] of [["este", 10, 22], ["oeste", -22, -10]]) if (!(s.zones && s.zones[zid])) { g.fillStyle = "rgba(120,30,30,.45)"; g.fillRect(px(x0), py(10), px(x1) - px(x0), py(-10) - py(10)); g.fillStyle = "#e6c27a"; g.font = "13px sans-serif"; g.textAlign = "center"; g.fillText("sin comprar", px((x0 + x1) / 2), py(0)); }
  g.fillStyle = "#3cd47a"; g.fillRect(px(-1.4), py(-10) - 3, px(1.4) - px(-1.4), 6);
  g.fillStyle = "#d9a84a"; for (const m of G.machines) if (m.slot) g.fillRect(px(m.slot.x) - 4, py(m.slot.z) - 4, 8, 8);
  g.fillStyle = "#4a8f6a"; for (const t of G.tables) { const gp = t.group && t.group.position; if (gp) { g.beginPath(); g.arc(px(gp.x), py(gp.z), 9, 0, 7); g.fill(); } }
  g.fillStyle = "#6f8a90"; g.font = "11px sans-serif"; g.textAlign = "left"; g.fillText("ENTRADA", px(-1.2), py(-10) + 15);
  o.cams.forEach((c, i) => {
    const on = i === o.sel, cx = px(c.x), cy = py(c.z), r = 55, hf = 2 * Math.atan(Math.tan(c.fov * DEG / 2) * 16 / 9);
    const a = Math.atan2(-Math.cos(c.yaw), -Math.sin(c.yaw));                         // dirección en el mundo (x, z)
    g.fillStyle = c.on ? (on ? "rgba(246,199,102,.35)" : "rgba(79,224,255,.18)") : "rgba(120,120,120,.12)";
    g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, -a - hf / 2, -a + hf / 2); g.closePath(); g.fill();
    g.fillStyle = on ? "#f6c766" : c.on ? "#4fe0ff" : "#888"; g.beginPath(); g.arc(cx, cy, 6, 0, 7); g.fill();
    g.fillStyle = "#06120d"; g.font = "bold 10px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(i + 1), cx, cy + 0.5);
  });
}
function drawPreview() {
  const cv = $("offPrev"), i = O().sel; if (!cv) return; const c = O().cams[i], g = cv.getContext("2d");
  if (!c || !c.on || !renderFeed(i)) { g.fillStyle = "#0a0f12"; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = "#6f8a90"; g.font = "bold 18px monospace"; g.textAlign = "center"; g.fillText("SIN SEÑAL", cv.width / 2, cv.height / 2); return; }
  try {
    const buf = new Uint8Array(FW * FH * 4); G.renderer.readRenderTargetPixels(rtOf(i).rt, 0, 0, FW, FH, buf);
    const img = g.createImageData(FW, FH);
    for (let y = 0; y < FH; y++) { const src = (FH - 1 - y) * FW * 4; img.data.set(buf.subarray(src, src + FW * 4), y * FW * 4); }
    for (let k = 3; k < img.data.length; k += 4) img.data[k] = 255;     // el render target deja el alfa en 0
    g.putImageData(img, 0, 0);
  } catch (e) { g.fillStyle = "#0a0f12"; g.fillRect(0, 0, cv.width, cv.height); }
}
function camChanged() { const c = selCam(); if (c) placeCamMesh(c); drawPlan(); drawPreview(); syncScreens(); }
function tryCam(mut) {  // aplica un cambio y lo deshace si deja la cámara en un lugar o ángulo prohibido
  const c = selCam(); if (!c) return false; const bak = Object.assign({}, c);
  mut(c);
  if (!areaOk(c.x, c.z)) { Object.assign(c, bak); G.toast(WHY_AREA, "bad"); G.SFX.bad(); return false; }
  if (aimsAtVip(c)) { Object.assign(c, bak); G.toast(WHY_AIM, "bad"); G.SFX.bad(); return false; }
  return true;
}
function planClick(e) {
  const cv = e.currentTarget, r = cv.getBoundingClientRect(), x = PL.x0 + (e.clientX - r.left) / r.width * (PL.x1 - PL.x0), z = PL.z1 - (e.clientY - r.top) / r.height * (PL.z1 - PL.z0);
  const o = O(); let hit = -1, bd = 1.1;
  o.cams.forEach((c, i) => { const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; hit = i; } });
  if (hit >= 0 && hit !== o.sel) { o.sel = hit; openCams(); return; }
  const c = selCam(); if (!c) return;
  if (edMode === "move") { if (tryCam(k => { k.x = Math.round(x * 2) / 2; k.z = Math.round(z * 2) / 2; })) camChanged(); }
  else if (tryCam(k => { k.yaw = Math.atan2(-(x - k.x), -(z - k.z)); })) { camChanged(); openCams(); }
}
function buyCam() {
  const o = O(), s = S(); if (o.cams.length >= K.max) return;
  if (!G.Economy.trySpend("officeCam", K.price)) return;
  const c = freshCam("Cámara " + (o.cams.length + 1), 0, 0, Math.PI, -0.35); // en el medio del salón, mirando a la entrada
  c.z = 2; c.yaw = 0; c.pitch = -0.4; o.cams.push(c); o.sel = o.cams.length - 1; void s;
  syncCams(); G.sfx("register") || G.SFX.coin(); G.updateHud(true); G.save(true); openCams();
}
function delCam() {
  const o = O(), c = selCam(); if (!c) return; o.cams.splice(o.sel, 1); o.sel = clamp(o.sel, 0, Math.max(0, o.cams.length - 1));
  G.Economy.add("officeCam", Math.round(K.price * K.refund)); syncCams(); G.updateHud(true); G.save(true); openCams();
}

// ---------------------------------------------------------------- lingotes de oro
function openGold() {
  if (!ensure() || !built()) return;
  const o = O(), g = o.gold, s = S(), value = g.bars * g.price, net = Math.round(value * (1 - GD.spread)), gain = net - g.cost;
  const lot = n => Math.min(n, GD.maxBars - g.bars);
  const buys = GD.lots.map(n => { const k = lot(n), cost = k * g.price; return `<button data-foff="gbuy" data-id="${n}" ${k < 1 || s.bank < cost ? "disabled" : ""}>Comprar ${k < n ? k : n} (${fmt(cost)})</button>`; }).join("");
  const sells = GD.lots.map(n => `<button class="ghost" data-foff="gsell" data-id="${n}" ${g.bars < 1 ? "disabled" : ""}>Vender ${Math.min(n, g.bars)}</button>`).join("") + `<button class="ghost" data-foff="gsell" data-id="all" ${g.bars < 1 ? "disabled" : ""}>Vender todo</button>`;
  const prev = g.hist.length > 1 ? g.hist[g.hist.length - 2] : g.price, chg = (g.price - prev) / prev * 100;
  G.openPanel("officeGold", `<h2>Bodega de lingotes de oro</h2>
    <p>Banco <b class="num">${fmt(s.bank)}</b> · lingotes <b class="num">${g.bars}/${GD.maxBars}</b></p>
    <p>Precio de hoy: <b class="num">${fmt(g.price)}</b> por lingote <span class="${chg >= 0 ? "in" : "out"}">(${chg >= 0 ? "+" : ""}${chg.toFixed(1)} % vs. ayer)</span>. Cambia cada noche y de a poco tiende a subir, pero hay días malos. Al vender, la casa de compraventa se queda el ${Math.round(GD.spread * 100)} %.</p>
    <canvas id="offGoldCv" width="520" height="110" style="width:100%;background:#0b1612;border:1px solid #23493b;border-radius:6px"></canvas>
    <div class="note">Tenés ${g.bars} lingotes pagados ${fmt(g.cost)} · hoy valen ${fmt(value)} (vendidos: ${fmt(net)}) · ${gain >= 0 ? "ganancia" : "pérdida"} <b class="${gain >= 0 ? "in" : "out"}">${fmt(Math.abs(gain))}</b></div>
    <h3>Comprar</h3><div class="actions" style="justify-content:flex-start">${buys}</div>
    <h3>Vender</h3><div class="actions" style="justify-content:flex-start">${sells}</div>
    <div class="actions"><button class="ghost" data-act="close">Cerrar</button></div>`);
  const cv = $("offGoldCv"); if (cv) {
    const x = cv.getContext("2d"), h = g.hist, lo = Math.min(...h) * 0.95, hi = Math.max(...h) * 1.05;
    x.strokeStyle = "#f6c766"; x.lineWidth = 2.5; x.beginPath();
    h.forEach((v, i) => { const X = 14 + i * (cv.width - 28) / Math.max(1, h.length - 1), Y = cv.height - 14 - (v - lo) / Math.max(1, hi - lo) * (cv.height - 28); i ? x.lineTo(X, Y) : x.moveTo(X, Y); }); x.stroke();
    x.fillStyle = "#e6c27a"; x.font = "12px monospace"; x.fillText("últimos " + h.length + " días", 8, 14);
  }
}
function buyGold(n) {
  const o = O(), g = o.gold; n = Math.min(n, GD.maxBars - g.bars); if (n < 1) return;
  const cost = n * g.price; if (!G.Economy.trySpend("goldBuy", cost)) return;
  g.bars += n; g.cost += cost; syncBars(); G.sfx("register") || G.SFX.coin(); G.toast(`Compraste ${n} lingote${n > 1 ? "s" : ""} por ${fmt(cost)}.`, "good"); G.updateHud(true); G.save(true);
}
function sellGold(n) {
  const o = O(), g = o.gold; n = n === "all" ? g.bars : Math.min(Number(n), g.bars); if (n < 1) return;
  const got = Math.round(n * g.price * (1 - GD.spread)), basis = Math.round(g.cost * n / g.bars);
  G.Economy.add("goldSell", got); g.bars -= n; g.cost = g.bars ? Math.max(0, g.cost - basis) : 0; syncBars();
  G.sfx("register") || G.SFX.cash(); G.toast(`Vendiste ${n} lingote${n > 1 ? "s" : ""}: ${fmt(got)} (${got >= basis ? "ganaste " + fmt(got - basis) : "perdiste " + fmt(basis - got)}).`, got >= basis ? "good" : ""); G.updateHud(true); G.save(true);
}
function onEndDay(notes) {
  if (!ensure() || !built()) return;
  const g = O().gold, day = S().day; if (g.day === day) return; g.day = day;
  let ch = GD.drift + (Math.random() * 2 - 1) * GD.vol;
  if (Math.random() < GD.eventChance) { const sw = rnd(GD.eventSwing[0], GD.eventSwing[1]) * (Math.random() < 0.5 ? -1 : 1); ch += sw; notes.push(sw > 0 ? "Fiebre del oro: el lingote se disparó." : "El oro se desplomó por una mala noticia."); }
  const old = g.price; g.price = clamp(Math.round(g.price * (1 + ch)), GD.minPrice, GD.maxPrice);
  g.hist.push(g.price); while (g.hist.length > GD.historyDays) g.hist.shift();
  if (g.bars > 0 || O().cams.length) notes.push(`Lingote de oro: ${fmt(g.price)} (${g.price >= old ? "+" : ""}${((g.price - old) / old * 100).toFixed(1)} %). Tenés ${g.bars} en la bodega.`);
}

// ---------------------------------------------------------------- construir la oficina
function openBuild() {
  if (!ensure() || built()) return;
  const s = S(), ok = s.rank >= C.rank;
  G.openPanel("officeBuild", `<h2>Oficina de seguridad</h2>
    <p>Detrás de la pared del fondo, a la derecha de la estantería, hay lugar para una oficina blindada. Incluye:</p>
    <div class="note">• Puerta blindada que abrís y cerrás cuando quieras.<br>• Panel con monitores: ${K.free} cámaras en vivo (hasta ${K.max}) que movés y apuntás desde un plano.<br>• Mesa con armas de adorno y plata, y arriba una contadora de billetes.<br>• Bodega de lingotes de oro, con precio que cambia y tiende a subir.<br>• Walkie-talkie (V): le ordenás a un guardia sacar a alguien del casino o traerlo a la oficina.<br><span class="dim">Las cámaras cubren el salón, las alas, la entrada y la vereda. La sala VIP no se vigila.</span></div>
    <p>Banco <b class="num">${fmt(s.bank)}</b></p>
    <div class="actions"><button class="ghost" data-act="close">Ahora no</button><button data-foff="build" ${!ok || s.bank < C.buildCost ? "disabled" : ""}>${ok ? `Construir (${fmt(C.buildCost)})` : `Rango ${C.rank}`}</button></div>`);
}
function build() {
  if (!ensure() || built()) return;
  if (S().rank < C.rank) { G.toast(`Necesitás rango ${C.rank}.`, "bad"); return; }
  if (!G.Economy.trySpend("officeBuild", C.buildCost)) return;
  const o = O(); o.built = true; o.open = true; o.gold.day = S().day;
  o.cams.push(freshCam("Entrada", 4, -9.3, Math.PI, -0.3), freshCam("Salón", 0, 8.4, 0, -0.35)); o.cams[1].z = 8.4;
  giveStarterProps(); refreshAll(); G.sfx("register") || G.SFX.coin(); G.SFX.rank();
  G.toast("¡Oficina de seguridad construida! Entrá por la puerta blindada, a la derecha de la estantería del fondo.", "good"); G.updateHud(true); G.save(true); G.closePanel(true, true);
}

// ---------------------------------------------------------------- walkie-talkie: guardias que sacan o traen gente
let oid = 1;
const isGuard = n => n.role === "sec";
const guardFree = n => isGuard(n) && !n.dead && !n.offTask && !n.off && !n.lifeTask && !n.ownerTask && !n.cmb && n.state !== "bonk" && n.state !== "chase";
const guards = () => G.staffNpcs.filter(guardFree);
function labelOf(a) {
  if (!a.oid) a.oid = oid++;
  if (a.kind === "staff") return `${a.rec ? a.rec.name : a.def.name} · ${a.def.name}`;
  return `${a.type.name} #${a.oid}`;
}
const STATE_TXT = { enter: "entrando", greet: "esperando que lo reciban", choose: "eligiendo juego", queue: "en la fila", walk: "yendo a jugar", play: "jugando", leave: "yéndose", flee: "huyendo", caught: "atrapado" };
function statusOf(a) {
  if (a.kind === "staff") return a.off ? "en la oficina" : (a.state === "idle" || a.state === "patrol" ? "en su puesto" : "trabajando");
  if (a.off) return "en la oficina";
  if (a.state === "play") return a.machine ? "jugando en " + a.machine.def.name : a.table ? "jugando en " + a.table.def.name : "jugando";
  return STATE_TXT[a.state] || a.state;
}
function targets() {
  const out = [];
  for (const c of G.customers) if (!c.dead && c.person && c.person.group.visible !== false) out.push(c);
  for (const n of G.staffNpcs) if (!n.dead && n.person) out.push(n);
  return out;
}
function busyWhy(a, mode) {
  if (a.off) return "ya está en la oficina";
  if (a.kind === "customer") {
    if (a.thief) return mode === "eject" ? "" : "es un ladrón";
    if (a.cmb || a.life || a.owner || a.shop) return "ocupado en otra cosa";
    if (a.state === "leave" || a.state === "flee" || a.state === "caught") return "ya se está yendo";
    if (a.state === "enter") return "recién entra";
    return "";
  }
  if (mode === "eject") return "es parte del personal (despedilo desde Personal, P)";
  if (a.offTask) return "está cumpliendo una orden";
  if (a.cmb || a.lifeTask || a.ownerTask || a.state === "bonk" || a.state === "chase") return "ocupado en otra cosa";
  if (isGuard(a) && guards().length < 2) return "es tu único guardia libre";
  return "";
}
function aimed() {
  const list = targets(), meshes = [], map = new Map();
  for (const a of list) { const m = a.person.proxy; if (m) { meshes.push(m); map.set(m, a); } }
  ray.far = 22; ray.setFromCamera({ x: 0, y: 0 }, G.camera);
  const hit = ray.intersectObjects(meshes, false)[0]; ray.far = 8;
  return hit ? map.get(hit.object) : null;
}
function pickGuard(a) {
  let best = null, bd = Infinity;
  for (const n of guards()) { if (n === a) continue; const d = Math.hypot(n.x - a.x, n.z - a.z); if (d < bd) { bd = d; best = n; } }
  return best;
}
function order(a, mode) {
  if (!ensure() || !built() || !a || a.dead) return false;
  const why = busyWhy(a, mode); if (why) { G.toast(`No se puede: ${labelOf(a)} ${why}.`, "bad"); return false; }
  if (mode === "bring" && !doorOpen()) G.toast("Ojo: la puerta blindada está cerrada. Esperarán afuera hasta que la abras.", "");
  const n = pickGuard(a);
  if (!n) { G.toast(guards().length ? "No hay otro guardia libre." : "No tenés ningún guardia libre. Contratá uno en Personal (P).", "bad"); return false; }
  if (a.thief) { n.state = "chase"; n.thief = a; n.path = null; n.t = 0; G.toast("Mandaste a un guardia a atrapar al ladrón.", "good"); return true; }
  n.offTask = { a, mode, phase: "go", t: 0, re: 0 }; n.path = null;
  G.setIcon(a.person, mode === "eject" ? "excl" : "star");
  G.sfx("tick") || G.SFX.tick();
  G.toast(mode === "eject" ? `Guardia en camino a sacar a ${labelOf(a)}.` : `Guardia en camino a traer a ${labelOf(a)} a la oficina.`, "good");
  return true;
}
function endTask(n, msg) { if (n.offTask && n.offTask.a && n.offTask.a.person && !n.offTask.a.off) G.setIcon(n.offTask.a.person, null); n.offTask = null; if (msg) G.toast(msg, ""); G.backHome(n); }
function staffTask(n, dt) {
  const k = n.offTask; if (!k) return false;
  const a = k.a, p = n.person;
  if (!p) { n.offTask = null; return false; }
  k.t += dt;
  if (k.phase === "go") {
    if (!a || a.dead || !a.person || a.state === "leave" && k.mode === "bring") { endTask(n, "El guardia no encontró a la persona."); return true; }
    if (a.kind === "customer" && (a.state === "leave" || a.state === "flee") && k.mode === "eject") { endTask(n); return true; } // ya se iba solo
    k.re -= dt; if (k.re <= 0 || !n.path || !n.path.length) { k.re = 0.5; G.goTo(n, a.x, a.z); }
    G.stepAgent(n, dt, WK.guardSpeed);
    if (Math.hypot(n.x - a.x, n.z - a.z) < 1.3) {
      p.api.idle(dt);
      if (k.mode === "eject") startEject(n, a); else startBring(n, a);
    } else if (k.t > WK.maxWait) endTask(n, "El guardia no pudo alcanzar a la persona y volvió a su puesto.");
    return true;
  }
  if (k.phase === "escort") { if (G.stepAgent(n, dt, WK.escortSpeed)) endTask(n); return true; }
  n.offTask = null; return false;
}
function startEject(n, c) {
  const K2 = WK.kick, trouble = !!(c.lifeAct && c.lifeAct.active && c.lifeAct.active()) || !!c.cmb;
  G.releaseGame(c); c.flags.kicked = true;
  if (c.person) { c.person.api.stand(); G.setBar(c.person, null); }
  if (trouble) { G.Rep.change(K2.trouble); G.toast(`Sacaron a ${labelOf(c)}: estaba haciendo lío. La gente lo agradece.`, "good"); }
  else {
    const rp = K2[c.type.id] != null ? K2[c.type.id] : K2.casual; G.Rep.change(rp);
    if (c.type.loyal) S().loyalty[c.type.id] = clamp((S().loyalty[c.type.id] || 0) + K2.loyalty, 0, G.CFG.loyaltyMax);
    G.toast(`Sacaron a ${labelOf(c)} del casino. Reputación ${rp.toFixed(1)}.`, rp < -1 ? "bad" : "");
  }
  c.state = "leave"; c.speed = Math.max(c.speed, 2.6); const sp = G.streetPoint(); G.goTo(c, sp.x, sp.z); G.setIcon(c.person, "excl");
  n.offTask.phase = "escort"; G.goTo(n, G.DOOR.x, G.DOOR.z + 0.6);
}
function startBring(n, a) {
  const was = a.interact;
  if (a.kind === "customer") { G.releaseGame(a); if (a.drink && a.drink.state !== "served") a.drink.state = "missed"; if (a.person) { G.setBar(a.person, null); } }
  else G.releaseNpcTask(a);
  if (a.person) a.person.api.stand();
  a.off = { phase: "go", t: 0, orig: was, guard: n, after: "resume", spot: null };
  G.setIcon(a.person, "star");
  G.goTo(a, STEP.x, STEP.z);
  n.offTask.phase = "escort"; G.goTo(n, STEP.x + 0.9, STEP.z - 0.3);
}
function freeSpot() {
  const used = new Set(); for (const a of targets()) if (a.off && a.off.spot != null) used.add(a.off.spot);
  for (let i = 0; i < SPOTS.length; i++) if (!used.has(i)) return i;
  return -1;
}
function actor(a, dt) {
  const o = a.off; if (!o) return false;
  const p = a.person; if (!p || !ensure()) { a.off = null; return false; }
  const sp = a.kind === "staff" ? 3.2 : 2.7;
  switch (o.phase) {
    case "go": if (G.stepAgent(a, dt, sp)) { o.phase = "door"; o.t = 0; } break;
    case "door":
      o.t += dt; p.api.idle(dt);
      if (doorOpen()) {
        const i = freeSpot();
        if (i >= 0) { o.spot = i; o.phase = "in"; a.path = [{ x: DOORX, z: 10.9 }, { x: SPOTS[i].x, z: SPOTS[i].z }]; }
      }
      if (o.t > WK.doorWait) { G.toast(`${labelOf(a)} se cansó de esperar afuera.`, ""); release(a); }
      break;
    case "in":
      if (G.stepAgent(a, dt, sp)) {
        o.phase = "wait"; o.t = 0; const s = SPOTS[o.spot]; p.group.rotation.y = s.yaw; G.setIcon(p, "star");
        a.interact = officeInteract(a);
        G.toast(`${labelOf(a)} está en la oficina. Hablale (${G.KEY}) para dejarlo ir o sacarlo.`, "good");
      }
      break;
    case "wait":
      p.api.idle(dt); o.t += dt;
      if (o.t > WK.officeSec * 3 && !o.nag) { o.nag = true; G.toast(`${labelOf(a)} sigue esperando en la oficina.`, ""); }
      break;
    case "out":
      if (!doorOpen()) { p.api.idle(dt); break; }
      if (!a.path || !a.path.length) a.path = [{ x: DOORX, z: 10.9 }, { x: STEP.x, z: STEP.z }];
      if (G.stepAgent(a, dt, sp)) release(a);
      break;
  }
  return true;
}
function release(a) {
  const o = a.off; if (!o) return; a.off = null; a.path = null; a.interact = o.orig;
  if (a.person) G.setIcon(a.person, null);
  if (a.kind === "staff") { G.backHome(a); G.assignDealers(); return; }
  if (o.after === "leave") { applyEjectFromOffice(a); return; }
  a.state = "choose"; a.waitT = 0; a.timer = 0;
}
function applyEjectFromOffice(c) {
  const K2 = WK.kick, rp = K2[c.type.id] != null ? K2[c.type.id] : K2.casual; G.Rep.change(rp);
  if (c.type.loyal) S().loyalty[c.type.id] = clamp((S().loyalty[c.type.id] || 0) + K2.loyalty, 0, G.CFG.loyaltyMax);
  c.flags.kicked = true; c.state = "leave"; c.speed = Math.max(c.speed, 2.6); const sp = G.streetPoint(); G.goTo(c, sp.x, sp.z);
  G.toast(`Sacaste a ${labelOf(c)} del casino. Reputación ${rp.toFixed(1)}.`, rp < -1 ? "bad" : "");
}
function officeInteract(a) {
  return { soft: false, hold: () => 0, usable: () => true,
    prompt: () => ({ text: `${labelOf(a)} · en la oficina`, sub: "Hablar: dejarlo ir o sacarlo del casino" }),
    use: () => openTalk(a) };
}
function openTalk(a) {
  if (!a.off) return;
  const cust = a.kind === "customer";
  G.openPanel("officeTalk", `<h2>${esc(labelOf(a))}</h2><p>Está parado frente a tu mesa, con un guardia afuera. ${cust ? "Podés dejarlo seguir jugando o echarlo del casino." : "Es parte del personal: puede volver a su puesto."}</p>
    ${doorOpen() ? "" : `<div class="warn">La puerta blindada está cerrada: abrila para que pueda salir.</div>`}
    <div class="actions"><button class="ghost" data-act="close">Seguir hablando</button><button data-foff="tletgo">${cust ? "Dejarlo ir" : "Que vuelva al trabajo"}</button>${cust ? `<button class="danger" data-foff="tkick">Sacarlo del casino</button>` : ""}</div>`, { talk: a });
}
function leaveOffice(a, after) { if (!a.off) return; a.off.phase = "out"; a.off.after = after; a.off.spot = null; a.path = null; }
function onDespawn(c) { if (c.off) { c.off = null; } }

// panel del walkie
let wTab = "aim";
function openWalkie(tab) {
  if (!ensure() || !built()) { G.toast("Primero construí la oficina de seguridad: ahí está el walkie-talkie.", ""); return; }
  const a = tab === "aim" || tab == null ? aimed() : null;
  wTab = tab || (a ? "aim" : "list");
  const gd = guards(), total = G.staffNpcs.filter(isGuard).length;
  const head = `<p>Guardias libres: <b>${gd.length}</b> de ${total}. ${total ? "" : "No tenés guardias: contratalos en Personal (P)."} Apuntá a alguien y apretá <kbd>V</kbd>, o elegilo de la lista.</p>
    <div class="tabs"><button class="${wTab === "aim" ? "on" : ""}" data-foff="wtab" data-id="aim">Al que apuntás</button><button class="${wTab === "list" ? "on" : ""}" data-foff="wtab" data-id="list">Lista del casino</button></div>`;
  let body = "";
  const row = x => { const be = busyWhy(x, "eject"), bb = busyWhy(x, "bring"); const id = (x.oid = x.oid || oid++);
    return `<div class="item"><span class="sw" style="background:${x.kind === "staff" ? "#4fa3c7" : "#d9a84a"}"></span><div class="t"><b>${esc(labelOf(x))}</b><span>${esc(statusOf(x))}${bb && be ? " · " + esc(bb) : ""}</span></div>
      <div class="btns"><button data-foff="wsend" data-id="${id}" data-mode="eject" ${be || !gd.length ? "disabled" : ""}>Sacar</button><button data-foff="wsend" data-id="${id}" data-mode="bring" ${bb || !gd.length ? "disabled" : ""}>Traer</button></div></div>`; };
  if (wTab === "aim") {
    body = a ? `<div class="who"><b>${esc(labelOf(a))}</b><br><span class="dim">${esc(statusOf(a))}</span></div><div class="list">${row(a)}</div>` : `<p class="dim">No estás apuntando a nadie. Cerrá esto, mirá a la persona (hasta 22 m) y apretá V, o usá la lista.</p>`;
  } else {
    const list = targets().sort((x, y) => (x.kind === y.kind ? 0 : x.kind === "customer" ? -1 : 1)).slice(0, 40);
    body = list.length ? `<div class="list">${list.map(row).join("")}</div>` : `<p class="dim">No hay nadie en el casino.</p>`;
  }
  const busy = G.staffNpcs.filter(n => n.offTask);
  const ord = busy.length ? `<h3>Órdenes en curso</h3>${busy.map(n => `<p class="dim">${esc(n.rec ? n.rec.name : "Guardia")}: ${n.offTask.mode === "eject" ? "sacando a" : "trayendo a"} ${esc(labelOf(n.offTask.a))}</p>`).join("")}` : "";
  G.openPanel("officeWalkie", `<div class="offw"><h2>Walkie-talkie</h2>${head}${body}${ord}<p class="dim">Sacar baja la reputación (más si es un cliente importante) salvo que esté haciendo lío. Traer lo lleva a la oficina; la puerta blindada tiene que estar abierta.</p><div class="actions"><button class="ghost" data-act="close">Cerrar</button></div></div>`);
}
window.addEventListener("keydown", e => {
  if (e.code !== "KeyV" || e.repeat || !G.started || G.isTouch) return;
  if (G.ui.panel === "officeWalkie") { G.closePanel(false, true); return; }
  if (G.ui.blocking() || mon || placing || (window.CasinoBuild && window.CasinoBuild.active)) return;
  openWalkie();
});

// ---------------------------------------------------------------- clics en los paneles
$("panelBody").addEventListener("click", e => {
  const b = e.target.closest("[data-foff]"); if (!b || b.disabled || !ensure()) return;
  const a = b.dataset.foff, id = b.dataset.id;
  switch (a) {
    case "build": build(); return;
    case "place": startPlace(id, null); return;
    case "sel": O().sel = int(id, 0, 0, 99); openCams(); return;
    case "mode": edMode = id === "aim" ? "aim" : "move"; openCams(); return;
    case "buy": buyCam(); return;
    case "del": delCam(); return;
    case "toggle": { const c = selCam(); if (c) { c.on = !c.on; syncCams(); G.save(true); openCams(); } return; }
    case "view": { const i = O().sel; G.closePanel(true, false); enterMonitor(i); return; }
    case "gbuy": buyGold(int(id, 1, 1, 64)); openGold(); return;
    case "gsell": sellGold(id); openGold(); return;
    case "wtab": openWalkie(id); return;
    case "wsend": { const x = targets().find(t => String(t.oid) === String(id)); if (x && order(x, b.dataset.mode)) G.closePanel(true, true); else openWalkie(wTab); return; }
    case "tletgo": { const x = G.ui.ctx && G.ui.ctx.talk; if (x) leaveOffice(x, "resume"); G.closePanel(true, true); return; }
    case "tkick": { const x = G.ui.ctx && G.ui.ctx.talk; if (x) leaveOffice(x, "leave"); G.closePanel(true, true); return; }
  }
});
$("panelBody").addEventListener("input", e => {
  if (G.ui.panel !== "officeCams") return;
  const t = e.target, c = selCam(); if (!c) return;
  const set = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
  if (t.id === "offName") { c.name = t.value.slice(0, 14) || "Cámara"; placeCamMesh(c); syncScreens(); return; }
  const v = Number(t.value); let ok = true;
  if (t.id === "offYaw") ok = tryCam(k => { k.yaw = v * DEG; });
  else if (t.id === "offPitch") ok = tryCam(k => { k.pitch = v * DEG; });
  else if (t.id === "offFov") ok = tryCam(k => { k.fov = v; });
  else if (t.id === "offH") ok = tryCam(k => { k.y = v / 10; });
  else return;
  if (!ok) { openCams(); return; }
  set("offYawV", Math.round(((c.yaw / DEG) % 360 + 360) % 360) + "°"); set("offPitchV", Math.round(c.pitch / DEG) + "°"); set("offFovV", Math.round(c.fov) + "°"); set("offHV", c.y.toFixed(1) + " m");
  if (t.id === "offH") { const o = camObjs.get(c.id); if (o) { G.dropProxy(o.hit); root.remove(o.g); camObjs.delete(c.id); } }
  camChanged();
});
document.addEventListener("click", e => { const cv = e.target && e.target.id === "offPlan" ? e.target : null; if (cv && G.ui.panel === "officeCams") planClick({ currentTarget: cv, clientX: e.clientX, clientY: e.clientY }); });
new MutationObserver(() => { const el = $("panelBody"); if (G.ui.panel !== "officeCams" && el && !el.querySelector("#offPlan")) G.save(true); }).observe($("panelBody"), { childList: true });

// ---------------------------------------------------------------- cada cuadro / cada tick
let doorTick = 0;
function refreshAll() {
  const b = built(); setup = true;
  plug.visible = !b; doorHit.visible = b;
  root.userData.hdr.visible = b; for (const j of root.userData.jambs) j.visible = b; doorLamp.visible = doorLampOut.visible = b; doorPivot.visible = b;
  if (b) { syncCams(); syncProps(); syncBars(); syncScreens(); }
  else { for (const [, o] of camObjs) { o.g.visible = false; } }
  doorAng = b && doorOpen() ? -1.48 : 0; doorPivot.rotation.y = doorAng;
}
function frame(real) {
  if (!ensure()) return;
  const b = built();
  if (!b) { room.visible = false; return; }
  const pl = G.player, nearDoor = doorOpen() && pl.z < 10 && Math.hypot(pl.x - DOORX, pl.z - 10) < 12;
  room.visible = (inside() || nearDoor) && !mon;   // con la puerta abierta se ve la oficina desde el salón
  if (G.ui.mg === "oficina" && !mon) G.ui.mg = null;
  const tgt = doorOpen() ? -1.48 : 0; doorAng += (tgt - doorAng) * Math.min(1, real * 5); doorPivot.rotation.y = doorAng;
  if (doorWheel) doorWheel.rotation.z = -doorAng * 3;
  const lamp = doorOpen() ? doorLampOpen : doorLampShut; doorLamp.material = doorLampOut.material = lamp;
  for (const a of anim) a.update(real);
  const blink = (performance.now() % 1400) < 700; for (const [, o] of camObjs) o.led.visible = blink;
  frameMonitor(); frameFeeds(real); frameCount(real); updatePlacing();
  if (shownBars !== O().gold.bars) syncBars();
}
function update(dt) {
  if (!ensure() || !built()) return;
  updateCount(dt);
  if (O().cams.length !== camObjs.size) syncCams();
  void doorTick;
}

// ayuda de teclas (misma idea que owner.js)
{
  const fix = root2 => { if (!root2 || G.isTouch) return; const k = root2.querySelector(".keys") || (root2.classList.contains("keys") ? root2 : null); if (!k || k.innerHTML.includes("<kbd>V</kbd>")) return; k.insertAdjacentHTML("beforeend", `<kbd>V</kbd><span>Walkie-talkie: sacar o traer gente (oficina de seguridad)</span>`); };
  const pb = $("panelBody"); new MutationObserver(() => fix(pb)).observe(pb, { childList: true });
  const tk = $("titleKeys"); if (tk) { new MutationObserver(() => { if (tk.children.length) fix(tk); }).observe(tk, { childList: true }); setTimeout(() => fix(tk), 0); }
}

window.CasinoOffice = {
  update, frame, onEndDay, actor, staffTask, onDespawn,
  get built() { return built(); }, get mon() { return mon; }, get placing() { return placing; },
  debug: { rtOf, state: () => O(), build, enterMonitor, exitMonitor, openCams, openGold, openWalkie, order, aimsAtVip, areaOk, toggleDoor, setDoorOpen, buyGold, sellGold, startCount, renderFeed, targets, guards, startPlace, openProps, rooms: () => ({ room, root }), tryCam, selCam, freshCam, syncCams },
};
lastS = null; ensure(); refreshAll();
})();
