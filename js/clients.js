/* Casino Dorado · clients.js — SOCIOS Y TORNEO DE PÓKER
 * 1) Clientes fieles con tarjeta de socio: a un cliente contento le ofrecés la tarjeta (mirarlo + E). El socio queda guardado
 *    (nombre, aspecto, juego favorito, presupuesto, personalidad), vuelve otros días con el mismo aspecto, te saluda y pide cosas
 *    (su máquina, una mesa con apuesta alta, un trago premium, música). Cumplir sube la fidelidad (bronce / plata / oro): vienen
 *    más seguido, apuestan más, traen amigos y dejan propina. Fallar la baja y pueden cancelar la tarjeta. El Faraón a veces los tienta.
 * 2) Torneo de póker semanal (sábados, con mesa de póker): se anuncia unos días antes, vienen famosos, 8 inscriptos pagan la entrada,
 *    la llave (cuartos, semis, final) se simula con el evaluador de poker.js y, si repartís vos en la mesa del torneo, cada mano
 *    suma XP, propina y apura el partido. La casa se queda con una parte del pozo; si sale bien, sube la reputación y viene más gente.
 * Usa window.CasinoClientsBridge (game.js) y los números de D.CLIENTS / D.TOURNEY (data.js). En el guardado: S.clients.
 * Panel propio con la tecla J (también desde Gestión). Secciones: BASE · ESTADO Y GUARDADO · SOCIOS · VISITAS Y PEDIDOS ·
 * TORNEO · PANEL · HUD · API.
 */
(() => {
"use strict";

// =====================================================================
// BASE
// =====================================================================
const G = window.CasinoClientsBridge, D = window.CASINO_DATA, T = window.THREE, A = window.CasinoArt;
if (!G || !D || !D.CLIENTS || !D.TOURNEY || !T || !A) return;
const C = D.CLIENTS, TY = D.TOURNEY, CFG = D.CFG, HOUR = G.HOUR;
const S = () => G.S;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = arr => arr[(Math.random() * arr.length) | 0];
const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; };
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const fmt = n => G.fmt(n);
const isNum = v => typeof v === "number" && Number.isFinite(v);
const alive = c => !!(c && !c.dead && c.person);
const GONE = new Set(["leave", "flee", "caught"]);
const inside = c => alive(c) && !GONE.has(c.state);
const LIFE = () => window.CasinoLife && window.CasinoLife.debug;
const say = (c, text, o) => { const L = LIFE(); try { return L ? L.say(c, text, o) : false; } catch (e) { return false; } };
const emote = (c, id, sec) => { const L = LIFE(); try { if (L) L.emote(c, id, sec); } catch (e) { /* */ } };
const clap = c => { const L = LIFE(); if (!L) return; for (const o of G.customers) if (o !== c && inside(o) && !o.life && Math.hypot(o.x - c.x, o.z - c.z) < 7) try { L.anim(o, "clap", rnd(1.2, 2)); } catch (e) { /* */ } };
const PKR = () => window.CasinoPokerRules;
const MDEF = id => D.MACHINES.find(m => m.id === id);
const TDEF = id => D.TABLES.find(t => t.id === id);
const CTYPE = id => D.CUSTOMER_TYPES.find(t => t.id === id);
const shortName = id => { const m = MDEF(id); if (m) return m.name.replace("Tragamonedas ", ""); const t = TDEF(id); return t ? t.name.replace("Mesa de ", "") : id; };
const gameName = f => f.k === "m" ? `la máquina ${shortName(f.id)}` : `la mesa de ${shortName(f.id)}`;
const DOW = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const dow = day => DOW[((day % 7) + 7) % 7];
const hasUp = id => !!(window.CasinoUp && window.CasinoUp.hasUp && window.CasinoUp.hasUp(id));

const FIRST = ["Don Ernesto", "Coca", "Tito", "Susana", "Beto", "Marta", "Rulo", "Nené", "Pocho", "Graciela", "Chiche", "Mirta", "Cacho", "Lili", "Quique", "Norma", "Pipo", "Estela", "Toto", "Raquel", "Lalo", "Chola", "Fito", "Delia"];
const LAST = ["Ramírez", "Benítez", "Fernández", "Gómez", "Sosa", "Pereyra", "Acosta", "Medina", "Ledesma", "Quiroga", "Romero", "Herrera", "Ojeda", "Vázquez", "Godoy", "Correa", "Paz", "Funes"];
const PERS = [
  { id: "charlatan", name: "Charlatán", desc: "charla con todo el mundo", ok: 1, fail: 1, tip: 1, w: { fav: 1, drink: 1, music: 1.4 } },
  { id: "exigente",  name: "Exigente",  desc: "premia y castiga fuerte",  ok: 1.4, fail: 1.4, tip: 1.3, w: { fav: 1.3, drink: 1, music: 0.7 } },
  { id: "tranquilo", name: "Tranquilo", desc: "perdona casi todo",        ok: 0.9, fail: 0.6, tip: 0.8, w: { fav: 1, drink: 0.8, music: 1 } },
  { id: "fiestero",  name: "Fiestero",  desc: "vive pidiendo tragos y música", ok: 1, fail: 1, tip: 1.2, w: { fav: 0.6, drink: 2, music: 2 } },
  { id: "apostador", name: "Apostador", desc: "apuesta fuerte y quiere su juego", ok: 1.1, fail: 1.1, tip: 1, budget: 1.3, w: { fav: 2.2, drink: 0.7, music: 0.4 } },
];
const PDEF = id => PERS.find(p => p.id === id) || PERS[0];
const LINES = {
  hi: ["¡Hola Manu! Acá estoy de nuevo.", "¡Manu, querido! ¿Cómo va eso?", "Volví, che. Este es mi lugar.", "¡Buenas! Guardame la de siempre.", "¡Mi casino favorito!"],
  thanks: ["¡Así da gusto venir!", "¡Sos un genio, Manu!", "¡Eso es atención!", "Por esto vengo acá y no enfrente."],
  angry: ["¿Y lo que te pedí?", "Así no, Manu...", "Me voy a tener que ir enfrente.", "Qué falta de atención."],
  accept: ["¡Gracias! Nos vemos seguido.", "¡Una tarjeta dorada! Vuelvo mañana.", "¡Me encanta! Soy socio."],
  decline: ["Gracias, pero no me gusta atarme.", "Mmm... lo pienso.", "No, gracias. Vengo cuando pinta."],
  out: ["Me eliminaron... la próxima.", "¡Qué mala suerte con el river!", "Bien jugado, campeón."],
};
// famosos del torneo (aspecto especial: saco de color + anteojos de sol)
const STARS = [
  { name: "El Ruso Kaplan", what: "campeón de póker online", jacket: 0x7a1020, skin: 0xf1c27d, hair: 0x1a1a1a },
  { name: "Mora Valdés", what: "la influencer", jacket: 0x4a1a6a, skin: 0xe0ac69, hair: 0x6a2a14, female: true },
  { name: "Rulo Carreño", what: "el ex arquero", jacket: 0x0f4a3a, skin: 0xc68642, hair: 0x2a1a10 },
  { name: "Pocha Linares", what: "la vedette", jacket: 0xf1ece0, skin: 0xffdbac, hair: 0xc9b28a, female: true },
  { name: "Tano Bertolotti", what: "el chef de la tele", jacket: 0x23324a, skin: 0xe0ac69, hair: 0x8a8a8a },
];
const PLAYERS = ["Mano Firme Ortiz", "La Turca Haddad", "Tiburón Peña", "Chino Ibarra", "Doña Elvira", "Nacho All-in", "El Profe Suárez", "Gringa Müller", "Fede Bluff", "Tucu Salinas", "Rubia Ocampo", "Pelado Ríos"];
const ROUND_NAMES = ["Cuartos de final", "Semifinal", "Final"];

// accesorios y distintivos (geometría y materiales compartidos)
const shadesGeo = new T.BoxGeometry(0.2, 0.045, 0.03), shadesMat = new T.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.2, metalness: 0.6 });
const BADGE = C.levels.map(lv => new T.SpriteMaterial({ map: A.canvasTex(64, 64, g => {
  g.fillStyle = "rgba(7,20,15,.9)"; g.beginPath(); g.arc(32, 32, 29, 0, 7); g.fill();
  g.fillStyle = lv.color; g.fillRect(12, 20, 40, 26); g.fillStyle = "rgba(7,20,15,.75)"; g.fillRect(12, 25, 40, 5);
  g.fillStyle = "#fff"; g.font = "bold 15px Arial"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("SOCIO", 32, 39);
}), transparent: true, depthWrite: false }));

