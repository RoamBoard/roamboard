"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from "motion/react";
import { destinationPages, destinationPageHref } from "@/data/destination-atlas";
import { destinationSearchHref } from "@/lib/destination-search";
import { searchDestinations, type Destination } from "@/lib/destinations";

export default function DestinationExplorer() {
    const router = useRouter();
    const reduced = useReducedMotion();
    const controls = useAnimationControls();
    const navigating = useRef(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<Destination[]>([]);
    const [active, setActive] = useState(-1);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [leaving, setLeaving] = useState(false);
    const [error, setError] = useState("");
    const showSuggestions = open && query.trim().length >= 2;

    useEffect(() => {
        if (query.trim().length < 2) return;
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            void searchDestinations(query.trim(), controller.signal)
                .then((places) => {
                    if (controller.signal.aborted) return;
                    setResults(places);
                    setActive(places.length ? 0 : -1);
                    setSearched(true);
                })
                .catch((caught: unknown) => {
                    if (!controller.signal.aborted)
                        setError(caught instanceof Error ? caught.message : "Search is unavailable. Please try again.");
                })
                .finally(() => {
                    if (!controller.signal.aborted) setLoading(false);
                });
        }, 300);
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [query]);

    async function navigate(href: string) {
        if (navigating.current) return;
        navigating.current = true;
        setLeaving(true);
        setOpen(false);
        router.prefetch(href);
        if (!reduced)
            await controls.start({ opacity: 0, y: -6, transition: { duration: 0.32, ease: [0.4, 0, 0.8, 1] } });
        router.push(href);
    }

    function choose(destination: Destination) {
        void navigate(destinationSearchHref(destination));
    }

    function submit(event: FormEvent) {
        event.preventDefault();
        if (leaving) return;
        if (!loading && results[active]) choose(results[active]);
        else {
            setOpen(true);
            if (query.trim().length < 2) setError("Enter a city name.");
        }
    }

    return (
        <section
            className="flex min-h-dvh items-center justify-center px-6 py-24 sm:px-10"
            aria-label="Destination discovery"
        >
            <h1 className="sr-only">Find a destination</h1>
            <motion.div animate={controls} className="w-full max-w-sm -translate-y-8" inert={leaving}>
                <form
                    onSubmit={submit}
                    className="relative"
                    onBlur={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
                    }}
                >
                    <div className="group relative">
                        <label htmlFor="destination-search" className="sr-only">
                            Search cities
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
                            spellCheck={false}
                            value={query}
                            placeholder="where would you like to go?"
                            className="placeholder:text-muted-foreground hover:border-line focus:border-line w-full border-b border-transparent bg-transparent px-11 py-4 text-center text-base transition-colors outline-none placeholder:text-sm"
                            onFocus={() => setOpen(true)}
                            onChange={(event) => {
                                const value = event.target.value;
                                setQuery(value);
                                setResults([]);
                                setActive(-1);
                                setSearched(false);
                                setError("");
                                setLoading(value.trim().length >= 2);
                                setOpen(true);
                            }}
                            onKeyDown={(event) => {
                                if (event.key === "Escape") {
                                    setOpen(false);
                                    return;
                                }
                                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                                    event.preventDefault();
                                    setOpen(true);
                                    if (results.length)
                                        setActive(
                                            (index) =>
                                                (index + (event.key === "ArrowDown" ? 1 : -1) + results.length) %
                                                results.length
                                        );
                                }
                            }}
                        />
                        {query.trim() && (
                            <button
                                type="submit"
                                aria-label="Explore selected city"
                                disabled={loading || leaving}
                                className="text-muted-foreground hover:text-foreground focus-visible:outline-foreground absolute top-1/2 right-0 grid size-11 -translate-y-1/2 place-items-center focus-visible:outline-2 disabled:opacity-40"
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
                                <ul id="destination-suggestions" role="listbox" aria-label="Cities" aria-busy={loading}>
                                    {results.map((destination, index) => (
                                        <li
                                            key={destination.id}
                                            id={`destination-option-${index}`}
                                            role="option"
                                            aria-selected={active === index}
                                        >
                                            <button
                                                type="button"
                                                tabIndex={-1}
                                                onMouseDown={(event) => event.preventDefault()}
                                                onClick={() => choose(destination)}
                                                className="group flex min-h-11 w-full items-baseline justify-between gap-4 px-2 py-3 text-left focus-visible:outline-2"
                                            >
                                                <span
                                                    className={`text-sm underline-offset-4 group-hover:underline ${active === index ? "underline" : ""}`}
                                                >
                                                    {destination.name}
                                                </span>
                                                <span className="text-muted-foreground text-xs">
                                                    {destination.country}
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                                {(error || (!loading && searched && !results.length)) && (
                                    <p role="status" className="text-muted-foreground px-2 py-3 text-xs">
                                        {error || "No cities found."}
                                    </p>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                    {error && query.trim().length < 2 && (
                        <p role="alert" className="text-muted-foreground mt-3 text-center text-xs">
                            {error}
                        </p>
                    )}
                </form>
                <nav
                    className={`mt-7 flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs ${showSuggestions ? "invisible" : ""}`}
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
                                void navigate(destinationPageHref(destination));
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
                      ? "Searching cities."
                      : searched
                        ? `${results.length} cities found.`
                        : ""}
            </p>
        </section>
    );
}
