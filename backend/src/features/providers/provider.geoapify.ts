import { observeProviderResponse } from "../quotas/quota.feedback.js";
import type { QuotaObserver } from "../quotas/quota.types.js";
import type { DestinationResult } from "../destinations/destination.types.js";
import type { MapboxLocation } from "./provider.types.js";
import { toCountryCode, toAlpha2CountryCode } from "../../shared/countries.js";

function object(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}
function text(value: unknown): string {
    return typeof value === "string" ? value : "";
}

interface GeoapifyResult extends DestinationResult {
    area: string;
    poiName: string;
    region: string;
}

function poiType(category: string, raw: Record<string, unknown>): string {
    const tags = [category, text(raw.amenity), text(raw.shop), text(raw.tourism), text(raw.leisure), text(raw.historic)]
        .join(".")
        .toLowerCase();
    if (/restaurant|food_court|fast_food/.test(tags)) return "restaurant";
    if (/cafe|coffee/.test(tags)) return "cafe";
    if (/bar|pub|nightclub/.test(tags)) return "bar";
    if (/museum/.test(tags)) return "museum";
    if (/shopping|commercial|mall|supermarket|department_store/.test(tags) || text(raw.shop)) return "shopping";
    if (/hotel|hostel|guest_house|accommodation/.test(tags)) return "stay";
    if (/park|garden/.test(tags)) return "park";
    if (/beach/.test(tags)) return "beach";
    if (
        /sights|attraction|monument|memorial|historic|religion|place_of_worship|temple|shrine/.test(tags) ||
        text(raw.historic)
    )
        return "landmark";
    if (/transport|station|bus_stop/.test(tags)) return "transit";
    return "poi";
}

async function request(url: URL, key: string, observe?: QuotaObserver): Promise<GeoapifyResult[]> {
    url.searchParams.set("apiKey", key);
    url.searchParams.set("lang", "en");
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    await observeProviderResponse(response, observe);
    if (!response.ok) throw new Error(`Geoapify returned ${response.status}`);
    const body = object(await response.json());
    return (Array.isArray(body.features) ? body.features : []).flatMap((feature) => {
        const p = object(object(feature).properties);
        if (
            typeof p.lat !== "number" ||
            typeof p.lon !== "number" ||
            !Number.isFinite(p.lat) ||
            !Number.isFinite(p.lon) ||
            Math.abs(p.lat) > 90 ||
            Math.abs(p.lon) > 180
        )
            return [];
        const resultType = text(p.result_type);
        const raw = object(object(p.datasource).raw);
        const city = text(p.city) || text(p.town) || text(p.village) || (resultType === "city" ? text(p.name) : "");
        const area =
            text(p.neighbourhood) ||
            text(p.neighborhood) ||
            text(raw["addr:neighbourhood"]) ||
            text(raw["addr:neighborhood"]) ||
            text(p.quarter) ||
            text(p.suburb) ||
            text(raw["addr:suburb"]) ||
            text(p.district) ||
            text(raw["addr:district"]) ||
            (["suburb", "district", "locality"].includes(resultType) ? text(p.name) : "");
        const categories = [text(p.category), ...(Array.isArray(p.categories) ? p.categories.map(text) : [])].filter(
            Boolean
        );
        const category = categories.join(".");
        const namedFeature = text(p.name) || text(raw.name);
        const administrative = [
            "city",
            "town",
            "village",
            "state",
            "region",
            "country",
            "county",
            "district",
            "locality",
            "suburb",
            "island"
        ].includes(resultType);
        const isPoi =
            !administrative &&
            (resultType === "amenity" ||
                categories.some((value) => !/^(building|administrative|address)(\.|$)/.test(value)) ||
                Boolean(raw.amenity || raw.shop || raw.tourism || raw.historic || raw.leisure));
        const poiName = isPoi ? namedFeature : "";
        const name = poiName || text(p.name) || text(p.address_line1) || city || "Pinned location";
        const placeType = isPoi
            ? poiType(category, raw)
            : ["city", "town", "village"].includes(resultType)
              ? "place"
              : ["suburb", "district", "locality"].includes(resultType)
                ? "neighborhood"
                : resultType === "building"
                  ? "address"
                  : resultType === "island"
                    ? "region"
                    : resultType || "unknown";
        const code = text(p.country_code).toUpperCase();
        return [
            {
                id: `geoapify:${text(p.place_id) || `${p.lat},${p.lon}`}`,
                name,
                address: text(p.formatted) || name,
                latitude: p.lat,
                longitude: p.lon,
                placeType,
                context: [city, text(p.country)].filter(Boolean),
                country: text(p.country) || null,
                countryCode: toCountryCode(code),
                city: city || null,
                region: text(p.state) || text(p.region),
                area,
                poiName
            }
        ];
    });
}

function categoryIntent(query: string): string | null {
    const text = query
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    const categories: Record<string, string> = {
        cafe: "catering.cafe",
        cafes: "catering.cafe",
        coffee: "catering.cafe",
        restaurant: "catering.restaurant",
        restaurants: "catering.restaurant",
        bar: "catering.bar",
        bars: "catering.bar",
        pub: "catering.pub",
        pubs: "catering.pub",
        shopping: "commercial",
        shop: "commercial",
        shops: "commercial",
        mall: "commercial.shopping_mall",
        malls: "commercial.shopping_mall",
        "shopping mall": "commercial.shopping_mall",
        "shopping malls": "commercial.shopping_mall",
        hotel: "accommodation",
        hotels: "accommodation",
        museum: "entertainment.museum",
        museums: "entertainment.museum",
        beach: "beach",
        beaches: "beach",
        park: "leisure.park",
        parks: "leisure.park",
        attraction: "tourism",
        attractions: "tourism",
        landmark: "tourism.sights",
        landmarks: "tourism.sights",
        temple: "religion",
        temples: "religion",
        activity: "leisure,entertainment,sport,tourism",
        activities: "leisure,entertainment,sport,tourism"
    };
    return categories[text] ?? null;
}

