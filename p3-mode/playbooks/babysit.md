---
name: babysit
description: P3 stack-specific constraints for the shared babysit skill.
---

### Babysit a P3 stack

Follow the shared [`babysit` skill](../../babysit/SKILL.md) for mode selection, monitoring, triage, watcher lifecycle, and reporting. This adapter adds only P3 stack rules.

- Assign one babysitter to a stack and one immutable frontier generation. Work the lowest unmerged PR first. Read upstack threads and batch fixes for a later wave; do not restart the frontier's checks to address non-blocking upstack feedback.
- Before watching, use `list_thread_pull_requests` to find the stack layers and `link_pull_request` to register any missing layer.
- Do not change stack topology, retarget a base, rebase, force-push, or submit the stack from a babysit. Report conflicts and rebase needs to the stack owner. Only a designated Autopilot owner may change its own branch, and only when its owner playbook explicitly requires it.
- Use the shared Bugbot rubric at [`references/bugbot-triage.md`](../references/bugbot-triage.md) when triaging automated review comments. Verify findings against the code and dismiss noise with a concrete reason.
- Stop at merge-ready and hand landing to [`playbooks/shipping.md`](shipping.md). Babysitting alone never authorizes a merge.
