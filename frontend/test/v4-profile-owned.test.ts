import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OwnedBoardCard } from "../src/components/features/boards/PublishedBoardList";
import { LiveBoardCard } from "../src/components/features/profile/ProfilePageContent";
import { listPublishedBoards, type PublishedSummary } from "../src/lib/board-creator-api";
import { toProfilePhotoBoardCard } from "../src/lib/photo-board-card";
import { loadPublishedBoards, loadPublicProfile, type PublishedBoardSummary } from "../src/lib/profile";

const base: PublishedBoardSummary = {
    boardId: 57,
    title: "A real published journey",
    coverImageUrl: null,
    updatedAt: "2026-10-16T11:00:00.000Z"
};

function sharedV4(markup: string) {
    assert.equal((markup.match(/aspect-ratio:400 \/ 500/g) ?? []).length, 1);
    assert.match(markup, /href="\/boards\/57"/);
    assert.doesNotMatch(markup, /0 saves|0 days|Destination not added|Unknown author|Tokyo/);
}

test("owned published summaries preserve accurate visibility and distinct View and Edit navigation", async (t) => {
    const requests: string[] = [];
    const payload: PublishedSummary[] = ["public", "friends", "collaborators"].map((visibility) => ({
        ...base,
        status: "published",
        visibility: visibility as PublishedSummary["visibility"]
    }));
    t.mock.method(globalThis, "fetch", async (input: string, init: RequestInit) => {
        assert.equal(init.credentials, "include");
        requests.push(new URL(input).pathname + new URL(input).search);
        return Response.json({ data: payload, meta: { page: 1, limit: 20, hasMore: true } });
    });
    const result = await listPublishedBoards();
    assert.equal(result.hasMore, true);
    const labels = [
        "Public — anyone",
        "Friends — you, your friends and invited Board members",
        "Restricted access — you and invited Board members"
    ];
    for (const [index, board] of result.items.entries()) {
        const markup = renderToStaticMarkup(createElement(OwnedBoardCard, { board }));
        sharedV4(markup);
        assert.ok(markup.includes(`aria-label="${labels[index]}`));
        assert.match(markup, /href="\/boards\/57">View Board →<\/a>/);
        assert.match(markup, /href="\/boards\/57\/edit">Edit Board →<\/a>/);
        assert.doesNotMatch(markup, /aria-pressed=|aria-label="(?:Save |Unsave )|<button[^>]*>[\s\S]*?<a\b/);
        assert.match(markup, /No cover photo/);
    }
    assert.deepEqual(requests, ["/api/v1/boards?scope=published&page=1"]);
});

test("own profile consumes actual visibility from its existing summary endpoint without card reads", async (t) => {
    const requests: string[] = [];
    t.mock.method(globalThis, "fetch", async (input: string, init: RequestInit) => {
        assert.equal(init.credentials, "include");
        requests.push(new URL(input).pathname + new URL(input).search);
        return Response.json({
            data: [
                {
                    ...base,
                    status: "published",
                    visibility: "collaborators",
                    coverImageUrl: "/api/v1/boards/57/images/19/content"
                }
            ]
        });
    });
    const [board] = await loadPublishedBoards();
    const author = "a_complete_existing_profile_username";
    const data = toProfilePhotoBoardCard(board, author);
    assert.equal(data.author, author);
    assert.equal(data.visibility, "collaborators");
    assert.equal(data.status, "published");
    assert.equal(data.destination, "");
    assert.equal(data.destinationLabel, "");
    for (const key of ["description", "tags", "durationDays", "savedCount"] as const)
        assert.equal(data[key], undefined);
    assert.equal(
        data.image?.src,
        new URL(
            "/api/v1/boards/57/images/19/content",
            process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"
        ).toString()
    );
    const markup = renderToStaticMarkup(
        createElement(LiveBoardCard, { board: { ...board, author }, ownership: "owner" })
    );
    sharedV4(markup);
    assert.match(markup, /Restricted access — you and invited Board members/);
    assert.ok(markup.includes(author));
    assert.doesNotMatch(markup, /aria-pressed=|aria-label="(?:Save |Unsave )/);
    assert.deepEqual(requests, ["/api/v1/boards?scope=published&page=1&limit=3"]);
});

test("public profile summaries expose unknown saving honestly without owner or editing controls", async (t) => {
    const requests: string[] = [];
    t.mock.method(globalThis, "fetch", async (input: string, init: RequestInit) => {
        assert.equal(init.credentials, "include");
        requests.push(new URL(input).pathname);
        return Response.json({
            data: {
                profile: { username: "real_public_author", displayName: "Real Author", profilePicture: null },
                isOwner: false,
                boards: [base],
                destinations: [],
                stats: {}
            }
        });
    });
    const view = await loadPublicProfile("real_public_author");
    assert.equal(view.isOwner, false);
    const markup = renderToStaticMarkup(
        createElement(LiveBoardCard, {
            board: { ...view.boards[0], author: view.profile.username },
            ownership: "other",
            publicView: true
        })
    );
    sharedV4(markup);
    assert.match(markup, /real_public_author/);
    assert.match(
        markup,
        /<button[^>]*disabled=""[^>]*aria-label="Save status unavailable for A real published journey"/
    );
    assert.doesNotMatch(
        markup,
        /aria-pressed=|href="[^\"]*\/edit|aria-label="(?:Public —|Friends —|Restricted access —)/
    );
    assert.deepEqual(requests, ["/api/v1/users/by-handle/real_public_author"]);
});

test("missing profile ownership and missing owned visibility remain unknown instead of inferred from author", (t) => {
    const fetch = t.mock.method(globalThis, "fetch", async () => {
        throw new Error("No inference requests");
    });
    for (const props of [
        { board: { ...base, author: "the_current_username" } },
        { board: { ...base, author: "the_current_username" }, ownership: "owner" as const }
    ]) {
        const markup = renderToStaticMarkup(createElement(LiveBoardCard, props));
        sharedV4(markup);
        assert.match(markup, /the_current_username/);
        assert.doesNotMatch(
            markup,
            /aria-pressed=|aria-label="(?:Public —|Friends —|Restricted access —|Save |Unsave )/
        );
    }
    assert.equal(fetch.mock.callCount(), 0);
});
