"use client";

import { movePlannerPin, reorderPlannerPin } from "@/lib/board-planner";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import BoardCreationPreview from "@/components/features/boards/BoardCreationPreview";
import BoardPublishPanel from "@/components/features/boards/BoardPublishPanel";
import BoardDiscoveryDetails from "@/components/features/boards/BoardDiscoveryDetails";
import BoardImageIntake, { type UploadedBoardImage } from "@/components/features/boards/BoardImageIntake";
import CreatorSectionIntro from "@/components/features/boards/CreatorSectionIntro";
import DayPlanner from "@/components/features/boards/DayPlanner";
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
import { getMockSettings, restoreMockStore } from "@/data/mock-social";

const chapterClasses =
    "mx-auto grid w-full max-w-[96rem] scroll-mt-10 gap-8 px-5 pb-20 sm:gap-10 sm:px-8 lg:grid-cols-[21rem_minmax(0,1fr)] lg:gap-16 lg:px-12 lg:pb-28";
const fullChapterClasses = `${chapterClasses} lg:min-h-[min(70rem,100svh)]`;

function newDay(dayNumber: number, date: string | null = null): BoardDayDraft {
    return { id: crypto.randomUUID(), dayNumber, date, pins: [] };
}

function normalizePinOrder(pins: BoardPinDraft[]): BoardPinDraft[] {
    return pins.map((pin, order) => ({ ...pin, order }));
}

function addPhotoSuggestions(current: BoardDayDraft[], uploads: UploadedBoardImage[]): BoardDayDraft[] {
    return uploads.reduce((days, upload) => {
        if (!upload.suggestedPin) return days;
        const suggestedPin = upload.suggestedPin;
        const matchingIndex = upload.suggestedDate ? days.findIndex((day) => day.date === upload.suggestedDate) : 0;
        const reusableFirstDay = days.length === 1 && days[0]?.pins.length === 0 && days[0].date === null;
        const targetIndex = matchingIndex >= 0 ? matchingIndex : reusableFirstDay ? 0 : days.length;
        if (targetIndex === days.length) {
            return [
                ...days,
                {
                    ...newDay(days.length + 1, upload.suggestedDate),
                    pins: [{ ...suggestedPin, order: 0 }]
                }
            ];
        }
        return days.map((day, index) =>
            index === targetIndex
                ? {
                      ...day,
                      date: day.date ?? upload.suggestedDate,
                      pins: normalizePinOrder([...day.pins, { ...suggestedPin, order: day.pins.length }])
                  }
                : day
        );
    }, current);
}

function getDefaultBoardCreatorVisibility(): BoardCreatorPayload["visibility"] {
    restoreMockStore();
    const defaultVis = getMockSettings().defaultBoardVisibility;
    if (defaultVis === "friends") return "friends";
    if (defaultVis === "public") return "public";
    return "collaborators";
}

