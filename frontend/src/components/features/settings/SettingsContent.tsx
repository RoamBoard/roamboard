"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { listBoardTags } from "@/lib/board-creator-api";
import { loadLanguages, loadProfile, ProfileApiError, updateProfile, type UserProfile } from "@/lib/profile";
import {
    profileSaveError,
    validateProfileSettings,
    type ProfileSaveError,
    type ProfileSettingsField
} from "@/lib/profile-settings";
import VisibilitySelector from "@/components/features/boards/VisibilitySelector";
import ProfileTagSelector from "@/components/features/profile/ProfileTagSelector";
import UnderlineTabs from "@/components/ui/UnderlineTabs";
import ProfileAvatarEditor from "./ProfileAvatarEditor";
import PersonalDetailsForm from "./PersonalDetailsForm";
import LanguageEditor from "./LanguageEditor";
import ThemeSelectorCard from "./ThemeSelectorCard";
import SettingsSaveBar from "./SettingsSaveBar";

type Tab = "PROFILE" | "ACCOUNT";

const fieldTargets: Record<ProfileSettingsField, string> = {
    displayName: "name-input",
    username: "handle-input",
    description: "bio-input",
    occupation: "occupation-input",
    location: "location-input",
    languages: "languages-input",
    interests: "interests-input",
    defaultBoardVisibility: "default-visibility-input"
};

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

