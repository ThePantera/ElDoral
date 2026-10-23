/* Casino Dorado · life.js — LOCAL MÁS VIVO
 * Reacciones de los clientes (festejos, bronca, patadas a la máquina, aplausos, íconos de ánimo y globitos de charla),
 * quejas (máquinas rotas, piso sucio, esperas), manchas en el piso y EVENTOS DE LA NOCHE: borracho, pelea, cumpleaños,
 * tramposo, apagón, celebridad y bandeja volcada. Cada evento pide que hagas algo y tiene consecuencias de verdad.
 * Se carga después de poker.js y antes de story.js. Usa window.CasinoLifeBridge (game.js) y los números de D.LIFE (data.js).
 * Todo lo de esta capa es transitorio (se limpia al cerrar el día y al cargar); en el guardado solo queda S.life = { day, fired }
 * para no repetir eventos si recargás a mitad del día.
 * Secciones: BASE · ÍCONOS · GLOBITOS · ÁNIMO Y POSES · REACCIONES · QUEJAS Y CHARLA · MANCHAS · TABLERO ELÉCTRICO ·
 * ACTORES Y PERSONAL · EVENTOS · DIRECTOR · HUD · API.
 */
(() => {
"use strict";

// =====================================================================
// BASE
// =====================================================================
const G = window.CasinoLifeBridge, D = window.CASINO_DATA, A = window.CasinoArt, T = window.THREE;
if (!G || !D || !D.LIFE || !A || !T) return;
const L = D.LIFE, CFG = D.CFG, HOUR = G.HOUR;
const S = () => G.S;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = arr => arr[(Math.random() * arr.length) | 0];
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const fmt = n => G.fmt(n);
const dm = () => L.diff[S().difficulty] || L.diff.normal;
const pen = () => dm().penalty;
const alive = c => !!(c && !c.dead && c.person);
const GONE = new Set(["leave", "flee", "caught"]);
const inside = c => alive(c) && !GONE.has(c.state) && !c.thief && c.z > -10.2;
const free = c => inside(c) && !c.life; // cliente común manejado por game.js
function wrapAngle(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }

// =====================================================================
// ÍCONOS DE ÁNIMO (un sprite por persona, materiales compartidos)
// =====================================================================
const tex = draw => A.canvasTex(64, 64, draw);
const disc = (g, c, r) => { g.fillStyle = c; g.beginPath(); g.arc(32, 32, r || 27, 0, 7); g.fill(); g.lineWidth = 3; g.strokeStyle = "rgba(7,20,15,.85)"; g.stroke(); };
const eyes = (g, y) => { g.fillStyle = "#1a1206"; g.beginPath(); g.arc(23, y || 27, 3.5, 0, 7); g.arc(41, y || 27, 3.5, 0, 7); g.fill(); };
const glyph = (g, t, c, size, y) => { g.fillStyle = c; g.font = `bold ${size || 34}px Arial, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(t, 32, y || 34); };
const starPath = (g, cx, cy, r1, r2, n) => { g.beginPath(); for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r2 : r1, a = -Math.PI / 2 + i * Math.PI / n; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); };
const EMO_DRAW = {
  happy: g => { disc(g, "#f6c766"); eyes(g); g.strokeStyle = "#1a1206"; g.lineWidth = 3.5; g.beginPath(); g.arc(32, 33, 12, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); },
  angry: g => { disc(g, "#e0503a"); eyes(g, 30); g.strokeStyle = "#1a1206"; g.lineWidth = 3.5; g.beginPath(); g.moveTo(15, 18); g.lineTo(28, 24); g.moveTo(49, 18); g.lineTo(36, 24); g.stroke(); g.beginPath(); g.arc(32, 50, 10, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke(); },
  sad: g => { disc(g, "#6a9ad6"); eyes(g); g.strokeStyle = "#1a1206"; g.lineWidth = 3.5; g.beginPath(); g.arc(32, 50, 11, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke(); g.fillStyle = "#d8f0ff"; g.beginPath(); g.ellipse(45, 36, 3, 5, 0, 0, 7); g.fill(); },
  money: g => { disc(g, "#3f8a4a"); glyph(g, "$", "#e8ffe8", 38); },
  note: g => { disc(g, "rgba(7,20,15,.88)"); g.strokeStyle = "#d9a84a"; g.lineWidth = 3; g.stroke(); g.fillStyle = "#f6c766"; g.beginPath(); g.ellipse(26, 42, 7, 5, -0.4, 0, 7); g.fill(); g.fillRect(31, 16, 4, 27); g.beginPath(); g.moveTo(35, 16); g.quadraticCurveTo(46, 20, 44, 30); g.quadraticCurveTo(42, 23, 35, 24); g.fill(); },
  hic: g => { disc(g, "#8a5ab8"); glyph(g, "hic", "#fff", 22, 33); g.fillStyle = "rgba(255,255,255,.7)"; g.beginPath(); g.arc(48, 14, 5, 0, 7); g.arc(54, 24, 3, 0, 7); g.fill(); },
  broken: g => { g.fillStyle = "#f0a020"; g.beginPath(); g.moveTo(32, 5); g.lineTo(60, 56); g.lineTo(4, 56); g.closePath(); g.fill(); g.lineWidth = 3; g.strokeStyle = "rgba(7,20,15,.85)"; g.stroke(); glyph(g, "!", "#1a1206", 34, 39); },
  dirty: g => { g.fillStyle = "#7a5228"; for (const [x, y, r] of [[32, 34, 17], [16, 26, 8], [48, 22, 7], [46, 48, 9], [18, 48, 6]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } g.fillStyle = "#a8783a"; g.beginPath(); g.arc(28, 30, 6, 0, 7); g.fill(); },
  wait: g => { disc(g, "#efe8d8"); g.fillStyle = "#8a6a2c"; g.beginPath(); g.moveTo(20, 14); g.lineTo(44, 14); g.lineTo(32, 32); g.closePath(); g.moveTo(20, 50); g.lineTo(44, 50); g.lineTo(32, 32); g.closePath(); g.fill(); g.fillStyle = "#d9a84a"; g.fillRect(29, 38, 6, 10); },
  fight: g => { g.strokeStyle = "#e0302a"; g.lineWidth = 7; g.lineCap = "round"; for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { g.beginPath(); g.moveTo(32 + sx * 6, 32 + sy * 22); g.quadraticCurveTo(32 + sx * 6, 32 + sy * 6, 32 + sx * 22, 32 + sy * 6); g.stroke(); } },
  cake: g => { disc(g, "#ffd0e0"); g.fillStyle = "#c8577a"; g.fillRect(16, 32, 32, 16); g.fillStyle = "#fff4e0"; g.fillRect(16, 30, 32, 5); g.fillStyle = "#3a6fd6"; g.fillRect(30, 17, 4, 13); g.fillStyle = "#ffb020"; g.beginPath(); g.ellipse(32, 13, 3, 5, 0, 0, 7); g.fill(); },
  star: g => { disc(g, "rgba(7,20,15,.88)"); g.fillStyle = "#f6c766"; starPath(g, 32, 34, 22, 9, 5); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.arc(47, 15, 4, 0, 7); g.fill(); },
  dark: g => { disc(g, "#3a3f4a"); g.fillStyle = "#8a8f9a"; g.beginPath(); g.arc(32, 27, 12, 0, 7); g.fill(); g.fillRect(27, 37, 10, 9); g.strokeStyle = "#e0503a"; g.lineWidth = 4; g.beginPath(); g.moveTo(14, 14); g.lineTo(50, 50); g.stroke(); },
  question: g => { disc(g, "#f0c24a"); glyph(g, "?", "#1a1206", 40, 35); },
  sparkle: g => { g.fillStyle = "#7fe8ff"; starPath(g, 32, 32, 28, 6, 4); g.fill(); g.fillStyle = "#fff"; starPath(g, 32, 32, 12, 3, 4); g.fill(); },
  party: g => { const cs = ["#e0503a", "#f6c766", "#3a6fd6", "#6fd39b", "#c8577a"]; for (let i = 0; i < 18; i++) { g.fillStyle = cs[i % 5]; g.save(); g.translate(8 + Math.random() * 48, 8 + Math.random() * 48); g.rotate(Math.random() * 3); g.fillRect(-4, -2, 8, 4); g.restore(); } },
  heart: g => { g.fillStyle = "#e0405a"; g.beginPath(); g.moveTo(32, 54); g.bezierCurveTo(2, 34, 10, 6, 32, 20); g.bezierCurveTo(54, 6, 62, 34, 32, 54); g.fill(); g.lineWidth = 3; g.strokeStyle = "rgba(7,20,15,.8)"; g.stroke(); },
};
const EMO = {};
for (const k in EMO_DRAW) EMO[k] = new T.SpriteMaterial({ map: tex(EMO_DRAW[k]), transparent: true, depthWrite: false });
function emote(c, id, sec) {
  if (!alive(c) || !EMO[id]) return;
  const p = c.person;
  let sp = p.lifeEmote;
  if (!sp) { sp = new T.Sprite(EMO[id]); sp.scale.set(0.34, 0.34, 1); sp.renderOrder = 13; p.group.add(sp); p.lifeEmote = sp; }
  sp.material = EMO[id]; sp.visible = true; sp.position.set(0, 2.45, 0);
  c.emo = { id, t: sec == null ? 2.5 : sec };
}
function clearEmote(c) { if (c.person && c.person.lifeEmote) c.person.lifeEmote.visible = false; c.emo = null; }

// =====================================================================
// GLOBITOS DE CHARLA (pool fijo de 4 sprites con canvas)
// =====================================================================
const bubbles = [];
for (let i = 0; i < 4; i++) {
  const cv = document.createElement("canvas"); cv.width = 320; cv.height = 112;
  const tx = new T.CanvasTexture(cv);
  const sp = new T.Sprite(new T.SpriteMaterial({ map: tx, transparent: true, depthTest: false, depthWrite: false }));
  sp.scale.set(1.7, 0.6, 1); sp.visible = false; sp.renderOrder = 21; G.scene.add(sp);
  bubbles.push({ sp, cv, tx, c: null, life: 0 });
}
let bubbleCd = 0, saidCount = 0;
function drawBubble(b, text, tone) {
  const g = b.cv.getContext("2d"), W = 320, H = 112;
  g.clearRect(0, 0, W, H);
  g.font = "600 25px 'Barlow Semi Condensed', 'Arial Narrow', Arial, sans-serif";
  const words = String(text).split(" "), lines = [""];
  for (const w of words) { const t = lines[lines.length - 1] ? lines[lines.length - 1] + " " + w : w; if (g.measureText(t).width > 280 && lines[lines.length - 1]) { if (lines.length >= 2) { lines[1] += "…"; break; } lines.push(w); } else lines[lines.length - 1] = t; }
  const bw = Math.min(304, Math.max(...lines.map(l => g.measureText(l).width)) + 26), bh = lines.length * 28 + 18, x = (W - bw) / 2, y = 4;
  g.fillStyle = tone === "bad" ? "rgba(255,226,214,.96)" : "rgba(243,233,210,.96)"; g.strokeStyle = tone === "bad" ? "#d4423f" : "#8a6a2c"; g.lineWidth = 3;
  g.beginPath(); g.moveTo(x + 12, y); g.lineTo(x + bw - 12, y); g.quadraticCurveTo(x + bw, y, x + bw, y + 12); g.lineTo(x + bw, y + bh - 12); g.quadraticCurveTo(x + bw, y + bh, x + bw - 12, y + bh);
  g.lineTo(W / 2 + 10, y + bh); g.lineTo(W / 2 - 4, y + bh + 16); g.lineTo(W / 2 - 6, y + bh); g.lineTo(x + 12, y + bh); g.quadraticCurveTo(x, y + bh, x, y + bh - 12); g.lineTo(x, y + 12); g.quadraticCurveTo(x, y, x + 12, y); g.closePath();
  g.fill(); g.stroke();
  g.fillStyle = "#07140f"; g.textAlign = "center"; g.textBaseline = "middle";
  lines.forEach((l, i) => g.fillText(l, W / 2, y + 23 + i * 28));
  b.tx.needsUpdate = true;
}
// un cliente dice algo (solo si está cerca del jugador; forced ignora el enfriamiento global)
function say(c, text, opt) {
  opt = opt || {};
  if (!alive(c) || !text || !G.near(c.x, c.z, opt.far || 15)) return false;
  if (!opt.forced && bubbleCd > 0) return false;
  let b = bubbles.find(x => x.c === c) || bubbles.find(x => x.life <= 0);
  if (!b) { b = bubbles.reduce((a, x) => x.life < a.life ? x : a, bubbles[0]); }
  drawBubble(b, text, opt.tone); b.c = c; b.life = opt.sec || 3.2; b.sp.visible = true; b.sp.material.opacity = 1;
  bubbleCd = opt.forced ? 0.6 : 2.4; saidCount++;
  return true;
}

// =====================================================================
// ÁNIMO Y POSES (se aplican después de la animación de game.js, sin geometría nueva)
// =====================================================================
function addMood(c, d) { if (!c) return; c.lifeMood = clamp((c.lifeMood || 0) + d, L.mood.min, L.mood.max); }
function anim(c, k, dur, o) {
  if (!alive(c)) return;
  if (c.anim && c.anim.k === "kick") return; // no cortar una patada
  if (c.anim) endAnim(c);
  c.anim = Object.assign({ k, t: 0, dur }, o || {});
}
function restSeat(c) { // vuelve a la pose de juego si estaba jugando
  const p = c.person; if (!p) return;
  p.group.position.y = 0;
  if (c.state === "play" && c.machine && !c.life) { p.api.sit(0.72); p.group.rotation.y = c.machine.slot.faceY || 0; }
  else if (c.state === "play" && c.seat && !c.life) { p.group.rotation.y = c.seat.rot; if (c.table && c.table.sit) p.api.sit(c.table.sit); }
}
function endAnim(c) {
  const a = c.anim; c.anim = null;
  if (!a || !c.person) return;
  c.person.group.position.y = 0;
  if (a.stood) restSeat(c);
}
function standUp(c, a) { if (!a.stood && c.person) { a.stood = true; c.person.api.stand(); } }
const FACE_OF = { shake: "sad", kick: "angry", clap: "happy", glance: "surprised" }; // gesto de la cara para cada reacción (art.js)
const face = (c, f, s) => { if (c.person && c.person.api.face) c.person.api.face(f, s); };
function runAnim(c, dt) {
  const a = c.anim, p = c.person, J = p.api.joints, g = p.group;
  a.t += dt; const u = a.t / a.dur;
  if (!a.f) { a.f = 1; if (FACE_OF[a.k]) face(c, FACE_OF[a.k], a.k === "glance" ? 0.8 : a.dur + 0.6); }
  if (u >= 1 || (a.stood && c.state !== "play" && c.state !== "queue" && !c.life)) { endAnim(c); return; }
  switch (a.k) {
    case "jump": {
      if (!a.t0) { a.t0 = 1; standUp(c, a); p.api.cheer(a.dur); }
      const h = Math.abs(Math.sin(a.t * Math.PI * 2.4)) * 0.26 * (1 - u * 0.4);
      g.position.y = h; J.kneeL.rotation.x = J.kneeR.rotation.x = h * 2.2; J.legL.rotation.x = J.legR.rotation.x = -h * 1.2;
      break;
    }
    case "bounce": { if (!a.t0) { a.t0 = 1; p.api.cheer(a.dur); } g.position.y = Math.abs(Math.sin(a.t * Math.PI * 3)) * 0.05; break; }
    case "shake": J.head.rotation.y = Math.sin(a.t * 17) * 0.55 * (1 - u); J.head.rotation.x = 0.3; J.torso.rotation.x = (p.api.sitting ? 0.08 : 0) + 0.18 * Math.sin(Math.PI * u); break;
    case "kick": {
      const m = a.m;
      if (!a.t0) { a.t0 = 1; standUp(c, a); if (m) g.rotation.y = Math.atan2(m.slot.x - c.x, m.slot.z - c.z); }
      if (u < 0.35) J.legR.rotation.x = 0.7 * (u / 0.35);
      else if (u < 0.55) { J.legR.rotation.x = 0.7 - 2.1 * ((u - 0.35) / 0.2); J.kneeR.rotation.x = 0.2; if (!a.hit && u > 0.47) { a.hit = 1; kickHit(c, m); } }
      else J.legR.rotation.x = -1.4 * (1 - (u - 0.55) / 0.45);
      J.armL.rotation.z = -0.5; J.armR.rotation.z = 0.5; J.torso.rotation.x = -0.12;
      break;
    }
    case "clap": {
      const s = 0.2 + 0.32 * (0.5 + 0.5 * Math.sin(a.t * 21));
      J.armL.rotation.set(-1.25, 0, s); J.armR.rotation.set(-1.25, 0, -s); J.elbowL.rotation.x = J.elbowR.rotation.x = -0.75;
      break;
    }
    case "glance": {
      const rel = clamp(wrapAngle(Math.atan2(a.x - c.x, a.z - c.z) - g.rotation.y), -1.3, 1.3);
      J.head.rotation.y = rel * Math.min(1, a.t * 5, (a.dur - a.t) * 4);
      break;
    }
    case "party": { if (!a.t0) { a.t0 = 1; p.api.cheer(Math.min(a.dur, 1.5)); } g.position.y = Math.abs(Math.sin(a.t * Math.PI * 2.2)) * 0.1; break; }
  }
}
// poses continuas de los actores de eventos (se llaman cada paso)
function poseDrunk(c, t) { face(c, "happy", 0.3); const J = c.person.api.joints; J.torso.rotation.z = Math.sin(t * 2.1) * 0.17; J.head.rotation.z = Math.sin(t * 1.6 + 1) * 0.22; J.head.rotation.x = 0.15; }
function posePunch(c, t) {
  face(c, "angry", 0.3); const J = c.person.api.joints, ph = Math.sin(t * 8.5);
  J.armR.rotation.set(ph > 0 ? -1.55 : -0.85, 0, 0.12); J.armL.rotation.set(ph > 0 ? -0.85 : -1.55, 0, -0.12);
  J.elbowR.rotation.x = ph > 0 ? -0.15 : -1.5; J.elbowL.rotation.x = ph > 0 ? -1.5 : -0.15;
  J.torso.rotation.y = ph * 0.3; J.torso.rotation.x = 0.1;
}
function poseArgue(c, t) { face(c, "angry", 0.3); const J = c.person.api.joints; J.armR.rotation.set(-0.9 + Math.sin(t * 6) * 0.45, 0, 0.2); J.elbowR.rotation.x = -1.1; J.armL.rotation.set(-0.3, 0, -0.45); J.head.rotation.x = -0.1 + Math.sin(t * 5) * 0.08; }

// =====================================================================
// REACCIONES — premios, rachas malas, patadas, aplausos
// =====================================================================
const LINES = {
  jackpot: ["¡¡JACKPOT!! ¡No lo puedo creer!", "¡Me salvé! ¡Pago todo el mes!", "¡Llamen a mi vieja!"],
  win: ["¡Vamos todavía!", "¡Tres sietes, papá!", "¡Hoy es mi noche!", "¡Esta máquina me ama!"],
  lose: ["Esta máquina me odia.", "¡Otra vez nada!", "¿Está arreglada esta máquina?", "Una más y me voy... mentira."],
  kick: ["¡Devolveme la plata!", "¡Máquina chorra!"],
  table: ["¡Blackjack, señores!", "Ese croupier me trae suerte."],
  wait: ["¡Cuánto hay que esperar!", "No hay ni una máquina libre...", "Me voy a El Faraón, eh."],
  broken: ["Che, esa máquina está rota hace rato.", "¿Nadie arregla esa máquina?"],
  mess: ["¡Qué asco este piso!", "Casi me resbalo acá.", "¿Nadie limpia esto?"],
  dark: ["¡Uuuh, se cortó la luz!", "¡Justo cuando iba ganando!", "¿Y ahora? ¡Prendan algo!"],
  chatPlay: ["Dale, dale, ¡vengan los sietes!", "Una vuelta más y me voy.", "Hoy siento que gano.", "¿Viste el pozo del Jackpot?", "Le apuesto todo al rojo... mentira."],
  chatWalk: ["¿Vamos a la ruleta?", "Qué lindo quedó esto.", "Busquemos una máquina con onda.", "Dicen que la Dorada paga bien."],
  chatNice: ["¡Qué lujo este lugar!", "Me encanta la decoración.", "Este casino está cada vez mejor."],
  chatRival: ["Fui a El Faraón y me aburrí.", "Acá atienden mejor que enfrente."],
  drunk: ["¡Una más y me voy! Hic.", "¿Vos sos el dueño? ¡Te quiero, hermano!", "¡Esta noche gano todo! Hic.", "¿Quién me movió el piso?"],
  bothered: ["¡Andá a dormir, flaco!", "¡Correte que me tapás la máquina!", "¡Seguridad!"],
  fight: ["¡¿Qué mirás?!", "¡Esa máquina era mía!", "¡Vení, vení!", "¡Soltame!"],
  fightCrowd: ["¡Llamen a seguridad!", "¡Se están matando!", "¡Uy, uy, uy!"],
  bday: ["¡Que los cumpla feliz!", "¡Feliz cumple!", "¿Y la torta?", "¡Hoy invita el cumpleañero!"],
  celeb: ["¡Qué lindo lugar, che!", "¿Me sacan una foto acá?", "Esto es mejor que Las Vegas."],
  celebBad: ["Esto es un desastre...", "Me dijeron que era un lugar de categoría."],
};
let crowdBoost = 1, crowdT = 0;
function crowdKick(v, sec) { if (v >= crowdBoost) { crowdBoost = v; crowdT = Math.max(crowdT, sec); } }
function celebrate(c, big, m) {
  emote(c, "money", 3); addMood(c, L.mood.bigWin);
  anim(c, big ? "jump" : "bounce", big ? 1.7 : 1.1);
  G.sfx("cheer", c.x, c.z, big ? { gain: 1.2 } : null);
  say(c, pick(big ? LINES.jackpot : LINES.win), { forced: big });
  crowdKick(big ? 1.8 : 1.35, big ? 6 : 3);
  const R = big ? L.react.jackpotClap : L.react.nearClap;
  let n = 0;
  for (const o of G.customers) {
    if (o === c || !free(o) || dist(o, c) > R || o.anim) continue;
    if (o.state === "play" || o.state === "queue") { if (Math.random() < (big ? 0.7 : 0.45)) { anim(o, "clap", rnd(1.3, 2.2)); n++; } else anim(o, "glance", rnd(1.4, 2.2), { x: c.x, z: c.z }); }
    else anim(o, "glance", rnd(1.2, 2), { x: c.x, z: c.z });
    if (Math.random() < 0.35) emote(o, "happy", 2);
  }
  if (n >= 1) G.sfx("clap", c.x, c.z, { delay: 0.25 });
}
function onSpin(m, c, prize, jackpot) {
  if (!alive(c) || c.thief || c.life) return;
  if (prize > 0) {
    c.lifeStreak = 0;
    if (c.lifeTag && c.lifeTag.onWin) c.lifeTag.onWin(c, prize);
    if (jackpot || prize >= m.def.bet * L.react.bigWinMul) celebrate(c, !!jackpot || prize >= m.def.bet * 15, m);
    else if (Math.random() < 0.3) emote(c, "happy", 1.8);
    return;
  }
  const s = c.lifeStreak = (c.lifeStreak || 0) + 1, R = L.react;
  if (s < R.streakShake || (s > R.streakShake && s % 4 !== 0) || c.anim) return;
  if (s >= R.streakKick && Math.random() < R.kickChance) {
    anim(c, "kick", 1.1, { m }); emote(c, "angry", 2.5); say(c, pick(LINES.kick), { tone: "bad" });
  } else {
    anim(c, "shake", 1.1); emote(c, Math.random() < 0.5 ? "angry" : "sad", 2.4); addMood(c, L.mood.shake);
    G.sfx("grumble", c.x, c.z); if (Math.random() < 0.6) say(c, pick(LINES.lose));
  }
}
function kickHit(c, m) {
  addMood(c, L.mood.kick);
  if (!m || m.dead) return;
  G.sfx("thud", m.slot.x, m.slot.z); m.lifeWobble = 0.6;
  for (const o of G.customers) if (o !== c && free(o) && !o.anim && dist(o, c) < 5) anim(o, "glance", 1.5, { x: c.x, z: c.z });
  if (!m.d.broken && Math.random() < L.react.kickBreak) G.breakMachine(m);
}
function onBet(c, won) { // mesas
  if (!alive(c) || c.thief || c.life) return;
  if (won) { c.lifeStreak = 0; if (Math.random() < 0.25) { emote(c, "happy", 1.8); if (Math.random() < 0.4) say(c, pick(LINES.table)); } return; }
  const s = c.lifeStreak = (c.lifeStreak || 0) + 1;
  if (s >= L.react.streakShake && s % 3 === 0 && !c.anim) { anim(c, "shake", 1.1); emote(c, "sad", 2.2); addMood(c, L.mood.shake); }
}

// =====================================================================
// MANCHAS EN EL PISO (bajan el atractivo hasta que las limpiás)
// =====================================================================
const messGeo = new T.CircleGeometry(0.46, 18); messGeo.rotateX(-Math.PI / 2);
const splat = (cols, shards) => A.canvasTex(128, 128, g => {
  g.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 9; i++) { g.fillStyle = cols[i % cols.length]; g.globalAlpha = 0.85; g.beginPath(); g.arc(64 + rnd(-30, 30), 64 + rnd(-30, 30), rnd(10, 26), 0, 7); g.fill(); }
  g.globalAlpha = 1;
  if (shards) { g.fillStyle = "rgba(230,245,255,.9)"; for (let i = 0; i < 9; i++) { g.save(); g.translate(64 + rnd(-40, 40), 64 + rnd(-40, 40)); g.rotate(rnd(0, 3)); g.beginPath(); g.moveTo(0, -6); g.lineTo(3, 4); g.lineTo(-3, 3); g.closePath(); g.fill(); g.restore(); } }
});
const MESS = {
  drink: { name: "Trago derramado", mat: new T.MeshBasicMaterial({ map: splat(["#8a4a14", "#b0702a", "#6a3a10"]), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }) },
  glass: { name: "Vasos rotos", mat: new T.MeshBasicMaterial({ map: splat(["#6a3a10", "#9a6a2a"], true), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }) },
  confetti: { name: "Papelitos y serpentinas", mat: new T.MeshBasicMaterial({ map: splat(["#e0503a", "#f6c766", "#3a6fd6", "#6fd39b", "#c8577a"]), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }) },
};
const messes = [];
let messSeq = 0;
function spotFree(x, z) {
  if (x < -21.4 || x > 21.4 || z < -9.4 || z > 9.4) return false;
  const s = S(); if ((x < -10 && !s.zones.oeste) || (x > 10 && !s.zones.este)) return false;
  for (const c of G.colliders) if (c.on() && x > c.minX - 0.25 && x < c.maxX + 0.25 && z > c.minZ - 0.25 && z < c.maxZ + 0.25) return false;
  for (const m of messes) if (Math.hypot(m.x - x, m.z - z) < 0.8) return false;
  return true;
}
function addMess(x, z, kind, quiet) {
  if (messes.length >= L.mess.max) return null;
  let p = null;
  for (let i = 0; i < 14 && !p; i++) { const r = i ? 0.4 + i * 0.15 : 0, a = Math.random() * 6.3, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (spotFree(px, pz)) p = { x: px, z: pz }; }
  if (!p) return null;
  const K = MESS[kind] || MESS.drink, grp = new T.Group();
  grp.position.set(p.x, 0.014 + messes.length * 0.0015, p.z); grp.rotation.y = Math.random() * 6.3;
  const mesh = new T.Mesh(messGeo, K.mat); mesh.scale.setScalar(rnd(0.85, 1.2)); grp.add(mesh); G.scene.add(grp);
  const ms = { id: ++messSeq, x: p.x, z: p.z, kind, grp, cleaned: false };
  ms.proxy = G.proxy(grp, 1.0, 0.3, 1.0, {
    prompt: () => ({ text: "Limpiar el enchastre", sub: `${K.name} · baja ${L.mess.atr} de atractivo · mantené ${G.KEY}` }),
    hold: () => L.mess.holdSec, usable: () => true, use: () => cleanMess(ms, true),
  }, 0.15);
  messes.push(ms);
  if (!quiet) G.sfx("spill", p.x, p.z);
  G.hint("lifeMess", `Hay un enchastre en el piso: baja el atractivo y la gente se queja. Miralo y mantené ${G.KEY} para limpiarlo.`);
  return ms;
}
function cleanMess(ms, byPlayer) {
  if (ms.cleaned) return;
  ms.cleaned = true; G.scene.remove(ms.grp); G.dropProxy(ms.proxy);
  const i = messes.indexOf(ms); if (i >= 0) messes.splice(i, 1);
  if (byPlayer) { G.Rank.add(L.mess.xp); G.floatText(ms.x, 1.2, ms.z, "¡Limpio!", "#9fd0ff"); G.sfx("repair", ms.x, ms.z); }
}
function clearMesses() { for (const m of messes.slice()) cleanMess(m, false); }

// =====================================================================
// TABLERO ELÉCTRICO (fondo izquierda, contra la pared): se usa en el apagón
// =====================================================================
const PANEL = { x: -9.3, z: 9.74, front: { x: -9.3, z: 8.85 } };
const panel = (() => {
  const g = new T.Group(); g.position.set(PANEL.x, 0, PANEL.z); g.rotation.y = Math.PI; G.scene.add(g);
  const body = new T.Mesh(new T.BoxGeometry(0.62, 0.84, 0.14), new T.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.6, metalness: 0.4 })); body.position.y = 1.45; g.add(body);
  const stripe = new T.Mesh(new T.PlaneGeometry(0.58, 0.1), new T.MeshBasicMaterial({ map: A.canvasTex(128, 24, (x, w, h) => { x.fillStyle = "#1a1a1a"; x.fillRect(0, 0, w, h); x.fillStyle = "#f0c020"; for (let i = -2; i < 12; i++) { x.beginPath(); x.moveTo(i * 14, h); x.lineTo(i * 14 + 7, h); x.lineTo(i * 14 + 19, 0); x.lineTo(i * 14 + 12, 0); x.closePath(); x.fill(); } }) }));
  stripe.position.set(0, 1.79, 0.071); g.add(stripe);
  const label = new T.Mesh(new T.PlaneGeometry(0.4, 0.12), new T.MeshBasicMaterial({ map: A.canvasTex(160, 48, (x, w, h) => { x.fillStyle = "#e9e2cf"; x.fillRect(0, 0, w, h); x.fillStyle = "#1a1a1a"; x.font = "bold 22px Arial"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("TABLERO", w / 2, h / 2 + 1); }) }));
  label.position.set(0, 1.6, 0.071); g.add(label);
  const lever = new T.Group(); lever.position.set(0, 1.3, 0.08); g.add(lever);
  const leverMat = new T.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5 });
  const handle = new T.Mesh(new T.BoxGeometry(0.06, 0.16, 0.05), leverMat); handle.position.y = 0.07; lever.add(handle);
  const knob = new T.Mesh(new T.BoxGeometry(0.1, 0.04, 0.07), new T.MeshStandardMaterial({ color: 0xd4423f, roughness: 0.4 })); knob.position.y = 0.15; lever.add(knob);
  const ledMat = new T.MeshBasicMaterial({ color: 0x49c46f });
  const led = new T.Mesh(new T.SphereGeometry(0.022, 8, 6), ledMat); led.position.set(0.2, 1.3, 0.08); g.add(led);
  G.boxAt(PANEL.x, PANEL.z - 0.02, 0.72, 0.26, "panel");
  G.proxy(g, 0.8, 1.0, 0.5, {
    prompt: () => outage() ? { text: "Subir la térmica", sub: `Mantené ${G.KEY} para devolver la luz` } : { text: "Tablero eléctrico", sub: "Todo en orden" },
    hold: () => outage() ? L.outage.holdSec : 0, usable: () => !!outage(), use: () => { const e = outage(); if (e) e.fix("player"); },
  }, 1.45, 0, 0.12);
  return { g, lever, ledMat, set(on) { lever.rotation.x = on ? 0 : Math.PI * 0.85; ledMat.color.setHex(on ? 0x49c46f : 0xff3a2a); } };
})();
// luces del salón (las que ya existen; durante el apagón se bajan, nunca se agregan)
let roomLights = null;
function lights(dim) {
  if (!roomLights) { roomLights = []; G.scene.traverse(o => { if (o.isLight && !o.isDirectionalLight) roomLights.push({ o, i: o.intensity }); }); }
  for (const l of roomLights) l.o.intensity = dim ? l.i * (l.o.isHemisphereLight ? 0.5 : 0.25) : l.i;
}

// =====================================================================
// ACTORES Y PERSONAL — clientes y empleados que los eventos manejan a mano
// =====================================================================
// accesorios (geometría y materiales compartidos): gorrito de cumpleaños y anteojos de sol
const hatGeo = new T.ConeGeometry(0.075, 0.2, 10); hatGeo.translate(0, 0.1, 0);
const hatMats = [0xe0503a, 0x3a6fd6, 0x6fd39b, 0xf6c766].map(c => new T.MeshStandardMaterial({ color: c, roughness: 0.6 }));
const shadesGeo = new T.BoxGeometry(0.2, 0.045, 0.03), shadesMat = new T.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.2, metalness: 0.6 });
function addAcc(c, kind) {
  if (!alive(c)) return;
  const head = c.person.api.joints.head;
  const m = kind === "hat" ? new T.Mesh(hatGeo, pick(hatMats)) : new T.Mesh(shadesGeo, shadesMat);
  if (kind === "hat") { m.position.set(0, 0.25, -0.01); m.rotation.z = rnd(-0.2, 0.2); } else m.position.set(0, 0.155, 0.12);
  head.add(m); (c.lifeAcc || (c.lifeAcc = [])).push(m);
}
function dropAcc(c) { if (c.lifeAcc) for (const m of c.lifeAcc) if (m.parent) m.parent.remove(m); c.lifeAcc = null; }
// toma el control de un cliente (game.js deja de moverlo mientras c.life exista)
function grab(c, e, role, st) {
  G.releaseGame(c); c.state = "life"; c.path = null;
  if (c.drink && c.drink.state !== "served") c.drink.state = "missed";
  c.person.api.stand(); c.person.group.position.y = 0; G.setIcon(c.person, null);
  if (c.anim) endAnim(c);
  c.life = { e, role, st: st || "idle", t: Math.random() * 5 };
  return c;
}
// devuelve el cliente a game.js
function release(c) {
  if (!alive(c)) return;
  if (GONE.has(c.state)) { c.life = null; c.lifeAct = null; return; }
  c.life = null; c.lifeAct = null; c.path = null; c.person.api.stand(); c.person.group.position.y = 0;
  if (G.isOpen) { c.state = "choose"; } else { c.state = "choose"; G.leaveCustomer(c); }
}
// lo acompañan a la vereda y desaparece (sin tocar la reputación)
function escortOut(c, speed) {
  if (!alive(c)) return;
  G.releaseGame(c);
  c.life = { e: null, role: "out", st: "escort", t: 0, speed: speed || 1.6 }; c.lifeAct = null; c.state = "life";
  c.person.api.stand(); c.person.group.position.y = 0; G.setBar(c.person, null); G.setIcon(c.person, null);
  if (c.anim) endAnim(c);
  const sp = G.streetPoint(); G.goTo(c, sp.x, sp.z);
}
function actor(c, dt) {
  const lf = c.life;
  if (lf.st === "escort") { if (G.stepAgent(c, dt, lf.speed)) G.despawnCustomer(c); else if (lf.role === "drunk") poseDrunk(c, lf.t += dt); return true; }
  if (!lf.e || lf.e.done) { release(c); return false; }
  if (!G.isOpen) { const e = lf.e; finish(e, "cut"); release(c); return false; }
  lf.t += dt;
  return lf.e.actor ? lf.e.actor(c, lf, dt) !== false : false;
}
function pickStaff(role, x, z, okState) {
  let best = null, bd = Infinity;
  for (const n of G.staffNpcs) { if (n.role !== role || n.dead || n.lifeTask || (okState && !okState(n))) continue; const d = Math.hypot(n.x - x, n.z - z); if (d < bd) { bd = d; best = n; } }
  return best;
}
function sendStaff(n, task) { if (n.role === "sec") n.thief = null; n.lifeTask = Object.assign({ t: 0, re: 0, speed: 3.6, reach: 1.15 }, task); setIconStaff(n, "excl"); return n; }
// el técnico deja la reparación que tenía entre manos (la luz es más urgente); la máquina vuelve a quedar libre para él
function dropRepair(n) {
  const m = n.target;
  if (m && !m.dead) { if (m.claimTech === n) m.claimTech = null; m.api.setDoorOpen(false); }
  if (n.person) G.setBar(n.person, null);
  n.target = null; n.state = "idle"; n.path = null;
}
function setIconStaff(n, k) { if (n.person) G.setIcon(n.person, k); }
function clearTask(n, owner) {
  if (!n || !n.lifeTask || (owner && n.lifeTask.owner !== owner)) return;
  n.lifeTask = null; n.path = null; setIconStaff(n, null);
  if (n.role === "sec") { n.state = "patrol"; n.t = 1; } else n.state = "idle";
}
function staffTask(n, dt) {
  const tk = n.lifeTask;
  if (tk.target && !alive(tk.target)) { clearTask(n); return false; }
  const tx = tk.target ? tk.target.x : tk.x, tz = tk.target ? tk.target.z : tk.z;
  tk.t += dt; tk.re -= dt;
  if (tk.t > 45) { clearTask(n); return false; }
  if (tk.re <= 0 || !n.path || !n.path.length) { tk.re = 0.7; G.goTo(n, tx, tz); }
  G.stepAgent(n, dt, tk.speed);
  if (Math.hypot(n.x - tx, n.z - tz) < tk.reach) { const f = tk.onArrive; clearTask(n); if (f) f(n); }
  return true;
}
function insideList(filter) { return G.customers.filter(c => free(c) && (!filter || filter(c))); }
function nearestTo(c, list, max) { let best = null, bd = max || Infinity; for (const o of list) { if (o === c) continue; const d = dist(o, c); if (d < bd) { bd = d; best = o; } } return best; }

// =====================================================================
// EVENTOS — cada uno: can(), weight(), start(opts) -> { hud(), left, update(dt), actor(), cleanup() }
// =====================================================================
const EV = {};
let active = [], dayLog = [];
function begin(id, opts, forced) {
  const def = EV[id]; if (!def || !S() || S().dayOver) return null;
  if (active.some(e => e.id === id)) return null;
  if (!forced && !def.can()) return null;
  if (forced && def.need && !def.need()) return null;
  const e = def.start(opts || {}); if (!e) return null;
  e.id = id; e.name = def.name; e.t = 0; e.done = false;
  active.push(e);
  G.updateHud(true);
  return e;
}
function finish(e, result, msg, kind) {
  if (!e || e.done) return;
  e.done = true; e.result = result;
  if (msg) G.toast(msg, kind);
  if (result !== "cut" || e.note) dayLog.push({ id: e.id, result, note: e.note || null });
  window.CasinoChallenge?.ev?.("life", e.id, result); // logros (challenge.js)
  try { if (e.cleanup) e.cleanup(); } catch (err) { console.error(err); }
  active = active.filter(x => x !== e);
}
const RESULT_TEXT = {
  drunk: { ok: "acompañaste al borracho a la vereda", guard: "un guardia sacó al borracho", fail: "el borracho molestó a medio salón" },
  fight: { ok: "separaste una pelea a tiempo", guard: "seguridad separó una pelea", fail: "una pelea terminó a las piñas (+calor)" },
  birthday: { ok: "festejaron un cumpleaños y dejaron propina", fail: "un cumpleaños se fue enojado" },
  cheater: { ok: "atrapaste a un tramposo", guard: "un guardia atrapó a un tramposo", fail: "un tramposo se fue con plata de la casa" },
  outage: { ok: "subiste la térmica en el apagón", guard: "el técnico arregló el apagón", fail: "el apagón duró hasta el cierre" },
  celebrity: { ok: "una celebridad se fue feliz", fail: "una celebridad se fue decepcionada" },
  mess: { ok: "limpiaste una bandeja volcada a tiempo", fail: "el piso quedó sucio un buen rato" },
};
const mmss = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

// ---------- BORRACHO ----------
EV.drunk = {
  name: "Borracho",
  can: () => G.machines.length + G.tables.length > 0,
  weight: () => 1 + (S().rep < 40 ? 0.5 : 0) + S().heat / 100,
  start() {
    const c = G.spawnCustomer("casual", false);
    const e = { c, bother: 0, left: L.drunk.sec * dm().time, spillT: L.drunk.spillEvery * 0.6, guardT: L.drunk.guardDelay * dm().time, guard: null, target: null };
    grab(c, e, "drunk", "enter"); G.goTo(c, G.DOOR.x + rnd(-0.4, 0.4), G.DOOR.z);
    c.budget = 0; c.speed = 1.25;
    c.lifeAct = { active: () => !e.done, prompt: () => ({ text: "Acompañar al borracho afuera", sub: "Con un vaso de agua y buenos modales" }), use: () => e.resolve("player") };
    emote(c, "hic", Infinity);
    const sec = S().staff.sec > 0;
    G.toast(`Entró un borracho y anda molestando a la gente. Miralo y ${G.KEY} para acompañarlo afuera${sec ? " (o esperá a que lo saque un guardia)" : ""}.`, "bad");
    G.hint("lifeDrunk", "Los eventos de la noche aparecen en el HUD con su tiempo. Si los ignorás, tienen consecuencias.");
    e.hud = () => `Borracho molestando${e.bother ? ` · ${e.bother} molestia${e.bother > 1 ? "s" : ""}` : ""}`;
    e.resolve = how => {
      if (e.done) return;
      say(c, "¡Te quiero, hermano! Hic.", { forced: true }); escortOut(c, 1.3); c.life.role = "drunk";
      if (how === "player") { G.Rep.change(L.drunk.rep); G.Rank.add(L.drunk.xp); clapAround(c, 6); finish(e, "ok", "Acompañaste al borracho hasta la vereda. La gente te lo agradece.", "good"); }
      else { G.Rep.change(L.drunk.guardRep); finish(e, "guard", "Un guardia sacó al borracho del casino.", "good"); }
    };
    e.update = dt => {
      if (!alive(c)) { finish(e, "fail"); return; }
      e.left -= dt;
      if (e.guard && (!e.guard.lifeTask || e.guard.lifeTask.owner !== e)) e.guard = null;
      if (!e.guard && S().staff.sec > 0) { e.guardT -= dt; if (e.guardT <= 0) { e.guardT = 3; const g = pickStaff("sec", c.x, c.z, n => n.state !== "chase"); if (g) e.guard = sendStaff(g, { owner: e, target: c, speed: 3.3, reach: 1.25, onArrive: () => e.resolve("guard") }); } }
      if (e.left <= 0) {
        const o = nearestTo(c, insideList(), 14);
        e.note = o ? "el borracho terminó a las piñas con un cliente" : null;
        if (o) { G.Rep.change(L.drunk.repBother * pen()); begin("fight", { a: c, b: o }, true); finish(e, "fail", "El borracho se cansó de molestar y le pegó a un cliente.", "bad"); }
        else { G.Rep.change(L.drunk.noFightRep * pen()); escortOut(c, 1.3); c.life.role = "drunk"; finish(e, "fail", "El borracho se fue solo, después de molestar a todos.", "bad"); }
      }
    };
    e.actor = (c, lf, dt) => {
      if (lf.st === "enter") { if (G.stepAgent(c, dt, 1.3)) lf.st = "wander"; poseDrunk(c, lf.t); return true; }
      if (lf.st === "wander") {
        if (!c.path || !c.path.length) {
          const pool = insideList(o => o.state === "play" || o.state === "queue");
          const t = pool.length ? pick(pool) : null;
          e.target = t;
          if (t) G.goTo(c, t.x + rnd(-0.7, 0.7), t.z - 0.75); else { const pts = G.PATROL.principal; const q = pick(pts); G.goTo(c, q.x, q.z); }
        }
        if (G.stepAgent(c, dt, 1.2)) { lf.st = "bother"; lf.wait = 4.5; if (e.target && free(e.target) && dist(c, e.target) < 2.2) annoy(e.target); }
        const g = c.person.group; g.position.x += Math.sin(lf.t * 2.3) * 0.12; g.position.z += Math.cos(lf.t * 1.9) * 0.08; // tambalea
        poseDrunk(c, lf.t);
      } else if (lf.st === "bother") {
        c.person.api.idle(dt); if (e.target && alive(e.target)) G.turnToward(c, Math.atan2(e.target.x - c.x, e.target.z - c.z), dt);
        poseDrunk(c, lf.t); poseArgue(c, lf.t);
        lf.wait -= dt; if (lf.wait <= 0) { lf.st = "wander"; c.path = null; }
      }
      e.spillT -= dt; if (e.spillT <= 0) { e.spillT = L.drunk.spillEvery * rnd(0.8, 1.2); addMess(c.x, c.z, "drink"); }
      if (Math.random() < dt / 7) say(c, pick(LINES.drunk));
      return true;
    };
    function annoy(t) {
      e.bother++; G.Rep.change(L.drunk.repBother * pen()); addMood(t, L.mood.bothered);
      emote(t, "angry", 2.6); anim(t, "glance", 2.5, { x: c.x, z: c.z }); say(t, pick(LINES.bothered), { tone: "bad" });
    }
    e.cleanup = () => { if (e.guard) clearTask(e.guard, e); if (alive(c) && c.life && c.life.e === e) escortOut(c, 1.3); };
    return e;
  },
};
function clapAround(c, r) { let n = 0; for (const o of G.customers) if (o !== c && free(o) && !o.anim && dist(o, c) < r && (o.state === "play" || o.state === "queue")) { anim(o, "clap", rnd(1.2, 2)); n++; } if (n) G.sfx("clap", c.x, c.z); }

// ---------- PELEA ----------
EV.fight = {
  name: "Pelea",
  can: () => S().rank >= 2 && insideList(c => c.state === "play" || c.state === "queue" || c.state === "walk").length >= 2,
  need: () => true,
  weight: () => (0.6 + S().heat / 60 + (S().rep < 35 ? 0.5 : 0)) * (window.CasinoWorld ? window.CasinoWorld.fightMul() : 1), // world.js: protección
  start(o) {
    let a = o.a, b = o.b;
    if (!alive(a)) { const pool = insideList(c => c.state === "play" || c.state === "queue" || c.state === "walk" || c.state === "choose"); a = pool.length ? pick(pool) : null; }
    if (!alive(b) || b === a) { b = a ? nearestTo(a, insideList(c => c !== a), 30) : null; }
    const spawnIn = () => { const c = G.spawnCustomer("casual", false); const q = pick(G.QUEUE); G.placeAgent(c, q.x + rnd(-0.3, 0.3), q.z + rnd(-0.3, 0.3)); return c; };
    if (!alive(a)) a = spawnIn();
    if (!alive(b) || b === a) { b = spawnIn(); G.placeAgent(b, a.x + 1.4, a.z); }
    const e = { a, b, left: L.fight.sec * dm().time, guard: null, guardT: L.fight.guardDelay * dm().time, punchT: 0, crowdT: 0, seen: new Set(), at: null };
    for (const c of [a, b]) {
      grab(c, e, "fighter", c === a ? "approach" : "wait");
      c.lifeAct = { active: () => !e.done, hold: () => L.fight.holdSec, prompt: () => ({ text: "Separar la pelea", sub: L.fight.holdSec > 0 ? `Mantené ${G.KEY} para meterte en el medio` : "Te metés en el medio antes de que rompan algo" }), use: () => e.resolve("player") };
      emote(c, "fight", Infinity);
    }
    G.sfx("punch", b.x, b.z); G.sfx("alarm");
    G.toast(`¡Se armó una pelea entre dos clientes! Mirá a uno y ${L.fight.holdSec > 0 ? "mantené " : ""}${G.KEY} para separarlos${S().staff.sec > 0 ? " (seguridad ya va)" : ""}.`, "bad");
    e.hud = () => "¡Pelea en el salón! Separalos";
    e.resolve = how => {
      if (e.done) return;
      for (const c of [a, b]) { escortOut(c, 1.7); emote(c, "sad", 3); }
      if (how === "player") { G.Rep.change(L.fight.rep); G.Rank.add(L.fight.xp); clapAround(a, 8); finish(e, "ok", "Separaste la pelea. Los dos se van a calmar a la vereda.", "good"); }
      else { G.Rep.change(L.fight.guardRep); finish(e, "guard", "Seguridad separó la pelea y sacó a los dos.", "good"); }
    };
    e.update = dt => {
      if (!alive(a) || !alive(b)) { finish(e, "cut"); return; }
      e.left -= dt; crowdKick(1.55, 0.5);
      if (e.guard && (!e.guard.lifeTask || e.guard.lifeTask.owner !== e)) e.guard = null;
      if (!e.guard && S().staff.sec > 0) { e.guardT -= dt; if (e.guardT <= 0) { e.guardT = 2; const g = pickStaff("sec", a.x, a.z, n => n.state !== "chase"); if (g) e.guard = sendStaff(g, { owner: e, target: a, speed: 4.4, reach: 1.4, onArrive: () => e.resolve("guard") }); } }
      if (a.life && a.life.st === "fight") {
        e.punchT -= dt; if (e.punchT <= 0) { e.punchT = rnd(0.45, 0.8); G.sfx("punch", a.x, a.z); if (Math.random() < 0.3) say(Math.random() < 0.5 ? a : b, pick(LINES.fight), { tone: "bad" }); }
        e.crowdT -= dt;
        if (e.crowdT <= 0) {
          e.crowdT = 1;
          for (const o of G.customers) if (free(o) && dist(o, a) < 7) {
            if (!o.anim) anim(o, "glance", 1.2, { x: a.x, z: a.z });
            if (!e.seen.has(o)) { e.seen.add(o); addMood(o, L.mood.fightNear); if (Math.random() < 0.4) emote(o, "sad", 2); if (Math.random() < 0.15) say(o, pick(LINES.fightCrowd)); }
          }
        }
      }
      if (e.left <= 0) {
        const at = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
        G.Rep.change(L.fight.failRep * pen()); G.Heat.add(L.fight.failHeat, "pelea");
        let broke = "";
        let mb = null, md = 3.2; for (const m of G.machines) { const d = Math.hypot(m.slot.x - at.x, m.slot.z - at.z); if (d < md && !m.d.broken) { md = d; mb = m; } }
        if (mb && Math.random() < L.fight.breakChance) { G.breakMachine(mb); broke = ` y rompieron una ${mb.def.name}`; }
        addMess(at.x, at.z, "glass");
        for (const o of G.customers) if (free(o) && dist(o, at) < 6 && Math.random() < 0.6) { o.flags.waited = true; emote(o, "angry", 3); G.leaveCustomer(o); }
        for (const c of [a, b]) escortOut(c, 2.2);
        finish(e, "fail", `La pelea terminó a las piñas${broke}. Se fue gente asustada y la Lotería se enteró (+calor).`, "bad");
      }
    };
    e.actor = (c, lf, dt) => {
      const other = c === a ? b : a;
      if (!alive(other)) return true;
      if (lf.st === "approach") {
        lf.re = (lf.re || 0) - dt;
        if (lf.re <= 0 || !c.path || !c.path.length) { lf.re = 0.6; G.goTo(c, other.x, other.z); }
        G.stepAgent(c, dt, 2.6);
        if (dist(c, other) < 1.05) { lf.st = "fight"; other.life.st = "fight"; G.sfx("punch", c.x, c.z); }
        return true;
      }
      c.person.api.idle(dt);
      G.turnToward(c, Math.atan2(other.x - c.x, other.z - c.z), dt);
      if (lf.st === "wait") poseArgue(c, lf.t);
      else { posePunch(c, lf.t + (c === a ? 0 : 0.37)); const g = c.person.group, f = Math.sin(lf.t * 3.1) * 0.07; g.position.x += Math.sin(g.rotation.y) * f; g.position.z += Math.cos(g.rotation.y) * f; }
      return true;
    };
    e.cleanup = () => { if (e.guard) clearTask(e.guard, e); for (const c of [a, b]) if (alive(c) && c.life && c.life.e === e) release(c); };
    return e;
  },
};

// ---------- CUMPLEAÑOS ----------
const BDAY_NAMES = ["Gonza", "Vicky", "Pocho", "Marisa", "Facu", "Luli"];
EV.birthday = {
  name: "Cumpleaños",
  can: () => G.machines.length + G.tables.length >= 2 && G.customers.length + 4 <= G.MAX_ACTORS,
  weight: () => 0.8 + S().rep / 100,
  start() {
    const n = Math.min(rndi(L.birthday.size[0], L.birthday.size[1]), G.MAX_ACTORS - G.customers.length);
    if (n < 3) return null;
    const name = pick(BDAY_NAMES), bar = !!S().bar;
    const ctr = bar ? { x: 3.4, z: -6.5 } : { x: -3.4, z: -6.5 };
    const e = { name: name, n, members: [], greeted: false, left: L.birthday.greetSec * dm().time + 8, stay: 0, ctr };
    const sp0 = G.streetPoint();
    for (let i = 0; i < n; i++) {
      const type = i === 0 || S().rank < 2 ? "casual" : pick(["casual", "regular"]);
      const c = G.spawnCustomer(type, false);
      G.placeAgent(c, sp0.x + rnd(-0.8, 0.8), sp0.z + rnd(-0.5, 0.5));
      grab(c, e, i === 0 ? "cumple" : "guest", "enter");
      G.goTo(c, G.DOOR.x + rnd(-0.6, 0.6), G.DOOR.z);
      const a = (i / n) * Math.PI * 2;
      c.life.slot = { x: ctr.x + Math.cos(a) * (i ? 0.95 : 0.2), z: ctr.z + Math.sin(a) * (i ? 0.7 : 0.15) };
      c.lifeAct = { active: () => !e.done && !e.greeted, prompt: () => ({ text: `Saludar al cumpleañero (${name})`, sub: `Vino con ${n - 1} amigos · ${bar ? "si les servís tragos, dejan propina" : "van a jugar con todo"}` }), use: () => e.greet() };
      addAcc(c, "hat"); emote(c, i === 0 ? "cake" : "party", Infinity);
      e.members.push(c);
    }
    G.sfx("party", G.DOOR.x, G.DOOR.z);
    G.toast(`¡Llegó un cumpleaños! ${name} y ${n - 1} amigos esperan en la entrada. Saludá al cumpleañero (${G.KEY}) antes de que se aburran.`, "good");
    e.hud = () => !e.greeted ? `Cumpleaños de ${name}: saludalo en la entrada` : bar ? `Cumpleaños de ${name} · tragos servidos ${drinks()}/${n}` : `Cumpleaños de ${name} · ${n} invitados jugando`;
    const drinks = () => e.members.filter(c => c.flags.drinkOk).length;
    e.greet = () => {
      if (e.done || e.greeted) return;
      e.greeted = true; e.left = L.birthday.stayHours * HOUR;
      G.Rep.change(L.birthday.greetRep); G.Rank.add(L.birthday.xp);
      G.sfx("party", ctr.x, ctr.z); G.sfx("cheer", ctr.x, ctr.z, { delay: 0.3 }); crowdKick(1.4, 3);
      for (const c of e.members) {
        if (!alive(c)) continue;
        c.budget = Math.round(c.budget * L.birthday.budgetMul); c.rounds = Math.round(c.rounds * L.birthday.roundsMul);
        c.wantsDrink = bar; c.lifeTag = e; addMood(c, 0.1); release(c); anim(c, "party", 1.6); emote(c, "party", 3);
      }
      say(e.members[0], "¡Gracias, che! ¡A jugar todos!", { forced: true });
      G.toast(bar ? `Le cantaste el feliz cumpleaños a ${name}. Si les llevás tragos (barra o camarero), dejan propina.` : `Le cantaste el feliz cumpleaños a ${name}. El grupo va a jugar con todo.`, "good");
    };
    e.update = dt => {
      e.left -= dt;
      if (!e.greeted) {
        if (e.left <= 0) {
          G.Rep.change(L.birthday.failRep * pen());
          for (const c of e.members) if (alive(c)) { addMood(c, L.birthday.failMood); emote(c, "sad", 3); c.lifeTag = e; release(c); }
          say(e.members[0], "Ni un saludo... qué lugar amargo.", { forced: true, tone: "bad" });
          finish(e, "fail", `Nadie saludó a ${name} en su cumpleaños: el grupo se ofendió.`, "bad");
        }
        return;
      }
      for (const c of e.members) if (alive(c) && c.state === "queue" && !c.lifePatience) { c.lifePatience = true; c.timer += CFG.patienceSec * 2; } // un grupo de festejo espera más
      const gone = e.members.every(c => !alive(c) || GONE.has(c.state));
      if (gone || e.left <= 0) {
        const d = drinks(), played = e.members.filter(c => c.played).length;
        if (!played) { G.Rep.change(-1 * pen()); finish(e, "fail", `El cumpleaños de ${name} se fue sin poder jugar: no había lugar libre.`, "bad"); return; }
        const tip = d * L.birthday.tipPerDrink + played * L.birthday.tipPerGuest;
        if (tip > 0) G.Economy.add("events", tip);
        G.Rep.change(L.birthday.endRep);
        addMess(ctr.x, ctr.z, "confetti", true);
        finish(e, "ok", `El cumpleaños de ${name} terminó${d ? ` (${d} tragos)` : ""}: dejaron ${fmt(tip)} de propina.`, "good");
      }
    };
    e.actor = (c, lf, dt) => {
      if (lf.st === "enter") { if (G.stepAgent(c, dt, c.speed)) { lf.st = "gather"; G.goTo(c, lf.slot.x, lf.slot.z); } return true; }
      if (lf.st === "gather") { if (G.stepAgent(c, dt, c.speed)) { lf.st = "wait"; } return true; }
      c.person.api.idle(dt);
      const look = lf.role === "cumple" ? G.player : ctr;
      G.turnToward(c, Math.atan2(look.x - c.x, look.z - c.z), dt);
      if (!c.anim && Math.random() < dt / 6) anim(c, "party", 1.2);
      if (Math.random() < dt / 9) say(c, pick(LINES.bday));
      return true;
    };
    e.cleanup = () => { for (const c of e.members) { if (alive(c) && c.life && c.life.e === e) release(c); if (c.lifeTag === e) c.lifeTag = null; } };
    return e;
  },
};

// ---------- TRAMPOSO ----------
EV.cheater = {
  name: "Tramposo",
  can: () => S().rank >= L.cheater.rank && (G.machines.some(m => !m.d.broken) || G.tables.some(t => G.dealerHere(t))),
  weight: () => 0.7 + S().heat / 80,
  start() {
    const c = G.spawnCustomer(S().rank >= 2 && Math.random() < 0.5 ? "regular" : "casual", false);
    c.rounds = 999; c.budget = Math.max(c.budget, 2500);
    const e = { c, phase: "arrive", stolen: 0, wrong: 0, left: L.cheater.sec * dm().time, drainT: L.cheater.drainEvery, guard: null, guardT: L.cheater.guardDelay * dm().time, suspects: [], glintT: 0 };
    c.lifeTag = e;
    const act = x => ({ active: () => !e.done && e.phase === "play" && (x === c || e.suspects.includes(x)) && !(G.player.drink && x.drink && (x.drink.state === "want" || x.drink.state === "claimed")),
      prompt: () => ({ text: "Revisar a este cliente", sub: "¿Será el tramposo? Si te equivocás, se ofende" }), use: () => e.check(x) });
    c.lifeAct = act(c);
    G.toast("Un habitué te avisa: entró un tramposo con un aparatito. Cuando se siente, buscá al que gana raro entre los sospechosos (?).", "bad");
    e.hud = () => e.phase === "arrive" ? "Tramposo en el salón · todavía no se sentó" : `Tramposo: revisá a los sospechosos (?) · ya se llevó ${fmt(e.stolen)}`;
    // sospechosos: los jugadores más cercanos que no están metidos en otro evento
    const addSuspects = () => {
      for (const o of e.suspects) if (!alive(o) || o.state !== "play") { o.lifeAct = null; if (o.lifeTag === e) o.lifeTag = null; if (o.emo && o.emo.id === "question") clearEmote(o); }
      e.suspects = e.suspects.filter(o => alive(o) && o.state === "play");
      const need = L.cheater.suspects - e.suspects.length; if (need <= 0) return;
      const busy = o => o.lifeTag && o.lifeTag !== e && !o.lifeTag.done;
      const more = insideList(o => o !== c && o.state === "play" && !busy(o) && !e.suspects.includes(o) && !o.lifeAct && dist(o, c) < 9).sort((p, q) => dist(p, c) - dist(q, c)).slice(0, need);
      for (const o of more) { e.suspects.push(o); o.lifeTag = e; o.lifeAct = act(o); emote(o, "question", Infinity); }
    };
    e.check = x => {
      if (e.done) return;
      if (x === c) { e.catch("player"); return; }
      e.wrong++; G.Rep.change(L.cheater.wrongRep * pen()); addMood(x, -0.3); emote(x, "angry", 3);
      say(x, "¡¿Qué te pasa?! ¡Me voy de acá!", { forced: true, tone: "bad" });
      e.suspects = e.suspects.filter(s => s !== x); x.lifeAct = null; x.flags.waited = true; G.leaveCustomer(x);
      G.toast("No era él: el cliente se ofendió y se fue. Mirá bien antes de revisar.", "bad");
    };
    e.catch = how => {
      if (e.done) return;
      const refund = Math.round(e.stolen * (how === "player" ? L.cheater.refund : L.cheater.guardRefund));
      if (refund > 0) G.Economy.add("events", refund);
      const trick = c.table ? "contaba cartas con señas de un cómplice" : "tenía un imán escondido en la manga";
      emote(c, "sad", 3); escortOut(c, 1.6);
      if (how === "player") { G.Rank.add(L.cheater.xp); G.Rep.change(L.cheater.rep); finish(e, "ok", `¡Era él! ${trick[0].toUpperCase() + trick.slice(1)}. Recuperaste ${fmt(refund)}.`, "good"); }
      else finish(e, "guard", `Un guardia agarró al tramposo: ${trick}. Recuperaste ${fmt(refund)}.`, "good");
    };
    e.update = dt => {
      if (!alive(c) || GONE.has(c.state)) { if (e.phase === "play") finish(e, "fail", `El tramposo se fue con ${fmt(e.stolen)} de la casa.`, "bad"); else finish(e, "cut", "El tramposo se cansó de esperar lugar y se fue sin jugar."); return; }
      if (e.phase === "arrive") {
        e.arriveT = (e.arriveT || 0) + dt;
        if (c.state === "queue" && e.arriveT < 150) { c.timer = Math.max(c.timer, 3); c.retry = 0; } // acecha: agarra el primer lugar que se libera (hasta 150 s)
        if (c.state === "play") {
          e.phase = "play";
          emote(c, "question", Infinity); addSuspects();
          G.toast(`El tramposo ya está jugando. Acercate: su ${c.machine ? "máquina paga raro" : "mesa pierde plata"}. Revisalo con ${G.KEY}.`, "bad");
        }
        return;
      }
      if (c.state !== "play") return;
      e.left -= dt; e.drainT -= dt; e.glintT -= dt;
      e.susT = (e.susT || 0) - dt; if (e.susT <= 0) { e.susT = 2; addSuspects(); } // si se sienta gente cerca, también es sospechosa
      if (e.drainT <= 0) {
        e.drainT = L.cheater.drainEvery;
        const amt = Math.round(rnd(L.cheater.drain[0], L.cheater.drain[1]) * (1 + (S().rank - 1) * L.cheater.drainPerRank));
        if (c.machine) {
          const m = c.machine, take = Math.min(m.d.box, amt);
          m.d.box -= take; G.updateFill(m); G.refreshScreen(m);
          if (amt - take > 0) G.Economy.force("events", amt - take);
          if (G.near(m.slot.x, m.slot.z, 9)) { G.floatText(m.slot.x, 2.25, m.slot.z - 0.4, "-" + fmt(amt), "#ff6a5a"); if (!m.pending && !m.d.broken) m.api.setReels(["7", "7", "7"], true); }
        } else if (c.table) {
          const t = c.table; t.d.tray -= amt; S().today.st.tablesNet -= amt; G.addNet();
          if (G.near(t.center.x, t.center.z, 9)) G.floatText(c.x, 1.9, c.z, "-" + fmt(amt), "#ff6a5a");
        }
        e.stolen += amt;
      }
      if (e.glintT <= 0 && G.near(c.x, c.z, 6.5)) { e.glintT = 3.5; emote(c, "sparkle", 0.7); }
      else if (!c.emo) emote(c, "question", Infinity);
      for (const o of e.suspects) if (!o.emo) emote(o, "question", Infinity);
      if (e.guard && (!e.guard.lifeTask || e.guard.lifeTask.owner !== e)) e.guard = null;
      if (!e.guard && S().staff.sec > 0) {
        e.guardT -= dt;
        if (e.guardT <= 0) { e.guardT = 12; if (Math.random() < L.cheater.guardChance) { const g = pickStaff("sec", c.x, c.z, n => n.state !== "chase"); if (g) e.guard = sendStaff(g, { owner: e, target: c, speed: 3.2, reach: 1.3, onArrive: () => e.catch("guard") }); } }
      }
      if (e.left <= 0) { const s = e.stolen; G.leaveCustomer(c); finish(e, "fail", `El tramposo se fue tranquilo con ${fmt(s)} de la casa.`, "bad"); }
    };
    e.cleanup = () => {
      if (e.guard) clearTask(e.guard, e);
      for (const s of [c, ...e.suspects]) { if (s.lifeAct) s.lifeAct = null; if (s.emo && (s.emo.id === "question" || s.emo.id === "sparkle")) clearEmote(s); if (s.lifeTag === e) s.lifeTag = null; }
    };
    return e;
  },
};

// ---------- APAGÓN ----------
let outageEv = null;
const outage = () => outageEv && !outageEv.done ? outageEv : null;
function setDark(on) { for (const m of G.machines) if (!m.dead && !!m.dark !== on) { m.dark = on; if (m.api.setDark) m.api.setDark(on); } }
EV.outage = {
  name: "Apagón",
  can: () => S().rank >= 2 && G.machines.length >= L.outage.minMachines,
  need: () => G.machines.length >= 1,
  weight: () => 0.7 * (window.CasinoWorld ? window.CasinoWorld.outageMul() : 1), // world.js: tormenta
  start() {
    const e = { left: Infinity, dur: 0, tech: null, techT: L.outage.techDelay * dm().time, rep: 0 };
    outageEv = e; setDark(true); lights(true); panel.set(false);
    G.sfx("powerdown"); crowdKick(1.6, 3);
    for (const c of G.customers) if (free(c) && c.state === "play" && c.machine) { emote(c, "dark", 4); c.waitT = 0; }
    const sp = insideList(c => c.state === "play"); if (sp.length) say(pick(sp), pick(LINES.dark), { forced: true });
    G.toast(`¡Apagón! Saltó la térmica y las tragamonedas se apagaron. Andá al tablero eléctrico (fondo, a la izquierda) y mantené ${G.KEY}${S().staff.tech > 0 ? ", o esperá al técnico" : ""}.`, "bad");
    e.hud = () => `Apagón · subí la térmica en el tablero (fondo izq.) · ${mmss(e.dur / Math.max(1, S().speed))} sin luz`;
    e.fix = how => {
      if (e.done) return;
      G.sfx("powerup"); crowdKick(1.4, 2);
      const sp = insideList(c => c.state === "play"); if (sp.length) say(pick(sp), "¡Volvió la luz!", { forced: true });
      if (how === "player") { G.Rank.add(L.outage.xp); finish(e, "ok", "Subiste la térmica: volvió la luz y las máquinas arrancan otra vez.", "good"); }
      else finish(e, "guard", "El técnico subió la térmica: volvió la luz.", "good");
    };
    e.update = dt => {
      e.dur += dt;
      setDark(true); // máquinas compradas durante el apagón también quedan sin luz
      const d = L.outage.repPerHour * pen() * dt / HOUR; G.Rep.change(d); e.rep += d;
      for (const c of G.customers) if (free(c) && c.state === "play" && c.machine) { addMood(c, L.mood.outagePerSec * dt); if (!c.emo && Math.random() < dt / 5) emote(c, "dark", 2.5); }
      if (e.tech && (!e.tech.lifeTask || e.tech.lifeTask.owner !== e)) e.tech = null;
      if (!e.tech && S().staff.tech > 0) {
        e.techT -= dt;
        if (e.techT <= 0) { e.techT = 3; const n = pickStaff("tech", PANEL.x, PANEL.z); if (n) dropRepair(n); if (n) e.tech = sendStaff(n, { owner: e, x: PANEL.front.x, z: PANEL.front.z, speed: 3.2, reach: 0.5, onArrive: () => e.fix("tech") }); }
      }
    };
    e.cleanup = () => { if (e.tech) clearTask(e.tech, e); setDark(false); lights(false); panel.set(true); if (outageEv === e) outageEv = null; };
    return e;
  },
};

// ---------- CELEBRIDAD ----------
const CELEBS = [{ name: "Charly Brillo", what: "el cantante" }, { name: "La Tana Ferrari", what: "la actriz de la novela" }, { name: "Pipo Galarza", what: "el goleador" }, { name: "Miki Estrella", what: "la conductora de la tele" }];
EV.celebrity = {
  name: "Celebridad",
  can: () => S().rank >= L.celebrity.rank && S().rep >= L.celebrity.minRep && G.machines.length + G.tables.length >= 3,
  weight: () => 0.3 + S().rep / 120,
  start() {
    const who = pick(CELEBS);
    const c = G.spawnCustomer("highroller", false);
    c.rounds = 999; c.budget = Math.max(c.budget, 8000); c.lifeMood = 0;
    const e = { c, who, greeted: false, left: L.celebrity.greetSec * dm().time + 8, stay: L.celebrity.staySec, drank: false, queueT: 0 };
    grab(c, e, "celeb", "enter"); G.goTo(c, G.DOOR.x, G.DOOR.z + 0.3);
    c.lifeTag = e; addAcc(c, "shades"); emote(c, "star", Infinity);
    c.lifeAct = { active: () => !e.done && !e.greeted, prompt: () => ({ text: `Recibir a ${who.name}`, sub: `${who.what[0].toUpperCase() + who.what.slice(1)} · si se va contento, te hace famoso` }), use: () => e.greet(true) };
    G.sfx("vip", G.DOOR.x, G.DOOR.z);
    G.toast(`¡Viene ${who.name}, ${who.what}! Recibilo en la puerta (${G.KEY}) y que la pase bien: si se va contento, la reputación sube mucho.`, "good");
    const moodPct = () => Math.round(clamp(0.5 + (c.lifeMood || 0), 0, 1) * 100);
    e.hud = () => !e.greeted ? `${who.name} espera en la puerta` : `${who.name} · ánimo ${moodPct()}%${S().bar && !e.drank ? " · quiere un trago" : ""}`;
    e.greet = byPlayer => {
      if (e.done || e.greeted) return;
      e.greeted = byPlayer ? "ok" : "late";
      if (byPlayer) { addMood(c, 0.2); G.Rep.change(1); G.Rank.add(10); emote(c, "heart", 3); say(c, pick(LINES.celeb), { forced: true }); G.sfx("greet"); G.toast(`Recibiste a ${who.name}. Que no le falte nada: máquinas andando, piso limpio${S().bar ? " y un trago" : ""}.`, "good"); }
      else { addMood(c, -0.2); emote(c, "angry", 3); say(c, "¿Nadie me recibe? Qué falta de respeto.", { forced: true, tone: "bad" }); G.toast(`Nadie recibió a ${who.name}: entró ofendido.`, "bad"); }
      c.wantsDrink = !!S().bar; release(c);
    };
    e.onWin = () => addMood(c, 0.04);
    e.update = dt => {
      if (!e.greeted) { e.left -= dt; if (e.left <= 0) e.greet(false); return; }
      const end = !alive(c) || GONE.has(c.state);
      if (!end) {
        e.stay -= dt;
        if (c.flags.drinkOk && !e.drank) { e.drank = true; addMood(c, 0.2); emote(c, "heart", 2.5); }
        if (c.state === "queue") { addMood(c, -0.012 * dt); if (!c.lifePatience) { c.lifePatience = true; c.timer += CFG.patienceSec * 2; } }
        for (const m of G.machines) if (m.d.broken && Math.hypot(m.slot.x - c.x, m.slot.z - c.z) < 4.5) { addMood(c, -0.004 * dt); break; }
        for (const ms of messes) if (Math.hypot(ms.x - c.x, ms.z - c.z) < 3.5) { addMood(c, -0.004 * dt); break; }
        if (outage()) addMood(c, -0.01 * dt);
        if (active.some(x => x.id === "fight" || x.id === "drunk")) addMood(c, -0.004 * dt);
        G.setBar(c.person, clamp(0.5 + c.lifeMood, 0, 1));
        if (Math.random() < dt / 14) { if (c.lifeMood < -0.15) { emote(c, "angry", 2); say(c, pick(LINES.celebBad), { tone: "bad" }); } else if (c.lifeMood > 0.1) emote(c, "star", 2); }
        if (e.stay > 0) return;
        G.leaveCustomer(c);
      }
      const mood = clamp(0.5 + (c.lifeMood || 0), 0, 1);
      if (alive(c)) G.setBar(c.person, null);
      if (mood >= L.celebrity.okMood) {
        const cash = L.celebrity.cash + L.celebrity.cashPerRank * Math.max(0, S().rank - L.celebrity.rank);
        G.Rep.change(L.celebrity.rep); G.Rank.add(L.celebrity.xp); G.Economy.add("events", cash); G.sfx("cheer");
        finish(e, "ok", `${who.name} se fue feliz y subió fotos de tu casino: +${L.celebrity.rep} de reputación y ${fmt(cash)} de una marca que te vio.`, "good");
      } else { G.Rep.change(L.celebrity.failRep * pen()); finish(e, "fail", `${who.name} se fue decepcionado (${Math.round(mood * 100)}%) y lo contó en la tele.`, "bad"); }
    };
    e.actor = (c, lf, dt) => {
      if (lf.st === "enter") { if (G.stepAgent(c, dt, c.speed)) { lf.st = "wait"; G.faceTo(c, 0, 0); } return true; }
      c.person.api.idle(dt);
      return true;
    };
    e.cleanup = () => { if (alive(c)) { G.setBar(c.person, null); if (c.life && c.life.e === e) release(c); } if (c.lifeTag === e) c.lifeTag = null; };
    return e;
  },
};

// ---------- BANDEJA VOLCADA (enchastres) ----------
EV.mess = {
  name: "Bandeja volcada",
  can: () => messes.length + L.mess.eventCount <= L.mess.max,
  weight: () => 0.6,
  start() {
    const base = S().bar ? { x: 6, z: -6.4 } : (() => { const p = insideList(c => c.state === "play"); const c = p.length ? pick(p) : null; return c ? { x: c.x, z: c.z } : { x: 0, z: -3 }; })();
    const list = [];
    for (let i = 0; i < L.mess.eventCount; i++) { const m = addMess(base.x + rnd(-2.5, 2.5), base.z + rnd(-1.5, 1.5), i === 0 ? "glass" : "drink", i > 0); if (m) list.push(m); }
    if (!list.length) return null;
    const e = { list, left: L.mess.eventSec * dm().time };
    G.toast(`¡Se cayó una bandeja de tragos! Hay ${list.length} enchastres en el piso: limpialos (mantené ${G.KEY}) antes de que la gente se queje.`, "bad");
    const rest = () => list.filter(m => !m.cleaned).length;
    e.hud = () => `Enchastres por limpiar: ${rest()}`;
    e.update = dt => {
      e.left -= dt;
      if (!rest()) { G.Rep.change(L.mess.eventRep); G.Rank.add(L.mess.eventXp); finish(e, "ok", "Dejaste el piso impecable. La gente lo nota.", "good"); return; }
      if (e.left <= 0) { G.Rep.change(-1 * pen()); finish(e, "fail", "La gente se queja del piso sucio. Los enchastres siguen ahí, restando atractivo.", "bad"); }
    };
    return e;
  },
};

// =====================================================================
// QUEJAS Y CHARLA — los clientes comentan lo que ven
// =====================================================================
let scanT = 1.5;
function scan() {
  const s = S(), cs = G.customers;
  for (const c of cs) {
    if (!free(c)) continue;
    const said = c.lifeSaid || (c.lifeSaid = {});
    if (c.state === "queue" && c.timer < CFG.patienceSec * 0.5 && !said.wait) { said.wait = 1; emote(c, "wait", 3); addMood(c, -0.03); if (Math.random() < 0.7) say(c, pick(LINES.wait)); continue; }
    if (c.state === "play" && c.machine && !said.broken) {
      for (const m of G.machines) if (m !== c.machine && m.d.broken && Math.hypot(m.slot.x - c.x, m.slot.z - c.z) < 3.6) { said.broken = 1; emote(c, "broken", 3); addMood(c, -0.03); if (Math.random() < 0.6) say(c, pick(LINES.broken)); break; }
      if (said.broken) continue;
    }
    for (const ms of messes) {
      if (said["m" + ms.id] || Math.hypot(ms.x - c.x, ms.z - c.z) > 2.4) continue;
      said["m" + ms.id] = 1; emote(c, "dirty", 2.8); addMood(c, L.mood.mess); if (Math.random() < 0.45) say(c, pick(LINES.mess)); break;
    }
    if (!c.emo && Math.random() < 0.04) { if ((c.lifeMood || 0) <= -0.2) emote(c, "angry", 2); else if ((c.lifeMood || 0) >= 0.15) emote(c, "happy", 2); }
  }
  // charla de ambiente: alguien cerca del jugador comenta algo
  if (Math.random() < 0.22) {
    const near = cs.filter(c => free(c) && G.near(c.x, c.z, 11) && (c.state === "play" || c.state === "walk" || c.state === "queue"));
    if (near.length) {
      const c = pick(near);
      let pool = c.state === "play" ? LINES.chatPlay : LINES.chatWalk;
      if (G.attractiveness() > 140 && Math.random() < 0.35) pool = LINES.chatNice;
      else if (s.day >= D.RIVAL.opensDay && !s.rivalBought && Math.random() < 0.15) pool = LINES.chatRival;
      if (say(c, pick(pool)) && Math.random() < 0.35) emote(c, "note", 2);
    }
  }
}
let spillAcc = 0;
function randomSpills(dt) {
  const n = insideList(c => c.state === "play").length;
  if (n < 3) return;
  spillAcc += L.mess.randomPerHour * Math.min(1, n / 10) * dt / HOUR;
  if (Math.random() < spillAcc) {
    spillAcc = 0;
    const c = pick(insideList(c => c.state === "play"));
    if (c && addMess(c.x + rnd(-0.5, 0.5), c.z - 0.6, Math.random() < 0.8 ? "drink" : "glass")) say(c, "¡Uy! Se me cayó el trago.");
  }
}

// =====================================================================
// DIRECTOR — uno o dos eventos por día abierto, pesados por rango, reputación y calor
// =====================================================================
let sched = null, lastS = null, lastIds = [];
const dayRand = (day, k) => { const x = Math.sin(day * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
function plan() {
  const s = S();
  if (!s.life || s.life.day !== s.day) s.life = { day: s.day, fired: 0 };
  let count = 0;
  if (s.day >= L.firstDay) {
    count = L.perDay[s.difficulty] || 1;
    if (count < 2 && s.rank >= L.secondRank && dayRand(s.day, 1) < L.secondChance) count = 2;
    count += window.CasinoChallenge?.extraEvents?.() || 0; // modo Difícil sin préstamos: noches más movidas
  }
  const left = Math.max(0, count - s.life.fired), times = [];
  const from = Math.max(CFG.open + 1, s.minutes / 60 + 0.3), to = CFG.close - 2;
  for (let i = 0; i < left && from < to; i++) times.push((from + (to - from) * (i + Math.random() * 0.8) / left) * 60);
  sched = { day: s.day, s, times };
}
function pickEvent() {
  const s = S(), gentle = s.day <= L.firstDay;
  const ids = Object.keys(EV).filter(id => (!gentle || ["drunk", "birthday", "mess"].includes(id)) && EV[id].can() && !lastIds.includes(id));
  const list = ids.length ? ids : Object.keys(EV).filter(id => EV[id].can());
  let total = 0; const w = list.map(id => { const v = Math.max(0.05, EV[id].weight()); total += v; return v; });
  let r = Math.random() * total;
  for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) return list[i]; }
  return list[list.length - 1] || null;
}
function direct() {
  const s = S();
  if (!sched || sched.day !== s.day || sched.s !== s) plan();
  if (!G.isOpen || !sched.times.length || active.length || G.inspector && G.inspector.state !== "leave" && Math.random() < 0.5) return;
  if (s.minutes < sched.times[0]) return;
  if (s.minutes > CFG.close * 60 - 90) { sched.times.length = 0; return; }
  sched.times.shift(); s.life.fired++;
  const id = pickEvent();
  if (id && begin(id)) { lastIds.push(id); if (lastIds.length > 2) lastIds.shift(); }
}
function reset() {
  for (const e of active.slice()) { e.done = true; try { if (e.cleanup) e.cleanup(); } catch (err) { /* actores ya no están */ } }
  active = []; dayLog = []; clearMesses(); outageEv = null; setDark(false); lights(false); panel.set(true);
  for (const b of bubbles) { b.life = 0; b.c = null; b.sp.visible = false; }
  sched = null; crowdBoost = 1; crowdT = 0;
}

// =====================================================================
// CICLO
// =====================================================================
function update(dt) {
  const s = S(); if (!s) return;
  if (s !== lastS) { lastS = s; reset(); }
  bubbleCd -= dt;
  if (crowdT > 0) { crowdT -= dt; if (crowdT <= 0) crowdBoost = 1; }
  direct();
  for (const e of active.slice()) { if (e.done) continue; e.t += dt; e.update(dt); }
  for (const c of G.customers) {
    if (c.dead || !c.person) continue;
    if (c.anim) runAnim(c, dt);
    if (c.emo && c.emo.t !== Infinity) { c.emo.t -= dt; if (c.emo.t <= 0) clearEmote(c); }
  }
  if (G.isOpen) { scanT -= dt; if (scanT <= 0) { scanT = 1.3; scan(); } randomSpills(dt); }
}
let hudT = 0, clock = 0;
function frame(real) {
  const s = S(); if (!s) return;
  if (s !== lastS) { lastS = s; reset(); }
  clock += real;
  for (const c of G.customers) { const sp = c.person && c.person.lifeEmote; if (sp && sp.visible) sp.position.y = 2.45 + Math.sin(clock * 4 + c.x) * 0.04; }
  for (const b of bubbles) {
    if (b.life <= 0) continue;
    if (!G.ui.panel) b.life -= real;
    if (b.life <= 0 || !alive(b.c)) { b.life = 0; b.sp.visible = false; b.c = null; continue; }
    const g = b.c.person.group; b.sp.position.set(g.position.x, 2.95 + g.position.y, g.position.z); b.sp.material.opacity = clamp(b.life / 0.5, 0, 1);
  }
  for (const m of G.machines) if (m.lifeWobble > 0) { m.lifeWobble -= real; m.group.rotation.z = m.lifeWobble > 0 ? Math.sin(m.lifeWobble * 40) * 0.035 * m.lifeWobble : 0; }
  if (outage()) panel.ledMat.color.setHex(Math.floor(clock * 3) % 2 ? 0xff3a2a : 0x401010);
  hudT -= real; if (hudT <= 0) { hudT = 0.25; updateHud(); }
}
function onDespawn(c) {
  dropAcc(c); clearEmote(c);
  if (c.anim) { c.anim = null; if (c.person) c.person.group.position.y = 0; }
  for (const b of bubbles) if (b.c === c) { b.life = 0; b.c = null; b.sp.visible = false; }
}
function onEndDay(notes) {
  for (const e of active.slice()) {
    if (e.id === "outage") e.note = RESULT_TEXT.outage.fail;
    finish(e, e.id === "outage" ? "fail" : "cut");
  }
  for (const r of dayLog) {
    const t = r.note || (RESULT_TEXT[r.id] && RESULT_TEXT[r.id][r.result]);
    if (t) notes.push(`Noche: ${t}.`);
  }
  if (messes.length) notes.push(`La limpieza de la madrugada sacó ${messes.length} enchastre${messes.length > 1 ? "s" : ""} del piso.`);
  dayLog = []; clearMesses(); sched = null;
}

// =====================================================================
// HUD — una línea por evento activo, con el tiempo que queda
// =====================================================================
const css = document.createElement("style");
css.textContent = `#hLife { display: grid; gap: 2px; font-size: .84rem; line-height: 1.25; color: var(--ivory); border-left: 2px solid var(--chip); padding: 2px 0 2px 8px; animation: lifeIn .3s ease-out; }
#hLife b { color: #ff8a6a; } #hLife .p { color: var(--ivory-dim); font-family: var(--font-num); font-size: .76rem; }
@keyframes lifeIn { from { opacity: 0; transform: translateX(-6px); } }
@media (prefers-reduced-motion: reduce) { #hLife { animation: none; } }`;
document.head.appendChild(css);
const hudEl = document.createElement("div");
hudEl.id = "hLife"; hudEl.hidden = true; hudEl.setAttribute("aria-live", "polite");
{ const xp = document.querySelector("#hud .meter.xp"); if (xp) xp.insertAdjacentElement("afterend", hudEl); }
let lastHud = "";
function updateHud() {
  const sp = Math.max(1, S().speed || 1);
  const html = active.filter(e => !e.done).map(e => `<span><b>⚠</b> ${esc(e.hud())}${Number.isFinite(e.left) && e.left > 0 ? ` <span class="p">${mmss(e.left / sp)}</span>` : ""}</span>`).join("");
  if (html !== lastHud) { lastHud = html; hudEl.innerHTML = html; hudEl.hidden = !html; }
}

// =====================================================================
// API
// =====================================================================
window.CasinoLife = {
  update, frame, actor, staffTask, onSpin, onBet, onDespawn, onEndDay,
  satMod: c => c.lifeMood || 0,
  atrPenalty: () => messes.length * L.mess.atr,
  demandMul: () => { let k = 1; for (const e of active) { if (e.id === "celebrity" && e.greeted === "ok") k *= L.celebrity.demandMul; if (e.id === "outage") k *= 0.6; } return k; },
  get crowdBoost() { return crowdBoost; },
  trigger: id => !!begin(id), // world.js: un rayo puede cortar la luz (respeta las condiciones del evento)
  get outage() { return !!outage(); },
  debug: {
    events: Object.keys(EV),
    trigger(id, opts) { const e = begin(id, opts, true); return e ? { id: e.id, hud: e.hud() } : null; },
    get active() { return active.map(e => ({ id: e.id, hud: e.hud(), left: e.left, phase: e.phase, greeted: e.greeted, stolen: e.stolen, bother: e.bother })); },
    get log() { return dayLog.slice(); },
    get messes() { return messes.map(m => ({ id: m.id, x: m.x, z: m.z, kind: m.kind })); },
    get schedule() { return sched ? { day: sched.day, times: sched.times.slice() } : null; },
    get bubbles() { return bubbles.filter(b => b.life > 0).length; },
    get said() { return saidCount; },
    get outage() { return !!outage(); },
    ev: id => active.find(e => e.id === id) || null,
    expire(id) { const e = active.find(x => x.id === id); if (!e) return false; if (e.id === "outage") return false; if ("greeted" in e && e.greeted && e.id !== "cheater") { e.left = 0; e.stay = 0; } else e.left = 0; return true; },
    addMess, clean: id => { const m = messes.find(x => x.id === id); if (m) cleanMess(m, true); return !!m; },
    celebrate, kickHit, emote, say, anim, panel: PANEL, plan, reset,
  },
};
})();
