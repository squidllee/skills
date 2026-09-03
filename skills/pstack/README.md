# pstack — grouped view (original poteto skills, minimal tracked forks)

All poteto pstack skills live here as junctions, so every agent sees the same set regardless of harness or model.

- Upstream (pristine, never edit): `~/.agents/.upstream/cursor-plugins` — sparse checkout of `https://github.com/cursor/plugins`, only `pstack/skills`.
- Grouped view (this folder): `~/.agents/skills/pstack/<skill>` — junctions into upstream, except two one-line forks (below). This is the `pstack` collection you asked for.
- Flat view (harness discovery): `~/.agents/skills/<skill>` — junctions into the same targets. opencode, Claude Code, and Codex only scan one level (`skills/*/SKILL.md`), so the flat links are what they actually load.
- Overlay: `~/.agents/.overlay/` — the only non-upstream content. `pstack-compat` (new Cursor-to-any-harness map) plus one-line name forks for `poteto-mode` (`Poteto Mode` -> `poteto-mode`) and `make-bot-ui` (`Make Bot UI` -> `make-bot-ui`), required because opencode hides skills whose `name` does not match the directory. See `~/.agents/.overlay/README.md`.
- `~/.claude/skills/<skill>` and `~/.codex/skills/<skill>` are junctions to `~/.agents/skills/<skill>` and resolve through the flat links.

## Update

```powershell
git -C "$HOME/.agents/.upstream/cursor-plugins" pull --ff-only
```

Then resync junctions for any new upstream skills (safe to re-run, skips existing).
Two names are forked in `~/.agents/.overlay/` and must keep pointing there, so the
script skips them. After a pull, rebase the forks per `~/.agents/.overlay/README.md`:

```powershell
$src = "$HOME/.agents/.upstream/cursor-plugins/pstack/skills"
$pstack = "$HOME/.agents/skills/pstack"
$flat = "$HOME/.agents/skills"
$forked = @('poteto-mode', 'make-bot-ui')
Get-ChildItem -Path $src -Directory | ForEach-Object {
  if ($forked -contains $_.Name) { return }
  $p = Join-Path $pstack $_.Name
  if (-not (Test-Path $p)) { New-Item -ItemType Junction -Path $p -Target $_.FullName | Out-Null }
  $f = Join-Path $flat $_.Name
  if (-not (Test-Path $f)) { New-Item -ItemType Junction -Path $f -Target $_.FullName | Out-Null }
}
```

Record the new commit in `.upstream.json`.

## Why junctions

- Near-zero modifications to the original repo: `git status` upstream stays clean, `git pull` never conflicts. The only deltas are two one-line `name:` fixes plus one new compat skill, all tracked in `~/.agents/.overlay/`.
- One source of truth: grouped view, flat view, Claude, and Codex all resolve to the same files.
- Windows-friendly: junctions need no admin or Developer Mode. Do not replace with copies unless you intend to diverge.
