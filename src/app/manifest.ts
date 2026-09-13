import type { MetadataRoute } from "next";

// Lets "Add to Home Screen" give Proudly its own icon and a standalone
// window instead of just bookmarking a browser tab — the practical ceiling
// for a web app's tracking reliability (see the Workout page), since a
// dedicated window is less likely to get suspended by the OS than one tab
// among many in a regular browser.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Proudly",
    short_name: "Proudly",
    description: "A daily journal for what you're proud of, with goals, study, and workout tracking alongside it.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf6ee",
    theme_color: "#c1592f",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png" },
      { src: "/icon-512", sizes: "512x512", type: "image/png" },
    ],
  };
}
