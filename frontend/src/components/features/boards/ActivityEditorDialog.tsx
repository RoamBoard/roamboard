/* eslint-disable @next/next/no-img-element */
"use client";

import { activityNoteError, activityNoteLength } from "@/lib/activity-note";

import { ArrowLeft, ArrowRight, Crop, Trash2, Upload } from "lucide-react";
import { editorPhoto } from "./EditorPhotoGallery";
import StoryGallery, { type StoryPlacement } from "./StoryGallery";
import { StoryPhotoCredit } from "./StoryPhoto";
import { useEffect, useId, useRef, useState } from "react";

import CroppedPhoto from "@/components/images/CroppedPhoto";
import PhotoEditorDialog from "@/components/images/PhotoEditorDialog";
import { usePhotoUrls } from "@/lib/use-photo-urls";
import { toast } from "sonner";
import { useBoardLeaveWarning } from "@/lib/use-board-leave-warning";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PinCategoryIcon from "@/components/ui/PinCategoryIcon";
import { pinCategories } from "@/lib/board-options";
import ActivityPhotoSearch from "./ActivityPhotoSearch";
import ActivityLocationSearch from "./ActivityLocationSearch";
import BoardPhotoStrip from "./BoardPhotoStrip";
import { suggestBoardPhotos, type SmartPhotoSuggestion } from "@/lib/board-creator-api";
import ActivityPhotoSuggestions from "./ActivityPhotoSuggestions";
import ActivityPinMap from "./ActivityPinMap";
import { uploadBoardImageBatch } from "@/lib/board-image-upload";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import type { BoardImageDraft, BoardPinDraft, PinCategory } from "@/types/board-creator";

import { findActivityPhoto } from "@/lib/providers";
import { activityBatchDefaults, fillActivityFromPhoto, photoActivityLocation } from "@/lib/activity-photo";

type Props = {
    mode?: "create" | "edit";
    dayNumber?: number;
    proximity?: { latitude: number; longitude: number } | null;
    pin: BoardPinDraft;
    images: BoardImageDraft[];
    remainingUploads: number;
    onClose: () => void;
    onRemoveImage?: (imageId: string) => void;
    onUploadingChange?: (uploading: boolean) => void;
    onSave: (pin: BoardPinDraft) => void;
    onDelete: () => void;
    onAddImage: (image: BoardImageDraft) => void;
    onUpdateImage?: (image: BoardImageDraft) => void;
    onAssignImage: (imageId: string, pinId: string | null) => void;
    onReorderImage: (pinId: string, imageId: string, direction: -1 | 1) => void;
};

