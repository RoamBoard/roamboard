# Craft improvements — Implementation 02

Scope: CRAFT-04 and CRAFT-05 only. Read the original audit, refresh audit and Implementation 01 before changing
`DestinationPage`, `DestinationRail` and `DestinationPlaces`. The working tree was clean at the start.

## Readable short-mobile introduction

**Verified cause:** the hero reserves 38% of the screen. Below it, a fixed-height, overflow-hidden flex column let the
introductory paragraph shrink while travel advice, attribution and navigation competed for the same space. Before
the change, Chrome measured Stockholm's paragraph at **4.265625px high**, with 230px of text scroll height at 320×568.

The mobile composition now reserves four non-shrinking lines at **14px / 24px**, followed by the existing article and
license links. Secondary getting-around advice uses a closed native disclosure on phones; opening it reveals the full
tip and its attribution. The information panel scrolls vertically when needed, rather than compressing the prose.
At larger widths, the existing expanded travel advice and two-column composition remain. Body copy has a readable
14px floor at short desktop heights; ordinary desktop copy retains its previous 16px maximum.

The curved photographic mask, photo credit, back navigation, destination display-heading formula, editorial colors,
and entrance animation are unchanged. The large heading's known Stockholm wrapping defect is deliberately deferred.
Long introductions retain a four-line mobile excerpt and the existing full-article link; this is not a new full-text
expansion interface. Longer expanded tips use the panel's ordinary scrolling.

## Scroll ownership

**Verified cause:** the rail prevented nearly every wheel event before checking for vertical overflow. On the original
320×568 Boards chapter, Chrome measured 568px client height and 770px scroll height, with gallery arrows around y=690.
A downward wheel moved to the closing chapter while the Boards scrollTop stayed zero.

The rail now checks the event target and its ancestors for a vertically scrollable panel with room in the requested
direction. That panel keeps native wheel scrolling. At a boundary, a fresh outward gesture advances the horizontal
chapter. A 160ms wheel quiet interval separates continuing inner-scroll momentum from a deliberate boundary exit;
explicit horizontal intent still uses the existing gallery/chapter handling and 500ms chapter lock.

Vertical keyboard commands use the same directional ownership. Native controls, disclosure Space, modified keys,
Mapbox, and already-handled gallery keys keep their own behavior. Focus still reveals an offscreen chapter, and
native focus scrolling brings its lower controls into view. Reduced motion retains instantaneous chapter navigation.

Places and selected-place panels now allow vertical overflow too. Five sight rows retain a 56px minimum row budget,
and the map retains a 208px minimum frame, instead of squeezing content around the footer. Pagination, source links,
and the selected-place Board action can be reached by scrolling. The destination map explicitly opts into the shared
map's existing `cooperativeGestures` option: ordinary wheel input can scroll the panel, modified wheel zooms, and touch
map manipulation uses Mapbox's cooperative policy. Shared map defaults and other map placements are unchanged.

Touch uses native vertical panel scrolling and native horizontal rail swiping; no custom touch recognizer was added.
The card stage retains its existing `pan-y` policy and horizontal drag handler. At a vertical touch boundary, a sideways
gesture outside that card drag stage navigates chapters. Vertical overscroll does not leak to the outer document.

## Actual Chrome verification

Stockholm introduction, Places/Map layout, populated Boards chapter, gallery arrows, and closing chapter were checked
at every requested size in **both light and dark themes**. Screenshots and DOM measurements are in
[craft-implementation-02-evidence](craft-implementation-02-evidence/).

| Viewport | Intro excerpt height / font | Boards scroll needed to reach bottom | Gallery Next bottom | Closing action visible |
| -------- | --------------------------- | ------------------------------------ | ------------------- | ---------------------- |
| 320×568  | 96px / 14px                 | 202px                                | y=532px             | Yes                    |
| 390×667  | 96px / 14px                 | 103px                                | y=631px             | Yes                    |
| 390×844  | 96px / 14px                 | None                                 | y=808px             | Yes                    |
| 768×1024 | 333px / 16px, full prose    | None                                 | y=968px             | Yes                    |
| 1280×600 | 134px / 14px, full prose    | None                                 | y=544px             | Yes                    |
| 1440×900 | 154px / 16px, full prose    | None                                 | y=844px             | Yes                    |

