---
name: file-pr
description: File a concise pull request. Use when the user asks to file, open, or create a PR.
---

# File PR

Before filing, check whether a PR for this branch already exists. Review the
diff locally against the base branch (usually `origin/main`) to make sure its
contents match the goal.

PR titles usually become commit messages, so follow the repository's title
conventions. Look at recently merged PRs and Git history for examples. Prefer a
concise, human-readable title that explains why the change matters:

BAD

> ❌ perf(server): negotiate permessage-deflate on the websocket

GOOD

> ✅ perf(server): cut websocket frame size by 70%+ with gzipping

Open the description with a simple explanation of the problem based on the
user's original prompt, then briefly explain the solution. Do not lead with an
implementation inventory:

BAD

> ❌ Removed implicit workspace carry-over from every "new thread" entry point (cmd+n / cmd+shift+o, sidebar v1/v2 buttons, command palette). New threads inherit only the project from context; branch, worktree, and env mode always come from the configured defaults. Deleted buildContextualThreadOptions, startNewThreadInProjectFromContext, and the v1 sidebar's seed-context machinery.

GOOD

> ✅ My "new worktree" default was ignored when starting new threads on existing worktrees. Super unintuitive. Now your preferences always apply.

End the description with the public model name and harness that made the
changes, for example `Created with <model> in <harness>.` Include subagent
models that wrote part of the change. Use the model name the harness reports.
If model identity is unavailable, name the harness without guessing a model.

## Screenshots, GIFs and other media

GitHub has no upload API, but images and GIFs still go in the description: never
say you cannot, and never commit them. A UI PR that requires before/after proof
is not ready without it.

1. Save PNGs for stills and GIFs for motion. Videos do not play inline, so
   convert: `ffmpeg -i in.mp4 -vf "fps=12,scale=800:-1:flags=lanczos" -loop 0 out.gif`
   (keep each under about 10 MB).
2. Run `node scripts/upload-media.mjs --title "<repo> PR evidence" <absolute path to each file>`
   from this skill's directory. Use absolute paths: relative ones resolve against
   this directory, so a bare `before.png` will not find the screenshot. The
   script pushes the files to one secret gist, checks every URL serves, and
   prints a markdown image line per file. Exit 1 means fix the error and rerun
   the whole command; the script has already deleted its gist. Do not fall back
   to another host (anonymous here.now links expire after 24 hours).
3. Paste the lines into the description under **Before** and **After**, then
   confirm with `gh pr view <n> --json body --jq .body` after creating the PR.

Check each image first: a real library or token on screen means re-capture on seed data.

Before submission, check the title, description, quotes, and attachments for
secrets and private details.

Open a real PR rather than a draft so review bots run. If `gh pr create` fails
because the GraphQL rate limit is used up, open it through REST with
`gh api repos/<owner>/<repo>/pulls -f title=... -f head=... -f base=... -F body=@<file>`. If the user also asked
to babysit it, continue with the `babysit-pr` skill.

Do not post a follow-up PR comment unless it serves the user's request. When a
comment is needed, use the `leaving-pr-comments` skill.