function ActivityEditorContent({
    originalImages,
    pin,
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
    onUpdateImage,
    onAssignImage,
    onRemoveImage,
    onReorderImage
}: Props & { originalImages: BoardImageDraft[] }) {
    const photoUrl = usePhotoUrls();
    const [gallery, setGallery] = useState<{ placements: StoryPlacement[]; index: number } | null>(null);
    const [editingExternal, setEditingExternal] = useState<BoardImageDraft | null>(null);
    const [editingPhoto, setEditingPhoto] = useState<number | null>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const [confirmation, setConfirmation] = useState<"discard" | "delete" | null>(null);
    useDialogFocus(
        dialogRef,
        requestClose,
        confirmation === null && editingPhoto === null && gallery === null && editingExternal === null
    );
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
    const [locationVersion, setLocationVersion] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const uploadLock = useRef(false);
    const [locationEditVersion, setLocationEditVersion] = useState(0);
    const fieldEdits = useRef({ category: false, title: false, time: false, location: false, cover: false });
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
        Boolean(automaticImage) ||
        draft.coverImageId !== pin.coverImageId ||
        JSON.stringify(draft.coverPhoto) !== JSON.stringify(pin.coverPhoto) ||
        JSON.stringify(images.filter((image) => image.pinId === pin.id)) !==
            JSON.stringify(originalImages.filter((image) => image.pinId === pin.id));
    useBoardLeaveWarning(changed || uploading);
    function requestClose() {
        if (uploadLock.current) {
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
    const locationKey = JSON.stringify(draft.location);
    const matchedAutomaticImage = automaticImage?.locationKey === locationKey ? automaticImage : null;
    const visibleImages = [...activityImages, ...(!hasUpload && matchedAutomaticImage ? [matchedAutomaticImage] : [])];
    const availableImages = images.filter((image) => image.source === "upload" && image.pinId !== pin.id);
    function openGallery(index: number) {
        setGallery({
            placements: [...visibleImages, ...availableImages].map((image) => ({
                id: image.id,
                image: { ...editorPhoto(image), url: photoUrl(image.url) }
            })),
            index
        });
    }
    const chosenPhoto = draft.coverPhoto
        ? visibleImages.find((image) =>
              draft.coverPhoto?.source === "upload"
                  ? image.uploadedImageId === draft.coverPhoto.imageId
                  : image.source === "unsplash" && image.publicId === draft.coverPhoto?.providerImageId
          )
        : undefined;
    const cover =
        chosenPhoto ??
        (draft.coverPhoto === null
            ? visibleImages[0]
            : draft.coverImageId === null
              ? (visibleImages.find((image) => image.source === "unsplash") ?? null)
              : (visibleImages.find((image) => image.uploadedImageId === draft.coverImageId) ?? visibleImages[0]));

    const locationName = draft.location?.name;
    const latitude = draft.location?.latitude;
    const longitude = draft.location?.longitude;
    const city = draft.location?.city;
    const country = draft.location?.country;
    const hasSavedPhoto = activityImages.some((image) => image.source === "unsplash");
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
        if (files.length > Math.min(5, remainingUploads)) {
            setError("Choose up to 5 photos per batch. You can add another batch afterwards.");
            return;
        }
        uploadLock.current = true;
        onUploadingChange?.(true);
        setUploading(true);
        setError("");
        try {
            const { assets, failures } = await uploadBoardImageBatch(files);
            const completed: BoardImageDraft[] = assets.map((asset, index) => ({
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
                order: activityImages.length + index,
                activityOrder: activityImages.length + index,
                credit: null,
                creditUrl: null,
                sourceUrl: null
            }));
            completed.forEach(onAddImage);
            const defaults = activityBatchDefaults(completed);
            const locationImage = defaults.locationImage;
            const suggestion = locationImage?.uploadedImageId
                ? await suggestBoardPhotos([locationImage.uploadedImageId])
                      .then((results) => results[0])
                      .catch(() => undefined)
                : undefined;
            if (completed.length) {
                setAutomaticImage(null);
                if (locationImage) setPhotoSuggestion({ image: locationImage, suggestion });
                setDraft((current) => {
                    const filled = locationImage ? fillActivityFromPhoto(current, locationImage, suggestion) : current;
                    return {
                        ...filled,
                        title: fieldEdits.current.title || !suggestion?.location ? current.title : filled.title,
                        location: fieldEdits.current.location
                            ? current.location
                            : !suggestion?.location && filled.location && !current.location
                              ? { ...filled.location, name: "" }
                              : filled.location,
                        time: current.time || (fieldEdits.current.time ? "" : defaults.time),
                        category: fieldEdits.current.category ? current.category : filled.category,
                        coverImageId: cover || fieldEdits.current.cover ? current.coverImageId : defaults.coverImageId
                    };
                });
                setLocationVersion((current) => current + 1);
            }
            if (failures.length) setError(failures.join(" "));
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Photos could not be uploaded.");
        } finally {
            uploadLock.current = false;
            onUploadingChange?.(false);
            setUploading(false);
            if (inputRef.current) inputRef.current.value = "";
        }
    }

    return (
        <>
            {editingExternal ? (
                <PhotoEditorDialog
                    external={editingExternal}
                    onSaveExternal={(presentation) => onUpdateImage?.({ ...editingExternal, presentation })}
                    onClose={() => setEditingExternal(null)}
                />
            ) : null}
            {gallery !== null ? (
                <StoryGallery
                    placements={gallery.placements}
                    initialIndex={gallery.index}
                    onClose={() => setGallery(null)}
                />
            ) : null}
            {editingPhoto !== null ? (
                <PhotoEditorDialog imageId={editingPhoto} onClose={() => setEditingPhoto(null)} />
            ) : null}
            {confirmation ? (
                <ConfirmDialog
                    title={confirmation === "delete" ? "Remove this activity?" : "Discard activity edits?"}
                    description="Unsaved activity fields and photo attachments will be discarded. New uploads stay available in your Board. Saved crop/resize changes remain applied."
                    confirmLabel={confirmation === "delete" ? "Remove activity" : "Discard fields"}
                    onCancel={() => setConfirmation(null)}
                    onConfirm={() => {
                        if (confirmation === "delete") onDelete();
                        else onClose();
                    }}
                />
            ) : null}
            <div
                inert={confirmation !== null || editingPhoto !== null || gallery !== null || editingExternal !== null}
                className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4"
                role="presentation"
                onClick={(event) => {
                    event.stopPropagation();
                    if (event.target === event.currentTarget) requestClose();
                }}
            >
                <div
                    ref={dialogRef}
                    tabIndex={-1}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="edit-activity-heading"
                    className="bg-background max-h-[94dvh] w-full max-w-6xl overflow-y-auto overscroll-contain rounded-[1.75rem] p-6 shadow-2xl outline-none sm:p-10"
                >
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 id="edit-activity-heading" className="font-display text-30 font-bold">
                                {mode === "create" ? "Add Activity" : "Edit Activity"}
                            </h2>
                        </div>
                        <button
                            type="button"
                            onClick={requestClose}
                            className="border-line text-22 grid size-11 place-items-center rounded-full border"
                            aria-label={mode === "create" ? "Close activity dialog" : "Close activity editor"}
                        >
                            ×
                        </button>
                    </div>
                    <div className="mt-8 grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
                        <aside className="bg-faint/40 order-2 min-w-0 rounded-3xl p-5 lg:p-7">
                            <details open className="group">
                                <summary className="cursor-pointer text-sm font-medium">Activity photos</summary>
                                <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
                                    Upload up to five photos at a time. The earliest photo sets the initial cover; GPS
                                    and capture time can fill empty details. Your edits stay yours.
                                </p>
                                {cover ? (
                                    <figure className="mt-6">
                                        <button
                                            type="button"
                                            aria-label="Enlarge activity cover"
                                            className="editor-photo-card block w-full overflow-hidden rounded-2xl"
                                            onClick={() =>
                                                openGallery(
                                                    Math.max(
                                                        0,
                                                        visibleImages.findIndex((image) => image.id === cover.id)
                                                    )
                                                )
                                            }
                                        >
                                            <img
                                                src={photoUrl(cover.url)}
                                                decoding="async"
                                                onError={() => setError("The activity image could not load.")}
                                                alt={`Image for ${pin.title}`}
                                                className="aspect-video w-full object-cover"
                                            />
                                        </button>
                                        <StoryPhotoCredit image={editorPhoto(cover)} />
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
                                    disabled={uploading || remainingUploads === 0}
                                    onClick={() => inputRef.current?.click()}
                                    className="group/action text-foreground mt-4 flex min-h-11 items-center gap-3 text-sm disabled:opacity-40"
                                    onDragOver={(event) => {
                                        event.preventDefault();
                                    }}
                                    onDrop={(event) => {
                                        event.preventDefault();
                                        if (!uploading) void upload(Array.from(event.dataTransfer.files));
                                    }}
                                >
                                    <Upload className="border-line size-10 rounded-full border p-2.5 transition-transform group-hover/action:scale-110 motion-reduce:transition-none" />
                                    {uploading ? "Uploading..." : "Add photos"}
                                </button>
                                <p className="text-muted-foreground mt-3 text-[11px] leading-relaxed">
                                    Saved crop/resize edits apply everywhere this photo is used, even if you cancel this
                                    activity.
                                </p>
                                <section className="mt-5" aria-label="Activity images">
                                    <h3 className="text-12 font-bold">Activity images</h3>
                                    {visibleImages.length === 0 ? (
                                        <p className="text-12 text-graphite mt-2">No images attached yet.</p>
                                    ) : null}
                                    <BoardPhotoStrip label="Activity images">
                                        {visibleImages.map((item, index) => (
                                            <li
                                                key={item.id}
                                                className="group/photo relative w-36 min-w-0 shrink-0 sm:w-40"
                                            >
                                                <button
                                                    type="button"
                                                    aria-label={`Enlarge activity photo ${index + 1}`}
                                                    className="block w-full overflow-hidden rounded-2xl"
                                                    onClick={() => openGallery(index)}
                                                >
                                                    <CroppedPhoto
                                                        thumbnail
                                                        presentation={item.presentation}
                                                        width={item.width}
                                                        height={item.height}
                                                        src={photoUrl(item.thumbnailUrl)}
                                                        draggable={false}
                                                        loading="lazy"
                                                        decoding="async"
                                                        alt={`${pin.title} image ${index + 1}`}
                                                        className="aspect-square w-full object-cover"
                                                    />
                                                </button>
                                                {item.uploadedImageId || item.source === "unsplash" ? (
                                                    <button
                                                        type="button"
                                                        disabled={uploading}
                                                        className="editor-icon-action absolute top-2 left-2 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within/photo:opacity-100 [@media(hover:hover)]:group-hover/photo:opacity-100"
                                                        aria-label={`Crop photo ${index + 1}`}
                                                        title="Crop"
                                                        onClick={() =>
                                                            item.uploadedImageId
                                                                ? setEditingPhoto(item.uploadedImageId)
                                                                : setEditingExternal(item)
                                                        }
                                                    >
                                                        <Crop size={16} />
                                                    </button>
                                                ) : null}
                                                {item.id === cover?.id ? (
                                                    <span className="text-10 mt-2 block font-bold">Activity cover</span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        disabled={uploading}
                                                        onClick={() => {
                                                            const nextCoverId = item.uploadedImageId ?? null;
                                                            fieldEdits.current.cover = true;

                                                            setDraft((current) => ({
                                                                ...current,
                                                                coverImageId: nextCoverId,
                                                                coverPhoto:
                                                                    item.source === "upload"
                                                                        ? {
                                                                              source: "upload",
                                                                              imageId: item.uploadedImageId!
                                                                          }
                                                                        : {
                                                                              source: "unsplash",
                                                                              providerImageId: item.publicId
                                                                          }
                                                            }));
                                                        }}
                                                        className="text-10 mt-2 underline"
                                                    >
                                                        Set as activity cover
                                                    </button>
                                                )}

                                                <div className="text-10 mt-2 flex flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        disabled={index === 0}
                                                        onClick={() => onReorderImage(pin.id, item.id, -1)}
                                                        aria-label={`Move image ${index + 1} earlier`}
                                                        className="underline disabled:opacity-40"
                                                    >
                                                        <ArrowLeft size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={index === activityImages.length - 1}
                                                        onClick={() => onReorderImage(pin.id, item.id, 1)}
                                                        aria-label={`Move image ${index + 1} later`}
                                                        className="underline disabled:opacity-40"
                                                    >
                                                        <ArrowRight size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            fieldEdits.current.cover = true;
                                                            onRemoveImage?.(item.id);
                                                            if (item.id === cover?.id)
                                                                setDraft((current) => ({
                                                                    ...current,
                                                                    coverPhoto: null,
                                                                    coverImageId: activityBatchDefaults(
                                                                        activityImages.filter(
                                                                            (image) => image.id !== item.id
                                                                        )
                                                                    ).coverImageId
                                                                }));
                                                        }}
                                                        disabled={uploading}
                                                        aria-label={`Delete image ${index + 1}`}
                                                        className="editor-icon-action absolute top-2 right-2 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within/photo:opacity-100 [@media(hover:hover)]:group-hover/photo:opacity-100"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
                                    </BoardPhotoStrip>
                                </section>
                                {availableImages.length > 0 ? (
                                    <section className="mt-5" aria-label="Other uploaded images">
                                        <h3 className="text-12 font-bold">Attach a Board upload</h3>
                                        <BoardPhotoStrip label="Board uploaded images">
                                            {availableImages.map((item) => (
                                                <li key={item.id} className="group/photo w-36 shrink-0 sm:w-40">
                                                    <button
                                                        type="button"
                                                        aria-label="Enlarge Board upload"
                                                        className="editor-photo-card block w-full overflow-hidden rounded-xl"
                                                        onClick={() => {
                                                            openGallery(
                                                                visibleImages.length + availableImages.indexOf(item)
                                                            );
                                                        }}
                                                    >
                                                        <img
                                                            src={photoUrl(item.thumbnailUrl)}
                                                            draggable={false}
                                                            loading="lazy"
                                                            decoding="async"
                                                            width={96}
                                                            height={96}
                                                            alt="Board upload"
                                                            className="aspect-square w-full object-cover"
                                                        />
                                                    </button>
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
                                <ActivityPhotoSearch
                                    onPreview={(photos, index) =>
                                        setGallery({
                                            placements: photos.map((photo) => ({
                                                id: photo.id,
                                                image: { ...photo, source: "application" }
                                            })),
                                            index
                                        })
                                    }
                                    disabled={uploading}
                                    selectedIds={activityImages
                                        .filter((image) => image.source === "unsplash")
                                        .map((image) => image.publicId)}
                                    onSelect={(photo) => {
                                        setSkipAutomaticPhoto(true);
                                        setAutomaticImage(null);
                                        onAddImage({
                                            id: crypto.randomUUID(),
                                            pinId: pin.id,
                                            publicId: photo.id,
                                            source: "unsplash",
                                            url: photo.url,
                                            thumbnailUrl: photo.thumbnailUrl,
                                            alt: photo.alt,
                                            width: photo.width,
                                            height: photo.height,
                                            presentation: null,
                                            context: null,
                                            capturedAt: null,
                                            latitude: null,
                                            longitude: null,
                                            order: images.length,
                                            activityOrder: activityImages.length,
                                            credit: photo.photographer,
                                            creditUrl: photo.photographerUrl,
                                            sourceUrl: photo.sourceUrl
                                        });
                                        if (!visibleImages.length)
                                            setDraft((current) => ({
                                                ...current,
                                                coverPhoto: { source: "unsplash", providerImageId: photo.id },
                                                coverImageId: null
                                            }));
                                    }}
                                />
                                <p role="status" className="text-muted-foreground mt-4 text-xs leading-relaxed">
                                    {hasUpload ? "Your uploaded photos are used for this activity." : photoStatus}
                                </p>
                                {cover?.context ? (
                                    <p className="mt-3 text-xs">Illustrative photo ? {cover.context.locationLabel}</p>
                                ) : null}
                                {!hasUpload && draft.location && !photoSearching ? (
                                    <ActivityPhotoSuggestions
                                        key={locationKey + draft.category}
                                        target={{
                                            name: draft.location.name.slice(0, 160),
                                            category: draft.category,
                                            latitude: draft.location.latitude,
                                            longitude: draft.location.longitude,
                                            ...(draft.location.city ? { city: draft.location.city.slice(0, 160) } : {}),
                                            ...(draft.location.countryCode
                                                ? { countryCode: draft.location.countryCode }
                                                : {})
                                        }}
                                        onSelect={(photo) => {
                                            setSkipAutomaticPhoto(true);
                                            setPhotoSearching(false);
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
                                                sourceUrl: photo.sourceUrl,
                                                context: photo.context
                                            });
                                        }}
                                    />
                                ) : null}
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
                        <div className="order-1 min-w-0">
                            <label className="text-muted-foreground mb-6 block text-xs">
                                Activity title
                                <input
                                    aria-label="Activity title"
                                    value={draft.title}
                                    placeholder="A moment worth remembering"
                                    className="font-display border-line text-foreground focus:border-foreground mt-2 block w-full border-b bg-transparent pb-3 text-3xl font-bold outline-none"
                                    onChange={(event) => {
                                        fieldEdits.current.title = true;
                                        setDraft((current) => ({ ...current, title: event.target.value }));
                                    }}
                                />
                            </label>
                            <ActivityLocationSearch
                                proximity={searchArea}
                                key={locationVersion}
                                value={draft.location}
                                disabled={uploading}
                                onSearchEdited={() => {
                                    fieldEdits.current.location = true;
                                    setLocationEditVersion((version) => version + 1);
                                }}
                                onSelect={(location, category) => {
                                    fieldEdits.current.location = true;
                                    setLocationEditVersion((version) => version + 1);
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
                                        title: fieldEdits.current.title
                                            ? current.title
                                            : current.title || location?.name || "",
                                        source: location ? "geoapify" : "manual",
                                        category: fieldEdits.current.category
                                            ? current.category
                                            : (category ?? current.category)
                                    }));
                                }}
                            />
                            <ActivityPinMap
                                editVersion={locationEditVersion}
                                location={draft.location}
                                proximity={searchArea}
                                disabled={uploading}
                                onChange={(location) => {
                                    fieldEdits.current.location = true;
                                    setDraft((current) => ({
                                        ...current,
                                        location,
                                        source: "manual",
                                        title: fieldEdits.current.title
                                            ? current.title
                                            : current.title || location?.name || ""
                                    }));
                                    setLocationVersion((version) => version + 1);
                                }}
                            />
                            {draft.location ? (
                                <label className="text-muted-foreground mt-5 block text-xs">
                                    Location name
                                    <input
                                        aria-label="Location name"
                                        className="border-line text-foreground mt-2 min-h-11 w-full border-b bg-transparent outline-none"
                                        value={draft.location.name}
                                        onChange={(event) => {
                                            fieldEdits.current.location = true;
                                            setLocationEditVersion((version) => version + 1);
                                            setDraft((current) => ({
                                                ...current,
                                                location: current.location
                                                    ? { ...current.location, name: event.target.value }
                                                    : null
                                            }));
                                        }}
                                    />
                                </label>
                            ) : (
                                <p className="text-muted-foreground mt-4 text-xs">
                                    A location is optional. Activities without a pin appear in your itinerary only.
                                </p>
                            )}
                            {photoSuggestion &&
                            draft.location &&
                            photoActivityLocation(photoSuggestion.image, photoSuggestion.suggestion) ? (
                                <button
                                    type="button"
                                    disabled={uploading}
                                    className="mt-3 text-xs underline underline-offset-4"
                                    onClick={() => {
                                        const location = photoActivityLocation(
                                            photoSuggestion.image,
                                            photoSuggestion.suggestion
                                        );
                                        if (location) {
                                            fieldEdits.current.location = true;
                                            setLocationEditVersion((version) => version + 1);
                                            if (
                                                !photoSuggestion.suggestion?.location ||
                                                ["unknown", "address"].includes(
                                                    photoSuggestion.suggestion.location.type
                                                )
                                            )
                                                location.name = "";
                                            setDraft((current) => ({
                                                ...current,
                                                location,
                                                title: current.title || location.name,
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
                                    disabled={uploading}
                                    value={draft.time}
                                    onChange={(event) => {
                                        fieldEdits.current.time = true;
                                        setDraft((current) => ({ ...current, time: event.target.value }));
                                    }}
                                    className="border-line text-foreground focus:border-foreground mt-2 block min-h-11 w-full border-b bg-transparent text-base outline-none"
                                />
                            </label>
                            <label className="text-12 text-graphite mt-5 block">
                                Category
                                <span className="border-line mt-2 flex items-center gap-3 border-b py-2">
                                    <PinCategoryIcon category={draft.category} />
                                    <select
                                        disabled={uploading}
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
                                    disabled={uploading}
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
                            <div className="mt-8 flex flex-wrap justify-between gap-3">
                                {mode === "edit" ? (
                                    <button
                                        type="button"
                                        disabled={uploading}
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
                                        uploading || Boolean(activityNoteError(draft.description, pin.description))
                                    }
                                    onClick={() => {
                                        if (activityNoteError(draft.description, pin.description)) return;
                                        if (draft.title.trim() && (!draft.location || draft.location.name.trim())) {
                                            if (matchedAutomaticImage)
                                                activityImages
                                                    .filter((image) => image.source === "unsplash")
                                                    .forEach((image) => onRemoveImage?.(image.id));
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
                                            setError("Add an activity title and name any selected pin before saving.");
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

export default function ActivityEditorDialog(props: Props) {
    const [media, setMedia] = useState(props.images);
    const mediaRef = useRef(media);
    const removed = useRef(new Set<string>());
    const update = (next: BoardImageDraft[]) => {
        mediaRef.current = next;
        setMedia(next);
    };
    return (
        <ActivityEditorContent
            {...props}
            originalImages={props.images}
            images={media}
            onAddImage={(image) => {
                if (image.source === "upload") props.onAddImage({ ...image, pinId: null });
                update([...mediaRef.current, image]);
            }}
            onUpdateImage={(image) => update(mediaRef.current.map((item) => (item.id === image.id ? image : item)))}
            onAssignImage={(id, pinId) =>
                update(
                    mediaRef.current.map((image) =>
                        image.id === id
                            ? {
                                  ...image,
                                  pinId,
                                  activityOrder: mediaRef.current.filter((item) => item.pinId === pinId).length
                              }
                            : image
                    )
                )
            }
            onRemoveImage={(id) => {
                removed.current.add(id);
                update(mediaRef.current.filter((image) => image.id !== id));
            }}
            onReorderImage={(pinId, id, direction) => {
                const attached = mediaRef.current
                    .filter((image) => image.pinId === pinId)
                    .sort((a, b) => (a.activityOrder ?? a.order) - (b.activityOrder ?? b.order));
                const index = attached.findIndex((image) => image.id === id);
                const target = index + direction;
                if (index < 0 || target < 0 || target >= attached.length) return;
                [attached[index], attached[target]] = [attached[target], attached[index]];
                update(
                    mediaRef.current.map((image) => {
                        const order = attached.findIndex((item) => item.id === image.id);
                        return order < 0 ? image : { ...image, activityOrder: order };
                    })
                );
            }}
            onSave={(pin) => {
                props.onSave(pin);
                removed.current.forEach((id) => {
                    props.onAssignImage(id, null);
                    if (props.images.find((image) => image.id === id)?.source !== "upload") props.onRemoveImage?.(id);
                });
                [...mediaRef.current]
                    .sort((a, b) => (a.activityOrder ?? a.order) - (b.activityOrder ?? b.order))
                    .forEach((image) => {
                        const original = props.images.find((item) => item.id === image.id);
                        if (!original && image.source === "unsplash") props.onAddImage(image);
                        else if (
                            original &&
                            JSON.stringify(original.presentation) !== JSON.stringify(image.presentation)
                        )
                            props.onUpdateImage?.(image);
                        if (original?.pinId !== image.pinId) props.onAssignImage(image.id, image.pinId);
                    });
                const current = props.images
                    .filter((image) => image.pinId === pin.id && !removed.current.has(image.id))
                    .sort((a, b) => (a.activityOrder ?? a.order) - (b.activityOrder ?? b.order))
                    .map((image) => image.id);
                const desired = mediaRef.current
                    .filter((image) => image.pinId === pin.id)
                    .sort((a, b) => (a.activityOrder ?? a.order) - (b.activityOrder ?? b.order));
                desired.forEach((image, index) => {
                    if (!current.includes(image.id)) current.push(image.id);
                    const from = current.indexOf(image.id);
                    Array.from({ length: Math.max(0, from - index) }).forEach(() =>
                        props.onReorderImage(pin.id, image.id, -1)
                    );
                    current.splice(from, 1);
                    current.splice(index, 0, image.id);
                });
            }}
        />
    );
}
