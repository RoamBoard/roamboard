# Roamboard — The Craft Audit

Research date: 19 October 2026, Europe/Stockholm. Repository: branch **board-issue-fix**, revision **89f7315**.
This is a scouting document. Recommendations below are proposals for review, not approved product decisions.
No production component, styling, animation, dependency, backend contract, account record, or Git history was changed.

## A. Executive assessment

Roamboard has a much stronger visual identity than its level of execution consistency. Its best screens already feel
authored: the quiet Roam prompt, peripheral architectural drawings, curved Create and destination photography, large
Cabinet headings, photographic V4 cards, spatial Board compositions, and fine editorial rules belong together.
Replacing them with conventional dashboard layouts would make the product less distinctive.

The weakness is reliability at the boundaries of those compositions. A heading is sized against a different width from
the space it actually occupies. An editorial grid switches to its desktop proportions before its narrowest card can
hold its title. A viewport-height page gives a paragraph only four pixels. A horizontal wheel handler overrides a
chapter's necessary vertical scroll. These are conspicuous defects in otherwise confident designs, not evidence that
the designs need to become less ambitious.

The most consequential discovery is functional: selecting **San Sebastián** in Roam leaves a valid destination behind a
loading overlay until its 25-second timeout. The page reports a double-encoded readiness URL. This is ahead of any
microinteraction in value. Stockholm's isolated final M and the background-card word fragments are also reproduced.
The reported image-failure recentering was **not** reproduced; the tested V4 failure retained identical geometry.

Tomorrow should first make the existing compositions dependable, then make common controls acknowledge input more
precisely. A small press response, truthful disabled state, or correctly positioned selection underline is more valuable
than another entrance sequence. The existing three-second destination introduction is itself a candidate for **less**
movement and waiting.

### What to protect, and what to leave alone

- Preserve the architectural drawings and their protected search area. A partially cropped peripheral illustration is
  an editorial decision; a cropped destination name is not the same thing.
- Preserve the photographic masks, asymmetric grids, large display type, country watermarks, and spatial galleries.
  Cropping the decorative country watermark is intentional. Cropping identifying card-title words at the stage edge is
  a different problem.
- Keep V4's stationary 4:5 frame, architectural missing-cover treatment, and internal details transition. A 400px card
  remained 400×500px after a deliberately broken image. Do not replace this with an expanding error panel.
- Keep server-confirmed bookmark semantics. Pending and failed states already have distinct presentations. Never
  introduce a filled bookmark, checkmark, success toast, or incremented total merely on pointer down.
- Keep the editor's numbered chapters, local preview, unsaved status, location selection, explicit reordering controls,
  and discard confirmation. The local activity and tag flows give useful cause and effect already.
- Keep RoamFlow's retained content on failure, retry, loading guard, and escape to the footer. Its labelled 1,000-card
  fixture mounted 1,000 stories and its footer remained reachable. This was a functional smoke check, not a benchmark.
- Keep the mobile sidebar's modal navigation, Escape dismissal, and trigger-focus restoration. These worked after the
  close animation settled. Do not turn every navigation hover into an additional effect.

### Method, evidence, and limits

The audit combined sustained interaction in Chrome with source tracing. Both existing servers were running from this
checkout: frontend on localhost:3000, active backend on localhost:3001. The existing signed-in session was used for
reads. The account had no published Boards, saved Boards, or drafts in the inspected lists. Public numeric Board routes
and public/friend profile content were readable. Persisted demo Boards returned by the API are distinguished below
from frontend fixtures, even when their titles or descriptions say Demo.

Inspected instructions: root and frontend AGENTS.md, relevant backend guidance for read-only tracing, root formatting
configuration, application manifests, and current architecture notes. No Figma source file or original screenshot
attachment was available. The supplied attachment contained the brief only; the three described screenshot defects
were investigated independently. Abandoned layered-backend-demo1 code and abandoned Experience Labs were not used.

Viewport samples were 320×568, 390×667, 390×844, 768×1024, 1280×600, 1440×900, 1920×1080, and the initial
1470×836 browser viewport. This was a targeted matrix, not every route at every size. Both themes were inspected;
dark was restored afterward. Temporary viewport overrides were reset. Development compilation indicators and
first-frame transitions were not classified as production layout defects.

| Surface                   | Browser work actually performed                                                                                                                                                                                                           | Data and verification boundary                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Roam                      | Prompt, focused SVG surroundings, Stockholm suggestions and keyboard submission, zero results, San Sebastián, cancellation of the seven-second development delay                                                                          | Real search responses; controlled delay explicitly a fixture; no provider outage manufactured                               |
| Destination guides        | Stockholm in desktop, tablet and mobile sizes; places, Vasa selection, map matching/details, Board selection, short-height scroll, closing chapter; San Sebastián direct entry                                                            | Live guide/provider/API content; public Boards include persisted demo documents; no saves                                   |
| Discover                  | Desktop horizontal photo sequence, skip link, tablet bento/trending grids, mobile intro, Next and resize, tag search, Nightlife collection, Architecture Vibe, static Vibes                                                               | Editorial/count/story samples visibly labelled; city guides are live; Collection Boards explicitly unavailable              |
| Boards and personal areas | My Boards and Saved empty states, Archive library, actual Continue and Drafts empty states, owner profile and populated handle profile, public profile Board library                                                                      | Actual account reads; Archive and Vibe stories are samples; populated owner galleries inspected in labelled fixtures        |
| Published Board           | Numeric Board 5, header and save/count affordance, Shibuya activity modal, mobile modal scrolling, Escape and history return                                                                                                              | Canonical persisted document; account saving deliberately not activated; activity saving/copying labelled tab-local preview |
| Create/editor             | Entry composition and new-Board navigation; long title; location search with keyboard; add Vasa locally; add second day; move activity via Day control and Save activity; tag add/zero results; cover dialog; preview; leave confirmation | Only unsaved in-memory edits; explicitly discarded; no upload, draft save, publish, deletion, or account update             |
| Existing fixtures         | V4 240/400px, long title/author, missing and failed image, pending/error save presentation, forced reduced motion; Continue loading/denied/no-cover; dark creator preview failure/long title                                              | Production presenters with labelled illustrative data; no proof of persistence or account permissions                       |
| RoamFlow fixture          | Failed next page retained seven stories; retry showed disabled loading and reached fourteen; empty, forced reduced motion, 1,000 stories, footer escape                                                                                   | Fictional/stress data; 900ms fixture transport; no real public feed performance claim                                       |

Not verified: successful or failed real writes, upload/crop persistence, native touch behavior on physical devices,
browser-level reduced-motion emulation across the entire app, a controlled slow/broken Unsplash photo inside a live
fan, complete backend outage, all alphabets in actual guide rendering, zoom/assistive-technology combinations,
and populated owner save-removal/pagination. Existing reduced-motion fixture branches and relevant source were
inspected; that does not establish complete system-preference coverage. No service was stopped and no account data
was fabricated to fill these gaps. A very long local Board title, short/empty fixture titles, long author, missing
metadata, zero/one/many results, rapid gallery selection, and a resize during carousel selection were exercised.

## B. Verified defects

Severity describes harm; backlog priority also considers frequency, effort, and dependencies. High confidence means
the browser result and source agree. A likely cause is identified separately where upstream provenance is uncertain.

### CRAFT-01 — Accented destination navigation times out over a valid page

- **Page/component:** Roam → destination route; DestinationTransitionProvider and DestinationReady.
- **Reproduce:** On /home search San Sebastián, wait for the Spain suggestion, press Enter, and let the transition
  finish. The URL changes, but the overlay stays until the 25-second deadline. Reload that same URL directly.
- **Observed:** The overlay reports that the destination could not finish loading. The underlying DOM already has the
  San Sebastián heading. Direct reload subsequently displays the guide, photographs, sights, and honest missing-intro
  / zero-Board states.
- **Expected:** A successfully mounted route releases the overlay; a diacritic must not turn a valid route into a
  false loading failure. Retry must not repeat a URL-identity mismatch.
