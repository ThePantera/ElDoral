# Casino Dorado · v2 — Cambios

## Lavado de cara, paso 2: objetos redondeados

- **Chau bloques:** los muebles del salón ya no parecen armados con cajas. Todas las piezas tienen los cantos redondeados de verdad (un cuarto de caño en cada arista), con la luz que se desliza suave por el borde en vez de marcar cada cara. Lo plano sigue plano.
- **Tragamonedas:** gabinetes con cantos blandos, molduras de bronce al pie y bajo la repisa, botones redondeados con aro cromado, palanca con pomo liso, copetes más redondos (arco, abanico, aro del Jackpot) y columnas torneadas en la Dorada. Mismos colores, medidas y frente.
- **Banquitos:** pie de bronce torneado, caño, apoyapié, copa bajo el asiento y almohadón de cuero acolchado (domo) con costura dorada. Se usan en máquinas, mesas y barra; la gente se sienta a la misma altura.
- **Mesas:** blackjack con baranda de cuero más gorda y lisa, pie torneado y filetes dorados en el faldón; póker con tapa de canto redondeado, pedestales torneados con anillo de bronce y baranda acolchada; ruleta con cilindro más fino, torreta torneada y molduras doradas; dados con baranda de cuero bien redonda; bingo con sillas tapizadas acolchadas y patas redondas; carreras con mueble y pantalla de cantos suaves.
- **Barra y caja:** botellas torneadas (cuerpo, hombro y cuello), vasos de verdad, canilla con pomo, apoyapiés con remates redondos, media caña bajo la tapa; la jaula de la caja con pomitos en los barrotes y la caja fuerte con dial y manija redondeados.
- **Decoración:** maceta torneada con borde enrollado, lámpara de pie con base torneada y filetes dorados en la pantalla, estatua con pedestal de zócalo y cornisa y figura torneada, fuente con pileta de borde enrollado, columna y tazón torneados; farol, columna de mármol, cuadros y neones nuevos también. Arañas, pilastras y la soga de terciopelo, más redondas.
- **Tienda y oficina:** heladera, góndola de snacks, caja registradora, escritorio, silla, ropero, acuario, caja fuerte de la oficina, cámaras y tablero de alarma con cantos redondeados; latas, botellas y paquetes con forma.
- **Rendimiento:** mismas llamadas de dibujo por objeto (las piezas siguen fundidas por material y cacheadas) y la decoración de mármol y bronce ahora se funde en menos mallas. Hay unas 3 veces más triángulos, pero la geometría fundida pasó a ser **indexada** (cada vértice se ilumina una vez): cada máquina tiene ~8.200 vértices contra ~9.000 antes, y lo mismo en mesas, barra y caja. Sin luces nuevas (siguen 8).
- Medición (Playwright + SwiftShader, salón lleno: 12 máquinas, blackjack, ruleta, barra y 4 decoraciones; `render` + `readPixels`, versión vieja y nueva en el mismo navegador con tandas intercaladas; mediana en ms por cuadro). Gráficos media: salón 721 → 712, máquinas de cerca 722 → 675, mesa 777 → 737. Gráficos Alta: salón 1684 → 1751 (+4 %), máquinas 1633 → 1578, mesa 1665 → 1690 (+1,5 %), dentro del ruido. Llamadas de dibujo del salón ~224 en las dos versiones.
- No toca la economía, el balance ni el guardado: las partidas viejas cargan igual. La fachada y la calle no se tocaron.

## Lavado de cara, paso 1: color y luz

- **Colores de verdad:** la imagen ahora sale con el manejo de color correcto (sRGB). Antes los colores se veían lavados y la luz pareja, como de juguete; ahora las sombras son más profundas y los brillos (máquinas, carteles, neones) resaltan más que el resto.
- **Paleta de casino elegante:** bordó profundo, madera oscura laqueada, negro y bronce. Las máquinas mantienen su color (Clásica roja, Dorada oro, Diamante turquesa, Jackpot violeta) pero más profundo; banquetas y tapizados en bordó cuero.
- **Alfombra:** mucho más oscura y apagada, con un dibujo chico y fino tono sobre tono. Ya no se roba la pantalla.
- **Paredes:** todas iguales: empapelado damasco bordó con friso arriba, zócalo de madera con pasamanos de bronce y pilastras cada tantos metros. Las paredes de las ampliaciones sin comprar ya no son gris chapa: tienen el mismo empapelado y el "SE VENDE" es un cartel enmarcado.
- **Techo artesonado:** casetones oscuros con vigas, filetes dorados y un spot empotrado en cada uno (son brillos pintados, no luces: no pesan). En un apagón los spots se apagan.
- **Luz falsa:** charcos de luz cálida en el piso bajo las arañas y frente a los neones, penumbra al pie de las paredes y en los rincones, y adentro una niebla cálida y oscura que pierde el fondo del salón en penumbra.
- Cero luces nuevas (siguen siendo 8), sin sombras reales ni posproceso. Se ve bien en Gráficos "Alta" y en las demás calidades. No cambia nada de la economía ni del guardado: las partidas viejas cargan igual.

## Personajes nuevos (people.js)

- **Las personas cambiaron de cara:** clientes, personal, ladrones, inspector, policía, la Mafia y el doble del dueño en el espejo ahora usan el personaje de **Kenney** (pack *Animated Characters*, licencia **CC0**, dominio público): cabezona redonda, cuerpo simpático, ojos y cejas que expresan. Créditos y detalles en [`CREDITOS_PERSONAJES.md`](CREDITOS_PERSONAJES.md).
- **Ropa pintada por look:** cada persona tiene su textura (pelo, piel, remera, mangas, pantalón, zapatos) pintada por código sobre el mapa UV de Kenney y guardada por look. El personal se distingue: croupier con chaleco negro, moño y brazaletes dorados; cajero con chaleco verde y visera; seguridad de negro con gorra, insignia y radio; policía de azul con insignia plateada; técnico con mameluco naranja y bandas reflectivas; repositor con delantal. Los clientes salen en remera, chomba o buzo de colores; los VIP en traje con corbata y pañuelo; la Mafia de negro; las mujeres con melena, pestañas, aros y vestido (las VIP).
- **Caras con gestos:** neutral, parpadeo, feliz, triste, enojada, sorprendida y mareada (también versión mujer). Están en un atlas compartido y el shader las pone en la cara: cambiar de gesto es cambiar de material, sin piezas sueltas.
- **Misma animación:** caminar, sentarse en los banquitos, jugar, festejar, palanca, botón, batazo, piñas, tirado en el piso y el baile del caño siguen igual: el modelo viene horneado con los mismos 11 huesos del juego (`J.hips`, `J.armR`, `J.elbowL`…) y las mismas medidas para lo que se cuelga de ellos (gorros, anteojos, bandeja, bate, pistola, carpeta, credencial).
- **Rendimiento:** 1 malla con huesos por persona + la sombra (2 llamadas de dibujo, igual que antes), geometría compartida (~1.600 triángulos contra ~2.000), materiales y texturas cacheados, un solo programa de shader. Con 40 personas en pantalla, en Gráficos media dio igual o más rápido que antes; en Alta, parejo dentro del ruido de la medición (ver abajo). Fuera de Gráficos "Alta" pasan por los materiales rápidos de `perf.js`.
- **Funciona con doble clic:** el modelo (un `.glb` de 66 KB) va embebido en `js/people-assets.js` y lo lee `lib/GLTFLoader.js` (three.js r128). Unos 200 KB más en total.
- Sin luces nuevas, sin cambios de economía ni de balance. Las partidas viejas cargan igual.
- Medición (Playwright + SwiftShader, 40 personas caminando y sentadas, `render` + `readPixels`, versión vieja y nueva en el mismo navegador con tandas intercaladas; la máquina estaba cargada, así que se da mediana y mínimo en ms por cuadro). Gráficos media: de cerca 838 → 761 (mín. 529 → 497), lejos 716 → 721 (mín. 684 → 620). Gráficos Alta: de cerca 1617 → 1952 (mín. 1357 → 1131), lejos 1415 → 1360 (mín. 1034 → 680). Llamadas de dibujo 252 antes y después; triángulos de las personas ~138.000 → ~96.000; animar 40 personas por CPU ~1 ms en los dos casos. De cerca las cabezas grandes de Kenney ocupan más pantalla (más píxeles para pintar), por eso en Alta la mediana de cerca salió más alta con mucho ruido.

## Piñas y la policía (combat.js)

