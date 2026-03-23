import { build } from "esbuild";

await build({
  entryPoints: ["server.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: ".next/standalone/server.js",
  external: [
    "next",
    "better-sqlite3",
    "argon2",
    "@anthropic-ai/claude-agent-sdk",
  ],
  alias: {
    "@/*": "./src/*",
  },
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
});

console.log("Custom server bundled to .next/standalone/server.js");
