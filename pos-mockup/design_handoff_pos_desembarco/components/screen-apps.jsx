// Bandeja de pedidos de apps externas — vista lista/tabla
// Tabs principales: Activos / Historial
// Filtros por app: PedidosYa / Rappi / MP

const APP_LABEL_LONG = {
  pedidosya: "PedidosYa",
  rappi: "Rappi",
  mp: "MP Envíos",
};

const APPS_FLOW = { nuevo: "preparacion", preparacion: "listo", listo: "entregado" };
const ACTIVOS = ["nuevo", "preparacion", "listo"];

function ScreenApps() {
  const { inbox } = window.POS_DATA;

  const [vista, setVista] = React.useState("activos"); // activos | historial
  const [filtro, setFiltro] = React.useState("all");
  const [sel, setSel] = React.useState("PY-8821");
  const [comanda, setComanda] = React.useState(null);
  const [overrides, setOverrides] = React.useState({});
  const [toast, setToast] = React.useState(null);

  const inboxView = inbox.map((p) => overrides[p.id] ? { ...p, estado: overrides[p.id] } : p);
  const activos   = inboxView.filter((p) => ACTIVOS.includes(p.estado));
  const historial = inboxView.filter((p) => !ACTIVOS.includes(p.estado));

  const fuente = vista === "activos" ? activos : historial;
  const list = filtro === "all" ? fuente : fuente.filter((p) => p.app === filtro);
  const selDetail = inboxView.find((p) => p.id === sel) || list[0];

  const setEstado = (id, next, label) => {
    setOverrides((o) => ({ ...o, [id]: next }));
    setToast({ id: Date.now(), text: label });
    setTimeout(() => setToast(null), 2200);
  };
  const aceptar      = (p) => { setEstado(p.id, "preparacion", `Aceptado · ${p.id}`); setComanda(p); };
  const marcarListo  = (p) => setEstado(p.id, "listo",       `Listo para retirar · ${p.id}`);
  const entregar     = (p) => setEstado(p.id, "entregado",   `Entregado · ${p.id}`);
  const rechazar     = (p) => setEstado(p.id, "cancelado",   `Pedido rechazado · ${p.id}`);

  const apps = [
    { key: "all",       label: "Todas",     count: fuente.length, color: "var(--text)" },
    { key: "pedidosya", label: "PedidosYa", count: fuente.filter((i) => i.app === "pedidosya").length, color: "var(--app-pedidosya)" },
    { key: "rappi",     label: "Rappi",     count: fuente.filter((i) => i.app === "rappi").length,     color: "var(--app-rappi)" },
    { key: "mp",        label: "MP Envíos", count: fuente.filter((i) => i.app === "mp").length,        color: "var(--app-mp)" },
  ];

  // KPIs simples arriba
  const kpis = {
    total:    fuente.length,
    nuevos:   fuente.filter((p) => p.estado === "nuevo").length,
    preparando: fuente.filter((p) => p.estado === "preparacion").length,
    listos:   fuente.filter((p) => p.estado === "listo").length,
    facturado: fuente.reduce((s, p) => s + p.total, 0),
  };

  return (
    <div className="screen">
      <Topbar current="apps" />
      <div className="apps-body apps-body-list">
        {/* Header con tabs Activos/Historial + filtros app + KPIs */}
        <div className="apps-toolbar">
          <div className="apps-toolbar-tabs">
            <button
              className={"apps-tab-main" + (vista === "activos" ? " is-on" : "")}
              onClick={() => setVista("activos")}>
              Activos
              <span className="apps-tab-badge">{activos.length}</span>
            </button>
            <button
              className={"apps-tab-main" + (vista === "historial" ? " is-on" : "")}
              onClick={() => setVista("historial")}>
              Historial
              <span className="apps-tab-badge muted">{historial.length}</span>
            </button>
          </div>

          <div className="apps-toolbar-filters">
            {apps.map((a) => (
              <button
                key={a.key}
                className={"apps-filter-chip" + (a.key === filtro ? " is-on" : "")}
                style={{ "--accent": a.color }}
                onClick={() => setFiltro(a.key)}>
                <span>{a.label}</span>
                <span className="apps-filter-count tabular">{a.count}</span>
              </button>
            ))}
          </div>

          <div className="apps-toolbar-search">
            <Icon name="search" size={16} />
            <input placeholder="Buscar por ID, cliente o producto…" />
          </div>
        </div>

        {/* KPIs */}
        {vista === "activos" && (
          <div className="apps-kpis">
            <div className="kpi-mini"><span className="kpi-mini-num tabular">{kpis.nuevos}</span><span className="kpi-mini-lbl">Nuevos</span></div>
            <div className="kpi-mini"><span className="kpi-mini-num tabular" style={{ color: "var(--brand-amber)" }}>{kpis.preparando}</span><span className="kpi-mini-lbl">Preparando</span></div>
            <div className="kpi-mini"><span className="kpi-mini-num tabular" style={{ color: "var(--brand-bottle)" }}>{kpis.listos}</span><span className="kpi-mini-lbl">Listos</span></div>
          </div>
        )}

        {/* Lista tipo tabla + panel detalle */}
        <div className="apps-content">
          <div className="apps-table-wrap">
            <div className="apps-table">
              <div className="apps-table-head">
                <div className="ath-app">App</div>
                <div className="ath-id">ID · Hora</div>
                <div className="ath-cliente">Cliente</div>
                <div className="ath-items">Detalle</div>
                <div className="ath-estado">Estado</div>
              </div>
              <div className="apps-table-body scroll-y">
                {list.length === 0 && (
                  <div className="apps-table-empty">
                    {vista === "historial" ? "Aún no hay pedidos cerrados." : "No hay pedidos activos."}
                  </div>
                )}
                {list.map((p) => (
                  <PedidoRow key={p.id} p={p} selected={p.id === sel} onClick={() => setSel(p.id)} />
                ))}
              </div>
            </div>
          </div>

          <div className="apps-detail-pane">
            {selDetail && <PedidoAppDetail
              p={selDetail}
              onComanda={() => setComanda(selDetail)}
              onAceptar={aceptar}
              onMarcarListo={marcarListo}
              onEntregar={entregar}
              onRechazar={rechazar}
            />}
          </div>
        </div>
      </div>
      {comanda && <ComandaModal p={comanda} onClose={() => setComanda(null)} />}
      {toast && (
        <div key={toast.id} className="apps-toast">
          <Icon name="check" size={16} /> {toast.text}
        </div>
      )}
    </div>
  );
}