- **Puño limpio:** siempre lo tenés, sin comprar nada. Con **F** cambiás entre puños, cuchillo, bate, pistola y nada en la mano. Las piñas son a lo dibujito (¡PUM!, ¡PAF!) y alternan mano izquierda y derecha. A una máquina no la rompés con la mano: te duele a vos.
- **Todos se defienden:** los clientes ya lo hacían; ahora también el personal. Si le pegás a un empleado deja lo que estaba haciendo, te devuelve las piñas (el de seguridad pega más fuerte) y, cuando se calma o se levanta, vuelve a su puesto.
- **Escándalo:** una barrita abajo al centro. La suben tus piñas y disparos, las peleas entre clientes que nadie separa y la Mafia. Baja sola con el tiempo.
- **Policía:** si el escándalo llega al tope, alguien llama al 911. A los 8 segundos llegan dos patrulleros con balizas y cuatro policías que entran a despejar el salón: se llevan esposado a cualquiera que esté peleando (clientes, pistoleros de la Mafia, vos si pegaste hace poco) y también **a cualquiera que tengan adelante**, vos incluido. A los empleados que están peleando solo los calman. Los clientes se asustan y se van.
- **Si te llevan a vos:** pantalla de rejas, multa de $900 (por `Economy`, categoría Multas), te sacan un 25 % del bolsillo y perdés 2 horas del día. Volvés a la entrada con la salud llena.
- **Contra la Mafia:** la llegada de la Mafia ya hace que los vecinos llamen. Si la policía se lleva a todos los pistoleros a tiempo, el tiroteo se corta y el personal que todavía no cayó se salva.
- Sin luces nuevas (las balizas son solo color). Números en `data.js` (`COMBAT.riot`, `COMBAT.police`, `COMBAT.staff`, `COMBAT.fists`). Partidas viejas cargan igual y ya tienen los puños.

## Salón ultra VIP secreto (vip.js) · contenido opcional +18

- **Opcional:** viene apagado. Se activa en **Esc → Contenido +18** (pide confirmar que tenés 18 o más). Todo es ficción y nada explícito: el baile es vestido y el reservado es una puerta cerrada con fundido a negro. Todos los personajes son adultos.
- **Misión «El salón de Madame Rubí»:** con el +18 activado y rango 5 (Director), te dejan una tarjeta: la estantería del fondo del salón principal (detrás de las máquinas, a la izquierda del cartel JACKPOT) suena hueca. Aceptás, pagás la obra ($15.000), contratás una acompañante, le sacás el candado y atendés al primer cliente: premio $5.000 y 200 de experiencia.
- **El salón:** detrás de la estantería (E entra y sale, R abre el panel). Barra privada, escenario con caño de baile, sillones y un **reservado** donde entra 1 cliente con 1 acompañante (luz verde libre, roja ocupado).
- **Acompañantes:** hasta 3. Madame Rubí manda 4 candidatas por día con edad (21 a 34) y carisma. Contratarla cuesta según el carisma; cobra por noche y la mitad de cada servicio. La de más carisma baila en el caño (más propinas).
- **Candado:** con candado no entra nadie. Sin candado, con el casino abierto, llegan clientes ultra VIP que pagan entrada y barra ($350), propinas y el reservado (tarifa Discreta, Premium o Diamante: más cara, menos clientes). Vos también podés usar el reservado, pagando de la plata del casino.
- **Inspector:** si viene mientras el salón está sin candado, lo puede descubrir (50 % más el calor, según cuánto de su visita estuvo abierto; con candado 6 %). Si lo descubre: multa $20.000, +30 de calor, −8 de reputación y el salón clausurado 3 días. Si llega con el salón abierto te avisa, y si corrés a ponerle el candado bajás el riesgo. La coima aceptada también lo tapa. Cada día abierto suma 1,5 de calor por los rumores.
- Toda la plata pasa por `Economy` en categorías nuevas del reporte; los números están en `data.js` (`VIPNIGHT`). Sin luces nuevas. Las partidas viejas cargan igual (con el +18 apagado).

## Volver cada día (daily.js)

- **Premio del día:** la primera vez que entrás cada día (según la fecha de tu compu) aparece un cartel con la racha de 7 días: $300, $500, $800, $1.200, $1.800, $2.500 y $4.000, más experiencia. Si volvés días seguidos la racha sube; del día 7 en adelante te quedás en el premio más alto. Si te salteás un día, la racha vuelve a empezar (se guarda tu mejor racha). Cada rango arriba del 1 suma 35 % a la plata.
- **Mientras no estabas:** si tenés personal y estuviste afuera más de una hora, tu gente juntó el 4 % de lo que ganaste el último día por cada hora (con tope de 8 horas). Si no tenés personal, el cartel te avisa que contratando te espera esa plata.
- El cartel sale unos segundos después de entrar, cuando no hay otro panel abierto, y también si pasás la medianoche jugando. Al cerrarlo: monedas y caja registradora.
- La partida nueva arranca con el día de hoy ya contado: el primer premio llega mañana. En el modo Sandbox no hay premio.
- Toda la plata entra por `Economy` en dos categorías nuevas del reporte ("Premio del día" y "Mientras no estabas"); los números están en `data.js` (`DAILY`). Las partidas viejas cargan igual y cobran el premio del día 1.

## Enganche: meta a la vista y festejos (juice.js)

- **Meta siempre visible:** debajo del rango, el panel muestra la próxima compra con su barra (banco + bolsillo contra el precio, con la licencia si falta). Si ya te alcanza algo que no tenés, dice "¡Comprá: …!" y se pone verde. Cuando llegás a la meta suena, se ilumina y aparece un aviso. Tiene en cuenta máquinas, mesas y ampliaciones de tu rango, y el tope de juegos.
- **Lluvia de monedas** al vaciar una caja y al depositar en la caja fuerte. El saldo del banco **cuenta hacia arriba** en dorado.
- **Premios grandes y Mega Jackpot:** monedas que saltan de la máquina; el jackpot además muestra el cartel "¡MEGA JACKPOT!" con brillo dorado si estás cerca.
- **Subir de rango:** papel picado de colores, brillo dorado y el cartel del rango entra con un salto.
- **Hitos del banco** ($10.000, $25.000, $50.000, $100.000…): cartel grande y monedas, una vez por partida (los que ya pasaste al cargar no se repiten).
- Una sola malla instanciada para todas las partículas (1 llamada de dibujo), sin luces nuevas. Partidas viejas cargan igual.

## Primera hora más guiada (guide.js)

- **Flecha dorada y cartel:** una flecha flota sobre el lugar a donde tenés que ir y un cartel arriba al centro dice qué hacer, con una flechita que gira hacia el objetivo y los metros que faltan. Sigue los pasos del tutorial de Lucho: abrir, vaciar la Clásica, depositar, pedir en la compu, levantar la caja del camión, ubicar la máquina, reponer la heladera o los snacks y cobrar en la caja registradora.
- Hasta el rango 2 también avisa cuando el bolsillo está casi lleno, cuando una máquina tiene la caja llena o cuando está rota y no tenés técnico.
- Se apaga en **Esc → Gráficos → Guía: no** (se recuerda en el navegador).
- **Panel más simple:** el día 1 el panel muestra solo plata, hora, rango, misión, reputación, velocidad y objetivos. Calor, imagen, atractivo y rival, licencia y el ranking semanal aparecen a partir del día 2 (o antes si hace falta: calor apenas sube, licencia si tomás un préstamo).
- **Arranque más rápido:** la partida nueva empieza a las 9:30 en vez de las 8:00 (`CFG.firstDayStart`).
- **Avisos ordenados:** mientras hay un diálogo de la historia abierto, los avisos esperan y salen después. Los consejos del tutorial salen de a uno, cada 3,5 s (`CFG.hintGapSec`).
- Partidas viejas: cargan igual (no hay datos nuevos en la partida).

## Fluidez: materiales rápidos (perf.js)

- **Materiales rápidos:** en Gráficos *Automática*, *Media* y *Baja*, todos los `MeshStandardMaterial` se crean como material Lambert (luz por vértice). En la prueba con el casino lleno (23 máquinas, 4 mesas, 34 clientes) el salón se dibuja entre 1,7 y 3 veces más rápido. *Alta* conserva los materiales con brillo real de la v1.
- Piso, techo, paredes, zócalos, paredes "SE VENDE", alfombras de zona y la vereda tienen más vértices con materiales rápidos, para que las luces de techo sigan marcando sus círculos.
- **Baja** además apaga el suavizado de bordes. Cambiar entre *Alta* y el resto, o entrar y salir de *Baja*, guarda la partida y recarga la página.
- Las tragamonedas que están fuera de cámara o a más de 16 m no redibujan la pantalla mientras giran (cada redibujo sube una textura a la placa de video).
- Sin cambios en el guardado ni en la cantidad de luces (8).

## Personal por escala y Nahuel Técnico (staff.js)

