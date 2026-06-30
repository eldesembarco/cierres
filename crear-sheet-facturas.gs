/**
 * Crea el Google Sheet "Facturas Servicios - El Desembarco" con toda la estructura
 * y los maestros poblados (18 locales, 28 servicios).
 *
 * Cómo correrlo:
 *  1. Andá a https://script.google.com (logueado como polejavetzky@eldesembarco.com)
 *  2. Nuevo proyecto → pegá este archivo entero
 *  3. Guardá (Ctrl+S) → Ejecutar → autorizá permisos
 *  4. Al terminar mirá los logs (Ver → Registros) — te da la URL y el ID del Sheet
 */

function crearSheetFacturas() {
  const ss = SpreadsheetApp.create('Facturas Servicios - El Desembarco');
  const sheetId = ss.getId();
  const sheetUrl = ss.getUrl();

  // Borrar hoja default "Sheet1"
  const defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Hoja 1');

  // ────────── 1. FACTURAS (tabla principal) ──────────
  const facturas = ss.insertSheet('Facturas');
  const facturasHeaders = [
    'id', 'mes', 'local', 'servicio', 'monto', 'vence',
    'estado', 'pago', 'forma',
    'cliente', 'titular', 'tel', 'user', 'pass', 'obs',
    'pdf_url', 'ia_confianza', 'ia_revisado',
    'created_at', 'updated_at'
  ];
  facturas.getRange(1, 1, 1, facturasHeaders.length).setValues([facturasHeaders]);
  facturas.setFrozenRows(1);
  facturas.getRange(1, 1, 1, facturasHeaders.length).setFontWeight('bold').setBackground('#f0f0f0');

  // ────────── 2. PAGOS (historial) ──────────
  const pagos = ss.insertSheet('Pagos');
  const pagosHeaders = ['id', 'factura_id', 'fecha', 'monto', 'forma', 'nota', 'usuario', 'created_at'];
  pagos.getRange(1, 1, 1, pagosHeaders.length).setValues([pagosHeaders]);
  pagos.setFrozenRows(1);
  pagos.getRange(1, 1, 1, pagosHeaders.length).setFontWeight('bold').setBackground('#f0f0f0');

  // ────────── 3. LOCALES (maestro) ──────────
  const locales = ss.insertSheet('Locales');
  locales.getRange(1, 1, 1, 4).setValues([['nombre', 'marca', 'direccion', 'activo']]);
  locales.setFrozenRows(1);
  locales.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#f0f0f0');

  const LOCALES = [
    ['Anexo', 'Desembarco', '', 'TRUE'],
    ['Boedo', 'Desembarco', '', 'TRUE'],
    ['CDP', 'Desembarco', '', 'TRUE'],
    ['Depto', 'Desembarco', '', 'TRUE'],
    ['Devoto', 'Desembarco', '', 'TRUE'],
    ['Hurlingham', 'Desembarco', '', 'TRUE'],
    ['Microcentro', 'Desembarco', '', 'TRUE'],
    ['Moron', 'Desembarco', '', 'TRUE'],
    ['Mr Tasty Caballito', 'Mr Tasty', '', 'TRUE'],
    ['Mr Tasty Florida', 'Mr Tasty', '', 'TRUE'],
    ['Nuñez', 'Desembarco', '', 'TRUE'],
    ['Olivos', 'Desembarco', '', 'TRUE'],
    ['Pacifico', 'Desembarco', '', 'TRUE'],
    ['Ramos', 'Desembarco', '', 'TRUE'],
    ['Recoleta', 'Desembarco', '', 'TRUE'],
    ['San Telmo', 'Desembarco', '', 'TRUE'],
    ['Urquiza', 'Desembarco', '', 'TRUE'],
    ['Villa Crespo', 'Desembarco', '', 'TRUE']
  ];
  locales.getRange(2, 1, LOCALES.length, 4).setValues(LOCALES);

  // ────────── 4. SERVICIOS (maestro) ──────────
  const servicios = ss.insertSheet('Servicios');
  servicios.getRange(1, 1, 1, 3).setValues([['nombre', 'categoria', 'url_portal']]);
  servicios.setFrozenRows(1);
  servicios.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#f0f0f0');

  const SERVICIOS = [
    ['Agip', 'Impuestos', ''],
    ['Agip ABL', 'Impuestos', ''],
    ['Alarma', 'Seguridad', ''],
    ['Alianz (Foton)', 'Seguros', ''],
    ['Alquiler', 'Inmueble', ''],
    ['Arba', 'Impuestos', ''],
    ['Aysa', 'Agua', ''],
    ['Celular', 'Conectividad', ''],
    ['Comaco', 'Seguridad', ''],
    ['Edenor', 'Energía', ''],
    ['Edesur', 'Energía', ''],
    ['Expensas', 'Inmueble', ''],
    ['Federacion Patronal (Daily)', 'Seguros', ''],
    ['Galicia Seguros (Daily)', 'Seguros', ''],
    ['Ihsa Emergencias', 'Seguridad', ''],
    ['Mapfree (Diego)', 'Seguros', ''],
    ['Metrogas', 'Gas', ''],
    ['Movistar', 'Conectividad', ''],
    ['Municipal', 'Impuestos', ''],
    ['Naturgy', 'Gas', ''],
    ['Personal', 'Conectividad', ''],
    ['Prosegur', 'Seguridad', ''],
    ['Seguro', 'Seguros', ''],
    ['Sistema', 'Sistemas', ''],
    ['Strix (Satelital)', 'Seguridad', ''],
    ['Telecentro', 'Conectividad', ''],
    ['Uthgra', 'Impuestos', ''],
    ['Zurich (Tector)', 'Seguros', '']
  ];
  servicios.getRange(2, 1, SERVICIOS.length, 3).setValues(SERVICIOS);

  // ────────── 5. CuentasServicio (matching + credenciales) ──────────
  const cuentas = ss.insertSheet('CuentasServicio');
  const cuentasHeaders = ['local', 'servicio', 'n_cliente', 'titular', 'user', 'pass', 'tel', 'obs'];
  cuentas.getRange(1, 1, 1, cuentasHeaders.length).setValues([cuentasHeaders]);
  cuentas.setFrozenRows(1);
  cuentas.getRange(1, 1, 1, cuentasHeaders.length).setFontWeight('bold').setBackground('#f0f0f0');

  // ────────── 6. RevisionQueue (cola IA) ──────────
  const revision = ss.insertSheet('RevisionQueue');
  const revisionHeaders = ['id', 'pdf_url', 'campos_extraidos', 'motivo', 'ia_confianza', 'created_at'];
  revision.getRange(1, 1, 1, revisionHeaders.length).setValues([revisionHeaders]);
  revision.setFrozenRows(1);
  revision.getRange(1, 1, 1, revisionHeaders.length).setFontWeight('bold').setBackground('#f0f0f0');

  // Borrar hoja default si sigue existiendo
  if (defaultSheet) ss.deleteSheet(defaultSheet);

  // Dejar Facturas como activa
  ss.setActiveSheet(facturas);

  Logger.log('✅ Sheet creado');
  Logger.log('ID: ' + sheetId);
  Logger.log('URL: ' + sheetUrl);
  return { id: sheetId, url: sheetUrl };
}
