---
name: cafe-pr
description: "Use when working with pull requests on a GitCafe-hosted repository via the cafe CLI: list, view, create, check out, diff, review (including inline comments), comment threads and replies, labels, merge readiness, merge, close, reviewers, and issue links. Do not use for GitHub or GitLab pull requests (use gh or glab), and read the cafe-cli skill first for the base contract."
metadata:
  managed-by: gitcafe-cafe
  cafe-version: 0.12.0
  content-hash: sha256:d7d8858ccf171e060a35cdd6a5fef72de0751d893b0007a708471b97c55329a1
  short-description: GitCafe pull requests with the cafe CLI
---

# GitCafe pull requests

Read the `cafe-cli` skill first (`cafe skills show cafe-cli`) for the base
contract: invocation policy, when to add `--json`, and errors. Pass
`--repo <owner>/<repo>` when outside a clone. Every command below accepts a
PR number or a full PR URL.

## Browse

`pr list` is newest first and covers every state unless `--state` narrows it.
To find the pull request for a branch (for example to check whether one exists
before creating it), filter by its source branch:

```sh
cafe pr list --head <branch>
cafe pr list --state open --base main
cafe pr view <n>
cafe pr diff <n> --patch
cafe pr commits <n>
```

For a pull request mirrored from GitHub, `pr view` also shows its GitHub number
and URL (`github.number`, `github.url` in JSON). A cross-fork pull names its
head repository: a GitCafe fork in `headRepo`, a fork on GitHub in
`github.headRepository`.

