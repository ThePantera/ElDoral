/* Casino Dorado · challenge.js — MODOS DE JUEGO, LOGROS Y RÉCORDS, RANKING SEMANAL CONTRA EL FARAÓN
 * - Modos (se eligen en la portada al empezar una partida nueva; se guardan en S.mode):
 *   Historia (lo de siempre) · Sandbox (plata infinita, rango máximo, todas las licencias, sin historia, sin logros)
 *   Desafío 30 días (meta de banco y rango, cuenta regresiva en el HUD, pantalla de victoria/derrota con puntaje)
 *   Difícil sin préstamos (siempre Difícil, el banco no presta, un evento de la noche extra, puntaje ×1,5).
 * - Logros: ~33, se guardan aparte de la partida (localStorage "casino-dorado-logros-v1") y valen para todas las partidas.
 *   Aviso + sonido al desbloquear; panel con barras de progreso (tecla L, Pausa o Gestión).
 * - Récords: mejor día, racha de días con ganancia, día más rápido a los rangos 3/5/8, mejor puntaje por modo.
 * - Ranking semanal: cada 7 días comparás ganancia, reputación y visitas de la semana con El Faraón (sus números
 *   salen de su atractivo, de cómo te va y de la historia). Ganar da reputación y más clientes; perder, una burla
 *   de Cleo y te roba clientes. Tabla de la temporada.
 * Estado de la partida en S.challenge (game.js lo copia en sanitize; acá se valida campo por campo).
 */
