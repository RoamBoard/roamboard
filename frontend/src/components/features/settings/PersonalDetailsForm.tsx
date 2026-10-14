type Props = {
    name: string;
    onChangeName: (name: string) => void;
    handle: string;
    onChangeHandle: (handle: string) => void;
    occupation: string;
    onChangeOccupation: (occupation: string) => void;
    location: string;
    onChangeLocation: (location: string) => void;
    headline: string;
    onChangeHeadline: (headline: string) => void;
    bio: string;
    onChangeBio: (bio: string) => void;
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
    headline,
    onChangeHeadline,
    bio,
    onChangeBio
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
                        value={name}
                        onChange={(e) => onChangeName(e.target.value)}
                        placeholder="e.g. ROWAN MERCER"
                        className="border-line bg-background text-14 text-foreground placeholder:text-muted-foreground font-body focus:border-foreground mt-1 w-full rounded-[2px] border px-3 py-2 transition-colors focus-visible:outline-none"
                    />
                </div>

                <div>
                    <label
                        htmlFor="handle-input"
                        className="text-10 tracking-label text-muted-foreground block font-bold uppercase"
                    >
                        Handle / Username
                    </label>
                    <input
                        id="handle-input"
                        type="text"
                        value={handle}
                        onChange={(e) => onChangeHandle(e.target.value)}
                        placeholder="@rowan.mercer"
                        className="border-line bg-background text-14 text-foreground placeholder:text-muted-foreground font-body focus:border-foreground mt-1 w-full rounded-[2px] border px-3 py-2 transition-colors focus-visible:outline-none"
                    />
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
                        onChange={(e) => onChangeOccupation(e.target.value)}
                        placeholder="e.g. Travel Writer & Photographer"
                        className="border-line bg-background text-14 text-foreground placeholder:text-muted-foreground font-body focus:border-foreground mt-1 w-full rounded-[2px] border px-3 py-2 transition-colors focus-visible:outline-none"
                    />
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
                        onChange={(e) => onChangeLocation(e.target.value)}
                        placeholder="e.g. San Francisco, USA"
                        className="border-line bg-background text-14 text-foreground placeholder:text-muted-foreground font-body focus:border-foreground mt-1 w-full rounded-[2px] border px-3 py-2 transition-colors focus-visible:outline-none"
                    />
                </div>

                <div className="sm:col-span-2">
                    <label
                        htmlFor="headline-input"
                        className="text-10 tracking-label text-muted-foreground block font-bold uppercase"
                    >
                        Profile Headline
                    </label>
                    <input
                        id="headline-input"
                        type="text"
                        value={headline}
                        onChange={(e) => onChangeHeadline(e.target.value)}
                        placeholder="e.g. Chasing places, collecting stories."
                        className="border-line bg-background text-14 text-foreground placeholder:text-muted-foreground font-body focus:border-foreground mt-1 w-full rounded-[2px] border px-3 py-2 transition-colors focus-visible:outline-none"
                    />
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
                        value={bio}
                        onChange={(e) => onChangeBio(e.target.value)}
                        placeholder="Write about your travel philosophy, memorable adventures, and plans..."
                        className="border-line bg-background text-13 text-foreground placeholder:text-muted-foreground font-body focus:border-foreground mt-1 w-full rounded-[2px] border px-3 py-2.5 leading-relaxed transition-colors focus-visible:outline-none"
                    />
                    <span className="text-10 text-muted-foreground mt-1 block text-right">
                        {bio.length} characters
                    </span>
                </div>
            </div>
        </div>
    );
}
