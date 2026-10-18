import assert from "node:assert/strict";
import test, { beforeEach, mock } from "node:test";
import {
    observeCurrentUser,
    subscribeToAccountUpdates,
    publishAccountUpdate,
    signInWithGoogle,
    signOut,
    type AuthUser
} from "../src/lib/auth";
import {
    apiOrigin,
    deleteProfilePicture,
    setProfilePicture,
    updateProfile,
    loadProfile,
    type UserProfile
} from "../src/lib/profile";

function profile(imageId: number | null, overrides: Partial<UserProfile> = {}): UserProfile {
    return {
        id: "google-owner",
        username: "ada_lovelace",
        displayName: "Ada Lovelace",
        description: "",
        location: null,
        occupation: null,
        languages: [],
        interests: [],
        profilePicture:
            imageId === null
                ? null
                : {
                      imageId,
                      url: `/api/v1/images/${imageId}/content?variant=display`,
                      storageKey: `roamboard/photo-${imageId}`
                  },
        defaultBoardVisibility: "public",
        revision: 4,
        createdAt: "2026-10-01T10:00:00Z",
        updatedAt: "2026-10-18T10:00:00Z",
        ...overrides
    };
}

function expectedAccount(saved: UserProfile): AuthUser {
    return {
        userId: saved.id,
        username: saved.username,
        displayName: saved.displayName,
        profilePictureUrl: saved.profilePicture ? new URL(saved.profilePicture.url, apiOrigin).toString() : null
    };
}

function changes() {
    return {
        revision: 4,
        username: "requested_handle",
        displayName: "Requested Name",
        description: "My biography",
        location: null,
        occupation: null,
        languages: [],
        interests: [],
        defaultBoardVisibility: "public" as const
    };
}

beforeEach(async () => {
    // Each test starts with a fresh confirmed sign-in rather than resetting private auth state.
    const fetched = mock.method(globalThis, "fetch", async () =>
        Response.json({ data: { user: expectedAccount(profile(12)), isNew: false } })
    );
    await signInWithGoogle("verified-google-token");
    fetched.mock.restore();
});

test("saved profile photo additions, replacements and removals immediately publish the confirmed account", async (context) => {
    const received: Array<AuthUser | null> = [];
    const unsubscribe = subscribeToAccountUpdates((user) => received.push(user));
    context.after(unsubscribe);
    const savedProfiles = [profile(12), profile(25), profile(null)];
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(input), init });
        return Response.json({ data: savedProfiles[calls.length - 1] });
    });
    await setProfilePicture(12);
    assert.deepEqual(received, [expectedAccount(savedProfiles[0])]);
    await setProfilePicture(25);
    assert.deepEqual(received, savedProfiles.slice(0, 2).map(expectedAccount));
    await deleteProfilePicture();
    assert.deepEqual(received, savedProfiles.map(expectedAccount));
    assert.deepEqual(
        calls.map(({ init }) => init?.method),
        ["PUT", "PUT", "DELETE"]
    );
    assert.deepEqual(
        calls.slice(0, 2).map(({ init }) => JSON.parse(String(init?.body))),
        [{ imageId: 12 }, { imageId: 25 }]
    );
    assert.ok(
        calls.every(
            ({ init, url }) => init?.credentials === "include" && url.endsWith("/api/v1/users/me/profile-picture")
        )
    );
});

test("profile edits publish the server's saved name and handle only after a successful response", async (context) => {
    const received: Array<AuthUser | null> = [];
    const unsubscribe = subscribeToAccountUpdates((user) => received.push(user));
    context.after(unsubscribe);
    const responseState: { complete?: (response: Response) => void } = {};
    context.mock.method(globalThis, "fetch", (_input: string | URL | Request, init?: RequestInit) => {
        assert.equal(init?.method, "PATCH");
        assert.equal(init?.credentials, "include");
        return new Promise<Response>((resolve) => {
            responseState.complete = resolve;
        });
    });
    const pending = updateProfile(changes());
    assert.deepEqual(received, [], "Pending requests cannot update the account controls");
    const saved = profile(44, { username: "server_saved_handle", displayName: "Saved Name", revision: 5 });
    assert.ok(responseState.complete);
    responseState.complete(Response.json({ data: saved }));
    const result = await pending;
    assert.deepEqual(received, [expectedAccount(saved)]);
    assert.equal(result.profilePicture?.url, expectedAccount(saved).profilePictureUrl);
});

