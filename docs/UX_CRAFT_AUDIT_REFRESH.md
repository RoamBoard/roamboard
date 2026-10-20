# Roamboard — Craft Audit 2.0

Reassessment: **20 October 2026, Europe/Stockholm**. Research only; no proposed fix in this document has been implemented.

Baseline: `ui-ux-craft-improvements`, **ed11e29299e934777eec8fe4ec275ff1fa03a773**. A successful fetch of `origin/main`
confirmed the same revision. The working tree was initially clean. No branch switch, pull, merge, rebase, reset, commit,
push or PR operation was performed. The [original audit](UX_CRAFT_AUDIT.md) and its 18 evidence files remain unchanged.

## A. What changed since the original audit

The product is materially more capable than the version audited at `89f7315`. The largest improvement is the replacement
of the old owner-centric Boards page with real community discovery. The most valuable next work is to make that new
experience dependable while repairing the destination composition defects that remain conspicuous.

The photographic frames, architectural imagery, expressive headings, overlapping galleries and quiet editorial rules
still belong together. The new account actions fit that language. They need reliable state and available space more than
another layer of motion. Do not restore the older gallery files to implement this report.

### Relevant merged work

| Merge           | Relevant current behavior                                                                                                                                               | Consequence for this audit                                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| #108, `1461c6a` | Issue #90 collection reuse, profile/Vibes libraries, saved-list opt-in and Continue control refinement                                                                  | Already integrated. Do not reapply the old branch or repeat this migration.                                                                         |
| #107, `17b225f` | Published Board comments, revisions, deletion, subscriptions and comment notifications                                                                                  | New social surfaces need review; writes and destructive controls were not exercised.                                                                |
| #112, `0a0cf4b` | Saved-Board Remix, independent preparation, richer gallery actions                                                                                                      | The original recommendation that Remix needs an unavailable-state cue is obsolete. Preparation and persistence are separate from this visual audit. |
| #113, `ae94c33` | Removes redundant small page-header labels                                                                                                                              | Preserve the simpler hierarchy; do not reintroduce PROFILE/ACCOUNT eyebrows to match old screenshots.                                               |
| #117, `d4aabb3` | Roam architectural ambience remains active without field focus                                                                                                          | Old advice to protect only the focused search composition is incomplete. Keep current admission, query, reduced-motion and protected-space rules.   |
| #121, `a7cb32a` | Owner unset location shows a dash; visitors omit absent location                                                                                                        | Preserve this distinction. It does not repair profile heading overflow or the missing font-size rules.                                              |
| #124, `43a13eb` | Shared card tilt; unified metadata/action disclosure; real bookmarks; drag following/suppression; larger library cards; centered arrows and interactive range scrollbar | These supersede several old interaction proposals. Preserve their behavior and improve only demonstrated gaps.                                      |
| #125, `77e89ca` | Username mentions, keyboard suggestions and ten-distinct-handle limit                                                                                                   | Adds a useful composer interaction. Keep validation and cursor restoration.                                                                         |
| #127, `2abe0df` | Removes ghost profile/mock-auth remnants on logout                                                                                                                      | Preserve identity clearing. Do not solve the new search reset by allowing protected account collections to survive account changes.                 |
| #131, `5e85622` | New `/boards`: suggestions, location interpretation, URL-backed search, Featured periods, Recently Published, My Boards and Saved Boards                                | This is the primary new audit area. Old MyBoardsExperience/Archive advice no longer describes the route.                                            |
| #132, `ed11e29` | Original audit and screenshots merged                                                                                                                                   | Historical evidence, not proof that the findings were repaired.                                                                                     |

The merge subjects and diffs were read locally. These are revision-based findings, not an assumption that every change
after midnight was made after every interaction in the previous audit.

### Current architecture that must survive implementation

- `/boards` renders [BoardsDiscovery](../frontend/src/components/features/boards/BoardsDiscovery.tsx), using
  [boards-discovery.ts](../frontend/src/lib/boards-discovery.ts) and the agreed
  [discovery contract](../contracts/boards-discovery.md). Preserve independent requests, viewer-specific authorization,
  stale-response rejection, real summaries, numbered search URLs and confirmed-unsave/page-one refresh behavior.
- Featured uses SpatialGallery; Recently Published uses BoardSelectionGallery with batch-summary previews. Only a
  maximum of five deck cards are mounted, but all loaded records remain selectable. End reached **20 / 20** in the live
  recent feed. Replacing it with the old collection grid would undo teammate work.
- BoardLibrary now uses AccountPhotoBoardCard, shared BoardCardTilt and BoardDragContext. Its native range input scrolls
  continuously through the isolated Embla 8.6 adapter. Keep keyboard range operation, native disabled boundaries,
  horizontal-wheel ownership, map highlighting and progressive loading.
- DestinationStoryCard now resolves the selected canonical document for ownership, saved membership and metadata.
  Old statements that the destination gallery must never show saving or request a canonical Board are superseded.
  Preserve the current selected-card read, summary fallback, permission checks and retry. Do not fetch every card merely
  to fit typography.
- Continue published backgrounds open View; Edit remains a separate permission-gated action. Drafts retain editor
  navigation. Remix plus, View and bookmark actions are independent. Inactive cards select first. Gallery parents own
  selection/drag transforms; the shared tilt presenter owns its inner transform. Do not add the retired TactileBoard wrapper.

