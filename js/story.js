/* Casino Dorado v3 · story.js — HISTORIA Y MISIONES
 * Campaña de 5 actos atada a los rangos, con diálogos (retratos dibujados en canvas), decisiones con
 * consecuencias, personajes que aparecen en el casino, registro de misiones y línea en el HUD.
 * Se carga después de game.js y usa window.casinoDebug (estado S y funciones internas en .fn).
 * Personajes (ficticios): Lucho (primer empleado), Don Aurelio Cardenal (prestamista), Inspector Ernesto Funes
 * (Lotería) y Cleo Montenegro (dueña de El Faraón).
 * Estado guardado en S.story (game.js lo copia en sanitize; acá se valida campo por campo).
 */
(() => {
"use strict";
const DBG = window.casinoDebug, A = window.CasinoArt, D = window.CASINO_DATA;
if (!DBG || !DBG.fn || !DBG.fn.ui || !A || !D || !window.THREE) return;
const F = DBG.fn, T = window.THREE;
const isTouch = matchMedia("(pointer: coarse)").matches || ("ontouchstart" in window && navigator.maxTouchPoints > 0);
const KEY = isTouch ? "Usar" : "E";
const fmt = n => (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("es-AR");
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const S = () => DBG.state;
const toast = (m, k) => F.toast(m, k);
const ST = () => DBG.state.story;
const hourNow = () => Math.floor(S().minutes / 60);
const rankName = l => D.RANKS[l - 1].name;

// el inspector ahora tiene nombre (game.js usa D.INSPECTOR.name en avisos y en el cartel)
D.INSPECTOR.name = "Inspector Funes";

// =====================================================================
// PERSONAJES
// =====================================================================
const CHARS = {
  lucho:   { name: "Lucho", role: "Tu primer empleado", color: "#6e1423", bio: "Venía con el local, como la Clásica. Leal, optimista y con un tío para cada ocasión." },
  aurelio: { name: "Don Aurelio", role: "Prestamista del barrio", color: "#efe8d8", bio: "Traje blanco, clavel rojo y favores que siempre se cobran. Encantador. Peligroso." },
  funes:   { name: "Inspector Funes", role: "Lotería · Formulario 27-B", color: "#8d949c", bio: "Ernesto Funes. Tiene un sello para cada emoción y ninguna emoción sin sello." },
  cleo:    { name: "Cleo Montenegro", role: "Dueña de El Faraón", color: "#3a6fd6", bio: "La reina de enfrente. Teatral, brillante y convencida de que la calle le pertenece." },
  narr:    { name: "", role: "", color: "#d9a84a" },
};

// =====================================================================
// RETRATOS (canvas 2D, procedurales)
// =====================================================================
function drawPortrait(cv, who, talk, blink) {
  const g = cv.getContext("2d"), W = cv.width, H = cv.height, s = W / 128;
  g.setTransform(s, 0, 0, s, 0, 0); g.clearRect(0, 0, 128, 128);
  const bgs = { lucho: ["#1d5a43", "#0a1f17"], aurelio: ["#5a1820", "#14060a"], funes: ["#3a4448", "#15191b"], cleo: ["#1f3f8a", "#081333"] };
  const bg = bgs[who] || ["#333", "#111"];
  const gr = g.createRadialGradient(64, 50, 10, 64, 64, 90); gr.addColorStop(0, bg[0]); gr.addColorStop(1, bg[1]);
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const ell = (x, y, rx, ry, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); };
  const P = {
    lucho: { skin: "#c68642", suit: "#6e1423", shirt: "#f3e9d2", hair: "#24160c" },
    aurelio: { skin: "#e0ac69", suit: "#efe8d8", shirt: "#2a2a30", hair: "#c9c9c9" },
    funes: { skin: "#f1c27d", suit: "#6b7078", shirt: "#f6f1e6", hair: "#9a9a9a" },
    cleo: { skin: "#d9a074", suit: "#1b3a8a", shirt: "#1b3a8a", hair: "#0d0d10" },
  }[who];
  if (!P) return;
  // hombros y cuello
  ell(64, 132, 54, 34, P.suit);
  g.fillStyle = P.shirt; g.beginPath(); g.moveTo(52, 100); g.lineTo(64, 126); g.lineTo(76, 100); g.closePath(); g.fill();
  ell(64, 92, 11, 12, P.skin);
  if (who === "cleo") { // collar egipcio
    for (let i = 0; i < 3; i++) { g.strokeStyle = i % 2 ? "#3fb8c9" : "#d9a84a"; g.lineWidth = 4; g.beginPath(); g.ellipse(64, 100, 24 + i * 6, 12 + i * 5, 0, 0.1, Math.PI - 0.1); g.stroke(); }
  }
  if (who === "aurelio") { g.strokeStyle = "#b9b09a"; g.lineWidth = 2; g.beginPath(); g.moveTo(50, 104); g.lineTo(60, 124); g.moveTo(78, 104); g.lineTo(68, 124); g.stroke(); ell(44, 114, 6, 6, "#d4423f"); ell(44, 114, 2.5, 2.5, "#8a1a1a"); g.fillStyle = "#d9a84a"; g.fillRect(62, 104, 4, 20); }
  if (who === "lucho") { g.fillStyle = "#d9a84a"; g.beginPath(); g.moveTo(54, 102); g.lineTo(64, 107); g.lineTo(54, 112); g.closePath(); g.moveTo(74, 102); g.lineTo(64, 107); g.lineTo(74, 112); g.closePath(); g.fill(); }
  if (who === "funes") { g.fillStyle = "#1a1a1a"; g.fillRect(62, 102, 4, 22); g.fillStyle = "#6a4a24"; g.fillRect(84, 108, 34, 24); g.fillStyle = "#e8e0c8"; g.fillRect(88, 112, 26, 3); }
  // cabeza
  ell(64, 60, 28, 33, P.skin);
  ell(36, 62, 5, 8, P.skin); ell(92, 62, 5, 8, P.skin);
  // pelo
  if (who === "lucho") { g.fillStyle = P.hair; for (let i = 0; i < 9; i++) ell(40 + i * 6, 32 + Math.sin(i * 1.7) * 3, 8, 8, P.hair); }
  else if (who === "aurelio") { ell(64, 36, 27, 12, P.hair); g.fillStyle = "#efe8d8"; g.fillRect(28, 26, 72, 6); ell(64, 22, 22, 14, "#efe8d8"); g.fillStyle = "#14060a"; g.fillRect(42, 24, 44, 5); }
  else if (who === "funes") { ell(38, 50, 6, 12, P.hair); ell(90, 50, 6, 12, P.hair); g.strokeStyle = P.hair; g.lineWidth = 2; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(42, 34 + i * 2); g.quadraticCurveTo(64, 26 + i * 2, 86, 36 + i * 2); g.stroke(); } }
  else if (who === "cleo") { g.fillStyle = P.hair; g.fillRect(30, 30, 68, 58); ell(64, 32, 34, 16, P.hair); g.fillStyle = P.skin; g.fillRect(38, 44, 52, 50); ell(64, 70, 26, 26, P.skin); g.fillStyle = P.hair; g.fillRect(36, 38, 56, 9); g.fillStyle = "#d9a84a"; g.fillRect(32, 34, 64, 4); ell(64, 33, 4, 5, "#3fb8c9"); ell(32, 80, 5, 5, "#d9a84a"); ell(96, 80, 5, 5, "#d9a84a"); }
  // ojos
  const ey = 60, eh = blink ? 0.6 : (who === "aurelio" ? 2.2 : 3.6);
  if (who === "cleo") { g.fillStyle = "#3fb8c9"; ell(52, ey - 3, 7, 3, "#3fb8c9"); ell(76, ey - 3, 7, 3, "#3fb8c9"); }
  ell(52, ey, 4, eh, "#1a1410"); ell(76, ey, 4, eh, "#1a1410");
  g.strokeStyle = who === "funes" || who === "aurelio" ? "#7a7a7a" : "#2a1a10"; g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(45, 51 + (who === "aurelio" ? 2 : 0)); g.lineTo(58, 50); g.moveTo(70, 50); g.lineTo(83, 51 + (who === "funes" ? 2 : 0)); g.stroke();
  if (who === "funes") { g.strokeStyle = "#1a1a1a"; g.lineWidth = 2; g.beginPath(); g.arc(52, ey, 8, 0, Math.PI * 2); g.moveTo(84, ey); g.arc(76, ey, 8, 0, Math.PI * 2); g.moveTo(60, ey); g.lineTo(68, ey); g.stroke(); }
  // nariz
  g.strokeStyle = "rgba(0,0,0,.25)"; g.lineWidth = 2; g.beginPath(); g.moveTo(64, 62); g.lineTo(61, 72); g.lineTo(66, 73); g.stroke();
  // boca
  const mc = who === "cleo" ? "#b8243a" : "#6a2a24";
  if (who === "aurelio") { g.fillStyle = "#b0b0b0"; g.beginPath(); g.moveTo(50, 77); g.quadraticCurveTo(64, 72, 78, 77); g.quadraticCurveTo(64, 76, 50, 77); g.fill(); }
  if (talk) ell(64, 82, 7, 4.5, "#3a1010");
  else if (who === "lucho") { g.strokeStyle = mc; g.lineWidth = 3; g.beginPath(); g.arc(64, 76, 10, 0.2, Math.PI - 0.2); g.stroke(); }
  else if (who === "funes") { g.fillStyle = mc; g.fillRect(56, 81, 16, 2.5); }
  else { g.strokeStyle = mc; g.lineWidth = 3; g.beginPath(); g.moveTo(55, 81); g.quadraticCurveTo(64, 86, 75, 79); g.stroke(); }
}

// =====================================================================
// ESTADO DE LA HISTORIA
// =====================================================================
let lastS = null;
function freshStory() {
  return { v: 1, act: 1, active: {}, done: {}, flags: { dirty: 0 }, decisions: [], acc: {}, accDay: 0, trophies: [], ending: null, endingSeen: false, met: {} };
}
function ensure() {
  const s = S(); if (!s) return false;
  if (s === lastS) return true;
  lastS = s;
  const raw = s.story, st = freshStory();
  const isNum = v => typeof v === "number" && Number.isFinite(v);
  if (raw && typeof raw === "object") {
    st.act = isNum(raw.act) ? clamp(Math.round(raw.act), 1, 5) : 1;
    if (raw.active && typeof raw.active === "object") for (const id in raw.active) {
      const m = raw.active[id]; if (!MDEF[id] || !m || typeof m !== "object") continue;
      st.active[id] = { day: isNum(m.day) ? m.day : s.day, base: (m.base && typeof m.base === "object") ? m.base : {}, data: (m.data && typeof m.data === "object") ? m.data : {}, seen: !!m.seen };
    }
    if (raw.done && typeof raw.done === "object") for (const id in raw.done) if (MDEF[id] && typeof raw.done[id] === "string") { st.done[id] = raw.done[id]; delete st.active[id]; }
    if (raw.flags && typeof raw.flags === "object") for (const k in raw.flags) { const v = raw.flags[k]; if (typeof v === "number" || typeof v === "boolean") st.flags[k] = v; }
    st.flags.dirty = isNum(st.flags.dirty) ? clamp(st.flags.dirty, 0, 9) : 0;
    if (Array.isArray(raw.decisions)) st.decisions = raw.decisions.filter(x => typeof x === "string").slice(0, 20);
    if (raw.acc && typeof raw.acc === "object") for (const k in raw.acc) if (isNum(raw.acc[k])) st.acc[k] = raw.acc[k];
    st.accDay = isNum(raw.accDay) ? raw.accDay : 0;
    if (Array.isArray(raw.trophies)) st.trophies = raw.trophies.filter(t => TROPHIES[t]).filter((t, i, a) => a.indexOf(t) === i);
    if (["rey", "funcion", "malo"].includes(raw.ending)) st.ending = raw.ending;
    st.endingSeen = !!raw.endingSeen;
    st.doneDay = {}; if (raw.doneDay && typeof raw.doneDay === "object") for (const k in raw.doneDay) if (MDEF[k] && isNum(raw.doneDay[k])) st.doneDay[k] = raw.doneDay[k];
    if (raw.met && typeof raw.met === "object") for (const k in raw.met) if (CHARS[k]) st.met[k] = 1;
  } else if (s.day > 2) {
    // partida vieja: el tutorial ya no hace falta
    st.done.m_primera_caja = "skip"; st.done.m_segunda = "skip";
    if (s.rivalBought) { st.ending = "rey"; st.endingSeen = true; }
  }
  s.story = st;
  resetRuntime();
  return true;
}

// estadísticas acumuladas: lo de días anteriores (acc) + lo de hoy
function total(k) {
  const s = S(), st = ST();
  const today = st.accDay === s.day ? 0 : (k === "deposits" ? (s.today.inc.deposits || 0) : (s.today.st[k] || 0));
  return (st.acc[k] || 0) + today;
}
function since(m, k) { return total(k) - (m.base[k] || 0); }

// =====================================================================
// MISIONES Y EVENTOS (decisiones)
// =====================================================================
const done = id => !!ST().done[id];
const ok = id => ST().done[id] === "ok" || ST().done[id] === "skip";
const dl = (m) => m.data.deadline;
const M = [
  // ---------------- ACTO I · La Clásica usada (rango 1)
  { id: "m_primera_caja", act: 1, who: "lucho", title: "Vaciá una caja y depositala", desc: `Mirá la Clásica cuando tenga plata, mantené ${KEY} para vaciar la caja y llevá la plata a la caja fuerte de la entrada.`,
    req: () => true, intro: "intro", outro: "primera_ok", reward: { cash: 200, xp: 20 },
    prog: () => `caja ${Math.min(1, total("boxesByHand"))}/1 · depósito ${total("deposits") > 0 ? "✓" : "—"}`,
    ok: () => total("boxesByHand") >= 1 && total("deposits") > 0 },
  { id: "m_segunda", act: 1, who: "lucho", title: "Pedí una segunda tragamonedas", desc: `En la compu de la oficina (a la derecha de la entrada) pedí otra máquina. El camión deja la caja en la vereda: levantala con ${KEY}, entrala y abrila (${KEY}) para elegir dónde va.`,
    req: () => done("m_primera_caja"), intro: "segunda", outro: "segunda_ok", reward: { xp: 30 },
    prog: () => `${Math.min(2, S().machines.length)}/2 máquinas`, ok: () => S().machines.length >= 2 },
  { id: "m_kiosco", act: 1, who: "lucho", title: "Atendé el kiosco", desc: `Llevá una caja de bebidas o snacks de la vereda a la heladera o a la estantería y mantené ${KEY} para reponer 6. Después cobrá 3 veces en la caja registradora (a la izquierda de la entrada).`,
    req: () => done("m_segunda"), intro: "kiosco", outro: "kiosco_ok", reward: { cash: 150, xp: 30 },
    prog: m => `repuesto ${Math.min(6, since(m, "restocked"))}/6 · cobros ${Math.min(3, since(m, "registerByHand"))}/3`,
    ok: m => since(m, "restocked") >= 6 && since(m, "registerByHand") >= 3 },
  { id: "ev_trato", act: 1, who: "aurelio", event: true, title: "La oferta de Don Aurelio", desc: "Un señor de traje blanco quiere hablar con vos.",
    req: () => done("m_segunda") && (S().day >= 2 || hourNow() >= 13), intro: "trato" },
  { id: "m_deuda", act: 1, who: "aurelio", title: "Devolvele $6.500 a Don Aurelio", desc: "Pagale desde este registro antes de que venza el plazo. Si no, se cobra solo y con recargo.",
    req: () => false, pay: 6500, reward: { xp: 60, rep: 3 }, outro: "deuda_ok", failDlg: "deuda_fail",
    prog: m => `vence al cierre del día ${dl(m)}`, ok: m => !!m.data.paid, fail: m => S().day > dl(m),
    onFail: () => { const st = ST(); st.flags.aurelioMad = true; F.Economy.force("loanPay", Math.round(6500 * 1.2)); F.Heat.add(10, "story"); F.Rep.change(-5); } },
  { id: "m_ahorro", act: 1, who: "lucho", title: "Juntá $6.000 en el banco", desc: "Sin la plata de Don Aurelio, hay que ahorrar. Tené $6.000 en el banco antes de que venza el plazo.",
    req: () => false, reward: { xp: 80, rep: 5 }, outro: "ahorro_ok", failDlg: "ahorro_fail",
    prog: m => `${fmt(Math.max(0, S().bank))}/$6.000 · hasta el día ${dl(m)}`, ok: () => S().bank >= 6000, fail: m => S().day > dl(m) },
  { id: "m_rango2", act: 1, who: "lucho", title: `Llegá al rango ${rankName(2)}`, desc: "Ganá XP vaciando cajas, reparando, atendiendo gente y con la ganancia del día.",
    req: () => done("ev_trato"), outro: "rango2_ok", reward: { cash: 300 }, prog: () => `rango ${S().rank}/2`, ok: () => S().rank >= 2 },
  // ---------------- ACTO II · Papeles en regla (rango 2)
  { id: "m_personal", act: 2, who: "lucho", title: "Contratá a tu primer empleado", desc: "Un técnico, un guardia, un cajero (cobra en la caja registradora) o un repositor (repone las góndolas), desde Gestión → Personal.",
    req: () => done("m_rango2"), intro: "personal", reward: { xp: 40 }, ok: () => Object.values(S().staff).some(n => n > 0) },
  { id: "m_funes", act: 2, who: "funes", title: "Sobreviví la inspección sorpresa", desc: "El Inspector Funes viene mañana. Que no encuentre máquinas truchas, no lo coimees y tené el calor debajo de 30 cuando se vaya.",
    req: () => done("m_personal"), intro: "funes_aviso", outro: "funes_ok", failDlg: "funes_fail", reward: { xp: 120, trophy: "diploma" },
    prog: () => `calor ${Math.round(S().heat)}/30`, ok: m => m.data.result === "ok", fail: m => m.data.result === "fail",
    onOk: () => { ST().flags.funesTrust = true; }, onFail: () => { ST().flags.funesSuspicious = true; } },
  { id: "ev_valija", act: 2, who: "aurelio", event: true, title: "El favorcito de la valija", desc: "Don Aurelio quiere pedirte algo.",
    req: m => done("m_funes") && S().day > (ST().doneDay?.m_funes || 0), intro: "valija" },
  { id: "m_valija", act: 2, who: "aurelio", title: "Guardá la valija sin levantar sospechas", desc: "Cerrá 3 días con el calor debajo de 60. Si el calor llega a 60 al cierre, la Lotería huele algo.",
    req: () => false, reward: { xp: 90 }, outro: "valija_ok", failDlg: "valija_fail", prog: m => `${m.data.n || 0}/3 cierres · calor ${Math.round(S().heat)}`,
    ok: m => (m.data.n || 0) >= 3, fail: m => !!m.data.failed,
    close: m => { if (S().heat >= 60) m.data.failed = true; else m.data.n = (m.data.n || 0) + 1; },
    onFail: () => { F.Economy.force("fines", 3000); F.Rep.change(-6); } },
  { id: "m_presion", act: 2, who: "aurelio", title: "Aguantá la presión de Don Aurelio", desc: "Cerrá 2 días seguidos con reputación 45 o más.",
    req: () => false, reward: { xp: 90, cash: 800 }, outro: "presion_ok", prog: m => `${m.data.n || 0}/2 cierres seguidos · reputación ${Math.round(S().rep)}`,
    ok: m => (m.data.n || 0) >= 2, close: m => { m.data.n = S().rep >= 45 ? (m.data.n || 0) + 1 : 0; } },
  { id: "m_rango3", act: 2, who: "lucho", title: `Llegá al rango ${rankName(3)}`, desc: "Con más rango vienen las mesas, el cajero y los high rollers.",
    req: () => done("ev_valija"), reward: { cash: 500 }, prog: () => `rango ${S().rank}/3`, ok: () => S().rank >= 3 },
  // ---------------- ACTO III · La reina de enfrente (rango 3, El Faraón abierto)
  { id: "ev_cleo", act: 3, who: "cleo", event: true, title: "Visita de la competencia", desc: "Alguien de enfrente cruzó la calle.",
    req: () => done("m_rango3") && F.rivalOpen(), intro: "cleo" },
  { id: "m_atractivo", act: 3, who: "cleo", title: "Superá el atractivo de El Faraón", desc: "Más máquinas, decoración y buena fama suben el atractivo.",
    req: () => done("ev_cleo"), reward: { xp: 100, trophy: "neon" }, outro: "atractivo_ok",
    prog: () => `${Math.round(F.attractiveness())} contra ${Math.round(F.rivalAtr())}`, ok: () => F.attractiveness() > F.rivalAtr() },
  { id: "m_highroller", act: 3, who: "lucho", title: "Ganate a los high rollers", desc: "Que jueguen 4 high rollers en un mismo día. Les gusta el Blackjack y un casino lindo (atractivo 40 o más).",
    req: () => done("ev_cleo"), reward: { cash: 1500, xp: 100, trophy: "cuadro" }, outro: "highroller_ok",
    prog: () => `hoy ${S().today.st.highrollers || 0}/4`, ok: () => (S().today.st.highrollers || 0) >= 4 },
  { id: "ev_promo", act: 3, who: "cleo", event: true, title: "La promo del camello", desc: "Cleo anuncia algo grande.",
    req: () => done("m_atractivo") || done("m_highroller"), intro: "promo" },
  { id: "m_sabotaje", act: 3, who: "aurelio", title: "Que la promo de El Faraón fracase", desc: "Los muchachos de Don Aurelio corren el rumor del camello que muerde. Esperá al cierre del día de la promo.",
    req: () => false, reward: { xp: 60 }, outro: "sabotaje_ok", prog: m => `promo del día ${m.data.day}`,
    ok: m => !!m.data.closed, close: m => { if (S().day >= m.data.day) m.data.closed = true; } },
  { id: "m_contrapromo", act: 3, who: "lucho", title: "Competile limpio a la promo", desc: "El día de la promo de El Faraón vas a tener menos clientes. Ganá $1.500 netos igual.",
    req: () => false, reward: { cash: 1000, xp: 120, rep: 6 }, outro: "contrapromo_ok", failDlg: "contrapromo_fail",
    prog: m => S().day < m.data.day ? `promo el día ${m.data.day}` : `hoy ${fmt(S().today.st.net)}/$1.500`,
    ok: m => S().day === m.data.day && S().today.st.net >= 1500, fail: m => S().day > m.data.day || !!m.data.failed,
    close: m => { if (S().day === m.data.day && S().today.st.net < 1500) m.data.failed = true; }, onFail: () => F.Rep.change(-3) },
  { id: "m_rango4", act: 3, who: "lucho", title: `Llegá al rango ${rankName(4)}`, desc: "Se viene la barra, el Ala Este y las máquinas Diamante.",
    req: () => done("ev_promo"), reward: { cash: 1000 }, prog: () => `rango ${S().rank}/4`, ok: () => S().rank >= 4 },
  // ---------------- ACTO IV · Noche de gala (rangos 4-5)
  { id: "m_barra", act: 4, who: "lucho", title: "Abrí la barra y serví 3 tragos", desc: "Pedí la Barra de tragos en la compu (pestaña Decoración), abrí la caja en su lugar junto a la entrada y llevale 3 tragos a mano a high rollers o VIP.",
    req: () => done("m_rango4"), intro: "barra", reward: { cash: 1000, xp: 100 },
    prog: m => `${S().bar ? "barra ✓" : "sin barra"} · tragos ${Math.min(3, since(m, "drinksByHand"))}/3`, ok: m => S().bar && since(m, "drinksByHand") >= 3 },
  { id: "ev_especiales", act: 4, who: "aurelio", event: true, title: "Las máquinas especiales", desc: "Don Aurelio vuelve con una propuesta grande.",
    req: () => done("m_barra"), intro: "especiales" },
  { id: "m_ladrones", act: 4, who: "aurelio", title: "Atrapá a los ladrones de Don Aurelio", desc: "Don Aurelio está ofendido y te manda ladrones. Atrapá 3 (vos o tus guardias).",
    req: () => false, reward: { cash: 2000, xp: 150 }, outro: "ladrones_ok", prog: m => `${Math.min(3, since(m, "caught"))}/3`, ok: m => since(m, "caught") >= 3 },
  { id: "m_vip", act: 4, who: "lucho", title: "Noche de gala VIP", desc: "El día de la gala llegan VIP a la noche. Recibí a 2 en la puerta y ganá $3.000 netos ese día.",
    req: () => done("m_barra") && S().rank >= 5, intro: "gala", start: m => { m.data.day = m.day + 1; }, reward: { cash: 5000, xp: 200, trophy: "clasica" }, outro: "gala_ok",
    prog: m => S().day < m.data.day ? `gala el día ${m.data.day}` : `VIP ${Math.min(2, S().today.st.vipGreeted)}/2 · ${fmt(S().today.st.net)}/$3.000`,
    ok: m => S().day === m.data.day && S().today.st.vipGreeted >= 2 && S().today.st.net >= 3000 },
  { id: "m_rango6", act: 4, who: "lucho", title: `Llegá al rango ${rankName(6)}`, desc: "El último acto se juega en las grandes ligas.",
    req: () => done("m_vip") && done("ev_especiales"), reward: { cash: 2000 }, prog: () => `rango ${S().rank}/6`, ok: () => S().rank >= 6 },
  // ---------------- ACTO V · La última mano (rango 6+)
  { id: "m_libertad", act: 5, who: "aurelio", title: "Comprá tu libertad: $40.000 a Don Aurelio", desc: "Aceptaste demasiados favores. Pagale antes de que venza el plazo o Don Aurelio se queda con el casino.",
    req: () => done("m_rango6") && ST().flags.dirty >= 2, intro: "libertad", start: m => { m.data.deadline = m.day + 8; }, pay: 40000, reward: { xp: 300 }, outro: "libertad_ok",
    prog: m => `vence al cierre del día ${dl(m)}`, ok: m => !!m.data.paid, fail: m => S().day > dl(m), onFail: () => setEnding("malo") },
  { id: "ev_final", act: 5, who: "cleo", event: true, title: "La oferta de la reina", desc: "Cleo quiere cerrar el asunto de una vez.",
    req: () => done("m_rango6") && (ST().flags.dirty < 2 || ok("m_libertad")), intro: "final" },
  { id: "m_comprar", act: 5, who: "cleo", title: "Comprá El Faraón", desc: `Llegá al rango ${rankName(8)} y compralo desde Gestión → Banco.`,
    req: () => false, prog: () => S().rank < 8 ? `rango ${S().rank}/8` : `precio ${fmt(D.RIVAL.buyoutBase + D.RIVAL.buyoutPerAtr * F.rivalAtr())}`, ok: () => S().rivalBought },
  { id: "m_hundir", act: 5, who: "cleo", title: "Hundí a El Faraón", desc: "Cerrá 3 días seguidos con 1,6 veces su atractivo y reputación 70 o más.",
    req: () => false, prog: m => `${m.data.n || 0}/3 · ${Math.round(F.attractiveness())}/${Math.round(F.rivalAtr() * 1.6)} · rep ${Math.round(S().rep)}/70`,
    ok: m => (m.data.n || 0) >= 3, close: m => { m.data.n = (F.attractiveness() >= 1.6 * F.rivalAtr() && S().rep >= 70) ? (m.data.n || 0) + 1 : 0; },
    onOk: () => setEnding("funcion") },
];
const MDEF = {}; for (const m of M) MDEF[m.id] = m;
const ACTS = ["", "La Clásica usada", "Papeles en regla", "La reina de enfrente", "Noche de gala", "La última mano"];
const ENDINGS = { rey: "Final: El Rey de la noche", funcion: "Final: La última función", malo: "Final malo: Aurelio's" };

function startMission(id, data) {
  const st = ST(), def = MDEF[id]; if (!def || st.active[id] || st.done[id]) return null;
  const base = {}; for (const k of ["boxesByHand", "deposits", "drinksByHand", "caught", "highrollers", "vipGreeted", "restocked", "registerByHand"]) base[k] = total(k);
  const m = st.active[id] = { day: S().day, base, data: data || {}, seen: !def.intro };
  if (def.act > st.act) st.act = def.act;
  if (def.start) def.start(m);
  if (def.intro) queue(def.intro, id);
  else if (!def.event) toast(`Nueva misión: ${def.title}`);
  return m;
}
function finish(id, result, notes) {
  const st = ST(), def = MDEF[id], m = st.active[id]; if (!def || !m) return;
  delete st.active[id]; st.done[id] = result;
  (st.doneDay || (st.doneDay = {}))[id] = S().day;
  if (def.event) { F.updateHud(true); return; }
  if (result === "ok") {
    const r = def.reward || {}, parts = [];
    if (r.cash) { F.Economy.add("objectives", r.cash); parts.push("+" + fmt(r.cash)); }
    if (r.xp) { F.Rank.add(r.xp, true); parts.push(`+${r.xp} XP`); }
    if (r.rep) { F.Rep.change(r.rep); parts.push(`+${r.rep} reputación`); }
    if (r.trophy) { addTrophy(r.trophy); parts.push(TROPHIES[r.trophy].name); }
    const msg = `Misión cumplida: ${def.title}${parts.length ? " (" + parts.join(", ") + ")" : ""}`;
    toast(msg, "xp"); if (notes) notes.push("Historia · " + msg + ".");
    if (def.onOk) def.onOk(m);
    if (def.outro) queue(def.outro);
  } else {
    const msg = `Misión fallida: ${def.title}`;
    toast(msg, "bad"); if (notes) notes.push("Historia · " + msg + ".");
    if (def.onFail) def.onFail(m);
    if (def.failDlg) queue(def.failDlg);
  }
  F.updateHud(true);
}
function evaluate(notes) {
  const st = ST();
  for (const id of Object.keys(st.active)) {
    const def = MDEF[id], m = st.active[id]; if (!def || def.event || !m.seen) continue;
    if (def.ok && def.ok(m)) finish(id, "ok", notes);
    else if (def.fail && def.fail(m)) finish(id, "fail", notes);
  }
  if (st.ending) return;
  for (const def of M) if (!st.active[def.id] && !st.done[def.id] && def.req()) startMission(def.id);
}
function setEnding(e) {
  const st = ST(); if (st.ending) return;
  st.ending = e; st.endingSeen = false;
  if (e === "funcion") { S().rivalBought = true; F.rival.update(); addTrophy("esfinge"); }
  for (const id of Object.keys(st.active)) { st.done[id] = "skip"; delete st.active[id]; }
  queue("end_" + e);
}
function decide(text) { ST().decisions.push(text); }
// la imagen del dueño (owner.js) impone respeto: Don Aurelio y compañía cobran un poco menos
function payOf(def) { return Math.round(def.pay * (window.CasinoOwner ? window.CasinoOwner.respectMul() : 1)); }
function pay(id) {
  const def = MDEF[id], m = ST().active[id]; if (!def || !m || !def.pay || m.data.paid) return false;
  if (!F.Economy.trySpend("loanPay", payOf(def))) return false;
  m.data.paid = true; F.save(true); evaluate(); F.updateHud(true); return true;
}

// hook de cierre de día (game.js → endDay, antes de calcular el banco final)
function onEndDay(notes) {
  if (window.CasinoChallenge?.storyOff?.()) return;
  if (!ensure()) return;
  const s = S(), st = ST();
  if (st.accDay !== s.day) {
    for (const k in s.today.st) st.acc[k] = (st.acc[k] || 0) + (s.today.st[k] || 0);
    st.acc.deposits = (st.acc.deposits || 0) + (s.today.inc.deposits || 0);
    st.accDay = s.day;
  }
  for (const id of Object.keys(st.active)) { const def = MDEF[id], m = st.active[id]; if (def.close && m.seen) def.close(m); }
  evaluate(notes);
}

// =====================================================================
// TROFEOS (decoración única, suman atractivo)
// =====================================================================
const TROPHIES = {
  diploma: { name: "Diploma de Funes", atr: 3 },
  neon: { name: "Neón DORADO", atr: 6 },
  cuadro: { name: "Retrato del high roller", atr: 4 },
  clasica: { name: "Clásica de oro", atr: 10 },
  esfinge: { name: "Esfinge de El Faraón", atr: 15 },
};
const trophyObjs = {};
function canvasPlane(w, h, pw, ph, draw, basic) {
  const tex = A.canvasTex(pw, ph, draw);
  const mat = basic ? new T.MeshBasicMaterial({ map: tex, transparent: true }) : new T.MeshStandardMaterial({ map: tex, roughness: 0.7 });
  return new T.Mesh(new T.PlaneGeometry(w, h), mat);
}
function buildTrophy(id) {
  const g = new T.Group(); let col = null;
  if (id === "diploma") {
    const m = canvasPlane(0.9, 0.66, 360, 264, (c, w, h) => {
      c.fillStyle = "#6a4a24"; c.fillRect(0, 0, w, h); c.fillStyle = "#f3ead2"; c.fillRect(16, 16, w - 32, h - 32);
      c.strokeStyle = "#d9a84a"; c.lineWidth = 4; c.strokeRect(26, 26, w - 52, h - 52);
      c.fillStyle = "#3a2a14"; c.textAlign = "center"; c.font = "bold 30px Georgia, serif"; c.fillText("DIPLOMA", w / 2, 74);
      c.font = "20px Georgia, serif"; c.fillText("Casino en regla", w / 2, 112); c.font = "italic 16px Georgia, serif"; c.fillText("Lotería · Formulario 27-B", w / 2, 142);
      c.fillText("Insp. E. Funes", w / 2, 200); c.fillStyle = "#b8243a"; c.beginPath(); c.arc(w - 70, h - 66, 22, 0, 7); c.fill();
    });
    m.position.set(-5.6, 2.45, -9.83); g.add(m);
  } else if (id === "neon") {
    const m = canvasPlane(3.4, 0.95, 512, 144, (c, w, h) => {
      c.clearRect(0, 0, w, h); c.textAlign = "center"; c.textBaseline = "middle"; c.font = "bold 104px Georgia, serif";
      c.shadowColor = "#ff5fa2"; c.shadowBlur = 26; c.fillStyle = "#ffd1e6"; c.fillText("DORADO", w / 2, h / 2 + 4); c.fillText("DORADO", w / 2, h / 2 + 4);
    }, true);
    m.position.set(0, 2.95, 9.83); m.rotation.y = Math.PI; g.add(m);
  } else if (id === "cuadro") {
    const m = canvasPlane(0.85, 1.05, 256, 316, (c, w, h) => {
      c.fillStyle = "#d9a84a"; c.fillRect(0, 0, w, h); c.fillStyle = "#3a1a10"; c.fillRect(14, 14, w - 28, h - 28);
      c.fillStyle = "#1a1a24"; c.beginPath(); c.ellipse(w / 2, h - 40, 90, 70, 0, 0, 7); c.fill();
      c.fillStyle = "#e0ac69"; c.beginPath(); c.ellipse(w / 2, 140, 52, 62, 0, 0, 7); c.fill();
      c.fillStyle = "#1a1410"; c.fillRect(w / 2 - 24, 128, 10, 8); c.fillRect(w / 2 + 14, 128, 10, 8);
      c.fillStyle = "#2a1a10"; c.beginPath(); c.ellipse(w / 2, 92, 54, 24, 0, Math.PI, 0); c.fill();
      c.strokeStyle = "#6a2a24"; c.lineWidth = 4; c.beginPath(); c.arc(w / 2, 160, 18, 0.2, Math.PI - 0.2); c.stroke();
      c.fillStyle = "#f6c766"; c.font = "italic 18px Georgia, serif"; c.textAlign = "center"; c.fillText("¡Al mejor casino!", w / 2, h - 26);
    });
    m.position.set(-4.4, 2.75, 9.83); m.rotation.y = Math.PI; g.add(m);
  } else if (id === "clasica" || id === "esfinge") {
    const x = id === "clasica" ? 9.25 : -9.25, z = id === "clasica" ? -5.6 : -3.3; // la esfinge se corrió: ahí están la heladera y los snacks (shop.js)
    const ped = new T.Mesh(A.roundedBox(0.8, 0.6, 0.8, 0.04), A.materials.marble); ped.position.y = 0.3; g.add(ped);
    if (id === "clasica") {
      const sm = A.makeSlotMachine({ color: 0xd9a84a, name: "CLÁSICA DE ORO" }); sm.scale.setScalar(0.55); sm.position.y = 0.6; sm.rotation.y = -Math.PI / 2; g.add(sm);
    } else {
      const sand = A.std(0xd9b46a, 0.6, 0.1), gold = A.materials.brass, blue = A.std(0x2a5fd0, 0.4);
      const body = new T.Mesh(new T.BoxGeometry(0.42, 0.32, 0.72), sand); body.position.set(0, 0.76, 0.05); g.add(body);
      const paws = new T.Mesh(new T.BoxGeometry(0.4, 0.12, 0.3), sand); paws.position.set(0, 0.66, 0.5); g.add(paws);
      const head = new T.Mesh(new T.BoxGeometry(0.26, 0.3, 0.24), sand); head.position.set(0, 1.08, 0.36); g.add(head);
      const nem = new T.Mesh(new T.ConeGeometry(0.24, 0.42, 4), blue); nem.position.set(0, 1.08, 0.28); nem.rotation.y = Math.PI / 4; g.add(nem);
      const band = new T.Mesh(new T.BoxGeometry(0.3, 0.05, 0.27), gold); band.position.set(0, 1.2, 0.36); g.add(band);
      g.rotation.y = Math.PI / 2;
    }
    g.position.set(x, 0, z); col = F.boxAt(x, z, 0.85, 0.85, "decor");
  }
  F.scene.add(g); trophyObjs[id] = { group: g, col };
}
function addTrophy(id) { const st = ST(); if (!st.trophies.includes(id)) st.trophies.push(id); if (!trophyObjs[id]) buildTrophy(id); }
function syncTrophies() {
  const want = new Set(ST().trophies);
  for (const id in trophyObjs) if (!want.has(id)) { F.scene.remove(trophyObjs[id].group); if (trophyObjs[id].col) F.removeCollider(trophyObjs[id].col); delete trophyObjs[id]; }
  for (const id of want) if (!trophyObjs[id]) buildTrophy(id);
}
function trophyAtr() { const s = S(); if (!s || !s.story || !Array.isArray(s.story.trophies)) return 0; let a = 0; for (const t of s.story.trophies) if (TROPHIES[t]) a += TROPHIES[t].atr; return a; }

// =====================================================================
// PERSONAJES EN EL CASINO (muñecos de CasinoArt.makePerson)
// =====================================================================
const LUCHO_HOME = { x: -3.3, z: -9.0 };
const npcs = {};
function makeNpcGroup(who) {
  let look;
  if (who === "lucho") look = { uniform: "host", skin: 0xc68642, hair: 0x24160c, height: 0.97 };
  else if (who === "aurelio") look = { vip: true, jacket: 0xefe8d8, pants: 0xefe8d8, skin: 0xe0ac69, hair: 0xc9c9c9, height: 1.0 };
  else if (who === "cleo") look = { vip: true, female: true, jacket: 0x1b3a8a, pants: 0x1b3a8a, skin: 0xd9a074, hair: 0x0d0d10, height: 1.02 };
  else look = { vip: true, jacket: 0x6b7078, pants: 0x55595f, skin: 0xf1c27d, hair: 0x9a9a9a, height: 1.0 };
  const g = A.makePerson(look), J = g.api.joints;
  if (who === "aurelio") {
    const hm = A.std(0xefe8d8, 0.6), bm = A.std(0x14060a, 0.6);
    const brim = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.015, 16), hm); brim.position.y = 0.24; J.head.add(brim);
    const crown = new T.Mesh(new T.CylinderGeometry(0.115, 0.13, 0.13, 16), hm); crown.position.y = 0.31; J.head.add(crown);
    const band = new T.Mesh(new T.CylinderGeometry(0.132, 0.132, 0.03, 16), bm); band.position.y = 0.26; J.head.add(band);
    const flower = new T.Mesh(new T.SphereGeometry(0.04, 8, 6), A.std(0xd4423f, 0.5)); flower.position.set(-0.11, 0.52, 0.14); J.torso.add(flower);
  } else if (who === "cleo") {
    const hb = new T.Mesh(new T.TorusGeometry(0.135, 0.014, 6, 20), A.materials.brass); hb.rotation.x = Math.PI / 2 - 0.25; hb.position.y = 0.19; J.head.add(hb);
    const gem = new T.Mesh(new T.SphereGeometry(0.025, 8, 6), A.std(0x3fb8c9, 0.3)); gem.position.set(0, 0.22, 0.13); J.head.add(gem);
  } else if (who === "funes") {
    const f = new T.Mesh(new T.BoxGeometry(0.26, 0.34, 0.03), A.std(0x3a2a14, 0.7)); f.position.set(0, -0.3, 0.08); f.rotation.x = 0.3; J.elbowR.add(f);
  }
  return g;
}
function spawnNpc(who, x, z) {
  let n = npcs[who];
  if (!n) {
    const g = makeNpcGroup(who);
    n = npcs[who] = { who, group: g, api: g.api, x, z, path: null, then: null, linger: 0, mode: "stand" };
    n.proxy = F.proxy(g, 0.6, 1.8, 0.6, { prompt: () => ({ text: CHARS[who].name, sub: who === "lucho" ? "Hablar · pistas y misiones" : "Hablar" }), hold: () => 0, usable: () => true, use: () => talk(who) }, 0.95);
  }
  if (!n.group.parent) F.scene.add(n.group);
  n.x = x; n.z = z; n.group.position.set(x, 0, z); n.path = null; n.linger = 0; n.mode = "stand"; n.api.stand();
  return n;
}
function removeNpc(who) { const n = npcs[who]; if (!n) return; F.scene.remove(n.group); F.dropProxy(n.proxy); delete npcs[who]; }
function walkNpc(n, x, z, then) { n.path = F.findPath(n.x, n.z, x, z); n.then = then || null; n.mode = "walk"; }
function faceNpc(n, x, z) { n.group.rotation.y = Math.atan2(x - n.x, z - n.z); }
function freeSpot(x, z) {
  if (x < -21.5 || x > 21.5 || z < -9.6 || z > 9.6) return false;
  for (const c of DBG.colliders) if (c.on() && x > c.minX - 0.35 && x < c.maxX + 0.35 && z > c.minZ - 0.35 && z < c.maxZ + 0.35) return false;
  return true;
}
function bringNpc(who) {
  const P = DBG.player;
  let pos = null;
  for (const d of [2.3, 1.8, 2.8, 1.4]) { for (const da of [0, 0.35, -0.35, 0.7, -0.7, 1.2, -1.2]) { const a = P.yaw + da, x = P.x - Math.sin(a) * d, z = P.z - Math.cos(a) * d; if (freeSpot(x, z)) { pos = { x, z }; break; } } if (pos) break; }
  if (!pos) pos = { x: P.x - Math.sin(P.yaw) * 1.6, z: P.z - Math.cos(P.yaw) * 1.6 };
  const n = spawnNpc(who, pos.x, pos.z); faceNpc(n, P.x, P.z);
  // la cámara mira al personaje (el juego está en pausa: se ajusta a mano)
  P.yaw = Math.atan2(-(pos.x - P.x), -(pos.z - P.z)); P.pitch = -0.12;
  F.camera.rotation.set(P.pitch, P.yaw, 0);
  return n;
}
function dismissNpc(who) {
  const n = npcs[who]; if (!n) return;
  if (who === "lucho") { walkNpc(n, LUCHO_HOME.x, LUCHO_HOME.z, () => { n.mode = "stand"; n.group.rotation.y = 0; }); return; }
  n.mode = "linger"; n.linger = 12;
}
function updateNpcs(dt) {
  for (const who in npcs) {
    const n = npcs[who];
    if (n.mode === "walk") {
      const t = n.path && n.path[0];
      if (!t) { n.mode = "stand"; const f = n.then; n.then = null; if (f) f(); continue; }
      const dx = t.x - n.x, dz = t.z - n.z, d = Math.hypot(dx, dz), step = 1.7 * dt;
      if (d <= step) { n.x = t.x; n.z = t.z; n.path.shift(); } else { n.x += dx / d * step; n.z += dz / d * step; n.group.rotation.y = Math.atan2(dx, dz); }
      n.group.position.set(n.x, 0, n.z); n.api.walk(dt, 1.7);
    } else {
      n.api.idle(dt);
      if (n.mode === "linger") { n.linger -= dt; if (n.linger <= 0) walkNpc(n, 0, -8.6, () => walkNpc(n, 0, -15.5, () => removeNpc(who))); }
    }
  }
}
function talk(who) {
  if (who === "lucho") { queue("lucho_talk"); return; }
  const lines = { aurelio: ["Un placer verlo. Los favores, como el vino, mejoran con el tiempo.", "No se preocupe por mí. Yo me preocupo por todos."], cleo: ["Lindo lugar. Para un garaje.", "Mirá mi neón azul desde tu ventana y soñá, querido."], funes: ["Estoy de servicio. Hasta cuando no estoy de servicio, estoy de servicio."] }[who] || ["…"];
  dialogs["chat_" + who] = { lines: [[who, lines[(Math.random() * lines.length) | 0]]] };
  queue("chat_" + who);
}

