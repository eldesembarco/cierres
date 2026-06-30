// src/proxy.ts — middleware en Next 16 (renombrado de middleware.ts)
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isAuthed = !!req.auth;
  const path = req.nextUrl.pathname;

  // Rutas públicas: no se redirigen a /login.
  // Las que igual necesitan sesión validan con auth() en el handler y devuelven 401.
  const publicPaths = [
    '/',
    '/login',
    '/api/health',
    '/api/webhooks',
    '/api/cron',
    '/api/auth',
    '/api/gbp',
    '/api/extension', // auth() interna devuelve 401, evita redirect que rompe la extension
  ];
  const isPublic = publicPaths.some(
    (p) => path === p || path.startsWith(`${p}/`)
  );

  if (!isPublic && !isAuthed) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('callbackUrl', path);
    return NextResponse.redirect(url);
  }

  // Si ya está logueado y va a /login, redirigir al dashboard
  if (isAuthed && path === '/login') {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  // Excluir archivos estáticos y _next/*
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
