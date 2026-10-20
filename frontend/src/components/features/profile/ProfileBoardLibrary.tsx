"use client";

import { useEffect, useState, type ComponentProps } from "react";
import BoardLibrary from "@/components/features/boards/BoardLibrary";
import { loadProfileLibraryBoards } from "@/lib/profile-board-library";

export default function ProfileBoardLibrary(props: ComponentProps<typeof BoardLibrary>) {
    const { boards } = props;
    const [result, setResult] = useState<{
        source: typeof boards;
        loaded: Awaited<ReturnType<typeof loadProfileLibraryBoards>>;
    } | null>(null);
    const [retry, setRetry] = useState(0);
    useEffect(() => {
        const request = { active: true };
        const controller = new AbortController();
        const deadline = setTimeout(() => controller.abort(), 10_000);
        void loadProfileLibraryBoards(boards, controller.signal)
            .then((loaded) => {
                if (request.active) setResult({ source: boards, loaded });
            })
            .finally(() => clearTimeout(deadline));
        return () => {
            request.active = false;
            controller.abort();
            clearTimeout(deadline);
        };
    }, [boards, retry]);
    const current = result?.source === boards ? result.loaded : null;
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
            <BoardLibrary {...props} boards={current?.boards ?? boards} />
        </>
    );
}