(() => {
"use strict";
const DBG = window.casinoDebug, D = window.CASINO_DATA;
if (!DBG || !DBG.fn || !DBG.fn.ui || !D || !D.MODES || !D.CHALLENGE) return;
const F = DBG.fn, C = D.CHALLENGE, MODES = D.MODES, RIVAL = D.RIVAL;
const S = () => DBG.state;
const $ = id => document.getElementById(id);
const fmt = n => (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("es-AR");
const fmtN = n => Math.round(n).toLocaleString("es-AR");
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const isNum = v => typeof v === "number" && Number.isFinite(v);
const int = (v, d, lo, hi) => isNum(v) ? clamp(Math.round(v), lo, hi) : d;
const rankName = l => D.RANKS[clamp(l, 1, D.RANKS.length) - 1].name;
const STORE_KEY = "casino-dorado-logros-v1";
const modeId = () => { const s = S(); return s && MODES[s.mode] ? s.mode : "historia"; };
const mode = () => MODES[modeId()];
const sandbox = () => !!mode().sandbox;

// =====================================================================
// LOGROS (persisten entre partidas)
// =====================================================================
const COUNTERS = ["jackpots", "caught", "caughtHand", "knocked", "perfect", "restocked", "exactChange", "served", "drinks", "repairs", "boxes", "vip",
  "lifeOk", "life_fight", "life_celebrity", "life_outage", "life_cheater", "life_birthday", "life_drunk", "days", "weeksWon", "maxRank", "streakMax",
  "day10k", "day100k", "noComplaints", "ending", "buyout", "desafioOk", "hardR5", "visitors"];
const c = k => (store.c[k] || 0);
const ACH = [
  { id: "primer_jackpot", name: "Primer jackpot", desc: "Alguien se llevó el pozo del Jackpot en tu casino.", goal: 1, cur: () => c("jackpots") },
  { id: "ladron_1", name: "Manos a la obra", desc: "Atrapá a un ladrón con tus propias manos.", goal: 1, cur: () => c("caughtHand") },
  { id: "ladrones_25", name: "Ojo de halcón", desc: "25 ladrones atrapados (vos o seguridad).", goal: 25, cur: () => c("caught") },
  { id: "ladrones_100", name: "100 ladrones noqueados", desc: "100 ladrones atrapados o derribados con el bate.", goal: 100, cur: () => c("caught") },
  { id: "bate_10", name: "Bate de oro", desc: "Tus guardias derriban a 10 ladrones.", goal: 10, cur: () => c("knocked") },
  { id: "dia_10k", name: "Noche redonda", desc: "Ganá $10.000 en un solo día (resultado del banco).", goal: 1, cur: () => c("day10k") },
  { id: "dia_100k", name: "Ganá $100.000 en un día", desc: "Cerrá un día con $100.000 más en el banco.", goal: 1, cur: () => c("day100k") },
  { id: "perfecta_10", name: "Mano perfecta x10", desc: "10 rondas perfectas repartiendo blackjack, ruleta o póker.", goal: 10, cur: () => c("perfect") },
  { id: "perfecta_50", name: "Pulso de cirujano", desc: "50 rondas perfectas en las mesas.", goal: 50, cur: () => c("perfect") },
  { id: "gondola_50", name: "Góndola llena", desc: "Reponé 50 unidades en las góndolas.", goal: 50, cur: () => c("restocked") },
  { id: "repositor", name: "Repositor del mes", desc: "Reponé 500 unidades en las góndolas.", goal: 500, cur: () => c("restocked") },
  { id: "sin_quejas", name: "Sin quejas", desc: `Un día entero sin quejas, con ${C.sinQuejasMinVisitors} visitas o más.`, goal: 1, cur: () => c("noComplaints") },
  { id: "vuelto_5", name: "Cambio justo", desc: "Dá el vuelto exacto 5 veces en la caja.", goal: 5, cur: () => c("exactChange") },
  { id: "vuelto_50", name: "Rey del vuelto", desc: "Dá el vuelto exacto 50 veces en la caja.", goal: 50, cur: () => c("exactChange") },
  { id: "tragos_30", name: "Mozo estrella", desc: "Llevá 30 tragos a mano.", goal: 30, cur: () => c("drinks") },
  { id: "vip_10", name: "Alfombra roja", desc: "Recibí a 10 VIP en la puerta.", goal: 10, cur: () => c("vip") },
  { id: "cajas_100", name: "Manos de oro", desc: "Vaciá 100 cajas de máquinas a mano.", goal: 100, cur: () => c("boxes") },
  { id: "reparar_20", name: "Llave inglesa", desc: "Arreglá 20 máquinas a mano.", goal: 20, cur: () => c("repairs") },
  { id: "noches_10", name: "Noches tranquilas", desc: "Resolvé vos 10 eventos de la noche.", goal: 10, cur: () => c("lifeOk") },
  { id: "referi", name: "Réferi", desc: "Separá una pelea a tiempo.", goal: 1, cur: () => c("life_fight") },
  { id: "estrellas", name: "Amigo de las estrellas", desc: "Una celebridad se va feliz de tu casino.", goal: 1, cur: () => c("life_celebrity") },
  { id: "luz", name: "Se hizo la luz", desc: "Subí la térmica en un apagón.", goal: 1, cur: () => c("life_outage") },
  { id: "tramposo", name: "Ojo clínico", desc: "Atrapá a un tramposo en las mesas.", goal: 1, cur: () => c("life_cheater") },
  { id: "clientes_1000", name: "Mil sonrisas", desc: "Atendé a 1.000 clientes en total.", goal: 1000, cur: () => c("served") },
  { id: "racha_7", name: "Siete de siete", desc: "7 días seguidos cerrando con ganancia.", goal: 7, cur: () => c("streakMax") },
  { id: "rango_3", name: rankName(3), desc: "Llegá al rango 3.", goal: 3, cur: () => c("maxRank") },
  { id: "rango_5", name: rankName(5), desc: "Llegá al rango 5.", goal: 5, cur: () => c("maxRank") },
  { id: "rango_8", name: rankName(8), desc: "Llegá al rango máximo.", goal: 8, cur: () => c("maxRank") },
  { id: "semana_1", name: "Primera semana arriba", desc: `Ganale una semana a ${RIVAL.name}.`, goal: 1, cur: () => c("weeksWon") },
  { id: "semana_5", name: "Campeón de la cuadra", desc: `Ganale 5 semanas a ${RIVAL.name}.`, goal: 5, cur: () => c("weeksWon") },
  { id: "historia", name: "Fin de la historia", desc: "Llegá a un final de la historia.", goal: 1, cur: () => c("ending") },
  { id: "rey", name: "Dueño de la calle", desc: `Comprá ${RIVAL.name}.`, goal: 1, cur: () => c("buyout") },
  { id: "desafio", name: "Contrarreloj", desc: `Cumplí el Desafío ${MODES.desafio.days} días.`, goal: 1, cur: () => c("desafioOk") },
  { id: "sin_deudas", name: "Sin deberle a nadie", desc: `Llegá a ${rankName(5)} en Difícil sin préstamos.`, goal: 1, cur: () => c("hardR5") },
];
const ACHBY = Object.fromEntries(ACH.map(a => [a.id, a]));

function freshStore() { return { v: 1, un: {}, c: {}, rec: { bestDay: null, streak: 0, fastRank: {}, bestScore: {} }, games: 0 }; }
function loadStore() {
  const st = freshStore();
  let raw = null; try { raw = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch (e) { raw = null; }
  if (!raw || typeof raw !== "object" || raw.v !== 1) return st;
  if (raw.un && typeof raw.un === "object") for (const id in raw.un) if (ACHBY[id] && isNum(raw.un[id])) st.un[id] = raw.un[id];
  if (raw.c && typeof raw.c === "object") for (const k of COUNTERS) if (isNum(raw.c[k]) && raw.c[k] > 0) st.c[k] = Math.min(1e9, Math.round(raw.c[k]));
  const r = raw.rec;
  if (r && typeof r === "object") {
    const b = r.bestDay; if (b && typeof b === "object" && isNum(b.v)) st.rec.bestDay = { v: Math.round(b.v), day: int(b.day, 1, 1, 1e6), mode: MODES[b.mode] ? b.mode : "historia" };
    st.rec.streak = int(r.streak, 0, 0, 1e6);
    if (r.fastRank && typeof r.fastRank === "object") for (const l of [3, 5, 8]) if (isNum(r.fastRank[l])) st.rec.fastRank[l] = int(r.fastRank[l], 1, 1, 1e6);
    if (r.bestScore && typeof r.bestScore === "object") for (const m in MODES) if (isNum(r.bestScore[m])) st.rec.bestScore[m] = Math.max(0, Math.round(r.bestScore[m]));
  }
  st.games = int(raw.games, 0, 0, 1e6);
  return st;
}
let store = loadStore(), storeDirty = false, storeT = 0;
function saveStore() { storeDirty = false; try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* sin guardado: los logros quedan en memoria */ } }
function inc(k, n) { if (sandbox()) return; store.c[k] = c(k) + (n == null ? 1 : n); storeDirty = true; }
function setMax(k, v) { if (sandbox()) return; if (v > c(k)) { store.c[k] = v; storeDirty = true; } }
const unlockQ = [];
function checkAll() {
  if (sandbox()) return;
  for (const a of ACH) if (!store.un[a.id] && a.cur() >= a.goal) { store.un[a.id] = Date.now(); storeDirty = true; unlockQ.push(a); }
  if (storeDirty && unlockQ.length) saveStore();
}
let unlockT = 0;
function flushUnlocks(dt) { // de a uno, para que se lean
  unlockT -= dt; if (unlockT > 0 || !unlockQ.length) return;
  const a = unlockQ.shift(); unlockT = 1.6;
  F.toast(`Logro desbloqueado: ${a.name}. ${a.desc}`, "ach");
  F.sfx("goal"); setTimeout(() => F.sfx("vip"), 260);
}

// =====================================================================
// ESTADO DE LA PARTIDA (S.challenge)
// =====================================================================
function freshChal() { return { v: 1, streak: 0, wk: { profit: 0, visitors: 0, days: 0, promo: 0 }, league: { w: 0, l: 0, pts: 0, push: 1, hist: [] }, boost: null, result: null, sbLic: false }; }
function validChal(raw) {
  const ch = freshChal();
  if (!raw || typeof raw !== "object") return ch;
  ch.streak = int(raw.streak, 0, 0, 1e6);
  const w = raw.wk; if (w && typeof w === "object") ch.wk = { profit: isNum(w.profit) ? Math.round(w.profit) : 0, visitors: int(w.visitors, 0, 0, 1e7), days: int(w.days, 0, 0, 7), promo: int(w.promo, 0, 0, 7) };
  const L = raw.league;
  if (L && typeof L === "object") {
    ch.league.w = int(L.w, 0, 0, 1e4); ch.league.l = int(L.l, 0, 0, 1e4); ch.league.pts = int(L.pts, 0, 0, 1e6);
    ch.league.push = isNum(L.push) ? clamp(L.push, C.rival.pushMin, C.rival.pushMax) : 1;
    if (Array.isArray(L.hist)) ch.league.hist = L.hist.filter(h => h && typeof h === "object" && isNum(h.wk) && h.you && h.him).slice(-12).map(h => ({
      wk: int(h.wk, 1, 1, 1e4), win: !!h.win, cats: int(h.cats, 0, 0, 3),
      you: { profit: Math.round(+h.you.profit || 0), rep: Math.round(+h.you.rep || 0), visitors: Math.round(+h.you.visitors || 0) },
      him: { profit: Math.round(+h.him.profit || 0), rep: Math.round(+h.him.rep || 0), visitors: Math.round(+h.him.visitors || 0) } }));
  }
  const b = raw.boost; if (b && typeof b === "object" && isNum(b.mul) && isNum(b.from) && isNum(b.until)) ch.boost = { mul: clamp(b.mul, 0.5, 1.5), from: Math.round(b.from), until: Math.round(b.until) };
  const r = raw.result; if (r && typeof r === "object") ch.result = { win: !!r.win, score: int(r.score, 0, 0, 1e9), day: int(r.day, 1, 1, 1e6) };
  ch.sbLic = !!raw.sbLic;
  return ch;
}
function ch() { const s = S(); if (!s.challenge || s.challenge.v !== 1 || !s.challenge.league) s.challenge = validChal(s.challenge); return s.challenge; }

// lo que se muestra en pantallas al cerrar el día (semana, fin del desafío)
const screens = [];
let snap = { s: null, day: 0, today: null, v: {} };
const POLL = { served: "served", restocked: "restocked", exactChange: "exactChange", drinksByHand: "drinks", repairsByHand: "repairs", boxesByHand: "boxes", vipGreeted: "vip", visitors: "visitors" };
function baseline(zero) { const s = S(), st = s.today.st; snap.s = s; snap.day = s.day; snap.today = s.today; for (const k in POLL) snap.v[k] = zero ? 0 : (st[k] || 0); }

function onLoad(s, fresh) {
  if (!MODES[s.mode]) s.mode = "historia";
  s.challenge = fresh ? freshChal() : validChal(s.challenge);
  screens.length = 0;
  if (fresh && !MODES[s.mode].sandbox) { store.games++; storeDirty = true; }
  if (MODES[s.mode].sandbox) applySandbox(s, fresh);
  baseline(false);
  lastHud = ""; updateHud();
}
function applySandbox(s, fresh) {
  const top = D.RANKS[D.RANKS.length - 1];
  if (s.xp < top.xp) s.xp = top.xp;
  s.rank = D.RANKS.length;
  if (s.bank < C.sandboxFloor) F.Economy.add("sandbox", C.sandboxTop - s.bank);
  if (fresh) F.toast("Sandbox: plata infinita, todo el rango desbloqueado y sin historia. Los logros no cuentan en este modo.", "good");
}

// =====================================================================
// EVENTOS DEL JUEGO (ganchos en game.js, life.js, minigames.js, poker.js)
// =====================================================================
function ev(name, a, b) {
  if (!S() || sandbox()) return;
  if (name === "jackpot") inc("jackpots");
  else if (name === "catch") { inc("caught"); inc(a === "player" ? "caughtHand" : "knocked"); }
  else if (name === "perfect") inc("perfect");
  else if (name === "life" && b === "ok") { inc("lifeOk"); inc("life_" + a); }
  checkAll();
}
function poll() {
  const s = S(); if (!s || !s.today) return;
  if (s !== snap.s) baseline(false);
  else if (s.today !== snap.today) baseline(s.day !== snap.day);
  const st = s.today.st;
  for (const k in POLL) { const d = (st[k] || 0) - (snap.v[k] || 0); if (d > 0) { inc(POLL[k], d); snap.v[k] = st[k]; } else if (d < 0) snap.v[k] = st[k]; }
  if (sandbox()) {
    if (s.bank < C.sandboxFloor) F.Economy.add("sandbox", C.sandboxTop - s.bank);
    if (s.rank < D.RANKS.length) applySandbox(s, false);
    const cc = ch(); if (!cc.sbLic && s.shop && s.shop.lic && D.LICENSES) { for (const l of D.LICENSES) s.shop.lic[l.id] = 1; cc.sbLic = true; }
    return;
  }
  setMax("maxRank", s.rank);
  for (const l of [3, 5, 8]) if (s.rank >= l && (store.rec.fastRank[l] == null || s.day < store.rec.fastRank[l])) { store.rec.fastRank[l] = s.day; storeDirty = true; }
  if (s.story && s.story.ending) setMax("ending", 1);
  if (s.rivalBought && s.victory) setMax("buyout", 1);
  if (modeId() === "sinprestamos" && s.rank >= 5) setMax("hardR5", 1);
  checkAll();
}

// =====================================================================
// PUNTAJE
// =====================================================================
function score(s) {
  s = s || S(); const k = C.score, L = ch().league;
  const base = Math.max(0, s.bank) / k.bankDiv + Math.max(0, s.totals.net) * k.netMul + s.rank * k.perRank + s.rep * k.perRep + L.w * k.perWeekWon;
  return Math.round(base * (MODES[s.mode] || MODES.historia).scoreMul);
}

// =====================================================================
// RANKING SEMANAL CONTRA EL FARAÓN
// =====================================================================
const TAUNTS = [
  "«¿Eso fue una semana o un velorio? En El Faraón hasta los camellos ganan más que vos.»",
  "«Querido, tu Clásica tose más fuerte que tus números. Me llevo a tus clientes de regalo.»",
  "«Mis pirámides tienen más visitas que tu baño. Y tu baño es lo mejor que tenés.»",
  "«Te mando una postal desde mi salón lleno. Con estampilla de oro.»",
  "«No te preocupes: alguien tiene que salir segundo. Siempre vos.»",
];
const PRAISE = [
  "La gente cruzó la calle para venir al Dorado. Cleo cerró las persianas de su oficina.",
  "Esta semana el neón dorado brilló más que el azul. En el barrio no se habla de otra cosa.",
  "Dicen que Cleo tiró un busto de Nefertiti por la ventana. Era de yeso. Igual dolió.",
];
const weekNo = () => Math.max(1, Math.round(S().day / C.week));
function doneInWeek(id) { const st = S().story; if (!st || !st.done || !st.doneDay) return false; const d = st.doneDay[id]; return st.done[id] === "ok" && isNum(d) && d > S().day - C.week; }
function rivalWeek() {
  const s = S(), cc = ch(), R = C.rival, wk = cc.wk, frac = Math.max(1, wk.days) / C.week;
  const open = F.rivalOpen(), atr = open ? F.rivalAtr() : RIVAL.startAtr * (s.rivalBought ? 0 : 0.7);
  const myAtr = Math.max(1, F.attractiveness()), ratio = clamp(atr / myAtr, 0.3, 2.2);
  const n = () => 1 + (Math.random() * 2 - 1) * R.noise;
  let profit = (atr * R.profitPerAtr * frac * (1 - R.followMine) + Math.max(0, wk.profit) * ratio * R.followMine) * cc.league.push * n();
  let visitors = (atr * R.visitorsPerAtr * C.week * frac * (1 - R.followMine) + wk.visitors * ratio * R.followMine) * (1 + wk.promo * R.promoVisitors) * cc.league.push * n();
  let rep = R.baseRep + R.repPerWeek * weekNo() + (cc.league.push - 1) * 20 + (Math.random() * 8 - 4);
  const notes = [];
  if (doneInWeek("m_sabotaje")) { profit *= R.sabotageMul; visitors *= R.sabotageMul; notes.push("El sabotaje del camello le arruinó la promo."); }
  if (doneInWeek("m_contrapromo")) { visitors *= 0.9; notes.push("Le ganaste limpio el día de su promo."); }
  if (doneInWeek("m_atractivo")) { rep -= 4; notes.push("Tu casino le pasó en atractivo: la gente lo comenta."); }
  if (wk.promo) notes.push(`Hizo ${wk.promo} promo${wk.promo > 1 ? "s" : ""} esta semana.`);
  return { profit: Math.round(profit), visitors: Math.round(Math.max(0, visitors)), rep: Math.round(clamp(rep, 20, 95)), notes };
}
function evalWeek(notes) {
  const s = S(), cc = ch(), L = cc.league, R = C.rival;
  const you = { profit: cc.wk.profit, rep: Math.round(s.rep), visitors: cc.wk.visitors };
  const him = rivalWeek();
  const cats = (you.profit > him.profit ? 1 : 0) + (you.rep > him.rep ? 1 : 0) + (you.visitors > him.visitors ? 1 : 0);
  const win = cats >= 2, wk = weekNo(), effects = [];
  cc.boost = { mul: win ? C.winDemand : C.loseDemand, from: s.day + 1, until: s.day + C.effectDays };
  if (win) {
    F.Rep.change(C.winRep); L.w++; inc("weeksWon");
    effects.push(`+${C.winRep} de reputación`, `+${Math.round((C.winDemand - 1) * 100)}% de clientes los próximos ${C.effectDays} días`);
    L.push = clamp(L.push + R.pushWin, R.pushMin, R.pushMax); effects.push(`${RIVAL.name} va a invertir más la semana que viene`);
  } else {
    L.l++;
    for (const k in s.loyalty) s.loyalty[k] = Math.max(0, s.loyalty[k] - C.loseLoyalty);
    effects.push(`${RIVAL.name} te roba clientes: −${Math.round((1 - C.loseDemand) * 100)}% los próximos ${C.effectDays} días`, `−${C.loseLoyalty} de fidelidad de tus clientes`);
    L.push = clamp(L.push + R.pushLose, R.pushMin, R.pushMax);
  }
  L.pts += cats + (win ? 3 : 0);
  const h = { wk, win, cats, you, him: { profit: him.profit, rep: him.rep, visitors: him.visitors } };
  L.hist.push(h); if (L.hist.length > 12) L.hist.shift();
  cc.wk = { profit: 0, visitors: 0, days: 0, promo: 0 };
  notes.push(win ? `Semana ${wk}: le ganaste a ${RIVAL.name} (${cats}/3). +${C.winRep} reputación y más clientes.` : `Semana ${wk}: ${RIVAL.name} te ganó (${cats}/3). Te roba clientes un par de días.`);
  screens.push({ kind: "week", h, notes: him.notes, effects, quote: win ? PRAISE[wk % PRAISE.length] : TAUNTS[wk % TAUNTS.length] });
}

// =====================================================================
// CIERRE DEL DÍA (game.js → endDay, después de pagar todo y antes de guardar)
// =====================================================================
function onEndDay(notes) {
  const s = S(); if (!s) return;
  const cc = ch(), T = s.today, st = T.st, M = mode();
  const result = s.bank - T.start;
  cc.streak = result > 0 ? cc.streak + 1 : 0;
  cc.wk.profit += result; cc.wk.visitors += st.visitors || 0; cc.wk.days = Math.min(C.week, cc.wk.days + 1); if (T.promo) cc.wk.promo++;
  if (!M.sandbox) {
    inc("days");
    if (result >= 10000) setMax("day10k", 1);
    if (result >= 100000) setMax("day100k", 1);
    if (!s.closedToday && (st.complaints || 0) === 0 && (st.visitors || 0) >= C.sinQuejasMinVisitors) setMax("noComplaints", 1);
    setMax("streakMax", cc.streak);
    const rec = store.rec;
    if (!rec.bestDay || result > rec.bestDay.v) { if (result > 0) { rec.bestDay = { v: result, day: s.day, mode: modeId() }; notes.push(`¡Récord! Tu mejor día: ${fmt(result)}.`); } }
    if (cc.streak > rec.streak) rec.streak = cc.streak;
    storeDirty = true;
  }
  // desafío 30 días
  if (modeId() === "desafio" && !cc.result) {
    const met = s.bank >= M.targetBank && s.rank >= M.targetRank;
    if (met || s.day >= M.days || s.gameOver) {
      const left = Math.max(0, M.days - s.day), sc = score(s) + (met ? left * M.dayLeftBonus : 0);
      cc.result = { win: met, score: sc, day: s.day };
      if (met) { setMax("desafioOk", 1); notes.push(`¡Desafío cumplido el día ${s.day}! Puntaje ${fmtN(sc)}.`); }
      else { if (!s.gameOver) s.gameOver = `Se terminaron los ${M.days} días del desafío y no llegaste a la meta (${fmt(M.targetBank)} y rango ${rankName(M.targetRank)}).`; notes.push(`Desafío perdido. Puntaje ${fmtN(sc)}.`); }
      if (!store.rec.bestScore.desafio || sc > store.rec.bestScore.desafio) store.rec.bestScore.desafio = sc;
      screens.push({ kind: "end", r: cc.result });
    }
  }
  // ranking semanal
  if (s.day % C.week === 0 && !s.rivalBought) evalWeek(notes);
  // mejor puntaje del modo
  if (!M.sandbox && modeId() !== "desafio") { const sc = score(s); if (!store.rec.bestScore[modeId()] || sc > store.rec.bestScore[modeId()]) store.rec.bestScore[modeId()] = sc; }
  checkAll(); saveStore();
}

// =====================================================================
// PANTALLAS
// =====================================================================
const css = document.createElement("style");
css.textContent = `
.toast.ach { border-left-color: #f0c24a; background: linear-gradient(90deg, rgba(90, 66, 16, .95), rgba(7, 20, 15, .94)); color: var(--ivory); font-weight: 600; box-shadow: 0 0 18px rgba(240, 194, 74, .35); }
#hChal { font-size: .84rem; line-height: 1.25; color: var(--ivory); border-left: 2px solid var(--brass); padding: 2px 0 2px 8px; display: grid; gap: 1px; }
#hChal b { color: var(--brass); } #hChal .p { color: var(--ivory-dim); font-family: var(--font-num); font-size: .78rem; } #hChal.urgent { border-left-color: var(--chip); } #hChal.urgent b { color: #ff8a6a; }
.diff.modes label { flex: 1 1 240px; padding: 7px 11px; }
#modeNote { font-size: .82rem; color: var(--ivory-dim); }
.achlist { display: grid; gap: 6px; max-height: min(52vh, 460px); overflow-y: auto; padding-right: 4px; }
.achrow { display: grid; grid-template-columns: 34px 1fr 92px; gap: 10px; align-items: center; padding: 7px 10px; border: 1px solid #23493b; border-radius: 6px; background: rgba(7, 20, 15, .45); }
.achrow.on { border-color: var(--brass); background: linear-gradient(90deg, rgba(217, 168, 74, .16), rgba(7, 20, 15, .45)); }
.achrow .medal { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; font-family: var(--font-display); color: var(--night); background: #3b3a33; font-size: .95rem; }
.achrow.on .medal { background: radial-gradient(circle at 35% 30%, #fff3c0, #d9a84a 55%, #8a6a2c); box-shadow: 0 0 10px rgba(240, 194, 74, .5); }
.achrow b { display: block; font-size: .98rem; } .achrow span { font-size: .82rem; color: var(--ivory-dim); }
.achrow .pg { display: grid; gap: 3px; font-family: var(--font-num); font-size: .74rem; text-align: right; color: var(--ivory-dim); }
.achrow .pg i { display: block; height: 5px; border-radius: 3px; background: #22362d; overflow: hidden; } .achrow .pg i u { display: block; height: 100%; background: var(--brass); }
.vs { display: grid; grid-template-columns: 1fr auto 1fr; gap: 6px 12px; align-items: center; }
.vs .who { font-family: var(--font-display); font-size: 1.35rem; text-align: center; line-height: 1.05; }
.vs .who.me { color: var(--brass); } .vs .who.him { color: #6f9cff; }
.vs .lab { font-size: .72rem; letter-spacing: .14em; text-transform: uppercase; color: var(--ivory-dim); text-align: center; }
.vs .val { font-family: var(--font-num); font-size: 1.1rem; padding: 6px 10px; border-radius: 6px; border: 1px solid #23493b; background: rgba(7, 20, 15, .45); text-align: center; }
.vs .val.won { border-color: var(--brass); color: var(--brass); box-shadow: 0 0 12px rgba(217, 168, 74, .25); } .vs .val.won.him { border-color: #6f9cff; color: #9fbcff; box-shadow: 0 0 12px rgba(111, 156, 255, .25); }
.wkbanner { font-family: var(--font-display); font-size: clamp(2rem, 7vw, 3rem); text-align: center; line-height: 1; margin: 2px 0; }
.wkbanner.win { color: var(--brass); text-shadow: 0 0 28px rgba(217, 168, 74, .5); } .wkbanner.lose { color: #6f9cff; text-shadow: 0 0 28px rgba(63, 111, 214, .6); }
.quote { font-style: italic; text-align: center; color: var(--ivory); }
.season { display: flex; gap: 5px; flex-wrap: wrap; } .season span { font-family: var(--font-num); font-size: .78rem; padding: 2px 7px; border-radius: 3px; background: #23493b; } .season span.w { background: var(--brass); color: var(--night); } .season span.l { background: #2a3f7a; }
.panel.chdrama { border-color: #f0c24a; animation: chIn .45s ease-out; } .panel.chdrama.lose { border-color: #3a6fd6; box-shadow: 0 0 0 4px var(--night), 0 0 0 5px #2a3f7a, 0 24px 60px rgba(0, 0, 0, .6); }
@keyframes chIn { from { transform: scale(.92); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .panel.chdrama { animation: none; } }`;
document.head.appendChild(css);
const panelBody = $("panelBody");
const STICKY = F.STICKY; STICKY.add("chweek"); STICKY.add("chend");

function vsRow(lab, a, b, f) { const w = a > b; return `<div class="val${w ? " won" : ""}">${f(a)}</div><div class="lab">${lab}</div><div class="val${!w ? " won him" : ""}">${f(b)}</div>`; }
function seasonHtml(L) {
  const chips = L.hist.map(h => `<span class="${h.win ? "w" : "l"}" title="Semana ${h.wk}">S${h.wk} ${h.win ? "G" : "P"}</span>`).join("");
  return `<p>Temporada: <b>${L.w}</b> ganada${L.w === 1 ? "" : "s"} · <b>${L.l}</b> perdida${L.l === 1 ? "" : "s"} · <b class="num">${L.pts}</b> puntos (1 por rubro ganado, +3 por semana).</p>${chips ? `<div class="season">${chips}</div>` : ""}`;
}
function showWeek(sc) {
  const h = sc.h, L = ch().league;
  F.sfx(h.win ? "cheer" : "grumble"); F.sfx(h.win ? "rankup" : "inspector");
  F.openPanel("chweek", `<p class="dim" style="letter-spacing:.2em;text-transform:uppercase;font-size:.8rem;text-align:center;margin:0">Ranking semanal · semana ${h.wk}</p>
    <p class="wkbanner ${h.win ? "win" : "lose"}">${h.win ? "¡Ganaste la semana!" : `Ganó ${esc(RIVAL.name)}`}</p>
    <div class="vs"><div class="who me">Casino Dorado</div><div class="lab">vs</div><div class="who him">${esc(RIVAL.name)}</div>
      ${vsRow("Ganancia", h.you.profit, h.him.profit, fmt)}${vsRow("Reputación", h.you.rep, h.him.rep, fmtN)}${vsRow("Visitas", h.you.visitors, h.him.visitors, fmtN)}</div>
    <p class="quote">${h.win ? esc(sc.quote) : `Cleo Montenegro: ${esc(sc.quote)}`}</p>
    ${sc.notes.length ? `<p class="dim" style="font-size:.88rem">${sc.notes.map(esc).join(" ")}</p>` : ""}
    <h3>${h.win ? "Premio" : "Castigo"}</h3><ul class="unlocks">${sc.effects.map(e => `<li>${esc(e)}</li>`).join("")}</ul>
    ${seasonHtml(L)}
    <div class="actions"><button data-act="chNext">${screens.length ? "Seguir" : "Ver el cierre de caja"}</button></div>`);
  panelBody.classList.add("chdrama"); panelBody.classList.toggle("lose", !h.win);
}
function showEnd(sc) {
  const r = sc.r, s = S(), M = MODES.desafio, best = store.rec.bestScore.desafio || 0;
  F.sfx(r.win ? "jackpot" : "close");
  F.openPanel("chend", `<p class="dim" style="letter-spacing:.2em;text-transform:uppercase;font-size:.8rem;text-align:center;margin:0">${esc(M.name)} · día ${r.day}</p>
    <p class="wkbanner ${r.win ? "win" : "lose"}">${r.win ? "¡Desafío cumplido!" : "Se acabó el tiempo"}</p>
    <p style="text-align:center">${r.win ? `Llegaste a ${fmt(M.targetBank)} y al rango ${esc(rankName(M.targetRank))} con ${M.days - r.day} días de sobra.` : `La meta era ${fmt(M.targetBank)} en el banco y el rango ${esc(rankName(M.targetRank))} antes del cierre del día ${M.days}.`}</p>
    <div class="statgrid"><div class="stat"><b>${fmtN(r.score)}</b><span>Puntaje${r.win ? ` (+${fmtN(Math.max(0, M.days - r.day) * M.dayLeftBonus)} por días de sobra)` : ""}</span></div>
      <div class="stat"><b>${fmtN(best)}</b><span>Tu récord del desafío</span></div>
      <div class="stat"><b>${fmt(s.bank)}</b><span>Banco</span></div><div class="stat"><b>${esc(rankName(s.rank))}</b><span>Rango</span></div>
      <div class="stat"><b>${ch().league.w}-${ch().league.l}</b><span>Semanas contra ${esc(RIVAL.name)}</span></div></div>
    <div class="actions"><button data-act="chNext">${screens.length ? "Seguir" : r.win ? "Ver el cierre y seguir jugando" : "Ver el cierre"}</button></div>`);
  panelBody.classList.add("chdrama"); panelBody.classList.toggle("lose", !r.win);
}
function nextScreen() {
  panelBody.classList.remove("chdrama", "lose");
  const sc = screens.shift();
  if (!sc) { F.closePanel(true); F.showReport(); return; }
  if (sc.kind === "week") showWeek(sc); else showEnd(sc);
}

// panel de logros, récords y ranking
let tab = "ach";
function openLogros(t) {
  if (t) tab = t;
  const s = S(), sb = sandbox(), n = Object.keys(store.un).length;
  const tabs = [["ach", "Logros"], ["rec", "Récords"], ["rank", `Ranking vs ${RIVAL.name}`]];
  const head = `<div class="tabs">${tabs.map(([id, l]) => `<button data-act="chTab" data-id="${id}" class="${tab === id ? "on" : ""}">${esc(l)}</button>`).join("")}</div>`;
  let body = "";
  if (tab === "ach") {
    const rows = ACH.map(a => {
      const on = !!store.un[a.id], v = Math.min(a.cur(), a.goal);
      return `<div class="achrow${on ? " on" : ""}" data-ach="${a.id}"><span class="medal">${on ? "★" : "?"}</span><div><b>${esc(a.name)}</b><span>${esc(a.desc)}</span></div>
        <div class="pg">${on ? "Hecho" : `${fmtN(v)}/${fmtN(a.goal)}`}<i><u style="width:${Math.round(v / a.goal * 100)}%"></u></i></div></div>`;
    }).join("");
    body = `<p>Desbloqueaste <b class="num">${n}/${ACH.length}</b>. Los logros valen para todas tus partidas en este navegador.</p>
      ${sb ? `<div class="warn">Estás en Sandbox: los logros y récords no avanzan en este modo.</div>` : ""}<div class="achlist">${rows}</div>`;
  } else if (tab === "rec") {
    const r = store.rec, bd = r.bestDay;
    const fr = [3, 5, 8].map(l => `<div class="stat"><b>${r.fastRank[l] ? "Día " + r.fastRank[l] : "—"}</b><span>Más rápido a ${esc(rankName(l))}</span></div>`).join("");
    const bs = Object.keys(MODES).filter(m => !MODES[m].sandbox).map(m => `<div class="stat"><b>${r.bestScore[m] ? fmtN(r.bestScore[m]) : "—"}</b><span>Mejor puntaje · ${esc(MODES[m].name)}</span></div>`).join("");
    body = `<div class="statgrid"><div class="stat"><b>${bd ? fmt(bd.v) : "—"}</b><span>Mejor día${bd ? ` (día ${bd.day}, ${esc(MODES[bd.mode].name)})` : ""}</span></div>
      <div class="stat"><b>${r.streak}</b><span>Racha más larga de días con ganancia</span></div>${fr}${bs}
      <div class="stat"><b>${fmtN(c("caught"))}</b><span>Ladrones atrapados (total)</span></div><div class="stat"><b>${fmtN(c("served"))}</b><span>Clientes atendidos (total)</span></div>
      <div class="stat"><b>${fmtN(store.games)}</b><span>Partidas empezadas</span></div></div>
      <h3>Esta partida</h3><p>Modo <b>${esc(mode().name)}</b> · puntaje <b class="num">${sb ? "—" : fmtN(score())}</b>${mode().scoreMul !== 1 && !sb ? ` (×${String(mode().scoreMul).replace(".", ",")})` : ""} · racha actual <b class="num">${ch().streak}</b> días.</p>`;
  } else {
    const L = ch().league, last = L.hist[L.hist.length - 1], wk = ch().wk, daysLeft = C.week - wk.days;
    body = `${s.rivalBought ? `<div class="note">Compraste ${esc(RIVAL.name)}: la temporada terminó y la calle es tuya.</div>` : `<p>Cada ${C.week} días se comparan la ganancia, la reputación y las visitas de la semana. Ganás la semana con 2 de 3 rubros: +${C.winRep} de reputación y más clientes. Si perdés, ${esc(RIVAL.name)} te roba clientes.</p>
      <p>Semana en curso: ganancia <b class="num">${fmt(wk.profit)}</b> · visitas <b class="num">${fmtN(wk.visitors)}</b> · faltan <b class="num">${daysLeft}</b> cierre${daysLeft === 1 ? "" : "s"}.</p>`}
      ${seasonHtml(L)}
      ${last ? `<h3>Última semana (${last.wk})</h3><div class="vs"><div class="who me">Dorado</div><div class="lab">vs</div><div class="who him">${esc(RIVAL.name)}</div>${vsRow("Ganancia", last.you.profit, last.him.profit, fmt)}${vsRow("Reputación", last.you.rep, last.him.rep, fmtN)}${vsRow("Visitas", last.you.visitors, last.him.visitors, fmtN)}</div>` : `<p class="dim">Todavía no terminó ninguna semana.</p>`}`;
  }
  F.openPanel("logros", `<h2>Logros y récords</h2>${head}${body}<div class="actions"><button class="ghost" data-act="close">Cerrar</button></div>`);
}
panelBody.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b || b.disabled) return;
  const act = b.dataset.act;
  if (act === "chNext") nextScreen();
  else if (act === "chTab") openLogros(b.dataset.id);
  else if (act === "chOpen") openLogros();
});
window.addEventListener("keydown", e => {
  if (e.code !== "KeyL" || e.repeat || !DBG.started) return;
  const ui = F.ui;
  if (ui.panel === "logros") F.closePanel(false, true);
  else if (!ui.panel && !ui.mg && !(window.CasinoBuild && window.CasinoBuild.active)) openLogros();
});
// botones en Pausa y Gestión, y el puntaje en la pausa
new MutationObserver(() => {
  const p = F.ui.panel;
  if (p !== "pause" && p !== "mgmt") panelBody.classList.remove("chdrama", "lose");
  if (p === "pause") {
    const acts = panelBody.querySelector(".actions");
    if (acts && !acts.querySelector('[data-act="chOpen"]') && !acts.querySelector('[data-act="newgame"]')) acts.insertAdjacentHTML("afterbegin", `<button class="ghost" data-act="chOpen">Logros (L)</button>`);
    const info = panelBody.querySelector("#chPauseInfo");
    if (!info && acts) acts.insertAdjacentHTML("beforebegin", `<p id="chPauseInfo">${pauseInfo()}</p>`);
  } else if (p === "mgmt") {
    const tabs = panelBody.querySelector(".tabs");
    if (tabs && !tabs.querySelector('[data-act="chOpen"]')) tabs.insertAdjacentHTML("beforeend", `<button data-act="chOpen">Logros y ranking</button>`);
  }
}).observe(panelBody, { childList: true });
function pauseInfo() {
  const s = S(), M = mode(), L = ch().league;
  const parts = [`Modo <b>${esc(M.name)}</b>: ${esc(M.desc)}`];
  if (!M.sandbox) parts.push(`Puntaje <b class="num">${fmtN(score())}</b>${M.scoreMul !== 1 ? ` (×${String(M.scoreMul).replace(".", ",")})` : ""}`);
  if (modeId() === "desafio") parts.push(ch().result ? `Desafío ${ch().result.win ? "cumplido" : "perdido"} el día ${ch().result.day}` : `Desafío: faltan ${Math.max(0, M.days - s.day)} días`);
  parts.push(`Semanas contra ${esc(RIVAL.name)}: ${L.w}-${L.l}`);
  parts.push(`Logros ${Object.keys(store.un).length}/${ACH.length}`);
  return parts.join(" · ");
}

