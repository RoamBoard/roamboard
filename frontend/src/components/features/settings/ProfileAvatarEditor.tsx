"use client";

import PhotoEditorDialog from "@/components/images/PhotoEditorDialog";
import { usePhotoUrls } from "@/lib/use-photo-urls";
import { useState } from "react";
import Image from "next/image";
import { uploadBoardImage } from "@/lib/board-creator-api";
import { deleteProfilePicture, setProfilePicture, type UserProfile } from "@/lib/profile";

type Props = {
    profile: UserProfile;
    onChange: (profile: UserProfile) => void;
    disabled: boolean;
    onBeginChange: () => boolean;
    onEndChange: () => void;
};

export default function ProfileAvatarEditor({ profile, onChange, disabled, onBeginChange, onEndChange }: Props) {
    const photoUrl = usePhotoUrls();
    const [editingPhoto, setEditingPhoto] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function upload(file: File) {
        if (busy || disabled || !onBeginChange()) return;
        setBusy(true);
        setError("");
        try {
            const image = await uploadBoardImage(file);
            onChange(await setProfilePicture(image.imageId));
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "The photo could not be uploaded.");
        } finally {
            setBusy(false);
            onEndChange();
        }
    }

    async function remove() {
        if (busy || disabled || !onBeginChange()) return;
        setBusy(true);
        setError("");
        try {
            onChange(await deleteProfilePicture());
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "The photo could not be removed.");
        } finally {
            setBusy(false);
            onEndChange();
        }
    }

    return (
        <>
            {editingPhoto && profile.profilePicture ? (
                <PhotoEditorDialog imageId={profile.profilePicture.imageId} onClose={() => setEditingPhoto(false)} />
            ) : null}
            <div className="border-line bg-background rounded-[2px] border p-6">
                <h2 className="font-display text-16 text-foreground font-bold tracking-tight uppercase">
                    Profile Picture
                </h2>
                <p className="text-12 text-muted-foreground mt-0.5">
                    Set your profile portrait displayed across your boards and traveler cards.
                </p>
                <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-center">
                    <div className="bg-faint border-line relative aspect-square h-28 shrink-0 overflow-hidden rounded-[2px] border shadow-xs">
                        {profile.profilePicture ? (
                            <Image
                                src={photoUrl(profile.profilePicture.url)}
                                alt="Current profile photo"
                                fill
                                unoptimized
                                sizes="120px"
                                className="object-cover"
                            />
                        ) : (
                            <div className="text-10 text-muted-foreground flex h-full items-center justify-center text-center">
                                No photo
                            </div>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <label className="border-line text-12 text-foreground cursor-pointer rounded-[2px] border px-3 py-2">
                            Upload photo
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                                disabled={busy || disabled}
                                className="sr-only"
                                onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (file) void upload(file);
                                    event.target.value = "";
                                }}
                            />
                        </label>
                        {profile.profilePicture ? (
                            <button
                                type="button"
                                disabled={busy || disabled}
                                className="border-line rounded-[2px] border px-3 py-2 text-xs"
                                onClick={() => setEditingPhoto(true)}
                            >
                                Crop / resize
                            </button>
                        ) : null}
                        {profile.profilePicture && (
                            <button
                                type="button"
                                disabled={busy || disabled}
                                onClick={() => void remove()}
                                className="border-line text-12 text-foreground rounded-[2px] border px-3 py-2"
                            >
                                Remove photo
                            </button>
                        )}
                        {busy && (
                            <span role="status" className="text-12 text-muted-foreground">
                                Updating photo…
                            </span>
                        )}
                    </div>
                </div>
                {error && (
                    <p role="alert" className="text-12 text-foreground mt-3">
                        {error}
                    </p>
                )}
            </div>
        </>
    );
}
