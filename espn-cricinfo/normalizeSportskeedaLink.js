// sportskeeda/normalizeSportskeedaLink.js

// export function normalizeSportskeedaLink(url = "") {
//   if (!url) return null;

//   try {
//     const u = new URL(url);
//     u.search = ""; // remove tracking params
//     u.hash = "";
//     return u.toString().replace(/\/$/, "");
//   } catch {
//     return null;
//   }
// }

export function normalizeSportskeedaLink(link = "") {
  console.log("link>>>>>>>", link);
  if (!link || typeof link !== "string") return null;

  return link.trim().split("?")[0].split("#")[0].replace(/\/$/, "");
}
