/* ============ Ingesta IA — drop zone manual + drop overlay global ============ */

const UPLOADS_LS_KEY = 'uploads_v1';
const UPLOADS_TTL_MS = 60 * 60 * 1000; // 1h

// Cache de PDFs subidos manualmente para poder verlos en Revisión
// (el upload manual no persiste en Drive, solo viaja en memoria por n8n).
const PDF_CACHE_KEY = 'pdfs_subidos_v1';
const PDF_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días
const PDF_CACHE_MAX = 30;
// Sheets cell limit es ~50000 chars. base64 de 30MB cell-safe = poco realista.
// Cap en 5MB de PDF crudo (~6.7MB base64) — suficiente para facturas típicas.
const PDF_CACHE_MAX_BYTES = 5 * 1024 * 1024;

const savePdfCache = (filename, base64, mimeType) => {
  try {
    if (!filename || !base64) return;
    if (base64.length > PDF_CACHE_MAX_BYTES * 1.4) return; // muy grande, no cachear
    const raw = localStorage.getItem(PDF_CACHE_KEY);
    let list = [];
    try { list = raw ? JSON.parse(raw) : []; } catch {}
    const cutoff = Date.now() - PDF_CACHE_TTL_MS;
    list = list.filter(p => p && p.ts > cutoff);
    // dedup por filename (pisa)
    list = list.filter(p => p.filename !== filename);
    list.unshift({ filename, base64, mimeType: mimeType || 'application/pdf', ts: Date.now() });
    list = list.slice(0, PDF_CACHE_MAX);
    localStorage.setItem(PDF_CACHE_KEY, JSON.stringify(list));
  } catch (e) { /* quota exceeded — ignorar */ }
};

const getPdfFromCache = (filename) => {
  if (!filename) return null;
  try {
    const raw = localStorage.getItem(PDF_CACHE_KEY);
    if (!raw) return null;
    const list = JSON.parse(raw);
    const cutoff = Date.now() - PDF_CACHE_TTL_MS;
    // Match por nombre exacto o por sufijo (n8n a veces re-nombra el archivo)
    const found = list.find(p => p.ts > cutoff && (
      p.filename === filename ||
      p.filename.endsWith(filename) ||
      filename.endsWith(p.filename)
    ));
    return found || null;
  } catch { return null; }
};

window.getPdfFromCache = getPdfFromCache;

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const result = reader.result;
    const comma = result.indexOf(',');
    resolve(comma >= 0 ? result.slice(comma + 1) : result);
  };
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

// Función reusable de subida con progreso real (XHR para tener upload.onprogress)
const uploadFileXHR = (file, base64, { onProgress } = {}) => new Promise((resolve, reject) => {
  const apiBase = window.API_BASE || 'https://n8n.srv1312396.hstgr.cloud/webhook';
  const tokenKey = window.TOKEN_KEY || 'facturas_ia_token';
  const token = localStorage.getItem(tokenKey);
  const xhr = new XMLHttpRequest();
  xhr.open('POST', apiBase + '/upload-factura');
  xhr.setRequestHeader('Authorization', 'Bearer ' + (token || ''));
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
  };
  xhr.onload = () => {
    if (xhr.status === 401) {
      try { localStorage.removeItem(tokenKey); } catch {}
      setTimeout(() => window.location.reload(), 200);
      return reject(new Error('Sesión expirada'));
    }
    if (xhr.status >= 200 && xhr.status < 300) return resolve(xhr.responseText);
    let err = 'HTTP ' + xhr.status;
    try { const j = JSON.parse(xhr.responseText); if (j.error) err += ' — ' + j.error; } catch {}
    reject(new Error(err));
  };
  xhr.onerror = () => reject(new Error('Error de red'));
  xhr.ontimeout = () => reject(new Error('Timeout'));
  xhr.timeout = 120000;
  xhr.send(JSON.stringify({ filename: file.name, base64, mime_type: file.type || '' }));
});

