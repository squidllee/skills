#!/usr/bin/env node
// Upload screenshots, GIFs and videos so they can be embedded in a PR description.
//
// Usage: node upload-media.mjs [--title "PR 123 evidence"] <file>...
//
// Creates one secret gist, pushes the files into it with git (the gist API and
// `gh gist create` reject binary files), then prints a commit-pinned
// gist.githubusercontent.com URL per file and checks that each one serves.
// Needs only a logged-in `gh` with the `gist` scope.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdtempSync, rmSync, statSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, extname, join, resolve } from "node:path";

const IMAGE = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);
const VIDEO = new Set([".mp4", ".webm", ".mov"]);
const MAX_BYTES = 50 * 1024 * 1024;

const fail = (message) => {
  console.error(`upload-media: ${message}`);
  process.exit(1);
};

const run = (cmd, args, options = {}) =>
  execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options }).trim();

const args = process.argv.slice(2);
let title = "PR media";
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--title") title = args[++i] ?? fail("--title needs a value");
  else files.push(resolve(args[i]));
}
if (files.length === 0) fail('usage: node upload-media.mjs [--title "..."] <file>...');

for (const file of files) {
  if (!existsSync(file) || !statSync(file).isFile()) fail(`not a file: ${file}`);
  const ext = extname(file).toLowerCase();
  if (!IMAGE.has(ext) && !VIDEO.has(ext)) fail(`unsupported type ${ext}: ${file}`);
  if (statSync(file).size > MAX_BYTES) fail(`over 50 MB, shrink it first: ${file}`);
}

try {
  run("gh", ["auth", "status"]);
} catch {
  fail("gh is not logged in; run `gh auth login`");
}

// A content hash in the name keeps re-uploads of a changed screenshot from hitting GitHub's image cache.
const named = files.map((file) => {
  const ext = extname(file).toLowerCase();
  const hash = createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 8);
  const stem = basename(file, extname(file)).replace(/[^A-Za-z0-9._-]+/g, "-");
  return { file, ext, name: `${stem}-${hash}${ext}` };
});

const gist = JSON.parse(
  run("gh", [
    "api", "gists", "-X", "POST",
    "-f", `description=${title}`,
    "-F", "public=false",
    "-f", "files[README.md][content]=PR media. Safe to delete once the PR is merged.",
  ]),
);
const login = gist.owner.login;

const work = mkdtempSync(join(tmpdir(), "pr-media-"));
try {
  // Use gh as the credential helper for this push only, so nothing global changes.
  const git = (...gitArgs) =>
    run("git", [
      "-c", "credential.helper=",
      "-c", "credential.helper=!gh auth git-credential",
      "-c", "user.name=pr-media",
      "-c", "user.email=pr-media@users.noreply.github.com",
      ...gitArgs,
    ], { cwd: work });

  git("clone", "--quiet", gist.git_pull_url, ".");
  for (const { file, name } of named) copyFileSync(file, join(work, name));
  git("add", "--all");
  git("commit", "--quiet", "-m", "Add media");
  git("push", "--quiet", "origin", "HEAD");
  const sha = git("rev-parse", "HEAD");

  const base = `https://gist.githubusercontent.com/${login}/${gist.id}/raw/${sha}`;
  let broken = false;
  for (const { ext, name } of named) {
    const url = `${base}/${name}`;
    let ok = false;
    let type = "";
    // The raw host can lag the push by a moment; this waits for the real response, not a fixed delay.
    for (let attempt = 0; attempt < 6 && !ok; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * attempt));
      const res = await fetch(url, { method: "HEAD" }).catch(() => null);
      type = res?.headers.get("content-type") ?? "";
      ok = res?.ok === true;
    }
    if (!ok) broken = true;
    console.error(`${ok ? "ok" : "NOT SERVING"} ${type} ${name}`);
    if (IMAGE.has(ext)) console.log(`![${name}](${url})`);
    else {
      console.error(`${name} is a video: GitHub will not play it inline from here. Convert it to a GIF for the PR body.`);
      console.log(`[${name}](${url})`);
    }
  }
  console.error(`gist: https://gist.github.com/${login}/${gist.id}`);
  if (broken) fail("some URLs did not serve; do not put them in the PR");
} catch (error) {
  // A failed push leaves an empty gist behind; remove it.
  try { run("gh", ["gist", "delete", gist.id, "--yes"]); } catch {}
  fail(error instanceof Error ? (error.stderr?.toString().trim() || error.message) : String(error));
} finally {
  rmSync(work, { recursive: true, force: true });
}
