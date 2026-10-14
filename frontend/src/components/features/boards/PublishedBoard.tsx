"use client";

import Link from "next/link";
import { useState } from "react";
import ActivityDetailsDialog from "@/components/features/boards/ActivityDetailsDialog";
import BoardCopyEditor from "@/components/features/boards/BoardCopyEditor";
import BoardDialog from "@/components/features/boards/BoardDialog";
import BoardIcon from "@/components/features/boards/BoardIcon";
import BoardPhoto from "@/components/features/boards/BoardPhoto";
import PublishedBoardDay from "@/components/features/boards/PublishedBoardDay";
import useBoardPreview from "@/components/features/boards/useBoardPreview";
import { getBoardDays, getBoardPlaceNames } from "@/lib/board-presentation";
import type { BoardActivity } from "@/types/board";
import type { PublishedBoardData } from "@/types/published-board";

const actionClasses =
    "border-line hover:bg-faint inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 border px-5 py-2 text-14 focus-visible:outline-2 focus-visible:outline-offset-4";

const numberLabel = (number: number) => String(number).padStart(2, "0");

// Temporary icon lookup until the tag database is connected.
function getTagIcon(tag: string) {
    const name = tag.toLowerCase();
    if (name.includes("nature")) return "leaf";
    if (name.includes("romantic")) return "heart";
    return "gem";
}

