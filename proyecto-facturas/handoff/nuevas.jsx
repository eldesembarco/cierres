/* ============ Vista "Facturas nuevas" — últimas 24h del pipeline ============ */

const hoursAgoSafe = (iso) => {
  if (!iso) return Infinity;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return Infinity;
  return (Date.now() - d.getTime()) / (1000 * 60 * 60);
};

const fmtRelative = (iso) => {
  const h = hoursAgoSafe(iso);
  if (h === Infinity) return "—";
  if (h < 0) return "futuro";
  if (h < 1/60) return "ahora";
  if (h < 1) {
    const m = Math.round(h * 60);
    return `hace ${m} min`;
  }
  if (h < 24) return `hace ${Math.round(h)} h`;
  return `hace ${Math.round(h / 24)} días`;
};

const isFreshness = (iso) => {
  // returns css class for visual freshness
  const h = hoursAgoSafe(iso);
  if (h <= 1) return "fresh-hot";   // muy reciente
  if (h <= 6) return "fresh-warm";
  return "fresh-cool";
};

const FacturasNuevas = ({ data, setSelected, refreshFacturas, loading }) => {
  const [windowHours, setWindowHours] = React.useState(24);

  const last = React.useMemo(() => {
    return (data || [])
      .filter(r => hoursAgoSafe(r.created_at) <= windowHours)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }, [data, windowHours]);

  const grouped = React.useMemo(() => {
    const buckets = { "Última hora": [], "Hoy": [], "Ayer": [], "Más viejas": [] };
    for (const r of last) {
      const h = hoursAgoSafe(r.created_at);
      if (h <= 1) buckets["Última hora"].push(r);
      else if (h <= 24) buckets["Hoy"].push(r);
      else if (h <= 48) buckets["Ayer"].push(r);
      else buckets["Más viejas"].push(r);
    }
    return buckets;
  }, [last]);

  return (
    <div className="panel-page panel-page-fluid">
      <div className="panel-hd">
        <div>
          <div className="panel-title">
            Nuevas facturas <em>/ últimas {windowHours}h</em>
          </div>
          <div className="panel-sub">
            {last.length === 0
              ? "Sin facturas nuevas — el pipeline está silencio"
              : `${last.length} factura${last.length === 1 ? '' : 's'} ingresaron en las últimas ${windowHours} horas`}
          </div>
        </div>
        <div style={{display:"flex", gap: 8, alignItems:"center"}}>
          <div className="segmented">
            <button className={windowHours === 24 ? "active" : ""} onClick={() => setWindowHours(24)}>24h</button>
            <button className={windowHours === 48 ? "active" : ""} onClick={() => setWindowHours(48)}>48h</button>
            <button className={windowHours === 168 ? "active" : ""} onClick={() => setWindowHours(168)}>7 días</button>
          </div>
          {refreshFacturas && (
            <button className="btn sm ghost" onClick={refreshFacturas} disabled={loading} title="Refrescar desde n8n">
              <Icon name="refresh" size={12}/>
              {loading ? "Cargando…" : "Refrescar"}
            </button>
          )}
        </div>
      </div>

      {last.length === 0 ? (
        <div className="empty-nuevas">
          <Icon name="clock" size={36}/>
          <div className="empty-nuevas-title">No llegaron facturas en las últimas {windowHours}h</div>
        </div>
      ) : (
        <div className="nuevas-list">
          {Object.entries(grouped).map(([label, rows]) => {
            if (rows.length === 0) return null;
            return (
              <div key={label} className="nuevas-bucket">
                <div className="nuevas-bucket-title">{label} <span className="muted">· {rows.length}</span></div>
                <div className="nuevas-grid">
                  {rows.map(r => <NuevaCard key={r.id} row={r} onClick={() => setSelected(r)}/>)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const NuevaCard = ({ row, onClick }) => {
  const cat = (typeof SERVICIO_CATEGORIA !== "undefined" ? SERVICIO_CATEGORIA[row.servicio] : null) || "Otros";
  const catColor = (typeof CATEGORIA_COLOR !== "undefined" ? CATEGORIA_COLOR[cat] : null) || "var(--ink-3)";
  const venceDays = daysUntil(row.vence);
  const fresh = isFreshness(row.created_at);
  const estadoCls = row.estado === "PAGO" ? "ok" : row.estado === "VENCIDO" ? "danger" : "warn";

  return (
    <button className={"nueva-card " + fresh} onClick={onClick}>
      <div className="nueva-card-time">
        <Icon name="clock" size={11}/>
        <span>{fmtRelative(row.created_at)}</span>
        {row.ia_revisado === false && row.ia_confianza != null && (
          <span className="nueva-card-ia">IA {Math.round(row.ia_confianza * 100)}%</span>
        )}
      </div>
      <div className="nueva-card-body">
        <div className="nueva-card-svc">
          <span className="cat-dot" style={{background: catColor}}/>
          <span className="nueva-card-servicio">{row.servicio}</span>
        </div>
        <div className="nueva-card-local">{row.local}</div>
        <div className="nueva-card-monto">{row.monto ? fmtARS(row.monto) : "—"}</div>
      </div>
      <div className="nueva-card-foot">
        <span className={"pill " + estadoCls}>
          <span className="dot"/>{row.estado}
        </span>
        {row.vence && (
          <span className="nueva-card-vence">
            Vence {fmtDate(row.vence)}
            {venceDays !== null && row.estado !== "PAGO" && (
              <span style={{marginLeft: 4, color: venceDays < 0 ? "var(--danger)" : venceDays <= 3 ? "var(--warn)" : "var(--ink-3)"}}>
                · {venceDays < 0 ? `${Math.abs(venceDays)}d vencida` : venceDays === 0 ? "hoy" : `+${venceDays}d`}
              </span>
            )}
          </span>
        )}
      </div>
    </button>
  );
};

Object.assign(window, { FacturasNuevas, NuevaCard, hoursAgoSafe, fmtRelative });
