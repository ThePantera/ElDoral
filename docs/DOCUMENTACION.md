# Casino Dorado · Documentación completa (versión 1)

Simulador de dueño de casino en primera persona, en 3D, que se juega en el navegador de una computadora. Empezás con un local chico y $2.500, comprás máquinas, contratás personal, ampliás el salón, cuidás tu reputación y tu calor con la ley, y tratás de terminar siendo el **Rey de la noche**.

Referencias de estilo: *Schedule I* (negocio en primera persona, hacer todo con las manos y después automatizarlo) y *TCG Card Shop Simulator* (pedir por computadora, recibir cajas, reponer, fijar precios, cobrar en la caja).

---

## Índice

1. Cómo abrir el juego
2. Primeros minutos
3. Controles
4. Cómo es un día en el casino
5. Dinero: bolsillo, caja fuerte, banco
6. Rangos y experiencia (XP)
7. Máquinas tragamonedas
8. Mesas y juegos
9. Personal
10. Clientes
11. La tienda: pedidos, camión, reponer, precios y caja registradora
12. Licencias y árbol de mejoras (tecla U)
13. Peligros: calor, inspector, ladrones, licencia, préstamos
14. El rival: El Faraón
15. Construir y decorar
16. El dueño: imagen, publicidad, seguro y robos
17. El mundo de afuera: día y noche, clima, hotel y Don Aurelio
18. La historia y las misiones
19. Eventos de la noche y clientes que reaccionan
20. Socios con tarjeta y torneo de póker
21. Armas, peleas y la Mafia
22. Modos de juego, logros y ranking
23. Sonido, música y gráficos
24. Guardado de partida
25. Arquitectura técnica (para quien quiera tocar el código)
26. Pruebas automáticas
27. Limitaciones conocidas y próximos pasos

---

## 1. Cómo abrir el juego

**Requisitos:** una computadora con un navegador moderno (Chrome, Edge o Firefox) con WebGL activado. El juego está pensado solo para **computadora** (teclado y mouse). No hace falta instalar nada ni tener internet.

**Pasos:**
1. Descomprimí el ZIP en una carpeta.
2. Hacé doble clic en `index.html` (se abre en el navegador).
3. Tocá **Abrir el casino** y hacé clic en la pantalla para capturar el mouse.

Si el juego se ve lento: Pausa (Esc) → **Gráficos** → elegí *Media* o *Baja*. Por defecto está en *Automática* y se ajusta sola.

> La tipografía del juego se descarga de Google Fonts. Sin internet usa una tipografía del sistema y todo funciona igual.

## 2. Primeros minutos

1. Empezás en la entrada con $2.500, una tragamonedas Clásica, reputación 40 y dos cajas de insumos en la vereda.
2. Lucho, tu primer empleado, te guía en el tutorial (hablale para pedir pistas).
3. Abrí el local (tecla **N**, o botón "Abrir ya" en la Pausa). Llegan los clientes y juegan.
4. Las máquinas juntan lo ganado en su **caja**: andá, mirala y **mantené E** para vaciarla al bolsillo.
5. Llevá la plata a la **caja fuerte** del fondo izquierdo (mantené E) para pasarla al banco.
6. Con la plata, usá la **compu de la oficina** para pedir más máquinas, mesas y mercadería.
7. Al cerrar el día aparece el **cierre de caja** con todo lo que entró y salió.

## 3. Controles

| Tecla | Acción |
|---|---|
| W A S D / flechas | Caminar (Shift para correr) |
| Mouse | Mirar (clic en la pantalla para capturar el mouse) |
| **E** o clic izquierdo | Usar. Mantener para vaciar cajas, reparar, reponer, depositar, limpiar |
| **R** o clic derecho | Opciones de lo que mirás (pago de la máquina, precio de un mueble, girar) |
| **G** | Soltar la caja que llevás (sin caja, guarda la partida) |
| **N** | Saltar las horas cerradas / abrir ya |
| **1 2 3** | Velocidad del tiempo x1, x2, x4 (en minijuegos: opciones) |
| **P / K / O** | Personal / Banco / Objetivos (Gestión) |
| **U** | Licencias y mejoras |
| **B** | Modo construcción (mover, girar, vender) |
| **I** | Celular del dueño (imagen, ropa, auto, publicidad) |
| **L** | Logros, récords y ranking |
| **H** | Registro de Historia |
| **J** | Panel de socios y torneo |
| **F** | Equipar arma / cambiar de arma / guardarla |
| Clic izquierdo con arma | Atacar |
| **M** | Silenciar todo |
| **Esc** | Menú de pausa (sonido, gráficos, partida nueva) |
| En construcción: R / T / Q / X / C | Girar 90° / girar 45° / cancelar / vender / catálogo |
| En minijuegos: Espacio, Enter o E | Acción principal |

