# .overlay — minimal forks outside pristine upstream (do not edit upstream)

Upstream: `~/.agents/.upstream/cursor-plugins` (sparse `pstack/skills`, commit `7314f72`, 2026-09-02). `git status` there must stay clean.

## pstack-compat (new skill, no upstream counterpart)

- `pstack-compat/SKILL.md` — Cursor-to-any-harness map (models, paths, tools). Linked as `~/.agents/skills/pstack/pstack-compat` and flat `~/.agents/skills/pstack-compat`, which heals the pre-existing `~/.claude/skills/pstack-compat` and `~/.codex/skills/pstack-compat` junctions.

## One-line name forks (opencode requires name == directory, lowercase)

Upstream uses display names for two skills; opencode hides mismatches. Copies here fix only the `name:` line, nothing else:

- `poteto-mode/SKILL.md`: `Poteto Mode` -> `poteto-mode` (upstream `pstack/skills/poteto-mode`)
- `make-bot-ui/SKILL.md`: `Make Bot UI` -> `make-bot-ui` (upstream `pstack/skills/make-bot-ui`)

Junctions for these two point here instead of upstream (grouped and flat). All other skills junction directly to upstream.

## Rebase after `git pull`

```powershell
git -C "$HOME/.agents/.upstream/cursor-plugins" pull --ff-only
Remove-Item -Recurse -Force "$HOME/.agents/.overlay/poteto-mode", "$HOME/.agents/.overlay/make-bot-ui"
Copy-Item -Recurse "$HOME/.agents/.upstream/cursor-plugins/pstack/skills/poteto-mode" "$HOME/.agents/.overlay/poteto-mode"
Copy-Item -Recurse "$HOME/.agents/.upstream/cursor-plugins/pstack/skills/make-bot-ui" "$HOME/.agents/.overlay/make-bot-ui"
(Get-Content "$HOME/.agents/.overlay/poteto-mode/SKILL.md" -Raw) -replace '(?m)^name:.*$', 'name: poteto-mode' | Set-Content "$HOME/.agents/.overlay/poteto-mode/SKILL.md" -NoNewline
(Get-Content "$HOME/.agents/.overlay/make-bot-ui/SKILL.md" -Raw) -replace '(?m)^name:.*$', 'name: make-bot-ui' | Set-Content "$HOME/.agents/.overlay/make-bot-ui/SKILL.md" -NoNewline
```

Then resync new-skill junctions per `~/.agents/skills/pstack/README.md`. Verify `git -C ~/.agents/.upstream/cursor-plugins status --short` is empty.
