# Create photography

## Image workflow for coding agents

Read [the supported image workflow](../../../../docs/IMAGE_WORKFLOW.md) before adding or changing images. Raster page photography now uses database-backed `library:` references through the shared image components. These original files remain migration/rollback fallbacks and retain the source credits below. SVG icons and masks stay local. Register new supplied images with `images:add`, verify the saved record, and wire the returned key into the page; do not introduce unregistered image URLs. Protected Board/activity uploads keep their separate authenticated upload and ordering flow.

`desert.jpg` is a local copy of Nejc Soklič’s photograph of the Dubai desert at sunset,
[YXFw9L-0DKo on Unsplash](https://unsplash.com/photos/YXFw9L-0DKo), downloaded at 2000px wide.
The source identifies it as free to use under the [Unsplash License](https://unsplash.com/license).
The Create landing page links to the photographer and original photo. This editorial asset is separate
from user-uploaded Board covers and the backend’s Unsplash search integration.

The editor's default cover reuses `../destinations/bamboo.webp`, credited to Karen Chew on
[Unsplash](https://unsplash.com/photos/EvsuNMbZNJw); its original source notes are in
[`../destinations/README.md`](../destinations/README.md). It is a visual fallback, not a persisted user upload.

`circuit/` contains unchanged SVG traces and a circular terminal exported from Roamboard's Figma file
`4hUe6aKuQnp7zotBG7qqug`, artwork frame `609:3591` in Smart Create. `CreatorUploadArtwork` arranges these
original assets at their reference coordinates and uses CSS masks to apply the current theme's line color.

`details/` contains unchanged visibility and information SVGs from Figma frame `1009:2283`.
`CreatorDetailIcon` preserves their exported dimensions and uses theme-colored CSS masks. Selected tag icons
come from the existing editorial catalog only when its display name matches the backend-provided selection.
