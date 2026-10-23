/* Casino Dorado · daily.js — VOLVER CADA DÍA (v2)
 *  - Premio del día: la primera vez que entrás cada día (fecha de tu compu) cobrás plata y experiencia.
 *    Si venís días seguidos la racha sube y el premio crece hasta el día 7; si te salteás un día, vuelve a empezar.
 *  - Mientras no estabas: si tenés personal y estuviste afuera más de una hora, tu gente juntó algo de plata
 *    (una parte de lo que ganaste el último día, por hora, con tope de 8 horas).
 * Usa window.CasinoDailyBridge (game.js). Toda la plata pasa por Economy; los números están en data.js (DAILY).
 */
(() => {
"use strict";
const G = window.CasinoDailyBridge;
const C = window.CASINO_DATA && window.CASINO_DATA.DAILY;
if (!G || !C) return;
const S = () => G.S;
const fmt = n => G.fmt(n);
const int = (v, d, lo, hi) => { v = Math.floor(Number(v)); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------- fechas (día local de la compu)
let fakeNow = null; // solo para pruebas
const now = () => fakeNow != null ? fakeNow : Date.now();
function dayKey(t) { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function dayNum(k) { const [y, m, d] = k.split("-").map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); }

// ---------------------------------------------------------------- estado guardado en S.daily
function st() {
  const s = S(); if (!s) return null;
  let d = s.daily;
  if (!d || typeof d !== "object" || Array.isArray(d)) d = s.daily = { last: null, streak: 0, best: 0, seen: 0, lastNet: 0, claims: 0 };
  if (typeof d.last !== "string" || !DAY_RE.test(d.last)) d.last = null;
  d.streak = int(d.streak, 0, 0, 1e5); d.best = Math.max(int(d.best, 0, 0, 1e5), d.streak);
  d.seen = int(d.seen, 0, 0, 1e14); d.lastNet = int(d.lastNet, 0, 0, 1e9); d.claims = int(d.claims, 0, 0, 1e6);
  return d;
}
const staffCount = () => { const s = S(); let n = 0; for (const k in s.staff || {}) n += int(s.staff[k], 0, 0, 99); return n; };
const off = () => { const s = S(); return !s || s.gameOver || (G.D.MODES && G.D.MODES[s.mode] && G.D.MODES[s.mode].sandbox); };

function rewardFor(streak) {
  const i = Math.min(streak, C.rewards.length) - 1, s = S();
  const cash = C.rewards[i] * (1 + C.rankMul * Math.max(0, (s.rank || 1) - 1));
  return { cash: Math.round(cash / C.roundTo) * C.roundTo, xp: C.xp[Math.min(i, C.xp.length - 1)] };
}

// ---------------------------------------------------------------- qué toca hoy
let awayChecked = false, sinceStart = 0, celebrate = false;
function check() {
  const d = st(), today = dayKey(now());
  const out = { day: null, away: null, tip: false };
  if (!d.last && S().day === 1 && !(S().totals && S().totals.days)) { // partida nueva: hoy ya cuenta, el premio llega mañana
    d.last = today; d.streak = 1; d.best = Math.max(d.best, 1);
  } else {
    const gap = d.last ? dayNum(today) - dayNum(d.last) : null;
    if (gap == null || gap >= 1) {
      const broke = gap != null && gap > 1 && d.streak > 1 ? d.streak : 0;
      d.streak = gap === 1 ? d.streak + 1 : 1; d.best = Math.max(d.best, d.streak); d.last = today;
      out.day = Object.assign({ streak: d.streak, broke }, rewardFor(d.streak));
    }
  }
  if (!awayChecked) {
    awayChecked = true;
    const h = d.seen ? (now() - d.seen) / 36e5 : 0;
    if (h >= C.away.minHours) {
      if (staffCount() > 0 && d.lastNet > 0) {
        const hours = Math.min(h, C.away.maxHours), cash = Math.round(hours * d.lastNet * C.away.perHourShare / C.roundTo) * C.roundTo;
        if (cash > 0) out.away = { cash, hours, staff: staffCount() };
      } else if (staffCount() === 0) out.tip = true;
    }
  }
  d.seen = now();
  return out.day || out.away ? out : null;
}

// ---------------------------------------------------------------- panel
function track(streak) {
  const on = Math.min(streak, C.rewards.length);
  let h = "";
  for (let i = 1; i <= C.rewards.length; i++) {
    const cls = i < on ? "done" : i === on ? "now" : "";
    h += `<div class="dl-d ${cls}"><small>Día ${i}</small><b class="num">${fmt(rewardFor(i).cash)}</b>${i === C.rewards.length ? "<i>★</i>" : ""}</div>`;
  }
  return `<div class="dl-track">${h}</div>`;
}
function show(p) {
  const d = st(); let html = "", total = 0;
  if (p.day) {
    G.Economy.add("daily", p.day.cash); G.Rank.add(p.day.xp, true); total += p.day.cash; d.claims++;
    const head = p.day.streak > 1 ? `¡${p.day.streak} días seguidos!` : "Premio del día";
    const nextLine = p.day.streak < C.rewards.length ? `Volvé mañana y cobrás <b>${fmt(rewardFor(p.day.streak + 1).cash)}</b>.` : "Estás en el premio más alto: no cortes la racha.";
    html += `<h2>${head}</h2>
      ${p.day.broke ? `<p>Se cortó tu racha de ${p.day.broke} días. Arrancás de nuevo, pero el premio vuelve a crecer día a día.</p>` : ""}
      ${track(p.day.streak)}
      <p>Cobraste <b class="num">${fmt(p.day.cash)}</b> y <b>${p.day.xp} de experiencia</b>. ${nextLine}</p>`;
  }
  if (p.away) {
    G.Economy.add("away", p.away.cash); total += p.away.cash;
    const hrs = Math.floor(p.away.hours), min = Math.round((p.away.hours - hrs) * 60);
    html += `${p.day ? "<h3>Mientras no estabas</h3>" : "<h2>Mientras no estabas</h2>"}
      <p>Estuviste afuera ${[hrs ? `${hrs} h` : "", min ? `${min} min` : ""].filter(Boolean).join(" ")}${p.away.hours >= C.away.maxHours ? " (se cuenta hasta " + C.away.maxHours + " h)" : ""}.
      Tu personal (${p.away.staff}) siguió atendiendo y juntó <b class="num">${fmt(p.away.cash)}</b>. Ya está en el banco.</p>`;
  } else if (p.tip) html += `<p>Si contratás personal, la próxima vez que vuelvas te espera lo que juntaron mientras no estabas.</p>`;
  html += `<div class="actions"><button data-act="dailyOk">¡A cobrar! (+${fmt(total)})</button></div>`;
  G.openPanel("daily", html);
  G.updateHud(true); G.save(true);
  celebrate = true;
}
document.getElementById("panelBody").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b || b.disabled || b.dataset.act !== "dailyOk") return;
  G.closePanel(false, true);
});