// =====================================================================
// ESTADO Y GUARDADO (S.clients) — todo validado: un guardado viejo o roto arranca vacío
// =====================================================================
function fresh() { return { v: 1, day: 0, next: 1, members: [], gone: [], tour: { ann: 0, run: null, last: null, count: 0 }, st: { cards: 0, ok: 0, fail: 0, visits: 0 } }; }
const int = (v, d, lo, hi) => isNum(v) ? clamp(Math.round(v), lo, hi) : d;
const str = (v, n) => typeof v === "string" && v ? v.slice(0, n || 60) : null;
const col = v => isNum(v) && v >= 0 && v <= 0xffffff ? Math.round(v) : null;
function cleanLook(L, id) {
  if (!L || typeof L !== "object") return null;
  const o = { skin: col(L.skin), hair: col(L.hair) };
  if (o.skin == null || o.hair == null) return null;
  for (const k of ["shirt", "pants", "jacket", "cap"]) { const v = col(L[k]); if (v != null) o[k] = v; }
  o.female = !!L.female; o.vip = !!L.vip; o.height = isNum(L.height) ? clamp(L.height, 0.85, 1.15) : 1;
  o.key = "m" + id;
  return o;
}
function validReq(r) {
  if (!r || typeof r !== "object") return null;
  const kind = r.kind;
  if (kind === "machine" && !MDEF(r.target)) return null;
  if (kind === "table" && !TDEF(r.target)) return null;
  if (!["machine", "table", "drink", "music"].includes(kind)) return null;
  if (r.due !== "next") return null; // los pedidos "de esta visita" no sobreviven a una recarga
  return { kind, target: str(r.target, 20), text: str(r.text, 80) || "", day: int(r.day, 1, 1, 1e6), due: "next" };
}
function sanitize(raw) {
  const s = fresh();
  if (!raw || typeof raw !== "object") return s;
  s.day = int(raw.day, 0, 0, 1e6); s.next = int(raw.next, 1, 1, 1e7);
  if (raw.st && typeof raw.st === "object") for (const k in s.st) s.st[k] = int(raw.st[k], 0, 0, 1e7);
  const ids = new Set();
  for (const m of Array.isArray(raw.members) ? raw.members : []) {
    if (s.members.length >= C.maxMembers) break;
    if (!m || typeof m !== "object") continue;
    const id = int(m.id, 0, 1, 1e7), name = str(m.name, 40), type = CTYPE(m.type), look = cleanLook(m.look, id);
    if (!id || ids.has(id) || !name || !type || !look) continue;
    const fav = m.fav && typeof m.fav === "object" && ((m.fav.k === "m" && MDEF(m.fav.id)) || (m.fav.k === "t" && TDEF(m.fav.id))) ? { k: m.fav.k, id: m.fav.id } : { k: "m", id: "clasica" };
    const pts = isNum(m.pts) ? clamp(m.pts, 0, C.maxPts) : C.startPts;
    if (pts <= 0) continue;
    ids.add(id); s.next = Math.max(s.next, id + 1);
    s.members.push({ id, name, type: type.id, look, fav, budget: int(m.budget, type.budget[0], 50, 1e6), pers: PDEF(m.pers).id, pts,
      joined: int(m.joined, 1, 1, 1e6), last: int(m.last, 1, 0, 1e6), visits: int(m.visits, 1, 0, 1e6), ok: int(m.ok, 0, 0, 1e6), fail: int(m.fail, 0, 0, 1e6),
      req: validReq(m.req), poach: m.poach && typeof m.poach === "object" && isNum(m.poach.until) ? { until: int(m.poach.until, 1, 1, 1e6) } : null });
  }
  s.gone = (Array.isArray(raw.gone) ? raw.gone : []).filter(g => g && str(g.name)).slice(-8).map(g => ({ name: str(g.name, 40), why: str(g.why, 80) || "", day: int(g.day, 1, 1, 1e6) }));
  const t = raw.tour;
  if (t && typeof t === "object") {
    s.tour.ann = int(t.ann, 0, 0, 1e6); s.tour.count = int(t.count, 0, 0, 1e6);
    const L = t.last;
    if (L && typeof L === "object" && str(L.winner)) s.tour.last = { day: int(L.day, 1, 1, 1e6), winner: str(L.winner, 40), hand: str(L.hand, 60) || "", pot: int(L.pot, 0, 0, 1e8), house: int(L.house, 0, 0, 1e8), prize: int(L.prize, 0, 0, 1e8), good: !!L.good };
    s.tour.run = cleanRun(t.run);
  }
  return s;
}
function cleanRun(r) {
  if (!r || typeof r !== "object" || !Array.isArray(r.ents) || r.ents.length !== TY.entrants || !Array.isArray(r.rounds)) return null;
  const n = TY.entrants;
  const ents = r.ents.map((e, i) => e && str(e.name) ? { name: str(e.name, 40), star: isNum(e.star) && STARS[e.star] ? e.star : -1, mem: int(e.mem, 0, 0, 1e7), out: !!e.out } : null);
  if (ents.some(e => !e)) return null;
  const rounds = [];
  for (const rd of r.rounds.slice(0, 3)) {
    if (!Array.isArray(rd)) return null;
    const ms = rd.map(m => m && isNum(m.a) && isNum(m.b) && m.a >= 0 && m.a < n && m.b >= 0 && m.b < n ? { a: m.a | 0, b: m.b | 0, w: m.w === m.a || m.w === m.b ? m.w | 0 : -1, sa: int(m.sa, 0, 0, 9), sb: int(m.sb, 0, 0, 9), hand: str(m.hand, 60) || "" } : null);
    if (ms.some(m => !m) || !ms.length) return null;
    rounds.push(ms);
  }
  if (!rounds.length) return null;
  const phase = ["wait", "run", "done", "cancel"].includes(r.phase) ? r.phase : "wait";
  return { day: int(r.day, 1, 1, 1e6), phase, ents, rounds, pot: int(r.pot, 0, 0, 1e8), timer: isNum(r.timer) ? clamp(r.timer, 0, TY.matchSec) : TY.matchSec,
    cov: isNum(r.cov) ? Math.max(0, r.cov) : 0, covT: isNum(r.covT) ? Math.max(0, r.covT) : 0, hands: int(r.hands, 0, 0, 999), good: r.good == null ? null : !!r.good,
    winner: int(r.winner, -1, -1, n - 1), hand: str(r.hand, 60) || "", house: int(r.house, 0, 0, 1e8), prize: int(r.prize, 0, 0, 1e8), started: !!r.started };
}
let validated = null; // el objeto S.clients ya validado (si cambia, es otra partida o un guardado recién cargado)
function st() {
  const s = S(); if (!s) return null;
  if (!s.clients || s.clients !== validated) { s.clients = sanitize(s.clients); validated = s.clients; resetRuntime(); }
  return s.clients;
}

// runtime (no se guarda)
let live = [];            // clientes en el local que son socios
let sched = null;         // { day, list: [{ id, at }] } horarios de visita de hoy
let dayStat = { day: 0, visits: 0, ok: 0, fail: 0, cards: 0 };
let tourC = {};           // entrante → cliente sentado en la mesa
let tourSpawned = null;   // la corrida para la que ya se sentaron los jugadores
let handsSeen = 0, pendingWin = null, lastHappyT = 0;
function resetRuntime() { live = []; sched = null; tourC = {}; tourSpawned = null; pendingWin = null; handsSeen = S() ? S().today.st.handsByHand : 0; dayStat = { day: S() ? S().day : 0, visits: 0, ok: 0, fail: 0, cards: 0 }; }

// =====================================================================
// SOCIOS
// =====================================================================
const level = m => { let L = C.levels[0]; for (const lv of C.levels) if (m.pts >= lv.min) L = lv; return L; };
const levelIdx = m => C.levels.indexOf(level(m));
const byId = id => { const cs = st(); return cs ? cs.members.find(m => m.id === id) || null : null; };
const memberOf = c => c && c.member ? byId(c.member) : null;
function addBadge(c, m) {
  if (!alive(c)) return;
  let b = c.person.clBadge;
  if (!b) { b = new T.Sprite(BADGE[0]); b.scale.set(0.22, 0.22, 1); b.position.set(0.3, 1.95, 0); b.renderOrder = 12; c.person.group.add(b); c.person.clBadge = b; }
  b.material = BADGE[levelIdx(m)]; b.visible = true;
}
function dropBadge(c) { if (c && c.person && c.person.clBadge) c.person.clBadge.visible = false; }
function addShades(c) {
  if (!alive(c)) return;
  const m = new T.Mesh(shadesGeo, shadesMat); m.position.set(0, 0.155, 0.12);
  c.person.api.joints.head.add(m); (c.clAcc || (c.clAcc = [])).push(m);
}
function dropAcc(c) { if (c.clAcc) for (const m of c.clAcc) if (m.parent) m.parent.remove(m); c.clAcc = null; }

