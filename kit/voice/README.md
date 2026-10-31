# Voice kit — the bmad-fife voice

Overrides that give the six BMad agents their fife voice: professional and
direct, short sentences, specialist terms defined in plain words the first time
they appear, no theatrical personas or famous-name references, and a standing
fact that the user is not a software engineer.

## Install into a consumer project

Copy **all fourteen `.toml` files plus `fife-voice-rules.md`** into
`{project-root}/_bmad/custom/` and commit them there (they are team
overrides). The rules file is required: every override points at it via
`file:{project-root}/_bmad/custom/fife-voice-rules.md` — without it the voice
falls back to the short style lines only. Verify one with:

```
uv run _bmad/scripts/resolve_customization.py --skill .agents/skills/bmad-agent-analyst --project-root .
```

## What they change

**Six agents** — `identity` and `communication_style` per agent (replacing the
shipped text): Mary, Sofia, Winston, Amelia, John, Sally. Sofia keeps her
shipped identity; hers was already plain.

**Seven workflows + deep-recon** — `persistent_facts` (appended): the shared
`fife-voice-rules.md` reference plus a role-tinted rule each (build/build-auto:
explain changes in everyday words; code-review: findings as what/why/do;
walkthrough: block-by-block plain guidance; architecture: trade-offs in plain
words; ux: concrete user-visible description; deep-recon: web channels and
report register). The three doc-writing skills (prd, architecture, ux) also
get a `doc_standards` plain-language entry.

**One shared rules file** — `fife-voice-rules.md` carries the anti-AI-tell
rules (distilled from the humanizer_fife skill, v3.6.1) and the audience fact
in one place. Edit the voice there once; all fourteen skills pick it up.

Nothing else. Roles, principles, menus, and shipped doc standards stay as
shipped (lists append, nothing shipped is removed).

## Scope notes

- Game-dev (GDS), TEA (Murat), and CIS agents are intentionally **not**
  covered — not in the user's working set.

## Update safety

Overrides ride on top of the skills, so upstream updates never wipe them. If a
future upstream release changes a shipped voice field, re-run the resolver and
re-read the merged result.
