import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { createRoamPromptStore, ROAM_PROMPT } from "../src/lib/roam-prompt";

function fixture(context: TestContext, text = ROAM_PROMPT) {
    context.mock.timers.enable({ apis: ["setTimeout", "Date"] });
    const prompt = createRoamPromptStore({ text });
    context.after(() => prompt.dispose());
    return prompt;
}

function advance(context: TestContext, duration: number) {
    Array.from({ length: Math.ceil(duration / 10) }).forEach((_, index) => {
        context.mock.timers.tick(Math.min(10, duration - index * 10));
    });
}

test("the entrance reveals the real question once, in readable prefix order", (context) => {
    const prompt = fixture(context);
    assert.equal(ROAM_PROMPT, "so, where is it you wish to go?");
    assert.equal(prompt.getSnapshot(), "");
    const frames: string[] = [];
    prompt.subscribe(() => frames.push(prompt.getSnapshot()));
    prompt.start();
    context.mock.timers.tick(179);
    assert.equal(prompt.getSnapshot(), "");
    context.mock.timers.tick(1);
    assert.equal(prompt.getSnapshot(), "s");
    advance(context, 2000);
    assert.equal(prompt.getSnapshot(), ROAM_PROMPT);
    assert.ok(frames.length > 10, "the prompt should be typed rather than revealed as one block");
    frames.forEach((frame, index) => {
        assert.ok(ROAM_PROMPT.startsWith(frame));
        assert.equal(frame.length, index + 1, "characters may only be appended in order");
    });
    prompt.start();
    advance(context, 8000);
    assert.equal(frames.length, ROAM_PROMPT.length, "focus or rerender must not replay the entrance");
});

test("typing has varied intervals and a deliberate pause after punctuation", (context) => {
    const prompt = fixture(context, "ab, cd ef");
    const frames: Array<{ text: string; at: number }> = [];
    prompt.subscribe(() => frames.push({ text: prompt.getSnapshot(), at: Date.now() }));
    prompt.start();
    advance(context, 4000);
    const intervals = frames.slice(1).map((frame, index) => ({
        after: frames[index].text.at(-1),
        delay: frame.at - frames[index].at
    }));
    const letterIntervals = intervals.filter((interval) => /[a-z]/.test(interval.after ?? ""));
    assert.ok(new Set(letterIntervals.map((interval) => interval.delay)).size > 1);
    letterIntervals.forEach(({ delay }) => assert.ok(delay >= 35 && delay <= 75));
    const commaPause = intervals.find(({ after }) => after === ",");
    assert.ok(commaPause);
    assert.ok(commaPause.delay >= 145, "punctuation should provide a human pause before the next character");
});

test("the complete question arrives promptly while retaining a deliberate entrance", (context) => {
    const prompt = fixture(context);
    prompt.start();
    advance(context, 1000);
    assert.ok(prompt.getSnapshot().length > 0);
    assert.ok(prompt.getSnapshot().length < ROAM_PROMPT.length);
    advance(context, 1200);
    assert.equal(prompt.getSnapshot(), ROAM_PROMPT, "the faster entrance should complete in about two seconds");
});

test("early interaction immediately yields the presentation and stops publishing animated frames", (context) => {
    const prompt = fixture(context);
    const frames: string[] = [];
    prompt.subscribe(() => frames.push(prompt.getSnapshot()));
    prompt.start();
    advance(context, 500);
    assert.ok(prompt.getSnapshot().length < ROAM_PROMPT.length);
    prompt.yield();
    assert.equal(prompt.getSnapshot(), ROAM_PROMPT);
    const count = frames.length;
    advance(context, 10000);
    prompt.start();
    prompt.yield();
    advance(context, 10000);
    assert.equal(frames.length, count, "presentation must stop publishing animation frames after interaction");
});

test("interaction before the first frame makes the question available immediately", (context) => {
    const prompt = fixture(context);
    prompt.yield();
    assert.equal(prompt.getSnapshot(), ROAM_PROMPT);
    prompt.start();
    advance(context, 10000);
    assert.equal(prompt.getSnapshot(), ROAM_PROMPT);
});

test("reduced motion skips the typewriter and can finish an entrance already in progress", (context) => {
    const prompt = fixture(context);
    const frames: string[] = [];
    prompt.subscribe(() => frames.push(prompt.getSnapshot()));
    prompt.start();
    advance(context, 500);
    prompt.start({ reducedMotion: true });
    assert.equal(prompt.getSnapshot(), ROAM_PROMPT);
    const count = frames.length;
    advance(context, 10000);
    assert.equal(frames.length, count);
});

test("an initially reduced-motion entrance is immediately complete", (context) => {
    const prompt = fixture(context);
    prompt.start({ reducedMotion: true });
    assert.equal(prompt.getSnapshot(), ROAM_PROMPT);
    advance(context, 10000);
    assert.equal(prompt.getSnapshot(), ROAM_PROMPT);
});

test("repeated starts while typing do not reset or duplicate character timers", (context) => {
    const prompt = fixture(context);
    const frames: string[] = [];
    prompt.subscribe(() => frames.push(prompt.getSnapshot()));
    prompt.start();
    context.mock.timers.tick(100);
    prompt.start();
    context.mock.timers.tick(80);
    assert.equal(prompt.getSnapshot(), "s");
    advance(context, 8000);
    assert.equal(prompt.getSnapshot(), ROAM_PROMPT);
    assert.equal(frames.length, ROAM_PROMPT.length);
});

test("cleanup stops all frames and lets an interrupted entrance safely resume", (context) => {
    const prompt = fixture(context);
    const frames: string[] = [];
    const unsubscribe = prompt.subscribe(() => frames.push(prompt.getSnapshot()));
    prompt.start();
    advance(context, 600);
    const partial = prompt.getSnapshot();
    prompt.dispose();
    const count = frames.length;
    advance(context, 10000);
    assert.equal(prompt.getSnapshot(), partial);
    assert.equal(frames.length, count);
    unsubscribe();
    prompt.start();
    advance(context, 8000);
    assert.equal(prompt.getSnapshot(), ROAM_PROMPT);
    assert.equal(frames.length, count);
});
