/* Casino Dorado · games.js — JUEGOS NUEVOS: Dados (craps), Bingo nocturno y Carreras de caballos.
 * Se carga después de game.js (y de minigames.js) y antes de story.js. Usa window.CasinoGamesBridge (game.js).
 * Los tres son "mesas" de CASINO_DATA.TABLES con custom: true → se compran en la compu o en el modo construir,
 * piden licencia (upgrades.js), tienen su línea en el reporte del día (def.cat) y los atiende un croupier contratado.
 *  1) Dados: los clientes apuestan pase / no pase / campo / cualquier 7 con los pagos reales del craps.
 *     Sin croupier sos el stickman (minijuego "cr"): tirás vos arrastrando y soltando los dados con el mouse
 *     (o le pasás los dados al tirador) y cantás el resultado. Las rachas calientes hacen festejar a la gente.
 *  2) Bingo nocturno: a las 20 h la sala se llena; se venden cartones, se cantan bolillas en el bolillero (E)
 *     y se verifica cada ¡BINGO! (minijuego "bg"). Con croupier contratado se canta solo.
 *  3) Carreras: una carrera cada 40 min en las pantallas gigantes (canvas 2D procedural, 6 caballos con cuotas).
 *     Los clientes apuestan en la ventanilla, la casa se queda con el margen y vos podés apostar con tu bolsillo.
 * Las reglas puras viven en RULES y no tocan el DOM.
 */
(() => {
"use strict";
const root = typeof window !== "undefined" ? window : globalThis;
const D = root.CASINO_DATA;
const GC = D && D.GAMES;

// =====================================================================
// REGLAS PURAS
// =====================================================================
const pick = (arr, rand) => arr[((rand || Math.random)() * arr.length) | 0];
const RULES = {
  // ---------------- DADOS (craps) ----------------
  // point = 0 en la salida (come-out). Devuelve qué pasa con las apuestas de línea y el punto nuevo.
  crOutcome(point, total) {
    if (!point) {
      if (total === 7 || total === 11) return { kind: "natural", pass: 1, dont: -1, point: 0 };
      if (total === 2 || total === 3) return { kind: "craps", pass: -1, dont: 1, point: 0 };
      if (total === 12) return { kind: "craps12", pass: -1, dont: 0, point: 0 }; // el 12 está "barrado": el no pase empata
      return { kind: "point", pass: 0, dont: 0, point: total };
    }
    if (total === point) return { kind: "hit", pass: 1, dont: -1, point: 0 };
    if (total === 7) return { kind: "sevenOut", pass: -1, dont: 1, point: 0 };
    return { kind: "none", pass: 0, dont: 0, point };
  },
  // campo (una tirada): multiplicador de ganancia (0 = pierde)
  crField(total, pays) { pays = pays || (GC ? GC.dados.fieldPays : { 2: 2, 12: 3 }); if (pays[total]) return pays[total]; return [3, 4, 9, 10, 11].includes(total) ? 1 : 0; },
  crLabel(point, total) {
    const o = RULES.crOutcome(point, total);
    switch (o.kind) {
      case "natural": return `${total}: ¡natural! Gana el pase`;
      case "craps": return `${total}: craps. Gana el no pase`;
      case "craps12": return "12: craps. Pierde el pase, el no pase empata";
      case "point": return `Punto ${total}`;
      case "hit": return `${total}: ¡punto hecho! Gana el pase`;
      case "sevenOut": return "7: siete afuera. Gana el no pase";
      default: return `${total}: no pasa nada, sigue el punto ${point}`;
    }
  },
  // tres opciones para cantar (la correcta + dos que confunden), en orden al azar
  crCallOptions(point, total, rand) {
    rand = rand || Math.random;
    const right = RULES.crLabel(point, total), pool = new Set();
    pool.add(RULES.crLabel(0, total));
    for (const p of [4, 5, 6, 8, 9, 10]) pool.add(RULES.crLabel(p, total));
    pool.add(`Punto ${total}`); pool.add(`${total}: ¡natural! Gana el pase`); pool.add(`${total}: craps. Gana el no pase`);
    pool.delete(right);
    const wrong = [...pool].filter(x => !/^Punto (2|3|7|11|12)$/.test(x));
    for (let i = wrong.length - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; const t = wrong[i]; wrong[i] = wrong[j]; wrong[j] = t; }
    const out = [right].concat(wrong.slice(0, 2));
    for (let i = out.length - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; const t = out[i]; out[i] = out[j]; out[j] = t; }
    return out;
  },
  // cuánto gana la casa con las apuestas de un cliente en una tirada (negativo = paga) y cuánto vuelve al cliente
  crSettle(bets, point, total) {
    const o = RULES.crOutcome(point, total), C = GC ? GC.dados : { any7Pays: 4 };
    let house = 0, back = 0, line = null;
    if (bets.line) {
      const r = bets.line.k === "pass" ? o.pass : o.dont, a = bets.line.amt;
      if (r > 0) { house -= a; back += a * 2; line = "win"; }
      else if (r < 0) { house += a; line = "lose"; }
      else if (o.kind === "craps12" && bets.line.k === "dont") { back += a; line = "push"; }
      else line = "open";
    }
    if (bets.field) { const m = RULES.crField(total); if (m) { house -= bets.field * m; back += bets.field * (1 + m); } else house += bets.field; }
    if (bets.any7) { if (total === 7) { house -= bets.any7 * C.any7Pays; back += bets.any7 * (1 + C.any7Pays); } else house += bets.any7; }
    return { house, back, line, o };
  },
  // ---------------- BINGO (75 bolillas, cartón 5×5 con centro libre) ----------------
  bgLetter: n => "BINGO"[Math.min(4, ((n - 1) / 15) | 0)],
  bgName: n => RULES.bgLetter(n) + "-" + n,
  bgCard(rand) {
    rand = rand || Math.random;
    const cols = [];
    for (let c = 0; c < 5; c++) {
      const pool = []; for (let n = c * 15 + 1; n <= c * 15 + 15; n++) pool.push(n);
      for (let i = pool.length - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
      cols.push(pool.slice(0, 5).sort((a, b) => a - b));
    }
    cols[2][2] = 0; // centro libre
    const g = []; for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) g.push(cols[c][r]); // g[r*5+c]
    return g;
  },
  BG_LINES: (() => { const L = []; for (let r = 0; r < 5; r++) L.push([0, 1, 2, 3, 4].map(c => r * 5 + c)); for (let c = 0; c < 5; c++) L.push([0, 1, 2, 3, 4].map(r => r * 5 + c)); L.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]); return L; })(),
  bgHit: (card, i, set) => card[i] === 0 || set.has(card[i]),
  // primera línea completa (fila, columna o diagonal) con las bolillas de set, o null
  bgLine(card, set) { for (const L of RULES.BG_LINES) if (L.every(i => RULES.bgHit(card, i, set))) return L; return null; },
  // la línea más avanzada: cuántas tiene (para los "bingos" falsos de los que se apuran)
  bgBest(card, set) { let best = 0, line = null; for (const L of RULES.BG_LINES) { let k = 0; for (const i of L) if (RULES.bgHit(card, i, set)) k++; if (k > best) { best = k; line = L; } } return { n: best, line }; },
  // números que se confunden al cantar (dígitos dados vuelta, 6↔9, ±10)
  bgConfusables(n, rand) {
    rand = rand || Math.random;
    const s = String(n), c = new Set();
    if (s.length === 2 && s[0] !== s[1]) c.add(+(s[1] + s[0]));
    if (/[69]/.test(s)) c.add(+s.replace(/[69]/g, d => d === "6" ? "9" : "6"));
    c.add(n + 10); c.add(n - 10); c.add(n + 1); c.add(n - 1);
    const out = [...c].filter(x => x >= 1 && x <= 75 && x !== n);
    for (let i = out.length - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; const t = out[i]; out[i] = out[j]; out[j] = t; }
    return out;
  },
  // ---------------- CARRERAS ----------------
  HORSE_NAMES: ["Relámpago", "Pampero", "Mate Amargo", "Tango Seco", "Ñandú Veloz", "El Gaucho", "Dulce de Leche", "Viento Sur", "Malbec", "La Chacarera", "Fernet", "Colectivero", "Fideo Fino", "Choripán", "Sudestada", "Cebador", "Bandoneón", "Che Pibe"],
  SILKS: ["#d4423f", "#2a6fd6", "#f0c24a", "#1d8a4e", "#f3e9d2", "#9b59d6"],
  // 6 caballos con probabilidad real de ganar y cuota ofrecida (cuota justa × (1 − margen), redondeada para abajo)
  raceField(n, margin, minOdds, rand) {
    rand = rand || Math.random;
    const names = RULES.HORSE_NAMES.slice();
    for (let i = names.length - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; const t = names[i]; names[i] = names[j]; names[j] = t; }
    const str = []; let sum = 0;
    for (let i = 0; i < n; i++) { const s = Math.pow(0.45 + rand() * 1.3, 2.2); str.push(s); sum += s; }
    return str.map((s, i) => { const p = s / sum; return { i, no: i + 1, name: names[i], silk: RULES.SILKS[i % RULES.SILKS.length], p, odds: Math.max(minOdds, Math.floor((1 - margin) / p * 10) / 10) }; });
  },
  // orden de llegada: se sortea por probabilidad, sin reemplazo (el primero es el ganador)
  raceOrder(horses, rand) {
    rand = rand || Math.random;
    const left = horses.slice(), out = [];
    while (left.length) { let tot = 0; for (const h of left) tot += h.p; let r = rand() * tot, k = 0; for (; k < left.length - 1; k++) { r -= left[k].p; if (r <= 0) break; } out.push(left.splice(k, 1)[0].i); }
    return out;
  },
  racePayout: (stake, odds) => Math.round(stake * odds),
  // margen esperado de la casa con estas cuotas (1 − Σ p × cuota)
  raceEdge: horses => 1 - horses.reduce((a, h) => a + h.p * h.odds, 0) / horses.length,
};
root.CasinoGamesRules = RULES;
if (typeof module !== "undefined" && module.exports) module.exports = { RULES };

