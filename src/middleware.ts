/**
 * NextAuth middleware — server-side auth guard for protected routes.
 *
 * Routes listed in the matcher require an active JWT session. Anonymous
 * visitors are redirected to /login with ?callbackUrl=<original> so they
 * return to where they came from after signing in.
 *
 * Why this exists: before this middleware, /proyectos, /proyectos/new,
 * and /mis-disenos served an HTML shell to anonymous users, then the
 * client-side fetch returned 401 and re-rendered as empty. Bad for SEO
 * (Google indexes the empty shell) and bad UX (flash of empty content).
 * Now the redirect happens server-side before any HTML is sent.
 */
export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/proyectos/:path*",
    "/mis-disenos/:path*",
  ],
};
