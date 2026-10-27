import {
  cp,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";

// Run after final checks, commit and build. Never packages the source tree.
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
if (git("status", "--porcelain"))
  throw new Error("Commit the reviewed release before packaging");
const commit = git("rev-parse", "HEAD");
const { version } = JSON.parse(await readFile("package.json", "utf8"));
if (version.includes("-"))
  throw new Error("Release version must be explicit and stable");
const wsPackage = JSON.parse(
  await readFile("node_modules/ws/package.json", "utf8"),
);
const output = resolve(
  process.argv[2] ??
    `/private/tmp/cf-timer-release-${version}-${commit.slice(0, 7)}`,
);
await mkdir(output); // Existing release packages are immutable.
const browser = join(output, "static");
const relay = join(output, "relay");
await cp("dist", browser, { recursive: true });
await mkdir(join(browser, "remote"));
await cp(join(browser, "index.html"), join(browser, "remote", "index.html"));
await cp("dist-relay", relay, { recursive: true });
await mkdir(join(relay, "node_modules"));
await cp("node_modules/ws", join(relay, "node_modules/ws"), {
  recursive: true,
});
await writeFile(
  join(relay, "package.json"),
  JSON.stringify(
    {
      name: "cf-timer-relay",
      private: true,
      version,
      type: "module",
      engines: { node: ">=24 <25" },
      dependencies: { ws: wsPackage.version },
    },
    null,
    2,
  ) + "\n",
);
async function inventory(root, directory = "") {
  const files = {};
  for (const name of (await readdir(join(root, directory))).sort()) {
    const relative = directory ? `${directory}/${name}` : name;
    const entry = join(root, relative);
    if ((await stat(entry)).isDirectory())
      Object.assign(files, await inventory(root, relative));
    else
      files[relative] = createHash("sha256")
        .update(await readFile(entry))
        .digest("hex");
  }
  return files;
}
const files = {
  static: await inventory(browser),
  relay: await inventory(relay),
};
const archives = {};
for (const [name, directory] of [
  ["static", browser],
  ["relay", relay],
]) {
  const filename = `cf-timer-${version}-${name}.tar.gz`;
  execFileSync("tar", ["-czf", join(output, filename), "-C", directory, "."], {
    env: { ...process.env, COPYFILE_DISABLE: "1" },
    stdio: "pipe",
  });
  archives[filename] = createHash("sha256")
    .update(await readFile(join(output, filename)))
    .digest("hex");
}
await writeFile(
  join(output, "release.json"),
  JSON.stringify(
    {
      version,
      commit,
      buildNode: process.version,
      targetNode: "24.22.1",
      ws: wsPackage.version,
      files,
      archives,
    },
    null,
    2,
  ) + "\n",
);
await writeFile(
  join(output, "SHA256SUMS"),
  Object.entries(archives)
    .map(([name, sha]) => `${sha}  ${name}`)
    .join("\n") + "\n",
);
console.log(
  JSON.stringify(
    {
      output,
      version,
      commit,
      staticFiles: Object.keys(files.static).length,
      relayFiles: Object.keys(files.relay).length,
      archives,
    },
    null,
    2,
  ),
);
