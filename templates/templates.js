// template.js
import {
  BOLD_ITALIC_MAP,
  BOLD_MAP,
  FLAG_MAP,
  ITALIC_MAP,
} from "./textStyles.js";

// import { BOLD_ITALIC_MAP } from "./textStyles.js";

export function getFlagEmoji(teamShort) {
  if (!teamShort) return "";

  return FLAG_MAP[teamShort.toUpperCase()] || "";
}

export function bold(text = "") {
  return text
    .split("")
    .map((ch) => BOLD_MAP[ch] || ch)
    .join("");
}

export function italic(text = "") {
  return text
    .split("")
    .map((ch) => ITALIC_MAP[ch] || ch)
    .join("");
}

export function boldItalic(text = "") {
  return text
    .split("")
    .map((ch) => BOLD_ITALIC_MAP[ch] || ch)
    .join("");
}
