/* Casino Dorado · combat.js — ARMAS, PELEAS, SANGRE Y LA MAFIA
 * Comprás un arma blanca (cuchillo, bate) o una pistola en la compu de la oficina (pestaña "Armas"), la equipás con F y atacás con el
 * clic izquierdo. Pegarle a una máquina la rompe y el técnico tarda más en arreglarla; pegarle a un cliente lo hace defenderse (te puede
 * noquear: la cámara cae y seguridad viene a ayudarte); un disparo a un cliente deja una mancha de sangre estilizada que se paga limpiar;
 * y si le pegás a Don Aurelio, a las 21:00 la Mafia llega en autos y tirotea el salón: máquinas rotas y personal fuera (hay que recontratar).
 * También peleás a PUÑO LIMPIO (siempre los tenés: F los pone en mano) y el personal se defiende igual que los clientes.
 * ESCÁNDALO: tus piñas y disparos, las peleas entre clientes y el tiroteo de la Mafia lo suben; si llega al tope, alguien llama al 911
 * y cae una patrulla con varios policías que despejan el salón y se llevan detenido a cualquiera que tengan adelante (vos incluido).
 * Ficción estilizada: nadie muere en pantalla, los heridos se caen un rato y se retiran.
 * Se carga después de games.js/clients.js y antes de story.js. Usa window.CasinoCombatBridge (game.js) y los números de D.COMBAT (data.js).
 * Guardado: S.combat = { own, eq, ammo, dmg, stains, mafiaDay, mafiaDone, aurelio, stats } (validado acá, campo por campo).
 * Secciones: BASE · GUARDADO · HUD · ARMA EN MANO · PUNTERÍA · MÁQUINAS · CLIENTES Y PERSONAL · SANGRE · NOQUEADO Y SEGURIDAD · AURELIO Y LA MAFIA ·
 * ESCÁNDALO Y POLICÍA · TIENDA · API.
 */
