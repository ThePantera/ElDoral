/* Casino Dorado v3 · decor.js — MODO CONSTRUCCIÓN (decorar y mover)
 * Se carga ANTES de game.js (después de art.js). Agrega:
 *  - catálogo de decoración nuevo (se suma a CASINO_DATA.DECOR) y sus modelos procedurales;
 *  - objetos ubicados libremente (x, z, rot) en vez de lugares fijos, con migración de partidas viejas;
 *  - modo construcción (B / botón Construir): levantar, mover, girar 90°/45°, vender (50%), comprar con fantasma verde/rojo;
 *  - navegación A* en una grilla de 0,5 m para clientes y personal (respeta objetos y zonas cerradas);
 *  - validación: paredes, objetos, entrada y que todos los juegos sigan siendo alcanzables desde la puerta;
 *  - ambientes: alfombra y color de pared por zona (suman atractivo).
 * game.js llama a CasinoBuild.init(api) con sus funciones internas antes de arrancar.
 */
(function () {
"use strict";
const D = window.CASINO_DATA, T = window.THREE;
if (!D || !T) return;
const TAU = Math.PI * 2, HALF = Math.PI / 2, Q = Math.PI / 4;
const WALL_H = 3.5, IN_X = 21.85, IN_Z = 9.85;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const isNum = v => typeof v === "number" && Number.isFinite(v);
const snap = (v, s) => Math.round(v / s) * s;
const normRot = r => { r = r % TAU; if (r < 0) r += TAU; return r; };
const degOf = r => Math.round(normRot(r) * 180 / Math.PI / 45) * 45 % 360;
const radOf = deg => normRot(Math.round(deg / 45) * 45 * Math.PI / 180);
const rotXZ = (lx, lz, rot) => { const c = Math.cos(rot), s = Math.sin(rot); return { x: c * lx + s * lz, z: -s * lx + c * lz }; };
const rotExt = (w, d, rot) => { const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot)); return { ex: c * w / 2 + s * d / 2, ez: s * w / 2 + c * d / 2 }; };
const zoneAt = x => x < -10 ? "oeste" : x > 10 ? "este" : "principal";
const ZONE_NAME = { principal: "Salón principal", este: "Ala Este", oeste: "Salón VIP" };

// =====================================================================
// CATÁLOGO NUEVO (se agrega a los datos antes de que arranque game.js)
// =====================================================================
const NEW_DECOR = [
  { id: "deco_soga",             name: "Soga de terciopelo",      price: 450,  atr: 3,  rank: 1, color: 0x8a1022 },
  { id: "deco_alfombra_redonda", name: "Alfombra redonda dorada", price: 800,  atr: 4,  rank: 1, color: 0xb8873a },
  { id: "deco_cuadro",           name: "Cuadro al óleo",          price: 700,  atr: 4,  rank: 1, color: 0x6a4a2a, mount: "wall" },
  { id: "deco_farol",            name: "Farol de bronce",         price: 650,  atr: 5,  rank: 2, color: 0xffd27a },
  { id: "deco_alfombra_persa",   name: "Alfombra persa",          price: 1200, atr: 6,  rank: 2, color: 0x7a3a1a },
  { id: "deco_retrato",          name: "Retrato del fundador",    price: 1800, atr: 8,  rank: 3, color: 0x3a2a1a, mount: "wall" },
  { id: "deco_neon_777",         name: "Neón 777",                price: 2200, atr: 10, rank: 3, color: 0xff3a6a, mount: "wall" },
  { id: "deco_arana",            name: "Araña de cristal",        price: 2600, atr: 12, rank: 3, color: 0xfff6e8, mount: "ceil" },
  { id: "deco_columna",          name: "Columna de mármol",       price: 2000, atr: 8,  rank: 4, color: 0xe8e1d3 },
  { id: "deco_neon_dorado",      name: "Neón «Dorado»",           price: 3500, atr: 15, rank: 5, color: 0xffc94a, mount: "wall" },
];
for (const d of NEW_DECOR) if (!D.DECOR.some(x => x.id === d.id)) D.DECOR.push(d);
// huella de cada decoración: w×d en el piso (solid = bloquea el paso), o montada en pared/techo
const FP = {
  deco_planta: { w: 0.7, d: 0.7, solid: 1, h: 1.7 }, deco_lampara: { w: 0.7, d: 0.7, solid: 1, h: 2.0 },
  deco_alfombra: { w: 1.9, d: 1.7, rug: 1 }, deco_estatua: { w: 0.7, d: 0.7, solid: 1, h: 2.1 }, deco_fuente: { w: 1.3, d: 1.3, solid: 1, h: 1.7 },
  deco_soga: { w: 1.7, d: 0.35, solid: 1, h: 1.0 }, deco_alfombra_persa: { w: 2.6, d: 1.7, rug: 1 }, deco_alfombra_redonda: { w: 1.9, d: 1.9, rug: 1 },
  deco_farol: { w: 0.45, d: 0.45, solid: 1, h: 2.4 }, deco_columna: { w: 0.7, d: 0.7, solid: 1, h: 3.5 },
  deco_cuadro: { w: 1.2, h: 0.9, y: 1.95, mount: "wall" }, deco_retrato: { w: 0.9, h: 1.2, y: 2.0, mount: "wall" },
  deco_neon_777: { w: 1.5, h: 0.6, y: 2.45, mount: "wall" }, deco_neon_dorado: { w: 2.2, h: 0.6, y: 2.5, mount: "wall" },
  deco_arana: { w: 1.2, d: 1.2, mount: "ceil" },
  deco_pantalla_carreras: { w: 2.4, h: 1.4, y: 2.25, mount: "wall" }, // games.js
};
const fpOf = id => FP[id] || { w: 0.7, d: 0.7, solid: 1, h: 1.6 };

// ambientes por zona
const CARPETS = [
  { id: "clasica",   name: "Bordó clásica", base: "#4a0f1a", line: "#b8873a", accent: "#1d5a4f", price: 0,    atr: 0, rank: 1 },
  { id: "esmeralda", name: "Esmeralda",     base: "#0f3a2a", line: "#d9a84a", accent: "#5a1220", price: 900,  atr: 3, rank: 1 },
  { id: "noche",     name: "Noche violeta", base: "#1c1226", line: "#9a7430", accent: "#3a6a8a", price: 1200, atr: 4, rank: 2 },
  { id: "real",      name: "Azul real",     base: "#16204a", line: "#e0b64a", accent: "#7a1424", price: 1800, atr: 5, rank: 3 },
  { id: "dorada",    name: "Oro viejo",     base: "#4a3210", line: "#f3d27a", accent: "#1a0e08", price: 3000, atr: 8, rank: 5 },
];
const WALLS = [
  { id: "bordo", name: "Bordó",           color: "#3b1f1a", price: 0,    atr: 0, rank: 1 },
  { id: "verde", name: "Verde inglés",    color: "#1f3a2a", price: 600,  atr: 2, rank: 1 },
  { id: "azul",  name: "Azul medianoche", color: "#1c2846", price: 600,  atr: 2, rank: 1 },
  { id: "crema", name: "Crema",           color: "#8a7450", price: 900,  atr: 3, rank: 2 },
  { id: "rojo",  name: "Rojo casino",     color: "#6a121c", price: 1400, atr: 4, rank: 3 },
  { id: "negro", name: "Negro y oro",     color: "#151313", price: 2000, atr: 5, rank: 4 },
];
const CARPET = id => CARPETS.find(c => c.id === id) || CARPETS[0];
const WALLC = id => WALLS.find(c => c.id === id) || WALLS[0];
const ZONE_X = { principal: [-10, 10], este: [10, 22], oeste: [-22, -10] };

