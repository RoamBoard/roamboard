# Automatic published-board photos

Use distinct Unsplash photos for the gray decorative spaces in the published design. Search using the saved
location, then a broader location or Board tag when needed. If the user has no chosen header, select another
distinct photo for it. Keep user-selected headers and activity photos. When no usable photo is available, keep
the space as a gray block with its location name. Credit automatic photos with a small line on the image.

Reuse the existing backend Unsplash search and its PostgreSQL quota accounting. Keep this as derived viewer
presentation, with no Board mutation, new dependency or migration. Hotlink returned photo URLs and retain
photographer/source links with Unsplash referral parameters. A browser-tab cache shares searches between slots
and Board views; failed searches leave the Board readable and do not automatically retry upstream.

## Implementation

- [x] Add independent tests for distinct photos, saved-image precedence, location/tag queries, deduplication,
      provider failure and caching. Capture the missing behavior before implementation.
- [x] Add `src/lib/board-photos.ts` with the query plan and distinct-photo selection, and
      `src/components/features/boards/useBoardPhotos.ts` for loading after the Board appears.
- [x] Extend the existing Unsplash helper with an optional limit, using 10 results for automatic photos.
- [x] Replace secondary-activity-photo reuse in gray slots with automatic photos. Add a header fallback and
      location placeholders, including image-load errors. Keep author-photo omission as it is.
- [x] Add photographer credits on automatic photos and retain the existing photo positions and grayscale treatment.
- [x] Run frontend tests, TypeScript, production build, and required root formatting/lint checks. Inspect the Tokyo
      sample and a database Board on desktop/mobile, both themes, including placeholders.

## Decisions

Use one result pool per normalized location query and avoid IDs/URLs already used in the Board. Request broader
backup queries only for unresolved slots whose primary search succeeded. A failed primary request leaves its
placeholder without another provider request. A pool that runs out produces placeholders rather than repeated images.
Cache successful pools for one hour, empty pools for five minutes and failures for 30 seconds, at most 64 queries.
The existing quota service remains authoritative for actual provider requests.

The source documentation is [Unsplash's API guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines),
including [hotlinked image delivery](https://help.unsplash.com/en/articles/2511271-guideline-hotlinking-images) and
[photographer attribution](https://help.unsplash.com/en/articles/2511315-guideline-attribution). These automatic
illustrations are display suggestions and are not saved as a user-selected Board cover or exported by preview copies.

## Verification

The frontend suite has 80 passing tests, including 16 new automatic-photo tests. TypeScript, production build and
root formatting/lint checks passed. The local Node 20 runtime needs the explicit-file test command recorded in
the published-viewer plan rather than the normal glob-based test command.

Browser checks confirmed four distinct, credited grayscale photos in Tokyo while its selected cover stayed in
place. A database Board with no selected cover received a distinct automatic header and decorative photo, using
its broader country/tag query when the place pool had no usable results. Desktop and mobile layouts were checked
in both themes without horizontal overflow. Header credit clipping was corrected by placing that credit inside
the curved image. Review found no remaining defects. The original theme and viewport were restored.
