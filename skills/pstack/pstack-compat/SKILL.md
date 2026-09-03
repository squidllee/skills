---
name: pstack-compat
description: Compatibility shim for running original Cursor-native pstack skills on any harness. Maps Cursor models, paths, tools, and built-ins to opencode, Claude Code, and Codex equivalents. Use when a pstack skill names a Cursor model, path, or tool your harness lacks.
---

# pstack-compat (external overlay, upstream stays pristine)

Upstream is a pristine sparse checkout, never edited:

- Source: `https://github.com/cursor/plugins`, only `pstack/skills` checked out
- Local clone: `~/.agents/.upstream/cursor-plugins`
- Presentation: `~/.agents/skills/pstack/<skill>` (junctions into the clone)
- Flat compat: `~/.agents/skills/<skill>` (junctions into the same clone)
- This skill lives in `~/.agents/.overlay/pstack-compat`, linked into both views. It is the only pstack skill that is not upstream.

Update with zero divergence:

```powershell
git -C "$HOME/.agents/.upstream/cursor-plugins" pull --ff-only
```

If new skills appear upstream, re-run the junction script from `~/.agents/skills/pstack/README.md`.

## Models

Upstream defaults name Cursor slugs (`claude-fable-5-1-thinking-max`, `grok-4.6-fast-xhigh`, `gpt-5.6-sol-max`, `claude-opus-5-thinking-xhigh`). Keep the intent, substitute your harness models:

- Judgment, prose, hardest tasks, bug-fix, perf: strongest reasoning model you have.
- Fast mechanical code, explorers, swarm workers: fastest cheap coder.
- Panels (`how critics`, `arena runners`, `architect runners`, `interrogate reviewers`, cross-judge pool): keep the list genuinely diverse. One subagent per entry. Never collapse a panel to a single model family.
- `inherit-parent` / `auto`: run on the parent chat model (omit any model override).

`/setup-pstack` writes `~/.cursor/rules/pstack-models.mdc` upstream. On other harnesses write the same shape to the harness equivalent and treat it as the override layer:

- Claude Code: `~/.claude/pstack-models.md` referenced from `~/.claude/AGENTS.md`
- Codex: `~/.codex/pstack-models.md` referenced from `~/.codex/AGENTS.md`
- opencode:_CONFIG `~/.config/opencode/pstack-models.md` referenced from global `AGENTS.md`

Delete a line to fall back to the skill default.

## Paths

- `~/.cursor/rules/` -> harness rules dir above.
- `alwaysApply: true` rule -> standing instruction in `AGENTS.md` or harness equivalent.
- `cursor-team-kit` skills (`/deslop`, `control-cli`, `control-ui`): use pstack's own `unslop`, `no-comments`, and `technical-writing` instead. Do not install team-kit to satisfy a reference.

## Tools and built-ins

- `Task` subagent with `model`: opencode `Task` with `subagent_type: "poteto-agent"` for rigorous work, `"general"` otherwise. Claude Code `Task` / `Agent` tool. Codex `spawn_agent` / `wait_agent` / `close_agent` with `multi_agent = true` in `~/.codex/config.toml`, else run one sequential pass.
- `AskQuestion` / `AskUserQuestion`: opencode `question` tool. Only for genuine product or preference calls no experiment can settle. Facts you could observe by running something are not questions: prototype first per `poteto-mode`.
- `/loop`, `run`, `verify`: no special tool. Keep working the playbook until the exit condition holds.
- Cursor built-in `/babysit`: inside `poteto-mode` the babysit playbook supersedes it.
- `poteto-agent` and `comment-sicko`: available as `subagent_type` on opencode and Claude. On Codex dispatch a subagent told to read `poteto-mode` first.

## Rules

- Never edit files inside `~/.agents/.upstream/cursor-plugins`. Put harness fixes here or in the consuming project.
- Prefer the flat `~/.agents/skills/<skill>` path when a harness only scans one level (opencode, Claude Code, Codex all do). `~/.agents/skills/pstack/<skill>` is the grouped view of the same targets.
- Keep panels multi-model. A single-model panel is a degraded run, say so.