function PedidoRow({ p, selected, onClick }) {
  const detalle = p.items.map((i) => `${i.qty}× ${i.nombre}`).join(" · ");
  return (
    <button className={"apps-table-row" + (selected ? " is-sel" : "")} onClick={onClick}>
      <div className="atr-app">
        <span className={`src-stripe src-${p.app}`} />
        <span className={`app-tag ${p.app}`}>{APP_LABEL_LONG[p.app]}</span>
      </div>
      <div className="atr-id">
        <span className="atr-id-num">{p.id}</span>
        <span className="atr-id-hora tabular">{p.hora}</span>
      </div>
      <div className="atr-cliente" title={p.cliente}>{p.cliente}</div>
      <div className="atr-items" title={detalle}>{detalle}</div>
      <div className="atr-estado">{estadoPill(p.estado)}</div>
    </button>
  );
}

function estadoPill(estado) {
  const map = {
    nuevo:       ["pill-danger",  "Nuevo"],
    preparacion: ["pill-warning", "Preparando"],
    listo:       ["pill-success", "Listo"],
    entregado:   ["",             "Entregado"],
    cancelado:   ["pill-muted",   "Cancelado"],
  };
  const [cls, lbl] = map[estado] || ["", estado];
  return <span className={"pill " + cls}><span className="pill-dot" /> {lbl}</span>;
}