// =====================================================================
// MODELOS PROCEDURALES NUEVOS
// =====================================================================
const texCache = {};
function ctex(key, w, h, draw) {
  if (!texCache[key]) texCache[key] = window.CasinoArt.canvasTex(w, h, draw);
  return texCache[key];
}
const mats = {};
function mat(key, make) { return mats[key] || (mats[key] = make()); }
function persaTex() {
  return ctex("persa", 256, 168, (g, w, h) => {
    g.fillStyle = "#6a1a14"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#1a2a4a"; g.fillRect(10, 10, w - 20, h - 20);
    g.fillStyle = "#8a2418"; g.fillRect(20, 20, w - 40, h - 40);
    g.strokeStyle = "#e0b664"; g.lineWidth = 3; g.strokeRect(14, 14, w - 28, h - 28); g.strokeRect(24, 24, w - 48, h - 48);
    g.save(); g.translate(w / 2, h / 2);
    g.fillStyle = "#1a2a4a"; g.beginPath(); g.moveTo(0, -52); g.lineTo(70, 0); g.lineTo(0, 52); g.lineTo(-70, 0); g.closePath(); g.fill();
    g.strokeStyle = "#e0b664"; g.lineWidth = 2; g.stroke();
    g.fillStyle = "#e0b664"; for (let k = 0; k < 8; k++) { g.rotate(Math.PI / 4); g.beginPath(); g.ellipse(0, -18, 5, 12, 0, 0, TAU); g.fill(); }
    g.fillStyle = "#6a1a14"; g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.fill();
    g.restore();
    g.fillStyle = "rgba(224,182,100,.6)"; for (let x = 34; x < w - 30; x += 16) { g.fillRect(x, 28, 4, 4); g.fillRect(x, h - 32, 4, 4); }
  });
}
function roundRugTex() {
  return ctex("rugRound", 256, 256, (g, w, h) => {
    g.fillStyle = "#14110c"; g.fillRect(0, 0, w, h);
    g.translate(w / 2, h / 2);
    g.fillStyle = "#b8873a"; g.beginPath(); g.arc(0, 0, 126, 0, TAU); g.fill();
    g.fillStyle = "#1a1408"; g.beginPath(); g.arc(0, 0, 112, 0, TAU); g.fill();
    g.strokeStyle = "#d9a84a"; g.lineWidth = 4;
    for (let k = 0; k < 16; k++) { g.rotate(TAU / 16); g.beginPath(); g.moveTo(0, 30); g.lineTo(0, 100); g.stroke(); }
    g.fillStyle = "#d9a84a"; g.beginPath(); for (let i = 0; i < 16; i++) { const r = i % 2 ? 14 : 34, a = i * Math.PI / 8; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill();
  });
}
function paintingTex() {
  return ctex("paint", 256, 192, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h * 0.6); sky.addColorStop(0, "#f2b46a"); sky.addColorStop(1, "#e87a4a");
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = "#ffe2a0"; g.beginPath(); g.arc(178, 70, 22, 0, TAU); g.fill();
    g.fillStyle = "#5a3a5a"; g.beginPath(); g.moveTo(0, 120); g.quadraticCurveTo(70, 70, 140, 110); g.quadraticCurveTo(200, 85, 256, 115); g.lineTo(256, 192); g.lineTo(0, 192); g.fill();
    g.fillStyle = "#2a3a2a"; g.beginPath(); g.moveTo(0, 150); g.quadraticCurveTo(110, 120, 256, 155); g.lineTo(256, 192); g.lineTo(0, 192); g.fill();
    g.fillStyle = "rgba(0,0,0,.08)"; for (let i = 0; i < 400; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 1);
  });
}
function portraitTex() {
  return ctex("portrait", 192, 256, (g, w, h) => {
    const bg = g.createRadialGradient(w / 2, h * 0.4, 10, w / 2, h * 0.45, 150); bg.addColorStop(0, "#5a3a1a"); bg.addColorStop(1, "#1a0e08");
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = "#15171a"; g.beginPath(); g.moveTo(20, h); g.quadraticCurveTo(w / 2, 150, w - 20, h); g.fill();
    g.fillStyle = "#f3e9d2"; g.beginPath(); g.moveTo(w / 2 - 16, 172); g.lineTo(w / 2 + 16, 172); g.lineTo(w / 2, 215); g.fill();
    g.fillStyle = "#d4423f"; g.fillRect(w / 2 - 4, 176, 8, 24);
    g.fillStyle = "#e0ac69"; g.beginPath(); g.ellipse(w / 2, 120, 34, 44, 0, 0, TAU); g.fill();
    g.fillStyle = "#2a1a10"; g.beginPath(); g.ellipse(w / 2, 88, 36, 20, 0, Math.PI, TAU); g.fill();
    g.fillStyle = "#2a1a10"; g.fillRect(w / 2 - 18, 140, 36, 6);
    g.fillStyle = "#d9a84a"; g.font = "bold 14px Georgia, serif"; g.textAlign = "center"; g.fillText("EL FUNDADOR", w / 2, h - 10);
  });
}
function neonTex(text, color, w, h) {
  return ctex("neon|" + text, w, h, (g) => {
    g.clearRect(0, 0, w, h);
    g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `bold ${Math.round(h * 0.62)}px Georgia, serif`;
    g.shadowColor = color; g.shadowBlur = 26; g.lineWidth = 7; g.strokeStyle = color; g.strokeText(text, w / 2, h / 2 + 4);
    g.shadowBlur = 10; g.fillStyle = "#fff6e8"; g.fillText(text, w / 2, h / 2 + 4);
  });
}
function framed(g, A, w, h, y, tex) {
  const frame = new T.Mesh(A.roundedBox(w + 0.12, h + 0.12, 0.06, 0.02), A.materials.brass); frame.position.set(0, y, 0.03); g.add(frame);
  const pic = new T.Mesh(new T.PlaneGeometry(w, h), mat("pic|" + tex.uuid, () => new T.MeshStandardMaterial({ map: tex, roughness: 0.7 })));
  pic.position.set(0, y, 0.065); g.add(pic);
}
function makeNewDecor(id) {
  const A = window.CasinoArt, g = new T.Group(), brass = A.materials.brass;
  switch (id) {
    case "deco_soga": g.add(A.makeVelvetRope({ length: 1.6, posts: 2 })); break;
    case "deco_alfombra_persa": case "deco_alfombra_redonda": {
      const round = id === "deco_alfombra_redonda";
      const geo = round ? new T.CircleGeometry(0.95, 32) : new T.PlaneGeometry(2.6, 1.7);
      const r = new T.Mesh(geo, mat("rug|" + id, () => new T.MeshStandardMaterial({ map: round ? roundRugTex() : persaTex(), roughness: 0.95 })));
      r.rotation.x = -HALF; r.position.y = 0.013; g.add(r); break;
    }
    case "deco_farol": {
      // paso 2: pie y remate torneados, farol de 8 lados (sigue siendo un farol, pero sin aristas de bloque)
      const L = A.latheGeometry;
      const base = new T.Mesh(L("farolpie", [[0, 0], [0.2, 0], [0.205, 0.015], [0.19, 0.04], [0.14, 0.07], [0.08, 0.1], [0.05, 0.16], [0.04, 0.2], [0, 0.2]], 20), brass); g.add(base);
      const pole = new T.Mesh(new T.CylinderGeometry(0.03, 0.035, 1.75, 12, 1, true), A.materials.brassDark); pole.position.y = 1.07; g.add(pole);
      const glass = new T.Mesh(new T.CylinderGeometry(0.13, 0.1, 0.32, 8), A.basic(0xffd27a)); glass.position.y = 2.1; g.add(glass);
      const cap = new T.Mesh(L("farolcap", [[0.2, 0], [0.205, 0.015], [0.17, 0.05], [0.08, 0.12], [0.03, 0.17], [0.035, 0.2], [0, 0.22]], 16), brass); cap.position.y = 2.26; g.add(cap);
      const ring = new T.Mesh(A.roundedCylinder(0.15, 0.15, 0.04, 16, 0.012), brass); ring.position.y = 1.94; g.add(ring);
      A.addBlob(g, 0.6, 0.6); break;
    }
    case "deco_columna": {
      const marble = A.materials.marble;
      const plinth = new T.Mesh(A.roundedBox(0.62, 0.22, 0.62, 0.03), marble); plinth.position.y = 0.11; g.add(plinth);
      const ring = new T.Mesh(A.latheGeometry("colbase", [[0.29, 0], [0.295, 0.02], [0.27, 0.045], [0.275, 0.065], [0.25, 0.08], [0, 0.08]], 28), brass); ring.position.y = 0.22; g.add(ring);
      const shaft = new T.Mesh(new T.CylinderGeometry(0.22, 0.25, WALL_H - 0.62, 28, 1, true), marble); shaft.position.y = 0.3 + (WALL_H - 0.62) / 2; g.add(shaft);
      const top = new T.Mesh(A.latheGeometry("colcap", [[0.22, 0], [0.24, 0.02], [0.3, 0.07], [0.31, 0.1], [0.3, 0.12], [0, 0.12]], 28), brass); top.position.y = WALL_H - 0.32; g.add(top);
      const cap = new T.Mesh(A.roundedBox(0.66, 0.2, 0.66, 0.03), marble); cap.position.y = WALL_H - 0.1; g.add(cap);
      A.addBlob(g, 0.9, 0.9); break;
    }
    case "deco_cuadro": framed(g, A, 1.2, 0.9, 1.95, paintingTex()); break;
    case "deco_retrato": framed(g, A, 0.9, 1.2, 2.0, portraitTex()); break;
    case "deco_neon_777": case "deco_neon_dorado": {
      const big = id === "deco_neon_dorado", w = big ? 2.2 : 1.5, h = 0.6, y = big ? 2.5 : 2.45;
      const board = new T.Mesh(A.roundedBox(w, h, 0.04, 0.015), A.std(0x0b0c0e, 0.4, 0.1)); board.position.set(0, y, 0.02); g.add(board);
      const tex = big ? neonTex("DORADO", "#ffc94a", 512, 140) : neonTex("777", "#ff3a6a", 384, 154);
      const sign = new T.Mesh(new T.PlaneGeometry(w * 0.96, h * 0.96), mat("neon|" + id, () => new T.MeshBasicMaterial({ map: tex, transparent: true })));
      sign.position.set(0, y, 0.045); g.add(sign);
      const m = sign.material; let t = Math.random() * 5;
      g.userData.buildTick = dt => { t += dt; const f = 0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 2.3); m.color.setScalar(f); };
      break;
    }
    case "deco_arana": {
      const ch = A.makeChandelier({ light: false }); ch.position.y = WALL_H; g.add(ch);
      if (ch.api) g.userData.buildTick = dt => ch.api.update(dt);
      break;
    }
    default: if (window.CasinoGames && window.CasinoGames.makeDecor) window.CasinoGames.makeDecor(id, g); // games.js (pantalla de carreras)
  }
  return g;
}

// =====================================================================
// ESTADO DEL MÓDULO
// =====================================================================
let API = null;            // funciones internas de game.js (init)
let active = false;        // modo construcción
let carry = null;          // objeto en la mano
let hover = null;
let spotSeq = 0;
let navGrid = null, navSig = NaN;
const GX0 = -23, GZ0 = -17, CS = 0.5, NX = 92, NZ = 55, N = NX * NZ;
const S_ = () => API.S;