- **Fichas:** cada empleado tiene nombre, rango (Aprendiz · Junior · Semi-senior · Senior · Estrella) y eficiencia 1-100. La eficiencia acelera sus movimientos y acorta tareas (reparar, vaciar cajas, servir) y sube el sueldo (curva suave: eficiencia 50 = sueldo base).
- **Contratar:** Gestión → Personal → *Contratar…* muestra 4 candidatos distintos (cambian por día o con *Buscar otros*); contratación = 2 días de sueldo. **Capacitar** sube +8 de eficiencia (cuesta 4 días de sueldo; el tope sube con tu rango). **Despedir** por empleado.
- **Cupo:** los topes por rango subieron y el de croupiers nunca queda por debajo de tus mesas (una por mesa). El panel muestra el cupo total, el cupo por puesto y las mesas cubiertas.
- **Nahuel Técnico:** técnico Estrella único (rango 6, $12.000 de contratación): rulos cortos, anteojos de nerd, buzo negro, pantalón gris y credencial colgada al cuello. Repara casi el doble de rápido que un técnico común.
- `window.CasinoStaff.killAll()` saca a todo el personal (incluida la recepcionista del hotel) sin pagar nada; lo usa el ataque de la mafia.
- Partidas viejas: cada empleado recibe nombre, rango Junior y eficiencia 50 (mismo sueldo que antes). El guardado se valida (`S.crew`).

## Armas, peleas y la Mafia (combat.js)

- **Comprar armas** en la compu de la oficina → pestaña **Armas**: cuchillo ($150, rango 1), bate de béisbol ($320, rango 2) y pistola 9 mm ($1.800, rango 4) + cajas de municiones ($120 por 12 balas, hasta 60). Categoría de gastos "Armas y municiones".
- **Equipar con F** (cicla cuchillo → bate → pistola → guardada). Con un arma en la mano el **clic izquierdo ataca**; E y el resto de las teclas siguen igual, y sin arma el clic usa lo que mirás como siempre. Arma en primera persona, mira central y cartelito abajo con balas y salud.
- **Máquinas:** un golpe o un tiro la rompe y le suma *daño*; cuanto más daño, más tarda el técnico en repararla (hasta 4,5 veces). El daño se limpia al arreglarla y se guarda en la partida.
- **Clientes:** si le pegás con un arma blanca se defiende (con las manos), te saca salud y te puede **noquear**: la cámara cae al piso unos segundos. Llega **seguridad privada** (tu guardia si tenés, y si no aparece ayuda desde la calle), le da un bate al agresor y te cuida hasta que te despertás. Perdés reputación y calor sube; al despertar se te cae un poco de plata del bolsillo. Si te defendés a tiempo, el cliente queda K.O. y se va.
- **Disparos:** un tiro a un cliente lo tira al piso y deja una **mancha de sangre estilizada** en la alfombra; hay que pagar una **limpieza especial** ($450, mirás la mancha y E). Mientras esté, baja el atractivo. Reputación −8 y calor +14. Los demás clientes se asustan. Sin gore: se levanta rengueando y se va.
- **Don Aurelio:** si le pegás o le disparás sale el cartel **"Te metiste contra la Mafia"**. Esa noche a las **21:00** llegan 3 autos negros con 6 pistoleros y **tirotean** el salón: todas las máquinas quedan rotas y con daño, los clientes escapan y **todo el personal cae y desaparece** (hay que recontratarlo). Reputación −18 y calor +22.
- Ficción de tono dibujito: nadie muere en pantalla. Luces dinámicas sin cambios (8). Partidas viejas cargan igual; todo se valida al cargar (`S.combat`).

## Góndolas movibles y ampliables (heladera y estantería de snacks)

- **Mover:** modo construcción (**B**), mirás la heladera o la estantería, **E** la levantás, **R** la girás de a 90°, **E** la ponés (fantasma verde/rojo como todo lo demás). Clientes y repositor van al frente nuevo; la posición se guarda con la partida.
- **Comprar más:** compu → Pedir → **Góndolas**: heladera extra ($900) y estantería de snacks extra ($700), rango 2, hasta 3 de cada una. Llega en camión como caja grande; la abrís adentro y la ubicás como una máquina.
- **Capacidad:** cada unidad extra suma la capacidad de sus productos (bebidas o snacks); se ve en el salón. Clientes y repositor usan la góndola más cercana.
- Partidas viejas: todo queda en su lugar original con 1 unidad de cada una. Las góndolas no se venden.

## El dueño: imagen, publicidad, seguro y robos grandes (owner.js)

**Imagen (0-100).** Tu personaje progresa: ropa (remera → camisa → saco → traje a medida → traje blanco de capo → smoking dorado), accesorios (anteojos de sol, reloj de oro, cadena), auto y lujos de la oficina.
- **Ropero con espejo** en la oficina (a la derecha de la entrada): te ves de verdad en el espejo con la ropa y los accesorios puestos. La ropa también se ve en **tus mangas y manos** en primera persona (con el reloj en la muñeca).
- **Auto** estacionado en la vereda, a la derecha de la entrada: fitito usado → sedán → deportivo rojo → limusina blanca. Elegís cuál dejar afuera.
- **Oficina:** escritorio de caoba, alfombra persa, retrato al óleo tuyo (se pinta con la ropa que tengas), acuario con peces y caja fuerte enchapada en oro.
- Efectos a imagen 100: +100% de high rollers y VIP, −12% de sueldos (el personal te respeta), +8% de velocidad del personal y −15% en lo que cobra la mafia (pagos de la historia).
- Se compra en la compu (pestaña **Imagen**), en el ropero (ropa y accesorios) o con la tecla **I** (celular). La imagen aparece en el HUD.

**Publicidad** (compu → Publicidad): volantes (barato, 2 días, casuales; se ven en la fachada), aviso en la radio (5 días, habitués; una radio en el escritorio pasa el jingle), **cartel en la ruta** (10 días, high rollers y VIP; un cartel gigante enfrente) y **visita de una influencer** (viene a filmar a las 17; rinde más con tu imagen y si la recibís vos). Cada campaña suma demanda por tipo de cliente con rendimiento decreciente (techo por tipo). El cierre de caja muestra cada campaña activa con clientes extra, ingreso estimado y **ROI**.

**Seguro y seguridad** (compu → Seguro y seguridad): seguro Básico / Completo / Todo riesgo con cuota cada 7 días (sube con el calor y con siniestros recientes) que cubre robos (cajas y caja fuerte), incendio y vandalismo con franquicia. Cámaras (2 niveles: monitoreo que llama solo a la policía, guardias que reaccionan al toque, sospechosos marcados con "?", policía más rápida) y caja fuerte reforzada (3 niveles, visible adentro de la jaula de la caja).

**Robo planeado.** Raro; más probable con mucha plata en el banco y calor alto. Avisos uno o dos días antes: tipos de anteojos negros que estudian la caja fuerte (encaralos con E: se les cae la libretita) y una llamada anónima. La noche del robo, a las 22:30, frena una camioneta de "florería" y baja una banda enmascarada que va a forzar la caja fuerte. Una barra arriba muestra la línea de tiempo (Llegan → Forzando → Escapan → Camioneta), el progreso y el estado de alarma, persiana, policía y guardias. Para defenderte:
- **Tablero de seguridad** a la izquierda de la puerta: botón rojo de **alarma** (se apuran y se llevan menos; con cámaras avisa a la policía), palanca de la **persiana de acero** de la bóveda (+18 s) y **teléfono rojo** a la policía.
- **Guardias** con bate van solos por cada ladrón (¡BONK!).
- **Taclear** con E a un ladrón cerca (si lleva la bolsa, la recuperás).
- **Pinchar una goma** de la camioneta (mantené E) mientras espera: largan las bolsas y huyen a pie.
- Si la policía llega a tiempo, detiene a los que quedan. Lo que se va en la camioneta lo cubre en parte el seguro.
El día no se puede cerrar mientras la banda está adentro. Tono de dibujito, sin sangre.

## Qué hay de nuevo respecto de la v1

