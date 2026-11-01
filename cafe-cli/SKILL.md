---
name: cafe-cli
description: "Core contract for driving the cafe CLI against a GitCafe forge (a self-hosted Git platform; default host git.cafe). Use before running any cafe command: invocation policy, output formats, auth bootstrap, repository context, and error handling. The cafe-pr, cafe-issues, cafe-stacks, cafe-admin, and cafe-api skills build on this one. Do not use for repositories hosted on GitHub or GitLab; use gh or glab there. A repository is GitCafe-hosted when its remote points at a GitCafe host or the user says so."
metadata:
  managed-by: gitcafe-cafe
  cafe-version: 0.12.0
  content-hash: sha256:3a3dccd647c6b5c3ed13a0b020abc82b072126203fab99b03a30dc2aa4868800
  short-description: Drive the cafe CLI against a GitCafe forge
---

# GitCafe CLI (cafe)

`cafe` is the command-line interface for GitCafe hosts. The default host is
`https://git.cafe/api`; point it elsewhere with `--host` or `CAFE_HOST`.

## Invocation policy

The CLI detects automated invocation on its own: known agent environment
variables select the agent policy, and CI or a piped stdout selects the
automation policy. Both disable prompts, browser launches, and credential
UI. You normally do not need a flag for this.

- Pass `--agent` only as an explicit override: in invocations baked into
  scripts, cron jobs, or other skills, or when an environment strips the
  usual signals and you see interactive behavior.
- Destructive commands (delete, rotate, revoke) refuse to run without
  `--yes`. Pass it only when the user asked for the destructive action.
- stdout carries results only. Status, progress, and prompts go to stderr,
  so piping stdout is always safe.

## Output: reading vs extracting

Agent-policy output is markdown and complete: read it directly to answer
questions and decide next steps; do not add `--json` just because you are
an agent. Add `--json` only when you need machine-stable values (ids, oids,
cursors, tokens) to feed into another command, or when piping to `jq` or a
script.

JSON output is a versioned envelope: `{ schemaVersion, command, context,
warnings, data }`. The result is in `data`; check `warnings` (array of
`{ code, message }`). A single resource (any `view`, and most writes) is
`data.resource`; a list is `data.items` with `data.page.next` as the cursor.
`pr create` and `issue create` also put the new number and web URL at the top
of `data`:

```sh
cafe pr create --title "..." --submission-key <key> --json | jq -r '.data.number, .data.url'
```

## Auth bootstrap

```sh
cafe auth status
```

- If that succeeds, you are authenticated; it prints the identity and host.
- `AUTHENTICATION_REQUIRED` means the host was reached but no usable credential
  was presented; ask the user to run `cafe auth login`.
- `NETWORK_ERROR` means the CLI could not reach the host. Diagnose connectivity
  and retry; do not claim the user is logged out.
- In CI or headless environments set `CAFE_TOKEN`; it overrides stored
  credentials in every code path.
- `cafe auth login` runs a browser device flow and needs a human. If auth is
  missing (a 401 or `AUTHENTICATION_REQUIRED`), ask the user to run it
  themselves; do not attempt it.
- Users upgrading from the old `api.gitcafe.dev` default can run
  `cafe legacy migrate`. It copies their login to `git.cafe`, configures the
  canonical Git credential helper, and preserves the legacy login.
- Long-lived tokens come from `cafe auth token create --name <name>`; the
  default scope set is narrower than a login (repo contents and attachments,
  pr, issue and comment write).

## Repository context

Commands that target a repository resolve it in this order:

1. An explicit positional `owner/name` or resource URL, where accepted.
2. `--repo owner/name` (short `-R`, as in gh; or the `CAFE_REPO` environment
   variable).
3. The current clone's remotes (detected from `.git/config`, walking up from
   the working directory; prefers the remote matching the cafe host).

When you are not inside a clone of the target repository, pass `--repo`:

```sh
cafe pr list --repo <owner>/<repo>
```

## Pull request stacks

Stack submission and restacking are specialized Git, jj, and Sapling workflows.
Load their dedicated workflow skill before acting:

```sh
cafe skills show cafe-stacks
```

Keep this skill's auth, repository-context, invocation, and output contracts in
force while following `cafe-stacks`.

## Errors

Failures print a typed error to stderr with a code and a non-zero exit.
Under the agent policy it renders as markdown:

```
## Error — `NOT_FOUND`

Pull request not found.

Retryable: No
```

When the server names its refusal, the error also carries the server's
`problemCode` (for example `MERGE_IN_PROGRESS` or `REPO_ARCHIVED`; the
markdown shows it as "Problem code"), and the server decides `retryable`:
retry only when it is true, and otherwise follow the message. A `CONFLICT`
without a problem code is a concurrent change: read the resource again before
repeating the write.

A 401 maps to "run `cafe auth login`": relay that to the user. 403 means the
credential lacks a scope or role; 404 can also mean the repository is
private and invisible to you, or that the token lacks the scope to see it.
When the token's own scopes show it lacks what the command needs, the error's
hint names the missing scope (for example `pr contents:write`); fix the
credential instead of retrying or debugging the route.

## Feedback

When cafe itself fails unexpectedly, behaves confusingly, or lacks something
the task needs, tell the GitCafe team. Quote the failing command and the
request id or problem code from the error:

```sh
cafe feedback "pr merge reports SERVER_ERROR" --kind bug --command "cafe pr merge 42" --request-id req_123 --body-file /tmp/details.md
```

The reply is a reference (`fb_…`) to pass on to the user; reports cannot be
read back. Do not resend after an unknown outcome. Feedback is about GitCafe,
not the user's repository: use `cafe issue create` for that.

## Progressive loading

The CLI embeds companion skills. Load one on demand instead of guessing:

```sh
cafe skills list
cafe skills show cafe-cli
```

Use `cafe <command> --help` for the authoritative flag reference of any
command; help output is always current for the installed CLI version.
