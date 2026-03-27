import { createCanvas, loadImage, registerFont } from "canvas";
import fs from "fs";
import path from "path";
import { CATEGORY_COLOR_MAP, DEFAULT_COLOR } from "../utils/config.js";

registerFont(path.resolve("./fonts/Inter_28pt-Bold.ttf"), {
  family: "InterBold",
});

registerFont(path.resolve("./fonts/Inter_28pt-Regular.ttf"), {
  family: "InterRegular",
});

export async function renderNewsCardImage(baseImageUrl, card) {
  const width = 1200;
  const height = 675;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // 🔥 Force PNG
  const finalBaseUrl = baseImageUrl.replace("/upload/", "/upload/f_png/");

  const baseImage = await loadImage(finalBaseUrl);
  ctx.drawImage(baseImage, 0, 0, width, height);

  // 🔥 Overlay for readability
  // ctx.fillStyle = "rgba(0,0,0,0.35)";
  // ctx.fillRect(0, 0, width, height);

  // ===============================
  // 🔴 CATEGORY BADGE
  // ===============================
  if (card.category?.trim()) {
    const normalizedCategory = card.category.trim().toUpperCase();
    const badgeColor = CATEGORY_COLOR_MAP[normalizedCategory] || DEFAULT_COLOR;

    ctx.font = "32px InterBold";
    ctx.textBaseline = "middle";

    const paddingX = 30;
    const boxHeight = 64;

    const textWidth = ctx.measureText(normalizedCategory).width;

    const boxX = 100;
    const boxY = 80;
    const boxWidth = textWidth + paddingX * 2;

    drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, 20, badgeColor);

    ctx.fillStyle = "#FFFFFF";

    // ✅ ONLY HERE spacing is used
    drawTextWithSpacing(
      ctx,
      normalizedCategory,
      boxX + paddingX,
      boxY + boxHeight / 2 + 2,
      0.6
    );
  }

  // ===============================
  // 📰 HEADLINE
  // ===============================
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "68px InterBold";

  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;

  const headlineText = card.headline || "Breaking Update";

  const headlineLines = wrapText(ctx, headlineText, 100, 200, 750, 85) || 1;

  ctx.shadowColor = "transparent";

  // ===============================
  // 📌 SUBLINE
  // ===============================
  if (card.subline) {
    ctx.fillStyle = "#FFD54F";
    ctx.font = "36px InterRegular";

    const sublineY = 200 + headlineLines * 85 + 10;

    wrapText(ctx, card.subline, 100, sublineY, 800, 50);
  }

  return canvas.toBuffer("image/png");
}

// ===============================
// SAVE IMAGE
// ===============================
export function saveGeneratedImage(buffer) {
  try {
    fs.mkdirSync("./tmp", { recursive: true });

    const filePath = `./tmp/news_${Date.now()}.png`;

    fs.writeFileSync(filePath, buffer);

    return filePath;
  } catch (err) {
    console.error("❌ Failed to save image:", err);
    return null;
  }
}

// ===============================
// HELPERS
// ===============================
function drawRoundedRect(ctx, x, y, width, height, radius, color) {
  ctx.fillStyle = color;

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();

  ctx.fill();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let lines = [];

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const testWidth = ctx.measureText(testLine).width;

    if (testWidth > maxWidth && n > 0) {
      lines.push(line);
      line = words[n] + " ";
    } else {
      line = testLine;
    }
  }

  lines.push(line);

  // ✅ NORMAL TEXT (no spacing here)
  lines.forEach((l, i) => {
    ctx.fillText(l.trim(), x, y + i * lineHeight);
  });

  return lines.length;
}

function drawTextWithSpacing(ctx, text, x, y, letterSpacing = 1) {
  let currentX = x;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    ctx.fillText(char, currentX, y);

    const charWidth = ctx.measureText(char).width;
    currentX += charWidth + letterSpacing;
  }
}
