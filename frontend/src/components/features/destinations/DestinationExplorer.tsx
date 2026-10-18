"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, Search } from "lucide-react";
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from "motion/react";
import { destinationPages, destinationPageHref } from "@/data/destination-atlas";
import { resolveDestinationSearchHref } from "@/lib/destination-search";
import { destinationTransition } from "@/lib/destination-transition";
import type { Destination } from "@/lib/destinations";
import {
    createDestinationSearchStore,
    type DestinationSearchState,
    type DestinationSearchStore
} from "@/lib/destination-search-store";

export default function DestinationExplorer() {
    const router = useRouter();
    const reduced = useReducedMotion();
    const controls = useAnimationControls();
    const navigating = useRef(false);
    const navigationController = useRef<AbortController | null>(null);
    const [actions] = useState(createDestinationSearchStore);
    const state = useSyncExternalStore(actions.subscribe, actions.getSnapshot, actions.getSnapshot);
    const [leaving, setLeaving] = useState(false);

    useEffect(() => {
        actions.resume();
        return () => {
            actions.dispose();
            navigationController.current?.abort();
        };
    }, [actions]);

    async function navigate(href: DestinationNavigationTarget) {
        if (navigating.current) return;
        navigating.current = true;
        setLeaving(true);
        actions.setOpen(false);
        const controller = new AbortController();
        navigationController.current = controller;
        const pendingHref = typeof href === "string" ? href : href(controller.signal);
        const exit = reduced
            ? Promise.resolve()
            : controls.start({
                  opacity: 0,
                  y: -destinationTransition.distance,
                  transition: { duration: destinationTransition.duration, ease: destinationTransition.exitEase }
              });
        const target = await pendingHref;
        if (controller.signal.aborted) return;
        router.prefetch(target);
        await exit;
        if (!controller.signal.aborted) router.push(target);
    }

    return (
        <DestinationExplorerContent
            state={state}
            actions={actions}
            leaving={leaving}
            controls={controls}
            reduced={Boolean(reduced)}
            onNavigate={(href) => void navigate(href)}
        />
    );
}

type DestinationNavigationTarget = string | ((signal: AbortSignal) => Promise<string>);

type DestinationExplorerContentProps = {
    state: DestinationSearchState;
    actions: DestinationSearchStore;
    leaving: boolean;
    reduced: boolean;
    controls: ReturnType<typeof useAnimationControls>;
    onNavigate: (href: DestinationNavigationTarget) => void;
};

