/* Casino Dorado · staff.js — PERSONAL POR ESCALA
 * Cada empleado tiene ficha propia: nombre, rango (Aprendiz · Junior · Semi-senior · Senior · Estrella) y nivel de eficiencia (1-100).
 * La eficiencia mueve la velocidad y acorta las tareas (reparar, vaciar cajas, servir); el sueldo sube con ella. Al contratar elegís entre
 * candidatos distintos (cambian cada día o con "Buscar otros"); a los que tenés los podés capacitar (+eficiencia, cuesta) o despedir.
 * Nahuel Técnico: técnico estrella único (anteojos de nerd, rulos, buzo negro, credencial al cuello); repara mucho más rápido.
 * window.CasinoStaff.killAll(): saca a todo el personal sin sueldo ni multa (lo usa el ataque de la mafia). Usa window.CasinoStaffBridge (game.js).
 * En el guardado: S.crew = [{id, role, name, eff, female, skin, hair, nahuel}]; partidas viejas reciben fichas por defecto (Junior, eficiencia 50).
 */
(() => {
"use strict";
const G = window.CasinoStaffBridge, T = window.THREE;
if (!G) return;

const S = () => G.S;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const isNum = v => typeof v === "number" && Number.isFinite(v);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const fmt = n => G.fmt(n);

// ---------------------------------------------------------------- números
const RANKS = [
  { min: 0, name: "Aprendiz", css: "#9aa5a0" },
  { min: 38, name: "Junior", css: "#8fd0a0" },
  { min: 55, name: "Semi-senior", css: "#7fb6ff" },
  { min: 72, name: "Senior", css: "#c79bff" },
  { min: 88, name: "Estrella", css: "#ffd15c" },
];
const NAHUEL = { name: "Nahuel Técnico", role: "tech", eff: 100, minRank: 6, fee: 12000, wageMul: 1.3, repairMul: 1.35, badge: "Nombre: Nahuel Técnico" };
const DEFAULT_EFF = 50, TRAIN_STEP = 8, CANDIDATES = 4, MAX_PER_ROLE = 30;
const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const HAIRS = [0x2a1a10, 0x1a1a1a, 0x5a3a1a, 0x8a6a3a, 0xc9b28a, 0x6a2a14];
const MALE = ["Matías", "Lucas", "Bruno", "Tomás", "Diego", "Franco", "Joaquín", "Gonzalo", "Ezequiel", "Santiago", "Maxi", "Facundo", "Nicolás", "Leandro", "Hernán", "Ramiro", "Agustín", "Julián"];
const FEMALE = ["Camila", "Sofía", "Lucía", "Valentina", "Florencia", "Julieta", "Agustina", "Micaela", "Romina", "Carolina", "Paula", "Daniela", "Noelia", "Mariana", "Belén", "Rocío", "Abril", "Candela"];
const LAST = ["Gómez", "Fernández", "Rodríguez", "López", "Martínez", "Pérez", "Sosa", "Romero", "Díaz", "Álvarez", "Torres", "Ruiz", "Acosta", "Benítez", "Medina", "Herrera", "Suárez", "Castro", "Ríos", "Molina"];

const rankIdx = eff => { let k = 0; for (let i = 0; i < RANKS.length; i++) if (eff >= RANKS[i].min) k = i; return k; };
const rankName = rec => RANKS[rankIdx(rec.eff)].name;
const effMul = rec => 0.6 + clamp(rec.eff, 1, 100) * 0.01;
const repairMul = rec => effMul(rec) * (rec.nahuel ? NAHUEL.repairMul : 1);
const taskMul = rec => rec.role === "tech" ? repairMul(rec) : effMul(rec);
const sdef = role => G.SDEF(role);
const wageFor = (role, eff, nahuel) => Math.round(sdef(role).wage * (0.35 + Math.pow(clamp(eff, 1, 100) / 50, 1.6) * 0.65) * (nahuel ? NAHUEL.wageMul : 1));
const wageOf = rec => wageFor(rec.role, rec.eff, rec.nahuel);
const trainCap = () => Math.min(100, 36 + 8 * S().rank); // hasta dónde podés capacitar según tu rango
const trainCost = rec => wageOf(rec) * 4;

// ---------------------------------------------------------------- fichas
let uid = 1;
function newId() { const crew = S().crew || []; let id; do { id = "e" + (uid++).toString(36) + Math.floor(Math.random() * 1296).toString(36); } while (crew.some(r => r.id === id)); return id; }
function usedNames() { return new Set((S().crew || []).map(r => r.name)); }
function makeName(female, rng, taken) {
  for (let k = 0; k < 40; k++) {
    const n = (female ? FEMALE : MALE)[Math.floor(rng() * (female ? FEMALE : MALE).length)] + " " + LAST[Math.floor(rng() * LAST.length)];
    if (!taken.has(n)) { taken.add(n); return n; }
  }
  const n = "Empleado " + Math.floor(rng() * 900 + 100); taken.add(n); return n;
}
function makeRec(role, eff, rng) {
  rng = rng || Math.random;
  const female = rng() < 0.5;
  return { id: newId(), role, name: makeName(female, rng, usedNames()), eff: clamp(Math.round(eff), 1, 100), female, skin: Math.floor(rng() * SKINS.length), hair: Math.floor(rng() * HAIRS.length) };
}
const defaultRecord = role => makeRec(role, DEFAULT_EFF);
function nahuelRec() { return { id: "nahuel", role: "tech", name: NAHUEL.name, eff: NAHUEL.eff, female: false, skin: 1, hair: 1, nahuel: true }; }
const recsOf = role => (S().crew || []).filter(r => r.role === role);
const nextRecord = (role, npcs) => (S().crew || []).find(r => r.role === role && !npcs.some(n => n.rec === r)) || null;
const lastOf = role => { const l = recsOf(role); let w = null; for (const r of l) if (!r.nahuel && (!w || r.eff < w.eff)) w = r; return w || l[l.length - 1] || null; }; // despedir sin elegir: el de menor eficiencia (a Nahuel solo si es el único)
const roleWages = def => { const l = recsOf(def.role); let w = 0; for (const r of l) w += wageOf(r); return w + Math.max(0, (S().staff[def.role] || 0) - l.length) * def.wage; };
const hasNahuel = () => (S().crew || []).some(r => r.nahuel);

// valida s.crew en el lugar (idempotente): el guardado puede llegar antes que este archivo, así que game.js la pasa cruda y se limpia al cargar
function clean(s) {
  s = s || S();
  const list = Array.isArray(s.crew) ? s.crew : []; s.crew = [];
  const seen = new Set(), names = new Set();
  for (const r of list) {
    if (!r || typeof r !== "object" || !G.SDEF(r.role) || !isNum(r.eff)) continue;
    if (s.crew.filter(x => x.role === r.role).length >= Math.min(MAX_PER_ROLE, s.staff[r.role] || 0)) continue; // nunca más fichas que cupos
    let id = typeof r.id === "string" && /^[a-z0-9]{1,12}$/.test(r.id) ? r.id : ""; if (seen.has(id)) id = "";
    const nahuel = !!r.nahuel && r.role === "tech" && !s.crew.some(x => x.nahuel);
    let name = typeof r.name === "string" ? r.name.replace(/[<>&"]/g, "").trim().slice(0, 28) : ""; if (nahuel) name = NAHUEL.name;
    if (!name || (!nahuel && names.has(name))) name = "";
    s.crew.push({ id, role: r.role, name, eff: nahuel ? NAHUEL.eff : clamp(Math.round(r.eff), 1, 100), female: nahuel ? false : !!r.female,
      skin: nahuel ? 1 : (isNum(r.skin) ? clamp(Math.floor(r.skin), 0, SKINS.length - 1) : 0), hair: nahuel ? 1 : (isNum(r.hair) ? clamp(Math.floor(r.hair), 0, HAIRS.length - 1) : 0), ...(nahuel ? { nahuel: true } : {}) });
    if (id) seen.add(id); if (name) names.add(name);
  }
  for (const r of s.crew) { // completar lo que falta
    if (!r.id) { do { r.id = "e" + (uid++).toString(36) + Math.floor(Math.random() * 1296).toString(36); } while (seen.has(r.id)); seen.add(r.id); }
    if (!r.name) r.name = makeName(r.female, Math.random, names);
  }
  for (const d of G.D.STAFF) { // partida vieja: las fichas que faltan se crean con nombre, rango Junior y eficiencia 50
    for (let i = s.crew.filter(r => r.role === d.role).length; i < (s.staff[d.role] || 0); i++) {
      const f = Math.random() < 0.5, id = "e" + (uid++).toString(36) + Math.floor(Math.random() * 1296).toString(36);
      seen.add(id); s.crew.push({ id, role: d.role, name: makeName(f, Math.random, names), eff: DEFAULT_EFF, female: f, skin: Math.floor(Math.random() * SKINS.length), hair: Math.floor(Math.random() * HAIRS.length) });
    }
  }
}
const align = clean, sanitize = (raw, s) => clean(s);

// ---------------------------------------------------------------- aspecto
function look(rec) {
  if (rec.nahuel) return { key: "nahuel", opts: { uniform: null, skin: SKINS[1], hair: 0x1a1a1a, female: false, top: "hoodie", shirt: 0x14151a, pants: 0x4c4f55, hairStyle: "curly", glasses: 0x15171a, noBeard: true, height: 1.07, badge: NAHUEL.badge } };
  return { key: `${rec.skin}_${rec.hair}_${rec.female ? 1 : 0}`, opts: { skin: SKINS[rec.skin % SKINS.length], hair: HAIRS[rec.hair % HAIRS.length], female: !!rec.female } };
}
// credencial colgada del cuello: tira + tarjeta con el nombre (se arma una vez por muñeco)
let badgeTex = null;
function addBadge(g, J, text) {
  if (!T || !J || !J.torso) return;
  if (!badgeTex) {
    const c = document.createElement("canvas"); c.width = 256; c.height = 176; const x = c.getContext("2d");
    x.fillStyle = "#f4f1e8"; x.fillRect(0, 0, 256, 176); x.fillStyle = "#1f4a8a"; x.fillRect(0, 0, 256, 30);
    x.fillStyle = "#fff"; x.font = "bold 22px sans-serif"; x.textAlign = "center"; x.fillText("CASINO DORADO", 128, 23);
    x.fillStyle = "#c9a24a"; x.beginPath(); x.arc(52, 92, 26, 0, Math.PI * 2); x.fill(); x.fillStyle = "#222"; x.beginPath(); x.arc(52, 86, 10, 0, Math.PI * 2); x.fill(); x.fillRect(38, 98, 28, 14);
    x.fillStyle = "#111"; x.textAlign = "left"; x.font = "bold 19px sans-serif"; x.fillText("Nombre:", 92, 80); x.font = "bold 21px sans-serif"; x.fillText("Nahuel", 92, 106); x.fillText("Técnico", 92, 132);
    x.fillStyle = "#555"; x.font = "15px sans-serif"; x.fillText("Técnico estrella", 18, 162);
    badgeTex = new T.CanvasTexture(c); if ("sRGBEncoding" in T) badgeTex.encoding = T.sRGBEncoding;
  }
  g.scale.multiplyScalar(1.07); // medio alto
  const card = new T.Mesh(new T.PlaneGeometry(0.115, 0.079), new T.MeshBasicMaterial({ map: badgeTex }));
  card.position.set(0, 0.4, 0.152); card.rotation.x = -0.1; J.torso.add(card);
  const rim = new T.Mesh(new T.PlaneGeometry(0.123, 0.087), new T.MeshBasicMaterial({ color: 0x1c1c20 })); rim.position.set(0, 0.4, 0.15); rim.rotation.x = -0.1; J.torso.add(rim);
  const strapMat = new T.MeshBasicMaterial({ color: 0x1f4a8a });
  for (const sgn of [-1, 1]) {
    const st = new T.Mesh(new T.BoxGeometry(0.012, 0.3, 0.006), strapMat); st.position.set(sgn * 0.03, 0.55, 0.142); st.rotation.set(-0.08, 0, sgn * -0.12); J.torso.add(st);
  }
}

// ---------------------------------------------------------------- candidatos
let roll = 0; const cache = {};
function rngFor(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function candidates(role) {
  const s = S(), key = role + ":" + s.day + ":" + roll + ":" + s.rank;
  if (cache[role] && cache[role].key === key) return cache[role].list;
  const rng = rngFor(s.day * 7919 + roll * 104729 + s.rank * 31 + role.length * 977 + role.charCodeAt(0)), cap = Math.min(100, 28 + s.rank * 9), lo = 12;
  const list = [];
  const taken = usedNames();
  for (let i = 0; i < CANDIDATES; i++) {
    const t = i / (CANDIDATES - 1), eff = Math.round(lo + (cap - lo) * clamp(t * 0.85 + rng() * 0.25, 0, 1));
    const f = rng() < 0.5, rec = { id: "c" + i, role, name: makeName(f, rng, taken), eff, female: f, skin: Math.floor(rng() * SKINS.length), hair: Math.floor(rng() * HAIRS.length) };
    rec.fee = wageOf(rec) * 2; // plus de contratación: dos días de sueldo
    list.push(rec);
  }
  cache[role] = { key, list }; return list;
}
function canHire(rec) {
  if (rec.nahuel) {
    if (hasNahuel()) { G.toast("Nahuel ya trabaja para vos.", "bad"); return false; }
    if (S().rank < NAHUEL.minRank) { G.toast(`Nahuel solo trabaja para casinos de rango ${NAHUEL.minRank}.`, "bad"); return false; }
  }
  if (!rec.id || rec.id[0] === "c") rec.id = newId();
  return true;
}

// ---------------------------------------------------------------- acciones
function promote(rec) {
  if (!rec || rec.nahuel) return;
  const cap = trainCap();
  if (rec.eff >= cap) { G.toast(`${rec.name} ya llegó al tope que permite tu rango (${cap}).`, "bad"); return; }
  const cost = trainCost(rec); if (!G.Economy.trySpend("wages", cost)) return;
  const before = rankIdx(rec.eff); rec.eff = Math.min(cap, rec.eff + TRAIN_STEP);
  const after = rankIdx(rec.eff), n = G.staffNpcs.find(x => x.rec === rec);
  if (n) { n.effMul = effMul(rec); n.taskMul = taskMul(rec); }
  G.toast(after > before ? `${rec.name} ascendió a ${RANKS[after].name} (eficiencia ${rec.eff}).` : `${rec.name} se capacitó: eficiencia ${rec.eff}.`, "good"); G.sfx("up"); G.save(true);
}
function click(act, id, ds) {
  const ui = G.ui, s = S();
  switch (act) {
    case "hire": {
      const def = sdef(id);
      if (s.rank < def.rank) { G.toast(`Necesitás rango ${def.rank}.`, "bad"); return; }
      if ((s.staff[id] || 0) >= G.staffMax(def)) { G.toast(`Cupo completo: con tu rango podés tener ${G.staffMax(def)}.`, "bad"); return; }
      if (id === "waiter" && !s.bar) { G.toast("Primero comprá la Barra de tragos.", "bad"); return; }
      ui.hireRole = id; return;
    }
    case "hireBack": ui.hireRole = null; return;
    case "reroll": roll++; return;
    case "hirePick": {
      const list = candidates(id), k = +ds.k, rec = list[k]; if (!rec) return;
      if (G.hireStaff(id, rec)) { list.splice(k, 1); if ((s.staff[id] || 0) >= G.staffMax(sdef(id))) ui.hireRole = null; }
      return;
    }
    case "hireNahuel": { const rec = nahuelRec(); rec.fee = NAHUEL.fee; G.hireStaff("tech", rec); return; }
    case "promote": promote((s.crew || []).find(r => r.id === id)); return;
    case "fireRec": { const rec = (s.crew || []).find(r => r.id === id); if (rec) G.fireStaff(rec.role, rec); return; }
    case "fire": G.fireStaff(id); return;
  }
}
function killAll(opts) {
  const s = S(); let n = 0, names = [];
  for (const npc of G.staffNpcs.slice()) {
    if (npc.rec) names.push(npc.rec.name);
    G.releaseNpcTask(npc); G.releasePerson(npc.person); npc.dead = true; n++;
  }
  G.staffNpcs.length = 0;
  for (const t of G.tables) t.staff = null;
  for (const d of G.D.STAFF) s.staff[d.role] = 0;
  s.crew = [];
  const w = s.world && s.world.hotel; if (w && (!opts || opts.hotel !== false)) w.recep = false; // la recepcionista del hotel también
  G.ui.hireRole = null;
  G.assignDealers(); G.updateHud(true); G.save(true);
  return { killed: n, names };
}

// ---------------------------------------------------------------- panel
function bar(eff, css) { return `<span style="display:inline-block;vertical-align:middle;width:70px;height:7px;background:#0b1d16;border-radius:4px;overflow:hidden;margin:0 6px"><i style="display:block;width:${eff}%;height:100%;background:${css}"></i></span>`; }
const tag = rec => { const r = RANKS[rankIdx(rec.eff)]; return `<span style="color:${r.css};font-weight:600">${r.name}</span>`; };
function candidatesHtml(role) {
  const def = sdef(role), s = S(), n = s.staff[role] || 0, max = G.staffMax(def), bank = s.bank;
  const rows = candidates(role).map((c, k) => {
    const w = Math.round(wageOf(c) * G.diff().wages), poor = bank < c.fee;
    return `<div class="item"><span class="sw" style="background:#${def.color.toString(16).padStart(6, "0")}"></span>
      <div class="t"><b>${esc(c.name)} · ${tag(c)}</b><span>Eficiencia ${c.eff}${bar(c.eff, RANKS[rankIdx(c.eff)].css)}· ${fmt(w)} por día · contratación ${fmt(c.fee)}${poor ? " (no te alcanza)" : ""}</span></div>
      <div class="btns"><button data-act="hirePick" data-id="${role}" data-k="${k}" ${poor ? "disabled" : ""}>Contratar</button></div></div>`;
  }).join("") || `<p>No quedan candidatos hoy.</p>`;
  return `<p><b>${def.name}</b> · tenés <b class="num">${n}/${max}</b>. Elegí a quién contratar: mejor eficiencia es más rápido, pero cobra más. Se cobra la contratación (2 días de sueldo) una sola vez.</p>
    <div class="list">${rows}</div><div class="actions"><button class="ghost" data-act="reroll">Buscar otros candidatos</button><button class="ghost" data-act="hireBack">Volver</button></div>`;
}
function panelHtml() {
  const ui = G.ui, s = S();
  if (ui.hireRole && sdef(ui.hireRole)) return candidatesHtml(ui.hireRole);
  ui.hireRole = null;
  let total = 0, totalMax = 0;
  for (const d of G.D.STAFF) if (s.rank >= d.rank) { total += s.staff[d.role] || 0; totalMax += G.staffMax(d); }
  let dealerTables = 0, covered = 0; for (const t of G.tables) if (!t.def.noDealer) { dealerTables++; if (t.staff) covered++; }
  const wagesNow = G.wagesTotal();
  const sections = G.D.STAFF.map(d => {
    const n = s.staff[d.role] || 0, max = G.staffMax(d), locked = s.rank < d.rank, needBar = d.role === "waiter" && !s.bar;
    const nextR = Object.keys(d.maxByRank).map(Number).find(r => r > s.rank);
    const head = `<div class="item${locked ? " locked" : ""}"><span class="sw" style="background:#${d.color.toString(16).padStart(6, "0")}"></span>
      <div class="t"><b>${d.name} · <span class="num">${n}/${locked ? d.maxByRank[d.rank] : max}</span>${locked ? ` · rango ${d.rank}` : ""}</b>
      <span>${d.desc}${needBar && !locked ? " Necesita la Barra." : ""}${!locked && nextR ? ` Rango ${nextR}: hasta ${d.maxByRank[nextR]}.` : ""}${d.role === "dealer" && !locked ? ` Mesas cubiertas ${covered}/${dealerTables}.` : ""}</span></div>
      <div class="btns"><button class="ghost" data-act="fire" data-id="${d.role}" ${n ? "" : "disabled"} title="Despide al de menor eficiencia">Despedir</button><button data-act="hire" data-id="${d.role}" ${locked || n >= max || needBar ? "disabled" : ""}>${n >= max && !locked ? "Cupo lleno" : "Contratar…"}</button></div></div>`;
    const staffRows = recsOf(d.role).map(r => {
      const cap = trainCap(), can = !r.nahuel && r.eff < cap, cost = trainCost(r);
      return `<div class="item" style="margin-left:18px"><span></span>
        <div class="t"><b>${esc(r.name)} · ${tag(r)}${r.nahuel ? " ★" : ""}</b><span>Eficiencia ${r.eff}${bar(r.eff, RANKS[rankIdx(r.eff)].css)}· ${fmt(Math.round(wageOf(r) * G.diff().wages))} por día</span></div>
        <div class="btns">${r.nahuel ? "" : `<button class="ghost sm" data-act="promote" data-id="${r.id}" ${can && s.bank >= cost ? "" : "disabled"} title="Sube ${TRAIN_STEP} de eficiencia">${can ? `Capacitar ${fmt(cost)}` : "En su tope"}</button>`}<button class="ghost sm" data-act="fireRec" data-id="${r.id}">Despedir</button></div></div>`;
    }).join("");
    let extra = "";
    if (d.role === "tech" && !locked) {
      const have = hasNahuel(), lock = s.rank < NAHUEL.minRank;
      extra = have ? "" : `<div class="item${lock ? " locked" : ""}" style="margin-left:18px"><span></span>
        <div class="t"><b>★ ${NAHUEL.name} · <span style="color:#ffd15c">Estrella</span></b><span>Eficiencia 100, repara casi el doble de rápido que un técnico común. Único. ${lock ? `Solo trabaja para casinos de rango ${NAHUEL.minRank}.` : `Contratación ${fmt(NAHUEL.fee)} · ${fmt(Math.round(wageFor("tech", 100, true) * G.diff().wages))} por día.`}</span></div>
        <div class="btns"><button data-act="hireNahuel" data-id="x" ${lock || n >= max || s.bank < NAHUEL.fee ? "disabled" : ""}>Contratar</button></div></div>`;
    }
    return head + staffRows + extra;
  }).join("");
  return `<p>Cupo de personal <b class="num">${total}/${totalMax}</b> · croupiers: ${covered}/${dealerTables} mesas cubiertas · sueldos de hoy <b class="num">${fmt(wagesNow)}</b>. Se pagan a medianoche; despedir no devuelve nada.</p>
    <div class="list">${sections}</div>`;
}

window.CasinoStaff = {
  RANKS, NAHUEL, killAll, align, sanitize, nextRecord, lastOf, defaultRecord, canHire, look, addBadge, effMul, taskMul, repairMul, rankName, roleWages, wageOf,
  click, panelHtml, candidates, nahuelRec, hasNahuel, trainCap, promote,
  get crew() { return S().crew; },
};
if (S() && S().staff) { clean(S()); G.resyncStaff(); } // el guardado ya estaba cargado: se arman las fichas y los empleados con su aspecto
})();