## 4. Cómo es un día en el casino

- Un día de juego (de las 8 a la medianoche) dura unos **8 minutos reales** (cada hora de juego = 30 segundos). Podés acelerar con 1/2/3.
- **Horario:** el día empieza a las 8, el local abre a las 10 y cierra a las 22; a medianoche se cierra el día. Antes de abrir preparás el local; después de cerrar hacés el cierre de caja.
- **Afluencia:** depende de tu *atractivo* (máquinas, mesas, decoración, reputación), de la hora (pico entre las 18 y las 21), del día de la semana, del clima, de la publicidad, del rival y de la dificultad.
- **Días de la semana:** el día 1 es miércoles. Viernes y sábado se llena (×1,4 y ×1,55); el lunes está tranquilo (×0,7).
- **Cierre de caja:** muestra ingresos y gastos por categoría, estadísticas, objetivos y lo que viene. Al final del día se pagan sueldos, cuotas, seguros y mantenimiento.
- **Objetivos diarios:** 3 por día, dan plata y XP (el día 1 son los del tutorial).
- **Dificultad:** *Normal* o *Difícil* (arrancás con 60% de plata, sueldos +20%, calor +40%, rival +40% más rápido, demanda −10%, y más eventos nocturnos).

## 5. Dinero: bolsillo, caja fuerte, banco

- **Cajas de las máquinas:** cada tragamonedas guarda lo que gana en su propia caja con tope. Con la caja llena la máquina deja de aceptar apuestas.
- **Bolsillo:** lo que vaciás va al bolsillo, que tiene un tope ($1.500, sube a $3.000 en el rango 3 y a $6.000 en el 5). Lo que quede a medianoche se deposita solo.
- **Caja fuerte:** mantené E en la ventanilla del fondo izquierdo para pasar el bolsillo al banco.
- **Banco (tecla K):** saldo, préstamos y movimientos.
- **Vender:** objetos ubicados se venden por el 50% de su precio.
- Toda la plata pasa por un único gestor (`Economy`), así las cuentas del cierre siempre cierran.

## 6. Rangos y experiencia (XP)

| Rango | Nombre | XP | Tope de juegos | Desbloquea (resumen) |
|---|---|---|---|---|
| 1 | Novato | 0 | 4 | Clásica, préstamo chico, planta |
| 2 | Encargado | 250 | 6 | Dorada, técnico, guardia, cajero, repositor, habitués, tramposos, socios |
| 3 | Croupier | 900 | 8 | Blackjack, Bingo, croupier, high rollers, préstamo mediano |
| 4 | Gerente de sala | 2.200 | 12 | Ala Este, Diamante, Dados, camarero, Barra |
| 5 | Director | 4.500 | 16 | Ruleta, Carreras, VIP, hotel, préstamo grande |
| 6 | Magnate local | 8.000 | 20 | Salón VIP (Oeste), Mega Jackpot, Póker, Nahuel Técnico |
| 7 | Barón del juego | 13.000 | 24 | Fuente, más cupo de personal |
| 8 | Rey de la noche | 20.000 | 27 | Poder comprar El Faraón |

**Cómo se gana XP:** vaciar cajas (3), reparar (5), repartir manos, servir tragos (6), recibir VIP (10), atrapar ladrones (15), día limpio (20), pasar una inspección (60), comprar un juego (10), la ganancia del día, objetivos, misiones, vuelto justo, eventos y más. Al subir de rango aparece una pantalla con lo nuevo.

## 7. Máquinas tragamonedas

