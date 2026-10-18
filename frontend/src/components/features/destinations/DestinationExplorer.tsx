"use client";

import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from "motion/react";
import { destinationPages, destinationPageHref } from "@/data/destination-atlas";
import { resolveDestinationSearchHref } from "@/lib/destination-search";
import { useDestinationTransition } from "./DestinationTransitionProvider";
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
    const transition = useDestinationTransition();
    const [actions] = useState(createDestinationSearchStore);
    const state = useSyncExternalStore(actions.subscribe, actions.getSnapshot, actions.getSnapshot);

    useEffect(() => {
        actions.resume();
        return () => {
            actions.dispose();
        };
    }, [actions]);

    function navigate(href: DestinationNavigationTarget, name?: string) {
        if (transition?.opening) return;
        actions.setOpen(false);
        if (transition) transition.open(href, name ?? state.query);
        else if (typeof href === "string") router.push(href);
    }

    return (
        <DestinationExplorerContent
            state={state}
            actions={actions}
            leaving={transition?.opening ?? false}
            controls={controls}
            reduced={Boolean(reduced)}
            onNavigate={navigate}
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
    onNavigate: (href: DestinationNavigationTarget, name?: string) => void;
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
        if (!leaving)
            onNavigate((signal) => resolveDestinationSearchHref(destination, query, results, signal), destination.name);
    }

    function submit(event: FormEvent) {
        event.preventDefault();
        if (leaving) return;
        const selected = actions.submit();
        if (selected) choose(selected);
    }

    return (
        <section className="font-body grid min-h-dvh min-w-0 place-items-center px-5 md:px-10" aria-label="Roamboard">
            <motion.div
                animate={controls}
                className="relative w-full max-w-[550px]"
                inert={leaving}
                onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) actions.setOpen(false);
                }}
            >
                <h1 className="sr-only">Roamboard — find your destination</h1>
                <form role="search" aria-label="Destination search" onSubmit={submit} className="relative">
                    <div className="group focus-within:border-line hover:border-line/50 relative flex min-h-20 items-center border-b border-transparent transition-colors motion-reduce:transition-none">
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
                            placeholder="so, where is it you wish to go?"
                            className="placeholder:text-muted-foreground text-16 md:text-20 w-full min-w-0 bg-transparent px-6 py-7 text-center outline-none focus-visible:outline-1 focus-visible:-outline-offset-4"
                            onFocus={() => actions.setOpen(true)}
                            onChange={(event) => actions.setQuery(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.nativeEvent?.isComposing) return;
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
                                className="text-muted-foreground hover:text-foreground focus-visible:outline-foreground absolute right-0 grid size-11 place-items-center focus-visible:outline-2 disabled:opacity-40"
                            >
                                <ArrowRight size={16} strokeWidth={1.2} aria-hidden="true" />
                            </button>
                        ) : null}
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
                                                className="group flex min-h-11 w-full items-baseline justify-center gap-2 px-2 py-3 text-center focus-visible:outline-2"
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
                                {(loading || error || (!loading && searched && !results.length)) && (
                                    <p className="text-muted-foreground text-12 px-2 py-3 leading-4">
                                        {loading ? "Searching destinations…" : error || "No destinations found."}
                                        {error && (
                                            <button
                                                type="submit"
                                                className="ml-2 min-h-11 underline underline-offset-4 focus-visible:outline-2"
                                            >
                                                Try again
                                            </button>
                                        )}
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
                    className={`text-12 absolute inset-x-0 top-full mt-4 flex flex-wrap justify-center gap-x-6 gap-y-1 leading-4 ${showSuggestions || !open ? "invisible" : ""}`}
                    aria-label="Suggested destinations"
                    inert={showSuggestions || !open}
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
                                if (!leaving) onNavigate(destinationPageHref(destination), destination.name);
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
