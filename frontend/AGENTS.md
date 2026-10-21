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

`BoardCollectionGrid` is the fourth Board list: component 2 photographic cards in a wider responsive grid, twenty
results with URL-backed contextual search, sorting and numbered pagination. `/boards/collections/[context]` hosts
View all destinations; Social embeds the friends collection directly. Source scopes preserve profile ownership,
saved membership, Featured period and map country/point plus published/saved toggles. Existing live list headings
link to these collections. Discover's `samples` route remains explicitly editorial, without persisted Board actions.
Search/suggestions on `/boards` now include eligible owned published Boards and keep direct title matches even
without matching location metadata. See `../contracts/board-collection-grid.md`. Browser layout QA remains pending.

`/boards` now renders `BoardsDiscovery`: four location-aware suggestions with compact previews, URL-backed numbered
search results, monthly Featured, a Discover promotion, Recently Published, owner-only mixed Draft/Published
Boards and Saved Boards. The two personal sections use the draggable horizontal `BoardLibrary` carousel, retaining
draft editor links, published View/Edit actions and confirmed unsaving. Recently Published also uses BoardLibrary. Draft covers use an accessible document/pen badge instead of separate Draft/Published status captions. Featured is monthly only, with the caption "Roamboard's monthly most popular boards", and the Discover promotion follows the personal sections.
There is no separate The Collection grid on `/boards`. Presenters use batch summaries rather than full-document
requests. Guests see public discovery and one sign-in prompt; accessible friends-only Boards remain viewer-specific.
The old Archive UI and archive-only fixtures are removed. `DatabasePublishedBoard` qualifies views only after three
visible seconds through the challenge API; gallery previews never count. NLP/semantic search remains next-iteration
work. See `../contracts/boards-discovery.md`. Independent automated tests cover the new page/API/storage; actual
browser interaction/layout verification remains pending because no browser provider was connected.

`/create/remix` uses the Continue gallery for the signed-in user's saved Boards, without search or filters.
Focused published card backgrounds open `/boards/<boardId>`; secondary deck and collection cards select first. Arrows and swipe
change the primary card. Its plus opens `/boards/new?remix=<boardId>` and its eye opens the Board view.
Continue published cards expose pen + View; their backgrounds open View. Drafts retain their existing editor
and require resolved edit permission. Actions appear on hover/focus and remain visible on touch devices.
The primary card shares a 48px profile photo and linked `@handle` in both modes, retaining protected photo queries
and the account-icon fallback. The hover layout reserves separate text, action and metadata areas so controls stay
above the divider. Gallery arrows sit beneath the secondary deck, above the bottom divider (beneath the main card on mobile).
The creator prepares independent photos and content through
`POST /api/v1/boards/:boardId/remix-content`, deduplicates preparation within the mount and disables editing until
ready, with retry on failure. Days/order/times and cover selections remain; calendar dates, original ownership,
completion, memberships and visibility are not copied. Normal new-Board visibility preferences apply. Only Save
or Publish creates a Board. See [the remix contract](../contracts/saved-board-remix.md).

Secondary screens use the shared `BackLink`: profile/settings, notifications, Board selection/editing/viewing and Discover details. It shares the primary-color 16px medium-weight navigation style and 16px arrows with ViewAllBoards through `navigation-link-style.ts` and scrolls away with the page content; it has no separate header bar. Keep it inside each screen's actual scroll container. Main navigation destinations omit it. `BackNavigationTracker` records the previous internal URL on browser history entries while preserving router state, so Back uses browser history after refresh or forward/back; direct entries use a route-specific parent fallback. Authentication/welcome screens are excluded as return destinations. Board editor leave confirmation preserves Back or fallback replacement after discarding unsaved changes.

`Sidebar` is shared by `AppShell` and `PublishedBoardShell`. It uses a sticky 64px mobile / 80px desktop rail in the page grid; desktop expansion grows to 176px and resizes the page beside it. Hovering a navigation or account control for 150ms temporarily reveals labels; leaving the rail collapses it after 100ms, and returning cancels that collapse. The logo and navigation positions stay fixed during expansion. Keyboard focus reveals labels immediately. The explicit keep-open choice is saved in `roamboard-sidebar-expanded` local storage. Navigation uses icons with lowercase labels on expansion and an underlined active destination, ordered Roam, Boards, Discover, Create, Social. Mobile expansion opens a native modal drawer. The sidebar account control expands its sign-in/profile, Settings, and Light/Dark choices inline above the trigger. Navigation scrolls at every height; the account panel has a viewport-based height bound and its own scrolling. Active destinations are derived from the pathname, including nested creation, Board, Discover, profile, and developer routes. Discover keeps its own scroll-driven intro behavior independently of navigation expansion; Discover panels and destination chapters use their available container width.

