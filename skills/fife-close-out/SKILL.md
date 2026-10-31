---
name: fife-close-out
description: Close out finished or scrapped BMad work tidily. Scraps a run or idea (moves it into _archive with a written reason), records completions, and appends to the single running CHANGELOG. Use when the user says "close out", "scrap this idea", "archive this", "that's done, record it", or asks where finished work should go.
---

# Fife close-out

Give finished and scrapped work a tidy, findable ending. Two verbs, one log.

## Scrap an idea or run (it moves)

When the user scraps or cancels a run, idea folder, or initiative folder: confirm the target and get a one-line reason, then run:

```
uv run {skill-root}/scripts/close_out.py scrap "{output_folder}/<folder-name>" --output "{output_folder}" --reason "<one line>"
```

The script moves the folder to `{output_folder}/_archive/<year>/`, writes `REASON.md` inside it, and appends the CHANGELOG line. Report the old and new paths to the user.

For a scrapped *ticket inside a live initiative*, move nothing: Sofia drops it (talk to `bmad-agent-po`), then record the event with `done`.

## Record a completion (it stays)

Completed initiatives close in place — history worth keeping warm. Semantics first: a retrospective (`bmad-retrospective`) and Sofia closing the epic (`bmad-agent-po`). Then the housekeeping line:

```
uv run {skill-root}/scripts/close_out.py done "{output_folder}/<folder-name>" --output "{output_folder}" --summary "<one line>"
```

Built stories and plans inside a live initiative are already tracked by Sofia's board; log folder-level events, not each ticket.

## Rules

- One changelog: `{output_folder}/CHANGELOG.md`. Append-only. Never reorder or rewrite existing lines.
- Never delete anything. Scrapping is a move within the output folder plus a written reason.
- If the target is not a folder under `{output_folder}`, stop and ask.
- Line format (the script writes it): `- YYYY-MM-DD · <scrapped|closed|note> · <name> · <text>`
