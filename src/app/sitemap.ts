import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://proudlyapp.co.uk";

// Same short list as robots.ts's allow rule — the only pages a crawler can
// actually reach without a session.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/login`, changeFrequency: "yearly", priority: 0.8 },
    { url: `${SITE_URL}/signup`, changeFrequency: "yearly", priority: 1 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