The `/dev` index links to implemented routes and explains how to open `/boards/[boardId]` with a saved Board ID.
The creation landing page is `/create`; `/boards` now uses the discovery flow described above. Featured retains the Motion spatial gallery; Recently Published, My Boards and Saved Boards use BoardLibrary.
The superseded owner-list presenter, store and their tests have been removed. Shared gallery adapters and visual
fixtures remain in use by current galleries and tests. The Board creator remains `/boards/new`.
Creation and editing routes highlight Create; published Board viewing and `/boards/mine` highlight Boards.

The Board creator now uses the versioned Board and image upload-intent endpoints with the session cookie. Existing drafts are listed at `/boards/drafts` and reopen at `/boards/drafts/[boardId]`; saving again sends the Board revision to the backend. `/create` contains the creation landing page and links to `/boards/mine`, which lists the signed-in owner's published Boards. Published Boards open for editing at `/boards/[boardId]/edit`; owners can edit content and visibility, while members with the editor role can edit content but not visibility. The creator has one selected Board cover and lets users attach several uploaded images to an activity, order them, and choose its activity cover. Unattached uploads can be assigned while editing an activity. The creator offers the same shared editorial tags as the profile, filtered to backend-persisted names. Retired database tags remain visible/removable on existing Boards but are not offered as new choices. Geoapify location search/reverse geocoding and Unsplash search are implemented in the current backend, with missing-key, quota and provider-failure states. Manual coordinates remain available. Vibe and Highlights controls are absent by agreement. The developer provider lab remains separate from persisted Board media.

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

`/discover/destinations/[slug]` renders city guides through the destination API. Home and Discover searches carry city name, country and coordinates in the URL. The guide uses short attributed Wikivoyage text, large credited Unsplash photos and fresh public Board summaries. It is one viewport tall, with native horizontal touch/keyboard navigation and wheel scrolling; no inner vertical panels or extra footer. Four full-viewport chapters contain the city artwork/introduction, places/map, public Board cards and closing creator. Native snapping and wheel/keyboard steps settle on whole chapters. On desktop the list and map share the second chapter; smaller screens switch between Places and Map within it. Loaded Boards remain reachable in a focusable horizontal gallery inside the third chapter. The list shows five sights per page (fewer only on the final page). Large arrow buttons and a page counter change pages; shorter screens use compact rows. Wikivoyage supplies travel-guide sights, including district listings when needed. The map loads when the guide opens and starts at the city even without sights. Selecting a sight tries to match it in Mapbox for temporary map display. A gray row and marker indicate selection; focus keeps the list/map section in view without revealing the neighboring dark Boards panel. Original travel-guide names and coordinates remain in Board links, with Wikivoyage source attribution. The Places panel shows travel-guide sights without a Saved places tab. The destination page has no account-save action or saved-place requests. Selecting a place can prefill an editable Day 1 activity in `/boards/new`; no Board is automatically saved. The closing "Start a {city} board" action opens the empty creator. Failed provider requests retain the guide and show retry/error feedback. About includes a short Wikivoyage Getting around tip when available. Selecting a sight loads its own plain-text listing description and a credited, adequately sized listing-linked Commons photo through `/destinations/place-details`; missing photos use the sight name. Details are display-only and preserve canonical Board-prefill coordinates. The old Atlas fixtures remain inactive references.
Home and Discover country selections now reuse the live destination-guide API and the city guide chapters, passing
`kind=country` alongside name, ISO alpha-3 country and coordinates. Country guides read public Boards across the country,
use exact country Wikivoyage titles without a city-distance cutoff, and start an empty map at country scale.
Their shared list/map chapter is "Cities to explore", using the country's Wikivoyage `city` markers as the list and map
points. Row and marker selection stay in the country guide; the selected city's Explore link opens its existing city
guide using the original coordinates. Selection keeps the map at country scale and loads a short description plus a
credited Wikimedia photo through the existing `place-details` endpoint with `kind=country`. The shared selected-place
panel renders the photo, description and source/license links, with loading, missing-content and retry states. The
country listing is preferred; missing text/photos can use the city article linked by its Wikivoyage marker. Country
selection makes no place-match request. City guides retain "Places to explore" and their existing sight actions.
Clean country links resolve their identity through the existing destination search; metadata and page rendering share
that lookup within a server request. Historical editorial country fallback still uses `getDiscoverBoardsByDestination`
when a live guide identity is unavailable; that fallback's Board source remains an unavailable placeholder.
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
The destination story gallery adapts real public Board summaries into shared V4 photographic cards in a height-aware
Motion stack. Stable Board-ID selection survives pagination; buttons, keyboard Home/End/arrows, drag selection,
animated captions and selected-card metadata remain. The selected Board opens its real numeric route. First-image
cover order, direct API image delivery and supplied photo credits are preserved. Missing covers use the shared fallback.
The page hook owns loading, pagination, de-duplication and retries; loaded cards remain available on later failures.
Public summaries do not supply ownership, saved membership or save counts, so the gallery shows no account controls
or invented totals. No additional canonical Board requests or account mutations are introduced.

