import type { ActivityPhotoRequest } from "./provider.schemas.js";
import type { RequestHandler } from "express";

import type {
    BoardDestinationSearchRequest,
    BoardLocationSearchRequest,
    CloudinaryDeliveryRequest,
    CloudinaryMetadataRequest,
    DeleteGooglePlaceRequest,
    GooglePlaceDetailsRequest,
    MapboxRouteRequest,
    ProviderReverseRequest,
    ProviderSearchRequest,
    SaveGooglePlaceRequest
} from "./provider.schemas.js";
import type { ProviderService } from "./provider.service.js";

export interface ProviderController {
    config: RequestHandler;
    mapboxMapSession: RequestHandler;
    mapboxSearch: RequestHandler;
    mapboxBoardSearch: RequestHandler;
    boardAreaSearch: RequestHandler;
    suggestBoardArea: RequestHandler;
    mapboxDestinationSearch: RequestHandler;
    mapboxReverse: RequestHandler;
    mapboxBoardReverse: RequestHandler;
    mapboxRoute: RequestHandler;
    unsplashSearch: RequestHandler;
    unsplashActivityPhoto: RequestHandler;
    selectActivityPhoto: RequestHandler;
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
    const search =
        (operation: (query: string, limit: number) => Promise<unknown>): RequestHandler =>
        async (req, res) => {
            const query = res.locals.query as ProviderSearchRequest;
            res.json({ data: await operation(query.q, query.limit) });
        };
    return {
        config: (_req, res) => res.json({ data: service.config() }),
        mapboxMapSession: async (_req, res) => res.json({ data: await service.mapboxMapSession() }),
        mapboxSearch: search(service.mapboxSearch),
        suggestBoardArea: async (req, res) => res.json({ data: await service.suggestBoardArea(req.body) }),
        boardAreaSearch: search(service.boardAreaSearch),
        mapboxBoardSearch: async (_request, response) => {
            const query = response.locals.query as BoardLocationSearchRequest;
            response.json({
                data: await service.mapboxBoardSearch(
                    query.q,
                    query.limit,
                    query.latitude === undefined ? undefined : { latitude: query.latitude, longitude: query.longitude! }
                )
            });
        },
        mapboxDestinationSearch: async (req, res) => {
            const query = res.locals.query as BoardDestinationSearchRequest;
            res.json({ data: await service.mapboxDestinationSearch(query.country, query.city, query.limit) });
        },
        unsplashSearch: search(service.unsplashSearch),
        unsplashActivityPhoto: async (_req, res) =>
            res.json({ data: await service.unsplashActivityPhoto(res.locals.query as ActivityPhotoRequest) }),
        selectActivityPhoto: async (req, res) =>
            res.json({ data: await service.unsplashActivityPhoto(req.body as ActivityPhotoRequest, true) }),
        googlePlacesSearch: search(service.googlePlacesSearch),
        googlePlaceDetails: async (req, res) => {
            const params = res.locals.params as GooglePlaceDetailsRequest;
            res.json({ data: await service.googlePlaceDetails(params.placeId) });
        },
        saveGooglePlace: async (req, res) => {
            const body = req.body as SaveGooglePlaceRequest;
            res.status(201).json({ data: await service.saveGooglePlace(res.locals.user.userId, body.placeId) });
        },
        savedGooglePlaces: async (_req, res) =>
            res.json({ data: await service.savedGooglePlaces(res.locals.user.userId) }),
        deleteSavedGooglePlace: async (req, res) => {
            const params = res.locals.params as DeleteGooglePlaceRequest;
            await service.deleteSavedGooglePlace(res.locals.user.userId, params.placeId);
            res.status(204).send();
        },
        mapboxReverse: async (req, res) => {
            const query = res.locals.query as ProviderReverseRequest;
            res.json({ data: await service.mapboxReverse(query.latitude, query.longitude) });
        },
        mapboxBoardReverse: async (req, res) => {
            const query = res.locals.query as ProviderReverseRequest;
            res.json({ data: await service.mapboxBoardReverse(query.latitude, query.longitude) });
        },
        mapboxRoute: async (req, res) => {
            const body = req.body as MapboxRouteRequest;
            res.json({ data: await service.mapboxRoute(body.points, body.profile) });
        },
        cloudinaryDelivery: (req, res) => {
            const query = res.locals.query as CloudinaryDeliveryRequest;
            res.json({
                data: { url: service.cloudinaryDelivery(query.publicId, query.width, query.height, query.crop) }
            });
        },
        cloudinaryUpload: async (req, res) => {
            res.status(201).json({ data: await service.cloudinaryUpload(res.locals.file) });
        },
        cloudinaryAssets: async (_req, res) => {
            res.json({ data: await service.cloudinaryAssets() });
        },
        cloudinaryMetadata: async (req, res) => {
            const query = res.locals.query as CloudinaryMetadataRequest;
            res.json({
                data: { publicId: query.publicId, metadata: await service.cloudinaryMetadata(query.publicId) }
            });
        }
    };
}
