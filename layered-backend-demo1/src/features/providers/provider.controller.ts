import type { RequestHandler } from "express";

import type { CloudinaryDeliveryRequest, CloudinaryMetadataRequest, MapboxRouteRequest, ProviderReverseRequest, ProviderSearchRequest } from "./provider.schemas.js";
import type { ProviderService } from "./provider.service.js";

export interface ProviderController {
  config: RequestHandler;
  mapboxSearch: RequestHandler;
  mapboxReverse: RequestHandler;
  mapboxRoute: RequestHandler;
  unsplashSearch: RequestHandler;
  googlePlacesSearch: RequestHandler;
  cloudinaryDelivery: RequestHandler;
  cloudinaryUpload: RequestHandler;
  cloudinaryAssets: RequestHandler;
  cloudinaryMetadata: RequestHandler;
}

export function createProviderController(service: ProviderService): ProviderController {
  const search = (operation: (query: string, limit: number) => Promise<unknown>): RequestHandler => async (req, res) => {
    const { query } = req.validated as ProviderSearchRequest;
    res.json({ data: await operation(query.q, query.limit) });
  };
  return {
    config: (_req, res) => res.json({ data: service.config() }),
    mapboxSearch: search(service.mapboxSearch),
    unsplashSearch: search(service.unsplashSearch),
    googlePlacesSearch: search(service.googlePlacesSearch),
    mapboxReverse: async (req, res) => {
      const { query } = req.validated as ProviderReverseRequest;
      res.json({ data: { address: await service.mapboxReverse(query.latitude, query.longitude) } });
    },
    mapboxRoute: async (req, res) => {
      const { body } = req.validated as MapboxRouteRequest;
      res.json({ data: await service.mapboxRoute(body.points, body.profile) });
    },
    cloudinaryDelivery: (req, res) => {
      const { query } = req.validated as CloudinaryDeliveryRequest;
      res.json({ data: { url: service.cloudinaryDelivery(query.publicId, query.width, query.height, query.crop) } });
    },
    cloudinaryUpload: async (req, res) => {
      if (!req.file) {
        res.status(400).json({ error: { message: "Choose an image to upload in the file field." } });
        return;
      }
      res.status(201).json({ data: await service.cloudinaryUpload(req.file) });
    },
    cloudinaryAssets: async (_req, res) => {
      res.json({ data: await service.cloudinaryAssets() });
    },
    cloudinaryMetadata: async (req, res) => {
      const { query } = req.validated as CloudinaryMetadataRequest;
      res.json({ data: { publicId: query.publicId, metadata: await service.cloudinaryMetadata(query.publicId) } });
    },
  };
}
