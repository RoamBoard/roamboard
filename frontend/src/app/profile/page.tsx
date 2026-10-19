import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import { ProfileRedirect } from "@/components/features/profile/HandleProfileContent";
import BackLink from "@/components/ui/BackLink";

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
                <div className="h-full w-full overflow-y-auto">
                    <BackLink fallbackHref="/social" className="mt-6 ml-4 sm:ml-8" />
                    <div className="px-4 pt-6 pb-20 sm:px-8 md:px-12 lg:px-16">
                        <ProfileRedirect />
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
