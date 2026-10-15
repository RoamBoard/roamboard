/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { deleteBoard, listBoards, loadSavedBoard, type SavedBoardRecord, type SavedBoardSummary } from "@/lib/boards";
import { loadProfile } from "@/lib/profile";

function messageFrom(error: unknown): string {
    return error instanceof Error ? error.message : "The request could not be completed.";
}

function Labels({ label, values }: { label: string; values?: string[] }) {
    return (
        <div>
            <h3 className="text-12 font-bold">{label}</h3>
            <div className="mt-2 flex flex-wrap gap-2">
                {values?.length ? (
                    values.map((value) => (
                        <span key={value} className="border-line text-12 border px-2 py-1">
                            {value}
                        </span>
                    ))
                ) : (
                    <span className="text-12 text-graphite">None saved</span>
                )}
            </div>
        </div>
    );
}

function BoardRecord({
    summary,
    ownerId,
    busy,
    onDelete
}: {
    summary: SavedBoardSummary;
    ownerId: string | null;
    busy: boolean;
    onDelete: (board: SavedBoardSummary) => Promise<void>;
}) {
    const [record, setRecord] = useState<SavedBoardRecord | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [confirming, setConfirming] = useState(false);
    const loadingRef = useRef(false);

    async function expand() {
        if (record || loadingRef.current) return;
        loadingRef.current = true;
        setLoading(true);
        setError("");
        try {
            setRecord(await loadSavedBoard(summary.boardId));
        } catch (caught) {
            setError(messageFrom(caught));
        } finally {
            loadingRef.current = false;
            setLoading(false);
        }
    }

    return (
        <details
            className="border-line bg-background border"
            onToggle={(event) => {
                if (event.currentTarget.open) void expand();
            }}
        >
            <summary className="cursor-pointer p-5 focus-visible:outline-2 focus-visible:outline-offset-2">
                <span className="font-display text-22 ml-2 font-bold">{summary.title}</span>
                <span className="text-10 tracking-label text-graphite ml-3 inline-flex flex-wrap gap-2 uppercase">
                    <span>{summary.status ?? "published"}</span>
                    <span>{summary.visibility}</span>
                    <span>{summary.ownerId === ownerId ? "Your board" : "Shared board"}</span>
                </span>
                <span className="text-10 text-stone mt-2 block break-all">
                    {summary.boardId} · Updated {summary.updatedAt}
                </span>
            </summary>
            <div className="border-line border-t p-5">
                {loading ? (
                    <p role="status" className="text-13 text-graphite">
                        Loading saved records…
                    </p>
                ) : null}
                {error ? (
                    <div role="alert" className="text-13 mb-4">
                        <p>{error}</p>
                        <button type="button" onClick={() => void expand()} className="mt-2 underline">
                            Retry loading details
                        </button>
                    </div>
                ) : null}
                {record ? (
                    <div className="grid gap-6">
                        <dl className="text-12 grid gap-3 sm:grid-cols-2">
                            <div>
                                <dt className="font-bold">Owner ID</dt>
                                <dd className="text-graphite break-all">{summary.ownerId}</dd>
                            </div>
                            <div>
                                <dt className="font-bold">Created</dt>
                                <dd className="text-graphite">{record.createdAt}</dd>
                            </div>
                        </dl>
                        <p className="text-14 whitespace-pre-wrap">{record.description || "No description saved."}</p>
                        <div className="grid gap-5 sm:grid-cols-3">
                            <Labels label="Tags" values={record.tags.map((tag) => tag.name)} />
                        </div>
                        <div>
                            <h3 className="font-display text-20 font-bold">
                                Days ({record.days?.length ?? 0}) · Pins (
                                {record.days?.reduce((count, day) => count + day.activities.length, 0) ?? 0})
                            </h3>
                            {record.days?.length ? (
                                record.days.map((day) => (
                                    <section key={day.dayId} className="border-line mt-4 border p-4">
                                        <h4 className="text-14 font-bold">
                                            Day {day.dayNumber} · {day.date ?? "Date open"}
                                        </h4>
                                        <p className="text-10 text-stone mt-1 break-all">{day.dayId}</p>
                                        <ul className="mt-3 grid gap-3">
                                            {day.activities.map((pin) => (
                                                <li key={pin.activityId} className="border-line text-13 border-t pt-3">
                                                    <strong>
                                                        {pin.activityTime} · {pin.title}
                                                    </strong>
                                                    <span className="text-10 text-graphite ml-2 uppercase">
                                                        {pin.category} · {pin.source}
                                                    </span>
                                                    <p className="text-10 text-stone mt-1 break-all">
                                                        {pin.activityId}
                                                    </p>
                                                    <p className="text-graphite mt-1">
                                                        {pin.location
                                                            ? `${pin.location.address} · ${pin.location.latitude}, ${pin.location.longitude}`
                                                            : "No saved location; this pin has no map marker."}
                                                    </p>
                                                    {pin.note ? (
                                                        <p className="mt-2 whitespace-pre-wrap">{pin.note}</p>
                                                    ) : null}
                                                </li>
                                            ))}
                                        </ul>
                                        {day.activities.length === 0 ? (
                                            <p className="text-12 text-graphite mt-3">No pins saved.</p>
                                        ) : null}
                                    </section>
                                ))
                            ) : (
                                <p className="text-13 text-graphite mt-2">No day records saved.</p>
                            )}
                        </div>
                        <div>
                            <h3 className="font-display text-20 font-bold">Images ({record.images?.length ?? 0})</h3>
                            <div className="mt-3 grid gap-4 sm:grid-cols-2">
                                {record.images?.map((image) => (
                                    <figure key={image.imageId} className="border-line min-w-0 border p-3">
                                        <img
                                            src={new URL(
                                                image.thumbnailUrl,
                                                process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"
                                            ).toString()}
                                            alt={`Saved image for ${record.title}`}
                                            loading="lazy"
                                            className="aspect-video w-full object-cover"
                                        />
                                        <figcaption className="text-12 mt-3 grid gap-1 break-all">
                                            <span>Image ID: {image.imageId}</span>
                                            <span>Captured: {image.capturedAt ?? "Unknown"}</span>
                                            <a
                                                href={new URL(
                                                    image.url,
                                                    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"
                                                ).toString()}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="underline"
                                            >
                                                Open image
                                            </a>
                                        </figcaption>
                                    </figure>
                                ))}
                            </div>
                        </div>
                        <details>
                            <summary className="text-13 cursor-pointer underline">View complete API record</summary>
                            <pre className="border-line bg-faint text-12 mt-3 max-h-96 overflow-auto border p-4">
                                {JSON.stringify(record, null, 2)}
                            </pre>
                        </details>
                    </div>
                ) : null}
                <div className="mt-6 flex flex-wrap items-center gap-4">
                    <Link
                        href={
                            summary.status === "draft"
                                ? `/boards/drafts/${summary.boardId}`
                                : `/boards/${summary.boardId}`
                        }
                        className="text-13 underline"
                    >
                        Open board
                    </Link>
                    {summary.ownerId === ownerId ? (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => setConfirming(true)}
                            className="border-line text-13 border px-4 py-2 disabled:opacity-40"
                        >
                            Delete board
                        </button>
                    ) : null}
                </div>
                {confirming ? (
                    <div className="border-line mt-4 border p-4">
                        <p className="text-13">
                            Permanently delete “{summary.title}” and its saved days, activities and image references?
                            Unreferenced uploads enter the 24-hour cleanup window.
                        </p>
                        <div className="mt-3 flex gap-3">
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => setConfirming(false)}
                                className="border-line text-13 border px-4 py-2 disabled:opacity-40"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => void onDelete(summary)}
                                className="border-foreground bg-foreground text-13 text-background border px-4 py-2 disabled:opacity-40"
                            >
                                {busy ? "Deleting…" : "Confirm deletion"}
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>
        </details>
    );
}

