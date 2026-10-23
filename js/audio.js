/* Casino Dorado v3 · audio.js
 * Diseño de sonido 100% procedural con Web Audio (sin archivos): ambiente del salón, sonidos posicionales
 * de máquinas y mesas, efectos de interfaz y música lounge/jazz que cambia con la hora y se pone tensa
 * con el inspector o con el calor alto.
 * Se carga después de game.js. game.js manda eventos con sfx(ev, x, z, opts) -> window.casinoAudio.play.
 * El AudioContext se crea recién después de un gesto del usuario (botón "Abrir el casino").
 * Secciones: BASE · SÍNTESIS (muestras en buffers) · GRAFO · VOCES · EVENTOS · AMBIENTE · MÚSICA ·
 * AJUSTES Y MENÚ · CICLO · API.
 */
(() => {
"use strict";

// =====================================================================
// BASE
// =====================================================================
const dbg = window.casinoDebug;
if (!dbg) return; // game.js no arrancó
const AC = window.AudioContext || window.webkitAudioContext;
const SR = 22050, TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = arr => arr[(Math.random() * arr.length) | 0];
const noise = () => Math.random() * 2 - 1;
const mf = m => 440 * Math.pow(2, (m - 69) / 12);
const SETTINGS_KEY = "casino-dorado-sonido-v1";
const MAX_VOICES = 14;

const settings = { master: 0.8, music: 0.55, sfx: 0.85, muted: false };
try {
  const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
  if (raw && typeof raw === "object") {
    for (const k of ["master", "music", "sfx"]) if (typeof raw[k] === "number" && Number.isFinite(raw[k])) settings[k] = clamp(raw[k], 0, 1);
    settings.muted = !!raw.muted;
  }
} catch (e) { /* sin almacenamiento: valores por defecto */ }
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* nada */ } }

// contadores de depuración (casinoDebug.audio)
const stats = { counts: {}, played: {}, skipped: {}, music: {}, steps: 0, errors: [], renderMs: 0, rendered: 0, stolen: 0 };
const inc = (o, k) => { o[k] = (o[k] || 0) + 1; };

// =====================================================================
// SÍNTESIS — todo se renderiza una sola vez a Float32Array y se reutiliza
// =====================================================================
function norm(d, peak) {
  let m = 0; for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > m) m = a; }
  if (m > 1e-6) { const k = peak / m; for (let i = 0; i < d.length; i++) d[i] *= k; }
  const f = Math.min(64, d.length); for (let i = 0; i < f; i++) d[d.length - 1 - i] *= i / f; // sin click al final
  return d;
}
function mk(sec, fn, peak) { const d = new Float32Array(Math.max(1, Math.ceil(sec * SR))); fn(d); return norm(d, peak || 0.9); }
function filt(type, f, q) {
  let b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0, x1 = 0, x2 = 0, y1 = 0, y2 = 0; const Q = q || 0.707;
  const api = {
    set(f2) {
      const w = TAU * clamp(f2, 20, SR * 0.45) / SR, cs = Math.cos(w), al = Math.sin(w) / (2 * Q);
      let c0, c1, c2;
      if (type === "lp") { c0 = (1 - cs) / 2; c1 = 1 - cs; c2 = c0; }
      else if (type === "hp") { c0 = (1 + cs) / 2; c1 = -(1 + cs); c2 = c0; }
      else { c0 = al; c1 = 0; c2 = -al; }
      const a0 = 1 + al; b0 = c0 / a0; b1 = c1 / a0; b2 = c2 / a0; a1 = -2 * cs / a0; a2 = (1 - al) / a0; return api;
    },
    p(x) { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; },
  };
  return api.set(f);
}
function post(d, fl) { for (let i = 0; i < d.length; i++) d[i] = fl.p(d[i]); return d; }
// suma fn(t) en d desde t0 durante dur segundos
function each(d, t0, dur, fn) {
  const s = Math.max(0, Math.floor(t0 * SR)), e = Math.min(d.length, Math.floor((t0 + dur) * SR));
  for (let i = s; i < e; i++) d[i] += fn((i - s) / SR);
}
function parts(d, t0, f, list, amp) { // list: [razón, amplitud, decaimiento]
  let md = 0; for (const p of list) md = Math.max(md, p[2]);
  each(d, t0, md * 6.5, t => { let s = 0; for (const p of list) if (f * p[0] < SR * 0.45) s += p[1] * Math.sin(TAU * f * p[0] * t) * Math.exp(-t / p[2]); return amp * s * Math.min(1, t * SR / 12); });
}
const METAL = k => [[1, 1, k], [2.76, 0.55, k * 0.6], [5.4, 0.3, k * 0.35], [8.93, 0.15, k * 0.2]];
const BELL = k => [[0.5, 0.35, k * 1.4], [1, 1, k], [1.19, 0.4, k * 0.8], [1.56, 0.3, k * 0.6], [2, 0.45, k * 0.5], [2.51, 0.2, k * 0.35], [2.66, 0.18, k * 0.3], [3.01, 0.15, k * 0.25], [4.1, 0.08, k * 0.15]];
function burst(d, t0, dur, fl, amp, att, dec) {
  att = att || 0.001; dec = dec || dur / 3;
  each(d, t0, dur, t => { const e = t < att ? t / att : Math.exp(-(t - att) / dec); return amp * e * (fl ? fl.p(noise()) : noise()); });
}
function metal(d, t0, f, amp, dec) { parts(d, t0, f, METAL(dec), amp); burst(d, t0, 0.006, filt("hp", 3000), amp * 0.4); }
function bell(d, t0, f, amp, dec) { parts(d, t0, f, BELL(dec), amp); }
const SQ = [[1, 1], [3, 0.33], [5, 0.2], [7, 0.14]];
const SAW = [[1, 1], [2, 0.5], [3, 0.33], [4, 0.25], [5, 0.2], [6, 0.16], [7, 0.14], [8, 0.12]];
function tone(d, t0, f, dur, amp, o) {
  o = o || {}; const att = o.a || 0.005, rel = o.r || 0.04, harm = o.h || [[1, 1]];
  let ph = 0;
  each(d, t0, dur + rel, t => {
    const ff = o.f1 ? f + (o.f1 - f) * Math.min(1, t / dur) : f;
    ph += TAU * ff * (1 + (o.vib || 0) * Math.sin(TAU * 5.5 * t)) / SR;
    let s = 0; for (const h of harm) if (ff * h[0] < SR * 0.45) s += h[1] * Math.sin(ph * h[0]);
    const e = (t < att ? t / att : 1) * (o.dec ? Math.exp(-t / o.dec) : 1) * (t > dur ? Math.max(0, 1 - (t - dur) / rel) : 1);
    return amp * s * e;
  });
}
function brass(d, t0, f, dur, amp) {
  let ph = 0; const K = Math.min(10, Math.floor(SR * 0.45 / f));
  each(d, t0, dur + 0.12, t => {
    ph += TAU * f * (1 + 0.004 * Math.sin(TAU * 5 * t) * Math.min(1, t * 3)) / SR;
    const b = 0.45 + 0.4 * Math.min(1, t / 0.03) * Math.exp(-t / 0.5);
    let s = 0, w = 1; for (let k = 1; k <= K; k++) { s += w / k * Math.sin(ph * k); w *= b; }
    const e = Math.min(1, t / 0.03) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.12) : 0.85 + 0.15 * Math.exp(-t / 0.1));
    return amp * s * e;
  });
}
function pluck(d, t0, f, amp, dur, damp, bright) { // Karplus-Strong
  const N = Math.max(2, Math.round(SR / f)), buf = new Float32Array(N), lp = filt("lp", bright || 1800);
  for (let i = 0; i < N; i++) buf[i] = lp.p(noise());
  let k = 0;
  each(d, t0, dur, t => { const y = buf[k], nx = buf[(k + 1) % N]; buf[k] = damp * 0.5 * (y + nx); k = (k + 1) % N; return amp * y * Math.min(1, (dur - t) / 0.03); });
}
function ep(d, t0, f, amp, dur) { // piano eléctrico (FM)
  each(d, t0, dur, t => {
    const I = 1.6 * Math.exp(-t / 0.35) + 0.15;
    const c = Math.sin(TAU * f * t + I * Math.sin(TAU * f * t));
    const tine = 0.18 * Math.sin(TAU * f * 7.1 * t) * Math.exp(-t / 0.05);
    return amp * (c + tine) * Math.min(1, t / 0.004) * Math.exp(-t / 1.1) * (t > dur - 0.15 ? Math.max(0, (dur - t) / 0.15) : 1);
  });
}
function vibe(d, t0, f, amp, dur) {
  each(d, t0, dur, t => {
    const tr = 1 - 0.25 * (0.5 + 0.5 * Math.sin(TAU * 5 * t));
    return amp * tr * Math.min(1, t / 0.002) * (Math.sin(TAU * f * t) * Math.exp(-t / 1.2) + 0.25 * Math.sin(TAU * f * 4 * t) * Math.exp(-t / 0.25) + 0.08 * Math.sin(TAU * f * 10 * t) * Math.exp(-t / 0.06)) * (t > dur - 0.1 ? Math.max(0, (dur - t) / 0.1) : 1);
  });
}
function coins(d, t0, t1, n, amp) { for (let i = 0; i < n; i++) { const t = t0 + Math.pow(Math.random(), 1.3) * (t1 - t0); metal(d, t, rnd(2300, 4600), amp * rnd(0.35, 1), rnd(0.04, 0.12)); } }
function loopify(d, fade) { // mezcla la cola con el principio para un loop sin costura
  const f = Math.floor(fade * SR), n = d.length - f, out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = d[i];
  for (let i = 0; i < f; i++) { const k = i / f; out[i] = d[i] * k + d[n + i] * (1 - k); }
  return out;
}

