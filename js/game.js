/* Casino Dorado v2 · game.js
 * Simulador de dueño de casino en primera persona (estilo Schedule I).
 * Requiere: three.js r128 (global THREE), data.js (window.CASINO_DATA), art.js (window.CasinoArt).
 * Secciones: DATOS · ESTADO · AVISOS Y SONIDO · ECONOMÍA · MUNDO 3D · NAVEGACIÓN · LUGARES ·
 * MÁQUINAS · MESAS · DECORACIÓN · PERSONAS · CLIENTES · PERSONAL · LADRONES E INSPECTOR ·
 * DÍA Y CIERRE · GUARDADO · JUGADOR · INTERFAZ · CONTROLES · BUCLE · INICIO.
 * Todos los números de balance viven en data.js; acá solo hay números de diseño de nivel y visuales.
 */
(() => {
"use strict";

// =====================================================================
// DATOS
// =====================================================================
const D = window.CASINO_DATA, A = window.CasinoArt;
if (!window.THREE || !D || !A) { document.body.insertAdjacentHTML("beforeend", '<p style="position:fixed;inset:auto 0 40% 0;text-align:center;color:#f3e9d2">No se pudo cargar el juego. Recargá la página.</p>'); return; }
const CFG = D.CFG, HEAT = D.HEAT, RIVAL = D.RIVAL;
const SAVE_KEY = "casino-dorado-partida-v2";
const HOUR = CFG.hourSec;                      // segundos de simulación por hora de juego
const MAX_ACTORS = 34;                         // tope de clientes vivos (rendimiento en teléfonos)
const GREET_SEC = HOUR * 0.6;                  // cuánto espera un VIP en la puerta a que lo recibas
const INSPECT_LOOK_SEC = 3;                    // segundos que el inspector mira cada máquina
const CASE_SEC = 2;                            // el ladrón "estudia" la máquina antes de robar (el "!" aparece acá)
const PLAYER_NOTICE_DIST = 5;                  // distancia a la que podés notar a un ladrón
const RANGE = 3.6;                             // alcance para usar cosas

const byKey = (list, key, v) => list.find(x => x[key] === v);
const MACH = id => byKey(D.MACHINES, "id", id);
const TDEF = id => byKey(D.TABLES, "id", id);
const SDEF = role => byKey(D.STAFF, "role", role);
const RTPD = id => byKey(D.RTP_SETTINGS, "id", id) || byKey(D.RTP_SETTINGS, "id", "estandar");
const DECO = id => byKey(D.DECOR, "id", id);
const LOAN = id => byKey(D.LOANS, "id", id);
const CTYPE = id => byKey(D.CUSTOMER_TYPES, "id", id);
const ZONE = id => byKey(D.ZONES, "id", id);
const BAR_DEF = D.DECOR.find(d => d.enables === "waiter");
const JACKPOT_DEF = D.MACHINES.find(m => m.jackpotSeed);

const fmt = n => (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("es-AR");
const fmtN = n => Math.round(n).toLocaleString("es-AR");
const pct = n => Math.round(n * 100) + "%";
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = arr => arr[(Math.random() * arr.length) | 0];
const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const escapeHtml = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const $ = id => document.getElementById(id);
const prizeOf = (def, rtp) => Math.max(1, Math.round(def.bet * rtp / def.win));
const isTouch = matchMedia("(pointer: coarse)").matches || ("ontouchstart" in window && navigator.maxTouchPoints > 0);
const KEY = isTouch ? "Usar" : "E";

const CAT_LABEL = Object.assign({}, D.CATS, {
  deposits: "Depósitos en la caja fuerte", sales: "Ventas (50%)", prizes: "Premios que pagó el banco", tables: "Mesas",
});

// =====================================================================
// ESTADO (S es solo datos: se guarda tal cual)
// =====================================================================
let S;
const diff = () => D.DIFFICULTY[S.difficulty] || D.DIFFICULTY.normal;
function freshState(diffId, modeId) {
  const mode = D.MODES && D.MODES[modeId] ? modeId : "historia"; // modos de juego (challenge.js)
  if (D.MODES && D.MODES[mode].diff) diffId = D.MODES[mode].diff;
  const dId = D.DIFFICULTY[diffId] ? diffId : "normal";
  const start = Math.round(CFG.startMoney * D.DIFFICULTY[dId].startMoney);
  return {
    v: 2, difficulty: dId, mode,
    bank: start, pocket: 0, xp: 0, rank: 1, rep: CFG.startRep, heat: 0,
    day: 1, minutes: (CFG.firstDayStart || CFG.dayStart) * 60, speed: 1, dayOver: false,
    negDays: 0, licenseDue: CFG.licenseEvery, licenseMissed: 0,
    closures: 0, closedDays: 0, closedToday: false,
    loyalty: { regular: 0, highroller: 0, vip: 0 },
    loan: null,
    zones: { principal: true, este: false, oeste: false },
    machines: CFG.startMachines.map((t, i) => ({ slot: START_SLOTS[i] || START_SLOTS[0], type: t, box: 0, rtp: "estandar", broken: false })),
    tables: [], decor: [], bar: false,
    staff: { tech: 0, sec: 0, cashier: 0, dealer: 0, waiter: 0, stock: 0 }, crew: [], // crew: ficha de cada empleado (staff.js)
    objectives: [], jackpotPool: JACKPOT_DEF ? JACKPOT_DEF.jackpotSeed : 0,
    rivalBought: false, victory: false, gameOver: null,
    hints: {}, totals: { served: 0, net: 0, days: 0 },
    today: newToday(1, start, CFG.startRep, 0),
  };
}
function newToday(day, start, rep, heat) {
  return {
    day, start, end: start, inc: {}, exp: {}, promo: false, inspected: false, xpAtStart: 0, heatStart: heat, repStart: rep,
    st: { boxesByHand: 0, served: 0, repairsByHand: 0, net: 0, bets: 0, prizes: 0, tablesNet: 0, handsByHand: 0, thefts: 0, stolen: 0,
      highrollers: 0, drinksByHand: 0, vipGreeted: 0, caught: 0, xp: 0, fines: 0, drinks: 0, visitors: 0,
      shopSales: 0, shopRev: 0, registerByHand: 0, restocked: 0, stockouts: 0, complaints: 0, exactChange: 0, lostSales: 0 },
    notes: [],
  };
}
const START_SLOTS = ["principal_3"]; // la Clásica usada arranca en la fila de adelante, a la derecha del pasillo central

// =====================================================================
// AVISOS Y SONIDO
// =====================================================================
const toastsEl = $("toasts");
// v2: con un diálogo de la historia abierto, los avisos esperan; los consejos (hint) salen de a uno y espaciados
const toastQ = [], hintQ = [];
let toastHold = () => false, toastGap = 0;
function toast(msg, kind) {
  if (toastHold()) { toastQ.push([msg, kind]); return; }
  showToast(msg, kind);
}
function flushToasts(dt) {
  toastGap -= dt;
  if (toastHold() || toastGap > 0) return;
  if (toastQ.length) { showToast(...toastQ.shift()); toastGap = CFG.toastGapSec; }
  else if (hintQ.length) { showToast(hintQ.shift()); toastGap = CFG.hintGapSec; }
}
function showToast(msg, kind) {
  const el = document.createElement("div");
  el.className = "toast" + (kind ? " " + kind : "");
  el.textContent = msg;
  toastsEl.appendChild(el);
  while (toastsEl.children.length > (window.innerWidth < 560 ? 2 : 4)) toastsEl.firstChild.remove();
  setTimeout(() => el.remove(), kind === "bad" ? 5500 : 4500);
}
function hint(id, msg) { // tutorial: cada consejo sale una sola vez por partida
  if (!S || S.hints[id]) return;
  S.hints[id] = 1; if (hintQ.length < 6) hintQ.push(msg);
}
let audio = null;
// sonido procedural (audio.js): si está cargado, cada evento va a window.casinoAudio; los beeps quedan de respaldo
function sfx(ev, x, z, o) { const E = window.casinoAudio; if (!E || !E.play) return false; try { E.play(ev, x, z, o); } catch (e) { /* sin sonido */ } return true; }
function beep(freq, dur, type, vol, delay) {
  if (!audio) return;
  try {
    const t0 = audio.currentTime + (delay || 0);
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type || "square"; o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.035, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(audio.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  } catch (e) { /* sin sonido */ }
}
const SFX = {
  coin() { if (sfx("coin")) return; beep(988, 0.08); beep(1319, 0.18, "square", 0.035, 0.08); },
  cash() { if (sfx("register")) return; beep(660, 0.06, "triangle", 0.05); beep(880, 0.06, "triangle", 0.05, 0.06); beep(1320, 0.14, "triangle", 0.05, 0.12); },
  bad() { if (sfx("error")) return; beep(220, 0.25, "sawtooth", 0.03); },
  alarm() { if (sfx("alarm")) return; beep(740, 0.15, "square", 0.03); beep(520, 0.2, "square", 0.03, 0.17); },
  rank() { if (sfx("rankup")) return; [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.22, "triangle", 0.05, i * 0.12)); },
  tick() { if (sfx("tick")) return; beep(1800, 0.03, "square", 0.015); },
};

// =====================================================================
// ECONOMÍA — nadie toca S.bank directamente
// =====================================================================
const Economy = {
  add(cat, n) { n = Math.round(n); if (!(n > 0)) return; S.bank += n; S.today.inc[cat] = (S.today.inc[cat] || 0) + n; },
  force(cat, n) { n = Math.round(n); if (!(n > 0)) return; S.bank -= n; S.today.exp[cat] = (S.today.exp[cat] || 0) + n; },
  trySpend(cat, n, quiet) {
    n = Math.round(n);
    if (S.bank < n) { if (!quiet) { toast(`No te alcanza: necesitás ${fmt(n)} en el banco y tenés ${fmt(S.bank)}.`, "bad"); SFX.bad(); } return false; }
    this.force(cat, n); return true;
  },
};
const Pocket = {
  cap() { let c = CFG.pocketCap; for (const r in CFG.pocketCapByRank) if (S.rank >= +r) c = Math.max(c, CFG.pocketCapByRank[r]); return c; },
  room() { return Math.max(0, this.cap() - S.pocket); },
  deposit() { const n = Math.round(S.pocket); S.pocket = 0; if (n > 0) Economy.add("deposits", n); return n; },
};
function netToday() { const st = S.today.st; return st.bets - st.prizes + st.tablesNet; }
function addNet() { S.today.st.net = netToday(); }

const Rep = {
  change(d) { S.rep = clamp(S.rep + d, 0, 100); },
  label() { const r = S.rep; return r >= 80 ? "Excelente" : r >= 60 ? "Buena" : r >= 40 ? "Normal" : r >= 20 ? "Mala" : "Pésima"; },
};

// rangos y XP ---------------------------------------------------------
const pendingRanks = [];
const Rank = {
  def(l) { return D.RANKS[clamp(l, 1, D.RANKS.length) - 1]; },
  next() { return D.RANKS[S.rank] || null; },
  fromXp(xp) { let r = 1; for (const k of D.RANKS) if (xp >= k.xp) r = k.lvl; return r; },
  add(n, quiet) {
    n = Math.round(n); if (!(n > 0)) return;
    S.xp += n; S.today.st.xp += n;
    if (!quiet) floatXp(n);
    const r = this.fromXp(S.xp);
    while (S.rank < r) { S.rank++; pendingRanks.push(S.rank); }
  },
  maxGames() { return this.def(S.rank).maxGames; },
};
// cuántos de un rol podés tener con tu rango
function staffMax(def) {
  let m = 0; for (const r in def.maxByRank) if (S.rank >= +r) m = Math.max(m, def.maxByRank[r]);
  if (m > 0 && def.role === "dealer") { let nt = 0; for (const d of S.tables) { const td = TDEF(d.type); if (td && !td.noDealer) nt++; } m = Math.max(m, nt); } // un croupier por mesa: el cupo nunca queda debajo de tus mesas
  return m > 0 ? m + UPV("staffMaxAdd", 0) : m;
}
function gamesCount() { return S.machines.length + S.tables.length; }
// mejoras compradas (upgrades.js): las claves "...Mul" multiplican, el resto suma
const UPV = (k, d) => window.CasinoUp ? window.CasinoUp.v(k, d) : d;
const capOf = def => Math.round(def.cap * UPV("capMul", 1));

// calor --------------------------------------------------------------
const Heat = {
  add(d, why) {
    if (!d) return;
    if (d > 0) d *= diff().heat;
    S.heat = clamp(S.heat + d, 0, HEAT.max);
    if (S.heat >= HEAT.closureAt) closure(why);
  },
  label() { const h = S.heat; return h >= 75 ? "Al rojo" : h >= 50 ? "Alto" : h >= 25 ? "Tibio" : "Frío"; },
};

// atractivo y rival -----------------------------------------------------
function appealOfMachine(d) { const def = MACH(d.type); return def.appeal * RTPD(d.rtp).appealMul * UPV("machineAppealMul", 1); }
function appealSum() {
  let a = 0;
  for (const d of S.machines) a += appealOfMachine(d);
  for (const t of S.tables) a += TDEF(t.type).appeal;
  return a;
}
function decorAtr() {
  let a = 0;
  for (const d of S.decor) { const def = DECO(d.id); if (def) a += def.atr; }
  if (S.bar && BAR_DEF) a += BAR_DEF.atr;
  a += window.CasinoStory?.atr?.() || 0; // trofeos de la historia (story.js)
  if (window.CasinoBuild) a += window.CasinoBuild.extraAtr(); // v3: alfombras y paredes
  a += UPV("atrAdd", 0); // mejoras (upgrades.js)
  return a;
}
function attractiveness() { return Math.max(0, decorAtr() + CFG.atrPerAppeal * appealSum() + CFG.atrPerRep * S.rep - (window.CasinoLife ? window.CasinoLife.atrPenalty() : 0) - (window.CasinoCombat ? window.CasinoCombat.atrPenalty() : 0)); } // life.js: manchas en el piso
function rivalOpen() { return !S.rivalBought && S.day >= RIVAL.opensDay; }
function rivalAtr() {
  if (!rivalOpen()) return 0;
  const weeks = (S.day - RIVAL.opensDay) / 7;
  return (RIVAL.startAtr + RIVAL.growthPerWeek * weeks * diff().rivalGrowth) * UPV("rivalMul", 1) * (window.CasinoWorld ? window.CasinoWorld.rivalMul() : 1); // world.js: sabotaje
}
function rivalMul() {
  if (!rivalOpen()) return 1;
  const a = Math.max(1, attractiveness()), r = rivalAtr();
  return RIVAL.mulBase + RIVAL.mulK * a / (a + r);
}
function buyoutPrice() { return Math.round(RIVAL.buyoutBase + RIVAL.buyoutPerAtr * rivalAtr()); }
function isPromoDay(day) { return !S.rivalBought && day > RIVAL.opensDay && (day - RIVAL.opensDay) % RIVAL.promoEvery === 0; }
function wagesTotal() { let w = 0; for (const s of D.STAFF) w += window.CasinoStaff ? window.CasinoStaff.roleWages(s) : s.wage * (S.staff[s.role] || 0); return Math.round(w * diff().wages * UPV("wageMul", 1) * (window.CasinoOwner ? window.CasinoOwner.wageMul() : 1)); } // imagen del dueño (owner.js)
function utilitiesTotal() { return S.machines.length * CFG.utilityPerMachine + S.tables.length * CFG.utilityPerTable; }
function licenseFee() { return Math.round((CFG.licenseBase + CFG.licensePerGame * gamesCount()) * UPV("licenseFeeMul", 1)); }

// =====================================================================
// MUNDO 3D
// =====================================================================
const canvas = $("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch && (!window.CasinoPerf || window.CasinoPerf.antialias), powerPreference: "high-performance" });
// color: tono fílmico (ACES) para lo iluminado; carteles, pantallas, neones e íconos (materiales sin luz) quedan fuera
// del tono para que brillen más que el resto (falso "bloom" sin posproceso)
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.22;
const _untoned = new WeakSet();
function untone(root) {
  root.traverse(o => {
    const ms = o.material; if (!ms) return;
    for (const m of Array.isArray(ms) ? ms : [ms]) if (!_untoned.has(m)) { _untoned.add(m); if ((m.isMeshBasicMaterial || m.isSpriteMaterial || m.isLineBasicMaterial) && m.toneMapped) { m.toneMapped = false; m.needsUpdate = true; } }
  });
}
// Calidad gráfica: lo que más pesa es la cantidad de píxeles (pantallas de alta densidad),
// así que "auto" baja o sube la resolución interna según los FPS reales.
const GFX_KEY = "casino-dorado-graficos-v1";
const GFX_MODES = { auto: "Automática", alta: "Alta", media: "Media", baja: "Baja" };
let gfxLights = []; // luces decorativas que se apagan en calidad baja (cartel de la fachada)
const gfx = { mode: "auto", fps: false, bob: true, scale: 1, avg: 1 / 60, t: 0, good: 0, shown: 0, frames: 0, acc: 0 };
try { const g = JSON.parse(localStorage.getItem(GFX_KEY) || "{}"); if (GFX_MODES[g.mode]) gfx.mode = g.mode; gfx.fps = !!g.fps; if (g.bob === false) gfx.bob = false; } catch (e) {}
const DPR = window.devicePixelRatio || 1;
function gfxMax() { return gfx.mode === "alta" ? Math.min(DPR, 2) : gfx.mode === "media" ? Math.min(DPR, 1) : gfx.mode === "baja" ? Math.min(DPR, 1) * 0.7 : Math.min(DPR, isTouch ? 1.5 : 1.75); }
function gfxApply() {
  const pr = gfx.mode === "auto" ? Math.max(0.55, gfxMax() * gfx.scale) : gfxMax();
  if (Math.abs(renderer.getPixelRatio() - pr) > 0.01) renderer.setPixelRatio(pr);
  for (const l of gfxLights) l.visible = gfx.mode !== "baja";
  if (A.setLowFx) A.setLowFx(gfx.mode === "baja"); // halos y brillos falsos (art.js)
}
function gfxSave() { try { localStorage.setItem(GFX_KEY, JSON.stringify({ mode: gfx.mode, fps: gfx.fps, bob: gfx.bob })); } catch (e) {} }
function gfxSet(mode) {
  if (!GFX_MODES[mode]) return; gfx.mode = mode; gfx.scale = 1; gfx.good = 0; gfx.t = 0; gfxSave(); gfxApply();
  // perf.js elige el material y el suavizado de bordes al cargar: si cambian, se guarda y se recarga la página
  const P = window.CasinoPerf;
  if (P && ((mode !== "alta") !== P.fast || (mode !== "baja") !== P.antialias)) { toast("Aplicando los gráficos nuevos…"); if (started && !S.gameOver) save(true); setTimeout(() => location.reload(), 350); }
}
// cada cuadro: promedio móvil del tiempo de cuadro; en "auto" ajusta la escala cada ~2 s
function gfxFrame(raw) {
  if (raw <= 0 || raw > 0.5) return;
  gfx.avg += (raw - gfx.avg) * 0.05; gfx.frames++; gfx.acc += raw;
  if (gfx.fps && gfx.acc >= 0.5) { fpsEl.textContent = `${Math.round(gfx.frames / gfx.acc)} FPS · ${renderer.getPixelRatio().toFixed(2)}x`; gfx.frames = 0; gfx.acc = 0; }
  else if (!gfx.fps && gfx.acc >= 0.5) { gfx.frames = 0; gfx.acc = 0; }
  if (gfx.mode !== "auto" || document.hidden) return;
  gfx.t += raw; if (gfx.t < 2) return; gfx.t = 0;
  const fps = 1 / gfx.avg;
  if (fps < 48 && gfxMax() * gfx.scale > 0.56) { gfx.scale = Math.max(0.55 / gfxMax(), gfx.scale * (fps < 32 ? 0.75 : 0.87)); gfx.good = 0; gfxApply(); }
  else if (fps > 58 && gfx.scale < 1) { if (++gfx.good >= 3) { gfx.scale = Math.min(1, gfx.scale * 1.1); gfx.good = 0; gfxApply(); } }
  else gfx.good = 0;
}
const fpsEl = document.createElement("div"); fpsEl.id = "fpsMeter"; fpsEl.hidden = !gfx.fps;
fpsEl.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);top:max(6px,env(safe-area-inset-top,0px));z-index:40;font:600 12px var(--font-num,monospace);color:#e9dcb8;background:rgba(7,20,15,.75);border:1px solid #6b5a2e;border-radius:4px;padding:2px 8px;pointer-events:none";
document.body.appendChild(fpsEl);
gfxApply();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1424);
scene.fog = new THREE.Fog(0x0a1424, 32, 75);
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 200);
camera.rotation.order = "YXZ";
scene.add(camera);
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);

// luces (cantidad fija: nunca se agregan luces en tiempo de juego)
scene.add(new THREE.HemisphereLight(0xfff1d6, 0x2a1a10, 0.6));
for (const x of [-16, -5.5, 5.5, 16]) { const l = new THREE.PointLight(0xffd9a0, 0.95, 24, 1.5); l.position.set(x, 3.1, 1); scene.add(l); }
const moon = new THREE.DirectionalLight(0x8fa6d6, 0.35); moon.position.set(-10, 20, -15); scene.add(moon);
const hemi = scene.children.find(o => o.isHemisphereLight); // world.js: ciclo de día y noche

const animated = []; // apis con update(dt) visuales (facade, arañas, ruleta, máquinas)
const WM = A.makeWallMaterials();
const _wallMats = new Map();
function repMat(base, rx, ry) {
  const key = base.uuid + "|" + rx + "|" + ry;
  if (_wallMats.has(key)) return _wallMats.get(key);
  const m = base.clone();
  if (base.map) { m.map = base.map.clone(); m.map.needsUpdate = true; m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping; m.map.repeat.set(rx, ry); }
  _wallMats.set(key, m); return m;
}
const M = {
  grass: new THREE.MeshStandardMaterial({ color: 0x1d3a22, roughness: 1 }),
  road: new THREE.MeshStandardMaterial({ color: 0x222428, roughness: 1 }),
  walk: new THREE.MeshStandardMaterial({ color: 0x4a4744, roughness: 0.95 }),
  lane: new THREE.MeshBasicMaterial({ color: 0xc9b26a }),
  hidden: new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
};

// colisiones (cajas alineadas a los ejes) ---------------------------------
const colliders = []; // { minX, maxX, minZ, maxZ, on(), kind }
let navDirty = true;
function addCollider(minX, maxX, minZ, maxZ, kind, on) {
  const c = { minX, maxX, minZ, maxZ, kind: kind || "static", on: on || (() => true) };
  colliders.push(c); navDirty = true; return c;
}
function removeCollider(c) { const i = colliders.indexOf(c); if (i >= 0) { colliders.splice(i, 1); navDirty = true; } }
function boxAt(x, z, w, d, kind, on) { return addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2, kind, on); }

const SEG = n => (window.CasinoPerf ? window.CasinoPerf.segs(n) : 1); // perf.js: con materiales rápidos, superficies grandes con más vértices
function box(w, h, d, mat, x, y, z, solid) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d, SEG(w), SEG(h), SEG(d)), mat); m.position.set(x, y, z); scene.add(m);
  if (solid) boxAt(x, z, w, d, "wall");
  return m;
}
const WALL_H = 3.5, WALL_T = 0.3;
function wall(x, z, len, alongX, outerFace) {
  const w = alongX ? len : WALL_T, d = alongX ? WALL_T : len;
  const inner = repMat(WM.wall, len / 2, 1);
  let mat = inner;
  if (outerFace != null) { mat = [inner, inner, inner, inner, inner, inner]; mat[outerFace] = repMat(WM.exterior, len / 3, 1); }
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_H, d, SEG(w), SEG(WALL_H), SEG(d)), mat); m.position.set(x, WALL_H / 2, z); scene.add(m);
  boxAt(x, z, w, d, "wall");
  const wain = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : WALL_T + 0.04, 0.9, alongX ? WALL_T + 0.04 : len, alongX ? SEG(len) : 1, 1, alongX ? 1 : SEG(len)), repMat(WM.wainscot, len / 2, 1));
  wain.position.set(x, 0.45, z); scene.add(wain);
  return m;
}

// terreno, calle y edificio (salón x[-10,10], alas x[-22,-10] y x[10,22], z[-10,10])
box(110, 0.1, 90, M.grass, 0, -0.06, -10, false);
box(110, 0.02, 7, M.road, 0, -0.005, -20.5, false);
for (let x = -50; x <= 50; x += 4) box(2, 0.022, 0.15, M.lane, x, 0.001, -20.5, false);
box(110, 0.04, 6.4, M.walk, 0, 0.0, -13.6, false);
box(110, 0.04, 4, M.walk, 0, 0.0, -26, false);
const carpetTex = A.makeCarpetTexture({ repeat: [22, 10] });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(44, 20, SEG(44), SEG(20)), new THREE.MeshStandardMaterial({ map: carpetTex, roughness: 0.95 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = 0.002; scene.add(floor);
const ceil = new THREE.Mesh(new THREE.PlaneGeometry(44, 20, SEG(44), SEG(20)), repMat(WM.ceiling, 11, 5)); ceil.rotation.x = Math.PI / 2; ceil.position.y = WALL_H; scene.add(ceil);
wall(0, 10, 44.3, true, 4);
wall(-12.5, -10, 19, true, 5); wall(12.5, -10, 19, true, 5);
wall(-22, 0, 20, false, 1); wall(22, 0, 20, false, 0);
const facade = A.makeFacade({ width: 14 }); facade.rotation.y = Math.PI; facade.position.set(0, 0, -10.16); scene.add(facade); animated.push(facade.api); gfxLights = (facade.api && facade.api.lights) || []; gfxApply();
for (const [x, z] of [[0, 2.5], [-6, -4], [6, -4], [16, -3], [-16.5, -3]]) {
  const ch = A.makeChandelier({ light: false }); ch.position.set(x, WALL_H, z); scene.add(ch); if (ch.api) animated.push(ch.api);
}
// neones: tubo corrido bajo el cielorraso (ámbar en el salón, celeste en el ala este, violeta en el salón VIP) y carteles
if (A.makeCoveLights) {
  const IN = 9.85, OUT = 21.85, AMB = 0xffa04a, CYA = 0x40c8ff, VIO = 0xc050ff;
  scene.add(A.makeCoveLights([
    { x0: -10, z0: IN, x1: 10, z1: IN, nx: 0, nz: -1, color: AMB }, { x0: -10, z0: -IN, x1: -3, z1: -IN, nx: 0, nz: 1, color: AMB }, { x0: 3, z0: -IN, x1: 10, z1: -IN, nx: 0, nz: 1, color: AMB },
    { x0: 10, z0: IN, x1: OUT, z1: IN, nx: 0, nz: -1, color: CYA }, { x0: 10, z0: -IN, x1: OUT, z1: -IN, nx: 0, nz: 1, color: CYA }, { x0: OUT, z0: -IN, x1: OUT, z1: IN, nx: -1, nz: 0, color: CYA },
    { x0: -OUT, z0: IN, x1: -10, z1: IN, nx: 0, nz: -1, color: VIO }, { x0: -OUT, z0: -IN, x1: -10, z1: -IN, nx: 0, nz: 1, color: VIO }, { x0: -OUT, z0: -IN, x1: -OUT, z1: IN, nx: 1, nz: 0, color: VIO },
  ]));
  for (const n of [
    { text: "JACKPOT", color: 0xff3fa4, color2: 0xffd45a, icons: ["star"], w: 3.4, h: 0.9, x: 0, y: 2.72, z: IN - 0.02, ry: Math.PI },
    { text: "7 7 7", color: 0xff5a3a, color2: 0xffd45a, icons: ["cherry"], w: 2.1, h: 0.72, x: -6.2, y: 2.68, z: IN - 0.02, ry: Math.PI },
    { text: "Suerte", color: 0x4fe0ff, color2: 0xff6ab0, icons: ["diamond", "heart"], w: 2.3, h: 0.74, x: 6.2, y: 2.68, z: IN - 0.02, ry: Math.PI },
    { text: "7 7 7", color: 0x40c8ff, color2: 0xffd45a, icons: ["star"], w: 2.4, h: 0.8, x: 16, y: 2.7, z: IN - 0.02, ry: Math.PI },
    { text: "Póker", color: 0x4cff9a, color2: 0xff4f6a, icons: ["heart", "diamond"], w: 2.4, h: 0.8, x: OUT - 0.02, y: 2.6, z: -3.5, ry: -Math.PI / 2 },
    { text: "Salón VIP", color: 0xc84cff, color2: 0xffd45a, icons: ["diamond"], w: 3.0, h: 0.85, x: -16.5, y: 2.7, z: IN - 0.02, ry: Math.PI },
    { text: "Blackjack", color: 0xffc24a, color2: 0xff4f6a, icons: ["heart"], w: 2.8, h: 0.8, x: -OUT + 0.02, y: 2.6, z: -3, ry: Math.PI / 2 },
  ]) { const s = A.makeNeonSign(n); s.position.set(n.x, n.y, n.z); s.rotation.y = n.ry; scene.add(s); animated.push(s.api); }
}

// el casino rival (El Faraón), enfrente ------------------------------------
const rival = (() => {
  const g = new THREE.Group(); g.position.set(0, 0, -33); scene.add(g);
  const body = new THREE.Mesh(new THREE.BoxGeometry(26, 9, 12), new THREE.MeshStandardMaterial({ color: 0x1b2030, roughness: 0.8 }));
  body.position.set(0, 4.5, 0); g.add(body);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(26.4, 0.3, 12.4), new THREE.MeshStandardMaterial({ color: 0x3a6fd6, emissive: 0x0a1a40, roughness: 0.4 }));
  trim.position.set(0, 9, 0); g.add(trim);
  const doorMat = new THREE.MeshBasicMaterial({ color: 0x0b1530 });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.2), doorMat); door.position.set(0, 1.6, 6.02); g.add(door);
  const winMat = new THREE.MeshBasicMaterial({ color: 0x1a2a50 });
  for (const x of [-9, -5, 5, 9]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.8), winMat); w.position.set(x, 2.4, 6.02); g.add(w); }
  const c = document.createElement("canvas"); c.width = 1024; c.height = 256;
  const tex = new THREE.CanvasTexture(c);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshBasicMaterial({ map: tex })); sign.position.set(0, 6.4, 6.05); g.add(sign);
  let mode = "";
  function draw(m) {
    if (m === mode) return; mode = m;
    const x = c.getContext("2d"), w = c.width, h = c.height;
    x.fillStyle = "#070b16"; x.fillRect(0, 0, w, h);
    x.textAlign = "center"; x.textBaseline = "middle";
    if (m === "soon") {
      x.strokeStyle = "#3a3f4a"; x.lineWidth = 8; x.strokeRect(12, 12, w - 24, h - 24);
      x.fillStyle = "#8a8f9a"; x.font = "bold 70px Arial, sans-serif"; x.fillText("PRÓXIMAMENTE", w / 2, h / 2 - 34);
      x.font = "bold 46px Georgia, serif"; x.fillStyle = "#5f6b85"; x.fillText("EL FARAÓN · CASINO", w / 2, h / 2 + 46);
      doorMat.color.setHex(0x0b0f18); winMat.color.setHex(0x10141c);
    } else if (m === "open") {
      x.shadowColor = "#4fc3ff"; x.shadowBlur = 34; x.strokeStyle = "#4fc3ff"; x.lineWidth = 9; x.strokeRect(16, 16, w - 32, h - 32);
      x.fillStyle = "#bfe9ff"; x.font = "bold 150px Georgia, serif"; x.fillText("EL FARAÓN", w / 2, h / 2 + 8);
      doorMat.color.setHex(0x2a5fd0); winMat.color.setHex(0x3a6fd6);
    } else {
      x.shadowColor = "#ffb84a"; x.shadowBlur = 30; x.strokeStyle = "#d9a84a"; x.lineWidth = 9; x.strokeRect(16, 16, w - 32, h - 32);
      x.fillStyle = "#f6c766"; x.font = "bold 120px Georgia, serif"; x.fillText("DORADO II", w / 2, h / 2 + 8);
      doorMat.color.setHex(0x8a6a2c); winMat.color.setHex(0x6a4a24);
    }
    tex.needsUpdate = true;
  }
  return { update() { draw(S.rivalBought ? "ours" : rivalOpen() ? "open" : "soon"); } };
})();