// =====================================================================
// DIÁLOGOS
// =====================================================================
const dlDay = id => { const m = ST().active[id]; return m ? m.data.deadline : "?"; };
const dialogs = {
  intro: { appear: "lucho", lines: () => [
    ["narr", "Acto I · La Clásica usada. Ciudad de noche, neón cansado y una tragamonedas que tose monedas. Este es tu casino."],
    ["lucho", "¡Manu! Soy Lucho. Trabajaba para el dueño anterior y… bueno, vengo con el local. Como la Clásica."],
    ["lucho", `La Clásica junta lo que gana en su caja. Cuando tenga plata, mirala y mantené ${KEY} para vaciarla en tu bolsillo.`],
    ["lucho", "Después llevás la plata a la caja fuerte de la entrada, a la izquierda. El bolsillo no es un banco, por más que mi tío diga lo contrario."],
    ["lucho", "Si te perdés, hablame (estoy en la entrada) o mirá el registro de Historia arriba a la derecha."]] },
  primera_ok: { lines: [["lucho", "¡Eso! Primera plata depositada. Mi tío decía: «la plata en el bolsillo es una idea; en la caja fuerte es un hecho»."]] },
  segunda: { lines: [["lucho", "Con una sola máquina no se arma una noche. En la oficina, a la derecha de la entrada, está la compu: pedí otra tragamonedas a La Estrella."], ["lucho", "El camión deja la caja en la vereda. La levantás, la entrás, la abrís y elegís dónde va. Pesa, eh: vas a caminar más lento."]] },
  kiosco: { lines: [["lucho", "Otra cosa: la gente también compra fichas, bebidas y snacks. Si la heladera está vacía, se quejan y se van."], ["lucho", "Traé una caja de la vereda, mantené E frente a la heladera o los snacks para reponer, y cobrá en la caja registradora. Ojo con el vuelto: si das de más, lo perdés."]] },
  kiosco_ok: { lines: [["lucho", "¡Así se atiende un kiosco! Los precios los ponés vos en la compu: el mercado cambia todos los días."]] },
  segunda_ok: { lines: [["lucho", "Dos máquinas. Ya somos un casino. Chiquito, pero casino."]] },
  trato: { appear: "aurelio", lines: () => [
    ["narr", "Un perfume caro entra antes que él. Traje blanco, clavel rojo, sonrisa de vendedor de paraguas en día de lluvia."],
    ["aurelio", "Buenas noches. Don Aurelio Cardenal, para servirle. Conocí al dueño anterior… hombre simpático, poco puntual con sus deudas."],
    ["aurelio", `Le traigo una oferta de bienvenida: $5.000 hoy. Me devuelve $6.500 antes del cierre del día ${S().day + 7}. Sin papeles: entre caballeros alcanza con la palabra.`],
    ["lucho", "(bajito) Manu… con Don Aurelio todo es fácil hasta que deja de serlo."]],
    choices: [{ key: "si", label: "Aceptar los $5.000", sub: "Devolvés $6.500 en 7 días" }, { key: "no", label: "No, gracias, Don Aurelio", sub: "Te las arreglás sin su plata" }],
    choose(k) {
      const d = S().day + 7;
      if (k === "si") { F.Economy.add("loan", 5000); decide("Aceptaste la plata de Don Aurelio."); finish("ev_trato", "si"); startMission("m_deuda", { deadline: d }); return "trato_si"; }
      decide("Rechazaste la oferta de Don Aurelio."); finish("ev_trato", "no"); startMission("m_ahorro", { deadline: d }); return "trato_no";
    } },
  trato_si: { lines: [["aurelio", "Sabia decisión. Me gusta la gente que entiende el valor del tiempo. Del mío, sobre todo."], ["lucho", "Podés pagarle desde el registro de Historia cuando tengas la plata. No te olvides, eh."]] },
  trato_no: { lines: [["aurelio", "Una negativa elegante. Las puertas de Don Aurelio no se abren dos veces… bueno, a veces sí. Ya nos veremos."], ["lucho", "Bien hecho. Pero ahora hay que juntar la plata solos. Mi tío juntaba la del alquiler en una lata de galletitas."]] },
  deuda_ok: { appear: "aurelio", lines: [["aurelio", "Puntual como un reloj suizo. Usted y yo vamos a hacer grandes cosas. Bueno, sobre todo yo."]] },
  deuda_fail: { appear: "aurelio", lines: [["aurelio", "El plazo pasó y mis contadores lloran. Me cobré lo que me debía, más un pequeño recargo por mi tristeza."], ["lucho", "Nos sacó $7.800 del banco y ahora el barrio habla de nosotros. Mal momento para hacer trampa."]] },
  ahorro_ok: { lines: [["lucho", "¡$6.000 en el banco sin deberle nada a nadie! Mi tío se emocionó. Bueno, estornudó, pero creo que fue de emoción."]] },
  ahorro_fail: { lines: [["lucho", "No llegamos a juntarla, pero seguimos de pie y sin deudas raras. Eso también cuenta."]] },
  rango2_ok: { lines: [["lucho", "¡Encargado! Ahora podés contratar gente. Yo sigo siendo el primero, eh. Eso no se negocia."]] },
  personal: { lines: [["narr", "Acto II · Papeles en regla."], ["lucho", "Ya no damos abasto. Contratá a alguien: un técnico que arregle las máquinas o un guardia que espante a los ladrones. Está en Gestión → Personal."]] },
  funes_aviso: { lines: [["lucho", "Me llegó el rumor: mañana viene el inspector de Lotería, Funes. Dicen que tiene un sello para cada emoción."], ["lucho", "Si tenés máquinas en pago Trucha, este es buen momento para arrepentirse. Y el calor tiene que estar debajo de 30. Ni se te ocurra coimearlo."]] },
  funes_meet: { lines: [["narr", "Traje gris, carpeta gris, mirada gris. Hasta el paraguas parece tener reglamento."], ["funes", "Inspector Ernesto Funes, Lotería. Vengo a revisar sus máquinas. No se ofenda: reviso hasta el horóscopo antes de creerle."], ["funes", "Formulario 27-B. Si todo está en regla, me voy en tres horas. Si no, me quedo en sus pesadillas."]] },
  funes_ok: { appear: "funes", lines: [["funes", "Todo en regla. Le dejo un diploma. No se emocione: lo imprimo yo mismo."], ["lucho", "¡Un diploma! Lo cuelgo al lado de la caja fuerte. Que lo vea todo el mundo."]] },
  funes_fail: { appear: "funes", lines: [["funes", "Anotado. Y cuando yo anoto algo, queda anotado. En tinta. Indeleble."]] },
  valija: { appear: "aurelio", lines: [
    ["aurelio", "Mi querido amigo. Necesito un favorcito de nada: guardar esta valija en su caja fuerte unos días. No pregunte qué tiene. La curiosidad engorda."],
    ["aurelio", "Por las molestias, $4.000. Y mi eterna simpatía, que en este barrio cotiza alto."],
    ["lucho", "Manu, esa valija hace tic-tac. Bueno, no. Pero tiene cara de hacer tic-tac."]],
    choices: [{ key: "si", label: "Guardar la valija", sub: "+$4.000 y +20 de calor" }, { key: "no", label: "No guardo valijas ajenas", sub: "Don Aurelio se lo va a tomar mal" }],
    choose(k) {
      if (k === "si") { F.Economy.add("other", 4000); F.Heat.add(20, "story"); ST().flags.dirty++; decide("Guardaste la valija de Don Aurelio."); finish("ev_valija", "si"); startMission("m_valija"); return "valija_si"; }
      decide("Rechazaste la valija de Don Aurelio."); finish("ev_valija", "no");
      const ms = DBG.machines.filter(m => !m.d.broken); if (ms.length) F.breakMachine(ms[(Math.random() * ms.length) | 0]);
      F.Rep.change(-5); startMission("m_presion"); return "valija_no";
    } },
  valija_si: { lines: [["aurelio", "Sabía que podía contar con usted. La paso a buscar en unos días. No la abra. En serio. Hay cosas que no se pueden des-ver."]] },
  valija_no: { lines: [["aurelio", "Qué lástima. Las máquinas son tan delicadas… a veces se rompen solas, ¿no? Y la gente habla tanto…"], ["lucho", "Se rompió una máquina justo cuando se fue. Casualidad, seguro. Aguantemos con la frente alta."]] },
  valija_ok: { appear: "aurelio", lines: [["aurelio", "Valija devuelta, intacta. Usted es de confianza… Eso puede ser un elogio o una condena, según cómo siga la historia."]] },
  valija_fail: { appear: "funes", lines: [["funes", "Un llamado anónimo mencionó una valija. No encontré nada, pero la multa por «olor a sospecha» existe. Formulario 33. $3.000."]] },
  presion_ok: { lines: [["lucho", "¡Aguantamos! Don Aurelio mandó flores. Creo que es un elogio. O una amenaza con perfume."]] },
  cleo: { appear: "cleo", lines: [
    ["narr", "Acto III · La reina de enfrente. El neón azul de El Faraón brilla como si la luna le pagara comisión."],
    ["cleo", "Así que vos sos el de la Clásica tosiendo. Cleo Montenegro, dueña de El Faraón. «La reina», para los amigos. No tengo amigos."],
    ["cleo", "Disfrutá tus clientes mientras duren, querido. En mi casino hasta las alfombras tienen sangre azul."],
    ["lucho", "Qué simpática. Hay que ganarle en atractivo: decoración, buenas máquinas y buena fama. Y que vengan los high rollers."]] },
  atractivo_ok: { lines: [["lucho", "¡La gente cruza la calle para venir acá! Te mandé a hacer un neón que dice DORADO. Lo pagó mi tío. Bueno, lo pagué yo."]] },
  highroller_ok: { lines: [["narr", "Un high roller te deja su retrato autografiado: «Al mejor casino del barrio». Lo colgás en el fondo. Queda espantoso. Queda perfecto."]] },
  promo: { appear: "cleo", lines: () => [
    ["cleo", `Pasado mañana (día ${S().day + 2}) hago la promo más grande de la historia: fichas dobles y un camello en la puerta. Bueno, un señor disfrazado de camello.`],
    ["lucho", "Nos va a vaciar el salón. A menos que…"],
    ["aurelio", "A menos que alguien le arruine la fiesta. Mis muchachos pueden correr el rumor de que el camello muerde. $1.500 y la promo se cae."]],
    choices: [{ key: "sab", label: "Sabotear la promo", sub: "Pagás $1.500 (coima) y +15 de calor", can: () => S().bank >= 1500 || "Necesitás $1.500 en el banco" }, { key: "fair", label: "Competirle limpio", sub: "Ese día tenés que ganar $1.500 netos con menos clientes" }],
    choose(k) {
      const day = S().day + 2;
      if (k === "sab") { F.Economy.force("bribes", 1500); F.Heat.add(15, "story"); ST().flags.dirty++; decide("Saboteaste la promo de El Faraón con Don Aurelio."); finish("ev_promo", "sab"); startMission("m_sabotaje", { day }); return "promo_sab"; }
      decide("Le competiste limpio a la promo de El Faraón."); finish("ev_promo", "fair"); startMission("m_contrapromo", { day }); return "promo_fair";
    } },
  promo_sab: { lines: [["aurelio", "Considérelo hecho. Nadie se acerca a un camello con mala fama."], ["lucho", "No me gusta esto, Manu. Pero bueno… el camello tampoco me caía bien."]] },
  promo_fair: { lines: [["lucho", "¡Así me gusta! Ese día abrí todo, que funcionen todas las máquinas y que la gente se vaya contenta."], ["cleo", "¿Limpio? Qué tierno. Te mando una postal desde mi salón lleno."]] },
  sabotaje_ok: { lines: [["narr", "Nadie quiso acercarse al camello. Cleo gritó en tres idiomas y la promo fue un desierto. Literalmente."]] },
  contrapromo_ok: { appear: "cleo", lines: [["cleo", "¿Cómo hiciste plata con mi promo enfrente? No me contestes. No me interesa. Me interesa muchísimo."]] },
  contrapromo_fail: { lines: [["lucho", "Ese día la promo nos ganó. Igual dormimos tranquilos: no le debemos nada a nadie."]] },
  barra: { lines: [["narr", "Acto IV · Noche de gala."], ["lucho", "Gerente de sala, Manu. Ya podemos abrir una barra de verdad. Pedila en la compu, abrí la caja en su lugar y llevale tragos a la gente importante: 3 a mano."]] },
  especiales: { appear: "aurelio", lines: [
    ["aurelio", "Último favor, lo prometo por mi clavel. Tengo unas máquinas «especiales»… muy generosas con la casa, muy poco generosas con el cliente."],
    ["aurelio", "Le dejo $15.000 de adelanto y nadie se entera. Bueno, el inspector a veces se entera, pero es un hombre tan ocupado."],
    ["lucho", "Manu… esto ya no es una valija. Esto es una mudanza."]],
    choices: [{ key: "si", label: "Aceptar las máquinas", sub: "+$15.000 y +25 de calor" }, { key: "no", label: "Rechazarlas y avisarle a Funes", sub: "-20 de calor, pero Don Aurelio se ofende" }],
    choose(k) {
      if (k === "si") { F.Economy.add("other", 15000); F.Heat.add(25, "story"); ST().flags.dirty++; decide("Aceptaste las máquinas especiales de Don Aurelio."); finish("ev_especiales", "si"); return "especiales_si"; }
      F.Heat.add(-20, "story"); ST().flags.funesTrust = true; ST().flags.aurelioEnemy = true; decide("Rechazaste a Don Aurelio y le avisaste a Funes.");
      finish("ev_especiales", "no"); startMission("m_ladrones"); return "especiales_no";
    } },
  especiales_si: { lines: [["aurelio", "Usted y yo, socios. Qué lindo suena. Sobre todo para mí."]] },
  especiales_no: { appear: "funes", lines: [["funes", "Recibí su llamado. Formulario 51-C: «Ciudadano que colabora». Hacía once años que no lo usaba. Tenía polvo."], ["funes", "Su calor baja. El de Don Aurelio sube. Cuídese: los hombres de clavel no perdonan fácil."], ["lucho", "Ojo con los ladrones estos días. Seguro los manda él."]] },
  ladrones_ok: { lines: [["lucho", "Tres ladrones afuera. Don Aurelio mandó una nota: «Touché». Creo que se rindió. O fue a comprar un diccionario."]] },
  gala: { appear: "lucho", lines: () => [["lucho", `¡Director! Organicemos una Noche de Gala: el día ${S().day + 1} a la noche vienen VIP. Recibilos en la puerta y hacé $3.000 netos ese día.`], ["lucho", "Ponete lindo. Bueno, ponete como quieras, pero que el casino esté lindo."]] },
  gala_ok: { appear: "lucho", lines: [["lucho", "¡Qué noche! Los VIP te regalaron una Clásica de oro, igualita a la primera. Yo lloré. Mi tío lloró. La Clásica tosió."]] },
  libertad: { appear: "aurelio", lines: () => [
    ["narr", "Acto V · La última mano."],
    ["aurelio", "Socio, hice cuentas. Con todos los favores que le hice, usted me pertenece un poquito. Digamos… todo."],
    ["aurelio", `Pero soy un romántico. Por $40.000 antes del cierre del día ${dlDay("m_libertad")}, le devuelvo su libertad. Si no, el Dorado pasa a llamarse «Aurelio's». Con apóstrofe, que es más fino.`],
    ["lucho", "Manu, hay que juntar esa plata como sea. Se paga desde el registro de Historia."]] },
  libertad_ok: { appear: "aurelio", lines: [["aurelio", "Libre como un pájaro. Un pájaro que me debía mucho, pero libre. Fue un placer hacer negocios con usted."]] },
  final: { appear: "cleo", lines: () => [
    ...(ST().flags.dirty >= 2 ? [] : [["narr", "Acto V · La última mano."]]),
    ["cleo", "Bueno, bueno. El de la Clásica ya no tose: ruge. Te hago una oferta de reina a casi-rey."],
    ["cleo", "Si juntás la plata, El Faraón está en venta. Si no, intentá hundirme. Spoiler: no vas a poder."],
    ["lucho", "Manu, esta es la decisión grande. ¿Lo compramos o lo dejamos sin clientes?"]],
    choices: [{ key: "buy", label: "Comprar El Faraón", sub: `Necesitás el rango ${rankName(8)} y mucha plata` }, { key: "ruin", label: "Hundir a El Faraón", sub: "3 cierres seguidos con 1,6× su atractivo y reputación 70+" }],
    choose(k) {
      if (k === "buy") { decide("Decidiste comprar El Faraón."); finish("ev_final", "buy"); startMission("m_comprar"); return "final_buy"; }
      decide("Decidiste hundir a El Faraón."); finish("ev_final", "ruin"); startMission("m_hundir"); return "final_ruin";
    } },
  final_buy: { lines: [["cleo", "Una compradora de reinos… digo, un comprador. Te espero con la lapicera. Y con el precio inflado."]] },
  final_ruin: { lines: [["cleo", "¿Hundirme a mí? Mi casino tiene pirámides. Vos tenés una Clásica con tos."], ["lucho", "Más decoración, buena reputación y que la gente la pase bien. Ella no tiene a Lucho."]] },
  end_rey: { appear: "cleo", lines: () => [
    ["cleo", "Firmado. El Faraón es tuyo. Me voy a Montecarlo, donde aprecian mi talento y mis camellos."],
    ["lucho", "¡Manu! ¡Dorado II! Mi tío no lo va a creer. Yo tampoco lo creo."],
    ...(ST().flags.funesTrust ? [["funes", "Felicitaciones. Su expediente es el más aburrido de la ciudad. Es el mayor elogio que conozco."]] : []),
    ...(ST().flags.dirty ? [] : [["aurelio", "Brindo por usted desde lejos. Bien lejos. Con un clavel nuevo."]]),
    ["narr", "FINAL · El Rey de la noche. La calle es tuya y el neón también. La Clásica sigue tosiendo monedas, por las dudas."]] },
  end_funcion: { appear: "cleo", lines: [
    ["cleo", "Mi salón está vacío. Hasta el camello renunció. Tomá las llaves, querido: El Faraón cierra."],
    ["cleo", "Te dejo la esfinge de la entrada. Que te mire feo todas las noches."],
    ["lucho", "¡Ganamos sin comprar nada! La gente eligió nuestro casino. Eso no se paga con plata."],
    ["narr", "FINAL · La última función. Cleo te manda postales desde Mar del Plata. Todas dicen «Volveré». Ninguna tiene remitente."]] },
  end_malo: { appear: "aurelio", lines: [
    ["narr", "FINAL MALO · Aurelio's. El día amanece con un cartel nuevo en la puerta. Con apóstrofe."],
    ["aurelio", "No se ponga triste. Puede quedarse como encargado. Lucho le enseña dónde está la escoba."],
    ["lucho", "Lo siento, Manu. La próxima, menos favores y más Clásica."]],
    after() { const s = S(); if (!s.gameOver) { s.gameOver = "Final malo: no compraste tu libertad a tiempo y Don Aurelio se quedó con el casino."; s.today.notes.push("Historia · " + s.gameOver); if (!s.dayOver) DBG.endDay(); else F.save(true); } } },
  lucho_talk: { appear: "lucho", lines: () => {
    const st = ST(), act = Object.keys(st.active).map(id => MDEF[id]).filter(d => d && !d.event);
    if (st.ending) return [["lucho", `${ENDINGS[st.ending]}. ¡Qué historia, Manu! Igual el casino sigue: a trabajar.`]];
    if (!act.length) return [["lucho", "Por ahora no hay nada urgente. Seguí subiendo de rango y atendiendo bien a la gente: la historia sigue sola."]];
    return act.slice(0, 2).map(d => ["lucho", `${d.title}. ${d.desc}`]);
  }, choices: [{ key: "log", label: "Ver el registro de Historia" }, { key: "ok", label: "Gracias, Lucho" }], choose(k) { if (k === "log") pendingLog = true; return null; } },
};