// =====================================================================
// HUD: línea del modo, cuenta regresiva y semana contra El Faraón
// =====================================================================
const hudEl = document.createElement("div"); hudEl.id = "hChal";
{ const xp = document.querySelector("#hud .meter.xp"); if (xp) xp.insertAdjacentElement("afterend", hudEl); }
let lastHud = "";
function updateHud() {
  const s = S(); if (!s || !s.challenge) return;
  const M = mode(), cc = ch(), id = modeId(); let html = "", urgent = false;
  const dInWeek = ((s.day - 1) % C.week) + 1;
  const week = s.rivalBought ? `<span class="p">${esc(RIVAL.name)} es tuyo</span>` : `<span class="p">Semana ${Math.ceil(s.day / C.week)} vs ${esc(RIVAL.name)} · día ${dInWeek}/${C.week} · ${cc.league.w}-${cc.league.l}</span>`;
  if (id === "sandbox") html = `<span><b>Sandbox</b> · plata infinita · sin logros</span>`;
  else if (id === "desafio") {
    if (cc.result) html = `<span><b>Desafío ${cc.result.win ? "cumplido" : "perdido"}</b> · puntaje ${fmtN(cc.result.score)}</span>`;
    else {
      const left = Math.max(0, M.days - s.day + (s.dayOver ? 0 : 1)); urgent = left <= 5;
      html = `<span><b>Desafío: ${left} día${left === 1 ? "" : "s"}</b> · <span class="p">${fmt(Math.min(s.bank, M.targetBank))}/${fmt(M.targetBank)} · rango ${Math.min(s.rank, M.targetRank)}/${M.targetRank}</span></span>`;
    }
    html += week;
  } else if (id === "sinprestamos") html = `<span><b>Sin préstamos</b> · <span class="p">puntaje ×1,5</span></span>${week}`;
  else html = week;
  if (cc.boost && s.day >= cc.boost.from && s.day <= cc.boost.until) html += `<span class="p">${cc.boost.mul > 1 ? `Racha ganadora: +${Math.round((cc.boost.mul - 1) * 100)}% clientes` : `${esc(RIVAL.name)} te roba clientes: −${Math.round((1 - cc.boost.mul) * 100)}%`}</span>`;
  const key = html + urgent;
  if (key !== lastHud) { lastHud = key; hudEl.innerHTML = html; hudEl.classList.toggle("urgent", urgent); }
  const sh = $("hStory"); if (sh) sh.hidden = !!M.sandbox;
}

