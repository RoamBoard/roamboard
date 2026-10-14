"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
    getMockProfile,
    getMockProfileServerSnapshot,
    getMockSettings,
    getMockSettingsServerSnapshot,
    resetMockProfile,
    restoreMockStore,
    subscribeMockStore,
    updateMockProfile,
    updateMockSettings
} from "@/data/mock-social";
import { calculateTravelerTier } from "@/utils/tier";
import type { BoardVisibility } from "@/types/board";
import VisibilitySelector from "@/components/features/boards/VisibilitySelector";
import ProfileTagSelector from "@/components/features/profile/ProfileTagSelector";
import UnderlineTabs from "@/components/ui/UnderlineTabs";
import type { BoardTagId } from "@/data/board-tags";
import TravelerTierSelector from "./TravelerTierSelector";
import ProfileAvatarEditor, { validateAvatarUrl } from "./ProfileAvatarEditor";
import PersonalDetailsForm from "./PersonalDetailsForm";
import LanguageEditor from "./LanguageEditor";
import ThemeSelectorCard from "./ThemeSelectorCard";
import SettingsSaveBar from "./SettingsSaveBar";

type TabType = "PROFILE" | "ACCOUNT";

type ProfileSnapshotState = {
    name: string;
    handle: string;
    headline: string;
    bio: string;
    location: string;
    occupation: string;
    avatarUrl: string;
    languages: string[];
    tags: BoardTagId[];
    tier: string;
    defaultBoardVisibility: BoardVisibility;
};

