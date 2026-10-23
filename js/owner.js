/* Casino Dorado · owner.js — EL DUEÑO: IMAGEN, PUBLICIDAD, SEGURO Y ROBO PLANEADO
 * Se carga después de shop.js y antes de story.js. Usa window.CasinoOwnerBridge (game.js).
 *  1) Imagen (0-100): ropa (ropero con espejo en la oficina y mangas en primera persona), accesorios, auto
 *     estacionado en la vereda (fitito → sedán → deportivo → limusina) y lujos de la oficina (escritorio de caoba,
 *     alfombra, retrato al óleo, acuario, caja fuerte dorada). Sube los high rollers y VIP, baja los sueldos,
 *     apura al personal y hace que la mafia cobre menos (story.js).
 *  2) Publicidad desde la compu: volantes, radio, cartel en la ruta (se ve enfrente) e influencer. Cada campaña dura
 *     N días y suma demanda por tipo de cliente con rendimiento decreciente; el cierre de caja muestra el ROI.
 *  3) Seguro (cuota cada 7 días) contra robos, incendio y vandalismo; cámaras y caja fuerte reforzada.
 *     Robo planeado: avisos (sospechosos, llamada anónima), banda enmascarada de noche, alarma, persiana de la
 *     bóveda, policía, guardias con bate, taclear y pinchar la goma de la camioneta. Tono de dibujito.
 * Estado guardado en S.owner (game.js lo copia en sanitize; acá se valida campo por campo).
 * Teclas: I abre Imagen, publicidad y seguro desde el celular.
 */
(() => {
"use strict";
const G = window.CasinoOwnerBridge, D = window.CASINO_DATA, A = window.CasinoArt, T = window.THREE;
if (!G || !D || !D.OWNER || !A || !T) return;
const O = D.OWNER, H = O.heist;
const S = () => G.S;
const isNum = v => typeof v === "number" && Number.isFinite(v);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);
const fmt = n => G.fmt(n);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const two = n => String(n).padStart(2, "0");
const byId = (list, id) => list.find(x => x.id === id) || null;
const OUT = id => byId(O.outfits, id), ACC = id => byId(O.accessories, id), CAR = id => byId(O.cars, id), OFF = id => byId(O.office, id);
const AD = id => byId(O.ads, id), INS = id => byId(O.insurance, id);
const TYPES = ["casual", "regular", "highroller", "vip"];
const KEY = G.KEY;

// =====================================================================
// LUGARES (diseño de nivel)
// =====================================================================
const WARD = { x: 3.68, z: -9.6, w: 1.0, d: 0.5, stand: { x: 3.68, z: -8.7 } };   // ropero con espejo (oficina)
const AQUA = { x: 4.5, z: -9.62, w: 0.56, d: 0.42 };                              // acuario, entre el ropero y la compu
const DESK = { x: 5.4, z: -9.5 };                                                  // escritorio de la compu (shop.js)
const PANEL = { x: -4.8, y: 1.45, z: -9.84 };                                     // tablero de seguridad, a la izquierda de la puerta
const VAULT = { x: -7.85, z: -9.5 };                                               // caja fuerte adentro de la jaula de la caja
const WIN = { x: -8.55, z: -8.3 };                                                 // ventanilla de la jaula (persiana)
const CARP = { x: 10.4, z: -11.65 };                                               // lugar del auto en la vereda
const BB = { x: -7.5, z: -25.6 };                                                 // cartel en la ruta
const VAN_Z = -21.8, VAN_X = 1.2, POL_Z = -18.9, POL_X = 7.5, CURB_Z = -16.4;
const SAFE_SPOTS = [{ x: -8.9, z: -7.0 }, { x: -8.2, z: -7.0 }, { x: -9.4, z: -6.5 }, { x: -7.6, z: -6.6 }];
const CASE_SPOTS = [{ x: -8.0, z: -6.4, look: { x: -8.55, z: -8.3 } }, { x: -4.8, z: -8.95, look: { x: -4.8, z: -9.9 } }, { x: 1.6, z: -8.5, look: { x: 2.6, z: -9.9 } }, { x: -6.5, z: -5.2, look: { x: -8.55, z: -8.3 } }];

// =====================================================================
// ESTADO (S.owner)
// =====================================================================
function fresh() {
  return { outfit: "remera", own: {}, car: null, ads: [], adHist: [], ins: { plan: null, due: 0, claims: [] }, cam: 0, safe: 0,
    heist: { day: 0, known: 0, tip: 0, last: 0, done: 0, foiled: 0, lost: 0 }, infl: { day: 0, came: 0, greeted: 0 },
    today: { day: 0, types: {}, extra: {}, fire: 0, heistLoss: 0, heistPay: 0 }, lastRep: null, shutter: false };
}
function validate(raw, s) {
  const o = fresh(); if (!raw || typeof raw !== "object") return o;
  const int = (v, d, lo, hi) => isNum(v) ? clamp(Math.round(v), lo, hi) : d;
  if (raw.own && typeof raw.own === "object") for (const k in raw.own) if (raw.own[k] && (OUT(k) || ACC(k) || CAR(k) || OFF(k))) o.own[k] = 1;
  o.outfit = OUT(raw.outfit) && (raw.outfit === "remera" || o.own[raw.outfit]) ? raw.outfit : "remera";
  o.car = CAR(raw.car) && o.own[raw.car] ? raw.car : null;
  if (Array.isArray(raw.ads)) for (const a of raw.ads.slice(0, 12)) if (a && AD(a.id) && isNum(a.left) && a.left > 0)
    o.ads.push({ id: a.id, left: int(a.left, 1, 1, 60), cost: int(a.cost, AD(a.id).price, 0, 1e7), extra: isNum(a.extra) ? clamp(a.extra, 0, 1e5) : 0, rev: isNum(a.rev) ? clamp(a.rev, -1e8, 1e8) : 0, day: int(a.day, s.day, 1, 1e6), k: isNum(a.k) ? clamp(a.k, 0, 3) : 1 });
  if (Array.isArray(raw.adHist)) for (const a of raw.adHist.slice(-8)) if (a && AD(a.id)) o.adHist.push({ id: a.id, cost: int(a.cost, 0, 0, 1e7), extra: isNum(a.extra) ? clamp(a.extra, 0, 1e5) : 0, rev: isNum(a.rev) ? clamp(a.rev, -1e8, 1e8) : 0, day: int(a.day, 1, 1, 1e6), end: int(a.end, 1, 1, 1e6) });
  const I = raw.ins;
  if (I && typeof I === "object") { o.ins.plan = INS(I.plan) ? I.plan : null; o.ins.due = int(I.due, s.day + O.insEvery, 0, 1e6); if (Array.isArray(I.claims)) o.ins.claims = I.claims.filter(isNum).map(Math.round).slice(-10); }
  o.cam = int(raw.cam, 0, 0, O.cams.length); o.safe = int(raw.safe, 0, 0, O.safes.length);
  const Hh = raw.heist;
  if (Hh && typeof Hh === "object") for (const k in o.heist) o.heist[k] = int(Hh[k], 0, 0, 1e9);
  if (o.heist.day && o.heist.day < s.day) o.heist.day = 0; // se pasó la noche (partida vieja)
  const F = raw.infl; if (F && typeof F === "object") for (const k in o.infl) o.infl[k] = int(F[k], 0, 0, 1e6);
  const Td = raw.today;
  if (Td && typeof Td === "object" && Td.day === s.day) {
    o.today.day = s.day;
    if (Td.types && typeof Td.types === "object") for (const t of TYPES) if (isNum(Td.types[t])) o.today.types[t] = clamp(Math.round(Td.types[t]), 0, 1e5);
    if (Td.extra && typeof Td.extra === "object") for (const k in Td.extra) if (AD(k) && isNum(Td.extra[k])) o.today.extra[k] = clamp(Td.extra[k], 0, 1e5);
    for (const k of ["fire", "heistLoss", "heistPay"]) o.today[k] = int(Td[k], 0, 0, 1e9);
  } else o.today.day = s.day;
  const R = raw.lastRep;
  if (R && typeof R === "object" && isNum(R.day) && Array.isArray(R.rows)) o.lastRep = { day: Math.round(R.day), rows: R.rows.filter(r => r && AD(r.id)).slice(0, 8).map(r => ({ id: r.id, left: int(r.left, 0, 0, 99), cost: int(r.cost, 0, 0, 1e7), extraT: isNum(r.extraT) ? r.extraT : 0, revT: isNum(r.revT) ? r.revT : 0, rev: isNum(r.rev) ? r.rev : 0 })), ins: typeof R.ins === "string" ? R.ins.slice(0, 300) : "", heist: typeof R.heist === "string" ? R.heist.slice(0, 300) : "" };
  o.shutter = !!raw.shutter;
  return o;
}
let lastS = null;
function ensure() {
  const s = S(); if (!s) return false;
  if (s === lastS && s.owner) return true;
  lastS = s; s.owner = validate(s.owner, s);
  resetRuntime();
  return true;
}
const OW = () => S().owner;

// =====================================================================
// IMAGEN
// =====================================================================
function image() {
  if (!S() || !S().owner) return 0;
  const o = OW(); let n = (OUT(o.outfit) || O.outfits[0]).img;
  for (const a of O.accessories) if (o.own[a.id]) n += a.img;
  if (o.car) n += CAR(o.car).img;
  for (const f of O.office) if (o.own[f.id]) n += f.img;
  return clamp(n, 0, O.imgMax);
}
const imgF = () => image() / O.imgMax;
function imageLabel(n) { return n >= 80 ? "Magnate" : n >= 55 ? "Imponente" : n >= 30 ? "Elegante" : n >= 12 ? "Prolijo" : "De entrecasa"; }

// =====================================================================
// PUBLICIDAD: efecto por tipo de cliente con rendimiento decreciente
// =====================================================================
const effCache = { raw: {}, e: {}, mean: 1 };
function adStrength(a) { const d = AD(a.id); return d ? (d.scaleByImg ? (0.5 + imgF() * O.effects.influencerK) * (a.k || 1) : (a.k || 1)) : 0; }
function computeEff() {
  const s = S(); if (!s || !s.owner) return effCache;
  for (const t of TYPES) effCache.raw[t] = 0;
  for (const a of s.owner.ads) { const d = AD(a.id), k = adStrength(a); for (const t in d.boost) effCache.raw[t] += d.boost[t] * k; }
  let wsum = 0, msum = 0;
  for (const ct of D.CUSTOMER_TYPES) {
    const cap = O.adCaps[ct.id] || 0.5, r = effCache.raw[ct.id] || 0;
    effCache.e[ct.id] = cap * (1 - Math.exp(-r / cap));
    if (s.rank >= ct.rank) { wsum += ct.weight; msum += ct.weight * (1 + effCache.e[ct.id]); }
  }
  effCache.mean = wsum > 0 ? msum / wsum : 1;
  return effCache;
}
function typeMul(id) {
  if (!ensure()) return 1;
  const e = computeEff(), img = (id === "highroller" || id === "vip") ? 1 + imgF() * O.effects.vipMul : 1;
  return (1 + (e.e[id] || 0)) / e.mean * img; // la mezcla cambia; el total lo pone demandMul
}
function demandMul() { if (!ensure()) return 1; return computeEff().mean; }
function wageMul() { if (!ensure()) return 1; return 1 - imgF() * O.effects.wageCut; }
function staffSpeedMul() { if (!ensure()) return 1; return 1 + imgF() * O.effects.staffSpeed; }
function respectMul() { if (!ensure()) return 1; return 1 - imgF() * O.effects.respectCut; }

let crewSpawning = false;
function onSpawn(c) {
  if (!ensure() || crewSpawning || c.thief || !c.type) return;
  const td = OW().today; if (td.day !== S().day) { td.day = S().day; td.types = {}; td.extra = {}; td.fire = 0; td.heistLoss = 0; td.heistPay = 0; }
  const id = c.type.id; td.types[id] = (td.types[id] || 0) + 1;
  const e = computeEff(), E = e.e[id] || 0, raw = e.raw[id] || 0; if (E <= 0 || raw <= 0) return;
  const pExtra = E / (1 + E);   // probabilidad de que este cliente haya venido por la publicidad
  for (const a of OW().ads) { const b = (AD(a.id).boost[id] || 0) * adStrength(a); if (b > 0) { const x = pExtra * b / raw; a.extra += x; td.extra[a.id] = (td.extra[a.id] || 0) + x; } }
}
function buyAd(id) {
  if (!ensure()) return false;
  const d = AD(id), s = S(), o = OW(); if (!d) return false;
  if (s.rank < d.rank) { G.toast(`Necesitás rango ${d.rank}.`, "bad"); return false; }
  if (s.dayOver) return false;
  if (!G.Economy.trySpend("ads", d.price)) return false;
  const cur = o.ads.find(a => a.id === id);
  if (cur) { cur.left += d.days; cur.cost += d.price; G.toast(`${d.name}: la campaña se extiende ${d.days} días más (rinde menos cuanto más apilás).`, "good"); }
  else { o.ads.push({ id, left: d.days, cost: d.price, extra: 0, rev: 0, day: s.day, k: 1 }); G.toast(`${d.name}: campaña lanzada por ${d.days} días.`, "good"); }
  if (id === "influencer") { o.infl.day = s.day + (G.S.minutes / 60 >= O.influencerHour - 0.5 ? 1 : 0); o.infl.came = 0; o.infl.greeted = 0; G.toast(`La influencer viene ${o.infl.day === s.day ? "hoy" : "mañana"} a las ${O.influencerHour}:00. Recibila en la puerta para que te recomiende más.`, ""); }
  G.sfx("register") || G.SFX.cash(); refreshAdsVisual(); G.updateHud(true); G.save(true);
  return true;
}

// =====================================================================
// SEGURO Y SEGURIDAD
// =====================================================================
function premiumOf(id) {
  const p = INS(id); if (!p || !S()) return 0;
  const recent = OW().ins.claims.filter(d => d >= S().day - 14).length;
  return Math.round(p.premium * (1 + S().heat * O.insHeatK) * (1 + recent * O.insClaimK));
}
function buyIns(id) {
  if (!ensure()) return false;
  const p = INS(id), o = OW(); if (!p) return false;
  if (S().rank < p.rank) { G.toast(`Necesitás rango ${p.rank}.`, "bad"); return false; }
  if (o.ins.plan === id) return false;
  const cost = premiumOf(id);
  if (!G.Economy.trySpend("insurance", cost)) return false;
  o.ins.plan = id; o.ins.due = S().day + O.insEvery;
  G.toast(`Contrataste el seguro ${p.name}: cubre ${Math.round(p.cover * 100)}% de robos, incendios y vandalismo. Próxima cuota el día ${o.ins.due}.`, "good");
  G.sfx("register") || G.SFX.cash(); G.save(true); return true;
}
function cancelIns() { if (!ensure()) return; const o = OW(); if (!o.ins.plan) return; G.toast(`Diste de baja el seguro ${INS(o.ins.plan).name}.`, ""); o.ins.plan = null; G.save(true); }
function payout(loss, why) { // indemnización del seguro, si hay póliza vigente
  const o = OW(), p = INS(o.ins.plan); if (!p || loss <= 0) return 0;
  const pay = Math.round(Math.max(0, loss - p.deductible) * p.cover); if (pay <= 0) return 0;
  G.Economy.add("insurancePay", pay); o.ins.claims.push(S().day); if (o.ins.claims.length > 10) o.ins.claims.shift();
  return pay;
}
function buySec(kind) {
  if (!ensure()) return false;
  if (hz && hz.phase !== "done") { G.toast("¡Ahora no! La banda ya está acá.", "bad"); return false; }
  const o = OW(), list = kind === "cam" ? O.cams : O.safes, lvl = kind === "cam" ? o.cam : o.safe, nx = list[lvl];
  if (!nx) return false;
  if (S().rank < nx.rank) { G.toast(`Necesitás rango ${nx.rank}.`, "bad"); return false; }
  if (!G.Economy.trySpend("security", nx.price)) return false;
  if (kind === "cam") o.cam++; else o.safe++;
  G.toast(kind === "cam" ? (o.cam === 1 ? "Cámaras instaladas: alarma con monitoreo (llama sola a la policía) y los guardias reaccionan al toque." : "Cámaras de alta definición: la policía llega antes y te enterás más de lo que se planea.") : `Caja fuerte nivel ${o.safe}: más difícil de abrir y entra menos plata a la vista.`, "good");
  G.sfx("repair") || G.SFX.cash(); refreshSecVisual(); G.save(true); return true;
}

// =====================================================================
// COMPRAS DE IMAGEN
// =====================================================================
function itemOf(id) { return OUT(id) || ACC(id) || CAR(id) || OFF(id); }
function kindOf(id) { return OUT(id) ? "outfit" : ACC(id) ? "acc" : CAR(id) ? "car" : OFF(id) ? "office" : null; }
function buyItem(id) {
  if (!ensure()) return false;
  const it = itemOf(id), o = OW(), k = kindOf(id); if (!it) return false;
  if (o.own[id] || id === "remera") { if (k === "outfit") wear(id); else if (k === "car") useCar(id); return true; }
  if (S().rank < it.rank) { G.toast(`Necesitás rango ${it.rank}.`, "bad"); return false; }
  const before = image();
  if (!G.Economy.trySpend("image", it.price)) return false;
  o.own[id] = 1;
  if (k === "outfit") o.outfit = id;
  if (k === "car") o.car = id;
  const after = image();
  G.toast(`${it.name}: imagen ${Math.round(before)} → ${Math.round(after)} (${imageLabel(after)}).`, "good");
  G.sfx("register") || G.SFX.cash(); G.floatText(G.player.x, 1.9, G.player.z - 1, `+${Math.round(after - before)} imagen`, "#f6c766");
  refreshVisuals(); G.updateHud(true); G.save(true);
  return true;
}
function wear(id) { const o = OW(); if (!(id === "remera" || o.own[id]) || !OUT(id)) return; o.outfit = id; G.sfx("tick") || G.SFX.tick(); refreshOutfit(); G.save(true); }
function useCar(id) { const o = OW(); if (id && !(o.own[id] && CAR(id))) return; o.car = id; refreshCar(); G.save(true); }

// =====================================================================
// MODELOS (geometría fusionada con colores por vértice)
// =====================================================================
const VC = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.05 });
const VCG = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.35 }); // lustrado (autos, caja fuerte)
const BOX1 = new T.BoxGeometry(1, 1, 1), CYL1 = new T.CylinderGeometry(0.5, 0.5, 1, 14), SPH1 = new T.SphereGeometry(0.5, 12, 8);
const _q = new T.Quaternion(), _e = new T.Euler(), _v = new T.Vector3(), _s = new T.Vector3();
function M4(x, y, z, ry, sx, sy, sz, rx, rz) { _e.set(rx || 0, ry || 0, rz || 0); _q.setFromEuler(_e); return new T.Matrix4().compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz)); }
function part(L, geo, color, x, y, z, w, h, d, ry, rx, rz) { L.push({ geo, m: M4(x, y, z, ry || 0, w, h, d, rx, rz), color }); }
function merged(L, mat) { return new T.Mesh(A.mergeGeometries(L, true), mat || VC); }
function plane(w, h, mat) { return new T.Mesh(new T.PlaneGeometry(w, h), mat); }
const basicTex = tex => new T.MeshBasicMaterial({ map: tex });
function sprite(draw, sx, sy) { const s = new T.Sprite(new T.SpriteMaterial({ map: A.canvasTex(64, 64, draw), depthTest: false })); s.scale.set(sx || 0.34, sy || 0.34, 1); s.renderOrder = 10; return s; }