export default function PublishedBoard({ board, author, highlights }: PublishedBoardData) {
    const days = getBoardDays(board);
    const places = getBoardPlaceNames(board);
    const [selectedActivity, setSelectedActivity] = useState<BoardActivity | null>(null);
    // Preview saves and copies only stay in this browser tab.
    const preview = useBoardPreview(board, selectedActivity);

    // Don't carry a previous activity's save message into this popup.
    function handleOpenActivity(activity: BoardActivity) {
        preview.clearFeedback();
        setSelectedActivity(activity);
    }

    function handleCloseActivity() {
        setSelectedActivity(null);
    }

    // Keep the popup open if copying fails, so the error stays visible.
    function handleCopyActivity() {
        if (preview.copyActivity()) handleCloseActivity();
    }

    const feedback = (
        <>
            <p role="status" className="text-muted-foreground text-12 mt-3">
                {preview.message}
            </p>
            {preview.error ? (
                <p role="alert" className="text-14 mt-3">
                    {preview.error}
                </p>
            ) : null}
        </>
    );

    return (
        <>
            <article className="break-words">
                <header className="relative pb-12 text-center sm:pb-20">
                    <Link
                        href="/boards"
                        className="text-muted-foreground hover:text-foreground text-12 absolute top-6 left-4 z-10 inline-flex min-h-9 items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-4 sm:left-8"
                    >
                        <BoardIcon name="arrow" className="size-3" /> back
                    </Link>
                    <BoardPhoto
                        image={board.coverImage}
                        preload
                        className="mx-auto mt-32 h-[16rem] w-[82%] rounded-b-[50%] sm:h-[25rem] lg:mt-0 lg:mr-48 lg:ml-auto lg:h-[29rem] lg:w-[calc(100%-14rem)] lg:max-w-[80%]"
                        sizes="80vw"
                    />
                    <div className={`relative mx-auto w-fit ${board.coverImage ? "-mt-7" : "pt-28"}`}>
                        <BoardPhoto
                            image={author.photo}
                            className="border-background mx-auto size-16 rounded-full border-4"
                            sizes="64px"
                        />
                        <p className="text-12 mt-2">{author.name}</p>
                        <p className="text-muted-foreground text-10">presents</p>
                    </div>
                    <h1 className="font-display mx-auto mt-7 max-w-6xl px-5 text-[clamp(2.75rem,7vw,8rem)] leading-[0.95] font-bold tracking-tight break-words uppercase">
                        {board.title}
                    </h1>
                    {board.description ? (
                        <p className="text-muted-foreground text-14 sm:text-16 mx-auto mt-9 max-w-lg px-5 leading-snug whitespace-pre-line">
                            {board.description}
                        </p>
                    ) : null}
                    <button
                        type="button"
                        onClick={preview.saveBoard}
                        aria-label={preview.boardSaved ? "Remove board preview bookmark" : "Bookmark board preview"}
                        aria-pressed={preview.boardSaved}
                        className="hover:bg-faint mt-7 inline-flex size-11 cursor-pointer items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-4"
                    >
                        <BoardIcon name="bookmark" className={`size-5 ${preview.boardSaved ? "fill-current" : ""}`} />
                    </button>
                    {/* Show feedback on the page when no popup is open. */}
                    <div className="mx-auto max-w-md px-5">{selectedActivity || preview.draft ? null : feedback}</div>
                    {highlights.length ? (
                        <ul className="border-line text-muted-foreground text-16 mx-auto mt-8 w-fit min-w-56 space-y-3 border-t px-6 pt-9">
                            {highlights.map((highlight) => (
                                <li key={highlight}>{highlight}</li>
                            ))}
                        </ul>
                    ) : null}
                    <dl className="border-line text-muted-foreground mx-auto mt-10 flex w-fit border-y px-8 py-6">
                        <div className="border-line flex items-baseline gap-1 border-r pr-8">
                            <dt className="text-12 order-2">days</dt>
                            <dd className="text-36 leading-none">{numberLabel(days.length)}</dd>
                        </div>
                        <div className="flex items-baseline gap-1 pl-8">
                            <dt className="text-12 order-2">places</dt>
                            <dd className="text-36 leading-none">{numberLabel(places.length)}</dd>
                        </div>
                    </dl>
                    {/* Only show the first three tags. */}
                    {board.tags.length ? (
                        <ul className="border-line text-muted-foreground text-12 mx-auto mt-8 flex w-fit max-w-[90%] flex-wrap justify-center gap-x-7 gap-y-4 border-b px-2 pb-8">
                            {board.tags.slice(0, 3).map((tag) => (
                                <li key={tag} className="flex items-center gap-2">
                                    <BoardIcon name={getTagIcon(tag)} className="size-6" />
                                    {tag}
                                </li>
                            ))}
                        </ul>
                    ) : null}
                    {places.length ? (
                        <ul className="border-line text-muted-foreground text-14 mx-auto mt-7 w-fit max-w-[85%] space-y-2 border-b px-5 pb-7">
                            {places.map((place, index) => (
                                <li key={`${place}-${index}`}>{place}</li>
                            ))}
                        </ul>
                    ) : null}
                </header>
                {days.length ? (
                    days.map((day) => (
                        <PublishedBoardDay key={day.number} day={day} onSelectActivity={handleOpenActivity} />
                    ))
                ) : (
                    <p className="text-muted-foreground px-5 py-16 text-center">This board has no activities yet.</p>
                )}
                <footer className="border-line grid min-h-[42rem] gap-24 border-t px-5 py-10 sm:px-9 lg:gap-36 lg:py-12">
                    <section>
                        <p className="text-muted-foreground text-12">like this board?</p>
                        <h2 className="font-display text-36 mt-1 font-bold uppercase">Make it yours</h2>
                        <p className="text-muted-foreground text-14 mt-1 max-w-60">
                            Save a copy and add your own ideas. Keep the places you love, change the rest.
                        </p>
                        <button type="button" onClick={preview.copyBoard} className={`${actionClasses} mt-5`}>
                            <BoardIcon name="copy" className="size-4" />
                            Copy board
                        </button>
                    </section>
                    <section aria-labelledby="board-author-heading" className="max-w-lg self-end justify-self-end">
                        <h2
                            id="board-author-heading"
                            className="font-display text-36 text-right leading-none font-bold uppercase"
                        >
                            About {author.name}
                        </h2>
                        <p className="text-muted-foreground text-12 mt-3 ml-auto max-w-60 text-right">
                            Every board starts with a person. Here is the traveller behind this one.
                        </p>
                        <div className="mt-6 grid gap-5 sm:grid-cols-[1fr_1.1fr]">
                            <div className="text-muted-foreground text-right">
                                <dl className="mb-6 flex justify-end gap-7 sm:flex-col sm:gap-5">
                                    {/* Zero is a valid count; only hide missing values. */}
                                    {author.countriesVisited !== undefined ? (
                                        <div>
                                            <dt className="text-10">countries visited</dt>
                                            <dd className="font-display text-30 font-semibold">
                                                {author.countriesVisited}
                                            </dd>
                                        </div>
                                    ) : null}
                                    {author.boardsCreated !== undefined ? (
                                        <div>
                                            <dt className="text-10">boards created</dt>
                                            <dd className="font-display text-30 font-semibold">
                                                {author.boardsCreated}
                                            </dd>
                                        </div>
                                    ) : null}
                                </dl>
                                <p className="text-14 leading-snug whitespace-pre-line">{author.bio}</p>
                            </div>
                            <BoardPhoto image={author.photo} className="aspect-[3/4] min-h-72" />
                        </div>
                    </section>
                    <p className="text-muted-foreground text-10">
                        Development preview: sample board and author. Saves and copies stay in this tab.
                    </p>
                </footer>
            </article>
            {selectedActivity && (
                <ActivityDetailsDialog
                    activity={selectedActivity}
                    days={days}
                    saved={preview.activitySaved}
                    onClose={handleCloseActivity}
                    onSave={preview.saveActivity}
                    onCopy={handleCopyActivity}
                >
                    {feedback}
                </ActivityDetailsDialog>
            )}
            {preview.draft ? (
                <BoardDialog title="Make it yours" onClose={() => preview.setDraft(null)}>
                    <BoardCopyEditor sourceBoardId={board.id} initialDraft={preview.draft} onSaved={preview.setDraft} />
                    {preview.error ? (
                        <p role="alert" className="text-14 mt-3">
                            {preview.error}
                        </p>
                    ) : null}
                </BoardDialog>
            ) : null}
        </>
    );
}
