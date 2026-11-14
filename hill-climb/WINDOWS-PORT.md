# Windows port

A local fork of https://github.com/Bil0000/Hill-Climb at commit
84b95909383379d4a84ad02ecadf928aba6b3b9b (2026-11-13), ported to run natively
on Windows with no WSL, Git Bash, or Docker. POSIX behavior is unchanged.

What changed:

- `scripts/climb.py`
  - Checks, guards, and the holdout run in PowerShell 7 (`pwsh`, falling back
    to Windows PowerShell). A command fails when PowerShell reports an error or
    the last native program exited non-zero, like `sh -c`.
  - Each check runs in its own Windows job object, started suspended, so a
    timeout or the end of a check kills every process it started. This stands in
    for `start_new_session` and `killpg`.
  - The run lock uses `msvcrt.locking` in place of `fcntl.flock`.
  - All files and process output are read and written as UTF-8. On Windows,
    stdout and stderr are UTF-8 so the trail's bars print.
  - Paths in locks, logs, and kits use forward slashes, so lock checks match.
  - `git check-ignore` gets forward-slash paths with `-z`. Before, backslash
    paths never matched, so ignored caches (like `.pyc`) tripped the lock.
    `-z` also fixes non-ASCII file names on every OS.
  - Printed commands (`reuse`, an interrupted paired step) use PowerShell quoting.
  - No console windows flash when git or a check runs.
- `scripts/judge.py`: resolves `claude` and `codex` to full paths (so `.cmd`
  shims work) and passes prompts and notes as UTF-8.
- `SKILL.md`: narrower trigger (explicit hill climb requests only), and a
  Windows section on writing checks in PowerShell. Examples use PowerShell.
- `references/checks.md`: recipes rewritten as PowerShell.
- `tests/test_hill_climb.py` (in the clone, not installed): every check has a
  PowerShell form, plus Windows-only tests for exit codes, UTF-8, timeouts,
  and quoting.

Updating: don't install upstream over this folder, or the port is lost.
Re-apply the diff above to the new upstream version and rerun the tests.