// =====================================================================
// GRILLA DE NAVEGACIÓN (0,5 m) + A*
// =====================================================================
const NAV_M = 0.3;
const staticMask = new Uint8Array(N);
for (let i = 0; i < N; i++) {
  const cx = GX0 + (i % NX + 0.5) * CS, cz = GZ0 + ((i / NX | 0) + 0.5) * CS;
  if (cz > -9.95 && (Math.abs(cx) > IN_X || cz > IN_Z)) staticMask[i] = 1; // fuera del edificio (salvo la vereda)
}
const cx = i => GX0 + (i % NX + 0.5) * CS, cz = i => GZ0 + ((i / NX | 0) + 0.5) * CS;
function cellOf(x, z) {
  const ix = Math.floor((x - GX0) / CS), iz = Math.floor((z - GZ0) / CS);
  return ix < 0 || iz < 0 || ix >= NX || iz >= NZ ? -1 : iz * NX + ix;
}
function raster(grid, minX, maxX, minZ, maxZ, m) {
  const ix0 = Math.max(0, Math.floor((minX - m - GX0) / CS - 0.5) + 1), ix1 = Math.min(NX - 1, Math.ceil((maxX + m - GX0) / CS - 0.5) - 1);
  const iz0 = Math.max(0, Math.floor((minZ - m - GZ0) / CS - 0.5) + 1), iz1 = Math.min(NZ - 1, Math.ceil((maxZ + m - GZ0) / CS - 0.5) - 1);
  for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) grid[iz * NX + ix] = 1;
}
function colSig() {
  let s = API.colliders.length * 1000.5;
  for (const c of API.colliders) if (c.on()) s += c.minX * 1.37 + c.maxZ * 2.11 + c.maxX * 0.73 + c.minZ * 3.07 + 0.1;
  return s;
}
function ensureNav() {
  const sig = colSig();
  if (navGrid && sig === navSig) return navGrid;
  navSig = sig; navGrid = new Uint8Array(staticMask);
  for (const c of API.colliders) if (c.on()) raster(navGrid, c.minX, c.maxX, c.minZ, c.maxZ, NAV_M);
  return navGrid;
}
function nearestFree(grid, x, z, R, reach) {
  const c0 = cellOf(x, z);
  if (c0 >= 0 && !grid[c0] && (!reach || reach[c0])) return c0;
  let best = -1, bd = Infinity;
  const r = Math.ceil(R / CS), ix0 = Math.floor((x - GX0) / CS), iz0 = Math.floor((z - GZ0) / CS);
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    const ix = ix0 + dx, iz = iz0 + dz; if (ix < 0 || iz < 0 || ix >= NX || iz >= NZ) continue;
    const i = iz * NX + ix; if (grid[i] || (reach && !reach[i])) continue;
    const d = Math.hypot(cx(i) - x, cz(i) - z); if (d <= R && d < bd) { bd = d; best = i; }
  }
  return best;
}
function losGrid(grid, ax, az, bx, bz, skipA, skipB) {
  const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.2);
  for (let k = 1; k < n; k++) {
    const t = k / n, px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
    if (skipA && Math.hypot(px - ax, pz - az) < 0.6) continue;
    if (skipB && Math.hypot(px - bx, pz - bz) < 0.6) continue;
    const c = cellOf(px, pz); if (c < 0 || grid[c]) return false;
  }
  return true;
}
const gS = new Float32Array(N), par = new Int32Array(N), seen = new Uint32Array(N), shut = new Uint32Array(N);
let gen = 0;
function astar(grid, s, goal) {
  gen++;
  const hf = [], hi = [];
  const gx = goal % NX, gz = goal / NX | 0;
  const h = i => { const dx = Math.abs(i % NX - gx), dz = Math.abs((i / NX | 0) - gz); return (dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz)) * CS; };
  const push = (f, i) => { hf.push(f); hi.push(i); let k = hf.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (hf[p] <= hf[k]) break; [hf[p], hf[k]] = [hf[k], hf[p]]; [hi[p], hi[k]] = [hi[k], hi[p]]; k = p; } };
  const pop = () => { const top = hi[0], lf = hf.pop(), li = hi.pop(); if (hf.length) { hf[0] = lf; hi[0] = li; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < hf.length && hf[l] < hf[m]) m = l; if (r < hf.length && hf[r] < hf[m]) m = r; if (m === k) break; [hf[m], hf[k]] = [hf[k], hf[m]]; [hi[m], hi[k]] = [hi[k], hi[m]]; k = m; } } return top; };
  seen[s] = gen; gS[s] = 0; par[s] = -1; push(h(s), s);
  while (hf.length) {
    const i = pop(); if (shut[i] === gen) continue; shut[i] = gen;
    if (i === goal) { const out = []; for (let k = i; k >= 0; k = par[k]) out.push(k); return out.reverse(); }
    const ix = i % NX, iz = i / NX | 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = ix + dx, nz = iz + dz; if (nx < 0 || nz < 0 || nx >= NX || nz >= NZ) continue;
      const j = nz * NX + nx; if (grid[j] || shut[j] === gen) continue;
      if (dx && dz && (grid[iz * NX + nx] || grid[nz * NX + ix])) continue; // sin cortar esquinas
      const ng = gS[i] + (dx && dz ? Math.SQRT2 : 1) * CS;
      if (seen[j] !== gen || ng < gS[j]) { seen[j] = gen; gS[j] = ng; par[j] = i; push(ng + h(j), j); }
    }
  }
  return null;
}
function findPath(ax, az, bx, bz) {
  if (!API) return null;
  const grid = ensureNav();
  if (cellOf(ax, az) < 0 || cellOf(bx, bz) < 0) return null;
  if (losGrid(grid, ax, az, bx, bz, true, true)) return [{ x: bx, z: bz }];
  const s = nearestFree(grid, ax, az, 1.8), g = nearestFree(grid, bx, bz, 1.8);
  if (s < 0 || g < 0) return null;
  const cells = astar(grid, s, g); if (!cells) return null;
  const pts = [{ x: ax, z: az }]; for (const c of cells) pts.push({ x: cx(c), z: cz(c) }); pts.push({ x: bx, z: bz });
  const out = []; let anchor = 0;
  for (let k = anchor + 2; k < pts.length; k++) {
    if (!losGrid(grid, pts[anchor].x, pts[anchor].z, pts[k].x, pts[k].z, anchor === 0, k === pts.length - 1)) { out.push(pts[k - 1]); anchor = k - 1; }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
function flood(grid, sx, sz) {
  const reach = new Uint8Array(N), q = new Int32Array(N);
  const s = nearestFree(grid, sx, sz, 1.5); if (s < 0) return reach;
  let h = 0, t = 0; q[t++] = s; reach[s] = 1;
  while (h < t) {
    const i = q[h++], ix = i % NX, iz = i / NX | 0;
    if (ix > 0 && !grid[i - 1] && !reach[i - 1]) { reach[i - 1] = 1; q[t++] = i - 1; }
    if (ix < NX - 1 && !grid[i + 1] && !reach[i + 1]) { reach[i + 1] = 1; q[t++] = i + 1; }
    if (iz > 0 && !grid[i - NX] && !reach[i - NX]) { reach[i - NX] = 1; q[t++] = i - NX; }
    if (iz < NZ - 1 && !grid[i + NX] && !reach[i + NX]) { reach[i + NX] = 1; q[t++] = i + NX; }
  }
  return reach;
}

// =====================================================================
// LUGARES DINÁMICOS (cada objeto ubicado tiene el suyo)
// =====================================================================
const MACH_W = 0.92, MACH_D = 0.72;
function makeSpot(kind, pose, id) {
  const sid = "p_" + (++spotSeq), rot = pose.rot, zone = zoneAt(pose.x);
  const s = { id: sid, x: pose.x, z: pose.z, rot, zone, marker: { visible: false }, dyn: true };
  if (kind === "machine") {
    const e = rotExt(MACH_W, MACH_D, rot), p = rotXZ(0, -0.85, rot - Math.PI);
    Object.assign(s, { kind: "slot", machine: null, cw: e.ex * 2, cd: e.ez * 2, play: { x: pose.x + p.x, z: pose.z + p.z }, faceY: rot - Math.PI });
  } else if (kind === "table") Object.assign(s, { kind: "tspot", table: null });
  else {
    const f = fpOf(id), e = f.solid ? rotExt(f.w, f.d, rot) : null;
    Object.assign(s, { kind: "dspot", decor: null, cw: e ? e.ex * 2 : 0, cd: e ? e.ez * 2 : 0 });
  }
  API.spotById[sid] = s;
  return s;
}
function dropSpot(s) { if (s && s.dyn && API.spotById[s.id] === s) delete API.spotById[s.id]; }
const defaultDeg = kind => kind === "decor" ? 0 : 180;
// convierte cualquier d (lugar fijo viejo o ubicado) en ubicado con su lugar dinámico
function ensurePlaced(d, kind) {
  const key = kind === "machine" ? "slot" : "spot";
  if (!(isNum(d.x) && isNum(d.z))) {
    const sp = API.spotById[d[key]];
    if (!sp) return false;
    d.x = sp.x; d.z = sp.z;
    if (!isNum(d.rot)) d.rot = sp.rot != null ? degOf(sp.rot) : defaultDeg(kind);
  }
  if (!isNum(d.rot)) d.rot = defaultDeg(kind);
  if (kind === "decor" && fpOf(d.id).mount === "wall") { const p = wallPoseNear(d.x, d.z, 0.6); if (p) { d.x = p.x; d.z = p.z; d.rot = degOf(p.rot); } }
  const s = makeSpot(kind, { x: d.x, z: d.z, rot: radOf(d.rot) }, kind === "decor" ? d.id : d.type);
  d[key] = s.id;
  return true;
}

// =====================================================================
// GUARDADO: sanitize + carga
// =====================================================================
function sanitizePlaced(raw, s) {
  const pose = (d, kind) => {
    if (isNum(d.x) && isNum(d.z)) return { x: clamp(d.x, -IN_X, IN_X), z: clamp(d.z, -IN_Z, IN_Z), rot: isNum(d.rot) ? degOf(radOf(d.rot)) : defaultDeg(kind) };
    const sp = API.spotById[kind === "machine" ? d.slot : d.spot];
    const want = kind === "machine" ? "slot" : kind === "table" ? "tspot" : "dspot";
    if (sp && !sp.dyn && sp.kind === want) return { x: sp.x, z: sp.z, rot: defaultDeg(kind) };
    return null;
  };
  const open = x => !!s.zones[zoneAt(x)];
  const used = new Set(), key = (k, p) => k + "|" + p.x.toFixed(2) + "|" + p.z.toFixed(2);
  const list = (arr, kind, ok, map) => (Array.isArray(arr) ? arr : []).map(d => {
    if (!d || typeof d !== "object" || !ok(d)) return null;
    const p = pose(d, kind); if (!p || !open(p.x)) return null;
    const k = key(kind, p); if (used.has(k)) return null; used.add(k);
    return Object.assign(map(d), { x: p.x, z: p.z, rot: p.rot });
  }).filter(Boolean);
  const MD = id => D.MACHINES.find(m => m.id === id), TD = id => D.TABLES.find(t => t.id === id), DD = id => D.DECOR.find(t => t.id === id);
  s.machines = list(raw.machines, "machine", d => MD(d.type), d => ({ slot: "", type: d.type, box: isNum(d.box) ? clamp(Math.round(d.box), 0, MD(d.type).cap * 2) : 0, rtp: D.RTP_SETTINGS.some(r => r.id === d.rtp) ? d.rtp : "estandar", broken: !!d.broken }));
  s.tables = list(raw.tables, "table", d => TD(d.type), d => ({ spot: "", type: d.type, tray: isNum(d.tray) ? Math.round(d.tray) : 0 }));
  s.decor = list(raw.decor, "decor", d => DD(d.id) && !DD(d.id).unique, d => ({ spot: "", id: d.id }));
  s.room = normRoom(raw.room);
}
function normRoom(r) {
  const out = {};
  for (const z of D.ZONES) {
    const v = r && typeof r === "object" && r[z.id] && typeof r[z.id] === "object" ? r[z.id] : {};
    out[z.id] = { carpet: CARPETS.some(c => c.id === v.carpet) ? v.carpet : "clasica", wall: WALLS.some(c => c.id === v.wall) ? v.wall : "bordo" };
  }
  return out;
}
function beforeLoad(S) {
  for (const k of Object.keys(API.spotById)) if (API.spotById[k].dyn) delete API.spotById[k];
  carry = null; hover = null; if (active) setActive(false, true);
  markSig = NaN; // al recargar, los colliders pueden quedar iguales: recalcular qué cuadros dorados se ven
  S.room = normRoom(S.room);
  S.machines = S.machines.filter(d => ensurePlaced(d, "machine"));
  S.tables = S.tables.filter(d => ensurePlaced(d, "table"));
  S.decor = S.decor.filter(d => ensurePlaced(d, "decor"));
  roomKey = "";
}
function extraAtr() {
  const S = API && API.S; if (!S || !S.room) return 0;
  let a = 0;
  for (const z in S.room) if (S.zones[z]) a += CARPET(S.room[z].carpet).atr + WALLC(S.room[z].wall).atr;
  return a;
}

// =====================================================================
// OBJETOS: huellas, cajas, puntos de acceso
// =====================================================================
const tableProto = {};
function tableLayout(type) {
  if (!tableProto[type]) {
    const A = window.CasinoArt;
    const custom = (D.TABLES.find(t => t.id === type) || {}).custom; // games.js: la huella no necesita el modelo
    const g = type === "blackjack" ? A.makeBlackjackTable({ stools: true }) : type === "ruleta" || custom ? null : API.makePokerTable(D.TABLES.find(t => t.id === "poker").color);
    tableProto[type] = API.TABLE_LAYOUT[type](g);
  }
  return tableProto[type];
}
// rectángulo sólido en el piso (o el visual para alfombras); null si va en pared/techo
function footRect(kind, id, pose) {
  if (kind === "shelf") { const F = SHOP().shelfDims(id), e = rotExt(F.w, F.d, pose.rot); return { minX: pose.x - e.ex, maxX: pose.x + e.ex, minZ: pose.z - e.ez, maxZ: pose.z + e.ez, solid: true }; }
  if (kind === "machine") { const e = rotExt(MACH_W, MACH_D, pose.rot); return { minX: pose.x - e.ex, maxX: pose.x + e.ex, minZ: pose.z - e.ez, maxZ: pose.z + e.ez, solid: true }; }
  if (kind === "table") {
    const b = tableLayout(id).box, pts = [[b[0], b[2]], [b[1], b[2]], [b[0], b[3]], [b[1], b[3]]].map(p => rotXZ(p[0], p[1], pose.rot));
    return { minX: pose.x + Math.min(...pts.map(p => p.x)), maxX: pose.x + Math.max(...pts.map(p => p.x)), minZ: pose.z + Math.min(...pts.map(p => p.z)), maxZ: pose.z + Math.max(...pts.map(p => p.z)), solid: true };
  }
  const f = fpOf(id); if (f.mount) return null;
  const e = rotExt(f.w, f.d, pose.rot);
  return { minX: pose.x - e.ex, maxX: pose.x + e.ex, minZ: pose.z - e.ez, maxZ: pose.z + e.ez, solid: !!f.solid };
}
function accessOf(kind, id, pose, name) {
  if (kind === "shelf") { const F = SHOP().shelfDims(id); return [{ x: pose.x + Math.sin(pose.rot) * F.front, z: pose.z + Math.cos(pose.rot) * F.front, r: 0.6, label: name, shelf: true }]; }
  if (kind === "machine") { const p = rotXZ(0, -0.85, pose.rot - Math.PI); return [{ x: pose.x + p.x, z: pose.z + p.z, r: 0.6, label: name }]; }
  if (kind === "table") {
    const L = tableLayout(id), def = D.TABLES.find(t => t.id === id), W = (lx, lz) => { const p = rotXZ(lx, lz, pose.rot); return { x: pose.x + p.x, z: pose.z + p.z }; };
    const out = [Object.assign(W(L.dealer.x, L.dealer.z), { r: 0.9, label: name })];
    for (const s of L.seats.slice(0, def.seats)) out.push(Object.assign(W(s.x, s.z), { r: 0.9, label: name, seat: true }));
    return out;
  }
  return [];
}
function objects() {
  const out = [];
  for (const m of API.machines) out.push({ kind: "machine", obj: m, d: m.d, spot: m.slot, id: m.d.type, def: m.def, name: m.def.name, price: m.def.price, group: m.group, collider: m.collider });
  for (const t of API.tables) out.push({ kind: "table", obj: t, d: t.d, spot: t.spot, id: t.d.type, def: t.def, name: t.def.name, price: t.def.price, group: t.group, collider: t.collider });
  for (const o of API.decorObjs) out.push({ kind: "decor", obj: o, d: o.d, spot: o.spot, id: o.d.id, def: o.def, name: o.def.name, price: o.def.price, group: o.group, collider: o.collider });
  if (SHOP() && SHOP().shelves) for (const u of SHOP().shelves()) out.push({ kind: "shelf", obj: u, d: u, spot: u, id: u.shelf, def: Object.assign({}, SHOP().furnDef(u.shelf), { name: SHOP().shelfName(u.shelf) }), name: SHOP().shelfName(u.shelf), price: 0, group: u.g, collider: u.col });
  return out;
}
function poseOf(o) { return { x: o.spot.x, z: o.spot.z, rot: o.spot.rot != null ? o.spot.rot : (o.kind === "decor" ? 0 : Math.PI) }; }
function boxOf(kind, id, pose) {
  if (kind === "decor") {
    const f = fpOf(id);
    if (f.mount === "wall") { const a = rotXZ(f.w / 2, 0, pose.rot), n = rotXZ(0, 0.15, pose.rot); return { minX: Math.min(pose.x - a.x, pose.x + a.x + n.x, pose.x + a.x, pose.x - a.x + n.x) - 0.02, maxX: Math.max(pose.x - a.x, pose.x + a.x + n.x, pose.x + a.x, pose.x - a.x + n.x) + 0.02, minZ: Math.min(pose.z - a.z, pose.z + a.z + n.z, pose.z + a.z, pose.z - a.z + n.z) - 0.02, maxZ: Math.max(pose.z - a.z, pose.z + a.z + n.z, pose.z + a.z, pose.z - a.z + n.z) + 0.02, minY: f.y - f.h / 2 - 0.08, maxY: f.y + f.h / 2 + 0.08 }; }
    if (f.mount === "ceil") return { minX: pose.x - 0.6, maxX: pose.x + 0.6, minZ: pose.z - 0.6, maxZ: pose.z + 0.6, minY: WALL_H - 1.15, maxY: WALL_H };
    const r = footRect(kind, id, pose); return Object.assign(r, { minY: 0, maxY: f.rug ? 0.06 : f.h || 1.6 });
  }
  const r = footRect(kind, id, pose); return Object.assign(r, { minY: 0, maxY: kind === "machine" ? 2.1 : kind === "shelf" ? SHOP().shelfDims(id).h : 1.1 });
}
const overlap = (a, b, g) => a.minX < b.maxX + g && a.maxX > b.minX - g && a.minZ < b.maxZ + g && a.maxZ > b.minZ - g;
const inRect = (p, r, m) => p.x > r.minX - m && p.x < r.maxX + m && p.z > r.minZ - m && p.z < r.maxZ + m;

// paredes donde se cuelgan cuadros y neones (según zonas abiertas)
function wallFaces() {
  const S = S_(), z = S.zones, faces = [];
  const merge = (list) => { list.sort((a, b) => a[0] - b[0]); const out = []; for (const iv of list) { const l = out[out.length - 1]; if (l && iv[0] <= l[1] + 1e-6) l[1] = Math.max(l[1], iv[1]); else out.push(iv.slice()); } return out; };
  const back = [], front = [];
  if (z.oeste) { back.push([-IN_X, -10]); front.push([-IN_X, -10]); }
  back.push([-10, 10]); front.push([-10, -3.4], [3.4, 10]);
  if (z.este) { back.push([10, IN_X]); front.push([10, IN_X]); }
  for (const iv of merge(back)) faces.push({ axis: "z", c: IN_Z, n: -1, rot: Math.PI, lo: iv[0], hi: iv[1] });
  for (const iv of merge(front)) faces.push({ axis: "z", c: -IN_Z, n: 1, rot: 0, lo: iv[0], hi: iv[1] });
  if (z.este) faces.push({ axis: "x", c: IN_X, n: -1, rot: -HALF, lo: -IN_Z, hi: IN_Z });
  if (z.oeste) faces.push({ axis: "x", c: -IN_X, n: 1, rot: HALF, lo: -IN_Z, hi: IN_Z });
  return faces;
}
function faceOfPose(p) {
  for (const f of wallFaces()) {
    const c = f.axis === "z" ? p.z : p.x, a = f.axis === "z" ? p.x : p.z;
    if (Math.abs(c - f.c) < 0.05 && a >= f.lo - 1e-6 && a <= f.hi + 1e-6) return f;
  }
  return null;
}
function wallPoseNear(x, z, maxD) {
  let best = null, bd = maxD;
  for (const f of wallFaces()) {
    const c = f.axis === "z" ? z : x, a = clamp(f.axis === "z" ? x : z, f.lo, f.hi), d = Math.abs(c - f.c);
    if (d < bd) { bd = d; best = f.axis === "z" ? { x: a, z: f.c, rot: f.rot } : { x: f.c, z: a, rot: f.rot }; }
  }
  return best;
}

// =====================================================================
// VALIDACIÓN
// =====================================================================
const ENTRANCE = { minX: -3, maxX: 3, minZ: -9.9, maxZ: -5.6 };
const BAR_AREA = { minX: 6.6, maxX: 10, minZ: -9.9, maxZ: -7.3 };
const CEIL_FIXED = [[0, 2.5], [-6, -4], [6, -4], [16, -3], [-16.5, -3]];
function zonesOk(r) {
  const z = S_().zones;
  if (r.minX < -10 + 1e-6 && !z.oeste) return "Esa parte es del Salón VIP: todavía no la compraste.";
  if (r.maxX > 10 - 1e-6 && !z.este) return "Esa parte es del Ala Este: todavía no la compraste.";
  return null;
}
const SHOP = () => window.CasinoShop || null; // tienda (shop.js): lo nuevo llega en cajas ya pagadas
function existingAccess(src) {
  const pts = [];
  for (const m of API.machines) if (!src || src.obj !== m) pts.push({ x: m.slot.play.x, z: m.slot.play.z, r: 0.6, label: m.def.name });
  for (const t of API.tables) if (!src || src.obj !== t) { pts.push({ x: t.dealerSpot.x, z: t.dealerSpot.z, r: 0.9, label: t.def.name }); for (const s of t.seats) pts.push({ x: s.x, z: s.z, r: 0.9, label: t.def.name, seat: true }); }
  pts.push({ x: API.SAFE.win.x, z: API.SAFE.win.z, r: 0.9, label: "la caja fuerte" });
  if (S_().bar) pts.push({ x: API.BAR.pickup.x, z: API.BAR.pickup.z, r: 0.9, label: "la barra" });
  if (SHOP()) for (const a of SHOP().access(src && src.kind === "shelf" ? src.obj : null)) pts.push(a); // caja registradora, góndolas y compu
  return pts;
}
function validate(kind, id, pose, src, opt) {
  const S = S_(), def = defOf(kind, id);
  if (!def) return { ok: false, reason: "Objeto desconocido." };
  if (kind === "decor") {
    const f = fpOf(id);
    if (f.mount === "wall") {
      const face = faceOfPose(pose);
      if (!face) return { ok: false, reason: "Apuntá a una pared del local." };
      const a = face.axis === "z" ? pose.x : pose.z;
      if (a - f.w / 2 < face.lo - 1e-6 || a + f.w / 2 > face.hi + 1e-6) return { ok: false, reason: "No entra en esa pared." };
      for (const o of objects()) {
        if (o.kind !== "decor" || (src && src.obj === o.obj)) continue;
        const of = fpOf(o.id); if (of.mount !== "wall") continue;
        const p = poseOf(o), fc = faceOfPose(p);
        if (!fc || fc.axis !== face.axis || Math.abs(fc.c - face.c) > 0.05) continue;
        const b = face.axis === "z" ? p.x : p.z;
        if (Math.abs(b - a) < (f.w + of.w) / 2 + 0.1) return { ok: false, reason: `Se encima con ${o.name}.` };
      }
      return { ok: true };
    }
    if (f.mount === "ceil") {
      if (Math.abs(pose.x) > IN_X - 0.6 || Math.abs(pose.z) > IN_Z - 0.6) return { ok: false, reason: "Tiene que quedar adentro del local." };
      const zr = zonesOk({ minX: pose.x - 0.6, maxX: pose.x + 0.6 }); if (zr) return { ok: false, reason: zr };
      for (const c of CEIL_FIXED) if (Math.hypot(c[0] - pose.x, c[1] - pose.z) < 1.4) return { ok: false, reason: "Ya hay una araña ahí." };
      for (const o of objects()) if (o.kind === "decor" && fpOf(o.id).mount === "ceil" && !(src && src.obj === o.obj) && Math.hypot(o.spot.x - pose.x, o.spot.z - pose.z) < 1.4) return { ok: false, reason: "Ya hay una araña ahí." };
      return { ok: true };
    }
  }
  const r = footRect(kind, id, pose);
  if (r.minX < -IN_X || r.maxX > IN_X || r.minZ < -IN_Z || r.maxZ > IN_Z) return { ok: false, reason: "Tiene que quedar adentro del local." };
  const zr = zonesOk(r); if (zr) return { ok: false, reason: zr };
  if (!r.solid) return { ok: true }; // alfombras: van en cualquier lado
  if (overlap(r, ENTRANCE, 0)) return { ok: false, reason: "Dejá libre la entrada y la fila." };
  if (!S.bar && overlap(r, BAR_AREA, 0)) return { ok: false, reason: "Ese lugar está reservado para la Barra." };
  if (SHOP()) for (const z of SHOP().reserved()) if (overlap(r, z, 0)) return { ok: false, reason: z.why };
  for (const c of API.colliders) {
    if (!c.on() || !overlap(r, c, 0.04)) continue;
    const k = c.kind;
    return { ok: false, reason: k === "wall" || k === "zonewall" ? "Choca con una pared." : k === "cage" ? "Choca con la caja fuerte." : k === "bar" ? "Choca con la barra." : k === "shop" ? "Choca con el kiosco." : "Choca con otro objeto." };
  }
  const P = API.player;
  if (!(opt && opt.ignorePlayer) && inRect(P, r, 0.38)) return { ok: false, reason: "Estás parado ahí: correte un poco." };
  const own = accessOf(kind, id, pose, def.name);
  for (const p of own) {
    const front = kind === "shelf" ? "Dejá lugar adelante para pararte a reponer." : "No queda lugar adelante para jugar.";
    if (Math.abs(p.x) > IN_X - 0.2 || Math.abs(p.z) > IN_Z - 0.2) return { ok: false, reason: front };
    for (const c of API.colliders) if (c.on() && inRect(p, c, p.seat ? 0.02 : 0.12)) return { ok: false, reason: front };
    if (zoneAt(p.x) !== "principal" && !S.zones[zoneAt(p.x)]) return { ok: false, reason: front };
  }
  const ex = existingAccess(src);
  for (const p of ex) if (inRect(p, r, p.seat ? 0.05 : 0.15)) return { ok: false, reason: `Tapa el lugar de ${p.label}.` };
  // ¿se puede llegar a todo desde la puerta?
  const base = ensureNav(), grid = new Uint8Array(base); raster(grid, r.minX, r.maxX, r.minZ, r.maxZ, NAV_M);
  const reach = flood(grid, 0, -12), reach0 = flood(base, 0, -12);
  for (const p of own) if (nearestFree(grid, p.x, p.z, p.r, reach) < 0) return { ok: false, reason: kind === "shelf" ? "Así nadie puede llegar a la góndola." : "Así nadie puede llegar a jugar acá." };
  // solo cuenta lo que este objeto corta: si algo ya estaba tapado antes (partidas viejas), no es culpa del objeto nuevo
  for (const p of ex) if (nearestFree(grid, p.x, p.z, p.r, reach) < 0 && nearestFree(base, p.x, p.z, p.r, reach0) >= 0) return { ok: false, reason: `Le cerrás el paso a ${p.label}.` };
  if (!(opt && opt.ignorePlayer) && nearestFree(grid, P.x, P.z, 1.0, reach) < 0) return { ok: false, reason: "Te quedarías encerrado." };
  return { ok: true };
}

// =====================================================================
// COMPRAR, MOVER, VENDER
// =====================================================================
function repathAgents() {
  for (const a of API.customers.concat(API.staffNpcs)) if (a.path && a.path.length && a.goal && !a.dead) a.path = API.findPath(a.x, a.z, a.goal.x, a.goal.z);
}
function afterChange() { repathAgents(); markSig = NaN; API.save(true); API.updateHud(true); }
function setPose(d, pose) { d.x = Math.round(pose.x * 100) / 100; d.z = Math.round(pose.z * 100) / 100; d.rot = degOf(pose.rot); }
function defOf(kind, id) { return kind === "shelf" ? (SHOP() && SHOP().furnDef(id)) : kind === "machine" ? D.MACHINES.find(m => m.id === id) : kind === "table" ? D.TABLES.find(t => t.id === id) : D.DECOR.find(t => t.id === id); }
function canBuy(kind, def, pp) {
  const S = S_();
  if (pp) return null; // ya pagado en la compu (shop.js): el tope de juegos se controló al pedir
  if (S.rank < def.rank) return `Necesitás rango ${def.rank}.`;
  if (kind !== "decor" && API.gamesCount() >= API.Rank.maxGames()) return `Tu rango permite ${API.Rank.maxGames()} juegos.`;
  if (S.bank < def.price) return `No te alcanza: cuesta ${API.fmt(def.price)}.`;
  return null;
}
function buyPlaced(kind, id, pose, atMarker, pp) {
  const S = S_(), def = defOf(kind, id); if (!def) return false;
  const why = canBuy(kind, def, pp); if (why) { API.toast(why, "bad"); API.SFX.bad(); return false; }
  const v = validate(kind, id, pose, null, { ignorePlayer: !!atMarker }); if (!v.ok) { API.toast(v.reason, "bad"); API.SFX.bad(); return false; }
  if (!pp && !API.Economy.trySpend(kind === "decor" ? "decor" : "purchases", def.price)) return false;
  if (kind === "machine") {
    const d = { slot: "", type: id, box: 0, rtp: "estandar", broken: false }; setPose(d, pose);
    d.slot = makeSpot("machine", pose, id).id; S.machines.push(d); API.spawnMachine(d);
    API.Rank.add(D.XP.buyGame); API.toast(`${pp ? "Instalaste" : "Compraste"} una ${def.name}.`, "good");
  } else if (kind === "table") {
    const d = { spot: "", type: id, tray: 0 }; setPose(d, pose);
    d.spot = makeSpot("table", pose, id).id; S.tables.push(d); API.spawnTable(d); API.assignDealers();
    API.Rank.add(D.XP.buyGame); API.toast(`Instalaste una ${def.name}.${S.staff.dealer ? "" : " Necesita croupier: contratalo o parate vos en el cuadro dorado."}`, "good");
  } else if (kind === "shelf") {
    if (!SHOP().addShelf(id, { x: pose.x, z: pose.z, rot: pose.rot })) { API.toast("No entra otra góndola de ese tipo.", "bad"); return false; }
    API.toast(`Instalaste: ${def.name}. Ahora el stock de ese lado tiene más capacidad.`, "good");
  } else {
    const d = { spot: "", id }; setPose(d, pose);
    d.spot = makeSpot("decor", pose, id).id; S.decor.push(d); API.spawnDecor(d);
    API.toast(`Pusiste: ${def.name} (+${def.atr} de atractivo).`, "good");
  }
  if (atMarker) API.unstickPlayer(pose.x, pose.z - 1.5); // como en v2: si estabas parado en el cuadro, te corre
  if (pp && pp.onPlaced) pp.onPlaced();
  API.SFX.coin(); afterChange(); return true;
}
function freeUsers(o) {
  const rest = c => { if (!c || c.dead) return; c.machine = null; c.table = null; c.seat = null; c.state = "choose"; c.path = null; if (c.person) c.person.api.stand(); };
  if (o.kind === "machine" && o.obj.user) { const c = o.obj.user; o.obj.user = null; rest(c); }
  if (o.kind === "table") for (const s of o.obj.seats) if (s.c) { const c = s.c; s.c = null; rest(c); }
}
function moveObject(o, pose) {
  const S = S_(), oldSpot = o.spot;
  liftRestore(o);
  freeUsers(o);
  if (o.kind === "machine") {
    const m = o.obj, d = m.d; API.despawnMachine(m); setPose(d, pose); d.slot = makeSpot("machine", pose, d.type).id;
    const nm = API.spawnMachine(d), insp = API.inspector;
    if (insp && insp.visits) insp.visits = insp.visits.map(x => x === m ? nm : x);
  } else if (o.kind === "table") {
    const t = o.obj, d = t.d; API.despawnTable(t); setPose(d, pose); d.spot = makeSpot("table", pose, d.type).id; API.spawnTable(d); API.assignDealers();
  } else if (o.kind === "shelf") {
    SHOP().moveShelf(o.obj, pose);
  } else {
    const x = o.obj, d = x.d; API.despawnDecor(x); setPose(d, pose); d.spot = makeSpot("decor", pose, d.id).id; API.spawnDecor(d);
  }
  dropSpot(oldSpot);
  void S; API.SFX.tick(); afterChange();
}
function sellObject(o) {
  if (o.kind === "shelf") return; // las góndolas no se venden
  const S = S_(), refund = Math.round(o.price * D.CFG.sellRefund);
  liftRestore(o);
  const spot = o.spot;
  if (o.kind === "machine") API.sellMachine(o.obj);
  else if (o.kind === "table") API.sellTable(o.obj);
  else {
    API.Economy.add("sales", refund);
    S.decor.splice(S.decor.indexOf(o.d), 1); API.despawnDecor(o.obj); API.save(true);
    API.toast(`Vendiste: ${o.name} por ${API.fmt(refund)}.`, "good");
  }
  dropSpot(spot); afterChange();
}
// mientras lo llevás en la mano: escondido y sin colisión
function liftHide(o) {
  o.group.visible = false; if (o.obj.pad) o.obj.pad.visible = false;
  const c = o.collider; if (c && !c._on) { c._on = c.on; c.on = () => false; }
}
function liftRestore(o) {
  if (!o) return;
  o.group.visible = true;
  const c = o.collider; if (c && c._on) { c.on = c._on; delete c._on; }
}

// =====================================================================
// FANTASMA Y RESALTADO
// =====================================================================
let ghostMat = null, footMat = null, footMesh = null, hl = null;
function ensureFx() {
  if (ghostMat) return;
  ghostMat = new T.MeshBasicMaterial({ color: 0x49e07a, transparent: true, opacity: 0.42, depthWrite: false });
  footMat = new T.MeshBasicMaterial({ color: 0x49e07a, transparent: true, opacity: 0.32, depthWrite: false, side: T.DoubleSide });
  footMesh = new T.Mesh(new T.PlaneGeometry(1, 1), footMat); footMesh.rotation.x = -HALF; footMesh.position.y = 0.035; footMesh.visible = false; footMesh.renderOrder = 5; API.scene.add(footMesh);
  hl = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1, 1, 1)), new T.LineBasicMaterial({ color: 0xf6c766 })); hl.visible = false; API.scene.add(hl);
}
function buildGhost(kind, id) {
  const A = window.CasinoArt, def = defOf(kind, id);
  let g;
  if (kind === "machine") g = A.makeSlotMachine({ color: def.color, name: def.name, model: def.id, stool: true });
  else if (kind === "table") g = def.custom && window.CasinoGames ? window.CasinoGames.makeModel(id) : id === "blackjack" ? A.makeBlackjackTable({ stools: true }) : id === "ruleta" ? A.makeRouletteTable() : API.makePokerTable(def.color);
  else if (kind === "shelf") g = SHOP().shelfGhost(id);
  else g = API.makeDecor(id);
  g.traverse(o => { if (o.isMesh) { o.material = ghostMat; o.renderOrder = 4; } else if (o.isSprite || o.isLight) o.visible = false; });
  API.scene.add(g);
  return g;
}
function dropGhost() { if (carry && carry.ghost) { API.scene.remove(carry.ghost); carry.ghost = null; } if (footMesh) footMesh.visible = false; }

