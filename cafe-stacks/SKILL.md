---
name: cafe-stacks
description: "Use when creating, amending, navigating, viewing, or syncing local stack layers, or submitting, linking, inspecting, merging, closing, restacking, resuming, or cancelling pull request stacks with the cafe stack command across Git, jj, or Sapling workspaces. Read cafe-cli first for authentication, repository context, output, and confirmation rules. Do not use for ordinary unstacked pull request work; use cafe-pr instead."
metadata:
  managed-by: gitcafe-cafe
  cafe-version: 0.12.0
  content-hash: sha256:fca754efe741ef5d601a1e0aac882c3ea8691bd2373f20e89985aeb438d909ad
  short-description: Work with PR stacks across Git, jj, and Sapling
---

# GitCafe pull request stacks

Read `cafe-cli` first. Its authentication, repository-context, output, error,
and destructive-confirmation contracts apply here.

A stack is 1 to 50 pull requests ordered bottom to top. Use the workflow
that matches the state you already have:

- `create`, `modify`, `up`, `down`, `top`, `bottom`, `checkout`, `log` and
  `sync` are the local loop: build and edit the layers before and between
  submissions.
- `submit` publishes local commits as new or existing stack layers.
- `link` records a stack from pull requests that already exist.
- `list` browses active, completed, and dissolved stacks.
- `status` inspects active or historical stack order and merge results.
- `merge` checks and lands a bottom-to-selected contiguous stack prefix.
- `close` dissolves a stack and closes its open pull requests without merging.
- `restack` rewrites and publishes only a stale clean linear suffix.

## Inspect before changing state

Identify the stack explicitly when possible:

```sh
cafe stack list
cafe stack list --state completed
cafe stack status <pr-number>
cafe stack status --stack <stack-number>
```

`list` includes every lifecycle state by default. Completed stacks retain their
ordered landed members, merge strategies, result commits, and completion time.
Use `--state active`, `--state completed`, or `--state dissolved` to narrow the
repository history.

An explicit merged PR resolves to its most recent landed stack when it has no
active stack. The status output marks landed members and their result commits;
terminal stacks are read-only and cannot be restacked or merged again.

Omitting both targets asks the current Git branch for its pull request. That
implicit lookup is Git-only; pass a PR or stack explicitly in jj, Sapling, or a
detached checkout.

Before publishing new layers, preview the exact plan:

```sh
cafe stack submit --name <stable-name> --dry-run
```

Before rewriting existing layers, preview either the stack or the exact
operation:

```sh
cafe stack restack --stack <stack-number> --dry-run
cafe stack restack --operation <operation-id> --dry-run
```

Read the reported remote, layer order, source and target branches, and warnings.
Stop on an unexpected base, moved publication ref, changed remote, divergence,
or policy failure. A restack also requires the adapter's clean, conflict-free
workspace state.

## Check and merge a stack

Always preview the server's authoritative mergeability snapshot first:

```sh
cafe stack merge --stack <stack-number> --dry-run
cafe stack merge <through-pr-number> --dry-run
```

`--stack` selects the top active member and therefore previews the entire stack.
Passing a PR selects the contiguous prefix from the bottom through that PR.
Omitting both resolves the current Git branch's open pull request. It does not
mean the selected PR and the members above it.

The preview is the server's advisory stack readiness, the same the web stack
page shows: each member's kind (`ready`, `waiting`, `blocked`,
`blocked_downstack`, ...) and blockers, `landableThrough` (the highest member
whose prefix is ready), and `landable` for the selected member. With a
`STACK_READINESS_UNAVAILABLE` warning it shows per-PR `statuses` instead. A
real merge rechecks each member immediately before merging:

```sh
cafe stack merge --stack <stack-number> --yes
cafe stack merge <through-pr-number> --yes
```

Stack landing is durable and sequential, not all-or-nothing. If a later member
becomes blocked, already merged members remain merged and the operation reports
where it stopped. Inspect a returned operation id with:

```sh
cafe stack merge --stack <stack-number> --operation <operation-id>
```

If it is `awaiting_credential`, continue the same operation with fresh authorization:

```sh
cafe stack merge --stack <stack-number> --operation <operation-id> --resume --yes
```

