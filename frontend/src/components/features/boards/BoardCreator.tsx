"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import BoardCreationPreview from "@/components/features/boards/BoardCreationPreview";
import BoardDiscoveryDetails from "@/components/features/boards/BoardDiscoveryDetails";
import BoardImageIntake, {
    type UploadedBoardImage
} from "@/components/features/boards/BoardImageIntake";
import CreatorSectionIntro from "@/components/features/boards/CreatorSectionIntro";
import DayPlanner from "@/components/features/boards/DayPlanner";
import {
    fromBoardDocument,
    listBoardTags,
    loadBoardDocument,
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

function newDay(dayNumber: number, date: string | null = null): BoardDayDraft {
    return { id: crypto.randomUUID(), dayNumber, date, pins: [] };
}

function normalizePinOrder(pins: BoardPinDraft[]): BoardPinDraft[] {
    return [...pins]
        .sort(
            (first, second) =>
                first.time.localeCompare(second.time) ||
                first.order - second.order
        )
        .map((pin, order) => ({ ...pin, order }));
}

function addPhotoSuggestions(
    current: BoardDayDraft[],
    uploads: UploadedBoardImage[]
): BoardDayDraft[] {
    return uploads.reduce((days, upload) => {
        if (!upload.suggestedPin) return days;
        const suggestedPin = upload.suggestedPin;
        const matchingIndex = upload.suggestedDate
            ? days.findIndex((day) => day.date === upload.suggestedDate)
            : 0;
        const reusableFirstDay =
            days.length === 1 &&
            days[0]?.pins.length === 0 &&
            days[0].date === null;
        const targetIndex =
            matchingIndex >= 0
                ? matchingIndex
                : reusableFirstDay
                  ? 0
                  : days.length;
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
                      pins: normalizePinOrder([
                          ...day.pins,
                          { ...suggestedPin, order: day.pins.length }
                      ])
                  }
                : day
        );
    }, current);
}

