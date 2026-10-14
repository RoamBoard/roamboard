import Image from "next/image";

export const AVATAR_PRESETS = [
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

type Props = {
    avatarUrl: string;
    onChangeAvatarUrl: (url: string) => void;
};

export default function ProfileAvatarEditor({
    avatarUrl,
    onChangeAvatarUrl
}: Props) {
    return (
        <div className="border-line bg-background rounded-[2px] border p-6">
            <h2 className="font-display text-16 text-foreground font-bold uppercase tracking-tight">
                Profile Picture
            </h2>
            <p className="text-12 text-muted-foreground mt-0.5">
                Set your profile portrait displayed across your
                boards and traveler cards.
            </p>

            <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-center">
                {/* Current Photo Thumbnail */}
                <div className="bg-faint border-line relative aspect-[3/4] h-28 shrink-0 overflow-hidden rounded-[2px] border shadow-xs">
                    {avatarUrl ? (
                        <Image
                            src={avatarUrl}
                            alt="Current profile preview"
                            fill
                            sizes="120px"
                            className="object-cover"
                        />
                    ) : (
                        <div className="text-10 text-muted-foreground flex h-full w-full items-center justify-center">
                            No photo
                        </div>
                    )}
                </div>

                <div className="flex-1 space-y-3">
                    <div>
                        <label
                            htmlFor="avatar-url-input"
                            className="text-10 tracking-label text-muted-foreground block font-bold uppercase"
                        >
                            Image URL
                        </label>
                        <input
                            id="avatar-url-input"
                            type="url"
                            value={avatarUrl}
                            onChange={(e) => onChangeAvatarUrl(e.target.value)}
                            placeholder="https://images.unsplash.com/..."
                            className="border-line bg-background text-12 text-foreground placeholder:text-muted-foreground font-body focus:border-foreground mt-1 w-full rounded-[2px] border px-3 py-2 transition-colors focus-visible:outline-none"
                        />
                    </div>

                    {/* Quick Preset Selector */}
                    <div>
                        <span className="text-10 tracking-label text-muted-foreground block font-bold uppercase">
                            Or choose a preset
                        </span>
                        <div className="mt-1.5 flex flex-wrap gap-2">
                            {AVATAR_PRESETS.map((preset) => (
                                <button
                                    key={preset.label}
                                    type="button"
                                    onClick={() =>
                                        onChangeAvatarUrl(preset.url)
                                    }
                                    className={`border-line text-10 text-muted-foreground hover:text-foreground hover:border-foreground cursor-pointer rounded-[2px] border px-2.5 py-1 font-medium transition-colors ${
                                        avatarUrl === preset.url
                                            ? "bg-faint border-foreground text-foreground"
                                            : "bg-background"
                                    }`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Photo Upload Notice */}
                    <div className="border-line bg-faint/40 rounded-[2px] border border-dashed p-3">
                        <div className="flex items-center gap-1.5">
                            <span className="bg-foreground h-1.5 w-1.5 shrink-0 rounded-full" />
                            <span className="text-10 tracking-label text-foreground font-bold uppercase">
                                Photo Upload Notice
                            </span>
                        </div>
                        <p className="text-11 text-muted-foreground mt-1 leading-normal font-medium">
                            Upload should be implemented later when the backend framework is created. Currently using image URL and presets.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

