# Git Conventions (Observed in History)

`CLAUDE.md` §1–§2 fully specify branching prefixes and Conventional Commits
format — read those; not restated here. Additionally, from actual git
history:

- **PRs are merged via GitHub, not local `git merge`** — every feature
  branch in the log has a corresponding `Merge pull request #N from
  L-Gupta/<branch>` commit. Don't merge a `feat/`/`fix/` branch into `main`
  locally; open a PR per `CLAUDE.md` §1/§3a and let it merge there once CI
  is green.
- **Commit subjects are consistently imperative and scoped**, matching
  Conventional Commits exactly (`feat:`, `fix:`, `test:`, `chore:`,
  `docs:`) — e.g. `fix: stop returning password-reset tokens in the API
  response`, `test: cover inquiry CRUD, IDOR, and decision-queue
  derivation`. Don't drift into free-form subjects.
- **A `test:` commit following a `feat:` commit on the same branch is a
  normal, established pattern** — in practice recent history shows tests
  committed directly on the `feat/` branch rather than always via a
  separate `test/` branch merged back in. If unsure whether a change
  warrants a separate `test/` branch or a same-branch `test:` commit,
  default to `CLAUDE.md` §1's documented flow and ask if the task's scope
  makes that ambiguous.
