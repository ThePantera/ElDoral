/* Casino Dorado · shop.js — TIENDA AL ESTILO TCG
 * Se carga después de upgrades.js y antes de story.js. Usa window.CasinoShopBridge (game.js) y CasinoBuild (decor.js).
 *  1) La compu del local (oficina, a la derecha de la entrada): pedidos de mercadería, máquinas, mesas y decoración.
 *     Un camión trae las cajas y las deja en la vereda. Las cajas se cargan de a una (E levanta, G suelta).
 *     Las cajas de máquinas, mesas y decoración se abren adentro y entran al modo construcción para ubicarlas.
 *  2) Góndolas: heladera (bebidas), estantería de snacks y fichas en el mostrador. Se reponen manteniendo E con la caja.
 *  3) Precios con mercado que se mueve cada día. Los clientes compran según tu precio contra el del mercado.
 *  4) Caja registradora: fila de clientes y minijuego de vuelto (minigames.js). El cajero contratado cobra solo.
 *  5) Repositor: trae cajas de la vereda y repone.
 * Estado guardado en S.shop (game.js lo copia en sanitize; acá se valida campo por campo).
 */
(() => {
"use strict";
const G = window.CasinoShopBridge, D = window.CASINO_DATA, A = window.CasinoArt, T = window.THREE;
if (!G || !D || !D.SHOP || !A || !T) return;
const C = D.SHOP;
const S = () => G.S;
const isNum = v => typeof v === "number" && Number.isFinite(v);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[(Math.random() * arr.length) | 0];
const fmt = n => G.fmt(n);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const two = n => String(n).padStart(2, "0");
const KEY = G.KEY;
const PROD = id => C.products.find(p => p.id === id);
const MACH = id => D.MACHINES.find(m => m.id === id);
const TDEF = id => D.TABLES.find(t => t.id === id);
const DECO = id => D.DECOR.find(d => d.id === id);
const BAR_DEF = D.DECOR.find(d => d.enables === "waiter");
const UPV = (k, d) => window.CasinoUp ? window.CasinoUp.v(k, d) : d;
const licOk = (kind, t) => window.CasinoUp ? window.CasinoUp.licOk(kind, t) : true;
const LIFE = () => window.CasinoLife && window.CasinoLife.debug;

// =====================================================================
// LUGARES (diseño de nivel)
// =====================================================================
const PC = { x: 5.4, z: -9.5, w: 1.2, d: 0.6, stand: { x: 5.4, z: -8.6 } };
const REG = { x: -6.3, z: -8.3, w: 1.4, d: 0.6, back: { x: -6.3, z: -9.2 }, side: { x: -5.15, z: -8.3 } };
const QSPOTS = [{ x: -6.3, z: -7.4 }, { x: -6.3, z: -6.65 }, { x: -5.5, z: -6.2 }, { x: -4.7, z: -6.2 }, { x: -3.9, z: -6.2 }, { x: -3.9, z: -7.0 }];
const FRIDGE = { x: -9.5, z: -6.9, w: 0.9, d: 0.7, pick: { x: -8.6, z: -6.9 } };
const SNACKS = { x: -9.6, z: -5.5, w: 1.3, d: 0.5, pick: { x: -8.7, z: -5.5 } };
// góndolas movibles y ampliables: cada unidad guarda su pose; la primera arranca donde estaba la original
const FURN = { heladera: { ...FRIDGE, h: 1.9, front: 0.9, rot: Math.PI / 2, ph: [0.9, 1.9, 0.75, 0.95, 0.05], pz: 0 }, snacks: { ...SNACKS, h: 1.6, front: 0.9, rot: Math.PI / 2, ph: [1.3, 1.6, 0.55, 0.8, 0.03], pz: 0 } };
const MAXU = 3; // tope de unidades por góndola (original + 2 extras)
const units = { heladera: [], snacks: [] };
// qué unidad usa cada quien: la más cercana a donde está parado
function unitFor(shelf, from) {
  const us = units[shelf]; if (!us.length) return FURN[shelf];
  if (!from || us.length === 1) return us[0];
  let best = us[0], bd = Infinity;
  for (const u of us) { const d = Math.hypot(u.pick.x - from.x, u.pick.z - from.z); if (d < bd) { bd = d; best = u; } }
  return best;
}
const shelfAt = (shelf, from) => shelf === "fichas" ? { x: REG.x, z: REG.z, pick: REG.side } : unitFor(shelf, from);
const capOf = p => p.shelf === "fichas" ? p.cap : p.cap * Math.max(1, units[p.shelf].length);
const SHELF_NAME = { heladera: "Heladera", snacks: "Estantería de snacks", fichas: "Fichas del mostrador" };
const DROP = []; for (const z of [-11.2, -12.2, -13.2]) for (let i = 0; i < 7; i++) DROP.push({ x: -3.6 - i, z });
const STAGE = []; for (const x of [3.7, 4.5]) for (const z of [-8.0, -7.3, -6.6]) STAGE.push({ x, z });
const TRUCK_Z = -18.9, TRUCK_STOP = -6.5;
// lugares que el modo construcción no deja tapar (decor.js → validate)
const RESERVED = [
  { minX: -7.2, maxX: -3.0, minZ: -9.9, maxZ: -5.8, why: "Dejá libre la caja registradora y su fila." },
  { minX: 4.6, maxX: 6.2, minZ: -9.9, maxZ: -8.0, why: "Dejá libre el escritorio de la compu." },
  { minX: 3.3, maxX: 4.9, minZ: -8.4, maxZ: -6.2, why: "Ahí el repositor deja las cajas grandes." },
];
const ACCESS = [
  { x: REG.back.x, z: REG.back.z, r: 0.6, label: "la caja registradora" }, { x: QSPOTS[0].x, z: QSPOTS[0].z, r: 0.6, label: "la fila de la caja" },
  { x: PC.stand.x, z: PC.stand.z, r: 0.6, label: "la compu" },
];
// puntos a los que tiene que poder llegar la gente (decor.js): fijos + el frente de cada góndola (menos la que estás moviendo)
const accessAll = skip => ACCESS.concat([].concat(units.heladera, units.snacks).filter(u => u !== skip).map(u => ({ x: u.pick.x, z: u.pick.z, r: 0.6, label: u.shelf === "heladera" ? "la heladera" : "los snacks" })));

// =====================================================================
// ESTADO
// =====================================================================
let lastS = null;
const nowAbs = () => S().day * 1440 + S().minutes;
const marketPrice = id => { const p = PROD(id), m = S().shop.market[id]; return Math.max(1, Math.round(p.base * (m ? m.p : 1))); };
const wholesale = id => Math.max(1, Math.round(marketPrice(id) * C.wholesale));
const priceOf = id => S().shop.price[id];
const stockOf = id => S().shop.stock[id] || 0;
const sellable = p => S().rank >= p.rank && (!p.lic || licOk("prod", p.id));
const freshFurn = () => ({ heladera: [{ x: FRIDGE.x, z: FRIDGE.z, r: Math.PI / 2 }], snacks: [{ x: SNACKS.x, z: SNACKS.z, r: Math.PI / 2 }] });
function cleanFurn(raw) {
  const f = freshFurn(); if (!raw || typeof raw !== "object") return f;
  for (const k of ["heladera", "snacks"]) {
    if (!Array.isArray(raw[k])) continue;
    const list = raw[k].filter(u => u && isNum(u.x) && isNum(u.z)).slice(0, MAXU).map(u => ({ x: Math.round(clamp(u.x, -21, 21) * 100) / 100, z: Math.round(clamp(u.z, -9.2, 9.2) * 100) / 100, r: (((Math.round((isNum(u.r) ? u.r : Math.PI / 2) / (Math.PI / 2)) % 4) + 4) % 4) * (Math.PI / 2) }));
    if (list.length) f[k] = list;
  }
  return f;
}
function freshShop(s) {
  const sh = { v: 1, stock: {}, price: {}, market: {}, mday: s.day, orders: [], boxes: [], lic: {}, up: {}, seq: 0, furn: freshFurn() };
  for (const p of C.products) { sh.stock[p.id] = C.startStock[p.id] || 0; sh.price[p.id] = p.base; sh.market[p.id] = { p: 1, h: [p.base] }; }
  return sh;
}
const KINDS = new Set(["prod", "machine", "table", "decor", "barra", "shelf"]);
function validId(k, id) { return k === "prod" ? !!PROD(id) : k === "machine" ? !!MACH(id) : k === "table" ? !!TDEF(id) : k === "decor" ? !!(DECO(id) && !DECO(id).unique) : k === "barra" ? id === "barra" : k === "shelf" ? !!(C.furn && C.furn[id]) : false; }
function validate(raw, s) {
  const sh = freshShop(s), M = C.market;
  if (!raw || typeof raw !== "object") { // partida vieja (o nueva): licencias de lo que ya tenés
    if (window.CasinoUp) for (const d of s.machines.concat(s.tables)) { const l = window.CasinoUp.licFor(MACH(d.type) ? "machine" : "table", d.type); if (l) sh.lic[l.id] = 1; }
    if (s.day <= 1 && !s.today.st.visitors) { // partida nueva: La Estrella regala una caja de gaseosas y otra de papas para estrenar el kiosco
      for (const [i, id] of [[0, "gaseosa"], [1, "papas"]]) sh.boxes.push({ u: "b" + (i + 1), k: "prod", id, q: PROD(id).box, x: DROP[i].x, z: DROP[i].z, r: 0.25 - i * 0.5 });
      sh.seq = sh.boxes.length;
    }
    return sh;
  }
  const obj = v => v && typeof v === "object";
  sh.furn = cleanFurn(raw.furn);
  for (const p of C.products) {
    if (obj(raw.stock) && isNum(raw.stock[p.id])) sh.stock[p.id] = clamp(Math.round(raw.stock[p.id]), 0, p.shelf === "fichas" ? p.cap : p.cap * sh.furn[p.shelf].length);
    if (obj(raw.price) && isNum(raw.price[p.id])) sh.price[p.id] = clamp(Math.round(raw.price[p.id]), 1, 9999);
    const m = obj(raw.market) ? raw.market[p.id] : null;
    if (obj(m) && isNum(m.p)) {
      sh.market[p.id] = { p: clamp(m.p, M.min, M.max), h: Array.isArray(m.h) ? m.h.filter(isNum).map(x => clamp(Math.round(x), 1, 99999)).slice(-M.hist) : [] };
      if (!sh.market[p.id].h.length) sh.market[p.id].h.push(Math.max(1, Math.round(p.base * sh.market[p.id].p)));
    }
  }
  sh.mday = isNum(raw.mday) ? clamp(Math.round(raw.mday), 1, s.day) : s.day;
  if (Array.isArray(raw.orders)) sh.orders = raw.orders.filter(o => obj(o) && Array.isArray(o.items) && isNum(o.eta)).slice(0, 30).map(o => ({
    eta: clamp(o.eta, 0, (s.day + 2) * 1440), sent: false,
    items: o.items.filter(it => obj(it) && KINDS.has(it.k) && validId(it.k, it.id)).slice(0, 40).map(it => ({ k: it.k, id: it.id, q: it.k === "prod" ? PROD(it.id).box : 1 })),
  })).filter(o => o.items.length);
  if (Array.isArray(raw.boxes)) sh.boxes = raw.boxes.filter(b => obj(b) && KINDS.has(b.k) && validId(b.k, b.id) && isNum(b.x) && isNum(b.z)).slice(0, 80).map(b => ({
    u: "", k: b.k, id: b.id, q: b.k === "prod" ? clamp(Math.round(isNum(b.q) ? b.q : PROD(b.id).box), 1, PROD(b.id).box) : 1,
    x: clamp(b.x, -21.6, 21.6), z: clamp(b.z, -16.5, 9.6), r: isNum(b.r) ? b.r % 7 : 0,
  }));
  sh.boxes.forEach((b, i) => { b.u = "b" + (i + 1); });
  sh.seq = sh.boxes.length;
  if (obj(raw.lic)) for (const l of D.LICENSES) if (raw.lic[l.id]) sh.lic[l.id] = 1;
  if (obj(raw.up)) for (const u of D.UPGRADES) if (raw.up[u.id]) sh.up[u.id] = 1;
  return sh;
}
// mercado: caminata al azar con vuelta a la media y algún sacudón
function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function drift() {
  const M = C.market, sh = S().shop;
  for (const p of C.products) {
    const mk = sh.market[p.id] || (sh.market[p.id] = { p: 1, h: [] });
    let m = mk.p * Math.exp(gauss() * M.sigma) + M.revert * (1 - mk.p);
    if (Math.random() < M.spikeChance) m *= Math.random() < 0.5 ? M.spikeUp : M.spikeDown;
    mk.p = Math.round(clamp(m, M.min, M.max) * 1000) / 1000;
    mk.h.push(Math.max(1, Math.round(p.base * mk.p))); if (mk.h.length > M.hist) mk.h.splice(0, mk.h.length - M.hist);
  }
}
function marketDay() { const sh = S().shop; if (sh.mday === S().day) return; const n = clamp(S().day - sh.mday, 1, 5); for (let i = 0; i < n; i++) drift(); sh.mday = S().day; dirtyTags = true; }
function trend(id) { const h = S().shop.market[id].h; if (h.length < 2) return 0; const a = h[h.length - 2], b = h[h.length - 1]; return a ? (b - a) / a : 0; }
// ¿cuánto le gusta al cliente tu precio? (1 = normal, >1 compra más, <1 menos, 0,05 = se queja)
function willing(p) {
  const mk = marketPrice(p.id) * (p.cat === "bebida" ? 1 + UPV("drinkTolAdd", 0) : 1);
  const r = priceOf(p.id) / Math.max(1, mk);
  if (r <= 0.7) return 1.4;
  if (r <= 1) return 1 + (1 - r) * 1.33;
  if (r <= C.tol.over) return 1 - (r - 1) * 2;
  if (r <= C.tol.way) return 0.7 - (r - C.tol.over) * 2.5;
  return 0.05;
}
function demandLabel(k) { return k >= 1.2 ? ["Ganga: se vende más", "in"] : k >= 0.95 ? ["Precio justo", ""] : k >= 0.5 ? ["Caro: algunos no compran", "out"] : k > 0.05 ? ["Muy caro: casi nadie compra", "out"] : ["Carísimo: se quejan y no compran", "out"]; }

// runtime (no se guarda)
let carry = null;                  // caja que lleva el jugador
let placing = null;                // caja abierta en el modo construcción
const held = new Map();            // u → "player" | npc
const claimed = new Map();         // u → npc (repositor que va a buscarla)
const meshes = new Map();          // u → { mesh, px }
const queue = [];                  // clientes en la fila de la caja
let regOp = null;                  // cajero contratado en la caja
let dirtyStock = true, dirtyTags = true, restockN = 0;

function ensure() {
  const s = S(); if (!s) return false;
  if (s === lastS) return true;
  lastS = s;
  s.shop = validate(s.shop, s);
  resetRuntime();
  return true;
}
function resetRuntime() {
  carry = null; placing = null; held.clear(); claimed.clear(); queue.length = 0; regOp = null;
  for (const [, o] of meshes) { if (o.mesh.parent) o.mesh.parent.remove(o.mesh); if (o.px) G.dropProxy(o.px); }
  meshes.clear();
  truck.state = "idle"; truck.order = null; truck.g.visible = false;
  syncFurn(); syncBoxes(); dirtyStock = true; dirtyTags = true;
}

// =====================================================================
// MODELOS (geometría fusionada con colores por vértice: pocas llamadas de dibujo)
// =====================================================================
const VC = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.05 });
const BOX1 = new T.BoxGeometry(1, 1, 1), CYL1 = new T.CylinderGeometry(0.5, 0.5, 1, 12);
const _q = new T.Quaternion(), _e = new T.Euler(), _v = new T.Vector3(), _s = new T.Vector3();
function M4(x, y, z, ry, sx, sy, sz, rx) { _e.set(rx || 0, ry || 0, 0); _q.setFromEuler(_e); return new T.Matrix4().compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz)); }
function part(list, geo, color, x, y, z, w, h, d, ry, rx) { list.push({ geo, m: M4(x, y, z, ry || 0, w, h, d, rx), color }); }
function merged(list) { return new T.Mesh(A.mergeGeometries(list, true), VC); }
function label(g, text, w, h, x, y, z, draw) {
  const tex = A.canvasTex(draw ? draw.w : 256, draw ? draw.h : 64, draw ? draw.f : (c, W, H) => { c.fillStyle = "#15171a"; c.fillRect(0, 0, W, H); c.strokeStyle = "#d9a84a"; c.lineWidth = 4; c.strokeRect(3, 3, W - 6, H - 6); c.fillStyle = "#f6c766"; c.font = "bold 34px Georgia, serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(text, W / 2, H / 2 + 2); });
  const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex })); m.position.set(x, y, z); g.add(m); return m;
}
// carteles de precio (se redibujan cuando cambia un precio)
function tagTex(w, h) { return A.canvasTex(w, h, () => {}); }
function drawTag(tex, prods, title) {
  const c = tex.userData.ctx, W = tex.image.width, H = tex.image.height;
  c.fillStyle = "#f3e9d2"; c.fillRect(0, 0, W, H); c.fillStyle = "#6e1423"; c.fillRect(0, 0, W, 30);
  c.fillStyle = "#f3e9d2"; c.font = "bold 22px Arial, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(title, W / 2, 16);
  const list = prods.filter(p => sellable(p) || stockOf(p.id) > 0);
  c.textAlign = "left"; c.font = "bold 24px Arial, sans-serif";
  const colW = W / Math.max(1, list.length);
  list.forEach((p, i) => {
    const x = i * colW + 10;
    c.fillStyle = "#07140f"; c.font = "bold 20px Arial, sans-serif"; c.fillText(p.name, x, 52, colW - 14);
    c.fillStyle = "#b8282c"; c.font = "bold 30px 'IBM Plex Mono', monospace"; c.fillText("$" + priceOf(p.id), x, 84, colW - 14);
  });
  tex.needsUpdate = true;
}
const tags = [];
function inst(geo, mat, n, parent, place) {
  const im = new T.InstancedMesh(geo, mat, n); const m = new T.Matrix4();
  for (let i = 0; i < n; i++) { place(i, m); im.setMatrixAt(i, m); }
  im.instanceMatrix.needsUpdate = true; im.count = 0; im.frustumCulled = false; parent.add(im); return im;
}
const rows = {}; // producto → InstancedMesh visible

