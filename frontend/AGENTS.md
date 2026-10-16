<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Roamboard frontend instructions

These instructions apply to work inside `frontend/`. Roamboard is a student project. Keep code simple, readable, and easy for the team to explain.

This is a living project guide. Agents may and should update `AGENTS.md` when the frontend architecture, backend contract, design system, testing process, dependencies, or supported features change. Keep updates factual, concise, and consistent with the code that actually exists. Clearly label planned work, mocks, and placeholders so future agents do not mistake them for implemented behavior.

## Current integrated surfaces

`Sidebar` is shared by `AppShell` and `PublishedBoardShell`. It uses a fixed 64px mobile / 80px desktop rail; desktop expansion overlays content and is saved in `roamboard-sidebar-expanded` local storage. Navigation uses icons with lowercase labels on expansion and an underlined active destination, ordered Roam, Create, Discover, Boards, Social. Mobile expansion opens a native modal drawer. The sidebar account control expands its sign-in/profile, disabled Settings, and Light/Dark choices inline above the trigger, pushing Labs upward. Navigation scrolls at every height; the account panel has a viewport-based height bound and its own scrolling, with a rail scrolling fallback on very short screens. Active destinations are derived from the pathname, including nested creation, Board, Discover, profile, and developer routes. Discover keeps its own scroll-driven intro behavior independently of navigation expansion.

The `/dev` index links to the implemented frontend routes and explains how to open `/boards/[boardId]` with a saved Board ID. The creation landing page is `/create`; `/boards` implements Boards Page 7.0: a featured Motion spatial gallery of up to five existing V1 collage cards and an independent shadcn/Embla V2 compact library with momentum dragging and snapping, keyboard/wheel navigation, a scroll indicator, and progressive loading near the end. It loads owner-published summaries and documents through the existing API, with paginated loading and local search over loaded Boards. A summary-list failure displays clearly labelled visual sample fixtures; samples have no detail links or persistence. The page request store (`src/lib/my-boards-store.ts`) keeps successful document reads when individual Boards are unavailable and retries only failed documents without discarding the current collection. Page/API regression tests render the production content and invoke its search, pagination, and retry handlers through the real request helpers. Recently Saved reuses the V1 gallery with an independent selection and side details. The grouped Archive / Saves area reuses V2 libraries. These saved/archive collections are explicitly labelled sample data until backend state APIs exist; they never persist fake changes. Search filters created, saved, and archived collections independently. The Board creator remains `/boards/new`. Creation and editing routes highlight Create; published Board viewing and `/boards/mine` highlight Boards.

The Board creator now uses the versioned Board and image upload-intent endpoints with the session cookie. Existing drafts are listed at `/boards/drafts` and reopen at `/boards/drafts/[boardId]`; saving again sends the Board revision to the backend. `/create` contains the creation landing page and links to `/boards/mine`, which lists the signed-in owner's published Boards. Published Boards open for editing at `/boards/[boardId]/edit`; owners can edit content and visibility, while members with the editor role can edit content but not visibility. The creator has one selected Board cover and lets users attach several uploaded images to an activity, order them, and choose its activity cover. Unattached uploads can be assigned while editing an activity. The creator uses the backend's allowed tag list. Geoapify location search/reverse geocoding and Unsplash search are implemented in the current backend, with missing-key, quota and provider-failure states. Manual coordinates remain available. Vibe and Highlights controls are absent by agreement. The developer provider lab remains separate from persisted Board media.

The Home destination explorer uses the current backend for Mapbox search, Open-Meteo weather, Wikipedia descriptions and Unsplash imagery, with partial-failure feedback. All API clients use NEXT_PUBLIC_API_URL and session cookies.

