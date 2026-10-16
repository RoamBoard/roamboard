# Database published-board viewer implementation plan

Goal: Open every existing and newly published database Board in the full published-board design at `/boards/{boardId}`.

Architecture: Keep the existing credentialed Board API and its access checks. Add a safe author summary to Board
documents, adapt documents into the viewer's presentation model, and load numeric Board routes through that boundary.
The sample slug routes remain available for the unchanged Discover preview.

Stack: Express, PostgreSQL, Next.js App Router, React and TypeScript, using installed dependencies.

Spec: The user's approved scope in this conversation: published-board viewer first, author name from the database
username, existing and future published Boards, and clearly labelled tab-only save/copy previews.

## Constraints

Use the existing layout and loading/error presentation. Keep visibility enforcement in the backend. Do not generate
static pages or copy database content into fixtures. Do not change Discover, credentials, applied migrations or the
pre-existing change to `backend/package-lock.json`. Hide unsupported author statistics and Highlights for database Boards.

## Review focus

Access to a Board must also govern access to its author's photo. Missing or inaccessible Boards must not show sample
content. Drafts must remain in the draft editor. Preserve empty days and saved activity/photo order. Use usernames
instead of display names, and keep provider image credit visible.

## Task 1: Read real author details

Files: `backend/src/features/boards/boards.types.ts`, `boards.repository.ts`, `boards.schemas.ts`, and the image
controller/service/types. Update `backend/BOARD_API_CONTRACT.md`.

Interface: Board documents add `author: { username, bio, photo: { imageId, url } | null }`. Author-photo URLs include
the Board ID; the image endpoint verifies the Board is readable and that its owner's current profile picture matches.
No Google identity, email, provider storage keys or unsupported statistics are returned in the summary.

- [x] Add independent database tests for public author details, protected reads and author-photo access.
- [x] Observe the missing behavior fail, then add the summary and image authorization.
- [x] Run the focused tests and backend CI checks.

## Task 2: Render database Boards in the published design

Files: New `frontend/src/lib/published-board-data.ts`, `published-board-store.ts`, and
`src/components/features/boards/DatabasePublishedBoard.tsx`. Update the numeric page route, presentation types,
`PublishedBoard`, `ActivityDetailsDialog`, and relevant documentation.

Interfaces: `toPublishedBoardData(document: BoardDocument): PublishedBoardData` maps canonical data without invented
author text or images. `createPublishedBoardStore(boardId)` loads through `loadBoardDocument`, exposes a subscription
and a retry action, and maps missing/auth/permission/network states to the existing message layout. The component uses
the store and renders the existing `PublishedBoard`. The Board API error preserves HTTP status for these states.

- [x] Add independent tests for real request wiring, loading, retry, access errors, drafts, ordering, empty days,
      author username, tags and photos.
- [x] Observe failures, then implement the data adapter and client loading boundary with session cookies.
- [x] Reuse the published layout for numeric routes, show edit access when permitted, and label previews accurately.
- [x] Run frontend tests, TypeScript and the production build.

## Task 3: Verify the complete flow

- [x] Inspect existing database Boards through the actual API and frontend at desktop and smaller widths, both themes.
- [x] Run root `pnpm.cmd format`, `pnpm.cmd format:check`, and `pnpm.cmd lint` after final edits.
- [x] Review the final diff and independent test coverage. Report any unavailable check.

## Verification result

All four existing published Boards passed read-only username and access checks. The signed-in browser opened an
existing friends-only Board in the full design. Desktop and 390px mobile layouts, both themes, image loading,
activity details and Escape dismissal were checked. A long-username footer overflow and a single-activity preview
copy retaining unrelated source days were corrected; independent review is clean.

Frontend: 64 tests passed, TypeScript passed, production build passed. Backend: 43 normal tests and 8 isolated
database/API checks passed, plus lint, TypeScript and build. Root formatting and lint passed. The installed runtime
is Node 20.12 rather than the backend's declared Node 24: the standard frontend test command cannot expand its glob,
and the default backend runner discovers no TypeScript tests on this runtime. Both complete suites were therefore
run with explicit file arguments and a process-local fetch preload; no package scripts or system settings changed.

Implementation proceeds in the current checkout to preserve the configured database tunnel and local environment.
No commit, push or shared-database migration is part of this request.
