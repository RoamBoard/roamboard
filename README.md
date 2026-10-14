# roamboard

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
