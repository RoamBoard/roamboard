"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, Search } from "lucide-react";
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from "motion/react";
import { destinationPages, destinationPageHref } from "@/data/destination-atlas";
import { destinationSearchHref } from "@/lib/destination-search";
import { destinationTransition } from "@/lib/destination-transition";
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
                    setResults(places.slice(0, 3));
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
            await controls.start({
                opacity: 0,
                y: -destinationTransition.distance,
                transition: { duration: destinationTransition.duration, ease: destinationTransition.exitEase }
            });
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
            if (query.trim().length < 2) setError("Enter a destination name.");
        }
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
                        className="text-foreground/90 hover:text-foreground transition-colors focus-visible:outline-1 focus-visible:outline-offset-4 motion-reduce:transition-none"
                    >
                        ROAM
                    </Link>
                    <Link
                        href="/boards"
                        aria-label="Board: view your Boards"
                        className="text-foreground/90 hover:text-foreground transition-colors focus-visible:outline-1 focus-visible:outline-offset-4 motion-reduce:transition-none"
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
                        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
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
