# WhereWasI kit — session-state tracking for every project

WhereWasI keeps one short `STATUS.md` per project — where things stand, open
decisions, the single next action — kept current by enforcement at session
end, so any session (human or AI, any tool) resumes from one file.

This folder is the complete, dress-rehearsed adoption kit. **`WHEREWASI.md`
beside this README is the canonical adoption guide** — follow it; it covers
the one-step copy, the don't-clobber checks for existing `AGENTS.md` /
`.claude/settings.json`, and the acceptance walk.

## What's in here

| File | Role |
|---|---|
| `WHEREWASI.md` | The adoption guide — start here |
| `AGENTS.md` | The rules block every agent reads (splice the marked block into an existing file) |
| `STATUS.md` / `DECISIONS.md` | Templates — fill placeholders once |
| `scripts/wherewasi/save.mjs` | The updater — owns all writes to STATUS/DECISIONS |
| `scripts/wherewasi/save.test.mjs` | Its test suite (run with `node --test`) |
| `.claude/settings.json` | Claude Code hooks: session-start mark + stop enforcement |
| `.pi/extensions/wherewasi.ts` | pi adapter: same enforcement at the settle boundary |

## Note for maintainers

`kit/wherewasi/.claude/settings.json` is **force-tracked** (`git add -f`):
upstream's `.gitignore` ignores `.claude` directories, but this file is kit
content, not project config. It stays tracked permanently — do not "clean it
up". Same reason it must survive upstream merges of `.gitignore`.

## Provenance

Built and rehearsed in `bmad-fife-v0` (see its `DECISIONS.md` for design
decisions). Canonical copies live there and here; keep them in sync when
WhereWasI changes.