// =====================================================================
// MIRA: punto del piso / pared / objeto
// =====================================================================
function viewRay() {
  const P = API.player, cp = Math.cos(P.pitch);
  return { o: { x: P.x, y: 1.65, z: P.z }, d: { x: -Math.sin(P.yaw) * cp, y: Math.sin(P.pitch), z: -Math.cos(P.yaw) * cp } };
}
function floorPoint() {
  const { o, d } = viewRay(), hl2 = Math.hypot(d.x, d.z) || 1;
  let h = 4;
  if (d.y < -0.05) h = Math.min(7, o.y / -d.y * hl2);
  h = Math.max(1.4, h);
  return { x: o.x + d.x / hl2 * h, z: o.z + d.z / hl2 * h };
}
function wallHit() {
  const { o, d } = viewRay(); let best = null, bt = 9;
  for (const f of wallFaces()) {
    const dc = f.axis === "z" ? d.z : d.x, oc = f.axis === "z" ? o.z : o.x;
    if (dc * f.n >= -1e-4) continue;
    const t = (f.c - oc) / dc; if (t <= 0 || t >= bt) continue;
    const y = o.y + d.y * t, a = (f.axis === "z" ? o.x + d.x * t : o.z + d.z * t);
    if (y < 0.6 || y > 3.4 || a < f.lo || a > f.hi) continue;
    bt = t; best = { f, a };
  }
  return best;
}
function rayBox(o, d, b) {
  let t0 = 0, t1 = 9;
  for (const [oo, dd, lo, hi] of [[o.x, d.x, b.minX, b.maxX], [o.y, d.y, b.minY, b.maxY], [o.z, d.z, b.minZ, b.maxZ]]) {
    if (Math.abs(dd) < 1e-9) { if (oo < lo || oo > hi) return -1; continue; }
    let a = (lo - oo) / dd, c = (hi - oo) / dd; if (a > c) { const t = a; a = c; c = t; }
    if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) return -1;
  }
  return t0;
}
function pickObject() {
  const { o, d } = viewRay(); let best = null, bt = 9;
  for (const ob of objects()) {
    if (ob.kind === "decor" && fpOf(ob.id).rug) continue;
    const t = rayBox(o, d, boxOf(ob.kind, ob.id, poseOf(ob))); if (t >= 0 && t < bt) { bt = t; best = ob; }
  }
  if (!best) { // alfombras, si no hay otra cosa
    for (const ob of objects()) if (ob.kind === "decor" && fpOf(ob.id).rug) { const t = rayBox(o, d, boxOf(ob.kind, ob.id, poseOf(ob))); if (t >= 0 && t < bt) { bt = t; best = ob; } }
  }
  return best;
}
function aimPose() {
  const c = carry, f = c.kind === "decor" ? fpOf(c.id) : null;
  if (f && f.mount === "wall") {
    const w = wallHit();
    if (w) { const a = snap(w.a, 0.25); return w.f.axis === "z" ? { x: a, z: w.f.c, rot: w.f.rot } : { x: w.f.c, z: a, rot: w.f.rot }; }
    const p = floorPoint(), q = wallPoseNear(p.x, p.z, 3);
    if (q) { if (Math.abs(q.z) > 9) q.x = snap(q.x, 0.25); else q.z = snap(q.z, 0.25); return q; }
    return { x: p.x, z: p.z, rot: 0, nowall: true };
  }
  const p = floorPoint();
  if (API.player.z > -10) { p.x = clamp(p.x, -IN_X + 0.4, IN_X - 0.4); p.z = clamp(p.z, -IN_Z + 0.4, IN_Z - 0.4); }
  const x = snap(p.x, 0.5), z = snap(p.z, 0.5);
  if (c.autoRot) { const P = API.player; c.rot = normRot(snap(Math.atan2(P.x - x, P.z - z), HALF)); }
  return { x, z, rot: c.rot };
}

