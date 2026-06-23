// Extracción de texto de un PDF del lado del servidor. Usamos `unpdf`, que trae
// un build serverless de pdf.js y funciona en Vercel/Node sin binarios nativos.
// Lo consume el importador manual de PDF de cierre de Tango (POST /api/tango/import-pdf).
import { extractText, getDocumentProxy } from 'unpdf'

export async function extractPdfText(buf: Uint8Array | ArrayBuffer): Promise<string> {
  const data = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  const pdf = await getDocumentProxy(data)
  const { text } = await extractText(pdf, { mergePages: true })
  // Con mergePages:true, `text` ya es un string (las páginas vienen unidas con \n).
  return Array.isArray(text) ? text.join('\n') : text
}
