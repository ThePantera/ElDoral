/* Casino Dorado · exterior.js — LA CALLE Y LA CIUDAD DE AFUERA
 * Antes el exterior era una maqueta (cielo plano, pared lisa, vereda y calle vacías). Acá se arma:
 *  1. Cielo: una cúpula con degradado que sigue el ciclo de día y noche de world.js (horizonte = color de la niebla),
 *     resplandor cálido del atardecer, estrellas y luna de noche (se apagan con nubes o lluvia).
 *  2. Ciudad: edificios vecinos pegados al casino y enfrente (locales con vidriera y cartel, balcones, cornisas),
 *     torres detrás y un horizonte lejano. Las ventanas las dibuja un shader (sin texturas): de día reflejan el cielo,
 *     de noche se prende una parte, con cortinas y tonos distintos. Balizas rojas en las torres altas.
 *  3. Calle: asfalto con desgaste y línea amarilla, cordón cuneta, vereda de baldosas, senda peatonal, cordones,
 *     faroles (el brillo y el charco de luz son pintados), palmeras y árboles, bancos, parada de colectivo, tapas.
 *     La fachada del casino gana zócalo de granito, revoque con buña, pilastras, cornisa, ático y ventanas con
 *     cortinas de terciopelo que de noche brillan cálidas, más apliques en la pared.
 *  4. Autos de Kenney (CC0, js/props-assets.js): estacionados enfrente y uno que pasa cada tanto (frena si estás en
 *     la calle). combat.js usa el patrullero y el auto de la Mafia de acá si ya cargaron.
 * REGLA: no agrega ninguna luz. Todo brillo es MeshBasic, aditivo o shader. Lo estático va fusionado (pocas llamadas).
 * Se carga después de world.js; world.js le pasa el cielo en cada cuadro (CasinoExterior.sky).
 */
(() => {
"use strict";
const G = window.CasinoWorldBridge, A = window.CasinoArt, T = window.THREE;
if (!G || !A || !T) return;
const scene = G.scene;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
let seed = 20240917; // misma ciudad en cada partida
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const rr = (a, b) => a + rnd() * (b - a);
const renderer = () => window.casinoDebug && window.casinoDebug.fn && window.casinoDebug.fn.renderer;
const pick = a => a[(rnd() * a.length) | 0];
const lin = hex => new T.Color(hex); // perf.js pasa el hex de sRGB a lineal

// =====================================================================
// ARMADOR DE GEOMETRÍA: junta cajas, quads y mallas en un solo BufferGeometry (color por vértice + info)
// =====================================================================
class Geo {
  constructor(info) { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; this.f = info ? [] : null; }
  get count() { return this.p.length / 3; }
  // quad con 4 esquinas (orden antihorario visto desde afuera), uv en metros
  quad(a, b, c, d, nrm, col, uvs, info) {
    const o = this.count;
    for (const [k, v] of [a, b, c, d].entries()) {
      this.p.push(v[0], v[1], v[2]); this.n.push(nrm[0], nrm[1], nrm[2]); this.c.push(col.r, col.g, col.b);
      this.uv.push(uvs[k][0], uvs[k][1]); if (this.f) this.f.push(info[0], info[1], info[2], info[3]);
    }
    this.i.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  // caja alineada a los ejes; faces: qué caras dibujar (px nx py ny pz nz), info por cara (ventanas)
  box(x0, x1, y0, y1, z0, z1, col, opt) {
    opt = opt || {}; const F = opt.faces || "px nx py pz nz", inf = opt.info || {}, no = [0, 0, 0, 0];
    // u en metros desde el borde izquierdo de cada cara (así las ventanas quedan centradas en el paño)
    const dx = x1 - x0, dz = z1 - z0;
    if (F.includes("pz")) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], col, [[0, y0], [dx, y0], [dx, y1], [0, y1]], inf.pz || inf.side || no);
    if (F.includes("nz")) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], col, [[0, y0], [dx, y0], [dx, y1], [0, y1]], inf.nz || inf.side || no);
    if (F.includes("px")) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], col, [[0, y0], [dz, y0], [dz, y1], [0, y1]], inf.px || inf.side || no);
    if (F.includes("nx")) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], col, [[0, y0], [dz, y0], [dz, y1], [0, y1]], inf.nx || inf.side || no);
    if (F.includes("py")) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], opt.top || col, [[x0, z1], [x1, z1], [x1, z0], [x0, z0]], no);
    if (F.includes("ny")) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], col, [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], no);
  }
  // malla de three (con matriz) entera de un color, o con su atributo de color
  mesh(geo, m, col) {
    const g = geo.index ? geo : geo, P = g.attributes.position, N = g.attributes.normal, C = g.attributes.color, U = g.attributes.uv;
    const o = this.count, v = new T.Vector3(), nm = new T.Matrix3().getNormalMatrix(m);
    for (let k = 0; k < P.count; k++) {
      v.fromBufferAttribute(P, k).applyMatrix4(m); this.p.push(v.x, v.y, v.z);
      v.fromBufferAttribute(N, k).applyMatrix3(nm).normalize(); this.n.push(v.x, v.y, v.z);
      if (C && !col) this.c.push(C.getX(k), C.getY(k), C.getZ(k)); else this.c.push(col.r, col.g, col.b);
      this.uv.push(U ? U.getX(k) : 0, U ? U.getY(k) : 0); if (this.f) this.f.push(0, 0, 0, 0);
    }
    if (g.index) for (let k = 0; k < g.index.count; k++) this.i.push(o + g.index.getX(k));
    else for (let k = 0; k < P.count; k++) this.i.push(o + k);
  }
  // datos crudos (modelos Kenney ya pasados a metros)
  raw(r, m, col) {
    const o = this.count, v = new T.Vector3(), nm = new T.Matrix3().getNormalMatrix(m);
    for (let k = 0; k < r.pos.length / 3; k++) {
      v.set(r.pos[k * 3], r.pos[k * 3 + 1], r.pos[k * 3 + 2]).applyMatrix4(m); this.p.push(v.x, v.y, v.z);
      v.set(r.nor[k * 3], r.nor[k * 3 + 1], r.nor[k * 3 + 2]).applyMatrix3(nm).normalize(); this.n.push(v.x, v.y, v.z);
      if (col) this.c.push(col.r, col.g, col.b); else this.c.push(r.col[k * 3], r.col[k * 3 + 1], r.col[k * 3 + 2]);
      this.uv.push(0, 0); if (this.f) this.f.push(0, 0, 0, 0);
    }
    for (const q of r.idx) this.i.push(o + q);
  }
  build(colName) {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(this.p, 3));
    g.setAttribute("normal", new T.Float32BufferAttribute(this.n, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(this.uv, 2));
    g.setAttribute(colName || "color", new T.Float32BufferAttribute(this.c, 3));
    if (this.f) g.setAttribute("aInfo", new T.Float32BufferAttribute(this.f, 4));
    g.setIndex(this.count > 65535 ? new T.Uint32BufferAttribute(this.i, 1) : new T.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}
const M4 = (x, y, z, ry, sx, sy, sz) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(0, ry || 0, 0)), new T.Vector3(sx || 1, sy || sx || 1, sz || sx || 1));
function addMesh(geo, mat, name, order) { const m = new T.Mesh(geo, mat); m.name = name; m.matrixAutoUpdate = false; m.updateMatrix(); if (order != null) m.renderOrder = order; scene.add(m); return m; }