// =====================================================================
// NAVEGACIÓN — grilla de puntos + Dijkstra + "string pulling"
// =====================================================================
const NAV_M = 0.3;          // margen de paso alrededor de obstáculos
let navNodes = [];          // { x, z, nb: [{ i, d }] }
function contains(c, x, z, m) { return x > c.minX - m && x < c.maxX + m && z > c.minZ - m && z < c.maxZ + m; }
function segHits(ax, az, bx, bz, c, m) {
  const minX = c.minX - m, maxX = c.maxX + m, minZ = c.minZ - m, maxZ = c.maxZ + m;
  let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az;
  if (Math.abs(dx) < 1e-9) { if (ax <= minX || ax >= maxX) return false; }
  else { let ta = (minX - ax) / dx, tb = (maxX - ax) / dx; if (ta > tb) { const t = ta; ta = tb; tb = t; } if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 >= t1) return false; }
  if (Math.abs(dz) < 1e-9) { if (az <= minZ || az >= maxZ) return false; }
  else { let ta = (minZ - az) / dz, tb = (maxZ - az) / dz; if (ta > tb) { const t = ta; ta = tb; tb = t; } if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 >= t1) return false; }
  return true;
}
function los(ax, az, bx, bz, ign) {
  for (const c of colliders) { if ((ign && ign.has(c)) || !c.on()) continue; if (segHits(ax, az, bx, bz, c, NAV_M)) return false; }
  return true;
}
function containing(x, z) { const s = new Set(); for (const c of colliders) if (c.on() && contains(c, x, z, NAV_M + 0.05)) s.add(c); return s; }
function buildNav() {
  navDirty = false;
  const pts = [];
  for (let x = -21; x <= 21.01; x += 1.5) for (let z = -9; z <= 9.01; z += 1.5) pts.push({ x, z });
  for (const z of [-11.6, -13.6, -15.6]) for (let x = -12; x <= 12; x += 2) pts.push({ x, z, out: true });
  navNodes = [];
  for (const p of pts) {
    let free = true;
    for (const c of colliders) if (c.on() && contains(c, p.x, p.z, NAV_M + 0.05)) { free = false; break; }
    if (free) navNodes.push({ x: p.x, z: p.z, out: !!p.out, nb: [] });
  }
  for (let i = 0; i < navNodes.length; i++) for (let j = i + 1; j < navNodes.length; j++) {
    const a = navNodes[i], b = navNodes[j], d = dist2(a.x, a.z, b.x, b.z);
    if (d > ((a.out || b.out) ? 2.95 : 2.15)) continue;
    if (!los(a.x, a.z, b.x, b.z)) continue;
    a.nb.push({ i: j, d }); b.nb.push({ i, d });
  }
}
function visibleNodes(x, z, ign) {
  const c = [];
  for (let i = 0; i < navNodes.length; i++) { const n = navNodes[i], d = dist2(x, z, n.x, n.z); if (d < 5) c.push({ i, d }); }
  c.sort((a, b) => a.d - b.d);
  const out = [];
  for (const k of c) { if (out.length >= 5) break; const n = navNodes[k.i]; if (los(x, z, n.x, n.z, ign)) out.push(k); }
  if (!out.length && c.length) out.push(c[0]);
  return out;
}
function findPath(ax, az, bx, bz) {
  { const B = window.CasinoBuild, p = B ? B.findPath(ax, az, bx, bz) : null; if (p) return p; } // v3: A* en grilla (decor.js)
  if (navDirty) buildNav();
  const ignA = containing(ax, az), ignB = containing(bx, bz), ign = new Set([...ignA, ...ignB]);
  if (los(ax, az, bx, bz, ign)) return [{ x: bx, z: bz }];
  const starts = visibleNodes(ax, az, ign), goals = visibleNodes(bx, bz, ign);
  if (!starts.length || !goals.length) return [{ x: bx, z: bz }];
  const n = navNodes.length, g = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
  const goalCost = new Map(); for (const k of goals) goalCost.set(k.i, k.d);
  const heap = [];
  const push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  for (const k of starts) { g[k.i] = k.d; push(k.i, k.d + dist2(navNodes[k.i].x, navNodes[k.i].z, bx, bz)); }
  let best = -1, bestCost = Infinity;
  while (heap.length) {
    const [, i] = pop(); if (done[i]) continue; done[i] = 1;
    if (g[i] >= bestCost) break;
    if (goalCost.has(i)) { const c = g[i] + goalCost.get(i); if (c < bestCost) { bestCost = c; best = i; } }
    for (const e of navNodes[i].nb) {
      const ng = g[i] + e.d;
      if (ng < g[e.i]) { g[e.i] = ng; prev[e.i] = i; push(e.i, ng + dist2(navNodes[e.i].x, navNodes[e.i].z, bx, bz)); }
    }
  }
  if (best < 0) return [{ x: bx, z: bz }];
  const chain = []; for (let i = best; i >= 0; i = prev[i]) chain.unshift({ x: navNodes[i].x, z: navNodes[i].z });
  const pts = [{ x: ax, z: az }, ...chain, { x: bx, z: bz }], out = [];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !los(pts[i].x, pts[i].z, pts[j].x, pts[j].z, ign)) j--;
    out.push(pts[j]); i = j;
  }
  return out;
}

// =====================================================================
// LUGARES — cuadros dorados para máquinas, mesas, decoración y la barra
// =====================================================================
const pickables = []; // mallas invisibles que recibe el rayo de "usar"
const proxyGeo = new Map();
function proxy(parent, w, h, d, interact, y, x, z) {
  const key = w + "|" + h + "|" + d;
  if (!proxyGeo.has(key)) proxyGeo.set(key, new THREE.BoxGeometry(w, h, d));
  const m = new THREE.Mesh(proxyGeo.get(key), M.hidden);
  m.position.set(x || 0, y == null ? h / 2 : y, z || 0);
  m.userData.interact = interact; parent.add(m); pickables.push(m);
  return m;
}
function dropProxy(m) { const i = pickables.indexOf(m); if (i >= 0) pickables.splice(i, 1); if (m.parent) m.parent.remove(m); }

function dashTex(w, h, round) {
  return A.canvasTex(w, h, (g) => {
    g.strokeStyle = "#d9a84a"; g.lineWidth = 8; g.setLineDash([18, 10]);
    if (round) { g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 8, 0, Math.PI * 2); g.stroke(); }
    else g.strokeRect(8, 8, w - 16, h - 16);
    g.setLineDash([]); g.fillStyle = "#d9a84a";
    const s = Math.min(w, h);
    g.fillRect(w / 2 - 5, h / 2 - s * 0.24, 10, s * 0.48); g.fillRect(w / 2 - s * 0.24, h / 2 - 5, s * 0.48, 10);
  });
}
const markerMat = new THREE.MeshBasicMaterial({ map: dashTex(128, 128), transparent: true, opacity: 0.9, depthWrite: false });
const markerWideMat = new THREE.MeshBasicMaterial({ map: dashTex(256, 160), transparent: true, opacity: 0.9, depthWrite: false });
const markerRoundMat = new THREE.MeshBasicMaterial({ map: dashTex(128, 128, true), transparent: true, opacity: 0.9, depthWrite: false });
const ghostMat = new THREE.MeshBasicMaterial({ color: 0xd9a84a, transparent: true, opacity: 0.07, depthWrite: false });
const ghostEdgeMat = new THREE.LineBasicMaterial({ color: 0xd9a84a, transparent: true, opacity: 0.5 });
const dealerPadMat = new THREE.MeshBasicMaterial({ color: 0xd9a84a, transparent: true, opacity: 0.35, depthWrite: false });
const ghostCache = new Map();
function ghost(w, h, d) {
  const key = w + "|" + h + "|" + d;
  if (!ghostCache.has(key)) { const g = new THREE.BoxGeometry(w, h, d); ghostCache.set(key, [g, new THREE.EdgesGeometry(g)]); }
  const [geo, edges] = ghostCache.get(key), grp = new THREE.Group();
  const m = new THREE.Mesh(geo, ghostMat); m.position.y = h / 2; grp.add(m);
  const e = new THREE.LineSegments(edges, ghostEdgeMat); e.position.y = h / 2; grp.add(e);
  return grp;
}
function pad(mat, w, d) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); p.rotation.x = -Math.PI / 2; p.position.y = 0.025; return p; }

const zoneOpen = id => !!S.zones[id];
const slots = [], tableSpots = [], decorSpots = [];
const spotById = {};
function addMachineSlot(id, x, z, zone) {
  const marker = new THREE.Group(); marker.position.set(x, 0, z); scene.add(marker);
  marker.add(pad(markerMat, 1.1, 1.1)); marker.add(ghost(0.9, 2.0, 0.7));
  const s = { id, kind: "slot", x, z, zone, marker, machine: null, play: { x, z: z - 0.85 } };
  proxy(marker, 1.0, 2.0, 0.9, {
    prompt: () => ({ text: "Lugar libre para una tragamonedas", sub: `Juegos instalados ${gamesCount()}/${Rank.maxGames()}` }),
    hold: () => 0, use: () => openSlotShop(s),
  });
  slots.push(s); spotById[id] = s; return s;
}
function addTableSpot(id, x, z, zone) {
  const marker = new THREE.Group(); marker.position.set(x, 0, z); scene.add(marker);
  marker.add(pad(markerWideMat, 2.8, 1.75)); marker.add(ghost(2.6, 0.9, 1.4));
  const s = { id, kind: "tspot", x, z, zone, rot: Math.PI, marker, table: null };
  proxy(marker, 2.6, 1.0, 1.5, {
    prompt: () => ({ text: "Lugar para una mesa de juego", sub: "Blackjack, ruleta o póker" }),
    hold: () => 0, use: () => openTableShop(s),
  });
  tableSpots.push(s); spotById[id] = s; return s;
}
function addDecorSpot(id, x, z, zone) {
  const marker = new THREE.Group(); marker.position.set(x, 0, z); scene.add(marker);
  marker.add(pad(markerRoundMat, 0.9, 0.9)); marker.add(ghost(0.6, 1.3, 0.6));
  const s = { id, kind: "dspot", x, z, zone, marker, decor: null };
  proxy(marker, 0.8, 1.4, 0.8, { prompt: () => ({ text: "Lugar para decoración", sub: `Atractivo del casino ${Math.round(attractiveness())}` }), hold: () => 0, use: () => openDecorShop(s) });
  decorSpots.push(s); spotById[id] = s; return s;
}
{ // salón principal: fila de adelante (z=2) = principal_0..5, fila del fondo (z=7) = principal_6..11
  let n = 0;
  for (const z of [2, 7]) for (const x of [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5]) addMachineSlot("principal_" + n++, x, z, "principal");
  n = 0; for (const z of [7, 2]) for (const x of [13, 16, 19]) addMachineSlot("este_" + n++, x, z, "este");
  n = 0; for (const x of [-13, -15.5, -18, -20.5]) addMachineSlot("oeste_" + n++, x, 7, "oeste");
  addTableSpot("principal_t0", -6, -4, "principal"); addTableSpot("principal_t1", 6, -4, "principal");
  addTableSpot("este_t0", 16, -4, "este");
  addTableSpot("oeste_t0", -14, -3, "oeste"); addTableSpot("oeste_t1", -19, -3, "oeste");
  [[-9.2, 4.5], [9.2, 4.5], [-9.3, 0.0], [9.3, 0.0]].forEach((p, i) => addDecorSpot("principal_d" + i, p[0], p[1], "principal"));
  [[12, -8.9], [20.9, -8.9], [20.9, 4.5]].forEach((p, i) => addDecorSpot("este_d" + i, p[0], p[1], "este"));
  [[-12, -8.9], [-20.9, -8.9], [-20.9, 3.2]].forEach((p, i) => addDecorSpot("oeste_d" + i, p[0], p[1], "oeste"));
}

// caja fuerte (ventanilla de la entrada) ---------------------------------
const SAFE = { x: -8.55, z: -8.3, win: { x: -8.55, z: -7.25 }, idle: { x: -6.6, z: -8.9 } };
{
  const cage = A.makeCashierCage({ width: 2.6 }); cage.position.set(SAFE.x, 0, SAFE.z); scene.add(cage);
  addCollider(SAFE.x - 1.38, SAFE.x + 1.38, -9.9, SAFE.z + 0.4, "cage");
  proxy(cage, 1.4, 2.2, 1.0, {
    prompt: () => S.pocket > 0
      ? { text: `Depositar ${fmt(S.pocket)} en la caja fuerte`, sub: "Mantené para depositar · Opciones: banco y préstamos" }
      : { text: "Caja fuerte", sub: `Bolsillo vacío · Banco ${fmt(S.bank)}` },
    hold: () => S.pocket > 0 ? CFG.playerDepositSec : 0,
    usable: () => S.pocket > 0,
    use: () => { if (S.pocket > 0) { const n = Pocket.deposit(); sfx("deposit", SAFE.win.x, SAFE.win.z) || SFX.cash(); window.CasinoJuice?.onDeposit(SAFE.win.x, SAFE.win.z, n); floatText(SAFE.win.x, 2.0, SAFE.win.z, "+" + fmt(n), "#6fd39b"); toast(`Depositaste ${fmt(n)}. Banco: ${fmt(S.bank)}.`, "good"); updateHud(true); save(true); } },
    options: () => openMgmt("bank"), optLabel: "Banco",
  }, 1.4, 0, 0.35);
}

// la barra (se compra en su lugar fijo) -------------------------------------
const BAR = { x: 8.3, z: -8.35, pickup: { x: 7.6, z: -7.2 }, idle: { x: 6.2, z: -7.4 } };
const barSpot = (() => {
  const marker = new THREE.Group(); marker.position.set(BAR.x, 0, BAR.z); scene.add(marker);
  marker.add(pad(markerWideMat, 3.2, 1.1)); marker.add(ghost(3.0, 1.1, 0.8));
  const s = { id: "bar", kind: "bar", marker, group: null, colliders: [] };
  proxy(marker, 3.0, 1.2, 1.0, {
    prompt: () => window.CasinoShop ? window.CasinoShop.barPrompt() : ({ text: `Lugar para la ${BAR_DEF.name}`, sub: `${fmt(BAR_DEF.price)} · rango ${BAR_DEF.rank} · habilita al camarero` }),
    hold: () => 0, shopAccept: b => b.k === "barra", use: () => window.CasinoShop ? window.CasinoShop.barUse() : openBarShop(),
  }); // con la tienda (shop.js) la barra llega en una caja desde la compu
  return s;
})();
function placeBar(on) {
  if (barSpot.group) { scene.remove(barSpot.group); barSpot.group.traverse(o => { if (pickables.includes(o)) dropProxy(o); }); barSpot.group = null; }
  for (const c of barSpot.colliders) removeCollider(c);
  barSpot.colliders = [];
  barSpot.marker.visible = !on;
  if (!on) return;
  const g = A.makeBar({ width: 3, stools: 3 }); g.position.set(BAR.x, 0, BAR.z); scene.add(g); barSpot.group = g;
  barSpot.colliders.push(addCollider(BAR.x - 1.56, BAR.x + 1.56, BAR.z - 0.4, BAR.z + 0.45, "bar"));
  barSpot.colliders.push(addCollider(BAR.x - 1.56, BAR.x + 1.56, -9.9, BAR.z - 1.05, "bar"));
  proxy(g, 3.0, 1.2, 0.9, {
    prompt: () => player.drink ? { text: "Ya llevás un trago", sub: "Buscá a un cliente con el ícono de copa" } : { text: "Tomar un trago de la barra", sub: "Llevalo a un high roller o VIP que lo pida" },
    hold: () => 0, usable: () => !player.drink,
    use: () => { if (!player.drink) { player.drink = true; sfx("drink", BAR.pickup.x, BAR.pickup.z) || SFX.tick(); toast("Agarraste un trago. Buscá a quien lo pida (ícono de copa).", ""); } },
  }, 0.6, 0, 0.2);
}

// paredes de ampliación con cartel "SE VENDE" --------------------------------
const zoneWalls = {};
for (const zone of D.ZONES) {
  if (!zone.side) continue;
  const wx = zone.side * 10;
  const tex = A.canvasTex(1688, 300, (g, w, h) => {
    g.fillStyle = "#2a2f33"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#3a4045"; g.lineWidth = 3; for (let x = 0; x < w; x += 60) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    const bw = 340, bx = (w - bw) / 2;
    g.fillStyle = "#f3e9d2"; g.fillRect(bx, 60, bw, 170);
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "#d4423f"; g.font = "bold 46px Georgia, serif"; g.fillText("SE VENDE", w / 2, 98);
    g.fillStyle = "#07140f"; g.font = "bold 26px Arial, sans-serif"; g.fillText(zone.name, w / 2, 140);
    g.font = "bold 34px monospace"; g.fillText(fmt(zone.price), w / 2, 180);
    g.font = "bold 20px Arial, sans-serif"; g.fillStyle = "#8a6a2c"; g.fillText("Rango " + zone.rank, w / 2, 212);
  });
  const plain = new THREE.MeshStandardMaterial({ color: 0x2a2f33 }), signed = new THREE.MeshStandardMaterial({ map: tex });
  const faceMats = zone.side > 0 ? [plain, signed, plain, plain, plain, plain] : [signed, plain, plain, plain, plain, plain];
  const m = new THREE.Mesh(new THREE.BoxGeometry(WALL_T, WALL_H, 19.7, 1, SEG(WALL_H), SEG(19.7)), faceMats); m.position.set(wx, WALL_H / 2, 0); scene.add(m);
  addCollider(wx - WALL_T / 2, wx + WALL_T / 2, -9.85, 9.85, "zonewall", () => !S.zones[zone.id]);
  proxy(m, 0.6, WALL_H, 19.7, { prompt: () => ({ text: `Ampliar: ${zone.name} (${fmt(zone.price)})`, sub: S.rank < zone.rank ? `Necesitás rango ${zone.rank}` : `${zone.slots} lugares para máquinas, ${zone.tableSpots} para mesas` }), hold: () => 0, use: () => openZonePanel(zone) }, 0, 0, 0).position.y = 0;
  zoneWalls[zone.id] = m;
}
function applyZones() {
  for (const id in zoneWalls) zoneWalls[id].visible = !S.zones[id];
  for (const s of slots) s.marker.visible = zoneOpen(s.zone) && !s.machine;
  for (const s of tableSpots) s.marker.visible = zoneOpen(s.zone) && !s.table;
  for (const s of decorSpots) s.marker.visible = zoneOpen(s.zone) && !s.decor;
  navDirty = true;
}

// =====================================================================
// MÁQUINAS
// =====================================================================
const SYMBOLS = ["7", "★", "♦", "♣", "BAR"];
const machines = []; // runtime: { d, def, slot, group, api, user, fill, collider, claimTech, claimCash, pending, fullDrawn }
const fillGeo = new THREE.PlaneGeometry(1, 1); fillGeo.translate(0.5, 0, 0);
const fillBgGeo = new THREE.PlaneGeometry(0.72, 0.075);
const FILL = { bg: new THREE.MeshBasicMaterial({ color: 0x0b0906 }), g: new THREE.MeshBasicMaterial({ color: 0x49c46f }), y: new THREE.MeshBasicMaterial({ color: 0xf0c24a }), r: new THREE.MeshBasicMaterial({ color: 0xff4d47 }) };
const randSyms = () => [0, 1, 2].map(() => pick(SYMBOLS));
const boxFrac = m => clamp(m.d.box / capOf(m.def), 0, 1);
const isFull = m => m.d.box >= capOf(m.def);

function spawnMachine(d) {
  const def = MACH(d.type), slot = spotById[d.slot];
  const g = A.makeSlotMachine({ color: def.color, name: def.name, model: def.id, stool: true });
  g.position.set(slot.x, 0, slot.z); g.rotation.y = slot.rot != null ? slot.rot : Math.PI; scene.add(g);
  const bg = new THREE.Mesh(fillBgGeo, FILL.bg); bg.position.set(0, 1.79, 0.236); g.add(bg);
  const fill = new THREE.Mesh(fillGeo, FILL.g); fill.position.set(-0.33, 1.79, 0.238); fill.scale.set(0.001, 0.045, 1); g.add(fill);
  const m = { d, def, slot, group: g, api: g.api, user: null, fill, claimTech: null, claimCash: null, pending: null, fullDrawn: false };
  m.collider = boxAt(slot.x, slot.z, slot.cw || 0.92, slot.cd || 0.72, "machine");
  m.interact = machineInteract(m);
  proxy(g, 0.95, 2.3, 0.8, m.interact, 1.15);
  slot.machine = m; slot.marker.visible = false;
  if (d.broken) m.api.setBroken(true);
  machines.push(m); updateFill(m);
  return m;
}
function despawnMachine(m) {
  if (m.user) leaveCustomer(m.user);
  scene.remove(m.group);
  m.group.traverse(o => { if (o.userData.interact) dropProxy(o); });
  removeCollider(m.collider);
  m.slot.machine = null; m.slot.marker.visible = zoneOpen(m.slot.zone);
  const i = machines.indexOf(m); if (i >= 0) machines.splice(i, 1);
  m.dead = true;
}
function machineInteract(m) {
  return {
    prompt() {
      const d = m.d, def = m.def, set = RTPD(d.rtp);
      const jp = def.jackpotSeed ? ` · Pozo ${fmt(S.jackpotPool)}` : "";
      if (d.broken) return { text: `Reparar ${def.name} (repuesto ${fmt(def.repair)})`, sub: (m.claimTech ? "El técnico viene en camino · " : "") + (window.CasinoMG ? "Reparación a mano en 3 pasos" : "Mantené para reparar") };
      if (d.box > 0 && Pocket.room() <= 0) return { text: `Bolsillo lleno (${fmt(S.pocket)})`, sub: "Depositá en la caja fuerte de la entrada" };
      if (d.box > 0) return { text: `Vaciar caja: ${fmt(d.box)} de ${fmt(capOf(def))}`, sub: `${isFull(m) ? "CAJA LLENA · " : ""}Mantené para vaciar · pago ${set.name}${jp}` };
      return { text: `${def.name} · caja vacía`, sub: `${m.user ? "En uso" : "Libre"} · pago ${set.name} (${pct(set.rtp)})${jp}` };
    },
    hold: () => m.d.broken ? (window.CasinoMG ? 0 : CFG.playerRepairSec) : (m.d.box > 0 && Pocket.room() > 0 ? CFG.playerCollectSec : 0),
    usable: () => m.d.broken ? S.bank >= m.def.repair : (m.d.box > 0 && Pocket.room() > 0),
    use() { if (m.dead) return; if (m.d.broken) { if (!(window.CasinoMG && window.CasinoMG.openRepair(m))) repairMachine(m, true); } else collectByPlayer(m); },
    options: () => openMachinePanel(m), optLabel: "Ajustes",
  };
}
function updateFill(m) {
  const f = boxFrac(m);
  m.fill.scale.x = Math.max(0.001, 0.66 * f);
  m.fill.material = f >= 1 ? FILL.r : f >= 0.7 ? FILL.y : FILL.g;
  if (f >= 0.7 && !m.d.broken) hint("box70", `La caja de la ${m.def.name} está al ${Math.round(f * 100)}%. Mirala y mantené ${KEY} para vaciarla en tu bolsillo.`);
}
function drawFull(m) {
  if (m.api.cancelSpin) m.api.cancelSpin(); // que los rodillos no tapen el cartel
  const tex = m.api.screen.material.map, g = tex.userData.ctx, w = 256, h = 160;
  g.fillStyle = "#f0c24a"; g.fillRect(0, 0, w, h);
  g.fillStyle = "#1a1206"; g.fillRect(8, 8, w - 16, h - 16);
  g.fillStyle = "#f0c24a"; g.fillRect(14, 14, w - 28, h - 28);
  g.fillStyle = "#1a1206"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = "bold 40px Arial, sans-serif"; g.fillText("CAJA", w / 2, 58); g.fillText("LLENA", w / 2, 100);
  g.font = "bold 14px Arial, sans-serif"; g.fillText("NO ACEPTA APUESTAS", w / 2, 134);
  tex.needsUpdate = true; m.fullDrawn = true;
}
function refreshScreen(m) {
  if (m.d.broken) return;
  if (isFull(m)) { if (!m.fullDrawn) drawFull(m); }
  else if (m.fullDrawn) { m.fullDrawn = false; m.api.setReels(randSyms(), false); }
}
// un giro; devuelve el premio, o -1 si la caja está llena
function machineSpin(m, c) {
  const d = m.d, def = m.def, set = RTPD(d.rtp), st = S.today.st;
  if (isFull(m)) return -1;
  const bet = def.bet;
  c.budget -= bet; st.bets += bet;
  let prize = 0, jackpot = 0;
  const won = Math.random() < def.win;
  if (won) prize = prizeOf(def, set.rtp);
  if (def.jackpotSeed) {
    S.jackpotPool += bet * def.jackpotShare;
    if (Math.random() < def.jackpotOdds) { jackpot = Math.round(S.jackpotPool); S.jackpotPool = def.jackpotSeed; }
  }
  d.box += bet - prize;
  if (d.box < 0) { Economy.force("prizes", -d.box); d.box = 0; }
  if (jackpot) {
    Economy.force("prizes", jackpot); prize += jackpot;
    toast(`¡MEGA JACKPOT! Un cliente se llevó ${fmt(jackpot)} del pozo. Sale del banco.`, "bad");
    window.CasinoChallenge?.ev?.("jackpot", jackpot); // logros (challenge.js)
    if (c.person) c.person.api.cheer(3);
  }
  st.prizes += prize; addNet();
  c.budget += prize;
  if (window.CasinoLife) window.CasinoLife.onSpin(m, c, prize, jackpot); // reacciones (life.js)
  const syms = won || jackpot ? (() => { const s = jackpot ? "7" : pick(SYMBOLS); return [s, s, s]; })() : (() => { const s = randSyms(); if (s[0] === s[1] && s[1] === s[2]) s[2] = s[2] === "7" ? "★" : "7"; return s; })();
  m.api.pull(); m.pending = { t: 0.55, syms, win: !!(won || jackpot), jp: jackpot > 0, big: prize >= def.bet * 5, prize }; sfx("spin", m.slot.x, m.slot.z);
  if (c.person && c.person.api.gesture) c.person.api.gesture(Math.random() < 0.4 ? "lever" : "press"); // palanca o botón
  if (won && c.person && Math.random() < 0.35) c.person.api.cheer(1.2);
  const brk = def.brk * (S.staff.tech > 0 ? SDEF("tech").brkMul : 1) * UPV("brkMul", 1);
  if (Math.random() < brk) breakMachine(m);
  updateFill(m);
  return prize;
}
function breakMachine(m) {
  if (m.d.broken) return;
  m.d.broken = true; m.pending = null; m.fullDrawn = false; m.api.setBroken(true);
  if (m.user) { m.user.flags.broken = true; leaveCustomer(m.user); }
  sfx("break", m.slot.x, m.slot.z) || SFX.bad();
  toast(`Se rompió una ${m.def.name}.${S.staff.tech ? " El técnico va para allá." : ""}`, "bad");
  hint("firstBreak", `Mirá la máquina rota y ${KEY} para repararla a mano (pagás el repuesto). Un técnico lo hace gratis.`);
}
function repairMachine(m, byPlayer) {
  if (!m.d.broken || m.dead) return;
  if (byPlayer) {
    if (!Economy.trySpend("repairs", m.def.repair)) return;
    S.today.st.repairsByHand++; Rank.add(D.XP.repair); checkObjectives();
    toast(`Reparaste la ${m.def.name}.`, "good");
  }
  m.d.broken = false; m.api.setBroken(false); m.fullDrawn = false; refreshScreen(m); sfx("repair", m.slot.x, m.slot.z);
  m.claimTech = null;
  if (window.CasinoCombat) window.CasinoCombat.onRepair(m); // se limpia el daño por golpes (combat.js)
}
function collectByPlayer(m) {
  const room = Pocket.room();
  if (room <= 0) { toast("Tenés el bolsillo lleno. Depositá en la caja fuerte de la entrada.", "bad"); return; }
  const before = m.d.box, amt = Math.min(before, room);
  if (amt <= 0) return;
  m.d.box -= amt; S.pocket += amt;
  if (m.d.box <= 0 || amt >= capOf(m.def) * 0.2) { S.today.st.boxesByHand++; Rank.add(D.XP.collectBox); checkObjectives(); }
  sfx("collect", m.slot.x, m.slot.z) || SFX.coin(); floatText(m.slot.x, 2.1, m.slot.z - 0.4, "+" + fmt(amt), "#6fd39b");
  window.CasinoJuice?.onCollect(m, amt); // lluvia de monedas (juice.js)
  updateFill(m); refreshScreen(m);
  if (m.d.box > 0) toast(`Te entraron ${fmt(amt)}: el bolsillo se llenó. Quedan ${fmt(m.d.box)} en la caja.`, "bad");
  if (S.pocket >= Pocket.cap() * 0.8) hint("pocket", `Bolsillo casi lleno (${fmt(S.pocket)}/${fmt(Pocket.cap())}). Andá a la caja fuerte de la entrada y mantené ${KEY} para depositar.`);
}
function buyMachine(def, slot) {
  if (slot.machine || !zoneOpen(slot.zone)) return false;
  if (S.rank < def.rank) { toast(`Necesitás rango ${def.rank}.`, "bad"); return false; }
  if (gamesCount() >= Rank.maxGames()) { toast(`Tu rango permite ${Rank.maxGames()} juegos. Subí de rango para instalar más.`, "bad"); return false; }
  if (!Economy.trySpend("purchases", def.price)) return false;
  const d = { slot: slot.id, type: def.id, box: 0, rtp: "estandar", broken: false };
  S.machines.push(d); spawnMachine(d);
  Rank.add(D.XP.buyGame); sfx("register") || SFX.coin();
  toast(`Compraste una ${def.name}.`, "good");
  unstickPlayer(slot.x, slot.z - 1.5); save(true); return true;
}
function sellMachine(m) {
  const refund = Math.round(m.def.price * CFG.sellRefund), box = Math.round(m.d.box);
  Economy.add("sales", refund); if (box > 0) Economy.add("deposits", box);
  S.machines.splice(S.machines.indexOf(m.d), 1);
  despawnMachine(m); save(true);
  toast(`Vendiste la ${m.def.name} por ${fmt(refund)}${box > 0 ? ` y retiraste ${fmt(box)} de la caja` : ""}.`, "good");
}
function updateMachines(dt) {
  for (const m of machines) {
    if (m.pending) { m.pending.t -= dt; if (m.pending.t <= 0) { const p = m.pending; m.pending = null; if (!m.d.broken) { m.api.setReels(p.syms, p.win); sfx(p.jp ? "jackpot" : p.big ? "bigwin" : p.win ? "win" : "stop", m.slot.x, m.slot.z); if (p.big || p.jp) window.CasinoJuice?.onWin(m, p.prize, p.jp); } } }
    if (!m.d.broken && isFull(m) && !m.fullDrawn && !m.pending) drawFull(m);
  }
}

