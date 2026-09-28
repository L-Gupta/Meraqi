---
name: context-hierarchy
description: Build or refresh a leaves-to-root context hierarchy of nested CLAUDE.md files so Claude Code auto-loads the right context per directory
---

# Context Hierarchy

Recursive summarization, leaves to root, as nested `CLAUDE.md` files — Claude Code loads a
directory's `CLAUDE.md` automatically once it reads a file there, so context loading stops
being something anyone has to remember to do by hand.

Ported from the CS639 p2 project's `.claude/skills/context-hierarchy` on 2026-09-27; course-
specific wording removed.

## Why CLAUDE.md, not README.md

`README.md` is reserved for human-facing "how do I get started" docs (e.g. `frontend/README.md`,
`backend/test-docs/README.md`). Using `CLAUDE.md` for the hierarchy means it never competes with
an existing README, and gets automatic on-demand loading for free.

## Scope

The source tree: `backend/app/**`, `backend/tests/**`, `frontend/**` (excluding `node_modules/`,
`.next/`), and `.github/`. Not the repo root's human docs (`README.md`) or `docs/` — the root
`CLAUDE.md` is the top of the hierarchy and points into `docs/`.

Granularity: a directory gets its own `CLAUDE.md` when it's a meaningful module. Directories of
one or two trivially-related files (e.g. each Next.js route folder, `frontend/lib/*`) are
described in their parent's `CLAUDE.md` instead of getting near-empty files of their own.

## Procedure

1. Start at the deepest source directories. For each, write a `CLAUDE.md`:
   - **Purpose** — one or two sentences
   - **Contents** — one line per file, what it does
   - **How it fits in** — its role relative to the parent
   - **Gotchas** — anything incomplete, a TODO, an invariant not to assume away
2. Confirm each file with the user before moving up — a quick check, not a rubber stamp.
3. One level up, write that directory's `CLAUDE.md` by reading the child files just written —
   not by re-reading their source. Re-deriving from source at every level defeats the
   compression. (A parent's *own* direct files, if any, are still read directly.)
4. Repeat to the root.

Keep each file short — it's loaded into context automatically. Point to `docs/` for anything
`docs/` already owns instead of restating it.

## Refreshing

Don't regenerate the whole tree. Update only the directories that actually changed, and their
ancestors only if the change affects the parent's summary. See the `context-sync` rule, which
does this automatically as you work, and the Session-End Maintenance checklist in the root
`CLAUDE.md`.

## Deliberate vs. automatic loads

When another skill needs to scope context explicitly (e.g. before a spec review or a
zero-context goldfish test), read the relevant `CLAUDE.md` files directly rather than relying on
automatic on-demand loading.
