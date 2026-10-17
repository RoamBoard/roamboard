"use client";

import type { CSSProperties } from "react";
import BoardPhoto from "@/components/features/boards/BoardPhoto";
import type { BoardActivity, BoardImage, BoardItem } from "@/types/board";
import type { PublishedBoardDay as BoardDay } from "@/types/published-board";

// Five entries repeat across four desktop rows. These named positions match
// the supplied design; mobile uses the normal item order.
const itemPositions = [
    { row: 1, column: "6 / span 5" },
    { row: 2, column: "1 / span 6" },
    { row: 2, column: "7 / span 4" },
    { row: 3, column: "1 / span 6" },
    { row: 4, column: "3 / span 6" }
];

// Repeat the desktop layout for each group of five items.
function getItemStyle(index: number, evenDay: boolean): CSSProperties {
    const positionIndex = index % itemPositions.length;
    const position = itemPositions[positionIndex];
    const group = Math.floor(index / itemPositions.length);
    // Move the first card on even days to alternate the layout.
    const column = evenDay && positionIndex === 0 ? "2 / span 5" : position.column;
    const row = group * 4 + position.row;

    return {
        "--board-column": column,
        "--board-row": String(row)
    } as CSSProperties;
}

const numberLabel = (number: number) => String(number).padStart(2, "0");

// A card shows a short preview. The popup has the full activity details.
function ActivityCard({
    activity,
    index,
    onSelectActivity
}: {
    activity: BoardActivity;
    index: number;
    onSelectActivity: (activity: BoardActivity) => void;
}) {
    return (
        <article className="group border-line relative grid min-w-0 border-t transition-colors focus-within:outline-2 focus-within:outline-offset-4 motion-reduce:transition-none sm:grid-cols-[1.2fr_1fr]">
            <div
                aria-hidden="true"
                className="from-board-highlight pointer-events-none absolute inset-0 bg-linear-to-br via-transparent to-transparent opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 motion-reduce:transition-none"
            />
            <div className="relative flex min-w-0 flex-col px-4 py-5 sm:min-h-60 sm:px-5">
                <div className="text-muted-foreground text-12 mb-1 flex justify-between gap-2">
                    <span>{numberLabel(index + 1)}</span>
                    {activity.time ? <time>{activity.time}</time> : null}
                </div>
                <h3 className="font-body text-16 leading-snug font-semibold">{activity.title}</h3>
                {activity.description ? (
                    <div className="mt-8 sm:mt-auto sm:pt-8">
                        <p className="text-muted-foreground text-10 mb-2">Notes</p>
                        <p className="text-muted-foreground text-12 line-clamp-6 leading-relaxed">
                            {activity.description}
                        </p>
                    </div>
                ) : null}
            </div>
            <BoardPhoto image={activity.images[0]} className="aspect-[4/3] sm:aspect-auto sm:min-h-60" />
            {/* This button covers the card so the whole card can be clicked. */}
            <button
                type="button"
                onClick={() => onSelectActivity(activity)}
                aria-label={`View ${activity.title}`}
                className="absolute inset-0 z-10 cursor-pointer outline-none"
            />
        </article>
    );
}

// Boards can also have photos, text, or locations without an activity.
function OtherBoardItem({ item }: { item: Exclude<BoardItem, BoardActivity> }) {
    if (item.type === "image") return <BoardPhoto image={item.image} className="aspect-[16/10]" />;
    if (item.type === "text")
        return (
            <p className="border-line text-14 border-t px-5 py-8 leading-relaxed whitespace-pre-line">{item.text}</p>
        );
    return (
        <article className="border-line border-t px-5 py-8">
            <h3 className="text-16 font-semibold">{item.location.name}</h3>
            {item.notes ? <p className="text-muted-foreground text-14 mt-4 leading-relaxed">{item.notes}</p> : null}
            <BoardPhoto image={item.images?.[0]} className="mt-5 aspect-[4/3]" />
        </article>
    );
}