// =====================================================================
// MODO CONSTRUCCIÓN
// =====================================================================
let bar = null, infoEl = null, placeBtn = null, buildBtn = null, topBtn = null, lastInfo = "", lastPoseKey = "";
function setActive(on, quiet) {
  if (on === active) return;
  if (on) {
    const S = S_();
    if (!API.started || API.ui.panel || !S || S.gameOver) return;
    active = true; ensureFx();
    document.body.classList.add("building"); bar.hidden = false; placeBtn.hidden = !API.isTouch;
    if (API.player.pitch > -0.3) API.player.pitch = -0.42;
    API.hint("build1", API.isTouch ? "Modo construcción: el tiempo se pausa. Apuntá a un objeto y tocá Levantar para moverlo, o abrí el Catálogo." : "Modo construcción: el tiempo se pausa. Mirá un objeto y E para levantarlo, R para girar, X para vender, C para el catálogo, B para salir.");
  } else {
    if (carry) cancelCarry();
    active = false; hover = null;
    document.body.classList.remove("building"); if (bar) bar.hidden = true; if (placeBtn) placeBtn.hidden = true;
    if (hl) hl.visible = false;
    if (!quiet && API.S) API.updateHud(true);
  }
  lastInfo = ""; refreshBar();
}
function toggle() { setActive(!active); }
function pickUp(o) {
  if (!o) return;
  carry = { isNew: false, kind: o.kind, id: o.id, def: o.def, src: o, rot: poseOf(o).rot, ghost: null, pose: null, v: null };
  liftHide(o); carry.ghost = buildGhost(o.kind, o.id); lastPoseKey = "";
  API.SFX.tick();
}
function startNew(kind, id, pp) {
  const def = defOf(kind, id); if (!def) return false;
  const why = canBuy(kind, def, pp); if (why) { API.toast(why, "bad"); return false; }
  const wasActive = active;
  if (!active) setActive(true);
  if (!active) return false;
  if (carry) cancelCarry();
  const P = API.player, fp = floorPoint();
  let rot = normRot(snap(Math.atan2(P.x - fp.x, P.z - fp.z), HALF));
  if (kind === "decor") rot = 0;
  carry = { isNew: true, kind, id, def, src: null, rot, autoRot: kind !== "decor", ghost: buildGhost(kind, id), pose: null, v: null, pp: pp || null };
  if (pp) pp.autoExit = !wasActive; // abriste la caja fuera del modo construcción: al poner o cancelar, volvés
  lastPoseKey = ""; refreshBar();
  return true;
}
function cancelCarry() {
  if (!carry) return;
  if (carry.src) liftRestore(carry.src);
  const pp = carry.pp;
  dropGhost(); carry = null; lastInfo = ""; refreshBar();
  if (pp) { if (pp.onCancel) pp.onCancel(); if (pp.autoExit && active) setActive(false); }
}
function primary() {
  if (!active || API.ui.panel) return;
  if (!carry) { const o = hover || pickObject(); if (o) pickUp(o); else API.toast(API.isTouch ? "Apuntá a una máquina, mesa o decoración para levantarla." : "Mirá una máquina, mesa o decoración para levantarla (E).", ""); refreshBar(); return; }
  const pose = carry.pose || aimPose(), v = validate(carry.kind, carry.id, pose, carry.src);
  if (!v.ok) { API.toast(v.reason, "bad"); API.SFX.bad(); return; }
  if (carry.isNew && carry.pp) { // caja de la compu: ya pagada
    const k = carry.kind, id = carry.id, pp = carry.pp;
    if (!buyPlaced(k, id, pose, false, pp)) return; // sigue con el fantasma en la mano
    dropGhost(); carry = null; lastInfo = ""; refreshBar();
    if (pp.autoExit && active) setActive(false);
    return;
  }
  if (carry.isNew) { const k = carry.kind, id = carry.id; dropGhost(); carry = null; buyPlaced(k, id, pose); }
  else { const o = carry.src; dropGhost(); carry = null; moveObject(o, pose); }
  lastInfo = ""; refreshBar();
}
function rotate(step) {
  if (!carry) { API.toast("Primero levantá algo.", ""); return; }
  const f = carry.kind === "decor" ? fpOf(carry.id) : null;
  if (f && f.mount === "wall") { API.toast("Los cuadros y neones van derechos contra la pared.", ""); return; }
  if ((carry.kind === "table" || carry.kind === "shelf") && step < HALF) { API.toast(carry.kind === "shelf" ? "Las góndolas giran de a 90°." : "Las mesas giran de a 90°.", ""); step = HALF; }
  carry.autoRot = false; carry.rot = normRot(snap(carry.rot + step, Q)); lastPoseKey = ""; API.SFX.tick();
}
function askSell() {
  if (!active) return;
  const o = carry && carry.src ? carry.src : carry ? null : (hover || pickObject());
  if (!o) { API.toast(carry ? "Esto todavía no es tuyo: cancelá con Q." : "Mirá el objeto que querés vender.", ""); return; }
  openSellPanel(o);
}
function openSellPanel(o) {
  if (o.kind === "shelf") { API.toast("Las góndolas no se venden: movelas donde quieras.", ""); return; }
  const refund = Math.round(o.price * D.CFG.sellRefund);
  const extra = o.kind === "machine" && o.d.box > 0 ? ` La plata de la caja (${API.fmt(o.d.box)}) pasa al banco.` : o.kind === "table" && o.d.tray ? " La bandeja de hoy pasa al banco." : "";
  sellCtx = o;
  API.openPanel("buildsell", `<h2>¿Vender?</h2><p>${esc(o.name)}: te devuelven <b class="num">${API.fmt(refund)}</b> (50% de ${API.fmt(o.price)}).${extra}</p>
    <div class="actions"><button class="ghost" data-act="close">No</button><button class="danger" data-bact="sellYes">Sí, vender</button></div>`);
}
let sellCtx = null;
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

