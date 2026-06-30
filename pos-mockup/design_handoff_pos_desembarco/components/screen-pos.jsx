// POS principal — caja
// Layout: buscador + chips arriba, grilla productos centro, ticket derecha
// Optimizado para monitor 1920×1080 táctil

const POS_TICKET_KEY = "pos-ticket-v1";
const POS_TICKET_DEFAULT = [
  { id: "030002", nombre: "1/2 Pinta Clásica",    qty: 2, precio:  4000, mods: [] },
  { id: "130020", nombre: "Desembarco",           qty: 1, precio: 21800, mods: ["Sin cebolla", "Cocción jugosa"] },
  { id: "140012", nombre: "Papas Desembarco",     qty: 1, precio: 13400, mods: [] },
  { id: "020009", nombre: "Coca Cola 500cc",      qty: 1, precio:  3700, mods: [] },
];

function loadTicket() {
  try {
    const raw = localStorage.getItem(POS_TICKET_KEY);
    if (!raw) return POS_TICKET_DEFAULT;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : POS_TICKET_DEFAULT;
  } catch { return POS_TICKET_DEFAULT; }
}

function ScreenPOS({ simIncoming }) {
  const { categorias, productos } = window.POS_DATA;
  const [cat, setCat] = React.useState("tiradas");
  const [q, setQ] = React.useState("");
  const [ticket, setTicket] = React.useState(loadTicket);
  const [modProducto, setModProducto] = React.useState(null);
  const searchRef = React.useRef(null);

  // Persistir ticket
  React.useEffect(() => {
    try { localStorage.setItem(POS_TICKET_KEY, JSON.stringify(ticket)); } catch {}
  }, [ticket]);

  // Atajos: "/" o Ctrl/Cmd+K para foco en buscador, Esc limpia
  React.useEffect(() => {
    const onKey = (e) => {
      const tgt = e.target;
      const inField = tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA");
      if (!inField && (e.key === "/" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k"))) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "Escape" && inField && tgt === searchRef.current) {
        setQ("");
        tgt.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const productosVisibles = React.useMemo(() => {
    const lq = q.trim().toLowerCase();
    return productos.filter((p) =>
      (lq ? (p.nombre.toLowerCase().includes(lq) || (p.desc || "").toLowerCase().includes(lq) || p.id.includes(lq)) : p.cat === cat)
    );
  }, [cat, q]);

  const subtotal = ticket.reduce((s, i) => s + i.precio * i.qty, 0);
  const servicio = Math.round(subtotal * 0.10);
  const total = subtotal + servicio;
  const itemsCount = ticket.reduce((s, i) => s + i.qty, 0);

  const addItem = (p) => {
    if (p.sizes || p.modifs) { setModProducto(p); return; }
    setTicket((t) => {
      const ex = t.find((i) => i.id === p.id && !i.mods.length);
      if (ex) return t.map((i) => i === ex ? { ...i, qty: i.qty + 1 } : i);
      return [...t, { id: p.id, nombre: p.nombre, qty: 1, precio: p.precio, mods: [] }];
    });
  };
  const setQty = (idx, d) =>
    setTicket((t) => t.map((i, k) => k === idx ? { ...i, qty: Math.max(0, i.qty + d) } : i).filter((i) => i.qty > 0));
  const clearTicket = () => {
    if (ticket.length === 0) return;
    if (confirm("¿Vaciar el pedido actual?")) setTicket([]);
  };
  const cobrar = () => {
    if (ticket.length === 0) return;
    try {
      localStorage.setItem("pos-cobrar", JSON.stringify({ items: ticket, ts: Date.now(), origen: "Mostrador #1042" }));
    } catch {}
    window.location.href = "ticket.html";
  };

  return (
    <div className="screen pos-screen">
      <Topbar current="pos" />

      {simIncoming && <IncomingToast app="pedidosya" />}

      <div className="pos-body">
        {/* IZQUIERDA: catálogo */}
        <div className="pos-catalog">
          <div className="pos-search">
            <Icon name="search" size={18} />
            <input
              ref={searchRef}
              placeholder="Buscar productos, código, atajo…  ( / )"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setQ("")}>
                <Icon name="close" size={16} />
              </button>
            )}
          </div>

          <div className="pos-chips scroll-y" style={{ overflowY: "hidden", overflowX: "auto" }}>
            {categorias.map((c) => (
              <button
                key={c.id}
                className={"pos-chip" + (c.id === cat && !q ? " is-active" : "")}
                onClick={() => { setCat(c.id); setQ(""); }}
              >
                <span className="emo">{c.icon}</span>
                <span>{c.nombre}</span>
              </button>
            ))}
          </div>

          <div className="pos-grid scroll-y">
            {productosVisibles.length === 0 && q && (
              <div className="pos-empty">
                <div style={{ fontSize: 32, opacity: .5 }}>🔍</div>
                <div style={{ fontWeight: 600, marginTop: 8 }}>Sin resultados para "{q}"</div>
                <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Probá con otro término o limpiá la búsqueda</div>
                <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={() => setQ("")}>
                  <Icon name="close" size={14} /> Limpiar
                </button>
              </div>
            )}
            {productosVisibles.map((p) => (
              <button key={p.id} className="prod-tile" onClick={() => addItem(p)}>
                <div className="prod-tile-thumb">
                  <span style={{ fontSize: 28 }}>
                    {(categorias.find((c) => c.id === p.cat) || {}).icon}
                  </span>
                </div>
                <div className="prod-tile-body">
                  <div className="prod-tile-code tabular">{p.id}</div>
                  <div className="prod-tile-name">{p.nombre}</div>
                  {p.desc && <div className="prod-tile-desc">{p.desc}</div>}
                  <div className="prod-tile-foot">
                    <span className="tabular prod-tile-price">{fmtAR(p.precio)}</span>
                    {p.tag && <span className={"pill pill-" + p.tag.toLowerCase().replace(/\s/g, '-')}>{p.tag}</span>}
                    {p.sizes && <span className="pill">{p.sizes.length} variantes</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* DERECHA: ticket */}
        <div className="pos-ticket">
          <div className="ticket-head">
            <div>
              <div className="ticket-title">Pedido nuevo</div>
              <div className="ticket-sub">Mostrador · #1042 · {itemsCount} {itemsCount === 1 ? "ítem" : "ítems"}</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={clearTicket} disabled={ticket.length === 0} title="Vaciar pedido">
              <Icon name="close" size={14} /> Vaciar
            </button>
          </div>

          <div className="ticket-items scroll-y">
            {ticket.map((i, idx) => (
              <div key={idx} className="ticket-item">
                <div className="ticket-item-main">
                  <div className="ticket-item-name">
                    <span className="ticket-item-code tabular">{i.id}</span>
                    {i.nombre}
                  </div>
                  {i.mods.length > 0 && (
                    <div className="ticket-item-mods">
                      {i.mods.map((m, k) => <span key={k}>· {m}</span>)}
                    </div>
                  )}
                </div>
                <div className="ticket-item-qty">
                  <button onClick={() => setQty(idx, -1)}><Icon name="minus" size={14} /></button>
                  <span className="tabular">{i.qty}</span>
                  <button onClick={() => setQty(idx, +1)}><Icon name="plus" size={14} /></button>
                </div>
                <div className="ticket-item-price tabular">{fmtAR(i.precio * i.qty)}</div>
              </div>
            ))}
            {ticket.length === 0 && (
              <div style={{ padding: 32, textAlign: "center", color: "var(--text-3)" }}>
                Tocá productos para agregarlos
              </div>
            )}
          </div>

          <div className="ticket-totals">
            <div className="ticket-row"><span>Subtotal</span><span className="tabular">{fmtAR(subtotal)}</span></div>
            <div className="ticket-row"><span>Servicio (10%)</span><span className="tabular">{fmtAR(servicio)}</span></div>
            <div className="ticket-row total"><span>Total</span><span className="tabular">{fmtAR(total)}</span></div>
          </div>

          <div className="ticket-actions">
            <button className="btn btn-lg" style={{ flex: 1 }}>
              <Icon name="users" size={18} /> Mesa
            </button>
            <button className="btn btn-lg" style={{ flex: 1 }}>
              <Icon name="bag" size={18} /> Take-away
            </button>
            <button className="btn btn-amber btn-lg" style={{ flex: 1.4 }} onClick={cobrar} disabled={ticket.length === 0}>
              <Icon name="card" size={18} /> Cobrar {fmtAR(total)}
            </button>
          </div>
        </div>
      </div>

      {modProducto && window.ModificadoresSheet && (
        <window.ModificadoresSheet
          producto={modProducto}
          onClose={() => setModProducto(null)}
          onAdd={(item) => {
            setTicket((arr) => [...arr, { id: item.id, nombre: item.nombre, qty: item.qty, precio: item.precio, mods: item.mods }]);
            setModProducto(null);
          }}
        />
      )}
    </div>
  );
}

// Toast de pedido entrante de app
function IncomingToast({ app = "pedidosya" }) {
  return (
    <div className="incoming-toast toast-slide">
      <div className={`src-stripe src-${app}`} style={{ width: 4 }} />
      <div className="incoming-body">
        <div className="incoming-head">
          <span className={`app-tag ${app}`}>{ORIGEN_LABEL[app]}</span>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>Pedido nuevo · hace 8 seg</span>
        </div>
        <div className="incoming-title">3 items · {fmtAR(14200)} · Joaquín R.</div>
      </div>
      <div className="incoming-actions">
        <button className="btn">Ver detalle</button>
        <button className="btn btn-amber">Aceptar (25 min)</button>
      </div>
    </div>
  );
}

window.ScreenPOS = ScreenPOS;
