# Créditos y licencia de los personajes

## El modelo

Las personas del juego (clientes, personal, ladrones, inspector, policía, la Mafia, el doble del dueño en el espejo) usan el
personaje **"characterMedium" de Kenney** (pack *Animated Characters*, <https://kenney.nl>).

- **Autor:** Kenney (www.kenney.nl).
- **Licencia:** **CC0 1.0 Universal (dominio público)**, <https://creativecommons.org/publicdomain/zero/1.0/>.
  Se puede usar, modificar y distribuir, también con fines comerciales, sin pedir permiso ni dar crédito.
  Igual lo dejamos acá por gentileza (y Kenney acepta donaciones: <https://www.patreon.com/kenney>).
- **De dónde se bajó:** repo público `pmndrs/market-assets` (GitHub), carpetas `files/models/male`,
  `survivor-male`, `survivor-female` y `skater-male`. Cada `info.json` dice `"creator": "kenney"` y `"license": 1`.
  En el sitio de ese repo (`pmndrs/market`, archivo `src/helpers/constants/licenses.js`) la licencia `1` es **CC0**
  (`https://creativecommons.org/share-your-work/public-domain/cc0/`).

## Qué se cambió

- Se usó **una sola malla** (todas las variantes de Kenney comparten la misma geometría; la ropa es una textura).
- Se le sacó la compresión Draco y se **horneó offline** (Node + `@gltf-transform`) a la pose de descanso con los brazos
  abajo, a la escala del juego (~1,93 m) y con los 11 huesos del juego (`hips`, `torso`, `head`, `legL`, `kneeL`, `legR`,
  `kneeR`, `armL`, `elbowL`, `armR`, `elbowR`). Resultado: un `.glb` de 66 KB, embebido en base64 en
  `js/people-assets.js` (así el juego abre con doble clic, sin servidor) y leído con `lib/GLTFLoader.js`
  (three.js r128, licencia MIT, `lib/THREE-LICENSE.txt`).
- Las **texturas de Kenney no se incluyen**: la ropa, el pelo y las caras se pintan por código (`js/people.js`) sobre el
  mismo mapa UV. Del original solo se guardaron las siluetas del pelo de cuatro skins (`hair` en `people-assets.js`).

## Mapa UV (textura de 1024 x 1024, por si se quiere pintar algo nuevo)

| Zona | Rectángulo (x, y) | Notas |
|---|---|---|
| Cabeza | 0..640 × 0..490 | frente al centro (x = 322), orejas en x ≈ 186 y 458, nuca en los bordes. Cara (rasgos con gestos): 246..398 × 160..290 |
| Torso (cruz) | 0..640 × 490..1024 | espalda arriba, escote en (322, 723), panza abajo; cintura en y ≈ 490 y 1000 |
| Brazos | franja y 650..830 | brazo cerca del torso (x 120..215 y 430..520), antebrazos en los extremos (puños en x < 44 y > 596) |
| Manos | 640..1024 × 130..720 | |
| Zapatos | 640..830 × 0..520 | suelas en y 20..130 |
| Pantalón | 620..1024 × 770..1024 | cintura arriba, botamanga abajo; las dos piernas una al lado de la otra |
| Libre | 0..150 × 840..1020 | parches de color para gorra, visera, insignia y carpeta (geometría extra pegada a los huesos) |

## Props de la calle (autos, palmeras, árboles, bancos)

Los objetos de afuera que no están dibujados por código vienen del mismo repo público `pmndrs/market-assets` (GitHub),
todos con `"license": 1` = **CC0 1.0 (dominio público)** según `pmndrs/market` (`src/helpers/constants/licenses.js`).

| Modelo en el juego | Carpeta en `files/models/` | Autor (`info.json`) | Licencia |
|---|---|---|---|
| Sedán | `sedan` | Kenney (www.kenney.nl) | CC0 1.0 |
| Taxi | `taxi` | Kenney | CC0 1.0 |
| Patrullero | `police-car` | Kenney | CC0 1.0 |
| Camioneta de lujo (también la de la Mafia) | `suv-luxury` | Kenney | CC0 1.0 |
| Utilitario | `van` | Kenney | CC0 1.0 |
| Hatchback | `hatchback` | Kenney | CC0 1.0 |
| Palmera | `palm-detailed-short` | Kenney | CC0 1.0 |
| Árbol | `tree-small` | Kenney | CC0 1.0 |
| Banco de plaza | `bench` | saravieira | CC0 1.0 |

Qué se cambió: se les sacó la compresión Draco y se **hornearon offline** (Node + `@gltf-transform`) a un solo `.glb`
de ~450 KB: sin coordenadas de textura, centrados, a escala del juego (los autos de ~4,3 m con el frente hacia +X y,
al cargarlos, un poco más bajos y angostos que el original), con el color de cada material pasado a color por vértice,
los vidrios oscurecidos y las posiciones en enteros de 16 bits (`KHR_mesh_quantization`). Va embebido en base64 en
`js/props-assets.js` (unos 610 KB) y lo lee `js/exterior.js` con `lib/GLTFLoader.js`, así el juego sigue abriendo con
doble clic. La chapa de los autos se tiñe por código (colores al azar; el taxi amarillo).
