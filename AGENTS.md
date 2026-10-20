# Roamboard shared agent instructions

## Active applications

`backend/` is the active backend. Make all new backend features, fixes, tests, and infrastructure changes there, following
[`backend/AGENTS.md`](backend/AGENTS.md).

`frontend/` and `backend/` are the supported applications. The old demo backends have been removed; do not recreate
them or use their historical documentation to define current product behavior. Database schema lives in
`backend/db/migrations/`; do not maintain a separate root schema copy.

When the user says **"enter contract mode"** (or explicitly asks for a joint frontend/backend feature contract), read and follow [`CONTRACT_MODE.md`](CONTRACT_MODE.md) before proposing endpoints or changing feature code. Contract mode is a discussion and documentation workflow. Do not treat a mock UI, a database table, or an agent's proposal as a team decision.

Instructions in `frontend/AGENTS.md` and `backend/AGENTS.md`, when present on the current branch, still apply to implementation work in those directories. The user's current decisions take precedence over older drafts and project documents.
When instructions differ from architectural design, notify team and ask for approval.

## Supplied frontend images

[docs/IMAGE_WORKFLOW.md](docs/IMAGE_WORKFLOW.md) is the cross-repository image authoring, delivery and recovery guide.

When a teammate supplies images or image links for a frontend task, follow the automatic image registration workflow
in [`frontend/AGENTS.md`](frontend/AGENTS.md). Register images through the backend tooling, verify the saved reference,
and wire it into the requested page as part of the task. Do not ask teammates to perform Labs uploads or commands that
their coding agent can perform with the configured environment. Missing credentials or attribution must be reported
honestly; never invent persisted IDs. See [`contracts/image-library.md`](contracts/image-library.md).

## Formatting

Use the root [`.prettierrc`](.prettierrc) as the single source of truth for frontend and backend formatting. Do not add nested Prettier configurations or override its rules manually. This includes TypeScript, TSX, JavaScript, JSON, CSS, and Markdown. The configured print width is 120 to keep longer imports, type declarations, and function signatures together where Prettier allows. SQL files are excluded from Prettier; preserve their existing formatting.

Prettier is installed in the root `package.json` and must be run from the repository root. Do not install separate copies in frontend or backend. Every agent must run the following after its final edits, before handing off work or preparing a PR:

```powershell
pnpm.cmd format
pnpm.cmd format:check
pnpm.cmd lint
```

On Linux/macOS, use `pnpm format` and `pnpm format:check`. These commands cover every supported folder, respecting `.prettierignore`; keep generated output, lockfiles, and SQL files excluded. Review the formatting diff and report any failed checks. If formatting changes unrelated files, keep that cleanup separate from feature changes when preparing commits.

Prettier formats code and checks formatting; it does not replace ESLint, TypeScript checks, tests, or builds. Run the applicable frontend/backend checks required by their instructions as well.

[Formatting CI](.github/workflows/format-ci.yml) runs `pnpm format:check` on all pull requests and pushes to `main`. Frontend and backend CI also run ESLint on all pull requests; warnings fail the lint check.

## Linting

ESLint remains installed in each application. Both configurations import common rules and Prettier compatibility from [`eslint.shared.mjs`](eslint.shared.mjs). Keep shared rules there and framework-specific rules in the application's config. Shared rules require strict equality, prohibit `var` and console calls, and prefer `const` when a variable is never reassigned. The frontend additionally retains its const-only requirement; the backend permits `let` for reassigned state.

Every agent must run `pnpm.cmd lint` from the root after final edits and before handoff or PR preparation (`pnpm lint` on Linux/macOS). `pnpm.cmd lint:fix` applies available ESLint fixes to both applications; review them, run Prettier afterward, and rerun lint. Do not disable rules merely to pass checks. Install root dependencies as well as application dependencies because the shared config uses root-installed `eslint-config-prettier`.
