import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { brand } from '@/config/brand'

export function NotFound() {
  return (
    <>
      <Helmet><title>404 · {brand.name}</title></Helmet>
      <section className="spotlight-bg min-h-[80vh] pt-32 pb-24 flex items-center">
        <div className="container-page text-center">
          <p className="eyebrow mb-4">Página no encontrada</p>
          <h1 className="font-serif text-7xl italic text-cream-50 md:text-8xl">404</h1>
          <p className="mt-6 text-sm text-cream-200/70">Esta historia todavía no fue contada.</p>
          <div className="mt-8">
            <Link to="/" className="btn-gold">Volver al inicio</Link>
          </div>
        </div>
      </section>
    </>
  )
}
