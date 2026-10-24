/* Casino Dorado v3 · world.js — EL MUNDO DE AFUERA
 * 1. Ciclo de día y noche con clima: el cielo, la niebla, el sol/luna y las luces de la fachada siguen el reloj
 *    (amanecer, día, atardecer, noche). Cada día tiene nombre (Lunes…Domingo) y clima (soleado, nublado, lluvia,
 *    tormenta, ola de calor) que cambia la demanda por tipo de cliente. Lluvia con gotas procedurales afuera,
 *    vereda mojada, sonido (audio.js) y relámpagos que pueden cortar la luz (apagón de life.js).
 * 2. Hotel Dorado arriba del casino: recepción y ascensor en la vereda, pisos arriba (las habitaciones son un menú),
 *    huéspedes que se registran (minijuego o recepcionista), pagan por noche y bajan a jugar con más presupuesto.
 * 3. Favores de Don Aurelio (story.js): pedidos con plazo y objetivo en el HUD; aceptar o rechazar cambia la plata,
 *    la "Protección", el calor y las banderas de la historia.
 * No agrega luces: solo ajusta la intensidad y el color de las que ya hay. Estado en S.world (validado acá).
 * Se carga después de shop.js y antes de story.js; usa window.CasinoWorldBridge (game.js).
 */
