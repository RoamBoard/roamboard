import assert from "node:assert/strict";
import test from "node:test";
import { Children, createElement, isValidElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PhotoBoardCard, { PhotoBoardCardContent } from "../src/components/features/boards/cards/PhotoBoardCard";
import AccountPhotoBoardCard from "../src/components/features/boards/cards/AccountPhotoBoardCard";
import { BoardCardFrame } from "../src/components/features/boards/cards/BoardCardParts";
import { photoBoardExamples } from "../src/data/board-card-examples";
import type { PhotoBoardCardData } from "../src/types/board-card";

const board: PhotoBoardCardData = {
    id: "real-board-71",
    title: "A very long title about taking the slow road through a wonderful coastal destination",
    author: "a_long_and_complete_author_handle",
    destination: "Oslo, Norway",
    destinationLabel: "OSLO",
    tags: ["Architecture", "Food & Drink"],
    description: "A quiet route along the waterfront.",
    durationDays: 3,
    savedCount: 17,
    status: "published",
    visibility: "public",
    image: { src: "/api/v1/images/42/content?variant=display", alt: "Oslo waterfront" }
};

test("owner hover actions retain the profile identity and link the pen to the permitted editor", () => {
    const markup = html({
        expanded: true,
        ownership: "owner",
        hoverActions: { editHref: "/boards/71/edit" }
    });
    assert.match(markup, /href="\/profile\/a_long_and_complete_author_handle"/);
    assert.match(markup, /@a_long_and_complete_author_handle/);
    assert.match(markup, /href="\/boards\/71\/edit"/);
    assert.match(markup, /lucide-pencil/);
    assert.doesNotMatch(markup, /lucide-eye|aria-label="(?:Save |Unsave )|lucide-plus/);
});

test("other-author hover exposes View and an independent filled saved bookmark, without Remix", () => {
    const calls = { saves: 0 };
    const cardProps = props({
        expanded: true,
        ownership: "other",
        hoverActions: { viewHref: "/boards/71" },
        save: {
            state: "saved",
            onToggle: () => {
                calls.saves++;
            }
        }
    });
    const view = PhotoBoardCardContent(cardProps);
    const bookmark = control(view, (candidate) => candidate["aria-label"] === `Unsave ${board.title}`);
    bookmark.onClick?.({ stopPropagation: () => {} });
    assert.equal(calls.saves, 1);
    const markup = renderToStaticMarkup(view);
    assert.match(markup, /href="\/boards\/71"/);
    assert.match(markup, /lucide-eye/);
    assert.match(markup, /aria-pressed="true"/);
    assert.match(markup, /fill="currentColor"/);
    assert.doesNotMatch(markup, /lucide-plus|remix=/);
    const unsaved = html({ ...cardProps, save: { state: "unsaved" } });
    assert.match(unsaved, /aria-pressed="false"/);
});

test("gallery credit suppression retains the cover URL and leaves other card placements unchanged", () => {
    const credited = {
        ...board,
        image: {
            src: "https://images.unsplash.com/chosen.jpg?ixid=original",
            unoptimized: true,
            alt: "Chosen cover",
            credit: "Actual Photographer",
            creditUrl: "https://unsplash.com/@actual"
        }
    };
    const gallery = html({ board: credited, hideCoverCredit: true });
    assert.match(gallery, /images\.unsplash\.com/);
    assert.doesNotMatch(gallery, /Photo by|Actual Photographer/);
    assert.match(html({ board: credited }), /Actual Photographer/);
});

test("nonprimary account cards stay selection-only and expose their saved bookmark only after promotion", () => {
    function render(selected: boolean) {
        return renderToStaticMarkup(
            createElement(AccountPhotoBoardCard, {
                board: { ...board, id: "71" },
                ownership: "other",
                initialSaved: true,
                details: selected,
                selection: { selected, onSelect() {} },
                hoverActions: selected ? { viewHref: "/boards/71" } : undefined
            })
        );
    }
    assert.doesNotMatch(render(false), /aria-label="(?:Save |Unsave |View )/);
    assert.match(render(true), /aria-label="Unsave /);
});
type CardProps = ComponentProps<typeof PhotoBoardCardContent>;
type EventControl = {
    children?: ReactNode;
    type?: string;
    disabled?: boolean;
    href?: string;
    tabIndex?: number;
    "aria-expanded"?: boolean;
    "aria-controls"?: string;
    "aria-pressed"?: boolean;
    "aria-label"?: string;
    "data-photo-board-expanded"?: boolean;
    onClick?: (event: { stopPropagation: () => void }) => void;
    onPointerDownCapture?: (event: { stopPropagation: () => void; pointerType?: string }) => void;
    onKeyDown?: (event: { key: string; stopPropagation: () => void; preventDefault: () => void }) => void;
    onHoverStart?: () => void;
    onHoverEnd?: () => void;
    onPointerLeave?: (event: { buttons: number }) => void;
    onFocusCapture?: (event: {
        currentTarget: { contains: () => boolean };
        target: { matches: () => boolean };
        relatedTarget: null;
    }) => void;
    onBlurCapture?: (event: { currentTarget: { contains: () => boolean }; relatedTarget: null }) => void;
};

function controls(node: ReactNode): EventControl[] {
    if (!isValidElement<EventControl>(node)) return [];
    return [node.props, ...Children.toArray(node.props.children).flatMap(controls)];
}
function control(node: ReactNode, matches: (props: EventControl) => boolean) {
    const result = controls(node).find(matches);
    assert.ok(result, "Expected a control in the production card presenter");
    return result;
}
function props(overrides: Partial<CardProps> = {}): CardProps {
    return {
        board,
        details: true,
        expanded: false,
        onExpandedChange: () => {},
        detailsId: "test-board-details",
        ...overrides
    };
}
function html(overrides: Partial<CardProps> = {}) {
    return renderToStaticMarkup(createElement(PhotoBoardCardContent, props(overrides)));
}

test("drag suppression hides the profile and action overlays with the metadata, and leaving while pressed clears disclosure", () => {
    const closed: boolean[] = [];
    const cardProps = props({
        expanded: true,
        suppressHover: true,
        ownership: "owner",
        hoverActions: { editHref: "/boards/71/edit", viewHref: "/boards/71" },
        onExpandedChange: (value) => closed.push(value)
    });
    const view = PhotoBoardCardContent(cardProps);
    const markup = renderToStaticMarkup(view);
    assert.match(markup, /data-photo-board-expanded="false"/);
    assert.doesNotMatch(markup, /group-hover\/card:opacity-100|group-focus-within\/card:opacity-100/);
    for (const label of [`View @${board.author}'s profile`, `Edit ${board.title}`, `View ${board.title}`]) {
        const action = control(view, (item) => item["aria-label"] === label) as EventControl & { className: string };
        assert.match(action.className, /pointer-events-none opacity-0/);
        assert.match(action.className, /hover:scale-105/);
    }
    control(view, (item) => Boolean(item.onPointerLeave)).onPointerLeave?.({ buttons: 1 });
    assert.deepEqual(closed, [false]);
});

test("editable selections retain a separate native editor action and background link", () => {
    const actions = { selections: 0, disclosures: 0 };
    const selection = { selected: true, href: "/boards/71/edit", onSelect: () => actions.selections++ };
    const card = PhotoBoardCardContent(props({ selection, onExpandedChange: () => actions.disclosures++ }));
    const edit = control(card, (item) => item["aria-label"] === `Edit ${board.title}`);
    assert.equal(edit.href, "/boards/71/edit");
    assert.equal(edit.onClick, undefined, "Mouse, touch and keyboard activation keep native link navigation");
    assert.deepEqual(actions, { selections: 0, disclosures: 0 });
    const markup = html({ selection });
    assert.equal((markup.match(/href="\/boards\/71\/edit"/g) ?? []).length, 2);
    assert.match(markup, /lucide-pencil/);
    assert.match(markup, /aria-label="Show details for /);
    const unselected = html({ selection: { ...selection, selected: false, tabIndex: -1 } });
    assert.doesNotMatch(unselected, /href="\/boards\/71\/edit"|lucide-pencil/);
    assert.match(unselected, /aria-pressed="false"/);
});

test("a published owner card background and eye open its view while the pen opens its editor", () => {
    const card = PhotoBoardCardContent(
        props({
            ownership: "owner",
            selection: {
                selected: true,
                href: "/boards/71/edit",
                viewHref: "/boards/71",
                onSelect: () => assert.fail("A view click must not select")
            }
        })
    );
    const body = control(card, (item) => item["aria-label"] === `Open ${board.title}`);
    const eye = control(card, (item) => item["aria-label"] === `View ${board.title}`);
    const pen = control(card, (item) => item["aria-label"] === `Edit ${board.title}`);
    assert.equal(body.href, "/boards/71");
    assert.equal(eye.href, "/boards/71");
    assert.equal(pen.href, "/boards/71/edit");
    assert.equal(body.onClick, undefined);
    assert.equal(eye.onClick, undefined);
    assert.equal(pen.onClick, undefined);
    const readOnly = html({
        ownership: "owner",
        selection: { selected: true, viewHref: "/boards/71", onSelect() {} }
    });
    assert.match(readOnly, /aria-label="View /);
    assert.doesNotMatch(readOnly, /aria-label="Edit /);
});

function renderedFrame(node: ReactNode): ReactNode {
    if (!isValidElement<ComponentProps<typeof BoardCardFrame>>(node)) return;
    if (node.type === BoardCardFrame) return BoardCardFrame(node.props);
    return Children.toArray(node.props.children).map(renderedFrame).find(Boolean);
}

function clickEvent(detail = 1) {
    const state = { prevented: false, stopped: false };
    return {
        detail,
        get defaultPrevented() {
            return state.prevented;
        },
        preventDefault: () => {
            state.prevented = true;
        },
        stopPropagation: () => {
            state.stopped = true;
        }
    };
}

function requireNoVisibleDisclosure(markup: string) {
    assert.doesNotMatch(
        markup,
        />(?:Details|Close)(?:<|$)/,
        "The photograph must not have a visible Details/Close button"
    );
}

test("original V4 remains cover-only by default with unchanged proportions, attribution and optional navigation", () => {
    for (const sample of photoBoardExamples) {
        const markup = renderToStaticMarkup(createElement(PhotoBoardCard, { board: sample }));
        assert.match(markup, /aspect-ratio:400 \/ 500/);
        assert.ok(markup.includes(sample.author));
        assert.doesNotMatch(markup, /aria-expanded=|aria-pressed=|<button|href=/);
    }
    const markup = renderToStaticMarkup(createElement(PhotoBoardCard, { board, href: "/boards/71" }));
    assert.match(markup, /href="\/boards\/71"/);
    assert.ok(markup.includes(`aria-label="Open ${board.title}"`));
    assert.match(markup, /Oslo waterfront/);
    assert.ok(markup.includes(board.author));
});

test("metadata is opt-in, disclosed with a labelled control and truthful when expanded", () => {
    const collapsed = html();
    assert.match(collapsed, /aria-expanded="false"/);
    assert.match(collapsed, /aria-controls="test-board-details"/);
    assert.match(collapsed, /aria-label="Board details" aria-hidden="true" inert=""/);
    const expanded = html({ expanded: true });
    assert.match(expanded, /aria-expanded="true"/);
    assert.match(expanded, /Oslo, Norway/);
    assert.match(expanded, /Architecture/);
    assert.match(expanded, /Food &amp; Drink/);
    assert.match(expanded, /17/);
    assert.match(expanded, /3/);
    assert.match(expanded, /A quiet route along the waterfront/);
    assert.equal((expanded.match(/<img\b/g) ?? []).length, 1, "Revealing metadata must not duplicate the photo");
    requireNoVisibleDisclosure(collapsed);
    requireNoVisibleDisclosure(expanded);
});

test("V4 details pair persisted itinerary totals and place valid save totals beneath them", () => {
    const markup = html({ board: { ...board, durationDays: 4, activityCount: 12, savedCount: 128 }, expanded: true });
    const text = markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    assert.match(text, /4 days · 12 activities/);
    assert.match(text, /128 saves/);
    assert.ok(text.indexOf("4 days · 12 activities") < text.indexOf("128 saves"));
    const singular = html({ board: { ...board, durationDays: 1, activityCount: 1, savedCount: 1 }, expanded: true });
    assert.match(singular.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "), /1 day · 1 activity/);
    assert.match(singular, /1 save(?:<|\s)/);
});

test("V4 details omit unavailable or invalid optional counts while preserving a known zero", () => {
    const render = (overrides: Partial<PhotoBoardCardData>) =>
        html({ board: { ...board, durationDays: undefined, savedCount: undefined, ...overrides }, expanded: true })
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ");
    assert.doesNotMatch(render({}), /\b(?:days?|activities|activity|saves?)\b/);
    assert.match(render({ activityCount: 0, savedCount: 0 }), /0 activities\s+0 saves/);
    for (const invalid of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
        assert.doesNotMatch(
            render({ activityCount: invalid, savedCount: invalid }),
            /\b(?:activities|activity|saves?)\b/
        );
    }
});

test("an unlinked card reveals its story through a single full-card action and Escape dismisses it", () => {
    const expandedStates: boolean[] = [];
    const events = { stopped: 0, prevented: 0 };
    const event = {
        stopPropagation: () => events.stopped++,
        preventDefault: () => events.prevented++
    };
    const view = PhotoBoardCardContent(props({ onExpandedChange: (expanded) => expandedStates.push(expanded) }));
    const details = control(view, (candidate) => candidate["aria-expanded"] === false);
    assert.equal(details.type, "button");
    assert.ok(details.onClick);
    assert.equal(
        Children.count(details.children),
        0,
        "The disclosure action has an accessible label and no visible text"
    );
    details.onClick(event);
    assert.deepEqual(expandedStates, [true]);
    assert.ok(events.stopped > 0);
    const expanded = PhotoBoardCardContent(
        props({ expanded: true, onExpandedChange: (value) => expandedStates.push(value) })
    );
    const keyboard = control(expanded, (candidate) => !!candidate.onKeyDown);
    keyboard.onKeyDown?.({ ...event, key: "Escape" });
    assert.deepEqual(expandedStates, [true, false]);
});

test("known other-owner bookmark actions stay independent of card navigation and dragging", () => {
    const events = { toggles: 0, stopped: 0, expansions: 0 };
    const cardProps = props({
        ownership: "other",
        href: "/boards/71",
        onExpandedChange: () => events.expansions++,
        save: { state: "unsaved", onToggle: () => events.toggles++ }
    });
    const view = PhotoBoardCardContent(cardProps);
    const bookmark = control(view, (candidate) => candidate["aria-pressed"] === false);
    assert.equal(bookmark.type, "button");
    assert.equal(bookmark.disabled, false);
    assert.ok(bookmark.onClick);
    bookmark.onClick({ stopPropagation: () => events.stopped++ });
    assert.equal(events.toggles, 1);
    assert.ok(events.stopped > 0);
    assert.ok(bookmark.onPointerDownCapture);
    bookmark.onPointerDownCapture({ stopPropagation: () => events.stopped++ });
    assert.ok(events.stopped >= 2);
    assert.equal(events.expansions, 0, "Saving must not trigger the whole-card metadata action");
    const markup = renderToStaticMarkup(createElement(PhotoBoardCardContent, cardProps));
    assert.match(markup, /href="\/boards\/71"/);
    assert.doesNotMatch(markup, /<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<button/);
    assert.doesNotMatch(markup, /<button\b[^>]*>(?:(?!<\/button>)[\s\S])*<a\b/);
});

test("pending and unresolved saves remain unavailable without claiming unsaved membership", () => {
    const pending = html({ ownership: "other", save: { state: "saved", pending: true, onToggle: () => {} } });
    assert.match(pending, /aria-pressed="true"/);
    assert.match(pending, /disabled=""/);
    const unresolved = html({ ownership: "other", save: { state: "unknown", onToggle: () => {} } });
    assert.doesNotMatch(unresolved, /aria-pressed="false"/);
    assert.match(unresolved, /disabled=""/);
    assert.ok(!unresolved.includes(`aria-label="Save ${board.title}"`));
    const unknownOwner = html({ ownership: "unknown", save: { state: "saved", onToggle: () => {} } });
    assert.doesNotMatch(unknownOwner, /aria-pressed=|aria-label="(?:Save|Unsave|Public|Friends|Restricted)/);
});

test("owned Board indicators explain real visibility and drafts remain owner-only", () => {
    const publicBoard = html({ ownership: "owner", save: { state: "saved", onToggle: () => {} } });
    assert.match(publicBoard, /Public/);
    assert.doesNotMatch(publicBoard, /aria-pressed=|aria-label="(?:Save|Unsave)/);
    assert.match(html({ ownership: "owner", board: { ...board, visibility: "friends" } }), /Friends/);
    const restricted = html({ ownership: "owner", board: { ...board, visibility: "collaborators" } });
    assert.match(restricted, /[Rr]estricted/);
    assert.match(restricted, /invited (?:Board )?(?:members|people|users)/);
    assert.doesNotMatch(restricted, /[Pp]rivate|[Oo]nly you/);
    const draft = html({ ownership: "owner", board: { ...board, status: "draft", visibility: "public" } });
    assert.match(draft, /[Dd]raft/);
    assert.match(draft, /[Oo]nly you|owner.only/);
    assert.doesNotMatch(draft, /aria-label="Public/);
});

test("owned Boards with unresolved publication status do not imply configured visibility is currently effective", () => {
    const markup = html({
        ownership: "owner",
        board: { ...board, status: undefined, visibility: "public" },
        save: { state: "unsaved", onToggle: () => {} }
    });
    assert.doesNotMatch(markup, /aria-label="(?:Public|Friends|Restricted access|Draft) —/);
    assert.doesNotMatch(markup, /aria-pressed=|aria-label="(?:Save|Unsave) /);
    assert.ok(markup.includes(board.author));
});

test("featured visibility indicators use known access settings without granting owner actions", () => {
    for (const [visibility, label] of [
        ["public", "Public"],
        ["friends", "Friends"],
        ["collaborators", "Restricted access"]
    ] as const) {
        const markup = html({
            ownership: "other",
            showVisibility: true,
            board: { ...board, visibility },
            hoverActions: { viewHref: "/boards/71" },
            save: { state: "saved" }
        });
        assert.ok(markup.includes(`aria-label="${label}`));
        assert.match(markup, /aria-label="Unsave /);
        assert.doesNotMatch(markup, /aria-label="Edit /);
    }
    assert.doesNotMatch(
        html({ showVisibility: true, board: { ...board, status: undefined } }),
        /aria-label="(?:Public|Friends|Restricted access) /
    );
});

test("save feedback is accessible and unauthenticated users get the supplied sign-in destination", () => {
    const failed = html({ ownership: "other", save: { state: "unsaved", error: "Board access changed." } });
    assert.match(failed, /role="alert"/);
    assert.match(failed, /Board access changed/);
    const confirmed = html({ ownership: "other", save: { state: "saved", message: "Board saved." } });
    assert.match(confirmed, /role="status"|aria-live="polite"/);
    assert.match(confirmed, /Board saved/);
    const signIn = html({
        ownership: "other",
        save: { state: "unsaved", error: "Sign in to save this Board.", signInHref: "/login?next=%2Fboards%2F71" }
    });
    assert.match(signIn, /href="\/login\?next=%2Fboards%2F71"/);
});

test("missing metadata and photography preserve a useful card without invented counts or destinations", () => {
    const minimal: PhotoBoardCardData = {
        id: "draft-1",
        title: "An unfinished journey",
        author: "",
        destination: "",
        destinationLabel: ""
    };
    const markup = html({ board: minimal, expanded: true, reduceMotion: true });
    assert.match(markup, /data-photo-board-expanded="false"/, "An empty interactive card remains its cover view");
    assert.match(markup, /An unfinished journey/);
    assert.doesNotMatch(markup, /<img\b|0 saves|undefined|NaN|PORTO|Oslo|Architecture/);
    const zero = html({ board: { ...minimal, savedCount: 0 }, expanded: true, reduceMotion: true });
    assert.match(zero, /0 saves/);
});

test("a selected spatial card combines native selection and story toggling without another visible control", () => {
    const actions = { selections: 0, disclosures: [] as boolean[] };
    const cardProps = props({
        href: "/boards/71",
        selection: {
            selected: true,
            tabIndex: 0,
            onSelect: (event) => {
                assert.equal(event.detail, 0, "Keyboard-compatible activation reaches the owning gallery");
                actions.selections++;
            }
        },
        onExpandedChange: (expanded) => actions.disclosures.push(expanded)
    });
    const view = PhotoBoardCardContent(cardProps);
    const select = control(view, (candidate) => candidate["aria-label"] === `Select ${board.title}`);
    assert.equal(select.type, "button");
    assert.equal(select["aria-pressed"], true);
    assert.equal(select["aria-expanded"], false);
    assert.equal(select.tabIndex, 0);
    assert.ok(select.onClick);
    const event = clickEvent(0);
    select.onClick(event);
    assert.equal(actions.selections, 1);
    assert.deepEqual(actions.disclosures, [true]);
    const expanded = PhotoBoardCardContent({ ...cardProps, expanded: true });
    const close = control(expanded, (candidate) => candidate["aria-label"] === `Select ${board.title}`);
    close.onClick?.(clickEvent(0));
    assert.equal(actions.selections, 2);
    assert.deepEqual(actions.disclosures, [true, false]);
    const markup = renderToStaticMarkup(createElement(PhotoBoardCardContent, cardProps));
    assert.doesNotMatch(markup, /href="\/boards\/71"/, "Selection must not compete with a full-card navigation link");
    assert.doesNotMatch(markup, /<button\b[^>]*>(?:(?!<\/button>)[\s\S])*<button\b/);
    assert.equal((markup.match(/<button\b/g) ?? []).length, 1);
    requireNoVisibleDisclosure(markup);
    const inactive = PhotoBoardCardContent(
        props({
            details: false,
            selection: { selected: false, onSelect: () => {}, tabIndex: -1 }
        })
    );
    const inactiveSelect = control(inactive, (candidate) => candidate["aria-label"] === `Select ${board.title}`);
    assert.equal(inactiveSelect["aria-pressed"], false);
    assert.equal(inactiveSelect.tabIndex, -1);
    assert.ok(!controls(inactive).some((candidate) => candidate["aria-expanded"] !== undefined));
});

test("drag-suppressed gallery clicks and inactive card selection do not open the story", () => {
    const expandedStates: boolean[] = [];
    const selection = props({
        selection: { selected: true, onSelect: (event) => event.preventDefault() },
        onExpandedChange: (expanded) => expandedStates.push(expanded)
    });
    const dragged = control(
        PhotoBoardCardContent(selection),
        (candidate) => candidate["aria-label"] === `Select ${board.title}`
    );
    const suppressed = clickEvent();
    dragged.onClick?.(suppressed);
    assert.equal(suppressed.defaultPrevented, true);
    assert.equal(expandedStates.length, 0);
    const selections: number[] = [];
    const inactive = PhotoBoardCardContent(
        props({
            selection: { selected: false, onSelect: () => selections.push(1) },
            onExpandedChange: (expanded) => expandedStates.push(expanded)
        })
    );
    control(inactive, (candidate) => candidate["aria-label"] === `Select ${board.title}`).onClick?.(clickEvent());
    assert.deepEqual(selections, [1]);
    assert.deepEqual(expandedStates, [], "Selecting a neighboring card must retain its existing gallery workflow");
});

test("browsing gallery cards keep direct touch navigation and offer an independent details toggle", () => {
    for (const placement of ["library", "selected"] as const) {
        const expandedStates: boolean[] = [];
        const pointerType: NonNullable<CardProps["pointerType"]> = { current: "" };
        const cardProps = props({
            pointerType,
            ...(placement === "library"
                ? { href: "/boards/71", hoverActions: { viewHref: "/boards/71" } }
                : {
                      selection: {
                          selected: true,
                          viewHref: "/boards/71",
                          onSelect: () => assert.fail("Details must not select the card")
                      }
                  }),
            onExpandedChange: (expanded) => expandedStates.push(expanded)
        });
        const collapsed = PhotoBoardCardContent(cardProps);
        control(collapsed, (candidate) => !!candidate.onPointerDownCapture).onPointerDownCapture?.({
            pointerType: "touch",
            stopPropagation: () => {}
        });
        const navigation = control(
            placement === "library" ? renderedFrame(collapsed) : collapsed,
            (candidate) => candidate.href === "/boards/71"
        );
        const touch = clickEvent();
        navigation.onClick?.(touch);
        assert.equal(touch.defaultPrevented, false, "The card background opens its Board on the first touch");
        assert.deepEqual(expandedStates, []);
        const show = control(collapsed, (candidate) => candidate["aria-label"] === `Show details for ${board.title}`);
        assert.equal(show.type, "button");
        assert.equal(show["aria-expanded"], false);
        assert.equal(show["aria-controls"], "test-board-details");
        show.onClick?.(clickEvent());
        assert.deepEqual(expandedStates, [true]);
        const expanded = PhotoBoardCardContent({ ...cardProps, expanded: true });
        const markup = renderToStaticMarkup(expanded);
        assert.match(markup, /id="test-board-details"[^>]*aria-label="Board details" aria-hidden="false"/);
        assert.match(markup, /A quiet route along the waterfront\./);
        assert.match(markup, /Architecture/);
        assert.match(markup, /17 saves/);
        const hide = control(expanded, (candidate) => candidate["aria-label"] === `Hide details for ${board.title}`);
        assert.equal(hide["aria-expanded"], true);
        hide.onClick?.(clickEvent());
        assert.deepEqual(expandedStates, [true, false]);
        assert.match(html({ ...cardProps, expanded: false }), /aria-label="Board details" aria-hidden="true"/);
        assert.doesNotMatch(markup, /<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<button\b/);
    }
});

test("inactive gallery cards do not expose a touch details action", () => {
    const markup = html({
        details: false,
        selection: { selected: false, viewHref: "/boards/71", onSelect() {}, tabIndex: -1 }
    });
    assert.doesNotMatch(markup, /aria-label="(?:Show|Hide) details for /);
    assert.match(markup, /aria-label="Select /);
    assert.doesNotMatch(markup, /href="\/boards\/71"/);
});

test("linked cards preview on the first touch and preserve navigation on the next touch", () => {
    const expandedStates: boolean[] = [];
    const pointerType: NonNullable<CardProps["pointerType"]> = { current: "" };
    const cardProps = props({
        href: "/boards/71",
        pointerType,
        onExpandedChange: (expanded) => expandedStates.push(expanded)
    });
    const collapsed = PhotoBoardCardContent(cardProps);
    control(collapsed, (candidate) => !!candidate.onPointerDownCapture).onPointerDownCapture?.({
        pointerType: "touch",
        stopPropagation: () => {}
    });
    const firstTouch = clickEvent();
    control(renderedFrame(collapsed), (candidate) => candidate.href === "/boards/71").onClick?.(firstTouch);
    assert.equal(firstTouch.defaultPrevented, true);
    assert.deepEqual(expandedStates, [true]);
    const expanded = PhotoBoardCardContent({ ...cardProps, expanded: true });
    control(expanded, (candidate) => !!candidate.onPointerDownCapture).onPointerDownCapture?.({
        pointerType: "touch",
        stopPropagation: () => {}
    });
    const nextTouch = clickEvent();
    control(renderedFrame(expanded), (candidate) => candidate.href === "/boards/71").onClick?.(nextTouch);
    assert.equal(nextTouch.defaultPrevented, false, "The second touch can follow the original Board link");
    assert.deepEqual(expandedStates, [true]);
    const markup = html({ ...cardProps, expanded: true });
    assert.match(markup, /aria-describedby="test-board-details"/);
    assert.doesNotMatch(markup, /<button\b/);
    requireNoVisibleDisclosure(markup);
});

test("first touch still previews if focus reveals metadata between pointer down and click", () => {
    const pointerType: NonNullable<CardProps["pointerType"]> = { current: "" };
    const expandedStates: boolean[] = [];
    const cardProps = props({
        href: "/boards/71",
        pointerType,
        onExpandedChange: (expanded) => expandedStates.push(expanded)
    });
    const collapsed = PhotoBoardCardContent(cardProps);
    control(collapsed, (candidate) => !!candidate.onPointerDownCapture).onPointerDownCapture?.({
        pointerType: "touch",
        stopPropagation: () => {}
    });
    const focused = PhotoBoardCardContent({ ...cardProps, expanded: true });
    const click = clickEvent();
    control(renderedFrame(focused), (candidate) => candidate.href === "/boards/71").onClick?.(click);
    assert.equal(click.defaultPrevented, true);
    assert.deepEqual(expandedStates, [true]);
});

test("linked cards preserve mouse and keyboard navigation without consuming a stale touch marker", () => {
    const pointerType: NonNullable<CardProps["pointerType"]> = { current: "" };
    const expandedStates: boolean[] = [];
    const cardProps = props({
        href: "/boards/71",
        pointerType,
        onExpandedChange: (expanded) => expandedStates.push(expanded)
    });
    const view = PhotoBoardCardContent(cardProps);
    const rootPointer = control(view, (candidate) => !!candidate.onPointerDownCapture);
    rootPointer.onPointerDownCapture?.({ pointerType: "mouse", stopPropagation: () => {} });
    const mouse = clickEvent();
    control(renderedFrame(view), (candidate) => candidate.href === "/boards/71").onClick?.(mouse);
    assert.equal(mouse.defaultPrevented, false);
    rootPointer.onPointerDownCapture?.({ pointerType: "touch", stopPropagation: () => {} });
    control(view, (candidate) => !!candidate.onKeyDown).onKeyDown?.({
        key: "Enter",
        preventDefault: () => {},
        stopPropagation: () => {}
    });
    const keyboard = clickEvent(0);
    control(renderedFrame(view), (candidate) => candidate.href === "/boards/71").onClick?.(keyboard);
    assert.equal(keyboard.defaultPrevented, false);
    assert.deepEqual(expandedStates, []);
});

test("bookmark touch activation stays independent of a selected card's full-card disclosure action", () => {
    const actions = { saves: 0, selects: 0, expansions: 0, stopped: 0 };
    const pointerType: NonNullable<CardProps["pointerType"]> = { current: "" };
    const cardProps = props({
        ownership: "other",
        pointerType,
        selection: { selected: true, onSelect: () => actions.selects++ },
        save: { state: "unsaved", onToggle: () => actions.saves++ },
        onExpandedChange: () => actions.expansions++
    });
    const view = PhotoBoardCardContent(cardProps);
    const event = { pointerType: "touch", stopPropagation: () => actions.stopped++ };
    control(view, (candidate) => !!candidate.onPointerDownCapture).onPointerDownCapture?.(event);
    const save = control(view, (candidate) => candidate["aria-label"] === `Save ${board.title}`);
    save.onPointerDownCapture?.(event);
    save.onClick?.(event);
    assert.equal(actions.saves, 1);
    assert.equal(actions.selects, 0);
    assert.equal(actions.expansions, 0);
    assert.equal(actions.stopped, 2);
    const markup = renderToStaticMarkup(createElement(PhotoBoardCardContent, cardProps));
    assert.equal((markup.match(/<button\b/g) ?? []).length, 2, "The bookmark and card action are siblings");
    assert.doesNotMatch(markup, /<button\b[^>]*>(?:(?!<\/button>)[\s\S])*<button\b/);
    requireNoVisibleDisclosure(markup);
});

test("assistive-technology link activation navigates after a bookmark touch without requiring a keydown", () => {
    const pointerType: NonNullable<CardProps["pointerType"]> = { current: "" };
    const actions = { saves: 0, expansions: 0 };
    const cardProps = props({
        href: "/boards/71",
        ownership: "other",
        pointerType,
        save: { state: "unsaved", onToggle: () => actions.saves++ },
        onExpandedChange: () => actions.expansions++
    });
    const view = PhotoBoardCardContent(cardProps);
    control(view, (candidate) => !!candidate.onPointerDownCapture).onPointerDownCapture?.({
        pointerType: "touch",
        stopPropagation: () => {}
    });
    const bookmark = control(view, (candidate) => candidate["aria-label"] === `Save ${board.title}`);
    bookmark.onPointerDownCapture?.({ stopPropagation: () => {} });
    bookmark.onClick?.(clickEvent());
    assert.equal(actions.saves, 1);
    const assistedActivation = clickEvent(0);
    control(renderedFrame(view), (candidate) => candidate.href === "/boards/71").onClick?.(assistedActivation);
    assert.equal(assistedActivation.defaultPrevented, false);
    assert.equal(actions.expansions, 0);
});

test("a departing gallery card still clears hover after metadata is disabled without re-enabling disclosure", () => {
    const hoverStates: boolean[] = [];
    const disclosureStates: boolean[] = [];
    const interaction = {
        onHoverChange: (hovered: boolean) => hoverStates.push(hovered),
        onExpandedChange: (expanded: boolean) => disclosureStates.push(expanded)
    };
    const active = PhotoBoardCardContent(props(interaction));
    const entering = control(active, (candidate) => !!candidate.onHoverStart);
    entering.onHoverStart?.();
    assert.deepEqual(hoverStates, [true]);
    const departingProps = props({ ...interaction, details: false, expanded: true });
    const departing = PhotoBoardCardContent(departingProps);
    assert.ok(!controls(departing).some((candidate) => candidate.onHoverStart));
    assert.ok(!controls(departing).some((candidate) => candidate["aria-expanded"] !== undefined));
    const leaving = control(departing, (candidate) => !!candidate.onHoverEnd);
    leaving.onHoverEnd?.();
    assert.deepEqual(hoverStates, [true, false], "The gallery must be able to clear its previous hover state");
    assert.deepEqual(disclosureStates, []);
    const markup = renderToStaticMarkup(createElement(PhotoBoardCardContent, departingProps));
    assert.match(markup, /data-photo-board-expanded="false"/);
    assert.doesNotMatch(markup, /aria-label="Board details"|aria-expanded=/);
});

test("fixed cover and details presentations ignore interaction state and never mutate disclosure, focus or hover", () => {
    for (const presentation of ["cover", "details"] as const) {
        const mutations = { expanded: [] as boolean[], hovered: [] as boolean[], focused: [] as boolean[] };
        const cardProps = props({
            presentation,
            details: presentation === "cover",
            expanded: presentation === "cover",
            onExpandedChange: (value) => mutations.expanded.push(value),
            onHoverChange: (value) => mutations.hovered.push(value),
            onFocusChange: (value) => mutations.focused.push(value)
        });
        const view = PhotoBoardCardContent(cardProps);
        const root = controls(view)[0];
        assert.equal(root["data-photo-board-expanded"], presentation === "details");
        root.onHoverStart?.();
        root.onHoverEnd?.();
        root.onPointerDownCapture?.({ pointerType: "touch", stopPropagation: () => {} });
        root.onFocusCapture?.({
            currentTarget: { contains: () => false },
            target: { matches: () => true },
            relatedTarget: null
        });
        root.onBlurCapture?.({ currentTarget: { contains: () => false }, relatedTarget: null });
        root.onKeyDown?.({ key: "Escape", preventDefault: () => {}, stopPropagation: () => {} });
        assert.deepEqual(mutations, { expanded: [], hovered: [], focused: [] });
        const markup = renderToStaticMarkup(createElement(PhotoBoardCardContent, cardProps));
        assert.doesNotMatch(markup, /<button\b|aria-expanded=/, "Fixed states do not offer a disclosure action");
        requireNoVisibleDisclosure(markup);
        if (presentation === "details") {
            assert.match(markup, /aria-label="Board details" aria-hidden="false"/);
            assert.match(markup, /Architecture/);
            assert.match(markup, /17 saves/);
        } else {
            assert.doesNotMatch(markup, /aria-label="Board details" aria-hidden="false"/);
        }
    }
});

test("fixed details honors its explicit expanded presentation without fabricating optional metadata", () => {
    const minimal: PhotoBoardCardData = {
        id: "unpopulated",
        title: "An unfinished journey",
        author: "",
        destination: "",
        destinationLabel: ""
    };
    const markup = html({ board: minimal, details: false, presentation: "details", expanded: true });
    assert.match(markup, /data-photo-board-expanded="true"/);
    assert.match(markup, /aria-label="Board details" aria-hidden="false"/);
    assert.match(markup, /THE JOURNEY/);
    assert.match(markup, /An unfinished journey/);
    assert.match(markup, /No cover photo/);
    assert.doesNotMatch(markup, /0 saves|0 days|Board tags|<button\b|undefined|NaN/);
});

test("fixed presentations retain ordinary touch navigation without the interactive preview interception", () => {
    for (const presentation of ["cover", "details"] as const) {
        const mutations: boolean[] = [];
        const cardProps = props({
            presentation,
            href: "/boards/71",
            onExpandedChange: (value) => mutations.push(value)
        });
        const view = PhotoBoardCardContent(cardProps);
        controls(view)[0].onPointerDownCapture?.({ pointerType: "touch", stopPropagation: () => {} });
        const click = clickEvent();
        control(renderedFrame(view), (candidate) => candidate.href === "/boards/71").onClick?.(click);
        assert.equal(click.defaultPrevented, false);
        assert.deepEqual(mutations, []);
    }
});

test("destination cover typography retains real in-card titles and authors without changing standard selected V4 or photo fallback", () => {
    const standard = html({ details: false });
    assert.equal(html({ details: false, galleryCover: false }), standard);
    const background = html({ galleryCover: true, details: false, selection: { selected: false, onSelect() {} } });
    assert.match(background, /<h3\b/);
    assert.ok(background.includes(`aria-label="${board.title}"`));
    assert.ok(background.includes(`title="by ${board.author}"`));
    assert.ok(background.includes(`by ${board.author}`));
    assert.match(background, /\/api\/v1\/images\/42\/content\?variant=display/);
    assert.match(background, />OSLO<\/span>/);
    assert.ok(background.includes(`aria-label="Select ${board.title}"`));
    assert.match(background, /aspect-ratio:400 \/ 500/);
    assert.match(html({ galleryCover: true, details: false, board: { ...board, image: undefined } }), /No cover photo/);
    assert.match(standard, /left:40\.75%/);
    assert.match(
        html({ galleryCover: true, details: false }),
        /left:40\.75%/,
        "The destination opt-in must not globally shift watermarks"
    );
    assert.match(html({ board: { ...board, labelOffset: 33 }, galleryCover: true }), /left:33%/);
});

test("destination cover keeps one flowing title-author composition across selection states and title lengths", () => {
    for (const title of ["Stockholm", "Stockholm islands and coffee", "gypq gypq gypq gypq gypq gypq"]) {
        const covers = [false, true].map((selected) => {
            const markup = html({
                board: { ...board, title, author: "traveller" },
                galleryCover: true,
                details: false,
                selection: { selected, onSelect() {} }
            });
            const group = markup.match(
                /<div class="font-body absolute[^\"]*flex-col[^\"]*">\s*<h3[^>]*>[^<]*<\/h3>\s*<p[^>]*>by traveller<\/p><\/div>/
            );
            assert.ok(group, "The author must follow the title inside the same flowing cover group");
            assert.match(markup, new RegExp(`aria-label="${title}"`));
            return group[0];
        });
        assert.equal(covers[0], covers[1], "Promoting a cover must not rearrange its typography");
    }
});

test("destination cover typography remains independent of account actions, metadata, author identity and confirmed bookmark feedback", () => {
    const calls = { saves: 0 };
    const view = PhotoBoardCardContent(
        props({
            galleryCover: true,
            ownership: "other",
            expanded: true,
            hoverActions: { viewHref: "/boards/71" },
            save: {
                state: "saved",
                onToggle: () => {
                    calls.saves++;
                }
            }
        })
    );
    const bookmark = control(view, (candidate) => candidate["aria-label"] === `Unsave ${board.title}`);
    bookmark.onClick?.({ stopPropagation() {} });
    assert.equal(calls.saves, 1);
    const markup = renderToStaticMarkup(view);
    assert.match(markup, /aria-pressed="true"/);
    assert.match(markup, /href="\/boards\/71"/);
    assert.match(markup, /href="\/profile\/a_long_and_complete_author_handle"/);
    assert.match(markup, /aria-label="Board details" aria-hidden="false"/);
    assert.match(markup, /A quiet route along the waterfront\./);
});
