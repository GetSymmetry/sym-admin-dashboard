/**
 * Authentication utilities for admin dashboard.
 *
 * Auth flow: login route sets an httpOnly cookie (sym_debug_token).
 * Next.js middleware redirects unauthenticated users to /login.
 * Client-side code cannot (and should not) read the httpOnly token.
 */

export function clearAuthCookie(): void {
  // Clear any legacy non-httpOnly cookie that may exist from older code.
  // The real httpOnly cookie is cleared server-side via /api/auth/logout.
  document.cookie = "sym_debug_token=; path=/; max-age=0";
}

export function isAuthenticated(): boolean {
  // If this code is running, the Next.js middleware already verified
  // the cookie exists (it would have redirected to /login otherwise).
  return true;
}
