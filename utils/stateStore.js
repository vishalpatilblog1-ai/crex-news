import fs from "fs";

const FILE = "./data/state.json";

export function loadState() {
  try {
    if (!fs.existsSync(FILE)) return {};
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch (err) {
    console.log("Failed to load state:", err);
    return {};
  }
}

export function saveState(state) {
  try {
    fs.mkdirSync("./data", { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.log("Failed to save state:", err);
  }
}