function PedidoAppDetail({ p, onComanda, onAceptar, onMarcarListo, onEntregar, onRechazar }) {
  return (
    <div className="pedido-detail">
      <div className="pd-head">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className={`app-tag ${p.app}`} style={{ height: 28, fontSize: 13 }}>{APP_LABEL_LONG[p.app]}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 22 }}>Pedido {p.id}</div>
            <div style={{ fontSize: 13, color: "var(--text-3)" }}>Recibido a las {p.hora} · hace {tiempoDesde(p.hora)} min</div>
          </div>
        </div>
        {estadoPill(p.estado)}
      </div>

      <div className="pd-grid">
        <div className="pd-card">
          <div className="pd-card-lbl">Cliente</div>
          <div className="pd-card-val">{p.cliente}</div>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>+54 9 11 5234 8821</div>
        </div>
        <div className="pd-card">
          <div className="pd-card-lbl">Pago</div>
          <div className="pd-card-val">{p.pago}</div>
          <div style={{ fontSize: 12, color: "var(--brand-bottle)", marginTop: 4 }}>✓ {fmtAR(p.total)} acreditado</div>
        </div>
      </div>

      <div className="pd-section">
        <div className="pd-section-head">Items del pedido ({p.items.reduce((s, i) => s + i.qty, 0)})</div>
        <div className="pd-items">
          {p.items.map((it, i) => (
            <div key={i} className="pd-item">
              <span className="tabular pd-qty">{it.qty}×</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{it.nombre}</div>
                {it.mods && it.mods.length > 0 && (
                  <div style={{ fontSize: 12, color: "var(--text-3)" }}>{it.mods.join(" · ")}</div>
                )}
              </div>
              <span className="tabular">{fmtAR(it.precio * it.qty)}</span>
            </div>
          ))}
        </div>
        <div className="pd-totals">
          <div className="ticket-row"><span>Subtotal</span><span className="tabular">{fmtAR(p.subtotal)}</span></div>
          {p.descVendor !== 0 && (
            <div className="ticket-row"><span>Descuento de la casa</span><span className="tabular">{fmtAR(p.descVendor)}</span></div>
          )}
          {p.descApp !== 0 && (
            <div className="ticket-row">
              <span>{p.descApp < 0 ? `Descuento ${APP_LABEL_LONG[p.app]}` : `Recargo ${APP_LABEL_LONG[p.app]}`}</span>
              <span className="tabular">{(p.descApp > 0 ? "+" : "") + fmtAR(p.descApp)}</span>
            </div>
          )}
          <div className="ticket-row total"><span>Total</span><span className="tabular">{fmtAR(p.total)}</span></div>
        </div>
      </div>

      <div className="pd-actions">
        {p.estado === "nuevo" && (
          <>
            <button className="btn btn-lg" style={{ flex: 1 }} onClick={() => onRechazar && onRechazar(p)}>Rechazar</button>
            <div className="pd-time-pick">
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>Listo en</span>
              <div className="pd-time-controls">
                <button><Icon name="minus" size={14} /></button>
                <span className="tabular">25 min</span>
                <button><Icon name="plus" size={14} /></button>
              </div>
            </div>
            <button className="btn btn-amber btn-lg" style={{ flex: 2 }} onClick={() => onAceptar && onAceptar(p)}>
              <Icon name="check" /> Aceptar e imprimir comanda
            </button>
          </>
        )}
        {p.estado === "preparacion" && (
          <>
            <button className="btn btn-lg" style={{ flex: 1 }} onClick={onComanda}><Icon name="printer" /> Ver comanda</button>
            <button className="btn btn-amber btn-lg" style={{ flex: 2 }} onClick={() => onMarcarListo && onMarcarListo(p)}>
              <Icon name="check" /> Marcar como listo
            </button>
          </>
        )}
        {p.estado === "listo" && (
          <>
            <button className="btn btn-lg" style={{ flex: 1 }} onClick={onComanda}><Icon name="printer" /> Reimprimir comanda</button>
            <button className="btn btn-amber btn-lg" style={{ flex: 2 }} onClick={() => onEntregar && onEntregar(p)}>
              <Icon name="moto" /> Entregado al cadete
            </button>
          </>
        )}
        {(p.estado === "entregado" || p.estado === "cancelado") && (
          <>
            <button className="btn btn-lg" style={{ flex: 1 }}><Icon name="receipt" /> Ver comprobante</button>
            <button className="btn btn-lg" style={{ flex: 1 }} onClick={onComanda}><Icon name="printer" /> Reimprimir comanda</button>
          </>
        )}
      </div>
    </div>
  );
}