test("rejected profile saves and network failures do not publish account changes", async (context) => {
    const received: Array<AuthUser | null> = [];
    const unsubscribe = subscribeToAccountUpdates((user) => received.push(user));
    context.after(unsubscribe);
    const operations = [() => setProfilePicture(12), () => deleteProfilePicture(), () => updateProfile(changes())];
    const fetched = context.mock.method(globalThis, "fetch", async () =>
        Response.json({ error: { code: "PROFILE_REVISION_CONFLICT", message: "Profile changed" } }, { status: 409 })
    );
    for (const operation of operations) await assert.rejects(operation(), /Profile changed/);
    assert.deepEqual(received, []);
    fetched.mock.restore();
    context.mock.method(globalThis, "fetch", async () => {
        throw new TypeError("Network unavailable");
    });
    for (const operation of operations) await assert.rejects(operation(), /API is unavailable/);
    assert.deepEqual(received, []);
});

test("account subscriptions unsubscribe cleanly and do not replay stale account data", () => {
    const received: Array<AuthUser | null> = [];
    const user = expectedAccount(profile(12));
    const unsubscribe = subscribeToAccountUpdates((update) => received.push(update));
    publishAccountUpdate(user);
    assert.deepEqual(received, [user]);
    unsubscribe();
    unsubscribe();
    publishAccountUpdate({ ...user, profilePictureUrl: null });
    assert.deepEqual(received, [user]);
    const later: Array<AuthUser | null> = [];
    const unsubscribeLater = subscribeToAccountUpdates((update) => later.push(update));
    try {
        assert.deepEqual(later, [], "A remounted control must read its current session rather than replay an old save");
    } finally {
        unsubscribeLater();
    }
});

test("reading a profile does not announce an account mutation", async (context) => {
    const received: Array<AuthUser | null> = [];
    const unsubscribe = subscribeToAccountUpdates((user) => received.push(user));
    context.after(unsubscribe);
    context.mock.method(globalThis, "fetch", async () => Response.json({ data: profile(12) }));
    await loadProfile();
    assert.deepEqual(received, []);
});

test("account observer follows actual profile saves and ignores an older in-flight session response", async (context) => {
    const received: Array<AuthUser | null> = [];
    const responseState: { finishInitial?: (response: Response) => void } = {};
    context.mock.method(globalThis, "fetch", (input: string | URL | Request, init?: RequestInit) => {
        if (String(input).endsWith("/auth/me"))
            return new Promise<Response>((resolve) => {
                responseState.finishInitial = resolve;
            });
        return Promise.resolve(Response.json({ data: init?.method === "DELETE" ? profile(null) : profile(25) }));
    });
    const stop = observeCurrentUser((user) => received.push(user));
    context.after(stop);
    await setProfilePicture(25);
    assert.deepEqual(received, [expectedAccount(profile(25))]);
    assert.ok(responseState.finishInitial);
    responseState.finishInitial(Response.json({ data: expectedAccount(profile(12)) }));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(
        received,
        [expectedAccount(profile(25))],
        "The initial session photo cannot overwrite a newer saved photo"
    );
    await deleteProfilePicture();
    assert.deepEqual(received, [expectedAccount(profile(25)), expectedAccount(profile(null))]);
});

test("late session failures and responses after observer cleanup cannot overwrite saved account state", async (context) => {
    const received: Array<AuthUser | null> = [];
    const pending: Array<{ resolve: (value: Response) => void; reject: (reason: Error) => void }> = [];
    context.mock.method(
        globalThis,
        "fetch",
        () =>
            new Promise<Response>((resolve, reject) => {
                pending.push({ resolve, reject });
            })
    );
    const stop = observeCurrentUser((user) => received.push(user));
    const saved = expectedAccount(profile(25));
    publishAccountUpdate(saved);
    pending[0].reject(new TypeError("Session fetch failed"));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(received, [saved]);
    stop();
    const later: Array<AuthUser | null> = [];
    const stopLater = observeCurrentUser((user) => later.push(user));
    stopLater();
    pending[1].resolve(Response.json({ data: saved }));
    await new Promise<void>((resolve) => setImmediate(resolve));
    publishAccountUpdate({ ...saved, profilePictureUrl: null });
    assert.deepEqual(received, [saved], "Unmounted account controls must unsubscribe");
    assert.deepEqual(later, [], "An initial response after unmount cannot set account state");
});

