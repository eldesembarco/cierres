import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// If Clerk isn't fully configured, act as a passthrough so the site keeps working
// as a public site until env vars are added in Vercel.
const CLERK_ACTIVE =
  !!process.env.CLERK_SECRET_KEY &&
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith('pk_test_ZmFrZS')

const isProtectedRoute = createRouteMatcher(['/cuenta(.*)', '/admin(.*)'])

const clerkGuarded = clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect()
})

export default function middleware(req: NextRequest, event: any) {
  if (!CLERK_ACTIVE) return NextResponse.next()
  return (clerkGuarded as any)(req, event)
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
