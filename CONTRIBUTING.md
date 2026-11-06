# Contributing

Issues and pull requests are welcome.

- Keep the pipeline local-first: no new network calls or paid APIs without discussing them in an issue first.
- Pin any new dependency to an exact version (and a commit or revision for git and model downloads).
- Run the checks CI runs: `bash -n` and `shellcheck -S warning` on the shell scripts, `python -m py_compile pipeline/*.py`, and `node --check` on the `.mjs` files.
- If you change `compose/kit.mjs` or `report/report.mjs`, re-run `repotage build examples/self-demo`, `repotage check examples/self-demo`, and look at a few `repotage snapshot` frames.
- Never commit captures, recordings or reports of an app that is not yours to publish.