### Browser coverage and confidence

The user-launched frontend on `localhost:3000` and backend on `localhost:3001` were used with the existing signed-in
session. The supplied database tunnel was not queried directly. Successful public/account reads showed that the API
was available; no sample data was substituted for an API failure.

| Surface                       | Current checks                                                                                                                                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Roam/destinations             | Live zero-result submission; San Sebastián selection through its full timeout and direct entry; Stockholm introduction, tags, fan and short-height wheel behavior.                                                                                     |
| New Boards                    | Desktop dark entry; light tablet suggestions/preview; Stockholm full results and location removal; 12-result Demo query; mobile empty personal sections; rapid period switching; wide recent feed End selection.                                       |
| Profiles/Discover/editor      | Live Adam profile typography; tablet Discover labels and light guidance; a fresh unsaved one-day editor's actual scroll dimensions and arrow click. No editor content was saved.                                                                       |
| Comments/notifications        | Real Board 5's empty discussion and local composer; mention lookup, ArrowDown/Enter, cursor-preserving insertion and ten-handle validation; mobile mention layout; notification panel opening/Escape. No comment or notification action was submitted. |
| Existing development fixtures | V4 loaded/failed photo geometry, 240px long title/author, forced reduced motion, simulated pending save; Continue rapid arrows/Home, resize during rearrangement and denied access; saved-library range End and three-to-one-card boundaries.          |
| Responsive/theme              | 320×568, 390×667, 390×844, 768×1024, 1440×900, 1470×836 default and 1920×1080. Both themes across the relevant surfaces; sidebar expansion/collapse and resize were exercised. This is not every route at every size/theme.                            |

The account had no owned or saved Boards in the inspected new personal feeds; Remix also returned its genuine empty
state. Populated personal libraries and denied/loading combinations therefore used explicitly labelled existing
fixtures. Live titles containing “Demo” are persisted records returned by the API, not frontend fixtures.

No save/unsave, comment post/edit/delete, friendship action, notification read/subscription change, upload, or remix
preparation was initiated. Local comment drafts were cleared. Published viewers retain their automatic view-tracking
behavior; normal viewing may qualify analytics activity. Do not interpret this as a claim of zero HTTP writes.

Physical touch, an on-screen mobile keyboard, full screen-reader use, OS-wide reduced motion, artificial image/network
throttling, backend outages, account switching/logout, multi-page search and persisted remix/save/comment behavior were
not verified here. The Demo query had 12 results, so no numbered second page was available. Existing source/tests cover
more states; reading them is not browser evidence of those states. A transient animation capture is not a settled-layout
finding. New captures live separately in [ux-craft-refresh-evidence](ux-craft-refresh-evidence/).

## B. Status of all 13 original defects

**All thirteen remain reproducible in the checked conditions.** None can be marked Fixed merely because the surrounding
component changed. CRAFT-03 needs a substantially updated implementation approach. The image-recentering report remains
separate and unverified.

