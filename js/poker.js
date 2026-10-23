/* Casino Dorado · poker.js — Mesa de Póker (Texas Hold'em).
 * La casa no juega: los clientes juegan entre ellos y la casa se queda con la COMISIÓN (rake) de cada pozo.
 * 1) Con croupier contratado la mano se juega sola (game.js → CasinoPoker.autoHand).
 * 2) Sin croupier repartís vos (minijuego "pk" enganchado al núcleo de minigames.js):
 *    repartir, quemar y dar flop/turn/river cuando terminan las apuestas, elegir al ganador, cobrar la comisión y empujar el pozo.
 * Las reglas puras (mazo, evaluador de manos, IA de apuestas) viven en PK y no tocan el DOM: se prueban en node (tests/poker.test.js).
 */
(() => {
"use strict";
const root = typeof window !== "undefined" ? window : globalThis;

// =====================================================================
// AJUSTES (balance del póker)
// =====================================================================
const PK_CFG = {
  rake: 0.05, rakeCap: 400,       // la casa cobra 5% del pozo con tope (si no hay flop, no hay comisión)
  minPlayers: 2,                  // con menos no se juega
  buyInMul: 8,                    // para sentarse hace falta 8 ciegas grandes (tope de apuestas por mano: 2 por calle × 4 calles)
  maxRaises: 2,                   // por calle: una apuesta y una resubida (límite fijo)
  aiSec: 0.45, dealSec: 0.14,     // ritmo de las decisiones de los clientes y del reparto
  parSec: 1.5, slowMul: 2.5, afkSec: 45,
  tip: 0.02,                      // propina del ganador (× pozo × velocidad) si todo salió bien
  xpHand: 2, xpWinner: 2, xpPerfect: 2,
  repPerfect: 0.15, repWrongWinner: -1.0, repOverRake: -0.8,
  lonelySec: 40,                  // un jugador solo espera rival este tiempo y se va
};

// =====================================================================
// REGLAS PURAS
// =====================================================================
// cartas: { r: 1..13 (1 = As), s: 0..3 (♠ ♥ ♦ ♣) } — el mismo formato que minigames.js
const RANK_NAME = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const CAT_NAME = ["Carta alta", "Par", "Doble par", "Trío", "Escalera", "Color", "Full", "Póker", "Escalera de color"];
const val = c => c.r === 1 ? 14 : c.r; // el As vale 14 (y 1 en la escalera baja A-2-3-4-5)
const PK = {
  newDeck(rand) {
    rand = rand || Math.random;
    const d = [];
    for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) d.push({ r, s });
    for (let i = d.length - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; const t = d[i]; d[i] = d[j]; d[j] = t; }
    return d;
  },
  // mejor mano de exactamente 5 cartas → { cat, tb (desempates), score }
  eval5(cards) {
    const v = cards.map(val).sort((a, b) => b - a);
    const flush = cards.every(c => c.s === cards[0].s);
    const uniq = [...new Set(v)];
    let straight = 0;
    if (uniq.length === 5) {
      if (v[0] - v[4] === 4) straight = v[0];
      else if (v[0] === 14 && v[1] === 5 && v[4] === 2) straight = 5; // escalera baja (rueda)
    }
    const cnt = {}; for (const x of v) cnt[x] = (cnt[x] || 0) + 1;
    // grupos ordenados por cantidad y después por valor
    const groups = Object.keys(cnt).map(Number).sort((a, b) => cnt[b] - cnt[a] || b - a);
    const shape = groups.map(g => cnt[g]).join("");
    let cat, tb;
    if (straight && flush) { cat = 8; tb = [straight]; }
    else if (shape === "41") { cat = 7; tb = groups; }
    else if (shape === "32") { cat = 6; tb = groups; }
    else if (flush) { cat = 5; tb = v; }
    else if (straight) { cat = 4; tb = [straight]; }
    else if (shape === "311") { cat = 3; tb = groups; }
    else if (shape === "221") { cat = 2; tb = groups; }
    else if (shape === "2111") { cat = 1; tb = groups; }
    else { cat = 0; tb = v; }
    let score = cat;
    for (let i = 0; i < 5; i++) score = score * 15 + (tb[i] || 0);
    return { cat, tb, score };
  },
  // mejor mano de 5 entre 5, 6 o 7 cartas (prueba las 21 combinaciones de 7)
  best(cards) {
    const n = cards.length;
    if (n < 5) return PK.partial(cards);
    let best = null;
    const idx = [0, 1, 2, 3, 4];
    const pick = (start, k, chosen) => {
      if (k === 5) { const hand = chosen.map(i => cards[i]), e = PK.eval5(hand); if (!best || e.score > best.score) { best = e; best.cards = hand; } return; }
      for (let i = start; i <= n - (5 - k); i++) { chosen[k] = i; pick(i + 1, k + 1, chosen); }
    };
    pick(0, 0, idx);
    return best;
  },
  // con menos de 5 cartas (para la IA en el flop): solo pares, tríos y pókers
  partial(cards) {
    const v = cards.map(val).sort((a, b) => b - a), cnt = {};
    for (const x of v) cnt[x] = (cnt[x] || 0) + 1;
    const groups = Object.keys(cnt).map(Number).sort((a, b) => cnt[b] - cnt[a] || b - a), shape = groups.map(g => cnt[g]).join("");
    const cat = shape[0] === "4" ? 7 : shape[0] === "3" ? 3 : shape.startsWith("22") ? 2 : shape[0] === "2" ? 1 : 0;
    let score = cat; for (let i = 0; i < 5; i++) score = score * 15 + (groups[i] || 0);
    return { cat, tb: groups, score };
  },
  compare: (a, b) => PK.best(a).score - PK.best(b).score,
  name(e) {
    const R = x => RANK_NAME[x];
    switch (e.cat) {
      case 8: return e.tb[0] === 14 ? "Escalera real" : `Escalera de color al ${R(e.tb[0])}`;
      case 7: return `Póker de ${R(e.tb[0])}`;
      case 6: return `Full de ${R(e.tb[0])} con ${R(e.tb[1])}`;
      case 5: return `Color al ${R(e.tb[0])}`;
      case 4: return `Escalera al ${R(e.tb[0])}`;
      case 3: return `Trío de ${R(e.tb[0])}`;
      case 2: return `Doble par: ${R(e.tb[0])} y ${R(e.tb[1])}`;
      case 1: return `Par de ${R(e.tb[0])}`;
      default: return `Carta alta: ${R(e.tb[0])}`;
    }
  },
  // índices de los ganadores entre manos de 7 cartas (más de uno = pozo dividido)
  winners(hands) {
    let top = -1, out = [];
    hands.forEach((cards, i) => { if (!cards) return; const sc = PK.best(cards).score; if (sc > top) { top = sc; out = [i]; } else if (sc === top) out.push(i); });
    return out;
  },
  // comisión de la casa: 5% del pozo, redondeada a $5, con tope. Sin flop no se cobra.
  rake(pot, sawFlop, pct, cap) {
    if (!sawFlop || pot <= 0) return 0;
    pct = pct == null ? PK_CFG.rake : pct; cap = cap == null ? PK_CFG.rakeCap : cap;
    return Math.min(cap, Math.round(pot * pct / 5) * 5);
  },
  // fuerza de la mano para la IA (0..1)
  strength(hole, board) {
    if (!board.length) {
      const a = val(hole[0]), b = val(hole[1]), hi = Math.max(a, b), lo = Math.min(a, b);
      if (a === b) return Math.min(1, 0.5 + a / 28);
      return Math.min(0.95, (hi + lo) / 30 + (hole[0].s === hole[1].s ? 0.06 : 0) + (hi - lo === 1 ? 0.04 : 0) - (hi < 10 ? 0.1 : 0));
    }
    const me = PK.best(hole.concat(board)), bd = PK.best(board);
    const base = [0.12, 0.42, 0.62, 0.72, 0.8, 0.85, 0.92, 0.97, 1][me.cat];
    const kick = (me.tb[0] || 0) / 140;
    // si la mejor mano está toda en la mesa la comparten todos: vale poco
    return me.cat > bd.cat || (me.cat === 0 && me.tb[0] > (bd.tb[0] || 0)) ? Math.min(1, base + kick) : Math.max(0.05, base - 0.3 + kick);
  },
  // decisión de un cliente: "fold" | "call" (pasar o igualar) | "raise" (apostar o subir)
  decide(type, str, toCall, canRaise, rand) {
    rand = rand || Math.random;
    const noise = { casual: 0.2, regular: 0.12, highroller: 0.1, vip: 0.1 }[type] || 0.15;
    const s = str + (rand() * 2 - 1) * noise;
    const bluff = (type === "highroller" || type === "vip") && rand() < 0.07;
    if (canRaise && (s > 0.72 || bluff)) return "raise";
    if (toCall <= 0) return "call";
    return s > 0.32 ? "call" : "fold";
  },
  // ---------------------------------------------------------------
  // una mano completa como estado puro (la usan el croupier automático y el minijuego)
  //  players: [{ id, type, stack }] en orden de asiento
  // ---------------------------------------------------------------
  newHand(players, unit, btn, deck) {
    const H = { unit, btn: btn % players.length, deck: deck || PK.newDeck(), board: [], burned: 0, street: 0, pot: 0,
      ps: players.map((p, i) => ({ i, id: p.id, type: p.type || "regular", stack: p.stack, contrib: 0, streetIn: 0, folded: false, allin: false, cards: [], st: "" })),
      toAct: [], bet: 0, raises: 0, log: [] };
    // ciegas: chica = media unidad, grande = una unidad
    const n = H.ps.length, sb = H.ps[(H.btn + 1) % n], bb = H.ps[(H.btn + 2) % n];
    PK.put(H, sb, Math.round(unit / 2 / 5) * 5 || 5); sb.st = "Ciega chica";
    PK.put(H, bb, unit); bb.st = "Ciega grande";
    return H;
  },
  put(H, p, amount) {
    const a = Math.max(0, Math.min(amount, p.stack - p.contrib));
    p.contrib += a; p.streetIn += a; H.pot += a;
    if (p.stack - p.contrib <= 0) p.allin = true;
    return a;
  },
  dealHole(H) { for (let k = 0; k < 2; k++) for (let j = 1; j <= H.ps.length; j++) H.ps[(H.btn + j) % H.ps.length].cards.push(H.deck.pop()); },
  live: H => H.ps.filter(p => !p.folded),
  // arranca una ronda de apuestas: preflop habla primero el de después de la ciega grande; después, el de después del botón
  startStreet(H) {
    const n = H.ps.length, pre = H.street === 0;
    if (!pre) for (const p of H.ps) p.streetIn = 0;
    H.bet = pre ? H.unit : 0; H.raises = pre ? 1 : 0;
    const first = (H.btn + (pre ? 3 : 1)) % n;
    H.toAct = [];
    for (let k = 0; k < n; k++) { const p = H.ps[(first + k) % n]; if (!p.folded && !p.allin) H.toAct.push(p); }
    if (PK.live(H).length < 2) H.toAct = [];
  },
  // un jugador decide; devuelve { p, action, amount } o null si la ronda terminó
  actOne(H, rand) {
    let p;
    do { p = H.toAct.shift(); } while (p && (p.folded || p.allin));
    if (!p) return null;
    const toCall = Math.max(0, H.bet - p.streetIn), canRaise = H.raises < PK_CFG.maxRaises && p.stack - p.contrib > toCall;
    const a = PK.decide(p.type, PK.strength(p.cards, H.board), toCall, canRaise, rand);
    let out;
    if (a === "fold" && toCall > 0) { p.folded = true; p.st = "Se retira"; out = { p, action: "fold", amount: 0 }; }
    else if (a === "raise" && canRaise) {
      const amt = PK.put(H, p, toCall + H.unit); H.bet = p.streetIn; H.raises++;
      p.st = toCall > 0 ? "Sube" : "Apuesta";
      // todos los demás vuelven a hablar
      const n = H.ps.length; H.toAct = [];
      for (let k = 1; k < n; k++) { const q = H.ps[(p.i + k) % n]; if (!q.folded && !q.allin) H.toAct.push(q); }
      out = { p, action: "raise", amount: amt };
    } else { const amt = PK.put(H, p, toCall); p.st = amt > 0 ? "Iguala" : "Pasa"; out = { p, action: amt > 0 ? "call" : "check", amount: amt }; }
    if (PK.live(H).length < 2) H.toAct = [];
    H.log.push(out); return out;
  },
  streetOver: H => !H.toAct.some(p => !p.folded && !p.allin) || PK.live(H).length < 2,
  // quemar y dar la calle siguiente (flop 3, turn 1, river 1)
  burnAndDeal(H) {
    H.deck.pop(); H.burned++;
    const k = H.street === 0 ? 3 : 1;
    for (let i = 0; i < k; i++) H.board.push(H.deck.pop());
    H.street++;
  },
  streetName: st => ["flop", "turn", "river"][st] || "",
  // ganadores al final: índices de jugadores (sin retirarse) con la mejor mano
  result(H) {
    const live = PK.live(H);
    if (live.length === 1) return { winners: [live[0].i], showdown: false };
    const w = PK.winners(H.ps.map(p => p.folded ? null : p.cards.concat(H.board)));
    return { winners: w, showdown: true };
  },
  // reparto del pozo menos la comisión: { i: monto }
  payouts(H, winners, rake) {
    const net = H.pot - rake, out = {}, each = Math.floor(net / winners.length / 5) * 5;
    winners.forEach((i, k) => { out[i] = k === 0 ? net - each * (winners.length - 1) : each; });
    return out;
  },
  // juega una mano entera sin intervención (croupier contratado)
  playAuto(players, unit, btn, rand) {
    const H = PK.newHand(players, unit, btn, PK.newDeck(rand));
    PK.dealHole(H); PK.startStreet(H);
    for (;;) {
      while (!PK.streetOver(H)) PK.actOne(H, rand);
      if (PK.live(H).length < 2 || H.street >= 3) break;
      PK.burnAndDeal(H); PK.startStreet(H);
    }
    const r = PK.result(H), rake = PK.rake(H.pot, H.street > 0);
    return { H, winners: r.winners, showdown: r.showdown, rake, pay: PK.payouts(H, r.winners, rake) };
  },
  // ciega grande de la mano según lo que banca cada jugador sentado (múltiplo de $5)
  stake(def, cs, rand) {
    rand = rand || Math.random;
    let hi = def.maxBet;
    for (const c of cs) hi = Math.min(hi, c.betMax, Math.floor(c.budget / PK_CFG.buyInMul));
    if (hi < def.minBet) return 0;
    return Math.max(def.minBet, Math.round((def.minBet + (hi - def.minBet) * (0.6 + 0.4 * rand())) / 5) * 5);
  },
  canSit: (def, c) => c.budget >= def.minBet * PK_CFG.buyInMul && c.rounds > 0 && c.betMax >= def.minBet,
};
root.CasinoPokerRules = PK; root.CasinoPokerConfig = PK_CFG;
if (typeof module !== "undefined" && module.exports) module.exports = { PK, PK_CFG };

const B = root.CasinoMGBridge;
if (!B || typeof document === "undefined") return;
const D = B.D, CFG = D.CFG, ST = () => B.S, fmt = B.fmt;
{ const def = D.TABLES.find(t => t.id === "poker"); if (def) { PK_CFG.rake = def.edge; if (def.rakeCap) PK_CFG.rakeCap = def.rakeCap; } } // la comisión se ajusta en data.js
const sfx = (ev, t, o) => { if (B.sfx && t) B.sfx(ev, t.center.x, t.center.z, o); };
const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));