// =====================================================================
// MESAS
// =====================================================================
const tables = []; // runtime: { d, def, spot, group, api, seats, dealerSpot, playerSpot, staff, playerDealing, timer, collider, pad }
function rotXZ(lx, lz, rot) { const c = Math.cos(rot), s = Math.sin(rot); return { x: c * lx + s * lz, z: -s * lx + c * lz }; }
function spotOff(s, dx, dz) { const p = rotXZ(dx, dz, (s.rot != null ? s.rot : Math.PI) - Math.PI); return { x: s.x + p.x, z: s.z + p.z }; } // v3: desfase según el giro de la máquina
// v3.2: el modelo de la mesa de póker vive en art.js (paño ovalado, cartas comunitarias y pozo animables)
function makePokerTable(color) { return A.makePokerTable({ color, stools: true }); }
const TABLE_LAYOUT = {
  blackjack: g => ({ seats: [0, 1, 3, 4].map(i => g.api.seats[i]), sit: 0.72, dealer: { x: 0, z: -0.45 }, player: { x: 0, z: -0.62 }, box: [-1.2, 1.2, -0.15, 1.2], center: { x: 0, z: 0.4 } }),
  ruleta: () => ({ seats: [-1.25, -0.75, -0.25, 0.25, 0.75, 1.25].map(x => ({ x, z: 1.02, rotY: Math.PI })), sit: 0, dealer: { x: -0.95, z: -1.0 }, player: { x: -0.95, z: -1.13 }, box: [-1.47, 1.47, -0.72, 0.72], center: { x: -0.5, z: 0 } }),
  poker: g => ({ seats: g.api.seats, sit: 0.72, dealer: { x: 0, z: -1.0 }, player: { x: 0, z: -1.22 }, box: [-1.4, 1.4, -0.82, 0.82], center: { x: 0, z: 0 } }),
  // juegos nuevos (los modelos y las reglas viven en games.js; acá solo la huella, que el modo construir necesita al cargar)
  dados: () => ({ seats: [-1.25, -0.75, -0.25, 0.25, 0.75, 1.25].map(x => ({ x, z: 1.02, rotY: Math.PI })), sit: 0, dealer: { x: 0, z: -1.0 }, player: { x: 0, z: -1.12 }, box: [-1.6, 1.6, -0.75, 0.75], center: { x: 0, z: 0 } }),
  bingo: () => ({ seats: [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ x: -1.75 + i * 0.5, z: 0.66, rotY: Math.PI })), sit: 0.5, dealer: { x: 2.3, z: -0.75 }, player: { x: 2.35, z: -0.75 }, box: [-2.0, 1.95, -1.65, 0.32], center: { x: 1.3, z: -0.55 } }),
  carreras: () => ({ seats: [-0.9, -0.3, 0.3, 0.9].map(x => ({ x, z: 0.72, rotY: Math.PI })), sit: 0, dealer: { x: 1.95, z: 0.1 }, player: { x: 0, z: 1.0 }, box: [-1.6, 1.6, -0.62, 0.3], center: { x: 0, z: -0.2 } }),
};
const GAMES_X = () => window.CasinoGames || null; // games.js (dados, bingo, carreras): se carga después de game.js
function spawnTable(d) {
  const def = TDEF(d.type), spot = spotById[d.spot];
  const g = def.custom ? (GAMES_X() ? GAMES_X().makeModel(d.type) : new THREE.Group()) : d.type === "blackjack" ? A.makeBlackjackTable({ stools: true }) : d.type === "ruleta" ? A.makeRouletteTable() : makePokerTable(def.color);
  g.position.set(spot.x, 0, spot.z); g.rotation.y = spot.rot; scene.add(g);
  const L = TABLE_LAYOUT[d.type](g), W = (lx, lz) => { const p = rotXZ(lx, lz, spot.rot); return { x: spot.x + p.x, z: spot.z + p.z }; };
  const t = { d, def, spot, group: g, api: g.api, staff: null, playerDealing: false, timer: def.round, sit: L.sit, playerDealT: 0 };
  t.seats = L.seats.slice(0, def.seats).map(s => { const p = W(s.x, s.z); return { x: p.x, z: p.z, rot: (s.rotY || 0) + spot.rot, c: null }; });
  t.dealerSpot = W(L.dealer.x, L.dealer.z); t.dealerRot = spot.rot; t.playerSpot = W(L.player.x, L.player.z); t.center = W(L.center.x, L.center.z);
  const c1 = W(L.box[0], L.box[2]), c2 = W(L.box[1], L.box[3]);
  t.collider = addCollider(Math.min(c1.x, c2.x), Math.max(c1.x, c2.x), Math.min(c1.z, c2.z), Math.max(c1.z, c2.z), "table");
  t.pad = pad(dealerPadMat, 0.8, 0.8); t.pad.position.set(t.playerSpot.x, 0.03, t.playerSpot.z); scene.add(t.pad);
  t.interact = tableInteract(t);
  if (def.custom && GAMES_X()) t.interact = GAMES_X().interact(t, t.interact); // games.js: carteles y uso propios
  proxy(g, L.box[1] - L.box[0], 1.2, L.box[3] - L.box[2], t.interact, 0.6, (L.box[0] + L.box[1]) / 2, (L.box[2] + L.box[3]) / 2);
  spot.table = t; spot.marker.visible = false;
  if (g.api && g.api.update) t.anim = g.api;
  tables.push(t);
  return t;
}
function despawnTable(t) {
  for (const s of t.seats) if (s.c) leaveCustomer(s.c);
  if (t.staff) { t.staff.table = null; t.staff.state = "idle"; t.staff = null; }
  for (const n of staffNpcs) if (n.table === t) { n.table = null; n.state = "idle"; }
  scene.remove(t.group); scene.remove(t.pad);
  t.group.traverse(o => { if (o.userData.interact) dropProxy(o); });
  removeCollider(t.collider);
  if (t.extraCols) for (const c of t.extraCols) removeCollider(c);
  t.spot.table = null; t.spot.marker.visible = zoneOpen(t.spot.zone);
  const i = tables.indexOf(t); if (i >= 0) tables.splice(i, 1);
  t.dead = true;
}
const dealerHere = t => (t.staff && t.staff.state === "deal") || t.playerDealing || !!t.def.noDealer; // carreras: corren solas
function tableInteract(t) {
  return {
    prompt() {
      const tray = `Bandeja de hoy ${fmt(t.d.tray)}`, seated = t.seats.filter(s => s.c).length;
      if (t.staff) return { text: `${t.def.name} · atiende el croupier`, sub: `${tray} · ${seated}/${t.seats.length} jugadores` };
      if (t.playerDealing) return { text: `Estás repartiendo en la ${t.def.name}`, sub: `${tray} · alejate para dejar la mesa` };
      return { text: `Repartir en la ${t.def.name}`, sub: `${tray} · te parás en el cuadro dorado del croupier` };
    },
    hold: () => 0,
    usable: () => !t.staff && !t.playerDealing,
    use() {
      if (t.staff || t.dead) return;
      player.x = t.playerSpot.x; player.z = t.playerSpot.z;
      player.yaw = Math.atan2(-(t.center.x - player.x), -(t.center.z - player.z)); player.pitch = -0.35;
      if (!(window.CasinoMG && window.CasinoMG.handles(t))) hint("deal", `Mientras estés en el cuadro dorado, la mesa juega y ganás 1 XP por mano. Si te vas, los jugadores esperan ${CFG.patienceSec} s y se levantan.`);
    },
    options: () => openTablePanel(t), optLabel: "Mesa",
  };
}
function updateTables(dt) {
  for (const t of tables) {
    if (t.anim) t.anim.update(dt);
    const seated = t.seats.filter(s => s.c && s.c.state === "play");
    if (!dealerHere(t)) {
      for (const s of seated) { s.c.waitT += dt; if (s.c.waitT > CFG.patienceSec) { s.c.flags.waited = true; leaveCustomer(s.c); } }
      continue;
    }
    for (const s of seated) s.c.waitT = 0;
    if (t.playerDealing && window.CasinoMG && window.CasinoMG.tableTick(t, seated, dt)) continue; // minijuego de croupier (minigames.js)
    if (!seated.length) { t.timer = Math.min(t.timer, t.def.round * 0.5); continue; }
    t.timer -= dt; if (t.timer > 0) continue;
    t.timer = t.def.round;
    playRound(t, seated);
  }
}
function playRound(t, seated) {
  const def = t.def, st = S.today.st;
  let delta = 0;
  if (def.custom) { if (GAMES_X()) GAMES_X().autoRound(t, seated); return; } // dados, bingo y carreras llevan su propia cuenta (games.js)
  if (def.id === "poker" && window.CasinoPoker) { // póker: los clientes juegan entre ellos y la casa cobra la comisión (poker.js)
    delta = window.CasinoPoker.autoHand(t, seated);
    if (delta == null) return; // falta un segundo jugador
  } else for (const s of seated) {
    const c = s.c, lo = Math.max(def.minBet, c.betMin), hi = Math.min(def.maxBet, c.betMax, c.budget);
    if (hi < lo || c.rounds <= 0) { leaveCustomer(c); continue; }
    const bet = Math.round(rnd(lo, hi) / 5) * 5 || lo;
    c.played = true;
    if (def.noVariance) { const fee = Math.max(1, Math.round(bet * def.edge)); c.budget -= fee; delta += fee; if (Math.random() < 0.45) c.flags.won = true; }
    else if (Math.random() < 0.5 - def.edge / 2) { c.budget += bet; delta -= bet; c.flags.won = true; if (Math.random() < 0.3 && c.person) c.person.api.cheer(1); if (window.CasinoLife) window.CasinoLife.onBet(c, true); }
    else { c.budget -= bet; delta += bet; if (window.CasinoLife) window.CasinoLife.onBet(c, false); }
    c.rounds--;
  }
  t.d.tray += delta; st.tablesNet += delta; addNet();
  if (t.api && t.api.spin && !t.api.spinning) t.api.spin();
  sfx("round", t.center.x, t.center.z, { type: t.d.type });
  if (near(t.spot.x, t.spot.z, 14) && delta) floatText(t.center.x, 1.7, t.center.z, (delta >= 0 ? "Casa +" : "Casa ") + fmt(delta), delta >= 0 ? "#6fd39b" : "#ff6a5a");
  if (t.playerDealing) { st.handsByHand++; Rank.add(D.XP.dealHand, true); checkObjectives(); }
  for (const s of seated) if (s.c && s.c.rounds <= 0) leaveCustomer(s.c);
}
function buyTable(def, spot) {
  if (spot.table || !zoneOpen(spot.zone)) return false;
  if (S.rank < def.rank) { toast(`Necesitás rango ${def.rank}.`, "bad"); return false; }
  if (gamesCount() >= Rank.maxGames()) { toast(`Tu rango permite ${Rank.maxGames()} juegos.`, "bad"); return false; }
  if (!Economy.trySpend("purchases", def.price)) return false;
  const d = { spot: spot.id, type: def.id, tray: 0 };
  S.tables.push(d); const t = spawnTable(d);
  Rank.add(D.XP.buyGame); sfx("register") || SFX.coin();
  toast(`Instalaste una ${def.name}. ${S.staff.dealer ? "" : "Necesita croupier: contratalo o parate vos en el cuadro dorado."}`, "good");
  assignDealers(); unstickPlayer(t.playerSpot.x, t.playerSpot.z); save(true); return true;
}
function sellTable(t) {
  const refund = Math.round(t.def.price * CFG.sellRefund);
  settleTray(t);
  Economy.add("sales", refund);
  S.tables.splice(S.tables.indexOf(t.d), 1);
  despawnTable(t); assignDealers(); save(true);
  toast(`Vendiste la ${t.def.name} por ${fmt(refund)}.`, "good");
}
function settleTray(t) {
  const n = Math.round(t.d.tray); t.d.tray = 0;
  const cat = t.def.cat || "tables"; // juegos nuevos: su propia línea en el reporte
  if (n > 0) Economy.add(cat, n); else if (n < 0) Economy.force(cat, -n);
  return n;
}

// =====================================================================
// DECORACIÓN
// =====================================================================
const decorObjs = []; // { d, def, spot, group, collider }
const rugTex = A.canvasTex(256, 160, (g, w, h) => {
  g.fillStyle = "#7a1424"; g.fillRect(0, 0, w, h);
  g.strokeStyle = "#d9a84a"; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
  g.lineWidth = 2; g.strokeRect(22, 22, w - 44, h - 44);
  g.fillStyle = "rgba(217,168,74,.5)"; g.beginPath(); g.ellipse(w / 2, h / 2, 40, 26, 0, 0, Math.PI * 2); g.fill();
});
function makeDecor(id) {
  const g = new THREE.Group(), brass = A.materials.brass, marble = A.materials.marble;
  if (id === "deco_planta") g.add(A.makePlant({ kind: "palm", scale: 1.15 }));
  else if (id === "deco_lampara") {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.06, 16), brass); base.position.y = 0.03; g.add(base);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 8), brass); pole.position.y = 0.85; g.add(pole);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 0.36, 16, 1, true), A.basic(0xffd27a)); shade.position.y = 1.72; g.add(shade);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), brass); cap.position.y = 1.93; g.add(cap);
    A.addBlob(g, 0.6, 0.6);
  } else if (id === "deco_alfombra") {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.2), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 0.95 }));
    r.rotation.x = -Math.PI / 2; r.position.y = 0.012; g.add(r);
    const post = A.makeVelvetRope({ length: 1.6, posts: 2 }); post.position.z = -0.75; g.add(post);
  } else if (id === "deco_estatua") {
    const ped = new THREE.Mesh(A.roundedBox(0.6, 0.9, 0.6, 0.04), marble); ped.position.y = 0.45; g.add(ped);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.19, 0.75, 10), brass); body.position.y = 1.3; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), brass); head.position.y = 1.8; g.add(head);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 8), brass); arm.position.set(0.2, 1.75, 0); arm.rotation.z = -0.5; g.add(arm);
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.025, 16), brass); coin.position.set(0.36, 2.03, 0); coin.rotation.x = Math.PI / 2; g.add(coin);
    g.userData.spin = coin;
    A.addBlob(g, 0.9, 0.9);
  } else if (id === "deco_fuente") {
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.42, 24), marble); basin.position.y = 0.21; g.add(basin);
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.56, 24), A.std(0x2f86b8, 0.1, 0.2, 0x0a2a40)); water.rotation.x = -Math.PI / 2; water.position.y = 0.4; g.add(water);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.9, 10), marble); col.position.y = 0.8; g.add(col);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.12, 0.14, 16), brass); bowl.position.y = 1.25; g.add(bowl);
    const jet = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 8), new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.6 })); jet.position.y = 1.5; g.add(jet);
    g.userData.spin = jet;
    A.addBlob(g, 1.5, 1.5);
  } else if (window.CasinoBuild) g.add(window.CasinoBuild.makeDecor(id)); // v3: decoración nueva (decor.js)
  return g;
}
function spawnDecor(d) {
  const def = DECO(d.id), spot = spotById[d.spot];
  const g = makeDecor(d.id); g.position.set(spot.x, 0, spot.z); g.rotation.y = spot.rot || 0; scene.add(g);
  const o = { d, def, spot, group: g };
  if (spot.cw != null) { if (spot.cw > 0) o.collider = boxAt(spot.x, spot.z, spot.cw, spot.cd, "decor"); } else if (d.id !== "deco_alfombra") { const r = d.id === "deco_fuente" ? 1.3 : 0.7; o.collider = boxAt(spot.x, spot.z, r, r, "decor"); }
  proxy(g, 0.9, 1.6, 0.9, { prompt: () => ({ text: `${def.name} · +${def.atr} de atractivo`, sub: window.CasinoBuild ? "Usar: mover o vender" : "Usar: cambiarla por otra" }), hold: () => 0, use: () => window.CasinoBuild ? window.CasinoBuild.decorInfo(o) : openDecorShop(spot) });
  spot.decor = o; spot.marker.visible = false; decorObjs.push(o);
  return o;
}
function despawnDecor(o) {
  scene.remove(o.group); o.group.traverse(x => { if (x.userData.interact) dropProxy(x); });
  if (o.collider) removeCollider(o.collider);
  o.spot.decor = null; o.spot.marker.visible = zoneOpen(o.spot.zone);
  const i = decorObjs.indexOf(o); if (i >= 0) decorObjs.splice(i, 1);
}
function buyDecor(def, spot) {
  if (S.rank < def.rank) { toast(`Necesitás rango ${def.rank}.`, "bad"); return false; }
  if (!Economy.trySpend("decor", def.price)) return false;
  if (spot.decor) { S.decor.splice(S.decor.indexOf(spot.decor.d), 1); despawnDecor(spot.decor); }
  const d = { spot: spot.id, id: def.id }; S.decor.push(d); spawnDecor(d);
  sfx("register") || SFX.coin(); toast(`Pusiste: ${def.name} (+${def.atr} de atractivo).`, "good");
  unstickPlayer(spot.x, spot.z - 1.4); save(true); return true;
}
function buyBar() {
  if (S.bar) return false;
  if (S.rank < BAR_DEF.rank) { toast(`Necesitás rango ${BAR_DEF.rank}.`, "bad"); return false; }
  if (!Economy.trySpend("decor", BAR_DEF.price)) return false;
  return installBar();
}
function installBar() { // ya pagada (la caja de la compu, shop.js) o recién comprada
  if (S.bar) return false;
  S.bar = true; placeBar(true); sfx("register") || SFX.coin();
  toast("¡Abriste la barra! Ya podés servir tragos y contratar camareros.", "good");
  unstickPlayer(BAR.x, BAR.z + 1.5); save(true); return true;
}

// =====================================================================
// PERSONAS — muñecos del kit de arte, reciclados en un pool
// =====================================================================
const SHIRTS = [0x2a6fd6, 0xd4423f, 0x1d8a4e, 0xe0a030, 0x7a3ab0, 0x2aa3a3, 0xc8577a, 0x5a6a2a, 0x8a5a3a, 0x3a4a8a, 0xb0b0a8, 0x9a2a2a];
const PANTS = [0x1e2430, 0x2a2a30, 0x3a3226, 0x23324a];
const HAIRS = [0x2a1a10, 0x1a1a1a, 0x5a3a1a, 0x8a6a3a, 0xc9b28a, 0x6a2a14];
const SKINS = A.SKINS || [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const CAP_COLORS = [0xc8323a, 0x2a6fd6, 0x1d8a4e, 0x15171a, 0xd9a84a, 0x7a3ab0];
const LOOKS = {
  casual: SHIRTS.map((shirt, i) => ({ shirt, skin: SKINS[i % SKINS.length], hair: HAIRS[(i * 7) % HAIRS.length], pants: PANTS[i % 4], female: i % 3 === 1, height: 0.94 + (i % 4) * 0.035 })),
  regular: CAP_COLORS.map((cap, i) => ({ shirt: SHIRTS[(i * 5 + 3) % SHIRTS.length], skin: SKINS[(i + 2) % SKINS.length], hair: HAIRS[i % HAIRS.length], pants: PANTS[(i + 1) % 4], cap, height: 0.97 + (i % 3) * 0.03 })),
  highroller: [0x1a1a24, 0x24161a, 0x14202a, 0x202024].map((jacket, i) => ({ vip: true, jacket, skin: SKINS[(i * 3) % SKINS.length], hair: HAIRS[(i + 1) % HAIRS.length], female: i === 2, height: 1.0 })),
  vip: [0, 1, 2].map(i => ({ vip: true, jacket: 0xf1ece0, pants: 0xf1ece0, skin: SKINS[(i * 2 + 1) % SKINS.length], hair: HAIRS[i * 2 % HAIRS.length], female: i === 1, height: 1.02 })),
  inspector: [{ vip: true, jacket: 0x6b7078, pants: 0x55595f, skin: 0xe0ac69, hair: 0x8a8a8a, height: 1.0, folder: true }],
};
const trayGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.015, 14);
const glassGeo = new THREE.CylinderGeometry(0.035, 0.02, 0.1, 8);
const glassMat = new THREE.MeshStandardMaterial({ color: 0xffc070, emissive: 0x402008, transparent: true, opacity: 0.85 });
// bate del guardia: un torno (perilla, mango fino, barril) compartido por todos
const batGeo = new THREE.LatheGeometry([[0.001, -0.02], [0.026, -0.015], [0.026, 0.0], [0.015, 0.02], [0.016, 0.3], [0.03, 0.55], [0.037, 0.74], [0.032, 0.8], [0.001, 0.81]].map(p => new THREE.Vector2(p[0], p[1])), 9);
const batMat = new THREE.MeshStandardMaterial({ color: 0xc8925a, roughness: 0.5 });

function iconTex(draw) { return A.canvasTex(64, 64, draw); }
const ICON_MATS = {
  excl: new THREE.SpriteMaterial({ map: iconTex(g => { g.fillStyle = "#d4423f"; g.beginPath(); g.arc(32, 32, 28, 0, 7); g.fill(); g.fillStyle = "#fff"; g.font = "bold 46px Arial"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("!", 32, 34); }), depthTest: false }),
  star: new THREE.SpriteMaterial({ map: iconTex(g => { g.fillStyle = "#f6c766"; g.strokeStyle = "#5a3a10"; g.lineWidth = 3; g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 12 : 28, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(32 + Math.cos(a) * r, 34 + Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke(); }) }),
  drink: new THREE.SpriteMaterial({ map: iconTex(g => { g.fillStyle = "rgba(7,20,15,.85)"; g.beginPath(); g.arc(32, 32, 29, 0, 7); g.fill(); g.strokeStyle = "#d9a84a"; g.lineWidth = 3; g.stroke(); g.fillStyle = "#ffcf7a"; g.beginPath(); g.moveTo(16, 18); g.lineTo(48, 18); g.lineTo(32, 36); g.closePath(); g.fill(); g.fillRect(30, 35, 4, 12); g.fillRect(23, 46, 18, 4); g.fillStyle = "#d4423f"; g.beginPath(); g.arc(40, 18, 4, 0, 7); g.fill(); }) }),
  insp: new THREE.SpriteMaterial({ map: iconTex(g => { g.fillStyle = "#c9ced4"; g.fillRect(16, 10, 32, 44); g.fillStyle = "#55595f"; g.fillRect(24, 6, 16, 8); g.fillStyle = "#33373d"; for (let i = 0; i < 4; i++) g.fillRect(21, 20 + i * 8, 22, 3); }) }),
  dizzy: new THREE.SpriteMaterial({ map: A.canvasTex(128, 64, g => { g.strokeStyle = "#ffe08a"; g.lineWidth = 5; g.lineCap = "round"; for (let i = 0; i < 2; i++) { g.beginPath(); for (let a = 0; a < 12; a += 0.3) { const r = 3 + a * 2.2; g.lineTo(32 + i * 64 + Math.cos(a) * r, 32 + Math.sin(a) * r * 0.8); } g.stroke(); } }), transparent: true, depthWrite: false }),
  cash: new THREE.SpriteMaterial({ map: iconTex(g => { g.fillStyle = "#3f8a4a"; g.beginPath(); g.arc(32, 32, 26, 0, 7); g.fill(); g.fillStyle = "#e8ffe8"; g.font = "bold 36px Arial"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("$", 32, 34); }) }),
};
const BAR_BG = new THREE.SpriteMaterial({ color: 0x0b0906, depthTest: false });
const BAR_FG = new THREE.SpriteMaterial({ color: 0xd9a84a, depthTest: false });

const personPool = new Map();
function makeLookPerson(kind, look) {
  const opts = Object.assign({}, look);
  const g = A.makePerson(opts);
  const J = g.api.joints;
  if (look.badge && window.CasinoStaff) window.CasinoStaff.addBadge(g, J, look.badge); // credencial de Nahuel Técnico (staff.js)
  // la gorra (look.cap) y la carpeta del inspector (look.folder) vienen dentro de la malla del muñeco (art.js)
  const icon = new THREE.Sprite(ICON_MATS.star); icon.scale.set(0.34, 0.34, 1); icon.position.y = 2.15; icon.visible = false; icon.renderOrder = 10; g.add(icon);
  const bg = new THREE.Sprite(BAR_BG); bg.scale.set(0.56, 0.09, 1); bg.position.y = 2.05; bg.visible = false; bg.renderOrder = 11; g.add(bg);
  const fg = new THREE.Sprite(BAR_FG); fg.center.set(0, 0.5); fg.scale.set(0.01, 0.06, 1); fg.position.set(-0.26, 2.05, 0); fg.visible = false; fg.renderOrder = 12; g.add(fg);
  const tray = new THREE.Group(); tray.add(new THREE.Mesh(trayGeo, A.materials.chrome)); const gl = new THREE.Mesh(glassGeo, glassMat); gl.position.y = 0.06; tray.add(gl);
  tray.position.set(0, -0.32, 0.12); tray.visible = false; J.elbowR.add(tray);
  g.rotation.order = "YXZ"; // para poder tirarlo al piso hacia atrás según hacia dónde mira
  let bat = null;
  if (kind.startsWith("staff_sec")) { bat = new THREE.Mesh(batGeo, batMat); bat.position.set(0, -0.3, 0.02); bat.rotation.x = Math.PI / 2 - 0.25; bat.visible = false; J.elbowR.add(bat); } // bate de béisbol (guardia)
  const p = { group: g, api: g.api, icon, bg, fg, tray, bat, kind, agent: null };
  p.proxy = proxy(g, 0.6, 1.8, 0.6, { soft: true, prompt: () => p.agent && p.agent.interact ? p.agent.interact.prompt() : { text: "" }, hold: () => (p.agent && p.agent.interact && p.agent.interact.hold ? p.agent.interact.hold() : 0), usable: () => !!(p.agent && p.agent.interact && p.agent.interact.usable()), use: () => p.agent && p.agent.interact && p.agent.interact.use() }, 0.95);
  const i = pickables.indexOf(p.proxy); if (i >= 0) pickables.splice(i, 1); // se agrega al adquirir
  return p;
}
function acquirePerson(kind, idx, opts) {
  const key = kind + ":" + idx;
  let list = personPool.get(key), p = list && list.pop();
  if (!p) {
    const look = opts || LOOKS[kind][idx % LOOKS[kind].length];
    p = makeLookPerson(key, look);
  }
  p.group.visible = true; p.api.stand(); p.icon.visible = false; p.bg.visible = false; p.fg.visible = false; p.tray.visible = false; if (p.bat) p.bat.visible = false;
  p.group.rotation.set(0, 0, 0);
  scene.add(p.group); if (!pickables.includes(p.proxy)) pickables.push(p.proxy);
  return p;
}
function releasePerson(p) {
  if (!p) return;
  scene.remove(p.group); p.agent = null;
  const i = pickables.indexOf(p.proxy); if (i >= 0) pickables.splice(i, 1);
  if (!personPool.has(p.kind)) personPool.set(p.kind, []);
  personPool.get(p.kind).push(p);
}
function setIcon(p, name) { if (!p) return; if (!name) { p.icon.visible = false; return; } p.icon.material = ICON_MATS[name]; p.icon.visible = true; }
function setBar(p, f) {
  if (!p) return;
  if (f == null) { p.bg.visible = p.fg.visible = false; return; }
  p.bg.visible = p.fg.visible = true; p.fg.scale.x = Math.max(0.01, 0.52 * clamp(f, 0, 1));
}

// movimiento de agentes ---------------------------------------------------------
function placeAgent(a, x, z) { a.x = x; a.z = z; a.person.group.position.set(x, 0, z); }
function goTo(a, x, z) { a.path = findPath(a.x, a.z, x, z); a.goal = { x, z }; }
function stepAgent(a, dt, speed) {
  if (!a.path || !a.path.length) return true;
  const t = a.path[0], dx = t.x - a.x, dz = t.z - a.z, d = Math.hypot(dx, dz), step = speed * dt;
  if (d <= step || d < 1e-4) { a.x = t.x; a.z = t.z; a.path.shift(); }
  else { a.x += dx / d * step; a.z += dz / d * step; turnToward(a, Math.atan2(dx, dz), dt); }
  a.person.group.position.set(a.x, 0, a.z);
  a.person.api.walk(dt, Math.min(speed, 3.2));
  return !a.path.length;
}
function turnToward(a, yaw, dt) {
  const r = a.person.group.rotation;
  let diffA = yaw - r.y; while (diffA > Math.PI) diffA -= Math.PI * 2; while (diffA < -Math.PI) diffA += Math.PI * 2;
  r.y += diffA * Math.min(1, dt * 10);
}
function faceTo(a, x, z) { a.person.group.rotation.y = Math.atan2(x - a.x, z - a.z); }

// textos flotantes en el mundo -------------------------------------------------
const floats = [];
for (let i = 0; i < 10; i++) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 64;
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.scale.set(1.2, 0.3, 1); sp.visible = false; sp.renderOrder = 20; scene.add(sp);
  floats.push({ sp, c, tex, life: 0 });
}
let floatIdx = 0;
function floatText(x, y, z, text, color) {
  const f = floats[floatIdx++ % floats.length], g = f.c.getContext("2d");
  g.clearRect(0, 0, 256, 64);
  g.font = "bold 40px 'IBM Plex Mono', monospace"; g.textAlign = "center"; g.textBaseline = "middle";
  g.lineWidth = 7; g.strokeStyle = "rgba(7,20,15,.9)"; g.strokeText(text, 128, 34);
  g.fillStyle = color || "#f3e9d2"; g.fillText(text, 128, 34);
  f.tex.needsUpdate = true; f.sp.position.set(x, y, z); f.sp.visible = true; f.life = 1.5; f.sp.material.opacity = 1;
}
function updateFloats(dt) {
  for (const f of floats) {
    if (f.life <= 0) continue;
    f.life -= dt; f.sp.position.y += dt * 0.55; f.sp.material.opacity = clamp(f.life / 0.6, 0, 1);
    if (f.life <= 0) f.sp.visible = false;
  }
}
function floatXp(n) {
  const el = document.createElement("div");
  el.textContent = `+${n} XP`;
  el.style.cssText = "position:fixed;left:50%;top:calc(50% - 46px);transform:translateX(-50%);font:600 15px 'IBM Plex Mono',monospace;color:#cdb4ff;text-shadow:0 1px 3px #000;pointer-events:none;transition:transform 1.1s ease-out,opacity 1.1s ease-out;z-index:5";
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.transform = "translate(-50%,-34px)"; el.style.opacity = "0"; });
  setTimeout(() => el.remove(), 1200);
}