// =====================================================================
// INTERFAZ DEL DIÁLOGO (overlay propio, el juego queda en pausa vía ui.panel = "dialog")
// =====================================================================
const css = document.createElement("style");
css.textContent = `
#storyDlg { position: fixed; inset: 0; z-index: 30; display: flex; align-items: flex-end; justify-content: center; background: linear-gradient(to top, rgba(4,10,8,.82), rgba(4,10,8,.2) 55%, rgba(4,10,8,0)); padding: 0 max(12px, env(safe-area-inset-right, 0px)) calc(14px + env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px)); }
#storyDlg .box { width: min(760px, 100%); display: grid; grid-template-columns: 112px 1fr; gap: 6px 14px; background: var(--felt); background-image: radial-gradient(ellipse at top, var(--felt-2), var(--felt) 70%); border: 1px solid var(--brass); box-shadow: 0 0 0 3px var(--night), 0 0 0 4px var(--brass-dim), 0 18px 50px rgba(0,0,0,.6); border-radius: 10px; padding: 14px; cursor: pointer; grid-template-areas: "pt who" "pt txt" "ch ch" "more more"; align-items: start; }
#storyDlg .pt { grid-area: pt; } #storyDlg .who { grid-area: who; } #storyDlg .txt { grid-area: txt; } #storyDlg .ch { grid-area: ch; } #storyDlg .more { grid-area: more; }
#storyDlg .box.narr { grid-template-columns: 1fr; grid-template-areas: "txt" "ch" "more"; }
#storyDlg .box.narr .pt, #storyDlg .box.narr .who { display: none; }
#storyDlg .pt canvas { width: 112px; height: 112px; border-radius: 8px; border: 1px solid var(--brass-dim); display: block; }
#storyDlg .who { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
#storyDlg .who b { font-family: var(--font-display); font-weight: 400; color: var(--brass); font-size: 1.35rem; letter-spacing: .02em; }
#storyDlg .who span { font-size: .78rem; color: var(--ivory-dim); letter-spacing: .08em; text-transform: uppercase; }
#storyDlg .txt { font-size: 1.08rem; line-height: 1.42; color: var(--ivory); min-height: 4.3em; }
#storyDlg .box.narr .txt { font-style: italic; color: #e9dcb8; text-align: center; min-height: 0; padding: 6px 4px; }
#storyDlg .more { justify-self: end; font-size: .8rem; color: var(--brass); letter-spacing: .1em; text-transform: uppercase; animation: sblink 1s steps(2) infinite; }
#storyDlg .ch { display: grid; gap: 8px; }
#storyDlg .ch button { text-align: left; display: grid; gap: 1px; padding: .6em .9em; }
#storyDlg .ch button small { font-weight: 500; font-size: .84rem; opacity: .8; }
#storyDlg .ch button.ghost small { color: var(--ivory-dim); }
@keyframes sblink { 50% { opacity: .25; } }
#hStory { all: unset; box-sizing: border-box; cursor: pointer; display: block; font-family: var(--font-ui); font-size: .84rem; line-height: 1.25; color: var(--ivory); border-left: 2px solid var(--brass); padding: 2px 0 2px 8px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
#hStory b { color: var(--brass); font-weight: 700; }
#hStory .p { color: var(--ivory-dim); font-family: var(--font-num); font-size: .76rem; }
.sportrait { width: 56px; height: 56px; border-radius: 6px; border: 1px solid var(--brass-dim); float: left; margin-right: 10px; }
.scast { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; }
.scast .stat { overflow: hidden; }
@media (max-width: 560px) {
  #storyDlg .box { grid-template-columns: 70px 1fr; padding: 11px; gap: 6px 10px; grid-template-areas: "pt who" "txt txt" "ch ch" "more more"; }
  #storyDlg .who { align-self: center; flex-direction: column; gap: 0; }
  #storyDlg .pt canvas { width: 70px; height: 70px; }
  #storyDlg .who b { font-size: 1.12rem; }
  #storyDlg .txt { font-size: .98rem; min-height: 5.6em; }
  #hStory { font-size: .76rem; }
}
@media (prefers-reduced-motion: reduce) { #storyDlg .more { animation: none; } }`;
document.head.appendChild(css);