// panel de objeto de decoración (fuera del modo construcción)
function decorInfo(o) {
  const ob = objects().find(x => x.obj === o); if (!ob) return;
  const refund = Math.round(ob.price * D.CFG.sellRefund);
  infoCtx = ob;
  API.openPanel("buildinfo", `<h2>${esc(ob.name)}</h2><p>+${ob.def.atr} de atractivo · atractivo del casino <b class="num">${Math.round(API.attractiveness())}</b>.</p>
    <p>En el modo construcción (${API.isTouch ? "botón Construir" : "tecla B"}) podés mover, girar y vender todo lo que tenés.</p>
    <div class="actions"><button class="ghost" data-bact="infoSell">Vender (${API.fmt(refund)})</button><button data-bact="infoMove">Mover</button></div>`);
}
let infoCtx = null;

// =====================================================================
// CATÁLOGO Y AMBIENTES
// =====================================================================
let catTab = "maquinas", catMarker = null, roomZone = "principal";
const sw = css => `<span class="sw" style="background:${css}"></span>`;
const hex = n => "#" + (n >>> 0).toString(16).padStart(6, "0");
function lockTag(l) { return `<span class="tag lock">Rango ${l}</span>`; }
function openCatalog(tab, marker) {
  if (tab) catTab = tab;
  catMarker = marker || null;
  const S = S_(), full = API.gamesCount() >= API.Rank.maxGames();
  const tabs = catMarker ? [] : [["maquinas", "Máquinas"], ["mesas", "Mesas"], ["deco", "Decoración"], ["ambiente", "Ambientes"]];
  const head = tabs.length ? `<div class="tabs">${tabs.map(([id, n]) => `<button data-bact="tab" data-id="${id}" class="${catTab === id ? "on" : ""}">${n}</button>`).join("")}</div>` : "";
  const verb = catMarker ? "Poner acá" : "Elegir";
  if (SHOP() && catTab !== "ambiente") { // con la tienda, lo nuevo se pide en la compu y llega en caja
    API.openPanel("build", `<h2>Catálogo</h2>${head}<div class="note">Las máquinas, mesas y decoración nuevas se piden en la <b>compu de la oficina</b> (a la derecha de la entrada). Llegan en camión, traés la caja y al abrirla elegís el lugar acá mismo.</div>
      <p>En el modo construcción podés mover, girar y vender lo que ya tenés, y cambiar alfombras y paredes en «Ambientes».</p><div class="actions"><button class="ghost" data-act="close">Cerrar</button></div>`);
    return;
  }
  const row = (kind, d, sub, col) => {
    const locked = S.rank < d.rank, games = kind !== "decor" && full;
    return `<div class="item${locked ? " locked" : ""}">${sw(col)}<div class="t"><b>${esc(d.name)} · <span class="num">${API.fmt(d.price)}</span>${locked ? lockTag(d.rank) : ""}</b><span>${sub}</span></div>
      <div class="btns"><button data-bact="pick" data-kind="${kind}" data-id="${d.id}" ${locked || games || S.bank < d.price ? "disabled" : ""}>${verb}</button></div></div>`;
  };
  let body = "";
  const line = `<p>Banco <b class="num">${API.fmt(S.bank)}</b> · juegos <b class="num">${API.gamesCount()}/${API.Rank.maxGames()}</b> · atractivo <b class="num">${Math.round(API.attractiveness())}</b></p>`;
  if (catTab === "maquinas") body = line + (full ? `<div class="warn">Tu rango permite ${API.Rank.maxGames()} juegos.</div>` : "") + `<div class="list">${D.MACHINES.map(d => row("machine", d, `Apuesta ${API.fmt(d.bet)} · caja ${API.fmt(d.cap)} · atractivo ${d.appeal}. ${esc(d.desc)}`, d.css)).join("")}</div>`;
  else if (catTab === "mesas") body = line + (full ? `<div class="warn">Tu rango permite ${API.Rank.maxGames()} juegos.</div>` : "") + `<div class="list">${D.TABLES.map(d => row("table", d, `${d.seats} asientos · apuestas ${API.fmt(d.minBet)}-${API.fmt(d.maxBet)} · gira de a 90°. ${esc(d.desc)}`, d.css)).join("")}</div>`;
  else if (catTab === "deco") {
    const items = D.DECOR.filter(d => !d.unique && (!catMarker || !fpOf(d.id).mount));
    const where = d => { const f = fpOf(d.id); return f.mount === "wall" ? "va en la pared" : f.mount === "ceil" ? "cuelga del techo" : f.rug ? "alfombra: se pisa" : "en el piso"; };
    body = line + `<p>La decoración sube el atractivo: más clientes y deja pasar a high rollers (40) y VIP (120).</p><div class="list">${items.map(d => row("decor", d, `+${d.atr} de atractivo · ${where(d)}`, hex(d.color))).join("")}</div>`;
  } else body = roomHtml();
  API.openPanel("build", `<h2>${catMarker ? "Comprar para este lugar" : "Catálogo"}</h2>${head}${body}<div class="actions"><button class="ghost" data-act="close">Cerrar</button></div>`);
}
function roomHtml() {
  const S = S_(), zones = D.ZONES.filter(z => S.zones[z.id]);
  if (!S.zones[roomZone]) roomZone = "principal";
  const cur = S.room[roomZone];
  const zt = zones.length > 1 ? `<div class="tabs">${zones.map(z => `<button data-bact="zone" data-id="${z.id}" class="${roomZone === z.id ? "on" : ""}">${ZONE_NAME[z.id]}</button>`).join("")}</div>` : "";
  const rows = (list, kind, curId, colOf) => list.map(c => {
    const locked = S.rank < c.rank, on = c.id === curId;
    return `<div class="item${locked ? " locked" : ""}${on ? " sel" : ""}">${sw(colOf(c))}<div class="t"><b>${c.name} · <span class="num">${c.price ? API.fmt(c.price) : "gratis"}</span>${locked ? lockTag(c.rank) : ""}${on ? '<span class="tag">Puesta</span>' : ""}</b><span>${c.atr ? `+${c.atr} de atractivo` : "Sin atractivo extra"}</span></div>
      <div class="btns"><button data-bact="room" data-kind="${kind}" data-id="${c.id}" ${locked || on || S.bank < c.price ? "disabled" : ""}>Elegir</button></div></div>`;
  }).join("");
  return `<p>Banco <b class="num">${API.fmt(S.bank)}</b>. Cambiá la alfombra y el color de las paredes de cada zona. Suma atractivo mientras esté puesta.</p>${zt}
    <h3>Alfombra · ${ZONE_NAME[roomZone]}</h3><div class="list">${rows(CARPETS, "carpet", cur.carpet, c => c.base)}</div>
    <h3>Paredes · ${ZONE_NAME[roomZone]}</h3><div class="list">${rows(WALLS, "wall", cur.wall, c => c.color)}</div>`;
}
function setRoom(kind, id) {
  const S = S_(), list = kind === "carpet" ? CARPETS : WALLS, c = list.find(x => x.id === id); if (!c) return;
  if (S.rank < c.rank) return;
  if (c.price && !API.Economy.trySpend("decor", c.price)) return;
  S.room[roomZone][kind] = id; applyRoom(true); API.SFX.coin();
  API.toast(`${ZONE_NAME[roomZone]}: ${kind === "carpet" ? "alfombra" : "paredes"} ${c.name}.`, "good");
  API.save(true); API.updateHud(true);
}
function onPanelClick(e) {
  const b = e.target.closest("button[data-bact]"); if (!b || b.disabled) return;
  const act = b.dataset.bact, id = b.dataset.id;
  switch (act) {
    case "tab": openCatalog(id, catMarker); break;
    case "zone": roomZone = id; openCatalog("ambiente"); break;
    case "room": setRoom(b.dataset.kind, id); openCatalog("ambiente"); break;
    case "pick": {
      const kind = b.dataset.kind;
      if (catMarker) { const m = catMarker, pose = { x: m.x, z: m.z, rot: kind === "decor" ? 0 : Math.PI }; if (buyPlaced(kind, id, pose, true)) API.closePanel(false, true); else openCatalog(catTab, m); }
      else { API.closePanel(false, true); startNew(kind, id); }
      break;
    }
    case "sellYes": { const o = sellCtx; sellCtx = null; API.closePanel(true, true); if (o && carry && carry.src === o) { dropGhost(); carry = null; } if (o && !o.obj.dead) sellObject(o); refreshBar(); break; }
    case "infoSell": { const o = infoCtx; API.closePanel(true); if (o) openSellPanel(o); break; }
    case "infoMove": { const o = infoCtx; infoCtx = null; API.closePanel(true, true); setActive(true); if (o && active) pickUp(o); refreshBar(); break; }
  }
}