| ID / current status                                | Fresh evidence and current relevance                                                                                                                                                                                                                                                                                                  | Current recommendation and precautions                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CRAFT-01 — Still present**                       | From Roam, choose San Sebastián, press Enter and wait through the 25-second deadline. The URL changes to the valid guide, but the overlay reports failure. Direct entry loaded its actual guide. [Current timeout](ux-craft-refresh-evidence/03-accented-timeout.jpg). The route still encodes `slug` at line 29.                     | Keep the original exactly-once URL identity fix. Use the current route/search/loading helpers; preserve namesake, provider and coordinate validation. A route readiness mismatch must not be treated as a provider outage or solved by removing the timeout/readiness gate. Test accents, non-Latin paths, reserved characters, selectors and retry.                                                             |
| **CRAFT-02 — Still present**                       | Stockholm still paints STOCKHOL / M. At default desktop its heading box was 359px wide, 128px high, with 71.0938px text. It also broke at 320×568. [Desktop](ux-craft-refresh-evidence/04-stockholm-desktop.jpg), [mobile](ux-craft-refresh-evidence/05-stockholm-short-mobile.jpg).                                                  | Size against the actual cutout text box in DestinationPage, not total hero cqw or character count alone. Preserve the curved photograph and expressive scale. CSS constraints first; measured fitting only if the final font/glyph widths require it. Multiword and handle wrapping need separate policies.                                                                                                      |
| **CRAFT-03 — Still present; architecture updated** | The current Stockholm fan still cuts through background title starts at the stage edge. [Current fan](ux-craft-refresh-evidence/07-stockholm-gallery-desktop.jpg) shows fragments despite selected-title ellipsis. Continue's current deck also overlaps title regions; its geometry differs.                                         | Adapt the exposed-title composition to the current drag interpolation, action-aware V4 and shared tilt. Work first in DestinationStories; reserve a readable exposed title area or apply a scoped background presentation. Do not globally shrink V4, hide all secondary titles, restore old fan transforms, or remove account controls. Selected two-line ellipsis and decorative SWE cropping are intentional. |
| **CRAFT-04 — Still present**                       | At 320×568 the live Stockholm introductory paragraph measured **4.265625px** tall with **230px** scrollHeight. [Current short-mobile intro](ux-craft-refresh-evidence/05-stockholm-short-mobile.jpg).                                                                                                                                 | Give prose a minimum readable excerpt budget in DestinationPage. Compact/disclose secondary getting-around content before squeezing the introduction. Retain attribution. If content needs vertical scrolling, coordinate with CRAFT-05; a min-height alone can push essential controls further offscreen.                                                                                                       |
| **CRAFT-05 — Still present**                       | At 320×568 the Boards chapter measured 568px high with 770px scrollHeight; Previous/Next were around y=690. A downward wheel gesture moved to the closing chapter while inner scrollTop stayed 0. After settlement, Boards left=-192 and Create left=64. [Current chapter](ux-craft-refresh-evidence/06-stockholm-short-gallery.jpg). | Resolve vertical scroll ownership in DestinationRail before converting the event to chapter navigation. Keep Mapbox/cooperative gestures, horizontal card dragging and keyboard selection. Current arrows replaced the old footer Open Board link, so acceptance must target the new controls and selected-card actions.                                                                                         |
| **CRAFT-06 — Still present**                       | At 390×844, @adam_da_goatd still has a 294px heading box, 406px scrollWidth and 48px text. Removing the old PROFILE eyebrow did not repair its clipped identity. [Current profile](ux-craft-refresh-evidence/08-profile-mobile.jpg).                                                                                                  | Keep the simpler header. Apply a bounded identity-heading size and deliberate separator-aware wrapping in HandleProfileContent. Preserve the entire accessible handle and profile URL; do not reuse destination single-word fitting blindly.                                                                                                                                                                     |
| **CRAFT-07 — Still present**                       | Adam Trossing still receives `text-38` and computes to **16px** on mobile. The new location omission rules are independent. [Same profile capture](ux-craft-refresh-evidence/08-profile-mobile.jpg).                                                                                                                                  | Repair all getNameStyle branches in ProfileHero using real scale values or explicit sizes. Review 10/11, 16/17 and 24/25 boundaries and wide glyphs. Preserve owner unset-location dash and visitor omission. No profile data editing is needed.                                                                                                                                                                 |
| **CRAFT-08 — Still present**                       | At 768×1024, Indonesia's card measured 94.664px; its title had 109px scrollWidth against 95px clientWidth. The bento remains excessively narrow for its supporting copy. [Current tablet](ux-craft-refresh-evidence/09-discover-tablet-light.jpg).                                                                                    | Introduce a container-aware intermediate layout in DiscoverContent. Preserve asymmetric desktop spans. Verify the narrowest tile with both sidebar states rather than treating the viewport md breakpoint as sufficient available width.                                                                                                                                                                         |
| **CRAFT-09 — Still present**                       | Light Discover guidance still computes to rgb(129,129,129), 12px, against white: **3.896:1**. [Current guidance](ux-craft-refresh-evidence/09-discover-tablet-light.jpg). New Boards supporting text also uses muted roles, so the inventory must include newer surfaces.                                                             | Retain the original selective functional-text correction and 4.5:1 criterion. Review actual backgrounds and alpha composition; do not globally darken architectural rules, watermarks or every quiet label. A new global token needs a usage review first.                                                                                                                                                       |
| **CRAFT-10 — Still present**                       | Fresh editor at 1440×900: day strip clientWidth=scrollWidth=1264, scrollLeft=0. Both arrows enabled; Next produced no movement. [Current editor](ux-craft-refresh-evidence/10-editor-noop-arrows.jpg).                                                                                                                                | Derive actual start/end availability after scroll, resize and day changes. Reuse the behavior principle of the now-improved BoardLibrary, not its Embla machinery. Keep ordinary vertical page scrolling and editor keyboard/touch ordering.                                                                                                                                                                     |
| **CRAFT-11 — Still present**                       | Current destination tags are still underlined LI elements, with no actionable descendants. Fresh DOM inspection confirmed element type and textDecorationLine. [Desktop introduction](ux-craft-refresh-evidence/04-stockholm-desktop.jpg).                                                                                            | Remove the informational list's link styling locally. Do not invent tag routes or alter the newer actionable profile/Discover tag links.                                                                                                                                                                                                                                                                         |
| **CRAFT-12 — Still present**                       | CafÃ© Hopping remains visible in Stockholm tags and now in real Board search preview metadata too. [Current tags](ux-craft-refresh-evidence/04-stockholm-desktop.jpg), [preview](ux-craft-refresh-evidence/11-boards-tablet-search-preview.jpg).                                                                                      | Keep a separately reviewed upstream-data investigation. New discovery reuse spreads the symptom; it does not justify browser-side encoding guesses. Inspect affected persisted references/import history, then propose a controlled correction. No migration replay or data update during this audit. The corruption's original provenance remains unverified.                                                   |
| **CRAFT-13 — Still present**                       | Search `zzzzzzzznotadestination`, wait for zero results: Explore becomes enabled; clicking leaves the same empty state. [Current Roam empty state](ux-craft-refresh-evidence/02-roam-empty.jpg). Ambient-background changes did not change submission availability.                                                                   | Tie availability to a real selectable destination, retaining short-query validation and failure retry. Ordinary disabled behavior is preferable to adding press animation to a no-op.                                                                                                                                                                                                                            |

