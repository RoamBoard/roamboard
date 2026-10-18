"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./BoardCreationChoices.module.css";

const choices = [
    { title: "new board", description: "build your journey", href: "/boards/new" },
    { title: "continue a board", description: "pick up wherever you left off", href: "/create/continue" },
    { title: "remix a saved board", description: "their inspiration, your adventure", href: "/create/remix" }
];
export default function BoardCreationChoices() {
    const router = useRouter();
    const [leaving, setLeaving] = useState<string | null>(null);
    useEffect(() => {
        if (!leaving) return;
        const timer = window.setTimeout(() => router.push(leaving), 250);
        return () => window.clearTimeout(timer);
    }, [leaving, router]);
    return (
        <section
            id="board-paths"
            aria-labelledby="board-paths-heading"
            className="mx-auto flex w-full max-w-[92rem] scroll-mt-12 flex-col items-center px-4 sm:px-8"
            onKeyDown={(event) => {
                if (event.key === "Escape") setLeaving(null);
            }}
        >
            <h2 id="board-paths-heading" className="sr-only">
                Create or continue a Board
            </h2>
            {choices.map((choice, index) => (
                <div key={choice.href} className="flex flex-col items-center">
                    {index ? <span aria-hidden="true" className="bg-line h-20 w-px sm:h-24" /> : null}
                    <Link
                        href={choice.href}
                        aria-disabled={Boolean(leaving)}
                        tabIndex={leaving ? -1 : undefined}
                        onClick={(event) => {
                            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
                                return;
                            if (leaving) {
                                event.preventDefault();
                                return;
                            }
                            if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
                            event.preventDefault();
                            setLeaving(choice.href);
                        }}
                        className={`${styles.bubble} ${leaving === choice.href ? styles.departing : leaving ? styles.fading : ""} group focus-visible:outline-foreground before:border-line hover:before:border-foreground/50 relative grid aspect-square w-[clamp(12rem,16vw,16.25rem)] place-items-center rounded-full text-center before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:border before:[mask-image:linear-gradient(to_bottom,black_25%,transparent_95%)] focus-visible:outline-2 focus-visible:outline-offset-8`}
                    >
                        <span className="relative px-4">
                            <strong className="block text-[clamp(1.125rem,1.5vw,1.5rem)] leading-tight font-bold">
                                {choice.title}
                            </strong>
                            <span className="text-muted-foreground mt-2 block text-xs">{choice.description}</span>
                        </span>
                    </Link>
                </div>
            ))}
        </section>
    );
}