const dlgEl = document.createElement("div");
dlgEl.id = "storyDlg"; dlgEl.hidden = true; dlgEl.setAttribute("role", "dialog"); dlgEl.setAttribute("aria-modal", "true");
dlgEl.innerHTML = `<div class="box"><div class="pt"><canvas width="128" height="128"></canvas></div><div class="who"><b></b><span></span></div><div class="txt" aria-live="polite"></div><div class="ch"></div><div class="more">Tocá para seguir ▸</div></div>`;
document.body.appendChild(dlgEl);
const boxEl = dlgEl.querySelector(".box"), ptCv = dlgEl.querySelector("canvas"), nameEl = dlgEl.querySelector(".who b"), roleEl = dlgEl.querySelector(".who span"),
  txtEl = dlgEl.querySelector(".txt"), chEl = dlgEl.querySelector(".ch"), moreEl = dlgEl.querySelector(".more");
if (!isTouch) moreEl.textContent = "Espacio / clic para seguir ▸";

const dq = []; // cola de diálogos: { id, mission }
let cur = null, pendingLog = false, readyAt = 0, appeared = [];
function queue(id, mission) { if (!dialogs[id]) return; if (cur && cur.id === id) return; if (dq.some(q => q.id === id)) return; dq.push({ id, mission }); }
function canShow() {
  const s = S(), ui = F.ui;
  return s && !ui.panel && !ui.blocking() && !window.CasinoBuild?.active && !s.dayOver && performance.now() > readyAt;
}
function openDialog(q) {
  const def = dialogs[q.id];
  const lines = typeof def.lines === "function" ? def.lines() : def.lines;
  cur = { id: q.id, mission: q.mission, def, lines, i: 0, shown: 0, done: false, t: 0 };
  if (dlgEl.hidden) {
    F.ui.panel = "dialog"; F.releasePointer();
    document.getElementById("prompt").hidden = true; document.getElementById("hold").hidden = true;
    dlgEl.hidden = false;
  }
  if (def.appear) {
    if (def.appear === "funes" && DBG.inspector) { /* el inspector ya está en el salón */ }
    else { bringNpc(def.appear); if (!appeared.includes(def.appear)) appeared.push(def.appear); }
  }
  showLine();
}
function showLine() {
  const [who, text] = cur.lines[cur.i], c = CHARS[who] || CHARS.narr;
  if (who !== "narr") ST().met[who] = 1;
  boxEl.classList.toggle("narr", who === "narr");
  nameEl.textContent = c.name; roleEl.textContent = c.role;
  cur.who = who; cur.text = text; cur.shown = 0; cur.done = false; cur.t = 0;
  txtEl.textContent = ""; chEl.innerHTML = ""; moreEl.hidden = true;
  if (who !== "narr") drawPortrait(ptCv, who, false, false);
}
function finishTyping() {
  cur.shown = cur.text.length; cur.done = true; txtEl.textContent = cur.text;
  if (cur.who !== "narr") drawPortrait(ptCv, cur.who, false, false);
  const last = cur.i >= cur.lines.length - 1;
  if (last && cur.def.choices) {
    chEl.innerHTML = cur.def.choices.map((c, i) => {
      const can = c.can ? c.can() : true;
      return `<button data-k="${c.key}" class="${i ? "ghost" : ""}" ${can === true ? "" : "disabled"}>${isTouch ? "" : `${i + 1}. `}${esc(c.label)}${c.sub || can !== true ? `<small>${esc(can === true ? c.sub : can)}</small>` : ""}</button>`;
    }).join("");
    moreEl.hidden = true;
  } else moreEl.hidden = false;
}
function advance() {
  if (!cur) return;
  if (!cur.done) { finishTyping(); return; }
  if (cur.i < cur.lines.length - 1) { cur.i++; showLine(); return; }
  if (cur.def.choices) return; // hay que elegir
  endDialog(null);
}
function choose(key) {
  if (!cur || !cur.done || !cur.def.choices) return;
  const c = cur.def.choices.find(x => x.key === key); if (!c || (c.can && c.can() !== true)) return;
  const next = cur.def.choose ? cur.def.choose(key) : null;
  F.save(true); F.updateHud(true);
  endDialog(next);
}
function endDialog(nextId) {
  const was = cur; cur = null;
  if (was.mission && ST().active[was.mission]) {
    ST().active[was.mission].seen = true;
    if (MDEF[was.mission].event && !was.def.choices) finish(was.mission, "visto");
  }
  if (was.id.startsWith("end_")) ST().endingSeen = true;
  if (was.def.after) was.def.after();
  if (nextId && dialogs[nextId]) { openDialog({ id: nextId }); return; }
  if (dq.length && !S().gameOver && !S().dayOver) { openDialog(dq.shift()); return; }
  dlgEl.hidden = true;
  for (const w of appeared) dismissNpc(w);
  appeared = [];
  F.save(true);
  if (F.ui.panel === "dialog") F.closePanel(true, true);
  if (pendingLog) { pendingLog = false; openLog(); }
}
boxEl.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (b) { if (!b.disabled) choose(b.dataset.k); return; }
  advance();
});
window.addEventListener("keydown", e => {
  if (cur && !dlgEl.hidden) {
    if (["Space", "Enter", "KeyE", "NumpadEnter"].includes(e.code)) { e.preventDefault(); if (!e.repeat) advance(); }
    else if (/^Digit[1-4]$/.test(e.code) && cur.done && cur.def.choices) { const c = cur.def.choices[+e.code.slice(5) - 1]; if (c) choose(c.key); }
    return;
  }
  if (e.code === "KeyH" && !e.repeat && S()) {
    if (F.ui.panel === "storylog") F.closePanel(false, true);
    else if (!F.ui.blocking()) openLog();
  }
});