export async function searchGeoapify(
    query: string,
    limit: number,
    key: string,
    country?: string,
    observe?: QuotaObserver,
    proximity?: { latitude: number; longitude: number },
    areasOnly = false
): Promise<DestinationResult[]> {
    const nearbyQuery = query.trim().replace(/\s+(?:near me|nearby)$/i, "");
    const named = nearbyQuery.match(/^([^:]+):\s*(.+)$/);
    const category = categoryIntent(nearbyQuery) ?? (named ? categoryIntent(named[1]!) : null);
    const namedPlace = named && category ? named[2]!.trim() : "";
    const intent = !areasOnly && proximity ? category : null;
    const url = new URL(
        proximity && intent ? "https://api.geoapify.com/v2/places" : "https://api.geoapify.com/v1/geocode/search"
    );
    if (proximity && intent) url.searchParams.set("categories", intent);
    else url.searchParams.set("text", query);
    if (intent && namedPlace) url.searchParams.set("name", namedPlace);
    if (proximity) url.searchParams.set("bias", `proximity:${proximity.longitude},${proximity.latitude}`);
    else url.searchParams.set("bias", "countrycode:none");
    url.searchParams.set("limit", String(limit));
    if (country) {
        const alpha2 = toAlpha2CountryCode(country);
        if (!alpha2) throw new Error("Unknown country code");
        url.searchParams.set("type", "city");
        url.searchParams.set("filter", `countrycode:${alpha2.toLowerCase()}`);
    }
    if (areasOnly) url.searchParams.set("type", "locality");
    const results = await request(url, key, observe);
    const selected = country
        ? results.filter(
              (place) => place.placeType === "place" && place.countryCode === toCountryCode(country) && place.city
          )
        : results;
    return selected.map((place) => ({
        id: place.id,
        name: place.name,
        address: place.address,
        latitude: place.latitude,
        longitude: place.longitude,
        placeType: place.placeType,
        context: place.context,
        country: place.country,
        countryCode: place.countryCode,
        city: place.city
    }));
}

export async function reverseGeoapify(
    latitude: number,
    longitude: number,
    key: string,
    observe?: QuotaObserver
): Promise<MapboxLocation> {
    const url = new URL("https://api.geoapify.com/v1/geocode/reverse");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("limit", "1");
    const [place] = await request(url, key, observe);
    if (!place) throw new Error("Geoapify returned no valid location");
    const areaNames = [place.area, place.city].filter((value): value is string => Boolean(value));
    const label =
        areaNames
            .filter(
                (value, index) =>
                    areaNames.findIndex((name) => name.toLocaleLowerCase() === value.toLocaleLowerCase()) === index
            )
            .join(", ") ||
        place.country ||
        "Photo location";
    return {
        id: place.id,
        label,
        detail: place.poiName,
        address: place.address,
        type: place.poiName ? place.placeType : place.area ? "neighborhood" : place.city ? "place" : "unknown",
        latitude,
        longitude,
        country: place.country,
        countryCode: place.countryCode,
        city: place.city
    };
}

// A close named POI is only a suggestion, never proof the user visited it.
export async function nearbyPhotoPlace(
    latitude: number,
    longitude: number,
    key: string,
    observe?: QuotaObserver
): Promise<MapboxLocation | null> {
    const url = new URL("https://api.geoapify.com/v2/places");
    url.searchParams.set(
        "categories",
        "tourism,catering,commercial,accommodation,leisure,entertainment,beach,religion,sport"
    );
    url.searchParams.set("filter", `circle:${longitude},${latitude},75`);
    url.searchParams.set("bias", `proximity:${longitude},${latitude}`);
    url.searchParams.set("limit", "5");
    const places = await request(url, key, observe);
    const place = places.find((item) => item.poiName);
    return place
        ? {
              id: place.id,
              label: place.poiName,
              detail: place.poiName,
              address: place.address,
              type: place.placeType,
              latitude,
              longitude,
              country: place.country,
              countryCode: place.countryCode,
              city: place.city
          }
        : null;
}

export async function reverseGeoapifyArea(
    latitude: number,
    longitude: number,
    type: "city" | "state",
    key: string,
    observe?: QuotaObserver
): Promise<DestinationResult | null> {
    const url = new URL("https://api.geoapify.com/v1/geocode/reverse");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("type", type);
    url.searchParams.set("limit", "1");
    const [place] = await request(url, key, observe);
    return place?.countryCode && ["place", "city", "state", "county", "region"].includes(place.placeType)
        ? place
        : null;
}

export async function resolvePhotoArea(latitude: number, longitude: number, key: string, observe?: QuotaObserver) {
    const url = new URL("https://api.geoapify.com/v1/geocode/reverse");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("limit", "1");
    const [place] = await request(url, key, observe);
    return place
        ? { city: place.city, region: place.region, country: place.country, countryCode: place.countryCode }
        : null;
}
export async function suggestPinName(
    latitude: number,
    longitude: number,
    key: string,
    run: <T>(operation: (observe?: QuotaObserver) => Promise<T>) => Promise<T>
): Promise<MapboxLocation | null> {
    const poi = await run((observe) => nearbyPhotoPlace(latitude, longitude, key, observe));
    if (poi) return poi;
    const place = await run((observe) => reverseGeoapify(latitude, longitude, key, observe));
    return place.detail || (place.type !== "unknown" && place.label !== place.country) ? place : null;
}
