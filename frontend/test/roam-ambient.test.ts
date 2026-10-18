import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { createRoamAmbientScheduler } from "../src/lib/roam-ambient";
import { roamLandmarks } from "../src/lib/roam-landmarks";

function fixture(context: TestContext, random = () => 0) {
    context.mock.timers.enable({ apis: ["setTimeout", "Date"] });
    const scheduler = createRoamAmbientScheduler({ random });
    context.after(() => scheduler.dispose());
    return scheduler;
}

function advance(context: TestContext, duration: number, inspect = () => {}) {
    Array.from({ length: Math.ceil(duration / 100) }).forEach((_, index) => {
        context.mock.timers.tick(Math.min(100, duration - index * 100));
        inspect();
    });
}

function arrivals(scheduler: ReturnType<typeof createRoamAmbientScheduler>) {
    const seen = new Set<number>();
    const moments: Array<ReturnType<typeof scheduler.getSnapshot>[number]> = [];
    scheduler.subscribe(() => {
        scheduler.getSnapshot().forEach((moment) => {
            if (seen.has(moment.id)) return;
            seen.add(moment.id);
            moments.push(moment);
        });
    });
    return moments;
}

test("arrival stays quiet until focus, then allows a deliberate delay before the first fragment", (context) => {
    const scheduler = fixture(context);
    advance(context, 60000);
    assert.deepEqual(scheduler.getSnapshot(), []);
    scheduler.setState({ focused: true });
    context.mock.timers.tick(699);
    assert.deepEqual(scheduler.getSnapshot(), []);
    context.mock.timers.tick(1);
    assert.equal(scheduler.getSnapshot().length, 1);
});

test("the first arrival varies inside the curated timing window", (context) => {
    const scheduler = fixture(context, () => 0.999);
    scheduler.setState({ focused: true });
    context.mock.timers.tick(700);
    assert.equal(scheduler.getSnapshot().length, 0);
    advance(context, 600);
    assert.equal(scheduler.getSnapshot().length, 1);
});

test("the cadence can occasionally pause longer before another fragment joins the composition", (context) => {
    const scheduler = fixture(context, () => 0.999);
    const history = arrivals(scheduler);
    scheduler.setState({ focused: true });
    advance(context, 1400);
    assert.equal(history.length, 1);
    advance(context, 4500);
    assert.equal(history.length, 1, "occasional pauses should exceed the ordinary 3.4-second maximum");
    advance(context, 1000);
    assert.equal(history.length, 2);
});

test("desktop builds overlapping illustrations without sharing regions or repeating recent landmarks", (context) => {
    const scheduler = fixture(context);
    const history = arrivals(scheduler);
    const concurrency = new Set<number>();
    scheduler.setState({ focused: true });
    advance(context, 120000, () => {
        const visible = scheduler.getSnapshot();
        concurrency.add(visible.length);
        assert.ok(visible.length <= 3, "the canvas never contains more than three fragments");
        assert.equal(new Set(visible.map((moment) => moment.region)).size, visible.length);
    });
    assert.ok(concurrency.has(3), "the composition should support three overlapping fragments");
    assert.ok(history.length >= 8);
    history.forEach((moment, index) => {
        const recent = history.slice(Math.max(0, index - 6), index);
        assert.ok(!recent.some((previous) => previous.landmark === moment.landmark));
        assert.ok(
            roamLandmarks.some(({ id }) => id === moment.landmark),
            "every admission resolves to a real illustration"
        );
        if (index === 0) return;
        assert.notEqual(moment.region, history[index - 1].region, "successive fragments move around the canvas");
    });
});

test("the illustration gallery visits the full collection once before beginning another shuffled cycle", (context) => {
    const sequence = { index: 0 };
    const scheduler = fixture(context, () => {
        sequence.index += 1;
        return (sequence.index * 0.61803398875) % 1;
    });
    const history = arrivals(scheduler);
    scheduler.setState({ focused: true });
    advance(context, 600000);
    assert.ok(history.length >= 90, "observe at least three complete editorial cycles");
    Array.from({ length: Math.floor(history.length / 30) }).forEach((_, cycle) => {
        const displayed = history.slice(cycle * 30, (cycle + 1) * 30).map(({ landmark }) => landmark);
        assert.deepEqual(new Set(displayed), new Set(roamLandmarks.map(({ id }) => id)));
    });
    history.forEach((moment, index) => {
        const recent = history.slice(Math.max(0, index - 6), index);
        assert.ok(
            !recent.some(({ landmark }) => landmark === moment.landmark),
            "a new cycle cannot replay recent artwork"
        );
    });
    const firstCycle = history.slice(0, 30).map(({ landmark }) => landmark);
    const secondCycle = history.slice(30, 60).map(({ landmark }) => landmark);
    assert.notDeepEqual(firstCycle, secondCycle, "the catalog should not become one repeated fixed playlist");
});

