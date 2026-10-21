"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowDown, ArrowRight, Bookmark, MapPin } from "lucide-react";
import BackLink from "@/components/ui/BackLink";
import ActivityDetailsDialog from "./ActivityDetailsDialog";
import BoardComments from "./BoardComments";
import BoardPhoto from "./BoardPhoto";
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
        x,
        desktop,
        size,
        chapter: currentChapter,
        activityId,
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
    const renderFillers = (key: string) =>
        (fillerPlacements.get(key) ?? []).map((placement) => (
            <div key={placement.id} className="max-w-full shrink-0 lg:w-max">
                <p className="text-muted-foreground mb-3 text-[10px] tracking-[0.15em] uppercase">
                    Destination illustration
                </p>
                <StoryPhoto image={placement.image} onOpen={() => openPhoto(placement.id)} />
            </div>
        ));
    const map = (mapFilter: number | "all") => (
        <StoryMap
            days={days}
            filter={mapFilter}
            session={session}
            activeId={focusedActivity ?? activityId}
            onOpen={setSelectedActivity}
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
            <div ref={trackRef} style={desktop ? { height: size.travel + size.height } : undefined}>
                <div
                    ref={viewportRef}
                    className={desktop ? "sticky top-[52px] overflow-clip" : "min-w-0"}
                    style={desktop ? { height: size.height } : undefined}
                >
                    <motion.div
                        ref={railRef}
                        style={{ x }}
                        className={desktop ? "relative flex h-full w-max" : "relative"}
                    >
                        <header
                            id="overview"
                            data-story-chapter
                            tabIndex={-1}
                            className={`border-line relative min-w-0 px-6 py-8 outline-none sm:px-12 ${desktop ? "flex h-full w-[var(--story-width)] shrink-0 items-center gap-10 pr-96" : "border-b"}`}
                        >
                            <div className="min-w-0 flex-1">
                                <BackLink
                                    fallbackHref="/boards"
                                    className={desktop ? "absolute top-3 left-5" : "mb-8"}
                                />
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
                                <div className={`mt-8 min-w-0 ${desktop ? "max-w-[32vw] flex-1" : ""}`}>
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
                        {days.map((day) => (
                            <section
                                key={day.number}
                                id={`day-${day.number}`}
                                aria-labelledby={`day-heading-${day.number}`}
                                data-story-chapter
                                tabIndex={-1}
                                className={`border-line min-w-0 border-b px-6 py-9 outline-none sm:px-12 ${desktop ? "flex h-full min-w-[var(--story-width)] shrink-0 items-center gap-12 border-r border-b-0 pr-96" : ""}`}
                            >
                                <header className={`mb-8 shrink-0 ${desktop ? "w-64 self-start pt-8" : ""}`}>
                                    <p className="text-muted-foreground mb-4 text-[10px] tracking-[0.2em] uppercase">
                                        Chapter {String(day.number).padStart(2, "0")}
                                    </p>
                                    <h2
                                        id={`day-heading-${day.number}`}
                                        className="font-display text-6xl leading-none font-bold sm:text-7xl"
                                    >
                                        Day {day.number}
                                    </h2>
                                    {day.date ? (
                                        <time className="text-muted-foreground mt-4 block text-xs" dateTime={day.date}>
                                            {day.date}
                                        </time>
                                    ) : null}
                                    {day.title && day.title !== `Day ${day.number}` ? (
                                        <p className="mt-4 text-sm">{day.title}</p>
                                    ) : null}
                                    <p className="text-muted-foreground mt-4 text-xs">
                                        {day.items.filter((item) => item.type === "activity").length} activities
                                    </p>
                                    {!desktop ? <div className="mt-6">{map(day.number)}</div> : null}
                                </header>
                                {day.items.length ? (
                                    day.items.map((item, sequence) =>
                                        item.type === "activity" ? (
                                            <div
                                                key={item.id}
                                                data-story-activity={item.id}
                                                className={desktop ? "flex shrink-0 items-center gap-10" : ""}
                                            >
                                                <div
                                                    className={`border-line mb-8 min-w-0 border-t pt-5 ${desktop ? "w-72 shrink-0" : ""}`}
                                                >
                                                    <p className="text-muted-foreground mb-4 text-[10px] tracking-wider">
                                                        {String(sequence + 1).padStart(2, "0")}
                                                        {item.time ? ` / ${item.time}` : ""}
                                                    </p>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedActivity(item)}
                                                        className="group text-left focus-visible:outline-2 focus-visible:outline-offset-4"
                                                    >
                                                        <h3 className="font-display text-3xl leading-tight font-bold transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
                                                            {item.title}
                                                        </h3>
                                                    </button>
                                                    {item.description ? (
                                                        <p className="text-muted-foreground mt-4 max-w-md text-sm leading-relaxed">
                                                            {Array.from(item.description).slice(0, 120).join("")}
                                                            {Array.from(item.description).length > 120 ? "…" : ""}
                                                        </p>
                                                    ) : null}
                                                    {item.location ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => focusLocation(item)}
                                                            className="text-muted-foreground mt-4 flex min-h-11 items-center gap-2 text-left text-xs underline underline-offset-4"
                                                        >
                                                            <MapPin size={14} className="shrink-0" />
                                                            {item.location.name}
                                                        </button>
                                                    ) : null}
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedActivity(item)}
                                                        className="mt-3 inline-flex min-h-11 items-center gap-3 text-xs underline underline-offset-4"
                                                    >
                                                        Activity details <ArrowRight size={14} />
                                                    </button>
                                                </div>
                                                <div
                                                    className={
                                                        desktop
                                                            ? "flex shrink-0 items-center gap-8"
                                                            : "mb-10 grid gap-6"
                                                    }
                                                >
                                                    {item.images.map((image, index) => (
                                                        <StoryPhoto
                                                            key={`${image.id}-${index}`}
                                                            image={image}
                                                            onOpen={() => openPhoto(`activity-${item.id}-${index}`)}
                                                        />
                                                    ))}
                                                </div>
                                                {renderFillers(item.id)}
                                            </div>
                                        ) : null
                                    )
                                ) : (
                                    <div className="text-muted-foreground max-w-sm text-sm leading-relaxed">
                                        <p>A little room to wander.</p>
                                        <p className="mt-3">
                                            No activities are recorded for this day. Continue to the next chapter or
                                            explore the journey map.
                                        </p>
                                    </div>
                                )}
                                {renderFillers(`empty-${day.number}`)}
                            </section>
                        ))}
                    </motion.div>
                    {desktop ? (
                        <aside
                            aria-label="Journey map"
                            className="border-line bg-background/95 absolute right-5 bottom-5 z-10 w-[min(19rem,30%)] rounded-xl border p-3 shadow-sm backdrop-blur-sm"
                        >
                            <div className="mb-3 flex items-center justify-between gap-2">
                                <label className="min-w-0 text-[10px]">
                                    Map view
                                    <select
                                        aria-label="Map day filter"
                                        value={filter}
                                        onChange={(event) => {
                                            setManualFilter(
                                                event.target.value === "all" ? "all" : Number(event.target.value)
                                            );
                                            setFocusedActivity(undefined);
                                        }}
                                        className="border-line bg-background ml-2 max-w-28 border-b py-2 text-xs"
                                    >
                                        <option value="all">All days</option>
                                        {days.map((day) => (
                                            <option key={day.number} value={day.number}>
                                                Day {day.number}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <button
                                    type="button"
                                    aria-pressed={manualFilter === null}
                                    onClick={() => {
                                        setManualFilter(null);
                                        setFocusedActivity(undefined);
                                    }}
                                    className="min-h-10 text-[10px] underline underline-offset-4"
                                >
                                    Follow story
                                </button>
                            </div>
                            {map(filter)}
                            <p className="text-muted-foreground mt-2 text-[9px]">
                                Day colors · activity numbers · Ctrl-scroll to zoom
                            </p>
                        </aside>
                    ) : null}
                </div>
            </div>
            <section id="ending" tabIndex={-1} className="border-line px-6 py-16 outline-none sm:px-12 sm:py-24">
                <p className="text-muted-foreground text-[10px] tracking-[0.2em] uppercase">The journey, at a glance</p>
                <h2 className="font-display mt-3 text-5xl font-bold sm:text-7xl">Every day. Every memory.</h2>
                <div className="mt-10 max-w-3xl">{stats}</div>
                <div className="mt-10 max-w-3xl">
                    {days.map((day) => (
                        <div key={day.number} className="border-line grid grid-cols-[5rem_1fr] gap-4 border-b py-5">
                            <a
                                href={`#day-${day.number}`}
                                onClick={(event) => {
                                    event.preventDefault();
                                    jump(`day-${day.number}`);
                                }}
                                className="font-display text-xl underline decoration-1 underline-offset-4"
                            >
                                Day {day.number}
                            </a>
                            <ul className="space-y-3">
                                {day.items
                                    .filter((item): item is BoardActivity => item.type === "activity")
                                    .map((item) => (
                                        <li key={item.id}>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedActivity(item)}
                                                className="min-h-9 text-left text-sm hover:underline"
                                            >
                                                {item.time ? (
                                                    <span className="text-muted-foreground mr-4 text-xs">
                                                        {item.time}
                                                    </span>
                                                ) : null}
                                                {item.title}
                                            </button>
                                        </li>
                                    ))}
                                {!day.items.length ? (
                                    <li className="text-muted-foreground text-xs">No recorded activities</li>
                                ) : null}
                            </ul>
                        </div>
                    ))}
                </div>
                <div className="mt-8 flex flex-wrap">{saveAction}</div>
                {author.bio ? (
                    <p className="text-muted-foreground mt-8 max-w-lg text-sm leading-relaxed">
                        From{" "}
                        <Link href={`/profile/${encodeURIComponent(author.id)}`} className="underline">
                            @{author.name}
                        </Link>{" "}
                        — {author.bio}
                    </p>
                ) : null}
            </section>
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
