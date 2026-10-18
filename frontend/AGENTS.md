<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Roamboard frontend instructions

## Website image library

The cross-repository reference is [docs/IMAGE_WORKFLOW.md](../docs/IMAGE_WORKFLOW.md). Existing editorial page data now
uses explicit `library:` keys. `shared/editorial-images.json` retains only imported key/source aliases for initial-render
and failure fallbacks; it is not database delivery state. Helper-built old sources can use `editorialImage(source)` to
resolve a registered key. Do not feed a `library:` key into CSS, a link or plain `next/image`/native `img`; use the shared
renderer or fetch the saved asset URL. Protected product images and live provider results keep their own delivery.

Editorial raster imagery uses the database-backed library described in [the image contract](../contracts/image-library.md).
Open development Labs at `/dev/images` to upload an owned file or select an Unsplash photo, then copy its
`library:<assetKey>` reference. Replacing an existing key updates its catalog usages; other tabs reload to see changes.
Use the existing signed-in session. Never expose provider secrets or use the provider lab as this catalog.

For new page imagery, use the default image import and named credit import:

```tsx
import Image, { LibraryCredit } from "@/components/images/LibraryImage";

<Image src="library:destinations.kyoto.cover" alt="Torii gates in Kyoto" width={1200} height={800} />
<LibraryCredit source="library:destinations.kyoto.cover" />
```

Keep placement alt text/crops in the component. Include source credits, especially for Unsplash. Eligible owned/curated
files live on Cloudinary; API Unsplash photographs retain provider URLs and attribution. Do not rehost live Unsplash
results. Use plain `next/image` or native images for live provider results and protected Board/profile media; those
keep their existing authorization and delivery behavior. SVG icons, masks and fonts remain local code assets.

### Automatic image handling by coding agents

When a teammate supplies an image file or image link as part of a frontend task, register it in the image database and
wire the resulting reference into the requested page as part of that task. Do not tell the teammate to upload it in Labs
or run commands themselves when the agent can do it. Do not leave new editorial imagery as hardcoded remote URLs,
base64 blobs or unregistered local files. Choose a descriptive stable key based on the placement, such as `home.hero`.
Look up that key first; reuse a matching existing record rather than importing duplicates. Never replace an existing key
with unrelated content unless replacement is part of the teammate's request.

Run these commands from `backend/` using the configured server-side environment (no browser/session-cookie access):

```powershell
npm.cmd run images:add -- --key home.hero --file "C:\path\supplied-photo.jpg" --alt "Mountain lake" --credit "User-provided image"
npm.cmd run images:add -- --key discover.kyoto.hero --unsplash "https://unsplash.com/photos/AiC8MRukmBg"
npm.cmd run images:add -- --key home.banner --url "https://example.com/photo.jpg" --alt "Coastal town" --credit "Supplied photographer" --source-url "https://example.com/source"
```

On Linux/macOS use `npm`. The command returns JSON containing `reference` and the saved database record. Use that
returned reference in the shared image component and include `LibraryCredit`, as shown above. Infer useful placement
alt text from the task/image. Preserve supplied photographer/source details; do not invent ownership or credit. A
user-supplied file can be labelled "User-provided image" when no photographer was supplied. For third-party links with
unknown attribution, request only the missing source/credit while continuing independent work.

Unsplash photo pages/IDs obtain canonical metadata and stay on Unsplash. Direct `images.unsplash.com` links can use
`--url` with supplied alt/credit/source metadata; they remain external references and are never copied to Cloudinary.
Other public HTTPS raster links are downloaded with size/time/network limits and uploaded to Cloudinary. Supply direct
image links, not gallery/webpage URLs. Local files are uploaded directly without adding a new file to Git. Credentials
stay in `backend/.env`; never print them or add them to frontend code. If configuration/access is missing, report the
specific blocker and preserve existing imagery; never fabricate a saved ID or claim persistence.

New keys default to creation only. For an explicitly requested replacement, read the current revision and pass
`--expected-revision <revision>`. A conflict means reload and reassess; do not force-overwrite another teammate's edit.
Confirm the command succeeded, fetch the saved key through the API, update the actual page/data model to use its
`library:` reference, then run the required checks. Registering alone does not add an image to a page.

### Fetching saved images