- **Severity/confidence:** High, primary-flow blocker. Verified browser behavior; high confidence in root cause.
- **Root cause:** The search helper encodes the slug once. In this running Next version, route params retain the
  encoded slug; resolveDestination applies encodeURIComponent again. A read-only download of the rendered page
  showed DestinationReady receiving san-sebasti%25C3%25A1n, while navigation used san-sebasti%C3%A1n. The loading
  store accepts readiness only when the href strings are exactly equal.
- **Files:** [destination route][destination-route], line 29; [destination-guides.ts][destination-guides], lines 124–141;
  [destination-loading.ts][loading-store], lines 85–86; [DestinationTransitionProvider.tsx][transition-provider],
  lines 168–176.
- **Implementation direction:** Define one URL identity at the route boundary, with exactly-once path encoding and
  consistent query serialization. Preserve namesake/selector validation. Do not solve this by removing readiness
  checks or swallowing the timeout. Test accented and non-Latin paths, plus reserved characters and namesakes.
- **Evidence:** [Timeout](ux-craft-evidence/11-accented-route-timeout.jpg),
  [same destination on direct entry](ux-craft-evidence/12-san-sebastian-direct.jpg).

### CRAFT-02 — Stockholm splits into STOCKHOL / M

- **Page/component:** Destination introduction, oversized heading inside the circular cutout.
- **Reproduce:** Open Stockholm at 1470×836; repeat at 768×1024, 390×844, 390×667, or 320×568.
- **Observed:** A lone M falls onto a second line. At the initial desktop size the text region was about 359px wide
  with a 71.09px font and 127.97px two-line height. At 390px it was about 159px wide with a 32.5px font.
- **Expected:** Preserve the scale and the complete single-word name within its actual safe text region. Multiword
  names should have intentional word-boundary composition. San Sebastián fitted at small size, but its length-based
  sizing made it much less expressive; merely shrinking everything is not the goal.
- **Severity/confidence:** High visual defect on a primary surface. Verified; high.
- **Root cause:** Font size uses name length and hero cqw; the title's usable region is only left padding through
  right:45%. break-words then permits an arbitrary character break. Letter count also ignores glyph widths, spaces,
  diacritics, font loading, and script differences. The circular clipping layer adds a separate visibility constraint.
- **Files:** [DestinationPage.tsx][destination-page], lines 43–75.
- **Implementation direction:** Make the safe text box the sizing reference. Try a bounded container-based size and
  deliberate word wrapping first. If long single words still need fitting, measure the final font/text within that
  box after fonts are ready, and on container resize. Keep a CSS-first readable fallback. Do not scale the complete
  heading transform, rely only on character count, or use balance as a cure for an overlong single token.
- **Evidence:** [Desktop](ux-craft-evidence/01-stockholm-desktop.jpg),
  [mobile](ux-craft-evidence/03-stockholm-mobile.jpg),
  [short desktop](ux-craft-evidence/04-stockholm-short-height.jpg).

### CRAFT-03 — Background gallery cards expose amputated title words

- **Page/component:** Stockholm public Board fan; related spatial/selection galleries need the same review.
- **Reproduce:** Open the Stockholm Boards chapter at desktop width. Look at the left and right background titles.
  Change selection and compare which fragments are exposed. Compare the existing Continue fixture's stacked cards.
- **Observed:** Card edges cut through the starts/ends of identifying words. The selected card is readable while
  surrounding cards use the same foreground title layout behind overlapping cards and an overflow-hidden stage.
  The decorative SWE watermark is also cropped, but that is intentional and should remain.
- **Expected:** Background cards retain rich photography and recognisable editorial lettering without arbitrary
  half-word fragments at stage boundaries. Selected titles retain full prominence.
- **Severity/confidence:** High visual salience; medium functional harm. Verified; high for the destination fan,
  medium for generalising every gallery configuration.
- **Root cause:** DestinationStories offsets cards by 76% of their width, scales background cards to 0.76, and clips
  the stage. SpatialGallery uses 78% offsets and 1/0.78/0.54 scales; Continue has a different overlapping stack.
  A CSS scale changes painted size, not internal wrapping. V4's two-line clamp is deliberate truncation; it cannot
  protect text from a parent stage cutting across the card. Background typography has no visible-area policy.
- **Files:** [DestinationStories.tsx][destination-stories], lines 148–215;
  [SpatialGallery.tsx][spatial-gallery], lines 117–169;
  [BoardSelectionGallery.tsx][selection-gallery], lines 96–141;
  [PhotoBoardCard.tsx][photo-card], lines 155–177.
- **Implementation direction:** Start with the fan's geometry: reserve an exposed top/title strip or a little more
  lateral breathing room while retaining overlap below it. Give the card an explicit background presentation with
  smaller, word-bounded title composition and an inset based on the genuinely exposed portion. Keep title, image,
  and optional author hierarchy; do not simply hide all titles. Try this first in one production fan, then adapt
  other parents deliberately. Do not animate the same outer transform from inside the card.
- **Animation check:** Selection changed which titles were clipped; it did not fix clipping. A Continue entrance was
  briefly seen before the stack settled. That observation is not enough to claim a separate animation defect;
  first-frame/interrupt/resize recording belongs in acceptance testing.
- **Evidence:** [Live destination fan](ux-craft-evidence/02-stockholm-gallery.jpg),
  [settled Continue fixture](ux-craft-evidence/09-continue-stack.jpg).

### CRAFT-04 — Short-mobile layout effectively removes the destination introduction

- **Page/component:** Stockholm About panel at 320×568.
- **Reproduce:** Open the introduction at 320×568. Compare with 390×667 or 390×844.
- **Observed:** The description remains in the DOM but its box shrinks to approximately 4.27px high, with roughly
  230px of scroll height. The user sees the heading followed by attribution, with almost no introduction text.
- **Expected:** Show a deliberate readable excerpt, or a clearly controlled expansion, with attribution and onward
  navigation reachable. Do not silently compress body text below one line.
- **Severity/confidence:** High content loss. Verified DOM measurements and screenshot; high.
- **Root cause:** The hero reserves 38% of the viewport; the remaining information panel is a constrained flex column.
  The description can shrink while the tip, credits, margins, and navigation compete for space. Overflow is hidden;
  a height media query alone does not account for narrow text producing more lines.
- **Files:** [DestinationPage.tsx][destination-page], lines 41 and 86–177.
- **Implementation direction:** Budget a minimum readable excerpt and prevent that excerpt from flex-shrinking below
  its line count. At constrained width/height, compact or disclose the secondary city tip and use content-aware
  composition. If vertical scrolling is needed, explicitly resolve CRAFT-05 with it. Avoid reducing body type further.
- **Evidence:** [320×568 content loss](ux-craft-evidence/14-stockholm-description-lost-320.jpg),
  [390×667 comparison](ux-craft-evidence/13-stockholm-short-mobile.jpg).

### CRAFT-05 — Wheel scrolling skips the chapter instead of reaching its controls

- **Page/component:** DestinationRail with the vertically overflowing Boards chapter.
- **Reproduce:** At 320×568 enter Stockholm's Boards chapter. Scroll downward over its card to reach gallery controls.
- **Observed:** The chapter is 568px high with about 770px of content. Open Board starts around y=666px, below the
  viewport. Wheel scrolling advances to Start a Stockholm board rather than scrolling the chapter down. The chapter
  has overflow-y:auto, but the rail prevents the wheel's default behavior.
- **Expected:** An overflowing chapter consumes vertical input until its own end. Then an intentional outward
  gesture can advance the horizontal guide. Keyboard navigation and touch must have equally clear ownership.
- **Severity/confidence:** High; controls become difficult to reach for wheel users. Verified; high. Physical touch
  and a full keyboard path to every offscreen control remain separate checks.
- **Root cause:** DestinationRail's wheel listener prevents default on almost everything except the map. It handles
  a data-destination-scroll horizontal exception, but the fan chapter's necessary vertical overflow has no exception.
- **Files:** [DestinationRail.tsx][destination-rail], lines 30–59 and 105–140;
  [DestinationStories.tsx][destination-stories], lines 55 and 132.