`/discover/destinations/[slug]` renders the reusable Destination Atlas for Kyoto, Paris and Copenhagen from
`src/data/destination-atlas.ts`. These are editorial mock guides with local, credited photography, destination-specific
compositions, seasonal notes, category-filtered places and native modal place details with Motion photo transitions.
The horizontal exhibition uses native trackpad/touch/Shift-wheel scrolling, chapter links, arrows and a single position slider; long information panels scroll vertically. Mouse-wheel input is not remapped. The bright introduction preserves the circular Figma hero, with an entrance rotation and compact typography in its wider reading panel.
Kyoto's opening copy, pins and tags are transcribed from Figma frame `55:1060`; other cities retain existing mock copy.
The compact Credits disclosure retains destination navigation and photography attribution without an extra full-height panel.
Place details support map/visitor links and previous/next browsing. Existing country destination routes remain available.
Home routes recognized city search results to guides (matching city identity, ISO alpha-3 country and provider place type);
other search results retain their compact live briefs. Discover search and its Kyoto feature link to guides.
The destination story gallery uses Motion to focus and rearrange unchanged V1 collage cards, with button, keyboard and drag selection. Its mock stories have no detail links or persistence; an optional real Board href is respected when supplied. Seasonal controls live in a separate white, ruled editorial interlude. The Trending destinations section uses a destination-specific asymmetric photo grid, a fixed near-black palette, animated filtering and shared-photo native-dialog details. The concluding Create panel returns to the page theme; Kyoto’s closing image rotation follows the Figma artwork. Create links open the existing
blank `/boards/new` flow; destination prefill, activity saving and copying are future integrations. Editorial guide data
does not create backend destination/location records. Photo sources and rights notes live in `public/images/destinations/README.md`.

The developer Board browser (/dev/boards) lists paginated accessible Boards and inspects canonical days, activities, tags and protected images; deletion remains owner-only. The profile lab (/dev/profile) reads and edits the signed-in account, accepts owned uploaded image IDs for pictures, creates test Boards through the canonical Board endpoint, and reads statistics, recent owned Boards and activity-derived map destinations. Its globe retains planned/visited styling and obtains a quota-reserved Mapbox session. There is no seeded-user fallback or prototype identity header.

The provider lab (/dev/providers) uses current backend Mapbox, Geoapify, Unsplash, Google Places, Cloudinary and Elasticsearch routes. Cloudinary lab uploads are separate from Board media and restricted to the lab prefix/tag. Cloudinary/Google management tools, developer Board listing and search reindexing require a signed-in session with the backend in development mode. Provider credentials stay server-side; only an intentionally public Mapbox pk. token is returned after a map-load reservation. PostgreSQL persists shared provider budgets across restarts. Search indexes only real public, published Boards and checks fresh database visibility before returning records or suggestions. Activities and locations are not standalone indexed results. The separate Mapbox search uses Search Box for POIs, restaurants and landmarks with its own quota; Home retains city geocoding, and persistent Board locations still use Geoapify. Backend setup, limitations and response shapes are documented in [API_FEATURES_CONTRACT.md](../backend/API_FEATURES_CONTRACT.md).

## Project purpose and requirements

Country codes in application data, mock/discovery data, provider responses and
country selection use ISO 3166-1 alpha-3. The existing country-name and fuzzy
selection helper reads `shared/country-codes.json`, also used by the backend.
Mapbox boundary filters use `iso_3166_1_alpha_3`. Keep two-letter formats only at
external boundaries that require them; see [country-code notes](../shared/COUNTRIES.md).

Read [REQUIREMENTS.md](REQUIREMENTS.md) before changing feature behavior. It contains the supplied frontend requirements, which take precedence over the project proposal. It describes intended behavior, not a list of already implemented features. Implement the requested task without expanding it to the entire requirements document.

A Board is either a planned itinerary created before or during a trip, or a travel journal created during or after a trip. Users can keep and share their Boards.

Required functionality includes:

