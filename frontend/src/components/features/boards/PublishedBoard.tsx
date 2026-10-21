"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowRight, Bookmark } from "lucide-react";
import BackLink from "@/components/ui/BackLink";
import ActivityDetailsDialog from "./ActivityDetailsDialog";
import BoardComments from "./BoardComments";
import BoardPhoto from "./BoardPhoto";
import BoardDialog from "./BoardDialog";
import BoardDayScene from "./BoardDayScene";
import BoardStoryEnding from "./BoardStoryEnding";
import StoryDaySidebar from "./StoryDaySidebar";
import { createDayScenes, sceneActivities, type ScenePhoto } from "@/lib/board-story-scenes";
import StoryPhoto from "./StoryPhoto";
import StoryGallery, { type StoryPlacement } from "./StoryGallery";
import StoryMap from "./StoryMap";
import useStoryScroll from "./useStoryScroll";
import { getBoardDays } from "@/lib/board-presentation";
import { loadMapboxMapSession } from "@/lib/providers";
import { ProfileApiError, saveBoardBookmark, unsaveBoardBookmark } from "@/lib/profile";
import { loadBoardDocument } from "@/lib/board-creator-api";
import type { BoardActivity } from "@/types/board";
import type { PublishedBoardData } from "@/types/published-board";

const countLabel = (count: number | undefined) =>
    Number.isSafeInteger(count) && count! >= 0 ? new Intl.NumberFormat("en-US").format(count!) : "Unavailable";
const actionClass =
    "hover:bg-faint inline-flex min-h-11 cursor-pointer items-center gap-3 rounded-full px-5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-50";

