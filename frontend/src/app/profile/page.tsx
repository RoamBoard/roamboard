import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import { ProfileRedirect } from "@/components/features/profile/HandleProfileContent";

export const metadata: Metadata = {
    title: "Profile | Roamboard",
    description: "Traveler profile, shared boards, and visited places map on Roamboard."
};

export default function ProfilePage() {
    return (
        <AppShell
            activeHref="/profile"
            profile={{
                profileHref: "/profile",
                settingsHref: "/settings"
            }}
        >
            <div className="relative h-full w-full overflow-hidden">
                {/* Profile content scroll container */}
                <div className="h-full w-full overflow-y-auto px-4 pt-6 pb-20 sm:px-8 sm:pt-8 md:px-12 md:pt-10 lg:px-16">
                    <ProfileRedirect />
                </div>
            </div>
        </AppShell>
    );
}