// satisfacción estimada mientras está adentro (la misma cuenta que game.js hace al irse)
function estSat(c) {
  const f = c.flags || {};
  let s = CFG.satBase;
  if (f.won) s += CFG.satWin; if (f.waited) s += CFG.satWaited; if (f.broken) s += CFG.satBroken;
  if (c.wantsDrink && c.played) s += f.drinkOk ? CFG.satDrink : c.drink && c.drink.state === "missed" ? CFG.satNoDrink : 0;
  if (c.lowAtr) s += CFG.satLowDecor; if (f.notGreeted) s += CFG.satNoDrink;
  s += c.lifeMood || 0;
  if (c.rtp != null) s += (c.rtp - 0.9) * CFG.satRtpK;
  return clamp(s, 0, 1);
}
function canOffer(c) {
  const s = S(), cs = st();
  if (!s || !cs || s.rank < C.minRank || cs.members.length >= C.maxMembers) return false;
  if (!alive(c) || c.thief || c.life || c.member || c.tourney || c.clDeclined || !c.played || !CTYPE(c.type.id)) return false;
  if (!["play", "queue", "walk", "choose"].includes(c.state)) return false;
  return estSat(c) >= C.happySat;
}
function uniqueName() {
  const cs = st(), used = new Set(cs.members.map(m => m.name));
  for (let k = 0; k < 40; k++) { const n = pick(FIRST) + " " + pick(LAST); if (!used.has(n)) return n; }
  return pick(FIRST) + " " + pick(LAST) + " " + cs.next;
}
function lookOf(c, id) {
  // el muñeco salió de LOOKS[tipo][índice] (game.js lo nombra "tipo:índice"): el socio conserva exactamente ese aspecto
  const k = c.person && c.person.kind ? String(c.person.kind).split(":") : [];
  const list = G.LOOKS[k[0]], L = list && list[(+k[1] || 0) % list.length];
  const base = L ? Object.assign({}, L) : { skin: pick(A.SKINS || [0xe0ac69]), hair: 0x2a1a10, shirt: 0x2a6fd6, pants: 0x1e2430 };
  return cleanLook(base, id);
}
function favFor(c) {
  const owned = new Set(G.machines.map(m => m.def.id).concat(G.tables.map(t => t.def.id)));
  const prefers = (c.type.prefers || []).filter(id => MDEF(id) || TDEF(id));
  const missing = prefers.filter(id => !owned.has(id));
  let id;
  if (missing.length && Math.random() < 0.4) id = pick(missing);               // un gusto que todavía no tenés: lo va a pedir
  else if (c.machine) id = c.machine.def.id; else if (c.table) id = c.table.def.id; else id = prefers[0] || "clasica";
  return { k: MDEF(id) ? "m" : "t", id };
}
function offer(c) {
  if (!canOffer(c)) return false;
  if (Math.random() >= C.acceptChance) {
    c.clDeclined = true; say(c, pick(LINES.decline), { forced: true }); G.toast("No quiso la tarjeta de socio. Probá con otro cliente contento.", ""); return false;
  }
  makeMember(c); return true;
}
function makeMember(c) {
  const cs = st(), s = S(), id = cs.next++;
  const look = lookOf(c, id); if (!look) return null;
  const type = CTYPE(c.type.id);
  const m = { id, name: uniqueName(), type: type.id, look, fav: favFor(c), budget: Math.round(rndi(type.budget[0], type.budget[1])), pers: pick(PERS).id,
    pts: C.startPts, joined: s.day, last: s.day, visits: 1, ok: 0, fail: 0, req: null, poach: null };
  cs.members.push(m); cs.st.cards++; dayStat.cards++;
  c.member = id; c.clName = m.name; c.cl = { hi: true, req: null, t: 0 };
  if (!live.includes(c)) live.push(c);
  addBadge(c, m); emote(c, "heart", 3); say(c, pick(LINES.accept), { forced: true });
  G.Rank.add(10); G.sfx("greet"); G.Rep.change(0.5);
  G.toast(`¡${m.name} aceptó la tarjeta de socio! Le gusta ${gameName(m.fav)} y es ${PDEF(m.pers).name.toLowerCase()}. Va a volver y te va a pedir cosas (J: socios).`, "good");
  G.save(true);
  return m;
}
function addPts(m, d, quiet) {
  if (!m) return;
  const before = levelIdx(m);
  m.pts = clamp(m.pts + d, 0, C.maxPts);
  const after = levelIdx(m);
  for (const c of live) if (c.member === m.id) addBadge(c, m);
  if (m.pts <= 0) { cancel(m, "canceló la tarjeta: lo atendieron mal"); return; }
  if (quiet) return;
  if (after > before) { G.toast(`${m.name} ahora es socio ${level(m).name}: viene más seguido, apuesta más${after >= 2 ? ", trae amigos y deja propina" : " y deja propina"}.`, "good"); G.sfx("goal"); }
  else if (after < before) G.toast(`${m.name} bajó a socio ${level(m).name}.`, "bad");
}
function cancel(m, why) {
  const cs = st(); if (!cs) return;
  const i = cs.members.indexOf(m); if (i < 0) return;
  cs.members.splice(i, 1);
  cs.gone.push({ name: m.name, why, day: S().day }); if (cs.gone.length > 8) cs.gone.shift();
  for (const c of live) if (c.member === m.id) { dropBadge(c); c.member = null; c.cl = null; }
  live = live.filter(c => c.member);
  G.Rep.change(-1);
  G.toast(`${m.name} ${why}.`, "bad"); G.SFX.bad();
}

