"use client";

import { useEffect, useState } from "react";
import BoardLibrary from "@/components/features/boards/BoardLibrary";
import { loadMapBoardGallery, mapBoardGallery } from "@/lib/profile-map";
import type { MapDestination } from "@/lib/profile";

export default function ProfileMapBoardLibrary({
    places,
    title,
    viewAllHref,
    onBoardHighlight
}: {
    places: MapDestination[];
    title: string;
    viewAllHref: string;
    onBoardHighlight: (boardId: string | null) => void;
}) {
    const [result, setResult] = useState<Awaited<ReturnType<typeof loadMapBoardGallery>> | null>(null);
    const [retry, setRetry] = useState(0);
    useEffect(() => {
        const request = { active: true };
        void loadMapBoardGallery(places).then((loaded) => {
            if (request.active) setResult(loaded);
        });
        return () => {
            request.active = false;
        };
    }, [places, retry]);

    return (
        <div className="min-w-0" aria-label="Boards in selected destination">
            {result?.failed && (
                <p role="alert" className="text-muted-foreground mt-2 text-xs">
                    Some board details could not be loaded.{" "}
                    <button type="button" className="underline" onClick={() => setRetry((value) => value + 1)}>
                        Retry
                    </button>
                </p>
            )}
            <BoardLibrary
                id="profile-country-boards"
                title={title}
                viewAllHref={viewAllHref}
                boards={result?.boards ?? mapBoardGallery(places)}
                onBoardHighlight={onBoardHighlight}
                embedded
            />
        </div>
    );
}
