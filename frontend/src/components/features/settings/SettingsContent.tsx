"use client";

import { useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import {
    getMockProfile,
    getMockSettings,
    resetMockProfile,
    subscribeMockStore,
    updateMockProfile,
    updateMockSettings
} from "@/data/mock-social";
import { calculateTravelerTier, TRAVELER_TIERS } from "@/utils/tier";
import type { BoardVisibility } from "@/types/board";
import VisibilitySelector from "@/components/features/boards/VisibilitySelector";
import PillTagInput from "@/components/features/boards/PillTagInput";

type TabType = "PROFILE" | "PREFERENCES" | "ACCOUNT";

const AVATAR_PRESETS = [
    {
        label: "Rowan (Default)",
        url: "https://images.unsplash.com/photo-1769786186317-272d062fcf93?auto=format&fit=crop&w=400&q=80"
    },
    {
        label: "Balkans Backpacking",
        url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80"
    },
    {
        label: "Mountain Wanderer",
        url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80"
    },
    {
        label: "Urban Explorer",
        url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80"
    }
];

export default function SettingsContent() {
    const [activeTab, setActiveTab] = useState<TabType>("PROFILE");

    // Initialize form states directly from mock store
    const initialProfile = getMockProfile();
    const initialSettings = getMockSettings();

    const [name, setName] = useState(() => initialProfile.name);
    const [handle, setHandle] = useState(() => initialProfile.handle);
    const [headline, setHeadline] = useState(() => initialProfile.headline);
    const [bio, setBio] = useState(() => initialProfile.bio);
    const [location, setLocation] = useState(() => initialProfile.location);
    const [whatsapp, setWhatsapp] = useState(() => initialProfile.whatsapp);
    const [avatarUrl, setAvatarUrl] = useState(() => initialProfile.avatarUrl);

    // Profile snapshot and automatic tier calculation
    const profileSnapshot = useSyncExternalStore(
        subscribeMockStore,
        getMockProfile,
        getMockProfile
    );
    const currentTier = calculateTravelerTier(profileSnapshot.mapStats);

    // Details state
    const [languages, setLanguages] = useState<string[]>(
        () => initialProfile.details.languages
    );
    const [newLanguage, setNewLanguage] = useState("");
    const [interests, setInterests] = useState<string[]>(
        () => initialProfile.details.interests
    );
    const [facts, setFacts] = useState<string[]>(() => initialProfile.facts);
    const [newFact, setNewFact] = useState("");

    // Account settings state
    const [theme, setTheme] = useState<"light" | "dark">(
        () => initialSettings.theme
    );
    const [defaultBoardVisibility, setDefaultBoardVisibility] =
        useState<BoardVisibility>(
            () => initialSettings.defaultBoardVisibility
        );
    const [emailNotifications, setEmailNotifications] = useState(
        () => initialSettings.emailNotifications
    );

    // UI Feedback state
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Language handlers
    function handleAddLanguage() {
        const trimmed = newLanguage.trim();
        if (trimmed && !languages.includes(trimmed)) {
            setLanguages([...languages, trimmed]);
            setNewLanguage("");
        }
    }

    function handleRemoveLanguage(item: string) {
        setLanguages(languages.filter((l) => l !== item));
    }

    // Fact handlers
    function handleAddFact() {
        const trimmed = newFact.trim();
        if (trimmed && !facts.includes(trimmed)) {
            setFacts([...facts, trimmed]);
            setNewFact("");
        }
    }

    function handleRemoveFact(index: number) {
        setFacts(facts.filter((_, i) => i !== index));
    }

    // Theme toggle handler
    function handleThemeChange(newTheme: "light" | "dark") {
        setTheme(newTheme);
        if (newTheme === "dark") {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
    }

    // Save changes handler
    function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setErrorMessage(null);

        // Validation
        if (!name.trim()) {
            setErrorMessage("Display name cannot be empty.");
            return;
        }

        const formattedHandle = handle.startsWith("@")
            ? handle.trim()
            : `@${handle.trim()}`;

        // Update mock data store
        updateMockProfile({
            name: name.trim().toUpperCase(),
            handle: formattedHandle,
            headline: headline.trim(),
            bio: bio.trim(),
            location: location.trim(),
            whatsapp: whatsapp.trim(),
            avatarUrl: avatarUrl.trim(),
            facts,
            details: {
                location: location.trim(),
                languages,
                interests,
                overlappingDestinations:
                    getMockProfile().details.overlappingDestinations ?? 14
            }
        });

        updateMockSettings({
            theme,
            defaultBoardVisibility,
            emailNotifications
        });

        setFeedbackMessage("Changes successfully saved to mock data.");

        const timer = setTimeout(() => {
            setFeedbackMessage(null);
        }, 3500);

        return () => clearTimeout(timer);
    }

    // Reset handler
    function handleReset() {
        const resetProfile = resetMockProfile();

        setName(resetProfile.name);
        setHandle(resetProfile.handle);
        setHeadline(resetProfile.headline);
        setBio(resetProfile.bio);
        setLocation(resetProfile.location);
        setWhatsapp(resetProfile.whatsapp);
        setAvatarUrl(resetProfile.avatarUrl);
        setLanguages(resetProfile.details.languages);
        setInterests(resetProfile.details.interests);
        setFacts(resetProfile.facts);

        handleThemeChange("light");
        setDefaultBoardVisibility("friends");
        setEmailNotifications(true);

        setFeedbackMessage("Profile reset to original mock data.");
        setTimeout(() => setFeedbackMessage(null), 3000);
    }

    const tabs: TabType[] = ["PROFILE", "PREFERENCES", "ACCOUNT"];

    return (
        <div className="mx-auto w-full max-w-4xl pb-24">
            {/* Header */}
            <header className="mb-8">
                <span className="text-10 tracking-label text-graphite font-bold uppercase">
                    PREFERENCES
                </span>
                <h1 className="font-display text-48 sm:text-60 text-obsidian mt-1 font-bold tracking-tight uppercase">
                    SETTINGS
                </h1>

                {/* Navigation Tabs */}
                <nav
                    aria-label="Settings sections"
                    className="border-line mt-4 flex items-center gap-6 border-b pb-3"
                >
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab;
                        return (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => setActiveTab(tab)}
                                aria-current={isActive ? "true" : undefined}
                                className={`text-12 cursor-pointer font-bold tracking-wider uppercase transition-colors focus-visible:outline-1 focus-visible:outline-offset-4 ${
                                    isActive
                                        ? "text-obsidian underline decoration-2 underline-offset-8"
                                        : "text-graphite hover:text-obsidian"
                                }`}
                            >
                                {tab}
                            </button>
                        );
                    })}
                </nav>
            </header>

            {/* Notification & Error Banners */}
            {feedbackMessage && (
                <div
                    role="status"
                    className="border-line bg-porcelain/50 text-12 text-obsidian mb-6 flex items-center justify-between rounded-[2px] border px-4 py-3 font-medium transition-all"
                >
                    <span className="flex items-center gap-2">
                        <span aria-hidden="true" className="text-obsidian font-bold">
                            ✓
                        </span>
                        {feedbackMessage}
                    </span>
                    <Link
                        href="/profile"
                        className="text-graphite hover:text-obsidian font-body underline transition-colors"
                    >
                        view live profile →
                    </Link>
                </div>
            )}

            {errorMessage && (
                <div
                    role="alert"
                    className="border-line bg-porcelain text-12 text-obsidian mb-6 flex items-center gap-2 rounded-[2px] border px-4 py-3 font-medium"
                >
                    <span aria-hidden="true" className="font-bold">
                        !
                    </span>
                    {errorMessage}
                </div>
            )}

            <form onSubmit={handleSave} className="space-y-8">
                {/* TAB 1: PROFILE */}
                {activeTab === "PROFILE" && (
                    <div className="space-y-6">
                        {/* Traveler Tier Section (At the actual top, above Profile Picture) */}
                        <div className="border-line bg-background rounded-[2px] border p-6">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <span className="text-10 tracking-label text-graphite block font-bold uppercase">
                                        Traveler Tier
                                    </span>
                                    <div className="mt-1 flex items-center gap-3">
                                        <span className="font-display text-24 sm:text-28 text-obsidian font-bold uppercase">
                                            {currentTier.name}
                                        </span>
                                        <span className="border-line text-10 tracking-label text-obsidian font-body rounded-[2px] border bg-porcelain px-2.5 py-1 font-bold uppercase">
                                            Automatically Granted
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <p className="text-12 text-graphite mt-2 max-w-2xl leading-relaxed font-medium">
                                {currentTier.description} Tiers cannot be manually edited — they are unlocked automatically through your verified travel activity and completed Roamboards.
                            </p>

                            {/* Current Qualifying Stats */}
                            <div className="border-line mt-5 grid grid-cols-2 gap-3 border-t pt-5 sm:grid-cols-4">
                                <div className="bg-porcelain/40 border-line rounded-[2px] border p-3">
                                    <span className="text-10 text-graphite block font-medium">
                                        Countries Visited
                                    </span>
                                    <span className="font-display text-18 text-obsidian font-bold">
                                        {profileSnapshot.mapStats.countriesVisited}
                                    </span>
                                </div>
                                <div className="bg-porcelain/40 border-line rounded-[2px] border p-3">
                                    <span className="text-10 text-graphite block font-medium">
                                        Cities Explored
                                    </span>
                                    <span className="font-display text-18 text-obsidian font-bold">
                                        {profileSnapshot.mapStats.citiesExplored}
                                    </span>
                                </div>
                                <div className="bg-porcelain/40 border-line rounded-[2px] border p-3">
                                    <span className="text-10 text-graphite block font-medium">
                                        Continents Covered
                                    </span>
                                    <span className="font-display text-18 text-obsidian font-bold">
                                        {profileSnapshot.mapStats.continentsCovered}
                                    </span>
                                </div>
                                <div className="bg-porcelain/40 border-line rounded-[2px] border p-3">
                                    <span className="text-10 text-graphite block font-medium">
                                        Photos Taken
                                    </span>
                                    <span className="font-display text-18 text-obsidian font-bold">
                                        {profileSnapshot.mapStats.photosTaken.toLocaleString("en-US")}
                                    </span>
                                </div>
                            </div>

                            {/* Tier Progression Roadmap */}
                            <div className="border-line mt-5 border-t pt-4">
                                <span className="text-10 tracking-label text-graphite mb-3 block font-bold uppercase">
                                    Tier Milestones &amp; Requirements
                                </span>
                                <div className="space-y-2">
                                    {TRAVELER_TIERS.map((t) => {
                                        const isUnlocked =
                                            profileSnapshot.mapStats.countriesVisited >= t.minCountries &&
                                            profileSnapshot.mapStats.citiesExplored >= t.minCities &&
                                            profileSnapshot.mapStats.continentsCovered >= t.minContinents;
                                        const isCurrent = t.name === currentTier.name;

                                        return (
                                            <div
                                                key={t.name}
                                                className={`border-line flex items-center justify-between rounded-[2px] border px-3.5 py-2.5 text-12 transition-colors ${
                                                    isCurrent
                                                        ? "bg-porcelain/60 font-bold text-obsidian border-obsidian"
                                                        : isUnlocked
                                                        ? "bg-background font-medium text-obsidian"
                                                        : "bg-porcelain/20 font-normal text-graphite"
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <span className="text-12 font-bold" aria-hidden="true">
                                                        {isUnlocked ? "✓" : "○"}
                                                    </span>
                                                    <span className="font-display uppercase tracking-tight">
                                                        {t.name}
                                                    </span>
                                                    {isCurrent && (
                                                        <span className="bg-obsidian text-10 text-white rounded-[2px] px-1.5 py-0.5 font-bold uppercase">
                                                            Current
                                                        </span>
                                                    )}
                                                </div>

                                                <span className="text-10 text-graphite font-body">
                                                    {t.minCountries > 0
                                                        ? `${t.minCountries}+ countries · ${t.minCities}+ cities · ${t.minContinents}+ continents`
                                                        : "Entry tier for all new travelers"}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Avatar Section */}
                        <div className="border-line bg-background rounded-[2px] border p-6">
                            <h2 className="font-display text-16 text-obsidian font-bold uppercase tracking-tight">
                                Profile Picture
                            </h2>
                            <p className="text-12 text-graphite mt-0.5">
                                Set your profile portrait displayed across your
                                boards and traveler cards.
                            </p>

                            <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-center">
                                {/* Current Photo Thumbnail */}
                                <div className="bg-porcelain border-line relative aspect-[3/4] h-28 shrink-0 overflow-hidden rounded-[2px] border shadow-xs">
                                    {avatarUrl ? (
                                        <Image
                                            src={avatarUrl}
                                            alt="Current profile preview"
                                            fill
                                            sizes="120px"
                                            className="object-cover"
                                        />
                                    ) : (
                                        <div className="text-10 text-graphite flex h-full w-full items-center justify-center">
                                            No photo
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 space-y-3">
                                    <div>
                                        <label
                                            htmlFor="avatar-url-input"
                                            className="text-10 tracking-label text-graphite block font-bold uppercase"
                                        >
                                            Image URL
                                        </label>
                                        <input
                                            id="avatar-url-input"
                                            type="url"
                                            value={avatarUrl}
                                            onChange={(e) =>
                                                setAvatarUrl(e.target.value)
                                            }
                                            placeholder="https://images.unsplash.com/..."
                                            className="border-line text-12 text-obsidian placeholder:text-stone font-body focus:border-obsidian mt-1 w-full rounded-[2px] border px-3 py-2 transition-colors focus-visible:outline-none"
                                        />
                                    </div>

                                    {/* Quick Preset Selector */}
                                    <div>
                                        <span className="text-10 tracking-label text-graphite block font-bold uppercase">
                                            Or choose a preset
                                        </span>
                                        <div className="mt-1.5 flex flex-wrap gap-2">
                                            {AVATAR_PRESETS.map((preset) => (
                                                <button
                                                    key={preset.label}
                                                    type="button"
                                                    onClick={() =>
                                                        setAvatarUrl(preset.url)
                                                    }
                                                    className={`border-line text-10 text-graphite hover:text-obsidian hover:border-obsidian cursor-pointer rounded-[2px] border px-2.5 py-1 font-medium transition-colors ${
                                                        avatarUrl === preset.url
                                                            ? "bg-porcelain border-obsidian text-obsidian"
                                                            : "bg-background"
                                                    }`}
                                                >
                                                    {preset.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Photo Upload Notice */}
                                    <div className="border-line bg-porcelain/40 rounded-[2px] border border-dashed p-3">
                                        <div className="flex items-center gap-1.5">
                                            <span className="bg-obsidian h-1.5 w-1.5 shrink-0 rounded-full" />
                                            <span className="text-10 tracking-label text-obsidian font-bold uppercase">
                                                Photo Upload Notice
                                            </span>
                                        </div>
                                        <p className="text-11 text-graphite mt-1 leading-normal font-medium">
                                            Upload should be implemented later when the backend framework is created. Currently using image URL and presets.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Identity & Basic Info */}
                        <div className="border-line bg-background rounded-[2px] border p-6">
                            <h2 className="font-display text-16 text-obsidian font-bold uppercase tracking-tight">
                                Personal Details
                            </h2>
                            <p className="text-12 text-graphite mt-0.5">
                                Public information visible on your social
                                traveler profile.
                            </p>

                            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                                <div>
                                    <label
                                        htmlFor="name-input"
                                        className="text-10 tracking-label text-graphite block font-bold uppercase"
                                    >
                                        Display Name *
                                    </label>
                                    <input
                                        id="name-input"
                                        type="text"
                                        required
                                        value={name}
                                        onChange={(e) =>
                                            setName(e.target.value)
                                        }
                                        placeholder="e.g. ROWAN MERCER"
                                        className="border-line text-14 text-obsidian placeholder:text-stone font-body focus:border-obsidian mt-1 w-full rounded-[2px] border px-3 py-2 transition-colors focus-visible:outline-none"
                                    />
                                </div>

                                <div>
                                    <label
                                        htmlFor="handle-input"
                                        className="text-10 tracking-label text-graphite block font-bold uppercase"
                                    >
                                        Handle / Username
                                    </label>
                                    <input
                                        id="handle-input"
                                        type="text"
                                        value={handle}
                                        onChange={(e) =>
                                            setHandle(e.target.value)
                                        }
                                        placeholder="@rowan.mercer"
                                        className="border-line text-14 text-obsidian placeholder:text-stone font-body focus:border-obsidian mt-1 w-full rounded-[2px] border px-3 py-2 transition-colors focus-visible:outline-none"
                                    />
                                </div>

                                <div>
                                    <label
                                        htmlFor="location-input"
                                        className="text-10 tracking-label text-graphite block font-bold uppercase"
                                    >
                                        Based In / Location
                                    </label>
                                    <input
                                        id="location-input"
                                        type="text"
                                        value={location}
                                        onChange={(e) =>
                                            setLocation(e.target.value)
                                        }
                                        placeholder="e.g. San Francisco, USA"
                                        className="border-line text-14 text-obsidian placeholder:text-stone font-body focus:border-obsidian mt-1 w-full rounded-[2px] border px-3 py-2 transition-colors focus-visible:outline-none"
                                    />
                                </div>

                                <div>
                                    <label
                                        htmlFor="whatsapp-input"
                                        className="text-10 tracking-label text-graphite block font-bold uppercase"
                                    >
                                        WhatsApp / Contact
                                    </label>
                                    <input
                                        id="whatsapp-input"
                                        type="text"
                                        value={whatsapp}
                                        onChange={(e) =>
                                            setWhatsapp(e.target.value)
                                        }
                                        placeholder="e.g. 07012545678"
                                        className="border-line text-14 text-obsidian placeholder:text-stone font-body focus:border-obsidian mt-1 w-full rounded-[2px] border px-3 py-2 transition-colors focus-visible:outline-none"
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label
                                        htmlFor="headline-input"
                                        className="text-10 tracking-label text-graphite block font-bold uppercase"
                                    >
                                        Profile Headline
                                    </label>
                                    <input
                                        id="headline-input"
                                        type="text"
                                        value={headline}
                                        onChange={(e) =>
                                            setHeadline(e.target.value)
                                        }
                                        placeholder="e.g. Chasing places, collecting stories."
                                        className="border-line text-14 text-obsidian placeholder:text-stone font-body focus:border-obsidian mt-1 w-full rounded-[2px] border px-3 py-2 transition-colors focus-visible:outline-none"
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label
                                        htmlFor="bio-input"
                                        className="text-10 tracking-label text-graphite block font-bold uppercase"
                                    >
                                        Biography
                                    </label>
                                    <textarea
                                        id="bio-input"
                                        rows={4}
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value)}
                                        placeholder="Write about your travel philosophy, memorable adventures, and plans..."
                                        className="border-line text-13 text-obsidian placeholder:text-stone font-body focus:border-obsidian mt-1 w-full rounded-[2px] border px-3 py-2.5 leading-relaxed transition-colors focus-visible:outline-none"
                                    />
                                    <span className="text-10 text-graphite mt-1 block text-right">
                                        {bio.length} characters
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 2: PREFERENCES */}
                {activeTab === "PREFERENCES" && (
                    <div className="space-y-6">
                        {/* Languages Spoken */}
                        <div className="border-line bg-background rounded-[2px] border p-6">
                            <h2 className="font-display text-16 text-obsidian font-bold uppercase tracking-tight">
                                Languages Spoken
                            </h2>
                            <p className="text-12 text-graphite mt-0.5">
                                Languages you can communicate in when
                                collaborating on boards or meeting travelers.
                            </p>

                            <div className="mt-4 flex flex-wrap gap-2">
                                {languages.map((lang) => (
                                    <span
                                        key={lang}
                                        className="border-line bg-porcelain/60 text-12 text-obsidian font-body flex items-center gap-1.5 rounded-[2px] border px-2.5 py-1 font-medium"
                                    >
                                        {lang}
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleRemoveLanguage(lang)
                                            }
                                            aria-label={`Remove ${lang}`}
                                            className="text-graphite hover:text-obsidian cursor-pointer text-xs"
                                        >
                                            ✕
                                        </button>
                                    </span>
                                ))}
                            </div>

                            <div className="mt-4 flex max-w-sm gap-2">
                                <input
                                    type="text"
                                    value={newLanguage}
                                    onChange={(e) =>
                                        setNewLanguage(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleAddLanguage();
                                        }
                                    }}
                                    placeholder="Add language (e.g. Spanish)"
                                    className="border-line text-12 text-obsidian placeholder:text-stone font-body focus:border-obsidian flex-1 rounded-[2px] border px-3 py-1.5 transition-colors focus-visible:outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddLanguage}
                                    className="border-line text-12 text-graphite hover:text-obsidian hover:border-obsidian font-body cursor-pointer rounded-[2px] border px-3 py-1.5 font-medium transition-colors"
                                >
                                    + Add
                                </button>
                            </div>
                        </div>

                        {/* Travel Interests & Tags */}
                        <div className="border-line bg-background rounded-[2px] border p-6">
                            <h2 className="font-display text-16 text-obsidian font-bold uppercase tracking-tight">
                                Travel Interests &amp; Tags
                            </h2>
                            <p className="text-12 text-graphite mt-0.5 mb-4">
                                Tags that describe your favorite types of
                                activities and trips.
                            </p>

                            <PillTagInput
                                label="Interests &amp; Tags"
                                tags={interests}
                                onChange={setInterests}
                                addButtonLabel="add tag +"
                                placeholder="e.g. Architecture"
                                tooltip="Your favorite travel themes and interests"
                            />
                        </div>

                        {/* Interesting Facts about me */}
                        <div className="border-line bg-background rounded-[2px] border p-6">
                            <h2 className="font-display text-16 text-obsidian font-bold uppercase tracking-tight">
                                Interesting Facts
                            </h2>
                            <p className="text-12 text-graphite mt-0.5">
                                Trivia snippets shown in the &quot;some
                                interesting facts about me&quot; section.
                            </p>

                            <div className="mt-4 space-y-2.5">
                                {facts.map((fact, index) => (
                                    <div
                                        key={index}
                                        className="border-line bg-porcelain/30 flex items-start justify-between gap-3 rounded-[2px] border p-3"
                                    >
                                        <p className="text-13 text-obsidian font-body flex-1 leading-relaxed">
                                            {fact}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleRemoveFact(index)
                                            }
                                            aria-label={`Delete fact ${index + 1}`}
                                            className="text-12 text-graphite hover:text-obsidian cursor-pointer font-medium"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-4 flex gap-2">
                                <input
                                    type="text"
                                    value={newFact}
                                    onChange={(e) => setNewFact(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleAddFact();
                                        }
                                    }}
                                    placeholder="Add an interesting fact or travel story..."
                                    className="border-line text-12 text-obsidian placeholder:text-stone font-body focus:border-obsidian flex-1 rounded-[2px] border px-3 py-2 transition-colors focus-visible:outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddFact}
                                    className="border-line text-12 text-graphite hover:text-obsidian hover:border-obsidian font-body cursor-pointer rounded-[2px] border px-3.5 py-2 font-medium transition-colors"
                                >
                                    + Add Fact
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 3: ACCOUNT & PRIVACY */}
                {activeTab === "ACCOUNT" && (
                    <div className="space-y-6">
                        {/* Theme switcher */}
                        <div className="border-line bg-background rounded-[2px] border p-6">
                            <h2 className="font-display text-16 text-obsidian font-bold uppercase tracking-tight">
                                Appearance / Theme
                            </h2>
                            <p className="text-12 text-graphite mt-0.5">
                                Choose how Roamboard looks on your device.
                            </p>

                            <div className="mt-4 grid grid-cols-2 gap-4 max-w-md">
                                <button
                                    type="button"
                                    onClick={() => handleThemeChange("light")}
                                    className={`border-line cursor-pointer rounded-[2px] border p-4 text-left transition-colors ${
                                        theme === "light"
                                            ? "border-obsidian bg-porcelain/70"
                                            : "hover:border-obsidian"
                                    }`}
                                >
                                    <div className="text-14 text-obsidian font-bold">
                                        Light Mode
                                    </div>
                                    <p className="text-11 text-graphite mt-1">
                                        Clean architectural white canvas with
                                        graphite typography.
                                    </p>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleThemeChange("dark")}
                                    className={`border-line cursor-pointer rounded-[2px] border p-4 text-left transition-colors ${
                                        theme === "dark"
                                            ? "border-obsidian bg-porcelain/70"
                                            : "hover:border-obsidian"
                                    }`}
                                >
                                    <div className="text-14 text-obsidian font-bold">
                                        Dark Mode
                                    </div>
                                    <p className="text-11 text-graphite mt-1">
                                        Obsidian night palette with high-contrast
                                        stone lines.
                                    </p>
                                </button>
                            </div>
                        </div>

                        {/* Default Board Visibility */}
                        <div className="border-line bg-background rounded-[2px] border p-6">
                            <h2 className="font-display text-16 text-obsidian font-bold uppercase tracking-tight">
                                Default Board Visibility
                            </h2>
                            <p className="text-12 text-graphite mt-0.5 mb-5">
                                Choose who can view new boards you create by
                                default.
                            </p>

                            <VisibilitySelector
                                value={defaultBoardVisibility}
                                onChange={(val) => setDefaultBoardVisibility(val)}
                                showLabel={false}
                            />
                        </div>

                        {/* Notifications */}
                        <div className="border-line bg-background rounded-[2px] border p-6">
                            <h2 className="font-display text-16 text-obsidian font-bold uppercase tracking-tight">
                                Notifications
                            </h2>
                            <p className="text-12 text-graphite mt-0.5">
                                Manage how you receive updates from friends and
                                destinations.
                            </p>

                            <div className="mt-4 max-w-md">
                                <label className="flex cursor-pointer items-center justify-between py-2">
                                    <div>
                                        <span className="text-13 text-obsidian font-bold">
                                            Travel updates &amp; invitations
                                        </span>
                                        <p className="text-11 text-graphite">
                                            Receive notifications when friends
                                            invite you to boards or copy your
                                            itineraries.
                                        </p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={emailNotifications}
                                        onChange={(e) =>
                                            setEmailNotifications(
                                                e.target.checked
                                            )
                                        }
                                        className="h-4 w-4 accent-obsidian"
                                    />
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                {/* Form Action Controls */}
                <div className="border-line flex flex-wrap items-center justify-between gap-4 border-t pt-6">
                    <div className="flex items-center gap-3">
                        <button
                            type="submit"
                            className="bg-obsidian text-background hover:bg-obsidian/90 font-body text-12 cursor-pointer rounded-[2px] px-5 py-2.5 font-bold uppercase tracking-wider transition-colors focus-visible:outline-1 focus-visible:outline-offset-4"
                        >
                            Save Changes
                        </button>
                        <button
                            type="button"
                            onClick={handleReset}
                            className="border-line text-12 text-graphite hover:text-obsidian hover:border-obsidian font-body cursor-pointer rounded-[2px] border px-4 py-2 font-medium transition-colors"
                        >
                            Reset Defaults
                        </button>
                    </div>

                    <Link
                        href="/profile"
                        className="text-12 text-graphite hover:text-obsidian font-body font-medium transition-colors hover:underline"
                    >
                        view live profile →
                    </Link>
                </div>
            </form>
        </div>
    );
}

