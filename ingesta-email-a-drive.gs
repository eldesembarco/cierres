/**
 * Ingesta Email → Drive con FILTRO INTELIGENTE EN 2 CAPAS
 *
 * Pipeline:
 *  1. Etiquetar emails NUEVOS con PDF como "Facturas (pendiente)"
 *  2. Por cada email pendiente:
 *      Capa 1 — Heurísticas instantáneas (sender allowlist/denylist + keywords subject + filename)
 *      Capa 2 — Si la capa 1 no decide, pregunta a Gemini Flash con SOLO metadata (sin abrir el PDF)
 *      Acción → si pasa: sube PDFs a Drive y label "Facturas Procesadas"
 *               si no pasa: solo label "Facturas Ignoradas" (no llega al pipeline pesado)
 *      Toda decisión se loguea en el Sheet "EmailFilterLog"
 *  3. n8n Drive trigger levanta los PDFs y los procesa con Gemini Vision
 *
 * Costo estimado:
 *   Capa 1 (heurística): $0
 *   Capa 2 (Gemini Flash con metadata, ~150 tokens): ~$0.00002 por email
 *   Capa 3 (Gemini Vision con PDF entero, dentro de n8n): ~$0.005 por email
 *   → con buen filtrado, 80% se decide gratis y solo 5-10% llega al pipeline pesado.
 *
 * SETUP:
 *  1. Reemplazá el contenido del proyecto Apps Script con TODO este archivo
 *  2. (Opcional pero recomendado) Pegá tu API key de Gemini en GEMINI_API_KEY abajo.
 *     Conseguí una gratis en https://aistudio.google.com/apikey (cuenta de Google)
 *     Si dejás vacío, los dudosos pasan por default (igual de seguro pero más caros)
 *  3. Ctrl+S
 *  4. Ejecutá `ejecutarTodo` una vez para autorizar permisos extra (UrlFetch + Sheets + Drive)
 *  5. Activadores ⏰ → trigger cada 5 min sobre `ejecutarTodo`
 *
 * AJUSTAR LISTAS:
 *  - Si el filtro deja pasar basura recurrente: agregá el dominio/keyword a SENDER_DENYLIST o KW_NEGATIVOS
 *  - Si bloquea facturas reales: agregá el sender a SENDER_ALLOWLIST
 *  - Mirá la hoja "EmailFilterLog" para entender por qué cada email se decidió como se decidió
 */

/* ============ CONFIG ============ */

const FACTURAS_LABEL    = 'Facturas';            // pendiente de clasificar
const PROCESADAS_LABEL  = 'Facturas Procesadas'; // pasó filtro y se subió a Drive
const IGNORADOS_LABEL   = 'Facturas Ignoradas';  // filtro decidió que no es factura
const DRIVE_FOLDER_ID   = '1JByy4cP8X3SSP4al22HaINQLPi84QIZT';

const SHEET_ID                = '1kVXml8QlQiYlyjU87WnglQQHDjpWeRApHWFajn3Qlvo';
const FILTER_LOG_SHEET_NAME   = 'EmailFilterLog';

// API key de Gemini para la capa 2 (clasificador lightweight con metadata).
// Conseguí una gratis: https://aistudio.google.com/apikey
// Si la dejás vacía, los emails dudosos pasan por defecto (más caro a largo plazo pero seguro).
const GEMINI_API_KEY = '';

// Modelo barato y rápido para la capa 2
const GEMINI_FLASH_MODEL = 'gemini-2.0-flash';

/* ============ LISTAS DE FILTRO ============ */
/* Editables — la idea es que las vayas afinando con el tiempo mirando EmailFilterLog */

// Si el sender contiene cualquiera de estos strings, pasa directo (capa 1 → pass)
const SENDER_ALLOWLIST = [
  // Servicios públicos
  'edenor.com', 'edesur.com',
  'naturgy.com', 'metrogas.com',
  'aysa.com',
  // Telcos / internet (incluye los dominios de email marketing que usan)
  'telecentro.com.ar', 'movistar.com.ar', 'personal.com.ar', 'emails.personal.com.ar',
  'claro.com.ar', 'fibertel',
  // Impuestos
  'arba.gob.ar', 'agip.gob.ar', 'afip.gob.ar', 'arca.gob.ar',
  // Servicios financieros / seguros que mandan facturas
  'galiciaseguros', 'allianz', 'mapfre', 'zurich', 'federacionpatronal',
  // Edenred (vouchers / beneficios)
  'edenred', 'noreply@factur',
  // Seguridad / alarmas
  'prosegur', 'sgd.prosegur', 'ihsa', 'emergencias.com.ar',
  // Patrones de emisor de billing
  'facturacion@', 'billing@', 'cobranzas@', 'no-reply@servicios',
  // Expensas / consorcios — patrón general
  'expensas', 'consorcio', 'administra'
];

