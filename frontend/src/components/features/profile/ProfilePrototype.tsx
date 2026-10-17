/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import VisitedWorldMap from "@/components/features/profile/VisitedWorldMap";
import CountryCombobox from "@/components/ui/CountryCombobox";
import { findCountry, type Country } from "@/lib/countries";
import { searchBoardDestinations, type MapboxSearchResult } from "@/lib/providers";
import {
    createBoard,
    deleteProfilePicture,
    loadMapDestinations,
    loadOwnBoards,
    loadProfile,
    loadProfileStats,
    loadRecentBoards,
    setProfilePicture,
    updateProfile,
    type MapDestination,
    type ProfileBoard,
    type ProfileStats,
    type UserProfile
} from "@/lib/profile";

const inputClass =
    "mt-2 w-full border-b border-line bg-transparent py-2 text-15 text-foreground outline-none focus:border-foreground";

type SelectedDestination = {
    providerId: string;
    country: string;
    countryCode: string;
    city: string;
    latitude: number;
    longitude: number;
};

async function loadSnapshot() {
    const [profile, stats, boards, recent, destinations] = await Promise.all([
        loadProfile(),
        loadProfileStats(),
        loadOwnBoards(),
        loadRecentBoards(),
        loadMapDestinations()
    ]);
    return { profile, stats, boards, recent, destinations };
}

