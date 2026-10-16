"use client";

import { useEffect, useMemo, useState } from "react";
import { getBoardPhotoSlots, resolveBoardPhotos } from "@/lib/board-photos";
import type { Board, BoardImage } from "@/types/board";

export default function useBoardPhotos(board: Board, tagLabels: string[]) {
    const slots = useMemo(() => getBoardPhotoSlots(board, tagLabels), [board, tagLabels]);
    const key = JSON.stringify([board.id, board.updatedAt, slots]);
    const [result, setResult] = useState<{ key: string; photos: Record<string, BoardImage> }>({ key: "", photos: {} });
    useEffect(() => {
        const request = { active: true };
        void resolveBoardPhotos(board, slots).then((photos) => {
            if (request.active) setResult({ key, photos });
        });
        return () => {
            request.active = false;
        };
    }, [board, key, slots]);
    return { slots, photos: result.key === key ? result.photos : {} };
}
