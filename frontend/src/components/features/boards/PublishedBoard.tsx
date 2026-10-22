"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { ArrowRight, Copy, MessageCircle } from "lucide-react";
import ChapterBar from "@/components/ui/ChapterBar";
import ScrollCue from "@/components/ui/ScrollCue";
import ActivityDetailsDialog from "./ActivityDetailsDialog";
import BoardComments from "./BoardComments";
import BoardPhoto from "./BoardPhoto";
import BoardDayScene from "./BoardDayScene";
import BoardStoryEnding from "./BoardStoryEnding";
import BoardIcon from "./BoardIcon";
import StoryMapControls from "./StoryMapControls";
import { createDayScenes, sceneActivities, storySeed, type ScenePhoto } from "@/lib/board-story-scenes";
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
    const router = useRouter();
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
    const [remixBusy, setRemixBusy] = useState(false);
    const [feedbackContext, setFeedbackContext] = useState<"overview" | "ending">("overview");
    const bookmarkPending = useRef(false);
    const [bookmarkMessage, setBookmarkMessage] = useState("");
    const [signInToSave, setSignInToSave] = useState(false);
    const [focusedActivity, setFocusedActivity] = useState<string>();
    const [hoveredActivity, setHoveredActivity] = useState<string>();
    const mapZoom = useRef<number | undefined>(undefined);
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
                        ...(fillerPlacements.get(activity.id) ?? []).map((photo) => ({
                            ...photo,
                            activityId: activity.id,
                            illustration: true
                        }))
                    ])
                ];
                return createDayScenes(day, photos);
            }),
        [days, fillerPlacements]
    );
    const placements = useMemo<StoryPlacement[]>(
        () => [
            ...(board.coverImage ? [{ id: "cover", image: board.coverImage }] : []),
            ...scenes.flatMap((scene) => scene.photos)
        ],
        [board.coverImage, scenes]
    );
    const highlighted = hoveredActivity ?? focusedActivity;
    const highlightActivity = (id?: string) => {
        setHoveredActivity(id);
        if (id && activities.some((activity) => activity.id === id && activity.location)) setFocusedActivity(id);
    };
    const sceneIds = ["overview", ...scenes.map((scene) => scene.id)];
    const openPhoto = (id: string) => {
        const index = placements.findIndex((placement) => placement.id === id);
        if (index >= 0) setGalleryIndex(index);
    };
    const focusLocation = (activity: BoardActivity) => {
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

    async function remixBoard() {
        if (bookmarkPending.current) return;
        bookmarkPending.current = true;
        setRemixBusy(true);
        setFeedbackContext("ending");
        setBookmarkMessage("");
        setSignInToSave(false);
        try {
            if (!bookmarked) {
                await saveBoardBookmark(Number(board.id));
                setBookmarked(true);
                try {
                    const current = await loadBoardDocument(Number(board.id));
                    setSaveTotal(current.savedCount);
                } catch {
                    setSaveTotal(undefined);
                }
            }
            router.push(`/boards/new?remix=${board.id}`);
        } catch (error) {
            setSignInToSave(error instanceof ProfileApiError && error.status === 401);
            setBookmarkMessage(error instanceof Error ? error.message : "This Board could not be opened for remix.");
        } finally {
            bookmarkPending.current = false;
            setRemixBusy(false);
        }
    }

    const actionFeedback = (context: "overview" | "ending") =>
        bookmarkMessage && feedbackContext === context ? (
            <p role="status" className="mt-3 text-xs">
                {bookmarkMessage}
                {signInToSave ? (
                    <>
                        {" "}
                        <Link
                            href={`/login?returnTo=${encodeURIComponent(`/boards/${board.id}${context === "ending" ? "#ending" : ""}`)}`}
                            className="underline"
                        >
                            Sign in
                        </Link>
                    </>
                ) : null}
            </p>
        ) : null;

    const saveAction = (context: "overview" | "ending") => (
        <>
            {!canManageBoard ? (
                <button
                    type="button"
                    onClick={() => {
                        setFeedbackContext(context);
                        return toggleBookmark();
                    }}
                    disabled={bookmarkBusy || remixBusy}
                    aria-label={bookmarked ? "Unsave Board" : "Save Board"}
                    aria-pressed={bookmarked}
                    className={`${actionClass} border-line border py-3`}
                >
                    <BoardIcon name="bookmark" className={`size-5 ${bookmarked ? "fill-current" : ""}`} />
                    {bookmarkBusy ? "Saving…" : bookmarked ? "Unsave Board" : "Save this Board"}
                </button>
            ) : null}
            {canEditContent ? (
                <Link href={`/boards/${board.id}/edit`} className={actionClass}>
                    Edit Board <ArrowRight size={16} />
                </Link>
            ) : null}
        </>
    );
    const remixAction = !canManageBoard ? (
        <button
            type="button"
            aria-label="Remix Board"
            onClick={remixBoard}
            disabled={bookmarkBusy || remixBusy}
            className={`${actionClass} border-line border py-3`}
        >
            <Copy size={18} aria-hidden="true" />
            {remixBusy ? "Opening remix…" : "Remix this Board"}
        </button>
    ) : null;
    const stats = (
        <dl className="border-line grid grid-cols-2 gap-x-4 gap-y-5 border-y py-6 text-center text-xs @min-[30rem]:grid-cols-4 @min-[45rem]:gap-x-8">
            <div>
                <dd className="font-display text-4xl @min-[30rem]:text-5xl">{days.length}</dd>
                <dt className="text-muted-foreground mt-2">days</dt>
            </div>
            <div>
                <dd className="font-display text-4xl @min-[30rem]:text-5xl">{activities.length}</dd>
                <dt className="text-muted-foreground mt-2">activities</dt>
            </div>
            <div
                aria-label={
                    saveTotal === undefined
                        ? "Save count unavailable"
                        : `${saveTotal} ${saveTotal === 1 ? "save" : "saves"}`
                }
            >
                <dd className="font-display flex items-center justify-center gap-1.5 text-4xl @min-[30rem]:text-5xl">
                    <BoardIcon name="bookmark" className="size-6 shrink-0 @min-[30rem]:size-7" />
                    {countLabel(saveTotal)}
                </dd>
                <dt className="text-muted-foreground mt-2">saves</dt>
            </div>
            <div>
                <dd className="font-display text-4xl @min-[30rem]:text-5xl">
                    <span className="flex items-center justify-center gap-1.5">
                        <MessageCircle className="size-6 shrink-0 @min-[30rem]:size-7" aria-hidden="true" />
                        {countLabel(commentsTotal)}
                    </span>
                </dd>
                <dt className="text-muted-foreground mt-2">comments</dt>
            </div>
        </dl>
    );
    const map = (mapFilter: number | "all") => (
        <StoryMap
            days={days}
            filter={mapFilter}
            session={session}
            userZoom={mapZoom}
            activeId={highlighted}
            fill
            focusFirst={mapFilter !== "all"}
            onOpen={setSelectedActivity}
        />
    );
    const journeyMap = (mapFilter: number | "all") => <StoryMapControls map={map(mapFilter)} />;
    const sceneIndex = sceneId === "ending" ? sceneIds.length - 1 : Math.max(0, sceneIds.indexOf(sceneId));
    const nextScene = sceneIds[sceneIndex + 1] ?? "ending";
    const previousScene = sceneIds[sceneIndex - 1];

    return (
        <article className="relative min-w-0 break-words">
            <ChapterBar
                chapters={[
                    { id: "overview", title: "Overview" },
                    ...days.map((day) => ({ id: `day-${day.number}`, title: `Day ${day.number}` })),
                    { id: "ending", title: "Summary" },
                    { id: "comments", title: "Comments" }
                ]}
                current={currentChapter}
                onNavigate={jump}
            />
            <div ref={trackRef} className={desktop ? "relative min-h-0" : ""}>
                <div
                    ref={viewportRef}
                    role="region"
                    aria-label="Board story scenes"
                    tabIndex={desktop ? 0 : undefined}
                    className={
                        desktop
                            ? "@container sticky top-[62px] h-[calc(100dvh-62px)] min-w-0 snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto overflow-y-hidden overscroll-x-contain focus-visible:outline-2 focus-visible:-outline-offset-2 [&::-webkit-scrollbar]:hidden"
                            : "min-w-0"
                    }
                >
                    <div ref={railRef} className={desktop ? "relative flex h-full w-max" : "relative"}>
                        <header
                            id="overview"
                            data-story-scene
                            data-story-chapter
                            tabIndex={-1}
                            className={`border-line relative min-w-0 outline-none ${desktop ? "h-full w-[var(--story-width)] shrink-0 snap-start snap-always [scrollbar-gutter:stable] overflow-y-auto py-6 pr-24 pl-20" : "border-b px-6 py-8 sm:px-12"}`}
                        >
                            <div className={desktop ? "grid h-full min-h-[48rem] grid-cols-12 grid-rows-6 gap-5" : ""}>
                                <div
                                    className={
                                        desktop
                                            ? "col-[1/8] row-[1/4] min-h-0 min-w-0 overflow-y-auto overscroll-contain"
                                            : "min-w-0 flex-1"
                                    }
                                >
                                    <div data-story-author-row className="mb-4 flex flex-wrap items-center gap-3">
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
                                            A BOARD CREATED BY{" "}
                                            <Link
                                                href={`/profile/${encodeURIComponent(author.id)}`}
                                                className="underline underline-offset-4"
                                            >
                                                @{author.name}
                                            </Link>
                                        </p>
                                        <div className="ml-4 flex flex-wrap items-center gap-2">
                                            {saveAction("overview")}
                                        </div>
                                    </div>
                                    {actionFeedback("overview")}
                                    <h1 className="font-display max-w-4xl text-[clamp(2.75rem,4.5vw,4.75rem)] leading-[0.95] font-bold tracking-tight uppercase">
                                        {board.title}
                                    </h1>
                                    {board.description ? (
                                        <p className="text-muted-foreground mt-5 max-w-3xl text-sm leading-relaxed whitespace-pre-line">
                                            {board.description}
                                        </p>
                                    ) : null}
                                    <div data-story-metadata className="mt-4 flex flex-wrap items-center gap-3">
                                        <span className="text-muted-foreground text-[10px]">
                                            Access:{" "}
                                            {board.visibility === "public"
                                                ? "Anyone"
                                                : board.visibility === "friends"
                                                  ? "Friends and invited members"
                                                  : board.visibility === "private"
                                                    ? "Only you"
                                                    : "Invited members"}
                                        </span>
                                        {tagLabels.length ? (
                                            <ul className="flex flex-wrap gap-2">
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
                                    </div>
                                    <div
                                        className={`@container mt-3 w-full max-w-md min-w-0 [&_dd]:text-2xl [&_dl]:gap-x-4 [&_dl]:py-3 [&_dt]:mt-1 [&_svg]:size-4 ${desktop ? "[&_dl]:grid-cols-4" : ""}`}
                                    >
                                        {stats}
                                    </div>
                                </div>
                                {desktop ? (
                                    <>
                                        <div className="col-[1/4] row-[4/7] self-end">{journeyMap("all")}</div>
                                    </>
                                ) : null}
                                {board.coverImage ? (
                                    <div
                                        className={
                                            desktop
                                                ? "[container-type:size] col-[8/13] row-[1/7] flex h-full min-h-0 min-w-0 items-center justify-center"
                                                : "[container-type:size] mt-8 flex h-[65dvh] min-h-80 items-center justify-center"
                                        }
                                    >
                                        <StoryPhoto
                                            image={board.coverImage}
                                            frame
                                            preservePortrait
                                            portraitShape={storySeed(`${board.id}:cover`) % 2 ? "square" : "tall"}
                                            eager
                                            onOpen={() => openPhoto("cover")}
                                        />
                                    </div>
                                ) : null}
                                {!desktop ? <div className="mt-8">{journeyMap("all")}</div> : null}
                                {!desktop ? (
                                    <ScrollCue
                                        targetId={sceneIds[1] ?? "ending"}
                                        label="Scroll to explore"
                                        lines={false}
                                        className="mt-8"
                                        onClick={(event) => {
                                            event.preventDefault();
                                            jump(sceneIds[1] ?? "ending");
                                        }}
                                    />
                                ) : null}
                            </div>
                        </header>

                        {scenes.map((scene) => (
                            <BoardDayScene
                                key={scene.id}
                                scene={scene}
                                boardId={board.id}
                                desktop={desktop}
                                onOpenPhoto={openPhoto}
                                onOpenActivity={setSelectedActivity}
                                onHighlight={highlightActivity}
                                journeyMap={journeyMap(scene.day.number)}
                                onLocation={focusLocation}
                            />
                        ))}
                    </div>
                    {desktop ? (
                        <ScrollCue
                            targetId={nextScene}
                            label="Next story scene"
                            direction="right"
                            lines={false}
                            className="absolute top-1/2 right-3 z-20 -translate-y-1/2"
                            onClick={(event) => {
                                if (!event.metaKey && !event.ctrlKey && !event.shiftKey && event.button === 0) {
                                    event.preventDefault();
                                    jump(nextScene);
                                }
                            }}
                        />
                    ) : null}
                    {desktop && previousScene ? (
                        <ScrollCue
                            targetId={previousScene}
                            label="Previous story scene"
                            direction="left"
                            lines={false}
                            className="absolute top-1/2 left-3 z-20 -translate-y-1/2"
                            onClick={(event) => {
                                if (!event.metaKey && !event.ctrlKey && !event.shiftKey && event.button === 0) {
                                    event.preventDefault();
                                    jump(previousScene);
                                }
                            }}
                        />
                    ) : null}
                </div>
            </div>
            <BoardStoryEnding
                days={days}
                author={author}
                boardTitle={board.title}
                stats={stats}
                saveAction={saveAction("ending")}
                remixAction={remixAction}
                actionFeedback={actionFeedback("ending")}
                journeyMap={
                    <StoryMap
                        days={days}
                        filter="all"
                        session={session}
                        userZoom={mapZoom}
                        expanded
                        onOpen={setSelectedActivity}
                    />
                }
                jump={jump}
                onOpenActivity={setSelectedActivity}
                onOpenPhoto={openPhoto}
            />
            <BoardComments boardId={board.id} onTotalChange={setCommentsTotal} />
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