export default function SettingsContent() {
    const [activeTab, setActiveTab] = useState<TabType>("PROFILE");

    // Initialize form states using fixed server snapshot
    const initialProfile = getMockProfileServerSnapshot();
    const initialSettings = getMockSettingsServerSnapshot();

    const [name, setName] = useState(() => initialProfile.name);
    const [handle, setHandle] = useState(() => initialProfile.handle);
    const [headline, setHeadline] = useState(() => initialProfile.headline);
    const [bio, setBio] = useState(() => initialProfile.bio);
    const [location, setLocation] = useState(() => initialProfile.location);
    const [occupation, setOccupation] = useState(
        () => initialProfile.occupation ?? initialProfile.details?.occupation ?? ""
    );
    const [avatarUrl, setAvatarUrl] = useState(() => initialProfile.avatarUrl);

    // Profile snapshot and automatic tier calculation
    const profileSnapshot = useSyncExternalStore(subscribeMockStore, getMockProfile, getMockProfileServerSnapshot);
    const currentTier = calculateTravelerTier(profileSnapshot.mapStats);
    const [selectedTier, setSelectedTier] = useState<string>(() => initialProfile.tier || currentTier.name);

    const MAX_LANGUAGES = 10;

    // Details state
    const [languages, setLanguages] = useState<string[]>(() => initialProfile.details.languages);
    const [tags, setTags] = useState<BoardTagId[]>(
        () => initialProfile.details.tags ?? initialProfile.details.interests ?? []
    );

    // Account settings state
    const settingsSnapshot = useSyncExternalStore(subscribeMockStore, getMockSettings, getMockSettingsServerSnapshot);
    const theme = settingsSnapshot.theme;

    function handleThemeChange(newTheme: "light" | "dark") {
        updateMockSettings({ theme: newTheme });
        try {
            localStorage.setItem("roamboard-theme", newTheme);
        } catch {
            // Theme still switches in memory
        }
    }

    const [defaultBoardVisibility, setDefaultBoardVisibility] = useState<BoardVisibility>(
        () => initialSettings.defaultBoardVisibility
    );

    // Load saved values afterward and initialize form through the same path
    const isFormInitializedRef = useRef(false);

    useEffect(() => {
        restoreMockStore();
    }, []);

    useEffect(() => {
        if (!isFormInitializedRef.current) {
            setName(profileSnapshot.name);
            setHandle(profileSnapshot.handle);
            setHeadline(profileSnapshot.headline);
            setBio(profileSnapshot.bio);
            setLocation(profileSnapshot.location);
            setOccupation(profileSnapshot.occupation ?? profileSnapshot.details?.occupation ?? "");
            setAvatarUrl(profileSnapshot.avatarUrl);
            setSelectedTier(profileSnapshot.tier || calculateTravelerTier(profileSnapshot.mapStats).name);
            setLanguages(profileSnapshot.details?.languages ?? []);
            setTags(profileSnapshot.details?.tags ?? profileSnapshot.details?.interests ?? []);
            setDefaultBoardVisibility(settingsSnapshot.defaultBoardVisibility);
            isFormInitializedRef.current = true;
        }
    }, [profileSnapshot, settingsSnapshot]);

    // UI Feedback state
    const [lastSavedSnapshot, setLastSavedSnapshot] = useState<ProfileSnapshotState | null>(null);
    const [showSaveToast, setShowSaveToast] = useState(false);
    const [toastKey, setToastKey] = useState(0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Dirty tracking: compares current form state against saved store snapshots
    const savedOccupation = profileSnapshot.occupation ?? profileSnapshot.details?.occupation ?? "";
    const savedLanguages = profileSnapshot.details?.languages ?? [];
    const savedTags = profileSnapshot.details?.tags ?? profileSnapshot.details?.interests ?? [];

    const normalizedName = name.trim().toUpperCase();
    const isNameDirty = normalizedName !== profileSnapshot.name.trim().toUpperCase();

    const formattedCurrentHandle = handle.trim()
        ? handle.trim().startsWith("@")
            ? handle.trim()
            : `@${handle.trim()}`
        : "";
    const formattedSnapshotHandle = profileSnapshot.handle.trim()
        ? profileSnapshot.handle.trim().startsWith("@")
            ? profileSnapshot.handle.trim()
            : `@${profileSnapshot.handle.trim()}`
        : "";
    const isHandleDirty = formattedCurrentHandle !== formattedSnapshotHandle;

    const isHeadlineDirty = headline.trim() !== profileSnapshot.headline.trim();
    const isBioDirty = bio.trim() !== profileSnapshot.bio.trim();
    const isLocationDirty = location.trim() !== profileSnapshot.location.trim();
    const isOccupationDirty = occupation.trim() !== savedOccupation.trim();
    const isAvatarDirty = avatarUrl.trim() !== profileSnapshot.avatarUrl.trim();
    const isTierDirty = selectedTier !== (profileSnapshot.tier || currentTier.name);
    const isLanguagesDirty =
        languages.length !== savedLanguages.length || languages.some((l, i) => l !== savedLanguages[i]);
    const isTagsDirty = tags.length !== savedTags.length || tags.some((t, i) => t !== savedTags[i]);
    const isVisibilityDirty = defaultBoardVisibility !== settingsSnapshot.defaultBoardVisibility;

    const isDirty =
        isNameDirty ||
        isHandleDirty ||
        isHeadlineDirty ||
        isBioDirty ||
        isLocationDirty ||
        isOccupationDirty ||
        isAvatarDirty ||
        isTierDirty ||
        isLanguagesDirty ||
        isTagsDirty ||
        isVisibilityDirty;

    // Derived toast visibility: automatically hidden if user starts making fresh uncommitted edits
    const effectiveShowToast = showSaveToast && !isDirty;

    const handleDismissToast = useCallback(() => {
        setShowSaveToast(false);
        setLastSavedSnapshot(null);
    }, []);

    // Save changes handler
    function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setErrorMessage(null);

        // Validation
        if (!name.trim()) {
            setErrorMessage("Display name cannot be empty.");
            return;
        }

        if (avatarUrl.trim()) {
            const avatarVal = validateAvatarUrl(avatarUrl);
            if (!avatarVal.isValid) {
                setErrorMessage(avatarVal.error ?? "Invalid profile picture URL.");
                return;
            }
        }

        const formattedHandle = handle.startsWith("@") ? handle.trim() : `@${handle.trim()}`;

        // Save previous snapshot so user can Undo
        const previousState: ProfileSnapshotState = {
            name: profileSnapshot.name,
            handle: profileSnapshot.handle,
            headline: profileSnapshot.headline,
            bio: profileSnapshot.bio,
            location: profileSnapshot.location,
            occupation: profileSnapshot.occupation ?? profileSnapshot.details?.occupation ?? "",
            avatarUrl: profileSnapshot.avatarUrl,
            languages: [...profileSnapshot.details.languages],
            tags: [...(profileSnapshot.details.tags ?? profileSnapshot.details.interests ?? [])],
            tier: profileSnapshot.tier,
            defaultBoardVisibility: settingsSnapshot.defaultBoardVisibility
        };
        setLastSavedSnapshot(previousState);

        const savedName = name.trim().toUpperCase();
        const savedHandle = formattedHandle;
        const savedHeadline = headline.trim();
        const savedBio = bio.trim();
        const savedLocation = location.trim();
        const savedOccupation = occupation.trim();
        const savedAvatarUrl = avatarUrl.trim();

        // Update local form state to match the normalized saved values
        setName(savedName);
        setHandle(savedHandle);
        setHeadline(savedHeadline);
        setBio(savedBio);
        setLocation(savedLocation);
        setOccupation(savedOccupation);
        setAvatarUrl(savedAvatarUrl);

        // Update mock data store
        updateMockProfile({
            name: savedName,
            handle: savedHandle,
            headline: savedHeadline,
            bio: savedBio,
            location: savedLocation,
            occupation: savedOccupation,
            avatarUrl: savedAvatarUrl,
            tier: selectedTier,
            details: {
                location: savedLocation,
                occupation: savedOccupation,
                languages,
                tags,
                interests: tags
            }
        });

        updateMockSettings({
            defaultBoardVisibility
        });

        setToastKey((k) => k + 1);
        setShowSaveToast(true);
    }

    function handleUndo() {
        if (!lastSavedSnapshot) return;

        setName(lastSavedSnapshot.name);
        setHandle(lastSavedSnapshot.handle);
        setHeadline(lastSavedSnapshot.headline);
        setBio(lastSavedSnapshot.bio);
        setLocation(lastSavedSnapshot.location);
        setOccupation(lastSavedSnapshot.occupation);
        setAvatarUrl(lastSavedSnapshot.avatarUrl);
        setLanguages(lastSavedSnapshot.languages);
        setTags(lastSavedSnapshot.tags);
        setSelectedTier(lastSavedSnapshot.tier);
        setDefaultBoardVisibility(lastSavedSnapshot.defaultBoardVisibility);

        updateMockProfile({
            name: lastSavedSnapshot.name,
            handle: lastSavedSnapshot.handle,
            headline: lastSavedSnapshot.headline,
            bio: lastSavedSnapshot.bio,
            location: lastSavedSnapshot.location,
            occupation: lastSavedSnapshot.occupation,
            avatarUrl: lastSavedSnapshot.avatarUrl,
            tier: lastSavedSnapshot.tier,
            details: {
                location: lastSavedSnapshot.location,
                occupation: lastSavedSnapshot.occupation,
                languages: lastSavedSnapshot.languages,
                tags: lastSavedSnapshot.tags,
                interests: lastSavedSnapshot.tags
            }
        });

        updateMockSettings({
            defaultBoardVisibility: lastSavedSnapshot.defaultBoardVisibility
        });

        setLastSavedSnapshot(null);
        setShowSaveToast(false);
    }

    // Reset handler
    function handleReset() {
        const resetProfile = resetMockProfile();

        setName(resetProfile.name);
        setHandle(resetProfile.handle);
        setHeadline(resetProfile.headline);
        setBio(resetProfile.bio);
        setLocation(resetProfile.location);
        setOccupation(resetProfile.occupation ?? resetProfile.details?.occupation ?? "");
        setAvatarUrl(resetProfile.avatarUrl);
        setLanguages(resetProfile.details.languages);
        setTags(resetProfile.details.tags ?? resetProfile.details.interests ?? []);
        setSelectedTier(resetProfile.tier);

        setDefaultBoardVisibility("friends");
        setShowSaveToast(false);
        setLastSavedSnapshot(null);
    }

    const tabs: TabType[] = ["PROFILE", "ACCOUNT"];

    return (
        <div className="mx-auto w-full max-w-4xl pb-32">
            {/* Header */}
            <header className="mb-8">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <span className="text-10 tracking-label text-muted-foreground font-bold uppercase">
                            ACCOUNT &amp; PROFILE
                        </span>
                        <h1 className="font-display text-48 sm:text-60 text-foreground mt-1 font-bold tracking-tight uppercase">
                            SETTINGS
                        </h1>
                    </div>

                    <Link
                        href="/profile"
                        className="text-12 text-muted-foreground hover:text-foreground font-body flex items-center gap-1 pb-2 font-medium transition-colors hover:underline"
                    >
                        view live profile →
                    </Link>
                </div>

                {/* Navigation Tabs */}
                <UnderlineTabs
                    tabs={tabs}
                    activeTab={activeTab}
                    onChange={setActiveTab}
                    ariaLabel="Settings sections"
                />
            </header>

            {errorMessage && (
                <div
                    role="alert"
                    className="border-line bg-faint text-12 text-foreground mb-6 flex items-center gap-2 rounded-[2px] border px-4 py-3 font-medium"
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
                        <TravelerTierSelector
                            selectedTier={selectedTier}
                            onSelectTier={setSelectedTier}
                            mapStats={profileSnapshot.mapStats}
                        />

                        <ProfileAvatarEditor avatarUrl={avatarUrl} onChangeAvatarUrl={setAvatarUrl} />

                        <PersonalDetailsForm
                            name={name}
                            onChangeName={setName}
                            handle={handle}
                            onChangeHandle={setHandle}
                            occupation={occupation}
                            onChangeOccupation={setOccupation}
                            location={location}
                            onChangeLocation={setLocation}
                            headline={headline}
                            onChangeHeadline={setHeadline}
                            bio={bio}
                            onChangeBio={setBio}
                        />

                        <LanguageEditor
                            languages={languages}
                            onChangeLanguages={setLanguages}
                            maxLanguages={MAX_LANGUAGES}
                        />

                        <div className="border-line bg-background rounded-[2px] border p-6">
                            <ProfileTagSelector selectedTagIds={tags} onChange={setTags} maxTags={10} />
                        </div>
                    </div>
                )}

                {/* TAB 2: ACCOUNT & PRIVACY */}
                {activeTab === "ACCOUNT" && (
                    <div className="space-y-6">
                        <ThemeSelectorCard theme={theme} onThemeChange={handleThemeChange} />

                        {/* Default Board Visibility */}
                        <div className="border-line bg-background rounded-[2px] border p-6">
                            <h2 className="font-display text-16 text-foreground font-bold tracking-tight uppercase">
                                Default Board Visibility
                            </h2>
                            <p className="text-12 text-muted-foreground mt-0.5 mb-5">
                                Choose who can view new boards you create by default.
                            </p>

                            <VisibilitySelector
                                value={defaultBoardVisibility}
                                onChange={(val) => setDefaultBoardVisibility(val)}
                                showLabel={false}
                            />
                        </div>
                    </div>
                )}

                <SettingsSaveBar
                    isDirty={isDirty}
                    onReset={handleReset}
                    showToast={effectiveShowToast}
                    onDismissToast={handleDismissToast}
                    onUndo={handleUndo}
                    canUndo={Boolean(lastSavedSnapshot)}
                    toastKey={toastKey}
                />
            </form>
        </div>
    );
}