// =====================================================================
// REGISTRO DE HISTORIA (menú) Y LÍNEA DEL HUD
// =====================================================================
function missionCard(id) {
  const def = MDEF[id], m = ST().active[id];
  const prog = def.prog ? def.prog(m) : "";
  const payBtn = def.pay && !m.data.paid ? `<div class="btns"><button data-act="storyPay" data-id="${id}" ${S().bank < payOf(def) ? "disabled" : ""}>Pagar ${fmt(payOf(def))}${payOf(def) < def.pay ? ` <small>(respeto: antes ${fmt(def.pay)})</small>` : ""}</button></div>` : "";
  const r = def.reward || {}, rw = [r.cash && fmt(r.cash), r.xp && `${r.xp} XP`, r.rep && `+${r.rep} reputación`, r.trophy && TROPHIES[r.trophy].name].filter(Boolean).join(" · ");
  return `<div class="item"><span class="sw" style="background:${CHARS[def.who].color}"></span><div class="t"><b>${esc(def.title)}</b><span>${esc(def.desc)}${prog ? ` <b class="num" style="display:inline;font-size:.86rem">${esc(prog)}</b>` : ""}${rw ? `<br>Recompensa: ${esc(rw)}` : ""}</span></div>${payBtn}</div>`;
}
function openLog() {
  if (!ensure()) return;
  const st = ST();
  const act = Object.keys(st.active).filter(id => !MDEF[id].event);
  const pend = Object.keys(st.active).filter(id => MDEF[id].event);
  const doneL = M.filter(d => st.done[d.id] && !d.event && st.done[d.id] !== "skip").map(d => `<li>${st.done[d.id] === "ok" ? "✓" : "✗"} ${esc(d.title)}</li>`).join("");
  const cast = Object.keys(CHARS).filter(k => k !== "narr" && st.met[k]).map(k => `<div class="stat"><canvas class="sportrait" width="112" height="112" data-who="${k}"></canvas><b style="font-family:var(--font-ui);font-size:1rem">${CHARS[k].name}</b><span>${esc(CHARS[k].bio)}</span></div>`).join("");
  const waiting = !act.length && !pend.length && !st.ending ? `<div class="note">${esc(waitingText())}</div>` : "";
  F.openPanel("storylog", `<h2>Historia</h2>
    <p>${st.ending ? `<b>${ENDINGS[st.ending]}</b>` : `<b>Acto ${st.act} · ${ACTS[st.act]}</b>`}. Las misiones de la historia van aparte de los objetivos diarios.${st.flags.dirty ? ` Favores turbios aceptados: <b class="num">${st.flags.dirty}</b>.` : ""}</p>
    ${pend.length ? `<div class="note">Alguien quiere hablar con vos: ${pend.map(id => esc(MDEF[id].title)).join(", ")}. Cerrá este panel.</div>` : ""}
    ${act.length ? `<h3>Misiones activas</h3><div class="list">${act.map(missionCard).join("")}</div>` : ""}${waiting}
    ${st.decisions.length ? `<h3>Tus decisiones</h3><ul class="unlocks">${st.decisions.map(d => `<li>${esc(d)}</li>`).join("")}</ul>` : ""}
    ${st.trophies.length ? `<h3>Trofeos</h3><p>${st.trophies.map(t => `${TROPHIES[t].name} (+${TROPHIES[t].atr} atractivo)`).join(" · ")}</p>` : ""}
    ${doneL ? `<h3>Terminadas</h3><ul class="unlocks">${doneL}</ul>` : ""}
    ${cast ? `<h3>Personajes</h3><div class="scast">${cast}</div>` : ""}
    <div class="actions"><button class="ghost" data-act="close">Cerrar</button></div>`);
  for (const cv of document.querySelectorAll("#panelBody canvas.sportrait")) drawPortrait(cv, cv.dataset.who, false, false);
}
function waitingText() {
  const s = S();
  if (s.rank < 3 && done("ev_valija")) return `Seguí creciendo: el próximo capítulo llega con el rango ${rankName(3)}.`;
  if (done("m_rango3") && !done("ev_cleo")) return `El Faraón abre enfrente el día ${D.RIVAL.opensDay}. Ahí empieza el Acto III.`;
  if (done("m_barra") && !done("m_vip") && s.rank < 5) return `La Noche de gala necesita el rango ${rankName(5)} (para que vengan VIP).`;
  return "Seguí atendiendo el casino: la historia sigue sola.";
}
document.getElementById("panelBody").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b || b.disabled) return;
  if (b.dataset.act === "storyPay") { pay(b.dataset.id); openLog(); }
  else if (b.dataset.act === "storyLog") openLog();
});
// botón "Historia" en el menú de pausa (se agrega cuando el juego lo dibuja)
new MutationObserver(() => {
  if (F.ui.panel !== "pause") return;
  const acts = document.querySelector("#panelBody .actions");
  if (acts && !acts.querySelector('[data-act="storyLog"]') && !acts.querySelector('[data-act="newgame"]')) acts.insertAdjacentHTML("afterbegin", `<button class="ghost" data-act="storyLog">Historia</button>`);
}).observe(document.getElementById("panelBody"), { childList: true });
// botón arriba a la derecha
const topBtn = document.createElement("button");
topBtn.className = "ghost"; topBtn.id = "storyBtn"; topBtn.textContent = "Historia";
const topRight = document.getElementById("topRight"); topRight.insertBefore(topBtn, document.getElementById("menuBtn"));
topBtn.addEventListener("click", () => { if (!F.ui.blocking()) openLog(); });
// línea del HUD (visible también con el HUD compacto)
const hudLine = document.createElement("button");
hudLine.id = "hStory"; hudLine.type = "button"; hudLine.title = "Historia (H)";
const xpRow = document.querySelector("#hud .meter.xp"); xpRow.insertAdjacentElement("afterend", hudLine);
hudLine.addEventListener("click", () => { if (!F.ui.blocking()) openLog(); });
let lastHud = "";
function updateHudLine() {
  const st = ST(); let html;
  if (st.ending) html = `<b>Historia</b> · ${esc(ENDINGS[st.ending])}`;
  else {
    const ids = Object.keys(st.active).filter(id => !MDEF[id].event);
    ids.sort((a, b) => (MDEF[b].pay || MDEF[b].fail ? 1 : 0) - (MDEF[a].pay || MDEF[a].fail ? 1 : 0));
    const id = ids[0];
    if (id) { const d = MDEF[id], p = d.prog ? d.prog(st.active[id]) : ""; html = `<b>◆</b> ${esc(d.title)}${p ? ` <span class="p">${esc(p)}</span>` : ""}${ids.length > 1 ? ` <span class="p">+${ids.length - 1}</span>` : ""}`; }
    else { const ev = Object.keys(st.active).find(i => MDEF[i].event); html = ev ? `<b>◆</b> ${esc(MDEF[ev].desc)}` : `<b>Historia</b> · <span class="p">${esc(waitingText())}</span>`; }
  }
  if (html !== lastHud) { lastHud = html; hudLine.innerHTML = html; }
}