// Si el sender contiene esto, no pasa (capa 1 → block)
const SENDER_DENYLIST = [
  // ESPs de marketing / mailings masivos
  'mailchimp.com', 'sendgrid.net', 'mandrillapp', 'campaignmonitor', 'sendinblue',
  // Patrones de marketing
  'newsletter@', 'marketing@', 'promociones@', 'novedades@', 'noticias@', 'news@', 'comunicacion@',
  // Redes sociales / SaaS notificaciones
  'noreply@linkedin.com', 'noreply@facebook.com', 'noreply@twitter.com', 'noreply@instagram',
  'noreply@github', 'noreply@notion', 'noreply@slack', 'noreply@zoom',
  // Patrones genéricos no-billing
  'no-responder@', 'donotreply@', 'noreply@info', 'invitaciones@'
];

// Subject keywords positivos (en minúsculas)
const KW_POSITIVOS = [
  'factura', 'fact ', 'fact.', 'fc-', 'fc_', ' fc ',
  'boleta', 'comprobante', 'recibo', 'invoice',
  'aviso de pago', 'aviso de vencimiento', 'aviso de cobro',
  'tu cuenta', 'su cuenta', 'estado de cuenta',
  'período de consumo', 'periodo de consumo', 'consumo del',
  'vencimiento', 'vence ', 'vence el', 'vence hoy', 'pago pendiente',
  'liquidación', 'liquidacion',
  'expensas', 'abl', 'arba', 'agip', 'afip',
  'no_factura', 'cobranza',
  // Notificaciones de "factura disponible para descargar" (Personal Tech, etc.)
  'podés acceder', 'podes acceder', 'puedes acceder',
  'ya podés', 'ya podes', 'factura disponible',
  'tu factura', 'su factura',
  // Recordatorios de factura impaga (Personal "tu factura sigue pendiente", etc.)
  'sigue pendiente', 'pendiente de pago', 'impaga',
  'aboná hoy', 'abona hoy', 'regulariza', 'regularizar',
  // Saldos del mes
  'saldo total', 'saldo del mes'
];

// Subject keywords negativos
const KW_NEGATIVOS = [
  'newsletter', 'novedad', 'novedades',
  'promo', 'promoción', 'promocion', 'descuento', 'oferta', 'rebaja',
  'webinar', 'evento', 'capacitación', 'curso ',
  'survey', 'encuesta', 'opinión', 'opinion',
  ' tip ', 'consejo',
  'curriculum', ' cv ', 'cv.', 'postulación', 'postulacion', 'búsqueda laboral',
  'propuesta comercial', 'cotización', 'cotizacion', 'presupuesto',
  'agradecimiento', 'gracias por',
  'feliz cumpleaños', 'feliz año', 'felicitaciones',
  'invitación', 'invitacion'
];

// Filename keywords
const FN_POSITIVOS = ['factura','fact_','fact-','fc_','fc-','boleta','comprobante','recibo','liquidacion','liquidación','invoice','vto','venc'];
const FN_NEGATIVOS = ['cv_','cv-','curriculum','propuesta','cotizacion','cotización','presentacion','presentación','catalogo','catálogo','flyer','folleto','newsletter','presupuesto'];

/* ============ ENTRY POINT ============ */

function ejecutarTodo() {
  Logger.log('=== Iniciando ciclo ingesta con filtro ===');
  etiquetarFacturas();
  procesarConFiltroInteligente();
  Logger.log('=== Ciclo completo ===');
}

/* ============ Paso 1: Etiquetar candidatos ============ */

