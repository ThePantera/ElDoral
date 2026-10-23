/* Casino Dorado · upgrades.js — LICENCIAS Y ÁRBOL DE MEJORAS (tienda al estilo TCG)
 * Se carga después de game.js y antes de shop.js. Usa window.CasinoShopBridge (game.js).
 *  - Licencias: se compran una vez con plata cuando tu rango llega; habilitan productos, máquinas y mesas en la compu.
 *  - Árbol de mejoras: 4 ramas de 5 escalones (Máquinas, Personal, Bar y comodidad, Negocio y calle).
 *    Los efectos se leen con CasinoUp.v(clave, base): las claves "...Mul" multiplican, el resto suma.
 *  - Tecla U (o la compu): abre el árbol. Estado en S.shop.lic y S.shop.up (shop.js lo valida).
 */
(() => {
"use strict";
const G = window.CasinoShopBridge, D = window.CASINO_DATA;
if (!G || !D || !D.UPGRADES || !D.LICENSES) return;
const S = () => G.S;
const fmt = n => G.fmt(n);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const UPG = id => D.UPGRADES.find(u => u.id === id);
const LIC = id => D.LICENSES.find(l => l.id === id);
const BR = id => D.UP_BRANCHES.find(b => b.id === id);
const ownUp = () => { const s = S(); return (s && s.shop && s.shop.up && typeof s.shop.up === "object") ? s.shop.up : {}; };
const ownLic = () => { const s = S(); return (s && s.shop && s.shop.lic && typeof s.shop.lic === "object") ? s.shop.lic : {}; };

// =====================================================================
// EFECTOS
// =====================================================================
let memoKey = "", memo = {};
function v(key, dflt) {
  const up = ownUp(), k = Object.keys(up).join(",");
  if (k !== memoKey) { memoKey = k; memo = {}; }
  const mk = key + "|" + dflt;
  if (mk in memo) return memo[mk];
  const mul = /Mul$/.test(key);
  let r = dflt;
  for (const id in up) { const u = UPG(id); if (!u || !up[id] || !(key in u.eff)) continue; r = mul ? r * u.eff[key] : r + u.eff[key]; }
  return (memo[mk] = r);
}
const hasUp = id => !!ownUp()[id];
const hasLic = id => !!ownLic()[id];
function licFor(kind, target) { return D.LICENSES.find(l => l.kind === kind && l.target === target) || null; }
function licOk(kind, target) { const l = licFor(kind, target); return !l || hasLic(l.id); }
function licPrice(l) { return Math.round(l.price * (1 - v("licDiscount", 0))); }
function targetName(l) {
  if (l.kind === "prod") { const p = D.SHOP.products.find(x => x.id === l.target); return p ? p.name : l.target; }
  if (l.kind === "machine") { const m = D.MACHINES.find(x => x.id === l.target); return m ? m.name : l.target; }
  const t = D.TABLES.find(x => x.id === l.target); return t ? t.name : l.target;
}
function prevOf(u) { const list = D.UPGRADES.filter(x => x.branch === u.branch); const i = list.indexOf(u); return i > 0 ? list[i - 1] : null; }

// guardias que van solos por los tramposos (life.js lee estos números)
let lifeBase = null; // valores de life.js antes de la mejora; solo se tocan al comprarla o al cargar una partida sin ella
function apply() {
  const ch = D.LIFE && D.LIFE.cheater; if (!ch) return;
  const on = v("cheaterGuard", 0) > 0;
  if (on && !lifeBase) { lifeBase = { gc: ch.guardChance, gd: ch.guardDelay }; ch.guardChance = 0.95; ch.guardDelay = 22; }
  else if (!on && lifeBase) { ch.guardChance = lifeBase.gc; ch.guardDelay = lifeBase.gd; lifeBase = null; }
}

// =====================================================================
// COMPRAS
// =====================================================================
function shopState() { const s = S(); if (!s) return null; if (!s.shop || typeof s.shop !== "object") return null; if (!s.shop.lic) s.shop.lic = {}; if (!s.shop.up) s.shop.up = {}; return s.shop; }
function buyLic(id) {
  const l = LIC(id), sh = shopState(); if (!l || !sh) return false;
  if (sh.lic[id]) return false;
  if (S().rank < l.rank) { G.toast(`La licencia de ${targetName(l)} pide rango ${l.rank}.`, "bad"); G.SFX.bad(); return false; }
  if (!G.Economy.trySpend("licenses", licPrice(l))) return false;
  sh.lic[id] = 1; G.SFX.cash();
  G.toast(`Licencia nueva: ${targetName(l)}. Ya lo podés pedir en la compu.`, "good");
  G.save(true); G.updateHud(true); return true;
}
function upStatus(u) {
  if (hasUp(u.id)) return "own";
  const p = prevOf(u); if (p && !hasUp(p.id)) return "prev";
  if (S().rank < u.rank) return "rank";
  if (S().bank < u.price) return "money";
  return "ok";
}
function buyUp(id) {
  const u = UPG(id), sh = shopState(); if (!u || !sh) return false;
  const st = upStatus(u);
  if (st === "own") return false;
  if (st === "prev") { G.toast(`Primero comprá «${prevOf(u).name}».`, "bad"); G.SFX.bad(); return false; }
  if (st === "rank") { G.toast(`«${u.name}» pide rango ${u.rank}.`, "bad"); G.SFX.bad(); return false; }
  if (!G.Economy.trySpend("licenses", u.price)) return false;
  sh.up[id] = 1; memoKey = "~"; apply(); G.SFX.rank();
  G.toast(`Mejora: ${u.name}. ${u.desc}`, "xp");
  G.save(true); G.updateHud(true); return true;
}

// =====================================================================
// EFECTOS POR HORA (gerente y autodiagnóstico) — tiempo de simulación
// =====================================================================
let mgrT = 0;
const brokeT = new Map();
function update(dt) {
  apply();
  const s = S(); if (!s) return;
  if (v("manager", 0) > 0 && G.isOpen) {
    mgrT += dt;
    if (mgrT >= G.HOUR) {
      mgrT = 0; let sum = 0;
      for (const m of G.machines) {
        if (m.dead || m.claimCash) continue;
        if (m.d.box >= G.capOf(m.def) * 0.8) { sum += Math.round(m.d.box); m.d.box = 0; G.updateFill(m); G.refreshScreen(m); }
      }
      if (sum > 0) { G.Economy.add("deposits", sum); G.toast(`El gerente vació las cajas llenas y depositó ${fmt(sum)}.`, "good"); }
    }
  }
  if (v("autoRepair", 0) > 0) {
    for (const m of G.machines) {
      if (m.dead || !m.d.broken) { brokeT.delete(m); continue; }
      const t = (brokeT.get(m) || 0) + dt;
      if (t >= G.HOUR) { brokeT.delete(m); G.repairMachine(m, false); if (G.near(m.slot.x, m.slot.z, 14)) G.floatText(m.slot.x, 2.4, m.slot.z - 0.5, "Autodiagnóstico", "#9fd0ff"); }
      else brokeT.set(m, t);
    }
  }
}

// =====================================================================
// INTERFAZ: árbol y licencias
// =====================================================================
const CSS = `
.upTree{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.upCol{display:grid;gap:6px;align-content:start}
.upCol h3{margin:0;font-size:1rem;color:var(--brass);display:flex;gap:6px;align-items:center}
.upNode{position:relative;background:rgba(7,20,15,.55);border:1px solid #2c4a3d;border-radius:7px;padding:6px 8px;display:grid;gap:3px;font-size:.84rem;line-height:1.25}
.upNode+.upNode::before{content:"";position:absolute;left:50%;top:-7px;width:2px;height:6px;background:#3b5a4b}
.upNode b{font-size:.9rem}
.upNode .m{color:var(--ivory-dim);font-size:.78rem}
.upNode.own{border-color:var(--mint);background:rgba(29,138,78,.18)}
.upNode.ok{border-color:var(--brass)}
.upNode.lock{opacity:.6}
.upNode button{padding:.25em .5em;font-size:.82rem;justify-self:start}
.upNode .tag{font-size:.7rem}
@media (max-width:760px){.upTree{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;
{ const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st); }
let tab = "tree", fromPc = false;
function treeHtml() {
  const cols = D.UP_BRANCHES.map(b => {
    const nodes = D.UPGRADES.filter(u => u.branch === b.id).map(u => {
      const st = upStatus(u), prev = prevOf(u);
      const btn = st === "own" ? `<span class="tag">Tuya</span>`
        : st === "prev" ? `<span class="m">Primero: ${esc(prev.name)}</span>`
        : st === "rank" ? `<span class="tag lock">Rango ${u.rank}</span>`
        : `<button data-uact="up" data-id="${u.id}" ${st === "money" ? "disabled" : ""}>Comprar ${fmt(u.price)}</button>`;
      return `<div class="upNode ${st === "own" ? "own" : st === "ok" ? "ok" : st === "money" ? "" : "lock"}"><b>${esc(u.name)}</b><span class="m">Rango ${u.rank} · ${fmt(u.price)}</span><span>${esc(u.desc)}</span>${btn}</div>`;
    }).join("");
    return `<div class="upCol"><h3><span aria-hidden="true">${b.icon}</span>${esc(b.name)}</h3>${nodes}</div>`;
  }).join("");
  return `<p>Banco <b class="num">${fmt(S().bank)}</b> · rango <b>${S().rank}</b>. Cada rama se compra en orden. Los efectos son permanentes.</p><div class="upTree">${cols}</div>`;
}
function licHtml() {
  const groups = [["prod", "Productos del kiosco"], ["machine", "Máquinas"], ["table", "Mesas"]];
  const disc = v("licDiscount", 0);
  return `<p>Banco <b class="num">${fmt(S().bank)}</b>. Una licencia se paga una sola vez y habilita pedir ese producto, máquina o mesa en la compu. ${disc ? `Tenés ${Math.round(disc * 100)}% de descuento.` : ""}</p>` + groups.map(([k, name]) => {
    const rows = D.LICENSES.filter(l => l.kind === k).map(l => {
      const own = hasLic(l.id), locked = S().rank < l.rank, price = licPrice(l);
      return `<div class="item${locked ? " locked" : ""}${own ? " sel" : ""}"><span class="sw" style="background:${own ? "#6fd39b" : "#8a6a2c"}"></span>
        <div class="t"><b>${esc(targetName(l))} · <span class="num">${fmt(price)}</span>${locked ? `<span class="tag lock">Rango ${l.rank}</span>` : ""}${own ? '<span class="tag">Tuya</span>' : ""}</b><span>Licencia de ${k === "prod" ? "venta" : k === "machine" ? "explotación" : "mesa de juego"}.</span></div>
        <div class="btns"><button data-uact="lic" data-id="${l.id}" ${own || locked || S().bank < price ? "disabled" : ""}>Comprar</button></div></div>`;
    }).join("");
    return `<h3>${name}</h3><div class="list">${rows}</div>`;
  }).join("");
}
function open(t, pc) {
  if (!S()) return;
  if (t) tab = t;
  if (pc != null) fromPc = !!pc;
  const head = `<div class="tabs"><button data-uact="tab" data-id="tree" class="${tab === "tree" ? "on" : ""}">Árbol de mejoras</button><button data-uact="tab" data-id="lic" class="${tab === "lic" ? "on" : ""}">Licencias</button></div>`;
  const back = fromPc && window.CasinoShop ? `<button class="ghost" data-uact="pc">Volver a la compu</button>` : "";
  G.openPanel("upgrades", `<h2>${tab === "tree" ? "Mejoras" : "Licencias"}</h2>${head}${tab === "tree" ? treeHtml() : licHtml()}<div class="actions">${back}<button class="ghost" data-act="close">Cerrar</button></div>`);
}
document.getElementById("panelBody").addEventListener("click", e => {
  const b = e.target.closest("button[data-uact]"); if (!b || b.disabled) return;
  const a = b.dataset.uact, id = b.dataset.id;
  if (a === "tab") open(id);
  else if (a === "up") { buyUp(id); open(); }
  else if (a === "lic") { buyLic(id); open(); }
  else if (a === "pc") { G.closePanel(true); window.CasinoShop.openPc("order"); }
});
window.addEventListener("keydown", e => {
  if (e.code !== "KeyU" || e.repeat || !G.started || !S()) return;
  if (G.ui.mg || (window.CasinoBuild && window.CasinoBuild.active)) return;
  if (G.ui.panel === "upgrades") { G.closePanel(false, true); return; }
  if (G.ui.panel || S().gameOver) return;
  fromPc = false; open("tree");
});

// líneas para la pantalla de rango nuevo
function rankLines(lvl) {
  const out = [];
  for (const l of D.LICENSES) if (l.rank === lvl) out.push(`Licencia disponible: ${targetName(l)} (${fmt(licPrice(l))})`);
  const ups = D.UPGRADES.filter(u => u.rank === lvl).map(u => u.name);
  if (ups.length) out.push(`Mejoras nuevas (U): ${ups.join(", ")}`);
  return out;
}

window.CasinoUp = {
  v, hasUp, hasLic, licFor, licOk, licPrice, targetName, buyLic, buyUp, upStatus, open, update, apply, rankLines,
  get tab() { return tab; },
};
})();
