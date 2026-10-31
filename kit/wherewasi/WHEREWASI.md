# WhereWasI — one-step adoption

WhereWasI keeps one short `STATUS.md` per project — where things stand, open decisions, the single next action — kept current by enforcement at session end, so any session (human or AI, any tool) resumes from one file.

## Adopt (one step)

Copy the contents of this folder into your project root, preserving the subfolders:

```
STATUS.md  DECISIONS.md  AGENTS.md  WHEREWASI.md
scripts/wherewasi/save.mjs
.claude/settings.json
.pi/extensions/wherewasi.ts
```

**Check first — don't clobber:**
- Already have an `AGENTS.md`? Don't overwrite it — splice the `<!-- wherewasi:state -->` block from `kit/AGENTS.md` into yours.
- Already have a `.claude/settings.json`? Merge the `SessionStart` and `Stop` entries from `kit/.claude/settings.json` into your existing `hooks`.
- `.pi/extensions/wherewasi.ts` and `scripts/wherewasi/save.mjs` are safe drop-ins unless you already use those exact paths.

Then fill the placeholders in once — **both** `STATUS.md` (name, standing, next action) **and** `DECISIONS.md` (project name in the title). That's the whole setup — no interview, no config.

## What happens next

- **Claude Code**: hooks fire from `.claude/settings.json` — session start marks, and the first time the agent tries to stop in a stale session it is blocked once and told to save. (Launch Claude Code from the project root; the hook commands use repo-relative paths.)
- **pi**: the extension loads from `.pi/extensions/` — same deal at the settle boundary. On first load pi asks you to trust the project extension once; every session after that is automatic.
- **Any other tool**: `AGENTS.md` rule 2 is the baseline — agents read the rules and run the save command themselves.
- The first save rewrites `STATUS.md` in a checked shape (four sections, ~30-line ceiling) and moves resolved decisions into `DECISIONS.md`. The updater owns those writes — don't hand-edit around it.

## Acceptance walk (do this once, on a scratch project)

1. Pick a scratch project (not a real one) and copy the kit in, doing every step yourself.
2. Open a session in it (Claude Code or pi), do any small piece of work, and end the session without saving by hand. (In pi, approve the one-time extension-trust prompt when it appears.)
3. Accepted when `STATUS.md` was rewritten by the session itself — new `updated:` stamp, real standing, no save composed by hand.

## Maintaining

- Updater changed upstream? Re-copy `scripts/wherewasi/save.mjs` — it's the single implementation both adapters use.
- `.wherewasi/marker` is runtime state (session staleness); safe to delete anytime.
