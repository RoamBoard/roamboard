import type { RequestHandler } from "express";

import type { DestinationContextRequest, DestinationSearchRequest } from "./destination.schemas.js";
import type { DestinationService } from "./destination.service.js";

export interface DestinationController {
  search: RequestHandler;
  context: RequestHandler;
}

export function createDestinationController(service: DestinationService): DestinationController {
  const search: RequestHandler = async (req, res) => {
    const { query } = req.validated as DestinationSearchRequest;
    res.json({ data: await service.search(query.q, query.limit) });
  };

  const context: RequestHandler = async (req, res) => {
    const { query } = req.validated as DestinationContextRequest;
    res.json({ data: await service.context(query) });
  };

  return { search, context };
}