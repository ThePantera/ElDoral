// perf.js · Materiales rápidos (v2)
// Lo que más pesa en la placa de video es el material PBR (MeshStandardMaterial) calculando las 8 luces en cada píxel.
// Salvo en Gráficos "Alta", todo MeshStandardMaterial se crea como un material Lambert (luz por vértice): se ve casi igual
// en este estilo low poly y dibuja el salón 2 a 3 veces más rápido. Se carga después de three.min.js y antes que el resto,
// así cada módulo crea sus materiales ya con el tipo elegido. Cambiar entre "Alta" y las otras calidades (o entrar y salir
// de "Baja", que además apaga el suavizado de bordes) recarga la página.
(function () {
  "use strict";
  const GFX_KEY = "casino-dorado-graficos-v1";
  const METAL_DARKEN = 0.55; // el metal PBR sin reflejos se ve más oscuro: se oscurece el color en proporción
  const TESS_STEP = 1.5;     // metros por segmento en paredes y pisos grandes (la luz por vértice necesita vértices)
  const TESS_MAX = 40;       // tope de segmentos por lado (el pasto y la calle de afuera miden 110 m)

  let mode = "auto";
  try { const g = JSON.parse(localStorage.getItem(GFX_KEY) || "{}"); if (typeof g.mode === "string") mode = g.mode; } catch (e) {}
  const fast = mode !== "alta";
  const antialias = mode !== "baja"; // el suavizado de bordes también se elige al crear el renderer (game.js)

  const PBR_ONLY = ["roughness", "metalness", "roughnessMap", "metalnessMap", "envMapIntensity", "normalMap", "normalScale", "bumpMap", "bumpScale", "flatShading", "displacementMap"];
  const StdMaterial = THREE.MeshStandardMaterial;
  class FastMaterial extends THREE.MeshLambertMaterial {
    constructor(params) {
      const p = Object.assign({}, params || {}), keep = {};
      for (const k of PBR_ONLY) if (k in p) { keep[k] = p[k]; delete p[k]; }
      super(p);
      // quedan como propiedades sueltas: hay código que las cambia (piso mojado en world.js) y no tiene que romperse
      this.roughness = keep.roughness != null ? keep.roughness : 1;
      this.metalness = keep.metalness || 0;
      if (this.metalness > 0) this.color.multiplyScalar(1 - METAL_DARKEN * this.metalness);
    }
    copy(src) { super.copy(src); this.roughness = src.roughness; this.metalness = src.metalness; return this; }
  }
  if (fast) THREE.MeshStandardMaterial = FastMaterial;

  // segmentos para una medida (paredes, pisos): 1 en "Alta", uno cada TESS_STEP metros con materiales rápidos
  function segs(len) { return fast ? Math.min(TESS_MAX, Math.max(1, Math.ceil(len / TESS_STEP))) : 1; }

  window.CasinoPerf = { fast, antialias, mode, segs, StdMaterial, FastMaterial, TESS_STEP };
})();
