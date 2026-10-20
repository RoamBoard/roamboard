# Craft improvements — Implementation 03

CRAFT-02 only: destination introduction typography. Started with a clean tree on `ui-ux-craft-improvements`,
revision `44d2b3a`. Read both craft audits and Implementation 02. Gallery typography and other audit items are untouched.

## Verified root cause

The old font formula used the entire hero panel's container width and the name's character count. The heading itself
occupied only the area from the left inset through `right:45%`. Cabinet Grotesk's actual glyph widths, accents and
final loaded font were not considered; `break-words` then permitted an arbitrary final-letter break.

Before changes, at 1440×900 Chrome measured a **350.57px text box**, **69.56px font**, and **125.19px, two-line heading**.
At 320×568, the 25.5px Stockholm glyph advances totalled about **136px** inside a **120.25px** text box: STOCKHOL / M.
These are real browser measurements. The new helper's absence was not presented as a failing visual regression test.

Implementation 02's 38% mobile hero and scrolling information panel are preserved. Its prose, disclosure, credits,
Places controls and chapter scroll policy have not been rewritten to accommodate this fix.

## Design and technical approach

**A bounded rectangle inside the existing circle.** The type region keeps the original 20px/32px left inset and center
alignment, but reaches 58% across the panel instead of 55%. Its height is limited to 42% of the panel width and the
space between the existing back/credit areas. At that rectangle's widest corner,
`sqrt(0.58² + 0.21²) ≈ 0.617`, inside the unchanged `0.62 × panel width` photographic cutout radius. This slightly
wider safe region recovers scale without painting the name over the photograph.

CSS defines that region, a readable initial full-text fallback, font weight, tracking, casing and line height.
Precise fitting is necessary for this unusual composition: CSS alone cannot compare a complete word's shaped width
against the curved artwork's available width and height while retaining expressive short names.

`DestinationHeading` measures the actual computed display font at a 100px reference size, including the existing
`-0.065em` tracking. Canvas is used only for measurements; the displayed title remains one real **h1**, with the full
original name as its accessible label. Browsers without Canvas letter-spacing support use the tested tracking fallback.

The heading-specific composer:

- Keeps ordinary single words, including Stockholm and Kyoto, on one line.
- Composes multiword names at spaces, balancing measured line widths within at most three lines. Common connectors
  such as “and” and “de” stay with their phrase rather than becoming oversized orphan lines.
- Gives long unbroken names (12+ graphemes) an intentional two-line lockup when that preserves a stronger scale.
  Three lines are reserved for names that still cannot reach 22px in two; a word already fitting at 96px stays whole.
  This is a visual line break, **not invented linguistic hyphenation**. No hyphen, ellipsis or changed spelling is added.
  Unicode grapheme clusters stay intact, and emergency lines contain at least three clusters.
- Fits width and height, retains the original 96px display maximum, and rounds down to quarter pixels with a small
  safety margin. The result is computed directly, without repeatedly changing DOM font sizes to search for a fit.

Fitting runs in a layout effect before the first hydrated paint, then observes the actual type frame. Sidebar changes
therefore refit independently of window resize. Font readiness and later font-load events clear cached metrics.
Resize work is coalesced into one animation frame; identical results do not update state. Unmount/name replacement
disconnects observers, removes listeners and cancels queued work; stale font promises cannot overwrite a newer name.
No font-size transition or new entrance animation was added.

`DestinationArtwork` extracts the existing photo, mask, back link, attribution and entrance animation unchanged so the
real guide and a labelled development review use the same production composition. Existing reduced-motion handling
remains. This is specific to destination artwork, not a universal text-fitting component.

## Visual results and evidence

Stockholm now occupies **one line at 69.5px** on 1440×900, essentially its original display size. At 320×568 it is one
line at 23.75px. Kyoto becomes more expressive instead of inheriting a generic small size.

| Name                       | 320×568 | 1440×900 | Composition              |
| -------------------------- | ------- | -------- | ------------------------ |
| Stockholm                  | 23.75px | 69.5px   | One whole word           |
| Kyoto                      | 45.25px | 96px     | One whole word           |
| San Sebastián              | 28px    | 82.5px   | SAN / SEBASTIÁN          |
| Buenos Aires               | 34.25px | 96px     | BUENOS / AIRES           |
| Llanfairpwllgwyngyll       | 22.75px | 67px     | Balanced two-line lockup |
| San Cristóbal de las Casas | 21.5px  | 63.25px  | Three lines, whole words |
| 東京                       | 68.75px | 96px     | Full non-Latin name      |
| São Tomé and Príncipe      | 21.75px | 64px     | SÃO TOMÉ / AND PRÍNCIPE  |

