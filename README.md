# roamboard

## Where to develop

Use [`frontend/`](frontend/README.md) for frontend work and [`backend/`](backend/README.md) for all backend development.
`layered-backend-demo1/` is abandoned and unsupported, pending deletion in a later PR. It is not maintained or expected
to run, build, or pass tests. Bugs confined to that folder are out of scope for fixes and code review follow-up.
Do not add features, fixes, tests, or infrastructure there; use `backend/` and its [agent instructions](backend/AGENTS.md).

## Run the project with the team's Azure database

Follow [the backend team quick start](backend/README.md#team-quick-start-local-backend-shared-azure-database)
to install dependencies, configure the existing `backend/.env`, open your SSH tunnel,
and run `npm.cmd run check:setup` followed by `npm.cmd run dev` from `backend/`.
The database runs in Docker on Azure; teammates run Express locally and share its data.
Ask the maintainer for SSH access and application credentials before starting.

Then follow [the frontend instructions](frontend/README.md#local-development). Both
applications must use the same Google web client ID. Keep the tunnel and both dev servers
running. Do not create another database or reapply shared migrations when joining the team.

## Checks before a PR

From the repository root, install the shared formatting dependencies with `pnpm install`.
Install application dependencies with `pnpm --dir frontend install` and `npm --prefix backend ci`.
Before opening a PR, run:

```powershell
pnpm.cmd format
pnpm.cmd format:check
pnpm.cmd lint
```

On Linux/macOS, use `pnpm` instead of `pnpm.cmd`. Prettier handles repository-wide
formatting; ESLint checks frontend and backend code using their framework presets and
the common rules in `eslint.shared.mjs`. `pnpm.cmd lint:fix` applies available ESLint
fixes; review the changes, then rerun formatting and lint checks. Application tests,
type checks, and builds remain separate requirements in each application's agent guide.

GitHub Actions runs formatting, frontend lint/typecheck/build, and backend
lint/typecheck/tests/build on every PR and on pushes to `main`. To require passing
checks before merging, configure the corresponding checks in GitHub branch protection
or a repository ruleset.