(() => {
"use strict";
const G = window.CasinoWorldBridge, D = window.CASINO_DATA, A = window.CasinoArt, T = window.THREE;
if (!G || !D || !D.WORLD || !A || !T) return;
const W = D.WORLD, WX = W.weather, H = W.hotel, MF = W.mafia, CFG = G.CFG, HOUR = G.HOUR;
const S = () => G.S;
const fmt = n => G.fmt(n);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = arr => arr[(Math.random() * arr.length) | 0];
const two = n => String(n).padStart(2, "0");
const isNum = v => typeof v === "number" && Number.isFinite(v);
const KEY = G.KEY;
const ROOM_IDS = Object.keys(H.rooms);
const WX_IDS = Object.keys(WX);
const Story = () => window.CasinoStory || null;
const hourF = () => S().minutes / 60;

// =====================================================================
// ESTADO (S.world)
// =====================================================================
let lastS = null;
function freshWorld() {
  return {
    v: 1, seed: (Math.random() * 1e9) | 0, force: {},
    hotel: { lic: false, built: false, rooms: { standard: 0, suite: 0, penthouse: 0 }, clean: 100, maids: true, recep: false, guests: [], book: { day: 0, list: [] }, nights: 0, rev: 0, uid: 1 },
    mafia: { prot: 20, fav: null, next: MF.firstDay, hist: [], streak: 0, thiefUntil: 0, sabotage: 0, last: "" },
  };
}
function sanitizeWorld(raw, s) {
  const w = freshWorld();
  if (!raw || typeof raw !== "object") return w;
  if (isNum(raw.seed)) w.seed = Math.round(raw.seed) | 0;
  if (raw.force && typeof raw.force === "object") for (const k in raw.force) if (WX[raw.force[k]] && /^\d+$/.test(k)) w.force[k] = raw.force[k];
  const h = raw.hotel, wh = w.hotel;
  if (h && typeof h === "object") {
    wh.lic = !!h.lic; wh.built = !!h.built && wh.lic;
    if (h.rooms && typeof h.rooms === "object") for (const r of ROOM_IDS) wh.rooms[r] = wh.built && isNum(h.rooms[r]) ? clamp(Math.round(h.rooms[r]), 0, H.rooms[r].max) : 0;
    wh.clean = isNum(h.clean) ? clamp(h.clean, 0, 100) : 100;
    wh.maids = h.maids !== false; wh.recep = !!h.recep && wh.built;
    wh.nights = isNum(h.nights) ? Math.max(0, Math.round(h.nights)) : 0; wh.rev = isNum(h.rev) ? Math.max(0, Math.round(h.rev)) : 0;
    wh.uid = isNum(h.uid) ? Math.max(1, Math.round(h.uid)) : 1;
    if (h.today && typeof h.today === "object" && h.today.day === s.day) wh.today = { day: s.day, checkins: isNum(h.today.checkins) ? Math.max(0, Math.round(h.today.checkins)) : 0, down: isNum(h.today.down) ? Math.max(0, Math.round(h.today.down)) : 0 };
    const used = new Set(), cnt = { standard: 0, suite: 0, penthouse: 0 };
    if (Array.isArray(h.guests)) for (const g of h.guests.slice(0, 20)) {
      if (!g || typeof g !== "object" || !H.rooms[g.room] || !isNum(g.no) || used.has(g.no)) continue;
      if (cnt[g.room] >= wh.rooms[g.room]) continue;
      cnt[g.room]++; used.add(g.no);
      wh.guests.push({ id: isNum(g.id) ? g.id : wh.uid++, name: typeof g.name === "string" ? g.name.slice(0, 40) : pick(NAMES), room: g.room, no: Math.round(g.no), nights: clamp(isNum(g.nights) ? Math.round(g.nights) : 1, 1, 9), downDay: isNum(g.downDay) ? g.downDay : 0, downAt: isNum(g.downAt) ? g.downAt : 0 });
    }
    const b = h.book;
    if (b && typeof b === "object" && b.day === s.day && Array.isArray(b.list)) {
      wh.book.day = s.day;
      for (const e of b.list.slice(0, 16)) {
        if (!e || typeof e !== "object" || !H.rooms[e.room] || !isNum(e.at)) continue;
        const st = ["pending", "waiting", "done", "gone"].includes(e.st) ? e.st : "pending";
        wh.book.list.push({ id: isNum(e.id) ? e.id : wh.uid++, name: typeof e.name === "string" ? e.name.slice(0, 40) : pick(NAMES), room: e.room, nights: clamp(isNum(e.nights) ? Math.round(e.nights) : 1, 1, 9), at: e.at, st, wait: isNum(e.wait) ? e.wait : 0 });
      }
    }
  }
  const m = raw.mafia, wm = w.mafia;
  if (m && typeof m === "object") {
    wm.prot = isNum(m.prot) ? clamp(m.prot, 0, 100) : 20;
    wm.next = isNum(m.next) ? Math.max(1, Math.round(m.next)) : MF.firstDay;
    wm.streak = isNum(m.streak) ? clamp(Math.round(m.streak), 0, 9) : 0;
    wm.thiefUntil = isNum(m.thiefUntil) ? m.thiefUntil : 0; wm.sabotage = isNum(m.sabotage) ? m.sabotage : 0;
    wm.last = typeof m.last === "string" && FAV[m.last] ? m.last : "";
    if (Array.isArray(m.hist)) wm.hist = m.hist.filter(x => x && typeof x === "object" && FAV[x.id] && ["ok", "fail", "no"].includes(x.res)).slice(-12).map(x => ({ id: x.id, res: x.res, day: isNum(x.day) ? x.day : 0 }));
    const f = m.fav;
    if (f && typeof f === "object" && FAV[f.id] && isNum(f.deadline)) {
      const d = {}; if (f.data && typeof f.data === "object") for (const k in f.data) { const v = f.data[k]; if (isNum(v) || typeof v === "boolean" || typeof v === "string") d[k] = typeof v === "string" ? v.slice(0, 40) : v; }
      wm.fav = { id: f.id, day: isNum(f.day) ? f.day : s.day, deadline: Math.round(f.deadline), data: d };
    }
  }
  return w;
}
function ensure() {
  const s = S(); if (!s) return false;
  if (s === lastS) return true;
  lastS = s;
  s.world = sanitizeWorld(s.world, s);
  resetRuntime();
  return true;
}
const WS = () => S().world;

// =====================================================================
// DÍAS DE LA SEMANA Y CLIMA
// =====================================================================
const weekdayIdx = day => ((day - 1 + W.firstWeekday) % 7 + 7) % 7;
const weekdayName = day => W.weekdays[weekdayIdx(day)];
const isWeekend = day => { const i = weekdayIdx(day); return i === 4 || i === 5; };
function hash01(a, b) { let h = (a ^ 0x9e3779b9) + b * 0x85ebca6b; h = Math.imul(h ^ (h >>> 16), 0x7feb352d); h = Math.imul(h ^ (h >>> 15), 0x846ca68b); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function weatherFor(day) {
  const w = WS(); if (w.force[day]) return w.force[day];
  if (day <= 1) return "sunny";
  let r = hash01(w.seed, day), id = WX_IDS[0];
  const total = WX_IDS.reduce((a, k) => a + WX[k].chance, 0); r *= total;
  for (const k of WX_IDS) { r -= WX[k].chance; if (r <= 0) { id = k; break; } }
  if (day === 2 && (id === "storm" || id === "rain")) id = "cloudy"; // los dos primeros días (tutorial) sin lluvia
  return id;
}
const wxToday = () => weatherFor(S().day);
const WXD = () => WX[wxToday()];
function demandMul() {
  if (!ensure()) return 1;
  return W.weekdayDemand[weekdayIdx(S().day)] * WXD().demand;
}
function typeMul(id) { if (!ensure()) return 1; const t = WXD().types; return (t && t[id]) || 1; }
function crowdMul() { if (!ensure()) return 1; return W.weekdayCrowd[weekdayIdx(S().day)] || 1; }
function catMul(k) { if (!ensure()) return 1; const w = WXD(); return k === "bebida" && w.drinkCat ? w.drinkCat : 1; }
function outageMul() { if (!ensure()) return 1; return WXD().outageMul || 1; }
function rainLevel() { return ensure() ? rainNow : 0; }
function pctTxt(k) { const p = Math.round((k - 1) * 100); return (p > 0 ? "+" : "") + p + "%"; }

// =====================================================================
// CIELO: colores por hora (no agrega luces: ajusta sol/luna, hemisferio y fachada)
// =====================================================================
const KF = [ // hora, cielo, sol, intensidad del sol, hemisferio, fachada (× base)
  [8.0, 0xe9ae86, 0xffc49a, 0.55, 0.64, 0.6],
  [9.5, 0x9cc6ea, 0xfff1da, 0.9, 0.74, 0.3],
  [16.5, 0x8dbbe2, 0xfff0d6, 0.9, 0.74, 0.3],
  [18.6, 0xe0743f, 0xff9554, 0.62, 0.66, 0.75],
  [20.0, 0x27356a, 0x9aa8d8, 0.42, 0.6, 1.0],
  [21.5, 0x0a1424, 0x8fa6d6, 0.35, 0.6, 1.0],
  [24.1, 0x0a1424, 0x8fa6d6, 0.35, 0.6, 1.0],
];
const WX_LOOK = { // mezcla hacia gris, multiplicador de sol, niebla cerca/lejos
  sunny: { grey: 0, sun: 1, near: 32, far: 75 },
  cloudy: { grey: 0.5, sun: 0.68, near: 28, far: 66 },
  rain: { grey: 0.72, sun: 0.5, near: 16, far: 46 },
  storm: { grey: 0.86, sun: 0.38, near: 12, far: 38 },
  heat: { grey: 0, sun: 1.12, near: 24, far: 60, tint: 0xe6cf9a, tintK: 0.3 },
};
const cA = new T.Color(), cB = new T.Color(), cSky = new T.Color(), cSun = new T.Color(), cGrey = new T.Color(), cFlash = new T.Color(0xdfe6ff);
const sky = { hour: 8, phase: "", bg: 0, sun: 0, sunI: 0, hemiI: 0, facadeK: 1, fogNear: 32, fogFar: 75 };
let facadeBase = null, flash = 0, flash2 = 0, rainNow = 0, wet = 0;
const FOG_IN = { color: 0x1c0e09, near: 13, far: 52 }, cFogIn = new T.Color(FOG_IN.color); let inFog = 0; // niebla de adentro
function phaseOf(h) { return h < 9.5 ? "Amanecer" : h < 16.5 ? "Día" : h < 19.6 ? "Atardecer" : "Noche"; }
function computeSky(h, wxId) {
  let i = 0; while (i < KF.length - 2 && h >= KF[i + 1][0]) i++;
  const a = KF[i], b = KF[i + 1], k = clamp((h - a[0]) / (b[0] - a[0]), 0, 1);
  cSky.set(a[1]).lerp(cA.set(b[1]), k); cSun.set(a[2]).lerp(cB.set(b[2]), k);
  let sunI = a[3] + (b[3] - a[3]) * k, hemiI = a[4] + (b[4] - a[4]) * k, fac = a[5] + (b[5] - a[5]) * k;
  const L = WX_LOOK[wxId] || WX_LOOK.sunny;
  if (L.grey) { const lum = cSky.r * 0.3 + cSky.g * 0.55 + cSky.b * 0.15; cGrey.setRGB(lum * 0.92, lum * 0.95, lum * 1.02); cSky.lerp(cGrey, L.grey); cSun.lerp(cGrey.setRGB(0.75, 0.78, 0.82), L.grey * 0.6); }
  if (L.tint) { cSky.lerp(cA.set(L.tint), L.tintK * clamp(sunI / 0.9, 0, 1)); }
  sunI *= L.sun; hemiI = 0.6 + (hemiI - 0.6) * L.sun;
  if (L.grey > 0.6) fac = Math.max(fac, 0.75); // con lluvia se prenden las luces de la fachada
  sky.hour = h; sky.phase = phaseOf(h); sky.sunI = sunI; sky.hemiI = hemiI; sky.facadeK = fac; sky.fogNear = L.near; sky.fogFar = L.far;
  return sky;
}
function applySky(real) {
  const s = S(); if (!s) return;
  const id = wxToday(), sk = computeSky(hourF(), id), sc = G.scene;
  // relámpago: el cielo se pone blanco un instante y la "luna" se dispara
  const f = Math.max(flash, flash2 * 0.7);
  if (f > 0) cSky.lerp(cFlash, f * 0.75);
  if (!sc.background || !sc.background.isColor) sc.background = new T.Color();
  sc.background.copy(cSky).convertLinearToSRGB(); // el fondo se pinta tal cual (sin pasar por la salida sRGB del renderer)
  // adentro del local la niebla es cálida y oscura (paso 1: el fondo del salón se pierde en penumbra, no en cielo)
  const pl = G.player, inside = !!pl && Math.abs(pl.x) < 22 && pl.z > -10 && pl.z < 10;
  inFog += ((inside ? 1 : 0) - inFog) * Math.min(1, (real || 0) * 2.5);
  if (sc.fog) { sc.fog.color.copy(cSky).multiplyScalar(0.92).lerp(cFogIn, inFog); sc.fog.near = sk.fogNear + (FOG_IN.near - sk.fogNear) * inFog; sc.fog.far = sk.fogFar + (FOG_IN.far - sk.fogFar) * inFog; }
  sky.bg = cSky.getHex();
  // exterior.js: cúpula del cielo, estrellas, ventanas de la ciudad, faroles y tránsito siguen este mismo cielo
  if (window.CasinoExterior) window.CasinoExterior.sky(cSky, hourF(), real, id, f);
  if (G.moon) { G.moon.color.copy(cSun); G.moon.intensity = sk.sunI + f * 2.6; sky.sun = G.moon.color.getHex(); }
  // el apagón de life.js baja el resto de las luces: en ese momento no las tocamos
  const out = window.CasinoLife && window.CasinoLife.outage;
  if (!out) {
    if (G.hemi) G.hemi.intensity = sk.hemiI + f * 0.25;
    const L = G.gfxLights || [];
    if (!facadeBase && L.length) facadeBase = L.map(l => l.intensity);
    if (facadeBase) for (let i = 0; i < L.length; i++) L[i].intensity = facadeBase[i] * sk.facadeK;
  }
  sky.hemiI = G.hemi ? G.hemi.intensity : 0;
  // vereda y calle mojadas: menos rugosas y más oscuras (brillan con la luz de la fachada)
  const target = rainNow > 0 ? 1 : 0; wet += (target - wet) * Math.min(1, real * 0.7);
  if (G.M) {
    if (!wetBase) wetBase = { road: G.M.road.color.getHex(), walk: G.M.walk.color.getHex(), grass: G.M.grass.color.getHex() };
    G.M.road.roughness = 1 - wet * 0.68; G.M.walk.roughness = 0.95 - wet * 0.6; G.M.road.metalness = wet * 0.35; G.M.walk.metalness = wet * 0.25;
    G.M.road.color.setHex(wetBase.road).multiplyScalar(1 - wet * 0.35); G.M.walk.color.setHex(wetBase.walk).multiplyScalar(1 - wet * 0.4); G.M.grass.color.setHex(wetBase.grass).multiplyScalar(1 - wet * 0.3);
  }
}
let wetBase = null;

// lluvia: segmentos verticales fijos en dos copias que bajan (sin tocar vértices en cada cuadro)
const RAIN_N = 1600, RAIN_H = 16;
const rainGeo = new T.BufferGeometry();
{
  const pos = new Float32Array(RAIN_N * 6);
  for (let i = 0; i < RAIN_N; i++) {
    const x = rnd(-34, 34), z = rnd(-46, -10.7), y = rnd(0, RAIN_H), len = rnd(0.45, 0.75);
    pos.set([x, y, z, x + 0.05, y - len, z + 0.02], i * 6);
  }
  rainGeo.setAttribute("position", new T.BufferAttribute(pos, 3));
}
const rainMat = new T.LineBasicMaterial({ color: 0xb4c4d8, transparent: true, opacity: 0.5, depthWrite: false });
const rainA = new T.LineSegments(rainGeo, rainMat), rainB = new T.LineSegments(rainGeo, rainMat);
rainA.frustumCulled = rainB.frustumCulled = false; rainA.visible = rainB.visible = false; rainA.renderOrder = rainB.renderOrder = 3;
G.scene.add(rainA); G.scene.add(rainB);
let rainOff = 0;
function updateRain(real) {
  const id = wxToday(), target = id === "storm" ? 1 : id === "rain" ? 0.62 : 0;
  rainNow += (target - rainNow) * Math.min(1, real * 0.8);
  if (Math.abs(rainNow - target) < 0.01) rainNow = target;
  const on = rainNow > 0.02 && !S().dayOver;
  rainA.visible = rainB.visible = on;
  if (!on) return;
  rainGeo.setDrawRange(0, Math.floor(RAIN_N * rainNow) * 2);
  rainMat.opacity = 0.32 + rainNow * 0.25;
  rainOff = (rainOff + real * (id === "storm" ? 15 : 11)) % RAIN_H;
  rainA.position.y = -rainOff; rainB.position.y = RAIN_H - rainOff;
}
// relámpagos (tiempo de simulación: con la partida en pausa no hay rayos)
let flashT = 10, flashCount = 0, boltLeft = 0;
function thunderTick(dt) {
  const w = WXD(); if (!w.flashEvery || S().dayOver) return;
  flashT -= dt; if (flashT > 0) return;
  flashT = rnd(w.flashEvery[0], w.flashEvery[1]);
  strike();
}
function strike() {
  flash = 1; boltLeft = Math.random() < 0.6 ? 0.22 : 0; flashCount++;
  G.sfx("thunder", null, null, { delay: rnd(0.25, 1.4) });
  const w = WXD();
  if (G.isOpen && window.CasinoLife && window.CasinoLife.trigger && !window.CasinoLife.outage && Math.random() < (w.outageChance || 0)) {
    if (window.CasinoLife.trigger("outage")) G.toast("¡Cayó un rayo cerca y se cortó la luz!", "bad");
  }
}
function updateFlash(real) {
  if (flash > 0) flash = Math.max(0, flash - real * 5);
  if (boltLeft > 0) { boltLeft -= real; if (boltLeft <= 0) flash2 = 1; }
  if (flash2 > 0) flash2 = Math.max(0, flash2 - real * 4);
}

// =====================================================================
// HOTEL: recepción, ascensor y pisos (las habitaciones son un menú)
// =====================================================================
const NAMES = ["Sr. Pereyra", "Sra. Ledesma", "Sr. Quiroga", "Sra. Benítez", "Sr. Arce", "Sra. Funes Paz", "Sr. Otamendi", "Sra. Villalba", "Sr. Cáceres", "Sra. Montiel", "Sr. Rivas", "Sra. Ocampo", "Dr. Iturbe", "Sra. Lagos", "Sr. Medina", "Sra. Ponce", "Ing. Salvatierra", "Sra. Duarte", "Sr. Bustos", "Sra. Navarro"];
const DESK = { x: -14.4, z: -11.75, w: 2.4, d: 0.7, front: { x: -14.4, z: -12.75 }, back: { x: -14.4, z: -10.85 } };
const ELEV = { x: -18.2, z: -10.2, out: { x: -18.2, z: -10.95 } };
const STREET_IN = { x: -21, z: -15.2 };
const ROOM_NO = { standard: 101, suite: 201, penthouse: 301 };
const hotelGroup = new T.Group(); hotelGroup.visible = false; G.scene.add(hotelGroup);
let deskCollider = null, elevDoors = null, elevOpen = 0, elevTarget = 0, elevHold = 0, towerTex = null, towerEmi = null, towerSig = "", indicator = null, receptionist = null;
const towerCanvas = document.createElement("canvas"); towerCanvas.width = 512; towerCanvas.height = 256;
const towerEmiCanvas = document.createElement("canvas"); towerEmiCanvas.width = 512; towerEmiCanvas.height = 256;
function buildHotel() {
  const brass = A.materials.brass, dark = A.std(0x1b1410, 0.7), wood = A.std(0x5a3a22, 0.55), stone = A.std(0xd8cdb4, 0.8);
  // pisos del hotel sobre el ala oeste (de afuera se ven las ventanas: prendidas según la ocupación)
  towerTex = new T.CanvasTexture(towerCanvas); towerEmi = new T.CanvasTexture(towerEmiCanvas);
  const side = A.std(0x3b2a22, 0.85);
  const front = new T.MeshStandardMaterial({ map: towerTex, emissive: 0xffffff, emissiveMap: towerEmi, roughness: 0.8 });
  const tower = new T.Mesh(new T.BoxGeometry(14, 6.9, 13), [side, side, side, side, front, side]);
  tower.rotation.y = Math.PI; tower.position.set(-15, 3.5 + 3.45, -3.65); hotelGroup.add(tower);
  const cornice = new T.Mesh(new T.BoxGeometry(14.4, 0.3, 13.4), brass); cornice.position.set(-15, 10.45, -3.65); hotelGroup.add(cornice);
  const s = A.makeNeonSign({ text: "HOTEL DORADO", color: 0xffd45a, color2: 0xff6ab0, icons: ["star"], w: 5.2, h: 1.1 });
  s.position.set(-15, 9.6, -10.25); s.rotation.y = Math.PI; hotelGroup.add(s); if (s.api) signApi = s.api;
  // marquesina del lobby
  const canopy = new T.Mesh(new T.BoxGeometry(7.4, 0.16, 2.9), A.std(0x2a1a14, 0.6)); canopy.position.set(-15.6, 3.15, -11.6); hotelGroup.add(canopy);
  const trim = new T.Mesh(new T.BoxGeometry(7.5, 0.08, 0.08), brass); trim.position.set(-15.6, 3.08, -13.05); hotelGroup.add(trim);
  for (const x of [-19.1, -12.1]) { const p = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 3.1, 10), brass); p.position.set(x, 1.55, -12.95); hotelGroup.add(p); }
  const rug = new T.Mesh(new T.PlaneGeometry(7.2, 2.6), A.std(0x6e1423, 0.95)); rug.rotation.x = -Math.PI / 2; rug.position.set(-15.6, 0.03, -11.55); hotelGroup.add(rug);
  // mostrador de recepción
  const desk = new T.Group(); desk.position.set(DESK.x, 0, DESK.z); hotelGroup.add(desk);
  const body = new T.Mesh(new T.BoxGeometry(DESK.w, 1.05, DESK.d), wood); body.position.y = 0.525; desk.add(body);
  const top = new T.Mesh(new T.BoxGeometry(DESK.w + 0.12, 0.06, DESK.d + 0.12), stone); top.position.y = 1.08; desk.add(top);
  const band = new T.Mesh(new T.BoxGeometry(DESK.w + 0.02, 0.06, 0.02), brass); band.position.set(0, 0.86, -DESK.d / 2 - 0.01); desk.add(band);
  const bell = new T.Mesh(new T.SphereGeometry(0.07, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), brass); bell.position.set(0.6, 1.11, -0.1); desk.add(bell);
  const book = new T.Mesh(new T.BoxGeometry(0.34, 0.04, 0.26), A.std(0x2a3a6a, 0.6)); book.position.set(-0.4, 1.13, -0.05); desk.add(book);
  const signTex = A.canvasTex(512, 128, (g, w, h) => { g.fillStyle = "#1b1410"; g.fillRect(0, 0, w, h); g.strokeStyle = "#d9a84a"; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = "#f6c766"; g.font = "bold 64px Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("RECEPCIÓN", w / 2, h / 2 + 4); });
  const sign = new T.Mesh(new T.PlaneGeometry(2.0, 0.5), new T.MeshBasicMaterial({ map: signTex })); sign.position.set(DESK.x, 2.45, -10.17); sign.rotation.y = Math.PI; hotelGroup.add(sign);
  // ascensor
  const frame = new T.Mesh(new T.BoxGeometry(1.7, 2.6, 0.12), brass); frame.position.set(ELEV.x, 1.3, -10.18); hotelGroup.add(frame);
  const inside = new T.Mesh(new T.PlaneGeometry(1.4, 2.35), A.std(0x2a2018, 0.6)); inside.position.set(ELEV.x, 1.2, -10.235); inside.rotation.y = Math.PI; hotelGroup.add(inside);
  const doorMat = A.std(0xb8b2a6, 0.3, 0.8), dg = new T.BoxGeometry(0.7, 2.35, 0.05);
  const dl = new T.Mesh(dg, doorMat), dr = new T.Mesh(dg, doorMat); dl.position.set(ELEV.x + 0.35, 1.2, -10.27); dr.position.set(ELEV.x - 0.35, 1.2, -10.27);
  hotelGroup.add(dl); hotelGroup.add(dr); elevDoors = [dl, dr];
  const indTex = new T.CanvasTexture(document.createElement("canvas")); indTex.image.width = 128; indTex.image.height = 48;
  indicator = { tex: indTex, floor: -1 };
  const ind = new T.Mesh(new T.PlaneGeometry(0.5, 0.19), new T.MeshBasicMaterial({ map: indTex })); ind.position.set(ELEV.x, 2.72, -10.25); ind.rotation.y = Math.PI; hotelGroup.add(ind);
  drawIndicator(0);
  const btn = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 0.03, 12), A.std(0xffd45a, 0.3, 0, 0x553300)); btn.rotation.x = Math.PI / 2; btn.position.set(ELEV.x - 1.05, 1.15, -10.25); hotelGroup.add(btn);
  // planta y escalera de servicio pintada (la escalera es decorativa: los pisos no se caminan)
  const pl = A.makePlant ? A.makePlant() : null; if (pl) { pl.position.set(-12.6, 0, -10.6); hotelGroup.add(pl); }
  G.proxy(desk, DESK.w + 0.2, 1.3, DESK.d + 0.3, deskInteract, 0.65);
  G.proxy(frame, 1.6, 2.4, 0.6, elevInteract, 0, 0, -0.3);
}
let signApi = null;
function drawIndicator(floor) {
  if (!indicator || indicator.floor === floor) return; indicator.floor = floor;
  const c = indicator.tex.image, g = c.getContext("2d"); g.fillStyle = "#0b0805"; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#ff9a3a"; g.font = "bold 34px 'IBM Plex Mono', monospace"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(floor ? `▲ ${floor}` : "PB", c.width / 2, c.height / 2 + 2);
  indicator.tex.needsUpdate = true;
}
function drawTower() {
  const h = WS().hotel, occ = { standard: 0, suite: 0, penthouse: 0 }; for (const g of h.guests) occ[g.room]++;
  const sig = ROOM_IDS.map(r => h.rooms[r] + ":" + occ[r]).join("|") + "|" + (S().dayOver ? 1 : 0);
  if (sig === towerSig) return; towerSig = sig;
  const g = towerCanvas.getContext("2d"), e = towerEmiCanvas.getContext("2d"), Wd = 512, Hd = 256;
  g.fillStyle = "#4a3428"; g.fillRect(0, 0, Wd, Hd); e.fillStyle = "#000"; e.fillRect(0, 0, Wd, Hd);
  g.fillStyle = "#3a281e"; for (let y = 0; y < Hd; y += 12) g.fillRect(0, y, Wd, 2);
  const floors = [["penthouse", 1], ["suite", 4], ["standard", 6]]; // piso 3 arriba, 1 abajo
  floors.forEach(([r, n], fi) => {
    const y = 18 + fi * 80, owned = h.rooms[r], used = occ[r], cols = r === "penthouse" ? 1 : 8;
    g.fillStyle = "#d9a84a"; g.fillRect(0, y + 64, Wd, 3);
    for (let i = 0; i < cols; i++) {
      const ww = r === "penthouse" ? 300 : 40, x = r === "penthouse" ? (Wd - ww) / 2 : 18 + i * 62, slot = r === "penthouse" ? 0 : Math.floor(i * n / cols);
      const isOwned = slot < owned && (r !== "penthouse" || owned > 0), lit = isOwned && slot < used;
      g.fillStyle = lit ? "#ffd998" : isOwned ? "#5a6a7a" : "#1f262e"; g.fillRect(x, y, ww, 52);
      g.fillStyle = "#2a1a12"; g.fillRect(x + ww / 2 - 1, y, 2, 52); g.fillRect(x, y + 24, ww, 2);
      if (lit) { e.fillStyle = "#e8b870"; e.fillRect(x, y, ww, 52); }
      else if (isOwned) { e.fillStyle = "#151a22"; e.fillRect(x, y, ww, 52); }
    }
  });
  towerTex.needsUpdate = true; towerEmi.needsUpdate = true;
}
function syncHotel() {
  const h = WS().hotel;
  if (h.built && !elevDoors) buildHotel();
  hotelGroup.visible = h.built;
  if (h.built && !deskCollider) deskCollider = G.boxAt(DESK.x, DESK.z, DESK.w, DESK.d, "shop");
  if (!h.built && deskCollider) { G.removeCollider(deskCollider); deskCollider = null; }
  if (h.built) { drawTower(); syncReceptionist(); }
}
function syncReceptionist() {
  const h = WS().hotel;
  if (h.recep && !receptionist) {
    receptionist = A.makePerson({ uniform: "host", female: true, skin: 0xd9a074, hair: 0x3a2410 });
    receptionist.position.set(DESK.back.x, 0, DESK.back.z); receptionist.rotation.y = Math.PI; G.scene.add(receptionist);
  } else if (!h.recep && receptionist) { G.scene.remove(receptionist); receptionist = null; }
}
// pool de huéspedes que llegan con la valija (muñecos propios: no son clientes del salón)
const arrivals = new Map(); // id → { e, group, api, x, z, path, mode, t }
const personPool = [];
function guestLook(room) {
  if (room === "penthouse") return { vip: true, jacket: pick([0x1a1a22, 0x5a1820, 0x2a3a6a]), pants: 0x15171a, skin: pick(A.SKINS), hair: pick([0x1a1410, 0x8a8a8a, 0x3a2410]), height: 1 };
  if (room === "suite") return { vip: true, female: Math.random() < 0.5, jacket: pick([0x3a2a4a, 0x22303a, 0x4a2a1a]), pants: 0x22242a, skin: pick(A.SKINS), height: 1 };
  return { shirt: pick([0x6a8ab0, 0xb06a6a, 0x7aa07a, 0xd0b080]), pants: pick([0x2a2a3a, 0x3a3020]), skin: pick(A.SKINS), female: Math.random() < 0.5, height: rnd(0.95, 1.03) };
}
const suitcaseGeo = new T.BoxGeometry(0.42, 0.5, 0.16), suitcaseMat = A.std(0x6a3a1a, 0.6);
function acquireArrival(e) {
  let g = null;
  const i = personPool.findIndex(p => p.room === e.room); if (i >= 0) g = personPool.splice(i, 1)[0].group;
  if (!g) {
    g = A.makePerson(guestLook(e.room));
    const sc = new T.Mesh(suitcaseGeo, suitcaseMat); sc.position.set(0.32, 0.25, 0); g.add(sc);
  }
  g.userData.room = e.room; G.scene.add(g);
  return g;
}
function releaseArrival(a) {
  G.scene.remove(a.group); if (a.proxy) G.dropProxy(a.proxy);
  personPool.push({ room: a.e.room, group: a.group }); arrivals.delete(a.e.id);
}
function walkTo(a, x, z) { a.path = G.findPath(a.x, a.z, x, z); a.mode = "walk"; }
function stepArrival(a, dt) {
  const t = a.path && a.path[0];
  if (!t) return true;
  const dx = t.x - a.x, dz = t.z - a.z, d = Math.hypot(dx, dz), step = 1.6 * dt;
  if (d <= step) { a.x = t.x; a.z = t.z; a.path.shift(); } else { a.x += dx / d * step; a.z += dz / d * step; a.group.rotation.y = Math.atan2(dx, dz); }
  a.group.position.set(a.x, 0, a.z); a.group.api.walk(dt, 1.6);
  return !a.path.length;
}
function spawnArrival(e, atDesk) {
  if (arrivals.has(e.id)) return arrivals.get(e.id);
  const g = acquireArrival(e), a = { e, group: g, x: STREET_IN.x, z: STREET_IN.z, path: null, mode: "walk", t: 0 };
  arrivals.set(e.id, a);
  const spot = deskSpot(e);
  if (atDesk) { a.x = spot.x; a.z = spot.z; a.mode = "wait"; a.group.rotation.y = 0; }
  g.position.set(a.x, 0, a.z);
  if (!atDesk) walkTo(a, spot.x, spot.z);
  return a;
}
const SPOT_OFF = [[0, 0], [0.85, -0.35], [-0.85, -0.35], [0.4, -1.0], [-0.4, -1.0]];
function deskSpot(e) {
  const waiting = WS().hotel.book.list.filter(x => x.st === "waiting");
  const o = SPOT_OFF[Math.max(0, waiting.indexOf(e)) % SPOT_OFF.length];
  return { x: DESK.front.x + o[0], z: DESK.front.z + o[1] };
}
function hToday() { const h = WS().hotel; if (!h.today || h.today.day !== S().day) h.today = { day: S().day, checkins: 0, down: 0 }; return h.today; }
function freeRooms(room) {
  const h = WS().hotel; let used = 0;
  for (const g of h.guests) if (g.room === room) used++;
  for (const e of h.book.list) if (e.room === room && (e.st === "pending" || e.st === "waiting")) used++;
  return Math.max(0, h.rooms[room] - used);
}
function freeNumbers(room) {
  const h = WS().hotel, used = new Set(h.guests.map(g => g.no)), out = [];
  for (let i = 0; i < h.rooms[room]; i++) { const no = ROOM_NO[room] + i; if (!used.has(no)) out.push(no); }
  return out;
}
function bookChance(room) {
  const h = WS().hotel, s = S(), R = H.rooms[room];
  if (R.minRep && s.rep < R.minRep) return 0;
  return clamp(H.bookBase * (0.4 + s.rep / 100) * H.weekend[weekdayIdx(s.day)] * (WX[wxToday()].hotel || 1) * (0.5 + h.clean / 200), 0, 0.95);
}
function planBookings() {
  const s = S(), h = WS().hotel;
  h.book = { day: s.day, list: [] };
  if (!h.built) return;
  const now = hourF(), from = Math.max(H.arrive[0], now + 0.25), to = H.arrive[1];
  for (const r of ROOM_IDS) {
    const free = freeRooms(r), p = bookChance(r);
    for (let i = 0; i < free; i++) if (Math.random() < p && from < to) h.book.list.push({ id: h.uid++, name: pick(NAMES), room: r, nights: rndi(H.nights[0], H.nights[1]), at: rnd(from, to) * 60, st: "pending", wait: 0 });
  }
  h.book.list.sort((a, b) => a.at - b.at);
  // los que ya están alojados bajan a jugar a la noche
  for (const g of h.guests) planDown(g);
}
function planDown(g) { g.downDay = S().day; g.downAt = rnd(Math.max(H.downHours[0], hourF() + 0.2), H.downHours[1]) * 60; g.downDone = false; }
function hotelTick(dt) {
  const s = S(), h = WS().hotel;
  if (!h.built) return;
  if (h.book.day !== s.day) planBookings();
  for (const e of h.book.list) {
    if (e.st === "pending" && s.minutes >= e.at) { e.st = "waiting"; e.wait = 0; spawnArrival(e, false); if (!h.recep) G.toast(`Llegó un huésped al hotel (${H.rooms[e.room].name}). Atendelo en la recepción, a la izquierda de la entrada.`, "good"); G.sfx("vip", DESK.x, DESK.z); }
    if (e.st === "waiting") {
      e.wait += dt;
      const a = arrivals.get(e.id) || spawnArrival(e, true);
      if (h.recep && a.mode === "wait" && e.wait > 4) checkIn(e, null, "recep");
      else if (e.wait > H.waitHours * HOUR) { e.st = "gone"; G.Rep.change(H.repNoShow); G.toast(`${e.name} se cansó de esperar en la recepción y se fue a otro hotel.`, "bad"); leaveArrival(a, true); }
    }
  }
  for (const [, a] of arrivals) {
    if (a.mode === "walk") { if (stepArrival(a, dt)) { if (a.e.st === "waiting") { a.mode = "wait"; a.group.rotation.y = 0; } else if (a.leave === "elev") { a.mode = "elev"; a.t = 0; openElevator(2.5); } else releaseArrival(a); } }
    else if (a.mode === "wait") a.group.api.idle(dt);
    else if (a.mode === "elev") { a.t += dt; a.group.api.idle(dt); if (a.t > 0.6) { a.group.visible = false; } if (a.t > 1.2) { a.group.visible = true; releaseArrival(a); } }
  }
  // huéspedes que bajan a jugar
  if (G.isOpen) for (const g of h.guests) {
    if (g.downDay !== s.day) planDown(g);
    if (g.downDone || s.minutes < g.downAt || G.customers.length >= 32) continue;
    g.downDone = true; guestComesDown(g);
  }
}
function leaveArrival(a, street) { if (!a) return; a.leave = street ? "street" : "elev"; if (street) walkTo(a, STREET_IN.x, STREET_IN.z); else walkTo(a, ELEV.out.x, ELEV.out.z); a.mode = "walk"; }
function openElevator(sec) { elevTarget = 1; elevHold = sec; G.sfx("elevator", ELEV.x, ELEV.z); }
function guestComesDown(g) {
  const R = H.rooms[g.room], c = G.spawnCustomer(R.type);
  if (!c) return;
  c.hotelGuest = g.id; c.guestRoom = g.room;
  c.budget = Math.round(c.budget * R.budgetMul);
  c.rounds = Math.max(1, Math.round(c.rounds * R.roundsMul * (WXD().guestRounds || 1)));
  G.placeAgent(c, ELEV.out.x, ELEV.out.z); G.goTo(c, G.DOOR.x + rnd(-0.5, 0.5), G.DOOR.z);
  openElevator(2);
  const base = c.interact, pr = base.prompt;
  base.prompt = () => { const p = pr(); if (p && p.text === c.type.name) return { text: `Huésped · ${R.name}`, sub: `${g.name} · hab. ${g.no} · ${p.sub || ""}` }; return p; };
  hToday().down++;
}
function checkIn(e, choiceOk, by) {
  const h = WS().hotel, nums = freeNumbers(e.room);
  if (!nums.length) { e.st = "gone"; return false; }
  const no = nums[0], R = H.rooms[e.room];
  const g = { id: e.id, name: e.name, room: e.room, no, nights: e.nights, downDay: 0, downAt: 0 };
  h.guests.push(g); e.st = "done";
  const tipK = by === "recep" ? 0.1 : choiceOk ? H.tipRight : H.tipWrong, tip = Math.round(R.rate * tipK);
  if (tip > 0) G.Economy.add("hotelTips", tip);
  if (by === "player") {
    if (choiceOk) { G.Rank.add(H.xpCheckin); G.Rep.change(0.5); G.toast(`Registraste a ${e.name} en la ${no} (${R.name}, ${e.nights} noche${e.nights > 1 ? "s" : ""}). Propina ${fmt(tip)}.`, "good"); G.SFX.cash(); }
    else { G.Rep.change(-0.5); G.toast(`${e.name} quería otra habitación y tuvo que volver a bajar. Igual se quedó, pero de mal humor.`, "bad"); }
  }
  hToday().checkins++;
  planDown(g);
  const a = arrivals.get(e.id); if (a) leaveArrival(a, false);
  G.save(true); G.updateHud(true);
  return true;
}
// minijuego de recepción: elegir la llave correcta para lo que pidió el huésped
let ck = null;
function waitingGuest() { const h = WS().hotel; return h.book.list.find(e => e.st === "waiting" && arrivals.get(e.id) && arrivals.get(e.id).mode === "wait") || null; }
function openCheckin() {
  const e = waitingGuest(); if (!e) return;
  const R = H.rooms[e.room], h = WS().hotel, right = freeNumbers(e.room)[0];
  const opts = [{ no: right, room: e.room, ok: true }];
  const occupied = h.guests.map(g => ({ no: g.no, room: g.room }));
  const other = ROOM_IDS.filter(r => r !== e.room && h.rooms[r] > 0).map(r => ({ no: ROOM_NO[r] + rndi(0, h.rooms[r] - 1), room: r }));
  const pool = [...other, ...occupied.filter(o => o.room === e.room).map(o => ({ no: o.no, room: o.room, busy: true }))];
  while (pool.length && opts.length < 4) { const k = pool.splice((Math.random() * pool.length) | 0, 1)[0]; if (!opts.some(o => o.no === k.no)) opts.push({ no: k.no, room: k.room, ok: false, busy: k.busy }); }
  while (opts.length < 3) { const r = pick(ROOM_IDS), no = ROOM_NO[r] + rndi(5, 9); if (!opts.some(o => o.no === no)) opts.push({ no, room: r, ok: false, fake: true }); }
  opts.sort(() => Math.random() - 0.5);
  ck = { e, opts };
  G.openPanel("checkin", `<h2>Recepción · ${esc(e.name)}</h2>
    <div class="note"><b>«${hourF() < 13 ? "Buen día" : hourF() < 20 ? "Buenas tardes" : "Buenas noches"}. Tengo reserva: ${esc(R.name.toLowerCase())}, ${e.nights} noche${e.nights > 1 ? "s" : ""}.»</b><br>Tarifa ${fmt(R.rate)} por noche (se cobra al cierre). Dale la llave de una habitación libre de ese tipo.</div>
    <div class="list">${opts.map((o, i) => { const busy = o.busy || h.guests.some(g => g.no === o.no); return `<div class="item">${`<span class="sw" style="background:${o.room === "penthouse" ? "#c84cff" : o.room === "suite" ? "#40c8ff" : "#d9a84a"}"></span>`}<div class="t"><b>${G.isTouch ? "" : `${i + 1}. `}Llave ${o.no}</b><span>${H.rooms[o.room].name} · ${busy ? "ocupada" : o.fake ? "no existe" : "libre"}</span></div><div class="btns"><button data-wact="key" data-id="${i}">Dar llave</button></div></div>`; }).join("")}</div>
    <p class="dim">Llave correcta: propina y XP. Equivocarse: el huésped se enoja (−reputación). Con una recepcionista (Gestión → Hotel) se registran solos.</p>
    <div class="actions"><button class="ghost" data-act="close">Después</button></div>`);
}
function chooseKey(i) {
  if (!ck || G.ui.panel !== "checkin") return;
  const o = ck.opts[i]; if (!o) return;
  const e = ck.e; ck = null;
  G.closePanel(true, true);
  if (e.st !== "waiting") return;
  checkIn(e, !!o.ok, "player");
}
const deskInteract = {
  prompt() {
    const e = waitingGuest(), h = WS().hotel;
    if (e && !h.recep) return { text: `Registrar a ${e.name}`, sub: `Pide ${H.rooms[e.room].name.toLowerCase()} por ${e.nights} noche${e.nights > 1 ? "s" : ""} · ${Math.max(0, Math.ceil((H.waitHours * HOUR - e.wait) / HOUR * 60))} min de paciencia` };
    const occ = h.guests.length, tot = ROOM_IDS.reduce((a, r) => a + h.rooms[r], 0);
    return { text: "Recepción del Hotel Dorado", sub: `${occ}/${tot} habitaciones ocupadas · limpieza ${Math.round(h.clean)}%${h.recep ? " · recepcionista" : ""}` };
  },
  hold: () => 0, usable: () => true,
  use() { const e = waitingGuest(); if (e && !WS().hotel.recep) openCheckin(); else G.openMgmt("hotel"); },
};
const elevInteract = {
  prompt: () => ({ text: "Ascensor del hotel", sub: "Las habitaciones se manejan desde Gestión → Hotel" }),
  hold: () => 0, usable: () => true, use() { openElevator(2); G.openMgmt("hotel"); },
};
function updateElevator(real) {
  if (!elevDoors) return;
  if (elevHold > 0) { elevHold -= real; if (elevHold <= 0) elevTarget = 0; }
  elevOpen += (elevTarget - elevOpen) * Math.min(1, real * 4);
  elevDoors[0].position.x = ELEV.x + 0.35 + elevOpen * 0.62; elevDoors[1].position.x = ELEV.x - 0.35 - elevOpen * 0.62;
  drawIndicator(elevOpen > 0.5 ? 0 : (arrivals.size ? 2 : 0));
}
function hotelEndDay(notes) {
  const h = WS().hotel; if (!h.built) return;
  for (const [, a] of arrivals) releaseArrival(a);
  for (const e of h.book.list) if (e.st === "waiting" || e.st === "pending") e.st = "gone";
  let rev = 0, nights = 0;
  for (const g of h.guests) { rev += H.rooms[g.room].rate; nights++; }
  if (rev) G.Economy.add("hotel", rev);
  let upkeep = 0; for (const r of ROOM_IDS) upkeep += H.rooms[r].upkeep * h.rooms[r];
  let clean = 0; if (h.maids) for (const g of h.guests) clean += H.rooms[g.room].clean;
  if (upkeep + clean) G.Economy.force("hotelUpkeep", upkeep + clean);
  if (h.recep) G.Economy.force("wages", H.receptionWage);
  if (h.maids) h.clean = Math.min(100, h.clean + 35);
  else if (nights) { h.clean = Math.max(0, h.clean - H.cleanDecay * Math.min(1.5, nights / 3)); if (h.clean < 40) G.Rep.change(H.dirtyRep); }
  h.nights += nights; h.rev += rev;
  const st = hToday(), tot = ROOM_IDS.reduce((a, r) => a + h.rooms[r], 0);
  notes.push(`Hotel: ${nights}/${tot} habitaciones ocupadas · noches cobradas ${fmt(rev)} · limpieza y mantenimiento ${fmt(upkeep + clean)}${h.recep ? ` · recepcionista ${fmt(H.receptionWage)}` : ""} · ${st.checkins} registros, ${st.down} huéspedes bajaron a jugar.${!h.maids && h.clean < 40 ? " Las habitaciones están sucias: baja la reputación." : ""}`);
  // una noche menos para cada uno; los que terminan, se van
  const out = [];
  h.guests = h.guests.filter(g => { g.nights--; if (g.nights <= 0) { out.push(g.name); return false; } return true; });
  if (out.length) notes.push(`Hotel: se fueron ${out.join(", ")}.`);
  towerSig = "";
}
function buyHotelLic() {
  const h = WS().hotel; if (h.lic || S().rank < H.rank) return;
  if (!G.Economy.trySpend("licenses", H.licPrice)) return;
  h.lic = true; G.SFX.cash(); G.toast("Habilitación hotelera aprobada. Ya podés construir el Hotel Dorado.", "good"); G.save(true);
}
function buildHotelNow() {
  const h = WS().hotel; if (!h.lic || h.built) return;
  if (!G.Economy.trySpend("hotelBuild", H.buildPrice)) return;
  h.built = true; h.rooms.standard = Math.max(h.rooms.standard, 1); h.book = { day: 0, list: [] };
  syncHotel(); G.SFX.cash(); G.Rank.add(80);
  G.toast("¡Inauguraste el Hotel Dorado! La recepción y el ascensor están en la vereda, a la izquierda de la entrada. Ya tenés 1 habitación estándar.", "good"); G.save(true);
}
function roomWhyNot(r) {
  const h = WS().hotel, R = H.rooms[r];
  if (!h.built) return "Primero construí el hotel";
  if (h.rooms[r] >= R.max) return "Completo";
  if (S().rank < R.rank) return `Rango ${R.rank}`;
  if (R.needs) for (const k in R.needs) if (h.rooms[k] < R.needs[k]) return `Necesitás ${R.needs[k]} ${H.rooms[k].name.toLowerCase()}`;
  if (S().bank < R.price) return "Sin plata";
  return "";
}
function buyRoom(r) {
  if (roomWhyNot(r)) return;
  const R = H.rooms[r];
  if (!G.Economy.trySpend("hotelBuild", R.price)) return;
  WS().hotel.rooms[r]++; towerSig = ""; drawTower(); G.SFX.cash();
  G.toast(`Habitación nueva: ${R.name}. Tarifa ${fmt(R.rate)} por noche.`, "good"); G.save(true);
}
function hotelHtml() {
  const h = WS().hotel, s = S();
  if (!h.built) {
    const lockR = s.rank < H.rank;
    return `<p>Arriba del casino hay dos pisos vacíos. Un hotel trae <b>huéspedes</b>: pagan por noche y bajan a jugar con más presupuesto. La ocupación depende de la reputación, el día de la semana y el clima.</p>
      <div class="list">
        <div class="item${lockR ? " locked" : ""}${h.lic ? " sel" : ""}"><span class="sw" style="background:#d9a84a"></span><div class="t"><b>Habilitación hotelera · <span class="num">${fmt(H.licPrice)}</span>${lockR ? `<span class="tag lock">Rango ${H.rank}</span>` : ""}${h.lic ? '<span class="tag">Tuya</span>' : ""}</b><span>Permiso municipal para alojar gente arriba del salón.</span></div><div class="btns"><button data-wact="hlic" ${h.lic || lockR || s.bank < H.licPrice ? "disabled" : ""}>Comprar</button></div></div>
        <div class="item${!h.lic ? " locked" : ""}"><span class="sw" style="background:#6e1423"></span><div class="t"><b>Obra del Hotel Dorado · <span class="num">${fmt(H.buildPrice)}</span></b><span>Recepción y ascensor en la vereda, pisos arriba del ala oeste y una habitación estándar para empezar.</span></div><div class="btns"><button data-wact="hbuild" ${!h.lic || s.bank < H.buildPrice ? "disabled" : ""}>Construir</button></div></div>
      </div><p class="dim">Banco ${fmt(s.bank)}.</p>`;
  }
  const occ = { standard: 0, suite: 0, penthouse: 0 }; for (const g of h.guests) occ[g.room]++;
  const rows = ROOM_IDS.map(r => {
    const R = H.rooms[r], why = roomWhyNot(r), p = Math.round(bookChance(r) * 100);
    return `<div class="item${s.rank < R.rank ? " locked" : ""}"><span class="sw" style="background:${r === "penthouse" ? "#c84cff" : r === "suite" ? "#40c8ff" : "#d9a84a"}"></span><div class="t"><b>${R.name} · <span class="num">${h.rooms[r]}/${R.max}</span> · <span class="num">${fmt(R.price)}</span></b><span>${fmt(R.rate)} por noche · mantenimiento ${fmt(R.upkeep)}/día · limpieza ${fmt(R.clean)} por noche ocupada · ocupadas ${occ[r]} · hoy reserva el ${p}% de las libres${R.minRep ? ` (pide reputación ${R.minRep})` : ""}. Sus huéspedes juegan como ${esc(D.CUSTOMER_TYPES.find(t => t.id === R.type).name)} con presupuesto ×${R.budgetMul}.</span></div><div class="btns"><button data-wact="room" data-id="${r}" ${why ? "disabled" : ""}>${why && why !== "Sin plata" ? esc(why) : "Agregar"}</button></div></div>`;
  }).join("");
  const guests = h.guests.map(g => `<li>${esc(g.name)} · hab. ${g.no} (${H.rooms[g.room].name}) · ${g.nights} noche${g.nights > 1 ? "s" : ""} más</li>`).join("");
  const today = h.book.day === s.day ? h.book.list : [];
  const arr = today.map(e => `<li>${e.st === "done" ? "✓" : e.st === "gone" ? "✗" : e.st === "waiting" ? "🛎" : "·"} ${esc(e.name)} · ${H.rooms[e.room].name} · ${e.st === "pending" ? `llega ${two(Math.floor(e.at / 60))}:${two(Math.floor(e.at % 60))}` : e.st === "waiting" ? "esperando en la recepción" : e.st === "done" ? "registrado" : "se fue"}</li>`).join("");
  const tot = ROOM_IDS.reduce((a, r) => a + h.rooms[r], 0);
  return `<div class="statgrid"><div class="stat"><b>${h.guests.length}/${tot}</b><span>Ocupación esta noche</span></div><div class="stat"><b>${Math.round(h.clean)}%</b><span>Limpieza</span></div><div class="stat"><b>${fmtN(h.nights)}</b><span>Noches vendidas</span></div><div class="stat"><b>${fmt(h.rev)}</b><span>Cobrado en total</span></div></div>
    <div class="list">${rows}</div>
    <h3>Servicio</h3><div class="list">
      <div class="item${h.maids ? " sel" : ""}"><span class="sw" style="background:#6fd39b"></span><div class="t"><b>Mucamas ${h.maids ? "· contratadas" : "· sin servicio"}</b><span>Limpian cada noche (se paga por habitación ocupada). Sin mucamas la limpieza baja y con menos de 40% cae la reputación y la ocupación.</span></div><div class="btns"><button class="ghost" data-wact="maids">${h.maids ? "Suspender" : "Contratar"}</button></div></div>
      <div class="item${h.recep ? " sel" : ""}"><span class="sw" style="background:#6e1423"></span><div class="t"><b>Recepcionista ${h.recep ? "· trabajando" : ""}</b><span>Registra sola a los huéspedes (menos propina, sin XP). ${fmt(H.receptionWage)} por día.</span></div><div class="btns"><button class="ghost" data-wact="recep">${h.recep ? "Despedir" : "Contratar"}</button></div></div>
    </div>
    <h3>Hoy (${esc(weekdayName(s.day))} · ${esc(WX[wxToday()].name)})</h3>${arr ? `<ul class="unlocks">${arr}</ul>` : `<p class="dim">Sin reservas para hoy.</p>`}
    ${guests ? `<h3>Alojados</h3><ul class="unlocks">${guests}</ul>` : ""}
    <p class="dim">Las noches se cobran al cierre de caja. Los huéspedes llegan entre las ${H.arrive[0]} y las ${H.arrive[1]} h y bajan a jugar a la noche desde el ascensor.</p>`;
}
const fmtN = n => Math.round(n).toLocaleString("es-AR");

// =====================================================================
// FAVORES DE DON AURELIO
// =====================================================================
const aurelioL = (...l) => l.map(t => ["aurelio", t]);
const FAV = {
  lavado: {
    title: "Lavá la valija", can: () => S().rank >= 2,
    offer: () => aurelioL(`Socio, tengo una valija con ${fmt(MF.lavado.bag)} que necesita… circular. Hágala pasar por sus mesas y máquinas.`, `Cuando hayan entrado ${fmt(MF.lavado.bets)} en apuestas, usted se queda con el ${Math.round(MF.lavado.keep * 100)}%. Tiene ${MF.lavado.days} días.`),
    acceptSub: () => `+${Math.round(MF.lavado.keep * MF.lavado.bag)} si llegás · +${MF.lavado.heat} de calor ya · si el inspector revisa, puede encontrarla`,
    accept(f) { f.data.done = -S().today.st.bets; f.data.accDay = 0; G.Heat.add(MF.lavado.heat, "mafia"); const fl = Story()?.flags; if (fl) fl.dirty = (fl.dirty || 0) + 1; return MF.lavado.days; },
    prog: f => `${fmt(Math.min(MF.lavado.bets, lavadoBets(f)))}/${fmt(MF.lavado.bets)} apostado`,
    ok: f => lavadoBets(f) >= MF.lavado.bets,
    win(f) { G.Economy.add("mafia", Math.round(MF.lavado.bag * MF.lavado.keep)); G.Heat.add(MF.lavado.heatOk, "mafia"); return `Lavaste la valija: te quedaste ${fmt(MF.lavado.bag * MF.lavado.keep)}`; },
    lose() { G.Economy.force("mafia", MF.lavado.failPay); return `La valija no circuló a tiempo: Don Aurelio te cobró ${fmt(MF.lavado.failPay)}`; },
    okProt: MF.lavado.prot, failProt: MF.lavado.failProt, inspector: MF.lavado.findChance, fine: MF.lavado.fine,
  },
  amigo: {
    title: "Dejá ganar a un amigo", can: () => G.machines.length + G.tables.length >= 2,
    offer: () => aurelioL("Un amigo mío viene a jugar. Hombre de suerte, si usted me entiende. Esta noche las máquinas lo van a querer mucho.", `Recíbalo en la puerta como a un rey y déjelo ganar. Va a perder usted unos pesos, pero gana mi amistad.`),
    acceptSub: () => `Va a ganar ${fmt(MF.amigo.loss[0])}-${fmt(MF.amigo.loss[1])} · +${MF.amigo.prot} de protección si lo recibís`,
    accept(f) { const h = hourF(); f.data.visit = h < MF.amigo.hour - 0.5 ? S().day : S().day + 1; return f.data.visit - S().day; },
    prog: f => f.data.greeted ? "lo recibiste: está jugando" : S().day < f.data.visit ? `viene el día ${f.data.visit} a las ${MF.amigo.hour}:00` : f.data.spawned ? "¡está en la puerta! Recibilo" : `llega a las ${MF.amigo.hour}:00`,
    ok: f => !!f.data.greeted && !!f.data.paid,
    win(f) { return `El amigo de Don Aurelio se fue feliz con ${fmt(f.data.paid)} de tu casino`; },
    lose(f) { return f.data.why || "El amigo de Don Aurelio no fue recibido"; },
    okProt: MF.amigo.prot, failProt: MF.amigo.failProt,
  },
  paquete: {
    title: "Escondé un paquete", can: () => true,
    offer: () => aurelioL("Tengo un paquetito que no puede dormir en mi casa. Guárdelo en su oficina unos días, nada más.", `Le pago ${fmt(MF.paquete.pay)} ahora y ${fmt(MF.paquete.okPay)} cuando lo retiro. No lo abra. Y que no lo vea el inspector.`),
    acceptSub: () => `+${fmt(MF.paquete.pay)} ya · ${MF.paquete.closes} cierres guardándolo · si el inspector lo encuentra: multa ${fmt(MF.paquete.fine)}`,
    accept(f) { G.Economy.add("mafia", MF.paquete.pay); f.data.n = 0; showPackage(true); return MF.paquete.closes + 1; },
    prog: f => `${f.data.n || 0}/${MF.paquete.closes} cierres · está en la oficina`,
    ok: f => (f.data.n || 0) >= MF.paquete.closes,
    close: f => { f.data.n = (f.data.n || 0) + 1; },
    win() { G.Economy.add("mafia", MF.paquete.okPay); showPackage(false); return `Don Aurelio retiró el paquete y te pagó ${fmt(MF.paquete.okPay)}`; },
    lose(f) { showPackage(false); return f.data.why || "El paquete quedó en manos equivocadas"; },
    okProt: MF.paquete.prot, failProt: MF.paquete.failProt, inspector: MF.paquete.findChance, fine: MF.paquete.fine, heat: MF.paquete.heat,
  },
  despido: {
    title: "Despedí a un empleado", can: () => Object.keys(S().staff).some(r => S().staff[r] > 0),
    offer: () => { const r = staffPickRole(); const name = D.STAFF.find(s => s.role === r).name.toLowerCase(); return aurelioL(`Su ${name} anda hablando de más en el bar de la esquina. Habla de usted… y de mí.`, `Despídalo antes del cierre de mañana. Le dejo ${fmt(MF.despido.pay)} por la molestia.`); },
    acceptSub: () => `Despedí desde Gestión → Personal · +${fmt(MF.despido.pay)} y +${MF.despido.prot} de protección · el resto del personal se entera (−reputación)`,
    accept(f) { f.data.role = pendingRole || staffPickRole(); f.data.count = S().staff[f.data.role] || 0; return MF.despido.days - 1; },
    prog: f => `despedir: ${D.STAFF.find(s => s.role === f.data.role).name.toLowerCase()} (${S().staff[f.data.role] || 0} en planta)`,
    ok: f => (S().staff[f.data.role] || 0) < f.data.count,
    win() { G.Economy.add("mafia", MF.despido.pay); G.Rep.change(MF.despido.rep); return `Despediste al empleado que hablaba de más: +${fmt(MF.despido.pay)}`; },
    lose() { return "No despediste al empleado: Don Aurelio está molesto"; },
    okProt: MF.despido.prot, failProt: MF.despido.failProt,
  },
  sabotaje: {
    title: "Saboteá El Faraón", can: () => G.rivalOpen() && !S().rivalBought,
    offer: () => aurelioL("La señora de enfrente se está agrandando. Mis muchachos le dejaron un regalito en el tablero de luz de su vereda.", `Cruce después de las 20:00 y baje la palanca. Son ${fmt(MF.sabotaje.cost)} para los muchachos. Unos días a oscuras le van a enseñar humildad.`),
    acceptSub: () => `Pagás ${fmt(MF.sabotaje.cost)} · cruzá la calle de noche y mantené ${KEY} en el tablero · El Faraón pierde atractivo ${MF.sabotaje.rivalDays} días · +calor`,
    can2: () => S().bank >= MF.sabotaje.cost || `Necesitás ${fmt(MF.sabotaje.cost)} en el banco`,
    accept(f) { G.Economy.force("bribes", MF.sabotaje.cost); f.data.done = false; showFuse(true); return MF.sabotaje.days - 1; },
    prog: f => hourF() < 20 ? "esperá a las 20:00 y cruzá la calle" : "cruzá la calle: tablero de luz de El Faraón",
    ok: f => !!f.data.done,
    win() { const m = WS().mafia; m.sabotage = S().day + MF.sabotaje.rivalDays; G.Heat.add(MF.sabotaje.heat, "mafia"); showFuse(false); let msg = `El Faraón quedó a oscuras: pierde atractivo hasta el día ${m.sabotage}`; if (Math.random() < MF.sabotaje.seenChance) { G.Heat.add(MF.sabotaje.seenHeat, "mafia"); msg += " (un vecino te vio: +calor)"; } return msg; },
    lose() { showFuse(false); return "No bajaste la palanca a tiempo"; },
    okProt: MF.sabotaje.prot, failProt: MF.sabotaje.failProt,
  },
  proteccion: {
    title: "Pagá la protección", can: () => true,
    offer: () => aurelioL("La calle está brava, socio. Robos, peleas, inspectores nerviosos…", `Por ${fmt(protCost())} mis muchachos cuidan la cuadra. Usted duerme tranquilo. Yo también.`),
    acceptSub: () => `Pagás ${fmt(protCost())} · +${MF.proteccion.prot} de protección (menos ladrones y peleas, coimas más fáciles)`,
    can2: () => S().bank >= protCost() || `Necesitás ${fmt(protCost())} en el banco`,
    refuseSub: () => `−${-MF.proteccion.refuseProt} de protección y ladrones ${MF.proteccion.thiefDays} días`,
    accept() { G.Economy.force("protection", protCost()); return 0; },
    instant: true, ok: () => true, win() { return `Pagaste la protección (${fmt(protCost())})`; },
    okProt: MF.proteccion.prot, failProt: 0,
    refuse() { const m = WS().mafia; m.prot = clamp(m.prot + MF.proteccion.refuseProt, 0, 100); m.thiefUntil = S().day + MF.proteccion.thiefDays; },
  },
};
const protCost = () => MF.proteccion.perRank * S().rank;
let pendingRole = null;
function staffPickRole() { const rs = Object.keys(S().staff).filter(r => S().staff[r] > 0); pendingRole = rs.length ? pick(rs) : "sec"; return pendingRole; }
function lavadoBets(f) { return (f.data.done || 0) + (f.data.accDay === S().day ? 0 : S().today.st.bets); }
const curFav = () => WS().mafia.fav;
const favDef = () => curFav() ? FAV[curFav().id] : null;
function thiefMul() { if (!ensure()) return 1; const m = WS().mafia; return (1 - m.prot / 100 * MF.thiefK) * (S().day <= m.thiefUntil ? MF.proteccion.thiefMul : 1); }
function fightMul() { if (!ensure()) return 1; return 1 - WS().mafia.prot / 100 * MF.fightK; }
function rivalMul() { if (!ensure()) return 1; return S().day <= WS().mafia.sabotage ? MF.sabotaje.rivalMul : 1; }
// coimas más fáciles con protección (el inspector "conoce" a tus amigos)
{
  const orig = D.HEAT.bribeSuccess;
  if (typeof orig === "function" && !orig._world) {
    const wrapped = h => { const base = orig(h); if (!S() || !S().world) return base; return clamp(base + S().world.mafia.prot / 100 * MF.bribeK, 0, 0.95); };
    wrapped._world = true; wrapped.base = orig; D.HEAT.bribeSuccess = wrapped;
  }
}
let offering = null;
function pickFavour() {
  const m = WS().mafia;
  const ids = Object.keys(FAV).filter(id => id !== m.last && FAV[id].can());
  return ids.length ? pick(ids) : null;
}
function mafiaTick() {
  const s = S(), m = WS().mafia, St = Story();
  if (!St || !St.say || offering || m.fav || s.day < m.next || St.ending) return;
  const h = hourF();
  if (!G.isOpen || h < 11 || h >= 20 || St.busy || G.ui.panel || !St.met("aurelio") || St.aurelioBusy()) return;
  const id = pickFavour(); if (!id) { m.next = s.day + 1; return; }
  offerFavour(id);
}
const REPLY = {
  w_fav_deal: { lines: [["aurelio", "Sabía que podía contar con usted. Los detalles, en su libreta. El plazo, en mi memoria."]] },
  w_fav_thanks: { lines: [["aurelio", "Un placer hacer negocios. Esta cuadra ahora es más segura. Para usted."]] },
  w_fav_no: { lines: [["aurelio", "¿No? Qué palabra tan corta para un error tan largo. Buenas noches, socio."]] },
};
function offerFavour(id) {
  const St = Story(), d = FAV[id]; if (!St || !d || !St.say) return false;
  if (St.define) for (const k in REPLY) St.define(k, REPLY[k]); // respuestas de Don Aurelio (sin encolar)
  offering = id;
  const lines = d.offer();
  St.say("w_fav_" + id, {
    appear: "aurelio", lines: [["narr", `Don Aurelio entra al salón, se saca el sombrero y te espera con una sonrisa. Viene a pedir un favor: «${d.title}».`], ...lines],
    choices: [
      { key: "si", label: "Aceptar el favor", sub: d.acceptSub(), can: d.can2 || (() => true) },
      { key: "no", label: "Rechazarlo", sub: d.refuseSub ? d.refuseSub() : `−${-MF.refuseProt} de protección · Don Aurelio se ofende` },
    ],
    choose(k) { return k === "si" ? acceptFavour(id) : refuseFavour(id); },
  });
  return true;
}
function acceptFavour(id) {
  const d = FAV[id], m = WS().mafia, s = S(); offering = null;
  const f = { id, day: s.day, deadline: s.day, data: {} };
  m.fav = f; m.last = id; m.streak = 0;
  const days = d.accept(f) || 0; f.deadline = s.day + days;
  const fl = Story()?.flags; if (fl) fl.favores = (fl.favores || 0) + 1;
  Story()?.decide?.(`Le hiciste un favor a Don Aurelio: ${d.title.toLowerCase()}.`);
  if (d.instant) { finishFavour("ok"); G.save(true); return "w_fav_thanks"; }
  G.toast(`Favor aceptado: ${d.title}. Mirá el objetivo en el HUD.`, "");
  G.save(true); G.updateHud(true);
  return "w_fav_deal";
}
function refuseFavour(id) {
  const d = FAV[id], m = WS().mafia, s = S(); offering = null;
  m.last = id; m.next = s.day + rndi(MF.every[0], MF.every[1]);
  if (d.refuse) d.refuse(); else m.prot = clamp(m.prot + MF.refuseProt, 0, 100);
  m.streak++;
  if (m.streak >= MF.refuseStreakThieves) { m.thiefUntil = Math.max(m.thiefUntil, s.day + 1); G.toast("Don Aurelio está ofendido: estos días van a aparecer más ladrones.", "bad"); }
  m.hist.push({ id, res: "no", day: s.day }); if (m.hist.length > 12) m.hist.shift();
  const fl = Story()?.flags; if (fl) fl.aurelioMolesto = (fl.aurelioMolesto || 0) + 1;
  Story()?.decide?.(`Le dijiste que no a Don Aurelio: ${d.title.toLowerCase()}.`);
  G.save(true); G.updateHud(true);
  return "w_fav_no";
}
function finishFavour(res, notes, why) {
  const m = WS().mafia, f = m.fav; if (!f) return;
  const d = FAV[f.id]; if (why) f.data.why = why;
  const msg = res === "ok" ? d.win(f) : d.lose(f);
  m.prot = clamp(m.prot + (res === "ok" ? d.okProt : d.failProt), 0, 100);
  m.fav = null; m.next = S().day + rndi(MF.every[0], MF.every[1]);
  m.hist.push({ id: f.id, res, day: S().day }); if (m.hist.length > 12) m.hist.shift();
  const fl = Story()?.flags; if (fl && res === "fail") fl.aurelioMolesto = (fl.aurelioMolesto || 0) + 1;
  const line = `Favor de Don Aurelio ${res === "ok" ? "cumplido" : "fallido"}: ${msg} (protección ${res === "ok" ? "+" + d.okProt : d.failProt}).`;
  G.toast(line, res === "ok" ? "good" : "bad");
  (notes || S().today.notes).push(line);
  if (res === "fail" && Story()?.say) Story().say("w_fav_mad", { lines: [["aurelio", pick(["Me decepciona, socio. Y yo tengo muy mala memoria para las decepciones… mentira, me acuerdo de todas.", "Qué pena. Pensé que éramos amigos. Los amigos cumplen."])]] });
  G.save(true); G.updateHud(true);
}
function favTick(dt) {
  const m = WS().mafia, f = m.fav; if (!f) return;
  const d = FAV[f.id], s = S();
  if (f.id === "amigo") amigoTick(f, dt);
  if (d.ok(f) && !d.close) { finishFavour("ok"); return; }
  // el inspector encuentra la valija o el paquete
  const insp = G.inspector;
  if (insp && d.inspector && !insp._wSeen) { insp._wSeen = true; insp._wFav = f.id; }
  if (insp && insp._wFav === f.id && insp.state === "leave" && !insp._wChecked) {
    insp._wChecked = true;
    if (!insp.bribed && Math.random() < d.inspector * (1 - m.prot / 150)) {
      G.Economy.force("fines", d.fine); s.today.st.fines += d.fine; if (d.heat) G.Heat.add(d.heat, "mafia");
      finishFavour("fail", null, `el inspector encontró ${f.id === "paquete" ? "el paquete" : "la plata de la valija"}: multa ${fmt(d.fine)}`);
    }
  }
}
// el amigo de Don Aurelio: llega a la hora, hay que recibirlo en la puerta; al irse se lleva sus "ganancias"
let friend = null;
function amigoTick(f, dt) {
  const s = S();
  if (s.day !== f.data.visit || f.data.greeted && f.data.paid) return;
  if (!f.data.spawned && hourF() >= MF.amigo.hour) {
    if (!G.isOpen) { finishFavour("fail", null, "el casino estaba cerrado cuando llegó el amigo"); return; }
    const c = G.spawnCustomer("highroller");
    if (!c) return;
    f.data.spawned = true; friend = c; c.mafiaFriend = true; c.budget = Math.max(c.budget, 6000); c.greetLeft = MF.amigo.greetHours * HOUR + 12;
    const base = c.interact, pr = base.prompt, us = base.usable, use = base.use;
    base.prompt = () => !f.data.greeted && !c.dead ? { text: "Recibir al amigo de Don Aurelio", sub: "Sombrero blanco, sonrisa de jugador con suerte" } : (pr() || {});
    base.usable = () => (!f.data.greeted && !c.dead) || us();
    base.use = () => { if (!f.data.greeted && !c.dead) { f.data.greeted = true; G.toast("Recibiste al amigo de Don Aurelio. Esta noche la casa pierde.", ""); G.sfx("greet"); if (c.person) c.person.api.cheer(1); G.save(true); return; } use(); };
    G.setIcon(c.person, "star");
    G.toast("Llegó el amigo de Don Aurelio. Recibilo en la puerta (miralo y " + KEY + ").", "");
  }
  if (friend && !f.data.greeted) {
    friend.greetLeft -= dt;
    if (friend.greetLeft <= 0) { G.leaveCustomer(friend); finishFavour("fail", null, "nadie recibió al amigo en la puerta y se fue ofendido"); friend = null; return; }
  }
  if (friend && f.data.greeted && !f.data.paid && (friend.dead || friend.state === "leave")) payFriend(f);
}
function payFriend(f) {
  const loss = rndi(MF.amigo.loss[0], MF.amigo.loss[1]);
  G.Economy.force("mafia", loss); f.data.paid = loss;
  if (friend && friend.person) G.floatText(friend.x, 2.3, friend.z, "-" + fmt(loss), "#ff7a6a");
  friend = null;
}
// paquete en la oficina y tablero de luz de El Faraón
const pkg = new T.Mesh(new T.BoxGeometry(0.5, 0.32, 0.4), A.std(0x8a6a44, 0.85)); pkg.position.set(6.3, 0.16, -9.55); pkg.rotation.y = 0.3; pkg.visible = false; G.scene.add(pkg);
{ const tape = new T.Mesh(new T.BoxGeometry(0.52, 0.04, 0.08), A.std(0xd8cfa8, 0.6)); tape.position.y = 0.161; pkg.add(tape); }
G.proxy(pkg, 0.6, 0.5, 0.5, { prompt: () => ({ text: "Paquete de Don Aurelio", sub: "Mejor no abrirlo. Mejor no mirarlo." }), hold: () => 0, usable: () => false, use() {} }, 0.25);
function showPackage(on) { pkg.visible = !!on; }
const fuse = new T.Group(); fuse.position.set(9.5, 0, -24.55); fuse.visible = false; G.scene.add(fuse);
{
  const pole = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 2.2, 8), A.std(0x3a3f4a, 0.6, 0.4)); pole.position.y = 1.1; fuse.add(pole);
  const boxM = new T.Mesh(new T.BoxGeometry(0.6, 0.8, 0.25), A.std(0x5a6270, 0.5, 0.5)); boxM.position.set(0, 1.4, 0.15); fuse.add(boxM);
  const warn = new T.Mesh(new T.PlaneGeometry(0.3, 0.26), new T.MeshBasicMaterial({ map: A.canvasTex(64, 56, (g) => { g.fillStyle = "#ffd45a"; g.beginPath(); g.moveTo(32, 4); g.lineTo(60, 52); g.lineTo(4, 52); g.closePath(); g.fill(); g.fillStyle = "#111"; g.font = "bold 34px Arial"; g.textAlign = "center"; g.fillText("⚡", 32, 48); }) }));
  warn.position.set(0, 1.5, 0.28); fuse.add(warn);
  G.proxy(fuse, 0.9, 1.6, 0.8, {
    prompt: () => hourF() < 20 ? { text: "Tablero de luz de El Faraón", sub: "Todavía hay mucha gente mirando: volvé después de las 20:00" } : { text: "Bajar la palanca del tablero de El Faraón", sub: `Mantené ${KEY}: el favor de Don Aurelio` },
    hold: () => hourF() >= 20 ? MF.sabotaje.holdSec : 0,
    usable: () => hourF() >= 20 && !!curFav() && curFav().id === "sabotaje",
    use() { const f = curFav(); if (!f || f.id !== "sabotaje") return; f.data.done = true; G.sfx("powerdown", 9.5, -25); G.toast("¡Clac! El neón de El Faraón parpadea y se apaga.", "good"); },
  }, 1.0);
}
function showFuse(on) { fuse.visible = !!on; }
function mafiaEndDay(notes) {
  const m = WS().mafia, f = m.fav, s = S();
  if (f) {
    const d = FAV[f.id];
    if (f.id === "lavado" && f.data.accDay !== s.day) { f.data.done = (f.data.done || 0) + s.today.st.bets; f.data.accDay = s.day; }
    if (f.id === "amigo" && f.data.greeted && !f.data.paid && s.day === f.data.visit) payFriend(f);
    if (f.id === "amigo" && s.day >= f.data.visit && !f.data.greeted) finishFavour("fail", notes, f.data.spawned ? "nadie recibió al amigo en la puerta" : "el amigo no pudo entrar a jugar");
    else {
      if (d.close) d.close(f);
      if (d.ok(f)) finishFavour("ok", notes);
      else if (s.day >= f.deadline) finishFavour("fail", notes);
    }
  }
  m.prot = clamp(m.prot - MF.protDecay, 0, 100);
  if (s.day <= m.sabotage) notes.push(`El Faraón sigue a media luz tras el sabotaje (atractivo ×${MF.sabotaje.rivalMul}).`);
}
function favHtml() {
  const m = WS().mafia, f = m.fav, d = favDef(), s = S();
  const cur = f ? `<div class="note"><b>${esc(d.title)}</b> · ${esc(d.prog(f))} · vence al cierre del día ${f.deadline}${f.id === "paquete" ? `<div class="actions" style="margin-top:8px"><button class="ghost sm" data-wact="dump">Tirar el paquete (falla el favor)</button></div>` : ""}</div>` : `<p class="dim">${s.day < m.next ? `Don Aurelio volvería a pasar el día ${m.next} o después.` : "Don Aurelio puede pasar en cualquier momento del día."}</p>`;
  const hist = m.hist.slice().reverse().map(h => `<li>${h.res === "ok" ? "✓" : h.res === "fail" ? "✗" : "—"} Día ${h.day}: ${esc(FAV[h.id].title)}${h.res === "no" ? " (rechazado)" : ""}</li>`).join("");
  return `<div class="statgrid"><div class="stat"><b>${Math.round(m.prot)}</b><span>Protección (0-100)</span></div><div class="stat"><b>${pctTxt(thiefMul())}</b><span>Ladrones</span></div><div class="stat"><b>${pctTxt(fightMul())}</b><span>Peleas</span></div><div class="stat"><b>+${Math.round(m.prot / 100 * MF.bribeK * 100)}%</b><span>Coimas aceptadas</span></div></div>
    <p>Don Aurelio pide favores cada tantos días. Aceptarlos da plata y <b>Protección</b> (menos robos y peleas, inspectores más comprensivos), pero suben el calor y te atan a él. Rechazarlos lo ofende. La protección baja ${MF.protDecay} por día.${s.day <= m.thiefUntil ? ` <b>Está ofendido: más ladrones hasta el día ${m.thiefUntil}.</b>` : ""}</p>
    <h3>Favor en curso</h3>${cur}
    ${hist ? `<h3>Historial</h3><ul class="unlocks">${hist}</ul>` : ""}`;
}

