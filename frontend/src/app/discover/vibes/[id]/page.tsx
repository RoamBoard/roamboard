import type { Metadata } from "next";
import Link from "next/link";
import BackLink from "@/components/ui/BackLink";
import { notFound } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import TagIcon from "@/components/ui/TagIcon";
import { getBoardTag } from "@/data/board-tags";
import DiscoverBoardLibrary from "@/components/features/discover/DiscoverBoardLibrary";
import { getDiscoverBoardsByTags } from "@/data/discover-boards";

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
    const { boards, available } = await getDiscoverBoardsByTags([tag.id]);

    return (
        <AppShell activeHref="/discover" discover={{ collapsed: true }}>
            <div className="min-h-dvh py-12 pr-5 pl-8 md:py-16 md:pr-12 md:pl-16">
                <BackLink fallbackHref="/discover#roam-by-vibe" />
                <header className="border-line mt-6 border-b pb-8">
                    <div className="flex items-center gap-4">
                        <TagIcon tag={tag} size={40} className="shrink-0" />
                        <h1 className="font-display text-[clamp(2rem,6vw,5rem)] leading-none font-bold tracking-tight">
                            {tag.name}
                        </h1>
                    </div>
                    <p className="text-20 mt-4 max-w-2xl">{tag.description}</p>
                    <p className="text-muted-foreground text-12 mt-5">
                        {available
                            ? `${boards.length} public ${boards.length === 1 ? "Board" : "Boards"}`
                            : "Public Boards could not be loaded. Refresh to try again."}
                    </p>
                </header>
                {boards.length ? (
                    <DiscoverBoardLibrary boards={boards} title={`${tag.name} Boards`} activeTagId={tag.id} />
                ) : (
                    <section className="border-line mt-8 border p-8">
                        <h2 className="font-display text-24">
                            {available ? `No public Boards for ${tag.name} yet.` : "Boards could not be loaded."}
                        </h2>
                        <p className="text-14 mt-3 max-w-xl">
                            {available
                                ? "Explore another vibe to find travel ideas."
                                : "Refresh to try again, or explore another vibe."}
                        </p>
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
