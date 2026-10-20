# Craft improvements — Implementation 01

Implemented CRAFT-01 and REFRESH-01 on `ui-ux-craft-improvements`, based on `ed11e29299e934777eec8fe4ec275ff1fa03a773`.
The original audit, refresh audit and their evidence remain historical records. No other audit items are implemented.

## CRAFT-01: accented destination readiness

**Verified cause:** search encoded the logical slug once, while the destination route encoded Next's already encoded
route segment again. San Sebastián therefore navigated to a valid guide, but its readiness identity did not exactly
match the pending transition. Chrome reproduced the false timeout before the change.

**Change:** decode the framework route parameter once at the destination route boundary. A shared
`destinationRouteHref` helper serializes logical slugs and query parameters for both search navigation and page
readiness. Literal percent sequences remain distinct from reserved characters; decoding is never recursive.
Malformed escapes still fail rather than acknowledging a guessed identity.

The strict readiness comparison, namesake selection and location validation remain in place. No loading-store,
transition-provider, animation or SVG code changed. The three-second introduction, real 25-second timeout,
cancellation and stale-transition guards are preserved.

## REFRESH-01: Board search and account lifetime

**Verified cause:** the account ID formed part of `BoardsDiscoveryContent`'s React key. Initial identification changed
that key, remounting the input and discarding its draft, focus and suggestion state. Chrome reproduced typing
Stockholm while identification was pending, followed by an empty, blurred input after identification.

**Change:** keep the search interaction mounted across viewer changes while retaining URL-based remounts. Suggestions
receive a new local discovery store for each viewer lifetime. Full search results and discovery collections remain
keyed by viewer. Pending identification has a separate identity from signed-out browsing because cookie-bearing
requests made while identification is pending may return protected content. A viewer change also invalidates the
keyboard suggestion index, including A → B → A switches. Existing request cleanup and stale-response guards remain.

The draft, input focus, open panel and location mode survive identification. Account-specific results revalidate;
old results and permissions do not survive account switches or logout. No global result cache was introduced.

Community discovery, suggestions, location interpretation, URL search, pagination, Featured, Recently Published,
My Boards and Saved Boards retain their existing implementations. BoardLibrary, BoardSelectionGallery, card actions,
bookmarks, dragging, navigation, backend contracts, styles and layout are unchanged.

## Verification

Independent regression tests were authored under the frontend instructions. They failed against the original
behavior before the fixes and pass with the implementation:

- `frontend/test/destination-route-readiness.test.ts`: four tests use the actual async route, its readiness component
  and the strict loading store. They cover ASCII, accents, non-Latin names, encoded reserved characters, literal
  percent sequences, selector identity, repeated query parameters, malformed escapes, cancellation, stale readiness,
  genuine timeout and the unchanged three-second introduction.
- `frontend/test/boards-discovery-lifetime.test.ts`: five tests exercise the production components, local stores,
  auth observer and credentialed request helpers through a hook/reconciliation harness. Controlled identification
  and responses cover initial drafts/input identity, keyboard submission, viewer changes, logout, pending logout,
  stale responses, A → B → A selection, URL pagination and location mode. Browser checks establish actual DOM focus.

Full frontend suite: **744 passed, zero failures or skipped tests**. Standalone frontend TypeScript passed.
The production webpack build passed in an isolated temporary source copy, preserving the running development
server and its `.next` output. Root `pnpm format`, `pnpm format:check` and `pnpm lint` passed; lint covers frontend and
backend with zero warnings allowed. The build copy's 300 source-file hashes match the final working source.

Chrome observations:

- After the fix, the existing San Sebastián error's **Try again** action releases the overlay and shows the guide.
  Keyboard selection also opens the real guide at a 390 × 667 viewport. Browser Back returns to Roam and Forward
  restores the guide without a stuck overlay.
- Stockholm navigation and direct reload work. A direct Tokyo (`東京`) guide loads successfully.
- Cancelled the development slow-server transition, then navigated to Stockholm. Its late response did not replace
  Stockholm or release an incorrect overlay. The genuine-timeout and wrong-readiness cases remain automated tests.
- On desktop and mobile, typing during real pending account identification preserves the query, focus on
  `boards-search` and expanded suggestion panel after identification. ArrowDown selects a suggestion; Escape and
  Enter retain the submitted URL-backed search, including `Stockholm cafés` on mobile.
- Real Next server responses for ASCII, Tokyo, reserved-character names and literal `%2F` names announce exactly the
  requested route identity. These are read-only rendered-route checks, not persisted destination records.

**Verification limits:** safe browser network throttling was unavailable, so deliberately delayed identification,
account switching, logout and stale account races were exercised in controlled automated tests. Live account
switching/logout was not attempted because restoring the current Google session could require interactive sign-in.
Mobile checks used Chrome viewport emulation, not physical touch hardware. No persisted Board or account content
was changed during browser checks.

## Evidence

1. [Before: search draft cleared after identification](craft-implementation-01-evidence/01-before-search-reset.jpg)
2. [Before: false destination timeout](craft-implementation-01-evidence/02-before-destination-timeout.jpg)
3. [After: accented guide](craft-implementation-01-evidence/03-after-accented-guide.jpg)
4. [After: desktop search preserved](craft-implementation-01-evidence/04-after-search-preserved.jpg)
5. [After: mobile search preserved](craft-implementation-01-evidence/05-after-mobile-search-preserved.jpg)
6. [After: mobile accented guide](craft-implementation-01-evidence/06-after-mobile-accented-guide.jpg)
7. [After: non-Latin direct guide](craft-implementation-01-evidence/07-after-non-latin-direct-guide.jpg)

Remaining verification risk is the live authentication and physical-device gap above. Review is limited to these two
fixes; this log does not certify unrelated audit findings. No commit, push, branch switch, merge or PR was performed.