// =====================================================================
// CLIENTES: efectos del clima y de los huéspedes
// =====================================================================
function onSpawn(c) {
  if (!ensure() || !c || c.thief || !c.type) return;
  const w = WXD();
  if (w.wantsDrink && w.wantsDrink.includes(c.type.id) && S().bar) c.wantsDrink = true;
  if (w.drinkBreak && c.shopPlan && c.shopPlan.breakAt < 0 && Math.random() < w.drinkBreak) c.shopPlan.breakAt = Math.max(1, Math.round(c.rounds * rnd(0.3, 0.6)));
}

// =====================================================================
// HUD: día de la semana, clima, protección y objetivos de favores/hotel
// =====================================================================
const css = document.createElement("style");
css.textContent = `#hWk { color: var(--ivory); font-weight: 600; } #hWx { font-size: .78rem; color: var(--ivory-dim); white-space: nowrap; }
#hWorld { display: grid; gap: 2px; font-size: .84rem; line-height: 1.25; color: var(--ivory); border-left: 2px solid #c9b26a; padding: 2px 0 2px 8px; }
#hWorld b { color: #f6c766; } #hWorld .p { color: var(--ivory-dim); font-family: var(--font-num); font-size: .76rem; } #hWorld .fav b { color: #efe8d8; }
.meter .bar i.prot { background: #8fa6d6; }
.wxday { display: grid; grid-template-columns: 92px 38px 1fr; gap: 8px; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(217,168,74,.18); }
.wxday .ic { font-size: 1.6rem; text-align: center; } .wxday b { color: var(--ivory); } .wxday span { color: var(--ivory-dim); font-size: .88rem; } .wxday.today { background: rgba(217,168,74,.08); }`;
document.head.appendChild(css);
const dayEl = document.getElementById("hDay");
const wkEl = document.createElement("span"); wkEl.id = "hWk";
const wxEl = document.createElement("span"); wxEl.id = "hWx";
if (dayEl && dayEl.parentElement) { dayEl.parentElement.insertAdjacentElement("afterend", wxEl); dayEl.insertAdjacentElement("afterend", wkEl); }
const protRow = document.createElement("div"); protRow.className = "meter"; protRow.id = "hProtRow"; protRow.hidden = true;
protRow.innerHTML = `<span>Protección</span><span class="bar"><i class="prot" id="hProt"></i></span><span class="v" id="hProtN">0</span>`;
{ const heat = document.getElementById("hHeat"); const row = heat && heat.closest(".meter"); if (row) row.insertAdjacentElement("afterend", protRow); }
const hudEl = document.createElement("div"); hudEl.id = "hWorld"; hudEl.hidden = true;
{ const xp = document.querySelector("#hud .meter.xp"); if (xp) xp.insertAdjacentElement("afterend", hudEl); }
let lastHud = "", hudT = 0;
function updateHud() {
  const s = S(), w = WX[wxToday()];
  const wk = ` · ${weekdayName(s.day)}`; if (wkEl.textContent !== wk) wkEl.textContent = wk;
  const wx = `${w.icon} ${w.name} · ${sky.phase}`; if (wxEl.textContent !== wx) { wxEl.textContent = wx; wxEl.title = `Clima de hoy: ${w.name}. Demanda ${pctTxt(demandMul())} (día y clima).`; }
  const m = WS().mafia, showProt = !!(Story() && Story().met && Story().met("aurelio")) || m.hist.length > 0;
  protRow.hidden = !showProt;
  if (showProt) { document.getElementById("hProt").style.width = m.prot + "%"; const n = String(Math.round(m.prot)); const el = document.getElementById("hProtN"); if (el.textContent !== n) el.textContent = n; }
  let html = "";
  const f = m.fav;
  if (f) { const d = FAV[f.id]; html += `<span class="fav"><b>✦</b> Favor: ${esc(d.title)} <span class="p">${esc(d.prog(f))} · vence día ${f.deadline}</span></span>`; }
  const h = WS().hotel;
  if (h.built) { const e = h.book.list.find(x => x.st === "waiting"); if (e && !h.recep) html += `<span><b>🛎</b> Huésped en la recepción del hotel <span class="p">${esc(e.name)} · ${H.rooms[e.room].name}</span></span>`; }
  if (html !== lastHud) { lastHud = html; hudEl.innerHTML = html; hudEl.hidden = !html; }
}

