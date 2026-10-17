import Image from "@/components/images/LibraryImage";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import BoardCreationChoices from "@/components/features/boards/BoardCreationChoices";
import ScrollCue from "@/components/ui/ScrollCue";

export default function BoardsLanding() {
    return (
        <article className="font-body bg-background text-foreground relative w-full min-w-0 overflow-x-clip">
            <header className="relative flex flex-col items-center text-center">
                <figure className="w-[92%] max-w-[78rem] sm:w-[80%]">
                    <div className="bg-faint relative aspect-[2.42] overflow-hidden rounded-b-[50%_100%]">
                        <Image
                            src="library:frontend.images.create.desert"
                            alt="Golden evening light falling across the dunes of the Dubai desert"
                            fill
                            preload
                            sizes="(max-width: 640px) 92vw, (max-width: 1700px) 80vw, 1248px"
                            className="object-cover object-[center_58%]"
                        />
                    </div>
                    <figcaption className="text-muted-foreground/65 mt-2 text-center text-[10px]">
                        Photography by{" "}
                        <a
                            href="https://unsplash.com/@nejc_soklic"
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-foreground underline underline-offset-4"
                        >
                            Nejc Soklič
                        </a>{" "}
                        /{" "}
                        <a
                            href="https://unsplash.com/photos/YXFw9L-0DKo"
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-foreground underline underline-offset-4"
                        >
                            Unsplash
                        </a>
                    </figcaption>
                </figure>

                <Link
                    href="/boards/mine"
                    className="text-muted-foreground hover:text-foreground focus-visible:outline-foreground mt-6 inline-flex min-h-11 items-center gap-2 text-[11px] tracking-[0.08em] uppercase underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 sm:absolute sm:top-5 sm:right-5 sm:mt-0 lg:top-8 lg:right-8"
                >
                    My Boards <ArrowUpRight aria-hidden="true" size={14} strokeWidth={1.25} />
                </Link>

                <h1
                    id="boards-heading"
                    className="font-display mt-5 text-[clamp(4rem,8.34vw,9rem)] leading-[1.02] font-bold tracking-[-0.045em] sm:mt-12 lg:mt-14"
                >
                    CREATE
                </h1>

                <div className="relative mt-7 flex w-full justify-center">
                    <ScrollCue
                        targetId="board-paths"
                        label="Explore ways to create a Board"
                        className="h-[clamp(15rem,27vw,29rem)] [&>span:nth-child(1)]:flex-1 [&>span:nth-child(2)]:size-11 [&>span:nth-child(3)]:flex-1"
                    />
                    <div className="text-muted-foreground/55 pointer-events-none absolute right-6 bottom-[22%] left-6 hidden justify-between text-[clamp(0.75rem,1.15vw,1.25rem)] lg:flex">
                        <span>the world is your canvas</span>
                        <span>paint it with memories</span>
                    </div>
                </div>
            </header>

            <BoardCreationChoices />

            <section
                aria-labelledby="create-discover-heading"
                className="flex flex-col items-center px-4 pb-24 text-center sm:pb-48 lg:pb-72"
            >
                <span aria-hidden="true" className="bg-line h-[clamp(14rem,24vw,26rem)] w-px" />
                <p className="text-muted-foreground/65 mt-8 text-[clamp(1.125rem,2.3vw,2.5rem)] leading-tight font-bold">
                    need more inspiration?
                </p>
                <h2
                    id="create-discover-heading"
                    className="font-display mt-8 text-[clamp(2.75rem,8.34vw,9rem)] leading-[1.02] font-bold tracking-[-0.045em]"
                >
                    <Link
                        href="/discover"
                        className="group focus-visible:outline-foreground relative inline-block focus-visible:outline-2 focus-visible:outline-offset-8"
                    >
                        DISCOVER
                        <ArrowUpRight
                            aria-hidden="true"
                            className="absolute -top-2 -right-6 size-5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none sm:-right-9 sm:size-7"
                            strokeWidth={1}
                        />
                    </Link>
                </h2>
            </section>
        </article>
    );
}
