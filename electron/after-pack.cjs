// Turbopack links server-external packages into .next/node_modules under hashed names
// (e.g. @libsql/client-6da9…) using symlinks, which electron-builder drops. Recreate them
// in the packaged app as real copies of the matching package.
const fs = require("node:fs");
const path = require("node:path");

exports.default = async function afterPack(context) {
  const appDir =
    context.electronPlatformName === "darwin"
      ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, "Contents", "Resources", "app")
      : path.join(context.appOutDir, "resources", "app");
  const srcLinks = path.join(context.packager.projectDir, ".next", "node_modules");
  if (!fs.existsSync(srcLinks)) return;

  const entries = [];
  for (const name of fs.readdirSync(srcLinks)) {
    if (name.startsWith("@")) {
      for (const sub of fs.readdirSync(path.join(srcLinks, name))) entries.push(`${name}/${sub}`);
    } else entries.push(name);
  }

  for (const linked of entries) {
    const pkg = linked.replace(/-[0-9a-f]{16}$/, "");
    const from = path.join(appDir, "node_modules", pkg);
    const to = path.join(appDir, ".next", "node_modules", linked);
    if (!fs.existsSync(from)) throw new Error(`afterPack: ${pkg} is missing from the packaged node_modules`);
    fs.rmSync(to, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.cpSync(from, to, { recursive: true, dereference: true });
    console.log(`  • linked external ${linked} -> copy of ${pkg}`);
  }
};