// =====================================================================
// VISITAS Y PEDIDOS
// =====================================================================
function owns(r) {
  if (r.kind === "machine") return G.machines.some(m => m.def.id === r.target && !m.dead);
  if (r.kind === "table") return G.tables.some(t => t.def.id === r.target && !t.dead);
  return true;
}
function favReq(m, due) {
  const k = m.fav.k === "m" ? "machine" : "table";
  const text = k === "machine" ? `${due === "next" ? "La próxima quiero" : "Quiero"} la máquina ${shortName(m.fav.id)}` : `${due === "next" ? "La próxima quiero" : "Quiero"} mesa de ${shortName(m.fav.id)} con apuesta alta`;
  return { kind: k, target: m.fav.id, text, day: S().day, due };
}
function rollReq(m) {
  const p = PDEF(m.pers), opts = [];
  opts.push({ w: p.w.fav * 1.2, r: () => { const r = favReq(m, "visit"); return owns(r) ? r : favReq(m, "next"); } });
  if (S().bar) opts.push({ w: p.w.drink, r: () => ({ kind: "drink", target: "premium", text: "Un trago premium, por favor", day: S().day, due: "visit" }) });
  opts.push({ w: p.w.music * 0.8, r: () => ({ kind: "music", target: "tema", text: "Poné música, che", day: S().day, due: "visit" }) });
  let tot = 0; for (const o of opts) tot += o.w;
  let x = Math.random() * tot;
  for (const o of opts) { x -= o.w; if (x <= 0) return o.r(); }
  return opts[0].r();
}
// activa un pedido en esta visita (los de "la próxima" quedan guardados en el socio)
function startReq(c, m, r) {
  if (r.due === "next") { m.req = r; c.cl.req = null; return; }
  m.req = r; c.cl.req = Object.assign({ playT: 0, left: C.reqSec * HOUR, t: 0, done: false }, r);
  if (r.kind === "drink") { c.wantsDrink = true; if (c.state === "play" && S().bar && (!c.drink || c.drink.state === "missed" || c.drink.state === "served")) { c.drink = { state: "want", left: HOUR, by: null }; c.flags.drinkOk = false; G.setIcon(c.person, "drink"); } }
  if (r.kind === "table") { const def = TDEF(r.target); c.betMax = Math.max(c.betMax, def.maxBet); c.betMin = Math.max(c.betMin, Math.min(def.maxBet, def.minBet * 3)); c.budget = Math.max(c.budget, def.maxBet * 10); }
  if (r.kind === "machine") { const def = MDEF(r.target); c.betMax = Math.max(c.betMax, def.bet); c.betMin = Math.min(c.betMin, def.bet); c.budget = Math.max(c.budget, def.bet * 20); }
}
function spawnMember(m) {
  const s = S(), lv = level(m), p = PDEF(m.pers);
  const c = G.spawnCustomer(m.type, false, m.look);
  if (!c) return null;
  c.member = m.id; c.clName = m.name; c.cl = { hi: false, req: null, t: 0 };
  c.budget = Math.round(m.budget * lv.budgetMul * (p.budget || 1) * rnd(0.85, 1.15));
  c.betMax = Math.round(c.betMax * lv.betMul); c.rounds = Math.round(c.rounds * (1 + 0.2 * levelIdx(m)));
  m.visits++; m.last = s.day; st().st.visits++; dayStat.visits++;
  live.push(c); addBadge(c, m);
  // pedido: el que quedó pendiente de la visita anterior, o uno nuevo
  let msg = "";
  if (m.req && m.req.due === "next") {
    const r = m.req;
    if (owns(r)) { startReq(c, m, Object.assign({}, r, { due: "visit", text: r.text.replace("La próxima quiero", "Quiero") })); msg = ` Viene por lo que pidió: ${r.text.replace("La próxima quiero", "")}.`; }
    else { m.req = null; failReq(c, m, `${m.name} volvió y no está lo que te pidió (${r.text.replace("La próxima quiero ", "")})`); }
  }
  if (!c.cl.req && !m.req && Math.random() < C.reqChance) { const r = rollReq(m); startReq(c, m, r); }
  const r = c.cl.req || m.req;
  G.toast(`Llegó tu socio ${m.name} (${lv.name})${r ? `: «${r.text}»` : ""}.${msg}${m.poach ? ` ${G.RIVAL.name} lo está tentando: que la visita salga bien.` : ""}`, "good");
  G.sfx("door", c.x, c.z);
  // los de plata y oro traen amigos
  let fr = lv.friends; while (fr > 0) { if (Math.random() < Math.min(1, fr)) { const f = G.spawnCustomer(pick(C.friendTypes)); if (f) f.clFriend = m.id; } fr -= 1; }
  return c;
}
function fulfill(c, m, why) {
  const r = c && c.cl && c.cl.req; if (!r || r.done) return false;
  r.done = true; m.req = null;
  const p = PDEF(m.pers);
  m.ok++; st().st.ok++; dayStat.ok++;
  addPts(m, C.reqOk * p.ok);
  G.Rank.add(C.xpReq);
  emote(c, "heart", 3); say(c, pick(LINES.thanks), { forced: true }); G.sfx("goal");
  G.toast(`${m.name}: ¡pedido cumplido! ${why || ""} (+fidelidad)`, "good");
  if (c.person) G.floatText(c.x, 2.4, c.z, "♥ socio", "#f0c24a");
  return true;
}
function failReq(c, m, why) {
  if (c && c.cl && c.cl.req) c.cl.req.done = true;
  m.req = null; m.fail++; st().st.fail++; dayStat.fail++;
  if (c) { c.cl.failed = true; emote(c, "angry", 3); say(c, pick(LINES.angry), { forced: true, tone: "bad" }); }
  G.toast(`${why}. Baja su fidelidad.`, "bad");
  addPts(m, C.reqFail * PDEF(m.pers).fail);
}
function updateMember(c, dt) {
  const m = memberOf(c); if (!m) return;
  const cl = c.cl; cl.t += dt;
  if (!cl.hi && c.state !== "enter" && G.near(c.x, c.z, 6)) { cl.hi = true; say(c, pick(LINES.hi).replace("Manu", "Manu"), { forced: true }); emote(c, "happy", 2.5); }
  const r = cl.req; if (!r || r.done) return;
  r.t += dt;
  if (r.kind === "machine" || r.kind === "table") {
    const on = c.state === "play" && ((c.machine && c.machine.def.id === r.target) || (c.table && c.table.def.id === r.target && G.dealerHere(c.table)));
    if (on) { r.playT += dt; if (r.playT >= C.playSec) fulfill(c, m, r.kind === "machine" ? `Está jugando en la ${shortName(r.target)}.` : `Tiene su mesa de ${shortName(r.target)} con apuesta alta.`); }
  } else if (r.kind === "drink") {
    if (!S().bar) { failReq(c, m, `${m.name} quería un trago premium y no hay barra`); return; }
    if (c.flags.drinkOk) { G.Economy.add("members", C.premiumDrink); fulfill(c, m, `Trago premium servido (+${fmt(C.premiumDrink)}).`); return; }
    r.left -= dt;
    if ((c.drink && c.drink.state === "missed") || r.left <= 0) { failReq(c, m, `A ${m.name} nunca le llegó su trago premium`); return; }
  } else if (r.kind === "music") {
    r.left -= dt;
    if (hasUp("musica") && r.t > 4) { fulfill(c, m, "El trío de jazz tocó su tema."); return; }
    if (r.left <= 0) failReq(c, m, `Nadie le puso música a ${m.name}`);
  }
}
// game.js → al irse (sat = satisfacción final 0..1)
function onLeave(c, sat, wasPlaying) {
  const m = memberOf(c); if (!m || !c.cl) return;
  const r = c.cl.req;
  if (r && !r.done) failReq(c, m, `${m.name} se fue sin ${r.kind === "drink" ? "su trago premium" : r.kind === "music" ? "su música" : gameName({ k: r.kind === "machine" ? "m" : "t", id: r.target })}`);
  if (!byId(m.id)) return; // canceló
  const good = sat >= 0.6 && !c.cl.failed, bad = sat < 0.4;
  if (wasPlaying || c.played) addPts(m, good ? C.visitGood : bad ? C.visitBad : 0, true);
  if (!byId(m.id)) return;
  const lv = level(m);
  if (good && lv.tip > 0) {
    const tip = Math.round(lv.tip * PDEF(m.pers).tip * rnd(0.8, 1.2) / 5) * 5;
    G.Economy.add("members", tip); if (c.person) G.floatText(c.x, 2.3, c.z, "Propina +" + fmt(tip), "#6fd39b"); G.SFX.coin();
  }
  if (m.poach) {
    if (good) { m.poach = null; addPts(m, C.poachKeep, true); G.toast(`${m.name} rechazó la oferta de ${G.RIVAL.name}: se queda con vos.`, "good"); }
    else cancel(m, `se fue con ${G.RIVAL.name}: la visita no lo convenció`);
    if (!byId(m.id)) return;
  }
  // si no tenés su juego favorito, te lo pide para la próxima
  if (!m.req && Math.random() < 0.5) { const fr = favReq(m, "next"); if (!owns(fr)) m.req = fr; }
  c.cl.req = null;
}
function onDespawn(c) {
  dropBadge(c); dropAcc(c);
  const i = live.indexOf(c); if (i >= 0) live.splice(i, 1);
  if (c.tourney) for (const k in tourC) if (tourC[k] === c) delete tourC[k];
  const m = memberOf(c);
  if (m && m.req && m.req.due === "visit") m.req = null; // cierre del día: el pedido de esta visita se olvida
}
function buildSched() {
  const s = S(), cs = st();
  sched = { day: s.day, list: [] };
  for (const m of cs.members) {
    if (m.last === s.day && m.visits > 0 && m.joined !== s.day) continue; // ya vino hoy (recarga a mitad del día)
    if (m.joined === s.day) continue;
    let p = level(m).visit + (m.req ? 0.15 : 0); if (m.poach) p = 1;
    if (Math.random() < p) sched.list.push({ id: m.id, at: rnd(CFG.open + 0.4, CFG.close - 3) * 60 });
  }
  sched.list.sort((a, b) => a.at - b.at);
}
function newDay(cs) {
  const s = S(), day = s.day;
  cs.day = day; dayStat = { day, visits: 0, ok: 0, fail: 0, cards: 0 }; handsSeen = s.today.st.handsByHand;
  for (const m of cs.members.slice()) {
    if (m.req && m.req.due === "visit") m.req = null;
    if (m.poach && day > m.poach.until) { cancel(m, `se pasó a ${G.RIVAL.name}: no vino a tu casino mientras lo tentaban`); continue; }
    if (day - m.last > C.noShowDays) addPts(m, C.noShowPts, true);
  }
  if (G.rivalOpen() && cs.members.length && Math.random() < C.poachChance) {
    const cand = cs.members.filter(m => !m.poach && (levelIdx(m) < 2 || Math.random() < 0.3));
    if (cand.length) { const m = pick(cand); m.poach = { until: day + C.poachDays }; G.toast(`${G.RIVAL.name} le ofreció su tarjeta a tu socio ${m.name}. Si su próxima visita no sale bien (en ${C.poachDays} días), se va enfrente.`, "bad"); }
  }
  tourNewDay(cs);
  sched = null;
}