function etiquetarFacturas() {
  let label = GmailApp.getUserLabelByName(FACTURAS_LABEL);
  if (!label) {
    label = GmailApp.createLabel(FACTURAS_LABEL);
    Logger.log('➕ Etiqueta "' + FACTURAS_LABEL + '" creada');
  }

  // Dos queries en paralelo para no perder ningún caso:
  //   1) Emails con PDF adjunto (caso clásico)
  //   2) Emails sin PDF pero con keywords de factura en subject (Personal/Movistar/Edenred mandan así)
  const baseExcl = [
    '-label:' + FACTURAS_LABEL,
    '-label:"' + PROCESADAS_LABEL + '"',
    '-label:"' + IGNORADOS_LABEL + '"',
    // NO excluimos category:promotions porque Gmail categoriza muchas facturas
    // corporativas (Prosegur, Edenor, etc.) como Promociones por su HTML elaborado.
    // El filtro inteligente (capa 1 + capa 2) decide.
    '-category:social',
    '-category:forums'
  ].join(' ');

  const queryConPdf = ['has:attachment', 'filename:pdf', 'newer_than:7d', baseExcl].join(' ');
  // Subject keywords típicos de notificaciones de factura (Personal, Movistar, Telecentro, Edenred…)
  const queryNoPdf  = [
    'newer_than:7d',
    '-has:attachment',
    '(subject:(factura) OR subject:(boleta) OR subject:(saldo) OR subject:(vencimiento) OR subject:(vence) OR subject:(disponible para descargar))',
    baseExcl
  ].join(' ');

  let total = 0;
  for (const q of [queryConPdf, queryNoPdf]) {
    const threads = GmailApp.search(q, 0, 100);
    if (threads.length > 0) {
      label.addToThreads(threads);
      total += threads.length;
    }
  }

  if (total === 0) {
    Logger.log('[etiquetar] Nada para etiquetar');
  } else {
    Logger.log('[etiquetar] ✅ ' + total + ' thread(s) candidato(s) → label "' + FACTURAS_LABEL + '"');
  }
}

/* ============ Helper: convierte el body de un email a PDF ============ */
/* Cuando el email NO trae PDF adjunto pero sí los datos de la factura en el cuerpo
   (caso Personal, Movistar, Edenred), generamos un PDF a partir del HTML.
   Gemini Vision lo lee igual que un PDF tradicional y extrae los datos.            */
