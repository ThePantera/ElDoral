# Casino Dorado

Simulador de dueño de casino en primera persona, en 3D, para jugar en el navegador de una computadora. Arrancás con una tragamonedas usada y poca plata, y tenés que llegar a ser un imperio y ganarle a El Faraón, el casino de enfrente.

Este repositorio es la base de la **versión 2**. Arranca con el código completo de la versión 1 (octubre de 2026), tal cual se entregó.

## Cómo jugar

1. Bajá el repositorio (botón verde **Code → Download ZIP**) y descomprimilo.
2. Hacé doble clic en `index.html` (Chrome, Edge o Firefox).
3. Tocá **Abrir el casino** y hacé clic en la pantalla para mirar con el mouse.

No hace falta instalar nada ni tener internet. La partida se guarda sola en el navegador.
Si va lento: **Esc → Gráficos → Media o Baja**.

### Controles básicos

| Tecla | Qué hace |
|---|---|
| WASD (Shift corre) · Mouse | Caminar y mirar |
| E | Usar (mantener para vaciar cajas, reparar, reponer) |
| R | Opciones de lo que mirás |
| G · N | Soltar caja · Abrir ya / saltar horas |
| P · K · O | Personal · Banco · Objetivos |
| U · B · I | Mejoras · Construir · Dueño |
| L · H · J · F | Logros · Historia · Socios · Armas |
| M · Esc | Silenciar · Pausa |

## Qué hay en cada carpeta

```
index.html      La página del juego (estilos y pantallas). Se abre esta.
js/             El código del juego, un archivo por sistema.
lib/            Three.js r128 (motor 3D, licencia MIT). No se toca.
docs/           Documentación, lista de cambios y contexto para la v2.
```

Los archivos de `js/`, en el orden en que carga `index.html`:

| Archivo | Qué hace |
|---|---|
| `data.js` | **Todos los números del juego** (precios, rangos, máquinas, mesas, personal, clientes) |
| `art.js` | Modelos y animaciones en 3D, todos hechos por código |
| `decor.js` | Modo construcción y decoración |
| `game.js` | El núcleo: bucle, economía, clientes, personal, pantallas, guardado, controles |
| `audio.js` | Sonido y música sintetizados |
| `minigames.js` | Blackjack, ruleta y reparación a mano |
| `poker.js` | Póker |
| `life.js` | Reacciones de los clientes y eventos de la noche |
| `upgrades.js` | Licencias y árbol de mejoras |
| `shop.js` | Tienda, camión, góndolas y caja |
| `owner.js` | Imagen del dueño, publicidad, seguro, robos |
| `challenge.js` | Modos de juego, logros y ranking |
| `world.js` | Día y noche, clima, hotel, favores de Don Aurelio |
| `games.js` | Dados, bingo y carreras |
| `clients.js` | Socios y torneo de póker |
| `staff.js` | Personal con nombre, rango y eficiencia |
| `combat.js` | Armas, peleas y la Mafia |
| `story.js` | Historia, diálogos y misiones |

## Reglas para programar la v2

1. **Toda la plata pasa por `Economy`.**
2. **Máximo 8 luces dinámicas**, por rendimiento.
3. **Los números de balance van en `data.js`** (o al principio de cada módulo), no desparramados.
4. **Las partidas viejas tienen que seguir cargando.** Cada módulo guarda su parte del estado `S` y `sanitize()` la valida al cargar.
5. Cada sistema es un archivo que expone `window.CasinoX`; `game.js` lo llama con enganches opcionales, así que sacar un archivo no rompe el resto. Un archivo nuevo va en `js/` y en la lista de `<script>` de `index.html`.
6. Solo computadora (teclado y mouse), sin romper el código táctil que ya existe. Presupuesto $0: solo recursos gratis.

Para probar desde la consola del navegador: `casinoDebug.step(segundos)` adelanta el tiempo, y cada módulo tiene su `CasinoX.debug`.

## Documentación

- [`docs/CONTEXTO_PARA_V2.md`](docs/CONTEXTO_PARA_V2.md): todo lo que se hizo en la v1, decisiones, lecciones y las ideas para la v2. **Empezar por acá.**
- [`docs/DOCUMENTACION.md`](docs/DOCUMENTACION.md): manual completo del juego (también en `.html`).
- [`docs/CAMBIOS.md`](docs/CAMBIOS.md): lista de cambios por versión.

---

Creado por Manu con Claude. Three.js © Three.js Authors, licencia MIT (`lib/THREE-LICENSE.txt`).