// Definiciones de muestras. Cada una devuelve un Float32Array a SR.
const DEF = {
  click: () => mk(0.06, d => { tone(d, 0, 2200, 0.02, 1, { a: 0.001, dec: 0.01 }); burst(d, 0, 0.004, filt("hp", 4000), 0.6); }),
  buzz: () => mk(0.42, d => { tone(d, 0, 150, 0.16, 1, { h: SQ, r: 0.02 }); tone(d, 0.2, 112, 0.18, 1, { h: SQ, r: 0.03 }); post(d, filt("lp", 1600)); }),
  coin: () => mk(0.7, d => { metal(d, 0, 1800, 1, 0.22); metal(d, 0.07, 2400, 0.9, 0.32); }),
  collect: () => mk(0.95, d => { burst(d, 0, 0.02, filt("lp", 1200), 0.7); tone(d, 0, 140, 0.05, 0.6, { dec: 0.06 }); coins(d, 0.05, 0.7, 13, 0.6); }),
  safe: () => mk(1.25, d => {
    tone(d, 0, 90, 0.15, 1, { dec: 0.07 }); burst(d, 0, 0.08, filt("lp", 600), 0.8);
    for (const t of [0.18, 0.26, 0.34, 0.42]) { burst(d, t, 0.008, filt("hp", 2500), 0.5); metal(d, t, 1500, 0.2, 0.02); }
    metal(d, 0.6, 320, 1, 0.25); metal(d, 0.6, 517, 0.6, 0.18); tone(d, 0.6, 70, 0.2, 0.8, { dec: 0.1 }); coins(d, 0.7, 1.0, 5, 0.25);
  }),
  register: () => mk(1.5, d => {
    for (const t of [0, 0.09]) { burst(d, t, 0.03, filt("bp", 1800, 2), 0.7); tone(d, t, 400, 0.02, 0.4, { dec: 0.015 }); }
    burst(d, 0.2, 0.32, filt("bp", 900, 0.8), 0.3, 0.1, 0.15);
    parts(d, 0.25, 2600, [[1, 1, 0.6], [2.4, 0.4, 0.3], [3.9, 0.2, 0.15]], 0.8);
    tone(d, 0.5, 110, 0.06, 0.6, { dec: 0.05 }); burst(d, 0.5, 0.05, filt("lp", 500), 0.5);
  }),
  step_soft: () => mk(0.18, d => { burst(d, 0, 0.12, filt("lp", rnd(240, 360), 0.8), 1, 0.008, 0.03); tone(d, 0, rnd(62, 78), 0.04, 0.5, { dec: 0.03 }); }),
  step_hard: () => mk(0.18, d => { burst(d, 0, 0.1, filt("lp", 500, 0.8), 1, 0.004, 0.025); burst(d, 0.004, 0.02, filt("hp", 2000), 0.35); burst(d, 0, 0.04, filt("bp", rnd(700, 950), 2), 0.4); }),
  door: () => mk(1.4, d => {
    burst(d, 0, 0.7, filt("bp", 400, 0.7), 0.5, 0.25, 0.25);
    for (const [t, f] of [[0.05, 3100], [0.12, 3500], [0.2, 2900]]) metal(d, t, f, 0.35, 0.3);
    burst(d, 0.55, 0.01, filt("hp", 2000), 0.5); metal(d, 0.55, 1200, 0.3, 0.03);
  }),
  vipchime: () => mk(2.6, d => { const P = [[1, 1, 1], [2, 0.3, 0.5], [3, 0.1, 0.25], [4.2, 0.05, 0.1]]; [[0, 72], [0.25, 76], [0.5, 79], [0.8, 84]].forEach(([t, m], i) => parts(d, t, mf(m), P, i === 3 ? 0.6 : 1)); }),
  greet: () => mk(1.0, d => { const P = [[1, 1, 0.4], [2, 0.25, 0.2]]; parts(d, 0, 880, P, 1); parts(d, 0.12, 1175, P, 1); }),
  goal: () => mk(1.2, d => { const P = [[1, 1, 0.45], [2, 0.3, 0.2], [3, 0.1, 0.1]]; parts(d, 0, 1047, P, 1); parts(d, 0.1, 1568, P, 1); metal(d, 0.2, 4200, 0.2, 0.2); }),
  spin: () => mk(0.62, d => {
    tone(d, 0, 160, 0.03, 0.8, { dec: 0.04 }); burst(d, 0, 0.03, filt("lp", 900), 0.6);
    const lp = filt("lp", 700); let ph = 0;
    each(d, 0.03, 0.56, t => { ph += TAU * (95 + 55 * Math.min(1, t / 0.15)) / SR; const e = Math.min(1, t / 0.08) * Math.min(1, (0.56 - t) / 0.1); return 0.25 * e * lp.p(((ph / TAU) % 1) * 2 - 1); });
    const rate = rnd(26, 32); for (let t = 0.05; t < 0.56; t += 1 / rate) burst(d, t, 0.004, filt("hp", 3000), 0.3 * Math.min(1, (0.58 - t) / 0.15));
  }),
  stop: () => mk(0.4, d => { for (const t of [0, 0.1, 0.2]) { burst(d, t, 0.02, filt("bp", 1500, 3), 0.8); tone(d, t, 300, 0.02, 0.5, { dec: 0.02 }); } }),
  win: () => mk(1.15, d => { [72, 76, 79, 84, 79, 84].forEach((m, i) => tone(d, i * 0.08, mf(m), 0.07, 0.5, { h: SQ, r: 0.02 })); coins(d, 0.4, 1.0, 6, 0.4); }),
  bigwin: () => mk(2.3, d => {
    [72, 76, 79, 84, 88, 91, 96].forEach((m, i) => tone(d, i * 0.07, mf(m), 0.07, 0.45, { h: SQ, r: 0.02 }));
    for (let i = 0; i < 8; i++) tone(d, 0.5 + i * 0.08, mf(i % 2 ? 96 : 91), 0.07, 0.4, { h: SQ, r: 0.02 });
    coins(d, 0.3, 2.1, 30, 0.5);
  }),
  jackpot: () => mk(3.7, d => {
    [[0, 67, 0.1], [0.14, 67, 0.1], [0.28, 67, 0.1], [0.42, 72, 0.5]].forEach(([t, m, l]) => { brass(d, t, mf(m), l, 0.5); brass(d, t, mf(m - 12), l, 0.3); });
    for (const m of [60, 64, 67, 72]) brass(d, 1.0, mf(m), 1.5, 0.3);
    for (let i = 0; i < 16; i++) tone(d, 1.0 + i * 0.07, mf([84, 88, 91, 96][i % 4]), 0.06, 0.18, { h: SQ, r: 0.02 });
    for (let i = 0; i < 8; i++) bell(d, rnd(1.0, 3.0), rnd(1500, 3000), 0.15, 0.4);
    coins(d, 0.5, 3.4, 70, 0.45);
  }),
  chips: () => mk(0.4, d => { const n = rndi(4, 8); for (let i = 0; i < n; i++) { const t = Math.random() * 0.28; burst(d, t, 0.02, filt("bp", rnd(2500, 4500), 6), rnd(0.4, 1)); tone(d, t, rnd(1800, 2600), 0.01, 0.2, { a: 0.001, dec: 0.008 }); } }),
  deal: () => mk(0.9, d => { for (const t of [0, 0.2, 0.4, 0.6]) { burst(d, t, 0.06, filt("bp", 3000, 0.7), 0.7, 0.005, 0.025); burst(d, t + 0.05, 0.01, filt("lp", 2500), 0.4); } }),
  shuffle: () => mk(0.95, d => {
    for (let i = 0; i < 60; i++) { const t = 0.05 + 0.65 * Math.pow(i / 60, 0.8); burst(d, t, 0.004, filt("bp", rnd(2500, 4000), 2), 0.3 + 0.5 * Math.sin(Math.PI * i / 60)); }
    burst(d, 0.7, 0.22, filt("bp", 2000, 0.9), 0.4, 0.1, 0.08);
  }),
  roulette: () => mk(4.9, d => {
    const bp = filt("bp", 2200, 3), lp = filt("lp", 200); let ph = 0;
    each(d, 0, 3.6, t => {
      const k = t / 3.6; bp.set(2200 - 1300 * k); ph += TAU * (9 - 6 * k) / SR;
      const flutter = 0.6 + 0.4 * Math.sin(ph);
      return (0.5 * (1 - 0.4 * k) * flutter * bp.p(noise()) + 0.2 * lp.p(noise())) * Math.min(1, t / 0.2);
    });
    [3.6, 3.78, 3.92, 4.03, 4.12, 4.19, 4.25].forEach((t, i) => { metal(d, t, rnd(2000, 3000), 0.5 * (1 - i * 0.1), 0.02); burst(d, t, 0.01, filt("bp", 2500, 2), 0.4); });
    metal(d, 4.45, 2300, 0.3, 0.03); burst(d, 4.45, 0.3, filt("bp", 1500, 1), 0.2, 0.02, 0.1);
  }),
  alarm: () => mk(1.3, d => { for (let i = 0; i < 8; i++) tone(d, i * 0.15, i % 2 ? 784 : 1046, 0.14, 0.5, { h: SQ, a: 0.005, r: 0.01 }); post(d, filt("bp", 1500, 0.7)); }),
  stinger: () => mk(2.3, d => {
    for (const t of [0, 0.25]) { brass(d, t, mf(50), 0.18, 0.5); brass(d, t, mf(38), 0.18, 0.4); }
    brass(d, 0.55, mf(51), 1.2, 0.5); brass(d, 0.55, mf(39), 1.2, 0.45); brass(d, 0.55, mf(45), 1.2, 0.25);
    tone(d, 0.55, 73, 0.6, 0.9, { dec: 0.5 }); burst(d, 0.55, 0.3, filt("lp", 300), 0.5, 0.002, 0.08);
    tone(d, 0.7, mf(74), 1.4, 0.08, { h: SAW, a: 0.5, r: 0.3 }); tone(d, 0.7, mf(75), 1.4, 0.08, { h: SAW, a: 0.5, r: 0.3 });
  }),
  fanfare: () => mk(2.9, d => {
    [[0, 60], [0.12, 64], [0.24, 67]].forEach(([t, m]) => brass(d, t, mf(m), 0.1, 0.5));
    for (const m of [60, 64, 67, 72]) brass(d, 0.38, mf(m), 1.5, 0.35);
    for (let i = 0; i < 6; i++) bell(d, rnd(0.4, 1.8), rnd(1800, 3200), 0.12, 0.35);
    burst(d, 0.38, 1.5, filt("hp", 5000), 0.25, 0.3, 0.6);
  }),
  bell_open: () => mk(3.2, d => { bell(d, 0, 660, 0.9, 0.9); bell(d, 0.35, 660, 0.8, 0.9); bell(d, 0.7, 660, 1, 1.4); }),
  bell_close: () => mk(3.6, d => { bell(d, 0, 392, 1, 1.6); bell(d, 1.0, 330, 1, 1.8); }),
  breakm: () => mk(1.1, d => {
    tone(d, 0, 120, 0.06, 0.9, { dec: 0.08 }); burst(d, 0, 0.06, filt("lp", 800), 0.7);
    for (let i = 0; i < 25; i++) burst(d, rnd(0.05, 0.5), 0.006, filt("hp", 4000), rnd(0.2, 0.6));
    tone(d, 0.1, 900, 0.7, 0.3, { h: SQ, f1: 80 });
  }),
  repair: () => mk(0.95, d => { for (let i = 0; i < 6; i++) { const t = i * 0.06; burst(d, t, 0.008, filt("hp", 2500), 0.5); metal(d, t, 1800, 0.2, 0.01); } tone(d, 0.4, 200, 0.35, 0.25, { h: SQ, f1: 1200 }); metal(d, 0.78, 2600, 0.5, 0.15); }),
  caught: () => mk(1.0, d => { tone(d, 0, 80, 0.1, 1, { dec: 0.1 }); burst(d, 0, 0.06, filt("lp", 400), 0.7); [67, 71, 74, 79].forEach((m, i) => tone(d, 0.1 + i * 0.07, mf(m), 0.09, 0.45, { h: SQ, r: 0.03 })); }),
  clink: () => mk(0.8, d => { metal(d, 0, 3400, 0.8, 0.12); metal(d, 0.06, 4100, 0.5, 0.1); for (let i = 0; i < 3; i++) burst(d, 0.1 + i * 0.05, 0.01, filt("bp", 5000, 3), 0.25); }),
  attract: () => mk(1.4, d => { const pent = [0, 2, 4, 7, 9]; const n = rndi(6, 8); for (let i = 0; i < n; i++) tone(d, i * 0.1, mf(84 + pick(pent) + (Math.random() < 0.3 ? 12 : 0)), 0.08, 0.5, { h: SQ, r: 0.02 }); }),
  // música
  bass: () => mk(1.4, d => { pluck(d, 0, mf(38), 1, 1.4, 0.997, 900); tone(d, 0, mf(38), 0.08, 0.5, { dec: 0.05 }); post(d, filt("lp", 1200)); }),
  ep48: () => mk(2.4, d => ep(d, 0, mf(48), 1, 2.4)),
  ep60: () => mk(2.4, d => ep(d, 0, mf(60), 1, 2.4)),
  ep72: () => mk(2.2, d => ep(d, 0, mf(72), 1, 2.2)),
  vibes: () => mk(2.2, d => vibe(d, 0, mf(72), 1, 2.2)),
  swish: () => mk(0.5, d => burst(d, 0, 0.5, filt("bp", 5000, 0.6), 0.5, 0.12, 0.15)),
  tap: () => mk(0.25, d => { burst(d, 0, 0.25, filt("bp", 2500, 0.5), 1, 0.002, 0.05); burst(d, 0, 0.2, filt("hp", 6000), 0.3, 0.02, 0.06); }),
  ride: () => mk(1.3, d => { parts(d, 0, 620, [[1, 0.3, 0.6], [2.32, 0.3, 0.5], [3.17, 0.25, 0.45], [4.83, 0.2, 0.4], [6.3, 0.15, 0.35]], 1); burst(d, 0, 1.2, filt("hp", 7000), 0.35, 0.001, 0.3); }),
  kick: () => mk(0.35, d => { tone(d, 0, 62, 0.3, 1, { f1: 42, dec: 0.12, a: 0.002 }); burst(d, 0, 0.02, filt("lp", 200), 0.5); }),
  hat: () => mk(0.08, d => burst(d, 0, 0.08, filt("hp", 7000), 1, 0.001, 0.015)),
  rim: () => mk(0.1, d => { tone(d, 0, 1700, 0.02, 0.8, { dec: 0.01, a: 0.001 }); burst(d, 0, 0.01, filt("bp", 3000, 2), 0.6); }),
  pad: () => mk(4.0, d => { tone(d, 0, mf(50), 3.2, 0.5, { h: SAW, a: 0.8, r: 0.8 }); tone(d, 0, mf(50) * 1.004, 3.2, 0.5, { h: SAW, a: 0.8, r: 0.8 }); post(d, filt("lp", 1400)); }),
  timp: () => mk(1.5, d => { tone(d, 0, 73, 1.2, 1, { dec: 0.5, a: 0.003 }); tone(d, 0, 110, 0.8, 0.4, { dec: 0.3, a: 0.003 }); burst(d, 0, 0.05, filt("lp", 300), 0.6); }),
  // gente (life.js): festejo, aplausos, queja, patada a la máquina, piñas, corte de luz, vaso que se cae, cornetita
  cheer: () => mk(1.6, d => {
    for (let v = 0; v < 7; v++) { // voces que suben: "¡eeeh!"
      const f1 = filt("bp", rnd(600, 900), 4), f2 = filt("bp", rnd(1500, 2200), 5), t0 = rnd(0, 0.18), dur = rnd(0.7, 1.2), base = rnd(160, 320); let ph = 0;
      each(d, t0, dur, t => { const k = t / dur; ph += base * (1 + 0.35 * Math.min(1, k * 3) - 0.15 * k) / SR; const src = ((ph % 1) * 2 - 1) * 0.7 + noise() * 0.2; return 0.6 * Math.sin(Math.PI * Math.min(1, k * 1.15)) * (f1.p(src) + 0.7 * f2.p(src)); });
    }
    burst(d, 0.05, 1.3, filt("bp", 1800, 0.6), 0.25, 0.15, 0.5);
  }),
  clap: () => mk(1.8, d => { for (let i = 0; i < 42; i++) { const t = Math.random() * 1.5; burst(d, t, 0.03, filt("bp", rnd(900, 2200), 1.5), rnd(0.3, 0.8) * (1 - t / 1.8), 0.001, 0.008); } }),
  grumble: () => mk(0.75, d => {
    const f1 = filt("bp", 520, 5), f2 = filt("bp", 900, 6); let ph = 0;
    each(d, 0, 0.65, t => { const k = t / 0.65; ph += (125 - 35 * k) / SR; const src = ((ph % 1) * 2 - 1) * 0.7 + noise() * 0.12; return Math.sin(Math.PI * k) * (f1.p(src) + 0.5 * f2.p(src)); });
  }),
  // tienda (shop.js): bocina del camión y cinta de embalar al abrir una caja
  horn: () => mk(0.9, d => { for (const t of [0, 0.32]) { tone(d, t, 330, 0.22, 0.5, { h: SAW, a: 0.01, r: 0.05 }); tone(d, t, 415, 0.22, 0.4, { h: SAW, a: 0.01, r: 0.05 }); } post(d, filt("lp", 2200)); }),
  tape: () => mk(0.55, d => { burst(d, 0, 0.42, filt("bp", 2600, 1.2), 0.8, 0.01, 0.3); for (let i = 0; i < 14; i++) burst(d, i * 0.028, 0.006, filt("hp", 3000), 0.5); }),
  thud: () => mk(0.7, d => { tone(d, 0, 75, 0.2, 1, { f1: 45, dec: 0.09, a: 0.002 }); burst(d, 0, 0.05, filt("lp", 500), 0.8); metal(d, 0.01, 420, 0.35, 0.12); metal(d, 0.03, 1250, 0.2, 0.08); }),
  punch: () => mk(0.3, d => { tone(d, 0, 95, 0.08, 1, { f1: 55, dec: 0.05, a: 0.001 }); burst(d, 0, 0.04, filt("bp", 900, 1), 0.9, 0.001, 0.015); burst(d, 0.005, 0.02, filt("hp", 2500), 0.4); }),
  // combate (combat.js): disparo y golpe al aire
  shot: () => mk(0.7, d => { burst(d, 0, 0.18, filt("lp", 4200), 1, 0.001, 0.09); tone(d, 0, 150, 0.12, 1, { f1: 45, dec: 0.07, a: 0.001 }); burst(d, 0.02, 0.35, filt("bp", 700, 0.6), 0.45, 0.004, 0.2); }),
  swing: () => mk(0.3, d => { burst(d, 0, 0.2, filt("bp", 1400, 0.8), 0.55, 0.06, 0.12); }),
  powerdown: () => mk(1.6, d => { burst(d, 0, 0.05, filt("lp", 700), 1); metal(d, 0, 300, 0.5, 0.05); tone(d, 0.02, 120, 1.4, 0.6, { f1: 30, h: SAW, r: 0.1 }); post(d, filt("lp", 900)); }),
  powerup: () => mk(1.3, d => { burst(d, 0, 0.04, filt("lp", 800), 1); metal(d, 0, 260, 0.5, 0.05); tone(d, 0.08, 40, 1.0, 0.5, { f1: 120, h: SAW, a: 0.2, r: 0.15 }); post(d, filt("lp", 1100)); }),
  spill: () => mk(0.9, d => { metal(d, 0, 3200, 0.6, 0.08); metal(d, 0.03, 4300, 0.4, 0.06); for (let i = 0; i < 10; i++) burst(d, 0.05 + Math.random() * 0.15, 0.01, filt("hp", 5000), rnd(0.2, 0.5)); burst(d, 0.08, 0.5, filt("bp", 1200, 0.7), 0.5, 0.01, 0.15); }),
  party: () => mk(0.9, d => { tone(d, 0, 420, 0.65, 0.5, { f1: 560, h: SAW, a: 0.03, r: 0.08, vib: 0.03 }); burst(d, 0, 0.7, filt("bp", 1500, 1), 0.15, 0.03, 0.3); post(d, filt("lp", 3000)); }),
  // ambiente: murmullo de gente (voces sintéticas con formantes) y zumbido del salón
  murmur: () => {
    const sec = 6, fade = 0.6, n = Math.ceil((sec + fade) * SR), d = new Float32Array(n);
    const VOW = [[800, 1200], [500, 1900], [300, 2300], [500, 900], [350, 800]];
    for (let v = 0; v < 9; v++) {
      const f1 = filt("bp", 500, 4), f2 = filt("bp", 1500, 5);
      let ph = 0, t = rnd(0, 0.4), base = rnd(95, 230);
      while (t < sec + fade) {
        const syl = rnd(0.09, 0.24), vw = pick(VOW), f0 = base * rnd(0.9, 1.15); f1.set(vw[0]); f2.set(vw[1]);
        const s = Math.floor(t * SR), e = Math.min(n, Math.floor((t + syl) * SR)), amp = rnd(0.4, 1);
        for (let i = s; i < e; i++) { const k = (i - s) / (e - s); ph += f0 * (1 + 0.04 * Math.sin(TAU * 3 * k)) / SR; const src = ((ph % 1) * 2 - 1) * 0.6 + noise() * 0.15; d[i] += amp * Math.sin(Math.PI * k) * (f1.p(src) + 0.6 * f2.p(src)); }
        t += syl + (Math.random() < 0.25 ? rnd(0.15, 0.6) : rnd(0.01, 0.05));
      }
    }
    post(d, filt("lp", 2600));
    return norm(loopify(d, fade), 0.8);
  },
  // lluvia (world.js): ruido rosado filtrado con gotas sueltas; trueno: estruendo grave que rueda
  rain: () => {
    const sec = 5, fade = 0.6, n = Math.ceil((sec + fade) * SR), d = new Float32Array(n), lp = filt("lp", 2600), hp = filt("hp", 300), dr = filt("bp", 3800, 3);
    let b = 0; for (let i = 0; i < n; i++) { b = b * 0.92 + noise() * 0.3; d[i] = hp.p(lp.p(b)) * 1.4 + (Math.random() < 0.0016 ? dr.p(noise()) * 6 : dr.p(0) * 0.6); }
    return norm(loopify(d, fade), 0.7);
  },
  thunder: () => mk(4.2, d => { burst(d, 0, 0.06, filt("lp", 2200), 0.8, 0.002, 0.03); burst(d, 0.04, 4.0, filt("lp", 160), 1, 0.25, 1.1); burst(d, 0.6, 2.4, filt("lp", 90), 0.7, 0.4, 0.8); post(d, filt("lp", 900)); }),
  room: () => {
    const sec = 4, fade = 0.5, n = Math.ceil((sec + fade) * SR), d = new Float32Array(n), lp = filt("lp", 180);
    let b = 0; for (let i = 0; i < n; i++) { b = b * 0.985 + noise() * 0.1; const t = i / SR; d[i] = lp.p(b) * 2 + 0.05 * Math.sin(TAU * 50 * t) + 0.025 * Math.sin(TAU * 100 * t); }
    return norm(loopify(d, fade), 0.6);
  },
};
const VARIANTS = { step_soft: 4, step_hard: 4, spin: 2, chips: 3, attract: 3 };

