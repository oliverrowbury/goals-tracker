import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
        }}
      >
        <svg width="124" height="124" viewBox="0 0 48 48" fill="none">
          <rect x="11" y="24" width="7" height="18" rx="1.5" fill="#c1592f" />
          <rect x="21" y="17" width="7" height="25" rx="1.5" fill="#c1592f" />
          <rect x="31" y="8" width="7" height="34" rx="1.5" fill="#c1592f" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
