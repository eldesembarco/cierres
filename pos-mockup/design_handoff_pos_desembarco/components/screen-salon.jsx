// Vista salón — mapa de mesas (mesas grandes, sin sillas)
function ScreenSalon({ estadoMesa = "ocupada" }) {
  const { mesas } = window.POS_DATA;
  const [sel, setSel] = React.useState(5);

  // Aplicar override de estado simulado a mesa 5 según tweak
  const mesasView = mesas.map((m) =>
    m.id === 5 ? {
      ...m,
      estado: estadoMesa,
      ...(estadoMesa === "libre" ? { mozo: undefined, desde: undefined, total: 0, items: 0 } : {}),
      ...(estadoMesa === "esperando" ? { mozo: "M. Cruz", desde: "21:18", total: 0, items: 0 } : {}),
    } : m
  );

  const stats = {
    libres: mesasView.filter((m) => m.estado === "libre").length,
    ocupadas: mesasView.filter((m) => m.estado === "ocupada" || m.estado === "esperando" || m.estado === "porPagar").length,
    total: mesasView.length,
  };

  const mSel = mesasView.find((m) => m.id === sel);

  return (
    <div className="screen">
      <Topbar current="salon" />
      <div className="salon-body">
        <div className="salon-side">
          <div className="salon-stats">
            <div className="stat-card">
              <div className="stat-num tabular">{stats.ocupadas}<span style={{ color: "var(--text-3)", fontSize: 18 }}>/{stats.total}</span></div>
              <div className="stat-lbl">Mesas activas</div>
            </div>
            <div className="stat-card">
              <div className="stat-num tabular" style={{ color: "var(--brand-bottle)" }}>{stats.libres}</div>
              <div className="stat-lbl">Libres</div>
            </div>
          </div>

          <div className="salon-legend">
            <div className="legend-row"><span className="legend-sw legend-libre" /> Libre</div>
            <div className="legend-row"><span className="legend-sw legend-ocupada" /> Ocupada</div>
            <div className="legend-row"><span className="legend-sw legend-esperando" /> Esperando pedido</div>
            <div className="legend-row"><span className="legend-sw legend-porPagar" /> Por cobrar</div>
            <div className="legend-row"><span className="legend-sw legend-reservada" /> Reservada</div>
          </div>

          <div className="salon-filters">
            <div className="pill is-on">Salón principal</div>
            <div className="pill">Barra</div>
            <div className="pill">Vereda</div>
          </div>
        </div>

        <div className="salon-map">
          <div className="salon-map-head">
            <h2>Salón principal</h2>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-sm"><Icon name="users" size={14} /> Asignar mozo</button>
              <button className="btn btn-sm"><Icon name="edit" size={14} /> Editar disposición</button>
            </div>
          </div>

          <div className="salon-canvas">
            <SalonCanvasFit>
              {/* Decorations: ventana, barra, baño, cocina */}
              <div className="salon-deco salon-ventana">VENTANA · CALLE</div>
              <div className="salon-deco salon-barra">BARRA</div>
              <div className="salon-deco salon-bano">BAÑOS</div>
              <div className="salon-deco salon-cocina">COCINA</div>

              {/* Paredes / divisiones */}
              <div className="wall wall-v1" />
              <div className="wall wall-v2" />

              {mesasView.map((m) => (
                <MesaTile key={m.id} m={m} selected={m.id === sel} onClick={() => setSel(m.id)} />
              ))}
            </SalonCanvasFit>
          </div>
        </div>

        <div className="salon-detail">
          {mSel && <MesaDetail m={mSel} />}
        </div>
      </div>
    </div>
  );
}

function MesaTile({ m, selected, onClick }) {
  const ago = m.desde ? tiempoDesde(m.desde) : 0;
  const isLong = ago > 90;
  // Pill superior (info principal)
  let pill = null;
  if (m.estado === "ocupada") {
    pill = <div className={"mesa-pill" + (isLong ? " is-long" : "")}>
      <span className="tabular">{ago}'</span>
      <span className="dot" />
      <span className="tabular">{fmtAR(m.total)}</span>
    </div>;
  } else if (m.estado === "porPagar") {
    pill = <div className="mesa-pill is-pay">
      <Icon name="card" size={12} />
      <span className="tabular">{fmtAR(m.total)}</span>
    </div>;
  } else if (m.estado === "esperando") {
    pill = <div className="mesa-pill is-wait">esperando</div>;
  } else if (m.estado === "reservada") {
    pill = <div className="mesa-pill is-reserva">{m.reserva ? m.reserva.split(" — ")[0] : "reserva"}</div>;
  }

  // Footer info abajo de cada mesa
  let footer = null;
  if (m.estado === "ocupada" || m.estado === "porPagar") {
    footer = (
      <div className="mesa-footer">
        <span className="mesa-footer-mozo">{m.mozo}</span>
        <span className="mesa-footer-items tabular">{m.items} ítems</span>
      </div>
    );
  } else if (m.estado === "esperando") {
    footer = (
      <div className="mesa-footer">
        <span className="mesa-footer-mozo">{m.mozo}</span>
        <span className="mesa-footer-items">tomando pedido</span>
      </div>
    );
  } else if (m.estado === "libre") {
    footer = (
      <div className="mesa-footer">
        <span className="mesa-footer-cap">{m.sillas} pax</span>
      </div>
    );
  } else if (m.estado === "reservada") {
    footer = (
      <div className="mesa-footer">
        <span className="mesa-footer-cap">{m.sillas} pax</span>
        <span className="mesa-footer-items">{m.reserva ? m.reserva.split(" — ")[1] : ""}</span>
      </div>
    );
  }

  const bodyClass = "mesa-body mesa-body-" + m.estado + (m.tipo === "alta" ? " mesa-body-alta" : "") + (selected ? " is-sel" : "");

  return (
    <button className={bodyClass} onClick={onClick} style={{
      left: m.x, top: m.y, width: m.w, height: m.h,
    }}>
      {pill}
      <div className="mesa-num">{m.id}</div>
      {m.tipo === "alta" && <div className="mesa-tag">BARRA ALTA</div>}
      {footer}
    </button>
  );
}

