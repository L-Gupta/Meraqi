# If In Doubt

These rule files (`.claude/rules/`) are the operating manual for **any** AI
working in this repo, Claude Code included. They don't replace `CLAUDE.md`
(branching, commit discipline, CI gate, testing tiers, security-sensitive
code flagging) — they add the layer it doesn't cover. **No global
(`~/.claude/CLAUDE.md`) file exists for this user**; this repo's
`CLAUDE.md` plus these rules are the complete operating instructions.

When a situation isn't clearly covered by `CLAUDE.md`, these rules, or an
obvious extension of an existing pattern in the code:

- **Default to asking the product owner, not guessing.** This repo has
  already shown a real cost of guessing wrong: an in-progress branch built
  a reasonable-looking override feature that turned out to conflict with a
  hard product rule the owner hadn't stated anywhere in writing until asked
  directly (see [engine-numbers-finalized.md](engine-numbers-finalized.md)).
  A clarifying question costs one exchange; a wrong architectural guess
  costs a branch.
- **When a new task would touch security-sensitive code** (`CLAUDE.md` §4's
  list, or anything under `data/`), **flag it explicitly in the commit
  message and PR description** even if the change seems small.
- **When the codebase and a doc (`CLAUDE.md`, `docs/PRD.md`,
  `docs/ARCHITECTURE.md`, these rules) disagree, don't silently pick one.**
  State both what the doc says and what the code actually does, and let the
  product owner resolve it. Two such contradictions have already been found
  and resolved (the mock-LLM policy in [testing.md](testing.md) and the
  finalized-numbers rule); assume more exist.
- **When a rule would block otherwise-reasonable progress** (e.g. a task
  seems to require touching `data/` outside `json_io.py`, or adding a
  library not listed in [backend-stack.md](backend-stack.md) /
  [frontend-stack.md](frontend-stack.md)), **stop and ask rather than
  making the exception yourself.** The rule may need updating — but that's
  the product owner's decision, not something to route around silently.
- **When you find a violation of a rule while working on something else**,
  flag it in your response rather than silently fixing it as a drive-by
  change (unless the task is specifically to fix it) — an unrequested fix
  to unrelated code is its own kind of scope creep.