// =====================================================================
// CROUPIER CONTRATADO: una mano entera por ronda de la mesa (game.js → playRound)
//  devuelve la comisión de la casa, o null si no se jugó (falta gente)
// =====================================================================
function autoHand(t, seated) {
  const def = t.def, cs = [];
  for (const se of seated) { const c = se.c; if (!PK.canSit(def, c)) { B.leaveCustomer(c); continue; } cs.push(c); }
  if (cs.length < PK_CFG.minPlayers) {
    // un jugador solo espera rival un rato y se va
    for (const c of cs) { c.pkLonely = (c.pkLonely || 0) + def.round; if (c.pkLonely > PK_CFG.lonelySec) B.leaveCustomer(c); }
    return null;
  }
  const unit = PK.stake(def, cs);
  if (!unit) return null;
  const btn = t.pkBtn || 0; t.pkBtn = btn + 1;
  const r = PK.playAuto(cs.map((c, i) => ({ id: i, type: c.type.id, stack: c.budget })), unit, btn);
  r.H.ps.forEach((p, i) => {
    const c = cs[i], won = r.pay[i] || 0;
    c.budget += won - p.contrib; c.played = true; c.rounds--; c.pkLonely = 0;
    if (won > p.contrib) { c.flags.won = true; if (c.person && Math.random() < 0.35) c.person.api.cheer(1); }
  });
  const api = t.api;
  if (api && api.setBoard) {
    api.setBoard(r.H.board); api.setPot(0); api.setButton(seatIdx(t, cs[r.H.btn]));
    for (let i = 0; i < t.seats.length; i++) api.setHole(i, false);
    r.H.ps.forEach((p, i) => api.setHole(seatIdx(t, cs[i]), p.folded ? false : r.showdown ? p.cards : true));
  }
  for (const c of cs) if (!PK.canSit(def, c)) B.leaveCustomer(c);
  return r.rake;
}
const seatIdx = (t, c) => t.seats.findIndex(x => x.c === c);

