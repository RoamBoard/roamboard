"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { listBoardTags } from "@/lib/board-creator-api";
import { loadLanguages, loadProfile, ProfileApiError, updateProfile, type UserProfile } from "@/lib/profile";
import VisibilitySelector from "@/components/features/boards/VisibilitySelector";
import ProfileTagSelector from "@/components/features/profile/ProfileTagSelector";
import UnderlineTabs from "@/components/ui/UnderlineTabs";
import ProfileAvatarEditor from "./ProfileAvatarEditor";
import PersonalDetailsForm from "./PersonalDetailsForm";
import LanguageEditor from "./LanguageEditor";
import ThemeSelectorCard from "./ThemeSelectorCard";
import SettingsSaveBar from "./SettingsSaveBar";

type Tab = "PROFILE" | "ACCOUNT";

function editable(profile: UserProfile) {
    return {
        revision: profile.revision,
        username: profile.username,
        displayName: profile.displayName,
        description: profile.description,
        location: profile.location,
        occupation: profile.occupation,
        languages: profile.languages,
        interests: profile.interests,
        defaultBoardVisibility: profile.defaultBoardVisibility
    };
}

export default function SettingsContent() {
    const [activeTab, setActiveTab] = useState<Tab>("PROFILE");
    const [saved, setSaved] = useState<UserProfile | null>(null);
    const [draft, setDraft] = useState<UserProfile | null>(null);
    const [languages, setLanguages] = useState<string[]>([]);
    const [allowedTags, setAllowedTags] = useState<string[]>([]);
    const [theme, setTheme] = useState<"light" | "dark">("light");
    const [lastSaved, setLastSaved] = useState<UserProfile | null>(null);
    const [showSaveToast, setShowSaveToast] = useState(false);
    const [toastKey, setToastKey] = useState(0);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        const request = { active: true };
        void Promise.all([loadProfile(), loadLanguages(), listBoardTags()])
            .then(([profile, choices, tags]) => {
                if (!request.active) return;
                setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
                setSaved(profile);
                setDraft(profile);
                setLanguages(choices);
                setAllowedTags(tags.map((tag) => tag.name));
            })
            .catch((caught: unknown) => {
                if (request.active)
                    setError(
                        caught instanceof ProfileApiError && caught.status === 401
                            ? "Sign in to edit your profile."
                            : caught instanceof Error
                              ? caught.message
                              : "Settings could not be loaded."
                    );
            })
            .finally(() => {
                if (request.active) setLoading(false);
            });
        return () => {
            request.active = false;
        };
    }, [retry]);

    function reload() {
        setLoading(true);
        setError("");
        setSaved(null);
        setDraft(null);
        setRetry((value) => value + 1);
    }

    const isDirty = Boolean(saved && draft && JSON.stringify(editable(saved)) !== JSON.stringify(editable(draft)));
    function change(field: keyof UserProfile, value: string | string[] | null) {
        setDraft((current) => (current ? { ...current, [field]: value } : current));
        setShowSaveToast(false);
    }

    function changeTheme(value: "light" | "dark") {
        setTheme(value);
        document.documentElement.classList.toggle("dark", value === "dark");
        localStorage.setItem("roamboard-theme", value);
    }

    async function save(event?: FormEvent) {
        event?.preventDefault();
        if (!draft || !saved || saving) return;
        const username = draft.username.trim().toLowerCase();
        if (username.length > 64 || !/^(?:[a-z0-9]|[a-z0-9][a-z0-9._]*[a-z0-9])$/.test(username)) {
            setError(
                "Username must be 1–64 letters, digits, periods, or underscores, without punctuation at either end."
            );
            return;
        }
        if (!draft.displayName.trim()) {
            setError("Display name is required.");
            return;
        }
        if (draft.interests.some((name) => !allowedTags.includes(name))) {
            setError("Choose tags from the available list.");
            return;
        }
        setSaving(true);
        setError("");
        try {
            const next = await updateProfile({
                ...editable(draft),
                revision: saved.revision,
                username,
                location: draft.location?.trim() || null,
                occupation: draft.occupation?.trim() || null,
                interests: draft.interests
            });
            setLastSaved(saved);
            setSaved(next);
            setDraft((current) =>
                current === draft ? next : current ? { ...current, revision: next.revision } : current
            );
            setToastKey((value) => value + 1);
            setShowSaveToast(true);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Profile changes could not be saved.");
        } finally {
            setSaving(false);
        }
    }

    async function undo() {
        if (!lastSaved || !saved || saving) return;
        const draftBeforeUndo = draft;
        setSaving(true);
        setError("");
        try {
            const restored = await updateProfile({ ...editable(lastSaved), revision: saved.revision });
            setSaved(restored);
            setDraft((current) =>
                current === draftBeforeUndo ? restored : current ? { ...current, revision: restored.revision } : current
            );
            setLastSaved(null);
            setShowSaveToast(false);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Previous profile values could not be restored.");
        } finally {
            setSaving(false);
        }
    }

    function onPictureChange(profile: UserProfile) {
        setSaved(profile);
        setDraft((current) =>
            current ? { ...current, profilePicture: profile.profilePicture, revision: profile.revision } : profile
        );
    }

    return (
        <div className="mx-auto w-full max-w-4xl pb-32">
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
                        className="text-12 text-muted-foreground hover:text-foreground pb-2 hover:underline"
                    >
                        view live profile →
                    </Link>
                </div>
                <UnderlineTabs
                    tabs={["PROFILE", "ACCOUNT"]}
                    activeTab={activeTab}
                    onChange={setActiveTab}
                    ariaLabel="Settings sections"
                />
            </header>
            {loading && <p role="status">Loading settings…</p>}
            {error && (
                <div
                    role="alert"
                    className="border-line bg-faint text-12 text-foreground mb-6 rounded-[2px] border px-4 py-3"
                >
                    {error}{" "}
                    {error.startsWith("Sign in") ? (
                        <Link href="/login" className="underline">
                            Sign in
                        </Link>
                    ) : (
                        <button type="button" className="underline" onClick={reload}>
                            Reload
                        </button>
                    )}
                </div>
            )}
            {!loading && draft && saved && (
                <form onSubmit={(event) => void save(event)} className="space-y-8">
                    {activeTab === "PROFILE" && (
                        <div className="space-y-6">
                            <ProfileAvatarEditor profile={draft} onChange={onPictureChange} />
                            <PersonalDetailsForm
                                name={draft.displayName}
                                onChangeName={(value) => change("displayName", value)}
                                handle={`@${draft.username}`}
                                onChangeHandle={(value) => change("username", value.replace(/^@/, ""))}
                                occupation={draft.occupation ?? ""}
                                onChangeOccupation={(value) => change("occupation", value)}
                                location={draft.location ?? ""}
                                onChangeLocation={(value) => change("location", value)}
                                bio={draft.description}
                                onChangeBio={(value) => change("description", value)}
                            />
                            <LanguageEditor
                                languages={draft.languages}
                                onChangeLanguages={(value) => change("languages", value)}
                                choices={languages}
                                maxLanguages={10}
                            />
                            <div className="border-line bg-background rounded-[2px] border p-6">
                                <ProfileTagSelector
                                    selectedTags={draft.interests}
                                    onChange={(tags) => change("interests", tags)}
                                    maxTags={10}
                                />
                            </div>
                        </div>
                    )}
                    {activeTab === "ACCOUNT" && (
                        <div className="space-y-6">
                            <ThemeSelectorCard theme={theme} onThemeChange={changeTheme} />
                            <div className="border-line bg-background rounded-[2px] border p-6">
                                <h2 className="font-display text-16 text-foreground font-bold tracking-tight uppercase">
                                    Default Board Visibility
                                </h2>
                                <p className="text-12 text-muted-foreground mt-0.5 mb-5">
                                    Choose who can view new boards you create by default.
                                </p>
                                <VisibilitySelector
                                    value={draft.defaultBoardVisibility}
                                    onChange={(value) => change("defaultBoardVisibility", value)}
                                    showLabel={false}
                                />
                            </div>
                        </div>
                    )}
                    <SettingsSaveBar
                        isDirty={isDirty}
                        onReset={() => {
                            setDraft(saved);
                            setError("");
                        }}
                        showToast={showSaveToast && !isDirty}
                        onDismissToast={() => setShowSaveToast(false)}
                        onUndo={() => void undo()}
                        canUndo={Boolean(lastSaved)}
                        toastKey={toastKey}
                        saving={saving}
                    />
                </form>
            )}
        </div>
    );
}
