// ============================================================
// Test local del bug "Reporte por Local" (Apps Script Web App)
// Reproduce el blanco en vivo y verifica el fix sin redeployar.
//   node test.mjs
// ============================================================
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert';

const TEMPLATE_PATH = 'C:\\Users\\ferra\\Servicios\\reporte-por-local\\template.html';
const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');

const line = (s) => console.log(s);
const ok = (s) => console.log('  [OK]   ' + s);
const fail = (s) => console.log('  [FAIL] ' + s);

// separadores de linea unicode (construidos en ASCII, sin literales)
const LS = String.fromCharCode(0x2028);   // U+2028 LINE SEPARATOR
const PS = String.fromCharCode(0x2029);   // U+2029 PARAGRAPH SEPARATOR

// ── Datos de ejemplo con TODOS los casos peligrosos ───────────
// Incluye: $1 $& $` $' $$ (refs de regex), </script>, < > &, backslash,
// comillas, y los separadores de linea unicode U+2028 / U+2029.
const PELIGRO =
  'Precio $1.500 y $200 | refs $& $\' $` $$ $1 | etiqueta </script><b>x</b> | ' +
  '5<3 & 7>2 | ruta C:\\temp\\new\\foo | "comillas" \'simples\' | sep ' + LS + ' y ' + PS + ' fin';

const data = {
  LOCALS: [
    { uni_nombre: 'El Desembarco - Núñez', tipo: 'Propio', supervisor: 'José',
      ids: { peya: 'p1', rappi: 'r1', turbo: 't1', meli: 'm1' } },
    { uni_nombre: 'Mila & Go - Núñez <test>', tipo: 'Franquicia', supervisor: 'María',
      ids: { peya: 'p2', rappi: '', turbo: '', meli: 'm2' } },
  ],
  KPI_SERIES: { 'El Desembarco - Núñez': { peya: { S20: { rec: 3, rcl: 1, prep: 0, nodq: 2, mins: 5 } } } },
  REASONS: { 'El Desembarco - Núñez': { 20: { PeYa: { Rechazos: [{ name: PELIGRO, total: 7 }] } } } },
  META: { semanas: ['S19', 'S20'], semana_actual: 'S20', plataformas: ['peya', 'rappi', 'turbo', 'meli'],
          plataformas_con_razones: ['peya', 'meli'] },
  OPERACIONES: { 'Núñez': ['El Desembarco - Núñez', 'Mila & Go - Núñez <test>'] },
  COMMENTS: { 'El Desembarco - Núñez': { peya: { 20: [{ fecha: '2026-05-01', motivo: 'demora', texto: PELIGRO }] } } },
  AUDIT_RUBRICA: { 'Conexión': [{ ini: 0, fin: 'inf', pts: 100 }] },
  MARCA_ACTIVA: null,
};