// --- compu -------------------------------------------------------------
const pcGroup = (() => {
  const g = new T.Group(); g.position.set(PC.x, 0, PC.z); G.scene.add(g);
  const L = [], wood = 0x5a3a22, dark = 0x1a1c20;
  part(L, BOX1, wood, 0, 0.76, 0, 1.2, 0.05, 0.6);
  for (const [x, z] of [[-0.56, -0.26], [0.56, -0.26], [-0.56, 0.26]]) part(L, BOX1, 0x3b2314, x, 0.37, z, 0.05, 0.74, 0.05);
  part(L, BOX1, 0x4a2e1a, 0.4, 0.37, 0, 0.36, 0.74, 0.56);
  part(L, BOX1, 0xb8873a, 0.4, 0.55, 0.285, 0.12, 0.02, 0.02); part(L, BOX1, 0xb8873a, 0.4, 0.25, 0.285, 0.12, 0.02, 0.02);
  part(L, BOX1, dark, 0, 0.8, -0.12, 0.22, 0.02, 0.16); part(L, BOX1, dark, 0, 0.92, -0.14, 0.05, 0.24, 0.04);
  part(L, BOX1, dark, 0, 1.18, -0.13, 0.64, 0.42, 0.05);
  part(L, BOX1, 0x2a2c30, 0, 0.795, 0.1, 0.46, 0.02, 0.15); part(L, BOX1, 0x2a2c30, 0.33, 0.792, 0.12, 0.06, 0.02, 0.09);
  part(L, BOX1, 0x23252a, -0.42, 0.24, 0.02, 0.2, 0.44, 0.46);
  // silla
  { const cx = -1.0, cz = 0.05, cr = 0.5; // corrida al costado del escritorio: no tapa la pantalla ni el paso
    const at = (lx, lz) => [cx + lx * Math.cos(cr) + lz * Math.sin(cr), cz - lx * Math.sin(cr) + lz * Math.cos(cr)];
    let q = at(0, 0); part(L, BOX1, 0x6e1423, q[0], 0.48, q[1], 0.46, 0.07, 0.44, cr);
    q = at(0, 0.22); part(L, BOX1, 0x6e1423, q[0], 0.8, q[1], 0.46, 0.55, 0.06, cr);
    q = at(0, 0); part(L, CYL1, 0x2a2a2a, q[0], 0.24, q[1], 0.05, 0.46, 0.05); part(L, BOX1, 0x2a2a2a, q[0], 0.03, q[1], 0.5, 0.04, 0.06, cr); part(L, BOX1, 0x2a2a2a, q[0], 0.03, q[1], 0.06, 0.04, 0.5, cr); }
  // lámpara de escritorio
  part(L, CYL1, 0xb8873a, -0.42, 0.8, -0.18, 0.12, 0.03, 0.12); part(L, CYL1, 0xb8873a, -0.42, 0.98, -0.18, 0.02, 0.34, 0.02); part(L, CYL1, 0x1d5a3a, -0.42, 1.15, -0.1, 0.14, 0.1, 0.14);
  g.add(merged(L));
  label(g, "", 0.58, 0.36, 0, 1.18, -0.104, { w: 256, h: 160, f: (c, W, H) => {
    const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#0f3a5a"); gr.addColorStop(1, "#07182a"); c.fillStyle = gr; c.fillRect(0, 0, W, H);
    c.fillStyle = "#d9a84a"; c.fillRect(0, 0, W, 26); c.fillStyle = "#07140f"; c.font = "bold 17px Arial, sans-serif"; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText("LA ESTRELLA · mayorista", 10, 14);
    c.fillStyle = "#f3e9d2"; c.font = "bold 22px Arial, sans-serif"; c.fillText("TIENDA ONLINE", 14, 52);
    for (let i = 0; i < 3; i++) { c.fillStyle = ["#c8323a", "#2f7a3a", "#f0c24a"][i]; c.fillRect(14 + i * 80, 74, 68, 46); c.fillStyle = "#f3e9d2"; c.font = "bold 13px Arial"; c.fillText(["MÁQUINAS", "BEBIDAS", "SNACKS"][i], 18 + i * 80, 132); }
  } });
  A.addBlob(g, 1.5, 0.9);
  G.boxAt(PC.x, PC.z, PC.w, PC.d, "shop");
  return g;
})();

// --- caja registradora y fichas ------------------------------------------
const regGroup = (() => {
  const g = new T.Group(); g.position.set(REG.x, 0, REG.z); G.scene.add(g);
  const L = [];
  part(L, BOX1, 0x3b2314, 0, 0.5, 0, 1.4, 1.0, 0.6); part(L, BOX1, 0xd8cfc0, 0, 1.025, 0, 1.46, 0.05, 0.66);
  part(L, BOX1, 0xb8873a, 0, 0.86, 0.305, 1.32, 0.05, 0.02); part(L, BOX1, 0xb8873a, 0, 0.12, 0.305, 1.32, 0.05, 0.02);
  part(L, BOX1, 0x6e1423, 0, 0.5, 0.305, 1.2, 0.56, 0.015);
  // registradora
  part(L, BOX1, 0x2a2c30, 0.3, 1.11, -0.06, 0.42, 0.12, 0.36); part(L, BOX1, 0x3a3c40, 0.3, 1.2, 0.04, 0.3, 0.06, 0.16, 0, -0.35);
  part(L, BOX1, 0x2a2c30, 0.3, 1.28, -0.16, 0.08, 0.16, 0.06); part(L, BOX1, 0x101214, 0.3, 1.39, -0.16, 0.26, 0.12, 0.04);
  // bandeja de fichas
  part(L, BOX1, 0x1d5a3a, -0.36, 1.06, 0.02, 0.52, 0.03, 0.36); part(L, BOX1, 0xb8873a, -0.36, 1.072, 0.2, 0.52, 0.02, 0.02);
  g.add(merged(L));
  label(g, "", 0.24, 0.1, 0.3, 1.39, -0.137, { w: 128, h: 48, f: (c, W, H) => { c.fillStyle = "#0b1a10"; c.fillRect(0, 0, W, H); c.fillStyle = "#6fd39b"; c.font = "bold 28px monospace"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("CAJA", W / 2, H / 2 + 2); } });
  const chip = new T.CylinderGeometry(0.038, 0.038, 0.11, 12);
  rows.fichas = inst(chip, A.std(0xd4423f, 0.45, 0.05), 10, g, (i, m) => m.makeTranslation(-0.56 + (i % 5) * 0.1, 1.13, -0.06 + ((i / 5) | 0) * 0.13));
  const tex = tagTex(256, 100); tags.push({ tex, shelf: "fichas", title: "FICHAS" });
  const tag = new T.Mesh(new T.PlaneGeometry(0.34, 0.13), new T.MeshBasicMaterial({ map: tex })); tag.position.set(-0.36, 1.18, 0.29); g.add(tag);
  const tag2 = tag.clone(); tag2.rotation.y = Math.PI; tag2.position.z = -0.29; g.add(tag2);
  A.addBlob(g, 1.7, 0.9);
  G.boxAt(REG.x, REG.z, REG.w, REG.d, "shop");
  return g;
})();