**El juego ahora se juega con las manos, como Schedule I.**
- **Cajas de las máquinas.** Cada tragamonedas junta lo que gana en su propia caja, que tiene un tope. Con la caja llena la máquina muestra "CAJA LLENA" y no acepta apuestas. Hay que ir, mirarla y **mantener Usar** para vaciarla en el bolsillo.
- **Bolsillo y caja fuerte.** El bolsillo tiene un tope que crece con el rango. La plata se pasa al banco **manteniendo Usar** en la ventanilla de la caja fuerte (fondo izquierdo). Lo que quede en el bolsillo a medianoche se deposita solo.
- **Rangos y XP** (8 rangos, de Novato a Rey de la noche). Se gana XP vaciando cajas, reparando, repartiendo cartas, recibiendo VIPs, sirviendo tragos, atrapando ladrones, con la ganancia del día y con los objetivos. Cada rango desbloquea máquinas, mesas, personal, zonas y decoración, y sube el tope de juegos. Al subir de rango aparece una pantalla que muestra lo nuevo.
- **Mesas de juego:** Blackjack, Ruleta y Póker, con lugares fijos en el piso. Podés **repartir vos mismo** parándote en el cuadro dorado del croupier, o contratar un croupier.
- **Personal visible que trabaja:** técnico (camina a la máquina rota y la repara), guardia (patrulla y persigue ladrones), cajero (vacía cajas y deposita), croupier (atiende una mesa) y camarero (lleva tragos; necesita la Barra).
- **Clientes con tipo:** casual, habitué, high roller y VIP. Los VIP hay que recibirlos en la puerta. Si hay Barra, algunos piden tragos: tomás uno en la barra y se lo llevás.
- **Ladrones.** Algunos clientes se acercan a la caja más llena y la vacían. Si ves el "!" rojo, miralos y usá para atraparlos.
- **Calor e inspector de Lotería.** Las máquinas en pago Trucha (ilegal) dejan más plata pero suben el calor. El inspector viene al azar (más seguido con calor alto) y además cada 14 días. Si encuentra máquinas truchas pone multa, sube el calor y baja la reputación. Lo podés coimear, pero puede salir mal. Con calor 100 el casino queda clausurado; a la tercera clausura perdés.
- **Préstamos** de tres tamaños, con cuota diaria. Si no pagás, te embargan un juego.
- **Licencia** que vence cada 7 días. Si no la pagás dos veces seguidas, perdés.
- **Rival: El Faraón**, que abre enfrente el día 6, hace promociones y te saca clientes. Con mucha plata se puede **comprar** (eso gana la partida).
- **Ampliaciones:** Ala Este y Salón VIP (Oeste), que se compran desde la pared "SE VENDE". También están la Barra y la decoración (plantas, lámparas, alfombra, estatua, fuente), que suben el atractivo.
- **Objetivos diarios** (3 por día) que dan plata y XP. El día 1 trae objetivos fijos de tutorial.
- **Cierre de caja** detallado: qué entró y salió del banco, las estadísticas del día, los objetivos y lo que se viene.
- **Dificultad** Normal o Difícil al empezar una partida.
- **Velocidad x1/x2/x4** y botón para saltar las horas en que el casino está cerrado ("Abrir ya" / "Cerrar el día").
- Pistas de una sola vez, textos flotantes de plata y XP, íconos sobre la cabeza de cada persona (trago, estrella VIP, "!" de ladrón) y barras de progreso sobre las máquinas.

## Arreglos de la v1 (según qa/QA_V1.md)
- **B1** La reputación ya no se desploma por la fila. Los clientes que esperan en fila solo se van molestos después de esperar un buen rato.
- **B2** Si comprás parado sobre el cuadro, el juego te corre a un lugar libre y no quedás atrapado.
- **B3** Una partida nueva te pone otra vez en la entrada, aunque estuvieras dentro de un ala.
- **B4** El fin de partida se guarda. Si recargás la página, el título dice "Ver el final de la partida" y no deja seguir jugando.
- **B5** Si guardás a mitad del día, al cargar seguís a la misma hora.
- **B6** Todo usa `box-sizing: border-box` y los paneles no se desbordan.
- **B7** En pantallas táctiles todos los textos dicen "Usar" en vez de "E".
- **B8** Para empezar una partida nueva hay que confirmarlo con un aviso dentro de la página (sin `confirm()`).
- **B9** Una partida guardada dañada se valida campo por campo. Si no sirve, se descarta, se avisa con un mensaje y empezás de cero, sin NaN.
- **B10** El día 1 se guarda desde el arranque y también cada hora de juego.
- **B11–B13** y las notas de UX: las pantallas importantes (cierre de caja, rango, fin de partida) no se cierran sin querer. Todos los paneles tienen botón ×. En el teléfono, el HUD se compacta con "Más/Menos". Mientras un panel está abierto el juego se pausa.

## Controles

**Computadora**
| Tecla | Acción |
|---|---|
| WASD / flechas | Caminar (Shift para correr) |
| Mouse | Mirar (clic en la pantalla para capturar el mouse; si el navegador no lo permite, se mira arrastrando) |
| E o clic izquierdo | Usar. Mantener para vaciar cajas, reparar y depositar |
| R o clic derecho | Opciones de lo que mirás (pago de la máquina, vender) |
| P / B / O | Personal / Banco / Objetivos |
| U | Licencias y mejoras (árbol de 4 ramas) |
| G | Soltar la caja que llevás (si no llevás nada, guarda la partida) |
| 1 2 3 | Velocidad x1 x2 x4 |
| N | Saltar las horas cerradas |
| Esc | Menú y pausa |

**Teléfono:** joystick abajo a la izquierda para caminar, arrastrar en la pantalla para mirar, botón **Usar** (tocar o mantener), botón **Opciones** (aparece cuando mirás una máquina o mesa), **Gestión** y **Menú**.

## Limitaciones conocidas
- ~~Cuando repartís vos en una mesa de póker, la mano se resuelve sola~~ Desde la sección «Póker» el póker también tiene minijuego.
- Las máquinas y mesas van en lugares fijos (los cuadros dorados) y no se pueden mover. Para cambiarlas de lugar hay que venderlas.
- No hay ciclo de día y noche en la iluminación. El reloj y el cartel ABIERTO/CERRADO marcan el horario.
- No se modeló el rol de anfitrión: recibir a los VIP en la puerta lo hace el jugador.
- Los clientes caminan sobre una grilla de navegación simple, así que en una fila pueden rozarse entre ellos.
- Para no castigar teléfonos lentos, hay un máximo de 34 personas a la vez y no hay sombras en tiempo real.
- La partida se guarda solo en este navegador (localStorage, clave `casino-dorado-partida-v2`). En modo privado o con los datos del sitio bloqueados no se guarda.
- `index.html` carga `data.js` y `art.js` junto a `game.js`. Al publicar hay que poner las copias de `src/` al lado.

## v3 · Sonido

**Todo el sonido se genera en el navegador con Web Audio: no hay archivos de audio.** Está en `audio.js`, que se carga después de `game.js`.
- **Arranca recién cuando tocás "Abrir el casino".** Antes de eso no se crea ningún contexto de audio. Si escondés la pestaña, el audio se suspende, y cuando volvés sigue.
- **Ambiente del salón.** El murmullo de la gente sale de voces sintéticas con formantes y sube con la cantidad de clientes que hay adentro. Se suman jingles lejanos de las máquinas libres, fichas de vez en cuando y el zumbido del salón. Si salís a la vereda, el ambiente se escucha apagado, como detrás de la puerta.
- **Sonidos con posición.** Volumen según la distancia, paneo estéreo según hacia dónde mirás y filtro para lo que está lejos. Los sonidos demasiado lejanos ni se disparan.
  - Tragamonedas: palanca y giro de los rodillos, clic al frenar, premio chico, premio grande y fanfarria de Mega Jackpot con lluvia de monedas.
  - Mesas: cartas (repartir y mezclar) y fichas en Blackjack y Póker; en la Ruleta, la bola girando, cayendo y rebotando.
  - Plata y personal: monedas al vaciar una caja, la caja fuerte (manija, dial y cerrojo) al depositar, caja registradora al comprar, depósito del cajero, rotura y reparación de máquinas, tragos.
- **Personas y eventos.** Puerta con campanita cuando entra un cliente, timbre especial cuando llega un VIP, alarma cuando aparece un ladrón, golpe musical cuando llega el inspector, fanfarria al subir de rango, campanita de objetivo cumplido, campana de apertura y de cierre del día, clics de la interfaz y zumbido de error. Tus pasos suenan distinto en la alfombra y en la vereda.
- **Música propia, tipo lounge/jazz.**
  - Base: piano eléctrico con acordes de jazz en Fa, bajo caminante y batería con escobillas.
  - Cambia con la hora: tranquila antes de abrir, más llena a la noche (con ride y vibráfono en la hora pico) y suave después del cierre.
  - Con el inspector adentro o con calor de 70 o más pasa a una **variante tensa** en Re menor: ostinato de bajo, hi-hat, pad grave y timbal.
  - Baja sola durante las fanfarrias.
- **Ajustes en el menú de pausa:** volumen general, de música y de efectos, y botón "Silenciar todo". La tecla M también silencia. Se guarda en este navegador (`casino-dorado-sonido-v1`); la partida no cambia de formato.
- **Liviano para el teléfono.**
  - Las muestras se generan una sola vez y quedan en memoria; se van creando de a una en segundo plano.
  - Hay 14 canales de voz reutilizables, con prioridad: las alarmas y fanfarrias pueden cortar un sonido menos importante.
  - Mientras está silenciado, el contexto queda suspendido.
- **Depuración:** `casinoDebug.audio` tiene contadores por evento (recibidos, reproducidos, salteados), cuántas notas tocó cada instrumento, el estado del contexto, `graph()` e `inspect()`.

