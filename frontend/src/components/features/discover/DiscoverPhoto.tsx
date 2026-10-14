import Image from "next/image";
import type { DiscoverPhoto as Photo } from "@/data/discover-preview";

type Props = {
    photo: Photo;
    eager?: boolean;
    width?: number;
    position?: string;
};

export default function DiscoverPhoto({
    photo,
    eager = false,
    width = 1000,
    position = "center"
}: Props) {
    const url = new URL(photo.src);
    url.searchParams.set("w", String(width));

    return (
        <Image
            src={url.toString()}
            alt={photo.alt}
            fill
            unoptimized
            loading={eager ? "eager" : "lazy"}
            fetchPriority={eager ? "high" : "auto"}
            className="object-cover"
            style={{ objectPosition: position }}
            sizes="(max-width: 767px) 85vw, 50vw"
        />
    );
}
