/* ============ Revisión — cola de facturas IA pendientes de categorización ============ */

const API_BASE_REV = "https://n8n.srv1312396.hstgr.cloud/webhook";

// Extrae el file_id de Drive desde un webViewLink
const extractDriveFileId = (url) => {
  if (!url) return null;
  const m = url.match(/\/file\/d\/([^/?]+)/) || url.match(/[?&]id=([^&]+)/);
  return m ? m[1] : null;
};

const Revision = ({ onConfirmed, setSelected, setPage }) => {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [toast, setToast] = React.useState(null);

  const fetchRevisiones = React.useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch(`${API_BASE_REV}/revision`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(resp => {
        setItems(resp.revisiones || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("fetch /revision falló:", err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  React.useEffect(() => { fetchRevisiones(); }, [fetchRevisiones]);

  const showToast = (msg, kind = "ok") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3200);
  };

  const onCardConfirm = async (item, formData) => {
    // Detectar duplicado antes de mandar el POST.
    const data = window.SERVICIOS_DATA || [];
    const numFac = (item.campos_extraidos && item.campos_extraidos.numero_factura) || '';
    const mesForm = formData.vence ? formData.vence.slice(0, 7) : '';
    const norm = (s) => (s || '').toString().trim().toLowerCase();
    const onlyDigits = (s) => (s || '').toString().replace(/\D+/g, '').replace(/^0+/, '');

    const dup = data.find(r => {
      if (norm(r.servicio) !== norm(formData.servicio)) return false;
      if (numFac && r.obs && String(r.obs).indexOf(numFac) >= 0) return true;
      if (formData.cliente && r.cliente && onlyDigits(r.cliente) === onlyDigits(formData.cliente) && r.mes === mesForm) return true;
      return false;
    });

    if (dup) {
      const ok = window.confirm(
        'Ya existe una factura muy similar en el sistema:\n\n' +
        dup.servicio + ' · ' + dup.local + '\n' +
        (dup.monto ? '$ ' + Number(dup.monto).toLocaleString('es-AR') + ' · ' : '') +
        'Estado: ' + dup.estado + '\n' +
        'Mes: ' + dup.mes + '\n' +
        'ID: ' + dup.id + '\n\n' +
        '¿Querés crearla igual? (probable duplicado)'
      );
      if (!ok) {
        showToast('Cancelado · podés "Descartar" la card si es duplicada', 'warn');
        return;
      }
    }

    // OPTIMISTIC: sacar la card YA para que el usuario no pueda re-clickear.
    // Si el server falla, la rollbackeamos.
    setItems(prev => prev.filter(x => x.id !== item.id));

    try {
      const senderEmail = (item.campos_extraidos && item.campos_extraidos.sender_email) || formData.sender_email || '';
      const numFactura = (item.campos_extraidos && item.campos_extraidos.numero_factura) || '';
      const res = await apiFetch(`${API_BASE_REV}/revision/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision_id: item.id,
          local: formData.local,
          servicio: formData.servicio,
          monto: formData.monto,
          vence: formData.vence,
          cliente: formData.cliente,
          titular: formData.titular,
          forma: formData.forma,
          obs: formData.obs,
          pdf_url: item.pdf_url,
          ia_confianza: item.ia_confianza,
          sender_email: senderEmail,
          numero_factura: numFactura,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let factId = '';
      let factMes = '';
      try {
        const txt = await res.text();
        if (txt && txt.trim()) {
          const json = JSON.parse(txt);
          factId = (json && json.factura_id) || '';
          factMes = (json && json.factura && json.factura.mes) || '';
        }
      } catch (e) { /* respuesta vacía o no-JSON, asumimos OK */ }

      // Si el mes de la factura es distinto del actual, lo aclaramos en el toast
      // (caso típico: factura cargada en abril que vence en mayo → mes='2026-05')
      const mesActual = (typeof MES_ACTUAL !== 'undefined') ? MES_ACTUAL : '';
      const mesDistinto = factMes && mesActual && factMes !== mesActual;
      const baseMsg = mesDistinto
        ? `Factura creada para ${factMes} · ${formData.local} / ${formData.servicio}`
        : `Factura creada · ${formData.local} / ${formData.servicio}`;

      // Esperamos un poco al refresh para tener la factura en data y poder abrir el detail
      if (onConfirmed) onConfirmed();
      setTimeout(() => {
        const f = factId && (window.SERVICIOS_DATA || []).find(r => r.id === factId);
        if (f && setSelected) {
          setToast({
            msg: baseMsg + (mesDistinto ? ' · click para abrirla' : ''),
            kind: 'ok',
            action: { label: 'Ver factura', onClick: () => setSelected(f) }
          });
        } else {
          showToast(baseMsg, 'ok');
        }
        setTimeout(() => setToast(null), 6000);
      }, 1500);
    } catch (err) {
      // Rollback: la card vuelve a la lista
      setItems(prev => [item, ...prev]);
      showToast(`Error al confirmar: ${err.message}`, "danger");
    }
  };

  const onCardReprocess = async (item) => {
    const fileId = extractDriveFileId(item.pdf_url);
    if (!fileId) {
      showToast("No pude extraer el ID del PDF de Drive — re-procesar manualmente", "danger");
      return;
    }
    try {
      const res = await apiFetch(`${API_BASE_REV}/reprocess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: fileId, revision_id: item.id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast("⏳ Re-procesando con la lógica nueva… refresco en 15s", "ok");
      setTimeout(() => fetchRevisiones(), 15000);
    } catch (err) {
      showToast(`Error al reprocesar: ${err.message}`, "danger");
    }
  };

  const onCardDiscard = async (item) => {
    if (!window.confirm(`Descartar ${item.id}? Esto lo marca como resuelto sin crear factura.`)) return;
    try {
      const res = await apiFetch(`${API_BASE_REV}/revision/discard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision_id: item.id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast(`Revisión descartada: ${item.id}`, "warn");
      setItems(prev => prev.filter(x => x.id !== item.id));
    } catch (err) {
      showToast(`Error al descartar: ${err.message}`, "danger");
    }
  };

  const onDiscardAll = async () => {
    if (items.length === 0) return;
    const total = items.length;
    if (!window.confirm(
      `¿Descartar las ${total} facturas en revisión?\n\n` +
      `Esto las marca como resueltas SIN crear factura en la planilla.\n` +
      `Útil para limpiar la cola durante pruebas. No se puede deshacer.`
    )) return;
    if (!window.confirm(`Última confirmación: descartar las ${total} facturas. ¿Seguro?`)) return;

    const snapshot = items;
    // Optimistic: vaciamos la lista ya
    setItems([]);
    showToast(`Descartando ${total} facturas…`, "warn");

    const results = await Promise.allSettled(
      snapshot.map(it =>
        apiFetch(`${API_BASE_REV}/revision/discard`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revision_id: it.id }),
        }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return it.id; })
      )
    );

    const okIds = new Set(
      results.filter(r => r.status === "fulfilled").map(r => r.value)
    );
    const fallidas = snapshot.filter(it => !okIds.has(it.id));

    if (fallidas.length === 0) {
      showToast(`✔ ${total} facturas descartadas`, "ok");
    } else {
      // Rollback solo las que fallaron
      setItems(fallidas);
      showToast(
        `${okIds.size}/${total} descartadas · ${fallidas.length} fallaron, quedaron en la lista`,
        "danger"
      );
    }
  };

  return (
    <div className="panel-page">
      <div className="panel-hd">
        <div>
          <div className="panel-title">
            Revisión <em>/ pendientes de categorización</em>
          </div>
          <div className="panel-sub">
            {loading ? "Cargando…" : `${items.length} facturas esperando categorización manual`}
          </div>
        </div>
        <div style={{display:"flex", gap: 8}}>
          <button className="btn sm ghost" onClick={fetchRevisiones} disabled={loading}>
            <Icon name="refresh" size={12}/>Actualizar
          </button>
          {items.length > 0 && (
            <button
              className="btn sm ghost"
              onClick={onDiscardAll}
              disabled={loading}
              title="Descarta todas las facturas en revisión sin crear factura. Útil para limpiar la cola durante pruebas."
              style={{color: "var(--danger, #ff8a80)", borderColor: "color-mix(in oklab, var(--danger, #ff8a80) 30%, transparent)"}}
            >
              <Icon name="x" size={12}/>Descartar todas ({items.length})
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{padding:"10px 14px", marginTop: 16, fontSize:13, color:"#ff8a80", background:"#2a1215", borderRadius: 8, border:"1px solid #5c2b2e"}}>
          ⚠️ Error al cargar: {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div style={{padding: 60, textAlign:"center", color:"var(--ink-3)", background:"var(--bg-elev)", borderRadius: 12, border:"1px solid var(--line)", marginTop: 24}}>
          <Icon name="sparkles" size={32} style={{color:"var(--ok)", marginBottom: 12}}/>
          <div style={{fontSize: 16, fontWeight: 500}}>Todo al día</div>
          <div style={{fontSize: 13, marginTop: 4}}>No hay facturas pendientes de categorización.</div>
        </div>
      )}

      <div className="rev-grid">
        {items.map(item => (
          <RevisionCard key={item.id} item={item} onConfirm={onCardConfirm} onDiscard={onCardDiscard} onReprocess={onCardReprocess}/>
        ))}
      </div>

      {toast && (
        <div className={"toast " + (toast.kind || "")}>
          <Icon name={toast.kind === "danger" ? "alert" : "check"} size={14}/>
          <span>{toast.msg}</span>
          {toast.action && (
            <button className="toast-action" onClick={() => { toast.action.onClick(); setToast(null); }}>
              {toast.action.label}
            </button>
          )}
          <button className="icon-btn" onClick={()=>setToast(null)}><Icon name="x" size={11}/></button>
        </div>
      )}
    </div>
  );
};

// Preview del PDF al lado del form de Revisión.
// Prioriza pdf_url (Drive) y, si no existe, busca el PDF en la cache local
// (window.getPdfFromCache, populada por upload.jsx al subir manualmente).
const RevisionPdfPreview = ({ item, extracted }) => {
  const fname = (extracted && extracted.file_name) || '';
  const [open, setOpen] = React.useState(true); // abierto por default
  const [src, setSrc] = React.useState(null);
  const [origin, setOrigin] = React.useState(null); // 'drive' | 'local'

  React.useEffect(() => {
    // Si hay pdf_url (Drive), usamos un preview embebido de Drive
    if (item.pdf_url) {
      const m = item.pdf_url.match(/\/file\/d\/([^/?]+)/);
      if (m) {
        setSrc(`https://drive.google.com/file/d/${m[1]}/preview`);
        setOrigin('drive');
        return;
      }
      setSrc(item.pdf_url);
      setOrigin('drive');
      return;
    }
    // Si no, intentar buscar en la cache local por file_name
    const cached = (typeof window.getPdfFromCache === 'function') ? window.getPdfFromCache(fname) : null;
    if (cached && cached.base64) {
      setSrc(`data:${cached.mimeType || 'application/pdf'};base64,${cached.base64}`);
      setOrigin('local');
    } else {
      setSrc(null);
      setOrigin(null);
    }
  }, [item.pdf_url, fname]);

  // Sin PDF disponible — banner amarillo bien visible
  if (!src) {
    return (
      <div style={{
        padding: '12px 14px', marginBottom: 14,
        background: 'color-mix(in oklab, var(--warn, #f5a623) 14%, transparent)',
        border: '1px solid color-mix(in oklab, var(--warn, #f5a623) 40%, transparent)',
        borderRadius: 8, fontSize: 13,
        color: 'var(--warn, #f5a623)',
        display: 'flex', alignItems: 'center', gap: 10
      }}>
        <Icon name="alert" size={14}/>
        <div style={{flex: 1}}>
          <div style={{fontWeight: 600, marginBottom: 2}}>Preview del PDF no disponible</div>
          <div style={{fontSize: 12, color: 'var(--ink-2)'}}>
            {fname
              ? `Archivo "${fname}" no está en la cache local del browser. Re-subilo o consultá quien lo subió.`
              : 'No hay nombre de archivo asociado.'}
          </div>
        </div>
      </div>
    );
  }

  // Hay PDF — mostrar preview con header destacado
  return (
    <div style={{
      marginBottom: 14, borderRadius: 8, overflow: 'hidden',
      border: '1px solid color-mix(in oklab, var(--accent) 40%, transparent)',
      background: 'var(--bg-sunken)'
    }}>
      <div style={{
        display:'flex', alignItems:'center', gap: 8, padding: '10px 14px',
        background: 'color-mix(in oklab, var(--accent) 12%, transparent)',
        borderBottom: '1px solid color-mix(in oklab, var(--accent) 30%, transparent)'
      }}>
        <Icon name="file" size={14}/>
        <span style={{fontSize: 13, fontWeight: 600, color: 'var(--ink-1)'}}>Preview del PDF</span>
        <span style={{fontSize: 11, color: 'var(--ink-3)'}}>
          · {origin === 'drive' ? 'desde Drive' : 'cache local del navegador'}
        </span>
        <span style={{flex: 1}}/>
        {origin === 'local' && src && (
          <a href={src} download={fname || 'factura.pdf'} className="rev-pdf-link" style={{padding: '4px 10px', fontSize: 11}}>
            <Icon name="external" size={10}/>Descargar
          </a>
        )}
        {origin === 'drive' && item.pdf_url && (
          <a href={item.pdf_url} target="_blank" rel="noopener noreferrer" className="rev-pdf-link" style={{padding: '4px 10px', fontSize: 11}}>
            <Icon name="external" size={10}/>Abrir en Drive
          </a>
        )}
        <button type="button" className="btn ghost sm" onClick={()=>setOpen(o=>!o)} style={{padding: '4px 10px', fontSize: 11}}>
          {open ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
      {open && (
        <div style={{height: 520, background: '#1a1a1a'}}>
          <iframe src={src} style={{width: '100%', height: '100%', border: 0}} title="Preview PDF"/>
        </div>
      )}
    </div>
  );
};

const RevisionCard = ({ item, onConfirm, onDiscard, onReprocess, defaultExpanded = false }) => {
  const extracted = item.campos_extraidos || {};
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  // Helper: auto-detectar servicio desde el proveedor que extrajo Gemini
  // ej. "Agua y Saneamientos Argentinos S.A." → "Aysa"
  const autoDetectServicio = (proveedorRaw) => {
    if (!proveedorRaw || typeof SERVICIOS === "undefined") return "";
    const norm = (s) => (s || "").toString().toLowerCase().replace(/[^a-z0-9]+/g, "");
    const provNorm = norm(proveedorRaw);
    if (!provNorm) return "";
    return SERVICIOS.find(s => {
      const sNorm = norm(s);
      return provNorm.includes(sNorm) || sNorm.includes(provNorm);
    }) || "";
  };

  // Lee los campos que Gemini realmente extrae (nombres del workflow)
  const proveedorExtraido = extracted.proveedor || extracted.servicio_detectado || "";
  const cuitExtraido = extracted.cuit_emisor || "";
  const tipoServicioExtraido = extracted.tipo_servicio || "";

  const [local, setLocal] = React.useState(extracted.local_detectado || "");
  const [servicio, setServicio] = React.useState(autoDetectServicio(proveedorExtraido));
  const [monto, setMonto] = React.useState(
    (extracted.monto_total ?? extracted.monto) != null
      ? String(extracted.monto_total ?? extracted.monto)
      : ""
  );
  const [vence, setVence] = React.useState(extracted.fecha_vencimiento || extracted.vence || "");
  const [cliente, setCliente] = React.useState(
    (extracted.numero_cliente ?? extracted.cliente)
      ? String(extracted.numero_cliente ?? extracted.cliente)
      : ""
  );
  const [titular, setTitular] = React.useState(extracted.titular || "");
  const [forma, setForma] = React.useState("");
  const [obs, setObs] = React.useState(
    extracted.numero_factura ? `N° factura: ${extracted.numero_factura}` : ""
  );
  const [senderEmail, setSenderEmail] = React.useState(extracted.sender_email || "");
  const [submitting, setSubmitting] = React.useState(false);

  const pctConf = item.ia_confianza != null ? Math.round(item.ia_confianza * 100) : null;

  const submit = async (e) => {
    e.preventDefault();
    if (!local || !servicio) return;
    setSubmitting(true);
    await onConfirm(item, {
      local, servicio, monto: Number(monto) || 0, vence,
      cliente, titular, forma, obs,
      sender_email: senderEmail,
    });
    setSubmitting(false);
  };

  // Resumen para la fila colapsada
  const summaryProveedor = proveedorExtraido || "—";
  const summaryMonto = (extracted.monto_total ?? extracted.monto);

  return (
    <div className={"rev-row" + (expanded ? " rev-row-expanded" : "")}>
      {/* Header SIEMPRE visible — click para expandir */}
      <button type="button" className="rev-row-header" onClick={() => setExpanded(e => !e)}>
        <Icon name="chevdown" size={12} className={"rev-row-chevron" + (expanded ? " rotated" : "")}/>
        <span className="rev-row-id">{item.id}</span>
        {pctConf !== null && (
          <span className={"rev-conf " + (pctConf < 70 ? "low" : "mid")}>IA {pctConf}%</span>
        )}
        <span className="rev-row-svc" title={summaryProveedor}>{summaryProveedor}</span>
        {summaryMonto != null && summaryMonto !== "" && (
          <span className="rev-row-monto">{fmtARS(Number(summaryMonto) || 0)}</span>
        )}
        <span className="rev-row-motivo" title={item.motivo}>{item.motivo || "—"}</span>
      </button>

      {/* Body solo cuando expandido */}
      {expanded && (
      <form className="rev-row-body" onSubmit={submit}>
      <RevisionPdfPreview item={item} extracted={extracted}/>

      <div style={{display:"flex", gap: 8, flexWrap:"wrap", marginBottom: 8}}>
        {item.pdf_url && (
          <a className="rev-pdf-link" href={item.pdf_url} target="_blank" rel="noopener noreferrer">
            <Icon name="file" size={12}/>Ver PDF original
            <Icon name="external" size={11}/>
          </a>
        )}
        {extracted.url_factura && (
          <a className="rev-pdf-link" href={extracted.url_factura} target="_blank" rel="noopener noreferrer"
             style={{background:"color-mix(in oklab, var(--accent) 14%, transparent)", borderColor:"var(--accent)", color:"var(--accent)"}}>
            <Icon name="external" size={12}/>Abrir portal del proveedor
          </a>
        )}
        {extracted.tipo_documento && extracted.tipo_documento !== 'FACTURA' && (
          <span className="rev-hint-pill" style={{
            background: extracted.tipo_documento === 'NOTIFICACION_FACTURA' ? 'color-mix(in oklab, var(--accent) 14%, transparent)' :
                       extracted.tipo_documento === 'RECORDATORIO_PAGO' ? 'color-mix(in oklab, var(--warn) 14%, transparent)' :
                       extracted.tipo_documento === 'RECIBO_PAGO' ? 'color-mix(in oklab, var(--ok) 14%, transparent)' : '',
            color: extracted.tipo_documento === 'NOTIFICACION_FACTURA' ? 'var(--accent)' :
                   extracted.tipo_documento === 'RECORDATORIO_PAGO' ? 'var(--warn)' :
                   extracted.tipo_documento === 'RECIBO_PAGO' ? 'var(--ok)' : 'var(--ink-2)',
            fontWeight: 600
          }}>
            {extracted.tipo_documento === 'NOTIFICACION_FACTURA' ? '📩 Notificación de factura' :
             extracted.tipo_documento === 'RECORDATORIO_PAGO' ? '🔔 Recordatorio de pago' :
             extracted.tipo_documento === 'RECIBO_PAGO' ? '💵 Recibo de pago' :
             extracted.tipo_documento}
          </span>
        )}
      </div>

      {(proveedorExtraido || cuitExtraido || tipoServicioExtraido || extracted.fecha_emision || extracted.sender_email) && (
        <div className="rev-extraction-hint">
          <Icon name="sparkles" size={11}/>
          <span className="rev-hint-label">Gemini detectó:</span>
          {proveedorExtraido && <span className="rev-hint-pill">{proveedorExtraido}</span>}
          {tipoServicioExtraido && tipoServicioExtraido !== proveedorExtraido && <span className="rev-hint-pill">{tipoServicioExtraido}</span>}
          {extracted.fecha_emision && <span className="rev-hint-pill mono">emitida {extracted.fecha_emision}</span>}
          {cuitExtraido && <span className="rev-hint-pill mono">CUIT {cuitExtraido}</span>}
          {extracted.direccion_suministro && <span className="rev-hint-pill" title="Dirección de suministro">📍 {extracted.direccion_suministro}</span>}
          {extracted.sender_email && <span className="rev-hint-pill mono" title="Email del que llegó · se aprende para futuras facturas">✉ {extracted.sender_email}</span>}
        </div>
      )}

      <div className="rev-form-grid">
        <label className="field">
          <span className="field-k">Local *</span>
          <select className="field-input" value={local} onChange={e=>setLocal(e.target.value)} required>
            <option value="">— Elegir local —</option>
            {(typeof LOCALES !== "undefined" ? LOCALES : []).map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>

        <label className="field">
          <span className="field-k">Servicio *</span>
          <select className="field-input" value={servicio} onChange={e=>setServicio(e.target.value)} required>
            <option value="">— Elegir servicio —</option>
            {(typeof SERVICIOS !== "undefined" ? SERVICIOS : []).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>

        <label className="field">
          <span className="field-k">Monto</span>
          <input className="field-input" type="number" step="0.01" value={monto} onChange={e=>setMonto(e.target.value)}/>
        </label>

        <label className="field">
          <span className="field-k">Vencimiento</span>
          <input className="field-input" type="date" value={vence} onChange={e=>setVence(e.target.value)}/>
        </label>

        <label className="field">
          <span className="field-k">N° Cliente</span>
          <input className="field-input" type="text" value={cliente} onChange={e=>setCliente(e.target.value)}/>
        </label>

        <label className="field">
          <span className="field-k">Titular</span>
          <input className="field-input" type="text" value={titular} onChange={e=>setTitular(e.target.value)}/>
        </label>

        <label className="field">
          <span className="field-k">Forma de pago</span>
          <select className="field-input" value={forma} onChange={e=>setForma(e.target.value)}>
            <option value="">—</option>
            {(typeof FORMAS_PAGO !== "undefined" ? FORMAS_PAGO : []).map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>

        <label className="field field-wide">
          <span className="field-k">Observaciones</span>
          <input className="field-input" type="text" value={obs} onChange={e=>setObs(e.target.value)} placeholder="Opcional"/>
        </label>

        <label className="field field-wide">
          <span className="field-k">Email del remitente <em style={{color:"var(--ink-3)", fontWeight:400, fontStyle:"normal"}}>· para self-learning</em></span>
          <input className="field-input" type="email" value={senderEmail} onChange={e=>setSenderEmail(e.target.value.toLowerCase().trim())} placeholder="ej: noreply@edenred.com.ar"/>
        </label>
      </div>

      <details className="rev-raw-details">
        <summary>Ver extracción completa de Gemini</summary>
        <pre className="rev-raw">{JSON.stringify(extracted, null, 2)}</pre>
      </details>

      <div className="rev-card-foot">
        <button type="button" className="btn ghost" onClick={()=>onDiscard(item)} disabled={submitting}>
          <Icon name="x" size={12}/>Descartar
        </button>
        {onReprocess && (
          <button type="button" className="btn ghost" onClick={()=>onReprocess(item)} disabled={submitting} title="Volver a correr el pipeline (Gemini + matching) sobre este PDF">
            <Icon name="refresh" size={12}/>Re-procesar
          </button>
        )}
        <button type="submit" className="btn accent" disabled={submitting || !local || !servicio}>
          <Icon name="check" size={12}/>{submitting ? "Guardando…" : "Confirmar y crear factura"}
        </button>
      </div>
      </form>
      )}
    </div>
  );
};

Object.assign(window, { Revision, RevisionPdfPreview });
