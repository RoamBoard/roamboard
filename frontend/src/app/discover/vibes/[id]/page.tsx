import type { Metadata } from "next";
import { Suspense } from "react";
import BackLink from "@/components/ui/BackLink";
import { notFound } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import TagIcon from "@/components/ui/TagIcon";
import { getBoardTag } from "@/data/board-tags";
import BoardCollectionGrid from "@/components/features/boards/BoardCollectionGrid";

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
                </header>
                <Suspense
                    fallback={
                        <p role="status" className="py-10">
                            Loading Boards...
                        </p>
                    }
                >
                    <BoardCollectionGrid
                        context="category"
                        embedded
                        category={{ title: `${tag.name} Boards`, tags: [tag.name] }}
                    />
                </Suspense>
            </div>
        </AppShell>
    );
}
