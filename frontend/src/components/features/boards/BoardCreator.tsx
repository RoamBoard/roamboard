"use client";
import BoardPlanMap from "./BoardPlanMap";
import { suggestMainDestination } from "@/lib/board-creator-api";
import BoardDestinationSearch from "./BoardDestinationSearch";
import type { BoardDestinationDraft } from "@/types/board-creator";

import { movePlannerPin, reorderPlannerPin } from "@/lib/board-planner";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

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
import { boardEditorFingerprint, type BoardLeaveNavigation } from "@/lib/board-editor-safety";
import { useBoardLeaveWarning } from "@/lib/use-board-leave-warning";
import {
    fromBoardDocument,
    listBoardTags,
    loadBoardDocument,
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

const chapterClasses =
    "mx-auto grid w-full max-w-[96rem] scroll-mt-36 gap-8 px-5 pb-20 sm:gap-10 sm:px-8 lg:grid-cols-[21rem_minmax(0,1fr)] lg:gap-16 lg:px-12 lg:pb-28";
const fullChapterClasses = `${chapterClasses} lg:min-h-[min(70rem,100svh)]`;

function newDay(dayNumber: number, date: string | null = null): BoardDayDraft {
    return { id: crypto.randomUUID(), dayNumber, date, pins: [] };
}

function normalizePinOrder(pins: BoardPinDraft[]): BoardPinDraft[] {
    return pins.map((pin, order) => ({ ...pin, order }));
}

export default function BoardCreator({
    initialBoardId,
    expectedStatus = "draft",
    initialMode = "smart",
    initialPlace
}: {
    initialBoardId?: number;
    expectedStatus?: BoardStatus;
    initialMode?: "smart" | "scratch";
    initialPlace?: StartingPlace;
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
    const [draftLoading, setDraftLoading] = useState(initialBoardId !== undefined);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [saveMessage, setSaveMessage] = useState("");
    const [saveError, setSaveError] = useState("");
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

    const uploadedImages = images.filter((image) => image.source === "upload");
    const coverImageId = uploadedImages.some((image) => image.uploadedImageId === selectedCoverImageId)
        ? selectedCoverImageId
        : (uploadedImages[0]?.uploadedImageId ?? null);

    const payload = useMemo<BoardCreatorPayload>(
        () => ({
            destination,
            title,
            description,
            status: "draft",
            visibility,
            coverImageId,
            tags,
            days,
            images
        }),
        [coverImageId, days, description, destination, images, tags, title, visibility]
    );

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
        if (image?.uploadedImageId)
            setDays((current) =>
                current.map((day) => ({
                    ...day,
                    pins: day.pins.map((pin) =>
                        pin.coverImageId === image.uploadedImageId ? { ...pin, coverImageId: null } : pin
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

    function setActivityCover(pinId: string, imageId: number | null) {
        setDays((current) =>
            current.map((day) => ({
                ...day,
                pins: day.pins.map((pin) => (pin.id === pinId ? { ...pin, coverImageId: imageId } : pin))
            }))
        );
    }

    function reorderActivityImage(pinId: string, imageId: string, direction: -1 | 1) {
        setImages((current) => {
            const activityImages = current
                .filter((image) => image.pinId === pinId && image.source === "upload")
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

    async function save(status: BoardStatus) {
        if (saveInFlight.current || editorDisabled || uploading) return;
        if ((preferenceLoading || preferenceError) && !visibilityTouched.current) {
            setSaveError("Wait for Board preferences or choose a visibility option above before saving.");
            return;
        }
        if (status === "published" && !destination) {
            setSaveError("Choose a main destination in Board Basics before publishing.");
            document.getElementById("board-basics")?.scrollIntoView({ behavior: "smooth" });
            return;
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
                <fieldset
                    disabled={editorDisabled}
                    aria-busy={draftLoading}
                    className="m-0 min-w-0 border-0 p-0 disabled:pointer-events-none disabled:opacity-80"
                >
                    <BoardImageIntake
                        images={images.filter((image) => image.source === "upload")}
                        coverImageId={coverImageId}
                        disabled={editorDisabled || activityUploading}
                        loading={draftLoading}
                        showDropZone={initialBoardId === undefined && initialMode === "smart"}
                        onUploadingChange={setBoardUploading}
                        onUploadPromise={(promise) => {
                            pendingUploadRef.current = promise;
                        }}
                        onSelectCover={setSelectedCoverImageId}
                        onUploaded={handleUploads}
                        onRemove={removeImage}
                    >
                        <div className="mx-auto mt-10 max-w-4xl px-5 text-center sm:mt-12">
                            <p className="font-display text-muted-foreground text-xs uppercase sm:text-sm lg:text-base">
                                {initialBoardId === undefined
                                    ? "Board creator"
                                    : expectedStatus === "published"
                                      ? "Board editor"
                                      : "Board draft"}
                            </p>
                            <label htmlFor="board-title" className="sr-only">
                                Board title
                            </label>
                            <input
                                id="board-title"
                                style={{ scrollMarginTop: "9rem" }}
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                placeholder={draftLoading ? "LOADING BOARD…" : "BOARD TITLE"}
                                className="font-display placeholder:text-foreground focus-visible:outline-foreground mt-3 min-h-12 w-full min-w-0 bg-transparent py-1 text-center text-[clamp(1.75rem,3.8vw,4rem)] leading-[1.02] font-bold tracking-[-0.035em] uppercase focus-visible:outline-1 focus-visible:outline-offset-4"
                            />
                        </div>

                        {message ? (
                            <p
                                className="border-foreground text-13 mx-auto mt-7 max-w-3xl border-l-2 pl-4"
                                role="status"
                            >
                                {message}
                            </p>
                        ) : null}
                        {draftLoading ? (
                            <p className="text-13 mx-auto mt-7 max-w-3xl" role="status">
                                Loading Board...
                            </p>
                        ) : null}
                        {error ? (
                            <p
                                className="border-foreground text-13 mx-auto mt-7 max-w-3xl border-l-2 pl-4"
                                role="alert"
                            >
                                {error}
                            </p>
                        ) : null}

                        <section
                            id="board-basics"
                            className={`${chapterClasses} mt-20 sm:mt-28 lg:mt-36 lg:min-h-[22rem]`}
                        >
                            <CreatorSectionIntro
                                number="01"
                                title="BOARD BASICS"
                                description="Let’s start with the essentials to set the scene for everything you’re about to plan."
                            />
                            <div className="max-w-3xl min-w-0">
                                <div id="board-destination" tabIndex={-1} className="scroll-mt-36">
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
                                <label className="text-foreground/80 text-20 sm:text-24 block max-w-3xl min-w-0 font-bold">
                                    Description
                                    <textarea
                                        id="board-description"
                                        value={description}
                                        onChange={(event) => setDescription(event.target.value)}
                                        placeholder="type here..."
                                        rows={7}
                                        className="border-line text-foreground font-body text-14 placeholder:text-muted-foreground focus:border-foreground focus-visible:outline-foreground mt-3 w-full resize-y border-0 border-b bg-transparent py-3 leading-6 font-normal focus-visible:outline-1 focus-visible:outline-offset-4 sm:text-base"
                                    />
                                </label>
                            </div>
                        </section>
                    </BoardImageIntake>

                    <section
                        id="day-plan"
                        tabIndex={-1}
                        className="mx-auto w-full max-w-[96rem] scroll-mt-36 px-5 pb-20 sm:px-8 lg:px-12 lg:pb-28"
                    >
                        <CreatorSectionIntro
                            number="02"
                            title="Build your day plan"
                            description="Add and arrange your activities. Click an open space in a day to add a location."
                        />
                        <div className="min-w-0">
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
                                onRemoveDay={removeDay}
                                onAddPin={addPin}
                                onUpdatePin={updatePin}
                                onMovePin={movePin}
                                onReorderPin={(pinId, direction) =>
                                    setDays((current) => reorderPlannerPin(current, pinId, direction))
                                }
                                onRemovePin={removePin}
                                onImageMetadataChange={(imageId, metadata) =>
                                    setImages((current) =>
                                        current.map((image) =>
                                            image.uploadedImageId === imageId ? { ...image, ...metadata } : image
                                        )
                                    )
                                }
                                onAddActivityImage={addActivityImage}
                                onAssignActivityImage={assignActivityImage}
                                onSetActivityCover={setActivityCover}
                                onReorderActivityImage={reorderActivityImage}
                            />
                        </div>
                    </section>

                    <section
                        id="board-map"
                        className="mx-auto w-full max-w-[96rem] scroll-mt-36 px-5 pb-20 sm:px-8 lg:px-12 lg:pb-28"
                    >
                        <BoardPlanMap
                            days={days}
                            onOpenActivity={(activityId) => {
                                if (editorDisabled || boardUploading) return;
                                setMapActivityId(activityId);
                            }}
                        />
                    </section>

                    <section id="details-discovery" className={fullChapterClasses}>
                        <CreatorSectionIntro
                            number="04"
                            title="DETAILS & DISCOVERY"
                            description="Give your Board more context to keep plans organized and make it easier for others to discover."
                        />
                        <div className="min-w-0 lg:self-center">
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
                        </div>
                    </section>
                </fieldset>

                <BoardPreviewSection
                    board={{ ...payload, status: savedBoard?.status ?? "draft" }}
                    author={savedBoard?.author.username ?? previewAuthor}
                    editable={!editorDisabled}
                />

                <section id="publish" className={`${fullChapterClasses} mb-20 sm:mb-32`}>
                    <CreatorSectionIntro
                        number="06"
                        title="PUBLISH"
                        description="Save it for yourself, or share it if you feel like it."
                    />
                    <div className="min-w-0 lg:-translate-x-[19.25%] lg:self-center">
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
                </section>
            </div>
        </article>
    );
}