- `GET /api/v1/image-library/<assetKey>` returns one saved record, or 404.
- `GET /api/v1/image-library?keys=home.hero,home.banner` returns only found records for up to 50 keys.
- Frontend helpers `getLibraryImage(key)` and `getLibraryImages(keys)` live in `@/lib/image-library` and use
  `NEXT_PUBLIC_API_URL`. The shared image component resolves `library:<assetKey>` through the catalog automatically.
- Use the returned asset URL/metadata for CSS backgrounds or other custom renderers; retain the key in page data and
  handle loading/missing/error states. Do not query PostgreSQL or embed Cloudinary account details in frontend code.

Bulk migration remains available through `npm.cmd run images:inventory` and `npm.cmd run images:import`; use
`images:add` for individual supplied images. Migration 005 is already applied to the shared database; never rerun old
migrations. New references in source are not automatically added to imported usage lists; search by stable key when
reviewing replacement impact.

Keep original imported files and URLs as rollback fallbacks. Catalog or image failures must not remove working old
photography. Labs is development-only and must be removed before deployment; retain catalog reads, image components,
data and import tooling after its removal. New references added to source code are not automatically included in the
imported usage list. Run page checks in both themes and smaller layouts when adding or replacing imagery.

These instructions apply to work inside `frontend/`. Roamboard is a student project. Keep code simple, readable, and easy for the team to explain.

This is a living project guide. Agents may and should update `AGENTS.md` when the frontend architecture, backend contract, design system, testing process, dependencies, or supported features change. Keep updates factual, concise, and consistent with the code that actually exists. Clearly label planned work, mocks, and placeholders so future agents do not mistake them for implemented behavior.

## Current integrated surfaces

`Sidebar` is shared by `AppShell` and `PublishedBoardShell`. It uses a fixed 64px mobile / 80px desktop rail; desktop expansion overlays content and is saved in `roamboard-sidebar-expanded` local storage. Navigation uses icons with lowercase labels on expansion and an underlined active destination, ordered Roam, Create, Discover, Boards, Social. Mobile expansion opens a native modal drawer. The sidebar account control expands its sign-in/profile, disabled Settings, and Light/Dark choices inline above the trigger, pushing Labs upward. Navigation scrolls at every height; the account panel has a viewport-based height bound and its own scrolling, with a rail scrolling fallback on very short screens. Active destinations are derived from the pathname, including nested creation, Board, Discover, profile, and developer routes. Discover keeps its own scroll-driven intro behavior independently of navigation expansion.

The `/dev` index links to the implemented frontend routes and explains how to open `/boards/[boardId]` with a saved Board ID. The creation landing page is `/create`; `/boards` implements Boards Page 7.0: a featured Motion spatial gallery of up to five existing V1 collage cards and an independent shadcn/Embla V2 compact library with momentum dragging and snapping, keyboard/wheel navigation, a scroll indicator, and progressive loading near the end. It loads owner-published summaries and documents through the existing API, with paginated loading and local search over loaded Boards. A summary-list failure displays clearly labelled visual sample fixtures; samples have no detail links or persistence. The page request store (`src/lib/my-boards-store.ts`) keeps successful document reads when individual Boards are unavailable and retries only failed documents without discarding the current collection. Page/API regression tests render the production content and invoke its search, pagination, and retry handlers through the real request helpers. Recently Saved reuses the V1 gallery with an independent selection and side details. The grouped Archive / Saves area reuses V2 libraries. These saved/archive collections are explicitly labelled sample data until backend state APIs exist; they never persist fake changes. Search filters created, saved, and archived collections independently. The Board creator remains `/boards/new`. Creation and editing routes highlight Create; published Board viewing and `/boards/mine` highlight Boards.

The Board creator now uses the versioned Board and image upload-intent endpoints with the session cookie. Existing drafts are listed at `/boards/drafts` and reopen at `/boards/drafts/[boardId]`; saving again sends the Board revision to the backend. `/create` contains the creation landing page and links to `/boards/mine`, which lists the signed-in owner's published Boards. Published Boards open for editing at `/boards/[boardId]/edit`; owners can edit content and visibility, while members with the editor role can edit content but not visibility. The creator has one selected Board cover and lets users attach several uploaded images to an activity, order them, and choose its activity cover. Unattached uploads can be assigned while editing an activity. The creator uses the backend's allowed tag list. Geoapify location search/reverse geocoding and Unsplash search are implemented in the current backend, with missing-key, quota and provider-failure states. Manual coordinates remain available. Vibe and Highlights controls are absent by agreement. The developer provider lab remains separate from persisted Board media.

