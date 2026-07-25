import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { useEffect } from 'react'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { GrainOverlay } from '@/components/GrainOverlay'
import { Home } from '@/pages/Home'
import { Archive } from '@/pages/Archive'
import { Episode } from '@/pages/Episode'
import { Team } from '@/pages/Team'
import { Community } from '@/pages/Community'
import { Contact } from '@/pages/Contact'
import { Success } from '@/pages/Success'
import { NotFound } from '@/pages/NotFound'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }) }, [pathname])
  return null
}

export default function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <ScrollToTop />
        <GrainOverlay />
        <Nav />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/archivo" element={<Archive />} />
            <Route path="/episodios" element={<Navigate to="/archivo" replace />} />
            <Route path="/episodio/:slug" element={<Episode />} />
            <Route path="/nosotros" element={<Team />} />
            <Route path="/comunidad" element={<Community />} />
            <Route path="/contacto" element={<Contact />} />
            <Route path="/gracias" element={<Success />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
      </BrowserRouter>
    </HelmetProvider>
  )
}
