import { Link } from 'react-router-dom'
import { Instagram, Youtube, Music2 } from 'lucide-react'
import { brand } from '@/config/brand'

export function Footer() {
  return (
    <footer className="mt-24 border-t border-cream-400/10 bg-ink-900">
      <div className="container-page py-14">
        <div className="flex flex-col items-center gap-8 md:flex-row md:items-start md:justify-between">
          <div className="text-center md:text-left">
            <div className="font-serif text-3xl text-cream-50">{brand.name}</div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.35em] text-gold/70">
              {brand.tagline}
            </div>
            <p className="mt-4 max-w-sm text-sm text-cream-200/70">{brand.description}</p>
          </div>

          <div className="text-center text-sm text-cream-200/80 md:text-left">
            <div className="eyebrow mb-3">Explorar</div>
            <ul className="space-y-2">
              <li><Link to="/archivo" className="hover:text-gold">El Archivo</Link></li>
              <li><Link to="/nosotros" className="hover:text-gold">Nosotros</Link></li>
              <li><Link to="/comunidad" className="hover:text-gold">Comunidad</Link></li>
              <li><Link to="/contacto" className="hover:text-gold">Contá tu historia</Link></li>
            </ul>
          </div>

          <div className="text-center md:text-right">
            <div className="eyebrow mb-3 md:text-right">Seguinos</div>
            <div className="flex items-center justify-center gap-4 md:justify-end">
              <a href={brand.socials.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className="text-cream-200/70 hover:text-gold">
                <Instagram size={20} />
              </a>
              <a href={brand.socials.youtube} target="_blank" rel="noreferrer" aria-label="YouTube" className="text-cream-200/70 hover:text-gold">
                <Youtube size={20} />
              </a>
              <a href={brand.socials.spotify} target="_blank" rel="noreferrer" aria-label="Spotify" className="text-cream-200/70 hover:text-gold">
                <Music2 size={20} />
              </a>
            </div>
            <p className="mt-6 text-xs text-cream-400/60">
              {brand.slogan}
            </p>
          </div>
        </div>

        <div className="mt-12 border-t border-cream-400/10 pt-6 text-center">
          <p className="font-hand text-xl text-gold/80">Historias que quedan.</p>
          <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-cream-400/50">
            © {new Date().getFullYear()} {brand.name} · Todos los derechos reservados
          </p>
        </div>
      </div>
    </footer>
  )
}
