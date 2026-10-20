import Link from "next/link";
import PhotoBoardCard from "@/components/features/boards/cards/PhotoBoardCard";
import TagIcon from "@/components/ui/TagIcon";
import { getBoardTag, boardTagHref, type BoardTagId } from "@/data/board-tags";
import type { DiscoverBoard } from "@/data/discover-boards";
import { findCountry } from "@/lib/countries";
import type { PhotoBoardCardData } from "@/types/board-card";

export function toDiscoverPhotoBoardCard(board: DiscoverBoard): PhotoBoardCardData {
    if (board.card) return board.card;
    const countries = (board.destinations ?? []).map((place) => findCountry(place.countryCode || place.country));
    return {
        id: board.id,
        title: board.title,
        author: board.author,
        description: board.description,
        destination: [
            ...new Set(
                (board.destinations ?? []).flatMap((place) => [...(place.cities ?? []), place.country].filter(Boolean))
            )
        ].join(" · "),
        destinationLabel:
            countries.length && countries.every((country) => country && country.code === countries[0]?.code)
                ? countries[0]!.code
                : "",
        tags: board.tags.flatMap((id) => {
            const tag = getBoardTag(id);
            return tag ? [tag.name] : [];
        }),
        image: board.image ? { src: board.image.url, alt: board.image.alt || `Cover of ${board.title}` } : undefined
    };
}

// Public API Boards link to their saved document. Editorial examples remain non-navigable.
export default function DiscoverBoardCard({ board, activeTagId }: { board: DiscoverBoard; activeTagId?: BoardTagId }) {
    return (
        <div className="min-w-0">
            <PhotoBoardCard board={toDiscoverPhotoBoardCard(board)} href={board.href} details />
            <ul aria-label="Explore Board tags" className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {board.tags.map((id) => {
                    const tag = getBoardTag(id);
                    return tag ? (
                        <li key={id}>
                            <Link
                                href={boardTagHref(id)}
                                aria-current={id === activeTagId ? "page" : undefined}
                                className="text-muted-foreground hover:text-foreground aria-[current=page]:text-foreground inline-flex min-h-11 items-center gap-2 text-xs underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
                            >
                                <TagIcon tag={tag} size={14} />
                                {tag.name}
                            </Link>
                        </li>
                    ) : null;
                })}
            </ul>
        </div>
    );
}
