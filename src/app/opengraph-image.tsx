import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Same ascending-bars mark as the Wordmark component, redrawn with plain
// inline styles — Satori (what ImageResponse renders through) doesn't run
// Tailwind or read CSS custom properties, so the app's own --accent tokens
// are hardcoded here instead.
const BAR_HEIGHTS = [26, 46, 66, 90];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#fbf6ee",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <span style={{ fontSize: 104, fontWeight: 700, color: "#2b2420" }}>Proudly</span>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 9 }}>
            {BAR_HEIGHTS.map((h, i) => (
              <div key={i} style={{ width: 20, height: h, borderRadius: 4, background: "#c1592f" }} />
            ))}
          </div>
        </div>
        <div style={{ display: "flex", marginTop: 32, fontSize: 32, color: "#6b5f52", maxWidth: 860, textAlign: "center" }}>
          A daily journal for what you&apos;re proud of — goals, study, and workouts alongside it.
        </div>
      </div>
    ),
    { ...size },
  );
}
