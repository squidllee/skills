---
name: instabox
description: Use when the user wants a cloud Linux box (instabox sandbox) from the terminal with the `instabox` CLI — create one, SSH in, run a command in it, read its files, set its idle auto-pause, or delete it, or to report a problem with instabox itself (`instabox feedback`). For saving or restoring a box's disks, see instabox-snapshots.
metadata:
  installed-by: instabox
---

# instabox CLI

An instabox sandbox is a Linux VM (Debian, one user with passwordless sudo: named after your local username when created with `instabox create`, `user` from the dashboard, `dev` on older boxes; `instabox get <box>` shows it). It has a root disk and a persistent `/data` disk; HOME is `/data/home`. Each box belongs to an organization; access follows its membership and sandbox permissions.

## Sign in

```sh
instabox whoami              # who is signed in (fails if nobody)
instabox login               # confirm the browser's account, or choose GitHub / Google
```

A GitHub sign-in and a Google sign-in with the same verified email share one account; with different emails they are separate accounts with separate boxes. Both `instabox login` and `npx instabox@latest` open account confirmation in the browser: use its current Instabox account or choose another. To go directly to a provider, use `instabox login --provider github|google`, or `npx instabox@latest --github|--google`. The CLI shares the sign-in `npx` made. Device-code sign-in (`--device`) uses GitHub.