- Creating, editing, deleting, completing, and tagging Boards; choosing covers; uploading photos; reordering content; and copying whole Boards or individual activities and locations.
- Board content with activities, locations, relevant dates and times, descriptions, images, maps, and walking routes.
- Searching public Boards by destination or keywords, including semantic searches; removing duplicate results; filtering; showing discovery suggestions; and saving Boards for later.
- Sharing links and clearly showing access: owner, the owner's friends, or anyone.
- Accounts with persistent login, editable profiles, profile pictures, interests, and a visited-places map based on completed Boards.
- Friend requests, adding and removing friends, permitted profile viewing, and a Friends page with friends' Boards and recommended users.

Keep conditional features conditional. Simple text formatting is included only if the editor is implemented. Google or similar sign-in depends on feasibility. Charts, profile travel statistics, and animations are optional where useful. Communities, richer journal editing, and suggested itineraries are possible extensions, not required work.

## Design and interaction

Figma designs supplied by the user are the visual reference. No Figma link is recorded here, and access must be checked when a link is supplied. Never claim to have inspected a design that was unavailable.

Ask the user before implementing every missing or unclear design detail. This includes layouts, interaction behavior, responsive changes, dark mode, and loading, empty, or error states. Do not invent a design to fill a gap. Continue other work within the requested task that does not depend on that decision.

Reuse Cabinet Grotesk, Satoshi, and the existing tokens in `src/app/globals.css` where they match approved designs. Use semantic color tokens for surfaces and text that change with the theme. The current dark-mode palette is approved by the user.

Dark mode uses a `dark` class on `<html>`. `ThemeSelect` switches between Light and Dark and saves the choice in local storage; `layout.tsx` restores it before painting. New components should use `bg-background`, `text-foreground`, `text-muted-foreground`, and `border-line` instead of fixed interface colors. Define new theme colors in both `:root` and `.dark` in `globals.css`. Keep intentional photo lettering and transition colors fixed.

The application must work on desktop and smaller screens, in light and dark mode. Use semantic elements, accessible labels, keyboard access, and visible focus. Respect reduced-motion preferences. Keep common actions consistent and animations unobtrusive.

Show useful validation errors and action failures. Display loading or progress feedback for operations such as uploads, searches, saving, copying Boards, and recommendations. Ask about unspecified validation rules instead of inventing restrictions on names or usernames.

## Code organization and readability

Prettier is the source of truth for formatting. Use the repository's root [`.prettierrc`](../.prettierrc): indent with four spaces and never tabs, use double quotes in JavaScript and TypeScript, do not use trailing commas, and use LF line endings with a final newline. Use the configured print width of 120 to keep longer lines together where Prettier allows. Do not add a nested Prettier configuration. Every agent must run `pnpm.cmd format` and `pnpm.cmd format:check` from the repository root after final edits and before handoff or PR preparation. On Linux/macOS, use `pnpm format` and `pnpm format:check`. Use the root-installed Prettier; do not install another copy in frontend. Prettier does not replace the required ESLint, TypeScript, test, or build checks. Review the formatting diff. Respect the root `.prettierignore` and exclude generated output, lockfiles, and SQL files; preserve existing SQL formatting.

Follow the existing structure:

| Location                   | Purpose                                                    |
| -------------------------- | ---------------------------------------------------------- |
| `src/app/`                 | Routes, page composition, layouts, and route metadata      |
| `src/components/layout/`   | Shared page structure, including the app shell and sidebar |
| `src/components/ui/`       | Reusable interface components                              |
| `src/components/features/` | Components specific to a feature                           |

