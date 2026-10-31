# Web-access kit — certainty for deep-recon

Removes the "which search surfaces exist?" discovery loop from
`bmad-deep-recon` in the pi harness. The shipped skill checks for web tools at
every run's plan gate ("check, don't assume"); this override declares what is
true so no run ever has to discover it:

- pi has no built-in web-search tool and no search MCP servers installed
- the web channels are **bash + curl** and the authenticated **gh CLI**
- how to use each (fetch, sample, probe, DuckDuckGo HTML search, gh search)
- report audience: plain-language register, terms defined on first use

## Install into a consumer project

Copy `bmad-deep-recon.toml` into `{project-root}/_bmad/custom/` and commit it
there. Verify with:

```
uv run _bmad/scripts/resolve_customization.py --skill .agents/skills/bmad-deep-recon --project-root . --key workflow.external_sources
```

## Maintenance

- If a web channel changes (an MCP search server gets installed, or pi ships a
  web tool), update the override — and delete this kit's reason to exist if it
  becomes obsolete.
- The `gh CLI` entry names the authenticated account; re-check after any auth
  change.
