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
        <svg width="22" height="22" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="30" width="8" height="12" rx="1.5" fill="#c1592f" />
          <rect x="20" y="20" width="8" height="22" rx="1.5" fill="#c1592f" />
          <rect x="32" y="8" width="8" height="34" rx="1.5" fill="#c1592f" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
