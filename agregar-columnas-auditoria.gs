/**
 * Agrega columnas de auditoría (created_by, updated_by) a la hoja Facturas
 * del Sheet principal.
 *
 * Cómo correrlo:
 *  1. Abrí el Sheet principal: https://docs.google.com/spreadsheets/d/1kVXml8QlQiYlyjU87WnglQQHDjpWeRApHWFajn3Qlvo/edit
 *  2. Extensiones → Apps Script
 *  3. Pegá este código (o creá un proyecto nuevo)
 *  4. Ejecutá `agregarColumnasAuditoria` → autorizar
 *  5. Verificá en Facturas que aparezcan las 2 columnas nuevas al final
 */

const SHEET_ID_AUD = '1kVXml8QlQiYlyjU87WnglQQHDjpWeRApHWFajn3Qlvo';

function agregarColumnasAuditoria() {
  const ss = SpreadsheetApp.openById(SHEET_ID_AUD);
  const sh = ss.getSheetByName('Facturas');
  if (!sh) throw new Error('No existe la hoja "Facturas"');

  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  let added = 0;

  ['created_by', 'updated_by'].forEach(function (colName) {
    if (!headers.includes(colName)) {
      const newCol = sh.getLastColumn() + 1;
      sh.getRange(1, newCol).setValue(colName).setFontWeight('bold').setBackground('#f0f0f0');
      added++;
      Logger.log('➕ Columna "' + colName + '" agregada en posición ' + newCol);
    } else {
      Logger.log('= Columna "' + colName + '" ya existía');
    }
  });

  if (added === 0) {
    Logger.log('Nada para agregar — todas las columnas ya existen.');
  } else {
    Logger.log('✅ ' + added + ' columna(s) agregada(s).');
  }
}
