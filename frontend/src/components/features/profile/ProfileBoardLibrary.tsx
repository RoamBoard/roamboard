"use client";

import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import BoardLibrary from "@/components/features/boards/BoardLibrary";
import { loadProfileLibraryBoards, type ProfileLibraryBoard } from "@/lib/profile-board-library";

const PAGE_SIZE = 10;

export default function ProfileBoardLibrary(props: ComponentProps<typeof BoardLibrary>) {
    const { boards } = props;
    const visible = useMemo(() => boards.slice(0, PAGE_SIZE), [boards]);
    const cache = useRef(new Map<ProfileLibraryBoard, ProfileLibraryBoard | null>());
    const [result, setResult] = useState<{
        source: typeof visible;
        loaded: Awaited<ReturnType<typeof loadProfileLibraryBoards>>;
    } | null>(null);
    const [retry, setRetry] = useState(0);
    useEffect(() => {
        const request = { active: true };
        const controller = new AbortController();
        const deadline = setTimeout(() => controller.abort(), 10_000);
        const pending = visible.filter((board) => !cache.current.has(board));
        void loadProfileLibraryBoards(pending, controller.signal)
            .then((loaded) => {
                if (!request.active) return;
                for (const board of pending) {
                    const resolved = loaded.boards.find((item) => item.compact.id === board.compact.id);
                    // Failed summaries remain retryable; denied Boards are cached as absent.
                    if (resolved !== board) cache.current.set(board, resolved ?? null);
                }
                for (const board of cache.current.keys()) {
                    if (!boards.includes(board)) cache.current.delete(board);
                }
                setResult({
                    source: visible,
                    loaded: {
                        boards: visible.flatMap((board) =>
                            cache.current.has(board) ? (cache.current.get(board) ?? []) : [board]
                        ),
                        failed: loaded.failed
                    }
                });
            })
            .finally(() => clearTimeout(deadline));
        return () => {
            request.active = false;
            controller.abort();
            clearTimeout(deadline);
        };
    }, [boards, visible, retry]);
    const current = result?.source === visible ? result.loaded : null;
    const displayed =
        current?.boards ??
        visible.flatMap((board) => {
            if (!result?.source.includes(board)) return [board];
            return result.loaded.boards.find((item) => item.compact.id === board.compact.id) ?? [];
        });
    return (
        <>
            {current?.failed && (
                <p role="alert" className="text-muted-foreground mt-2 text-xs">
                    Some Board details could not be loaded.{" "}
                    <button type="button" className="underline" onClick={() => setRetry((value) => value + 1)}>
                        Retry
                    </button>
                </p>
            )}
            <BoardLibrary {...props} boards={displayed} totalCount={props.totalCount ?? boards.length} />
        </>
    );
}
