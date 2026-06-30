import { PresentationDock } from "@/components/PresentationDock";

export default function SalonLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      {children}
      <PresentationDock />
    </div>
  );
}
