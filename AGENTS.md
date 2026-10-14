# Roamboard shared agent instructions

When the user says **"enter contract mode"** (or explicitly asks for a joint frontend/backend feature contract), read and follow [`CONTRACT_MODE.md`](CONTRACT_MODE.md) before proposing endpoints or changing feature code. Contract mode is a discussion and documentation workflow. Do not treat a mock UI, a database table, or an agent's proposal as a team decision.

Instructions in `frontend/AGENTS.md` and `backend/AGENTS.md`, when present on the current branch, still apply to implementation work in those directories. The user's current decisions take precedence over older drafts and project documents.
When instructions differ from architectural design, notify team and ask for approval.

## Formatting

Use the root [`.prettierrc`](.prettierrc) as the single source of truth for frontend and backend formatting. Do not add nested Prettier configurations or override its rules manually. This includes TypeScript, TSX, JavaScript, JSON, CSS, and Markdown. The configured print width is 120 to keep longer imports, type declarations, and function signatures together where Prettier allows. SQL files are excluded from Prettier; preserve their existing formatting.

From the repository root, run `pnpm format:apps` and `pnpm format:apps:check` before handing off changes in `frontend/` or `backend/`. For a smaller change, format the edited files with `pnpm exec prettier --write <paths>`, then run `pnpm format:apps:check`. Respect `.prettierignore` and keep generated output, lockfiles, and SQL files out of formatting changes.

[Formatting CI](.github/workflows/format-ci.yml) runs `pnpm format:apps:check` on pushes and pull requests to `main`.
