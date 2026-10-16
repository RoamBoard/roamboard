"use client";

import { mockBoardCollections } from "@/data/my-board-collections";
import { filterGalleryBoards, filterLibraryBoards } from "@/lib/my-boards";
import BoardLibrary from "./BoardLibrary";
import SpatialGallery from "./SpatialGallery";

export default function BoardCollections({ query }: { query: string }) {
    const saved = filterGalleryBoards(mockBoardCollections.saved, query);
    const archived = filterLibraryBoards(mockBoardCollections.archived, query);

    return (
        <>
            <p className="text-12 text-foreground/65 mx-auto mt-24 max-w-lg px-5 text-center">
                Saved and archive collections below use sample Boards. Account syncing for these collections is not
                available yet.
            </p>
            {saved.length ? (
                <SpatialGallery boards={saved} saved />
            ) : (
                <section
                    aria-labelledby="recently-saved-heading"
                    className="mx-auto mt-32 max-w-[1320px] px-5 text-center"
                >
                    <h2
                        id="recently-saved-heading"
                        className="font-display text-foreground/60 text-30 md:text-36 leading-[.95] font-medium"
                    >
                        RECENTLY
                        <br />
                        SAVED
                    </h2>
                    <p role="status" className="text-14 text-foreground/65 py-20">
                        No recently saved sample Boards match your search.
                    </p>
                </section>
            )}
            <section aria-labelledby="archive-saves-heading" className="mx-auto mt-28 max-w-[1320px] md:mt-44">
                <h2
                    id="archive-saves-heading"
                    className="font-display text-foreground/60 text-30 md:text-36 mx-auto grid max-w-md grid-cols-2 font-medium"
                >
                    <span className="border-line border-r py-6 pr-5 text-right">ARCHIVE</span>
                    <span className="pt-20 pl-5">SAVES</span>
                </h2>
                <BoardLibrary
                    id="archive-library"
                    title="ARCHIVED BOARDS"
                    description="Sample archive · past journeys kept apart from active Boards."
                    boards={archived}
                    archived
                />
                <div className="border-line mx-5 mt-20 border-t sm:mx-10" />
                <BoardLibrary
                    id="saved-library"
                    title="SAVED BOARDS"
                    description="Sample saves · revisit the Boards you’ve kept for inspiration."
                    boards={saved}
                />
            </section>
        </>
    );
}