For CI or an agent without a browser, use an API key instead: `export INSTABOX_API_KEY=ibk_...` (the user creates it on the dashboard's API Keys page). Never print, commit or log a key.

## Templates

`agent-browser` is the default, so `create` needs no `--template` for ordinary work. It is Debian with git, gh, Node.js 22, Python (uv), Go, Rust, a C toolchain, Docker, Claude Code and Codex, plus a desktop (VNC, Chromium) ready for browsing or driving a GUI from the start. The dashboard shows it as **standard**. Pick another template only for its one purpose:

- `universal`: the same tools without the desktop, which installs itself the first time it is used (about half a minute); a smaller root disk. The dashboard shows it as **basic**.
- `herdr`: for the herdr client.
- `orca`: for Orca desktop and mobile.

`instabox templates` lists the ones this server offers. The free plan creates boxes from `agent-browser` only: another template is refused with `403 template_not_allowed` and needs a paid plan (the user upgrades on the dashboard). A box from a snapshot (`--snapshot`) works on every plan, whatever template the snapshot came from. Do not retry another template on the free plan; use `agent-browser`.

## Sizes

A box is 4 vCPU / 8 GB of memory unless `create` names another size of the account's plan with both `--vcpus` and `--mem-mib`:

| Plan | Sizes (`--vcpus` / `--mem-mib`)               |
| ---- | --------------------------------------------- |
| Free | 4 / 8192 (default)                            |
| Pro  | 2 / 4096, 4 / 8192 (default), 8 / 16384       |
| Team | 2 / 4096, 4 / 8192 (default) up to 32 / 65536 |

`instabox whoami --json` lists the sizes this account may create as `allowedSpecs` (the default first, then the plan's others and any an admin granted); check it rather than assuming the plan. Another size is refused with `400 spec_not_allowed`, whose message names the account's sizes. Pick a size for the work: 2 vCPU (paid plans) for light editing or a single agent, the default for most builds, 8 vCPU (paid plans) for heavy builds or many processes. `--snapshot` takes the same flags. The size is fixed once the box exists; for another size, save a snapshot and create a new box from it with the size flags.

## Everyday commands

```sh
instabox templates                              # base systems to start from
instabox create --name work                     # new box; waits until it is running
instabox ls                                     # your boxes and their states
instabox ssh work                               # interactive shell (leave with: exit)
instabox exec work -- uname -a                  # one command, no SSH client needed
instabox exec work --cwd /data/home -- ls -la   # exec runs `bash -lc` as the box's user
instabox files work /data/home                  # list a directory (or print a text file)
instabox auto-suspend work 10m                  # idle time before it pauses (fixed at 30m unless an admin gave the account manual lifecycle)
instabox stop work && instabox start work       # stop ends processes, keeps disks
instabox suspend work && instabox resume work   # pause/resume keeps running processes
instabox rename work api                        # rename in place, any state; ID and port URLs stay
instabox rm work                                # delete the box
```

- Names or IDs (`m_...`) both work wherever `<id-or-name>` is accepted.
- `create` options: `--template T` or `--snapshot S`, `--vcpus N --mem-mib M` (a size of the plan, see Sizes), `--auto-suspend D|0`, `--meta K=V`, `--org O`, `--secrets all|NAME,NAME|none`, `--env-secrets NAME,NAME|none`, `--no-wait`.
- A box pauses itself after 30 idle minutes (no agent working, no terminal use, little CPU) and wakes on the next `exec`, `ssh`, `files`, public port request or `instabox wake <box>`; a paused box keeps its memory and processes. The 30 minutes are fixed for every account unless an admin gave it manual lifecycle: only then do `--auto-suspend 0` (always on) and `--auto-suspend 2h` apply, and the CLI prints a note when the server kept 30m. Boxes have no other timeout. Do not try to keep a box on by other means; a paused box resumes on the next command.
- Use `exec` to run a command and read its output, and `ssh` for an interactive shell.
- `exec` returns the command's exit code and takes `--stdin` to pipe input. It stops the command after `--timeout` seconds: 60 by default, 600 at most. Run anything longer (installs, builds, test suites) over SSH, which has no time limit and also returns the exit code: `instabox ssh work -- 'cd /data/workspace/app && npm ci'`.
- The box's HOME has `MACHINE.md` (which box it is, its size, what survives a stop, the installed tools) and `AGENTS.md`. Both are worth reading before working in the box; they appear a moment after it starts.
- A public URL for a web server in the box: `instabox port publish work 3000` prints it (`instabox port ls`, `instabox port unpublish work 3000`). The URL works while the box runs.

## Organization Secrets

Secrets are encrypted key=value entries owned by an org. Each entry has one delivery mode:

- `proxy`: the box receives a placeholder. The outbound proxy replaces it in ordinary HTTPS header values only when the destination matches the Secret's allowed hosts. Code in the box can use this credential but does not receive its real value through Secret delivery. No header-name configuration is needed.
- `env`: the box receives the real value. Use this explicitly for native database credentials, local signing, and clients that cannot use header substitution. Code running in the box can read and copy the value.

A new box without Secret selection flags keeps the existing Vault behavior. Opt into Secrets with `--secrets` or `--env-secrets`, or use `secrets select` later. At creation, `--env-secrets` alone also selects all org proxy Secrets. Select env names explicitly; there is no env `all` mode. Metadata labels do not select Secrets, and Secrets do not deliver files.

```sh
instabox secrets ls --org team                 # metadata only
instabox secrets show work                    # selection and independent proxy/guest status
instabox secrets set SERVICE_API_KEY --org team --delivery proxy --host api.example.com
instabox secrets set DATABASE_URL --org team --delivery env
instabox create --name app --org team --secrets SERVICE_API_KEY --env-secrets DATABASE_URL
instabox secrets select work --env-secrets DATABASE_URL
instabox secrets push work                    # refresh managed env/trust on a running box
instabox create --name tenant --no-vault --secrets none --env-secrets none
```

- Values for `set` come from stdin or a hidden prompt. Never print a credential or put its value into agent output, chat, command arguments, or logs. Before asking for a credential, check metadata with `secrets ls --org <org>` and `secrets show <box>`. A silent check such as `test "${NAME+x}" = x` tests variable presence without revealing it; it does not prove successful proxy authorization.
- Org commands default to the signed-in user's personal org. Use `--org` for a team, and select only Secrets from the box's org. Value, host, delivery-mode and deletion changes require an org owner/admin sign-in. API keys with the appropriate machine scopes can inspect metadata and manage sandbox selections, but cannot retrieve or change Secret values.
- Selection updates replace each supplied list; omitted lists remain unchanged. Preserve existing names when adding to a selection. Proxy selection accepts `all`; both selections accept `none` or `[]`. JSON arrays allow a Secret literally named `all` or `none`.
- Proxy delivery requires allowed hosts and works with literal placeholders in HTTPS headers on port 443. Do not hash, encode, or sign with a placeholder. Native database TLS is not HTTPS. Unsupported traffic never falls back to real-value env delivery.
- Rotating an existing proxy value preserves its placeholder. Env refresh and newly added variables affect new shells that load the managed environment; restart or reconfigure existing applications and connection pools. Removing a selection cannot recover env values already copied into processes, files, or snapshots. Revoke or rotate those credentials at the upstream service when necessary.
- For a box intended for another person or tenant, disable personal Vault injection with `--no-vault` and explicitly select only the org Secrets they may use. For a fresh box with neither system's credentials, use `--no-vault --secrets none --env-secrets none`. Empty Secret selections alone still permit Vault injection. These flags do not remove credentials already copied into a source snapshot.
- For an existing box, disable Vault with `start BOX --no-vault` or `resume BOX --no-vault` and explicitly clear both Secret selections with `secrets select BOX --secrets none --env-secrets none`. Refresh a running guest with both `vault push BOX` and `secrets push BOX`. Existing processes and copied files can retain values; disabling either system does not recover those copies.
- Vault remains available through `vault set`, `set-file`, `import`, `ls`, `rm`, `show`, and `push`. The CLI warns about future retirement. A box may use Vault and Secrets together; Secrets wins same-named environment variables. Neither store automatically copies or deletes the other. Move values deliberately when the user is ready.

## Moving work onto a box

To move the repo the user is working in (with its worktrees, uncommitted work and agent conversations) onto a new box and install its dependencies there, follow the `instabox-move-repo` skill.

## When instabox itself gets in your way (feedback)

If instabox is at fault — a command breaks the contract its help or this skill states, the skill does not match what really happens, a capability is missing, or the CLI is confusing — report it, then carry on with the user's task using a workaround. Never block on the report, and never report problems in the code the user is building.

```sh
instabox feedback --json --type bug --component cli --area exec \
  --title "exec --timeout 600 stops the command at 60s" \
  --detail "instabox exec work --timeout 600 -- make test was killed after 60 seconds" \
  --command "instabox exec work --timeout 600 -- make test" \
  --expected "the skill says exec accepts up to 600 seconds" --doc "skills/instabox/SKILL.md" \
  --workaround "ran it over instabox ssh instead"
```

- `--type`: `bug` when something does not work as its help or the docs say (when instructions did not match reality, also give `--doc`, `--expected` and `--workaround`), `feature-request` when what you need is not supported, `friction` when it works but is confusing or awkward, `other` otherwise.
- `--component`: `cli`, `api`, `sandbox` (the box itself, its templates or tools), `dashboard`, `skills`, `docs` or `other`. `--severity blocker|major|minor` (default `minor`); `--sandbox NAME` names the box involved.
- Emails, keys, tokens, home paths and public IPv4 addresses are redacted before sending, but do not paste secrets into it. The report carries the signed-in account (its user ID, and its login unless that is an email address), so the team can follow up.
- A failed or unconfirmed submission prints a warning and exits 0: do not retry. File one report per problem, not one per attempt.

## Habits

- Forgotten boxes pause themselves after 30 idle minutes. Delete a box with `instabox rm` once its work is done.
- When the user asks for a new box, create one, with a name `instabox ls` does not already show. Offer an existing box only when they want to continue earlier work in it.
- `instabox usage` shows storage use and limits. A quota error means delete or stop something; do not retry the same create in a loop.