### Image-failure recentering: still unverified

The current V4 fixture was switched from loaded Porto imagery to its deliberate failed URL. Its article stayed exactly
**400×500 at x=990, y=-4** before and after. The fixed photographic frame and architectural fallback remain useful.
[Current failure fixture](ux-craft-refresh-evidence/15-v4-failed-image.jpg).

The newer list placements suppress standalone cover credits specifically to stabilize compositions. This removes one
old hypothesis in those placements; it does not prove that the original reported failure was caused or fixed by credits.
The current selected destination card can also enrich its data through DestinationStoryCard. Capture its summary/document
transition separately from image loading in any future reproduction.

Do not add recentering effects, image-load timers or guessed dimensions. First reproduce an exact fan/asset/state with
stage bounds, card bounds, selection ID, scroll offsets and enrichment state recorded. Standalone fixture stability does
not prove every fan's missing-key, slow-decode and failed-provider behavior.

## C. Newly discovered defects

### REFRESH-01 — Account initialization erases an in-progress Board search

**High severity; verified live; high confidence.** New `/boards`, BoardsDiscovery and BoardSearch.

Reproduce on an already signed-in browser: reload `/boards`, type Stockholm while the page is still resolving the
account, then wait for My Boards/Saved Boards to appear. This was encountered repeatedly and deliberately reproduced.
The input initially contained Stockholm and showed Searching Boards. After account resolution it was empty; focus was
BODY. [Before](ux-craft-refresh-evidence/13-search-during-account-load.jpg),
[after](ux-craft-refresh-evidence/14-search-reset-after-account-load.jpg).

The input invites work before account initialization finishes, then destroys that work. It feels less dependable than
the underlying search actually is. The expected result is to keep the draft query, selection/focus and relevant open
state across initial identification, while refreshing viewer-specific results and protected collections correctly.

The cause is explicit in [BoardsDiscovery.tsx](../frontend/src/components/features/boards/BoardsDiscovery.tsx), lines
55–65: the content key includes `account.user?.userId ?? "visitor"`. Resolving the account changes the key and remounts
the content, including BoardSearch's local query initialized from the URL. An unsubmitted query is absent from that URL.

**Strategy:** Separate durable search interaction state from the keyed account-data lifetime. Hoist/preserve the draft
query and focus-bearing input; keep explicit identity invalidation for protected feeds and membership state. Do not
simply remove every account key or retain protected results across logout. Distinguish initial identification from a
real account switch. Test both with the actual auth observer wiring, plus slow account resolution and a submitted URL.
Small-to-medium work, high benefit. This belongs in the first implementation session.

### REFRESH-02 — “Remove location filter” leaves submitted results filtered

**Medium severity; verified state mismatch; high confidence.** New full Board search and its location indicator.

Submit Stockholm to get `/boards?q=Stockholm&page=1`. Activate Remove location filter: Stockholm, then dismiss the
suggestion panel. The indicator disappears, but the URL remains without `location=off`, and the result section still
shows the previous submitted results. Refresh therefore reinstates the interpretation. [Current mismatch](ux-craft-refresh-evidence/12-search-location-state.jpg).

The current handler only sets local `locationMode`, resets suggestion selection and opens suggestions. SearchResults
still receives `location` from the route. It eventually works if the user submits again, but the removal control does
not communicate that extra step. The screenshot alone cannot show a hypothetical difference in matching records; the
URL and separate request ownership establish that the displayed query was not reapplied.

**Strategy:** For the currently submitted query, removal should replace/push the agreed URL with `location=off`, reset
to page one, and fetch the corresponding full results. Preserve that override on refresh and Back. If the input has
already diverged into a draft query, explicitly distinguish pending criteria from applied results instead of implying
the old results changed. Keep suggestion stale-response guards and the existing server ranking/access contract.
Relevant files: BoardsDiscovery.tsx and boards-discovery.ts; no endpoint or ranking changes required. Medium work/risk,
worth doing before refining the chip's motion.

### REFRESH-03 — Empty personal feeds display duplicated, misleading browsing states

**Low functional / medium visual severity; verified live; high confidence.** New My Boards and Saved Boards sections.

With the account's actual zero-item lists, each section renders a heading/description, “No … Boards match your search,”
“0 Boards · drag, swipe or scroll to explore,” and a second “No Boards here yet.” There is no personal search active.
On mobile these messages and their independent padding occupy a large amount of empty page.
[Current mobile composition](ux-craft-refresh-evidence/16-boards-empty-personal.jpg).

The issue is composition ownership, not the decision to show real emptiness. DiscoveryCollectionContent renders an
empty BoardLibrary and then Feedback, so both supply empty output; the default library also supplies generic drag copy.
See BoardsDiscovery.tsx around 414–475 and BoardLibrary.tsx around 284–287 and its final status paragraph.

**Strategy:** Let the feed choose one loading/error/empty presentation and reserve the library for the appropriate
browsing state, or expose narrowly scoped library feedback options. Use context-specific empty copy and omit drag
instructions with no items. Keep a stable, focusable section heading and a single useful status announcement, including
after the last confirmed unsave. Preserve page-one refresh, access loss and failure/retry semantics. Do not change
empty messages globally for libraries that really are filtered. Small work, good visual return.

