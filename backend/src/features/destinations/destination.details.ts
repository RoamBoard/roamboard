import { guideNameMatches, distanceKm, guideExcerpt } from "./destination.providers.js";
import { plain } from "./destination.sights.js";
import { observeProviderResponse } from "../quotas/quota.feedback.js";
import type { QuotaObserver } from "../quotas/quota.types.js";
import type { CityTip, GuideDestination, GuidePlace, PlaceDetails } from "./destination.types.js";

type Page = {
    pageid: number;
    title: string;
    extract?: string;
    coordinates?: Array<{ lat: number; lon: number; primary?: boolean | string; globe?: string }>;
    pageprops?: { disambiguation?: string };
    mapdata?: string[];
    pageimage?: string;
    imageinfo?: Array<{
        mime: string;
        width: number;
        height: number;
        url: string;
        descriptionurl: string;
        thumburl?: string;
        thumbwidth?: number;
        thumbheight?: number;
        extmetadata?: Record<string, { value: string }>;
    }>;
};
type WikimediaResponse = { error?: unknown; query?: { pages?: Page[] } };
type Listing = { properties?: { title?: string; description?: string } };

function listingFor(page: Page, place: GuidePlace, group: "see" | "city") {
    return (page.mapdata ?? [])
        .flatMap((encoded) => (JSON.parse(encoded) as Record<string, Listing[]>)[group] ?? [])
        .find(
            (item) =>
                plain(item.properties?.title).normalize("NFC").toLowerCase() ===
                place.name.normalize("NFC").toLowerCase()
        );
}

