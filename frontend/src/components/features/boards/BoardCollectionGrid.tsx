"use client";

import GeographicFilters from "./GeographicFilters";
import { toCountryCode } from "@/lib/countries";
import continentMapping from "../../../../../shared/country-continents.json";
import Link from "next/link";
import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { observeCurrentUser, type AuthUser } from "@/lib/auth";
import { createDiscoveryStore, discoveryGallery } from "@/lib/boards-discovery";
import { collectionDefaultSort, collectionTitles, type CollectionContext } from "@/lib/board-collections";
import { publicDiscoverPreviewBoards, type DiscoverBoard } from "@/data/discover-boards";
import { getBoardTag } from "@/data/board-tags";
import DiscoverBoardCard from "@/components/features/discover/DiscoverBoardCard";
import AccountPhotoBoardCard from "./cards/AccountPhotoBoardCard";
import Pagination from "@/components/ui/Pagination";
import BackLink from "@/components/ui/BackLink";

const sourceKeys = ["handle", "tag", "period", "country", "longitude", "latitude", "collection", "status"];
const sampleText = (board: DiscoverBoard) =>
    [
        board.title,
        board.description,
        board.author,
        ...board.tags.map((tag) => getBoardTag(tag)?.name ?? tag),
        ...(board.destinations ?? []).flatMap((place) => [place.country, ...(place.cities ?? [])])
    ]
        .join(" ")
        .toLowerCase();
function matchesSampleGeography(board: DiscoverBoard, params: { getAll(key: string): string[] }) {
    const codes = (board.destinations ?? []).flatMap((place) => {
        const code = toCountryCode(place.countryCode);
        return code ? [code] : [];
    });
    const selectedCountries = params.getAll("countries"),
        selectedContinents = params.getAll("continents");
    return (
        (!selectedCountries.length || codes.some((code) => selectedCountries.includes(code))) &&
        (!selectedContinents.length ||
            codes.some((code) =>
                selectedContinents.includes(
                    ((continentMapping as Record<string, string>)[code] ?? "").toLowerCase().replaceAll(" ", "-")
                )
            ))
    );
}
const sampleScore = (board: DiscoverBoard, q: string) =>
    q
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .reduce(
            (score, word) =>
                score + (board.title.toLowerCase().includes(word) ? 10 : sampleText(board).includes(word) ? 1 : 0),
            0
        );
const sorts = [
    ["relevance", "Relevance"],
    ["title-asc", "A–Z"],
    ["title-desc", "Z–A"],
    ["published-desc", "Newest published"],
    ["updated-desc", "Recently updated"],
    ["saved-count-desc", "Most saved"],
    ["saved-at-desc", "Recently saved"]
];

export default function BoardCollectionGrid({
    context,
    embedded = false,
    showDivider = true,
    category
}: {
    context: CollectionContext;
    embedded?: boolean;
    showDivider?: boolean;
    category?: { title: string; tags: readonly string[] };
}) {
    const [account, setAccount] = useState<{ ready: boolean; user: AuthUser | null }>({ ready: false, user: null });
    useEffect(
        () => (context === "samples" ? undefined : observeCurrentUser((user) => setAccount({ ready: true, user }))),
        [context]
    );
    const viewer = account.ready ? (account.user?.userId ?? "visitor") : "pending";
    const store = useMemo(() => {
        void viewer;
        return createDiscoveryStore();
    }, [viewer]);
    return (
        <BoardCollectionGridContent
            key={viewer}
            context={context}
            embedded={embedded}
            showDivider={showDivider}
            category={category}
            account={account}
            store={store}
        />
    );
}