// pronóstico (compu de la oficina, shop.js)
function typeLine(id) {
  const t = WX[id].types || {}, parts = [];
  for (const ct of D.CUSTOMER_TYPES) if (t[ct.id] && t[ct.id] !== 1 && S().rank >= ct.rank) parts.push(`${ct.name} ${pctTxt(t[ct.id])}`);
  return parts.join(" · ");
}
const WX_TIP = {
  sunny: "Día normal. Buen día para cualquier cosa.",
  cloudy: "Los habitués vienen un poco más.",
  rain: "Vienen menos casuales; los que tienen auto (high rollers, VIP) vienen igual. Los huéspedes del hotel juegan más.",
  storm: "Poca gente y rayos: puede cortarse la luz. Tené un técnico o andá al tablero.",
  heat: "Todos quieren algo fresco: pedí bebidas y abrí la barra.",
};
function forecastHtml() {
  if (!ensure()) return "";
  const s = S(), rows = [];
  for (let i = 0; i < 6; i++) {
    const day = s.day + i, id = weatherFor(day), w = WX[id], dm = W.weekdayDemand[weekdayIdx(day)] * w.demand;
    rows.push(`<div class="wxday${i ? "" : " today"}"><div><b>${i ? "" : "Hoy · "}${esc(weekdayName(day))}</b><br><span>día ${day}${isWeekend(day) ? " · finde" : ""}</span></div><div class="ic" aria-hidden="true">${w.icon}</div><div><b>${esc(w.name)} · clientes ${pctTxt(dm)}</b><br><span>${esc(typeLine(id) || "Sin cambios por tipo de cliente.")} ${esc(WX_TIP[id])}${WS().hotel.built ? ` Hotel ${pctTxt((w.hotel || 1) * H.weekend[weekdayIdx(day)])}.` : ""}</span></div></div>`);
  }
  return `<p>Servicio Meteorológico del barrio. El clima y el día de la semana cambian cuánta gente viene y qué tipo de gente: el viernes y el sábado se llena, el lunes está tranquilo.</p>${rows.join("")}`;
}