// ── safeJson: v52 (la deployada) vs fix propuesto ─────────────
function safeJson_v52(v) {
  return JSON.stringify(v).replace(/<\/script>/gi, '<\\/script>').replace(/\*\//g, '*\\/');
}
function safeJson_fix(v) {
  return JSON.stringify(v)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(new RegExp('\\u2028', 'g'), '\\u2028')
    .replace(new RegExp('\\u2029', 'g'), '\\u2029');
}

// ── Cómo un browser extrae el contenido del <script> inline ───
// Lee desde el 2º "<script>" (datos) hasta el próximo "</script>",
// o, si no existe, hasta EOF (arrastrando </body></html>).
function extractInlineScript(html) {
  const firstClose = html.indexOf('</script>');                 // cierre del Chart.js (linea 7)
  const open = html.indexOf('<script>', firstClose);            // 2o <script> (datos)
  const start = open + '<script>'.length;
  const close = html.toLowerCase().indexOf('</script>', start);
  return { body: close === -1 ? html.slice(start) : html.slice(start, close), closed: close !== -1 };
}

// ════════════════════════════════════════════════════════════
// (A) REPRODUCIR EL BLANCO ACTUAL (template tal cual, sin </script>)
// ════════════════════════════════════════════════════════════
line('\n[A] Reproduccion del blanco en vivo (template actual)');
{
  const { body, closed } = extractInlineScript(template);
  line('    El <script> de datos cierra con </script>? -> ' + (closed ? 'SI' : 'NO'));
  let threw = null;
  try { new Function(body); } catch (e) { threw = e; }
  if (!closed && threw) {
    ok('El browser arrastra </body></html> al JS y revienta: ' + threw.constructor.name + ': ' + threw.message);
    ok('=> SyntaxError mata todo el <script>: PLAT_CONF/LOCALS/init quedan undefined => BLANCO. Bug reproducido.');
  } else if (closed) {
    fail('El template ya tenia </script> (no reproduje el bug estructural).');
  } else {
    fail('Sin </script> pero new Function no tiro error (revisar).');
  }
}

// ════════════════════════════════════════════════════════════
// (B) BUG DEL "$" : string-replace (v52) vs función (fix)
// ════════════════════════════════════════════════════════════
line('\n[B] Bug del "$" en template.replace');
{
  const reTest = /const\s+REASONS\s*=\s*\/\*\{\{DATA_REASONS\}\}\*\/\s*(\[\]|\{\}|null)\s*;/;
  const placeholder = 'const REASONS    = /*{{DATA_REASONS}}*/{};';

  const repV52 = 'const REASONS = ' + safeJson_v52(data.REASONS) + ';';
  const outV52 = placeholder.replace(reTest, repV52);                 // STRING replace (v52)
  const jsonFix = safeJson_fix(data.REASONS);
  const outFix = placeholder.replace(reTest, () => 'const REASONS = ' + jsonFix + ';'); // FUNCTION replace (fix)

  const v52Conserva = outV52.includes('$&') && outV52.includes('$`') && outV52.includes("$'");
  if (!v52Conserva) ok('v52 (string replace): los "$&"/"$`"/"$\'" del dato fueron alterados => JSON corrupto.');
  else fail('v52 no mostro corrupcion (revisar caso).');

  let fixParsea = false, fixIgual = false;
  try {
    const jsonText = outFix.replace(/^const REASONS = /, '').replace(/;$/, '');
    const back = JSON.parse(jsonText);
    fixParsea = true;
    fixIgual = JSON.stringify(back) === JSON.stringify(data.REASONS);
  } catch { /* no-op */ }
  if (fixParsea && fixIgual) ok('fix (function replace): "$" quedan literales; JSON.parse devuelve EXACTAMENTE el dato.');
  else fail('fix no preservo el dato (parsea=' + fixParsea + ', igual=' + fixIgual + ').');
}

// ════════════════════════════════════════════════════════════
// (C) EL FIX COMPLETO: parsea + datos intactos + EJECUTA
// ════════════════════════════════════════════════════════════
line('\n[C] Verificacion del fix completo (template + buildHtml corregidos)');

// Fix 1: cerrar el <script> antes de </body>
const templateFix = template.replace(/\n<\/body>/, '\n</script>\n</body>');

// Fix 2: buildHtml correcto (escape <>& + función de reemplazo + return)
function buildHtmlFixed(tpl, d) {
  if (!('MARCA_ACTIVA' in d)) d.MARCA_ACTIVA = null;
  Object.keys(d).forEach((key) => {
    const re = new RegExp('const\\s+' + key + '\\s*=\\s*/\\*\\{\\{DATA_' + key + '\\}\\}\\*/\\s*(\\[\\]|\\{\\}|null)\\s*;');
    const json = safeJson_fix(d[key]);
    tpl = tpl.replace(re, () => 'const ' + key + ' = ' + json + ';');
  });
  return tpl;
}

const html = buildHtmlFixed(templateFix, JSON.parse(JSON.stringify(data)));

// C.0 — no quedan placeholders crudos
{
  const sobran = html.match(/\{\{DATA_\w+\}\}/g);
  if (!sobran) ok('No quedan placeholders {{DATA_*}} sin reemplazar.');
  else fail('Quedaron placeholders: ' + sobran.join(', '));
}

// C.1 — el <script> ahora cierra y PARSEA
const { body, closed } = extractInlineScript(html);
{
  if (!closed) { fail('El <script> sigue sin cerrar tras el fix.'); }
  else {
    let threw = null;
    try { new Function(body); } catch (e) { threw = e; }
    if (!threw) ok('El <script> cierra con </script> y new Function() PARSEA sin error.');
    else fail('Parseo fallo: ' + threw.message);
  }
}

// C.2 — DATOS INTACTOS: cada const inyectada round-trips al dato original
{
  let bad = [];
  for (const key of Object.keys(data)) {
    const m = body.match(new RegExp('^const ' + key + ' = (.*);\\s*$', 'm'));
    if (!m) { bad.push(key + ' (no encontrado)'); continue; }
    let parsed;
    try { parsed = JSON.parse(m[1]); } catch (e) { bad.push(key + ' (no parsea: ' + e.message + ')'); continue; }
    if (JSON.stringify(parsed) !== JSON.stringify(data[key])) bad.push(key + ' (distinto del original)');
  }
  if (!bad.length) ok('Las 8 consts (LOCALS..MARCA_ACTIVA) round-trip exactas: "$", "<", "</script>", backslash, comillas y unicode.');
  else fail('Datos corruptos en: ' + bad.join(', '));
}

// C.3 — EJECUTA de verdad: corre el <script> con stubs de DOM
{
  const makeBlackhole = () => {
    const fn = function () { return bh; };
    const bh = new Proxy(fn, {
      get: (t, p) => (p === Symbol.toPrimitive ? () => '' :
                      p === Symbol.iterator ? function* () {} :
                      p === 'length' ? 0 : bh),
      apply: () => bh, has: () => true, set: () => true,
    });
    return bh;
  };
  // intrinsics reales para que Object/JSON/Array no caigan al blackhole
  const sandbox = { console, Object, Array, JSON, Math, String, Number, Boolean,
                    Date, RegExp, Error, Map, Set, Symbol, isNaN, parseInt, parseFloat };
  const ctx = vm.createContext(new Proxy(sandbox, {
    has: () => true,
    get: (t, p) => (p in t ? t[p] : makeBlackhole()),
    set: (t, p, v) => { t[p] = v; return true; },
  }));

  const probe = body + `
    ;__RESULT = {
      hasPLAT: typeof PLAT_CONF !== 'undefined',
      platKeys: (typeof PLAT_CONF !== 'undefined') ? Object.keys(PLAT_CONF) : [],
      localsLen: (typeof LOCALS !== 'undefined') ? LOCALS.length : -1,
      hasInit: typeof init === 'function',
      metaSem: (typeof META !== 'undefined') ? META.semanas : null,
      reasonName: (typeof REASONS !== 'undefined') ? REASONS['El Desembarco - Núñez'][20].PeYa.Rechazos[0].name : null,
      booted: true
    };`;

  let runErr = null;
  try { vm.runInContext(probe, ctx, { timeout: 5000 }); } catch (e) { runErr = e; }
  const r = sandbox.__RESULT;
  if (runErr) { fail('El <script> tiro al ejecutar (init() incluido): ' + runErr.message); }
  else if (r && r.booted) {
    ok('Ejecuta sin tirar. init()=' + r.hasInit + ', PLAT_CONF=' + r.hasPLAT + ' [' + r.platKeys.join(',') + '], LOCALS=' + r.localsLen + ', META.semanas=' + JSON.stringify(r.metaSem));
    try {
      assert.strictEqual(r.hasPLAT, true);
      assert.strictEqual(r.hasInit, true);
      assert.strictEqual(r.localsLen, data.LOCALS.length);
      assert.strictEqual(r.reasonName, PELIGRO);
      ok('Asserts de runtime OK: PLAT_CONF definido, init() corrio, LOCALS y dato peligroso intactos en runtime.');
    } catch (e) { fail('Assert de runtime: ' + e.message); }
  } else {
    fail('No se pudo leer __RESULT (el boot no llego al final).');
  }
}

line('\nListo.');