export function BoardCollectionGridContent({
    context,
    embedded = false,
    showDivider = true,
    category,
    account,
    store
}: {
    context: CollectionContext;
    embedded?: boolean;
    showDivider?: boolean;
    category?: { title: string; tags: readonly string[] };
    account: { ready: boolean; user: AuthUser | null };
    store: ReturnType<typeof createDiscoveryStore>;
}) {
    const params = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();
    const q = params.get("q")?.trim() ?? "";
    const sort = params.get("sort") ?? collectionDefaultSort(context, q.length >= 2);
    const page = Math.max(1, Math.min(10000, Math.floor(Number(params.get("page"))) || 1));
    const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    const heading = useRef<HTMLHeadingElement>(null);
    const query = new URLSearchParams({ page: String(page), limit: "20" });
    for (const key of sourceKeys) {
        const value = params.get(key);
        if (value !== null) query.set(key, value);
    }
    if (category) {
        query.delete("tag");
        for (const tag of category.tags) query.append("tags", tag);
    }
    for (const key of ["countries", "continents"]) for (const value of params.getAll(key)) query.append(key, value);
    if (q) query.set("q", q);
    query.set("sort", sort);
    const path = `/boards/collections/${context}?${query}`;
    const state = snapshot.key === path ? snapshot : { data: null, loading: account.ready, error: "" };
    useEffect(() => {
        if (!account.ready || context === "samples") return;
        void store.load(path);
        const refresh = () => {
            void store.load(path);
        };
        window.addEventListener("focus", refresh);
        return () => {
            store.cancel();
            window.removeEventListener("focus", refresh);
        };
    }, [store, path, account.ready, context]);
    const href = (changes: Record<string, string | null>) => {
        const next = new URLSearchParams(params.toString());
        for (const [key, value] of Object.entries(changes)) {
            if (value === null) next.delete(key);
            else next.set(key, value);
        }
        return `${pathname}${next.size ? `?${next}` : ""}`;
    };
    const samples =
        context === "samples"
            ? publicDiscoverPreviewBoards
                  .filter(
                      (board) =>
                          (!params.get("tag") || board.tags.some((tag) => tag === params.get("tag"))) &&
                          (!q || sampleScore(board, q) > 0) &&
                          matchesSampleGeography(board, params)
                  )
                  .sort((a, b) =>
                      sort === "relevance"
                          ? sampleScore(b, q) - sampleScore(a, q) || a.title.localeCompare(b.title)
                          : sort === "title-desc"
                            ? b.title.localeCompare(a.title)
                            : a.title.localeCompare(b.title)
                  )
            : [];
    const total = context === "samples" ? samples.length : (state.data?.total ?? 0);
    const Heading = embedded ? "h2" : "h1";
    const title =
        category?.title ??
        (params.get("handle") ? `${collectionTitles[context]} · @${params.get("handle")}` : collectionTitles[context]);
    return (
        <section
            aria-labelledby={`collection-${context}-heading`}
            className={`mx-auto w-full max-w-[1480px] min-w-0 ${embedded ? `mt-12 pt-8 ${showDivider ? "border-line border-t" : ""}` : "px-5 py-10 sm:px-10"}`}
        >
            {!embedded && <BackLink fallbackHref="/boards" />}
            <Heading
                ref={heading}
                tabIndex={-1}
                id={`collection-${context}-heading`}
                className={`font-display font-bold ${embedded ? "text-24" : "text-36 sm:text-48 mt-8"}`}
            >
                {title}
            </Heading>
            {context === "friends" && (
                <p className="text-muted-foreground mt-2 text-sm">boards created by your friends</p>
            )}
            {context === "samples" && (
                <p className="text-muted-foreground mt-2 text-sm">
                    Editorial examples, without saved Board identities or account actions. Publication dates and save
                    counts are unavailable.
                </p>
            )}
            <div className="my-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
                <form
                    key={q}
                    className="border-line focus-within:border-foreground flex min-w-0 flex-1 items-center border-b"
                    onSubmit={(event) => {
                        event.preventDefault();
                        const value = String(new FormData(event.currentTarget).get("q") ?? "").trim();
                        router.push(
                            href({
                                q: value || null,
                                sort: collectionDefaultSort(context, value.length >= 2),
                                page: null
                            })
                        );
                    }}
                >
                    <Search size={18} aria-hidden="true" className="shrink-0" />
                    <label className="min-w-0 flex-1">
                        <span className="sr-only">Search this collection</span>
                        <input
                            name="q"
                            type="search"
                            defaultValue={q}
                            onChange={(event) => {
                                if (!event.target.value.trim() && q)
                                    router.replace(href({ q: null, sort: null, page: null }), { scroll: false });
                            }}
                            maxLength={100}
                            minLength={2}
                            placeholder="Search boards in this collection…"
                            className="min-h-16 w-full bg-transparent px-4 text-sm outline-none sm:text-base"
                        />
                    </label>
                    <button className="min-h-11 px-3 text-sm underline" type="submit">
                        Search
                    </button>
                    {q && (
                        <Link
                            className="inline-flex min-h-11 items-center px-2 text-sm underline"
                            href={href({ q: null, sort: null, page: null })}
                        >
                            Clear
                        </Link>
                    )}
                </form>
                <GeographicFilters />
                <label className="flex items-center gap-3 text-sm">
                    Sort by
                    <select
                        aria-label="Sort Boards"
                        className="border-line bg-background min-h-11 border px-3"
                        value={sort}
                        onChange={(event) => router.push(href({ sort: event.target.value, page: null }))}
                    >
                        {sorts
                            .filter(
                                ([value]) =>
                                    (value !== "relevance" || Boolean(q)) &&
                                    (value !== "saved-at-desc" || ["saved", "profile-saved"].includes(context)) &&
                                    (context !== "samples" || ["relevance", "title-asc", "title-desc"].includes(value))
                            )
                            .map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                    </select>
                </label>
            </div>
            {(state.loading || !account.ready) && context !== "samples" && (
                <p role="status" className="py-8">
                    Loading Boards…
                </p>
            )}
            {state.error && (
                <div role="alert" className="py-8">
                    {state.error}{" "}
                    <button className="min-h-11 px-3 underline" onClick={() => void store.load(path)}>
                        Retry
                    </button>{" "}
                    <Link href="/login" className="underline">
                        Sign in
                    </Link>
                </div>
            )}
            {(state.data || context === "samples") && (
                <p role="status" className="text-muted-foreground mb-6 text-sm">
                    {total} {total === 1 ? "Board" : "Boards"}
                    {q ? ` matching “${q}”` : ""}
                </p>
            )}
            <div className="grid grid-cols-1 items-start gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
                {context === "samples"
                    ? samples
                          .slice((page - 1) * 20, page * 20)
                          .map((board) => <DiscoverBoardCard key={board.id} board={board} />)
                    : state.data?.items.map((board) => {
                          const card = discoveryGallery(board);
                          return (
                              <div key={board.boardId} className="mx-auto w-full max-w-[328px]">
                                  <AccountPhotoBoardCard
                                      board={card.photo!}
                                      href={card.href}
                                      ownership={card.ownership}
                                      initialSaved={board.savedByMe}
                                      showVisibility
                                      hideCoverCredit
                                      details
                                      hoverActions={{
                                          editHref: card.editHref,
                                          viewHref: board.status === "published" ? card.href : undefined
                                      }}
                                      imageSizes="(min-width: 1280px) 22vw, (min-width: 640px) 45vw, 90vw"
                                      onSavedChange={(saved) => {
                                          if (
                                              !saved &&
                                              (context === "saved" ||
                                                  (context === "profile-saved" &&
                                                      params.get("handle")?.toLowerCase() ===
                                                          account.user?.username.toLowerCase()))
                                          ) {
                                              heading.current?.focus();
                                              store.removeConfirmed(board.boardId);
                                          }
                                          void store.load(path);
                                      }}
                                  />
                              </div>
                          );
                      })}
            </div>
            {!state.loading && !state.error && total === 0 && (state.data || context === "samples") && (
                <p className="text-muted-foreground py-12 text-center">
                    {q ? "No Boards match this search in this collection." : "No Boards in this collection yet."}
                </p>
            )}
            {page > 1 && total <= (page - 1) * 20 && (
                <Link className="inline-flex min-h-11 items-center underline" href={href({ page: null })}>
                    Return to first page
                </Link>
            )}
            <Pagination page={page} totalPages={Math.ceil(total / 20)} href={(next) => href({ page: String(next) })} />
        </section>
    );
}