| Máquina | Precio | Apuesta | Atractivo | Caja | Rango |
|---|---|---|---|---|---|
| Clásica | $900 | $25 | 1 | $200 | 1 |
| Dorada | $3.000 | $75 | 1,4 | $500 | 2 |
| Diamante | $8.000 | $200 | 2 | $1.200 | 4 |
| Mega Jackpot | $22.000 | $500 | 3,2 | $3.000 | 6 |

- **Retorno al jugador (pago):** por máquina elegís *Generosa* (95%), *Estándar* (90%), *Ajustada* (86%) o *Trucha* (78%, ilegal: deja más plata pero sube el calor 2,5 por día). Mirá la máquina y apretá R.
- **Roturas:** cada máquina se puede romper (más seguido las caras). Un técnico la repara solo; si lo hacés vos, es el **minijuego de reparación** de 3 pasos (elegir repuesto, girar cables, calibrar).
- **Mega Jackpot:** pozo progresivo que crece con las apuestas.
- Las tragamonedas tienen forma distinta según el modelo y se ven en el salón con neón y luces.

## 8. Mesas y juegos

| Juego | Precio | Asientos | Rango | Notas |
|---|---|---|---|---|
| Blackjack | $4.500 | 4 | 3 | Zapato de 6 mazos, banca pide hasta 16 y se planta con 17, blackjack paga 3:2 |
| Ruleta | $14.000 | 6 | 5 | Pleno 35:1, docena 2:1, color y par/impar 1:1 |
| Póker (Texas Hold'em) | $22.000 | 6 | 6 | La casa cobra 5% del pozo (tope $400), nunca pierde |
| Dados (craps) | $6.000 | 6 | 4 | Pase, no pase, campo, cualquier 7; tirás con el mouse |
| Sala de Bingo | $6.500 | 8 | 3 | A las 20:00 se llena; cartones de $25; premio 60% |
| Carreras de caballos | $16.000 | — | 5 | Carrera cada 40 min, margen ~15%, apostás vos desde la ventanilla |

**Repartir vos o contratar croupier.** Parate en el cuadro dorado del croupier y se abre un **minijuego a mano** (blackjack, ruleta, póker, dados, bingo). Pagar bien y rápido da propinas, XP y reputación; equivocarte cuesta reputación o plata. Un croupier contratado juega solo.

## 9. Personal

Cada empleado tiene **nombre, rango y nivel de eficiencia (1-100)**.

- **Rangos del empleado:** Aprendiz · Junior · Semi-senior · Senior · Estrella.
- **Eficiencia:** acelera sus movimientos y acorta sus tareas (reparar, vaciar, servir) y sube el sueldo (eficiencia 50 = sueldo base).
- **Contratar (Gestión → Personal → Contratar…):** elegís entre 4 candidatos distintos (cambian por día o con *Buscar otros*). Contratar cuesta 2 días de sueldo.
- **Capacitar:** +8 de eficiencia (cuesta 4 días de sueldo; el tope sube con tu rango).
- **Despedir:** por empleado.
- **Cupo:** sube con tu rango; los croupiers nunca quedan por debajo de tus mesas (uno por mesa).

| Puesto | Sueldo/día | Qué hace |
|---|---|---|
| Técnico | $150 | Repara máquinas rotas; −25% de roturas |
| Guardia | $140 | Patrulla, atrapa ladrones (55%), baja el calor |
| Cajero | $160 | Atiende la caja registradora; vacía cajas y deposita |
| Croupier | $180 | Atiende una mesa todo el turno |
| Camarero | $130 | Lleva tragos a high rollers y VIP (necesita Barra) |
| Repositor | $110 | Trae cajas de la vereda y repone góndolas |
| Recepcionista | $160 | Registra huéspedes del hotel |

**Nahuel Técnico:** técnico *Estrella* único (rango 6, $12.000 de contratación). Rulos cortos, anteojos de nerd, buzo negro, pantalón gris y credencial colgada con su nombre. Repara casi el doble de rápido que un técnico común.

## 10. Clientes

| Tipo | Presupuesto | Prefiere | Notas |
|---|---|---|---|
| Casual | $100-600 | Clásica, bingo | El 70% de la gente |
| Habitué | $300-1.800 | Dorada, blackjack, dados, bingo | Vuelve seguido |
| High roller | $2.500-9.000 | Blackjack, Diamante, ruleta, póker, dados, carreras | Pide tragos; necesita atractivo 40 |
| VIP | $12.000-40.000 | Póker, ruleta, Jackpot, carreras | Hay que recibirlos en la puerta; atractivo 120 |

Cada cliente tiene **ánimo** y **satisfacción**: suben con premios y tragos, bajan con rachas malas, esperas, máquinas rotas, pisos sucios, peleas y apagones. Al irse su satisfacción mueve tu reputación. Con la **Barra**, algunos piden tragos.

## 11. La tienda: pedidos, camión, reponer, precios y caja registradora

- **Compu de la oficina (E):** pestañas *Pedir*, *Precios*, *Envíos*, *Mejoras y licencias*, *Pronóstico* y las de dueño. Lo pedido se paga al confirmar.
- **Camión:** llega unos 40 minutos de juego después y deja cajas en la vereda. Llevás una caja por vez (E agarra, G suelta); las pesadas te frenan. Una caja grande se abre adentro en modo construcción, ya paga.
- **Góndolas:** heladera de bebidas, estante de snacks y mostrador de fichas. Reponelas con la caja de insumos en la mano (mantené E). Podés **mover** las góndolas (B) y **comprar más** (heladera extra $900, snacks extra $700; hasta 3 de cada una).
- **Precios:** vos ponés el precio de venta. El costo mayorista es 42% del precio de mercado, que **cambia cada día**. Hasta 1,15× el mercado compran normal; más caro, rezongan o no compran.
- **Caja registradora:** la fila (máx. 6). Mirá la caja y apretá E: el cliente paga con un billete y armás el vuelto con las teclas 1-7 (8 deshace, Espacio entrega). Vuelto justo: +2 XP; de más lo perdés; de menos baja la reputación. Un **cajero** lo hace solo.
- **Estante vacío:** el cliente se queja, se pierde la venta y baja la reputación.

## 12. Licencias y árbol de mejoras (tecla U)

- **10 licencias** (compra única): alfajor $250, cerveza $700, Dorada $1.200, Blackjack $2.000, espumante $2.500, Diamante $3.500, Ruleta $5.000, habano $3.000, Jackpot $8.000 y Póker $8.000. Los juegos nuevos también piden la suya.
- **Árbol de 20 mejoras en 4 ramas:** *Máquinas*, *Personal*, *Bar y comodidad*, *Negocio y calle*. Cada una pide la anterior de su rama y un rango. Ejemplos: carretes 20% más rápidos, cajas 50% más grandes, 45% menos roturas, autodiagnóstico, sueldos −20%, personal 30% más rápido, gerente, tragos premium, aire acondicionado, sala VIP, cartel luminoso, contactos en la municipalidad, licencia más barata, préstamos baratos y sabotaje a El Faraón.

## 13. Peligros: calor, inspector, ladrones, licencia, préstamos

- **Calor (0-100):** sube con las máquinas Truchas, ladrones que escapan, licencia atrasada, préstamos impagos y favores turbios; baja 4 por día y con guardias. Con 100 el casino queda **clausurado** 2 días y pagás una multa; a la **tercera clausura perdés**.
- **Inspector de Lotería (Ernesto Funes):** viene al azar (más seguido con calor alto) y cada 14 días. Si encuentra máquinas truchas: multa, más calor y menos reputación. Se lo puede coimear, pero puede salir mal.
- **Ladrones:** se acercan a la caja más llena y la vacían. Aparece un "!" rojo: miralos y apretá E para atraparlos, o dejá que lo hagan los guardias (o el guardia con bate: ¡BONK!).
- **Licencia del local:** vence cada 7 días ($1.500 + $100 por juego). Si no la pagás **dos veces seguidas, perdés**.
- **Préstamos:** Banco chico ($3.000, 20%), mediano ($10.000, 25%), grande ($30.000, 30%) y El Tano ($15.000, 50%, rango 2). Cuota diaria; si no pagás, te embargan el juego más caro.
- **Números rojos:** más de 3 días seguidos y perdés.

## 14. El rival: El Faraón

Abre enfrente el **día 6**, hace promociones cada 5 días y te saca clientes; su atractivo crece cada semana. Con mucha plata (≈ $150.000 + $500 por punto de atractivo) y el rango 8 podés **comprarlo** (ganás la partida). La dueña es Cleo Montenegro.

## 15. Construir y decorar

- **Modo construcción (B):** mirás una máquina, mesa o decoración, la levantás (E), la girás (R/T) y la ponés (fantasma verde = se puede, rojo = no, con el motivo). Grilla de 0,5 m.
- **Catálogo (C):** máquinas, mesas, decoración y *ambientes* (alfombra y color de pared por zona).
- **Zonas:** Salón principal (gratis), **Ala Este** ($10.000, rango 4) y **Salón VIP Oeste** ($30.000, rango 6), desde la pared "SE VENDE".
- **Decoración:** plantas, lámparas, alfombras, estatuas, fuente, sogas de terciopelo, neones, arañas, cuadros, la Barra. Todo suma atractivo.
- Clientes y personal caminan con **A\*** respetando los objetos ubicados.

## 16. El dueño: imagen, publicidad, seguro y robos

- **Imagen (0-100):** ropa (remera → camisa → saco → traje → traje blanco de capo → smoking dorado), accesorios (anteojos de sol, reloj de oro, cadena), auto afuera (fitito, sedán, deportivo, limusina) y lujos de la oficina. A imagen 100: +100% de high rollers y VIP, −12% de sueldos, +8% de velocidad del personal.
- **Ropero con espejo** en la oficina; se ve la ropa en tus manos en primera persona.
- **Publicidad:** volantes, radio, cartel en la ruta e influencer; rendimiento decreciente; el cierre muestra ROI por campaña.
- **Seguro:** Básico / Completo / Todo riesgo (cuota cada 7 días) contra robos, incendio y vandalismo. **Cámaras** y **caja fuerte reforzada**.
- **Robo planeado:** raro; avisos antes; esa noche una banda enmascarada intenta forzar la caja fuerte. Defendés con el tablero de seguridad (alarma, persiana, teléfono a la policía), guardias, taclear y pinchar la goma de la camioneta.

## 17. El mundo de afuera: día y noche, clima, hotel y Don Aurelio

- **Día y noche:** el cielo, la luz y la fachada siguen el reloj.
- **Clima:** soleado, nublado, lluvia, tormenta y ola de calor, con efecto por tipo de cliente. La tormenta puede cortar la luz. Pronóstico de 6 días en la compu.
- **Hotel Dorado** (rango Director): habilitación $8.000 y obra $30.000. Habitaciones Estándar ($4.000), Suite ($12.000) y Penthouse ($40.000). Los huéspedes llegan con valija, los registrás en la recepción (o una recepcionista) y a la noche bajan a jugar. Las noches se cobran al cierre.
- **Don Aurelio Cardenal:** cada 3-5 días entra y pide un favor (lavar una valija, dejar ganar a un amigo, esconder un paquete, despedir a un empleado, sabotear a El Faraón, pagar protección). Aceptar con **1**, rechazar con **2**. Sube o baja tu *Protección*.

## 18. La historia y las misiones

Campaña de 5 actos atada a los rangos: **I** La Clásica usada · **II** Papeles en regla · **III** La reina de enfrente · **IV** Noche de gala · **V** La última mano. Personajes: Lucho, Don Aurelio, Inspector Funes, Cleo Montenegro. Hay cinco decisiones con consecuencias; si aceptás dos o más favores turbios, en el Acto V tenés que pagarle **$40.000 a Don Aurelio**.

**Finales:** *El Rey de la noche* (comprás El Faraón), *La última función* (lo hundís) y el final malo ("Aurelio's"). Se sigue con la tecla **H**.

## 19. Eventos de la noche y clientes que reaccionan

Desde el día 2, cada noche pasa algo: **borracho**, **pelea**, **cumpleaños**, **tramposo**, **apagón**, **celebridad** y **bandeja de tragos**, casi todos se resuelven con E. Los clientes festejan los premios, se enojan con las rachas malas (pueden patear la máquina), se quejan en voz alta y dejan manchas de trago que hay que limpiar (mantené E).

## 20. Socios con tarjeta y torneo de póker

- **Socios (rango 2, tecla J):** ofrecé la tarjeta (E) a un cliente contento. Vuelve por su cuenta, hace pedidos y sube de nivel (Bronce → Plata → Oro) según su fidelidad. El Faraón puede tentarlos.
- **Torneo semanal de póker** (necesita Mesa de Póker): los sábados, 8 inscriptos de a $600, llave de cuartos, semis y final. La casa se queda con el 25% del pozo.

## 21. Armas, peleas y la Mafia

Tono de dibujito: nadie muere en pantalla.

- **Comprar armas** (compu → pestaña *Armas*): cuchillo $150 (rango 1), bate $320 (rango 2), pistola 9 mm $1.800 (rango 4) y cajas de municiones $120 por 12 balas (hasta 60).
- **Usar:** **F** equipa y cambia de arma; el clic izquierdo ataca.
- **Máquinas:** un golpe o tiro las rompe y les suma *daño*; el técnico tarda hasta 4,5 veces más en repararlas.
- **Clientes:** si los atacás se defienden y te pueden **noquear** unos segundos. Llega tu seguridad (o seguridad privada de la calle) a ayudarte. Perdés reputación y calor sube.
- **Disparos:** un tiro a un cliente deja una mancha de sangre estilizada. Hay que pagar una **limpieza especial** de alfombra ($450). Reputación −8, calor +14.
- **Mafia:** si le pegás o le disparás a Don Aurelio sale **"Te metiste contra la Mafia"**. Esa noche a las **21:00** llegan 3 autos con 6 pistoleros y tirotean el casino: **todas las máquinas quedan rotas** y con daño y **todo el personal desaparece** (hay que contratar de nuevo). Reputación −18, calor +22.

## 22. Modos de juego, logros y ranking

- **Modos:** *Historia*, *Sandbox* (plata infinita, sin logros), *Desafío 30 días* (llegar a $75.000 y rango Gerente de sala antes del día 30) y *Difícil sin préstamos* (puntaje ×1,5).
- **34 logros** de todos los sistemas (tecla L), con récords (mejor día, racha, ritmo de ascenso) que valen para este navegador.
- **Ranking semanal contra El Faraón:** cada 7 días se comparan ganancia, reputación y visitas; con 2 de 3 ganás la semana (+3 de reputación y +15% de clientes) y si perdés Cleo te roba clientes.

## 23. Sonido, música y gráficos

- **Todo el audio es sintético** (Web Audio, sin archivos): murmullo de salón, jingles, monedas, caja fuerte, lluvia, música lounge/jazz que cambia con la hora y una variante tensa con inspector o calor alto. Menú de pausa: volumen general, música y efectos; tecla M silencia.
- **Gráficos:** *Automática* (ajusta la resolución según los FPS), *Alta*, *Media* y *Baja*. Opción de mostrar FPS y de balanceo de cámara. El juego usa 8 luces dinámicas como máximo.

## 24. Guardado de partida

- Se guarda solo en el navegador (`localStorage`): partida `casino-dorado-partida-v2`, logros `casino-dorado-logros-v1`, gráficos `casino-dorado-graficos-v1`, sonido `casino-dorado-sonido-v1`.
- Guarda cada hora de juego y al cerrar el día (también con G sin caja en las manos).
- Cada campo se valida al cargar: una partida dañada se descarta con aviso y empezás de nuevo.
- Las partidas de versiones anteriores cargan (los sistemas nuevos arrancan en cero).
- En modo privado o con los datos del sitio bloqueados, no se guarda.
- Para pasar la partida a otra computadora no hay exportación todavía (ver límites).

## 25. Arquitectura técnica

**Tecnología:** HTML + JavaScript puro, **Three.js r128** (incluido en `lib/`), sin compilar ni instalar nada. Todos los modelos 3D, texturas y sonidos son procedurales: no hay imágenes ni audios.

**Archivos y orden de carga (`index.html`):**

| Archivo | Rol |
|---|---|
| `data.js` | Todos los números del juego (`window.CASINO_DATA`): rangos, máquinas, mesas, personal, clientes, tienda, mundo, combate… |
| `art.js` | Modelos y animaciones procedurales (`window.CasinoArt`): máquinas, mesas, gente con esqueleto, decoración |
| `decor.js` | Modo construcción, catálogo, colocación y validación |
| `game.js` | Núcleo: bucle, economía, clientes, personal, UI, guardado, controles |
| `audio.js` | Sonido y música sintetizados |
| `minigames.js` | Blackjack, ruleta y reparación a mano |
| `poker.js` | Póker: evaluador de manos, mesa y minijuego |
| `life.js` | Reacciones de clientes y eventos de la noche |
| `upgrades.js` | Licencias y árbol de mejoras |
| `shop.js` | Tienda, camión, góndolas, precios, caja registradora |
| `owner.js` | Imagen del dueño, publicidad, seguro y robos |
| `challenge.js` | Modos de juego, logros, ranking |
| `world.js` | Día/noche, clima, hotel, favores de Don Aurelio |
| `games.js` | Dados, bingo y carreras |
| `clients.js` | Socios y torneo de póker |
| `staff.js` | Personal con nombre, rango y eficiencia; Nahuel |
| `combat.js` | Armas, peleas, sangre y la Mafia |
| `story.js` | Historia, diálogos y misiones |

**Patrón de módulos:** cada sistema es un archivo que expone `window.CasinoX` y recibe un *puente* `window.CasinoXBridge` que `game.js` arma con lo que necesita (estado `S`, economía, funciones). `game.js` llama a los módulos con enganches opcionales (`window.CasinoX?.fn?.()`), así que sacar un archivo no rompe el resto.

**Reglas importantes:**
- Toda la plata pasa por `Economy`.
- El estado de la partida es `S`; cada módulo guarda su parte (`S.shop`, `S.owner`, `S.world`, `S.clients`, `S.combat`, `S.crew`, etc.) y `sanitize()` valida todo al cargar.
- No se agregan luces dinámicas (el tope es 8).
- Los números de balance viven en `data.js` (o al principio de cada módulo), no repartidos por el código.

**Depuración:** en la consola del navegador, `casinoDebug` permite avanzar el tiempo (`casinoDebug.step(segundos)`), ver el estado y probar funciones. Cada módulo tiene su `CasinoX.debug`.

**Cómo agregar contenido:** una máquina o mesa nueva se agrega en `data.js` (`MACHINES` / `TABLES`) y su modelo en `art.js`; un empleado en `STAFF`; un logro en `challenge.js`; una misión en `story.js`.

## 26. Pruebas automáticas

Las pruebas usan Playwright con Chromium y conducen el juego con `casinoDebug`. Cubren: humo de integración, tienda, góndolas, personal, combate, dueño, mundo, juegos, socios, desafío/logros, minijuegos, póker y vida del local; verifican cero errores de consola, guardar/recargar, partidas viejas y que las luces sigan en 8. En esta entrega las pruebas de **combate (57)**, **personal (23)**, **dueño (40)**, **mundo (46)**, **póker (32)**, **góndolas (38)** y **humo (9)** pasan completas. Algunas pruebas largas (vida del local, tienda, juegos, clientes, desafío) fallan de forma intermitente por tiempos en el navegador de prueba, también sobre la versión anterior sin cambios; no se detectó un error real.

## 27. Limitaciones conocidas y próximos pasos

- Solo para computadora; no hay soporte táctil/celular pulido.
- La partida vive en el navegador; falta exportar/importar la partida.
- Los números de balance (precios, tiempos, dificultad del combate y de la Mafia, eventos nocturnos) son una **primera versión**: falta la opinión de más jugadores.
- Los clientes caminan sobre una grilla simple y en una fila pueden rozarse.
- Hay un máximo de personas a la vez para cuidar el rendimiento.
- Las armas y la Mafia son una primera versión: sin gore, y reparar a mano una máquina golpeada limpia el daño igual.
- Ideas futuras: más tipos de máquinas, más actos de historia, multijugador cooperativo, versión móvil, más idiomas, sonidos grabados y modelos 3D importados.

---

*Casino Dorado — versión 1. Creado por Manu con Claude. Three.js © los autores de three.js (licencia MIT).*