### REFRESH-04 — Public galleries announce the wrong collection context

**Low severity; verified DOM/accessible names; high confidence in naming, no full screen-reader certification.**

On the new community `/boards`, the Featured carousel is named “Your Boards. Use left and right arrow keys to browse.”
Recently Published's inner carousel is named “Featured Boards.” Keyboard navigation works, but these names misidentify
the content and make moving between galleries harder to understand. Current source retains labels inherited from the
old owner/Continue placements.

**Strategy:** Supply collection context from the caller, using a stable heading reference or explicit contextual name
and separate instructions. Preserve carousel roles, focus behavior, Home/End/arrows, inactive-card tab exclusion and
live selection announcements. Change naming, not the interaction model. Files: SpatialGallery.tsx,
BoardSelectionGallery.tsx and BoardsDiscovery.tsx. Small work, low risk; acceptance should inspect the accessibility tree
and then include a real screen-reader pass.

## D. Newly discovered craftsmanship opportunities

These are specific proposals, not additional proven functional bugs. Timings are starting values for review. Fix state
loss, clipping and control availability before styling the affected interactions.

| ID / opportunity                                                     | Current observation and intended improvement                                                                                                                                                                                                                                                                                                                         | Implementation, value and risk                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R-01 — Make the search preview's association precise**             | At 768px, the selected suggestion's 160px card starts below that row and extends beside subsequent rows and beyond the suggestion panel. It has pointer-events:none, so it did not block those links, but its position visually associates one Board's metadata with other options. [Tablet preview](ux-craft-refresh-evidence/11-boards-tablet-search-preview.jpg). | In BoardSearch, use a reserved preview area or suppress the separate preview where the right-hand dock cannot fit; retain all essential row metadata. Prefer an inline/reserved layout over moving a floating card across options. Do not remove keyboard preview support or change touch direct navigation. Moderate visual gain, small/medium work. Check container width with expanded sidebar, long titles and four suggestions; not just viewport xl. |
| **R-02 — Truthful ordinary search contact feedback**                 | Roam's zero-result arrow is still a no-op; the new Boards Search control also accepts blank/one-character submission without visible validation because submit returns early. Frequently used plain controls otherwise have varied hover and little common press feedback.                                                                                           | First make availability/validation truthful. Then a small CSS press treatment, about 0.98 scale or a surface change, with immediate dispatch and roughly 80–120ms return, can apply to selected ordinary controls. Keep native disabled/focus behavior. Exclude gallery transform parents, inputs, text links and already expressive Create circles. Modest shared implementation, high frequency; no global all-button selector.                          |
| **R-03 — Finish the current bookmark, do not replace it**            | Main already has independent bookmarks, real membership, disabled unknown state, pending indication and confirmation-only fill. The V4 simulated pending state remained unfilled and disabled; public-profile unknown membership stayed unavailable.                                                                                                                 | Keep those semantics and stable slots. If additional contact feedback is wanted, use a tiny surface response before dispatch, retain pending/busy state, and fill only after confirmation. No optimistic count, toast celebration or outer-card bounce. Review focused removal and drag cancellation before shipping. Low/medium effort; correctness risk outweighs visual novelty.                                                                        |
| **R-04 — Give Featured period selection one clear indicator**        | Both This month and This week are underlined; selected state additionally relies on weight/color. Rapid switching resolved to the final selected month in the checked live state. Existing actions are already understandable.                                                                                                                                       | A scoped, thin shared underline could provide more precise movement, about 140–180ms with no overshoot; preserve pressed semantics, immediate request dispatch and reduced-motion instant change. Do not copy a rounded segmented pill or animate the whole feed out/in. P2, not a prerequisite for search/empty-state fixes.                                                                                                                              |
| **R-05 — Improve mention discovery without making typing noisy**     | Lookup, ArrowDown/Enter insertion and ten-handle validation worked. A mention menu sits above the textarea, including at 390×667. Loading and a successful no-match currently have no visible contextual hint; the ten-handle limit only appears after exceeding it.                                                                                                 | Consider a quiet contextual hint on first mention use and delayed lookup/no-match text only while the mention token is active. Use an appropriately restrained status announcement, not a live alert per keystroke. Preserve debounce, stale-result rejection, plain typing fallback, Escape, caret insertion and Unicode/comment limits. Small work, useful for a new feature; real AT/touch review needed.                                               |
| **R-06 — Make functional supporting text a reusable role**           | Old Discover guidance still fails the normal-text contrast threshold; new search rows, location indicators, personal descriptions and counters reuse small muted text. Dark mode is materially more legible.                                                                                                                                                         | Inventory essential helper/status text across new and old components, then apply a stronger existing semantic treatment or narrowly approved role. Verify 4.5:1 for normal text after opacity/background composition. Keep architectural line and watermark tokens independent. High reuse, moderate audit effort; avoid a palette-wide rewrite.                                                                                                           |
| **R-07 — Preserve stable photography and subtract redundant motion** | Failed V4 imagery kept its frame; lists now suppress credits that could affect geometry; tilt is shared and resets during drag. Adding parallax on top of the current tilt/drag stack would compete with existing work.                                                                                                                                              | Leave those successes alone. If photography movement is evaluated later, restrict it to an inner image layer in one stationary editorial placement. Start by shortening ready-destination waiting after CRAFT-01, rather than adding a new image effect. P3 for new photo motion; no package justified.                                                                                                                                                    |
| **R-08 — Polish end states as carefully as populated controls**      | The shared library correctly disabled arrows/range with one fixture card, but still said “drag, swipe or scroll to explore.” New empty sections exaggerate this mismatch. Notification Escape returned focus to its trigger and needs no replacement animation.                                                                                                      | Allow context-aware status text for zero/one/many items. Preserve the range and native boundaries. For disclosures, keep current focus lifecycle and origin; only correct a measured alignment/timing inconsistency later. Small shared refinement after REFRESH-03, with no API or save-store work.                                                                                                                                                       |

