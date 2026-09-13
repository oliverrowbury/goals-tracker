import { ImageResponse } from "next/og";

// A larger rendering of the same favicon (see app/icon.tsx) — referenced
// from app/manifest.ts, which needs explicit icon URLs rather than relying
// on Next's icon.tsx convention (that only feeds the <head> favicon links).
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fbf6ee",
          borderRadius: 48,
        }}
      >
        <svg width="132" height="132" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="30" width="8" height="12" rx="1.5" fill="#c1592f" />
          <rect x="20" y="20" width="8" height="22" rx="1.5" fill="#c1592f" />
          <rect x="32" y="8" width="8" height="34" rx="1.5" fill="#c1592f" />
        </svg>
      </div>
    ),
    { width: 192, height: 192 },
  );
}
