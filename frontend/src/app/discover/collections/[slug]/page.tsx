import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import DiscoverPhoto from "@/components/features/discover/DiscoverPhoto";
import DiscoverBoardCard from "@/components/features/discover/DiscoverBoardCard";
import { getDiscoverCollection } from "@/data/discover-collections";
import { getDiscoverBoardsByTags } from "@/data/discover-boards";

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
    const { boards, available } = await getDiscoverBoardsByTags(
        collection.tagIds
    );
    const discoverHref =
        collection.moodRow === undefined
            ? "/discover#discover-feed"
            : "/discover#discover-moods";

    return (
        <AppShell activeHref="/discover" discover={{ collapsed: true }}>
            <div className="min-h-dvh py-12 pr-5 pl-24 md:py-16 md:pr-12 md:pl-36">
                <Link
                    href={discoverHref}
                    scroll={false}
                    className="text-14 inline-flex min-h-11 items-center gap-2 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
                >
                    <span aria-hidden="true">←</span> Back to Discover
                </Link>
                <header className="border-line mt-6 grid gap-6 border-b pb-8 md:grid-cols-2 md:items-center">
                    <div>
                        <p className="text-muted-foreground text-12 mb-4">
                            CURATED COLLECTION
                        </p>
                        <h1 className="font-display text-[clamp(2rem,6vw,5rem)] leading-none font-bold tracking-tight">
                            {collection.title}
                        </h1>
                        <p className="text-20 mt-4 max-w-2xl">
                            {collection.description}
                        </p>
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
                {boards.length ? (
                    <section
                        aria-label={`${collection.title} Boards`}
                        className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3"
                    >
                        {boards.map((board) => (
                            <DiscoverBoardCard key={board.id} board={board} />
                        ))}
                    </section>
                ) : (
                    <section
                        aria-labelledby="collection-empty-title"
                        className="border-line mt-8 border p-6 md:p-8"
                    >
                        <h2
                            id="collection-empty-title"
                            className="font-display text-24"
                        >
                            {available
                                ? "No Boards in this collection yet."
                                : "Collection Boards are coming soon."}
                        </h2>
                        <p className="text-14 mt-3 max-w-xl">
                            {available
                                ? "Explore another collection to find your next adventure."
                                : "Public Board discovery is not connected yet. This collection will show matching Boards once it is available."}
                        </p>
                        <Link
                            href={discoverHref}
                            scroll={false}
                            className="mt-5 inline-flex min-h-11 items-center underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
                        >
                            Explore other collections
                        </Link>
                    </section>
                )}
            </div>
        </AppShell>
    );
}
