/* ============ Drawer de detalle de servicio ============ */

const fieldStyle = { display:"flex", justifyContent:"space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--line)", fontSize: 13 };
const fieldLabel = { color: "var(--ink-3)", fontSize: 11, letterSpacing:"0.08em", textTransform:"uppercase", fontWeight: 600, fontFamily:"var(--font-ui)" };
const fieldValue = { color: "var(--ink)", fontFamily:"var(--font-mono)", textAlign:"right", wordBreak:"break-all" };

const CopyBtn = ({ text }) => {
  const [ok, setOk] = React.useState(false);
  return (
    <button
      className="icon-btn"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(text);
        setOk(true);
        setTimeout(()=>setOk(false), 1200);
      }}
      title="Copiar"
    >
      <Icon name={ok ? "check" : "copy"} size={11}/>
    </button>
  );
};

const Detail = ({ row, onClose, onPay, onDelete, data, duplicateInfo, onOpenSibling }) => {
  if (!row) return null;
  const c = ESTADO_COLORS[row.estado] || ESTADO_COLORS.VACIO;
  const d = daysUntil(row.vence);
  const category = SERVICIO_CATEGORIA[row.servicio] || "Otros";
  const catColor = CATEGORIA_COLOR[category] || "var(--ink-3)";

  const source = Array.isArray(data) && data.length ? data : (window.SERVICIOS_DATA || []);
  const rows = source.filter(r => r.local === row.local && r.servicio === row.servicio);
  const history = rows.sort((a,b) => b.mes.localeCompare(a.mes));

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose}/>
      <aside className="drawer">
        <div className="drawer-hd">
          <div>
            <div style={{display:"flex", gap: 8, alignItems:"center", marginBottom: 6}}>
              <span className="cat-chip" style={{"--cat-color": catColor}}>{category}</span>
              <span className={"pill " + (row.estado === "PAGO" ? "ok" : row.estado === "VENCIDO" ? "danger" : "warn")}>
                <span className="dot"/>{row.estado}
              </span>
            </div>
            <div style={{fontFamily:"var(--font-display)", fontSize: 24, letterSpacing:"-0.015em", fontStyle:"italic", fontWeight: 600}}>
              {row.servicio}
            </div>
            <div style={{color:"var(--ink-3)", fontSize: 13, marginTop: 2}}>
              {row.local} · {row.mes}
            </div>
          </div>
          <button className="icon-btn lg" onClick={onClose}><Icon name="x" size={16}/></button>
        </div>

        <div className="drawer-body">
          {/* Banner de duplicado */}
          {duplicateInfo && duplicateInfo.dupIds && duplicateInfo.dupIds.has(row.id) && (() => {
            const siblings = (duplicateInfo.dupSiblings || {})[row.id] || [];
            const siblingRows = siblings
              .map(sid => (data || []).find(x => x.id === sid))
              .filter(Boolean);
            return (
              <div className="dup-banner">
                <div className="dup-banner-hd">
                  <span className="dup-banner-icon">⚠</span>
                  <b>Posible duplicado</b>
                  <span style={{color:"var(--ink-3)", marginLeft:6}}>
                    · hay {siblingRows.length} factura{siblingRows.length === 1 ? '' : 's'} similar{siblingRows.length === 1 ? '' : 'es'} cargada{siblingRows.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="dup-banner-list">
                  {siblingRows.map(s => (
                    <button key={s.id} className="dup-banner-link" onClick={()=>onOpenSibling && onOpenSibling(s.id)} title="Abrir esta factura">
                      <span className={"pill sm " + (s.estado === "PAGO" ? "ok" : s.estado === "VENCIDO" ? "danger" : "warn")}>
                        <span className="dot"/>{s.estado}
                      </span>
                      <span style={{fontFamily:"var(--font-mono)", fontSize: 11}}>{fmtARS(s.monto)}</span>
                      <span style={{fontSize: 11, color:"var(--ink-3)"}}>{s.mes}</span>
                      <span style={{fontSize: 10, color:"var(--ink-3)", fontFamily:"var(--font-mono)"}}>{s.id}</span>
                      <Icon name="external" size={11}/>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Monto destacado */}
          <div className="monto-card" style={{borderColor: c.dot}}>
            <div className="field-label">Monto</div>
            <div className="monto-value">{fmtARS(row.monto)}</div>
            <div style={{display:"flex", gap: 10, alignItems:"center", fontSize: 12, color:"var(--ink-3)", marginTop: 6}}>
              {row.vence && <span>Vence {fmtDate(row.vence)}</span>}
              {d !== null && row.estado !== "PAGO" && (
                <span style={{color: d < 0 ? "var(--danger)" : d <= 3 ? "var(--warn)" : "var(--ink-3)"}}>
                  {d < 0 ? `${Math.abs(d)}d vencida` : d === 0 ? "vence hoy" : `en ${d} días`}
                </span>
              )}
              {row.estado === "PAGO" && row.pago && <span style={{color:"var(--ok)"}}>Pagada el {fmtDate(row.pago)}</span>}
            </div>
          </div>

          {/* Ingesta IA — solo si la factura vino del workflow */}
          {(row.ia_confianza != null || row.pdf_url) && (() => {
            const pct = row.ia_confianza != null ? Math.round(row.ia_confianza * 100) : null;
            return (
              <>
                <div className="section-title">
                  <Icon name="sparkles" size={13} style={{color:"var(--accent)"}}/>
                  Ingesta por IA {row.ia_revisado && <span style={{fontSize:10, color:"var(--ok)", marginLeft:6}}>· revisada</span>}
                </div>
                <div className="ai-card">
                  {pct !== null && (
                    <div className="ai-row">
                      <span>Confianza de extracción</span>
                      <span className="confidence">{pct}% <span className="bar"><span style={{width: pct + "%"}}/></span></span>
                    </div>
                  )}
                  <div className="ai-row">
                    <span>Local: <b>{row.local}</b> · Servicio: <b>{row.servicio}</b></span>
                  </div>
                  {row.pdf_url && (
                    <div className="ai-row">
                      <a href={row.pdf_url} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex", alignItems:"center", gap: 6, color:"var(--accent)"}}>
                        <Icon name="file" size={12}/>Ver PDF original
                      </a>
                    </div>
                  )}
                </div>
              </>
            );
          })()}

          {/* Datos del servicio */}
          <div className="section-title">Datos del servicio</div>
          <div>
            <div style={fieldStyle}>
              <span style={fieldLabel}>N° cliente</span>
              <span style={fieldValue}>
                {row.cliente || "—"} {row.cliente && <CopyBtn text={row.cliente}/>}
              </span>
            </div>
            <div style={fieldStyle}>
              <span style={fieldLabel}>Titular</span>
              <span style={{...fieldValue, fontFamily:"var(--font-body)"}}>{row.titular || "—"}</span>
            </div>
            <div style={fieldStyle}>
              <span style={fieldLabel}>Teléfono</span>
              <span style={fieldValue}>
                {row.tel || "—"} {row.tel && <CopyBtn text={row.tel}/>}
              </span>
            </div>
            <div style={fieldStyle}>
              <span style={fieldLabel}>Forma de pago</span>
              <span style={{...fieldValue, fontFamily:"var(--font-body)"}}>{row.forma || "—"}</span>
            </div>
            <div style={fieldStyle}>
              <span style={fieldLabel}>Vencimiento</span>
              <span style={fieldValue}>{row.vence || "—"}</span>
            </div>
            {row.pago && (
              <div style={fieldStyle}>
                <span style={fieldLabel}>Fecha de pago</span>
                <span style={fieldValue}>{row.pago}</span>
              </div>
            )}
          </div>

          {/* Credenciales web */}
          {(row.user || row.pass) && (
            <>
              <div className="section-title">
                <Icon name="key" size={13}/>
                Acceso web
              </div>
              <div className="creds">
                <div style={fieldStyle}>
                  <span style={fieldLabel}>Usuario</span>
                  <span style={fieldValue}>
                    {row.user} <CopyBtn text={row.user}/>
                  </span>
                </div>
                <div style={fieldStyle}>
                  <span style={fieldLabel}>Contraseña</span>
                  <span style={fieldValue}>
                    <PasswordField value={row.pass}/>
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Auditoría — quién y cuándo */}
          {(row.created_by || row.updated_by || row.created_at) && (
            <>
              <div className="section-title">
                <Icon name="user" size={13}/>
                Auditoría
              </div>
              <div className="audit-block">
                {row.created_by && (
                  <div className="audit-row">
                    <span className="audit-label">Creada por</span>
                    <span className="audit-value">
                      {row.created_by === "IA" ? (
                        <span className="audit-ia"><Icon name="sparkles" size={11}/> IA · automático</span>
                      ) : (
                        <span className="audit-user">{row.created_by}</span>
                      )}
                      {row.created_at && <span className="audit-time">· {fmtDate(row.created_at.slice(0, 10))}</span>}
                    </span>
                  </div>
                )}
                {row.updated_by && row.updated_by !== row.created_by && (
                  <div className="audit-row">
                    <span className="audit-label">Última edición</span>
                    <span className="audit-value">
                      <span className="audit-user">{row.updated_by}</span>
                      {row.updated_at && <span className="audit-time">· {fmtDate(row.updated_at.slice(0, 10))}</span>}
                    </span>
                  </div>
                )}
                {row.ia_revisado && (
                  <div className="audit-row">
                    <span className="audit-label">Revisión IA</span>
                    <span className="audit-value">
                      <span className="audit-revisado">✓ Verificada manualmente</span>
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Observaciones */}
          {row.obs && (
            <>
              <div className="section-title">Observaciones</div>
              <div style={{background:"var(--bg-sunken)", padding: 12, borderRadius: 8, fontSize: 13, color:"var(--ink-2)"}}>
                {row.obs}
              </div>
            </>
          )}

          {/* Historial últimos meses */}
          <div className="section-title">Histórico · {row.servicio} en {row.local}</div>
          <div className="hist">
            {history.map(h => {
              const hc = ESTADO_COLORS[h.estado];
              return (
                <div key={h.id} className={"hist-row" + (h.mes === row.mes ? " active" : "")}>
                  <span className="hist-mes">{h.mes}</span>
                  <span className="hist-dot" style={{background: hc.dot}}/>
                  <span className="hist-estado">{h.estado}</span>
                  <span className="hist-monto">{h.monto ? fmtARS(h.monto) : "—"}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="drawer-foot">
          {onDelete && (
            <button className="btn ghost danger-hover"
              title="Eliminar esta factura del sistema"
              onClick={()=>{
                const txt =
                  '¿Eliminar esta factura?\n\n' +
                  row.servicio + ' · ' + row.local + '\n' +
                  fmtARS(row.monto) + ' · ' + row.estado + ' · ' + row.mes + '\n' +
                  'ID: ' + row.id + '\n\n' +
                  'Se va a marcar como eliminada y no aparecerá más en el panel.\nEsta acción queda registrada en el Sheet con tu email.';
                if (window.confirm(txt)) onDelete(row);
              }}>
              <Icon name="x" size={13}/>Eliminar
            </button>
          )}
          <button className="btn ghost">
            <Icon name="external" size={13}/>Ir al portal
          </button>
          {row.estado !== "PAGO" ? (
            <button className="btn accent" onClick={()=>onPay && onPay(row, "pay")}>
              <Icon name="check" size={13}/>Registrar pago
            </button>
          ) : (
            <button className="btn ghost" title="Revertir pago"
              onClick={()=>onPay && onPay(row, "revert")}>
              <Icon name="refresh" size={13}/>Revertir pago
            </button>
          )}
        </div>
      </aside>
    </>
  );
};

const PasswordField = ({ value }) => {
  const [show, setShow] = React.useState(false);
  return (
    <span style={{display:"inline-flex", gap: 4, alignItems:"center"}}>
      <span style={{fontFamily:"var(--font-mono)"}}>
        {show ? value : "•".repeat(Math.min(value.length, 10))}
      </span>
      <button className="icon-btn" onClick={()=>setShow(s=>!s)} title={show?"Ocultar":"Mostrar"}>
        <Icon name="eye" size={11}/>
      </button>
      <CopyBtn text={value}/>
    </span>
  );
};

Object.assign(window, { Detail });
