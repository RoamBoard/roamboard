import assert from "node:assert/strict";
import test from "node:test";
import React, { Children, createElement, isValidElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BoardAuthorAvatar, PhotoBoardCardContent } from "../src/components/features/boards/cards/PhotoBoardCard";
import { toPhotoBoardCard } from "../src/lib/photo-board-card";
import type { BoardDocument } from "../src/lib/board-creator-api";

function source(): BoardDocument {
    return {
        boardId: 91,
        title: "A saved journey",
        description: "An afternoon in Paris",
        revision: 2,
        status: "published",
        visibility: "friends",
        savedByMe: true,
        author: {
            username: "alex+travels",
            bio: "The original author",
            photo: { imageId: 17, url: "/api/v1/images/17/content?variant=thumbnail&boardId=91" }
        },
        permissions: { canEditContent: false, canManageBoard: false },
        createdAt: "2026-10-01T12:00:00Z",
        updatedAt: "2026-10-02T12:00:00Z",
        tags: [],
        tagIds: [],
        imageIds: [],
        images: [],
        coverImageId: null,
        days: []
    };
}

type Props = ComponentProps<typeof PhotoBoardCardContent>;
type NodeProps = {
    children?: ReactNode;
    href?: string;
    className?: string;
    src?: string;
    alt?: string;
    onError?: () => void;
    [key: string]: unknown;
};
function nodes(node: ReactNode): Array<{ type: unknown; props: NodeProps }> {
    if (Array.isArray(node)) return node.flatMap(nodes);
    if (!isValidElement<NodeProps>(node)) return [];
    return [{ type: node.type, props: node.props }, ...Children.toArray(node.props.children).flatMap(nodes)];
}
function props(overrides: Partial<Props> = {}): Props {
    return {
        board: toPhotoBoardCard(source()),
        details: true,
        expanded: true,
        detailsId: "owner-test",
        onExpandedChange() {},
        selection: { selected: true, href: "/boards/91", remixHref: "/boards/new?remix=91", onSelect() {} },
        ...overrides
    };
}