## v3 · Minijuegos a mano

Como en Schedule I: al principio el trabajo lo hacés vos con las manos, y después lo automatiza el personal. Los croupiers y técnicos contratados siguen trabajando solos como antes.

- **Blackjack de croupier.** Parate en el cuadro dorado de una mesa de Blackjack sin croupier y se abre una hoja abajo (la mesa 3D se sigue viendo arriba). Reglas reales con zapato de 6 mazos: repartís, los clientes deciden solos según su tipo (el casual juega de oído, el habitué sabe la estrategia básica, el high roller y el VIP además doblan), revelás tu carta tapada, la banca **pide hasta 16 y se planta con 17**, y pagás o cobrás cada asiento: **Cobrar, Empate, 1:1 o 3:2** (el blackjack paga 3:2). Rondas de 15 a 25 s.
- **Ruleta de croupier.** Los clientes apuestan (color, par/impar, docena o pleno), cantás **"No va más"**, lanzás la bola parando la aguja de fuerza (floja o muy fuerte = tirada nula) y la ruleta 3D gira de verdad y decide el número. Después pagás cada apuesta: pleno 35:1, docena 2:1, color y par/impar 1:1, con el 0 pierden todas menos el pleno al 0.
- **Velocidad y precisión.** Pagar bien y rápido da **propinas en efectivo al bolsillo**, +1 XP por asiento y +2 XP y reputación por ronda perfecta. Un error de regla de la banca o una tirada nula bajan la reputación; pagar de menos enoja al cliente (se va) y pagar de más le cuesta plata a la casa. Si tardás mucho en repartir, los jugadores se cansan y se levantan; si la ronda es lenta, no hay propinas.
- **Reparación a mano en 3 pasos** (reemplaza el "mantener 8 s"): elegir el repuesto que corresponde a la falla (uno equivocado te cuesta 25% del repuesto), girar los cables hasta que las flechas apunten a la derecha y calibrar con la aguja en la zona verde. Bien hecha tarda 4-6 s y da XP extra (+4 impecable, +2 buena).
- Mientras jugás un minijuego el reloj va a x1, no te movés y el joystick se oculta. En computadora: **Espacio/Enter/E** = acción principal, **1-4** = opciones. "Dejar la mesa" te corre un paso atrás.
- Balance: con buenos pagos, repartir vos rinde un poco más que un croupier contratado (que además cobra sueldo), sobre todo al principio con casuales y habitués. Los números están al principio de `minigames.js` (`MG_CFG`).
- Archivos: `minigames.js` nuevo (cargado después de `game.js`). `game.js` expone `window.CasinoMGBridge` y tiene ganchos de una línea en `updateTables`, `tableInteract`, `machineInteract`, `breakMachine`, `updatePlayer` y `ui.blocking`. `art.js`: `spin(onResult, power)` acepta una fuerza opcional. No hay campos nuevos en la partida guardada.
## v3 · Historia y misiones

**Una campaña de 5 actos atada a los rangos**, aparte de los objetivos diarios (que siguen igual).
- **Personajes** (todos inventados): **Lucho**, tu primer empleado, que te guía en el tutorial y espera en la entrada (hablale para pedir pistas). **Don Aurelio Cardenal**, un prestamista encantador y peligroso, con traje blanco y clavel. El **Inspector Ernesto Funes**, de Lotería, que ahora tiene nombre y un sello para cada emoción. **Cleo Montenegro**, dueña de El Faraón.
- **Diálogos**: un cuadro abajo de la pantalla con el nombre, un retrato dibujado en canvas (mueve la boca mientras habla), texto que se escribe solo y botones para elegir. Se avanza tocando el cuadro, con clic o con Espacio/Enter/E. Las opciones también se eligen con 1 2 3. Mientras hay un diálogo el juego queda en pausa. Los personajes aparecen en el casino como personas y después se van caminando por la puerta.
- **Actos**: I · La Clásica usada (rango 1), II · Papeles en regla (2), III · La reina de enfrente (3, con El Faraón abierto), IV · Noche de gala (4–5) y V · La última mano (6+). En cada recorrido hay entre 17 y 19 misiones: vaciar y depositar, la deuda con Don Aurelio con fecha límite, sobrevivir a una inspección sorpresa de Funes con calor menor a 30, ganarle en atractivo a El Faraón, conquistar a los high rollers, la promo del camello, la barra, la noche de gala VIP (llegan VIP a la noche), los ladrones que manda Don Aurelio y el final.
- **Cinco decisiones con consecuencias**: aceptar o no la plata de Don Aurelio, guardarle la valija o aguantar su presión, sabotear la promo de El Faraón o competirle limpio, aceptar sus máquinas especiales o avisarle a Funes, y comprar El Faraón o hundirlo. Los favores turbios dan plata y calor. **Si aceptás dos o más**, en el Acto V tenés que pagarle **$40.000 a Don Aurelio para recuperar tu libertad**. Si no llegás, viene el **final malo** ("Aurelio's") y termina la partida.
- **Finales**: *El Rey de la noche* (comprás El Faraón con la compra de siempre, en el rango 8), *La última función* (lo hundís: 3 cierres seguidos con 1,6× su atractivo y reputación 70+, y Cleo te deja las llaves) y el final malo.
- **Recompensas**: plata, XP, reputación y **trofeos únicos** que suman atractivo: el Diploma de Funes, el neón DORADO, el retrato del high roller, la Clásica de oro y la Esfinge de El Faraón.
- **Registro de Historia** con las misiones activas y su progreso, los pagos a Don Aurelio, tus decisiones, los trofeos, las misiones terminadas y los personajes que conociste. Se abre con el botón **Historia** de arriba a la derecha, desde el menú de pausa, tocando la línea de historia del HUD o con la tecla **H**. El HUD muestra siempre la misión principal, también con el HUD compacto.
- Se guarda dentro de la partida (`S.story`). Las partidas viejas arrancan la campaña desde el principio, y si ya pasaron el día 2 se saltean el tutorial.
- Código nuevo en `story.js`. En `game.js` solo se agregaron ganchos de una línea: el atractivo de los trofeos en `decorAtr`, la evaluación al cierre en `endDay`, que `sanitize` conserve `story` y que `casinoDebug.fn` exponga algunas funciones internas. Para probar está `window.CasinoStory.debug`.
## v3 · Decorar y mover (modo construcción)

- **Modo construcción** con la tecla **B** (o el botón **Construir**; en el teléfono, arriba de Gestión). Mientras está activo, el tiempo se pausa.
  - Mirás una máquina, mesa o decoración y la **levantás** (E / clic / botón Levantar). Aparece un fantasma **verde** si se puede poner o **rojo** si no, con el motivo: choca con una pared u otro objeto, tapa la entrada o la fila, queda en una zona que no compraste, tapa el lugar de juego de otra máquina o **le cierra el paso** a algún juego, a la caja fuerte o a la barra.
  - Grilla de 0,5 m. **R** gira 90°, **T** gira 45° (las mesas giran de a 90°). **Q** cancela, **X** vende (te devuelven el 50%), **C** abre el catálogo.
  - Cuadros y neones se cuelgan en las paredes; la araña cuelga del techo; las alfombras se pisan y van debajo de cualquier cosa.
- **Catálogo** (Máquinas, Mesas, Decoración, Ambientes). Decoración nueva: soga de terciopelo, alfombra redonda dorada, alfombra persa, farol de bronce, columna de mármol, cuadro al óleo, retrato del fundador, neón 777, neón «Dorado» y araña de cristal. Cada una suma atractivo.
- **Ambientes:** alfombra y color de pared para cada zona comprada. Las opciones pagas suman atractivo.
- Los cuadros dorados del piso siguen funcionando como lugares sugeridos: comprás ahí y el objeto queda ubicado en ese punto. Si algo ocupa el lugar, el cuadro desaparece.
- Clientes, personal, ladrones e inspector caminan con **A\*** en una grilla de 0,5 m que respeta los objetos ubicados y las zonas cerradas.
- **K** abre el Banco (antes era B).
- **Partidas guardadas:** cada objeto guarda x, z y giro. En las partidas v2, lo que estaba en un lugar fijo pasa a ser un objeto ubicado en esas mismas coordenadas. La clave del guardado sigue siendo la misma.

## v3.1 — Gráficos más fluidos
- Calidad gráfica en el menú de Pausa: Automática (por defecto), Alta, Media y Baja. Se guarda en este navegador.
- Automática mide los FPS y baja o sube la resolución interna sola para mantener el juego fluido (lo que más pesaba era dibujar demasiados píxeles en pantallas de alta densidad).
- Baja además apaga las luces del cartel de la fachada.
- Botón "Mostrar FPS" para ver los cuadros por segundo y la escala de resolución.

