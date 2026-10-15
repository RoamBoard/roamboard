# Country codes

`country-codes.json` is the shared ISO 3166-1 alpha-2 to alpha-3 mapping for the
249 countries already supported by the frontend's country list. Country names
and fuzzy selection continue to use `frontend/src/lib/countries.ts`.
Application values and API responses use alpha-3, for example `SWE`, `JPN`,
`FRA`, `USA`, `GBR`, `CHE` and `KOR`. Unknown codes remain invalid or null.

Mapping source: [i18n-iso-countries country data](https://github.com/michaelwittig/node-i18n-iso-countries/blob/master/codes.json).
Its non-ISO `XK` extension is excluded. No library dependency was added.

Convert to alpha-2 only for Geoapify country filters and `Intl.DisplayNames`
region lookup. Provider responses are normalized to validated alpha-3 codes.
Mapbox boundary filters use the tileset's native `iso_3166_1_alpha_3` property.
Include the shared JSON file alongside the backend when deploying its build.
