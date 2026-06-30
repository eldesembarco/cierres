/* ============ Modal: registrar pago manual ============ */

const todayIso = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
};

const PaymentModal = ({ row, onClose, onConfirm }) => {
  if (!row) return null;
  const [fecha, setFecha] = React.useState(todayIso());
  const [forma, setForma] = React.useState(row.forma || "Transferencia");
  const [monto, setMonto] = React.useState(row.monto ? String(row.monto) : "");
  const [nota, setNota] = React.useState("");

  const submit = (e) => {
    e.preventDefault();
    onConfirm({
      ...row,
      estado: "PAGO",
      pago: fecha,
      forma,
      monto: Number(monto) || row.monto,
      obs: nota ? ((row.obs ? row.obs + " · " : "") + "Pago manual: " + nota) : row.obs,
    });
  };

  const category = SERVICIO_CATEGORIA[row.servicio] || "Otros";
  const catColor = CATEGORIA_COLOR[category] || "var(--ink-3)";

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}/>
      <div className="modal" role="dialog" aria-modal="true">
        <form onSubmit={submit}>
          <div className="modal-hd">
            <div>
              <div className="modal-eyebrow">
                <span className="cat-chip" style={{"--cat-color": catColor}}>{category}</span>
                <span>Registrar pago manual</span>
              </div>
              <div className="modal-title">
                {row.servicio} <em>/ {row.local}</em>
              </div>
              <div className="modal-sub">
                Monto facturado: <b>{fmtARS(row.monto)}</b> · Vence {fmtDate(row.vence) || "—"}
              </div>
            </div>
            <button type="button" className="icon-btn lg" onClick={onClose}><Icon name="x" size={16}/></button>
          </div>

          <div className="modal-body">
            <div className="form-grid">
              <label className="field">
                <span className="field-k">Fecha de pago</span>
                <input className="field-input" type="date" value={fecha} onChange={e=>setFecha(e.target.value)} required/>
              </label>

              <label className="field">
                <span className="field-k">Monto pagado</span>
                <div className="field-input field-input-prefix">
                  <span>$</span>
                  <input type="number" step="0.01" value={monto} onChange={e=>setMonto(e.target.value)} required/>
                </div>
              </label>

              <label className="field field-wide">
                <span className="field-k">Forma de pago</span>
                <div className="seg-radio">
                  {FORMAS_PAGO.map(f => (
                    <button key={f} type="button"
                      className={"seg-radio-btn " + (forma === f ? "active" : "")}
                      onClick={()=>setForma(f)}>{f}</button>
                  ))}
                </div>
              </label>

              <label className="field field-wide">
                <span className="field-k">Nota / Observación (opcional)</span>
                <textarea className="field-input field-textarea" rows="2"
                  placeholder="Ej: N° comprobante, banco, cuenta, etc."
                  value={nota} onChange={e=>setNota(e.target.value)}/>
              </label>
            </div>

            <div className="modal-preview">
              <div className="preview-row">
                <span>Estado</span>
                <span className="pill ok"><span className="dot"/>PAGO</span>
              </div>
              <div className="preview-row">
                <span>Fecha de pago</span>
                <b>{fmtDate(fecha) || "—"}</b>
              </div>
              <div className="preview-row">
                <span>Forma</span>
                <b>{forma}</b>
              </div>
              <div className="preview-row">
                <span>Monto</span>
                <b>{fmtARS(Number(monto) || 0)}</b>
              </div>
            </div>
          </div>

          <div className="modal-foot">
            <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn accent">
              <Icon name="check" size={13}/>Confirmar pago
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

Object.assign(window, { PaymentModal });
