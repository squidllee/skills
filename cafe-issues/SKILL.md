---
name: cafe-issues
description: "Use when working with issues on a GitCafe-hosted repository via the cafe CLI: list and filter, view, create, edit, comment, close, assignees, labels, and links between issues and pull requests. Do not use for GitHub or GitLab issues (use gh or glab), and read the cafe-cli skill first for the base contract."
metadata:
  managed-by: gitcafe-cafe
  cafe-version: 0.12.0
  content-hash: sha256:8cdb9cddc732e0041f5d030ab41ee225880d20ff229aac5650163970965c4a28
  short-description: GitCafe issues with the cafe CLI
---

# GitCafe issues

Read the `cafe-cli` skill first (`cafe skills show cafe-cli`) for the base
contract: invocation policy, when to add `--json`, and errors. Pass
`--repo <owner>/<repo>` when outside a clone.

## States

Issues use workflow states: `triage`, `backlog`, `unstarted`, `started`,
`completed`, `canceled`. The `--state` filter also accepts the groupings
`open` (triage/backlog/unstarted/started) and `closed` (completed/canceled).
There is no dedicated close state: `issue close` sets `completed`; to cancel
instead, use `issue edit --state canceled`.

## Browse

```sh
cafe issue list --state open
cafe issue list --assignee <handle> --label bug --sort updated
cafe issue view <n>
```

## Create, edit, comment, close

```sh
cafe issue create --title "Retry loop never backs off" --body-file /tmp/issue.md
cafe issue create --title "Ship the importer" --state started --priority 2 --assignee <handle> --label feature
cafe issue edit <n> --state started --priority 1
cafe issue edit <n> --due 2026-08-01
cafe issue comment <n> --body "Reproduced on main"
cafe issue close <n>
```

`--due` accepts `YYYY-MM-DD` or an ISO datetime; pass `none` to clear it.
Priority is 0 to 4.

## Assignees

Handles resolve through the host's user search (exact username match); you do
not need repository-admin scope to assign.

```sh
cafe issue assign <n> <handle>
cafe issue unassign <n> <handle>
```

## Labels

Labels are repository-scoped. `label add`/`remove` take the label by name;
create requires a hex color.

```sh
cafe issue label list
cafe issue label create bug --color "#d73a4a" --description "Something is broken"
cafe issue label add <n> bug
cafe issue label remove <n> bug
```

## Links to pull requests

Links are typed `closes` or `references` and can be created from either side
(`issue link` here, or `pr link` in the cafe-pr skill).

```sh
cafe issue link <n> <pr-number> --type closes
cafe issue links <n>
```

## Gotchas

- `issue create --state` defaults to `backlog`, not `triage`.
- `--assignee` and `--label` on `issue create` are repeatable flags.
- List commands paginate with `--limit` and `--cursor`; fetch a page with
  `--json` when you need the next cursor from the envelope.

## Attach local images

Uploads require repository access and a credential granting `repo attachments/write`,
in addition to the permission for the target PR, issue, or comment operation.
Existing device grants do not gain new scopes automatically. Check `cafe auth status`
for the selected host; if the attachment scope is missing, sign in again with
`cafe auth login` or use a credential explicitly granting that scope. A 404 may
mean the repository or endpoint is unavailable, or may conceal denied access.

`cafe issue create`, `edit`, and `comment` accept repeatable
`--attach 'path#alt text'` (PNG/JPEG/GIF/WebP, <=10 MiB each, max 20).
Paths resolve from the current directory; duplicate files are rejected.
Only explicitly attached local Markdown image references are rewritten, retaining
their alt text. Otherwise images append in flag order. Attachment-only edits
preserve the existing description and version fence.

`cafe issue edit <n> --attach '/tmp/before.png#Before' --attach '/tmp/after.png#After'`

On upload failure, Cafe does not write a partial target body. Reuse reported ready
image Markdown after a target-write failure. A lost reservation response can be
recovered by repeating only its POST with the same reported requestKey/sha256/size.
For uncertain image bytes, inspect the reported attachment's `/status` route
with `cafe api` and follow nextAction for reconciliation; never blindly resend
the bytes or retry the entire command.