function MesaDetail({ m }) {
  if (m.estado === "libre") {
    return (
      <div className="detail-empty">
        <div className="detail-empty-num">{m.id}</div>
        <div className="detail-empty-lbl">Mesa libre · {m.sillas} sillas</div>
        <button className="btn btn-amber btn-lg" style={{ marginTop: 16, width: "100%" }}>
          <Icon name="plus" /> Abrir mesa
        </button>
        <button className="btn btn-lg" style={{ marginTop: 8, width: "100%" }}>
          <Icon name="clock" /> Reservar
        </button>
      </div>
    );
  }
  if (m.estado === "reservada") {
    return (
      <div className="detail-empty">
        <div className="detail-empty-num">{m.id}</div>
        <div className="detail-empty-lbl">Reservada</div>
        <div style={{ marginTop: 8, fontSize: 14, color: "var(--text-2)" }}>{m.reserva}</div>
        <button className="btn btn-amber btn-lg" style={{ marginTop: 16, width: "100%" }}>
          Sentar reserva
        </button>
      </div>
    );
  }
  return (
    <div className="detail-active">
      <div className="detail-head">
        <div>
          <div className="detail-num">Mesa {m.id}</div>
          <div className="detail-sub">{m.sillas} sillas · {m.mozo} · abierta {m.desde}</div>
        </div>
        {m.estado === "porPagar" && <span className="pill pill-danger"><span className="pill-dot" /> Por cobrar</span>}
        {m.estado === "esperando" && <span className="pill pill-warning"><span className="pill-dot" /> Esperando</span>}
        {m.estado === "ocupada" && <span className="pill pill-info"><span className="pill-dot" /> Ocupada</span>}
      </div>

      {m.estado !== "esperando" ? (
        <>
          <div className="detail-mini-items">
            <div className="mini-item"><span>2× Desembarco</span><span className="tabular">{fmtAR(43600)}</span></div>
            <div className="mini-item"><span>1× Bajoncito</span><span className="tabular">{fmtAR(14000)}</span></div>
            <div className="mini-item"><span>2× 1/2 Pinta Premium</span><span className="tabular">{fmtAR(8400)}</span></div>
            {m.items > 3 && <div className="mini-item more">+ {m.items - 3} ítems más</div>}
          </div>
          <div className="detail-totals">
            <div className="dt-row"><span>Items</span><span className="tabular">{m.items}</span></div>
            <div className="dt-row total"><span>Total</span><span className="tabular">{fmtAR(m.total)}</span></div>
          </div>
        </>
      ) : (
        <div style={{ padding: 24, textAlign: "center", color: "var(--text-3)" }}>
          Mesa abierta · sin pedidos cargados
        </div>
      )}

      <div className="detail-actions">
        <button className="btn btn-lg"><Icon name="plus" /> Agregar</button>
        <button className="btn btn-lg"><Icon name="receipt" /> Ver cuenta</button>
        {m.estado === "porPagar"
          ? <button className="btn btn-amber btn-lg" style={{ gridColumn: "1 / -1" }}><Icon name="card" /> Cobrar {fmtAR(m.total)}</button>
          : <button className="btn btn-primary btn-lg" style={{ gridColumn: "1 / -1" }}><Icon name="receipt" /> Pedir cuenta</button>
        }
      </div>
    </div>
  );
}

window.ScreenSalon = ScreenSalon;

// Auto-scale wrapper: contiene un canvas de 1220×880 y lo escala uniformemente
// para que entre en su contenedor padre (manteniendo el aspect ratio).
function SalonCanvasFit({ children }) {
  const wrapRef = React.useRef(null);
  const [scale, setScale] = React.useState(1);

  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;

    const compute = () => {
      const rect = parent.getBoundingClientRect();
      const padding = 24;
      const sx = (rect.width  - padding) / 1380;
      const sy = (rect.height - padding) /  940;
      setScale(Math.max(0.2, Math.min(sx, sy)));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      className="salon-canvas-fit"
      style={{ transform: `scale(${scale})` }}
    >
      {children}
    </div>
  );
}