The developer Board browser (/dev/boards) lists paginated accessible Boards and inspects canonical days, activities, tags and protected images; deletion remains owner-only. The profile lab (/dev/profile) reads and edits the signed-in account, accepts owned uploaded image IDs for pictures, creates test Boards through the canonical Board endpoint, and reads statistics, recent owned Boards and activity-derived map destinations. Its globe retains planned/visited styling and obtains a quota-reserved Mapbox session. There is no seeded-user fallback or prototype identity header.

The provider lab (/dev/providers) uses current backend Mapbox, Geoapify, Unsplash, Google Places, Cloudinary routes, plus PostgreSQL-backed Board search. Cloudinary lab uploads are separate from Board media and restricted to the lab prefix/tag. Cloudinary/Google management tools and developer Board listing require a signed-in session with the backend in development mode. Provider credentials stay server-side; only an intentionally public Mapbox pk. token is returned after a map-load reservation. PostgreSQL persists shared provider budgets across restarts. Search reads only real public, published Boards from PostgreSQL and checks fresh database visibility before returning records or suggestions. Activities and locations are not standalone search results. The separate Mapbox search uses Search Box for POIs, restaurants and landmarks with its own quota; Home retains city geocoding, and persistent Board locations still use Geoapify. Backend setup, limitations and response shapes are documented in [API_FEATURES_CONTRACT.md](../backend/API_FEATURES_CONTRACT.md).

The `/create` landing follows Figma 3.0–3.1 with a local, credited Unsplash photograph, a curved hero, and circular
creation choices. `BoardCreationChoices` shows separate New Board, Continue a Board and Remix circles vertically.
New Board opens `/boards/new`; there is no expanding submenu. A normal click briefly expands and fades the selected
circle before navigation. Modifier clicks and reduced-motion preferences retain native navigation; Escape cancels
the pending transition. All new Boards use the same curved-cover
editor, including old `/boards/new?mode=scratch` links. The cover and title come first, followed by 01 Board Basics. Main destination sits before the description, reusing
Home's destination search store with permanent Geoapify locality results. Its saved city/region/country and country
code round-trip through Board writes and provide the activity-search fallback area.
Smart Create sits between 01 and 02, explaining editable metadata suggestions for photos from completed trips.
Circuit traces rise from underneath its broad photo drop area, with hover guidance and a highlighted drag target.
The top cover retains its image picker. Uploaded thumbnails can be dragged into this
area to select the Board cover; the existing Set as cover buttons remain the keyboard/touch alternative.
There is no creation mode switch. Reopened drafts and published edits retain plain cover uploads without the
new-Board Smart Create introduction. Upload pickers accept 30 photos per batch, with repeat batches allowed.
Smart Create calls the authenticated backend suggestions endpoint after uploads, uses capture dates only for
numbered day offsets (maximum 31), and groups photos within 100m and two hours on the same camera day.
The first user-uploaded photo is the activity cover; activity time is the earliest known group time.
Earlier subsequent batches open a proposed day-plan confirmation before shifting existing days. Cancelling keeps
new uploads unassigned. Existing field edits and manual photo order are retained. New Board days have no calendar date.
See [the Smart Create contract](../contracts/smart-create.md) for missing metadata, provider failures, and overflow behavior.
The shared editor uses spacious numbered chapters, Cabinet display titles, and Satoshi
supporting text. Existing Boards lock editing while loading and remain locked after a failed load.
The planner uses naturally sized day columns with photo cards and circular category controls. Normal vertical wheel
input scrolls the webpage, including over days and the shared map; horizontal gestures, Shift-wheel and arrows browse
days. Blank day space is a native keyboard-accessible add-activity target behind the content. AddActivityDialog and
ActivityEditorDialog share Geoapify location search, category suggestions, time and notes. Adding or saving requires
a selected location, without manual coordinate inputs; legacy unlocated activities can still load. Current day or
Board coordinates softly bias search without restricting worldwide destinations or boosting arbitrary categories.
Smart Create activities can publish without individual saves; their editable photo locations appear in previews immediately. Explicit Re-read photo location stages corrected original GPS/name, using
an honest raw-GPS fallback on lookup failure. BoardPlanMap follows the days in its own chapter with all located
activities, day colors and sequence numbers, filters and marker editing. Loading/error/retry and empty states are
explicit. Mapbox cooperative gestures preserve page scrolling; an empty plan does not load a map. The map is chapter 03,
with a 16:9 frame; Details, Preview and Publish are 04, 05 and 06. Map marker clicks open the shared editor.
AddActivityDialog wraps ActivityEditorDialog with staged media assignments. Both have a collapsible photo area,
file picker and drop target. First successful uploads fill missing location/time using exact GPS; entered fields
are preserved and Use photo location explicitly replaces a chosen place. Completed create-dialog uploads remain
available unassigned if discarded. New activity saves retain local photo order and first-upload cover.
Automatic activity photos use strict location-matched Unsplash lookup and retain credits/hotlinked URLs. Broad
country/city search rank alone is insufficient; no confident match leaves the activity without an automatic photo.
Native select options use theme tokens, and creation circles have reduced-motion-aware springy hover growth.
Category menus reuse the existing activity vocabulary and shadcn/Radix radio
menus with typeahead; they do not use Board discovery tags or introduce new backend categories. Pointer drops
retain 30-minute time placement. Activity editor day/order controls provide keyboard/touch reordering and cross-day moves
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
The creator preview reuses `PhotoBoardCard` (V4) at 4:5 without save controls or a redundant visibility icon.
Its immutable adapter (`board-creation-preview.ts`) uses the selected uploaded cover, otherwise an existing photo;
missing/failed imagery keeps V4's architectural fallback. Author metadata comes from the creator's existing profile
or canonical document read, with no additional requests. The retained V1 adapter is not actively rendered here.
`BoardPreviewSection` and `BoardPreviewDiagram` show equal V4 cover and permanently expanded details views of the
same live data. Explanatory annotations sit outside the pair, with edit icons beside their headings. Only fields
visible on the cards are annotated: title/cover on the left, destination/tags/day count on the right.
Missing destination/tags are omitted; duration is informational, with no date-edit affordance. Description/visibility
remain in their existing editor chapters. Cards stay at or below 340px, where V4's existing description breakpoint
keeps descriptions off the card. An SVG overlay measures real title/metadata elements and callout bounds for fine
orthogonal connectors; hover and keyboard focus emphasize the related line. Below a 1100px container annotations
flow without connectors; below 760px the two studies stack vertically.
Source links scroll to and focus existing editor controls, with section/retry fallbacks when a control is unavailable. The destination annotation edits the explicit main-destination field when selected, otherwise the day plan; cover editing opens the shared cover picker.
Loading/read-only previews have no editor links. Visibility permissions in the actual editor are unchanged. Motion respects
reduced-motion preferences. Preview status reflects the loaded document without changing the save payload.
The explicit main destination takes precedence in both V4 states; otherwise selected/generated activity locations
supply the fallback, matching the current creator contract. Multi-country or unresolved fallback countries produce
no country watermark. Revision-aware display/thumbnail URLs refresh both states after photo edits, while native disclosures
retain every activity and photo, including source credits. This is a live local preview, not proof of persistence.
Draft and My Boards navigation remain available; remixing remains
explicitly deferred. Discover links to `/discover`. The shared sidebar is unchanged.