The `/home` route follows Figma 4.0–4.1.3: a small Satoshi destination prompt centered in the space beside
our universal sidebar, with generous whitespace and no duplicate wordmark. The field has a restrained focus/hover
typographic interaction without an underline. A separate, interruptible prompt presentation types the question once;
the real input value remains owned by the search store. Reduced motion shows the complete question immediately.
Kyoto, Paris and Copenhagen links enter individually with varied delays after the faster prompt or on early interaction.
`RoamWorld` adds original SVG architectural studies in peripheral whitespace after focus, with no ambient typography
or destination labels. `roam-landmarks.ts` lists the 30 editorial landmarks; five lazy modules under
`features/destinations/landmarks/` contain their original paths and individual construction phases/directions.
Only selected drawings mount. Its page-local `roam-ambient.ts` scheduler varies delays and regions, works through
the full collection before refilling, avoids the previous six selections and favors a change in silhouette. It caps
visible moments at three on wide desktop or two on narrow/mobile layouts. Large, thin-line studies use asymmetric
edge crops that preserve identifying crowns, domes and spans. Drawings have varied size, drawing time
and lifetime. The central search column stays protected. A nonempty query slows admissions and dims the artwork;
mobile query moments use only the upper region. Blur dissolves the canvas; page hiding, selection, short viewports
and reduced motion stop its work. Illustration assets are local SVG code and introduce no catalog or provider calls.
Suggestions are typographic, show at most three results and retain smaller country/type labels. The URL remains `/home`.
Debounced, cancellable search forwards destination queries to Mapbox without a hardcoded catalog or geographic bias.
`src/lib/destination-search-store.ts` owns request cancellation, debounce, results, keyboard selection and same-query
failure retry. `DestinationExplorer` subscribes to that store and renders `DestinationExplorerContent`; its integration
tests render the production content and invoke its real input, keyboard, form and option/link handlers through the
credentialed API helper. These tests use the installed Node test runner and React server renderer without a DOM library.
They do not verify browser focus/default-event behavior or animation timing. Frontend CI runs `pnpm test` alongside
lint, TypeScript and build checks.
Countries and regions/provinces/states are included alongside cities. The backend ranks exact/qualified matches above
close whole-name spellings, prefixes and fuzzy fallback, returning only the strongest available group. Mapbox order
breaks ties and repeated displayed names/provider IDs are removed. Short queries preserve provider prefix ordering.
Transport facilities remain excluded by type and generic label safeguards. There is no population cutoff or extra
provider request. Countries display a small "Country" label; other destinations retain the smaller country label.
General destination page support remains owned by its separate workstream.
Selecting a destination starts the root `DestinationTransitionProvider` and navigates as soon as URL resolution finishes.
Its provider-owned `destination-loading.ts` store independently gates the reveal on a three-second Motion introduction
and `DestinationReady`, mounted inside the resolved destination page after critical awaits. Readiness includes the
server-rendered URL identity; a retained page cannot announce readiness for another destination or namesake.
`DestinationLoading` draws eight staggered architectural rules (five on mobile), reveals up to three existing guide
photographs (two on mobile) when their images load, and continues with bounded, slow drift during longer requests.
Images and catalog reads are optional and never gate readiness. No context/provider requests are added just for animation.
Reduced-motion users skip the introduction and elaborate composition. The overlay dissolves over 650ms, then restores
focus to the page heading. The existing destination template entrance remains for direct/other navigation.
The route's scoped not-found page preserves unsupported-destination 404 behavior and offers a return to search;
its error boundary notifies the transition and supports retry. A 25-second deadline prevents a stalled route from
leaving an endless loading state. Cancel, browser history interruption and provider cleanup abort URL resolution,
clear timers and remove the overlay. No new data library or global state manager is introduced.
`/dev/roam` is development-only and provides fast, seven-second server-delay, thrown-error and unknown-route tests;
controlled test delays are isolated there. The independent Node tests in `destination-loading.test.ts` cover both
readiness gates, failure, timeout, retry, cancellation and stale completion. Existing search presenter/API tests remain.
All API clients use NEXT_PUBLIC_API_URL and session cookies.