// =====================================================================
// MATERIALES (los que cambian de día a noche se actualizan en sky())
// =====================================================================
const U = { // uniformes compartidos del cielo y la ciudad
  uTop: { value: new T.Color(0x3a78cc) }, uHor: { value: new T.Color(0x8dbbe2) }, uGlow: { value: new T.Color(0xff8a4a) },
  uGlowDir: { value: new T.Vector3(-0.8, 0, -0.6).normalize() }, uGlowK: { value: 0 },
  uNight: { value: 0 }, uLit: { value: 0.1 },
  uHemiSky: { value: new T.Color(0.6, 0.55, 0.5) }, uHemiGround: { value: new T.Color(0.05, 0.03, 0.02) },
  uSunCol: { value: new T.Color(0.3, 0.3, 0.35) }, uSunDir: { value: new T.Vector3(-10, 20, -15).normalize() },
  uFarA: { value: 60 }, uFarB: { value: 260 }, uFarK: { value: 0.72 },
};
const SKY_VS = `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FS = `uniform vec3 uTop, uHor, uGlow, uGlowDir; uniform float uGlowK; varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir); float y = d.y;
  vec3 c = mix(uHor, uTop, pow(clamp(y, 0.0, 1.0), 0.5));
  vec2 h = normalize(d.xz + 1e-5);
  float g = pow(max(dot(h, uGlowDir.xz), 0.0), 3.0) * (1.0 - smoothstep(-0.02, 0.5, y));
  c += uGlow * (uGlowK * (0.35 + 0.65 * g)) * (1.0 - smoothstep(0.0, 0.6, y));
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <encodings_fragment>
}`;
// ciudad: luz tipo Lambert (hemisferio + luna/sol de world.js) y ventanas procedurales
const CITY_VS = `attribute vec3 aCol; attribute vec4 aInfo;
uniform vec3 uHemiSky, uHemiGround, uSunCol, uSunDir; uniform float uNight;
varying vec3 vCol, vLight; varying vec4 vInfo; varying vec2 vUv; varying float vDist;
#include <fog_pars_vertex>
void main(){
  vec3 n = normalize(normal);
  vLight = mix(uHemiGround, uHemiSky, 0.5 * n.y + 0.5) + uSunCol * max(dot(n, uSunDir), 0.0);
  vLight *= 1.0 - 0.6 * uNight; // de noche las paredes de la ciudad quedan en penumbra (la luz del hemisferio es la del salón)
  vCol = aCol; vInfo = aInfo; vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vDist = length(mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const CITY_FS = `uniform float uNight, uLit, uFarA, uFarB, uFarK; uniform vec3 uTop, uHor;
varying vec3 vCol, vLight; varying vec4 vInfo; varying vec2 vUv; varying float vDist;
#include <fog_pars_fragment>
float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec3 col = vCol * vLight;
  float mode = vInfo.w;
  if (mode > 0.5) {
    vec2 sz = vInfo.yz, c = vUv / sz, id = floor(c), f = fract(c);
    float shop = (mode > 1.5 && vUv.y < sz.y) ? 1.0 : 0.0;
    float m = shop > 0.5 ? step(0.05, f.x) * step(f.x, 0.95) * step(0.03, f.y) * step(f.y, 0.74)
                         : step(0.24, f.x) * step(f.x, 0.76) * step(0.22, f.y) * step(f.y, 0.8);
    // lejos (menos de ~2 píxeles por ventana) el dibujo se promedia: sin ese granulado que titila
    float aa = clamp(1.6 - 5.0 * max(fwidth(c.x), fwidth(c.y)) * (shop > 0.5 ? 0.5 : 1.0), 0.0, 1.0);
    m = mix(0.3, m, aa);
    float sill = (1.0 - shop) * step(0.17, f.y) * step(f.y, 0.22) * step(0.2, f.x) * step(f.x, 0.8);
    float lintel = (1.0 - shop) * step(0.8, f.y) * step(f.y, 0.86) * step(0.22, f.x) * step(f.x, 0.78);
    col *= 1.0 - 0.3 * lintel; col = mix(col, vLight * 0.85, sill * 0.7);
    float s = vInfo.x;
    float r = hh(id + s * 17.0), r2 = hh(id * 1.37 + s * 3.1 + 5.0), rf = hh(vec2(s * 7.7, id.y));
    float lit = shop > 0.5 ? 0.35 + 0.65 * uNight : uLit * (0.35 + 1.1 * rf);
    float on = mix(lit * 0.6, step(r, lit), aa); // lejos: el promedio de ventanas prendidas (sin chispitas)
    vec3 warm = mix(vec3(1.0, 0.62, 0.3), vec3(0.6, 0.78, 1.0), step(0.84, r2)) * (0.5 + 0.75 * hh(id + s * 7.0 + 9.0));
    warm = mix(warm, vec3(1.0, 0.6, 0.3) * 0.55, shop);
    float cur = step(abs(f.x - 0.5), 0.07 + 0.2 * r2 + shop);
    warm *= mix(0.45, 1.0, cur) * mix(1.0, 0.75, step(0.7, f.y) * (1.0 - shop));
    vec3 dayGlass = mix(uHor, uTop, f.y * 0.8) * (0.32 + 0.25 * r2) * clamp(vLight, 0.0, 1.5) + 0.01;
    vec3 glass = mix(dayGlass, vec3(0.010, 0.013, 0.02), uNight) + warm * on * mix(0.3, 1.45, uNight);
    col = mix(col, glass, m);
  }
  gl_FragColor = vec4(col, 1.0);
  #ifdef FAR
    gl_FragColor.rgb = mix(gl_FragColor.rgb, uHor * 0.92, uFarK * smoothstep(uFarA, uFarB, vDist));
  #else
    #include <fog_fragment>
  #endif
  #include <tonemapping_fragment>
  #include <encodings_fragment>
}`;
function cityMat(far) {
  return new T.ShaderMaterial({
    uniforms: T.UniformsUtils.merge([T.UniformsLib.fog]), vertexShader: CITY_VS, fragmentShader: CITY_FS,
    fog: !far, defines: far ? { FAR: 1 } : {}, extensions: { derivatives: true },
  });
}
const matNear = cityMat(false), matFar = cityMat(true);
for (const m of [matNear, matFar]) Object.assign(m.uniforms, U); // comparten los mismos objetos de uniforme
// props estáticos con luz normal: siempre Lambert (luz por vértice), también en Gráficos "Alta". Afuera no hay reflejos
// que valgan la pena y con PBR cada píxel de fachada y autos calcula las 8 luces (en "Alta" costaba un 15-20 % más).
const LitMat = (window.CasinoPerf && window.CasinoPerf.FastMaterial) || T.MeshLambertMaterial;
const propMat = new LitMat({ vertexColors: true, roughness: 0.75, metalness: 0.05 });
const paintMat = new LitMat({ vertexColors: true, roughness: 0.35, metalness: 0.25 }); // chapa de los autos
// brillos (faroles, faros, vidrieras): MeshBasic, el color general baja de día
const glowMat = new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
const radialTex = A.canvasTex(128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 63);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,0.55)"); gr.addColorStop(0.6, "rgba(255,255,255,0.14)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
const poolMat = new T.MeshBasicMaterial({ map: radialTex, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4 });
const haloMat = new T.PointsMaterial({ map: radialTex, size: 3.2, sizeAttenuation: true, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, opacity: 0 });

// =====================================================================
// 1. CIELO
// =====================================================================
const dome = new T.Mesh(new T.SphereGeometry(170, 32, 16), new T.ShaderMaterial({ uniforms: U, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: T.BackSide, depthWrite: false, fog: false }));
dome.renderOrder = 900; // se dibuja al final de lo opaco: lo tapado no se pinta (más barato desde adentro)
dome.frustumCulled = false; dome.name = "SkyDome"; scene.add(dome);
// estrellas: puntos fijos en la cúpula, titilan apenas
const starGeo = (() => {
  const p = [], s = [];
  for (let i = 0; i < 700; i++) {
    const y = 0.06 + Math.pow(rnd(), 0.8) * 0.94, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - y * y);
    p.push(Math.cos(a) * r * 160, y * 160, Math.sin(a) * r * 160); s.push(rnd() < 0.08 ? rr(2.4, 3.4) : rr(1.0, 1.9), rnd());
  }
  const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(p, 3)); g.setAttribute("aS", new T.Float32BufferAttribute(s, 2));
  return g;
})();
const starMat = new T.ShaderMaterial({
  uniforms: { uA: { value: 0 }, uT: { value: 0 }, uPx: { value: 1 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false,
  vertexShader: `attribute vec2 aS; uniform float uT, uPx; varying float vB; void main(){ vB = 0.6 + 0.4 * sin(uT * (1.0 + aS.y * 2.0) + aS.y * 40.0); gl_PointSize = aS.x * uPx * 1.6; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform float uA; varying float vB; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.1, length(d)); gl_FragColor = vec4(vec3(1.0, 1.0, 1.1) * a * vB * uA * 1.6, 1.0); }`,
});
const stars = new T.Points(starGeo, starMat); stars.frustumCulled = false; stars.renderOrder = 901; scene.add(stars);
const moonTex = A.canvasTex(128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(64, 64, 18, 64, 64, 63); gr.addColorStop(0, "rgba(200,215,255,0.35)"); gr.addColorStop(1, "rgba(200,215,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = "#e9ecf2"; g.beginPath(); g.arc(64, 64, 20, 0, Math.PI * 2); g.fill();
  g.fillStyle = "rgba(120,130,150,0.35)"; for (const [x, y, r] of [[58, 58, 5], [70, 66, 4], [62, 72, 3], [72, 55, 2.5]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
});
const moon = new T.Mesh(new T.PlaneGeometry(22, 22), new T.MeshBasicMaterial({ map: moonTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false, toneMapped: false, opacity: 0 }));
const MOON_DIR = new T.Vector3(-0.2, 0.62, -0.76).normalize(); moon.renderOrder = 902; moon.frustumCulled = false; scene.add(moon);

// =====================================================================
// 2. SUELO: asfalto, vereda de baldosas, cordones, senda peatonal
// =====================================================================
const roadTex = A.canvasTex(512, 512, (g, w, h) => { // 8 m (u) × 7 m de calle (v): cordón cuneta, carriles, línea amarilla
  g.fillStyle = "#3a3b3e"; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) { const v = 40 + Math.random() * 40; g.fillStyle = `rgba(${v},${v},${v + 3},${0.25 + Math.random() * 0.35})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); }
  // desgaste de las ruedas (más oscuro y liso) en cada carril
  for (const v of [0.3, 0.42, 0.6, 0.72]) { const y = v * h, gr = g.createLinearGradient(0, y - 22, 0, y + 22); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.5, "rgba(10,10,12,0.28)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, y - 22, w, 44); }
  // parches y grietas
  for (let i = 0; i < 4; i++) { g.fillStyle = `rgba(20,20,22,${0.25 + Math.random() * 0.2})`; g.fillRect(Math.random() * w, 90 + Math.random() * 330, 30 + Math.random() * 80, 20 + Math.random() * 50); }
  g.strokeStyle = "rgba(15,15,15,0.5)"; g.lineWidth = 1.2;
  for (let i = 0; i < 7; i++) { g.beginPath(); let x = Math.random() * w, y = 80 + Math.random() * 350; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 50; y += (Math.random() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); }
  // cordón cuneta de hormigón en los dos bordes (0,45 m), con juntas
  for (const [y0, y1] of [[0, 33], [h - 33, h]]) { g.fillStyle = "#77746e"; g.fillRect(0, y0, w, y1 - y0); noise(g, 0, y0, w, y1 - y0, 900, "rgba(40,38,34,0.25)"); g.fillStyle = "rgba(30,30,30,0.5)"; for (let x = 0; x < w; x += 128) g.fillRect(x, y0, 2, y1 - y0); }
  g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(0, 33, w, 3); g.fillRect(0, h - 36, w, 3);
  // línea amarilla discontinua al medio (3 m pintados, 5 m libres) gastada
  g.fillStyle = "#d9b23a"; g.fillRect(40, h / 2 - 6, 192, 12);
  noise(g, 40, h / 2 - 6, 192, 12, 300, "rgba(60,60,60,0.45)");
});
roadTex.wrapS = roadTex.wrapT = T.RepeatWrapping; roadTex.anisotropy = 8;
function noise(g, x, y, w, h, n, col) { g.fillStyle = col; for (let i = 0; i < n; i++) g.fillRect(x + Math.random() * w, y + Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); }
const walkTex = A.canvasTex(256, 256, (g, w, h) => { // 1,2 m: 3×3 baldosas "vainilla" de 40 cm (9 panes cada una)
  g.fillStyle = "#8d877d"; g.fillRect(0, 0, w, h);
  const t = w / 3;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const x = i * t, y = j * t, tone = 128 + Math.random() * 22;
    g.fillStyle = `rgb(${tone + 6},${tone},${tone - 10})`; g.fillRect(x + 1, y + 1, t - 2, t - 2);
    const q = (t - 6) / 3;
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
      const px = x + 3 + a * q, py = y + 3 + b * q;
      g.fillStyle = "rgba(255,250,240,0.10)"; g.fillRect(px + 2, py + 2, q - 5, 2); g.fillRect(px + 2, py + 2, 2, q - 5);
      g.fillStyle = "rgba(0,0,0,0.16)"; g.fillRect(px + 2, py + q - 4, q - 4, 2); g.fillRect(px + q - 4, py + 2, 2, q - 4);
    }
    g.fillStyle = "rgba(40,36,30,0.55)"; g.fillRect(x, y, t, 1.5); g.fillRect(x, y, 1.5, t);
  }
  noise(g, 0, 0, w, h, 2200, "rgba(50,44,36,0.12)");
  for (let i = 0; i < 5; i++) { g.fillStyle = "rgba(30,26,20,0.12)"; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 8 + Math.random() * 18, 5 + Math.random() * 10, Math.random() * 3, 0, Math.PI * 2); g.fill(); } // manchas
});
walkTex.wrapS = walkTex.wrapT = T.RepeatWrapping; walkTex.anisotropy = 8;
const lotTex = A.canvasTex(256, 256, (g, w, h) => { // asfalto gastado de las veredas lejanas y los patios
  g.fillStyle = "#4a4946"; g.fillRect(0, 0, w, h); noise(g, 0, 0, w, h, 5000, "rgba(25,25,25,0.3)"); noise(g, 0, 0, w, h, 1500, "rgba(120,118,112,0.2)");
  g.fillStyle = "rgba(20,20,20,0.5)"; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h);
});
lotTex.wrapS = lotTex.wrapT = T.RepeatWrapping;
// re-mapea las uv de los pisos de game.js en metros (las cajas venían con uv 0..1 estiradas a 110 m)
function remapUv(mat, fu, fv) {
  scene.traverse(o => {
    if (!o.isMesh || o.material !== mat) return;
    o.updateMatrixWorld(); const P = o.geometry.attributes.position, UV = o.geometry.attributes.uv, v = new T.Vector3();
    for (let k = 0; k < P.count; k++) { v.fromBufferAttribute(P, k).applyMatrix4(o.matrixWorld); const [u, w] = fu(v); UV.setXY(k, u, w); }
    UV.needsUpdate = true;
  });
}
if (G.M) {
  // color blanco: la textura manda (world.js oscurece el color cuando llueve, eso se sigue viendo)
  G.M.road.map = roadTex; G.M.road.color.setHex(0xffffff); G.M.road.needsUpdate = true;
  G.M.walk.map = walkTex; G.M.walk.color.setHex(0xffffff); G.M.walk.needsUpdate = true;
  G.M.grass.map = lotTex; G.M.grass.color.setHex(0xc8c4bc); G.M.grass.needsUpdate = true;
  remapUv(G.M.road, v => [v.x / 8, (v.z + 24) / 7]);
  remapUv(G.M.walk, v => [v.x / 1.2, v.z / 1.2]);
  remapUv(G.M.grass, v => [v.x / 5, v.z / 5]);
  G.M.lane.visible = false; // la línea ahora está pintada en el asfalto (27 llamadas de dibujo menos)
}
const sendaTex = A.canvasTex(256, 64, (g, w, h) => { // senda peatonal: franjas blancas gastadas
  g.clearRect(0, 0, w, h);
  for (let x = 0; x < w; x += 32) { g.fillStyle = "rgba(235,232,222,0.88)"; g.fillRect(x + 4, 0, 18, h); }
  g.globalCompositeOperation = "destination-out"; noise(g, 0, 0, w, h, 120, "rgba(0,0,0,0.3)"); g.globalCompositeOperation = "source-over";
});
{
  const s = new T.Mesh(new T.PlaneGeometry(6.2, 3.2), new LitMat({ map: sendaTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, roughness: 0.8 }));
  s.rotation.set(-Math.PI / 2, 0, Math.PI / 2); s.position.set(0, 0.012, -20.5); s.renderOrder = 1; s.name = "Senda"; s.matrixAutoUpdate = false; s.updateMatrix(); scene.add(s);
}

// =====================================================================
// 3. CIUDAD: lotes vecinos, enfrente, atrás y horizonte lejano
// =====================================================================
const WALLS = [0xd9c9a8, 0xc9a27e, 0xb46a4c, 0x8f8f8c, 0xe2d6bd, 0x9fb0b8, 0xc4b08a, 0x7d5a4a, 0xa8a49a, 0xd3b48f, 0x6e7378];
const near = { L: new Geo(true), R: new Geo(true), F: new Geo(true), B: new Geo(true) };
const far = [new Geo(true), new Geo(true)];
const signs = []; // carteles de locales: {x, y, z, ry, w, slot}
const awnings = new Geo(), shopPools = [], blinkers = [];
// un edificio: caja con ventanas en los costados, cornisa, techo con cosas; front: cara de la calle
function building(geo, x0, x1, z0, z1, h, o) {
  o = o || {};
  const col = lin(o.color || pick(WALLS)), s = rr(0, 50), floorH = o.floorH || rr(2.9, 3.4), bay = o.bay || rr(2.2, 3.4);
  const inf = [s, bay, floorH, 1], shopInf = [s, bay, floorH, 2], side = {}, faces = "px nx pz nz";
  for (const f of ["px", "nx", "pz", "nz"]) side[f] = o.shop && f === o.front ? shopInf : inf;
  geo.box(x0, x1, 0, h, z0, z1, col, { faces: faces + " py", info: side, top: lin(0x3a3836) });
  // cornisa saliente y un ático más claro
  const cc = col.clone().lerp(lin(0xf2ead8), 0.35), e = 0.22;
  geo.box(x0 - e, x1 + e, h - 0.05, h + 0.28, z0 - e, z1 + e, cc, { faces: "px nx pz nz py ny", top: lin(0x4a4744) });
  if (o.parapet) geo.box(x0, x1, h + 0.28, h + 0.9, z0, z1, col.clone().multiplyScalar(0.92), { faces: "px nx pz nz py", top: lin(0x3a3836) });
  // balcones corridos en algunos edificios de cerca (losa + baranda)
  if (o.balcony && o.front) {
    const dz = o.front === "nz" ? -1 : 1, zf = o.front === "nz" ? z0 : z1, dark = lin(0x1c1d20);
    for (let k = 1; k * floorH < h - 1; k++) {
      const y = k * floorH, za = zf, zb = zf + dz * 0.75, lo = Math.min(za, zb), hi = Math.max(za, zb);
      geo.box(x0 + 0.3, x1 - 0.3, y - 0.12, y, lo, hi, cc, { faces: "px nx pz nz py ny" });
      geo.box(x0 + 0.3, x1 - 0.3, y + 0.92, y + 0.98, dz > 0 ? hi - 0.05 : lo, dz > 0 ? hi : lo + 0.05, dark, { faces: "px nx pz nz py ny" });
      for (let px = x0 + 0.35; px < x1 - 0.3; px += 1.1) geo.box(px, px + 0.05, y, y + 0.92, dz > 0 ? hi - 0.05 : lo, dz > 0 ? hi : lo + 0.05, dark, { faces: "pz nz px nx" }); // parantes
    }
  }
  // techo: tanque de agua, equipos y antenas
  if (!o.bare) {
    const top = h + (o.parapet ? 0.9 : 0.28), cx = rr(x0 + 1, x1 - 1), cz = rr(z0 + 1, z1 - 1);
    if (rnd() < 0.7) { geo.box(cx - 0.9, cx + 0.9, top, top + 1.6, cz - 0.9, cz + 0.9, lin(0x8a8a86), { faces: "px nx pz nz py" }); geo.box(cx - 1.0, cx + 1.0, top + 1.6, top + 1.75, cz - 1.0, cz + 1.0, lin(0x5a5a58), { faces: "px nx pz nz py" }); }
    if (rnd() < 0.6) { const ax = rr(x0 + 0.8, x1 - 0.8), az = rr(z0 + 0.8, z1 - 0.8); geo.box(ax - 0.5, ax + 0.5, top, top + 0.8, az - 0.4, az + 0.4, lin(0xb4b4b0), { faces: "px nx pz nz py" }); }
    if (rnd() < 0.5) { const ax = rr(x0 + 0.5, x1 - 0.5), az = rr(z0 + 0.5, z1 - 0.5); geo.box(ax - 0.03, ax + 0.03, top, top + 3.5, az - 0.03, az + 0.03, lin(0x2a2a2a), { faces: "px nx pz nz" }); }
  }
  return { s, floorH, bay };
}
// 3a. vecinos pegados al casino (misma vereda, frente en z = -10.4), con locales abajo
const SHOPS = ["PIZZERÍA", "FARMACIA", "KIOSCO 24 HS", "BAR NOTABLE", "CAFÉ", "LIBRERÍA", "PARRILLA", "HOTEL ROMA", "TINTORERÍA", "HELADERÍA", "CERRAJERÍA", "AGENCIA"];
let shopN = 0;
function row(geo, xa, xb, zf, depth, dir, hmin, hmax, shops) {
  // dir: -1 = frente hacia -Z (vereda del casino), +1 = frente hacia +Z (vereda de enfrente)
  let x = xa;
  while (x < xb - 3) {
    const w = Math.min(xb - x, rr(7, 12)), x0 = x, x1 = x + w, floors = Math.round(rr(hmin, hmax)), fh = rr(3.0, 3.3), h = floors * fh;
    const z0 = dir < 0 ? zf : zf - depth, z1 = dir < 0 ? zf + depth : zf, front = dir < 0 ? "nz" : "pz";
    const b = building(geo, x0, x1, z0, z1, h, { shop: shops, front, floorH: fh, bay: w / Math.max(2, Math.round(w / 2.8)), balcony: floors > 2 && rnd() < 0.55, parapet: rnd() < 0.4 });
    if (shops) {
      const yA = fh * 0.86, zz = zf + dir * 0.02, zo = zf + dir * 1.15;
      // toldo inclinado sobre la vidriera
      const ac = lin(pick([0x7a1c22, 0x1f4a34, 0x24324e, 0x8a5a1c, 0x3a3a3a]));
      const a1 = [x0 + 0.3, yA + 0.35, zz], a2 = [x1 - 0.3, yA + 0.35, zz], a3 = [x1 - 0.3, yA - 0.15, zo], a4 = [x0 + 0.3, yA - 0.15, zo], uq = [[0, 0], [1, 0], [1, 1], [0, 1]];
      awnings.quad(a1, a2, a3, a4, [0, 0.9, dir * 0.43], ac, uq); awnings.quad(a2, a1, a4, a3, [0, 0.9, dir * 0.43], ac, uq); // toldo: las dos caras
      awnings.box(x0 + 0.3, x1 - 0.3, yA - 0.42, yA - 0.15, Math.min(zo, zo - dir * 0.03), Math.max(zo, zo - dir * 0.03), ac.clone().multiplyScalar(0.8), { faces: "pz nz" });
      signs.push({ x: (x0 + x1) / 2, y: yA + 0.75, z: zf + dir * 0.06, ry: dir < 0 ? Math.PI : 0, w: Math.min(w - 1.2, 4.2), slot: shopN++ % SHOPS.length });
      shopPools.push({ x: (x0 + x1) / 2, z: zf + dir * 1.6, rx: w * 0.42, rz: 1.5, color: 0xffb870, k: 0.5 });
    }
    // las colisiones: nadie camina adentro de los edificios
    if (G.boxAt && Math.abs(zf) < 40) G.boxAt((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, "wall");
    x = x1 + (rnd() < 0.15 ? rr(0.3, 1.2) : 0);
  }
}
row(near.R, 22.3, 36, -10.4, 14, -1, 2, 6, true); row(near.R, 44, 56, -10.4, 14, -1, 3, 7, true);
row(near.L, -56, -44, -10.4, 14, -1, 3, 7, true); row(near.L, -36, -22.3, -10.4, 14, -1, 2, 6, true);
row(near.F, -56, -44, -28.2, 14, 1, 3, 8, true); row(near.F, -36, -14.5, -28.2, 13, 1, 2, 6, true);
row(near.F, 14.5, 36, -28.2, 13, 1, 2, 6, true); row(near.F, 44, 56, -28.2, 14, 1, 3, 8, true);
// torres atrás del casino (se ven por encima del techo) y detrás del rival
for (let x = -54; x < 54;) { const w = rr(8, 14), h = rr(8, 24), z0 = rr(17, 21), z1 = rr(29, 34); building(near.B, x, x + w, z0, z1, h, { parapet: rnd() < 0.5 }); if (G.boxAt) G.boxAt(x + w / 2, (z0 + z1) / 2, w, z1 - z0, "wall"); x += w + rr(0.5, 3); }
for (let x = -54; x < 54;) { const w = rr(8, 15), h = rr(14, 40), z1 = rr(-47, -44); building(near.F, x, x + w, z1 - rr(10, 14), z1, h, { parapet: rnd() < 0.5 }); x += w + rr(0.5, 4); }
// horizonte lejano: un anillo de torres (niebla propia: se ven como siluetas con ventanas, no desaparecen)
for (let i = 0; i < 90; i++) {
  const a = (i / 90) * Math.PI * 2 + rr(-0.03, 0.03), d = rr(75, 140), w = rr(10, 22), dd = rr(10, 22), h = rr(18, 75) * (d > 110 ? 1.2 : 1);
  const cx = Math.cos(a) * d, cz = -10 + Math.sin(a) * d;
  const geo = far[cz < -10 ? 0 : 1];
  building(geo, cx - w / 2, cx + w / 2, cz - dd / 2, cz + dd / 2, h, { bare: true, floorH: 3.3, bay: rr(2.5, 4), color: pick([0x8a8f96, 0x9a948a, 0x6e737b, 0xb0a898, 0x7a7068]) });
  if (h > 55) blinkers.push(cx, h + 1.3, cz);
}
for (const k of ["L", "R", "F", "B"]) addMesh(near[k].build("aCol"), matNear, "Ciudad" + k);
far.forEach((g, i) => addMesh(g.build("aCol"), matFar, "Horizonte" + i));
addMesh(awnings.build(), propMat, "Toldos");
// carteles de los locales (un atlas, una llamada)
const signTex = A.canvasTex(1024, 1024, (g, w, h) => {
  const PAL = [["#1a0f08", "#ffd27a"], ["#0d3a1f", "#9dffb0"], ["#2a0b0b", "#ff7a5a"], ["#101826", "#ffe6a6"], ["#2b1a0e", "#ffcf8a"], ["#0b1e2e", "#8fd8ff"]];
  g.textAlign = "center"; g.textBaseline = "middle";
  SHOPS.forEach((t, i) => {
    const y = i * 80, [bg, fg] = PAL[i % PAL.length];
    g.fillStyle = bg; g.fillRect(0, y, w, 76); g.strokeStyle = "rgba(255,255,255,0.25)"; g.lineWidth = 3; g.strokeRect(6, y + 6, w - 12, 64);
    g.shadowColor = fg; g.shadowBlur = 14; g.fillStyle = fg; g.font = `bold 50px ${i % 2 ? "Georgia, serif" : "Arial, sans-serif"}`; g.fillText(t, w / 2, y + 40); g.shadowBlur = 0;
    if (t === "FARMACIA") { g.fillStyle = "#3bff7a"; g.fillRect(70, y + 18, 40, 40); g.fillStyle = bg; g.fillRect(70, y + 18, 12, 12); g.fillRect(98, y + 18, 12, 12); g.fillRect(70, y + 46, 12, 12); g.fillRect(98, y + 46, 12, 12); }
  });
});
const signMat = new T.MeshBasicMaterial({ map: signTex, toneMapped: false });
{
  const sg = new Geo(), white = new T.Color(1, 1, 1);
  for (const s of signs) {
    const v0 = 1 - (s.slot * 80 + 76) / 1024, v1 = 1 - (s.slot * 80) / 1024, hw = s.w / 2, hh = 0.32, c = Math.cos(s.ry), sn = Math.sin(s.ry);
    const P = (dx, dy) => [s.x + dx * c, s.y + dy, s.z - dx * sn];
    sg.quad(P(-hw, -hh), P(hw, -hh), P(hw, hh), P(-hw, hh), [sn, 0, c], white, [[0, v0], [1, v0], [1, v1], [0, v1]]);
  }
  addMesh(sg.build(), signMat, "Carteles");
}
// balizas rojas de las torres altas (titilan)
const blinkMat = new T.PointsMaterial({ map: radialTex, color: 0xff2a1a, size: 2.6, sizeAttenuation: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, fog: false });
if (blinkers.length) { const bg = new T.BufferGeometry(); bg.setAttribute("position", new T.Float32BufferAttribute(blinkers, 3)); const bp = new T.Points(bg, blinkMat); bp.name = "Balizas"; scene.add(bp); }

// =====================================================================
// 4. CALLE: cordones, faroles, plantas, parada, tapas y la fachada del casino
// =====================================================================
const props = new Geo(), glow = new Geo(), pools = [...shopPools], halos = [];
const C = { granite: lin(0x9a968e), graniteTop: lin(0xb5b0a6), pole: lin(0x1d2622), dark: lin(0x15171a), lamp: lin(0xffd9a0), planter: lin(0x6a5e52), earth: lin(0x2a1d14), metal: lin(0x3a3d42) };
// cordones (granito) de las dos veredas
props.box(-55, 55, -0.02, 0.07, -17.0, -16.72, C.granite, { faces: "pz nz py", top: C.graniteTop });
props.box(-55, 55, -0.02, 0.07, -24.08, -23.82, C.granite, { faces: "pz nz py", top: C.graniteTop });
props.box(-55, 55, 0.0, 0.035, -28.25, -28.0, lin(0x6a665e), { faces: "pz py" });
// tapas de cloacas y rejillas de desagüe
const cylG = new T.CylinderGeometry(0.36, 0.36, 0.02, 14);
for (const [x, z] of [[-12, -20.0], [18, -21.2], [-30, -21.0], [33, -19.8]]) props.mesh(cylG, M4(x, 0.008, z), lin(0x26282b));
for (const x of [-27, -9, 13, 29]) props.box(x - 0.45, x + 0.45, 0.0, 0.012, -17.35, -17.05, lin(0x141516), { faces: "py" });
// faroles: poste con base, brazo hacia la calle y farol con el vidrio encendido
const poleG = new T.CylinderGeometry(0.05, 0.075, 4.6, 8), baseG = new T.CylinderGeometry(0.13, 0.17, 0.6, 8), capG = new T.CylinderGeometry(0.02, 0.09, 0.12, 8);
const lampSpots = [];
for (const x of [-44, -32, -20, -8, 8, 20, 32, 44]) lampSpots.push({ x, z: -16.45, dir: -1 });
for (const x of [-46, -32, -18, 18, 32, 46]) lampSpots.push({ x, z: -24.35, dir: 1 });
for (const L of lampSpots) {
  const { x, z, dir } = L, ax = z + dir * 1.15;
  props.mesh(baseG, M4(x, 0.3, z), C.pole); props.mesh(poleG, M4(x, 2.3, z), C.pole);
  props.box(x - 0.035, x + 0.035, 4.5, 4.57, Math.min(z, ax), Math.max(z, ax), C.pole, { faces: "px nx py ny pz nz" });
  props.box(x - 0.2, x + 0.2, 4.36, 4.52, ax - 0.32, ax + 0.32, C.dark, { faces: "px nx py pz nz" });
  props.mesh(capG, M4(x, 4.6, ax), C.dark);
  glow.box(x - 0.17, x + 0.17, 4.3, 4.36, ax - 0.28, ax + 0.28, C.lamp, { faces: "ny px nx pz nz" });
  halos.push(x, 4.25, ax);
  pools.push({ x, z: ax, r: 4.6, color: 0xffc27a, k: 0.6 });
  if (G.boxAt) G.boxAt(x, z, 0.3, 0.3, "wall");
}
// canteros con palmeras/árboles y bancos (los modelos llegan cuando carga el .glb: ver loadProps)
const PLANTERS = [{ x: -38, z: -16.15, kind: "palm" }, { x: -26, z: -16.15, kind: "tree" }, { x: 14, z: -16.15, kind: "palm" }, { x: 26, z: -16.15, kind: "tree" }, { x: 38, z: -16.15, kind: "palm" },
  { x: -40, z: -24.75, kind: "tree" }, { x: -25, z: -24.75, kind: "palm" }, { x: 25, z: -24.75, kind: "palm" }, { x: 40, z: -24.75, kind: "tree" }, { x: -14, z: -16.15, kind: "palm" }];
for (const p of PLANTERS) {
  props.box(p.x - 0.55, p.x + 0.55, 0, 0.42, p.z - 0.55, p.z + 0.55, C.planter, { faces: "px nx pz nz py", top: C.earth });
  if (G.boxAt) G.boxAt(p.x, p.z, 1.1, 1.1, "wall");
}
const BENCHES = [{ x: -35.5, z: -15.6, ry: Math.PI }, { x: 23.5, z: -15.6, ry: Math.PI }, { x: 41, z: -15.6, ry: Math.PI }, { x: -22.4, z: -25.3, ry: 0 }, { x: 37.5, z: -25.3, ry: 0 }];
// parada de colectivo en la vereda de enfrente: techo, postes, vidrio de atrás y una publicidad que se ilumina
const BUS = { x: -30, z: -25.6 };
{
  const { x, z } = BUS;
  for (const dx of [-1.6, 1.6]) props.box(x + dx - 0.04, x + dx + 0.04, 0, 2.5, z - 0.75, z - 0.67, C.metal, { faces: "px nx pz nz" });
  props.box(x - 1.8, x + 1.8, 2.5, 2.6, z - 0.85, z + 0.65, lin(0x2c3034), { faces: "px nx py pz nz ny" });
  props.box(x - 1.6, x + 1.6, 0.3, 2.4, z - 0.73, z - 0.7, lin(0x31404a), { faces: "pz nz" });
  props.box(x - 1.3, x + 1.3, 0.42, 0.47, z - 0.62, z - 0.3, lin(0x5a4a3a), { faces: "py pz" });
  props.box(x + 1.75, x + 1.95, 0, 2.4, z - 0.4, z - 0.1, C.metal, { faces: "px nx pz nz" });
  if (G.boxAt) G.boxAt(x, z - 0.6, 3.6, 0.3, "wall");
}
const adTex = A.canvasTex(256, 384, (g, w, h) => { // la publicidad de la parada: el propio casino
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#2a0a12"); gr.addColorStop(1, "#0b0406"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.textAlign = "center"; g.fillStyle = "#ffd774"; g.shadowColor = "#ffb84a"; g.shadowBlur = 16; g.font = "bold 44px Georgia, serif"; g.fillText("CASINO", w / 2, 120); g.fillText("DORADO", w / 2, 170);
  g.shadowBlur = 0; g.fillStyle = "#f3e9d2"; g.font = "22px Arial, sans-serif"; g.fillText("La suerte está", w / 2, 250); g.fillText("cruzando la calle", w / 2, 278);
  g.fillStyle = "#d9a84a"; g.fillRect(40, 300, w - 80, 3); g.font = "bold 20px Arial, sans-serif"; g.fillText("ABIERTO TODA LA NOCHE", w / 2, 340);
});
const adMat = new T.MeshBasicMaterial({ map: adTex, toneMapped: false });
{ const ad = new T.Mesh(new T.PlaneGeometry(1.1, 1.65), adMat); ad.position.set(BUS.x + 1.85, 1.35, BUS.z - 0.25); ad.rotation.y = Math.PI / 2; ad.matrixAutoUpdate = false; ad.updateMatrix(); scene.add(ad);
  const ad2 = ad.clone(); ad2.rotation.y = -Math.PI / 2; ad2.position.x = BUS.x + 1.85 - 0.01 - 0.2; ad2.updateMatrix(); scene.add(ad2); }
pools.push({ x: BUS.x + 2.2, z: BUS.z - 0.2, r: 1.6, color: 0xff9a7a, k: 0.35 });

// --- El Faraón (game.js arma el edificio y el cartel): pirámide dorada en el techo y dos obeliscos en la puerta ---
{
  const sand = lin(0xc9a45a), sandD = lin(0x9a7a3a), RZ = -33;
  props.mesh(new T.ConeGeometry(6.2, 5.2, 4, 1), M4(0, 9.15 + 2.6, RZ, Math.PI / 4), sand);
  props.box(-6.6, 6.6, 9.0, 9.2, RZ - 6.6, RZ + 6.6, sandD, { faces: "px nx pz nz py" });
  glow.mesh(new T.ConeGeometry(0.75, 0.7, 4, 1), M4(0, 9.15 + 5.2 - 0.3, RZ, Math.PI / 4), lin(0xffd36a));
  halos.push(0, 14.3, RZ);
  for (const x of [-3.15, 3.15]) { // a los lados de la puerta (a la izquierda está el cartel de la ruta de owner.js)
    props.box(x - 0.45, x + 0.45, 0, 0.6, -26.85, -25.95, sandD, { faces: "px nx pz nz py" });
    props.mesh(new T.CylinderGeometry(0.22, 0.38, 5.4, 4, 1), M4(x, 0.6 + 2.7, -26.4, Math.PI / 4), sand);
    glow.mesh(new T.ConeGeometry(0.26, 0.45, 4, 1), M4(x, 0.6 + 5.4 + 0.22, -26.4, Math.PI / 4), lin(0xffd36a));
    if (G.boxAt) G.boxAt(x, -26.4, 0.9, 0.9, "wall");
  }
}
// --- la fachada del casino: zócalo, revoque con buña, pilastras, cornisa, ático, ventanas con cortinas, apliques ---
const stuccoTex = A.canvasTex(256, 256, (g, w, h) => { // 2 m × 2 m de revoque símil piedra con buñas horizontales
  g.fillStyle = "#d8c29a"; g.fillRect(0, 0, w, h);
  noise(g, 0, 0, w, h, 4000, "rgba(120,95,60,0.10)"); noise(g, 0, 0, w, h, 1500, "rgba(255,245,220,0.10)");
  for (let y = 0; y < h; y += 32) { g.fillStyle = "rgba(70,50,28,0.42)"; g.fillRect(0, y, w, 3); g.fillStyle = "rgba(255,240,210,0.25)"; g.fillRect(0, y + 3, w, 1); }
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(60,45,30,0.12)"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
stuccoTex.wrapS = stuccoTex.wrapT = T.RepeatWrapping;
const stuccoMat = new LitMat({ map: stuccoTex, roughness: 0.92 });
const curtainTex = A.canvasTex(128, 256, (g, w, h) => { // ventana del salón vista de afuera: luz cálida y cortinas de terciopelo
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#ffcf7a"); gr.addColorStop(0.5, "#e8953e"); gr.addColorStop(1, "#7a3a18"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = "rgba(255,240,200,0.5)"; g.beginPath(); g.ellipse(w / 2, 40, 16, 10, 0, 0, Math.PI * 2); g.fill(); // araña
  for (const sd of [0, 1]) {
    for (let i = 0; i < 6; i++) { const x = sd ? w - 46 + i * 8 : i * 8; g.fillStyle = i % 2 ? "#5a0f1a" : "#7c1826"; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 8, 0); g.lineTo(x + 8 + (sd ? 6 : -2), h); g.lineTo(x + (sd ? 6 : -6), h); g.fill(); }
  }
  g.fillStyle = "#4a0a14"; g.fillRect(0, 0, w, 26); for (let x = 0; x < w; x += 16) { g.beginPath(); g.arc(x + 8, 26, 8, 0, Math.PI); g.fill(); }
  g.fillStyle = "#d9a84a"; g.fillRect(0, 24, w, 3); g.fillRect(10, 150, 30, 4); g.fillRect(w - 40, 150, 30, 4);
  g.strokeStyle = "rgba(30,15,5,0.85)"; g.lineWidth = 4; g.beginPath(); g.moveTo(w / 2, 26); g.lineTo(w / 2, h); g.moveTo(46, 150); g.lineTo(w - 46, 150); g.stroke(); // parteluces
});
const curtainMat = new T.MeshBasicMaterial({ map: curtainTex, toneMapped: false });
// el ala oeste va en mallas aparte: cuando se construye el hotel (world.js) su recepción, ascensor y torre ocupan
// esa pared, así que ahí vuelve la pared original
const E = { P: new Geo(), S: new Geo(), W: new Geo(), L: new Geo() }, Wst = { P: new Geo(), S: new Geo(), W: new Geo(), L: new Geo() };
const ZW = -10.15, ZF = -10.3; // cara de la pared y frente del revestimiento
const cream = lin(0xe8dcc0), creamD = lin(0xcbb994), creamL = lin(0xeee4cc), granite = lin(0x3a3634), bronze = lin(0x5a4426), white = new T.Color(1, 1, 1);
for (const [xa, xb] of [[-22.2, -7.05], [7.05, 22.2]]) {
  const K = xa < 0 ? Wst : E;
  K.P.box(xa, xb, 0, 0.62, ZF - 0.05, ZW, granite, { faces: "nz py", top: lin(0x55504c) }); // zócalo de granito
  K.S.box(xa, xb, 0.62, 3.5, ZF, ZW, cream, { faces: "nz" });                               // revoque con buña
  K.P.box(xa, xb, 3.42, 3.62, ZF - 0.32, ZW, cream, { faces: "nz py ny px nx" });            // cornisa
  K.P.box(xa, xb, 3.62, 3.7, ZF - 0.22, ZW, creamD, { faces: "nz py" });
  K.S.box(xa, xb, 3.7, 4.55, ZF + 0.05, ZW, cream, { faces: "nz" });                        // ático
  K.P.box(xa, xb, 3.7, 4.55, ZF + 0.05, ZW + 0.3, cream, { faces: "py px nx" });
  K.P.box(xa - 0.05, xb + 0.05, 4.55, 4.72, ZF - 0.12, ZW + 0.3, creamD, { faces: "nz py ny px nx" });
  for (let x = xa + 0.9; x < xb - 0.9; x += 1.8) K.P.box(x - 0.6, x + 0.6, 3.85, 4.4, ZF - 0.02, ZF + 0.05, creamD, { faces: "nz py ny px nx" }); // paneles del ático
  const n = 4, step = (xb - xa) / n;
  for (let i = 0; i <= n; i++) { // pilastras con base y capitel
    const x = xa + i * step;
    K.P.box(x - 0.24, x + 0.24, 0.62, 3.42, ZF - 0.13, ZF, creamL, { faces: "nz px nx" });
    K.P.box(x - 0.31, x + 0.31, 3.2, 3.42, ZF - 0.19, ZF, creamD, { faces: "nz px nx ny" });
    K.P.box(x - 0.3, x + 0.3, 0.62, 0.8, ZF - 0.17, ZF, lin(0x6a625a), { faces: "nz px nx py" });
    if (i % 2 === 1) { // aplique de bronce con vidrio encendido
      K.L.box(x - 0.09, x + 0.09, 2.45, 2.75, ZF - 0.3, ZF - 0.16, lin(0xffe0a8), { faces: "nz px nx py ny" });
      K.P.box(x - 0.11, x + 0.11, 2.38, 2.45, ZF - 0.32, ZF - 0.13, bronze, { faces: "nz px nx py ny" });
      halos.push(x, 2.6, ZF - 0.32); pools.push({ x, z: ZF - 0.9, r: 1.6, color: 0xffcf8a, k: 0.45 });
    }
    if (i < n) { // ventana del salón en el paño: cortinas de terciopelo con la luz de adentro
      const cx = x + step / 2, ww = Math.min(1.7, step - 1.0);
      K.W.quad([cx + ww / 2, 1.05, ZF - 0.02], [cx - ww / 2, 1.05, ZF - 0.02], [cx - ww / 2, 3.0, ZF - 0.02], [cx + ww / 2, 3.0, ZF - 0.02], [0, 0, -1], white, [[0, 0], [1, 0], [1, 1], [0, 1]]);
      K.P.box(cx - ww / 2 - 0.1, cx + ww / 2 + 0.1, 0.92, 1.05, ZF - 0.16, ZF, creamL, { faces: "nz py px nx" }); // alféizar
      K.P.box(cx - ww / 2 - 0.08, cx + ww / 2 + 0.08, 3.0, 3.1, ZF - 0.1, ZF, bronze, { faces: "nz ny" });
      K.P.box(cx - ww / 2 - 0.08, cx - ww / 2, 1.05, 3.0, ZF - 0.1, ZF, bronze, { faces: "nz px" });
      K.P.box(cx + ww / 2, cx + ww / 2 + 0.08, 1.05, 3.0, ZF - 0.1, ZF, bronze, { faces: "nz nx" });
      K.P.box(cx - 0.18, cx + 0.18, 3.1, 3.32, ZF - 0.12, ZF, creamD, { faces: "nz px nx" }); // clave
      pools.push({ x: cx, z: ZF - 1.1, rx: ww * 0.7, rz: 1.1, color: 0xffa860, k: 0.32 });
    }
  }
}
// sobre la puerta (detrás del cartel) también sigue el ático
E.S.box(-7.05, 7.05, 3.5, 4.55, ZF + 0.05, ZW, cream, { faces: "nz" });
E.P.box(-7.1, 7.1, 4.55, 4.72, ZF - 0.12, ZW, creamD, { faces: "nz py ny" });
for (const g of [E.S, Wst.S]) for (let k = 0; k < g.uv.length; k += 2) { g.uv[k] /= 2; g.uv[k + 1] /= 2; } // baldosa de revoque de 2 m
function facadeMeshes(K, tag) { return [addMesh(K.P.build(), propMat, "Fachada" + tag), addMesh(K.S.build(), stuccoMat, "Revoque" + tag), addMesh(K.W.build(), curtainMat, "Ventanas" + tag), addMesh(K.L.build(), glowMat, "Apliques" + tag)]; }
facadeMeshes(E, "Este");
const westParts = facadeMeshes(Wst, "Oeste");

// =====================================================================
// 5. MODELOS KENNEY (autos, palmeras, árboles, bancos): js/props-assets.js
// =====================================================================
const LIB = {}; let libReady = false; const waiting = [];
const CAR_SCALE = [1, 0.86, 0.8]; // los autos de Kenney son petisos y anchos: se afinan un poco (largo, alto, ancho)
const PAINTS = [0x8e1f26, 0x1f3a5f, 0xd8d8d2, 0x232529, 0x7a7d82, 0x2f5a3a, 0xb8a27a, 0x4a2a5a, 0x9a3a1a, 0x5d6b78];
function readRole(mesh, nodeScale, carLike) {
  const g = mesh.geometry, P = g.attributes.position, N = g.attributes.normal, Cc = g.attributes.color;
  const div = a => a.normalized ? (a.array instanceof Int16Array ? 32767 : a.array instanceof Int8Array ? 127 : a.array instanceof Uint8Array ? 255 : a.array instanceof Uint16Array ? 65535 : 1) : 1;
  const arr = a => a.isInterleavedBufferAttribute ? a.data.array : a.array;
  const dp = div({ normalized: P.normalized, array: arr(P) }), dn = div({ normalized: N.normalized, array: arr(N) }), dc = Cc ? div({ normalized: Cc.normalized, array: arr(Cc) }) : 1, n = P.count, sc = carLike ? CAR_SCALE : [1, 1, 1];
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = Cc ? new Float32Array(n * 3) : null;
  for (let k = 0; k < n; k++) { // getX lee bien también los atributos intercalados (sin normalizar en r128: se divide a mano)
    pos[k * 3] = P.getX(k) / dp * nodeScale * sc[0]; pos[k * 3 + 1] = P.getY(k) / dp * nodeScale * sc[1]; pos[k * 3 + 2] = P.getZ(k) / dp * nodeScale * sc[2];
    let nx = N.getX(k) / dn / sc[0], ny = N.getY(k) / dn / sc[1], nz = N.getZ(k) / dn / sc[2]; const l = Math.hypot(nx, ny, nz) || 1;
    nor[k * 3] = nx / l; nor[k * 3 + 1] = ny / l; nor[k * 3 + 2] = nz / l;
    if (col) { col[k * 3] = Cc.getX(k) / dc; col[k * 3 + 1] = Cc.getY(k) / dc; col[k * 3 + 2] = Cc.getZ(k) / dc; }
  }
  return { pos, nor, col, idx: g.index ? Array.from(g.index.array) : Array.from({ length: n }, (_, i) => i) };
}
function loadProps() {
  const AS = window.CasinoPropsAssets; if (!AS || !T.GLTFLoader) return;
  const bin = atob(AS.glb), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  new T.GLTFLoader().parse(buf.buffer, "", gltf => {
    gltf.scene.updateMatrixWorld(true);
    for (const node of gltf.scene.children) {
      const id = node.name, roles = {}, carLike = !["bench", "palm", "tree"].includes(id);
      const list = node.isMesh ? [node] : node.children.filter(c => c.isMesh);
      for (const m of list) roles[m.material.name] = readRole(m, node.scale.x, carLike);
      LIB[id] = roles;
    }
    libReady = true; buildProps(); for (const f of waiting.splice(0)) f();
  }, e => console.error("[CasinoExterior] no se pudo leer props-assets", e));
}
// pone un modelo en un armador (body con su color, paint teñido, faros a otro armador)
function putModel(id, m, bodyG, paintG, lightG, paint, lit) {
  const r = LIB[id]; if (!r) return;
  if (r.body) bodyG.raw(r.body, m);
  if (r.paint) paintG.raw(r.paint, m, lin(paint));
  if (r.beacon) paintG.raw(r.beacon, m, lin(0x1f4fa8)); // franja azul del patrullero
  if (lightG) { if (r.front) lightG.raw(r.front, m, lit ? lin(0xfff4dc) : lin(0x8a8a80)); if (r.back) lightG.raw(r.back, m, lit ? lin(0xff2a18) : lin(0x6a1410)); }
}
const PARKED = [{ x: -46, id: "van" }, { x: -39.5, id: "sedan" }, { x: -24, id: "hatch" }, { x: -17.5, id: "taxi" }, { x: -11.2, id: "suvlux" }, { x: 14.5, id: "sedan" }, { x: 21, id: "hatch" }, { x: 33, id: "suvlux" }, { x: 39.5, id: "taxi" }, { x: 47, id: "sedan" }];
function buildProps() {
  const body = new Geo(), paint = new Geo(), lights = new Geo();
  for (const p of PARKED) {
    const ry = Math.PI + rr(-0.03, 0.03), m = M4(p.x, 0, -22.95 + rr(-0.08, 0.08), ry);
    putModel(p.id, m, body, paint, lights, p.id === "taxi" ? 0xf2c21a : pick(PAINTS), false);
    if (G.boxAt) G.boxAt(p.x, -22.95, 4.4, 2.0, "wall");
  }
  for (const p of PLANTERS) putModel(p.kind, M4(p.x, 0.42, p.z, rr(0, 6.28), p.kind === "palm" ? rr(0.85, 1.05) : rr(0.9, 1.1)), body, paint, null);
  for (const b of BENCHES) { putModel("bench", M4(b.x, 0, b.z, b.ry, 1.25), body, paint, null); if (G.boxAt) G.boxAt(b.x, b.z, 1.6, 0.7, "wall"); }
  addMesh(body.build(), propMat, "PropsKenney"); addMesh(paint.build(), paintMat, "ChapaAutos"); addMesh(lights.build(), glowMat, "FarosEstacionados");
}
// auto suelto (tránsito, patrullero, la Mafia): grupo con chapa, cuerpo y faros. opts: { paint, lit, red, blue }
const carCache = new Map(); // geometrías por modelo+color: los autos que van y vienen las comparten (nada que liberar)
function carGeos(id, paintHex, lit) {
  const key = id + "|" + paintHex + "|" + lit;
  if (!carCache.has(key)) {
    const body = new Geo(), paint = new Geo(), lights = new Geo();
    putModel(id, new T.Matrix4(), body, paint, lights, paintHex, lit);
    carCache.set(key, [body.build(), paint.build(), lights.build()]);
  }
  return carCache.get(key);
}
function carGroup(id, opts) {
  if (!libReady || !LIB[id]) return null;
  opts = opts || {};
  const g = new T.Group(), I = new T.Matrix4(), cg = carGeos(id, opts.paint != null ? opts.paint : pick(PAINTS), opts.lit !== false);
  g.add(new T.Mesh(cg[0], propMat), new T.Mesh(cg[1], paintMat), new T.Mesh(cg[2], glowMat));
  if ((opts.red || opts.blue) && !carCache.has(id + "|beacon")) {
    // barra de balizas sobre el techo (dos cajas: roja a un lado, azul al otro); combat.js les cambia el color
    let top = 0; for (const k of ["body", "paint"]) { const r = LIB[id][k]; if (r) for (let i = 0; i < r.pos.length; i += 3) if (Math.abs(r.pos[i]) < 0.5 && Math.abs(r.pos[i + 2]) < 0.3) top = Math.max(top, r.pos[i + 1]); }
    const L = new Geo(), R = new Geo(), w = new T.Color(1, 1, 1);
    L.box(-0.32, 0.12, top - 0.02, top + 0.14, -0.62, -0.04, w, { faces: "px nx py pz nz" }); R.box(-0.32, 0.12, top - 0.02, top + 0.14, 0.04, 0.62, w, { faces: "px nx py pz nz" });
    carCache.set(id + "|beacon", [L.build(), R.build()]);
  }
  const bk = carCache.get(id + "|beacon");
  if (bk && (opts.red || opts.blue)) { if (bk[0]) g.add(new T.Mesh(bk[0], opts.red || opts.blue)); if (bk[1]) g.add(new T.Mesh(bk[1], opts.blue || opts.red)); }
  return g;
}
loadProps();

// --- brillos de la calle: faroles, apliques (MeshBasic), halos (puntos) y charcos de luz pintados en el piso ---
addMesh(props.build(), propMat, "Calle");
const glowMesh = addMesh(glow.build(), glowMat, "Faroles");
const haloGeo = new T.BufferGeometry(); haloGeo.setAttribute("position", new T.Float32BufferAttribute(halos, 3));
haloGeo.setAttribute("color", new T.Float32BufferAttribute(halos.map((v, i) => [1, 0.78, 0.5][i % 3]), 3));
const haloPts = new T.Points(haloGeo, haloMat); haloPts.name = "Halos"; scene.add(haloPts);
{
  const pg = new Geo();
  for (const p of pools) {
    const rx = p.rx || p.r, rz = p.rz || p.r, y = 0.035, c = lin(p.color).multiplyScalar(p.k);
    pg.quad([p.x - rx, y, p.z + rz], [p.x + rx, y, p.z + rz], [p.x + rx, y, p.z - rz], [p.x - rx, y, p.z - rz], [0, 1, 0], c, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  }
  const pm = addMesh(pg.build(), poolMat, "CharcosDeLuz"); pm.renderOrder = 2;
}

// =====================================================================
// 6. TRÁNSITO: un auto por vez por el carril del medio (frena si te cruzás), con faros de noche
// =====================================================================
const beamTex = A.canvasTex(128, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, "rgba(255,255,255,0.9)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); const m = g.createLinearGradient(0, 0, 0, h); g.globalCompositeOperation = "destination-in"; m.addColorStop(0, "rgba(0,0,0,0)"); m.addColorStop(0.5, "rgba(0,0,0,1)"); m.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = m; g.fillRect(0, 0, w, h); });
const beamGeo = new T.PlaneGeometry(9, 3.2), beamMat = new T.MeshBasicMaterial({ map: beamTex, color: 0xfff0d0, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4 });
const TRAFFIC = ["sedan", "taxi", "hatch", "suvlux", "van", "sedan", "taxi"], LANE = [{ z: -20.35, dir: -1 }, { z: -20.65, dir: -1 }];
const traffic = { car: null, x: 0, v: 0, dir: -1, z: -20.4, wait: 3, honk: 0, beam: null };
function eventsOnStreet() {
  try {
    const cb = window.CasinoCombat, ow = window.CasinoOwner, sh = window.CasinoShop;
    if (cb && (cb.police || (cb.debug && cb.debug.mafia))) return true;
    const hz = ow && ow.debug && ow.debug.heist; if (hz && hz.phase && hz.phase !== "done") return true;
    const tk = sh && sh.debug && sh.debug.truck; if (tk && tk.state !== "idle") return true;
  } catch (e) { /* sin datos: que pase igual */ }
  return false;
}
function trafficTick(dt, night) {
  const t = traffic;
  if (!t.car) {
    t.wait -= dt; if (t.wait > 0 || !libReady || eventsOnStreet()) return;
    const id = pick(TRAFFIC); t.car = carGroup(id, { paint: id === "taxi" ? 0xf2c21a : pick(PAINTS) }); if (!t.car) return;
    t.dir = rnd() < 0.5 ? -1 : 1; t.z = t.dir < 0 ? -21.3 : -19.6; t.x = -t.dir * 62; t.v = rr(8, 11);
    t.car.rotation.y = t.dir < 0 ? Math.PI : 0;
    t.beam = new T.Mesh(beamGeo, beamMat); t.beam.rotation.x = -Math.PI / 2; t.beam.position.set(6.5, 0.04, 0); t.beam.renderOrder = 2; t.car.add(t.beam);
    scene.add(t.car);
  }
  // frena si el jugador (o alguien parado) está adelante en su carril
  const P = G.player, ahead = P && Math.abs(P.z - t.z) < 1.9 && (P.x - t.x) * t.dir > 0 && (P.x - t.x) * t.dir < 9;
  const target = ahead ? 0 : 10;
  t.v += clamp(target - t.v, -14 * dt, 4 * dt);
  if (ahead && t.v < 2 && t.honk <= 0) { t.honk = 4; if (G.sfx) G.sfx("horn", t.x, t.z); }
  t.honk -= dt;
  t.x += t.v * t.dir * dt; t.car.position.set(t.x, 0, t.z);
  if (Math.abs(t.x) > 64) { scene.remove(t.car); t.car = null; t.wait = rr(3, 11); }
}

// =====================================================================
// CADA CUADRO: world.js llama a sky() con el color del cielo ya calculado (clima, relámpago)
// =====================================================================
const KZ = [[7.0, 0x3c4f78], [8.0, 0x5a7cb8], [9.5, 0x2f6fc8], [16.5, 0x2c66bd], [18.6, 0x2a3c78], [19.6, 0x141c44], [20.6, 0x060b1e], [24.1, 0x03060f]]; // cenit por hora
const GREY = { sunny: 0, cloudy: 0.5, rain: 0.72, storm: 0.86, heat: 0 };
const cTop = new T.Color(), cTmp = new T.Color(), cG = new T.Color();
let time = 0, lastNight = -1, hotelShown = null;
function sky(cSky, hour, real, wx, flash) {
  real = real || 0; time += real;
  const grey = GREY[wx] || 0;
  // horizonte = el mismo color que la niebla (así los edificios lejanos se funden con el cielo)
  U.uHor.value.copy(cSky).multiplyScalar(0.92);
  let i = 0; while (i < KZ.length - 2 && hour >= KZ[i + 1][0]) i++;
  const a = KZ[i], b = KZ[i + 1], k = clamp((hour - a[0]) / (b[0] - a[0]), 0, 1);
  cTop.set(a[1]).lerp(cTmp.set(b[1]), k);
  if (grey) { const l = cTop.r * 0.3 + cTop.g * 0.55 + cTop.b * 0.15; cTop.lerp(cG.setRGB(l * 0.95, l * 0.97, l * 1.02), grey); }
  if (flash > 0) cTop.lerp(cG.setRGB(0.75, 0.8, 1), flash * 0.6);
  U.uTop.value.copy(cTop);
  const dusk = Math.exp(-Math.pow((hour - 18.7) / 0.9, 2)) + Math.exp(-Math.pow((hour - 8.0) / 0.6, 2)) * 0.6;
  U.uGlowK.value = dusk * (1 - grey * 0.8) * 0.9;
  const night = Math.max(smooth(17.9, 20.4, hour), 1 - smooth(7.4, 8.9, hour));
  U.uNight.value = night; U.uLit.value = 0.12 + 0.5 * night + grey * 0.12;
  // la luz de la ciudad copia la de la escena (hemisferio y luna/sol de world.js)
  const h = G.hemi, mo = G.moon;
  if (h) { U.uHemiSky.value.copy(h.color).multiplyScalar(h.intensity); U.uHemiGround.value.copy(h.groundColor).multiplyScalar(h.intensity); }
  if (mo) { U.uSunCol.value.copy(mo.color).multiplyScalar(mo.intensity); U.uSunDir.value.copy(mo.position).normalize(); }
  const fog = scene.fog; if (fog) { U.uFarA.value = fog.near * 1.6; U.uFarB.value = Math.max(fog.far * 3.2, fog.near * 1.6 + 40); U.uFarK.value = 0.55 + grey * 0.4; }
  // estrellas y luna solo con cielo despejado
  const clear = 1 - smooth(0.2, 0.55, grey);
  starMat.uniforms.uA.value = smooth(0.55, 1, night) * clear; starMat.uniforms.uT.value = time;
  starMat.uniforms.uPx.value = (renderer() ? renderer().getPixelRatio() : 1);
  stars.visible = starMat.uniforms.uA.value > 0.01;
  moon.material.opacity = smooth(0.4, 1, night) * clear; moon.visible = moon.material.opacity > 0.01;
  // brillos: de día los faroles apagados (grises), de noche encendidos
  const on = Math.max(smooth(0.25, 0.7, night), grey > 0.6 ? 0.6 : 0);
  glowMat.color.setScalar(0.35 + 0.75 * on);
  poolMat.opacity = on * 0.85; poolMat.visible = on > 0.02;
  haloMat.opacity = on * 0.95; haloMat.visible = on > 0.02;
  curtainMat.color.setScalar(0.42 + 0.68 * on); signMat.color.setScalar(0.7 + 0.45 * on); adMat.color.setScalar(0.65 + 0.5 * on);
  beamMat.opacity = on * 0.45;
  blinkMat.opacity = (Math.sin(time * 3.1) > 0.2 ? 1 : 0.12) * (0.4 + 0.6 * night);
  const cam = G.camera; if (cam) {
    dome.position.set(cam.position.x, 0, cam.position.z); stars.position.copy(dome.position);
    moon.position.copy(MOON_DIR).multiplyScalar(150).add(dome.position); moon.lookAt(cam.position);
  }
  // el ático y las ventanas del ala oeste se esconden cuando está la torre del hotel (world.js)
  const hb = !!(window.CasinoWorld && window.CasinoWorld.debug && G.S && G.S.world && G.S.world.hotel && G.S.world.hotel.built);
  if (hb !== hotelShown) { hotelShown = hb; for (const m of westParts) m.visible = !hb; }
  trafficTick(Math.min(real, 0.1), night);
}

window.CasinoExterior = {
  sky,
  // combat.js: patrullero y auto de la Mafia con los modelos de Kenney (null si todavía no cargaron)
  car: (id, opts) => carGroup(id, opts),
  get ready() { return libReady; },
  onReady(f) { if (libReady) f(); else waiting.push(f); },
  debug: { U, get traffic() { return { on: !!traffic.car, x: traffic.x, v: traffic.v }; }, LIB, dome, stars, moon },
};
})();
