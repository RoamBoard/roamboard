<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Roamboard frontend instructions

These instructions apply to work inside `frontend/`. Roamboard is a student project. Keep code simple, readable, and easy for the team to explain.

This is a living project guide. Agents may and should update `AGENTS.md` when the frontend architecture, backend contract, design system, testing process, dependencies, or supported features change. Keep updates factual, concise, and consistent with the code that actually exists. Clearly label planned work, mocks, and placeholders so future agents do not mistake them for implemented behavior.

## Current integrated surfaces

The home route (`/home`) uses the versioned backend destination flow for explicit place search and selected-destination context. The developer provider lab (`/dev/providers`) uses the backend `/api/v1/providers` routes for Mapbox search/reverse geocoding/routing with saved map pins, Unsplash search, Google Places text search, Cloudinary upload and metadata handoff, and Elasticsearch fuzzy search/autocomplete. The Cloudinary panel accepts browser-generic HEIC/HEIF uploads, previews returned assets, and fetches EXIF/XMP/GPS metadata from the original Cloudinary asset when a loaded image is selected. Provider credentials remain server-side in the backend environment. The intentionally public Mapbox `pk.` token is returned only by the backend map-session endpoint after a map-load quota reservation; the general provider configuration response does not contain it.

## Project purpose and requirements

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

Reuse Cabinet Grotesk, Satoshi, and the existing tokens in `src/app/globals.css` where they match approved designs. Use semantic color tokens for surfaces and text that change with the theme. The current dark-mode placeholder values are not approved designs.

The application must work on desktop and smaller screens, in light and dark mode. Use semantic elements, accessible labels, keyboard access, and visible focus. Respect reduced-motion preferences. Keep common actions consistent and animations unobtrusive.

Show useful validation errors and action failures. Display loading or progress feedback for operations such as uploads, searches, saving, copying Boards, and recommendations. Ask about unspecified validation rules instead of inventing restrictions on names or usernames.

## Code organization and readability

Follow the existing structure:

| Location | Purpose |
| --- | --- |
| `src/app/` | Routes, page composition, layouts, and route metadata |
| `src/components/layout/` | Shared page structure, including the app shell and sidebar |
| `src/components/ui/` | Reusable interface components |
| `src/components/features/` | Components specific to a feature |

- Prefer straightforward functions and components, descriptive names, and explicit prop types.
- Extract shared code when actual reuse or readability warrants it. Avoid unnecessary wrappers, generic frameworks, and complicated TypeScript.
- Keep state local unless multiple components need it. Do not introduce shared state tools for a single component.
- Keep Server Components as the default. Add `"use client"` at the component boundary that needs browser APIs or interactive state.
- Keep TypeScript strict settings and use the existing `@/` alias for imports from `src/`. Fix type errors without disabling checks.
- Follow the ESLint configuration: declare variables with `const`, never `let` or `var`, and do not use `console` calls. A comment mentions `debug`, but no logging library is configured in the frontend manifest; do not assume one is available.
- Add comments when they explain a non-obvious decision. Avoid comments that repeat the code.
- Keep UI behavior and copy consistent with the backend's API states: loading, empty, validation, unauthorized, forbidden, not-found, conflict, and unexpected-error states should be represented intentionally where they apply.

## Tools and dependency decisions

The current stack is Next.js App Router, React, TypeScript, and Tailwind CSS v4. Read the relevant installed Next.js documentation as required by the generated block above before changing framework-dependent code.

The proposal describes these tools, but they are not currently declared frontend dependencies:

| Proposed tool | Intended use after approval |
| --- | --- |
| shadcn | Primitives for complex interface components where needed |
| Motion | Animations and interface transitions where useful |
| Storybook | Developing and documenting reusable UI components |
| TanStack Query | Backend data fetching, caching, loading states, and refetching |
| Zustand | Optional shared client state when local state is insufficient |

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

| Command | Purpose |
| --- | --- |
| `pnpm install` | Install the declared dependencies |
| `pnpm dev` | Start the development server |
| `pnpm lint` | Run ESLint |
| `pnpm exec tsc --noEmit` | Check TypeScript |
| `pnpm build` | Check the production build |

Do not mix package managers or create another package manager's lockfile. Keep `node_modules/`, `.next/`, and other generated output out of Git.

## Verification and handoff

For application changes, run the relevant lint and TypeScript checks. Run a production build for routing, configuration, dependency, or integration changes. Report command failures and checks that could not run.

For UI changes, inspect the affected flow on desktop and a smaller screen, including keyboard behavior and relevant loading, error, and empty states. Check both themes when the change affects them. Missing designs must be clarified before implementing those states. Report when browser inspection was unavailable.

There is currently no frontend test runner or test script configured. Do not invent test commands or install testing tools without approval. Documentation-only edits need content and link checks, not application tests.

### Independent frontend and API testing

Tests are a first-class deliverable when a feature needs them, not self-validation added merely to make an implementation appear complete. Separate implementation from test authorship whenever practical:

1. One agent or developer owns the feature contract and implementation, including its user states, backend calls, permissions, and expected behavior.
2. A separate agent or developer, who did not implement the feature, reviews the contract and writes the component, presenter, integration, or end-to-end tests independently. They should not copy implementation branches, helper names, fixtures, or internal assumptions into the tests.
3. The test author verifies the public behavior a user depends on, including successful interaction, loading, empty, validation, authorization, network failure, and persistence feedback where relevant. Tests should fail for meaningful feature defects, not only for missing elements or implementation details.
4. A reviewer compares test cases to the requirements and backend contract, checks important cases are not omitted, and runs the tests against the real page/API wiring. Do not accept tests that only exercise mocked data when the feature claims to use the backend.

If staffing makes separation impossible, record that limitation in the handoff and require a separate review of test intent and coverage before treating the feature as verified. Do not weaken tests to match an implementation; change the implementation or explicitly revise the agreed contract. Until a frontend test runner is approved and configured, use the available lint, TypeScript, build, and manual/browser checks and report the remaining test gap honestly.

Before finishing, review the diff for unrelated changes and generated files. Explain what changed and what was checked in short, plain language a student can follow. State any remaining limitations.