The Create draft selection page (`/boards/drafts`) uses an editorial heading and title search, an installed
shadcn/Embla recent-drafts carousel, and a ruled V4 photographic library. Search covers loaded summary titles only;
explicit pagination remains available while searching. Only the first page's five most recent drafts request full
documents for V4 previews; the library reuses those documents and otherwise uses summary covers without inferring destinations, authors or itinerary metadata. Empty drafts use the shared V4 architectural cover fallback; all owner draft cards show owner-only access, regardless of intended publication visibility.
Drafts have no bookmark or Highlights controls. Preview failures retain all summary links and support targeted
retries. `draft-boards-store.ts` owns page-local request guards, pagination de-duplication, and stale-response
protection; it never substitutes sample data. Reopening still uses `/boards/drafts/[boardId]` and the shared
`BoardCreator` document, permission, and revision handling. Draft-only access is labelled accurately.

The Create entry now links to `/create/continue` and `/create/remix`. Continue combines the production
owner-draft and owner-published list endpoints, with independent pagination, partial-error retries, and explicit
Published/Drafts filters (Published first and selected initially), without search or shared-link lookup on this page.
Its heading identifies drafts and published Boards as editable work, with the pick-up subtitle below Your Boards.
The standard top-left BackLink returns to Create; Saved inspiration is removed, and remix remains a creation choice
at `/create`. On desktop viewports at least 1024px wide and 800px tall, the composition is vertically centered below
the BackLink, fits the viewport and its Board area handles overflow; smaller/zoomed layouts retain page scrolling.
The gallery has no Recently Updated heading, decorative footer text or separate Continue link. A selected card
opens its published Board view, with independent pen and View controls on hover/focus and touch. Drafts keep
opening their existing editor after edit permission resolves. Secondary published cards select first;
carousel arrows beneath the deck and swipe change the selected Board.
`board-selection-store.ts` clears cached documents on refresh, rejects stale responses,
and checks fresh document identity and `canEditContent` before showing an editor link. Drafts reopen at
`/boards/drafts/[boardId]`; published Boards reopen at `/boards/[boardId]/edit`, preserving ID, revision, and status.
Production APIs cannot enumerate shared editable Boards. Shared-link lookup is deferred in the Continue UI;
the existing store helper is not exposed by the page. No developer listing endpoint is used. The shared presentation uses a Motion V4 photographic focus gallery and a smaller V4 collection with direct published Board links and draft-preview selection, without duplicates. It retains spring rearrangement, mouse-only 3D tilt, keyboard selection, animated annotations and fresh-document editor gates. V4 selection controls share the card surface; inactive featured cards leave the tab order. Ownership comes from the owner-list scope or canonical management permission; shared edit access does not imply ownership.
V1=`collage`, V2=`compact`, V3=`landscape`, and V4=`photo` retain their existing names and identifiers.
V4 is the primary card throughout the migrated product. Continue, Drafts, creator preview, saved/owned lists, profile collections and Discover results are migrated; Featured Boards intentionally retain V3. Legacy variants remain available in the development gallery.
The Remix page remains an unavailable state. The production account-saved Board list now exists, but this page
does not consume it yet; persistent remix creation is still unavailable. Session preview bookmarks are separate
from account saves. Completing remix requires frontend saved-list integration and agreed independent-copy/media
rules; no original Board update or fake remix is performed. Photo cards omit the author line when author data is absent.

