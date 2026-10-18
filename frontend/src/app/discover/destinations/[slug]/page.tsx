import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import DiscoverPhoto from "@/components/features/discover/DiscoverPhoto";
import DiscoverBoardCard from "@/components/features/discover/DiscoverBoardCard";
import { getDiscoverDestination } from "@/data/discover-destinations";
import { getDiscoverBoardsByDestination } from "@/data/discover-boards";
import { getDestinationGuideInput } from "@/lib/destination-guides";
import DestinationGuide from "@/components/features/destinations/DestinationGuide";

type Props = {
    params: Promise<{ slug: string }>;
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
    const slug = (await params).slug;
    const input = getDestinationGuideInput(slug, await searchParams);
    const destination = input ?? getDiscoverDestination(slug);
    if (!destination) notFound();
    return {
        title: `${destination.name} | Roamboard`,
        description: input
            ? `Explore ${input.name}: a city introduction, photos and public travel boards.`
            : getDiscoverDestination(slug)?.description
    };
}

export default async function DestinationPage({ params, searchParams }: Props) {
    const slug = (await params).slug;
    const guide = getDestinationGuideInput(slug, await searchParams);
    if (guide)
        return (
            // Attribution is inside the closing panel so the guide stays exactly one viewport tall.
            <div className="[&+footer]:hidden [&>div]:min-h-0">
                <AppShell activeHref="/discover" discover={{ collapsed: true }}>
                    {/* A full city identity keeps same-name cities and their in-flight reads separate. */}
                    <DestinationGuide key={JSON.stringify(guide)} input={guide} />
                </AppShell>
            </div>
        );
    const destination = getDiscoverDestination(slug);
    if (!destination) notFound();
    const { boards, available } = await getDiscoverBoardsByDestination(destination.countryCode);

    return (
        <AppShell activeHref="/discover" discover={{ collapsed: true }}>
            <div className="min-h-dvh py-12 pr-5 pl-24 md:py-16 md:pr-12 md:pl-36">
                <Link
                    href="/discover#trending-title"
                    scroll={false}
                    className="text-14 inline-flex min-h-11 items-center gap-2 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
                >
                    <span aria-hidden="true">←</span> Back to Discover
                </Link>
                <header className="border-line mt-6 grid gap-6 border-b pb-8 md:grid-cols-2 md:items-center">
                    <div>
                        <p className="text-muted-foreground text-12 mb-4">TRENDING DESTINATION</p>
                        <h1 className="font-display text-[clamp(2rem,6vw,5rem)] leading-none font-bold tracking-tight">
                            {destination.name}
                        </h1>
                        <p className="text-20 mt-4 max-w-2xl">{destination.description}</p>
                    </div>
                    <div className="bg-faint relative aspect-[4/3] overflow-hidden">
                        <DiscoverPhoto photo={destination.coverImage} width={1200} eager />
                    </div>
                </header>
                {boards.length ? (
                    <section
                        aria-label={`${destination.name} Boards`}
                        className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3"
                    >
                        {boards.map((board) => (
                            <DiscoverBoardCard key={board.id} board={board} />
                        ))}
                    </section>
                ) : (
                    <section aria-labelledby="destination-empty-title" className="border-line mt-8 border p-6 md:p-8">
                        <h2 id="destination-empty-title" className="font-display text-24">
                            {available ? "No Boards for this destination yet." : "Destination Boards are coming soon."}
                        </h2>
                        <p className="text-14 mt-3 max-w-xl">
                            {available
                                ? "Explore another destination to find your next adventure."
                                : "Public Board discovery is not connected yet. This destination will show matching Boards once it is available."}
                        </p>
                        <Link
                            href="/discover#trending-title"
                            scroll={false}
                            className="mt-5 inline-flex min-h-11 items-center underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
                        >
                            Explore other destinations
                        </Link>
                    </section>
                )}
            </div>
        </AppShell>
    );
}
