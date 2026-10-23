/* Casino Dorado · juice.js — ENGANCHE DE CORTO PLAZO (v2)
 *  - Meta siempre a la vista: debajo del rango, "Próxima compra" con barra (plata en banco + bolsillo contra el precio).
 *    Cuando te alcanza, se ilumina y suena. Considera máquinas, mesas (con su licencia si falta) y ampliaciones.
 *  - Festejos: lluvia de monedas al vaciar una caja y al depositar, monedas y cartel en premios grandes y jackpots,
 *    papel picado y brillo dorado al subir de rango, y el saldo del banco que cuenta hacia arriba.
 * Usa window.CasinoJuiceBridge (game.js). Sin luces nuevas: todo con materiales sin luz y una sola malla instanciada.
 */
(() => {
"use strict";
const G = window.CasinoJuiceBridge;
if (!G || !window.THREE) return;
const T = THREE, D = G.D;
const C = {
  parts: 160,        // partículas en total (monedas + papel picado), una sola llamada de dibujo
  gravity: 7.5,
  coinsCollect: 14, coinsDeposit: 18, coinsBig: 22, coinsJackpot: 70, confetti: 110,
  countSec: 0.7,     // lo que tarda el saldo del banco en llegar al número nuevo
  goalEvery: 0.5,    // cada cuánto se recalcula la meta (s)
  milestones: [10000, 25000, 50000, 100000, 250000, 500000, 1000000], // saldos del banco que se festejan una vez
};
const S = () => G.S;
const fmt = n => G.fmt(n);

// ---------------------------------------------------------------- partículas (monedas y papel picado)
const geo = new T.BoxGeometry(0.11, 0.02, 0.11);
const mat = new T.MeshBasicMaterial({ toneMapped: false });
const mesh = new T.InstancedMesh(geo, mat, C.parts);
mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.frustumCulled = false; mesh.renderOrder = 5;
{ const c0 = new T.Color(0xffd25a); for (let i = 0; i < C.parts; i++) mesh.setColorAt(i, c0); } // crea el color por instancia antes de compilar el material
mesh.count = 0;
G.scene.add(mesh);
const P = []; for (let i = 0; i < C.parts; i++) P.push({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, rz: 0, spin: 0, s: 1, col: new T.Color() });
const GOLD = [0xffd25a, 0xf0b93a, 0xffe58a], CONF = [0xe8463c, 0x3c8ce8, 0x46c36a, 0xffd25a, 0xc85ad8, 0xff8a3c];
let next = 0;
function emit(x, y, z, n, o) {
  o = o || {};
  for (let k = 0; k < n; k++) {
    const p = P[next]; next = (next + 1) % C.parts;
    const a = Math.random() * Math.PI * 2, sp = (o.spread || 1.6) * (0.4 + Math.random() * 0.6);
    p.x = x + (Math.random() - 0.5) * (o.area || 0.2); p.y = y; p.z = z + (Math.random() - 0.5) * (o.area || 0.2);
    p.vx = Math.cos(a) * sp; p.vz = Math.sin(a) * sp; p.vy = (o.up || 3.2) * (0.6 + Math.random() * 0.6);
    if (o.toward) { p.vx += o.toward.x; p.vz += o.toward.z; }
    p.rx = Math.random() * 6; p.rz = Math.random() * 6; p.spin = 6 + Math.random() * 10;
    p.life = (o.life || 1.2) * (0.8 + Math.random() * 0.4); p.s = o.confetti ? 0.8 + Math.random() * 0.5 : 1;
    const pal = o.confetti ? CONF : GOLD; p.col.setHex(pal[(Math.random() * pal.length) | 0]);
  }
}
const _m = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _p = new T.Vector3(), _s = new T.Vector3();
function updateParts(dt) {
  let n = 0;
  for (const p of P) {
    if (p.life <= 0) continue;
    p.life -= dt; if (p.life <= 0) continue;
    p.vy -= C.gravity * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.y < 0.03) { p.y = 0.03; p.vy *= -0.35; p.vx *= 0.6; p.vz *= 0.6; }
    p.rx += p.spin * dt; p.rz += p.spin * 0.7 * dt;
    const sc = p.s * Math.min(1, p.life * 4);
    _m.compose(_p.set(p.x, p.y, p.z), _q.setFromEuler(_e.set(p.rx, 0, p.rz)), _s.set(sc, sc, sc));
    mesh.setMatrixAt(n, _m); mesh.setColorAt(n, p.col); n++;
  }
  mesh.count = n;
  if (n) { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
}
// delante de la cámara (para festejos "tuyos": rango, meta)
function inFront(dist, up) {
  const p = G.player, fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  return { x: p.x + fx * dist, y: (up == null ? 2.6 : up), z: p.z + fz * dist };
}

// ---------------------------------------------------------------- brillo dorado y cartel grande (DOM)
const css = document.createElement("style");
css.textContent = `#juiceGlow{position:fixed;inset:0;pointer-events:none;z-index:30;opacity:0;box-shadow:inset 0 0 160px 40px rgba(255,201,74,.55);transition:opacity .25s}
#juiceBanner{position:fixed;left:50%;top:28%;transform:translate(-50%,-50%) scale(.6);z-index:36;pointer-events:none;opacity:0;text-align:center;font:800 54px/1.05 Georgia,serif;color:#ffd25a;text-shadow:0 0 18px rgba(255,190,60,.85),0 3px 0 #5a3a08;transition:opacity .2s,transform .35s cubic-bezier(.2,1.6,.4,1);white-space:nowrap}
#juiceBanner small{display:block;font:600 22px 'Barlow Semi Condensed',Arial,sans-serif;color:#f3e9d2;text-shadow:0 2px 6px rgba(0,0,0,.8);margin-top:6px}
#juiceBanner.on{opacity:1;transform:translate(-50%,-50%) scale(1)}
#hGoal{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;margin:4px 0 2px;font-size:13px;cursor:default}
#hGoal .lbl{color:#e9dcb8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px}
#hGoal .bar{height:7px;border-radius:4px;background:rgba(255,255,255,.12);overflow:hidden}
#hGoal .bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#c9932e,#ffd25a);transition:width .4s}
#hGoal .v{font-family:var(--font-num,monospace);font-size:12px;color:#c9b98a;white-space:nowrap}
#hGoal.ready .lbl{color:#ffd25a}
#hGoal.ready .bar i{background:#6fd39b}
#hGoal.pop{animation:goalPop .9s ease-out}
@keyframes goalPop{0%{transform:scale(1)}25%{transform:scale(1.08);filter:brightness(1.6)}100%{transform:scale(1)}}
#panel.rankpop{animation:rankPop .5s cubic-bezier(.2,1.5,.4,1)}
@keyframes rankPop{0%{transform:scale(.7);opacity:0}100%{transform:scale(1);opacity:1}}
#hBank.up{color:#ffd25a;transition:color .2s}`;
document.head.appendChild(css);
const glow = document.createElement("div"); glow.id = "juiceGlow"; document.body.appendChild(glow);
const banner = document.createElement("div"); banner.id = "juiceBanner"; document.body.appendChild(banner);
let glowT = 0, bannerT = 0;
function flash(sec) { glowT = Math.max(glowT, sec || 0.6); glow.style.opacity = "1"; }
function showBanner(big, small, sec) {
  banner.innerHTML = `${big}${small ? `<small>${small}</small>` : ""}`;
  banner.classList.remove("on"); void banner.offsetWidth; banner.classList.add("on"); bannerT = sec || 2.2;
}

// ---------------------------------------------------------------- saldo del banco que cuenta
let shownBank = null, countFrom = 0, countTo = 0, countT = 0;
function updateBank(dt) {
  const s = S(), el = document.getElementById("hBank"); if (!s || !el) return;
  if (shownBank == null) { // al cargar: los hitos que ya pasaste no se festejan
    shownBank = countTo = s.bank;
    if (s.hints) for (const v of C.milestones) if (s.bank >= v) s.hints["bank" + v] = 1;
    return;
  }
  if (s.bank !== countTo) {
    if (Math.abs(s.bank - countTo) < 1) { countTo = s.bank; }
    else { countFrom = shownBank; countTo = s.bank; countT = C.countSec; }
  }
  if (countT > 0) {
    countT = Math.max(0, countT - dt); const u = 1 - countT / C.countSec, e = 1 - Math.pow(1 - u, 3);
    shownBank = countFrom + (countTo - countFrom) * e;
    el.classList.toggle("up", countTo > countFrom && countT > 0);
  } else { shownBank = countTo; el.classList.remove("up"); }
  const txt = fmt(Math.round(shownBank)); if (el.textContent !== txt) el.textContent = txt;
  // hitos del banco: se festejan una vez por partida
  const ms = C.milestones.find(v => s.bank >= v && !(s.hints && s.hints["bank" + v]));
  if (ms && s.hints && G.started && !G.ui.panel) { s.hints["bank" + ms] = 1; showBanner(fmt(ms), "en el banco. ¡Seguí así!", 2.4); flash(0.7); G.SFX.cash(); emit(...Object.values(inFront(2.2, 2.4)), 30, { spread: 1.4 }); }
}

// ---------------------------------------------------------------- meta: próxima compra
const goalEl = document.createElement("div"); goalEl.id = "hGoal"; goalEl.hidden = true;
goalEl.innerHTML = '<span class="lbl"></span><span class="bar"><i></i></span><span class="v"></span>';
{ const xp = document.querySelector("#hud .meter.xp"); if (xp) xp.insertAdjacentElement("afterend", goalEl); }
const gLbl = goalEl.querySelector(".lbl"), gBar = goalEl.querySelector("i"), gV = goalEl.querySelector(".v");
const shortName = n => String(n).replace(/^Tragamonedas\s+/i, "").replace(/^Mesa de\s+/i, "");
function costWithLic(kind, def) {
  const U = window.CasinoUp; let lic = 0;
  if (U && U.licFor) { const l = U.licFor(kind, def.id); if (l && !U.hasLic(l.id)) lic = U.licPrice(l); }
  return { price: def.price + lic, lic: lic > 0 };
}
function candidates() {
  const s = S(), out = [];
  const room = G.gamesCount() < G.maxGames();
  if (room) {
    for (const d of D.MACHINES) if (d.rank <= s.rank) { const c = costWithLic("machine", d); out.push({ key: "m:" + d.id, name: shortName(d.name), what: "máquina", ...c }); }
    for (const d of D.TABLES) if (d.rank <= s.rank && d.price) { const c = costWithLic("table", d); out.push({ key: "t:" + d.id, name: shortName(d.name), what: "mesa", ...c }); }
  }
  for (const z of D.ZONES) if (z.price && !s.zones[z.id] && z.rank <= s.rank) out.push({ key: "z:" + z.id, name: z.name, what: "ampliación", price: z.price, lic: false, zone: true });
  return out.sort((a, b) => a.price - b.price);
}
let goal = null, wasReady = false, goalT = 0;
function pickGoal() {
  const s = S(), money = Math.max(0, s.bank) + s.pocket, list = candidates();
  if (!list.length) return null;
  const own = new Set(G.machines.map(m => "m:" + m.def.id).concat(G.tables.map(t => "t:" + t.def.id)));
  // lo próximo para ahorrar: lo más barato que todavía no te alcanza; si todo te alcanza, lo más caro que no tenés
  const save = list.find(c => c.price > money);
  if (save) {
    // si ya te alcanza algo nuevo (que no tenés), eso primero: es una compra para hacer ya
    const ready = list.filter(c => c.price <= money && !own.has(c.key)).pop();
    return ready || save;
  }
  return list.filter(c => !own.has(c.key)).pop() || list[list.length - 1];
}
function updateGoal() {
  const s = S(); if (!s || s.gameOver) { goalEl.hidden = true; return; }
  const g = pickGoal();
  if (!g) { goalEl.hidden = true; goal = null; return; }
  const money = Math.max(0, s.bank) + s.pocket, ready = money >= g.price;
  if (!goal || goal.key !== g.key) wasReady = ready; // meta nueva: no festejar de entrada lo que ya te alcanzaba
  goal = g;
  goalEl.hidden = false; goalEl.classList.toggle("ready", ready);
  const lbl = ready ? `¡Comprá: ${g.name}!` : `Meta: ${g.name}`;
  if (gLbl.textContent !== lbl) gLbl.textContent = lbl;
  goalEl.title = ready ? `Te alcanza para ${g.what === "ampliación" ? "la ampliación" : "la " + g.what} ${g.name}${g.lic ? " (con su licencia)" : ""}. ${g.zone ? "Se compra en la pared SE VENDE." : "Pedila en la compu de la oficina."}` : `Próxima compra: ${g.name}${g.lic ? " + licencia" : ""}`;
  gBar.style.width = Math.min(100, (100 * money) / g.price).toFixed(1) + "%";
  const v = ready ? fmt(g.price) : `${fmt(money)}/${fmt(g.price)}`; if (gV.textContent !== v) gV.textContent = v;
  if (ready && !wasReady && G.started) {
    goalEl.classList.remove("pop"); void goalEl.offsetWidth; goalEl.classList.add("pop");
    G.toast(`¡Te alcanza para ${g.zone ? "ampliar: " + g.name : "la " + g.name}${g.lic ? " (con su licencia)" : ""}! ${g.zone ? "Andá a la pared SE VENDE." : "Pedila en la compu de la oficina."}`, "good");
    G.SFX.coin(); emit(...Object.values(inFront(1.8, 2.2)), 16, { spread: 1.1 });
  }
  wasReady = ready;
}

// ---------------------------------------------------------------- ganchos que llama game.js
function onCollect(m, amt) { const p = m.group.position; emit(p.x, 1.5, p.z, Math.min(C.coinsCollect + Math.floor(amt / 100), 40), { spread: 1.3, up: 3.4 }); }
function onDeposit(x, z, amt) { emit(x, 1.6, z, Math.min(C.coinsDeposit + Math.floor(amt / 150), 50), { spread: 1.2, up: 3.6 }); }
function onWin(m, prize, jackpot) {
  const p = m.group.position;
  if (jackpot) {
    emit(p.x, 2.6, p.z, C.coinsJackpot, { spread: 2.6, up: 5, life: 1.8, area: 0.6 });
    if (Math.hypot(p.x - G.player.x, p.z - G.player.z) < 22) { showBanner("¡MEGA JACKPOT!", `${fmt(prize)} en la ${shortName(m.def.name)}`, 2.6); flash(0.9); }
  } else emit(p.x, 2.2, p.z, C.coinsBig, { spread: 1.6, up: 4 });
}
function onRankUp(lvl, name) {
  const f = inFront(2.4, 3.2);
  emit(f.x, f.y, f.z, C.confetti, { confetti: true, spread: 2.6, up: 2.2, life: 2.6, area: 2.4 });
  flash(1.1);
  requestAnimationFrame(() => { const pn = G.panelEl; if (pn) { pn.classList.remove("rankpop"); void pn.offsetWidth; pn.classList.add("rankpop"); } });
}

// ---------------------------------------------------------------- bucle (después de updateHud)
function frame(dt) {
  updateParts(dt);
  if (glowT > 0) { glowT -= dt; if (glowT <= 0) glow.style.opacity = "0"; }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) banner.classList.remove("on"); }
  if (!G.started || !S()) return;
  updateBank(dt);
  goalT -= dt; if (goalT <= 0) { goalT = C.goalEvery; try { updateGoal(); } catch (e) { goalEl.hidden = true; } }
}
function reset() { shownBank = null; goal = null; wasReady = false; goalT = 0; for (const p of P) p.life = 0; }

window.CasinoJuice = {
  frame, reset, onCollect, onDeposit, onWin, onRankUp, emit,
  debug: { get goal() { return goal ? { ...goal } : null; }, get parts() { return mesh.count; }, pickGoal },
};
})();