// ---------------------------------------------------------------- reloj: se fija cada medio segundo (también si pasás la medianoche jugando)
const TICK = 0.5;
setInterval(() => {
  const s = S();
  if (!G.started || !s) { sinceStart = 0; return; }
  if (celebrate && G.ui.panel !== "daily") { // al cerrar el cartel: monedas y caja registradora
    celebrate = false; G.SFX.cash();
    const p = G.player; window.CasinoJuice?.emit?.(p.x - Math.sin(p.yaw) * 2, 2.4, p.z - Math.cos(p.yaw) * 2, 40, { spread: 1.5 });
  }
  sinceStart += TICK;
  if (off()) return;
  const d = st();
  // se revisa recién cuando el cartel se puede mostrar, así el premio se marca y se paga en el mismo momento
  if (sinceStart >= C.delaySec && !G.ui.blocking() && !s.dayOver && (dayKey(now()) !== d.last || !awayChecked)) { const p = check(); if (p) show(p); }
  else if (sinceStart % 20 < TICK) d.seen = now(); // se guarda con la partida (cada hora del juego, al comprar y al cerrar)
}, TICK * 1000);

// en cada cierre se anota cuánto ganó el casino ese día (sin contar estos premios) para calcular lo de "mientras no estabas"
function onEndDay() {
  const d = st(), T = S().today; if (!d || !T) return;
  const inc = T.inc || {}, net = (T.st && T.st.net) || 0;
  d.lastNet = Math.max(0, Math.round(net - (inc.daily || 0) - (inc.away || 0)));
}
function reset() { awayChecked = false; celebrate = false; sinceStart = 0; }

window.CasinoDaily = {
  onEndDay, reset,
  debug: { set now(t) { fakeNow = t; }, get now() { return now(); }, get state() { return st(); }, dayKey, rewardFor, check },
};
})();
