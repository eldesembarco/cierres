// Proxy del CSV publicado del Sheet, cacheado en el CDN de Vercel.
// El cliente pide /api/stock (same-origin: sin CORS, sin adblockers,
// sin redirects de Google) y el CDN absorbe el tráfico: como máximo
// un pedido por minuto llega a Google, sin importar cuántas visitas haya.
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTBK1Zo3HAFY9U4SuTnFEy7zqq6MBPIe_QeEyufp8lBu7ZTIJ9kJiQc4A7LEo5aflDts8D2mLjU-h6S/pub?output=csv';

module.exports = async (req, res) => {
    try {
        const r = await fetch(CSV_URL + '&t=' + Date.now(), { cache: 'no-store' });
        if (!r.ok) throw new Error('Google respondió HTTP ' + r.status);
        const text = await r.text();
        if (!text.toUpperCase().includes('LOCAL')) throw new Error('El CSV no tiene el formato esperado');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        // stale-while-revalidate: si Google falla, el CDN sigue sirviendo la última copia buena
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=86400');
        res.status(200).send(text);
    } catch (e) {
        res.setHeader('Cache-Control', 'no-store');
        res.status(502).json({ error: e.message });
    }
};