function latestProfile(current: UserProfile | null, received: UserProfile) {
    return current && current.revision > received.revision ? current : received;
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
    const [saveError, setSaveError] = useState<ProfileSaveError | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const writeInProgress = useRef(false);
    const mounted = useRef(false);
    const [error, setError] = useState("");
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

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
                            : "Settings couldn't be loaded. Check your connection and reload to try again."
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
        if (writeInProgress.current) return;
        setLoading(true);
        setError("");
        setSaveError(null);
        setShowSaveToast(false);
        setLastSaved(null);
        setSaved(null);
        setDraft(null);
        setRetry((value) => value + 1);
    }

    const isDirty = Boolean(saved && draft && JSON.stringify(editable(saved)) !== JSON.stringify(editable(draft)));
    function change(field: ProfileSettingsField, value: string | string[] | null) {
        if (writeInProgress.current || !draft) return;
        setShowSaveToast(false);
        setDraft((current) => (current ? { ...current, [field]: value } : current));
        if (saveError?.fields?.[field]) {
            const remaining = { ...saveError.fields };
            const issue = validateProfileSettings({ ...draft, [field]: value }, languages, allowedTags)[field];
            if (issue) remaining[field] = issue;
            else delete remaining[field];
            setSaveError(Object.keys(remaining).length ? { ...saveError, fields: remaining } : null);
        }
    }

    function focusField(field: ProfileSettingsField) {
        setActiveTab(field === "defaultBoardVisibility" ? "ACCOUNT" : "PROFILE");
        requestAnimationFrame(() => {
            const input = document.getElementById(fieldTargets[field]);
            input?.focus({ preventScroll: true });
            input?.closest("div")?.scrollIntoView({ block: "start" });
        });
    }

    function changeTheme(value: "light" | "dark") {
        setTheme(value);
        document.documentElement.classList.toggle("dark", value === "dark");
        localStorage.setItem("roamboard-theme", value);
    }

    function beginWrite() {
        if (writeInProgress.current) return false;
        writeInProgress.current = true;
        setSaving(true);
        return true;
    }

    function endWrite() {
        writeInProgress.current = false;
        if (mounted.current) setSaving(false);
    }

    async function save(event?: FormEvent) {
        event?.preventDefault();
        if (!draft || !saved || writeInProgress.current || !isDirty) return;
        const username = draft.username.trim().toLowerCase();
        const fields = validateProfileSettings(draft, languages, allowedTags);
        if (Object.keys(fields).length) {
            setSaveError({ message: "Fix the details below, then save again.", fields });
            return;
        }
        if (!beginWrite()) return;
        setSaveError(null);
        setShowSaveToast(false);
        try {
            const previous = saved;
            const next = await updateProfile({
                ...editable(draft),
                revision: saved.revision,
                username,
                location: draft.location?.trim() || null,
                occupation: draft.occupation?.trim() || null,
                interests: draft.interests
            });
            if (!mounted.current) return;
            setLastSaved(previous);
            setSaved((current) => latestProfile(current, next));
            setDraft((current) => {
                if (!current || current.revision > next.revision) return current;
                return current === draft ? next : { ...current, revision: next.revision };
            });
            setToastKey((value) => value + 1);
            setShowSaveToast(true);
        } catch (caught) {
            if (mounted.current) setSaveError(profileSaveError(caught));
        } finally {
            endWrite();
        }
    }

    async function undo() {
        if (!lastSaved || !saved || !beginWrite()) return;
        const profileToRestore = lastSaved;
        const draftBeforeUndo = draft;
        setSaveError(null);
        try {
            const restored = await updateProfile({
                ...editable(profileToRestore),
                revision: saved.revision,
                username: profileToRestore.username,
                location: profileToRestore.location?.trim() || null,
                occupation: profileToRestore.occupation?.trim() || null,
                interests: profileToRestore.interests
            });
            if (!mounted.current) return;
            setSaved((current) => latestProfile(current, restored));
            setDraft((current) => {
                if (!current || current.revision > restored.revision) return current;
                return current === draftBeforeUndo ? restored : { ...current, revision: restored.revision };
            });
            setLastSaved(null);
            setShowSaveToast(false);
        } catch (caught) {
            if (mounted.current) setSaveError(profileSaveError(caught));
        } finally {
            endWrite();
        }
    }

    function handleDismissToast() {
        setShowSaveToast(false);
        setLastSaved(null);
    }

    function onPictureChange(profile: UserProfile) {
        setSaved((current) => latestProfile(current, profile));
        setDraft((current) =>
            current && current.revision > profile.revision
                ? current
                : current
                  ? { ...current, profilePicture: profile.profilePicture, revision: profile.revision }
                  : profile
        );
    }

    return (
        <div className={`mx-auto w-full max-w-4xl ${saveError ? "pb-[30rem]" : "pb-32"}`}>
            <header className="mb-8">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="font-display text-48 sm:text-60 text-foreground font-bold tracking-tight uppercase">
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
                <form noValidate onSubmit={(event) => void save(event)} className="space-y-8" aria-busy={saving}>
                    <fieldset disabled={saving} className="min-w-0 space-y-8">
                        {activeTab === "PROFILE" && (
                            <div className="space-y-6">
                                <ProfileAvatarEditor
                                    profile={draft}
                                    onChange={onPictureChange}
                                    disabled={saving}
                                    onBeginChange={beginWrite}
                                    onEndChange={endWrite}
                                />
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
                                    errors={saveError?.fields}
                                />
                                <div
                                    id="languages-input"
                                    tabIndex={-1}
                                    role="group"
                                    aria-label="Languages"
                                    aria-describedby={
                                        saveError?.fields?.languages ? "languages-input-error" : undefined
                                    }
                                >
                                    <LanguageEditor
                                        languages={draft.languages}
                                        onChangeLanguages={(value) => change("languages", value)}
                                        choices={languages}
                                        maxLanguages={10}
                                    />
                                    {saveError?.fields?.languages && (
                                        <p id="languages-input-error" className="text-feedback-error text-12 mt-2">
                                            {saveError.fields.languages}
                                        </p>
                                    )}
                                </div>
                                <div
                                    id="interests-input"
                                    tabIndex={-1}
                                    role="group"
                                    aria-label="Tags"
                                    aria-describedby={
                                        saveError?.fields?.interests ? "interests-input-error" : undefined
                                    }
                                    className="border-line bg-background rounded-[2px] border p-6"
                                >
                                    <ProfileTagSelector
                                        selectedTags={draft.interests}
                                        onChange={(tags) => change("interests", tags)}
                                        maxTags={10}
                                    />
                                    {saveError?.fields?.interests && (
                                        <p id="interests-input-error" className="text-feedback-error text-12 mt-2">
                                            {saveError.fields.interests}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                        {activeTab === "ACCOUNT" && (
                            <div className="space-y-6">
                                <ThemeSelectorCard theme={theme} onThemeChange={changeTheme} />
                                <div
                                    id="default-visibility-input"
                                    tabIndex={-1}
                                    role="group"
                                    aria-label="Default Board visibility"
                                    aria-describedby={
                                        saveError?.fields?.defaultBoardVisibility
                                            ? "default-visibility-input-error"
                                            : undefined
                                    }
                                    className="border-line bg-background rounded-[2px] border p-6"
                                >
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
                                    {saveError?.fields?.defaultBoardVisibility && (
                                        <p
                                            id="default-visibility-input-error"
                                            className="text-feedback-error text-12 mt-2"
                                        >
                                            {saveError.fields.defaultBoardVisibility}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </fieldset>
                    <SettingsSaveBar
                        isDirty={isDirty}
                        onReset={() => {
                            if (writeInProgress.current) return;
                            setDraft(saved);
                            setSaveError(null);
                            setShowSaveToast(false);
                            setLastSaved(null);
                        }}
                        saving={saving}
                        error={saveError}
                        onFocusField={focusField}
                        onReload={reload}
                        showToast={showSaveToast && !isDirty}
                        onDismissToast={handleDismissToast}
                        onUndo={() => void undo()}
                        canUndo={Boolean(lastSaved) && !saving}
                        toastKey={toastKey}
                    />
                </form>
            )}
        </div>
    );
}
