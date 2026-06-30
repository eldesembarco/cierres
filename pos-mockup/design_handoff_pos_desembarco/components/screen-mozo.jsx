// Tablet del mozo — carga de pedido en una mesa específica
// Resolución target: tablet 1280×800 horizontal

function ScreenMozo() {
  const { categorias, productos } = window.POS_DATA;
  const [cat, setCat] = React.useState("burgers");
  const [q, setQ] = React.useState("");
  const [pedido, setPedido] = React.useState([
    { id: "030002", nombre: "1/2 Pinta Clásica",  qty: 2, precio:  4000, mods: [], enviado: true },
    { id: "140002", nombre: "Picada para dos",    qty: 1, precio: 33000, mods: [], enviado: true },
    { id: "140004", nombre: "Triángulos de muzzarella", qty: 2, precio: 16400, mods: [], enviado: false },
  ]);
  const [modProducto, setModProducto] = React.useState(null);
  const [showMap, setShowMap] = React.useState(false);
  const { mesas } = window.POS_DATA;

  const filtered = q
    ? productos.filter((p) => p.nombre.toLowerCase().includes(q.toLowerCase()))
    : productos.filter((p) => p.cat === cat);

  const subtotal = pedido.reduce((s, i) => s + i.precio * i.qty, 0);
  const sinEnviar = pedido.filter((i) => !i.enviado);

  const onTapProducto = (p) => {
    if (p.sizes || p.modifs) {
      setModProducto(p);
    } else {
      setPedido((arr) => [...arr, { id: p.id, nombre: p.nombre, qty: 1, precio: p.precio, mods: [], enviado: false }]);
    }
  };

  return (
    <div className="screen mozo-screen">
      <div className="mozo-top">
        <button className="btn btn-ghost" style={{ height: 44 }} onClick={() => setShowMap(true)}>
          <Icon name="arrowL" size={18} /> Salón
        </button>
        <div className="mozo-mesa-info">
          <div className="mozo-mesa-num">Mesa 5</div>
          <div className="mozo-mesa-meta">4 sillas · abierta 20:30 · M. Cruz</div>
        </div>
        <span className="pill pill-info"><span className="pill-dot" /> Ocupada</span>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={() => setShowMap(true)}>
          <Icon name="store" size={16} /> Cambiar de mesa
        </button>
        <button className="btn"><Icon name="users" size={16} /> Comensales: 4</button>
        <button className="btn btn-ghost btn-icon" aria-label="Más"><Icon name="more" size={18} /></button>
      </div>

      <div className="mozo-body">
        {/* Catálogo */}
        <div className="mozo-cat">
          <div className="pos-search" style={{ margin: "12px 16px 0" }}>
            <Icon name="search" size={18} />
            <input placeholder="Buscar producto…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          <div className="pos-chips" style={{ overflowX: "auto" }}>
            {categorias.map((c) => (
              <button key={c.id}
                className={"pos-chip" + (c.id === cat && !q ? " is-active" : "")}
                onClick={() => { setCat(c.id); setQ(""); }}>
                <span className="emo">{c.icon}</span>
                <span>{c.nombre}</span>
              </button>
            ))}
          </div>

          <div className="pos-grid mozo-grid scroll-y">
            {filtered.map((p) => (
              <button key={p.id} className="prod-tile prod-tile-mozo" onClick={() => onTapProducto(p)}>
                <div className="prod-tile-code tabular">{p.id}</div>
                <div className="prod-tile-name">{p.nombre}</div>
                {p.desc && <div className="prod-tile-desc">{p.desc}</div>}
                <div className="prod-tile-foot">
                  <span className="tabular prod-tile-price">{fmtAR(p.precio)}</span>
                  {p.tag && <span className="pill" style={{ height: 20, fontSize: 10 }}>{p.tag}</span>}
                  {!p.tag && (p.sizes || p.modifs) && <span className="pill" style={{ height: 20, fontSize: 10 }}>opciones</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Pedido en curso */}
        <div className="mozo-side">
          <div className="mozo-side-head">
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Pedido mesa 5</div>
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>{pedido.length} items · {sinEnviar.length} sin enviar</div>
            </div>
          </div>

          <div className="mozo-items scroll-y">
            {pedido.map((i, idx) => (
              <div key={idx} className={"mozo-item" + (i.enviado ? " is-enviado" : "")}>
                <div className="mozo-item-qty tabular">{i.qty}</div>
                <div className="mozo-item-main">
                  <div className="mozo-item-name">
                    {i.id && <span className="ticket-item-code tabular">{i.id}</span>}
                    {i.nombre}
                  </div>
                  {i.mods.length > 0 && (
                    <div className="mozo-item-mods">{i.mods.join(" · ")}</div>
                  )}
                  {i.enviado && <div className="mozo-item-tag">enviado a cocina</div>}
                </div>
                <div className="mozo-item-price tabular">{fmtAR(i.precio * i.qty)}</div>
              </div>
            ))}
          </div>

          <div className="mozo-side-totals">
            <div className="ticket-row"><span>Subtotal</span><span className="tabular">{fmtAR(subtotal)}</span></div>
            <div className="ticket-row total"><span>Total mesa</span><span className="tabular">{fmtAR(subtotal)}</span></div>
          </div>

          <div className="mozo-side-actions">
            <button className="btn btn-lg" style={{ flex: 1 }}>
              <Icon name="receipt" /> Pedir cuenta
            </button>
            <button className="btn btn-amber btn-lg" style={{ flex: 1.6 }} disabled={sinEnviar.length === 0}>
              <Icon name="check" /> Enviar a cocina ({sinEnviar.length})
            </button>
          </div>
        </div>
      </div>

      {modProducto && (
        <ModificadoresSheet producto={modProducto}
          onClose={() => setModProducto(null)}
          onAdd={(item) => { setPedido((arr) => [...arr, item]); setModProducto(null); }} />
      )}

      {showMap && (
        <MiniMapaSheet mesas={mesas} mesaActiva={5} onClose={() => setShowMap(false)} />
      )}
    </div>
  );
}

function MiniMapaSheet({ mesas, mesaActiva, onClose }) {
  const colorEstado = {
    libre: { fill: "var(--brand-bottle-soft)", stroke: "var(--brand-bottle)", label: "Libre" },
    ocupada: { fill: "var(--brand-amber-soft)", stroke: "var(--brand-amber-deep)", label: "Ocupada" },
    esperando: { fill: "var(--brand-amarillo-soft)", stroke: "#8A6A1F", label: "Esperando" },
    porPagar: { fill: "var(--brand-rojo-soft)", stroke: "var(--brand-rojo)", label: "Por cobrar" },
    reservada: { fill: "var(--surface-3)", stroke: "var(--text-3)", label: "Reservada" },
  };
  // Escalar el mapa para encajar en el sheet
  const scale = 0.78;
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ width: 720, maxWidth: "92%" }}>
        <div className="sheet-head">
          <div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>Mapa de salón</div>
            <div style={{ color: "var(--text-3)", fontSize: 13 }}>Tocá una mesa para ir a su pedido</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="sheet-body" style={{ padding: 16 }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            {Object.entries(colorEstado).map(([k, v]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, background: v.fill, border: `2px solid ${v.stroke}` }} />
                <span style={{ color: "var(--text-2)" }}>{v.label}</span>
              </div>
            ))}
          </div>
          <div style={{ position: "relative", width: 800 * scale, height: 560 * scale, background: "var(--surface-2)", borderRadius: 10, border: "1px solid var(--border)", overflow: "hidden", margin: "0 auto" }}>
            {/* Indicador de barra */}
            <div style={{ position: "absolute", top: 8, right: 8, padding: "4px 10px", background: "var(--surface)", borderRadius: 6, fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: 1 }}>BARRA</div>
            {mesas.map((m) => {
              const c = colorEstado[m.estado] || colorEstado.libre;
              const activa = m.id === mesaActiva;
              return (
                <button key={m.id} onClick={onClose}
                  style={{
                    position: "absolute",
                    left: m.x * scale, top: m.y * scale,
                    width: m.w * scale, height: m.h * scale,
                    background: c.fill,
                    border: `${activa ? 3 : 2}px solid ${activa ? "var(--text)" : c.stroke}`,
                    borderRadius: m.tipo === "alta" ? 6 : 8,
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    fontWeight: 700, color: "var(--text)",
                    boxShadow: activa ? "0 0 0 3px var(--brand-amber-soft)" : "none",
                  }}>
                  <div style={{ fontSize: m.w * scale > 90 ? 18 : 14, lineHeight: 1 }}>{m.id}</div>
                  {m.total > 0 && <div style={{ fontSize: 9, color: "var(--text-3)", marginTop: 2 }}>{fmtAR(m.total)}</div>}
                  {activa && <div style={{ fontSize: 8, color: "var(--brand-amber-deep)", marginTop: 2, fontWeight: 700 }}>ACTIVA</div>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ModificadoresSheet({ producto, onClose, onAdd }) {
  const [size, setSize] = React.useState(producto.sizes ? producto.sizes[0] : null);
  const [mods, setMods] = React.useState([]);
  const [notas, setNotas] = React.useState("");

  const precio = producto.precio + (size ? size[1] : 0);
  const nombreFull = producto.nombre + (size ? " " + size[0] : "");

  const toggleMod = (m) => setMods((arr) => arr.includes(m) ? arr.filter((x) => x !== m) : [...arr, m]);

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>{producto.nombre}</div>
            {producto.desc && <div style={{ color: "var(--text-3)", fontSize: 13 }}>{producto.desc}</div>}
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><Icon name="close" /></button>
        </div>

        <div className="sheet-body scroll-y">
          {producto.sizes && (
            <div className="sheet-section">
              <div className="sheet-label">Tamaño</div>
              <div className="sheet-options">
                {producto.sizes.map((s) => (
                  <button key={s[0]} className={"sheet-opt" + (size === s ? " is-on" : "")} onClick={() => setSize(s)}>
                    <span>{s[0]}</span>
                    <span className="tabular" style={{ color: "var(--text-3)" }}>
                      {s[1] === 0 ? fmtAR(producto.precio) : (s[1] > 0 ? "+" : "") + fmtAR(s[1])}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {producto.modifs && (
            <div className="sheet-section">
              <div className="sheet-label">Modificadores</div>
              <div className="sheet-options sheet-options-multi">
                {producto.modifs.map((m) => (
                  <button key={m} className={"sheet-opt" + (mods.includes(m) ? " is-on" : "")} onClick={() => toggleMod(m)}>
                    <span>{m}</span>
                    {mods.includes(m) && <Icon name="check" size={16} />}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="sheet-section">
            <div className="sheet-label">Nota para cocina</div>
            <textarea className="sheet-textarea" placeholder="Ej: bien caliente, alergia a frutos secos…"
              value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>
        </div>

        <div className="sheet-foot">
          <button className="btn btn-lg" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
          <button className="btn btn-amber btn-lg" style={{ flex: 2 }}
            onClick={() => onAdd({
              id: producto.id,
              nombre: nombreFull,
              qty: 1,
              precio,
              mods: [...mods, ...(notas ? ["📝 " + notas] : [])],
              enviado: false,
            })}>
            Agregar · {fmtAR(precio)}
          </button>
        </div>
      </div>
    </div>
  );
}

window.ScreenMozo = ScreenMozo;
window.ModificadoresSheet = ModificadoresSheet;