function emailBodyToPdfBlob(message, finalName) {
  const subject = message.getSubject() || '(sin asunto)';
  const from = message.getFrom() || '';
  const replyTo = message.getReplyTo() || '';
  const date = message.getDate();
  const dateStr = Utilities.formatDate(date, 'America/Argentina/Buenos_Aires', 'dd/MM/yyyy HH:mm');
  let bodyHtml = '';
  let plainBody = '';
  try {
    bodyHtml = message.getBody() || '';
    plainBody = message.getPlainBody() || '';
  } catch (e) {
    bodyHtml = '<p>(no se pudo extraer el body del email)</p>';
  }

  // Extraer todos los URLs del body para listarlos explícitamente
  // (Gemini lee el HTML pero los hipervínculos no siempre los detecta como tales en un PDF rasterizado)
  const urls = [];
  const seen = new Set();
  const urlRegex = /https?:\/\/[^\s"'<>)]+/g;
  let m;
  const combinedText = bodyHtml + ' ' + plainBody;
  while ((m = urlRegex.exec(combinedText)) !== null) {
    let u = m[0];
    // Limpia caracteres comunes de cierre que el regex puede atrapar
    u = u.replace(/[.,;:!?]+$/, '').replace(/&amp;/g, '&');
    if (u.length > 350) continue; // descarta URLs gigantes (tracking, base64 inline)
    if (!seen.has(u)) {
      seen.add(u);
      urls.push(u);
    }
  }

  // Banner explícito + lista de links al final del PDF para que Gemini los vea claros
  const linksHtml = urls.length === 0 ? '' :
    '<div class="links-section"><h2>Links detectados en el email</h2><ol>' +
    urls.slice(0, 30).map(function(u){ return '<li>' + escapeHtml(u) + '</li>'; }).join('') +
    '</ol></div>';

  const html =
    '<!doctype html><html><head><meta charset="utf-8"><style>' +
    'body{font-family:Arial,sans-serif;font-size:13px;color:#000;padding:24px;}' +
    'h1{font-size:18px;margin:0 0 6px 0;}' +
    'h2{font-size:14px;margin:24px 0 8px 0;border-top:2px solid #c8422b;padding-top:12px;}' +
    '.banner{background:#fff3cd;border:2px solid #c8422b;padding:10px 14px;margin-bottom:14px;font-weight:bold;font-size:13px;color:#000;}' +
    '.meta{font-size:11px;color:#444;border-bottom:1px solid #ccc;padding-bottom:8px;margin-bottom:16px;}' +
    '.meta b{color:#000;}' +
    '.body{font-size:13px;}' +
    '.body img{max-width:100%;height:auto;}' +
    '.links-section{margin-top:24px;}' +
    '.links-section ol{padding-left:20px;font-family:Courier,monospace;font-size:10.5px;word-wrap:break-word;}' +
    '.links-section li{margin:3px 0;color:#0057FF;}' +
    '</style></head><body>' +
    '<div class="banner">📩 Este documento se generó del CUERPO DEL EMAIL (el email no traía PDF adjunto). Los datos de la factura están en el texto y los links debajo apuntan al portal del proveedor.</div>' +
    '<h1>' + escapeHtml(subject) + '</h1>' +
    '<div class="meta">' +
      '<b>De:</b> ' + escapeHtml(from) + '<br/>' +
      (replyTo ? '<b>Responder a:</b> ' + escapeHtml(replyTo) + '<br/>' : '') +
      '<b>Fecha:</b> ' + escapeHtml(dateStr) + '<br/>' +
      '<b>Asunto:</b> ' + escapeHtml(subject) +
    '</div>' +
    '<div class="body">' + bodyHtml + '</div>' +
    linksHtml +
    '</body></html>';
  const htmlBlob = Utilities.newBlob(html, 'text/html', finalName + '.html');
  return htmlBlob.getAs('application/pdf').setName(finalName);
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ============ Helper: extrae el sender REAL de un email (forwarded-aware) ============ */
/* Si el email es forwardeado (Fwd:), el getFrom() devuelve quién lo reenvió, no el
   remitente original. Buscamos el "De: <name> <email>" dentro del body para
   identificar al proveedor real (ej. clientes@emails.personal.com.ar). */
function extraerSenderReal(message) {
  const subject = (message.getSubject() || '').trim();
  const fromHeader = message.getFrom() || '';
  const replyTo = message.getReplyTo() || '';
  const plainFromHeader = (fromHeader.match(/<([^>]+)>/) || [, fromHeader])[1].toLowerCase().trim();
  const plainReplyTo = (replyTo.match(/<([^>]+)>/) || [, replyTo])[1].toLowerCase().trim();

  // Caso A: si el From es una cuenta interna (@eldesembarco.com) Y hay un Reply-To externo,
  // el sender REAL es el Reply-To (Prosegur, AFIP, etc. mandan así vía Google Group).
  if (plainFromHeader.includes('eldesembarco.com') && plainReplyTo && !plainReplyTo.includes('eldesembarco.com')) {
    return plainReplyTo;
  }

  // Caso B: subject es Fwd/Re → buscar el sender original en el body.
  const looksForwarded =
    /^(?:fwd:|fw:|re:)/i.test(subject) ||
    /forwarded message/i.test(message.getPlainBody() || '') ||
    /---------- (forwarded message|mensaje reenviado)/i.test(message.getPlainBody() || '');

  if (looksForwarded) {
    const body = message.getPlainBody() || '';
    const patterns = [
      /(?:^|\n)\s*De:\s*[^<\n]*<([\w.+-]+@[\w.-]+\.[a-z]{2,})>/i,
      /(?:^|\n)\s*From:\s*[^<\n]*<([\w.+-]+@[\w.-]+\.[a-z]{2,})>/i,
      /(?:^|\n)\s*De:\s*([\w.+-]+@[\w.-]+\.[a-z]{2,})/i,
      /(?:^|\n)\s*From:\s*([\w.+-]+@[\w.-]+\.[a-z]{2,})/i
    ];
    for (const p of patterns) {
      const m = body.match(p);
      if (m && m[1] && !m[1].toLowerCase().includes('eldesembarco')) {
        return m[1].toLowerCase().trim();
      }
    }
  }

  return plainFromHeader;
}

/* ============ Paso 2: Procesar con filtro inteligente ============ */

function procesarConFiltroInteligente() {
  const facturas = GmailApp.getUserLabelByName(FACTURAS_LABEL);
  if (!facturas) {
    Logger.log('[procesar] No existe la etiqueta "' + FACTURAS_LABEL + '"');
    return;
  }

  const procesadas = GmailApp.getUserLabelByName(PROCESADAS_LABEL) || GmailApp.createLabel(PROCESADAS_LABEL);
  const ignorados  = GmailApp.getUserLabelByName(IGNORADOS_LABEL)  || GmailApp.createLabel(IGNORADOS_LABEL);

  let folder;
  try {
    folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  } catch (e) {
    Logger.log('[procesar] ❌ No pude abrir carpeta Drive: ' + e.message);
    return;
  }

  const query = 'label:' + FACTURAS_LABEL + ' -label:"' + PROCESADAS_LABEL + '" -label:"' + IGNORADOS_LABEL + '"';
  const threads = GmailApp.search(query, 0, 50);
  if (threads.length === 0) {
    Logger.log('[procesar] No hay threads pendientes');
    return;
  }

  const tz = 'America/Argentina/Buenos_Aires';
  let stats = { pass: 0, block: 0, unclear_to_gemini: 0, uploaded: 0 };

  for (const thread of threads) {
    const messages = thread.getMessages();
    const firstMsg = messages[0];
    const subject = (firstMsg.getSubject() || '').toLowerCase();
    // Sender real: si el email es forwardeado, extraemos el remitente original del body
    // (ej. clientes@emails.personal.com.ar en lugar de admeldesembarco@gmail.com)
    const senderReal = extraerSenderReal(firstMsg);
    const sender = senderReal || (firstMsg.getFrom() || '').toLowerCase();

    // Recopilo todos los nombres de adjuntos PDF
    const filenames = [];
    for (const msg of messages) {
      const atts = msg.getAttachments({ includeInlineImages: false });
      for (const att of atts) {
        const name = (att.getName() || '').toLowerCase();
        if (name.endsWith('.pdf') || (att.getContentType() || '').toLowerCase().indexOf('pdf') >= 0) {
          filenames.push(name);
        }
      }
    }

    // Capa 1: heurística
    let result = clasificarHeuristica(subject, sender, filenames);
    let layer = 1;

    // Capa 2: si la heurística no decide, preguntar a Gemini Flash con metadata
    if (result.decision === 'unclear') {
      stats.unclear_to_gemini++;
      const gemini = clasificarConGemini(subject, sender, filenames);
      result = gemini;
      layer = 2;
    }

    if (result.decision === 'block') {
      ignorados.addToThread(thread);
      stats.block++;
      Logger.log('  🚫 IGNORADO [' + layer + '] "' + subject.slice(0, 60) + '" — ' + result.razon);
      logFilterDecision(thread, sender, firstMsg.getSubject(), 'block', result.razon, layer, 0);
      continue;
    }

    // decision === 'pass' → subir PDFs
    // Sender real ya viene como email puro (extraerSenderReal lo limpia).
    // Lo codificamos para incrustarlo en el filename del PDF (n8n lo extrae con regex).
    const senderPlain = senderReal;
    const senderEncoded = senderPlain
      .replace(/@/g, '_at_')
      .replace(/\./g, '_dot_')
      .replace(/[^a-z0-9_-]/g, '');

    let uploadedThisThread = 0;
    let hadPdfAttachment = false;
    for (const msg of messages) {
      const atts = msg.getAttachments({ includeInlineImages: false });
      for (const att of atts) {
        const name = att.getName() || 'factura.pdf';
        const isPdf = name.toLowerCase().endsWith('.pdf') || (att.getContentType() || '').toLowerCase().indexOf('pdf') >= 0;
        if (!isPdf) continue;
        hadPdfAttachment = true;
        try {
          const ts = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd_HHmm');
          // Formato: TIMESTAMP__from_SENDER__nombre.pdf  → n8n parsea el sender de acá
          const finalName = ts + '__from_' + senderEncoded + '__' + name;
          folder.createFile(att.copyBlob().setName(finalName));
          uploadedThisThread++;
        } catch (e) {
          Logger.log('  ❌ Error subiendo "' + name + '": ' + e.message);
        }
      }
    }

    // Si el thread NO tenía PDF adjunto, generamos uno a partir del body del email.
    // Caso típico: Personal/Movistar/Edenred mandan email con monto y vencimiento en el cuerpo
    // y un link al portal — Gemini Vision lee ese PDF generado y extrae los datos igual.
    if (!hadPdfAttachment) {
      try {
        const ts = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd_HHmm');
        const finalName = ts + '__from_' + senderEncoded + '__email_body.pdf';
        const pdfBlob = emailBodyToPdfBlob(firstMsg, finalName);
        folder.createFile(pdfBlob);
        uploadedThisThread++;
        Logger.log('  📩 Sin PDF adjunto — generé PDF del body del email: ' + finalName);
      } catch (e) {
        Logger.log('  ❌ Error generando PDF del body: ' + e.message);
      }
    }
    procesadas.addToThread(thread);
    stats.pass++;
    stats.uploaded += uploadedThisThread;
    Logger.log('  ✅ PASA    [' + layer + '] "' + subject.slice(0, 60) + '" — ' + uploadedThisThread + ' PDF(s) → Drive — ' + result.razon);
    logFilterDecision(thread, sender, firstMsg.getSubject(), 'pass', result.razon, layer, uploadedThisThread);
  }

  Logger.log('[procesar] Total threads=' + threads.length +
             ' · pass=' + stats.pass +
             ' · block=' + stats.block +
             ' · gemini-calls=' + stats.unclear_to_gemini +
             ' · pdfs-subidos=' + stats.uploaded);
}

/* ============ Capa 1: Heurística ============ */

function clasificarHeuristica(subject, sender, filenames) {
  // Allowlist sender → pass directo
  for (const a of SENDER_ALLOWLIST) {
    if (sender.indexOf(a) >= 0) {
      return { decision: 'pass', razon: 'sender allowlist (' + a + ')', score: 10 };
    }
  }
  // Denylist sender → block directo
  for (const d of SENDER_DENYLIST) {
    if (sender.indexOf(d) >= 0) {
      return { decision: 'block', razon: 'sender denylist (' + d + ')', score: -10 };
    }
  }

  // Score por keywords
  let score = 0;
  const reasons = [];

  for (const k of KW_POSITIVOS) {
    if (subject.indexOf(k) >= 0) { score += 2; reasons.push('subj+:' + k.trim()); break; }
  }
  for (const k of KW_NEGATIVOS) {
    if (subject.indexOf(k) >= 0) { score -= 3; reasons.push('subj-:' + k.trim()); break; }
  }
  for (const fn of filenames) {
    let posHit = false, negHit = false;
    for (const k of FN_POSITIVOS) if (!posHit && fn.indexOf(k) >= 0) { score += 2; reasons.push('fn+:' + k); posHit = true; }
    for (const k of FN_NEGATIVOS) if (!negHit && fn.indexOf(k) >= 0) { score -= 3; reasons.push('fn-:' + k); negHit = true; }
    if (posHit || negHit) break;
  }

  // PDFs muy pesados (> 5 MB) raramente son facturas — peso lo agregamos como fallback
  // (no calculo aquí porque encarece, queda comentado para futuro)

  if (score >= 2)  return { decision: 'pass',    razon: reasons.join(', '), score };
  if (score <= -2) return { decision: 'block',   razon: reasons.join(', '), score };
  return            { decision: 'unclear', razon: reasons.length ? reasons.join(', ') : 'sin señales claras', score };
}

/* ============ Capa 2: Gemini Flash con metadata ============ */

function clasificarConGemini(subject, sender, filenames) {
  if (!GEMINI_API_KEY) {
    return { decision: 'pass', razon: 'capa 2 deshabilitada (sin API key) → pasa por default', score: 0 };
  }

  const prompt = 'Recibimos un email a una casilla corporativa que recibe MUCHOS emails de todo tipo, ' +
    'pero nos interesan SOLO los que contienen una factura/boleta de servicio (luz, gas, agua, internet, ' +
    'teléfono, alquiler, ABL, expensas, alarma, AFIP, ARBA, AGIP, seguros, expensas) o un comprobante de pago.\n\n' +
    'Email recibido:\n' +
    '- Remitente: ' + sender + '\n' +
    '- Asunto: ' + subject + '\n' +
    '- Adjuntos (PDFs): ' + (filenames.length ? filenames.join(', ') : '(sin nombre relevante)') + '\n\n' +
    'Responde SOLO JSON con: {"es_factura_o_recibo": boolean, "confianza": número 0..1, "razon": "frase corta"}.';

  try {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_FLASH_MODEL + ':generateContent?key=' + GEMINI_API_KEY;
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              es_factura_o_recibo: { type: 'boolean' },
              confianza: { type: 'number' },
              razon: { type: 'string' }
            },
            required: ['es_factura_o_recibo', 'confianza']
          }
        }
      })
    });
    if (response.getResponseCode() !== 200) {
      Logger.log('[capa 2] Gemini error ' + response.getResponseCode() + ': ' + response.getContentText().slice(0, 300));
      return { decision: 'pass', razon: 'gemini error → pass por seguridad', score: 0 };
    }
    const data = JSON.parse(response.getContentText());
    const text = data.candidates && data.candidates[0] && data.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(text);
    return {
      decision: parsed.es_factura_o_recibo ? 'pass' : 'block',
      razon: 'gemini(' + parsed.confianza.toFixed(2) + '): ' + (parsed.razon || ''),
      score: parsed.es_factura_o_recibo ? 5 : -5
    };
  } catch (e) {
    Logger.log('[capa 2] Exception: ' + e.message);
    return { decision: 'pass', razon: 'gemini exception → pass por seguridad', score: 0 };
  }
}

