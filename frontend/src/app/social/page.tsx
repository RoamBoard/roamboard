import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import SocialPageContent from "@/components/features/social/SocialPageContent";
import { mockRowanProfile } from "@/data/mock-social";

export const metadata: Metadata = {
    title: "Social | Roamboard",
    description:
        "Traveler profile, shared boards, and visited places map on Roamboard."
};

export default function SocialPage() {
    return (
        <AppShell activeHref="/social" profile={{ href: "/profile" }}>
            <div className="relative h-full w-full overflow-hidden">
                {/* Vertical divider line separating sidebar and profile content */}
                <div
                    aria-hidden="true"
                    className="bg-line pointer-events-none absolute inset-y-0 left-[9rem] w-px sm:left-[10rem] lg:left-[11rem]"
                />

                {/* Profile content scroll container */}
                <div className="h-full w-full overflow-y-auto pt-10 pr-8 pl-[11.5rem] sm:pr-16 sm:pl-[12.5rem] lg:pr-24 lg:pl-[14rem]">
                    <SocialPageContent profile={mockRowanProfile} />
                </div>
            </div>
        </AppShell>
    );
}