// =====================================================================
// GRAFO
// =====================================================================
let ctx = null, ready = false;
const N = {}; // nodos persistentes
const cache = new Map();
function toBuffer(data) {
  const b = ctx.createBuffer(1, data.length, SR);
  if (b.copyToChannel) b.copyToChannel(data, 0); else b.getChannelData(0).set(data);
  return b;
}
function sample(name) { // buffer cacheado (se renderiza la primera vez)
  let b = cache.get(name); if (b) return b;
  const fn = DEF[baseName(name)];
  if (!fn) throw new Error("muestra desconocida " + name);
  const t0 = performance.now();
  b = toBuffer(fn()); cache.set(name, b);
  stats.renderMs += performance.now() - t0; stats.rendered++;
  return b;
}
const baseName = n => DEF[n] ? n : n.replace(/\d+$/, "");
const variantOf = base => VARIANTS[base] ? base + ((Math.random() * VARIANTS[base]) | 0) : base;
function makeIR() {
  const len = Math.floor(ctx.sampleRate * 1.1), ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch); let lp = 0;
    for (let i = 0; i < len; i++) { const t = i / ctx.sampleRate, k = 0.25 + 0.7 * Math.exp(-t * 3); lp += (noise() - lp) * k; d[i] = lp * Math.exp(-t * 4.2) * (t < 0.008 ? t / 0.008 : 1); }
    for (const [t, a] of [[0.011, 0.5], [0.019 + ch * 0.004, 0.35], [0.031, 0.25]]) d[Math.floor(t * ctx.sampleRate)] += a;
  }
  return ir;
}
function buildGraph() {
  const g = v => { const n = ctx.createGain(); n.gain.value = v; return n; };
  N.comp = ctx.createDynamicsCompressor();
  N.comp.threshold.value = -14; N.comp.knee.value = 10; N.comp.ratio.value = 4; N.comp.attack.value = 0.005; N.comp.release.value = 0.2;
  N.master = g(0); N.master.connect(N.comp); N.comp.connect(ctx.destination);
  N.music = g(settings.music); N.duck = g(1); N.musicIn = g(0.55);
  N.musicIn.connect(N.duck); N.duck.connect(N.music); N.music.connect(N.master);
  N.tense = g(0); N.tense.connect(N.musicIn); // capa de pad de la variante tensa
  N.sfx = g(settings.sfx); N.sfx.connect(N.master);
  N.near = g(1); N.near.connect(N.sfx);
  N.farLp = ctx.createBiquadFilter(); N.farLp.type = "lowpass"; N.farLp.frequency.value = 1700;
  N.far = g(1); N.far.connect(N.farLp); N.farLp.connect(N.sfx);
  N.ui = g(1); N.ui.connect(N.sfx);
  N.ambLp = ctx.createBiquadFilter(); N.ambLp.type = "lowpass"; N.ambLp.frequency.value = 6000;
  N.amb = g(1); N.amb.connect(N.ambLp); N.ambLp.connect(N.sfx);
  N.verb = ctx.createConvolver(); N.verb.buffer = makeIR();
  N.verbOut = g(0.28); N.verb.connect(N.verbOut); N.verbOut.connect(N.master);
  N.sendNear = g(0.35); N.near.connect(N.sendNear); N.sendNear.connect(N.verb);
  N.sendFar = g(0.6); N.farLp.connect(N.sendFar); N.sendFar.connect(N.verb);
  N.sendMusic = g(0.12); N.musicIn.connect(N.sendMusic); N.sendMusic.connect(N.verb);
  N.sendUi = g(0.15); N.ui.connect(N.sendUi); N.sendUi.connect(N.verb);
  N.crowdA = g(0); N.crowdB = g(0); N.roomG = g(0);
  for (const c of [N.crowdA, N.crowdB, N.roomG]) c.connect(N.amb);
  N.rainLp = ctx.createBiquadFilter(); N.rainLp.type = "lowpass"; N.rainLp.frequency.value = 5000; // lluvia (world.js): apagada adentro
  N.rainG = g(0); N.rainG.connect(N.rainLp); N.rainLp.connect(N.sfx);
  // canales de voz reutilizables (ganancia + paneo); solo la fuente se crea en cada disparo
  N.voices = [];
  for (let i = 0; i < MAX_VOICES; i++) {
    const gain = g(0), pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) gain.connect(pan);
    N.voices.push({ gain, pan, out: pan || gain, until: 0, src: null, pri: 0, bus: null });
  }
  applyVolumes(true);
}
function applyVolumes(now) {
  if (!ctx) return;
  const t = ctx.currentTime, k = now ? 0.005 : 0.05;
  N.master.gain.setTargetAtTime(settings.muted ? 0 : settings.master, t, k);
  N.music.gain.setTargetAtTime(settings.music, t, k);
  N.sfx.gain.setTargetAtTime(settings.sfx, t, k);
}
function wantRunning() { return ready && !settings.muted && !document.hidden; }
function syncRunning() {
  if (!ctx) return;
  try {
    if (wantRunning()) { if (ctx.state === "suspended") ctx.resume().catch(() => {}); }
    else if (ctx.state === "running") ctx.suspend().catch(() => {});
  } catch (e) { /* nada */ }
}

