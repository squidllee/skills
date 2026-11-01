---
name: cafe-review
description: "Use when asked to review a pull request on a GitCafe-hosted repository: an end-to-end procedure that gathers the PR's intent, diff, and existing feedback, reviews the changes, and posts one review with inline comments and a verdict via the cafe CLI. Do not use for GitHub or GitLab reviews (use gh or glab), and see cafe-pr for individual command mechanics."
metadata:
  managed-by: gitcafe-cafe
  cafe-version: 0.12.0
  content-hash: sha256:40c34e8861f05a338ab52bebd226cd8d6ff8fce9abdf2fae6bc319db4bfb9537
  short-description: Review a GitCafe pull request end to end
---

# Reviewing a GitCafe pull request

This is a procedure: follow the steps in order. Command mechanics live in
the `cafe-pr` skill and the base contract in `cafe-cli`
(`cafe skills show <name>`). The outcome is exactly one posted review
(inline comments plus a verdict), or a report to the user explaining why
posting would be wrong.

## 1. Resolve the PR and its revision

A PR number or URL identifies the target; with neither, the current
branch's PR is used. Start with status either way:

```sh
cafe pr status <n>
```

Record the source revision (head OID) it reports: that is the revision you
are reviewing, and reviews pin to the source ref's _current_ tip; you will
re-check it before posting. Status also surfaces merge blockers, ruleset
constraints, and overall checks worth mentioning in the review body. If no
PR exists, stop and tell the user instead of creating one.

A draft PR still takes a review, but say so in your report and prefer
`--comment` over a verdict unless the user explicitly asked for one.

## 2. Gather before judging

```sh
cafe pr view <n>
cafe pr diff <n> --patch
cafe pr commits <n>
cafe pr reviews <n>
cafe pr comments <n> --filter inline
```

- `view` gives the stated intent. Review the diff against what the PR
  claims to do: scope creep and missing pieces are findings.
- Scale the fetch to the diff: `pr status` reports the file count. Past a
  few dozen files or a couple thousand patch lines, write the patch to a
  file (`cafe pr diff <n> --patch > /tmp/pr.patch`) and work through it in
  file-sized chunks, or fan chunks out to subagents and synthesize their
  findings. Do not try to consume an oversized patch in one read.
- Existing reviews and comment threads are prior art: do not repeat
  feedback that is already given, and do not re-raise a point that a
  resolved thread already settled unless the code regressed.
- When `pr status` shows failing or pending checks, dig in before judging:
  `cafe ci status --pr <n>` lists the CI runs at its head revision, GitHub
  Actions workflow runs (`actwfrun_…`) and Buildkite builds (`cirun_…`)
  alike; a check's link in `cafe pr status <n>` (`checks.contexts[].url` in
  JSON) names its run too (a GitHub Actions check's ends in
  `/actions/runs/<run-id>`). `cafe ci logs <run-id> -o /tmp/job.log`
  downloads the failed job's whole log; add the job after the run id when
  several failed (a workflow job's name, or a Buildkite job id from
  `cafe ci jobs <run-id>`). On a pull request mirrored from GitHub, a
  GitHub check's link (`https://github.com/<owner>/<repo>/runs/<id>`) goes
  in place of the run id: `cafe ci logs <link>` reads that job's log from
  GitHub, which is slower. Only GitHub Actions checks have a log: another
  app's check (codecov, a linter) fails with its GitHub link to open
  instead. Without `-o` it prints only the end of the log (the
  last 200 lines of a workflow job or GitHub check, the last 64 KiB of a
  Buildkite job); `--tail N` prints the last N lines. Do not search with
  `cafe ci list --branch`: it lists runs on the branch's ref, while pull
  request runs are on `refs/pull/<n>/head`; use `--pr <n>`.
- For surrounding context beyond the diff, read files at the source branch
  without touching the working tree:

```sh
cafe repo code blob src/app.ts --ref <source-branch>
```

- Never take review context from the local working tree: it may be ahead
  of or behind the revision under review. If `git status` shows uncommitted
  edits to files the PR touches, mention the divergence in your final
  report so stale feedback is caught early.
- `cafe pr checkout <n>` is for deep review only (running tests, tracing
  call sites). It switches the clone's branch; do not use it when the
  user's working tree has uncommitted work.

## 3. Review the changes

Apply your own review methodology (or the harness's review skill) to the
diff; this skill does not prescribe what good code looks like. It does
prescribe the anchoring rules:

- Comment only on paths that are part of the PR diff; the server rejects
  other anchors.
- `path:line` anchors default to the right side (the new file); use
  `:left` only for lines that exist solely in the old file (deletions).
- Take line numbers from the patch hunk headers (`@@ -old +new @@`), not by
  counting rendered lines.
- Scale depth to the diff: a one-line fix does not need architectural
  commentary.

## 4. Compose one review, not many calls

Collect every finding into a single review: one verdict, one body, all
inline comments attached. Write the body to a file (multi-line bodies do
not survive shell quoting well):

- `--request-changes` when any finding blocks merging (correctness,
  security, data loss).
- `--approve` when nothing blocks; minor suggestions can ride along as
  inline comments. Do not approve a PR you authored: compare the PR's
  author handle (from `pr view`) against the identity `cafe auth status`
  reports, and when they match, use `--comment` instead.
- `--comment` when you have questions or notes but no verdict to give, or
  when the user asked for feedback without a verdict.

## 5. Post

Re-run `cafe pr status <n>` first: if the source OID no longer matches the
revision you reviewed, the head moved: re-fetch the diff and re-check that
your anchors still exist before posting, because the review will pin to the
new tip.

```sh
cafe pr review <n> --request-changes --body-file /tmp/review.md --inline "src/app.ts:42=This leaks the handle" --inline "src/db.ts:7:left=This guard was load-bearing; what replaces it?"
cafe pr review <n> --approve --body "LGTM, one nit inline" --inline "src/app.ts:12=Prefer the existing helper here"
```

## 6. Afterwards

Report the verdict and the key findings to the user. Do not merge, close,
edit the PR, or resolve conversation threads as part of a review; threads
are resolved by whoever addresses them, and merging is a separate decision
(`pr ready` tells you whether it would even be allowed).

## Gotchas

- One review per pass. Posting per-finding reviews spams the PR timeline
  and scatters the verdict.
- `pr comment` (standalone) is not a review: use it only for discussion
  outside a review pass, never to deliver a verdict.
- A `--comment` review needs `--body`, `--body-file`, or at least one
  `--inline`.
- If the diff is empty or the PR is closed or already merged, report that
  instead of reviewing.
