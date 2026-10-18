import type { RequestHandler } from "express";
import type { DestinationService } from "./destination.service.js";
import type {
    DestinationContextRequest,
    DestinationSearchRequest,
    DestinationGuideQuery,
    PlaceDetailsQuery
} from "./destination.schemas.js";

export function createDestinationController(service: DestinationService): {
    search: RequestHandler;
    context: RequestHandler;
    guide: RequestHandler;
    placeDetails: RequestHandler;
    matchPlace: RequestHandler;
} {
    return {
        placeDetails: async (_request, response) => {
            response.set("Cache-Control", "no-store");
            response.json({ data: await service.placeDetails(response.locals.query as PlaceDetailsQuery) });
        },
        matchPlace: async (request, response) => {
            response.set("Cache-Control", "no-store");
            response.json({ data: await service.matchPlace(request.body) });
        },
        guide: async (_request, response) => {
            response.set("Cache-Control", "no-store");
            response.json({ data: await service.guide(response.locals.query as DestinationGuideQuery) });
        },
        search: async (_request, response) => {
            const query = response.locals.query as DestinationSearchRequest["query"];
            response.json({ data: await service.search(query.q, query.limit) });
        },
        context: async (_request, response) => {
            response.json({ data: await service.context(response.locals.query as DestinationContextRequest["query"]) });
        }
    };
}