// =====================================================================
// GESTIÓN, BOTONES Y TECLAS
// =====================================================================
function mgmtTabs() {
  if (!ensure()) return [];
  const out = [{ id: "hotel", name: "Hotel", title: "Hotel Dorado", html: hotelHtml }];
  const m = WS().mafia;
  if ((Story() && Story().met && Story().met("aurelio")) || m.hist.length || m.fav) out.push({ id: "favores", name: "Favores", title: "Favores de Don Aurelio", html: favHtml });
  return out;
}
document.getElementById("panelBody").addEventListener("click", e => {
  const b = e.target.closest("button[data-wact]"); if (!b || b.disabled || !ensure()) return;
  const a = b.dataset.wact, id = b.dataset.id, h = WS().hotel;
  if (a === "key") { chooseKey(+id); return; }
  if (a === "hlic") buyHotelLic();
  else if (a === "hbuild") buildHotelNow();
  else if (a === "room") buyRoom(id);
  else if (a === "maids") { h.maids = !h.maids; G.toast(h.maids ? "Mucamas contratadas: limpian cada noche." : "Suspendiste a las mucamas. Ojo con la limpieza.", h.maids ? "good" : "bad"); G.save(true); }
  else if (a === "recep") { h.recep = !h.recep; syncReceptionist(); G.toast(h.recep ? "Contrataste una recepcionista: registra sola a los huéspedes." : "Despediste a la recepcionista.", ""); G.save(true); }
  else if (a === "dump") { finishFavour("fail", null, "tiraste el paquete al río"); G.openMgmt("favores"); return; }
  G.openMgmt(a === "dump" ? "favores" : "hotel");
});
window.addEventListener("keydown", e => {
  if (G.ui.panel !== "checkin" || e.repeat) return;
  const m = /^(Digit|Numpad)([1-4])$/.exec(e.code); if (m) { e.preventDefault(); chooseKey(+m[2] - 1); }
});

