/* ============ Iconos (stroke lucide-style) ============ */
const Icon = ({ name, size = 16, stroke = 1.7, ...rest }) => {
  const s = { width: size, height: size, stroke: "currentColor", fill: "none", strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    home:      <><path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></>,
    grid:      <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    branch:    <><path d="M6 3v18"/><path d="M18 3v6a4 4 0 01-4 4H6"/><circle cx="6" cy="3" r="1.5"/><circle cx="18" cy="3" r="1.5"/><circle cx="6" cy="21" r="1.5"/></>,
    calendar:  <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></>,
    bell:      <><path d="M6 8a6 6 0 0112 0c0 7 3 7 3 9H3c0-2 3-2 3-9z"/><path d="M10 21a2 2 0 004 0"/></>,
    chart:     <><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></>,
    settings:  <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3h0a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5h0a1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8v0a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></>,
    upload:    <><path d="M12 17V3"/><path d="M6 9l6-6 6 6"/><path d="M3 21h18"/></>,
    plus:      <><path d="M12 5v14M5 12h14"/></>,
    check:     <><path d="M5 12l5 5L20 7"/></>,
    clock:     <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    alert:     <><path d="M12 9v4"/><circle cx="12" cy="17" r=".5" fill="currentColor" stroke="none"/><path d="M10.3 3.5L2.5 17a2 2 0 001.7 3h15.6a2 2 0 001.7-3L13.7 3.5a2 2 0 00-3.4 0z"/></>,
    search:    <><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></>,
    filter:    <><path d="M3 5h18l-7 9v5l-4 2v-7L3 5z"/></>,
    download:  <><path d="M12 3v14"/><path d="M6 11l6 6 6-6"/><path d="M3 21h18"/></>,
    sparkles:  <><path d="M12 3l1.8 4.5L18 9l-4.2 1.5L12 15l-1.8-4.5L6 9l4.2-1.5L12 3z"/><path d="M19 15l.8 2 2 .7-2 .8L19 21l-.8-2.5-2-.8 2-.7.8-2z"/></>,
    chevron:   <><path d="M9 6l6 6-6 6"/></>,
    chevdown:  <><path d="M6 9l6 6 6-6"/></>,
    file:      <><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z"/><path d="M14 3v5h5"/></>,
    dot:       <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>,
    x:         <><path d="M6 6l12 12M18 6L6 18"/></>,
    eye:       <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
    refresh:   <><path d="M3 12a9 9 0 0115-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 01-15 6.7L3 16"/><path d="M3 21v-5h5"/></>,
    sun:       <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    moon:      <><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></>,
    arrowL:    <><path d="M19 12H5M12 19l-7-7 7-7"/></>,
    arrowR:    <><path d="M5 12h14M12 5l7 7-7 7"/></>,
    copy:      <><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></>,
    key:       <><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M18 5l3 3"/></>,
    external:  <><path d="M14 3h7v7"/><path d="M21 3l-9 9"/><path d="M20 14v5a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2h5"/></>,
    phone:     <><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012 4.2 2 2 0 014 2h3a2 2 0 012 1.7c.1.9.3 1.8.6 2.7a2 2 0 01-.5 2.1L8 9.6a16 16 0 006 6l1.1-1.1a2 2 0 012.1-.5c.9.3 1.8.5 2.7.6A2 2 0 0122 16.9z"/></>,
    user:      <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    panelLeft: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></>,
  };
  return (
    <svg viewBox="0 0 24 24" {...s} {...rest}>
      {paths[name] || paths.dot}
    </svg>
  );
};

/* ============ Sidebar ============ */
const Sidebar = ({ page, setPage, counts = {}, collapsed = false, onToggle, user, onSignOut }) => {
  const item = (id, icon, label, extra) => (
    <button
      className={"nav-item " + (page === id ? "active" : "")}
      onClick={() => setPage(id)}
      title={collapsed ? label : undefined}
    >
      <Icon name={icon} size={15} />
      {!collapsed && <span>{label}</span>}
      {!collapsed && extra}
    </button>
  );
  return (
    <aside className={"sidebar" + (collapsed ? " collapsed" : "")}>
      <div className="brand">
        <div className="brand-mark">D</div>
        {!collapsed && (
          <div style={{flex: 1, minWidth: 0}}>
            <div className="brand-name">Desembarco</div>
            <div className="brand-sub">Servicios · IA</div>
          </div>
        )}
        {onToggle && (
          <button
            className="sidebar-toggle"
            onClick={onToggle}
            title={collapsed ? "Expandir menú" : "Colapsar menú"}>
            <Icon name={collapsed ? "arrowR" : "arrowL"} size={12}/>
          </button>
        )}
      </div>

      {!collapsed && <div className="nav-group-title">Control</div>}
      {item("panel",     "grid",   "Panel de servicios")}
      {item("planilla",  "file",   "Planilla")}
      {item("nuevas",    "clock",  "Nuevas facturas", counts.nuevas ? <span className="count accent-count" key={counts.nuevas}>{counts.nuevas}</span> : null)}
      {item("locales",   "branch", "Locales", <span className="count">{LOCALES.length}</span>)}
      {item("vencidos",  "alert",  "Vencidos", counts.vencidos ? <span className="count danger">{counts.vencidos}</span> : null)}
      {item("calendario","calendar","Calendario")}

      {!collapsed && <div className="nav-group-title">Ingesta</div>}
      {item("ingesta",   "upload", "Ingesta IA", !collapsed && <span className="pill accent sm" style={{fontSize:9, padding:"0 6px", marginLeft:"auto"}}>NUEVO</span>)}
      {item("revision",  "sparkles","Revisión")}

      {!collapsed && <div className="nav-group-title">Análisis</div>}
      {item("reportes",  "chart",  "Reportes")}
      {item("alertas",   "bell",   "Alertas email")}

      <div className="sidebar-footer" title={user ? user.email : ""}>
        {user && user.picture ? (
          <img className="avatar avatar-img" src={user.picture} alt="" referrerPolicy="no-referrer"/>
        ) : (
          <div className="avatar">{user ? (user.name || user.email || "?")[0].toUpperCase() : "?"}</div>
        )}
        {!collapsed && (
          <>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:12.5, fontWeight:500, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>
                {user ? (user.name || user.email.split('@')[0]) : "—"}
              </div>
              <div style={{fontSize:11, color:"var(--ink-3)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>
                {user ? user.email : ""}
              </div>
            </div>
            {onSignOut && (
              <button className="icon-btn" onClick={onSignOut} title="Cerrar sesión">
                <Icon name="x" size={13} style={{color:"var(--ink-3)"}}/>
              </button>
            )}
          </>
        )}
      </div>
    </aside>
  );
};

Object.assign(window, { Icon, Sidebar });
