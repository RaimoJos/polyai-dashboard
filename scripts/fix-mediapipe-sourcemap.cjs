const fs = require("fs");
const path = require("path");

const mapPath = path.join(
  process.cwd(),
  "node_modules",
  "@mediapipe",
  "tasks-vision",
  "vision_bundle_mjs.js.map"
);

try {
  // Always overwrite: some users accidentally create a UTF-8 BOM file that JSON.parse rejects.
  fs.mkdirSync(path.dirname(mapPath), { recursive: true });
  fs.writeFileSync(
    mapPath,
    '{"version":3,"sources":[],"names":[],"mappings":""}\n',
    "utf8"
  );
  console.log("[postinstall] Ensured MediaPipe sourcemap exists (no BOM):", mapPath);
} catch (e) {
  console.warn("[postinstall] MediaPipe sourcemap fix skipped:", e?.message || e);
}
