// 1) npm i qrcode
// 2) node gen-qr.js

import QRCode from "qrcode";

const url = "https://www.youtube.com/@pramodzinjade";

async function run() {
  try {
    await QRCode.toFile("pramod-zinjade-yt-qr.png", url, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 512,
      color: { dark: "#000000", light: "#FFFFFF" },
    });
    console.log("✅ QR saved as pramod-zinjade-yt-qr.png");
  } catch (err) {
    console.error("❌ Failed to generate QR:", err);
    process.exitCode = 1;
  }
}

run();
