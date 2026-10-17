# Collapsed Board reference assets

## Image workflow for coding agents

Read [the supported image workflow](../../../../docs/IMAGE_WORKFLOW.md) before adding or changing images. Raster page photography now uses database-backed `library:` references through the shared image components. These original files remain migration/rollback fallbacks and retain the source credits below. SVG icons and masks stay local. Register new supplied images with `images:add`, verify the saved record, and wire the returned key into the page; do not introduce unregistered image URLs. Protected Board/activity uploads keep their separate authenticated upload and ordering flow.

Original image and SVG assets from [ROAMBOARD · Project Components](https://www.figma.com/design/4hUe6aKuQnp7zotBG7qqug/ROAMBOARD?node-id=259-436).
These files are image fills and vector assets, not screenshots of complete cards. The components render the text,
layout, overlays, and borders in HTML/CSS.

Photo copies retain their original aspect ratios and are prepared as PNG at up to twice their maximum reference
display size, including Porto's enlarged crop. This reduces the source download size without adding lossy image
compression. The compact photos were already supplied at twice their displayed dimensions.

| Variant        | Examples and Figma nodes                                       |
| -------------- | -------------------------------------------------------------- |
| V1 · Collage   | Tokyo `259:435`, Paris `260:685`, Bangkok `261:731`            |
| V2 · Compact   | Tokyo `729:1198`, Paris `635:4812`, Bangkok `635:4822`         |
| V3 · Landscape | Buenos Aires `899:1735`, Odda `899:1771`, Marrakech `899:1793` |
| V4 · Photo     | Porto `919:1438`, Lofoten `919:1453`, Barcelona `919:1457`     |

Repeated divider and bookmark graphics are shared across the examples. The compact photos include the original
elliptical crop. Porto uses its original enlarged/offset image crop, configured in the fixture data.

Presentation fixtures are intentionally separate from persisted Board data. Figma's decorative labels `POR` and
`SPA` are retained as shown; they are not used as database country identifiers.
