import { env } from "../../config/env.js";
import { AppError } from "../../shared/app-error.js";
import type { DestinationContextRequest } from "./destination.schemas.js";
import { fetchUnsplash, fetchWeather, fetchWikipedia, searchMapbox } from "./destination.providers.js";
import type { DestinationContext, DestinationResult } from "./destination.types.js";

export interface DestinationService {
  search(query: string, limit: number): Promise<DestinationResult[]>;
  context(input: DestinationContextRequest["query"]): Promise<DestinationContext>;
}

export function createDestinationService(): DestinationService {
  return {
    search: async (query, limit) => {
      if (!env.MAPBOX_ACCESS_TOKEN) {
        throw new AppError(503, "Destination search is not configured on the API");
      }
      try {
        return await searchMapbox(query, limit, env.MAPBOX_ACCESS_TOKEN);
      } catch {
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
      const [weather, article, image] = await Promise.all([
        fetchWeather(input.latitude, input.longitude).catch(() => { unavailable.push("weather"); return undefined; }),
        fetchWikipedia(input.name).catch(() => { unavailable.push("description"); return undefined; }),
        env.UNSPLASH_ACCESS_KEY
          ? fetchUnsplash(input.name, env.UNSPLASH_ACCESS_KEY).catch(() => { unavailable.push("image"); return undefined; })
          : Promise.resolve(undefined).then(() => { unavailable.push("image"); return undefined; }),
      ]);
      return { destination, weather, article, image, unavailable };
    },
  };
}