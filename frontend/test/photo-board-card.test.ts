import assert from "node:assert/strict";
import test from "node:test";
import { Children, createElement, isValidElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PhotoBoardCard, { PhotoBoardCardContent } from "../src/components/features/boards/cards/PhotoBoardCard";
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
type CardProps = ComponentProps<typeof PhotoBoardCardContent>;
type EventControl = {
    children?: ReactNode;
    type?: string;
    disabled?: boolean;
    href?: string;
    tabIndex?: number;
    "aria-expanded"?: boolean;
    "aria-pressed"?: boolean;
    "aria-label"?: string;
    onClick?: (event: { stopPropagation: () => void }) => void;
    onPointerDownCapture?: (event: { stopPropagation: () => void; pointerType?: string }) => void;
    onKeyDown?: (event: { key: string; stopPropagation: () => void; preventDefault: () => void }) => void;
    onHoverStart?: () => void;
    onHoverEnd?: () => void;
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
