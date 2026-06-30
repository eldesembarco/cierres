/**
 * Etiqueta automáticamente como "Facturas" cualquier email recibido
 * con adjunto PDF (últimos 7 días, no etiquetado todavía).
 *
 * Más confiable que los filtros nativos de Gmail.
 * Pensado para correr como trigger time-driven cada 2-5 min.
 *
 * SETUP en script.google.com (loggeado como sistemas@eldesembarco.com):
 *  1. https://script.google.com → "Nuevo proyecto"
 *  2. Borrar el código vacío y pegar TODO este archivo
 *  3. Ctrl+S para guardar (poné cualquier nombre, ej. "Etiquetador Facturas")
 *  4. Arriba seleccioná la función "etiquetarFacturas" → click "Ejecutar"
 *  5. La primera vez te pide permisos → autorizar (la cuenta debe ser sistemas@)
 *  6. Mirá el panel de Registros (Ctrl+Enter) — debería decir cuántos etiquetó
 *
 * TRIGGER AUTOMÁTICO (para que corra solo cada 2 min):
 *  7. En la barra izquierda click el ícono de reloj ⏰ "Activadores"
 *  8. Click "Agregar activador" (abajo derecha)
 *      - Función: etiquetarFacturas
 *      - Implementación: Cabeza
 *      - Origen del evento: Basado en el tiempo
 *      - Tipo: Temporizador por minutos
 *      - Cada: 5 minutos
 *  9. Guardar
 *
 * Listo. A partir de ahora cada 5 min revisa los últimos 7 días y etiqueta lo nuevo.
 */

const LABEL_NAME = 'Facturas';

function etiquetarFacturas() {
  // 1. Obtener (o crear) la etiqueta
  let label = GmailApp.getUserLabelByName(LABEL_NAME);
  if (!label) {
    label = GmailApp.createLabel(LABEL_NAME);
    Logger.log('➕ Etiqueta "' + LABEL_NAME + '" creada');
  }

  // 2. Buscar threads con PDF adjunto NO etiquetados (últimos 7 días)
  // 'newer_than:7d' limita la ventana para no escanear todo el historial
  const query = 'has:attachment filename:pdf newer_than:7d -label:' + LABEL_NAME;
  const threads = GmailApp.search(query, 0, 100);

  if (threads.length === 0) {
    Logger.log('Nada para etiquetar. Query: "' + query + '"');
    return;
  }

  // 3. Aplicar etiqueta en batch
  label.addToThreads(threads);

  // 4. Log para auditoría
  Logger.log('✅ ' + threads.length + ' thread(s) etiquetado(s) como "' + LABEL_NAME + '":');
  threads.forEach(function (thread, i) {
    const msg = thread.getMessages()[0];
    const subject = msg.getSubject() || '(sin asunto)';
    const from = msg.getFrom();
    const attachments = msg.getAttachments({ includeInlineImages: false }).map(function (a) { return a.getName(); }).join(', ');
    Logger.log('  ' + (i + 1) + '. "' + subject + '" — de: ' + from + ' — adjuntos: ' + attachments);
  });
}

/**
 * BONUS: ejecutalo manualmente para etiquetar emails VIEJOS
 * (más allá de los 7 días) que ya estén en la inbox.
 *
 * Pone la etiqueta a TODOS los emails con PDF adjunto sin etiqueta,
 * sin importar la fecha. Útil para backfill inicial.
 */
function etiquetarFacturasBackfillCompleto() {
  let label = GmailApp.getUserLabelByName(LABEL_NAME);
  if (!label) label = GmailApp.createLabel(LABEL_NAME);

  const query = 'has:attachment filename:pdf -label:' + LABEL_NAME;
  let total = 0;
  let start = 0;
  const pageSize = 100;

  // Loop por páginas (Gmail Search devuelve max 500 por query)
  while (start < 500) {
    const threads = GmailApp.search(query, start, pageSize);
    if (threads.length === 0) break;
    label.addToThreads(threads);
    total += threads.length;
    if (threads.length < pageSize) break;
    start += pageSize;
  }

  Logger.log('✅ Backfill completo: ' + total + ' thread(s) etiquetado(s).');
}