- **Implementation direction:** Determine whether the event is inside an overflow region that can consume the
  gesture in that direction before translating it to chapter navigation. Apply a parallel policy to keyboard input;
  preserve map cooperative gestures. A width/height-aware stage can reduce overflow, but must not be the only fix.
- **Evidence:** [Offscreen controls](ux-craft-evidence/15-short-gallery-controls.jpg); the subsequent wheel gesture
  visibly moved to the closing chapter with the inner scroll still at its starting position.

### CRAFT-06 — Public profile handles escape their heading

- **Page/component:** HandleProfileContent heading.
- **Reproduce:** Open /profile/adam_da_goatd at 390×844.
- **Observed:** The heading has a 294px box and about 406px scroll width at 48px type. Its right side disappears beyond
  the page. The document itself remains 390px wide, so the user cannot recover it with horizontal scrolling.
- **Expected:** A complete identifiable handle, deliberately fitted or wrapped, while maintaining display hierarchy.
- **Severity/confidence:** Medium; prominent identity clipping. Verified; high.
- **Root cause/files:** Fixed display size with no robust unbroken-handle strategy in
  [HandleProfileContent.tsx][handle-profile], lines 136–141. Parent clipping conceals the overflow.
- **Implementation direction:** Constrain the heading to available width, allow sensible breaks around handle
  separators, and apply a bounded display size. Keep the full accessible name. Do not apply destination's single-word
  fitting policy indiscriminately to usernames, body text, or editable input values.
- **Evidence:** [Mobile profile](ux-craft-evidence/10-profile-name-sizing.jpg).

### CRAFT-07 — Longer profile names fall through to 16px

- **Page/component:** ProfileHero display-name sizing.
- **Reproduce:** Compare Alexander with Adam Trossing at mobile width. Inspect the latter heading's computed size.
- **Observed:** Adam Trossing receives text-38, which has no matching theme font-size token; its computed size is 16px.
  Alexander takes the valid text-48 branch. At desktop Adam's valid sm:text-48 restores display scale.
- **Expected:** Longer names become moderately smaller in the same typographic family, not unexpectedly body-sized.
- **Severity/confidence:** Medium conspicuous inconsistency. Verified; high.
- **Root cause/files:** getNameStyle in [ProfileHero.tsx][profile-hero], lines 31–43, uses text-28, text-32, text-34,
  text-38, and text-40; these are absent from the [globals.css][globals] theme scale. The longer-name branches therefore
  also need review, including desktop branches whose fallback class is undefined.
- **Implementation direction:** Use defined scale values or explicit approved arbitrary sizes; make every branch
  generate a real CSS rule. Review 10/11, 16/17, and 24/25-character boundaries, wide/narrow glyphs, spaces, and accents.
  A narrowly scoped fluid rule could remove the need for several character thresholds.
- **Evidence:** [Same mobile profile](ux-craft-evidence/10-profile-name-sizing.jpg); computed size 16px versus 48px
  at desktop. No profile data was changed to reproduce this.

### CRAFT-08 — Tablet Discover grids cannot hold their content

- **Page/component:** Trending destination cards; related Curated Collections bento.
- **Reproduce:** At 768×1024 use Skip to discovery, then inspect By the Water and the Indonesia card.
- **Observed:** Indonesia is clipped horizontally in a roughly 94.66px card. Its heading has about 109px scroll width
  against a 95px box, even before allowing for padding. The By the Water column turns supporting text into a stack
  of very short fragments. Desktop does not have the same constraint.
- **Expected:** Keep the asymmetric photographic hierarchy while giving labels and supporting copy a minimum usable
  measure. Identifying destination names must remain intact.
- **Severity/confidence:** Medium; visible text loss and weak tablet composition. Verified; high.
- **Root cause/files:** [DiscoverContent.tsx][discover-content], lines 123–155 and 166–187. Viewport md switches to
  twelve-column editorial spans at 768px even though the sidebar and page padding leave only about 608px for the
  grid. Font sizes follow viewport units; card padding and content do not establish a minimum text width.
- **Implementation direction:** Keep the asymmetric desktop composition above a measured container threshold; use
  adjusted spans or an intermediate tablet grid below it. Treat title fit and minimum copy measure as constraints,
  not a reason to remove photography or make every card identical. Check sidebar-expanded width too.
- **Evidence:** [Tablet bento](ux-craft-evidence/16-discover-tablet-bento.jpg),
  [country title clipping](ux-craft-evidence/17-discover-tablet-country-clipping.jpg).

### CRAFT-09 — Light-theme functional supporting text lacks contrast

- **Page/component:** Discover search guidance; recurring small supporting labels and helper copy.
- **Reproduce:** In light theme inspect the search guidance below Discover's input. Compare dark theme.
- **Observed:** Computed text is rgb(129,129,129), 12px, on white. Its calculated contrast is **3.896:1**. The dark
  muted token is about 7.174:1 against its background. Several 10–12px editor and profile instructions use the same
  light token, sometimes with additional opacity.
- **Expected:** Normal-size functional text meets at least 4.5:1. Decorative rules and watermarks need a different
  assessment; they should not all become darker. See the [W3C contrast guidance][contrast].
- **Severity/confidence:** Medium accessibility defect with broad reach. Verified computed styles/calculation; high
  for the sampled text, not a claim that every text/photo combination has been contrast-tested.
- **Root cause/files:** The light muted token in [globals.css][globals], line 17, is serving both functional small
  text and quiet visual hierarchy. [DiscoverSearch.tsx][discover-search], lines 213–217, is one confirmed instance.
- **Implementation direction:** Start by applying an existing stronger semantic treatment to essential helper text,
  labels, counts needed for action, and enabled control names. Review the approved palette rather than silently
  replacing it globally. Inventory token usages before any shared-token change; preserve the faint architectural rules.
- **Evidence:** [Tablet search guidance](ux-craft-evidence/17-discover-tablet-country-clipping.jpg) plus the computed
  12px / rgb(129,129,129) / white measurement. This is a color calculation, not a full accessibility certification.

### CRAFT-10 — Day-plan arrows remain enabled when nothing can scroll

- **Page/component:** DayPlanner navigation.
- **Reproduce:** In a fresh unsaved Board at 1440×900 inspect the one-day plan and click Previous days or Next days.
- **Observed:** Both arrows look enabled and accept focus, but no movement occurs. Measured strip client width and
  scroll width were both 1264px, with scrollLeft=0. Adding a second day still fits at this width.
- **Expected:** Disabled controls truthfully communicate no movement in that direction. Re-enable after content or
  viewport changes produce overflow. No celebratory motion should disguise a no-op.
- **Severity/confidence:** Low-to-medium interaction defect. Verified; high.
- **Root cause/files:** The two buttons in [DayPlanner.tsx][day-planner], lines 104–130, call scrollBy without boundary
  state. Shared [BoardLibrary.tsx][board-library] already has meaningful carousel-disabled behavior to learn from.
- **Implementation direction:** Derive can-scroll-start/end from the actual strip after scroll, resize, and day
  changes, accounting for a small rounding tolerance. Keep enabled hit areas/focus treatment consistent with galleries.
- **Evidence:** Browser action and DOM dimensions above. Only unsaved local data was used and later discarded.

### CRAFT-11 — Destination tags look like links but have no action

- **Page/component:** Desktop destination introduction's Tags from public boards.
- **Reproduce:** Open Stockholm at desktop width; inspect or attempt to activate an underlined tag.
- **Observed:** Underlined names are plain list items. They have no link, button, keyboard action, or destination.
- **Expected:** Informational metadata looks informational; navigable tags expose a real, supported destination.
- **Severity/confidence:** Low but frequent affordance mismatch. Verified rendered markup; high.
- **Root cause/files:** [DestinationPage.tsx][destination-page], lines 186–192, adds underline to li elements.
- **Implementation direction:** Remove link styling for the current informational list. Linking tags is a separate
  behavior decision and must use valid catalog mapping; do not invent routes from arbitrary persisted tag names.
- **Evidence:** Initial desktop screenshot and DOM inspection. This recommendation does not require a new feature.

