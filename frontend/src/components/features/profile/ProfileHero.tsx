import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import { apiOrigin, type PublicProfile, type ProfileStats } from "@/lib/profile";
import { boardTags, boardTagHref } from "@/data/board-tags";
import TagIcon from "@/components/ui/TagIcon";

type Props = {
    profile: PublicProfile;
    stats: ProfileStats | null;
    isOwner?: boolean;
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

export default function ProfileHero({ profile, stats, isOwner = true }: Props) {
    const portraitUrl = profile.profilePicture ? new URL(profile.profilePicture.url, apiOrigin) : null;
    portraitUrl?.searchParams.set("variant", "display");
    const occupation = profile.occupation;
    const languages = profile.languages;
    const rawTags = profile.interests;
    const hasOccupation = Boolean(occupation);
    const hasLanguages = languages.length > 0;
    const hasTags = rawTags.length > 0;
    const hasBioMeta = hasOccupation || hasLanguages || hasTags;

    return (
        <section aria-label="Profile overview" className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
            {/* Left column: Hero photo + Name */}
            <div className="flex flex-col lg:col-span-5">
                <div className="bg-faint border-line relative aspect-[3/4] w-full overflow-hidden rounded-[2px] border">
                    {portraitUrl ? (
                        <Image
                            src={portraitUrl.toString()}
                            alt={`Portrait of ${profile.displayName}`}
                            fill
                            priority
                            unoptimized
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 40vw, 380px"
                            className="object-cover"
                        />
                    ) : (
                        <div className="text-muted-foreground flex h-full items-center justify-center">
                            No profile photo
                        </div>
                    )}

                    {/* Subtle bottom fade to guarantee readable contrast when display name overlaps */}
                    <div className="from-background/90 via-background/40 pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t to-transparent sm:h-28" />
                </div>

                {/* Display Name slightly overlapping the picture with responsive font sizing */}
                <h2
                    className={`font-display text-foreground relative z-10 px-1 font-black tracking-tight break-words uppercase select-none ${getNameStyle(
                        profile.displayName
                    )}`}
                >
                    {profile.displayName}
                </h2>
                <p className="text-12 text-muted-foreground mt-2 px-1">@{profile.username}</p>
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
                                    {profile.location || "—"}
                                </span>
                            </div>
                        </div>

                        {/* Top right button: [ edit profile ] */}
                        {isOwner && (
                            <div className="flex items-center gap-2">
                                <Link
                                    href="/settings"
                                    className="border-line text-12 text-muted-foreground hover:text-foreground hover:border-foreground font-body cursor-pointer rounded-[2px] border px-3.5 py-1 font-medium transition-colors"
                                >
                                    edit profile
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Biography */}
                    <div className="mt-8">
                        <p className="text-13 text-muted-foreground mt-3 max-w-xl leading-relaxed">
                            {profile.description.split(/\r\n?|\n/).map((line, index) => (
                                <Fragment key={index}>
                                    {index > 0 && <br />}
                                    {line}
                                </Fragment>
                            ))}{" "}
                            <span
                                className="text-muted-foreground/30 pointer-events-none animate-pulse font-normal select-none motion-reduce:animate-none"
                                aria-hidden="true"
                            >
                                |
                            </span>
                        </p>

                        {/* Bio Meta: Occupation, Languages & Tags */}
                        {hasBioMeta && (
                            <div className="border-line/60 mt-5 space-y-3 border-t pt-4">
                                {(hasOccupation || hasLanguages) && (
                                    <div className="text-12 text-muted-foreground font-body flex flex-wrap items-center gap-x-6 gap-y-2">
                                        {hasOccupation && (
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
                                                <span>{occupation}</span>
                                            </div>
                                        )}

                                        {hasLanguages && (
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
                                                <span>Speaks {languages.join(", ")}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {hasTags && (
                                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                        <div className="text-foreground mr-1 flex shrink-0 items-center gap-1.5 font-medium">
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
                                            <span className="text-muted-foreground text-12 font-normal">Tags:</span>
                                        </div>
                                        {rawTags.map((name) => {
                                            const tag = boardTags.find((item) => item.name === name);
                                            return tag ? (
                                                <Link
                                                    key={name}
                                                    href={boardTagHref(tag.id)}
                                                    title={`Explore ${name} tag: ${tag.description}`}
                                                    className="group border-line/60 hover:bg-faint/60 hover:border-foreground/70 text-11 text-muted-foreground hover:text-foreground font-body flex cursor-pointer items-center gap-1.5 rounded-[2px] border bg-transparent px-2 py-0.5 font-medium transition-colors"
                                                >
                                                    <TagIcon
                                                        tag={tag}
                                                        size={11}
                                                        className="text-muted-foreground/60 group-hover:text-foreground shrink-0 transition-colors"
                                                    />
                                                    <span>{name}</span>
                                                </Link>
                                            ) : (
                                                <span
                                                    key={name}
                                                    className="border-line/60 text-11 text-muted-foreground font-body flex items-center rounded-[2px] border bg-transparent px-2 py-0.5 font-medium"
                                                >
                                                    {name}
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Stats metrics row with vertical separator lines */}
                    {stats && (
                        <div className="border-line mt-8 border-t border-b py-6">
                            <div className="divide-line grid grid-cols-2 divide-x sm:grid-cols-5">
                                {/* Stat 1: countries visited */}
                                <div className="pr-3">
                                    <div className="font-display text-24 sm:text-30 text-foreground flex items-center gap-1.5 font-bold">
                                        {stats.countriesVisited}
                                        <span className="text-14 text-muted-foreground font-normal" aria-hidden="true">
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
                                        {stats.boardsCreated}
                                        <span className="text-14 text-muted-foreground font-normal" aria-hidden="true">
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
                                        {stats.friends}
                                        <span className="text-14 text-muted-foreground font-normal" aria-hidden="true">
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
                                        {stats.activitiesSaved}
                                        <span className="text-14 text-muted-foreground font-normal" aria-hidden="true">
                                            →
                                        </span>
                                    </div>
                                    <div className="text-10 text-muted-foreground mt-1 leading-tight font-medium">
                                        activities
                                        <br />
                                        saved
                                    </div>
                                </div>

                                {/* Stat 5: boards saved */}
                                <div className="pl-3">
                                    <div className="font-display text-24 sm:text-30 text-foreground flex items-center gap-1.5 font-bold">
                                        {stats.boardsSaved}
                                        <span className="text-14 text-muted-foreground font-normal" aria-hidden="true">
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
                    )}
                </div>
            </div>
        </section>
    );
}
