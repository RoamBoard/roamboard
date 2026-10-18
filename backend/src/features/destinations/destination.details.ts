import { cityName, distanceKm, guideExcerpt } from "./destination.providers.js";
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
            mpdgroups: "see",
            coprimary: "primary",
            format: "json",
            formatversion: "2",
            ...parameters
        }))
            url.searchParams.set(key, value);
        const body = await read(url, observe, additional);
        const result: Page[] = body.query?.pages ?? [];
        for (const page of result)
            if (page.pageid > 0 && typeof page.extract === "string")
                remember(pages, page.pageid, { page, expiresAt: Date.now() + 3_600_000 });
        return result;
    }
    async function imageFor(page: Page, place: GuidePlace, observe?: QuotaObserver): Promise<PlaceDetails["image"]> {
        // Only use a file attached to this exact listing, never a general city image search.
        const listing = (page.mapdata ?? [])
            .flatMap((encoded) => (JSON.parse(encoded) as { see?: Listing[] }).see ?? [])
            .find(
                (item) =>
                    plain(item.properties?.title).normalize("NFC").toLowerCase() ===
                    place.name.normalize("NFC").toLowerCase()
            );
        const filename = listing?.properties?.description?.match(/href=["']\/wiki\/(File:[^"']+)["']/)?.[1];
        if (!filename) return null;
        const title = decodeURIComponent(plain(filename));
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
        const licenseUrl = plain(metadata?.LicenseUrl?.value);
        const imageUrl = info?.thumburl ?? info?.url;
        const supportedFormat = /^image\/(jpeg|png|webp)$/.test(info?.mime ?? "");
        const largeEnough = info && Math.max(info.width, info.height) >= 800;
        const hasCredits = author && licenseName && /^https:\/\//.test(licenseUrl);
        const commonsUrl = /^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(imageUrl ?? "");
        // Keep a placeholder when the source photo is too small or cannot be credited.
        let image: PlaceDetails["image"] = null;
        if (info && imageUrl && supportedFormat && largeEnough && hasCredits && commonsUrl) {
            image = {
                url: imageUrl,
                alt: place.name,
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
                    gsrsearch: `${destination.name} ${destination.country}`,
                    gsrnamespace: "0",
                    gsrlimit: "5",
                    prop: "coordinates|pageprops",
                    ppprop: "disambiguation"
                },
                observe
            );
            // Same-name cities can exist in different countries. Use the closest matching city page.
            let match: Page | undefined;
            let closestDistance = Infinity;
            for (const candidate of candidates) {
                if (cityName(candidate.title) !== cityName(destination.name)) continue;
                if (Object.hasOwn(candidate.pageprops ?? {}, "disambiguation")) continue;
                const point = candidate.coordinates?.find(
                    (coordinate) =>
                        (coordinate.primary === true || coordinate.primary === "") &&
                        (!coordinate.globe || coordinate.globe === "earth")
                );
                if (!point) continue;
                const distance = distanceKm(point.lat, point.lon, destination.latitude, destination.longitude);
                if (distance <= 50 && distance < closestDistance) {
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
        async placeDetails(place: GuidePlace, observe?: QuotaObserver): Promise<PlaceDetails> {
            const pageId = Number(/^wikivoyage:(\d+):/.exec(place.id)?.[1]);
            const sourceUrl = `https://en.wikivoyage.org/?curid=${pageId}#${encodeURIComponent(place.name.replace(/ /g, "_"))}`;
            const result: PlaceDetails = {
                placeId: place.id,
                description: null,
                sourceUrl,
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
                result.unavailable = ["description", "image"];
                return result;
            }
            if (!page) return result;
            const name = place.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const prefix = new RegExp(`^(?:\\d+\\s+)?${name}(?=\\s*[.,(]|\\s*$)`, "iu");
            const line = page.extract?.split(/\n/).find((value) => prefix.test(value.trim()));
            if (line)
                result.description =
                    guideExcerpt(
                        line
                            .trim()
                            .replace(prefix, "")
                            .replace(/^[\s.,]+/, "")
                            .replace(/\s*\(updated [^)]*\)/g, ""),
                        2,
                        60
                    ) || null;
            try {
                result.image = await imageFor(page, place, observe);
            } catch {
                result.unavailable.push("image");
            }
            return result;
        }
    };
}
