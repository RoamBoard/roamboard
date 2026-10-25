"use client";

import StoryGallery from "./StoryGallery";
import { usePhotoUrls } from "@/lib/use-photo-urls";
import type { BoardImageDraft } from "@/types/board-creator";
import type { BoardImage } from "@/types/board";

export function editorPhoto(image: BoardImageDraft): BoardImage {
    return {
        id: image.id,
        url: image.url,
        alt: image.alt ?? "Board photo",
        source: image.source === "upload" ? "upload" : "application",
        width: image.width || undefined,
        height: image.height || undefined,
        photographer: image.credit ?? undefined,
        photographerUrl: image.creditUrl ?? undefined,
        sourceUrl: image.sourceUrl ?? undefined,
        presentation: image.presentation,
        context: image.context
    };
}

export default function EditorPhotoGallery({
    images,
    index,
    onClose
}: {
    images: BoardImageDraft[];
    index: number;
    onClose: () => void;
}) {
    const photoUrl = usePhotoUrls();
    return (
        <StoryGallery
            initialIndex={index}
            onClose={onClose}
            placements={images.map((image) => ({
                id: image.id,
                image: { ...editorPhoto(image), url: photoUrl(image.url) }
            }))}
        />
    );
}
