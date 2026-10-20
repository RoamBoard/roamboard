"use client";

import BackLink from "@/components/ui/BackLink";
import { motion, useReducedMotion } from "motion/react";
import BoardPhoto from "@/components/features/boards/BoardPhoto";
import { destinationPhotoUrl, type DestinationGuideData } from "@/lib/destination-guides";
import DestinationPhotoCredit from "./DestinationPhotoCredit";
import DestinationHeading from "./DestinationHeading";

// Shared by the real guide and the labelled typography review; image and entrance behavior stay identical.
export default function DestinationArtwork({
    name,
    country,
    image
}: {
    name: string;
    country: string;
    image?: DestinationGuideData["images"][number];
}) {
    const reduced = useReducedMotion();
    return (
        <div
            data-destination-artwork
            className="border-line @container relative isolate h-full min-w-0 overflow-hidden border-r"
        >
            <BackLink fallbackHref="/discover" className="bg-background/90 absolute top-5 left-5 z-20 px-2 md:left-8" />
            <motion.div
                initial={{ opacity: 0.35, rotate: -35 }}
                animate={{ opacity: 1, rotate: 0 }}
                transition={{ duration: reduced ? 0 : 1.1, ease: [0.22, 1, 0.36, 1] }}
                className="absolute top-1/2 right-0 aspect-square w-[200%] -translate-y-1/2 overflow-hidden rounded-full"
            >
                <BoardPhoto
                    image={image ? { ...image, url: destinationPhotoUrl(image.url), source: "application" } : undefined}
                    placeholderLabel={name}
                    preload
                    sizes="(max-width: 767px) 680px, 1100px"
                    className="h-full w-full"
                />
                <span aria-hidden="true" className="bg-background absolute inset-[19%] rounded-full" />
            </motion.div>
            {/* Match the white cutout's circle so lettering can never cover the photograph. */}
            <div className="pointer-events-none absolute inset-0 [clip-path:circle(62cqw_at_0_50%)]">
                <DestinationHeading key={name} name={name} country={country} />
            </div>
            <div className="bg-background/90 absolute right-5 bottom-7 left-5 w-fit max-w-[85%] px-2 py-1 md:left-8">
                <DestinationPhotoCredit {...image} />
                {!image ? <p className="text-muted-foreground text-xs">Photo unavailable for {name}</p> : null}
            </div>
        </div>
    );
}
