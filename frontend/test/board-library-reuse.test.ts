import assert from "node:assert/strict";
import test from "node:test";
import { Children, createElement, isValidElement, type ReactNode, type ElementType, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import ProfilePageContent, {
    LiveBoardLibrary,
    type ProfilePageContentProps
} from "../src/components/features/profile/ProfilePageContent";
import SavedBoardGrid from "../src/components/features/boards/SavedBoardGrid";
import type { PublishedBoardSummary, SavedBoardSummary, UserProfile } from "../src/lib/profile";

const profile: UserProfile = {
    id: "a-real-owner",
    username: "journey_owner",
    displayName: "Journey Owner",
    description: "",
    location: null,
    occupation: null,
    languages: [],
    interests: [],
    profilePicture: null,
    defaultBoardVisibility: "public",
    revision: 1,
    createdAt: "2026-10-19T10:00:00Z",
    updatedAt: "2026-10-19T10:00:00Z"
};
const published: PublishedBoardSummary[] = ["public", "friends", "collaborators"].map((visibility, index) => ({
    boardId: 701 + index,
    title: `Persisted trip ${701 + index}`,
    coverImageUrl: null,
    visibility: visibility as PublishedBoardSummary["visibility"],
    status: "published",
    updatedAt: "2026-10-19T10:00:00Z"
}));
const ProfileContent = ProfilePageContent as ComponentType<ProfilePageContentProps>;
const router = {
    back() {},
    forward() {},
    refresh() {},
    push() {},
    replace() {},
    prefetch() {}
};
function render(children: ReactNode) {
    return renderToStaticMarkup(
        createElement(
            AppRouterContext.Provider,
            { value: router as unknown as Parameters<typeof AppRouterContext.Provider>[0]["value"] },
            children
        )
    );
}

test("owner profile's published preview uses the horizontal library without losing real links, visibility or View All", (t) => {
    const fetch = t.mock.method(globalThis, "fetch", async () => {
        throw new Error("Rendering a preview must not fetch individual Boards");
    });
    const html = render(createElement(ProfileContent, { initialProfile: profile, initialPublished: published }));
    const inspired = html.slice(0, html.indexOf('aria-label="My boards"'));
    assert.doesNotMatch(inspired, /href="\/boards\/70[123]"/);
    assert.doesNotMatch(inspired, /No saved boards yet/);
    const own = html.slice(html.indexOf('aria-label="My boards"'));
    assert.match(own, /aria-roledescription="carousel"/);
    assert.match(own, /touch-pan-y/);
    assert.match(own, /aria-label="Previous [^"]+"/);
    assert.match(own, /aria-label="Next [^"]+"/);
    assert.match(own, /href="\/boards\/collections\/mine\?status=published"/);
    for (const board of published) assert.ok(own.includes(`href="/boards/${board.boardId}"`));
    assert.match(own, /Public — anyone/);
    assert.match(own, /Friends — you, your friends and invited Board members/);
    assert.match(own, /Restricted access — you and invited Board members/);
    assert.doesNotMatch(own, /aria-label="(?:Save |Unsave )|0 saves|0 days/);
    assert.equal(fetch.mock.callCount(), 0);
});

test("an empty saved library retains its focus fallback without inventing an empty-state result before loading finishes", () => {
    const html = renderToStaticMarkup(
        createElement(SavedBoardGrid, { boards: [], presentation: "library", onUnsave() {} })
    );
    assert.match(html, /tabindex="-1"[^>]*aria-label="Saved Boards"|aria-label="Saved Boards"[^>]*tabindex="-1"/);
    assert.doesNotMatch(html, /aria-label="(?:Previous |Next |Save |Unsave )|No .*Boards|href="\/boards\//);
});

test("profile collection failures remain errors while genuine empty published collections retain their empty message", () => {
    const empty = render(createElement(ProfileContent, { initialProfile: profile }));
    assert.match(empty, /No published boards yet/);
    const failed = render(
        createElement(ProfileContent, {
            initialProfile: profile,
            initialSectionErrors: ["My boards could not be loaded."]
        })
    );
    assert.match(failed, /My boards could not be loaded/);
    assert.match(failed, /Retry/);
    assert.doesNotMatch(failed, /No published boards yet/);
    const loading = render(createElement(ProfileContent));
    assert.match(loading, /Loading/);
    assert.doesNotMatch(loading, /No published boards yet|No saved boards yet/);
});

type TreeProps = { children?: ReactNode; [key: string]: unknown };
function elements(node: ReactNode): Array<{ type: unknown; props: TreeProps }> {
    if (!isValidElement<TreeProps>(node)) return [];
    return [{ type: node.type, props: node.props }, ...Children.toArray(node.props.children).flatMap(elements)];
}

test("Collections keeps navigation and an unavailable state when the public Board read fails", async (t) => {
    const { default: CollectionPage } = await import("../src/app/discover/collections/[slug]/page");
    const { discoverCollections } = await import("../src/data/discover-collections");
    const fetch = t.mock.method(globalThis, "fetch", async () => {
        throw new Error("Public discovery unavailable");
    });
    const page = await CollectionPage({ params: Promise.resolve({ slug: discoverCollections[0].slug }) });
    const nodes = elements(page);
    const unavailable = nodes.find((node) => node.props["aria-labelledby"] === "collection-empty-title");
    assert.ok(unavailable, "The real route must retain its unavailable state");
    const html = renderToStaticMarkup(createElement("section", unavailable.props));
    assert.doesNotMatch(html, /No Boards in this collection yet/);
    assert.match(html, /Explore other collections/);
    assert.doesNotMatch(html, /href="\/boards\/|aria-roledescription="slide"|aria-label="(?:Save |Unsave )/);
    assert.ok(nodes.some((node) => node.type === "h1" && node.props.children === discoverCollections[0].title));
    assert.equal(fetch.mock.callCount(), 1);
});

test("an empty live collection remains reachable and shows its empty state", async (t) => {
    const { default: CollectionPage } = await import("../src/app/discover/collections/[slug]/page");
    t.mock.method(globalThis, "fetch", async () => Response.json({ data: { items: [], hasMore: false } }));
    const page = await CollectionPage({ params: Promise.resolve({ slug: "by-the-water" }) });
    const empty = elements(page).find((node) => node.props["aria-labelledby"] === "collection-empty-title");
    assert.ok(empty);
    const html = renderToStaticMarkup(createElement("section", empty.props));
    assert.match(html, /No Boards in this collection yet/);
    assert.match(html, /Explore other collections/);
    assert.doesNotMatch(html, /href="\/boards\/\d/);
});

test("saved-library presentation keeps genuine membership, Board URLs and a keyboard focus destination without metadata requests", (t) => {
    const fetch = t.mock.method(globalThis, "fetch", async () => {
        throw new Error("Saved summary rendering needs no additional reads");
    });
    const boards: SavedBoardSummary[] = [81, 93].map((boardId) => ({
        boardId,
        title: `Saved real journey ${boardId}`,
        description: "A persisted saved-list description",
        owner: { id: `owner-${boardId}`, username: `real_author_${boardId}`, displayName: "Real author" },
        coverImageUrl: null,
        savedAt: "2026-10-19T10:00:00Z"
    }));
    const html = renderToStaticMarkup(
        createElement(SavedBoardGrid, { boards, presentation: "library", onUnsave() {} })
    );
    assert.match(html, /aria-roledescription="carousel"/);
    assert.match(html, /touch-pan-y/);
    assert.match(html, /tabindex="-1"[^>]*aria-label="Saved Boards"|aria-label="Saved Boards"[^>]*tabindex="-1"/);
    assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 2);
    for (const board of boards) {
        assert.ok(html.includes(`href="/boards/${board.boardId}"`));
        assert.ok(html.includes(`aria-label="Unsave ${board.title}"`));
        assert.ok(html.includes(board.owner.username));
    }
    assert.doesNotMatch(
        html,
        /0 saves|0 days|href="[^\"]*\/edit|aria-label="(?:Public —|Friends —|Restricted access —)/
    );
    assert.equal(fetch.mock.callCount(), 0);
});

test("Vibes reads published summaries and keeps tag links beside genuine Board actions", async (t) => {
    const { default: VibePage } = await import("../src/app/discover/vibes/[id]/page");
    const { boardTags } = await import("../src/data/board-tags");
    const { discoveryCard } = await import("./fixtures/discovery-card");
    const tag = boardTags.find((candidate) => candidate.id === "foodie");
    assert.ok(tag);
    const fetch = t.mock.method(globalThis, "fetch", async (_input: string | URL | Request, init?: RequestInit) => {
        assert.equal(init?.credentials, "omit");
        return Response.json({
            data: {
                items: [discoveryCard(721), discoveryCard(722), discoveryCard(723, { tags: ["Architecture"] })],
                hasMore: false
            }
        });
    });
    const page = await VibePage({ params: Promise.resolve({ id: tag.id }) });
    const nodes = elements(page);
    const header = nodes.find((node) => node.type === "header");
    assert.ok(header);
    const headingHtml = renderToStaticMarkup(createElement("header", header.props));
    assert.doesNotMatch(headingHtml, /Preview|sample Boards?|discovery is connected/);
    const library = nodes.find((node) => Array.isArray(node.props.boards));
    assert.ok(library, "The actual Vibe route must use its Board library presenter");
    assert.deepEqual(
        (library.props.boards as Array<{ id: string }>).map((board) => board.id),
        ["721", "722"]
    );
    const html = renderToStaticMarkup(createElement(library.type as ElementType, library.props));
    assert.match(html, /aria-roledescription="carousel"/);
    assert.match(html, /touch-pan-y/);
    assert.match(html, /aria-label="Previous [^\"]+"/);
    assert.match(html, /aria-label="Next [^\"]+"/);
    assert.match(html, /aria-current="page"/);
    assert.ok(html.includes(`href="/discover/vibes/${encodeURIComponent(tag.id)}"`));
    assert.match(html, /href="\/boards\/721"/);
    assert.match(html, /href="\/boards\/722"/);
    assert.doesNotMatch(html, /href="\/boards\/collections\/samples|Published Board 723/);
    assert.equal(fetch.mock.callCount(), 1);
});

test("visitor profile library renders only supplied authorized results and keeps membership unknown instead of granting owner controls", (t) => {
    const fetch = t.mock.method(globalThis, "fetch", async () => {
        throw new Error("Visibility or membership must not be guessed by card requests");
    });
    const html = renderToStaticMarkup(
        createElement(LiveBoardLibrary, {
            boards: [published[1]],
            author: "a_public_profile",
            ownership: "other",
            publicView: true
        })
    );
    assert.match(html, /aria-roledescription="carousel"/);
    assert.match(html, /href="\/boards\/702"/);
    assert.match(html, /by a_public_profile/);
    assert.doesNotMatch(html, /Persisted trip 701|Persisted trip 703|href="[^\"]*\/edit|aria-pressed=/);
    assert.match(html, /disabled=""[^>]*aria-label="Save status unavailable for Persisted trip 702"/);
    assert.match(html, /aria-label="Friends —/);
    assert.doesNotMatch(html, /aria-label="(?:Public —|Restricted access —|Unsave )/);
    assert.equal(fetch.mock.callCount(), 0);
});
