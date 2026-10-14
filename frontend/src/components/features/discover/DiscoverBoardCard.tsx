import Image from "next/image";
import Link from "next/link";
import TagIcon from "@/components/ui/TagIcon";
import { getBoardTag, boardTagHref, type BoardTagId } from "@/data/board-tags";
import type { DiscoverBoard } from "@/data/discover-boards";

// Board-detail navigation is not implemented yet. Preserve the existing tag links.
export default function DiscoverBoardCard({
    board,
    activeTagId
}: {
    board: DiscoverBoard;
    activeTagId?: BoardTagId;
}) {
    return (
        <article className="border-line overflow-hidden border">
            {board.image && (
                <div className="bg-faint relative aspect-[4/3]">
                    <Image
                        src={board.image.url}
                        alt={board.image.alt ?? ""}
                        fill
                        unoptimized
                        sizes="(max-width: 767px) 80vw, 35vw"
                        className="object-cover"
                    />
                </div>
            )}
            <div className="p-5">
                <h2 className="font-display text-30 leading-tight font-bold">
                    {board.title}
                </h2>
                <p className="text-muted-foreground text-12 mt-2">
                    by {board.author}
                </p>
                <p className="text-14 mt-4 leading-relaxed">
                    {board.description}
                </p>
                <ul
                    aria-label="Board tags"
                    className="mt-5 flex flex-wrap gap-2"
                >
                    {board.tags.map((id) => {
                        const tag = getBoardTag(id);
                        return tag ? (
                            <li key={id}>
                                <Link
                                    href={boardTagHref(id)}
                                    aria-current={
                                        id === activeTagId ? "page" : undefined
                                    }
                                    className="border-line aria-[current=page]:bg-faint text-12 inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1 hover:underline focus-visible:outline-2"
                                >
                                    <TagIcon tag={tag} size={14} />
                                    {tag.name}
                                </Link>
                            </li>
                        ) : null;
                    })}
                </ul>
            </div>
        </article>
    );
}