// =====================================================================
// VOCES — tope de voces simultáneas, robo por prioridad
// =====================================================================
function voice(buf, o) {
  const now = ctx.currentTime, pri = o.pri || 0;
  let v = null, oldest = null;
  for (const c of N.voices) { if (c.until <= now) { v = c; break; } if (c.pri <= pri && (!oldest || c.until < oldest.until)) oldest = c; }
  if (!v) { if (!oldest || pri < 1) return false; v = oldest; stats.stolen++; try { v.src.stop(); } catch (e) { /* ya terminó */ } }
  const src = ctx.createBufferSource(); src.buffer = buf;
  const rate = o.rate || 1; src.playbackRate.value = rate;
  const when = now + (o.delay || 0);
  v.gain.gain.cancelScheduledValues(now); v.gain.gain.setValueAtTime(o.gain, now);
  if (v.pan) v.pan.pan.setValueAtTime(clamp(o.pan || 0, -1, 1), now);
  if (v.bus !== o.bus) { try { v.out.disconnect(); } catch (e) { /* */ } v.out.connect(o.bus); v.bus = o.bus; }
  src.connect(v.gain); src.start(when);
  v.src = src; v.pri = pri; v.until = when + buf.duration / rate + 0.02;
  return true;
}
function activeVoices() { if (!ctx) return 0; const now = ctx.currentTime; let n = 0; for (const c of N.voices) if (c.until > now) n++; return n; }
// posición respecto del jugador: ganancia por distancia, paneo estéreo, bus lejano con filtro
function spatial(x, z, maxD) {
  const P = dbg.player, dx = x - P.x, dz = z - P.z, d = Math.hypot(dx, dz);
  if (d > maxD) return null;
  const rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
  const pan = d < 0.3 ? 0 : clamp((dx * rx + dz * rz) / d, -1, 1) * Math.min(1, d / 1.5) * 0.85;
  const REF = 2.5;
  let g = REF / (REF + Math.max(0, d - REF)) * (1 - (d / maxD) * (d / maxD));
  let far = d > 9;
  if ((P.z < -10.15) !== (z < -10.15)) { g *= 0.35; far = true; } // una pared (la fachada) en el medio
  return { g, pan, far, d };
}