- Prefer straightforward functions and components, descriptive names, and explicit prop types.
- Extract shared code when actual reuse or readability warrants it. Avoid unnecessary wrappers, generic frameworks, and complicated TypeScript.
- Keep state local unless multiple components need it. Do not introduce shared state tools for a single component.
- Keep Server Components as the default. Add `"use client"` at the component boundary that needs browser APIs or interactive state.
- Keep TypeScript strict settings and use the existing `@/` alias for imports from `src/`. Fix type errors without disabling checks.
- Follow the ESLint configuration: declare variables with `const`, never `let` or `var`, use strict equality, and do not use `console` calls. Common code rules and Prettier compatibility live in `../eslint.shared.mjs`; keep Next.js and frontend-only rules in `eslint.config.mjs`. Every agent must also run `pnpm.cmd lint` from the repository root before handoff or PR preparation. Warnings fail the lint check. Install root dependencies as well as frontend dependencies. No logging library is configured in the frontend manifest; do not assume one is available.
- Add comments when they explain a non-obvious decision. Avoid comments that repeat the code.
- Keep UI behavior and copy consistent with the backend's API states: loading, empty, validation, unauthorized, forbidden, not-found, conflict, and unexpected-error states should be represented intentionally where they apply.

## Tools and dependency decisions

The current stack is Next.js App Router, React, TypeScript, Tailwind CSS v4, and Motion for React. Read the relevant installed Next.js documentation as required by the generated block above before changing framework-dependent code.

Use Tailwind utility classes for interface styling and Motion for animated interactions and page transitions, as requested by the user. Motion is approved and installed. Keep shared theme tokens and global foundations in `src/app/globals.css`.

The proposal describes these tools, but they are not currently declared frontend dependencies:

| Proposed tool  | Intended use after approval                                    |
| -------------- | -------------------------------------------------------------- |
| shadcn         | Primitives for complex interface components where needed       |
| Storybook      | Developing and documenting reusable UI components              |
| TanStack Query | Backend data fetching, caching, loading states, and refetching |
| Zustand        | Optional shared client state when local state is insufficient  |

Ask before adding dependencies, including tools named in the proposal. Do not install them merely because they appear in this document.

When frontend logging is genuinely needed, use the project's approved `debug` convention with a browser-safe namespace such as `roamboard:frontend:boards`, after adding and reviewing the dependency. Do not use `console.log` or add a logger only for convenience. Keep secrets, tokens, private Board content, and personal data out of browser logs.

## Working with the project

Make small changes using existing patterns without asking again when they are within the requested task and the design is clear. Ask before larger structural changes. Keep unrelated refactors out of the task and preserve the user's existing work.

Before integrating a feature, look for an existing backend contract. Follow the actual request and response shapes. Ask about missing contracts when they affect the implementation. Label mock data and simulated actions explicitly; do not describe mocked saving, authentication, or permissions as working backend behavior. Frontend visibility controls do not replace backend access checks.

### Communicating with the backend

- Treat the backend as the source of truth for persisted users, Boards, activities, locations, images, visibility, friendships, saved resources, search, and authorization.
- Use the versioned REST API under `/api/v1` once an endpoint exists. Follow the backend response envelope: successful responses use `{ "data": ... }`; errors contain a stable code, safe message, and optional details.
- Keep frontend types, request helpers, and UI assumptions aligned with the actual backend contract. When a field or response changes, update the relevant frontend types and backend documentation together rather than silently adapting one side.
- Send cookies when the authentication design requires them, using the approved same-origin or credentialed request configuration. Never put JWTs, provider API keys, Cloudinary credentials, Mapbox tokens intended for server use, or other secrets into client-side source or local storage.
- Call the Roamboard backend for provider-backed work. The browser must not call Google Places, Unsplash, Cloudinary management APIs, Elasticsearch, or other secret-bearing services directly unless a documented public-client integration has been approved.
- The provider lab is intentionally a developer-facing surface, not persisted Board functionality. It must continue to show missing-key and provider-failure states without exposing credentials or pretending that Cloudinary uploads create Board media records, that GPS metadata is trusted without user confirmation, or that Google billing is available by default.
- Render loading and failure feedback for network operations. Map `401` to a login-required state, `403` to a permission state, `404` to a missing-resource state, `409` to a conflict state, and validation errors to actionable field feedback without exposing internal details.
- Do not assume a Board is saved because local state changed. Mark previews, mock data, optimistic updates, and simulated uploads clearly, and reconcile successful mutations with the server response.
- Keep API calls in a small, testable data-access boundary rather than scattering fetch logic through presentational components. Use the existing project patterns until a shared client or data library is approved.