### CRAFT-12 — A public tag arrives as CafÃ© Hopping

- **Page/component:** Stockholm's public-Board tag labels.
- **Reproduce:** Open the desktop introduction and inspect Tags from public boards.
- **Observed:** CafÃ© Hopping appears alongside other tags. A read-only guide API response contained the same string
  in its third Board's tags. The shared editorial catalog and migration source spell Café Hopping correctly.
- **Expected:** Correct Unicode text without display-time repair heuristics.
- **Severity/confidence:** Low-to-medium conspicuous content defect. Verified output; high. Origin of the corrupted
  stored/imported value remains unverified; medium confidence that this is upstream data/ingestion rather than CSS.
- **Files:** [DestinationPage.tsx][destination-page], lines 186–192;
  [destination.repository.ts][destination-repository], raw tag aggregation;
  [shared tag catalog][tag-catalog]; backend/db/migrations/007_profile_tag_catalog.sql.
- **Implementation direction:** Identify the affected persisted tag and its import history, review references and
  duplicates, then propose a controlled correction. Do not rerun an applied migration, rewrite real data during the
  audit, or add a frontend Latin-1/UTF-8 guessing function. This is a data task with a separate approval boundary.
- **Evidence:** [Desktop tag line](ux-craft-evidence/01-stockholm-desktop.jpg) and matching public API text.

### CRAFT-13 — Zero-result search still offers an enabled Explore arrow

- **Page/component:** Roam destination search.
- **Reproduce:** Search zzzzzzzznotadestination, wait for No destinations found, then activate Explore selected
  destination.
- **Observed:** Loading ends and the arrow becomes enabled despite there being no selected destination. The store
  has nothing to submit, so the action leaves the user on the same empty result state.
- **Expected:** The arrow's availability matches its action. A failed request may offer retry, but zero results must
  not advertise an actionable selection that does not exist.
- **Severity/confidence:** Low; avoidable dead response on a frequent control. Browser availability and source
  verified; high. No navigation or data mutation is needed to reproduce it.
- **Root cause/files:** [DestinationExplorer.tsx][destination-explorer], lines 199–203, disables only loading/leaving;
  [destination-search-store.ts][search-store], submit returns no destination without an active result.
- **Implementation direction:** Derive availability from a valid selected result, preserving the distinct failure
  retry path and short-query validation. Keep a visible, helpful empty message without inventing results.

### Image positioning investigation — unresolved report, verified invariants

This is **not a verified image-induced recentering defect**. The supplied failure could not be replayed with its exact
reference because the original screenshots, asset identifier, gallery route, and dimensions were unavailable.

The existing V4 study was changed from a loaded Porto cover to its deliberate missing-v4-cover.jpg failure. Before and
after, the article was 400×500px at x=990, y=57. The missing-cover fixture and dark creator-preview failure also retained
their card frames. [BoardCardParts.tsx][card-parts] reserves aspect ratio; PhotoCover layers fill images absolutely and
only changes the image/fallback layer on error. SpatialGallery, DestinationStories, and BoardSelectionGallery do not
position cards from image onLoad or naturalWidth measurements.

The image library can swap catalog delivery to a source fallback, and an unresolved library key takes a separate span
branch. Photo credits, summary-to-document enrichment, sidebar width changes, stage container dimensions, and browser
scroll anchoring are plausible things to investigate in an exact reproduction. None is established as the reported
cause. Do not add a recenter effect, fixed timeout, or image-load measurement based on this suspicion.

Before changing gallery geometry for this report, reproduce missing catalog key, missing photo URL, HTTP image error,
and delayed decoding separately in the **affected fan**, keeping selection ID and viewport constant. Record article and
stage bounds before/after, selected ID, scroll offsets, caption/credit height, and parent transforms. All cover outcomes
should retain those geometry values within a one-CSS-pixel tolerance after settlement. Preserve the architectural
fallback and attribution provenance. A slow image was not artificially throttled in this audit.

Evidence: [failed-cover fixture](ux-craft-evidence/07-v4-failed-image.jpg),
[dark preview fallback](ux-craft-evidence/18-creator-dark-fallback.jpg),
[LibraryImage.tsx][library-image], [PhotoBoardCard.tsx][photo-card], [BoardCardParts.tsx][card-parts].

## C. Visual refinement opportunities

These are design proposals, not additional verified bugs. Fix the related B-section defects first.

| Opportunity                                              | Exact intended visual result and implementation direction                                                                                                                                                                     | Value / constraint                                                                                                |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| V-01: Treat display text by role                         | Destination names use the safe photographic cutout; handles use identity-aware wrapping; V4 retains a deliberate two-line title; multiword section headings can balance. Use defined font sizes and real container width.     | High reuse of principles; avoid one global fit-everything hook. Depends on CRAFT-02/06/07/08.                     |
| V-02: Make tablet editorial spans earned                 | By the Water should have enough room for a short phrase rather than six-character copy fragments. Preserve the wide-screen bento; set its threshold from the narrowest usable tile, including sidebar expansion.              | High visual gain for modest CSS work; typography and crops need review together.                                  |
| V-03: Clarify the empty editor's photo hierarchy         | In the short-mobile activity dialog, surface Search location without first scrolling through an empty photo drop area. Consider an initially compact photo disclosure when there are no photos, with a visible upload action. | Frequently used; retain the Smart Create/photo-first path and make the changed initial state a reviewed decision. |
| V-04: Let the editor show the whole title while editing  | A long one-line Board title becomes a horizontally scrolling field, even though its V4 preview truncates honestly. Consider a bounded auto-growing title field with the same display typography and stable chapter spacing.   | Useful for editing long prose titles; no universal font shrink or artificial title-length restriction.            |
| V-05: Strengthen essential small text selectively        | Keep fine rules and annotations quiet; make labels, guidance, enabled controls, and status copy readable in light theme. Consider 12–14px for functional instructions rather than recurring 10–11px.                          | Broad impact; changing opacity everywhere would flatten the composition. Review approved theme choices.           |
| V-06: Reduce duplicative hierarchy in one-item libraries | Architecture's one sample card has a useful, honest presentation and disabled arrows. The repeated Architecture / Architecture Boards heading could be quieter in embedded contexts.                                          | Cosmetic and low priority; do not redesign BoardLibrary or special-case every collection.                         |
| V-07: Improve destination chapter orientation            | Retain full-screen horizontal chapters, but expose a quiet current chapter / directional affordance after the introduction. A user should understand how to reach Boards without discovering wheel conversion by accident.    | Moderate value after CRAFT-05. No additional sticky header or permanent giant arrows.                             |
| V-08: Make unavailable entry points clear sooner         | Nightlife's result truthfully says Collection Boards are coming soon; Remix is already documented as unavailable. Consider a small availability cue before a large editorial click commitment.                                | Copy/affordance refinement only. Connecting discovery/remix is outside this craftsmanship backlog.                |

The editor's paired V4 preview is worth keeping. Its fixed cover/details comparison, connectors on large containers,
stacking on smaller containers, and direct edit links explain the actual result well. Long titles clamped with an
ellipsis and retained their accessible name. Missing fields were omitted instead of invented. Do not replace this
with animated preview choreography. [Local long-title preview](ux-craft-evidence/06-creator-long-title-preview.jpg),
[240px long-title/author fixture](ux-craft-evidence/08-v4-long-title-240.jpg).

## D. Interaction craftsmanship opportunities

Times and amplitudes here are proposed starting values for review, not measurements of newly implemented behavior.
No animation should delay dispatching a user action. All patterns need keyboard equivalence and a reduced-motion
branch; disabled controls do not animate as if activation succeeded.