// =====================================================================
// MINIJUEGO: repartís vos (se engancha al núcleo de minigames.js)
// =====================================================================
const MGX = root.CasinoMG, K = MGX && MGX.kit;
if (!K) { root.CasinoPoker = { rules: PK, cfg: PK_CFG, autoHand }; return; }
const { msg, render, btn, esc, cardHtml, setBar, mistake, live, seatNo, closeSession, clamp } = K;

const style = document.createElement("style");
style.textContent = `
.pk-top{display:flex;align-items:center;gap:6px 12px;flex-wrap:wrap}
.pk-board{display:flex;gap:4px;min-height:44px;align-items:center}
.pk-board .mgc+.mgc{margin-left:0}
.mgc.slot{background:transparent;border:1px dashed #3d6b58;box-shadow:none}
.pk-pot{font-family:var(--font-num);font-size:1.05rem;color:var(--brass)}
.pk-info{font-size:.78rem;color:var(--ivory-dim)}
.pk-d{display:inline-grid;place-items:center;width:15px;height:15px;border-radius:50%;background:var(--ivory);color:#15171a;font:700 9px/1 var(--font-num);margin-left:4px;vertical-align:1px}
.mg-seat.win{border-color:var(--brass);background:rgba(217,168,74,.16)}
.mg-seat .mg-cards{min-height:36px}
.mg-pk .mg-seat .mgc{width:26px;height:36px;font-size:12px}
.mg-pk .mg-seat .mgc i{font-size:13px}
.mg-pk .mg-seat .mgc+.mgc{margin-left:2px}
`;
document.head.appendChild(style);