## Póker
**Mesa de Texas Hold'em donde la casa no juega: cobra comisión.**
- **Mesa de Póker** (rango 6 · $22.000 · 6 asientos · ciegas de $50 a $1.000). Se compra en Gestión o en el catálogo del modo construcción, y se puede mover y girar como las otras mesas. Modelo nuevo en `art.js`: mesa ovalada de paño verde con baranda acolchada, fichas frente a cada asiento, bandeja del croupier, botón del dealer, cartas comunitarias, cartas de cada jugador y la pila del pozo, todo a la vista.
- **La casa cobra el 5% de cada pozo, con tope de $400.** Sin flop no se cobra («no flop, no drop»). Los clientes juegan entre ellos con límite fijo, una apuesta y una resubida por calle, y la IA se retira, iguala o sube según la fuerza de su mano. Los high rollers y los VIP prefieren el póker; los habitués también juegan. Para sentarse hace falta plata para 8 ciegas grandes. Un jugador solo espera rival un rato y después se va.
- **Con croupier contratado**, cada 15 s se juega una mano entera sola: la comisión va a la bandeja y en la mesa quedan las cartas de la última mano.
- **Sin croupier repartís vos** (minijuego). Te parás en el cuadro dorado y:
  1. **Repartir** (Espacio/Enter/E): dos cartas a cada uno. Los jugadores apuestan solos.
  2. Cuando terminan las apuestas: **1 Quemar carta** y **2 Dar el flop / turn / river**. Si repartís mientras todavía apuestan, o das la calle sin quemar, es error.
  3. **Showdown:** con las cartas a la vista, elegís quién tiene la mejor mano (1…n) o **Empate: dividir el pozo**. Si te equivocás, el que tenía la mejor mano se queja y se va, y baja la reputación.
  4. **Comisión** (1-3): sin comisión, el 5% correcto (con tope) o un monto equivocado. Si cobrás de más, los jugadores protestan; si cobrás de menos, la casa pierde plata.
  5. **Empujar el pozo** (Espacio) al ganador.
  - Rápido y sin errores: propina del ganador al bolsillo, XP y un poco de reputación. Se cuenta para el objetivo «Repartí 30 manos». Lento o con errores: sin propina y con quejas.
- Evaluador de manos (7 cartas → la mejor de 5, con desempates y la escalera baja A-2-3-4-5) y pruebas en node: `node tests/poker.test.js`.
- Archivos: `poker.js` nuevo (`window.CasinoPoker`, cargado después de `minigames.js`). `minigames.js` acepta minijuegos de otros archivos con `CasinoMG.register` y las teclas numéricas llegan hasta el 9. `game.js`: `playRound` le pasa la mesa de póker a `CasinoPoker.autoHand`, `makePokerTable` usa `art.js` y el puente expone `sfx`. `data.js`: la mesa de póker pasa al rango 6, con comisión y tope. No hay campos nuevos en la partida guardada.

## Local más vivo
**Los clientes reaccionan y cada noche pasa algo que te obliga a moverte.**

**Reacciones de los clientes**
- **Premio grande o jackpot:** el ganador se para, salta con los brazos arriba y grita; los de al lado lo miran o aplauden (con jackpot, aplauden más lejos). Aparece un ícono de plata sobre la cabeza.
- **Racha mala:** después de 6 tiros perdidos el cliente niega con la cabeza y se enoja; con 10 o más, a veces le pega una patada a la máquina (golpe, la máquina tiembla y muy de vez en cuando se rompe).
- **Ánimo:** cada cliente tiene un ánimo que sube con los premios y los tragos y baja con las rachas malas, la espera, el piso sucio, las máquinas rotas, las peleas y los apagones. Cuando se va, el ánimo entra en su satisfacción (y en la reputación).
- **Íconos flotantes** de ánimo (contento, enojado, triste, plata, rota, sucio, esperando…) y **globitos de charla** cortos, en rioplatense, solo cerca tuyo y con poca frecuencia.
- **Quejas:** los clientes se quejan en voz alta de las máquinas rotas, de las manchas en el piso y de esperar en la fila.
- **Manchas en el piso:** a veces se cae un trago. Cada mancha resta 3 de atractivo hasta que la limpiás (mirala y **mantené E**, 3 XP). Lo que quede a la noche lo limpia el servicio de limpieza.
- **Murmullo del salón:** el ruido de la gente sigue la cantidad de clientes y sube un rato con los festejos, las peleas y los apagones.

**Eventos de la noche** (desde el día 2: 1 por día en Normal y 2 en Difícil, con chance de uno más desde el rango 3; se anuncian con un aviso y quedan en el HUD con su tiempo)
- **Borracho:** entra tambaleando y molesta a los que juegan. Miralo y **E** para acompañarlo afuera (+reputación, XP), o lo saca un guardia. Si lo ignorás, termina en pelea.
- **Pelea:** dos clientes se agarran a las piñas. **E** sobre uno de ellos para separarlos (+reputación, XP), o un guardia. Si nadie hace nada: baja mucho la reputación, sube el calor, se puede romper una máquina y la gente de alrededor se va.
- **Cumpleaños:** un grupo de 4 a 6 con gorritos espera en la entrada. **E** sobre el cumpleañero para saludarlo: juegan con más plata y, si hay Barra, piden tragos; al irse dejan propina (en "Eventos de la noche"). Si nadie los saluda, se ofenden.
- **Tramposo** (rango 2): se sienta y le saca plata de a poco a una máquina o a una mesa (números rojos y "777" raros). Él y dos clientes cerca tienen "?". **E** para revisar: si acertás recuperás el 80% y ganás XP; si te equivocás, el inocente se ofende y se va. Un guardia también puede agarrarlo. Si lo ignorás, se va con la plata.
- **Apagón** (rango 2): salta la térmica, las tragamonedas se apagan y el salón queda en penumbra (sin luces nuevas: se bajan las que hay). Andá al tablero eléctrico del fondo a la izquierda y **mantené E** para subir la térmica, o esperá al técnico. Mientras dure, la gente se va y la reputación baja.
- **Celebridad** (rango 3 y reputación 45): llega alguien famoso con anteojos negros. Recibilo en la puerta con **E** y cuidá su ánimo (barra en el HUD): sin fila, sin máquinas rotas, sin manchas, con un trago. Si se va contento: mucha reputación, XP y plata; si no, baja la reputación. Mientras está, viene más gente.
- **Bandeja de tragos:** se caen 3 manchas juntas; limpialas antes de que se acabe el tiempo.
- La dificultad escala: en Difícil hay menos tiempo y las consecuencias pesan más; el rango, la reputación y el calor cambian qué eventos salen.
- El cierre de caja muestra lo que pasó en la noche y hay una categoría nueva de ingresos, "Eventos de la noche".

**Archivos:** `life.js` nuevo (`window.CasinoLife`, cargado después de `poker.js` y antes de `story.js`). `game.js` tiene enganches mínimos y el puente `window.CasinoLifeBridge`; `data.js` suma `LIFE` (todos los números) y la categoría `events`; `art.js` deja apagar una tragamonedas (`setDark`); `audio.js` suma festejo, aplauso, queja, golpe, piña, apagón, vuelta de la luz, trago volcado y fiesta. En la partida guardada solo se agrega `life: { day, fired }` (validado en `sanitize`); los eventos en curso no se guardan.

## Tienda al estilo TCG

**Ahora lo pedís todo por computadora, te lo trae un camión y lo acomodás con las manos.** Se inspira en TCG Card Shop Simulator.

**La compu y las cajas**
- **La compu de la oficina**, al lado de la caja fuerte. Miralo y apretá **E**. Tiene cuatro pestañas: **Pedir** (Máquinas, Mesas, Decoración, Barra e Insumos), **Precios**, **Envíos** y **Mejoras y licencias**. Lo pedido se paga al confirmar.
- **El camión** llega 40 minutos de juego después del pedido (unos 20 s a x1). Toca bocina y deja **cajas de cartón** en la vereda.
- **Llevás una caja por vez.** **E** la levanta. **G** la suelta, y **E** también la suelta si no estás mirando algo que la reciba. Las cajas de máquinas, mesas y la barra son pesadas y te frenan: con una tragamonedas caminás al 55% de la velocidad, con una mesa al 50%, con decoración al 80% y con una caja de insumos al 88%.
- **Abrir una caja grande** (tragamonedas, mesa o decoración) adentro del local te pone en **modo construcción** con ese objeto ya pago: verde o rojo como siempre, R/T para girar, E/clic para ubicarlo. **Q** cancela y la caja vuelve a tus manos. Si llevás la caja a un cuadro dorado, se instala ahí directamente. La caja de la Barra se abre en el lugar de la barra.
- El **modo construcción (B)** sigue sirviendo para mover, girar y vender lo que ya tenés. El catálogo C ahora te manda a la compu para las máquinas, las mesas y la decoración (los Ambientes se siguen comprando ahí).
- **Plan B para la historia:** la partida nueva empieza con dos cajas de insumos en la vereda (gaseosa y papas). Las misiones que piden comprar una máquina o la barra explican cómo hacerlo con la compu.

