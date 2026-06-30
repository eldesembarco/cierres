// Topbar compartida — header común a todas las pantallas
function Topbar({ current, dense }) {
  const tabs = [
    ["pos", "POS"],
    ["salon", "Salón"],
    ["mozo", "Mozo"],
    ["kds", "Cocina"],
    ["apps", "Pedidos apps"],
    ["reportes", "Reportes"],
  ];
  return (
    <div className="topbar">
      <div className="brand">
        <BarLogo size={48} />
      </div>
      <div className="nav">
        {tabs.map(([k, l]) => (
          <button key={k} aria-current={k === current ? "page" : null}>{l}</button>
        ))}
      </div>
      <div className="spacer" />
      <button className="btn btn-ghost btn-icon" aria-label="Notificaciones">
        <Icon name="bell" size={18} />
      </button>
      <div className="user">
        <div className="avatar">MC</div>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>M. Cruz</span>
          <span style={{ fontSize: 10, color: "var(--text-3)" }}>Cajero · Turno noche</span>
        </div>
      </div>
    </div>
  );
}

window.Topbar = Topbar;
