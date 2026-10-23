/* Casino Dorado v3 · minigames.js — minijuegos a mano (estilo Schedule I: primero lo hacés vos, después lo automatiza el personal).
 * 1) Blackjack: vos sos el croupier (repartir, revelar, pedir/plantarse la banca, pagar o cobrar cada asiento).
 * 2) Ruleta: "No va más", lanzar la bola con buena fuerza (ruleta 3D de art.js) y pagar a los ganadores.
 * 3) Reparación de tragamonedas: repuesto correcto, cables y calibración.
 * Requiere game.js (window.CasinoMGBridge). Los croupiers contratados siguen resolviendo solos como antes.
 * Las reglas puras (cartas, IA de clientes, pagos) viven en RULES y no tocan el DOM.
 */
(() => {
"use strict";
const root = typeof window !== "undefined" ? window : globalThis;

// =====================================================================
// AJUSTES (balance de los minijuegos)
// =====================================================================
const MG_CFG = {
  decks: 6, reshuffleAt: 60,      // zapato de 6 mazos; se mezcla de nuevo con menos de 60 cartas
  dealSec: 0.16, aiSec: 0.5,      // ritmo del reparto y de las decisiones de los clientes
  parSec: 1.5,                    // segundos "justos" por acción tuya (para propinas por velocidad)
  slowMul: 2.5,                   // más lento que par × esto = clientes impacientes
  afkSec: 45,                     // ronda abandonada: se levantan todos
  bjTip: 0.08,                    // propina por asiento bien pagado (× apuesta × velocidad)
  rlTip: 0.045,                   // ruleta
  xpPerSeat: 1, xpPerfect: 2,     // XP por pago correcto y por ronda perfecta
  repPerfect: 0.15, repMistake: -0.6, repUnderpay: -1.0, repOverpay: -0.3, repSlowPerSeat: -0.25,
  rlZone: [0.55, 0.85], rlWeak: 0.25, rlStrong: 0.95, rlPeriod: 1.5, // medidor de fuerza de la bola
  repairWrongPart: 0.25,          // un repuesto equivocado te cuesta 25% del repuesto
  repairGreat: 6, repairGood: 9, repairXpGreat: 4, repairXpGood: 2, repairZone: 0.18, repairPeriod: 1.3,
};

// =====================================================================
// REGLAS PURAS
// =====================================================================
const SUITS = ["♠", "♥", "♦", "♣"]; // ♠ ♥ ♦ ♣
const RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const RULES = {
  newShoe(decks, rand) {
    rand = rand || Math.random;
    const s = [];
    for (let d = 0; d < decks; d++) for (let su = 0; su < 4; su++) for (let r = 1; r <= 13; r++) s.push({ r, s: su });
    for (let i = s.length - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; const t = s[i]; s[i] = s[j]; s[j] = t; }
    return s;
  },
  cardVal: c => c.r === 1 ? 11 : Math.min(10, c.r),
  total(cards) {
    let t = 0, aces = 0;
    for (const c of cards) { t += RULES.cardVal(c); if (c.r === 1) aces++; }
    while (t > 21 && aces) { t -= 10; aces--; }
    return { total: t, soft: aces > 0 };
  },
  isBJ: cards => cards.length === 2 && RULES.total(cards).total === 21,
  // decisión de un cliente según su tipo: "hit" | "stand" | "double"
  ai(type, cards, up, canDouble, rand) {
    rand = rand || Math.random;
    const { total, soft } = RULES.total(cards), u = RULES.cardVal(up);
    if (total >= 21) return "stand";
    if (type === "casual") {
      if (total < 12) return "hit";
      if (total <= 14) return rand() < 0.6 ? "hit" : "stand";
      if (total <= 16) return rand() < 0.25 ? "hit" : "stand";
      return "stand";
    }
    const pro = type === "highroller" || type === "vip";
    if (pro && canDouble && cards.length === 2) {
      if (!soft && total === 11) return "double";
      if (!soft && total === 10 && u <= 9) return "double";
      if (!soft && total === 9 && u >= 3 && u <= 6) return "double";
      if (soft && total >= 13 && total <= 18 && u >= 5 && u <= 6) return "double";
    }
    if (soft) { if (total <= 17) return "hit"; if (total === 18 && u >= 9) return "hit"; return "stand"; }
    if (total <= 11) return "hit";
    if (total === 12) return u >= 4 && u <= 6 ? "stand" : "hit";
    if (total <= 16) return u >= 7 ? "hit" : "stand";
    return "stand";
  },
  dealerMustHit: cards => RULES.total(cards).total < 17, // pide hasta 16, se planta con 17 (también 17 blando)
  // qué corresponde con cada asiento: "collect" | "push" | "pay" | "bj"
  outcome(cards, dealer) {
    const p = RULES.total(cards).total, d = RULES.total(dealer).total, pbj = RULES.isBJ(cards), dbj = RULES.isBJ(dealer);
    if (p > 21) return "collect";
    if (pbj && dbj) return "push";
    if (pbj) return "bj";
    if (dbj) return "collect";
    if (d > 21 || p > d) return "pay";
    if (p === d) return "push";
    return "collect";
  },
  // lo que gana la casa con esa decisión (negativo = paga)
  bjDelta(choice, bet) { return choice === "collect" ? bet : choice === "push" ? 0 : choice === "pay" ? -bet : choice === "bj" ? -Math.round(bet * 1.5) : 0; },
  // ruleta ------------------------------------------------------------
  color: n => n === 0 ? "verde" : REDS.has(n) ? "rojo" : "negro",
  rlPick(type, rand) {
    rand = rand || Math.random;
    const w = { casual: [45, 30, 20, 5], regular: [35, 20, 30, 15], highroller: [30, 0, 35, 35], vip: [25, 0, 30, 45] }[type] || [45, 30, 20, 5];
    let r = rand() * (w[0] + w[1] + w[2] + w[3]);
    if ((r -= w[0]) < 0) return { kind: "color", v: rand() < 0.5 ? "rojo" : "negro" };
    if ((r -= w[1]) < 0) return { kind: "parity", v: rand() < 0.5 ? "par" : "impar" };
    if ((r -= w[2]) < 0) return { kind: "dozen", v: 1 + ((rand() * 3) | 0) };
    return { kind: "number", v: (rand() * 37) | 0 };
  },
  rlLabel(b) { return b.kind === "color" ? (b.v === "rojo" ? "Rojo" : "Negro") : b.kind === "parity" ? (b.v === "par" ? "Par" : "Impar") : b.kind === "dozen" ? ["", "1.ª docena (1-12)", "2.ª docena (13-24)", "3.ª docena (25-36)"][b.v] : "Pleno al " + b.v; },
  // pago correcto: "lose" | "1" | "2" | "35"
  rlOutcome(b, n) {
    if (b.kind === "number") return n === b.v ? "35" : "lose";
    if (n === 0) return "lose";
    if (b.kind === "color") return RULES.color(n) === b.v ? "1" : "lose";
    if (b.kind === "parity") return (n % 2 === 0 ? "par" : "impar") === b.v ? "1" : "lose";
    if (b.kind === "dozen") return Math.ceil(n / 12) === b.v ? "2" : "lose";
    return "lose";
  },
  rlDelta(choice, bet) { return choice === "lose" ? bet : -bet * (+choice || 0); },
};
root.CasinoMGRules = RULES; root.CasinoMGConfig = MG_CFG;

const B = root.CasinoMGBridge;
if (!B || typeof document === "undefined") return;
const D = B.D, CFG = D.CFG, ST = () => B.S;
const fmt = B.fmt, KEY = B.KEY, isTouch = B.isTouch;
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);
const $ = id => document.getElementById(id);

// =====================================================================
// ESTILOS Y DOM (una hoja inferior: la mesa 3D queda visible arriba)
// =====================================================================
const style = document.createElement("style");
style.textContent = `
.mg{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(8px + env(safe-area-inset-bottom,0px));width:min(620px,calc(100vw - 16px));max-height:62vh;overflow-y:auto;background:rgba(15,43,34,.96);border:1px solid var(--brass);border-radius:10px;box-shadow:0 0 0 3px var(--night),0 18px 40px rgba(0,0,0,.6);padding:10px 12px 12px;display:grid;gap:8px;touch-action:manipulation}
.mg-head{display:flex;align-items:center;gap:6px 10px;flex-wrap:wrap}
.mg-head b{font-family:var(--font-display);font-weight:400;color:var(--brass);font-size:1.25rem;line-height:1.1}
.mg-sub{flex:1 1 150px;color:var(--ivory-dim);font-size:.86rem;line-height:1.25}
.mg-head button{flex:none}
.mg-bar{height:5px;background:#22362d;border-radius:3px;overflow:hidden}
.mg-bar i{display:block;height:100%;width:100%;background:var(--mint)}
.mg-bar i.warn{background:var(--heat)}
.mg-cards{display:flex;min-height:44px;align-items:center}
.mgc{width:30px;height:42px;border-radius:4px;background:#f6f0e0;color:#15171a;border:1px solid #8a7a5a;font:600 13px/1 var(--font-num);display:grid;align-content:center;justify-items:center;gap:1px;box-shadow:0 1px 3px rgba(0,0,0,.5);flex:none}
.mgc+.mgc{margin-left:-11px}
.mgc i{font-style:normal;font-size:15px;line-height:1}
.mgc.r{color:#c4262e}
.mgc.back{background:repeating-linear-gradient(45deg,#7a1f2b 0 4px,#5a1420 4px 8px);border-color:var(--brass)}
.mgc.new{animation:mgIn .22s ease-out}
@keyframes mgIn{from{transform:translateY(-12px);opacity:0}}
.mg-dealer{display:flex;align-items:center;gap:10px}
.mg-lbl{font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--brass);min-width:50px}
.mg-tot{font-family:var(--font-num);font-size:1.05rem}
.mg-seats{display:grid;grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:6px}
.mg-seat{background:rgba(7,20,15,.5);border:1px solid #23493b;border-radius:6px;padding:5px 6px;display:grid;gap:3px;min-width:0}
.mg-seat.cur,.mg-row.cur{border-color:var(--brass);box-shadow:0 0 0 1px var(--brass)}
.mg-seat.ok,.mg-row.ok{border-color:var(--mint)}
.mg-seat.bad,.mg-row.bad{border-color:var(--chip)}
.mg-seat.gone,.mg-row.gone{opacity:.45}
.mg-sn{font-size:.74rem;color:var(--ivory-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mg-bet{font-family:var(--font-num);font-size:.85rem;color:var(--brass)}
.mg-st{font-size:.8rem;min-height:1.1em;line-height:1.15}
.mg-empty{color:var(--ivory-dim);font-size:.92rem;padding:6px 0}
.mg-msg{min-height:1.2em;font-size:.92rem;color:var(--ivory);line-height:1.3}
.mg-msg.bad{color:#ff8a7a}.mg-msg.good{color:var(--mint)}
.mg-acts{display:flex;gap:6px;flex-wrap:wrap}
.mg-acts button{flex:1 1 120px;min-height:46px;line-height:1.15}
.mg-acts button.alt{background:#23493b;color:var(--ivory)}
.mg-acts kbd{font-family:var(--font-num);font-size:.72rem;opacity:.65;margin-right:5px}
.mg-rows{display:grid;gap:4px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}
.mg-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:1px 8px;background:rgba(7,20,15,.5);border:1px solid #23493b;border-radius:6px;padding:4px 8px;font-size:.88rem}
.mg-row .a{color:var(--ivory-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mg-row .n{font-family:var(--font-num);color:var(--brass);text-align:right}
.mg-row .s{text-align:right;font-size:.8rem}
.mg-res{font-family:var(--font-num);font-size:1.25rem;font-weight:600;padding:3px 12px;border-radius:6px;justify-self:start;color:var(--ivory);background:#15171a;border:1px solid var(--brass-dim)}
.mg-res.rojo{background:#b8282c}.mg-res.verde{background:#1d8a4e}
.mg-meter{position:relative;height:30px;background:linear-gradient(90deg,rgba(212,66,63,.5) 0 25%,#22362d 25% 95%,rgba(212,66,63,.5) 95%);border-radius:6px;overflow:hidden;border:1px solid #2c4a3d}
.mg-meter .zone{position:absolute;top:0;bottom:0;background:rgba(111,211,155,.5)}
.mg-meter .needle{position:absolute;top:0;bottom:0;width:4px;margin-left:-2px;background:var(--ivory);box-shadow:0 0 6px #000}
.mg-meter span{position:absolute;inset:0;display:grid;place-items:center;font-size:.75rem;color:var(--ivory-dim);letter-spacing:.1em;text-transform:uppercase;pointer-events:none}
.mg-wires{display:flex;gap:10px;justify-content:center}
.mg-wire{width:76px;height:76px;padding:0;background:#0b1712;border:2px solid var(--brass-dim);display:grid;place-items:center;flex:none}
.mg-wire.on{border-color:var(--mint)}
.mg-wire svg{transition:transform .14s ease-out}
.mg-q{font-size:1rem;color:var(--ivory)}
.mg-steps{font-family:var(--font-num);font-size:.8rem;color:var(--ivory-dim)}
@media (max-width:560px){body.mg-on #toasts{top:calc(118px + env(safe-area-inset-top,0px));bottom:auto}.mg{max-height:60vh;padding:8px 9px 10px;gap:6px}.mg-acts button{flex-basis:40%;font-size:.95rem;padding:.45em .5em}.mg-head b{font-size:1.1rem}}
@media (prefers-reduced-motion:reduce){.mgc.new{animation:none}.mg-wire svg{transition:none}}
`;
document.head.appendChild(style);

const el = document.createElement("div");
el.id = "mg"; el.className = "mg"; el.hidden = true; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Minijuego");
el.innerHTML = `<div class="mg-head"><b id="mgTitle"></b><span class="mg-sub" id="mgSub"></span><button class="ghost sm" data-mg="leave" id="mgLeave">Dejar la mesa</button></div>
<div class="mg-bar"><i id="mgBar"></i></div><div id="mgBody"></div><div class="mg-msg" id="mgMsg" aria-live="polite"></div><div class="mg-acts" id="mgActs"></div>`;
{ const tEl = $("toasts"); if (tEl && tEl.parentNode) tEl.parentNode.insertBefore(el, tEl); else document.body.appendChild(el); } // los avisos quedan por encima

// =====================================================================
// NÚCLEO: abrir / cerrar una sesión de minijuego
// =====================================================================
const MG = { active: null, prevSpeed: 1, openedAt: 0 };
// otras mesas con minijuego propio (poker.js) se enganchan con CasinoMG.register(tipo, ext)
//  ext: { kind, open(s), update(s, dt, seated), view(s) → {title, sub, body, acts}, act(s, a, v), leave(s) }
const EXT = {}, EXTK = {};
function msg(text, kind) { const m = $("mgMsg"); m.textContent = text || ""; m.className = "mg-msg" + (kind ? " " + kind : ""); }
function openSession(s) {
  if (MG.active) return false;
  MG.active = s; B.ui.mg = s.kind;
  MG.prevSpeed = ST().speed || 1; B.setSpeed(1);  // mientras trabajás con las manos, el reloj va a x1
  B.releasePointer(); B.useUp && B.useUp();
  el.hidden = false; el.className = "mg mg-" + s.kind; MG.openedAt = performance.now(); document.body.classList.add("mg-on");
  const tch = $("touch"); if (tch) tch.style.visibility = "hidden";
  $("cross").hidden = true; $("prompt").hidden = true;
  $("mgLeave").textContent = s.kind === "rp" ? "Cancelar" : "Dejar la mesa";
  msg(""); render(); return true;
}
function closeSession(text, kind) {
  const s = MG.active; if (!s) return;
  MG.active = null; B.ui.mg = null; el.hidden = true; document.body.classList.remove("mg-on");
  const tch = $("touch"); if (tch) tch.style.visibility = "";
  $("cross").hidden = false;
  if (ST() && !ST().dayOver) B.setSpeed(MG.prevSpeed);
  if (s.t) stepOffPad(s.t);
  if (text) B.toast(text, kind);
  B.requestPointer();
}
// al dejar la mesa te corrés un paso para atrás (así no vuelve a abrirse sola)
function stepOffPad(t) {
  const P = B.player; let dx = P.x - t.center.x, dz = P.z - t.center.z; const l = Math.hypot(dx, dz) || 1;
  P.x += dx / l * 1.0; P.z += dz / l * 1.0;
}
function render() {
  const s = MG.active; if (!s) return;
  const r = EXTK[s.kind] ? EXTK[s.kind].view(s) : s.kind === "bj" ? bjView(s) : s.kind === "rl" ? rlView(s) : rpView(s);
  $("mgTitle").textContent = r.title; $("mgSub").textContent = r.sub || "";
  $("mgBody").innerHTML = r.body; $("mgActs").innerHTML = r.acts || "";
  for (const c of s.fresh || []) c.fresh = false; s.fresh = [];
}
const kb = i => isTouch ? "" : `<kbd>${i}</kbd>`;
const btn = (act, v, label, cls, i, dis) => `<button class="${cls || ""}" data-mg="${act}" data-v="${v == null ? "" : esc(v)}" ${dis ? "disabled" : ""}>${i != null ? kb(i) : ""}${label}</button>`;

el.addEventListener("click", e => {
  const b = e.target.closest("button[data-mg]"); if (!b || b.disabled || !MG.active) return;
  if (performance.now() - MG.openedAt < 400) return; // el mismo toque que abrió el minijuego no aprieta un botón (clic fantasma)
  act(b.dataset.mg, b.dataset.v);
});
// teclado: Espacio/Enter/E = acción principal, 1-4 = opciones (hasta 9 si hay más botones, como en el showdown del póker) (no cambian la velocidad mientras jugás)
window.addEventListener("keydown", e => {
  if (!MG.active || B.ui.panel) return;
  const primary = e.code === "Space" || e.code === "Enter" || e.code === "KeyE";
  const num = /^Digit[1-9]$/.test(e.code) ? +e.code.slice(5) : 0;
  if (!primary && !num) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (e.repeat) return;
  const btns = [...document.querySelectorAll("#mgActs button[data-mg]:not(:disabled), #mgBody button[data-mg]:not(:disabled)")];
  const b = primary ? (btns.find(x => x.classList.contains("pri")) || (btns.length === 1 ? btns[0] : null)) : btns[num - 1];
  if (b) b.click();
}, true);

function act(a, v) {
  const s = MG.active; if (!s) return;
  if (a === "leave") { leave(s); return; }
  if (EXTK[s.kind]) EXTK[s.kind].act(s, a, v); else if (s.kind === "bj") bjAct(s, a, v); else if (s.kind === "rl") rlAct(s, a, v); else rpAct(s, a, v);
}
function leave(s) {
  if (s.kind === "rp") { closeSession("Dejaste la reparación para después.", ""); return; }
  if (EXTK[s.kind] && EXTK[s.kind].leave) { EXTK[s.kind].leave(s); return; }
  for (const h of s.hands || []) if (!h.settled && live(s, h) && s.phase !== "bets" && s.phase !== "wait") h.c.flags.waited = true;
  closeSession(s.phase === "bets" || s.phase === "wait" || s.phase === "summary" ? "Dejaste la mesa. Los jugadores esperan un rato y se levantan." : "Dejaste la mano por la mitad: la ronda no cuenta y los jugadores se molestan.", s.phase === "bets" || s.phase === "wait" || s.phase === "summary" ? "" : "bad");
}

// vigilancia en cada cuadro: la mesa desapareció, llegó el croupier, cerró el casino, terminó el día
function frame(now) {
  const s = MG.active;
  if (s) {
    const S = ST();
    if (!S || S.dayOver || S.gameOver) closeSession();
    else if (s.t && (s.t.dead || s.t.staff)) closeSession(s.t.staff ? "Llegó el croupier contratado: él sigue con la mesa." : "", "good");
    else if (s.t && !B.isOpen) closeSession("El casino cerró: se terminó la mesa por hoy.", "");
    else if (s.m && (s.m.dead || !s.m.d.broken)) closeSession(s.m.dead ? "" : "La máquina ya está arreglada.", "good");
    else if (s.kind === "rp") rpFrame(s, now);
    else if (EXTK[s.kind] && EXTK[s.kind].frame) EXTK[s.kind].frame(s, now); // minijuegos sin mesa (caja registradora, shop.js)
    else bar(s);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
function setBar(f, warn) { const b = $("mgBar"); b.style.width = (clamp(f, 0, 1) * 100).toFixed(1) + "%"; b.classList.toggle("warn", !!warn); }

// =====================================================================
// MESAS (blackjack y ruleta) — enganche desde updateTables
// =====================================================================
const handles = t => !!t && (t.d.type === "blackjack" || t.d.type === "ruleta" || !!EXT[t.d.type]);
function tableTick(t, seated, dt) {
  if (!handles(t)) return false;
  const s = MG.active;
  if (!s) { if (!B.ui.panel && B.isOpen) openTable(t); return true; }
  if (s.t === t) (EXTK[s.kind] ? EXTK[s.kind].update : s.kind === "bj" ? bjUpdate : rlUpdate)(s, dt, seated);
  return true;
}
function openTable(t) {
  if (MG.active || t.staff || t.dead) return false;
  const P = B.player;
  // en la ruleta mirás el plato (x local -0.95); en el blackjack, el paño
  const lx = t.d.type === "ruleta" ? -0.95 : 0, rot = t.spot.rot;
  const fx = t.d.type === "ruleta" ? t.spot.x + Math.cos(rot) * lx : t.center.x, fz = t.d.type === "ruleta" ? t.spot.z - Math.sin(rot) * lx : t.center.z;
  P.yaw = Math.atan2(-(fx - P.x), -(fz - P.z)); P.pitch = t.d.type === "ruleta" ? -0.9 : -0.6;
  const x = EXT[t.d.type];
  const s = { kind: x ? x.kind : t.d.type === "blackjack" ? "bj" : "rl", t, phase: "wait", hands: [], dealer: [], hole: true, q: [], timer: 0, round: t.mgRound || 0,
    patience: CFG.patienceSec, ptime: 0, actions: 0, mistakes: 0, fresh: [] };
  if (s.kind === "bj" && (!t.mgShoe || t.mgShoe.length < MG_CFG.reshuffleAt)) t.mgShoe = RULES.newShoe(MG_CFG.decks);
  if (x && x.open) x.open(s);
  openSession(s);
  if (x) { if (x.hint) B.hint("mg" + x.kind, x.hint); }
  else if (s.kind === "bj") B.hint("mgBj", "Sos el croupier: repartí, revelá tu carta tapada, pedí hasta 16 y plantate con 17, y pagá o cobrá cada asiento. Rápido y sin errores = propinas y XP.");
  else B.hint("mgRl", "Sos el croupier: cantá \"No va más\", lanzá la bola con la fuerza en la zona verde y pagá a cada ganador lo que corresponde.");
  return true;
}
const live = (s, h) => !!(h.c && !h.c.dead && h.c.state === "play" && h.c.table === s.t);
function seatNo(t, c) { return t.seats.findIndex(x => x.c === c) + 1; }
function placeBet(t, c) {
  const def = t.def, lo = Math.max(def.minBet, c.betMin), hi = Math.min(def.maxBet, c.betMax, c.budget);
  if (hi < lo || c.rounds <= 0) return 0;
  return Math.round(rnd(lo, hi) / 5) * 5 || lo;
}
function addBettors(s, seated) {
  for (const se of seated) {
    if (s.hands.some(h => h.c === se.c)) continue;
    const bet = placeBet(s.t, se.c);
    if (!bet) { B.leaveCustomer(se.c); continue; }
    const h = { c: se.c, n: seatNo(s.t, se.c), bet, bet0: bet, cards: [], st: "", done: false, settled: null };
    if (s.kind === "rl") {
      h.b = RULES.rlPick(se.c.type.id);
      if (h.b.kind === "number") h.bet = h.bet0 = clamp(Math.round(bet / 4 / 5) * 5, s.t.def.minBet, Math.max(s.t.def.minBet, Math.round(s.t.def.maxBet * 0.1)));
    }
    s.hands.push(h);
  }
  s.hands.sort((a, b) => a.n - b.n);
}
function startBets(s, seated) {
  s.hands = []; s.dealer = []; s.hole = true; s.q = []; s.result = null; s.ptime = 0; s.actions = 0; s.mistakes = 0; s.clean = false;
  addBettors(s, seated);
  if (!s.hands.length) { s.phase = "wait"; render(); return; }
  s.phase = "bets"; s.patience = CFG.patienceSec; render();
}
// fases en común: espera, apuestas, demora del jugador
function commonUpdate(s, dt, seated) {
  if (s.phase === "wait") { if (seated.length) startBets(s, seated); return true; }
  if (s.phase === "bets") {
    const n = s.hands.length;
    s.hands = s.hands.filter(h => live(s, h)); addBettors(s, seated);
    if (!s.hands.length) { s.phase = "wait"; render(); return true; }
    if (s.hands.length !== n) render();
    s.patience -= dt;
    if (s.patience <= 0) {
      for (const h of s.hands) { h.c.flags.waited = true; B.leaveCustomer(h.c); }
      msg("Tardaste demasiado: los jugadores se cansaron de esperar y se fueron.", "bad"); B.SFX.bad();
      s.phase = "wait"; s.hands = []; render();
    }
    return true;
  }
  if (s.phase === "summary") { s.timer -= dt; if (s.timer <= 0) { s.phase = "wait"; msg(""); startBets(s, seated); } return true; }
  if (s.input) {
    s.ptime += dt;
    if (s.ptime > MG_CFG.afkSec) {
      for (const h of s.hands) if (live(s, h)) { h.c.flags.waited = true; B.leaveCustomer(h.c); }
      msg("Dejaste la ronda colgada: los jugadores se levantaron.", "bad"); B.Rep.change(-1); B.SFX.bad();
      s.phase = "wait"; s.input = false; s.hands = []; render();
      return true;
    }
  }
  return false;
}
function bar(s) {
  if (s.phase === "bets") setBar(s.patience / CFG.patienceSec, s.patience < CFG.patienceSec * 0.4);
  else if (s.input) { const lim = Math.max(1, s.expect) * MG_CFG.parSec * MG_CFG.slowMul; setBar(1 - s.ptime / lim, s.ptime > lim * 0.6); }
  else if (s.phase === "wait") setBar(0);
  if (s.kind === "rl" && s.phase === "power") rlNeedle(s);
}
function mistake(s, text) { s.mistakes++; B.Rep.change(MG_CFG.repMistake); B.SFX.bad(); msg(text, "bad"); }
// pagar o cobrar un asiento con la decisión del jugador
function settle(s, h, choice, correct) {
  const delta = s.kind === "bj" ? RULES.bjDelta(choice, h.bet) : RULES.rlDelta(choice, h.bet);
  const good = s.kind === "bj" ? RULES.bjDelta(correct, h.bet) : RULES.rlDelta(correct, h.bet);
  const c = h.c, t = s.t, st = ST().today.st;
  c.budget -= delta; t.d.tray += delta; st.tablesNet += delta; B.addNet();
  c.played = true; c.rounds--;
  if (delta < 0) { c.flags.won = true; if (c.person && Math.random() < 0.4) c.person.api.cheer(1); }
  h.settled = choice; h.ok = choice === correct; s.actions++;
  if (h.ok) { if (delta < 0) B.SFX.coin(); else B.SFX.tick(); msg(""); }
  else if (delta > good) { h.angry = true; c.flags.waited = true; B.Rep.change(MG_CFG.repUnderpay); B.SFX.bad(); msg(`Al asiento ${h.n} le correspondían ${fmt(-good)} y no se los pagaste: se va enojado.`, "bad"); }
  else { B.Rep.change(MG_CFG.repOverpay); B.SFX.bad(); msg(`Al asiento ${h.n} le pagaste de más: la casa pierde ${fmt(good - delta)}.`, "bad"); }
  if (Math.abs(delta) && B.near(t.center.x, t.center.z, 14)) B.floatText(t.center.x, 1.6, t.center.z, (delta > 0 ? "Casa +" : "Casa ") + fmt(delta), delta > 0 ? "#6fd39b" : "#ff6a5a");
}
function nextUnsettled(s) { return s.hands.find(h => !h.settled && !h.gone && live(s, h) && !h.skip) || null; }
function finishRound(s, extraXp) {
  const S = ST(), done = s.hands.filter(h => h.settled);
  const ok = done.filter(h => h.ok), wrong = done.length - ok.length;
  const par = Math.max(1, s.actions) * MG_CFG.parSec, sf = clamp(par / Math.max(0.1, s.ptime), 0.25, 1), slow = s.ptime > par * MG_CFG.slowMul;
  let tips = 0; for (const h of ok) tips += Math.round(h.bet0 * (s.kind === "bj" ? MG_CFG.bjTip : MG_CFG.rlTip) * sf);
  if (slow) { tips = 0; B.Rep.change(MG_CFG.repSlowPerSeat * done.length); }
  const perfect = !slow && !wrong && !s.mistakes && ok.length > 0;
  if (perfect) { B.Rep.change(MG_CFG.repPerfect); window.CasinoChallenge?.ev?.("perfect", s.kind); } // logros (challenge.js)
  const xp = ok.length * MG_CFG.xpPerSeat + (perfect ? MG_CFG.xpPerfect : 0) + (extraXp || 0);
  if (tips > 0) { const room = B.Pocket.room(), inPocket = Math.min(tips, room); S.pocket += inPocket; if (tips > inPocket) s.t.d.tray += tips - inPocket; B.SFX.cash(); }
  if (done.length) S.today.st.handsByHand++;
  if (xp > 0) B.Rank.add(xp);
  B.checkObjectives(); B.updateHud(true);
  const def = s.t.def;
  for (const h of s.hands) if (live(s, h) && (h.angry || h.c.rounds <= 0 || h.c.budget < Math.max(def.minBet, h.c.betMin))) B.leaveCustomer(h.c);
  s.t.mgRound = s.round;
  s.summary = { tips, xp, perfect, slow, wrong, mistakes: s.mistakes, sec: s.ptime };
  if (!done.length) msg("Ronda sin jugadores.", "");
  else msg((perfect ? "¡Ronda perfecta! " : slow ? "Muy lento: los jugadores se impacientaron. " : wrong || s.mistakes ? `Ronda con ${wrong + s.mistakes} error${wrong + s.mistakes > 1 ? "es" : ""}. ` : "Ronda bien. ")
    + (tips ? `Propinas ${fmt(tips)} al bolsillo · ` : "") + `+${xp} XP · ${s.ptime.toFixed(1)} s`, perfect ? "good" : slow || wrong || s.mistakes ? "bad" : "");
  s.phase = "summary"; s.timer = 1.9; s.input = false; render();
}

// =====================================================================
// BLACKJACK
// =====================================================================
function bjDraw(s, to) {
  const t = s.t; if (!t.mgShoe.length) t.mgShoe = RULES.newShoe(MG_CFG.decks);
  const c = t.mgShoe.pop(); c.fresh = true; s.fresh.push(c); to.push(c); return c;
}
const tot = cards => RULES.total(cards).total;
function bjUpdate(s, dt, seated) {
  if (commonUpdate(s, dt, seated)) return;
  for (const h of s.hands) if (!h.gone && !live(s, h)) { h.gone = true; render(); }
  if (s.phase === "deal") {
    s.timer -= dt;
    while (s.timer <= 0 && s.q.length) {
      const who = s.q.shift();
      if (who === "d") bjDraw(s, s.dealer); else if (!who.gone) bjDraw(s, who.cards);
      s.timer += MG_CFG.dealSec; B.SFX.tick(); render();
    }
    if (!s.q.length && s.timer <= 0) { s.phase = "players"; s.timer = MG_CFG.aiSec * 0.6; render(); }
  } else if (s.phase === "players") {
    s.timer -= dt; if (s.timer > 0) return;
    s.timer = MG_CFG.aiSec;
    const h = s.hands.find(x => !x.done && !x.gone);
    if (!h) { s.phase = "reveal"; s.input = true; s.expect = s.hands.length + 3; render(); return; }
    if (RULES.isBJ(h.cards)) { h.st = "¡Blackjack!"; h.done = true; render(); return; }
    const a = RULES.ai(h.c.type.id, h.cards, s.dealer[0], h.c.budget >= h.bet * 2);
    if (a === "stand") { h.st = "Se planta"; h.done = true; }
    else { bjDraw(s, h.cards); if (a === "double") { h.bet *= 2; h.st = "Dobla"; h.done = true; } else h.st = "Pide carta"; }
    if (tot(h.cards) > 21) { h.st = "Se pasó"; h.done = true; }
    else if (tot(h.cards) === 21 && !h.done) { h.st = "21"; h.done = true; }
    B.SFX.tick(); render();
  }
}
function bjToPay(s, text, kind) {
  s.phase = "pay"; if (text) msg(text, kind);
  if (!nextUnsettled(s)) finishRound(s); else render();
}
function bjAct(s, a, v) {
  if (a === "deal" && s.phase === "bets") {
    s.round++; s.actions = 1; s.ptime = 0; s.dealer = []; s.hole = true;
    for (const h of s.hands) { h.cards = []; h.st = ""; h.done = false; h.settled = null; h.ok = false; h.gone = false; }
    s.q = []; for (let k = 0; k < 2; k++) { for (const h of s.hands) s.q.push(h); s.q.push("d"); }
    s.phase = "deal"; s.timer = 0; msg(""); render(); return;
  }
  if (a === "reveal" && s.phase === "reveal") {
    s.hole = false; s.actions++; s.fresh.push(s.dealer[1]); s.dealer[1].fresh = true;
    const alive = s.hands.filter(h => !h.gone && live(s, h) && tot(h.cards) <= 21);
    if (RULES.isBJ(s.dealer)) { B.SFX.bad(); bjToPay(s, "¡Blackjack de la banca! Cobrá a todos menos a quien también tenga blackjack.", ""); return; }
    if (!alive.length) { bjToPay(s, "Todos se pasaron: la banca no necesita pedir. Cobrá.", ""); return; }
    s.phase = "dealer"; msg(""); render(); return;
  }
  if (s.phase === "dealer" && (a === "hit" || a === "stand")) {
    const t0 = tot(s.dealer), must = RULES.dealerMustHit(s.dealer);
    if (a === "hit") {
      if (!must) { mistake(s, `Con ${t0} la banca se planta: pide solo con 16 o menos.`); return; }
      bjDraw(s, s.dealer); s.actions++; B.SFX.tick();
      const t1 = tot(s.dealer);
      if (t1 > 21) { bjToPay(s, `La banca se pasó con ${t1}: pagá a los que siguen en juego.`, "good"); return; }
      msg(""); render(); return;
    }
    if (must) { mistake(s, `Con ${t0} la banca tiene que pedir carta (pide hasta 16).`); return; }
    s.actions++; bjToPay(s, "", ""); return;
  }
  if (a === "pay" && s.phase === "pay") {
    const h = nextUnsettled(s); if (!h) { finishRound(s); return; }
    settle(s, h, v, RULES.outcome(h.cards, s.dealer));
    render();
    if (!nextUnsettled(s)) finishRound(s);
  }
}
const cardHtml = (c, hidden) => hidden ? `<span class="mgc back${c.fresh ? " new" : ""}"></span>` : `<span class="mgc${c.s === 1 || c.s === 2 ? " r" : ""}${c.fresh ? " new" : ""}">${RULES_RANK(c)}<i>${SUITS[c.s]}︎</i></span>`;
function RULES_RANK(c) { return RANKS[c.r]; }
const PHASE_SUB = {
  wait: "Esperando que se sienten jugadores…", bets: "Apuestas hechas. Repartí cuando quieras: la paciencia baja.",
  deal: "Repartiendo…", players: "Los jugadores deciden…", reveal: "Revelá tu carta tapada.",
  dealer: "La banca pide con 16 o menos y se planta con 17.", pay: "Pagá o cobrá cada asiento.", summary: "Fin de la ronda.",
};
function bjView(s) {
  const d = s.dealer, dTot = !d.length ? "" : s.hole ? (d[0] ? RULES.cardVal(d[0]) + " + ?" : "") : tot(d) + (tot(d) > 21 ? " · se pasó" : "");
  const cur = s.phase === "pay" ? nextUnsettled(s) : null;
  const seats = s.hands.map(h => {
    const t = h.cards.length ? tot(h.cards) : "", res = h.settled ? (h.ok ? "✓ " : "✗ ") + { collect: "Cobrado", push: "Empate", pay: "Pagado 1:1", bj: "Pagado 3:2" }[h.settled] : "";
    const cls = (h === cur ? " cur" : "") + (h.settled ? (h.ok ? " ok" : " bad") : "") + (h.gone ? " gone" : "");
    return `<div class="mg-seat${cls}"><div class="mg-sn">${h.n} · ${esc(h.c.type.name)}</div><div class="mg-bet">${fmt(h.bet)}</div>
      <div class="mg-cards">${h.cards.map(c => cardHtml(c)).join("")}</div><div class="mg-st">${h.gone ? "Se levantó" : res || (t !== "" ? `<b>${t}</b> ${esc(h.st)}` : "")}</div></div>`;
  }).join("");
  const body = `<div class="mg-dealer"><span class="mg-lbl">Banca</span><div class="mg-cards">${d.map((c, i) => cardHtml(c, i === 1 && s.hole)).join("")}</div><span class="mg-tot">${dTot}</span></div>
    ${seats ? `<div class="mg-seats">${seats}</div>` : `<div class="mg-empty">No hay nadie sentado. Cuando llegue un cliente, aparece acá.</div>`}`;
  let acts = "";
  switch (s.phase) {
    case "wait": acts = btn("deal", "", "Repartir", "pri", null, true); break;
    case "bets": acts = btn("deal", "", "Repartir", "pri", "Espacio"); break;
    case "deal": case "players": acts = btn("x", "", "Juegan los clientes…", "", null, true); break;
    case "reveal": acts = btn("reveal", "", "Revelar la carta tapada", "pri", "Espacio"); break;
    case "dealer": acts = btn("hit", "", `Pedir carta (banca ${tot(d)})`, "", 1) + btn("stand", "", "Plantarse", "alt", 2); break;
    case "pay": if (cur) { const b = cur.bet; acts = btn("pay", "collect", `Cobrar ${fmt(b)}`, "alt", 1) + btn("pay", "push", "Empate", "alt", 2) + btn("pay", "pay", `Pagar ${fmt(b)} (1:1)`, "", 3) + btn("pay", "bj", `Pagar ${fmt(Math.round(b * 1.5))} (3:2)`, "", 4); } break;
    case "summary": acts = btn("x", "", "Siguiente ronda…", "", null, true); break;
  }
  const sub = s.phase === "pay" && cur ? `Asiento ${cur.n}: ${tot(cur.cards)}${RULES.isBJ(cur.cards) ? " (blackjack)" : ""} contra banca ${tot(d)}.` : PHASE_SUB[s.phase];
  return { title: `Blackjack${s.round ? " · ronda " + s.round : ""}`, sub, body, acts };
}

// =====================================================================
// RULETA
// =====================================================================
function rlUpdate(s, dt, seated) {
  if (commonUpdate(s, dt, seated)) return;
  for (const h of s.hands) if (!h.gone && !live(s, h)) { h.gone = true; render(); }
  if (s.phase === "power") s.pwT += dt;
  else if (s.phase === "spin") {
    s.timer -= dt;
    if (s.result == null && s.timer <= 0) s.result = (Math.random() * 37) | 0; // por si la ruleta 3D no avisa
    if (s.result != null) { s.phase = "pay"; s.input = true; B.SFX.coin(); msg(""); if (!nextUnsettled(s)) finishRound(s, s.clean ? 1 : 0); else render(); }
  }
}
function rlPower(s) { const p = (s.pwT / MG_CFG.rlPeriod) % 2; return p < 1 ? p : 2 - p; }
function rlNeedle(s) { const n = $("mgPw"); if (n) n.style.left = (rlPower(s) * 100).toFixed(1) + "%"; }
function rlAct(s, a, v) {
  if (a === "nomore" && s.phase === "bets") {
    s.round++; s.actions = 1; s.ptime = 0; s.phase = "power"; s.pwT = 0; s.input = true; s.expect = s.hands.length + 2;
    for (const h of s.hands) { h.settled = null; h.ok = false; h.gone = false; }
    msg("No va más. Lanzá la bola cuando la aguja esté en la zona verde.", ""); B.SFX.tick(); render(); return;
  }
  if (a === "throw" && s.phase === "power") {
    const p = rlPower(s);
    if (p < MG_CFG.rlWeak) { mistake(s, "Tirada floja: la bola no dio las vueltas reglamentarias. Repetí."); return; }
    if (p > MG_CFG.rlStrong) { mistake(s, "¡Muy fuerte! La bola saltó fuera del plato. Repetí."); return; }
    s.actions++; s.clean = p >= MG_CFG.rlZone[0] && p <= MG_CFG.rlZone[1];
    msg(s.clean ? "Lanzamiento limpio. La bola gira…" : "Tirada válida, pero poco pareja. La bola gira…", s.clean ? "good" : "");
    s.phase = "spin"; s.input = false; s.result = null; s.timer = 14;
    const api = s.t.api;
    if (api && api.spin) api.spin(n => { if (MG.active === s && s.phase === "spin") s.result = n; }, p); else s.timer = 1.5;
    render(); return;
  }
  if (a === "pay" && s.phase === "pay") {
    const h = nextUnsettled(s); if (!h) { finishRound(s, s.clean ? 1 : 0); return; }
    settle(s, h, v, RULES.rlOutcome(h.b, s.result));
    render();
    if (!nextUnsettled(s)) finishRound(s, s.clean ? 1 : 0);
  }
}
const RL_SUB = {
  wait: "Esperando que se sienten jugadores…", bets: "Los jugadores apuestan. Cantá \"No va más\" para cerrar las apuestas.",
  power: "Tocá Lanzar con la aguja en la zona verde.", spin: "La bola gira…", pay: "Pagá a los ganadores: pleno 35:1, docena 2:1, color y par/impar 1:1. Con el 0 pierden todas menos el pleno al 0.", summary: "Fin de la tirada.",
};
function rlView(s) {
  const cur = s.phase === "pay" ? nextUnsettled(s) : null;
  const rows = s.hands.map(h => {
    const res = h.settled ? (h.ok ? "✓ " : "✗ ") + (h.settled === "lose" ? "Cobrada" : "Pagada " + h.settled + ":1") : h.gone ? "Se levantó" : "";
    const cls = (h === cur ? " cur" : "") + (h.settled ? (h.ok ? " ok" : " bad") : "") + (h.gone ? " gone" : "");
    return `<div class="mg-row${cls}"><span class="a">${h.n} · ${esc(h.c.type.name)}</span><span class="n">${fmt(h.bet)}</span><span>${esc(RULES.rlLabel(h.b))}</span><span class="s">${res}</span></div>`;
  }).join("");
  const n = s.result, resHtml = n != null && (s.phase === "pay" || s.phase === "summary") ? `<div class="mg-res ${RULES.color(n)}">${n} · ${RULES.color(n) === "verde" ? "Cero" : RULES.color(n) === "rojo" ? "Rojo" : "Negro"}${n ? ` · ${n % 2 ? "impar" : "par"} · ${Math.ceil(n / 12)}.ª docena` : ""}</div>` : "";
  const meter = s.phase === "power" ? `<div class="mg-meter"><i class="zone" style="left:${MG_CFG.rlZone[0] * 100}%;width:${(MG_CFG.rlZone[1] - MG_CFG.rlZone[0]) * 100}%"></i><span>Fuerza</span><i class="needle" id="mgPw" style="left:${(rlPower(s) * 100).toFixed(1)}%"></i></div>` : "";
  const body = `${resHtml}${meter}${rows ? `<div class="mg-rows">${rows}</div>` : `<div class="mg-empty">No hay nadie sentado. Cuando llegue un cliente, aparece acá.</div>`}`;
  let acts = "";
  switch (s.phase) {
    case "wait": acts = btn("nomore", "", "No va más", "pri", null, true); break;
    case "bets": acts = btn("nomore", "", "No va más", "pri", "Espacio"); break;
    case "power": acts = btn("throw", "", "Lanzar la bola", "pri", "Espacio"); break;
    case "spin": acts = btn("x", "", "La bola gira…", "", null, true); break;
    case "pay": if (cur) { const b = cur.bet; acts = btn("pay", "lose", `Pierde (cobrar ${fmt(b)})`, "alt", 1) + btn("pay", "1", `Paga 1:1 (${fmt(b)})`, "", 2) + btn("pay", "2", `Paga 2:1 (${fmt(b * 2)})`, "", 3) + btn("pay", "35", `Paga 35:1 (${fmt(b * 35)})`, "", 4); } break;
    case "summary": acts = btn("x", "", "Siguiente tirada…", "", null, true); break;
  }
  const sub = s.phase === "pay" && cur ? `Salió el ${n}. Asiento ${cur.n}: ${RULES.rlLabel(cur.b)}.` : RL_SUB[s.phase];
  return { title: `Ruleta${s.round ? " · tirada " + s.round : ""}`, sub, body, acts };
}

// =====================================================================
// REPARACIÓN DE TRAGAMONEDAS (3 pasos)
// =====================================================================
const FAULTS = [
  ["Los rodillos no giran", "Motor de rodillos"], ["La pantalla parpadea", "Placa de video"], ["No acepta fichas", "Validador de fichas"],
  ["La palanca quedó floja", "Resorte de palanca"], ["Se corta la luz al girar", "Fusible"], ["No paga los premios", "Tolva de pago"],
];
const WIRE_COLS = ["#ff5a4f", "#f0c24a", "#4fa3ff"];
function openRepair(m) {
  if (MG.active || !m || m.dead || !m.d.broken) return !!MG.active;
  if (ST().bank < m.def.repair) { B.toast(`No te alcanza para el repuesto: ${fmt(m.def.repair)}.`, "bad"); B.SFX.bad(); return true; }
  const f = FAULTS[(Math.random() * FAULTS.length) | 0];
  const others = FAULTS.filter(x => x !== f).sort(() => Math.random() - 0.5).slice(0, 3).map(x => x[1]);
  const opts = others.concat(f[1]).sort(() => Math.random() - 0.5);
  const s = { kind: "rp", m, step: 1, fault: f, opts, tried: [], wires: [0, 0, 0].map(() => 1 + ((Math.random() * 3) | 0)), t0: performance.now(), mistakes: 0, lost: 0,
    zone: 0.2 + Math.random() * 0.5, nT0: 0, elapsed: 0, fresh: [] };
  openSession(s);
  B.hint("mgRp", "Reparación a mano: elegí el repuesto que corresponde a la falla, girá los cables y calibrá en la zona verde. Cuanto más rápido y prolijo, más XP.");
  return true;
}
function rpNeedle(s, now) { const p = ((now - s.nT0) / 1000 / MG_CFG.repairPeriod) % 2; return p < 1 ? p : 2 - p; }
function rpFrame(s, now) {
  s.elapsed = (now - s.t0) / 1000;
  setBar(1 - s.elapsed / MG_CFG.repairGood, s.elapsed > MG_CFG.repairGreat);
  if (s.step === 3) { const n = $("mgPw"); if (n) n.style.left = (rpNeedle(s, now) * 100).toFixed(1) + "%"; }
}
function rpAct(s, a, v) {
  const m = s.m, def = m.def;
  if (a === "part" && s.step === 1) {
    if (v === s.fault[1]) { s.step = 2; B.SFX.tick(); msg("Repuesto correcto. Ahora girá los cables.", "good"); render(); return; }
    if (s.tried.includes(v)) return;
    s.tried.push(v); s.mistakes++;
    const lost = Math.round(def.repair * MG_CFG.repairWrongPart); s.lost += lost;
    B.Economy.force("repairs", lost); B.SFX.bad(); B.updateHud(true);
    msg(`Ese repuesto no era: lo perdiste (${fmt(lost)}).`, "bad"); render(); return;
  }
  if (a === "wire" && s.step === 2) {
    const i = +v; s.wires[i] = (s.wires[i] + 1) % 4; B.SFX.tick();
    if (s.wires.every(r => r === 0)) { s.step = 3; s.nT0 = performance.now(); msg("Cables en su lugar. Calibrá con la aguja en la zona verde.", "good"); }
    render(); return;
  }
  if (a === "fix" && s.step === 3) {
    const p = rpNeedle(s, performance.now());
    if (p < s.zone || p > s.zone + MG_CFG.repairZone) { s.mistakes++; B.SFX.bad(); msg(p < s.zone ? "Muy a la izquierda: probá de nuevo." : "Muy a la derecha: probá de nuevo.", "bad"); return; }
    const sec = (performance.now() - s.t0) / 1000;
    closeSession();
    B.repairMachine(m, true);
    if (m.d.broken) return; // no alcanzó la plata
    const great = sec <= MG_CFG.repairGreat && s.mistakes === 0, good = sec <= MG_CFG.repairGood && s.mistakes <= 1;
    const bonus = great ? MG_CFG.repairXpGreat : good ? MG_CFG.repairXpGood : 0;
    if (bonus) B.Rank.add(bonus);
    B.toast(`${great ? "Reparación impecable" : good ? "Buena reparación" : "Reparación lenta"}: ${sec.toFixed(1)} s${s.mistakes ? `, ${s.mistakes} error${s.mistakes > 1 ? "es" : ""}` : ""}${bonus ? ` · +${bonus} XP extra` : ""}.`, great ? "xp" : good ? "good" : "");
    B.floatText(m.slot.x, 2.4, m.slot.z - 0.5, "Reparada", "#9fd0ff");
    B.updateHud(true); B.save(true);
  }
}
const wireSvg = (r, col) => `<svg viewBox="0 0 100 100" width="54" height="54" style="transform:rotate(${r * 90}deg)" aria-hidden="true"><path d="M10 50 H80 M60 30 L84 50 L60 70" stroke="${col}" stroke-width="11" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
function rpView(s) {
  const def = s.m.def;
  let body = "", acts = "";
  if (s.step === 1) {
    body = `<div class="mg-steps">Paso 1 de 3 · Repuesto</div><div class="mg-q">Falla: <b>${esc(s.fault[0])}</b>. ¿Qué repuesto ponés?</div>`;
    acts = s.opts.map((o, i) => btn("part", o, esc(o), s.tried.includes(o) ? "alt" : "", i + 1, s.tried.includes(o))).join("");
  } else if (s.step === 2) {
    body = `<div class="mg-steps">Paso 2 de 3 · Cables</div><div class="mg-q">Tocá cada cable hasta que su flecha apunte a la derecha →</div>
      <div class="mg-wires">${s.wires.map((r, i) => `<button class="mg-wire${r === 0 ? " on" : ""}" data-mg="wire" data-v="${i}" aria-label="Girar cable ${i + 1}">${wireSvg(r, WIRE_COLS[i])}</button>`).join("")}</div>`;
  } else {
    body = `<div class="mg-steps">Paso 3 de 3 · Calibración</div><div class="mg-q">Ajustá cuando la aguja pase por la zona verde.</div>
      <div class="mg-meter" style="background:#22362d"><i class="zone" style="left:${(s.zone * 100).toFixed(1)}%;width:${MG_CFG.repairZone * 100}%"></i><i class="needle" id="mgPw" style="left:0%"></i></div>`;
    acts = btn("fix", "", "Ajustar", "pri", "Espacio");
  }
  return { title: "Reparación", sub: `${def.name} · repuesto ${fmt(def.repair)}${s.lost ? ` · perdiste ${fmt(s.lost)} en repuestos` : ""}`, body, acts };
}

// API pública: game.js llama a handles/tableTick/openRepair; las pruebas usan el resto
root.CasinoMG = {
  handles, tableTick, openRepair, openTable,
  get active() { return MG.active; },
  act: (a, v) => act(a, v),
  close: () => MG.active && leave(MG.active),
  rules: RULES, cfg: MG_CFG,
  register(type, ext) { EXT[type] = ext; EXTK[ext.kind] = ext; },
  // piezas del núcleo para los minijuegos de otros archivos (poker.js)
  kit: { msg, render, btn, esc, cardHtml, setBar, mistake, live, seatNo, openSession, closeSession, stepOffPad, clamp, rnd, SUITS, RANKS },
};
})();
