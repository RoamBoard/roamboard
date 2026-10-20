"use client";

import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { destinationGuideHref } from "@/lib/destination-guides";
import { ArrowRight } from "lucide-react";
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from "motion/react";
import { destinationPages, destinationPageHref } from "@/data/destination-atlas";
import { resolveDestinationSearchHref } from "@/lib/destination-search";
import { useDestinationTransition } from "./DestinationTransitionProvider";
import RoamWorld from "./RoamWorld";
import { createRoamPromptStore, ROAM_PROMPT } from "@/lib/roam-prompt";
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
    const [prompt] = useState(createRoamPromptStore);
    const state = useSyncExternalStore(actions.subscribe, actions.getSnapshot, actions.getSnapshot);
    const promptText = useSyncExternalStore(prompt.subscribe, prompt.getSnapshot, prompt.getSnapshot);

    useEffect(() => {
        const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
        const update = () => {
            if (document.hidden) prompt.dispose();
            else prompt.start({ reducedMotion: preference.matches });
        };
        update();
        document.addEventListener("visibilitychange", update);
        preference.addEventListener("change", update);
        return () => {
            prompt.dispose();
            document.removeEventListener("visibilitychange", update);
            preference.removeEventListener("change", update);
        };
    }, [prompt]);

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
            promptText={promptText}
            onEngage={() => prompt.yield()}
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
    promptText?: string;
    onEngage?: () => void;
};

