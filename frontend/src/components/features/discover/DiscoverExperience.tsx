"use client";

import {
    useEffect,
    useCallback,
    useRef,
    useState,
    useSyncExternalStore,
    type MouseEvent,
    type ReactNode
} from "react";
import { motion, useMotionValue } from "motion/react";
import AppShell from "@/components/layout/AppShell";
import DiscoverIntroCarousel from "./DiscoverIntroCarousel";

const desktopQuery =
    "(min-width: 1024px) and (min-height: 620px) and (prefers-reduced-motion: no-preference)";
function subscribe(callback: () => void) {
    const query = window.matchMedia(desktopQuery);
    query.addEventListener("change", callback);
    return () => query.removeEventListener("change", callback);
}
const getSnapshot = () => window.matchMedia(desktopQuery).matches;
const getServerSnapshot = () => false;

type Props = {
    hero: ReactNode;
    journey: ReactNode;
    mobileJourney: readonly ReactNode[];
    children: ReactNode;
};

export default function DiscoverExperience({
    hero,
    journey,
    mobileJourney,
    children
}: Props) {
    const desktop = useSyncExternalStore(
        subscribe,
        getSnapshot,
        getServerSnapshot
    );
    const [collapsed, setCollapsed] = useState(false);
    const [dimensions, setDimensions] = useState({ travel: 0, height: 0 });
    const section = useRef<HTMLDivElement>(null);
    const intro = useRef<HTMLDivElement>(null);
    const feed = useRef<HTMLDivElement>(null);
    const handledHash = useRef("");
    const horizontal = useMotionValue(0);
    const carouselTravelled = useRef(false);
    const onCarouselTravel = useCallback((travelled: boolean) => {
        carouselTravelled.current = travelled;
        setCollapsed(window.scrollY > 48 || travelled);
    }, []);

    useEffect(() => {
        const introElement = intro.current;
        const feedElement = feed.current;
        if (!introElement || !feedElement) return;
        const measure = () =>
            setDimensions({
                travel: introElement.scrollWidth,
                height: feedElement.offsetHeight
            });
        const observer = new ResizeObserver(measure);
        observer.observe(introElement);
        observer.observe(feedElement);
        return () => observer.disconnect();
    }, [desktop]);

    useEffect(() => {
        const update = () => {
            const offset = section.current?.offsetTop ?? 0;
            const distance = Math.max(0, window.scrollY - offset);
            horizontal.set(
                desktop ? -Math.min(distance, dimensions.travel) : 0
            );
            setCollapsed(
                distance > 48 || (!desktop && carouselTravelled.current)
            );
        };
        update();
        window.addEventListener("scroll", update, { passive: true });
        return () => window.removeEventListener("scroll", update);
    }, [desktop, dimensions.travel, horizontal]);

    useEffect(() => {
        const state = { frame: 0 };
        const restoreHash = () => {
            const hash = window.location.hash;
            // Returning from a collection can measure the intro before its
            // desktop layout settles. Restore again when the travel changes.
            const signature = `${hash}:${desktop}:${dimensions.travel}`;
            if (
                !hash ||
                handledHash.current === signature ||
                (desktop && !dimensions.travel)
            )
                return;
            const target = document.getElementById(hash.slice(1));
            const feedElement = feed.current;
            if (!target || !feedElement?.contains(target)) return;
            handledHash.current = signature;
            state.frame = requestAnimationFrame(() => {
                const withinFeed =
                    target.getBoundingClientRect().top -
                    feedElement.getBoundingClientRect().top;
                const top = desktop
                    ? (section.current?.offsetTop ?? 0) +
                      dimensions.travel +
                      withinFeed -
                      24
                    : window.scrollY + target.getBoundingClientRect().top - 24;
                horizontal.set(desktop ? -dimensions.travel : 0);
                window.scrollTo({ top, behavior: "instant" });
            });
        };
        const onHashChange = () => {
            handledHash.current = "";
            restoreHash();
        };
        restoreHash();
        window.addEventListener("hashchange", onHashChange);
        return () => {
            cancelAnimationFrame(state.frame);
            window.removeEventListener("hashchange", onHashChange);
        };
    }, [desktop, dimensions.travel, horizontal]);

    function revealFeed(event?: MouseEvent) {
        event?.preventDefault();
        const top = desktop
            ? (section.current?.offsetTop ?? 0) + dimensions.travel
            : (feed.current?.getBoundingClientRect().top ?? 0) + window.scrollY;
        horizontal.set(desktop ? -dimensions.travel : 0);
        window.scrollTo({ top, behavior: "instant" });
        document
            .getElementById("discover-feed")
            ?.focus({ preventScroll: true });
    }

    function handleAnchor(event: MouseEvent<HTMLDivElement>) {
        const target = event.target;
        if (
            target instanceof Element &&
            target.closest('a[href="#discover-feed"]')
        )
            revealFeed(event);
    }

    return (
        <AppShell activeHref="/discover" discover={{ collapsed }}>
            <a
                href="#discover-feed"
                onClick={revealFeed}
                className="bg-background fixed top-3 left-24 z-50 -translate-y-32 border px-4 py-3 focus:translate-y-0"
            >
                Skip to discovery
            </a>
            <div
                className="w-full min-w-0 pl-20 [--panel-width:calc(100vw-5rem)] md:pl-32 md:[--panel-width:calc(100vw-8rem)]"
                onClickCapture={handleAnchor}
            >
                <div
                    ref={section}
                    style={
                        desktop && dimensions.height
                            ? { height: dimensions.height + dimensions.travel }
                            : undefined
                    }
                >
                    {/* The tall sticky track releases after horizontal travel. The feed then
                        scrolls naturally with the document: no wheel interception or duplicate feed. */}
                    <div
                        className={
                            desktop
                                ? "sticky top-0 w-[var(--panel-width)] overflow-clip"
                                : ""
                        }
                    >
                        <motion.div
                            style={{ x: horizontal }}
                            className={desktop ? "flex w-max items-start" : ""}
                        >
                            {desktop ? (
                                <div
                                    ref={intro}
                                    role="region"
                                    aria-label="Discover introduction and photo sequence"
                                    tabIndex={-1}
                                    className="flex w-max shrink-0"
                                >
                                    {hero}
                                    {journey}
                                </div>
                            ) : (
                                <DiscoverIntroCarousel
                                    hero={hero}
                                    journey={mobileJourney}
                                    onTravel={onCarouselTravel}
                                />
                            )}
                            <div
                                ref={feed}
                                onFocusCapture={() => {
                                    if (
                                        desktop &&
                                        window.scrollY < dimensions.travel
                                    )
                                        revealFeed();
                                }}
                            >
                                {children}
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
            {!collapsed && (
                <p className="bg-background/90 text-12 pointer-events-none fixed right-5 bottom-4 z-20 px-3 py-2">
                    {desktop
                        ? "Scroll to discover →"
                        : "Swipe to explore → · scroll for discoveries ↓"}
                </p>
            )}
        </AppShell>
    );
}
