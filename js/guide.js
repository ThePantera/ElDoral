/* Casino Dorado · guide.js — GUÍA DE LA PRIMERA HORA (v2)
 * Una flecha dorada en el salón y un cartelito arriba al centro marcan a dónde ir en cada paso del tutorial
 * (vaciar la Clásica, depositar, pedir en la compu, traer cajas, reponer, cobrar) y, en los primeros rangos,
 * cuándo hay una caja llena o el bolsillo está por llenarse. Usa window.CasinoGuideBridge (game.js),
 * CasinoStory (misiones activas) y CasinoShop.guide() (cajas, góndolas y compu). Se apaga en la Pausa.
 * No agrega luces: la flecha usa materiales sin luz.
 */
(() => {
"use strict";
const G = window.CasinoGuideBridge;
if (!G || !window.THREE) return;
const T = THREE;
const PREF_KEY = "casino-dorado-guia-v1";
const C = {
  every: 0.25,    // cada cuánto se recalcula el paso (s)
  arrive: 1.7,    // a esta distancia (m) la flecha se esconde: ya llegaste
  helpRank: 2,    // hasta este rango la guía también avisa cajas llenas y bolsillo casi lleno
  pocketWarn: 0.8, // fracción del bolsillo que dispara "andá a depositar"
  boxWorth: 25,   // plata mínima en una caja para mandarte a vaciarla en el tutorial
};

let on = true;
try { const p = JSON.parse(localStorage.getItem(PREF_KEY) || "{}"); if (p.on === false) on = false; } catch (e) {}
function setOn(v) { on = !!v; try { localStorage.setItem(PREF_KEY, JSON.stringify({ on })); } catch (e) {} if (!on) hide(); }

// ---------------------------------------------------------------- flecha en el mundo
const gold = new T.MeshBasicMaterial({ color: 0xffc94a, transparent: true, opacity: 0.92, depthTest: false, toneMapped: false });
const ringMat = new T.MeshBasicMaterial({ color: 0xffc94a, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false, side: T.DoubleSide });
const marker = new T.Group(); marker.visible = false; marker.renderOrder = 20;
const cone = new T.Mesh(new T.ConeGeometry(0.17, 0.42, 4), gold); cone.rotation.x = Math.PI; cone.renderOrder = 20; marker.add(cone);
const stem = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.3, 6), gold); stem.position.y = 0.36; stem.renderOrder = 20; marker.add(stem);
const ring = new T.Mesh(new T.RingGeometry(0.42, 0.55, 28), ringMat); ring.rotation.x = -Math.PI / 2; marker.add(ring);
G.scene.add(marker);

// ---------------------------------------------------------------- cartelito arriba al centro
const pill = document.createElement("div");
pill.id = "guidePill"; pill.hidden = true;
pill.innerHTML = '<span class="g-arrow">▲</span><span class="g-text"></span><span class="g-dist"></span>';
document.body.appendChild(pill);
const st = document.createElement("style");
st.textContent = `#guidePill{position:fixed;left:50%;top:max(34px,calc(env(safe-area-inset-top,0px) + 34px));transform:translateX(-50%);z-index:35;display:flex;align-items:center;gap:10px;max-width:min(560px,calc(100vw - 32px));padding:7px 14px 7px 10px;border:1px solid #c9a24a;border-radius:999px;background:rgba(7,20,15,.86);color:#f3e9d2;font:600 15px/1.25 'Barlow Semi Condensed','Arial Narrow',Arial,sans-serif;pointer-events:none;box-shadow:0 4px 18px rgba(0,0,0,.35)}
#guidePill .g-arrow{display:inline-block;color:#ffc94a;font-size:16px;transition:transform .12s linear}
#guidePill .g-text{flex:1;min-width:0}
#guidePill .g-dist{color:#c9b98a;font-family:var(--font-num,monospace);font-size:13px;white-space:nowrap}
#guidePill.here .g-arrow{transform:none!important}`;
document.head.appendChild(st);
const elArrow = pill.querySelector(".g-arrow"), elText = pill.querySelector(".g-text"), elDist = pill.querySelector(".g-dist");

function hide() { marker.visible = false; pill.hidden = true; }