function open(s) {
  s.btn = s.t.pkBtn || 0; s.H = null; s.lonely = 0; s.waitN = -1;
  const api = s.t.api; if (api && api.clear) api.clear();
}
// quiénes juegan la mano: sentados, con plata y ganas
function eligible(s, seated) {
  const out = [];
  for (const se of seated) { if (PK.canSit(s.t.def, se.c)) out.push(se.c); else B.leaveCustomer(se.c); }
  return out;
}
function startBets(s, seated) {
  s.H = null; s.result = null; s.winners = null; s.rakeOpts = null; s.rakeTaken = 0; s.ptime = 0; s.actions = 0; s.mistakes = 0;
  s.wrongWinner = false; s.rakeErr = ""; s.burnt = false; s.input = false;
  const cs = eligible(s, seated);
  s.hands = cs.map(c => ({ c, n: seatNo(s.t, c), p: null, gone: false })).sort((a, b) => a.n - b.n);
  if (s.hands.length < PK_CFG.minPlayers) { s.phase = "wait"; render(); return; }
  s.unit = PK.stake(s.t.def, cs);
  if (!s.unit) { s.phase = "wait"; render(); return; }
  s.phase = "bets"; s.patience = CFG.patienceSec; render();
}
function api3d(s) { return s.t.api && s.t.api.setBoard ? s.t.api : null; }
function syncTable(s) {
  const api = api3d(s), H = s.H; if (!api || !H) return;
  api.setBoard(H.board); api.setPot(H.pot);
  const showAll = s.phase === "rake" || s.phase === "push" || s.phase === "winner" || s.phase === "summary";
  for (const h of s.hands) {
    const p = h.p; if (!p) continue;
    const n = dealtCount(s, p);
    api.setHole(h.n - 1, p.folded || h.gone || !n ? false : showAll && s.result && s.result.showdown ? p.cards : n);
  }
}
// cartas propias que ya se ven repartidas (el reparto va de a una, empezando a la izquierda del botón)
function dealtCount(s, p) {
  if (s.phase !== "deal") return p.cards.length;
  const n = s.H.ps.length, k = (p.i - s.H.btn - 1 + n) % n;
  return (s.dealN > k ? 1 : 0) + (s.dealN > n + k ? 1 : 0);
}