test("Saved Board owner controls use the canonical handle and protected author photograph without fetching more data", (t) => {
    t.mock.method(globalThis, "fetch", () => {
        assert.fail("Owner controls must reuse the loaded Board author");
    });
    const board = toPhotoBoardCard(source());
    assert.equal(board.author, "alex+travels");
    const photo = new URL(board.authorPhotoUrl!);
    assert.equal(photo.origin, new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").origin);
    assert.equal(photo.pathname, "/api/v1/images/17/content");
    assert.equal(photo.searchParams.get("boardId"), "91");
    assert.equal(photo.searchParams.get("variant"), "thumbnail");
    const tree = PhotoBoardCardContent(props({ board }));
    const profile = nodes(tree).find((node) => node.props.href === "/profile/alex%2Btravels");
    const remix = nodes(tree).find((node) => node.props.href === "/boards/new?remix=91");
    const view = nodes(tree).find((node) => node.props.href === "/boards/91");
    assert.ok(profile);
    assert.ok(remix);
    assert.ok(view);
    assert.match(String(profile.props["aria-label"]), /alex\+travels/);
    assert.equal(profile.props.onClick, undefined);
    assert.match(profile.props.className ?? "", /left-\[6\.5%\]/);
    assert.match(profile.props.className ?? "", /top-\[6\.5%\]/);
    assert.match(profile.props.className ?? "", /min-h-11/);
    assert.match(profile.props.className ?? "", /flex/);
    const profileChildren = nodes(profile.props.children);
    const avatar = profileChildren.find((node) => node.type === BoardAuthorAvatar);
    const handle = profileChildren.find(
        (node) => node.type === "span" && Children.toArray(node.props.children).join("") === "@alex+travels"
    );
    assert.ok(avatar, "The same profile link contains its avatar");
    assert.ok(handle, "The visible owner handle belongs to the profile link");
    assert.ok(
        profileChildren.indexOf(avatar) < profileChildren.indexOf(handle),
        "The avatar appears before the handle"
    );
    assert.ok(
        profileChildren.some((node) => /(?:^|\s)size-12(?:\s|$)/.test(node.props.className ?? "")),
        "The visible avatar is slightly smaller than the 56px action buttons"
    );
    const eye = nodes(view.props.children).find((node) => /right-\[calc\(/.test(node.props.className ?? ""));
    assert.ok(eye, "The overview eye shares a centered pair with the plus");
    for (const control of [remix, eye]) {
        assert.match(control.props.className ?? "", /size-14/);
        assert.match(control.props.className ?? "", /top-\[60%\]/);
        assert.doesNotMatch(control.props.className ?? "", /-translate-x-/);
    }
    const plusInset = /left-\[calc\(([\d.]+)%[_ ]?-[_ ]?([\d.]+)rem\)\]/.exec(remix.props.className ?? "");
    const eyeInset = /right-\[calc\(([\d.]+)%[_ ]?-[_ ]?([\d.]+)rem\)\]/.exec(eye.props.className ?? "");
    assert.ok(plusInset);
    assert.ok(eyeInset);
    assert.deepEqual(plusInset.slice(1), eyeInset.slice(1), "Matching insets center the action pair");
    for (const width of [240, 320, 400]) {
        const inset = (width * Number(plusInset[1])) / 100 - Number(plusInset[2]) * 16;
        const plusCenter = inset + 28;
        const eyeCenter = width - inset - 28;
        assert.ok(Math.abs((plusCenter + eyeCenter) / 2 - width / 2) < 0.001);
        assert.ok(
            Math.abs(eyeCenter - plusCenter - (0.435 * width - 28)) < 0.001,
            "Moving the pair preserves its previous spacing at every card width"
        );
    }
    const markup = renderToStaticMarkup(tree);
    assert.equal(
        (markup.replace(/<[^>]+>/g, " ").match(/@alex\+travels/g) ?? []).length,
        1,
        "Owner handle is shown once, beside the avatar"
    );
    assert.doesNotMatch(markup, /THE JOURNEY/);
    assert.match(markup, /<img\b[^>]*alt=""/);
    assert.ok(markup.includes(photo.toString().replaceAll("&", "&amp;")));
});

test("Owner controls fall back when the author has no photograph and remain absent from inactive and Continue cards", () => {
    const missing = source();
    missing.author.photo = null;
    const board = toPhotoBoardCard(missing);
    assert.equal(board.authorPhotoUrl ?? null, null);
    const fallback = renderToStaticMarkup(createElement(PhotoBoardCardContent, props({ board })));
    assert.match(fallback, /href="\/profile\/alex%2Btravels"/);
    assert.match(fallback, /lucide-user-round/);
    const inactive = renderToStaticMarkup(
        createElement(
            PhotoBoardCardContent,
            props({ selection: { ...props().selection!, selected: false }, expanded: false })
        )
    );
    assert.doesNotMatch(inactive, /href="\/profile\/|lucide-eye|lucide-plus|lucide-user-round/);
    const continued = renderToStaticMarkup(
        createElement(
            PhotoBoardCardContent,
            props({ selection: { selected: true, href: "/boards/91/edit", onSelect() {} } })
        )
    );
    assert.match(continued, /THE JOURNEY/);
    assert.match(continued, /lucide-pencil/);
    assert.doesNotMatch(continued, /href="\/profile\/|lucide-eye|lucide-plus/);
});

test("Touch-only primary saved cards reserve room for the owner row without moving inactive or Continue titles", () => {
    const selections: Array<{ primary: boolean; selection: Props["selection"] }> = [
        { primary: true, selection: props().selection },
        { primary: false, selection: { ...props().selection!, selected: false } },
        { primary: false, selection: { selected: true, href: "/boards/91/edit", onSelect() {} } }
    ];
    for (const { primary, selection } of selections) {
        const tree = PhotoBoardCardContent(props({ expanded: false, selection }));
        const controls = nodes(tree);
        const title = controls.find((node) => node.props.className?.includes("top-[5.75cqw]"));
        const byline = controls.find((node) => node.props.title === "by alex+travels");
        assert.ok(title);
        assert.ok(byline);
        if (primary) {
            assert.ok(
                title.props.className?.includes("[@media(hover:none)]:top-[calc(6.5%+3.75rem)]"),
                "The collapsed title begins below the always-visible touch author row"
            );
            assert.ok(
                byline.props.className?.includes("[@media(hover:none)]:hidden"),
                "Touch users see the linked owner handle once instead of an overlapping duplicate byline"
            );
            const profile = controls.find((node) => node.props.href === "/profile/alex%2Btravels");
            assert.ok(profile?.props.className?.includes("[@media(hover:none)]:opacity-100"));
        } else {
            assert.doesNotMatch(title.props.className ?? "", /\[@media\(hover:none\)\]:top-/);
            assert.doesNotMatch(byline.props.className ?? "", /\[@media\(hover:none\)\]:hidden/);
        }
    }
});

test("A failed protected owner photograph gets a decorative person fallback and a changed photograph can load again", () => {
    const state: { failed?: string } = {};
    function render(src: string) {
        const captured: { tree: ReactNode } = { tree: null };
        function Probe() {
            const original = React.useState;
            React.useState = (() => [
                state.failed,
                (next: string) => {
                    state.failed = next;
                }
            ]) as typeof React.useState;
            try {
                captured.tree = BoardAuthorAvatar({ src });
                return null;
            } finally {
                React.useState = original;
            }
        }
        renderToStaticMarkup(createElement(Probe));
        return { nodes: nodes(captured.tree), markup: renderToStaticMarkup(captured.tree) };
    }
    const first = render("http://localhost:3001/api/v1/images/17/content?variant=thumbnail&boardId=91");
    const image = first.nodes.find((node) => node.props.src && node.props.onError);
    assert.ok(image?.props.onError);
    assert.equal(image.props.alt, "", "The surrounding profile link supplies the accessible name");
    assert.equal(image.props.unoptimized, true, "Protected photos retain browser session delivery");
    assert.equal(image.props.width, 48);
    assert.equal(image.props.height, 48);
    image.props.onError();
    const failed = render("http://localhost:3001/api/v1/images/17/content?variant=thumbnail&boardId=91");
    assert.doesNotMatch(failed.markup, /<img\b/);
    assert.match(failed.markup, /lucide-user-round/);
    assert.match(failed.markup, /aria-hidden="true"/);
    const replacement = render("http://localhost:3001/api/v1/images/18/content?variant=thumbnail&boardId=91");
    assert.match(replacement.markup, /<img\b/);
    assert.doesNotMatch(replacement.markup, /lucide-user-round/);
});
