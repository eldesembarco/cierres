# ECOS · Historias que quedan — Design

## Objetivo
Sitio web tipo storytelling/podcast inspirado visualmente en lqlve.com.ar, deployable a Netlify sin fricción. Marca genérica ("ECOS") renombrable en 1 línea.

## Stack
- Vite 5 + React 18 + TypeScript
- Tailwind 3 con paleta y fuentes custom
- React Router 6 (SPA)
- Framer Motion (animaciones cinematográficas)
- react-helmet-async (SEO por página)
- Netlify Forms (contacto + newsletter, cero backend)

## Sistema visual
- Paleta: bg `#0a0806`, crema `#f5e9d3`, oro `#c9a961`, muted `#3d2f1e`
- Fuentes: Cormorant Garamond (títulos), Inter (body), Caveat (firmas)
- Detalles: grain overlay, spotlight gradients, polaroids rotadas, cinta, sello circular
- Dark theme único (evita complejidad)

## Rutas
- `/` — Home cinematográfica
- `/archivo` — Grid de episodios con filtro + búsqueda
- `/episodio/:slug` — Detalle template (polaroid, quote, secciones)
- `/nosotros` — Equipo
- `/comunidad` — Stats + newsletter
- `/contacto` — Form Netlify
- `/gracias` — Confirmación
- `*` — 404

## Data
Todo en JSON estático editable (`src/data/*.json`):
- 13 episodios "disponibles" + 6 "próximamente" con pistas
- Team: 5 miembros
- Stats: reproducciones, suscriptores, países, etc.
- Fotos de Unsplash con IDs curados

## Config de marca
`src/config/brand.ts` centraliza: nombre, tagline, socials, links (spotify/yt/etc.), copy común.

## Deploy
`netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = "dist"
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```
Netlify Forms detectados vía `public/forms.html`.

## Fuera de scope (YAGNI)
- Backend/DB propia
- CMS (queda listo para migrar cambiando `src/data/`)
- Auth para "contenido exclusivo" (downloads placeholder)
- Player audio custom (Spotify embed)
- i18n
