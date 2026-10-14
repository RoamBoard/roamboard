import Image from "next/image";
import Link from "next/link";
import type { UserProfile } from "@/types/social";
import { getBoardTag, boardTagHref } from "@/data/board-tags";
import TagIcon from "@/components/ui/TagIcon";
import { getTierGradientStyle } from "@/utils/tier";

type Props = {
    profile: UserProfile;
};

function getNameStyle(nameStr: string): string {
    const len = nameStr.trim().length;
    if (len > 24) {
        return "text-28 sm:text-34 leading-[0.92] -mt-5 sm:-mt-7";
    }
    if (len > 16) {
        return "text-32 sm:text-40 leading-[0.9] -mt-6 sm:-mt-8";
    }
    if (len > 10) {
        return "text-38 sm:text-48 leading-[0.88] -mt-7 sm:-mt-10";
    }
    return "text-48 sm:text-60 leading-[0.85] -mt-8 sm:-mt-12";
}

export default function ProfileHero({ profile }: Props) {
    return (
        <section
            aria-label="Profile overview"
            className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12"
        >
            {/* Left column: Hero photo + Name */}
            <div className="flex flex-col lg:col-span-5">
                <div className="bg-faint border-line relative aspect-[3/4] w-full overflow-hidden rounded-[2px] border">
                    <Image
                        src={profile.avatarUrl}
                        alt={`Portrait of ${profile.name}`}
                        fill
                        priority
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 40vw, 380px"
                        className="object-cover"
                    />

                    {/* Subtle bottom fade to guarantee readable contrast when display name overlaps */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 sm:h-28 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />

                    {/* Notice in the box: photo upload implementation pending backend */}
                    <div className="border-line bg-background/95 shadow-xs absolute top-3 right-3 left-3 rounded-[2px] border p-2.5 backdrop-blur-xs">
                        <div className="flex items-center gap-1.5">
                            <span className="bg-foreground h-1.5 w-1.5 shrink-0 rounded-full" />
                            <span className="text-10 tracking-label text-foreground block font-bold uppercase">
                                Photo Upload Note
                            </span>
                        </div>
                        <p className="text-10 text-muted-foreground mt-1 leading-normal font-medium">
                            Upload should be implemented later when the backend framework is created.
                        </p>
                    </div>
                </div>

                {/* Display Name slightly overlapping the picture with responsive font sizing */}
                <h2
                    className={`font-display text-foreground relative z-10 px-1 font-black tracking-tight uppercase select-none break-words ${getNameStyle(
                        profile.name
                    )}`}
                >
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
                                className="text-foreground shrink-0"
                                aria-hidden="true"
                            >
                                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                                <circle cx="12" cy="10" r="3" />
                            </svg>
                            <div>
                                <span className="text-10 text-muted-foreground block leading-none font-medium">
                                    based in
                                </span>
                                <span className="text-14 text-foreground block leading-tight font-bold">
                                    {profile.location}
                                </span>
                            </div>
                        </div>

                        {/* Top right button: [ edit profile ] */}
                        <div className="flex items-center gap-2">
                            <Link
                                href="/settings"
                                className="border-line text-12 text-muted-foreground hover:text-foreground hover:border-foreground font-body cursor-pointer rounded-[2px] border px-3.5 py-1 font-medium transition-colors"
                            >
                                edit profile
                            </Link>
                        </div>
                    </div>

                    {/* Headline & Bio */}
                    <div className="mt-8">
                        <h3 className="font-display text-30 sm:text-36 text-foreground leading-tight font-bold">
                            {profile.headline || "Chasing places, collecting stories."}
                        </h3>
                        <p className="text-13 text-muted-foreground mt-3 max-w-xl leading-relaxed">
                            {profile.bio}{" "}
                            <span
                                className="text-muted-foreground/30 animate-pulse font-normal select-none pointer-events-none"
                                aria-hidden="true"
                            >
                                |
                            </span>
                        </p>

                        {/* Bio Meta: Occupation, Languages & Tags */}
                        {Boolean(
                            (profile.occupation || profile.details?.occupation) ||
                            (profile.details?.languages && profile.details.languages.length > 0) ||
                            ((profile.details?.tags ?? profile.details?.interests) &&
                                (profile.details?.tags ?? profile.details?.interests)!.length > 0)
                        ) && (
                            <div className="border-line/60 mt-5 space-y-3 border-t pt-4">
                                {(Boolean(profile.occupation || profile.details?.occupation) ||
                                    Boolean(profile.details?.languages && profile.details.languages.length > 0)) && (
                                    <div className="text-12 text-muted-foreground font-body flex flex-wrap items-center gap-x-6 gap-y-2">
                                        {(profile.occupation || profile.details?.occupation) && (
                                            <div className="text-foreground flex items-center gap-1.5 font-medium">
                                                <svg
                                                    width="14"
                                                    height="14"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="1.75"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    className="text-muted-foreground shrink-0"
                                                    aria-hidden="true"
                                                >
                                                    <rect width="20" height="14" x="2" y="7" rx="2" />
                                                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                                                </svg>
                                                <span>{profile.occupation || profile.details?.occupation}</span>
                                            </div>
                                        )}

                                        {profile.details?.languages && profile.details.languages.length > 0 && (
                                            <div className="text-foreground flex items-center gap-1.5 font-medium">
                                                <svg
                                                    width="14"
                                                    height="14"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="1.75"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    className="text-muted-foreground shrink-0"
                                                    aria-hidden="true"
                                                >
                                                    <circle cx="12" cy="12" r="10" />
                                                    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                                                    <path d="M2 12h20" />
                                                </svg>
                                                <span>Speaks {profile.details.languages.join(", ")}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {Boolean(
                                    (profile.details?.tags ?? profile.details?.interests)?.length
                                ) && (
                                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                        <div className="text-foreground flex items-center gap-1.5 font-medium shrink-0 mr-1">
                                            <svg
                                                width="14"
                                                height="14"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="1.75"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                className="text-muted-foreground shrink-0"
                                                aria-hidden="true"
                                            >
                                                <circle cx="12" cy="12" r="10" />
                                                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                                            </svg>
                                            <span className="text-muted-foreground font-normal text-12">Tags:</span>
                                        </div>
                                        {(profile.details?.tags ?? profile.details?.interests)!
                                            .map((id) => getBoardTag(id))
                                            .filter((t): t is NonNullable<typeof t> => Boolean(t))
                                            .map((tag) => (
                                                <Link
                                                    key={tag.id}
                                                    href={boardTagHref(tag.id)}
                                                    title={`Explore ${tag.name} tag: ${tag.description}`}
                                                    className="group border-line/60 bg-transparent hover:bg-faint/60 hover:border-foreground/70 text-11 text-muted-foreground hover:text-foreground font-body flex items-center gap-1.5 rounded-[2px] border px-2 py-0.5 font-medium transition-colors cursor-pointer"
                                                >
                                                    <TagIcon
                                                        tag={tag}
                                                        size={11}
                                                        className="text-muted-foreground/60 group-hover:text-foreground transition-colors shrink-0"
                                                    />
                                                    <span>{tag.name}</span>
                                                </Link>
                                            ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Stats metrics row with vertical separator lines */}
                    <div className="border-line mt-8 border-t border-b py-6">
                        <div className="divide-line grid grid-cols-2 divide-x sm:grid-cols-5">
                            {/* Stat 1: countries visited */}
                            <div className="pr-3">
                                <div className="font-display text-24 sm:text-30 text-foreground flex items-center gap-1.5 font-bold">
                                    {profile.stats.countriesVisited}
                                    <span
                                        className="text-14 text-muted-foreground font-normal"
                                        aria-hidden="true"
                                    >
                                        →
                                    </span>
                                </div>
                                <div className="text-10 text-muted-foreground mt-1 leading-tight font-medium">
                                    countries
                                    <br />
                                    visited
                                </div>
                            </div>

                            {/* Stat 2: boards created */}
                            <div className="px-3">
                                <div className="font-display text-24 sm:text-30 text-foreground flex items-center gap-1.5 font-bold">
                                    {profile.stats.boardsCreated}
                                    <span
                                        className="text-14 text-muted-foreground font-normal"
                                        aria-hidden="true"
                                    >
                                        →
                                    </span>
                                </div>
                                <div className="text-10 text-muted-foreground mt-1 leading-tight font-medium">
                                    boards
                                    <br />
                                    created
                                </div>
                            </div>

                            {/* Stat 3: friend made */}
                            <div className="px-3">
                                <div className="font-display text-24 sm:text-30 text-foreground flex items-center gap-1.5 font-bold">
                                    {profile.stats.friendsMade}
                                    <span
                                        className="text-14 text-muted-foreground font-normal"
                                        aria-hidden="true"
                                    >
                                        →
                                    </span>
                                </div>
                                <div className="text-10 text-muted-foreground mt-1 leading-tight font-medium">
                                    friend
                                    <br />
                                    made
                                </div>
                            </div>

                            {/* Stat 4: places saved */}
                            <div className="px-3">
                                <div className="font-display text-24 sm:text-30 text-foreground flex items-center gap-1.5 font-bold">
                                    {profile.stats.placesSaved}
                                    <span
                                        className="text-14 text-muted-foreground font-normal"
                                        aria-hidden="true"
                                    >
                                        →
                                    </span>
                                </div>
                                <div className="text-10 text-muted-foreground mt-1 leading-tight font-medium">
                                    places
                                    <br />
                                    saved
                                </div>
                            </div>

                            {/* Stat 5: boards saved */}
                            <div className="pl-3">
                                <div className="font-display text-24 sm:text-30 text-foreground flex items-center gap-1.5 font-bold">
                                    {profile.stats.boardsSaved}
                                    <span
                                        className="text-14 text-muted-foreground font-normal"
                                        aria-hidden="true"
                                    >
                                        →
                                    </span>
                                </div>
                                <div className="text-10 text-muted-foreground mt-1 leading-tight font-medium">
                                    boards
                                    <br />
                                    saved
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Traveler tier banner with metallic styling extending into open space */}
                <div className="mt-12 sm:mt-16 pt-4">
                    <span className="text-10 tracking-label text-muted-foreground mb-1.5 block font-bold uppercase">
                        Traveler Tier
                    </span>
                    <div
                        className={`font-display text-44 sm:text-56 lg:text-68 leading-none font-black tracking-wider uppercase select-none transition-all ${getTierGradientStyle(
                            profile.tier
                        )}`}
                    >
                        {profile.tier}
                    </div>
                </div>
            </div>
        </section>
    );
}