`/discover/destinations/[slug]` renders the reusable Destination Atlas for Kyoto, Paris and Copenhagen from
`src/data/destination-atlas.ts`. These are editorial mock guides with local, credited photography, destination-specific
compositions, seasonal notes, category-filtered places and native modal place details with Motion photo transitions.
The horizontal exhibition uses native trackpad/touch/Shift-wheel scrolling, chapter links, arrows and a single position slider; long information panels scroll vertically. Mouse-wheel input is not remapped. The bright introduction preserves the circular Figma hero, with an entrance rotation and compact typography in its wider reading panel.
Kyoto's opening copy, pins and tags are transcribed from Figma frame `55:1060`; other cities retain existing mock copy.
The compact Credits disclosure retains destination navigation and photography attribution without an extra full-height panel.
Place details support map/visitor links and previous/next browsing. Existing country destination routes remain available.
Destination descriptions and guide records are structured local editorial data. Country pages currently await
`getDiscoverBoardsByDestination`, but its public-Boards source is an asynchronous unavailable placeholder, not a live
backend request. The existing destination-context API helper is not consumed by these routes. Search and the image
catalog are genuinely network-backed; general dynamic destination content remains future work.
Primary destinations use clean `/discover/destinations/<slug>` URLs. Existing editorial guides own their slugs;
otherwise the highest-ranked unqualified Mapbox result owns the clean URL. Home reuses an exact-name autocomplete
response or makes one unqualified-name request when selection came from a prefix/qualified query. This extra lookup
has a one-second deadline: the request is aborted and navigation uses the clean fallback URL, even if the
transport does not settle after cancellation. Leaving the page cancels this lookup; successful lookups clear its timer.
There is no hardcoded prominence list or persistent Mapbox cache. Secondary cross-country namesakes use `?country=<ISO alpha-3>`;
same-country namesakes retain country, provider ID, type and coordinates only when confirmed secondary. Ordinary
selections, including unsupported destinations and failed/empty primary lookups, generate the clean slug directly.
Opaque provider ID changes do not disambiguate the same named city at the same location. There are no cleanup redirects.
Page rendering and metadata validate
country-only selectors and continue validating legacy full identities (including city type and a 25km center tolerance).
Incomplete, repeated or mismatched selectors return 404. General destination pages in the separate workstream must
resolve clean URLs by unqualified provider ranking, country selectors within that country, and full identities by provider ID.
Other search results use a normalized destination slug under the same route. General city detail-page support is
handled separately and is not implemented by Home. Discover search and its Kyoto feature link to guides.
The destination story gallery uses Motion to focus and rearrange unchanged V1 collage cards, with button, keyboard and drag selection. Its mock stories have no detail links or persistence; an optional real Board href is respected when supplied. Seasonal controls live in a separate white, ruled editorial interlude. The Trending destinations section uses a destination-specific asymmetric photo grid, a fixed near-black palette, animated filtering and shared-photo native-dialog details. The concluding Create panel returns to the page theme; Kyoto’s closing image rotation follows the Figma artwork. Create links open the existing
blank `/boards/new` flow; destination prefill, activity saving and copying are future integrations. Editorial guide data
does not create backend destination/location records. Photo sources and rights notes live in `public/images/destinations/README.md`.

The developer Board browser (/dev/boards) lists paginated accessible Boards and inspects canonical days, activities, tags and protected images; deletion remains owner-only. The profile lab (/dev/profile) reads and edits the signed-in account, accepts owned uploaded image IDs for pictures, creates test Boards through the canonical Board endpoint, and reads statistics, recent owned Boards and activity-derived map destinations. Its globe retains planned/visited styling and obtains a quota-reserved Mapbox session. There is no seeded-user fallback or prototype identity header.