The original audit's external research remains useful: existing CSS for ordinary presses, existing Motion for a scoped
selection indicator, existing Radix for menus, and native/current dialogs for their established lifecycle. No new
technique here required another library survey or dependency. The public references were not freshly rebenchmarked;
this refresh relies on the original research and current local implementations. No additional external research was
needed to establish the defects above.

### Shared causes, kept narrow

1. **Data lifetime and interaction lifetime are coupled.** Account identity should invalidate protected data, not erase
   a draft query/focus. Applied query state should remain tied to its URL. Address those boundaries directly; do not
   introduce a global state framework.
2. **Generic presenters still carry old context.** Empty copy, drag instructions and carousel names need caller context.
   Add small explicit inputs or let the caller own feedback. Preserve real account-aware card presenters.
3. **The available box is still not the sizing authority.** Destination headings, profile identity and tablet bento all
   assume more width than they have. Use role-specific constraints, not one universal shrinking hook.
4. **Viewport fitting still competes with content and scroll ownership.** Repair the excerpt budget and rail input policy
   together. Current gallery controls and account actions make reachability more important, not less.
5. **Motion ownership is better now.** Shared tilt and drag suppression are teammate improvements to protect. New press
   and indicator effects should sit inside that ownership model and explicitly honor reduced motion.

## E. Updated ranked backlog

Within each priority, order favors user impact/frequency, visible improvement and reuse relative to effort/risk.
Difficulty/risk are relative, not time estimates. P0 follows the user's definition of functional or conspicuous visual
defects; it does not mean every item is a production outage. Source references below identify implementation boundaries.