**Reponer**
- Hay tres muebles nuevos: la **heladera de bebidas** (gaseosa, cerveza, espumante), el **estante de snacks** (papas, alfajor, habano) y el **mostrador de fichas** al lado de la caja registradora (vasos de fichas).
- Con la caja de insumos en la mano, mirá el mueble y **mantené E**: las unidades pasan una por una y se ven llenarse las latas, los paquetes y los vasos. Cada 8 unidades repuestas ganás 1 XP.
- **Estante vacío:** el cliente se queja en voz alta, se pierde la venta, baja el ánimo (−0,12) y baja la reputación (−0,25).

**Precios y mercado**
- Ponés el precio de venta de cada producto (en la pestaña Precios de la compu, o con **R** mirando el mueble). El costo mayorista es el 42% del precio de mercado del día.
- **El mercado cambia cada día:** deriva al azar (σ 6%) y tiende a volver a su precio base (15% por día). Hay un 8% de chance de un salto (×1,3 o ×0,75), y el precio queda siempre entre 0,55× y 1,9× del base. La compu muestra la historia de los últimos 10 días.
- **Cómo reaccionan los clientes:** hasta 1,15× del mercado compran normal; entre 1,15× y 1,35× compran menos y rezongan; por encima de 1,35× se quejan y no compran. Por debajo de 0,9× se ponen contentos.

**Caja registradora y vuelto**
- Al entrar, algunos clientes compran fichas (38% de los casuales, 30% de los habitués, 20% de los high rollers y 12% de los VIP), y durante la noche el 38% hace una pausa para comprar bebida o snack. Todos hacen fila en la caja registradora (máximo 6 personas, con 25 s de paciencia).
- **Cobrar a mano:** mirá la caja y apretá **E**. El cliente paga con un billete y vos armás el vuelto con **1–7** ($1, 2, 5, 10, 20, 50, 100), **8** para deshacer y **Espacio** para entregar. **Vuelto justo:** +2 XP y ánimo. **Vuelto de más:** lo perdés (se anota como "Vuelto de más" en el cierre). **Vuelto de menos:** el cliente se enoja y baja la reputación (−0,8). Si cobrás en menos de 5 s, el cliente deja $2 de propina.
- **Caja sin atender:** si no estás a menos de 4 m de la caja, no tenés la caja abierta y no hay cajero, los clientes no compran. Se pierde la venta y baja un poco el ánimo.
- El **cajero** contratado atiende la caja solo (2,6 s por cliente). Si no hay fila, vacía las cajas de las máquinas como antes.

**XP, licencias y mejoras (tecla U o la compu)**
- **10 licencias** que se compran una sola vez cuando tu rango llega: alfajor ($250), cerveza ($700), Dorada ($1.200), Blackjack ($2.000), espumante ($2.500), Diamante ($3.500), Ruleta ($5.000), habano ($3.000), Jackpot ($8.000) y Póker ($8.000). Sin la licencia, eso no se puede pedir.
- **Árbol de 20 mejoras en 4 ramas** (Máquinas, Personal, Bar y comodidad, Negocio y calle). Cada mejora pide la anterior de su rama y un rango. Todas tienen efectos reales: carretes 20% más rápidos, cajas un 50% más grandes, 45% menos roturas, jackpot progresivo, autodiagnóstico (la máquina se arregla sola), sueldos −20%, personal 30% más rápido, guardias que van por los tramposos, gerente que vacía las cajas al 80% y deposita, turnos dobles, tragos premium, aire acondicionado (+50% de paciencia), asientos de lujo, música en vivo, sala VIP, cartel luminoso, contactos en la municipalidad, licencia más barata, préstamos baratos y sabotaje a El Faraón.
- Vender, reponer y cobrar dan XP: 1 por producto vendido a mano, 2 por vuelto justo y 1 por cobro rápido.

**Personal nuevo**
- **Repositor** (rango 2, $110 por día). Trae las cajas de insumos de la vereda y repone los muebles. Las cajas de máquinas y mesas las deja al lado de la compu para que las abras vos.
- **Cajero:** ahora atiende primero la caja registradora.

**Historia:** la misión de la segunda máquina se explica con la compu y el camión. Hay una misión nueva, **"El kiosco"** (reponer 6 unidades y cobrar 3 veces a mano; da $150 y 30 XP). Los textos de Personal y Barra están actualizados.

**Guardado:** todo va dentro de la partida (`S.shop`: stock, precios, mercado, pedidos, cajas en la vereda, la caja que llevás, estadísticas; `S.licenses`, `S.upgrades`) con la misma clave `casino-dorado-partida-v2`. Se valida campo por campo. Las partidas viejas cargan con stock inicial, precios de mercado y sin licencias ni mejoras.

**Archivos:** `shop.js` (tienda, cajas, camión, reponer, precios, caja registradora, repositor) y `upgrades.js` (licencias, árbol de mejoras, tecla U) son nuevos y se cargan después de `life.js`. `data.js` suma `SHOP`, `LICENSES`, `UP_BRANCHES` y `UPGRADES`, el rol `stock` y las categorías de plata nuevas. `game.js` tiene ganchos y el puente `window.CasinoShopBridge`. `decor.js` acepta colocaciones ya pagas (`startPrepaid` / `placePrepaid`). `minigames.js` suma `openSession`. `audio.js` suma bocina, cajas y cinta. `story.js` suma la misión del kiosco. No hay luces dinámicas nuevas.

**Limitaciones:** en una partida vieja, si algo quedó encima de la heladera, los snacks o la compu, no se mueve solo (movelo con B). Los tragos de la Barra no descuentan de la heladera. En el teléfono la caja se suelta con Usar cuando no mirás nada que la reciba (no hay botón G).

## Modos de juego, logros y ranking contra El Faraón (challenge.js)
- **Modos de juego** en la portada, al lado de la dificultad, cuando empezás una partida nueva:
  - **Historia**: la partida de siempre.
  - **Sandbox**: plata infinita (el banco nunca baja de $5.000.000), rango máximo, todas las licencias y sin historia. Los logros y récords no cuentan.
  - **Desafío 30 días**: llegá a $75.000 en el banco y al rango Gerente de sala antes del cierre del día 30. El HUD lleva la cuenta regresiva (en rojo los últimos 5 días). Al cumplirlo o al terminarse el plazo aparece una pantalla de victoria o derrota con puntaje (+$400 de puntaje por cada día de sobra). Si perdés, la partida termina.
  - **Difícil sin préstamos**: siempre en Difícil, el banco no presta, un evento de la noche más por día y puntaje ×1,5.
  - El modo se guarda con la partida y se ve en la Pausa (con el puntaje). Las partidas viejas cargan como Historia.
- **Logros (34)** de todos los sistemas: primer jackpot, ladrones (a mano, con seguridad, con el bate), días de $10.000 y $100.000, manos perfectas en blackjack/ruleta/póker, reponer góndolas, vuelto exacto, un día sin quejas, tragos, VIP, cajas, reparaciones, eventos de la noche (pelea, celebridad, apagón, tramposo), rachas, rangos, final de la historia, comprar El Faraón, semanas ganadas, desafío y modo sin préstamos. Al desbloquear uno sale un aviso dorado con sonido. Valen para todas las partidas en este navegador (`casino-dorado-logros-v1`).
- **Panel de logros (tecla L**, botón en la Pausa y en Gestión): barras de progreso, **récords** (mejor día, racha más larga de días con ganancia, día más rápido a los rangos 3, 5 y 8, mejor puntaje por modo) y **ranking**.
- **Ranking semanal contra El Faraón**: cada 7 días se comparan la ganancia, la reputación y las visitas de la semana. Los números de El Faraón salen de su atractivo, de cómo te va a vos (si le ganás, invierte más) y de la historia (el sabotaje del camello, sus promos). Con 2 de 3 rubros ganás la semana: +3 de reputación y +15% de clientes durante 2 días. Si perdés, Cleo se burla y te roba clientes: −15% durante 2 días y −0,5 de fidelidad. La temporada (ganadas, perdidas, puntos) se ve en la pantalla y en el panel.

