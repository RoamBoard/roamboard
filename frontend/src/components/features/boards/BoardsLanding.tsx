import Link from "next/link";

import BoardPathOption from "@/components/features/boards/BoardPathOption";
import ScrollCue from "@/components/ui/ScrollCue";

export default function BoardsLanding() {
    return (
        <article className="bg-background text-foreground relative min-h-[100rem] w-full min-w-0 overflow-hidden sm:min-h-[112rem]">
            <section
                className="flex flex-col items-center px-5 text-center sm:px-10"
                aria-labelledby="boards-heading"
            >
                <div
                    role="img"
                    aria-label="Stylized rock formations at sunset"
                    className="h-[clamp(11rem,31vw,23rem)] w-full max-w-5xl shrink-0 rounded-b-[50%] bg-[url('/boards-create-cover.svg')] bg-cover bg-center"
                />

                <h1
                    id="boards-heading"
                    className="font-display text-48 sm:text-72 lg:text-96 mt-10 max-w-full leading-none font-bold tracking-tight sm:mt-12"
                >
                    CREATE
                </h1>

                <Link
                    href="/boards/mine"
                    className="border-foreground bg-foreground text-background hover:bg-background hover:text-foreground focus-visible:outline-foreground text-12 mt-7 inline-flex min-h-12 items-center border px-7 font-bold tracking-wide uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 motion-reduce:transition-none"
                >
                    My Boards{" "}
                    <span aria-hidden="true" className="ml-3">
                        →
                    </span>
                </Link>

                <ScrollCue
                    targetId="board-paths"
                    label="Scroll to Board creation options"
                    className="mt-5"
                />

                <div className="text-10 text-stone pointer-events-none absolute top-[27%] right-4 left-4 hidden items-center justify-between lg:flex">
                    <span>the world is your canvas</span>
                    <span>paint it with memories</span>
                </div>
            </section>

            <section
                id="board-paths"
                aria-labelledby="board-paths-heading"
                className="scroll-mt-8 px-5 text-center"
            >
                <h2 id="board-paths-heading" className="sr-only">
                    Choose how to create a Board
                </h2>

                <ol className="flex flex-col items-center">
                    <li>
                        <BoardPathOption
                            href="/boards/new"
                            title="new board"
                            description="build your journey"
                        />
                    </li>
                    <li
                        aria-label="Remix saved Board, coming later"
                        className="flex flex-col items-center"
                    >
                        <span
                            aria-hidden="true"
                            className="bg-line h-16 w-px sm:h-20"
                        />
                        <BoardPathOption
                            title="remix saved board"
                            description="inspired by others, made your own"
                        />
                    </li>
                    <li className="flex flex-col items-center">
                        <span
                            aria-hidden="true"
                            className="bg-line h-16 w-px sm:h-20"
                        />
                        <BoardPathOption
                            href="/boards/drafts"
                            title="edit draft"
                            description="continue where you left off"
                        />
                    </li>
                </ol>

                <div
                    aria-hidden="true"
                    className="bg-line mx-auto h-44 w-px sm:h-52"
                />

                <p className="font-body text-16 text-line sm:text-20 font-bold">
                    need more inspiration?
                </p>
                <p className="font-display text-48 sm:text-72 lg:text-96 mt-6 max-w-full leading-none font-bold tracking-tight">
                    DISCOVER
                </p>
            </section>
        </article>
    );
}
