// Verifica el login credentials de Auth.js end-to-end contra la app deployada.
//   $env:SUP_PASS='...'; node login_test.mjs
const base = process.env.BASE || 'https://reporte-por-local.vercel.app';
const email = process.env.SUP_EMAIL || 'supervisor@eldesembarco.com';
const password = process.env.SUP_PASS;

const jar = {};
const store = (res) => {
  const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const sc of cookies) {
    const pair = sc.split(';')[0];
    const i = pair.indexOf('=');
    jar[pair.slice(0, i)] = pair.slice(i + 1);
  }
};
const cookieHeader = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');

let r = await fetch(`${base}/api/auth/csrf`);
store(r);
const { csrfToken } = await r.json();
console.log('csrf:', csrfToken ? 'OK' : 'FALTA');

const body = new URLSearchParams({ csrfToken, email, password, callbackUrl: base + '/' });
r = await fetch(`${base}/api/auth/callback/credentials`, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookieHeader() },
  body,
  redirect: 'manual',
});
store(r);
console.log('POST status:', r.status, '| location:', r.headers.get('location'));
const hasSession = Object.keys(jar).some((k) => k.includes('session-token'));
console.log('cookie de sesión seteada:', hasSession);

r = await fetch(base + '/', { headers: { cookie: cookieHeader() }, redirect: 'manual' });
console.log('GET / status:', r.status, '| location:', r.headers.get('location'));
const html = r.status === 200 ? await r.text() : '';
const verdict = /Rechazos|PedidosYa|Tendencia|Reclamos/.test(html) ? 'DASHBOARD VISIBLE ✅'
  : /No pudimos cargar/.test(html) ? 'ERROR BOUNDARY (DB/GAS) ❌'
  : /Ingresar|Contrase/.test(html) ? 'SIGUE EN LOGIN ❌'
  : (r.headers.get('location') || '').includes('login') ? 'REDIRIGE A LOGIN ❌'
  : 'OTRO';
console.log('VEREDICTO /:', verdict);
console.log('etiqueta semana:', /Sem \d+ ·/.test(html) ? 'NUEVA (Sem N · fechas) ✅' : 'vieja (Sxx)');

r = await fetch(base + '/admin', { headers: { cookie: cookieHeader() }, redirect: 'manual' });
const adminHtml = r.status === 200 ? await r.text() : '';
const adminVerdict = /Usuarios y permisos|Guardar/.test(adminHtml) ? 'PANEL ADMIN OK ✅'
  : (r.headers.get('location') || '') === '/' ? 'REDIRIGE A / (no es admin)'
  : `status ${r.status}`;
console.log('VEREDICTO /admin:', adminVerdict);

// endpoint de detalle por local (la carga a demanda)
const lname = process.env.LOCAL_NAME || 'El Desembarco - Boedo';
const t0 = Date.now();
r = await fetch(base + '/api/local?name=' + encodeURIComponent(lname), { headers: { cookie: cookieHeader() } });
const secs = ((Date.now() - t0) / 1000).toFixed(1);
let localVerdict;
if (r.ok) {
  const j = await r.json();
  const has = j?.data?.KPI_SERIES && Object.keys(j.data.KPI_SERIES).includes(lname);
  localVerdict = (has ? `OK ✅ (KPI de "${lname}")` : `respondió sin KPI de "${lname}"`) + ` en ${secs}s`;
} else { localVerdict = `status ${r.status} en ${secs}s`; }
console.log('VEREDICTO /api/local:', localVerdict);
