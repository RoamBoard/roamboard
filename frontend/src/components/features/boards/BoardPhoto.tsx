import Image from "next/image";
import type { BoardImage } from "@/types/board";

type Props = {
    image?: BoardImage;
    className?: string;
    sizes?: string;
    preload?: boolean;
};

// Use the same image setup for covers, activity photos, and author photos.
export default function BoardPhoto({
    image,
    className = "",
    sizes = "(max-width: 768px) 75vw, 30vw",
    preload = false
}: Props) {
    // Leave this space out when no photo was supplied.
    if (!image?.url) return null;

    return (
        // The wrapper sets the size; fill makes the image fit inside it.
        <div className={`relative overflow-hidden ${className}`}>
            <Image
                src={image.url}
                alt={image.alt}
                fill
                sizes={sizes}
                preload={preload}
                className="object-cover"
                // The backend will provide public image URLs, including its
                // chosen fallback. No frontend replacement image is invented.
                unoptimized
            />
        </div>
    );
}