// Hook centralizado de estado de subidas — usar desde App
const useUploadsState = () => {
  const [uploads, setUploads] = React.useState(() => {
    try {
      const raw = localStorage.getItem(UPLOADS_LS_KEY);
      if (!raw) return [];
      const list = JSON.parse(raw);
      const cutoff = Date.now() - UPLOADS_TTL_MS;
      return list.filter(u => u && u.ts > cutoff);
    } catch { return []; }
  });

  // Persistir
  React.useEffect(() => {
    try { localStorage.setItem(UPLOADS_LS_KEY, JSON.stringify(uploads)); } catch {}
  }, [uploads]);

  // Auto-marcar como "fue a Revisión" si pasaron >35s en 'sent' sin match
  React.useEffect(() => {
    const tid = setInterval(() => {
      setUploads(prev => {
        let changed = false;
        const next = prev.map(u => {
          if (u.status === 'sent' && Date.now() - u.ts > 35000) {
            changed = true;
            return { ...u, status: 'revision', msg: 'Probable Revisión · chequeá ahí' };
          }
          return u;
        });
        return changed ? next : prev;
      });
    }, 4000);
    return () => clearInterval(tid);
  }, []);

  const addUpload = React.useCallback((filename) => {
    const id = 'up-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    setUploads(prev => [{ id, filename, ts: Date.now(), status: 'reading', progress: 0, msg: 'Leyendo PDF…' }, ...prev].slice(0, 30));
    return id;
  }, []);

  const updateUpload = React.useCallback((id, patch) => {
    setUploads(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));
  }, []);

  const clearUploads = React.useCallback(() => {
    setUploads([]);
  }, []);

  // Match facturas nuevas contra uploads en 'sent' (por email + ventana de tiempo)
  const matchFacturasToUploads = React.useCallback((newOnes, userEmail) => {
    if (!userEmail || newOnes.length === 0) return newOnes;
    let unmatched = [...newOnes];
    setUploads(prev => prev.map(u => {
      if (u.status !== 'sent' && u.status !== 'revision') return u;
      const idx = unmatched.findIndex(f => {
        if ((f.created_by || '').toLowerCase() !== userEmail.toLowerCase()) return false;
        const fct = f.created_at ? new Date(f.created_at).getTime() : Date.now();
        return Math.abs(fct - u.ts) < 180000; // 3 min de ventana
      });
      if (idx >= 0) {
        const f = unmatched.splice(idx, 1)[0];
        return { ...u, status: 'matched', msg: 'Factura creada', factura: { id: f.id, servicio: f.servicio, local: f.local, mes: f.mes } };
      }
      return u;
    }));
    return unmatched;
  }, []);

  return { uploads, setUploads, addUpload, updateUpload, clearUploads, matchFacturasToUploads };
};

// Procesar un único archivo: lee → sube con progreso → marca sent. El status final ('matched'|'revision') lo decide el polling/timer.
const processOneFile = async (file, addUpload, updateUpload, showToast) => {
  const lname = file.name.toLowerCase();
  const ftype = (file.type || '').toLowerCase();
  const isPdf = lname.endsWith('.pdf') || ftype.includes('pdf');
  const isImg = /\.(jpg|jpeg|png|heic|heif|webp)$/i.test(lname) || ftype.startsWith('image/');
  if (!isPdf && !isImg) {
    showToast && showToast(`"${file.name}" no es PDF ni imagen (jpg/png/heic)`, 'danger');
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    showToast && showToast(`"${file.name}" pesa más de 15 MB — comprimilo primero`, 'danger');
    return;
  }
  const id = addUpload(file.name);
  try {
    updateUpload(id, { status: 'reading', msg: 'Leyendo PDF…' });
    const base64 = await fileToBase64(file);
    // Guardar en cache para mostrarlo después en /revision
    savePdfCache(file.name, base64, file.type || 'application/pdf');
    updateUpload(id, { status: 'uploading', progress: 0, msg: 'Subiendo…' });
    await uploadFileXHR(file, base64, {
      onProgress: (p) => updateUpload(id, { progress: p, msg: 'Subiendo… ' + Math.round(p * 100) + '%' }),
    });
    updateUpload(id, { status: 'sent', progress: 1, msg: 'IA procesando…' });
  } catch (err) {
    updateUpload(id, { status: 'error', msg: err.message || 'Error' });
    showToast && showToast(`Error subiendo ${file.name}: ${err.message}`, 'danger');
  }
};

// Procesa múltiples archivos en paralelo
const processFiles = (files, addUpload, updateUpload, showToast) => {
  const list = Array.from(files || []);
  return Promise.allSettled(list.map(f => processOneFile(f, addUpload, updateUpload, showToast)));
};