// =====================================================================
// EVENTOS — qué suena con cada cosa que pasa en el juego
// =====================================================================
// s: muestra · g: ganancia · max: distancia máxima (sin max = no posicional) · pri: prioridad · minG: piso audible
const EV = {
  coin: { s: "coin", g: 0.45 },
  register: { s: "register", g: 0.5, max: 16 },
  deposit: { s: "safe", g: 0.7, max: 16 },
  collect: { s: "collect", g: 0.65, max: 14 },
  spin: { s: "spin", g: 0.3, max: 15, rate: [0.95, 1.06] },
  stop: { s: "stop", g: 0.3, max: 13 },
  win: { s: "win", g: 0.42, max: 20, rate: [0.97, 1.03] },
  bigwin: { s: "bigwin", g: 0.55, max: 26, pri: 1 },
  jackpot: { s: "jackpot", g: 0.85, max: 70, pri: 2, minG: 0.35, duck: 3.5 },
  door: { s: "door", g: 0.35, max: 22 },
  vip: { s: "vipchime", g: 0.55, max: 80, pri: 1, minG: 0.4 },
  greet: { s: "greet", g: 0.45 },
  thief: { s: "alarm", g: 0.45, max: 40, pri: 2, minG: 0.22 },
  caught: { s: "caught", g: 0.55 },
  inspector: { s: "stinger", g: 0.8, pri: 2, duck: 2.6 },
  rankup: { s: "fanfare", g: 0.75, pri: 2, duck: 3 },
  goal: { s: "goal", g: 0.45, pri: 1 },
  open: { s: "bell_open", g: 0.6, pri: 1 },
  close: { s: "bell_close", g: 0.55, pri: 1 },
  error: { s: "buzz", g: 0.4, pri: 1 },
  alarm: { s: "alarm", g: 0.5, pri: 2 },
  click: { s: "click", g: 0.25 },
  tick: { s: "click", g: 0.2 },
  drink: { s: "clink", g: 0.45, max: 10 },
  break: { s: "breakm", g: 0.5, max: 22, pri: 1 },
  repair: { s: "repair", g: 0.42, max: 14 },
  chips: { s: "chips", g: 0.45, max: 16, rate: [0.9, 1.1] },
  deal: { s: "deal", g: 0.4, max: 14 },
  shuffle: { s: "shuffle", g: 0.4, max: 14 },
  roulette: { s: "roulette", g: 0.45, max: 18 },
  step: { s: "step_soft", g: 0.2 },
  amb_jingle: { s: "attract", g: 0.18, max: 32, rate: [0.95, 1.05] },
  cheer: { s: "cheer", g: 0.5, max: 30, pri: 1, rate: [0.95, 1.08] },
  clap: { s: "clap", g: 0.4, max: 24, rate: [0.95, 1.05] },
  grumble: { s: "grumble", g: 0.4, max: 14, rate: [0.85, 1.15] },
  thud: { s: "thud", g: 0.55, max: 18 },
  truck: { s: "horn", g: 0.5, max: 60 },
  box_pick: { s: "thud", g: 0.35, max: 10, rate: [1.2, 1.4] },
  box_drop: { s: "thud", g: 0.5, max: 14 },
  tape: { s: "tape", g: 0.45, max: 10 },
  restock: { s: "click", g: 0.3, max: 10, rate: [0.9, 1.2] },
  punch: { s: "punch", g: 0.5, max: 22, rate: [0.9, 1.15] },
  shot: { s: "shot", g: 0.55, max: 40, pri: 1, rate: [0.92, 1.08] },
  swing: { s: "swing", g: 0.4, max: 12, rate: [0.9, 1.15] },
  powerdown: { s: "powerdown", g: 0.75, pri: 2, duck: 2 },
  powerup: { s: "powerup", g: 0.65, pri: 2 },
  thunder: { s: "thunder", g: 0.8, pri: 2, duck: 1.5 },
  elevator: { s: "bell_open", g: 0.3, max: 18, rate: [1.5, 1.6] },
  spill: { s: "spill", g: 0.45, max: 16 },
  party: { s: "party", g: 0.45, max: 26, rate: [0.95, 1.1] },
  amb_chips: { s: "chips", g: 0.16, max: 30, rate: [0.85, 1.1] },
};
const lastSample = {};
function fire(ev, x, z, o) {
  const e = EV[ev]; if (!e) { inc(stats.skipped, ev); return false; }
  o = o || {};
  let gain = e.g * (o.gain || 1), pan = o.pan || 0, bus = N.ui;
  if (e.max && typeof x === "number" && typeof z === "number") {
    const sp = spatial(x, z, e.max);
    if (!sp) { if (!e.minG) { inc(stats.skipped, ev); return false; } gain *= e.minG; bus = N.far; pan = 0; }
    else { gain *= Math.max(sp.g, e.minG || 0); pan = sp.pan; bus = sp.far || o.far ? N.far : N.near; }
    if (gain < 0.008) { inc(stats.skipped, ev); return false; }
  }
  const name = variantOf(o.s || e.s);
  const rate = o.rate || (e.rate ? rnd(e.rate[0], e.rate[1]) : 1);
  const ok = voice(sample(name), { gain, pan, bus, rate, pri: e.pri || 0, delay: o.delay });
  if (!ok) { inc(stats.skipped, ev); return false; }
  lastSample[ev] = baseName(name); inc(stats.played, ev);
  if (e.duck) duckMusic(e.duck);
  return true;
}
function duckMusic(sec) {
  const t = ctx.currentTime, g = N.duck.gain;
  g.cancelScheduledValues(t); g.setTargetAtTime(0.25, t, 0.05); g.setTargetAtTime(1, t + sec, 0.6);
}
// punto de entrada desde game.js
function play(ev, x, z, o) {
  inc(stats.counts, ev);
  if (!ready || !ctx || ctx.state !== "running") { inc(stats.skipped, ev); return false; }
  try {
    if (ev === "round") return tableRound(x, z, o || {});
    if (ev === "deposit" && o && o.quiet) return fire(ev, x, z, { gain: 0.5 });
    return fire(ev, x, z, o);
  } catch (err) { stats.errors.push(String(err && err.message || err)); return false; }
}
function tableRound(x, z, o) {
  if (o.type === "ruleta") { const a = fire("roulette", x, z); fire("chips", x, z, { delay: 4.7 }); return a; }
  const a = fire(Math.random() < 0.2 ? "shuffle" : "deal", x, z);
  fire("chips", x, z, { delay: rnd(0.6, 1.1) });
  return a;
}

