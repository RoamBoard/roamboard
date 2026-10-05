import Image from "next/image";
import type { UserProfile } from "@/types/social";

type Props = {
    profile: UserProfile;
};

export default function ProfileHero({ profile }: Props) {
    return (
        <section
            aria-label="Profile overview"
            className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12"
        >
            {/* Left column: Hero photo + Name */}
            <div className="flex flex-col lg:col-span-5">
                <div className="bg-porcelain relative aspect-[3/4] w-full overflow-hidden">
                    <Image
                        src={profile.avatarUrl}
                        alt={`Portrait of ${profile.name}`}
                        fill
                        priority
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 40vw, 380px"
                        className="object-cover"
                    />
                </div>
                <h2 className="font-display text-48 sm:text-60 text-obsidian mt-2 font-black tracking-tight uppercase select-none">
                    {profile.name}
                </h2>
            </div>

            {/* Right column: Location, Buttons, Headline, Bio, Stats with vertical lines, Platinum Tier */}
            <div className="flex flex-col justify-between lg:col-span-7">
                <div>
                    {/* Top sub-bar: Location & Action buttons */}
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.75"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-obsidian shrink-0"
                                aria-hidden="true"
                            >
                                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                                <circle cx="12" cy="10" r="3" />
                            </svg>
                            <div>
                                <span className="text-10 text-graphite block leading-none font-medium">
                                    based in
                                </span>
                                <span className="text-14 text-obsidian block leading-tight font-bold">
                                    {profile.location}
                                </span>
                            </div>
                        </div>

                        {/* Top right buttons: [ edit profile ] and [ ... ] */}
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                className="border-line text-12 text-graphite hover:text-obsidian hover:border-obsidian font-body cursor-pointer rounded-[2px] border px-3.5 py-1 font-medium transition-colors"
                            >
                                edit profile
                            </button>
                            <button
                                type="button"
                                aria-label="More options"
                                className="border-line text-12 text-graphite hover:text-obsidian hover:border-obsidian font-body flex cursor-pointer items-center justify-center rounded-[2px] border px-2.5 py-1 font-medium transition-colors"
                            >
                                •••
                            </button>
                        </div>
                    </div>

                    {/* Headline & Bio */}
                    <div className="mt-8">
                        <h3 className="font-display text-30 sm:text-36 text-obsidian leading-tight font-bold">
                            Chasing places,
                            <br />
                            collecting stories.
                        </h3>
                        <p className="text-13 text-graphite mt-3 max-w-xl leading-relaxed">
                            {profile.bio}{" "}
                            <span
                                className="text-obsidian animate-pulse font-normal"
                                aria-hidden="true"
                            >
                                |
                            </span>
                        </p>
                    </div>

                    {/* Stats metrics row with vertical separator lines */}
                    <div className="border-line mt-8 border-t border-b py-6">
                        <div className="divide-line grid grid-cols-2 divide-x sm:grid-cols-5">
                            {/* Stat 1: countries visited */}
                            <div className="pr-3">
                                <div className="font-display text-24 sm:text-30 text-obsidian flex items-center gap-1.5 font-bold">
                                    {profile.stats.countriesVisited}
                                    <span
                                        className="text-14 text-graphite font-normal"
                                        aria-hidden="true"
                                    >
                                        →
                                    </span>
                                </div>
                                <div className="text-10 text-graphite mt-1 leading-tight font-medium">
                                    countries
                                    <br />
                                    visited
                                </div>
                            </div>

                            {/* Stat 2: boards created */}
                            <div className="px-3">
                                <div className="font-display text-24 sm:text-30 text-obsidian flex items-center gap-1.5 font-bold">
                                    {profile.stats.boardsCreated}
                                    <span
                                        className="text-14 text-graphite font-normal"
                                        aria-hidden="true"
                                    >
                                        →
                                    </span>
                                </div>
                                <div className="text-10 text-graphite mt-1 leading-tight font-medium">
                                    boards
                                    <br />
                                    created
                                </div>
                            </div>

                            {/* Stat 3: friend made */}
                            <div className="px-3">
                                <div className="font-display text-24 sm:text-30 text-obsidian flex items-center gap-1.5 font-bold">
                                    {profile.stats.friendsMade}
                                    <span
                                        className="text-14 text-graphite font-normal"
                                        aria-hidden="true"
                                    >
                                        →
                                    </span>
                                </div>
                                <div className="text-10 text-graphite mt-1 leading-tight font-medium">
                                    friend
                                    <br />
                                    made
                                </div>
                            </div>

                            {/* Stat 4: places saved */}
                            <div className="px-3">
                                <div className="font-display text-24 sm:text-30 text-obsidian flex items-center gap-1.5 font-bold">
                                    {profile.stats.placesSaved}
                                    <span
                                        className="text-14 text-graphite font-normal"
                                        aria-hidden="true"
                                    >
                                        →
                                    </span>
                                </div>
                                <div className="text-10 text-graphite mt-1 leading-tight font-medium">
                                    places
                                    <br />
                                    saved
                                </div>
                            </div>

                            {/* Stat 5: boards saved */}
                            <div className="pl-3">
                                <div className="font-display text-24 sm:text-30 text-obsidian flex items-center gap-1.5 font-bold">
                                    {profile.stats.boardsSaved}
                                    <span
                                        className="text-14 text-graphite font-normal"
                                        aria-hidden="true"
                                    >
                                        →
                                    </span>
                                </div>
                                <div className="text-10 text-graphite mt-1 leading-tight font-medium">
                                    boards
                                    <br />
                                    saved
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Platinum Traveler tier with diffused 3D metallic shadow */}
                <div className="mt-8 pt-2">
                    <div className="font-display text-36 sm:text-52 from-stone via-porcelain to-slate bg-gradient-to-r bg-clip-text font-black tracking-wider text-transparent uppercase drop-shadow-[0_8px_16px_rgba(0,0,0,0.18)] select-none">
                        {profile.tier}
                    </div>
                </div>
            </div>
        </section>
    );
}