function linkedCityTitle(listing?: Listing): string | undefined {
    const path = listing?.properties?.title?.match(/href=["']\/wiki\/([^"'?#]+)(?:#[^"']*)?["']/i)?.[1];
    if (!path) return;
    try {
        const title = decodeURIComponent(plain(path)).replace(/_/g, " ").trim();
        // Only a city article linked by the selected marker is eligible. Never fetch a supplied URL.
        if (title && title.length <= 250 && !title.includes(":")) return title;
    } catch {
        return;
    }
}

function listingDescription(
    page: Page,
    place: GuidePlace,
    listing: Listing | undefined,
    kind?: "country"
): string | null {
    const isCity = kind === "country";
    const text = isCity
        ? page.extract
              ?.split(/^={2,}\s*(?:Cities(?: and towns)?|Towns)\s*={2,}\s*$/im)[1]
              ?.split(/^={2,}[^=].*={2,}\s*$/m)[0]
        : page.extract;
    const name = place.name.normalize("NFC").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = isCity
        ? `^(?:(?:\\d+[.)]?|[\u2022*])\\s+)?${name}(?:\\s*\\([^)]*\\))?(?=\\s*[-\u2013\u2014.,:]|\\s*$)`
        : `^(?:\\d+\\s+)?${name}(?=\\s*[.,(]|\\s*$)`;
    const prefix = new RegExp(pattern, "iu");
    const line = text
        ?.normalize("NFC")
        .split(/\n/)
        .find((value) => prefix.test(value.trim()));
    const description = line
        ? line
              .trim()
              .replace(prefix, "")
              .replace(isCity ? /^[\s.,:\u2014\u2013-]+/ : /^[\s.,]+/, "")
        : isCity
          ? plain(listing?.properties?.description)
          : "";
    return guideExcerpt(isCity ? description : description.replace(/\s*\(updated [^)]*\)/g, ""), 2, 60) || null;
}
// TextExtracts already supplies plain text, including numbered listings. No HTML parser is needed.
export function createWikivoyageDetails(reserveAdditional: () => Promise<void>) {
    const pages = new Map<number, { page: Page; expiresAt: number }>();
    const photos = new Map<string, { image: PlaceDetails["image"]; expiresAt: number }>();
    const requests = new Map<string, Promise<WikimediaResponse>>();
    async function read(url: URL, observe?: QuotaObserver, additional = false): Promise<WikimediaResponse> {
        const key = url.toString();
        const previous = requests.get(key);
        if (previous) return previous;
        const request = (async () => {
            if (additional) await reserveAdditional();
            const response = await fetch(url, {
                headers: {
                    "User-Agent": "Roamboard/1.0 (https://github.com/RoamBoard/roamboard; student travel project)"
                },
                signal: AbortSignal.timeout(8_000)
            });
            await observeProviderResponse(response, observe);
            if (!response.ok) throw new Error(`Wikimedia returned ${response.status}`);
            const body = (await response.json()) as WikimediaResponse;
            if (body.error) throw new Error("Wikimedia could not load this guide content");
            return body;
        })();
        requests.set(key, request);
        try {
            return await request;
        } finally {
            requests.delete(key);
        }
    }
    function remember<K, V>(cache: Map<K, V>, key: K, value: V) {
        if (cache.size >= 64) cache.delete(cache.keys().next().value!);
        cache.set(key, value);
    }
    async function readPages(
        parameters: Record<string, string>,
        observe?: QuotaObserver,
        additional = false
    ): Promise<Page[]> {
        const url = new URL("https://en.wikivoyage.org/w/api.php");
        for (const [key, value] of Object.entries({
            action: "query",
            prop: "extracts|coordinates|mapdata",
            explaintext: "1",
            exsectionformat: "wiki",
            exlimit: "1",
            mpdgroups: "see|city",
            coprimary: "primary",
            format: "json",
            formatversion: "2",
            ...parameters
        }))
            url.searchParams.set(key, value);
        const body = await read(url, observe, additional);
        const result: Page[] = body.query?.pages ?? [];
        for (const page of result)
            // An intro-only fallback must not replace the full page used for tips and sight details.
            if (page.pageid > 0 && typeof page.extract === "string" && parameters.exintro !== "1")
                remember(pages, page.pageid, { page, expiresAt: Date.now() + 3_600_000 });
        return result;
    }
    async function imageFor(
        filename: string | undefined,
        name: string,
        observe?: QuotaObserver
    ): Promise<PlaceDetails["image"]> {
        if (!filename) return null;
        let decoded: string;
        try {
            decoded = decodeURIComponent(plain(filename));
        } catch {
            return null;
        }
        const title = decoded.startsWith("File:") ? decoded : `File:${decoded}`;
        const previous = photos.get(title);
        if (previous && previous.expiresAt > Date.now()) return previous.image;
        const url = new URL("https://commons.wikimedia.org/w/api.php");
        for (const [key, value] of Object.entries({
            action: "query",
            prop: "imageinfo",
            titles: title,
            iiprop: "url|size|mime|extmetadata",
            iiurlwidth: "1200",
            format: "json",
            formatversion: "2"
        }))
            url.searchParams.set(key, value);
        const body = await read(url, observe, true);
        const info = body.query?.pages?.[0]?.imageinfo?.[0];
        const metadata = info?.extmetadata;
        const author = plain(metadata?.Artist?.value);
        const licenseName = plain(metadata?.LicenseShortName?.value);
        // Commons still returns some official Creative Commons license links over HTTP.
        const licenseUrl = plain(metadata?.LicenseUrl?.value).replace(
            /^http:\/\/((?:www\.)?creativecommons\.org)\//i,
            "https://$1/"
        );
        const imageUrl = info?.thumburl ?? info?.url;
        const supportedFormat = /^image\/(jpeg|png|webp)$/.test(info?.mime ?? "");
        const largeEnough = info && Math.max(info.width, info.height) >= 800;
        const hasCredits = author && licenseName && /^https:\/\//.test(licenseUrl);
        const commonsUrl = /^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(imageUrl ?? "");
        // Keep a placeholder when the source photo is too small or cannot be credited.
        let image: PlaceDetails["image"] = null;
        const sourceUrl = /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(info?.descriptionurl ?? "");
        if (info && imageUrl && supportedFormat && largeEnough && hasCredits && commonsUrl && sourceUrl) {
            image = {
                url: imageUrl,
                alt: name,
                width: info.thumbwidth ?? info.width,
                height: info.thumbheight ?? info.height,
                author,
                sourceUrl: info.descriptionurl,
                licenseName,
                licenseUrl
            };
        }
        remember(photos, title, { image, expiresAt: Date.now() + 3_600_000 });
        return image;
    }
    return {
        async cityTip(destination: GuideDestination, observe?: QuotaObserver): Promise<CityTip | null> {
            const candidates = await readPages(
                {
                    generator: "search",
                    gsrsearch:
                        destination.kind === "country"
                            ? destination.name
                            : `${destination.name} ${destination.country}`,
                    gsrnamespace: "0",
                    gsrlimit: "10",
                    colimit: "10",
                    prop: "coordinates|pageprops",
                    ppprop: "disambiguation"
                },
                observe
            );
            // Same-name cities can exist in different countries. Use the closest matching city page.
            let match: Page | undefined;
            let closestDistance = Infinity;
            for (const candidate of candidates) {
                if (!guideNameMatches(candidate.title, destination)) continue;
                if (Object.hasOwn(candidate.pageprops ?? {}, "disambiguation")) continue;
                const point = candidate.coordinates?.find(
                    (coordinate) =>
                        (coordinate.primary === true || coordinate.primary === "") &&
                        (!coordinate.globe || coordinate.globe === "earth")
                );
                if (!point && destination.kind !== "country") continue;
                const distance = point
                    ? distanceKm(point.lat, point.lon, destination.latitude, destination.longitude)
                    : 0;
                if ((destination.kind === "country" || distance <= 50) && distance < closestDistance) {
                    match = candidate;
                    closestDistance = distance;
                }
            }
            if (!match) return null;
            // Full extracts are limited to one page. Search first, then read the matched page by ID.
            const cached = pages.get(match.pageid);
            const page =
                cached && cached.expiresAt > Date.now()
                    ? cached.page
                    : (await readPages({ pageids: String(match.pageid) }, observe, true))[0];
            if (!page?.extract) return null;
            const heading = /^==\s*Get around\s*==\s*$/m.exec(page.extract);
            if (!heading) return null;
            const section = page.extract.slice(heading.index + heading[0].length).split(/^==[^=].*==\s*$/m)[0] ?? "";
            const paragraphs = section
                .split(/\n+/)
                .map((line) => line.trim())
                .filter((line) => !line.startsWith("=") && line.split(/\s+/).length >= 8);
            // Prefer advice that will not become a stale fare quote.
            const paragraph = paragraphs.find((line) => !/[¥$€£]/.test(line)) ?? paragraphs[0];
            return paragraph
                ? {
                      title: "Getting around",
                      text: guideExcerpt(paragraph, 2, 40),
                      url: `https://en.wikivoyage.org/?curid=${page.pageid}#Get_around`
                  }
                : null;
        },
        async placeDetails(place: GuidePlace, observe?: QuotaObserver, kind?: "country"): Promise<PlaceDetails> {
            const pageId = Number(/^wikivoyage:(\d+):/.exec(place.id)?.[1]);
            const result: PlaceDetails = {
                placeId: place.id,
                description: null,
                sourceUrl: `https://en.wikivoyage.org/?curid=${pageId}#${kind === "country" ? "Cities" : encodeURIComponent(place.name.replace(/ /g, "_"))}`,
                image: null,
                unavailable: []
            };
            const previous = pages.get(pageId);
            let page: Page | undefined;
            try {
                page =
                    previous && previous.expiresAt > Date.now()
                        ? previous.page
                        : (await readPages({ pageids: String(pageId) }, observe))[0];
            } catch {
                return { ...result, unavailable: ["description", "image"] };
            }
            if (!page) return result;
            let listing: Listing | undefined;
            try {
                listing = listingFor(page, place, kind === "country" ? "city" : "see");
            } catch {
                result.unavailable.push("image");
            }
            result.description = listingDescription(page, place, listing, kind);
            const loadImage = (filename?: string) =>
                imageFor(filename, place.name, observe).catch(() => {
                    result.unavailable.push("image");
                    return null;
                });
            result.image = await loadImage(
                listing?.properties?.description?.match(/href=["']\/wiki\/(File:[^"']+)["']/)?.[1]
            );
            const cityTitle = kind === "country" ? linkedCityTitle(listing) : undefined;
            const needsImage = !result.image && !result.unavailable.includes("image");
            if (!cityTitle || (result.description && !needsImage)) return result;
            const article = (
                await readPages(
                    {
                        titles: cityTitle,
                        redirects: "1",
                        prop: "extracts|pageimages|pageprops",
                        piprop: "name",
                        ppprop: "disambiguation",
                        exintro: "1"
                    },
                    observe,
                    true
                ).catch(() => {
                    if (!result.description) result.unavailable.push("description");
                    if (needsImage) result.unavailable.push("image");
                    return [];
                })
            )[0];
            if (!article || !(article.pageid > 0) || Object.hasOwn(article.pageprops ?? {}, "disambiguation"))
                return result;
            if (!result.description && article.extract) {
                result.description = guideExcerpt(plain(article.extract), 2, 60) || null;
                if (result.description) result.sourceUrl = `https://en.wikivoyage.org/?curid=${article.pageid}`;
            }
            if (needsImage && article.pageimage) result.image = await loadImage(article.pageimage);
            return result;
        }
    };
}