// =====================================================================
// CICLO
// =====================================================================
let dayAnnounced = 0;
function resetRuntime() {
  for (const [, a] of arrivals) { G.scene.remove(a.group); if (a.proxy) G.dropProxy(a.proxy); }
  arrivals.clear(); offering = null; friend = null; ck = null; towerSig = ""; flash = flash2 = 0; dayAnnounced = 0;
  const w = S().world;
  showPackage(w.mafia.fav && w.mafia.fav.id === "paquete");
  showFuse(w.mafia.fav && w.mafia.fav.id === "sabotaje");
  if (w.mafia.fav && w.mafia.fav.id === "amigo" && w.mafia.fav.data.spawned && !w.mafia.fav.data.greeted) w.mafia.fav.data.spawned = false; // el amigo vuelve a llegar
  syncHotel();
  rainNow = ["rain", "storm"].includes(weatherFor(S().day)) ? (weatherFor(S().day) === "storm" ? 1 : 0.62) : 0; wet = rainNow > 0 ? 1 : 0;
  // las reservas que estaban esperando vuelven a la recepción
  if (w.hotel.built && w.hotel.book.day === S().day) for (const e of w.hotel.book.list) if (e.st === "waiting") spawnArrival(e, true);
}
function announce() {
  const s = S(); if (dayAnnounced === s.day || !G.started || s.dayOver) return;
  dayAnnounced = s.day;
  const w = WX[wxToday()], i = weekdayIdx(s.day);
  const wd = i === 0 ? "Lunes: día tranquilo, va a venir poca gente." : i === 4 ? "¡Viernes! Se viene una noche llena." : i === 5 ? "¡Sábado! La noche más fuerte de la semana." : `${weekdayName(s.day)}.`;
  const wxT = { sunny: "Día soleado.", cloudy: "Día nublado.", rain: "Llueve: vienen menos casuales.", storm: "Tormenta: poca gente y riesgo de apagón.", heat: "Ola de calor: todos van a querer tomar algo fresco." }[wxToday()];
  if (s.day > 1 || s.minutes > CFG.dayStart * 60 + 1) G.toast(`${wd} ${w.icon} ${wxT}`, i === 4 || i === 5 ? "good" : "");
}
function update(dt) {
  if (!ensure()) return;
  const s = S(); if (s.dayOver) return;
  thunderTick(dt);
  hotelTick(dt);
  mafiaTick();
  favTick(dt);
}
function frame(real) {
  if (!ensure()) return;
  updateRain(real); updateFlash(real); applySky(real); updateElevator(real);
  if (signApi && hotelGroup.visible) signApi.update(real);
  if (WS().hotel.built) drawTower();
  hudT -= real; if (hudT <= 0) { hudT = 0.25; updateHud(); announce(); }
}
function onEndDay(notes) {
  if (!ensure()) return;
  const s = S(), w = WX[wxToday()];
  notes.unshift(`${weekdayName(s.day)} · ${w.icon} ${w.name}: clientes ${pctTxt(demandMul())} por el día y el clima${flashCount ? ` · ${flashCount} rayos` : ""}.`);
  flashCount = 0;
  hotelEndDay(notes);
  mafiaEndDay(notes);
  const n = s.day + 1, nw = WX[weatherFor(n)];
  notes.push(`Pronóstico para mañana (${weekdayName(n)}): ${nw.icon} ${nw.name}.`);
}

