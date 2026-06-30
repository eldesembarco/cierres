// Pantalla cierre de mesa / impresión de ticket
// Modal/sheet sobre el salón con preview del ticket

const TICKET_DEFAULT_ITEMS = [
  { id: "030002", qty: 2, nombre: "1/2 Pinta Clásica",   precio:  4000 },
  { id: "130020", qty: 1, nombre: "Desembarco",          precio: 21800, mods: "Sin cebolla, jugosa" },
  { id: "140012", qty: 1, nombre: "Papas Desembarco",    precio: 13400 },
  { id: "140002", qty: 1, nombre: "Picada para dos",     precio: 33000 },
  { id: "140004", qty: 2, nombre: "Triángulos de muzzarella", precio: 16400 },
  { id: "150003", qty: 1, nombre: "Mila Napolitana (Carne)",  precio: 25400 },
  { id: "130001", qty: 1, nombre: "Bajoncito",           precio: 14000 },
];

function readPOSTicket() {
  try {
    const raw = localStorage.getItem("pos-cobrar");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items) || parsed.items.length === 0) return null;
    return parsed.items.map((i) => ({
      id: i.id,
      qty: i.qty,
      nombre: i.nombre,
      precio: i.precio,
      mods: Array.isArray(i.mods) && i.mods.length ? i.mods.join(", ") : undefined,
    }));
  } catch { return null; }
}

function ScreenTicket() {
  const fromPOS = readPOSTicket();
  const items = fromPOS || TICKET_DEFAULT_ITEMS;
  const origenLabel = fromPOS ? "Mostrador #1042" : "Mesa 12";
  const subtotal = items.reduce((s, i) => s + i.qty * i.precio, 0);
  const servicio = Math.round(subtotal * 0.10);
  const total = subtotal + servicio;
  const [pago, setPago] = React.useState("efectivo");
  const [propina, setPropina] = React.useState(10);

  return (
    <div className="screen ticket-screen-wrap" style={{ background: "var(--bg)" }}>
      <div className="ticket-page">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button className="btn btn-ghost" style={{ height: 40 }} onClick={() => window.location.href = fromPOS ? "pos.html" : "salon.html"}>
            <Icon name="arrowL" /> {origenLabel}
          </button>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Cerrar cuenta</h1>
          <span className="pill pill-info" style={{ marginLeft: 8 }}>
            {fromPOS ? `${items.reduce((s,i)=>s+i.qty,0)} ítems · pedido del POS` : "M. Cruz · 4 comensales · 1h 24m"}
          </span>
        </div>

        <div className="ticket-screen-grid">
          <div className="ticket-preview-col">
            <div className="ticket-preview">
              <div className="tp-head">
                <BarLogo size={50} invert={true} />
                <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 8 }}>Av. Cabildo 2890 · CABA · CUIT 30-71234567-8</div>
              </div>
              <div className="tp-meta">
                <div>{fromPOS ? "Mostrador · take-away" : "Mesa 12 · 4 cubiertos"}</div>
                <div>Mozo: M. Cruz</div>
                <div>4/5/2026 · 21:24</div>
              </div>
              <div className="tp-divider" />
              <div className="tp-items">
                {items.map((i, k) => (
                  <div key={k} className="tp-item">
                    <span className="tabular tp-qty">{i.qty}×</span>
                    <div style={{ flex: 1 }}>
                      <div><span className="tp-code tabular">{i.id}</span>{i.nombre}</div>
                      {i.mods && <div className="tp-mods">{i.mods}</div>}
                    </div>
                    <span className="tabular">{fmtAR(i.qty * i.precio)}</span>
                  </div>
                ))}
              </div>
              <div className="tp-divider" />
              <div className="tp-totals">
                <div className="tp-total-row"><span>Subtotal</span><span className="tabular">{fmtAR(subtotal)}</span></div>
                <div className="tp-total-row"><span>Servicio (10%)</span><span className="tabular">{fmtAR(servicio)}</span></div>
                <div className="tp-total-row big"><span>TOTAL</span><span className="tabular">{fmtAR(total)}</span></div>
              </div>
              <div className="tp-foot">
                ¡Gracias por elegirnos!<br/>www.eldesembarco.com.ar
              </div>
            </div>
          </div>

          <div className="ticket-pay-col">
            <div className="card" style={{ padding: 20 }}>
              <div className="pay-section">
                <div className="pay-section-head">Propina sugerida</div>
                <div className="pay-tip">
                  {[0, 5, 10, 15, 20].map((p) => (
                    <button key={p} className={"pay-tip-btn" + (p === propina ? " is-on" : "")} onClick={() => setPropina(p)}>
                      {p === 0 ? "Sin" : p + "%"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pay-section">
                <div className="pay-section-head">Método de pago</div>
                <div className="pay-methods">
                  {[
                    ["efectivo", "cash", "Efectivo"],
                    ["debito", "card", "Débito"],
                    ["credito", "card", "Crédito"],
                    ["mp", "card", "Mercado Pago"],
                    ["modo", "card", "Modo / Transfer"],
                  ].map(([k, ic, lbl]) => (
                    <button key={k} className={"pay-method" + (k === pago ? " is-on" : "")} onClick={() => setPago(k)}>
                      <Icon name={ic} size={20} />
                      <span>{lbl}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 8 }}>
                <div className="ticket-row" style={{ fontSize: 14 }}>
                  <span>Total + propina ({propina}%)</span>
                  <span className="tabular" style={{ fontWeight: 700, fontSize: 22 }}>
                    {fmtAR(total + Math.round(subtotal * propina / 100))}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button className="btn btn-lg" style={{ flex: 1 }}><Icon name="printer" /> Pre-cuenta</button>
                <button className="btn btn-amber btn-lg" style={{ flex: 2 }} onClick={() => {
                  if (fromPOS) {
                    try {
                      localStorage.removeItem("pos-cobrar");
                      localStorage.removeItem("pos-ticket-v1");
                    } catch {}
                  }
                  alert("Cobro confirmado · " + fmtAR(total + Math.round(subtotal * propina / 100)));
                  window.location.href = fromPOS ? "pos.html" : "salon.html";
                }}>
                  <Icon name="check" /> Confirmar cobro
                </button>
              </div>
              <button className="btn btn-ghost" style={{ width: "100%", marginTop: 8, color: "var(--text-3)" }}>
                Enviar ticket por WhatsApp / Email
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.ScreenTicket = ScreenTicket;