// --- heladera (frente hacia +x) ------------------------------------------
function makeFridge(ghost) {
  const g = new T.Group(); const R = {};
  const L = [], white = 0xe8e8e4, chrome = 0xb9bec6;
  part(L, BOX1, white, 0, 0.95, -0.33, 0.9, 1.9, 0.04); part(L, BOX1, 0x1a2228, 0, 0.95, -0.305, 0.84, 1.7, 0.01);
  part(L, BOX1, white, -0.43, 0.95, 0, 0.04, 1.9, 0.7); part(L, BOX1, white, 0.43, 0.95, 0, 0.04, 1.9, 0.7);
  part(L, BOX1, 0xc8202a, 0, 1.86, 0, 0.9, 0.08, 0.7); part(L, BOX1, white, 0, 0.06, 0, 0.9, 0.12, 0.7);
  for (const y of [0.5, 0.95, 1.4]) part(L, BOX1, chrome, 0, y, 0, 0.82, 0.02, 0.62);
  part(L, BOX1, chrome, -0.42, 0.95, 0.34, 0.03, 1.68, 0.03); part(L, BOX1, chrome, 0.42, 0.95, 0.34, 0.03, 1.68, 0.03);
  part(L, BOX1, chrome, 0, 1.79, 0.34, 0.86, 0.03, 0.03); part(L, BOX1, chrome, 0, 0.12, 0.34, 0.86, 0.03, 0.03);
  part(L, BOX1, 0x8a8f96, 0.36, 0.95, 0.37, 0.025, 0.5, 0.03);
  g.add(merged(L));
  const glow = new T.Mesh(new T.PlaneGeometry(0.8, 0.03), A.basic(0xdff4ff)); glow.position.set(0, 1.76, 0.1); glow.rotation.x = Math.PI / 2; g.add(glow);
  const glass = new T.Mesh(new T.PlaneGeometry(0.84, 1.66), new T.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.16, roughness: 0.1, metalness: 0.3, depthWrite: false }));
  glass.position.set(0, 0.95, 0.352); glass.renderOrder = 3; g.add(glass);
  label(g, "BEBIDAS", 0.8, 0.07, 0, 1.86, 0.352, { w: 256, h: 24, f: (c, W, H) => { c.fillStyle = "#c8202a"; c.fillRect(0, 0, W, H); c.fillStyle = "#fff"; c.font = "bold 20px Arial"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("BEBIDAS FRÍAS", W / 2, H / 2 + 1); } });
  const can = new T.CylinderGeometry(0.032, 0.032, 0.12, 10), beer = new T.CylinderGeometry(0.026, 0.032, 0.22, 8), cava = new T.CylinderGeometry(0.03, 0.042, 0.3, 8);
  const grid = (cols, y, h) => (i, m) => m.makeTranslation(-0.35 + (i % cols) * (0.7 / (cols - 1)), y + h / 2, 0.1 - ((i / cols) | 0) * 0.17);
  if (!ghost) {
    R.gaseosa = inst(can, A.std(0xc8202a, 0.35, 0.3), PROD("gaseosa").cap, g, grid(8, 0.96, 0.12));
    R.cerveza = inst(beer, A.std(0x2f7a3a, 0.2, 0.1), PROD("cerveza").cap, g, grid(8, 1.41, 0.22));
    R.espumante = inst(cava, A.std(0xe8d58a, 0.25, 0.5), PROD("espumante").cap, g, grid(6, 0.51, 0.3));
    const tex = tagTex(384, 100); tags.push({ tex, shelf: "heladera", title: "HELADERA" });
    const tag = new T.Mesh(new T.PlaneGeometry(0.84, 0.22), new T.MeshBasicMaterial({ map: tex })); tag.position.set(0, 2.02, 0.2); g.add(tag);
    A.addBlob(g, 1.1, 0.9);
  }
  return { g, R };
}

