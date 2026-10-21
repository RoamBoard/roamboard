/* eslint-disable @next/next/no-img-element */
"use client";

import { activityNoteError, activityNoteLength } from "@/lib/activity-note";

import { useEffect, useId, useRef, useState } from "react";

import PhotoEditorDialog from "@/components/images/PhotoEditorDialog";
import { usePhotoUrls } from "@/lib/use-photo-urls";
import { toast } from "sonner";
import { creatorToastOptions } from "./CreatorNotifications";
import { useBoardLeaveWarning } from "@/lib/use-board-leave-warning";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PinCategoryIcon from "@/components/ui/PinCategoryIcon";
import { pinCategories } from "@/lib/board-options";
import ActivityLocationSearch from "./ActivityLocationSearch";
import BoardPhotoStrip from "./BoardPhotoStrip";
import {
    uploadBoardImage,
    refreshBoardPhotoLocation,
    suggestBoardPhotos,
    type SmartPhotoSuggestion
} from "@/lib/board-creator-api";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import type { BoardImageDraft, BoardPinDraft, PinCategory } from "@/types/board-creator";

import { findActivityPhoto } from "@/lib/providers";
import { fillActivityFromPhoto, photoActivityLocation } from "@/lib/activity-photo";

type Props = {
    placement?: {
        days: Array<{ id: string; dayNumber: number; pins: BoardPinDraft[] }>;
        dayId: string;
        onMove: (dayId: string) => void;
        onReorder: (direction: -1 | 1) => void;
    };
    mode?: "create" | "edit";
    dayNumber?: number;
    proximity?: { latitude: number; longitude: number } | null;
    pin: BoardPinDraft;
    images: BoardImageDraft[];
    remainingUploads: number;
    onClose: () => void;
    onUploadingChange?: (uploading: boolean) => void;
    onSave: (pin: BoardPinDraft) => void;
    onDelete: () => void;
    onAddImage: (image: BoardImageDraft) => void;
    onAssignImage: (imageId: string, pinId: string | null) => void;
    onSetCover: (pinId: string, imageId: number | null) => void;
    onReorderImage: (pinId: string, imageId: string, direction: -1 | 1) => void;
    onMetadataChange?: (
        imageId: number,
        metadata: { capturedAt: string | null; latitude: number | null; longitude: number | null }
    ) => void;
};