export default function PublishedBoard({
    board,
    author,
    tagLabels = board.tags,
    canEditContent = false,
    canManageBoard = false,
    savedByMe = false,
    savedCount,
    commentCount,
    fillerImages = []
}: PublishedBoardData) {
    const days = useMemo(() => getBoardDays(board), [board]);
    const {
        track: trackRef,
        viewport: viewportRef,
        rail: railRef,
        desktop,
        chapter: currentChapter,
        sceneId,
        jump
    } = useStoryScroll(days.map((day) => day.number).join(","));
    const [selectedActivity, setSelectedActivity] = useState<BoardActivity | null>(null);
    const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
    const [bookmarked, setBookmarked] = useState(savedByMe);
    const [saveTotal, setSaveTotal] = useState(savedCount);
    const [commentsTotal, setCommentsTotal] = useState(commentCount);
    const [bookmarkBusy, setBookmarkBusy] = useState(false);
    const bookmarkPending = useRef(false);
    const [bookmarkMessage, setBookmarkMessage] = useState("");
    const [signInToSave, setSignInToSave] = useState(false);
    const [manualFilter, setManualFilter] = useState<number | "all" | null>(null);
    const [focusedActivity, setFocusedActivity] = useState<string>();
    const [hoveredActivity, setHoveredActivity] = useState<string>();
    const [mapExpanded, setMapExpanded] = useState(false);
    const mapSession = useRef<ReturnType<typeof loadMapboxMapSession> | null>(null);
    const session = useCallback(() => {
        mapSession.current ??= loadMapboxMapSession().catch((error) => {
            mapSession.current = null;
            throw error;
        });
        return mapSession.current;
    }, []);
    const activities = days.flatMap((day) =>
        day.items.filter((item): item is BoardActivity => item.type === "activity")
    );
    const activeDay = /^day-(\d+)$/.exec(currentChapter)?.[1];
    const filter = manualFilter ?? (activeDay ? Number(activeDay) : "all");
    const fillerPlacements = useMemo(() => {
        const groups = days.flatMap((day) =>
            day.items.filter((item) => item.type === "activity").map((item) => item.id)
        );
        const assignments = new Map<string, StoryPlacement[]>();
        fillerImages.forEach((image, index) => {
            const group =
                groups[
                    Math.min(groups.length - 1, Math.floor(((index + 1) * groups.length) / (fillerImages.length + 1)))
                ];
            const key = group ?? `empty-${days[0]?.number ?? 1}`;
            assignments.set(key, [...(assignments.get(key) ?? []), { id: `filler-${index}`, image }]);
        });
        return assignments;
    }, [days, fillerImages]);
    const placements = useMemo<StoryPlacement[]>(
        () => [
            ...(board.coverImage ? [{ id: "cover", image: board.coverImage }] : []),
            ...days.flatMap((day) => [
                ...(fillerPlacements.get(`empty-${day.number}`) ?? []),
                ...day.items.flatMap((item) =>
                    item.type === "activity"
                        ? [
                              ...item.images.map((image, index) => ({ id: `activity-${item.id}-${index}`, image })),
                              ...(fillerPlacements.get(item.id) ?? [])
                          ]
                        : []
                )
            ])
        ],
        [board.coverImage, days, fillerPlacements]
    );
    const scenes = useMemo(
        () =>
            days.flatMap((day) => {
                const photos: ScenePhoto[] = [
                    ...(fillerPlacements.get(`empty-${day.number}`) ?? []).map((photo) => ({
                        ...photo,
                        illustration: true
                    })),
                    ...sceneActivities(day).flatMap((activity) => [
                        ...activity.images.map((image, index) => ({
                            id: `activity-${activity.id}-${index}`,
                            image,
                            activityId: activity.id
                        })),
                        ...(fillerPlacements.get(activity.id) ?? []).map((photo) => ({ ...photo, illustration: true }))
                    ])
                ];
                return createDayScenes(day, photos);
            }),
        [days, fillerPlacements]
    );
    const activeScene = scenes.find((scene) => scene.id === sceneId);
    const highlighted =
        focusedActivity ?? hoveredActivity ?? activeScene?.photos.find((photo) => photo.activityId)?.activityId;
    const sceneIds = ["overview", ...scenes.map((scene) => scene.id)];
    const openPhoto = (id: string) => {
        const index = placements.findIndex((placement) => placement.id === id);
        if (index >= 0) setGalleryIndex(index);
    };
    const focusLocation = (activity: BoardActivity) => {
        setManualFilter(activity.dayNumber ?? 1);
        setFocusedActivity(activity.id);
    };

    async function toggleBookmark() {
        if (bookmarkPending.current) return;
        bookmarkPending.current = true;
        setBookmarkBusy(true);
        setBookmarkMessage("");
        setSignInToSave(false);
        try {
            if (bookmarked) await unsaveBoardBookmark(Number(board.id));
            else await saveBoardBookmark(Number(board.id));
            setBookmarked(!bookmarked);
            setBookmarkMessage(
                bookmarked ? "Board removed from your saved collection." : "Board saved to your collection."
            );
            try {
                const current = await loadBoardDocument(Number(board.id));
                setSaveTotal(current.savedCount);
                setBookmarked(Boolean(current.savedByMe));
            } catch {
                setSaveTotal(undefined);
            }
        } catch (error) {
            setSignInToSave(error instanceof ProfileApiError && error.status === 401);
            setBookmarkMessage(error instanceof Error ? error.message : "The Board could not be saved.");
        } finally {
            bookmarkPending.current = false;
            setBookmarkBusy(false);
        }
    }

    const saveAction = (
        <>
            {!canManageBoard ? (
                <button
                    type="button"
                    onClick={toggleBookmark}
                    disabled={bookmarkBusy}
                    aria-label={bookmarked ? "Unsave Board" : "Save Board"}
                    aria-pressed={bookmarked}
                    className={actionClass}
                >
                    <Bookmark size={18} fill={bookmarked ? "currentColor" : "none"} />
                    {bookmarkBusy ? "Saving…" : bookmarked ? "Unsave Board" : "Save Board"}
                </button>
            ) : null}
            {canEditContent ? (
                <Link href={`/boards/${board.id}/edit`} className={actionClass}>
                    Edit Board <ArrowRight size={16} />
                </Link>
            ) : null}
        </>
    );
    const stats = (
        <dl className="border-line flex flex-wrap gap-x-8 gap-y-4 border-y py-5 text-xs">
            <div>
                <dd className="font-display text-3xl">{days.length}</dd>
                <dt>days</dt>
            </div>
            <div>
                <dd className="font-display text-3xl">{activities.length}</dd>
                <dt>activities</dt>
            </div>
            <div
                aria-label={
                    saveTotal === undefined
                        ? "Save count unavailable"
                        : `${saveTotal} ${saveTotal === 1 ? "save" : "saves"}`
                }
            >
                <dd className="font-display text-3xl">{countLabel(saveTotal)}</dd>
                <dt>saves</dt>
            </div>
            <div>
                <dd className="font-display text-3xl">
                    <a
                        href="#comments"
                        onClick={(event) => {
                            event.preventDefault();
                            jump("comments");
                        }}
                        className="underline decoration-1 underline-offset-4"
                    >
                        {countLabel(commentsTotal)}
                    </a>
                </dd>
                <dt>comments</dt>
            </div>
        </dl>
    );
    const map = (mapFilter: number | "all") => (
        <StoryMap
            days={days}
            filter={mapFilter}
            session={session}
            activeId={highlighted}
            onOpen={setSelectedActivity}
            onEnlarge={() => setMapExpanded(true)}
        />
    );

    return (
        <article className="relative min-w-0 break-words">
            <nav
                aria-label="Story chapters"
                className="border-line bg-background/95 sticky top-0 z-30 flex h-[52px] max-w-full items-center gap-1 overflow-x-auto border-b px-3 backdrop-blur-sm sm:px-6"
            >
                {[
                    { id: "overview", title: "Overview" },
                    ...days.map((day) => ({ id: `day-${day.number}`, title: `Day ${day.number}` })),
                    { id: "ending", title: "Itinerary" },
                    { id: "comments", title: "Comments" }
                ].map((chapter) => (
                    <a
                        key={chapter.id}
                        href={`#${chapter.id}`}
                        aria-current={currentChapter === chapter.id ? "location" : undefined}
                        onClick={(event) => {
                            if (!event.metaKey && !event.ctrlKey && !event.shiftKey && event.button === 0) {
                                event.preventDefault();
                                jump(chapter.id);
                            }
                        }}
                        className="hover:bg-faint aria-[current=location]:bg-foreground aria-[current=location]:text-background shrink-0 rounded-full px-4 py-2 text-xs transition-colors focus-visible:outline-2"
                    >
                        {chapter.title}
                    </a>
                ))}
            </nav>
            <div
                ref={trackRef}
                className={desktop ? "grid h-[calc(100dvh-52px)] min-h-0 grid-cols-[15rem_minmax(0,1fr)]" : ""}
            >
                {desktop ? (
                    <StoryDaySidebar
                        days={days}
                        scene={activeScene}
                        sceneIds={sceneIds}
                        sceneId={sceneId}
                        filter={filter}
                        follow={manualFilter === null}
                        map={map(filter)}
                        onFilter={(value) => {
                            setManualFilter(value);
                            setFocusedActivity(undefined);
                        }}
                        onFollow={() => {
                            setManualFilter(null);
                            setFocusedActivity(undefined);
                        }}
                        onEnlarge={() => setMapExpanded(true)}
                        onOpen={setSelectedActivity}
                        onLocation={focusLocation}
                        onHighlight={setHoveredActivity}
                        jump={jump}
                    />
                ) : null}
                <div
                    ref={viewportRef}
                    role="region"
                    aria-label="Board story scenes"
                    tabIndex={desktop ? 0 : undefined}
                    className={
                        desktop
                            ? "@container min-w-0 snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto overflow-y-hidden overscroll-x-contain focus-visible:outline-2 focus-visible:-outline-offset-2 [&::-webkit-scrollbar]:hidden"
                            : "min-w-0"
                    }
                >
                    <div ref={railRef} className={desktop ? "relative flex h-full w-max" : "relative"}>
                        <header
                            id="overview"
                            data-story-scene
                            data-story-chapter
                            tabIndex={-1}
                            className={`border-line relative min-w-0 px-6 py-8 outline-none sm:px-12 ${desktop ? "flex h-full w-[var(--story-width)] shrink-0 snap-start snap-always items-center gap-10 overflow-y-auto" : "border-b"}`}
                        >
                            <div className="min-w-0 flex-1">
                                <BackLink fallbackHref="/boards" className={desktop ? "mb-5" : "mb-8"} />
                                <div className="mb-4 flex items-center gap-3">
                                    <Link
                                        href={`/profile/${encodeURIComponent(author.id)}`}
                                        className="block w-fit shrink-0"
                                    >
                                        <div
                                            role={author.photo ? undefined : "img"}
                                            aria-label={
                                                author.photo
                                                    ? undefined
                                                    : `Profile photo placeholder for ${author.name}`
                                            }
                                            className="bg-faint size-12 overflow-hidden rounded-full"
                                        >
                                            <BoardPhoto image={author.photo} className="size-full" sizes="48px" />
                                        </div>
                                    </Link>
                                    <p className="text-muted-foreground text-[10px] tracking-[0.2em] uppercase">
                                        A travel story by{" "}
                                        <Link
                                            href={`/profile/${encodeURIComponent(author.id)}`}
                                            className="underline underline-offset-4"
                                        >
                                            @{author.name}
                                        </Link>
                                    </p>
                                </div>
                                <h1 className="font-display max-w-4xl text-[clamp(2.75rem,5vw,5.5rem)] leading-[0.95] font-bold tracking-tight uppercase">
                                    {board.title}
                                </h1>
                                {board.description ? (
                                    <p className="text-muted-foreground mt-6 max-w-lg text-sm leading-relaxed whitespace-pre-line">
                                        {board.description}
                                    </p>
                                ) : null}
                                <p className="text-muted-foreground mt-4 text-[10px]">
                                    Access:{" "}
                                    {board.visibility === "public"
                                        ? "Anyone"
                                        : board.visibility === "friends"
                                          ? "Friends and invited members"
                                          : board.visibility === "private"
                                            ? "Only you"
                                            : "Invited members"}
                                </p>
                                {tagLabels.length ? (
                                    <ul className="mt-5 flex flex-wrap gap-2">
                                        {tagLabels.map((tag) => (
                                            <li
                                                key={tag}
                                                className="border-line rounded-full border px-3 py-1 text-[10px]"
                                            >
                                                {tag}
                                            </li>
                                        ))}
                                    </ul>
                                ) : null}
                                <div className="mt-6">{stats}</div>
                                <div className="mt-3 flex flex-wrap">{saveAction}</div>
                                <p className="text-muted-foreground mt-7 flex items-center gap-3 text-xs">
                                    <ArrowDown size={16} />
                                    Scroll to explore {desktop ? <ArrowRight size={16} /> : null}
                                </p>
                            </div>
                            {board.coverImage ? (
                                <div className={`mt-8 min-w-0 ${desktop ? "max-w-[40%] flex-1 translate-y-12" : ""}`}>
                                    <StoryPhoto image={board.coverImage} eager onOpen={() => openPhoto("cover")} />
                                </div>
                            ) : null}
                            {!desktop ? (
                                <div className="mt-8">
                                    <h2 className="mb-3 text-xs">The whole journey</h2>
                                    {map("all")}
                                </div>
                            ) : null}
                        </header>

                        {scenes.map((scene) => (
                            <BoardDayScene
                                key={scene.id}
                                scene={scene}
                                boardId={board.id}
                                desktop={desktop}
                                onOpenPhoto={openPhoto}
                                onOpenActivity={setSelectedActivity}
                                onHighlight={setHoveredActivity}
                                mobileMap={map(scene.day.number)}
                            />
                        ))}
                    </div>
                </div>
            </div>
            <BoardStoryEnding
                days={days}
                author={author}
                stats={stats}
                saveAction={saveAction}
                jump={jump}
                onOpenActivity={setSelectedActivity}
                onOpenPhoto={openPhoto}
            />
            {bookmarkMessage ? (
                <p role="status" className="px-6 pb-5 text-xs sm:px-12">
                    {bookmarkMessage}
                    {signInToSave ? (
                        <>
                            {" "}
                            <Link
                                href={`/login?returnTo=${encodeURIComponent(`/boards/${board.id}`)}`}
                                className="underline"
                            >
                                Sign in
                            </Link>
                        </>
                    ) : null}
                </p>
            ) : null}
            <BoardComments boardId={board.id} onTotalChange={setCommentsTotal} />
            {mapExpanded ? (
                <BoardDialog
                    title={filter === "all" ? "The whole journey" : `Day ${filter} map`}
                    onClose={() => setMapExpanded(false)}
                >
                    <StoryMap
                        days={days}
                        filter={filter}
                        activeId={highlighted}
                        session={session}
                        expanded
                        onOpen={(activity) => {
                            setMapExpanded(false);
                            setSelectedActivity(activity);
                        }}
                    />
                </BoardDialog>
            ) : null}
            {selectedActivity ? (
                <ActivityDetailsDialog
                    activity={selectedActivity}
                    days={days}
                    onClose={() => setSelectedActivity(null)}
                    onOpenPhoto={(activity, index) => openPhoto(`activity-${activity.id}-${index}`)}
                    onFocusLocation={(activity) => {
                        focusLocation(activity);
                        setSelectedActivity(null);
                    }}
                />
            ) : null}
            {galleryIndex !== null ? (
                <StoryGallery
                    placements={placements}
                    initialIndex={galleryIndex}
                    onClose={() => setGalleryIndex(null)}
                />
            ) : null}
        </article>
    );
}