// =====================================================================
// AMBIENTES: alfombra y paredes por zona (capas encima del local)
// =====================================================================
const carpetTexs = {}, wallBase = {}, wallMats = {}, roomObjs = {};
let roomKey = "";
function carpetTex(c, w) {
  const k = c.id + "|" + w;
  return carpetTexs[k] || (carpetTexs[k] = window.CasinoArt.makeCarpetTexture({ base: c.base, line: c.line, accent: c.accent, repeat: [w / 2, 10] }));
}
function wallMat(color, len) {
  const k = color + "|" + len;
  if (wallMats[k]) return wallMats[k];
  if (!wallBase[color]) {
    const all = window.CasinoArt.makeWallMaterials({ wallColor: color });
    for (const n of ["wainscot", "ceiling", "marble", "exterior", "floorWood"]) if (all[n] && all[n].map) all[n].map.dispose();
    const src = all.wall.map.image, cv = document.createElement("canvas"); cv.width = src.width; cv.height = src.height;
    const g = cv.getContext("2d"); g.drawImage(src, 0, 0); g.globalCompositeOperation = "color"; g.fillStyle = color; g.fillRect(0, 0, cv.width, cv.height);
    g.globalCompositeOperation = "source-over"; g.fillStyle = color; g.globalAlpha = 0.35; g.fillRect(0, 0, cv.width, cv.height);
    all.wall.map.image = cv; all.wall.map.needsUpdate = true;
    wallBase[color] = all.wall;
  }
  const m = wallBase[color].clone(); m.map = wallBase[color].map.clone(); m.map.needsUpdate = true;
  m.map.wrapS = m.map.wrapT = T.RepeatWrapping; m.map.repeat.set(len / 2, 2.6 / 3.5); m.map.offset.y = 1 - 2.6 / 3.5; // arriba coincide con el friso
  return (wallMats[k] = m);
}
function zoneWallSegs(z) {
  const [a, b] = ZONE_X[z], lo = Math.max(a, -IN_X), hi = Math.min(b, IN_X), out = [];
  out.push({ axis: "z", c: IN_Z - 0.012, rot: Math.PI, lo, hi });
  if (z === "principal") { out.push({ axis: "z", c: -IN_Z + 0.012, rot: 0, lo: -10, hi: -3 }); out.push({ axis: "z", c: -IN_Z + 0.012, rot: 0, lo: 3, hi: 10 }); }
  else out.push({ axis: "z", c: -IN_Z + 0.012, rot: 0, lo, hi });
  if (z === "este") out.push({ axis: "x", c: IN_X - 0.012, rot: -HALF, lo: -IN_Z, hi: IN_Z });
  if (z === "oeste") out.push({ axis: "x", c: -IN_X + 0.012, rot: HALF, lo: -IN_Z, hi: IN_Z });
  return out;
}
function applyRoom(force) {
  const S = S_(); if (!S || !S.room) return;
  const key = JSON.stringify(S.room) + JSON.stringify(S.zones);
  if (!force && key === roomKey) return; roomKey = key;
  for (const z of D.ZONES) {
    const id = z.id, open = !!S.zones[id], st = S.room[id] || { carpet: "clasica", wall: "bordo" };
    let R = roomObjs[id];
    if (!R) {
      const [a, b] = ZONE_X[id], w = b - a;
      const floor = new T.Mesh(new T.PlaneGeometry(w, 20, ...(window.CasinoPerf ? [CasinoPerf.segs(w), CasinoPerf.segs(20)] : [])), new T.MeshStandardMaterial({ roughness: 0.95 })); // perf.js: más vértices para la luz por vértice
      floor.rotation.x = -HALF; floor.position.set((a + b) / 2, 0.004, 0); floor.visible = false; API.scene.add(floor);
      const walls = zoneWallSegs(id).map(s => {
        const len = s.hi - s.lo, m = new T.Mesh(new T.PlaneGeometry(len, 2.6), new T.MeshBasicMaterial());
        m.rotation.y = s.rot; m.position.set(s.axis === "z" ? (s.lo + s.hi) / 2 : s.c, 0.9 + 1.3, s.axis === "z" ? s.c : (s.lo + s.hi) / 2);
        m.visible = false; m.userData.len = len; API.scene.add(m); return m;
      });
      R = roomObjs[id] = { floor, walls, w };
    }
    const c = CARPET(st.carpet), wc = WALLC(st.wall);
    R.floor.visible = open && c.id !== "clasica";
    if (R.floor.visible) { R.floor.material.map = carpetTex(c, R.w); R.floor.material.needsUpdate = true; }
    for (const m of R.walls) { m.visible = open && wc.id !== "bordo"; if (m.visible) m.material = wallMat(wc.color, m.userData.len); }
  }
}

// =====================================================================
// MARCADORES FIJOS (cuadros dorados): quedan como lugares sugeridos
// =====================================================================
let markSig = NaN;
function refreshMarkers() {
  const S = S_(), sig = colSig() + (S.zones.este ? 0.5 : 0) + (S.zones.oeste ? 0.25 : 0);
  if (sig === markSig) return; markSig = sig;
  const occupied = r => API.colliders.some(c => c.on() && c.kind !== "wall" && c.kind !== "zonewall" && overlap(r, c, 0.05));
  for (const s of API.slots) s.marker.visible = API.zoneOpen(s.zone) && !s.machine && !occupied({ minX: s.x - 0.5, maxX: s.x + 0.5, minZ: s.z - 1.0, maxZ: s.z + 0.45 });
  for (const s of API.tableSpots) s.marker.visible = API.zoneOpen(s.zone) && !s.table && !occupied({ minX: s.x - 1.4, maxX: s.x + 1.4, minZ: s.z - 1.3, maxZ: s.z + 1.0 });
  for (const s of API.decorSpots) s.marker.visible = API.zoneOpen(s.zone) && !s.decor && !occupied({ minX: s.x - 0.4, maxX: s.x + 0.4, minZ: s.z - 0.4, maxZ: s.z + 0.4 });
}
function hookMarkers() {
  const hookOne = (s, tab) => {
    const p = s.marker.children.find(c => c.userData && c.userData.interact); if (!p) return;
    const it = p.userData.interact, base = { prompt: it.prompt, usable: it.usable };
    // con la tienda (shop.js) el cuadro dorado recibe la caja que traés; sin ella, abre el catálogo como antes
    it.use = () => SHOP() ? SHOP().markerUse(s) : openCatalog(tab, s);
    it.prompt = () => SHOP() ? SHOP().markerPrompt(s) : base.prompt();
    it.shopAccept = () => !!(SHOP() && SHOP().markerAccept(s));
  };
  for (const s of API.slots) hookOne(s, "maquinas");
  for (const s of API.tableSpots) hookOne(s, "mesas");
  for (const s of API.decorSpots) hookOne(s, "deco");
}