// --- ropero con espejo ------------------------------------------------------
const mirrorRT = new T.WebGLRenderTarget(224, 512, { minFilter: T.LinearFilter, magFilter: T.LinearFilter });
const mirrorCam = new T.PerspectiveCamera(50, 0.7 / 1.6, 0.1, 40);
const wardGroup = (() => {
  const g = new T.Group(); g.position.set(WARD.x, 0, WARD.z); G.scene.add(g);
  const L = [], wood = 0x4a2a16, dark = 0x2e180c, gold = 0xc9962e;
  part(L, BOX1, wood, 0, 1.06, 0, WARD.w, 2.12, WARD.d);
  part(L, BOX1, dark, 0, 2.16, 0.01, WARD.w + 0.08, 0.08, WARD.d + 0.06);
  part(L, BOX1, dark, 0, 0.05, 0.01, WARD.w + 0.04, 0.1, WARD.d + 0.04);
  part(L, BOX1, gold, 0, 1.06, 0.252, 0.8, 1.72, 0.01); // marco dorado del espejo
  part(L, BOX1, gold, -0.43, 1.06, 0.26, 0.03, 0.18, 0.03); part(L, BOX1, gold, 0.43, 1.06, 0.26, 0.03, 0.18, 0.03); // manijas
  part(L, BOX1, gold, 0, 2.06, 0.256, 0.5, 0.04, 0.01);
  g.add(merged(L));
  const geo = new T.PlaneGeometry(0.7, 1.6), uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); // espejado
  const mirror = new T.Mesh(geo, new T.MeshBasicMaterial({ map: mirrorRT.texture, color: 0xe8eef2 }));
  mirror.position.set(0, 1.06, 0.259); g.add(mirror);
  const cap = new T.Mesh(new T.PlaneGeometry(0.7, 0.1), basicTex(A.canvasTex(256, 36, (c, W, H) => { c.fillStyle = "#2e180c"; c.fillRect(0, 0, W, H); c.fillStyle = "#f6c766"; c.font = "bold 22px Georgia, serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("ROPERO DEL DUEÑO", W / 2, H / 2 + 1); })));
  cap.position.set(0, 2.05, 0.263); g.add(cap);
  A.addBlob(g, 1.2, 0.7);
  G.boxAt(WARD.x, WARD.z, WARD.w, WARD.d, "owner");
  mirrorCam.position.set(WARD.x, 1.55, WARD.z + 0.3); mirrorCam.rotation.set(0, Math.PI, 0); mirrorCam.updateMatrixWorld();
  g.userData.mirror = mirror;
  return g;
})();
G.proxy(wardGroup, 1.0, 2.1, 0.6, {
  prompt: () => ({ text: "Ropero del dueño", sub: `Ropa y accesorios · imagen ${Math.round(image())} (${imageLabel(image())}) · tenés puesto: ${esc((OUT(OW().outfit) || O.outfits[0]).name)}` }),
  hold: () => 0, use: () => openOwner("own_img", "wardrobe"),
}, 1.05, 0, 0.05);

// --- espejo: un "doble" del dueño que solo existe para el reflejo --------------
let avatar = null, avatarKey = "", avAcc = null;
function outfitLook(id) {
  const f = OUT(id) || O.outfits[0];
  const base = { skin: 0xd9a074, hair: 0x2a1a10, hairStyle: "short", shoes: 0x2a1a10, blob: false };
  return f.vip ? Object.assign(base, { vip: true, jacket: f.jacket, shoes: f.jacket === 0xefe8d8 ? 0xe8e0d0 : 0x0e0e10 }) : Object.assign(base, { shirt: f.color, pants: f.pants, top: f.top });
}
function accMeshes(person, own) { // anteojos de sol, cadena y reloj colgados de los huesos
  const J = person.api.joints, made = [];
  const blackM = A.std(0x101114, 0.2, 0.4), goldM = A.std(0xd9a84a, 0.25, 0.85);
  if (own.anteojos) { const gl = new T.Group(); for (const x of [-0.044, 0.044]) { const l = new T.Mesh(BOX1, blackM); l.scale.set(0.052, 0.03, 0.012); l.position.set(x, 0.146, 0.134); gl.add(l); } const br = new T.Mesh(BOX1, blackM); br.scale.set(0.1, 0.008, 0.008); br.position.set(0, 0.155, 0.134); gl.add(br); J.head.add(gl); made.push(gl); }
  if (own.cadena) { const ch = new T.Mesh(new T.TorusGeometry(0.085, 0.012, 6, 16), goldM); ch.position.set(0, 0.56, 0.085); ch.rotation.x = Math.PI / 2 - 0.35; ch.scale.set(1, 1.25, 1); J.torso.add(ch); made.push(ch); }
  if (own.reloj) { const w = new T.Mesh(CYL1, goldM); w.scale.set(0.07, 0.03, 0.07); w.position.set(0, -0.24, 0); J.elbowL.add(w); made.push(w); }
  return made;
}
function refreshAvatar() {
  const o = OW(), key = o.outfit + "|" + (o.own.anteojos ? 1 : 0) + (o.own.cadena ? 1 : 0) + (o.own.reloj ? 1 : 0);
  if (key === avatarKey && avatar) return;
  avatarKey = key;
  if (avatar) { G.scene.remove(avatar); avatar = null; }
  avatar = A.makePerson(outfitLook(o.outfit)); avatar.visible = false; G.scene.add(avatar);
  avAcc = accMeshes(avatar, o.own);
}

// --- mangas y manos en primera persona ---------------------------------------
const armMats = { sleeve: new T.MeshStandardMaterial({ color: 0x3a5a8a, roughness: 0.8 }), cuff: new T.MeshStandardMaterial({ color: 0xf6f1e6, roughness: 0.7 }), skin: new T.MeshStandardMaterial({ color: 0xd9a074, roughness: 0.75 }), gold: A.std(0xd9a84a, 0.25, 0.85) };
const arms = new T.Group(); arms.name = "ownerArms";
const armParts = [];
for (const side of [-1, 1]) {
  const a = new T.Group();
  const sl = new T.Mesh(CYL1, armMats.sleeve); sl.scale.set(0.085, 0.34, 0.085); sl.rotation.x = Math.PI / 2; sl.position.set(0, -0.015, 0.19); a.add(sl);
  const cf = new T.Mesh(CYL1, armMats.cuff); cf.scale.set(0.079, 0.035, 0.079); cf.rotation.x = Math.PI / 2; cf.position.set(0, -0.012, 0.03); a.add(cf);
  const hd = new T.Mesh(BOX1, armMats.skin); hd.scale.set(0.075, 0.04, 0.1); hd.position.set(0, -0.012, -0.03); a.add(hd);
  const th = new T.Mesh(BOX1, armMats.skin); th.scale.set(0.022, 0.024, 0.05); th.position.set(-side * 0.04, 0.0, -0.02); th.rotation.y = side * 0.4; a.add(th);
  const wt = new T.Mesh(CYL1, armMats.gold); wt.scale.set(0.084, 0.022, 0.084); wt.rotation.x = Math.PI / 2; wt.position.set(0, -0.012, 0.06); wt.visible = false; a.add(wt);
  a.position.set(side * 0.27, -0.25, -0.43); a.rotation.set(0.38, side * 0.22, side * 0.12);
  a.userData = { side, cuff: cf, watch: wt, base: a.position.clone() };
  arms.add(a); armParts.push(a);
}
G.camera.add(arms);
function refreshArms() {
  const o = OW(), f = OUT(o.outfit) || O.outfits[0];
  armMats.sleeve.color.setHex(f.vip ? f.jacket : f.color);
  for (const a of armParts) { a.userData.cuff.visible = !!f.cuff; if (f.cuff) armMats.cuff.color.setHex(f.cuff); a.userData.watch.visible = !!o.own.reloj && a.userData.side < 0; }
  // remera de manga corta: la "manga" es piel
  if (!f.vip && f.top === "tee") armMats.sleeve.color.setHex(f.color);
}

// --- retrato al óleo (arriba de la compu) -----------------------------------
const portraitTex = A.canvasTex(256, 320, () => {});
function drawPortrait() {
  const c = portraitTex.userData.ctx || portraitTex.image.getContext("2d"), W = 256, H = 320, o = OW(), f = OUT(o.outfit) || O.outfits[0];
  const gr = c.createRadialGradient(W / 2, H * 0.4, 20, W / 2, H / 2, 220); gr.addColorStop(0, "#7a2a1a"); gr.addColorStop(1, "#1a0806");
  c.fillStyle = gr; c.fillRect(0, 0, W, H);
  const hex = n => "#" + (n >>> 0).toString(16).padStart(6, "0");
  const suit = hex(f.vip ? f.jacket : f.color), ell = (x, y, rx, ry, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fill(); };
  ell(W / 2, H + 30, 120, 120, suit);
  if (f.vip) { c.fillStyle = hex(f.cuff || 0xf6f1e6); c.beginPath(); c.moveTo(W / 2 - 26, 214); c.lineTo(W / 2, 290); c.lineTo(W / 2 + 26, 214); c.fill(); c.fillStyle = f.jacket === 0xefe8d8 ? "#d9a84a" : "#8e1f26"; c.fillRect(W / 2 - 6, 222, 12, 60); }
  if (o.own.cadena) { c.strokeStyle = "#f0c24a"; c.lineWidth = 6; c.beginPath(); c.ellipse(W / 2, 232, 34, 22, 0, 0.2, Math.PI - 0.2); c.stroke(); }
  ell(W / 2, 200, 22, 24, "#d9a074");
  ell(W / 2, 140, 58, 66, "#d9a074"); ell(W / 2, 92, 56, 30, "#2a1a10");
  ell(W / 2 - 22, 140, 7, o.own.anteojos ? 0 : 7, "#1a1410"); ell(W / 2 + 22, 140, 7, o.own.anteojos ? 0 : 7, "#1a1410");
  if (o.own.anteojos) { c.fillStyle = "#0b0b0d"; c.fillRect(W / 2 - 40, 130, 32, 18); c.fillRect(W / 2 + 8, 130, 32, 18); c.fillRect(W / 2 - 8, 134, 16, 4); }
  c.strokeStyle = "#5a2a1a"; c.lineWidth = 4; c.beginPath(); c.arc(W / 2, 166, 18, 0.2, Math.PI - 0.2); c.stroke();
  c.fillStyle = "#2a1a10"; c.fillRect(W / 2 - 22, 160, 44, 6); // bigote de dueño
  c.globalAlpha = 0.12; for (let i = 0; i < 400; i++) { c.fillStyle = Math.random() < 0.5 ? "#000" : "#fff"; c.fillRect(Math.random() * W, Math.random() * H, 2, 2); } c.globalAlpha = 1;
  c.fillStyle = "#f6c766"; c.font = "bold 18px Georgia, serif"; c.textAlign = "center"; c.fillText("EL DUEÑO", W / 2, H - 14);
  portraitTex.needsUpdate = true;
}

// --- oficina: escritorio de caoba, alfombra, retrato, acuario, caja fuerte dorada --------
const office = {};
office.escritorio = (() => {
  const g = new T.Group(); g.position.set(DESK.x, 0, DESK.z); G.scene.add(g);
  const L = [], mah = 0x5a1a0c, gold = 0xd9a84a;
  part(L, BOX1, mah, 0, 0.775, 0, 1.28, 0.03, 0.66); part(L, BOX1, gold, 0, 0.775, 0.335, 1.3, 0.035, 0.012);
  part(L, BOX1, mah, 0, 0.4, 0.29, 1.24, 0.72, 0.03); part(L, BOX1, gold, 0, 0.66, 0.307, 1.1, 0.02, 0.008); part(L, BOX1, gold, 0, 0.14, 0.307, 1.1, 0.02, 0.008);
  part(L, BOX1, 0x1d5a3a, -0.25, 0.795, 0.12, 0.3, 0.006, 0.18); // carpeta de cuero verde
  part(L, BOX1, gold, 0.2, 0.81, 0.27, 0.22, 0.05, 0.02, 0, -0.3); // placa
  g.add(merged(L, VCG));
  const plate = plane(0.2, 0.04, basicTex(A.canvasTex(128, 26, (c, W, H) => { c.fillStyle = "#d9a84a"; c.fillRect(0, 0, W, H); c.fillStyle = "#3a1a08"; c.font = "bold 17px Georgia, serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("EL DUEÑO", W / 2, H / 2 + 1); })));
  plate.position.set(0.2, 0.816, 0.283); plate.rotation.x = -0.3; g.add(plate);
  return g;
})();
office.alfombra = (() => {
  const m = plane(2.4, 1.5, new T.MeshStandardMaterial({ map: A.canvasTex(256, 160, (c, W, H) => {
    c.fillStyle = "#7a1420"; c.fillRect(0, 0, W, H); c.strokeStyle = "#d9a84a"; c.lineWidth = 6; c.strokeRect(8, 8, W - 16, H - 16);
    c.strokeStyle = "#1a2a5a"; c.lineWidth = 10; c.strokeRect(22, 22, W - 44, H - 44);
    c.fillStyle = "#e8d8b0"; c.beginPath(); c.ellipse(W / 2, H / 2, 48, 30, 0, 0, 7); c.fill(); c.fillStyle = "#1a2a5a"; c.beginPath(); c.ellipse(W / 2, H / 2, 26, 15, 0, 0, 7); c.fill();
    for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? "#d9a84a" : "#e8d8b0"; c.fillRect(40 + i * 23, 34, 10, 10); c.fillRect(40 + i * 23, H - 44, 10, 10); }
  }), roughness: 1 }));
  m.rotation.x = -Math.PI / 2; m.position.set(4.7, 0.008, -8.7); G.scene.add(m); return m;
})();
office.cuadro = (() => {
  const g = new T.Group(); g.position.set(DESK.x, 2.2, -9.83); G.scene.add(g);
  const L = []; part(L, BOX1, 0xc9962e, 0, 0, 0, 0.78, 0.94, 0.05); part(L, BOX1, 0x5a3a12, 0, 0, 0.02, 0.66, 0.82, 0.02);
  g.add(merged(L, VCG));
  const pic = plane(0.62, 0.78, new T.MeshStandardMaterial({ map: portraitTex, roughness: 0.7 })); pic.position.z = 0.035; g.add(pic);
  return g;
})();
const fish = [];
office.acuario = (() => {
  const g = new T.Group(); g.position.set(AQUA.x, 0, AQUA.z); G.scene.add(g);
  const L = []; part(L, BOX1, 0x2e180c, 0, 0.4, 0, AQUA.w, 0.8, AQUA.d); part(L, BOX1, 0xc9962e, 0, 0.81, 0, AQUA.w + 0.02, 0.02, AQUA.d + 0.02);
  part(L, BOX1, 0xe8d8a0, 0, 0.86, 0, AQUA.w - 0.04, 0.06, AQUA.d - 0.04); // arena
  part(L, BOX1, 0x1a1c20, 0, 1.33, 0, AQUA.w + 0.02, 0.04, AQUA.d + 0.02); // tapa
  for (const [x, h] of [[-0.18, 0.22], [-0.12, 0.3], [0.16, 0.18]]) part(L, CYL1, 0x2e8a3a, x, 0.89 + h / 2, -0.06, 0.03, h, 0.03);
  part(L, SPH1, 0x8a8a90, 0.06, 0.92, 0.02, 0.12, 0.08, 0.1);
  g.add(merged(L));
  const water = new T.Mesh(BOX1, new T.MeshStandardMaterial({ color: 0x3aa8d8, transparent: true, opacity: 0.32, roughness: 0.1, metalness: 0.1, depthWrite: false }));
  water.scale.set(AQUA.w - 0.02, 0.44, AQUA.d - 0.02); water.position.y = 1.09; water.renderOrder = 3; g.add(water);
  const glow = plane(AQUA.w - 0.06, 0.02, A.basic(0xbfefff)); glow.rotation.x = Math.PI / 2; glow.position.y = 1.305; g.add(glow);
  const fg = new T.ConeGeometry(0.018, 0.06, 6); fg.rotateZ(-Math.PI / 2);
  for (const col of [0xff7a2a, 0xf0c24a, 0xd4423f, 0x4fc7e6]) { const f = new T.Mesh(fg, A.std(col, 0.4)); g.add(f); fish.push({ m: f, ph: Math.random() * 6, sp: rnd(0.6, 1.1), y: rnd(0.96, 1.24) }); }
  G.boxAt(AQUA.x, AQUA.z, AQUA.w, AQUA.d, "owner");
  return g;
})();

// --- caja fuerte (niveles y enchapado) ---------------------------------------
const vaultGroup = new T.Group(); vaultGroup.position.set(VAULT.x, 0, VAULT.z); G.scene.add(vaultGroup);
let vaultKey = "";
function refreshVault() {
  const o = OW(), key = o.safe + "|" + (o.own.caja_oro ? 1 : 0); if (key === vaultKey) return; vaultKey = key;
  while (vaultGroup.children.length) vaultGroup.remove(vaultGroup.children[0]);
  if (!o.safe && !o.own.caja_oro) return;
  const gold = !!o.own.caja_oro, body = gold ? 0xc9962e : [0x2c3238, 0x3a4048, 0x454c55, 0x4c535c][o.safe], trim = gold ? 0xf0d27a : 0x9aa2ab;
  const w = 0.74 + o.safe * 0.06, h = 0.94 + o.safe * 0.12, d = 0.54;
  const L = [];
  part(L, BOX1, body, 0, h / 2, 0, w, h, d);
  part(L, BOX1, trim, 0, h / 2, d / 2 + 0.005, w - 0.08, h - 0.08, 0.01);
  part(L, BOX1, body, 0, h / 2, d / 2 + 0.012, w - 0.14, h - 0.14, 0.012);
  part(L, CYL1, trim, 0, h * 0.55, d / 2 + 0.03, 0.16 + o.safe * 0.03, 0.03, 0.16 + o.safe * 0.03, 0, Math.PI / 2);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4; part(L, BOX1, trim, Math.cos(a) * 0.0, h * 0.55, d / 2 + 0.05, 0.22 + o.safe * 0.04, 0.02, 0.02, 0, 0, a); }
  if (o.safe >= 2) for (const y of [0.18, h - 0.18]) part(L, BOX1, trim, 0, y, d / 2 + 0.02, w + 0.02, 0.05, 0.02);
  if (o.safe >= 3) for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) for (const y of [0.2, h / 2, h - 0.2]) part(L, SPH1, trim, x, y, d / 2 + 0.03, 0.05, 0.05, 0.03);
  vaultGroup.add(merged(L, VCG));
}
// persiana metálica de la ventanilla y cámaras
const shutter = (() => {
  const tex = A.canvasTex(128, 96, (c, W, H) => { c.fillStyle = "#6a7078"; c.fillRect(0, 0, W, H); for (let y = 0; y < H; y += 8) { c.fillStyle = "#4a5058"; c.fillRect(0, y, W, 3); c.fillStyle = "#8a9098"; c.fillRect(0, y + 3, W, 1); } c.fillStyle = "#f0c24a"; c.fillRect(W / 2 - 10, H - 12, 20, 6); });
  const m = new T.Mesh(new T.PlaneGeometry(0.88, 0.64), new T.MeshStandardMaterial({ map: tex, metalness: 0.5, roughness: 0.5, side: T.DoubleSide }));
  m.position.set(WIN.x, 2.1, WIN.z + 0.04); m.visible = false; G.scene.add(m); return { m, y: 2.1 };
})();
const camGroup = new T.Group(); G.scene.add(camGroup);
const camLeds = [];
const CAM_SPOTS = [[-9.6, 3.25, -6.2, -2.5], [2.7, 3.25, -9.6, 0.7], [-9.6, 3.25, 9.5, -0.6], [9.6, 3.25, 9.5, 0.6], [9.6, 3.25, -6.0, 2.5]];
const ledMat = new T.MeshBasicMaterial({ color: 0xff2a2a });
function refreshCams() {
  while (camGroup.children.length) camGroup.remove(camGroup.children[0]); camLeds.length = 0;
  const n = OW().cam === 0 ? 0 : OW().cam === 1 ? 2 : 5;
  for (let i = 0; i < n; i++) {
    const [x, y, z, ry] = CAM_SPOTS[i], g = new T.Group(); g.position.set(x, y, z); g.rotation.y = ry;
    const L = []; part(L, BOX1, 0xe8e8e4, 0, 0, 0, 0.05, 0.16, 0.05); part(L, BOX1, 0xe8e8e4, 0, -0.1, 0.06, 0.12, 0.1, 0.24, 0, -0.5); part(L, CYL1, 0x15171a, 0, -0.16, 0.17, 0.07, 0.03, 0.07, 0, Math.PI / 2 - 0.5);
    g.add(merged(L)); const led = new T.Mesh(SPH1, ledMat); led.scale.setScalar(0.02); led.position.set(0.04, -0.06, 0.12); g.add(led); camLeds.push(led);
    camGroup.add(g);
  }
}

// --- tablero de seguridad (alarma, persiana, teléfono) --------------------------
const beaconMat = new T.MeshBasicMaterial({ color: 0x5a1010 });
const panelGroup = (() => {
  const g = new T.Group(); g.position.set(PANEL.x, PANEL.y, PANEL.z); G.scene.add(g);
  const L = [];
  part(L, BOX1, 0x2a2c30, 0, 0, 0.02, 0.96, 0.56, 0.04); part(L, BOX1, 0xd9a84a, 0, 0.26, 0.042, 0.96, 0.03, 0.01);
  part(L, CYL1, 0xd4423f, -0.3, -0.02, 0.07, 0.15, 0.05, 0.15, 0, Math.PI / 2); part(L, CYL1, 0xf0c24a, -0.3, -0.02, 0.05, 0.19, 0.02, 0.19, 0, Math.PI / 2); // botón rojo
  part(L, BOX1, 0x9aa2ab, 0, -0.02, 0.06, 0.06, 0.24, 0.03); part(L, BOX1, 0x15171a, 0, 0.08, 0.1, 0.05, 0.05, 0.1); // palanca
  part(L, BOX1, 0xb8202a, 0.3, -0.06, 0.07, 0.2, 0.08, 0.1); part(L, BOX1, 0xb8202a, 0.3, 0.02, 0.09, 0.24, 0.05, 0.06); // teléfono rojo
  g.add(merged(L));
  const lab = plane(0.92, 0.1, basicTex(A.canvasTex(320, 36, (c, W, H) => { c.fillStyle = "#15171a"; c.fillRect(0, 0, W, H); c.fillStyle = "#f6c766"; c.font = "bold 17px Arial, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("ALARMA      PERSIANA      POLICÍA", W / 2, H / 2 + 1); })));
  lab.position.set(0, 0.19, 0.045); g.add(lab);
  const beacon = new T.Mesh(SPH1, beaconMat); beacon.scale.set(0.12, 0.08, 0.12); beacon.position.set(0, 0.36, 0.06); g.add(beacon);
  return g;
})();
G.proxy(panelGroup, 0.28, 0.4, 0.2, { prompt: () => ({ text: hz && hz.alarm ? "Apagar la alarma" : "Tocar la alarma", sub: hz && hz.phase !== "done" ? "Asusta a la banda: se apuran y se llevan menos. Con cámaras, llama sola a la policía." : "Botón rojo de pánico del casino" }), hold: () => 0, use: () => pressAlarm() }, 0, -0.3, 0.1);
G.proxy(panelGroup, 0.26, 0.4, 0.2, { prompt: () => ({ text: OW().shutter ? "Subir la persiana de la bóveda" : "Bajar la persiana de la bóveda", sub: hz && hz.phase !== "done" ? `Les suma ${H.shutterSec} s para forzar la caja fuerte` : "Cierra la ventanilla de la caja fuerte con una persiana de acero" }), hold: () => 0, use: () => toggleShutter() }, 0, 0, 0.1);
G.proxy(panelGroup, 0.28, 0.4, 0.2, { prompt: () => ({ text: hz && hz.police.eta != null ? `La policía viene en camino (${Math.ceil(hz.police.eta)} s)` : "Llamar a la policía", sub: hz && hz.phase !== "done" ? `Tarda unos ${policeEta()} s en llegar` : "Teléfono rojo directo a la comisaría" }), hold: () => 0, use: () => callPolice() }, 0, 0.3, 0.1);

// --- auto en la vereda ------------------------------------------------------------
const carModels = {};
let carGroup = null, carCollider = null, carShown = "";
function wheel(L, x, z, r, w) { part(L, CYL1, 0x121316, x, r, z, r * 2, w, r * 2, 0, Math.PI / 2); part(L, CYL1, 0xb9bec6, x, r, z + Math.sign(z) * 0.02, r * 1.1, w * 0.9 + 0.02, r * 1.1, 0, Math.PI / 2); }
function buildCar(id) {
  const c = CAR(id), L = [], col = c.color, win = 0x1a2430, chrome = 0xc8ccd2, g = new T.Group();
  let len = 4.4, wid = 1.8, lights = [];
  if (id === "fitito") {
    len = 3.0; wid = 1.4;
    part(L, BOX1, col, 0, 0.55, 0, 3.0, 0.5, 1.4); part(L, SPH1, col, 1.2, 0.58, 0, 0.8, 0.5, 1.38); part(L, SPH1, col, -1.25, 0.6, 0, 0.7, 0.54, 1.38);
    part(L, BOX1, col, -0.1, 1.05, 0, 1.7, 0.5, 1.3); part(L, BOX1, win, -0.1, 1.07, 0, 1.6, 0.36, 1.32); part(L, BOX1, win, -0.1, 1.07, 0, 1.74, 0.36, 1.2);
    part(L, BOX1, chrome, 0, 0.38, 0.71, 2.8, 0.04, 0.02); part(L, BOX1, chrome, 0, 0.38, -0.71, 2.8, 0.04, 0.02);
    for (const x of [1.0, -1.0]) for (const z of [0.62, -0.62]) wheel(L, x, z, 0.26, 0.16);
    lights = [[1.58, 0.62, 0.45], [1.58, 0.62, -0.45]];
  } else if (id === "sedan") {
    part(L, BOX1, col, 0, 0.62, 0, 4.4, 0.56, 1.8); part(L, BOX1, col, -0.15, 1.15, 0, 2.3, 0.52, 1.66); part(L, BOX1, win, -0.15, 1.16, 0, 2.2, 0.4, 1.68); part(L, BOX1, win, -0.15, 1.16, 0, 2.36, 0.4, 1.5);
    part(L, BOX1, chrome, 2.21, 0.5, 0, 0.04, 0.12, 1.7); part(L, BOX1, chrome, -2.21, 0.5, 0, 0.04, 0.12, 1.7);
    for (const x of [1.4, -1.4]) for (const z of [0.82, -0.82]) wheel(L, x, z, 0.32, 0.22);
    lights = [[2.22, 0.72, 0.6], [2.22, 0.72, -0.6]];
  } else if (id === "deportivo") {
    len = 4.3; wid = 1.9;
    part(L, BOX1, col, 0, 0.5, 0, 4.3, 0.42, 1.9); part(L, BOX1, col, 1.2, 0.62, 0, 1.8, 0.2, 1.8, 0, 0, -0.08); part(L, BOX1, col, -0.35, 0.86, 0, 1.6, 0.36, 1.6, 0, 0, 0.0);
    part(L, BOX1, win, -0.3, 0.88, 0, 1.5, 0.28, 1.62); part(L, BOX1, win, 0.35, 0.86, 0, 0.5, 0.26, 1.5, 0, 0, -0.7);
    part(L, BOX1, 0x15171a, -2.0, 0.95, 0, 0.3, 0.05, 1.8); part(L, BOX1, 0x15171a, -2.0, 0.8, 0.7, 0.08, 0.26, 0.06); part(L, BOX1, 0x15171a, -2.0, 0.8, -0.7, 0.08, 0.26, 0.06); // alerón
    part(L, BOX1, 0xf0c24a, 0, 0.5, 0.955, 3.6, 0.06, 0.01); part(L, BOX1, 0xf0c24a, 0, 0.5, -0.955, 3.6, 0.06, 0.01);
    for (const x of [1.35, -1.35]) for (const z of [0.86, -0.86]) wheel(L, x, z, 0.33, 0.26);
    lights = [[2.16, 0.56, 0.65], [2.16, 0.56, -0.65]];
  } else {
    len = 6.6; wid = 1.9;
    part(L, BOX1, col, 0, 0.62, 0, 6.6, 0.56, 1.9); part(L, BOX1, col, -0.3, 1.15, 0, 4.6, 0.5, 1.78);
    for (let i = 0; i < 4; i++) part(L, BOX1, win, 1.6 - i * 1.2, 1.17, 0, 0.95, 0.36, 1.8);
    part(L, BOX1, chrome, 0, 0.42, 0.96, 6.4, 0.05, 0.02); part(L, BOX1, chrome, 0, 0.42, -0.96, 6.4, 0.05, 0.02); part(L, BOX1, chrome, 3.31, 0.55, 0, 0.04, 0.2, 1.7); part(L, BOX1, chrome, -3.31, 0.55, 0, 0.04, 0.2, 1.7);
    part(L, BOX1, 0xd9a84a, 3.3, 0.95, 0, 0.04, 0.12, 0.12); // estrellita en el capó
    for (const x of [2.3, 1.2, -2.3]) for (const z of [0.86, -0.86]) wheel(L, x, z, 0.33, 0.22);
    lights = [[3.32, 0.72, 0.62], [3.32, 0.72, -0.62]];
  }
  g.add(merged(L, VCG));
  for (const [x, y, z] of lights) { const h = new T.Mesh(BOX1, A.basic(0xfff3c8)); h.scale.set(0.03, 0.12, 0.28); h.position.set(x, y, z); g.add(h); const t = new T.Mesh(BOX1, A.basic(0xd4202a)); t.scale.set(0.03, 0.12, 0.24); t.position.set(-x, y, z); g.add(t); }
  A.addBlob(g, len + 0.4, wid + 0.3);
  g.userData = { len, wid }; return g;
}
function refreshCar() {
  const id = OW().car || "";
  if (id === carShown) return; carShown = id;
  if (carGroup) { G.scene.remove(carGroup); carGroup = null; }
  if (carCollider) { G.removeCollider(carCollider); carCollider = null; }
  if (!id) return;
  carGroup = carModels[id] || (carModels[id] = buildCar(id));
  carGroup.position.set(CARP.x + (carGroup.userData.len > 5 ? 0.6 : 0), 0, CARP.z); carGroup.rotation.y = Math.PI; G.scene.add(carGroup);
  carCollider = G.boxAt(carGroup.position.x, CARP.z, carGroup.userData.len, carGroup.userData.wid, "owner");
}
G.proxy(G.scene, 2.6, 1.4, 1.6, { soft: false, prompt: () => OW().car ? ({ text: `Tu ${CAR(OW().car).name}`, sub: `Imagen +${CAR(OW().car).img} · lo ven todos los que entran` }) : ({ text: "", sub: "" }), hold: () => 0, usable: () => !!OW().car, use: () => openOwner("own_img") }, 0.7, CARP.x, CARP.z);

// --- publicidad visible: cartel en la ruta, volantes en la fachada, radio en el escritorio -------
const bbTex = A.canvasTex(1024, 448, () => {});
let bbMode = "";
function drawBillboard(on) {
  const m = on ? "on" : "off"; if (m === bbMode) return; bbMode = m;
  const c = bbTex.userData.ctx || bbTex.image.getContext("2d"), W = 1024, Hh = 448;
  c.textAlign = "center"; c.textBaseline = "middle";
  if (on) {
    const gr = c.createLinearGradient(0, 0, 0, Hh); gr.addColorStop(0, "#5a0e18"); gr.addColorStop(1, "#1a0408"); c.fillStyle = gr; c.fillRect(0, 0, W, Hh);
    c.strokeStyle = "#d9a84a"; c.lineWidth = 14; c.strokeRect(14, 14, W - 28, Hh - 28);
    c.fillStyle = "#f6c766"; c.font = "bold 128px Georgia, serif"; c.fillText("CASINO DORADO", W / 2, 150);
    c.fillStyle = "#f3e9d2"; c.font = "bold 50px Arial, sans-serif"; c.fillText("Mesas VIP · Jackpots · Tragos", W / 2, 260);
    c.fillStyle = "#6fd39b"; c.font = "bold 58px Arial, sans-serif"; c.fillText("¡A 50 METROS! ⟶", W / 2, 352);
    for (let i = 0; i < 12; i++) { c.fillStyle = "#f6c766"; c.beginPath(); c.arc(60 + i * 82, 410, 9, 0, 7); c.fill(); }
  } else {
    c.fillStyle = "#c8c4ba"; c.fillRect(0, 0, W, Hh); c.fillStyle = "#3a3f4a"; c.font = "bold 92px Arial, sans-serif"; c.fillText("ESPACIO DISPONIBLE", W / 2, Hh / 2 - 40);
    c.font = "bold 44px Arial, sans-serif"; c.fillText("Publicite aquí · 4000-CARTEL", W / 2, Hh / 2 + 60);
  }
  bbTex.needsUpdate = true;
}
const billboard = (() => {
  const g = new T.Group(); g.position.set(BB.x, 0, BB.z); G.scene.add(g);
  const L = []; for (const x of [-2.6, 2.6]) part(L, BOX1, 0x3a3f4a, x, 2.2, -0.1, 0.22, 4.4, 0.22);
  part(L, BOX1, 0x2a2c30, 0, 5.2, -0.12, 7.4, 3.4, 0.18); part(L, BOX1, 0x3a3f4a, 0, 3.4, 0.25, 7.2, 0.08, 0.6);
  g.add(merged(L));
  const face = plane(7.0, 3.06, basicTex(bbTex)); face.position.set(0, 5.2, -0.02); g.add(face);
  return g;
})();
const flyerGroup = (() => {
  const g = new T.Group(); G.scene.add(g);
  const tex = A.canvasTex(128, 180, (c, W, Hh) => { c.fillStyle = "#f3e9d2"; c.fillRect(0, 0, W, Hh); c.fillStyle = "#b8202a"; c.fillRect(0, 0, W, 40); c.fillStyle = "#fff"; c.font = "bold 22px Arial"; c.textAlign = "center"; c.fillText("¡VENÍ!", W / 2, 28); c.fillStyle = "#07140f"; c.font = "bold 18px Georgia"; c.fillText("Casino", W / 2, 76); c.fillText("Dorado", W / 2, 98); c.fillStyle = "#d9a84a"; c.font = "bold 40px Georgia"; c.fillText("777", W / 2, 146); });
  const mat = new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide });
  for (const [x, y, r] of [[-4.2, 1.4, 0.08], [-4.9, 1.55, -0.1], [4.3, 1.45, -0.06], [5.0, 1.3, 0.12], [-5.6, 1.25, 0.04]]) { const p = plane(0.34, 0.48, mat); p.position.set(x, y, -10.47); p.rotation.set(0, Math.PI, r); g.add(p); }
  for (let i = 0; i < 7; i++) { const p = plane(0.2, 0.28, mat); p.rotation.set(-Math.PI / 2, 0, Math.random() * 6); p.position.set(rnd(-3, 3), 0.03, rnd(-14, -11)); g.add(p); }
  g.visible = false; return g;
})();
const radio = (() => {
  const g = new T.Group(); g.position.set(DESK.x + 0.4, 0.79, DESK.z - 0.16); G.scene.add(g);
  const L = []; part(L, BOX1, 0x8a2a1a, 0, 0.07, 0, 0.26, 0.14, 0.1); part(L, CYL1, 0xd9c8a0, -0.06, 0.07, 0.052, 0.09, 0.01, 0.09, 0, Math.PI / 2); part(L, BOX1, 0xd9a84a, 0.07, 0.09, 0.052, 0.08, 0.03, 0.01); part(L, CYL1, 0xb9bec6, 0.1, 0.25, -0.02, 0.008, 0.25, 0.008);
  g.add(merged(L)); g.visible = false; return g;
})();
function refreshAdsVisual() {
  const ids = new Set(OW().ads.map(a => a.id));
  drawBillboard(ids.has("cartel")); flyerGroup.visible = ids.has("volantes"); radio.visible = ids.has("radio");
}

// --- camioneta de la banda y patrullero -----------------------------------------------
function buildVan() {
  const g = new T.Group(), L = [];
  part(L, BOX1, 0x2a2c30, 0, 1.15, 0, 4.6, 1.7, 2.0); part(L, BOX1, 0x2a2c30, 2.55, 0.85, 0, 0.6, 1.1, 1.96);
  part(L, BOX1, 0x1a2430, 2.4, 1.55, 0, 0.5, 0.5, 1.98); part(L, BOX1, 0x1a2430, 1.9, 1.5, 0, 0.6, 0.45, 2.02);
  part(L, BOX1, 0x15171a, 0, 0.32, 0, 4.4, 0.1, 1.9);
  for (const x of [1.7, -1.5]) for (const z of [0.9, -0.9]) wheel(L, x, z, 0.36, 0.26);
  g.add(merged(L, VCG));
  const side = plane(2.6, 0.9, basicTex(A.canvasTex(256, 90, (c, W, Hh) => { c.fillStyle = "#2a2c30"; c.fillRect(0, 0, W, Hh); c.fillStyle = "#c9ced4"; c.font = "bold 30px Arial"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("FLORERÍA", W / 2, 30); c.font = "bold 22px Arial"; c.fillText("«LA INOCENTE»", W / 2, 66); })));
  side.position.set(-0.4, 1.3, 1.01); g.add(side);
  const flat = new T.Mesh(SPH1, A.std(0x121316, 0.9)); flat.visible = false; flat.scale.set(0.8, 0.12, 0.3); flat.position.set(1.7, 0.06, 1.0); g.add(flat);
  g.userData.flat = flat; g.visible = false; G.scene.add(g);
  return g;
}
const policeLights = [new T.MeshBasicMaterial({ color: 0xff2a2a }), new T.MeshBasicMaterial({ color: 0x2a6aff })];
function buildPolice() {
  const g = new T.Group(), L = [];
  part(L, BOX1, 0xf2f2f0, 0, 0.62, 0, 4.4, 0.56, 1.8); part(L, BOX1, 0x1a2a6a, 0, 0.62, 0, 4.42, 0.2, 1.82); part(L, BOX1, 0xf2f2f0, -0.1, 1.15, 0, 2.3, 0.52, 1.66); part(L, BOX1, 0x1a2430, -0.1, 1.16, 0, 2.2, 0.4, 1.68);
  for (const x of [1.4, -1.4]) for (const z of [0.82, -0.82]) wheel(L, x, z, 0.32, 0.22);
  g.add(merged(L, VCG));
  for (let i = 0; i < 2; i++) { const b = new T.Mesh(BOX1, policeLights[i]); b.scale.set(0.3, 0.14, 0.55); b.position.set(-0.1, 1.48, i ? -0.3 : 0.3); g.add(b); }
  const lab = plane(1.6, 0.3, basicTex(A.canvasTex(256, 48, (c, W, Hh) => { c.fillStyle = "#f2f2f0"; c.fillRect(0, 0, W, Hh); c.fillStyle = "#1a2a6a"; c.font = "bold 36px Arial"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("POLICÍA", W / 2, Hh / 2 + 2); })));
  lab.position.set(0, 0.82, 0.915); g.add(lab);
  g.visible = false; G.scene.add(g); return g;
}
let van = null, police = null;

// --- accesorios de los personajes (máscaras, bolsas, anteojos, celular) ---------------------
const maskM = A.std(0x15171a, 0.85), eyeM = A.basic(0xffffff), bagM = new T.MeshStandardMaterial({ map: A.canvasTex(64, 64, (c, W, Hh) => { c.fillStyle = "#b8a888"; c.fillRect(0, 0, W, Hh); c.fillStyle = "#2a5a2a"; c.font = "bold 40px Georgia"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("$", W / 2, Hh / 2 + 2); }), roughness: 0.95 });
const beanieGeo = new T.SphereGeometry(0.152, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), bandGeo = new T.SphereGeometry(0.14, 14, 3, Math.PI / 2 - 0.95, 1.9, 0.42 * Math.PI, 0.1 * Math.PI);
function addExtra(c, obj, bone) { (c.person.api.joints[bone] || c.person.group).add(obj); (c.ownerExtras || (c.ownerExtras = [])).push(obj); return obj; }
function dressCrew(c) {
  const beanie = new T.Mesh(beanieGeo, maskM); beanie.position.set(0, 0.15, -0.012); addExtra(c, beanie, "head");
  const band = new T.Mesh(bandGeo, maskM); band.position.set(0, 0.13, 0); addExtra(c, band, "head");
  for (const x of [-0.042, 0.042]) { const e = new T.Mesh(SPH1, eyeM); e.scale.set(0.03, 0.022, 0.01); e.position.set(x, 0.148, 0.133); addExtra(c, e, "head"); }
}
function giveBag(c) { const b = new T.Mesh(SPH1, bagM); b.scale.set(0.34, 0.4, 0.26); b.position.set(0, 0.32, -0.22); addExtra(c, b, "torso"); c.owner.bagMesh = b; }
function dropBag(c) { const b = c.owner && c.owner.bagMesh; if (b) { b.visible = false; c.owner.bagMesh = null; } }
function dressShady(c) { const gl = new T.Group(); for (const x of [-0.044, 0.044]) { const l = new T.Mesh(BOX1, maskM); l.scale.set(0.055, 0.032, 0.012); l.position.set(x, 0.146, 0.136); gl.add(l); } addExtra(c, gl, "head"); }
function givePhone(c) { const ph = new T.Mesh(BOX1, A.std(0x15171a, 0.3, 0.3)); ph.scale.set(0.06, 0.11, 0.012); ph.position.set(0, -0.32, 0.08); addExtra(c, ph, "elbowR"); }
const qIcon = new T.SpriteMaterial({ map: A.canvasTex(64, 64, g => { g.fillStyle = "#f0c24a"; g.beginPath(); g.arc(32, 32, 28, 0, 7); g.fill(); g.fillStyle = "#07140f"; g.font = "bold 44px Arial"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("?", 32, 35); }), depthTest: false });
const camIcon = new T.SpriteMaterial({ map: A.canvasTex(64, 64, g => { g.fillStyle = "#ff6ab0"; g.beginPath(); g.arc(32, 32, 28, 0, 7); g.fill(); g.fillStyle = "#fff"; g.fillRect(16, 24, 24, 18); g.beginPath(); g.moveTo(40, 30); g.lineTo(50, 24); g.lineTo(50, 42); g.lineTo(40, 36); g.fill(); }), depthTest: false });
function addIcon(c, mat) { const s = new T.Sprite(mat); s.scale.set(0.34, 0.34, 1); s.position.y = 2.38; s.renderOrder = 10; addExtra(c, s, null); return s; }
function onDespawn(c) {
  if (c.ownerExtras) { for (const o of c.ownerExtras) if (o.parent) o.parent.remove(o); c.ownerExtras = null; }
  if (c.owner && hz) { const i = hz.crew.indexOf(c); if (i >= 0 && c.owner.st !== "gone") c.owner.st = "gone"; }
  if (c.owner) c.owner = null;
}

// =====================================================================
// ACTORES: sospechosos, influencer y banda (game.js deja de moverlos mientras c.owner exista)
// =====================================================================
function spawnOwned(type, role) {
  crewSpawning = true; let c = null;
  try { c = G.spawnCustomer(type, false); } finally { crewSpawning = false; }
  if (!c) return null;
  S().today.st.visitors = Math.max(0, S().today.st.visitors - 1);
  c.shopPlan = null; c.wantsDrink = false; c.thief = true; // "thief" = nadie más lo usa (life.js, kiosco); el robo real lo maneja owner.js
  c.ownerSaved = c.interact; c.owner = Object.assign({ role, st: "in", t: 0 }, {});
  return c;
}
function release(c, leave) { // vuelve a ser un cliente común (o se va)
  if (!c || c.dead) return;
  c.owner = null; c.thief = false; if (c.ownerSaved) c.interact = c.ownerSaved;
  if (leave) { c.thief = true; G.leaveCustomer(c); } else { c.state = G.isOpen ? "choose" : "leave"; if (!G.isOpen) G.leaveCustomer(c); }
}
function pathVia(c, via, x, z) { // la grilla de navegación termina en la vereda: tramo recto hasta el cordón
  const ox = c.x, oz = c.z; c.x = via.x; c.z = via.z; G.goTo(c, x, z); c.x = ox; c.z = oz;
  c.path = [{ x: via.x, z: via.z }].concat(c.path || []);
}

// --- sospechosos que estudian el lugar ------------------------------------------------
function spawnCaser() {
  const c = spawnOwned("casual", "caser"); if (!c) return null;
  dressShady(c); if (OW().cam > 0) addIcon(c, qIcon);
  c.owner.spots = CASE_SPOTS.slice().sort(() => Math.random() - 0.5).slice(0, 3); c.owner.i = 0; c.owner.st = "enter";
  c.interact = {
    soft: false,
    prompt: () => ({ text: "Un tipo raro, de anteojos negros", sub: c.owner && c.owner.st === "look" ? "Mira la caja fuerte y anota algo. Encaralo." : "Da vueltas sin jugar. Encaralo." }),
    hold: () => 0, usable: () => !!c.owner, use: () => confront(c),
  };
  return c;
}
function confront(c) {
  if (!c.owner) return;
  const o = OW(), hd = o.heist;
  G.sfx("grumble", c.x, c.z); G.floatText(c.x, 2.2, c.z, "¡Yo no fui!", "#f0c24a");
  if (hd.day && !hd.known) { hd.known = 1; G.toast(`Lo encaraste y se le cayó una libretita: «caja fuerte · día ${hd.day} · 22:30». ¡Te quieren robar! Prepará guardias, la persiana y la policía.`, "bad"); }
  else if (hd.day) G.toast("Se fue apurado. Ya sabés lo que planean: esa noche, a las 22:30.", "");
  else G.toast("Le preguntaste qué miraba y se fue rápido.", "");
  G.Rank.add(10); release(c, true); G.save(true);
}
function caserTick(c, dt) {
  const w = c.owner;
  if (w.st === "enter") { if (G.stepAgent(c, dt, c.speed)) { G.sfx("door", c.x, c.z); w.st = "go"; const s = w.spots[w.i]; G.goTo(c, s.x, s.z); } return true; }
  if (w.st === "go") { if (G.stepAgent(c, dt, c.speed * 0.8)) { w.st = "look"; w.t = rnd(5, 8); const s = w.spots[w.i]; G.faceTo(c, s.look.x, s.look.z); } return true; }
  if (w.st === "look") {
    c.person.api.idle(dt); w.t -= dt;
    if (w.t <= 0) { w.i++; if (w.i >= w.spots.length) { release(c, true); return true; } w.st = "go"; const s = w.spots[w.i]; G.goTo(c, s.x, s.z); }
    return true;
  }
  return false;
}

// --- influencer -------------------------------------------------------------------------
function spawnInfluencer() {
  const c = spawnOwned("regular", "infl"); if (!c) return null;
  givePhone(c); addIcon(c, camIcon); c.owner.st = "enter"; c.owner.i = 0;
  c.owner.spots = [{ x: 0, z: -6.4 }, { x: -4.5, z: 0 }, { x: 4.5, z: 0.5 }, { x: 0, z: 4.6 }];
  OW().infl.came = 1;
  G.toast(`Llegó la influencer con el celular en alto. Recibila (miralo y ${KEY}) para que hable bien del casino.`, "good"); G.sfx("vip", c.x, c.z);
  c.interact = {
    soft: false,
    prompt: () => OW().infl.greeted ? ({ text: "La influencer está filmando", sub: "«¡Chicos, miren este lugar!»" }) : ({ text: "Recibir a la influencer", sub: "Un tour con el dueño: la campaña rinde más" }),
    hold: () => 0, usable: () => !OW().infl.greeted, use: () => greetInfluencer(c),
  };
  return c;
}
function greetInfluencer(c) {
  const o = OW(); if (o.infl.greeted) return;
  o.infl.greeted = 1; const a = o.ads.find(x => x.id === "influencer"); if (a) a.k = O.influencerGreetMul;
  G.sfx("greet", c.x, c.z); G.floatText(c.x, 2.3, c.z, "♥ ¡Like!", "#ff6ab0");
  c.person.api.cheer(1.2); G.toast(`La recibiste vos: «¡El dueño en persona! Imagen ${Math.round(image())}, re ${imageLabel(image()).toLowerCase()}». La campaña rinde ${Math.round((O.influencerGreetMul - 1) * 100)}% más.`, "good");
  G.Rank.add(20); G.save(true);
}
function inflTick(c, dt) {
  const w = c.owner;
  if (w.st === "enter") { if (G.stepAgent(c, dt, c.speed)) { G.sfx("door", c.x, c.z); w.st = "go"; const s = w.spots[w.i]; G.goTo(c, s.x, s.z); } return true; }
  if (w.st === "go") { if (G.stepAgent(c, dt, c.speed * 0.85)) { w.st = "film"; w.t = rnd(4, 6); c.person.api.gesture("press", 0.8); } return true; }
  if (w.st === "film") {
    c.person.api.play(dt); w.t -= dt; c.person.group.rotation.y += dt * 0.6;
    if (w.t <= 0) { w.i++; if (w.i >= w.spots.length) { for (const o of c.ownerExtras || []) if (o.isSprite) o.visible = false; release(c, false); return true; } w.st = "go"; const s = w.spots[w.i]; G.goTo(c, s.x, s.z); }
    return true;
  }
  return false;
}

// =====================================================================
// ROBO PLANEADO
// =====================================================================
let hz = null;          // robo en curso (no se guarda: si recargás a mitad, la banda vuelve a llegar)
let heistResult = null; // cartel de resultado en el HUD
function policeEta() { return Math.max(15, H.policeSec - H.policePerCam * OW().cam); }
function crackTime() { return H.crackSec + H.crackPerSafe * OW().safe + (OW().shutter ? H.shutterSec : 0); }
function potentialLoot() { const s = S(); return Math.max(0, Math.round(Math.min(Math.max(0, s.bank) * Math.max(0.05, H.lootFrac - H.lootFracPerSafe * OW().safe), H.lootCap))); }
function heistChance() {
  const s = S(), o = OW(); if (s.day < H.minDay || s.bank < H.minBank || o.heist.day || (o.heist.last && s.day - o.heist.last < H.cooldown)) return 0;
  return clamp(H.chanceBase + H.chanceBank * Math.min(1, s.bank / H.bankRef) + H.chanceHeat * s.heat / 100 - H.chanceCam * o.cam, 0, 0.5);
}
function scheduleHeist(day) { const o = OW(); o.heist.day = day; o.heist.known = 0; o.heist.tip = 0; o.heist.done = 0; }
function heistTonight() { return ensure() && OW().heist.day === S().day && OW().heist.done !== S().day; }
function crewActive(c) { return c && !c.dead && c.owner && c.owner.role === "crew" && (c.owner.st === "in" || c.owner.st === "crack" || c.owner.st === "run"); }
function startHeist() {
  if (hz || !ensure()) return false;
  const s = S(), o = OW();
  o.heist.done = s.day; o.heist.last = s.day;
  if (!van) van = buildVan(); if (!police) police = buildPolice();
  hz = { phase: "arrive", t: 0, crew: [], n: s.bank >= H.crewBigBank ? H.crew + 1 : H.crew, work: 0, alarm: false, alarmT: 0, police: { eta: null, state: "idle", x: 48 }, aware: o.cam > 0, awareT: H.guardNoticeSec,
    van: { x: -48, state: "in", wait: -1, flat: false, flatT: 0, collider: null }, loot: 0, lost: 0, recovered: 0, tackleCd: 0, bonked: 0, arrested: 0, startMin: s.minutes, msg: "" };
  van.visible = true; van.userData.flat.visible = false; van.position.set(hz.van.x, 0, VAN_Z);
  G.setSpeed(1);
  G.sfx("inspector") || G.SFX.alarm();
  G.toast("¡Frenó una camioneta de «florería» enfrente! Bajan tipos con pasamontañas. Es el robo: ¡a defender la caja fuerte!", "bad");
  return true;
}
function spawnCrew() {
  for (let i = 0; i < hz.n; i++) {
    const c = spawnOwned("casual", "crew"); if (!c) continue;
    dressCrew(c); c.owner.i = i; c.owner.bag = 0; c.owner.st = "in";
    const x = VAN_X - 1.4 + i * 0.9; G.placeAgent(c, x, VAN_Z + 1.2);
    const s = SAFE_SPOTS[i % SAFE_SPOTS.length]; pathVia(c, { x: x * 0.4, z: CURB_Z }, s.x, s.z); c.owner.spot = s;
    c.speed = 2.9;
    c.interact = crewInteract(c);
    hz.crew.push(c);
  }
}
function crewInteract(c) {
  return {
    soft: false,
    prompt: () => {
      const w = c.owner; if (!w) return { text: "" };
      const close = G.near(c.x, c.z, 2.3);
      if (w.st === "run") return { text: close ? `¡Taclealo! Lleva ${fmt(w.bag)}` : `Se escapa con ${fmt(w.bag)}`, sub: close ? "Le sacás la bolsa" : "Acercate más para taclearlo" };
      return { text: close ? "¡Taclear al ladrón!" : "Ladrón enmascarado", sub: close ? "Un empujón de dibujito animado" : "Acercate para taclearlo" };
    },
    hold: () => 0, usable: () => !!c.owner && crewActive(c) && G.near(c.x, c.z, 2.3) && (!hz || hz.tackleCd <= 0), use: () => tackle(c),
  };
}
function tackle(c) {
  if (!hz || !crewActive(c) || hz.tackleCd > 0) return;
  hz.tackleCd = H.tackleCd; G.Rank.add(25);
  knock(c, G.player.x, G.player.z, null);
  G.floatText(c.x, 2.4, c.z, "¡TACLE!", "#ffd45a");
}
function knock(c, fx, fz, guard) { // derribo cómico (reusa el de game.js: estado "caught" con c.knock)
  const w = c.owner; if (!w) return;
  if (w.bag > 0) { hz.recovered += w.bag; G.floatText(c.x, 2.0, c.z, `+${fmt(w.bag)} recuperado`, "#6fd39b"); G.sfx("collect", c.x, c.z); w.bag = 0; dropBag(c); }
  hz.bonked++;
  w.st = "down"; c.owner = null; c.thief = true; if (c.ownerSaved) c.interact = c.ownerSaved;
  c.path = null; c.state = "caught"; c.person.api.stand();
  c.person.group.rotation.y = Math.atan2(fx - c.x, fz - c.z); c.person.api.face("surprised", 0.8);
  c.knock = { t: guard ? 0 : 0.45, hit: false, landed: false, dx: 0, dz: 0, stars: null };
  if (guard) {
    guard.ownerTask = null; guard.state = "bonk"; guard.bonk = { c, t: 0 }; guard.path = null; G.faceTo(guard, c.x, c.z);
    if (guard.person.bat) guard.person.bat.visible = true; guard.person.api.gesture("swing", 1.0);
  }
}
function arrest(c) {
  const w = c.owner; if (!w) return;
  if (w.bag > 0) { hz.recovered += w.bag; w.bag = 0; dropBag(c); }
  hz.arrested++;
  w.st = "down"; c.owner = null; c.thief = true; if (c.ownerSaved) c.interact = c.ownerSaved;
  c.state = "caught"; c.person.api.face("sad", 30); c.person.api.stand();
  if (c.z < -10.4) c.path = [{ x: POL_X, z: CURB_Z }];
  else { G.goTo(c, 0, -9.4); c.path = (c.path || []).concat([{ x: 0, z: -12 }, { x: POL_X, z: CURB_Z }]); }
}
function pressAlarm() {
  if (!hz || hz.phase === "done") {
    G.sfx("alarm") || G.SFX.alarm(); G.toast("Probaste la alarma: anda. Los clientes se asustaron un poquito.", ""); return;
  }
  hz.alarm = !hz.alarm; hz.alarmT = 0;
  if (hz.alarm) {
    hz.aware = true;
    G.toast(`¡ALARMA! La banda se pone nerviosa: se apura y se lleva menos.${OW().cam > 0 ? " El monitoreo avisó a la policía." : " Sin cámaras, nadie más se entera: llamá a la policía."}`, "bad");
    if (OW().cam > 0 && hz.police.eta == null) callPolice(true);
  } else G.toast("Apagaste la alarma.", "");
}
function toggleShutter() {
  const o = OW(); o.shutter = !o.shutter; G.sfx("repair", WIN.x, WIN.z) || G.SFX.tick();
  if (hz && hz.phase !== "done" && o.shutter) G.toast(`Bajaste la persiana de acero: tienen que cortarla (+${H.shutterSec} s).`, "good");
  else if (!hz) G.toast(o.shutter ? "Bajaste la persiana de la bóveda." : "Subiste la persiana de la bóveda.", "");
}
function callPolice(auto) {
  if (!hz || hz.phase === "done") { G.toast("Llamaste a la comisaría. «¿Y qué pasó?» «Nada, probaba.» Cortaron.", ""); G.sfx("tick"); return; }
  if (hz.police.eta != null) return;
  hz.police.eta = policeEta();
  if (!auto) G.toast(`Llamaste a la policía: llegan en unos ${hz.police.eta} segundos. ¡Aguantá!`, "good");
  G.sfx("tick") || G.SFX.tick();
}
const vanInteract = {
  prompt: () => hz && hz.van.flat ? ({ text: "Camioneta con una goma pinchada", sub: "No se va a ningún lado" }) : ({ text: "Pinchar una goma de la camioneta", sub: "Mantené: sin camioneta no hay escape" }),
  hold: () => hz && !hz.van.flat ? H.punctureSec : 0, usable: () => !!hz && !hz.van.flat && (hz.van.state === "wait" || hz.van.state === "park"),
  use: () => puncture(),
};
let vanProxy = null;
function puncture() {
  if (!hz || hz.van.flat) return;
  hz.van.flat = true; van.userData.flat.visible = true; G.sfx("thud", hz.van.x, VAN_Z); G.floatText(hz.van.x, 2.2, VAN_Z, "¡PFFFSS!", "#f0c24a");
  G.Rank.add(40);
  let rec = 0;
  for (const c of hz.crew) if (c.owner && (c.owner.st === "aboard" || c.owner.st === "run")) { rec += c.owner.bag; hz.recovered += c.owner.bag; c.owner.bag = 0; dropBag(c); fleeOnFoot(c); }
  G.toast(`¡Pinchaste la goma! La banda larga las bolsas y sale corriendo a pie.${rec ? ` Recuperaste ${fmt(rec)}.` : ""}`, "good");
}
function fleeOnFoot(c) {
  const w = c.owner; w.st = "gone";
  c.person.group.visible = true; c.owner = null; c.thief = true; if (c.ownerSaved) c.interact = c.ownerSaved;
  c.state = "flee"; c.path = [{ x: c.x + (Math.random() < 0.5 ? -14 : 14), z: VAN_Z + rnd(-0.6, 0.6) }];
}
function crewTick(c, dt) {
  const w = c.owner; if (!hz) { release(c, true); return true; }
  const p = c.person;
  if (w.st === "in") {
    if (G.stepAgent(c, dt, c.speed)) { w.st = "crack"; G.faceTo(c, WIN.x, WIN.z); if (hz.phase === "enter") { hz.phase = "crack"; G.toast("¡Están forzando la caja fuerte! Mirá la barra de arriba.", "bad"); } }
    return true;
  }
  if (w.st === "crack") { p.api.play(dt); return true; }
  if (w.st === "run") { if (G.stepAgent(c, dt, 3.7)) { if (hz.van.flat || hz.van.state === "out" || hz.van.state === "gone") { if (w.bag) { hz.recovered += w.bag; G.floatText(c.x, 2.0, c.z, `+${fmt(w.bag)} recuperado`, "#6fd39b"); } w.bag = 0; dropBag(c); fleeOnFoot(c); return true; } w.st = "aboard"; p.group.visible = false; if (hz.van.wait < 0) hz.van.wait = H.vanWait; G.sfx("door", c.x, c.z); } return true; }
  if (w.st === "aboard") { G.placeAgent(c, hz.van.x, VAN_Z); return true; }
  return true;
}
function staffTask(n, dt) { // guardia corriendo a un ladrón de la banda
  const c = n.ownerTask;
  if (!hz || !crewActive(c) || n.lifeTask) { n.ownerTask = null; n.state = "patrol"; n.path = null; return false; }
  n.t -= dt; if (n.t <= 0 || !n.path || !n.path.length) { n.t = 0.5; G.goTo(n, c.x, c.z); }
  G.stepAgent(n, dt, 4.4);
  if (Math.hypot(n.x - c.x, n.z - c.z) < 1.15) {
    if (!c.owner.dodged && Math.random() < H.dodge) { // el primero esquiva el batazo (dibujito animado)
      c.owner.dodged = true; n.ownerTask = null; n.state = "bonk"; n.bonk = { c, t: 0.4 }; n.path = null; G.faceTo(n, c.x, c.z);
      if (n.person.bat) n.person.bat.visible = true; n.person.api.gesture("swing", 1.0); G.sfx("tick", c.x, c.z); G.floatText(c.x, 2.4, c.z, "¡Esquivó!", "#f0c24a"); c.person.api.face("surprised", 1);
      return true;
    }
    knock(c, n.x, n.z, n); G.floatText(c.x, 2.4, c.z, "¡BONK!", "#ffd45a");
  }
  return true;
}
function assignGuards() {
  if (!hz.aware) return;
  const taken = new Set(); for (const n of G.staffNpcs) if (n.ownerTask) taken.add(n.ownerTask);
  for (const n of G.staffNpcs) {
    if (n.role !== "sec" || n.ownerTask || n.lifeTask || n.state === "bonk" || n.dead) continue;
    let best = null, bd = Infinity;
    for (const c of hz.crew) if (crewActive(c) && !taken.has(c) && c.z > -16.8) { const d = Math.hypot(n.x - c.x, n.z - c.z); if (d < bd) { bd = d; best = c; } }
    if (!best) for (const c of hz.crew) if (crewActive(c) && c.z > -16.8) { best = c; break; }
    if (best) { n.ownerTask = best; n.t = 0; n.path = null; taken.add(best); if (!hz.guardSaid) { hz.guardSaid = true; G.toast("Los guardias sacan el bate y van por la banda.", "good"); } }
  }
}
function heistUpdate(dt) {
  const h = hz, s = S();
  h.t += dt; h.tackleCd = Math.max(0, h.tackleCd - dt);
  if (s.minutes > 23.75 * 60) s.minutes = 23.75 * 60; // la noche no termina hasta que se resuelva
  // alarma
  if (h.alarm) { h.alarmT -= dt; if (h.alarmT <= 0) { h.alarmT = 1.3; G.sfx("alarm") || G.SFX.alarm(); } }
  // camioneta
  const V = h.van;
  if (V.state === "in") { const v = clamp((VAN_X - V.x) * 0.9, 2.5, 16); V.x += v * dt; if (V.x >= VAN_X - 0.02) { V.x = VAN_X; V.state = "park"; h.phase = "enter"; G.sfx("truck", V.x, VAN_Z); spawnCrew(); V.collider = G.boxAt(VAN_X, VAN_Z, 5.2, 2.1, "owner"); if (!vanProxy) vanProxy = G.proxy(van, 5.0, 2.0, 2.2, vanInteract, 1.0, 0, 0); } }
  else if (V.state === "park" || V.state === "wait") {
    if (V.wait >= 0 && !V.flat) {
      V.wait -= dt; V.state = "wait";
      const pending = h.crew.some(c => c.owner && c.owner.st === "run");
      if (V.wait <= 0 || !pending) leaveVan();
    }
  } else if (V.state === "out") { V.v = Math.min(18, (V.v || 1) + dt * 6); V.x += V.v * dt; if (V.x > 48) { V.state = "gone"; van.visible = false; } }
  van.position.x = V.x;
  // guardias
  if (!h.aware && h.phase !== "arrive") { h.awareT -= dt; if (h.awareT <= 0 || h.crew.some(c => crewActive(c) && G.near(c.x, c.z, 5))) { h.aware = true; } }
  assignGuards();
  // forzando la caja fuerte
  if (h.phase === "crack") {
    const n0 = h.crew.length || 1, at = h.crew.filter(c => c.owner && c.owner.st === "crack").length;
    h.work += dt * (at / n0) * (h.alarm ? H.alarmHurry : 1);
    h.sparkT = (h.sparkT || 0) - dt;
    if (at && h.sparkT <= 0) { h.sparkT = 1.6; G.sfx("repair", WIN.x, WIN.z); if (G.near(WIN.x, WIN.z, 12)) G.floatText(WIN.x + rnd(-0.3, 0.3), 1.7, WIN.z + 0.4, pickOne(["¡Clanc!", "¡Zzzt!", "¡Crac!"]), "#f0c24a"); }
    if (at && h.work >= crackTime()) grab();
    else if (!h.crew.some(crewActive)) h.phase = "escape";
  }
  // policía
  const P = h.police;
  if (P.eta != null && P.state === "idle") { P.eta -= dt; if (P.eta <= 0) { P.state = "in"; P.x = 48; police.visible = true; G.sfx("thief") || G.SFX.alarm(); } }
  if (P.state === "in") { const v = clamp((P.x - POL_X) * 1.2, 3, 20); P.x -= v * dt; if (P.x <= POL_X + 0.02) { P.x = POL_X; P.state = "here"; policeArrive(); } }
  if (police && police.visible) { police.position.set(P.x, 0, POL_Z); const f = (h.t * 4) % 2 < 1; policeLights[0].color.setHex(f ? 0xff2a2a : 0x3a0a0a); policeLights[1].color.setHex(f ? 0x0a1a3a : 0x2a6aff); }
  // fin
  if (h.phase !== "arrive" && h.phase !== "done" && h.crew.length && !h.crew.some(c => c.owner && (c.owner.st === "in" || c.owner.st === "crack" || c.owner.st === "run" || c.owner.st === "aboard")) && (V.state !== "wait" || V.flat)) resolve();
}
const pickOne = a => a[(Math.random() * a.length) | 0];
function grab() {
  const h = hz; h.phase = "escape";
  const active = h.crew.filter(crewActive);
  h.loot = Math.round(potentialLoot() * (h.alarm ? H.alarmGrab : 1));
  const share = active.length ? Math.round(h.loot / active.length) : 0;
  for (const c of active) {
    c.owner.bag = share; c.owner.st = "run"; giveBag(c);
    G.goTo(c, VAN_X * 0.4, -12.5); c.path = (c.path || []).concat([{ x: VAN_X - 0.6 + Math.random() * 1.2, z: CURB_Z }, { x: VAN_X, z: VAN_Z + 1.2 }]);
  }
  G.sfx("collect", WIN.x, WIN.z); G.sfx("bigwin", WIN.x, WIN.z);
  G.toast(`¡Abrieron la caja fuerte! Se llevan ${fmt(h.loot)} en bolsas. ¡Taclealos o pinchá la goma de la camioneta!`, "bad");
}
function leaveVan() {
  const h = hz, V = h.van; if (V.state === "out" || V.flat) return;
  V.state = "out"; V.v = 1; G.sfx("truck", V.x, VAN_Z);
  if (V.collider) { G.removeCollider(V.collider); V.collider = null; }
  let lost = 0;
  for (const c of h.crew) if (c.owner && c.owner.st === "aboard") { lost += c.owner.bag; c.owner.bag = 0; c.owner.st = "gone"; c.owner = null; G.despawnCustomer(c); }
  h.lost += lost;
  if (lost > 0) { G.Economy.force("heist", lost); G.toast(`La camioneta arrancó con ${fmt(lost)} adentro.`, "bad"); G.SFX.bad(); }
}
function policeArrive() {
  const h = hz; let n = 0;
  for (const c of h.crew) if (c.owner && (c.owner.st === "in" || c.owner.st === "crack" || c.owner.st === "run" || c.owner.st === "aboard")) { c.person.group.visible = true; if (c.owner.st === "aboard") G.placeAgent(c, h.van.x + rnd(-1, 1), VAN_Z + 1.3); arrest(c); n++; }
  if (h.van.state === "wait" || h.van.state === "park") { h.van.flat = true; h.van.state = "seized"; }
  G.sfx("caught", POL_X, POL_Z);
  G.toast(n ? `¡Llegó la policía! Detuvieron a ${n} ladrón${n > 1 ? "es" : ""} y recuperaron las bolsas.` : "Llegó la policía. Ya no queda nadie de la banda: toman nota y se van.", n ? "good" : "");
}
function resolve() {
  const h = hz, s = S(), o = OW(); if (h.phase === "done") return;
  h.phase = "done"; h.alarm = false;
  if ((h.van.state === "park" || h.van.state === "wait") && !h.van.flat) { h.van.state = "out"; h.van.v = 1; if (h.van.collider) { G.removeCollider(h.van.collider); h.van.collider = null; } } // se van con las manos vacías
  const pay = payout(h.lost, "robo");
  o.today.heistLoss += h.lost; o.today.heistPay += pay;
  if (h.lost <= 0) { o.heist.foiled++; G.Rep.change(H.repFoiled); G.Rank.add(H.xpFoiled); G.sfx("goal") || G.SFX.rank(); }
  else { o.heist.lost++; G.Rep.change(H.repLost); }
  const ins = INS(o.ins.plan);
  h.msg = h.lost <= 0 ? `¡Robo frustrado! No se llevaron nada${h.recovered ? ` (recuperaste ${fmt(h.recovered)})` : ""}. +${H.repFoiled} de reputación.`
    : `Se llevaron ${fmt(h.lost)}${h.recovered ? ` (recuperaste ${fmt(h.recovered)})` : ""}.${pay ? ` El seguro ${ins.name} te devuelve ${fmt(pay)}.` : ins ? ` El seguro no cubre (franquicia ${fmt(ins.deductible)}).` : " Sin seguro: perdiste todo eso."}`;
  s.today.notes.push(`Robo a la caja fuerte: ${h.msg}`);
  o.heist.day = 0; o.shutter = false;
  heistResult = { msg: h.msg, ok: h.lost <= 0, t: 14 };
  G.toast(h.msg, h.lost <= 0 ? "good" : "bad");
  G.updateHud(true); G.save(true);
}
function cleanupHeist() {
  if (!hz) return;
  for (const c of hz.crew) if (!c.dead && c.owner) { c.owner = null; G.despawnCustomer(c); }
  for (const n of G.staffNpcs) if (n.ownerTask) { n.ownerTask = null; n.state = "patrol"; n.path = null; }
  if (hz.van.collider) G.removeCollider(hz.van.collider);
  if (van) van.visible = false; if (police) police.visible = false;
  hz = null;
}

// =====================================================================
// CICLO
// =====================================================================
function actor(c, dt) {
  if (!c.owner) return false;
  const r = c.owner.role;
  if (r === "crew") return crewTick(c, dt);
  if (r === "caser") return caserTick(c, dt);
  if (r === "infl") return inflTick(c, dt);
  return false;
}
let plan = { day: -1, casers: [], infl: false };
function resetRuntime() {
  cleanupHeist(); heistResult = null; plan = { day: -1, casers: [], infl: false };
  refreshVisuals();
}
function planDay() {
  const s = S(), o = OW(); plan.day = s.day; plan.casers = []; plan.infl = false;
  const hd = o.heist.day;
  if (hd && (hd === s.day || hd === s.day + 1)) plan.casers = hd === s.day ? [17.5] : [13.5, 19];
  plan.infl = o.infl.day === s.day && !o.infl.came && o.ads.some(a => a.id === "influencer");
}
function update(dt) {
  if (!ensure()) return;
  const s = S(), o = OW();
  if (plan.day !== s.day) planDay();
  const h = s.minutes / 60;
  if (G.isOpen) {
    for (let i = 0; i < plan.casers.length; i++) if (h >= plan.casers[i]) { plan.casers.splice(i, 1); spawnCaser(); break; }
    if (plan.infl && h >= O.influencerHour) { plan.infl = false; spawnInfluencer(); }
    if (o.ads.some(a => a.id === "radio")) { const hr = Math.floor(h); if (hr !== plan.radioH) { plan.radioH = hr; if (hr % 2 === 0) G.sfx("amb_jingle", DESK.x, DESK.z, { quiet: true }); } }
  }
  if (!hz && heistTonight() && h >= H.hour) startHeist();
  if (hz) { heistUpdate(dt); if (hz && hz.phase === "done" && hz.t > 0) { hz.doneT = (hz.doneT || 0) + dt; if (hz.doneT > 6) cleanupHeist(); } }
}
function blockSkip() {
  if (!ensure()) return false;
  if (hz && hz.phase !== "done") { G.toast("¡No podés cerrar el día con la banda adentro!", "bad"); return true; }
  if (heistTonight() && S().minutes >= G.CFG.open * 60 && S().minutes < H.hour * 60) { // ibas a cerrar el día... pero frena una camioneta
    S().minutes = H.hour * 60; G.toast(OW().heist.known ? "Adelantaste la noche: son las 22:30 y llega la banda. ¡A tus puestos!" : "Ibas a cerrar el día, pero afuera frena una camioneta rara…", "bad"); return true; }
  return false;
}
function onEndDay(notes) {
  if (!ensure()) return;
  const s = S(), o = OW(), st = s.today.st, td = o.today;
  if (hz) { if (hz.phase !== "done") resolve(); cleanupHeist(); }
  // publicidad: ROI con el ingreso por visitante de hoy (ponderado por presupuesto de cada tipo)
  const visitors = Math.max(1, st.visitors), revDay = st.net + st.shopRev * 0.5;
  let budSum = 0, cnt = 0; const mid = id => { const t = D.CUSTOMER_TYPES.find(x => x.id === id); return t ? (t.budget[0] + t.budget[1]) / 2 : 1; };
  for (const t of TYPES) { budSum += (td.types[t] || 0) * mid(t); cnt += td.types[t] || 0; }
  const avgMid = cnt ? budSum / cnt : 1, perVisitor = revDay / visitors;
  const rows = [];
  for (const a of o.ads.slice()) {
    // extra por tipo: lo repartimos según la mezcla de la campaña
    const d = AD(a.id); let wmid = 0, bs = 0; for (const t in d.boost) { wmid += d.boost[t] * mid(t); bs += d.boost[t]; }
    const typeK = bs ? (wmid / bs) / avgMid : 1;
    const extraT = td.extra[a.id] || 0, revT = Math.round(extraT * perVisitor * typeK);
    a.rev += revT; a.left--;
    rows.push({ id: a.id, left: a.left, cost: a.cost, extraT, revT, rev: a.rev });
    if (a.left <= 0) { o.adHist.push({ id: a.id, cost: a.cost, extra: a.extra, rev: a.rev, day: a.day, end: s.day }); if (o.adHist.length > 8) o.adHist.shift(); o.ads.splice(o.ads.indexOf(a), 1); notes.push(`Terminó la campaña «${d.name}»: ${Math.round(a.extra)} clientes extra, ingreso estimado ${fmt(a.rev)} contra ${fmt(a.cost)} (ROI ${roi(a.rev, a.cost)}).`); }
  }
  // incendio (rarísimo): cortocircuito en una máquina rota
  let broken = 0; for (const m of G.machines) if (m.d.broken) broken++;
  if (G.machines.length && Math.random() < O.fire.chance + O.fire.perBroken * broken) {
    const list = G.machines.filter(m => m.d.broken), m = list.length ? list[(Math.random() * list.length) | 0] : G.machines[(Math.random() * G.machines.length) | 0];
    const box = Math.round(m.d.box), rep = Math.round(m.def.repair * O.fire.repairMul);
    m.d.box = 0; G.updateFill(m); G.refreshScreen(m); if (!m.d.broken) G.breakMachine(m);
    G.Economy.force("fire", rep); td.fire += box + rep;
    notes.push(`Cortocircuito: se prendió fuego una ${m.def.name}. Se quemaron ${fmt(box)} de su caja y el arreglo salió ${fmt(rep)}.`);
  }
  // seguro: siniestros del día (robos de cajas, incendio, vandalismo) y cuota
  let insLine = "";
  const ins = INS(o.ins.plan);
  if (ins) {
    const loss = (st.stolen || 0) + td.fire + (s.today.exp.events || 0);
    const pay = payout(loss, "dia");
    if (loss > 0) insLine = pay ? `Seguro ${ins.name}: cubrió ${fmt(pay)} de ${fmt(loss)} en robos, incendio y vandalismo.` : `Seguro ${ins.name}: ${fmt(loss)} en daños, por debajo de la franquicia (${fmt(ins.deductible)}).`;
    if (td.heistPay) insLine += `${insLine ? " " : ""}Por el robo a la caja fuerte te pagó ${fmt(td.heistPay)}.`;
    if (s.day >= o.ins.due) {
      const prem = premiumOf(o.ins.plan);
      if (G.Economy.trySpend("insurance", prem, true)) { o.ins.due = s.day + O.insEvery; insLine += `${insLine ? " " : ""}Pagaste la cuota del seguro (${fmt(prem)}); la próxima, el día ${o.ins.due}.`; }
      else { insLine += `${insLine ? " " : ""}No alcanzó para la cuota del seguro (${fmt(prem)}): la póliza se dio de baja.`; o.ins.plan = null; }
    }
    if (insLine) notes.push(insLine);
  } else if ((st.stolen || 0) + td.fire > 0 && s.day >= 3) notes.push(`Sin seguro: perdiste ${fmt((st.stolen || 0) + td.fire)} en robos e incendio. En la compu (Seguro y seguridad) podés contratar uno.`);
  // ¿se planea un robo?
  let heistLine = "";
  if (!o.heist.day && Math.random() < heistChance()) { scheduleHeist(s.day + H.leadDays); heistLine = "planned"; }
  o.lastRep = { day: s.day, rows, ins: insLine, heist: td.heistLoss || td.heistPay ? `Robo: se llevaron ${fmt(td.heistLoss)}${td.heistPay ? `, el seguro devolvió ${fmt(td.heistPay)}` : ""}.` : "" };
  refreshAdsVisual();
  void heistLine;
}
const roi = (rev, cost) => cost > 0 ? `${rev - cost >= 0 ? "+" : ""}${Math.round((rev - cost) / cost * 100)}%` : "—";
function onNextDay() {
  if (!ensure()) return;
  const s = S(), o = OW();
  o.today = { day: s.day, types: {}, extra: {}, fire: 0, heistLoss: 0, heistPay: 0 };
  if (o.shutter) o.shutter = false;
  if (o.heist.day && o.heist.day < s.day) o.heist.day = 0;
  if (o.heist.day === s.day && !o.heist.tip) {
    o.heist.tip = 1;
    if (Math.random() < H.tipBase + H.tipPerCam * o.cam + image() / 400) { o.heist.known = 1; setTimeout(() => G.toast(`Llamada anónima: «Esta noche, 22:30, vienen por la caja fuerte. No dije nada.» Prepará guardias, la persiana y tené a mano el teléfono rojo.`, "bad"), 1500); }
  }
  if (o.infl.day && o.infl.day < s.day && !o.infl.came) o.infl.day = s.day; // si no vino (cerrado), viene hoy
  plan.day = -1; refreshAdsVisual();
}
function frame(real) {
  if (!ensure()) return;
  // persiana
  const ty = OW().shutter ? 1.44 : 2.1; shutter.y += (ty - shutter.y) * Math.min(1, real * 4); shutter.m.position.y = shutter.y; shutter.m.visible = shutter.y < 2.08;
  // baliza del tablero y leds de las cámaras
  const t = performance.now() / 1000;
  beaconMat.color.setHex(hz && hz.alarm ? ((t * 3) % 1 < 0.5 ? 0xff2020 : 0x5a1010) : 0x5a1010);
  const led = (t % 1.2) < 0.15; for (const l of camLeds) l.visible = led;
  // peces
  if (office.acuario.visible) for (const f of fish) { f.ph += real * f.sp; const x = Math.sin(f.ph) * 0.2, z = Math.cos(f.ph * 0.7) * 0.1; f.m.position.set(x, f.y + Math.sin(f.ph * 1.7) * 0.03, z); f.m.rotation.y = Math.cos(f.ph) > 0 ? 0 : Math.PI; }
  // manos
  const shop = window.CasinoShop, build = window.CasinoBuild;
  arms.visible = G.started && !G.ui.blocking() && !(shop && shop.carrying) && !(build && build.active);
  if (arms.visible) {
    const br = Math.sin(t * 1.6) * 0.004;
    for (const a of armParts) { const b = a.userData.base; a.position.set(b.x, b.y + br, b.z); if (a.userData.side > 0 && G.player.drink) a.position.set(0.2, -0.27, -0.42); }
  }
  // espejo: se dibuja solo si estás cerca y mirando para ese lado
  const px = G.player.x - WARD.x, pz = G.player.z - WARD.z, dist = Math.hypot(px, pz);
  mirrorFrame = (mirrorFrame + 1) % 3;
  if (G.started && avatar && dist < 5 && pz > 0.2 && !G.ui.panel && mirrorFrame === 0) {
    const fx = -Math.sin(G.player.yaw), fz = -Math.cos(G.player.yaw);
    if (fx * -px + fz * -pz > 0) renderMirror(real);
  }
  if (heistResult) { heistResult.t -= real; if (heistResult.t <= 0) heistResult = null; }
  hudFrame();
}
let mirrorFrame = 0;
function renderMirror(dt) {
  const r = G.renderer;
  avatar.position.set(G.player.x, 0, G.player.z); avatar.rotation.y = G.player.yaw + Math.PI; avatar.api.idle(dt * 3);
  avatar.visible = true; const av = arms.visible; arms.visible = false;
  const prev = r.getRenderTarget();
  r.setRenderTarget(mirrorRT); r.render(G.scene, mirrorCam); r.setRenderTarget(prev);
  avatar.visible = false; arms.visible = av;
}
function refreshOutfit() { refreshAvatar(); refreshArms(); drawPortrait(); }
function refreshSecVisual() { refreshVault(); refreshCams(); }
function refreshVisuals() {
  if (!S() || !S().owner) return;
  const o = OW();
  for (const f of O.office) if (office[f.id]) office[f.id].visible = !!o.own[f.id];
  refreshOutfit(); refreshCar(); refreshSecVisual(); refreshAdsVisual();
}

// =====================================================================
// HUD: imagen, aviso de robo y línea de tiempo del robo
// =====================================================================
const css = document.createElement("style");
css.textContent = `
#ownerHeist { position: fixed; top: calc(10px + env(safe-area-inset-top, 0px)); left: 46%; transform: translateX(-50%); width: min(480px, calc(100vw - 860px)); min-width: 280px; background: rgba(30, 6, 8, .9); border: 1px solid var(--chip); border-radius: 8px; padding: 8px 12px; font-size: .9rem; color: var(--ivory); pointer-events: none; z-index: 5; }
#ownerHeist.ok { background: rgba(7, 30, 18, .9); border-color: var(--mint); }
#ownerHeist .tl { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin: 6px 0 4px; }
#ownerHeist .tl span { text-align: center; font-size: .72rem; letter-spacing: .06em; text-transform: uppercase; padding: 3px 0; border-radius: 3px; background: rgba(255,255,255,.06); color: var(--ivory-dim); }
#ownerHeist .tl span.on { background: var(--chip); color: #fff; font-weight: 700; }
#ownerHeist .tl span.past { background: rgba(212,66,63,.35); color: var(--ivory); }
#ownerHeist .bar { height: 8px; background: rgba(255,255,255,.08); border-radius: 4px; overflow: hidden; }
#ownerHeist .bar i { display: block; height: 100%; background: linear-gradient(90deg, #f0c24a, #d4423f); }
#ownerHeist .st { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 5px; font-size: .82rem; color: var(--ivory-dim); }
#ownerHeist .st b { color: var(--ivory); }
#ownerHeist .st .on { color: #ff6a5a; } #ownerHeist .st .good { color: var(--mint); }
#ownerHeist .hint { margin-top: 4px; font-size: .8rem; color: var(--ivory-dim); }
#ownerWarn { font-size: .82rem; color: #ffb0a0; border-top: 1px solid rgba(212,66,63,.5); padding-top: 4px; }
.ownImg { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; margin: 8px 0; }
.ownH { margin: 14px 0 6px; font-size: .8rem; letter-spacing: .14em; text-transform: uppercase; color: var(--brass); }
.adTable { display: grid; grid-template-columns: 1.6fr repeat(5, auto); gap: 3px 12px; font-size: .9rem; align-items: baseline; }
.adTable .h { font-size: .7rem; letter-spacing: .1em; text-transform: uppercase; color: var(--ivory-dim); }
.adTable .v { font-family: var(--font-num); text-align: right; }
@media (max-width: 1180px) { #ownerHeist { top: auto; bottom: 120px; width: calc(100vw - 32px); min-width: 0; } }
`;
document.head.appendChild(css);
const heistEl = document.createElement("div"); heistEl.id = "ownerHeist"; heistEl.hidden = true; heistEl.setAttribute("aria-live", "polite"); document.body.appendChild(heistEl);
const imgRow = document.createElement("div"); imgRow.className = "meter"; imgRow.innerHTML = `<span>Imagen</span><span class="bar"><i id="hImg" style="background:linear-gradient(90deg,#b8873a,#f6c766)"></i></span><span class="v" id="hImgN">0</span>`;
const warnEl = document.createElement("div"); warnEl.id = "ownerWarn"; warnEl.hidden = true;
{ const ex = document.getElementById("hExtra"); const rep = document.getElementById("hRep"); const m = rep && rep.closest(".meter"); if (m) m.insertAdjacentElement("afterend", imgRow); else if (ex) ex.prepend(imgRow); if (ex) ex.appendChild(warnEl); }
let hudT = 0, lastHeistHtml = "", lastWarn = "";
const PHASES = [["arrive", "Llegan"], ["crack", "Forzando"], ["escape", "Escapan"], ["van", "Camioneta"]];
function hudFrame() {
  const now = performance.now(); if (now - hudT < 150) return; hudT = now;
  const s = S(); if (!s || !s.owner) return;
  const iv = Math.round(image()); const bar = document.getElementById("hImg"); if (bar) { bar.style.width = iv + "%"; document.getElementById("hImgN").textContent = iv; imgRow.title = `Imagen: ${imageLabel(iv)}`; }
  // aviso de robo
  const hd = OW().heist; let w = "";
  if (hd.day && hd.known && !hz) w = hd.day === s.day ? `¡Robo anunciado esta noche a las 22:30! Guardias ${s.staff.sec || 0} · cámaras ${OW().cam} · caja nivel ${OW().safe}${OW().ins.plan ? "" : " · sin seguro"}` : `Robo anunciado: noche del día ${hd.day}, 22:30.`;
  if (w !== lastWarn) { lastWarn = w; warnEl.textContent = w; warnEl.hidden = !w; }
  // línea de tiempo
  let html = "", ok = false;
  if (hz && hz.phase !== "done" && G.started) {
    const ph = hz.phase === "enter" ? "arrive" : hz.van.state === "wait" ? "van" : hz.phase;
    const idx = PHASES.findIndex(p => p[0] === ph);
    const tl = PHASES.map(([id, n], i) => `<span class="${i === idx ? "on" : i < idx ? "past" : ""}">${n}</span>`).join("");
    const ct = crackTime(), prog = hz.phase === "crack" ? clamp(hz.work / ct, 0, 1) : idx > 1 ? 1 : 0;
    const left = hz.phase === "crack" ? Math.max(0, Math.ceil(ct - hz.work)) : null;
    const active = hz.crew.filter(crewActive).length, run = hz.crew.filter(c => c.owner && c.owner.st === "run"), carrying = run.reduce((a, c) => a + c.owner.bag, 0);
    const P = hz.police;
    const pol = P.state === "here" ? `<span class="good">Policía acá</span>` : P.eta != null ? `<span class="good">Policía en <b>${Math.ceil(P.eta)} s</b></span>` : `<span>Policía: <b>sin llamar</b></span>`;
    html = `<b>ROBO A LA CAJA FUERTE</b> · banda ${active}/${hz.crew.length || hz.n}${carrying ? ` · llevan <b>${fmt(carrying)}</b>` : ""}${hz.van.wait >= 0 && hz.van.state === "wait" ? ` · la camioneta arranca en <b>${Math.ceil(hz.van.wait)} s</b>` : ""}
      <div class="tl">${tl}</div>
      <div class="bar"><i style="width:${Math.round(prog * 100)}%"></i></div>
      <div class="st"><span class="${hz.alarm ? "on" : ""}">Alarma: <b>${hz.alarm ? "SONANDO" : "apagada"}</b></span><span class="${OW().shutter ? "good" : ""}">Persiana: <b>${OW().shutter ? "baja" : "arriba"}</b></span>${pol}<span>Guardias: <b>${s.staff.sec || 0}</b></span>${left != null ? `<span>Abren en <b>${left} s</b></span>` : ""}${hz.van.flat ? `<span class="good">Goma pinchada</span>` : ""}</div>
      <div class="hint">${G.isTouch ? "Usar" : "E"} sobre un ladrón cerca para taclearlo · tablero rojo a la izquierda de la puerta: alarma, persiana, policía · pinchá la goma de la camioneta</div>`;
  } else if (heistResult && G.started) { html = `<b>${heistResult.ok ? "ROBO FRUSTRADO" : "TE ROBARON"}</b><div class="hint" style="color:var(--ivory)">${esc(heistResult.msg)}</div>`; ok = heistResult.ok; }
  if (html !== lastHeistHtml) { lastHeistHtml = html; heistEl.innerHTML = html; heistEl.hidden = !html; heistEl.classList.toggle("ok", ok); }
}

// =====================================================================
// PANELES (compu: Imagen · Publicidad · Seguro y seguridad; ropero; tecla I)
// =====================================================================
const pcTabs = () => [["own_img", "Imagen"], ["own_ads", "Publicidad"], ["own_sec", "Seguro y seguridad"]];
let ownTab = "own_img", ownMode = "pc";
const sw = col => `<span class="sw" style="background:${col}"></span>`;
const hexc = n => "#" + (n >>> 0).toString(16).padStart(6, "0");
function row(it, sub, btn, col) {
  const locked = S().rank < it.rank;
  return `<div class="item${locked ? " locked" : ""}">${sw(col || "#d9a84a")}<div class="t"><b>${esc(it.name)}${it.price ? ` · <span class="num">${fmt(it.price)}</span>` : ""}${locked ? `<span class="tag lock">Rango ${it.rank}</span>` : ""}</b><span>${sub}</span></div><div class="btns">${btn}</div></div>`;
}
function itemBtn(it, k) {
  const o = OW(), own = o.own[it.id] || it.id === "remera", locked = S().rank < it.rank;
  if (own) {
    if (k === "outfit") return o.outfit === it.id ? `<span class="tag">Puesto</span>` : `<button class="ghost" data-oact="wear" data-id="${it.id}">Ponérmelo</button>`;
    if (k === "car") return o.car === it.id ? `<span class="tag">Estacionado</span>` : `<button class="ghost" data-oact="car" data-id="${it.id}">Usarlo</button>`;
    return `<span class="tag">Tuyo</span>`;
  }
  return `<button data-oact="buy" data-id="${it.id}" ${locked || S().bank < it.price ? "disabled" : ""}>${locked ? "Bloqueado" : "Comprar"}</button>`;
}
function imgHtml(wardrobe) {
  const iv = image(), o = OW();
  const head = `<div class="statgrid"><div class="stat"><b>${Math.round(iv)}/100</b><span>Imagen · ${imageLabel(iv)}</span></div><div class="stat"><b>+${Math.round(imgF() * O.effects.vipMul * 100)}%</b><span>High rollers y VIP</span></div><div class="stat"><b>-${Math.round(imgF() * O.effects.wageCut * 100)}%</b><span>Sueldos (te respetan)</span></div><div class="stat"><b>-${Math.round(imgF() * O.effects.respectCut * 100)}%</b><span>Lo que cobra la mafia</span></div></div>`;
  let h = `<p>Tu imagen sube con la ropa, los accesorios, el auto y la oficina. Se ve en el espejo del ropero, en tus mangas y en la vereda.</p>${head}`;
  h += `<div class="ownH">Ropa (una puesta)</div><div class="list">${O.outfits.map(f => row(f, `+${f.img} imagen · ${esc(f.desc)}`, itemBtn(f, "outfit"), hexc(f.vip ? f.jacket : f.color))).join("")}</div>`;
  h += `<div class="ownH">Accesorios (se suman)</div><div class="list">${O.accessories.map(f => row(f, `+${f.img} imagen · ${esc(f.desc)}`, itemBtn(f, "acc"), "#d9a84a")).join("")}</div>`;
  if (!wardrobe) {
    h += `<div class="ownH">Auto (estacionado a la derecha de la entrada)</div><div class="list">${O.cars.map(f => row(f, `+${f.img} imagen · ${esc(f.desc)}`, itemBtn(f, "car"), hexc(f.color))).join("")}${o.car ? `<div class="item">${sw("#555")}<div class="t"><b>Guardarlo en la cochera</b><span>Sin auto en la vereda (pierde la imagen del auto)</span></div><div class="btns"><button class="ghost" data-oact="car" data-id="">Guardar</button></div></div>` : ""}</div>`;
    h += `<div class="ownH">Oficina</div><div class="list">${O.office.map(f => row(f, `+${f.img} imagen · ${esc(f.desc)}`, itemBtn(f, "office"), "#8a4a2a")).join("")}</div>`;
  } else h += `<p class="dim">El auto y los lujos de la oficina se compran en la compu (pestaña Imagen).</p>`;
  return h;
}
function adsHtml() {
  const s = S(), o = OW(), e = computeEff();
  const eff = TYPES.filter(t => D.CUSTOMER_TYPES.find(x => x.id === t && s.rank >= x.rank)).map(t => `<div class="stat"><b>+${Math.round((e.e[t] || 0) * 100)}%</b><span>${esc(D.CUSTOMER_TYPES.find(x => x.id === t).name)}</span></div>`).join("");
  let h = `<p>Cada campaña cuesta, dura unos días y trae más clientes de ciertos tipos. Apilar campañas rinde cada vez menos (hay un techo por tipo). El ROI se ve en el cierre de caja.</p><div class="statgrid">${eff}<div class="stat"><b>x${demandMul().toFixed(2)}</b><span>Clientes por hora</span></div></div>`;
  h += `<div class="list">${O.ads.map(d => { const a = o.ads.find(x => x.id === d.id); const boost = Object.entries(d.boost).map(([t, v]) => `${D.CUSTOMER_TYPES.find(x => x.id === t).name} +${Math.round(v * 100)}%`).join(", ");
    return row(d, `${d.days} días · ${boost}${d.scaleByImg ? ` (x${(0.5 + imgF() * O.effects.influencerK).toFixed(2)} por tu imagen)` : ""} · ${esc(d.desc)}${a ? ` · <b>activa: ${a.left} día${a.left > 1 ? "s" : ""}</b>` : ""}`, `<button data-oact="ad" data-id="${d.id}" ${s.rank < d.rank || s.bank < d.price || s.dayOver ? "disabled" : ""}>${a ? "Extender" : "Lanzar"}</button>`, "#b8202a"); }).join("")}</div>`;
  const list = o.ads.map(a => ({ id: a.id, left: a.left, cost: a.cost, extra: a.extra, rev: a.rev, on: true })).concat(o.adHist.slice().reverse().map(a => ({ id: a.id, left: 0, cost: a.cost, extra: a.extra, rev: a.rev, on: false })));
  if (list.length) h += `<div class="ownH">Campañas</div><div class="adTable"><span class="h">Campaña</span><span class="h">Días</span><span class="h">Costo</span><span class="h">Clientes extra</span><span class="h">Ingreso est.</span><span class="h">ROI</span>${list.map(r => `<span>${esc(AD(r.id).name)}${r.on ? "" : ' <span class="dim">(terminó)</span>'}</span><span class="v">${r.left || "—"}</span><span class="v">${fmt(r.cost)}</span><span class="v">${Math.round(r.extra)}</span><span class="v">${fmt(r.rev)}</span><span class="v ${r.rev >= r.cost ? "in" : "out"}">${roi(r.rev, r.cost)}</span>`).join("")}</div>`;
  return h;
}
function secHtml() {
  const s = S(), o = OW(), cur = INS(o.ins.plan);
  let h = `<div class="ownH">Seguro</div><p>Cuota cada ${O.insEvery} días (la primera al contratar; sube con el calor y si cobrás seguido). Cubre robos (cajas y caja fuerte), incendio y vandalismo.</p>`;
  h += `<div class="list">${O.insurance.map(p => row(Object.assign({}, p, { price: 0 }), `Cuota ${fmt(premiumOf(p.id))} cada ${O.insEvery} días · ${esc(p.desc)}`, o.ins.plan === p.id ? `<span class="tag">Vigente · cuota día ${o.ins.due}</span><button class="ghost sm" data-oact="insoff">Dar de baja</button>` : `<button data-oact="ins" data-id="${p.id}" ${s.rank < p.rank || s.bank < premiumOf(p.id) ? "disabled" : ""}>${cur ? "Cambiar" : "Contratar"}</button>`, "#2a6fd6")).join("")}</div>`;
  const camNx = O.cams[o.cam], safeNx = O.safes[o.safe];
  h += `<div class="ownH">Seguridad</div><div class="list">`;
  h += row({ name: `Cámaras de seguridad (nivel ${o.cam}/${O.cams.length})`, rank: camNx ? camNx.rank : 1, price: camNx ? camNx.price : 0 }, o.cam === 0 ? "Nivel 1: la alarma llama sola a la policía, los guardias reaccionan al toque y marcan a los sospechosos (?)." : o.cam === 1 ? "Nivel 2: la policía llega 10 s antes y te enterás más seguido de los robos planeados." : "Al máximo.", camNx ? `<button data-oact="sec" data-id="cam" ${s.rank < camNx.rank || s.bank < camNx.price ? "disabled" : ""}>Mejorar</button>` : `<span class="tag">Máximo</span>`, "#c9ced4");
  h += row({ name: `Caja fuerte reforzada (nivel ${o.safe}/${O.safes.length})`, rank: safeNx ? safeNx.rank : 1, price: safeNx ? safeNx.price : 0 }, `Tardan ${crackTime()} s en abrirla${o.shutter ? " (con la persiana baja)" : ""} · se llevarían hasta ${fmt(potentialLoot())} hoy. Cada nivel: +${H.crackPerSafe} s y −${Math.round(H.lootFracPerSafe * 100)}% del botín.`, safeNx ? `<button data-oact="sec" data-id="safe" ${s.rank < safeNx.rank || s.bank < safeNx.price ? "disabled" : ""}>Mejorar</button>` : `<span class="tag">Máximo</span>`, "#4c535c");
  h += `</div><p class="dim" style="font-size:.88rem">Guardias contratados: ${s.staff.sec || 0} (cada uno va con el bate por un ladrón). Tablero rojo a la izquierda de la puerta: alarma, persiana de la bóveda y teléfono a la policía. Robos frustrados: ${o.heist.foiled} · sufridos: ${o.heist.lost}.</p>`;
  if (o.heist.day && o.heist.known) h += `<div class="warn">Robo anunciado para la noche del día ${o.heist.day} (22:30).</div>`;
  return h;
}
function openOwner(tab, mode) {
  if (!ensure()) return;
  if (tab) ownTab = tab; ownMode = mode || "pc";
  const shopHead = window.CasinoShop && window.CasinoShop.pcHead && ownMode === "pc";
  const head = ownMode === "wardrobe" ? "" : shopHead ? window.CasinoShop.pcHead(ownTab) : `<div class="tabs">${pcTabs().map(([id, n]) => `<button data-oact="tab" data-id="${id}" class="${ownTab === id ? "on" : ""}">${n}</button>`).join("")}</div>`;
  const body = ownMode === "wardrobe" ? imgHtml(true) : ownTab === "own_ads" ? adsHtml() : ownTab === "own_sec" ? secHtml() : imgHtml(false);
  const title = ownMode === "wardrobe" ? "Ropero del dueño" : ownMode === "phone" ? "El celular del dueño" : "La compu · el dueño";
  G.openPanel("owner", `<h2>${title}</h2>${head}<p>Banco <b class="num">${fmt(S().bank)}</b></p>${body}<div class="actions"><button class="ghost" data-act="close">Cerrar</button></div>`);
}
function pcTab(id) { if (!String(id).startsWith("own_")) return false; openOwner(id, "pc"); return true; }
function rerender() { if (G.ui.panel === "owner") openOwner(null, ownMode); }
document.getElementById("panelBody").addEventListener("click", e => {
  const b = e.target.closest("button[data-oact]"); if (!b || b.disabled || !ensure()) return;
  const a = b.dataset.oact, id = b.dataset.id;
  if (a === "tab") { openOwner(id, ownMode); return; }
  if (a === "buy") buyItem(id);
  else if (a === "wear") wear(id);
  else if (a === "car") useCar(id || null);
  else if (a === "ad") buyAd(id);
  else if (a === "ins") buyIns(id);
  else if (a === "insoff") cancelIns();
  else if (a === "sec") buySec(id);
  rerender();
});
window.addEventListener("keydown", e => {
  if (e.code !== "KeyI" || e.repeat || !G.started || G.isTouch) return;
  if (G.ui.panel === "owner") { G.closePanel(false, true); return; }
  if (G.ui.blocking() || (window.CasinoBuild && window.CasinoBuild.active)) return;
  if (hz && hz.phase !== "done") { G.toast("¡No es momento de mirar el celular!", "bad"); return; }
  openOwner(ownTab, "phone");
});
// ayuda de teclas
const fixKeys = root => { if (!root || G.isTouch) return; const k = root.querySelector(".keys") || (root.classList.contains("keys") ? root : null); if (!k || k.innerHTML.includes("<kbd>I</kbd>")) return; k.insertAdjacentHTML("beforeend", `<kbd>I</kbd><span>Imagen, publicidad y seguro (celular)</span>`); };
new MutationObserver(() => fixKeys(document.getElementById("panelBody"))).observe(document.getElementById("panelBody"), { childList: true });
{ const tk = document.getElementById("titleKeys"); if (tk) { new MutationObserver(() => { if (tk.children.length) fixKeys(tk); }).observe(tk, { childList: true }); setTimeout(() => fixKeys(tk), 0); } }

// cierre de caja: campañas activas, ROI, seguro y robo
function reportHtml() {
  if (!ensure()) return "";
  const R = OW().lastRep; if (!R || R.day !== S().day) return "";
  let h = "";
  if (R.rows.length) h += `<h3>Publicidad</h3><div class="adTable"><span class="h">Campaña</span><span class="h">Quedan</span><span class="h">Costo</span><span class="h">Extra hoy</span><span class="h">Ingreso hoy</span><span class="h">ROI</span>${R.rows.map(r => `<span>${esc(AD(r.id).name)}</span><span class="v">${r.left > 0 ? r.left + " d" : "fin"}</span><span class="v">${fmt(r.cost)}</span><span class="v">${Math.round(r.extraT * 10) / 10}</span><span class="v">${fmt(r.revT)}</span><span class="v ${r.rev >= r.cost ? "in" : "out"}">${roi(r.rev, r.cost)}</span>`).join("")}</div>`;
  if (R.heist) h += `<p>${esc(R.heist)}</p>`;
  return h;
}

window.CasinoOwner = {
  typeMul, demandMul, wageMul, staffSpeedMul, respectMul, image,
  onSpawn, onDespawn, actor, staffTask, update, frame, onEndDay, onNextDay, blockSkip, reportHtml,
  pcTabs, pcTab, open: openOwner,
  debug: {
    get state() { ensure(); return S().owner; },
    get heist() { return hz ? { phase: hz.phase, work: hz.work, crack: crackTime(), crew: hz.crew.map(c => ({ st: c.owner ? c.owner.st : (c.dead ? "dead" : c.state), x: c.x, z: c.z, bag: c.owner ? c.owner.bag : 0 })), alarm: hz.alarm, police: { eta: hz.police.eta, state: hz.police.state }, van: { state: hz.van.state, x: hz.van.x, flat: hz.van.flat, wait: hz.van.wait }, lost: hz.lost, recovered: hz.recovered, loot: hz.loot, aware: hz.aware, bonked: hz.bonked, arrested: hz.arrested, msg: hz.msg } : null; },
    get result() { return heistResult ? Object.assign({}, heistResult) : null; },
    eff: () => { const e = computeEff(); return { raw: Object.assign({}, e.raw), e: Object.assign({}, e.e), mean: e.mean }; },
    buyItem, wear, useCar, buyAd, buyIns, cancelIns, buySec, premiumOf, potentialLoot, crackTime, heistChance,
    schedule(day) { ensure(); scheduleHeist(day == null ? S().day : day); plan.day = -1; return OW().heist; },
    start: startHeist, pressAlarm, toggleShutter, callPolice, puncture, resolve, cleanup: cleanupHeist,
    spawnCaser, spawnInfluencer, confront, greetInfluencer, tackle,
    mirror: () => ({ dist: Math.hypot(G.player.x - WARD.x, G.player.z - WARD.z) }),
    pos: { WARD, AQUA, DESK, PANEL, VAULT, WIN, CARP, BB, VAN_X, VAN_Z, POL_X, POL_Z },
    get arms() { return arms.visible; },
    get visuals() { const off = {}; for (const f of O.office) off[f.id] = !!(office[f.id] && office[f.id].visible); return { office: off, car: carShown, carCollider: !!carCollider, billboard: bbMode, flyers: flyerGroup.visible, radio: radio.visible, vault: vaultKey, cams: camLeds.length, shutter: OW().shutter, sleeve: armMats.sleeve.color.getHex(), avatar: avatarKey, watch: armParts[0].userData.watch.visible }; },
    get crewList() { return hz ? hz.crew : []; },
  },
};
})();
