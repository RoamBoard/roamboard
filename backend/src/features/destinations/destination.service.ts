import { AppError } from "../../shared/app-error.js";
import type {
    DestinationContextRequest,
    DestinationGuideQuery,
    MatchPlaceInput,
    PlaceDetailsQuery
} from "./destination.schemas.js";
import type { QuotaService } from "../quotas/quota.service.js";
import { fetchUnsplash, fetchWeather, fetchWikipedia, searchMapbox } from "./destination.providers.js";
import type {
    DestinationContext,
    DestinationResult,
    DestinationGuide,
    GuideArticle,
    GuideDestination,
    GuidePlace,
    DestinationRepository,
    CityTip,
    PlaceDetails
} from "./destination.types.js";
import type { ProviderPhoto } from "../providers/provider.types.js";
import type { QuotaObserver } from "../quotas/quota.types.js";
import { countryName } from "../../shared/countries.js";

const env = process.env;

export interface DestinationGuideDependencies {
    repository: DestinationRepository;
    providers: {
        article(destination: GuideDestination, observe?: QuotaObserver): Promise<GuideArticle | null>;
        images(query: string, accessKey: string, observe?: QuotaObserver): Promise<ProviderPhoto[]>;
        places(destination: GuideDestination, observe?: QuotaObserver): Promise<GuidePlace[]>;
        cityTip(destination: GuideDestination, observe?: QuotaObserver): Promise<CityTip | null>;
        placeDetails(place: GuidePlace, observe?: QuotaObserver): Promise<PlaceDetails>;
        matchPlace(
            input: MatchPlaceInput,
            token: string,
            observe?: QuotaObserver
        ): Promise<{ latitude: number; longitude: number } | null>;
    };
    now?: () => number;
}

export interface DestinationService {
    search(query: string, limit: number): Promise<DestinationResult[]>;
    context(input: DestinationContextRequest["query"]): Promise<DestinationContext>;
    guide(input: DestinationGuideQuery): Promise<DestinationGuide>;
    placeDetails(input: PlaceDetailsQuery): Promise<PlaceDetails>;
    matchPlace(input: MatchPlaceInput): Promise<{ latitude: number; longitude: number } | null>;
}

