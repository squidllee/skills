---
name: cafe-admin
description: "Use when administering a GitCafe forge via the cafe CLI: repository lifecycle and settings, code browsing, branches and tags, collaborators and branch roles, rulesets, organizations, teams, invitations, webhooks, CI integrations, the apps an organization publishes, Actions settings, self-hosted runners and runner groups, and audit logs. Do not use for day-to-day pull request or issue work (use cafe-pr or cafe-issues), and not for GitHub or GitLab administration."
metadata:
  managed-by: gitcafe-cafe
  cafe-version: 0.12.0
  content-hash: sha256:641e99ac4b6ae8989de3c7bf601c05aa90e13373ffd00787277c50232b29ca9b
  short-description: Administer a GitCafe forge with the cafe CLI
---

# GitCafe administration

Read the `cafe-cli` skill first (`cafe skills show cafe-cli`) for the base
contract: invocation policy, when to add `--json`, and errors. Pass
`--repo <owner>/<repo>` when outside a clone. Deletes and secret rotation
require `--yes`.

## Repositories

The repo model has no description field. `create` defaults to public (the
raw API defaults to private; the CLI sends visibility explicitly), owner
defaults to your personal org.

```sh
cafe repo list --org <org>
cafe repo view <owner>/<repo>
cafe repo create <name> --private --org <org>
cafe repo edit --default-branch main --delete-branch-on-merge
cafe repo clone <owner>/<repo>
cafe repo fork <owner>/<repo> --org <org> --clone
cafe repo sync
cafe repo transfer <owner>/<repo> <new-owner> --name <new-name> --yes
cafe repo delete <owner>/<repo> --yes
```

Changing visibility on a repo in a fork network permanently detaches every
fork, so `repo edit --visibility` requires `--yes`.

Repository transfer is immediate and changes the clone URL. It requires
`--yes`; update existing clones to use the new owner/name after it succeeds.

`cafe repo github disconnect <owner>/<repo> --yes` (repository admins) ends a
GitHub import or sync in any state, including a stopped import, and leaves the
repository a plain GitCafe repository; nothing on GitHub is changed.

## Code browsing (no clone needed)

```sh
cafe repo code tree src --ref main
cafe repo code blob README.md --raw
cafe repo code commits --ref main --limit 20
cafe repo code commit <oid> --stat
cafe repo code compare main..feature --patch
cafe repo code search "TODO" --ref main
cafe repo archive branch main > /tmp/repo.tar.gz
```

## Branches and tags

Deleted branches are soft-deleted tombstones, retained 90 days.

```sh
cafe branch list
cafe branch list --deleted
cafe branch delete old-feature --yes
cafe branch restore old-feature
cafe tag list
cafe tag delete v0.0.1 --yes
```

## Collaborators, branch roles, rulesets

Direct collaborator roles stop at `repo-writer`; maintainer/admin come from
org or team grants. Branch roles gate pushes per branch.

```sh
cafe repo collaborator list
cafe repo collaborator add <handle> --role repo-writer
cafe repo branch-role assign <handle> main --role branch-pusher
cafe repo ruleset list
cafe repo ruleset effective main
```

Rulesets exist at repository, org (`--org`), and team (`--org --team`)
scope; `effective` folds inherited rules into one answer for a branch.

## Organizations and teams

`<user>` positionals accept a handle or a raw `act_...` actor id. Team slugs
are qualified (`parent/child`). `team delete` soft-deletes the team and its
descendants. `team repo create` creates an org-owned repo granted to the team
in one step (there is no command to grant an existing repo to a team).
`team reparent` without `--parent` (or with an empty value) promotes the team
to a root team.

```sh
cafe org list
cafe org member set <org> <handle> --role org-admin
cafe org invitation create <org> <handle> --role org-member-write
cafe org invitation accept <org> --token <token>
cafe team create <org> platform --name "Platform"
cafe team member set <org> platform <handle> --role team-writer
cafe team repo create <org> platform tooling --role repo-admin
cafe team reparent <org> platform
```

## Webhooks, CI integrations, audit

Webhook and integration secrets travel by environment-variable name
(`--secret-env`, `--api-token-env`), never as literal flag values. Webhook
secrets are returned once at create/rotate time. Readiness describes configuration
only; delivery history records receiver acceptance. Ping and manual redelivery
remain unavailable.

```sh
cafe webhook capabilities <org-or-owner/repo>
cafe webhook create <org-or-owner/repo> --url https://ci.example.com/hook --event issue.created
cafe webhook readiness <org-or-owner/repo> <id>
cafe webhook deliveries <org-or-owner/repo> <id> --state failed
cafe webhook attempts <org-or-owner/repo> <id> <delivery-id> --event-created-at <timestamp>
cafe webhook rotate-secret <org> <id> --yes
cafe integration create <org> --type buildkite --name main-ci --provider-org <slug> --webhook-secret-env BK_WEBHOOK_SECRET --api-token-env BK_TOKEN
cafe audit list --limit 30
cafe audit org <org> --action repository.delete
```

A Buildkite integration requires `--webhook-secret-env`: the variable holds
the Token of the Buildkite webhook that reports builds. `--api-token-env` is
optional; a read-only Buildkite API token (`read_builds`, `read_build_logs`)
only adds job lists and logs (`cafe ci jobs`, `cafe ci logs`). Connect a
pipeline to a repository with `cafe ci pipeline create --integration <id>
--pipeline <slug> --context <check name>`.

## Apps

`cafe app view <org> <app>` reads an app the organization publishes: its app
ID (a client assertion's `iss` and `sub`) and, once registered, its OAuth
client ID. Creating or editing an app, registering its OAuth client or signing
keys, and rotating its webhook secret need the user in a recently confirmed
browser session, not a CLI token: hand those steps to the user, and never ask
them to paste a webhook secret or private key into the conversation.

```sh
cafe app view <org> <app> --json
```

## Actions settings and runners

Repository Actions policy (`cafe ci settings|enable|disable`; `cafe actions`
is an alias of `cafe ci`) acts on the current repository. Self-hosted runners
are GitHub's official `actions/runner`; `cafe runner` acts on an organization
(`--org`, default: the repository's owner) or, with an explicit `--repo`, on one
repository. Runner groups are addressed by id or name. A registration token is
shown once, only by `token create` (`credential.token` in JSON).

```sh
cafe ci settings
cafe ci enable --hosted --fork-policy disabled
cafe runner token create --org <org> --name rig-1
cafe runner list --org <org>
cafe runner remove <runner-id> --org <org> --yes
cafe runner groups create --org <org> --name "HIL rigs" --repos firmware,drivers
cafe runner groups update "HIL rigs" --org <org> --visibility all
```

`runner token create` prints the `./config.sh --url … --token …` command to
run in the runner's folder (Windows: `./config.cmd`); relay it to the user
rather than storing the token. `runner pools` and `runner provider-token`
manage provider and hosted pools an autoscaler fills; self-hosted runners use
runner groups. After `runner remove`, the machine is unregistered with
`./config.sh remove --local` (Windows: `.\config.cmd remove --local`) once its
service, if installed, is stopped and uninstalled. `--fork-policy approval`
only records fork pull request runs as `action_required`; they never execute.
