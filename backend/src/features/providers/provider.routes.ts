import express, { Router, type RequestHandler } from "express";
import { requireFrontendOrigin } from "../../middleware/require-origin.js";
import { requireSessionUser } from "../../middleware/session-user.js";
import { developmentOnly } from "../../middleware/development-only.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import { parseUpload } from "./provider.upload.js";
import * as schemas from "./provider.schemas.js";
import type { ProviderController } from "./provider.controller.js";

export function createProviderRouter(controller: ProviderController, attachUser: RequestHandler): Router {
    const router = Router();
    const dev = [developmentOnly, attachUser, requireSessionUser];
    router.get("/config", controller.config);
    router.get(
        "/unsplash/activity-search",
        attachUser,
        requireSessionUser,
        validateQuery(schemas.manualPhotoSearchSchema),
        controller.manualPhotoSearch
    );
    router.post(
        "/unsplash/activity-photos/select",
        attachUser,
        requireSessionUser,
        requireFrontendOrigin,
        validateBody(schemas.manualPhotoSelectionSchema),
        controller.manualPhotoSelect
    );
    router.post(
        "/locations/suggest-area",
        attachUser,
        requireSessionUser,
        requireFrontendOrigin,
        validateBody(schemas.areaSuggestionSchema),
        controller.suggestBoardArea
    );
    router.get("/locations/areas", validateQuery(schemas.providerSearchSchema), controller.boardAreaSearch);
    router.get("/locations/search", validateQuery(schemas.boardLocationSearchSchema), controller.mapboxBoardSearch);
    router.get(
        "/locations/destinations",
        validateQuery(schemas.boardDestinationSearchSchema),
        controller.mapboxDestinationSearch
    );
    router.get("/locations/reverse", validateQuery(schemas.boardReverseSchema), controller.mapboxBoardReverse);
    router.post("/mapbox/map-session", requireFrontendOrigin, controller.mapboxMapSession);
    router.get("/mapbox/search", validateQuery(schemas.providerSearchSchema), controller.mapboxSearch);
    router.get("/mapbox/reverse", validateQuery(schemas.providerReverseSchema), controller.mapboxReverse);
    router.post(
        "/mapbox/directions",
        requireFrontendOrigin,
        validateBody(schemas.mapboxRouteSchema),
        controller.mapboxRoute
    );
    router.get(
        "/unsplash/activity-photo",
        validateQuery(schemas.activityPhotoSchema),
        controller.unsplashActivityPhoto
    );
    router.post(
        "/unsplash/activity-photo",
        attachUser,
        requireSessionUser,
        requireFrontendOrigin,
        validateBody(schemas.activityPhotoSchema),
        controller.selectActivityPhoto
    );
    router.get(
        "/unsplash/activity-photo-suggestions",
        attachUser,
        requireSessionUser,
        validateQuery(schemas.photoSuggestionSchema),
        controller.photoSuggestions
    );
    router.post(
        "/unsplash/activity-photo-suggestions/select",
        attachUser,
        requireSessionUser,
        requireFrontendOrigin,
        validateBody(schemas.photoSelectionSchema),
        controller.selectPhotoSuggestion
    );
    router.get("/unsplash/search", validateQuery(schemas.unsplashSearchSchema), controller.unsplashSearch);
    router.get(
        "/google-places/search",
        ...dev,
        validateQuery(schemas.providerSearchSchema),
        controller.googlePlacesSearch
    );
    router.get("/google-places/saved", ...dev, controller.savedGooglePlaces);
    router.post(
        "/google-places/saved",
        ...dev,
        requireFrontendOrigin,
        validateBody(schemas.saveGooglePlaceSchema),
        controller.saveGooglePlace
    );
    router.delete(
        "/google-places/saved/:placeId",
        ...dev,
        requireFrontendOrigin,
        validateParams(schemas.deleteGooglePlaceSchema),
        controller.deleteSavedGooglePlace
    );
    router.get(
        "/google-places/:placeId",
        ...dev,
        validateParams(schemas.googlePlaceDetailsSchema),
        controller.googlePlaceDetails
    );
    router.get(
        "/cloudinary/delivery",
        ...dev,
        validateQuery(schemas.cloudinaryDeliverySchema),
        controller.cloudinaryDelivery
    );
    router.post(
        "/cloudinary/upload",
        ...dev,
        requireFrontendOrigin,
        express.raw({ type: "multipart/form-data", limit: "11mb" }),
        parseUpload,
        controller.cloudinaryUpload
    );
    router.get("/cloudinary/assets", ...dev, controller.cloudinaryAssets);
    router.get(
        "/cloudinary/metadata",
        ...dev,
        validateQuery(schemas.cloudinaryMetadataSchema),
        controller.cloudinaryMetadata
    );
    return router;
}
