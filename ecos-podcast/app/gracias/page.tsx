import Link from 'next/link'
import { Heart, ArrowRight } from 'lucide-react'
import { brand } from '@/lib/config/brand'
import { Stamp } from '@/components/Stamp'

export const metadata = { title: `Gracias · ${brand.name}` }

export default function SuccessPage() {
  return (
    <section className="spotlight-bg min-h-[80vh] pt-32 pb-24 flex items-center">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <div className="flex justify-center opacity-90"><Stamp /></div>
          <h1 className="mt-8 font-serif text-5xl italic leading-tight text-cream-50 md:text-6xl">
            Gracias por confiar.
          </h1>
          <p className="mt-6 text-base text-cream-200/80">
            Recibimos tu historia. La vamos a leer con el cuidado que merece.
            Te vamos a escribir en breve.
          </p>
          <p className="mt-6 font-hand text-3xl text-gold/80">
            Ninguna historia es demasiado chica. Ninguna es demasiado grande. ♡
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/" className="btn-ghost">Volver al inicio</Link>
            <Link href="/archivo" className="btn-gold">Explorar el archivo <ArrowRight size={14} /></Link>
          </div>
          <div className="mt-16 flex items-center justify-center gap-2 text-xs text-cream-400/60">
            <Heart size={12} className="text-gold" /> Con cariño, el equipo de {brand.name}
          </div>
        </div>
      </div>
    </section>
  )
}
