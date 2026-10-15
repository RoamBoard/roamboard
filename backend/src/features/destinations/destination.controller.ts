import type { RequestHandler } from "express";
import type { DestinationService } from "./destination.service.js";
import type { DestinationContextRequest, DestinationSearchRequest } from "./destination.schemas.js";

export function createDestinationController(service: DestinationService): {
    search: RequestHandler;
    context: RequestHandler;
} {
    return {
        search: async (_request, response) => {
            const query = response.locals.query as DestinationSearchRequest["query"];
            response.json({ data: await service.search(query.q, query.limit) });
        },
        context: async (_request, response) => {
            response.json({ data: await service.context(response.locals.query as DestinationContextRequest["query"]) });
        }
    };
}