function update(s, dt, seated) {
  // alguien se levantó en medio de la mano: se retira
  for (const h of s.hands) if (!h.gone && !live(s, h)) { h.gone = true; if (h.p && !h.p.folded) { h.p.folded = true; h.p.st = "Se levantó"; } render(); }
  if (s.phase === "wait") {
    const cs = eligible(s, seated);
    if (cs.length >= PK_CFG.minPlayers) { s.lonely = 0; startBets(s, seated); return; }
    if (cs.length === 1) { s.lonely += dt; if (s.lonely > PK_CFG.lonelySec) { B.leaveCustomer(cs[0]); s.lonely = 0; msg("El jugador se cansó de esperar rival y se fue.", ""); } }
    else s.lonely = 0;
    if (cs.length !== s.waitN) { s.waitN = cs.length; render(); }
    return;
  }
  if (s.phase === "bets") {
    const n = s.hands.length;
    s.hands = s.hands.filter(h => live(s, h));
    for (const c of eligible(s, seated)) if (!s.hands.some(h => h.c === c)) s.hands.push({ c, n: seatNo(s.t, c), p: null, gone: false });
    s.hands.sort((a, b) => a.n - b.n);
    if (s.hands.length < PK_CFG.minPlayers) { s.phase = "wait"; s.waitN = -1; render(); return; }
    if (s.hands.length !== n) { s.unit = PK.stake(s.t.def, s.hands.map(h => h.c)) || s.unit; render(); }
    s.patience -= dt;
    if (s.patience <= 0) {
      for (const h of s.hands) { h.c.flags.waited = true; B.leaveCustomer(h.c); }
      msg("Tardaste demasiado: los jugadores se cansaron de esperar y se fueron.", "bad"); B.SFX.bad();
      s.phase = "wait"; s.hands = []; render();
    }
    return;
  }
  if (s.phase === "summary") { s.timer -= dt; if (s.timer <= 0) { msg(""); startBets(s, seated); } return; }
  if (s.input) {
    s.ptime += dt;
    if (s.ptime > PK_CFG.afkSec) {
      for (const h of s.hands) if (live(s, h)) { h.c.flags.waited = true; B.leaveCustomer(h.c); }
      msg("Dejaste la mano colgada: los jugadores se levantaron.", "bad"); B.Rep.change(-1); B.SFX.bad();
      s.phase = "wait"; s.input = false; s.hands = []; s.H = null; const api = api3d(s); if (api) api.clear(); render();
      return;
    }
  }
  const H = s.H; if (!H) return;
  // todos se fueron
  if (!PK.live(H).length) { s.phase = "wait"; s.input = false; s.H = null; s.waitN = -1; msg("Se levantaron todos: la mano no cuenta.", ""); render(); return; }
  if (s.phase === "deal") {
    s.timer -= dt;
    while (s.timer <= 0 && s.dealN < H.ps.length * 2) { s.dealN++; s.timer += PK_CFG.dealSec; B.SFX.tick(); render(); syncTable(s); }
    if (s.dealN >= H.ps.length * 2 && s.timer <= 0) { s.phase = "act"; s.timer = PK_CFG.aiSec * 0.6; PK.startStreet(H); render(); }
  } else if (s.phase === "act") {
    if (PK.live(H).length < 2) { toRake(s); return; }
    s.timer -= dt; if (s.timer > 0) return;
    s.timer = PK_CFG.aiSec;
    const a = PK.streetOver(H) ? null : PK.actOne(H);
    if (a) { if (a.amount > 0) sfx("chips", s.t); else B.SFX.tick(); render(); syncTable(s); return; }
    // terminó la ronda de apuestas
    if (PK.live(H).length < 2) { toRake(s); return; }
    if (H.street >= 3) { toWinner(s); return; }
    s.phase = "street"; s.input = true; s.burnt = false;
    msg(`Terminaron las apuestas: quemá una carta y dá el ${PK.streetName(H.street)}.`, ""); render();
  }
}
function toWinner(s) {
  s.result = PK.result(s.H); s.phase = "winner"; s.input = true;
  msg("Showdown: mirá las cartas y elegí quién gana el pozo.", ""); B.SFX.tick(); render(); syncTable(s);
}
// la mano terminó (todos se retiraron, o ya se eligió ganador): toca la comisión
function toRake(s) {
  const H = s.H;
  if (!s.result) { s.result = PK.result(H); s.winners = s.result.winners.slice(); const w = H.ps[s.winners[0]], h = s.hands.find(x => x.p === w); msg(`Todos se retiraron: gana el asiento ${h ? h.n : "?"} sin mostrar.`, ""); }
  const correct = PK.rake(H.pot, H.street > 0), r5 = Math.round(H.pot * PK_CFG.rake / 5) * 5, r10 = Math.round(H.pot * PK_CFG.rake * 2 / 5) * 5;
  const opts = [0, correct, correct === 0 ? r5 : r5 > correct ? r5 : r10];
  s.rakeOpts = [...new Set(opts)].sort((a, b) => a - b);
  s.phase = "rake"; s.input = true; render(); syncTable(s);
}
function act(s, a, v) {
  const H = s.H;
  if (a === "deal" && s.phase === "bets") {
    const cs = s.hands.filter(h => live(s, h));
    if (cs.length < PK_CFG.minPlayers) return;
    s.round++; s.actions = 1; s.ptime = 0; s.expect = 10;
    s.hands = cs;
    s.H = PK.newHand(cs.map((h, i) => ({ id: i, type: h.c.type.id, stack: h.c.budget })), s.unit, s.btn);
    cs.forEach((h, i) => { h.p = s.H.ps[i]; h.won = 0; h.hand = ""; });
    PK.dealHole(s.H);
    s.phase = "deal"; s.dealN = 0; s.timer = 0; s.result = null; s.winners = null;
    const api = api3d(s); if (api) { api.clear(); api.setButton(cs[s.H.btn].n - 1); }
    sfx("shuffle", s.t); msg(""); render(); syncTable(s); return;
  }
  if ((a === "burn" || a === "street") && s.phase === "act") { mistake(s, "¡Esperá! Todavía están apostando: se quema y se reparte cuando termina la ronda de apuestas."); return; }
  if (a === "burn" && s.phase === "street") {
    if (s.burnt) { mistake(s, `Ya quemaste una carta: ahora dá el ${PK.streetName(H.street)}.`); return; }
    H.deck.pop(); H.burned++; s.burnt = true; s.actions++; B.SFX.tick();
    msg(`Carta quemada. Ahora dá el ${PK.streetName(H.street)}.`, ""); render(); return;
  }
  if (a === "street" && s.phase === "street") {
    if (!s.burnt) { mistake(s, "Primero quemá una carta: va boca abajo al costado, antes de cada calle."); return; }
    const k = H.street === 0 ? 3 : 1;
    for (let i = 0; i < k; i++) { const c = H.deck.pop(); c.fresh = true; s.fresh.push(c); H.board.push(c); }
    H.street++; s.burnt = false; s.actions++; s.input = false;
    PK.startStreet(H); s.phase = "act"; s.timer = PK_CFG.aiSec;
    sfx("deal", s.t); msg(""); render(); syncTable(s); return;
  }
  if (a === "win" && s.phase === "winner") {
    const correct = s.result.winners, inHand = PK.live(H).map(p => p.i);
    const chosen = v === "split" ? (correct.length > 1 ? correct.slice() : inHand) : [+v];
    s.actions++; s.winners = chosen;
    for (const h of s.hands) if (h.p && !h.p.folded) h.hand = PK.name(PK.best(h.p.cards.concat(H.board)));
    const seatOf = i => (s.hands.find(h => h.p === H.ps[i]) || {}).n;
    if (sameSet(chosen, correct)) {
      B.SFX.coin();
      msg(correct.length > 1 ? `Bien: empate con ${s.hands.find(h => h.p === H.ps[correct[0]]).hand}. Pozo dividido.` : `Bien: el asiento ${seatOf(correct[0])} gana con ${s.hands.find(h => h.p === H.ps[correct[0]]).hand}.`, "good");
    } else {
      s.wrongWinner = true; s.mistakes++; B.Rep.change(PK_CFG.repWrongWinner); B.SFX.bad();
      const robbed = correct.filter(i => !chosen.includes(i));
      for (const i of robbed) { const h = s.hands.find(x => x.p === H.ps[i]); if (h) { h.angry = true; h.c.flags.waited = true; } }
      const hw = s.hands.find(h => h.p === H.ps[correct[0]]);
      msg(robbed.length ? `¡Error! El asiento ${robbed.map(seatOf).join(" y ")} tenía ${hw.hand}${correct.length > 1 ? " (empate)" : ""}: se queja y se va.` : `¡Error! No había empate: ganaba solo el asiento ${seatOf(correct[0])} con ${hw.hand}.`, "bad");
      if (!robbed.length) for (const i of correct) { const h = s.hands.find(x => x.p === H.ps[i]); if (h) { h.angry = true; h.c.flags.waited = true; } }
    }
    toRake(s); return;
  }
  if (a === "rake" && s.phase === "rake") {
    const amt = +v, correct = PK.rake(H.pot, H.street > 0);
    s.actions++; s.rakeTaken = amt;
    if (amt > correct) { s.rakeErr = "over"; s.mistakes++; B.Rep.change(PK_CFG.repOverRake); B.SFX.bad(); msg(`Cobraste de más: la comisión es ${correct ? `${fmt(correct)} (5% del pozo, tope ${fmt(PK_CFG.rakeCap)})` : "cero: sin flop no se cobra"}. Los jugadores protestan.`, "bad"); }
    else if (amt < correct) { s.rakeErr = "under"; s.mistakes++; B.SFX.bad(); msg(`Cobraste de menos: la casa dejó de ganar ${fmt(correct - amt)} (5% del pozo, tope ${fmt(PK_CFG.rakeCap)}).`, "bad"); }
    else { B.SFX.tick(); if (!s.wrongWinner) msg(amt ? `Comisión correcta: ${fmt(amt)}. Empujá el pozo.` : "Bien: sin flop no hay comisión. Empujá el pozo.", "good"); }
    s.phase = "push"; render(); return;
  }
  if (a === "push" && s.phase === "push") { s.actions++; payPot(s); finish(s); }
}
// la plata se mueve recién al empujar el pozo
function payPot(s) {
  const H = s.H, t = s.t, st = ST().today.st, pay = PK.payouts(H, s.winners, s.rakeTaken);
  for (const h of s.hands) {
    const p = h.p, c = h.c; if (!p) continue;
    const won = pay[p.i] || 0; h.won = won;
    c.budget += won - p.contrib; c.played = true; c.rounds--;
    if (won > p.contrib) { c.flags.won = true; if (c.person && !h.gone && Math.random() < 0.5) c.person.api.cheer(1); }
  }
  t.d.tray += s.rakeTaken; st.tablesNet += s.rakeTaken; B.addNet();
  sfx("chips", t); if (s.rakeTaken) B.SFX.coin();
  if (s.rakeTaken && B.near(t.center.x, t.center.z, 14)) B.floatText(t.center.x, 1.6, t.center.z, "Comisión +" + fmt(s.rakeTaken), "#6fd39b");
  const api = api3d(s); if (api) api.setPot(0);
}
function finish(s) {
  const S = ST(), H = s.H;
  const par = Math.max(1, s.actions) * PK_CFG.parSec, sf = clamp(par / Math.max(0.1, s.ptime), 0.25, 1), slow = s.ptime > par * PK_CFG.slowMul;
  const clean = !s.wrongWinner && s.rakeErr !== "over";
  let tips = clean && !slow ? Math.round(H.pot * PK_CFG.tip * sf / 5) * 5 : 0;
  if (slow) B.Rep.change(-0.25 * s.hands.length);
  const perfect = !slow && !s.mistakes;
  if (perfect) { B.Rep.change(PK_CFG.repPerfect); window.CasinoChallenge?.ev?.("perfect", "poker"); } // logros (challenge.js)
  const xp = PK_CFG.xpHand + (s.result && s.result.showdown && !s.wrongWinner ? PK_CFG.xpWinner : 0) + (perfect ? PK_CFG.xpPerfect : 0);
  if (tips > 0) { const room = B.Pocket.room(), inPocket = Math.min(tips, room); S.pocket += inPocket; if (tips > inPocket) s.t.d.tray += tips - inPocket; B.SFX.cash(); }
  S.today.st.handsByHand++;
  B.Rank.add(xp);
  B.checkObjectives(); B.updateHud(true);
  const def = s.t.def;
  for (const h of s.hands) if (live(s, h) && (h.angry || h.c.rounds <= 0 || !PK.canSit(def, h.c))) B.leaveCustomer(h.c);
  s.btn++; s.t.pkBtn = s.btn; s.t.mgRound = s.round;
  const errs = s.mistakes;
  msg((perfect ? "¡Mano perfecta! " : slow ? "Muy lento: los jugadores se impacientaron. " : errs ? `Mano con ${errs} error${errs > 1 ? "es" : ""}. ` : "Mano bien. ")
    + (s.rakeTaken ? `Comisión ${fmt(s.rakeTaken)} a la bandeja · ` : "") + (tips ? `Propina ${fmt(tips)} al bolsillo · ` : "") + `+${xp} XP · ${s.ptime.toFixed(1)} s`, perfect ? "good" : slow || errs ? "bad" : "");
  s.summary = { tips, xp, perfect, slow, mistakes: errs, rake: s.rakeTaken };
  s.phase = "summary"; s.timer = 2.2; s.input = false; render(); syncTable(s);
}
function leave(s) {
  const mid = s.phase !== "wait" && s.phase !== "bets" && s.phase !== "summary";
  if (mid) for (const h of s.hands) if (live(s, h)) h.c.flags.waited = true;
  const api = api3d(s); if (api && mid) api.clear();
  closeSession(mid ? "Dejaste la mano por la mitad: no cuenta y los jugadores se molestan." : "Dejaste la mesa. Los jugadores esperan un rato y se levantan.", mid ? "bad" : "");
}

