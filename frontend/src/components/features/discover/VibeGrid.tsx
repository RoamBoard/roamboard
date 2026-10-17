import { LibraryCredit } from "@/components/images/LibraryImage";
import VibeMarqueeGallery from "./VibeMarqueeGallery";
import { boardTags } from "@/data/board-tags";

export default function VibeGrid() {
    return (
        <section
            id="roam-by-vibe"
            aria-labelledby="vibe-title"
            className="scroll-mt-8 bg-black px-5 pt-10 pb-16 text-white md:px-10"
        >
            <h2
                id="vibe-title"
                className="font-display mb-10 text-right text-[clamp(2rem,5.5vw,6rem)] leading-none font-bold"
            >
                ROAM BY VIBE
            </h2>
            <VibeMarqueeGallery tags={boardTags} />
            <details className="text-12 mt-14 text-white/80">
                <summary className="w-fit cursor-pointer py-2 underline underline-offset-4 focus-visible:outline-2">
                    Vibe photo credits
                </summary>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {boardTags.map((tag) => (
                        <li key={tag.id}>
                            <LibraryCredit source={tag.gridImage.url}>
                                <a
                                    href={tag.gridImage.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline underline-offset-4"
                                >
                                    {tag.name}: {tag.gridImage.photographer} / {tag.gridImage.provider}
                                </a>
                            </LibraryCredit>
                        </li>
                    ))}
                </ul>
            </details>
        </section>
    );
}