The provider lab (/dev/providers) uses current backend Mapbox, Geoapify, Unsplash, Google Places, Cloudinary routes, plus PostgreSQL-backed Board search. Cloudinary lab uploads are separate from Board media and restricted to the lab prefix/tag. Cloudinary/Google management tools and developer Board listing require a signed-in session with the backend in development mode. Provider credentials stay server-side; only an intentionally public Mapbox pk. token is returned after a map-load reservation. PostgreSQL persists shared provider budgets across restarts. Search reads only real public, published Boards from PostgreSQL and checks fresh database visibility before returning records or suggestions. Activities and locations are not standalone search results. The separate Mapbox search uses Search Box for POIs, restaurants and landmarks with its own quota; Home retains city geocoding, and persistent Board locations still use Geoapify. Backend setup, limitations and response shapes are documented in [API_FEATURES_CONTRACT.md](../backend/API_FEATURES_CONTRACT.md).

The `/create` landing follows Figma 3.0–3.1 with a local, credited Unsplash photograph, a curved hero, and circular
creation choices. `BoardCreationChoices` owns only the New Board expansion state; Motion respects reduced motion,
and Escape collapses the choices and restores trigger focus. Smart Create opens `/boards/new`; Scratch opens
`/boards/new?mode=scratch`. Smart includes the circuit upload introduction; Scratch, reopened drafts, and published
edits begin at the shared curved cover. New Boards can switch modes without discarding local edits or remounting
the upload controller. The shared editor uses spacious numbered chapters, Cabinet display titles, and Satoshi
supporting text. Existing Boards lock editing while loading and remain locked after a failed load.
The planner uses horizontally scrolling day columns with independent activity scrolling, compact photo cards,
and circular category controls. Category menus reuse the existing activity vocabulary and shadcn/Radix radio
menus with typeahead; they do not use Board discovery tags or introduce new backend categories. Pointer drops
retain 30-minute time placement. Activity move menus provide keyboard/touch reordering and cross-day moves
without changing times, with focus restoration and live announcements. Explicit order is retained through edits,
additions, and removals; new activities append to their day. `board-planner.ts` owns immutable move calculations,
while `BoardCreator` remains the state/save owner.
Details & Discovery uses removable tag chips and the installed Command search over backend-provided names,
with a maximum of three selections and explicit catalog loading/error/retry states. The shared editorial tag
catalog supplies matching icons only; it does not supply persisted tag IDs or choices. Native visibility radios
retain owner-only changes and explain that draft access remains owner-only. Publication uses the large Cabinet
typographic action and an underlined draft action; published editing offers Save changes and never a downgrade.
Save status/errors appear beside these controls with review links, separately from upload/load feedback. All writes,
revision checks, server ID reconciliation, and permission gates remain in `BoardCreator`.
The creator preview reuses `CollageBoardCard` with an opt-in `preview` presentation that hides unsupported author,
bookmark, saved-count, and Highlights content; default V1 cards retain their existing presentation. Its immutable
adapter (`board-creation-preview.ts`) leads with the selected uploaded Board cover, de-duplicates collage URLs,
and displays up to six photos without discarding other media records. The creator's opt-in quiet empty slots use
faint outlines. `BoardPreviewSection` and the stateless `BoardPreviewDiagram` place the compact V1 card and floating
annotations on one proportional desktop canvas, with original Figma connector masks. Below a 1100px container,
annotations follow a readable flow without connectors. Motion respects reduced-motion preferences.
Only confirmed locations contribute to destination/country lettering, and multi-country or unresolved country
data produces no country watermark. Dates list actual recorded dates and identify undated days. Full title,
description, tags, visibility, and source-edit links surround the collage; keyboard-accessible native disclosures
retain every activity and photo, including source credits. This is a live local preview, not proof of persistence.
Draft and My Boards navigation remain available; remixing remains
explicitly deferred. Discover links to `/discover`. The shared sidebar is unchanged.

The Create draft selection page (`/boards/drafts`) uses an editorial heading and title search, an installed
shadcn/Embla recent-drafts carousel, and a ruled compact library. Search covers loaded summary titles only;
explicit pagination remains available while searching. Only the first page's five most recent drafts request full
documents for honest collage previews; library tiles use summary covers and never infer destinations or authors.
Drafts have no bookmark or Highlights controls. Preview failures retain all summary links and support targeted
retries. `draft-boards-store.ts` owns page-local request guards, pagination de-duplication, and stale-response
protection; it never substitutes sample data. Reopening still uses `/boards/drafts/[boardId]` and the shared
`BoardCreator` document, permission, and revision handling. Draft-only access is labelled accurately.

