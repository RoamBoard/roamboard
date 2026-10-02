import type { RequestHandler } from "express";

import type { BoardDestinationSearchRequest, CloudinaryDeliveryRequest, CloudinaryMetadataRequest, DeleteGooglePlaceRequest, GooglePlaceDetailsRequest, MapboxRouteRequest, ProviderReverseRequest, ProviderSearchRequest, SaveGooglePlaceRequest } from "./provider.schemas.js";
import type { ProviderService } from "./provider.service.js";

export interface ProviderController {
  config: RequestHandler;
  mapboxMapSession: RequestHandler;
  mapboxSearch: RequestHandler;
  mapboxDestinationSearch: RequestHandler;
  mapboxReverse: RequestHandler;
  mapboxRoute: RequestHandler;
  unsplashSearch: RequestHandler;
  googlePlacesSearch: RequestHandler;
  googlePlaceDetails: RequestHandler;
  saveGooglePlace: RequestHandler;
  savedGooglePlaces: RequestHandler;
  deleteSavedGooglePlace: RequestHandler;
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
    mapboxMapSession: async (_req, res) => res.json({ data: await service.mapboxMapSession() }),
    mapboxSearch: search(service.mapboxSearch),
    mapboxDestinationSearch: async (req, res) => {
      const { query } = req.validated as BoardDestinationSearchRequest;
      res.json({ data: await service.mapboxDestinationSearch(query.country, query.city, query.limit) });
    },
    unsplashSearch: search(service.unsplashSearch),
    googlePlacesSearch: search(service.googlePlacesSearch),
    googlePlaceDetails: async (req, res) => {
      const { params } = req.validated as GooglePlaceDetailsRequest;
      res.json({ data: await service.googlePlaceDetails(params.placeId) });
    },
    saveGooglePlace: async (req, res) => {
      const { body } = req.validated as SaveGooglePlaceRequest;
      res.status(201).json({ data: await service.saveGooglePlace(body.placeId) });
    },
    savedGooglePlaces: async (_req, res) => res.json({ data: await service.savedGooglePlaces() }),
    deleteSavedGooglePlace: async (req, res) => {
      const { params } = req.validated as DeleteGooglePlaceRequest;
      await service.deleteSavedGooglePlace(params.placeId);
      res.status(204).send();
    },
    mapboxReverse: async (req, res) => {
      const { query } = req.validated as ProviderReverseRequest;
      res.json({ data: await service.mapboxReverse(query.latitude, query.longitude) });
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