export function createDestinationService(
    quota: QuotaService,
    dependencies: DestinationGuideDependencies
): DestinationService {
    type Entry<T> = { expiresAt: number; result: Promise<T> };
    const articles = new Map<string, Entry<GuideArticle | null>>();
    const images = new Map<string, Entry<ProviderPhoto[]>>();
    const sights = new Map<string, Entry<GuidePlace[]>>();
    const tips = new Map<string, Entry<CityTip | null>>();
    const details = new Map<string, Entry<PlaceDetails>>();
    const now = dependencies.now ?? Date.now;
    // Store the pending request too, so simultaneous readers share one provider call.
    // Start the one-hour lifetime after success; remove failures so Retry makes a new request.
    function cached<T>(cache: Map<string, Entry<T>>, key: string, load: () => Promise<T>): Promise<T> {
        const previous = cache.get(key);
        if (previous && previous.expiresAt > now()) return previous.result;
        cache.delete(key);
        if (cache.size >= 64) cache.delete(cache.keys().next().value!);
        const entry: Entry<T> = { expiresAt: Infinity, result: Promise.resolve().then(load) };
        entry.result = entry.result
            .then((value) => {
                entry.expiresAt = now() + 3_600_000;
                return value;
            })
            .catch((error: unknown) => {
                if (cache.get(key) === entry) cache.delete(key);
                throw error;
            });
        cache.set(key, entry);
        return entry.result;
    }
    function identity(input: Pick<DestinationGuideQuery, "name" | "country" | "latitude" | "longitude">) {
        return {
            destination: {
                name: input.name,
                country: countryName(input.country),
                countryCode: input.country,
                latitude: input.latitude,
                longitude: input.longitude
            },
            key: JSON.stringify([input.name.toLowerCase(), input.country, input.latitude, input.longitude])
        };
    }
    function readSights(destination: GuideDestination, key: string) {
        return cached(sights, key, () =>
            quota.run("wikipedia.action_api", (observe) => dependencies.providers.places(destination, observe))
        );
    }
    return {
        placeDetails: async (input) => {
            const { destination, key } = identity(input);
            let places: GuidePlace[];
            try {
                places = await readSights(destination, key);
            } catch (error) {
                if (error instanceof AppError) throw error;
                throw new AppError(
                    502,
                    "Travel-guide sights could not be loaded. Please try again.",
                    "PROVIDER_FAILED"
                );
            }
            const place = places.find((item) => item.id === input.placeId);
            if (!place) throw new AppError(404, "This sight is not in the selected city guide.", "NOT_FOUND");
            const cacheKey = `${key}:${place.id}`;
            try {
                const result = await cached(details, cacheKey, () =>
                    quota.run("wikipedia.action_api", (observe) => dependencies.providers.placeDetails(place, observe))
                );
                // Partial failures stay retryable instead of becoming a one-hour empty result.
                if (result.unavailable.length) details.delete(cacheKey);
                return result;
            } catch (error) {
                if (error instanceof AppError) throw error;
                throw new AppError(
                    502,
                    "This sight's details could not be loaded. Please try again.",
                    "PROVIDER_FAILED"
                );
            }
        },
        matchPlace: async (input) => {
            const token = env.MAPBOX_ACCESS_TOKEN;
            if (!token) return null;
            try {
                return await quota.run("mapbox.search_box", (observe) =>
                    dependencies.providers.matchPlace(input, token, observe)
                );
            } catch (error) {
                if (error instanceof AppError) throw error;
                throw new AppError(
                    502,
                    "Mapbox could not match this sight. The travel-guide location is still available.",
                    "PROVIDER_FAILED"
                );
            }
        },
        search: async (query, limit) => {
            const mapboxToken = env.MAPBOX_ACCESS_TOKEN;
            if (!mapboxToken) {
                throw new AppError(503, "Destination search is not configured on the API", "PROVIDER_UNAVAILABLE");
            }
            try {
                return await quota.run("mapbox.geocoding", (observe) =>
                    searchMapbox(query, limit, mapboxToken, observe)
                );
            } catch (error) {
                if (error instanceof AppError) throw error;
                throw new AppError(
                    502,
                    "Mapbox rejected the destination search. Check the token and provider access.",
                    "PROVIDER_FAILED"
                );
            }
        },
        guide: async (input) => {
            const { destination, key } = identity(input);
            const [article, photos, boards, places, cityTip] = await Promise.allSettled([
                cached(articles, key, () =>
                    quota.run("wikipedia.action_api", (observe) => dependencies.providers.article(destination, observe))
                ),
                cached(images, key, () => {
                    const accessKey = env.UNSPLASH_ACCESS_KEY;
                    if (!accessKey) throw new Error("Unsplash is not configured");
                    return quota.run("unsplash.requests", (observe) =>
                        dependencies.providers.images(`${input.name} ${destination.country}`, accessKey, observe)
                    );
                }),
                dependencies.repository.listPublic(input),
                readSights(destination, key),
                cached(tips, key, () =>
                    quota.run("wikipedia.action_api", (observe) => dependencies.providers.cityTip(destination, observe))
                )
            ]);
            const unavailable: DestinationGuide["unavailable"] = [];
            if (article.status === "rejected") unavailable.push("description");
            if (photos.status === "rejected") unavailable.push("images");
            if (boards.status === "rejected") unavailable.push("boards");
            if (places.status === "rejected") unavailable.push("places");
            if (cityTip.status === "rejected") unavailable.push("cityTip");
            const selected: ProviderPhoto[] = [];
            const ids = new Set<string>();
            const urls = new Set<string>();
            for (const photo of photos.status === "fulfilled" ? photos.value : []) {
                let identity: string;
                try {
                    const url = new URL(photo.url);
                    if (url.protocol !== "https:" || photo.height <= 0 || photo.width <= photo.height) continue;
                    identity = `${url.origin}${url.pathname}`;
                } catch {
                    continue;
                }
                if (!photo.id || ids.has(photo.id) || urls.has(identity)) continue;
                ids.add(photo.id);
                urls.add(identity);
                selected.push(photo);
                if (selected.length === 2) break;
            }
            return {
                destination,
                cityTip: cityTip.status === "fulfilled" ? cityTip.value : null,
                article: article.status === "fulfilled" ? article.value : null,
                images: selected,
                places: places.status === "fulfilled" ? places.value : [],
                boards: boards.status === "fulfilled" ? boards.value.boards : [],
                page: input.page,
                hasMore: boards.status === "fulfilled" ? boards.value.hasMore : false,
                unavailable
            };
        },
        context: async (input) => {
            const destination: DestinationResult = {
                id: input.id,
                name: input.name,
                address: input.address,
                latitude: input.latitude,
                longitude: input.longitude,
                placeType: input.placeType,
                context: [],
                country: null,
                countryCode: null,
                city: null
            };
            const unavailable: string[] = [];
            const unsplashKey = env.UNSPLASH_ACCESS_KEY;
            const [weather, article, image] = await Promise.all([
                quota
                    .run("open_meteo.forecast", (observe) => fetchWeather(input.latitude, input.longitude, observe))
                    .catch(() => {
                        unavailable.push("weather");
                        return undefined;
                    }),
                quota
                    .run("wikipedia.action_api", (observe) => fetchWikipedia(input.name, observe))
                    .catch(() => {
                        unavailable.push("description");
                        return undefined;
                    }),
                unsplashKey
                    ? quota
                          .run("unsplash.requests", (observe) => fetchUnsplash(input.name, unsplashKey, observe))
                          .catch(() => {
                              unavailable.push("image");
                              return undefined;
                          })
                    : Promise.resolve(undefined).then(() => {
                          unavailable.push("image");
                          return undefined;
                      })
            ]);
            return { destination, weather, article, image, unavailable };
        }
    };
}
