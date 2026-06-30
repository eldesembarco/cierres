/**
 * Prepara la hoja RevisionQueue para el flujo de revisión manual.
 *  - Asegura que exista la columna "resuelto" al final del header
 *  - Seedea 3 casos de prueba realistas
 *
 * Cómo correrlo:
 *  1. Abrí el Sheet (ID: 1kVXml8QlQiYlyjU87WnglQQHDjpWeRApHWFajn3Qlvo)
 *  2. Extensiones → Apps Script → pegá este archivo (en el mismo proyecto del seed anterior o uno nuevo)
 *  3. Ejecutar seedRevision → autorizá
 */

const SHEET_ID_REV = '1kVXml8QlQiYlyjU87WnglQQHDjpWeRApHWFajn3Qlvo';

function seedRevision() {
  const ss = SpreadsheetApp.openById(SHEET_ID_REV);
  const sh = ss.getSheetByName('RevisionQueue');
  if (!sh) throw new Error('No existe la hoja "RevisionQueue"');

  // 1) Asegurar columna "resuelto" al final del header
  const lastCol = sh.getLastColumn();
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  if (!headers.includes('resuelto')) {
    sh.getRange(1, lastCol + 1).setValue('resuelto');
    sh.getRange(1, lastCol + 1).setFontWeight('bold').setBackground('#f0f0f0');
    Logger.log('➕ Columna "resuelto" agregada en col ' + (lastCol + 1));
  }
  if (!headers.includes('resolved_at')) {
    const col = headers.includes('resuelto') ? lastCol + 1 : lastCol + 2;
    sh.getRange(1, col).setValue('resolved_at');
    sh.getRange(1, col).setFontWeight('bold').setBackground('#f0f0f0');
    Logger.log('➕ Columna "resolved_at" agregada en col ' + col);
  }

  // 2) Si ya hay filas seedadas, skip
  if (sh.getLastRow() > 1) {
    Logger.log('⚠️  RevisionQueue ya tiene filas. No se seedea de nuevo.');
    return;
  }

  const now = new Date().toISOString();
  // Re-leer headers después del append
  const fullHeaders = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];

  const rows = [
    {
      id: 'REV-0001',
      pdf_url: 'https://drive.google.com/file/d/TEST_PDF_001/view',
      campos_extraidos: JSON.stringify({
        monto: 87340.55,
        vence: '2026-04-30',
        cliente: '88123456789',
        titular: 'Ogaviero SRL',
        servicio_detectado: 'Metrogas',
        local_detectado: null
      }),
      motivo: 'Local no identificado — dirección en PDF no matchea con ningún local activo',
      ia_confianza: 0.62,
      created_at: now,
      resuelto: 'FALSE',
      resolved_at: ''
    },
    {
      id: 'REV-0002',
      pdf_url: 'https://drive.google.com/file/d/TEST_PDF_002/view',
      campos_extraidos: JSON.stringify({
        monto: 15200,
        vence: '2026-05-05',
        cliente: '4120-99887766',
        titular: 'El Desembarco S.A.',
        servicio_detectado: 'Servicio nuevo (desconocido)',
        local_detectado: 'Nuñez'
      }),
      motivo: 'Servicio no reconocido — no está en catálogo de Servicios',
      ia_confianza: 0.48,
      created_at: now,
      resuelto: 'FALSE',
      resolved_at: ''
    },
    {
      id: 'REV-0003',
      pdf_url: 'https://drive.google.com/file/d/TEST_PDF_003/view',
      campos_extraidos: JSON.stringify({
        monto: 234890.17,
        vence: '2026-04-28',
        cliente: '0011-2233-4455',
        titular: null,
        servicio_detectado: 'Edesur',
        local_detectado: null
      }),
      motivo: 'Baja confianza en extracción — PDF con escaneo parcial',
      ia_confianza: 0.71,
      created_at: now,
      resuelto: 'FALSE',
      resolved_at: ''
    }
  ];

  const values = rows.map(r => fullHeaders.map(h => r[h] != null ? r[h] : ''));
  sh.getRange(2, 1, values.length, fullHeaders.length).setValues(values);

  Logger.log('✅ Seeded ' + values.length + ' filas pendientes en RevisionQueue');
  Logger.log('URL: ' + ss.getUrl());
}