The Create entry now links to `/create/continue` and `/create/remix`. Continue combines the production
owner-draft and owner-published list endpoints, with independent pagination, partial-error retries, and explicit
loaded-title search scope. `board-selection-store.ts` clears cached documents on refresh, rejects stale responses,
and checks fresh document identity and `canEditContent` before showing an editor link. Drafts reopen at
`/boards/drafts/[boardId]`; published Boards reopen at `/boards/[boardId]/edit`, preserving ID, revision, and status.
Production APIs cannot enumerate shared editable Boards; a shared-link/ID lookup checks the canonical document
permission instead. No developer listing endpoint is used. The shared presentation uses a Motion V1 collage
focus gallery and a photo-card collection that promotes selected Boards into the same gallery, without duplicates.
The naming transition is V1=`collage`, future V2=`landscape` (old V3), future V3=`photo` (old V4). The old `compact`
variant is retired for these new pages; existing identifiers, assets, fixtures, and unrelated pages remain compatible.
The Remix page is an honest unavailable state: there is no production account-saved Board list or remix-creation
endpoint. Session preview bookmarks and My Boards sample saves are not an account collection. Completing remix
requires an approved saved-list contract with ownership/source metadata and independent-copy/media rules; no
original Board update or fake remix is performed. Photo cards omit the author line when author data is absent.

The creator's ruled sticky chapter navigation also shows its real loading/uploading/saving and unsaved state.
`board-editor-safety.ts` compares persisted content, excluding transient IDs and protected-image URL refreshes.
The baseline changes only after document loading or a confirmed save. A synchronous save latch rejects duplicate
submissions. After publishing from the draft flow, the finished editor locks; published editing remains a separate route.
Unsaved content or active operations register a native refresh/close warning and intercept same-window internal links
with the existing confirmation dialog. Hash links, mode switches, new tabs and downloads remain usable. Same-document
browser Back/Forward and arbitrary programmatic routing are not blocked; no history entries are fabricated and there
is no autosave/recovery store. The publication panel explicitly advises saving before using browser history controls.
Activity dialogs confirm discarding unfinished fields, preserve focus, and pause the outer focus trap during confirmation.
Activity uploads prevent dialog dismissal and Board saving until finished; previously attached images remain available.
The user-approved `sonner` dependency powers a Create-scoped, theme-aware notification host. Each save/upload operation
updates one notification from loading to confirmed success or failure. Frequent local edits use planner announcements
instead of toasts; persistent inline error details remain available. Board image batches use `Promise.allSettled` so a
failed upload never discards successful files, and failure details identify which files need retrying.

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
- Call the Roamboard backend for provider-backed work. The browser must not call Google Places, Unsplash, Cloudinary management APIs, or other secret-bearing services directly unless a documented public-client integration has been approved.
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

The user has chosen Google sign-in plus development guest accounts. Email/password forms are not part of the login flow. Guest accounts have usernames and no passwords, are shared across the team, and keep their data between sessions.

`/login` and `/signup` use Google's rendered sign-in button. The browser sends the Google credential to `POST /api/v1/auth/google` with credentials; the backend verifies it and sets an HTTP-only session cookie. The frontend reads the current user through `GET /api/v1/auth/me` and signs out through `POST /api/v1/auth/logout`. `ProfileControl` shows the authenticated user's display name, handle, saved profile photo when available, and an active logout option. Confirmed profile saves, photo changes and removals notify mounted account controls immediately; stale initial session reads cannot overwrite those updates. Logout invalidates pending account notifications, and profile saves started before logout cannot repopulate signed-out controls or a later login. `/dev/account` still uses a fictional preview user and keeps its logout button disabled.

In development, `/login` also lets a visitor create a persistent guest account or select one from a dropdown. The client calls `GET/POST /api/v1/auth/guests` and `POST /api/v1/auth/guests/sign-in`; the backend sets the same HTTP-only session cookie. The old visual-only Rowan demo shortcut was removed. Migration 008 must be applied to the development database before these controls work.