const B = root.CasinoGamesBridge, T = root.THREE, A = root.CasinoArt;
if (!B || !GC || !T || !A || typeof document === "undefined") return;
const CFG = D.CFG, HOUR = B.HOUR, fmt = B.fmt;
const C_CR = GC.dados, C_BG = GC.bingo, C_RC = GC.carreras;
const TDEF = id => D.TABLES.find(t => t.id === id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const $ = id => document.getElementById(id);
const ST = () => B.S;
const isMine = type => type === "dados" || type === "bingo" || type === "carreras";
const hourNow = () => ST().minutes / 60;
const alive = c => !!(c && !c.dead && c.state === "play");
const sfx = (ev, x, z, o) => B.sfx(ev, x, z, o);
const addMood = (c, d) => { const L = D.LIFE && D.LIFE.mood; if (c) c.lifeMood = clamp((c.lifeMood || 0) + d, L ? L.min : -0.45, L ? L.max : 0.35); };
const faceOf = (c, name, sec) => { if (c && c.person && c.person.api.face) c.person.api.face(name, sec); };
const cheerOf = (c, sec) => { if (c && c.person) c.person.api.cheer(sec); };
const toHouse = (t, n) => { if (!n) return; t.d.tray += n; ST().today.st.tablesNet += n; B.addNet(); };

// =====================================================================
// ESTADO GUARDADO (S.games): solo estadísticas del día y el número de carrera
// =====================================================================
const ST_KEYS = ["rolls", "hot", "best", "bGames", "cards", "bPrize", "races", "tickets", "pBet", "pWon", "callsByHand", "bingosOk"];
function freshGames(day) { const st = {}; for (const k of ST_KEYS) st[k] = 0; return { v: 1, day, st, raceN: 0 }; }
let lastS = null;
function GS() {
  const S = ST(); if (!S) return null;
  if (S !== lastS) { lastS = S; S.games = validate(S.games, S.day); }
  if (S.games.day !== S.day) { const n = S.games.raceN; S.games = freshGames(S.day); S.games.raceN = n; }
  return S.games;
}
function validate(raw, day) {
  const g = freshGames(day);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return g;
  const isNum = v => typeof v === "number" && Number.isFinite(v);
  if (isNum(raw.day)) g.day = Math.max(1, Math.floor(raw.day));
  if (isNum(raw.raceN)) g.raceN = clamp(Math.floor(raw.raceN), 0, 1e6);
  if (raw.st && typeof raw.st === "object") for (const k of ST_KEYS) if (isNum(raw.st[k])) g.st[k] = clamp(Math.round(raw.st[k]), 0, 1e9);
  return g;
}
const stat = (k, n) => { const g = GS(); if (g) g.st[k] += n == null ? 1 : n; };

// =====================================================================
// MODELOS 3D (piezas estáticas fundidas por material y compartidas entre instancias)
// =====================================================================
const M4 = new T.Matrix4(), Q4 = new T.Quaternion(), E4 = new T.Euler(), V1 = new T.Vector3(), V2 = new T.Vector3();
const partCache = {};
function staticParts(key, build) {
  if (partCache[key]) return partCache[key];
  const byMat = new Map();
  const add = (geo, mat, x, y, z, rx, ry, rz, sx, sy, sz) => {
    E4.set(rx || 0, ry || 0, rz || 0); Q4.setFromEuler(E4); V1.set(x || 0, y || 0, z || 0); V2.set(sx || 1, sy || sx || 1, sz || sx || 1);
    const m = new T.Matrix4().compose(V1, Q4, V2);
    if (!byMat.has(mat)) byMat.set(mat, []);
    byMat.get(mat).push({ geo, m });
  };
  build(add);
  const out = [];
  for (const [mat, list] of byMat) out.push({ geo: A.mergeGeometries(list), mat });
  return (partCache[key] = out);
}
function addParts(g, parts) { for (const p of parts) { const m = new T.Mesh(p.geo, p.mat); g.add(m); } }
const GEO = {};
const geo = (k, f) => GEO[k] || (GEO[k] = f());
const boxG = (w, h, d) => geo(`b${w}|${h}|${d}`, () => new T.BoxGeometry(w, h, d));
const cylG = (rt, rb, h, s) => geo(`c${rt}|${rb}|${h}|${s}`, () => new T.CylinderGeometry(rt, rb, h, s || 12));
const planeG = (w, h) => geo(`p${w}|${h}`, () => new T.PlaneGeometry(w, h));
const MATS = {};
const mat = (k, f) => MATS[k] || (MATS[k] = f());
const texMat = (k, tex, basic) => mat(k, () => basic ? new T.MeshBasicMaterial({ map: tex }) : new T.MeshStandardMaterial({ map: tex, roughness: 0.9 }));

// --------------------------- DADOS ---------------------------
function crFeltTex() {
  return A.canvasTex(1024, 400, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 30, w / 2, h / 2, w * 0.6); gr.addColorStop(0, "#1d5a42"); gr.addColorStop(1, "#0f3326");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#f3e9d2"; g.fillStyle = "#f3e9d2"; g.lineWidth = 3; g.textAlign = "center"; g.textBaseline = "middle";
    // casilleros de punto (arriba = lado del croupier)
    const pts = ["4", "5", "SEIS", "8", "NUEVE", "10"];
    pts.forEach((p, i) => { const x = 130 + i * 128; g.strokeRect(x - 58, 18, 116, 100); g.font = "bold 44px Georgia, serif"; g.fillText(p, x, 70); });
    // campo
    g.strokeRect(70, 132, w - 140, 78); g.font = "bold 30px Georgia, serif"; g.fillStyle = "#f0c24a"; g.fillText("CAMPO", 210, 171);
    g.fillStyle = "#f3e9d2"; g.font = "28px Georgia, serif"; g.fillText("2 · 3 · 4 · 9 · 10 · 11 · 12", 560, 162); g.font = "18px Georgia, serif"; g.fillText("el 2 paga doble · el 12 paga triple", 560, 192);
    // cualquier 7
    g.strokeStyle = "#d4423f"; g.strokeRect(w - 200, 222, 130, 70); g.fillStyle = "#ff8a7a"; g.font = "bold 22px Georgia, serif"; g.fillText("CUALQUIER 7", w - 135, 248); g.font = "18px Georgia, serif"; g.fillText("paga 4 a 1", w - 135, 274);
    // no pase y pase (abajo = lado de los jugadores)
    g.strokeStyle = "#f3e9d2"; g.strokeRect(70, 222, w - 290, 70); g.fillStyle = "#f3e9d2"; g.font = "bold 30px Georgia, serif"; g.fillText("NO PASE  ·  el 12 empata", 70 + (w - 290) / 2, 258);
    g.lineWidth = 4; g.strokeRect(40, 304, w - 80, 84); g.fillStyle = "#f0c24a"; g.font = "bold 54px Georgia, serif"; g.fillText("P A S E", w / 2, 348);
  });
}
const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
function drawPips(g, v, cx, cy, s, col) { g.fillStyle = col || "#15171a"; for (const [px, py] of PIPS[v]) { g.beginPath(); g.arc(cx + px * s * 0.28, cy + py * s * 0.28, s * 0.09, 0, Math.PI * 2); g.fill(); } }
// materiales de las 6 caras (orden de BoxGeometry: +x, −x, +y, −y, +z, −z) → caras 3,4,1,6,2,5 (opuestas suman 7)
const DIE_FACES = [3, 4, 1, 6, 2, 5];
function dieMats() {
  return mat("dieFaces", () => DIE_FACES.map(v => new T.MeshStandardMaterial({ roughness: 0.35, map: A.canvasTex(64, 64, (g, w, h) => { g.fillStyle = "#c8202a"; g.fillRect(0, 0, w, h); drawPips(g, v, 32, 32, 60, "#f6f0e0"); }) })));
}
// rotación para que la cara v quede arriba
const DIE_UP = { 1: [0, 0], 6: [Math.PI, 0], 2: [-Math.PI / 2, 0], 5: [Math.PI / 2, 0], 3: [0, Math.PI / 2], 4: [0, -Math.PI / 2] };
function setDieFace(m, v, yaw) { const r = DIE_UP[v] || DIE_UP[1]; m.rotation.set(r[0], yaw || 0, r[1]); }
const CR_H = 0.8; // altura del paño
function makeDice() {
  const g = new T.Group();
  addParts(g, staticParts("crTable", add => {
    const wood = A.materials.woodDark, lea = A.materials.leatherRed, brass = A.materials.brass, black = A.materials.black;
    add(boxG(3.1, 0.7, 1.3), wood, 0, 0.42, 0);
    add(boxG(2.7, 0.08, 1.0), black, 0, 0.04, 0);
    add(boxG(3.2, 0.14, 0.14), lea, 0, CR_H + 0.07, 0.66); add(boxG(3.2, 0.14, 0.14), lea, 0, CR_H + 0.07, -0.66);
    add(boxG(0.14, 0.14, 1.46), lea, 1.6, CR_H + 0.07, 0); add(boxG(0.14, 0.14, 1.46), lea, -1.6, CR_H + 0.07, 0);
    add(boxG(3.2, 0.02, 0.05), brass, 0, CR_H + 0.15, 0.66); add(boxG(3.2, 0.02, 0.05), brass, 0, CR_H + 0.15, -0.66);
    add(boxG(3.0, 0.06, 0.04), brass, 0, CR_H - 0.12, 0.66);
    // pared del fondo con pirámides (donde tienen que pegar los dados)
    add(boxG(0.03, 0.16, 1.18), mat("crPyr", () => new T.MeshStandardMaterial({ roughness: 0.6, map: A.canvasTex(64, 256, (g, w, h) => { g.fillStyle = "#15171a"; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) { g.fillStyle = "#3a3d44"; g.beginPath(); g.moveTo(x, y + 16); g.lineTo(x + 8, y); g.lineTo(x + 16, y + 16); g.fill(); g.fillStyle = "#6a6e78"; g.beginPath(); g.moveTo(x + 8, y); g.lineTo(x + 16, y + 16); g.lineTo(x + 8, y + 12); g.fill(); } }) })), 1.515, CR_H + 0.06, 0);
    // palo del stickman
    add(cylG(0.008, 0.008, 1.4, 6), A.materials.wood, 0.1, CR_H + 0.02, -0.5, 0, 0, Math.PI / 2);
    add(boxG(0.16, 0.012, 0.03), A.materials.wood, -0.6, CR_H + 0.02, -0.5);
    // fichas de la banca
    for (let i = 0; i < 6; i++) add(cylG(0.03, 0.03, 0.05 + (i % 3) * 0.02, 12), A.std([0xd4423f, 0x2a6fd6, 0x1d8a4e, 0x15171a, 0xf3e9d2, 0x9b59d6][i], 0.45, 0.1), -0.45 + i * 0.075, CR_H + 0.03 + (i % 3) * 0.01, -0.56);
  }));
  const felt = new T.Mesh(planeG(3.06, 1.18), mat("crFelt", () => new T.MeshStandardMaterial({ map: crFeltTex(), roughness: 0.95 })));
  felt.rotation.x = -Math.PI / 2; felt.position.y = CR_H + 0.002; g.add(felt);
  const dm = dieMats(), dice = [0, 1].map(i => { const m = new T.Mesh(boxG(0.055, 0.055, 0.055), dm); m.rotation.order = "YXZ"; m.position.set(0.9 + i * 0.1, CR_H + 0.028, -0.1 + i * 0.12); setDieFace(m, i ? 4 : 3, i); g.add(m); return m; });
  const puckOn = mat("puckOn", () => new T.MeshStandardMaterial({ roughness: 0.4, map: A.canvasTex(64, 64, (g) => { g.fillStyle = "#f3e9d2"; g.fillRect(0, 0, 64, 64); g.fillStyle = "#15171a"; g.font = "bold 24px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("ON", 32, 33); }) }));
  const puckOff = mat("puckOff", () => new T.MeshStandardMaterial({ roughness: 0.4, map: A.canvasTex(64, 64, (g) => { g.fillStyle = "#15171a"; g.fillRect(0, 0, 64, 64); g.fillStyle = "#f3e9d2"; g.font = "bold 20px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("OFF", 32, 33); }) }));
  const puck = new T.Mesh(cylG(0.06, 0.06, 0.015, 16), [A.materials.black, puckOff, A.materials.black]);
  puck.position.set(-1.3, CR_H + 0.01, -0.36); g.add(puck);
  A.addBlob(g, 3.6, 1.9);
  // animación de la tirada: de la punta de los jugadores a la pared del fondo y rebote
  let anim = null;
  const api = {
    roll(a, b) {
      anim = { t: 0, dur: 1.0, vals: [a, b], z0: [rnd(-0.25, 0.05), rnd(0.05, 0.3)], x1: [rnd(0.55, 1.15), rnd(0.55, 1.2)], z1: [rnd(-0.35, 0.05), rnd(0, 0.38)], yaw: [rnd(0, 6.28), rnd(0, 6.28)] };
    },
    setPoint(p) {
      const idx = [4, 5, 6, 8, 9, 10].indexOf(p);
      if (idx < 0) { puck.material = [A.materials.black, puckOff, A.materials.black]; puck.position.set(-1.3, CR_H + 0.01, -0.36); }
      else { puck.material = [A.materials.black, puckOn, A.materials.black]; puck.position.set(((130 + idx * 128) / 1024 - 0.5) * 3.06, CR_H + 0.01, (95 / 400 - 0.5) * 1.18); }
    },
    update(dt) {
      if (!anim) return;
      anim.t += dt; const u = Math.min(1, anim.t / anim.dur);
      for (let i = 0; i < 2; i++) {
        const m = dice[i];
        // ida hasta la pared (x 1.45) en el primer 55%, vuelta al lugar final en el resto
        let x, z;
        if (u < 0.55) { const k = u / 0.55; x = -1.25 + (1.45 - -1.25) * k; z = anim.z0[i] + (anim.z1[i] - anim.z0[i]) * k * 0.6; }
        else { const k = (u - 0.55) / 0.45, e = 1 - (1 - k) * (1 - k); x = 1.45 + (anim.x1[i] - 1.45) * e; z = anim.z0[i] + (anim.z1[i] - anim.z0[i]) * (0.6 + 0.4 * e); }
        const hop = Math.abs(Math.sin(u * Math.PI * 4)) * 0.12 * (1 - u);
        m.position.set(x, CR_H + 0.028 + hop, z);
        if (u < 1) { m.rotation.x += dt * 17; m.rotation.z += dt * 13; } else setDieFace(m, anim.vals[i], anim.yaw[i]);
      }
      if (u >= 1) anim = null;
    },
    get rolling() { return !!anim; },
  };
  g.api = api; g.userData.api = api;
  return g;
}

// --------------------------- BINGO ---------------------------
function bgBoardDraw(g, w, h, drawn, last, info) {
  g.fillStyle = "#0b0e1a"; g.fillRect(0, 0, w, h);
  const set = drawn instanceof Set ? drawn : new Set(drawn || []);
  g.textAlign = "center"; g.textBaseline = "middle";
  const cw = 26, x0 = 46, y0 = 58, rh = 44;
  "BINGO".split("").forEach((L, r) => {
    g.fillStyle = ["#d4423f", "#f0c24a", "#2a6fd6", "#1d8a4e", "#9b59d6"][r]; g.fillRect(6, y0 + r * rh - 18, 34, 36);
    g.fillStyle = "#fff"; g.font = "bold 26px Georgia, serif"; g.fillText(L, 23, y0 + r * rh + 1);
    for (let k = 0; k < 15; k++) {
      const n = r * 15 + k + 1, on = set.has(n), x = x0 + k * cw + cw / 2, y = y0 + r * rh;
      g.fillStyle = on ? (n === last ? "#ffe27a" : "#f0c24a") : "#1a2240"; g.beginPath(); g.arc(x, y, 12, 0, Math.PI * 2); g.fill();
      g.fillStyle = on ? "#15171a" : "#56608a"; g.font = "bold 13px sans-serif"; g.fillText(String(n), x, y + 1);
    }
  });
  g.fillStyle = "#f0c24a"; g.font = "bold 30px Georgia, serif"; g.fillText("BINGO NOCTURNO", (x0 + 15 * cw) / 2 + 10, 24);
  // bolilla grande
  const bx = w - 66, by = 128;
  g.fillStyle = last ? "#f3e9d2" : "#1a2240"; g.beginPath(); g.arc(bx, by, 52, 0, Math.PI * 2); g.fill();
  if (last) { g.fillStyle = "#15171a"; g.font = "bold 22px Georgia, serif"; g.fillText(RULES.bgLetter(last), bx, by - 22); g.font = "bold 40px Georgia, serif"; g.fillText(String(last), bx, by + 12); }
  g.fillStyle = "#b9b09a"; g.font = "15px sans-serif"; g.fillText(info || "", bx, 214);
  g.fillText(`${set.size} cantadas`, bx, 236);
}
function makeBingo() {
  const g = new T.Group();
  addParts(g, staticParts("bgHall", add => {
    const black = A.materials.black, wood = A.materials.wood, woodD = A.materials.woodDark, brass = A.materials.brass, lea = A.materials.leatherRed;
    // tablero: patas y marco
    add(boxG(0.08, 2.9, 0.08), black, -1.38, 1.45, -1.52); add(boxG(0.08, 2.9, 0.08), black, 1.18, 1.45, -1.52);
    add(boxG(2.74, 1.56, 0.07), black, -0.1, 2.12, -1.53); add(boxG(2.8, 0.05, 0.1), brass, -0.1, 2.92, -1.53); add(boxG(2.8, 0.05, 0.1), brass, -0.1, 1.32, -1.53);
    add(boxG(0.7, 0.05, 0.5), black, -0.1, 0.02, -1.52);
    // mesa larga con cartones
    add(boxG(3.95, 0.05, 0.44), woodD, -0.025, 0.74, 0.12);
    for (const x of [-1.9, 1.85]) for (const z of [-0.05, 0.29]) add(boxG(0.05, 0.72, 0.05), black, x, 0.36, z);
    add(boxG(3.8, 0.3, 0.02), woodD, -0.025, 0.55, -0.09);
    for (let i = 0; i < 8; i++) { add(boxG(0.2, 0.004, 0.2), mat("bgCardMat", () => new T.MeshStandardMaterial({ roughness: 0.8, map: A.canvasTex(64, 64, (c) => { c.fillStyle = "#f6f0e0"; c.fillRect(0, 0, 64, 64); c.strokeStyle = "#2a3a7a"; c.lineWidth = 1.5; for (let k = 0; k <= 5; k++) { c.beginPath(); c.moveTo(4 + k * 11.2, 4); c.lineTo(4 + k * 11.2, 60); c.stroke(); c.beginPath(); c.moveTo(4, 4 + k * 11.2); c.lineTo(60, 4 + k * 11.2); c.stroke(); } c.fillStyle = "#d4423f"; for (let k = 0; k < 7; k++) { c.beginPath(); c.arc(10 + ((k * 37) % 5) * 11.2, 10 + ((k * 23) % 5) * 11.2, 3.5, 0, 6.3); c.fill(); } }) })), -1.75 + i * 0.5, 0.767, 0.2); }
    // sillas (asiento, respaldo y patas)
    for (let i = 0; i < 8; i++) {
      const x = -1.75 + i * 0.5, z = 0.66;
      add(boxG(0.4, 0.05, 0.4), lea, x, 0.46, z); add(boxG(0.4, 0.42, 0.04), lea, x, 0.7, z + 0.2);
      for (const dx of [-0.17, 0.17]) for (const dz of [-0.17, 0.17]) add(boxG(0.03, 0.46, 0.03), black, x + dx, 0.23, z + dz);
    }
    // mesita del bolillero
    add(boxG(0.62, 0.86, 0.5), wood, 1.6, 0.43, -0.75); add(boxG(0.66, 0.03, 0.54), brass, 1.6, 0.875, -0.75);
    add(boxG(0.05, 0.3, 0.05), black, 1.42, 1.04, -0.75); add(boxG(0.05, 0.3, 0.05), black, 1.78, 1.04, -0.75);
    add(boxG(0.2, 0.04, 0.12), brass, 1.6, 0.91, -0.52); // bandejita de la bolilla
  }));
  // tablero luminoso (uno por sala)
  const tex = A.canvasTex(640, 260, (c, w, h) => bgBoardDraw(c, w, h, [], 0, "20:00 h"));
  const board = new T.Mesh(planeG(2.6, 1.06), new T.MeshBasicMaterial({ map: tex })); board.position.set(-0.1, 2.12, -1.49); g.add(board);
  // bolillero: jaula que gira con bolillas adentro
  const cage = new T.Group(); cage.position.set(1.6, 1.2, -0.75); g.add(cage);
  const ringG = geo("bgRing", () => new T.TorusGeometry(0.19, 0.008, 6, 28));
  for (let k = 0; k < 4; k++) { const r = new T.Mesh(ringG, A.materials.brass); r.rotation.y = k * Math.PI / 4; cage.add(r); }
  const axle = new T.Mesh(cylG(0.012, 0.012, 0.44, 6), A.materials.chrome); axle.rotation.z = Math.PI / 2; cage.add(axle);
  const ballG = geo("bgBall", () => new T.SphereGeometry(0.025, 8, 6));
  const ballMats = [0xd4423f, 0xf0c24a, 0x2a6fd6, 0x1d8a4e, 0x9b59d6, 0xf3e9d2].map(c => A.std(c, 0.3, 0.05));
  for (let k = 0; k < 14; k++) { const b = new T.Mesh(ballG, ballMats[k % ballMats.length]); b.position.set(rnd(-0.12, 0.12), rnd(-0.14, -0.06), rnd(-0.1, 0.1)); cage.add(b); }
  const outBall = new T.Mesh(ballG, A.std(0xf3e9d2, 0.3, 0.05)); outBall.position.set(1.6, 0.955, -0.52); outBall.visible = false; g.add(outBall);
  A.addBlob(g, 4.4, 3.5);
  let spinT = 0, key = "";
  const api = {
    spin(sec) { spinT = Math.max(spinT, sec || 0.8); },
    setBoard(drawn, last, info) {
      const k = drawn.length + "|" + last + "|" + info; if (k === key) return; key = k;
      const c = tex.userData.ctx; bgBoardDraw(c, c.canvas.width, c.canvas.height, drawn, last, info); tex.needsUpdate = true;
      outBall.visible = !!last;
    },
    update(dt) { if (spinT > 0) { spinT -= dt; cage.rotation.x += dt * 9; } },
  };
  g.api = api; g.userData.api = api;
  return g;
}

// --------------------------- CARRERAS ---------------------------
// una sola textura de 512×288 para todas las pantallas (la misma carrera en todo el casino)
const raceTex = A.canvasTex(512, 288, (g, w, h) => { g.fillStyle = "#0b1712"; g.fillRect(0, 0, w, h); });
const raceMat = new T.MeshBasicMaterial({ map: raceTex });
function makeRaces() {
  const g = new T.Group();
  addParts(g, staticParts("rcBooth", add => {
    const black = A.materials.black, chrome = A.materials.chrome, wood = A.materials.woodDark, marble = A.materials.marble, brass = A.materials.brass;
    add(boxG(0.1, 3.1, 0.1), black, -1.5, 1.55, -0.52); add(boxG(0.1, 3.1, 0.1), black, 1.5, 1.55, -0.52);
    add(boxG(3.12, 1.82, 0.08), black, 0, 2.2, -0.53); add(boxG(3.2, 0.04, 0.1), chrome, 0, 3.12, -0.53); add(boxG(3.2, 0.04, 0.1), chrome, 0, 1.28, -0.53);
    add(boxG(0.7, 0.05, 0.4), black, -1.5, 0.025, -0.52); add(boxG(0.7, 0.05, 0.4), black, 1.5, 0.025, -0.52);
    // ventanilla
    add(boxG(2.2, 1.02, 0.42), wood, 0, 0.51, 0.06); add(boxG(2.32, 0.05, 0.52), marble, 0, 1.045, 0.06);
    add(boxG(2.24, 0.06, 0.02), brass, 0, 0.92, 0.28); add(boxG(2.24, 0.04, 0.02), brass, 0, 0.12, 0.28);
    add(boxG(0.04, 0.3, 0.04), black, 0, 1.22, -0.05);
    // cartel "APUESTAS HÍPICAS"
    add(planeG(1.5, 0.3), mat("rcSign", () => new T.MeshBasicMaterial({ map: A.canvasTex(512, 102, (c, w, h) => { c.fillStyle = "#15171a"; c.fillRect(0, 0, w, h); c.strokeStyle = "#d9a84a"; c.lineWidth = 4; c.strokeRect(4, 4, w - 8, h - 8); c.fillStyle = "#f0c24a"; c.font = "bold 46px Georgia, serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("APUESTAS HÍPICAS", w / 2, h / 2 + 2); }) })), 0, 0.62, 0.272);
  }));
  const screen = new T.Mesh(planeG(2.96, 1.665), raceMat); screen.position.set(0, 2.2, -0.485); g.add(screen);
  const mini = new T.Mesh(planeG(0.5, 0.28), raceMat); mini.position.set(0, 1.32, -0.03); mini.rotation.x = -0.25; g.add(mini);
  const back = new T.Mesh(planeG(0.54, 0.32), A.materials.black); back.position.set(0, 1.32, -0.04); back.rotation.set(-0.25, Math.PI, 0); g.add(back);
  A.addBlob(g, 3.6, 1.6);
  return g;
}
function makeWallScreen(g) {
  addParts(g, staticParts("rcWall", add => { add(boxG(2.44, 1.42, 0.06), A.materials.black, 0, 2.25, 0.03); add(boxG(2.5, 0.03, 0.08), A.materials.chrome, 0, 2.97, 0.04); add(boxG(2.5, 0.03, 0.08), A.materials.chrome, 0, 1.53, 0.04); }));
  const s = new T.Mesh(planeG(2.3, 1.294), raceMat); s.position.set(0, 2.25, 0.064); g.add(s);
}

// =====================================================================
// CARRERAS: una carrera global para todo el casino
// =====================================================================
const RC = { phase: "idle", t: 0, n: 0, horses: [], order: [], fin: [], prog: [], wob: [], bets: [], pBets: [], last: null, drawT: 0, gallop: 0 };
function raceAvailable() { return B.tables.some(t => t.d.type === "carreras") || B.decorObjs.some(o => o.d.id === "deco_pantalla_carreras"); }
function newRace() {
  const g = GS(); g.raceN++; RC.n = g.raceN;
  RC.horses = RULES.raceField(C_RC.horses, TDEF("carreras").edge, C_RC.minOdds);
  RC.order = []; RC.bets = []; RC.pBets = []; RC.phase = "bet"; RC.t = (C_RC.everyMin / 60) * HOUR - C_RC.raceSec - C_RC.resultSec;
  RC.prog = RC.horses.map(() => 0);
}
function raceStart() {
  RC.order = RULES.raceOrder(RC.horses);
  RC.fin = []; RC.wob = [];
  RC.order.forEach((hi, rank) => { RC.fin[hi] = C_RC.raceSec * (0.8 + 0.032 * rank + rnd(0, 0.012)); });
  RC.horses.forEach((h, i) => RC.wob[i] = { a: rnd(0.04, 0.09), k: rnd(1.2, 2.4), f: rnd(0, 6.28) });
  RC.phase = "run"; RC.t = C_RC.raceSec; RC.el = 0;
  for (const t of B.tables) if (t.d.type === "carreras") sfx("truck", t.center.x, t.center.z);
  B.toast(`¡Largaron! Carrera N.º ${RC.n}.`, "");
}
function raceProg(i, el) {
  const f = RC.fin[i], u = el / f;
  if (u >= 1) return 1 + (el - f) * 0.04;
  const w = RC.wob[i];
  return clamp(u + w.a * Math.sin(Math.PI * 2 * (u * w.k) + w.f) * u * (1 - u) * 2, 0, 0.999);
}
function raceFinish() {
  const win = RC.horses[RC.order[0]];
  RC.phase = "result"; RC.t = C_RC.resultSec; RC.last = { n: RC.n, win, order: RC.order.slice() };
  stat("races");
  let house = 0; const near = [];
  for (const b of RC.bets) {
    const c = b.c, t = b.t, h = RC.horses[b.h], won = b.h === win.i;
    if (won) {
      const pay = RULES.racePayout(b.amt, h.odds);
      house -= pay; if (!t.dead) toHouse(t, -pay);
      if (c && !c.dead) { c.budget += pay; c.flags.won = true; }
      if (c && !c.dead && h.odds >= C_RC.bigWinOdds) {
        cheerOf(c, 2.6); faceOf(c, "surprised", 1.2); addMood(c, 0.12);
        if (B.near(c.x, c.z, 14)) B.floatText(c.x, 2.4, c.z, `¡GANÉ x${h.odds.toFixed(1)}!`, "#f0c24a");
        near.push(c); sfx("bigwin", c.x, c.z);
      } else if (c && !c.dead) { cheerOf(c, 1.4); faceOf(c, "happy", 2); }
    } else if (c && !c.dead) {
      faceOf(c, h.odds < 2.6 ? "angry" : "sad", 2.4); addMood(c, -0.04);
      if (h.odds < 2.6) sfx("grumble", c.x, c.z);
    }
    if (c && !c.dead) { c.played = true; c.racesLeft = (c.racesLeft || 1) - 1; }
  }
  // gran batacazo: aplauden los que están cerca
  if (near.length) for (const o of B.customers) if (alive(o) && !near.includes(o) && near.some(c => Math.hypot(c.x - o.x, c.z - o.z) < 7) && Math.random() < 0.5) cheerOf(o, 1.2);
  if (near.length) sfx("clap", near[0].x, near[0].z);
  // apuestas del jugador (con la agencia hípica, del bolsillo)
  let pw = 0, pb = 0;
  for (const b of RC.pBets) { pb += b.amt; if (b.h === win.i) pw += RULES.racePayout(b.amt, RC.horses[b.h].odds); }
  if (pb) {
    if (pw > 0) {
      const S = ST(), room = B.Pocket.room(), inP = Math.min(pw, room); S.pocket += inP;
      if (pw > inP) B.Economy.add("deposits", pw - inP);
      stat("pWon", pw); B.SFX.cash();
      B.toast(`¡Ganó ${win.name}! Cobraste ${fmt(pw)}${pw > inP ? ` (${fmt(pw - inP)} fueron a la caja fuerte: no entraban en el bolsillo)` : ""}.`, "good");
    } else B.toast(`Ganó ${win.name} (x${win.odds.toFixed(1)}). Perdiste ${fmt(pb)}.`, "bad");
    B.updateHud(true);
  }
  RC.pBets = [];
  for (const t of B.tables) if (t.d.type === "carreras") { sfx(win.odds >= C_RC.bigWinOdds ? "cheer" : "clap", t.center.x, t.center.z); if (B.near(t.center.x, t.center.z, 14)) B.floatText(t.center.x, 3.3, t.center.z - 0.4, `Ganó N.º ${win.no} ${win.name}`, "#f0c24a"); }
  return house;
}
function raceUpdate(dt) {
  if (!raceAvailable()) { RC.phase = "idle"; return; }
  if (!B.isOpen) {
    if (RC.phase === "bet" && (RC.bets.length || RC.pBets.length)) { raceStart(); RC.el = C_RC.raceSec; raceFinish(); } // cierre: se corre ya
    else if (RC.phase === "run") { RC.el = C_RC.raceSec; raceFinish(); }
    RC.phase = "idle"; RC.bets = []; RC.pBets = [];
    return;
  }
  if (RC.phase === "idle") { newRace(); return; }
  RC.t -= dt;
  if (RC.phase === "bet") { if (RC.t <= 0) raceStart(); }
  else if (RC.phase === "run") { RC.el += dt; if (RC.el >= C_RC.raceSec) raceFinish(); }
  else if (RC.phase === "result") { if (RC.t <= 0) newRace(); }
}
// clientes en la ventanilla: una apuesta por carrera
function raceCustomers(t, seated) {
  for (const se of seated) {
    const c = se.c;
    if (c.racesLeft == null) c.racesLeft = rndi(C_RC.racesPerCustomer[0], C_RC.racesPerCustomer[1]);
    if (c.racesLeft <= 0 && c.raceBet !== RC.n) { B.leaveCustomer(c); continue; }
    if (RC.phase !== "bet" || c.raceBet === RC.n) continue;
    const def = t.def, lo = Math.max(def.minBet, c.betMin), hi = Math.min(def.maxBet, c.betMax, c.budget);
    if (hi < lo) { B.leaveCustomer(c); continue; }
    const amt = Math.round(rnd(lo, hi) / 5) * 5 || lo;
    const longshot = Math.random() < (C_RC.longshot[c.type.id] || 0.2);
    const sorted = RC.horses.slice().sort((a, b) => a.odds - b.odds);
    const h = longshot ? pick(sorted.slice(3)) : (Math.random() < 0.6 ? sorted[0] : sorted[1]);
    c.budget -= amt; c.raceBet = RC.n; toHouse(t, amt); stat("tickets");
    RC.bets.push({ c, t, h: h.i, amt });
    if (c.person) c.person.api.gesture && c.person.api.gesture("press");
    sfx("register", t.center.x, t.center.z);
  }
}
// dibujo de la pantalla
function raceDraw() {
  const g = raceTex.userData.ctx, w = 512, h = 288;
  g.textBaseline = "middle"; g.textAlign = "left";
  const mm = s => { const min = Math.max(0, Math.ceil(s / HOUR * 60)); return min + " min"; };
  if (RC.phase === "idle" || !RC.horses.length) {
    g.fillStyle = "#0b1712"; g.fillRect(0, 0, w, h); g.fillStyle = "#d9a84a"; g.textAlign = "center"; g.font = "bold 34px Georgia, serif"; g.fillText("HIPÓDROMO DORADO", w / 2, 120);
    g.fillStyle = "#b9b09a"; g.font = "20px sans-serif"; g.fillText("Las carreras corren con el casino abierto", w / 2, 168); raceTex.needsUpdate = true; return;
  }
  if (RC.phase === "bet") {
    g.fillStyle = "#0e2a20"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#d9a84a"; g.font = "bold 24px Georgia, serif"; g.fillText(`CARRERA N.º ${RC.n}`, 16, 24);
    g.textAlign = "right"; g.fillStyle = "#f3e9d2"; g.font = "bold 20px sans-serif"; g.fillText(`Largan en ${mm(RC.t)}`, w - 14, 24); g.textAlign = "left";
    RC.horses.forEach((hh, i) => {
      const y = 62 + i * 36;
      g.fillStyle = i % 2 ? "#123426" : "#0f2e22"; g.fillRect(10, y - 16, w - 20, 32);
      g.fillStyle = hh.silk; g.fillRect(18, y - 11, 22, 22); g.fillStyle = hh.silk === "#f3e9d2" || hh.silk === "#f0c24a" ? "#15171a" : "#fff"; g.font = "bold 16px sans-serif"; g.textAlign = "center"; g.fillText(String(hh.no), 29, y + 1);
      g.textAlign = "left"; g.fillStyle = "#f3e9d2"; g.font = "19px Georgia, serif"; g.fillText(hh.name, 52, y + 1);
      g.textAlign = "right"; g.fillStyle = "#6fd39b"; g.font = "bold 20px monospace"; g.fillText("x" + hh.odds.toFixed(1), w - 18, y + 1); g.textAlign = "left";
    });
    g.fillStyle = "#b9b09a"; g.font = "14px sans-serif"; g.fillText(`Apostá en la ventanilla · ${RC.bets.length} boletos`, 16, h - 12);
  } else {
    // pista
    g.fillStyle = "#1a4a2a"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#8a5a32"; g.fillRect(0, 40, w, 222);
    g.fillStyle = "#f3e9d2"; g.fillRect(0, 38, w, 3); g.fillRect(0, 261, w, 3);
    const off = (RC.gallop * 60) % 40; g.fillStyle = "rgba(255,255,255,.08)"; for (let x = -off; x < w; x += 40) g.fillRect(x, 41, 2, 220);
    const fx = 470; g.fillStyle = "#fff"; for (let y = 41; y < 261; y += 10) { g.fillRect(fx, y, 5, 5); g.fillRect(fx + 5, y + 5, 5, 5); }
    g.fillStyle = "#d4423f"; g.fillRect(fx - 2, 24, 14, 16);
    const el = RC.phase === "run" ? RC.el : C_RC.raceSec;
    RC.horses.forEach((hh, i) => {
      const p = RC.phase === "run" ? raceProg(i, el) : raceProg(i, C_RC.raceSec + 2), x = 20 + Math.min(1.06, p) * (fx - 40), y = 62 + i * 35;
      RC.prog[i] = p;
      const ph = RC.gallop * 14 + i * 1.7, lg = Math.sin(ph) * 7;
      g.strokeStyle = "#3a2010"; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x - 10, y + 4); g.lineTo(x - 13 - lg, y + 15); g.moveTo(x - 6, y + 4); g.lineTo(x - 3 + lg, y + 15); g.moveTo(x + 8, y + 4); g.lineTo(x + 5 + lg, y + 15); g.moveTo(x + 12, y + 4); g.lineTo(x + 15 - lg, y + 15); g.stroke();
      g.fillStyle = "#5a3016"; g.beginPath(); g.ellipse(x, y, 16, 7, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(x + 12, y - 3); g.lineTo(x + 23, y - 11 + Math.sin(ph) * 1.5); g.lineTo(x + 26, y - 7); g.lineTo(x + 15, y + 2); g.fill();
      g.strokeStyle = "#2a1408"; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 15, y - 2); g.lineTo(x - 22, y + 3 + Math.sin(ph) * 2); g.stroke();
      g.fillStyle = hh.silk; g.beginPath(); g.arc(x + 2, y - 11, 6, 0, Math.PI * 2); g.fill(); g.fillRect(x - 6, y - 6, 12, 6);
      g.fillStyle = hh.silk === "#f3e9d2" || hh.silk === "#f0c24a" ? "#15171a" : "#fff"; g.font = "bold 9px sans-serif"; g.textAlign = "center"; g.fillText(String(hh.no), x, y - 3); g.textAlign = "left";
    });
    // orden
    const ord = RC.phase === "run" ? RC.horses.map((hh, i) => i).sort((a, b) => RC.prog[b] - RC.prog[a]) : RC.order;
    g.fillStyle = "rgba(7,20,15,.85)"; g.fillRect(0, 0, w, 38);
    g.fillStyle = "#d9a84a"; g.font = "bold 18px Georgia, serif"; g.fillText(RC.phase === "run" ? `N.º ${RC.n} · EN CARRERA` : `N.º ${RC.n} · LLEGADA`, 10, 19);
    g.font = "bold 16px monospace";
    ord.forEach((hi, k) => { const hh = RC.horses[hi]; g.fillStyle = hh.silk; g.fillRect(240 + k * 44, 9, 38, 20); g.fillStyle = hh.silk === "#f3e9d2" || hh.silk === "#f0c24a" ? "#15171a" : "#fff"; g.textAlign = "center"; g.fillText(String(hh.no), 259 + k * 44, 20); g.textAlign = "left"; });
    if (RC.phase === "result" && RC.last) {
      const wv = RC.last.win;
      g.fillStyle = "rgba(7,20,15,.88)"; g.fillRect(56, 104, 400, 84); g.strokeStyle = "#d9a84a"; g.lineWidth = 3; g.strokeRect(56, 104, 400, 84);
      g.textAlign = "center"; g.fillStyle = "#f0c24a"; g.font = "bold 30px Georgia, serif"; g.fillText(`¡GANÓ N.º ${wv.no} ${wv.name.toUpperCase()}!`.slice(0, 28), w / 2, 134);
      g.fillStyle = "#6fd39b"; g.font = "bold 24px monospace"; g.fillText(`paga x${wv.odds.toFixed(1)}`, w / 2, 168); g.textAlign = "left";
    }
  }
  raceTex.needsUpdate = true;
}

// =====================================================================
// DADOS: estado por mesa y resolución de una tirada
// =====================================================================
function crState(t) { return t.cr || (t.cr = { point: 0, streak: 0, hotT: 0, last: [3, 4], rolls: 0 }); }
// cada cliente apuesta antes de la tirada (la línea solo en la salida; campo y cualquier 7 son de una tirada)
function crPlaceBets(t, c) {
  const cr = crState(t), def = t.def, lo = Math.max(def.minBet, c.betMin), hi = Math.min(def.maxBet, c.betMax);
  const ty = c.type.id, money = () => c.budget;
  if (!c.crB) c.crB = { line: null, field: 0, any7: 0 };
  const b = c.crB;
  if (hi < lo) return false;
  const amt = () => Math.round(rnd(lo, hi) / 5) * 5 || lo;
  if (!cr.point && !b.line && c.rounds > 0) { const a = Math.min(amt(), money()); if (a >= lo) { c.budget -= a; b.line = { k: Math.random() < (C_CR.dontChance[ty] || 0.2) ? "dont" : "pass", amt: a }; } }
  if (!b.field && c.rounds > 0 && Math.random() < (C_CR.fieldChance[ty] || 0.2)) { const a = Math.min(Math.round(lo / 5) * 5 || lo, money()); if (a >= def.minBet) { c.budget -= a; b.field = a; } }
  if (!b.any7 && c.rounds > 0 && Math.random() < (C_CR.any7Chance[ty] || 0.05)) { const a = Math.min(def.minBet, money()); if (a >= def.minBet) { c.budget -= a; b.any7 = a; } }
  return !!(b.line || b.field || b.any7);
}
const crHasBet = c => !!(c.crB && (c.crB.line || c.crB.field || c.crB.any7));
const crBetText = b => !b ? "—" : [b.line ? `${b.line.k === "pass" ? "Pase" : "No pase"} ${fmt(b.line.amt)}` : "", b.field ? `Campo ${fmt(b.field)}` : "", b.any7 ? `7 ${fmt(b.any7)}` : ""].filter(Boolean).join(" · ") || "—";
// devuelve el resumen de la tirada; mueve la plata (bandeja de la mesa y presupuesto de cada cliente)
function crResolve(t, players, a, b) {
  const cr = crState(t), total = a + b, before = cr.point;
  let house = 0; const res = [];
  for (const c of players) {
    if (!c || c.dead || !c.crB) continue;
    const r = RULES.crSettle(c.crB, before, total);
    house += r.house; c.budget += r.back;
    const net = r.back - ((c.crB.line && r.line !== "open" ? c.crB.line.amt : 0) + c.crB.field + c.crB.any7);
    if (r.line && r.line !== "open") c.crB.line = null;
    c.crB.field = 0; c.crB.any7 = 0;
    c.played = true; c.rounds--;
    if (net > 0) { c.flags.won = true; if (Math.random() < 0.45) cheerOf(c, 1.2); } else if (net < 0 && Math.random() < 0.3) faceOf(c, "sad", 1.6);
    if (root.CasinoLife && net !== 0) root.CasinoLife.onBet(c, net > 0);
    res.push({ c, net });
  }
  const o = RULES.crOutcome(before, total);
  cr.point = o.point; cr.last = [a, b]; cr.rolls++;
  if (o.kind === "hit" || o.kind === "natural") cr.streak++;
  else if (o.kind === "sevenOut") cr.streak = 0;
  toHouse(t, house); stat("rolls");
  const g = GS(); if (g && cr.streak > g.st.best) g.st.best = cr.streak;
  // la mesa ruidosa
  sfx("thud", t.center.x, t.center.z); if (house) sfx("chips", t.center.x, t.center.z);
  if ((o.kind === "hit" || o.kind === "natural") && cr.streak >= C_CR.hotStreak) crHot(t, cr);
  else if (o.kind === "sevenOut" && before) { sfx("grumble", t.center.x, t.center.z); for (const c of players) if (c && !c.dead && Math.random() < 0.5) faceOf(c, "sad", 2); if (cr.hotT > 0) { cr.hotT = 0; if (B.near(t.center.x, t.center.z, 14)) B.floatText(t.center.x, 1.9, t.center.z, "Siete afuera: se cortó la racha", "#ff8a7a"); } }
  if (t.api && t.api.roll) { t.api.roll(a, b); t.api.setPoint(cr.point); }
  if (B.near(t.center.x, t.center.z, 14) && house) B.floatText(t.center.x, 1.7, t.center.z, (house >= 0 ? "Casa +" : "Casa ") + fmt(house), house >= 0 ? "#6fd39b" : "#ff6a5a");
  return { total, o, house, res, before };
}
// ¡mano caliente!: festeja la mesa y la gente de alrededor; la mesa atrae más clientes un rato
function crHot(t, cr) {
  cr.hotT = C_CR.hotSec; stat("hot");
  sfx("cheer", t.center.x, t.center.z); sfx("clap", t.center.x, t.center.z);
  for (const c of B.customers) if (alive(c) && Math.hypot(c.x - t.center.x, c.z - t.center.z) < C_CR.crowdR && (c.table === t || Math.random() < 0.7)) { cheerOf(c, 1.8); addMood(c, 0.05); }
  if (B.near(t.center.x, t.center.z, 18)) B.floatText(t.center.x, 2.1, t.center.z, `¡MANO CALIENTE! ×${cr.streak}`, "#f0c24a");
  if (cr.streak === C_CR.hotStreak) B.toast("¡La mesa de dados está caliente! La gente se amontona a mirar.", "good");
}
const rollDie = () => 1 + ((Math.random() * 6) | 0);
// croupier contratado: una tirada por ronda de la mesa
function crAuto(t, seated) {
  const players = [];
  for (const se of seated) { const c = se.c; if (c.rounds <= 0 && !crHasBet(c)) { B.leaveCustomer(c); continue; } if (crPlaceBets(t, c)) players.push(c); }
  if (!players.length) return;
  crResolve(t, players, rollDie(), rollDie());
  for (const se of seated) { const c = se.c; if (alive(c) && (c.rounds <= 0 || c.budget < t.def.minBet) && !(c.crB && c.crB.line)) B.leaveCustomer(c); }
}

// =====================================================================
// BINGO: estado por sala (una partida tras otra mientras dura la sesión)
// =====================================================================
const bgSession = () => B.isOpen && hourNow() >= C_BG.startHour;
function bgState(t) { return t.bg || (t.bg = { phase: "closed", t: 0, game: 0, drawn: [], set: new Set(), last: 0, pot: 0, sold: 0, entries: [], claim: null, idle: 0, bored: 0 }); }
function bgReset(bg, refund, t) {
  if (refund && bg.sold && t) { // la sesión se cortó a mitad de partida: se devuelven los cartones
    toHouse(t, -bg.sold);
    for (const e of bg.entries) if (e.c && !e.c.dead) e.c.budget += e.paid;
  }
  bg.drawn = []; bg.set = new Set(); bg.last = 0; bg.pot = 0; bg.sold = 0; bg.entries = []; bg.claim = null; bg.idle = 0; bg.bored = 0;
}
function bgBuy(t, bg, c) {
  if (bg.entries.some(e => e.c === c)) return;
  const def = t.def, lo = Math.max(def.minBet, c.betMin), hi = Math.min(def.maxBet, c.betMax, c.budget);
  if (c.bgGames == null) c.bgGames = rndi(1, 3);
  if (c.bgGames <= 0 || hi < C_BG.cardPrice) { B.leaveCustomer(c); return; }
  const k = clamp(Math.floor(rnd(Math.max(lo, C_BG.cardPrice), hi) / C_BG.cardPrice), 1, C_BG.maxCards), paid = k * C_BG.cardPrice;
  c.budget -= paid; bg.sold += paid; bg.pot += Math.round(paid * C_BG.prizeShare);
  toHouse(t, paid); stat("cards", k);
  for (let i = 0; i < k; i++) bg.entries.push({ c, card: RULES.bgCard(), paid: i ? 0 : paid, shouted: false, gone: false, k: i });
  if (c.person && Math.random() < 0.4) c.person.api.gesture && c.person.api.gesture("press");
}
const bgPlayers = bg => { const s = new Set(); for (const e of bg.entries) if (!e.gone) s.add(e.c); return s.size; };
function bgDraw(bg) {
  const left = []; for (let n = 1; n <= 75; n++) if (!bg.set.has(n)) left.push(n);
  if (!left.length) return 0;
  const n = pick(left); bg.drawn.push(n); bg.set.add(n); bg.last = n; bg.idle = 0; bg.bored = 0;
  return n;
}
// después de cantar: ¿alguien grita bingo? (de verdad o apurado)
function bgCheckClaims(t, bg) {
  if (bg.claim) return;
  const live = bg.entries.filter(e => !e.gone && alive(e.c) && e.c.table === t);
  for (const e of live) {
    if (RULES.bgLine(e.card, bg.set) && Math.random() < C_BG.shoutChance) { bgShout(t, bg, e, true); return; }
  }
  if (live.length && Math.random() < C_BG.falseChance) {
    const near = live.filter(e => RULES.bgBest(e.card, bg.set).n === 4 && !RULES.bgLine(e.card, bg.set));
    if (near.length) bgShout(t, bg, pick(near), false);
  }
}
function bgShout(t, bg, e, valid) {
  bg.claim = { e, valid };
  const c = e.c; e.shouted = true;
  cheerOf(c, 1.6); faceOf(c, "surprised", 1.5);
  if (B.near(c.x, c.z, 16)) B.floatText(c.x, 2.4, c.z, "¡BINGO!", "#f0c24a");
  sfx("party", c.x, c.z); sfx("cheer", t.center.x, t.center.z);
}
// cartones con línea de verdad (si hay más de uno en la misma bolilla, el premio se divide)
const bgWinners = bg => bg.entries.filter(e => !e.gone && alive(e.c) && RULES.bgLine(e.card, bg.set));
function bgPay(t, bg, list) {
  const n = list.length || 1, each = Math.floor(bg.pot / n / 5) * 5, prize = each * (n - 1) + (bg.pot - each * (n - 1));
  list.forEach((e, k) => { const amt = k === 0 ? bg.pot - each * (n - 1) : each; e.c.budget += amt; e.c.flags.won = true; cheerOf(e.c, 2.2); faceOf(e.c, "happy", 3); addMood(e.c, 0.1); if (B.near(e.c.x, e.c.z, 16)) B.floatText(e.c.x, 2.6, e.c.z, "+" + fmt(amt), "#6fd39b"); });
  toHouse(t, -prize); stat("bPrize", prize); stat("bGames");
  sfx("clap", t.center.x, t.center.z);
  return prize;
}
// fin de partida: cada uno cuenta una partida más; los que ya jugaron las suyas se van
function bgEndGame(t, bg) {
  const seen = new Set();
  for (const e of bg.entries) if (!seen.has(e.c)) { seen.add(e.c); const c = e.c; if (!alive(c)) continue; c.played = true; c.rounds--; c.bgGames = (c.bgGames || 1) - 1; if (c.bgGames <= 0) B.leaveCustomer(c); }
  bgReset(bg, false); bg.phase = "pause"; bg.t = C_BG.pauseSec;
}
// paso del bingo; auto = croupier contratado (canta y verifica solo)
function bgStep(t, dt, seated, auto) {
  const bg = bgState(t);
  if (!bgSession()) { if (bg.phase !== "closed") { bgReset(bg, true, t); bg.phase = "closed"; } return bg; }
  for (const e of bg.entries) if (!e.gone && !alive(e.c)) e.gone = true;
  if (bg.claim && (bg.claim.e.gone || !alive(bg.claim.e.c))) bg.claim = null;
  switch (bg.phase) {
    case "closed": bg.phase = "sale"; bg.t = C_BG.saleSec; bg.game++; bgReset(bg, false); break;
    case "pause": bg.t -= dt; if (bg.t <= 0) { bg.phase = "sale"; bg.t = C_BG.saleSec; bg.game++; } break;
    case "sale":
      for (const se of seated) bgBuy(t, bg, se.c);
      bg.t -= dt;
      if (bg.t <= 0) { if (bgPlayers(bg) >= C_BG.minPlayers) { bg.phase = "call"; bg.idle = 0; sfx("shuffle", t.center.x, t.center.z); } else bg.t = 0.5; }
      break;
    case "call":
      if (!bgPlayers(bg)) { bgReset(bg, false); bg.phase = "sale"; bg.t = C_BG.saleSec; break; }
      if (auto) {
        if (bg.claim) { // el croupier verifica bien siempre
          const cl = bg.claim;
          if (cl.valid) { bgPay(t, bg, bgWinners(bg)); bgEndGame(t, bg); }
          else { bg.claim = null; faceOf(cl.e.c, "sad", 2); }
          break;
        }
        const n = bgDraw(bg); if (!n) { bgEndGame(t, bg); break; }
        if (t.api && t.api.spin) t.api.spin(0.7);
        sfx("click", t.center.x, t.center.z);
        bgCheckClaims(t, bg);
      } else {
        bg.idle += dt;
        // cantar lento aburre a la sala
        if (bg.idle > C_BG.slowSec) { for (const e of bg.entries) if (!e.gone && alive(e.c)) addMood(e.c, -0.01 * dt); }
        if (bg.idle > C_BG.boredSec) {
          bg.idle = C_BG.slowSec; bg.bored++;
          const live = bg.entries.filter(e => !e.gone && alive(e.c));
          if (live.length) { const e = pick(live); e.c.flags.waited = true; faceOf(e.c, "angry", 2); B.leaveCustomer(e.c); B.Rep.change(C_BG.repSlow); sfx("grumble", t.center.x, t.center.z); }
          return Object.assign(bg, { slowLeft: true });
        }
      }
      break;
  }
  if (t.api && t.api.setBoard) t.api.setBoard(bg.drawn, bg.last, bg.phase === "sale" ? "Vendiendo cartones" : bg.phase === "pause" ? "¡Hubo bingo!" : bg.phase === "call" ? `Premio ${fmt(bg.pot)}` : "20:00 h");
  return bg;
}

// =====================================================================
// GANCHOS QUE LLAMA game.js
// =====================================================================
function makeModel(type) { return type === "dados" ? makeDice() : type === "bingo" ? makeBingo() : makeRaces(); }
function makeDecor(id, g) { if (id === "deco_pantalla_carreras") makeWallScreen(g); }
function autoRound(t, seated) {
  const ty = t.d.type;
  if (ty === "dados") crAuto(t, seated);
  else if (ty === "bingo") bgStep(t, t.def.round, seated, true);
  else if (ty === "carreras") raceCustomers(t, seated);
}
// preferencia de los clientes: el bingo solo en la sesión nocturna; los dados calientes atraen más
function weight(c, t) {
  const ty = t.d.type;
  if (ty === "bingo") { if (!(B.isOpen && hourNow() >= C_BG.presaleHour)) return 0; return c.gWant === "bingo" ? 30 : 2.2; }
  if (c.gWant === "bingo") return 0.05;
  if (ty === "dados") return t.cr && t.cr.hotT > 0 ? C_CR.hotAppealMul : 1;
  if (ty === "carreras") return RC.phase === "run" ? 0.6 : 1;
  return 1;
}
function interact(t, base) {
  const ty = t.d.type;
  if (ty === "carreras") return {
    prompt() {
      const mine = RC.pBets.reduce((a, b) => a + b.amt, 0);
      if (RC.phase === "bet") return { text: `Apostar en la carrera N.º ${RC.n}`, sub: `Largan en ${Math.max(0, Math.ceil(RC.t / HOUR * 60))} min · ${mine ? `tenés ${fmt(mine)} jugados` : "apostás con tu bolsillo"} · bandeja ${fmt(t.d.tray)}` };
      if (RC.phase === "run") return { text: `Carrera N.º ${RC.n} en curso`, sub: mine ? `Tenés ${fmt(mine)} jugados` : "Esperá la próxima para apostar" };
      return { text: t.def.name, sub: B.isOpen ? "En un ratito abre la próxima carrera" : "Las carreras corren con el casino abierto" };
    },
    hold: () => 0, usable: () => true, use: () => openRacePanel(t), options: base.options, optLabel: base.optLabel,
  };
  return {
    prompt() {
      const p = base.prompt();
      if (ty === "bingo") {
        if (t.staff) return { text: "Sala de Bingo · canta el croupier", sub: p.sub };
        const h = hourNow();
        if (h < C_BG.presaleHour) return { text: "Sala de Bingo", sub: `El bingo nocturno arranca a las ${C_BG.startHour}:00 · ${p.sub}` };
        return { text: t.playerDealing ? "Estás cantando el bingo" : "Cantar el bingo (bolillero)", sub: p.sub };
      }
      if (t.staff) return p;
      return { text: t.playerDealing ? "Estás de stickman en los dados" : "Ser el stickman de los dados", sub: p.sub };
    },
    hold: base.hold, usable: base.usable, use: base.use, options: base.options, optLabel: base.optLabel,
  };
}
// la sala se llena: clientes extra que vienen solo al bingo mientras dura la sesión
let fillAcc = 0, announced = -1;
function bgFill(dt) {
  const S = ST();
  if (!B.isOpen) return;
  const h = hourNow(), halls = B.tables.filter(t => t.d.type === "bingo" && !t.dead);
  if (!halls.length) return;
  if (h >= C_BG.presaleHour && announced !== S.day) { announced = S.day; B.toast(`Bingo nocturno: a las ${C_BG.startHour}:00 se llena la sala. ${halls.some(t => t.staff) ? "El croupier canta." : `Parate en el bolillero y cantá con ${B.KEY}.`}`, "good"); }
  if (h < C_BG.presaleHour) return;
  const open = halls.filter(t => t.staff || t.playerDealing);
  if (!open.length) return;
  let free = 0; for (const t of open) free += t.seats.filter(s => !s.c).length;
  let coming = 0; for (const c of B.customers) if (!c.dead && c.gWant === "bingo" && c.state !== "play" && c.state !== "leave") coming++;
  if (free - coming <= 0 || B.customers.length >= B.MAX_ACTORS - 2) return;
  fillAcc += dt * C_BG.fillPerHour / HOUR * (h >= C_BG.startHour ? 1 : 0.5);
  while (fillAcc >= 1) { fillAcc -= 1; const c = B.spawnCustomer(Math.random() < 0.65 ? "casual" : (S.rank >= 2 ? "regular" : "casual")); if (c) c.gWant = "bingo"; }
}
function update(dt) {
  const g = GS(); if (!g) return;
  raceUpdate(dt);
  bgFill(dt);
  for (const t of B.tables) {
    if (t.d.type === "dados" && t.cr && t.cr.hotT > 0) t.cr.hotT = Math.max(0, t.cr.hotT - dt);
    if (t.d.type === "bingo" && !bgSession() && t.bg && t.bg.phase !== "closed") bgStep(t, dt, [], true); // se terminó la sesión
  }
}
let frameT = 0;
function frame(dt) {
  RC.gallop += RC.phase === "run" ? dt : 0;
  frameT -= dt;
  if (frameT <= 0) { frameT = RC.phase === "run" ? 1 / 15 : 0.5; raceDraw(); }
}
function onEndDay(notes) {
  const g = GS(); if (!g) return;
  const s = g.st;
  if (s.rolls) notes.push(`Dados: ${s.rolls} tiradas${s.hot ? `, ${s.hot} mano${s.hot > 1 ? "s" : ""} caliente${s.hot > 1 ? "s" : ""}` : ""} · mejor racha ${s.best}.`);
  if (s.cards) notes.push(`Bingo nocturno: ${s.cards} cartones vendidos, ${s.bGames} partida${s.bGames === 1 ? "" : "s"} con premio (${fmt(s.bPrize)} en premios).`);
  if (s.races) notes.push(`Carreras: ${s.races} carreras, ${s.tickets} boletos vendidos.`);
  if (s.pBet) notes.push(`Tus apuestas en las carreras: jugaste ${fmt(s.pBet)} y cobraste ${fmt(s.pWon)} (${s.pWon - s.pBet >= 0 ? "ganaste" : "perdiste"} ${fmt(Math.abs(s.pWon - s.pBet))}).`);
  RC.phase = "idle"; RC.bets = []; RC.pBets = [];
  for (const t of B.tables) { if (t.bg) { bgReset(t.bg, false); t.bg.phase = "closed"; } if (t.cr) { t.cr.point = 0; t.cr.streak = 0; t.cr.hotT = 0; if (t.api && t.api.setPoint) t.api.setPoint(0); } }
}

// =====================================================================
// VENTANILLA DE CARRERAS (panel): apostar con el bolsillo
// =====================================================================
let raceTable = null;
function openRacePanel(t) {
  raceTable = t || raceTable;
  const S = ST(), mine = RC.pBets;
  let body;
  if (RC.phase !== "bet") body = `<p>${RC.phase === "run" ? `La carrera N.º ${RC.n} está corriendo. Mirá la pantalla.` : B.isOpen ? "En un ratito se abren las apuestas de la próxima carrera." : "Las carreras corren solo con el casino abierto."}</p>`;
  else {
    const stakes = C_RC.stakes;
    const rows = RC.horses.map(h => `<div class="item"><span class="sw" style="background:${h.silk}"></span>
      <div class="t"><b>N.º ${h.no} · ${esc(h.name)} · <span class="num">x${h.odds.toFixed(1)}</span></b><span>${h.odds < 2.6 ? "Favorito" : h.odds < 5 ? "Tiene chances" : "Batacazo"} · con ${fmt(100)} cobrás ${fmt(RULES.racePayout(100, h.odds))}</span></div>
      <div class="btns">${stakes.map(a => `<button class="sm" data-gact="rbet" data-h="${h.i}" data-a="${a}" ${S.pocket < a ? "disabled" : ""}>${fmt(a)}</button>`).join("")}</div></div>`).join("");
    body = `<p>Carrera N.º <b>${RC.n}</b> · largan en <b>${Math.max(0, Math.ceil(RC.t / HOUR * 60))} min</b> · bolsillo <b class="num">${fmt(S.pocket)}</b>. Apostás con la agencia hípica: si ganás, cobrás cuota × apuesta en el bolsillo.</p>
      <div class="list">${rows}</div>${mine.length ? `<p>Tus boletos: ${mine.map(b => `N.º ${RC.horses[b.h].no} ${fmt(b.amt)}`).join(" · ")}</p>` : ""}`;
  }
  B.openPanel("races", `<h2>Ventanilla de carreras</h2>${body}<div class="actions"><button class="ghost" data-act="close">Cerrar</button></div>`);
}
function playerBet(h, amt) {
  const S = ST();
  if (RC.phase !== "bet" || !RC.horses[h] || !(amt > 0)) return false;
  if (S.pocket < amt) { B.toast("No te alcanza lo que tenés en el bolsillo.", "bad"); B.SFX.bad(); return false; }
  S.pocket -= amt; RC.pBets.push({ h, amt }); stat("pBet", amt);
  B.SFX.tick(); B.updateHud(true);
  B.toast(`Boleto: ${fmt(amt)} a N.º ${RC.horses[h].no} ${RC.horses[h].name} (x${RC.horses[h].odds.toFixed(1)}).`, "");
  return true;
}
document.getElementById("panelBody").addEventListener("click", e => {
  const b = e.target.closest("button[data-gact]"); if (!b || b.disabled) return;
  if (b.dataset.gact === "rbet") { playerBet(+b.dataset.h, +b.dataset.a); if (B.ui.panel === "races") openRacePanel(); }
});

// =====================================================================
// MINIJUEGOS (se enganchan al núcleo de minigames.js)
// =====================================================================
const MGX = root.CasinoMG, K = MGX && MGX.kit;
let MG_THROW = null; // tiro de los dados (para las pruebas)
const style = document.createElement("style");
style.textContent = `
.cr-cv{display:block;width:100%;height:auto;border-radius:8px;border:1px solid var(--brass-dim);touch-action:none;cursor:grab;background:#0f3326}
.cr-cv.drag{cursor:grabbing}
.cr-top{display:flex;gap:6px 12px;align-items:center;flex-wrap:wrap;font-size:.88rem;color:var(--ivory-dim)}
.cr-pt{font-family:var(--font-num);color:var(--ivory);background:#15171a;border:1px solid var(--brass-dim);border-radius:5px;padding:1px 8px}
.cr-pt.on{background:var(--ivory);color:#15171a}
.cr-hot{color:var(--heat);font-weight:700}
.bg-top{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.bg-ball{width:58px;height:58px;border-radius:50%;background:var(--ivory);color:#15171a;display:grid;place-items:center;font:700 1.2rem/1 var(--font-num);box-shadow:inset -4px -6px 10px rgba(0,0,0,.25);flex:none}
.bg-ball small{display:block;font-size:.7rem}
.bg-ball.off{background:#1a2240;color:#56608a}
.bg-grid{display:grid;grid-template-columns:repeat(15,1fr);gap:2px;flex:1 1 300px;min-width:0}
.bg-grid i{font:600 9px/15px var(--font-num);text-align:center;border-radius:3px;background:#1a2240;color:#56608a;font-style:normal}
.bg-grid i.on{background:var(--brass);color:#15171a}
.bg-grid i.last{background:#ffe27a;color:#15171a;box-shadow:0 0 0 1px #fff}
.bg-card{display:grid;grid-template-columns:repeat(5,34px);gap:3px;justify-content:center}
.bg-card b{display:grid;place-items:center;height:30px;border-radius:4px;background:#f6f0e0;color:#15171a;font:600 .9rem var(--font-num)}
.bg-card b.on{background:#d4423f;color:#fff}
.bg-card b.h{background:#5a6aa0;color:#fff;font-size:.6rem}
.bg-card .L{background:transparent;color:var(--brass);font-family:var(--font-display);height:auto}
.bg-claim{display:grid;gap:6px;justify-items:center}
`;
document.head.appendChild(style);

if (K) {
  const { msg, render, btn, setBar, mistake, live, seatNo, closeSession, clamp: kclamp } = K;
  const C_K = root.CasinoMGConfig || {};

  // ------------------------------------------------------------------
  // DADOS: minijuego del stickman (kind "cr")
  // ------------------------------------------------------------------
  const CW = 600, CH = 220, DR = 11; // canvas lógico y medio lado de un dado
  const dice2 = () => [{ x: 54, y: 96, vx: 0, vy: 0, face: rollDie(), acc: 0, rot: 0 }, { x: 70, y: 124, vx: 0, vy: 0, face: rollDie(), acc: 0, rot: 0.4 }];
  function crOpen(s) { s.phase = "wait"; s.dice = dice2(); s.round = s.t.mgRound || 0; s.ptime = 0; s.calls = 0; s.mistakes = 0; s.patience = CFG.patienceSec; crState(s.t); }
  function crPlayers(s, seated) {
    const out = [];
    for (const se of seated) { const c = se.c; if (c.rounds <= 0 && !crHasBet(c)) { B.leaveCustomer(c); continue; } if (crPlaceBets(s.t, c)) out.push(c); }
    return out;
  }
  function crToBets(s, seated) {
    s.players = crPlayers(s, seated); s.opts = null; s.res = null;
    if (!s.players.length) { s.phase = "wait"; render(); return; }
    s.phase = "bets"; s.patience = CFG.patienceSec; s.dice = dice2(); s.ptime = 0; s.actions = 0; s.mistakes = 0; s.nulls = 0; render();
  }
  function crUpdate(s, dt, seated) {
    if (s.phase === "wait") { if (seated.length) crToBets(s, seated); return; }
    if (s.phase === "bets") {
      const n = s.players.length;
      s.players = s.players.filter(c => live(s, { c }));
      for (const se of seated) if (!s.players.includes(se.c) && crPlaceBets(s.t, se.c)) s.players.push(se.c);
      if (!s.players.length) { s.phase = "wait"; render(); return; }
      if (s.players.length !== n) render();
      if (!s.drag) s.patience -= dt;
      if (s.patience <= 0) {
        for (const c of s.players) { c.flags.waited = true; B.leaveCustomer(c); }
        msg("Tardaste demasiado en tirar: los jugadores se cansaron y se fueron.", "bad"); B.SFX.bad();
        s.phase = "wait"; s.players = []; render();
      }
      return;
    }
    if (s.phase === "roll") { crPhys(s, dt); return; }
    if (s.phase === "call") {
      s.ptime += dt;
      if (s.ptime > C_CR.afkSec) { for (const c of s.players) if (live(s, { c })) { c.flags.waited = true; B.leaveCustomer(c); } msg("No cantaste la tirada: los jugadores se fueron.", "bad"); B.Rep.change(-1); s.phase = "wait"; render(); }
      return;
    }
    if (s.phase === "summary") { s.timer -= dt; if (s.timer <= 0) { msg(""); crToBets(s, seated); } }
  }
  // física 2D de la tirada: fricción, rebote en barandas, pirámides de la pared del fondo
  function crPhys(s, dt) {
    let sub = Math.ceil(dt / (1 / 120));
    const h = dt / sub;
    while (sub--) {
      for (const d of s.dice) {
        const sp = Math.hypot(d.vx, d.vy);
        if (sp > 0) { const dec = Math.min(sp, (520 + sp * 0.9) * h); d.vx -= d.vx / sp * dec; d.vy -= d.vy / sp * dec; }
        d.x += d.vx * h; d.y += d.vy * h;
        if (d.y < DR + 6) { d.y = DR + 6; d.vy = Math.abs(d.vy) * 0.55; }
        if (d.y > CH - DR - 6) { d.y = CH - DR - 6; d.vy = -Math.abs(d.vy) * 0.55; }
        if (d.x < DR + 6) { d.x = DR + 6; d.vx = Math.abs(d.vx) * 0.5; }
        if (d.x > CW - DR - 14) { // la pared del fondo
          if (d.vx > 0) { s.hitBack = true; const v = d.vx; d.vx = -v * rnd(0.4, 0.62); d.vy += rnd(-0.55, 0.55) * v; d.acc += 40; sfx("thud", s.t.center.x, s.t.center.z, { gain: 0.4 }); }
          d.x = CW - DR - 14;
        }
        d.acc += Math.hypot(d.vx, d.vy) * h; d.rot += Math.hypot(d.vx, d.vy) * h * 0.04;
        while (d.acc > 26) { d.acc -= 26; const opts = [1, 2, 3, 4, 5, 6].filter(f => f !== d.face && f !== 7 - d.face); d.face = opts[(Math.random() * opts.length) | 0]; }
      }
      const a = s.dice[0], b = s.dice[1], dx = b.x - a.x, dy = b.y - a.y, dd = Math.hypot(dx, dy);
      if (dd < DR * 2 && dd > 0) { // choque entre dados
        const nx = dx / dd, ny = dy / dd, p = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (p > 0) { a.vx -= p * nx * 0.9; a.vy -= p * ny * 0.9; b.vx += p * nx * 0.9; b.vy += p * ny * 0.9; a.acc += 10; b.acc += 10; }
        const push = (DR * 2 - dd) / 2; a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
      }
    }
    s.rollT += dt;
    if (s.dice.every(d => Math.hypot(d.vx, d.vy) < 6) || s.rollT > 6) {
      for (const d of s.dice) { d.vx = d.vy = 0; }
      if (!s.hitBack) { s.nulls++; msg("Tiro nulo: los dados tienen que pegar contra la pared del fondo. Tirá con más fuerza.", "bad"); B.SFX.bad(); s.phase = "bets"; s.dice = dice2(); s.patience = Math.max(s.patience, 6); render(); return; }
      const a = s.dice[0].face, b = s.dice[1].face;
      s.result = [a, b]; s.phase = "call"; s.ptime = 0;
      s.opts = RULES.crCallOptions(crState(s.t).point, a + b);
      render();
    }
  }
  // tirar: vx, vy en px/s del canvas (el mouse o el tirador)
  function crThrow(s, vx, vy, who) {
    if (s.phase !== "bets") return false;
    const p = Math.hypot(vx, vy);
    if (p > C_CR.maxPower) { s.nulls = (s.nulls || 0) + 1; msg("¡Muy fuerte! Un dado saltó de la mesa: tiro nulo. Tirá de nuevo.", "bad"); B.SFX.bad(); s.dice = dice2(); render(); return false; }
    if (p < 80) { msg("Soltaste los dados sin tirarlos: arrastrá y soltá con un movimiento hacia la pared.", ""); s.dice = dice2(); render(); return false; }
    s.phase = "roll"; s.rollT = 0; s.hitBack = false; s.by = who || "vos"; s.actions++;
    for (let i = 0; i < 2; i++) { const d = s.dice[i]; d.vx = vx * rnd(0.92, 1.06); d.vy = vy * rnd(0.9, 1.1) + rnd(-40, 40); }
    sfx("chips", s.t.center.x, s.t.center.z, { gain: 0.5 }); msg(who === "tirador" ? "El tirador sopla los dados y tira…" : "¡Dados en el aire!", ""); render();
    return true;
  }
  MG_THROW = (s, vx, vy) => crThrow(s, vx, vy, "vos");
  function crAct(s, a, v) {
    if (a === "shooter" && s.phase === "bets") { crThrow(s, rnd(1050, 1500), rnd(-260, 260), "tirador"); return; }
    if (a === "call" && s.phase === "call") {
      const cr = crState(s.t), [d1, d2] = s.result, right = RULES.crLabel(cr.point, d1 + d2);
      const ok = s.opts[+v] === right;
      s.actions++;
      if (!ok) B.Rep.change(C_CR.repMistake - (C_K.repMistake || 0));
      if (!ok) mistake(s, `¡Mal cantado! Era «${right}». El boxman te corrige y paga bien.`);
      const r = crResolve(s.t, s.players.filter(c => live(s, { c })), d1, d2);
      s.res = r; crFinish(s, ok);
    }
  }
  function crFinish(s, ok) {
    const S = ST(), r = s.res, par = Math.max(1, s.actions) * C_CR.parSec, sf = kclamp(par / Math.max(0.1, s.ptime + 0.5), 0.25, 1);
    const perfect = ok && !s.mistakes;
    let tips = 0;
    if (ok) { let won = 0; for (const x of r.res) if (x.net > 0) won += x.net; tips = Math.round(won * C_CR.callTip * sf / 5) * 5; }
    if (perfect) B.Rep.change(C_CR.repPerfect);
    if (tips > 0) { const room = B.Pocket.room(), inP = Math.min(tips, room); S.pocket += inP; if (tips > inP) s.t.d.tray += tips - inP; B.SFX.cash(); }
    const xp = C_CR.xpRoll + (perfect ? C_CR.xpPerfect : 0);
    S.today.st.handsByHand++; B.Rank.add(xp); B.checkObjectives(); B.updateHud(true);
    s.round++; s.t.mgRound = s.round;
    const cr = crState(s.t);
    msg(`${r.total} (${s.result[0]}+${s.result[1]}) · ${RULES.crLabel(r.before, r.total)}. ${r.house >= 0 ? "Casa +" + fmt(r.house) : "La casa paga " + fmt(-r.house)}${tips ? ` · propina ${fmt(tips)}` : ""} · +${xp} XP${cr.streak >= 2 ? ` · racha ${cr.streak}` : ""}`, ok ? "good" : "bad");
    for (const c of s.players) if (live(s, { c }) && (c.rounds <= 0 || c.budget < s.t.def.minBet) && !(c.crB && c.crB.line)) B.leaveCustomer(c);
    s.phase = "summary"; s.timer = 1.6; render();
  }
  function crDrawCanvas(s) {
    const cv = $("crCv"); if (!cv) return;
    const g = cv.getContext("2d"), cr = crState(s.t);
    g.fillStyle = "#0f3326"; g.fillRect(0, 0, CW, CH);
    g.strokeStyle = "rgba(243,233,210,.35)"; g.lineWidth = 2; g.strokeRect(6, 6, CW - 12, CH - 12);
    g.fillStyle = "rgba(243,233,210,.12)"; g.font = "bold 40px Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("P A S E", CW / 2, CH / 2);
    // línea de tiro y pared con pirámides
    g.strokeStyle = "rgba(240,194,74,.5)"; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(CW * 0.34, 10); g.lineTo(CW * 0.34, CH - 10); g.stroke(); g.setLineDash([]);
    g.fillStyle = "#2a2d34"; g.fillRect(CW - 14, 6, 10, CH - 12);
    g.fillStyle = "#6a6e78"; for (let y = 8; y < CH - 10; y += 12) { g.beginPath(); g.moveTo(CW - 14, y); g.lineTo(CW - 20, y + 6); g.lineTo(CW - 14, y + 12); g.fill(); }
    // punto
    g.textAlign = "left"; g.font = "bold 14px sans-serif"; g.fillStyle = cr.point ? "#f3e9d2" : "rgba(243,233,210,.6)"; g.fillText(cr.point ? `Punto: ${cr.point}` : "Salida (sin punto)", 14, 20);
    if (s.drag && s.phase === "bets") { g.fillStyle = "rgba(240,194,74,.85)"; g.fillText("¡Soltá hacia la pared!", 14, CH - 16); }
    else if (s.phase === "bets") { g.fillStyle = "rgba(243,233,210,.7)"; g.fillText("Arrastrá los dados y soltalos con impulso →", 14, CH - 16); }
    for (const d of s.dice) {
      g.save(); g.translate(d.x, d.y); g.rotate(d.rot);
      g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(-DR + 3, -DR + 4, DR * 2, DR * 2);
      g.fillStyle = "#c8202a"; g.fillRect(-DR, -DR, DR * 2, DR * 2); g.strokeStyle = "#7a1016"; g.lineWidth = 1.5; g.strokeRect(-DR, -DR, DR * 2, DR * 2);
      drawPips(g, d.face, 0, 0, DR * 2, "#f6f0e0");
      g.restore();
    }
  }
  function crFrame(s) {
    crDrawCanvas(s);
    if (s.phase === "bets") setBar(s.patience / CFG.patienceSec, s.patience < CFG.patienceSec * 0.4);
    else if (s.phase === "call") { const lim = C_CR.parSec * 3; setBar(1 - s.ptime / lim, s.ptime > lim * 0.6); }
    else if (s.phase === "wait") setBar(0);
  }
  // arrastrar y soltar con el mouse (o el dedo)
  const evPos = (cv, e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * CW, y: (e.clientY - r.top) / r.height * CH, t: e.timeStamp || performance.now() }; };
  document.addEventListener("pointerdown", e => {
    const cv = e.target && e.target.id === "crCv" ? e.target : null, s = MGX.active;
    if (!cv || !s || s.kind !== "cr" || s.phase !== "bets") return;
    e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) { /* */ }
    const p = evPos(cv, e); s.drag = { id: e.pointerId, pts: [p] }; cv.classList.add("drag");
    crHold(s, p);
  });
  document.addEventListener("pointermove", e => {
    const s = MGX.active; if (!s || s.kind !== "cr" || !s.drag || s.drag.id !== e.pointerId) return;
    const cv = $("crCv"); if (!cv) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : null; // con cuadros lentos el navegador junta movimientos
    for (const ce of (evs && evs.length ? evs : [e])) s.drag.pts.push(evPos(cv, ce));
    while (s.drag.pts.length > 24) s.drag.pts.shift();
    crHold(s, s.drag.pts[s.drag.pts.length - 1]);
  });
  const endDrag = e => {
    const s = MGX.active; if (!s || s.kind !== "cr" || !s.drag || s.drag.id !== e.pointerId) return;
    const cv = $("crCv"); if (cv) { cv.classList.remove("drag"); const p = evPos(cv, e); s.drag.pts.push(p); }
    const pts = s.drag.pts; s.drag = null;
    // ignora el tramo final quieto (el soltar llega tarde si el cuadro está lento) y mide el último impulso
    let li = pts.length - 1; while (li > 0 && Math.hypot(pts[li].x - pts[li - 1].x, pts[li].y - pts[li - 1].y) < 1.5) li--;
    const last = pts[li]; let first = pts[0];
    for (let i = 0; i <= li; i++) if (last.t - pts[i].t <= 120) { first = pts[i]; break; }
    if (first === last && li > 0) first = pts[li - 1];
    const dtt = Math.max(0.016, (last.t - first.t) / 1000);
    s.lastDrag = { n: pts.length, li, dx: Math.round(last.x - first.x), dt: Math.round(dtt * 1000) };
    crThrow(s, (last.x - first.x) / dtt, (last.y - first.y) / dtt, "vos");
  };
  document.addEventListener("pointerup", endDrag); document.addEventListener("pointercancel", endDrag);
  function crHold(s, p) { const x = Math.min(CW * 0.34, Math.max(20, p.x)), y = kclamp(p.y, 24, CH - 24); s.dice[0].x = x - 8; s.dice[0].y = y - 8; s.dice[1].x = x + 8; s.dice[1].y = y + 8; }
  const CR_SUB = { wait: "Esperando jugadores en la mesa de dados…", bets: "Apuestas hechas. Tirá vos (arrastrá y soltá los dados) o pasale los dados al tirador.", roll: "Los dados ruedan…", call: "Cantá la tirada: ¿qué pasa con el pase y el no pase?", summary: "Fin de la tirada." };
  function crView(s) {
    const cr = crState(s.t);
    const top = `<div class="cr-top"><span class="cr-pt ${cr.point ? "on" : ""}">${cr.point ? "ON · punto " + cr.point : "OFF · salida"}</span>${cr.streak ? `<span>Racha ${cr.streak}</span>` : ""}${cr.hotT > 0 ? `<span class="cr-hot">¡Mano caliente!</span>` : ""}${s.result && (s.phase === "call" || s.phase === "summary") ? `<span class="cr-pt">${s.result[0]} + ${s.result[1]} = ${s.result[0] + s.result[1]}</span>` : ""}</div>`;
    const rows = (s.players || []).map(c => `<div class="mg-row${live(s, { c }) ? "" : " gone"}"><span class="a">${seatNo(s.t, c) || "–"} · ${esc(c.type.name)}</span><span class="n">${fmt(c.budget)}</span><span>${esc(crBetText(c.crB))}</span><span class="s"></span></div>`).join("");
    const body = top + `<canvas id="crCv" class="cr-cv" width="${CW}" height="${CH}" aria-label="Mesa de dados: arrastrá y soltá los dados"></canvas>` + (rows ? `<div class="mg-rows">${rows}</div>` : `<div class="mg-empty">No hay nadie en la mesa. Cuando lleguen jugadores, aparecen acá.</div>`);
    let acts = "";
    if (s.phase === "wait") acts = btn("shooter", "", "Pasar los dados al tirador", "pri", null, true);
    else if (s.phase === "bets") acts = btn("shooter", "", "Pasar los dados al tirador", "pri", "Espacio");
    else if (s.phase === "roll") acts = btn("x", "", "Ruedan…", "", null, true);
    else if (s.phase === "call") acts = s.opts.map((o, i) => btn("call", i, esc(o), "", i + 1)).join("");
    else acts = btn("x", "", "Siguiente tirada…", "", null, true);
    return { title: `Dados${s.round ? " · tirada " + s.round : ""}`, sub: CR_SUB[s.phase], body, acts };
  }
  MGX.register("dados", {
    kind: "cr", open: crOpen, update: crUpdate, view: crView, act: crAct, frame: crFrame,
    leave(s) { const mid = s.phase === "roll" || s.phase === "call"; if (mid) for (const c of s.players || []) if (live(s, { c })) c.flags.waited = true; closeSession(mid ? "Dejaste la tirada por la mitad: los jugadores se molestan." : "Dejaste la mesa de dados.", mid ? "bad" : ""); },
    hint: "Sos el stickman: arrastrá los dados con el mouse y soltalos con impulso para que peguen en la pared del fondo (o pasáselos al tirador con Espacio). Después cantá la tirada: en la salida 7 y 11 ganan el pase, 2-3-12 son craps; si sale un punto, gana el pase cuando se repite y pierde con el 7.",
  });

  // ------------------------------------------------------------------
  // BINGO: minijuego del que canta (kind "bg")
  // ------------------------------------------------------------------
  function bgOpen(s) { s.round = s.t.mgRound || 0; s.mistakes = 0; s.ann = null; bgState(s.t); }
  function bgUpdate(s, dt, seated) {
    const bg = bgStep(s.t, dt, seated, false);
    const key = bg.phase + "|" + bg.drawn.length + "|" + bg.entries.length + "|" + (bg.claim ? 1 : 0) + "|" + (s.ann ? 1 : 0) + "|" + Math.ceil(bg.t);
    if (bg.slowLeft) { bg.slowLeft = false; msg("¡Cantás muy lento! Un jugador se aburrió y se fue.", "bad"); }
    if (key !== s.key) { s.key = key; render(); }
  }
  function bgAct(s, a, v) {
    const t = s.t, bg = bgState(t);
    if (a === "draw" && bg.phase === "call" && !s.ann && !s.verify) {
      if (bg.claim) { // se ignoró un bingo cantado
        const cl = bg.claim; bg.claim = null;
        if (cl.valid) { s.mistakes++; B.Rep.change(C_BG.repMissed); B.SFX.bad(); cl.e.c.flags.waited = true; faceOf(cl.e.c, "angry", 3); B.leaveCustomer(cl.e.c); msg("¡Te pasaste un bingo! El asiento cantó y no lo verificaste: se fue furioso.", "bad"); }
        else msg("Seguiste de largo: era un bingo falso, así que no pasó nada.", "");
      }
      const n = bgDraw(bg); if (!n) return;
      if (t.api && t.api.spin) t.api.spin(0.8);
      sfx("click", t.center.x, t.center.z);
      s.ann = { n, opts: [n].concat(RULES.bgConfusables(n).slice(0, 2)).sort(() => Math.random() - 0.5) };
      render(); return;
    }
    if (a === "ann" && s.ann) {
      const n = s.ann.n, said = +v; s.ann = null;
      stat("callsByHand"); B.Rank.add(C_BG.xpCall >= 1 ? C_BG.xpCall : (Math.random() < C_BG.xpCall ? 1 : 0), true);
      if (said !== n) { B.Rep.change(C_BG.repWrongCall - (C_K.repMistake || 0)); mistake(s, `¡Cantaste ${RULES.bgName(said)} y la bolilla dice ${RULES.bgName(n)}! La sala protesta.`); for (const e of bg.entries) if (!e.gone && alive(e.c) && Math.random() < 0.3) faceOf(e.c, "angry", 1.5); }
      else { msg(`${RULES.bgName(n)}${n % 11 === 0 ? " · ¡capicúa!" : ""}`, ""); }
      bgCheckClaims(t, bg);
      if (bg.claim) msg(`¡BINGO! Grita el asiento ${seatNo(t, bg.claim.e.c) || "?"}. Verificá el cartón.`, "good");
      render(); return;
    }
    if (a === "verify" && bg.claim) { s.verify = true; render(); return; }
    if (a === "verdict" && bg.claim && s.verify) {
      const cl = bg.claim, sayValid = v === "ok"; s.verify = false; bg.claim = null;
      const n = seatNo(t, cl.e.c) || "?";
      if (cl.valid && sayValid) {
        const prize = bgPay(t, bg, bgWinners(bg));
        stat("bingosOk"); B.Rep.change(C_BG.repGame); B.Rank.add(C_BG.xpGame);
        const tip = Math.round(prize * C_BG.tipPerGame / 5) * 5; if (tip > 0) { const S = ST(), inP = Math.min(tip, B.Pocket.room()); S.pocket += inP; if (tip > inP) t.d.tray += tip - inP; B.SFX.cash(); }
        msg(`¡Bingo válido del asiento ${n}! Premio ${fmt(prize)}${tip ? ` · propina ${fmt(tip)}` : ""}.`, "good"); B.SFX.coin();
        s.round++; t.mgRound = s.round; ST().today.st.handsByHand++; B.checkObjectives();
        bgEndGame(t, bg);
      } else if (cl.valid && !sayValid) {
        s.mistakes++; B.Rep.change(C_BG.repWrongVerdict); B.SFX.bad(); cl.e.c.flags.waited = true; faceOf(cl.e.c, "angry", 3); B.leaveCustomer(cl.e.c);
        msg(`¡Error! El cartón del asiento ${n} tenía línea completa. Se va furioso y la partida sigue.`, "bad");
      } else if (!cl.valid && sayValid) {
        s.mistakes++; B.Rep.change(C_BG.repWrongVerdict); B.SFX.bad();
        const prize = bgPay(t, bg, [cl.e]);
        msg(`¡Error! Ese cartón no tenía línea y pagaste ${fmt(prize)}. Los demás protestan.`, "bad");
        for (const e of bg.entries) if (e !== cl.e && !e.gone && alive(e.c)) faceOf(e.c, "angry", 2);
        bgEndGame(t, bg);
      } else { B.Rank.add(1); B.SFX.tick(); faceOf(cl.e.c, "sad", 2); msg(`Bien visto: al asiento ${n} le faltaba un número. Seguí cantando.`, "good"); }
      B.updateHud(true); render(); return;
    }
  }
  function bgFrame(s) {
    const bg = bgState(s.t);
    if (bg.phase === "call" && !bg.claim) setBar(1 - bg.idle / C_BG.boredSec, bg.idle > C_BG.slowSec);
    else if (bg.phase === "sale") setBar(bg.t / C_BG.saleSec);
    else setBar(0);
  }
  function bgCardHtml(e, set) {
    const head = "BINGO".split("").map(L => `<b class="L">${L}</b>`).join("");
    return `<div class="bg-card">${head}${e.card.map(n => n === 0 ? `<b class="h">LIBRE</b>` : `<b class="${set.has(n) ? "on" : ""}">${n}</b>`).join("")}</div>`;
  }
  function bgView(s) {
    const t = s.t, bg = bgState(t), S = ST();
    const grid = Array.from({ length: 75 }, (_, i) => `<i class="${bg.set.has(i + 1) ? (i + 1 === bg.last ? "on last" : "on") : ""}">${i + 1}</i>`).join("");
    const ball = bg.last ? `<div class="bg-ball"><span><small>${RULES.bgLetter(bg.last)}</small>${bg.last}</span></div>` : `<div class="bg-ball off">–</div>`;
    const players = new Map(); for (const e of bg.entries) if (!e.gone) { const p = players.get(e.c) || { c: e.c, k: 0, best: 0 }; p.k++; p.best = Math.max(p.best, RULES.bgBest(e.card, bg.set).n); players.set(e.c, p); }
    const rows = [...players.values()].map(p => `<div class="mg-row${alive(p.c) ? "" : " gone"}"><span class="a">${seatNo(t, p.c) || "–"} · ${esc(p.c.type.name)}</span><span class="n">${p.k} cartón${p.k > 1 ? "es" : ""}</span><span>${p.best >= 4 ? "¡Le falta una!" : `mejor línea ${p.best}/5`}</span><span class="s"></span></div>`).join("");
    let body = `<div class="bg-top">${ball}<div class="bg-grid">${grid}</div></div>`;
    if (s.verify && bg.claim) body += `<div class="bg-claim"><span class="mg-q">Cartón del asiento ${seatNo(t, bg.claim.e.c) || "?"}: ¿tiene una línea completa (fila, columna o diagonal) con las bolillas que salieron?</span>${bgCardHtml(bg.claim.e, bg.set)}</div>`;
    else body += rows ? `<div class="mg-rows">${rows}</div>` : `<div class="mg-empty">${bg.phase === "closed" ? `La sala abre a las ${C_BG.startHour}:00.` : "Todavía no hay jugadores con cartón."}</div>`;
    let acts = "", sub = "";
    const h = hourNow();
    if (bg.phase === "closed") { sub = h < C_BG.startHour ? `El bingo nocturno arranca a las ${C_BG.startHour}:00. Esperá acá o volvé más tarde.` : "El casino está cerrado."; acts = btn("x", "", "Esperando la sesión…", "", null, true); }
    else if (bg.phase === "sale") { sub = `Se venden cartones a ${fmt(C_BG.cardPrice)} (premio: ${Math.round(C_BG.prizeShare * 100)}% de lo vendido). Hacen falta ${C_BG.minPlayers} jugadores.`; acts = btn("x", "", `Vendiendo cartones… pozo ${fmt(bg.pot)}`, "", null, true); }
    else if (bg.phase === "pause") { sub = "¡Hubo bingo! En un momento empieza la próxima partida."; acts = btn("x", "", "Próxima partida…", "", null, true); }
    else if (s.verify && bg.claim) { sub = `Premio ${fmt(bg.pot)}. Verificá bien: pagar un bingo falso o rechazar uno bueno te cuesta reputación.`; acts = btn("verdict", "ok", "Bingo válido: pagar", "", 1) + btn("verdict", "no", "Bingo falso: seguir", "alt", 2); }
    else if (s.ann) { sub = "Mirá la bolilla y cantala bien."; acts = s.ann.opts.map((n, i) => btn("ann", n, `Cantar ${RULES.bgName(n)}`, "", i + 1)).join(""); }
    else if (bg.claim) { sub = `¡El asiento ${seatNo(t, bg.claim.e.c) || "?"} cantó BINGO! Verificá el cartón antes de seguir.`; acts = btn("verify", "", "Verificar el cartón", "pri", "E") + btn("draw", "", "Seguir cantando", "alt", 1); }
    else { sub = `Premio ${fmt(bg.pot)} · ${bg.drawn.length} bolillas. Sacá la próxima: si tardás, la sala se aburre.`; acts = btn("draw", "", "Sacar bolilla", "pri", "E"); }
    void S;
    return { title: `Bingo nocturno${bg.game ? " · partida " + bg.game : ""}`, sub, body, acts };
  }
  MGX.register("bingo", {
    kind: "bg", open: bgOpen, update: bgUpdate, view: bgView, act: bgAct, frame: bgFrame,
    leave(s) { const bg = bgState(s.t), mid = bg.phase === "call"; s.ann = null; s.verify = false; closeSession(mid ? "Dejaste el bolillero en plena partida: la sala espera un rato y se va." : "Dejaste el bolillero.", mid ? "bad" : ""); },
    hint: `Cantás el bingo: con ${B.KEY} sacás una bolilla del bolillero y elegís el número que leés (1-3). Cuando alguien grita ¡BINGO!, verificá el cartón: pagá solo si tiene una fila, columna o diagonal completa con las bolillas que salieron.`,
  });
}

// =====================================================================
// AL CARGAR: las mesas guardadas se crearon antes que este archivo → se rehacen con su modelo
// =====================================================================
function respawnMine() {
  for (const t of B.tables.slice()) if (isMine(t.d.type) && !t.cr && !t.bg && !(t.group.userData.api)) { B.despawnTable(t); B.spawnTable(t.d); }
  for (const o of B.decorObjs) if (o.d.id === "deco_pantalla_carreras" && !o.group.userData.gamesBuilt) { const inner = o.group.children[0] || o.group; if (!inner.children.length) makeWallScreen(inner); o.group.userData.gamesBuilt = true; }
  B.assignDealers();
}

root.CasinoGames = {
  makeModel, makeDecor, autoRound, weight, interact, update, frame, onEndDay, rules: RULES, cfg: GC,
  openRacePanel, playerBet,
  debug: {
    get race() { return RC; }, raceDraw, newRace, raceStart, raceFinish,
    dice: t => crState(t), bingo: t => bgState(t), bgStep, crResolve,
    throwDice(vx, vy) { const s = MGX && MGX.active; return !!(s && s.kind === "cr" && MG_THROW && MG_THROW(s, vx, vy)); },
    get stats() { const g = GS(); return g && g.st; }, respawnMine,
  },
};
// recién ahora window.CasinoGames existe: spawnTable() de game.js puede pedirle el modelo real
respawnMine();
GS();
})();
