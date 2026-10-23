/* Casino Dorado v2 — datos de diseño y economía.
 * Script plano de navegador (sin módulos). Define window.CASINO_DATA.
 * Todos los números salen de design/DISENO_V2.md y están balanceados con la simulación.
 * Tiempos en "segundos de simulación" (1 hora de juego = CFG.hourSec segundos a velocidad x1).
 */
(function () {
  "use strict";

  // ---------------------------------------------------------------
  // CONFIGURACIÓN GENERAL
  // ---------------------------------------------------------------
  const CFG = {
    hourSec: 30, dayStart: 8, open: 10, close: 22, dayEnd: 24, // igual que v1
    firstDayStart: 9.5,             // v2: la partida nueva arranca 9:30 (media hora antes de abrir, no dos)
    toastGapSec: 0.6, hintGapSec: 3.5, // v2: espera entre avisos que estaban en cola y entre consejos del tutorial
    startMoney: 2500,            // banco inicial (v1: 5000) — arranque más ajustado
    startMachines: ["clasica"],  // ya tenés una clásica usada instalada
    startRep: 40,                // reputación inicial 0-100
    pocketCap: 1500,             // efectivo máximo en el bolsillo; se deposita en la caja fuerte (oficina)
    pocketCapByRank: { 3: 3000, 5: 6000 }, // riñonera / maletín al subir de rango
    autoDepositAtNight: true,    // lo que quede en el bolsillo a las 24 h se deposita solo
    // demanda de clientes
    baseCustomersPerHour: 5,     // llegan aunque no tengas casi nada
    perAppealPerHour: 3.2,       // + por cada punto de "appeal" instalado (máquinas y mesas)
    crowdFactor: 1.25,           // no entran más clientes que asientos × esto
    hourCurve: { 10: 0.7, 11: 0.7, 12: 0.8, 13: 1.0, 14: 1.0, 15: 1.0, 16: 1.0, 17: 1.1, 18: 1.3, 19: 1.4, 20: 1.4, 21: 1.2 },
    walkSec: 6,                  // tiempo medio de caminar puerta → juego (para la simulación)
    patienceSec: 15,             // espera sin asiento antes de irse
    // gastos fijos diarios
    utilityPerMachine: 25,       // luz y mantenimiento por máquina por día
    utilityPerTable: 60,         // por mesa por día
    // licencia
    licenseBase: 1500, licensePerGame: 100, licenseEvery: 7, licenseMaxMiss: 2, licenseLateHeat: 15,
    // deuda
    negDaysMax: 3,               // 3 cierres seguidos con banco negativo = fin
    // robos
    thiefBase: 0.035,            // probabilidad de que un cliente sea ladrón
    thiefPerHeat: 0.0004,        // + por punto de calor (barrios calientes atraen chorros)
    thiefStealMax: 1.0,          // se lleva hasta el 100% de la caja que ataca
    guardCatch: 0.55,            // probabilidad por guardia de atrapar a un ladrón
    playerCatch: 0.35,           // si vos estás a menos de 5 m del ladrón
    // reparaciones manuales
    sellRefund: 0.5,             // vender una máquina/mesa devuelve el 50%
    playerRepairSec: 8, playerCollectSec: 2, playerDepositSec: 4,
    // XP
    xpPerProfit: 1 / 15,         // 1 XP por cada $15 de ganancia neta de juego cobrada/depositada
    // atractivo
    atrPerAppeal: 5, atrPerRep: 0.3,
    // satisfacción del cliente (0..1), arranca en satBase
    satBase: 0.6, satWin: 0.15, satWaited: -0.15, satBroken: -0.3, satDrink: 0.15, satNoDrink: -0.2,
    satLowDecor: -0.2, satRtpK: 2.0, // satisfacción += (rtp - 0.90) × satRtpK
    repPerSat: 0.5,              // rep += (sat - 0.5) × repPerSat al irse
    repBrokenPerHour: -0.4,      // por cada máquina rota a cada hora
    loyaltyMax: 25, loyaltySpawnBonus: 0.02, // +2% de esa clase de cliente por punto de fidelidad
    // dificultad
    difficulty: "normal",
  };

  // multiplicadores por dificultad ("una escala más de reto" = normal ya es exigente; difícil es para veteranos)
  const DIFFICULTY = {
    normal:  { name: "Normal",  startMoney: 1.0, wages: 1.0, heat: 1.0, rivalGrowth: 1.0, demand: 1.0 },
    dificil: { name: "Difícil", startMoney: 0.6, wages: 1.2, heat: 1.4, rivalGrowth: 1.4, demand: 0.9 },
  };

  // ---------------------------------------------------------------
  // RANGOS (como Schedule I: subís con XP y cada rango desbloquea cosas)
  // ---------------------------------------------------------------
  const RANKS = [
    { lvl: 1, id: "novato",    name: "Novato",              xp: 0,     maxGames: 4,  unlocks: ["clasica", "loan_chico", "deco_planta"] },
    { lvl: 2, id: "encargado", name: "Encargado",           xp: 250,   maxGames: 6,  unlocks: ["dorada", "tech", "sec", "cashier", "stock", "regular", "loan_usurero"] },
    { lvl: 3, id: "croupier",  name: "Croupier",            xp: 900,   maxGames: 8,  unlocks: ["blackjack", "bingo", "dealer", "highroller", "deco_lampara", "loan_mediano"] },
    { lvl: 4, id: "gerente",   name: "Gerente de sala",     xp: 2200,  maxGames: 12, unlocks: ["este", "diamante", "dados", "waiter", "deco_alfombra", "deco_barra"] },
    { lvl: 5, id: "director",  name: "Director",            xp: 4500,  maxGames: 16, unlocks: ["ruleta", "carreras", "vip", "deco_estatua", "deco_pantalla_carreras", "loan_grande"] },
    { lvl: 6, id: "magnate",   name: "Magnate local",       xp: 8000,  maxGames: 20, unlocks: ["oeste", "jackpot", "poker"] },
    { lvl: 7, id: "baron",     name: "Barón del juego",     xp: 13000, maxGames: 24, unlocks: ["deco_fuente"] },
    { lvl: 8, id: "rey",       name: "Rey de la noche",     xp: 20000, maxGames: 27, unlocks: ["buyout"] },
  ];

  // fuentes de XP (además de xpPerProfit)
  const XP = {
    collectBox: 3,      // vaciar una caja a mano (el cajero no da XP)
    repair: 5,          // reparar a mano
    dealHand: 1,        // cada mano/tirada que repartís vos en una mesa
    serveDrink: 6,      // servir un trago a mano a un high roller / VIP
    greetVip: 10,       // recibir a un VIP en la puerta
    catchThief: 15,     // atrapar vos a un ladrón
    cleanDay: 20,       // cerrar el día sin robos ni máquinas rotas al cierre
    passInspection: 60, // inspección sin multas
    buyGame: 10,        // cada máquina o mesa nueva
  };

  // ---------------------------------------------------------------
  // TRAGAMONEDAS (campos de v1 + nuevos)
  //  cap: tope de la caja (ganancia neta acumulada). Llena = "CAJA LLENA", no acepta apuestas.
  //  rank: rango necesario. tier: qué clientes la buscan.
  // ---------------------------------------------------------------
  const MACHINES = [
    { id: "clasica",  name: "Tragamonedas Clásica",  desc: "Barata y confiable. El pan de cada día.",       color: 0xc8323a, css: "#c8323a", price: 900,   bet: 25,  rtp: 0.90, win: 0.40, spin: 2.5, appeal: 1.0, brk: 0.008, repair: 60,   cap: 200,  rank: 1 },
    { id: "dorada",   name: "Tragamonedas Dorada",   desc: "Apuestas medianas, la favorita de los habitués.", color: 0xd9a84a, css: "#d9a84a", price: 3000,  bet: 75,  rtp: 0.90, win: 0.35, spin: 3.0, appeal: 1.4, brk: 0.012, repair: 180,  cap: 500,  rank: 2 },
    { id: "diamante", name: "Tragamonedas Diamante", desc: "Para apostadores grandes. Se rompe seguido.",     color: 0x4fc7e6, css: "#4fc7e6", price: 8000,  bet: 200, rtp: 0.90, win: 0.30, spin: 3.5, appeal: 2.0, brk: 0.018, repair: 450,  cap: 1200, rank: 4 },
    { id: "jackpot",  name: "Mega Jackpot",          desc: "Pozo progresivo con luces. Imán de VIPs.",        color: 0x9b59d6, css: "#9b59d6", price: 22000, bet: 500, rtp: 0.90, win: 0.12, spin: 4.5, appeal: 3.2, brk: 0.015, repair: 1200, cap: 3000, rank: 6, jackpotSeed: 5000, jackpotShare: 0.02, jackpotOdds: 1 / 1500 },
  ];

  // ajuste de pago (RTP) que el jugador elige por máquina. Bajo el mínimo legal = trucha = calor.
  const RTP_SETTINGS = [
    { id: "generosa", name: "Generosa",  rtp: 0.95, appealMul: 1.25, heatPerDay: 0,   legal: true },
    { id: "estandar", name: "Estándar",  rtp: 0.90, appealMul: 1.0,  heatPerDay: 0,   legal: true },
    { id: "ajustada", name: "Ajustada",  rtp: 0.86, appealMul: 0.9,  heatPerDay: 0,   legal: true },  // mínimo legal 0.85
    { id: "trucha",   name: "Trucha",    rtp: 0.78, appealMul: 0.8,  heatPerDay: 2.5, legal: false }, // ganancia ×2.2, ilegal
  ];

  // ---------------------------------------------------------------
  // MESAS (necesitan croupier: vos parado detrás, o un empleado)
  //  edge: ventaja de la casa por apuesta. round: segundos por mano/tirada.
  //  La plata de la mesa va a la bandeja; al cierre (o el cajero) se pasa al banco. No tiene tope.
  // ---------------------------------------------------------------
  const TABLES = [
    { id: "blackjack", name: "Mesa de Blackjack", desc: "Cuatro asientos. Si no tenés croupier, repartís vos.", color: 0x1d6b45, css: "#1d6b45", price: 4500,  seats: 4, minBet: 50,  maxBet: 300,  edge: 0.06,  round: 8,  appeal: 2.0, rank: 3, rep: 0.05 },
    { id: "ruleta",    name: "Ruleta",            desc: "Seis asientos, apuestas de todos los tamaños.",       color: 0x7a1f2b, css: "#7a1f2b", price: 14000, seats: 6, minBet: 25,  maxBet: 1000, edge: 0.053, round: 12, appeal: 3.0, rank: 5, rep: 0.08 },
    // póker: los clientes juegan entre ellos; edge = comisión (rake) del pozo, con tope rakeCap. minBet/maxBet = ciega grande.
    { id: "poker",     name: "Mesa de Póker",     desc: "Texas Hold'em entre clientes: la casa cobra 5% del pozo (tope $400) y nunca pierde.", color: 0x17593c, css: "#17593c", price: 22000, seats: 6, minBet: 50, maxBet: 1000, edge: 0.05, rakeCap: 400, round: 15, appeal: 3.5, rank: 6, rep: 0.1, noVariance: true },
    // juegos nuevos (games.js): custom = modelo y reglas propias; cat = categoría del reporte diario
    // dados: edge es la ventaja ponderada de pase/no pase (1,4%), campo (2,8%) y cualquier 7 (16,7%). round = segundos por tirada con croupier.
    { id: "dados",    name: "Mesa de Dados",     desc: "Craps ruidoso: pase, no pase, campo y cualquier 7. Tirás vos los dados con el mouse o los cantás como croupier.", color: 0x6a1420, css: "#8a2a22", price: 6000,  seats: 6, minBet: 25, maxBet: 500,  edge: 0.035, round: 4, appeal: 2.6, rank: 4, rep: 0.07, custom: true, cat: "dados" },
    // bingo: minBet/maxBet = lo que gasta cada uno en cartones (cartón $25, hasta 4). La casa se queda con lo que no va al premio. round = segundos por bolilla con croupier.
    { id: "bingo",    name: "Sala de Bingo",     desc: "Bingo nocturno: a las 20 h la sala se llena, vendés cartones, cantás las bolillas en el bolillero y verificás cada ¡BINGO!", color: 0x2a3a7a, css: "#3a4aa0", price: 6500,  seats: 8, minBet: 25, maxBet: 100,  edge: 0.4, round: 0.8, appeal: 2.2, rank: 3, rep: 0.06, custom: true, cat: "bingo" },
    // carreras: ventanilla + pantalla gigante. edge = margen de la casa sobre las cuotas justas. No necesita croupier: las carreras corren solas.
    { id: "carreras", name: "Carreras de Caballos", desc: "Pantalla gigante y ventanilla de apuestas: una carrera cada 40 minutos, 6 caballos con cuotas. La casa se queda con el margen.", color: 0x1f5a3a, css: "#2a7a4a", price: 16000, seats: 4, minBet: 25, maxBet: 2000, edge: 0.15, round: 4, appeal: 3.0, rank: 5, rep: 0.06, custom: true, cat: "carreras", noDealer: true },
  ];

  // ---------------------------------------------------------------
  // PERSONAL (NPCs visibles con tareas). wage = sueldo por día.
  // maxByRank: cuántos podés tener según tu rango.
  // ---------------------------------------------------------------
  const STAFF = [
    { role: "tech",    name: "Técnico",   desc: "Camina a la máquina rota y la repara (12 s base; más rápido con más eficiencia). Mantenimiento: -25% de roturas.", wage: 150, rank: 2, maxByRank: { 2: 2, 4: 3, 6: 4, 7: 5 },
      task: "repair", taskSec: 12, speed: 3.0, brkMul: 0.75, color: 0x2f6fb0 },
    { role: "sec",     name: "Guardia",   desc: "Patrulla el salón. Cada guardia atrapa al 55% de los ladrones. Baja 1 de calor por día.", wage: 140, rank: 2, maxByRank: { 2: 2, 4: 3, 6: 5, 7: 7 },
      task: "patrol", speed: 2.6, heatPerDay: -1, color: 0x222831 },
    { role: "cashier", name: "Cajero",    desc: "Atiende la caja registradora (cobra y da el vuelto solo). Si no hay fila, vacía las cajas al 50% y deposita.", wage: 160, rank: 2, maxByRank: { 2: 1, 4: 2, 5: 3, 7: 4 },
      task: "collect", collectAt: 0.5, taskSec: 3, depositEvery: 5, speed: 3.2, color: 0x7d5a2a },
    { role: "dealer",  name: "Croupier",  desc: "Atiende una mesa todo el turno. Una por mesa: el cupo crece solo con tus mesas.", wage: 180, rank: 3, maxByRank: { 3: 2, 5: 4, 6: 6, 7: 8 },
      task: "deal", speed: 2.4, color: 0x111111 },
    { role: "waiter",  name: "Camarero",  desc: "Lleva tragos a high rollers y VIP (necesita la Barra). Cada trago deja $20.", wage: 130, rank: 4, maxByRank: { 4: 2, 5: 3, 6: 4, 7: 6 },
      task: "serve", taskSec: 4, speed: 3.0, drinkPrice: 20, drinkCost: 6, color: 0xf3e9d2 },
    // tienda (shop.js): trae las cajas de la vereda y repone heladera, snacks y fichas
    { role: "stock",   name: "Repositor", desc: "Trae las cajas de la vereda, repone la heladera, los snacks y las fichas, y deja las cajas de máquinas al lado de la compu.", wage: 110, rank: 2, maxByRank: { 2: 1, 4: 2, 6: 4, 7: 5 },
      task: "stock", speed: 2.9, fillSec: 0.35, color: 0x3a7a3a },
  ];

  // ---------------------------------------------------------------
  // CLIENTES
  //  bet: rango de apuesta que acepta (solo juega donde bet/minBet entra en el rango).
  //  weight: peso de aparición. rounds: rondas que juega. wantsDrink: quiere trago dentro de 1 h.
  //  minAtr: si el atractivo del casino es menor, se va con -satisfacción.
  // ---------------------------------------------------------------
  const CUSTOMER_TYPES = [
    { id: "casual",     name: "Casual",      rank: 1, weight: 70, budget: [100, 600],     bet: [25, 75],    rounds: [10, 30], prefers: ["clasica", "bingo"],  wantsDrink: false, minAtr: 0,   speed: 2.4, color: [0.0, 1.0] },
    { id: "regular",    name: "Habitué",     rank: 2, weight: 22, budget: [300, 1800],    bet: [25, 200],   rounds: [20, 50], prefers: ["dorada", "blackjack", "bingo", "dados"], wantsDrink: false, minAtr: 0,   speed: 2.2, loyal: true },
    { id: "highroller", name: "High roller", rank: 3, weight: 9,  budget: [2500, 9000],   bet: [75, 600],   rounds: [25, 60], prefers: ["blackjack", "diamante", "ruleta", "poker", "dados", "carreras"], wantsDrink: true, minAtr: 40, speed: 2.0, loyal: true },
    { id: "vip",        name: "VIP",         rank: 5, weight: 3,  budget: [12000, 40000], bet: [200, 3000], rounds: [30, 80], prefers: ["poker", "ruleta", "jackpot", "carreras"], wantsDrink: true, minAtr: 120, speed: 1.8, loyal: true, needsGreet: true },
  ];
  const THIEF = { id: "thief", name: "Ladrón", speed: 2.6, stealSec: 5 };
  const INSPECTOR = { id: "inspector", name: "Inspector de Lotería", speed: 1.6, visitHours: 3 };

  // ---------------------------------------------------------------
  // ZONAS: lugares para máquinas y mesas. Posiciones aproximadas en el plano de v1.
  // ---------------------------------------------------------------
  const ZONES = [
    { id: "principal", name: "Salón principal", price: 0,     rank: 1, side: 0,  slots: 12, tableSpots: 2, decorSpots: 4 },
    { id: "este",      name: "Ala Este",        price: 10000, rank: 4, side: 1,  slots: 6,  tableSpots: 1, decorSpots: 3 },
    { id: "oeste",     name: "Salón VIP (Oeste)", price: 30000, rank: 6, side: -1, slots: 4, tableSpots: 2, decorSpots: 3, vipOnly: false },
  ];

  // ---------------------------------------------------------------
  // DECORACIÓN: sube el atractivo (compite con el rival) y deja pasar high rollers/VIP
  // ---------------------------------------------------------------
  const DECOR = [
    { id: "deco_planta",   name: "Planta tropical", price: 300,  atr: 3,  rank: 1, color: 0x2e7d32 },
    { id: "deco_lampara",  name: "Lámpara de pie",  price: 900,  atr: 7,  rank: 3, color: 0xffe2a8 },
    { id: "deco_alfombra", name: "Alfombra roja",   price: 1600, atr: 10, rank: 4, color: 0x9e1b2b },
    { id: "deco_barra",    name: "Barra de tragos", price: 5000, atr: 14, rank: 4, color: 0x3b2314, unique: true, enables: "waiter" },
    { id: "deco_estatua",  name: "Estatua dorada",  price: 4500, atr: 20, rank: 5, color: 0xd9a84a },
    { id: "deco_fuente",   name: "Fuente",          price: 12000, atr: 40, rank: 7, color: 0x4fa3c7 },
    // games.js: pantalla de pared que pasa las mismas carreras que las ventanillas
    { id: "deco_pantalla_carreras", name: "Pantalla de carreras (pared)", price: 3500, atr: 9, rank: 5, color: 0x1f5a3a, mount: "wall" },
  ];

  // ---------------------------------------------------------------
  // CALOR / INSPECCIONES (0-100)
  // ---------------------------------------------------------------
  const HEAT = {
    max: 100, decayPerDay: 4,
    thiefEscaped: 1,              // cada ladrón que se escapa
    licenseLate: 15,              // licencia impaga
    loanMissed: 5,                // cuota del usurero impaga
    inspectionChance: h => Math.min(0.6, 0.03 + h / 150), // por día, al abrir
    routineEvery: 14,             // además, inspección de rutina cada 14 días
    detectChance: h => Math.min(1, 0.5 + h / 100), // por máquina trucha
    finePerRigged: g => Math.max(3000, Math.round(g.price * 0.5)),
    fineHeat: 10, fineRep: -5,
    bribeCost: h => 1500 + 100 * h,
    bribeSuccess: h => Math.max(0.2, 0.85 - h / 200),
    bribeOkHeat: -10, bribeFailHeat: 25, bribeFailFineMul: 2,
    closureAt: 100, closureDays: 2, closureFine: 10000, closureHeatAfter: 50, closuresToLose: 3,
  };

  // ---------------------------------------------------------------
  // PRÉSTAMOS (uno a la vez). Se paga en cuotas diarias iguales al cierre.
  // ---------------------------------------------------------------
  const LOANS = [
    { id: "loan_chico",   name: "Préstamo chico (Banco)",  amount: 3000,  days: 7,  interest: 0.20, rank: 1 },
    { id: "loan_mediano", name: "Préstamo mediano (Banco)", amount: 10000, days: 10, interest: 0.25, rank: 3 },
    { id: "loan_grande",  name: "Préstamo grande (Banco)", amount: 30000, days: 14, interest: 0.30, rank: 5 },
    { id: "loan_usurero", name: "El Tano (prestamista)",   amount: 15000, days: 10, interest: 0.50, rank: 2, shady: true }, // sin requisitos, pero si no pagás: calor
  ];
  const LOAN_RULES = { missedPenalty: 0.10, missedToSeize: 3, seize: "mostExpensiveGame" };

  // ---------------------------------------------------------------
  // CASINO RIVAL
  // ---------------------------------------------------------------
  const RIVAL = {
    name: "El Faraón", opensDay: 6, startAtr: 30, growthPerWeek: 22,
    // tu porción de clientes: share = tuAtr / (tuAtr + rivalAtr); multiplicador = 0.55 + 0.9 × share (1.0 si empatan)
    mulBase: 0.55, mulK: 0.9,
    promoEvery: 5, promoDemandMul: 0.8, // cada 5 días el rival hace una promo: -20% clientes ese día
    buyoutBase: 150000, buyoutPerAtr: 500, // victoria: comprar El Faraón (rango 8)
  };

  // ---------------------------------------------------------------
  // OBJETIVOS DIARIOS: se sortean 3 por día entre los de tu rango
  // ---------------------------------------------------------------
  const OBJECTIVES = [
    { id: "collect5",  text: "Vaciá 5 cajas a mano",                      stat: "boxesByHand",  goal: 5,   rank: 1, maxRank: 4, xp: 40,  cash: 0 },
    { id: "serve20",   text: "Atendé a 20 clientes",                      stat: "served",       goal: 20,  rank: 1, maxRank: 3, xp: 40,  cash: 150 },
    { id: "repair2",   text: "Repará 2 máquinas a mano",                  stat: "repairsByHand", goal: 2,  rank: 1, maxRank: 3, xp: 30,  cash: 0 },
    { id: "net500",    text: "Ganá $500 netos hoy",                       stat: "net",          goal: 500, rank: 1, maxRank: 2, xp: 50,  cash: 0 },
    { id: "rep50",     text: "Cerrá el día con reputación 50 o más",      stat: "repEnd",       goal: 50,  rank: 1, maxRank: 4, xp: 40,  cash: 200 },
    { id: "net2000",   text: "Ganá $2.000 netos hoy",                     stat: "net",          goal: 2000, rank: 3, maxRank: 5, xp: 90, cash: 0 },
    { id: "deal30",    text: "Repartí 30 manos vos mismo",                stat: "handsByHand",  goal: 30,  rank: 3, maxRank: 6, xp: 60,  cash: 0 },
    { id: "nothief",   text: "Cero robos hoy",                            stat: "thefts",       goal: 0,   rank: 2, maxRank: 8, xp: 60,  cash: 300, cmp: "<=" },
    { id: "hr5",       text: "Que jueguen 5 high rollers",                stat: "highrollers",  goal: 5,   rank: 3, maxRank: 6, xp: 70,  cash: 500 },
    { id: "drinks5",   text: "Serví 5 tragos a mano",                     stat: "drinksByHand", goal: 5,   rank: 4, maxRank: 7, xp: 60,  cash: 0 },
    { id: "net6000",   text: "Ganá $6.000 netos hoy",                     stat: "net",          goal: 6000, rank: 5, maxRank: 8, xp: 150, cash: 0 },
    { id: "vip2",      text: "Recibí a 2 VIP en la puerta",               stat: "vipGreeted",   goal: 2,   rank: 5, maxRank: 8, xp: 120, cash: 1000 },
    { id: "heat10",    text: "Cerrá el día con calor menor a 10",         stat: "heatEnd",      goal: 10,  rank: 3, maxRank: 8, xp: 80,  cash: 0, cmp: "<" },
    { id: "net15000",  text: "Ganá $15.000 netos hoy",                    stat: "net",          goal: 15000, rank: 7, maxRank: 8, xp: 250, cash: 0 },
    // tienda (shop.js)
    { id: "caja10",    text: "Cobrá 10 veces en la caja registradora",    stat: "registerByHand", goal: 10, rank: 1, maxRank: 5, xp: 50, cash: 0 },
    { id: "repone30",  text: "Reponé 30 productos a mano",                stat: "restocked",    goal: 30,  rank: 1, maxRank: 4, xp: 40,  cash: 0 },
    { id: "kiosco600", text: "Vendé $600 en el kiosco",                   stat: "shopRev",      goal: 600, rank: 2, maxRank: 8, xp: 60,  cash: 0 },
  ];
  const OBJECTIVES_PER_DAY = 3;

  // categorías del reporte diario (v1 + nuevas)
  const CATS = { bets: "Apuestas", prizes: "Premios pagados", tables: "Mesas", drinks: "Tragos", objectives: "Objetivos", loan: "Préstamo recibido",
    purchases: "Compras", wages: "Sueldos", license: "Licencia", repairs: "Reparaciones", expansion: "Ampliaciones", theft: "Robos",
    utilities: "Luz y mantenimiento", fines: "Multas", bribes: "Coimas", loanPay: "Cuotas", decor: "Decoración", events: "Eventos de la noche", other: "Otros",
    shop: "Ventas del kiosco", stock: "Mercadería", shopLoss: "Vuelto de más", licenses: "Licencias y mejoras",
    sandbox: "Fondos infinitos (Sandbox)", league: "Premio de la semana",
    hotel: "Hotel: noches cobradas", hotelTips: "Hotel: propinas", hotelUpkeep: "Hotel: limpieza y mantenimiento", hotelBuild: "Hotel: obra y habitaciones",
    mafia: "Favores de Don Aurelio", protection: "Protección",
    dados: "Mesa de dados", bingo: "Bingo (cartones − premios)", carreras: "Carreras de caballos" };

  // ---------------------------------------------------------------
  // MODOS DE JUEGO, LOGROS Y RANKING SEMANAL CONTRA EL FARAÓN (challenge.js)
  // ---------------------------------------------------------------
  const MODES = {
    historia:     { name: "Historia", desc: "La partida de siempre: misiones, rival y préstamos.", scoreMul: 1 },
    sandbox:      { name: "Sandbox", desc: "Plata infinita, todo el rango desbloqueado y sin historia. Logros desactivados.", scoreMul: 0, sandbox: true },
    desafio:      { name: "Desafío 30 días", desc: "Llegá a la meta de plata y rango antes del cierre del día 30.", scoreMul: 1.25, days: 30, targetBank: 75000, targetRank: 4, dayLeftBonus: 400 },
    sinprestamos: { name: "Difícil sin préstamos", desc: "Siempre en Difícil, sin préstamos del banco y con noches más movidas. Puntaje ×1,5.", scoreMul: 1.5, diff: "dificil", noLoans: true, extraEvents: 1 },
  };
  const CHALLENGE = {
    sandboxFloor: 5000000, sandboxTop: 10000000, // el banco del Sandbox nunca baja de 5 M
    score: { bankDiv: 10, netMul: 0.05, perRank: 1000, perRep: 20, perWeekWon: 750 },
    week: 7,
    // El Faraón: sus números de la semana salen de su atractivo y de cómo te va a vos
    rival: { profitPerAtr: 260, visitorsPerAtr: 1.6, baseRep: 48, repPerWeek: 2, pushWin: 0.12, pushLose: -0.05, pushMin: 0.85, pushMax: 1.6,
      promoVisitors: 0.08, sabotageMul: 0.75, noise: 0.15, followMine: 0.55 },
    winRep: 3, winDemand: 1.15, loseDemand: 0.85, effectDays: 2, loseLoyalty: 0.5,
    sinQuejasMinVisitors: 20,
  };


  // ---------------------------------------------------------------
  // LOCAL MÁS VIVO (life.js): reacciones de los clientes y eventos de la noche
  // Tiempos en segundos de simulación (1 hora = 30 s). "time" acorta los plazos, "penalty" agranda los castigos.
  // ---------------------------------------------------------------
  const LIFE = {
    firstDay: 2,                    // el día 1 es tutorial: sin eventos
    perDay: { normal: 1, dificil: 2 }, secondChance: 0.4, secondRank: 3, // en Normal, desde el rango 3 a veces hay un segundo evento
    diff: { normal: { time: 1, penalty: 1 }, dificil: { time: 0.75, penalty: 1.4 } },
    react: { streakShake: 6, streakKick: 10, kickChance: 0.3, kickBreak: 0.06, bigWinMul: 5, nearClap: 6, jackpotClap: 11 },
    mood: { min: -0.45, max: 0.35, shake: -0.04, kick: -0.06, bigWin: 0.12, bothered: -0.1, mess: -0.05, outagePerSec: -0.006, fightNear: -0.08 },
    mess: { max: 7, atr: 3, holdSec: 1.2, xp: 3, randomPerHour: 0.12, eventCount: 3, eventSec: 75, eventRep: 1, eventXp: 10 },
    drunk: { sec: 80, guardDelay: 20, botherEvery: 9, repBother: -0.5, spillEvery: 22, rep: 1.5, xp: 15, guardRep: 0.75, noFightRep: -2 },
    fight: { sec: 26, holdSec: 0, guardDelay: 6, rep: 2, xp: 20, guardRep: 1, failRep: -6, failHeat: 8, breakChance: 0.5 },
    birthday: { size: [4, 6], greetSec: 45, stayHours: 3, budgetMul: 1.6, roundsMul: 1.4, greetRep: 1, xp: 15, tipPerDrink: 60, tipPerGuest: 35, endRep: 1.5, failRep: -2, failMood: -0.15 },
    cheater: { rank: 2, sec: 100, drainEvery: 4, drain: [20, 45], drainPerRank: 0.35, suspects: 2, xp: 25, rep: 1, refund: 0.8, guardRefund: 0.5, wrongRep: -1, guardDelay: 45, guardChance: 0.5 },
    outage: { minMachines: 2, techDelay: 15, holdSec: 1.5, repPerHour: -2, xp: 12, patienceMul: 2 },
    celebrity: { rank: 3, minRep: 45, greetSec: 40, staySec: 150, rep: 8, failRep: -4, xp: 40, cash: 400, cashPerRank: 150, demandMul: 1.3, okMood: 0.65 },
  };

  // ---------------------------------------------------------------
  // TIENDA AL ESTILO TCG (shop.js): pedidos por la compu, cajas, góndolas, precios y caja registradora
  // Precios en pesos enteros. "base" = precio de mercado de referencia; el mercado se mueve cada día.
  // ---------------------------------------------------------------
  const SHOP = {
    deliveryMin: 40,              // minutos de juego entre el pedido y el camión (40 min = 20 s a x1)
    wholesale: 0.42,              // costo mayorista = precio de mercado × esto
    market: { sigma: 0.06, revert: 0.15, spikeChance: 0.08, spikeUp: 1.3, spikeDown: 0.75, min: 0.55, max: 1.9, hist: 10 },
    products: [
      { id: "fichas",    name: "Vaso de fichas", cat: "fichas", shelf: "fichas",   base: 15, box: 40, cap: 60, rank: 1, color: 0xd4423f },
      { id: "gaseosa",   name: "Gaseosa",        cat: "bebida", shelf: "heladera", base: 8,  box: 12, cap: 16, rank: 1, color: 0xc8202a },
      { id: "cerveza",   name: "Cerveza",        cat: "bebida", shelf: "heladera", base: 12, box: 12, cap: 16, rank: 2, lic: "lic_cerveza", color: 0x2f7a3a },
      { id: "espumante", name: "Espumante",      cat: "bebida", shelf: "heladera", base: 60, box: 6,  cap: 12, rank: 4, lic: "lic_espumante", color: 0xe8d58a, premium: true },
      { id: "papas",     name: "Papas fritas",   cat: "snack",  shelf: "snacks",   base: 6,  box: 12, cap: 16, rank: 1, color: 0xf0c24a },
      { id: "alfajor",   name: "Alfajor",        cat: "snack",  shelf: "snacks",   base: 5,  box: 16, cap: 16, rank: 1, lic: "lic_alfajor", color: 0x6a3a1a },
      { id: "habano",    name: "Habano",         cat: "snack",  shelf: "snacks",   base: 45, box: 8,  cap: 12, rank: 5, lic: "lic_habano", color: 0x7a4a24, premium: true },
    ],
    startStock: { fichas: 40, gaseosa: 10, papas: 8 },
    // clientes: cuántos compran fichas al entrar y cuántos hacen una pausa para comprar algo
    chipsChance: { casual: 0.38, regular: 0.3, highroller: 0.2, vip: 0.12 },
    breakChance: 0.38, premiumChance: { highroller: 0.5, vip: 0.7 },
    catWeights: { bebida: 0.55, snack: 0.45 },
    queueMax: 6, patienceSec: 25, cashierSec: 2.6,   // paciencia en segundos de simulación (25 s = 50 min de juego)
    // precio / mercado: hasta "over" compran normal, hasta "way" compran menos y rezongan, más arriba se quejan y no compran
    tol: { cheap: 0.9, over: 1.15, way: 1.35 },
    mood: { cheap: 0.04, over: -0.04, complain: -0.1, stockout: -0.12, wait: -0.12, exact: 0.05, short: -0.15, unattended: -0.04 },
    rep: { complain: -0.2, stockout: -0.25, short: -0.8 },
    xp: { perItem: 1, exact: 2, fast: 1, restockEvery: 8, auto: 1 },
    fastSec: 5, slowSec: 12, tipFast: 2,
    denoms: [1, 2, 5, 10, 20, 50, 100],
    slow: { machine: 0.45, table: 0.5, decor: 0.2, barra: 0.45, prod: 0.12 }, // cuánto te frena cada caja (fracción de velocidad)
    // góndolas extra (compu → Góndolas): cada una suma su capacidad (cap de cada producto) y se mueve en el modo construcción
    furn: {
      heladera: { name: "Heladera extra", price: 900, rank: 2, color: 0xe8e8e4, max: 3 },
      snacks: { name: "Estantería de snacks extra", price: 700, rank: 2, color: 0x6a4a2a, max: 3 },
    },
  };
  // licencias: se compran una vez, con plata, cuando tu rango llega (como en TCG)
  const LICENSES = [
    { id: "lic_alfajor",   kind: "prod",    target: "alfajor",   rank: 1, price: 250 },
    { id: "lic_cerveza",   kind: "prod",    target: "cerveza",   rank: 2, price: 700 },
    { id: "lic_dorada",    kind: "machine", target: "dorada",    rank: 2, price: 1200 },
    { id: "lic_blackjack", kind: "table",   target: "blackjack", rank: 3, price: 2000 },
    { id: "lic_espumante", kind: "prod",    target: "espumante", rank: 4, price: 2500 },
    { id: "lic_diamante",  kind: "machine", target: "diamante",  rank: 4, price: 3500 },
    { id: "lic_ruleta",    kind: "table",   target: "ruleta",    rank: 5, price: 5000 },
    { id: "lic_habano",    kind: "prod",    target: "habano",    rank: 5, price: 3000 },
    { id: "lic_jackpot",   kind: "machine", target: "jackpot",   rank: 6, price: 8000 },
    { id: "lic_poker",     kind: "table",   target: "poker",     rank: 6, price: 8000 },
    { id: "lic_bingo",     kind: "table",   target: "bingo",     rank: 3, price: 2200 },
    { id: "lic_dados",     kind: "table",   target: "dados",     rank: 4, price: 2500 },
    { id: "lic_carreras",  kind: "table",   target: "carreras",  rank: 5, price: 6000 },
  ];
  // árbol de mejoras: 4 ramas de 5 escalones (cada uno pide el anterior de su rama y un rango)
  // eff: claves *Mul multiplican, el resto suma (upgrades.js → CasinoUp.v)
  const UP_BRANCHES = [
    { id: "maq", name: "Máquinas", icon: "🎰" }, { id: "per", name: "Personal", icon: "👔" },
    { id: "bar", name: "Bar y comodidad", icon: "🍸" }, { id: "neg", name: "Negocio y calle", icon: "🕶️" },
  ];
  const UPGRADES = [
    { id: "carretes",        branch: "maq", name: "Carretes más rápidos",   rank: 2, price: 1500,  eff: { spinMul: 0.8 },  desc: "Las tragamonedas giran 20% más rápido: más tiradas por hora." },
    { id: "cajas_grandes",   branch: "maq", name: "Cajas más grandes",      rank: 3, price: 2500,  eff: { capMul: 1.5 },   desc: "Las cajas de las máquinas aguantan 50% más antes de llenarse." },
    { id: "menos_roturas",   branch: "maq", name: "Menos roturas",          rank: 3, price: 3000,  eff: { brkMul: 0.55 },  desc: "Repuestos buenos: las máquinas se rompen 45% menos." },
    { id: "jackpot_prog",    branch: "maq", name: "Jackpot progresivo",     rank: 5, price: 6000,  eff: { machineAppealMul: 1.15, roundsMul: 1.2 }, desc: "Un pozo compartido entre todas las tragamonedas: +15% de atractivo de las máquinas y los clientes juegan 20% más tiradas." },
    { id: "autodiag",        branch: "maq", name: "Autodiagnóstico",        rank: 6, price: 8000,  eff: { autoRepair: 1 }, desc: "Una máquina rota se arregla sola después de 1 hora de juego, sin pagar repuesto." },
    { id: "sueldos",         branch: "per", name: "Sueldos más baratos",    rank: 2, price: 2000,  eff: { wageMul: 0.8 },  desc: "Convenio con el gremio: todos los sueldos bajan 20%." },
    { id: "zapatillas",      branch: "per", name: "Caminan más rápido",     rank: 2, price: 1800,  eff: { staffSpeedMul: 1.3 }, desc: "Zapatillas nuevas para todos: el personal camina 30% más rápido." },
    { id: "ojo_guardia",     branch: "per", name: "Guardias detectan tramposos", rank: 3, price: 3000, eff: { guardCatchAdd: 0.2, cheaterGuard: 1 }, desc: "Los guardias atrapan 20% más ladrones y van solos (y antes) por los tramposos." },
    { id: "gerente",         branch: "per", name: "Gerente que vacía cajas", rank: 4, price: 5000, eff: { manager: 1 },    desc: "Cada hora de juego, el gerente vacía las cajas que pasan el 80% y deposita la plata en el banco." },
    { id: "turnos",          branch: "per", name: "Turnos dobles",          rank: 5, price: 6000,  eff: { staffMaxAdd: 1 }, desc: "Podés tener un empleado más de cada puesto." },
    { id: "tragos",          branch: "bar", name: "Tragos premium",         rank: 2, price: 1500,  eff: { drinkPriceAdd: 10, drinkTolAdd: 0.15 }, desc: "Cada trago de la barra deja $10 más y los clientes aceptan bebidas 15% más caras." },
    { id: "aire",            branch: "bar", name: "Aire acondicionado",     rank: 3, price: 2500,  eff: { patienceMul: 1.5 }, desc: "Los clientes esperan 50% más en las filas (juegos y caja) sin enojarse." },
    { id: "asientos",        branch: "bar", name: "Asientos de lujo",       rank: 3, price: 3500,  eff: { atrAdd: 6, roundsMul: 1.1 }, desc: "+6 de atractivo y los clientes juegan 10% más tiradas." },
    { id: "musica",          branch: "bar", name: "Música en vivo",         rank: 5, price: 6000,  eff: { atrAdd: 12, demandMul: 1.1 }, desc: "Un trío de jazz los fines de semana y los otros días también: +12 de atractivo y 10% más clientes." },
    { id: "sala_vip",        branch: "bar", name: "Sala VIP",               rank: 6, price: 12000, eff: { atrAdd: 15, vipWeightMul: 1.5 }, desc: "Un rincón exclusivo: +15 de atractivo y 50% más high rollers y VIP." },
    { id: "cartel",          branch: "neg", name: "Cartel luminoso",        rank: 1, price: 1200,  eff: { atrAdd: 8, demandMul: 1.1 }, desc: "Un cartel que se ve desde la avenida: +8 de atractivo y 10% más clientes." },
    { id: "contactos",       branch: "neg", name: "Contactos en la municipalidad", rank: 2, price: 2500, eff: { inspectMul: 0.6, heatDecayAdd: 2 }, desc: "Las inspecciones vienen 40% menos seguido y el calor baja 2 más por día." },
    { id: "licencia_barata", branch: "neg", name: "Licencia más barata",    rank: 3, price: 3000,  eff: { licenseFeeMul: 0.7, licDiscount: 0.25 }, desc: "La licencia de Lotería sale 30% menos y las licencias de productos, máquinas y mesas 25% menos." },
    { id: "prestamos",       branch: "neg", name: "Préstamos baratos",      rank: 4, price: 3000,  eff: { loanInterestMul: 0.5 }, desc: "Un amigo en el banco: los préstamos nuevos cobran la mitad de interés." },
    { id: "sabotaje",        branch: "neg", name: "Sabotear a El Faraón",   rank: 6, price: 10000, eff: { rivalMul: 0.8 }, desc: "Rumores, cortes de luz y un camello resfriado: El Faraón pierde 20% de atractivo." },
  ];

  // ---------------------------------------------------------------
  // DUEÑO (owner.js): imagen, publicidad, seguro y robo planeado
  // ---------------------------------------------------------------
  // Imagen 0-100 = ropa + accesorios + auto + oficina. img = puntos de imagen.
  const OWNER = {
    outfits: [ // uno puesto a la vez (se ve en el espejo del ropero, en el cuadro y en tus mangas)
      { id: "remera",  name: "Remera y jean",          price: 0,     rank: 1, img: 0,  top: "tee",  color: 0x3a5a8a, pants: 0x23324a, cuff: null,     desc: "Lo que tenías puesto el día que heredaste el local." },
      { id: "camisa",  name: "Camisa y pantalón de vestir", price: 600, rank: 1, img: 6, top: "polo", color: 0xe8e4da, pants: 0x2a2a30, cuff: null,   desc: "Ya parecés el encargado." },
      { id: "saco",    name: "Saco sport con pañuelo", price: 2000,  rank: 2, img: 12, vip: true, jacket: 0x6a4a2a, cuff: 0xf6f1e6, desc: "Pañuelo al bolsillo: los habitués te saludan por el nombre." },
      { id: "traje",   name: "Traje a medida",         price: 6000,  rank: 3, img: 22, vip: true, jacket: 0x1c2433, cuff: 0xf6f1e6, desc: "Azul noche, corte italiano. Los high rollers te toman en serio." },
      { id: "blanco",  name: "Traje blanco de capo",   price: 15000, rank: 5, img: 32, vip: true, jacket: 0xefe8d8, cuff: 0x1a1a24, desc: "Con clavel rojo. Don Aurelio te mira distinto." },
      { id: "dorado",  name: "Smoking dorado",         price: 35000, rank: 7, img: 40, vip: true, jacket: 0xc9962e, cuff: 0xf6f1e6, desc: "Brilla más que el Mega Jackpot. Exagerado. Perfecto." },
    ],
    accessories: [ // se suman todos los que tengas
      { id: "anteojos", name: "Anteojos de sol",  price: 500,  rank: 1, img: 3, desc: "Adentro también. Sobre todo adentro." },
      { id: "reloj",    name: "Reloj de oro",     price: 2500, rank: 3, img: 5, desc: "Se ve en tu muñeca cada vez que mirás algo." },
      { id: "cadena",   name: "Cadena de oro",    price: 6000, rank: 4, img: 7, desc: "Gruesa. Discreta no es." },
    ],
    cars: [ // estacionado en la vereda, a la derecha de la entrada (el que elijas)
      { id: "fitito",   name: "Fitito usado",     price: 1500,  rank: 1, img: 5,  color: 0x8a9a4a, desc: "Modesto, con onda. Arranca en bajada." },
      { id: "sedan",    name: "Sedán familiar",   price: 6000,  rank: 3, img: 10, color: 0x2a3a5a, desc: "Cuatro puertas, aire acondicionado y respeto del barrio." },
      { id: "deportivo",name: "Deportivo rojo",   price: 20000, rank: 5, img: 18, color: 0xc8202a, desc: "Ruge en la avenida. Los VIP preguntan de quién es." },
      { id: "limusina", name: "Limusina blanca",  price: 50000, rank: 7, img: 25, color: 0xf2efe8, desc: "Seis metros de imagen. Con chofer imaginario." },
    ],
    office: [ // lujos de la oficina (a la derecha de la entrada, junto a la compu)
      { id: "escritorio", name: "Escritorio de caoba",    price: 2500, rank: 2, img: 5, desc: "Madera lustrada y filetes dorados en el escritorio de la compu." },
      { id: "alfombra",   name: "Alfombra persa",         price: 1200, rank: 2, img: 2, desc: "Para la oficina. Nadie sabe si es persa de verdad." },
      { id: "cuadro",     name: "Retrato al óleo",        price: 3500, rank: 3, img: 4, desc: "Vos, pintado con la ropa que tengas puesta, arriba de la compu." },
      { id: "acuario",    name: "Acuario con peces",      price: 5000, rank: 4, img: 5, desc: "Peces de colores al lado del ropero. Calma a cualquiera." },
      { id: "caja_oro",   name: "Caja fuerte enchapada en oro", price: 8000, rank: 5, img: 4, desc: "La caja fuerte de la caja se ve dorada. Pura imagen." },
    ],
    imgMax: 100,
    effects: { vipMul: 1.0, wageCut: 0.12, staffSpeed: 0.08, respectCut: 0.15, influencerK: 1.0 }, // a imagen 100: +100% high rollers y VIP, -12% sueldos, +8% velocidad del personal, -15% en lo que cobra la mafia
    // publicidad: cada campaña suma "fuerza" por tipo de cliente; el efecto real tiene rendimiento decreciente: E = tope·(1 − e^(−fuerza/tope))
    adCaps: { casual: 0.7, regular: 0.6, highroller: 0.7, vip: 0.6 },
    ads: [
      { id: "volantes",   name: "Volantes en el barrio",    price: 150,  rank: 1, days: 2,  boost: { casual: 0.35, regular: 0.05 }, desc: "Barato y corto: más clientes casuales por 2 días." },
      { id: "radio",      name: "Aviso en la radio",        price: 1200, rank: 2, days: 5,  boost: { regular: 0.3, casual: 0.12, highroller: 0.05 }, desc: "«Casino Dorado, donde la suerte tiene domicilio». 5 días, sobre todo habitués." },
      { id: "cartel",     name: "Cartel en la ruta",        price: 6000, rank: 3, days: 10, boost: { highroller: 0.4, vip: 0.25, regular: 0.1 }, desc: "Un cartel gigante enfrente: high rollers y VIP por 10 días. Se ve desde la puerta." },
      { id: "influencer", name: "Visita de una influencer", price: 3500, rank: 2, days: 3,  boost: { casual: 0.3, regular: 0.15 }, scaleByImg: true, desc: "Viene a filmar a la tarde. El efecto crece con tu imagen y si la recibís vos." },
    ],
    influencerHour: 17, influencerGreetMul: 1.35,
    // seguro: cuota cada 7 días (se paga al contratar y después al cierre); cubre robos, incendio y vandalismo
    insEvery: 7,
    insurance: [
      { id: "basico",   name: "Básico",   premium: 250,  rank: 1, cover: 0.4,  deductible: 500, desc: "Cubre el 40% de lo que pierdas, con $500 de franquicia." },
      { id: "completo", name: "Completo", premium: 600,  rank: 3, cover: 0.65, deductible: 250, desc: "Cubre el 65%, franquicia $250." },
      { id: "total",    name: "Todo riesgo", premium: 1400, rank: 5, cover: 0.85, deductible: 0, desc: "Cubre el 85% sin franquicia." },
    ],
    insHeatK: 0.005,      // la cuota sube 0,5% por punto de calor
    insClaimK: 0.2,       // y 20% por cada siniestro cobrado en los últimos 14 días
    // seguridad (pestaña Seguridad de la compu)
    cams: [ { lvl: 1, price: 3000, rank: 2 }, { lvl: 2, price: 8000, rank: 4 } ],   // 1: monitoreo (la alarma llama sola a la policía, guardias reaccionan al toque); 2: + policía 10 s antes, más soplos
    safes: [ { lvl: 1, price: 2000, rank: 1 }, { lvl: 2, price: 6000, rank: 3 }, { lvl: 3, price: 15000, rank: 5 } ], // cada nivel: +10 s para forzarla y −7% del botín
    // robo planeado
    heist: {
      minDay: 4, minBank: 8000, cooldown: 6, leadDays: 2,
      chanceBase: 0.03, chanceBank: 0.10, bankRef: 60000, chanceHeat: 0.12, chanceCam: 0.02,
      hour: 22.5,               // la banda llega a las 22:30 (con el casino cerrado)
      crew: 3, crewBigBank: 40000, // 4 ladrones si hay más de esto en el banco
      lootFrac: 0.35, lootFracPerSafe: 0.07, lootCap: 60000,
      crackSec: 24, crackPerSafe: 10, shutterSec: 18, alarmHurry: 1.35, alarmGrab: 0.6,
      policeSec: 40, policePerCam: 10, guardNoticeSec: 8, vanWait: 10, punctureSec: 1.2, tackleCd: 1.5, dodge: 0.4,
      tipBase: 0.5, tipPerCam: 0.25, repFoiled: 4, repLost: -2, xpFoiled: 150,
    },
    fire: { chance: 0.006, perBroken: 0.004, repairMul: 2 }, // cortocircuito en una máquina rota (rarísimo)
  };
  Object.assign(CATS, { image: "Imagen: ropa, auto y oficina", ads: "Publicidad", insurance: "Seguro (cuota)", insurancePay: "Seguro (indemnización)",
    security: "Seguridad", heist: "Robo a la caja fuerte", fire: "Incendio", recovered: "Botín recuperado" });

  // ---------------------------------------------------------------
  // MUNDO (world.js): ciclo de día y noche, días de la semana, clima, hotel y favores de la mafia
  // ---------------------------------------------------------------
  const WORLD = {
    firstWeekday: 2,              // el día 1 es miércoles (0 = lunes): el primer finde llega rápido
    weekdays: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"],
    weekdayDemand: [0.7, 0.9, 0.95, 1.0, 1.4, 1.55, 1.1], // lunes tranquilo, viernes y sábado a full
    weekdayCrowd: [1, 1, 1, 1, 1.15, 1.25, 1],             // tope de gente adentro (× asientos) en el finde
    // clima: chance por día (el día 1 siempre soleado) y efecto en la demanda por tipo de cliente
    weather: {
      sunny:  { name: "Soleado",     icon: "☀", chance: 0.37, demand: 1.0,  types: { casual: 1.05 }, hotel: 1.0 },
      cloudy: { name: "Nublado",     icon: "☁", chance: 0.27, demand: 1.0,  types: { regular: 1.08 }, hotel: 1.0 },
      rain:   { name: "Lluvia",      icon: "☂", chance: 0.18, demand: 0.75, types: { casual: 0.6, regular: 0.9, highroller: 1.05, vip: 1.1 }, hotel: 0.85, guestRounds: 1.3 },
      storm:  { name: "Tormenta",    icon: "⚡", chance: 0.08, demand: 0.6,  types: { casual: 0.45, regular: 0.8, highroller: 1.0, vip: 1.0 }, hotel: 0.7, guestRounds: 1.5, outageMul: 3, flashEvery: [14, 40], outageChance: 0.12 },
      heat:   { name: "Ola de calor", icon: "♨", chance: 0.10, demand: 1.08, types: { casual: 1.15, regular: 1.05 }, hotel: 1.1, drinkBreak: 0.35, drinkCat: 2.2, wantsDrink: ["regular"] },
    },
    // hotel arriba del casino
    hotel: {
      rank: 5, licPrice: 8000, buildPrice: 30000,
      rooms: {
        standard:  { name: "Estándar",  price: 4000,  max: 6, rate: 180,  upkeep: 35,  clean: 25,  type: "regular",    budgetMul: 1.7, roundsMul: 1.5, rank: 5 },
        suite:     { name: "Suite",     price: 12000, max: 4, rate: 550,  upkeep: 90,  clean: 60,  type: "highroller", budgetMul: 1.8, roundsMul: 1.6, rank: 5, needs: { standard: 2 } },
        penthouse: { name: "Penthouse", price: 40000, max: 1, rate: 2200, upkeep: 300, clean: 180, type: "vip",        budgetMul: 2.0, roundsMul: 1.8, rank: 6, needs: { suite: 2 }, minRep: 60 },
      },
      bookBase: 0.42,             // chance por habitación libre por día (× reputación, finde, clima, limpieza)
      weekend: [0.6, 0.8, 0.9, 1.0, 1.5, 1.6, 0.9],
      nights: [1, 3], arrive: [12, 20], waitHours: 1.2, receptionWage: 160,
      tipRight: 0.25, tipWrong: 0.05, xpCheckin: 12, repNoShow: -1, cleanDecay: 18, dirtyRep: -2,
      downHours: [17, 22],        // a qué hora bajan los huéspedes a jugar
    },
    // favores de Don Aurelio
    mafia: {
      firstDay: 4, every: [3, 5], protDecay: 3, thiefK: 0.6, fightK: 0.65, bribeK: 0.3, refuseStreakThieves: 2,
      lavado:   { bag: 6000, bets: 8000, keep: 0.3, days: 2, heat: 6, heatOk: 6, prot: 15, findChance: 0.25, fine: 3000, failPay: 3000, failProt: -20 },
      amigo:    { loss: [1800, 3200], prot: 18, failProt: -15, hour: 19, greetHours: 1.2 },
      paquete:  { pay: 1500, closes: 3, okPay: 1000, prot: 20, findChance: 0.45, fine: 4000, heat: 18, failProt: -20 },
      despido:  { pay: 800, prot: 15, rep: -2, days: 2, failProt: -15 },
      sabotaje: { cost: 1000, prot: 12, heat: 10, seenChance: 0.3, seenHeat: 15, rivalMul: 0.75, rivalDays: 3, days: 2, holdSec: 3, failProt: -12 },
      proteccion: { perRank: 700, prot: 25, refuseProt: -15, thiefDays: 2, thiefMul: 1.8 },
      refuseProt: -10,
    },
  };

  // ---------------------------------------------------------------
  // JUEGOS NUEVOS (games.js): dados, bingo nocturno y carreras de caballos
  // Tiempos en segundos de simulación (1 hora = 30 s). Pagos de los dados = reglas reales de craps.
  // ---------------------------------------------------------------
  const GAMES = {
    dados: {
      fieldPays: { 2: 2, 12: 3 },  // campo: 3,4,9,10,11 pagan 1:1; el 2 paga 2:1 y el 12 3:1 (ventaja 2,8%)
      any7Pays: 4,                 // cualquier 7 paga 4:1 (la justa sería 5:1: ventaja 16,7%)
      dontChance: { casual: 0.15, regular: 0.25, highroller: 0.4, vip: 0.35 },
      fieldChance: { casual: 0.6, regular: 0.35, highroller: 0.2, vip: 0.15 },
      any7Chance: { casual: 0.25, regular: 0.1, highroller: 0.06, vip: 0.05 },
      hotStreak: 3,                // racha de puntos hechos o naturales seguidos = ¡mano caliente!
      hotAppealMul: 1.6, hotSec: 30, crowdR: 9,
      callTip: 0.04, parSec: 2.5, afkSec: 45, repMistake: -0.5, repPerfect: 0.1, xpRoll: 1, xpPerfect: 1,
      maxPower: 3400, // px/s de la tirada con el mouse: más fuerte, un dado salta de la mesa (más flojo que ~800 no llega a la pared: tiro nulo)
    },
    bingo: {
      startHour: 20, presaleHour: 19.5, // a las 19:30 se anuncia; a las 20 abre la sala hasta el cierre
      cardPrice: 25, maxCards: 4, prizeShare: 0.6, // el premio es el 60% de lo vendido en la partida (la casa se queda el 40%)
      saleSec: 2.5, pauseSec: 2, minPlayers: 2,
      slowSec: 4, boredSec: 10,    // sin cantar: aburre (ánimo) y después se van
      shoutChance: 0.92, falseChance: 0.05,
      fillPerHour: 10,             // clientes extra que entran a jugar al bingo por hora de sesión
      repWrongCall: -0.4, repWrongVerdict: -1.2, repMissed: -1.5, repSlow: -0.3, repGame: 0.2,
      xpGame: 4, xpCall: 0.5, tipPerGame: 0.04,
    },
    carreras: {
      everyMin: 40, raceSec: 8, resultSec: 2.5, // una carrera cada 40 min de juego; dura 8 s (16 min)
      horses: 6, minOdds: 1.3, bigWinOdds: 5,
      stakes: [50, 100, 250, 500], // apuestas del bolsillo del jugador
      racesPerCustomer: [1, 3],
      longshot: { casual: 0.35, regular: 0.2, highroller: 0.15, vip: 0.25 },
    },
  };

  window.CASINO_DATA = { CFG, DIFFICULTY, RANKS, XP, MACHINES, RTP_SETTINGS, TABLES, STAFF, CUSTOMER_TYPES, THIEF, INSPECTOR,
    ZONES, DECOR, HEAT, LOANS, LOAN_RULES, RIVAL, OBJECTIVES, OBJECTIVES_PER_DAY, CATS, LIFE, SHOP, LICENSES, UP_BRANCHES, UPGRADES, OWNER, MODES, CHALLENGE, WORLD, GAMES };

  // ---------------------------------------------------------------
  // SOCIOS Y TORNEO DE PÓKER (clients.js)
  // ---------------------------------------------------------------
  Object.assign(CATS, { members: "Propinas de socios", tourney: "Torneo de póker" });
  window.CASINO_DATA.CLIENTS = {
    maxMembers: 12, minRank: 2,            // la tarjeta de socio se ofrece desde el rango 2
    happySat: 0.68,                        // satisfacción estimada mínima para ofrecer la tarjeta
    acceptChance: 0.85, declineCooldown: 1, // si dice que no, no se le vuelve a ofrecer en esa visita
    startPts: 25, maxPts: 100,             // fidelidad: 0..100 (≤ 0 cancela la tarjeta)
    levels: [                              // bronce / plata / oro
      { id: "bronce", name: "Bronce", min: 0,  color: "#c07a3a", visit: 0.45, budgetMul: 1.0, betMul: 1.0, friends: 0,   tip: 0 },
      { id: "plata",  name: "Plata",  min: 40, color: "#c9ced4", visit: 0.65, budgetMul: 1.4, betMul: 1.3, friends: 0.35, tip: 40 },
      { id: "oro",    name: "Oro",    min: 75, color: "#f0c24a", visit: 0.85, budgetMul: 2.0, betMul: 1.7, friends: 1.2,  tip: 120 },
    ],
    reqChance: 0.8,                        // probabilidad de que traiga un pedido en cada visita
    reqOk: 12, reqFail: -15,               // fidelidad por pedido cumplido / fallado (× personalidad)
    visitGood: 4, visitBad: -6,            // por cómo salió la visita (satisfacción ≥ 0,6 / < 0,4)
    noShowDays: 6, noShowPts: -3,          // si hace muchos días que no viene, se enfría
    reqSec: 1.2,                           // horas que espera un trago o su tema
    playSec: 6,                            // segundos jugando en el juego pedido para darlo por cumplido
    premiumDrink: 35,                      // lo que deja de más un trago premium servido a un socio
    musicFee: 0,                           // poner su tema no cuesta nada (la rockola es tuya)
    xpReq: 12,                             // XP por pedido cumplido
    poachChance: 0.12, poachDays: 2, poachKeep: 6, // El Faraón tienta a un socio: tenés 2 días para una visita buena
    friendTypes: ["casual", "regular"],
  };
  window.CASINO_DATA.TOURNEY = {
    weekday: 6, announceDays: 3,           // sábado (día % 7 === 6), se anuncia 3 días antes
    arriveHour: 16.5, startHour: 17,       // llegan los jugadores y empieza
    entrants: 8, physical: 6, celebs: 2,   // 8 inscriptos (cuartos, semis, final), 6 sentados en la mesa, 2 famosos
    fee: 600, houseShare: 0.25,            // inscripción por jugador; la casa se queda con 25% del pozo
    matchSec: 13,                          // segundos de simulación por partido (llave de 7 partidos ≈ 3 h)
    winsToAdvance: 2,                      // al mejor de 3 manos
    goodCoverage: 0.5, goodHands: 2,       // sale bien si hubo croupier la mitad del torneo o repartiste 2 manos
    handXp: 6, handTip: 30,                // por cada mano que repartís vos en el torneo (la propina × ronda)
    goodRep: 6, goodXp: 80, badRep: -2, noTableRep: -3,
    demandMul: 1.25, goodDemandMul: 1.5,   // más gente esa noche (anuncio / si sale bien)
  };
  // ---------------------------------------------------------------
  // ARMAS Y PELEAS (combat.js): armas blancas y de fuego, daño a máquinas y clientes, sangre y la Mafia
  // ---------------------------------------------------------------
  Object.assign(CATS, { weapons: "Armas y municiones", cleaning: "Limpieza especial (alfombra)", hospital: "Gastos médicos" });
  window.CASINO_DATA.COMBAT = {
    key: "KeyF", keyLabel: "F",           // equipar / guardar el arma (cambia entre las que tengas); clic izquierdo ataca
    weapons: [
      { id: "knife",  name: "Cuchillo de cocina",   kind: "melee",  rank: 1, price: 150,  dmg: 22, range: 1.9, cd: 0.45, hit: 0.75, desc: "Arma blanca. Corto y rápido; rompe pantallas." },
      { id: "bat",    name: "Bate de béisbol",      kind: "melee",  rank: 2, price: 320,  dmg: 34, range: 2.5, cd: 0.8,  hit: 0.95, desc: "Arma blanca. Pega fuerte y tiene alcance; las máquinas lo sienten." },
      { id: "pistol", name: "Pistola 9 mm",        kind: "ranged", rank: 4, price: 1800, dmg: 60, range: 30,  cd: 0.4,  hit: 0.28, desc: "Arma de fuego con permiso de tenencia. Un disparo se oye en todo el salón." },
    ],
    ammo: { price: 120, amount: 12, max: 60, startWith: 12 }, // caja de municiones (se compra aparte)
    player: { hp: 100, regenPerSec: 2.5, regenDelay: 6, koSec: 7, koHpBack: 55, koPocketLoss: 0.12 },
    customer: { hp: 60, toughHp: 110, toughTypes: ["highroller", "vip"], hit: 16, hitCd: 0.9, speed: 3.1, dodge: 0.3, reach: 1.15, downSec: 5, fleeAfterHit: 7 },
    machine: { dmgMelee: 1, dmgBullet: 0.6, repairMulPerDmg: 0.9, repairMulMax: 4.5, repRepair: 0, floorSec: 1.5 },
    security: { runSpeed: 5.4, helpDelay: 1.2, swingSec: 0.9, tempSec: 22 },
    blood: { cleanCost: 450, cleanSec: 7, atr: 6, repHit: -8, heatHit: 14, repMelee: -3, heatMelee: 4, max: 6 },
    mafia: { hour: 21, shootSec: 14, gunmen: 6, cars: 3, rep: -18, heat: 22, repHit: -2, speak: "Te metiste contra la Mafia" },
  };

  // ---------------------------------------------------------------
  // VOLVER CADA DÍA (daily.js): premio por entrar cada día (con racha) y lo que juntó el personal mientras no estabas
  // ---------------------------------------------------------------
  Object.assign(CATS, { daily: "Premio del día", away: "Mientras no estabas" });
  window.CASINO_DATA.DAILY = {
    rewards: [300, 500, 800, 1200, 1800, 2500, 4000], // plata por día de racha (del día 7 en adelante se queda en el último)
    xp: [10, 15, 20, 30, 40, 50, 100],                 // experiencia por día de racha
    rankMul: 0.35,      // cada rango arriba del 1 suma 35 % al premio en plata
    roundTo: 10,
    delaySec: 3,        // espera después de entrar, para que primero salgan los avisos de bienvenida
    away: { minHours: 1, maxHours: 8, perHourShare: 0.04 }, // por hora afuera (tope 8 h): 4 % de la ganancia del último día, si tenés personal
  };
})();
