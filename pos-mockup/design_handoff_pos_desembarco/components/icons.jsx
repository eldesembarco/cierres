// Iconos SVG inline — minimalistas, stroke 1.6, hereda currentColor
// Uso: <Icon name="search" size={20} />

const ICONS = {
  search: "M11 4a7 7 0 1 0 4.6 12.3l3.7 3.7M11 4a7 7 0 0 1 7 7",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  close: "M6 6l12 12M18 6L6 18",
  check: "M5 12.5l4 4 10-10",
  arrowL: "M15 6l-6 6 6 6",
  arrowR: "M9 6l6 6-6 6",
  arrowDn: "M6 9l6 6 6-6",
  arrowUp: "M6 15l6-6 6 6",
  more: "M6 12h.01M12 12h.01M18 12h.01",
  trash: "M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13",
  edit: "M14 4l6 6-10 10H4v-6L14 4zM12 6l6 6",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3a4 4 0 0 1 0 8M22 21a7 7 0 0 0-7-7",
  bell: "M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 21a2 2 0 0 0 4 0",
  printer: "M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z",
  card: "M2 8h20M2 8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8zM6 14h4",
  cash: "M2 7h20v10H2zM12 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM5 7v10M19 7v10",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 7v5l3 2",
  fire: "M12 22c5 0 8-3 8-7 0-3-2-5-3-7-1 2-2 3-4 3 0-3-1-5-3-7-2 5-6 7-6 11 0 4 3 7 8 7z",
  truck: "M2 6h13v11H2zM15 10h4l3 3v4h-7M5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  store: "M3 9l1-5h16l1 5M3 9v11h18V9M3 9h18M9 14h6",
  bag: "M5 8h14l-1 13H6L5 8zM9 8V5a3 3 0 0 1 6 0v3",
  chart: "M3 21h18M5 21V11M10 21V6M15 21v-9M20 21V3",
  gear: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.3 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.3l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  filter: "M4 5h16l-6 8v6l-4-2v-4L4 5z",
  pin: "M12 22s8-7 8-13a8 8 0 1 0-16 0c0 6 8 13 8 13zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  phone: "M22 17v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 1.7l.5 3a2 2 0 0 1-.5 1.8L7.6 10a16 16 0 0 0 6.4 6.4l1.5-1.4a2 2 0 0 1 1.8-.5l3 .5a2 2 0 0 1 1.7 2z",
  moto: "M5 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM5 15h6l4-7h4l2 4M11 8h4",
  copy: "M8 8h12v12H8zM4 16V4h12",
  refresh: "M3 12a9 9 0 0 1 15-6.7L21 8M21 4v4h-4M21 12a9 9 0 0 1-15 6.7L3 16M3 20v-4h4",
  split: "M6 3v4a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3v8M6 21v-2M18 3v2",
  tag: "M20 12L12 4H4v8l8 8 8-8zM8 8h.01",
  flame: "M12 2c1 6 5 6 5 11a5 5 0 1 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3 0-7 1-10z",
  burger: "M4 11h16M4 11a8 8 0 0 1 16 0M4 14h16M5 17h14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z",
  beer: "M5 11h11v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-9zM16 13h2a3 3 0 0 1 0 6h-2M5 11V8a3 3 0 0 1 6 0M11 8a3 3 0 0 1 5 0",
  music: "M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  power: "M18.4 6.6a9 9 0 1 1-12.8 0M12 2v10",
  receipt: "M5 3h14v18l-3-2-3 2-3-2-3 2-2-2zM8 7h8M8 11h8M8 15h5",
};

function Icon({ name, size = 20, stroke = 1.6, className, style }) {
  const d = ICONS[name];
  if (!d) return null;
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24"
         fill="none" stroke="currentColor" strokeWidth={stroke}
         strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d={d} />
    </svg>
  );
}

// Logo El Desembarco — usa la imagen oficial provista por el usuario
// El PNG es blanco sobre transparente. CSS controla si se invierte (light bg) o no (dark bg).
function BarLogo({ size = 44, invert }) {
  const h = size;
  const cls = "el-logo" + (invert === true ? " el-logo-invert" : invert === false ? " el-logo-noinvert" : " el-logo-auto");
  return (
    <div className={"brand-mark " + cls} style={{ height: h, display: "grid", placeItems: "center" }}>
      <img src="assets/logo-eldesembarco.png" alt="El Desembarco" style={{ height: h * 0.95, width: "auto", objectFit: "contain" }} />
    </div>
  );
}

// Formato moneda AR
function fmtAR(n) {
  if (n == null) return "";
  return "$" + Math.round(n).toLocaleString("es-AR");
}

// Tiempo transcurrido desde HH:MM hasta una "ahora" simulada
function tiempoDesde(hhmm, now = "21:24") {
  const [h1, m1] = hhmm.split(":").map(Number);
  const [h2, m2] = now.split(":").map(Number);
  return (h2 - h1) * 60 + (m2 - m1);
}

// Color por origen
const ORIGEN_COLOR = {
  pedidosya: "var(--app-pedidosya)",
  rappi: "var(--app-rappi)",
  mp: "var(--app-mp)",
  propio: "var(--app-propio)",
  mesa: "var(--brand-amber)",
};
const ORIGEN_LABEL = {
  pedidosya: "PedidosYa",
  rappi: "Rappi",
  mp: "MP Envíos",
  propio: "Delivery propio",
  mesa: "Salón",
};

Object.assign(window, { Icon, ICONS, BarLogo, fmtAR, tiempoDesde, ORIGEN_COLOR, ORIGEN_LABEL });