Canonical Board documents supply `savedCount` to V4 and the Continue metadata column (Saves received).
The published viewer shows a text Save Board/Unsave Board button followed by its bookmark icon and the current
save total, including zero. Successful changes refresh the canonical count; a failed refresh shows unavailable
instead of estimating it. Owners see the count without a self-save button. The header counts activities rather
than distinct places. Profile statistics replace Activities saved with Saves received (`savesReceived`), preserving
the existing saved-activity data. These are current bookmarks, not lifetime save events; visitor profile totals
respect public/friend Board visibility. Regression tests were authored alongside implementation; independent
coverage review and visual browser acceptance remain pending.

The creator's ruled sticky chapter navigation also shows its real loading/uploading/saving and unsaved state.
`board-editor-safety.ts` compares persisted content, excluding transient IDs and protected-image URL refreshes.
The baseline changes only after document loading or a confirmed save. A synchronous save latch rejects duplicate
submissions. After publishing from the draft flow, the finished editor locks; published editing remains a separate route.
Unsaved content or active operations register a native refresh/close warning and intercept same-window internal links
with the existing confirmation dialog. Hash links, new tabs and downloads remain usable. Same-document
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

In development, `/login` also lets a visitor create a persistent guest account or select one from a dropdown. The client calls `GET/POST /api/v1/auth/guests` and `POST /api/v1/auth/guests/sign-in`; the backend sets the same HTTP-only session cookie. The old visual-only Rowan demo shortcut was removed. Migration 010 must be applied to the development database before these controls work.

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
units to preserve their compositions at different widths. `SocialBoardCard` is a retained, currently unused adapter from the old profile mock
model to the shared collage layout.

`/dev/board-cards` renders all twelve Figma fixtures from `src/data/board-card-examples.ts` at their reference sizes
or fitted to the available width. Its bookmarks only change local gallery state. Reusable cards accept an optional
navigation URL and controlled bookmark callback; they perform no backend requests or persistence.

### Board Library reuse (Issue #90)