`pr status` is revision-bound: it reports the decision snapshot for the PR
(or the current branch's PR when the number is omitted), with every check on
its head. `pr checks` prints the same, but exits like gh's: 1 when a check
failed, 8 when one is pending, otherwise 0 (`pr status` exits 0). `pr ready` checks
merge readiness against branch rulesets; it does not mark a draft ready for
review (that is `pr undraft`).

```sh
cafe pr status <n>
cafe pr checks <n>
cafe pr ready <n>
```

Its first line is the verdict (`merge.verdict` in JSON), with the next step
under it:

- `Mergeable`: nothing known blocks it. For a pull request GitHub merges,
  GitHub has checked the current head against the current base branch and
  found no conflicts (`conflicts: none`). Otherwise conflicts are unchecked
  (`conflicts: unknown`): GitCafe's merge, or GitHub's for a pull request
  whose conflicts GitHub cannot be asked about (pull request sync off), finds
  them, and a conflicting merge fails, changes nothing and says why.
- `Waiting on <checks>`: only required checks that are pending or have not
  reported block it. A check that never reports needs a CI build of the head.
- `Waiting on GitHub's conflict check`: GitHub's answer is missing, older than
  the head or the target branch tip, or still computing (`conflicts: pending`).
  GitCafe has already asked for a fresh one, which may take a few minutes; run
  `cafe pr status` again then rather than merging to find out.
- `Blocked: <reasons>`: fix the listed blockers first. A merge already in
  progress names its operation (`NATIVE_OPERATION_PENDING`, or
  `PROVIDER_MERGE_PENDING` for a GitHub merge of a mirrored pull request);
  inspect it with `cafe pr merge <n> --operation <id>`.
- `Merged` or `Closed`: the pull request is no longer open.

Each check context on the head commit follows, with its state, whether a
ruleset requires it, the Buildkite build id and a link to its run; a GitHub
Actions check links to `…/actions/runs/<run-id>`. Either id works with
`cafe ci view <run-id>`, and `cafe ci status --pr <n>` lists every CI run at
the head commit.

## Create and edit

`--head` defaults to the current branch of the clone you are in; `--base`
defaults to the repository's default branch. For a cross-fork PR pass the
head as `owner/repo:branch`.

```sh
cafe pr create --title "Fix the flaky retry loop" --body-file /tmp/pr-body.md
cafe pr create --title "Port upstream fix" --head <fork-owner>/<fork-repo>:fix --base main
cafe pr edit <n> --title "New title"
cafe pr edit <n> --base main
cafe pr edit <n> --add-label bug --remove-label wip
cafe pr checkout <n>
```

Labels are repository labels, named as `cafe issue label list` shows them;
`--add-label` and `--remove-label` are repeatable and keep the pull's other
labels. `pr view` and `pr list` show the labels.

`pr create --draft` opens the pull request as a draft. `pr draft <n>` converts
an open pull request to a draft and `pr undraft <n>` marks it ready for review;
both read the current version themselves and default to the current branch's
pull request. A draft cannot be merged. Creation has no draft field, so
`--draft` creates the pull request and then converts it: if that second step
fails, the error says the pull request is open and ready and names the
`cafe pr draft` command to finish.

Pass `--submission-key <stable key>` to `pr create`: repeating the identical
creation with the same key returns the same pull request instead of opening a
second one. If the output is lost, look the PR up with `cafe pr list --head
<branch>` before creating again. With `--json`, the new PR is at `.data.number`
and `.data.url` (the full resource stays at `.data.resource`).

`pr edit --base` retargets an open pull request that is not in a stack (a
stacked member's base follows its stack). The branch must exist; the pull's
readiness is then checked against the new base. When a stack lands, open
unstacked pull requests that targeted a landed member's branch move to the
stack's landing base automatically, and merging into an already landed stack
branch is refused.

## Review

Exactly one of `--approve`, `--request-changes`, or `--comment`. A
`--comment` review needs `--body` (or `--body-file`) or at least one
`--inline`. Inline comments attach to the review via the repeatable
`--inline "path:line[:side]=text"` flag (side is `left` or `right`, default
right; the text starts after the first `=`). The server rejects anchors whose
path is not part of the PR diff, and pins the review to the source ref's
current tip (clients cannot pin a commit).

```sh
cafe pr review <n> --approve --body "LGTM"
cafe pr review <n> --request-changes --inline "src/app.ts:42=This leaks the handle"
cafe pr review <n> --comment --inline "src/app.ts:42:left=Was this intentional?"
cafe pr reviews <n>
cafe pr review-view <n> <review-id>
```

## Comments and threads

Standalone comments (not part of a review) use `pr comment`; inline placement
needs `--path` and `--line`. `--reply-to <comment-id>` answers in that
comment's thread instead (a reply takes the thread's placement, so it refuses
`--path`/`--line`; a resolved thread must be unresolved first). Replies and
thread resolution take the comment id from `pr comments`, which lists each
id and the thread a reply belongs to (with `--json`: `.data.items[].id`,
`.data.items[].threadId`).

```sh
cafe pr comment <n> --body "General remark"
cafe pr comment <n> --body "Inline remark" --path src/app.ts --line 42
cafe pr comment <n> --reply-to <comment-id> --body "Fixed in the latest push"
cafe pr comments <n> --filter inline --json
cafe pr resolve <n> <comment-id>
cafe pr unresolve <n> <comment-id>
```

## Merge and close

```sh
cafe pr merge <n> --strategy squash
cafe pr merge <n> --operation <id>
cafe pr merge <n> --operation <id> --wait
cafe pr close <n>
```

`pr merge` waits up to 30 seconds for the merge it submits. If it is still
pending, the error names the operation: inspect it with `--operation <id>`,
which returns at once with its state, reason, attempt count and last failure
(exit 0 while pending), or add `--wait` to poll again. A failed merge exits
with `DOMAIN_FAILURE`. A second merge while one is pending is refused with
problem code `MERGE_IN_PROGRESS`, whose message carries the operation ID;
inspect that operation instead of retrying. If `main` moves while merging,
`pr merge` resubmits once by itself; if the PR's head or target changed it
stops with a `CONFLICT` naming the change: review the PR, then rerun.

## Reviewers and issue links

Reviewer handles resolve against the PR's eligible-reviewer list; an
ineligible handle is an error, not a silent skip.

```sh
cafe pr reviewer list <n>
cafe pr reviewer add <n> <handle>
cafe pr reviewer remove <n> <handle>
cafe pr link <n> <issue-number> --type closes
cafe pr links <n>
```

## Gotchas

- `pr comment --path/--line` comments do not belong to a review; use
  `pr review --inline` when the comment should carry a verdict.
- Merge strategy choices are `merge`, `squash`, `rebase`, `fast-forward`; rulesets on the
  base branch may restrict them (check `pr ready`).
- `pr comment-edit` and `pr comment-delete` exist; deletion requires `--yes`.
- List commands paginate with `--limit` and `--cursor`; fetch a page with
  `--json` when you need the next cursor from the envelope.

## Attach local images

Uploads require repository access and a credential granting `repo attachments/write`,
in addition to the permission for the target PR, issue, or comment operation.
Existing device grants do not gain new scopes automatically. Check `cafe auth status`
for the selected host; if the attachment scope is missing, sign in again with
`cafe auth login` or use a credential explicitly granting that scope. A 404 may
mean the repository or endpoint is unavailable, or may conceal denied access.

`cafe pr create`, `edit`, and `comment` accept repeatable
`--attach 'path#alt text'` (PNG/JPEG/GIF/WebP, <=10 MiB each, max 20).
Paths resolve from the current directory; duplicate files are rejected.
Only explicitly attached local Markdown image references are rewritten, retaining
their alt text. Otherwise images append in flag order. Attachment-only edits
preserve the existing description and version fence.

`cafe pr edit <n> --attach '/tmp/before.png#Before' --attach '/tmp/after.png#After'`

On upload failure, Cafe does not write a partial target body. Reuse reported ready
image Markdown after a target-write failure. A lost reservation response can be
recovered by repeating only its POST with the same reported requestKey/sha256/size.
For uncertain image bytes, inspect the reported attachment's `/status` route
with `cafe api` and follow nextAction for reconciliation; never blindly resend
the bytes or retry the entire command.
