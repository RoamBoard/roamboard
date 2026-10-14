import type { Metadata } from "next";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
    title: "Social | Roamboard",
    description: "Connect with travelers and discover shared journeys on Roamboard."
};

export default function SocialPage() {
    return (
        <AppShell
            activeHref="/social"
            profile={{
                profileHref: "/profile",
                settingsHref: "/settings"
            }}
        >
            <div className="relative h-full w-full overflow-hidden">
                {/* Vertical divider line separating sidebar and content */}
                <div
                    aria-hidden="true"
                    className="bg-line pointer-events-none absolute inset-y-0 left-[9rem] w-px sm:left-[10rem] lg:left-[11rem]"
                />

                {/* Content scroll container */}
                <div className="h-full w-full overflow-y-auto pt-10 pr-8 pl-[11.5rem] sm:pr-16 sm:pl-[12.5rem] lg:pr-24 lg:pl-[14rem]">
                    <div className="mx-auto w-full max-w-4xl pb-20">
                        <header className="mb-8">
                            <span className="text-10 tracking-label text-muted-foreground font-bold uppercase">
                                SOCIAL
                            </span>
                            <h1 className="font-display text-48 sm:text-60 text-foreground mt-1 font-bold tracking-tight uppercase">
                                COMMUNITY
                            </h1>
                        </header>

                        <div className="border-line bg-background rounded-[2px] border p-8 text-center sm:p-12">
                            <span className="border-line text-10 tracking-label text-muted-foreground font-body bg-faint rounded-[2px] border px-3 py-1 font-bold uppercase">
                                In Development
                            </span>
                            <h2 className="font-display text-24 sm:text-30 text-foreground mt-4 font-bold">
                                Social Feed &amp; Friends Hub
                            </h2>
                            <p className="text-14 text-muted-foreground mx-auto mt-2 max-w-md leading-relaxed font-medium">
                                The social discovery experience is currently being built. You will soon be able to
                                connect with friends, share boards, and discover travel inspiration across the
                                community.
                            </p>
                            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                                <Link
                                    href="/profile"
                                    className="border-line text-12 text-muted-foreground hover:text-foreground hover:border-foreground font-body cursor-pointer rounded-[2px] border px-4 py-2 font-medium transition-colors"
                                >
                                    Go to My Profile →
                                </Link>
                                <Link
                                    href="/boards"
                                    className="border-line text-12 text-muted-foreground hover:text-foreground hover:border-foreground font-body cursor-pointer rounded-[2px] border px-4 py-2 font-medium transition-colors"
                                >
                                    Explore Boards →
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