// =====================================================================
// TORNEO DE PÓKER
// =====================================================================
const tourTable = () => G.tables.find(t => t.def.id === "poker" && !t.dead) || null;
const isTourDay = day => ((day % 7) + 7) % 7 === TY.weekday;
function nextTourDay(day) { let d = day; while (!isTourDay(d)) d++; return d; }
function tourNewDay(cs) {
  const s = S(), day = s.day, tour = cs.tour;
  if (tour.run && tour.run.day !== day) tour.run = null;
  if (!tourTable()) { if (s.rank >= 6 && isTourDay(day + 1)) hintOnce("tourPk", "Con una mesa de póker podés organizar el torneo de los sábados: famosos, inscripciones y mucha gente."); return; }
  const nd = nextTourDay(day);
  if (nd - day <= TY.announceDays && tour.ann !== nd) {
    tour.ann = nd;
    G.toast(nd === day ? `¡Hoy es el torneo de póker! Llegan los jugadores a las ${hhmm(TY.arriveHour)} y arranca a las ${hhmm(TY.startHour)}.`
      : `Anunciaste el torneo de póker del ${dow(nd)} (día ${nd}) a las ${hhmm(TY.startHour)}: ${TY.entrants} jugadores, famosos e inscripción de ${fmt(TY.fee)}.`, "good");
  }
  if (nd === day && !tour.run) tour.run = makeRun(day);
}
function hintOnce(id, msg) { const s = S(); if (!s.hints["cl_" + id]) { s.hints["cl_" + id] = 1; G.toast(msg); } }
const hhmm = h => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
function makeRun(day) {
  const cs = st(), ents = [];
  for (const i of shuffle(STARS.map((_, i) => i)).slice(0, TY.celebs)) ents.push({ name: STARS[i].name, star: i, mem: 0, out: false });
  const mems = cs.members.slice().sort((a, b) => (b.fav.id === "poker") - (a.fav.id === "poker") || b.pts - a.pts).slice(0, 2);
  for (const m of mems) ents.push({ name: m.name, star: -1, mem: m.id, out: false });
  const names = shuffle(PLAYERS.slice());
  while (ents.length < TY.entrants) ents.push({ name: names.pop(), star: -1, mem: 0, out: false });
  // los famosos y los socios se sientan en la mesa (primeros 6); la llave se sortea
  const order = shuffle(ents.map((_, i) => i)), r0 = [];
  for (let i = 0; i < order.length; i += 2) r0.push({ a: order[i], b: order[i + 1], w: -1, sa: 0, sb: 0, hand: "" });
  return { day, phase: "wait", ents, rounds: [r0], pot: TY.fee * TY.entrants, timer: TY.matchSec, cov: 0, covT: 0, hands: 0, good: null, winner: -1, hand: "", house: 0, prize: 0, started: false };
}
function curMatch(run) { const rd = run.rounds[run.rounds.length - 1]; return rd.find(m => m.w < 0) || null; }
const roundName = run => ROUND_NAMES[Math.min(run.rounds.length - 1, 2)];
// un partido al mejor de 3 manos, con el evaluador de poker.js
function simMatch(m) {
  const PK = PKR(); let hand = "";
  const wins = [0, 0];
  for (let h = 0; h < 9 && wins[0] < TY.winsToAdvance && wins[1] < TY.winsToAdvance; h++) {
    if (!PK) { wins[Math.random() < 0.5 ? 0 : 1]++; continue; }
    const r = PK.playAuto([{ id: 0, type: "highroller", stack: 4000 }, { id: 1, type: "highroller", stack: 4000 }], 100, h);
    if (r.winners.length !== 1) continue;
    const w = r.winners[0]; wins[w]++;
    hand = r.showdown ? PK.name(PK.best(r.H.ps[w].cards.concat(r.H.board))) : "un farol que hizo retirar al rival";
  }
  if (wins[0] === wins[1]) wins[Math.random() < 0.5 ? 0 : 1]++;
  m.sa = wins[0]; m.sb = wins[1]; m.w = wins[0] > wins[1] ? m.a : m.b; m.hand = hand || "carta alta";
  return m;
}
function playMatch(run) {
  const m = curMatch(run); if (!m) return;
  simMatch(m);
  const W = run.ents[m.w], L = run.ents[m.w === m.a ? m.b : m.a];
  L.out = true;
  const lc = tourC[run.ents.indexOf(L)], wc = tourC[m.w];
  if (alive(lc)) { say(lc, pick(LINES.out), { forced: true }); emote(lc, "sad", 3); lc.rounds = 0; G.leaveCustomer(lc); }
  if (alive(wc) && wc.person) { wc.person.api.cheer(1.4); emote(wc, "money", 2.5); }
  G.sfx("chips", tourTable() ? tourTable().center.x : 0, tourTable() ? tourTable().center.z : 0);
  G.toast(`Torneo · ${roundName(run)}: ${W.name} le ganó a ${L.name} ${Math.max(m.sa, m.sb)}-${Math.min(m.sa, m.sb)} (${m.hand}).`, "");
  const rd = run.rounds[run.rounds.length - 1];
  if (rd.every(x => x.w >= 0)) {
    if (rd.length === 1) { finishRun(run, m); return; }
    const nx = []; for (let i = 0; i < rd.length; i += 2) nx.push({ a: rd[i].w, b: rd[i + 1].w, w: -1, sa: 0, sb: 0, hand: "" });
    run.rounds.push(nx);
    G.toast(`Torneo de póker: arranca la ${roundName(run).toLowerCase()}${nx.length === 1 ? `: ${run.ents[nx[0].a].name} contra ${run.ents[nx[0].b].name}` : ""}.`, "good");
  }
}
function finishRun(run, last, quiet) {
  const s = S(), cs = st();
  run.phase = "done"; run.winner = last.w; run.hand = last.hand;
  run.house = Math.round(run.pot * TY.houseShare); run.prize = run.pot - run.house;
  G.Economy.add("tourney", run.house);
  const cover = run.covT > 0 ? run.cov / run.covT : 0;
  run.good = cover >= TY.goodCoverage || run.hands >= TY.goodHands;
  if (run.good) { G.Rep.change(TY.goodRep); G.Rank.add(TY.goodXp); for (const c of live) { const m = memberOf(c); if (m) addPts(m, 3, true); } }
  else G.Rep.change(TY.badRep);
  const W = run.ents[run.winner];
  cs.tour.last = { day: run.day, winner: W.name, hand: run.hand, pot: run.pot, house: run.house, prize: run.prize, good: run.good };
  cs.tour.count++;
  const t = tourTable(); if (t) t.reserved = false;
  for (const k in tourC) { const c = tourC[k]; if (alive(c) && !GONE.has(c.state)) c.rounds = Math.min(c.rounds, rndi(2, 6)); }
  if (W.mem) { const m = byId(W.mem); if (m) addPts(m, 15); }
  G.checkObjectives(); G.save(true);
  if (quiet) return;
  const wc = tourC[run.winner];
  if (alive(wc) && wc.person) { wc.person.api.cheer(3); emote(wc, "party", 4); say(wc, "¡Soy el campeón del Torneo Dorado!", { forced: true }); clap(wc); }
  G.sfx("cheer"); G.sfx("jackpot");
  G.toast(`🏆 ¡${W.name} ganó el torneo de póker con ${run.hand}! Premio ${fmt(run.prize)} · la casa se queda ${fmt(run.house)}.${run.good ? ` Salió bárbaro: +${TY.goodRep} de reputación y viene más gente.` : " Faltó croupier en la mesa: los jugadores se quejaron."}`, run.good ? "good" : "bad");
  pendingWin = run;
}
function spawnTourPlayers(run) {
  tourSpawned = run; const t = tourTable(); if (!t) return;
  let n = 0;
  run.ents.forEach((e, i) => {
    if (e.out || n >= Math.min(TY.physical, t.seats.length) || alive(tourC[i])) return;
    let look = null;
    if (e.star >= 0) { const st0 = STARS[e.star]; look = { vip: true, jacket: st0.jacket, skin: st0.skin, hair: st0.hair, female: !!st0.female, height: 1.02, key: "star" + e.star }; }
    else if (e.mem) { const m = byId(e.mem); if (m && !live.some(c => c.member === m.id)) look = m.look; else if (m) return; }
    const c = G.spawnCustomer("highroller", false, look); if (!c) return;
    c.tourney = { i, name: e.name, what: e.star >= 0 ? STARS[e.star].what : e.mem ? "tu socio, inscripto en el torneo" : "jugador inscripto en el torneo" };
    c.rounds = 999; c.budget = Math.max(c.budget, 20000); c.betMin = t.def.minBet; c.betMax = t.def.maxBet; c.clName = e.name;
    if (e.star >= 0) addShades(c);
    tourC[i] = c; n++;
  });
}
function updateTour(dt) {
  const s = S(), cs = st(), run = cs.tour.run;
  const t = tourTable();
  if (!run || run.day !== s.day) { if (t && t.reserved) t.reserved = false; return; }
  const h = s.minutes / 60;
  const arrived = h >= TY.arriveHour;
  if (t) t.reserved = arrived && (run.phase === "wait" || run.phase === "run");
  if (run.phase === "wait") {
    if (arrived && G.isOpen && t && tourSpawned !== run) {
      for (const se of t.seats) if (se.c && !se.c.tourney) G.leaveCustomer(se.c); // la mesa queda reservada
      spawnTourPlayers(run);
      G.toast(`Llegan los jugadores del torneo de póker${run.ents.some(e => e.star >= 0) ? `, entre ellos ${run.ents.filter(e => e.star >= 0).map(e => e.name).join(" y ")}` : ""}. Arranca a las ${hhmm(TY.startHour)}.`, "good");
      G.sfx("vip", G.tables[0] ? 0 : 0, -8);
    }
    if (h >= TY.startHour) {
      if (!t || s.closedToday || !G.isOpen) { run.phase = "cancel"; if (t) t.reserved = false; G.Rep.change(TY.noTableRep); G.toast(`Se suspendió el torneo de póker${!t ? ": no hay mesa de póker" : ": el casino está cerrado"}. Los inscriptos se fueron enojados.`, "bad"); return; }
      run.phase = "run"; run.started = true; run.timer = TY.matchSec; handsSeen = s.today.st.handsByHand;
      G.toast(`¡Empezó el torneo de póker! Pozo ${fmt(run.pot)}. ${t.staff ? "Tu croupier reparte" : `Pará en el cuadro dorado de la mesa y repartí vos: cada mano suma XP y propina (${G.KEY})`}.`, "good");
      G.sfx("open");
    }
    return;
  }
  if (run.phase !== "run") return;
  if (!t) { run.phase = "cancel"; G.Rep.change(TY.noTableRep); G.toast("Se suspendió el torneo: ya no hay mesa de póker.", "bad"); return; }
  if (tourSpawned !== run && G.isOpen) spawnTourPlayers(run); // recarga a mitad del torneo
  for (const k in tourC) { const c = tourC[k]; if (alive(c)) c.waitT = 0; } // los del torneo esperan al croupier
  run.covT += dt; if (G.dealerHere(t)) run.cov += dt;
  // manos repartidas a mano en la mesa del torneo
  const hb = s.today.st.handsByHand;
  if (hb > handsSeen) {
    const pk = window.CasinoPoker && window.CasinoPoker.active;
    if (pk && pk.t === t) {
      const n = hb - handsSeen, tip = TY.handTip * run.rounds.length * n, room = G.Pocket.room(), inPocket = Math.min(tip, room);
      run.hands += n; G.Rank.add(TY.handXp * n); s.pocket += inPocket; if (tip > inPocket) t.d.tray += tip - inPocket;
      G.floatText(t.center.x, 1.9, t.center.z, `Torneo +${fmt(tip)} · +${TY.handXp * n} XP`, "#f0c24a");
      run.timer = Math.min(run.timer, 0.5); // la mano repartida define el partido
    }
    handsSeen = hb;
  }
  run.timer -= dt;
  if (run.timer <= 0) { run.timer = TY.matchSec; playMatch(run); }
}
function demandMul() {
  const s = S(); if (!s || !s.clients || s.clients !== validated) return 1;
  const run = s.clients.tour.run; if (!run || run.day !== s.day) return 1;
  const h = s.minutes / 60;
  if (run.phase === "done") return run.good ? TY.goodDemandMul : 1;
  if ((run.phase === "wait" || run.phase === "run") && h >= TY.startHour - 2) return TY.demandMul;
  return 1;
}

