/* Casino Dorado · vip.js — SALÓN ULTRA VIP SECRETO (v2) · contenido opcional +18 (Pausa → "Contenido +18")
 *  - Misión de Madame Rubí: cuando llegás a Director, la estantería del fondo del salón principal suena hueca.
 *    Aceptás, pagás la obra secreta y detrás de la estantería aparece un salón con barra privada, caño de baile
 *    y un reservado donde entra 1 cliente con 1 acompañante (puerta cerrada: no se ve nada).
 *  - Contratás acompañantes (todas adultas, cada una elige trabajar): cobran por noche y la mitad de cada servicio.
 *  - Candado: cerrado no entra nadie (y es casi imposible que el inspector lo encuentre); abierto vienen clientes ultra VIP
 *    que pagan entrada, barra, propinas en el caño y el reservado. Vos también podés usar el reservado, pagando de la plata del casino.
 *  - Es ilegal: si el inspector lo descubre, multa, calor, reputación y el salón queda clausurado unos días.
 * Usa window.CasinoVipBridge (game.js). Toda la plata pasa por Economy; los números están en data.js (VIPNIGHT).
 */
(() => {
"use strict";
const G = window.CasinoVipBridge, C = window.CASINO_DATA && window.CASINO_DATA.VIPNIGHT, A = window.CasinoArt, T = window.THREE;
if (!G || !C || !A || !T) return;
const S = () => G.S;
const fmt = n => G.fmt(n);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = arr => arr[(Math.random() * arr.length) | 0];
const int = (v, d, lo, hi) => { v = Math.floor(Number(v)); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const TIER = id => C.tiers.find(t => t.id === id);
const SKINS = A.SKINS || [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const HAIRS = [0x2a1a10, 0x1a1a1a, 0x5a3a1a, 0x8a6a3a, 0xc9b28a, 0x6a2a14];

// ---------------------------------------------------------------- estado guardado en S.vip
// step: 0 nada · 1 Madame Rubí ofreció · 2 aceptaste (falta la obra) · 3 salón construido · 4 misión cumplida
function cleanEscort(e) {
  if (!e || typeof e !== "object") return null;
  const name = typeof e.name === "string" && e.name ? e.name.slice(0, 20) : null; if (!name) return null;
  return { id: int(e.id, 0, 0, 1e9), name, age: int(e.age, 25, 21, 40), charm: int(e.charm, 60, 30, 99),
    dress: int(e.dress, C.dresses[0], 0, 0xffffff), skin: int(e.skin, SKINS[0], 0, 0xffffff), hair: int(e.hair, HAIRS[0], 0, 0xffffff) };
}
function st() {
  const s = S(); if (!s) return null;
  let v = s.vip;
  if (v && v._ok === s) return v; // ya validado en esta partida
  if (!v || typeof v !== "object" || Array.isArray(v)) v = s.vip = {};
  v.adult = !!v.adult;
  v.step = int(v.step, 0, 0, 4);
  v.locked = v.locked !== false;
  if (!TIER(v.tier)) v.tier = "premium";
  v.sealed = int(v.sealed, 0, 0, 30); v.caught = int(v.caught, 0, 0, 999);
  v.nextId = int(v.nextId, 1, 1, 1e9);
  v.escorts = (Array.isArray(v.escorts) ? v.escorts : []).map(cleanEscort).filter(Boolean).slice(0, C.maxEscorts);
  v.cands = (Array.isArray(v.cands) ? v.cands : []).map(cleanEscort).filter(Boolean).slice(0, C.candidates);
  v.candDay = int(v.candDay, 0, 0, 1e6);
  const t = v.today && typeof v.today === "object" ? v.today : {};
  v.today = { day: int(t.day, 0, 0, 1e6), clients: int(t.clients, 0, 0, 1e5), services: int(t.services, 0, 0, 1e5), cash: int(t.cash, 0, 0, 1e9), openMin: int(t.openMin, 0, 0, 1440), first: !!t.first };
  const tt = v.totals && typeof v.totals === "object" ? v.totals : {};
  v.totals = { clients: int(tt.clients, 0, 0, 1e7), services: int(tt.services, 0, 0, 1e7), cash: int(tt.cash, 0, 0, 1e12) };
  Object.defineProperty(v, "_ok", { value: s, enumerable: false, configurable: true }); // no se guarda
  return v;
}
const V = () => st();
const on = () => { const v = V(); return !!v && v.adult; };
const built = () => { const v = V(); return !!v && v.adult && v.step >= 3; };
function today() {
  const v = V(), d = S().day;
  if (v.today.day !== d) v.today = { day: d, clients: 0, services: 0, cash: 0, openMin: 0, first: false };
  return v.today;
}
const publicOpen = () => { const v = V(); return built() && !v.locked && !v.sealed; };
const working = () => publicOpen() && G.isOpen && V().escorts.length > 0;
const hireCost = e => Math.round((C.hireBase + C.hirePerCharm * e.charm) / 50) * 50;
const wageOf = e => Math.round((C.wageBase + C.wagePerCharm * e.charm) / 10) * 10;
const priceOf = e => Math.round(TIER(V().tier).price * (0.8 + e.charm / 250) / 50) * 50;
const tipOf = e => Math.round(C.tipBase + C.tipPerCharm * e.charm);

function rollCandidates() {
  const v = V(), s = S();
  if (v.candDay === s.day && v.cands.length) return;
  v.candDay = s.day; v.cands = [];
  const used = new Set(v.escorts.map(e => e.name));
  for (let i = 0; i < C.candidates; i++) {
    let name = pick(C.names), n = 0; while (used.has(name) && n++ < 20) name = pick(C.names);
    used.add(name);
    v.cands.push({ id: v.nextId++, name, age: rndi(21, 34), charm: rndi(38, 95), dress: pick(C.dresses), skin: pick(SKINS), hair: pick(HAIRS) });
  }
}

// ---------------------------------------------------------------- el lugar: detrás de la pared del fondo del salón principal
const X0 = -10, X1 = 0, Z0 = 10.15, Z1 = 16.6, H = G.WALL_H || 3.5;
const DOOR_X = -3, IN_SPOT = { x: DOOR_X, z: 10.9 }, OUT_SPOT = { x: DOOR_X, z: 9.05 };
const POLE = { x: -5.8, z: 14.5 }, STAGE_H = 0.18;
const BOOTH = { x0: -3.3, z0: 14.6, door: -1.65 };
const inside = () => { const p = G.player; return p.z > 10 && p.x > X0 - 0.2 && p.x < X1 + 0.2; };
const std = (c, r, m, e) => A.std(c, r == null ? 0.7 : r, m || 0, e || 0);
function bx(parent, w, h, d, mat, x, y, z) { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; }
function plane(parent, w, h, mat, x, y, z, ry, rx) { const m = new T.Mesh(new T.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0, "YXZ"); parent.add(m); return m; }

const shell = new T.Group(), room = new T.Group(), outside = new T.Group();
shell.visible = false; room.visible = false;
G.scene.add(shell); G.scene.add(room); G.scene.add(outside);
{ // cáscara: paredes y techo que se ven desde atrás del edificio
  const ext = std(0x3a3632, 0.95), cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2, len = Z1 - Z0 + 0.3;
  bx(shell, 0.3, H, len, ext, X0 - 0.15, H / 2, cz); bx(shell, 0.3, H, len, ext, X1 + 0.15, H / 2, cz);
  bx(shell, X1 - X0 + 0.6, H, 0.3, ext, cx, H / 2, Z1 + 0.15);
  bx(shell, X1 - X0 + 0.6, 0.2, len + 0.3, std(0x24221f, 1), cx, H + 0.1, cz);
  G.boxAt(X0 - 0.15, cz, 0.3, len, "vip", built); G.boxAt(X1 + 0.15, cz, 0.3, len, "vip", built); G.boxAt(cx, Z1 + 0.15, X1 - X0 + 0.6, 0.3, "vip", built);
}
let lampMat = null, lampFree = A.basic(0x3cff8a), lampBusy = A.basic(0xff2a4a);
const anim = [];
{ // adentro: alfombra bordó, terciopelo, neón rosa, barra privada, caño y reservado
  const cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2, W = X1 - X0, D = Z1 - Z0;
  plane(room, W, D, std(0x3a0c1c, 0.95), cx, 0.006, cz, 0, -Math.PI / 2);
  plane(room, W, D, std(0x140810, 0.9), cx, H - 0.01, cz, 0, Math.PI / 2);
  const velvet = std(0x3a1030, 0.85), brass = A.materials.brass;
  plane(room, W, H, velvet, cx, H / 2, Z1 - 0.01, Math.PI); plane(room, W, H, velvet, cx, H / 2, Z0 + 0.01, 0);
  plane(room, D, H, velvet, X0 + 0.01, H / 2, cz, Math.PI / 2); plane(room, D, H, velvet, X1 - 0.01, H / 2, cz, -Math.PI / 2);
  for (const y of [0.9, 2.55]) { // molduras doradas
    bx(room, W, 0.04, 0.03, brass, cx, y, Z1 - 0.03); bx(room, W, 0.04, 0.03, brass, cx, y, Z0 + 0.03);
    bx(room, 0.03, 0.04, D, brass, X0 + 0.03, y, cz); bx(room, 0.03, 0.04, D, brass, X1 - 0.03, y, cz);
  }
  if (A.makeCoveLights) room.add(A.makeCoveLights([
    { x0: X0, z0: Z1, x1: X1, z1: Z1, nx: 0, nz: -1, color: 0xff2f8a, top: H }, { x0: X0, z0: Z0, x1: X1, z1: Z0, nx: 0, nz: 1, color: 0xc81e4a, top: H },
    { x0: X0, z0: Z0, x1: X0, z1: Z1, nx: 1, nz: 0, color: 0xb040ff, top: H }, { x0: X1, z0: Z0, x1: X1, z1: Z1, nx: -1, nz: 0, color: 0xff2f8a, top: H },
  ]));
  for (const n of [
    { text: "ULTRA VIP", color: 0xff3fa4, color2: 0xffd45a, icons: ["diamond"], w: 3.2, h: 0.85, x: -6.6, y: 2.75, z: Z1 - 0.03, ry: Math.PI },
    { text: "Privado", color: 0xff2a4a, color2: 0xffd45a, icons: ["heart"], w: 1.9, h: 0.55, x: BOOTH.door, y: 2.85, z: BOOTH.z0 - 0.09, ry: Math.PI },
  ]) { const s = A.makeNeonSign(n); s.position.set(n.x, n.y, n.z); s.rotation.y = n.ry; room.add(s); if (s.api) anim.push(s.api); }
  // barra privada contra la pared izquierda (los clientes del lado del salón)
  const bar = A.makeBar({ width: 3, stools: 3 }); bar.rotation.y = Math.PI / 2; bar.position.set(-8.25, 0, 12.7); room.add(bar);
  G.boxAt(-8.8, 12.7, 2.1, 3.3, "vip", built);
  G.proxy(bar, 3.0, 1.2, 0.9, { prompt: () => ({ text: "Barra privada", sub: "Ver las cuentas del salón ultra VIP" }), hold: () => 0, use: () => openMain("salon") }, 0.6, 0, 0.2);
  // escenario redondo con el caño
  const stage = new T.Mesh(new T.CylinderGeometry(1.05, 1.1, STAGE_H, 28), std(0x15080f, 0.4, 0.3)); stage.position.set(POLE.x, STAGE_H / 2, POLE.z); room.add(stage);
  const rim = new T.Mesh(new T.TorusGeometry(1.08, 0.025, 6, 32), A.basic(0xff5ab0)); rim.rotation.x = Math.PI / 2; rim.position.set(POLE.x, STAGE_H, POLE.z); room.add(rim);
  const pole = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, H - STAGE_H, 12), A.materials.chrome); pole.position.set(POLE.x, STAGE_H + (H - STAGE_H) / 2, POLE.z); room.add(pole);
  G.boxAt(POLE.x, POLE.z, 2.0, 2.0, "vip", built);
  // sillones de terciopelo mirando al escenario
  const sofaM = std(0x6a1030, 0.8), legM = A.materials.brass;
  const sofa = (x, z, len, ry) => {
    const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry; room.add(g);
    bx(g, len, 0.42, 0.75, sofaM, 0, 0.21, 0); bx(g, len, 0.6, 0.18, sofaM, 0, 0.62, -0.32);
    bx(g, 0.16, 0.6, 0.75, sofaM, -len / 2, 0.4, 0); bx(g, 0.16, 0.6, 0.75, sofaM, len / 2, 0.4, 0);
    bx(g, len + 0.1, 0.03, 0.05, legM, 0, 0.9, -0.38);
  };
  sofa(-5.8, 11.15, 2.6, 0); G.boxAt(-5.8, 11.05, 2.8, 0.85, "vip", built);
  sofa(-0.75, 12.6, 2.2, -Math.PI / 2); G.boxAt(-0.65, 12.6, 0.85, 2.4, "vip", built);
  // el reservado: paredes, puerta cerrada y una luz (verde libre, roja ocupado)
  const wallM = std(0x2a0a1a, 0.8), w0 = BOOTH.x0, dz = Z1 - BOOTH.z0;
  const left = BOOTH.door - 0.5 - w0, right = X1 - (BOOTH.door + 0.5);
  bx(room, left, H, 0.14, wallM, w0 + left / 2, H / 2, BOOTH.z0); bx(room, right, H, 0.14, wallM, X1 - right / 2, H / 2, BOOTH.z0);
  bx(room, 1.0, H - 2.25, 0.14, wallM, BOOTH.door, 2.25 + (H - 2.25) / 2, BOOTH.z0);
  bx(room, 0.14, H, dz, wallM, w0, H / 2, BOOTH.z0 + dz / 2);
  const door = bx(room, 0.96, 2.22, 0.08, std(0x5a0f1f, 0.5), BOOTH.door, 1.11, BOOTH.z0 - 0.02);
  bx(room, 0.05, 0.05, 0.08, A.materials.brass, BOOTH.door + 0.34, 1.05, BOOTH.z0 - 0.08);
  const lamp = new T.Mesh(new T.SphereGeometry(0.07, 12, 8), lampFree); lamp.position.set(BOOTH.door, 2.42, BOOTH.z0 - 0.1); room.add(lamp); lampMat = lamp;
  G.boxAt((w0 + X1) / 2, BOOTH.z0, X1 - w0, 0.2, "vip", built); G.boxAt(w0, BOOTH.z0 + dz / 2, 0.2, dz, "vip", built);
  G.proxy(door, 1.0, 2.2, 0.3, {
    prompt: () => session ? { text: "Reservado ocupado", sub: session.owner ? "" : "Una pareja adentro · se libera en un rato" } : { text: "Reservado", sub: "Entra 1 cliente con 1 acompañante · vos también podés usarlo" },
    hold: () => 0, use: () => openMain("reservado"),
  }, 0, 0, 0);
  // puerta de salida (del lado de adentro de la estantería)
  const exitDoor = bx(room, 1.3, 2.3, 0.1, std(0x3b2314, 0.6), DOOR_X, 1.15, Z0 + 0.06);
  bx(room, 0.06, 0.06, 0.1, A.materials.brass, DOOR_X + 0.48, 1.1, Z0 + 0.13);
  G.proxy(exitDoor, 1.3, 2.3, 0.4, {
    prompt: () => ({ text: "Volver al salón principal", sub: V().locked ? "El candado queda puesto" : "Ojo: quedó sin candado" }),
    hold: () => 0, use: () => fadeMove(OUT_SPOT, 0), options: () => openMain("salon"), optLabel: "Salón ultra VIP",
  }, 0, 0, 0);
}
{ // la estantería del salón principal (es la puerta secreta)
  const tex = A.canvasTex(256, 448, (g, w, h) => {
    g.fillStyle = "#2a170c"; g.fillRect(0, 0, w, h);
    const cols = ["#7a1f1f", "#1f3a5a", "#2e5a2a", "#6a4a1a", "#4a2a5a", "#8a6a3a", "#1a1a1a", "#5a1a2a"];
    for (let r = 0; r < 4; r++) {
      const y0 = 18 + r * 106, y1 = y0 + 92;
      g.fillStyle = "#1a0e07"; g.fillRect(10, y0, w - 20, 92);
      let x = 14; while (x < w - 24) { const bw = 10 + Math.random() * 14, bh = 56 + Math.random() * 32; g.fillStyle = pick(cols); g.fillRect(x, y1 - bh, bw, bh); g.fillStyle = "rgba(217,168,74,.55)"; g.fillRect(x + 2, y1 - bh + 10, bw - 4, 3); x += bw + 1; }
      g.fillStyle = "#5a3a1e"; g.fillRect(6, y1, w - 12, 10);
    }
  });
  const g = new T.Group(); g.position.set(DOOR_X, 0, 9.72); g.rotation.y = Math.PI; G.scene.add(g);
  bx(g, 1.5, 2.45, 0.26, A.materials.woodDark || std(0x3b2314), 0, 1.225, 0);
  plane(g, 1.36, 2.3, new T.MeshStandardMaterial({ map: tex, roughness: 0.85 }), 0, 1.2, 0.135, 0);
  G.boxAt(DOOR_X, 9.7, 1.6, 0.35, "vip");
  G.proxy(outside, 1.5, 2.4, 0.5, {
    prompt: () => {
      const v = V();
      if (!v || !v.adult) return { text: "Estantería con libros de contabilidad", sub: "" };
      if (v.step === 0) return { text: "Estantería con libros de contabilidad", sub: S().rank >= C.rank ? "Suena hueca…" : "" };
      if (v.step < 3) return { text: "Golpear la estantería", sub: "Madame Rubí espera tu respuesta" };
      return { text: "Entrar al salón ultra VIP", sub: v.sealed ? `Clausurado por la Lotería (${v.sealed} días)` : v.locked ? "Con candado: no entra el público" : "Abierto al público ultra VIP" };
    },
    hold: () => 0, usable: () => on() && V().step >= 1,
    use: () => { const v = V(); if (v.step < 3) openMission(); else fadeMove(IN_SPOT, Math.PI); },
    options: () => { if (built()) openMain("salon"); }, optLabel: "Salón ultra VIP",
  }, 1.2, DOOR_X, 9.72);
}

// ---------------------------------------------------------------- fundido a negro (entrar, salir y el reservado)
const fadeEl = document.createElement("div");
fadeEl.style.cssText = "position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .45s;z-index:40;display:grid;place-items:center;color:#f3e9d2;font:600 1.15rem 'Barlow Semi Condensed',sans-serif;letter-spacing:.04em;text-align:center;padding:16px";
document.body.appendChild(fadeEl);
let fading = false;
function fade(mid, text, hold) {
  if (fading) return; fading = true; fadeEl.textContent = text || ""; fadeEl.style.opacity = "1";
  setTimeout(() => { try { mid(); } catch (e) { /* nada */ } setTimeout(() => { fadeEl.style.opacity = "0"; fading = false; }, hold || 150); }, 460);
}
function fadeMove(p, yaw) {
  G.sfx("door") || G.SFX.tick();
  fade(() => { const pl = G.player; pl.x = p.x; pl.z = p.z; pl.yaw = yaw; pl.pitch = 0; });
}

// ---------------------------------------------------------------- personas: acompañantes y clientes
const people = new Map(); // id → person
let guests = [];          // clientes ultra VIP sentados mirando el show (solo se ven, el cobro es aparte)
let session = null;       // { id, left, owner }
let dancerId = null, t = 0, lastS = null;
const SEATS = [{ x: -6.6, z: 11.45 }, { x: -5.8, z: 11.45 }, { x: -5.0, z: 11.45 }];
const IDLE = [{ x: -7.25, z: 13.1, yaw: Math.PI / 2 }, { x: -3.9, z: 12.4, yaw: -2.2 }, { x: -2.2, z: 13.7, yaw: Math.PI }];
function lookOf(e) { return { vip: true, female: true, top: "dress", jacket: e.dress, pants: e.dress, skin: e.skin, hair: e.hair, height: 0.97 }; }
function syncPeople() {
  const v = V(), want = built() ? v.escorts : [];
  const ids = new Set(want.map(e => e.id));
  for (const [id, p] of people) if (!ids.has(id)) { G.releasePerson(p); people.delete(id); }
  for (const e of want) if (!people.has(e.id)) {
    const p = G.acquirePerson("vipEsc", e.id, lookOf(e));
    p.agent = { interact: { prompt: () => ({ text: e.name, sub: `Acompañante · ${e.age} años · carisma ${e.charm}` }), usable: () => true, use: () => openMain("escorts") } };
    people.set(e.id, p);
  }
  if (!built()) clearGuests();
}
function addGuest() {
  if (guests.length >= SEATS.length) { guests[0].left = Math.max(guests[0].left, G.HOUR * 0.8); return; }
  const i = [0, 1, 2].find(k => !guests.some(g => g.seat === k));
  const look = { vip: true, jacket: pick([0x1a1a24, 0x24161a, 0x14202a, 0x202024]), skin: pick(SKINS), hair: pick(HAIRS), height: 1.0 };
  const p = G.acquirePerson("vipGuest", i, look);
  p.agent = { interact: { prompt: () => ({ text: "Cliente ultra VIP", sub: "Mira el show y espera su turno" }), usable: () => false, use: () => {} } };
  p.group.position.set(SEATS[i].x, 0, SEATS[i].z); p.group.rotation.y = 0; p.api.sit(0.42);
  guests.push({ p, seat: i, left: G.HOUR * rnd(0.9, 1.6) });
}
function clearGuests() { for (const g of guests) G.releasePerson(g.p); guests = []; }
function endSession() { session = null; }

// ---------------------------------------------------------------- lo que pasa en el salón (tiempo del juego)
let watch = null, lastInsp = null, offerT = 0;
function arrival() {
  const v = V(), d = today(), s = S();
  d.clients++; v.totals.clients++;
  let cash = C.entry;
  const dancer = v.escorts.find(e => e.id === dancerId);
  if (dancer) cash += tipOf(dancer);
  G.Economy.add("vipEntry", cash); d.cash += cash; v.totals.cash += cash;
  addGuest();
  if (!d.first) { d.first = true; G.toast("Llegó el primer cliente ultra VIP de la noche al salón secreto.", "good"); }
  if (!session) { // el reservado está libre: pasa con la acompañante libre de más carisma
    const free = v.escorts.filter(e => e.id !== dancerId).sort((a, b) => b.charm - a.charm)[0] || v.escorts[0];
    if (!free) return;
    const price = priceOf(free), share = Math.round(price * C.escortShare);
    G.Economy.add("vipService", price); G.Economy.force("vipPay", share);
    d.services++; v.totals.services++; d.cash += price - share; v.totals.cash += price - share;
    session = { id: free.id, left: G.HOUR * C.sessionHours, owner: false };
    if (guests.length) { const g = guests.pop(); G.releasePerson(g.p); } // el cliente pasó al reservado
    if (v.step === 3) missionDone();
  }
  G.updateHud(true);
  void s;
}
function missionDone() {
  const v = V(); v.step = 4;
  G.Economy.add("vipMission", C.reward.cash); G.Rank.add(C.reward.xp);
  G.toast(`Misión cumplida: «El salón de Madame Rubí». +${fmt(C.reward.cash)} y ${C.reward.xp} de experiencia.`, "good"); G.SFX.rank();
  G.save(true);
}
function caught() {
  const v = V(), s = S(), K = C.caught;
  G.Economy.force("fines", K.fine); s.today.st.fines += K.fine;
  G.Heat.add(K.heat, "vip"); G.Rep.change(K.rep);
  v.sealed = K.sealDays; v.caught++; v.locked = true;
  endSession(); clearGuests();
  const msg = `¡El inspector descubrió el salón ultra VIP! Multa de ${fmt(K.fine)}, +${K.heat} de calor y el salón queda clausurado ${K.sealDays} días.`;
  G.toast(msg, "bad"); G.SFX.alarm(); (s.today.notes || []).push(msg);
  G.save(true); G.updateHud(true);
}
function inspectorTick(dt) {
  const insp = G.inspector;
  if (insp && insp !== lastInsp && insp.state !== "leave") {
    lastInsp = insp; watch = { insp, total: 0, open: 0 };
    if (built() && publicOpen()) G.toast("¡Cuidado! El inspector está en el casino y el salón ultra VIP está sin candado. Ponele el candado rápido (estantería del fondo, R).", "bad");
  }
  if (!watch) return;
  const w = watch, live = G.inspector === w.insp && w.insp.state !== "leave";
  if (live) { w.total += dt; if (publicOpen()) w.open += dt; return; }
  watch = null;
  if (!built() || w.insp.bribed || V().sealed) return;
  const frac = w.total > 0 ? w.open / w.total : 0, K = C.inspect;
  const chance = K.lockedChance + (K.openChance + S().heat * K.perHeat - K.lockedChance) * frac;
  if (Math.random() < chance) caught();
  else if (frac > 0) G.toast("El inspector se fue sin descubrir el salón ultra VIP. Por esta vez.", "good");
}
function update(dt) {
  const s = S(), v = V(); if (!v || s.dayOver) return;
  if (v.adult && v.step === 0 && s.rank >= C.rank && G.isOpen && !G.ui.blocking()) {
    offerT += dt;
    if (offerT > 6) {
      v.step = 1; G.save(true);
      G.toast("Te dejaron una tarjeta perfumada en el bolsillo: «Golpeá la estantería del fondo del salón. —Madame Rubí».", "good");
      G.hint("vipOffer", "La estantería del fondo del salón principal, cerca del cartel de JACKPOT, esconde algo. Miralo y apretá " + G.KEY + ".");
    }
  }
  inspectorTick(dt);
  if (!built()) return;
  if (session) { session.left -= dt; if (session.left <= 0) endSession(); }
  for (const g of guests) g.left -= dt;
  if (guests.some(g => g.left <= 0)) { for (const g of guests) if (g.left <= 0) G.releasePerson(g.p); guests = guests.filter(g => g.left > 0); }
  if (!working()) return;
  today().openMin = Math.min(1440, today().openMin + dt * 60 / G.HOUR);
  const rate = Math.min(C.maxPerHour, (C.clientsPerHour + C.perEscort * (v.escorts.length - 1)) * TIER(v.tier).demand * (0.5 + s.rep / 100));
  if (Math.random() < rate * dt / G.HOUR) arrival();
}
function onEndDay(notes) {
  const v = V(); if (!v) return;
  endSession(); clearGuests();
  if (!built()) return;
  const d = today();
  let wages = 0;
  if (!v.sealed) for (const e of v.escorts) { const w = wageOf(e); G.Economy.force("vipPay", w); wages += w; }
  if (d.openMin > 0) G.Heat.add(C.heatPerOpenDay, "vip");
  if (d.clients || wages) notes.push(`Salón ultra VIP: ${d.clients} clientes y ${d.services} pasaron al reservado. Te quedaron ${fmt(d.cash)}; sueldos de las acompañantes ${fmt(wages)}.${d.openMin > 0 ? ` Los rumores suben el calor ${C.heatPerOpenDay}.` : ""}`);
  if (v.sealed > 0) { v.sealed--; notes.push(v.sealed ? `El salón ultra VIP sigue clausurado ${v.sealed} días más.` : "Mañana se termina la clausura del salón ultra VIP (queda con candado)."); }
}

// ---------------------------------------------------------------- cada cuadro: qué se ve y el baile (vestido, nada explícito)
function frame(real) {
  const s = S(); if (!s) return;
  if (s !== lastS) { lastS = s; session = null; clearGuests(); watch = null; syncPeople(); }
  const v = V(), b = built(), inn = inside();
  if (inn && !b && G.started) { const pl = G.player; pl.x = OUT_SPOT.x; pl.z = OUT_SPOT.z; pl.yaw = 0; } // sin salón (o +18 apagado): afuera
  shell.visible = b; room.visible = b && inn; outside.visible = !inn;
  if (people.size !== (b ? v.escorts.length : 0)) syncPeople();
  lampMat.material = session ? lampBusy : lampFree;
  const show = b && inn;
  for (const g of guests) g.p.group.visible = show;
  // la que baila: la de más carisma que no esté en el reservado
  const free = b ? v.escorts.filter(e => !session || e.id !== session.id) : [];
  dancerId = free.length ? free.slice().sort((a, b2) => b2.charm - a.charm)[0].id : null;
  if (!show) { for (const p of people.values()) p.group.visible = false; return; }
  t += real;
  for (const a of anim) a.update(real);
  for (const g of guests) { g.p.api.idle(real); if (Math.random() < real * 0.15) g.p.api.cheer(0.8); }
  let k = 0;
  for (const e of v.escorts) {
    const p = people.get(e.id); if (!p) continue;
    if (session && session.id === e.id) { p.group.visible = false; continue; } // está en el reservado (puerta cerrada)
    p.group.visible = true;
    if (e.id === dancerId) { dance(p, real); continue; }
    const sp = IDLE[k++ % IDLE.length]; p.group.position.set(sp.x, 0, sp.z); p.group.rotation.y = sp.yaw; p.api.idle(real);
  }
}
function dance(p, real) {
  const a = t * 0.55, J = p.api.joints, w = Math.sin(t * 2.4), w2 = Math.sin(t * 1.2);
  p.group.position.set(POLE.x + Math.cos(a) * 0.42, STAGE_H, POLE.z + Math.sin(a) * 0.42);
  p.group.rotation.y = Math.atan2(POLE.x - p.group.position.x, POLE.z - p.group.position.z) - 1.25; // de costado al caño
  p.api.idle(real);
  J.hips.position.y = (p.api.hipY || 0.92) - 0.05 * (1 + w); J.hips.rotation.y = w * 0.35; J.hips.rotation.z = w2 * 0.06;
  J.legL.rotation.x = -0.1 * (1 + w); J.legR.rotation.x = -0.1 * (1 - w); J.kneeL.rotation.x = 0.2 * (1 + w); J.kneeR.rotation.x = 0.2 * (1 - w);
  J.torso.rotation.z = -w * 0.1; J.torso.rotation.y = -w * 0.2;
  J.armR.rotation.z = 2.55; J.armR.rotation.x = -0.3; J.elbowR.rotation.x = -0.25;           // una mano en el caño
  J.armL.rotation.z = -0.5 - 0.7 * (0.5 + 0.5 * w2); J.elbowL.rotation.x = -0.6 - 0.3 * w;
  J.head.rotation.y = w2 * 0.3; J.head.rotation.z = w * 0.08;
}

// ---------------------------------------------------------------- paneles
function openMission() {
  const v = V(), s = S();
  if (v.step <= 1) {
    G.openPanel("vipMission", `<h2>Madame Rubí</h2>
      <p>Golpeás la estantería y suena hueca. Detrás de una puerta escondida hay un depósito viejo, y en la puerta te espera una señora de tapado rojo y voz de tango.</p>
      <p>«Usted ya es Director, querido. Los clientes que más pagan quieren algo que no está en ningún folleto: un salón ultra VIP con <b>barra privada</b>, <b>caño de baile</b> y un <b>reservado</b> donde entra un cliente con una acompañante. Yo le consigo chicas que quieran trabajar; usted pone el lugar.»</p>
      <div class="note">La obra cuesta <b class="num">${fmt(C.buildCost)}</b>. Todas las acompañantes son mayores de edad y eligen trabajar: cobran por noche y la mitad de cada servicio. Es ilegal: si el inspector lo descubre hay multa de ${fmt(C.caught.fine)}, calor y clausura. Vos decidís si lo cerrás con candado o lo abrís al público ultra VIP.</div>
      <div class="actions"><button class="ghost" data-act="close">Ahora no</button><button data-act="vipAccept">Acepto el trato</button></div>`);
    return;
  }
  G.openPanel("vipMission", `<h2>El salón de Madame Rubí</h2>
    <p>Misión: <b>armá el salón ultra VIP y atendé a tu primer cliente</b>.</p>
    <div class="note">1. Pagá la obra secreta (${fmt(C.buildCost)}).<br>2. Contratá al menos una acompañante (barra del salón o R en la estantería).<br>3. Sacale el candado con el casino abierto y esperá al primer cliente ultra VIP.<br>Premio: ${fmt(C.reward.cash)} y ${C.reward.xp} de experiencia.</div>
    <p>Banco <b class="num">${fmt(s.bank)}</b></p>
    <div class="actions"><button class="ghost" data-act="close">Más tarde</button><button data-act="vipBuild" ${s.bank < C.buildCost ? "disabled" : ""}>Pagar la obra (${fmt(C.buildCost)})</button></div>`);
}
function statusLine(v) { return v.sealed ? `<b class="out">Clausurado por la Lotería</b> (${v.sealed} días)` : v.locked ? "<b>Cerrado con candado</b>: no entra el público" : `<b class="in">Abierto al público ultra VIP</b>`; }
function openMain(tab) {
  if (!built()) return;
  const v = V(), s = S(), d = today(); tab = tab || "salon";
  rollCandidates();
  const tabs = [["salon", "Salón"], ["escorts", "Acompañantes"], ["reservado", "Reservado"]]
    .map(([id, n]) => `<button class="${tab === id ? "on" : ""}" data-act="vipTab" data-id="${id}">${n}</button>`).join("");
  let body = "";
  if (tab === "salon") {
    const K = C.inspect, risk = Math.min(1, K.openChance + s.heat * K.perHeat);
    body = `<p>${statusLine(v)} · acompañantes ${v.escorts.length}/${C.maxEscorts} · reservado ${session ? "ocupado" : "libre"}</p>
      ${v.step === 3 ? `<div class="note">Misión: ${v.escorts.length ? "✓" : "○"} contratá una acompañante · ${v.locked ? "○" : "✓"} sacale el candado · ○ atendé al primer cliente con el casino abierto.</div>` : ""}
      <h3>Candado</h3>
      <p>Con candado no viene nadie y el inspector casi nunca lo encuentra (${Math.round(K.lockedChance * 100)}%). Abierto vienen clientes ultra VIP, pero si el inspector pasa mientras está abierto lo descubre el ${Math.round(risk * 100)}% de las veces. Cada día abierto los rumores suben ${C.heatPerOpenDay} el calor.</p>
      <div class="actions"><button class="${v.locked ? "" : "danger"}" data-act="vipLock" ${v.sealed ? "disabled" : ""}>${v.locked ? "Sacar el candado (abrir al público)" : "Poner el candado"}</button></div>
      <h3>Tarifa del reservado</h3>
      <div class="tabs">${C.tiers.map(x => `<button class="${v.tier === x.id ? "on" : ""}" data-act="vipTier" data-id="${x.id}">${x.name} ${fmt(x.price)}</button>`).join("")}</div>
      <p class="dim">Más cara, menos clientes. Cada acompañante cobra según su carisma; la mitad es para ella. Entrada y barra: ${fmt(C.entry)} por cliente, más propinas en el caño.</p>
      <h3>Hoy</h3><p>${d.clients} clientes · ${d.services} al reservado · te quedaron <b class="num in">${fmt(d.cash)}</b>. En total: ${v.totals.clients} clientes, ${fmt(v.totals.cash)}.</p>`;
  } else if (tab === "escorts") {
    const full = v.escorts.length >= C.maxEscorts;
    const mine = v.escorts.map(e => `<div class="item"><div class="t"><b>${esc(e.name)} · ${e.age} años</b><span>Carisma ${e.charm} · cobra ${fmt(wageOf(e))} por noche · reservado ${fmt(priceOf(e))}${e.id === dancerId ? " · está en el caño" : ""}${session && session.id === e.id ? " · en el reservado" : ""}</span></div>
      <div class="btns"><button class="ghost sm" data-act="vipFire" data-id="${e.id}">Despedir</button></div></div>`).join("") || `<p class="dim">Todavía no trabaja nadie en el salón.</p>`;
    const cands = v.cands.map(e => `<div class="item"><div class="t"><b>${esc(e.name)} · ${e.age} años</b><span>Carisma ${e.charm} · quiere ${fmt(wageOf(e))} por noche · reservado ${fmt(priceOf(e))}</span></div>
      <div class="btns"><button data-act="vipHire" data-id="${e.id}" ${full || s.bank < hireCost(e) ? "disabled" : ""}>Contratar ${fmt(hireCost(e))}</button></div></div>`).join("") || `<p class="dim">Hoy no se presentó nadie más. Mañana Madame Rubí te manda otras.</p>`;
    body = `<h3>Trabajan con vos</h3>${mine}<h3>Quieren trabajar (las manda Madame Rubí)</h3><p class="dim">Todas son mayores de edad y eligen este trabajo. Más carisma: más propinas y el reservado se cobra más caro.</p>${cands}`;
  } else {
    const list = v.escorts.map(e => `<div class="item"><div class="t"><b>${esc(e.name)}</b><span>Carisma ${e.charm}</span></div>
      <div class="btns"><button data-act="vipOwn" data-id="${e.id}" ${session || s.bank < priceOf(e) ? "disabled" : ""}>Pasar con ella ${fmt(priceOf(e))}</button></div></div>`).join("") || `<p class="dim">Primero contratá una acompañante.</p>`;
    body = `<p>Entra un solo cliente con una acompañante y se cierra la puerta. ${session ? "<b>Ahora está ocupado.</b>" : "Ahora está libre."}</p>
      <p>Vos también podés usarlo. Siendo el dueño igual se paga el servicio: sale de la plata del casino (banco ${fmt(s.bank)}).</p>${list}`;
  }
  G.openPanel("vip", `<h2>Salón ultra VIP</h2><div class="tabs">${tabs}</div>${body}`, { vipTab: tab });
}
function pauseButton() {
  const v = V(); if (!v) return "";
  return `<button class="ghost sm" data-act="vipAdult" aria-pressed="${v.adult}">${v.adult ? "Contenido +18: sí" : "Contenido +18: no"}</button>`;
}
document.getElementById("panelBody").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b || b.disabled) return;
  const act = b.dataset.act; if (!act || !act.startsWith("vip")) return;
  const v = V(), s = S(), id = +b.dataset.id, tab = (G.ui.ctx && G.ui.ctx.vipTab) || "salon";
  switch (act) {
    case "vipAdult":
      if (v.adult) { v.adult = false; G.save(true); G.renderPause(); }
      else G.openPanel("vipAdultAsk", `<h2>Contenido +18</h2>
        <p>Activa una misión opcional para adultos: un salón ultra VIP secreto con barra privada, caño de baile y un reservado con acompañantes.</p>
        <div class="note">Es todo ficción y no se muestra nada explícito: el baile es vestido y lo del reservado pasa detrás de una puerta cerrada. Todos los personajes son mayores de edad.</div>
        <div class="actions"><button class="ghost" data-act="vipAdultNo">No, volver</button><button data-act="vipAdultYes">Tengo 18 o más: activar</button></div>`);
      break;
    case "vipAdultYes": v.adult = true; G.save(true); G.renderPause(); if (s.rank < C.rank) G.toast(`Listo. La misión aparece cuando llegues al rango ${C.rank}.`, ""); break;
    case "vipAdultNo": G.renderPause(); break;
    case "vipAccept": v.step = 2; G.save(true); openMission(); break;
    case "vipBuild":
      if (v.step !== 2 || !G.Economy.trySpend("vipBuild", C.buildCost)) break;
      v.step = 3; v.locked = true; rollCandidates(); syncPeople(); G.save(true); G.updateHud(true); G.SFX.cash();
      G.toast("¡Obra terminada! Detrás de la estantería está tu salón ultra VIP. Queda con candado hasta que vos lo abras.", "good");
      G.closePanel(true, true); fadeMove(IN_SPOT, Math.PI);
      break;
    case "vipTab": openMain(b.dataset.id); break;
    case "vipLock":
      if (v.sealed) break;
      v.locked = !v.locked; G.sfx("door") || G.SFX.tick();
      G.toast(v.locked ? "Pusiste el candado al salón ultra VIP." : "Sacaste el candado: el salón ultra VIP está abierto al público.", v.locked ? "good" : "");
      G.save(true); openMain(tab); break;
    case "vipTier": if (TIER(b.dataset.id)) { v.tier = b.dataset.id; G.save(true); } openMain(tab); break;
    case "vipHire": {
      const c = v.cands.find(x => x.id === id); if (!c || v.escorts.length >= C.maxEscorts) break;
      if (!G.Economy.trySpend("vipHire", hireCost(c))) break;
      v.cands = v.cands.filter(x => x !== c); v.escorts.push(c); syncPeople(); G.SFX.coin();
      G.toast(`${c.name} empieza a trabajar en el salón ultra VIP.`, "good"); G.save(true); G.updateHud(true); openMain("escorts"); break;
    }
    case "vipFire": {
      const c = v.escorts.find(x => x.id === id); if (!c) break;
      v.escorts = v.escorts.filter(x => x !== c); if (session && session.id === c.id) endSession(); syncPeople();
      G.toast(`${c.name} ya no trabaja en el salón.`, ""); G.save(true); openMain("escorts"); break;
    }
    case "vipOwn": {
      const c = v.escorts.find(x => x.id === id); if (!c || session) break;
      if (!G.Economy.trySpend("vipOwner", priceOf(c))) break;
      session = { id: c.id, left: G.HOUR * 0.25, owner: true };
      G.updateHud(true); G.save(true); G.closePanel(true, true);
      fade(() => {}, `Se cierra la puerta del reservado con ${c.name}…`, 1600);
      setTimeout(() => G.toast(`Saliste del reservado. Se pagaron ${fmt(priceOf(c))} de la plata del casino.`, ""), 2300);
      break;
    }
  }
});

window.CasinoVip = {
  update, frame, onEndDay, pauseButton,
  debug: { get state() { return V(); }, get session() { return session; }, get guests() { return guests.length; }, arrival, caught, openMain, openMission, inside, IN_SPOT, OUT_SPOT },
};
})();