// ---------------------------------------------------------------- qué paso toca ahora
const S = () => G.S;
const story = () => window.CasinoStory;
const shop = () => window.CasinoShop && window.CasinoShop.guide ? window.CasinoShop.guide() : null;
const activeMission = id => { const s = story(); return !!(s && s.isActive && s.isActive(id)); };
const since = (id, k) => { const s = story(); return s && s.since ? s.since(id, k) : 0; };
const pt = (x, z, y) => ({ x, z, y: y == null ? 2.3 : y });
const machinePt = m => pt(m.group.position.x, m.group.position.z, 2.9);

function fullestMachine() {
  let best = null;
  for (const m of G.machines) if (!m.d.broken && (!best || m.d.box > best.d.box)) best = m;
  return best;
}
function nearestBox(sh, test) {
  let best = null, bd = Infinity;
  for (const b of sh.boxes) { if (b.held || !test(b)) continue; const d = Math.hypot(b.x - G.player.x, b.z - G.player.z); if (d < bd) { bd = d; best = b; } }
  return best;
}
const pcStep = (text) => { const sh = shop(); return sh ? { text, at: pt(sh.PC.stand.x, sh.PC.stand.z - 0.6, 1.9) } : null; };
const safeStep = () => ({ text: `Depositá ${G.fmt(S().pocket)} en la caja fuerte (mantené ${G.KEY})`, at: pt(G.SAFE.win.x, G.SAFE.win.z, 2.2) });

function tutorialStep() {
  const s = S();
  // 1) vaciar la Clásica y depositar
  if (activeMission("m_primera_caja")) {
    if (s.pocket > 0 && (since("m_primera_caja", "boxesByHand") >= 1 || s.pocket >= G.pocketCap() * C.pocketWarn)) return safeStep();
    const m = fullestMachine();
    if (!m) { const r = brokenStep(); if (r) return r; }
    if (m && m.d.box >= C.boxWorth) return { text: `Vaciá la caja de la ${m.def.name} (mirala y mantené ${G.KEY})`, at: machinePt(m) };
    if (!G.isOpen) return { text: G.isTouch ? `Abrí el casino con el botón "Abrir ya"` : "Abrí el casino: apretá N para no esperar a las 10", at: null };
    if (m) return { text: `Esperá que jueguen en la ${m.def.name}: su caja se va llenando`, at: machinePt(m), soft: true };
  }
  const sh = shop();
  if (!sh) return null;
  // 2) pedir otra máquina, traer la caja y ubicarla
  if (activeMission("m_segunda")) {
    if (sh.carry && sh.carry.k === "machine") return { text: `Entrá la caja al salón y apretá ${G.KEY} para elegir dónde va (o soltala en un cuadro dorado)`, at: pt(0, 3, 0.4) };
    const b = nearestBox(sh, b => b.k === "machine");
    if (b) return { text: `Levantá la caja de la máquina en la vereda (${G.KEY})`, at: pt(b.x, b.z, 1.6) };
    if (sh.ordered("machine")) return { text: `El camión está en camino: deja la caja en la vereda de la entrada`, at: pt(-6, -12, 1.6), soft: true };
    return pcStep(`Pedí otra tragamonedas en la compu de la oficina (${G.KEY})`);
  }
  // 3) reponer el kiosco y cobrar
  if (activeMission("m_kiosco")) {
    if (since("m_kiosco", "restocked") < 6) {
      if (sh.carry && sh.carry.k === "prod") { const u = sh.shelfPos(sh.carry.shelf); return { text: `Reponé: mirá ${sh.shelfName(sh.carry.shelf).toLowerCase()} y mantené ${G.KEY}`, at: pt(u.x, u.z, 2.3) }; }
      const b = nearestBox(sh, b => b.k === "prod" && b.shelf !== "fichas");
      if (b) return { text: `Levantá una caja de bebidas o snacks de la vereda (${G.KEY})`, at: pt(b.x, b.z, 1.6) };
      return pcStep(`Pedí una caja de bebidas o snacks en la compu (${G.KEY})`);
    }
    if (since("m_kiosco", "registerByHand") < 3) return { text: sh.queue > 0 ? `Cobrá en la caja registradora: pasá detrás del mostrador y ${G.KEY}` : "Esperá clientes en la caja registradora", at: pt(sh.REG.back.x, sh.REG.back.z, 2.2), soft: sh.queue === 0 };
  }
  return null;
}

