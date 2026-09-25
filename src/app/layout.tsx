import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://goals-tracker-y6se.vercel.app";
const SITE_DESCRIPTION = "A daily journal for what you're proud of, with goals, study, and workout tracking alongside it.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Every page below sets its own short title (e.g. "Journal") and picks
  // this up automatically — only pages that need the bare "Proudly" (the
  // login/marketing-ish ones) omit their own title entirely.
  title: {
    default: "Proudly",
    template: "%s — Proudly",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: "Proudly",
    description: SITE_DESCRIPTION,
    siteName: "Proudly",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Proudly",
    description: SITE_DESCRIPTION,
  },
  // Add to Home Screen → its own standalone window/icon, not a bookmarked
  // tab — see app/manifest.ts and the note on WorkoutTracker's GPS tracking
  // about why that matters for a session staying alive.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Proudly",
  },
};

export const viewport: Viewport = {
  themeColor: "#c1592f",
};

// Runs before paint so there's no flash of the wrong theme — can't do this
// with a React effect, since that only runs after the first paint.
const THEME_INIT_SCRIPT = `
try {
  var t = localStorage.getItem("theme");
  if (t === "dark" || (!t && matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.classList.add("dark");
  }
} catch {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-paper text-ink" suppressHydrationWarning>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