Stable Roamboard user IDs and Google verification belong in the backend. The Google web client ID is shared through `NEXT_PUBLIC_GOOGLE_CLIENT_ID`; the Express API base URL is `NEXT_PUBLIC_API_URL`. Both are set in the ignored `frontend/.env.local` for local work. The client ID is public, while the Google client secret is not used by this flow.

`/welcome` is the returning-user landing page. It checks the backend session and uses the authenticated display name (Google given and family names by default); without a session, it routes to `/login`. New users go to `/home` after sign-in; returning users go to `/welcome`. `WelcomeScreen` accepts a username prop; names wrap within two lines at a responsive CSS font size; longer names are clipped instead of automatically shrunk. The user approved a light-only page, the supplied overlapping photo composition on smaller screens, and a click on ENTER to start a black-bar takeover before opening `/home`. Reduced-motion users go directly to `/home`. Images and text have separate layers for later animation work.

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
`src/data/roamflow-boards.ts` contains 27 distinct fictional editorial stories with existing photography;
sample cards have no Board detail links. The paged mock source and presentation types in
`src/lib/roamflow.ts` are not a backend API contract. `useRoamFlow` handles request guards, cancellation,
deduplication, retry, and cursor progress. Automatic loading pauses after two pages until the user continues;
the skip link cancels pending loading and keeps the existing Discover footer reachable.

Cards reserve their 4:5 geometry, lazy-load images, and use CSS content visibility to avoid offscreen rendering.
This is not DOM virtualization: the mounted collection grows as pages are loaded. Reassess a windowed virtualizer
when a real public-Board source and substantially larger persisted collections are integrated.
`/dev/roamflow` provides slow-source, failure/retry, empty, reduced-motion, and 1,000-card stress scenarios.
Stress fixtures deliberately repeat photos and never appear in Discover. The reduced-motion scenario forces
the same animation branch as the system preference; the normal gallery respects the browser preference.

### Published board viewer

`/boards/[boardId]` loads numeric database IDs through the credentialed Board API and renders the full published
design. Every existing and newly published Board uses this route; no page generation or fixture update is needed.
Public Boards work anonymously; other Boards retain backend read permissions. Drafts stay in the draft editor.
It reuses the homepage sidebar and account control,
supports both themes and smaller screens, and opens full activity details in a
native dialog. Account loading does not gate board viewing. The account control
hides after the page is scrolled down.

`usePublishedBoard` uses local React state and an effect to load saved documents, retry and ignore requests after
unmounting. `src/lib/published-board-data.ts` loads through the credentialed API and maps saved days, activity/photo
order, chosen covers, tags and current author details. Author names use the database username; missing bios remain
empty, and missing author photos retain a gray header circle and labeled footer portrait space. Supplied author
photos use the Board-scoped image authorization described in
`backend/BOARD_API_CONTRACT.md`. API image URLs resolve against `NEXT_PUBLIC_API_URL` and load directly in the
browser so protected requests carry its session cookie. The presentation model retains optional dates/times and
explicit saved day numbers, including empty days and gaps.

Published Board routes use the database viewer exclusively. The former hardcoded Tokyo document and sample
lookup were removed after importing Tokyo into the user's account through the canonical Board/image services.
The retired sample slug has no database alias and shows the missing-Board state. The old `PublishedBoardView`
inspector is no longer used by the page route. The profile page reads live account data through the profile API. `/profile` redirects signed-in users to `/profile/{handle}`. Handle pages are public: visitors see profile details, public Boards and public travel data, while the owner sees the existing account profile and saved Boards. Published Board author names link to handle pages.

`useBoardPhotos` fills desktop grayscale photo spaces with distinct Unsplash photos from the saved location, with
broader location/tag searches when a result pool is empty or runs out. A missing user-selected header uses another
distinct automatic photo. Existing headers and activity photos are retained; IDs and image URLs already used in
the Board are excluded from automatic selection. `src/lib/board-photos.ts` shares queries through a bounded
browser-tab cache and calls the existing credentialed, quota-managed backend Unsplash endpoint. Failed provider
requests do not trigger automatic backup requests. Photo lookup never delays Board rendering or writes to the
Board document. Missing results and image-load errors retain a gray location-name placeholder in automatic photo
spaces. Automatic photos have a small credit line on the image, with
links to the photographer and Unsplash.

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
