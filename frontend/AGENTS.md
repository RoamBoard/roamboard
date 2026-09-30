<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Roamboard frontend instructions

These instructions apply to work inside `frontend/`. Roamboard is a student project. Keep code simple, readable, and easy for the team to explain.

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

## Working with the project

Make small changes using existing patterns without asking again when they are within the requested task and the design is clear. Ask before larger structural changes. Keep unrelated refactors out of the task and preserve the user's existing work.

Before integrating a feature, look for an existing backend contract. Follow the actual request and response shapes. Ask about missing contracts when they affect the implementation. Label mock data and simulated actions explicitly; do not describe mocked saving, authentication, or permissions as working backend behavior. Frontend visibility controls do not replace backend access checks.

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

Before finishing, review the diff for unrelated changes and generated files. Explain what changed and what was checked in short, plain language a student can follow. State any remaining limitations.