// =====================================================================
// CLIENTES
// =====================================================================
const customers = [];
let spawnTimer = 2;
const DOOR = { x: 0, z: -8.4 };
const QUEUE = [{ x: -1.3, z: -7.4 }, { x: 1.3, z: -7.4 }, { x: -2.3, z: -6.6 }, { x: 2.3, z: -6.6 }, { x: -0.6, z: -6.2 }, { x: 0.7, z: -6.0 }, { x: -1.8, z: -5.4 }, { x: 1.9, z: -5.4 }];
const streetPoint = () => ({ x: (Math.random() < 0.5 ? -1 : 1) * rnd(5, 12), z: -15.6 });

function pickType() {
  const list = D.CUSTOMER_TYPES.filter(t => S.rank >= t.rank);
  let total = 0; const w = list.map(t => { const v = t.weight * (1 + (t.loyal ? (S.loyalty[t.id] || 0) : 0) * CFG.loyaltySpawnBonus) * (t.id === "highroller" || t.id === "vip" ? UPV("vipWeightMul", 1) : 1) * (window.CasinoOwner ? window.CasinoOwner.typeMul(t.id) : 1) * (window.CasinoWorld ? window.CasinoWorld.typeMul(t.id) : 1); total += v; return v; }); // owner.js + world.js: clima por tipo
  let r = Math.random() * total;
  for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) return list[i]; }
  return list[0];
}
function spawnCustomer(forceType, forceThief, look) { // look: aspecto fijo (socios y jugadores del torneo, clients.js)
  const thief = forceThief != null ? forceThief : !forceType && Math.random() < (CFG.thiefBase + CFG.thiefPerHeat * S.heat) * (window.CasinoWorld ? window.CasinoWorld.thiefMul() : 1); // world.js: protección // un tipo pedido (VIP de la gala) nunca sale ladrón
  const type = thief ? CTYPE("casual") : (forceType ? CTYPE(forceType) : pickType());
  const kind = type.id, looks = LOOKS[kind] || LOOKS.casual, idx = (Math.random() * looks.length) | 0;
  const p = look ? acquirePerson("socio", look.key, look) : acquirePerson(LOOKS[kind] ? kind : "casual", idx);
  const sp = streetPoint();
  const c = {
    kind: "customer", type, thief, person: p, x: sp.x, z: sp.z, state: "enter", path: null,
    budget: rndi(type.budget[0], type.budget[1]), betMin: type.bet[0], betMax: type.bet[1], rounds: Math.max(1, Math.round(rndi(type.rounds[0], type.rounds[1]) * UPV("roundsMul", 1))),
    flags: {}, waitT: 0, timer: 0, played: false, machine: null, table: null, seat: null,
    wantsDrink: !!(type.wantsDrink && S.bar), drink: null, greeted: false, lowAtr: attractiveness() < (type.minAtr || 0),
    speed: (thief ? D.THIEF.speed : type.speed) * rnd(0.9, 1.12), retry: 0, noticed: false,
  };
  p.agent = c; c.interact = customerInteract(c);
  placeAgent(c, sp.x, sp.z);
  goTo(c, DOOR.x + rnd(-0.5, 0.5), DOOR.z);
  if (type.needsGreet) setIcon(p, "star");
  customers.push(c); S.today.st.visitors++;
  if (window.CasinoOwner) window.CasinoOwner.onSpawn(c); // publicidad: cuenta los clientes que trajo cada campaña (owner.js)
  if (window.CasinoShop) window.CasinoShop.onSpawn(c); // kiosco: fichas y una pausa para tomar algo (shop.js)
  if (window.CasinoWorld) window.CasinoWorld.onSpawn(c); // clima y huéspedes del hotel (world.js)
  if (type.needsGreet) { toast(`Llegó un VIP. Recibilo en la puerta (miralo y ${KEY}).`, "good"); sfx("vip", DOOR.x, DOOR.z) || SFX.coin(); }
  return c;
}
function customerInteract(c) {
  const life = () => c.lifeAct && c.lifeAct.active() ? c.lifeAct : null; // life.js: borracho, pelea, cumpleaños, tramposo, celebridad
  const club = () => window.CasinoClients ? window.CasinoClients.act(c) : null; // clients.js: tarjeta de socio y pedidos de los socios
  return {
    soft: true,
    hold: () => { const l = life(); return l && l.hold ? l.hold() : 0; },
    prompt() {
      { const l = life(); if (l) return l.prompt(); }
      if (c.thief && c.noticed && (c.state === "thief_case" || c.state === "thief_steal")) return { text: "¡Un ladrón! Atrapalo", sub: "Está por vaciar la caja de la máquina" };
      if (c.state === "caught") return { text: "Ladrón atrapado", sub: "Lo están sacando del casino" };
      if (c.type.needsGreet && !c.greeted && (c.state === "greet" || c.state === "enter")) return { text: "Recibir al VIP", sub: "Le das la bienvenida en la puerta" };
      { const k = !player.drink && club(); if (k && k.usable) return k.prompt(); } // pedido del socio (sin un trago en la mano)
      if (c.drink && (c.drink.state === "want" || c.drink.state === "claimed")) return player.drink ? { text: `Servirle el trago (${c.type.name})`, sub: "Llegaste a tiempo" } : { text: `${c.type.name} · quiere un trago`, sub: "Tomá uno en la barra y traéselo" };
      { const k = club(); if (k) return k.prompt(); }
      const where = c.machine ? c.machine.def.name : c.table ? c.table.def.name : "buscando juego";
      return { text: c.thief ? "Cliente" : c.type.name, sub: c.state === "queue" ? "Esperando un lugar libre" : where };
    },
    usable() {
      if (life()) return true;
      if (c.thief && c.noticed && (c.state === "thief_case" || c.state === "thief_steal")) return true;
      if (c.type.needsGreet && !c.greeted && (c.state === "greet" || c.state === "enter")) return true;
      if (player.drink && c.drink && (c.drink.state === "want" || c.drink.state === "claimed")) return true;
      const k = club(); return !!(k && k.usable);
    },
    use() {
      { const l = life(); if (l) { l.use(); return; } }
      if (c.thief && c.noticed && (c.state === "thief_case" || c.state === "thief_steal")) { catchThief(c, null); return; }
      if (c.type.needsGreet && !c.greeted && (c.state === "greet" || c.state === "enter")) {
        c.greeted = true; S.today.st.vipGreeted++; Rank.add(D.XP.greetVip); checkObjectives(); sfx("greet") || SFX.coin();
        toast("Recibiste al VIP. Está encantado.", "good"); if (c.person) c.person.api.cheer(1); return;
      }
      if (player.drink && c.drink && (c.drink.state === "want" || c.drink.state === "claimed")) { serveDrink(c, null); return; }
      { const k = club(); if (k && k.usable) k.use(); }
    },
  };
}
function serveDrink(c, waiter) {
  if (!c.drink || c.drink.state === "served" || c.drink.state === "missed") return false;
  c.drink.state = "served"; c.flags.drinkOk = true; setIcon(c.person, c.type.needsGreet ? "star" : null);
  const w = SDEF("waiter"), gain = w.drinkPrice + UPV("drinkPriceAdd", 0) - w.drinkCost; Economy.add("drinks", gain); S.today.st.drinks++;
  if (!waiter) { player.drink = false; S.today.st.drinksByHand++; Rank.add(D.XP.serveDrink); checkObjectives(); toast(`Le serviste el trago. +${fmt(gain)}.`, "good"); }
  if (c.person) floatText(c.x, 2.3, c.z, "+" + fmt(gain), "#6fd39b");
  return true;
}
function dealerAvailable(t) { return !!t.staff || t.playerDealing || !!t.def.noDealer; }
function chooseGame(c) {
  { const f = window.CasinoClients && window.CasinoClients.choose(c); if (f) return f; } // socios con pedido y jugadores del torneo (clients.js)
  const opts = []; let total = 0;
  const pref = id => c.type.prefers && c.type.prefers.includes(id) ? 3 : 1;
  for (const m of machines) {
    if (m.user || m.d.broken || m.dark || isFull(m) || !zoneOpen(m.slot.zone)) continue;
    const bet = m.def.bet; if (bet < c.betMin || bet > c.betMax || bet > c.budget) continue;
    const w = appealOfMachine(m.d) * pref(m.def.id); opts.push({ m, w }); total += w;
  }
  for (const t of tables) {
    if (!dealerAvailable(t) || !zoneOpen(t.spot.zone) || (t.reserved && !c.tourney)) continue; // mesa reservada para el torneo
    const free = t.seats.filter(s => !s.c); if (!free.length) continue;
    const lo = Math.max(t.def.minBet, c.betMin), hi = Math.min(t.def.maxBet, c.betMax); if (hi < lo || c.budget < lo) continue;
    let w = t.def.appeal * pref(t.def.id);
    if (t.def.custom) { const gx = GAMES_X(); const k = gx ? gx.weight(c, t) : 0; if (!(k > 0)) continue; w *= k; } // bingo solo de noche, mano caliente en los dados (games.js)
    opts.push({ t, seat: pick(free), w }); total += w;
  }
  if (!opts.length) return null;
  let r = Math.random() * total;
  for (const o of opts) { r -= o.w; if (r <= 0) return o; }
  return opts[opts.length - 1];
}
function assignGame(c, o) {
  if (o.m) { o.m.user = c; c.machine = o.m; goTo(c, o.m.slot.play.x, o.m.slot.play.z); }
  else { o.seat.c = c; c.table = o.t; c.seat = o.seat; goTo(c, o.seat.x, o.seat.z); }
  c.state = "walk";
}
function releaseGame(c) {
  if (c.machine && c.machine.user === c) c.machine.user = null;
  if (c.seat && c.seat.c === c) c.seat.c = null;
  c.machine = null; c.table = null; c.seat = null;
}
function leaveCustomer(c) {
  if (c.state === "leave" || c.state === "flee" || c.state === "caught" || c.dead) return;
  if (c.shop && window.CasinoShop) window.CasinoShop.onDespawn(c); // sale de la fila de la caja (shop.js)
  const wasPlaying = c.played;
  releaseGame(c);
  if (c.person) { c.person.api.stand(); setBar(c.person, null); setIcon(c.person, null); }
  if (c.drink && c.drink.state !== "served" && c.drink.state !== "missed") { c.drink.state = "missed"; }
  if (!c.thief) {
    let sat = CFG.satBase;
    const f = c.flags;
    if (f.won) sat += CFG.satWin;
    if (f.waited) sat += CFG.satWaited;
    if (f.broken) sat += CFG.satBroken;
    if (c.wantsDrink && wasPlaying) sat += f.drinkOk ? CFG.satDrink : CFG.satNoDrink;
    if (c.lowAtr) sat += CFG.satLowDecor;
    if (window.CasinoLife) sat += window.CasinoLife.satMod(c); // ánimo acumulado (life.js)
    if (f.notGreeted) sat += CFG.satNoDrink; // VIP no recibido en la puerta (−0,2 según diseño)
    if (c.rtp != null) sat += (c.rtp - 0.9) * CFG.satRtpK;
    sat = clamp(sat, 0, 1);
    if (wasPlaying || f.waited) Rep.change((sat - 0.5) * CFG.repPerSat);
    if (window.CasinoClients) window.CasinoClients.onLeave(c, sat, wasPlaying); // socios: la visita suma o resta fidelidad
    if (c.type.loyal && wasPlaying) S.loyalty[c.type.id] = clamp((S.loyalty[c.type.id] || 0) + (sat >= 0.6 ? 0.25 : -0.5), 0, CFG.loyaltyMax);
    if (wasPlaying) { S.today.st.served++; S.totals.served++; checkObjectives(); }
  }
  c.state = "leave";
  const sp = streetPoint(); goTo(c, sp.x, sp.z);
}
function despawnCustomer(c) {
  if (window.CasinoLife) window.CasinoLife.onDespawn(c);
  if (window.CasinoCombat) window.CasinoCombat.onDespawn(c);
  if (window.CasinoOwner) window.CasinoOwner.onDespawn(c); // banda del robo y sospechosos (owner.js)
  if (window.CasinoShop) window.CasinoShop.onDespawn(c);
  if (window.CasinoClients) window.CasinoClients.onDespawn(c);
  releaseGame(c);
  if (c.drink) c.drink.state = "missed";
  if (c.knock) { dropStars(c.knock); c.knock = null; }
  if (c.person) { c.person.group.rotation.x = 0; c.person.group.position.y = 0; }
  releasePerson(c.person); c.person = null; c.dead = true;
}
function updateCustomer(c, dt) {
  const p = c.person;
  if (c.cmb && window.CasinoCombat && window.CasinoCombat.actor(c, dt)) return; // peleas, heridos y fuga por disparos (combat.js)
  if (c.owner && window.CasinoOwner && window.CasinoOwner.actor(c, dt)) return; // robo planeado, sospechosos e influencer (owner.js)
  if (c.life && window.CasinoLife && window.CasinoLife.actor(c, dt)) return; // actores de los eventos (life.js)
  if ((c.shop || c.shopPlan) && window.CasinoShop && window.CasinoShop.actor(c, dt)) return; // kiosco y caja registradora (shop.js)
  if (c.drink && (c.drink.state === "want" || c.drink.state === "claimed")) {
    c.drink.left -= dt;
    if (c.drink.left <= 0) { c.drink.state = "missed"; setIcon(p, c.type.needsGreet ? "star" : null); }
  }
  switch (c.state) {
    case "enter":
      if (stepAgent(c, dt, c.speed)) {
        sfx("door", c.x, c.z);
        if (c.thief) { thiefStart(c); break; }
        if (c.type.needsGreet && !c.greeted) { c.state = "greet"; c.timer = GREET_SEC; faceTo(c, 0, 0); hint("vip", `Los VIP esperan en la puerta: miralos y ${KEY} para recibirlos (+XP). Si nadie los recibe se ofenden.`); }
        else c.state = "choose";
      }
      break;
    case "greet":
      p.api.idle(dt); c.timer -= dt;
      if (c.greeted || c.timer <= 0) { if (!c.greeted) c.flags.notGreeted = true; c.state = "choose"; }
      break;
    case "choose": {
      if (!isOpen) { leaveCustomer(c); break; }
      const o = chooseGame(c);
      if (o) assignGame(c, o);
      else { c.state = "queue"; c.timer = CFG.patienceSec * UPV("patienceMul", 1); const q = QUEUE[(customers.indexOf(c) + rndi(0, 3)) % QUEUE.length]; goTo(c, q.x + rnd(-0.25, 0.25), q.z + rnd(-0.25, 0.25)); }
      break;
    }
    case "queue": {
      if (!stepAgent(c, dt, c.speed)) {} else p.api.idle(dt);
      c.timer -= dt; c.retry -= dt;
      if (c.retry <= 0) { c.retry = 1; const o = chooseGame(c); if (o) { assignGame(c, o); break; } }
      if (c.timer <= 0 || !isOpen) { c.flags.waited = isOpen; leaveCustomer(c); }
      break;
    }
    case "walk": {
      if (!isOpen) { leaveCustomer(c); break; }
      const m = c.machine, t = c.table;
      if ((m && (m.dead || m.d.broken || m.dark || isFull(m))) || (t && t.dead)) { releaseGame(c); c.state = "choose"; break; }
      if (stepAgent(c, dt, c.speed)) {
        c.state = "play"; c.waitT = 0;
        if (m) { placeAgent(c, m.slot.play.x, m.slot.play.z); p.group.rotation.y = m.slot.faceY || 0; p.api.sit(0.72); c.timer = m.def.spin * rnd(0.5, 1) * UPV("spinMul", 1); c.rtp = RTPD(m.d.rtp).rtp; }
        else { placeAgent(c, c.seat.x, c.seat.z); p.group.rotation.y = c.seat.rot; if (t.sit) p.api.sit(t.sit); else p.api.stand(); }
        if (c.type.id === "highroller") { S.today.st.highrollers++; checkObjectives(); }
        if (c.wantsDrink && !c.drink && S.bar) { c.drink = { state: "want", left: HOUR, by: null }; setIcon(p, "drink"); hint("drink", "Ese cliente quiere un trago (ícono de copa). Tomá uno en la barra y llevaselo, o contratá un camarero."); }
      }
      break;
    }
    case "play": {
      if (!isOpen) { leaveCustomer(c); break; }
      if (c.table) { if (c.table.sit) p.api.idle(dt); else p.api.play(dt); break; }
      const m = c.machine;
      if (!m || m.dead) { leaveCustomer(c); break; }
      p.api.idle(dt);
      if (m.dark) { c.waitT += dt; if (c.waitT > CFG.patienceSec * D.LIFE.outage.patienceMul) { c.flags.waited = true; leaveCustomer(c); } break; } // apagón (life.js)
      c.timer -= dt; if (c.timer > 0) break;
      c.timer = m.def.spin * UPV("spinMul", 1);
      if (c.rounds <= 0 || c.budget < m.def.bet) { leaveCustomer(c); break; }
      const prize = machineSpin(m, c);
      if (prize < 0) { c.flags.broken = true; leaveCustomer(c); break; }
      c.rounds--; c.played = true; if (prize > 0) c.flags.won = true;
      break;
    }
    case "caught": if (c.knock) { updateKnock(c, dt); break; } // falls through
    case "leave": case "flee":
      if (stepAgent(c, dt, c.state === "flee" ? c.speed * 1.7 : c.state === "caught" ? 1.6 : c.speed)) despawnCustomer(c);
      break;
    case "thief_go": case "thief_case": case "thief_steal":
      updateThief(c, dt);
      break;
  }
}
function updateSpawner(dt) {
  if (!isOpen || (!machines.length && !tables.length)) return;
  let seats = machines.length; for (const t of tables) seats += t.seats.length;
  let inside = 0; for (const c of customers) if (!c.dead && c.state !== "leave" && c.state !== "flee" && c.state !== "caught") inside++;
  if (inside >= Math.floor(seats * CFG.crowdFactor * (window.CasinoWorld ? window.CasinoWorld.crowdMul() : 1)) || customers.length >= MAX_ACTORS) return; // world.js: el finde entra más gente
  spawnTimer -= dt; if (spawnTimer > 0) return;
  spawnTimer = HOUR / Math.max(0.1, demandPerHour()) * rnd(0.6, 1.4);
  spawnCustomer();
}
function demandPerHour() {
  const hour = Math.floor(S.minutes / 60);
  return (CFG.baseCustomersPerHour + CFG.perAppealPerHour * appealSum()) * (0.5 + S.rep / 100) * rivalMul()
    * (CFG.hourCurve[hour] || 0.7) * (S.today.promo ? RIVAL.promoDemandMul : 1) * diff().demand * (window.CasinoLife ? window.CasinoLife.demandMul() : 1) * UPV("demandMul", 1) * (window.CasinoOwner ? window.CasinoOwner.demandMul() : 1) * (window.CasinoChallenge ? window.CasinoChallenge.demandMul() : 1) * (window.CasinoWorld ? window.CasinoWorld.demandMul() : 1) * (window.CasinoClients ? window.CasinoClients.demandMul() : 1); // publicidad (owner.js) + modos (challenge.js) + día/clima (world.js) + torneo (clients.js)
}

