"use client";

import StoryGallery from "./StoryGallery";
import { usePhotoUrls } from "@/lib/use-photo-urls";
import type { BoardImageDraft } from "@/types/board-creator";

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
                image: {
                    id: image.id,
                    url: photoUrl(image.url),
                    alt: "Board photo",
                    source: image.source === "upload" ? "upload" : "application",
                    width: image.width || undefined,
                    height: image.height || undefined,
                    photographer: image.credit ?? undefined,
                    photographerUrl: image.creditUrl ?? undefined,
                    sourceUrl: image.sourceUrl ?? undefined,
                    presentation: image.presentation,
                    context: image.context
                }
            }))}
        />
    );
}