// Render one day, including links that jump to its activity cards.
export default function PublishedBoardDay({
    day,
    onSelectActivity,
    photos = {},
    photoLabels = {}
}: {
    day: BoardDay;
    onSelectActivity: (activity: BoardActivity) => void;
    photos?: { first?: BoardImage; second?: BoardImage };
    photoLabels?: { first?: string; second?: string };
}) {
    // Keep a separate activity list for the timeline and card numbering.
    const activities = day.items.filter((item) => item.type === "activity");
    const first = activities[0];
    const fourth = activities[3];
    const evenDay = day.number % 2 === 0;

    return (
        <section aria-labelledby={`day-${day.number}`} className="mb-24 lg:mb-36">
            <header className="border-line mb-0 flex flex-wrap items-baseline gap-x-5 gap-y-2 border-b px-5 pb-3 sm:px-9">
                <h2 id={`day-${day.number}`} className="font-display text-36 font-bold uppercase">
                    Day {day.number}
                </h2>
                {day.date ? (
                    <time dateTime={day.date} className="text-muted-foreground text-14">
                        {day.date}
                    </time>
                ) : null}
                {day.title ? <p className="text-muted-foreground text-14 uppercase">{day.title}</p> : null}
            </header>
            {day.items.length === 0 ? (
                <p className="text-muted-foreground text-14 px-5 py-12 sm:px-9">
                    No activities have been added to this day yet.
                </p>
            ) : (
                <div className="grid gap-7 px-5 sm:px-9 lg:grid-cols-12 lg:gap-6">
                    {/* These links jump down the page without opening a popup. */}
                    {activities.length > 0 ? (
                        <nav
                            aria-label={`Day ${day.number} activities`}
                            className="border-line border-b py-6 lg:col-span-2 lg:self-start lg:border-b-0"
                        >
                            <ol className="border-line ml-12 border-l lg:sticky lg:top-8">
                                {activities.map((activity, index) => (
                                    <li key={activity.id} className="relative pb-5 last:pb-0">
                                        <span
                                            aria-hidden="true"
                                            className="border-line bg-background absolute top-2 -left-[3px] size-[5px] rounded-full border"
                                        />
                                        <span className="text-muted-foreground text-10 absolute top-0 -left-12 w-9 text-right">
                                            {activity.time ?? numberLabel(index + 1)}
                                        </span>
                                        <a
                                            href={`#activity-${activity.id}`}
                                            className="text-muted-foreground hover:text-foreground text-12 inline-flex min-h-6 pl-4 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
                                        >
                                            {activity.title}
                                        </a>
                                    </li>
                                ))}
                            </ol>
                        </nav>
                    ) : null}
                    <div
                        className={`grid min-w-0 gap-x-6 gap-y-7 lg:grid-cols-10 ${activities.length > 0 ? "lg:col-span-10" : "lg:col-span-12"}`}
                    >
                        {/* Location photos fill the desktop spaces independently of activity uploads. */}
                        {first ? (
                            <BoardPhoto
                                image={photos.first}
                                placeholderLabel={photoLabels.first || first.location?.name || `Day ${day.number}`}
                                showCredit
                                className={`hidden aspect-[1.8] grayscale lg:row-start-1 lg:block ${evenDay ? "lg:col-span-4 lg:col-start-7" : "lg:col-span-5 lg:col-start-1"}`}
                            />
                        ) : null}
                        {day.items.map((item, index) => {
                            return (
                                <div
                                    key={item.id}
                                    id={`activity-${item.id}`}
                                    style={getItemStyle(index, evenDay)}
                                    className="min-w-0 scroll-mt-8 lg:col-[var(--board-column)] lg:row-[var(--board-row)]"
                                >
                                    {item.type === "activity" ? (
                                        <ActivityCard
                                            activity={item}
                                            index={activities.findIndex((activity) => activity.id === item.id)}
                                            onSelectActivity={onSelectActivity}
                                        />
                                    ) : (
                                        <OtherBoardItem item={item} />
                                    )}
                                </div>
                            );
                        })}
                        {fourth ? (
                            <BoardPhoto
                                image={photos.second}
                                placeholderLabel={photoLabels.second || fourth.location?.name || `Day ${day.number}`}
                                showCredit
                                className="hidden aspect-[1.7] grayscale lg:col-span-4 lg:col-start-7 lg:row-start-3 lg:block"
                            />
                        ) : null}
                    </div>
                </div>
            )}
        </section>
    );
}