// =====================================================================
// AMBIENTE — murmullo según la gente adentro, jingles lejanos y fichas
// =====================================================================
const amb = { started: false, jingleT: 4, chipsT: 8, inside: 0, lastUpdate: 0 };
function loopSrc(name, dest, rate, offset) {
  const s = ctx.createBufferSource(); s.buffer = sample(name); s.loop = true; s.playbackRate.value = rate || 1;
  s.connect(dest); s.start(ctx.currentTime + 0.05, offset || 0); return s;
}
function startAmbience() {
  if (amb.started) return; amb.started = true;
  loopSrc("murmur", N.crowdA, 1, 0);
  const pB = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (pB) { pB.pan.value = 0.35; N.crowdB.disconnect(); N.crowdB.connect(pB); pB.connect(N.amb); }
  loopSrc("murmur", N.crowdB, 0.91, 2.7);
  loopSrc("room", N.roomG, 1, 0);
  try { loopSrc("rain", N.rainG, 1, 0); } catch (e) { stats.errors.push("rain: " + (e && e.message)); }
}
function insideCount() {
  let n = 0; for (const c of dbg.customers) if (!c.dead && c.z > -10 && c.state !== "leave" && c.state !== "flee" && c.state !== "caught") n++;
  return n;
}
function updateAmbience(dt) {
  if (!amb.started) return;
  const t = ctx.currentTime, S = dbg.state, P = dbg.player;
  const n = insideCount(); amb.inside = n;
  const boost = window.CasinoLife ? window.CasinoLife.crowdBoost : 1; // festejos y peleas suben el murmullo (life.js)
  const crowd = n === 0 ? 0 : Math.min(0.85, (0.12 + 0.45 * Math.min(1, n / 24)) * boost);
  const crowdB = n > 10 ? Math.min(0.35, (n - 10) / 20 * 0.35) : 0;
  const duck = dbg.panel ? 0.55 : 1;
  N.crowdA.gain.setTargetAtTime(crowd * duck, t, 0.8);
  N.crowdB.gain.setTargetAtTime(crowdB * duck, t, 0.8);
  N.roomG.gain.setTargetAtTime((dbg.started ? 0.09 : 0) * duck, t, 0.5);
  N.ambLp.frequency.setTargetAtTime(P.z < -10.15 ? 650 : 6500, t, 0.25);
  { const W = window.CasinoWorld, rl = W && dbg.started && S && !S.dayOver ? W.rainLevel() : 0, out = P.z < -10.15; amb.rain = rl; // lluvia: fuerte en la vereda, sorda adentro
    N.rainG.gain.setTargetAtTime(rl * (out ? 0.5 : 0.16) * duck, t, 0.6); N.rainLp.frequency.setTargetAtTime(out ? 6000 : 900, t, 0.3); }
  if (!dbg.started || dbg.panel || !S || S.dayOver) return;
  const machines = dbg.machines;
  if (dbg.isOpen && machines.length) {
    amb.jingleT -= dt;
    if (amb.jingleT <= 0) {
      let busy = 0; for (const m of machines) if (m.user) busy++;
      amb.jingleT = rnd(4, 10) / (1 + busy * 0.12);
      const m = pick(machines); if (!m.d.broken) fire("amb_jingle", m.slot.x, m.slot.z, { far: true });
    }
  }
  if (n > 2) {
    amb.chipsT -= dt;
    if (amb.chipsT <= 0) {
      amb.chipsT = rnd(5, 14) / (1 + n / 20);
      const tb = dbg.tables.length ? pick(dbg.tables).center : { x: rnd(-9, 9), z: rnd(-6, 8) };
      fire("amb_chips", tb.x + rnd(-1, 1), tb.z + rnd(-1, 1), { far: true });
    }
  }
}
// pasos del jugador: alfombra adentro, vereda afuera
const steps = { x: 0, z: 0, acc: 0, side: 1, init: false };
function updateSteps(dt) {
  const P = dbg.player;
  if (!steps.init) { steps.x = P.x; steps.z = P.z; steps.init = true; return; }
  const d = Math.hypot(P.x - steps.x, P.z - steps.z); steps.x = P.x; steps.z = P.z;
  if (!dbg.started || dbg.panel || d > 1.2 || dt <= 0) { if (d > 1.2) steps.acc = 0; return; }
  if (d < 1e-4) { steps.acc = Math.min(steps.acc, 0.3); return; }
  const speed = d / dt, stride = speed > 5 ? 0.95 : 0.7;
  steps.acc += d;
  if (steps.acc >= stride) {
    steps.acc -= stride; steps.side = -steps.side; stats.steps++;
    play("step", undefined, undefined, { s: P.z < -10.15 ? "step_hard" : "step_soft", pan: 0.12 * steps.side, gain: speed > 5 ? 1.25 : 1, rate: rnd(0.92, 1.08) });
  }
}

