/**
 * Layout neutral del grupo /dashboard.
 *
 * El home (`/dashboard`) tiene su propio Topbar (diseño "Bitácora El Desembarco").
 * Las sub-rutas (/inbox, /reviews, /admin/*) usan un nav simple con SubNav.
 * No hay sidebar global porque el nuevo diseño es full-width.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
