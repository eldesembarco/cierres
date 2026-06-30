/* ============ App root — El Desembarco Panel de Servicios ============ */

const API_BASE = "https://n8n.srv1312396.hstgr.cloud/webhook";
window.API_BASE = API_BASE;

const App = () => {
  const auth = useAuth();
  const [page, setPage] = React.useState("planilla");
  const [selected, setSelected] = React.useState(null);
  const [payingRow, setPayingRow] = React.useState(null);
  const [editingRow, setEditingRow] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const [globalSearch, setGlobalSearch] = React.useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(() => localStorage.getItem('sidebar_collapsed') === '1');
  const toggleSidebar = React.useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('sidebar_collapsed', next ? '1' : '0'); } catch {}
      return next;
    });
  }, []);

  const [tableFullscreen, setTableFullscreen] = React.useState(false);
  const toggleTableFullscreen = React.useCallback(() => setTableFullscreen(v => !v), []);
  // ESC para salir
  React.useEffect(() => {
    if (!tableFullscreen) return;
    const onKey = (e) => { if (e.key === 'Escape') setTableFullscreen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tableFullscreen]);

  const [tweakValues, setTweak] = useTweaks(TWEAKS_DEFAULTS);
  const tweaks = { ...tweakValues, set: setTweak };

  // 📤 Estado central de subidas (con persistencia LS + auto-revision tras 35s)
  const { uploads, addUpload, updateUpload, clearUploads, matchFacturasToUploads } = useUploadsState();

  // 🌐 Drop overlay global — arrastrar PDF en cualquier pantalla lo procesa
  const [dropOverlayActive, setDropOverlayActive] = React.useState(false);
  const dragCounterRef = React.useRef(0);

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", tweaks.theme);
  }, [tweaks.theme]);

  // 🔌 INTEGRACIÓN BACKEND — fetch desde n8n
  const [data, setData] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [apiError, setApiError] = React.useState(null);

  // silent=true → no muestra loader (polls automáticos, refrescos post-upload, etc.)
  const fetchFacturas = React.useCallback((opts = {}) => {
    const silent = opts && opts.silent === true;
    if (!silent) {
      setLoading(true);
      setApiError(null);
    }
    return apiFetch(`${API_BASE}/facturas`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(resp => {
        if (resp && Array.isArray(resp.facturas)) setData(resp.facturas);
        if (!silent) setLoading(false);
      })
      .catch(err => {
        console.error("fetch /facturas falló:", err);
        if (!silent) {
          setApiError(err.message);
          setLoading(false);
        }
      });
  }, []);

  React.useEffect(() => { if (auth.token) fetchFacturas(); }, [auth.token, fetchFacturas]);
  React.useEffect(() => { window.SERVICIOS_DATA = data; }, [data]);

  // 🔔 Auto-poll cada 60s para detectar facturas nuevas (silencioso, sin loader)
  React.useEffect(() => {
    if (!auth.token) return;
    const id = setInterval(() => fetchFacturas({ silent: true }), 60000);
    return () => clearInterval(id);
  }, [auth.token, fetchFacturas]);

  // 🔔 Detectar facturas nuevas comparando IDs entre fetches y notificar
  const prevIdsRef = React.useRef(null);
  React.useEffect(() => {
    if (loading || !data || data.length === 0) return;
    const currentIds = new Set(data.map(r => r.id));
    if (prevIdsRef.current === null) {
      prevIdsRef.current = currentIds;
      return;
    }
    const newOnes = data.filter(r => !prevIdsRef.current.has(r.id));
    prevIdsRef.current = currentIds;
    if (newOnes.length === 0) return;

    // Primero: las que matchean con un upload pendiente actualizan la UploadRow → no genera toast genérico
    const userEmail = (auth.user && auth.user.email) || null;
    const unmatched = matchFacturasToUploads(newOnes, userEmail);

    // Las que SÍ matchearon con un upload generan un toast más específico
    const matchedCount = newOnes.length - unmatched.length;
    if (matchedCount > 0) {
      const m = newOnes.find(r => !unmatched.includes(r));
      if (m) {
        setToast({
          msg: matchedCount === 1
            ? `Tu PDF se registró: ${m.servicio} / ${m.local}`
            : `${matchedCount} PDFs subidos se registraron`,
          kind: "newfact",
          action: { label: "Ver", onClick: () => setSelected(m) }
        });
        setTimeout(() => setToast(null), 6000);
      }
    }

    // Las que no matchearon (vinieron por mail/Drive trigger) → toast genérico
    if (unmatched.length > 0) {
      if (unmatched.length === 1) {
        const r = unmatched[0];
        setToast({
          msg: `Nueva factura: ${r.servicio} / ${r.local}`,
          kind: "newfact",
          action: { label: "Ver", onClick: () => setPage("nuevas") }
        });
      } else {
        setToast({
          msg: `${unmatched.length} facturas nuevas ingresaron`,
          kind: "newfact",
          action: { label: "Ver", onClick: () => setPage("nuevas") }
        });
      }
      setTimeout(() => setToast(null), 6000);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        unmatched.slice(0, 3).forEach(r => {
          try {
            new Notification("Nueva factura", {
              body: `${r.servicio} / ${r.local}${r.monto ? ' · ' + fmtARS(r.monto) : ''}`,
              icon: "/favicon.svg",
              tag: r.id,
            });
          } catch (e) { /* algunos browsers tiran si no es secure context */ }
        });
      }
    }
  }, [data, loading, auth.user, matchFacturasToUploads]);

  // 🌐 Listeners globales de drag/drop — overlay aparece cuando arrastrás un PDF a la ventana
  const handleDroppedFiles = React.useCallback(async (files) => {
    await processFiles(files, addUpload, updateUpload, showToast);
    // Polls silenciosos para detectar la factura procesada (sin "Cargando..." visible)
    setTimeout(() => fetchFacturas && fetchFacturas({ silent: true }), 5000);
    setTimeout(() => fetchFacturas && fetchFacturas({ silent: true }), 12000);
    setTimeout(() => fetchFacturas && fetchFacturas({ silent: true }), 25000);
  }, [addUpload, updateUpload, fetchFacturas]);

  React.useEffect(() => {
    if (!auth.token) return;
    // En la pantalla "Ingesta IA" el dropzone interno se encarga del drop.
    // Desactivamos el overlay global ahí para evitar que el archivo se procese 2 veces.
    if (page === 'ingesta') return;
    const hasFiles = (e) => {
      const types = e.dataTransfer && e.dataTransfer.types;
      if (!types) return false;
      for (let i = 0; i < types.length; i++) {
        if ((types[i] || '').toLowerCase() === 'files') return true;
      }
      return false;
    };
    const onEnter = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragCounterRef.current++;
      setDropOverlayActive(true);
    };
    const onLeave = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) setDropOverlayActive(false);
    };
    const onOver = (e) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onDrop = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragCounterRef.current = 0;
      setDropOverlayActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length) {
        handleDroppedFiles(e.dataTransfer.files);
      }
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('dragover', onOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [auth.token, handleDroppedFiles, page]);

  // Pedir permiso para notificaciones browser una vez (no-blocking)
  React.useEffect(() => {
    if (!auth.token) return;
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      // No fuerzo el prompt al cargar — el browser puede bloquearlo si no es por user gesture
      // Lo dejamos para cuando el usuario interactúe con un botón específico
    }
  }, [auth.token]);

  const showToast = (msg, kind = "ok") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3200);
  };

  const confirmPayment = async (updated) => {
    const isRevert = !!updated._revert;
    const original = data.find(r => r.id === updated.id);
    if (!original) return;

    if (isRevert) {
      const { _revert, ...rest } = updated;
      const reverted = {
        ...rest,
        estado: daysUntil(rest.vence) < 0 ? "VENCIDO" : "DEUDA",
        pago: null,
        forma: null,
      };
      // optimistic
      setData(prev => prev.map(r => r.id === reverted.id ? reverted : r));
      if (selected && selected.id === reverted.id) setSelected(reverted);
      setPayingRow(null);
      try {
        const res = await apiFetch(`${API_BASE}/revert`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: reverted.id, estado: reverted.estado }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        showToast(`Pago revertido: ${reverted.servicio} / ${reverted.local}`, "warn");
      } catch (err) {
        // rollback
        setData(prev => prev.map(r => r.id === original.id ? original : r));
        if (selected && selected.id === original.id) setSelected(original);
        showToast(`Error al revertir: ${err.message}`, "danger");
      }
      return;
    }

    // Pago normal
    setData(prev => prev.map(r => r.id === updated.id ? updated : r));
    if (selected && selected.id === updated.id) setSelected(updated);
    setPayingRow(null);
    try {
      const res = await apiFetch(`${API_BASE}/pago`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: updated.id,
          fecha: updated.pago,
          monto: updated.monto,
          forma: updated.forma,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast(`Pago registrado: ${updated.servicio} / ${updated.local}`, "ok");
    } catch (err) {
      // rollback
      setData(prev => prev.map(r => r.id === original.id ? original : r));
      if (selected && selected.id === original.id) setSelected(original);
      showToast(`Error al registrar pago: ${err.message}`, "danger");
    }
  };

  const confirmDelete = async (row) => {
    const original = data.find(r => r.id === row.id);
    if (!original) return;
    // Optimistic: remove de la vista
    setData(prev => prev.filter(r => r.id !== row.id));
    if (selected && selected.id === row.id) setSelected(null);
    try {
      const res = await apiFetch(`${API_BASE}/factura/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast(`Factura eliminada: ${row.servicio} / ${row.local}`, "warn");
    } catch (err) {
      // rollback
      setData(prev => [original, ...prev.filter(r => r.id !== original.id)]);
      showToast(`Error al eliminar: ${err.message}`, "danger");
    }
  };

  const confirmEdit = async (updated) => {
    const original = data.find(r => r.id === updated.id);
    if (!original) return;
    setData(prev => prev.map(r => r.id === updated.id ? updated : r));
    if (selected && selected.id === updated.id) setSelected(updated);
    setEditingRow(null);
    try {
      const res = await apiFetch(`${API_BASE}/facturas/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: updated.id,
          forma: updated.forma,
          cliente: updated.cliente,
          titular: updated.titular,
          tel: updated.tel,
          user: updated.user,
          pass: updated.pass,
          obs: updated.obs,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast(`Datos actualizados: ${updated.servicio} / ${updated.local}`, "ok");
    } catch (err) {
      // rollback
      setData(prev => prev.map(r => r.id === original.id ? original : r));
      if (selected && selected.id === original.id) setSelected(original);
      showToast(`Error al guardar: ${err.message}`, "danger");
    }
  };

  // 🔁 Detector de facturas duplicadas — agrupa por (servicio+cliente+mes) y (servicio+monto+vence)
  const duplicateInfo = React.useMemo(() => {
    const norm = (s) => (s || '').toString().trim().toLowerCase();
    const onlyDigits = (s) => (s || '').toString().replace(/\D+/g, '').replace(/^0+/, '');
    const groups = {};

    for (const r of data) {
      if (!r.servicio) continue;
      const sNorm = norm(r.servicio);

      // Key por servicio + cliente + mes (la más fuerte: misma factura del mes)
      if (r.cliente && r.mes) {
        const k1 = 'svc-cli-mes:' + sNorm + '|' + onlyDigits(r.cliente) + '|' + r.mes;
        if (!groups[k1]) groups[k1] = [];
        groups[k1].push(r.id);
      }
      // Key por servicio + monto + vence (detecta avisos del mismo email cargados 2 veces)
      if (r.monto && r.vence) {
        const k2 = 'svc-monto-vence:' + sNorm + '|' + Math.round(Number(r.monto)) + '|' + r.vence;
        if (!groups[k2]) groups[k2] = [];
        groups[k2].push(r.id);
      }
    }

    const dupIds = new Set();
    const dupSiblings = {}; // id -> array de IDs hermanos (los otros del grupo)
    for (const [, ids] of Object.entries(groups)) {
      if (ids.length < 2) continue;
      ids.forEach(id => {
        dupIds.add(id);
        if (!dupSiblings[id]) dupSiblings[id] = new Set();
        ids.forEach(other => { if (other !== id) dupSiblings[id].add(other); });
      });
    }
    // Convertir Sets a arrays
    const dupSiblingsArr = {};
    for (const [id, set] of Object.entries(dupSiblings)) dupSiblingsArr[id] = Array.from(set);

    return { dupIds, dupSiblings: dupSiblingsArr };
  }, [data]);

  // Filtro global del topbar — aplica antes de pasar a Panel/Spreadsheet
  const filteredData = React.useMemo(() => {
    if (!globalSearch.trim()) return data;
    const q = globalSearch.trim().toLowerCase();
    const s = (v) => String(v == null ? "" : v).toLowerCase();
    return data.filter(r =>
      s(r.local).includes(q) ||
      s(r.servicio).includes(q) ||
      s(r.titular).includes(q) ||
      s(r.cliente).includes(q) ||
      s(r.obs).includes(q)
    );
  }, [data, globalSearch]);

  const currentData = filteredData.filter(r => r.mes === MES_ACTUAL);
  const counts = {
    vencidos: currentData.filter(r => r.estado === "VENCIDO").length,
    deuda:    currentData.filter(r => r.estado === "DEUDA").length,
    nuevas:   data.filter(r => hoursAgoSafe(r.created_at) <= 24).length,
  };

  // Login gate — sin token, no se renderiza nada del panel
  if (!auth.token) {
    return <LoginScreen onCredential={auth.handleCredential}/>;
  }

  // Inyecto el toggle de fullscreen en tweaks para que Panel/Spreadsheet lo usen sin cablear más props
  const tweaksWithFullscreen = { ...tweaks, tableFullscreen, toggleTableFullscreen };

  return (
    <>
      <div className={"app" + (sidebarCollapsed ? " sidebar-collapsed" : "") + (tableFullscreen ? " table-fullscreen" : "")}>
        <Sidebar page={page} setPage={setPage} counts={counts} collapsed={sidebarCollapsed} onToggle={toggleSidebar} user={auth.user} onSignOut={auth.signOut}/>
        <div className="main">
          <div className="topbar">
            <div className="topbar-actions" style={{marginLeft:"auto"}}>
              <div className="search">
                <Icon name="search" size={14}/>
                <input
                  placeholder="Buscar local, servicio, titular…"
                  value={globalSearch}
                  onChange={e => setGlobalSearch(e.target.value)}
                />
                {globalSearch && (
                  <button className="icon-btn" onClick={()=>setGlobalSearch("")} title="Limpiar">
                    <Icon name="x" size={11}/>
                  </button>
                )}
              </div>
              <button
                className="btn ghost"
                title="Refrescar"
                onClick={fetchFacturas}
                disabled={loading}>
                <Icon name="refresh" size={14}/>
              </button>
              <button
                className="btn ghost"
                title={tweaks.theme === "dark" ? "Modo claro" : "Modo oscuro"}
                onClick={()=>tweaks.set("theme", tweaks.theme === "dark" ? "desembarco" : "dark")}>
                <Icon name={tweaks.theme === "dark" ? "sun" : "moon"} size={14}/>
              </button>
              <button className="btn accent" onClick={()=>setPage("ingesta")}>
                <Icon name="plus" size={13}/>Nueva factura
              </button>
              <UserBadge user={auth.user} onSignOut={auth.signOut}/>
            </div>
          </div>

          {loading && data.length === 0 && (
            <div style={{padding:"10px 18px",fontSize:12,color:"var(--ink-3)"}}>Cargando facturas…</div>
          )}
          {apiError && (
            <div style={{padding:"10px 18px",fontSize:12,color:"#ff8a80",background:"#2a1215",borderBottom:"1px solid #5c2b2e"}}>
              ⚠️ Error al conectar con backend: {apiError} · Revisá consola (F12)
            </div>
          )}
          {page === "nuevas"     && <FacturasNuevas data={filteredData} setSelected={setSelected} refreshFacturas={fetchFacturas} loading={loading}/>}
          {page === "panel"      && <Panel data={filteredData} setSelected={setSelected} setPayingRow={setPayingRow} tweaks={tweaksWithFullscreen}/>}
          {page === "planilla"   && <Spreadsheet data={filteredData} duplicateInfo={duplicateInfo} setSelected={setSelected} setPayingRow={setPayingRow} setEditingRow={setEditingRow} onSaveRow={confirmEdit} tweaks={tweaksWithFullscreen}/>}
          {page === "locales"    && <Panel data={filteredData} setSelected={setSelected} setPayingRow={setPayingRow} tweaks={tweaksWithFullscreen}/>}
          {page === "vencidos"   && <Panel data={filteredData.filter(r => r.estado === "VENCIDO")} setSelected={setSelected} setPayingRow={setPayingRow} tweaks={tweaksWithFullscreen}/>}
          {page === "calendario" && <Calendario data={data} setSelected={setSelected} setPayingRow={setPayingRow}/>}
          {page === "ingesta"    && <UploadIngesta
                                       refreshFacturas={fetchFacturas}
                                       showToast={showToast}
                                       setPage={setPage}
                                       uploads={uploads}
                                       addUpload={addUpload}
                                       updateUpload={updateUpload}
                                       clearUploads={clearUploads}
                                       setSelected={setSelected}
                                       data={data}/>}
          {page === "revision"   && <Revision onConfirmed={fetchFacturas} setSelected={setSelected} setPage={setPage}/>}
          {page === "reportes"   && <Reportes data={data} setSelected={setSelected}/>}
          {page === "alertas"    && <EmptyPage title="Alertas email" subtitle="Reglas de notificación — próximamente"/>}
        </div>
      </div>

      <DropOverlay active={dropOverlayActive}/>

      {selected && <Detail
        row={selected}
        data={data}
        duplicateInfo={duplicateInfo}
        onOpenSibling={(id) => { const f = data.find(r => r.id === id); if (f) setSelected(f); }}
        onClose={()=>setSelected(null)}
        onDelete={isAdminEmail(auth.user && auth.user.email) ? confirmDelete : null}
        onPay={(r, action) => {
          if (action === "revert") {
            confirmPayment({ ...r, _revert: true });
          } else {
            setPayingRow(r);
          }
        }}/>}
      {payingRow && <PaymentModal row={payingRow} onClose={()=>setPayingRow(null)} onConfirm={confirmPayment}/>}
      {editingRow && <EditFacturaModal row={editingRow} onClose={()=>setEditingRow(null)} onSave={confirmEdit}/>}
      {tableFullscreen && (
        <button className="fab-exit" onClick={toggleTableFullscreen} title="Salir de pantalla completa (ESC)">
          <Icon name="x" size={13}/>Salir pantalla completa
        </button>
      )}
      {toast && (
        <div className={"toast " + (toast.kind || "")}>
          <Icon name={toast.kind === "danger" ? "alert" : toast.kind === "newfact" ? "sparkles" : "check"} size={14}/>
          <span>{toast.msg}</span>
          {toast.action && (
            <button className="toast-action" onClick={() => { toast.action.onClick(); setToast(null); }}>
              {toast.action.label}
            </button>
          )}
          <button className="icon-btn" onClick={()=>setToast(null)}><Icon name="x" size={11}/></button>
        </div>
      )}

      <TweaksPanel title="Tweaks">
        <TweakSection title="Tema visual">
          <TweakRadio label="Estilo" value={tweaks.theme}
            options={[
              { value: "desembarco", label: "Papel" },
              { value: "dark",       label: "Oscuro" },
              { value: "mercury",    label: "Azul" },
            ]}
            onChange={(v) => setTweak("theme", v)}/>
        </TweakSection>
        <TweakSection title="Densidad de celda">
          <TweakRadio label="Tamaño" value={tweaks.density}
            options={[
              { value: "compact",     label: "Compacta" },
              { value: "normal",      label: "Normal" },
              { value: "comfortable", label: "Cómoda" },
            ]}
            onChange={(v) => setTweak("density", v)}/>
        </TweakSection>
        <TweakSection title="Contenido de celda">
          <TweakRadio label="Mostrar" value={tweaks.cellDisplay}
            options={[
              { value: "vence",  label: "Vencimiento" },
              { value: "monto",  label: "Monto" },
              { value: "estado", label: "Solo color" },
            ]}
            onChange={(v) => setTweak("cellDisplay", v)}/>
        </TweakSection>
      </TweaksPanel>
    </>
  );
};

const EmptyPage = ({ title, subtitle }) => (
  <div className="panel-page">
    <div className="panel-hd">
      <div>
        <div className="panel-title">{title}</div>
        <div className="panel-sub">{subtitle}</div>
      </div>
    </div>
    <div style={{padding: 60, textAlign:"center", color:"var(--ink-3)", background:"var(--bg-elev)", borderRadius: 12, border:"1px solid var(--line)", marginTop: 24}}>
      Sección en desarrollo · foco actual en el Panel de Servicios
    </div>
  </div>
);

const TWEAKS_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "density": "normal",
  "cellDisplay": "vence"
}/*EDITMODE-END*/;

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
