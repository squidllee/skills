---
name: what-next
description: Pick the highest-value next task from repo docs and the issue tracker. Use when asked what's next, what to work on, any suggestions to continue, next feature or milestone, or when starting a session cold.
---

# what-next

Return a short ranked list of next steps. Ground it in what the repo and tracker already say. Do not invent work.

## 1. Local docs first

Grep the repo for:

- `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`
- `ROADMAP.md`, `docs/ROADMAP.md`, `PLAN.md`, `TODO.md`, `docs/plans/**`
- `CHANGELOG.md` for what just shipped
- Words like `milestone`, `phase`, `roadmap`, `next`, `remaining`, `not run`, `in progress`

Pull out the current phase, what's done, what's explicitly next, and any stubs or skipped tests.

## 2. Issue tracker

Default is Linear. If the remote is GitHub-only and no Linear project matches, use `gh issue list`.

For Linear:

- Resolve team/project from the remote, `AGENTS.md`, or issue keys in docs (`SQU-*` etc).
- Rank open issues in this order:
  1. Already started (finish beats start)
  2. Todo and unblocked, Urgent then High then Medium
  3. Linked to the current branch or milestone
  4. Not blocked, or only blocked on something already done
- Open the top 1 to 3 and read the full description and relations.

Skip anything marked done in both the docs and the tracker.

## 3. Rank

Best to worst:

1. Explicit current milestone item in the roadmap docs
2. In-progress issue that continues current work
3. Unblocked high-priority issue that fills a roadmap gap
4. Something broken or half-built that the roadmap already cares about
5. Chores and polish only if nothing else exists

If docs and tracker disagree, use the tracker for status and the docs for intent, and say so in one line.

## 4. Output

## Recommended next:

- Why: <milestone item / Linear SQU-nn / unblocked priority>
- From: <path:line or issue URL>
- Steps: <2 to 5 concrete bullets>
- Done when: <test green, PR open, issue closed>
- Skip if: <one line, or omit>

Rules:

- One primary recommendation unless the user asked for options.
- Never invent items that are not in the docs or tracker.
- Prefer finishing in-flight work over new work.
- If both sources are empty, say that and offer to draft a ROADMAP.md from recent commits and open PRs.
- No preamble. No "happy to help". Keep the primary block under about 15 lines.

If users picks an issue as "SQU-nn" or "#nn", hand off to `complete-issue`. If multiple are chosen complete each sequentially and treat them seperate.
