"use client";

import Image from "@/components/images/LibraryImage";
import { useState } from "react";
import type { AtlasImage } from "@/data/destination-atlas";

export default function AtlasPhoto({
    image,
    eager = false,
    sizes = "(max-width: 767px) 90vw, 55vw"
}: {
    image: AtlasImage;
    eager?: boolean;
    sizes?: string;
}) {
    const [failedSource, setFailedSource] = useState<string | null>(null);
    return failedSource === image.src ? (
        <span
            role="img"
            aria-label={image.alt}
            className="bg-faint text-muted-foreground absolute inset-0 grid place-items-center p-6 text-center text-sm"
        >
            {image.alt}
            <span className="sr-only"> — photograph unavailable</span>
        </span>
    ) : (
        <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes={sizes}
            loading={eager ? "eager" : "lazy"}
            fetchPriority={eager ? "high" : "auto"}
            className="object-cover"
            style={{ objectPosition: image.position || "center" }}
            onError={() => setFailedSource(image.src)}
        />
    );
}