function brokenStep() {
  const m = G.machines.find(m => m.d.broken);
  return m ? { text: `La ${m.def.name} está rota: mirala y apretá ${G.KEY} para repararla`, at: machinePt(m) } : null;
}

// fuera del tutorial, en los primeros rangos: bolsillo, cajas llenas y máquinas rotas (si no hay técnico)
function helpStep() {
  const s = S();
  if (s.rank > C.helpRank) return null;
  if (s.pocket >= G.pocketCap() * C.pocketWarn) return safeStep();
  if (!(s.staff && s.staff.tech > 0)) { const r = brokenStep(); if (r) return r; }
  const m = G.machines.find(m => !m.d.broken && G.isFull(m));
  if (m && G.pocketRoom() > 0) return { text: `La ${m.def.name} tiene la caja llena: no acepta apuestas. Vaciala (${G.KEY})`, at: machinePt(m) };
  return null;
}

// ---------------------------------------------------------------- panel más simple al principio
// Cada dato del panel aparece cuando empieza a servir. Clase .g-later (display:none) en la fila que todavía no hace falta.
const LATER = [
  { el: () => document.getElementById("hHeat"), row: true, show: s => s.heat > 0 || s.day >= 2 },
  { el: () => document.getElementById("hImg"), row: true, show: s => s.rank >= 2 || s.day >= 3 || (window.CasinoOwner && window.CasinoOwner.image && window.CasinoOwner.image() > 0) },
  { el: () => document.getElementById("hRival"), show: s => s.day >= 2 },
  { el: () => document.getElementById("hNext"), show: s => s.day >= 2 || !!s.loan },
  { el: () => document.getElementById("hChal"), show: s => s.day >= 2 },
];
st.textContent += ".g-later{display:none!important}";
function disclose() {
  const s = S(); if (!s) return;
  for (const L of LATER) {
    let el = L.el(); if (!el) continue;
    if (L.row) el = el.closest(".meter") || el;
    const hideIt = !s.gameOver && !L.show(s);
    if (el.classList.contains("g-later") !== hideIt) el.classList.toggle("g-later", hideIt);
  }
}

// ---------------------------------------------------------------- bucle
let t = 0, step = null, bob = 0;
let tHud = 0;
function frame(dt) {
  tHud -= dt; if (tHud <= 0 && G.started) { tHud = 0.5; try { disclose(); } catch (e) {} }
  if (!on || !G.started || G.ui.panel || !S() || S().dayOver || S().gameOver || (window.CasinoBuild && window.CasinoBuild.active)) { hide(); return; }
  t -= dt;
  if (t <= 0) { t = C.every; try { step = tutorialStep() || helpStep(); } catch (e) { step = null; } }
  if (!step) { hide(); return; }
  bob += dt;
  const p = G.player;
  let dist = 0, here = false;
  if (step.at) {
    dist = Math.hypot(step.at.x - p.x, step.at.z - p.z); here = dist < C.arrive;
    marker.visible = !here;
    marker.position.set(step.at.x, step.at.y + Math.sin(bob * 3) * 0.12, step.at.z);
    ring.position.y = -step.at.y - Math.sin(bob * 3) * 0.12 + 0.03;
    cone.rotation.y = stem.rotation.y = bob * 1.6;
    gold.opacity = step.soft ? 0.55 : 0.92;
    // flecha del cartel: 0° = derecho adonde mirás
    const dx = step.at.x - p.x, dz = step.at.z - p.z, fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
    elArrow.style.transform = `rotate(${Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz)}rad)`;
  } else marker.visible = false;
  pill.classList.toggle("here", !step.at || here);
  if (elText.textContent !== step.text) elText.textContent = step.text;
  const d = step.at && !here ? `${Math.round(dist)} m` : "";
  if (elDist.textContent !== d) elDist.textContent = d;
  elArrow.style.visibility = step.at && !here ? "visible" : "hidden";
  pill.hidden = false;
}

window.CasinoGuide = {
  frame, get on() { return on; }, set: setOn,
  debug: { get step() { return step ? { text: step.text, at: step.at, soft: !!step.soft } : null; }, get visible() { return !pill.hidden; }, marker },
};
})();
