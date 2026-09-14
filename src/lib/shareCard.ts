// Renders a shareable image card (workout summary, study session, or a
// "proud moment" from the journal) entirely client-side with Canvas —
// no server round-trip or image-generation service needed for something
// this simple.

export type ShareCardData = {
  eyebrow: string; // e.g. "WORKOUT", "STUDY SESSION", "PROUD MOMENT"
  heading: string; // e.g. "Push day", "Maths", or today's date
  stats?: { label: string; value: string }[];
  body?: string; // freeform text, used for the "proud moment" card
  accentHex: string;
};

const WIDTH = 1080;
const HEIGHT = 1350;

function shade(hex: string, percent: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp(((n >> 16) & 0xff) + percent);
  const g = clamp(((n >> 8) & 0xff) + percent);
  const b = clamp((n & 0xff) + percent);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderShareCard(data: ShareCardData): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  grad.addColorStop(0, shade(data.accentHex, 15));
  grad.addColorStop(1, shade(data.accentHex, -35));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const pad = 90;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "600 34px system-ui, sans-serif";
  ctx.fillText("Proudly", pad, 130);

  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "700 30px system-ui, sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(data.eyebrow.toUpperCase(), pad, 320);

  ctx.fillStyle = "#ffffff";
  ctx.font = "600 76px Georgia, serif";
  const headingLines = wrapText(ctx, data.heading, WIDTH - pad * 2);
  let y = 410;
  for (const line of headingLines.slice(0, 3)) {
    ctx.fillText(line, pad, y);
    y += 88;
  }

  if (data.body) {
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.font = "400 42px Georgia, serif";
    const bodyLines = wrapText(ctx, data.body, WIDTH - pad * 2);
    y += 40;
    for (const line of bodyLines.slice(0, 6)) {
      ctx.fillText(line, pad, y);
      y += 58;
    }
  }

  if (data.stats && data.stats.length > 0) {
    const statsY = HEIGHT - 260;
    const colWidth = (WIDTH - pad * 2) / data.stats.length;
    data.stats.forEach((stat, i) => {
      const x = pad + colWidth * i;
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 58px system-ui, sans-serif";
      ctx.fillText(stat.value, x, statsY);
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = "500 28px system-ui, sans-serif";
      ctx.fillText(stat.label.toUpperCase(), x, statsY + 44);
    });
  }

  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, HEIGHT - 140);
  ctx.lineTo(WIDTH - pad, HEIGHT - 140);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "400 28px system-ui, sans-serif";
  ctx.fillText(new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }), pad, HEIGHT - 90);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png");
  });
}
