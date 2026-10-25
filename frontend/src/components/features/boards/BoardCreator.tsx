"use client";
import BoardEditorRail from "./BoardEditorRail";
import BoardPlanMap from "./BoardPlanMap";
import { suggestMainDestination } from "@/lib/board-creator-api";
import BoardDestinationSearch from "./BoardDestinationSearch";
import type { BoardDestinationDraft } from "@/types/board-creator";

import { activityBatchDefaults } from "@/lib/activity-photo";
import { movePlannerPin } from "@/lib/board-planner";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import BoardPreviewSection from "@/components/features/boards/BoardPreviewSection";
import BoardPublishPanel from "@/components/features/boards/BoardPublishPanel";
import BoardDiscoveryDetails from "@/components/features/boards/BoardDiscoveryDetails";
import BoardImageIntake, { type UploadedBoardImage } from "@/components/features/boards/BoardImageIntake";
import CreatorSectionIntro from "@/components/features/boards/CreatorSectionIntro";
import DayPlanner from "@/components/features/boards/DayPlanner";
import CreatorNotifications, { creatorToastOptions } from "./CreatorNotifications";
import CreatorProgress from "./CreatorProgress";
import { toast } from "sonner";
import CreatorLeaveDialog from "./CreatorLeaveDialog";
import CreatorDeleteDialog from "./CreatorDeleteDialog";
import { publicationErrors, boardEditorFingerprint, type BoardLeaveNavigation } from "@/lib/board-editor-safety";
import { useBoardLeaveWarning } from "@/lib/use-board-leave-warning";
import {
    fromBoardDocument,
    listBoardTags,
    loadBoardDocument,
    prepareBoardRemix,
    mergeServerIds,
    mergeServerImages,
    saveBoardDocument,
    toBoardWrite,
    type BoardDocument
} from "@/lib/board-creator-api";
import type {
    BoardCreatorPayload,
    BoardDayDraft,
    BoardImageDraft,
    BoardPinDraft,
    BoardStatus
} from "@/types/board-creator";
import { buildSmartCreatePlan, type SmartCreatePlan } from "@/lib/smart-create";
import SmartCreateReviewDialog from "./SmartCreateReviewDialog";
import { loadProfile } from "@/lib/profile";
import { findCountry } from "@/lib/countries";
import type { StartingPlace } from "@/lib/destination-places";

function newDay(dayNumber: number, date: string | null = null): BoardDayDraft {
    return { id: crypto.randomUUID(), dayNumber, date, pins: [] };
}

function normalizePinOrder(pins: BoardPinDraft[]): BoardPinDraft[] {
    return pins.map((pin, order) => ({ ...pin, order }));
}