// =====================================================================
// DIRECTOR: sondeo del estado, eventos de mundo (inspección, VIP, ladrones, promo)
// =====================================================================
let lastInsp = null;
function resetRuntime() {
  dq.length = 0;
  for (const who of Object.keys(npcs)) removeNpc(who);
  syncTrophies();
  spawnNpc("lucho", LUCHO_HOME.x, LUCHO_HOME.z).group.rotation.y = 0;
  lastInsp = null;
  readyAt = performance.now() + 1200;
  const st = ST();
  for (const id in st.active) if (!st.active[id].seen && MDEF[id].intro) queue(MDEF[id].intro, id);
  if (st.ending && !st.endingSeen) queue("end_" + st.ending);
  if (dlgEl && !dlgEl.hidden) { cur = null; dlgEl.hidden = true; if (F.ui.panel === "dialog") F.closePanel(true); }
}
function worldEvents() {
  const s = S(), st = ST(), h = hourNow(), open = DBG.isOpen;
  // inspección: primera vez que aparece Funes + misión de la inspección sorpresa
  const insp = DBG.inspector;
  if (insp && !st.met.funes) { st.met.funes = 1; queue("funes_meet"); }
  const fm = st.active.m_funes;
  if (fm && fm.seen) {
    if (insp && !fm.data.watch) fm.data.watch = true;
    if (!insp && !fm.data.watch && open && s.day > fm.day && h >= 11) { F.startInspection("visita sorpresa del Inspector Funes"); fm.data.watch = !!DBG.inspector; }
    const info = insp ? { fines: insp.fines, bribed: insp.bribed } : lastInsp;
    if (fm.data.watch && !fm.data.result && info && (!insp || insp.state === "leave")) {
      fm.data.result = (!info.fines && !info.bribed && s.heat < 30) ? "ok" : "fail";
    }
  }
  lastInsp = insp ? { fines: insp.fines, bribed: insp.bribed } : null;
  // promo de El Faraón manejada por la historia
  const cp = st.active.m_contrapromo, sb = st.active.m_sabotaje;
  if (cp && s.day === cp.data.day && !s.today.promo && F.rivalOpen()) { s.today.promo = true; F.toast(`Hoy es la promo del camello de ${D.RIVAL.name}: menos clientes. Ganá $1.500 netos igual.`, "bad"); }
  if (sb && s.day === sb.data.day && s.today.promo) { s.today.promo = false; F.toast("La promo de El Faraón se cayó: nadie se acerca al camello.", "good"); }
  // noche de gala: llegan VIP a la noche
  const vm = st.active.m_vip;
  if (vm && vm.seen) {
    if (!vm.data.day) vm.data.day = vm.day + 1;
    if (s.day > vm.data.day) { vm.data.day = s.day; F.toast("Lucho reprogramó la Noche de gala para hoy.", ""); }
    if (open && s.day === vm.data.day && [18, 19, 20].includes(h) && !(vm.data.sp || []).includes(s.day * 100 + h)) {
      (vm.data.sp || (vm.data.sp = [])).push(s.day * 100 + h); DBG.spawn("vip");
    }
  }
  // ladrones de Don Aurelio
  const lm = st.active.m_ladrones;
  if (lm && lm.seen && open && [12, 15, 18, 20].includes(h) && !(lm.data.sp || []).includes(s.day * 100 + h)) {
    (lm.data.sp || (lm.data.sp = [])).push(s.day * 100 + h); DBG.spawn("casual", true);
  }
  // final A: compraste El Faraón
  if (!st.ending && s.rivalBought && s.victory && F.ui.panel !== "victory") setEnding("rey");
}
let acc = 0, prev = performance.now(), blinkT = 0;
function loop(now) {
  const dt = Math.min(0.1, Math.max(0, (now - prev) / 1000)); prev = now;
  try {
    if (ensure() && !window.CasinoChallenge?.storyOff?.()) { // Sandbox: sin historia
      updateNpcs(dt);
      acc += dt;
      if (acc >= 0.25) {
        acc = 0;
        const s = S();
        if (!s.dayOver && !s.gameOver && F.ui.panel !== "dialog") { worldEvents(); evaluate(); }
        if (!cur && dq.length && canShow()) openDialog(dq.shift());
        updateHudLine();
      }
      if (cur && !cur.done) {
        cur.t += dt; const n = Math.min(cur.text.length, Math.floor(cur.t * 48));
        if (n !== cur.shown) { cur.shown = n; txtEl.textContent = cur.text.slice(0, n); }
        if (cur.who !== "narr") { blinkT += dt; if (blinkT > 0.09) { blinkT = 0; drawPortrait(ptCv, cur.who, (n >> 1) % 2 === 0 && n < cur.text.length, false); } }
        if (n >= cur.text.length) finishTyping();
      }
    }
  } catch (e) { console.error(e); }
  requestAnimationFrame(loop);
}

