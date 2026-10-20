import { Suspense } from "react";
import { notFound } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import BoardCollectionGrid from "@/components/features/boards/BoardCollectionGrid";
import { collectionTitles, type CollectionContext } from "@/lib/board-collections";

export default async function CollectionPage({ params }: { params: Promise<{ context: string }> }) {
    const { context } = await params;
    if (!Object.hasOwn(collectionTitles, context)) notFound();
    return (
        <AppShell activeHref="/boards">
            <Suspense
                fallback={
                    <p role="status" className="p-12">
                        Loading Boards…
                    </p>
                }
            >
                <BoardCollectionGrid context={context as CollectionContext} />
            </Suspense>
        </AppShell>
    );
}
