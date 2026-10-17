# Website image library

Status: Implemented at the requesting user's direction on 2026-10-17. Separate frontend/backend teammate review is pending; this is not a claim of joint approval.

## Scope and decisions

The user requested migration of frontend imagery into database-backed records, easy future additions, a development image-management page in Labs, and replacement across shared usages. Implementation was explicitly requested after contract discussion. Eligible files are hosted by Cloudinary; Unsplash API images retain Unsplash delivery URLs. The database stores references and metadata, not image binary data.

Raster website photography and editorial/sample images are included. Interface SVGs, masks, icons and fonts remain code assets. Mock Boards/users remain mocks. Existing protected Board/profile uploads and live provider previews retain their original media and permissions.

Sources: branch `62-migrate-images-and-hardcoded-items-into-database`, `backend/src/features/image-library/`, `backend/src/jobs/import-frontend-images.ts`, `frontend/src/components/images/LibraryImage.tsx`, and `frontend/src/app/dev/images/page.tsx`.

## Storage and identifiers

Migration `005_image_library.sql` adds `editorial_image` and immutable `editorial_image_revision` records. A stable `assetKey` identifies one reusable website image; its monotonically increasing revision identifies a replacement. Asset metadata contains provider, delivery/thumbnail URLs, alt text, credit and source links, Cloudinary asset/public IDs or an Unsplash photo ID, checksum where uploaded, and dimensions. Imported source aliases retain existing usages. Inventory usage paths are source-file references, not an exhaustive runtime dependency graph.

Keys use 1–160 lowercase letters, digits, dots, hyphens or underscores and start with a letter or digit. Upload alt text is required (1–500 characters), credit is required (1–300), and source URL is empty or HTTPS. Empty source URL means no supplied source page; no provider IDs are fabricated. Cloudinary identifiers are null for Unsplash; Unsplash IDs are null for uploaded files. Older hardcoded Unsplash sources without identifiable photo-page IDs retain null IDs and their original URLs. Unknown historical credits remain explicitly marked for review and existing attribution is preserved.

Files uploaded through Labs use the existing multipart parser: exactly one `file`, JPEG/PNG/WebP/HEIC/HEIF filename, nonempty, up to 10,000,000 bytes. Cloudinary validates supported image content. Assets use the separate `roamboard/editorial/` namespace and public delivery. They must never enter owner-bound upload cleanup or protected media tables.

## API

All routes use `/api/v1/image-library`, `{ "data": ... }` on success, and `{ "error": { "code": "...", "message": "..." } }` on failure.

| Method/path      | Access                                                             | Input                                                                                | Result                                            |
| ---------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------- |
| GET `/`          | Public, all environments                                           | None                                                                                 | 200, array of catalog records; no-store           |
| POST `/upload`   | Signed-in session, backend development mode, exact frontend Origin | Multipart `file`; query `assetKey`, `expectedRevision`, `alt`, `credit`, `sourceUrl` | 201, saved record                                 |
| POST `/unsplash` | Same development/session/origin checks                             | JSON `assetKey`, `expectedRevision`, `photoId`                                       | 201, saved record with verified provider metadata |

`expectedRevision` defaults to zero for creation. Replacement supplies the current revision. Upload query numbers are coerced; JSON revision must be an integer. Omitted upload source URL defaults to empty. Other omitted required fields, nulls, unknown fields and invalid photo IDs return 400. Unsplash photo IDs accept 1–80 letters, digits, underscores or hyphens; arbitrary image URLs are not accepted by mutation endpoints.

Example selection:

```json
{ "assetKey": "destinations.kyoto.cover", "expectedRevision": 0, "photoId": "AiC8MRukmBg" }
```

Example saved record (illustrative provider values):

```json
{
    "data": {
        "assetKey": "destinations.kyoto.cover",
        "revision": 1,
        "aliases": [],
        "usages": [],
        "asset": {
            "provider": "unsplash",
            "url": "https://images.unsplash.com/photo-example?ixid=example",
            "thumbnailUrl": "https://images.unsplash.com/photo-example?w=200&ixid=example",
            "alt": "Torii gates in Kyoto",
            "credit": "Photographer",
            "sourceUrl": "https://unsplash.com/photos/AiC8MRukmBg?utm_source=roamboard&utm_medium=referral",
            "photographerUrl": "https://unsplash.com/@photographer?utm_source=roamboard&utm_medium=referral",
            "cloudinaryAssetId": null,
            "cloudinaryPublicId": null,
            "unsplashPhotoId": "AiC8MRukmBg",
            "checksum": null,
            "width": 1600,
            "height": 1200
        }
    }
}
```

Failures: 401 without a session; 403 for missing/foreign Origin; 404 for development mutations outside development mode or missing upstream photo; 409 `IMAGE_REVISION_CONFLICT` for stale keys/revisions; 413 for oversized upload; 429 with quota feedback for Unsplash exhaustion; 503 for unconfigured provider; 502 for failed upload/provider delivery. Database failures use centralized safe errors. A failed provider call or conflicting save never replaces the current database revision. Upload success followed by DB failure can leave an unreferenced Cloudinary asset, retained for reconciliation rather than automatic deletion.

## Frontend behavior and teammate workflow

Labs at `/dev/images` provides search, owned-file upload, Unsplash search/selection, source details, imported usage references, copy reference and global replacement. Use an existing signed-in session; it does not simulate login. Loading, empty, error/reload and working/success states are explicit. Existing Labs styling was approved by the user.

Use the copied `library:<assetKey>` as the source of the shared image component. Existing editorial images also resolve through imported aliases. `ImageLibraryProvider` loads the catalog once per page mount and refreshes after a local Labs save. Other tabs see replacements after reload. There is no separate publication step. New usages should include `LibraryCredit`; existing Destination credits resolve replacement metadata through it. Crop and placement alt text remain component-owned. Unsplash tracking parameters come from the selected image; original size/crop parameters are preserved for existing Unsplash placements.

