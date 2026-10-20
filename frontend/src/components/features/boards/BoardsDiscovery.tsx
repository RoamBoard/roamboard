"use client";

import GeographicFilters, { geographicQuery } from "./GeographicFilters";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore, type SetStateAction } from "react";
import { ArrowUpRight, Search, X } from "lucide-react";
import { observeCurrentUser, type AuthUser } from "@/lib/auth";
import {
    boardsSearchHref,
    createDiscoveryStore,
    discoveryGallery,
    discoveryPhoto,
    type DiscoveryCard,
    type DiscoveryState
} from "@/lib/boards-discovery";
import Pagination from "@/components/ui/Pagination";
import { collectionHref } from "@/lib/board-collections";
import SpatialGallery from "./SpatialGallery";
import BoardLibrary from "./BoardLibrary";
import PhotoBoardCard from "./cards/PhotoBoardCard";
import AccountPhotoBoardCard from "./cards/AccountPhotoBoardCard";

const action =
    "min-h-11 cursor-pointer px-3 py-3 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-50";

function useDiscovery(path: string | null, delay = 0, viewerKey = "visitor") {
    // Scope result state to the viewer without remounting the input that owns the draft query and focus.
    const { store } = useMemo(() => ({ viewerKey, store: createDiscoveryStore() }), [viewerKey]);
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    useEffect(() => {
        if (!path) {
            store.cancel();
            return;
        }
        const timer = setTimeout(() => {
            void store.load(path);
        }, delay);
        return () => {
            clearTimeout(timer);
            store.cancel();
        };
    }, [store, path, delay]);
    useEffect(() => {
        if (!path) return;
        const refresh = () => {
            void store.load(path);
        };
        window.addEventListener("focus", refresh);
        return () => window.removeEventListener("focus", refresh);
    }, [store, path]);
    return { state, store };
}

export default function BoardsDiscovery() {
    const params = useSearchParams();
    const [account, setAccount] = useState<{ ready: boolean; user: AuthUser | null }>({ ready: false, user: null });
    useEffect(() => observeCurrentUser((user) => setAccount({ ready: true, user })), []);
    return (
        <BoardsDiscoveryContent
            query={params.get("q")?.trim().slice(0, 100) ?? ""}
            page={Math.max(1, Math.min(10000, Math.floor(Number(params.get("page"))) || 1))}
            location={params.get("location") === "off" ? "off" : "auto"}
            geography={geographicQuery(params)}
            account={account}
        />
    );
}

export function BoardsDiscoveryContent({
    query,
    page,
    location,
    account,
    geography = ""
}: {
    geography?: string;
    query: string;
    page: number;
    location: "auto" | "off";
    account: { ready: boolean; user: AuthUser | null };
}) {
    const fullSearch = query.length >= 2 || Boolean(geography);
    // Pending identification is not a signed-out viewer: its cookie-bearing reads may still contain private results.
    const viewerKey = account.ready ? (account.user?.userId ?? "visitor") : "pending";
    return (
        <article className="font-body min-w-0 overflow-x-clip pb-24">
            <header className="mx-auto max-w-5xl px-5 pt-16 pb-10 text-center md:pt-24 md:pb-12">
                <h1 className="font-display text-[clamp(3rem,7vw,7rem)] leading-none font-bold tracking-[-.045em]">
                    BOARDS
                </h1>
                <p className="text-muted-foreground mx-auto mt-5 max-w-lg text-sm">
                    Find your next adventure in Boards shared by the community.
                </p>
                <BoardSearch
                    key={`${query}:${location}`}
                    geography={geography}
                    initialQuery={query}
                    location={location}
                    viewerKey={viewerKey}
                />
            </header>
            {fullSearch ? (
                <SearchResults key={viewerKey} query={query} page={page} location={location} geography={geography} />
            ) : (
                <Fragment key={viewerKey}>
                    <Featured period="month" />

                    <DiscoveryCollection title="RECENTLY PUBLISHED" id="recent" path="/boards/recent" limit={20} />
                    {account.ready && account.user ? (
                        <>
                            <DiscoveryCollection
                                title="MY BOARDS"
                                id="mine"
                                path="/boards/mine"
                                limit={10}
                                source="owned"
                            />
                            <DiscoveryCollection
                                title="SAVED BOARDS"
                                id="saved"
                                path="/boards/saved"
                                limit={10}
                                source="saved"
                            />
                        </>
                    ) : account.ready ? (
                        <section className="mx-auto mt-24 max-w-xl px-5 text-center">
                            <h2 className="font-display text-30 font-bold">Your next journeys, all together</h2>
                            <p className="text-muted-foreground mt-4 text-sm">
                                Sign in to find My Boards and Saved Boards here.
                            </p>
                            <Link href="/login?returnTo=%2Fboards" className={`mt-4 inline-block ${action}`}>
                                Sign in
                            </Link>
                        </section>
                    ) : (
                        <p role="status" className="mt-16 text-center text-sm">
                            Loading your account…
                        </p>
                    )}
                    <section
                        aria-labelledby="boards-discover-heading"
                        className="mx-auto my-24 flex max-w-5xl flex-col items-center px-5 text-center sm:my-40"
                    >
                        <span aria-hidden="true" className="bg-line h-20 w-px" />
                        <p className="text-muted-foreground mt-8 text-lg">need more inspiration?</p>
                        <h2
                            id="boards-discover-heading"
                            className="font-display mt-4 text-[clamp(2.75rem,7vw,6rem)] leading-none font-bold"
                        >
                            <Link href="/discover" className="inline-flex items-start gap-2">
                                DISCOVER <ArrowUpRight className="mt-2 size-6" aria-hidden="true" />
                            </Link>
                        </h2>
                    </section>
                </Fragment>
            )}
        </article>
    );
}

