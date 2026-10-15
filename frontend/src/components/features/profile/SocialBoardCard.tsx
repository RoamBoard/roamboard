import CollageBoardCard from "@/components/features/boards/cards/CollageBoardCard";
import { getBoardTag } from "@/data/board-tags";
import type { SocialBoardPreview } from "@/types/social";

type Props = { board: SocialBoardPreview };

// Keep the profile's existing mock model at this boundary; the card itself is reusable.
export default function SocialBoardCard({ board }: Props) {
    return (
        <CollageBoardCard
            board={{
                id: board.id,
                title: board.titleLines.join(" "),
                titleLines: board.titleLines,
                author: board.author.replace(/^by\s+/i, "").trim(),
                destination: board.countryCode,
                destinationLabel: board.countryCode,
                durationDays: Number.parseInt(board.duration, 10) || 0,
                description: board.quote,
                themes: board.tags.map((tag) => getBoardTag(tag)?.name ?? tag),
                highlights: board.highlights,
                savedCount: Number.parseInt(board.savedCount.replace(/\D/g, ""), 10) || 0,
                images: board.images.map((image) => ({ src: image.url, alt: image.alt }))
            }}
        />
    );
}