// =====================================================================
// MÚSICA — lounge/jazz procedural (acordes, bajo caminante, escobillas) y variante tensa
// =====================================================================
const QUAL = { maj7: [0, 4, 7, 11, 14], "6": [0, 4, 7, 9, 14], "7": [0, 4, 7, 10, 14], m7: [0, 3, 7, 10, 14], m6: [0, 3, 7, 9], mM7: [0, 3, 7, 11], "7b9": [0, 4, 7, 10, 13] };
const LOUNGE = [ // en Fa: 16 compases
  [5, "maj7"], [2, "7"], [7, "m7"], [0, "7"], [9, "m7"], [2, "7"], [[7, "m7"], [0, "7"]], [5, "6"],
  [10, "maj7"], [3, "7"], [9, "m7"], [2, "7"], [7, "m7"], [0, "7"], [5, "6"], [0, "7"],
];
const TENSE = [[2, "mM7"], [10, "7"], [7, "m6"], [9, "7b9"]]; // en Re menor
const music = { on: false, mode: "lounge", bpm: 96, nextT: 0, beat: 0, bar: 0, intensity: 0.4, tense: false, inspector: false, comp: null, padUntil: 0, timer: 0 };
function chordAt(prog, bar, beat) {
  const c = prog[bar % prog.length];
  if (Array.isArray(c[0])) return beat < 2 ? c[0] : c[1];
  return c;
}
function inst(name, midi, base) { return { name, rate: Math.pow(2, (midi - base) / 12) }; }
function epFor(midi) { const b = midi < 54 ? 48 : midi < 66 ? 60 : 72; return inst("ep" + b, midi, b); }
function note(name, when, rate, gain, dur, dest) {
  const src = ctx.createBufferSource(); src.buffer = sample(name); src.playbackRate.value = rate || 1;
  const g = ctx.createGain(); g.gain.value = gain;
  src.connect(g); g.connect(dest || N.musicIn); src.start(when);
  if (dur) { g.gain.setValueAtTime(gain, when + dur); g.gain.linearRampToValueAtTime(0, when + dur + 0.08); src.stop(when + dur + 0.1); }
  src.onended = () => { try { g.disconnect(); } catch (e) { /* */ } };
  inc(stats.music, baseName(name));
}
function bassNote(midi, when, gain, dur) { const i = inst("bass", midi, 38); note(i.name, when, i.rate, gain, dur); }
const rootBass = pc => 31 + ((pc - 7 + 12) % 12); // Sol1..Fa#2
function voicing(ch) { // acorde sin fundamental, entre Mi3 y Sol4
  const ts = QUAL[ch[1]].slice(1).map(iv => (ch[0] + iv) % 12);
  return ts.map(pc => { let m = 52 + ((pc - 4 + 12) % 12); return m; }).sort((a, b) => a - b);
}
// estado deseado según la hora, la gente, el inspector y el calor
function musicTarget() {
  const S = dbg.state; if (!S) return;
  const ins = dbg.inspector, inspector = !!(ins && ins.state !== "leave");
  music.inspector = inspector;
  music.tense = !S.dayOver && (inspector || S.heat >= 70);
  const h = S.minutes / 60, curve = { 10: 0.7, 11: 0.7, 12: 0.8, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1.1, 18: 1.3, 19: 1.4, 20: 1.4, 21: 1.2 }[Math.floor(h)] || 0.7;
  let it;
  if (S.dayOver || S.gameOver) it = 0.2;
  else if (dbg.isOpen) it = 0.45 + 0.35 * clamp((curve - 0.7) / 0.7, 0, 1) + 0.2 * Math.min(1, amb.inside / 15);
  else it = h < 10 ? 0.25 : 0.3;
  music.intensity = clamp(it, 0, 1);
}
function scheduleBeat(t) {
  const spb = 60 / music.bpm, b = music.beat, bar = music.bar;
  if (b === 0) { // al empezar cada compás se decide el modo
    musicTarget();
    const mode = music.tense ? "tense" : "lounge";
    if (mode !== music.mode) { music.mode = mode; music.bar = 0; music.bpm = mode === "tense" ? 116 : 96; inc(stats.music, "switch:" + mode); }
    music.comp = pick(music.intensity < 0.35 ? [[[0, 3.6]]] : [[[0, 1.4], [2.67, 0.9]], [[1.67, 0.8], [3.67, 0.6]], [[0, 0.6], [1.67, 1.2]], [[0.67, 1], [2.67, 1.1]]]);
  }
  if (music.mode === "tense") return tenseBeat(t, spb, b, music.bar);
  const I = music.intensity, sw = spb * 0.667;
  const ch = chordAt(LOUNGE, bar, b), next = chordAt(LOUNGE, b === 3 ? bar + 1 : bar, b === 3 ? 0 : b + 1);
  // bajo caminante
  const root = rootBass(ch[0]), q = QUAL[ch[1]];
  const split = Array.isArray(LOUNGE[bar % LOUNGE.length][0]);
  let bm;
  if (b === 0 || (split && b === 2)) bm = root;
  else if (b === 3 || (split && b === 1)) { const nr = rootBass(next[0]); bm = nr + (Math.random() < 0.5 ? -1 : 1); if (Math.random() < 0.3) bm = nr + 7 - 12 < 28 ? nr - 1 : nr + 7 - 12; }
  else bm = root + (b === 1 ? q[Math.random() < 0.5 ? 1 : 2] : pick([q[2], q[3], 12]));
  bm = clamp(bm, 28, 47);
  if (I >= 0.35 || b % 2 === 0) bassNote(bm, t, 0.55, I < 0.35 ? spb * 1.9 : spb * 0.95);
  if (I > 0.6 && Math.random() < 0.15) bassNote(bm + pick([-2, 2, 3]), t + sw, 0.3, spb * 0.3);
  // escobillas
  if (I >= 0.28) note("swish", t, rnd(0.95, 1.05), 0.16 + 0.1 * I);
  if (I >= 0.3 && (b === 1 || b === 3)) note("tap", t, 1, 0.28);
  if (I > 0.5 && (b === 0 || b === 2)) note("kick", t, 1, 0.22);
  if (I > 0.62) { note("ride", t, 1, b % 2 ? 0.12 : 0.17); if (b === 1 || b === 3) note("ride", t + sw, 1.02, 0.09); }
  // piano eléctrico
  for (const [pos, len] of music.comp) {
    if (pos < b || pos >= b + 1) continue;
    const at = t + (pos - b === 0.67 ? sw : (pos - b) * spb), c2 = chordAt(LOUNGE, bar, Math.floor(pos));
    const gain = (I < 0.35 ? 0.16 : 0.13) / 1.5;
    for (const m of voicing(c2)) { const e = epFor(m); note(e.name, at + rnd(0, 0.012), e.rate, gain, len * spb); }
  }
  // vibráfono (solo en la hora pico)
  if (I > 0.72 && b === 0 && Math.random() < 0.45) {
    const tones = QUAL[ch[1]], k = rndi(3, 5);
    for (let i = 0; i < k; i++) {
      const pos = rndi(0, 7) / 2, at = t + Math.floor(pos) * spb + (pos % 1 ? sw : 0);
      const m = 72 + ((ch[0] + pick(tones)) % 12) + (Math.random() < 0.3 ? 12 : 0);
      note("vibes", at, Math.pow(2, (m - 72) / 12), 0.1, spb * 1.4);
    }
  }
}
function tenseBeat(t, spb, b, bar) {
  const ch = TENSE[bar % TENSE.length], root = rootBass(ch[0]), half = spb / 2;
  const pat = [0, 0, 12, 0, 7, 0, 10, 12];
  for (let k = 0; k < 2; k++) bassNote(root + pat[(b * 2 + k) % 8], t + k * half, k ? 0.38 : 0.5, half * 0.6);
  note("hat", t, 1, 0.1); note("hat", t + half, 1, 0.16);
  if (b === 0) { note("kick", t, 0.9, 0.4); note("kick", t + spb * 0.4, 0.9, 0.3); }
  if (b === 3) note("rim", t, 1, 0.18);
  if (b === 0) for (const m of voicing(ch).slice(0, 3)) { const e = epFor(m - 4); note(e.name, t, e.rate, 0.07, spb * 1.5); }
  if (b === 0 && bar % 2 === 0) { // pad grave sostenido
    const pr = Math.pow(2, (((ch[0] - 2 + 12) % 12) - (((ch[0] - 2 + 12) % 12) > 6 ? 12 : 0)) / 12);
    note("pad", t, pr, 0.16, spb * 7.6, N.tense); note("pad", t, pr * 1.498, 0.09, spb * 7.6, N.tense);
  }
  if (music.inspector && b === 0 && bar % 4 === 0) note("timp", t, 1, 0.35);
  N.tense.gain.setTargetAtTime(music.inspector ? 1 : 0.6, t, 0.5);
}
function musicPump() {
  if (!music.on || !ctx || ctx.state !== "running") return;
  const now = ctx.currentTime;
  if (music.nextT < now - 0.1) music.nextT = now + 0.06; // volvimos de una pausa
  while (music.nextT < now + 0.22) {
    try { scheduleBeat(music.nextT); } catch (e) { stats.errors.push("música: " + (e && e.message)); }
    music.nextT += 60 / music.bpm;
    music.beat = (music.beat + 1) % 4; if (music.beat === 0) music.bar++;
  }
}

