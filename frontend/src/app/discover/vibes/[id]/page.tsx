import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import TagIcon from "@/components/ui/TagIcon";
import { getBoardTag } from "@/data/board-tags";
import DiscoverBoardCard from "@/components/features/discover/DiscoverBoardCard";
import { getDiscoverPreviewBoardsByTag } from "@/data/discover-boards";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const tag = getBoardTag((await params).id);
    return {
        title: tag ? `${tag.name} Boards | Roamboard` : "Vibe not found | Roamboard",
        description: tag?.description
    };
}

export default async function VibePage({ params }: Props) {
    const tag = getBoardTag((await params).id);
    if (!tag) notFound();
    const boards = getDiscoverPreviewBoardsByTag(tag.id);

    return (
        <AppShell activeHref="/discover" discover={{ collapsed: true }}>
            <div className="min-h-dvh py-12 pr-5 pl-24 md:py-16 md:pr-12 md:pl-36">
                <Link
                    href="/discover#roam-by-vibe"
                    className="text-14 inline-flex min-h-11 items-center gap-2 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
                >
                    <span aria-hidden="true">←</span> All vibes
                </Link>
                <header className="border-line mt-6 border-b pb-8">
                    <div className="flex items-center gap-4">
                        <TagIcon tag={tag} size={40} className="shrink-0" />
                        <h1 className="font-display text-[clamp(2rem,6vw,5rem)] leading-none font-bold tracking-tight">
                            {tag.name}
                        </h1>
                    </div>
                    <p className="text-20 mt-4 max-w-2xl">{tag.description}</p>
                    <p className="text-muted-foreground text-12 mt-5">
                        Preview · {boards.length} sample {boards.length === 1 ? "Board" : "Boards"}. Live public Boards
                        will appear when discovery is connected.
                    </p>
                </header>
                {boards.length ? (
                    <section
                        aria-label={`${tag.name} Boards`}
                        className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3"
                    >
                        {boards.map((board) => (
                            <DiscoverBoardCard key={board.id} board={board} activeTagId={tag.id} />
                        ))}
                    </section>
                ) : (
                    <section className="border-line mt-8 border p-8">
                        <h2 className="font-display text-24">No sample Boards for {tag.name} yet.</h2>
                        <p className="text-14 mt-3 max-w-xl">Explore another vibe while we build this collection.</p>
                        <Link
                            href="/discover#roam-by-vibe"
                            className="mt-5 inline-flex min-h-11 items-center underline underline-offset-4 focus-visible:outline-2"
                        >
                            Browse all vibes
                        </Link>
                    </section>
                )}
            </div>
        </AppShell>
    );
}