// =====================================================================
// PORTADA: el modo Difícil sin préstamos fija la dificultad
// =====================================================================
function syncTitle() {
  const m = document.querySelector('input[name="mode"]:checked'), hard = m && MODES[m.value] && MODES[m.value].diff;
  for (const r of document.querySelectorAll('input[name="diff"]')) { r.disabled = !!hard && r.value !== hard; if (hard && r.value === hard) r.checked = true; }
}
for (const r of document.querySelectorAll('input[name="mode"]')) r.addEventListener("change", syncTitle);
{ const mp = $("modePick"); if (mp) { const n = document.createElement("p"); n.id = "modeNote"; mp.insertAdjacentElement("afterend", n); }
  const refresh = () => { const n = $("modeNote"), mp = $("modePick"); if (!n || !mp) return; n.hidden = mp.hidden; const k = Object.keys(store.un).length; n.textContent = `Logros desbloqueados: ${k}/${ACH.length}${store.rec.bestDay ? ` · tu mejor día: ${fmt(store.rec.bestDay.v)}` : ""}. Tecla L durante el juego.`; };
  refresh(); new MutationObserver(refresh).observe($("modePick"), { attributes: true, attributeFilter: ["hidden"] }); }

// =====================================================================
// CICLO
// =====================================================================
let prev = performance.now(), acc = 0;
function loop(now) {
  const dt = Math.min(0.25, Math.max(0, (now - prev) / 1000)); prev = now;
  try {
    const s = S();
    if (s && s.today) {
      if (!s.challenge || s.challenge.v !== 1) ch();
      acc += dt;
      if (acc >= 0.5) { acc = 0; if (DBG.started) poll(); updateHud(); }
      storeT -= dt; if (storeDirty && storeT <= 0) { storeT = 2; saveStore(); }
      flushUnlocks(dt);
      if (screens.length && (F.ui.panel === "report" || F.ui.panel === "over")) nextScreen();
    }
  } catch (e) { console.error(e); }
  requestAnimationFrame(loop);
}
// la partida de la portada se cargó antes que este archivo: validamos su estado acá
if (S()) { const s = S(); if (!MODES[s.mode]) s.mode = "historia"; s.challenge = validChal(s.challenge); baseline(false); updateHud(); }
requestAnimationFrame(loop);

window.CasinoChallenge = {
  ev, onLoad, onEndDay,
  noLoans: () => !!(S() && mode().noLoans),
  storyOff: () => !!(S() && mode().sandbox),
  extraEvents: () => (S() && mode().extraEvents) || 0,
  demandMul: () => { const s = S(), b = s && s.challenge && s.challenge.boost; return b && s.day >= b.from && s.day <= b.until ? b.mul : 1; },
  score: () => score(),
  open: openLogros,
  debug: {
    get store() { return store; }, get state() { return ch(); }, get screens() { return screens.map(x => x.kind); }, ACH,
    reload() { store = loadStore(); return store; },
    weekNow() { const n = []; evalWeek(n); return n; },
    rivalWeek, score, saveStore, poll,
  },
};
})();