export default function BoardCreator({
    initialBoardId,
    expectedStatus = "draft"
}: {
    initialBoardId?: number;
    expectedStatus?: BoardStatus;
}) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [images, setImages] = useState<BoardImageDraft[]>([]);
    const [selectedCoverImageId, setSelectedCoverImageId] = useState<
        number | null
    >(null);
    const [days, setDays] = useState<BoardDayDraft[]>(() => [newDay(1)]);
    const [tags, setTags] = useState<string[]>([]);
    const [allowedTags, setAllowedTags] = useState<
        Array<{ tagId: number; name: string }>
    >([]);
    const [visibility, setVisibility] =
        useState<BoardCreatorPayload["visibility"]>("collaborators");
    const [confirmedPhotoPins, setConfirmedPhotoPins] = useState<Set<string>>(
        () => new Set()
    );
    const [saving, setSaving] = useState<BoardStatus | null>(null);
    const [draftLoading, setDraftLoading] = useState(
        initialBoardId !== undefined
    );
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [savedBoard, setSavedBoard] = useState<BoardDocument | null>(null);

    useEffect(() => {
        void listBoardTags()
            .then(setAllowedTags)
            .catch((caught: unknown) =>
                setError(
                    caught instanceof Error
                        ? caught.message
                        : "Tags could not be loaded."
                )
            );
    }, []);

    useEffect(() => {
        if (initialBoardId === undefined) return;
        void loadBoardDocument(initialBoardId)
            .then((board) => {
                if (board.status !== expectedStatus)
                    throw new Error(`This Board is not ${expectedStatus}.`);
                if (!board.permissions.canEditContent)
                    throw new Error("You cannot edit this Board.");
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
                setError(
                    caught instanceof Error
                        ? caught.message
                        : "Board could not be loaded."
                )
            )
            .finally(() => setDraftLoading(false));
    }, [initialBoardId, expectedStatus]);

    const uploadedImages = images.filter((image) => image.source === "upload");
    const coverImageId = uploadedImages.some(
        (image) => image.uploadedImageId === selectedCoverImageId
    )
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
            current
                .filter((item) => item.id !== imageId)
                .map((item, order) => ({ ...item, order }))
        );
        if (image?.uploadedImageId)
            setDays((current) =>
                current.map((day) => ({
                    ...day,
                    pins: day.pins.map((pin) =>
                        pin.coverImageId === image.uploadedImageId
                            ? { ...pin, coverImageId: null }
                            : pin
                    )
                }))
            );
    }

    function addPin(
        dayId: string,
        pin: BoardPinDraft,
        image: BoardImageDraft | null
    ) {
        setDays((current) =>
            current.map((day) =>
                day.id === dayId
                    ? { ...day, pins: normalizePinOrder([...day.pins, pin]) }
                    : day
            )
        );
        if (image)
            setImages((current) => [
                ...current,
                { ...image, order: current.length }
            ]);
    }

    function updatePin(pin: BoardPinDraft) {
        setDays((current) =>
            current.map((day) => ({
                ...day,
                pins: normalizePinOrder(
                    day.pins.map((item) => (item.id === pin.id ? pin : item))
                )
            }))
        );
    }

    function removePin(pinId: string) {
        setDays((current) =>
            current.map((day) => ({
                ...day,
                pins: normalizePinOrder(
                    day.pins.filter((pin) => pin.id !== pinId)
                )
            }))
        );
        setImages((current) =>
            current.map((image) =>
                image.pinId === pinId
                    ? { ...image, pinId: null, activityOrder: undefined }
                    : image
            )
        );
        setConfirmedPhotoPins(
            (current) => new Set([...current].filter((item) => item !== pinId))
        );
    }

    function removeDay(dayId: string) {
        const removedPinIds = new Set(
            days.find((day) => day.id === dayId)?.pins.map((pin) => pin.id) ??
                []
        );
        setDays((current) =>
            current
                .filter((day) => day.id !== dayId)
                .map((day, index) => ({ ...day, dayNumber: index + 1 }))
        );
        setImages((current) =>
            current.map((image) =>
                image.pinId && removedPinIds.has(image.pinId)
                    ? { ...image, pinId: null, activityOrder: undefined }
                    : image
            )
        );
        setConfirmedPhotoPins(
            (current) =>
                new Set(
                    [...current].filter((pinId) => !removedPinIds.has(pinId))
                )
        );
    }

    function addActivityImage(image: BoardImageDraft) {
        setImages((current) => [
            ...current,
            {
                ...image,
                order: current.filter((item) => item.source === "upload")
                    .length,
                activityOrder: current.filter(
                    (item) => item.pinId === image.pinId
                ).length
            }
        ]);
    }

    function assignActivityImage(imageId: string, pinId: string | null) {
        setImages((current) => {
            const nextPosition = current.filter(
                (item) => item.pinId === pinId
            ).length;
            return current.map((image) =>
                image.id === imageId
                    ? {
                          ...image,
                          pinId,
                          activityOrder:
                              pinId === null ? undefined : nextPosition
                      }
                    : image
            );
        });
    }

    function setActivityCover(pinId: string, imageId: number) {
        setDays((current) =>
            current.map((day) => ({
                ...day,
                pins: day.pins.map((pin) =>
                    pin.id === pinId ? { ...pin, coverImageId: imageId } : pin
                )
            }))
        );
    }

    function reorderActivityImage(
        pinId: string,
        imageId: string,
        direction: -1 | 1
    ) {
        setImages((current) => {
            const activityImages = current
                .filter(
                    (image) =>
                        image.pinId === pinId && image.source === "upload"
                )
                .sort(
                    (first, second) =>
                        (first.activityOrder ?? first.order) -
                        (second.activityOrder ?? second.order)
                );
            const index = activityImages.findIndex(
                (image) => image.id === imageId
            );
            const other = activityImages[index + direction];
            if (index < 0 || !other) return current;
            activityImages[index + direction] = activityImages[index]!;
            activityImages[index] = other;
            const positions = new Map(
                activityImages.map((image, order) => [image.id, order])
            );
            return current.map((image) =>
                positions.has(image.id)
                    ? { ...image, activityOrder: positions.get(image.id) }
                    : image
            );
        });
    }

    function movePin(pinId: string, dayId: string, time: string) {
        const pin = days
            .flatMap((day) => day.pins)
            .find((item) => item.id === pinId);
        if (!pin) return;
        setDays((current) =>
            current.map((day) => {
                const withoutPin = day.pins.filter((item) => item.id !== pinId);
                return {
                    ...day,
                    pins: normalizePinOrder(
                        day.id === dayId
                            ? [...withoutPin, { ...pin, time }]
                            : withoutPin
                    )
                };
            })
        );
    }

    async function save(status: BoardStatus) {
        const unconfirmedPhotoPin = days
            .flatMap((day) => day.pins)
            .find(
                (pin) =>
                    pin.source === "photo" && !confirmedPhotoPins.has(pin.id)
            );
        if (status === "published" && unconfirmedPhotoPin) {
            setError(
                `Confirm the photo location for “${unconfirmedPhotoPin.title}” before publishing.`
            );
            setMessage("");
            const behavior = window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches
                ? "auto"
                : "smooth";
            document
                .getElementById("day-plan")
                ?.scrollIntoView({ behavior, block: "start" });
            return;
        }
        setSaving(status);
        setError("");
        setMessage("");
        try {
            const write = toBoardWrite(
                { ...payload, status },
                allowedTags,
                confirmedPhotoPins
            );
            const board = await saveBoardDocument(write, savedBoard);
            const restored = fromBoardDocument(board);
            setSavedBoard(board);
            setDays(restored.days);
            setImages(restored.images);
            setConfirmedPhotoPins(restored.confirmedPhotoPins);
            setMessage(
                expectedStatus === "published"
                    ? "Board changes saved."
                    : status === "draft"
                      ? `Draft saved as “${board.title}”.`
                      : `“${board.title}” is published and ready to share.`
            );
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "The Board could not be saved."
            );
        } finally {
            setSaving(null);
        }
    }

    return (
        <article className="bg-background text-foreground min-w-0">
            <header className="px-5 pt-14 pb-16 text-center sm:px-10 sm:pt-20">
                <h1 className="font-display text-48 sm:text-72 lg:text-96 leading-none font-bold tracking-tight">
                    SMART CREATE
                </h1>
                <p className="text-12 text-graphite mx-auto mt-4 max-w-xl leading-5">
                    Drop in your photos and we’ll turn metadata into editable
                    beginnings for a Board. Review every suggestion before
                    anything is published.
                </p>
                <p className="text-10 text-stone mt-6">
                    Powered by Roamboard Intelligence Engine
                </p>
            </header>

            <div className="px-4 sm:px-8 lg:px-16">
                <BoardImageIntake
                    images={images.filter((image) => image.source === "upload")}
                    coverImageId={coverImageId}
                    onSelectCover={setSelectedCoverImageId}
                    onUploaded={handleUploads}
                    onRemove={removeImage}
                />

                <div className="mx-auto mt-8 max-w-4xl text-center">
                    <label
                        htmlFor="board-title"
                        className="text-10 tracking-label text-stone uppercase"
                    >
                        Board creator
                    </label>
                    <input
                        id="board-title"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="BOARD TITLE"
                        className="font-display text-36 placeholder:text-foreground sm:text-48 mt-2 w-full bg-transparent text-center leading-none font-bold uppercase outline-none focus:placeholder:text-transparent"
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
                    className="mx-auto mt-24 grid max-w-7xl scroll-mt-8 gap-10 lg:grid-cols-[15rem_1fr] lg:gap-16"
                >
                    <CreatorSectionIntro
                        number="01"
                        title="BOARD BASICS"
                        description="Let’s start with the essentials to set the scene for everything you’re about to plan."
                    />
                    <label className="font-display text-20 block max-w-3xl font-bold">
                        Description
                        <textarea
                            value={description}
                            onChange={(event) =>
                                setDescription(event.target.value)
                            }
                            placeholder="type here..."
                            rows={7}
                            className="border-line font-body text-14 placeholder:text-stone focus:border-foreground mt-3 w-full resize-y border-0 border-b bg-transparent py-3 leading-6 font-normal outline-none"
                        />
                    </label>
                </section>

                <section
                    id="day-plan"
                    className="mx-auto mt-28 grid max-w-7xl scroll-mt-8 gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16"
                >
                    <CreatorSectionIntro
                        number="02"
                        title="BUILD YOUR DAY PLAN"
                        description="Shape the trip. Add and arrange places, restaurants, notes, and more."
                    />
                    <div className="min-w-0">
                        <DayPlanner
                            days={days}
                            images={images}
                            onAddDay={() =>
                                setDays((current) => [
                                    ...current,
                                    newDay(current.length + 1)
                                ])
                            }
                            onRemoveDay={removeDay}
                            onAddPin={addPin}
                            onUpdatePin={updatePin}
                            onMovePin={movePin}
                            onRemovePin={removePin}
                            onAddActivityImage={addActivityImage}
                            onAssignActivityImage={assignActivityImage}
                            onSetActivityCover={setActivityCover}
                            onReorderActivityImage={reorderActivityImage}
                            confirmedPhotoPins={confirmedPhotoPins}
                            onConfirmPhotoPin={(pinId) =>
                                setConfirmedPhotoPins(
                                    (current) => new Set([...current, pinId])
                                )
                            }
                        />
                    </div>
                </section>

                <section
                    id="details-discovery"
                    className="mx-auto mt-28 grid max-w-7xl scroll-mt-8 gap-10 lg:grid-cols-[15rem_1fr] lg:gap-16"
                >
                    <CreatorSectionIntro
                        number="03"
                        title="DETAILS & DISCOVERY"
                        description="Give your Board more context to keep plans organized and make it easier for others to discover."
                    />
                    <BoardDiscoveryDetails
                        tags={tags}
                        allowedTags={allowedTags.map((tag) => tag.name)}
                        visibility={visibility}
                        canChangeVisibility={
                            savedBoard?.permissions.canManageBoard ?? true
                        }
                        onTagsChange={setTags}
                        onVisibilityChange={setVisibility}
                    />
                </section>

                <section
                    id="board-preview"
                    className="mx-auto mt-28 grid max-w-7xl scroll-mt-8 gap-10 lg:grid-cols-[15rem_1fr] lg:gap-16"
                >
                    <CreatorSectionIntro
                        number="04"
                        title="BOARD PREVIEW"
                        description="A final look at the trip you’ve built, just to make sure everything feels exactly how you want it."
                    />
                    <BoardCreationPreview board={payload} />
                </section>

                <section className="mx-auto mt-28 mb-32 grid max-w-7xl gap-10 lg:grid-cols-[15rem_1fr] lg:gap-16">
                    <CreatorSectionIntro
                        number="05"
                        title="PUBLISH"
                        description="Save it for yourself, or share it if you feel like it."
                    />
                    <div>
                        <h2 className="font-display text-36 font-bold">
                            Ready when you are.
                        </h2>
                        <p className="text-14 text-graphite mt-3 max-w-xl leading-6">
                            Drafts can stay incomplete. Publishing requires a
                            title and at least one pin with a confirmed
                            location.
                        </p>
                        <div className="mt-7 flex flex-wrap gap-3">
                            {expectedStatus !== "published" ? (
                                <button
                                    type="button"
                                    disabled={
                                        draftLoading ||
                                        saving !== null ||
                                        (initialBoardId !== undefined &&
                                            !savedBoard) ||
                                        savedBoard?.status === "published"
                                    }
                                    onClick={() => void save("draft")}
                                    className="border-foreground text-14 border px-6 py-4 disabled:opacity-40"
                                >
                                    {saving === "draft"
                                        ? "Saving draft..."
                                        : "Save as draft"}
                                </button>
                            ) : null}
                            <button
                                type="button"
                                disabled={
                                    draftLoading ||
                                    saving !== null ||
                                    (initialBoardId !== undefined &&
                                        !savedBoard) ||
                                    (savedBoard?.status === "published" &&
                                        expectedStatus !== "published")
                                }
                                onClick={() => void save("published")}
                                className="border-foreground bg-foreground text-14 text-background border px-6 py-4 disabled:opacity-40"
                            >
                                {saving === "published"
                                    ? expectedStatus === "published"
                                        ? "Saving changes..."
                                        : "Publishing..."
                                    : expectedStatus === "published"
                                      ? "Save changes"
                                      : "Publish Board"}
                            </button>
                            {savedBoard ? (
                                <Link
                                    href={`/boards/${savedBoard.boardId}`}
                                    className="border-foreground text-14 border-b px-2 py-4"
                                >
                                    View saved Board →
                                </Link>
                            ) : null}
                        </div>
                    </div>
                </section>
            </div>
        </article>
    );
}
