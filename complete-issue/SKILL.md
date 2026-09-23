---
name: linear-complete
description: Take a Linear issue from ticket to merged PR end to end. Use when asked to complete issue SQU-nn, work on a Linear ticket, close out an issue, or finish work from Linear.
---

# linear-complete

Drive one Linear issue all the way through. The issue text is the contract. When it's thin, ask once for anything blocking, then proceed. The user will often times just drop the issue number and nothing else.

## 1. Load the issue

- Pull the issue by key or URL. Read description, acceptance criteria, subissues, relations, labels, and current status.
- If the issue is vague, write a 5 line plan and get a yes before coding. If it's clear, skip the check-in.
- Note anything it is blocked by. Stop if a real blocker is open; otherwise keep going and list residual risk at the end.

## 2. Set up

- Confirm the repo, branch naming convention, and whether you're already on a related worktree.
- Branch from the right base if one doesn't exist. Reference the issue key in the branch name when the repo does that.
- Skim `AGENTS.md` and the nearby code before editing. Match how the surrounding code works.

## 3. Implement

- Break the issue into the smallest set of commits that each leave the tree working.
- Cover the acceptance criteria only. No drive-by refactors unless the issue asks for them.
- Add or update tests where the repo already tests that layer. If there's no test harness for it, say so instead of faking coverage.
- Update docs only when behavior the docs describe actually changed.

## 4. Verify

Run what the repo uses, in this order when available:

- typecheck / lint
- unit and integration tests
- verification skills for a manual pass on the path the issue changes, if it's UI or CLI

Paste the real command output. If something fails and it's caused by your change, fix it. If it's pre-existing, quote the failure and move on with a note.

## 5. Ship

- Push and open a PR. Title and body should follow any repo or harness required conventions but also include the issue: summary, steps, test plan, linked issue at the very top with just the url.
- Fill in the Linear GitHub integration link so the issue shows the PR.
- Return to In Progress while review runs if the team uses that state.

## 6. Close the loop

If and/or when you notice the pr is green or merged, or when the user declares in some we that the work is done:

- Move the issue to Done (or the team's done state).
- Leave a short comment: what changed, where, what was verified.
- If you left anything out, list it as a follow-up instead of quietly dropping it.
- If the user wanted "whats next" after this, point to `what-next` for instructions or a similar skill if its installed.

## Output shape

End with:
PR: <url or "local only"
Verified: <commands run, result>
Follow-ups: <bullets, or none>

No recap of the whole session. No filler. If you're blocked, say blocked and name the blocker in the first line.