Original files/URLs remain initial rendering and failure fallbacks. Failed catalog reads retain the previous catalog or original sources. A failed replacement image falls back to the original source before invoking the existing failure handler. A new missing `library:` reference renders an accessible unavailable placeholder. Do not remove local fallback files as part of this rollout.

## Bulk migration and recovery

From `backend/`:

```powershell
npx.cmd tsx src/jobs/import-frontend-images.ts --inventory
npx.cmd tsx src/jobs/import-frontend-images.ts --apply-schema --apply
```

The first command writes the reviewable `db/frontend-image-inventory.json` without database/provider writes. The second reads that inventory, applies only new migration 005 if absent, and imports records sequentially. Existing keys are retained; only aliases/usages merge on reruns. Applied schema is never rebuilt. The shared tag-photo catalog is included. Constructed paths in the two pure editorial data modules are evaluated during inventory; directory references provide conservative usage references for other helpers. Review new dynamic source patterns when adding them.

Uploads use namespaced key/content-hash public IDs with overwrite disabled. A rerun retains completed records and resumes missing ones. The one existing file over Cloudinary's upload limit is resized/re-encoded through the installed Sharp dependency for its migration copy; originals remain unchanged. Old hardcoded Unsplash references are recorded without fetching/rehosting their bytes or generating fresh selection events. New Labs selections obtain canonical photo metadata and trigger the quota-managed download-equivalent request before saving.

The current database was migrated on 2026-10-17: 171 records, 70 Cloudinary files and 101 Unsplash references. All 70 Cloudinary delivery URLs returned image responses; all hosted rows have asset/public IDs. A second import retained existing revisions. No original frontend files were deleted. See `backend/db/MIGRATION_LOG.md`.

Rollback application rendering by restoring original image imports/provider wiring; original sources remain available. Database history retains old asset revisions and Cloudinary files; no automated destructive rollback or asset deletion is supplied. Labs is development-only, and management endpoints are disabled outside development. Remove Labs page/navigation and management routes before deployment, while keeping the public read route, catalog data, image components and developer bulk tooling.

## Review and limitations

### Explicit editorial references and source recovery

Existing editorial photo data and shared tag images now use explicit `library:` references. The generated
`shared/editorial-images.json` retains original source aliases for rendering before catalog load and for failures.
`editorialImage(originalSource)` resolves helper-built source paths to registered keys and fails on unknown images.
Bulk inventory understands these references and preserves source metadata. The supported READMEs link to
`docs/IMAGE_WORKFLOW.md`; the abandoned backend is excluded.

All 171 editorial records passed live image delivery checks on 2026-10-17. Separately, Board 1's saved images 3–5
returned Cloudinary 404s despite valid database links; the user indicated assets may have been deleted. Their IDs,
ordering and covers are preserved. Missing protected files now return `IMAGE_ASSET_MISSING` rather than a generic
delivery error. Recovering their original pixels requires provider backup or original files; editorial migration does
not reconstruct deleted uploads or substitute unrelated photography.

### Agent authoring and targeted reads — user-requested extension

The user requested automatic registration and page integration when teammates supply files or image links to coding
agents. `npm run images:add -- --key <key>` now accepts one of `--file`, `--unsplash` (ID/photo-page URL), or `--url`.
Local files and ordinary public HTTPS raster links upload to Cloudinary; Unsplash references retain provider delivery.
Uploads/ordinary links require alt/credit and accept a source URL. Direct Unsplash CDN references require supplied
metadata and keep a null photo ID when the canonical ID is unknown. No credentials enter frontend code. The developer
command uses existing backend database/provider access, not browser cookies or a newly unauthenticated mutation API.
New keys default to create-only; an intentional replacement requires the current expected revision. Its output contains
the saved record and reusable reference. Agents must verify it and wire it into the actual page, not stop at registration.

Added public read endpoints: `GET /api/v1/image-library/:assetKey` returns `{ "data": <record> }`, with 404
`IMAGE_NOT_FOUND` when absent and 400 for invalid keys. `GET /api/v1/image-library?keys=a,b` returns
`{ "data": [<found records>] }` for 1–50 valid keys; absent keys are omitted, an entirely missing batch returns an empty
array, and malformed/empty/oversized key lists return 400. Omit the filter to retain the existing full-catalog API.
Frontend `getLibraryImage`/`getLibraryImages` helpers call these endpoints. The shared image component already resolves
copied `library:` references through database catalog reads; custom renderers can use the targeted helpers.

Ordinary URL downloads are CLI-only, capped at 10 MB, supported raster MIME types, 15 seconds per hop and three
redirects. Only public HTTPS on port 443 is accepted; each redirect resolves and pins a public DNS address. Unsafe
addresses, credential URLs and web pages fail before storage. No arbitrary-fetch backend HTTP endpoint is exposed.

The requesting user approved the mixed provider catalog, development Labs management, shared replacement, existing Labs styling, and implementation. No absent teammate's approval is implied. A separate test author was unavailable; new tests need independent review. The browser connector had no available browser, so responsive/theme visual inspection remains a manual review item. Historical missing credits still need source review. New image placements require code changes using the copied reference; Labs does not edit page source code.

Provider references: [Unsplash API terms](https://unsplash.com/api-terms), [hotlinking guidance](https://help.unsplash.com/en/articles/2511271-guideline-hotlinking-images), [API documentation](https://unsplash.com/documentation), [Cloudinary uploads](https://cloudinary.com/documentation/image_upload_api_reference).