export default function ActivityEditorDialog({
    pin,
    placement,
    mode = "edit",
    dayNumber,
    proximity,
    images,
    remainingUploads,
    onClose,
    onUploadingChange,
    onSave,
    onDelete,
    onAddImage,
    onAssignImage,
    onSetCover,
    onReorderImage,
    onMetadataChange
}: Props) {
    const photoUrl = usePhotoUrls();
    const [editingPhoto, setEditingPhoto] = useState<number | null>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const [confirmation, setConfirmation] = useState<"discard" | "delete" | null>(null);
    useDialogFocus(dialogRef, requestClose, confirmation === null && editingPhoto === null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [draft, setDraft] = useState(pin);
    const [searchArea, setSearchArea] = useState<{ latitude: number; longitude: number } | null | undefined>(
        pin.location ?? proximity
    );
    const [automaticImage, setAutomaticImage] = useState<(BoardImageDraft & { locationKey: string }) | null>(null);
    const [photoStatus, setPhotoStatus] = useState("");
    const [photoSuggestion, setPhotoSuggestion] = useState<{
        image: BoardImageDraft;
        suggestion?: SmartPhotoSuggestion;
    } | null>(null);
    const [photoSearching, setPhotoSearching] = useState(false);
    const [skipAutomaticPhoto, setSkipAutomaticPhoto] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [locationVersion, setLocationVersion] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const uploadLock = useRef(false);
    const fieldEdits = useRef({ category: false });
    const uploadId = useId();
    useEffect(
        () => () => {
            toast.dismiss(uploadId);
        },
        [uploadId]
    );
    const changed =
        (mode === "create" && images.some((image) => image.pinId === pin.id)) ||
        draft.title !== pin.title ||
        draft.description !== pin.description ||
        draft.time !== pin.time ||
        draft.category !== pin.category ||
        JSON.stringify(draft.location) !== JSON.stringify(pin.location) ||
        Boolean(automaticImage);
    useBoardLeaveWarning(changed || uploading || refreshing);
    function requestClose() {
        if (uploadLock.current || refreshing) {
            setError("Wait for activity image uploads to finish before closing.");
            return;
        }
        if (changed) setConfirmation("discard");
        else onClose();
    }

    const activityImages = images
        .filter((image) => image.pinId === pin.id)
        .sort((first, second) => (first.activityOrder ?? first.order) - (second.activityOrder ?? second.order));
    const hasUpload = activityImages.some((image) => image.source === "upload");
    const placeChanged = JSON.stringify(draft.location) !== JSON.stringify(pin.location);
    const locationKey = JSON.stringify(draft.location);
    const matchedAutomaticImage = automaticImage?.locationKey === locationKey ? automaticImage : null;
    const visibleImages = [
        ...activityImages.filter((image) => image.source !== "unsplash" || !placeChanged),
        ...(!hasUpload && matchedAutomaticImage ? [matchedAutomaticImage] : [])
    ];
    const availableImages = images.filter((image) => image.source === "upload" && image.pinId !== pin.id);
    const cover =
        draft.coverImageId === null
            ? (visibleImages.find((image) => image.source === "unsplash") ?? null)
            : (visibleImages.find((image) => image.uploadedImageId === draft.coverImageId) ?? visibleImages[0]);

    const locationName = draft.location?.name;
    const latitude = draft.location?.latitude;
    const longitude = draft.location?.longitude;
    const city = draft.location?.city;
    const country = draft.location?.country;
    const hasSavedPhoto = !placeChanged && activityImages.some((image) => image.source === "unsplash");
    useEffect(() => {
        if (
            skipAutomaticPhoto ||
            !locationName ||
            latitude === undefined ||
            longitude === undefined ||
            hasUpload ||
            hasSavedPhoto
        )
            return;
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            setAutomaticImage(null);
            setPhotoSearching(true);
            setPhotoStatus("Looking for a photo of this exact place...");
            void findActivityPhoto({ name: locationName, latitude, longitude, city, country }, controller.signal, true)
                .then((photo) => {
                    if (controller.signal.aborted) return;
                    setPhotoStatus(
                        photo
                            ? "A photo matched to this place. Your uploads take priority."
                            : "No confident photo match for this place. Add your own photo anytime."
                    );
                    if (photo)
                        setAutomaticImage({
                            locationKey,
                            id: crypto.randomUUID(),
                            publicId: photo.id,
                            pinId: pin.id,
                            source: "unsplash",
                            url: photo.url,
                            thumbnailUrl: photo.thumbnailUrl,
                            width: photo.width,
                            height: photo.height,
                            capturedAt: null,
                            latitude: null,
                            longitude: null,
                            order: 0,
                            credit: photo.photographer,
                            creditUrl: photo.photographerUrl,
                            sourceUrl: photo.sourceUrl
                        });
                })
                .catch(() => {
                    if (!controller.signal.aborted) {
                        setAutomaticImage(null);
                        setPhotoStatus(
                            "Automatic photos are unavailable. You can upload your own or save without a photo."
                        );
                    }
                })
                .finally(() => {
                    if (!controller.signal.aborted) setPhotoSearching(false);
                });
        }, 700);
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [
        locationName,
        latitude,
        longitude,
        city,
        country,
        hasUpload,
        hasSavedPhoto,
        pin.id,
        locationKey,
        skipAutomaticPhoto
    ]);
    async function upload(files: File[]) {
        if (uploadLock.current || files.length === 0) return;
        if (files.length > remainingUploads) {
            setError(`Choose up to ${remainingUploads} photos per batch. You can add another batch afterwards.`);
            return;
        }
        uploadLock.current = true;
        onUploadingChange?.(true);
        toast.loading("Uploading activity images…", { ...creatorToastOptions, id: uploadId });
        setUploading(true);
        setError("");
        try {
            const completed: BoardImageDraft[] = [];
            for (const file of files) {
                const asset = await uploadBoardImage(file);
                const uploaded: BoardImageDraft = {
                    id: crypto.randomUUID(),
                    uploadedImageId: asset.imageId,
                    pinId: pin.id,
                    publicId: String(asset.imageId),
                    source: "upload",
                    url: asset.url,
                    thumbnailUrl: asset.thumbnailUrl,
                    width: 0,
                    height: 0,
                    capturedAt: asset.capturedAt,
                    latitude: asset.latitude,
                    longitude: asset.longitude,
                    order: 0,
                    credit: null,
                    creditUrl: null,
                    sourceUrl: null
                };
                completed.push(uploaded);
                onAddImage(uploaded);
                if (completed.length === 1) {
                    const first = uploaded;
                    if (first) {
                        setAutomaticImage(null);
                        const suggestion =
                            first.uploadedImageId && first.latitude !== null && first.longitude !== null
                                ? await suggestBoardPhotos([first.uploadedImageId])
                                      .then((results) => results[0])
                                      .catch(() => undefined)
                                : undefined;
                        setPhotoSuggestion({ image: first, suggestion });
                        setDraft((current) => ({
                            ...fillActivityFromPhoto(current, first, suggestion),
                            ...(fieldEdits.current.category ? { category: current.category } : {}),
                            ...(!hasUpload ? { coverImageId: first.uploadedImageId } : {})
                        }));
                        setLocationVersion((current) => current + 1);
                        if (first.latitude !== null && first.longitude !== null)
                            setSearchArea({ latitude: first.latitude, longitude: first.longitude });
                    }
                }
            }
            toast.success("Activity images uploaded", {
                ...creatorToastOptions,
                id: uploadId,
                description: "Save your Board to keep these changes."
            });
        } catch (caught) {
            const detail = caught instanceof Error ? caught.message : "The activity images could not be uploaded.";
            setError(detail);
            toast.error("Activity upload stopped", {
                ...creatorToastOptions,
                id: uploadId,
                description: "Completed uploads remain attached. Retry the remaining files."
            });
        } finally {
            uploadLock.current = false;
            onUploadingChange?.(false);
            setUploading(false);
            if (inputRef.current) inputRef.current.value = "";
        }
    }

    return (
        <>
            {editingPhoto !== null ? (
                <PhotoEditorDialog imageId={editingPhoto} onClose={() => setEditingPhoto(null)} />
            ) : null}
            {confirmation ? (
                <ConfirmDialog
                    title={confirmation === "delete" ? "Remove this activity?" : "Discard activity edits?"}
                    description="Images already attached stay available in your Board edits. Unsaved changes to the activity fields will be discarded."
                    confirmLabel={confirmation === "delete" ? "Remove activity" : "Discard fields"}
                    onCancel={() => setConfirmation(null)}
                    onConfirm={() => {
                        if (confirmation === "delete") onDelete();
                        else onClose();
                    }}
                />
            ) : null}
            <div
                inert={confirmation !== null || editingPhoto !== null}
                className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4"
                role="presentation"
                onMouseDown={(event) => {
                    if (event.target === event.currentTarget) requestClose();
                }}
            >
                <div
                    ref={dialogRef}
                    tabIndex={-1}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="edit-activity-heading"
                    className="bg-background max-h-[92dvh] w-full max-w-5xl overflow-y-auto p-6 shadow-2xl outline-none sm:p-8"
                >
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-10 tracking-label text-stone font-bold uppercase">
                                {mode === "create" ? `Day ${dayNumber} / Add activity` : "Edit activity"}
                            </p>
                            <h2 id="edit-activity-heading" className="font-display text-30 mt-2 font-bold">
                                {draft.title || "A place in your day"}
                            </h2>
                        </div>
                        <button
                            type="button"
                            onClick={requestClose}
                            className="border-line text-22 grid size-10 place-items-center border"
                            aria-label={mode === "create" ? "Close activity dialog" : "Close activity editor"}
                        >
                            ×
                        </button>
                    </div>
                    <div className="mt-8 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
                        <aside className="border-line min-w-0 lg:border-r lg:pr-8">
                            <details open className="group">
                                <summary className="cursor-pointer text-sm font-medium">Activity photos</summary>
                                <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
                                    Upload photos to fill missing location and time. Your existing edits stay as they
                                    are.
                                </p>
                                {cover ? (
                                    <figure className="mt-6">
                                        <img
                                            src={photoUrl(cover.url)}
                                            decoding="async"
                                            onError={() => setError("The activity image could not load.")}
                                            alt={`Image for ${pin.title}`}
                                            className="aspect-video w-full object-cover"
                                        />
                                        {cover.credit && cover.creditUrl && cover.sourceUrl ? (
                                            <figcaption className="text-10 text-stone mt-1">
                                                Photo by{" "}
                                                <a
                                                    href={cover.creditUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="underline"
                                                >
                                                    {cover.credit}
                                                </a>{" "}
                                                on{" "}
                                                <a
                                                    href={cover.sourceUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="underline"
                                                >
                                                    Unsplash
                                                </a>
                                            </figcaption>
                                        ) : null}
                                    </figure>
                                ) : null}
                                <input
                                    ref={inputRef}
                                    type="file"
                                    accept="image/*,.heic,.heif"
                                    multiple
                                    className="sr-only"
                                    onChange={(event) => void upload(Array.from(event.target.files ?? []))}
                                />
                                <button
                                    type="button"
                                    disabled={uploading || refreshing || remainingUploads === 0}
                                    onClick={() => inputRef.current?.click()}
                                    className="border-line hover:border-foreground text-muted-foreground mt-4 flex min-h-32 w-full items-center justify-center rounded-xl border border-dashed px-5 py-5 text-sm disabled:opacity-40"
                                    onDragOver={(event) => {
                                        event.preventDefault();
                                    }}
                                    onDrop={(event) => {
                                        event.preventDefault();
                                        if (!uploading && !refreshing)
                                            void upload(Array.from(event.dataTransfer.files));
                                    }}
                                >
                                    {uploading ? "Uploading..." : "Upload activity images"}
                                </button>
                                <section className="mt-5" aria-label="Activity images">
                                    <h3 className="text-12 font-bold">Activity images</h3>
                                    {visibleImages.length === 0 ? (
                                        <p className="text-12 text-graphite mt-2">No images attached yet.</p>
                                    ) : null}
                                    <ul className="mt-3 grid grid-cols-2 gap-3">
                                        {visibleImages.map((item, index) => (
                                            <li key={item.id} className="border-line border p-2">
                                                <img
                                                    src={photoUrl(item.thumbnailUrl)}
                                                    loading="lazy"
                                                    decoding="async"
                                                    alt={`${pin.title} image ${index + 1}`}
                                                    className="aspect-square w-full object-cover"
                                                />
                                                {item.uploadedImageId ? (
                                                    <button
                                                        type="button"
                                                        disabled={uploading || refreshing}
                                                        className="mt-2 block text-[11px] underline"
                                                        onClick={() => setEditingPhoto(item.uploadedImageId!)}
                                                    >
                                                        Crop / resize
                                                    </button>
                                                ) : null}
                                                {item.id === cover?.id ? (
                                                    <span className="text-10 mt-2 block font-bold">Activity cover</span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const nextCoverId = item.uploadedImageId ?? null;
                                                            onSetCover(pin.id, nextCoverId);
                                                            setDraft((current) => ({
                                                                ...current,
                                                                coverImageId: nextCoverId
                                                            }));
                                                        }}
                                                        className="text-10 mt-2 underline"
                                                    >
                                                        Set as activity cover
                                                    </button>
                                                )}
                                                {item.source === "upload" ? (
                                                    <div className="text-10 mt-2 flex flex-wrap gap-2">
                                                        <button
                                                            type="button"
                                                            disabled={index === 0}
                                                            onClick={() => onReorderImage(pin.id, item.id, -1)}
                                                            aria-label={`Move image ${index + 1} earlier`}
                                                            className="underline disabled:opacity-40"
                                                        >
                                                            Earlier
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={index === activityImages.length - 1}
                                                            onClick={() => onReorderImage(pin.id, item.id, 1)}
                                                            aria-label={`Move image ${index + 1} later`}
                                                            className="underline disabled:opacity-40"
                                                        >
                                                            Later
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => onAssignImage(item.id, null)}
                                                            className="underline"
                                                        >
                                                            Detach
                                                        </button>
                                                    </div>
                                                ) : null}
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                                {availableImages.length > 0 ? (
                                    <section className="mt-5" aria-label="Other uploaded images">
                                        <h3 className="text-12 font-bold">Attach a Board upload</h3>
                                        <BoardPhotoStrip label="Board uploaded images">
                                            {availableImages.map((item) => (
                                                <li key={item.id} className="w-24 shrink-0 snap-start">
                                                    <img
                                                        src={photoUrl(item.thumbnailUrl)}
                                                        loading="lazy"
                                                        decoding="async"
                                                        width={96}
                                                        height={96}
                                                        alt="Board upload"
                                                        className="aspect-square w-full object-cover"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => onAssignImage(item.id, pin.id)}
                                                        className="text-10 mt-1 underline"
                                                    >
                                                        {item.pinId ? "Move here" : "Attach"}
                                                    </button>
                                                </li>
                                            ))}
                                        </BoardPhotoStrip>
                                    </section>
                                ) : null}
                                <p role="status" className="text-muted-foreground mt-4 text-xs leading-relaxed">
                                    {hasUpload ? "Your uploaded photos are used for this activity." : photoStatus}
                                </p>
                                {photoSearching && !hasUpload ? (
                                    <button
                                        type="button"
                                        className="mt-3 text-xs underline underline-offset-4"
                                        onClick={() => {
                                            setSkipAutomaticPhoto(true);
                                            setPhotoSearching(false);
                                            setAutomaticImage(null);
                                            setPhotoStatus(
                                                "No automatic photo selected. You can add your own anytime."
                                            );
                                        }}
                                    >
                                        Continue without an automatic photo
                                    </button>
                                ) : null}
                            </details>
                        </aside>
                        <div className="min-w-0">
                            <ActivityLocationSearch
                                proximity={searchArea}
                                key={locationVersion}
                                value={draft.location}
                                disabled={uploading || refreshing}
                                onSelect={(location, category) => {
                                    setAutomaticImage(null);
                                    setSkipAutomaticPhoto(false);
                                    const savedPhoto =
                                        location &&
                                        JSON.stringify(location) === JSON.stringify(pin.location) &&
                                        activityImages.some((image) => image.source === "unsplash");
                                    setPhotoSearching(Boolean(location && !hasUpload && !savedPhoto));
                                    if (location) setSearchArea(location);
                                    setDraft((current) => ({
                                        ...current,
                                        location,
                                        title: location?.name ?? current.title,
                                        category: category ?? current.category
                                    }));
                                }}
                            />
                            {activityImages.some((image) => image.uploadedImageId) ? (
                                <button
                                    type="button"
                                    disabled={uploading || refreshing}
                                    className="text-muted-foreground mt-4 min-h-9 text-xs underline underline-offset-4 disabled:opacity-40"
                                    onClick={async () => {
                                        const image = [...activityImages]
                                            .sort((first, second) => first.order - second.order)
                                            .find((item) => item.uploadedImageId);
                                        if (!image?.uploadedImageId) return;
                                        setAutomaticImage(null);
                                        setRefreshing(true);
                                        setError("");
                                        try {
                                            const result = await refreshBoardPhotoLocation(image.uploadedImageId);
                                            onMetadataChange?.(image.uploadedImageId, {
                                                capturedAt: result.capturedAt,
                                                latitude: result.latitude,
                                                longitude: result.longitude
                                            });
                                            if (result.latitude !== null && result.longitude !== null)
                                                setSearchArea({
                                                    latitude: result.latitude,
                                                    longitude: result.longitude
                                                });
                                            if (result.location) {
                                                const place = result.location;
                                                setDraft((current) => ({
                                                    ...current,
                                                    title:
                                                        place.detail || place.label || place.address || current.title,
                                                    category: result.category,
                                                    location: {
                                                        name:
                                                            place.detail ||
                                                            place.label ||
                                                            place.address ||
                                                            "Photo location",
                                                        address: place.address ?? "",
                                                        latitude: result.latitude ?? place.latitude,
                                                        longitude: result.longitude ?? place.longitude,
                                                        country: place.country,
                                                        countryCode: place.countryCode,
                                                        city: place.city,
                                                        mapboxId: place.id
                                                    }
                                                }));
                                                setLocationVersion((current) => current + 1);
                                            } else if (result.latitude !== null && result.longitude !== null) {
                                                const { latitude, longitude } = result;
                                                setDraft((current) => ({
                                                    ...current,
                                                    title: "Photo location",
                                                    location: {
                                                        name: "Photo location",
                                                        address: "",
                                                        latitude,
                                                        longitude,
                                                        country: null,
                                                        countryCode: null,
                                                        city: null,
                                                        mapboxId: null
                                                    }
                                                }));
                                                setLocationVersion((current) => current + 1);
                                            }
                                            if (result.warning) setError(result.warning);
                                        } catch (caught) {
                                            setError(
                                                caught instanceof Error
                                                    ? caught.message
                                                    : "Could not re-read this photo. Search for its location instead."
                                            );
                                        } finally {
                                            setRefreshing(false);
                                        }
                                    }}
                                >
                                    {refreshing ? "Reading photo location..." : "Re-read photo location"}
                                </button>
                            ) : null}
                            {photoSuggestion &&
                            draft.location &&
                            photoActivityLocation(photoSuggestion.image, photoSuggestion.suggestion) ? (
                                <button
                                    type="button"
                                    disabled={uploading || refreshing}
                                    className="mt-3 text-xs underline underline-offset-4"
                                    onClick={() => {
                                        const location = photoActivityLocation(
                                            photoSuggestion.image,
                                            photoSuggestion.suggestion
                                        );
                                        if (location) {
                                            setDraft((current) => ({
                                                ...current,
                                                location,
                                                title: location.name,
                                                source: "photo",
                                                category: photoSuggestion.suggestion?.category ?? current.category
                                            }));
                                            setSearchArea(location);
                                            setLocationVersion((current) => current + 1);
                                        }
                                    }}
                                >
                                    Use photo location:{" "}
                                    {photoActivityLocation(photoSuggestion.image, photoSuggestion.suggestion)?.name}
                                </button>
                            ) : null}
                            {error ? (
                                <p role="alert" className="mt-4 text-xs leading-relaxed">
                                    {error}
                                </p>
                            ) : null}
                            <label className="text-muted-foreground mt-6 block text-xs">
                                Time
                                <input
                                    type="time"
                                    disabled={uploading || refreshing}
                                    value={draft.time}
                                    onChange={(event) =>
                                        setDraft((current) => ({ ...current, time: event.target.value }))
                                    }
                                    className="border-line text-foreground focus:border-foreground mt-2 block min-h-11 w-full border-b bg-transparent text-base outline-none"
                                />
                            </label>
                            <label className="text-12 text-graphite mt-5 block">
                                Category
                                <span className="border-line mt-2 flex items-center gap-3 border-b py-2">
                                    <PinCategoryIcon category={draft.category} />
                                    <select
                                        disabled={uploading || refreshing}
                                        value={draft.category}
                                        onChange={(event) => {
                                            fieldEdits.current.category = true;
                                            setDraft({ ...draft, category: event.target.value as PinCategory });
                                        }}
                                        className="text-14 text-foreground min-w-0 flex-1 bg-transparent outline-none"
                                    >
                                        {pinCategories.map((item) => (
                                            <option key={item.value} value={item.value}>
                                                {item.label}
                                            </option>
                                        ))}
                                    </select>
                                </span>
                            </label>
                            <label className="text-12 text-graphite mt-5 block">
                                Notes
                                <textarea
                                    disabled={uploading || refreshing}
                                    rows={4}
                                    value={draft.description}
                                    onChange={(event) =>
                                        setDraft({
                                            ...draft,
                                            description: event.target.value
                                        })
                                    }
                                    className="border-line text-14 text-foreground mt-2 w-full resize-y border bg-transparent p-3 outline-none"
                                />
                            </label>
                            <p className="text-muted-foreground mt-2 text-xs">
                                {activityNoteLength(draft.description)} / 250 characters
                            </p>
                            {activityNoteError(draft.description, pin.description) ? (
                                <p role="alert" className="mt-2 text-xs">
                                    {activityNoteError(draft.description, pin.description)}
                                </p>
                            ) : null}
                            {placement ? (
                                <section className="border-line mt-6 border-t pt-4" aria-label="Arrange activity">
                                    <label className="text-muted-foreground block text-xs">
                                        Day
                                        <select
                                            className="border-line text-foreground mt-2 block min-h-11 w-full border-b bg-transparent"
                                            value={placement.dayId}
                                            onChange={(event) => placement.onMove(event.target.value)}
                                        >
                                            {placement.days.map((day) => (
                                                <option key={day.id} value={day.id}>
                                                    Day {day.dayNumber}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <div className="mt-3 flex gap-4">
                                        <button
                                            type="button"
                                            disabled={
                                                uploading ||
                                                refreshing ||
                                                placement.days.find((day) => day.id === placement.dayId)?.pins[0]
                                                    ?.id === pin.id
                                            }
                                            className="min-h-9 text-xs underline disabled:opacity-40"
                                            onClick={() => placement.onReorder(-1)}
                                        >
                                            Move earlier
                                        </button>
                                        <button
                                            type="button"
                                            disabled={
                                                uploading ||
                                                refreshing ||
                                                placement.days.find((day) => day.id === placement.dayId)?.pins.at(-1)
                                                    ?.id === pin.id
                                            }
                                            className="min-h-9 text-xs underline disabled:opacity-40"
                                            onClick={() => placement.onReorder(1)}
                                        >
                                            Move later
                                        </button>
                                    </div>
                                </section>
                            ) : null}
                            {draft.location ? (
                                <p className="text-12 text-muted-foreground mt-4 leading-5">{draft.location.address}</p>
                            ) : null}
                            <div className="mt-8 flex flex-wrap justify-between gap-3">
                                {mode === "edit" ? (
                                    <button
                                        type="button"
                                        disabled={uploading || refreshing}
                                        onClick={() => setConfirmation("delete")}
                                        className="border-line text-13 border px-5 py-3"
                                    >
                                        Delete activity
                                    </button>
                                ) : (
                                    <span />
                                )}
                                <button
                                    type="button"
                                    disabled={
                                        uploading ||
                                        refreshing ||
                                        (photoSearching && !hasUpload) ||
                                        Boolean(activityNoteError(draft.description, pin.description))
                                    }
                                    onClick={() => {
                                        if (activityNoteError(draft.description, pin.description)) return;
                                        if (draft.location && draft.title.trim()) {
                                            if (placeChanged)
                                                activityImages
                                                    .filter((image) => image.source === "unsplash")
                                                    .forEach((image) => onAssignImage(image.id, null));
                                            if (matchedAutomaticImage && !hasUpload) onAddImage(matchedAutomaticImage);
                                            onSave({
                                                ...draft,
                                                coverImageId:
                                                    matchedAutomaticImage && !hasUpload ? null : draft.coverImageId,
                                                title: draft.title.trim(),
                                                description:
                                                    draft.description === pin.description
                                                        ? pin.description
                                                        : draft.description.trim()
                                            });
                                            onClose();
                                        } else {
                                            setError("Choose a location from the search results before saving.");
                                        }
                                    }}
                                    className="border-foreground bg-foreground text-13 text-background border px-6 py-3"
                                >
                                    {mode === "create" ? `Add to Day ${dayNumber}` : "Save activity"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
