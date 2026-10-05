"use client";

import { useEffect, useState } from "react";

import BoardCreationPreview from "@/components/features/boards/BoardCreationPreview";
import { loadBoard } from "@/lib/boards";
import type { CreatedBoard } from "@/types/board-creator";

export default function PublishedBoardView({ boardId }: { boardId: string }) {
  const [board, setBoard] = useState<CreatedBoard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadBoard(boardId).then(setBoard).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "The Board could not be loaded."));
  }, [boardId]);

  if (error) return <div className="px-6 py-20 sm:px-12"><p className="text-10 uppercase tracking-label text-stone">Board inspector</p><h1 className="mt-4 font-display text-48 font-bold">Could not load Board</h1><p className="mt-4 text-14 text-graphite" role="alert">{error}</p></div>;
  if (!board) return <div className="grid min-h-[70dvh] place-items-center text-13 text-graphite" role="status">Loading Board…</div>;

  return (
    <article className="px-5 py-16 sm:px-10 lg:px-16">
      <header className="mx-auto max-w-7xl border-b border-line pb-10"><p className="text-10 font-bold uppercase tracking-label text-stone">Saved Board inspector · {board.status}</p><h1 className="mt-4 font-display text-48 font-bold leading-none sm:text-72">{board.title}</h1><p className="mt-4 break-all text-11 text-graphite">Board ID: {board.id}</p></header>
      <div className="mx-auto mt-12 max-w-7xl"><BoardCreationPreview board={board} /></div>
    </article>
  );
}
