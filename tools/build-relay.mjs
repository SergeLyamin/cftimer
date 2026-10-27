import { build } from "esbuild";

await build({
  entryPoints: ["src/server/main.ts"],
  outdir: "dist-relay",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  packages: "external",
  sourcemap: true,
});