// =====================================================================
// API PARA game.js
// =====================================================================
function choose(c) {
  if (c.tourney) {
    const t = tourTable(); if (!t || !t.reserved) return null;
    const free = t.seats.filter(s => !s.c); return free.length ? { t, seat: pick(free) } : null;
  }
  const r = c.member && c.cl && c.cl.req; if (!r || r.done) return null;
  if (r.kind === "machine") {
    const ms = G.machines.filter(m => m.def.id === r.target && !m.user && !m.dead && !m.d.broken && !m.dark && !G.isFull(m) && G.zoneOpen(m.slot.zone));
    return ms.length ? { m: pick(ms) } : null;
  }
  if (r.kind === "table") {
    for (const t of G.tables) {
      if (t.def.id !== r.target || t.dead || t.reserved || !G.dealerAvailable(t) || !G.zoneOpen(t.spot.zone)) continue;
      const free = t.seats.filter(s => !s.c); if (free.length) return { t, seat: pick(free) };
    }
  }
  return null;
}
function act(c) {
  if (!st()) return null;
  const m = memberOf(c);
  if (m) {
    const r = c.cl && c.cl.req, lv = level(m);
    if (r && !r.done && r.kind === "music") return { usable: true, prompt: () => ({ text: `Poner el tema de ${m.name}`, sub: "Pidió música: le subís su tema favorito" }), use: () => { G.sfx("party"); fulfill(c, m, "Le pusiste su tema y lo baila."); } };
    return { usable: false, prompt: () => ({ text: `Socio ${lv.name} · ${m.name}`, sub: r && !r.done ? `Pide: ${r.text}` : `Fidelidad ${Math.round(m.pts)}/100 · le gusta ${gameName(m.fav)}` }) };
  }
  if (c.tourney) return { usable: false, prompt: () => ({ text: c.tourney.name, sub: c.tourney.what }) };
  if (canOffer(c)) return { usable: true, prompt: () => ({ text: "Ofrecer tarjeta de socio", sub: `${c.type.name} contento · vuelve seguido y hace pedidos` }), use: () => offer(c) };
  return null;
}
function update(dt) {
  const s = S(), cs = st(); if (!cs) return;
  if (cs.day !== s.day) newDay(cs);
  if (!sched || sched.day !== s.day) buildSched();
  if (G.isOpen && sched.list.length && s.minutes >= sched.list[0].at) {
    const v = sched.list.shift(), m = byId(v.id);
    if (m && !live.some(c => c.member === m.id) && !Object.values(tourC).some(c => alive(c) && c.tourney && run0() && run0().ents[c.tourney.i].mem === m.id)) spawnMember(m);
  }
  for (let i = live.length - 1; i >= 0; i--) { const c = live[i]; if (!alive(c)) { live.splice(i, 1); continue; } if (inside(c)) updateMember(c, dt); }
  // un corazón sobre los clientes contentos que podrían ser socios (cerca del jugador)
  lastHappyT -= dt;
  if (lastHappyT <= 0) {
    lastHappyT = 1.5;
    for (const c of G.customers) if (!c.clHappy && G.near(c.x, c.z, 9) && canOffer(c)) {
      c.clHappy = true; emote(c, "heart", 2.5);
      hintOnce("offer", `Ese cliente está contento (corazón): miralo y ${G.KEY} para ofrecerle la tarjeta de socio.`);
    }
  }
  updateTour(dt);
  if (pendingWin && !G.ui.panel && !G.ui.mg && G.started) { const r = pendingWin; pendingWin = null; showWin(r); }
}
const run0 = () => { const cs = S() && S().clients; return cs && cs.tour ? cs.tour.run : null; };
function onEndDay(notes) {
  const cs = st(); if (!cs) return;
  const run = cs.tour.run;
  if (run && run.day === S().day) {
    if (run.phase === "run") { let m; let guard = 0; while ((m = curMatch(run)) && guard++ < 10) { simMatch(m); run.ents[m.w === m.a ? m.b : m.a].out = true; const rd = run.rounds[run.rounds.length - 1]; if (rd.every(x => x.w >= 0)) { if (rd.length === 1) { finishRun(run, m, true); break; } const nx = []; for (let i = 0; i < rd.length; i += 2) nx.push({ a: rd[i].w, b: rd[i + 1].w, w: -1, sa: 0, sb: 0, hand: "" }); run.rounds.push(nx); } } }
    if (run.phase === "done") notes.push(`Torneo de póker: ganó ${run.ents[run.winner].name} con ${run.hand}. Pozo ${fmt(run.pot)}: ${fmt(run.prize)} al campeón y ${fmt(run.house)} para la casa.${run.good ? ` Salió bárbaro (+${TY.goodRep} reputación).` : " Faltó croupier: los jugadores se quejaron."}${run.hands ? ` Repartiste ${run.hands} mano${run.hands > 1 ? "s" : ""} del torneo.` : ""}`);
    else if (run.phase === "cancel" || run.phase === "wait") { if (run.phase === "wait") G.Rep.change(TY.noTableRep); notes.push("El torneo de póker se suspendió."); run.phase = "cancel"; }
  }
  const t = tourTable(); if (t) t.reserved = false;
  pendingWin = null;
  if (dayStat.visits || dayStat.ok || dayStat.fail || dayStat.cards) notes.push(`Socios: ${dayStat.visits} visita${dayStat.visits === 1 ? "" : "s"}, ${dayStat.ok} pedido${dayStat.ok === 1 ? "" : "s"} cumplido${dayStat.ok === 1 ? "" : "s"}, ${dayStat.fail} fallado${dayStat.fail === 1 ? "" : "s"}${dayStat.cards ? `, ${dayStat.cards} tarjeta${dayStat.cards > 1 ? "s" : ""} nueva${dayStat.cards > 1 ? "s" : ""}` : ""}. Total: ${cs.members.length} socio${cs.members.length === 1 ? "" : "s"}.`);
  for (const m of cs.members) if (m.req && m.req.due === "visit") m.req = null;
}

