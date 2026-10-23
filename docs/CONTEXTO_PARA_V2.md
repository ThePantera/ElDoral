# Casino Dorado · Contexto completo para arrancar la versión 2

> **Para el chat nuevo:** este documento resume todo lo que se hizo en la versión 1 de *Casino Dorado*, un simulador de dueño de casino en primera persona hecho en 3D para el navegador. Lo escribió Claude con Manu el 23 de octubre de 2026. Leelo entero antes de proponer cambios. Si además te pasan el archivo `Casino-Dorado-v1.zip`, ahí está el código completo que se describe acá.

---

## 0. Cómo usar este documento

1. Pegá este archivo en el chat nuevo (o subilo como adjunto).
2. Si podés, subí también `Casino-Dorado-v1.zip`: sin el código, el chat nuevo solo conoce la descripción, no los archivos.
3. Después decí qué querés en la v2. Al final hay una lista de ideas pendientes (sección 15) y un mensaje de arranque sugerido (sección 16).

---

## 1. Quién lo hace y cómo se trabaja

- **Manu** es el dueño del proyecto. Escribe en español rioplatense (vos). **Responder siempre en español.**
- Manu **nunca programó** (ni Unity ni C#). Desarrolla solo y **Claude escribe todo el código**. Manu prueba, cuenta qué siente y qué falla.
- Dedica más de 30 horas por semana.
- **Presupuesto $0:** solo herramientas y recursos gratis. Todo low poly.
- Manu quiere la **calidad más alta posible** ("triple A"). Se le explicó que un AAA real no es posible en la web, así que el objetivo es el máximo pulido posible dentro del navegador.
- Le gusta trabajar con **varios subagentes en paralelo** como si fueran un "departamento de videojuego" (diseño, arte, programación, QA).
- **Plataforma: solo computadora** (teclado y mouse). El celular no es prioridad. No hay que invertir tiempo en móvil, pero tampoco romper el código táctil que ya existe.

## 2. Visión y decisiones clave

**En una frase:** sos dueño de un terreno, empezás con un local chico y $2.500, comprás máquinas de casino, contratás personal, ampliás el salón, pagás licencias y seguridad, y tratás de terminar siendo el **Rey de la noche** comprándole el casino a tu rival.

**Referencias de estilo:**
- **Schedule I** (simulador de negocio en primera persona): hacer todo con tus propias manos al principio y después automatizarlo con personal. Manu pidió **más reto** que Schedule I.
- **TCG Card Shop Simulator:** su método de juego llevado al casino. Pedís por computadora, llega un camión con cajas, reponés góndolas, fijás precios y cobrás en la caja registradora con vuelto.

**Historia de decisiones técnicas:**
- 2026-10-18: se planeó en **Unity 2022 LTS**. Se armó un proyecto base en C# (`casino-simulator/`) y un análisis de viabilidad.
- 2026-10-20: **cambio de plan.** Manu no puede usar Unity por ahora. El juego pasó a ser una **página web 3D con Three.js**, jugable como Artifact de claude.ai. El proyecto Unity quedó en pausa (los archivos siguen en `casino-simulator/`, no se usan).
- Todo es **procedural**: modelos 3D, texturas y sonidos se generan por código. No hay imágenes ni archivos de audio.

**Dónde se juega:**
- Juego publicado (siempre se actualizó en el mismo link): https://claude.ai/artifact/6jeKXwYXxAV2pK6oJybj4d
- Entrega offline para mostrar a un amigo: `casino-web/entrega-v1/Casino-Dorado-v1.zip` (doble clic en `index.html`, Three.js incluido, con `LEEME.txt` y documentación).

## 3. Cronología de versiones

Todas se publicaron en el mismo link del juego. Los números v4 a v10 son aproximados (se publicaron varias cosas el mismo día); v11 y v12 son los números reales de publicación.

| # | Fecha | Qué se agregó |
|---|---|---|
| v1 (MVP) | 2026-10-20 | Un solo archivo HTML. Tragamonedas, clientes, economía básica. |
| v2 | 2026-10-20 | Estilo Schedule I: cajas de las máquinas que se vacían a mano, bolsillo y caja fuerte, 8 rangos con XP, mesas (blackjack, ruleta), personal visible, clientes por tipo, VIP, ladrones, calor e inspector, préstamos, licencia, rival El Faraón, ampliaciones, objetivos diarios, cierre de caja, dificultad. Las partidas de la v1 no pasan a la v2. A Manu le gustó. |
| v3 | 2026-10-21 | Sonido y música sintéticos, minijuegos a mano (blackjack, ruleta, reparación), historia con 5 actos y misiones (final contra El Faraón), modo construcción (B). El banco pasó de B a K. |
| v3.1 | 2026-10-21 | Gráficos automáticos para que vaya fluido, botón "Abrir ya" en la Pausa. |
| v4 | 2026-10-21 | Mesa de póker Texas Hold'em (rango 6, $22.000, comisión 5%). |
| v5 | 2026-10-21 | "Local más vivo": clientes que reaccionan y un evento por noche desde el día 2. |
| v6 | 2026-10-21 | Menú de Gráficos (Automática / Alta / Media / Baja, mostrar FPS) por problemas de fluidez. |
| v7 | 2026-10-21 | Tienda estilo TCG Card Shop: compu de pedidos, camión, reponer, precios, caja registradora con vuelto, 10 licencias + 20 mejoras (tecla U), repositor y cajero. |
| v8 | 2026-10-21 | Pase visual "casino más lindo": personas con esqueleto, caras y expresiones, tragamonedas con forma por modelo, neones, tono ACES, balanceo de cámara opcional; guardia con bate que noquea al ladrón (¡BONK!). |
| v9-v10 | 2026-10-21 a 23 | Cinco equipos en paralelo: el dueño (imagen, publicidad, seguro, robos), modos de juego y logros, el mundo (día/noche, clima, hotel, Don Aurelio), dados/bingo/carreras, socios y torneo de póker. |
| v11 | 2026-10-23 | Heladera y estantería de snacks se mueven y se compran más (hasta 3 de cada una). |
| v12 | 2026-10-23 | Armas, peleas y la Mafia; personal con nombre, rango y eficiencia; Nahuel Técnico. |
| Entrega v1 | 2026-10-23 | ZIP offline + documentación de 27 secciones para mostrarle el juego a un amigo. |

## 4. Cómo es un día de juego

- Un día de juego va de las 8 a la medianoche y dura unos **8 minutos reales** (1 hora de juego = 30 segundos). Velocidad x1, x2, x4 con 1/2/3.
- El local **abre a las 10 y cierra a las 22**. Antes preparás el local; después hacés el cierre de caja. Tecla **N** salta las horas cerradas o abre ya.
- La **afluencia** depende del atractivo (máquinas, mesas, decoración, reputación), la hora (pico 18-21), el día de la semana, el clima, la publicidad, el rival y la dificultad.
- El día 1 es miércoles. Viernes ×1,4, sábado ×1,55, lunes ×0,7.
- **Cierre de caja** con ingresos y gastos por categoría, estadísticas, objetivos y lo que viene. Al final del día se pagan sueldos, cuotas, seguros y mantenimiento.
- **3 objetivos diarios** que dan plata y XP (el día 1 son de tutorial). Lucho, el primer empleado, guía el tutorial.
- **Dificultad Difícil:** 60% de la plata inicial, sueldos +20%, calor +40%, rival +40% más rápido, demanda −10%, más eventos nocturnos.

## 5. Todas las funciones del juego

### 5.1 Dinero
- Cada tragamonedas junta lo ganado en **su propia caja con tope**. Con la caja llena dice "CAJA LLENA" y no acepta apuestas. Mantener E para vaciarla al bolsillo.
- **Bolsillo** con tope ($1.500, sube a $3.000 en el rango 3 y a $6.000 en el 5). Lo que quede a medianoche se deposita solo.
- **Caja fuerte** (fondo izquierdo): mantener E para pasar el bolsillo al banco.
- **Banco (K):** saldo, préstamos y movimientos.
- Vender un objeto devuelve el 50%.
- **Toda la plata pasa por un único gestor (`Economy`)** para que el cierre de caja siempre cierre.

### 5.2 Rangos y XP

| Rango | Nombre | XP | Tope de juegos | Desbloquea |
|---|---|---|---|---|
| 1 | Novato | 0 | 4 | Clásica, préstamo chico, planta |
| 2 | Encargado | 250 | 6 | Dorada, técnico, guardia, cajero, repositor, habitués, tramposos, socios |
| 3 | Croupier | 900 | 8 | Blackjack, Bingo, croupier, high rollers, préstamo mediano |
| 4 | Gerente de sala | 2.200 | 12 | Ala Este, Diamante, Dados, camarero, Barra |
| 5 | Director | 4.500 | 16 | Ruleta, Carreras, VIP, hotel, préstamo grande |
| 6 | Magnate local | 8.000 | 20 | Salón VIP Oeste, Mega Jackpot, Póker, Nahuel Técnico |
| 7 | Barón del juego | 13.000 | 24 | Fuente, más cupo de personal |
| 8 | Rey de la noche | 20.000 | 27 | Comprar El Faraón |

XP por: vaciar cajas (3), reparar (5), servir tragos (6), recibir VIP (10), atrapar ladrones (15), día limpio (20), pasar inspección (60), comprar un juego (10), ganancia del día, objetivos, misiones, vuelto justo, eventos.

### 5.3 Tragamonedas

| Máquina | Precio | Apuesta | Atractivo | Caja | Rango |
|---|---|---|---|---|---|
| Clásica | $900 | $25 | 1 | $200 | 1 |
| Dorada | $3.000 | $75 | 1,4 | $500 | 2 |
| Diamante | $8.000 | $200 | 2 | $1.200 | 4 |
| Mega Jackpot | $22.000 | $500 | 3,2 | $3.000 | 6 |

- **Pago (RTP)** por máquina con R: Generosa 95%, Estándar 90%, Ajustada 86%, **Trucha 78%** (ilegal, sube el calor 2,5 por día).
- Se rompen (las caras más seguido). Un técnico las repara solo; a mano es un **minijuego de reparación** de 3 pasos (repuesto, cables, calibrar).
- Mega Jackpot con pozo progresivo.

### 5.4 Mesas y juegos

| Juego | Precio | Asientos | Rango | Notas |
|---|---|---|---|---|
| Blackjack | $4.500 | 4 | 3 | 6 mazos, banca se planta en 17, blackjack paga 3:2 |
| Ruleta | $14.000 | 6 | 5 | Pleno 35:1, docena 2:1, color y par/impar 1:1 |
| Póker Texas Hold'em | $22.000 | 6 | 6 | La casa cobra 5% del pozo (tope $400) |
| Dados (craps) | $6.000 | 6 | 4 | Pase, no pase, campo, cualquier 7; tirás con el mouse |
| Sala de Bingo | $6.500 | 8 | 3 | A las 20:00 se llena; cartón $25; premio 60% |
| Carreras de caballos | $16.000 | — | 5 | Carrera cada 40 min, margen ~15%, ventanilla de apuestas |

Repartís vos parándote en el cuadro dorado del croupier (minijuego a mano: pagar bien y rápido da propinas, XP y reputación) o contratás un croupier que juega solo. En póker sin croupier repartís con E/1/2.

### 5.5 Personal
- Cada empleado tiene **nombre, rango** (Aprendiz, Junior, Semi-senior, Senior, Estrella) y **eficiencia 1-100**. La eficiencia acelera tareas y sube el sueldo (eficiencia 50 = sueldo base).
- **Contratar:** Gestión → Personal → Contratar elige entre 4 candidatos (cambian por día o con "Buscar otros"). Cuesta 2 días de sueldo.
- **Capacitar:** +8 de eficiencia por 4 días de sueldo (tope según tu rango). **Despedir** por empleado.
- **Cupo** sube con el rango; croupiers nunca por debajo de la cantidad de mesas.

| Puesto | Sueldo/día | Qué hace |
|---|---|---|
| Técnico | $150 | Repara máquinas; −25% de roturas |
| Guardia | $140 | Patrulla, atrapa ladrones (55%), baja el calor; puede noquear con bate |
| Cajero | $160 | Atiende la caja registradora, vacía cajas y deposita |
| Croupier | $180 | Atiende una mesa |
| Camarero | $130 | Lleva tragos a high rollers y VIP (necesita Barra) |
| Repositor | $110 | Trae cajas de la vereda y repone |
| Recepcionista | $160 | Registra huéspedes del hotel |

**Nahuel Técnico:** técnico Estrella único (rango 6, $12.000). Rulos cortos, anteojos de nerd, buzo negro, pantalón gris, credencial con su nombre. Repara casi el doble de rápido.

### 5.6 Clientes

| Tipo | Presupuesto | Prefiere | Notas |
|---|---|---|---|
| Casual | $100-600 | Clásica, bingo | 70% de la gente |
| Habitué | $300-1.800 | Dorada, blackjack, dados, bingo | Vuelve seguido |
| High roller | $2.500-9.000 | Blackjack, Diamante, ruleta, póker, dados, carreras | Pide tragos; atractivo 40 |
| VIP | $12.000-40.000 | Póker, ruleta, Jackpot, carreras | Hay que recibirlo en la puerta; atractivo 120 |

Cada cliente tiene **ánimo y satisfacción**. Suben con premios y tragos; bajan con rachas malas, esperas, máquinas rotas, pisos sucios, peleas y apagones. Al irse, su satisfacción mueve tu reputación.

### 5.7 Tienda estilo TCG Card Shop
- **Compu de la oficina (E):** pestañas Pedir, Precios, Envíos, Mejoras y licencias, Pronóstico, Imagen, Publicidad, Seguridad y Armas.
- **Camión** llega ~40 min de juego después y deja cajas en la vereda. Llevás una por vez (E agarra, G suelta); las pesadas te frenan. Las cajas grandes se abren adentro en modo construcción.
- **Góndolas:** heladera de bebidas, estante de snacks y mostrador de fichas. Se reponen con la caja en la mano (mantener E). Se **mueven** con B y se **compran más** (heladera $900, snacks $700, rango 2, hasta 3 de cada una).
- **Precios:** el costo mayorista es 42% del precio de mercado, que **cambia cada día**. Hasta 1,15× el mercado compran normal; más caro, rezongan o no compran.
- **Caja registradora:** fila de hasta 6. El cliente paga con un billete y armás el vuelto con 1-7 (8 deshace, Espacio entrega). Vuelto justo +2 XP; de más lo perdés; de menos baja la reputación. Un cajero lo hace solo.
- Estante vacío: queja, venta perdida y baja la reputación.

### 5.8 Licencias y árbol de mejoras (U)
- **10 licencias** de compra única: alfajor $250, cerveza $700, Dorada $1.200, Blackjack $2.000, espumante $2.500, Diamante $3.500, Ruleta $5.000, habano $3.000, Jackpot $8.000, Póker $8.000.
- **20 mejoras en 4 ramas:** Máquinas, Personal, Bar y comodidad, Negocio y calle. Cada una pide la anterior de su rama y un rango. Ejemplos: carretes 20% más rápidos, cajas 50% más grandes, 45% menos roturas, autodiagnóstico, sueldos −20%, personal 30% más rápido, gerente, tragos premium, aire acondicionado, sala VIP, cartel luminoso, contactos en la municipalidad, licencia más barata, préstamos baratos, sabotaje a El Faraón.

### 5.9 Peligros y formas de perder
- **Calor (0-100):** sube con máquinas Truchas, ladrones que escapan, licencia atrasada, préstamos impagos y favores turbios. Baja 4 por día y con guardias. Con 100: clausura de 2 días y multa. **A la tercera clausura perdés.**
- **Inspector de Lotería (Ernesto Funes):** viene al azar (más con calor alto) y cada 14 días. Multa si encuentra Truchas. Se lo puede coimear, con riesgo.
- **Ladrones:** van a la caja más llena. "!" rojo arriba: mirarlos y E para atraparlos, o que lo hagan los guardias.
- **Licencia del local:** cada 7 días, $1.500 + $100 por juego. **Dos impagas seguidas y perdés.**
- **Préstamos:** chico $3.000 (20%), mediano $10.000 (25%), grande $30.000 (30%), El Tano $15.000 (50%, rango 2). Cuota diaria; si no pagás te embargan el juego más caro.
- **Más de 3 días seguidos en números rojos y perdés.**

### 5.10 El rival: El Faraón
Abre enfrente el **día 6**. Su dueña es Cleo Montenegro. Hace promociones cada 5 días y te saca clientes; su atractivo crece cada semana. Con rango 8 y unos $150.000 + $500 por punto de atractivo lo **comprás y ganás la partida**.

### 5.11 Construir y decorar (B)
- Mirás un objeto, E lo levantás, R/T girás 90°/45°, E lo ponés. Fantasma verde o rojo (con el motivo). Grilla de 0,5 m. Q cancela, X vende, C abre el catálogo.
- **Catálogo:** máquinas, mesas, decoración y ambientes (alfombra y color de pared por zona).
- **Zonas:** Salón principal (gratis), Ala Este ($10.000, rango 4), Salón VIP Oeste ($30.000, rango 6), desde la pared "SE VENDE".
- **Decoración:** plantas, lámparas, alfombras, estatuas, fuente, sogas de terciopelo, neones, arañas, cuadros, la Barra. Todo suma atractivo.
- Clientes y personal caminan con **A\*** esquivando lo ubicado.

### 5.12 El dueño (I, archivo owner.js)
- **Imagen 0-100:** ropa (remera → camisa → saco → traje → traje blanco de capo → smoking dorado), accesorios (anteojos de sol, reloj de oro, cadena), auto en la vereda (fitito, sedán, deportivo rojo, limusina blanca) y lujos de oficina (escritorio de caoba, alfombra persa, retrato al óleo, acuario, caja fuerte dorada).
- A imagen 100: +100% de high rollers y VIP, −12% de sueldos, +8% de velocidad del personal, −15% en lo que cobra la mafia.
- Ropero con espejo en la oficina. La ropa se ve en tus mangas y manos en primera persona.
- **Publicidad:** volantes (2 días, casuales), radio (5 días, habitués), cartel en la ruta (10 días, high rollers y VIP), influencer (viene a las 17). Rendimiento decreciente; el cierre muestra el ROI de cada campaña.
- **Seguro** Básico / Completo / Todo riesgo contra robos, incendio y vandalismo. Cámaras y caja fuerte reforzada.
- **Robo planeado:** raro, con avisos previos. Una banda enmascarada intenta forzar la caja fuerte. Te defendés con el tablero de seguridad (alarma, persiana, policía), guardias, tacleando y pinchando la goma de la camioneta.

### 5.13 El mundo de afuera (world.js)
- **Día y noche real:** cielo, luz y fachada siguen el reloj.
- **Clima:** soleado, nublado, lluvia, tormenta y ola de calor, con efecto por tipo de cliente. La tormenta puede cortar la luz. Pronóstico de 6 días en la compu.
- **Hotel Dorado** arriba (rango 5): habilitación $8.000 + obra $30.000. Habitaciones Estándar $4.000, Suite $12.000, Penthouse $40.000. Huéspedes con valija, registro en recepción, bajan a jugar a la noche.
- **Don Aurelio Cardenal** (mafia): cada 3-5 días pide un favor (lavar una valija, dejar ganar a un amigo, esconder un paquete, despedir a alguien, sabotear a El Faraón, pagar protección). 1 acepta, 2 rechaza. Mueve tu stat de **Protección**.

### 5.14 Historia y misiones (H, story.js)
5 actos atados a los rangos: **I** La Clásica usada, **II** Papeles en regla, **III** La reina de enfrente, **IV** Noche de gala, **V** La última mano. Personajes: Lucho, Don Aurelio, Inspector Funes, Cleo Montenegro. Cinco decisiones con consecuencias: si aceptás 2 o más favores turbios, en el Acto V le debés **$40.000 a Don Aurelio**.
Finales: **El Rey de la noche** (comprás El Faraón), **La última función** (lo hundís) y el final malo **"Aurelio's"**.

### 5.15 Local más vivo (life.js)
- Clientes festejan premios, se enojan con rachas malas (pueden patear la máquina), se quejan en voz alta y vuelcan tragos (manchas que hay que limpiar con E).
- Desde el día 2, un **evento por noche**: borracho, pelea, cumpleaños, tramposo, apagón, celebridad, bandeja de tragos. Casi todos se resuelven con E.

### 5.16 Socios y torneo (J, clients.js)
- **Socios** (rango 2): ofrecés la tarjeta a un cliente contento. Vuelve solo, hace pedidos y sube de Bronce a Plata a Oro según fidelidad. El Faraón puede tentarlos.
- **Torneo semanal de póker** los sábados (necesita mesa de póker): 8 inscriptos de $600, cuartos, semis y final. La casa se queda con el 25% del pozo.

### 5.17 Armas, peleas y la Mafia (combat.js)
Tono de dibujito: nadie muere en pantalla.
- Compu → **Armas:** cuchillo $150 (rango 1), bate $320 (rango 2), pistola 9 mm $1.800 (rango 4), municiones $120 por 12 balas (hasta 60).
- **F** equipa y cicla (cuchillo → bate → pistola → guardada). Clic izquierdo ataca.
- **Máquinas:** un golpe o tiro las rompe y suma daño; el técnico tarda hasta 4,5 veces más.
- **Clientes:** se defienden y te pueden **noquear** (cámara al piso unos segundos). Llega tu guardia o seguridad privada de la calle. Perdés reputación, sube el calor y se te cae plata del bolsillo.
- **Disparos:** mancha de sangre estilizada, limpieza especial $450, reputación −8, calor +14.
- **Pegarle o dispararle a Don Aurelio:** cartel "Te metiste contra la Mafia". A las **21:00** llegan 3 autos con 6 pistoleros: todas las máquinas rotas con daño y **todo el personal desaparece** (`CasinoStaff.killAll()`). Reputación −18, calor +22.

### 5.18 Modos de juego, logros y ranking (L, challenge.js)
- Al empezar partida: **Historia**, **Sandbox** (plata infinita, sin logros), **Desafío 30 días** ($75.000 y rango Gerente de sala antes del día 30) y **Difícil sin préstamos** (puntaje ×1,5).
- **34 logros** y récords (mejor día, racha, ritmo de ascenso) por navegador.
- **Ranking semanal contra El Faraón:** ganancia, reputación y visitas. Ganar 2 de 3 da +3 de reputación y +15% de clientes; perder hace que Cleo te robe clientes.

### 5.19 Sonido, música y gráficos
- **Audio 100% sintético** (Web Audio, sin archivos): murmullo, jingles, monedas, caja fuerte, lluvia, música lounge/jazz que cambia con la hora y una variante tensa con inspector o calor alto. Volúmenes en la Pausa; M silencia.
- **Gráficos:** Automática (ajusta la resolución según FPS, por defecto), Alta, Media, Baja. Opción de ver FPS y balanceo de cámara. **Máximo 8 luces dinámicas.**
- Estética: personas low poly con esqueleto, caras y expresiones; tragamonedas con forma propia por modelo; neones; tono ACES.

### 5.20 Guardado
- En `localStorage` del navegador: `casino-dorado-partida-v2` (partida), `casino-dorado-logros-v1`, `casino-dorado-graficos-v1`, `casino-dorado-sonido-v1`.
- Guarda cada hora de juego, al cerrar el día y con G sin caja en las manos.
- `sanitize()` valida cada campo al cargar; una partida dañada se descarta con aviso. Las partidas de versiones anteriores cargan (los sistemas nuevos arrancan en cero).

## 6. Controles

| Tecla | Acción |
|---|---|
| W A S D / flechas | Caminar (Shift corre) |
| Mouse | Mirar (clic para capturar el mouse) |
| **E** o clic izquierdo | Usar. Mantener para vaciar cajas, reparar, reponer, depositar, limpiar |
| **R** o clic derecho | Opciones de lo que mirás (pago, precio, girar) |
| **G** | Soltar la caja (sin caja: guardar) |
| **N** | Saltar horas cerradas / abrir ya |
| **1 2 3** | Velocidad x1 / x2 / x4 (en minijuegos: opciones) |
| **P / K / O** | Personal / Banco / Objetivos |
| **U** | Licencias y mejoras |
| **B** | Modo construcción |
| **I** | Celular del dueño |
| **L** | Logros, récords y ranking |
| **H** | Historia |
| **J** | Socios y torneo |
| **F** | Equipar / cambiar / guardar arma |
| Clic izquierdo con arma | Atacar |
| **M** | Silenciar |
| **Esc** | Pausa (sonido, gráficos, partida nueva, "Abrir ya") |
| En construcción R / T / Q / X / C | Girar 90° / girar 45° / cancelar / vender / catálogo |
| Caja registradora 1-7 / 8 / Espacio | Billetes del vuelto / deshacer / entregar |
| Favores de Aurelio 1 / 2 | Aceptar / rechazar |

## 7. Arquitectura técnica

**Tecnología:** HTML + JavaScript puro, **Three.js r128**, sin compilar ni instalar nada. Unas **18.000 líneas** de JS en total. Todo procedural.

**Archivos (carpeta `casino-web/v3/`, en este orden de carga en `index.html`):**

| Archivo | Tamaño aprox. | Rol |
|---|---|---|
| `data.js` | 53 KB | Todos los números del juego en `window.CASINO_DATA` (rangos, máquinas, mesas, personal, clientes, tienda, mundo, combate, modos) |
| `art.js` | 142 KB | Modelos y animaciones procedurales (`window.CasinoArt`): máquinas, mesas, gente con esqueleto, decoración |
| `decor.js` | 77 KB | Modo construcción, catálogo, colocación y validación |
| `game.js` | 200 KB | Núcleo: bucle, economía, clientes, personal, UI, guardado, controles, gráficos |
| `audio.js` | 52 KB | Sonido y música sintetizados |
| `minigames.js` | 43 KB | Blackjack, ruleta y reparación a mano |
| `poker.js` | 34 KB | Evaluador de manos, mesa y minijuego de póker |
| `life.js` | 72 KB | Reacciones de clientes y eventos de la noche |
| `upgrades.js` | 11 KB | Licencias y árbol de mejoras |
| `shop.js` | 82 KB | Tienda, camión, góndolas, precios, caja registradora |
| `owner.js` | 97 KB | Imagen del dueño, publicidad, seguro, robos |
| `challenge.js` | 39 KB | Modos de juego, logros, ranking |
| `world.js` | 74 KB | Día/noche, clima, hotel, favores de Don Aurelio |
| `games.js` | 84 KB | Dados, bingo, carreras |
| `clients.js` | 57 KB | Socios y torneo de póker |
| `staff.js` | 19 KB | Personal con nombre, rango y eficiencia; Nahuel |
| `combat.js` | 47 KB | Armas, peleas, sangre, la Mafia |
| `story.js` | 73 KB | Historia, diálogos y misiones |

**Patrón de módulos (importante para la v2):**
- Cada sistema es un archivo que expone `window.CasinoX` (por ejemplo `CasinoShop`, `CasinoStaff`, `CasinoCombat`).
- `game.js` le arma a cada uno un **puente** `window.CasinoXBridge` con lo que necesita (estado `S`, economía, funciones internas).
- `game.js` llama a los módulos con enganches opcionales (`window.CasinoX?.fn?.()`), así que sacar un archivo no rompe el resto.

**Reglas que hay que respetar:**
- Toda la plata pasa por `Economy`.
- El estado de la partida es `S`. Cada módulo guarda su parte (`S.shop`, `S.owner`, `S.world`, `S.clients`, `S.combat`, `S.crew`...) y `sanitize()` la valida al cargar.
- **No agregar luces dinámicas** (tope 8, por rendimiento).
- Los números de balance van en `data.js` (o al principio de cada módulo), no desparramados.
- Las partidas viejas tienen que seguir cargando.

**Depuración:** en la consola, `casinoDebug` permite avanzar el tiempo (`casinoDebug.step(segundos)`), ver el estado y probar funciones. Cada módulo tiene su `CasinoX.debug`.

**Agregar contenido:** máquina o mesa nueva en `data.js` (`MACHINES` / `TABLES`) + modelo en `art.js`; empleado en `STAFF`; logro en `challenge.js`; misión en `story.js`.

**Publicar el Artifact:** el `index.html` se publica con todos los `.js` como archivos acompañantes, en el mismo link. Al agregar un archivo nuevo hay que sumarlo al mapa de archivos del publish y a la lista de `<script>` de `index.html`.

## 8. Cómo se prueba

- **Playwright con Chromium** (en el contenedor: swiftshader, sin GPU). Three r128 se baja con `npm pack three@0.128.0` porque el CDN está bloqueado, y la URL de cdnjs se redirige al archivo local.
- Las pruebas manejan el juego con `window.casinoDebug` y verifican: cero errores de consola, guardar y recargar, partidas viejas, que las luces sigan en 8 y la lógica de cada sistema.
- Suites: humo de integración, tienda, góndolas (`t-shelves` 38/0), personal (`t-staff` 23/0), combate (`t-combat` 57/0), dueño (40), mundo (46), póker (32), juegos, socios, desafío, minijuegos, vida del local. También `v3/tests/poker.test.js`.
- Los diálogos de la historia abren `ui.panel='dialog'`: los tests tienen que cerrarlos (`CasinoStory.debug.skip/choose`) antes de apretar teclas.
- **Correr como mucho 2 suites en paralelo** o se cortan por tiempo.
- **Tests flaky:** con swiftshader y tantos sistemas corriendo, varios tests fallan de forma intermitente (cada corrida falla uno distinto), incluso sobre la versión sin cambios. **No tratar un fallo aislado como regresión** sin reproducirlo 2 veces o compararlo contra la base. Falla conocida previa: en `t-life`, "mancha nueva baja el atractivo".

## 9. Lecciones aprendidas

- **Ramas en paralelo:** 5 subagentes hicieron 5 funciones en git worktrees separados, pero no pudieron hacer el merge final (límites de uso). Juntar 5 ramas a la vez dio muchos conflictos reales en `game.js`, `data.js`, `index.html` y `CHANGELOG.md`, porque todas tocan los mismos puentes `window.CasinoXBridge` y la línea de exportación de `CASINO_DATA`. Se resolvieron a mano y una vez se coló un duplicado (MODES/CHALLENGE en `data.js`). **Lección:** reservar tiempo aparte para el merge final y revisar duplicados.
- **Rendimiento:** el JS usa ~5 ms por cuadro y ~420 draw calls; el cuello de botella es la **GPU** (píxeles × luces). Por eso existe el modo de gráficos automático. Si sigue lento, el siguiente paso es simplificar los modelos de máquinas y personas.
- **Historial de código:** hay un bundle de git en `casino-web/v3-wip/casino-repo.bundle`.

## 10. Balance: todo es primera versión

Estos números **no se probaron con jugadores reales** y esperan la opinión de Manu y su amigo:
- Precios de máquinas, mesas, licencias, mejoras y tienda.
- Tiempos del camión y del reloj.
- Frecuencia y dureza de los eventos nocturnos.
- Dificultad del combate y de la Mafia (el tiroteo es muy castigador).
- Costos del personal por eficiencia.

La curva de progreso que se diseñó originalmente está en `casino-web/design/DISENO_V2.md` (sección 15).

## 11. Limitaciones conocidas

- Solo computadora; el táctil existe pero no está pulido.
- La partida vive en el navegador: **no hay exportar/importar** y no pasa a otra compu. En modo privado no se guarda.
- Rendimiento atado a la GPU en compus flojas.
- **Sin audio grabado:** todo es sintetizado, suena "de videojuego viejo".
- Clientes en una grilla simple: en una fila se pueden rozar. Hay un tope de personas a la vez.
- Sin sombras en tiempo real.
- Reparar a mano una máquina golpeada borra el daño igual que el técnico.
- No hay anfitrión para recibir VIP: lo hace el jugador.
- La tipografía viene de Google Fonts; sin internet usa una del sistema.

## 12. Archivos del proyecto (carpeta compartida)

- `casino-web/v3/`: **código actual** del juego + `CHANGELOG.md`.
- `casino-web/entrega-v1/`: `Casino-Dorado-v1.zip`, `DOCUMENTACION.md/.html` y este archivo.
- `casino-web/design/DISENO_V2.md`: diseño de economía y balance original (ciclo, rangos, curva simulada, primeros 30 minutos).
- `casino-web/qa/QA_V1.md`: reporte de QA de la primera versión (bugs B1-B13, todos arreglados).
- `casino-web/v2/`, `casino-web/src/`, `casino-web/casino.html`: versiones viejas.
- `casino-simulator/`: proyecto Unity en pausa (no se usa).

## 13. Personajes

- **Lucho:** tu primer empleado, guía del tutorial.
- **Don Aurelio Cardenal:** mafioso que pide favores y cobra protección.
- **Ernesto Funes:** inspector de Lotería.
- **Cleo Montenegro:** dueña de El Faraón, la rival.
- **El Tano:** prestamista (50% de interés).
- **Nahuel Técnico:** técnico estrella.

## 14. Qué quedó pendiente

- **Feedback de balance** de Manu y de su amigo con la entrega v1.
- Exportar e importar la partida (archivo o código).
- Optimizar modelos si en alguna compu sigue lento.

## 15. Ideas para la v2

Ideas que ya salieron en el proyecto y no se hicieron:
- Más tipos de máquinas y mesas (baccarat, keno, máquinas temáticas).
- Más actos de historia y más finales.
- Multijugador cooperativo (dos dueños en el mismo casino).
- Versión para celular (hoy no es prioridad).
- Más idiomas.
- Sonidos grabados gratis (por ejemplo freesound.org con licencia CC0) y música real.
- Modelos 3D importados gratis (Kenney, Quaternius) en lugar de procedurales.
- Exportar/importar partida y guardado en la nube.
- Anfitrión para VIP, sombras, mejor navegación de la gente.
- Volver a Unity cuando Manu pueda (el diseño y los números sirven igual).

## 16. Mensaje de arranque sugerido para el chat nuevo

> Hola. Te paso el contexto completo de mi juego *Casino Dorado* (versión 1) en este archivo y el código en el ZIP. Yo no sé programar, vos escribís todo el código y yo pruebo. Hablame en español rioplatense. Para la versión 2 quiero: **[escribí acá lo que querés]**. Antes de tocar código, leé el documento, decime qué entendiste y proponeme un plan por partes. Respetá las reglas de la sección 7 (toda la plata por `Economy`, máximo 8 luces, números en `data.js`, partidas viejas que sigan cargando).

---

*Casino Dorado · versión 1 · creado por Manu con Claude · octubre de 2026.*