export function DestinationExplorerContent({
    state,
    actions,
    leaving,
    reduced,
    controls,
    onNavigate,
    promptText = ROAM_PROMPT,
    onEngage
}: DestinationExplorerContentProps) {
    const { query, results, active, open, loading, searched, error } = state;
    const showSuggestions = open && query.trim().length >= 2;

    function choose(destination: Destination) {
        if (leaving) return;
        // City results keep their exact identity in the dynamic guide URL.
        const guideHref = destinationGuideHref(destination);
        onNavigate(
            guideHref ?? ((signal) => resolveDestinationSearchHref(destination, query, results, signal)),
            destination.name
        );
    }

    function submit(event: FormEvent) {
        event.preventDefault();
        if (leaving) return;
        const selected = actions.submit();
        if (selected) choose(selected);
    }

    return (
        <section
            className="font-body relative isolate grid min-h-dvh min-w-0 place-items-center overflow-hidden px-5 md:px-10"
            aria-label="Roamboard"
        >
            <RoamWorld typing={Boolean(query.trim())} leaving={leaving} reduced={reduced} />
            <motion.div
                animate={controls}
                className="relative z-10 w-full max-w-[550px]"
                inert={leaving}
                onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) actions.setOpen(false);
                }}
            >
                <h1 className="sr-only">Roamboard — find your destination</h1>
                <form role="search" aria-label="Destination search" onSubmit={submit} className="relative">
                    <motion.div
                        className="group relative mx-auto flex min-h-20 w-fit max-w-full items-center"
                        initial={false}
                        animate="rest"
                        whileHover={reduced ? undefined : "approach"}
                    >
                        <label htmlFor="destination-search" className="sr-only">
                            Search destinations
                        </label>
                        <span
                            aria-hidden="true"
                            className="text-16 max-[360px]:text-14 md:text-20 pointer-events-none invisible block whitespace-nowrap select-none"
                        >
                            {ROAM_PROMPT}
                        </span>
                        <motion.input
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
                            placeholder={ROAM_PROMPT}
                            initial={false}
                            whileHover={reduced ? undefined : { letterSpacing: "0.015em" }}
                            animate={{ letterSpacing: !reduced && open ? "0.008em" : "0em" }}
                            transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 180, damping: 28 }}
                            className={`text-16 max-[360px]:text-14 md:text-20 focus-visible:outline-foreground/20 absolute inset-0 w-full min-w-0 cursor-text rounded-sm bg-transparent py-7 text-left outline-none placeholder:text-transparent focus-visible:outline-1 focus-visible:-outline-offset-4 ${query ? "caret-foreground pr-7" : "caret-transparent"}`}
                            onPointerDown={onEngage}
                            onFocus={() => {
                                onEngage?.();
                                actions.setOpen(true);
                            }}
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
                        {!query && (
                            <div
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-0 flex items-center justify-start"
                            >
                                <motion.span
                                    className={`text-16 max-[360px]:text-14 md:text-20 relative inline-flex items-center whitespace-nowrap transition-colors duration-300 motion-reduce:transition-none ${
                                        open
                                            ? "text-muted-foreground/40"
                                            : "text-muted-foreground/80 group-hover:text-foreground"
                                    }`}
                                    variants={{
                                        rest: { letterSpacing: "0em", y: 0 },
                                        approach: { letterSpacing: open ? "0.008em" : "0.015em", y: open ? 0 : -1 }
                                    }}
                                    animate={!reduced && open ? { letterSpacing: "0.008em", y: 0 } : undefined}
                                    transition={{ type: "spring", stiffness: 180, damping: 28 }}
                                >
                                    <span className="invisible">{ROAM_PROMPT}</span>
                                    <span className="absolute inset-0 flex items-center text-left">
                                        <span className="relative inline-flex items-center">
                                            <span>{promptText}</span>
                                            <motion.span
                                                initial={false}
                                                animate={{
                                                    left: open ? "0%" : "100%",
                                                    x: open ? -6 : 2,
                                                    opacity:
                                                        reduced || (!open && promptText.length < ROAM_PROMPT.length)
                                                            ? 0.85
                                                            : [1, 0.15, 1]
                                                }}
                                                transition={{
                                                    left: reduced
                                                        ? { duration: 0 }
                                                        : { type: "spring", stiffness: 260, damping: 28 },
                                                    x: reduced
                                                        ? { duration: 0 }
                                                        : { type: "spring", stiffness: 260, damping: 28 },
                                                    opacity:
                                                        reduced || (!open && promptText.length < ROAM_PROMPT.length)
                                                            ? { duration: 0 }
                                                            : { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
                                                }}
                                                className={`absolute top-1/2 h-[1.15em] w-[1.5px] -translate-y-1/2 transition-colors duration-300 ${
                                                    open
                                                        ? "bg-foreground"
                                                        : "bg-muted-foreground/75 group-hover:bg-foreground"
                                                }`}
                                            />
                                        </span>
                                    </span>
                                </motion.span>
                            </div>
                        )}
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center"
                        >
                            <div className="bg-line/70 group-hover:bg-foreground/35 relative h-px w-full overflow-hidden transition-colors duration-300">
                                <motion.span
                                    initial={false}
                                    animate={{
                                        scaleX: open || Boolean(query) ? 1 : 0,
                                        opacity: open || Boolean(query) ? 1 : 0
                                    }}
                                    transition={{ duration: reduced ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
                                    className="bg-foreground absolute inset-0 block origin-left"
                                />
                            </div>
                        </div>
                        {query.trim() ? (
                            <button
                                type="submit"
                                aria-label="Explore selected destination"
                                disabled={loading || leaving}
                                className="text-muted-foreground hover:text-foreground focus-visible:outline-foreground absolute -right-8 grid size-11 place-items-center focus-visible:outline-2 disabled:opacity-40"
                            >
                                <ArrowRight size={16} strokeWidth={1.2} aria-hidden="true" />
                            </button>
                        ) : null}
                    </motion.div>
                    <AnimatePresence>
                        {showSuggestions && (
                            <motion.div
                                initial={{ opacity: 0, y: reduced ? 0 : -3 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: reduced ? 0 : 0.16 }}
                                className="absolute inset-x-0 top-full z-20 pt-3 pb-4"
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
                                    <p className="text-muted-foreground text-12 px-2 py-3 text-center leading-4">
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
                <motion.nav
                    initial={false}
                    animate={promptText === ROAM_PROMPT || open ? "visible" : "hidden"}
                    className={`text-12 absolute inset-x-0 top-full mt-6 text-center leading-4 ${showSuggestions ? "invisible" : ""}`}
                    aria-label="Suggested destinations"
                    inert={showSuggestions || (promptText !== ROAM_PROMPT && !open)}
                >
                    <div className="flex flex-wrap justify-center gap-x-6 gap-y-1">
                        {destinationPages.map((destination, index) => (
                            <motion.div
                                key={destination.slug}
                                className="relative"
                                variants={{ hidden: { opacity: 0, y: reduced ? 0 : 5 }, visible: { opacity: 1, y: 0 } }}
                                transition={{
                                    duration: reduced ? 0 : [0.58, 0.76, 0.64][index],
                                    delay: reduced ? 0 : [0.04, 0.22, 0.49][index],
                                    ease: [0.22, 1, 0.36, 1]
                                }}
                            >
                                {index > 0 && (
                                    <span
                                        aria-hidden="true"
                                        className="text-muted-foreground/50 absolute top-1/2 -left-3 -translate-y-1/2"
                                    >
                                        ·
                                    </span>
                                )}
                                <Link
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
                                    className="group text-muted-foreground hover:text-foreground focus-visible:outline-foreground/40 relative inline-flex min-h-11 items-center rounded-sm transition-colors duration-300 focus-visible:outline-1 focus-visible:outline-offset-4 motion-reduce:transition-none"
                                >
                                    <span className="transition-transform duration-500 ease-out group-hover:-translate-x-1 group-focus-visible:-translate-x-1 group-active:translate-x-0 motion-reduce:transform-none motion-reduce:transition-none">
                                        {destination.name}
                                    </span>
                                    <ArrowRight
                                        size={11}
                                        strokeWidth={1}
                                        aria-hidden="true"
                                        className="absolute -right-3 translate-x-0 opacity-0 transition-all duration-500 group-hover:translate-x-1 group-hover:opacity-100 group-focus-visible:translate-x-1 group-focus-visible:opacity-100 motion-reduce:transform-none motion-reduce:transition-none"
                                    />
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                </motion.nav>
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