// =====================================================================
// PERSONAL — NPCs visibles con tareas
// =====================================================================
const staffNpcs = []; // { role, def, person, x, z, state, path, t, target, table, carried, count, scan, i }
const STAFF_UNIFORM = { tech: "tech", sec: "security", cashier: "cashier", dealer: "croupier", waiter: "host", stock: "stock" };
const STAFF_IDLE = {
  tech: [{ x: -3, z: 8.8 }, { x: 0, z: 8.8 }, { x: 3, z: 8.8 }],
  sec: [{ x: -2.2, z: -8.6 }, { x: 2.2, z: -8.6 }, { x: 0, z: -1 }, { x: -9, z: -1 }],
  cashier: [SAFE.idle, { x: -6.0, z: -9.3 }, { x: -5.4, z: -8.8 }],
  dealer: [{ x: -4.5, z: 8.8 }, { x: 4.5, z: 8.8 }, { x: -6, z: 8.8 }, { x: 6, z: 8.8 }, { x: -1.5, z: 8.8 }],
  waiter: [BAR.idle, { x: 6.0, z: -6.6 }, { x: 5.4, z: -7.4 }],
  stock: [{ x: 3.0, z: -9.0 }, { x: 2.6, z: -8.2 }, { x: 3.2, z: -5.6 }], // repositor: al lado de donde deja las cajas grandes (shop.js)
};
const PATROL = {
  principal: [{ x: -8.8, z: -1.2 }, { x: 8.8, z: -1.2 }, { x: 0, z: 4.5 }, { x: 0, z: -6.4 }, { x: -9, z: 4.5 }, { x: 9, z: 4.5 }, { x: -3, z: -1.2 }, { x: 3, z: 4.5 }],
  este: [{ x: 16, z: -1.2 }, { x: 13, z: 4.5 }, { x: 19, z: 4.5 }, { x: 20.5, z: -6.5 }],
  oeste: [{ x: -16.5, z: -0.5 }, { x: -14, z: 4.5 }, { x: -19, z: 4.5 }, { x: -12, z: -6.5 }],
};
const staffSkin = i => SKINS[(i * 3 + 1) % SKINS.length];
function hireNpc(role, walkIn) {
  const def = SDEF(role), i = staffNpcs.filter(n => n.role === role).length;
  const rec = window.CasinoStaff ? window.CasinoStaff.nextRecord(role, staffNpcs) : null; // ficha del empleado (nombre, rango, eficiencia)
  const look = rec && window.CasinoStaff.look(rec);
  const p = look ? acquirePerson("staff_" + role + "_" + look.key, 0, Object.assign({ uniform: STAFF_UNIFORM[role] }, look.opts))
    : acquirePerson("staff_" + role, i % 4, { uniform: STAFF_UNIFORM[role], skin: staffSkin(i + role.length), hair: HAIRS[(i + role.length) % HAIRS.length], female: (i + role.length) % 2 === 0 });
  const n = { kind: "staff", role, def, person: p, x: 0, z: 0, state: "idle", path: null, t: 0, target: null, table: null, carried: 0, count: 0, scan: 0, i, rec: rec || null, effMul: rec ? window.CasinoStaff.effMul(rec) : 1, taskMul: rec ? window.CasinoStaff.taskMul(rec) : 1 };
  p.agent = n;
  n.interact = { soft: true, prompt: () => ({ text: rec ? `${rec.name} · ${window.CasinoStaff.rankName(rec)}` : def.name, sub: staffStatus(n) }), usable: () => false, use() {} };
  const home = idleOf(n);
  if (walkIn) { placeAgent(n, rnd(-1, 1), -12); n.state = "return"; goTo(n, home.x, home.z); }
  else { placeAgent(n, home.x, home.z); }
  staffNpcs.push(n);
  return n;
}
function idleOf(n) { const list = STAFF_IDLE[n.role], b = list[n.i % list.length], k = Math.floor(n.i / list.length); return k ? { x: b.x + (k % 2 ? 0.7 : -0.7) * Math.ceil(k / 2), z: b.z - 0.6 * k } : b; } // con más empleados que puestos se corren un poco
function staffStatus(n) {
  { const ss = window.CasinoShop && window.CasinoShop.staffStatus(n); if (ss) return ss; } // caja registradora y repositor (shop.js)
  switch (n.state) {
    case "go": return n.role === "tech" ? "Va a reparar una máquina" : n.role === "cashier" ? "Va a vaciar una caja" : "Trabajando";
    case "work": return n.role === "tech" ? "Reparando" : "Vaciando la caja";
    case "deposit_go": case "deposit": return `Lleva ${fmt(n.carried)} a la caja fuerte`;
    case "deal": return "Repartiendo";
    case "goTable": return "Va a su mesa";
    case "chase": return "¡Persigue a un ladrón!";
    case "patrol": return "Patrullando";
    case "pickup": case "deliver": case "serve": return "Llevando un trago";
    default: return n.role === "waiter" && !S.bar ? "Sin barra no puede trabajar" : "Esperando";
  }
}
function fireNpc(role, rec) {
  for (let i = staffNpcs.length - 1; i >= 0; i--) {
    const n = staffNpcs[i]; if (n.role !== role || (rec && n.rec !== rec)) continue;
    releaseNpcTask(n);
    staffNpcs.splice(i, 1); releasePerson(n.person); n.dead = true;
    return;
  }
}
function releaseNpcTask(n) {
  if (window.CasinoShop) window.CasinoShop.releaseNpc(n); // suelta la caja que llevaba o la caja registradora (shop.js)
  if (n.target && n.target.claimTech === n) { n.target.claimTech = null; }
  if (n.target && n.target.claimCash === n) n.target.claimCash = null;
  if (n.target && n.target.api && n.target.api.setDoorOpen) n.target.api.setDoorOpen(false);
  if (n.carried > 0) { Economy.add("deposits", n.carried); n.carried = 0; }
  if (n.table) { if (n.table.staff === n) n.table.staff = null; n.table = null; }
  if (n.drinkFor && n.drinkFor.drink && n.drinkFor.drink.state === "claimed") n.drinkFor.drink.state = "want";
  n.drinkFor = null; n.target = null; n.thief = null;
  if (n.person) { setBar(n.person, null); setIcon(n.person, null); n.person.tray.visible = false; }
}
function syncStaff(walkIn) {
  if (window.CasinoStaff) window.CasinoStaff.align(S); // las fichas coinciden con los cupos
  for (const s of D.STAFF) {
    const want = S.staff[s.role] || 0;
    while (staffNpcs.filter(n => n.role === s.role).length < want) hireNpc(s.role, walkIn);
    while (staffNpcs.filter(n => n.role === s.role).length > want) fireNpc(s.role);
  }
  assignDealers();
}
function resyncStaff() { // staff.js se carga después del guardado: vuelve a armar a los empleados con sus fichas
  for (const n of staffNpcs.slice()) { releaseNpcTask(n); releasePerson(n.person); n.dead = true; }
  staffNpcs.length = 0; for (const t of tables) t.staff = null;
  syncStaff(false);
  for (const n of staffNpcs) if (n.role === "dealer" && n.table) { n.state = "deal"; placeAgent(n, n.table.dealerSpot.x, n.table.dealerSpot.z); n.person.group.rotation.y = n.table.dealerRot; }
}
function assignDealers() {
  for (const t of tables) if (t.staff && (t.staff.dead || t.staff.table !== t)) t.staff = null;
  for (const t of tables) {
    if (t.staff || t.def.noDealer) continue;
    const n = staffNpcs.find(x => x.role === "dealer" && !x.table);
    if (!n) break;
    n.table = t; t.staff = n; n.state = "goTable"; goTo(n, t.dealerSpot.x, t.dealerSpot.z);
    if (t.playerDealing) t.playerDealing = false;
  }
  for (const n of staffNpcs) if (n.role === "dealer" && !n.table && (n.state === "deal" || n.state === "goTable")) { n.state = "return"; const h = idleOf(n); goTo(n, h.x, h.z); }
}
function hireStaff(role, rec) {
  const def = SDEF(role);
  if (S.rank < def.rank) { toast(`Necesitás rango ${def.rank}.`, "bad"); return false; }
  if ((S.staff[role] || 0) >= staffMax(def)) { toast(`Con tu rango podés tener ${staffMax(def)}.`, "bad"); return false; }
  if (role === "waiter" && !S.bar) { toast("Primero comprá la Barra de tragos.", "bad"); return false; }
  if (window.CasinoStaff) { if (!rec) rec = window.CasinoStaff.defaultRecord(role); if (!window.CasinoStaff.canHire(rec)) return false; if (rec.fee > 0 && !Economy.trySpend("wages", rec.fee)) return false; delete rec.fee; S.crew.push(rec); }
  S.staff[role] = (S.staff[role] || 0) + 1; hireNpc(role, true); assignDealers();
  toast(rec ? `Contrataste a ${rec.name} (${def.name}). Ya viene caminando.` : `Contrataste: ${def.name}. Ya viene caminando.`, "good"); save(true); return true;
}
function fireStaff(role, rec) {
  if (!(S.staff[role] > 0)) return;
  if (window.CasinoStaff && !rec) rec = window.CasinoStaff.lastOf(role);
  if (rec && S.crew) { const k = S.crew.indexOf(rec); if (k >= 0) S.crew.splice(k, 1); }
  S.staff[role]--; fireNpc(role, rec); assignDealers();
  toast(rec ? `Despediste a ${rec.name} (${SDEF(role).name}).` : `Despediste: ${SDEF(role).name}.`); save(true);
}
function backHome(n) { n.state = "return"; const h = idleOf(n); goTo(n, h.x, h.z); }
function updateStaffNpc(n, dt) {
  if (n.cmb) return; // combat.js: acude a defenderte o cae en el tiroteo de la Mafia
  if (n.person && n.person.bat && n.person.bat.visible && (n.state !== "bonk" || n.lifeTask)) { n.person.bat.visible = false; if (n.state === "bonk") { n.state = "patrol"; n.bonk = null; } }
  if (n.lifeTask && window.CasinoLife && window.CasinoLife.staffTask(n, dt)) return; // guardia o técnico atendiendo un evento (life.js)
  if (n.ownerTask && window.CasinoOwner && window.CasinoOwner.staffTask(n, dt)) return; // guardia frenando el robo (owner.js)
  const def = n.def, p = n.person, sp = (def.speed || 2.8) * (n.effMul || 1) * UPV("staffSpeedMul", 1) * (window.CasinoOwner ? window.CasinoOwner.staffSpeedMul() : 1); // effMul y taskMul: eficiencia del empleado (staff.js)
  switch (n.role) {
    case "tech": {
      if (n.state === "idle" || n.state === "return") {
        if (n.state === "return") { if (stepAgent(n, dt, sp)) n.state = "idle"; } else p.api.idle(dt);
        n.scan -= dt; if (n.scan > 0) break; n.scan = 0.5;
        let best = null, bd = Infinity;
        for (const m of machines) if (m.d.broken && !m.claimTech) { const d = dist2(n.x, n.z, m.slot.x, m.slot.z); if (d < bd) { bd = d; best = m; } }
        if (best) { best.claimTech = n; n.target = best; n.state = "go"; goTo(n, best.slot.play.x, best.slot.play.z); }
      } else if (n.state === "go") {
        const m = n.target;
        if (!m || m.dead || !m.d.broken) { if (m && m.claimTech === n) m.claimTech = null; n.target = null; backHome(n); break; }
        if (stepAgent(n, dt, sp)) { n.state = "work"; n.t = n.taskSec = def.taskSec / (n.taskMul || 1) * (window.CasinoCombat ? window.CasinoCombat.repairMul(m) : 1); faceTo(n, m.slot.x, m.slot.z); m.api.setDoorOpen(true); }
      } else if (n.state === "work") {
        const m = n.target; p.api.play(dt);
        if (!m || m.dead || !m.d.broken) { setBar(p, null); if (m && !m.dead) m.api.setDoorOpen(false); n.target = null; backHome(n); break; }
        n.t -= dt; setBar(p, 1 - n.t / (n.taskSec || def.taskSec));
        if (n.t <= 0) { repairMachine(m, false); m.api.setDoorOpen(false); setBar(p, null); floatText(m.slot.x, 2.4, m.slot.z - 0.5, "Reparada", "#9fd0ff"); n.target = null; backHome(n); }
      }
      break;
    }
    case "sec": {
      if (n.state === "bonk") { // batazo al ladrón: amague, golpe y guarda el bate
        const b = n.bonk; b.t += dt; p.api.idle(dt);
        if (b.c && !b.c.dead) faceTo(n, b.c.x, b.c.z);
        if (b.t >= BONK.guardSec) { n.bonk = null; if (p.bat) p.bat.visible = false; n.state = "patrol"; n.path = null; n.t = 1.2; }
        break;
      }
      if (n.state === "chase") {
        const th = n.thief;
        if (!th || th.dead || (th.state !== "thief_case" && th.state !== "thief_steal" && th.state !== "thief_go")) { n.thief = null; n.state = "patrol"; n.path = null; break; }
        n.t -= dt; if (n.t <= 0 || !n.path || !n.path.length) { n.t = 0.6; goTo(n, th.x, th.z); }
        stepAgent(n, dt, 4.6);
        if (dist2(n.x, n.z, th.x, th.z) < 1.1) { catchThief(th, n); n.thief = null; if (n.state !== "bonk") { n.state = "patrol"; n.path = null; n.t = 1.5; } }
        break;
      }
      if (n.state === "return") { if (stepAgent(n, dt, sp)) { n.state = "patrol"; n.t = 1; } break; }
      n.state = "patrol";
      if (n.path && n.path.length) { stepAgent(n, dt, sp); break; }
      p.api.idle(dt); n.t -= dt;
      if (n.t <= 0) {
        const pts = []; for (const z in PATROL) if (zoneOpen(z)) pts.push(...PATROL[z]);
        const q = pick(pts); goTo(n, q.x + rnd(-0.4, 0.4), q.z + rnd(-0.3, 0.3)); n.t = rnd(2, 4.5);
      }
      break;
    }
    case "cashier": {
      if (window.CasinoShop && window.CasinoShop.cashierTick(n, dt, sp)) break; // cobra en la caja registradora si hay fila (shop.js)
      if (n.state === "idle" || n.state === "return") {
        if (n.state === "return") { if (stepAgent(n, dt, sp)) n.state = "idle"; } else p.api.idle(dt);
        n.scan -= dt; if (n.scan > 0) break; n.scan = 0.7;
        const m = nextCashTarget(n);
        if (m) startCashTrip(n, m);
      } else if (n.state === "go") {
        const m = n.target;
        if (!m || m.dead || m.d.box <= 0) { if (m && m.claimCash === n) m.claimCash = null; n.target = null; cashNext(n); break; }
        if (stepAgent(n, dt, sp)) { n.state = "work"; n.t = n.taskSec = def.taskSec / (n.taskMul || 1); faceTo(n, m.slot.x, m.slot.z); m.api.setDoorOpen(true); }
      } else if (n.state === "work") {
        const m = n.target; p.api.play(dt);
        if (!m || m.dead) { setBar(p, null); n.target = null; cashNext(n); break; }
        n.t -= dt; setBar(p, 1 - n.t / (n.taskSec || def.taskSec));
        if (n.t <= 0) {
          const amt = Math.round(m.d.box); m.d.box = 0; n.carried += amt; n.count++;
          updateFill(m); refreshScreen(m); m.api.setDoorOpen(false); m.claimCash = null; setBar(p, null);
          if (amt > 0 && near(m.slot.x, m.slot.z, 12)) floatText(m.slot.x, 2.3, m.slot.z - 0.5, "Cajero " + fmt(amt), "#cfe8c0");
          setIcon(p, n.carried > 0 ? "cash" : null);
          n.target = null; cashNext(n);
        }
      } else if (n.state === "deposit_go") {
        if (stepAgent(n, dt, sp)) { n.state = "deposit"; n.t = 1.2; faceTo(n, SAFE.x, SAFE.z); }
      } else if (n.state === "deposit") {
        p.api.play(dt); n.t -= dt;
        if (n.t <= 0) { if (n.carried > 0) { Economy.add("deposits", n.carried); sfx("deposit", SAFE.win.x, SAFE.win.z, { quiet: true }); } n.carried = 0; n.count = 0; setIcon(p, null); backHome(n); }
      }
      break;
    }
    case "dealer": {
      if (n.state === "goTable") {
        const t = n.table; if (!t || t.dead) { n.table = null; backHome(n); break; }
        if (stepAgent(n, dt, sp)) { n.state = "deal"; placeAgent(n, t.dealerSpot.x, t.dealerSpot.z); p.group.rotation.y = t.dealerRot; }
      } else if (n.state === "deal") { p.api.play(dt); }
      else if (n.state === "return") { if (stepAgent(n, dt, sp)) n.state = "idle"; }
      else p.api.idle(dt);
      break;
    }
    case "waiter": {
      if (n.state === "idle" || n.state === "return") {
        if (n.state === "return") { if (stepAgent(n, dt, sp)) n.state = "idle"; } else p.api.idle(dt);
        if (!S.bar) break;
        n.scan -= dt; if (n.scan > 0) break; n.scan = 0.5;
        const c = customers.find(x => x.drink && x.drink.state === "want" && x.state === "play");
        if (c) { c.drink.state = "claimed"; c.drink.by = n; n.drinkFor = c; n.state = "pickup"; goTo(n, BAR.pickup.x, BAR.pickup.z); n.t = 0; }
      } else if (n.state === "pickup") {
        const c = n.drinkFor;
        if (!c || c.dead || !c.drink || c.drink.state !== "claimed") { n.drinkFor = null; p.tray.visible = false; backHome(n); break; }
        if (!n.path || !n.path.length) { n.t += dt; p.api.play(dt); if (n.t > 1) { p.tray.visible = true; n.state = "deliver"; goTo(n, c.x - 0.55, c.z - 0.45); } }
        else stepAgent(n, dt, sp);
      } else if (n.state === "deliver") {
        const c = n.drinkFor;
        if (!c || c.dead || !c.drink || c.drink.state !== "claimed" || c.state !== "play") { n.drinkFor = null; p.tray.visible = false; backHome(n); break; }
        if (stepAgent(n, dt, sp)) { n.state = "serve"; n.t = n.taskSec = def.taskSec / (n.taskMul || 1); faceTo(n, c.x, c.z); }
      } else if (n.state === "serve") {
        const c = n.drinkFor; p.api.play(dt); n.t -= dt; setBar(p, 1 - n.t / (n.taskSec || def.taskSec));
        if (!c || c.dead || !c.drink || c.drink.state !== "claimed") { setBar(p, null); p.tray.visible = false; n.drinkFor = null; backHome(n); break; }
        if (n.t <= 0) { serveDrink(c, n); setBar(p, null); p.tray.visible = false; n.drinkFor = null; backHome(n); }
      }
      break;
    }
    case "stock": { // repositor (shop.js)
      if (window.CasinoShop) window.CasinoShop.stockTick(n, dt, sp);
      else if (n.state === "return") { if (stepAgent(n, dt, sp)) n.state = "idle"; } else p.api.idle(dt);
      break;
    }
  }
}
function nextCashTarget(n) {
  const def = n.def; let best = null, bf = 0;
  for (const m of machines) {
    if (m.claimCash || m.dead || !zoneOpen(m.slot.zone)) continue;
    const f = boxFrac(m); if (f >= def.collectAt && f > bf) { bf = f; best = m; }
  }
  return best;
}
function startCashTrip(n, m) { m.claimCash = n; n.target = m; n.state = "go"; const o = spotOff(m.slot, -0.78, -0.7); goTo(n, o.x, o.z); }
function cashNext(n) {
  const m = n.count < n.def.depositEvery ? nextCashTarget(n) : null;
  if (m) { startCashTrip(n, m); return; }
  if (n.carried > 0) { n.state = "deposit_go"; goTo(n, SAFE.win.x + 0.35, SAFE.win.z); }
  else backHome(n);
}

// =====================================================================
// LADRONES
// =====================================================================
function thiefStart(c) {
  let best = null;
  for (const m of machines) if (zoneOpen(m.slot.zone) && (!best || m.d.box > best.d.box)) best = m;
  if (!best) { leaveCustomer(c); return; }
  c.target = best; c.state = "thief_go"; { const o = spotOff(best.slot, 0.78, -0.72); goTo(c, o.x, o.z); }
}
function updateThief(c, dt) {
  const m = c.target, p = c.person;
  if (!m || m.dead) { c.state = "flee"; const s = streetPoint(); goTo(c, s.x, s.z); setIcon(p, null); setBar(p, null); return; }
  if (c.state === "thief_go") {
    if (stepAgent(c, dt, c.speed)) {
      c.state = "thief_case"; c.timer = CASE_SEC; faceTo(c, m.slot.x, m.slot.z);
      const guards = staffNpcs.filter(n => n.role === "sec" && n.state !== "chase");
      c.noticed = S.staff.sec > 0 || (near(c.x, c.z, PLAYER_NOTICE_DIST) && Math.random() < CFG.playerCatch);
      if (guards.length && Math.random() < 1 - Math.pow(1 - Math.min(0.98, CFG.guardCatch + UPV("guardCatchAdd", 0)), guards.length)) {
        let g = guards[0], bd = Infinity; for (const x of guards) { const d = dist2(x.x, x.z, c.x, c.z); if (d < bd) { bd = d; g = x; } }
        g.state = "chase"; g.thief = c; g.t = 0; c.chasedBy = g;
      }
      if (c.noticed) { setIcon(p, "excl"); if (near(c.x, c.z, 14)) sfx("thief", c.x, c.z) || SFX.alarm(); hint("thief", `¡Un ladrón! Si ves el "!" rojo, miralo y ${KEY} para atraparlo. Los guardias también los atrapan.`); }
    }
    return;
  }
  p.api.play(dt);
  if (c.state === "thief_case") {
    c.timer -= dt;
    if (c.timer <= 0) {
      c.state = "thief_steal"; c.timer = D.THIEF.stealSec;
      if (!c.noticed && near(c.x, c.z, PLAYER_NOTICE_DIST) && Math.random() < CFG.playerCatch) { c.noticed = true; setIcon(p, "excl"); sfx("thief", c.x, c.z) || SFX.alarm(); }
    }
    return;
  }
  // robando
  const chased = c.chasedBy && !c.chasedBy.dead && c.chasedBy.state === "chase";
  c.timer -= dt; if (chased && c.timer < 0.5) c.timer = 0.5;
  if (c.noticed) setBar(p, 1 - c.timer / D.THIEF.stealSec);
  if (c.timer > 0) return;
  const amt = Math.round(m.d.box * CFG.thiefStealMax);
  m.d.box -= amt; updateFill(m); refreshScreen(m);
  setBar(p, null); setIcon(p, null);
  if (amt > 0) { S.today.st.thefts++; S.today.st.stolen += amt; toast(`¡Te robaron ${fmt(amt)} de la caja de una ${m.def.name}!`, "bad"); SFX.bad(); }
  else toast(`Un ladrón abrió una ${m.def.name} y se fue con las manos vacías: la caja estaba vacía.`, "");
  Heat.add(HEAT.thiefEscaped, "thief");
  c.state = "flee"; const s = streetPoint(); goTo(c, s.x, s.z);
}
function catchThief(c, guard) {
  if (c.state !== "thief_case" && c.state !== "thief_steal" && c.state !== "thief_go") return;
  S.today.st.caught++;
  window.CasinoChallenge?.ev?.("catch", guard ? "guard" : "player"); // logros (challenge.js)
  setBar(c.person, null); setIcon(c.person, "excl");
  if (!guard) { Rank.add(D.XP.catchThief); toast("¡Atrapaste al ladrón! Lo sacan del casino.", "good"); }
  else toast("Seguridad atrapó a un ladrón.", "good");
  sfx("caught", c.x, c.z) || SFX.coin();
  c.state = "caught";
  if (guard && guard.person && guard.person.bat && !guard.lifeTask) { // el guardia saca el bate: el ladrón queda mareado en el piso y después se va
    c.path = null; c.knock = { t: 0, hit: false, landed: false, dx: 0, dz: 0, stars: null };
    // mira al guardia, pero cae de espaldas hacia donde haya lugar (que no quede metido en una máquina o una pared)
    const base = Math.atan2(guard.x - c.x, guard.z - c.z); let yaw = base;
    for (const d of [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9, Math.PI]) {
      const y = base + d; if ([0.5, 1.0, 1.6].every(r => !blocked(c.x - Math.sin(y) * r, c.z - Math.cos(y) * r))) { yaw = y; break; }
    }
    c.person.group.rotation.y = yaw; c.person.api.face("surprised", BONK.hit + 0.3); c.person.api.stand();
    guard.state = "bonk"; guard.bonk = { c, t: 0 }; guard.path = null; faceTo(guard, c.x, c.z);
    guard.person.bat.visible = true; guard.person.api.gesture("swing", BONK.swingSec);
    return;
  }
  const s = streetPoint(); goTo(c, s.x, s.z);
}
// derribo cómico: amague del guardia -> ¡bonk! -> cae de espaldas -> estrellitas -> se levanta y se va sin nada
const BONK = { swingSec: 1.0, hit: 0.52, fall: 0.38, down: 5, rise: 0.7, guardSec: 1.7 };
const starPool = [];
function dizzyStars() {
  let g = starPool.pop();
  if (!g) {
    g = new THREE.Group();
    for (let i = 0; i < 3; i++) { const s = new THREE.Sprite(ICON_MATS.star); s.scale.set(0.16, 0.16, 1); g.add(s); }
    const halo = new THREE.Sprite(ICON_MATS.dizzy); halo.scale.set(0.42, 0.21, 1); g.add(halo);
  }
  g.visible = true; scene.add(g); return g;
}
function dropStars(k) { if (k && k.stars) { scene.remove(k.stars); starPool.push(k.stars); k.stars = null; } }
const _hv = new THREE.Vector3();
function updateKnock(c, dt) {
  const k = c.knock, p = c.person, g = p.group, T0 = BONK.hit, T1 = T0 + BONK.fall, T2 = T1 + BONK.down, T3 = T2 + BONK.rise;
  k.t += dt;
  if (k.t < T0) { p.api.idle(dt); return; }
  if (!k.hit) { // el golpe
    k.hit = true; sfx("punch", c.x, c.z) || SFX.tick(); floatText(c.x, 2.3, c.z, "¡BONK!", "#ffd45a"); setIcon(p, null);
    const yaw = g.rotation.y; k.dx = -Math.sin(yaw) * 0.3; k.dz = -Math.cos(yaw) * 0.3; // sale despedido hacia atrás
  }
  let u;
  if (k.t < T1) { u = (k.t - T0) / BONK.fall; u = u * u; p.api.face("surprised", 0.5); p.api.idle(dt); }
  else if (k.t < T2) {
    u = 1; if (!k.landed) { k.landed = true; sfx("thud", c.x, c.z); k.stars = dizzyStars(); }
    p.api.knocked(dt); p.api.face("dizzy", 0.5);
    u += Math.max(0, 0.06 * Math.sin((k.t - T1) * 18) * Math.exp(-(k.t - T1) * 5)); // rebote al caer
  } else if (k.t < T3) { u = 1 - (k.t - T2) / BONK.rise; u = 1 - (1 - u) * (1 - u); dropStars(k); p.api.face("sad", 2); p.api.idle(dt); }
  else { // se levanta y se va, con las manos vacías
    dropStars(k); c.knock = null; g.rotation.x = 0; g.position.set(c.x, 0, c.z); p.api.stand(); p.api.face("sad", 30);
    const s = streetPoint(); goTo(c, s.x, s.z); return;
  }
  const f = Math.min(1, (k.t - T0) / BONK.fall);
  g.rotation.x = -Math.PI / 2 * Math.min(1.04, u);
  g.position.set(c.x + k.dx * f, 0.11 * Math.min(1, u), c.z + k.dz * f);
  if (k.stars) {
    p.api.joints.head.getWorldPosition(_hv); k.stars.position.set(_hv.x, _hv.y + 0.3, _hv.z);
    const a = k.t * 5; k.stars.children.forEach((s, i) => { if (i < 3) s.position.set(Math.cos(a + i * 2.09) * 0.22, Math.sin(a * 2 + i) * 0.03, Math.sin(a + i * 2.09) * 0.22); });
  }
}

// =====================================================================
// INSPECTOR DE LOTERÍA
// =====================================================================
let inspector = null;
function startInspection(reason) {
  if (inspector) return;
  const p = acquirePerson("inspector", 0);
  const a = { kind: "inspector", person: p, x: 0, z: -15, state: "enter", path: null, t: 0, timeLeft: D.INSPECTOR.visitHours * HOUR,
    visits: machines.filter(m => zoneOpen(m.slot.zone)).map(m => m).sort(() => Math.random() - 0.5), fines: 0, found: 0, failMul: 1, bribeTried: false, bribed: false };
  p.agent = a; placeAgent(a, 0, -15); goTo(a, 0, -7.4); setIcon(p, "insp");
  a.interact = {
    prompt: () => ({ text: D.INSPECTOR.name, sub: a.bribeTried ? "Ya intentaste coimearlo" : `Revisa las máquinas · ${KEY}: ofrecer una coima` }),
    usable: () => !a.bribeTried && a.state !== "leave", use: () => openBribePanel(),
  };
  inspector = a; S.today.inspected = true;
  toast(`¡Llegó el ${D.INSPECTOR.name}! (${reason}) Revisa las máquinas durante ${D.INSPECTOR.visitHours} horas.`, "bad"); sfx("inspector") || SFX.alarm();
  hint("insp", `El inspector descubre las máquinas en pago Trucha. Si tenés alguna, podés arriesgar una coima (miralo y ${KEY}).`);
}
function updateInspector(dt) {
  const a = inspector; if (!a) return;
  const p = a.person;
  if (a.state !== "enter" && a.state !== "leave") a.timeLeft -= dt;
  switch (a.state) {
    case "enter": if (stepAgent(a, dt, D.INSPECTOR.speed)) a.state = "next"; break;
    case "next": {
      let m = null; while (a.visits.length && !m) { const x = a.visits.shift(); if (!x.dead) m = x; }
      if (!m || a.timeLeft <= 0) { finishInspection(); break; }
      a.target = m; a.state = "go"; { const o = spotOff(m.slot, -0.75, -1.35); goTo(a, o.x, o.z); } break;
    }
    case "go": if (stepAgent(a, dt, D.INSPECTOR.speed)) { a.state = "look"; a.t = INSPECT_LOOK_SEC; faceTo(a, a.target.slot.x, a.target.slot.z); } break;
    case "look":
      p.api.idle(dt); a.t -= dt;
      if (a.t <= 0) { if (!a.target.dead) inspectMachine(a, a.target); a.state = "next"; }
      break;
    case "leave": if (stepAgent(a, dt, D.INSPECTOR.speed * 1.2)) { releasePerson(p); inspector = null; } break;
  }
}
function inspectMachine(a, m) {
  const set = RTPD(m.d.rtp);
  if (set.legal) return;
  if (Math.random() >= HEAT.detectChance(S.heat)) return;
  const fine = HEAT.finePerRigged(m.def) * a.failMul;
  Economy.force("fines", fine); S.today.st.fines += fine; a.fines += fine; a.found++;
  m.d.rtp = "estandar"; Rep.change(HEAT.fineRep);
  toast(`El inspector descubrió una ${m.def.name} trucha: multa de ${fmt(fine)}. Vuelve a pago Estándar.`, "bad"); SFX.bad();
  floatText(m.slot.x, 2.4, m.slot.z - 0.5, "-" + fmt(fine), "#ff6a5a");
  Heat.add(HEAT.fineHeat, "fine");
}
function finishInspection() {
  const a = inspector; if (!a) return;
  if (!a.fines && !a.bribed) { Rank.add(D.XP.passInspection); toast("La inspección terminó sin multas. +XP por casino limpio.", "good"); }
  else if (a.fines) toast(`La inspección terminó. Multas: ${fmt(a.fines)}.`, "bad");
  a.state = "leave"; setIcon(a.person, null); goTo(a, 0, -15.6);
}
function bribeInspector() {
  const a = inspector; if (!a || a.bribeTried) return;
  const cost = HEAT.bribeCost(S.heat);
  if (!Economy.trySpend("bribes", cost)) return;
  a.bribeTried = true;
  if (Math.random() < HEAT.bribeSuccess(S.heat)) {
    a.bribed = true; Heat.add(HEAT.bribeOkHeat, "bribe");
    toast(`El inspector aceptó los ${fmt(cost)} y se fue sin mirar nada.`, "good");
    a.state = "leave"; setIcon(a.person, null); goTo(a, 0, -15.6);
  } else {
    a.failMul = HEAT.bribeFailFineMul; a.timeLeft += HOUR;
    toast("¡El inspector rechazó la coima! Ahora revisa todo y las multas son dobles.", "bad"); SFX.bad();
    a.visits = machines.filter(m => zoneOpen(m.slot.zone) && !RTPD(m.d.rtp).legal).concat(a.visits);
    Heat.add(HEAT.bribeFailHeat, "bribe");
  }
}

// =====================================================================
// DÍA Y CIERRE
// =====================================================================
let isOpen = false, lastHour = -1;
function shouldBeOpen() { const h = S.minutes / 60; return !S.dayOver && !S.closedToday && !S.gameOver && h >= CFG.open && h < CFG.close; }
function updateOpen(silent) {
  const open = shouldBeOpen();
  if (open === isOpen) return;
  isOpen = open;
  if (open) onOpen(silent); else if (!silent) onClose();
}
function onOpen(silent) {
  if (!silent) { toast("¡El casino abrió sus puertas!", "good"); sfx("open") || SFX.coin(); }
  spawnTimer = 1.5;
  if (!S.today.inspected) {
    const routine = S.day % HEAT.routineEvery === 0;
    if (routine || Math.random() < HEAT.inspectionChance(S.heat) * UPV("inspectMul", 1)) startInspection(routine ? "inspección de rutina" : "alguien hizo una denuncia");
    else S.today.inspected = true;
  }
}
function onClose() {
  sfx("close");
  toast(S.closedToday ? "El casino quedó cerrado." : "El casino cerró por hoy. Hacé caja antes de medianoche.", "");
  if (inspector && inspector.state !== "leave") finishInspection();
}
function onHour(h) {
  updateOpen();
  if (isOpen) {
    let broken = 0; for (const m of machines) if (m.d.broken) broken++;
    if (broken) Rep.change(CFG.repBrokenPerHour * broken);
    for (const t of tables) if (dealerHere(t)) Rep.change(t.def.rep);
  }
  if (h === CFG.close - 2 && S.day + 1 >= S.licenseDue) toast(`Mañana a medianoche vence la licencia: ${fmt(licenseFee())}. Tené la plata en el banco.`, "bad");
  if (h === CFG.close - 2 && S.day >= S.licenseDue) toast(`Hoy a medianoche se paga la licencia: ${fmt(licenseFee())}.`, "bad");
  if (h >= CFG.dayStart) save(true);
}

// objetivos diarios -------------------------------------------------------------
const objDef = id => byKey(D.OBJECTIVES, "id", id);
const objIsEnd = o => o.stat === "repEnd" || o.stat === "heatEnd" || o.cmp === "<=" || o.cmp === "<";
const objMet = (o, v) => o.cmp === "<=" ? v <= o.goal : o.cmp === "<" ? v < o.goal : v >= o.goal;
function objValue(o) { return o.stat === "repEnd" ? Math.round(S.rep) : o.stat === "heatEnd" ? Math.round(S.heat) : (S.today.st[o.stat] || 0); }
function rollObjectives() {
  let pool = D.OBJECTIVES.filter(o => S.rank >= o.rank && S.rank <= o.maxRank);
  if (S.day === 1) { const first = ["collect5", "serve20", "net500"].map(objDef).filter(Boolean); if (first.length === 3) pool = first; }
  pool = pool.slice().sort(() => Math.random() - 0.5);
  const out = [], stats = new Set();
  for (const o of pool) { if (out.length >= D.OBJECTIVES_PER_DAY) break; if (stats.has(o.stat)) continue; stats.add(o.stat); out.push({ id: o.id, done: false }); }
  S.objectives = out;
}
function checkObjectives(atClose) {
  if (!S || S.dayOver && !atClose) return;
  for (const so of S.objectives) {
    if (so.done) continue;
    const o = objDef(so.id); if (!o) continue;
    if (objIsEnd(o) && !atClose) continue;
    if (atClose && S.closedToday && o.stat !== "heatEnd") continue;
    if (objMet(o, objValue(o))) {
      so.done = true; Rank.add(o.xp, true); if (o.cash) Economy.add("objectives", o.cash);
      toast(`Objetivo cumplido: ${o.text} (+${o.xp} XP${o.cash ? ", +" + fmt(o.cash) : ""})`, "xp"); if (!sfx("goal")) { beep(1046, 0.12, "triangle", 0.04); beep(1568, 0.2, "triangle", 0.04, 0.1); }
      if (atClose) S.today.notes.push(`Objetivo cumplido: ${o.text}.`);
    }
  }
}

// préstamos -------------------------------------------------------------------
function takeLoan(id) {
  const L = LOAN(id); if (!L) return false;
  if (window.CasinoChallenge?.noLoans?.()) { toast("En el modo Difícil sin préstamos el banco no te presta ni un peso.", "bad"); SFX.bad(); return false; }
  if (S.loan) { toast("Ya tenés un préstamo. Pagalo antes de pedir otro.", "bad"); return false; }
  if (S.rank < L.rank) { toast(`Necesitás rango ${L.rank}.`, "bad"); return false; }
  const owed = Math.round(L.amount * (1 + L.interest * UPV("loanInterestMul", 1)));
  S.loan = { id, owed, daysLeft: L.days, perDay: Math.ceil(owed / L.days), missed: 0 };
  Economy.add("loan", L.amount); SFX.cash();
  toast(`Recibiste ${fmt(L.amount)}. Devolvés ${fmt(owed)} en ${L.days} cuotas de ${fmt(S.loan.perDay)}.`, "good");
  save(true); return true;
}
function payLoanOff() {
  if (!S.loan) return;
  if (Economy.trySpend("loanPay", S.loan.owed)) { S.loan = null; toast("¡Préstamo cancelado por completo!", "good"); save(true); }
}
function loanInstallment(notes) {
  const ln = S.loan; if (!ln) return;
  const L = LOAN(ln.id) || { name: "Préstamo" }, R = D.LOAN_RULES;
  const pay = Math.min(ln.perDay, ln.owed);
  if (S.bank >= pay) {
    Economy.force("loanPay", pay); ln.owed -= pay; ln.daysLeft = Math.max(0, ln.daysLeft - 1); ln.missed = 0;
    if (ln.owed <= 0) { S.loan = null; notes.push(`¡${L.name}: saldado!`); return; }
    notes.push(`Cuota de ${L.name}: ${fmt(pay)}. Debés ${fmt(ln.owed)}.`);
  } else {
    ln.missed++; const pen = Math.round(ln.owed * R.missedPenalty); ln.owed += pen;
    notes.push(`No pudiste pagar la cuota de ${L.name}: +${fmt(pen)} de recargo (${ln.missed}/${R.missedToSeize}).`);
    if (L.shady) { Heat.add(HEAT.loanMissed, "loan"); notes.push("El Tano está enojado: +calor."); }
    if (ln.missed >= R.missedToSeize) seizeGame(notes);
  }
  if (S.loan) S.loan.perDay = Math.ceil(S.loan.owed / Math.max(1, S.loan.daysLeft));
}
function seizeGame(notes) {
  let best = null, price = -1;
  for (const m of machines) if (m.def.price > price) { price = m.def.price; best = { m }; }
  for (const t of tables) if (t.def.price > price) { price = t.def.price; best = { t }; }
  const ln = S.loan; ln.missed = 0;
  if (!best) return;
  const name = best.m ? best.m.def.name : best.t.def.name, credit = Math.round(price * CFG.sellRefund);
  if (best.m) { S.machines.splice(S.machines.indexOf(best.m.d), 1); despawnMachine(best.m); }
  else { settleTray(best.t); S.tables.splice(S.tables.indexOf(best.t.d), 1); despawnTable(best.t); assignDealers(); }
  ln.owed -= credit; if (ln.owed <= 0) S.loan = null;
  notes.push(`EMBARGO: el banco se llevó tu ${name} y te descontó ${fmt(credit)} de la deuda.`);
}

