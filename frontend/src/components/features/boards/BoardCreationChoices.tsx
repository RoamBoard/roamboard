"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight } from "lucide-react";

import BoardPathOption from "@/components/features/boards/BoardPathOption";

export default function BoardCreationChoices() {
    const [expanded, setExpanded] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const reducedMotion = useReducedMotion();
    const transition = reducedMotion
        ? { duration: 0 }
        : { type: "spring" as const, stiffness: 170, damping: 27, mass: 0.8 };

    function collapse() {
        setExpanded(false);
        triggerRef.current?.focus({ preventScroll: true });
    }

    return (
        <section
            id="board-paths"
            aria-labelledby="board-paths-heading"
            className="@container mx-auto w-full max-w-[92rem] scroll-mt-12 px-4 sm:px-8"
            onKeyDown={(event) => {
                if (expanded && event.key === "Escape") {
                    event.preventDefault();
                    collapse();
                }
            }}
        >
            <h2 id="board-paths-heading" className="sr-only">
                Choose how to create a Board
            </h2>

            <motion.div
                layout={!reducedMotion}
                transition={transition}
                className={`relative mx-auto ${expanded ? "h-[26rem] sm:h-[34rem] md:h-[clamp(30rem,47cqw,43rem)]" : "h-[clamp(12rem,16vw,16.25rem)]"}`}
            >
                <motion.button
                    ref={triggerRef}
                    type="button"
                    layout={!reducedMotion}
                    transition={transition}
                    aria-expanded={expanded}
                    aria-controls="new-board-options"
                    onClick={() => setExpanded((current) => !current)}
                    className={`group bg-background focus-visible:outline-foreground before:border-line hover:before:border-foreground/50 absolute top-0 left-1/2 z-20 grid aspect-square -translate-x-1/2 cursor-pointer place-items-center rounded-full text-center before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:border before:[mask-image:linear-gradient(to_bottom,black_30%,transparent_98%)] focus-visible:outline-2 focus-visible:outline-offset-8 ${expanded ? "w-[82%] max-w-96 md:w-[46%] md:max-w-[40rem]" : "w-[clamp(12rem,16vw,16.25rem)]"}`}
                >
                    <motion.span layout={!reducedMotion ? "position" : false} className="relative px-4">
                        <strong
                            className={`block leading-tight font-bold ${expanded ? "text-[clamp(1.75rem,3.5cqw,3rem)]" : "text-[clamp(1.125rem,1.5vw,1.5rem)]"}`}
                        >
                            new board
                        </strong>
                        <span
                            className={`text-muted-foreground mt-2 block ${expanded ? "text-sm md:text-base" : "text-xs"}`}
                        >
                            build your journey
                        </span>
                    </motion.span>
                </motion.button>

                <div id="new-board-options" inert={!expanded}>
                    <AnimatePresence initial={false}>
                        {expanded ? (
                            <motion.div
                                key="creation-options"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: reducedMotion ? 0 : 0.16 }}
                                className="pointer-events-none absolute inset-0 z-30"
                            >
                                {[
                                    {
                                        title: "smart create",
                                        description: "create with images",
                                        href: "/boards/new",
                                        position: "left-0 md:left-[1%]",
                                        direction: 1
                                    },
                                    {
                                        title: "start from scratch",
                                        description: "create with a clean slate",
                                        href: "/boards/new?mode=scratch",
                                        position: "right-0 md:right-[1%]",
                                        direction: -1
                                    }
                                ].map((choice, index) => (
                                    <motion.div
                                        key={choice.href}
                                        initial={
                                            reducedMotion
                                                ? false
                                                : { opacity: 0, x: choice.direction * 60, y: -20, scale: 0.85 }
                                        }
                                        animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, scale: reducedMotion ? 1 : 0.9 }}
                                        transition={{ ...transition, delay: reducedMotion ? 0 : index * 0.045 }}
                                        className={`absolute top-[52%] aspect-square w-[49%] sm:top-[42%] md:top-[24%] md:w-[32%] ${choice.position}`}
                                    >
                                        <Link
                                            href={choice.href}
                                            className="group focus-visible:outline-foreground before:border-line/80 hover:before:border-foreground/50 pointer-events-auto relative grid size-full place-items-center rounded-full text-center before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:border focus-visible:outline-2 focus-visible:outline-offset-6"
                                        >
                                            <span className="relative px-2 md:px-5">
                                                <strong className="block text-[clamp(0.875rem,2.15cqw,2rem)] leading-tight font-bold">
                                                    {choice.title}
                                                </strong>
                                                <span className="text-muted-foreground mt-2 block text-[clamp(0.625rem,1.05cqw,1rem)] leading-relaxed">
                                                    {choice.description}
                                                </span>
                                            </span>
                                            <ArrowUpRight
                                                aria-hidden="true"
                                                className="text-muted-foreground absolute bottom-[18%] size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
                                                strokeWidth={1}
                                            />
                                        </Link>
                                    </motion.div>
                                ))}
                            </motion.div>
                        ) : null}
                    </AnimatePresence>
                </div>
            </motion.div>

            <motion.div layout={!reducedMotion} transition={transition} className="flex flex-col items-center">
                <span aria-hidden="true" className="bg-line h-20 w-px sm:h-24" />
                <BoardPathOption
                    compact={expanded}
                    title="remix saved board"
                    description="inspired by others, made your own"
                />
                <span aria-hidden="true" className="bg-line h-20 w-px sm:h-24" />
                <BoardPathOption
                    compact={expanded}
                    href="/boards/drafts"
                    title="edit draft"
                    description="continue where you left off"
                />
            </motion.div>
        </section>
    );
}
