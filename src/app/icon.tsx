import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 8,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="5" fill="#c1592f" />
          <g stroke="#c1592f" strokeWidth="1.8" strokeLinecap="round">
            <line x1="12" y1="1.5" x2="12" y2="4.5" />
            <line x1="12" y1="19.5" x2="12" y2="22.5" />
            <line x1="1.5" y1="12" x2="4.5" y2="12" />
            <line x1="19.5" y1="12" x2="22.5" y2="12" />
            <line x1="4.4" y1="4.4" x2="6.5" y2="6.5" />
            <line x1="17.5" y1="17.5" x2="19.6" y2="19.6" />
            <line x1="4.4" y1="19.6" x2="6.5" y2="17.5" />
            <line x1="17.5" y1="6.5" x2="19.6" y2="4.4" />
          </g>
        </svg>
      </div>
    ),
    { ...size }
  );
}