// clausura y fin --------------------------------------------------------------
function closure() {
  if (S.gameOver) return;
  S.closures++;
  Economy.force("fines", HEAT.closureFine); S.today.st.fines += HEAT.closureFine;
  S.heat = HEAT.closureHeatAfter; S.closedDays = HEAT.closureDays;
  const msg = `CLAUSURA: la Lotería cerró el casino ${HEAT.closureDays} días y te multó con ${fmt(HEAT.closureFine)} (${S.closures}/${HEAT.closuresToLose}).`;
  S.today.notes.push(msg); toast(msg, "bad"); SFX.alarm();
  if (S.closures >= HEAT.closuresToLose) S.gameOver = "Tercera clausura por calor: la Lotería te quitó la licencia para siempre.";
  if (!S.dayOver) {
    S.closedToday = true; updateOpen();
    if (S.gameOver) endDay();
  }
}
function endDay() {
  if (S.dayOver) return;
  S.dayOver = true; isOpen = false;
  for (const c of customers.slice()) despawnCustomer(c);
  customers.length = 0;
  if (inspector) { releasePerson(inspector.person); inspector = null; }
  for (const t of tables) t.playerDealing = false;
  player.drink = false;
  const T = S.today, st = T.st, notes = T.notes;
  const pk = Pocket.deposit(); if (pk > 0) notes.push(`Lo que tenías en el bolsillo (${fmt(pk)}) quedó en la caja fuerte.`);
  for (const n of staffNpcs) {
    if (n.carried > 0) { Economy.add("deposits", n.carried); n.carried = 0; n.count = 0; }
    if (n.role === "dealer") continue;
    releaseNpcTask(n); const h = idleOf(n); placeAgent(n, h.x, h.z); n.state = n.role === "sec" ? "patrol" : "idle"; n.path = null; n.person.api.stand();
  }
  assignDealers();
  for (const t of tables) settleTray(t);
  const util = utilitiesTotal(); if (util) Economy.force("utilities", util);
  const w = wagesTotal(); if (w) Economy.force("wages", w);
  loanInstallment(notes);
  if (S.day >= S.licenseDue) {
    const fee = licenseFee();
    if (Economy.trySpend("license", fee, true)) { S.licenseMissed = 0; S.licenseDue = S.day + CFG.licenseEvery; notes.push(`Pagaste la licencia (${fmt(fee)}). Próximo vencimiento: día ${S.licenseDue}.`); }
    else { S.licenseMissed++; S.licenseDue = S.day + 1; Rep.change(-5); Heat.add(CFG.licenseLateHeat, "license"); notes.push(`¡No pudiste pagar la licencia de ${fmt(fee)}! Aviso ${S.licenseMissed}/${CFG.licenseMaxMiss}. Se reintenta mañana.`); }
  }
  let heatGain = 0; for (const d of S.machines) heatGain += RTPD(d.rtp).heatPerDay;
  if (heatGain > 0) Heat.add(heatGain, "rigged");
  Heat.add(-(HEAT.decayPerDay + UPV("heatDecayAdd", 0) + (S.staff.sec || 0) * Math.abs(SDEF("sec").heatPerDay || 0)));
  addNet();
  if (st.net > 0) Rank.add(Math.floor(st.net * CFG.xpPerProfit), true);
  if (!S.closedToday && st.visitors > 0 && st.thefts === 0 && !machines.some(m => m.d.broken)) { Rank.add(D.XP.cleanDay, true); notes.push("Día limpio: sin robos ni máquinas rotas al cierre."); }
  checkObjectives(true);
  if (window.CasinoLife) window.CasinoLife.onEndDay(notes); // eventos de la noche (life.js)
  if (window.CasinoOwner) window.CasinoOwner.onEndDay(notes); // publicidad, seguro y robos (owner.js)
  if (window.CasinoShop) window.CasinoShop.onEndDay(notes); // camión de última hora y resumen del kiosco (shop.js)
  if (window.CasinoWorld) window.CasinoWorld.onEndDay(notes); // hotel, clima y favores (world.js)
  if (window.CasinoGames) window.CasinoGames.onEndDay(notes); // resumen de dados, bingo y carreras (games.js)
  window.CasinoStory?.onEndDay?.(notes); // misiones de la historia (story.js)
  window.CasinoClients?.onEndDay?.(notes); // socios y torneo de póker (clients.js)
  S.totals.days++; S.totals.net += st.net;
  T.end = S.bank; T.heatEnd = S.heat; T.repEnd = S.rep;
  S.negDays = S.bank < 0 ? S.negDays + 1 : 0;
  if (!S.gameOver) {
    if (S.negDays >= CFG.negDaysMax) S.gameOver = `Cerraste ${CFG.negDaysMax} días seguidos con el banco en rojo. El banco se quedó con el casino.`;
    else if (S.licenseMissed >= CFG.licenseMaxMiss) S.gameOver = "No pagaste la licencia dos veces seguidas y te la quitaron. El casino quedó clausurado.";
    else if (S.bank < 0) notes.push(`Estás en rojo: ${S.negDays}/${CFG.negDaysMax} cierres seguidos y perdés el casino.`);
  }
  window.CasinoChallenge?.onEndDay?.(notes); // desafío, récords y ranking semanal (challenge.js)
  save(true);
  showReport();
}
function nextDay() {
  if (S.gameOver || !S.dayOver) return;
  S.day++; S.minutes = CFG.dayStart * 60; S.dayOver = false; lastHour = -1; isOpen = false;
  S.closedToday = false; if (S.closedDays > 0) { S.closedToday = true; S.closedDays--; }
  S.today = newToday(S.day, S.bank, S.rep, S.heat);
  S.today.promo = rivalOpen() && isPromoDay(S.day);
  rollObjectives();
  if (S.closedToday) toast(`Clausura: hoy el casino no abre (${S.closedDays} días más después de hoy).`, "bad");
  if (S.today.promo) toast(`${RIVAL.name} hace una promo hoy: vas a tener menos clientes.`, "bad");
  if (S.day === RIVAL.opensDay - 1 && !S.rivalBought) toast(`Mañana abre ${RIVAL.name} enfrente. Va a competir por tus clientes: subí el atractivo.`, "bad");
  if (S.day === RIVAL.opensDay && !S.rivalBought) toast(`Hoy abrió ${RIVAL.name} enfrente. Mirá su atractivo en el panel.`, "bad");
  if (S.licenseDue - S.day <= 1) toast(`La licencia (${fmt(licenseFee())}) se paga ${S.licenseDue === S.day ? "esta" : "mañana a la"} medianoche.`, "bad");
  rival.update();
  if (window.CasinoOwner) window.CasinoOwner.onNextDay(); // campañas, seguro y avisos de robo (owner.js)
  save(true);
}
function buyRival() {
  if (S.rank < D.RANKS.length || !rivalOpen()) return;
  if (!Economy.trySpend("purchases", buyoutPrice())) return;
  S.rivalBought = true; S.victory = true; rival.update(); save(true);
  showVictory();
}

// =====================================================================
// GUARDADO (en este navegador)
// =====================================================================
let booted = false;
function serialize() { return JSON.stringify(S); }
function save(quiet) {
  if (!booted || !S) return;
  try { localStorage.setItem(SAVE_KEY, serialize()); if (!quiet) toast("Partida guardada en este navegador.", "good"); }
  catch (e) { if (!quiet) toast("No se pudo guardar en este navegador.", "bad"); }
}
function readSaveRaw() { try { return localStorage.getItem(SAVE_KEY); } catch (e) { return null; } }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* nada */ } }
// valida todo lo que viene del guardado: nunca más $NaN
function sanitize(text) {
  if (!text) return null;
  let raw; try { raw = JSON.parse(text); } catch (e) { return { corrupt: true }; }
  if (!raw || typeof raw !== "object" || raw.v !== 2) return { corrupt: true };
  const isNum = v => typeof v === "number" && Number.isFinite(v);
  for (const k of ["bank", "pocket", "xp", "rep", "heat", "day", "minutes"]) if (!isNum(raw[k])) return { corrupt: true };
  const s = freshState(raw.difficulty, raw.mode); // partidas viejas sin modo: Historia
  const int = (v, d, lo, hi) => isNum(v) ? clamp(Math.round(v), lo, hi) : d;
  s.bank = Math.round(raw.bank); s.pocket = clamp(Math.round(raw.pocket), 0, 1e9);
  s.xp = Math.max(0, Math.round(raw.xp)); s.rank = Rank.fromXp(s.xp);
  s.rep = clamp(raw.rep, 0, 100); s.heat = clamp(raw.heat, 0, HEAT.max);
  s.day = Math.max(1, Math.floor(raw.day)); s.minutes = clamp(raw.minutes, CFG.dayStart * 60, CFG.dayEnd * 60);
  s.speed = [1, 2, 4].includes(raw.speed) ? raw.speed : 1;
  s.dayOver = !!raw.dayOver;
  s.negDays = int(raw.negDays, 0, 0, 99); s.licenseDue = int(raw.licenseDue, s.day + CFG.licenseEvery, 1, 1e6);
  s.licenseMissed = int(raw.licenseMissed, 0, 0, 9); s.closures = int(raw.closures, 0, 0, 9); s.closedDays = int(raw.closedDays, 0, 0, 9);
  s.closedToday = !!raw.closedToday;
  if (raw.loyalty && typeof raw.loyalty === "object") for (const k in s.loyalty) s.loyalty[k] = isNum(raw.loyalty[k]) ? clamp(raw.loyalty[k], 0, CFG.loyaltyMax) : 0;
  const L = raw.loan;
  if (L && typeof L === "object" && LOAN(L.id) && isNum(L.owed) && L.owed > 0) s.loan = { id: L.id, owed: Math.round(L.owed), daysLeft: int(L.daysLeft, 1, 0, 99), perDay: Math.max(1, int(L.perDay, 1, 1, 1e7)), missed: int(L.missed, 0, 0, 9) };
  if (raw.zones && typeof raw.zones === "object") { s.zones.este = !!raw.zones.este; s.zones.oeste = !!raw.zones.oeste; }
  const used = new Set();
  s.machines = (Array.isArray(raw.machines) ? raw.machines : []).filter(d => d && MACH(d.type) && spotById[d.slot] && spotById[d.slot].kind === "slot" && !used.has(d.slot) && used.add(d.slot))
    .map(d => ({ slot: d.slot, type: d.type, box: isNum(d.box) ? clamp(Math.round(d.box), 0, MACH(d.type).cap * 2) : 0, rtp: byKey(D.RTP_SETTINGS, "id", d.rtp) ? d.rtp : "estandar", broken: !!d.broken }))
    .filter(d => s.zones[spotById[d.slot].zone]);
  s.tables = (Array.isArray(raw.tables) ? raw.tables : []).filter(d => d && TDEF(d.type) && spotById[d.spot] && spotById[d.spot].kind === "tspot" && !used.has(d.spot) && used.add(d.spot))
    .map(d => ({ spot: d.spot, type: d.type, tray: isNum(d.tray) ? Math.round(d.tray) : 0 })).filter(d => s.zones[spotById[d.spot].zone]);
  s.decor = (Array.isArray(raw.decor) ? raw.decor : []).filter(d => d && DECO(d.id) && !DECO(d.id).unique && spotById[d.spot] && spotById[d.spot].kind === "dspot" && !used.has(d.spot) && used.add(d.spot))
    .map(d => ({ spot: d.spot, id: d.id })).filter(d => s.zones[spotById[d.spot].zone]);
  if (window.CasinoBuild) window.CasinoBuild.sanitizePlaced(raw, s); // v3: objetos ubicados libremente (y migración de lugares fijos)
  s.bar = !!raw.bar;
  if (raw.staff && typeof raw.staff === "object") for (const st of D.STAFF) s.staff[st.role] = int(raw.staff[st.role], 0, 0, 30);
  s.crew = Array.isArray(raw.crew) ? raw.crew.slice(0, 120) : []; // fichas de empleados: staff.js las valida al cargar (puede cargarse después que el guardado); partidas viejas reciben nombre, rango y eficiencia por defecto
  if (window.CasinoStaff) window.CasinoStaff.sanitize(raw, s);
  s.objectives = (Array.isArray(raw.objectives) ? raw.objectives : []).filter(o => o && objDef(o.id)).slice(0, D.OBJECTIVES_PER_DAY).map(o => ({ id: o.id, done: !!o.done }));
  s.jackpotPool = isNum(raw.jackpotPool) && JACKPOT_DEF ? Math.max(JACKPOT_DEF.jackpotSeed, raw.jackpotPool) : s.jackpotPool;
  s.rivalBought = !!raw.rivalBought; s.victory = !!raw.victory;
  s.gameOver = typeof raw.gameOver === "string" && raw.gameOver ? raw.gameOver.slice(0, 300) : null;
  if (raw.hints && typeof raw.hints === "object") for (const k in raw.hints) if (raw.hints[k]) s.hints[k] = 1;
  if (raw.totals && typeof raw.totals === "object") for (const k in s.totals) s.totals[k] = isNum(raw.totals[k]) ? raw.totals[k] : 0;
  const T = raw.today, t = newToday(s.day, s.bank, s.rep, s.heat);
  if (T && typeof T === "object" && T.st && typeof T.st === "object" && T.day === s.day) {
    for (const k in t.st) if (isNum(T.st[k])) t.st[k] = T.st[k];
    for (const side of ["inc", "exp"]) if (T[side] && typeof T[side] === "object") for (const k in T[side]) if (isNum(T[side][k]) && CAT_LABEL[k]) t[side][k] = T[side][k];
    if (isNum(T.start)) t.start = Math.round(T.start); if (isNum(T.end)) t.end = Math.round(T.end);
    if (isNum(T.heatStart)) t.heatStart = T.heatStart; if (isNum(T.repStart)) t.repStart = T.repStart;
    if (isNum(T.heatEnd)) t.heatEnd = T.heatEnd; if (isNum(T.repEnd)) t.repEnd = T.repEnd;
    t.promo = !!T.promo; t.inspected = !!T.inspected;
    if (Array.isArray(T.notes)) t.notes = T.notes.filter(n => typeof n === "string").slice(0, 30);
  }
  s.today = t;
  if (raw.story && typeof raw.story === "object") s.story = raw.story; // historia: story.js la valida
  if (raw.owner && typeof raw.owner === "object") s.owner = raw.owner; // imagen, publicidad, seguro y seguridad: owner.js lo valida campo por campo
  if (raw.games && typeof raw.games === "object" && !Array.isArray(raw.games)) s.games = raw.games; // dados, bingo y carreras: games.js lo valida campo por campo
  if (raw.shop && typeof raw.shop === "object") s.shop = raw.shop; // tienda, licencias y mejoras: shop.js lo valida campo por campo
  if (raw.challenge && typeof raw.challenge === "object") s.challenge = raw.challenge; // modos, récords y ranking semanal: challenge.js lo valida
  if (raw.world && typeof raw.world === "object") s.world = raw.world; // clima, hotel y favores: world.js lo valida campo por campo
  if (raw.clients && typeof raw.clients === "object") s.clients = raw.clients; // socios y torneo: clients.js lo valida campo por campo
  if (raw.combat && typeof raw.combat === "object" && !Array.isArray(raw.combat)) s.combat = raw.combat; // armas, daños y la Mafia: combat.js lo valida campo por campo
  if (raw.life && typeof raw.life === "object") s.life = { day: int(raw.life.day, 0, 0, 1e6), fired: int(raw.life.fired, 0, 0, 9) }; // eventos ya ocurridos hoy (life.js)
  return { state: s };
}
function clearWorld() {
  for (const c of customers.slice()) despawnCustomer(c); customers.length = 0;
  if (inspector) { releasePerson(inspector.person); inspector = null; }
  for (const m of machines.slice()) despawnMachine(m);
  for (const t of tables.slice()) despawnTable(t);
  for (const o of decorObjs.slice()) despawnDecor(o);
  for (const n of staffNpcs.slice()) { releaseNpcTask(n); releasePerson(n.person); n.dead = true; }
  staffNpcs.length = 0;
}
function loadState(s, diffId, modeId) {
  if (S) clearWorld();
  toastQ.length = 0; hintQ.length = 0; window.CasinoJuice?.reset();
  S = s || freshState(diffId, modeId);
  if (window.CasinoBuild) window.CasinoBuild.beforeLoad(S); // v3: lugares dinámicos
  applyZones(); placeBar(S.bar);
  for (const d of S.machines) spawnMachine(d);
  for (const d of S.tables) spawnTable(d);
  for (const d of S.decor) spawnDecor(d);
  syncStaff(false);
  for (const n of staffNpcs) if (n.role === "dealer" && n.table) { n.state = "deal"; placeAgent(n, n.table.dealerSpot.x, n.table.dealerSpot.z); n.person.group.rotation.y = n.table.dealerRot; }
  if (!S.objectives.length) rollObjectives();
  resetPlayer();
  isOpen = false; lastHour = -1; spawnTimer = 2; pendingRanks.length = 0;
  setSpeed(S.speed || 1); rival.update();
  window.CasinoChallenge?.onLoad?.(S, !s); // modos de juego (challenge.js)
  updateHud(true);
}

// =====================================================================
// JUGADOR
// =====================================================================
const player = { x: 0, z: -7, yaw: Math.PI, pitch: 0, r: 0.35, drink: false };
function resetPlayer() { player.x = 0; player.z = -7; player.yaw = Math.PI; player.pitch = 0; player.drink = false; }
function near(x, z, d) { return dist2(player.x, player.z, x, z) < d; }
const keys = {};
const stick = { x: 0, y: 0 };
function blocked(x, z, ignore) {
  if (x < -32 || x > 32 || z > 12 || z < -25) return true;
  for (const c of colliders) if (c.on() && !(ignore && ignore.has(c)) && contains(c, x, z, player.r)) return true;
  return false;
}
function insideSet() { const s = new Set(); for (const c of colliders) if (c.on() && contains(c, player.x, player.z, player.r)) s.add(c); return s; }
// si algo quedó encima del jugador (comprar parado sobre el cuadro), lo corremos a un lugar libre
function unstickPlayer(fx, fz) {
  if (!blocked(player.x, player.z)) return;
  const tries = [[fx, fz]];
  for (let r = 0.8; r <= 4; r += 0.4) for (let a = 0; a < 12; a++) tries.push([player.x + Math.cos(a / 12 * Math.PI * 2) * r, player.z + Math.sin(a / 12 * Math.PI * 2) * r]);
  for (const [x, z] of tries) if (!blocked(x, z)) { player.x = x; player.z = z; return; }
}
const glass = new THREE.Group();
{ const g1 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.025, 0.11, 10), glassMat); glass.add(g1);
  const st = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.08, 6), A.materials.chrome); st.position.y = -0.09; glass.add(st);
  const ft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 10), A.materials.chrome); ft.position.y = -0.13; glass.add(ft);
  glass.position.set(0.2, -0.2, -0.42); glass.visible = false; camera.add(glass); }
const bob = { ph: 0, amt: 0 };
function updatePlayer(dt) {
  let f = 0, s = 0;
  if (keys.KeyW || keys.ArrowUp) f += 1; if (keys.KeyS || keys.ArrowDown) f -= 1;
  if (keys.KeyD || keys.ArrowRight) s += 1; if (keys.KeyA || keys.ArrowLeft) s -= 1;
  f += -stick.y; s += stick.x; if (ui.mg || (window.CasinoCombat && window.CasinoCombat.ko())) f = s = 0; // noqueado: no te movés (combat.js)
  const len = Math.hypot(f, s); if (len > 1) { f /= len; s /= len; }
  const speed = ((keys.ShiftLeft || keys.ShiftRight) ? 6.5 : 3.9) * (window.CasinoShop ? window.CasinoShop.speedMul() : 1); // una caja pesada te frena (shop.js)
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw), rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
  const dx = (fx * f + rx * s) * speed * dt, dz = (fz * f + rz * s) * speed * dt;
  const ox = player.x, oz = player.z;
  if (dx || dz) {
    const ign = insideSet();
    if (!blocked(player.x + dx, player.z, ign)) player.x += dx;
    if (!blocked(player.x, player.z + dz, ign)) player.z += dz;
  }
  // balanceo de cámara al caminar (sutil y opcional): sigue la distancia recorrida de verdad, sin demorar la vista
  const moved = Math.hypot(player.x - ox, player.z - oz), mv = dt > 0 ? Math.min(1, moved / dt / 3.9) : 0;
  bob.amt += ((gfx.bob ? mv : 0) - bob.amt) * Math.min(1, dt * 8); bob.ph += moved * 2.35;
  const by = Math.sin(bob.ph * 2) * 0.024 * bob.amt, br = Math.sin(bob.ph) * 0.0035 * bob.amt;
  camera.position.set(player.x, 1.65 + by - 0.008 * bob.amt, player.z);
  camera.rotation.set(player.pitch, player.yaw, br);
  for (const t of tables) {
    const was = t.playerDealing;
    t.playerDealing = !t.staff && !t.def.noDealer && dist2(player.x, player.z, t.playerSpot.x, t.playerSpot.z) < 0.75;
    if (t.playerDealing && !was) toast(`Estás repartiendo en la ${t.def.name}.`, "good");
  }
  glass.visible = player.drink;
}
function look(dx, dy, k) { if (window.CasinoCombat && window.CasinoCombat.ko()) return; player.yaw -= dx * k; player.pitch = clamp(player.pitch - dy * k, -1.45, 1.45); }

// interacción: rayo desde el centro de la pantalla -------------------------------
const ray = new THREE.Raycaster(); ray.far = RANGE;
let target = null, lastPrompt = "";
const promptEl = $("prompt"), holdEl = $("hold"), optBtn = $("optBtn");
const shownObj = o => { while (o) { if (!o.visible) return false; o = o.parent; } return true; };
function updateTarget() {
  if (ui.blocking()) { target = null; promptEl.hidden = true; optBtn.hidden = true; return; }
  ray.setFromCamera({ x: 0, y: 0 }, camera);
  const objs = pickables.filter(shownObj);
  // una persona sin acción no tapa la máquina que tiene atrás (cliente sentado jugando)
  const hits = ray.intersectObjects(objs, false);
  target = hits.length ? hits[0].object.userData.interact : null;
  if (target && target.soft && !(target.usable && target.usable())) {
    const behind = hits.find(h => { const it = h.object.userData.interact; return it && !it.soft; });
    if (behind) target = behind.object.userData.interact;
  }
  { const ov = window.CasinoShop && window.CasinoShop.override(target); if (ov) target = ov; } // con una caja en las manos: abrir o soltar (shop.js)
  let html = "";
  if (target) {
    const p = target.prompt() || {}; const canUse = !target.usable || target.usable();
    if (p.text) {
      const needHold = target.hold && target.hold() > 0;
      html = (canUse ? `<kbd>${KEY}${needHold ? " ⟳" : ""}</kbd>` : "") + escapeHtml(p.text) + (target.options && !isTouch ? `<kbd class="alt">R</kbd>${escapeHtml(target.optLabel || "Opciones")}` : "") + (p.sub ? `<span class="sub">${escapeHtml(p.sub)}</span>` : "");
    }
  }
  if (html !== lastPrompt) { lastPrompt = html; promptEl.innerHTML = html; }
  promptEl.hidden = !html;
  const showOpt = isTouch && !!(target && target.options);
  optBtn.hidden = !showOpt; if (showOpt) optBtn.textContent = target.optLabel || "Opciones";
}
const hold = { on: false, t: 0, target: null, down: false };
function useDown() {
  if (ui.blocking()) return;
  hold.down = true; hold.on = true; hold.t = 0; hold.target = target;
  if (target && !(target.hold && target.hold() > 0)) { hold.on = false; if (!target.usable || target.usable()) target.use(); }
}
function useUp() { hold.on = false; hold.down = false; hold.t = 0; holdEl.hidden = true; }
function updateHold(dt) {
  if (!hold.on) { holdEl.hidden = true; return; }
  if (target !== hold.target) { hold.target = target; hold.t = 0; }
  const need = target && target.hold ? target.hold() : 0;
  if (!target || need <= 0 || (target.usable && !target.usable())) { holdEl.hidden = true; hold.t = 0; return; }
  hold.t += dt; holdEl.hidden = false; holdEl.style.setProperty("--p", clamp(hold.t / need, 0, 1).toFixed(3));
  if (hold.t >= need) { const t = target; hold.t = 0; hold.on = !!(t.repeat && hold.down); if (!hold.on) holdEl.hidden = true; t.use(); } // repeat: reponer de a uno mientras mantenés (shop.js)
}
function openOptions() { if (!ui.blocking() && target && target.options) target.options(); }

// =====================================================================
// INTERFAZ — paneles (todas las confirmaciones viven acá, sin confirm())
// =====================================================================
const panelEl = $("panel"), panelBody = $("panelBody");
let started = false;
const ui = { panel: null, ctx: null, tab: "staff", confirm: null, blocking() { return !!this.panel || !started || !!this.mg || !!(window.CasinoCombat && window.CasinoCombat.ko()); } };
toastHold = () => ui.panel === "dialog"; // los avisos no tapan los diálogos de la historia
const STICKY = new Set(["report", "over", "rankup", "victory"]);
function openPanel(kind, html, ctx) {
  ui.panel = kind; if (ctx !== undefined) ui.ctx = ctx;
  panelBody.innerHTML = (STICKY.has(kind) ? "" : `<button class="ghost xclose" data-act="close" aria-label="Cerrar">×</button>`) + html; panelEl.hidden = false; panelEl.scrollTop = 0;
  releasePointer(); useUp(); promptEl.hidden = true;
}
function closePanel(force, relock) {
  if (!force && STICKY.has(ui.panel)) return;
  ui.panel = null; ui.ctx = null; ui.confirm = null; panelEl.hidden = true; panelBody.innerHTML = "";
  showPendingRank();
  if (!ui.panel && relock) requestPointer();
}
const unlockLabel = (lvl) => `<span class="tag lock">Rango ${lvl}</span>`;
const sw = css => `<span class="sw" style="background:${css}"></span>`;
const cssHex = n => "#" + (n >>> 0).toString(16).padStart(6, "0");
const closeBtn = (label) => `<button class="ghost" data-act="close">${label || "Cerrar"}</button>`;

// compras en los cuadros dorados ---------------------------------------------------
function gamesLine() { return `Banco <b class="num">${fmt(S.bank)}</b> · juegos instalados <b class="num">${gamesCount()}/${Rank.maxGames()}</b>`; }
function openSlotShop(slot) {
  const full = gamesCount() >= Rank.maxGames();
  const rows = D.MACHINES.map(d => {
    const locked = S.rank < d.rank;
    return `<div class="item${locked ? " locked" : ""}">${sw(d.css)}
      <div class="t"><b>${d.name} · <span class="num">${fmt(d.price)}</span>${locked ? unlockLabel(d.rank) : ""}</b>
      <span>Apuesta ${fmt(d.bet)} · premio ${fmt(prizeOf(d, 0.9))} · gana ${pct(d.win)} · caja ${fmt(capOf(d))} · repuesto ${fmt(d.repair)}. ${d.desc}${d.jackpotSeed ? ` Pozo actual ${fmt(S.jackpotPool)}.` : ""}</span></div>
      <div class="btns"><button data-act="buyMachine" data-id="${d.id}" ${locked || full || S.bank < d.price ? "disabled" : ""}>Comprar</button></div></div>`;
  }).join("");
  openPanel("shop", `<h2>Tragamonedas</h2><p>${gamesLine()}. La máquina queda en este lugar y sus ganancias se juntan en su caja: hay que vaciarla.</p>
    ${full ? `<div class="warn">Tu rango permite ${Rank.maxGames()} juegos. Subí de rango para instalar más.</div>` : ""}
    <div class="list">${rows}</div><div class="actions">${closeBtn()}</div>`, { slot });
}
function openTableShop(spot) {
  const full = gamesCount() >= Rank.maxGames();
  const rows = D.TABLES.map(d => {
    const locked = S.rank < d.rank;
    return `<div class="item${locked ? " locked" : ""}">${sw(d.css)}
      <div class="t"><b>${d.name} · <span class="num">${fmt(d.price)}</span>${locked ? unlockLabel(d.rank) : ""}</b>
      <span>${d.seats} asientos · apuestas ${fmt(d.minBet)}-${fmt(d.maxBet)} · ${d.noVariance ? "comisión" : "ventaja de la casa"} ${(d.edge * 100).toFixed(1).replace(".0", "")}% · una mano cada ${d.round} s · luz ${fmt(CFG.utilityPerTable)}/día. ${d.desc}</span></div>
      <div class="btns"><button data-act="buyTable" data-id="${d.id}" ${locked || full || S.bank < d.price ? "disabled" : ""}>Comprar</button></div></div>`;
  }).join("");
  openPanel("shop", `<h2>Mesas de juego</h2><p>${gamesLine()}. Una mesa solo juega con croupier: uno contratado o vos parado en el cuadro dorado de atrás. ${D.TABLES.some(t => !t.noVariance) ? "Blackjack y ruleta tienen rachas: un día pueden perder plata." : ""}</p>
    ${full ? `<div class="warn">Tu rango permite ${Rank.maxGames()} juegos.</div>` : ""}<div class="list">${rows}</div><div class="actions">${closeBtn()}</div>`, { spot });
}
function openDecorShop(spot) {
  const cur = spot.decor;
  const rows = D.DECOR.filter(d => !d.unique).map(d => {
    const locked = S.rank < d.rank, same = cur && cur.def.id === d.id;
    return `<div class="item${locked ? " locked" : ""}${same ? " sel" : ""}">${sw(cssHex(d.color))}
      <div class="t"><b>${d.name} · <span class="num">${fmt(d.price)}</span>${locked ? unlockLabel(d.rank) : ""}${same ? '<span class="tag">Puesta</span>' : ""}</b><span>+${d.atr} de atractivo</span></div>
      <div class="btns"><button data-act="buyDecor" data-id="${d.id}" ${locked || same || S.bank < d.price ? "disabled" : ""}>${cur ? "Reemplazar" : "Comprar"}</button></div></div>`;
  }).join("");
  openPanel("shop", `<h2>Decoración</h2><p>Banco <b class="num">${fmt(S.bank)}</b> · atractivo <b class="num">${Math.round(attractiveness())}</b>${rivalOpen() ? ` contra <b class="num">${Math.round(rivalAtr())}</b> de ${RIVAL.name}` : ""}. El atractivo trae más clientes y deja pasar a high rollers (40) y VIP (120).</p>
    ${cur ? `<div class="note">Acá hay una ${cur.def.name}. Si comprás otra cosa, la reemplaza (no se devuelve plata).</div>` : ""}
    <div class="list">${rows}</div><div class="actions">${closeBtn()}</div>`, { spot });
}
function openBarShop() {
  const d = BAR_DEF, locked = S.rank < d.rank;
  openPanel("shop", `<h2>${d.name}</h2><p>Banco <b class="num">${fmt(S.bank)}</b>. Suma +${d.atr} de atractivo, te deja servir tragos a high rollers y VIP (+$${SDEF("waiter").drinkPrice - SDEF("waiter").drinkCost} cada uno y +satisfacción) y habilita contratar camareros.</p>
    <div class="list"><div class="item${locked ? " locked" : ""}">${sw(cssHex(d.color))}<div class="t"><b>${d.name} · <span class="num">${fmt(d.price)}</span>${locked ? unlockLabel(d.rank) : ""}</b><span>Única. Va en este lugar junto a la entrada.</span></div>
    <div class="btns"><button data-act="buyBar" ${locked || S.bank < d.price ? "disabled" : ""}>Comprar</button></div></div></div><div class="actions">${closeBtn()}</div>`);
}
function openZonePanel(zone) {
  const locked = S.rank < zone.rank;
  openPanel("shop", `<h2>${zone.name}</h2><p>Banco <b class="num">${fmt(S.bank)}</b>. Ampliar cuesta <b class="num">${fmt(zone.price)}</b> y suma ${zone.slots} lugares para máquinas, ${zone.tableSpots} para mesas y ${zone.decorSpots} para decoración.</p>
    <p>Ojo: los lugares nuevos no te dejan pasar el máximo de juegos de tu rango (${Rank.maxGames()}).</p>
    ${locked ? `<div class="warn">Necesitás rango ${zone.rank} (${Rank.def(zone.rank).name}).</div>` : ""}
    <div class="actions">${closeBtn("Volver")}<button data-act="buyZone" data-id="${zone.id}" ${locked || S.bank < zone.price ? "disabled" : ""}>Ampliar por ${fmt(zone.price)}</button></div>`, { zone });
}
function buyZone(zone) {
  if (S.zones[zone.id] || S.rank < zone.rank) return;
  if (!Economy.trySpend("expansion", zone.price)) return;
  S.zones[zone.id] = true; applyZones(); SFX.cash();
  toast(`¡Ampliaste el local! ${zone.name} habilitada.`, "good"); save(true);
}

