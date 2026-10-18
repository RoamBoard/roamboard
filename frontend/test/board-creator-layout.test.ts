import assert from "node:assert/strict";
import test from "node:test";
import { createElement, isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import NewBoardPage from "../src/app/boards/new/page";
import EditDraftPage from "../src/app/boards/drafts/[boardId]/page";
import EditPublishedBoardPage from "../src/app/boards/[boardId]/edit/page";
import BoardCreator from "../src/components/features/boards/BoardCreator";
import BoardCoverHero from "../src/components/features/boards/BoardCoverHero";
import BoardImageIntake from "../src/components/features/boards/BoardImageIntake";
import type { BoardImageDraft } from "../src/types/board-creator";

// Render the real route's editor child without the sidebar's browser navigation context.
function editorMarkup(page: ReactElement<{ children: unknown }>): string {
    assert.ok(isValidElement(page.props.children));
    assert.equal(page.props.children.type, BoardCreator);
    return renderToStaticMarkup(page.props.children);
}

function sharedEditorControls(markup: string) {
    assert.match(markup, /<label[^>]*for="board-title"[^>]*>Board title<\/label>/);
    assert.match(markup, /<input[^>]*id="board-title"/);
    assert.match(markup, /Description\s*<textarea/);
    assert.match(markup, /aria-label="Upload Board images"/);
    assert.match(markup, /aria-label="Edit Board cover"/);
    for (const section of ["board-basics", "day-plan", "details-discovery", "board-preview"]) {
        assert.ok(markup.includes(`id="${section}"`), `The ${section} chapter must remain available`);
    }
    assert.match(markup, />Save as draft<\/button>/);
    assert.match(markup, /aria-label="Publish Board"/);
}

function controlTag(markup: string, selector: string): string {
    const tag = markup.match(new RegExp(`<[^>]+${selector}[^>]*>`))?.[0];
    assert.ok(tag, `Expected control ${selector}`);
    return tag;
}

test("new Boards place Smart Create after Board Basics and before the day planner", async () => {
    const markup = editorMarkup(await NewBoardPage({ searchParams: Promise.resolve({}) }));
    assert.match(markup, /SMART CREATE/);
    assert.match(markup, /You can edit every suggestion/);
    assert.match(markup, /Choose photos/);
    assert.doesNotMatch(markup, /Switch to|Intelligence Engine/);
    assert.match(markup, /Up to 30 photos per batch/);
    assert.doesNotMatch(markup, /Add activity photos in Smart Create below/);
    assert.match(markup, /Already back from your trip/);
    const sections = [
        'aria-label="Edit Board cover"',
        'id="board-title"',
        'id="board-basics"',
        'id="image-intake-heading"',
        'id="day-plan"'
    ];
    for (const [index, section] of sections.entries()) {
        assert.ok(markup.includes(section));
        if (index > 0) assert.ok(markup.indexOf(sections[index - 1]) < markup.indexOf(section));
    }
    sharedEditorControls(markup);
    assert.doesNotMatch(controlTag(markup, 'id="board-title"'), / disabled=""/);
    assert.doesNotMatch(controlTag(markup, 'aria-label="Upload Board images"'), / disabled=""/);
    assert.doesNotMatch(markup, /<fieldset[^>]* disabled=""/);
});

test("reopening drafts and published Boards starts locked without creation-mode choices or sample cover", async () => {
    const pages = [
        await EditDraftPage({ params: Promise.resolve({ boardId: "42" }) }),
        await EditPublishedBoardPage({ params: Promise.resolve({ boardId: "42" }) })
    ];
    for (const page of pages) {
        const markup = editorMarkup(page);
        assert.doesNotMatch(markup, /SMART CREATE|drop your|Switch to/);
        assert.match(markup, /Loading Board/);
        // A disabled fieldset disables all descendant fields, not just the title.
        assert.match(markup, /<fieldset[^>]*disabled=""[^>]*aria-busy="true"/);
        const fieldset = markup.match(/<fieldset[\s\S]*?<\/fieldset>/)?.[0];
        assert.ok(fieldset);
        assert.match(fieldset, /id="board-title"/);
        assert.match(fieldset, /<textarea/);
        assert.match(controlTag(markup, 'aria-label="Upload Board images"'), /disabled=""/);
        assert.match(controlTag(markup, 'aria-label="Edit Board cover"'), /disabled=""/);
        const saveButtons = [
            ...markup.matchAll(/<button([^>]*)>(Save as draft|Publish Board|Save changes)<\/button>/g)
        ];
        assert.ok(saveButtons.length > 0);
        for (const button of saveButtons) assert.match(button[1], /disabled=""/);
        assert.doesNotMatch(markup, /bamboo\.webp|Default image/);
    }
});

function uploadedImage(id: number): BoardImageDraft {
    return {
        id: `photo-${id}`,
        uploadedImageId: id,
        pinId: null,
        publicId: String(id),
        source: "upload",
        url: `https://api.example.test/api/v1/images/${id}/content`,
        thumbnailUrl: `https://api.example.test/api/v1/images/${id}/thumbnail`,
        width: 1200,
        height: 800,
        capturedAt: null,
        latitude: null,
        longitude: null,
        order: id - 1,
        credit: null,
        creditUrl: null,
        sourceUrl: null
    };
}

function intakeMarkup(images: BoardImageDraft[], coverImageId: number | null, showDropZone: boolean, disabled = false) {
    return renderToStaticMarkup(
        createElement(BoardImageIntake, {
            images,
            coverImageId,
            showDropZone,
            disabled,
            onSelectCover: () => {},
            onUploaded: () => {},
            onRemove: () => {}
        })
    );
}

test("both intake variants respect the controlled cover and retain uploaded-photo controls", () => {
    for (const showDropZone of [true, false]) {
        const markup = intakeMarkup([uploadedImage(1), uploadedImage(2)], 2, showDropZone);
        assert.match(
            markup,
            /<img[^>]*src="https:\/\/api\.example\.test\/api\/v1\/images\/2\/content"[^>]*alt="Board cover"/
        );
        assert.doesNotMatch(markup, /_next\/image|bamboo\.webp/);
        assert.match(markup, /aria-label="Uploaded Board images"/);
        assert.match(markup, /Set as cover/);
        assert.match(markup, /aria-label="Remove image 1"/);
        assert.match(markup, /aria-label="Remove image 2"/);
        assert.doesNotMatch(controlTag(markup, 'aria-label="Upload Board images"'), / disabled=""/);
        assert.match(controlTag(markup, 'aria-label="Upload Board images"'), /multiple=""/);
        assert.match(controlTag(markup, 'aria-label="Upload Board images"'), /accept="image\/\*,\.heic,\.heif"/);
    }
});

test("existing uploads do not prevent another thirty-photo batch", () => {
    const images = Array.from({ length: 31 }, (_, index) => uploadedImage(index + 1));
    for (const showDropZone of [true, false]) {
        const markup = intakeMarkup(images, 1, showDropZone);
        assert.doesNotMatch(controlTag(markup, 'aria-label="Upload Board images"'), /disabled=""/);
        assert.doesNotMatch(controlTag(markup, 'aria-label="Edit Board cover"'), /disabled=""/);
        assert.doesNotMatch(controlTag(markup, 'aria-label="Remove image 10"'), / disabled=""/);
        assert.match(markup, /Set as cover/);
    }
});

test("a disabled intake disables upload, remove and cover-selection controls in both variants", () => {
    for (const showDropZone of [true, false]) {
        const markup = intakeMarkup([uploadedImage(1), uploadedImage(2)], 1, showDropZone, true);
        for (const control of markup.matchAll(/<(?:input|button)\b[^>]*>/g)) {
            assert.match(control[0], /disabled=""/);
        }
    }
});

test("cover hero uses a credited default only when there is no uploaded cover and no loading", () => {
    const props = { disabled: false, onChooseImages: () => {} };
    const empty = renderToStaticMarkup(createElement(BoardCoverHero, props));
    assert.match(empty, /bamboo/);
    assert.match(empty, /Default image/);
    assert.match(empty, /Karen Chew/);

    const protectedUrl = "https://api.example.test/api/v1/images/12/content?variant=full&version=3";
    const selected = renderToStaticMarkup(createElement(BoardCoverHero, { ...props, coverUrl: protectedUrl }));
    assert.match(
        selected,
        /src="https:\/\/api\.example\.test\/api\/v1\/images\/12\/content\?variant=full&amp;version=3"/
    );
    assert.doesNotMatch(selected, /_next\/image|Default image|bamboo/);

    for (const coverUrl of [undefined, protectedUrl]) {
        const loading = renderToStaticMarkup(createElement(BoardCoverHero, { ...props, coverUrl, loading: true }));
        assert.doesNotMatch(loading, /<img|Default image|bamboo/);
        assert.match(controlTag(loading, 'aria-label="Edit Board cover"'), /disabled=""/);
    }
});