/* ============ Drop overlay global — aparece cuando arrastras un PDF a la ventana ============ */
const DropOverlay = ({ active }) => {
  if (!active) return null;
  return (
    <div className="drop-overlay">
      <div className="drop-overlay-inner">
        <div className="drop-overlay-icon"><Icon name="upload" size={56}/></div>
        <div className="drop-overlay-title">Soltá el PDF acá</div>
        <div className="drop-overlay-sub">La IA lo lee, matchea local + servicio y lo registra</div>
      </div>
    </div>
  );
};

/* ============ Pantalla Ingesta IA — versión compacta ============ */
const UploadIngesta = ({ refreshFacturas, showToast, setPage, uploads, addUpload, updateUpload, clearUploads, setSelected, data }) => {
  const [dragActive, setDragActive] = React.useState(false);
  const [showHelp, setShowHelp] = React.useState(false);
  const fileInputRef = React.useRef(null);
  const dragCounter = React.useRef(0);

  const handleFiles = React.useCallback(async (files) => {
    await processFiles(files, addUpload, updateUpload, showToast);
    // Empujar polls inmediatos para acortar el tiempo a "matched"
    // Polls silenciosos (sin loader) para detectar la factura recién procesada
    setTimeout(() => refreshFacturas && refreshFacturas({ silent: true }), 5000);
    setTimeout(() => refreshFacturas && refreshFacturas({ silent: true }), 12000);
    setTimeout(() => refreshFacturas && refreshFacturas({ silent: true }), 25000);
  }, [addUpload, updateUpload, showToast, refreshFacturas]);

  // stopPropagation en todos para evitar que el window listener (overlay global)
  // procese el mismo archivo y termine subiéndolo 2 veces.
  const onDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); dragCounter.current++; setDragActive(true); };
  const onDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); dragCounter.current = Math.max(0, dragCounter.current - 1); if (dragCounter.current === 0) setDragActive(false); };
  const onDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="panel-page">
      <div className="panel-hd">
        <div>
          <div className="panel-title" style={{display:'flex', alignItems:'center', gap: 10}}>
            Ingesta IA
            <button className="icon-btn" onClick={()=>setShowHelp(true)} title="¿Cómo funciona?">
              <Icon name="alert" size={13}/>
            </button>
          </div>
          <div className="panel-sub">Tirá un PDF acá o en cualquier pantalla del panel.</div>
        </div>
        {uploads.length > 0 && (
          <button className="btn ghost" onClick={clearUploads} title="Limpiar lista">
            <Icon name="x" size={12}/>Limpiar
          </button>
        )}
      </div>

      <div
        className={"upload-dropzone compact" + (dragActive ? " drag-active" : "")}
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={()=>fileInputRef.current?.click()}>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf,image/jpeg,image/png,image/heic,image/webp,.jpg,.jpeg,.png,.heic,.webp"
          multiple
          style={{display:'none'}}
          onChange={(e)=>{ handleFiles(e.target.files); e.target.value = ''; }}
        />
        <div className="upload-dz-row">
          <div className="upload-icon sm"><Icon name="upload" size={20}/></div>
          <div className="upload-dz-text">
            <div className="upload-title sm">Arrastrá un PDF o foto</div>
            <div className="upload-sub sm">PDF · JPG · PNG · click para elegir desde tu computadora</div>
          </div>
          <button className="btn accent sm" onClick={(e)=>{ e.stopPropagation(); fileInputRef.current?.click(); }}>
            <Icon name="plus" size={12}/>Elegir PDF
          </button>
        </div>
      </div>

      {uploads.length > 0 && (
        <>
          <div className="section-title" style={{marginTop: 24, marginBottom: 8}}>
            Subidas recientes <span className="section-count">{uploads.length}</span>
          </div>
          <div className="upload-list">
            {uploads.map(u => (
              <UploadRow
                key={u.id}
                u={u}
                onOpenFactura={(fId) => {
                  const f = (data || []).find(r => r.id === fId);
                  if (f) setSelected && setSelected(f);
                }}
                onGoRevision={()=>setPage && setPage('revision')}
              />
            ))}
          </div>
        </>
      )}

      {showHelp && <HelpModal onClose={()=>setShowHelp(false)} setPage={setPage}/>}
    </div>
  );
};