// opciones de máquina y mesa -----------------------------------------------------
function openMachinePanel(m) {
  if (m.dead) return;
  const d = m.d, def = m.def, cur = RTPD(d.rtp), refund = Math.round(def.price * CFG.sellRefund);
  const rows = D.RTP_SETTINGS.map(s => `<div class="item${s.id === cur.id ? " sel" : ""}">${sw(s.legal ? "#6fd39b" : "#d4423f")}
    <div class="t"><b>${s.name} · ${pct(s.rtp)}${s.legal ? "" : '<span class="tag bad">Ilegal</span>'}${s.id === cur.id ? '<span class="tag">Actual</span>' : ""}</b>
    <span>Premio ${fmt(prizeOf(def, s.rtp))} · atractivo ×${s.appealMul} · casa ${pct(1 - s.rtp)}${s.heatPerDay ? ` · +${s.heatPerDay} de calor por día` : ""}${s.id === "generosa" ? " · clientes más contentos" : ""}</span></div>
    <div class="btns"><button class="ghost" data-act="setRtp" data-id="${s.id}" ${s.id === cur.id ? "disabled" : ""}>Elegir</button></div></div>`).join("");
  const conf = ui.confirm === "sellMachine";
  openPanel("machine", `<h2>${def.name}</h2>
    <p>Caja <b class="num">${fmt(d.box)}/${fmt(capOf(def))}</b> · ${d.broken ? '<b style="color:var(--chip)">Rota</b>' : "funcionando"} · apuesta ${fmt(def.bet)}${def.jackpotSeed ? ` · pozo ${fmt(S.jackpotPool)}` : ""}</p>
    <h3>Ajuste de pago</h3><div class="list">${rows}</div>
    <p>El mínimo legal es 85%. Una máquina Trucha deja más del doble de ganancia, pero si el inspector la ve te multa con ${fmt(HEAT.finePerRigged(def))}.</p>
    ${conf ? `<div class="warn">¿Vender la ${def.name} por ${fmt(refund)}? La plata de la caja pasa al banco.</div>` : ""}
    <div class="actions">${conf ? `<button class="ghost" data-act="unconfirm">No</button><button class="danger" data-act="sellMachine">Sí, vender</button>` : `<button class="ghost" data-act="askSell" data-id="sellMachine">Vender (${fmt(refund)})</button>${closeBtn()}`}</div>`, { m });
}
function openTablePanel(t) {
  if (t.dead) return;
  const def = t.def, refund = Math.round(def.price * CFG.sellRefund), conf = ui.confirm === "sellTable";
  openPanel("table", `<h2>${def.name}</h2>
    <p>Bandeja de hoy <b class="num">${fmt(t.d.tray)}</b> (pasa al banco al cierre) · ${t.seats.filter(s => s.c).length}/${t.seats.length} jugadores · croupier: <b>${t.staff ? "contratado" : t.playerDealing ? "vos" : "nadie"}</b></p>
    <p>Apuestas ${fmt(def.minBet)}-${fmt(def.maxBet)} · ${def.noVariance ? `la casa cobra ${pct(def.edge)} de comisión, nunca pierde` : `ventaja de la casa ${(def.edge * 100).toFixed(1)}%: puede tener días malos`} · +${def.rep} de reputación por hora con croupier.</p>
    ${!t.staff ? `<div class="note">Sin croupier contratado, la mesa solo juega si te parás en el cuadro dorado de atrás. ${S.rank >= SDEF("dealer").rank ? "Podés contratar uno en Gestión → Personal." : `Los croupiers se desbloquean en el rango ${SDEF("dealer").rank}.`}</div>` : ""}
    ${conf ? `<div class="warn">¿Vender la ${def.name} por ${fmt(refund)}?</div>` : ""}
    <div class="actions">${conf ? `<button class="ghost" data-act="unconfirm">No</button><button class="danger" data-act="sellTable">Sí, vender</button>` : `<button class="ghost" data-act="askSell" data-id="sellTable">Vender (${fmt(refund)})</button>${closeBtn()}`}</div>`, { t });
}

// gestión: personal, banco, rango ------------------------------------------------------
function openMgmt(tab) {
  if (ui.panel !== "mgmt") ui.hireRole = null; // al abrir Gestión de cero, no queda abierta la lista de candidatos
  if (tab) ui.tab = tab;
  const tabs = [["staff", "Personal"], ["bank", "Banco"], ["goals", "Rango y objetivos"]];
  const xt = window.CasinoWorld ? window.CasinoWorld.mgmtTabs() : []; // world.js: Hotel y Favores
  for (const t of xt) tabs.push([t.id, t.name]);
  const ext = xt.find(t => t.id === ui.tab);
  const head = `<div class="tabs">${tabs.map(([id, n]) => `<button data-act="tab" data-id="${id}" class="${ui.tab === id ? "on" : ""}">${n}</button>`).join("")}</div>`;
  const body = ext ? ext.html() : ui.tab === "bank" ? bankHtml() : ui.tab === "goals" ? goalsHtml() : window.CasinoStaff ? window.CasinoStaff.panelHtml() : staffHtml();
  openPanel("mgmt", `<h2>${ext ? ext.title : ui.tab === "bank" ? "Banco y préstamos" : ui.tab === "goals" ? "Rango y objetivos" : "Personal"}</h2>${head}${body}<div class="actions">${closeBtn()}</div>`);
}
function staffHtml() {
  const w = wagesTotal();
  const rows = D.STAFF.map(s => {
    const n = S.staff[s.role] || 0, max = staffMax(s), locked = S.rank < s.rank, needBar = s.role === "waiter" && !S.bar;
    const nextR = Object.keys(s.maxByRank).map(Number).find(r => r > S.rank);
    return `<div class="item${locked ? " locked" : ""}">${sw(cssHex(s.color))}
      <div class="t"><b>${s.name} · <span class="num">${n}/${locked ? s.maxByRank[s.rank] : max}</span>${locked ? unlockLabel(s.rank) : ""}</b>
      <span>${s.desc} ${fmt(Math.round(s.wage * diff().wages))} por día.${needBar && !locked ? " Necesita la Barra." : ""}${!locked && nextR ? ` Rango ${nextR}: hasta ${s.maxByRank[nextR]}.` : ""}</span></div>
      <div class="btns"><button class="ghost" data-act="fire" data-id="${s.role}" ${n ? "" : "disabled"}>Despedir</button><button data-act="hire" data-id="${s.role}" ${locked || n >= max || needBar ? "disabled" : ""}>Contratar</button></div></div>`;
  }).join("");
  const short = S.bank < w + utilitiesTotal();
  return `<p>Sueldos de hoy <b class="num">${fmt(w)}</b> + luz <b class="num">${fmt(utilitiesTotal())}</b> · banco <b class="num">${fmt(S.bank)}</b>. Se pagan a medianoche. Contratar es inmediato; despedir no devuelve nada.</p>
    ${short ? `<div class="warn">Hoy no te alcanza el banco para sueldos y luz: depositá lo del bolsillo o vas a cerrar en rojo.</div>` : ""}<div class="list">${rows}</div>`;
}
function bankHtml() {
  const ln = S.loan, LD = ln && LOAN(ln.id);
  const loanBox = ln ? `<div class="note"><b>${LD.name}</b>: debés <b class="num">${fmt(ln.owed)}</b> · cuota diaria <b class="num">${fmt(ln.perDay)}</b> · ${ln.daysLeft} cuotas · impagas ${ln.missed}/${D.LOAN_RULES.missedToSeize}
      <div class="actions" style="margin-top:8px"><button class="ghost sm" data-act="payLoan" ${S.bank < ln.owed ? "disabled" : ""}>Cancelar todo (${fmt(ln.owed)})</button></div></div>` : "";
  const rows = D.LOANS.map(L => {
    const locked = S.rank < L.rank, owed = Math.round(L.amount * (1 + L.interest * UPV("loanInterestMul", 1)));
    return `<div class="item${locked ? " locked" : ""}">${sw(L.shady ? "#d4423f" : "#d9a84a")}
      <div class="t"><b>${L.name} · <span class="num">${fmt(L.amount)}</span>${locked ? unlockLabel(L.rank) : ""}</b>
      <span>Devolvés ${fmt(owed)} en ${L.days} cuotas de ${fmt(Math.ceil(owed / L.days))} (${pct(L.interest * UPV("loanInterestMul", 1))} de interés). Cuota impaga: +${pct(D.LOAN_RULES.missedPenalty)}${L.shady ? " y calor" : ""}. ${D.LOAN_RULES.missedToSeize} impagas seguidas: embargo del juego más caro.</span></div>
      <div class="btns"><button data-act="loan" data-id="${L.id}" ${locked || ln ? "disabled" : ""}>Pedir</button></div></div>`;
  }).join("");
  const canBuy = S.rank >= D.RANKS.length && rivalOpen();
  const rivalBox = S.rivalBought ? `<div class="note">Compraste ${RIVAL.name}. Ya no tenés competencia.</div>`
    : `<h3>${RIVAL.name}</h3><p>${rivalOpen() ? `Atractivo ${Math.round(rivalAtr())} contra tus ${Math.round(attractiveness())}. Te lleva clientes: multiplicador ×${rivalMul().toFixed(2)}.` : `Abre el día ${RIVAL.opensDay}.`} Con el rango ${D.RANKS.length} (${D.RANKS[D.RANKS.length - 1].name}) lo podés comprar y ganar la partida${rivalOpen() ? ` por ${fmt(buyoutPrice())}` : ""}.</p>
      ${canBuy ? `<div class="actions"><button data-act="buyRival" ${S.bank < buyoutPrice() ? "disabled" : ""}>Comprar ${RIVAL.name} (${fmt(buyoutPrice())})</button></div>` : ""}`;
  return `<div class="statgrid"><div class="stat"><b>${fmt(S.bank)}</b><span>Banco</span></div><div class="stat"><b>${fmt(S.pocket)}</b><span>Bolsillo (tope ${fmt(Pocket.cap())})</span></div>
    <div class="stat"><b>${fmt(licenseFee())}</b><span>Licencia · día ${S.licenseDue}${S.licenseMissed ? ` · aviso ${S.licenseMissed}/${CFG.licenseMaxMiss}` : ""}</span></div>
    <div class="stat"><b>${fmt(wagesTotal() + utilitiesTotal())}</b><span>Gastos fijos por día</span></div></div>
    <p>Comprar, sueldos, licencia y cuotas salen del banco. La plata de las máquinas hay que llevarla a la caja fuerte de la entrada.</p>
    ${loanBox}${window.CasinoChallenge?.noLoans?.() ? `<h3>Préstamos</h3><div class="warn">Modo Difícil sin préstamos: el banco no te presta. Arreglátelas con lo que ganes.</div>` : `<h3>Préstamos (uno a la vez)</h3><div class="list">${rows}</div>`}${rivalBox}`;
}
function objLine(so) {
  const o = objDef(so.id); if (!o) return "";
  const v = objValue(o), end = objIsEnd(o);
  const prog = so.done ? "Hecho" : end ? (o.cmp === "<=" ? `${v} hasta ahora` : `ahora ${v}`) + " · al cierre" : `${Math.min(v, o.goal)}/${o.goal}`;
  return { o, v, prog, end };
}
function goalsHtml() {
  const cur = Rank.def(S.rank), nx = Rank.next();
  const pctXp = nx ? (S.xp - cur.xp) / (nx.xp - cur.xp) : 1;
  const objs = S.objectives.map(so => { const r = objLine(so); return r ? `<div class="item${so.done ? " sel" : ""}">${sw(so.done ? "#6fd39b" : "#8a6a2c")}<div class="t"><b>${escapeHtml(r.o.text)}</b><span>${r.prog} · +${r.o.xp} XP${r.o.cash ? ` y ${fmt(r.o.cash)}` : ""}</span></div></div>` : ""; }).join("");
  const loy = D.CUSTOMER_TYPES.filter(t => t.loyal).map(t => `<div class="stat"><b>${(S.loyalty[t.id] || 0).toFixed(1)}</b><span>Fidelidad ${t.name}${S.rank < t.rank ? ` (rango ${t.rank})` : ""}</span></div>`).join("");
  return `<p><span class="rankbig" style="font-size:2rem">${cur.name}</span></p>
    <div class="meter" style="grid-template-columns:70px 1fr 110px"><span>Rango ${S.rank}</span><span class="bar"><i style="width:${Math.round(pctXp * 100)}%"></i></span><span class="v">${nx ? `${fmtN(S.xp)}/${fmtN(nx.xp)}` : fmtN(S.xp) + " · máx."}</span></div>
    ${nx ? `<p>Próximo: <b>${nx.name}</b> desbloquea ${nx.unlocks.map(unlockName).join(", ")} y hasta ${nx.maxGames} juegos.</p>` : ""}
    <h3>Objetivos de hoy</h3><div class="list">${objs || "<p>—</p>"}</div>
    <h3>Tu casino</h3><div class="statgrid">
      <div class="stat"><b>${Math.round(attractiveness())}</b><span>Atractivo${rivalOpen() ? ` (${RIVAL.name}: ${Math.round(rivalAtr())})` : ""}</span></div>
      <div class="stat"><b>${Math.round(S.rep)}</b><span>Reputación (${Rep.label()})</span></div>
      <div class="stat"><b>${Math.round(S.heat)}</b><span>Calor (${Heat.label()}) · clausuras ${S.closures}/${HEAT.closuresToLose}</span></div>
      <div class="stat"><b>${demandPerHour().toFixed(1)}</b><span>Clientes por hora ahora</span></div>${loy}</div>
    <p>XP: vaciar caja ${D.XP.collectBox} · reparar ${D.XP.repair} · cada mano que repartís ${D.XP.dealHand} · trago ${D.XP.serveDrink} · recibir VIP ${D.XP.greetVip} · atrapar ladrón ${D.XP.catchThief} · comprar juego ${D.XP.buyGame} · 1 XP cada ${Math.round(1 / CFG.xpPerProfit)} de ganancia neta del día.</p>`;
}
function unlockName(id) {
  if (MACH(id)) return MACH(id).name.replace("Tragamonedas ", "Tragamonedas ");
  if (TDEF(id)) return TDEF(id).name;
  if (SDEF(id)) return "personal: " + SDEF(id).name;
  if (CTYPE(id)) return "clientes " + CTYPE(id).name;
  if (DECO(id)) return DECO(id).name;
  if (LOAN(id)) return LOAN(id).name;
  if (ZONE(id)) return "ampliación " + ZONE(id).name;
  if (id === "buyout") return `comprar ${RIVAL.name} (victoria)`;
  return id;
}

// rango nuevo -----------------------------------------------------------------
function showPendingRank() {
  if (ui.panel || !started || !pendingRanks.length) return;
  const lvl = pendingRanks.shift(), r = Rank.def(lvl);
  const items = r.unlocks.map(u => `<li>${escapeHtml(unlockName(u))}</li>`);
  items.push(`<li>Hasta ${r.maxGames} juegos instalados</li>`);
  if (CFG.pocketCapByRank[lvl]) items.push(`<li>Bolsillo más grande: ${fmt(CFG.pocketCapByRank[lvl])}</li>`);
  for (const s of D.STAFF) if (s.maxByRank[lvl] && s.rank < lvl) items.push(`<li>Hasta ${s.maxByRank[lvl]} ${s.name.toLowerCase()}s</li>`);
  if (window.CasinoUp) for (const l of window.CasinoUp.rankLines(lvl)) items.push(`<li>${escapeHtml(l)}</li>`); // licencias y mejoras (upgrades.js)
  SFX.rank();
  openPanel("rankup", `<p class="dim" style="letter-spacing:.2em;text-transform:uppercase;font-size:.8rem">Nuevo rango · ${lvl}/${D.RANKS.length}</p>
    <p class="rankbig">${r.name}</p><h3>Desbloqueaste</h3><ul class="unlocks">${items.join("")}</ul>
    <div class="actions"><button data-act="closeRank">¡A trabajar!</button></div>`);
  window.CasinoJuice?.onRankUp(lvl, r.name); // papel picado y brillo (juice.js)
}

// reporte del día y fin ---------------------------------------------------------
function showReport() {
  const r = S.today, st = r.st, over = S.gameOver;
  const lines = (obj, cls, sign) => Object.keys(obj).filter(k => obj[k]).map(k => `<span>${CAT_LABEL[k] || k}</span><span class="v ${cls}">${sign}${fmt(obj[k])}</span>`).join("") || `<span class="dim">—</span><span class="v">$0</span>`;
  const inc = Object.values(r.inc).reduce((a, b) => a + b, 0), exp = Object.values(r.exp).reduce((a, b) => a + b, 0);
  const heatD = Math.round((r.heatEnd != null ? r.heatEnd : S.heat) - r.heatStart), repD = Math.round((r.repEnd != null ? r.repEnd : S.rep) - r.repStart);
  const objs = S.objectives.map(so => { const o = objDef(so.id); return o ? `<li>${so.done ? "✓" : "✗"} ${escapeHtml(o.text)}</li>` : ""; }).join("");
  const notes = r.notes.map(n => `<li>${escapeHtml(n)}</li>`).join("");
  const summary = over ? `<div class="statgrid"><div class="stat"><b>${S.day}</b><span>Días de casino</span></div><div class="stat"><b>${Rank.def(S.rank).name}</b><span>Rango final</span></div><div class="stat"><b>${fmtN(S.totals.served)}</b><span>Clientes atendidos</span></div><div class="stat"><b>${fmt(S.totals.net)}</b><span>Ganancia de juego total</span></div></div>` : "";
  openPanel(over ? "over" : "report", `
    <h2>${over ? "Fin de la partida" : "Cierre de caja · día " + r.day}</h2>
    ${over ? `<div class="warn">${escapeHtml(over)}</div>${summary}` : ""}
    ${over ? `<h3>Último día (${r.day})</h3>` : ""}
    <div class="statgrid">
      <div class="stat"><b class="${st.net >= 0 ? "in" : "out"}">${fmt(st.net)}</b><span>Ganancia de juego</span></div>
      <div class="stat"><b>${st.served}</b><span>Clientes atendidos</span></div>
      <div class="stat"><b>+${st.xp}</b><span>XP del día</span></div>
      <div class="stat"><b>${Math.round(S.heat)} <small class="${heatD > 0 ? "out" : "in"}">${heatD >= 0 ? "+" : ""}${heatD}</small></b><span>Calor</span></div>
      <div class="stat"><b>${Math.round(S.rep)} <small class="${repD < 0 ? "out" : "in"}">${repD >= 0 ? "+" : ""}${repD}</small></b><span>Reputación</span></div>
      <div class="stat"><b class="${st.stolen ? "out" : ""}">${fmt(st.stolen)}</b><span>Robado de cajas (${st.thefts})</span></div>
    </div>
    <div class="ledger">
      <span class="h">Entró al banco</span>${lines(r.inc, "in", "+")}
      <span class="h">Salió del banco</span>${lines(r.exp, "out", "-")}
      <span class="sep"></span>
      <span class="total">Resultado del día</span><span class="v total ${inc - exp >= 0 ? "in" : "out"}">${fmt(inc - exp)}</span>
      <span>Banco</span><span class="v">${fmt(r.start)} → ${fmt(r.end)}</span>
    </div>
    <p class="dim" style="font-size:.88rem">Apuestas ${fmt(st.bets)} · premios ${fmt(st.prizes)} · mesas ${fmt(st.tablesNet)} · tragos ${st.drinks} · ladrones atrapados ${st.caught}${st.fines ? ` · multas ${fmt(st.fines)}` : ""}</p>
    ${objs ? `<h3>Objetivos</h3><ul class="unlocks">${objs}</ul>` : ""}
    ${window.CasinoOwner ? window.CasinoOwner.reportHtml() : ""}
    ${notes ? `<h3>Novedades</h3><ul class="unlocks">${notes}</ul>` : ""}
    ${!over ? `<p>Mañana: licencia ${S.licenseDue <= S.day + 1 ? `<b>${fmt(licenseFee())} vence el día ${S.licenseDue}</b>` : `el día ${S.licenseDue}`}${S.loan ? ` · cuota ${fmt(S.loan.perDay)}` : ""} · gastos fijos ${fmt(wagesTotal() + utilitiesTotal())}${S.closedDays > 0 ? ` · <b>clausurado</b>` : ""}${isPromoDay(S.day + 1) && rivalOpen() ? ` · promo de ${RIVAL.name}` : ""}.</p>` : ""}
    <div class="actions">${over ? `<button data-act="newgame">Nueva partida</button>` : `<button data-act="next">Abrir el día ${S.day + 1}</button>`}</div>`);
}
function showVictory() {
  openPanel("victory", `<p class="dim" style="letter-spacing:.2em;text-transform:uppercase;font-size:.8rem">Victoria · día ${S.day}</p>
    <p class="rankbig">Rey de la noche</p>
    <p>Compraste ${RIVAL.name}. La calle es tuya: el cartel azul de enfrente ahora dice Dorado II.</p>
    <div class="statgrid"><div class="stat"><b>${S.day}</b><span>Días</span></div><div class="stat"><b>${fmtN(S.totals.served)}</b><span>Clientes atendidos</span></div><div class="stat"><b>${fmt(S.bank)}</b><span>Banco</span></div></div>
    <p>Podés seguir jugando sin rival.</p><div class="actions"><button data-act="closeRank">Seguir jugando</button></div>`);
}
function openBribePanel() {
  const a = inspector; if (!a || a.bribeTried) return;
  const cost = HEAT.bribeCost(S.heat), ok = HEAT.bribeSuccess(S.heat);
  openPanel("bribe", `<h2>¿Coimear al inspector?</h2>
    <p>Le pasás <b class="num">${fmt(cost)}</b> por debajo de la mesa. Con el calor actual (${Math.round(S.heat)}) acepta el <b>${pct(ok)}</b> de las veces.</p>
    <div class="note">Si acepta: se va sin mirar y baja ${Math.abs(HEAT.bribeOkHeat)} el calor. Si no: perdés la plata, revisa todo, las multas son ×${HEAT.bribeFailFineMul} y el calor sube ${HEAT.bribeFailHeat}.</div>
    <div class="actions">${closeBtn("Mejor no")}<button class="danger" data-act="bribe" ${S.bank < cost ? "disabled" : ""}>Pagar ${fmt(cost)}</button></div>`);
}
function renderPause() {
  const k = isTouch
    ? `<kbd>Joystick</kbd><span>Caminar</span><kbd>Arrastrar</kbd><span>Mirar</span><kbd>Usar</kbd><span>Tocar o mantener: comprar, vaciar, reparar, depositar, repartir</span><kbd>Construir</kbd><span>Mover y decorar el local</span><kbd>Opciones</kbd><span>Ajustes de la máquina o mesa que mirás</span><kbd>Gestión</kbd><span>Personal, banco, rango y objetivos</span>`
    : `<kbd>WASD</kbd><span>Caminar · Shift corre</span><kbd>E</kbd><span>Usar · mantener para vaciar y depositar · reparar a mano</span><kbd>R</kbd><span>Opciones de lo que mirás (pago, vender)</span><kbd>P K O</kbd><span>Personal · Banco · Objetivos</span><kbd>H M</kbd><span>Historia · Sonido</span><kbd>1 2 3</kbd><span>Velocidad x1 x2 x4</span><kbd>N</kbd><span>Abrir ya · saltar horas cerradas</span><kbd>U</kbd><span>Licencias y mejoras</span><kbd>G</kbd><span>Soltar la caja que llevás · si no, guardar</span><kbd>L</kbd><span>Logros, récords y ranking contra El Faraón</span>`;
  const conf = ui.confirm === "new";
  openPanel("pause", `<h2>Pausa</h2><div class="keys">${k}</div>
    <div id="gfxSettings"><h3>Gráficos</h3><div class="tabs">${Object.entries(GFX_MODES).map(([id, n]) => `<button class="${gfx.mode === id ? "on" : ""}" data-act="gfx" data-id="${id}">${n}</button>`).join("")}</div>
    <div class="row2"><button class="ghost sm" data-act="gfxFps" aria-pressed="${gfx.fps}">${gfx.fps ? "Ocultar FPS" : "Mostrar FPS"}</button><button class="ghost sm" data-act="gfxBob" aria-pressed="${gfx.bob}">${gfx.bob ? "Balanceo: sí" : "Balanceo: no"}</button>${window.CasinoGuide ? `<button class="ghost sm" data-act="guide" aria-pressed="${window.CasinoGuide.on}">${window.CasinoGuide.on ? "Guía: sí" : "Guía: no"}</button>` : ""}<span>${gfx.mode === "auto" ? "Materiales rápidos y resolución que se ajusta sola para que vaya fluido." : gfx.mode === "baja" ? "Menos resolución, luces y suavizado de bordes: para compus lentas." : gfx.mode === "media" ? "Materiales rápidos, resolución normal." : "Materiales con brillo real y máxima nitidez: pide una buena placa de video."}</span></div></div>
    <p>Dificultad: <b>${diff().name}</b>${D.MODES ? ` · Modo: <b>${(D.MODES[S.mode] || D.MODES.historia).name}</b>` : ""}. La partida se guarda sola cada hora, al comprar y al cerrar el día, en este navegador.</p>
    ${conf ? `<div class="warn">¿Empezar de cero? Se borra la partida guardada: plata, rango, máquinas y personal.</div>` : ""}
    <div class="actions">${conf ? `<button class="ghost" data-act="unconfirm">Volver</button><button class="danger" data-act="newgame">Borrar y empezar</button>`
      : `${skipLabel() ? `<button class="ghost" data-act="skipNow">${skipLabel()}</button>` : ""}<button class="ghost" data-act="askNew">Nueva partida</button><button class="ghost" data-act="mgmt">Gestión</button><button class="ghost" data-act="save">Guardar</button><button data-act="resume">Seguir jugando</button>`}</div>`);
}
function newGame(diffId, modeId) {
  clearSave(); closePanel(true);
  loadState(null, diffId || "normal", modeId || S.mode);
  save(true);
  toast(`Partida nueva (${diff().name}). Tu Clásica usada ya está prendida; el casino abre a las 10:00.`, "good");
  setTimeout(() => toast(window.CasinoShop ? "Las máquinas, la mercadería y la decoración se piden en la compu de la oficina, a la derecha de la entrada." : `Mirá un cuadro dorado del piso y ${isTouch ? "tocá Usar" : "apretá E"} para comprar.`), 900);
}
panelBody.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b || b.disabled) return;
  const act = b.dataset.act, id = b.dataset.id, ctx = ui.ctx || {};
  switch (act) {
    case "close": closePanel(false, true); break;
    case "resume": closePanel(false, true); break;
    case "skipNow": closePanel(false, true); skipTime(); break;
    case "gfx": gfxSet(id); renderPause(); break;
    case "gfxFps": gfx.fps = !gfx.fps; fpsEl.hidden = !gfx.fps; gfxSave(); renderPause(); break;
    case "gfxBob": gfx.bob = !gfx.bob; gfxSave(); renderPause(); break;
    case "guide": if (window.CasinoGuide) window.CasinoGuide.set(!window.CasinoGuide.on); renderPause(); break; // guide.js
    case "closeRank": closePanel(true, true); break;
    case "buyMachine": if (buyMachine(MACH(id), ctx.slot)) closePanel(false, true); break;
    case "buyTable": if (buyTable(TDEF(id), ctx.spot)) closePanel(false, true); break;
    case "buyDecor": if (buyDecor(DECO(id), ctx.spot)) closePanel(false, true); break;
    case "buyBar": if (buyBar()) closePanel(false, true); break;
    case "buyZone": buyZone(ZONE(id)); closePanel(false, true); break;
    case "setRtp": if (ctx.m && !ctx.m.dead) { ctx.m.d.rtp = id; const s = RTPD(id); toast(`${ctx.m.def.name}: pago ${s.name} (${pct(s.rtp)}).${s.legal ? "" : " Es ilegal: cuidado con el inspector."}`, s.legal ? "good" : "bad"); save(true); openMachinePanel(ctx.m); } break;
    case "askSell": ui.confirm = id; if (id === "sellMachine") openMachinePanel(ctx.m); else openTablePanel(ctx.t); break;
    case "unconfirm": { const was = ui.confirm; ui.confirm = null; if (was === "new") renderPause(); else if (ctx.m) openMachinePanel(ctx.m); else if (ctx.t) openTablePanel(ctx.t); break; }
    case "sellMachine": if (ctx.m && !ctx.m.dead) sellMachine(ctx.m); closePanel(true, true); break;
    case "sellTable": if (ctx.t && !ctx.t.dead) sellTable(ctx.t); closePanel(true, true); break;
    case "tab": openMgmt(id); break;
    case "mgmt": openMgmt(); break;
    case "hire": case "fire": case "hirePick": case "hireBack": case "reroll": case "promote": case "fireRec": case "hireNahuel":
      if (window.CasinoStaff) { window.CasinoStaff.click(act, id, b.dataset); openMgmt("staff"); break; }
      if (act === "hire") hireStaff(id); else if (act === "fire") fireStaff(id);
      openMgmt("staff"); break;
    case "loan": takeLoan(id); openMgmt("bank"); break;
    case "payLoan": payLoanOff(); openMgmt("bank"); break;
    case "buyRival": buyRival(); break;
    case "bribe": closePanel(true); bribeInspector(); break;
    case "next": closePanel(true, true); nextDay(); break;
    case "askNew": ui.confirm = "new"; renderPause(); break;
    case "newgame": newGame(S.difficulty, S.mode); break;
    case "save": save(false); break;
  }
});

