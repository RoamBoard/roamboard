import type { UserProfile } from "@/types/social";

type Props = {
    profile: UserProfile;
};

export default function InterestingFacts({ profile }: Props) {
    return (
        <section
            aria-label="Interesting facts"
            className="border-line mt-12 border-t pt-8"
        >
            <h3 className="font-display text-20 sm:text-22 text-obsidian font-bold">
                some interesting facts about me
            </h3>

            <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-12 md:gap-10">
                {/* Column 1: Narrative snippets */}
                <div className="space-y-3 md:col-span-5">
                    {profile.facts.map((fact, index) => (
                        <p
                            key={index}
                            className="text-14 text-obsidian leading-relaxed"
                        >
                            {fact}
                        </p>
                    ))}
                </div>

                {/* Column 2: Structured icon details */}
                <div className="space-y-4 md:col-span-4">
                    <div className="text-14 text-obsidian flex items-center gap-3">
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-graphite shrink-0"
                            aria-hidden="true"
                        >
                            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                            <circle cx="12" cy="10" r="3" />
                        </svg>
                        <span>{profile.details.location}</span>
                    </div>

                    <div className="text-14 text-obsidian flex items-center gap-3">
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-graphite shrink-0"
                            aria-hidden="true"
                        >
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                            <path d="M2 12h20" />
                        </svg>
                        <span>
                            Speaks {profile.details.languages.join(", ")}
                        </span>
                    </div>

                    <div className="text-14 text-obsidian flex items-center gap-3">
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-graphite shrink-0"
                            aria-hidden="true"
                        >
                            <path d="m15.5 8.5 4 4-4 4" />
                            <path d="M4.5 12h15" />
                        </svg>
                        <span>
                            {profile.details.overlappingDestinations}{" "}
                            destinations overlapping with your boards
                        </span>
                    </div>

                    <div className="text-14 text-obsidian flex items-center gap-3">
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-graphite shrink-0"
                            aria-hidden="true"
                        >
                            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                            <circle cx="12" cy="13" r="3" />
                        </svg>
                        <span>
                            Interests: {profile.details.interests.join(", ")}
                        </span>
                    </div>
                </div>

                {/* Column 3: Handles and ID */}
                <div className="space-y-4 md:col-span-3">
                    <div>
                        <div className="text-10 tracking-label text-graphite font-bold uppercase">
                            online handle
                        </div>
                        <div className="font-display text-16 text-obsidian mt-0.5 font-bold">
                            {profile.handle}
                        </div>
                    </div>

                    <div>
                        <div className="text-10 tracking-label text-graphite font-bold uppercase">
                            whatsapp number
                        </div>
                        <div className="font-display text-16 text-obsidian mt-0.5 font-bold tracking-widest">
                            {profile.whatsapp}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
