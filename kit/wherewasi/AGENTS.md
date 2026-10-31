# AGENTS.md — instructions for AI agents working in this repo

<!-- wherewasi:state -->
## WhereWasI state rules

1. Read `STATUS.md` at session start, before doing work — it holds this project's standing, open decisions, and the single next action.
2. At session end, run `save`: compose the update as JSON — `standing`, `openDecisions`, the single `nextAction`, any `graduatedDecisions` — and pipe it to `node scripts/wherewasi/save.mjs save`. The updater rewrites `STATUS.md` (shape-checked, `updated:` stamped) and moves graduated decisions into `DECISIONS.md`; it owns these writes — don't hand-edit the files around it.
3. Keep `STATUS.md` at ~30 lines or fewer — overflow goes to `DECISIONS.md` or project notes, never the state file.
4. Never drop an open decision silently: unresolved questions stay in STATUS.md; resolved ones graduate to `DECISIONS.md` with date and why.
<!-- /wherewasi:state -->
