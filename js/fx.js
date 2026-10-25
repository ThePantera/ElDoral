// fx.js · Paso 3 del lavado de cara: el brillo de casino
// 1. Halo (bloom) en lo que emite luz: neones, carteles, pantallas, spots del techo, faroles, ventanas de noche.
// 2. En el mismo pase final: viñeta suave y una corrección de color leve (un toque de contraste y calidez).
// 3. Reflejos en los metales (bronce, dorado, cromo, autos): un mapa de entorno chico pintado una sola vez al cargar.
//
// Cómo se mantienen los colores iguales que sin posproceso: el salón se dibuja igual que siempre (tono ACES y salida sRGB
// dentro de cada material, como hace Three r128 también en una textura) pero en una textura del tamaño de la pantalla que
// guarda los valores ya en sRGB (así hasta las transparencias se mezclan igual que en pantalla). El pase final copia esa
// imagen tal cual, le suma el halo y la viñeta. No hay conversión de color en el medio: lo que no brilla queda idéntico.
//
// El halo es selectivo y barato. Selectivo: en la textura, el canal alfa dice qué puede brillar. Los materiales con luz
// (paredes, gente, muebles: todo lo que pasa por el tono ACES) escriben alfa 0; los que no tienen luz ("untoned" de
// game.js: carteles, neones, pantallas, spots, faroles, focos) escriben 1; la ciudad de exterior.js pone 1 solo en las
// ventanas prendidas de noche y el cielo 0. Así una cara o una pared muy iluminada no se "lava" con halo. Barato: se
// calcula a un cuarto de la resolución (Alta: a la mitad) y se desenfoca en mips.
// Gráficos: Alta = todo; Automática y Media = halo a resolución baja + reflejos; Baja = nada (igual que antes).
// En Automática, si después de bajar la resolución sigue lento, game.js apaga el posproceso (setOff).
(function () {
  "use strict";
  const T = THREE, P = window.CasinoPerf || { mode: "auto", fast: true };
  const MODE = P.mode;                       // modo con el que se cargó la página (cambiar Alta/Baja recarga)
  const POST_OK = MODE !== "baja" && !!T.EffectComposer && !!T.UnrealBloomPass;
  const ENV_OK = MODE !== "baja";

  // ---------------------------------------------------------------------------------------------------------------
  // Ajustes (sutiles a propósito)
  // ---------------------------------------------------------------------------------------------------------------
  const BLOOM = {
    threshold: 0.5,  // canal más alto (en sRGB) desde el que algo que puede brillar empieza a brillar
    knee: 0.35,      // rampa suave hasta el brillo pleno
    strength: 1.0,   // cuánto halo se suma
    radius: 0,       // sin mezcla extra: el reparto lo dan los pesos por mip
    factors: [0.5, 0.8, 1.0, 1.2, 1.3], // peso de cada mip (del halo chico al grande); los grandes pierden brillo al
                                         // achicarse, por eso pesan más
    scaleAlta: 0.5,  // resolución del halo respecto de la pantalla
    scaleLow: 0.25,
  };
  const GRADE = { contrast: 1.06, pivot: 0.32, warm: 0.025, sat: 1.04, vignette: 0.32 };
  const ENV = { lambert: 0.9, pbr: 1.0, minMetal: 0.15 }; // fuerza del reflejo por unidad de "metalness"

  // ---------------------------------------------------------------------------------------------------------------
  // Pase de brillo: el filtro de luminancia de Three toma la luminancia (un neón rojo puro no pasaría); acá se usa el
  // canal más alto, con 4 muestras para que un tubo de neón finito no titile al achicar la imagen.
  // ---------------------------------------------------------------------------------------------------------------
  const HIGH_PASS_FRAG = `
    uniform sampler2D tDiffuse; uniform vec2 srcTexel; uniform float luminosityThreshold; uniform float smoothWidth;
    varying vec2 vUv;
    vec3 pick(vec2 uv) {
      vec4 c = texture2D(tDiffuse, uv);
      float m = max(c.r, max(c.g, c.b));
      return c.rgb * c.a * smoothstep(luminosityThreshold, luminosityThreshold + smoothWidth, m);
    }
    void main() {
      vec2 o = srcTexel;
      vec3 a = pick(vUv + vec2(-o.x, -o.y)), b = pick(vUv + vec2(o.x, -o.y)), c = pick(vUv + vec2(-o.x, o.y)), d = pick(vUv + vec2(o.x, o.y));
      // entre el promedio y el máximo: un tubo finito no se pierde al achicar (si no, el halo de un neón quedaba flojo)
      gl_FragColor = vec4(mix((a + b + c + d) * 0.25, max(max(a, b), max(c, d)), 0.65), 1.0);
    }`;

  // UnrealBloomPass de Three, a la resolución que elegimos y sin la mezcla final sobre la imagen (la hace el pase final,
  // así nos ahorramos un pase a pantalla completa).
  class CasinoBloom extends T.UnrealBloomPass {
    constructor(scale) {
      super(new T.Vector2(256, 256), BLOOM.strength, BLOOM.radius, BLOOM.threshold);
      this.scale = scale;
      this.highPassUniforms.srcTexel = { value: new T.Vector2(1 / 1024, 1 / 1024) };
      this.highPassUniforms.smoothWidth.value = BLOOM.knee;
      this.materialHighPassFilter.fragmentShader = HIGH_PASS_FRAG; this.materialHighPassFilter.needsUpdate = true;
      this.compositeMaterial.uniforms.bloomFactors.value = BLOOM.factors;
      this.texture = this.renderTargetsHorizontal[0].texture;
    }
    setSize(w, h) {
      // el UnrealBloomPass arranca a la mitad de lo que recibe: le pasamos el doble de la escala pedida
      super.setSize(Math.max(8, Math.round(w * this.scale * 2)), Math.max(8, Math.round(h * this.scale * 2)));
      // cada píxel del halo junta un bloque de 1/scale píxeles: 4 muestras bilineales lo cubren entero
      const o = Math.max(0.5, 0.25 / this.scale);
      this.highPassUniforms.srcTexel.value.set(o / Math.max(1, w), o / Math.max(1, h));
    }
    render(renderer, writeBuffer, readBuffer) {
      const oldAutoClear = renderer.autoClear; renderer.autoClear = false;
      renderer.getClearColor(this._oldClearColor); this.oldClearAlpha = renderer.getClearAlpha();
      renderer.setClearColor(this.clearColor, 0);
      // 1. lo que brilla
      this.highPassUniforms.tDiffuse.value = readBuffer.texture;
      this.highPassUniforms.luminosityThreshold.value = this.threshold;
      this.fsQuad.material = this.materialHighPassFilter;
      renderer.setRenderTarget(this.renderTargetBright); renderer.clear(); this.fsQuad.render(renderer);
      // 2. desenfoque en mips
      let input = this.renderTargetBright;
      for (let i = 0; i < this.nMips; i++) {
        const m = this.separableBlurMaterials[i]; this.fsQuad.material = m;
        m.uniforms.colorTexture.value = input.texture; m.uniforms.direction.value = T.UnrealBloomPass.BlurDirectionX;
        renderer.setRenderTarget(this.renderTargetsHorizontal[i]); renderer.clear(); this.fsQuad.render(renderer);
        m.uniforms.colorTexture.value = this.renderTargetsHorizontal[i].texture; m.uniforms.direction.value = T.UnrealBloomPass.BlurDirectionY;
        renderer.setRenderTarget(this.renderTargetsVertical[i]); renderer.clear(); this.fsQuad.render(renderer);
        input = this.renderTargetsVertical[i];
      }
      // 3. se juntan los mips (queda en renderTargetsHorizontal[0], que lee el pase final)
      this.fsQuad.material = this.compositeMaterial;
      this.compositeMaterial.uniforms.bloomStrength.value = this.strength;
      this.compositeMaterial.uniforms.bloomRadius.value = this.radius;
      renderer.setRenderTarget(this.renderTargetsHorizontal[0]); renderer.clear(); this.fsQuad.render(renderer);
      renderer.setClearColor(this._oldClearColor, this.oldClearAlpha); renderer.autoClear = oldAutoClear;
    }
  }

  // pase final: imagen + halo, contraste y calidez leves, viñeta. Todo en el mismo espacio sRGB en que quedó la imagen.
  const FinalShader = {
    uniforms: {
      tDiffuse: { value: null }, tBloom: { value: null }, bloomOn: { value: 1 }, aspect: { value: 16 / 9 },
      contrast: { value: GRADE.contrast }, pivot: { value: GRADE.pivot }, warm: { value: GRADE.warm }, sat: { value: GRADE.sat }, vignette: { value: GRADE.vignette },
    },
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform sampler2D tBloom; uniform float bloomOn, aspect, contrast, pivot, warm, sat, vignette;
      varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        // halo: se suma "en pantalla" (screen) para que lo que ya está blanco no se queme
        vec3 b = texture2D(tBloom, vUv).rgb * bloomOn;
        c = c + b * (1.0 - c * 0.6);
        // color: contraste alrededor de un gris oscuro (el salón es oscuro), algo de saturación y calidez
        c = (c - pivot) * contrast + pivot;
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        c = mix(vec3(l), c, sat);
        c *= vec3(1.0 + warm, 1.0 + warm * 0.25, 1.0 - warm);
        // viñeta suave, redonda aunque la pantalla sea ancha
        vec2 d = (vUv - 0.5) * vec2(aspect, 1.0) / max(aspect, 1.0) * 1.4142;
        c *= 1.0 - vignette * smoothstep(0.35, 1.05, dot(d, d));
        gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
      }`,
  };

  // los materiales con luz escriben alfa 0 en la textura del salón (ver arriba). El define lo pone material().
  if (POST_OK) T.ShaderChunk.tonemapping_fragment += "\n#ifdef CASINO_NOGLOW\n\tgl_FragColor.a = 0.0;\n#endif\n#ifdef CASINO_GLOW\n\tgl_FragColor.a = CASINO_GLOW;\n#endif\n";

  let renderer = null, scene = null, camera = null, composer = null, bloom = null, finalPass = null, rt = null;
  const _size = new T.Vector2();
  let off = false;

  function initPost() {
    const gl = renderer.getContext();
    const isGL2 = renderer.capabilities.isWebGL2;
    if (!isGL2) return; // sin WebGL2 no hay suavizado de bordes en texturas: se deja como antes
    renderer.getDrawingBufferSize(_size);
    const pars = { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, depthBuffer: true, stencilBuffer: false };
    const aa = gl.getContextAttributes && gl.getContextAttributes().antialias;
    rt = aa && T.WebGLMultisampleRenderTarget ? new T.WebGLMultisampleRenderTarget(_size.x, _size.y, pars) : new T.WebGLRenderTarget(_size.x, _size.y, pars);
    if (rt.isWebGLMultisampleRenderTarget) rt.samples = 4;
    rt.texture.encoding = T.sRGBEncoding;   // los materiales escriben sRGB (con tono ACES) igual que en pantalla
    rt.texture.generateMipmaps = false;
    composer = new T.EffectComposer(renderer, rt);
    // ningún pase intercambia buffers: todo se dibuja en uno solo (el otro nunca llega a ocupar memoria de video)
    composer.addPass(new T.RenderPass(scene, camera));
    bloom = new CasinoBloom(MODE === "alta" ? BLOOM.scaleAlta : BLOOM.scaleLow);
    composer.addPass(bloom);
    finalPass = new T.ShaderPass(FinalShader);
    finalPass.uniforms.tBloom.value = bloom.texture;
    composer.addPass(finalPass);
    composer.setSize(_size.x, _size.y);
  }

  // -------------------------------------------------------------------------------------------------------------
  // Reflejos: un salón de casino pintado a mano en una textura panorámica (techo oscuro con spots cálidos y arañas,
  // paredes bordó con friso y neones, alfombra oscura con charcos de luz). Se pasa una sola vez a un cubo de 128 px
  // (materiales rápidos/Lambert) y en Alta además a PMREM (PBR con rugosidad).
  // -------------------------------------------------------------------------------------------------------------
  let envCube = null, envPMREM = null;
  function paintEnv() {
    const W = 512, H = 256, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    const glow = (x, y, r, col, a) => {
      for (const dx of [-W, 0, W]) { // repetido a los costados para que no haya costura
        const gr = g.createRadialGradient(x + dx, y, 0, x + dx, y, r);
        gr.addColorStop(0, col.replace("A", a)); gr.addColorStop(0.35, col.replace("A", a * 0.45)); gr.addColorStop(1, col.replace("A", 0));
        g.fillStyle = gr; g.fillRect(x + dx - r, y - r, r * 2, r * 2);
      }
    };
    // techo
    let gr = g.createLinearGradient(0, 0, 0, H * 0.4); gr.addColorStop(0, "#0a0605"); gr.addColorStop(1, "#1c0d0a");
    g.fillStyle = gr; g.fillRect(0, 0, W, H * 0.4);
    // paredes bordó
    gr = g.createLinearGradient(0, H * 0.4, 0, H * 0.62); gr.addColorStop(0, "#3a0d13"); gr.addColorStop(1, "#250810");
    g.fillStyle = gr; g.fillRect(0, H * 0.4, W, H * 0.22);
    // alfombra
    gr = g.createLinearGradient(0, H * 0.62, 0, H); gr.addColorStop(0, "#1e0a0b"); gr.addColorStop(1, "#0a0405");
    g.fillStyle = gr; g.fillRect(0, H * 0.62, W, H * 0.38);
    // friso y pasamanos de bronce
    g.fillStyle = "#8a6428"; g.fillRect(0, H * 0.405, W, 2); g.fillRect(0, H * 0.585, W, 2);
    // spots del techo (más juntos cerca del cenit, como se ven en una panorámica)
    [[0.1, 10], [0.2, 16], [0.31, 22]].forEach(([v, n], k) => { for (let i = 0; i < n; i++) glow((i + 0.5 * (k & 1)) / n * W, v * H, 5 + k, "rgba(255,225,170,A)", 0.95); });
    // arañas
    for (let i = 0; i < 4; i++) glow((i + 0.25) / 4 * W, H * 0.3, 16, "rgba(255,205,130,A)", 0.9);
    // neones y pantallas en las paredes
    const neon = ["rgba(255,60,110,A)", "rgba(255,200,70,A)", "rgba(70,220,255,A)", "rgba(190,90,255,A)", "rgba(255,120,60,A)"];
    for (let i = 0; i < 10; i++) glow((i + 0.5) / 10 * W, H * (0.47 + (i % 3) * 0.025), 9, neon[i % neon.length], 0.75);
    // charcos de luz en la alfombra
    for (let i = 0; i < 5; i++) glow((i + 0.1) / 5 * W, H * 0.8, 26, "rgba(255,170,90,A)", 0.18);
    const tex = new T.CanvasTexture(cv); // perf.js la marca sRGB
    tex.mapping = T.EquirectangularReflectionMapping;
    return tex;
  }
  function initEnv() {
    const eq = paintEnv();
    const cubeRT = new T.WebGLCubeRenderTarget(128, { generateMipmaps: true, minFilter: T.LinearMipmapLinearFilter, magFilter: T.LinearFilter });
    cubeRT.fromEquirectangularTexture(renderer, eq);
    envCube = cubeRT.texture;
    if (!P.fast && T.PMREMGenerator) {
      const pm = new T.PMREMGenerator(renderer);
      envPMREM = pm.fromEquirectangular(eq).texture; pm.dispose();
    }
    eq.dispose();
  }

  // Lambert con reflejo "add", pero teñido con el color del metal (el oro refleja dorado, el cromo blanco).
  const LAMBERT_ENV_FROM = "outgoingLight += envColor.xyz * specularStrength * reflectivity;";
  const LAMBERT_ENV_TO = "vec3 envTint = diffuseColor.rgb / max(max(diffuseColor.r, diffuseColor.g), max(diffuseColor.b, 0.03));\n\t\toutgoingLight += envColor.xyz * envTint * specularStrength * reflectivity;";
  function lambertEnvPatch(shader) {
    shader.fragmentShader = shader.fragmentShader.replace("#include <envmap_fragment>", T.ShaderChunk.envmap_fragment.replace(LAMBERT_ENV_FROM, LAMBERT_ENV_TO));
  }
  const lambertKey = () => "casinoEnvTint";

  // se llama una vez por material nuevo (game.js lo hace al recorrer la escena, junto con untone)
  function material(m) {
    if (!m) return;
    // no brilla: todo material con luz y opaco, salvo que tenga un emisivo fuerte (eso sí es una luz)
    if (POST_OK && m.toneMapped !== false && !m.transparent && !m.isShaderMaterial && !m.isRawShaderMaterial && !m.isPointsMaterial && !(m.defines && "CASINO_NOGLOW" in m.defines)) {
      const e = m.emissive;
      if (!(e && e.r + e.g + e.b > 0.6)) { m.defines = Object.assign({}, m.defines, { CASINO_NOGLOW: "" }); m.needsUpdate = true; }
    }
    // lo transparente (vidrios, charcos de luz, halos pintados, haces) se mezcla igual que antes en color, pero no toca
    // el alfa de abajo: si no, un charco de luz sobre la vereda clara la hacía brillar entera
    if (POST_OK && m.transparent && !m.premultipliedAlpha && (m.blending === T.NormalBlending || m.blending === T.AdditiveBlending)) {
      m.blendSrc = T.SrcAlphaFactor; m.blendDst = m.blending === T.AdditiveBlending ? T.OneFactor : T.OneMinusSrcAlphaFactor; m.blendEquation = T.AddEquation;
      m.blendSrcAlpha = T.ZeroFactor; m.blendDstAlpha = T.OneFactor; m.blendEquationAlpha = T.AddEquation;
      m.blending = T.CustomBlending;
    }
    // brillo parcial para superficies grandes (pantallas, carteles): userData.glow entre 0 y 1
    if (POST_OK && !m.transparent && m.userData.glow != null && !(m.defines && "CASINO_GLOW" in m.defines)) {
      m.defines = Object.assign({}, m.defines, { CASINO_GLOW: (+m.userData.glow).toFixed(3) }); m.needsUpdate = true;
    }
    if (!envCube || !m || m.envMap || m.map || m.transparent || m.userData.noEnv) return;
    const metal = m.metalness || 0;
    if (metal < ENV.minMetal) return;
    if (m.isMeshStandardMaterial && envPMREM) {
      m.envMap = envPMREM; m.envMapIntensity = Math.min(1, ENV.pbr * (0.35 + metal)); m.needsUpdate = true;
    } else if (m.isMeshLambertMaterial) {
      m.envMap = envCube; m.combine = T.AddOperation; m.reflectivity = ENV.lambert * metal * (1.15 - (m.roughness != null ? m.roughness : 0.5) * 0.6);
      m.onBeforeCompile = lambertEnvPatch; m.customProgramCacheKey = lambertKey; m.needsUpdate = true;
    }
  }

  function init(r, s, c) {
    renderer = r; scene = s; camera = c;
    try { if (ENV_OK) initEnv(); } catch (e) { envCube = envPMREM = null; console.warn("fx: sin reflejos", e); }
    try { if (POST_OK) initPost(); } catch (e) { composer = null; console.warn("fx: sin posproceso", e); }
  }

  // dibuja el cuadro; devuelve false si no hay posproceso (game.js dibuja como siempre)
  function render(mode) {
    if (!composer || off || mode === "baja") return false;
    renderer.getDrawingBufferSize(_size);
    if (_size.x !== rt.width || _size.y !== rt.height) composer.setSize(_size.x, _size.y); // resolución dinámica y resize
    finalPass.uniforms.aspect.value = _size.x / Math.max(1, _size.y);
    composer.render(0);
    return true;
  }
  function setOff(v) { off = !!v; }
  function info() { return { post: !!composer, off, env: !!envCube, pbrEnv: !!envPMREM, bloomScale: bloom ? bloom.scale : 0, rt: rt ? [rt.width, rt.height, rt.samples || 0] : null }; }

  window.CasinoFX = { init, render, material, setOff, info, BLOOM, GRADE, ENV, get bloom() { return bloom; }, get finalPass() { return finalPass; } };
})();