test("account observer loads the current session and handles signed-out and unavailable sessions", async (context) => {
    const responses = [
        Response.json({ data: expectedAccount(profile(12)) }),
        new Response(null, { status: 401 }),
        new Response(null, { status: 503 })
    ];
    context.mock.method(globalThis, "fetch", async (_input: string | URL | Request, init?: RequestInit) => {
        assert.equal(init?.credentials, "include");
        assert.equal(init?.cache, "no-store");
        return responses.shift()!;
    });
    for (const expected of [expectedAccount(profile(12)), null, null]) {
        const received: Array<AuthUser | null> = [];
        const stop = observeCurrentUser((user) => received.push(user));
        try {
            await new Promise<void>((resolve) => setImmediate(resolve));
            assert.deepEqual(received, [expected]);
        } finally {
            stop();
        }
    }
});

test("profile PATCH, photo PUT and photo DELETE completed after logout cannot restore account controls", async (context) => {
    const received: Array<AuthUser | null> = [];
    const unsubscribe = subscribeToAccountUpdates((user) => received.push(user));
    context.after(unsubscribe);
    const pending: Array<(response: Response) => void> = [];
    const logoutState: { complete?: (response: Response) => void } = {};
    context.mock.method(
        globalThis,
        "fetch",
        (input: string | URL | Request) =>
            new Promise<Response>((resolve) => {
                if (String(input).endsWith("/auth/logout")) logoutState.complete = resolve;
                else pending.push(resolve);
            })
    );
    const saves = [updateProfile(changes()), setProfilePicture(25), deleteProfilePicture()];
    const logout = signOut();
    assert.deepEqual(received, [null], "Logout clears the account controls before its request finishes");
    for (const complete of pending) complete(Response.json({ data: profile(25) }));
    await Promise.all(saves);
    assert.deepEqual(received, [null], "Earlier profile saves cannot resurrect a signed-out account");
    assert.ok(logoutState.complete);
    logoutState.complete(new Response(null, { status: 204 }));
    await logout;
});

test("an old session response and a fresh login-page observer cannot resurrect an account after logout", async (context) => {
    const sessionRequests: Array<(response: Response) => void> = [];
    context.mock.method(globalThis, "fetch", (input: string | URL | Request) => {
        if (String(input).endsWith("/auth/logout")) return Promise.resolve(new Response(null, { status: 204 }));
        return new Promise<Response>((resolve) => sessionRequests.push(resolve));
    });
    const previous: Array<AuthUser | null> = [];
    const stopPrevious = observeCurrentUser((user) => previous.push(user));
    context.after(stopPrevious);
    await signOut();
    const remounted: Array<AuthUser | null> = [];
    const stopRemounted = observeCurrentUser((user) => remounted.push(user));
    context.after(stopRemounted);
    sessionRequests[0]?.(Response.json({ data: expectedAccount(profile(12)) }));
    sessionRequests[1]?.(new Response(null, { status: 401 }));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.ok(previous.length > 0);
    assert.ok(previous.every((user) => user === null));
    assert.ok(remounted.every((user) => user === null));
    const staleRemount: Array<AuthUser | null> = [];
    const stopStaleRemount = observeCurrentUser((user) => staleRemount.push(user));
    context.after(stopStaleRemount);
    sessionRequests[2]?.(Response.json({ data: expectedAccount(profile(12)) }));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(staleRemount, [null], "A new control cannot show a stale positive session after explicit logout");
    publishAccountUpdate(expectedAccount(profile(25)));
    assert.ok(previous.every((user) => user === null));
    assert.ok(remounted.every((user) => user === null));
});

