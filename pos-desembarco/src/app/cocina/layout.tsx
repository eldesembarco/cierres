import { PresentationDock } from "@/components/PresentationDock";

/**
 * KDS — modo oscuro permanente. La pantalla de cocina vive siempre encendida en
 * un monitor por encima de la línea, no debe seguir el tema del navegador.
 */
export default function CocinaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark flex flex-col flex-1 min-h-0 bg-[#14110e] text-[#f4efe6]">
      {children}
      <PresentationDock />
    </div>
  );
}
