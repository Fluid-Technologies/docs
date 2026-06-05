# Fluide Connect documentation (Mintlify)

This repository is the **deploy target** for Mintlify ([Git Settings](https://app.mintlify.com): `Fluid-Technologies/docs`, branch `main`).

**Do not edit here by hand.** Content is published from [FluideConnect](https://github.com/Fluid-Technologies/FluideConnect):

```bash
# In FluideConnect
node export-openapi.mjs
node scripts/sync-to-docs-repo.mjs /path/to/docs-checkout
cd /path/to/docs-checkout && git add -A && git commit && git push
```

CI in FluideConnect runs export + publish on merge to `main` when `DOCS_REPO_PAT` is configured.

Last sync source: FluideConnect @ 2026-06-05T12:09:52.874Z