function BoardSearch({
    initialQuery,
    location,
    viewerKey,
    geography
}: {
    geography: string;
    initialQuery: string;
    location: "auto" | "off";
    viewerKey: string;
}) {
    const router = useRouter();
    const [query, setQuery] = useState(initialQuery);
    const [open, setOpen] = useState(false);
    const [locationMode, setLocationMode] = useState(location);
    const path =
        query.trim().length >= 2
            ? `/boards/search/suggestions?${new URLSearchParams({ q: query.trim(), location: locationMode })}&${geography}`
            : null;
    const { state, store } = useDiscovery(path, 220, viewerKey);
    // A new viewer's results require a new explicit selection, even after switching back to a previous account.
    const [highlight, setHighlight] = useState({ store, index: -1 });
    const active = highlight.store === store ? highlight.index : -1;
    function setActive(value: SetStateAction<number>) {
        setHighlight((previous) => ({
            store,
            index: typeof value === "function" ? value(previous.store === store ? previous.index : -1) : value
        }));
    }
    const current = state.key === path;
    const items = current ? (state.data?.items ?? []) : [];
    const interpreted = current ? state.data?.location : null;
    const submit = () => {
        if (query.trim().length >= 2) {
            setOpen(false);
            router.push(boardsSearchHref(query, 1, locationMode, geography));
        }
    };
    return (
        <div className="relative z-40 mx-auto mt-10 max-w-xl text-left">
            <form
                role="search"
                onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                }}
                onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
                }}
            >
                <div className="border-line focus-within:border-foreground flex items-center border-b">
                    <Search size={18} aria-hidden="true" className="shrink-0" />
                    <label htmlFor="boards-search" className="sr-only">
                        Search Boards by destination, title or tags
                    </label>
                    <input
                        id="boards-search"
                        type="text"
                        role="combobox"
                        aria-autocomplete="list"
                        autoComplete="off"
                        aria-expanded={open && Boolean(path)}
                        aria-controls="board-suggestions"
                        aria-activedescendant={
                            open && active >= 0 && items[active]
                                ? `board-suggestion-${items[active].boardId}`
                                : undefined
                        }
                        value={query}
                        maxLength={100}
                        placeholder="a destination, an idea, an adventure…"
                        className="min-h-16 min-w-0 flex-1 bg-transparent px-4 text-sm outline-none sm:text-base"
                        onFocus={() => setOpen(true)}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            if (!event.target.value.trim() && initialQuery)
                                router.replace(geography ? `/boards?${geography}` : "/boards", { scroll: false });
                            setActive(-1);
                            setOpen(true);
                            setLocationMode("auto");
                        }}
                        onKeyDown={(event) => {
                            if (event.key === "Escape") {
                                setOpen(false);
                                setActive(-1);
                            }
                            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                                event.preventDefault();
                                setOpen(true);
                                setActive((value) =>
                                    items.length
                                        ? value < 0
                                            ? event.key === "ArrowDown"
                                                ? 0
                                                : items.length - 1
                                            : (value + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
                                              items.length
                                        : -1
                                );
                            }
                            if (event.key === "Enter" && open && active >= 0 && items[active]) {
                                event.preventDefault();
                                router.push(`/boards/${items[active].boardId}`);
                            }
                        }}
                    />
                    {query && (
                        <button
                            type="button"
                            aria-label="Clear search"
                            className={action}
                            onClick={() => {
                                setQuery("");
                                setOpen(false);
                                setActive(-1);
                                if (initialQuery) router.push(geography ? `/boards?${geography}` : "/boards");
                            }}
                        >
                            <X size={16} />
                        </button>
                    )}
                    <button type="submit" className={action}>
                        Search
                    </button>
                </div>
                {interpreted && (
                    <button
                        type="button"
                        className="text-muted-foreground mt-3 inline-flex min-h-11 items-center gap-2 text-xs"
                        aria-label={`Remove location filter: ${interpreted.label}`}
                        onClick={() => {
                            setLocationMode("off");
                            setActive(-1);
                            setOpen(true);
                        }}
                    >
                        Location: {interpreted.label} <X size={12} aria-hidden="true" />
                    </button>
                )}
                {open && path && (
                    <div className="bg-background border-line absolute right-0 left-0 z-50 mt-2 border p-2 shadow-xl">
                        {(!current || state.loading) && (
                            <p role="status" className="p-4 text-sm">
                                Searching Boards…
                            </p>
                        )}
                        {current && state.error && (
                            <p role="alert" className="p-4 text-sm">
                                {state.error}{" "}
                                <button type="button" className={action} onClick={() => void store.load(path)}>
                                    Retry
                                </button>
                            </p>
                        )}
                        {current && !state.loading && !state.error && items.length === 0 && (
                            <p role="status" className="p-4 text-sm">
                                No matching Boards yet.
                            </p>
                        )}
                        <ul id="board-suggestions" role="listbox" aria-label="Suggested Boards">
                            {items.map((board, index) => (
                                <li key={board.boardId} role="presentation" className="group relative">
                                    <Link
                                        id={`board-suggestion-${board.boardId}`}
                                        href={`/boards/${board.boardId}`}
                                        role="option"
                                        aria-selected={active === index}
                                        onFocus={() => setActive(index)}
                                        onMouseEnter={() => setActive(index)}
                                        className={`block px-4 py-3 outline-offset-[-2px] ${active === index ? "bg-faint" : "hover:bg-faint"}`}
                                    >
                                        <span className="block text-sm font-bold">{board.title}</span>
                                        <span className="text-muted-foreground mt-1 block text-xs">
                                            @{board.owner.username} ·{" "}
                                            {discoveryPhoto(board).destination || "Destination unavailable"}
                                        </span>
                                    </Link>
                                    <div
                                        aria-hidden="true"
                                        inert
                                        className={`pointer-events-none absolute top-full right-0 z-50 w-40 group-focus-within:block group-hover:block xl:top-0 xl:right-auto xl:left-full xl:ml-3 xl:w-52 [@media(hover:none)]:!hidden ${active === index ? "block" : "hidden"}`}
                                    >
                                        <PhotoBoardCard
                                            board={discoveryPhoto(board)}
                                            presentation="details"
                                            ownership="unknown"
                                            hideCoverCredit
                                            reduceMotion
                                        />
                                    </div>
                                </li>
                            ))}
                        </ul>
                        <button type="button" className={`w-full text-left text-sm ${action}`} onClick={submit}>
                            See all results for “{query.trim()}”
                        </button>
                    </div>
                )}
            </form>
            <div className="mt-4">
                <GeographicFilters />
            </div>
        </div>
    );
}