export function DestinationExplorerContent({
    state,
    actions,
    leaving,
    reduced,
    controls,
    onNavigate
}: DestinationExplorerContentProps) {
    const { query, results, active, open, loading, searched, error } = state;
    const showSuggestions = open && query.trim().length >= 2;

    function choose(destination: Destination) {
        if (!leaving) onNavigate((signal) => resolveDestinationSearchHref(destination, query, results, signal));
    }

    function submit(event: FormEvent) {
        event.preventDefault();
        if (leaving) return;
        const selected = actions.submit();
        if (selected) choose(selected);
    }

    return (
        <section
            className="font-body flex min-h-dvh min-w-0 items-start justify-center px-5 pt-56 pb-32 md:px-10 md:pt-[calc(13.75rem+clamp(40px,6.4vw,96px))]"
            aria-labelledby="roamboard-heading"
        >
            <motion.div animate={controls} className="relative w-full max-w-[550px]" inert={leaving}>
                <h1
                    id="roamboard-heading"
                    aria-label="Roamboard"
                    className="font-display absolute inset-x-0 bottom-full pb-8 text-center text-[clamp(32px,6.4vw,96px)] leading-[1.02] font-bold tracking-[-0.045em] whitespace-nowrap sm:pb-10"
                >
                    <Link
                        href="/discover"
                        aria-label="Roam: discover destinations"
                        className="text-foreground hover:text-foreground/90 transition-colors focus-visible:outline-1 focus-visible:outline-offset-4 motion-reduce:transition-none"
                    >
                        ROAM
                    </Link>
                    <Link
                        href="/boards"
                        aria-label="Board: view your Boards"
                        className="text-foreground hover:text-foreground/90 transition-colors focus-visible:outline-1 focus-visible:outline-offset-4 motion-reduce:transition-none"
                    >
                        BOARD
                    </Link>
                </h1>
                <form
                    role="search"
                    aria-label="Destination search"
                    onSubmit={submit}
                    className="relative"
                    onBlur={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget)) actions.setOpen(false);
                    }}
                >
                    <div className="group border-line/65 hover:border-muted-foreground/60 focus-within:border-foreground/60 relative flex min-h-16 items-center border-b transition-colors motion-reduce:transition-none md:min-h-20">
                        <Search
                            aria-hidden="true"
                            size={18}
                            strokeWidth={1.3}
                            className="text-muted-foreground/65 pointer-events-none ml-3 shrink-0"
                        />
                        <label htmlFor="destination-search" className="sr-only">
                            Search destinations
                        </label>
                        <input
                            id="destination-search"
                            role="combobox"
                            aria-autocomplete="list"
                            aria-expanded={showSuggestions}
                            aria-controls={showSuggestions ? "destination-suggestions" : undefined}
                            aria-activedescendant={
                                showSuggestions && results[active] ? `destination-option-${active}` : undefined
                            }
                            autoComplete="off"
                            maxLength={100}
                            spellCheck={false}
                            value={query}
                            placeholder="where would you like to go?"
                            className="text-14 placeholder:text-muted-foreground md:text-20 w-full min-w-0 bg-transparent px-4 py-5 text-center outline-none"
                            onFocus={() => actions.setOpen(true)}
                            onChange={(event) => actions.setQuery(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Escape") {
                                    actions.setOpen(false);
                                    return;
                                }
                                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                                    event.preventDefault();
                                    actions.moveSelection(event.key === "ArrowDown" ? 1 : -1);
                                }
                            }}
                        />
                        {query.trim() ? (
                            <button
                                type="submit"
                                aria-label="Explore selected destination"
                                disabled={loading || leaving}
                                className="text-muted-foreground hover:text-foreground focus-visible:outline-foreground mr-1 grid size-11 shrink-0 place-items-center focus-visible:outline-2 disabled:opacity-40"
                            >
                                {loading ? (
                                    <LoaderCircle
                                        size={14}
                                        aria-hidden="true"
                                        className="animate-spin motion-reduce:animate-none"
                                    />
                                ) : (
                                    <ArrowRight size={16} strokeWidth={1.2} aria-hidden="true" />
                                )}
                            </button>
                        ) : (
                            <span aria-hidden="true" className="mr-1 block size-11 shrink-0" />
                        )}
                    </div>
                    <AnimatePresence>
                        {showSuggestions && (
                            <motion.div
                                initial={{ opacity: 0, y: reduced ? 0 : -3 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: reduced ? 0 : 0.16 }}
                                className="bg-background absolute inset-x-0 top-full z-20 pt-3 pb-4"
                            >
                                <ul
                                    id="destination-suggestions"
                                    role="listbox"
                                    aria-label="Destinations"
                                    aria-busy={loading}
                                >
                                    {results.map((destination, index) => (
                                        <li key={destination.id} role="presentation">
                                            <button
                                                id={`destination-option-${index}`}
                                                role="option"
                                                aria-selected={active === index}
                                                type="button"
                                                tabIndex={-1}
                                                onMouseDown={(event) => event.preventDefault()}
                                                onClick={() => choose(destination)}
                                                className="group flex min-h-11 w-full items-baseline justify-between gap-4 px-2 py-3 text-left focus-visible:outline-2"
                                            >
                                                <span
                                                    className={`text-14 min-w-0 leading-5 break-words underline-offset-4 group-hover:underline ${active === index ? "underline" : ""}`}
                                                >
                                                    {destination.name}
                                                </span>
                                                <span className="text-muted-foreground text-12 max-w-[45%] shrink-0 text-right leading-4">
                                                    {destination.placeType === "country"
                                                        ? "Country"
                                                        : destination.country}
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                                {(error || (!loading && searched && !results.length)) && (
                                    <p className="text-muted-foreground text-12 px-2 py-3 leading-4">
                                        {error || "No destinations found."}
                                    </p>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                    {error && query.trim().length < 2 && (
                        <p className="text-muted-foreground text-12 mt-3 text-center leading-4">{error}</p>
                    )}
                </form>
                <nav
                    className={`text-12 absolute inset-x-0 top-full mt-7 flex flex-wrap justify-center gap-x-6 gap-y-1 leading-4 ${showSuggestions ? "invisible" : ""}`}
                    aria-label="Suggested destinations"
                    inert={showSuggestions}
                >
                    {destinationPages.map((destination) => (
                        <Link
                            key={destination.slug}
                            href={destinationPageHref(destination)}
                            onClick={(event) => {
                                if (
                                    event.button !== 0 ||
                                    event.metaKey ||
                                    event.ctrlKey ||
                                    event.shiftKey ||
                                    event.altKey
                                )
                                    return;
                                event.preventDefault();
                                if (!leaving) onNavigate(destinationPageHref(destination));
                            }}
                            className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
                        >
                            {destination.name}
                        </Link>
                    ))}
                </nav>
            </motion.div>
            <p role="status" className="sr-only">
                {leaving
                    ? "Opening destination."
                    : loading
                      ? "Searching destinations."
                      : error
                        ? error
                        : searched
                          ? `${results.length} destinations found.`
                          : ""}
            </p>
        </section>
    );
}