| Rank / priority                   | Work and expected impact                                                        | Difficulty / regression risk                   | Files, dependencies                                                                                          | Measurable acceptance                                                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 / **P0**                        | CRAFT-01: release valid accented navigation; primary-flow blocker               | Medium / medium                                | Destination route, destination-guides.ts, destination-loading.ts; first                                      | San Sebastián and a non-Latin destination release a ready overlay; retry/cancel, invalid selection and genuine timeout still work.                           |
| 2 / **P0**                        | REFRESH-01: preserve typing/focus through initial identity; frequent state loss | Medium / high if account isolation is weakened | BoardsDiscovery.tsx, auth-observer integration tests; independent of destination work                        | Type before account resolution: query and focus survive. Real logout/account switch clears protected data and stale responses cannot restore it.             |
| 3 / **P0**                        | CRAFT-04: restore readable short-mobile introduction                            | Medium / medium                                | DestinationPage.tsx; pair review with CRAFT-05                                                               | At 320×568 show at least a deliberate multi-line excerpt; attribution/onward actions remain reachable; no four-pixel paragraph.                              |
| 4 / **P0**                        | CRAFT-05: make destination controls reachable by wheel/keyboard                 | Medium / high                                  | DestinationRail.tsx and DestinationStories.tsx; coordinate with excerpt budget                               | Inner content consumes input to its end before chapter advance; arrows and selected-card actions reachable; map and horizontal drag remain independent.      |
| 5 / **P0**                        | CRAFT-02: repair primary destination lettering                                  | Medium / medium                                | DestinationPage.tsx; test after excerpt/rail constraints                                                     | Stockholm stays deliberately composed at 320/390/768/1440 and expanded-sidebar widths; no isolated final character or photo overlap.                         |
| 6 / **P0**                        | CRAFT-06/07: recover profile identity hierarchy                                 | Small/medium / low                             | HandleProfileContent.tsx, ProfileHero.tsx; no dependency                                                     | Complete long handle; every name-size branch emits real CSS; Adam no longer computes to 16px; location rules unchanged.                                      |
| 7 / **P0**                        | CRAFT-08: protect tablet country names and copy                                 | Medium / medium                                | DiscoverContent.tsx; independent                                                                             | Indonesia fully identifiable; supporting copy has a deliberate measure at 768px with sidebar collapsed/expanded; desktop asymmetry retained.                 |
| 8 / **P0**                        | CRAFT-03: compose exposed gallery titles                                        | Medium / high                                  | DestinationStories.tsx, PhotoBoardCard props if necessary; then review SpatialGallery/deck separately        | Settled and interrupted selection shows word-bounded background titles without stage-edge amputations; drag, actions, tilt and frame geometry preserved.     |
| 9 / **P0**                        | CRAFT-09 / R-06: functional light-text contrast                                 | Small per call site / medium for token changes | globals.css usage inventory, DiscoverSearch and newer helper/status roles; no global blind change            | Sampled normal functional text reaches 4.5:1 in light/dark; decorative lines/watermarks retain hierarchy.                                                    |
| 10 / **P1**                       | REFRESH-02: make filter removal reflect applied results                         | Medium / medium                                | BoardsDiscovery.tsx, boards-discovery.ts; after search lifetime fix                                          | Submitted Stockholm removal produces page=1/location=off; results and indicator agree through reload/Back; draft edits remain distinguishable.               |
| 11 / **P1**                       | REFRESH-03 / R-08: one clear personal empty state                               | Small / low-medium                             | DiscoveryCollectionContent, BoardLibrary feedback/status; keep removal focus                                 | One empty announcement per feed; no false search/drag copy; last unsave lands focus on a stable heading; loading/error not shown as success-empty.           |
| 12 / **P1**                       | CRAFT-10/13 + R-02 availability: eliminate dead controls                        | Small / medium                                 | DayPlanner.tsx, DestinationExplorer.tsx, BoardSearch validation; independent                                 | Day boundaries update after resize/content; zero-result Explore unavailable; blank/short Board search gives truthful availability or validation.             |
| 13 / **P1**                       | REFRESH-04: contextual gallery names                                            | Small / low                                    | SpatialGallery, BoardSelectionGallery, BoardsDiscovery                                                       | Accessibility tree says Featured/Recently Published/Continue correctly; keyboard selection and announcements unchanged.                                      |
| 14 / **P1**                       | R-01: attach preview to its actual suggestion                                   | Small/medium / medium                          | BoardSearch preview layout; after state fixes                                                                | At tablet/narrow container, preview does not visually occupy other options; all four rows, keyboard selection and touch direct links remain usable.          |
| 15 / **P1**                       | CRAFT-11: remove false tag-link styling                                         | Small / low                                    | DestinationPage.tsx; independent                                                                             | Informational LI tags no longer appear underlined/actionable; actual tag links elsewhere retain semantics.                                                   |
| 16 / **P1**, separate data review | CRAFT-12: correct tag provenance and affected value                             | Investigation / medium-high data risk          | Active backend destination/tag sources and affected data references; requires a reviewed correction          | Trace affected records and duplicates; approved correction removes mojibake without guessing/rewriting arbitrary Unicode; no migration replay.               |
| 17 / **P1**                       | R-02/03: restrained ordinary press/contact feedback                             | Small / medium gesture risk                    | Selected existing controls, AccountPhotoBoardCard/PhotoBoardCard only where needed; after availability fixes | Immediate action dispatch; no movement of target/layout; pending stays unfilled, failure truthful; keyboard and reduced motion work.                         |
| 18 / **P1**                       | R-05: mention contextual feedback                                               | Small / medium announcement risk               | CommentMentionEditor.tsx, BoardComments.tsx; keep current validation                                         | Loading/no-match hints only during an active token; Escape, 10-handle limit, caret, text and keyboard insertion remain correct; no per-keystroke alert spam. |
| 19 / **P2**                       | R-04: one precise period underline                                              | Small / low-medium                             | Featured period controls; after REFRESH-01 and stable request states                                         | Indicator settles in about 140–180ms, follows final rapid selection, no feed entrance replay; instant reduced-motion equivalent.                             |
| 20 / **P2**                       | Ready-destination waiting reduction from original I-09                          | Small/medium / medium lifecycle risk           | destination-loading and transition provider; after CRAFT-01                                                  | Ready/cached routes reveal without the current unnecessary hold; cancellation, true wait/error and focus lifecycle unchanged.                                |
| 21 / **P3**                       | Exact image-recentering reproduction; optional photo motion                     | Investigation / uncertain                      | Affected real fan and asset, not a new route                                                                 | Establish a repeatable geometry delta over one CSS pixel before proposing a fix. New photo movement requires evidence of benefit and separate review.        |

## F. Implementation batches

Keep these independently reviewable. A batch is a focused change set, not a new page, experiment or blanket component
replacement. Each should carry its own appropriate automated and browser acceptance. Use the root formatter and lint;
follow frontend instructions for TypeScript, relevant tests and build checks when implementation begins.