function Feedback({ state, retry }: { state: DiscoveryState; retry: () => void }) {
    return (
        <>
            {state.loading && (
                <p role="status" className="py-10 text-center text-sm">
                    Loading Boards…
                </p>
            )}
            {state.error && (
                <div role="alert" className="mx-auto max-w-xl px-5 py-8 text-center text-sm">
                    {state.error}{" "}
                    <button type="button" className={action} onClick={retry}>
                        Retry
                    </button>
                </div>
            )}
            {!state.loading && !state.error && state.data?.items.length === 0 && (
                <p role="status" className="text-muted-foreground px-5 py-16 text-center text-sm">
                    No Boards here yet.
                </p>
            )}
        </>
    );
}

function Featured({ period }: { period: "month" | "week" }) {
    const path = `/boards/featured?period=${period}`;
    const { state, store } = useDiscovery(path);
    return (
        <div>
            {!state.data?.items.length && (
                <div className="mt-10 text-center">
                    <h2 className="font-display text-foreground text-30 font-bold">FEATURED BOARDS</h2>
                    <p className="text-muted-foreground mt-2 text-sm">{"Roamboard's monthly most popular boards"}</p>
                </div>
            )}
            <Feedback state={state} retry={() => void store.load(path)} />
            {state.data && (
                <SpatialGallery
                    description="Roamboard's monthly most popular boards"
                    boards={state.data.items.map(discoveryGallery)}
                    viewAllHref={collectionHref("featured", { period })}
                />
            )}
        </div>
    );
}

type DiscoveryCollectionProps = {
    title: string;
    id: string;
    path: string;
    limit: number;
    source?: "owned" | "saved" | "shared";
};

