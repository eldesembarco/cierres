// KDS — Kitchen Display System
// Kanban: Nuevo → En preparación → Listo
// Cronómetros grandes, color por origen, modo oscuro por defecto

const KDS_FLOW = { nuevo: "preparacion", preparacion: "listo", listo: "entregado" };

function ScreenKDS({ simIncoming }) {
  const { pedidos } = window.POS_DATA;
  const cols = [
    { key: "nuevo",       label: "Nuevos",         color: "var(--brand-rojo)" },
    { key: "preparacion", label: "En preparación", color: "var(--brand-amarillo)" },
    { key: "listo",       label: "Listos",         color: "var(--brand-bottle)" },
  ];

  const base = simIncoming
    ? [{
        id: "PY-8822", origen: "pedidosya", cliente: "Lucía F.", desde: "21:23", estado: "nuevo",
        items: [
          { nombre: "Cheeseburger", qty: 1, mods: ["Sin cebolla"] },
          { nombre: "Papas con cheddar", qty: 1 },
        ],
      }, ...pedidos]
    : pedidos;

  const [overrides, setOverrides] = React.useState({});
  const [leaving, setLeaving] = React.useState(null);

  const pedidosView = base
    .map((p) => overrides[p.id] ? { ...p, estado: overrides[p.id] } : p)
    .filter((p) => p.estado !== "entregado");

  const bump = (p) => {
    const next = KDS_FLOW[p.estado];
    if (!next) return;
    if (next === "entregado") {
      setLeaving(p.id);
      setTimeout(() => {
        setOverrides((o) => ({ ...o, [p.id]: "entregado" }));
        setLeaving(null);
      }, 220);
      return;
    }
    setOverrides((o) => ({ ...o, [p.id]: next }));
  };

  return (
    <div className="screen kds-screen">
      <div className="kds-top">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <BarLogo size={32} invert={false} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Cocina · El Desembarco</div>
            <div style={{ fontSize: 12, color: "var(--text-3)" }}>Estación principal · Turno noche</div>
          </div>
        </div>
        <div className="kds-stats">
          <div className="kds-stat"><span className="dot" style={{ background: "var(--brand-rojo)" }} /> {pedidosView.filter((p) => p.estado === "nuevo").length} nuevos</div>
          <div className="kds-stat"><span className="dot" style={{ background: "var(--brand-amarillo)" }} /> {pedidosView.filter((p) => p.estado === "preparacion").length} en prep</div>
          <div className="kds-stat"><span className="dot" style={{ background: "var(--brand-bottle)" }} /> {pedidosView.filter((p) => p.estado === "listo").length} listos</div>
          <div className="kds-stat tabular">21:24</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost btn-icon" aria-label="Filtrar"><Icon name="filter" /></button>
          <button className="btn btn-ghost btn-icon" aria-label="Configurar"><Icon name="gear" /></button>
        </div>
      </div>

      <div className="kds-board">
        {cols.map((col) => (
          <div key={col.key} className="kds-col">
            <div className="kds-col-head" style={{ borderTopColor: col.color }}>
              <span className="dot" style={{ background: col.color }} />
              <span style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 12 }}>{col.label}</span>
              <span className="tabular" style={{ marginLeft: "auto", color: "var(--text-3)" }}>
                {pedidosView.filter((p) => p.estado === col.key).length}
              </span>
            </div>
            <div className="kds-col-body scroll-y">
              {pedidosView.filter((p) => p.estado === col.key).map((p) => (
                <KDSCard key={p.id} pedido={p} onBump={() => bump(p)} leaving={leaving === p.id} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KDSCard({ pedido, onBump, leaving }) {
  const mins = tiempoDesde(pedido.desde);
  const isUrgent = mins >= 15;
  const isWarn = mins >= 8 && mins < 15;
  const timerCls = "kds-timer tabular" + (isUrgent ? " urgent" : isWarn ? " warn" : "");

  return (
    <div className={"kds-card kds-card-" + pedido.origen + (leaving ? " kds-card-leaving" : "")}>
      <div className="kds-card-head">
        <span className={`app-tag ${pedido.origen}`}>
          {pedido.origen === "mesa" ? `MESA ${pedido.mesa}` : ORIGEN_LABEL[pedido.origen]}
        </span>
        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-2)" }}>{pedido.id}</span>
        <div className={timerCls}>{mins}'</div>
      </div>
      <div className="kds-card-meta">
        {pedido.origen === "mesa" ? `Mozo: ${pedido.mozo}` : `Cliente: ${pedido.cliente}`}
        <span style={{ marginLeft: "auto" }}>{pedido.desde}</span>
      </div>
      <div className="kds-items">
        {pedido.items.map((it, i) => (
          <div key={i} className="kds-item">
            <div className="kds-item-qty tabular">{it.qty}×</div>
            <div className="kds-item-body">
              <div className="kds-item-name">{it.nombre}</div>
              {it.mods && it.mods.length > 0 && (
                <div className="kds-item-mods">
                  {it.mods.map((m, k) => (
                    <span key={k} className="mod-chip">{m}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="kds-card-foot">
        {pedido.estado === "nuevo" && (
          <button className="btn btn-amber btn-lg" style={{ width: "100%" }} onClick={onBump}>
            <Icon name="fire" size={18} /> Empezar a preparar
          </button>
        )}
        {pedido.estado === "preparacion" && (
          <button className="btn btn-primary btn-lg" style={{ width: "100%" }} onClick={onBump}>
            <Icon name="check" size={18} /> Marcar listo
          </button>
        )}
        {pedido.estado === "listo" && (
          <button className="btn btn-lg" style={{ width: "100%", background: "var(--brand-bottle)", color: "#fff", borderColor: "var(--brand-bottle)" }} onClick={onBump}>
            <Icon name="check" size={18} /> Entregado
          </button>
        )}
      </div>
    </div>
  );
}

window.ScreenKDS = ScreenKDS;