| ID / action                                     | Precise response and timing character                                                                                                                                                                                                                    | Approach, user benefit, and guardrail                                                                                                                                                                                                                      |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I-01: Press gallery arrows and ordinary buttons | Immediate surface darkening/lightening, optional inner icon scale near 0.96–0.98 or 1px directional compression; quick 70–100ms press, 120–160ms ease-out release.                                                                                       | Existing CSS :active for simple controls. Keep the 44px hit box fixed; transform an inner icon/surface. Clear acknowledgment without a queued navigation animation. Start with DayPlanner and gallery controls after real disabled boundaries.             |
| I-02: Save a Board                              | On press acknowledge contact; once the request starts show busy state in a reserved icon slot. Only confirmed success fills the bookmark, with a restrained 120–180ms settle. A failed request restores the prior state and retains an actionable error. | Keep board-save-store and PublishedBoard write logic. Existing Motion can crossfade icons; do not add optimism, a bouncing heart, or fake totals. Maintain layout width through Saving/Removing/Save labels and keep error text readable.                  |
| I-03: Change Published/Drafts or map filter     | Update results and selected semantics immediately; a thin active underline follows the chosen label in about 160–200ms with little/no overshoot. Count/status updates identify the changed collection.                                                   | Existing Motion layoutId, scoped per group, or a small measured CSS indicator. Preserve the current editorial underline, not a generic rounded segmented pill. Multi-select map filters must remain independent pressed states.                            |
| I-04: Add/remove a tag                          | Selected chip appears in its final reading position; adjacent chips settle over roughly 120–160ms. Removal returns focus to search or the next relevant control. The three-tag limit remains explicit.                                                   | BoardTagPicker already animates position and has focus handling. Refine that behavior, rather than adding a toast or flying the tag across the screen. Confirm counts/announcements; no temporary selected-looking chip on a rejected action.              |
| I-05: Add or move an activity                   | Preserve focus on the resulting card; briefly emphasize its rule/category edge for roughly 300–450ms, with the existing live announcement stating the result/day.                                                                                        | Existing local state and DayPlanner announcements. Use a fading emphasis, not list-wide layout animation or a toast per move. Reorder controls must preserve time and work without dragging.                                                               |
| I-06: Assign a cover photo                      | Update hero and both preview cards from the same confirmed local selection/revision; a short opacity handover may acknowledge the changed image inside fixed masks. Keep the selected thumbnail visibly selected.                                        | Reuse current photo/preview adapters. No new upload request from the animation and no success until the actual selection/upload operation reaches its defined result. Upload/crop persistence still needs live acceptance later.                           |
| I-07: Open category/theme menus                 | Open near the trigger with a short opacity + very small scale response from Radix's resolved transform origin, around 100–140ms; close around 80–100ms.                                                                                                  | CSS data-state and existing Radix origin/available-height variables. Keep typeahead, Escape, focus restoration, and scrollable height bounds. Existing menu wrapper currently lacks an opening treatment; a new primitive is unnecessary.                  |
| I-08: Open/close activity or cover dialogs      | Show the surface promptly, using no more than about 6–8px entrance travel and 120–180ms. If exit animation is added, background remains inert and focus returns only after exit.                                                                         | Keep native BoardDialog and the editor's unsaved/upload/nested-photo safeguards. These use different implementations; unify the behavior contract before any visual abstraction. Do not migrate all dialogs just for animation.                            |
| I-09: Navigate to a destination                 | Keep the architectural language but reveal promptly once the route is ready. Reduce or remove the three-second minimum for ready/cached navigation; retain cancellation, genuine wait, retry and timeout.                                                | destination-loading currently defaults introMs=3000 plus a 650ms reveal. This is an intentional existing behavior, not a newly measured network delay. Fix CRAFT-01 first; review a shorter readiness-led sequence on real repeated browsing.              |
| I-10: Hover a photograph                        | On a stationary editorial/library card, evaluate only 2–4px of inner-image movement or the existing 1.025–1.03 scale. No outer-card lift. Return softly over roughly 250–400ms.                                                                          | Motion values/springs only if directional movement is worthwhile; otherwise CSS. Continue already tilts its selected card and RoamFlow already zooms imagery. Do not stack another transform on those parents or require pointer movement for information. |
| I-11: Enter Create from its circles             | Keep the generous circles and decisive selection; evaluate less than the current 9% hover growth and 40% departure expansion. Navigation must not feel held for the effect.                                                                              | Existing CSS module, current Escape/modifier/reduced-motion behavior. This is primarily a subtraction/refinement task, not a new signature animation.                                                                                                      |

For signature work, I-03's precise underline and I-05's activity placement acknowledgment have stronger product value
than magnetic buttons, cursor followers, tilt on every card, kinetic headings, or particles. A bookmark should feel
decisive because its state is clear and its control stays still, not because it performs a celebration.

## E. Component and technique research

All links were inspected on the audit date. Recommendations are adaptations to Roamboard, not endorsements to install
the source libraries. The installed stack already includes Motion, Radix Dropdown Menu, cmdk, Embla, lucide-react, and
Sonner. There is no reason to add another general animation dependency for the work ranked here.