When a contract is missing or ambiguous, pause the dependent UI change and ask for clarification or document the agreed contract. Do not invent authorization, pagination, provider behavior, or persistence semantics in the frontend.

Use pnpm, as declared in `package.json`, and preserve its lockfile. Run these commands from inside `frontend/` (`cd frontend` from the repository root):

| Command                  | Purpose                           |
| ------------------------ | --------------------------------- |
| `pnpm install`           | Install the declared dependencies |
| `pnpm dev`               | Start the development server      |
| `pnpm lint`              | Run ESLint                        |
| `pnpm exec tsc --noEmit` | Check TypeScript                  |
| `pnpm build`             | Check the production build        |

Do not mix package managers or create another package manager's lockfile. Keep `node_modules/`, `.next/`, and other generated output out of Git.

## Verification and handoff

### Account interface preview

The user has chosen Google-only sign-in. Email/password forms are not part of the planned login flow. The supplied requirements describe Google sign-in as conditional; this decision selects it for the implementation.

`/login` and `/signup` use Google's rendered sign-in button. The browser sends the Google credential to `POST /api/v1/auth/google` with credentials; the backend verifies it and sets an HTTP-only session cookie. The frontend reads the current user through `GET /api/v1/auth/me` and signs out through `POST /api/v1/auth/logout`. `ProfileControl` shows the authenticated user's name and an active logout option. `/dev/account` still uses a fictional preview user and keeps its logout button disabled.

Stable Roamboard user IDs and Google verification belong in the backend. The Google web client ID is shared through `NEXT_PUBLIC_GOOGLE_CLIENT_ID`; the Express API base URL is `NEXT_PUBLIC_API_URL`. Both are set in the ignored `frontend/.env.local` for local work. The client ID is public, while the Google client secret is not used by this flow.

`/welcome` is the returning-user landing page. It checks the backend session and uses the authenticated username; without a session, it routes to `/login`. New users go to `/home` after sign-in; returning users go to `/welcome`. `WelcomeScreen` accepts a username prop; names wrap within two lines at a responsive CSS font size; longer names are clipped instead of automatically shrunk. The user approved a light-only page, the supplied overlapping photo composition on smaller screens, and a click on ENTER to start a black-bar takeover before opening `/home`. Reduced-motion users go directly to `/home`. Images and text have separate layers for later animation work.

`WelcomeTransitionProvider` lives in the root layout so the black overlay persists during the Welcome-to-Home route change. Motion variants cover Welcome, wait for Home to render, and then slide upward to reveal Home. The bar and text use eased timing, starting from the measured ENTER position. Page content is inert during the transition, and ENTER ignores repeated activation until the reveal finishes. The welcome layout uses Tailwind utility classes. Motion's reduced-motion hook skips the takeover for users who prefer reduced motion.

For application changes, run the relevant lint and TypeScript checks. Run a production build for routing, configuration, dependency, or integration changes. Report command failures and checks that could not run.

For UI changes, inspect the affected flow on desktop and a smaller screen, including keyboard behavior and relevant loading, error, and empty states. Check both themes when the change affects them. Missing designs must be clarified before implementing those states. Report when browser inspection was unavailable.

The frontend uses `pnpm test` for its Node/TSX integration tests. Documentation-only edits need content and link checks, not application tests.

### Collapsed Board cards

`src/components/features/boards/cards/BoardCard.tsx` selects four independent layouts: `collage`, `compact`,
`landscape`, and `photo`. Their presentation types live in `src/types/board-card.ts`; they are not backend response
contracts. Cards use explicit Satoshi/Cabinet Grotesk fonts, local Figma assets, scoped theme tokens, and container
units to preserve their compositions at different widths. `SocialBoardCard` adapts the profile's existing mock
model to the shared collage layout.

