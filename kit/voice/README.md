# Voice kit — the bmad-fife voice

Overrides that give the six BMad agents their fife voice: professional and
direct, short sentences, specialist terms defined in plain words the first time
they appear, no theatrical personas or famous-name references, and a standing
fact that the user is not a software engineer.

## Install into a consumer project

Copy the six `.toml` files into `{project-root}/_bmad/custom/` and commit them
with the project (they are team overrides). Verify one with:

```
uv run _bmad/scripts/resolve_customization.py --skill .agents/skills/bmad-agent-analyst --project-root .
```

## What they change

- `identity` and `communication_style` per agent — replacing the shipped text.
  Sofia (PO) keeps her shipped identity; hers was already plain.
- One `persistent_facts` entry per agent — appended.

Nothing else. Roles, principles, and menus stay exactly as shipped.

## Update safety

Overrides ride on top of the skills, so upstream updates never wipe them. If a
future upstream release changes a shipped voice field, re-run the resolver and
re-read the merged result.
