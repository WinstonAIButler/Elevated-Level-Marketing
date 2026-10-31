import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const alt = `${SITE_NAME}: ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px 88px",
          background: "linear-gradient(180deg, #232a32, #1a1f25)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 30, color: "#A8D932", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
          {SITE_TAGLINE}
        </div>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 800, lineHeight: 1.1, marginTop: 24, maxWidth: 980 }}>
          Your marketing, elevated and on autopilot.
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#c8d0d8", marginTop: 32, maxWidth: 980 }}>
          Assessment, 12-week plan and AI campaigns for small businesses. Free trial, no card required.
        </div>
        <div style={{ display: "flex", marginTop: "auto", fontSize: 34, fontWeight: 800 }}>
          <span style={{ color: "#A8D932" }}>Elevated</span>
          <span style={{ marginLeft: 12 }}>Digital Marketing</span>
        </div>
      </div>
    ),
    size,
  );
}
