# FORKING — bmad-fife deviation ledger

`bmad-fife` is a fork of `bmad-code-org/BMAD-METHOD`, renamed. This file is the
contract that keeps upstream merges cheap. Every deviation from upstream is
recorded here, one line each. **If a file is not in the ledger, a merge treats
it as upstream's — upstream wins.**

## Golden rules, in order of preference

1. **Per-project overrides.** Changes to how skills behave in one project go in
   that project's `_bmad/custom/<skill>.toml` (team) or `<skill>.user.toml`
   (personal). Zero fork cost, survives every update. This is the default
   answer.
2. **Additive changes here.** New skills (prefix `fife-`), new module records
   (`bmod-fife`), new docs. New files never conflict with upstream.
3. **Upstream-file edits, last resort.** Each one is a future merge conflict.
   Record it in the ledger below *before* committing, with the reason, so every
   future sync knows what to protect.

## Deviation ledger

| File | Deviation | Why | Date |
|------|-----------|-----|------|

*(empty — baseline is pure upstream at tag `fork-baseline-20261031`)*

## Upstream sync ritual

1. `git fetch upstream`
2. `git merge upstream/main` — conflicts should only ever touch ledger rows.
3. Resolve using this ledger, run any checks the repo ships, push.
4. Consumers update with `npx skills update`, then re-check `_bmad/custom/`.

Small and often beats rare and painful.
