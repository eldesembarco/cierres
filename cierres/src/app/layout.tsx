import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db";
import { esCentral } from "@/lib/auth/rbac";
import { TopBar } from "@/components/TopBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cierres · Grupo Desembarco",
  description: "Panel de cierres de caja — Grupo Desembarco",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  // Título según rol: administración ve "Administrador"; el encargado ve
  // "Control de caja <local>" para identificar claramente su pantalla.
  let titulo = "Administrador";
  if (session && !esCentral(session.user.rol)) {
    titulo = "Control de caja";
    if (session.user.localId) {
      const local = await prisma.local.findUnique({
        where: { id: session.user.localId },
      });
      if (local) titulo = `Control de caja ${local.nombre}`;
    }
  }

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        {session && <TopBar session={session} titulo={titulo} />}
        {children}
      </body>
    </html>
  );
}