| Reference and verification                                                                                                                                                                                                  | Specific lesson and Roamboard adaptation                                                                                                                                                                                                                                                                                                                     | Decision                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [animations.dev](https://animations.dev/) and Emil Kowalski's [Good vs Great Animations](https://emilkowal.ski/ui/good-vs-great-animations)                                                                                 | The public course page was inspected; paid lessons were not accessed. The author's working Options menu, easing comparison, and source examples were inspected and the menu/easing controls exercised. Trigger-relative origins and purposeful easing are relevant to category/theme menus; decorative spring behavior should not delay a functional result. | Borrow the reasoning. Use existing CSS/Radix for I-07; shorten unnecessary choreography before adding anything. No course-content claim or purchase recommendation.                                                                                        |
| Motion [gestures](https://motion.dev/docs/react-gestures) and [accessibility](https://motion.dev/docs/react-accessibility)                                                                                                  | Official docs/source examples distinguish tap, pan, focus and cancellation, including child event capture. These match existing gallery transform ownership and bookmark isolation. Reduced-motion support needs deliberate branches for large movement and custom values.                                                                                   | Existing Motion for I-02/03/05; CSS for plain presses. Keep current capture/drag guards. A global MotionConfig alone does not cover custom wheel logic, CSS motion, or every bespoke value.                                                                |
| Motion Primitives [Animated Background](https://motion-primitives.com/docs/animated-background#segmented-control), [source](https://github.com/ibelick/motion-primitives/blob/main/components/core/animated-background.tsx) | Browser demo was exercised with Week click and Month keyboard activation; its Code tab was read. The source shares a moving layer through a scoped layout identity; the demo pairs a 200ms selection movement with a small press response. Search extraction returned 403, but the normal browser page worked.                                               | Adapt the mechanism to a thin Roamboard underline. Keep the existing button semantics; do not copy the wrapper blindly, rounded pill styling, or its event-handler replacement. No package.                                                                |
| shadcn [Button examples](https://ui.shadcn.com/docs/components/button) and [Carousel](https://ui.shadcn.com/docs/components/carousel)                                                                                       | Button documentation includes a reserved spinner treatment and explicit size variants; the carousel model reinforces native controls and genuine boundaries. The current Button URL resolves to a Base UI example, while this repo uses its own buttons and selected Radix/shadcn-derived primitives.                                                        | Learn consistent target/slot geometry; do not run a generator or replace the project's controls. Reuse installed Embla/shared carousel for CRAFT-10's behavior principles, not a new carousel migration.                                                   |
| Radix [Dialog](https://www.radix-ui.com/primitives/docs/components/dialog) and [Dropdown Menu](https://www.radix-ui.com/primitives/docs/components/dropdown-menu)                                                           | Official docs/source show focus trapping/restoration, Escape behavior, controlled state, portal placement and trigger-relative origin variables. The relevant lesson is lifecycle precision, especially with nested confirmations, not the demo's appearance.                                                                                                | Keep the already installed dropdown primitive. Dialog package is not declared directly; prefer existing native/custom dialogs for this scope. Consider a new primitive only if later testing proves a lifecycle problem that focused fixes cannot address. |
| React Bits [Animated Content](https://www.reactbits.dev/animations/animated-content), [source](https://github.com/DavidHDev/react-bits/blob/main/src/content/Animations/AnimatedContent/AnimatedContent.jsx)                | Live demo loaded and its refresh control was exercised. Source exposes scroll/mount reveals, distance/duration/stagger and a reduced-motion branch, using GSAP/ScrollTrigger. Its broad reveal vocabulary is easy to overapply.                                                                                                                              | Do not import it. RoamFlow already has restrained in-view treatment; no extra reveal layer or GSAP dependency is justified. Learn explicit scroller targeting and cleanup if revisiting existing reveals.                                                  |
| MDN [text-wrap](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-wrap), Chrome [text balancing](https://developer.chrome.com/docs/css-ui/css-text-wrap-balance), and [W3C contrast][contrast]     | Native text balancing can improve short multiword headings; it is not measured fitting and cannot solve Stockholm as one overlong token. Contrast should be assessed from actual foreground/background styles, separating functional text from decoration.                                                                                                   | Existing CSS first; a small custom measured fit only where the constrained destination artwork requires it. Use the normal-text 4.5:1 criterion for CRAFT-09. No text-effect library.                                                                      |

The useful distinction is between **state mechanics** and **visual styling**. Borrow a shared indicator, correct origin,
focus lifecycle, fixed icon slot, or cancellation rule. Retain Roamboard's square photographic frames, typography,
underlines, monochrome controls, and unhurried negative space.

## F. Shared underlying issues

| Cause                                                    | Evidence across components                                                                                                                                       | Narrow response and trade-off                                                                                                                                                                                                            |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Available width is not consistently the sizing authority | CRAFT-02 uses hero cqw for a much narrower cutout; CRAFT-08 enables twelve-column desktop spans based on viewport md; profile handles have fixed display sizing. | Make the actual text/card region the authority in those components. Use container thresholds where the sidebar changes usable width. Do not replace every responsive utility or build a new layout framework.                            |
| Text roles lack explicit overflow contracts              | Name length heuristics, invalid profile size classes, profile handle overflow, stage-clipped card titles, and correct-but-different V4 ellipsis coexist.         | Specify four policies: hero names, identity strings, card titles, and supporting prose. Fix those call sites and undefined tokens; avoid a universal shrink-text hook.                                                                   |
| Viewport-fit layouts compete with real content           | CRAFT-04 paragraph collapse; CRAFT-05 controls below the chapter; compact Continue has separate height-aware CSS.                                                | Budget minimum readable content and stage/control areas; disclose secondary content or allow deliberate inner scrolling. Test width and height together. A height clamp alone is insufficient.                                           |
| Scroll ownership is encoded by exceptions                | Rail wheel interception knows Mapbox and one horizontal scroll selector but not the overflowing chapter.                                                         | One small, explicit ownership policy for inner vertical, inner horizontal, map, and chapter navigation. Verify gesture direction and edges. This is not a wholesale navigation rewrite.                                                  |
| URL identity is serialized in multiple places            | Once-encoded search href and double-encoded resolved-page href fail an exact readiness comparison.                                                               | One canonical representation shared at the boundary, with tests for Unicode and selector identity. Do not relax authorization/namesake validation.                                                                                       |
| Similar controls have separately authored feedback       | Gallery arrows, DayPlanner arrows, profile actions, publish text, and confirmations vary in size, disabled appearance and timing.                                | A short documented interaction rule and a few shared CSS classes can align ordinary controls. Keep editorial actions such as PUBLISH and circles distinct. Do not build a universal Button component before identifying real reuse.      |
| Transform ownership is already layered                   | Fans position/scale cards; Continue's TactileBoard supplies mouse tilt; V4 animates internal text; RoamFlow scales inner imagery.                                | Parent owns placement; an inner layer owns optional image response; text owns disclosure. Never add another hover transform to the placement layer. Cached pointer bounds also need refresh/reset if a resize is introduced during tilt. |
| Functional and decorative quietness share tokens         | Light 12px guidance uses the same muted token as intentionally quiet text; rules and watermarks are separate but similarly faint.                                | Correct functional usage first, then review any shared color change with its full usage inventory. Keep approved dark mode and subtle architecture.                                                                                      |
| Data truth and visual previews coexist                   | Live city Boards, unavailable Collections, labelled Vibe/Archive/RoamFlow samples, tab-local activity copies, and account bookmarks have different capabilities. | Keep truthful labels and permission gates. Improve the affordance at the point of action without inventing saved state, totals, Board links, or backend integrations.                                                                    |

Image geometry is largely a **strength**, not an established shared cause of the reported movement. Reserve it as an
invariant while investigating the exact failure. Data encoding is a separate root cause: the API already supplies
the malformed Café label, so a card/style rewrite cannot fix it honestly.

## G. Prioritized implementation backlog

Rank is the suggested order within each priority. Impact/frequency/visual gain/reuse are qualitative judgments from this
audit. Difficulty includes focused implementation and acceptance work: S is generally a small focused change, M needs
several related components or substantial layout QA, and L is an investigation whose fix is not established. These are
not delivery promises. Risk is regression risk, not severity.

| Rank / priority | Task and expected impact                                                               | Frequency / visual gain / reuse                                          | Difficulty / risk              | Relevant files                                                                      | Dependencies                                 | Concrete acceptance criterion                                                                                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 / P0         | CRAFT-01: Normalize route readiness identity; restores accented destination navigation | Primary flow / medium visual, very high functional / high                | S–M / medium                   | destination route, destination-guides, destination-loading, transition provider     | None                                         | San Sebastián opens from Home without false timeout; direct/retry/history and Unicode/reserved-character/namesake cases preserve correct identity and cancel stale attempts.                                                      |
| 02 / P0         | CRAFT-02: Fit destination names to the photographic cutout                             | Every guide / very high / high                                           | M / medium                     | DestinationPage                                                                     | None                                         | Stockholm never produces a lone M at tested sizes; short names retain expressive scale; long single/multiword, diacritics and non-Latin strings stay readable within the mask after font load and resize.                         |
| 03 / P0         | CRAFT-04: Keep a readable introduction at constrained sizes                            | Every narrow/short guide / high / medium                                 | M / medium                     | DestinationPage                                                                     | Coordinate with 04                           | At 320×568 the introduction retains its approved minimum lines; credits and onward action are reachable; no 4px paragraph or hidden actionable text.                                                                              |
| 04 / P0         | CRAFT-05: Resolve inner scroll versus horizontal navigation                            | Guide browsing / high / medium                                           | M / medium–high                | DestinationRail, DestinationStories, DestinationPlaces                              | Coordinate with 03                           | Wheel/keyboard/touch can reach offscreen Board controls; inner scroll consumes input until its edge; deliberate next gesture changes chapter; map zoom does not move chapters.                                                    |
| 05 / P0         | CRAFT-03: Give background cards a deliberate title composition                         | Spatial galleries / very high / high                                     | M / medium                     | DestinationStories, SpatialGallery, BoardSelectionGallery, PhotoBoardCard           | Preserve image invariants                    | Identifying words are deliberately fitted/ellipsized within the exposed text area; no arbitrary stage-cut glyph fragments; rich background imagery/watermarks remain; selection/drag/resize do not expose a broken interim state. |
| 06 / P0         | CRAFT-08: Delay/adapt desktop editorial spans                                          | Discover tablet / high / medium                                          | M / medium                     | DiscoverContent and destination/collection layout data                              | None                                         | At 768px and with expanded rail, Indonesia is fully readable and the smallest bento has a reviewed copy measure; wide desktop keeps its current asymmetric composition.                                                           |
| 07 / P0         | CRAFT-06/07: Repair profile identity typography                                        | Profiles / high / medium                                                 | S–M / low–medium               | ProfileHero, HandleProfileContent, globals scale reference                          | None                                         | A 13-character handle fits/wraps; all name-length branches emit valid sizes; 10/11, 16/17, 24/25 boundaries remain coherent at 320–1920px without account-data edits.                                                             |
| 08 / P0         | CRAFT-09: Correct essential small-text contrast                                        | App-wide light use / medium visual, high readability / high              | M / medium                     | globals usage inventory, DiscoverSearch, sampled editor/profile labels              | Review token scope                           | Functional normal-size text reaches 4.5:1 on its actual surface; both themes checked; faint decorative rules/watermarks and approved photographic lettering retained.                                                             |
| 01 / P1         | CRAFT-10/13: Make navigation availability truthful                                     | Day planning and search / medium / high                                  | S / low–medium                 | DayPlanner, DestinationExplorer, search store                                       | Before I-01                                  | Arrows disable correctly at actual boundaries and after resize; zero-result Explore cannot present a valid-selection action; failed-search retry still works.                                                                     |
| 02 / P1         | I-01/07: Align ordinary press and menu feedback                                        | Very frequent / medium / high                                            | S–M / low–medium               | Gallery arrow controls, DayPlanner, dropdown-menu                                   | P0 layouts; truthful boundaries              | Immediate contact feedback, fixed hit area, no dispatch delay, equivalent keyboard focus/activation, correct menu origin, and no motion in disabled/reduced-motion states.                                                        |
| 03 / P1         | I-09/11: Remove unnecessary waiting and oversized responses                            | Search/Create entry / high perceived responsiveness / medium             | S–M / medium                   | destination-loading, DestinationLoading, BoardCreationChoices module                | CRAFT-01                                     | Ready/cached navigation no longer waits for a three-second presentation; genuine waits/cancel/retry remain; Create circles feel decisive without a 40% departure becoming the main event. Review final timings.                   |
| 04 / P1         | V-03: Prioritize location in the short-mobile activity dialog                          | Every manual activity / medium–high / medium                             | S–M / medium                   | ActivityEditorDialog, AddActivityDialog                                             | Review initial disclosure behavior           | At 390×667 Search location is discoverable without scrolling through an empty upload pane; upload entry remains clear; existing photo-first, dirty, upload and nested-editor safeguards pass.                                     |
| 05 / P1         | CRAFT-11: Remove nonfunctional link styling                                            | Desktop guides / modest / low                                            | S / low                        | DestinationPage                                                                     | None                                         | Informational tags have no misleading underline; all remaining link-styled tags have a real keyboard-operable action.                                                                                                             |
| 06 / P1         | CRAFT-12: Trace and correct malformed persisted tag                                    | Affected live content / modest / medium                                  | M / data risk                  | destination repository, tag catalog, controlled data workflow                       | Confirm provenance/authorization             | API and UI return Café Hopping; existing Board/tag relationships survive; no frontend guess-decoding or rerun of applied migrations.                                                                                              |
| 01 / P2         | I-03: Shared editorial selection underline                                             | Continue and suitable single-select groups / medium / high               | S–M / low–medium               | BoardSelectionExperience, selected filter/tab groups                                | Stable layout and semantics                  | Indicator follows the selected label in roughly 160–200ms; content/state change immediately; independent groups never share the same indicator identity; reduced motion is immediate.                                             |
| 02 / P2         | I-05: Local activity placement acknowledgment                                          | Repeated editing / medium / medium                                       | S–M / low–medium               | DayPlanner, PlannerDayColumn, ActivityEditorDialog                                  | Reorder correctness retained                 | Added/moved card is focused and gently emphasized once; live announcement names the result; no full-plan movement, time mutation, or repetitive toast.                                                                            |
| 03 / P2         | I-02/06: Refine confirmed bookmark and photo handovers                                 | Save/cover actions / medium / high                                       | M / medium                     | PhotoBoardCard, board-save-store, PublishedBoard, BoardCoverDialog, preview adapter | Controlled write/upload acceptance           | Press, busy, confirmed success and failure stay distinguishable; fixed slots/masks; no filled bookmark/checkmark before confirmation; failed writes keep prior membership.                                                        |
| 01 / P3         | Exact image-failure fan reproduction                                                   | Important reported reliability issue; fix value unknown until reproduced | Unknown / potential high reuse | L investigation / low if read-only                                                  | LibraryImage, card parts, affected fan/store | Original reference or safe existing fixture that reaches same parent                                                                                                                                                              | Loaded/missing/failed/delayed covers have recorded stage/card/selection/scroll invariants; only a reproduced cause authorizes a geometry fix. |
| 02 / P3         | I-10: Inner-image directional response                                                 | Optional photography detail / modest / low–medium                        | M / medium                     | One stationary editorial or library placement                                       | CRAFT-03/08; transform ownership             | Pointer response stays inside a fixed card, ≤2–4px initially; no touch/keyboard dependency, no parent transform conflict, no reduced-motion movement; keep only after side-by-side product review.                                |
| 03 / P3         | V-04/07: Long-title editing and chapter orientation refinements                        | Useful but less certain / medium / medium                                | M / medium                     | BoardCoverHero/creator title control, DestinationRail                               | Layout fixes and design review               | Full title can be edited comfortably without destabilizing chapters; horizontal navigation is understandable without adding visual clutter.                                                                                       |

P0 is for defects, not permission to redesign. Within each group, review a concrete result against the same evidence
sizes. Preserve current working code until the proposed behavior is agreed. Do not spend tomorrow implementing every
P2/P3 row merely because a technique is available.

## H. Tomorrow's implementation plan

### Batch 1 — Fix the imperfections

Make this a set of small review units, not one giant CSS cleanup:

1. **Route correctness:** Normalize the destination href boundary and add focused independent behavior coverage for
   Unicode, retry and cancellation. Files: destination route, destination-guides/loading, transition provider. Verify
   San Sebastián from Home and direct entry, then the existing fast/slow/failure/unknown fixture cases. Risk: accidentally
   weakening namesake validation or matching the wrong request after cancellation.
2. **Destination width/height/input:** Repair the title safe box, minimum introduction space, and inner scroll policy.
   Files: DestinationPage, DestinationRail, DestinationStories/Places if stage sizing needs it. Review 320×568,
   390×667, 768×1024, 1280×600, 1440×900 and wide desktop in both themes. Risk: losing the photographic circle,
   creating a scroll trap, changing Mapbox gestures, or hiding controls to satisfy a viewport-fit target.
3. **Gallery text integrity:** Adjust the destination fan first; then explicitly adapt SpatialGallery and Continue.
   Keep V4's default card and watermark composition. Files: fan parents, a narrowly scoped optional V4 presentation.
   Verify short/long/unbroken titles, active/inactive states, fast next/previous, Home/End, drag versus click, image
   failure, and resize during movement. Risk: making background titles too faint/small, changing selected-card scale,
   conflicting transforms, or exposing inactive controls in the tab order.
4. **Editorial and profile sizing:** Fix tablet grid constraints and profile font branches/handle wrapping. Files:
   DiscoverContent/layout data, ProfileHero, HandleProfileContent. Verify exact problematic content plus boundary
   lengths and expanded sidebar. Risk: flattening the distinctive desktop bento or letting new wrapping push actions
   out of their intended region. Use existing fixtures/public reads; do not edit real profiles to generate long names.
5. **Readable/truthful controls:** Correct sampled essential light text, no-op arrow/search availability, and static
   underlined metadata. Files: sampled token usages, DayPlanner, DestinationExplorer, DestinationPage. Verify normal,
   disabled, pending, empty, failure and keyboard states. Risk: a global palette change darkening decorative work.
   Treat malformed persisted tags as a separately reviewed data correction, not an incidental UI patch.

These belong together because each repairs the contract between content, available space, and input. They should be
reviewable independently. Do not begin by extracting a new global type-fitting, button, gallery, or state framework.

### Batch 2 — Refine the interactions

After Batch 1 layouts settle, take only the highest-value shared moments:

- Standardize ordinary press/focus/disabled feedback and menu origin using CSS plus the installed Radix wrapper.
- Reduce the ready-destination presentation hold and reconsider the Create circle's excessive departure scale.
- Rebalance the activity dialog's initial empty-photo state on short mobile after reviewing the photo-first trade-off.
- Preserve and refine tag focus, local add/move announcements, and save/error clarity; do not replace useful inline
  feedback with success toasts.

Likely files: DayPlanner and gallery controls, dropdown-menu, destination-loading/DestinationLoading,
BoardCreationChoices.module.css, ActivityEditorDialog, BoardTagPicker. Verify press/release/cancel, held keyboard input,
Space/Enter, focus visibility, rapid open/dismiss, reduced motion, layout stability and error recovery. Save/upload
changes require a controlled disposable test context and independent verification before claiming persistence.

Risk: a press effect on a full gallery card can compete with placement/tilt/drag; an exit transition can restore focus
too early; a prettier pending state can accidentally imply success; reduced timing can reveal an unready page. Treat
behavior as the acceptance criterion and motion as its supporting presentation.

### Batch 3 — Add distinctive finishing touches

Choose at most two candidates initially: the editorial selection underline and activity placement acknowledgment.
Both communicate state the user just changed. Use existing Motion, scoped identity, small distance, and near-zero
overshoot. Review them inside the actual Continue/editor surfaces, not a new Experience Lab or prototype page.

Likely files: BoardSelectionExperience and selected tab groups, DayPlanner/PlannerDayColumn. Verify result changes are
immediate, focus is retained, labels do not reflow, repeated actions do not queue, and reduced motion stays clear.
Risk: introducing unnecessary shared-layout measurement or turning every local edit into animation. Reject the effect
if it makes repeated editing slower or visually noisier. Only then consider a stationary card's inner-image response.

### Verification and handoff

For implementation, follow repository instructions: root formatting and lint, relevant frontend tests/TypeScript and
build requirements, desktop/mobile/theme acceptance, and independent test-intent review. Use the existing visual
fixtures; extend a fixture only when an actual case is missing. Do not create another Experience Lab.

This audit changes documentation and evidence only. Application tests/builds are not required for that change under
frontend AGENTS.md. Formatting, lint and documentation-link/file checks are recorded in the delivery validation below.

### Evidence index

All screenshots are local audit captures. They show development UI; sample labels and browser development indicators
are intentionally retained as context. Native browser screenshots are JPEG. No supplied production screenshot was
available for a pixel-by-pixel comparison.

| Capture                                                         | Context                                                          |
| --------------------------------------------------------------- | ---------------------------------------------------------------- |
| [01](ux-craft-evidence/01-stockholm-desktop.jpg)                | Initial dark desktop Stockholm; title wrap and malformed tag     |
| [02](ux-craft-evidence/02-stockholm-gallery.jpg)                | Live dark destination fan; background-title clipping             |
| [03](ux-craft-evidence/03-stockholm-mobile.jpg)                 | Dark 390×844 Stockholm                                           |
| [04](ux-craft-evidence/04-stockholm-short-height.jpg)           | Dark 1280×600 Stockholm                                          |
| [05](ux-craft-evidence/05-profile-mobile.jpg)                   | Light owner-profile empty-photo composition; supporting coverage |
| [06](ux-craft-evidence/06-creator-long-title-preview.jpg)       | Light unsaved creator's long-title V4 preview                    |
| [07](ux-craft-evidence/07-v4-failed-image.jpg)                  | Labelled V4 400px failed-image fixture                           |
| [08](ux-craft-evidence/08-v4-long-title-240.jpg)                | Labelled 240px long-title/author study, forced reduced motion    |
| [09](ux-craft-evidence/09-continue-stack.jpg)                   | Labelled populated Continue presentation                         |
| [10](ux-craft-evidence/10-profile-name-sizing.jpg)              | Light live profile at 390×844; handle/name defects               |
| [11](ux-craft-evidence/11-accented-route-timeout.jpg)           | San Sebastián transition deadline                                |
| [12](ux-craft-evidence/12-san-sebastian-direct.jpg)             | Same San Sebastián guide after direct reload                     |
| [13](ux-craft-evidence/13-stockholm-short-mobile.jpg)           | Light 390×667 information panel                                  |
| [14](ux-craft-evidence/14-stockholm-description-lost-320.jpg)   | Light 320×568; paragraph collapses                               |
| [15](ux-craft-evidence/15-short-gallery-controls.jpg)           | Light 320×568; controls below chapter viewport                   |
| [16](ux-craft-evidence/16-discover-tablet-bento.jpg)            | Light 768×1024 bento                                             |
| [17](ux-craft-evidence/17-discover-tablet-country-clipping.jpg) | Light tablet Indonesia and search guidance                       |
| [18](ux-craft-evidence/18-creator-dark-fallback.jpg)            | Dark tablet creator-preview failed-cover fixture                 |

### Delivery validation

Root format and format:check passed. Root lint passed for both frontend and backend with zero warnings. The initial
lint launcher failed because the shell did not expose a pnpm command; the same root script then passed using a temporary
shim under /private/tmp, the installed Node 24, and cached pnpm 12.5.1. No package was installed and no repository
configuration was changed. Local link checks found no missing targets or undefined references; all 18 JPEG captures
have valid image dimensions. Application tests and builds were not run for this documentation-only change.

The final working-tree review showed only this report and its evidence directory as additions, with no tracked
application changes. No commit, push, PR, branch change, account write, or backend-contract change was performed.
Audit-local editor content was discarded, and the original dark theme and browser viewport were restored.

## I. Top ten recommendations

1. **Fix the double-encoded readiness URL.** A valid accented destination must not fail behind a decorative overlay.
2. **Size destination names against their real safe text box.** Eliminate Stockholm's lone M while retaining scale.
3. **Guarantee readable content at short heights.** A four-pixel introduction is content loss, not responsive design.
4. **Let overflowing chapters consume their own scroll input.** Users must reach gallery controls before leaving them.
5. **Design the exposed typography of background cards.** Preserve the fan's visual richness without half-word edges.
6. **Give tablet editorial cards enough width for their content.** Protect Indonesia and the smallest bento copy while
   keeping the wide-screen composition.
7. **Repair profile identity typography together.** Use real font-size values and deliberate handle wrapping.
8. **Make light-theme functional text readable.** Fix small guidance and labels selectively; keep architectural lines quiet.
9. **Make ordinary controls truthful and tactile.** Correct no-op boundaries first, then add a tiny, immediate press
   response and precise menu/focus behavior.
10. **Subtract unnecessary waiting before adding signature motion.** Shorten the ready-destination hold and restrain
    Create departure growth; then evaluate one selection underline and one activity acknowledgment.

[destination-route]: ../frontend/src/app/discover/destinations/[slug]/page.tsx
[destination-guides]: ../frontend/src/lib/destination-guides.ts
[loading-store]: ../frontend/src/lib/destination-loading.ts
[transition-provider]: ../frontend/src/components/features/destinations/DestinationTransitionProvider.tsx
[destination-page]: ../frontend/src/components/features/destinations/DestinationPage.tsx
[destination-stories]: ../frontend/src/components/features/destinations/DestinationStories.tsx
[destination-rail]: ../frontend/src/components/features/destinations/DestinationRail.tsx
[spatial-gallery]: ../frontend/src/components/features/boards/SpatialGallery.tsx
[selection-gallery]: ../frontend/src/components/features/boards/BoardSelectionGallery.tsx
[photo-card]: ../frontend/src/components/features/boards/cards/PhotoBoardCard.tsx
[card-parts]: ../frontend/src/components/features/boards/cards/BoardCardParts.tsx
[library-image]: ../frontend/src/components/images/LibraryImage.tsx
[handle-profile]: ../frontend/src/components/features/profile/HandleProfileContent.tsx
[profile-hero]: ../frontend/src/components/features/profile/ProfileHero.tsx
[globals]: ../frontend/src/app/globals.css
[discover-content]: ../frontend/src/components/features/discover/DiscoverContent.tsx
[discover-search]: ../frontend/src/components/features/discover/DiscoverSearch.tsx
[day-planner]: ../frontend/src/components/features/boards/DayPlanner.tsx
[board-library]: ../frontend/src/components/features/boards/BoardLibrary.tsx
[destination-explorer]: ../frontend/src/components/features/destinations/DestinationExplorer.tsx
[search-store]: ../frontend/src/lib/destination-search-store.ts
[destination-repository]: ../backend/src/features/destinations/destination.repository.ts
[tag-catalog]: ../shared/roamboard-tags.json
[contrast]: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