function DiscoveryCollection(props: DiscoveryCollectionProps) {
    const { state, store } = useDiscovery(`${props.path}?page=1&limit=${props.limit}`);
    return <DiscoveryCollectionContent {...props} state={state} store={store} />;
}

export function DiscoveryCollectionContent({
    title,
    id,
    path,
    limit,
    source = "shared",
    state,
    store
}: DiscoveryCollectionProps & {
    state: DiscoveryState;
    store: ReturnType<typeof createDiscoveryStore>;
}) {
    const gallery = useRef<HTMLDivElement>(null);
    const retry = () => {
        const retryPath = state.key || `${path}?page=1&limit=${limit}`;
        const append = Number(new URL(retryPath, "http://roamboard.local").searchParams.get("page")) > 1;
        void store.load(retryPath, append, true);
    };
    return (
        <section aria-label={title} className="mt-24 min-w-0">
            <div ref={gallery}>
                <BoardLibrary
                    id={id}
                    viewAllHref={collectionHref(source === "owned" ? "mine" : source === "saved" ? "saved" : "recent")}
                    title={title}
                    description={
                        source === "owned"
                            ? "Your drafts and published Boards"
                            : source === "saved"
                              ? "Your saved Boards"
                              : undefined
                    }
                    boards={(state.data?.items ?? []).map(discoveryGallery)}
                    removeOnUnsave={source === "saved"}
                    hasMore={Boolean(state.data?.hasMore && !state.error)}
                    loadingMore={state.loading}
                    onLoadMore={() => store.load(`${path}?page=${(state.data?.page ?? 1) + 1}&limit=${limit}`, true)}
                    onSavedChange={
                        source === "saved"
                            ? (boardId, saved) => {
                                  if (saved) return;
                                  store.removeConfirmed(Number(boardId));
                                  if (store.getSnapshot().data?.items.length)
                                      gallery.current
                                          ?.querySelector<HTMLElement>('[role="region"]')
                                          ?.focus({ preventScroll: true });
                                  else document.getElementById(`${id}-heading`)?.focus({ preventScroll: true });
                                  void store.load(`${path}?page=1&limit=${limit}`, false, true);
                              }
                            : undefined
                    }
                />
            </div>
            <Feedback state={state} retry={retry} />
            {state.data?.hasMore && (
                <div className="mt-8 text-center">
                    <button
                        type="button"
                        className={action}
                        disabled={state.loading}
                        onClick={() =>
                            void store.load(`${path}?page=${(state.data?.page ?? 1) + 1}&limit=${limit}`, true)
                        }
                    >
                        Load more
                    </button>
                </div>
            )}
        </section>
    );
}

function SearchResults({
    query,
    page,
    location,
    geography
}: {
    query: string;
    page: number;
    location: "auto" | "off";
    geography: string;
}) {
    const path = `/boards/search?${new URLSearchParams({ q: query, page: String(page), limit: "20", location })}&${geography}`;
    const { state, store } = useDiscovery(path);
    const total = state.data?.total ?? 0;
    return (
        <section aria-labelledby="search-results-heading" className="mx-auto mt-16 max-w-[1320px] px-5">
            <h2 id="search-results-heading" className="font-display text-30 text-center font-bold">
                {query ? `Results for "${query}"` : "Filtered Boards"}
            </h2>
            {state.data && (
                <p role="status" className="text-muted-foreground mt-3 text-center text-sm">
                    {total} matching {total === 1 ? "Board" : "Boards"}
                </p>
            )}
            <Feedback state={state} retry={() => void store.load(path)} />
            <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
                {state.data?.items.map((board: DiscoveryCard) => (
                    <div key={board.boardId} className="mx-auto w-full max-w-72">
                        <AccountPhotoBoardCard
                            board={discoveryPhoto(board)}
                            ownership={board.permissions.canManageBoard ? "owner" : "other"}
                            initialSaved={board.savedByMe}
                            href={`/boards/${board.boardId}`}
                            hoverActions={{
                                viewHref: `/boards/${board.boardId}`,
                                editHref: board.permissions.canEditContent ? `/boards/${board.boardId}/edit` : undefined
                            }}
                            showVisibility
                            hideCoverCredit
                        />
                        <p className="text-muted-foreground mt-3 text-xs">
                            @{board.owner.username} · {discoveryPhoto(board).destination}
                        </p>
                    </div>
                ))}
            </div>
            {state.data && (
                <Pagination
                    page={page}
                    totalPages={Math.ceil(total / 20)}
                    href={(next) => boardsSearchHref(query, next, location, geography)}
                />
            )}
            <div className="mt-10 text-center">
                <Link href="/boards" className={action}>
                    Clear search and explore Boards
                </Link>
            </div>
        </section>
    );
}
