/**
 * Runtime flags for features whose env is user-supplied post-deploy.
 * All routes/components should render harmlessly when these are false.
 */
export const CLERK_ACTIVE =
  !!process.env.CLERK_SECRET_KEY &&
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith('pk_test_ZmFrZS')

// Client-safe flag: read via the public key existence in bundled env.
export const CLERK_ACTIVE_CLIENT =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith('pk_test_ZmFrZS')

export const MP_ACTIVE = !!process.env.MP_ACCESS_TOKEN
