// Reportes fin de turno

function ScreenReportes() {
  const ventasHora = [22, 38, 64, 92, 124, 156, 178, 168, 142, 98];
  const horas = ["18", "19", "20", "21", "22", "23", "00", "01", "02", "03"];
  const max = Math.max(...ventasHora);

  return (
    <div className="screen">
      <Topbar current="reportes" />
      <div className="rep-body scroll-y">
        <div className="rep-head">
          <div>
            <div style={{ fontSize: 13, color: "var(--text-3)" }}>Turno noche · 4 mayo 2026</div>
            <h1 style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 700 }}>Cierre del turno</h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn"><Icon name="printer" size={16} /> Imprimir Z</button>
            <button className="btn btn-amber btn-lg"><Icon name="power" size={16} /> Cerrar caja</button>
          </div>
        </div>

        <div className="rep-kpis">
          <KPI label="Facturado" value={fmtAR(847200)} delta="+12% vs ayer" up />
          <KPI label="Ventas" value="66" delta="56 mesa · 10 apps" />
          <KPI label="Ticket promedio" value={fmtAR(12450)} delta="+4%" up />
          <KPI label="Tiempo prep promedio" value="14 min" delta="-2 min" up />
        </div>

        <div className="rep-grid">
          <div className="card rep-card">
            <div className="rep-card-head">Ventas por hora</div>
            <div className="rep-chart">
              {ventasHora.map((v, i) => (
                <div key={i} className="rep-bar-col">
                  <div className="rep-bar" style={{ height: `${(v / max) * 100}%`, background: i === 6 ? "var(--brand-amber)" : "var(--brand-amber-soft)" }}>
                    <span className="rep-bar-val tabular">{v}</span>
                  </div>
                  <div className="rep-bar-lbl">{horas[i]}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card rep-card">
            <div className="rep-card-head">Por canal</div>
            <div className="rep-channels">
              <Channel app="mesa" label="Salón" pct={72} amt={610000} count={56} />
              <Channel app="pedidosya" label="PedidosYa" pct={14} amt={118600} count={5} />
              <Channel app="rappi" label="Rappi" pct={9} amt={76200} count={3} />
              <Channel app="mp" label="MP Envíos" pct={5} amt={42400} count={2} />
            </div>
          </div>

          <div className="card rep-card">
            <div className="rep-card-head">Top productos</div>
            <div className="rep-top">
              {[
                ["Honey IPA Pinta", 84, 319200],
                ["El Desembarco", 42, 537600],
                ["Capitán", 38, 437000],
                ["Papas Desembarco", 32, 236800],
                ["Smash Doble", 26, 280800],
                ["Provoleta", 22, 118800],
              ].map(([n, q, t]) => (
                <div key={n} className="top-row">
                  <span className="top-name">{n}</span>
                  <span className="tabular top-qty">{q}u</span>
                  <span className="tabular top-amt">{fmtAR(t)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card rep-card">
            <div className="rep-card-head">Métodos de pago</div>
            <div className="rep-pays">
              <PayRow icon="card" label="Débito"        amt={324800} pct={38} />
              <PayRow icon="card" label="Crédito"       amt={228700} pct={27} />
              <PayRow icon="cash" label="Efectivo"      amt={186400} pct={22} />
              <PayRow icon="card" label="Mercado Pago"  amt={84720}  pct={10} />
              <PayRow icon="card" label="Modo / transf" amt={22580}  pct={3} />
            </div>
          </div>

          <div className="card rep-card">
            <div className="rep-card-head">Por mozo</div>
            <div className="rep-mozos">
              <MozoRow nombre="M. Cruz"  mesas={18} ventas={326800} />
              <MozoRow nombre="L. Sosa"  mesas={14} ventas={241500} />
              <MozoRow nombre="F. Diaz"  mesas={12} ventas={198400} />
              <MozoRow nombre="A. López" mesas={6}  ventas={80500} />
            </div>
          </div>

          <div className="card rep-card">
            <div className="rep-card-head">Movimientos de caja</div>
            <div className="rep-caja">
              <div className="caja-row"><span>Apertura</span><span className="tabular">{fmtAR(15000)}</span></div>
              <div className="caja-row"><span>+ Ventas en efectivo</span><span className="tabular">{fmtAR(186400)}</span></div>
              <div className="caja-row"><span>– Retiros</span><span className="tabular">{fmtAR(-50000)}</span></div>
              <div className="caja-row"><span>– Pagos a proveedor</span><span className="tabular">{fmtAR(-28400)}</span></div>
              <div className="caja-row total"><span>Saldo esperado</span><span className="tabular">{fmtAR(123000)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, delta, up }) {
  return (
    <div className="card kpi">
      <div className="kpi-lbl">{label}</div>
      <div className="kpi-val tabular">{value}</div>
      <div className={"kpi-delta" + (up ? " up" : "")}>{delta}</div>
    </div>
  );
}

function Channel({ app, label, pct, amt, count }) {
  return (
    <div className="ch-row">
      <span className={`app-tag ${app}`} style={{ minWidth: 92, justifyContent: "center" }}>{label}</span>
      <div className="ch-bar"><div style={{ width: pct + "%", background: `var(--app-${app === "mesa" ? "propio" : app})` }} /></div>
      <span className="tabular ch-pct">{pct}%</span>
      <span className="tabular ch-amt">{fmtAR(amt)}</span>
      <span className="tabular ch-count">{count}</span>
    </div>
  );
}

function PayRow({ icon, label, amt, pct }) {
  return (
    <div className="pay-row">
      <Icon name={icon} size={16} />
      <span style={{ flex: 1 }}>{label}</span>
      <div className="ch-bar" style={{ width: 80 }}><div style={{ width: pct + "%", background: "var(--brand-amber)" }} /></div>
      <span className="tabular ch-pct">{pct}%</span>
      <span className="tabular" style={{ minWidth: 84, textAlign: "right" }}>{fmtAR(amt)}</span>
    </div>
  );
}

function MozoRow({ nombre, mesas, ventas }) {
  return (
    <div className="mozo-row">
      <div className="mozo-row-avatar">{nombre.split(" ").map((s) => s[0]).join("")}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600 }}>{nombre}</div>
        <div style={{ fontSize: 12, color: "var(--text-3)" }}>{mesas} mesas atendidas</div>
      </div>
      <span className="tabular" style={{ fontWeight: 700 }}>{fmtAR(ventas)}</span>
    </div>
  );
}

window.ScreenReportes = ScreenReportes;
