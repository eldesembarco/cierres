// Test directo de Vertex AI con la Service Account, sin n8n.
// Uso: node test-vertex.js
//
// Hace 3 cosas:
//   1) Genera un access token OAuth2 a partir del JSON de la SA (firma JWT con RS256)
//   2) Lista publishers/google/models disponibles en us-central1
//   3) Hace un generateContent simple con varios candidatos de modelo

const fs = require('fs');
const crypto = require('crypto');

const SA_PATH = 'C:/Users/ferra/Downloads/n8n-vertex-ai-495115-d2c37f40a4c6.json';
const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));

const PROJECT = sa.project_id;
const REGION = 'us-central1';
const SCOPES = 'https://www.googleapis.com/auth/cloud-platform';

// --- 1) Firmar JWT y obtener access token ---
function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT', kid: sa.private_key_id };
  const claim = {
    iss: sa.client_email,
    scope: SCOPES,
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  };
  const unsigned =
    b64url(JSON.stringify(header)) + '.' + b64url(JSON.stringify(claim));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const sig = signer.sign(sa.private_key);
  const jwt = unsigned + '.' + b64url(sig);

  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Token error ${res.status}: ${text}`);
  const json = JSON.parse(text);
  return json.access_token;
}

// --- 2) Listar modelos disponibles ---
async function listModels(token) {
  const url = `https://${REGION}-aiplatform.googleapis.com/v1/publishers/google/models`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[listModels] HTTP ${res.status}: ${text.slice(0, 500)}`);
    return [];
  }
  const json = JSON.parse(text);
  return (json.publisherModels || []).map(m => m.name);
}

// --- 3) Probar generateContent con un modelo ---
async function tryGenerate(token, modelName) {
  const url =
    `https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT}` +
    `/locations/${REGION}/publishers/google/models/${modelName}:generateContent`;
  const body = {
    contents: [
      { role: 'user', parts: [{ text: 'Decí "ok" en una sola palabra.' }] },
    ],
    generationConfig: { maxOutputTokens: 10 },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, body: text.slice(0, 400) };
  }
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  const reply =
    parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? '(sin texto)';
  return { ok: true, reply: reply.trim() };
}

(async () => {
  console.log('=== Vertex AI direct test ===');
  console.log('Project:', PROJECT);
  console.log('Region :', REGION);
  console.log('SA     :', sa.client_email);
  console.log('');

  console.log('[1/3] Pidiendo access token…');
  let token;
  try {
    token = await getAccessToken();
    console.log('   ✔ Token OK (' + token.length + ' chars)');
  } catch (e) {
    console.error('   ✖ Falló:', e.message);
    process.exit(1);
  }

  console.log('\n[2/3] Listando publishers/google/models en ' + REGION + '…');
  const models = await listModels(token);
  if (models.length === 0) {
    console.log('   (vacío — la API no devolvió modelos)');
  } else {
    console.log('   Total: ' + models.length);
    // Filtramos los de la familia gemini para ver cuáles están
    const gemini = models
      .filter(n => /gemini/i.test(n))
      .map(n => n.replace(/^publishers\/google\/models\//, ''))
      .sort();
    console.log('   Geminis disponibles:');
    gemini.forEach(g => console.log('     • ' + g));
  }

  console.log('\n[3/3] Probando generateContent con candidatos…');
  const candidates = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-2.0-flash-001',
    'gemini-2.0-flash-lite-001',
    'gemini-1.5-flash-002',
    'gemini-1.5-flash',
  ];
  for (const m of candidates) {
    process.stdout.write('   ' + m.padEnd(32) + ' → ');
    const r = await tryGenerate(token, m);
    if (r.ok) {
      console.log('✔ "' + r.reply + '"');
    } else {
      console.log('✖ ' + r.status + ' ' + r.body.replace(/\s+/g, ' ').slice(0, 200));
    }
  }

  console.log('\n=== Fin ===');
})();
