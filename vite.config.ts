import { defineConfig } from "vite";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
const hash = createHash("sha256");
for (const file of readdirSync("src").sort())
  hash.update(readFileSync(`src/${file}`));
hash.update(readFileSync("package-lock.json"));
export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(hash.digest("hex").slice(0, 12)) },
  build: { sourcemap: true },
});