window.CasinoWorld = {
  update, frame, onEndDay, onSpawn, demandMul, typeMul, crowdMul, catMul, outageMul, thiefMul, fightMul, rivalMul, rainLevel, mgmtTabs, forecastHtml,
  weekdayName, weatherFor,
  debug: {
    get state() { ensure(); return S().world; },
    get sky() { return Object.assign({}, sky, { rain: rainNow, rainVisible: rainA.visible, drawn: rainGeo.drawRange.count, wet, flash, fog: G.scene.fog ? { near: G.scene.fog.near, far: G.scene.fog.far, color: G.scene.fog.color.getHex() } : null }); },
    computeSky: (h, id) => { const r = computeSky(h, id || "sunny"); return { bg: cSky.getHex(), sun: cSun.getHex(), sunI: r.sunI, phase: r.phase }; },
    setWeather(id, day) { ensure(); if (!WX[id]) return false; S().world.force[day || S().day] = id; return true; },
    weekday: d => weekdayIdx(d == null ? S().day : d), weekdayName, weatherFor, demandMul, typeMul, crowdMul,
    strike, get flashes() { return flashCount; },
    hotel: {
      get arrivals() { return [...arrivals.values()].map(a => ({ id: a.e.id, mode: a.mode, x: a.x, z: a.z, st: a.e.st })); },
      plan: planBookings, buyLic: buyHotelLic, build: buildHotelNow, buyRoom, checkIn, openCheckin, chooseKey,
      get ck() { return ck ? { name: ck.e.name, room: ck.e.room, opts: ck.opts.map(o => ({ no: o.no, room: o.room, ok: !!o.ok })) } : null; },
      book(room, inMin) { ensure(); const h = S().world.hotel; if (h.book.day !== S().day) planBookings(); const e = { id: h.uid++, name: pick(NAMES), room: room || "standard", nights: 2, at: S().minutes + (inMin || 0), st: "pending", wait: 0 }; h.book.list.push(e); return e.id; },
      bookChance, freeRooms, DESK, ELEV,
      down(i) { const g = S().world.hotel.guests[i || 0]; if (g) { g.downDone = true; guestComesDown(g); } return !!g; },
    },
    mafia: {
      offer: offerFavour, accept: acceptFavour, refuse: refuseFavour, finish: finishFavour, get fav() { return curFav(); }, get offering() { return offering; },
      setProt(v) { ensure(); S().world.mafia.prot = clamp(v, 0, 100); }, FAV, get friend() { return friend; }, protCost, fuse, pkg,
    },
  },
};
})();