Resume preserves the original member scope and strategy. An in-flight child is
observed without starting another merge; resume again after that child finishes.
`--operation` without `--resume` remains read-only. A stopped or completed
operation cannot start new work.

Every strategy (`merge`, `squash`, `rebase`) lands a multi-member scope. Each
landed PR retargets its successor to the landing base. With `squash` or `rebase`,
the server then rebases the successor's own commits onto the landed result,
pushes its branch, and rechecks its permissions and rulesets at the new head
before landing it; the rewrite shows in `cafe stack restack --stack <n>
--operation latest`. A rebase conflict stops the operation (`stopped`,
`STACK_LAND_CONFLICT`) with every lower PR still merged and the conflicting
PR's branch untouched: rebase that PR onto the landing base yourself, push, and
run `cafe stack merge` again for the rest. A ruleset that requires checks on the
rewritten head stops it too (`MERGE_BLOCKED_BY_RULESET`); merge again once those
checks pass. GitHub-mirrored stacks support all three through GitHub.

## Draft or ready a whole stack

`stack submit --draft` opens the pull requests it creates as drafts; pull
requests it reuses keep their state. To change every open member at once:

```sh
cafe stack draft --stack <stack-number>
cafe stack undraft --stack <stack-number>
```

Each member is converted at its current version; members already in that state
are skipped, so after a partial failure run the same command again.

## Close a stack

A stack member cannot be closed on its own: `cafe pr close` fails with
`CONFLICT` and names the stack (the API's problem code is
`PULL_REQUEST_IN_ACTIVE_STACK`). To abandon a stack, for example after its
changes landed another way, preview and close the whole stack:

```sh
cafe stack close --stack <stack-number> --dry-run
cafe stack close --stack <stack-number> --yes
```

This dissolves the stack and closes every open member in one step; members that
already landed stay merged. It needs the access to close each member on its own.

## Workspace and remote selection

`submit`, a fresh `restack`, and the local commands auto-detect workspaces in
this order:

1. jj
2. Git
3. native Sapling

Pass `--vcs git`, `--vcs jj`, or `--vcs sapling` when the choice must be
explicit. An explicit choice is strict and never falls back to another
workspace.

Persist a strict default to avoid auto-detection on every invocation:

```sh
cafe config set stack.vcs git --global
cafe config set stack.vcs sapling --repo-scope
cafe config unset stack.vcs --repo-scope
```

Resolution is `--vcs`, then repository, host, and global configuration, then
auto-detection. A configured tool is strict: if it is unavailable, the command
fails instead of silently switching tools. Use `cafe config list --show-origin`
to inspect the effective value and where it came from.

Repository scope is stored with the working-copy metadata: `.git/cafe` for Git
and colocated workspaces, `.jj/cafe` for native jj, and `.sl/cafe` for native
Sapling. It is not added to the tracked working tree.

The default remote is `origin` for Git and jj. Sapling tries `default-push`,
then `default`. Pass `--remote <name>` when the intended publication remote
differs.

Repository discovery currently reads Git remote configuration. In a pure jj or
Sapling workspace without colocated Git metadata, pass `--repo owner/name` (or
set `CAFE_REPO`). Synchronize the intended base before previewing: Git and
Sapling inspect the live remote but require that object locally, while a jj
write fetches automatically and a jj dry-run remains read-only.

## Work on the local stack

A local layer is one commit (Git, Sapling) or one change (jj); `submit` turns
each layer into one pull request. These commands only touch the local
workspace, except `log` (reads pull requests) and `sync` (fetches and reads
pull requests). Their output is the resulting local stack, bottom to top, with
the checked-out position in `current`.

```sh
cafe stack log
cafe stack create -m "Add the parser" --all
cafe stack modify --all
cafe stack modify -m "Add the parser and its tests"
cafe stack up
cafe stack down 2
cafe stack top
cafe stack bottom
cafe stack checkout 2
cafe stack sync
```

- `log` shows each layer's position, ID, title, local branches or bookmarks,
  and the pull request whose source branch is one of them, with
  `needsSubmit` when the forge head differs from the layer. `--offline` skips
  the lookup. A base marked behind trunk needs `sync`.