export default function BoardDatabaseBrowser() {
    const [boards, setBoards] = useState<SavedBoardSummary[]>([]);
    const [ownerId, setOwnerId] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [generation, setGeneration] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const requestRef = useRef(0);

    useEffect(() => {
        const request = { active: true };
        void Promise.all([listBoards(), loadProfile()])
            .then(([result, profile]) => {
                if (!request.active) return;
                setBoards(result.data);
                setPage(1);
                setHasMore(result.meta.hasMore);
                setOwnerId(profile.id);
            })
            .catch((caught: unknown) => {
                if (request.active) setError(messageFrom(caught));
            })
            .finally(() => {
                if (request.active) setLoading(false);
            });
        return () => {
            request.active = false;
        };
    }, []);

    async function refresh(nextPage = 1) {
        const requestId = ++requestRef.current;
        setLoading(true);
        setError("");
        try {
            const [result, profile] = await Promise.all([listBoards(nextPage), loadProfile()]);
            if (requestId !== requestRef.current) return;
            setBoards((current) =>
                nextPage === 1
                    ? result.data
                    : [
                          ...current,
                          ...result.data.filter((board) => !current.some((item) => item.boardId === board.boardId))
                      ]
            );
            if (nextPage === 1) setGeneration((current) => current + 1);
            setOwnerId(profile.id);
            setPage(nextPage);
            setHasMore(result.meta.hasMore);
        } catch (caught) {
            if (requestId === requestRef.current) setError(messageFrom(caught));
        } finally {
            if (requestId === requestRef.current) setLoading(false);
        }
    }

    async function remove(board: SavedBoardSummary) {
        setDeleting(true);
        setError("");
        setNotice("");
        try {
            await deleteBoard(board.boardId);
            setBoards((current) => current.filter((item) => item.boardId !== board.boardId));
            setNotice(`“${board.title}” was deleted.`);
            await refresh();
        } catch (caught) {
            setError(messageFrom(caught));
        } finally {
            setDeleting(false);
        }
    }

    return (
        <section aria-labelledby="database-heading" className="text-foreground mx-auto max-w-6xl px-5 py-12 sm:px-10">
            <p className="text-10 tracking-label text-graphite font-bold uppercase">Developer lab</p>
            <h1 id="database-heading" className="font-display text-36 sm:text-48 mt-4 font-bold">
                Saved boards
            </h1>
            <p className="text-14 text-graphite mt-4 max-w-3xl leading-6">
                Browse your drafts and published Boards you can access through your signed-in account. Expand a Board to
                inspect its saved records.
            </p>
            <div className="text-13 mt-5 flex flex-wrap gap-4">
                <Link href="/boards/new" className="underline">
                    Create a board
                </Link>
                <a href="http://localhost:8080" target="_blank" rel="noreferrer" className="underline">
                    Inspect all PostgreSQL tables in Adminer
                </a>
            </div>
            <p className="text-12 text-graphite mt-4">
                PostgreSQL stores Boards, days, activities, tags and image references. The backend enforces access on
                every request.
            </p>
            <div className="mt-8 flex items-center justify-between gap-4">
                <p className="text-13">
                    {boards.length} board{boards.length === 1 ? "" : "s"} loaded
                </p>
                <button
                    type="button"
                    disabled={loading || deleting}
                    onClick={() => {
                        setNotice("");
                        void refresh();
                    }}
                    className="border-line text-13 border px-4 py-2 disabled:opacity-40"
                >
                    Refresh records
                </button>
            </div>
            {error ? (
                <p role="alert" className="border-foreground text-13 mt-4 border-l-2 pl-3">
                    {error}
                </p>
            ) : null}
            {notice ? (
                <p role="status" className="text-13 mt-4">
                    {notice}
                </p>
            ) : null}
            {loading ? (
                <p role="status" className="text-13 text-graphite mt-4">
                    Loading boards…
                </p>
            ) : null}
            {!loading && !error && boards.length === 0 ? (
                <p className="border-line text-14 text-graphite mt-6 border p-6">
                    No saved Boards are available for your account.
                </p>
            ) : null}
            <div className="mt-5 grid gap-3" aria-busy={loading || deleting}>
                {boards.map((board) => (
                    <BoardRecord
                        key={`${board.boardId}-${generation}`}
                        summary={board}
                        ownerId={ownerId}
                        busy={deleting || loading}
                        onDelete={remove}
                    />
                ))}
            </div>
            {hasMore ? (
                <button
                    type="button"
                    disabled={loading || deleting}
                    onClick={() => void refresh(page + 1)}
                    className="border-foreground text-13 mt-6 border px-5 py-3 disabled:opacity-40"
                >
                    Load more boards
                </button>
            ) : null}
        </section>
    );
}