// --- estantería de snacks (frente hacia +x) --------------------------------
function makeSnacks(ghost) {
  const g = new T.Group(); const R = {};
  const L = [], wood = 0x6a4a2a;
  part(L, BOX1, wood, -0.63, 0.8, 0, 0.04, 1.6, 0.5); part(L, BOX1, wood, 0.63, 0.8, 0, 0.04, 1.6, 0.5);
  part(L, BOX1, 0x4a2e1a, 0, 0.8, -0.235, 1.3, 1.6, 0.03);
  for (const y of [0.1, 0.55, 1.0, 1.45]) part(L, BOX1, wood, 0, y, 0, 1.26, 0.03, 0.48);
  for (const y of [0.1, 0.55, 1.0]) part(L, BOX1, 0xb8873a, 0, y + 0.03, 0.245, 1.26, 0.05, 0.01);
  g.add(merged(L));
  label(g, "SNACKS", 1.0, 0.16, 0, 1.56, -0.2, { w: 256, h: 40, f: (c, W, H) => { c.fillStyle = "#f0c24a"; c.fillRect(0, 0, W, H); c.fillStyle = "#6e1423"; c.font = "bold 30px Georgia, serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("SNACKS", W / 2, H / 2 + 2); } });
  const bag = new T.BoxGeometry(0.12, 0.2, 0.05), alf = new T.BoxGeometry(0.11, 0.035, 0.11), cig = new T.BoxGeometry(0.15, 0.04, 0.09);
  const gridS = (cols, y, dy) => (i, m) => m.makeTranslation(-0.52 + (i % cols) * (1.04 / (cols - 1)), y + dy, 0.12 - ((i / cols) | 0) * 0.17);
  if (!ghost) {
  R.papas = inst(bag, A.std(0xf0c24a, 0.6), PROD("papas").cap, g, gridS(8, 1.015, 0.1));
  R.alfajor = inst(alf, A.std(0x6a3a1a, 0.5), PROD("alfajor").cap, g, (i, m) => m.makeTranslation(-0.52 + (i % 4) * 0.13, 0.585 + ((i / 8) | 0) * 0.04, 0.12 - (((i / 4) | 0) % 2) * 0.17));
  R.habano = inst(cig, A.std(0x7a4a24, 0.45, 0.1), PROD("habano").cap, g, (i, m) => m.makeTranslation(0.12 + (i % 4) * 0.13, 0.135 + ((i / 8) | 0) * 0.045, 0.12 - (((i / 4) | 0) % 2) * 0.17));
  const tex = tagTex(384, 100); tags.push({ tex, shelf: "snacks", title: "SNACKS" });
  const tag = new T.Mesh(new T.PlaneGeometry(0.9, 0.23), new T.MeshBasicMaterial({ map: tex })); tag.position.set(0, 1.75, -0.2); g.add(tag);
  A.addBlob(g, 1.5, 0.7);
  }
  return { g, R };
}
function placeUnit(u, x, z, rot) {
  const F = FURN[u.shelf], fx = Math.sin(rot), fz = Math.cos(rot);
  u.x = x; u.z = z; u.rot = rot; u.g.position.set(x, 0, z); u.g.rotation.y = rot;
  u.pick = { x: x + fx * F.front, z: z + fz * F.front };
  const alongX = Math.abs(fx) > 0.5;
  if (u.col) G.removeCollider(u.col);
  u.col = G.boxAt(x, z, alongX ? F.d : F.w, alongX ? F.w : F.d, "shop");
}
function addUnit(shelf, x, z, rot) {
  const t0 = tags.length, b = (shelf === "heladera" ? makeFridge : makeSnacks)(false); G.scene.add(b.g);
  const u = { shelf, g: b.g, R: b.R, x, z, rot, pick: { x, z }, col: null, px: null };
  for (let i = t0; i < tags.length; i++) tags[i].u = u;
  placeUnit(u, x, z, rot);
  const [w, h, d, y, pz] = FURN[shelf].ph;
  u.px = G.proxy(u.g, w, h, d, shelfInteract(shelf, u), y, 0, pz);
  units[shelf].push(u); dirtyStock = true;
  return u;
}
function removeUnit(u) {
  const list = units[u.shelf], i = list.indexOf(u); if (i >= 0) list.splice(i, 1);
  if (u.col) G.removeCollider(u.col);
  if (u.px) G.dropProxy(u.px);
  if (u.g.parent) u.g.parent.remove(u.g);
  const k = tags.findIndex(t => t.u === u); if (k >= 0) tags.splice(k, 1);
}
// deja las unidades en escena como dice S.shop.furn (al cargar una partida o arrancar)
function syncFurn() {
  const sh = S() && S().shop; if (!sh) return;
  for (const shelf of ["heladera", "snacks"]) {
    const want = sh.furn[shelf], have = units[shelf];
    while (have.length > want.length) removeUnit(have[have.length - 1]);
    want.forEach((w, i) => { if (have[i]) placeUnit(have[i], w.x, w.z, w.r); else addUnit(shelf, w.x, w.z, w.r); });
  }
  dirtyStock = true; dirtyTags = true;
}
function saveFurn() {
  const sh = S() && S().shop; if (!sh) return;
  for (const shelf of ["heladera", "snacks"]) sh.furn[shelf] = units[shelf].map(u => ({ x: Math.round(u.x * 100) / 100, z: Math.round(u.z * 100) / 100, r: u.rot }));
}
function refreshStock() {
  dirtyStock = false;
  for (const p of C.products) {
    const n = stockOf(p.id);
    if (p.shelf === "fichas") { if (rows.fichas) rows.fichas.count = Math.min(10, Math.ceil(n / 6)); continue; }
    let left = n; // las unidades se llenan en orden
    for (const u of units[p.shelf]) { const im = u.R[p.id]; if (!im) continue; im.count = Math.min(left, p.cap); left -= im.count; }
  }
}
function refreshTags() {
  dirtyTags = false;
  for (const t of tags) drawTag(t.tex, C.products.filter(p => p.shelf === t.shelf), t.title);
}

// --- cajas de cartón ---------------------------------------------------------
const SZ = { prod: [0.55, 0.38, 0.42], machine: [0.95, 1.5, 0.8], table: [1.4, 0.7, 1.0], decor: [0.75, 0.75, 0.75], barra: [1.6, 0.85, 0.7], shelf: [0.9, 1.1, 0.7] };
const TAGS = { fichas: ["FICHAS", "#d4423f"], bebida: ["BEBIDAS", "#2a6fd6"], snack: ["SNACKS", "#e0a030"], machine: ["MÁQUINA", "#7a3ab0"], table: ["MESA", "#1d8a4e"], decor: ["DECO", "#c8577a"], barra: ["BARRA", "#3b2314"], shelf: ["GÓNDOLA", "#8a5a2a"] };
const boxMats = {};
function tagOf(b) { return b.k === "prod" ? PROD(b.id).cat : b.k; }
function boxMat(tag) {
  if (boxMats[tag]) return boxMats[tag];
  const [txt, col] = TAGS[tag] || ["CAJA", "#555"];
  const tex = A.canvasTex(128, 128, (c, W, H) => {
    c.fillStyle = "#b8874f"; c.fillRect(0, 0, W, H);
    c.fillStyle = "rgba(90,60,30,.25)"; for (let i = 0; i < 220; i++) c.fillRect(Math.random() * W, Math.random() * H, 2, 1);
    c.fillStyle = "#d9c08a"; c.fillRect(0, 54, W, 20);
    c.fillStyle = col; c.fillRect(14, 16, W - 28, 30);
    c.fillStyle = "#fff"; c.font = "bold 19px Arial, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(txt, W / 2, 32);
    c.strokeStyle = "#5a3a1a"; c.lineWidth = 2; c.beginPath(); c.moveTo(W / 2 - 14, 100); c.lineTo(W / 2, 86); c.lineTo(W / 2 + 14, 100); c.stroke(); c.beginPath(); c.moveTo(W / 2, 86); c.lineTo(W / 2, 114); c.stroke();
  });
  return (boxMats[tag] = new T.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
}
const sizeOf = b => SZ[b.k] || SZ.prod;
function defOf(k, id) { return k === "prod" ? PROD(id) : k === "machine" ? MACH(id) : k === "table" ? TDEF(id) : k === "decor" ? DECO(id) : k === "barra" ? BAR_DEF : k === "shelf" ? furnDef(id) : null; }
function furnDef(id) { const f = C.furn && C.furn[id]; return f ? { id, name: f.name, price: f.price, rank: f.rank, color: f.color, max: f.max || MAXU } : null; }
function boxLabel(b) { const d = defOf(b.k, b.id); if (!d) return "Caja"; return b.k === "prod" ? `${d.name} ×${b.q}` : d.name; }
const isBig = b => b.k !== "prod";
function boxInteract(b) {
  return {
    prompt: () => ({ text: `Levantar caja: ${boxLabel(b)}`, sub: isBig(b) ? "Pesada: caminás más lento · adentro la abrís y elegís dónde va" : b.k === "prod" ? `Llevala a ${SHELF_NAME[PROD(b.id).shelf].toLowerCase()} y mantené ${KEY} para reponer` : "" }),
    hold: () => 0, usable: () => !carry && !held.has(b.u),
    use: () => pickUp(b),
  };
}
function syncBoxes() {
  const sh = S() && S().shop; if (!sh) return;
  const want = new Set(sh.boxes.map(b => b.u));
  for (const [u, o] of meshes) if (!want.has(u)) { if (o.mesh.parent) o.mesh.parent.remove(o.mesh); if (o.px) G.dropProxy(o.px); meshes.delete(u); }
  for (const b of sh.boxes) {
    let o = meshes.get(b.u);
    if (!o) {
      const sz = sizeOf(b), mesh = new T.Mesh(BOX1, boxMat(tagOf(b)));
      mesh.scale.set(sz[0], sz[1], sz[2]);
      o = { mesh, px: null }; meshes.set(b.u, o);
    }
    if (!held.has(b.u)) groundBox(b, o);
  }
}
function groundBox(b, o) {
  o = o || meshes.get(b.u); if (!o) return;
  const sz = sizeOf(b);
  if (o.mesh.parent !== G.scene) { if (o.mesh.parent) o.mesh.parent.remove(o.mesh); G.scene.add(o.mesh); }
  o.mesh.scale.set(sz[0], sz[1], sz[2]); o.mesh.position.set(b.x, sz[1] / 2, b.z); o.mesh.rotation.set(0, b.r || 0, 0);
  if (!o.px) o.px = G.proxy(o.mesh, 1, 1, 1, boxInteract(b), 0, 0, 0);
}
function liftBox(b, parent, x, y, z, k) {
  const o = meshes.get(b.u); if (!o) return;
  if (o.px) { G.dropProxy(o.px); o.px = null; }
  if (o.mesh.parent) o.mesh.parent.remove(o.mesh);
  const sz = sizeOf(b); parent.add(o.mesh); o.mesh.position.set(x, y, z); o.mesh.rotation.set(0, 0, 0); o.mesh.scale.set(sz[0] * k, sz[1] * k, sz[2] * k);
}
function newBox(k, id, x, z) {
  const sh = S().shop;
  const b = { u: "b" + (++sh.seq), k, id, q: k === "prod" ? PROD(id).box : 1, x, z, r: rnd(-0.4, 0.4) };
  sh.boxes.push(b); syncBoxes(); return b;
}
function removeBox(b) {
  const sh = S().shop, i = sh.boxes.indexOf(b); if (i >= 0) sh.boxes.splice(i, 1);
  held.delete(b.u); claimed.delete(b.u);
  if (carry === b) { carry = null; }
  syncBoxes();
}
function freeDrop() {
  const boxes = S().shop.boxes;
  for (const p of DROP) if (!boxes.some(b => !held.has(b.u) && Math.hypot(b.x - p.x, b.z - p.z) < 0.6)) return { x: p.x, z: p.z };
  return { x: rnd(-9.5, -3.5), z: rnd(-13.5, -11) };
}

// --- camión ------------------------------------------------------------------
const truck = (() => {
  const g = new T.Group(); g.position.set(-48, 0, TRUCK_Z); g.visible = false; G.scene.add(g);
  const L = [];
  part(L, BOX1, 0xb8282c, 2.75, 1.25, 0, 1.9, 1.9, 2.2); part(L, BOX1, 0x1a2a40, 3.71, 1.65, 0, 0.02, 0.7, 1.9);
  part(L, BOX1, 0x1a2a40, 2.75, 1.65, 1.105, 1.2, 0.6, 0.02); part(L, BOX1, 0x1a2a40, 2.75, 1.65, -1.105, 1.2, 0.6, 0.02);
  part(L, BOX1, 0x2a2a2a, 2.75, 0.45, 0, 2.0, 0.3, 2.25); part(L, BOX1, 0xe8e8e4, -0.7, 1.75, 0, 4.6, 2.7, 2.3);
  part(L, BOX1, 0x2a2a2a, -0.7, 0.32, 0, 4.6, 0.25, 2.1); part(L, BOX1, 0xffe08a, 3.72, 0.85, 0.75, 0.03, 0.18, 0.3); part(L, BOX1, 0xffe08a, 3.72, 0.85, -0.75, 0.03, 0.18, 0.3);
  part(L, BOX1, 0xb8b8b8, 3.75, 0.55, 0, 0.1, 0.25, 2.1);
  g.add(merged(L));
  const side = A.canvasTex(512, 256, (c, W, H) => {
    c.fillStyle = "#e8e8e4"; c.fillRect(0, 0, W, H); c.fillStyle = "#b8282c"; c.fillRect(0, H - 50, W, 36);
    c.fillStyle = "#d9a84a"; c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 22 : 54, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(90 + Math.cos(a) * r, 100 + Math.sin(a) * r); } c.closePath(); c.fill();
    c.fillStyle = "#6e1423"; c.font = "bold 62px Georgia, serif"; c.textBaseline = "middle"; c.fillText("La Estrella", 160, 86);
    c.fillStyle = "#15171a"; c.font = "bold 26px Arial, sans-serif"; c.fillText("Distribuidora mayorista", 164, 140);
  });
  const sm = new T.MeshBasicMaterial({ map: side });
  for (const s of [1, -1]) { const p = new T.Mesh(new T.PlaneGeometry(4.4, 2.2), sm); p.position.set(-0.7, 1.8, s * 1.16); if (s < 0) p.rotation.y = Math.PI; g.add(p); }
  const wheel = new T.CylinderGeometry(0.45, 0.45, 0.3, 14), wm = A.std(0x15171a, 0.8), wheels = [];
  for (const [x, z] of [[2.6, 1.05], [2.6, -1.05], [-1.9, 1.05], [-1.9, -1.05], [-0.9, 1.05], [-0.9, -1.05]]) { const w = new T.Mesh(wheel, wm); w.rotation.x = Math.PI / 2; w.position.set(x, 0.45, z); g.add(w); wheels.push(w); }
  return { g, wheels, state: "idle", x: -48, t: 0, order: null, v: 0 };
})();
function dueOrder() { const now = nowAbs(); return S().shop.orders.find(o => !o.sent && o.eta <= now) || null; }
function unload(o) {
  const sh = S().shop, i = sh.orders.indexOf(o); if (i >= 0) sh.orders.splice(i, 1);
  for (const it of o.items) { const p = freeDrop(); newBox(it.k, it.id, p.x, p.z); }
  G.toast(`Llegó el camión de La Estrella: ${o.items.length} caja${o.items.length > 1 ? "s" : ""} en la vereda de la entrada.`, "good");
  G.hint("shopTruck", `Las cajas quedan en la vereda. Mirá una y ${KEY} para levantarla (de a una). G la suelta.`);
}
function truckUpdate(dt) {
  const tk = truck;
  if (tk.state === "idle") {
    const o = dueOrder(); if (!o) return;
    o.sent = true; tk.order = o; tk.state = "in"; tk.x = -48; tk.g.visible = true; tk.v = 14;
  } else if (tk.state === "in") {
    tk.v = clamp((TRUCK_STOP - tk.x) * 0.9, 2.2, 14); tk.x += tk.v * dt;
    if (tk.x >= TRUCK_STOP - 0.02) { tk.x = TRUCK_STOP; tk.state = "unload"; tk.t = 2.5; G.sfx("truck", tk.x, TRUCK_Z); if (tk.order) unload(tk.order); tk.order = null; tk.v = 0; }
  } else if (tk.state === "unload") {
    tk.t -= dt; if (tk.t <= 0) { tk.state = "out"; tk.v = 1; }
  } else if (tk.state === "out") {
    tk.v = Math.min(15, tk.v + dt * 5); tk.x += tk.v * dt;
    if (tk.x > 48) { tk.state = "idle"; tk.g.visible = false; }
  }
  tk.g.position.x = tk.x;
  for (const w of tk.wheels) w.rotation.y += tk.v * dt / 0.45;
}
function deliverAllNow() {
  const sh = S().shop; if (!sh.orders.length) return 0;
  let n = 0; for (const o of sh.orders.slice()) { n += o.items.length; unload(o); }
  truck.state = "idle"; truck.order = null; truck.g.visible = false;
  return n;
}

// =====================================================================
// CARGAR CAJAS (jugador)
// =====================================================================
const inside = () => G.player.z > -10;
function pickUp(b) {
  if (carry || held.has(b.u) || placing) return;
  carry = b; held.set(b.u, "player"); claimed.delete(b.u);
  showCarried();
  G.sfx("box_pick", b.x, b.z);
  if (isBig(b)) G.hint("shopBig", `Llevás una caja grande. Adentro del local, ${KEY} la abre y elegís dónde va (fantasma verde). También podés soltarla en un cuadro dorado.`);
  else G.hint("shopSmall", `Llevás ${boxLabel(b)}. Mirá ${SHELF_NAME[PROD(b.id).shelf].toLowerCase()} y mantené ${KEY} para reponer.`);
}
function showCarried() {
  if (!carry) return;
  const big = isBig(carry);
  liftBox(carry, G.camera, big ? 0.05 : 0.02, big ? -0.62 : -0.42, big ? -1.15 : -0.72, big ? 0.55 : 0.85);
}
function dropCarried() {
  if (!carry || placing) return false;
  const b = carry, P = G.player;
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
  let x = P.x + fx * 0.95, z = P.z + fz * 0.95;
  if (inside()) { x = clamp(x, -21.4, 21.4); z = clamp(z, -9.55, 9.55); } else { x = clamp(x, -30, 30); z = clamp(z, -16.5, -10.45); }
  b.x = Math.round(x * 100) / 100; b.z = Math.round(z * 100) / 100; b.r = P.yaw;
  held.delete(b.u); carry = null; groundBox(b);
  G.sfx("box_drop", b.x, b.z);
  return true;
}
function speedMul() { return carry ? 1 - (C.slow[carry.k] != null ? C.slow[carry.k] : C.slow.prod) : 1; }
// abrir una caja grande adentro: modo construcción con el objeto ya pagado
function openCarried() {
  const b = carry; if (!b || placing) return;
  if (b.k === "barra") { if (G.installBar()) { removeBox(b); G.sfx("tape"); Rank().add(4); } return; }
  const B = window.CasinoBuild; if (!B || !B.startPrepaid) { G.toast("No se puede abrir la caja ahora.", "bad"); return; }
  const kind = b.k;
  placing = b;
  const ok = B.startPrepaid(kind, b.id, {
    onPlaced: () => { placing = null; removeBox(b); G.sfx("tape"); },
    onCancel: () => { placing = null; const o = meshes.get(b.u); if (o) o.mesh.visible = true; if (carry === b) showCarried(); },
  });
  if (!ok) { placing = null; return; }
  const o = meshes.get(b.u); if (o) o.mesh.visible = false;
  G.hint("shopOpen", "Abriste la caja: elegí dónde va con el fantasma verde (E pone, R gira, Q cancela y la caja vuelve a tus manos).");
}
const Rank = () => G.Rank;
// en un cuadro dorado (decor.js → hookMarkers)
const markerKind = { slot: "machine", tspot: "table", dspot: "decor" };
function markerAccept(s) { const k = markerKind[s.kind]; return !!(carry && !placing && carry.k === k && (k !== "decor" || !(window.CasinoBuild && window.CasinoBuild.FP[carry.id] && window.CasinoBuild.FP[carry.id].mount))); }
function markerPrompt(s) {
  const k = markerKind[s.kind];
  if (markerAccept(s)) return { text: `Abrir la caja e instalar acá: ${boxLabel(carry)}`, sub: "Queda mirando al pasillo · en el modo construcción (B) la podés mover" };
  const what = k === "machine" ? "una tragamonedas" : k === "table" ? "una mesa" : "decoración";
  return { text: `Lugar libre para ${what}`, sub: `Pedila en la compu (oficina, a la derecha de la entrada) y traé la caja acá` };
}
function markerUse(s) {
  if (!markerAccept(s)) { G.toast("Las máquinas, mesas y decoración se piden en la compu de la oficina (a la derecha de la entrada).", ""); return; }
  const b = carry, k = markerKind[s.kind], B = window.CasinoBuild;
  if (!B || !B.placePrepaid) return;
  const pose = { x: s.x, z: s.z, rot: k === "decor" ? 0 : Math.PI };
  if (B.placePrepaid(k, b.id, pose, true, { onPlaced: () => removeBox(b) })) G.sfx("tape");
}
// lugar de la barra (game.js)
function barPrompt() {
  if (carry && carry.k === "barra") return { text: "Abrir la caja e instalar la Barra de tragos", sub: "Habilita tragos y camareros" };
  return { text: `Lugar para la ${BAR_DEF.name}`, sub: `Pedila en la compu (${fmt(BAR_DEF.price)} · rango ${BAR_DEF.rank})` };
}
function barUse() { if (carry && carry.k === "barra") openCarried(); else G.toast("La barra se pide en la compu de la oficina. Llega en una caja.", ""); }

// lo que hace E mientras llevás una caja y no mirás algo que la reciba
const OV = {
  open: { prompt: () => ({ text: `Abrir la caja y ubicar: ${carry ? boxLabel(carry) : ""}`, sub: "Elegís el lugar con el fantasma verde · G suelta la caja" }), hold: () => 0, usable: () => true, use: () => openCarried() },
  bar: { prompt: () => ({ text: "Abrir la caja e instalar la Barra de tragos", sub: "Va en su lugar fijo, a la derecha de la entrada · G suelta la caja" }), hold: () => 0, usable: () => true, use: () => openCarried() },
  drop: { prompt: () => ({ text: `Soltar: ${carry ? boxLabel(carry) : ""}`, sub: carry && carry.k === "prod" ? `Para reponer, mirá ${SHELF_NAME[PROD(carry.id).shelf].toLowerCase()} y mantené ${KEY}` : isBig(carry || {}) ? "Entrá al local para abrirla" : "" }), hold: () => 0, usable: () => true, use: () => dropCarried() },
};
function override(t) {
  if (!carry || placing) return null;
  if (t && t.shopAccept && t.shopAccept(carry)) return null;
  const k = carry.k;
  if (k === "machine" || k === "table" || k === "decor" || k === "shelf") return inside() ? OV.open : OV.drop;
  if (k === "barra") return inside() ? OV.bar : OV.drop;
  return OV.drop;
}

// =====================================================================
// GÓNDOLAS: reponer
// =====================================================================
function restockOne(b, who) {
  const p = PROD(b.id); if (!p || b.q <= 0) return false;
  const sh = S().shop; if (stockOf(p.id) >= capOf(p)) return false;
  sh.stock[p.id] = stockOf(p.id) + 1; b.q--; dirtyStock = true;
  if (who === "player") {
    S().today.st.restocked++; restockN++;
    if (restockN % C.xp.restockEvery === 0) G.Rank.add(3);
    G.checkObjectives();
  }
  const sp = shelfAt(p.shelf, who === "player" ? G.player : who).pick; G.sfx("restock", sp.x, sp.z);
  if (b.q <= 0) {
    removeBox(b);
    if (who === "player") G.toast("Caja vacía: la desarmaste y la tiraste.", "");
  }
  return true;
}
function shelfInteract(shelf, unit) {
  const acc = b => !!b && b.k === "prod" && PROD(b.id).shelf === shelf;
  return {
    shopAccept: acc,
    prompt() {
      if (acc(carry)) {
        const p = PROD(carry.id), n = stockOf(p.id), cp = capOf(p);
        return n >= cp ? { text: `${SHELF_NAME[shelf]}: ${p.name} lleno (${n}/${cp})`, sub: "Soltá la caja (G) y volvé cuando se venda" } : { text: `Reponer ${p.name} · ${n}/${cp}`, sub: `Mantené ${KEY} · quedan ${carry.q} en la caja` };
      }
      const list = C.products.filter(p => p.shelf === shelf && (sellable(p) || stockOf(p.id) > 0)).map(p => `${p.name} ${stockOf(p.id)}/${capOf(p)} · ${fmt(priceOf(p.id))}`);
      return { text: SHELF_NAME[shelf] + (unit && units[shelf].length > 1 ? ` (${units[shelf].indexOf(unit) + 1} de ${units[shelf].length})` : ""), sub: list.join(" · ") || "Sin productos" };
    },
    hold: () => acc(carry) ? 0.18 : 0, repeat: true,
    usable: () => acc(carry) && stockOf(carry.id) < capOf(PROD(carry.id)),
    use: () => { if (carry && acc(carry)) restockOne(carry, "player"); },
    options: () => openPrices(shelf), optLabel: "Precios",
  };
}
for (const shelf of ["heladera", "snacks"]) addUnit(shelf, FURN[shelf].x, FURN[shelf].z, FURN[shelf].rot);
G.proxy(regGroup, 0.56, 0.32, 0.42, shelfInteract("fichas"), 1.15, -0.36, 0.02);

// =====================================================================
// CLIENTES: fichas al entrar, pausas para tomar o comer, fila de la caja
// =====================================================================
const st = () => S().today.st;
function addMood(c, d) { const L = D.LIFE.mood; c.lifeMood = clamp((c.lifeMood || 0) + d, L.min, L.max); }
function emote(c, id, sec) { const L = LIFE(); if (L && L.emote) L.emote(c, id, sec); }
function say(c, text, bad) { const L = LIFE(); if (L && L.say) L.say(c, text, bad ? { tone: "bad" } : {}); }
function complain(c, text, mood, rep, stat) {
  addMood(c, mood); if (rep) G.Rep.change(rep);
  st().complaints++; if (stat) st()[stat]++;
  emote(c, "angry", 2.5); say(c, text, true);
}
function restoreIcon(c) { if (!c.person) return; G.setBar(c.person, null); G.setIcon(c.person, c.drink && (c.drink.state === "want" || c.drink.state === "claimed") ? "drink" : c.type.needsGreet ? "star" : null); }
function onSpawn(c) {
  if (c.thief || !c.type || c.kind !== "customer") return;
  c.shopPlan = { chips: Math.random() < (C.chipsChance[c.type.id] || 0), breakAt: Math.random() < C.breakChance ? Math.max(1, Math.round(c.rounds * rnd(0.35, 0.7))) : -1 };
}
function priceCheck(c, p) {
  const k = willing(p);
  if (k <= 0.05) { complain(c, pick([`¿${fmt(priceOf(p.id))} ${p.name.toLowerCase()}? ¡Qué robo!`, "¡Están locos con esos precios!", "Ni loco pago eso."]), C.mood.complain, C.rep.complain, "lostSales"); return 0; }
  if (k < 1 && Math.random() > k) { if (Math.random() < 0.5) say(c, "Uh, qué caro…"); st().lostSales++; return 0; }
  return k > 1.2 && Math.random() < 0.3 ? 2 : 1;
}
function chooseProduct(c) {
  const cats = Object.keys(C.catWeights);
  const avail = cat => C.products.filter(p => p.cat === cat && (sellable(p) || stockOf(p.id) > 0));
  const cw = k => C.catWeights[k] * (window.CasinoWorld ? window.CasinoWorld.catMul(k) : 1); // world.js: con calor se toma más
  let r = Math.random() * cats.reduce((a, k) => a + cw(k), 0), cat = cats[0];
  for (const k of cats) { r -= cw(k); if (r <= 0) { cat = k; break; } }
  let list = avail(cat); if (!list.length) { cat = cats.find(k => avail(k).length); list = cat ? avail(cat) : []; }
  if (!list.length) return null;
  const inStock = list.filter(p => stockOf(p.id) > 0);
  if (!inStock.length) return { out: list[0] };
  const prem = Math.random() < (C.premiumChance[c.type.id] || 0);
  const pool = inStock.filter(p => !!p.premium === prem);
  return { p: pick(pool.length ? pool : inStock) };
}
// ¿hay alguien en la caja? (vos detrás del mostrador o cerca, o un cajero contratado)
const attended = () => !!reg || (S().staff.cashier || 0) > 0 || Math.hypot(G.player.x - REG.x, G.player.z - REG.z) < 4;
function startChips(c) {
  const p = PROD("fichas");
  if (!attended()) { // nadie en la caja: juega con billetes en la máquina y se pierde la venta de fichas
    st().lostSales++; addMood(c, C.mood.unattended);
    G.hint("shopNobody", "Un cliente quiso comprar fichas y no había nadie en la caja registradora (a la izquierda de la entrada). Atendela vos o contratá un cajero.");
    return false;
  }
  if (stockOf("fichas") <= 0) { complain(c, "¿No hay fichas? ¿Qué casino es este?", C.mood.stockout, C.rep.stockout, "stockouts"); G.hint("shopEmpty", "Se terminaron las fichas del mostrador. Pedí una caja en la compu y reponelas (o contratá un repositor)."); return false; }
  const q = priceCheck(c, p); if (!q) return false;
  const n = Math.min(q, stockOf("fichas"));
  S().shop.stock.fichas -= n; dirtyStock = true;
  c.shop = { mode: "chips", items: [{ id: "fichas", q: n, price: priceOf("fichas") }], phase: "queue", wait: 0, spot: -1 };
  c.state = "shop"; c.path = null;
  return joinQueue(c);
}
function startBreak(c) {
  const ch = chooseProduct(c);
  if (!ch) return false;
  if (ch.out) { complain(c, pick([`¡No hay más ${ch.out.name.toLowerCase()}!`, "¿La heladera vacía? Qué desastre.", "¿Nada para picar?"]), C.mood.stockout, C.rep.stockout, "stockouts"); st().lostSales++; G.hint("shopEmpty", "Un cliente quiso comprar y no había. Reponé la heladera y los snacks con cajas de la compu."); return false; }
  if (!attended()) { // nadie para cobrar: sigue jugando y se pierde la venta
    st().lostSales++; addMood(c, C.mood.unattended);
    G.hint("shopNobody", "Un cliente quiso comprar algo y no había nadie en la caja registradora (a la izquierda de la entrada). Atendela vos o contratá un cajero.");
    return false;
  }
  const q = priceCheck(c, ch.p); if (!q) return false;
  G.releaseGame(c); if (c.person) c.person.api.stand();
  const sp = shelfAt(ch.p.shelf, c).pick;
  c.shop = { mode: "break", items: [{ id: ch.p.id, q, price: priceOf(ch.p.id) }], phase: "toShelf", t: 0, wait: 0, spot: -1, taken: false };
  c.state = "shop"; G.goTo(c, sp.x + rnd(-0.2, 0.2), sp.z + rnd(-0.35, 0.35));
  return true;
}
function joinQueue(c) {
  if (queue.length >= C.queueMax) {
    complain(c, "¡Qué fila larga! Ni loco espero.", C.mood.complain, 0, "lostSales");
    abort(c, true); return false;
  }
  queue.push(c); c.shop.phase = "queue"; c.shop.wait = 0; c.shop.spot = -1;
  if (c.person) G.setIcon(c.person, "cash");
  if (queue.length === 1) G.hint("shopQueue", `Hay gente en la caja registradora. Pasá detrás del mostrador (izquierda de la entrada) y ${KEY} para cobrar.`);
  return true;
}
function leaveQueue(c) { const i = queue.indexOf(c); if (i >= 0) queue.splice(i, 1); }
// devuelve lo que no pagó a la góndola y lo saca de la fila
function abort(c, restore) {
  const sh = c.shop; if (!sh) return;
  leaveQueue(c);
  if (restore && sh.items && (sh.mode === "chips" || sh.taken)) for (const it of sh.items) { const p = PROD(it.id); S().shop.stock[it.id] = Math.min(capOf(p), stockOf(it.id) + it.q); dirtyStock = true; }
  c.shop = null; restoreIcon(c);
  if (!c.life && !c.dead && c.state === "shop") { c.state = "choose"; c.path = null; }
}
function actor(c, dt) {
  if (!ensure() || c.dead) return false;
  if (!c.shop) {
    const pl = c.shopPlan; if (!pl || !G.isOpen) return false;
    if (c.state === "choose" && pl.chips) { pl.chips = false; return startChips(c); }
    if (c.state === "play" && c.machine && pl.breakAt > 0 && c.rounds <= pl.breakAt) { pl.breakAt = -1; return startBreak(c); }
    return false;
  }
  if (c.life) { abort(c, true); return false; }
  const sh = c.shop, p = c.person;
  if (!G.isOpen) { abort(c, true); G.leaveCustomer(c); return true; }
  if (sh.phase === "toShelf") {
    if (G.stepAgent(c, dt, c.speed)) {
      const it = sh.items[0], pr = PROD(it.id), n = Math.min(it.q, stockOf(it.id));
      if (n <= 0) { complain(c, `¡Justo se terminó ${pr.name.toLowerCase()}!`, C.mood.stockout, C.rep.stockout, "stockouts"); st().lostSales++; abort(c, false); return true; }
      it.q = n; S().shop.stock[it.id] -= n; sh.taken = true; dirtyStock = true;
      sh.phase = "take"; sh.t = 0.8; const su = shelfAt(pr.shelf, c); G.faceTo(c, su.x, su.z);
    }
    return true;
  }
  if (sh.phase === "take") { p.api.play(dt); sh.t -= dt; if (sh.t <= 0) joinQueue(c); return true; }
  if (sh.phase === "queue") {
    const idx = queue.indexOf(c);
    if (idx < 0) { abort(c, true); return true; }
    const spot = QSPOTS[Math.min(idx, QSPOTS.length - 1)];
    if (sh.spot !== idx) { sh.spot = idx; G.goTo(c, spot.x + (idx >= QSPOTS.length ? rnd(-0.3, 0.3) : 0), spot.z); }
    if (G.stepAgent(c, dt, c.speed)) {
      const ahead = idx === 0 ? { x: REG.x, z: REG.z } : QSPOTS[Math.min(idx - 1, QSPOTS.length - 1)];
      G.faceTo(c, ahead.x, ahead.z); p.api.idle(dt);
    }
    if (sh.serving) return true;
    sh.wait += dt;
    const lim = C.patienceSec * UPV("patienceMul", 1);
    if (sh.wait > lim * 0.5 && p) G.setBar(p, 1 - sh.wait / lim);
    if (sh.wait > lim) {
      complain(c, pick(["Me cansé de esperar.", "¿No atiende nadie la caja?", "Me voy, no hay nadie cobrando."]), C.mood.wait, C.rep.complain, "lostSales");
      abort(c, true);
    }
    return true;
  }
  return true;
}
function frontReady() {
  const c = queue[0]; if (!c || c.dead || !c.shop || c.shop.phase !== "queue") return null;
  return (!c.path || !c.path.length) && Math.hypot(c.x - QSPOTS[0].x, c.z - QSPOTS[0].z) < 0.5 ? c : null;
}
// cobrar: who = "player" (minijuego) o "cashier"
function serve(c, who, info) {
  const sh = c.shop; if (!sh) return 0;
  let total = 0, qty = 0;
  for (const it of sh.items) { total += it.price * it.q; qty += it.q; }
  G.Economy.add("shop", total);
  const t = st(); t.shopSales += qty; t.shopRev += total;
  for (const it of sh.items) { const k = willing(PROD(it.id)); addMood(c, k >= 1.15 ? C.mood.cheap : k < 0.9 ? C.mood.over : 0); }
  if (who === "player") {
    t.registerByHand++;
    let xp = C.xp.perItem * qty;
    if (info && info.exact) { xp += C.xp.exact; t.exactChange++; addMood(c, C.mood.exact); }
    if (info && info.fast) { xp += C.xp.fast; G.Economy.add("shop", C.tipFast); }
    if (info && info.slow) addMood(c, C.mood.wait);
    G.Rank.add(xp);
  } else G.Rank.add(C.xp.auto, true);
  if (c.person && G.near(c.x, c.z, 14)) G.floatText(REG.x, 1.9, REG.z + 0.3, "+" + fmt(total), "#6fd39b");
  G.sfx("register", REG.x, REG.z, who === "player" ? undefined : { quiet: true });
  leaveQueue(c); c.shop = null; restoreIcon(c);
  if (sh.mode === "break" && Math.random() < 0.6) emote(c, "happy", 1.6);
  if (!c.life && !c.dead) { c.state = "choose"; c.path = null; }
  G.checkObjectives();
  return total;
}
function onDespawn(c) { if (c.shop) abort(c, true); }

// =====================================================================
// CAJA REGISTRADORA: minijuego del vuelto (minigames.js)
// =====================================================================
const behind = () => G.player.z < REG.z - 0.3 && Math.abs(G.player.x - REG.x) < 1.7;
const regInteract = {
  prompt() {
    const n = queue.length;
    if (!behind()) return { text: "Caja registradora", sub: `${n ? n + " en la fila · " : ""}pasá detrás del mostrador para cobrar` };
    return { text: n ? `Atender la caja (${n} en la fila)` : "Atender la caja", sub: regOp ? "El cajero está cobrando: si entrás vos, se corre" : "Cobrás y das el vuelto con 1-7 · Espacio entrega" };
  },
  hold: () => 0, usable: () => behind() && !G.ui.mg,
  use: () => openRegister(),
  options: () => openPrices("fichas"), optLabel: "Precios",
};
G.proxy(regGroup, 0.6, 0.5, 0.5, regInteract, 1.25, 0.3, -0.12);
const MGK = () => window.CasinoMG && window.CasinoMG.kit;
let reg = null;
function payWith(total) {
  const opts = [];
  for (const step of [5, 10, 20, 50, 100]) { const v = Math.ceil((total + 0.01) / step) * step; if (v > total && !opts.includes(v)) opts.push(v); }
  if (Math.random() < 0.18) return total;
  const small = opts.filter(v => v - total < 60);
  return pick(small.length ? small.slice(0, 3) : opts.slice(0, 2));
}
const staleReg = () => { if (reg && !(window.CasinoMG && window.CasinoMG.active === reg)) { if (reg.c && reg.c.shop) reg.c.shop.serving = false; reg = null; } };
function openRegister() {
  staleReg();
  const K = MGK(); if (!K || !K.openSession || reg) return false;
  if (carry) { G.toast("Soltá la caja primero (G).", ""); return false; }
  if (regOp) releaseReg(regOp);
  const P = G.player; P.x = REG.back.x; P.z = REG.back.z; P.yaw = Math.PI; P.pitch = -0.42;
  const s = { kind: "caja", phase: "wait", c: null, items: [], total: 0, paid: 0, due: 0, given: [], t0: 0, mistakes: 0, poll: 0, nextT: 0, fresh: [] };
  if (!K.openSession(s)) return false;
  reg = s; const lv = document.getElementById("mgLeave"); if (lv) lv.textContent = "Dejar la caja";
  nextCustomer(s);
  G.hint("shopReg", "Caja registradora: armá el vuelto con las teclas 1-7 (billetes y monedas), 8 deshace y Espacio lo entrega. Justo = cliente contento y XP extra.");
  return true;
}
function nextCustomer(s) {
  const c = frontReady();
  if (!c) { s.phase = "wait"; s.c = null; render(); return; }
  c.shop.serving = true;
  s.c = c; s.items = c.shop.items.map(it => ({ name: PROD(it.id).name, q: it.q, price: it.price }));
  s.total = s.items.reduce((a, it) => a + it.price * it.q, 0); s.paid = payWith(s.total); s.due = s.paid - s.total;
  s.given = []; s.mistakes = 0; s.t0 = performance.now(); s.phase = "pay";
  if (MGK()) MGK().msg(s.due ? `Te paga con ${fmt(s.paid)}. Dale ${fmt(s.due)} de vuelto.` : "Paga justo: no hay vuelto.");
  render();
}
function render() { const K = MGK(); if (K && reg) K.render(); }
const sum = a => a.reduce((x, y) => x + y, 0);
const REG_EXT = {
  kind: "caja",
  open() {}, update() {},
  view(s) {
    const K = MGK();
    if (s.phase !== "pay" || !s.c) return { title: "Caja registradora", sub: queue.length ? `${queue.length} en la fila` : "Sin clientes", body: `<div class="mg-empty">${queue.length ? "El próximo cliente se está acercando…" : "Esperando clientes. Cuando llegue alguien a la caja, lo atendés acá."}</div>`, acts: K.btn("leave", "", "Dejar la caja", "alt", "Esc") };
    const rowsH = s.items.map(it => `<div class="mg-row"><span class="a">${esc(it.name)} ×${it.q}</span><span class="n">${fmt(it.price * it.q)}</span></div>`).join("");
    const g = sum(s.given);
    const chips = s.given.length ? s.given.map(v => `<span class="cajaB">${fmt(v)}</span>`).join("") : `<span class="dim">nada todavía</span>`;
    const body = `<div class="mg-rows">${rowsH}</div>
      <div class="cajaSum"><span>Total <b class="num">${fmt(s.total)}</b></span><span>Te paga <b class="num">${fmt(s.paid)}</b></span><span>Vuelto <b class="num">${fmt(s.due)}</b></span></div>
      <div class="cajaGiven">Vas dando: ${chips} = <b class="num ${g > s.due ? "out" : g === s.due ? "in" : ""}">${fmt(g)}</b></div>`;
    const acts = C.denoms.map((v, i) => K.btn("d", v, fmt(v), v >= 10 ? "" : "alt", i + 1)).join("") + K.btn("undo", "", "Deshacer", "alt", C.denoms.length + 1) + K.btn("ok", "", s.due ? "Dar el vuelto" : "Cobrar justo", "pri", "Espacio");
    return { title: "Caja registradora", sub: `${s.c.type.name}${queue.length > 1 ? ` · ${queue.length - 1} más en la fila` : ""}`, body, acts };
  },
  act(s, a, v) {
    const K = MGK();
    if (s.phase !== "pay" || !s.c) return;
    if (a === "d") { s.given.push(+v); G.sfx("restock"); render(); return; }
    if (a === "undo") { s.given.pop(); render(); return; }
    if (a !== "ok") return;
    const g = sum(s.given), c = s.c;
    if (g < s.due) {
      s.mistakes++; G.Rep.change(C.rep.short); addMood(c, C.mood.short); G.SFX.bad();
      emote(c, "angry", 2); say(c, "¡Me falta vuelto!", true);
      K.msg(`Le diste ${fmt(g)}: le faltan ${fmt(s.due - g)}. Contá de nuevo.`, "bad"); s.given = []; render(); return;
    }
    const sec = (performance.now() - s.t0) / 1000, over = g - s.due;
    if (over > 0) { G.Economy.force("shopLoss", over); }
    const exact = over === 0 && s.mistakes === 0;
    serve(c, "player", { exact, fast: exact && sec <= C.fastSec, slow: sec > C.slowSec });
    K.msg(over > 0 ? `Le diste ${fmt(over)} de más: lo perdés.` : exact ? `Vuelto justo${sec <= C.fastSec ? " y rápido (+propina)" : ""}.` : "Cobrado.", over > 0 ? "bad" : "good");
    if (over > 0) G.SFX.bad();
    s.phase = "done"; s.c = null; s.nextT = performance.now() + 650; render();
    G.updateHud(true);
  },
  leave(s) {
    if (s.c && s.c.shop) s.c.shop.serving = false;
    reg = null; MGK().closeSession(queue.length ? "Dejaste la caja: la fila espera." : "Dejaste la caja.", "");
  },
  frame(s, now) {
    const K = MGK();
    if (s.phase === "pay") {
      if (!s.c || s.c.dead || !s.c.shop) { nextCustomer(s); return; }
      const e = (now - s.t0) / 1000; K.setBar(1 - e / C.slowSec, e > C.fastSec);
    } else if (s.phase === "done") { if (now >= s.nextT) nextCustomer(s); }
    else { K.setBar(0); if (now >= s.poll) { s.poll = now + 300; if (frontReady()) nextCustomer(s); else if (!G.isOpen && !queue.length) { reg = null; K.closeSession("La caja cerró por hoy.", ""); } else render(); } }
  },
};
if (window.CasinoMG && window.CasinoMG.register) window.CasinoMG.register("__caja", REG_EXT);
{ const st2 = document.createElement("style"); st2.textContent = `
.mg-caja .mg-acts button{flex:1 1 70px}
.cajaSum{display:flex;gap:14px;flex-wrap:wrap;font-size:1rem}.cajaSum b{color:var(--brass);font-size:1.15rem}
.cajaGiven{font-size:.95rem;display:flex;gap:4px;flex-wrap:wrap;align-items:center}
.cajaB{font-family:var(--font-num);background:#23493b;border-radius:4px;padding:1px 6px;font-size:.85rem}
#shopCarry{position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:rgba(7,20,15,.88);border:1px solid var(--brass-dim);border-left:4px solid #b8874f;border-radius:6px;padding:5px 12px;font-size:.92rem;pointer-events:none;z-index:2;white-space:nowrap}
#shopCarry kbd{font-family:var(--font-num);background:#23493b;border-radius:3px;padding:0 6px;margin:0 3px;font-size:.8rem}
.spark{vertical-align:middle}
.pRow{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1.2fr) auto;gap:4px 10px;align-items:center;background:rgba(7,20,15,.5);border:1px solid #23493b;border-radius:6px;padding:6px 9px}
.pRow.locked{opacity:.55}.pRow .nm b{display:block}.pRow .nm span{font-size:.8rem;color:var(--ivory-dim)}
.pRow .mk{font-size:.85rem}.pRow .mk .up{color:var(--mint)}.pRow .mk .dn{color:var(--chip)}
.pRow .ctl{display:flex;gap:4px;align-items:center}.pRow .ctl b{min-width:58px;text-align:center;font-size:1.05rem}
.pRow .dem{grid-column:1/-1;font-size:.8rem}
@media (max-width:560px){.pRow{grid-template-columns:1fr auto}.pRow .mk{grid-column:1/-1}}
`; document.head.appendChild(st2); }

// cajero contratado: cobra solo si hay fila y no estás vos en la caja
function releaseReg(n) { if (regOp === n) regOp = null; n.shopReg = false; n.regT = 0; if (n.person) G.setBar(n.person, null); if (!n.dead) { n.state = "return"; const h = G.idleOf(n); G.goTo(n, h.x, h.z); } }
function cashierTick(n, dt, sp) {
  if (!ensure()) return false;
  if (n.state !== "idle" && n.state !== "return" && n.state !== "reg_go" && n.state !== "reg") return false;
  if (G.ui.mg === "caja" || reg) { if (regOp === n) releaseReg(n); return false; }
  if (!queue.length) {
    if (regOp !== n) return false;
    n.regIdle = (n.regIdle || 0) + dt; n.person.api.idle(dt);
    if (n.regIdle > 4) releaseReg(n);
    return true;
  }
  if (regOp && regOp !== n && !regOp.dead) return false;
  regOp = n; n.shopReg = true; n.regIdle = 0;
  if (n.state !== "reg") {
    if (n.state !== "reg_go") { n.state = "reg_go"; G.goTo(n, REG.back.x, REG.back.z); }
    if (G.stepAgent(n, dt, sp)) { n.state = "reg"; n.regT = 0; G.faceTo(n, REG.x, REG.z + 1); }
    return true;
  }
  n.person.api.play(dt);
  const c = frontReady();
  if (!c) { G.setBar(n.person, null); return true; }
  n.regT = (n.regT || 0) + dt; G.setBar(n.person, n.regT / C.cashierSec);
  if (n.regT >= C.cashierSec) { n.regT = 0; G.setBar(n.person, null); serve(c, "cashier"); }
  return true;
}

// repositor: trae cajas de la vereda y repone
function boxForStock(n) {
  const sh = S().shop; let best = null, bd = Infinity;
  for (const b of sh.boxes) {
    if (held.has(b.u) || claimed.has(b.u) || b === placing) continue;
    if (b.k === "prod") { const p = PROD(b.id); if (stockOf(p.id) >= capOf(p)) continue; }
    else if (b.z > -10.3) continue; // las grandes solo se entran desde la vereda
    const d = Math.hypot(b.x - n.x, b.z - n.z) + (b.k === "prod" ? 0 : 30);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
function stageSpot() {
  const boxes = S().shop.boxes;
  for (const p of STAGE) if (!boxes.some(b => !held.has(b.u) && Math.hypot(b.x - p.x, b.z - p.z) < 0.6)) return p;
  return { x: rnd(3.6, 4.6), z: rnd(-8.2, -6.4) };
}
function npcDrop(n) {
  const b = n.box; if (!b) return;
  n.box = null; held.delete(b.u); claimed.delete(b.u);
  if (S().shop.boxes.includes(b)) { b.x = n.dropAt ? n.dropAt.x : n.x; b.z = n.dropAt ? n.dropAt.z : n.z; groundBox(b); }
  n.dropAt = null;
}
function stockTick(n, dt, sp) {
  if (!ensure()) return;
  const p = n.person;
  switch (n.state) {
    case "idle": case "return": {
      if (n.state === "return") { if (G.stepAgent(n, dt, sp)) n.state = "idle"; } else p.api.idle(dt);
      n.scan = (n.scan || 0) - dt; if (n.scan > 0) break; n.scan = 0.6;
      const b = boxForStock(n);
      if (b) { claimed.set(b.u, n); n.target = b; n.state = "sk_go"; G.goTo(n, b.x + 0.45, b.z + 0.3); }
      break;
    }
    case "sk_go": {
      const b = n.target;
      if (!b || held.has(b.u) || !S().shop.boxes.includes(b)) { if (b) claimed.delete(b.u); n.target = null; G.backHome(n); break; }
      if (G.stepAgent(n, dt, sp)) {
        held.set(b.u, n); claimed.delete(b.u); n.box = b; n.target = null;
        liftBox(b, p.group, 0, 1.0, 0.42, 0.75); G.sfx("box_pick", b.x, b.z, { quiet: true });
        if (b.k === "prod") { const sp2 = shelfAt(PROD(b.id).shelf, n).pick; n.state = "sk_carry"; n.dest = sp2; G.goTo(n, sp2.x, sp2.z); }
        else { const s2 = stageSpot(); n.state = "sk_carry"; n.dest = s2; n.dropAt = s2; G.goTo(n, s2.x, s2.z + 0.6); }
      }
      break;
    }
    case "sk_carry": {
      const b = n.box; if (!b || !S().shop.boxes.includes(b)) { n.box = null; G.backHome(n); break; }
      b.x = n.x; b.z = n.z;
      if (G.stepAgent(n, dt, sp)) {
        if (b.k === "prod") { n.state = "sk_fill"; n.t = 0; const pr = PROD(b.id), su = shelfAt(pr.shelf, n); G.faceTo(n, su.x, su.z); }
        else { npcDrop(n); G.sfx("box_drop", b.x, b.z, { quiet: true }); G.backHome(n); }
      }
      break;
    }
    case "sk_fill": {
      const b = n.box; if (!b || !S().shop.boxes.includes(b)) { n.box = null; G.setBar(p, null); n.state = "idle"; n.scan = 0.2; break; }
      p.api.play(dt); n.t += dt;
      const pr = PROD(b.id); G.setBar(p, stockOf(pr.id) / capOf(pr));
      if (n.t >= (n.def.fillSec || 0.35)) {
        n.t = 0;
        const ok = restockOne(b, n);
        if (!S().shop.boxes.includes(b)) { n.box = null; G.setBar(p, null); n.state = "idle"; n.scan = 0.2; break; }
        if (!ok) { n.dropAt = { x: n.x + rnd(-0.3, 0.3), z: n.z + 0.5 }; npcDrop(n); G.setBar(p, null); n.state = "idle"; n.scan = 1; }
      }
      break;
    }
    default: n.state = "idle";
  }
}
function staffStatus(n) {
  if (n.shopReg) return n.state === "reg" ? "Atiende la caja registradora" : "Va a la caja registradora";
  if (n.role !== "stock") return null;
  switch (n.state) {
    case "sk_go": return "Va a buscar una caja";
    case "sk_carry": return n.box ? `Lleva: ${boxLabel(n.box)}` : "Llevando una caja";
    case "sk_fill": return n.box ? `Reponiendo ${PROD(n.box.id).name.toLowerCase()}` : "Reponiendo";
    default: return S().shop.boxes.length ? "Esperando (no hay nada para reponer)" : "Esperando cajas";
  }
}
function releaseNpc(n) {
  if (regOp === n) regOp = null;
  n.shopReg = false;
  if (n.box) { if (!n.dropAt) n.dropAt = { x: n.x, z: n.z }; npcDrop(n); }
  if (n.target && n.target.u) claimed.delete(n.target.u);
  if (n.role === "stock" || n.state === "reg" || n.state === "reg_go") n.target = null;
}

// =====================================================================
// PEDIDOS (compu)
// =====================================================================
function pendingOf(pred) {
  const sh = S().shop; let n = 0;
  for (const b of sh.boxes) if (pred(b)) n++;
  for (const o of sh.orders) for (const it of o.items) if (pred(it)) n++;
  return n;
}
const pendingGames = () => pendingOf(b => b.k === "machine" || b.k === "table");
const pendingBar = () => pendingOf(b => b.k === "barra") > 0;
function orderCost(k, id) {
  if (k === "prod") { const p = PROD(id); return wholesale(id) * p.box; }
  const d = defOf(k, id); return d ? d.price : 0;
}
function whyNot(k, id) {
  const s = S(), d = defOf(k, id); if (!d) return "No existe.";
  if (s.rank < d.rank) return `Rango ${d.rank}`;
  if (k === "prod" && d.lic && !licOk("prod", id)) return "Licencia";
  if ((k === "machine" || k === "table") && !licOk(k, id)) return "Licencia";
  if ((k === "machine" || k === "table") && G.gamesCount() + pendingGames() >= G.Rank.maxGames()) return `Tope ${G.Rank.maxGames()} juegos`;
  if (k === "barra" && (s.bar || pendingBar())) return s.bar ? "Ya la tenés" : "Ya pedida";
  if (k === "shelf" && units[id].length + pendingOf(b => b.k === "shelf" && b.id === id) >= d.max) return "Tope";
  if (s.bank < orderCost(k, id)) return "Sin plata";
  return null;
}
function placeOrder(k, id) {
  if (!ensure()) return false;
  const why = whyNot(k, id);
  if (why) { G.toast(why === "Sin plata" ? `No te alcanza: cuesta ${fmt(orderCost(k, id))}.` : why === "Licencia" ? "Primero comprá la licencia." : why, "bad"); G.SFX.bad(); return false; }
  const cat = k === "prod" ? "stock" : k === "machine" || k === "table" || k === "shelf" ? "purchases" : "decor";
  if (!G.Economy.trySpend(cat, orderCost(k, id))) return false;
  const sh = S().shop;
  let o = sh.orders.find(x => !x.sent);
  if (!o) { o = { eta: nowAbs() + C.deliveryMin, sent: false, items: [] }; sh.orders.push(o); }
  o.items.push({ k, id, q: k === "prod" ? PROD(id).box : 1 });
  const eta = o.eta % 1440;
  G.SFX.coin();
  G.toast(`Pedido: ${k === "prod" ? `caja de ${PROD(id).name} (×${PROD(id).box})` : defOf(k, id).name}. El camión llega ${o.eta >= (S().day + 1) * 1440 ? "mañana" : `a las ${two(Math.floor(eta / 60) % 24)}:${two(Math.floor(eta % 60))}`}.`, "good");
  G.hint("shopOrder", "El camión de La Estrella trae los pedidos y deja las cajas en la vereda de la entrada. Si es tarde, llegan a la mañana.");
  G.save(true); G.updateHud(true);
  return true;
}
function hhmm(abs) { const m = abs % 1440; return `${two(Math.floor(m / 60) % 24)}:${two(Math.floor(m % 60))}`; }

// =====================================================================
// INTERFAZ: compu y precios
// =====================================================================
let pcTab = "order", pcSub = "insumos", pricesShelf = null;
const sw = css => `<span class="sw" style="background:${css}"></span>`;
const hex = n => "#" + (n >>> 0).toString(16).padStart(6, "0");
function spark(h) {
  if (!h || h.length < 2) return "";
  const W = 74, H = 22, lo = Math.min(...h), hi = Math.max(...h), sp2 = Math.max(1, hi - lo);
  const pts = h.map((v, i) => `${(i / (h.length - 1) * (W - 2) + 1).toFixed(1)},${(H - 2 - (v - lo) / sp2 * (H - 4)).toFixed(1)}`).join(" ");
  const up = h[h.length - 1] >= h[h.length - 2];
  return `<svg class="spark" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${up ? "#6fd39b" : "#ff7a6a"}" stroke-width="2"/></svg>`;
}
function orderRow(k, d, sub, col) {
  const why = whyNot(k, d.id), cost = orderCost(k, d.id);
  const lic = window.CasinoUp && (k === "prod" ? (d.lic ? window.CasinoUp.licFor("prod", d.id) : null) : (k === "machine" || k === "table") ? window.CasinoUp.licFor(k, d.id) : null);
  const needLic = lic && !window.CasinoUp.hasLic(lic.id);
  const locked = S().rank < d.rank;
  const btn = needLic && !locked ? `<button class="ghost" data-sact="lic" data-id="${lic.id}" ${S().bank < window.CasinoUp.licPrice(lic) ? "disabled" : ""}>Licencia ${fmt(window.CasinoUp.licPrice(lic))}</button>`
    : `<button data-sact="order" data-k="${k}" data-id="${d.id}" ${why ? "disabled" : ""}>${why && why !== "Sin plata" ? esc(why) : "Pedir"}</button>`;
  return `<div class="item${locked ? " locked" : ""}">${sw(col)}<div class="t"><b>${esc(k === "prod" ? `${d.name} · caja ×${d.box}` : d.name)} · <span class="num">${fmt(cost)}</span>${locked ? `<span class="tag lock">Rango ${d.rank}</span>` : ""}${needLic ? '<span class="tag lock">Licencia</span>' : ""}</b><span>${sub}</span></div><div class="btns">${btn}</div></div>`;
}
function orderHtml() {
  const subs = [["insumos", "Insumos"], ["maquinas", "Máquinas"], ["mesas", "Mesas"], ["deco", "Decoración"], ["gondolas", "Góndolas"]];
  const head = `<div class="tabs">${subs.map(([id, n]) => `<button data-sact="pcsub" data-id="${id}" class="${pcSub === id ? "on" : ""}">${n}</button>`).join("")}</div>`;
  let body = "";
  const boxesOf = id => S().shop.boxes.filter(b => b.k === "prod" && b.id === id).reduce((a, b) => a + b.q, 0);
  if (pcSub === "insumos") body = `<p>Mayorista = ${Math.round(C.wholesale * 100)}% del precio de mercado de hoy. Vos ponés el precio de venta en la pestaña Precios.</p><div class="list">${C.products.map(p => orderRow("prod", p, `${fmt(wholesale(p.id))} c/u · mercado ${fmt(marketPrice(p.id))} · vendés a ${fmt(priceOf(p.id))} · en ${SHELF_NAME[p.shelf].toLowerCase()} ${stockOf(p.id)}/${capOf(p)}${boxesOf(p.id) ? ` · en cajas ${boxesOf(p.id)}` : ""}`, hex(p.color))).join("")}</div>`;
  else if (pcSub === "maquinas") body = `<div class="list">${D.MACHINES.map(d => orderRow("machine", d, `Apuesta ${fmt(d.bet)} · caja ${fmt(G.capOf(d))} · atractivo ${d.appeal}. ${esc(d.desc)}`, d.css)).join("")}</div>`;
  else if (pcSub === "mesas") body = `<div class="list">${D.TABLES.map(d => orderRow("table", d, `${d.seats} asientos · apuestas ${fmt(d.minBet)}-${fmt(d.maxBet)}. ${esc(d.desc)}`, d.css)).join("")}</div>`;
  else if (pcSub === "gondolas") {
    const sub = id => { const n = units[id].length, p = pendingOf(b => b.k === "shelf" && b.id === id); return `Tenés ${n}${p ? ` (+${p} en camino)` : ""} de ${furnDef(id).max} · cada una suma ${id === "heladera" ? "capacidad de bebidas" : "capacidad de snacks"} · se ubica y se mueve en el modo construcción (B)`; };
    body = `<p>Más góndolas = más stock en el salón sin reponer tan seguido. También podés mover las que ya tenés: modo construcción (B), mirás la góndola y E.</p><div class="list">${["heladera", "snacks"].map(id => orderRow("shelf", furnDef(id), sub(id), hex(furnDef(id).color))).join("")}</div>`;
  } else {
    const FP = window.CasinoBuild ? window.CasinoBuild.FP : {};
    const where = d => { const f = FP[d.id] || {}; return f.mount === "wall" ? "va en la pared" : f.mount === "ceil" ? "cuelga del techo" : f.rug ? "alfombra" : "en el piso"; };
    body = `<div class="list">${!S().bar ? orderRow("barra", Object.assign({}, BAR_DEF, { id: "barra" }), `+${BAR_DEF.atr} de atractivo · única, va en su lugar a la derecha de la entrada · habilita tragos y camareros`, hex(BAR_DEF.color)) : ""}${D.DECOR.filter(d => !d.unique).map(d => orderRow("decor", d, `+${d.atr} de atractivo · ${where(d)}`, hex(d.color))).join("")}</div>`;
  }
  const games = (pcSub === "maquinas" || pcSub === "mesas") ? ` · juegos <b class="num">${G.gamesCount()}${pendingGames() ? "+" + pendingGames() : ""}/${G.Rank.maxGames()}</b>` : "";
  return `${head}<p>Banco <b class="num">${fmt(S().bank)}</b>${games}. Lo que pedís llega en camión en ${C.deliveryMin} minutos de juego.</p>${body}`;
}
function pricesHtml(shelf) {
  const list = C.products.filter(p => !shelf || p.shelf === shelf);
  const rowsH = list.map(p => {
    const m = marketPrice(p.id), w = wholesale(p.id), pr = priceOf(p.id), tr = trend(p.id), k = willing(p), [dl, dc] = demandLabel(k), ok = sellable(p);
    const step = pr >= 40 ? 5 : 1;
    return `<div class="pRow${ok ? "" : " locked"}"><div class="nm"><b>${esc(p.name)}</b><span>${SHELF_NAME[p.shelf]} · ${stockOf(p.id)}/${capOf(p)}${ok ? "" : ` · ${S().rank < p.rank ? `rango ${p.rank}` : "sin licencia"}`}</span></div>
      <div class="mk">Mercado <b class="num">${fmt(m)}</b> <span class="${tr >= 0 ? "up" : "dn"}">${tr >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(tr * 100))}%</span> ${spark(S().shop.market[p.id].h)}<br><span class="dim">Mayorista ${fmt(w)} · margen ${fmt(pr - w)}</span></div>
      <div class="ctl"><button class="ghost sm" data-sact="price" data-id="${p.id}" data-d="${-step}" aria-label="Bajar">−</button><b class="num">${fmt(pr)}</b><button class="ghost sm" data-sact="price" data-id="${p.id}" data-d="${step}" aria-label="Subir">+</button><button class="ghost sm" data-sact="pmk" data-id="${p.id}">= mercado</button></div>
      <div class="dem ${dc}">${dl}</div></div>`;
  }).join("");
  return `<p>El precio de mercado cambia todos los días. Hasta un 15% más caro se vende casi igual; más de 35% arriba, la gente se queja y no compra. Las bebidas aguantan más con «Tragos premium».</p><div class="list">${rowsH}</div>`;
}
function shipHtml() {
  const sh = S().shop, now = nowAbs();
  const ord = sh.orders.map(o => `<div class="item">${sw("#d9a84a")}<div class="t"><b>${o.sent ? "En camino" : o.eta <= now ? "Sale ahora" : `Llega a las ${hhmm(o.eta)}${o.eta >= (S().day + 1) * 1440 ? " (mañana)" : ""}`}</b><span>${o.items.map(it => esc(it.k === "prod" ? `${PROD(it.id).name} ×${it.q}` : defOf(it.k, it.id).name)).join(" · ")}</span></div></div>`).join("");
  const out = sh.boxes.filter(b => b.z < -10.2 && !held.has(b.u)).length, inn = sh.boxes.filter(b => b.z >= -10.2 && !held.has(b.u)).length;
  return `<div class="statgrid"><div class="stat"><b>${sh.orders.length}</b><span>Pedidos en camino</span></div><div class="stat"><b>${out}</b><span>Cajas en la vereda</span></div><div class="stat"><b>${inn}</b><span>Cajas adentro</span></div><div class="stat"><b>${carry ? 1 : 0}</b><span>En tus manos</span></div></div>
    ${ord ? `<div class="list">${ord}</div>` : `<p class="dim">No hay pedidos en camino.</p>`}
    <p>Hoy: ${st().shopSales} ventas en el kiosco por <b class="num">${fmt(st().shopRev)}</b> · ${st().stockouts} faltantes · ${st().complaints} quejas.</p>`;
}
function openPc(tab, sub) {
  if (!ensure()) return;
  marketDay();
  if (tab) pcTab = tab; if (sub) pcSub = sub;
  const head = pcHead(pcTab);
  const body = pcTab === "cmb" && window.CasinoCombat ? window.CasinoCombat.shopHtml() : pcTab === "clima" && window.CasinoWorld ? window.CasinoWorld.forecastHtml() : pcTab === "prices" ? pricesHtml(null) : pcTab === "ship" ? shipHtml() : orderHtml();
  G.openPanel("pc", `<h2>La compu · tienda online</h2>${head}${body}<div class="actions"><button class="ghost" data-act="close">Cerrar</button></div>`);
}
// pestañas de la compu (owner.js agrega Imagen, Publicidad y Seguridad; world.js agrega Pronóstico)
function pcHead(on) {
  const tabs = [["order", "Pedir"], ["prices", "Precios"], ["ship", "Envíos"], ["up", "Mejoras y licencias"]];
  if (window.CasinoWorld) tabs.splice(3, 0, ["clima", "Pronóstico"]); // world.js: pronóstico extendido
  tabs.push(...(window.CasinoOwner ? window.CasinoOwner.pcTabs() : []));
  if (window.CasinoCombat) tabs.push(["cmb", "Armas"]); // combat.js: arma blanca, pistola y municiones
  return `<div class="tabs">${tabs.map(([id, n]) => `<button data-sact="pctab" data-id="${id}" class="${on === id ? "on" : ""}">${n}</button>`).join("")}</div>`;
}
function openPrices(shelf) {
  if (!ensure()) return;
  marketDay(); pricesShelf = shelf;
  G.openPanel("prices", `<h2>Precios · ${SHELF_NAME[shelf]}</h2>${pricesHtml(shelf)}<div class="actions"><button class="ghost" data-sact="topc">Todo en la compu</button><button class="ghost" data-act="close">Cerrar</button></div>`);
}
function rerender() { if (G.ui.panel === "pc") openPc(); else if (G.ui.panel === "prices") openPrices(pricesShelf); }
document.getElementById("panelBody").addEventListener("click", e => {
  const b = e.target.closest("button[data-sact]"); if (!b || b.disabled || !ensure()) return;
  const a = b.dataset.sact, id = b.dataset.id;
  if (a === "pctab") { if (window.CasinoOwner && window.CasinoOwner.pcTab(id)) return; if (id === "up") { if (window.CasinoUp) window.CasinoUp.open("tree", true); } else openPc(id); return; }
  if (a === "pcsub") { openPc(null, id); return; }
  if (a === "order") { placeOrder(b.dataset.k, id); rerender(); return; }
  if (a === "lic") { if (window.CasinoUp) window.CasinoUp.buyLic(id); rerender(); return; }
  if (a === "price") { const sh = S().shop; sh.price[id] = clamp(priceOf(id) + (+b.dataset.d), 1, 9999); dirtyTags = true; G.SFX.tick(); rerender(); return; }
  if (a === "pmk") { S().shop.price[id] = marketPrice(id); dirtyTags = true; G.SFX.tick(); rerender(); return; }
  if (a === "topc") { openPc("prices"); return; }
});
const pcInteract = {
  shopAccept: () => true,
  prompt: () => ({ text: "La compu del local · tienda online", sub: `Pedí mercadería, máquinas y decoración · precios · mejoras${S() && S().shop && S().shop.orders.length ? ` · ${S().shop.orders.length} pedido(s) en camino` : ""}` }),
  hold: () => 0, use: () => openPc(),
};
G.proxy(pcGroup, 1.2, 1.4, 0.9, pcInteract, 0.85, 0, 0.1);

// HUD: lo que llevás en las manos
const carryEl = document.createElement("div"); carryEl.id = "shopCarry"; carryEl.hidden = true; document.body.appendChild(carryEl);
let lastCarry = "";
function hudCarry() {
  const show = carry && !placing && G.started && !G.ui.blocking() && !(window.CasinoBuild && window.CasinoBuild.active);
  const html = show ? `Llevás: <b>${esc(boxLabel(carry))}</b>${G.isTouch ? "" : ` <kbd>G</kbd> soltar`}` : "";
  if (html !== lastCarry) { lastCarry = html; carryEl.innerHTML = html; }
  carryEl.hidden = !show;
}

// =====================================================================
// CICLO
// =====================================================================
function update(dt) {
  if (!ensure()) return;
  marketDay();
  truckUpdate(dt);
  for (let i = queue.length - 1; i >= 0; i--) { const c = queue[i]; if (!c || c.dead || !c.shop || c.life || c.state === "leave" || c.state === "flee") { if (c && c.shop) abort(c, true); else queue.splice(i, 1); } }
  if (regOp && (regOp.dead || !regOp.shopReg)) regOp = null;
  staleReg();
  if (window.CasinoUp) window.CasinoUp.update(dt);
}
function frame() {
  if (!ensure()) return;
  for (const b of S().shop.boxes) { const h = held.get(b.u); if (h && h !== "player") { b.x = h.x; b.z = h.z; } else if (h === "player") { b.x = G.player.x; b.z = G.player.z; } }
  if (dirtyStock) refreshStock();
  if (dirtyTags) refreshTags();
  hudCarry();
}
function onEndDay(notes) {
  if (!ensure()) return;
  for (const c of queue.slice()) abort(c, true);
  queue.length = 0; regOp = null;
  if (reg && MGK()) { reg = null; MGK().closeSession(); }
  const n = deliverAllNow(); if (n) notes.push(`El camión de La Estrella dejó ${n} caja${n > 1 ? "s" : ""} en la vereda a última hora.`);
  const t = st();
  if (t.shopSales || t.stockouts || t.complaints) notes.push(`Kiosco: ${t.shopSales} ventas por ${fmt(t.shopRev)}${t.registerByHand ? ` (${t.registerByHand} cobros tuyos)` : ""}${t.stockouts ? ` · faltó mercadería ${t.stockouts} veces` : ""}${t.complaints ? ` · ${t.complaints} quejas` : ""}.`);
  dirtyStock = true; dirtyTags = true;
}
// al cargar una partida o cerrar el día: soltar lo que lleva el jugador
function dropAll() { if (carry && !placing) dropCarried(); }

window.CasinoShop = {
  ensure, update, frame, actor, onSpawn, onDespawn, onEndDay, override, speedMul, dropCarried, dropAll,
  cashierTick, stockTick, staffStatus, releaseNpc,
  markerAccept, markerPrompt, markerUse, barPrompt, barUse,
  reserved: () => RESERVED, access: skip => accessAll(skip),
  // góndolas (decor.js las trata como un objeto más del modo construcción)
  shelves: () => [].concat(units.heladera, units.snacks),
  shelfName: shelf => SHELF_NAME[shelf], furnDef, shelfDims: shelf => FURN[shelf],
  shelfGhost: shelf => (shelf === "heladera" ? makeFridge : makeSnacks)(true).g,
  moveShelf(u, pose) { placeUnit(u, pose.x, pose.z, pose.rot); saveFurn(); dirtyStock = true; G.save(true); },
  addShelf(shelf, pose) {
    if (!ensure() || units[shelf].length >= MAXU) return false;
    addUnit(shelf, pose.x, pose.z, pose.rot); saveFurn(); dirtyStock = true; dirtyTags = true; G.save(true); return true;
  },
  openPc, openPrices, placeOrder, pcHead,
  get carrying() { return carry; }, get placing() { return placing; },
  // guide.js: lo que la flecha de la primera hora necesita saber (cajas, góndolas, compu, fila y pedidos)
  guide() {
    if (!ensure()) return null;
    const shelfOf = b => (b.k === "prod" && PROD(b.id) ? PROD(b.id).shelf : null);
    return {
      carry: carry ? { k: carry.k, id: carry.id, shelf: shelfOf(carry) } : null,
      boxes: S().shop.boxes.map(b => ({ k: b.k, id: b.id, x: b.x, z: b.z, held: held.has(b.u), shelf: shelfOf(b) })),
      shelfPos: shelf => { const u = shelfAt(shelf, G.player); return u.pick || u; },
      shelfName: shelf => SHELF_NAME[shelf] || shelf,
      ordered: k => S().shop.orders.some(o => o.items.some(i => i.k === k)),
      queue: queue.length, PC, REG,
    };
  },
  debug: {
    get state() { ensure(); return S().shop; },
    get queue() { return queue.map(c => ({ type: c.type.id, mode: c.shop && c.shop.mode, phase: c.shop && c.shop.phase, items: c.shop && c.shop.items, x: c.x, z: c.z, serving: !!(c.shop && c.shop.serving) })); },
    get carry() { return carry ? { k: carry.k, id: carry.id, q: carry.q, u: carry.u } : null; },
    get truck() { return { state: truck.state, x: truck.x }; },
    get reg() { return reg ? { phase: reg.phase, total: reg.total, paid: reg.paid, due: reg.due, given: reg.given.slice(), mistakes: reg.mistakes } : null; },
    get regOp() { return regOp ? regOp.role : null; },
    held: () => [...held.entries()].map(([u, h]) => [u, h === "player" ? "player" : h.role]),
    order: placeOrder, deliverNow: deliverAllNow, drift, marketPrice, wholesale, willing: id => willing(PROD(id)), stock: stockOf, price: priceOf,
    giveBox(k, id, x, z) { ensure(); return newBox(k, id, x == null ? -4 : x, z == null ? -11.2 : z); },
    pickUp(i) { const b = S().shop.boxes[i]; if (b) pickUp(b); return !!carry; },
    drop: dropCarried, openCarried, frontReady: () => !!frontReady(),
    serveFront() { const c = frontReady(); return c ? serve(c, "player", {}) : 0; },
    pos: { PC, REG, FRIDGE, SNACKS, QSPOTS, DROP, STAGE },
    units, capOf: id => capOf(PROD(id)), unitFor, syncFurn, dirty: () => { dirtyStock = true; },
  },
};
})();
