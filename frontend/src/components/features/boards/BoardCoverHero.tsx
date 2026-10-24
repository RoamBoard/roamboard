/* eslint-disable @next/next/no-img-element */
import Image from "@/components/images/LibraryImage";
import { ImagePlus } from "lucide-react";

type Props = {
    coverUrl?: string;
    disabled: boolean;
    loading?: boolean;
    onChooseImages: () => void;
};

export default function BoardCoverHero({ coverUrl, disabled, loading = false, onChooseImages }: Props) {
    return (
        <figure className="relative">
            <div className="bg-faint relative aspect-[4/3] overflow-hidden rounded-[2rem]">
                {loading ? (
                    <div className="bg-faint absolute inset-0 animate-pulse motion-reduce:animate-none" />
                ) : coverUrl ? (
                    // Protected Board images must keep their session cookies, without Next's image proxy.
                    <img
                        src={coverUrl}
                        alt="Board cover"
                        decoding="async"
                        className="absolute inset-0 size-full object-cover"
                    />
                ) : (
                    <Image
                        src="library:frontend.images.destinations.bamboo"
                        alt="Sunlight filtering through a green bamboo forest"
                        fill
                        loading="eager"
                        sizes="(max-width: 640px) 92vw, (max-width: 1700px) 80vw, 1248px"
                        className="object-cover object-[center_65%]"
                    />
                )}
                <button
                    type="button"
                    disabled={disabled || loading}
                    onClick={onChooseImages}
                    className="absolute top-[42%] left-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-black/35 text-white backdrop-blur-sm transition-colors hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none sm:size-14"
                    aria-label="Edit Board cover"
                >
                    <ImagePlus aria-hidden="true" className="size-5 sm:size-6" strokeWidth={1.5} />
                </button>
            </div>
            {!coverUrl && !loading ? (
                <figcaption className="text-muted-foreground mt-3 text-center text-[10px]">
                    Default image ·{" "}
                    <a
                        href="https://unsplash.com/photos/EvsuNMbZNJw"
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-foreground underline underline-offset-4"
                    >
                        Karen Chew / Unsplash
                    </a>
                </figcaption>
            ) : null}
        </figure>
    );
}
