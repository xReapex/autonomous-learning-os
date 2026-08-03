import type { NextConfig } from "next";

// En-têtes de sécurité appliqués à toute l'app.
//
// La CSP autorise exactement deux choses venues de l'extérieur : le lecteur
// YouTube en iframe (le produit ne fonctionne pas sans) et ses miniatures.
// Rien d'autre — pas de CDN de script, pas de police distante, pas de tracker.
//
// Le mode développement a besoin de deux permissions supplémentaires que la
// production n'aura JAMAIS : `unsafe-eval`, dont React se sert pour ses
// avertissements de dev, et les WebSockets, dont se sert le rechargement à
// chaud. Sans elles, l'app se rend mais ne s'hydrate pas — les boutons ne
// répondent plus, silencieusement. Le durcissement n'a donc lieu qu'en build.
const isDev = process.env.NODE_ENV === "development";

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  // 'unsafe-inline' reste requis en production tant qu'on ne câble pas un nonce
  // par requête : Next injecte ses scripts d'hydratation en inline.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://i.ytimg.com https://img.youtube.com",
  "media-src 'self'",
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