test("a new account sign-in cannot be overwritten by the previous account's unfinished profile save", async (context) => {
    const received: Array<AuthUser | null> = [];
    const unsubscribe = subscribeToAccountUpdates((user) => received.push(user));
    context.after(unsubscribe);
    const pending: { complete?: (response: Response) => void } = {};
    const newUser = expectedAccount(
        profile(44, { id: "new-google-owner", username: "grace_hopper", displayName: "Grace Hopper" })
    );
    context.mock.method(globalThis, "fetch", (input: string | URL | Request) => {
        if (String(input).endsWith("/auth/logout")) return Promise.resolve(new Response(null, { status: 204 }));
        if (String(input).endsWith("/auth/google"))
            return Promise.resolve(Response.json({ data: { user: newUser, isNew: false } }));
        return new Promise<Response>((resolve) => {
            pending.complete = resolve;
        });
    });
    const oldSave = setProfilePicture(25);
    await signOut();
    await signInWithGoogle("new-account-token");
    assert.deepEqual(received, [null, newUser]);
    assert.ok(pending.complete);
    pending.complete(Response.json({ data: profile(25) }));
    await oldSave;
    assert.deepEqual(received, [null, newUser]);
});

test("a 401 session on a login-page remount invalidates unfinished profile saves", async (context) => {
    const pending: { complete?: (response: Response) => void } = {};
    context.mock.method(globalThis, "fetch", (input: string | URL | Request) => {
        if (String(input).endsWith("/auth/me")) return Promise.resolve(new Response(null, { status: 401 }));
        return new Promise<Response>((resolve) => {
            pending.complete = resolve;
        });
    });
    const save = setProfilePicture(25);
    const received: Array<AuthUser | null> = [];
    const stop = observeCurrentUser((user) => received.push(user));
    context.after(stop);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(received, [null]);
    assert.ok(pending.complete);
    pending.complete(Response.json({ data: profile(25) }));
    await save;
    assert.deepEqual(received, [null]);
});

test("a Google sign-in request started before logout cannot revive signed-in account controls", async (context) => {
    const pending: { complete?: (response: Response) => void } = {};
    context.mock.method(globalThis, "fetch", (input: string | URL | Request) => {
        if (String(input).endsWith("/auth/logout")) return Promise.resolve(new Response(null, { status: 204 }));
        return new Promise<Response>((resolve) => {
            pending.complete = resolve;
        });
    });
    const received: Array<AuthUser | null> = [];
    const unsubscribe = subscribeToAccountUpdates((user) => received.push(user));
    context.after(unsubscribe);
    const signIn = signInWithGoogle("earlier-google-token");
    await signOut();
    assert.ok(pending.complete);
    pending.complete(Response.json({ data: { user: expectedAccount(profile(12)), isNew: false } }));
    await signIn;
    assert.deepEqual(received, [null]);
});

test("a confirmed Google sign-in survives a 401 from an earlier session lookup", async (context) => {
    const pending: { complete?: (response: Response) => void } = {};
    context.mock.method(globalThis, "fetch", (input: string | URL | Request) => {
        if (String(input).endsWith("/auth/me")) return Promise.resolve(new Response(null, { status: 401 }));
        return new Promise<Response>((resolve) => {
            pending.complete = resolve;
        });
    });
    const received: Array<AuthUser | null> = [];
    const signIn = signInWithGoogle("valid-google-token");
    const stop = observeCurrentUser((user) => received.push(user));
    context.after(stop);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(received, [null]);
    assert.ok(pending.complete);
    const user = expectedAccount(profile(25));
    pending.complete(Response.json({ data: { user, isNew: false } }));
    await signIn;
    assert.deepEqual(received, [null, user]);
    publishAccountUpdate({ ...user, displayName: "Updated Ada" });
    assert.deepEqual(received, [null, user, { ...user, displayName: "Updated Ada" }]);
});

test("a failed logout request still invalidates an earlier profile save", async (context) => {
    const pending: { complete?: (response: Response) => void } = {};
    context.mock.method(globalThis, "fetch", (input: string | URL | Request) => {
        if (String(input).endsWith("/auth/logout")) return Promise.resolve(new Response(null, { status: 503 }));
        return new Promise<Response>((resolve) => {
            pending.complete = resolve;
        });
    });
    const received: Array<AuthUser | null> = [];
    const unsubscribe = subscribeToAccountUpdates((user) => received.push(user));
    context.after(unsubscribe);
    const save = deleteProfilePicture();
    await assert.rejects(signOut(), /Could not sign out/);
    assert.deepEqual(received, [null]);
    assert.ok(pending.complete);
    pending.complete(Response.json({ data: profile(null) }));
    await save;
    assert.deepEqual(received, [null]);
});
