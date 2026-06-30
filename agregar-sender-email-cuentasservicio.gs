/**
 * Agrega la columna `sender_email` a la hoja CuentasServicio del Sheet principal.
 * Esa columna habilita el self-learning por remitente — cuando el usuario confirma
 * una revisión, n8n guarda ahí el email del que vino la factura para matchear futuras.
 *
 * Cómo correrlo:
 *  1. Abrí el Sheet: https://docs.google.com/spreadsheets/d/1kVXml8QlQiYlyjU87WnglQQHDjpWeRApHWFajn3Qlvo/edit
 *  2. Extensiones → Apps Script
 *  3. Pegá este archivo y guardá
 *  4. Ejecutá `agregarColumnaSenderEmail` → autorizar
 *  5. Verificá en CuentasServicio que aparezca la columna nueva al final
 */

const SHEET_ID_SENDER = '1kVXml8QlQiYlyjU87WnglQQHDjpWeRApHWFajn3Qlvo';

function agregarColumnaSenderEmail() {
  const ss = SpreadsheetApp.openById(SHEET_ID_SENDER);
  const sh = ss.getSheetByName('CuentasServicio');
  if (!sh) throw new Error('No existe la hoja "CuentasServicio"');

  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];

  if (!headers.includes('sender_email')) {
    const newCol = sh.getLastColumn() + 1;
    sh.getRange(1, newCol).setValue('sender_email').setFontWeight('bold').setBackground('#f0f0f0');
    Logger.log('➕ Columna "sender_email" agregada en posición ' + newCol);
  } else {
    Logger.log('= Columna "sender_email" ya existía');
  }
}