const UploadRow = ({ u, onOpenFactura, onGoRevision }) => {
  // Tick para que el timer del estado 'sent' (IA procesando) se actualice cada segundo
  const [, forceTick] = React.useState(0);
  React.useEffect(() => {
    if (u.status !== 'sent' && u.status !== 'uploading') return;
    const id = setInterval(() => forceTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [u.status]);

  const iconName =
    u.status === 'matched'   ? 'check'    :
    u.status === 'revision'  ? 'sparkles' :
    u.status === 'error'     ? 'alert'    :
    u.status === 'sent'      ? 'sparkles' :
    u.status === 'uploading' ? 'upload'   :
                               'file';
  const sinceMin = Math.max(0, Math.floor((Date.now() - u.ts) / 60000));
  const timeStr = sinceMin < 1 ? 'recién' : sinceMin === 1 ? 'hace 1 min' : 'hace ' + sinceMin + ' min';

  // Mensaje contextual con etapa estimada según segundos transcurridos en 'sent'
  let displayMsg = u.msg;
  if (u.status === 'sent') {
    const sec = Math.max(0, Math.floor((Date.now() - u.ts) / 1000));
    if (sec < 4)        displayMsg = '🔍 Leyendo PDF con IA…';
    else if (sec < 9)   displayMsg = '📋 Extrayendo proveedor, monto, vencimiento…';
    else if (sec < 14)  displayMsg = '🔗 Buscando match en CuentasServicio…';
    else if (sec < 25)  displayMsg = '💾 Guardando…';
    else                displayMsg = u.msg + ' · ' + sec + 's';
    if (sec >= 4) displayMsg += ' (' + sec + 's)';
  }

  return (
    <div className={"upload-row " + u.status}>
      <span className="upload-row-icon">
        {(u.status === 'uploading' || u.status === 'sent') ? <span className="spin"><Icon name="refresh" size={14}/></span> : <Icon name={iconName} size={14}/>}
      </span>
      <div className="upload-row-name" title={u.filename}>{u.filename}</div>
      <div className="upload-row-time">{timeStr}</div>
      <div className="upload-row-msg">
        <span>{displayMsg}</span>
        {u.status === 'matched' && u.factura && (
          <button className="upload-chip ok" onClick={()=>onOpenFactura(u.factura.id)}>
            → {u.factura.servicio} · {u.factura.local}
          </button>
        )}
        {u.status === 'revision' && (
          <button className="upload-chip warn" onClick={onGoRevision}>
            Ir a Revisión
          </button>
        )}
      </div>
      {u.status === 'uploading' && (
        <div className="upload-row-progress">
          <div className="bar"><span style={{width: Math.round((u.progress || 0) * 100) + '%'}}/></div>
        </div>
      )}
    </div>
  );
};

const HelpModal = ({ onClose, setPage }) => (
  <>
    <div className="modal-backdrop" onClick={onClose}/>
    <div className="modal" style={{maxWidth: 460}}>
      <div className="modal-hd">
        <div>
          <div className="modal-title">¿Cómo funciona la Ingesta IA?</div>
          <div className="modal-sub">5 pasos del pipeline · de PDF a registro auditado</div>
        </div>
        <button className="icon-btn lg" onClick={onClose}><Icon name="x" size={14}/></button>
      </div>
      <div className="modal-body" style={{display:'block', padding: 20, fontSize: 13, color:'var(--ink-2)', lineHeight: 1.6}}>
        <ol style={{paddingLeft: 18, margin: 0}}>
          <li><b>Gemini Vision</b> lee el PDF y extrae proveedor, monto, vencimiento, n° de cliente…</li>
          <li>Matcheo automático contra <code>CuentasServicio</code> usando el n° de cliente.</li>
          <li>Si <b>matchea</b> → la factura aparece directo en la <a onClick={()=>{ onClose(); setPage && setPage('planilla'); }} style={{color:'var(--accent)', cursor:'pointer'}}>Planilla</a>.</li>
          <li>Si <b>no matchea</b> o la confianza es baja → va a <a onClick={()=>{ onClose(); setPage && setPage('revision'); }} style={{color:'var(--accent)', cursor:'pointer'}}>Revisión</a> para categorizar a mano.</li>
          <li>Queda registro de quién la subió en el bloque <b>Auditoría</b> del detalle.</li>
        </ol>
        <div style={{marginTop: 14, padding: '10px 12px', background:'var(--bg-sunken)', borderRadius: 8, fontSize: 12}}>
          <b>Tip:</b> podés tirar un PDF en cualquier pantalla del panel — no hace falta venir acá.
        </div>
      </div>
    </div>
  </>
);

Object.assign(window, {
  UploadIngesta,
  DropOverlay,
  useUploadsState,
  processFiles,
});