export default function ProfilePrototype() {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [stats, setStats] = useState<ProfileStats | null>(null);
    const [boards, setBoards] = useState<ProfileBoard[]>([]);
    const [recent, setRecent] = useState<ProfileBoard[]>([]);
    const [destinations, setDestinations] = useState<MapDestination[]>([]);
    const [status, setStatus] = useState("Loading your profile…");
    const [busy, setBusy] = useState(false);
    const [countryQuery, setCountryQuery] = useState("");
    const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
    const [cityQuery, setCityQuery] = useState("");
    const [destinationResults, setDestinationResults] = useState<MapboxSearchResult[]>([]);
    const [selectedDestinations, setSelectedDestinations] = useState<SelectedDestination[]>([]);
    const [destinationStatus, setDestinationStatus] = useState("");
    const [destinationLoading, setDestinationLoading] = useState(false);

    async function refresh() {
        const snapshot = await loadSnapshot();
        setProfile(snapshot.profile);
        setStats(snapshot.stats);
        setBoards(snapshot.boards);
        setRecent(snapshot.recent);
        setDestinations(snapshot.destinations);
        setStatus("Loaded from the API.");
    }

    useEffect(() => {
        void loadSnapshot()
            .then((snapshot) => {
                setProfile(snapshot.profile);
                setStats(snapshot.stats);
                setBoards(snapshot.boards);
                setRecent(snapshot.recent);
                setDestinations(snapshot.destinations);
                setStatus("Loaded from the API.");
            })
            .catch((caught: unknown) =>
                setStatus(caught instanceof Error ? caught.message : "The profile could not be loaded.")
            );
    }, []);

    async function run(action: () => Promise<unknown>, success: string): Promise<boolean> {
        setBusy(true);
        setStatus("Saving…");
        try {
            await action();
            await refresh();
            setStatus(success);
            return true;
        } catch (caught) {
            setStatus(caught instanceof Error ? caught.message : "The request failed.");
            return false;
        } finally {
            setBusy(false);
        }
    }

    async function findDestination() {
        const country = selectedCountry ?? findCountry(countryQuery);
        const city = cityQuery.trim();
        if (!country || !city) {
            setDestinationStatus(!country ? "Choose an existing country from the suggestions." : "Enter a city.");
            setDestinationResults([]);
            return;
        }
        setDestinationLoading(true);
        setDestinationStatus("Checking the city and country…");
        try {
            const results = (await searchBoardDestinations(country.code, city)).filter(
                (result) =>
                    result.placeType === "place" && result.country && result.countryCode === country.code && result.city
            );
            setDestinationResults(results);
            setDestinationStatus(
                results.length
                    ? "Select the correct city below."
                    : "No matching city was found. Check the spelling and country."
            );
        } catch (caught) {
            setDestinationResults([]);
            setDestinationStatus(caught instanceof Error ? caught.message : "The destination could not be checked.");
        } finally {
            setDestinationLoading(false);
        }
    }

    function addDestination(result: MapboxSearchResult) {
        if (!result.country || !result.countryCode || !result.city) return;
        if (selectedDestinations.some((destination) => destination.providerId === result.id)) {
            setDestinationStatus("That city is already on this Board.");
            return;
        }
        setSelectedDestinations((current) => [
            ...current,
            {
                providerId: result.id,
                country: result.country as string,
                countryCode: result.countryCode as string,
                city: result.city as string,
                latitude: result.latitude,
                longitude: result.longitude
            }
        ]);
        setCountryQuery("");
        setSelectedCountry(null);
        setCityQuery("");
        setDestinationResults([]);
        setDestinationStatus(`${result.city}, ${result.country} added.`);
    }

    async function saveProfile(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!profile) return;
        const data = new FormData(event.currentTarget);
        await run(
            () =>
                updateProfile({
                    revision: profile.revision,
                    username: profile.username,
                    displayName: String(data.get("displayName") ?? ""),
                    description: String(data.get("description") ?? ""),
                    location: String(data.get("location") ?? "").trim() || null,
                    occupation: profile.occupation,
                    languages: profile.languages,
                    interests: String(data.get("interests") ?? "")
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    defaultBoardVisibility: profile.defaultBoardVisibility
                }),
            "Profile saved and read back from the API."
        );
    }

    async function savePicture(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const imageId = Number(new FormData(event.currentTarget).get("imageId"));
        await run(() => setProfilePicture(imageId), "Profile picture saved.");
    }

    async function addBoard(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        if (!selectedDestinations.length) {
            setDestinationStatus("Add at least one verified city before creating the Board.");
            return;
        }
        const saved = await run(
            () =>
                createBoard({
                    title: String(data.get("title") ?? ""),
                    isCompleted: data.get("isCompleted") === "on",
                    destinations: selectedDestinations.map(({ country, countryCode, city, latitude, longitude }) => ({
                        country,
                        countryCode,
                        city,
                        latitude,
                        longitude
                    }))
                }),
            "Board created; stats and map data refreshed."
        );
        if (saved) {
            form.reset();
            setSelectedDestinations([]);
            setDestinationStatus("");
        }
    }

    if (!profile)
        return (
            <section className="w-full max-w-5xl px-6 py-14 sm:px-10 lg:px-20">
                <h1 className="font-display text-48 font-bold">Profile API prototype</h1>
                <p className="mt-5" role="status">
                    {status}
                </p>
            </section>
        );

    return (
        <section className="w-full max-w-5xl px-6 py-14 sm:px-10 lg:px-20">
            <p className="text-10 tracking-label text-graphite font-bold uppercase">
                Developer lab · PostgreSQL-backed with Docker
            </p>
            <h1 className="font-display text-48 mt-5 leading-none font-bold">Profile API prototype</h1>
            <p className="text-15 text-graphite mt-5 max-w-3xl leading-7">
                Changes here update your signed-in <strong>@{profile.username}</strong> account. The username is
                read-only. PostgreSQL preserves saved changes across API restarts.
            </p>
            <p className="border-foreground text-14 mt-5 border-l-2 pl-3" role="status">
                {status}
            </p>

            {stats ? (
                <dl className="bg-line mt-10 grid grid-cols-2 gap-px sm:grid-cols-5">
                    {Object.entries(stats).map(([label, value]) => (
                        <div className="bg-background p-4" key={label}>
                            <dt className="text-11 text-graphite">
                                {label.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}
                            </dt>
                            <dd className="font-display text-30 mt-2 font-bold">{value}</dd>
                        </div>
                    ))}
                </dl>
            ) : null}

            <div className="mt-12 grid gap-12 lg:grid-cols-2">
                <form onSubmit={(event) => void saveProfile(event)} className="space-y-5">
                    <h2 className="font-display text-28 font-bold">Editable profile</h2>
                    <label className="text-12 text-graphite block">
                        Username
                        <input className={inputClass} value={profile.username} disabled />
                    </label>
                    <label className="text-12 text-graphite block">
                        Display name
                        <input name="displayName" className={inputClass} defaultValue={profile.displayName} required />
                    </label>
                    <label className="text-12 text-graphite block">
                        Description
                        <textarea
                            name="description"
                            className={inputClass}
                            defaultValue={profile.description}
                            rows={3}
                        />
                    </label>
                    <label className="text-12 text-graphite block">
                        Location
                        <input name="location" className={inputClass} defaultValue={profile.location ?? ""} />
                    </label>
                    <label className="text-12 text-graphite block">
                        Up to three interests from the Board tag list, separated by commas
                        <input name="interests" className={inputClass} defaultValue={profile.interests.join(", ")} />
                    </label>
                    <button
                        disabled={busy}
                        className="bg-foreground text-14 text-background px-5 py-3 disabled:opacity-50"
                    >
                        Save profile
                    </button>
                </form>

                <div>
                    <h2 className="font-display text-28 font-bold">Profile picture</h2>
                    {profile.profilePicture ? (
                        <div className="mt-5">
                            <img
                                src={profile.profilePicture.url}
                                alt="Current profile"
                                className="border-line size-28 rounded-full border object-cover"
                            />
                            <button
                                type="button"
                                className="text-13 mt-3 block underline"
                                disabled={busy}
                                onClick={() => void run(deleteProfilePicture, "Profile picture removed.")}
                            >
                                Delete picture
                            </button>
                        </div>
                    ) : (
                        <p className="text-14 text-graphite mt-4">No profile picture is saved.</p>
                    )}
                    <form className="mt-6" onSubmit={(event) => void savePicture(event)}>
                        <label className="text-12 text-graphite block">
                            Owned uploaded image ID
                            <input
                                type="number"
                                min="1"
                                name="imageId"
                                className={inputClass}
                                required
                                placeholder="https://…"
                            />
                        </label>
                        <button
                            disabled={busy}
                            className="border-foreground text-14 mt-4 border px-5 py-3 disabled:opacity-50"
                        >
                            Set picture
                        </button>
                    </form>
                </div>
            </div>

            <form onSubmit={(event) => void addBoard(event)} className="border-line mt-16 border-t pt-10">
                <h2 className="font-display text-28 font-bold">Create a test Board</h2>
                <p className="text-14 text-graphite mt-2">
                    Every Board needs at least one verified city. Add as many cities and countries as the trip covers.
                </p>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <label className="text-12 text-graphite">
                        Title
                        <input name="title" className={inputClass} required />
                    </label>
                    <label className="text-12 text-graphite">
                        Country <span aria-hidden="true">*</span>
                        <CountryCombobox
                            value={countryQuery}
                            inputClassName={inputClass}
                            onChange={(value, country) => {
                                setCountryQuery(value);
                                setSelectedCountry(country);
                                setDestinationResults([]);
                                setDestinationStatus("");
                            }}
                        />
                    </label>
                    <label className="text-12 text-graphite">
                        City <span aria-hidden="true">*</span>
                        <input
                            className={inputClass}
                            value={cityQuery}
                            onChange={(event) => {
                                setCityQuery(event.target.value);
                                setDestinationResults([]);
                            }}
                            placeholder="Copenhagen"
                            autoComplete="address-level2"
                            aria-required="true"
                        />
                    </label>
                </div>
                <button
                    type="button"
                    className="border-foreground text-14 mt-5 border px-5 py-3 disabled:opacity-50"
                    disabled={destinationLoading || !findCountry(countryQuery) || !cityQuery.trim()}
                    onClick={() => void findDestination()}
                >
                    {destinationLoading ? "Checking…" : "Find city"}
                </button>
                {destinationStatus ? (
                    <p className="text-13 text-graphite mt-3" role="status">
                        {destinationStatus}
                    </p>
                ) : null}
                {destinationResults.length ? (
                    <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                        {destinationResults.map((result) => (
                            <li
                                key={result.id}
                                className="border-line flex items-start justify-between gap-4 border p-4"
                            >
                                <span>
                                    <strong className="text-14 block">
                                        {result.city}, {result.country}
                                    </strong>
                                    <span className="text-12 text-graphite mt-1 block">{result.address}</span>
                                    <span className="text-12 text-graphite mt-1 block">
                                        {result.countryCode} · {result.latitude.toFixed(4)},{" "}
                                        {result.longitude.toFixed(4)}
                                    </span>
                                </span>
                                <button
                                    type="button"
                                    className="border-foreground text-12 shrink-0 border px-3 py-2"
                                    onClick={() => addDestination(result)}
                                >
                                    Add
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : null}
                {selectedDestinations.length ? (
                    <div className="mt-6">
                        <p className="text-12 tracking-label text-graphite font-bold uppercase">
                            Board destinations ({selectedDestinations.length})
                        </p>
                        <ol className="mt-3 grid gap-3 sm:grid-cols-2">
                            {selectedDestinations.map((destination, index) => (
                                <li
                                    key={destination.providerId}
                                    className="border-line flex items-start gap-3 border p-4"
                                >
                                    <span className="bg-foreground text-12 text-background grid size-6 shrink-0 place-items-center rounded-full">
                                        {index + 1}
                                    </span>
                                    <span>
                                        <strong className="text-14 block">
                                            {destination.city}, {destination.country}
                                        </strong>
                                        <span className="text-12 text-graphite mt-1 block">
                                            {destination.countryCode} · {destination.latitude.toFixed(4)},{" "}
                                            {destination.longitude.toFixed(4)}
                                        </span>
                                    </span>
                                    <button
                                        type="button"
                                        className="text-12 ml-auto underline"
                                        onClick={() =>
                                            setSelectedDestinations((current) =>
                                                current.filter((item) => item.providerId !== destination.providerId)
                                            )
                                        }
                                    >
                                        Remove
                                    </button>
                                </li>
                            ))}
                        </ol>
                    </div>
                ) : null}
                <label className="text-14 mt-5 flex items-center gap-3">
                    <input type="checkbox" name="isCompleted" /> Completed trip
                </label>
                <button
                    disabled={busy || selectedDestinations.length === 0}
                    className="bg-foreground text-14 text-background mt-5 px-5 py-3 disabled:opacity-50"
                >
                    Create Board
                </button>
            </form>

            <div className="mt-16 grid gap-10 lg:grid-cols-2">
                <BoardList title="My Boards" boards={boards} />
                <BoardList title="Recently visited" boards={recent} />
            </div>
            <VisitedWorldMap destinations={destinations} />
        </section>
    );
}

function BoardList({ title, boards }: { title: string; boards: ProfileBoard[] }) {
    return (
        <section>
            <h2 className="font-display text-28 font-bold">{title}</h2>
            {boards.length ? (
                <ul className="mt-4 space-y-3">
                    {boards.map((board) => (
                        <li className="border-line border p-4" key={board.id}>
                            <strong>{board.title}</strong>
                            <span className="text-11 text-graphite ml-2 uppercase">{board.visibility}</span>
                            <p className="text-12 text-graphite mt-1">
                                {board.destinations
                                    .map((destination) => destination.city ?? destination.country)
                                    .join(", ") || "No destination"}
                            </p>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-14 text-graphite mt-4">Nothing here yet.</p>
            )}
        </section>
    );
}
