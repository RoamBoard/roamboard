import { env } from "../../config/env.js";
import { AppError } from "../../shared/app-error.js";
import type { DestinationContextRequest } from "./destination.schemas.js";
import type { QuotaService } from "../quotas/quota.service.js";
import { fetchUnsplash, fetchWeather, fetchWikipedia, searchMapbox } from "./destination.providers.js";
import type { DestinationContext, DestinationResult } from "./destination.types.js";

export interface DestinationService {
  search(query: string, limit: number): Promise<DestinationResult[]>;
  context(input: DestinationContextRequest["query"]): Promise<DestinationContext>;
}

export function createDestinationService(quota: QuotaService): DestinationService {
  return {
    search: async (query, limit) => {
      const mapboxToken = env.MAPBOX_ACCESS_TOKEN;
      if (!mapboxToken) {
        throw new AppError(503, "Destination search is not configured on the API");
      }
      try {
        return await quota.run("mapbox.geocoding", () => searchMapbox(query, limit, mapboxToken));
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(502, "Mapbox rejected the destination search. Check the token and provider access.");
      }
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
      };
      const unavailable: string[] = [];
      const unsplashKey = env.UNSPLASH_ACCESS_KEY;
      const [weather, article, image] = await Promise.all([
        quota.run("open_meteo.forecast", () => fetchWeather(input.latitude, input.longitude)).catch(() => { unavailable.push("weather"); return undefined; }),
        quota.run("wikipedia.action_api", () => fetchWikipedia(input.name)).catch(() => { unavailable.push("description"); return undefined; }),
        unsplashKey
          ? quota.run("unsplash.requests", () => fetchUnsplash(input.name, unsplashKey)).catch(() => { unavailable.push("image"); return undefined; })
          : Promise.resolve(undefined).then(() => { unavailable.push("image"); return undefined; }),
      ]);
      return { destination, weather, article, image, unavailable };
    },
  };
}