- `create` commits a new layer on the current one. Above a lower layer it
  requires `--insert`, which restacks the layers above onto the new one; there
  are no branching stacks yet.
- `modify` amends the current layer and restacks the layers above it.
- `checkout` takes a position (1 is the bottom), a commit or jj change ID
  prefix, or a branch or bookmark name.
- `sync` fetches the trunk, drops bottom layers whose pull requests merged and
  their local branches or bookmarks, and moves the rest onto the new trunk. A
  merged layer above an unmerged one fails with `CONFLICT`.

Each tool keeps its own model:

- **Git:** the stack is the commits between the trunk (`--base`, else
  `<remote>/HEAD`, `main`, `master` or `trunk`) and the tip of the current
  branch. On trunk, start a stack with `create --branch <name>`. Lower layers
  are checked out detached; cafe remembers the stack branch per worktree.
  `create` and `modify` commit what is staged (`--all` stages everything);
  unstaged changes block restacking. A conflict stops with `STACK_CONFLICT`
  and leaves `git rebase` in progress: resolve, `git rebase --continue`, then
  `cafe stack log`. Rewrites move local branches on the layers with them.
- **jj:** the stack is `trunk()..` the heads above `@`, and `@` is the current
  layer: navigation uses `jj edit`. `create` starts a described change (or
  describes an undescribed `@`), so make the edits after it. `modify -m`
  rewords; edits are already in `@`, and jj rebases descendants itself and
  records conflicts, which `log` flags.
- **Sapling:** the stack is the draft commits around `.` above public trunk;
  `--base` does not apply. `modify` runs `sl amend` and `sl restack`;
  conflicts stop with `STACK_CONFLICT` for `sl resolve` and `sl continue`.

Do not resolve a `STACK_CONFLICT` by aborting unless the user asks; the
original layers above stay recoverable with the native abort.

## Submit local commits

`submit` turns commits after the selected base into stack layers, ordered
bottom to top:

```sh
cafe stack submit --name <stable-name> --dry-run
cafe stack submit --name <stable-name>
```

Choose a stable name deliberately and reuse it when retrying a partial
submission; it determines the publication branch names used for the layers.
A layer keeps the publication branch or bookmark already on it; otherwise it
takes the source of the only open pull request targeting the layer below
(the base for the bottom layer), and otherwise a number above every branch of
that name. So after `sync` drops landed layers, or `create --insert` adds one,
submitting again updates the same pull requests and appends new layers to the
stack, whose landed members stay in place.
The command reports the chosen remote and every layer's position, title,
source-to-target relation, pull request, status, and object id.

Do not switch VCS adapters, change remotes, or choose a new stable name merely
to get past a partial result. First inspect the durable pull requests and refs
reported by the previous run.

## Link existing pull requests

When all pull requests already exist, link their numbers in bottom-to-top
order:

```sh
cafe stack link <bottom-pr> <top-pr>
```

`link` records stack relationships only. It does not publish local commits or
rewrite branches.

## Restack and recover

Start a fresh restack only after its preview matches the intended stale suffix:

```sh
cafe stack restack --stack <stack-number> --dry-run
cafe stack restack --stack <stack-number>
```

If the command reports an operation id, that operation becomes the recovery
handle. Inspect or resume that exact operation instead of starting another:

```sh
cafe stack restack --operation <operation-id> --dry-run
cafe stack restack --operation <operation-id>
```

A paused rewrite may require the original workspace and its recovery refs or
operation pin. Resolve the reported conflict or credential/policy issue there,
then resume the same operation.

Failed and cancelled operations are terminal. Start a fresh restack only after
inspecting their durable results. To abandon a nonterminal operation:

```sh
cafe stack restack --operation <operation-id> --cancel --yes
```

Cancellation prevents further work but does not roll back steps already
published durably.

## Preserve each VCS model

- Git recovery relies on exact object ids, backup refs, and lease-checked
  publication.
- jj recovery relies on change ids and a pinned operation/workspace state.
- Sapling recovery relies on its commit lineage and server-side publication
  state.

Do not translate jj or Sapling recovery instructions into ad hoc Git commands.
Do not delete backup refs, operation pins, or temporary recovery state until the
operation is complete and the published layer object ids match the reported
results.
