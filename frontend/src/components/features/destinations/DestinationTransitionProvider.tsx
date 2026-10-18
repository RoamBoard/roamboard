"use client";

import {
    Suspense,
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    useSyncExternalStore,
    type ReactNode
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useReducedMotion } from "motion/react";
import { createDestinationLoadingStore } from "@/lib/destination-loading";
import DestinationLoading from "./DestinationLoading";

export type DestinationNavigationTarget = string | ((signal: AbortSignal) => Promise<string>);
type TransitionContext = {
    opening: boolean;
    href: string | null;
    open: (target: DestinationNavigationTarget, name: string) => void;
    ready: (href: string) => void;
    failed: (retry?: () => void) => void;
};
const Context = createContext<TransitionContext | null>(null);
export const useDestinationTransition = () => useContext(Context);

export default function DestinationTransitionProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const reduced = useReducedMotion();
    const [store] = useState(() => createDestinationLoadingStore());
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    const attempt = useRef<{
        target: DestinationNavigationTarget;
        name: string;
        origin: string;
        reset?: () => void;
    } | null>(null);
    const revealFrame = useRef<number | null>(null);
    const restoreSearch = useRef(false);
    const [mobile, setMobile] = useState(false);

    useEffect(() => {
        const media = window.matchMedia("(max-width: 767px)");
        const update = () => setMobile(media.matches);
        update();
        media.addEventListener("change", update);
        const interrupt = () => {
            attempt.current = null;
            store.cancel();
        };
        window.addEventListener("popstate", interrupt);
        return () => {
            media.removeEventListener("change", update);
            window.removeEventListener("popstate", interrupt);
            if (revealFrame.current !== null) cancelAnimationFrame(revealFrame.current);
            store.dispose();
        };
    }, [store]);

    useEffect(() => {
        const pending = store.getSnapshot();
        if (!pending || !attempt.current) return;
        const targetPath = pending.href?.split("?")[0];
        if (pathname !== attempt.current.origin && pathname !== targetPath) {
            attempt.current = null;
            store.cancel();
        }
    }, [pathname, store]);

    useEffect(() => {
        if (reduced) store.finishIntro();
    }, [reduced, store]);

    useEffect(() => {
        if (state || pathname !== "/home" || !restoreSearch.current) return;
        const input = document.getElementById("destination-search");
        if (input) {
            restoreSearch.current = false;
            input.focus({ preventScroll: true });
        }
    }, [pathname, state]);

    function open(target: DestinationNavigationTarget, name: string) {
        // The preference is read at activation, including changes after hydration.
        const skip = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        attempt.current = { target, name, origin: window.location.pathname };
        const pending = store.begin(name, async (signal) => (typeof target === "string" ? target : target(signal)));
        const id = store.getSnapshot()?.id;
        if (skip) store.finishIntro();
        void pending.then((href) => {
            if (href && store.getSnapshot()?.id === id) router.push(href);
        });
    }

    function cancel() {
        attempt.current = null;
        restoreSearch.current = true;
        store.cancel();
        router.replace("/home");
    }

    function retry() {
        const previous = attempt.current;
        if (!previous) return;
        previous.reset?.();
        open(previous.target, previous.name);
        router.refresh();
    }

    function revealed() {
        if (store.getSnapshot()?.phase !== "revealing") return;
        attempt.current = null;
        store.cancel();
        revealFrame.current = requestAnimationFrame(() => {
            revealFrame.current = null;
            const heading = document.querySelector<HTMLElement>("main h1");
            if (heading) {
                heading.setAttribute("tabindex", "-1");
                heading.focus({ preventScroll: true });
            }
        });
    }

    return (
        <Context.Provider
            value={{
                opening: Boolean(state),
                href: state?.href ?? null,
                open,
                ready: store.ready,
                failed: (reset) => {
                    if (attempt.current) attempt.current.reset = reset;
                    store.fail();
                }
            }}
        >
            <div inert={Boolean(state)} aria-busy={Boolean(state)}>
                {children}
            </div>
            {state && (
                <DestinationLoading
                    key={state.id}
                    state={state}
                    reduced={Boolean(reduced)}
                    mobile={mobile}
                    onCancel={cancel}
                    onRetry={retry}
                    onRevealed={revealed}
                />
            )}
        </Context.Provider>
    );
}

// Mount inside the resolved page, after its critical awaits, never in loading.tsx
// or a template (which can mount while its children still show Suspense fallbacks).
export function DestinationReady({ href }: { href?: string } = {}) {
    return (
        <Suspense fallback={null}>
            <RouteReady pageHref={href} />
        </Suspense>
    );
}

function RouteReady({ pageHref }: { pageHref?: string }) {
    const transition = useDestinationTransition();
    const ready = transition?.ready;
    const href = transition?.href;
    const pathname = usePathname();
    const searchParams = useSearchParams();
    useEffect(() => {
        ready?.(pageHref ?? `${window.location.pathname}${window.location.search}`);
    }, [ready, href, pageHref, pathname, searchParams]);
    return null;
}

export function DestinationFailed({ reset }: { reset: () => void }) {
    const failed = useDestinationTransition()?.failed;
    const notified = useRef(false);
    useEffect(() => {
        if (notified.current) return;
        notified.current = true;
        failed?.(reset);
    }, [failed, reset]);
    return null;
}
