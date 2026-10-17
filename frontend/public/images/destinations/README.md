# Destination Atlas photography

## Image workflow for coding agents

Read [the supported image workflow](../../../../docs/IMAGE_WORKFLOW.md) before adding or changing images. Raster page photography now uses database-backed `library:` references through the shared image components. These original files remain migration/rollback fallbacks and retain the source credits below. SVG icons and masks stay local. Register new supplied images with `images:add`, verify the saved record, and wire the returned key into the page; do not introduce unregistered image URLs. Protected Board/activity uploads keep their separate authenticated upload and ordering flow.

Database-backed library references supply the editorial sample guide photography. Local WebP assets remain fallback copies during provider or database outages. Originals were downloaded
at up to 1600px and encoded with the already installed Sharp dependency; no image-generation service was used.
The two Kyoto circular compositions preserve the artwork supplied in the user's Figma reference.

| Asset              | Photographer / supplied source | Original                                                                                                        |
| ------------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| kyoto-hero.webp    | User-supplied Roamboard Figma  | [Hero, 55:1082](https://www.figma.com/design/4hUe6aKuQnp7zotBG7qqug/ROAMBOARD?node-id=55-1082)                  |
| kyoto-closing.webp | User-supplied Roamboard Figma  | [Closing composition, 740:1953](https://www.figma.com/design/4hUe6aKuQnp7zotBG7qqug/ROAMBOARD?node-id=740-1953) |
| inari.webp         | Jeremy Goldberg                | [AiC8MRukmBg](https://unsplash.com/photos/AiC8MRukmBg)                                                          |
| bamboo.webp        | Karen Chew                     | [EvsuNMbZNJw](https://unsplash.com/photos/EvsuNMbZNJw)                                                          |
| nishiki.webp       | KJ Gonzales                    | [Mz_rFI4oq4I](https://unsplash.com/photos/Mz_rFI4oq4I)                                                          |
| pontocho.webp      | Stefan Szankowski              | [gUg3rDj81ck](https://unsplash.com/photos/gUg3rDj81ck)                                                          |
| paris-hero.webp    | Diogo Fagundes                 | [dbBKeN1s8GY](https://unsplash.com/photos/dbBKeN1s8GY)                                                          |
| palais.webp        | Anthony DELANOIX               | [V5QILBs4jxA](https://unsplash.com/photos/V5QILBs4jxA)                                                          |
| montmartre.webp    | Francesco Zivoli               | [Qe5oPbc7pAo](https://unsplash.com/photos/Qe5oPbc7pAo)                                                          |
| seine.webp         | Meina Yin                      | [xwPoexRGsXA](https://unsplash.com/photos/xwPoexRGsXA)                                                          |
| nyhavn.webp        | Nick Karvounis                 | [z9omP7AT_2s](https://unsplash.com/photos/z9omP7AT_2s)                                                          |
| palms.webp         | Mykola Kolya Korzh             | [3C3EYGhWr9Q](https://unsplash.com/photos/3C3EYGhWr9Q)                                                          |
| superkilen.webp    | Sam Poullain                   | [TuAZPj1uaZs](https://unsplash.com/photos/TuAZPj1uaZs)                                                          |
| market.webp        | Simone Pellegrini              | [ZFkrPuz6EdI](https://unsplash.com/photos/ZFkrPuz6EdI)                                                          |

The Unsplash photo pages identify these as free photographs under the [Unsplash License](https://unsplash.com/license).
Source/photographer links are also included in the guide and place-detail views. This is a curated mock-content
collection, not an Unsplash API integration. The Kyoto Figma artwork remains user-provided design material;
its underlying photographic rights should be confirmed before a public release.

Place descriptions are original editorial sample copy, with visitor-information links to the official Kyoto,
Paris and Copenhagen guides and relevant venue websites. They do not promise current opening hours, prices,
accessibility or live conditions. Coordinates are approximate place references for external maps and are not
backend-validated location records.

The `opening/` SVGs (plus, fork, pin and current pin) are the original interface assets from Figma frame `55:1060`, Roam Page 4.3.1 (Destination loaded). They retain their source geometry and are used only in the destination introduction.