// HUD -----------------------------------------------------------------------
const speedEl = $("speed");
function setSpeed(s) { if (S) S.speed = s; for (const b of speedEl.children) b.classList.toggle("on", +b.dataset.s === s); }
speedEl.addEventListener("click", e => { const b = e.target.closest("button"); if (b) setSpeed(+b.dataset.s); });
let hudT = 0, lastObjHtml = "";
const two = n => String(n).padStart(2, "0");
function skipLabel() {
  if (S.dayOver || isOpen) return "";
  if (!S.closedToday && S.minutes < CFG.open * 60) return "Abrir ya";
  return "Cerrar el día";
}
function skipTime() {
  if (!started || ui.panel || S.dayOver || isOpen) return;
  if (window.CasinoOwner && window.CasinoOwner.blockSkip()) return; // noche de robo anunciado (owner.js)
  if (!S.closedToday && S.minutes < CFG.open * 60) { S.minutes = CFG.open * 60; lastHour = -1; }
  else { S.minutes = CFG.dayEnd * 60; endDay(); }
}
function updateHud(force) {
  if (!S) return;
  const now = performance.now(); if (!force && now - hudT < 180) return; hudT = now;
  const bank = $("hBank"); bank.textContent = fmt(S.bank); bank.classList.toggle("neg", S.bank < 0);
  const pk = $("hPocket"); pk.textContent = `Bolsillo ${fmt(S.pocket)}/${fmt(Pocket.cap())}`; pk.classList.toggle("full", S.pocket >= Pocket.cap());
  $("hDay").textContent = S.day;
  const h = Math.floor(S.minutes / 60) % 24, mm = Math.floor(S.minutes % 60);
  $("hClock").textContent = `${two(h)}:${two(mm)}`;
  const o = $("hOpen"); o.textContent = S.closedToday ? "Clausurado" : isOpen ? "Abierto" : "Cerrado"; o.className = "pill " + (isOpen ? "open" : "closed");
  const cur = Rank.def(S.rank), nx = Rank.next();
  $("hRankName").textContent = cur.name;
  $("hXp").style.width = (nx ? clamp((S.xp - cur.xp) / (nx.xp - cur.xp), 0, 1) * 100 : 100) + "%";
  $("hXpN").textContent = nx ? `${fmtN(S.xp)}/${fmtN(nx.xp)}` : "máx";
  $("hXpN").title = nx ? `Faltan ${fmtN(nx.xp - S.xp)} XP para ${nx.name}` : "";
  $("hRep").style.width = S.rep + "%"; $("hRepN").textContent = Math.round(S.rep);
  $("hHeat").style.width = S.heat + "%"; $("hHeatN").textContent = Math.round(S.heat);
  $("hRival").textContent = S.rivalBought ? "Sin rival: la calle es tuya" : rivalOpen() ? `Atractivo ${Math.round(attractiveness())} vs ${RIVAL.name} ${Math.round(rivalAtr())}${S.today.promo ? " · promo" : ""}` : `Atractivo ${Math.round(attractiveness())} · ${RIVAL.name} abre el día ${RIVAL.opensDay}`;
  $("hNext").textContent = `Licencia ${fmt(licenseFee())} · día ${S.licenseDue}${S.loan ? ` · cuota ${fmt(S.loan.perDay)}` : ""}`;
  const sk = skipLabel(), sb = $("skipBtn"); sb.hidden = !sk || !started; if (sk) sb.textContent = isTouch ? sk : `${sk} (N)`;
  $("hCarry").hidden = !player.drink;
  let oh = "";
  for (const so of S.objectives) { const r = objLine(so); if (r) oh += `<div class="o${so.done ? " done" : ""}"><span>${escapeHtml(r.o.text)}</span><span class="p">${so.done ? "✓" : r.end ? (r.o.cmp ? r.v : "cierre") : `${Math.min(r.v, r.o.goal)}/${r.o.goal}`}</span></div>`; }
  if (oh !== lastObjHtml) { lastObjHtml = oh; $("objs").innerHTML = oh; }
}
$("skipBtn").addEventListener("click", skipTime);
$("hudToggle").addEventListener("click", () => { const h = $("hud"); h.classList.toggle("compact"); $("hudToggle").textContent = h.classList.contains("compact") ? "Más" : "Menos"; });

// =====================================================================
// CONTROLES
// =====================================================================
let locked = false, dragging = false, suppressPause = false;
function requestPointer() {
  if (isTouch || ui.blocking()) return;
  try { const p = canvas.requestPointerLock && canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* sin bloqueo: se usa arrastrar */ }
}
function releasePointer() { if (document.pointerLockElement) { suppressPause = true; document.exitPointerLock(); } }
document.addEventListener("pointerlockchange", () => {
  locked = document.pointerLockElement === canvas;
  if (!locked && started && !ui.panel && !suppressPause) renderPause();
  suppressPause = false;
});
canvas.addEventListener("mousedown", e => {
  if (ui.blocking() || isTouch) return;
  if (!locked) { requestPointer(); dragging = true; } else if (e.button === 0) { if (!(window.CasinoCombat && window.CasinoCombat.click(e))) useDown(); } else if (e.button === 2) openOptions();
});
canvas.addEventListener("contextmenu", e => e.preventDefault());
window.addEventListener("mouseup", () => { dragging = false; if (locked) useUp(); });
window.addEventListener("mousemove", e => { if ((locked || dragging) && !ui.blocking()) look(e.movementX || 0, e.movementY || 0, 0.0025); });
window.addEventListener("keydown", e => {
  keys[e.code] = true;
  if (!started) return;
  if (e.code === "Escape") {
    if (ui.panel && !STICKY.has(ui.panel)) closePanel();
    else if (!ui.panel) renderPause();
    return;
  }
  if (e.code === "Tab") e.preventDefault();
  if (ui.panel) {
    if (ui.panel === "mgmt" && ((e.code === "KeyP" && ui.tab === "staff") || (e.code === "KeyK" && ui.tab === "bank") || (e.code === "KeyO" && ui.tab === "goals"))) closePanel(false, true);
    else if (ui.panel === "mgmt" && e.code === "KeyP") openMgmt("staff"); else if (ui.panel === "mgmt" && e.code === "KeyK") openMgmt("bank"); else if (ui.panel === "mgmt" && e.code === "KeyO") openMgmt("goals");
    return;
  }
  if (e.repeat) return;
  switch (e.code) {
    case "KeyE": useDown(); break;
    case "KeyR": openOptions(); break;
    case "KeyP": openMgmt("staff"); break;
    case "KeyK": openMgmt("bank"); break;
    case "KeyO": openMgmt("goals"); break;
    case "KeyG": if (window.CasinoShop && window.CasinoShop.dropCarried()) break; save(false); break; // con una caja en las manos, G la suelta
    case "KeyN": skipTime(); break;
    case "Digit1": setSpeed(1); break; case "Digit2": setSpeed(2); break; case "Digit3": setSpeed(4); break;
  }
});
window.addEventListener("keyup", e => { keys[e.code] = false; if (e.code === "KeyE") useUp(); });
window.addEventListener("blur", () => { for (const k in keys) keys[k] = false; useUp(); });

// táctil: joystick a la izquierda, arrastrar para mirar, botones a la derecha
const stickEl = $("stick"), knob = stickEl.firstElementChild;
let stickId = null, lookId = null, lastLook = null;
stickEl.addEventListener("pointerdown", e => { stickId = e.pointerId; try { stickEl.setPointerCapture(e.pointerId); } catch (x) { /* */ } moveStick(e); });
stickEl.addEventListener("pointermove", e => { if (e.pointerId === stickId) moveStick(e); });
const endStick = e => { if (e.pointerId !== stickId) return; stickId = null; stick.x = stick.y = 0; knob.style.transform = ""; };
stickEl.addEventListener("pointerup", endStick); stickEl.addEventListener("pointercancel", endStick);
function moveStick(e) {
  const r = stickEl.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2); const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
  stick.x = dx; stick.y = dy; knob.style.transform = `translate(${dx * 36}px, ${dy * 36}px)`;
}
canvas.addEventListener("pointerdown", e => { if (e.pointerType === "mouse" || ui.blocking()) return; lookId = e.pointerId; lastLook = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener("pointermove", e => { if (e.pointerId !== lookId || ui.blocking()) return; look(e.clientX - lastLook.x, e.clientY - lastLook.y, 0.005); lastLook = { x: e.clientX, y: e.clientY }; });
const endLook = e => { if (e.pointerId === lookId) lookId = null; };
canvas.addEventListener("pointerup", endLook); canvas.addEventListener("pointercancel", endLook);
const useBtn = $("useBtn");
useBtn.addEventListener("pointerdown", e => { e.preventDefault(); try { useBtn.setPointerCapture(e.pointerId); } catch (x) { /* */ } useDown(); });
for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) useBtn.addEventListener(ev, useUp);
useBtn.addEventListener("contextmenu", e => e.preventDefault());
optBtn.addEventListener("click", openOptions);
$("mgmtBtn").addEventListener("click", () => { if (!ui.blocking()) openMgmt(); });
$("mgmtTopBtn").addEventListener("click", () => { if (!ui.blocking()) openMgmt(); });
$("menuBtn").addEventListener("click", () => { if (!ui.panel && started) renderPause(); });

// =====================================================================
// BUCLE PRINCIPAL
// =====================================================================
function simStep(dt) {
  if (S.dayOver || S.gameOver) return;
  S.minutes += dt * 60 / HOUR;
  const h = Math.floor(S.minutes / 60);
  if (h !== lastHour) { lastHour = h; onHour(h); }
  updateSpawner(dt);
  for (let i = 0; i < customers.length; i++) { const c = customers[i]; if (!c.dead) updateCustomer(c, dt); }
  for (let i = customers.length - 1; i >= 0; i--) if (customers[i].dead) customers.splice(i, 1);
  for (const n of staffNpcs) updateStaffNpc(n, dt);
  updateTables(dt); updateMachines(dt); updateInspector(dt);
  if (window.CasinoLife) window.CasinoLife.update(dt); // reacciones y eventos de la noche (life.js)
  if (window.CasinoShop) window.CasinoShop.update(dt); // camión, fila de la caja y mercado (shop.js)
  if (window.CasinoOwner) window.CasinoOwner.update(dt); // campañas, robo planeado (owner.js)
  if (window.CasinoWorld) window.CasinoWorld.update(dt); // clima, hotel y favores (world.js)
  if (window.CasinoGames) window.CasinoGames.update(dt); // carreras, sesión de bingo y rachas de los dados (games.js)
  if (window.CasinoClients) window.CasinoClients.update(dt); // socios y torneo de póker (clients.js)
  if (window.CasinoCombat) window.CasinoCombat.update(dt); // peleas, sangre y el ataque de la Mafia (combat.js)
  if (S.minutes >= CFG.dayEnd * 60) { S.minutes = CFG.dayEnd * 60; endDay(); }
}
let prev = performance.now(), renderOn = true, pulseT = 0, untoneT = 0;
// v2: las tragamonedas fuera de cámara o lejos no redibujan la pantalla mientras giran (cada redibujo sube una textura a la placa)
const SCREEN_FAR = 16, _frustum = new THREE.Frustum(), _projM = new THREE.Matrix4(), _visSphere = new THREE.Sphere(new THREE.Vector3(), 1.4);
function updateMachineVis() {
  camera.updateMatrixWorld(); _projM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _frustum.setFromProjectionMatrix(_projM);
  for (const m of machines) {
    _visSphere.center.set(m.group.position.x, 1.2, m.group.position.z);
    m.api.far = _visSphere.center.distanceTo(camera.position) > SCREEN_FAR || !_frustum.intersectsSphere(_visSphere);
  }
}
function tick(now) {
  const raw = Math.max(0, (now - prev) / 1000), real = Math.min(0.1, raw); prev = now;
  gfxFrame(raw);
  if (started && !ui.panel && !S.gameOver) {
    updatePlayer(real);
    let dt = S.dayOver || (window.CasinoBuild && window.CasinoBuild.active) ? 0 : real * S.speed; // v3: el modo construcción pausa el tiempo
    while (dt > 1e-6 && !ui.panel) { const s = Math.min(dt, 0.05); simStep(s); dt -= s; }
    updateHold(Math.min(0.25, raw));
  } else if (!started) {
    player.yaw += real * 0.1;
    camera.position.set(Math.sin(now / 9000) * 3, 1.9, -6.5); camera.rotation.set(-0.06, player.yaw, 0);
  }
  for (const a of animated) a.update(real);
  updateMachineVis();
  for (const m of machines) m.api.update(real);
  for (const o of decorObjs) if (o.group.userData.spin) o.group.userData.spin.rotation.y += real * 1.5;
  if (window.CasinoBuild) window.CasinoBuild.update(real);
  updateFloats(real);
  if (window.CasinoLife) window.CasinoLife.frame(real);
  if (window.CasinoShop) window.CasinoShop.frame(real);
  if (window.CasinoOwner) window.CasinoOwner.frame(real); // espejo, manos, auto, acuario (owner.js)
  if (window.CasinoWorld) window.CasinoWorld.frame(real); // cielo, lluvia y relámpagos (world.js)
  if (window.CasinoGames) window.CasinoGames.frame(real);
  if (window.CasinoCombat) window.CasinoCombat.frame(real); // arma en mano, golpes, cámara al caer (combat.js)
  if (window.CasinoGuide) window.CasinoGuide.frame(real); // flecha y cartel de la primera hora (guide.js)
  flushToasts(raw);
  pulseT += real;
  const pulse = Math.sin(pulseT * 3.3);
  markerMat.opacity = markerWideMat.opacity = markerRoundMat.opacity = 0.65 + pulse * 0.25; ghostEdgeMat.opacity = 0.35 + pulse * 0.2;
  dealerPadMat.opacity = 0.3 + pulse * 0.15;
  for (const t of tables) t.pad.visible = !t.staff && !t.def.noDealer;
  if (started) {
    if (!renderOn) scene.updateMatrixWorld();
    updateTarget(); updateHud();
    if (!ui.panel) showPendingRank();
  }
  untoneT -= raw; if (untoneT <= 0) { untoneT = 0.5; untone(scene); } // objetos nuevos (muñecos, cajas, carteles)
  if (window.CasinoJuice) window.CasinoJuice.frame(real); // meta, monedas y festejos; va después de updateHud (juice.js)
  if (renderOn) renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// =====================================================================
// INICIO
// =====================================================================
const pickedDiff = () => { const r = document.querySelector('input[name="diff"]:checked'); return r ? r.value : "normal"; };
const pickedMode = () => { const r = document.querySelector('input[name="mode"]:checked'); return r ? r.value : "historia"; };
const showModePick = on => { const m = $("modePick"); if (m) m.hidden = !on; };
let hadSave = false;
function start(hotData) {
  resize();
  if (isTouch) {
    $("titleKeys").innerHTML = `<kbd>Joystick</kbd><span>Caminar</span><kbd>Arrastrar</kbd><span>Mirar</span><kbd>Usar</kbd><span>Tocar o mantener apretado: comprar, vaciar cajas, reparar, depositar</span><kbd>Opciones</kbd><span>Ajustes de la máquina o mesa que mirás</span><kbd>Gestión</kbd><span>Personal, banco y objetivos</span>`;
    $("mgmtTopBtn").hidden = true;
  } else {
    $("titleKeys").innerHTML = `<kbd>WASD</kbd><span>Caminar (Shift para correr)</span><kbd>Mouse</kbd><span>Mirar</span><kbd>E</kbd><span>Usar · mantené para vaciar cajas y depositar</span><kbd>R</kbd><span>Opciones de lo que mirás: pago, vender</span><kbd>P K O</kbd><span>Personal · Banco · Objetivos</span><kbd>H M</kbd><span>Historia · Sonido</span><kbd>1 2 3 · N</kbd><span>Velocidad · abrir ya</span><kbd>U</kbd><span>Licencias y mejoras</span><kbd>G</kbd><span>Soltar la caja que llevás</span><kbd>L</kbd><span>Logros y ranking</span><kbd>F</kbd><span>Equipar arma (la comprás en la compu) · clic: atacar</span><kbd>Esc</kbd><span>Menú y pausa</span>`;
  }
  if (window.innerWidth < 560 || window.innerHeight < 460) { $("hud").classList.add("compact"); $("hudToggle").textContent = "Más"; }
  const text = (hotData && hotData.save) || readSaveRaw();
  const res = sanitize(text);
  if (res && res.state) { loadState(res.state); hadSave = true; }
  else { loadState(null, "normal"); if (res && res.corrupt) setTimeout(() => toast("La partida guardada estaba dañada y no se pudo cargar. Empezás una nueva.", "bad"), 400); }
  booted = true;
  refreshTitle();
  if (hotData && hotData.started) begin();
  requestAnimationFrame(tick);
}
function refreshTitle() {
  $("btnNew").hidden = !hadSave; $("titleConfirm").hidden = true;
  $("diffPick").hidden = hadSave; showModePick(!hadSave);
  $("btnPlay").textContent = !hadSave ? "Abrir el casino" : S.gameOver ? "Ver el final de la partida" : `Seguir en el día ${S.day}`;
}
function begin(fresh) {
  if (started) return;
  if (!hadSave && !fresh) { loadState(null, pickedDiff(), pickedMode()); hadSave = true; save(true); fresh = true; }
  started = true;
  $("title").hidden = true; $("hud").hidden = false; $("cross").hidden = false; $("topRight").hidden = false;
  if (isTouch) $("touch").hidden = false;
  if (!audio && !window.casinoAudio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audio = null; } }
  updateHud(true);
  if (S.gameOver || S.dayOver) { showReport(); return; }
  if (fresh) {
    toast(`Tu Clásica usada ya está prendida. El casino abre a las 10:00 (tecla N o botón "Abrir ya" para no esperar).`, "good");
    setTimeout(() => toast(window.CasinoShop ? `Para otra máquina, andá a la compu de la oficina (a la derecha de la entrada) y ${isTouch ? "tocá Usar" : "apretá E"}.` : `Mirá un cuadro dorado del piso y ${isTouch ? "tocá Usar" : "apretá E"} para comprar otra máquina.`), 1200);
  } else toast(`¡Bienvenido de vuelta! Día ${S.day}, ${$("hClock").textContent}.`);
  requestPointer();
}
$("btnPlay").addEventListener("click", () => begin());
$("btnNew").addEventListener("click", () => { $("titleConfirm").hidden = false; $("diffPick").hidden = false; showModePick(true); $("btnNew").hidden = true; try { $("titleConfirm").scrollIntoView({ block: "nearest" }); } catch (e) { /* */ } });
$("btnNewNo").addEventListener("click", () => refreshTitle());
$("btnNewYes").addEventListener("click", () => { clearSave(); loadState(null, pickedDiff(), pickedMode()); hadSave = true; save(true); begin(true); });
// v3: modo construcción (decor.js) recibe lo que necesita del juego
if (window.CasinoBuild) window.CasinoBuild.init({
  get S() { return S; }, get started() { return started; }, get inspector() { return inspector; }, D, scene, canvas, isTouch,
  colliders, spotById, slots, tableSpots, decorSpots, machines, tables, decorObjs, customers, staffNpcs, player, ui, SAFE, BAR, TABLE_LAYOUT,
  spawnMachine, despawnMachine, spawnTable, despawnTable, spawnDecor, despawnDecor, sellMachine, sellTable, assignDealers, makePokerTable, makeDecor,
  findPath, unstickPlayer, zoneOpen, gamesCount, attractiveness, Economy, Rank, SFX, fmt, toast, hint, save, updateHud, openPanel, closePanel, openMgmt,
});

// =====================================================================
// MINIJUEGOS (puente) — minigames.js juega a mano el blackjack, la ruleta y las reparaciones; poker.js, el póker
// =====================================================================
window.CasinoMGBridge = {
  get S() { return S; }, get isOpen() { return isOpen; }, D, ui, player, tables, machines,
  Economy, Pocket, Rank, Rep, SFX, toast, hint, floatText, fmt, KEY, isTouch, near,
  leaveCustomer, checkObjectives, addNet, save, updateHud, repairMachine, setSpeed, releasePointer, requestPointer, useUp, sfx,
};

// =====================================================================
// LOCAL MÁS VIVO (puente) — life.js maneja reacciones, quejas y eventos de la noche
// =====================================================================
window.CasinoLifeBridge = {
  get S() { return S; }, get isOpen() { return isOpen; }, get inspector() { return inspector; }, get started() { return started; },
  D, CFG, HOUR, MAX_ACTORS, DOOR, QUEUE, SAFE, BAR, PATROL, KEY, isTouch, scene, camera, ui, player, customers, staffNpcs, machines, tables, colliders,
  Economy, Rep, Heat, Rank, SFX, sfx, toast, hint, fmt, diff, near, floatText, setIcon, setBar, checkObjectives, addNet, save, updateHud,
  goTo, stepAgent, placeAgent, faceTo, turnToward, streetPoint, spawnCustomer, leaveCustomer, despawnCustomer, releaseGame, breakMachine, updateFill, refreshScreen, isFull,
  proxy, dropProxy, boxAt, removeCollider, attractiveness, zoneOpen, dealerHere,
};

// =====================================================================
// TIENDA AL ESTILO TCG (puente) — shop.js: compu, camión, cajas, góndolas, caja registradora; upgrades.js: licencias y mejoras
// =====================================================================
window.CasinoShopBridge = {
  get S() { return S; }, get isOpen() { return isOpen; }, get started() { return started; },
  D, CFG, HOUR, KEY, isTouch, scene, camera, ui, player, machines, customers, staffNpcs,
  Economy, Rep, Rank, SFX, sfx, toast, hint, fmt, floatText, setIcon, setBar, checkObjectives, save, updateHud, openPanel, closePanel,
  proxy, dropProxy, boxAt, removeCollider, goTo, stepAgent, faceTo, releaseGame, leaveCustomer, gamesCount, capOf, installBar, idleOf, backHome,
  near, updateFill, refreshScreen, repairMachine,
};

// =====================================================================
// DUEÑO (puente) — owner.js: imagen (ropa, auto, oficina), publicidad, seguro y robo planeado
// =====================================================================
window.CasinoOwnerBridge = {
  get S() { return S; }, get isOpen() { return isOpen; }, get started() { return started; },
  D, CFG, HOUR, KEY, isTouch, scene, camera, renderer, ui, player, customers, staffNpcs, machines, SAFE, BAR, DOOR,
  Economy, Rep, Heat, Rank, SFX, sfx, toast, hint, fmt, floatText, setIcon, setBar, save, updateHud, openPanel, closePanel, setSpeed,
  proxy, dropProxy, boxAt, removeCollider, goTo, stepAgent, placeAgent, faceTo, turnToward, streetPoint, spawnCustomer, leaveCustomer, despawnCustomer,
  releaseGame, near, blocked, wagesTotal, attractiveness, breakMachine, updateFill, refreshScreen,
};

// =====================================================================
// CIELO, CLIMA, HOTEL Y FAVORES (puente) — world.js
// =====================================================================
window.CasinoWorldBridge = {
  get S() { return S; }, get isOpen() { return isOpen; }, get started() { return started; }, get inspector() { return inspector; }, get gfxLights() { return gfxLights; },
  D, CFG, HOUR, KEY, isTouch, DOOR, scene, camera, ui, player, customers, machines, tables, staffNpcs, moon, hemi, M,
  Economy, Rep, Heat, Rank, SFX, sfx, toast, hint, fmt, floatText, setIcon, checkObjectives, save, updateHud, openPanel, closePanel, openMgmt,
  proxy, dropProxy, boxAt, removeCollider, findPath, goTo, stepAgent, placeAgent, faceTo, spawnCustomer, leaveCustomer, attractiveness, rivalOpen, near,
  releasePointer, requestPointer, unstickPlayer,
};

// =====================================================================
// JUEGOS NUEVOS (puente) — games.js: dados, bingo nocturno y carreras de caballos
// =====================================================================
window.CasinoGamesBridge = {
  get S() { return S; }, get isOpen() { return isOpen; }, get started() { return started; },
  D, CFG, HOUR, MAX_ACTORS, KEY, isTouch, scene, camera, ui, player, tables, customers, decorObjs,
  Economy, Pocket, Rep, Rank, SFX, sfx, toast, hint, fmt, floatText, setIcon, near, addNet, checkObjectives, save, updateHud, openPanel, closePanel,
  spawnTable, despawnTable, assignDealers, spawnCustomer, leaveCustomer, boxAt, removeCollider, releasePointer, requestPointer, rotXZ,
};

// =====================================================================
// SOCIOS Y TORNEO DE PÓKER (puente) — clients.js
// =====================================================================
window.CasinoClientsBridge = {
  get S() { return S; }, get isOpen() { return isOpen; }, get started() { return started; },
  D, CFG, HOUR, KEY, isTouch, LOOKS, RIVAL, ui, player, customers, machines, tables, scene,
  Economy, Rep, Rank, Pocket, SFX, sfx, toast, fmt, floatText, setIcon, save, updateHud, openPanel, closePanel, checkObjectives,
  spawnCustomer, leaveCustomer, releaseGame, goTo, streetPoint, near, dealerAvailable, dealerHere, isFull, zoneOpen, rivalOpen,
};

// =====================================================================
// GUÍA DE LA PRIMERA HORA (puente) — guide.js: flecha dorada y cartel con el próximo paso
// =====================================================================
window.CasinoGuideBridge = {
  get S() { return S; }, get isOpen() { return isOpen; }, get started() { return started; },
  KEY, isTouch, scene, ui, player, machines, SAFE, fmt, isFull,
  pocketCap: () => Pocket.cap(), pocketRoom: () => Pocket.room(),
};

// =====================================================================
// ENGANCHE (puente) — juice.js: meta de la próxima compra, monedas, papel picado y saldo que cuenta
// =====================================================================
window.CasinoJuiceBridge = {
  get S() { return S; }, get started() { return started; }, D, scene, ui, player, machines, tables, panelEl, SFX, fmt, toast, gamesCount,
  maxGames: () => Rank.maxGames(),
};

window.CasinoStaffBridge = {
  get S() { return S; }, D, ui, staffNpcs, tables, machines, staffMax, hireStaff, fireStaff, fireNpc, resyncStaff, releaseNpcTask, releasePerson, assignDealers, SDEF, UPV,
  Economy, toast, fmt, save, updateHud, floatText, sfx, TDEF, diff, wagesTotal,
};

// =====================================================================
// ARMAS, PELEAS Y LA MAFIA (puente) — combat.js
// =====================================================================
window.CasinoCombatBridge = {
  get S() { return S; }, get isOpen() { return isOpen; }, get started() { return started; },
  D, CFG, DOOR, KEY, isTouch, scene, camera, ui, player, customers, machines, tables, staffNpcs, colliders,
  Economy, Rep, Heat, Rank, SFX, sfx, toast, hint, fmt, floatText, setIcon, setBar, save, updateHud, openPanel, closePanel,
  proxy, dropProxy, findPath, goTo, stepAgent, placeAgent, faceTo, turnToward, streetPoint, leaveCustomer, releaseGame, breakMachine, repairMachine,
  fireNpc, assignDealers, acquirePerson, releasePerson, blocked, backHome, idleOf, near, attractiveness,
};

// gancho para pruebas automáticas (no afecta el juego)
window.casinoDebug = {
  get state() { return S; }, player, machines, customers, tables, staff: staffNpcs, slots, tableSpots, decorSpots, colliders,
  get inspector() { return inspector; }, get panel() { return ui.panel; }, get isOpen() { return isOpen; },
  get target() { return target ? target.prompt() : null; }, get started() { return started; },
  teleport(x, z, yaw, pitch) { player.x = x; player.z = z; if (yaw != null) player.yaw = yaw; player.pitch = pitch || 0; },
  skipHours(h) { S.minutes = Math.min(S.minutes + h * 60, CFG.dayEnd * 60 - 0.5); },
  addMoney(n) { Economy.add("other", n); updateHud(true); },
  setRank(l) { l = clamp(l, 1, D.RANKS.length); S.xp = Math.max(S.xp, D.RANKS[l - 1].xp); while (S.rank < l) { S.rank++; } updateHud(true); },
  step(sec, dt) { dt = dt || 0.05; let t = sec; while (t > 1e-6 && !S.dayOver && !S.gameOver) { simStep(Math.min(dt, t)); t -= dt; } updateHud(true); return S.minutes; },
  spawn(type, thief) { return spawnCustomer(type, thief); },
  inspect() { startInspection("prueba"); },
  use() { if (target) target.use(); }, options: openOptions,
  render(on) { renderOn = !!on; },
  get gfx() { return { mode: gfx.mode, scale: gfx.scale, pr: renderer.getPixelRatio(), fps: Math.round(1 / gfx.avg) }; }, gfxSet,
  endDay, nextDay, openMgmt, closePanel: () => closePanel(true),
  fn: { buyBar, installBar, capOf, buyZone, catchThief, serveDrink, breakMachine, repairMachine, collectByPlayer, buyMachine, buyTable, hireStaff, fireStaff, takeLoan, staffMax, startInspection, bribeInspector, rollObjectives, sanitize, serialize, attractiveness, rivalMul, demandPerHour, findPath, Heat, Rank, spotById, sfx },
};
Object.assign(window.casinoDebug.fn, { renderer, Economy, Rep, ui, STICKY, openPanel, closePanel, releasePointer, proxy, dropProxy, scene, camera, boxAt, removeCollider, rival, rivalAtr, rivalOpen, toast, save, updateHud, spawnCustomer }); // historia (story.js)
Object.assign(window.casinoDebug.fn, { showReport, Pocket }); // modos, logros y ranking (challenge.js)
window.claude?.hot?.snapshot?.(() => ({ save: S ? serialize() : null, started }));
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
})();