`/dev/board-cards` renders all twelve Figma fixtures from `src/data/board-card-examples.ts` at their reference sizes
or fitted to the available width. Its bookmarks only change local gallery state. Reusable cards accept an optional
navigation URL and controlled bookmark callback; they perform no backend requests or persistence.

### RoamFlow discovery preview

Discover's RoamFlow section reuses `PhotoBoardCard` (V4) in responsive, staggered CSS Grid groups of seven.
`src/data/roamflow-boards.ts` contains 28 distinct fictional editorial stories with existing photography;
only `lost-in-tokyo` links to an implemented viewer. The paged mock source and presentation types in
`src/lib/roamflow.ts` are not a backend API contract. `useRoamFlow` handles request guards, cancellation,
deduplication, retry, and cursor progress. Automatic loading pauses after two pages until the user continues;
the skip link cancels pending loading and keeps the existing Discover footer reachable.

Cards reserve their 4:5 geometry, lazy-load images, and use CSS content visibility to avoid offscreen rendering.
This is not DOM virtualization: the mounted collection grows as pages are loaded. Reassess a windowed virtualizer
when a real public-Board source and substantially larger persisted collections are integrated.
`/dev/roamflow` provides slow-source, failure/retry, empty, reduced-motion, and 1,000-card stress scenarios.
Stress fixtures deliberately repeat photos and never appear in Discover. The reduced-motion scenario forces
the same animation branch as the system preference; the normal gallery respects the browser preference.

### Published board preview

`/boards/[boardId]` is a public viewer with the sample design at
`/boards/lost-in-tokyo`. It reuses the homepage sidebar and account control,
supports both themes and smaller screens, and opens full activity details in a
native dialog. Account loading does not gate board viewing. The account control
hides after the page is scrolled down.

The mock loading boundary is `src/lib/published-board.ts`. The existing Board
types now support optional one-based `dayNumber` on items and optional
`dayTitles`; calendar dates and activity times remain optional. Public board
author/highlight data is a frontend presentation shape awaiting a backend
contract. Backend photo URLs and fallbacks belong in the supplied image data.

`src/lib/board-preview.ts` uses tab-local session storage for preview bookmarks,
saved activities, and editable copies. These actions do not write to the backend
or represent account-owned resources.

`PublishedBoard` owns the selected activity and its open/close handlers.
`PublishedBoardDay` renders the timeline and cards, `ActivityDetailsDialog`
renders the selected activity, and `useBoardPreview` manages preview save/copy
state.

### Independent frontend and API testing

Tests are a first-class deliverable when a feature needs them, not self-validation added merely to make an implementation appear complete. Separate implementation from test authorship whenever practical:

1. One agent or developer owns the feature contract and implementation, including its user states, backend calls, permissions, and expected behavior.
2. A separate agent or developer, who did not implement the feature, reviews the contract and writes the component, presenter, integration, or end-to-end tests independently. They should not copy implementation branches, helper names, fixtures, or internal assumptions into the tests.
3. The test author verifies the public behavior a user depends on, including successful interaction, loading, empty, validation, authorization, network failure, and persistence feedback where relevant. Tests should fail for meaningful feature defects, not only for missing elements or implementation details.
4. A reviewer compares test cases to the requirements and backend contract, checks important cases are not omitted, and runs the tests against the real page/API wiring. Do not accept tests that only exercise mocked data when the feature claims to use the backend.

If staffing makes separation impossible, record that limitation in the handoff and require a separate review of test intent and coverage before treating the feature as verified. Do not weaken tests to match an implementation; change the implementation or explicitly revise the agreed contract. Use the configured tests, lint, TypeScript, build, and manual/browser checks and report the remaining test gap honestly.

Before finishing, review the diff for unrelated changes and generated files. Explain what changed and what was checked in short, plain language a student can follow. State any remaining limitations.
