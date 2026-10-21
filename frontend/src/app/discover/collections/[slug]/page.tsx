import { Suspense } from "react";
import type { Metadata } from "next";
import BackLink from "@/components/ui/BackLink";
import { notFound } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import DiscoverPhoto from "@/components/features/discover/DiscoverPhoto";
import BoardCollectionGrid from "@/components/features/boards/BoardCollectionGrid";
import { getBoardTag } from "@/data/board-tags";
import { getDiscoverCollection } from "@/data/discover-collections";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const collection = getDiscoverCollection((await params).slug);
    if (!collection) notFound();
    return {
        title: `${collection.title} | Roamboard`,
        description: collection.description
    };
}

export default async function CollectionPage({ params }: Props) {
    const collection = getDiscoverCollection((await params).slug);
    if (!collection) notFound();
    const discoverHref = collection.moodRow === undefined ? "/discover#discover-feed" : "/discover#discover-tags";

    return (
        <AppShell activeHref="/discover" discover={{ collapsed: true }}>
            <div className="min-h-dvh py-12 pr-5 pl-8 md:py-16 md:pr-12 md:pl-16">
                <BackLink fallbackHref={discoverHref} />
                <header className="border-line mt-6 grid gap-6 border-b pb-8 md:grid-cols-2 md:items-center">
                    <div>
                        <h1 className="font-display text-[clamp(2rem,6vw,5rem)] leading-none font-bold tracking-tight">
                            {collection.title}
                        </h1>
                        <p className="text-20 mt-4 max-w-2xl">{collection.description}</p>
                    </div>
                    <div className="bg-faint relative aspect-[4/3] overflow-hidden">
                        <DiscoverPhoto
                            photo={collection.coverImage}
                            width={1200}
                            position={collection.coverPosition ?? "center"}
                            eager
                        />
                    </div>
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
                        showDivider={false}
                        category={{
                            title: `${collection.title} Boards`,
                            tags: collection.tagIds.flatMap((id) => {
                                const tag = getBoardTag(id);
                                return tag ? [tag.name] : [];
                            })
                        }}
                    />
                </Suspense>
            </div>
        </AppShell>
    );
}
