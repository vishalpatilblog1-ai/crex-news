import { downloadImageToTemp } from "../cricket-addictor/ocr/downloadImageToTemp.js";
import fs from "fs";
import { isIEBrandedImage } from "./detectIEBranding.js";
import { detectBrandingWithVision } from "../cricket-addictor/ocr/detectBrandingWithVision.js";
import { isRiskyTwitterImageIE } from "../cricket-addictor/ocr/detectTwitterReference.js";

export function isIEArticle(item) {
  return (
    item.link && item.link.includes("indianexpress.com/article/sports/cricket/")
  );
}

export function normalizeIELink(link) {
  return link.split("?")[0].split("#")[0].replace(/\/$/, "");
}

export function normalizeIETitle(title) {
  return title
    .toLowerCase()
    .replace(/&#8217;|&#038;/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function decideIEImageUsage(imageUrl) {
  if (!imageUrl) {
    return { useImage: false, reason: "No imageUrl" };
  }

  if (imageUrl.includes("indianexpress.com/wp-content/uploads/")) {
    return {
      useImage: false,
      reason: "Blocked IE wp-content image pattern",
    };
  }
  let localImagePath;

  try {
    localImagePath = await downloadImageToTemp(imageUrl);

    if (await isIEBrandedImage(localImagePath)) {
      return {
        useImage: false,
        reason: "IE branded image detected",
      };
    }

    const ocrResult = await isRiskyTwitterImageIE(localImagePath);

    if (ocrResult?.risky) {
      return {
        useImage: false,
        reason: `OCR flagged risky: ${ocrResult.reason}`,
      };
    }

    if (imageUrl.includes("images.indianexpress.com")) {
      const visionResult = await detectBrandingWithVision(localImagePath);

      if (visionResult.hasBranding) {
        return {
          useImage: false,
          reason: visionResult.reason,
        };
      }
    }

    if (ocrResult?.text?.toLowerCase().includes("live")) {
      return {
        useImage: false,
        reason: "LIVE badge detected via OCR",
      };
    }

    return { useImage: true };
  } catch (err) {
    return {
      useImage: false,
      reason: `OCR check failed: ${err.message}`,
    };
  } finally {
    if (localImagePath && fs.existsSync(localImagePath)) {
      fs.unlinkSync(localImagePath);
    }
  }
}