// =====================================================================
// PANEL (tecla J): socios y torneo
// =====================================================================
const css = document.createElement("style");
css.textContent = `#hClients { display: grid; gap: 2px; font-size: .84rem; line-height: 1.25; color: var(--ivory); border-left: 2px solid var(--brass); padding: 2px 0 2px 8px; background: none; border-top: 0; border-right: 0; border-bottom: 0; text-align: left; cursor: pointer; font-family: inherit; }
#hClients b { color: var(--brass); }
.clLv { display: inline-block; width: 70px; height: 6px; border-radius: 3px; background: #23493b; vertical-align: 1px; margin: 0 4px; overflow: hidden; }
.clLv i { display: block; height: 100%; }
.clBr { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; align-items: center; }
.clBr .col { display: grid; gap: 6px; }
.clBr h4 { margin: 0; font-size: .78rem; letter-spacing: .1em; text-transform: uppercase; color: var(--ivory-dim); }
.clM { border: 1px solid #23493b; border-radius: 6px; padding: 5px 7px; font-size: .84rem; background: rgba(7, 20, 15, .45); min-width: 0; }
.clM div { display: flex; justify-content: space-between; gap: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.clM .w { color: var(--brass); font-weight: 700; } .clM .o { color: var(--ivory-dim); text-decoration: line-through; }
.clM.cur { border-color: var(--brass); } .clM small { color: var(--ivory-dim); display: block; font-size: .74rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.clWin { text-align: center; } .clWin .rankbig { margin: .2em 0; }
@media (max-width: 560px) { .clBr { grid-template-columns: 1fr; } }`;
document.head.appendChild(css);
let tab = "socios";
function membersHtml() {
  const cs = st(), s = S();
  if (s.rank < C.minRank) return `<div class="note">Las tarjetas de socio se desbloquean en el rango ${C.minRank}.</div>`;
  const rows = cs.members.map(m => {
    const lv = level(m), p = PDEF(m.pers), inNow = live.some(c => c.member === m.id && inside(c));
    const r = (live.find(c => c.member === m.id && c.cl && c.cl.req && !c.cl.req.done) || {}).cl;
    const rq = r ? `Hoy pide: <b>${esc(r.req.text)}</b>` : m.req ? `Pendiente: <b>${esc(m.req.text)}</b>` : "Sin pedidos";
    const ago = s.day - m.last;
    return `<div class="item"><span class="sw" style="background:${lv.color}"></span>
      <div class="t"><b>${esc(m.name)}<span class="tag" style="background:${lv.color};color:#07140f">${lv.name}</span>${m.poach ? `<span class="tag bad">${esc(G.RIVAL.name)} lo tienta</span>` : ""}${inNow ? `<span class="tag">En el local</span>` : ""}</b>
      <span>Fidelidad <span class="clLv"><i style="width:${Math.round(m.pts)}%;background:${lv.color}"></i></span>${Math.round(m.pts)}/100 · le gusta ${esc(gameName(m.fav))} · ${esc(p.name.toLowerCase())} (${esc(p.desc)})<br>
      Última visita: ${ago <= 0 ? "hoy" : ago === 1 ? "ayer" : `hace ${ago} días`} (día ${m.last}) · ${m.visits} visita${m.visits === 1 ? "" : "s"} · ${m.ok} pedidos cumplidos, ${m.fail} fallados<br>${rq}</span></div></div>`;
  }).join("");
  const gone = cs.gone.length ? `<h3>Bajas</h3><ul class="unlocks">${cs.gone.slice().reverse().map(g => `<li>Día ${g.day}: ${esc(g.name)} ${esc(g.why)}.</li>`).join("")}</ul>` : "";
  return `<p>Socios <b class="num">${cs.members.length}/${C.maxMembers}</b> · pedidos cumplidos ${cs.st.ok}, fallados ${cs.st.fail}. A un cliente contento (corazón) miralo y ${G.KEY} para ofrecerle la tarjeta.</p>
    <div class="note">Bronce → Plata (${C.levels[1].min}) → Oro (${C.levels[2].min}): más visitas, más apuesta, propina${C.levels[2].friends ? " y amigos" : ""}. Cumplir un pedido suma ${C.reqOk}, fallarlo resta ${Math.abs(C.reqFail)}. Con 0 cancela la tarjeta.</div>
    ${rows ? `<div class="list">${rows}</div>` : `<div class="note">Todavía no tenés socios.</div>`}${gone}`;
}
function bracketHtml(run) {
  const cur = curMatch(run);
  const cols = [0, 1, 2].map(ri => {
    const rd = run.rounds[ri];
    const body = rd ? rd.map(m => {
      const n = i => { const e = run.ents[i], cls = m.w < 0 ? "" : m.w === i ? "w" : "o"; return `<div class="${cls}"><span>${e.star >= 0 ? "★ " : e.mem ? "♦ " : ""}${esc(e.name)}</span><span class="num">${m.w < 0 ? "" : i === m.a ? m.sa : m.sb}</span></div>`; };
      return `<div class="clM${m === cur && run.phase === "run" ? " cur" : ""}">${n(m.a)}${n(m.b)}${m.hand ? `<small>${esc(m.hand)}</small>` : ""}</div>`;
    }).join("") : `<div class="clM"><div><span class="dim">—</span></div></div>`;
    return `<div class="col"><h4>${ROUND_NAMES[ri]}</h4>${body}</div>`;
  }).join("");
  return `<div class="clBr">${cols}</div>`;
}
function tourHtml() {
  const cs = st(), s = S(), run = cs.tour.run, t = tourTable();
  const nd = nextTourDay(s.day);
  let head;
  if (!t) head = `<div class="note">Necesitás una mesa de póker${s.rank < 6 ? " (rango 6)" : ""} para organizar el torneo semanal de los ${dow(TY.weekday)}s.</div>`;
  else if (!run) head = `<p>Próximo torneo: <b>${dow(nd)} (día ${nd})</b> a las ${hhmm(TY.startHour)}${nd - s.day <= TY.announceDays ? " · ya anunciado" : ` · se anuncia el día ${nd - TY.announceDays}`}.</p>`;
  else {
    const cover = run.covT > 0 ? Math.round(run.cov / run.covT * 100) : 0;
    const state = run.phase === "wait" ? `Hoy a las ${hhmm(TY.startHour)} (los jugadores llegan ${hhmm(TY.arriveHour)})` : run.phase === "run" ? `En juego · ${roundName(run)}` : run.phase === "done" ? `Terminado · campeón <b>${esc(run.ents[run.winner].name)}</b> con ${esc(run.hand)}` : "Suspendido";
    head = `<p><b>Torneo Dorado de póker · día ${run.day}</b> · ${state}</p>
      <div class="statgrid"><div class="stat"><b>${fmt(run.pot)}</b><span>Pozo (${TY.entrants} × ${fmt(TY.fee)})</span></div><div class="stat"><b>${fmt(Math.round(run.pot * TY.houseShare))}</b><span>Para la casa (${Math.round(TY.houseShare * 100)}%)</span></div>
      <div class="stat"><b>${fmt(run.pot - Math.round(run.pot * TY.houseShare))}</b><span>Premio al campeón</span></div><div class="stat"><b>${cover}% · ${run.hands}</b><span>Con croupier · manos tuyas</span></div></div>
      ${bracketHtml(run)}
      <p class="dim" style="font-size:.86rem">★ famoso · ♦ socio. Sale bien si hubo croupier al menos ${Math.round(TY.goodCoverage * 100)}% del torneo o repartís vos ${TY.goodHands} manos (cada una: +${TY.handXp} XP, propina y apura el partido).</p>`;
  }
  const L = cs.tour.last;
  const last = L ? `<h3>Último torneo</h3><p>Día ${L.day}: ganó <b>${esc(L.winner)}</b> con ${esc(L.hand)} · premio ${fmt(L.prize)} · casa ${fmt(L.house)}${L.good ? " · salió bárbaro" : ""}. Torneos jugados: ${cs.tour.count}.</p>` : "";
  return head + last;
}
function open(t) {
  if (!st()) return;
  if (t) tab = t;
  const head = `<div class="tabs"><button data-cact="tab" data-id="socios" class="${tab === "socios" ? "on" : ""}">Socios</button><button data-cact="tab" data-id="torneo" class="${tab === "torneo" ? "on" : ""}">Torneo de póker</button></div>`;
  G.openPanel("clients", `<h2>${tab === "socios" ? "Socios con tarjeta" : "Torneo de póker"}</h2>${head}${tab === "socios" ? membersHtml() : tourHtml()}<div class="actions"><button class="ghost" data-act="close">Cerrar</button></div>`);
}
function showWin(run) {
  const W = run.ents[run.winner], fin = run.rounds[2] && run.rounds[2][0], second = fin ? run.ents[fin.w === fin.a ? fin.b : fin.a] : null;
  const semis = (run.rounds[1] || []).map(m => run.ents[m.w === m.a ? m.b : m.a]);
  G.openPanel("tourwin", `<div class="clWin"><p class="dim" style="letter-spacing:.2em;text-transform:uppercase;font-size:.8rem">Torneo Dorado de póker · día ${run.day}</p>
    <p class="rankbig">🏆 ${esc(W.name)}</p><p>Ganó la final con <b>${esc(run.hand)}</b>${W.star >= 0 ? ` · ${esc(STARS[W.star].what)}` : W.mem ? " · ¡tu socio!" : ""}.</p></div>
    <div class="statgrid"><div class="stat"><b>${fmt(run.prize)}</b><span>Premio</span></div><div class="stat"><b class="in">+${fmt(run.house)}</b><span>Para la casa</span></div><div class="stat"><b>${run.good ? `+${TY.goodRep}` : TY.badRep}</b><span>Reputación</span></div></div>
    <h3>Tabla final</h3><ul class="unlocks"><li>1° ${esc(W.name)}</li>${second ? `<li>2° ${esc(second.name)}</li>` : ""}${semis.map(e => `<li>3°/4° ${esc(e.name)}</li>`).join("")}</ul>
    ${bracketHtml(run)}
    <div class="${run.good ? "note" : "warn"}">${run.good ? "Salió bárbaro: esta noche viene más gente al casino." : "Faltó croupier en la mesa: la próxima contratá uno o repartí vos."}</div>
    <div class="actions"><button data-act="close">Seguir</button></div>`);
  G.sfx("cheer");
}
document.getElementById("panelBody").addEventListener("click", e => {
  const b = e.target.closest("button[data-cact]"); if (!b || b.disabled) return;
  if (b.dataset.cact === "tab") open(b.dataset.id);
  else if (b.dataset.cact === "open") { G.closePanel(true); open(b.dataset.id || "socios"); }
});
window.addEventListener("keydown", e => {
  if (e.code !== "KeyJ" || e.repeat || !G.started || !S()) return;
  if (G.ui.mg || (window.CasinoBuild && window.CasinoBuild.active)) return;
  if (G.ui.panel === "clients") { G.closePanel(false, true); return; }
  if (G.ui.panel === "mgmt") { G.closePanel(true); open("socios"); return; }
  if (G.ui.panel || S().gameOver) return;
  open();
});
// botón en Gestión + tecla en las ayudas de la portada y la pausa
const panelBodyEl = document.getElementById("panelBody");
new MutationObserver(() => {
  if (G.ui.panel === "mgmt") { const acts = panelBodyEl.querySelector(".actions"); if (acts && !acts.querySelector('[data-cact="open"]')) acts.insertAdjacentHTML("afterbegin", `<button class="ghost" data-cact="open" data-id="socios">Socios y torneo${G.isTouch ? "" : " (J)"}</button>`); }
  fixKeys(panelBodyEl);
}).observe(panelBodyEl, { childList: true });
function fixKeys(root) { if (!root || G.isTouch) return; const k = root.querySelector(".keys"); if (!k || k.dataset.clients) return; k.dataset.clients = "1"; k.insertAdjacentHTML("beforeend", `<kbd>J</kbd><span>Socios con tarjeta y torneo de póker</span>`); }
setTimeout(() => fixKeys(document.getElementById("title")), 0);