// =====================================================================
// AJUSTES Y MENÚ — sliders dentro de la pantalla de pausa
// =====================================================================
const css = document.createElement("style");
css.textContent = `
#sndSettings { display: grid; gap: 8px; border-top: 1px solid #23493b; padding-top: 10px; }
#sndSettings .r { display: grid; grid-template-columns: 76px 1fr 46px; gap: 10px; align-items: center; font-size: .95rem; color: var(--ivory-dim); }
#sndSettings input[type=range] { width: 100%; min-width: 0; height: 28px; margin: 0; accent-color: var(--brass); touch-action: pan-y; }
#sndSettings .v { font-family: var(--font-num); text-align: right; color: var(--ivory); font-size: .86rem; }
#sndSettings .row2 { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
#sndSettings .row2 span { font-size: .84rem; color: var(--ivory-dim); }
#sndSettings.muted .r { opacity: .5; }
`;
document.head.appendChild(css);
const SLIDERS = [["master", "General"], ["music", "Música"], ["sfx", "Efectos"]];
const isTouch = matchMedia("(pointer: coarse)").matches || ("ontouchstart" in window && navigator.maxTouchPoints > 0);
function settingsHtml() {
  return `<h3>Sonido</h3>` + SLIDERS.map(([k, label]) => `<label class="r"><span>${label}</span><input type="range" min="0" max="100" step="1" value="${Math.round(settings[k] * 100)}" data-snd="${k}" aria-label="Volumen ${label.toLowerCase()}"><span class="v" data-sndv="${k}">${Math.round(settings[k] * 100)}%</span></label>`).join("")
    + `<div class="row2"><button class="ghost sm" data-snd="mute" aria-pressed="${settings.muted}">${settings.muted ? "Activar sonido" : "Silenciar todo"}</button>${isTouch ? "" : "<span>Tecla M: silenciar</span>"}</div>`;
}
function injectSettings() {
  if (dbg.panel !== "pause") return;
  const body = document.getElementById("panelBody");
  if (!body || body.querySelector("#sndSettings")) return;
  const box = document.createElement("div"); box.id = "sndSettings"; box.className = settings.muted ? "muted" : "";
  box.innerHTML = settingsHtml();
  const actions = body.querySelector(".actions:last-of-type");
  body.insertBefore(box, actions || null);
}
function refreshSettingsUi() {
  const box = document.getElementById("sndSettings"); if (!box) return;
  box.className = settings.muted ? "muted" : "";
  const b = box.querySelector('[data-snd="mute"]'); if (b) { b.textContent = settings.muted ? "Activar sonido" : "Silenciar todo"; b.setAttribute("aria-pressed", String(settings.muted)); }
  for (const [k] of SLIDERS) { const v = box.querySelector(`[data-sndv="${k}"]`), r = box.querySelector(`[data-snd="${k}"]`); if (v) v.textContent = Math.round(settings[k] * 100) + "%"; if (r && document.activeElement !== r) r.value = Math.round(settings[k] * 100); }
}
const panelBody = document.getElementById("panelBody");
if (panelBody) {
  new MutationObserver(injectSettings).observe(panelBody, { childList: true });
  panelBody.addEventListener("input", e => {
    const k = e.target && e.target.dataset && e.target.dataset.snd;
    if (!k || k === "mute") return;
    setVolume(k, +e.target.value / 100, true);
  });
  panelBody.addEventListener("change", e => { const k = e.target && e.target.dataset && e.target.dataset.snd; if (k && k !== "mute") saveSettings(); });
  panelBody.addEventListener("click", e => { const b = e.target.closest && e.target.closest('[data-snd="mute"]'); if (b) setMuted(!settings.muted); });
}
function setVolume(k, v, keepUnsaved) {
  if (!(k in settings) || k === "muted") return;
  settings[k] = clamp(+v || 0, 0, 1); applyVolumes(); refreshSettingsUi();
  if (!keepUnsaved) saveSettings();
}
function setMuted(m) {
  settings.muted = !!m; saveSettings(); applyVolumes(); refreshSettingsUi();
  if (!settings.muted) { syncRunning(); setTimeout(() => fire && ready && play("click"), 60); }
  else setTimeout(syncRunning, 80); // dejar caer la ganancia y suspender (ahorra CPU)
}
function miniToast(msg) {
  const el = document.getElementById("toasts"); if (!el) return;
  const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; el.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}
window.addEventListener("keydown", e => {
  if (e.code !== "KeyM" || e.repeat || !dbg.started) return;
  const tag = e.target && e.target.tagName; if (tag === "INPUT" || tag === "TEXTAREA") return;
  setMuted(!settings.muted); miniToast(settings.muted ? "Sonido silenciado (M)." : "Sonido activado.");
});

// =====================================================================
// CICLO — arranque con gesto, pausa con la pestaña oculta
// =====================================================================
function init() {
  if (ctx || !AC) return;
  try {
    try { ctx = new AC({ latencyHint: "interactive" }); } catch (e) { ctx = new AC(); }
    buildGraph();
    ready = true;
    for (const n of ["click", "buzz", "step_soft0", "step_soft1", "coin", "register", "bass", "ep60", "swish", "tap"]) sample(n);
    syncRunning();
    music.on = true; music.nextT = ctx.currentTime + 0.4; music.beat = 0; music.bar = 0;
    music.timer = setInterval(musicPump, 50);
    warm();
  } catch (e) { stats.errors.push("init: " + (e && e.message)); ready = false; }
}
// renderiza el resto de las muestras de a una, sin trabar un cuadro
const WARM = ["room", "murmur", "door", "spin0", "stop", "win", "collect", "safe", "chips0", "deal", "ride", "kick", "ep48", "ep72", "vibes", "step_hard0", "step_soft2", "step_soft3",
  "step_hard1", "spin1", "chips1", "attract0", "attract1", "bigwin", "shuffle", "roulette", "alarm", "stinger", "fanfare", "goal", "greet", "vipchime", "bell_open", "bell_close", "clink",
  "breakm", "repair", "caught", "hat", "rim", "pad", "timp", "jackpot", "chips2", "attract2", "step_hard2", "step_hard3",
  "cheer", "clap", "grumble", "thud", "punch", "powerdown", "powerup", "spill", "party", "horn", "tape", "rain", "thunder", "shot", "swing"];
function warm() {
  let i = 0;
  const next = () => {
    if (i >= WARM.length) return;
    try { sample(WARM[i++]); } catch (e) { stats.errors.push("warm: " + (e && e.message)); }
    if (cache.has("murmur") && cache.has("room")) startAmbience();
    setTimeout(next, 30);
  };
  setTimeout(next, 30);
}
// el contexto se crea en el primer gesto después de "Abrir el casino" (el click de ese mismo botón)
for (const ev of ["click", "keydown", "pointerup", "touchend"]) document.addEventListener(ev, () => { if (dbg.started && !ctx) init(); else if (ctx && ctx.state === "suspended" && wantRunning()) syncRunning(); }, false);
// clicks de interfaz
document.addEventListener("click", e => {
  const b = e.target && e.target.closest && e.target.closest("button");
  if (!b || b.disabled || !ctx) return;
  if (b.dataset.snd === "mute") return;
  play("click");
}, true);
document.addEventListener("visibilitychange", syncRunning);
window.addEventListener("pagehide", () => { if (ctx && ctx.state === "running") ctx.suspend().catch(() => {}); });
window.addEventListener("pageshow", syncRunning);

let prevT = performance.now(), ambT = 0;
function loop(now) {
  const dt = Math.min(0.25, (now - prevT) / 1000); prevT = now;
  if (ready && ctx.state === "running") {
    try {
      updateSteps(dt);
      ambT += dt; if (ambT >= 0.2) { updateAmbience(ambT); ambT = 0; }
    } catch (e) { stats.errors.push("loop: " + (e && e.message)); }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// =====================================================================
// API
// =====================================================================
const api = {
  play,
  get ready() { return ready; },
  get state() { return ctx ? ctx.state : "none"; },
  get context() { return ctx; },
  get voices() { return activeVoices(); },
  settings, stats, lastSample, music, amb,
  setVolume, setMuted,
  graph() {
    if (!ctx) return null;
    return { sampleRate: ctx.sampleRate, voices: N.voices.length, buffers: cache.size, nodes: Object.keys(N).filter(k => k !== "voices"), stereo: !!ctx.createStereoPanner, reverb: !!(N.verb && N.verb.buffer) };
  },
  inspect() { const out = {}; for (const [k, b] of cache) { const d = b.getChannelData(0); let pk = 0, nan = false; for (let i = 0; i < d.length; i++) { const v = d[i]; if (v !== v) nan = true; else if (Math.abs(v) > pk) pk = Math.abs(v); } out[k] = { peak: +pk.toFixed(3), nan, sec: +b.duration.toFixed(2) }; } return out; },
  renderAll() { for (const k in DEF) { const n = VARIANTS[k] || 1; for (let i = 0; i < n; i++) sample(VARIANTS[k] ? k + i : k); } return cache.size; },
  init,
};
window.casinoAudio = api;
if (dbg) dbg.audio = api;
})();
