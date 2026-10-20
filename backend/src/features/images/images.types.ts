import type { ImagePresentationEdit } from "./images.schemas.js";
import type { Readable } from "node:stream";

import type { UploadIntentWrite } from "../boards/boards.schemas.js";
import type { BoardDocument } from "../boards/boards.types.js";

export interface UploadIntent {
    uploadId: string;
    userId: string;
    storageKey: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    createdAt: Date;
    expiresAt: Date;
    imageId: number | null;
}

export interface UploadedImage {
    imageId: number;
    presentationEdit?: ImagePresentationEdit | null;
    presentationRevision?: number;
    storageKey: string;
    uploaderUserId: string;
    boardId: number | null;
    // A profile image can be shown with a readable Board without being attached as Board media.
    profileOwnerUserId?: string | null;
    profileOwnerUsername?: string | null;
    capturedAt: Date | null;
    latitude: number | null;
    longitude: number | null;
}

export interface ProviderAsset {
    originalFilename?: string;
    storageKey: string;
    format: string;
    byteSize: number;
    createdAt: Date;
    capturedAt: Date | null;
    latitude: number | null;
    longitude: number | null;
}

export interface ImageProvider {
    copy?(sourceKey: string, targetKey: string, edit?: ImagePresentationEdit | null): Promise<ProviderAsset>;
    authorizeUpload(storageKey: string): {
        uploadUrl: string;
        method: "POST";
        headers: Record<string, string>;
        formFields: Record<string, string>;
    };
    inspect(storageKey: string): Promise<ProviderAsset | null>;
    openVariant(
        storageKey: string,
        variant: "display" | "thumbnail" | "original",
        edit?: ImagePresentationEdit | null
    ): Promise<{ stream: Readable; contentType: string }>;
    destroy(storageKey: string): Promise<void>;
}

export interface ImagesRepository {
    createIntent(intent: UploadIntent): Promise<void>;
    findIntent(uploadId: string): Promise<UploadIntent | null>;
    completeIntent(intent: UploadIntent, asset: ProviderAsset): Promise<number>;
    findImage(imageId: number): Promise<UploadedImage | null>;
    findImages?(imageIds: number[]): Promise<UploadedImage[]>;
    updateMetadata?(
        imageId: number,
        asset: Pick<ProviderAsset, "capturedAt" | "latitude" | "longitude">
    ): Promise<void>;
    savePresentation?(
        imageId: number,
        userId: string,
        revision: number,
        edit: ImagePresentationEdit | null
    ): Promise<boolean>;
    listCleanupCandidates(
        before: Date,
        limit: number,
        requestedOnly?: boolean
    ): Promise<Array<{ imageId: number | null; storageKey: string; uploadId: string | null }>>;
    cleanupImage(imageId: number, removeAsset: () => Promise<void>): Promise<boolean>;
    cleanupIntent(uploadId: string, removeAsset: () => Promise<void>): Promise<boolean>;
}

export interface ImagesService {
    copyForBoard(userId: string, boardId: number, imageId: number, source?: BoardDocument): Promise<number>;
    readPresentation(
        userId: string,
        imageId: number
    ): Promise<{ edit: ImagePresentationEdit | null; revision: number }>;
    savePresentation(
        userId: string,
        imageId: number,
        revision: number,
        edit: ImagePresentationEdit | null
    ): Promise<{ edit: ImagePresentationEdit | null; revision: number }>;
    createIntent(
        userId: string,
        input: UploadIntentWrite
    ): Promise<{
        uploadId: string;
        uploadUrl: string;
        method: "POST";
        headers: Record<string, string>;
        formFields: Record<string, string>;
        expiresAt: string;
    }>;
    complete(
        userId: string,
        uploadId: string
    ): Promise<{
        imageId: number;
        url: string;
        thumbnailUrl: string;
        capturedAt: string | null;
        latitude: number | null;
        longitude: number | null;
    }>;
    openImage(
        imageId: number,
        variant: "display" | "thumbnail" | "original",
        userId: string | null,
        boardId?: number,
        profileHandle?: string
    ): Promise<{ stream: Readable; contentType: string }>;
    cleanupUnused(): Promise<{ removed: number; failed: number }>;
    cleanupRequested(): Promise<void>;
}
