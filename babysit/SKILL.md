---
name: babysit-pr
description: Monitor a pull request through review and CI. Use when the user asks to monitor, watch, or babysit a pr.
---

# Babysit PR

All the repos we work on have various AI review tools and bots. They're helpful, even if they are not always right.

If your harness offers tools to monitor a pr, use them so you can respond when comments arrive. Otherwise, poll the pr for new comments and checks.

Only act on checks and comments newer than the lastest push. Verify every bot finding against the source before changing code. Fix real findings and CI failures, distiguish repository failures from infrastructure flakes, and reply with a written reason when dismissin false positives.

Keep an eye on changes to 'main' and rebase when needed. If an overlapping PR makes this one obsolete, stop monitoring, report it to the user, and ask before closing the PR unless closure was excplicitly authorized.

If a review bot leaves feedback you believe is not worth addressing , reply with a written reason and resolve the comment. Use any available comments skill for every comment posted on my behalf.

Screenshots and videos help as well. If there is a file upload skill available, use it, if not then you can use the 'here-now' skill if its installed. If there is no skill available to upload a file, stop and tell the user. Never install a skill by yourself or report that something was uploaded when it wasn't.

Do not let review feedback expand the pr beyond the user's original goal. Address real shortcomings, but avoid scope creep.

Do not explicitly request the bots after every push to review the pull request. They will do so automatically in almost all occasions and retriggering them wastes money for the developer. If the bots do not re-review the pr after pushing changes, tell the user the behavior you are encountering and wait for their explicit approval to auto-trigger reviews.

# Bots

The only review bots and tooling that will be available for the projects you will be working on are Greptile and Entire Trails. Some repos will not have these enabled or the tooling required to help monitor the pr may not be installed(entire cli as an example). If so simply notify the user and let them decide the course of action.

If nothing has changed, stay quiet rather than posting filler comments. Stop when the review bots and required checks are green on the last commit. Merge only when the user explicitly requested it; otherwise report that the pr is ready.