test("the curator changes architectural silhouette whenever an unseen eligible alternative is available", (context) => {
    const scheduler = fixture(context);
    const history = arrivals(scheduler);
    scheduler.setState({ focused: true });
    advance(context, 300000);
    assert.ok(history.length >= 60);
    const byId = new Map(roamLandmarks.map((landmark) => [landmark.id, landmark]));
    history.forEach((moment, index) => {
        if (index === 0) return;
        const previous = byId.get(history[index - 1].landmark);
        const current = byId.get(moment.landmark);
        assert.ok(previous && current);
        const cycleStart = Math.floor(index / 30) * 30;
        const alreadyShown = new Set(history.slice(cycleStart, index).map(({ landmark }) => landmark));
        const recent = new Set(history.slice(Math.max(0, index - 6), index).map(({ landmark }) => landmark));
        const otherSilhouetteAvailable = roamLandmarks.some(
            (landmark) =>
                !alreadyShown.has(landmark.id) &&
                !recent.has(landmark.id) &&
                landmark.silhouette !== previous.silhouette
        );
        if (otherSilhouetteAvailable)
            assert.notEqual(
                current.silhouette,
                previous.silhouette,
                "vary silhouettes instead of repeating similar architecture"
            );
    });
});

test("fragments have bounded but varied lifetimes, drawing speeds, sizes and edge compositions", (context) => {
    const sequence = { index: 0 };
    const scheduler = fixture(context, () => {
        sequence.index += 1;
        return (sequence.index * 0.61803398875) % 1;
    });
    const history = arrivals(scheduler);
    scheduler.setState({ focused: true });
    advance(context, 120000);
    assert.ok(history.length >= 10);
    history.forEach((moment) => {
        assert.ok(moment.lifetimeMs >= 9000 && moment.lifetimeMs <= 13000);
        assert.ok(moment.drawSeconds >= 3.2 && moment.drawSeconds <= 4.6);
        assert.ok(moment.scale >= 0.86 && moment.scale <= 1.14);
        assert.ok(["edge", "inset"].includes(moment.framing));
    });
    assert.ok(new Set(history.map(({ lifetimeMs }) => lifetimeMs)).size >= 3);
    assert.ok(new Set(history.map(({ drawSeconds }) => drawSeconds)).size >= 3);
    assert.ok(new Set(history.map(({ scale }) => scale)).size >= 3);
    assert.equal(new Set(history.map(({ framing }) => framing)).size, 2);
    const snapshot = scheduler.getSnapshot();
    assert.equal(scheduler.getSnapshot(), snapshot, "reading a render snapshot must not randomize its composition");
});

test("active typing gives search a longer quiet window without stopping all inspiration", (context) => {
    const scheduler = fixture(context);
    const history = arrivals(scheduler);
    scheduler.setState({ focused: true });
    context.mock.timers.tick(500);
    scheduler.setState({ typing: true });
    advance(context, 7999);
    assert.equal(history.length, 0, "typing must replace the already scheduled early arrival");
    context.mock.timers.tick(1);
    assert.equal(history.length, 1);
    advance(context, 7999);
    assert.equal(history.length, 1, "typing cannot silently return to the normal busy cadence");
    context.mock.timers.tick(1);
    assert.equal(history.length, 2);
});

test("starting to type reduces an existing desktop composition to at most two fragments", (context) => {
    const scheduler = fixture(context);
    scheduler.setState({ focused: true });
    advance(context, 5000);
    assert.equal(scheduler.getSnapshot().length, 3);
    scheduler.setState({ typing: true });
    advance(context, 60000, () => assert.ok(scheduler.getSnapshot().length <= 2));
});

test("mobile allows a protected pair of fragments in its peripheral regions", (context) => {
    const scheduler = fixture(context);
    const history = arrivals(scheduler);
    scheduler.setState({ focused: true, mobile: true });
    const concurrency = new Set<number>();
    advance(context, 90000, () => {
        concurrency.add(scheduler.getSnapshot().length);
        assert.ok(scheduler.getSnapshot().length <= 2);
        scheduler.getSnapshot().forEach((moment) => assert.ok(["northwest", "southeast"].includes(moment.region)));
    });
    assert.ok(history.length >= 5);
    assert.ok(concurrency.has(2));
});

test("mobile typing reserves the suggestion area by admitting fragments only in the upper region", (context) => {
    const scheduler = fixture(context);
    const history = arrivals(scheduler);
    scheduler.setState({ focused: true, mobile: true, typing: true });
    advance(context, 90000, () => {
        assert.ok(scheduler.getSnapshot().length <= 1);
        scheduler.getSnapshot().forEach((moment) => assert.equal(moment.region, "northwest"));
    });
    assert.ok(history.length >= 3);
});

