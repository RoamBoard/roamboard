# Live Discover implementation plan

Goal: Discover shows persisted public, published Boards and collections with real matching content.

Architecture: Reuse the existing public Recent and weekly Featured APIs, shared Board summaries and card adapters.
Read public summaries without account cookies. Keep editorial collection definitions and photography; replace sample
Board records and counts. No new dependencies, database writes or backend endpoints.

## Implementation

1. Add regression tests for public summary pagination, tag matching, country matching, real links and failures.
2. Connect the existing Discover data boundary to public summaries, sharing reads within a server render.
3. Supply live data to Discover's collections, Featured and RoamFlow; retain empty collection/vibe links as requested.
4. Connect collection/vibe detail routes, retain unavailable/empty states and actual Board links.
5. Replace RoamFlow's mock loader with public API pagination, preserving its cancellation and retry behaviour.
6. Update project guidance, run formatting/lint/type/build checks and relevant tests, and verify live browser flows.

## Checks

Only public published records appear. Collection matching uses any configured catalog tag and counts each Board once.
Unavailable reads never show fictional Boards or fabricated counts. Published Board links use saved numeric IDs.
Country counts use normalized alpha-3 codes. Empty collections remain directly addressable with an honest empty state.