Both themes were checked at **320×568, 390×667, 390×844, 768×1024, 1280×600 and 1440×900**. Ten local names, including
the synthetic equal-length `WWWWWWWW`/`IIIIIIII` glyph-width pair, produced **120 viewport/name/theme measurements**:
no measured line overflowed its safe width or escaped the circle. Four names were also checked with the expanded
sidebar at tablet and both desktop sizes in both themes. The mobile drawer opened and dismissed without changing
Stockholm's fitted size or leaving stale measurements.

Real routes were checked for Stockholm, Kyoto, San Sebastián, Buenos Aires and 東京. Buenos Aires and San Sebastián
were selected through actual Roam search; their ready overlays released correctly. Direct entry/reload, Back/Forward,
font-loaded state and ordinary resizing were checked. Stockholm was captured at all six sizes in both themes.

The development-only `/dev/destination-type` route offers clearly labelled local names/custom text and reuses an
existing Stockholm photograph with its real attribution. Its photo is explicitly illustrative for other names.
It does not create destination records or load the guide's Board/Mapbox data. It returns not-found in production.

- [Before: desktop Stockholm](craft-implementation-03-evidence/01-before-stockholm-desktop-dark.jpg)
- [After: desktop Stockholm](craft-implementation-03-evidence/real-stockholm-1440x900-dark.jpg)
- [Before: short-mobile Stockholm](craft-implementation-03-evidence/02-before-stockholm-mobile-dark.jpg)
- [After: short-mobile Stockholm, dark](craft-implementation-03-evidence/real-stockholm-320x568-dark.jpg)
- [After: short-mobile Stockholm, light](craft-implementation-03-evidence/real-stockholm-320x568-light.jpg)
- [Actual Kyoto, mobile](craft-implementation-03-evidence/real-kyoto-mobile-light.jpg)
- [Actual San Sebastián, mobile](craft-implementation-03-evidence/real-san-sebastian-mobile-light.jpg)
- [Actual Buenos Aires, desktop](craft-implementation-03-evidence/real-buenos-aires-desktop-light.jpg)
- [Long single word, desktop fixture](craft-implementation-03-evidence/fixture-llanfairpwllgwyngyll-1440x900-dark.jpg)
- [Long multiword name, mobile fixture](craft-implementation-03-evidence/fixture-san-cristóbal-de-las-casas-320x568-dark.jpg)
- [Expanded sidebar, tablet](craft-implementation-03-evidence/expanded-stockholm-768x1024-light.jpg)
- [Recorded dimensions and line bounds](craft-implementation-03-evidence/browser-measurements.json)

Some keyboard-navigation screenshots include the existing focus outline applied by destination readiness. No new
heading focus treatment was introduced. Original dark theme, collapsed sidebar preference and normal viewport were
restored, and the temporary test tab was closed. Running services were left in place.

## Regression coverage and validation

Independent test authorship followed the frontend instructions. Two test files add **16 checks**, including tracking
subtests, for measured wide/narrow glyphs, whole-word and balanced long-name composition, connector grouping, bounds,
accents/combining marks/CJK/Thai/ZWJ clusters, full accessible server-rendered text, frame/sidebar resizing, font readiness,
cache invalidation, duplicate-fit stability, tracking fallback, replacement/unmount cleanup and stale callbacks.

Full frontend suite: **769 passed, zero failures or skips**. Frontend TypeScript passed. Focused ESLint passed.
Production webpack build passed in an isolated source copy, preserving the running dev server's `.next`; all **305
frontend source-file hashes** match the working source. Root `pnpm format`, `pnpm format:check` and `pnpm lint` passed;
lint covers frontend and backend with zero warnings allowed. Checks use installed Node 24 tools and process-local
`PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false`; no dependencies were installed or changed in this session.

## Review limits and preserved behavior

Chrome verification used responsive viewports, not Safari or physical devices. The final locally hosted Cabinet font
and platform CJK fallback were measured in Chrome. A deliberately cold-cache/slow-font first paint and OS reduced-motion
preference were not forced in the browser. Controlled production-component tests cover font replacement and lifecycle;
the server fallback keeps the full text visible, and a font swap may require one corrective fit. The heading adds no
motion; the extracted photograph retains its original reduced-motion branch.

The long-single-word lockup is an intentional visual policy for review, not syllable-aware hyphenation. The connector
list is deliberately small rather than a language parser. Very unusual names or fonts may merit further visual checks.

Implementation 01 URL identity/readiness/timing and Implementation 02's responsive information layout and scrolling
remain unchanged. Gallery title presentation, cards, dragging, actions, saving, permissions, navigation/search contracts,
backend code, dependency manifests and lockfiles are unchanged. Previous audit logs and evidence remain historical.
No commit, push, branch switch, merge or PR was performed. Stop here for visual review.