// =====================================================================
// INTERFAZ (barra del modo construcción, botones, teclas)
// =====================================================================
const CSS = `
#buildBar { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(14px + env(safe-area-inset-bottom, 0px)); display: grid; gap: 6px; justify-items: center; width: min(620px, calc(100vw - 24px)); pointer-events: none; z-index: 3; }
#buildBar .binfo { background: rgba(7, 20, 15, .92); border: 1px solid var(--brass-dim); border-left: 4px solid var(--brass); border-radius: 6px; padding: 6px 12px; font-size: .95rem; text-align: center; line-height: 1.3; max-width: 100%; }
#buildBar .binfo.ok { border-left-color: var(--mint); } #buildBar .binfo.bad { border-left-color: var(--chip); }
#buildBar .binfo small { display: block; color: var(--ivory-dim); font-size: .8rem; }
#buildBar .binfo .bt { color: var(--brass); font-size: .7rem; letter-spacing: .14em; text-transform: uppercase; display: block; }
#buildBar .brow { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; pointer-events: auto; }
#buildBar .brow button { padding: .4em .75em; font-size: .9rem; }
#buildBar kbd { font-family: var(--font-num); font-size: .78rem; opacity: .75; margin-left: 4px; }
body.building #prompt, body.building #hold, body.building #useBtn, body.building #optBtn, body.building #mgmtBtn, body.building #buildBtn { display: none !important; }
body.building #cross { width: 10px; height: 10px; margin: -5px 0 0 -5px; background: var(--brass); }
#buildBtn { position: fixed; right: max(22px, env(safe-area-inset-right, 0px)); bottom: calc(186px + env(safe-area-inset-bottom, 0px)); pointer-events: auto; }
#bPlace { position: fixed; right: max(22px, env(safe-area-inset-right, 0px)); bottom: calc(36px + env(safe-area-inset-bottom, 0px)); width: 88px; height: 88px; border-radius: 50%; font-size: .98rem; pointer-events: auto; touch-action: none; z-index: 3; padding: 0; }
@media (pointer: coarse), (max-width: 560px) {
  #buildBar { bottom: calc(150px + env(safe-area-inset-bottom, 0px)); width: calc(100vw - 20px); }
  #buildBar .binfo { font-size: .86rem; padding: 5px 9px; }
  #buildBar .brow button { padding: .45em .62em; font-size: .86rem; }
  body.building #toasts { bottom: calc(262px + env(safe-area-inset-bottom, 0px)); }
}
`;
function buildUi() {
  const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
  bar = document.createElement("div"); bar.id = "buildBar"; bar.hidden = true;
  bar.innerHTML = `<div class="binfo" id="bInfo"></div><div class="brow" id="bRow"></div>`;
  document.body.appendChild(bar);
  infoEl = bar.querySelector("#bInfo");
  bar.querySelector("#bRow").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    const a = b.dataset.b;
    if (a === "cat") openCatalog(); else if (a === "rot") rotate(HALF); else if (a === "rot45") rotate(Q);
    else if (a === "sell") askSell(); else if (a === "cancel") cancelCarry(); else if (a === "done") setActive(false);
    else if (a === "place") primary();
    refreshBar();
  });
  placeBtn = document.createElement("button"); placeBtn.id = "bPlace"; placeBtn.hidden = true; placeBtn.textContent = "Levantar";
  placeBtn.addEventListener("pointerdown", e => { e.preventDefault(); primary(); });
  placeBtn.addEventListener("contextmenu", e => e.preventDefault());
  const touch = document.getElementById("touch");
  (touch || document.body).appendChild(placeBtn);
  buildBtn = document.createElement("button"); buildBtn.id = "buildBtn"; buildBtn.className = "ghost"; buildBtn.textContent = "Construir";
  buildBtn.addEventListener("click", () => toggle());
  if (touch) touch.appendChild(buildBtn);
  const tr = document.getElementById("topRight");
  if (tr) { topBtn = document.createElement("button"); topBtn.className = "ghost"; topBtn.id = "buildTopBtn"; topBtn.textContent = "Construir"; topBtn.title = "Modo construcción (B)"; topBtn.addEventListener("click", () => { if (!API.ui.panel) toggle(); }); tr.insertBefore(topBtn, tr.firstChild); }
  document.getElementById("panelBody").addEventListener("click", onPanelClick);
  // teclas (fase de captura: se adelanta a game.js)
  window.addEventListener("keydown", e => {
    if (!API || !API.started) return;
    if (API.ui.panel) return;
    const stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    if (e.code === "KeyB") { if (!e.repeat) toggle(); stop(); return; }
    if (e.code === "KeyK" && !active) { stop(); if (!e.repeat) API.openMgmt("bank"); return; }
    if (!active) return;
    switch (e.code) {
      case "KeyE": case "Enter": case "Space": stop(); if (!e.repeat) primary(); break;
      case "KeyR": stop(); rotate(HALF); break;
      case "KeyT": stop(); rotate(Q); break;
      case "KeyX": case "Delete": case "Backspace": stop(); if (!e.repeat) askSell(); break;
      case "KeyC": stop(); if (!e.repeat) openCatalog(); break;
      case "KeyQ": stop(); if (carry) cancelCarry(); else setActive(false); break;
      case "Escape": if (carry) { stop(); cancelCarry(); } break;
      case "KeyP": case "KeyO": case "KeyN": case "Digit1": case "Digit2": case "Digit3": stop(); break;
      default: return;
    }
    refreshBar();
  }, true);
  window.addEventListener("mousedown", e => {
    if (!active || !API.started || API.ui.panel || API.isTouch) return;
    if (document.pointerLockElement !== API.canvas || e.target !== API.canvas) return;
    e.stopImmediatePropagation();
    if (e.button === 0) primary(); else if (e.button === 2) rotate(HALF);
    refreshBar();
  }, true);
  // ayuda de teclas en la portada y la pausa
  const fixKeys = root => { if (!root || API.isTouch) return; const k = root.querySelector(".keys"); if (!k || k.dataset.build) return; k.dataset.build = "1"; for (const kb of k.querySelectorAll("kbd")) if (/P B O/.test(kb.textContent)) kb.textContent = kb.textContent.replace("P B O", "P K O"); k.insertAdjacentHTML("beforeend", `<kbd>B</kbd><span>Modo construcción: mover, girar, vender y decorar</span>`); };
  new MutationObserver(() => fixKeys(document.getElementById("panelBody"))).observe(document.getElementById("panelBody"), { childList: true });
  setTimeout(() => fixKeys(document.getElementById("title")), 0);
}
function btn(b, label, k, cls) { return `<button class="${cls || "ghost"}" data-b="${b}">${label}${k && !API.isTouch ? `<kbd>${k}</kbd>` : ""}</button>`; }
let lastRow = "";
function refreshBar() {
  if (!bar || bar.hidden) return;
  const row = carry
    ? btn("rot", "Girar 90°", "R") + btn("rot45", "45°", "T") + (carry.src ? btn("sell", "Vender", "X") : "") + btn("cancel", "Cancelar", "Q") + (API.isTouch ? "" : btn("place", "Poner", "E", ""))
    : btn("cat", "Catálogo", "C", "") + btn("sell", "Vender", "X") + btn("done", "Listo", "B");
  if (row !== lastRow) { lastRow = row; bar.querySelector("#bRow").innerHTML = row; }
  placeBtn.textContent = carry ? "Poner" : "Levantar";
}
function setInfo(html, cls) {
  const k = html + "|" + cls; if (k === lastInfo) return; lastInfo = k;
  infoEl.innerHTML = html; infoEl.className = "binfo" + (cls ? " " + cls : "");
}

// =====================================================================
// CADA CUADRO
// =====================================================================
let introT = 0;
function update(dt) {
  if (!API || !API.S) return;
  const S = S_();
  applyRoom(false);
  refreshMarkers();
  for (const o of API.decorObjs) {
    if (!o._b) {
      o._b = true; const f = fpOf(o.d.id);
      const p = o.group.children.find(c => c.userData && c.userData.interact);
      if (p) { if (f.mount === "wall") p.position.set(0, f.y, 0.12); else if (f.mount === "ceil") p.position.y = WALL_H - 0.6; else if (f.rug) { p.position.y = 0.03; p.scale.set(f.w / 0.9, 0.03, f.d / 0.9); } }
      o.group.traverse(c => { if (c.userData && c.userData.buildTick) o._tick = c.userData.buildTick; });
    }
    if (o._tick) o._tick(dt);
  }
  if (API.started && !S.hints.buildIntro) { introT += dt; if (introT > 8 && !API.ui.panel) API.hint("buildIntro", `Nuevo: modo construcción (${API.isTouch ? "botón Construir" : "tecla B"}). Mové, girá y vendé máquinas, mesas y decoración, y cambiá alfombras y paredes.`); }
  if (topBtn) topBtn.hidden = API.isTouch;
  if (!active) return;
  const vis = API.ui.panel ? "hidden" : ""; if (bar.style.visibility !== vis) { bar.style.visibility = vis; placeBtn.style.visibility = vis; }
  if (S.gameOver || S.dayOver && API.ui.panel === "report") { setActive(false, true); return; }
  if (API.ui.panel) return;
  const fmt = API.fmt, head = `<span class="bt">Modo construcción · tiempo en pausa</span>`;
  if (carry) {
    if (hl) hl.visible = false;
    const pose = aimPose(), key = pose.x.toFixed(2) + "|" + pose.z.toFixed(2) + "|" + pose.rot.toFixed(3) + "|" + S.bank;
    if (key !== lastPoseKey) {
      lastPoseKey = key; carry.pose = pose;
      carry.v = pose.nowall ? { ok: false, reason: "Apuntá a una pared del local." } : validate(carry.kind, carry.id, pose, carry.src);
      if (carry.v.ok && carry.isNew && !carry.pp && S.bank < carry.def.price) carry.v = { ok: false, reason: `No te alcanza: cuesta ${fmt(carry.def.price)}.` };
      const g = carry.ghost; g.position.set(pose.x, 0, pose.z); g.rotation.y = pose.rot;
      const col = carry.v.ok ? 0x49e07a : 0xff4d47; ghostMat.color.setHex(col); footMat.color.setHex(col);
      const r = carry.kind === "decor" && fpOf(carry.id).mount ? (fpOf(carry.id).mount === "ceil" ? { minX: pose.x - 0.6, maxX: pose.x + 0.6, minZ: pose.z - 0.6, maxZ: pose.z + 0.6 } : null) : footRect(carry.kind, carry.id, pose);
      footMesh.visible = !!r;
      if (r) { footMesh.position.set((r.minX + r.maxX) / 2, 0.035, (r.minZ + r.maxZ) / 2); footMesh.scale.set(r.maxX - r.minX, r.maxZ - r.minZ, 1); }
    }
    const v = carry.v, price = carry.isNew ? (carry.pp ? " · de la caja" : ` · ${fmt(carry.def.price)}`) : "";
    const keys = API.isTouch ? "Girar · Poner · Cancelar" : "E/clic poner · R girar · T 45° · Q cancelar";
    setInfo(`${head}${esc(carry.def.name)}${price} · ${degOf(carry.pose.rot)}°<small>${v.ok ? "Se puede poner acá. " + keys : esc(v.reason)}</small>`, v.ok ? "ok" : "bad");
  } else {
    hover = pickObject();
    if (hover) {
      const b = boxOf(hover.kind, hover.id, poseOf(hover));
      hl.visible = true; hl.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2); hl.scale.set(b.maxX - b.minX + 0.04, b.maxY - b.minY + 0.04, b.maxZ - b.minZ + 0.04);
      setInfo(hover.kind === "shelf" ? `${head}${esc(hover.name)}<small>${API.isTouch ? "Levantar para mover" : "E levantar y mover · R gira"}</small>` : `${head}${esc(hover.name)}<small>${API.isTouch ? "Levantar para mover · Vender " : "E levantar · X vender "}(${fmt(Math.round(hover.price * D.CFG.sellRefund))})</small>`, "");
    } else {
      hl.visible = false;
      setInfo(`${head}Apuntá a una máquina, mesa o decoración<small>${API.isTouch ? "Catálogo para comprar · Listo para volver" : "C catálogo · B salir · Esc menú"}</small>`, "");
    }
  }
}

// =====================================================================
// INICIO (lo llama game.js)
// =====================================================================
function init(api) {
  API = api;
  buildUi();
  hookMarkers();
}

window.CasinoBuild = {
  init, findPath, sanitizePlaced, beforeLoad, extraAtr, update, makeDecor: makeNewDecor, decorInfo,
  // tienda (shop.js): objeto ya pagado que sale de una caja
  startPrepaid: (kind, id, pp) => startNew(kind, id, pp || {}),
  placePrepaid: (kind, id, pose, atMarker, pp) => buyPlaced(kind, id, pose, atMarker, pp || {}),
  get active() { return active; }, toggle, setActive,
  CARPETS, WALLS, FP,
  debug: {
    validate: (kind, id, x, z, deg) => validate(kind, id, { x, z, rot: radOf(deg == null ? defaultDeg(kind) : deg) }, null),
    buy: (kind, id, x, z, deg) => buyPlaced(kind, id, { x, z, rot: radOf(deg == null ? defaultDeg(kind) : deg) }),
    objects: () => objects().map(o => ({ kind: o.kind, id: o.id, x: o.spot.x, z: o.spot.z, rot: degOf(poseOf(o).rot), name: o.name })),
    move(i, x, z, deg) {
      const o = objects()[i]; if (!o) return { ok: false, reason: "no hay" };
      const pose = { x, z, rot: radOf(deg == null ? degOf(poseOf(o).rot) : deg) };
      liftHide(o); const v = validate(o.kind, o.id, pose, o); liftRestore(o);
      if (v.ok) moveObject(o, pose);
      return v;
    },
    sell(i) { const o = objects()[i]; if (o) sellObject(o); },
    setRoom(zone, kind, id) { roomZone = zone; setRoom(kind, id); },
    path: (ax, az, bx, bz) => findPath(ax, az, bx, bz),
    reach(x, z) { const g = ensureNav(), r = flood(g, 0, -12); return nearestFree(g, x, z, 0.9, r) >= 0; },
    get carry() { return carry ? { kind: carry.kind, id: carry.id, pose: carry.pose, v: carry.v, isNew: carry.isNew } : null; },
    get hover() { return hover ? hover.name : null; },
    primary, rotate, startNew, cancelCarry, openCatalog,
  },
};
})();
