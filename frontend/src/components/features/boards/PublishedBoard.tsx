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
import useBoardPhotos from "@/components/features/boards/useBoardPhotos";
import { getBoardDays, getBoardPlaceNames } from "@/lib/board-presentation";
import type { BoardActivity } from "@/types/board";
import type { PublishedBoardData } from "@/types/published-board";

const actionClasses =
    "border-line hover:bg-faint inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 border px-5 py-2 text-14 focus-visible:outline-2 focus-visible:outline-offset-4";

const numberLabel = (number: number) => String(number).padStart(2, "0");

// Invited members can also read friends-only boards under the backend's access rules.
const accessLabels = {
    public: "Anyone",
    friends: "Friends and invited members",
    collaborators: "Invited members",
    private: "Only you"
};

// The tag API has names but no icon field.
function getTagIcon(tag: string) {
    const name = tag.toLowerCase();
    if (name.includes("nature")) return "leaf";
    if (name.includes("romantic")) return "heart";
    return "gem";
}

export default function PublishedBoard({
    board,
    author,
    tagLabels = board.tags,
    canEditContent = false
}: PublishedBoardData) {
    const days = getBoardDays(board);
    const places = getBoardPlaceNames(board);
    const automaticPhotos = useBoardPhotos(board, tagLabels);
    const cover = board.coverImage?.url ? board.coverImage : automaticPhotos.photos.cover;
    const coverLabel = automaticPhotos.slots.find((slot) => slot.id === "cover")?.label || board.title;
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
                {preview.message || "Bookmarks and copies are previews saved in this tab."}
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
                        image={cover}
                        placeholderLabel={coverLabel}
                        showCredit={!board.coverImage?.url}
                        insetCredit
                        preload
                        className="mx-auto h-[16rem] w-[82%] rounded-b-[50%] sm:h-[25rem] lg:h-[29rem] lg:w-[80%]"
                        sizes="80vw"
                    />
                    <div className="relative mx-auto -mt-7 w-fit">
                        {/* Keep the avatar circle when there is no profile photo, so the name stays below the cover. */}
                        <div
                            role={author.photo ? undefined : "img"}
                            aria-label={author.photo ? undefined : `Profile photo placeholder for ${author.name}`}
                            className="border-background bg-faint mx-auto size-16 overflow-hidden rounded-full border-4"
                        >
                            <BoardPhoto image={author.photo} className="h-full w-full" sizes="64px" />
                        </div>
                        <p className="text-12 mt-2">{author.name}</p>
                        <p className="text-muted-foreground text-10">presents</p>
                    </div>
                    <h1 className="font-display mx-auto mt-7 max-w-6xl px-5 text-[clamp(2.75rem,7vw,8rem)] leading-[0.95] font-bold tracking-tight break-words uppercase">
                        {board.title}
                    </h1>
                    <p className="text-muted-foreground text-12 mt-4 px-5">Access: {accessLabels[board.visibility]}</p>
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
                    {canEditContent ? (
                        <Link href={`/boards/${board.id}/edit`} className={`${actionClasses} mt-5`}>
                            Edit Board
                        </Link>
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
                    {tagLabels.length ? (
                        <ul className="border-line text-muted-foreground text-12 mx-auto mt-8 flex w-fit max-w-[90%] flex-wrap justify-center gap-x-7 gap-y-4 border-b px-2 pb-8">
                            {tagLabels.slice(0, 3).map((tag) => (
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
                        <PublishedBoardDay
                            key={day.number}
                            day={day}
                            onSelectActivity={handleOpenActivity}
                            photos={{
                                first: automaticPhotos.photos[`day-${day.number}-first`],
                                second: automaticPhotos.photos[`day-${day.number}-second`]
                            }}
                            photoLabels={{
                                first: automaticPhotos.slots.find((slot) => slot.id === `day-${day.number}-first`)
                                    ?.label,
                                second: automaticPhotos.slots.find((slot) => slot.id === `day-${day.number}-second`)
                                    ?.label
                            }}
                        />
                    ))
                ) : (
                    <p className="text-muted-foreground px-5 py-16 text-center">This board has no activities yet.</p>
                )}
                <footer className="border-line grid min-h-[42rem] grid-cols-1 gap-24 border-t px-5 py-10 sm:px-9 lg:gap-36 lg:py-12">
                    <section>
                        <p className="text-muted-foreground text-12">like this board?</p>
                        <h2 className="font-display text-36 mt-1 font-bold uppercase">Make it yours</h2>
                        <p className="text-muted-foreground text-14 mt-1 max-w-60">
                            Create a preview copy in this tab and add your own ideas.
                        </p>
                        <button type="button" onClick={preview.copyBoard} className={`${actionClasses} mt-5`}>
                            <BoardIcon name="copy" className="size-4" />
                            Copy board preview
                        </button>
                    </section>
                    <section
                        aria-labelledby="board-author-heading"
                        className="w-full max-w-lg min-w-0 self-end justify-self-end"
                    >
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
                                <p className="text-14 leading-snug whitespace-pre-line">{author.bio}</p>
                            </div>
                            <BoardPhoto
                                image={author.photo}
                                placeholderLabel={`${author.name}'s profile photo`}
                                className="aspect-[3/4] min-h-72"
                            />
                        </div>
                    </section>
                    <p className="text-muted-foreground text-10">
                        Bookmarks and copies are previews saved in this tab.
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
