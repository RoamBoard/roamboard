import { Info } from "lucide-react";

import type { ProfileSettingsErrors } from "@/lib/profile-settings";

const inputClassName =
    "border-line bg-background text-14 text-foreground placeholder:text-muted-foreground font-body focus:border-foreground mt-1 w-full rounded-[2px] border px-3 py-2 transition-colors focus-visible:outline-none aria-[invalid=true]:border-feedback-error aria-[invalid=true]:focus:border-feedback-error";
const errorClassName =
    "border-feedback-error-border bg-feedback-error-surface text-feedback-error text-12 mt-2 rounded-[2px] border px-3 py-2";

type Props = {
    name: string;
    onChangeName: (name: string) => void;
    handle: string;
    onChangeHandle: (handle: string) => void;
    occupation: string;
    onChangeOccupation: (occupation: string) => void;
    location: string;
    onChangeLocation: (location: string) => void;
    bio: string;
    onChangeBio: (bio: string) => void;
    errors?: ProfileSettingsErrors;
};

export default function PersonalDetailsForm({
    name,
    onChangeName,
    handle,
    onChangeHandle,
    occupation,
    onChangeOccupation,
    location,
    onChangeLocation,
    bio,
    onChangeBio,
    errors = {}
}: Props) {
    return (
        <div className="border-line bg-background rounded-[2px] border p-6">
            <h2 className="font-display text-16 text-foreground font-bold tracking-tight uppercase">
                Personal Details
            </h2>
            <p className="text-12 text-muted-foreground mt-0.5">
                Public information visible on your social traveler profile.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                    <label
                        htmlFor="name-input"
                        className="text-10 tracking-label text-muted-foreground block font-bold uppercase"
                    >
                        Display Name *
                    </label>
                    <input
                        id="name-input"
                        type="text"
                        required
                        aria-invalid={Boolean(errors.displayName)}
                        aria-describedby={errors.displayName ? "name-input-error" : undefined}
                        maxLength={500}
                        value={name}
                        onChange={(e) => onChangeName(e.target.value)}
                        placeholder="e.g. ROWAN MERCER"
                        className={inputClassName}
                    />
                    {errors.displayName && (
                        <p id="name-input-error" className={errorClassName}>
                            {errors.displayName}
                        </p>
                    )}
                </div>

                <div>
                    <div className="flex items-center justify-between">
                        <label
                            htmlFor="handle-input"
                            className="text-10 tracking-label text-muted-foreground block font-bold uppercase"
                        >
                            Handle / Username *
                        </label>
                        {!errors.username && (
                            <div className="group relative">
                                <span
                                    tabIndex={0}
                                    aria-label="Username format requirements"
                                    className="text-muted-foreground hover:text-foreground focus:text-foreground inline-flex cursor-help items-center transition-colors focus-visible:outline-none"
                                >
                                    <Info size={12} strokeWidth={2} aria-hidden="true" />
                                </span>
                                <p
                                    id="handle-input-hint"
                                    role="tooltip"
                                    className="border-line bg-faint text-foreground text-11 shadow-card pointer-events-none invisible absolute right-0 bottom-full z-10 mb-1.5 w-60 rounded-[2px] border p-2 leading-normal font-normal opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
                                >
                                    Use 1-64 letters a-z, numbers, periods or underscores. Start and end with a letter
                                    or number.
                                </p>
                            </div>
                        )}
                    </div>
                    <input
                        id="handle-input"
                        type="text"
                        required
                        value={handle}
                        aria-invalid={Boolean(errors.username)}
                        aria-describedby={errors.username ? "handle-input-error" : "handle-input-hint"}
                        maxLength={65}
                        onChange={(e) => onChangeHandle(e.target.value)}
                        placeholder="@rowan.mercer"
                        className={inputClassName}
                    />
                    {errors.username && (
                        <p id="handle-input-error" className={errorClassName}>
                            {errors.username}
                        </p>
                    )}
                </div>

                <div>
                    <label
                        htmlFor="occupation-input"
                        className="text-10 tracking-label text-muted-foreground block font-bold uppercase"
                    >
                        Occupation / Profession
                    </label>
                    <input
                        id="occupation-input"
                        type="text"
                        value={occupation}
                        aria-invalid={Boolean(errors.occupation)}
                        aria-describedby={errors.occupation ? "occupation-input-error" : undefined}
                        maxLength={500}
                        onChange={(e) => onChangeOccupation(e.target.value)}
                        placeholder="e.g. Travel Writer & Photographer"
                        className={inputClassName}
                    />
                    {errors.occupation && (
                        <p id="occupation-input-error" className={errorClassName}>
                            {errors.occupation}
                        </p>
                    )}
                </div>

                <div>
                    <label
                        htmlFor="location-input"
                        className="text-10 tracking-label text-muted-foreground block font-bold uppercase"
                    >
                        Based In / Location
                    </label>
                    <input
                        id="location-input"
                        type="text"
                        value={location}
                        aria-invalid={Boolean(errors.location)}
                        aria-describedby={errors.location ? "location-input-error" : undefined}
                        maxLength={500}
                        onChange={(e) => onChangeLocation(e.target.value)}
                        placeholder="e.g. San Francisco, USA"
                        className={inputClassName}
                    />
                    {errors.location && (
                        <p id="location-input-error" className={errorClassName}>
                            {errors.location}
                        </p>
                    )}
                </div>

                <div className="sm:col-span-2">
                    <label
                        htmlFor="bio-input"
                        className="text-10 tracking-label text-muted-foreground block font-bold uppercase"
                    >
                        Biography
                    </label>
                    <textarea
                        id="bio-input"
                        rows={4}
                        maxLength={500}
                        value={bio}
                        aria-invalid={Boolean(errors.description)}
                        aria-describedby={errors.description ? "bio-input-error" : "bio-input-count"}
                        onChange={(e) => onChangeBio(e.target.value)}
                        placeholder="Write about your travel philosophy, memorable adventures, and plans..."
                        className="border-line bg-background text-13 text-foreground placeholder:text-muted-foreground font-body focus:border-foreground aria-[invalid=true]:border-feedback-error aria-[invalid=true]:focus:border-feedback-error mt-1 w-full rounded-[2px] border px-3 py-2.5 leading-relaxed transition-colors focus-visible:outline-none"
                    />
                    {errors.description ? (
                        <p id="bio-input-error" className={errorClassName}>
                            {errors.description}
                        </p>
                    ) : (
                        <span id="bio-input-count" className="text-10 text-muted-foreground mt-1 block text-right">
                            {bio.length}/500 characters
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