| Batch                                                     | Exactly what belongs together                                                                                                                                       | Verify / what could go wrong                                                                                                                                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Destination URL identity**                           | CRAFT-01 only: route/search/readiness serialization and focused regressions. No choreography change.                                                                | Accents/scripts/reserved characters, clean selectors/namesakes, direct entry, cancellation and retry. A permissive string comparison could hide real route-identity errors.                             |
| **2. Board search lifetime and applied criteria**         | REFRESH-01 first, then REFRESH-02 in separately reviewable steps. Preserve the draft input outside account-keyed data; make applied location criteria URL-truthful. | Initial account load, real identity change, query/selection/focus, stale requests, reload/Back and page reset. Unkeying the whole tree could retain protected cards or membership from a previous user. |
| **3. Short destination composition and scroll ownership** | CRAFT-04/05: one readable excerpt budget, controlled secondary content, inner-scroll input policy, current gallery control reachability.                            | 320×568 and 390×667 first; mouse wheel, keyboard, sideways gestures and Mapbox. A prose min-height without scroll ownership can worsen clipping; an overbroad wheel exception can trap navigation.      |
| **4. Destination display type**                           | CRAFT-02 within the now-known safe box. Keep profile and Discover layout changes out of this batch.                                                                 | Final font load, sidebar resize, long single/multiword names, accents and scripts. Fitting based on the wrong container or initial font reproduces the bug differently.                                 |
| **5. Profile identity**                                   | CRAFT-06/07: heading overflow policy plus valid display-name sizes. Preserve current absent-location/header simplifications.                                        | Boundary-length names, long handles, both themes and phone/tablet. Do not alter account/profile fields or add data requests.                                                                            |
| **6. Tablet editorial constraints**                       | CRAFT-08 only: intermediate container-aware spans, title/copy fit, crops.                                                                                           | Tablet sidebar states and wide desktop asymmetry. Keep cards' actual destinations and sample labels; no content-source changes.                                                                         |
| **7. New Boards presenter integration**                   | REFRESH-03/04 and R-08: feedback ownership, contextual carousel names and count-aware instructions.                                                                 | Empty/loading/error/one/many, last confirmed unsave focus, recent End selection and library range boundaries. Removing an empty library must not remove the focus destination used by saving callbacks. |
| **8. Background title composition**                       | CRAFT-03 in the destination fan first; review deck/spatial adaptations as follow-ups.                                                                               | Word edges at rest, rapid select/drag/cancel, long titles, narrow/short heights, failed imagery and summary-to-document enrichment. Never replace shared drag/tilt/save behavior with old files.        |
| **9. Small everyday controls and legibility**             | Separate small reviews for contrast, truthful arrow/search availability, false tag underline, and then ordinary press feedback. R-01/R-05 can follow independently. | Contrast calculations, disabled boundaries after resize, keyboard/focus, pending/error semantics. Avoid one giant “polish” diff across unrelated components.                                            |
| **10. Optional finish**                                   | At most the period underline and shorter ready-route wait after earlier acceptance.                                                                                 | Reduced motion, final rapid selection and no new delay before action. Reject extra parallax/tilt unless one real placement demonstrably benefits.                                                       |

CRAFT-12 stays a separate, reviewed data task. It must not be slipped into a frontend visual batch or “fixed” through
display-time decoding.

## G. Recommended first implementation session

Start with **five changes**, in this order. If review capacity is limited, stop after the first two rather than widening
the scope into general animation work.

1. **Repair accented destination readiness.** Work in the destination route, destination-guides.ts and
   destination-loading.ts/transition provider only as required. Add regressions for exactly-once identity, then run
   San Sebastián from Roam through success, direct entry, cancel and retry. Preserve the real timeout. This restores a
   primary path before adjusting how it looks.
2. **Preserve Board search through account initialization.** Work in BoardsDiscovery.tsx and its actual auth/search
   integration tests. Reproduce typing before account resolution; ensure text and focus remain. Independently verify
   logout/account-switch isolation before accepting the change. Do not remove account invalidation for convenience.
3. **Give Stockholm's short-mobile introduction readable space.** Work in DestinationPage.tsx. Choose a small explicit
   excerpt budget and a restrained policy for secondary getting-around content. Verify actual text and attribution at
   320×568 and 390×667 in both themes, rather than only checking that a paragraph exists in the DOM.
4. **Allow inner destination scrolling before chapter advance.** Work in DestinationRail.tsx with the current
   DestinationStories controls. Verify the short chapter's bottom arrows and selected-card actions by wheel and
   keyboard, then map and horizontal-card gestures. Review this with change 3; neither is complete if content is visible
   but unreachable.
5. **Fit the destination heading to its real safe box.** Work in DestinationPage.tsx after its content constraints are
   stable. Keep the curved composition and intended scale; verify Stockholm, San Sebastián, longer multiword names and
   a non-Latin case at final font load and sidebar/container resize. Avoid a universal shrink-to-fit abstraction.

These changes concentrate on three narrow areas: route identity, new Board search state, and destination composition.
Profile typography, tablet Discover, new empty states and contextual labels are the next focused sessions. Background
title design needs a separate careful review because its parents now own substantially richer dragging and actions.

### Evidence and delivery checks

The 18 new JPEGs are in [ux-craft-refresh-evidence](ux-craft-refresh-evidence/); linked captures above distinguish live
data from fixture checks. The original 18 screenshots were inspected together, with individual full-size review of
the destination, fan, profile and tablet starting points. The refresh captures were also reviewed as a contact sheet.

This is a documentation/evidence change. Root formatting, formatting check and frontend/backend lint passed. All 28
local report links resolve, all 18 new JPEGs validate, and byte comparisons confirm the original report and its 18
images are unchanged. The working tree contains only this new report and its evidence directory; production source,
contracts, configuration and dependencies are unchanged. The installed Node 24 and cached pnpm were used without
installing packages. Application tests/build were not rerun for documentation or used as proof of visual findings.
Future implementation must run its own appropriate checks against the changed code.

Local comment drafts were cleared, the original dark theme and normal viewport restored, and temporary audit tabs
closed. The user's running services were left in place. No Git history or remote content was changed.