(() => {
"use strict";

// =====================================================================
// BASE
// =====================================================================
const G = window.CasinoCombatBridge, D = window.CASINO_DATA, A = window.CasinoArt, T = window.THREE;
if (!G || !D || !D.COMBAT || !A || !T) return;
const CB = D.COMBAT, CFG = D.CFG, scene = G.scene, camera = G.camera, player = G.player;
const S = () => G.S;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[(Math.random() * arr.length) | 0];
const fmt = n => G.fmt(n);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const WDEF = id => CB.weapons.find(w => w.id === id) || null;
const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const alive = c => !!(c && !c.dead && c.person);

// =====================================================================
// GUARDADO
// =====================================================================
const checked = new WeakSet();
function clean(raw) {
  raw = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const int = (v, d, lo, hi) => { v = Math.round(+v); return Number.isFinite(v) ? clamp(v, lo, hi) : d; };
  const own = {}; for (const w of CB.weapons) own[w.id] = !!w.free || !!(raw.own && raw.own[w.id]); // los puños vienen de fábrica
  const dmg = {};
  if (raw.dmg && typeof raw.dmg === "object") for (const k of Object.keys(raw.dmg).slice(0, 80)) { const v = +raw.dmg[k]; if (Number.isFinite(v) && v > 0) dmg[String(k).slice(0, 40)] = clamp(v, 0, 8); }
  const stains = [];
  if (Array.isArray(raw.stains)) for (const s of raw.stains.slice(0, CB.blood.max)) {
    if (s && Number.isFinite(+s.x) && Number.isFinite(+s.z)) stains.push({ x: clamp(+s.x, -22, 22), z: clamp(+s.z, -10, 10), cl: !!s.cl });
  }
  const st = raw.stats && typeof raw.stats === "object" ? raw.stats : {};
  return {
    own, eq: typeof raw.eq === "string" && own[raw.eq] ? raw.eq : "", ammo: int(raw.ammo, 0, 0, CB.ammo.max), dmg, stains,
    mafiaDay: int(raw.mafiaDay, 0, 0, 1e6), mafiaDone: int(raw.mafiaDone, 0, 0, 1e6), aurelio: !!raw.aurelio,
    stats: { hits: int(st.hits, 0, 0, 1e6), kos: int(st.kos, 0, 0, 1e6), shots: int(st.shots, 0, 0, 1e6), wounded: int(st.wounded, 0, 0, 1e6), mafia: int(st.mafia, 0, 0, 1e6), jailed: int(st.jailed, 0, 0, 1e6) },
  };
}
function C() {
  const s = S(); if (!s) return clean(null);
  if (!s.combat || !checked.has(s.combat)) { s.combat = clean(s.combat); checked.add(s.combat); }
  return s.combat;
}

// estado transitorio (se rearma al cargar una partida)
const R = {
  s: null, cd: 0, swing: null, flash: 0, hp: CB.player.hp, hurtT: 99, ko: null, koK: 0, resp: null, shake: 0, flashRed: 0, kick: 0,
  stains: [], mf: null, bannerT: 0, hudKey: "", aim: null, jab: 0,
  clock: 0, riot: 0, blame: { player: 0, clientes: 0, mafia: 0 }, lastViolence: -99, riotCool: 0, pol: null, jail: null, riotKey: "",
};
function sync() {
  const s = S(); if (!s) return false;
  if (R.s === s) return true;
  reset(); R.s = s; C(); rebuildStains(); setWeaponModel();
  return true;
}
function reset() {
  for (const st of R.stains) dropStain(st, true); R.stains.length = 0;
  if (R.resp) endResponder(true);
  if (R.mf) endMafia(true);
  if (R.pol) endPolice(true);
  R.ko = null; R.koK = 0; R.hp = CB.player.hp; R.hurtT = 99; R.cd = 0; R.swing = null; R.shake = 0; R.flashRed = 0;
  R.riot = 0; R.blame = { player: 0, clientes: 0, mafia: 0 }; R.lastViolence = -99; R.riotCool = 0; R.jail = null; showJail(0);
  for (const c of G.customers) if (c.cmb) c.cmb = null;
  for (const n of G.staffNpcs) if (n.cmb) n.cmb = null;
  showKo(0); banner(null);
}

// =====================================================================
// HUD
// =====================================================================
const css = document.createElement("style");
css.textContent = `
#cmbHud{position:fixed;left:50%;bottom:74px;transform:translateX(-50%);display:flex;gap:12px;align-items:center;padding:7px 14px;background:rgba(7,20,15,.82);border:1px solid rgba(217,168,74,.45);border-radius:10px;color:#f3e9d2;font:600 13px 'IBM Plex Mono',monospace;z-index:7;pointer-events:none}
#cmbHud[hidden]{display:none}
#cmbHud .hp{width:90px;height:8px;border-radius:5px;background:#2b1a1a;overflow:hidden}
#cmbHud .hp i{display:block;height:100%;background:#d4423f}
#cmbHud kbd{background:#d9a84a;color:#1b1307;border-radius:4px;padding:0 5px;margin-right:4px}
#cmbRed{position:fixed;inset:0;pointer-events:none;z-index:6;background:radial-gradient(ellipse at center,rgba(160,0,0,0) 40%,rgba(160,0,0,.75) 100%);opacity:0}
#cmbKo{position:fixed;inset:0;pointer-events:none;z-index:9;background:radial-gradient(ellipse at center,rgba(0,0,0,.35) 0%,rgba(0,0,0,.92) 100%);opacity:0;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#f3e9d2;font:700 26px 'IBM Plex Mono',monospace;text-align:center}
#cmbKo small{display:block;margin-top:8px;font-size:14px;font-weight:500;opacity:.85}
#cmbBan{position:fixed;left:50%;top:20%;transform:translateX(-50%);z-index:10;pointer-events:none;text-align:center;color:#ffd9d4;font:800 40px 'IBM Plex Mono',monospace;text-shadow:0 0 18px #c01010,0 3px 0 #300;letter-spacing:1px;padding:12px 26px;background:rgba(40,0,0,.78);border:2px solid #c01818;border-radius:10px;animation:cmbShake .12s infinite}
#cmbBan[hidden]{display:none}
#cmbBan small{display:block;font-size:16px;font-weight:600;letter-spacing:0;margin-top:6px;text-shadow:none;color:#f3e9d2}
#cmbRiot{position:fixed;left:50%;bottom:118px;transform:translateX(-50%);display:flex;gap:10px;align-items:center;padding:5px 12px;background:rgba(7,20,15,.82);border:1px solid rgba(217,168,74,.45);border-radius:10px;color:#f3e9d2;font:600 12px 'IBM Plex Mono',monospace;z-index:7;pointer-events:none}
#cmbRiot[hidden]{display:none}
#cmbRiot .bar{width:110px;height:8px;border-radius:5px;background:#1d2530;overflow:hidden}
#cmbRiot .bar i{display:block;height:100%;background:linear-gradient(90deg,#d9a84a,#e0503a)}
#cmbRiot.pol{border-color:#4d7fe0;animation:cmbSiren .5s steps(1) infinite}
@keyframes cmbSiren{0%{box-shadow:0 0 14px #e02a2a}50%{box-shadow:0 0 14px #2a6ae0}}
#cmbJail{position:fixed;inset:0;pointer-events:none;z-index:11;background:#06080c;opacity:0;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#f3e9d2;font:700 28px 'IBM Plex Mono',monospace;text-align:center;background-image:repeating-linear-gradient(90deg,rgba(150,160,175,.0) 0 70px,rgba(150,160,175,.55) 70px 82px)}
#cmbJail small{display:block;margin-top:10px;font-size:15px;font-weight:500;opacity:.9}
@keyframes cmbShake{0%{transform:translate(-50%,0)}25%{transform:translate(-49.7%,1px)}50%{transform:translate(-50.3%,-1px)}75%{transform:translate(-49.8%,1px)}100%{transform:translate(-50%,0)}}`;
document.head.appendChild(css);
const mk = (id, tag) => { const e = document.createElement(tag || "div"); e.id = id; document.body.appendChild(e); return e; };
const hudEl = mk("cmbHud"), redEl = mk("cmbRed"), koEl = mk("cmbKo"), banEl = mk("cmbBan"), riotEl = mk("cmbRiot"), jailEl = mk("cmbJail");
hudEl.hidden = true; banEl.hidden = true; riotEl.hidden = true;
let lastJail = -1;
function showJail(k) {
  k = Math.round(k * 100) / 100; if (k === lastJail) return; lastJail = k;
  jailEl.style.opacity = String(k);
  if (k > 0 && !jailEl.firstChild) jailEl.innerHTML = `¡Te llevaron detenido!<small>Por armar lío en el salón. Multa de ${fmt(CB.police.fine)} y ${CB.police.jailHours} horas en la comisaría.</small>`;
  if (k === 0) jailEl.innerHTML = "";
}
function updateRiotHud() {
  const P = R.pol, v = Math.round(R.riot), show = (v > 2 || !!P) && !G.ui.panel && !R.jail;
  const txt = !P ? (v >= CB.riot.max * 0.7 ? "¡Ojo! Están por llamar a la policía" : "Escándalo") : P.phase === "coming" ? `¡Llamaron al 911! Patrulla en ${Math.max(0, Math.ceil(CB.police.delay - P.t))} s` : P.phase === "leave" ? "La policía se va" : "¡Policía en el casino!";
  const key = show + ":" + v + ":" + txt;
  if (key === R.riotKey) return; R.riotKey = key;
  riotEl.hidden = !show; if (!show) return;
  riotEl.classList.toggle("pol", !!P && P.phase !== "leave");
  riotEl.innerHTML = `<span>${esc(txt)}</span>` + (P ? "" : `<span class="bar"><i style="width:${clamp(v / CB.riot.max * 100, 0, 100).toFixed(0)}%"></i></span>`);
}
let lastKo = -1;
function showKo(k) {
  k = Math.round(k * 100) / 100; if (k === lastKo) return; lastKo = k;
  koEl.style.opacity = String(k);
  if (k > 0) koEl.innerHTML = R.ko && R.ko.woke ? "" : `¡Te noquearon!<small>${R.resp ? "Seguridad viene a ayudarte…" : "Quedaste tirado en el piso…"}</small>`;
}
function banner(text, sub, sec) {
  if (!text) { banEl.hidden = true; R.bannerT = 0; return; }
  banEl.innerHTML = esc(text) + (sub ? `<small>${esc(sub)}</small>` : ""); banEl.hidden = false; R.bannerT = sec || 4;
}
function updateHud() {
  const c = C(), w = WDEF(c.eq), hurt = R.hp < CB.player.hp - 0.5;
  const key = (w ? w.id + ":" + c.ammo : "-") + ":" + Math.round(R.hp) + ":" + (R.ko ? 1 : 0) + ":" + (G.ui.panel ? 1 : 0);
  if (key === R.hudKey) return; R.hudKey = key;
  if ((!w && !hurt) || G.ui.panel) { hudEl.hidden = true; return; }
  hudEl.hidden = false;
  hudEl.innerHTML = (w ? `<span><kbd>${CB.keyLabel}</kbd>${esc(w.name)}</span><span>${w.kind === "ranged" ? `Balas <b>${c.ammo}</b>` : "Clic: atacar"}</span>` : "") +
    `<span>Salud</span><span class="hp"><i style="width:${clamp(R.hp / CB.player.hp * 100, 0, 100).toFixed(0)}%"></i></span>`;
}

// =====================================================================
// ARMA EN MANO (modelo pegado a la cámara) Y EFECTOS COMPARTIDOS
// =====================================================================
const mat = {
  wood: new T.MeshStandardMaterial({ color: 0xc8925a, roughness: 0.5 }), steel: new T.MeshStandardMaterial({ color: 0xcfd6dc, roughness: 0.25, metalness: 0.8 }),
  dark: new T.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.4, metalness: 0.5 }), grip: new T.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.8 }),
  skin: new T.MeshStandardMaterial({ color: 0xe0ac69, roughness: 0.8 }),
  flash: new T.SpriteMaterial({ map: A.canvasTex(64, 64, g => { const r = g.createRadialGradient(32, 32, 2, 32, 32, 30); r.addColorStop(0, "#fff8d0"); r.addColorStop(0.35, "#ffb030"); r.addColorStop(1, "rgba(255,120,0,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }), blending: T.AdditiveBlending, depthWrite: false, transparent: true }),
  spark: new T.SpriteMaterial({ map: A.canvasTex(64, 64, g => { const r = g.createRadialGradient(32, 32, 1, 32, 32, 30); r.addColorStop(0, "#ffffff"); r.addColorStop(0.3, "#ffd070"); r.addColorStop(1, "rgba(255,160,40,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }), blending: T.AdditiveBlending, depthWrite: false, transparent: true }),
};
const vm = new T.Group(); vm.visible = false; vm.scale.setScalar(0.68); camera.add(vm);
const models = {};
{ // cuchillo
  const g = new T.Group();
  const blade = new T.Mesh(new T.BoxGeometry(0.03, 0.24, 0.008), mat.steel); blade.position.y = 0.17; g.add(blade);
  const hdl = new T.Mesh(new T.BoxGeometry(0.034, 0.12, 0.034), mat.dark); hdl.position.y = 0.0; g.add(hdl);
  const hand = new T.Mesh(new T.BoxGeometry(0.075, 0.09, 0.075), mat.skin); hand.position.y = -0.02; g.add(hand);
  models.knife = g;
}
{ // bate
  const g = new T.Group();
  const b = new T.Mesh(new T.CylinderGeometry(0.04, 0.014, 0.82, 10), mat.wood); b.position.y = 0.34; g.add(b);
  const knob = new T.Mesh(new T.SphereGeometry(0.022, 8, 6), mat.wood); knob.position.y = -0.07; g.add(knob);
  const hand = new T.Mesh(new T.BoxGeometry(0.08, 0.1, 0.08), mat.skin); hand.position.y = 0.0; g.add(hand);
  models.bat = g;
}
{ // pistola
  const g = new T.Group();
  const body = new T.Mesh(new T.BoxGeometry(0.05, 0.07, 0.22), mat.dark); body.position.set(0, 0.02, -0.08); g.add(body);
  const barrel = new T.Mesh(new T.BoxGeometry(0.028, 0.028, 0.1), mat.steel); barrel.position.set(0, 0.03, -0.24); g.add(barrel);
  const grip = new T.Mesh(new T.BoxGeometry(0.044, 0.11, 0.05), mat.grip); grip.position.set(0, -0.05, 0.0); grip.rotation.x = 0.2; g.add(grip);
  const hand = new T.Mesh(new T.BoxGeometry(0.07, 0.09, 0.08), mat.skin); hand.position.set(0, -0.06, 0.01); g.add(hand);
  const fl = new T.Sprite(mat.flash); fl.scale.set(0.22, 0.22, 1); fl.position.set(0, 0.03, -0.32); fl.visible = false; g.add(fl); g.userData.flash = fl;
  models.pistol = g;
}
{ // puños: las dos manos, cerradas
  const g = new T.Group();
  for (const sx of [-1, 1]) {
    const f = new T.Group(); f.position.x = sx * 0.16;
    const fist = new T.Mesh(new T.BoxGeometry(0.1, 0.09, 0.11), mat.skin); f.add(fist);
    const knuckles = new T.Mesh(new T.BoxGeometry(0.1, 0.03, 0.03), mat.skin); knuckles.position.set(0, 0.045, -0.04); f.add(knuckles);
    const arm = new T.Mesh(new T.BoxGeometry(0.075, 0.075, 0.24), mat.dark); arm.position.z = 0.16; f.add(arm);
    g.add(f); g.userData[sx < 0 ? "l" : "r"] = f;
  }
  models.fists = g;
}
for (const k in models) { models[k].visible = false; vm.add(models[k]); }
const REST = { fists: { p: [0.02, -0.27, -0.5], r: [0.12, 0, 0] }, knife: { p: [0.26, -0.3, -0.5], r: [-0.55, 0, -0.25] }, bat: { p: [0.3, -0.38, -0.5], r: [-0.45, 0, -0.35] }, pistol: { p: [0.22, -0.2, -0.4], r: [0, 0, 0] } };
function setWeaponModel() {
  const c = C(); for (const k in models) models[k].visible = k === c.eq;
  vm.visible = !!c.eq && !!models[c.eq];
}
// chispas / impactos (pool)
const sparks = [];
for (let i = 0; i < 8; i++) { const s = new T.Sprite(mat.spark); s.visible = false; s.userData.t = 0; scene.add(s); sparks.push(s); }
let sparkI = 0;
function spark(x, y, z, size) {
  const s = sparks[sparkI++ % sparks.length]; s.position.set(x, y, z); s.userData.t = 0.28; s.userData.size = size || 0.5; s.scale.setScalar(s.userData.size); s.visible = true;
}
function updateSparks(dt) { for (const s of sparks) if (s.visible) { s.userData.t -= dt; if (s.userData.t <= 0) s.visible = false; else s.scale.setScalar(s.userData.size * (0.4 + s.userData.t * 3)); } }
function redFlash(a) { R.flashRed = Math.max(R.flashRed, a); }
function shake(a) { R.shake = Math.max(R.shake, a); }

// =====================================================================
// PUNTERÍA: rayo desde el centro de la pantalla contra cilindros (clientes, máquinas, Don Aurelio)
// =====================================================================
const _d = new T.Vector3();
function hitCyl(ox, oy, oz, dx, dy, dz, cx, cz, r, y0, y1) {
  const px = ox - cx, pz = oz - cz, a = dx * dx + dz * dz;
  if (a < 1e-6) return -1;
  const b = px * dx + pz * dz, c = px * px + pz * pz - r * r;
  if (c <= 0) return oy >= y0 && oy <= y1 ? 0 : -1; // el ojo está dentro del cilindro (parado pegado a la máquina)
  const disc = b * b - a * c; if (disc < 0) return -1;
  const s = (-b - Math.sqrt(disc)) / a; if (s < 0) return -1;
  const y = oy + dy * s; return y >= y0 && y <= y1 ? s : -1;
}
const aurelioNpc = () => { const n = window.CasinoStory && window.CasinoStory.debug && window.CasinoStory.debug.npcs && window.CasinoStory.debug.npcs.aurelio; return n && n.group && n.group.parent ? n : null; };
function aim(w) {
  camera.updateMatrixWorld(); camera.getWorldDirection(_d);
  const ox = player.x, oy = 1.65, oz = player.z, dx = _d.x, dy = _d.y, dz = _d.z, melee = w.kind === "melee";
  let best = null;
  const tryHit = (kind, obj, x, z, r, y0, y1) => {
    const s = hitCyl(ox, oy, oz, dx, dy, dz, x, z, r, y0, y1);
    if (s >= 0 && s <= w.range && (!best || s < best.s)) best = { kind, obj, s, x: ox + dx * s, y: oy + dy * s, z: oz + dz * s };
  };
  for (const m of G.machines) if (!m.dead && m.slot) tryHit("machine", m, m.slot.x, m.slot.z, melee ? 0.8 : 0.5, 0, 2.1);
  for (const c of G.customers) if (alive(c) && c.state !== "caught" && !(c.cmb && c.cmb.mode === "cuffed")) tryHit("customer", c, c.x, c.z, melee ? 0.55 : 0.34, 0.05, 1.85);
  for (const n of G.staffNpcs) if (canHitStaff(n)) tryHit("staff", n, n.x, n.z, melee ? 0.55 : 0.34, 0.05, 1.85);
  const au = aurelioNpc(); if (au) tryHit("aurelio", au, au.x, au.z, melee ? 0.6 : 0.36, 0.05, 1.9);
  return best;
}

// =====================================================================
// ATAQUE
// =====================================================================
const equipped = () => WDEF(C().eq);
function click() {
  if (!sync()) return false;
  const w = equipped(); if (!w || R.ko || R.jail) return false;
  if (window.CasinoBuild && window.CasinoBuild.active) return false;
  attack(w); return true;
}
function attack(w) {
  const c = C();
  if (R.cd > 0) return;
  if (w.kind === "ranged" && c.ammo <= 0) { R.cd = 0.35; G.SFX.tick && G.SFX.tick(); G.toast("Sin municiones. Comprá una caja en la compu (pestaña Armas).", "bad"); return; }
  R.cd = w.cd;
  if (w.kind === "melee") { R.swing = { t: 0, dur: Math.min(0.55, w.cd * 0.85) }; R.jab = 1 - R.jab; G.sfx("swing", player.x, player.z); }
  else { c.ammo--; c.stats.shots++; R.swing = { t: 0, dur: 0.18, shot: true }; player.pitch = clamp(player.pitch + 0.025, -1.45, 1.45); G.sfx("shot", player.x, player.z); }
  const hit = aim(w);
  if (hit) {
    if (hit.kind === "machine") hitMachine(hit.obj, w, hit);
    else if (hit.kind === "customer") hitCustomer(hit.obj, w, hit);
    else if (hit.kind === "staff") hitStaff(hit.obj, w, hit);
    else if (hit.kind === "aurelio") hitAurelio(hit.obj, w, hit);
  }
  if (w.kind === "ranged") noise(player.x, player.z);
}
// un disparo se oye: los clientes cercanos se asustan; hacerlo seguido te cuesta reputación y calor
function noise(x, z) {
  G.Heat.add(1.2, "disparo"); violence(CB.riot.playerShot);
  for (const c of G.customers) {
    if (!alive(c) || c.cmb || c.state === "leave" || c.state === "flee" || c.state === "caught") continue;
    const d = dist(c.x, c.z, x, z);
    if (d < 14) { G.setIcon(c.person, "excl"); if (d < 8 && Math.random() < 0.5) panic(c); }
  }
}
function panic(c) { if (!alive(c) || c.cmb) return; G.leaveCustomer(c); if (c.state === "leave") c.state = "flee"; }
function scare(x, z, r, chance) { for (const c of G.customers) if (alive(c) && !c.cmb && c.state !== "leave" && c.state !== "flee" && c.state !== "caught" && dist(c.x, c.z, x, z) < r) { G.setIcon(c.person, "excl"); if (Math.random() < chance) panic(c); } }

// =====================================================================
// MÁQUINAS DAÑADAS
// =====================================================================
function hitMachine(m, w, hit) {
  if (w.id === "fists") { // a mano limpia no se rompe nada: te duele a vos
    spark(hit.x, clamp(hit.y, 0.5, 1.8), hit.z, 0.25); G.sfx("thud", m.slot.x, m.slot.z);
    G.floatText(m.slot.x, 2.2, m.slot.z, "¡AUCH!", "#ffd45a");
    hurtPlayer(CB.fists.machineHurt, null);
    G.hint("cmbFistMachine", "Con la mano no rompés una máquina: te rompés los nudillos. Para eso hace falta un cuchillo o un bate.");
    return;
  }
  const c = C(), id = m.d.slot, add = w.kind === "melee" ? CB.machine.dmgMelee : CB.machine.dmgBullet;
  const was = c.dmg[id] || 0; c.dmg[id] = clamp(was + add, 0, 8);
  c.stats.hits++;
  spark(hit.x, clamp(hit.y, 0.5, 1.8), hit.z, 0.5); G.sfx("break", m.slot.x, m.slot.z) || G.SFX.bad();
  G.floatText(m.slot.x, 2.2, m.slot.z, "¡CRASH!", "#ffd45a");
  if (!m.d.broken) G.breakMachine(m);
  else if (m.claimTech && m.claimTech.state === "work") m.claimTech.t += CB.machine.repairMulPerDmg * add * (m.claimTech.def.taskSec || 12); // el técnico ya estaba arreglándola: se complica
  G.hint("cmbMachine", "Rompiste una máquina a golpes: cuanto más daño, más tarda el técnico en repararla. Y mientras, no factura.");
  G.Rep.change(-0.5); violence(CB.riot.playerMachine);
  shake(0.03);
}
function repairMul(m) { const d = (m && m.d && C().dmg[m.d.slot]) || 0; return clamp(1 + d * CB.machine.repairMulPerDmg, 1, CB.machine.repairMulMax); }
function onRepair(m) { const c = C(); if (m && m.d && c.dmg[m.d.slot]) delete c.dmg[m.d.slot]; }

// =====================================================================
// CLIENTES Y PERSONAL: peleas, noqueados y heridos (los dos se defienden)
// =====================================================================
const isTough = c => c.kind === "staff" ? c.role === "sec" : CB.customer.toughTypes.includes(c.type && c.type.id);
const isStaff = c => c.kind === "staff";
const canHitStaff = n => !!(n && !n.dead && n.person && !n.temp && !n.lifeTask && !n.ownerTask && (!n.cmb || n.cmb.mode === "fight" || n.cmb.mode === "down"));
function takeOver(c, mode) {
  if (isStaff(c)) { // el empleado deja lo que estaba haciendo
    const m = c.target; if (m && m.claimTech === c) { m.claimTech = null; if (m.api && m.api.setDoorOpen) m.api.setDoorOpen(false); }
    c.target = null; c.thief = null; c.path = null;
  } else {
    G.releaseGame(c);
    if (c.shop && window.CasinoShop && window.CasinoShop.onDespawn) { try { window.CasinoShop.onDespawn(c); } catch (e) { /* sin fila */ } c.shop = null; }
    c.state = "cmb"; c.path = null;
    if (c.drink && c.drink.state !== "served") c.drink.state = "missed";
  }
  c.person.api.stand(); G.setBar(c.person, null); G.setIcon(c.person, null);
  const tough = isTough(c), hp = isStaff(c) ? (tough ? CB.staff.secHp : CB.staff.hp) : (tough ? CB.customer.toughHp : CB.customer.hp);
  const hit = isStaff(c) ? (tough ? CB.staff.secHit : CB.staff.hit) : CB.customer.hit * (tough ? 1.25 : 1);
  c.cmb = { mode, t: 0, hp, hit, cd: 0.7, swing: 0, done: false, retarget: 0, gave: 0, dx: 0, dz: 0, fell: 0 };
  return c.cmb;
}
function hitCustomer(c, w, hit) {
  const cs = C(); cs.stats.hits++;
  if (w.kind === "ranged") { shootCustomer(c, hit); return; }
  let k = c.cmb;
  if (!k) {
    k = takeOver(c, "fight");
    G.Rep.change(CB.blood.repMelee); G.Heat.add(CB.blood.heatMelee, "pelea");
    c.person.api.face("angry", 6);
    scare(c.x, c.z, 5, 0.2);
    G.hint("cmbFight", "¡Atacaste a un cliente! Se va a defender. Si te deja sin salud te noquea, y seguridad tiene que venir a rescatarte.");
  }
  punch(c, k, w, hit);
}
function hitStaff(n, w, hit) {
  const cs = C(); cs.stats.hits++;
  let k = n.cmb;
  if (!k) {
    k = takeOver(n, "fight");
    G.Rep.change(CB.blood.repMelee); G.Heat.add(CB.blood.heatMelee, "pelea");
    n.person.api.face("angry", 6);
    G.floatText(n.x, 2.5, n.z, pick(["¡Jefe! ¿Qué le pasa?", "¡Eh, tranquilo!", "¡Me las vas a pagar!"]), "#ffb0a0");
    scare(n.x, n.z, 5, 0.2);
    G.hint("cmbStaff", "Le pegaste a un empleado: se defiende igual que un cliente. Mientras pelea no trabaja.");
  }
  if (w.kind === "ranged") { // un disparo lo tumba: queda un rato en el piso y vuelve a trabajar
    k.mode = "shot"; k.t = 0; k.fell = 0; k.hp = 0;
    const dd = Math.max(0.5, dist(n.x, n.z, player.x, player.z)); k.dx = (n.x - player.x) / dd * 0.25; k.dz = (n.z - player.z) / dd * 0.25;
    cs.stats.wounded++; addBlood(n.x + k.dx * 0.6, n.z + k.dz * 0.6);
    G.floatText(n.x, 2.4, n.z, "¡Ay!", "#ff6a5a"); n.person.api.face("surprised", 4);
    G.Rep.change(CB.blood.repHit); G.Heat.add(CB.blood.heatHit, "disparo"); scare(n.x, n.z, 12, 0.7); redFlash(0.25); shake(0.04);
    return;
  }
  punch(n, k, w, hit);
}
// una piña / cuchillazo / batazo a una persona que ya está peleando
function punch(c, k, w, hit) {
  violence(CB.riot.playerHit);
  if (k.mode === "down" || k.mode === "shot" || k.mode === "carried") { G.sfx("punch", c.x, c.z); return; }
  if (Math.random() < CB.customer.dodge && k.mode === "fight") { G.floatText(c.x, 2.2, c.z, "¡Esquivó!", "#9fd0ff"); return; }
  const dmg = Math.round(w.dmg * rnd(0.85, 1.15));
  k.hp -= dmg; G.sfx("punch", c.x, c.z); spark(hit.x, clamp(hit.y, 0.6, 1.7), hit.z, w.id === "fists" ? 0.25 : 0.35);
  G.floatText(c.x, 2.3, c.z, w.id === "fists" ? pick(["¡PUM!", "¡PAF!", "¡ZAS!"]) + " -" + dmg : "-" + dmg, "#ff8a7a");
  c.person.api.face("surprised", 0.6);
  if (k.hp <= 0) {
    const dd = Math.max(0.5, dist(c.x, c.z, player.x, player.z));
    k.mode = "down"; k.t = 0; k.fell = 0; k.dx = (c.x - player.x) / dd * 0.3; k.dz = (c.z - player.z) / dd * 0.3;
    G.floatText(c.x, 2.6, c.z, "¡K.O.!", "#ffd45a"); c.person.api.face("dizzy", CB.customer.downSec);
    violence(CB.riot.playerKo);
  }
}
function shootCustomer(c, hit) {
  const cs = C();
  let k = c.cmb || takeOver(c, "shot");
  k.mode = "shot"; k.t = 0; k.fell = 0; k.hp = 0;
  const dd = Math.max(0.5, dist(c.x, c.z, player.x, player.z)); k.dx = (c.x - player.x) / dd * 0.25; k.dz = (c.z - player.z) / dd * 0.25;
  cs.stats.wounded++;
  addBlood(c.x + k.dx * 0.6, c.z + k.dz * 0.6);
  G.floatText(c.x, 2.4, c.z, "¡Ay!", "#ff6a5a"); c.person.api.face("surprised", 4); spark(hit.x, clamp(hit.y, 0.7, 1.5), hit.z, 0.4);
  G.Rep.change(CB.blood.repHit); G.Heat.add(CB.blood.heatHit, "disparo");
  scare(c.x, c.z, 12, 0.7);
  redFlash(0.25); shake(0.04);
  G.toast("¡Le disparaste a un cliente! Hay sangre en la alfombra: contratá una limpieza especial.", "bad");
  G.hint("cmbBlood", "La sangre baja el atractivo hasta que se limpie. Miralo en el piso y apretá E para pagar la limpieza especial.");
}
// caída a lo cómico (como el BONK del guardia): rota hacia atrás y queda tirado
function fall(c, k, dt, rise) {
  const g = c.person.group;
  k.fell = Math.min(1, k.fell + dt / 0.38); const u = k.fell * k.fell;
  g.rotation.x = -Math.PI / 2 * Math.min(1.04, rise != null ? rise : u);
  g.position.set(c.x + k.dx * k.fell, 0.11 * Math.min(1, rise != null ? rise : u), c.z + k.dz * k.fell);
  c.person.api.knocked(dt);
}
function standUp(c) { const g = c.person.group; g.rotation.x = 0; g.position.set(c.x, 0, c.z); c.person.api.stand(); }
function actor(c, dt) {
  const k = c.cmb; if (!k) return false;
  if (!alive(c)) { c.cmb = null; return false; }
  k.t += dt;
  const p = c.person, pd = dist(c.x, c.z, player.x, player.z);
  switch (k.mode) {
    case "fight": {
      if (R.ko || R.jail) { k.mode = "loom"; break; }
      if (k.t > (isStaff(c) ? 12 : 28) || pd > 22) { endFight(c); return true; }
      G.faceTo(c, player.x, player.z);
      if (pd > CB.customer.reach) {
        k.retarget -= dt;
        if (k.retarget <= 0 || !c.path || !c.path.length) { k.retarget = 0.5; const a = Math.atan2(player.x - c.x, player.z - c.z); G.goTo(c, player.x - Math.sin(a) * 0.8, player.z - Math.cos(a) * 0.8); }
        G.stepAgent(c, dt, CB.customer.speed * (isTough(c) ? 1.15 : 1));
      } else {
        p.api.idle(dt);
        k.cd -= dt;
        if (k.swing <= 0 && k.cd <= 0) { k.swing = 0.001; k.cd = CB.customer.hitCd; p.api.gesture("swing", 0.55); }
        if (k.swing > 0) {
          k.swing += dt;
          if (k.swing >= 0.3 && !k.done) { k.done = true; if (pd <= CB.customer.reach + 0.4) { hurtPlayer(Math.round(k.hit * rnd(0.85, 1.15)), c); disturb(CB.riot.customerHit, "clientes"); } }
          if (k.swing >= 0.6) { k.swing = 0; k.done = false; }
        }
      }
      break;
    }
    case "loom": // el agresor se queda parado sobre el dueño noqueado, hasta que llega seguridad
      G.faceTo(c, player.x, player.z); p.api.idle(dt);
      if (!R.ko && !R.jail) { endFight(c); return true; }
      break;
    case "down": case "shot": {
      fall(c, k, dt);
      const lim = k.mode === "down" ? CB.customer.downSec : CB.customer.downSec * 0.8;
      if (k.t > lim) { standUp(c); c.cmb = null; endFight(c, k.mode === "shot"); return true; }
      break;
    }
    case "carried": { // el guardia lo bateó: queda en el piso un rato y se va
      fall(c, k, dt);
      if (k.t > CB.customer.downSec) { standUp(c); c.cmb = null; endFight(c, true); return true; }
      break;
    }
    case "cuffed": // esposado: lo lleva un policía (ESCÁNDALO Y POLICÍA)
      if (!k.cop) { p.api.idle(dt); if (k.t > 3) { G.despawnCustomer(c); } }
      break;
  }
  return true;
}
function endFight(c, hurt) {
  c.cmb = null;
  if (!alive(c)) return;
  standUp(c);
  if (isStaff(c)) { c.person.api.face("sad", 6); G.backHome(c); return; } // el empleado vuelve a su puesto
  c.state = "idle"; // leaveCustomer ignora solo leave/flee/caught
  G.leaveCustomer(c);
  if (c.state === "leave") { c.person.api.face("sad", 30); if (hurt) c.speed *= 0.6; else c.state = "flee"; }
}
// el personal peleando (game.js no lo mueve mientras tenga n.cmb)
function updateStaffFights(dt) {
  for (const n of G.staffNpcs) if (n.cmb && n.cmb.hp != null && !n.cmb.r && !n.cmb.mfFall) actor(n, dt);
}
function onDespawn(c) { if (c && c.cmb) c.cmb = null; }
function hurtPlayer(d, from) {
  if (R.ko || R.jail) return;
  R.hp = Math.max(0, R.hp - d); R.hurtT = 0;
  redFlash(0.55); shake(0.05); G.sfx("punch", player.x, player.z);
  player.pitch = clamp(player.pitch + 0.06, -1.45, 1.45);
  if (R.hp <= 0) startKO(from);
}

// =====================================================================
// SANGRE ESTILIZADA Y LIMPIEZA ESPECIAL
// =====================================================================
const bloodMat = new T.MeshBasicMaterial({
  map: A.canvasTex(128, 128, g => {
    g.clearRect(0, 0, 128, 128);
    for (let i = 0; i < 7; i++) { g.fillStyle = i % 2 ? "#7a0d12" : "#9a1218"; g.globalAlpha = 0.9; g.beginPath(); g.arc(64 + rnd(-22, 22), 64 + rnd(-22, 22), rnd(14, 30), 0, 7); g.fill(); }
    g.fillStyle = "#5e0a0e"; g.globalAlpha = 0.95;
    for (let i = 0; i < 10; i++) { const a = rnd(0, 6.3), r = rnd(34, 58); g.beginPath(); g.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, rnd(2, 6), 0, 7); g.fill(); }
    g.globalAlpha = 1;
  }),
  transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3,
});
const bloodGeo = new T.CircleGeometry(0.62, 18); bloodGeo.rotateX(-Math.PI / 2);
function addBlood(x, z, saved) {
  const cs = C();
  if (R.stains.length >= CB.blood.max) { const old = R.stains.shift(); dropStain(old, false); }
  const grp = new T.Group(); grp.position.set(x, 0.017 + R.stains.length * 0.0012, z); grp.rotation.y = Math.random() * 6.3;
  const m = new T.Mesh(bloodGeo, bloodMat); m.scale.setScalar(rnd(0.9, 1.25)); grp.add(m); scene.add(grp);
  const st = { x, z, grp, cl: !!(saved && saved.cl), t: 0 };
  st.proxy = G.proxy(grp, 1.1, 0.3, 1.1, {
    prompt: () => st.cl ? { text: "Limpieza especial en camino", sub: "Ya están sacando la sangre de la alfombra" } : { text: `Contratar limpieza especial · ${fmt(CB.blood.cleanCost)}`, sub: `Sangre en la alfombra · baja ${CB.blood.atr} de atractivo hasta que se limpie` },
    hold: () => 0, usable: () => !st.cl, use: () => cleanStain(st),
  }, 0.15);
  R.stains.push(st);
  syncStains();
  if (!saved) G.sfx("spill", x, z);
  return st;
}
function cleanStain(st) {
  if (st.cl) return;
  if (!G.Economy.trySpend("cleaning", CB.blood.cleanCost)) return;
  st.cl = true; st.t = 0; syncStains();
  G.toast("Llamaste a limpieza especial. Terminan en unos segundos.", "good"); G.floatText(st.x, 1.3, st.z, "Limpieza en camino", "#9fd0ff");
  G.updateHud(true); G.save(true);
}
function dropStain(st, silent) { if (st.grp.parent) scene.remove(st.grp); if (st.proxy) G.dropProxy(st.proxy); st.gone = true; if (!silent) { const i = R.stains.indexOf(st); if (i >= 0) R.stains.splice(i, 1); syncStains(); } }
function syncStains() { C().stains = R.stains.filter(s => !s.gone).map(s => ({ x: +s.x.toFixed(2), z: +s.z.toFixed(2), cl: s.cl })); }
function rebuildStains() { for (const s of C().stains.slice()) addBlood(s.x, s.z, s); }
const atrPenalty = () => R.stains.length * CB.blood.atr;

// =====================================================================
// NOQUEADO Y SEGURIDAD PRIVADA
// =====================================================================
const ko = () => !!(R.ko || R.jail); // noqueado o detenido: no te movés
function startKO(from) {
  const cs = C(); cs.stats.kos++;
  R.ko = { t: 0, aggr: from, woke: false, called: false };
  for (const c of G.customers.concat(G.staffNpcs)) if (c.cmb && c.cmb.mode === "fight") { c.cmb.mode = "loom"; }
  showKo(R.koK); shake(0.07); redFlash(0.7);
  G.toast("¡Te noquearon! Quedaste tirado en el piso.", "bad");
  G.Rep.change(-4);
}
function callSecurity() {
  const ko_ = R.ko; ko_.called = true; lastKo = -1; // vuelve a escribir el cartel
  let n = null, bd = Infinity;
  for (const s of G.staffNpcs) if (s.role === "sec" && !s.dead && !s.cmb && !s.lifeTask && s.person) { const d = dist(s.x, s.z, player.x, player.z); if (d < bd) { bd = d; n = s; } }
  let temp = false;
  if (!n) { // sin guardia contratado: llega ayuda igual desde la calle
    temp = true;
    const p = G.acquirePerson("staff_sec", 7, { uniform: "security", skin: 0xc68642, hair: 0x1a1008, female: false });
    n = { kind: "staff", role: "sec", person: p, x: G.DOOR.x + 0.4, z: -12.5, path: null, state: "cmb", temp: true };
    p.agent = n; G.placeAgent(n, n.x, n.z);
  }
  n.cmb = { r: true }; G.setBar(n.person, null);
  R.resp = { n, temp, state: "run", t: 0, retarget: 0, hitT: 0 };
  G.toast(temp ? "Llegó seguridad privada a ayudarte." : "Tu guardia corre a ayudarte.", "good");
  G.floatText(player.x, 2.2, player.z, "¡Seguridad!", "#9fd0ff");
  G.sfx("alarm", player.x, player.z);
}
function updateResponder(dt) {
  const r = R.resp; if (!r) return;
  const n = r.n, p = n.person; r.t += dt;
  if (!p) { R.resp = null; return; }
  const aggr = R.ko && R.ko.aggr && alive(R.ko.aggr) && R.ko.aggr.cmb ? R.ko.aggr : null;
  switch (r.state) {
    case "run": {
      const tx = aggr ? aggr.x : player.x, tz = aggr ? aggr.z : player.z;
      r.retarget -= dt; if (r.retarget <= 0 || !n.path || !n.path.length) { r.retarget = 0.5; G.goTo(n, tx, tz); }
      G.stepAgent(n, dt, CB.security.runSpeed);
      if (dist(n.x, n.z, tx, tz) < 1.5 || r.t > 9) {
        n.path = null; G.faceTo(n, tx, tz);
        if (p.bat) p.bat.visible = true;
        p.api.gesture("swing", CB.security.swingSec); r.state = "hit"; r.hitT = 0;
      }
      break;
    }
    case "hit": {
      r.hitT += dt; p.api.idle(dt);
      if (r.hitT >= CB.security.swingSec * 0.52 && !r.hit) {
        r.hit = true;
        if (aggr) { const k = aggr.cmb; k.mode = "carried"; k.t = 0; k.fell = 0; const a = Math.atan2(aggr.x - n.x, aggr.z - n.z); k.dx = Math.sin(a) * 0.3; k.dz = Math.cos(a) * 0.3; aggr.person.api.face("dizzy", 3); G.floatText(aggr.x, 2.4, aggr.z, "¡BONK!", "#ffd45a"); G.sfx("punch", aggr.x, aggr.z); G.sfx("thud", aggr.x, aggr.z); }
      }
      if (r.hitT >= CB.security.swingSec + 0.4) { if (p.bat) p.bat.visible = false; r.state = "guard"; r.t = 0; }
      break;
    }
    case "guard": { // se queda al lado del dueño hasta que se despierta
      G.faceTo(n, player.x, player.z); p.api.idle(dt);
      if (!R.ko) { r.state = "leave"; r.t = 0; if (r.temp) G.goTo(n, G.DOOR.x, -9); else G.backHome(n); }
      break;
    }
    case "leave": {
      if (!r.temp) { endResponder(false); break; }
      if (G.stepAgent(n, dt, 3.2) || r.t > 8) { if (n.z > -10.5) { G.goTo(n, G.DOOR.x + 0.4, -13); r.t = 4; } else endResponder(false); }
      break;
    }
  }
}
function endResponder(silent) {
  const r = R.resp; if (!r) return; R.resp = null;
  const n = r.n;
  if (r.temp) { if (n.person) G.releasePerson(n.person); n.dead = true; }
  else { n.cmb = null; if (!silent) G.backHome(n); if (n.person && n.person.bat) n.person.bat.visible = false; }
}
function updateKO(dt) {
  const k = R.ko; if (!k) return;
  k.t += dt;
  if (!k.called && k.t >= CB.security.helpDelay) callSecurity();
  const doneHelp = R.resp && (R.resp.state === "guard" || R.resp.state === "leave");
  if (k.t >= CB.player.koSec && (doneHelp || k.t >= CB.player.koSec + 8)) wake();
}
function wake() {
  const k = R.ko; if (!k) return;
  k.woke = true; R.ko = null; R.hp = CB.player.koHpBack; R.hurtT = 0;
  const lost = Math.floor((S().pocket || 0) * CB.player.koPocketLoss);
  if (lost > 0) { S().pocket -= lost; }
  G.toast(`Te despertaste. Seguridad se ocupó del agresor.${lost > 0 ? ` Se te cayeron ${fmt(lost)} del bolsillo.` : ""}`, lost > 0 ? "bad" : "good");
  for (const c of G.customers.concat(G.staffNpcs)) if (c.cmb && c.cmb.mode === "loom") endFight(c);
  G.updateHud(true); G.save(true);
}

// =====================================================================
// DON AURELIO Y LA MAFIA
// =====================================================================
function hitAurelio(n, w) {
  const c = C();
  c.aurelio = true;
  c.mafiaDay = S().minutes < CB.mafia.hour * 60 ? S().day : S().day + 1;
  banner(CB.mafia.speak, `Don Aurelio hizo una llamada: a las ${CB.mafia.hour}:00 ${c.mafiaDay === S().day ? "de hoy" : "de mañana"} vienen por vos.`, 5);
  G.sfx("alarm", n.x, n.z); redFlash(0.4); shake(0.05);
  G.floatText(n.x, 2.3, n.z, "¡Ay!", "#ffd45a"); n.api.face && n.api.face("angry", 5);
  G.Heat.add(8, "mafia"); G.Rep.change(-3); violence(CB.riot.playerHit);
  const fl = window.CasinoStory && window.CasinoStory.flags; if (fl) fl.aurelioMad = true;
  n.mode = "linger"; n.linger = 0.5; // se va del local
  G.save(true);
}
// --- autos, pistoleros y el tiroteo -----------------------------------
const carMat = {
  body: new T.MeshStandardMaterial({ color: 0x272a33, roughness: 0.3, metalness: 0.6 }), glass: new T.MeshStandardMaterial({ color: 0x2a3b50, roughness: 0.1, metalness: 0.8 }),
  tire: new T.MeshStandardMaterial({ color: 0x08080a, roughness: 0.9 }), chrome: new T.MeshStandardMaterial({ color: 0xc9ced4, roughness: 0.2, metalness: 0.9 }),
  head: new T.MeshBasicMaterial({ color: 0xfff1c2 }), tail: new T.MeshBasicMaterial({ color: 0xff2a1a }),
};
const geo = { body: new T.BoxGeometry(4.4, 0.62, 1.85), cab: new T.BoxGeometry(2.2, 0.55, 1.65), wheel: new T.CylinderGeometry(0.36, 0.36, 0.24, 14), lamp: new T.BoxGeometry(0.06, 0.16, 0.34), bar: new T.BoxGeometry(0.1, 0.12, 1.7) };
function makeCar() {
  const g = new T.Group();
  const b = new T.Mesh(geo.body, carMat.body); b.position.y = 0.62; g.add(b);
  const c = new T.Mesh(geo.cab, carMat.glass); c.position.set(-0.2, 1.17, 0); g.add(c);
  for (const [x, z] of [[1.4, 0.92], [1.4, -0.92], [-1.4, 0.92], [-1.4, -0.92]]) { const w = new T.Mesh(geo.wheel, carMat.tire); w.rotation.x = Math.PI / 2; w.position.set(x, 0.36, z); g.add(w); }
  for (const z of [-0.65, 0.65]) { const l = new T.Mesh(geo.lamp, carMat.head); l.position.set(2.2, 0.68, z); g.add(l); const t = new T.Mesh(geo.lamp, carMat.tail); t.position.set(-2.2, 0.68, z); g.add(t); }
  const bar = new T.Mesh(geo.bar, carMat.chrome); bar.position.set(2.24, 0.42, 0); g.add(bar);
  return g;
}
const gunGeo = new T.BoxGeometry(0.05, 0.07, 0.34);
function dressGunman(p) {
  if (p.cmbGun) { p.cmbGun.visible = true; return; } // persona reciclada (a lo mejor la policía le había sacado el arma)
  const J = p.api.joints, gun = new T.Mesh(gunGeo, mat.dark); gun.position.set(0, -0.3, -0.12); J.elbowR.add(gun);
  const fl = new T.Sprite(mat.flash); fl.scale.set(0.5, 0.5, 1); fl.position.set(0, -0.3, -0.42); fl.visible = false; J.elbowR.add(fl);
  p.cmbGun = gun; p.cmbFlash = fl;
}
const MF_SPOTS = [[-5, -4], [5, -4], [-9.5, 0.5], [9.5, 0.5], [-3, 3.5], [3, 3.5], [0, -1.5], [-12, -2]];
function startMafia() {
  const cs = C(), M = CB.mafia;
  cs.mafiaDone = S().day; cs.mafiaDay = 0; cs.stats.mafia++;
  const mf = R.mf = { t: 0, phase: "arrive", cars: [], men: [], shootT: 0, nextShot: 0.3, nextBreak: 0.4, machList: [], killT: -1, killed: false, sweep: 0 };
  banner("¡LA MAFIA ESTÁ ACÁ!", "Autos negros frente al casino…", 4);
  disturb(CB.riot.mafiaArrive, "mafia");
  G.sfx("horn", 0, -16); G.sfx("alarm", 0, -12);
  for (let i = 0; i < M.cars; i++) {
    const g = makeCar(); const px = -9 + i * 9; g.position.set(-48, 0, -18.3 - (i % 2) * 0.1); scene.add(g);
    mf.cars.push({ g, x0: -48 - i * 6, x1: px, delay: i * 0.5, state: "in", t: 0 });
  }
  for (let i = 0; i < M.gunmen; i++) {
    const p = G.acquirePerson("mafia", i, { vip: true, jacket: 0x0c0c10, pants: 0x0c0c10, skin: [0xe0ac69, 0xc68642, 0xf1c27d][i % 3], hair: 0x101010, height: 1.0 + (i % 3) * 0.02 });
    dressGunman(p);
    const man = { kind: "mafia", person: p, x: 0, z: 0, path: null, state: "wait", car: i % M.cars, spot: MF_SPOTS[i % MF_SPOTS.length], t: 0, flash: 0 };
    p.agent = man; p.group.visible = false; G.placeAgent(man, -9 + (i % M.cars) * 9, -16.4);
    mf.men.push(man);
  }
  // los clientes huyen y no entran más
  for (const c of G.customers) if (alive(c)) { if (c.cmb) { standUp(c); c.cmb = null; } panic(c); }
  G.toast("Clientes: ¡se escapan todos!", "bad");
}
function updateMafia(dt) {
  const mf = R.mf, M = CB.mafia; if (!mf) return;
  mf.t += dt;
  // autos
  for (const car of mf.cars) {
    car.t += dt; const u = clamp((car.t - car.delay) / 4.2, 0, 1);
    if (car.state === "in") { const e = 1 - Math.pow(1 - u, 2.2); car.g.position.x = car.x0 + (car.x1 - car.x0) * e; }
    else if (car.state === "out") { const e = clamp((car.t - car.delay) / 3.6, 0, 1); car.g.position.x = car.x1 + e * e * 58; }
  }
  // los que llegan después de que la Mafia entró se van enseguida
  mf.sweep -= dt;
  if (mf.sweep <= 0) { mf.sweep = 0.6; for (const c of G.customers) if (alive(c) && !c.cmb && c.state !== "leave" && c.state !== "flee" && c.state !== "caught") panic(c); }
  // pistoleros
  for (const man of mf.men) {
    const p = man.person; if (!p || man.state === "cuffed" || man.state === "gone") continue; // la policía se los llevó
    man.t += dt;
    if (man.flash > 0) { man.flash -= dt; if (man.flash <= 0 && p.cmbFlash) p.cmbFlash.visible = false; }
    if (man.state === "wait") { if (mf.t > 4.4 + man.car * 0.5) { man.state = "go"; p.group.visible = true; G.placeAgent(man, man.x, man.z); G.goTo(man, G.DOOR.x, -11); man.stage = 0; } }
    else if (man.state === "go") {
      if (G.stepAgent(man, dt, 3.6)) {
        if (man.stage === 0) { man.stage = 1; G.goTo(man, man.spot[0], man.spot[1]); } else { man.state = "shoot"; man.t = 0; }
      }
    } else if (man.state === "shoot") { p.api.idle(dt); p.api.joints.armR.rotation.x = -1.45; p.api.joints.elbowR.rotation.x = -0.1; G.faceTo(man, man.spot[0] + Math.sin(man.t * 1.3) * 6, man.spot[1] + 5 + Math.cos(man.t) * 3); }
    else if (man.state === "back") {
      if (G.stepAgent(man, dt, 4.2)) { p.group.visible = false; man.state = "gone"; }
    }
  }
  if (mf.phase === "arrive") {
    const inside = mf.men.filter(m => m.state === "shoot").length;
    if (mf.t > 7 + 1.2 && (inside >= Math.ceil(mf.men.length / 2) || mf.t > 11)) { mf.phase = "shoot"; mf.shootT = 0; startShooting(mf); }
  } else if (mf.phase === "shoot") {
    mf.shootT += dt;
    disturb(CB.riot.mafiaPerSec * dt, "mafia");
    if (!mf.men.some(m => m.state === "shoot" || m.state === "go" || m.state === "wait")) { // la policía se llevó a todos: se cortó el tiroteo
      mf.phase = "leave"; mf.leaveT = 0; mf.cut = true; for (const car of mf.cars) car.state = "wait";
      if (mf.killed && !mf.removed) { mf.removed = true; killStaff(); } // el personal que ya había caído no se salva
      banner("¡La policía cortó el tiroteo!", "Se llevaron a los pistoleros de la Mafia.", 5);
      return;
    }
    mf.nextShot -= dt;
    if (mf.nextShot <= 0) {
      mf.nextShot = rnd(0.1, 0.28);
      const shooters = mf.men.filter(m => m.state === "shoot"); const m = shooters.length ? pick(shooters) : null;
      if (m && m.person.cmbFlash) { m.person.cmbFlash.visible = true; m.flash = 0.06; G.sfx("shot", m.x, m.z); }
      shake(0.045); if (Math.random() < 0.3) redFlash(0.18);
    }
    mf.nextBreak -= dt;
    if (mf.nextBreak <= 0 && mf.machList.length) {
      mf.nextBreak = Math.max(0.08, M.shootSec * 0.6 / Math.max(1, mf.total));
      const m = mf.machList.shift();
      if (m && !m.dead) { const cs = C(); cs.dmg[m.d.slot] = clamp((cs.dmg[m.d.slot] || 0) + 2, 0, 8); spark(m.slot.x, 1.2, m.slot.z, 0.7); G.sfx("break", m.slot.x, m.slot.z); if (!m.d.broken) G.breakMachine(m); }
    }
    if (!mf.killed && mf.shootT > M.shootSec * 0.45) { // el personal cae
      mf.killed = true; mf.killT = 0;
      for (const n of G.staffNpcs) if (!n.dead) { n.cmb = { mfFall: true, t: 0, fell: 0 }; G.setBar(n.person, null); G.setIcon(n.person, "excl"); }
      G.toast("¡El personal cae al piso!", "bad");
    }
    if (mf.killed) { mf.killT += dt; if (mf.killT > 2.4 && !mf.removed) { mf.removed = true; killStaff(); } }
    if (mf.shootT > M.shootSec) { mf.phase = "leave"; mf.leaveT = 0; for (const man of mf.men) if (man.state === "shoot") { man.state = "back"; G.goTo(man, G.DOOR.x, -11); man.stage = 0; } for (const car of mf.cars) { car.state = "wait"; } }
  } else if (mf.phase === "leave") {
    mf.leaveT += dt;
    for (const car of mf.cars) if (car.state === "wait" && mf.men.every(m => m.state === "gone" || m.car !== mf.cars.indexOf(car) || mf.leaveT > 6)) { car.state = "out"; car.t = 0; car.delay = mf.cars.indexOf(car) * 0.4; G.sfx("horn", car.g.position.x, -17); }
    if (mf.cars.every(c => c.state === "out" && c.t > 4.5) && mf.leaveT > 3) endMafia(false);
  }
}
function startShooting(mf) {
  const list = G.machines.filter(m => !m.dead && m.slot);
  for (let i = list.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [list[i], list[j]] = [list[j], list[i]]; }
  mf.machList = list; mf.total = list.length;
  banner("¡TIROTEO!", "Tirate al piso: la Mafia dispara contra todo.", 5);
  redFlash(0.6); shake(0.08);
}
function killStaff() {
  const ks = window.CasinoStaff && window.CasinoStaff.killAll;
  if (typeof ks === "function") { try { ks.call(window.CasinoStaff); } catch (e) { console.error(e); } }
  else {
    const s = S();
    for (const st of D.STAFF) while (typeof s.staff[st.role] === "number" && s.staff[st.role] > 0) { s.staff[st.role]--; G.fireNpc(st.role); }
  }
  for (const n of G.staffNpcs) if (n.cmb && n.cmb.mfFall && !n.dead) n.cmb = null; // si quedó alguien, que no quede congelado
  G.assignDealers();
}
function endMafia(silent) {
  const mf = R.mf; if (!mf) return; R.mf = null;
  for (const car of mf.cars) scene.remove(car.g);
  for (const man of mf.men) { if (man.person && man.state !== "cuffed") { if (man.person.cmbFlash) man.person.cmbFlash.visible = false; G.releasePerson(man.person); man.person = null; } } // a los esposados los suelta la policía
  if (silent) return;
  const M = CB.mafia;
  G.Rep.change(M.rep); G.Heat.add(M.heat, "mafia");
  if (mf.cut && !mf.killed) { G.toast("La policía cortó el tiroteo a tiempo: el personal se salvó, pero hay máquinas para reparar.", "good"); banner("La Mafia se fue", "La policía llegó a tiempo: tu personal sigue entero.", 5); }
  else {
    G.toast("La Mafia se fue. Máquinas destrozadas y todo el personal fuera: hay que contratar de nuevo.", "bad");
    banner("La Mafia se fue", "Reparaciones largas y personal nuevo: hay que recontratar.", 5);
  }
  G.updateHud(true); G.save(true);
}
// el personal caído en el tiroteo
function updateMafiaStaff(dt) {
  if (!R.mf) return;
  for (const n of G.staffNpcs) {
    const k = n.cmb; if (!k || !k.mfFall || !n.person) continue;
    k.t += dt; k.fell = Math.min(1, k.fell + dt / 0.5); const g = n.person.group;
    g.rotation.x = -Math.PI / 2 * k.fell; g.position.set(n.x, 0.11 * k.fell, n.z);
  }
}
function checkMafia() {
  const cs = C(), s = S();
  if (R.mf || !cs.mafiaDay || s.dayOver || s.gameOver) return;
  if (s.day > cs.mafiaDay || (s.day === cs.mafiaDay && s.minutes >= CB.mafia.hour * 60)) startMafia();
}

// =====================================================================
// ESCÁNDALO Y POLICÍA: si el lío llega al tope, cae una patrulla que despeja el salón y se lleva a cualquiera que tenga adelante
// =====================================================================
const RB = CB.riot, PB = CB.police;
function disturb(n, src) {
  if (!(n > 0) || !S() || R.jail) return;
  R.riot = clamp(R.riot + n, 0, RB.max);
  if (!(src in R.blame)) src = "clientes";
  R.blame[src] += n;
  if (R.riot >= RB.max && !R.pol && (R.riotCool <= 0 || src === "mafia") && !S().dayOver && !S().gameOver) callPolice();
}
function violence(n) { R.lastViolence = R.clock; disturb(n, "player"); } // lo que hacés vos: además te vuelve sospechoso
const wanted = () => R.clock - R.lastViolence < RB.blameRecentSec;
function decayRiot(dt) {
  if (R.riotCool > 0) R.riotCool -= dt;
  if (R.riot <= 0 || (R.pol && R.pol.phase !== "leave")) return;
  const before = R.riot; R.riot = Math.max(0, R.riot - RB.decayPerSec * dt);
  const k = R.riot / before; for (const key in R.blame) R.blame[key] *= k;
}
function culprit() { const b = R.blame; return b.mafia >= b.player && b.mafia >= b.clientes ? "mafia" : b.player >= b.clientes ? "player" : "clientes"; }
// --- patrulleros ---------------------------------------------------------
const polMat = {
  body: new T.MeshStandardMaterial({ color: 0xe9edf2, roughness: 0.35, metalness: 0.3 }), stripe: new T.MeshStandardMaterial({ color: 0x1f4fa8, roughness: 0.4 }),
  red: new T.MeshBasicMaterial({ color: 0xff2020 }), blue: new T.MeshBasicMaterial({ color: 0x2060ff }), // sin luces de verdad: solo color (máx 8 luces)
};
const polGeo = { stripe: new T.BoxGeometry(4.42, 0.14, 1.87), light: new T.BoxGeometry(0.3, 0.14, 0.5) };
function makePatrol() {
  const g = new T.Group();
  const b = new T.Mesh(geo.body, polMat.body); b.position.y = 0.62; g.add(b);
  const st = new T.Mesh(polGeo.stripe, polMat.stripe); st.position.y = 0.66; g.add(st);
  const c = new T.Mesh(geo.cab, carMat.glass); c.position.set(-0.2, 1.17, 0); g.add(c);
  for (const [x, z] of [[1.4, 0.92], [1.4, -0.92], [-1.4, 0.92], [-1.4, -0.92]]) { const w = new T.Mesh(geo.wheel, carMat.tire); w.rotation.x = Math.PI / 2; w.position.set(x, 0.36, z); g.add(w); }
  for (const z of [-0.65, 0.65]) { const l = new T.Mesh(geo.lamp, carMat.head); l.position.set(2.2, 0.68, z); g.add(l); const t = new T.Mesh(geo.lamp, carMat.tail); t.position.set(-2.2, 0.68, z); g.add(t); }
  const lr = new T.Mesh(polGeo.light, polMat.red); lr.position.set(-0.2, 1.51, -0.3); g.add(lr);
  const lb = new T.Mesh(polGeo.light, polMat.blue); lb.position.set(-0.2, 1.51, 0.3); g.add(lb);
  return g;
}
const POL_LOOKS = [{ skin: 0xc68642, hair: 0x1a1008 }, { skin: 0xf1c27d, hair: 0x2a1a10, female: true }, { skin: 0xe0ac69, hair: 0x101010 }, { skin: 0x8d5524, hair: 0x101010 }, { skin: 0xffdbac, hair: 0x5a3a1a, female: true }, { skin: 0xc68642, hair: 0x101010 }];
function callPolice() {
  const who = culprit();
  R.pol = { phase: "coming", t: 0, st: 0, cars: [], cops: [], sirenT: 0, scareT: 0, arrests: 0, who, wantPlayer: false, entered: false };
  const why = who === "mafia" ? "Los vecinos escucharon el tiroteo de la Mafia." : who === "player" ? "Alguien te vio repartiendo piñas en el salón." : "Las peleas de los clientes se escucharon desde la calle.";
  banner("¡Llamaron a la policía!", why + ` La patrulla llega en ${PB.delay} segundos.`, 4);
  G.toast("¡Llamaron al 911! Viene una patrulla: van a llevarse detenido a cualquiera que tengan adelante. Si estuviste peleando, te buscan a vos también.", "bad");
  G.hint("cmbPolice", "Cuando hay mucho escándalo (peleas, disparos, la Mafia) cae la policía. Despejan el salón y se llevan a quien se les cruce: correte de su camino.");
  G.sfx("alarm", G.DOOR.x, G.DOOR.z);
}
function startPatrol() {
  const P = R.pol; P.phase = "arrive"; P.t = 0;
  for (let i = 0; i < PB.cars; i++) {
    const g = makePatrol(); g.rotation.y = Math.PI; const x1 = 15 + i * 7; g.position.set(52 + i * 6, 0, -18.3); scene.add(g);
    P.cars.push({ g, x0: 52 + i * 6, x1, delay: i * 0.4, state: "in", t: 0 });
  }
  for (let i = 0; i < PB.officers; i++) {
    const lk = POL_LOOKS[i % POL_LOOKS.length], car = i % PB.cars;
    const p = G.acquirePerson("police", i, { uniform: "police", skin: lk.skin, hair: lk.hair, female: !!lk.female });
    const cop = { kind: "police", person: p, x: 0, z: 0, path: null, state: "wait", car, t: 0, tgt: null, pris: [], re: 0, roam: null, roamT: 0 };
    p.agent = cop; p.group.visible = false; G.placeAgent(cop, 15 + car * 7 - 1 + (i >> 1) * 1.2, -16.4);
    P.cops.push(cop);
  }
  G.sfx("horn", 20, -17);
}
// ¿a quién buscan? primero a los que pelean (vos incluido si pegaste hace poco), después patrullan
function targets(P) {
  const out = [];
  if (!R.jail && (P.wantPlayer || wanted())) out.push({ kind: "player", obj: player, x: player.x, z: player.z });
  for (const c of G.customers) {
    if (!alive(c) || (c.cmb && c.cmb.mode === "cuffed")) continue;
    const fighting = (c.cmb && (c.cmb.mode === "fight" || c.cmb.mode === "loom")) || (c.life && c.life.role === "fighter" && c.life.e && !c.life.e.done);
    if (fighting) out.push({ kind: "customer", obj: c, x: c.x, z: c.z });
  }
  if (R.mf) for (const m of R.mf.men) if (m.person && m.person.group.visible && (m.state === "go" || m.state === "shoot")) out.push({ kind: "mafia", obj: m, x: m.x, z: m.z });
  for (const n of G.staffNpcs) if (n.cmb && n.cmb.mode === "fight" && n.person) out.push({ kind: "staff", obj: n, x: n.x, z: n.z });
  return out;
}
function pickTarget(P, cop) {
  const taken = new Set(P.cops.filter(o => o !== cop && o.tgt).map(o => o.tgt.obj));
  let best = null, bd = Infinity;
  for (const t of targets(P)) {
    if (taken.has(t.obj) && t.kind !== "player") continue;
    const d = dist(cop.x, cop.z, t.x, t.z) * (t.kind === "player" ? 0.6 : 1); // al dueño lo buscan con ganas
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}
const ahead = (cop, x, z) => { const ry = cop.person.group.rotation.y, d = Math.max(0.01, dist(cop.x, cop.z, x, z)); return (Math.sin(ry) * (x - cop.x) + Math.cos(ry) * (z - cop.z)) / d > 0.2; };
function arrest(cop, t) {
  const P = R.pol;
  if (t.kind === "player") { arrestPlayer(cop); return; }
  if (t.kind === "staff") { const n = t.obj; G.floatText(n.x, 2.4, n.z, "¡Quieto ahí!", "#9fc4ff"); endFight(n); return; } // al empleado lo calman y vuelve a trabajar
  if (t.kind === "mafia") {
    const m = t.obj; m.state = "cuffed"; m.path = null;
    if (m.person.cmbFlash) m.person.cmbFlash.visible = false; if (m.person.cmbGun) m.person.cmbGun.visible = false;
    m.person.api.stand(); G.floatText(m.x, 2.4, m.z, "¡Detenido!", "#9fc4ff");
  } else {
    const c = t.obj;
    if (c.life && window.CasinoLife && window.CasinoLife.drop) window.CasinoLife.drop(c);
    c.life = null; c.lifeAct = null;
    if (c.cmb) standUp(c);
    const k = takeOver(c, "cuffed"); k.cop = cop;
    c.person.api.face("sad", 40); G.floatText(c.x, 2.4, c.z, "¡Detenido!", "#9fc4ff");
  }
  cop.pris.push(t.obj); P.arrests++;
  G.Rep.change(PB.perArrestRep); G.Heat.add(PB.perArrestHeat, "policía");
  G.sfx("tape", cop.x, cop.z);
}
function arrestPlayer(cop) {
  if (R.jail) return;
  const P = R.pol;
  R.jail = { t: 0 };
  if (R.ko) { R.ko = null; lastKo = -1; }
  if (P) P.wantPlayer = false;
  R.lastViolence = -99;
  for (const o of (P ? P.cops : [])) if (o.tgt && o.tgt.kind === "player") o.tgt = null;
  if (cop) G.floatText(cop.x, 2.4, cop.z, "¡Quedás detenido!", "#9fc4ff");
  G.sfx("tape", player.x, player.z); shake(0.05);
  G.toast("¡La policía te llevó detenido!", "bad");
}
function updateJail(dt) {
  const j = R.jail; if (!j) return;
  j.t += dt;
  if (j.t < PB.jailSec) return;
  R.jail = null;
  const s = S(), fine = Math.min(PB.fine, Math.max(0, Math.round(s.bank)));
  if (fine > 0) { G.Economy.force("fines", fine); if (s.today && s.today.st) s.today.st.fines = (s.today.st.fines || 0) + fine; }
  const lost = Math.floor((s.pocket || 0) * PB.pocketLoss); if (lost > 0) s.pocket -= lost;
  G.Rep.change(PB.rep); G.Heat.add(PB.heat, "policía");
  s.minutes = Math.min(s.minutes + PB.jailHours * 60, CFG.dayEnd * 60 - 0.5);
  player.x = G.DOOR.x; player.z = -7.4; player.yaw = Math.PI; player.pitch = 0; R.hp = CB.player.hp;
  const msg = `Saliste de la comisaría después de ${PB.jailHours} horas. Multa: ${fmt(fine)}${lost > 0 ? ` y te sacaron ${fmt(lost)} del bolsillo` : ""}.`;
  if (s.today && Array.isArray(s.today.notes)) s.today.notes.push("Te llevaron detenido por armar lío en el salón.");
  G.toast(msg, "bad");
  C().stats.jailed = (C().stats.jailed || 0) + 1;
  G.updateHud(true); G.save(true);
}
// los detenidos caminan detrás del policía que los lleva
function dragPrisoners(cop, dt, moving) {
  const ry = cop.person.group.rotation.y, fx = Math.sin(ry), fz = Math.cos(ry);
  cop.pris = cop.pris.filter(a => a.person && !a.dead);
  cop.pris.forEach((a, i) => {
    const back = 0.75 * (i + 1); G.placeAgent(a, cop.x - fx * back, cop.z - fz * back);
    a.person.group.rotation.y = ry; a.person.group.rotation.x = 0;
    if (moving) a.person.api.walk(dt, 2.2); else a.person.api.idle(dt);
    const J = a.person.api.joints; if (J && J.armL && J.armR) { J.armL.rotation.x = 0.55; J.armR.rotation.x = 0.55; } // manos atrás
  });
}
function dropPrisoners(cop) {
  for (const a of cop.pris) {
    if (a.kind === "mafia") { if (a.person) G.releasePerson(a.person); a.person = null; a.state = "gone"; }
    else if (alive(a)) { if (a.cmb) a.cmb.cop = null; G.despawnCustomer(a); }
  }
  cop.pris = [];
}
const COP_ROAM = [[-6, -3], [6, -3], [-10, 1], [10, 1], [-3, 4], [3, 4], [0, -1], [-12, -3], [12, -3], [0, 5]];
function updatePolice(dt) {
  const P = R.pol; if (!P) return;
  if (S().dayOver) { endPolice(true); return; }
  P.t += dt;
  // balizas y sirena
  const on = Math.floor(performance.now() / 220) % 2 === 0;
  polMat.red.color.setHex(on ? 0xff2020 : 0x3a0808); polMat.blue.color.setHex(on ? 0x101c40 : 0x2a70ff);
  P.sirenT -= dt;
  if (P.sirenT <= 0 && (P.phase === "arrive" || (P.phase === "coming" && P.t > PB.delay - 3))) { P.sirenT = 1.3; G.sfx("alarm", 18, -17); }
  if (P.phase === "coming") { if (P.t >= PB.delay) startPatrol(); return; }
  for (const car of P.cars) {
    car.t += dt;
    if (car.state === "in") { const u = clamp((car.t - car.delay) / 3.4, 0, 1), e = 1 - Math.pow(1 - u, 2.2); car.g.position.x = car.x0 + (car.x1 - car.x0) * e; }
    else if (car.state === "out") { const e = clamp((car.t - car.delay) / 3.4, 0, 1); car.g.position.x = car.x1 - e * e * 70; }
  }
  if (P.entered) P.st += dt;
  const over = P.st > PB.sweepMax;
  P.scareT -= dt; const doScare = P.scareT <= 0 && P.entered; if (doScare) P.scareT = 1;
  for (const cop of P.cops) {
    const p = cop.person; if (!p || cop.state === "gone") continue;
    cop.t += dt;
    switch (cop.state) {
      case "wait":
        if (P.t > 3.4 + cop.car * 0.4) { cop.state = "enter"; p.group.visible = true; G.goTo(cop, G.DOOR.x + (cop.car ? 0.5 : -0.5), -11); }
        break;
      case "enter":
        if (G.stepAgent(cop, dt, PB.runSpeed) || cop.t > 9) {
          cop.state = "hunt"; cop.t = 0;
          if (!P.entered) { P.entered = true; P.wantPlayer = wanted(); banner("¡POLICÍA!", "¡Todos quietos! Se llevan a cualquiera que tengan adelante.", 3.5); scare(G.DOOR.x, G.DOOR.z + 4, 9, PB.scareChance); }
        }
        break;
      case "hunt": {
        if (doScare) scare(cop.x, cop.z, PB.scareR, PB.scareChance * 0.4);
        cop.re -= dt;
        if (cop.re <= 0) { cop.re = 0.45; cop.tgt = pickTarget(P, cop); if (cop.tgt) G.goTo(cop, cop.tgt.obj.x, cop.tgt.obj.z); }
        const t = cop.tgt;
        if (t) {
          const stillOn = t.kind === "player" ? !R.jail : t.kind === "mafia" ? !!t.obj.person && t.obj.state !== "cuffed" : t.kind === "staff" ? !!(t.obj.cmb && t.obj.cmb.mode === "fight") : alive(t.obj) && !(t.obj.cmb && t.obj.cmb.mode === "cuffed");
          if (!stillOn) { cop.tgt = null; cop.re = 0; break; }
          G.stepAgent(cop, dt, PB.runSpeed);
          if (dist(cop.x, cop.z, t.obj.x, t.obj.z) < PB.grab) { cop.tgt = null; arrest(cop, t); if (cop.pris.length) { cop.state = "escort"; cop.t = 0; G.goTo(cop, G.DOOR.x, -11.5); } break; }
        } else if (over || (P.st > PB.sweepMin)) { cop.state = "exit"; G.goTo(cop, P.cars[cop.car].x1 - 1, -16.4); break; }
        else { // patrulla el salón
          cop.roamT -= dt;
          if (cop.roamT <= 0 || G.stepAgent(cop, dt, PB.walkSpeed)) { cop.roamT = rnd(3, 5); const r = pick(COP_ROAM); G.goTo(cop, r[0] + rnd(-1, 1), r[1] + rnd(-1, 1)); }
        }
        if (over && !t) { cop.state = "exit"; G.goTo(cop, P.cars[cop.car].x1 - 1, -16.4); break; }
        bump(P, cop);
        break;
      }
      case "escort": {
        const moving = !G.stepAgent(cop, dt, PB.walkSpeed);
        dragPrisoners(cop, dt, moving);
        if (!moving || cop.t > 30) { dropPrisoners(cop); cop.t = 0; if (over) { cop.state = "exit"; G.goTo(cop, P.cars[cop.car].x1 - 1, -16.4); } else { cop.state = "hunt"; cop.re = 0; } }
        break;
      }
      case "exit":
        if (G.stepAgent(cop, dt, PB.walkSpeed) || cop.t > 20) { p.group.visible = false; cop.state = "gone"; }
        break;
    }
  }
  if (P.phase === "arrive" && P.cops.every(c => c.state === "gone")) {
    P.phase = "leave"; P.lt = 0;
    for (const car of P.cars) { car.state = "out"; car.t = 0; car.delay = P.cars.indexOf(car) * 0.5; }
    R.riot = Math.min(R.riot, RB.max * 0.3);
  }
  if (P.phase === "leave") { P.lt += dt; if (P.lt > 4.5) endPolice(false); }
}
// "no le importa a quién se lleva por delante": cualquiera que se le cruce de frente, vos incluido
function bump(P, cop) {
  if (cop.pris.length >= 2) return;
  if (!R.jail && dist(cop.x, cop.z, player.x, player.z) < PB.bump && ahead(cop, player.x, player.z)) { arrestPlayer(cop); return; }
  for (const c of G.customers) {
    if (!alive(c) || c.z < -10.2 || c.state === "leave" || c.state === "flee" || c.state === "caught" || (c.cmb && c.cmb.mode === "cuffed")) continue;
    if (dist(cop.x, cop.z, c.x, c.z) < PB.bump && ahead(cop, c.x, c.z)) {
      arrest(cop, { kind: "customer", obj: c });
      if (cop.pris.length >= 2) { cop.tgt = null; cop.state = "escort"; cop.t = 0; G.goTo(cop, G.DOOR.x, -11.5); }
      return;
    }
  }
}
function endPolice(silent) {
  const P = R.pol; if (!P) return; R.pol = null;
  for (const cop of P.cops) { dropPrisoners(cop); if (cop.person) G.releasePerson(cop.person); cop.person = null; }
  for (const car of P.cars) scene.remove(car.g);
  R.riot = 0; R.blame = { player: 0, clientes: 0, mafia: 0 }; R.riotCool = PB.cooldown;
  if (silent) return;
  G.toast(P.arrests ? `La policía se fue y se llevó ${P.arrests} detenido${P.arrests > 1 ? "s" : ""}. El salón quedó tranquilo.` : "La policía recorrió el salón y se fue.", P.arrests ? "bad" : undefined);
  G.save(false);
}

// =====================================================================
// TIENDA (pestaña "Armas" de la compu) Y EQUIPAR
// =====================================================================
function shopHtml() {
  const c = C(), s = S();
  const rows = CB.weapons.map(w => {
    const locked = s.rank < w.rank, own = c.own[w.id], isEq = c.eq === w.id;
    const btn = own ? `<button class="ghost" data-cact="eq" data-id="${w.id}">${isEq ? "Guardar" : "Equipar"}</button>` : `<button data-cact="buy" data-id="${w.id}" ${locked || s.bank < w.price ? "disabled" : ""}>Comprar</button>`;
    return `<div class="item${locked ? " locked" : ""}"><span class="sw" style="background:${w.kind === "ranged" ? "#4d5560" : "#b07a46"}"></span>
      <div class="t"><b>${esc(w.name)} · <span class="num">${w.free ? "Gratis" : fmt(w.price)}</span>${locked ? `<span class="tag lock">Rango ${w.rank}</span>` : ""}${own ? `<span class="tag">Tuya${isEq ? " · en mano" : ""}</span>` : ""}</b>
      <span>${esc(w.desc)} ${w.free ? "Mano limpia" : w.kind === "melee" ? "Arma blanca" : "Arma de fuego"} · daño ${w.dmg}.</span></div><div class="btns">${btn}</div></div>`;
  }).join("");
  const gun = c.own.pistol, full = c.ammo >= CB.ammo.max;
  const ammo = `<div class="item${gun ? "" : " locked"}"><span class="sw" style="background:#d9a84a"></span><div class="t"><b>Caja de municiones · <span class="num">${fmt(CB.ammo.price)}</span></b><span>+${CB.ammo.amount} balas para la pistola. Tenés ${c.ammo}/${CB.ammo.max}.</span></div>
      <div class="btns"><button data-cact="ammo" ${!gun || full || s.bank < CB.ammo.price ? "disabled" : ""}>Comprar</button></div></div>`;
  return `<p>Banco <b class="num">${fmt(s.bank)}</b> · equipás con <kbd>${CB.keyLabel}</kbd> y atacás con el clic izquierdo. Pegarle a una máquina la rompe y a un cliente lo enoja de verdad: puede noquearte. Un disparo a un cliente deja sangre que cuesta ${fmt(CB.blood.cleanCost)} limpiar. Y ni se te ocurra tocar a Don Aurelio. Ojo: si se arma mucho escándalo cae la policía y se lleva a cualquiera, vos incluido.</p>
    <div class="list">${rows}${ammo}</div>`;
}
function buy(id) {
  const w = WDEF(id), c = C(), s = S(); if (!w || c.own[id]) return false;
  if (s.rank < w.rank) { G.toast(`Necesitás rango ${w.rank}.`, "bad"); return false; }
  if (!G.Economy.trySpend("weapons", w.price)) return false;
  c.own[id] = true; if (id === "pistol") c.ammo = clamp(c.ammo + CB.ammo.startWith, 0, CB.ammo.max);
  G.toast(`Compraste: ${w.name}. Equipala con ${CB.keyLabel}.`, "good"); equip(id, true); G.updateHud(true); G.save(true); return true;
}
function buyAmmo() {
  const c = C(); if (!c.own.pistol || c.ammo >= CB.ammo.max) return false;
  if (!G.Economy.trySpend("weapons", CB.ammo.price)) return false;
  c.ammo = clamp(c.ammo + CB.ammo.amount, 0, CB.ammo.max); G.toast(`Municiones: ${c.ammo}.`, "good"); G.updateHud(true); G.save(true); return true;
}
function equip(id, force) {
  const c = C(); if (id && !c.own[id]) return false;
  c.eq = !force && c.eq === id ? "" : (id || ""); setWeaponModel(); R.hudKey = ""; G.save(false); return true;
}
function cycle() {
  const c = C(), owned = CB.weapons.filter(w => c.own[w.id]);
  if (!owned.length) { G.hint("cmbNoWeapon", "No tenés armas. Comprá una en la compu de la oficina (pestaña Armas)."); return; }
  const i = owned.findIndex(w => w.id === c.eq);
  c.eq = i + 1 < owned.length ? owned[i + 1].id : (i >= 0 ? "" : owned[0].id); // ... -> última -> guardada -> primera
  setWeaponModel(); R.hudKey = ""; G.SFX.tick();
}
window.addEventListener("keydown", e => {
  if (e.code !== CB.key || e.repeat || !G.started || !sync()) return;
  if (G.ui.panel || R.ko || R.jail || (window.CasinoBuild && window.CasinoBuild.active)) return;
  cycle();
});
document.getElementById("panelBody").addEventListener("click", e => {
  const b = e.target.closest("button[data-cact]"); if (!b || b.disabled || !sync()) return;
  const a = b.dataset.cact;
  if (a === "buy") buy(b.dataset.id); else if (a === "ammo") buyAmmo(); else if (a === "eq") equip(b.dataset.id);
  if (window.CasinoShop && window.CasinoShop.openPc) window.CasinoShop.openPc("cmb");
});

// =====================================================================
// BUCLES
// =====================================================================
function update(dt) {
  if (!sync()) return;
  const c = C();
  if (R.cd > 0) R.cd -= dt;
  R.hurtT += dt; R.clock += dt;
  if (!R.ko && R.hp < CB.player.hp && R.hurtT > CB.player.regenDelay) R.hp = Math.min(CB.player.hp, R.hp + CB.player.regenPerSec * dt);
  updateKO(dt); updateResponder(dt); updateStaffFights(dt);
  checkMafia(); updateMafia(dt); updateMafiaStaff(dt);
  decayRiot(dt); updatePolice(dt); updateJail(dt);
  // limpieza especial en curso
  for (const st of R.stains.slice()) if (st.cl) { st.t += dt; if (st.t >= CB.blood.cleanSec) { G.floatText(st.x, 1.3, st.z, "¡Alfombra impecable!", "#9fd0ff"); G.sfx("repair", st.x, st.z); dropStain(st, false); } }
  void c;
}
function frame(dt) {
  if (!sync()) return;
  updateSparks(dt);
  if (R.bannerT > 0) { R.bannerT -= dt; if (R.bannerT <= 0) banner(null); }
  // arma en mano
  const w = equipped();
  if (w && vm.visible) {
    const rest = REST[w.id], m = models[w.id];
    let px = rest.p[0], py = rest.p[1], pz = rest.p[2], rx = rest.r[0], ry = rest.r[1], rz = rest.r[2];
    if (w.id === "fists") { // piña: sale una mano para adelante (alterna izquierda / derecha)
      const u = R.swing ? clamp((R.swing.t += dt) / R.swing.dur, 0, 1) : 1, k = Math.sin(Math.PI * Math.min(1, u * 1.4));
      const fl = m.userData.l, fr = m.userData.r, f = R.jab ? fr : fl, o = R.jab ? fl : fr;
      f.position.set((R.jab ? 0.16 : -0.16) * (1 - k * 0.55), k * 0.08, -k * 0.34); f.rotation.x = -k * 0.2;
      o.position.set(R.jab ? -0.16 : 0.16, -0.02, 0.04); o.rotation.x = 0;
      if (u >= 1) R.swing = null;
    } else if (R.swing) {
      const s = R.swing; s.t += dt; const u = clamp(s.t / s.dur, 0, 1);
      if (s.shot) { const k = 1 - u; pz += 0.07 * k; rx += 0.28 * k; if (models.pistol.userData.flash) models.pistol.userData.flash.visible = u < 0.35; }
      else {
        const wind = u < 0.35 ? u / 0.35 : 1 - clamp((u - 0.35) / 0.65, 0, 1) * 0.0, hit = u < 0.35 ? 0 : clamp((u - 0.35) / 0.25, 0, 1), back = u > 0.6 ? (u - 0.6) / 0.4 : 0;
        const a = u < 0.35 ? -wind * 0.9 : -0.9 + hit * 2.3 - back * 1.4; // arriba, golpe, vuelta
        rx += a; rz += u < 0.35 ? -wind * 0.2 : -0.2 + hit * 0.5 - back * 0.3; px -= u < 0.35 ? wind * 0.05 : (-0.05 + hit * 0.1 - back * 0.05); pz -= hit * 0.14 * (1 - back);
      }
      if (u >= 1) { R.swing = null; if (models.pistol.userData.flash) models.pistol.userData.flash.visible = false; }
    }
    const walk = Math.sin(performance.now() / 260) * 0.004;
    vm.position.set(px, py + walk, pz); vm.rotation.set(rx, ry, rz);
    void m;
  }
  // salud / noqueado: cámara al piso, vignette roja, temblor
  R.koK += ((R.ko ? 1 : 0) - R.koK) * Math.min(1, dt * (R.ko ? 4 : 2));
  if (R.koK < 0.003) R.koK = 0;
  if (R.koK > 0 || R.shake > 0.001) {
    if (!G.ui.panel) {
      const sh = R.shake; const sx = (Math.random() - 0.5) * sh, sy = (Math.random() - 0.5) * sh;
      camera.position.x = player.x + sx; camera.position.z = player.z + sy;
      camera.position.y = 1.65 + (0.28 - 1.65) * R.koK + sy * 0.6;
      camera.rotation.set(player.pitch * (1 - R.koK) + (-0.1) * R.koK, player.yaw, 1.35 * R.koK);
    }
  }
  R.shake *= Math.pow(0.02, dt); if (R.shake < 0.001) R.shake = 0;
  R.flashRed *= Math.pow(0.08, dt); if (R.flashRed < 0.01) R.flashRed = 0;
  redEl.style.opacity = String(clamp(R.flashRed + (R.hp < CB.player.hp * 0.3 && !R.ko ? 0.25 : 0), 0, 1).toFixed(2));
  showKo(R.koK * 0.95);
  R.jailK = (R.jailK || 0) + ((R.jail ? 1 : 0) - (R.jailK || 0)) * Math.min(1, dt * (R.jail ? 3 : 1.5)); if (R.jailK < 0.01 && !R.jail) R.jailK = 0;
  showJail(R.jailK);
  updateHud(); updateRiotHud();
}

// =====================================================================
// API
// =====================================================================
window.CasinoCombat = {
  click, ko, actor, update, frame, shopHtml, atrPenalty, repairMul, onRepair, onDespawn,
  disturb: (n, src) => { if (sync()) disturb(n, src); }, // life.js: peleas entre clientes
  get hp() { return R.hp; }, get riot() { return R.riot; }, get police() { return !!R.pol; }, get jailed() { return !!R.jail; },
  debug: {
    get state() { sync(); return C(); }, get run() { return R; }, get stains() { return R.stains; }, get mafia() { return R.mf; }, get responder() { return R.resp; }, get pol() { return R.pol; },
    callPolice, endPolice, arrestPlayer, violence, hitStaff, punch,
    buy, buyAmmo, equip, cycle, aim, attack, startKO, startMafia, wake, hurtPlayer, addBlood, cleanStain, hitAurelio, shootCustomer, hitCustomer, hitMachine, killStaff,
    sanitize: clean,
  },
};
})();
