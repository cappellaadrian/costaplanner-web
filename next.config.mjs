/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Surface Vercel's git SHA + build date as NEXT_PUBLIC_* so client
    // components can show a live build stamp instead of a hardcoded one.
    // Vercel injects VERCEL_GIT_COMMIT_SHA at build time. Fallback to "local"
    // for dev. NEXT_PUBLIC_BUILD_DATE is computed at build time (UTC).
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
    NEXT_PUBLIC_BUILD_DATE: new Date().toISOString().slice(0, 10),
  },
};

export default nextConfig;
