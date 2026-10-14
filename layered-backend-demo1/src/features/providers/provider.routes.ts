import { extname } from "node:path";

import { Router } from "express";
import multer from "multer";

import { validate } from "../../middleware/validate.js";
import { AppError } from "../../shared/app-error.js";
import {
    boardDestinationSearchSchema,
    cloudinaryDeliverySchema,
    cloudinaryMetadataSchema,
    deleteGooglePlaceSchema,
    googlePlaceDetailsSchema,
    mapboxRouteSchema,
    providerReverseSchema,
    providerSearchSchema,
    saveGooglePlaceSchema
} from "./provider.schemas.js";
import type { ProviderService } from "./provider.service.js";
import { createProviderController } from "./provider.controller.js";

export function createProviderRouter(service: ProviderService): Router {
    const controller = createProviderController(service);
    const router = Router();
    const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 15 * 1024 * 1024 },
        fileFilter: (_req, file, callback) => {
            const browserReportedImage = file.mimetype.startsWith("image/");
            const genericImageExtensions = new Set([
                ".avif",
                ".bmp",
                ".gif",
                ".heic",
                ".heif",
                ".ico",
                ".jp2",
                ".jpeg",
                ".jpg",
                ".jxl",
                ".png",
                ".svg",
                ".tif",
                ".tiff",
                ".webp"
            ]);
            const genericImage =
                ["application/octet-stream", "application/heic", "application/heif"].includes(file.mimetype) &&
                genericImageExtensions.has(extname(file.originalname).toLowerCase());
            if (!browserReportedImage && !genericImage) {
                callback(new AppError(415, "Choose an image file supported by Cloudinary."));
                return;
            }
            callback(null, true);
        }
    });
    router.get("/config", controller.config);
    router.get("/locations/search", validate(providerSearchSchema), controller.mapboxBoardSearch);
    router.get("/locations/destinations", validate(boardDestinationSearchSchema), controller.mapboxDestinationSearch);
    router.get("/locations/reverse", validate(providerReverseSchema), controller.mapboxBoardReverse);
    router.post("/mapbox/map-session", controller.mapboxMapSession);
    router.get("/mapbox/search", validate(providerSearchSchema), controller.mapboxSearch);
    router.get("/mapbox/board-search", validate(providerSearchSchema), controller.mapboxBoardSearch);
    router.get(
        "/mapbox/board-destinations",
        validate(boardDestinationSearchSchema),
        controller.mapboxDestinationSearch
    );
    router.get("/mapbox/reverse", validate(providerReverseSchema), controller.mapboxReverse);
    router.get("/mapbox/board-reverse", validate(providerReverseSchema), controller.mapboxBoardReverse);
    router.post("/mapbox/directions", validate(mapboxRouteSchema), controller.mapboxRoute);
    router.get("/unsplash/search", validate(providerSearchSchema), controller.unsplashSearch);
    router.get("/google-places/search", validate(providerSearchSchema), controller.googlePlacesSearch);
    router.get("/google-places/saved", controller.savedGooglePlaces);
    router.post("/google-places/saved", validate(saveGooglePlaceSchema), controller.saveGooglePlace);
    router.delete(
        "/google-places/saved/:placeId",
        validate(deleteGooglePlaceSchema),
        controller.deleteSavedGooglePlace
    );
    router.get("/google-places/:placeId", validate(googlePlaceDetailsSchema), controller.googlePlaceDetails);
    router.get("/cloudinary/delivery", validate(cloudinaryDeliverySchema), controller.cloudinaryDelivery);
    router.post("/cloudinary/upload", upload.single("file"), controller.cloudinaryUpload);
    router.get("/cloudinary/assets", controller.cloudinaryAssets);
    router.get("/cloudinary/metadata", validate(cloudinaryMetadataSchema), controller.cloudinaryMetadata);
    return router;
}
