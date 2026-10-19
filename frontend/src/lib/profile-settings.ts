import { ProfileApiError, type UserProfile } from "@/lib/profile";

export type ProfileSettingsField =
    | "username"
    | "displayName"
    | "description"
    | "location"
    | "occupation"
    | "languages"
    | "interests"
    | "defaultBoardVisibility";

export type ProfileSettingsErrors = Partial<Record<ProfileSettingsField, string>>;

export type ProfileSaveError = {
    message: string;
    fields?: ProfileSettingsErrors;
    action?: "sign-in" | "reload";
};

export function validateProfileSettings(profile: UserProfile, languageChoices: string[], tagChoices: string[]) {
    const errors: ProfileSettingsErrors = {};
    const username = profile.username.trim().toLowerCase();
    if (!username) errors.username = "Enter a username before saving.";
    else if (username.length > 64) errors.username = "Shorten your username to 64 characters or fewer.";
    else if (!/^(?:[a-z0-9]|[a-z0-9][a-z0-9._]*[a-z0-9])$/.test(username))
        errors.username =
            "Use letters a-z, numbers, periods or underscores. Start and end your username with a letter or number.";

    if (!profile.displayName.trim()) errors.displayName = "Enter a display name before saving.";
    else if (profile.displayName.trim().length > 500)
        errors.displayName = "Shorten your display name to 500 characters or fewer.";
    if (profile.description.trim().length > 500)
        errors.description = "Shorten your biography to 500 characters or fewer.";
    if ((profile.location?.trim().length ?? 0) > 500)
        errors.location = "Shorten your location to 500 characters or fewer.";
    if ((profile.occupation?.trim().length ?? 0) > 500)
        errors.occupation = "Shorten your occupation to 500 characters or fewer.";

    if (
        profile.languages.length > 10 ||
        new Set(profile.languages).size !== profile.languages.length ||
        profile.languages.some((language) => !languageChoices.includes(language))
    )
        errors.languages =
            "Choose up to 10 different languages from the list. Remove unsupported or repeated languages.";
    if (
        profile.interests.length > 10 ||
        new Set(profile.interests).size !== profile.interests.length ||
        profile.interests.some((tag) => !tagChoices.includes(tag))
    )
        errors.interests = "Choose up to 10 different tags from the list. Remove unsupported or repeated tags.";
    if (!["collaborators", "friends", "public"].includes(profile.defaultBoardVisibility))
        errors.defaultBoardVisibility = "Choose Private, Friends or Public for your default Board visibility.";

    return errors;
}

export function profileSaveError(caught: unknown): ProfileSaveError {
    if (caught instanceof ProfileApiError) {
        if (caught.code === "USERNAME_TAKEN")
            return {
                message: "Your profile wasn't saved. Choose another username.",
                fields: { username: "That username is already taken. Enter a different username and save again." }
            };
        if (caught.status === 401)
            return {
                message: "Your session has expired. Sign in again in a new tab, then return here to save your edits.",
                action: "sign-in"
            };
        if (caught.status === 403)
            return {
                message: "Your account couldn't save this change. Sign in again in a new tab, then try saving again.",
                action: "sign-in"
            };
        if (caught.code === "STALE_PROFILE" || caught.status === 409)
            return {
                message:
                    "Your profile changed elsewhere. Reload the latest profile before saving again. Reloading replaces your unsaved edits.",
                action: "reload"
            };
        if (caught.status === 404)
            return {
                message:
                    "Your profile couldn't be found. Reload settings to try again. Reloading replaces your unsaved edits.",
                action: "reload"
            };
        if (caught.status === 429)
            return {
                message: "Too many save attempts. Wait a moment, then try saving again. Your edits are still here."
            };
        if (caught.status === 400)
            return {
                message: [
                    "Choose languages from the list",
                    "Choose interests from the tag list",
                    "Choose distinct interests"
                ].includes(caught.message)
                    ? `${caught.message}. Update your selections and save again. Your edits are still here.`
                    : "Some profile details weren't accepted. Check your details and selected languages and tags, then save again. Your edits are still here."
            };
        if (caught.status >= 500)
            return {
                message: "Roamboard couldn't save your profile. Your edits are still here. Try saving again shortly."
            };
    }
    return {
        message:
            "Your profile couldn't be saved. Your edits are still here. Check your connection and try saving again."
    };
}