`BoardLibraryCarousel` and `BoardLibrarySlide` expose the existing horizontal browsing behavior to account-aware
profile cards and tag-linked Vibe samples. Profile previews keep their existing limits and View All. Saved profile
cards opt into `SavedBoardGrid`'s library presentation; confirmed removal still refreshes page one and transfers
focus to another card or the persistent empty list. Other saved grids, map highlighting, V3 Featured and RoamFlow
remain unchanged. Discover Collections stays unavailable until its live source is connected. See
[the focused Issue #90 handoff](../docs/ISSUE_90_GALLERY_REFINEMENTS.md).

### Shared V4 enhancement (Stage 2)

`PhotoBoardCard` / `photo` retains the original 4:5 photographic cover by default. Opt-in `details` reveals supplied
metadata on genuine hover, keyboard focus, or whole-card activation; Escape dismisses it. Internal typography,
gradient and line transitions leave parent gallery transforms and image zoom untouched. Missing fields stay absent;
missing/failed photos use a quiet architectural fallback. Parent widths remain responsible for readable card sizes.
Optional `presentation="cover" | "details"` holds a state for editorial comparisons without disclosure controls or
hover/focus/touch/Escape state changes. The default `interactive` presentation keeps existing gallery behavior.
Fixed details displays the expanded frame without needing `details`; empty fields stay absent and its heading falls
back to the existing Board title. Normal interactive cards with no detail metadata retain the cover presentation.
`ownership` defaults to unknown: no account control is shown without reliable context. Owners get informational
visibility icons; drafts are owner-only, while `collaborators` means restricted access including existing invited members.
Roamboard is not developing collaborative editing, invitations or member-management UI. Preserve current API access
rules until the backend team agrees on changes; do not label restricted published Boards as owner-only.

`AccountPhotoBoardCard` shares a local `board-save-store` across summary cards and `BoardDocumentPhotoCard`, which adapts an already-loaded canonical document, through
existing save/unsave services. Only server-confirmed writes change saved state. Unknown membership is disabled rather
than assumed unsaved. `/dev/boards` includes this connected V4 preview inside expanded records; documents are not
fetched just to populate cards. `/dev/board-cards` retains all variants and adds labelled V4 control/size/metadata studies.
Stage 3 Batches 1–4 migrate the My Boards featured/Recently Created/Archive, destination-story galleries, Continue, Draft selection, creator preview, saved/owned lists, profile collections and Discover result presenters. Batch 5 completes the final usage audit and targeted QA; see [the final QA report](../docs/V4_QA_REPORT.md) and the backend handoff for verification limits. Summary adapters omit unavailable metadata. Saved membership supplies initial bookmarks; own-list context supplies ownership and existing visibility. Public-profile membership remains unknown and disabled. Discover samples retain tag links without invented Board navigation or saving. Gallery `selection`
uses a native V4 card button that also toggles metadata when selected; navigation remains a separate gallery action. Inactive cards leave
the tab order, save controls keep their own keyboard interaction, and pan selection returns focus to the gallery region. Linked V4 cards preview metadata on the first touch and navigate on the next; mouse and keyboard retain normal link activation. There is no visible Details/Close button.
See [V4 backend handoff](../docs/V4_BACKEND_HANDOFF.md) for cumulative gaps.

### Live Discover Boards

Discover reads public, published summaries through the existing Recent and weekly Featured APIs with credentials
omitted. `data/discover-boards.ts` shares paginated summary reads within one server render, maps persisted tag names
to catalog IDs, and supplies real Board links, collection matches and destination counts. Collection tag matching
uses OR semantics and deduplicates Boards. Empty collections and vibes remain visible with an empty state; failed
reads show unavailable messages, never sample Boards or fabricated counts. Editorial covers and definitions remain.
Featured and RoamFlow reuse equal-sized PhotoBoardCards with the distinctive staggered placement; outer card edges
align with the section padding. RoamFlow uses real recent Boards,
including named placeholders for missing covers, and fetches further pages from the same public API.

### RoamFlow layout

Discover's RoamFlow section reuses `PhotoBoardCard` (V4) in one responsive CSS Grid with equal-sized cards and repeating staggered positions. It renders one continuous ordered list without interstitial headings.
`src/data/roamflow-boards.ts` retains fictional fixtures for tests and explicit demos; production uses the live loader in
`src/lib/roamflow.ts`. `useRoamFlow` handles request guards, cancellation,
deduplication, retry, and cursor progress. A sentinel starts loading ahead of the viewport until the API reports no more Boards. Appending a page runs as a React transition; the gallery and its individual cards are memoized so loading status and appended pages do not rerender existing cards. Failed loads show a retry control, and requests are canceled on unmount.
On desktop, `DiscoverExperience` updates the sticky track height directly from `ResizeObserver`; incoming Board pages do not rerender the whole Discover experience just to extend its scroll track.

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

`BoardComments` renders the approved Editorial layout after the published Board, including on the owner's view. It calls
the Board comment API proposed in `contracts/board-comments.md`, shows independent loading/error states, uses
server-provided comment permissions for edit/delete, and validates a Board return path through Google and guest login.
The backend endpoints and migration file are implemented. Comments persist after migration 013 is applied to the shared
database; applying it is a separate deployment step.

Published Board routes use the database viewer exclusively. The former hardcoded Tokyo document and sample
lookup were removed after importing Tokyo into the user's account through the canonical Board/image services.
The retired sample slug has no database alias and shows the missing-Board state. The old `PublishedBoardView`
inspector is no longer used by the page route. The profile page reads live account data through the profile API. `/profile` redirects signed-in users to `/profile/{handle}`. Handle pages are public: visitors see profile details and published public Boards; accepted friends also see friends-only Boards and their travel data. Profile maps reuse the Mapbox globe, include primary and confirmed activity locations, and exclude collaborator-only Boards. Published (deeper red) and Saved (contrasting orange, for owners and accepted friends) are both selected by default. Country tooltips follow the cursor after a 300ms hover with a short Motion fade and reduced-motion support. Country and pin clicks open the shared BoardLibrary carousel directly beneath the map; clicking an uncolored map area closes it. Active map filters determine the collection, with one card per Board. The selected collection loads authorized documents through the existing Board API and shared photo-card adapter for genuine hover metadata; inaccessible documents are omitted and network failures preserve summary covers with retry. Hovering or focusing a carousel card enlarges its visible map markers. BoardLibrary supports optional onBoardHighlight and compact embedded placement for reuse. Travel totals follow visible published Boards, and activities done currently counts activities on all visible published Boards. Owners retain the account profile and saved Board collection. Published Board author names link to handle pages.

Profile settings validate the existing backend rules before saving. A red error summary above Save Changes explains corrections and links to the affected fields; save failures retain the draft. Loading failures are separate from save errors. Pending saves disable editing and repeat submissions. A confirmed save opens the returned username's profile with an owner-only, dismissible confirmation. Leaving settings while a save is pending prevents its eventual response from redirecting the user back. Profile photos still save through their separate controls.

`useBoardPhotos` fills decorative desktop photo spaces from a shared destination/country Unsplash pool, with
location/tag fallback when a successful search returns too few photos. These illustrations are independent of
activity photo matching. A missing user-selected header uses another distinct automatic photo. Existing headers and activity photos are retained; IDs and image URLs already used in
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

`/dev/board-selection` is a development-only visual review of the production Continue/Draft presenters. Its labelled fixtures support loading, missing-cover and denied-access compositions; fixture editor links are intercepted, and no Board data is requested or persisted. It is unavailable in production. Real requests, restoration, permissions, pagination and retry remain covered by the page/store/API-helper tests.

`/dev/creator-preview` is a development-only visual review of the production creator preview, with labelled empty,
draft, published, long-title, failed-image and read-only fixtures. It uses existing reference images;
editor links are intercepted and no Board data is requested or persisted. Use the actual creator for source-control
focus/navigation and persistence checks. The fixture route is unavailable in production.

`/dev/board-collections` is a development-only visual review of production saved, owned, profile and Discover card
presenters. Fixtures use existing reference photos; account mutations and fixture Board links are intercepted. The
fixture removal button only demonstrates exit/layout transitions. `saved-boards-store` is page-local and uses the
existing credentialed saved-list service; confirmed unsaves refresh page one to avoid offset-pagination skips. Exiting saved rows become inert; a focused bookmark moves to another card or the saved list before its row is removed.
Independent tests cover real helper calls with controlled responses, failures, duplicate guards, permissions and
pagination. The harness is not evidence of persisted-account save behavior.

### Creator photo editing and destination suggestions

02 and 03 now use the same single-title numbered intro as the later chapters. The cover Smart Create tooltip,
Review activity links and card overflow move menus are removed. Cards still open the editor; day/order controls
there provide a keyboard alternative to dragging. The upload strip shows an unassigned count and per-photo
assignment status, excluding stock photos.

PhotoEditorDialog is shared by Board uploads, activity uploads and profile pictures. It offers draggable and
keyboard-adjustable crop bounds, aspect presets and resize limits, without rotation or format conversion. It edits
presentation settings through the protected image API, retaining the original and GPS/time. Reset restores original
presentation. Saves apply to every use of that uploaded image and use an image revision to reject stale edits.
The owner-only editor source is bounded to 4096px; ordinary delivery keeps its display/thumbnail bounds. Preview
URLs update after saves. Modal focus, loading, failure, discard and leave-warning states are explicit.

Publishing requires a main destination; incomplete drafts remain saveable. Three or more located activities can
autofill an empty destination through a majority-area suggestion. Manual selections and explicit clearing stop
autofill. Suggestions are labeled and editable; ambiguous or scattered locations leave the field empty.
The suggestion uses at least three points and a 60% cluster within 120km of a representative; differing cities or
spread over 25km requests a region, otherwise a city. These are initial heuristics, not proof of a trip boundary.

Verification note: the photo-edit tests were authored alongside implementation. Independent
review of their intent and coverage is still required before treating this UI as fully verified. Browser
acceptance for crop dragging, focus, aspect selection and live destination autofill also remains pending because
no browser was connected. Automated API, SQL, bounds and signed-delivery checks are separate evidence.

## Board photo controls and destination illustrations

The cover icon opens BoardCoverDialog to select any Board upload, including activity photos, and crop/resize it
through the existing persisted photo editor. BoardPhotoStrip supplies arrow navigation in cover and activity dialogs.
Thumbnail lists lazy-load with asynchronous decoding. Creator photo reviews use thumbnail delivery; the two V4 covers use display delivery. Activity cards avoid
Motion layout measurements, the sticky chapter bar has an opaque background, and Smart Create uses one combined
SVG circuit mask instead of 78 masks. Browser performance measurements remain pending.
Decorative published Board spaces use a shared destination/country Unsplash search pool of up to 20 photos, selecting
distinct candidates randomly per resolution. They show photographer/Unsplash credit, never attach themselves to
activities, and leave placeholders on failure. Strict place matching still applies to actual activity photos.

The Board editor offers owners a Delete Board text action below View saved Board for persisted drafts and published
Boards, including saved remix copies. It uses the existing owner-only DELETE endpoint and shared confirmation dialog,
locks editing during confirmation, retains failures for retry, and returns to `/boards` after deletion. The endpoint
removes Board children through database cascades and marks uploads for the existing unused-image cleanup.

### Shared Board list hover controls

Featured spatial galleries, the destination Board gallery and BoardLibrary reuse the photographic hover header with the author photo and `@handle`. Owners receive View, plus a pen when edit permission is available; other authors receive View and an independent saved-state bookmark. The bookmark uses the existing account save store and fills after a confirmed save; Remix keeps its template plus action. Secondary spatial/deck cards select first without navigating or exposing primary-only hover controls. Equal-card BoardLibrary items remain direct navigation. Owner galleries reuse their loaded documents; destination galleries load the selected Board through the existing document endpoint, retain summaries on failure and offer retry. Library arrows are centered below the cards and above the scroll indicator; spatial arrows are centered above the bottom divider. These list placements suppress standalone Unsplash cover credits so they cannot alter gallery geometry; other photo placements retain their credits.

The featured My Boards gallery takes up to ten loaded Boards, keeps its 400px maximum card size, centers the Featured Boards heading and places navigation immediately below the shorter stage. Its former visible destination/day caption and Open Board footer link are removed. BoardLibrary cards have a 328px maximum width in 376px desktop slides. Focused published spatial/deck card backgrounds open the Board view, while inactive cards select first. Equal-card library cards open directly. View, Edit, Save and Remix controls remain independent.

Board hover actions and the profile header share the same disclosure state as metadata; they no longer use independent group-hover opacity. Dragging suppresses hover content and native image/link dragging, while profile and action controls scale subtly on hover/focus with reduced-motion support. Spatial galleries interpolate card positions, scale and opacity while dragging. Continue/Remix deck cards follow the pointer and promote on release, suppressing drag-release navigation. Featured frames have no gray boundary; BoardLibrary preserves its boundary without per-card separators. Its 8px native range scrollbar supports pointer and keyboard input and continuous between-snap scrolling through the isolated Embla 8.6 adapter in `board-library-scroll.ts`; check this adapter when upgrading Embla. Active library arrows use foreground color. Interaction tests were authored alongside implementation; browser drag/hover verification and independent test review remain pending.

The three Board browsing components opt into the shared `BoardCardTilt` presenter for the same subtle spring-based pointer tilt. It follows mouse position only, resets on pointer leave/press/cancel or drag suppression, and honors reduced motion. The former Continue-only tilt wrapper was removed to prevent nested transforms. Featured and destination galleries opt into visibility indicators for any known published visibility, regardless of ownership; unknown publication/access data remains unlabelled. Indicators reuse existing public/friends/restricted-access labels and icons and never grant edit permission.

Owner and visitor profiles use the same BoardLibrary presenters for Currently inspired by (the profile owner's saved
Boards) and My boards (their visible published Boards). Visitor View all buttons expand that person's collection in
place. Saved membership on another profile never initializes the visitor's bookmark state. Profile libraries omit the
thin inner divider above the cards; section dividers remain.
Profile collection previews resolve authorized documents through the existing Board API for author photos, itinerary
metadata, current viewer bookmark membership and edit permissions, retaining summary covers with retry on network
failure. The shared photographic card opens its hover actions even when summary metadata is absent. Selected deck
cards use the same lower Bookmark/View action placement as BoardLibrary, reserving the top right for known visibility.
Profile card and navigation spacing is compact. Regression tests were authored alongside these changes; independent
test review and browser verification remain pending.

Continue/Remix galleries and their secondary/collection cards also opt into known visibility indicators, independent of Board ownership. BoardLibrary navigation uses a centered two-column group; arrows keep the foreground color even when disabled, while native disabled behavior remains.

Board preview libraries and spatial galleries show at most ten Boards. Profile preview reads request ten; previews do
not append pages or expose Load more. View all opens BoardCollectionGrid, which retains twenty results per page.
Library totals are separate from the rendered-card count. Featured and destination stories share SpatialGallery,
including its five-card overlapping desktop composition, drag handling and keyboard navigation. Discover collection
routes embed the account-aware grid with their fixed OR tag scope. Discover direct cards resolve viewer permissions
before offering owner Edit or another author's bookmark. Destination View all retains public activity locations in the
same country or within 25 km, using the destination collection context. Browser visual acceptance remains pending.

Discover vibe routes also embed BoardCollectionGrid with their fixed tag. Discover Featured and RoamFlow use the same
permission-resolving card as other Discover lists; unknown ownership exposes no bookmark, and resolved owners get Edit.