export default function BoardCreator({
    initialBoardId,
    initialRemixBoardId,
    expectedStatus = "draft",
    initialMode = "smart",
    initialPlace,
    backHref
}: {
    initialBoardId?: number;
    initialRemixBoardId?: number;
    expectedStatus?: BoardStatus;
    initialMode?: "smart" | "scratch";
    initialPlace?: StartingPlace;
    backHref?: string;
}) {
    const [smartStartDate, setSmartStartDate] = useState<string | null>(null);
    const [pendingPlan, setPendingPlan] = useState<SmartCreatePlan | null>(null);
    const [leaveTarget, setLeaveTarget] = useState<{ href: string; navigation: BoardLeaveNavigation } | null>(null);
    const requestLeave = useCallback((href: string, navigation: BoardLeaveNavigation) => {
        setLeaveTarget({ href, navigation });
    }, []);
    const saveToastId = useId();
    const saveInFlight = useRef(false);
    const [title, setTitle] = useState(
        initialPlace && initialBoardId === undefined ? `${initialPlace.city} board` : ""
    );
    const destinationTouched = useRef(false);
    const destinationLookupKey = useRef("");
    const [destinationSuggested, setDestinationSuggested] = useState(false);
    const [destinationGeneration, setDestinationGeneration] = useState(0);
    const [destination, setDestination] = useState<BoardDestinationDraft | null>(null);
    const [description, setDescription] = useState("");
    const [fillerImagesEnabled, setFillerImagesEnabled] = useState(false);
    const [previewAuthor, setPreviewAuthor] = useState("");
    const [images, setImages] = useState<BoardImageDraft[]>([]);
    const [selectedCoverImageId, setSelectedCoverImageId] = useState<number | null>(null);
    const initialDayId = useId();
    const [mapActivityId, setMapActivityId] = useState<string | null>(null);
    // A discovered place starts as an editable Day 1 activity. Nothing is saved until the user saves the Board.
    const [days, setDays] = useState<BoardDayDraft[]>(() => [
        {
            id: initialDayId,
            dayNumber: 1,
            date: null,
            pins:
                initialPlace && initialBoardId === undefined
                    ? [
                          {
                              id: `${initialDayId}-place`,
                              order: 0,
                              time: "",
                              title: initialPlace.name,
                              description: "",
                              category: "activity",
                              source: initialPlace.id.startsWith("wikivoyage:") ? "manual" : "geoapify",
                              location: {
                                  name: initialPlace.name,
                                  address: initialPlace.address,
                                  latitude: initialPlace.latitude,
                                  longitude: initialPlace.longitude,
                                  city: initialPlace.city,
                                  country: findCountry(initialPlace.country)?.name ?? null,
                                  countryCode: initialPlace.country,
                                  mapboxId: initialPlace.id
                              }
                          }
                      ]
                    : []
        }
    ]);
    const [tags, setTags] = useState<string[]>([]);
    const [allowedTags, setAllowedTags] = useState<Array<{ tagId: number; name: string }>>([]);
    const [visibility, setVisibility] = useState<BoardCreatorPayload["visibility"]>("collaborators");
    const visibilityTouched = useRef(false);
    const [preferenceLoading, setPreferenceLoading] = useState(initialBoardId === undefined);
    const [preferenceError, setPreferenceError] = useState(false);
    const [saving, setSaving] = useState<BoardStatus | null>(null);
    const [boardUploading, setBoardUploading] = useState(false);
    const [activityUploading, setActivityUploading] = useState(false);
    const uploading = boardUploading || activityUploading;
    const pendingUploadRef = useRef<Promise<unknown> | null>(null);
    const [draftLoading, setDraftLoading] = useState(initialBoardId !== undefined || initialRemixBoardId !== undefined);
    const [remixReady, setRemixReady] = useState(initialRemixBoardId === undefined);
    const [remixAttempt, setRemixAttempt] = useState(0);
    const remixRequest = useRef<ReturnType<typeof prepareBoardRemix> | null>(null);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [saveMessage, setSaveMessage] = useState("");
    const [saveError, setSaveError] = useState("");
    const [showValidation, setShowValidation] = useState(false);
    const [tagsLoading, setTagsLoading] = useState(true);
    const [tagsError, setTagsError] = useState("");
    const [savedFingerprint, setSavedFingerprint] = useState<string | null>(null);
    const [savedBoard, setSavedBoard] = useState<BoardDocument | null>(null);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const editorDisabled =
        deleteOpen ||
        deleting ||
        pendingPlan !== null ||
        saving !== null ||
        draftLoading ||
        !remixReady ||
        (initialBoardId !== undefined && !savedBoard) ||
        (savedBoard?.status === "published" && expectedStatus !== "published");
    const loadTags = useCallback(
        () =>
            listBoardTags()
                .then(setAllowedTags)
                .catch((caught: unknown) =>
                    setTagsError(caught instanceof Error ? caught.message : "Tags could not be loaded.")
                )
                .finally(() => setTagsLoading(false)),
        []
    );

    useEffect(() => {
        void loadTags();
    }, [loadTags]);

    useEffect(() => {
        if (initialBoardId === undefined) return;
        void loadBoardDocument(initialBoardId)
            .then((board) => {
                if (board.status !== expectedStatus) throw new Error(`This Board is not ${expectedStatus}.`);
                if (!board.permissions.canEditContent) throw new Error("You cannot edit this Board.");
                const restored = fromBoardDocument(board);
                setSavedFingerprint(
                    boardEditorFingerprint({
                        fillerImagesEnabled: board.fillerImagesEnabled ?? false,
                        destination: restored.destination,
                        title: board.title,
                        description: board.description ?? "",
                        status: board.status,
                        visibility: board.visibility,
                        coverImageId:
                            board.coverImageId ??
                            restored.images.find((image) => image.source === "upload")?.uploadedImageId ??
                            null,
                        tags: board.tags.map((tag) => tag.name),
                        days: restored.days,
                        images: restored.images
                    })
                );
                setSavedBoard(board);
                setFillerImagesEnabled(board.fillerImagesEnabled ?? false);
                setDestination(restored.destination);
                setTitle(board.title);
                setDescription(board.description ?? "");
                setVisibility(board.visibility);
                setTags(board.tags.map((tag) => tag.name));
                setDays(restored.days);
                setImages(restored.images);
                setSelectedCoverImageId(board.coverImageId);
            })
            .catch((caught: unknown) =>
                setError(caught instanceof Error ? caught.message : "Board could not be loaded.")
            )
            .finally(() => setDraftLoading(false));
    }, [initialBoardId, expectedStatus]);

    useEffect(() => {
        if (initialRemixBoardId === undefined) return;
        const current = { active: true };
        // Strict Mode replays effects; reuse the in-flight preparation rather than copying photos twice.
        remixRequest.current ??= prepareBoardRemix(initialRemixBoardId);
        void remixRequest.current
            .then((board) => {
                if (!current.active) return;
                const restored = fromBoardDocument(board);
                destinationTouched.current = true;
                setDestination(restored.destination);
                setTitle(board.title);
                setDescription(board.description ?? "");
                setTags(board.tags.map((tag) => tag.name));
                setDays(restored.days);
                setImages(restored.images);
                setSelectedCoverImageId(board.coverImageId);
                setRemixReady(true);
            })
            .catch((caught: unknown) => {
                if (current.active)
                    setError(caught instanceof Error ? caught.message : "Saved Board could not be prepared.");
            })
            .finally(() => {
                if (current.active) setDraftLoading(false);
            });
        return () => {
            current.active = false;
        };
    }, [initialRemixBoardId, remixAttempt]);

    const uploadedImages = images.filter((image) => image.source === "upload");
    const coverImageId = uploadedImages.some((image) => image.uploadedImageId === selectedCoverImageId)
        ? selectedCoverImageId
        : (uploadedImages[0]?.uploadedImageId ?? null);

    const payload: BoardCreatorPayload = {
        fillerImagesEnabled,
        destination,
        title,
        description,
        status: "draft",
        visibility,
        coverImageId,
        tags,
        days,
        images
    };

    const activityPoints = JSON.stringify(
        days
            .flatMap((day) =>
                day.pins.flatMap((pin) =>
                    pin.location
                        ? [
                              {
                                  latitude: pin.location.latitude,
                                  longitude: pin.location.longitude,
                                  city: pin.location.city,
                                  country: pin.location.countryCode ?? pin.location.country
                              }
                          ]
                        : []
                )
            )
            .slice(0, 100)
    );
    useEffect(() => {
        if (destination || draftLoading || destinationTouched.current) return;
        const points = JSON.parse(activityPoints) as Array<{
            latitude: number;
            longitude: number;
            city: string | null;
            country: string | null;
        }>;
        if (points.length < 3 || destinationLookupKey.current === activityPoints) return;
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            destinationLookupKey.current = activityPoints;
            void suggestMainDestination(points, controller.signal)
                .then((place) => {
                    if (place && !controller.signal.aborted && !destinationTouched.current) {
                        setDestination(place);
                        setDestinationSuggested(true);
                        setDestinationGeneration((current) => current + 1);
                    }
                })
                .catch(() => {});
        }, 1000);
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [activityPoints, destination, draftLoading]);

    const fingerprint = boardEditorFingerprint(payload);
    const initialPayload = useRef(payload);
    const [initialFingerprint, setInitialFingerprint] = useState(fingerprint);
    useEffect(() => {
        if (initialBoardId !== undefined) return;
        void loadProfile()
            .then((profile) => {
                setPreviewAuthor(profile.username);
                if (!visibilityTouched.current) {
                    setVisibility(profile.defaultBoardVisibility);
                    setInitialFingerprint(
                        boardEditorFingerprint({
                            ...initialPayload.current,
                            visibility: profile.defaultBoardVisibility
                        })
                    );
                }
            })
            .catch((caught: unknown) => {
                if (!visibilityTouched.current) {
                    setPreferenceError(true);
                    setError(caught instanceof Error ? caught.message : "Board preferences could not be loaded.");
                }
            })
            .finally(() => setPreferenceLoading(false));
    }, [initialBoardId]);
    const dirty = fingerprint !== (savedFingerprint ?? initialFingerprint);
    useBoardLeaveWarning(
        !deleting &&
            (((!editorDisabled || pendingPlan !== null || deleteOpen) && dirty) || saving !== null || uploading),
        requestLeave
    );
    useEffect(
        () => () => {
            toast.dismiss(saveToastId);
        },
        [saveToastId]
    );

    function applySmartPlan(plan: SmartCreatePlan) {
        setSmartStartDate(plan.startDate);
        setDays(plan.days);
        setImages(plan.images);
        setPendingPlan(null);
        setMessage(
            [
                plan.createdCount + " activities created. You can edit their places in your day plan.",
                ...plan.warnings
            ].join(" ")
        );
    }
    function handleUploads(items: UploadedBoardImage[]) {
        // Scratch mode keeps uploaded photos available for manual activity attachment.
        if (initialBoardId !== undefined || initialMode === "scratch") {
            setImages((current) => [
                ...current,
                ...items.map((item, index) => ({ ...item.image, pinId: null, order: current.length + index }))
            ]);
            setMessage("Photos uploaded. Open an activity to attach them.");
            return;
        }
        const plan = buildSmartCreatePlan(days, images, items, smartStartDate);
        setError("");
        if (plan.requiresConfirmation || !plan.canApply) {
            // Uploads are retained even when the user declines a timeline change.
            setImages((current) => [
                ...current,
                ...items.map((item, index) => ({ ...item.image, pinId: null, order: current.length + index }))
            ]);
            if (plan.canApply) setPendingPlan(plan);
            else setMessage(plan.warnings.join(" "));
        } else applySmartPlan(plan);
    }

    function removeImage(imageId: string) {
        const image = images.find((item) => item.id === imageId);
        setImages((current) =>
            current.filter((item) => item.id !== imageId).map((item, order) => ({ ...item, order }))
        );
        if (image)
            setDays((current) =>
                current.map((day) => ({
                    ...day,
                    pins: day.pins.map((pin) =>
                        pin.id === image.pinId &&
                        (image.source === "upload"
                            ? pin.coverImageId === image.uploadedImageId ||
                              (pin.coverPhoto?.source === "upload" && pin.coverPhoto.imageId === image.uploadedImageId)
                            : pin.coverPhoto?.source === "unsplash" &&
                              pin.coverPhoto.providerImageId === image.publicId)
                            ? { ...pin, coverImageId: null, coverPhoto: null }
                            : pin
                    )
                }))
            );
    }

    function addPin(dayId: string, pin: BoardPinDraft, image: BoardImageDraft | null) {
        setDays((current) =>
            current.map((day) => (day.id === dayId ? { ...day, pins: normalizePinOrder([...day.pins, pin]) } : day))
        );
        if (image) setImages((current) => [...current, { ...image, order: current.length }]);
    }

    function updatePin(pin: BoardPinDraft) {
        setDays((current) =>
            current.map((day) => ({
                ...day,
                pins: day.pins.map((item) => (item.id === pin.id ? pin : item))
            }))
        );
    }

    function removePin(pinId: string) {
        setDays((current) =>
            current.map((day) => ({
                ...day,
                pins: normalizePinOrder(day.pins.filter((pin) => pin.id !== pinId))
            }))
        );
        setImages((current) =>
            current.map((image) =>
                image.pinId === pinId ? { ...image, pinId: null, activityOrder: undefined } : image
            )
        );
    }

    function removeDay(dayId: string) {
        const removedPinIds = new Set(days.find((day) => day.id === dayId)?.pins.map((pin) => pin.id) ?? []);
        setDays((current) =>
            current.filter((day) => day.id !== dayId).map((day, index) => ({ ...day, dayNumber: index + 1 }))
        );
        setImages((current) =>
            current.map((image) =>
                image.pinId && removedPinIds.has(image.pinId)
                    ? { ...image, pinId: null, activityOrder: undefined }
                    : image
            )
        );
    }

    function addActivityImage(image: BoardImageDraft) {
        setImages((current) => [
            ...current,
            {
                ...image,
                order: current.filter((item) => item.source === "upload").length,
                activityOrder: current.filter((item) => item.pinId === image.pinId).length
            }
        ]);
    }

    function assignActivityImage(imageId: string, pinId: string | null) {
        const moving = images.find((image) => image.id === imageId);
        if (moving?.pinId && moving.pinId !== pinId) {
            const replacement = activityBatchDefaults(
                images.filter((image) => image.pinId === moving.pinId && image.id !== imageId)
            ).coverImageId;
            setDays((current) =>
                current.map((day) => ({
                    ...day,
                    pins: day.pins.map((pin) =>
                        pin.id === moving.pinId && pin.coverImageId === moving.uploadedImageId
                            ? {
                                  ...pin,
                                  coverImageId: replacement,
                                  coverPhoto: replacement ? { source: "upload" as const, imageId: replacement } : null
                              }
                            : pin
                    )
                }))
            );
        }
        setImages((current) => {
            const nextPosition = current.filter((item) => item.pinId === pinId).length;
            return current.map((image) =>
                image.id === imageId
                    ? {
                          ...image,
                          pinId,
                          activityOrder: pinId === null ? undefined : nextPosition
                      }
                    : image
            );
        });
    }

    function removeActivityImage(imageId: string) {
        const image = images.find((item) => item.id === imageId);
        if (image?.source === "upload") assignActivityImage(imageId, null);
        else removeImage(imageId);
    }

    function reorderActivityImage(pinId: string, imageId: string, direction: -1 | 1) {
        setImages((current) => {
            const activityImages = current
                .filter((image) => image.pinId === pinId)
                .sort((first, second) => (first.activityOrder ?? first.order) - (second.activityOrder ?? second.order));
            const index = activityImages.findIndex((image) => image.id === imageId);
            const other = activityImages[index + direction];
            if (index < 0 || !other) return current;
            activityImages[index + direction] = activityImages[index]!;
            activityImages[index] = other;
            const positions = new Map(activityImages.map((image, order) => [image.id, order]));
            return current.map((image) =>
                positions.has(image.id) ? { ...image, activityOrder: positions.get(image.id) } : image
            );
        });
    }

    function movePin(pinId: string, dayId: string, time: string, index?: number) {
        setDays((current) => movePlannerPin(current, pinId, dayId, time, index));
    }

    const validationErrors = showValidation ? publicationErrors(payload) : [];
    function fieldError(field: string) {
        const error = validationErrors.find((item) => item.field === field);
        return error ? (
            <p id={field + "-error"} role="alert" className="mt-2 mb-4 text-sm text-red-600 dark:text-red-400">
                {error.message}
            </p>
        ) : null;
    }
    async function save(status: BoardStatus) {
        if (saveInFlight.current || editorDisabled || uploading) return;
        if ((preferenceLoading || preferenceError) && !visibilityTouched.current) {
            setSaveError("Wait for Board preferences or choose a visibility option above before saving.");
            return;
        }
        if (status === "published") {
            setShowValidation(true);
            const errors = publicationErrors(payload);
            if (errors.length) {
                setSaveError("");
                history.replaceState(history.state, "", `#${errors[0].field}`);
                window.dispatchEvent(new HashChangeEvent("hashchange"));
                document.getElementById(errors[0].field)?.focus({ preventScroll: true });
                return;
            }
        }
        saveInFlight.current = true;
        setSaving(status);
        setSaveError("");
        setSaveMessage("");
        toast.loading(
            status === "draft"
                ? "Saving your draft…"
                : expectedStatus === "published"
                  ? "Saving your changes…"
                  : "Publishing your Board…",
            { ...creatorToastOptions, id: saveToastId }
        );
        try {
            if (pendingUploadRef.current) {
                await pendingUploadRef.current;
                pendingUploadRef.current = null;
            }
            const currentPayload = {
                fillerImagesEnabled,
                destination,
                title,
                description,
                status,
                visibility,
                coverImageId,
                tags,
                days,
                images
            };
            const write = toBoardWrite(currentPayload, allowedTags);
            const sentDays = days;
            const expectedRevision = savedBoard ? savedBoard.revision + 1 : 1;
            const board = await saveBoardDocument(write, savedBoard);
            if (board.revision !== expectedRevision) {
                throw new Error(
                    "Board changed in another session while saving. Please refresh to load the latest changes."
                );
            }
            setSavedBoard(board);
            setSavedFingerprint(boardEditorFingerprint(currentPayload));
            toast.success(
                expectedStatus === "published"
                    ? "Board changes saved"
                    : status === "draft"
                      ? "Draft saved"
                      : "Board published",
                { ...creatorToastOptions, id: saveToastId }
            );
            setDays((current) => mergeServerIds(current, sentDays, board));
            setImages((current) => mergeServerImages(current, board));
            setSaveMessage(
                expectedStatus === "published"
                    ? "Board changes saved."
                    : status === "draft"
                      ? `Draft saved as “${board.title}”.`
                      : `“${board.title}” is published and ready to share.`
            );
        } catch (caught) {
            const detail = caught instanceof Error ? caught.message : "The Board could not be saved.";
            setSaveError(detail);
            toast.error("Board could not be saved", {
                ...creatorToastOptions,
                id: saveToastId,
                description: "Your edits are still here. Review the save details and try again.",
                action: {
                    label: "Review",
                    onClick: () => {
                        const feedback = document.getElementById("board-save-feedback");
                        feedback?.scrollIntoView({ block: "center" });
                        feedback?.focus({ preventScroll: true });
                    }
                }
            });
        } finally {
            saveInFlight.current = false;
            setSaving(null);
        }
    }

    return (
        <article className="font-body bg-background text-foreground relative min-w-0 overflow-x-clip">
            <CreatorNotifications />
            {deleteOpen && savedBoard?.permissions.canManageBoard ? (
                <CreatorDeleteDialog
                    boardId={savedBoard.boardId}
                    onClose={() => setDeleteOpen(false)}
                    onDeletingChange={setDeleting}
                />
            ) : null}
            {pendingPlan ? (
                <SmartCreateReviewDialog
                    plan={pendingPlan}
                    onConfirm={() => applySmartPlan(pendingPlan)}
                    onCancel={() => {
                        setPendingPlan(null);
                        setMessage(
                            "Your day plan is unchanged. New photos remain uploaded and available for manual assignment."
                        );
                    }}
                />
            ) : null}
            {leaveTarget ? <CreatorLeaveDialog {...leaveTarget} onClose={() => setLeaveTarget(null)} /> : null}
            <CreatorProgress
                backHref={backHref}
                dirty={dirty}
                saved={savedBoard !== null}
                loading={draftLoading}
                saving={saving}
                uploading={uploading}
            />
            <h1 className="sr-only">
                {initialBoardId === undefined
                    ? "Create a new Board"
                    : expectedStatus === "published"
                      ? "Edit published Board"
                      : "Edit Board draft"}
            </h1>

            <div>
                {initialRemixBoardId !== undefined && !remixReady && !draftLoading && (
                    <div className="mx-auto max-w-3xl px-5 py-8" role="alert">
                        <p>{error || "Saved Board could not be prepared."}</p>
                        <button
                            type="button"
                            className="mt-3 min-h-11 underline"
                            onClick={() => {
                                remixRequest.current = null;
                                setDraftLoading(true);
                                setError("");
                                setRemixAttempt((attempt) => attempt + 1);
                            }}
                        >
                            Retry saved Board
                        </button>
                    </div>
                )}
                <BoardEditorRail>
                    <fieldset
                        disabled={editorDisabled}
                        aria-busy={draftLoading}
                        className="contents disabled:pointer-events-none disabled:opacity-80"
                    >
                        <section id="board-basics" tabIndex={-1} data-editor-section>
                            <div className="mx-auto max-w-6xl">
                                <CreatorSectionIntro
                                    title="Set the scene"
                                    description="Every journey starts somewhere. Give yours a name and a view."
                                />
                                <div className="grid items-start gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
                                    <BoardImageIntake
                                        images={uploadedImages}
                                        coverImageId={coverImageId}
                                        disabled={editorDisabled || activityUploading || boardUploading}
                                        loading={draftLoading}
                                        onUploadingChange={setBoardUploading}
                                        onUploadPromise={(promise) => {
                                            pendingUploadRef.current = promise;
                                        }}
                                        onSelectCover={setSelectedCoverImageId}
                                        onUploaded={handleUploads}
                                        onRemove={removeImage}
                                        showDropZone={false}
                                        showGallery={false}
                                    />
                                    <div className="min-w-0">
                                        <label htmlFor="board-title" className="text-muted-foreground text-xs">
                                            Board title
                                        </label>
                                        <input
                                            id="board-title"
                                            aria-invalid={validationErrors.some(
                                                (error) => error.field === "board-title"
                                            )}
                                            aria-describedby={
                                                validationErrors.some((error) => error.field === "board-title")
                                                    ? "board-title-error"
                                                    : undefined
                                            }
                                            value={title}
                                            onChange={(event) => setTitle(event.target.value)}
                                            placeholder="Your next chapter"
                                            className="font-display border-line focus:border-foreground mt-2 mb-1 min-h-16 w-full border-b bg-transparent pb-4 text-4xl font-bold tracking-tight outline-none lg:text-5xl"
                                        />
                                        {fieldError("board-title")}
                                        <div
                                            id="board-destination"
                                            tabIndex={-1}
                                            className="mt-6 scroll-mt-36 [&>div]:mb-0"
                                        >
                                            <BoardDestinationSearch
                                                key={`${savedBoard?.boardId ?? "new"}-${destinationGeneration}`}
                                                value={destination}
                                                suggested={destinationSuggested}
                                                onChange={(place) => {
                                                    destinationTouched.current = true;
                                                    setDestinationSuggested(false);
                                                    setDestination(place);
                                                }}
                                            />
                                        </div>
                                        {fieldError("board-destination")}
                                        <label className="text-foreground/80 text-20 sm:text-24 block max-w-3xl min-w-0 font-bold">
                                            Description
                                            <textarea
                                                id="board-description"
                                                value={description}
                                                onChange={(event) => setDescription(event.target.value)}
                                                placeholder="What makes this journey yours?"
                                                rows={3}
                                                className="border-line text-foreground font-body text-14 placeholder:text-muted-foreground focus:border-foreground focus-visible:outline-foreground mt-3 w-full resize-y border-0 border-b bg-transparent py-3 leading-6 font-normal focus-visible:outline-1 focus-visible:outline-offset-4 sm:text-base"
                                            />
                                        </label>
                                    </div>
                                </div>
                                {message ? (
                                    <p role="status" className="mt-6 text-sm">
                                        {message}
                                    </p>
                                ) : null}
                                {error ? (
                                    <p role="alert" className="mt-6 text-sm">
                                        {error}
                                    </p>
                                ) : null}
                            </div>
                        </section>
                        <section id="day-plan" tabIndex={-1} data-editor-section>
                            <div className="mx-auto max-w-[96rem]">
                                <CreatorSectionIntro
                                    title="Make room for the memorable"
                                    description="Build each day around the places, pauses and little discoveries that matter."
                                />
                                <BoardImageIntake
                                    images={uploadedImages}
                                    coverImageId={coverImageId}
                                    disabled={editorDisabled || activityUploading || boardUploading}
                                    loading={draftLoading}
                                    onUploadingChange={setBoardUploading}
                                    onUploadPromise={(promise) => {
                                        pendingUploadRef.current = promise;
                                    }}
                                    onSelectCover={setSelectedCoverImageId}
                                    onUploaded={handleUploads}
                                    onRemove={removeImage}
                                    showCover={false}
                                    showDropZone={initialBoardId === undefined && initialMode === "smart"}
                                />
                                {fieldError("day-plan")}
                                <DayPlanner
                                    destination={destination}
                                    openActivityId={mapActivityId}
                                    onActivityOpened={() => setMapActivityId(null)}
                                    disabled={editorDisabled || boardUploading}
                                    onActivityUploadingChange={setActivityUploading}
                                    days={days}
                                    images={images}
                                    onAddDay={() =>
                                        setDays((current) =>
                                            current.length >= 31 ? current : [...current, newDay(current.length + 1)]
                                        )
                                    }
                                    onDayColorChange={(id, color) =>
                                        setDays((current) =>
                                            current.map((day) => (day.id === id ? { ...day, color } : day))
                                        )
                                    }
                                    onRemoveDay={removeDay}
                                    onAddPin={addPin}
                                    onUpdatePin={updatePin}
                                    onMovePin={movePin}
                                    onRemovePin={removePin}
                                    onRemoveActivityImage={removeActivityImage}
                                    onAddActivityImage={addActivityImage}
                                    onUpdateActivityImage={(updated) =>
                                        setImages((current) =>
                                            current.map((image) => (image.id === updated.id ? updated : image))
                                        )
                                    }
                                    onAssignActivityImage={assignActivityImage}
                                    onReorderActivityImage={reorderActivityImage}
                                />
                            </div>
                        </section>
                        <section id="board-map" tabIndex={-1} data-editor-section>
                            <div className="mx-auto h-full max-w-6xl">
                                <BoardPlanMap
                                    days={days}
                                    onOpenActivity={(activityId) => {
                                        if (!editorDisabled && !boardUploading) {
                                            document.getElementById("board-map")?.focus({ preventScroll: true });
                                            setMapActivityId(activityId);
                                        }
                                    }}
                                />
                            </div>
                        </section>
                        <section id="details-discovery" tabIndex={-1} data-editor-section>
                            <div className="mx-auto max-w-5xl">
                                <CreatorSectionIntro
                                    title="The finishing touches"
                                    description="Choose who can come along, and help your journey find its people."
                                />
                                <div className="mx-auto grid w-full max-w-4xl gap-10">
                                    <div>
                                        {" "}
                                        <BoardDiscoveryDetails
                                            tags={tags}
                                            allowedTags={allowedTags.map((tag) => tag.name)}
                                            visibility={visibility}
                                            canChangeVisibility={savedBoard?.permissions.canManageBoard ?? true}
                                            disabled={editorDisabled}
                                            tagsLoading={tagsLoading}
                                            tagsError={tagsError}
                                            onRetryTags={() => {
                                                setTagsLoading(true);
                                                setTagsError("");
                                                void loadTags();
                                            }}
                                            onTagsChange={setTags}
                                            onVisibilityChange={(value) => {
                                                visibilityTouched.current = true;
                                                setVisibility(value);
                                                if (preferenceError) {
                                                    setPreferenceError(false);
                                                    setError("");
                                                }
                                                setSaveError("");
                                            }}
                                        />
                                    </div>{" "}
                                    <div className="mb-8">
                                        <label className="flex cursor-pointer items-start gap-3 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={fillerImagesEnabled}
                                                disabled={editorDisabled}
                                                onChange={(event) => setFillerImagesEnabled(event.target.checked)}
                                                className="mt-1 size-4"
                                            />
                                            <span>
                                                Include destination illustrations
                                                <span className="text-muted-foreground mt-2 block text-xs">
                                                    Up to three credited destination photos, separate from your activity
                                                    photos.
                                                </span>
                                            </span>
                                        </label>
                                        {new Set(uploadedImages.map((image) => image.uploadedImageId ?? image.id))
                                            .size < 3 ? (
                                            <p className="text-muted-foreground mt-4 text-xs">
                                                Bring your story to life by adding photos or enabling destination
                                                illustrations. You can also publish without photos.
                                            </p>
                                        ) : null}
                                        {savedBoard?.fillerImagesEnabled &&
                                        ["partial", "unavailable"].includes(savedBoard.fillerImageStatus ?? "") ? (
                                            <p role="status" className="mt-4 text-xs">
                                                Your Board was saved. Some destination illustrations are unavailable; a
                                                later save can try again.
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        </section>
                    </fieldset>
                    <section id="board-preview" tabIndex={-1} data-editor-section>
                        <div className="mx-auto max-w-6xl">
                            <CreatorSectionIntro
                                title="Your journey, together"
                                description="Take one last look. Keep it for later, or let the world in."
                            />
                            <BoardPreviewSection
                                board={{ ...payload, status: savedBoard?.status ?? "draft" }}
                                author={savedBoard?.author.username ?? previewAuthor}
                                editable={!editorDisabled}
                                embedded
                                onRemovePhoto={(id) => {
                                    const image = images.find((item) => item.id === id);
                                    if (image?.pinId && image.source === "upload") assignActivityImage(id, null);
                                    else removeImage(id);
                                }}
                                onUpdatePhoto={(updated) =>
                                    setImages((current) =>
                                        current.map((image) => (image.id === updated.id ? updated : image))
                                    )
                                }
                                onEditActivity={setMapActivityId}
                            />
                            <div id="publish" className="border-line mt-10 border-t pt-8">
                                {" "}
                                <BoardPublishPanel
                                    expectedStatus={expectedStatus}
                                    savedBoard={savedBoard}
                                    disabled={editorDisabled}
                                    saving={saving}
                                    uploading={uploading}
                                    message={saveMessage}
                                    error={saveError}
                                    onSave={(status) => void save(status)}
                                    onDelete={() => setDeleteOpen(true)}
                                />
                            </div>
                        </div>
                    </section>
                </BoardEditorRail>
            </div>
        </article>
    );
}
