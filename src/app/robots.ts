import type { MetadataRoute } from "next";

// Almost the entire app sits behind login (see proxy.ts's matcher) — a
// crawler hitting any of those paths just gets redirected to /login
// anyway, so there's nothing there worth indexing. Only the handful of
// genuinely public pages are left open.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/login", "/signup", "/privacy", "/terms"],
      disallow: "/",
    },
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://goals-tracker-y6se.vercel.app"}/sitemap.xml`,
  };
}