// ============= Comanda — ticket de cocina sin precios, con barcode + QR =============
function ComandaModal({ p, onClose }) {
  return (
    <div className="comanda-overlay" onClick={onClose}>
      <div className="comanda-wrap" onClick={(e) => e.stopPropagation()}>
        <div className="comanda-toolbar">
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--text-3)" }}>
            Comanda de cocina · Vista previa
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn"><Icon name="printer" size={14} /> Imprimir</button>
            <button className="btn" onClick={onClose}>Cerrar</button>
          </div>
        </div>

        <div className="comanda-paper">
          <div className="comanda-head">
            <div className="comanda-brand">EL DESEMBARCO</div>
            <div className="comanda-sub">cervecería · cocina</div>
          </div>

          <div className="comanda-banner">
            <span className={`comanda-app ${p.app}`}>{APP_LABEL_LONG[p.app]}</span>
            <span className="comanda-banner-id">#{p.id}</span>
          </div>

          <div className="comanda-meta">
            <div><b>Fecha</b><span>04/05/2026 · {p.hora}</span></div>
            <div><b>Cliente</b><span>{p.cliente}</span></div>
            <div><b>Tipo</b><span>Delivery {APP_LABEL_LONG[p.app]}</span></div>
            <div><b>Listo en</b><span>25 min</span></div>
          </div>

          <div className="comanda-divider">— PEDIDO —</div>

          <div className="comanda-items">
            {p.items.map((it, i) => (
              <div key={i} className="comanda-item">
                <div className="comanda-item-row">
                  <span className="comanda-qty">{it.qty}</span>
                  <span className="comanda-name">{it.nombre.toUpperCase()}</span>
                </div>
                {it.mods && it.mods.length > 0 && (
                  <div className="comanda-mods">
                    {it.mods.map((m, j) => <div key={j}>· {m}</div>)}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="comanda-total-items">
            Total: {p.items.reduce((s, i) => s + i.qty, 0)} ítems
          </div>

          <div className="comanda-divider">— ENTREGA —</div>

          <div className="comanda-codes">
            <div className="comanda-barcode">
              <Barcode value={p.id} />
              <div className="comanda-barcode-num">{p.id}</div>
            </div>
            <div className="comanda-qr">
              <QrPlaceholder seed={p.id} />
              <div className="comanda-qr-lbl">Escanear al entregar</div>
            </div>
          </div>

          <div className="comanda-foot">
            *** No es comprobante fiscal ***
          </div>
        </div>
      </div>
    </div>
  );
}

// Barcode SVG — barras pseudo-aleatorias deterministas (Code 128 mock)
function Barcode({ value }) {
  // Convertir el id en un patrón estable de barras
  const seed = (value || "").split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const widths = [];
  let s = seed;
  for (let i = 0; i < 60; i++) {
    s = (s * 9301 + 49297) % 233280;
    const w = 1 + (s % 4);
    widths.push(w);
  }
  let x = 0;
  const totalW = widths.reduce((a, b) => a + b, 0);
  return (
    <svg viewBox={`0 0 ${totalW} 50`} preserveAspectRatio="none" style={{ width: "100%", height: 50 }}>
      {widths.map((w, i) => {
        const fill = i % 2 === 0 ? "#000" : "transparent";
        const r = <rect key={i} x={x} y={0} width={w} height={50} fill={fill} />;
        x += w;
        return r;
      })}
    </svg>
  );
}

// QR placeholder — grilla 21×21 pseudo-aleatoria con esquinas tipo finder pattern
function QrPlaceholder({ seed }) {
  const N = 25;
  const seedN = (seed || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  let s = seedN;
  const cells = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      // Finder patterns — esquinas
      const inFinder = (
        (x < 7 && y < 7) ||
        (x >= N - 7 && y < 7) ||
        (x < 7 && y >= N - 7)
      );
      if (inFinder) {
        const fx = x < 7 ? x : x - (N - 7);
        const fy = y < 7 ? y : y - (N - 7);
        const onEdge = fx === 0 || fx === 6 || fy === 0 || fy === 6;
        const inCenter = fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4;
        if (onEdge || inCenter) cells.push([x, y]);
        continue;
      }
      s = (s * 9301 + 49297) % 233280;
      if (s % 2 === 0) cells.push([x, y]);
    }
  }
  return (
    <svg viewBox={`0 0 ${N} ${N}`} style={{ width: "100%", height: "100%" }}>
      <rect x={0} y={0} width={N} height={N} fill="#fff" />
      {cells.map(([x, y], i) => (
        <rect key={i} x={x} y={y} width={1} height={1} fill="#000" />
      ))}
    </svg>
  );
}

window.ScreenApps = ScreenApps;