// =====================================================================
// HUD — una línea con el torneo y los socios en el local
// =====================================================================
const hudEl = document.createElement("button");
hudEl.id = "hClients"; hudEl.type = "button"; hudEl.hidden = true; hudEl.title = "Socios y torneo (J)";
{ const xp = document.querySelector("#hud .meter.xp"); if (xp) xp.insertAdjacentElement("afterend", hudEl); }
hudEl.addEventListener("click", () => { if (!G.ui.blocking()) open(); });
let lastHud = "", hudT = 0;
function hud(real) {
  hudT -= real; if (hudT > 0) return; hudT = 0.4;
  const s = S(); if (!s || !G.started || !s.clients || s.clients !== validated) return;
  const cs = s.clients, run = cs.tour.run, parts = [];
  if (run && run.day === s.day) {
    if (run.phase === "wait") parts.push(`<b>♠</b> Torneo de póker hoy ${hhmm(TY.startHour)} · ${TY.entrants} inscriptos`);
    else if (run.phase === "run") { const m = curMatch(run); parts.push(`<b>♠</b> Torneo · ${roundName(run)}${m ? `: ${esc(run.ents[m.a].name)} vs ${esc(run.ents[m.b].name)}` : ""}`); }
    else if (run.phase === "done") parts.push(`<b>♠</b> Campeón del torneo: ${esc(run.ents[run.winner].name)}`);
  } else if (tourTable()) { const nd = nextTourDay(s.day); if (nd - s.day <= TY.announceDays) parts.push(`<b>♠</b> Torneo de póker: ${dow(nd)} (día ${nd}) ${hhmm(TY.startHour)}`); }
  const inNow = live.filter(c => inside(c) && c.member);
  if (inNow.length) { const pend = inNow.filter(c => c.cl && c.cl.req && !c.cl.req.done).length; parts.push(`<b>♦</b> Socios en el local: ${inNow.length}${pend ? ` · ${pend} pedido${pend > 1 ? "s" : ""}` : ""}`); }
  const html = parts.map(p => `<span>${p}</span>`).join("");
  if (html !== lastHud) { lastHud = html; hudEl.innerHTML = html; hudEl.hidden = !html; }
}
(function loop() { let prev = performance.now(); const f = now => { hud(Math.min(0.5, (now - prev) / 1000)); prev = now; requestAnimationFrame(f); }; requestAnimationFrame(f); })();

// =====================================================================
// API
// =====================================================================
window.CasinoClients = {
  update, act, choose, onLeave, onDespawn, onEndDay, demandMul, open, sanitize,
  debug: {
    get state() { return st(); },
    get members() { const cs = st(); return cs ? cs.members.map(m => ({ id: m.id, name: m.name, pts: m.pts, level: level(m).id, fav: m.fav, req: m.req, poach: m.poach, last: m.last, visits: m.visits, look: m.look, type: m.type, pers: m.pers })) : []; },
    get live() { return live.filter(alive).map(c => ({ id: c.member, name: c.clName, state: c.state, req: c.cl && c.cl.req ? { kind: c.cl.req.kind, target: c.cl.req.target, done: c.cl.req.done, playT: c.cl.req.playT, left: c.cl.req.left } : null, x: c.x, z: c.z, look: c.person && c.person.kind })); },
    liveC: id => live.find(c => c.member === id && alive(c)) || null,
    get sched() { return sched ? { day: sched.day, list: sched.list.slice() } : null; },
    canOffer, estSat, offer, makeMember, addPts, cancel, level: m => level(m).id,
    visit(id) { const m = byId(id); return m ? spawnMember(m) : null; },
    setReq(id, kind, target, due) { const m = byId(id); if (!m) return null; const c = live.find(x => x.member === id && alive(x)); const r = kind === "fav" ? favReq(m, due || "visit") : { kind, target: target || kind, text: kind === "drink" ? "Un trago premium, por favor" : kind === "music" ? "Poné música, che" : kind === "machine" ? `Quiero la máquina ${shortName(target)}` : `Quiero mesa de ${shortName(target)} con apuesta alta`, day: S().day, due: due || "visit" }; if (r.due === "next" || !c) { m.req = Object.assign(r, { due: "next" }); return m.req; } startReq(c, m, r); return c.cl.req; },
    expireReq(id) { const c = live.find(x => x.member === id && alive(x)); if (c && c.cl && c.cl.req) { c.cl.req.left = 0; if (c.drink) c.drink.state = "missed"; } return !!c; },
    newDay() { const cs = st(); cs.day = -1; newDay(cs); return cs.tour.run ? cs.tour.run.phase : null; },
    poach(id) { const m = byId(id); if (m) m.poach = { until: S().day + C.poachDays }; return m && m.poach; },
    get run() { const cs = st(); return cs ? cs.tour.run : null; },
    get tourC() { return Object.keys(tourC).map(k => ({ i: +k, name: tourC[k].clName, state: tourC[k].state, alive: alive(tourC[k]), table: !!tourC[k].table })); },
    startTour() { const cs = st(); cs.tour.run = makeRun(S().day); cs.tour.ann = S().day; return cs.tour.run; },
    playMatch() { const cs = st(); if (cs.tour.run) playMatch(cs.tour.run); return cs.tour.run; },
    get pendingWin() { return !!pendingWin; },
    nextTourDay, isTourDay, demandMul, open, showWin,
  },
};
})();
