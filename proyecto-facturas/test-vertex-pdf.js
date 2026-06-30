// Reproduce EXACTAMENTE lo que hace el nodo "Extraer con Gemini" en n8n,
// pero desde Node con la SA. Si esto funciona y n8n no, el problema es n8n.
// Si esto también falla, el problema es Vertex/modelo/PDF.

const fs = require('fs');
const crypto = require('crypto');

const SA_PATH = 'C:/Users/ferra/Downloads/n8n-vertex-ai-495115-d2c37f40a4c6.json';
const PDF_PATH = process.argv[2]
  || 'C:/Users/ferra/OneDrive/Desktop/2026-05-01_0822__from_edenred_noreply_at_facturaya_dot_com__LG-A_0060-00708116.pdf';

const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));
const PROJECT = sa.project_id;
const REGION = 'us-central1';

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT', kid: sa.private_key_id };
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  };
  const unsigned = b64url(JSON.stringify(header)) + '.' + b64url(JSON.stringify(claim));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const jwt = unsigned + '.' + b64url(signer.sign(sa.private_key));
  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`Token error: ${await res.text()}`);
  return (await res.json()).access_token;
}

async function tryModel(modelName, token, pdfB64, withSchema) {
  const url =
    `https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT}` +
    `/locations/${REGION}/publishers/google/models/${modelName}:generateContent`;

  const generationConfig = withSchema
    ? {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            tipo_documento: { type: 'string', enum: ['FACTURA', 'RECIBO_PAGO', 'NOTIFICACION_FACTURA', 'RECORDATORIO_PAGO', 'OTRO'] },
            confianza: { type: 'number' },
            proveedor: { type: 'string' },
            monto_total: { type: 'number' },
            fecha_vencimiento: { type: 'string' },
          },
          required: ['tipo_documento', 'confianza'],
        },
      }
    : {};

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { inline_data: { mime_type: 'application/pdf', data: pdfB64 } },
          { text: 'Clasifica este PDF como FACTURA, RECIBO_PAGO, NOTIFICACION_FACTURA, RECORDATORIO_PAGO u OTRO. Devolve JSON con tipo_documento, confianza (0..1), proveedor, monto_total, fecha_vencimiento.' },
        ],
      },
    ],
    generationConfig,
  };

  const t0 = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const ms = Date.now() - t0;
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, ms, status: res.status, body: text.slice(0, 800) };
  }
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  const cand = parsed?.candidates?.[0];
  const finishReason = cand?.finishReason;
  const replyText = cand?.content?.parts?.[0]?.text ?? '';
  return {
    ok: true,
    ms,
    status: res.status,
    finishReason,
    usage: parsed?.usageMetadata,
    modelVersion: parsed?.modelVersion,
    replyLen: replyText.length,
    reply: replyText.slice(0, 500),
  };
}

(async () => {
  console.log('=== Vertex AI con PDF real ===');
  console.log('PDF:', PDF_PATH);
  const pdf = fs.readFileSync(PDF_PATH);
  console.log('Tamaño PDF: ' + (pdf.length / 1024).toFixed(1) + ' KB');
  const pdfB64 = pdf.toString('base64');
  console.log('Tamaño base64: ' + (pdfB64.length / 1024).toFixed(1) + ' KB');
  console.log('');

  const token = await getAccessToken();
  console.log('✔ Token OK\n');

  const tests = [
    { model: 'gemini-2.5-flash-lite', schema: true,  label: 'flash-lite + responseSchema (como n8n)' },
    { model: 'gemini-2.5-flash-lite', schema: false, label: 'flash-lite SIN responseSchema' },
    { model: 'gemini-2.5-flash',      schema: false, label: 'flash 2.5 SIN responseSchema' },
  ];

  for (const t of tests) {
    process.stdout.write('▸ ' + t.label.padEnd(50) + ' … ');
    try {
      const r = await tryModel(t.model, token, pdfB64, t.schema);
      if (r.ok) {
        console.log('✔ ' + r.ms + 'ms · finish=' + r.finishReason + ' · reply=' + r.replyLen + ' chars');
        console.log('   usage:', JSON.stringify(r.usage));
        console.log('   modelVersion:', r.modelVersion);
        if (r.reply) console.log('   reply:', r.reply.slice(0, 200).replace(/\s+/g, ' '));
        console.log('');
      } else {
        console.log('✖ HTTP ' + r.status + ' (' + r.ms + 'ms)');
        console.log('   body:', r.body.replace(/\s+/g, ' ').slice(0, 400));
        console.log('');
      }
    } catch (e) {
      console.log('✖ EXCEPCION:', e.message);
    }
  }
})();