const SUB = {
  wait: "Esperando jugadores: hacen falta al menos 2.", bets: "Ciegas puestas. Repartí cuando quieras: la paciencia baja.",
  deal: "Repartiendo dos cartas a cada uno…", act: "Los jugadores apuestan… esperá que terminen.",
  street: "Quemá una carta y dá la calle que sigue.", winner: "Elegí quién tiene la mejor mano de 5 cartas (sus 2 + las 5 de la mesa).",
  rake: "Cobrá la comisión de la casa: 5% del pozo, con tope. Sin flop no se cobra.", push: "Empujá el pozo al ganador.", summary: "Fin de la mano.",
};
function view(s) {
  const H = s.H, board = H ? H.board : [];
  const slots = [0, 1, 2, 3, 4].map(i => board[i] ? cardHtml(board[i]) : `<span class="mgc slot"></span>`).join("");
  const showdown = s.result && s.result.showdown && (s.phase === "winner" || s.phase === "rake" || s.phase === "push" || s.phase === "summary");
  const top = `<div class="pk-top"><span class="mg-lbl">Mesa</span><div class="pk-board">${slots}</div>
    <span class="pk-pot">${H ? "Pozo " + fmt(H.pot) : ""}</span><span class="pk-info">${s.unit ? `Ciegas ${fmt(Math.round(s.unit / 2 / 5) * 5 || 5)}/${fmt(s.unit)}` : ""}${H && H.burned ? ` · quemadas ${H.burned}` : ""}${s.burnt ? " · ya quemaste" : ""}</span></div>`;
  const seats = s.hands.map(h => {
    const p = h.p, n = p ? dealtCount(s, p) : 0, win = s.winners && p && s.winners.includes(p.i);
    const cards = !p || p.folded || h.gone ? "" : showdown ? p.cards.map(c => cardHtml(c)).join("") : p.cards.slice(0, n).map(c => cardHtml(c, true)).join("");
    const isBtn = H && p && H.btn === p.i;
    const st = h.gone ? "Se levantó" : s.phase === "summary" && h.won ? `<b>Gana ${fmt(h.won)}</b>` : showdown && h.hand ? esc(h.hand) : p ? esc(p.st) : "";
    const cls = (p && p.folded || h.gone ? " gone" : "") + (win && s.phase !== "winner" ? " win" : "");
    return `<div class="mg-seat${cls}"><div class="mg-sn">${h.n} · ${esc(h.c.type.name)}${isBtn ? '<span class="pk-d" title="Botón">D</span>' : ""}</div>
      <div class="mg-bet">${p ? (p.contrib ? "Puso " + fmt(p.contrib) : "—") : fmt(h.c.budget)}</div><div class="mg-cards">${cards}</div><div class="mg-st">${st}</div></div>`;
  }).join("");
  const body = top + (seats ? `<div class="mg-seats">${seats}</div>` : `<div class="mg-empty">No hay nadie sentado. Cuando lleguen al menos dos jugadores, aparecen acá.</div>`);
  let acts = "";
  const nextSt = H ? PK.streetName(H.street) : "flop";
  switch (s.phase) {
    case "wait": acts = btn("deal", "", "Repartir", "pri", null, true); break;
    case "bets": acts = btn("deal", "", "Repartir", "pri", "Espacio"); break;
    case "deal": acts = btn("x", "", "Repartiendo…", "", null, true); break;
    case "act": acts = H && H.street < 3 ? btn("burn", "", "Quemar carta", "alt", 1) + btn("street", "", `Dar el ${nextSt}`, "", 2) : btn("x", "", "Última ronda de apuestas…", "", null, true); break;
    case "street": acts = btn("burn", "", s.burnt ? "Carta quemada ✓" : "Quemar carta", "alt", 1) + btn("street", "", `Dar el ${nextSt}`, "", 2); break;
    case "winner": {
      const cont = s.hands.filter(h => h.p && !h.p.folded);
      acts = cont.map((h, k) => btn("win", h.p.i, `Gana el asiento ${h.n}`, "", k + 1)).join("") + btn("win", "split", "Empate: dividir el pozo", "alt", cont.length + 1);
      break;
    }
    case "rake": acts = (s.rakeOpts || []).map((amt, k) => btn("rake", amt, amt ? `Comisión ${fmt(amt)}` : "Sin comisión", amt ? "" : "alt", k + 1)).join(""); break;
    case "push": {
      const pay = PK.payouts(H, s.winners, s.rakeTaken), seatsW = s.winners.map(i => (s.hands.find(h => h.p === H.ps[i]) || {}).n);
      acts = btn("push", "", `Empujar el pozo (${fmt(Object.values(pay).reduce((a, b) => a + b, 0))}) al asiento ${seatsW.join(" y ")}`, "pri", "Espacio"); break;
    }
    case "summary": acts = btn("x", "", "Siguiente mano…", "", null, true); break;
  }
  let sub = SUB[s.phase];
  if (s.phase === "wait" && s.hands.length === 1) sub = "Hay un jugador esperando rival: hace falta uno más.";
  if (s.phase === "street") sub = s.burnt ? `Ahora dá el ${nextSt}${H.street === 0 ? " (3 cartas)" : ""}.` : `Terminaron las apuestas: quemá una carta antes del ${nextSt}.`;
  if (s.phase === "rake" && H) sub = `Pozo ${fmt(H.pot)}${H.street ? "" : " · no hubo flop"}. Comisión: 5% con tope ${fmt(PK_CFG.rakeCap)}; sin flop no se cobra.`;
  return { title: `Póker${s.round ? " · mano " + s.round : ""}`, sub, body, acts };
}

MGX.register("poker", {
  kind: "pk", open, update, view, act, leave,
  hint: "Sos el croupier de póker: la casa no juega, cobra comisión. Repartí, y cuando terminen las apuestas quemá una carta y dá el flop, el turn y el river. Al final elegí quién gana, cobrá la comisión (5% del pozo, con tope; sin flop no se cobra) y empujá el pozo.",
});
root.CasinoPoker = { rules: PK, cfg: PK_CFG, autoHand, get active() { const s = MGX.active; return s && s.kind === "pk" ? s : null; } };
})();