/* ============ Logging ============ */

function logFilterDecision(thread, sender, subject, decision, razon, layer, uploaded) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sh = ss.getSheetByName(FILTER_LOG_SHEET_NAME);
    if (!sh) {
      sh = ss.insertSheet(FILTER_LOG_SHEET_NAME);
      sh.appendRow(['fecha','sender','subject','decision','layer','razon','pdfs_subidos','threadId']);
      sh.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#f0f0f0');
      sh.setFrozenRows(1);
    }
    sh.appendRow([
      new Date(),
      sender,
      subject,
      decision,
      'capa-' + layer,
      razon,
      uploaded,
      thread.getId()
    ]);
  } catch (e) {
    Logger.log('[log] No pude loguear decisión: ' + e.message);
  }
}

/* ============ UTILIDADES PARA PROBAR Y AJUSTAR ============ */

/**
 * Test del filtro sin etiquetar ni subir nada.
 * Mira los últimos 20 emails con PDF y muestra qué decisión tomaría el filtro.
 * Útil para afinar listas viendo los Logger.log.
 */
function testFiltroDryRun() {
  const query = 'has:attachment filename:pdf newer_than:14d';
  const threads = GmailApp.search(query, 0, 20);
  Logger.log('=== DRY RUN sobre ' + threads.length + ' threads ===');
  for (const thread of threads) {
    const m = thread.getMessages()[0];
    const subject = (m.getSubject() || '').toLowerCase();
    const sender = (m.getFrom() || '').toLowerCase();
    const filenames = [];
    for (const msg of thread.getMessages()) {
      const atts = msg.getAttachments({ includeInlineImages: false });
      for (const att of atts) filenames.push((att.getName() || '').toLowerCase());
    }
    let r = clasificarHeuristica(subject, sender, filenames);
    let layer = 1;
    if (r.decision === 'unclear') {
      r = clasificarConGemini(subject, sender, filenames);
      layer = 2;
    }
    const icon = r.decision === 'pass' ? '✅' : r.decision === 'block' ? '🚫' : '❓';
    Logger.log(icon + ' [' + layer + '] "' + (m.getSubject() || '').slice(0, 70) + '"');
    Logger.log('     de: ' + sender);
    Logger.log('     adj: ' + filenames.join(', '));
    Logger.log('     → ' + r.decision.toUpperCase() + ' — ' + r.razon);
  }
}

/**
 * Re-procesar emails que quedaron en "Facturas Ignoradas" pero sospechás que eran facturas reales.
 * Les saca el label de Ignorados y los devuelve a Facturas para reprocesar.
 * Útil cuando ajustás listas y querés re-evaluar viejos.
 */
function reprocesarIgnorados(maxThreads) {
  const ignorados = GmailApp.getUserLabelByName(IGNORADOS_LABEL);
  const facturas = GmailApp.getUserLabelByName(FACTURAS_LABEL);
  if (!ignorados || !facturas) {
    Logger.log('Faltan labels');
    return;
  }
  const threads = GmailApp.search('label:"' + IGNORADOS_LABEL + '"', 0, maxThreads || 30);
  for (const t of threads) {
    ignorados.removeFromThread(t);
    facturas.addToThread(t);
  }
  Logger.log('Re-encolados ' + threads.length + ' thread(s) para reprocesar');
}

/**
 * BACKFILL: corre el procesamiento sin límite de fecha sobre todo lo que tenga el label "Facturas".
 */
function procesarBackfillCompleto() {
  procesarConFiltroInteligente();
}