window.CasinoStory = {
  atr: trophyAtr, onEndDay,
  // world.js: los favores de Don Aurelio usan los mismos diálogos y retratos
  say(id, def) { if (!ensure()) return false; dialogs[id] = def; queue(id); return true; },
  define(id, def) { dialogs[id] = def; },
  get busy() { return !!cur || dq.length > 0; },
  get flags() { return ensure() ? ST().flags : null; },
  decide: t => { if (ensure()) decide(t); },
  aurelioBusy: () => ensure() && Object.keys(ST().active).some(id => MDEF[id] && MDEF[id].who === "aurelio"),
  met: who => ensure() && !!ST().met[who],
  get ending() { return ensure() ? ST().ending : null; },
  debug: {
    get story() { return ST(); },
    get dialog() { return cur ? { id: cur.id, line: cur.i, of: cur.lines.length, who: cur.who, choices: cur.def.choices ? cur.def.choices.map(c => c.key) : null, done: cur.done } : null; },
    get queue() { return dq.map(q => q.id); },
    advance, choose, openLog, pay, npcs,
    // salta los diálogos hasta una decisión (o hasta cerrar todos)
    skip() { let n = 0; while (cur && n++ < 200) { if (!cur.done) finishTyping(); else if (cur.i < cur.lines.length - 1 || !cur.def.choices) advance(); else break; } return this.dialog; },
    tick() { if (S().dayOver || S().gameOver) return; worldEvents(); evaluate(); if (!cur && dq.length && canShow()) openDialog(dq.shift()); updateHudLine(); },
    start: startMission, finish, setEnding, missions: MDEF,
    complete(id) { if (ST().active[id]) finish(id, "ok"); },
    force() { readyAt = 0; },
  },
};
requestAnimationFrame(loop);
})();
