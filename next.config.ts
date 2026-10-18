import type { NextConfig } from "next";

// Next.js App Router injects inline bootstrap scripts, and charts set inline
// styles, so those need 'unsafe-inline'. Development also needs 'unsafe-eval'
// for fast refresh. Everything else is restricted to this origin.
const production = process.env.NODE_ENV === "production";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");
const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Native libSQL bindings must not be bundled.
  serverExternalPackages: ["@libsql/client", "libsql"],
  outputFileTracingExcludes: {
    "/*": ["./data/**/*", "./.git/**/*", "./.env*", "./tests/**/*"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          ...(production
            ? [{ key: "Content-Security-Policy", value: contentSecurityPolicy }]
            : []),
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default config;