test("resizing to mobile immediately protects the compact search area", (context) => {
    const scheduler = fixture(context);
    scheduler.setState({ focused: true });
    advance(context, 5000);
    assert.equal(scheduler.getSnapshot().length, 3);
    scheduler.setState({ mobile: true });
    assert.ok(scheduler.getSnapshot().length <= 2);
    scheduler.getSnapshot().forEach((moment) => assert.ok(["northwest", "southeast"].includes(moment.region)));
    scheduler.setState({ typing: true });
    assert.ok(scheduler.getSnapshot().length <= 1);
    scheduler.getSnapshot().forEach((moment) => assert.equal(moment.region, "northwest"));
});

for (const suppression of ["hidden", "reducedMotion", "transitioning", "compact"] as const) {
    test(`${suppression} clears both visible fragments and pending admissions`, (context) => {
        const scheduler = fixture(context);
        const history = arrivals(scheduler);
        scheduler.setState({ focused: true });
        advance(context, 1000);
        assert.equal(scheduler.getSnapshot().length, 1);
        scheduler.setState({ [suppression]: true });
        assert.deepEqual(scheduler.getSnapshot(), []);
        const count = history.length;
        advance(context, 60000);
        assert.equal(history.length, count, "suppressed pages must do no ambient work");
        scheduler.setState({ [suppression]: false });
        context.mock.timers.tick(699);
        assert.deepEqual(scheduler.getSnapshot(), [], "resuming must not replay an overdue fragment");
        advance(context, 600);
        assert.equal(scheduler.getSnapshot().length, 1);
    });
}

test("blur settles the canvas and re-focusing starts a fresh delayed appearance", (context) => {
    const scheduler = fixture(context);
    const history = arrivals(scheduler);
    scheduler.setState({ focused: true });
    advance(context, 1000);
    scheduler.setState({ focused: false });
    assert.deepEqual(scheduler.getSnapshot(), []);
    advance(context, 60000);
    assert.equal(history.length, 1);
    scheduler.setState({ focused: true });
    context.mock.timers.tick(699);
    assert.deepEqual(scheduler.getSnapshot(), []);
    context.mock.timers.tick(1);
    assert.equal(history.length, 2);
    assert.notEqual(history[0].landmark, history[1].landmark);
});

test("unchanged interaction state does not perpetually postpone an already scheduled moment", (context) => {
    const scheduler = fixture(context);
    scheduler.setState({ focused: true });
    context.mock.timers.tick(500);
    scheduler.setState({ focused: true, typing: false });
    context.mock.timers.tick(200);
    assert.equal(scheduler.getSnapshot().length, 1);
});

test("each fragment expires at its own lifetime without clearing its overlapping neighbors", (context) => {
    const scheduler = fixture(context);
    scheduler.setState({ focused: true });
    advance(context, 700);
    const first = scheduler.getSnapshot()[0];
    assert.ok(first);
    advance(context, first.lifetimeMs - 1);
    assert.ok(scheduler.getSnapshot().some(({ id }) => id === first.id));
    const neighbors = scheduler.getSnapshot().filter(({ id }) => id !== first.id);
    assert.ok(neighbors.length > 0);
    context.mock.timers.tick(1);
    assert.ok(!scheduler.getSnapshot().some(({ id }) => id === first.id));
    neighbors.forEach(({ id }) => assert.ok(scheduler.getSnapshot().some((moment) => moment.id === id)));
});

test("disposing cancels timers and subscriptions, with no stale work on a fresh activation", (context) => {
    const scheduler = fixture(context);
    const notifications: number[] = [];
    const unsubscribe = scheduler.subscribe(() => notifications.push(scheduler.getSnapshot().length));
    scheduler.setState({ focused: true });
    advance(context, 1000);
    unsubscribe();
    const count = notifications.length;
    scheduler.setState({ typing: true });
    assert.equal(notifications.length, count);
    const disposalNotifications: number[] = [];
    scheduler.subscribe(() => disposalNotifications.push(scheduler.getSnapshot().length));
    scheduler.dispose();
    const disposalCount = disposalNotifications.length;
    advance(context, 60000);
    assert.deepEqual(scheduler.getSnapshot(), []);
    assert.equal(disposalNotifications.length, disposalCount);
    scheduler.setState({ focused: true, typing: false });
    context.mock.timers.tick(699);
    assert.deepEqual(scheduler.getSnapshot(), []);
    context.mock.timers.tick(1);
    assert.equal(scheduler.getSnapshot().length, 1, "React's effect cleanup/setup cycle can safely activate again");
});
