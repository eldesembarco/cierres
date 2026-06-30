// Mock data — POS El Desembarco · Lista oficial Mayo 2026 (BA / Gualeguaychú / MdP)
// Productos cargados desde la lista de precios real

window.POS_DATA = (() => {
  const categorias = [
    { id: "burgers",   nombre: "Burgers",       icon: "🍔" },
    { id: "veggies",   nombre: "Veggies",       icon: "🥬" },
    { id: "papas",     nombre: "Papas",         icon: "🍟" },
    { id: "entradas",  nombre: "Entradas",      icon: "🧀" },
    { id: "ensaladas", nombre: "Ensaladas",     icon: "🥗" },
    { id: "tostados",  nombre: "Tostados",      icon: "🥪" },
    { id: "milas",     nombre: "Milanesas",     icon: "🍖" },
    { id: "sand-mila", nombre: "Sandwich Mila", icon: "🥖" },
    { id: "sintacc",   nombre: "Sin TACC",      icon: "🌾" },
    { id: "combos",    nombre: "Combos",        icon: "🎁" },
    { id: "tiradas",   nombre: "Cervezas",      icon: "🍺" },
    { id: "gaseosas",  nombre: "Gaseosas",      icon: "🥤" },
    { id: "aguas",     nombre: "Aguas",         icon: "💧" },
  ];

  // Modificadores (sin/con) y agregados con costo
  const modBurger = ["Sin cebolla", "Sin tomate", "Sin lechuga", "Sin pickles", "Sin salsa", "Cocción jugosa", "Cocción a punto", "Cocción cocida", "Para llevar"];
  const addBurger = [
    ["Medallón extra", 3200],
    ["Cheddar extra", 1400],
    ["Panceta extra", 1600],
    ["Huevo", 1100],
    ["Cebolla caramelizada", 1300],
    ["Aros de cebolla", 1500],
  ];
  const modMila = ["Sin queso", "Sin jamón", "Sin tomate", "Para llevar"];
  const modSimple = ["Para llevar", "Sin hielo", "Sin limón"];
  const sizesMila = [["Carne", 0], ["Pollo", 0]];

  const productos = [
    // ===== BURGERS =====
    { id: "130026", cat: "burgers", nombre: "Cheese Simple",        desc: "Hamburguesa cheese clásica + papas",                                       precio: 11500, modifs: modBurger, agregados: addBurger, tag: "POPULAR" },
    { id: "130005", cat: "burgers", nombre: "Vicio",                desc: "Doble medallón + papas",                                                   precio: 12600, modifs: modBurger, agregados: addBurger },
    { id: "130001", cat: "burgers", nombre: "Bajoncito",            desc: "Medallón, cheddar, panceta + papas",                                       precio: 14000, modifs: modBurger, agregados: addBurger, tag: "POPULAR" },
    { id: "130009", cat: "burgers", nombre: "Perla Negra",          desc: "Medallón, queso ahumado, cebolla caramelizada + papas",                    precio: 14600, modifs: modBurger, agregados: addBurger },
    { id: "130002", cat: "burgers", nombre: "Petit Butter",         desc: "Medallón, manteca de hierbas, cheddar + papas",                            precio: 15200, modifs: modBurger, agregados: addBurger },
    { id: "130046", cat: "burgers", nombre: "Vicio Doble",          desc: "Doble medallón cargado + papas",                                           precio: 17800, modifs: modBurger, agregados: addBurger },
    { id: "130016", cat: "burgers", nombre: "Doble Cheese",         desc: "Doble medallón, doble cheddar + papas",                                    precio: 21800, modifs: modBurger, agregados: addBurger },
    { id: "130021", cat: "burgers", nombre: "San Antonio",          desc: "Doble medallón, panceta, cebolla crispy + papas",                          precio: 21800, modifs: modBurger, agregados: addBurger },
    { id: "130020", cat: "burgers", nombre: "Desembarco",           desc: "La de la casa: doble medallón, cheddar, panceta, salsa de la casa + papas", precio: 21800, modifs: modBurger, agregados: addBurger, tag: "DESTACADA" },
    { id: "130045", cat: "burgers", nombre: "Bajoncito Doble",      desc: "Doble medallón, cheddar, panceta + papas",                                 precio: 21800, modifs: modBurger, agregados: addBurger },
    { id: "130048", cat: "burgers", nombre: "General Belgrano 2.0", desc: "Receta especial doble + papas",                                            precio: 21800, modifs: modBurger, agregados: addBurger },
    { id: "130012", cat: "burgers", nombre: "Normandía",            desc: "Doble medallón, queso brie, cebolla caramelizada + papas",                 precio: 21800, modifs: modBurger, agregados: addBurger },

    // ===== VEGGIES =====
    { id: "130036", cat: "veggies", nombre: "Chiquillan",  desc: "Vegetariana, medallón de legumbres + papas",     precio: 16300, modifs: ["Sin cebolla", "Sin tomate", "Sin lechuga", "Para llevar"], tag: "VEGGIE" },
    { id: "130024", cat: "veggies", nombre: "Spiro",       desc: "Veggie con vegetales grillados + papas",          precio: 16300, modifs: ["Sin cebolla", "Sin tomate", "Para llevar"], tag: "VEGGIE" },

    // ===== PAPAS =====
    { id: "140001", cat: "papas", nombre: "Estuche de papas",   precio:  4200, modifs: ["Para llevar"] },
    { id: "140014", cat: "papas", nombre: "Porción de papas",   precio:  7800, modifs: ["Para llevar"] },
    { id: "140012", cat: "papas", nombre: "Papas Desembarco",   desc: "Cheddar, panceta y cebolla crispy",     precio: 13400, modifs: ["Sin cebolla", "Para llevar"], tag: "POPULAR" },
    { id: "140013", cat: "papas", nombre: "Papas Pulled Pork",  desc: "Con cerdo desmechado y cheddar",        precio: 16700, modifs: ["Para llevar"] },
    { id: "140005", cat: "papas", nombre: "Aros de cebolla",    precio: 12700, modifs: ["Para llevar"] },

    // ===== ENTRADAS =====
    { id: "140004", cat: "entradas", nombre: "Triángulos de muzzarella", precio: 16400, modifs: ["Para llevar"] },
    { id: "140016", cat: "entradas", nombre: "Nuggets x10",              desc: "Entrada",                     precio: 11300, modifs: ["Para llevar"] },
    { id: "140015", cat: "entradas", nombre: "Nuggets x10 + papas",      precio: 14700, modifs: ["Para llevar"] },
    { id: "140006", cat: "entradas", nombre: "Empanadas x2",             desc: "Salón",                       precio:  7800, modifs: ["Para llevar"] },
    { id: "140002", cat: "entradas", nombre: "Picada para dos",          desc: "Tabla mixta",                  precio: 33000, modifs: ["Para llevar"], tag: "PARA 2" },

    // ===== ENSALADAS =====
    { id: "210006", cat: "ensaladas", nombre: "Caesar Salad",          desc: "Sola",       precio: 13000, modifs: ["Sin crutones", "Sin queso", "Para llevar"] },
    { id: "210002", cat: "ensaladas", nombre: "Caesar Salad Grillado", desc: "Con pollo grillado",  precio: 18000, modifs: ["Sin crutones", "Sin queso", "Para llevar"] },
    { id: "210008", cat: "ensaladas", nombre: "Caesar Salad Crispy",   desc: "Con pollo crispy",    precio: 21000, modifs: ["Sin crutones", "Sin queso", "Para llevar"] },

    // ===== TOSTADOS =====
    { id: "220010", cat: "tostados", nombre: "Tostado Desembarco", precio: 8000, modifs: ["Para llevar"] },
    { id: "220011", cat: "tostados", nombre: "Tostado Normandía",  precio: 8000, modifs: ["Para llevar"] },
    { id: "220008", cat: "tostados", nombre: "Tostado Bajoncito",  precio: 8000, modifs: ["Para llevar"] },
    { id: "220009", cat: "tostados", nombre: "Tostado Boedo",      precio: 8000, modifs: ["Para llevar"] },

    // ===== MILANESAS (Carne / Pollo) =====
    { id: "150001", cat: "milas", nombre: "Mila Clásica",          desc: "Con papas",                          precio: 20500, modifs: modMila, sizes: sizesMila },
    { id: "150002", cat: "milas", nombre: "Mila Caballo",          desc: "Con huevo y papas",                  precio: 22800, modifs: modMila, sizes: sizesMila },
    { id: "150004", cat: "milas", nombre: "Mila Cheddar y Panceta", desc: "Con papas",                         precio: 23900, modifs: modMila, sizes: sizesMila },
    { id: "150003", cat: "milas", nombre: "Mila Napolitana",       desc: "Jamón, muzzarella, tomate + papas",  precio: 25400, modifs: modMila, sizes: sizesMila, tag: "POPULAR" },
    { id: "150011", cat: "milas", nombre: "Mila Morrón y Muzza",   desc: "Con papas",                          precio: 25400, modifs: modMila, sizes: sizesMila },

    // ===== SANDWICH DE MILA =====
    { id: "170011", cat: "sand-mila", nombre: "Sándwich Mila",          desc: "Mila + pan + lechuga + tomate",        precio: 18000, modifs: modMila, sizes: sizesMila },
    { id: "170001", cat: "sand-mila", nombre: "Sándwich Mila Completo", desc: "Con huevo, jamón y queso",             precio: 19900, modifs: modMila, sizes: sizesMila },
    { id: "170002", cat: "sand-mila", nombre: "Sándwich Mila Especial", desc: "Receta especial",                       precio: 19900, modifs: modMila, sizes: sizesMila },

    // ===== SIN TACC / WOK =====
    { id: "230001", cat: "sintacc", nombre: "Mila Sin TACC",         desc: "Apta celíacos",                       precio: 22500, modifs: ["Para llevar"], tag: "SIN TACC" },
    { id: "040018", cat: "sintacc", nombre: "Wok de vegetales",      desc: "Sin TACC, vegetales salteados",       precio: 24500, modifs: ["Para llevar"], tag: "SIN TACC" },

    // ===== COMBOS =====
    { id: "508051", cat: "combos", nombre: "Combo Argento",                 desc: "Cheese simple + papas + vaso de gaseosa tirada",     precio:  8000, tag: "COMBO" },
    { id: "508052", cat: "combos", nombre: "Balde Día de la Hamburguesa",   desc: "Edición 2026 — Cheese simple",                       precio: 25000, tag: "PROMO" },

    // ===== CERVEZAS TIRADAS =====
    { id: "030002", cat: "tiradas", nombre: "1/2 Pinta Clásica",       desc: "Tirada",                              precio:  4000, modifs: modSimple },
    { id: "030326", cat: "tiradas", nombre: "1/2 Pinta Premium",       desc: "Tirada",                              precio:  4200, modifs: modSimple },
    { id: "030003", cat: "tiradas", nombre: "Recarga 1L Clásica",      precio:  9900, modifs: modSimple, tag: "RECARGA" },
    { id: "030327", cat: "tiradas", nombre: "Recarga 1L Premium",      precio: 10100, modifs: modSimple, tag: "RECARGA" },
    { id: "030004", cat: "tiradas", nombre: "Recarga 2L Clásica",      precio: 19700, modifs: modSimple, tag: "RECARGA" },
    { id: "030328", cat: "tiradas", nombre: "Recarga 2L Premium",      precio: 19900, modifs: modSimple, tag: "RECARGA" },

    // ===== GASEOSAS =====
    { id: "020009", cat: "gaseosas", nombre: "Coca Cola 500cc",          precio: 3700, modifs: modSimple },
    { id: "020010", cat: "gaseosas", nombre: "Coca Cola Zero 500cc",     precio: 3700, modifs: modSimple },
    { id: "020011", cat: "gaseosas", nombre: "Coca Cola Light 500cc",    precio: 3700, modifs: modSimple },
    { id: "800021", cat: "gaseosas", nombre: "Sprite 500cc",             precio: 3700, modifs: modSimple },
    { id: "020013", cat: "gaseosas", nombre: "Sprite Zero 500cc",        precio: 3700, modifs: modSimple },
    { id: "020014", cat: "gaseosas", nombre: "Fanta 500cc",              precio: 3700, modifs: modSimple },
    { id: "020001", cat: "gaseosas", nombre: "Coca Cola 350cc",          precio: 3700, modifs: modSimple },
    { id: "020002", cat: "gaseosas", nombre: "Coca s/ azúcar 350cc",     precio: 3700, modifs: modSimple },
    { id: "020003", cat: "gaseosas", nombre: "Coca Cola Light 350cc",    precio: 3700, modifs: modSimple },
    { id: "020004", cat: "gaseosas", nombre: "Sprite 350cc",             precio: 3700, modifs: modSimple },
    { id: "020005", cat: "gaseosas", nombre: "Sprite s/ azúcar 350cc",   precio: 3700, modifs: modSimple },
    { id: "020006", cat: "gaseosas", nombre: "Fanta 350cc",              precio: 3700, modifs: modSimple },
    { id: "020033", cat: "gaseosas", nombre: "Aquarius Manzana 500cc",   precio: 3700, modifs: modSimple },
    { id: "020032", cat: "gaseosas", nombre: "Aquarius Naranja 500cc",   precio: 3700, modifs: modSimple },
    { id: "020037", cat: "gaseosas", nombre: "Aquarius Pera 500cc",      precio: 3700, modifs: modSimple },
    { id: "020034", cat: "gaseosas", nombre: "Aquarius Pomelo 500cc",    precio: 3700, modifs: modSimple },
    { id: "020041", cat: "gaseosas", nombre: "Aquarius Uva 500cc",       precio: 3700, modifs: modSimple },

    // ===== AGUAS =====
    { id: "020030", cat: "aguas", nombre: "Agua sin gas Smart 500cc", precio: 3700, modifs: ["Para llevar"] },
    { id: "020031", cat: "aguas", nombre: "Agua con gas Smart 500cc", precio: 3700, modifs: ["Para llevar"] },
  ];

  // Mesas con disposición espacial sobre canvas 1380×940 — mesas grandes que ocupan todo el espacio
  const mesas = [
    // ====== Sector ventana / fila izquierda — mesas de 2 ======
    { id: 1,  x:  50, y:  70, w: 260, h: 220, sillas: 2, estado: "ocupada",   mozo: "M. Cruz", desde: "20:14", total: 21800, items: 2 },
    { id: 2,  x:  50, y: 320, w: 260, h: 220, sillas: 2, estado: "libre" },
    { id: 3,  x:  50, y: 570, w: 260, h: 220, sillas: 2, estado: "porPagar", mozo: "M. Cruz", desde: "19:32", total: 47800, items: 6 },
    { id: 4,  x:  50, y: 820, w: 260, h: 100, sillas: 2, estado: "ocupada",  mozo: "L. Sosa", desde: "21:02", total: 11500, items: 2 },

    // ====== Sector central — mesas de 4 ======
    { id: 5,  x: 360, y:  70, w: 320, h: 270, sillas: 4, estado: "ocupada",   mozo: "M. Cruz", desde: "20:30", total: 38900, items: 5 },
    { id: 6,  x: 360, y: 370, w: 320, h: 270, sillas: 4, estado: "esperando", mozo: "L. Sosa", desde: "21:18", total: 0,     items: 0 },
    { id: 7,  x: 360, y: 670, w: 320, h: 250, sillas: 4, estado: "libre" },

    // ====== Barra alta — círculos chicos ======
    { id: 8,  x: 740, y:  70, w: 150, h: 150, sillas: 2, estado: "libre",    tipo: "alta" },
    { id: 9,  x: 740, y: 250, w: 150, h: 150, sillas: 2, estado: "ocupada",  mozo: "F. Diaz", desde: "20:48", total: 25400, items: 3, tipo: "alta" },
    { id: 10, x: 740, y: 430, w: 150, h: 150, sillas: 2, estado: "reservada", reserva: "21:30 — Pérez (4)", tipo: "alta" },
    { id: 11, x: 740, y: 610, w: 150, h: 150, sillas: 2, estado: "ocupada",  mozo: "F. Diaz", desde: "21:00", total: 19900, items: 4, tipo: "alta" },

    // ====== Sector derecho — mesas grandes ======
    { id: 12, x: 940, y:  70, w: 390, h: 310, sillas: 8, estado: "ocupada",   mozo: "M. Cruz", desde: "20:00", total: 89400, items: 12 },
    { id: 13, x: 940, y: 410, w: 390, h: 250, sillas: 6, estado: "libre" },
    { id: 14, x: 940, y: 690, w: 390, h: 230, sillas: 6, estado: "esperando", mozo: "L. Sosa", desde: "21:22", total: 0, items: 0 },
  ];

  const pedidos = [
    {
      id: "T-104", origen: "mesa", mesa: 5, mozo: "M. Cruz", desde: "21:14", estado: "nuevo",
      items: [
        { nombre: "Desembarco",  qty: 2, mods: ["Sin cebolla", "Cocción jugosa"] },
        { nombre: "Papas Desembarco", qty: 1 },
        { nombre: "1/2 Pinta Clásica", qty: 2 },
      ],
    },
    {
      id: "PY-8821", origen: "pedidosya", cliente: "Joaquín R.", desde: "21:11", estado: "nuevo",
      items: [
        { nombre: "Vicio Doble", qty: 1 },
        { nombre: "Porción de papas", qty: 1 },
        { nombre: "Coca Cola 500cc", qty: 1 },
      ],
      etiqueta: "Cadete PedidosYa",
    },
    {
      id: "T-103", origen: "mesa", mesa: 12, mozo: "M. Cruz", desde: "21:06", estado: "preparacion",
      items: [
        { nombre: "Picada para dos", qty: 1 },
        { nombre: "Triángulos de muzzarella", qty: 2 },
        { nombre: "Desembarco", qty: 2 },
        { nombre: "Bajoncito", qty: 1 },
      ],
    },
    {
      id: "RP-4452", origen: "rappi", cliente: "Vale M.", desde: "21:02", estado: "preparacion",
      items: [
        { nombre: "Bajoncito", qty: 2, mods: ["Sin pickles"] },
        { nombre: "Aros de cebolla", qty: 1 },
      ],
    },
    {
      id: "T-102", origen: "mesa", mesa: 9, mozo: "F. Diaz", desde: "20:58", estado: "preparacion",
      items: [
        { nombre: "Chiquillan (Veggie)", qty: 1 },
        { nombre: "Cheese Simple", qty: 1, mods: ["Sin tomate", "Cocción a punto"] },
      ],
    },
    {
      id: "T-101", origen: "mesa", mesa: 1, mozo: "M. Cruz", desde: "20:54", estado: "listo",
      items: [
        { nombre: "Mila Napolitana (Carne)", qty: 1 },
        { nombre: "Caesar Salad Crispy", qty: 1 },
      ],
    },
    {
      id: "MP-2019", origen: "mp", cliente: "Sebas L.", desde: "20:52", estado: "listo",
      items: [
        { nombre: "Doble Cheese", qty: 2 },
        { nombre: "Papas Pulled Pork", qty: 1 },
      ],
      etiqueta: "MP Envíos",
    },
  ];

  const inbox = [
    // ====== ACTIVOS ======
    {
      id: "PY-8821", app: "pedidosya", cliente: "Joaquín Rodriguez",
      hora: "21:11", estado: "nuevo",
      pago: "Pagado online", dir: "Av. Pueyrredón 1234, 4°B",
      items: [
        { nombre: "Vicio Doble", qty: 1, precio: 17800 },
        { nombre: "Porción de papas", qty: 1, precio: 7800 },
        { nombre: "Coca Cola 500cc", qty: 1, precio: 3700 },
      ],
      subtotal: 29300,
      descVendor: -1500,    // 2x1 papas o promo de la casa
      descApp: -2600,       // descuento de PedidosYa
      total: 25200,
    },
    {
      id: "RP-4452", app: "rappi", cliente: "Vale Martínez",
      hora: "21:02", estado: "preparacion",
      pago: "Pagado online", dir: "Sarmiento 4567, PB",
      items: [
        { nombre: "Bajoncito", qty: 2, precio: 14000, mods: ["Sin pickles"] },
        { nombre: "Aros de cebolla", qty: 1, precio: 12700 },
      ],
      subtotal: 40700,
      descVendor: 0,
      descApp: 600,         // recargo / fee — positivo aquí
      total: 41300,
    },
    {
      id: "MP-2019", app: "mp", cliente: "Sebastián López",
      hora: "20:52", estado: "listo",
      pago: "Pagado online · MP", dir: "Cabildo 890, 7°A",
      items: [
        { nombre: "Doble Cheese", qty: 2, precio: 21800 },
        { nombre: "Papas Pulled Pork", qty: 1, precio: 16700 },
      ],
      subtotal: 60300,
      descVendor: 0,
      descApp: 0,
      total: 60300,
    },
    {
      id: "PY-8823", app: "pedidosya", cliente: "Lucas, Lautaro",
      hora: "21:18", estado: "nuevo",
      pago: "Pagado online", dir: "Av. La Plata 2345, 5°A",
      items: [
        { nombre: "Desembarco", qty: 2, precio: 21800, mods: ["Sin cebolla"] },
        { nombre: "1/2 Pinta Premium", qty: 2, precio: 4200 },
      ],
      subtotal: 52000,
      descVendor: -3000,
      descApp: -5200,       // 20% off PY
      total: 43800,
    },
    {
      id: "RP-4458", app: "rappi", cliente: "Pedro G.",
      hora: "21:15", estado: "preparacion",
      pago: "Pagado online", dir: "Av. Rivadavia 4980, 8°D",
      items: [
        { nombre: "Cheese Simple", qty: 1, precio: 11500 },
        { nombre: "Estuche de papas", qty: 1, precio: 4200 },
      ],
      subtotal: 15700,
      descVendor: 0,
      descApp: 0,
      total: 15700,
    },

    // ====== HISTORIAL (entregados / cerrados) ======
    {
      id: "PY-8819", app: "pedidosya", cliente: "Carla Fernandez",
      hora: "20:40", estado: "entregado",
      pago: "Pagado online", dir: "Scalabrini 2100, 2°A",
      items: [
        { nombre: "Cheese Simple", qty: 1, precio: 11500 },
      ],
      subtotal: 11500, descVendor: 0, descApp: 0, total: 11500,
    },
    {
      id: "RP-4441", app: "rappi", cliente: "Tomás Benvenuto",
      hora: "20:22", estado: "entregado",
      pago: "Pagado online", dir: "Honduras 5610, 3°D",
      items: [
        { nombre: "Bajoncito Doble", qty: 1, precio: 21800 },
        { nombre: "Papas Desembarco", qty: 1, precio: 13400 },
        { nombre: "Coca Cola 500cc", qty: 2, precio: 3700 },
        { nombre: "Triángulos de muzzarella", qty: 1, precio: 16400 },
      ],
      subtotal: 59000, descVendor: 0, descApp: -3000, total: 56000,
    },
    {
      id: "MP-2017", app: "mp", cliente: "Florencia A.",
      hora: "20:05", estado: "entregado",
      pago: "Pagado online · MP", dir: "Av. Las Heras 3110, 12°B",
      items: [
        { nombre: "Caesar Salad Grillado", qty: 1, precio: 18000 },
      ],
      subtotal: 18000, descVendor: 0, descApp: 0, total: 18000,
    },
    {
      id: "PY-8810", app: "pedidosya", cliente: "Mariano D.",
      hora: "19:48", estado: "entregado",
      pago: "Pagado online", dir: "Av. Corrientes 4500, 6°C",
      items: [
        { nombre: "San Antonio", qty: 1, precio: 21800 },
        { nombre: "Aros de cebolla", qty: 1, precio: 12700 },
      ],
      subtotal: 34500, descVendor: -2000, descApp: -3450, total: 29050,
    },
    {
      id: "RP-4430", app: "rappi", cliente: "Juana, Camila",
      hora: "19:30", estado: "entregado",
      pago: "Pagado online", dir: "Acoyte 760, 4°A",
      items: [
        { nombre: "Combo Argento", qty: 2, precio: 8000 },
        { nombre: "1/2 Pinta Clásica", qty: 2, precio: 4000 },
      ],
      subtotal: 24000, descVendor: 0, descApp: -2400, total: 21600,
    },
    {
      id: "PY-8804", app: "pedidosya", cliente: "Diego P.",
      hora: "19:12", estado: "cancelado",
      pago: "Pagado online", dir: "Pedro Goyena 1800, 3°B",
      items: [
        { nombre: "Mila Napolitana (Carne)", qty: 1, precio: 25400 },
      ],
      subtotal: 25400, descVendor: 0, descApp: 0, total: 25400,
    },
  ];

  return { categorias, productos, mesas, pedidos, inbox };
})();
