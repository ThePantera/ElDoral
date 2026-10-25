# Créditos y licencia de los personajes

## El modelo

Las personas del juego (clientes, personal, ladrones, inspector, policía, la Mafia, el doble del dueño en el espejo) usan el
personaje **"characterMedium" de Kenney** (pack *Animated Characters*, <https://kenney.nl>).

- **Autor:** Kenney (www.kenney.nl).
- **Licencia:** **CC0 1.0 Universal (dominio público)**, <https://creativecommons.org/publicdomain/zero/1.0/>.
  Se puede usar, modificar y distribuir, también con fines comerciales, sin pedir permiso ni dar crédito.
  Igual lo dejamos acá por gentileza (y Kenney acepta donaciones: <https://www.patreon.com/kenney>).
- **De dónde se bajó:** repo público `pmndrs/market-assets` (GitHub), carpetas `files/models/<skin>`. Cada `info.json`
  dice `"creator": "kenney"` y `"license": 1`. En el sitio de ese repo (`pmndrs/market`, archivo
  `src/helpers/constants/licenses.js`) la licencia `1` es **CC0** (`https://creativecommons.org/share-your-work/public-domain/cc0/`).

## Skins (texturas originales de Kenney) que usa el juego

Todas las skins de Kenney de ese repo comparten exactamente la misma malla y el mismo mapa UV (se verificó: posiciones,
UV e índices idénticos entre las seis). Las texturas vienen embebidas en cada `model.gltf` y se sacaron con Node +
`@gltf-transform`.

| Skin (`files/models/…`) | Nombre en `info.json` | Autor | Licencia | Para qué se usa en el juego |
|---|---|---|---|---|
| `male` | Male | Kenney | CC0 1.0 | Cara con bigote y cejas fruncidas: los hombres con bigote (Mafia, algunos empleados y clientes). Su pantalón blanco y sus zapatos dan el sombreado de pantalones y zapatos. |
| `skater-male` | Male Skater | Kenney | CC0 1.0 | Cara y pelo con jopo: hombres con peinado *quiff* / *curly*. |
| `survivor-male` | Male Survivor | Kenney | CC0 1.0 | Cara y pelo corto: hombres con pelo corto, rapado o pelados. Su remera (sin las manchas) da el sombreado del torso y los brazos. |
| `skater-female` | Female Skater | Kenney | CC0 1.0 | Cara con flequillo y mechón de color: mujeres con *bob*. |
| `survivor-female` | Female Survivor | Kenney | CC0 1.0 | Cara y pelo recogido: mujeres con colita o rodete (la piel se pasó al tono base para poder teñirla). |
| `cyborg-female` | Female Cyborg | Kenney | CC0 1.0 | Solo la mitad humana, espejada (pelo colorado de costado y cara completa): mujeres con pelo largo o con rulos. |

No se usan: `zombie-1` / `zombie-2` (zombies) ni `pirate-captain` / `pirate-crew` / `pirate-officer` (otra malla, sin textura).

## Qué se cambió

- Se usó **una sola malla** (todas las variantes de Kenney comparten la misma geometría; la ropa es una textura).
- Se le sacó la compresión Draco y se **horneó offline** (Node + `@gltf-transform`) a la pose de descanso con los brazos
  abajo, a la escala del juego (~1,93 m) y con los 11 huesos del juego (`hips`, `torso`, `head`, `legL`, `kneeL`, `legR`,
  `kneeR`, `armL`, `elbowL`, `armR`, `elbowR`). Resultado: un `.glb` de 66 KB, embebido en base64 en
  `js/people-assets.js` (así el juego abre con doble clic, sin servidor) y leído con `lib/GLTFLoader.js`
  (three.js r128, licencia MIT, `lib/THREE-LICENSE.txt`).
- **Texturas:** de cada skin se guardó, a 512 px, el cuadrante de la cabeza original (pelo, cara, cejas, bigote) y una
  máscara de piel / pelo / cejas; además el sombreado de la ropa (remera del `survivor-male` sin manchas, pantalón y
  zapatos del `male`) y la máscara de ojos y boca de cada cara. Todo en PNG dentro de `js/people-assets.js` (unos 145 KB).
  En el juego (`js/people.js`): la piel se tiñe al tono de cada persona y el pelo a su color sin perder el dibujo; la ropa
  (uniformes, remeras, trajes) se pinta por código y se multiplica por el sombreado de Kenney. Los gestos (parpadeo,
  feliz, triste, enojado, sorprendido, mareado) cambian solo los ojos y la boca, dibujados al estilo Kenney; la cara
  neutral es la original.
- **Manos en primera persona:** el brazo (antebrazo y mano) se recorta de la misma malla y usa la textura de la ropa
  del dueño.

## Mapa UV (textura de 1024 x 1024, por si se quiere pintar algo nuevo)

| Zona | Rectángulo (x, y) | Notas |
|---|---|---|
| Cabeza | 0..640 × 0..490 | frente al centro (x = 322), orejas en x ≈ 186 y 458, nuca en los bordes. Cara (rasgos con gestos): 246..398 × 160..300; ojos en y ≈ 220, boca en y ≈ 262..282 |
| Torso (cruz) | 0..640 × 490..1024 | espalda arriba, cuello en (322, 728..797), panza abajo; cintura en y ≈ 490 y 1000 |
| Brazos | franja y 650..830 | brazo cerca del torso (x 120..215 y 430..520), antebrazos en los extremos (puños en x < 44 y > 596) |
| Manos | 640..1024 × 130..720 | |
| Zapatos | 640..830 × 0..520 | suelas en y 20..130 |
| Pantalón | 620..1024 × 770..1024 | cintura arriba, botamanga abajo; las dos piernas una al lado de la otra |
| Libre | 0..150 × 840..1020 | parches de color para gorra, visera, insignia y carpeta (geometría extra pegada a los huesos) y la muestra de piel (40, 1004) que usa el shader de los gestos |

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