The same geometry was measured in both themes. The tablet keeps the existing two-column composition.
The closing chapter's photo extends beyond its frame by design; its action and credit remain visible. Existing
display-heading/photo overlap and background-card title clipping were observed and left outside these two fixes.

Additional live checks:

- At 320×568, Space opens the getting-around disclosure. Wheel scroll reaches its credit and map link while the
  introduction remains the current chapter. The map link still navigates to Places.
- Wheel scrolling inside Places reaches its page controls. Selecting Vasa Museum opens its live map and details.
  Wheel input over the cooperative map scrolls the selected-place panel to its Board action (scrollTop 95px), without
  changing chapters. Mapbox displays its “⌘ + scroll” zoom hint.
- Wheel over a Board reaches the gallery arrows at scrollTop 202px; a later outward gesture can reach the closing
  chapter. Next still selects another Board. Native ArrowUp moves the inner offset from 202px to 162px; PageDown
  reaches 202px before a subsequent PageDown advances to the closing chapter.
- Desktop pointer dragging selects the next Board without following its link or moving the rail. Gallery End still
  selects the final Board within the current chapter. Viewer actions and bookmarks were inspected without writes.
- Original dark theme was restored; temporary viewport overrides and test tabs were cleaned up. Running services
  were left in place.

### Evidence highlights

- [Before: collapsed introduction](craft-implementation-02-evidence/01-before-intro-320-dark.jpg)
- [Before: offscreen gallery controls](craft-implementation-02-evidence/02-before-boards-controls-320-dark.jpg)
- [After: readable short-mobile introduction, light](craft-implementation-02-evidence/intro-320x568-light.jpg)
- [After: expanded tip and onward link](craft-implementation-02-evidence/04-after-expanded-tip-320-dark.jpg)
- [After: reachable gallery arrows](craft-implementation-02-evidence/07-after-boards-controls-320-dark.jpg)
- [After: cooperative map scroll reaches selected-place action](craft-implementation-02-evidence/map-cooperative-scroll-320-light.jpg)
- [All measured dimensions](craft-implementation-02-evidence/browser-measurements.json)

**Limits:** responsive checks used Chrome viewport emulation, not physical touch hardware or Safari. Mapbox's actual
cooperative hint and ordinary wheel path were verified; modified-wheel zoom and two-finger touch need hardware
acceptance. Reduced-motion navigation was tested through production handlers with a controlled preference, not by
changing the OS preference in Chrome. Trackpad momentum is covered by controlled event timing; the 160ms boundary
policy may benefit from a physical-trackpad review. No Board, bookmark, account or backend content was changed.

## Regression coverage and validation

Independent test authorship followed the frontend instructions. Nine new cases exercise production rendering and
registered handlers, rather than a duplicate scroll policy:

- Seven rail interaction tests: native vertical ownership, nested ancestors, directional boundaries, momentum,
  horizontal galleries, Mapbox/modifiers, keyboard controls, focus reveal and reduced motion.
- Two guide tests: native closed travel-advice disclosure retains prose/credits/onward navigation; the real Places
  renderer opts into cooperative gestures while retaining its points and selection callback.

Temporary copies of the original HEAD components produced six meaningful failures before the changes. They were
removed without replacing working production files. Final frontend suite: **753 passed, zero failures or skips**.
Standalone frontend TypeScript passed. The production webpack build passed in an isolated source copy so the running
development server's `.next` output was not replaced. Root `pnpm format`, `pnpm format:check` and `pnpm lint` passed;
lint covers frontend and backend with zero warnings allowed. The build copy's 300 source hashes match the final source.

During validation, pnpm 12's implicit pre-run dependency check attempted an installation and removed local frontend
modules before registry access failed. Modules were restored with the unchanged frozen lockfile, and the running app
recovered. No package, lockfile or configuration changed. Subsequent tests, TypeScript and build used installed tools
directly. Root checks use a process-local `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false`; see the
[official pnpm setting](https://github.com/pnpm/pnpm.io/blob/main/docs/settings/build.md#verifydepsbeforerun).

Implementation 01 readiness code and timing, audit history and evidence, gallery/card/save/permission code, backend
contracts and dependencies are unchanged. No global scrolling package, new dependency, commit, push, branch switch
or PR was introduced. Remaining risks are the browser/hardware verification limits above and the deferred audit items.
