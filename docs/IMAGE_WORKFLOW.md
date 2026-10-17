# Website and user image workflow

This is the supported image workflow for all coding agents. Follow the root, frontend and backend `AGENTS.md` files.
`layered-backend-demo1/` is abandoned; its historical media documentation does not define this workflow.

## Editorial pages, collections and sample photography

Editorial image records live in PostgreSQL's `editorial_image` catalog. Eligible files are stored publicly under
Cloudinary's `roamboard/editorial/` prefix. Unsplash references stay on Unsplash and retain their source/credits.
Page data uses stable `library:<assetKey>` strings, never invented Cloudinary URLs or database IDs. Mock stories/users
stay mocks; putting their photography in the catalog does not persist fictional Boards or collection membership.

```tsx
import Image, { LibraryCredit } from "@/components/images/LibraryImage";

<Image src="library:frontend.images.create.desert" alt="Dubai desert at sunset" width={1200} height={800} />
<LibraryCredit source="library:frontend.images.create.desert" />
```

`ImageLibraryProvider` is already installed in the root layout. It reads the backend catalog and resolves image keys
to current provider URLs. Keep placement alt text, dimensions and crops in page/component data. For a native image,
use the named `LibraryImg` export. For a background/custom renderer, use `getLibraryImage(key)` or
`getLibraryImages(keys)` from `@/lib/image-library` and render the returned asset URL with explicit loading/error handling.
Do not pass a `library:` string directly to a native image, CSS URL, link, or unwrapped `next/image`.

Public lookup endpoints remain available after Labs removal:

- `GET /api/v1/image-library/<assetKey>` returns `{ "data": <record> }`, or 404 `IMAGE_NOT_FOUND`.
- `GET /api/v1/image-library?keys=home.hero,home.banner` returns found records for up to 50 valid keys. Missing keys are
  omitted. An entirely missing batch returns an empty array; malformed/empty/oversized filters return 400.
- `GET /api/v1/image-library` retains the full catalog for the shared renderer and development image browser.

The `shared/editorial-images.json` registry maps imported keys to their original source aliases. It is a rollback and
initial-render fallback, not a copy of database delivery state. Existing local files remain available. Do not replace
database lookup with a hardcoded Cloudinary URL. `editorialImage(originalSource)` resolves helper-built legacy source
paths to registered keys; new page data should use the saved key directly. Unknown helper-built sources fail visibly
so agents register them instead of silently introducing a bypass.

## When a teammate supplies a file or link

Registration and integration are part of the agent's task. Do not send teammates to Labs or ask them to run commands
that the agent can perform. Choose a descriptive key, look it up to avoid duplicates, register the supplied image,
verify its saved record, and wire its returned reference into the requested page. Registration alone does not change
a page. Never overwrite an existing unrelated key without a replacement request.

From `backend/`, using the existing backend `.env` and database tunnel:

```powershell
npm.cmd run images:add -- --key home.hero --file "C:\path\photo.jpg" --alt "Mountain lake" --credit "User-provided image"
npm.cmd run images:add -- --key discover.kyoto.hero --unsplash "https://unsplash.com/photos/AiC8MRukmBg"
npm.cmd run images:add -- --key home.banner --url "https://example.com/photo.jpg" --alt "Coastal town" --credit "Photographer" --source-url "https://example.com/source"
```

Use `npm` on Linux/macOS. The result includes `reference` and the saved record. The command reads existing
`DATABASE_URL`, Cloudinary and Unsplash configuration server-side, without browser-cookie access. Do not expose
credentials in the frontend or add unauthenticated upload endpoints for coding agents.

Files and ordinary public HTTPS raster links go to Cloudinary, up to 10 MB. Direct links must return images, not web
pages. The downloader limits redirects/time/bytes and rejects private network addresses. Unsplash page links/IDs fetch
canonical attribution and record the selection event; direct `images.unsplash.com` links require supplied metadata and
remain external. Infer placement alt text from the supplied image/task; preserve source and photographer information.
Use "User-provided image" for an attached file with no photographer supplied. Ask only for attribution that cannot be
established for third-party sources. If access/configuration is missing, preserve working imagery and report the blocker.

For an intentional replacement, fetch the current revision and supply `--expected-revision <revision>`. A stale write
returns a conflict. Old asset revisions remain stored. Existing pages/other tabs reload to see the new catalog; there
is no separate publication step.

## Labs, bulk migration and checks

`/dev/images` supports signed-in development uploads, Unsplash selection, copying references, inspecting imported
usage paths and replacing an existing key. Its mutations also require backend development mode and the exact frontend
Origin. Remove the Labs page/navigation and management mutations before deployment; keep catalog reads, renderers,
database records and developer commands.

`npm.cmd run images:inventory` scans sources and refreshes `backend/db/frontend-image-inventory.json` plus the shared
fallback registry. Review the diff, including helper-built sources and metadata. `npm.cmd run images:import` imports
missing records and merges usage metadata without overwriting existing revisions. Migration 005 is already applied to
the shared database; do not rerun old migrations. A new database needs the ordered schema and image import.

Run root formatting/lint plus applicable frontend/backend tests, typechecks and builds. Verify the actual page, layout,
source credits and failures. Imported usage paths are source references, not a complete runtime dependency graph;
search the repo for a stable key before replacing it. Interface SVGs, icons, masks and fonts remain local code assets.

## Protected Board, activity and profile uploads

These use the existing `uploaded_image`, upload-intent and Board services, separately from the editorial catalog.
Uploads are Cloudinary `authenticated` assets. Display URLs use `/api/v1/images/:imageId/content` and check current
session/Board access. Keep the existing browser-cookie delivery; do not replace protected URLs with public editorial
URLs or send them through Next's unauthenticated optimizer. Product media should not be registered through Labs.

Board image order, each activity's ordered photo list, its selected cover and the selected Board cover remain in the
canonical database document. Editorial replacement must not mutate those IDs, links or positions. Live provider search
results and automatic viewer illustrations remain transient unless explicitly selected through a supported save flow.

## Missing files and recovery

PostgreSQL stores references, not image bytes. A database backup cannot recover a deleted Cloudinary file. Keep the
same Cloudinary account/environment across teammates; switching accounts does not move assets. Preserve both public
editorial media and authenticated user media when migrating providers/accounts.

On 2026-10-17 all 171 editorial records had working image delivery. Separately, saved images 3, 4 and 5 on Board 1
returned Cloudinary 404s; their database links/order and cover selections still exist. The user indicated assets may
have been deleted. The UI must not substitute unrelated editorial photographs or delete their database rows. Restore
the original assets from available provider backup, or obtain the original files from their owner. Restoring them under
their existing storage keys and authenticated delivery preserves IDs/order. If the owner instead replaces them through
the editor, save the new upload IDs, photo order and cover selections through the canonical Board API. Never make
protected originals public to work around missing-file errors. A storage 404 is reported as `IMAGE_ASSET_MISSING`.
