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
  return <div><h3 className="text-12 font-bold">{label}</h3><div className="mt-2 flex flex-wrap gap-2">{values?.length ? values.map((value) => <span key={value} className="border border-line px-2 py-1 text-12">{value}</span>) : <span className="text-12 text-graphite">None saved</span>}</div></div>;
}

function BoardRecord({ summary, ownerId, busy, onDelete }: { summary: SavedBoardSummary; ownerId: string | null; busy: boolean; onDelete: (board: SavedBoardSummary) => Promise<void> }) {
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
    try { setRecord(await loadSavedBoard(summary.id)); }
    catch (caught) { setError(messageFrom(caught)); }
    finally { loadingRef.current = false; setLoading(false); }
  }

  return (
    <details className="border border-line bg-background" onToggle={(event) => { if (event.currentTarget.open) void expand(); }}>
      <summary className="cursor-pointer p-5 focus-visible:outline-2 focus-visible:outline-offset-2">
        <span className="ml-2 font-display text-22 font-bold">{summary.title}</span>
        <span className="ml-3 inline-flex flex-wrap gap-2 text-10 uppercase tracking-label text-graphite"><span>{summary.status ?? "published"}</span><span>{summary.visibility}</span><span>{summary.ownerId === ownerId ? "Your board" : "Shared board"}</span></span>
        <span className="mt-2 block break-all text-10 text-stone">{summary.id} · Updated {summary.updatedAt}</span>
      </summary>
      <div className="border-t border-line p-5">
        {loading ? <p role="status" className="text-13 text-graphite">Loading saved records…</p> : null}
        {error ? <div role="alert" className="mb-4 text-13"><p>{error}</p><button type="button" onClick={() => void expand()} className="mt-2 underline">Retry loading details</button></div> : null}
        {record ? <div className="grid gap-6">
          <dl className="grid gap-3 text-12 sm:grid-cols-2"><div><dt className="font-bold">Owner ID</dt><dd className="break-all text-graphite">{record.ownerId}</dd></div><div><dt className="font-bold">Created</dt><dd className="text-graphite">{record.createdAt}</dd></div></dl>
          <p className="whitespace-pre-wrap text-14">{record.description || "No description saved."}</p>
          <div className="grid gap-5 sm:grid-cols-3"><Labels label="Tags" values={record.tags} /><Labels label="Vibes" values={record.vibes} /><Labels label="Highlights" values={record.highlights} /></div>
          <div><h3 className="font-display text-20 font-bold">Destinations ({record.destinations?.length ?? 0})</h3><ul className="mt-2 grid gap-2 text-13">{record.destinations?.map((place) => <li key={place.id}>{[place.city, place.country].filter(Boolean).join(", ")} <span className="text-graphite">({place.countryCode}) · {place.latitude ?? "—"}, {place.longitude ?? "—"}</span></li>)}</ul></div>
          <div><h3 className="font-display text-20 font-bold">Days ({record.days?.length ?? 0}) · Pins ({record.days?.reduce((count, day) => count + day.pins.length, 0) ?? 0})</h3>
            {record.days?.length ? record.days.map((day) => <section key={day.id} className="mt-4 border border-line p-4"><h4 className="text-14 font-bold">Day {day.dayNumber} · {day.date ?? "Date open"}</h4><p className="mt-1 break-all text-10 text-stone">{day.id}</p><ul className="mt-3 grid gap-3">{day.pins.map((pin) => <li key={pin.id} className="border-t border-line pt-3 text-13"><strong>{pin.time} · {pin.title}</strong><span className="ml-2 text-10 uppercase text-graphite">{pin.category} · {pin.source}</span><p className="mt-1 break-all text-10 text-stone">{pin.id}</p><p className="mt-1 text-graphite">{pin.location ? `${pin.location.address} · ${pin.location.latitude}, ${pin.location.longitude}` : "No saved location; this pin has no map marker."}</p>{pin.description ? <p className="mt-2 whitespace-pre-wrap">{pin.description}</p> : null}</li>)}</ul>{day.pins.length === 0 ? <p className="mt-3 text-12 text-graphite">No pins saved.</p> : null}</section>) : <p className="mt-2 text-13 text-graphite">No day records saved.</p>}
          </div>
          <div><h3 className="font-display text-20 font-bold">Images ({record.images?.length ?? 0})</h3><div className="mt-3 grid gap-4 sm:grid-cols-2">{record.images?.map((image) => <figure key={image.id} className="min-w-0 border border-line p-3"><img src={image.thumbnailUrl} alt={`Saved image for ${record.title}`} loading="lazy" className="aspect-video w-full object-cover" /><figcaption className="mt-3 grid gap-1 break-all text-12"><span>{image.source} · {image.width} × {image.height}</span><span>Image ID: {image.id}</span><span>Provider ID: {image.publicId}</span><span>Pin ID: {image.pinId ?? "Unassigned"}</span><a href={image.url} target="_blank" rel="noreferrer" className="underline">Open image</a>{image.credit && image.creditUrl ? <a href={image.creditUrl} target="_blank" rel="noreferrer" className="underline">Photo by {image.credit}</a> : null}{image.sourceUrl ? <a href={image.sourceUrl} target="_blank" rel="noreferrer" className="underline">Photo source</a> : null}</figcaption></figure>)}</div></div>
          <details><summary className="cursor-pointer text-13 underline">View complete API record</summary><pre className="mt-3 max-h-96 overflow-auto border border-line bg-faint p-4 text-12">{JSON.stringify(record, null, 2)}</pre></details>
        </div> : null}
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link href={`/boards/${summary.id}`} className="text-13 underline">Open board</Link>
          {summary.ownerId === ownerId ? <button type="button" disabled={busy} onClick={() => setConfirming(true)} className="border border-line px-4 py-2 text-13 disabled:opacity-40">Delete board</button> : null}
        </div>
        {confirming ? <div className="mt-4 border border-line p-4"><p className="text-13">Permanently delete “{summary.title}” and its saved days, pins, highlights and image references? Cloudinary assets are retained.</p><div className="mt-3 flex gap-3"><button type="button" disabled={busy} onClick={() => setConfirming(false)} className="border border-line px-4 py-2 text-13 disabled:opacity-40">Cancel</button><button type="button" disabled={busy} onClick={() => void onDelete(summary)} className="border border-foreground bg-foreground px-4 py-2 text-13 text-background disabled:opacity-40">{busy ? "Deleting…" : "Confirm deletion"}</button></div></div> : null}
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
    void Promise.all([listBoards(), loadProfile()]).then(([result, profile]) => {
      if (!request.active) return;
      setBoards(result.data); setPage(1); setHasMore(result.meta.hasMore); setOwnerId(profile.id);
    }).catch((caught: unknown) => { if (request.active) setError(messageFrom(caught)); })
      .finally(() => { if (request.active) setLoading(false); });
    return () => { request.active = false; };
  }, []);

  async function refresh(nextPage = 1) {
    const requestId = ++requestRef.current;
    setLoading(true); setError("");
    try {
      const [result, profile] = await Promise.all([listBoards(nextPage), loadProfile()]);
      if (requestId !== requestRef.current) return;
      setBoards((current) => nextPage === 1 ? result.data : [...current, ...result.data.filter((board) => !current.some((item) => item.id === board.id))]);
      if (nextPage === 1) setGeneration((current) => current + 1);
      setOwnerId(profile.id); setPage(nextPage); setHasMore(result.meta.hasMore);
    } catch (caught) { if (requestId === requestRef.current) setError(messageFrom(caught)); }
    finally { if (requestId === requestRef.current) setLoading(false); }
  }

  async function remove(board: SavedBoardSummary) {
    setDeleting(true); setError(""); setNotice("");
    try {
      await deleteBoard(board.id);
      setBoards((current) => current.filter((item) => item.id !== board.id));
      setNotice(`“${board.title}” was deleted.`);
      await refresh();
    } catch (caught) { setError(messageFrom(caught)); }
    finally { setDeleting(false); }
  }

  return <section aria-labelledby="database-heading" className="mx-auto max-w-6xl px-5 py-12 text-foreground sm:px-10">
    <p className="text-10 font-bold uppercase tracking-label text-graphite">Developer lab</p>
    <h1 id="database-heading" className="mt-4 font-display text-36 font-bold sm:text-48">Saved boards</h1>
    <p className="mt-4 max-w-3xl text-14 leading-6 text-graphite">Browse database-backed boards, including your drafts and published boards shared with you. Expand a board to inspect its saved records. This page uses the current prototype identity; private boards belonging to other users are available through the local database viewer.</p>
    <div className="mt-5 flex flex-wrap gap-4 text-13"><Link href="/boards/new" className="underline">Create a board</Link><a href="http://localhost:8080" target="_blank" rel="noreferrer" className="underline">Inspect all PostgreSQL tables in Adminer</a></div>
    <p className="mt-4 text-12 text-graphite">PostgreSQL stores boards, tags, vibes and highlights; board_days, board_pins and board_images store their related records. Elasticsearch indexes public published boards. Docker data volumes preserve saved records across restarts.</p>
    <div className="mt-8 flex items-center justify-between gap-4"><p className="text-13">{boards.length} board{boards.length === 1 ? "" : "s"} loaded</p><button type="button" disabled={loading || deleting} onClick={() => { setNotice(""); void refresh(); }} className="border border-line px-4 py-2 text-13 disabled:opacity-40">Refresh records</button></div>
    {error ? <p role="alert" className="mt-4 border-l-2 border-foreground pl-3 text-13">{error}</p> : null}
    {notice ? <p role="status" className="mt-4 text-13">{notice}</p> : null}
    {loading ? <p role="status" className="mt-4 text-13 text-graphite">Loading boards…</p> : null}
    {!loading && !error && boards.length === 0 ? <p className="mt-6 border border-line p-6 text-14 text-graphite">No saved boards are available for this identity.</p> : null}
    <div className="mt-5 grid gap-3" aria-busy={loading || deleting}>{boards.map((board) => <BoardRecord key={`${board.id}-${generation}`} summary={board} ownerId={ownerId} busy={deleting || loading} onDelete={remove} />)}</div>
    {hasMore ? <button type="button" disabled={loading || deleting} onClick={() => void refresh(page + 1)} className="mt-6 border border-foreground px-5 py-3 text-13 disabled:opacity-40">Load more boards</button> : null}
  </section>;
}