export default function BoardCreator({
    initialBoardId,
    expectedStatus = "draft",
    initialMode = "smart"
}: {
    initialBoardId?: number;
    expectedStatus?: BoardStatus;
    initialMode?: "smart" | "scratch";
}) {
    const [mode, setMode] = useState(initialMode);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [images, setImages] = useState<BoardImageDraft[]>([]);
    const [selectedCoverImageId, setSelectedCoverImageId] = useState<number | null>(null);
    const initialDayId = useId();
    const [days, setDays] = useState<BoardDayDraft[]>(() => [{ id: initialDayId, dayNumber: 1, date: null, pins: [] }]);
    const [tags, setTags] = useState<string[]>([]);
    const [allowedTags, setAllowedTags] = useState<Array<{ tagId: number; name: string }>>([]);
    const [visibility, setVisibility] = useState<BoardCreatorPayload["visibility"]>(() =>
        initialBoardId !== undefined ? "collaborators" : getDefaultBoardCreatorVisibility()
    );
    const [confirmedPhotoPins, setConfirmedPhotoPins] = useState<Set<string>>(() => new Set());
    const [saving, setSaving] = useState<BoardStatus | null>(null);
    const [uploading, setUploading] = useState(false);
    const pendingUploadRef = useRef<Promise<unknown> | null>(null);
    const [draftLoading, setDraftLoading] = useState(initialBoardId !== undefined);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [saveMessage, setSaveMessage] = useState("");
    const [saveError, setSaveError] = useState("");
    const [tagsLoading, setTagsLoading] = useState(true);
    const [tagsError, setTagsError] = useState("");
    const [savedBoard, setSavedBoard] = useState<BoardDocument | null>(null);
    const editorDisabled = saving !== null || draftLoading || (initialBoardId !== undefined && !savedBoard);
    const showSmartIntro = initialBoardId === undefined && mode === "smart";

    function switchMode() {
        const nextMode = mode === "smart" ? "scratch" : "smart";
        setMode(nextMode);
        const url = new URL(window.location.href);
        if (nextMode === "scratch") url.searchParams.set("mode", "scratch");
        else url.searchParams.delete("mode");
        window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }

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
                setSavedBoard(board);
                setTitle(board.title);
                setDescription(board.description ?? "");
                setVisibility(board.visibility);
                setTags(board.tags.map((tag) => tag.name));
                setDays(restored.days);
                setImages(restored.images);
                setSelectedCoverImageId(board.coverImageId);
                setConfirmedPhotoPins(restored.confirmedPhotoPins);
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
            title,
            description,
            status: "draft",
            visibility,
            coverImageId,
            tags,
            days,
            images
        }),
        [coverImageId, days, description, images, tags, title, visibility]
    );

    function handleUploads(items: UploadedBoardImage[]) {
        setImages((current) =>
            [...current, ...items.map((item) => item.image)]
                .sort((first, second) =>
                    first.capturedAt === null
                        ? second.capturedAt === null
                            ? 0
                            : 1
                        : second.capturedAt === null
                          ? -1
                          : first.capturedAt.localeCompare(second.capturedAt)
                )
                .map((image, order) => ({ ...image, order }))
        );
        setDays((current) => addPhotoSuggestions(current, items));
        setMessage(
            items.some((item) => item.suggestedPin)
                ? "Images uploaded. Pins suggested from embedded GPS and capture times—please confirm them before publishing."
                : "Images uploaded. No usable GPS metadata was found, so no pins were created automatically."
        );
        setError("");
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
        setConfirmedPhotoPins((current) => new Set([...current].filter((item) => item !== pinId)));
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
        setConfirmedPhotoPins((current) => new Set([...current].filter((pinId) => !removedPinIds.has(pinId))));
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
        const unconfirmedPhotoPin = days
            .flatMap((day) => day.pins)
            .find((pin) => pin.source === "photo" && !confirmedPhotoPins.has(pin.id));
        if (status === "published" && unconfirmedPhotoPin) {
            setSaveError(`Confirm the photo location for “${unconfirmedPhotoPin.title}” before publishing.`);
            setSaveMessage("");
            return;
        }
        if (pendingUploadRef.current) {
            setSaveMessage("Waiting for image uploads to finish...");
            await pendingUploadRef.current;
            pendingUploadRef.current = null;
        }
        setSaving(status);
        setSaveError("");
        setSaveMessage("");
        try {
            const currentPayload = {
                title,
                description,
                status,
                visibility,
                coverImageId,
                tags,
                days,
                images
            };
            const write = toBoardWrite(currentPayload, allowedTags, confirmedPhotoPins);
            const sentDays = days;
            const expectedRevision = savedBoard ? savedBoard.revision + 1 : 1;
            const board = await saveBoardDocument(write, savedBoard);
            if (board.revision !== expectedRevision) {
                throw new Error(
                    "Board changed in another session while saving. Please refresh to load the latest changes."
                );
            }
            setSavedBoard(board);
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
            setSaveError(caught instanceof Error ? caught.message : "The Board could not be saved.");
        } finally {
            setSaving(null);
        }
    }

    return (
        <article className="font-body bg-background text-foreground relative min-w-0 overflow-x-clip">
            {showSmartIntro ? (
                <header className="px-5 pt-16 pb-16 text-center sm:px-10 sm:pt-24 sm:pb-28">
                    <h1 className="font-display text-[clamp(2.5rem,5.6vw,6rem)] leading-[1.02] font-bold tracking-[-0.035em]">
                        SMART CREATE
                    </h1>
                    <p className="text-muted-foreground mx-auto mt-4 max-w-[38rem] text-xs leading-relaxed sm:text-sm">
                        Drop in your photos and we’ll turn metadata into editable beginnings for a Board. Review every
                        suggestion before anything is published.
                    </p>
                    <p className="text-muted-foreground/70 mt-6 text-[10px] sm:text-xs">
                        Powered by Roamboard Intelligence Engine
                    </p>
                </header>
            ) : (
                <h1 className="sr-only">
                    {initialBoardId === undefined
                        ? "Create a new Board"
                        : expectedStatus === "published"
                          ? "Edit published Board"
                          : "Edit Board draft"}
                </h1>
            )}

            <div>
                <fieldset
                    disabled={editorDisabled}
                    aria-busy={draftLoading}
                    className="m-0 min-w-0 border-0 p-0 disabled:pointer-events-none disabled:opacity-80"
                >
                    <BoardImageIntake
                        images={images.filter((image) => image.source === "upload")}
                        coverImageId={coverImageId}
                        disabled={editorDisabled}
                        loading={draftLoading}
                        showDropZone={showSmartIntro}
                        onUploadingChange={setUploading}
                        onUploadPromise={(promise) => {
                            pendingUploadRef.current = promise;
                        }}
                        onSelectCover={setSelectedCoverImageId}
                        onUploaded={handleUploads}
                        onRemove={removeImage}
                    />

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
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder={draftLoading ? "LOADING BOARD…" : "BOARD TITLE"}
                            className="font-display placeholder:text-foreground focus-visible:outline-foreground mt-3 min-h-12 w-full min-w-0 bg-transparent py-1 text-center text-[clamp(1.75rem,3.8vw,4rem)] leading-[1.02] font-bold tracking-[-0.035em] uppercase focus-visible:outline-1 focus-visible:outline-offset-4"
                        />
                        {initialBoardId === undefined ? (
                            <button
                                type="button"
                                onClick={switchMode}
                                className="text-muted-foreground hover:text-foreground mt-4 min-h-11 cursor-pointer px-3 text-xs underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
                            >
                                {mode === "smart" ? "Switch to Start from Scratch" : "Switch to Smart Create"}
                            </button>
                        ) : null}
                    </div>

                    {message ? (
                        <p className="border-foreground text-13 mx-auto mt-7 max-w-3xl border-l-2 pl-4" role="status">
                            {message}
                        </p>
                    ) : null}
                    {draftLoading ? (
                        <p className="text-13 mx-auto mt-7 max-w-3xl" role="status">
                            Loading Board...
                        </p>
                    ) : null}
                    {error ? (
                        <p className="border-foreground text-13 mx-auto mt-7 max-w-3xl border-l-2 pl-4" role="alert">
                            {error}
                        </p>
                    ) : null}

                    <section id="board-basics" className={`${chapterClasses} mt-20 sm:mt-28 lg:mt-36 lg:min-h-[22rem]`}>
                        <CreatorSectionIntro
                            number="01"
                            title="BOARD BASICS"
                            description="Let’s start with the essentials to set the scene for everything you’re about to plan."
                        />
                        <label className="text-foreground/80 text-20 sm:text-24 block max-w-3xl min-w-0 font-bold">
                            Description
                            <textarea
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                                placeholder="type here..."
                                rows={7}
                                className="border-line text-foreground font-body text-14 placeholder:text-muted-foreground focus:border-foreground focus-visible:outline-foreground mt-3 w-full resize-y border-0 border-b bg-transparent py-3 leading-6 font-normal focus-visible:outline-1 focus-visible:outline-offset-4 sm:text-base"
                            />
                        </label>
                    </section>

                    <section id="day-plan" className={fullChapterClasses}>
                        <CreatorSectionIntro
                            number="02"
                            title="BUILD YOUR DAY PLAN"
                            description="Shape the trip. Add and arrange places, restaurants, notes, and more."
                        />
                        <div className="min-w-0">
                            <DayPlanner
                                disabled={editorDisabled}
                                days={days}
                                images={images}
                                onAddDay={() => setDays((current) => [...current, newDay(current.length + 1)])}
                                onRemoveDay={removeDay}
                                onAddPin={addPin}
                                onUpdatePin={updatePin}
                                onMovePin={movePin}
                                onReorderPin={(pinId, direction) =>
                                    setDays((current) => reorderPlannerPin(current, pinId, direction))
                                }
                                onRemovePin={removePin}
                                onAddActivityImage={addActivityImage}
                                onAssignActivityImage={assignActivityImage}
                                onSetActivityCover={setActivityCover}
                                onReorderActivityImage={reorderActivityImage}
                                confirmedPhotoPins={confirmedPhotoPins}
                                onConfirmPhotoPin={(pinId) =>
                                    setConfirmedPhotoPins((current) => new Set([...current, pinId]))
                                }
                            />
                        </div>
                    </section>

                    <section id="details-discovery" className={fullChapterClasses}>
                        <CreatorSectionIntro
                            number="03"
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
                                onVisibilityChange={setVisibility}
                            />
                        </div>
                    </section>
                </fieldset>

                <section id="board-preview" className={fullChapterClasses}>
                    <CreatorSectionIntro
                        number="04"
                        title="BOARD PREVIEW"
                        description="A final look at the trip you’ve built, just to make sure everything feels exactly how you want it."
                    />
                    <div className="min-w-0 lg:self-center">
                        <BoardCreationPreview board={payload} />
                    </div>
                </section>

                <section id="publish" className={`${fullChapterClasses} mb-20 sm:mb-32`}>
                    <CreatorSectionIntro
                        number="05"
                        title="PUBLISH"
                        description="Save it for yourself, or share it if you feel like it."
                    />
                    <div className="min-w-0 lg:self-center">
                        <BoardPublishPanel
                            expectedStatus={expectedStatus}
                            savedBoard={savedBoard}
                            disabled={editorDisabled}
                            saving={saving}
                            uploading={uploading}
                            message={saveMessage}
                            error={saveError}
                            onSave={(status) => void save(status)}
                        />
                    </div>
                </section>
            </div>
        </article>
    );
}