## v3 · El mundo de afuera: día y noche, clima, hotel y favores (world.js)
**Día y noche.** El cielo, la niebla, el sol/luna y las luces de la fachada siguen el reloj: amanecer a las 8, día, atardecer naranja desde las 16:30 y noche azul después de las 20. No se agregó ninguna luz: solo cambian el color y la intensidad de las que ya estaban.
- **Días de la semana** en el HUD (el día 1 es miércoles). Viernes y sábado se llena (demanda ×1,4 y ×1,55, y entra más gente por asiento); el lunes está tranquilo (×0,7). Al empezar cada día un aviso te dice qué día es y el clima.
- **Clima por día**: soleado, nublado, lluvia, tormenta u ola de calor, con efecto por tipo de cliente. Con **lluvia** caen gotas sobre la calle y la vereda (se ven por la puerta), el piso de afuera brilla mojado, suena la lluvia (fuerte en la vereda, sorda adentro) y vienen menos casuales (los high rollers y VIP vienen igual). La **tormenta** trae relámpagos (el cielo se pone blanco y truena) y un rayo puede **cortar la luz** (el apagón de life.js es 3 veces más probable). Con **ola de calor** todos quieren algo fresco: los habitués piden tragos en la barra y el kiosco vende el doble de bebidas.
- **Pronóstico** de 6 días en la compu de la oficina (pestaña Pronóstico): clima, efecto en la demanda por tipo de cliente y en el hotel.

**Hotel Dorado.** En Gestión → Hotel (rango Director): habilitación hotelera ($8.000) y obra ($30.000). Aparecen dos pisos arriba del ala oeste con ventanas que se prenden según la ocupación, cartel de neón, marquesina, **recepción** y **ascensor** en la vereda a la izquierda de la entrada.
- Las habitaciones se compran de a una: Estándar ($4.000, $180 la noche), Suite ($12.000, $550; pide 2 estándar) y Penthouse ($40.000, $2.200; rango 6, pide 2 suites y reputación 60).
- Los **huéspedes** llegan con la valija entre las 12 y las 20 y esperan en la recepción: mirá el mostrador y apretá **E**, y dale la llave correcta con **1–4** (propina y XP; si te equivocás se enoja). O contratá una **recepcionista** ($160/día) que los registra sola. Si nadie los atiende en un rato, se van.
- A la noche bajan por el ascensor a jugar: Estándar juega como habitué, Suite como high roller y Penthouse como VIP, con más presupuesto y más rondas (más todavía si llueve).
- Las noches se cobran al **cierre de caja**, junto con el mantenimiento y la limpieza (mucamas: si las suspendés, la limpieza baja y con menos de 40% cae la reputación). La ocupación depende de la reputación, el día de la semana, el clima y la limpieza. Todo se ve en Gestión → Hotel y en el reporte del día.

**Favores de Don Aurelio.** Cada 3–5 días Don Aurelio entra al salón (mismo diálogo y retrato de la historia) y pide un favor. Aceptás con **1**, rechazás con **2**. El favor en curso, con su plazo, queda en el HUD y en Gestión → Favores.
- Lavar una valija (que entren $8.000 en apuestas en 2 días: te quedás el 30%, sube el calor y cuenta como favor turbio para la historia), dejar ganar a un amigo (recibilo en la puerta con E a las 19: la casa pierde $1.800–3.200), esconder un paquete en la oficina 3 noches (si el inspector lo encuentra: multa y calor), despedir a un empleado, sabotear a El Faraón (cruzá la calle después de las 20 y mantené **E** en su tablero de luz: pierde atractivo 3 días) y pagar protección.
- **Protección** (0–100, en el HUD): menos ladrones y peleas y coimas más fáciles. Cumplir sube la protección; fallar o rechazar la baja, y si lo rechazás seguido manda ladrones. Baja 3 por día.
- Número de balance en data.js → `WORLD`.

## Juegos nuevos: Dados, Bingo nocturno y Carreras de caballos (games.js)
Los tres se piden en la compu (pestaña Mesas) con su licencia, o se ubican en el modo construir como cualquier mesa. Cada uno tiene su propia línea en el cierre de caja y un resumen en las novedades del día.
- **Mesa de Dados** (rango 4 · $6.000 · licencia $2.500). Craps con pagos reales: pase y no pase (el 12 empata), campo (el 2 paga doble y el 12 triple) y cualquier 7 (4 a 1). Sin croupier sos el stickman: **arrastrá los dados con el mouse y soltalos con impulso** para que reboten contra la pared de pirámides del fondo (si no llegan, es tiro nulo; si van demasiado fuertes, un dado se cae de la mesa), o pasáselos al tirador con **Espacio**. Después **cantá la tirada (1-3)**: cantar mal te cuesta reputación. Las rachas de puntos hechos o naturales hacen **¡mano caliente!**: festeja la mesa y la gente de alrededor, y la mesa atrae más clientes un rato. Si se tira un siete afuera, la mesa rezonga. Un croupier contratado tira solo.
- **Sala de Bingo** (rango 3 · $6.500 · licencia $2.200). Ocho sillas, mesa larga, tablero luminoso grande y bolillero. A las 19:30 se anuncia y desde las **20:00** la sala se llena de clientes que vienen solo al bingo. Se venden cartones de $25 (hasta 4); el premio es el 60% de lo vendido. Parado en el bolillero, **E** saca una bolilla y elegís el número que leés (1-3); si cantás lento, la sala se aburre y se va gente. Cuando alguien grita **¡BINGO!**, verificá el cartón (**E**) y decidí si es válido (1) o falso (2): pagar un bingo falso, rechazar uno bueno o seguir cantando sin verificar un bingo bueno cuesta reputación. Un croupier contratado canta y verifica solo.
- **Carreras de Caballos** (rango 5 · $16.000 · licencia $6.000). Ventanilla de apuestas con pantalla gigante; además está la **Pantalla de carreras (pared)** (rango 5 · $3.500) para colgar en cualquier pared. Cada 40 minutos de juego corre una carrera de 6 caballos con cuotas (animación 2D en la pantalla, la misma en todas). Los clientes apuestan en la ventanilla y la casa se queda con un margen de ~15%. Mirando la ventanilla, **E** abre el panel para que **apuestes con tu bolsillo** ($50 a $500, con la agencia hípica). Los batacazos hacen festejar y los favoritos que pierden hacen rezongar. No necesita croupier.
- Los clientes eligen según su tipo: los casuales y habitués van al bingo, los habitués y high rollers a los dados, high rollers y VIP a las carreras.
- Partidas viejas cargan igual (las estadísticas nuevas arrancan en cero).

## Socios con tarjeta y torneo de póker (clients.js)
**Clientes fieles.** Desde el rango 2, un cliente contento (le sale un corazón arriba) se puede hacer socio: miralo y **E → "Ofrecer tarjeta de socio"**. El socio queda guardado en la partida con nombre, aspecto (el mismo muñeco), juego favorito, presupuesto y personalidad (charlatán, exigente, tranquilo, fiestero, apostador).
- Vuelve otros días por su cuenta (más seguido cuanto más fiel), te saluda con un globito y lleva un distintivo de socio del color de su nivel.
- **Pedidos:** "Quiero la máquina Diamante", "mesa de Blackjack con apuesta alta", "un trago premium" (llevale uno de la barra), "poné música" (miralo y E para ponerle su tema; con Música en vivo se cumple solo). Si no tenés su juego, te lo pide **para la próxima visita**.
- Cumplir suma fidelidad, fallar o ignorar la resta. **Bronce → Plata (40) → Oro (75)**: más visitas, más presupuesto y apuesta, propina al irse (plata y oro) y amigos (oro). Con fidelidad 0 cancela la tarjeta.
- **El Faraón** a veces tienta a un socio: si su próxima visita (en 2 días) no sale bien, se va enfrente.
- **Panel de socios (tecla J, o desde Gestión):** cada socio con nivel, fidelidad, gustos, última visita y pedido pendiente; también las bajas. Línea en el HUD con los socios en el local y sus pedidos.

**Torneo de póker semanal** (necesita la Mesa de Póker): todos los sábados (día % 7 = 6), anunciado 3 días antes (aviso + línea en el HUD).
- 8 inscriptos pagan $600 cada uno: 2 famosos con aspecto propio (saco de color y anteojos de sol), hasta 2 de tus socios y jugadores del barrio. A las 16:30 llegan y se sientan en la mesa, que queda reservada; a las 17:00 arranca.
- Llave de cuartos, semis y final, cada partido al mejor de 3 manos con el evaluador de poker.js. Si repartís vos en la mesa (minijuego de póker), cada mano del torneo da +6 XP, propina y define el partido en curso.
- Al final, festejo del campeón (panel con la tabla final), la casa se queda con el 25% del pozo ("Torneo de póker" en el cierre) y el resto es el premio. Si hubo croupier al menos la mitad del torneo o repartiste 2 manos sale bien: +6 de reputación, +80 XP y 50% más gente el resto de la noche. Si no, −2 de reputación.
- Panel J → pestaña "Torneo de póker" con la llave en vivo, el pozo y el último torneo. Se guarda a mitad de torneo y sigue al recargar.
- Números en `CASINO_DATA.CLIENTS` y `CASINO_DATA.TOURNEY` (data.js). Guardado en `S.clients`, validado campo por campo; los guardados viejos cargan sin socios.
